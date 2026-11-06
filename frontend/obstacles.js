import * as THREE from 'three';
import { CONFIG } from './config.js';

// --- Visual builders ---
function buildTall() {
    return new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.0, 0.8),
        new THREE.MeshBasicMaterial({ color: CONFIG.colors.tall })
    );
}

function buildBlock() {
    return new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshBasicMaterial({ color: CONFIG.colors.block })
    );
}

function buildFlat() {
    return new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.15, 0.8),
        new THREE.MeshBasicMaterial({ color: CONFIG.colors.flat })
    );
}

function buildGate() {
    // Gate uses separate geometries per piece -- no stretching, no deformation.
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.gate });

    const postGeo = new THREE.BoxGeometry(0.15, 1.5, 0.15);   // square posts
    const barGeo  = new THREE.BoxGeometry(0.95, 0.4, 0.15);   // top bar

    const left = new THREE.Mesh(postGeo, mat);
    left.position.set(-0.4, 0.75, 0);

    const right = new THREE.Mesh(postGeo, mat);
    right.position.set(0.4, 0.75, 0);

    const top = new THREE.Mesh(barGeo, mat);
    top.position.set(0, 0.5, 0);  // bar at head height of 0.5-tall character

    group.add(left, right, top);
    return group;
}

// --- Obstacle type table ---
const TYPES = {
    tall:  { build: buildTall,  y: 1.0,  halfH: 1.0,  laneChange: true, jump: false, roll: false },
    block: { build: buildBlock, y: 0.4,  halfH: 0.4,  laneChange: true, jump: false, roll: false },
    flat:  { build: buildFlat,  y: 0.075,halfH: 0.075,laneChange: false,jump: true,  roll: false },
    gate:  { build: buildGate,  y: 0.5,  halfH: 0.2,  laneChange: false,jump: false, roll: true  }
};

export function createObstaclePool(scene) {
    const pool = [];

    for (let i = 0; i < CONFIG.game.poolSize; i++) {
        const group = new THREE.Group();
        group.visible = false;
        scene.add(group);

        // Pre-build all 4 types, toggle visibility on spawn.
        const meshes = {
            tall:  buildTall(),
            block: buildBlock(),
            flat:  buildFlat(),
            gate:  buildGate()
        };
        Object.values(meshes).forEach(m => m.visible = false);
        group.add(meshes.tall, meshes.block, meshes.flat, meshes.gate);

        pool.push({
            group,
            meshes,
            active: false,
            type: null,
            y: 0,
            halfH: 0
        });
    }

    return pool;
}

export function spawnObstacle(pool) {
    const slot = pool.find(o => !o.active);
    if (!slot) return;

    const lane = Math.floor(Math.random() * CONFIG.player.laneX.length);
    const typeNames = Object.keys(TYPES);
    const type = typeNames[Math.floor(Math.random() * typeNames.length)];
    const def = TYPES[type];

    // Hide all
    Object.values(slot.meshes).forEach(m => m.visible = false);
    // Show selected
    slot.meshes[type].visible = true;

    slot.active = true;
    slot.type = type;
    slot.y = def.y;
    slot.halfH = def.halfH;
    slot.group.visible = true;
    slot.group.position.set(CONFIG.player.laneX[lane], 0, CONFIG.game.spawnZ);

    // Position the mesh inside the group
    if (type === 'tall')  slot.meshes.tall.position.set(0, 1.0, 0);
    if (type === 'block') slot.meshes.block.position.set(0, 0.4, 0);
    if (type === 'flat')  slot.meshes.flat.position.set(0, 0.075, 0);
    // gate meshes already positioned inside buildGate
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
            slot.active = false;
            slot.group.visible = false;
            slot.group.position.z = -999;
            count++;
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

        // Gate special case: only the top bar collides
        if (slot.type === 'gate') {
            const playerTop = playerBounds.y + playerBounds.height / 2;
            const barBottom = oy - slot.halfH;
            if (Math.abs(playerBounds.x - ox) < (playerBounds.width + ow) / 2 &&
                playerTop > barBottom) {
                return slot;
            }
            continue;
        }

        // Standard AABB
        if (Math.abs(playerBounds.x - ox) < (playerBounds.width + ow) / 2 &&
            Math.abs(playerBounds.y - oy) < (playerBounds.height + oh) / 2) {
            return slot;
        }
    }
    return null;
}