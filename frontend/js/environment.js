import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
    ZONES,
    zoneAtDistance,
    buildSceneryFor,
    NEAR_SPACING,
    FAR_SPACING
} from './scenery.js';

const SCENERY_START = -140;
const SCENERY_END   = 10;
const SCENERY_SPAN  = SCENERY_END - SCENERY_START;   // 150

const RECYCLE_Z_START = 5;
const FADE_OUT_TIME   = 0.35;

// ---- pool builders -------------------------------------------------------

function createPool(scene, count, sideSign, layer) {
    const slots = [];
    for (let i = 0; i < count; i++) {
        const container = new THREE.Group();
        container.visible = false;
        scene.add(container);
        slots.push({
            container,
            content: null,
            zoneId: null,
            sideSign,
            layer,
            fade: 1,
            fadeDir: 0,
            baseScale: 1,
            groundY: 0
        });
    }
    return slots;
}

function disposeContent(content) {
    if (!content) return;
    content.traverse((obj) => {
        if (obj.isMesh && obj.geometry) obj.geometry.dispose();
    });
}

function applyFade(slot, f) {
    const s = slot.baseScale * (0.2 + 0.8 * f);
    slot.container.scale.set(s, s, s);
    slot.container.position.y = slot.groundY - (1 - f) * 3.5 * slot.baseScale;
}

function placeSceneryAtZone(slot, z, zoneId, instant) {
    if (slot.content) {
        slot.container.remove(slot.content);
        disposeContent(slot.content);
        slot.content = null;
    }

    const visual = buildSceneryFor(zoneId);
    slot.container.add(visual);
    slot.content = visual;
    slot.zoneId = zoneId;

    const zone = ZONES[zoneId];
    const isFar = slot.layer === 'far';
    const xDist  = isFar ? zone.xFar  : zone.xNear;
    const jitter = isFar ? zone.jitterFar : zone.jitterNear;
    const scale  = isFar ? zone.farScale : 1.0;

    slot.baseScale = scale;
    slot.groundY = 0;

    const j = (Math.random() - 0.5) * jitter;
    slot.container.position.set(slot.sideSign * xDist + j, 0, z);
    slot.container.rotation.y = Math.random() * Math.PI * 2;
    slot.container.visible = true;

    if (instant) {
        slot.fade = 1; slot.fadeDir = 0;
        applyFade(slot, 1);
    } else {
        slot.fade = 0; slot.fadeDir = +1;
        applyFade(slot, 0);
    }
}

// ---- environment ---------------------------------------------------------

export function createEnvironment() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.sky);
    scene.fog = new THREE.Fog(CONFIG.colors.sky, 30, 90);

    const camera = new THREE.PerspectiveCamera(
        60, innerWidth / innerHeight, 0.1, 250
    );
    camera.position.set(...CONFIG.camera.position);
    camera.lookAt(...CONFIG.camera.lookAt);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 280),
        new THREE.MeshBasicMaterial({ color: 0x4a8a3a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -90;
    scene.add(ground);

    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 280),
        new THREE.MeshBasicMaterial({ color: 0x2a2a2a })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -90);
    scene.add(road);

    // ---- Lane markings (white strips) ----
    const laneMarkings = [];
    const markGeo = new THREE.PlaneGeometry(0.1, 1.2);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const MARK_SPACING = 3;
    const MARK_START   = SCENERY_START;   // align with scenery span
    const MARK_END     = SCENERY_END;
    const MARK_SPAN    = MARK_END - MARK_START;

    for (const x of [-1, 1]) {
        for (let z = MARK_START; z < MARK_END; z += MARK_SPACING) {
            const mark = new THREE.Mesh(markGeo, markMat);
            mark.rotation.x = -Math.PI / 2;
            mark.position.set(x, 0.02, z);
            scene.add(mark);
            laneMarkings.push(mark);
        }
    }

    // ---- Build 4 layers ----
    const nearCountPerSide = Math.ceil(SCENERY_SPAN / NEAR_SPACING);
    const farCountPerSide  = Math.ceil(SCENERY_SPAN / FAR_SPACING);

    const leftNear  = createPool(scene, nearCountPerSide, -1, 'near');
    const rightNear = createPool(scene, nearCountPerSide, +1, 'near');
    const leftFar   = createPool(scene, farCountPerSide,  -1, 'far');
    const rightFar  = createPool(scene, farCountPerSide,  +1, 'far');

    // ---- Initial fill ----
    let distance = 0;
    const zoneForZ = (z) => zoneAtDistance(distance + (-z));

    function fillRow(row, spacing) {
        let z = SCENERY_START;
        for (const slot of row) {
            placeSceneryAtZone(slot, z, zoneForZ(z), true);
            z += spacing;
        }
    }
    fillRow(leftNear,  NEAR_SPACING);
    fillRow(rightNear, NEAR_SPACING);
    fillRow(leftFar,   FAR_SPACING);
    fillRow(rightFar,  FAR_SPACING);

    // ---- Per-frame ----
    function updateRow(row, delta, speed) {
        const step = speed * delta;
        for (const slot of row) {
            if (!slot.container.visible) continue;
            slot.container.position.z += step;

            if (slot.fadeDir > 0) {
                slot.fade = Math.min(1, slot.fade + delta / FADE_OUT_TIME);
                if (slot.fade >= 1) slot.fadeDir = 0;
                applyFade(slot, slot.fade);
            } else if (slot.fadeDir < 0) {
                slot.fade = Math.max(0, slot.fade - delta / FADE_OUT_TIME);
                if (slot.fade <= 0) {
                    slot.container.position.z -= SCENERY_SPAN;
                    placeSceneryAtZone(
                        slot,
                        slot.container.position.z,
                        zoneForZ(slot.container.position.z),
                        false
                    );
                    continue;
                }
                applyFade(slot, slot.fade);
            }

            if (slot.fadeDir === 0 && slot.container.position.z > RECYCLE_Z_START) {
                slot.fadeDir = -1;
            }

            const wanted = zoneForZ(slot.container.position.z);
            if (slot.zoneId !== wanted && slot.container.position.z < -60) {
                placeSceneryAtZone(slot, slot.container.position.z, wanted, false);
            }
        }
    }

    function updateWorld(delta, speed) {
        distance += speed * delta;

        // --- Marking scroll ---
        const step = speed * delta;
        for (const mark of laneMarkings) {
            mark.position.z += step;
            if (mark.position.z > MARK_END) {
                mark.position.z -= MARK_SPAN;
            }
        }

        updateRow(leftNear,  delta, speed);
        updateRow(rightNear, delta, speed);
        updateRow(leftFar,   delta, speed);
        updateRow(rightFar,  delta, speed);
    }

    let resizePending = false;
    addEventListener('resize', () => {
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(() => {
            resizePending = false;
            camera.aspect = innerWidth / innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(innerWidth, innerHeight);
        });
    });

    return { scene, camera, renderer, updateWorld };
}