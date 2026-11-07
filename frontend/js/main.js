import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import { createPlayer } from './player.js';
import { createObstaclePool, spawnObstacle, updateObstacles,
         recyclePassedObstacles, checkCollision } from './obstacles.js';
import { Input, attachKeyboard } from './input.js';
import { startCV } from './cv-controller.js';

const { scene, camera, renderer } = createEnvironment();
const player = createPlayer(scene);
const obstacles = createObstaclePool(scene);

const hud = document.getElementById('hud');
const cvBtn = document.getElementById('cv-btn');
const cvDebug = document.getElementById('cv-debug');

const game = {
    score: 0,
    speed: CONFIG.game.baseSpeed,
    spawnTimer: 0,
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

let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!game.gameOver) {
        for (const action of Input.drain()) {
            if (action === 'left')  player.moveLeft();
            if (action === 'right') player.moveRight();
            if (action === 'jump')  player.jump();
            if (action === 'roll')  player.roll();
        }

        player.update(delta);

        game.spawnTimer -= delta;
        if (game.spawnTimer <= 0) {
            spawnObstacle(obstacles);
            game.spawnTimer = CONFIG.game.spawnInterval;
        }

        updateObstacles(obstacles, delta, game.speed);

        const hit = checkCollision(obstacles, player.getBounds());
        if (hit) {
            game.gameOver = true;
            hud.textContent = `Score: ${game.score}  |  GAME OVER (press Space)`;
        }

        const passed = recyclePassedObstacles(obstacles);
        if (passed > 0) {
            game.score += passed * CONFIG.game.scorePerObstacle;
            game.speed = Math.min(
                CONFIG.game.maxSpeed,
                CONFIG.game.baseSpeed + game.score * CONFIG.game.speedPerScore
            );
            hud.textContent = `Score: ${game.score}`;
        }
    }

    // CV debug draw — synchronized with game frame, no separate rAF
    if (cvActive && cvHandle) cvHandle.drawDebugFrame();

    renderer.render(scene, camera);
}

animate();