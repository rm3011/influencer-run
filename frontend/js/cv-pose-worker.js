const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MIN_VISIBILITY = 0.45;

let landmarker;
let lastLeadLeg = 0;
let lastStepAt = 0;
let totalSteps = 0;
const stepTimes = [];

async function createPoseLandmarker(PoseLandmarker, vision) {
    const options = { runningMode: 'VIDEO', numPoses: 1 };
    try {
        return {
            landmarker: await PoseLandmarker.createFromOptions(vision, {
                ...options,
                baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }
            }),
            usedCpu: false
        };
    } catch (gpuError) {
        try {
            return {
                landmarker: await PoseLandmarker.createFromOptions(vision, {
                    ...options,
                    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' }
                }),
                usedCpu: true
            };
        } catch (cpuError) {
            throw new Error(
                `GPU step tracking failed (${gpuError.message}); CPU fallback failed (${cpuError.message}).`
            );
        }
    }
}

function updateMotion(landmarks, timestamp) {
    const leftAnkle = landmarks?.[27];
    const rightAnkle = landmarks?.[28];
    if (leftAnkle && rightAnkle &&
        (leftAnkle.visibility ?? 1) >= MIN_VISIBILITY &&
        (rightAnkle.visibility ?? 1) >= MIN_VISIBILITY) {
        const difference = leftAnkle.y - rightAnkle.y;
        const leadLeg = difference < -0.025 ? -1 : difference > 0.025 ? 1 : 0;
        if (leadLeg && lastLeadLeg && leadLeg !== lastLeadLeg && timestamp - lastStepAt > 280) {
            totalSteps++;
            lastStepAt = timestamp;
            stepTimes.push(timestamp);
        }
        if (leadLeg) lastLeadLeg = leadLeg;
    } else {
        lastLeadLeg = 0;
    }

    while (stepTimes.length && timestamp - stepTimes[0] > 8000) stepTimes.shift();
    const cadence = stepTimes.length > 1
        ? (stepTimes.length - 1) * 60000 / (stepTimes[stepTimes.length - 1] - stepTimes[0])
        : 0;
    return { steps: totalSteps, cadence: Math.round(cadence) };
}

self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        try {
            const { FilesetResolver, PoseLandmarker } = await import(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
            );
            const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
            const setup = await createPoseLandmarker(PoseLandmarker, vision);
            landmarker = setup.landmarker;
            self.postMessage({
                type: 'ready',
                usedCpu: setup.usedCpu
            });
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
        self.postMessage({
            type: 'motion',
            motion: updateMotion(result.landmarks?.[0], timestamp),
            landmarks: result.landmarks?.[0]?.map((point) => ({
                x: point.x,
                y: point.y,
                visibility: point.visibility ?? 1
            })) || null
        });
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message || String(error) });
    } finally {
        bitmap.close();
    }
};
