import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import { createPlayer } from './player.js';
import { createObstaclePool, spawnObstacle, updateObstacles,
         recyclePassedObstacles, checkCollision } from './obstacles.js';
import { createCoinPool, spawnCoin, updateCollectibles,
         checkCoinCollision, getCoinPoints } from './collectibles.js';
import { Input, attachKeyboard } from './input.js';
import { startCV } from './cv-controller.js';

const { scene, camera, renderer, updateWorld } = createEnvironment();
const player = createPlayer(scene);
const obstacles = createObstaclePool(scene);
const coins = createCoinPool(scene);

const hud = document.getElementById('hud');
const cvBtn = document.getElementById('cv-btn');
const cvDebug = document.getElementById('cv-debug');

const game = {
    score: 0,
    speed: CONFIG.game.baseSpeed,
    spawnTimer: 0,
    coinTimer: 1.5,
    elapsed: 0,
    gameOver: false
};

attachKeyboard();
Input.clear();

addEventListener('keydown', (e) => {
    if (game.gameOver && e.key === ' ') location.reload();
});

let cvHandle = null;
let cvActive = false;

cvBtn.addEventListener('click', async () => {
    if (cvActive) {
        if (cvHandle) cvHandle.stop();
        cvActive = false;
        cvHandle = null;
        cvDebug.style.display = 'none';
        cvBtn.textContent = 'Start Camera';
        return;
    }

    cvBtn.disabled = true;
    cvBtn.textContent = 'Starting camera...';
    try {
        cvHandle = await startCV(
            (action) => Input.push(action),
            (status) => {
                if (status === 'calibrating') {
                    cvBtn.textContent = 'Stand still...';
                } else if (status === 'ready') {
                    cvBtn.textContent = 'Stop Camera';
                    cvBtn.disabled = false;
                }
            }
        );
        cvActive = true;
        cvDebug.style.display = 'block';
    } catch (err) {
        console.error('CV failed:', err);
        cvBtn.textContent = 'Camera failed — retry';
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

let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!game.gameOver) {
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
            const spawnZ = CONFIG.game.spawnZ + 5;  // slightly behind obstacles
            if (laneIsFree(lane, spawnZ)) {
                spawnCoin(coins, lane, spawnZ);
            }
            game.coinTimer = 1.2 + Math.random() * 1.0;
        }
        updateCollectibles(coins, delta, game.speed, game.elapsed);

        // Collisions
        const hit = checkCollision(obstacles, player.getBounds());
        if (hit) {
            game.gameOver = true;
            hud.textContent = `Score: ${game.score}  |  GAME OVER (press Space)`;
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

        if (!game.gameOver) {
            hud.textContent = `Score: ${game.score}`;
        }
    }

    if (cvActive && cvHandle) cvHandle.drawDebugFrame();
    renderer.render(scene, camera);
}

animate();