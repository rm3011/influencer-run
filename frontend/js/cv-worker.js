const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const TUNING = {
    calibrateMs: 700,
    minVisibility: 0.45,
    emaAlpha: 0.85,
    leanThreshold: 0.1,
    leanRelease: 0.045,
    verticalThreshold: 0.12,
    verticalRelease: 0.055,
    confirmFrames: 1
};

let landmarker;
let calibrationStartedAt = 0;
let calibrationCount = 0;
let leanSum = 0;
let verticalSum = 0;
let baselineLean = 0;
let baselineVertical = 0;
let calibrated = false;
let filteredLean = null;
let filteredVertical = null;
let leanDirection = 0;
let verticalAction = null;
let leanCandidate = 0;
let verticalCandidate = null;
let leanCandidateFrames = 0;
let verticalCandidateFrames = 0;
let noPoseFrames = 0;

self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        try {
            const { FilesetResolver, PoseLandmarker } = await import(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
            );
            const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
            landmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
                runningMode: 'VIDEO',
                numPoses: 1
            });
            self.postMessage({ type: 'ready' });
            self.postMessage({ type: 'status', status: 'calibrating' });
        } catch (error) {
            self.postMessage({ type: 'error', message: error.message || String(error) });
        }
        return;
    }

    if (data.type !== 'frame' || !landmarker) {
        data.bitmap?.close();
        return;
    }

    const { bitmap, timestamp } = data;
    try {
        const result = landmarker.detectForVideo(bitmap, timestamp);
        const landmarks = result.landmarks?.[0];
        const nose = landmarks?.[0];
        const leftShoulder = landmarks?.[11];
        const rightShoulder = landmarks?.[12];
        if (!nose || !leftShoulder || !rightShoulder ||
            (nose.visibility ?? 1) < TUNING.minVisibility ||
            (leftShoulder.visibility ?? 1) < TUNING.minVisibility ||
            (rightShoulder.visibility ?? 1) < TUNING.minVisibility) {
            leanCandidateFrames = 0;
            verticalCandidateFrames = 0;
            noPoseFrames++;
            if (noPoseFrames === 4) self.postMessage({ type: 'status', status: 'finding' });
            self.postMessage({ type: 'result', action: null });
            return;
        }
        if (noPoseFrames >= 4) self.postMessage({ type: 'status', status: 'tracking' });
        noPoseFrames = 0;

        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        if (shoulderWidth < 0.035) {
            self.postMessage({ type: 'result', action: null });
            return;
        }

        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) * 0.5;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) * 0.5;
        const rawLean = (nose.x - shoulderCenterX) / shoulderWidth;
        const rawVertical = (nose.y - shoulderCenterY) / shoulderWidth;
        if (filteredLean === null) {
            filteredLean = rawLean;
            filteredVertical = rawVertical;
        } else {
            filteredLean += (rawLean - filteredLean) * TUNING.emaAlpha;
            filteredVertical += (rawVertical - filteredVertical) * TUNING.emaAlpha;
        }

        if (!calibrationStartedAt) calibrationStartedAt = timestamp;
        if (calibrationCount < 12) {
            leanSum += filteredLean;
            verticalSum += filteredVertical;
            calibrationCount++;
        }
        if (timestamp - calibrationStartedAt < TUNING.calibrateMs || calibrationCount < 8) {
            self.postMessage({ type: 'result', action: null });
            return;
        }
        if (!calibrated) {
            baselineLean = leanSum / calibrationCount;
            baselineVertical = verticalSum / calibrationCount;
            calibrated = true;
            self.postMessage({ type: 'status', status: 'ready' });
            self.postMessage({ type: 'result', action: null });
            return;
        }

        const lean = filteredLean - baselineLean;
        const vertical = filteredVertical - baselineVertical;
        let action = null;

        if (verticalAction === null) {
            const candidate = vertical < -TUNING.verticalThreshold
                ? 'jump'
                : vertical > TUNING.verticalThreshold ? 'roll' : null;
            if (candidate === null) {
                verticalCandidate = null;
                verticalCandidateFrames = 0;
            } else {
                if (candidate === verticalCandidate) verticalCandidateFrames++;
                else {
                    verticalCandidate = candidate;
                    verticalCandidateFrames = 1;
                }
                if (verticalCandidateFrames >= TUNING.confirmFrames) {
                    verticalAction = candidate;
                    action = candidate;
                    verticalCandidateFrames = 0;
                }
            }
        } else if (Math.abs(vertical) < TUNING.verticalRelease) {
            verticalAction = null;
        }

        if (action === null && verticalAction === null) {
            if (Math.abs(lean) < TUNING.leanRelease) {
                leanDirection = 0;
                leanCandidate = 0;
                leanCandidateFrames = 0;
            } else {
                const direction = lean > TUNING.leanThreshold ? 1
                    : lean < -TUNING.leanThreshold ? -1 : 0;
                if (direction === 0 || direction === leanDirection) {
                    leanCandidate = 0;
                    leanCandidateFrames = 0;
                } else {
                    if (direction === leanCandidate) leanCandidateFrames++;
                    else {
                        leanCandidate = direction;
                        leanCandidateFrames = 1;
                    }
                    if (leanCandidateFrames >= TUNING.confirmFrames) {
                        leanDirection = direction;
                        action = direction > 0 ? 'left' : 'right';
                        leanCandidateFrames = 0;
                    }
                }
            }
        }

        self.postMessage({ type: 'result', action });
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message || String(error) });
    } finally {
        bitmap.close();
    }
};
