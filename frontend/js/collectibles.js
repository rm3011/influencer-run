import * as THREE from 'three';
import { CONFIG } from './config.js';

const COIN_COUNT = 20;
const COIN_HEIGHT = 0.5;

function getCoinAppearance() {
    const charId = CONFIG.currentCharacter || 'soldier';
    const char = CONFIG.characters?.[charId];
    return {
        color: char?.collectibleColor ?? 0xffd700, // Classic bright gold
        value: char?.collectibleValue ?? 5
    };
}

export function createCoinPool(scene) {
    const pool = [];
    const appearance = getCoinAppearance();
    
    const coinMat = new THREE.MeshStandardMaterial({ 
        color: appearance.color, 
        metalness: 1.0, 
        roughness: 0.1, // Very shiny
        emissive: appearance.color,
        emissiveIntensity: 0.2
    });

    const ringGeo = new THREE.TorusGeometry(0.22, 0.06, 16, 32);
    const discGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24);
    discGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < COIN_COUNT; i++) {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(ringGeo, coinMat);
        group.add(ring);
        const disc = new THREE.Mesh(discGeo, coinMat);
        group.add(disc);

        group.rotation.x = Math.PI / 2;
        group.visible = false;
        scene.add(group);
        
        pool.push({ mesh: group, active: false, spin: 0, bobPhase: 0 });
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
        
        slot.mesh.position.z += speed * delta;
        slot.spin += delta * 4;
        slot.mesh.rotation.y = slot.spin;
        slot.mesh.position.y = COIN_HEIGHT + Math.sin(elapsed * 4 + slot.bobPhase) * 0.1;

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

export function refreshCoinAppearance(pool) {
    const appearance = getCoinAppearance();
    for (const slot of pool) {
        slot.mesh.traverse((child) => {
            if (child.isMesh) {
                child.material.color.setHex(appearance.color);
                child.material.emissive.setHex(appearance.color);
            }
        });
    }
}