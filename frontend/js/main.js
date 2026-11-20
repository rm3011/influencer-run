import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import { createPlayer } from './player.js';
import { createObstaclePool, trySpawnObstacle, updateObstacles, recyclePassedObstacles,
         checkCollision, resetObstacles } from './obstacles.js';
import { createCoinPool, spawnCoinTrail, laneHasCoins, resetCoins, updateCollectibles,
         checkCoinCollision, getCoinPoints, setCollectibleCharacter } from './collectibles.js';
import { Input, attachKeyboard, attachTouch } from './input.js';
import { startCV } from './cv-controller.js';
import { startFitnessSession, updateFitnessSession, finishFitnessSession } from './fitness-api.js';
import { initFitnessDashboard, showFitnessDashboard } from './fitness-dashboard.js';
import {
    initUI, showStart, showCountdown, showGameOver, hideAllOverlays, onMenu, onCharacterSelect,
    onDashboard, onWorkoutFinish, setWorkoutStatus, setScore, setCoins, setDistance, setBest, getBest, setModeStatus, setControlStatus,
    setFitnessTelemetry, setFitnessEstimate, setFitnessServiceError, recordRun
} from './menu.js';

const env = createEnvironment();
const { scene, camera, renderer, updateWorld } = env;
const player = createPlayer(scene);
const obstacles = createObstaclePool(scene);
const coins = createCoinPool(scene);

initUI();
initFitnessDashboard();
onDashboard(showFitnessDashboard);
onWorkoutFinish(() => { void finishFitnessWorkout(); });

const game = {
    state: 'menu',            // menu | countdown | playing | gameover
    controlMode: 'keyboard',
    score: 0, coins: 0, distance: 0,
    speed: CONFIG.game.baseSpeed,
    spawnDist: 20, coinDist: 35, elapsed: 0,
    canRestart: false
};
attachKeyboard(() => game.controlMode === 'keyboard');
attachTouch(() => game.controlMode === 'keyboard');
Input.clear();

// ---------------- camera (menu hero shot -> chase cam) ----------------
const M = CONFIG.camera.menu, G = CONFIG.camera.game;
const cam = { px: M.pos[0], py: M.pos[1], pz: M.pos[2], lx: M.look[0], ly: M.look[1], lz: M.look[2] };
const shake = { x: 0, y: 0 };
let followX = 0;

function tweenCamera(pose, duration) {
    gsap.to(cam, {
        px: pose.pos[0], py: pose.pos[1], pz: pose.pos[2],
        lx: pose.look[0], ly: pose.look[1], lz: pose.look[2],
        duration, ease: 'power3.inOut', overwrite: true
    });
}

let cvHandle = null;
let cvReady = false;
let joggerStartPending = false;
let cvRequestId = 0;
let controlStatusTimer = null;
let fitnessSessionId = null;
let fitnessStartPending = false;
let fitnessProgressTimer = null;
let fitnessProgressRequest = null;
let sessionStepBaseline = 0;
let fitnessStartedAt = 0;
let currentMotion = { steps: 0, cadence: 0 };

function stopCameraTracking() {
    cvRequestId++;
    joggerStartPending = false;
    cvHandle?.stop();
    cvHandle = null;
    cvReady = false;
}

function sessionSample() {
    return {
        elapsed_seconds: fitnessStartedAt ? Math.floor((performance.now() - fitnessStartedAt) / 1000) : 0,
        steps: Math.max(0, currentMotion.steps - sessionStepBaseline),
        cadence_spm: currentMotion.cadence
    };
}

async function sendFitnessProgress() {
    if (!fitnessSessionId || !['playing', 'gameover'].includes(game.state) || fitnessProgressRequest) return;
    const sessionId = fitnessSessionId;
    fitnessProgressRequest = updateFitnessSession(sessionId, sessionSample());
    try {
        const metrics = await fitnessProgressRequest;
        if (fitnessSessionId === sessionId) setFitnessEstimate(metrics);
    } catch (error) {
        setFitnessServiceError(error.message);
    } finally {
        fitnessProgressRequest = null;
    }
}

async function finishFitnessWorkout() {
    if (!fitnessSessionId) {
        stopCameraTracking();
        return;
    }
    const sessionId = fitnessSessionId;
    const sample = sessionSample();
    fitnessSessionId = null;
    clearInterval(fitnessProgressTimer);
    fitnessProgressTimer = null;
    stopCameraTracking();
    if (fitnessProgressRequest) {
        try {
            await fitnessProgressRequest;
        } catch (error) {
            setFitnessServiceError(error.message);
        }
    }
    try {
        const metrics = await finishFitnessSession(sessionId, sample);
        setFitnessEstimate(metrics);
        const distance = metrics.estimated_distance_m == null
            ? 'metrics unavailable'
            : `~${(metrics.estimated_distance_m / 1000).toFixed(2)} km, ~${Math.round(metrics.estimated_calories_kcal)} kcal`;
        setWorkoutStatus(`Workout saved: ${sample.steps} camera-detected steps; ${distance}.`);
    } catch (error) {
        setFitnessServiceError(error.message);
        setWorkoutStatus(`Could not save workout: ${error.message}`);
    }
}

async function startCameraWorkout(requestId = cvRequestId) {
    if (requestId !== cvRequestId || !cvReady || fitnessStartPending) return;
    if (fitnessSessionId) {
        beginGame();
        return;
    }
    fitnessStartPending = true;
    setModeStatus('Starting your camera-controlled run locally…', true);
    beginGame();
    try {
        const session = await startFitnessSession();
        if (requestId !== cvRequestId || game.controlMode !== 'jogger') {
            await finishFitnessSession(session.session_id, {
                elapsed_seconds: 0,
                steps: 0,
                cadence_spm: 0
            });
            return;
        }
        fitnessSessionId = session.session_id;
        fitnessStartedAt = performance.now();
        sessionStepBaseline = currentMotion.steps;
        setModeStatus('Camera run active. Saving workout data…', true);
        clearInterval(fitnessProgressTimer);
        fitnessProgressTimer = setInterval(() => { void sendFitnessProgress(); }, 2000);
    } catch (error) {
        if (requestId !== cvRequestId) return;
        setModeStatus(`Camera run is local; workout data was not saved: ${error.message}`, false, true);
        setControlStatus(`Camera controls are active locally. Workout data was not saved: ${error.message}`, true);
    } finally {
        fitnessStartPending = false;
    }
}

// ---------------- scoring ----------------
function addScore(n) {
    game.score += n;
    game.speed = Math.min(CONFIG.game.maxSpeed, CONFIG.game.baseSpeed + game.score * CONFIG.game.speedPerScore);
    setScore(game.score, true);
}

// ---------------- spawning ----------------
const laneEmpty = (lane) => !obstacles.some(o => o.active && o.lane === lane);

function spawnWave() {
    const blocked = (lane) => laneHasCoins(coins, lane);   // keep traffic out of coin trails
    trySpawnObstacle(obstacles, blocked);
    if (Math.random() < 0.3) trySpawnObstacle(obstacles, blocked);
}

function spawnCoins() {
    const lanes = [0, 1, 2].filter(l => laneEmpty(l) && !laneHasCoins(coins, l));
    if (!lanes.length) return;
    const lane = lanes[(Math.random() * lanes.length) | 0];
    spawnCoinTrail(coins, lane, CONFIG.game.spawnZ + 5, 5, 2.4);
}

// ---------------- lifecycle ----------------
function beginGame() {
    joggerStartPending = false;
    Object.assign(game, {
        score: 0, coins: 0, distance: 0, speed: CONFIG.game.baseSpeed,
        spawnDist: 25, coinDist: 30, elapsed: 0, canRestart: false, state: 'countdown'
    });
    player.reset();
    player.setPose('idle');
    resetObstacles(obstacles);
    resetCoins(coins);
    Input.clear();
    setScore(0, false); setCoins(0, false); setDistance(0);
    lastDist = -1;

    tweenCamera(CONFIG.camera.game, 1.3);
    hideAllOverlays();
    showCountdown(3, () => {
        if (game.controlMode === 'jogger') {
            setFitnessTelemetry({
                steps: Math.max(0, currentMotion.steps - sessionStepBaseline),
                cadence: currentMotion.cadence
            });
        }
        game.state = 'playing';
        player.setPose('run');
    });
}

function startKeyboardGame() {
    game.controlMode = 'keyboard';
    stopCameraTracking();
    setModeStatus('Keyboard controls selected.', false);
    setControlStatus('Keyboard controls: arrows or WASD.');
    beginGame();
}

async function startJoggerGame() {
    if (joggerStartPending || fitnessStartPending) return;
    game.controlMode = 'jogger';
    if (cvReady) {
        void startCameraWorkout(cvRequestId);
        setControlStatus('Move your head: lean left/right to steer, raise to jump, lower to roll.');
        return;
    }

    stopCameraTracking();
    const requestId = cvRequestId;
    joggerStartPending = true;
    setModeStatus('Starting camera. Allow access, face the screen, and stand still to calibrate.', true);
    try {
        const handle = await startCV(
            (action) => {
                if (requestId !== cvRequestId || game.controlMode !== 'jogger') return;
                Input.push(action);
                const labels = { left: 'left', right: 'right', jump: 'jump', roll: 'roll' };
                setControlStatus(`Jogger detected: ${labels[action]}.`);
                clearTimeout(controlStatusTimer);
                controlStatusTimer = setTimeout(() => {
                    if (game.controlMode === 'jogger') {
                        setControlStatus('Move your head: lean left/right to steer, raise to jump, lower to roll.');
                    }
                }, 900);
            },
            (status, message) => {
                if (requestId !== cvRequestId) return;
                if (status === 'loading') {
                    setModeStatus('Loading real-time head tracking...', true);
                } else if (status === 'calibrating') {
                    document.getElementById('camera-indicator').style.color = '#ffd23d';
                    setModeStatus('Camera ready. Stand centered and look at the screen to calibrate.', true);
                    setControlStatus('Camera connected. Stand centered to calibrate.');
                } else if (status === 'finding') {
                    document.getElementById('camera-indicator').style.color = '#ff6c7d';
                    setControlStatus('Face not visible. Face the camera; jogger controls are paused.', true);
                    if (!cvReady) setModeStatus('Looking for your face. Face the camera and move into view.', false);
                } else if (status === 'cpu-fallback') {
                    setControlStatus('Head tracking is using the CPU; tracking speed may be lower.');
                } else if (status === 'fitness-cpu-fallback') {
                    setControlStatus('Head controls are active. CPU fallback is being used for step tracking.');
                } else if (status === 'fitness-unavailable') {
                    setControlStatus(`Head controls are active, but step tracking is unavailable: ${message}`, true);
                } else if (status === 'tracking') {
                    document.getElementById('camera-indicator').style.color = '#2ee6c5';
                    setControlStatus('Move your head: lean left/right to steer, raise to jump, lower to roll.');
                } else if (status === 'ready') {
                    document.getElementById('camera-indicator').style.color = '#2ee6c5';
                    cvReady = true;
                    setModeStatus('Head tracking ready. Starting local camera controls…', true);
                    setControlStatus('Move your head: lean left/right to steer, raise to jump, lower to roll.');
                    if (joggerStartPending) void startCameraWorkout(requestId);
                } else if (status === 'error') {
                    document.getElementById('camera-indicator').style.color = '#ff6c7d';
                    cvReady = false;
                    joggerStartPending = false;
                    if (fitnessSessionId) void finishFitnessWorkout();
                    setModeStatus('Camera tracking stopped. Choose a control mode to try again.', false, true);
                    setControlStatus('Camera tracking stopped. Choose keyboard or retry jogger mode.', true);
                }
            },
            (motion) => {
                if (requestId !== cvRequestId) return;
                currentMotion = motion;
                const cameraRate = motion.cameraFps ? `CAM ${motion.cameraFps}` : 'CAM --';
                document.getElementById('camera-fps').textContent = `${cameraRate} / HEAD ${motion.fps} FPS`;
                const steps = fitnessSessionId ? Math.max(0, motion.steps - sessionStepBaseline) : motion.steps;
                setFitnessTelemetry({ steps, cadence: motion.cadence });
            }
        );
        if (requestId !== cvRequestId) handle.stop();
        else cvHandle = handle;
    } catch (err) {
        if (requestId !== cvRequestId) return;
        joggerStartPending = false;
        cvReady = false;
        console.error('CV failed:', err);
        setModeStatus(`Camera unavailable: ${err.message}`, false, true);
        setControlStatus(`Camera unavailable: ${err.message}`, true);
    }
}

function triggerGameOver() {
    game.state = 'gameover';
    player.crash();

    gsap.fromTo(shake, { x: 0.5, y: 0.35 }, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' });
    gsap.fromTo('#flash', { opacity: 0.55 }, { opacity: 0, duration: 0.45, ease: 'power2.out' });

    const best = getBest();
    const isNewHigh = game.score > best;
    if (isNewHigh) setBest(game.score);
    recordRun({ coins: game.coins, distance: game.distance });

    setTimeout(() => {
        showGameOver(game.score, isNewHigh, {
            coins: game.coins,
            distance: game.distance,
            fitnessActive: Boolean(fitnessSessionId)
        });
        game.canRestart = true;
    }, 750);
}

onMenu(() => {
    void finishFitnessWorkout();
    game.state = 'menu';
    game.canRestart = false;
    player.reset();
    player.setPose('idle');
    resetObstacles(obstacles);
    resetCoins(coins);
    setControlStatus(game.controlMode === 'jogger'
        ? 'Jogger controls selected. Choose Real-Time Jogger to calibrate and start.'
        : 'Keyboard controls: arrows or WASD.', false);
    tweenCamera(CONFIG.camera.menu, 1.0);
});

onCharacterSelect((characterId) => {
    player.setCharacter(characterId);
    setCollectibleCharacter(coins, characterId);
});

addEventListener('keydown', (e) => {
    if (e.key === ' ' && game.controlMode === 'keyboard' && game.state === 'gameover' && game.canRestart) {
        startKeyboardGame();
    }
});

// ---------------- adaptive resolution (keeps i3 / phones smooth) ----------------
let avgDt = 1 / 60, qualityTimer = 0, pixelRatio = renderer.getPixelRatio();
function adaptQuality(dt) {
    avgDt = avgDt * 0.95 + dt * 0.05;
    qualityTimer += dt;
    if (qualityTimer < 1) return;
    qualityTimer = 0;
    let pr = pixelRatio;
    if (avgDt > 0.025 && pr > 0.65) pr = Math.max(0.65, pr - 0.2);
    else if (avgDt < 0.0185 && pr < env.maxPixelRatio) pr = Math.min(env.maxPixelRatio, pr + 0.1);
    if (pr !== pixelRatio) {
        pixelRatio = pr;
        renderer.setPixelRatio(pr);
        env.resize();
    }
}

// ---------------- main loop ----------------
let lastTime = performance.now();
let lastDist = -1;
let fov = camera.fov;

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    adaptQuality(delta);

    if (game.state === 'playing') {
        game.elapsed += delta;

        for (const a of Input.drain()) {
            if (a === 'left') player.moveLeft();
            else if (a === 'right') player.moveRight();
            else if (a === 'jump') player.jump();
            else if (a === 'roll') player.roll();
        }

        player.setRunSpeed(game.speed);
        player.update(delta);
        updateWorld(delta, game.speed);
        game.distance += game.speed * delta;

        game.spawnDist -= game.speed * delta;
        if (game.spawnDist <= 0) {
            spawnWave();
            game.spawnDist = CONFIG.game.spawnGap * (0.8 + Math.random() * 0.5);
        }
        game.coinDist -= game.speed * delta;
        if (game.coinDist <= 0) {
            spawnCoins();
            game.coinDist = 40 + Math.random() * 30;
        }

        updateObstacles(obstacles, delta, game.speed);
        updateCollectibles(coins, delta, game.speed, game.elapsed);

        const pb = player.getBounds();
        if (checkCollision(obstacles, pb)) {
            triggerGameOver();
        } else {
            const got = checkCoinCollision(coins, pb);
            if (got > 0) {
                game.coins += got;
                setCoins(game.coins, true);
                addScore(got * getCoinPoints());
            }
            const passed = recyclePassedObstacles(obstacles);
            if (passed > 0) addScore(passed * CONFIG.game.scorePerObstacle);
        }

        const d = Math.floor(game.distance);
        if (d !== lastDist) { lastDist = d; setDistance(game.distance); }
    } else {
        // menu / countdown / gameover: world stands still, sea + clouds keep moving
        player.update(delta);
        updateWorld(delta, 0);
    }

    // camera: pose tween + gentle lane follow + crash shake + speed FOV
    const follow = (game.state === 'playing' || game.state === 'countdown') ? player.group.position.x * 0.35 : 0;
    followX += (follow - followX) * Math.min(1, delta * 5);
    camera.position.set(cam.px + followX + shake.x, cam.py + shake.y, cam.pz);
    camera.lookAt(cam.lx + followX * 0.5, cam.ly, cam.lz);

    const speedK = game.state === 'playing'
        ? (game.speed - CONFIG.game.baseSpeed) / (CONFIG.game.maxSpeed - CONFIG.game.baseSpeed) : 0;
    const targetFov = env.baseFov() + speedK * 6;
    fov += (targetFov - fov) * Math.min(1, delta * 3);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }

    renderer.render(scene, camera);
}

showStart(startKeyboardGame, startJoggerGame, () => {
    if (game.controlMode === 'jogger') startJoggerGame();
    else startKeyboardGame();
});
player.setPose('idle');
animate();