const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const TUNING = {
    calibrate_ms: 700,
    ema_alpha: 0.68,
    lean_threshold: 0.12,
    lean_release: 0.055,
    vertical_threshold: 0.16,
    vertical_release: 0.075,
    confirm_frames: 2,
    immediate_multiplier: 1.7
};

let faceDetector;
let calibrationStartedAt = 0;
let calibrationCount = 0;
let leanSum = 0;
let verticalSum = 0;
let faceWidthSum = 0;
let faceHeightSum = 0;
let baselineLean = 0;
let baselineVertical = 0;
let baselineFaceWidth = 0;
let baselineFaceHeight = 0;
let calibrated = false;
let filteredLean = null;
let filteredVertical = null;
let leanDirection = 0;
let verticalAction = null;
let leanCandidate = 0;
let verticalCandidate = null;
let leanCandidateFrames = 0;
let verticalCandidateFrames = 0;
let noFaceFrames = 0;
const frameTimes = [];

async function createDetectorWithFallback(FaceDetector, vision) {
    const options = { runningMode: 'VIDEO', minDetectionConfidence: 0.5 };
    try {
        return {
            detector: await FaceDetector.createFromOptions(vision, {
                ...options,
                baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' }
            }),
            usedCpu: false
        };
    } catch (gpuError) {
        try {
            return {
                detector: await FaceDetector.createFromOptions(vision, {
                    ...options,
                    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' }
                }),
                usedCpu: true
            };
        } catch (cpuError) {
            throw new Error(
                `GPU head tracking failed (${gpuError.message}); CPU fallback failed (${cpuError.message}).`
            );
        }
    }
}

function faceMeasurements(detection, frameWidth, frameHeight) {
    const box = detection?.boundingBox;
    if (!box || box.width <= 0 || box.height <= 0) return null;
    const width = box.width / frameWidth;
    const height = box.height / frameHeight;
    if (width < 0.035 || height < 0.035) return null;
    const nose = detection.keypoints?.[2];
    return {
        x: nose?.x ?? (box.originX + box.width * 0.5) / frameWidth,
        y: nose?.y ?? (box.originY + box.height * 0.5) / frameHeight,
        width,
        height
    };
}

function detectHeadAction(detection, timestamp, frameWidth, frameHeight) {
    const head = faceMeasurements(detection, frameWidth, frameHeight);
    if (!head) {
        leanCandidateFrames = 0;
        verticalCandidateFrames = 0;
        noFaceFrames++;
        if (noFaceFrames === 4) self.postMessage({ type: 'status', status: 'finding' });
        return null;
    }

    if (noFaceFrames >= 4) self.postMessage({ type: 'status', status: 'tracking' });
    noFaceFrames = 0;

    if (filteredLean === null) {
        filteredLean = head.x;
        filteredVertical = head.y;
    } else {
        filteredLean += (head.x - filteredLean) * TUNING.ema_alpha;
        filteredVertical += (head.y - filteredVertical) * TUNING.ema_alpha;
    }

    if (!calibrationStartedAt) calibrationStartedAt = timestamp;
    if (calibrationCount < 12) {
        leanSum += filteredLean;
        verticalSum += filteredVertical;
        faceWidthSum += head.width;
        faceHeightSum += head.height;
        calibrationCount++;
    }
    if (timestamp - calibrationStartedAt < TUNING.calibrate_ms || calibrationCount < 8) return null;
    if (!calibrated) {
        baselineLean = leanSum / calibrationCount;
        baselineVertical = verticalSum / calibrationCount;
        baselineFaceWidth = faceWidthSum / calibrationCount;
        baselineFaceHeight = faceHeightSum / calibrationCount;
        calibrated = true;
        self.postMessage({ type: 'status', status: 'ready' });
        return null;
    }

    const lean = (filteredLean - baselineLean) / baselineFaceWidth;
    const vertical = (filteredVertical - baselineVertical) / baselineFaceHeight;
    let action = null;

    if (verticalAction === null) {
        const candidate = vertical < -TUNING.vertical_threshold ? 'jump'
            : vertical > TUNING.vertical_threshold ? 'roll'
            : null;
        if (!candidate) {
            verticalCandidate = null;
            verticalCandidateFrames = 0;
        } else {
            if (candidate === verticalCandidate) verticalCandidateFrames++;
            else {
                verticalCandidate = candidate;
                verticalCandidateFrames = 1;
            }
            if (verticalCandidateFrames >= TUNING.confirm_frames ||
                Math.abs(vertical) >= TUNING.vertical_threshold * TUNING.immediate_multiplier) {
                verticalAction = candidate;
                action = candidate;
                verticalCandidateFrames = 0;
            }
        }
    } else if (Math.abs(vertical) < TUNING.vertical_release) {
        verticalAction = null;
    }

    if (action === null && verticalAction === null) {
        if (Math.abs(lean) < TUNING.lean_release) {
            leanDirection = 0;
            leanCandidate = 0;
            leanCandidateFrames = 0;
        } else {
            const direction = lean > TUNING.lean_threshold ? 1
                : lean < -TUNING.lean_threshold ? -1 : 0;
            if (direction === 0 || direction === leanDirection) {
                leanCandidate = 0;
                leanCandidateFrames = 0;
            } else {
                if (direction === leanCandidate) leanCandidateFrames++;
                else {
                    leanCandidate = direction;
                    leanCandidateFrames = 1;
                }
                if (leanCandidateFrames >= TUNING.confirm_frames ||
                    Math.abs(lean) >= TUNING.lean_threshold * TUNING.immediate_multiplier) {
                    leanDirection = direction;
                    action = direction > 0 ? 'left' : 'right';
                    leanCandidateFrames = 0;
                }
            }
        }
    }
    return action;
}

function serializableFace(detection, frameWidth, frameHeight) {
    const box = detection?.boundingBox;
    if (!box) return null;
    return {
        box: {
            x: box.originX / frameWidth,
            y: box.originY / frameHeight,
            width: box.width / frameWidth,
            height: box.height / frameHeight
        },
        keypoints: detection.keypoints?.map(({ x, y }) => ({ x, y })) || []
    };
}

function postResult(action, detection, frameWidth, frameHeight, timestamp) {
    frameTimes.push(timestamp);
    while (frameTimes.length > 1 && timestamp - frameTimes[0] > 1000) frameTimes.shift();
    const fps = frameTimes.length > 1
        ? Math.round((frameTimes.length - 1) * 1000 / (frameTimes[frameTimes.length - 1] - frameTimes[0]))
        : 0;
    self.postMessage({
        type: 'result',
        action,
        face: serializableFace(detection, frameWidth, frameHeight),
        motion: { fps }
    });
}

self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        try {
            const { FilesetResolver, FaceDetector } = await import(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
            );
            const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
            const setup = await createDetectorWithFallback(FaceDetector, vision);
            faceDetector = setup.detector;
            if (setup.usedCpu) self.postMessage({ type: 'status', status: 'cpu-fallback' });
            self.postMessage({ type: 'ready' });
            self.postMessage({ type: 'status', status: 'calibrating' });
        } catch (error) {
            self.postMessage({ type: 'error', message: error.message || String(error) });
        }
        return;
    }

    if (data.type !== 'frame' || !faceDetector) {
        data.bitmap?.close();
        return;
    }

    const { bitmap, timestamp } = data;
    try {
        const result = faceDetector.detectForVideo(bitmap, timestamp);
        const detection = result.detections?.[0] || null;
        const action = detectHeadAction(detection, timestamp, bitmap.width, bitmap.height);
        postResult(action, detection, bitmap.width, bitmap.height, timestamp);
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message || String(error) });
    } finally {
        bitmap.close();
    }
};
