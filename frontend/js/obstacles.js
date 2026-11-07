import * as THREE from 'three';
import { CONFIG } from './config.js';
import { getCatalog, VEH_SCALE } from './models.js';

const LANES = CONFIG.player.laneX;
const WEIGHTS = { tall: 0.2, block: 0.45, flat: 0.2, gate: 0.15 };

const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

export function createObstaclePool(scene) {
    const pool = [];
    for (let i = 0; i < CONFIG.game.poolSize; i++) {
        const group = new THREE.Group();
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.position.y = 0.04;
        group.add(shadow);
        group.visible = false;
        scene.add(group);
        pool.push({
            group, shadow, content: null, wheels: [], active: false, lane: 0,
            speed: 0, halfW: 0.5, halfLen: 1, top: 1, bottom: 0, prevZ: 0, def: null
        });
    }
    return pool;
}

function pickDef() {
    let r = Math.random(), type = 'block';
    for (const [t, w] of Object.entries(WEIGHTS)) { if ((r -= w) <= 0) { type = t; break; } }
    const list = getCatalog().filter(d => d.type === type);
    return list[(Math.random() * list.length) | 0];
}

// A new vehicle must never be able to catch (drive through) an older one in the same lane,
// and must not spawn on top of one.
function laneOk(pool, lane, def) {
    const sz = CONFIG.game.spawnZ;
    for (const o of pool) {
        if (!o.active || o.lane !== lane) continue;
        if (o.group.position.z - o.halfLen < sz + def.halfLen + 9) return false;
        if (def.speed > o.speed && o.group.position.z < -2) return false;
    }
    return true;
}

// Never let all three lanes be filled near the spawn point.
function leavesAPath(pool, lane) {
    let occupied = 0;
    for (let l = 0; l < LANES.length; l++) {
        if (l === lane) continue;
        if (pool.some(o => o.active && o.lane === l &&
            o.group.position.z - o.halfLen < CONFIG.game.spawnZ + 30)) occupied++;
    }
    return occupied < LANES.length - 1;
}

export function trySpawnObstacle(pool, isLaneBlocked) {
    const slot = pool.find(o => !o.active);
    if (!slot) return -1;
    for (let attempt = 0; attempt < 6; attempt++) {
        const lane = (Math.random() * LANES.length) | 0;
        if (isLaneBlocked(lane)) continue;
        const def = pickDef();
        if (!laneOk(pool, lane, def) || !leavesAPath(pool, lane)) continue;
        place(slot, lane, def);
        return lane;
    }
    return -1;
}

function place(slot, lane, def) {
    release(slot);
    slot.lane = lane;
    slot.def = def;
    slot.speed = def.speed;
    slot.halfW = def.halfW;
    slot.halfLen = def.halfLen;
    slot.top = def.top;
    slot.bottom = def.bottom;

    slot.content = def.proto.clone(true);
    slot.group.add(slot.content);
    slot.wheels = [];
    slot.content.traverse(o => { if (o.name === 'wheel') slot.wheels.push(o); });

    slot.shadow.visible = def.type === 'tall' || def.type === 'block';
    slot.shadow.scale.set(def.halfW * 2.4, 1, def.halfLen * 2.1);

    slot.group.rotation.y = def.speed > 0 ? Math.PI : 0;   // oncoming traffic faces the runner
    slot.group.position.set(LANES[lane], 0, CONFIG.game.spawnZ);
    slot.prevZ = CONFIG.game.spawnZ;
    slot.group.visible = true;
    slot.active = true;
}

function release(slot) {
    if (slot.content) { slot.group.remove(slot.content); slot.content = null; }
    slot.wheels = [];
    slot.active = false;
    slot.group.visible = false;
    slot.group.position.z = -999;
}

export function resetObstacles(pool) { for (const s of pool) release(s); }

export function updateObstacles(pool, delta, scroll) {
    for (const s of pool) {
        if (!s.active) continue;
        s.prevZ = s.group.position.z;
        s.group.position.z += (scroll + s.speed) * delta;
        if (s.speed !== 0) {
            for (const w of s.wheels) w.rotation.x -= Math.abs(s.speed) / (w.userData.r * VEH_SCALE) * delta;
        }
    }
}

export function recyclePassedObstacles(pool) {
    let count = 0;
    for (const s of pool) {
        if (s.active && s.group.position.z - s.halfLen > CONFIG.game.recycleZ) { release(s); count++; }
    }
    return count;
}

// AABB test with swept Z so fast oncoming traffic can never tunnel through the player.
export function checkCollision(pool, pb) {
    for (const s of pool) {
        if (!s.active) continue;
        const z = s.group.position.z;
        const reach = s.halfLen + pb.halfD;
        if (Math.min(z, s.prevZ) - reach > 0 || Math.max(z, s.prevZ) + reach < 0) continue;
        if (Math.abs(pb.x - s.group.position.x) >= s.halfW + pb.halfW) continue;
        if (pb.bottom < s.top && pb.top > s.bottom) return s;
    }
    return null;
}