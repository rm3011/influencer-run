import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import { createPlayer } from './player.js';
import { createObstaclePool, spawnObstacle, updateObstacles, recyclePassedObstacles, checkCollision } from './obstacles.js';

const { scene, camera, renderer } = createEnvironment();
const player = createPlayer(scene);
const obstacles = createObstaclePool(scene);

const hud = document.getElementById('hud');

const game = {
    score: 0,
    speed: CONFIG.game.baseSpeed,
    spawnTimer: 0,
    gameOver: false
};

// ---------- Input ----------
addEventListener('keydown', (e) => {
    if (game.gameOver) {
        if (e.key === ' ') location.reload();
        return;
    }
    if (e.key === 'ArrowLeft')  player.moveLeft();
    if (e.key === 'ArrowRight') player.moveRight();
    if (e.key === 'ArrowUp')    player.jump();
    if (e.key === 'ArrowDown')  player.roll();
});

// ---------- Loop ----------
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (!game.gameOver) {
        player.update(delta);

        // Spawn
        game.spawnTimer -= delta;
        if (game.spawnTimer <= 0) {
            spawnObstacle(obstacles);
            game.spawnTimer = CONFIG.game.spawnInterval;
        }

        // Move obstacles
        updateObstacles(obstacles, delta, game.speed);

        // Collision
        if (checkCollision(obstacles, player.getBounds())) {
            game.gameOver = true;
            hud.textContent = `Score: ${game.score}  |  GAME OVER (press Space)`;
        }

        // Recycle + score
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

    renderer.render(scene, camera);
}

animate();