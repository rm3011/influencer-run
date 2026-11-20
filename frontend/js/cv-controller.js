const DETECT_INTERVAL = 1000 / 30;
const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 192;

let _handle = null;

const FACE_EDGES = [
    [4, 0], [0, 2], [2, 1], [1, 5], [2, 3]
];

const POSE_EDGES = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]
];

function drawEdges(context, landmarks, edges, width, height) {
    if (!landmarks) return;
    for (const [from, to] of edges) {
        const a = landmarks[from];
        const b = landmarks[to];
        if (!a || !b || a.visibility < 0.35 || b.visibility < 0.35) continue;
        context.beginPath();
        context.moveTo(a.x * width, a.y * height);
        context.lineTo(b.x * width, b.y * height);
        context.stroke();
    }
}

function drawSkeleton(canvas, landmarks = {}) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { face, pose } = landmarks || {};

    context.strokeStyle = '#2ee6c5';
    context.lineWidth = 2;
    if (face?.box) {
        context.strokeRect(
            face.box.x * canvas.width,
            face.box.y * canvas.height,
            face.box.width * canvas.width,
            face.box.height * canvas.height
        );
        drawEdges(context, face.keypoints, FACE_EDGES, canvas.width, canvas.height);
    }
    drawEdges(context, pose, POSE_EDGES, canvas.width, canvas.height);
}

export async function startCV(onAction, onStatus, onMotion) {
    if (_handle) return _handle;
    if (!navigator.mediaDevices?.getUserMedia || !('Worker' in window) || !('createImageBitmap' in window)) {
        throw new Error('Camera controls require a browser with webcam, worker, and ImageBitmap support.');
    }

    onStatus?.('loading');
    let stream;
    let worker;
    let poseWorker;
    const video = document.getElementById('camera-preview');
    const canvas = document.getElementById('camera-skeleton');
    const panel = document.getElementById('camera-panel');
    let running = true;
    let busy = false;
    let poseBusy = false;
    let poseReady = false;
    let lastFrameAt = 0;
    let lastPoseAt = 0;
    let cameraFps = 0;
    let headFps = 0;
    let latestMotion = { steps: 0, cadence: 0 };
    let latestFace = null;
    let latestPose = null;
    let fallbackTimer = null;
    const supportsVideoFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    function stopResources() {
        running = false;
        if (fallbackTimer !== null) clearInterval(fallbackTimer);
        worker?.terminate();
        poseWorker?.terminate();
        stream?.getTracks().forEach((track) => track.stop());
        if (video) video.srcObject = null;
        panel?.classList.add('hidden');
        drawSkeleton(canvas, null);
        _handle = null;
    }

    function reportMotion() {
        onMotion?.({ ...latestMotion, fps: headFps, cameraFps });
    }

    _handle = { stop: stopResources };

    try {
        worker = new Worker(new URL('./cv-worker.js', import.meta.url));
        try {
            poseWorker = new Worker(new URL('./cv-pose-worker.js', import.meta.url));
        } catch (error) {
            onStatus?.('fitness-unavailable', error.message);
        }
        worker.onmessage = ({ data }) => {
            if (data.type === 'ready') {
                resolveReady();
            } else if (data.type === 'status') {
                onStatus?.(data.status, data.message);
            } else if (data.type === 'result') {
                busy = false;
                headFps = data.motion.fps;
                latestFace = data.face;
                drawSkeleton(canvas, {
                    face: latestFace,
                    pose: latestPose
                });
                if (data.action) onAction(data.action);
                reportMotion();
            } else if (data.type === 'error') {
                busy = false;
                const error = new Error(data.message);
                rejectReady(error);
                if (running) {
                    stopResources();
                    onStatus?.('error');
                    console.error('[cv] tracking worker failed:', error);
                }
            }
        };
        worker.onerror = (event) => {
            busy = false;
            const error = new Error(event.message || 'Head-tracking worker failed to load.');
            rejectReady(error);
            if (running) {
                stopResources();
                onStatus?.('error');
                console.error('[cv] tracking worker error:', error);
            }
        };
        if (poseWorker) {
            poseWorker.onmessage = ({ data }) => {
                if (!running) return;
                if (data.type === 'ready') {
                    poseReady = true;
                    if (data.usedCpu) onStatus?.('fitness-cpu-fallback');
                } else if (data.type === 'motion') {
                    poseBusy = false;
                    latestMotion = data.motion;
                    latestPose = data.landmarks;
                    drawSkeleton(canvas, { face: latestFace, pose: latestPose });
                    reportMotion();
                } else if (data.type === 'error') {
                    poseBusy = false;
                    poseReady = false;
                    onStatus?.('fitness-unavailable', data.message);
                    console.warn('[cv] step tracking unavailable:', data.message);
                    poseWorker?.terminate();
                    poseWorker = null;
                }
            };
            poseWorker.onerror = (event) => {
                if (!running) return;
                poseBusy = false;
                poseReady = false;
                onStatus?.('fitness-unavailable', event.message || 'Step-tracking worker failed.');
                console.warn('[cv] step-tracking worker error:', event.message);
                poseWorker?.terminate();
                poseWorker = null;
            };
        }
        worker.postMessage({ type: 'init' });
        poseWorker?.postMessage({ type: 'init' });

        const videoReady = navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                width: { ideal: 320, max: 640 },
                height: { ideal: 240, max: 480 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: 'user'
            }
        }).then(async (cameraStream) => {
            if (!running) {
                cameraStream.getTracks().forEach((track) => track.stop());
                throw new Error('Camera startup was cancelled.');
            }
            stream = cameraStream;
            const videoTrack = stream.getVideoTracks()[0];
            cameraFps = Math.round(videoTrack?.getSettings?.().frameRate || 0);
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            await video.play();
            if (!running) throw new Error('Camera startup was cancelled.');
            panel?.classList.remove('hidden');
        });
        await Promise.all([videoReady, ready]);
    } catch (error) {
        stopResources();
        if (error.name === 'NotReadableError') {
            throw new Error('The camera is busy in another app or browser tab. Close other camera apps/tabs, then retry.');
        }
        if (error.name === 'NotAllowedError') {
            throw new Error('Camera permission was denied. Allow camera access for this site, then retry.');
        }
        throw error;
    }

    async function processVideoFrame(now) {
        if (!running) return;
        if (supportsVideoFrameCallback) video.requestVideoFrameCallback(processVideoFrame);
        if (busy || now - lastFrameAt < DETECT_INTERVAL || video.readyState < 2) return;

        lastFrameAt = now;
        busy = true;
        try {
            const bitmap = await createImageBitmap(video, {
                resizeWidth: FRAME_WIDTH,
                resizeHeight: FRAME_HEIGHT
            });
            if (!running) {
                bitmap.close();
                busy = false;
                return;
            }
            worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
            const poseInterval = headFps >= 20 ? 500 : 1000;
            if (poseWorker && poseReady && !poseBusy && now - lastPoseAt >= poseInterval) {
                lastPoseAt = now;
                poseBusy = true;
                try {
                    const poseBitmap = await createImageBitmap(video, {
                        resizeWidth: FRAME_WIDTH,
                        resizeHeight: FRAME_HEIGHT
                    });
                    if (!running) {
                        poseBitmap.close();
                        poseBusy = false;
                        return;
                    }
                    if (!poseWorker) {
                        poseBitmap.close();
                        poseBusy = false;
                        return;
                    }
                    poseWorker.postMessage({ type: 'frame', bitmap: poseBitmap, timestamp: now }, [poseBitmap]);
                } catch (error) {
                    poseBusy = false;
                    onStatus?.('fitness-unavailable', error.message);
                    console.warn('[cv] could not prepare step-tracking frame:', error);
                }
            }
        } catch (error) {
            busy = false;
            if (running) {
                stopResources();
                onStatus?.('error');
                console.error('[cv] could not prepare camera frame:', error);
            }
        }
    }

    if (supportsVideoFrameCallback) {
        video.requestVideoFrameCallback(processVideoFrame);
    } else {
        fallbackTimer = setInterval(() => processVideoFrame(performance.now()), DETECT_INTERVAL);
    }

    return _handle;
}
