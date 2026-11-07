import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import { createPlayer } from './player.js';
import { createObstaclePool, spawnObstacle, updateObstacles,
         recyclePassedObstacles, checkCollision } from './obstacles.js';
import { createCoinPool, spawnCoin, updateCollectibles,
         checkCoinCollision, getCoinPoints } from './collectibles.js';
import { Input, attachKeyboard } from './input.js';
import { startCV } from './cv-controller.js';
import {
    initUI, showStart, showCountdown, showGameOver, hideAllOverlays,
    setScore, setBest, getBest, setCVStatus
} from './menu.js';

const { scene, camera, renderer, updateWorld } = createEnvironment();
const player = createPlayer(scene);
const obstacles = createObstaclePool(scene);
const coins = createCoinPool(scene);

const cvBtn = document.getElementById('cv-btn');
const cvDebug = document.getElementById('cv-debug');

initUI();

const game = {
    score: 0,
    speed: CONFIG.game.baseSpeed,
    spawnTimer: 0,
    coinTimer: 1.5,
    elapsed: 0,
    gameOver: false,
    state: 'menu'        // ADDED: menu | countdown | playing | gameover
};

attachKeyboard();
Input.clear();

// Restart on Space after game over — now goes through beginGame(), not location.reload()
addEventListener('keydown', (e) => {
    if (game.gameOver && e.key === ' ') beginGame();
});

let cvHandle = null;
let cvActive = false;

cvBtn.addEventListener('click', async () => {
    if (cvActive) {
        if (cvHandle) cvHandle.stop();
        cvActive = false;
        cvHandle = null;
        cvDebug.style.display = 'none';
        setCVStatus('off');       // CHANGED: pill label instead of cvBtn.textContent
        return;
    }

    cvBtn.disabled = true;
    setCVStatus('loading');       // CHANGED
    try {
        cvHandle = await startCV(
            (action) => Input.push(action),
            (status) => {
                if (status === 'calibrating') {
                    setCVStatus('calibrating');   // CHANGED
                } else if (status === 'ready') {
                    setCVStatus('ready');          // CHANGED
                    cvBtn.disabled = false;
                }
            }
        );
        cvActive = true;
        cvDebug.style.display = 'block';
    } catch (err) {
        console.error('CV failed:', err);
        setCVStatus('error');     // CHANGED
        cvBtn.disabled = false;
    }
});

// Check if a lane is free of obstacles near a given Z
function laneIsFree(lane, z, window = 3) {
    const x = CONFIG.player.laneX[lane];
    for (const slot of obstacles) {
        if (!slot.active) continue;
        if (Math.abs(slot.group.position.x - x) < 0.6 &&
            Math.abs(slot.group.position.z - z) < window) {
            return false;
        }
    }
    return true;
}

// === ADDED: game lifecycle ===
function beginGame() {
    game.score = 0;
    game.speed = CONFIG.game.baseSpeed;
    game.spawnTimer = 0;
    game.coinTimer = 1.5;
    game.elapsed = 0;
    game.gameOver = false;
    game.state = 'countdown';

    // Reset player
    player.group.position.set(0, CONFIG.player.baseY, 0);
    player.group.scale.y = 1;
    player.state.currentLane = 1;
    player.state.velocityY = 0;
    player.state.isGrounded = true;
    player.state.isRolling = false;
    player.state.rollTimer = 0;

    // Recycle all obstacles + coins
    for (const o of obstacles) {
        o.active = false;
        o.group.visible = false;
        o.group.position.z = -999;
    }
    for (const c of coins) {
        c.active = false;
        c.mesh.visible = false;
        c.mesh.position.z = -999;
    }

    Input.clear();
    setScore(0, false);

    hideAllOverlays();
    showCountdown(3, () => {
        game.state = 'playing';
    });
}

// === ADDED: game-over handler ===
function triggerGameOver() {
    game.gameOver = true;
    game.state = 'gameover';
    const best = getBest();
    const isNewHigh = game.score > best;
    if (isNewHigh) setBest(game.score);
    showGameOver(game.score, isNewHigh);
}

let lastTime = performance.now();
let lastHudScore = -1;

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // CHANGED: was `if (!game.gameOver)`. Same behavior during play,
    // but also freezes during menu/countdown/gameover.
    if (game.state === 'playing') {
        game.elapsed += delta;

        for (const action of Input.drain()) {
            if (action === 'left')  player.moveLeft();
            if (action === 'right') player.moveRight();
            if (action === 'jump')  player.jump();
            if (action === 'roll')  player.roll();
        }

        player.update(delta);
        updateWorld(delta, game.speed);

        // Obstacles
        game.spawnTimer -= delta;
        if (game.spawnTimer <= 0) {
            spawnObstacle(obstacles);
            game.spawnTimer = CONFIG.game.spawnInterval;
        }
        updateObstacles(obstacles, delta, game.speed);

        // Coins — spawn in safe lanes
        game.coinTimer -= delta;
        if (game.coinTimer <= 0) {
            const lane = Math.floor(Math.random() * 3);
            const spawnZ = CONFIG.game.spawnZ + 5;
            if (laneIsFree(lane, spawnZ)) {
                spawnCoin(coins, lane, spawnZ);
            }
            game.coinTimer = 1.2 + Math.random() * 1.0;
        }
        updateCollectibles(coins, delta, game.speed, game.elapsed);

        // Collisions
        const hit = checkCollision(obstacles, player.getBounds());
        if (hit) {
            // CHANGED: was hud.textContent = 'GAME OVER...'
            triggerGameOver();
        }

        const coinHits = checkCoinCollision(coins, player.getBounds());
        if (coinHits > 0) {
            game.score += coinHits * getCoinPoints();
        }

        const passed = recyclePassedObstacles(obstacles);
        if (passed > 0) {
            game.score += passed * CONFIG.game.scorePerObstacle;
            game.speed = Math.min(
                CONFIG.game.maxSpeed,
                CONFIG.game.baseSpeed + game.score * CONFIG.game.speedPerScore
            );
        }

        // CHANGED: was hud.textContent = `Score: ${game.score}` — now styled HUD
        if (!game.gameOver && game.score !== lastHudScore) {
            setScore(game.score, true);
            lastHudScore = game.score;
        }
    } else if (game.state === 'menu' || game.state === 'gameover') {
        // Let the player animation run for a subtle idle effect
        player.update(delta);
    }
    // 'countdown' state: world frozen, nothing updates — matches "no gameplay"

    if (cvActive && cvHandle) cvHandle.drawDebugFrame();
    renderer.render(scene, camera);
}

// === ADDED: boot with start screen ===
showStart(beginGame);
animate();