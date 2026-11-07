const DETECT_INTERVAL = 1000 / 15;
const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 192;

let _handle = null;

export async function startCV(onAction, onStatus) {
    if (_handle) return _handle;
    if (!navigator.mediaDevices?.getUserMedia || !('Worker' in window) || !('createImageBitmap' in window)) {
        throw new Error('Camera controls require a browser with webcam, worker, and ImageBitmap support.');
    }

    onStatus?.('loading');
    let stream;
    let worker;
    let video;
    let running = true;
    let busy = false;
    let lastFrameAt = 0;
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
        stream?.getTracks().forEach((track) => track.stop());
        if (video) video.srcObject = null;
        _handle = null;
    }

    _handle = { stop: stopResources };

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                width: { ideal: FRAME_WIDTH },
                height: { ideal: FRAME_HEIGHT },
                frameRate: { ideal: 20, max: 30 },
                facingMode: 'user'
            }
        });

        video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        worker = new Worker(new URL('./cv-worker.js', import.meta.url));
        worker.onmessage = ({ data }) => {
            if (data.type === 'ready') {
                resolveReady();
            } else if (data.type === 'status') {
                onStatus?.(data.status);
            } else if (data.type === 'result') {
                busy = false;
                if (data.action) onAction(data.action);
            } else if (data.type === 'error') {
                busy = false;
                const error = new Error(data.message);
                rejectReady(error);
                if (running) {
                    stopResources();
                    onStatus?.('error');
                    console.error('[cv] pose worker failed:', error);
                }
            }
        };
        worker.onerror = (event) => {
            busy = false;
            const error = new Error(event.message || 'Pose worker failed to load.');
            rejectReady(error);
            if (running) {
                stopResources();
                onStatus?.('error');
                console.error('[cv] pose worker error:', error);
            }
        };
        worker.postMessage({ type: 'init' });
        await ready;
    } catch (error) {
        stopResources();
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
