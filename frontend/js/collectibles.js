import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Builder, toonCoin } from './toon.js';

const POOL_SIZE = 36;
const COIN_Y = 1.05;

// Coin stands upright facing the camera and spins around the VERTICAL (Y) axis.
// Emblem = dumbbell, because this is a fitness game.
function buildCoin() {
    const b = new Builder();
    const GOLD = 0xffc21a, LIGHT = 0xffe27a, DK = 0xc27a0a;
    b.add(new THREE.TorusGeometry(0.36, 0.07, 6, 18), GOLD, 0, 0, 0);
    b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 18), LIGHT, 0, 0, 0, { rx: Math.PI / 2 });
    for (const z of [0.045, -0.045]) {
        b.box(0.34, 0.06, 0.03, DK, 0, 0, z);
        b.box(0.07, 0.26, 0.03, DK, -0.13, 0, z);
        b.box(0.07, 0.26, 0.03, DK, 0.13, 0, z);
    }
    return b.mesh({ material: toonCoin });
}

export function createCoinPool(scene) {
    const proto = buildCoin();
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        const mesh = proto.clone();
        mesh.visible = false;
        scene.add(mesh);
        pool.push({ mesh, active: false, lane: 0, prevZ: 0, spin: 0, phase: 0 });
    }
    return pool;
}

export function spawnCoinTrail(pool, lane, z, count = 5, gap = 2.4) {
    let n = 0;
    for (let i = 0; i < count; i++) {
        const c = pool.find(p => !p.active);
        if (!c) break;
        c.active = true;
        c.lane = lane;
        c.mesh.visible = true;
        c.mesh.position.set(CONFIG.player.laneX[lane], COIN_Y, z - i * gap);
        c.prevZ = c.mesh.position.z;
        c.spin = Math.random() * Math.PI * 2;
        c.phase = i * 0.5;
        n++;
    }
    return n;
}

export function laneHasCoins(pool, lane) {
    return pool.some(c => c.active && c.lane === lane);
}

export function resetCoins(pool) {
    for (const c of pool) { c.active = false; c.mesh.visible = false; c.mesh.position.z = -999; }
}

export function updateCollectibles(pool, delta, scroll, elapsed) {
    for (const c of pool) {
        if (!c.active) continue;
        c.prevZ = c.mesh.position.z;
        c.mesh.position.z += scroll * delta;
        c.spin += delta * 5;
        c.mesh.rotation.y = c.spin;
        c.mesh.position.y = COIN_Y + Math.sin(elapsed * 4 + c.phase) * 0.08;
        if (c.mesh.position.z > CONFIG.game.recycleZ) {
            c.active = false; c.mesh.visible = false; c.mesh.position.z = -999;
        }
    }
}

export function checkCoinCollision(pool, pb) {
    let count = 0;
    for (const c of pool) {
        if (!c.active) continue;
        const z = c.mesh.position.z;
        if (Math.min(z, c.prevZ) - 0.6 > 0 || Math.max(z, c.prevZ) + 0.6 < 0) continue;
        if (Math.abs(pb.x - c.mesh.position.x) > 0.75) continue;
        const y = c.mesh.position.y;
        if (y < pb.bottom - 0.3 || y > pb.top + 0.1) continue;
        c.active = false; c.mesh.visible = false; c.mesh.position.z = -999;
        count++;
    }
    return count;
}

export const getCoinPoints = () => CONFIG.game.coinScore;