import * as THREE from 'three';
import { CONFIG } from './config.js';

const COIN_COUNT = 20;
const COIN_RADIUS = 0.22;
const COIN_THICKNESS = 0.06;
const COIN_HEIGHT = 0.5;   // elevated above ground

// Reads the currently-selected character's collectible appearance.
// Falls back to gold coin if character config is missing.
function getCoinAppearance() {
    const charId = CONFIG.currentCharacter || 'soldier';
    const char = CONFIG.characters?.[charId];
    return {
        color: char?.collectibleColor ?? 0xffd700,
        shape: char?.collectibleShape ?? 'coin',
        value: char?.collectibleValue ?? 5
    };
}

export function createCoinPool(scene) {
    const pool = [];
    const appearance = getCoinAppearance();
    const coinGeo = new THREE.TorusGeometry(COIN_RADIUS, COIN_THICKNESS, 8, 16);
    const coinMat = new THREE.MeshBasicMaterial({ color: appearance.color });

    for (let i = 0; i < COIN_COUNT; i++) {
        const mesh = new THREE.Mesh(coinGeo, coinMat);
        // Upright orientation: torus lies in XY plane by default (flat on ground).
        // Rotate 90° on X to stand it up like a spinning ring facing the player.
        mesh.rotation.x = Math.PI / 2;
        mesh.visible = false;
        scene.add(mesh);
        pool.push({
            mesh,
            active: false,
            spin: 0,
            bobPhase: 0
        });
    }
    return pool;
}

export function spawnCoin(pool, lane, z) {
    const slot = pool.find(c => !c.active);
    if (!slot) return false;

    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.set(CONFIG.player.laneX[lane], COIN_HEIGHT, z);
    slot.spin = Math.random() * Math.PI * 2;
    slot.bobPhase = Math.random() * Math.PI * 2;
    return true;
}

export function updateCollectibles(pool, delta, speed, elapsed) {
    for (const slot of pool) {
        if (!slot.active) continue;

        // Move toward player
        slot.mesh.position.z += speed * delta;

        // Spin around Y (vertical axis) — Mario-style spin
        slot.spin += delta * 3;
        slot.mesh.rotation.y = slot.spin;

        // Bob up/down gently around elevated height
        slot.mesh.position.y = COIN_HEIGHT + Math.sin(elapsed * 3 + slot.bobPhase) * 0.08;

        // Recycle past player
        if (slot.mesh.position.z > CONFIG.game.recycleZ) {
            slot.active = false;
            slot.mesh.visible = false;
            slot.mesh.position.z = -999;
        }
    }
}

export function checkCoinCollision(pool, playerBounds) {
    let count = 0;
    for (const slot of pool) {
        if (!slot.active) continue;
        const dx = Math.abs(playerBounds.x - slot.mesh.position.x);
        const dz = Math.abs(slot.mesh.position.z);
        const dy = Math.abs(playerBounds.y - slot.mesh.position.y);
        // Coin is elevated at y=0.5, player base is at y=0.25, top at y=0.75
        // Using playerBounds.y as center of player torso, generous vertical window
        if (dx < 0.6 && dz < 0.6 && dy < 0.7) {
            slot.active = false;
            slot.mesh.visible = false;
            slot.mesh.position.z = -999;
            count++;
        }
    }
    return count;
}

export function getCoinPoints() {
    return getCoinAppearance().value;
}

// Also expose a helper for when you swap characters — updates all coin visuals
export function refreshCoinAppearance(pool) {
    const appearance = getCoinAppearance();
    for (const slot of pool) {
        slot.mesh.material.color.setHex(appearance.color);
    }
}