import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import { createPlayer } from './player.js';
import { createObstaclePool, trySpawnObstacle, updateObstacles, recyclePassedObstacles,
         checkCollision, resetObstacles } from './obstacles.js';
import { createCoinPool, spawnCoinTrail, laneHasCoins, resetCoins, updateCollectibles,
         checkCoinCollision, getCoinPoints, setCollectibleCharacter } from './collectibles.js';
import { Input, attachKeyboard, attachTouch } from './input.js';
import { startCV } from './cv-controller.js';
import {
    initUI, showStart, showCountdown, showGameOver, hideAllOverlays, onMenu, onCharacterSelect,
    setScore, setCoins, setDistance, setBest, getBest, setModeStatus, setControlStatus, recordRun
} from './menu.js';

const env = createEnvironment();
const { scene, camera, renderer, updateWorld } = env;
const player = createPlayer(scene);
const obstacles = createObstaclePool(scene);
const coins = createCoinPool(scene);

initUI();

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
let controlStatusTimer = null;

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
        game.state = 'playing';
        player.setPose('run');
    });
}

function startKeyboardGame() {
    game.controlMode = 'keyboard';
    cvReady = false;
    if (cvHandle) {
        cvHandle.stop();
        cvHandle = null;
    }
    setModeStatus('Keyboard controls selected.', false);
    setControlStatus('Keyboard controls: arrows or WASD.');
    beginGame();
}

async function startJoggerGame() {
    game.controlMode = 'jogger';
    if (cvReady) {
        setModeStatus('Real-time jogger controls ready.', false);
        setControlStatus('Jogger controls active: lean, raise head to jump, lower to roll.');
        beginGame();
        return;
    }

    if (cvHandle) {
        cvHandle.stop();
        cvHandle = null;
    }
    joggerStartPending = true;
    setModeStatus('Starting camera. Allow access, face the screen, and stand still to calibrate.', true);
    try {
        cvHandle = await startCV(
            (action) => {
                if (game.controlMode !== 'jogger') return;
                Input.push(action);
                const labels = { left: 'left', right: 'right', jump: 'jump', roll: 'roll' };
                setControlStatus(`Jogger detected: ${labels[action]}.`);
                clearTimeout(controlStatusTimer);
                controlStatusTimer = setTimeout(() => {
                    if (game.controlMode === 'jogger') {
                        setControlStatus('Jogger controls active: lean, raise head to jump, lower to roll.');
                    }
                }, 900);
            },
            (status) => {
                if (status === 'loading') {
                    setModeStatus('Loading real-time pose tracking...', true);
                } else if (status === 'calibrating') {
                    setModeStatus('Camera ready. Stand centered and look at the screen to calibrate.', true);
                    setControlStatus('Camera connected. Stand centered to calibrate.');
                } else if (status === 'finding') {
                    setControlStatus('Face not visible. Face the camera; jogger controls are paused.', true);
                    if (!cvReady) setModeStatus('Looking for your face. Face the camera and move into view.', false);
                } else if (status === 'tracking') {
                    setControlStatus('Jogger controls active: lean, raise head to jump, lower to roll.');
                } else if (status === 'ready') {
                    cvReady = true;
                    setModeStatus('Jogger controls ready. Starting your run...', false);
                    setControlStatus('Jogger controls active: lean, raise head to jump, lower to roll.');
                    if (joggerStartPending) beginGame();
                } else if (status === 'error') {
                    cvReady = false;
                    joggerStartPending = false;
                    setModeStatus('Camera tracking stopped. Choose a control mode to try again.', false, true);
                    setControlStatus('Camera tracking stopped. Choose keyboard or retry jogger mode.', true);
                }
            }
        );
    } catch (err) {
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
        showGameOver(game.score, isNewHigh, { coins: game.coins, distance: game.distance });
        game.canRestart = true;
    }, 750);
}

onMenu(() => {
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