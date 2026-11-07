import * as THREE from 'three';
import { CONFIG, METER } from './config.js';
import { OBSTACLE_MODELS, buildRandomObstacle } from './models.js';

export function createObstaclePool(scene) {
    const pool = [];
    for (let i = 0; i < CONFIG.game.poolSize; i++) {
        const slot = { group: new THREE.Group(), content: null, active: false,
                       type: null, y: 0, halfH: 0 };
        slot.group.visible = false;
        scene.add(slot.group);
        pool.push(slot);
    }
    return pool;
}

export function spawnObstacle(pool) {
    const slot = pool.find(o => !o.active);
    if (!slot) return;
    if (slot.content) { slot.group.remove(slot.content); slot.content = null; }

    const lane = Math.floor(Math.random() * CONFIG.player.laneX.length);
    const typeNames = Object.keys(OBSTACLE_MODELS);
    const type = typeNames[Math.floor(Math.random() * typeNames.length)];
    const def = OBSTACLE_MODELS[type];

    const visual = buildRandomObstacle(type);
    slot.group.add(visual);
    slot.content = visual;

    slot.active = true;
    slot.type = type;
    slot.y = def.yMeters * METER + def.halfHMeters * METER;
    slot.halfH = def.halfHMeters * METER;

    slot.group.visible = true;
    slot.group.position.set(CONFIG.player.laneX[lane], 0, CONFIG.game.spawnZ);
    slot.group.rotation.y = 0;
}

export function updateObstacles(pool, delta, gameSpeed) {
    for (const slot of pool) {
        if (!slot.active) continue;
        slot.group.position.z += gameSpeed * delta;
    }
}

export function recyclePassedObstacles(pool) {
    let count = 0;
    for (const slot of pool) {
        if (!slot.active) continue;
        if (slot.group.position.z > CONFIG.game.recycleZ) {
            slot.active = false; slot.group.visible = false;
            slot.group.position.z = -999; count++;
        }
    }
    return count;
}

export function checkCollision(pool, playerBounds) {
    for (const slot of pool) {
        if (!slot.active) continue;
        if (Math.abs(slot.group.position.z) >= CONFIG.game.collideWindow) continue;
        const ox = slot.group.position.x;
        const oy = slot.y;
        const oh = slot.halfH * 2;
        const ow = 0.8;

        if (slot.type === 'gate') {
            const playerTop = playerBounds.y + playerBounds.height / 2;
            const barBottom = oy - slot.halfH;
            if (Math.abs(playerBounds.x - ox) < (playerBounds.width + ow) / 2 &&
                playerTop > barBottom) return slot;
            continue;
        }

        if (Math.abs(playerBounds.x - ox) < (playerBounds.width + ow) / 2 &&
            Math.abs(playerBounds.y - oy) < (playerBounds.height + oh) / 2) {
            return slot;
        }
    }
    return null;
}