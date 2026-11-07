const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const LM = { NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12 };

const TUNING = {
    detectHz: 15,
    leanThreshold: 0.06,
    jumpYOffset: 0.10,
    rollYOffset: 0.10,
    jumpSustainMs: 200,
    rollSustainMs: 130,
    cooldownMs: 350,
    calibrateMs: 1400,
    emaAlpha: 0.35,
    minVisibility: 0.5,
    baselineDrift: 0.002
};

let _handle = null;

export async function startCV(onAction, onStatus) {
    if (_handle) return _handle;

    onStatus?.('loading');

    const { FilesetResolver, PoseLandmarker } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
    );
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1
    });

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 15, facingMode: 'user' }
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const dbg = document.getElementById('cv-debug');
    const ctx = dbg.getContext('2d', { alpha: false });
    const W = dbg.width;
    const H = dbg.height;

    // --- Hot-path locals ---
    const LEAN_TH = TUNING.leanThreshold;
    const JUMP_TH = -TUNING.jumpYOffset;
    const ROLL_TH = TUNING.rollYOffset;
    const EMA = TUNING.emaAlpha;
    const MIN_VIS = TUNING.minVisibility;
    const DRIFT = TUNING.baselineDrift;
    const DETECT_INTERVAL = 1000 / TUNING.detectHz;

    // --- State ---
    let baseline = null;
    let calibSum = 0;
    let calibCount = 0;
    let calibStartedAt = 0;
    let lastDetectAt = 0;
    let lastActionAt = 0;
    let lastAction = '—';
    let emaNoseY = null;
    let emaLean = 0;
    let jumpSince = 0;
    let rollSince = 0;
    let running = true;
    let latestResult = null;  // latest detection output for debug drawing

    onStatus?.('calibrating');

    // --- MediaPipe work: fires only when webcam delivers a frame ---
    function processVideoFrame(now) {
        if (!running) return;
        video.requestVideoFrameCallback(processVideoFrame);

        if (now - lastDetectAt < DETECT_INTERVAL) return;
        lastDetectAt = now;

        let result;
        try {
            result = landmarker.detectForVideo(video, now);
        } catch {
            return;
        }

        const lm = result.landmarks && result.landmarks[0];
        if (!lm) {
            jumpSince = 0;
            rollSince = 0;
            return;
        }

        const nose = lm[LM.NOSE];
        if (!nose || (nose.visibility !== undefined && nose.visibility < MIN_VIS)) {
            jumpSince = 0;
            rollSince = 0;
            return;
        }

        const rawNoseY = nose.y;
        const rawLean = nose.x - (lm[LM.L_SHOULDER].x + lm[LM.R_SHOULDER].x) * 0.5;

        if (emaNoseY === null) {
            emaNoseY = rawNoseY;
            emaLean = rawLean;
        } else {
            emaNoseY = emaNoseY * (1 - EMA) + rawNoseY * EMA;
            emaLean  = emaLean  * (1 - EMA) + rawLean  * EMA;
        }

        // Calibration
        if (baseline === null) {
            if (calibStartedAt === 0) calibStartedAt = now;
            calibSum += emaNoseY;
            calibCount++;
            if (now - calibStartedAt >= TUNING.calibrateMs && calibCount >= 8) {
                baseline = calibSum / calibCount;
                onStatus?.('ready');
            }
            latestResult = { yOff: 0, jumpMs: 0, rollMs: 0, lean: emaLean };
            return;
        }

        const yOff = emaNoseY - baseline;
        baseline += yOff * DRIFT;

        if (yOff < JUMP_TH) {
            if (jumpSince === 0) jumpSince = now;
        } else {
            jumpSince = 0;
        }
        if (yOff > ROLL_TH) {
            if (rollSince === 0) rollSince = now;
        } else {
            rollSince = 0;
        }

        const jumpMs = jumpSince ? now - jumpSince : 0;
        const rollMs = rollSince ? now - rollSince : 0;

        // Dispatch actions
        const cooled = now - lastActionAt >= TUNING.cooldownMs;
        if (cooled) {
            let action = null;
            if (jumpMs >= TUNING.jumpSustainMs) {
                action = 'jump';
                jumpSince = 0;
            } else if (rollMs >= TUNING.rollSustainMs) {
                action = 'roll';
                rollSince = 0;
            } else if (emaLean > LEAN_TH) {
                action = 'left';
            } else if (emaLean < -LEAN_TH) {
                action = 'right';
            }
            if (action) {
                onAction(action);
                lastAction = action;
                lastActionAt = now;
            }
        }

        latestResult = { yOff, jumpMs, rollMs, lean: emaLean };
    }

    // --- Debug canvas draw: called once per game frame from main.js ---
    function drawDebugFrame() {
        if (!running) return;

        // Full clear first
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);

        // Mirrored webcam
        if (video.readyState >= 2) {
            ctx.setTransform(-1, 0, 0, 1, W, 0);
            ctx.drawImage(video, 0, 0, W, H);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // Text overlay
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, 40);
        ctx.font = '10px monospace';

        const m = latestResult || { yOff: 0, jumpMs: 0, rollMs: 0, lean: 0 };

        ctx.fillStyle = '#00ff88';
        ctx.fillText(
            `base:${baseline ? baseline.toFixed(3) : '—'} ` +
            `yOff:${m.yOff.toFixed(3)} ` +
            `lean:${m.lean.toFixed(3)}`,
            4, 12
        );

        ctx.fillStyle = lastAction === '—' ? '#888' : '#ffff00';
        ctx.fillText(`last:${lastAction}`, 4, 26);

        const jPct = Math.min(1, m.jumpMs / TUNING.jumpSustainMs);
        const rPct = Math.min(1, m.rollMs / TUNING.rollSustainMs);
        ctx.fillStyle = '#00aaff';
        ctx.fillText(
            `J:${(jPct * 100).toFixed(0)}%  R:${(rPct * 100).toFixed(0)}%`,
            4, 39
        );
    }

    // Kick off MediaPipe processing tied to webcam frame delivery
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        video.requestVideoFrameCallback(processVideoFrame);
    } else {
        // Fallback for old browsers — use a setInterval at detectHz
        setInterval(() => processVideoFrame(performance.now()), DETECT_INTERVAL);
    }

    _handle = {
        stop() {
            running = false;
            stream.getTracks().forEach(t => t.stop());
            try { landmarker.close(); } catch {}
            _handle = null;
        },
        drawDebugFrame
    };
    return _handle;
}