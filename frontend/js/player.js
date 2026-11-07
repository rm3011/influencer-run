import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { TOON_GRADIENT } from './toon.js';

// Screen-space ink outline for skinned meshes (constant thickness regardless of model scale).
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1026, side: THREE.BackSide });
outlineMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vec3 vn = normalize( normalMatrix * objectNormal );
         gl_Position.xy += normalize( ( projectionMatrix * vec4( vn, 0.0 ) ).xy ) * 0.0045 * gl_Position.w;`
    );
};

export function createPlayer(scene) {
    const P = CONFIG.player;

    const group = new THREE.Group();              // feet at group.position.y
    scene.add(group);
    const pivot = new THREE.Group();              // rotates/squashes around the body centre (roll flip)
    pivot.position.y = P.height / 2;
    group.add(pivot);
    const holder = new THREE.Group();
    holder.position.y = -P.height / 2;
    holder.rotation.y = P.modelYaw;
    pivot.add(holder);

    // blob shadow stays on the ground while jumping
    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.position.y = 0.05;
    scene.add(shadow);

    let mixer = null;
    const actions = {};
    let current = null;

    function play(name, fade = 0.2) {
        const next = actions[name];
        if (!next || next === current) return;
        next.reset().play();
        if (current) current.crossFadeTo(next, fade, false);
        current = next;
    }

    const modelPath = CONFIG.characters[CONFIG.currentCharacter].model;
    new GLTFLoader().load(modelPath, (gltf) => {
        const model = gltf.scene;

        // normalise size, put feet on the origin
        const size = new THREE.Vector3();
        new THREE.Box3().setFromObject(model).getSize(size);
        model.scale.setScalar(P.height / size.y);
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(-center.x, -box.min.y, -center.z);
        holder.add(model);

        // toon materials + ink outline
        const skinned = [];
        model.traverse((o) => {
            if (!o.isMesh) return;
            o.frustumCulled = false;
            const old = Array.isArray(o.material) ? o.material : [o.material];
            const mats = old.map(m => new THREE.MeshToonMaterial({
                color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, gradientMap: TOON_GRADIENT
            }));
            o.material = Array.isArray(o.material) ? mats : mats[0];
            if (o.isSkinnedMesh) skinned.push(o);
        });
        for (const o of skinned) {
            const ol = new THREE.SkinnedMesh(o.geometry, outlineMat);
            ol.bind(o.skeleton, o.bindMatrix);
            ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
            ol.frustumCulled = false;
            o.parent.add(ol);
        }

        mixer = new THREE.AnimationMixer(model);
        const anims = gltf.animations;
        actions.idle = mixer.clipAction(anims.find(a => a.name === 'Idle') || anims[0]);
        actions.run = mixer.clipAction(anims.find(a => a.name === 'Run') || anims[1] || anims[0]);
        play(state.pose);
    }, undefined, (err) => {
        console.warn('[player] model failed to load - using fallback capsule', err);
        const radius = P.height * 0.2;
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(radius, P.height - radius * 2, 4, 8),
            new THREE.MeshToonMaterial({ color: 0xff7a3d, gradientMap: TOON_GRADIENT }));
        f.position.y = P.height / 2;
        holder.add(f);
    });

    const state = {
        currentLane: 1, velocityY: 0, isGrounded: true,
        isRolling: false, rollTimer: 0, dead: false, pose: 'idle'
    };
    let rollK = 0;

    const moveLeft = () => { if (!state.dead && state.currentLane > 0) state.currentLane--; };
    const moveRight = () => { if (!state.dead && state.currentLane < P.laneX.length - 1) state.currentLane++; };
    function jump() {
        if (state.dead || !state.isGrounded || state.isRolling) return;
        state.velocityY = P.jumpVelocity;
        state.isGrounded = false;
    }
    function roll() {
        if (state.dead || state.isRolling) return;
        state.isRolling = true;
        state.rollTimer = P.rollDuration;
        if (!state.isGrounded) state.velocityY = Math.min(state.velocityY, -14);   // fast-fall into the roll
    }

    function setPose(name) { state.pose = name; play(name); }
    function setRunSpeed(speed) { if (actions.run) actions.run.timeScale = THREE.MathUtils.clamp(speed / 12, 0.8, 1.8); }

    function update(delta) {
        const targetX = P.laneX[state.currentLane];
        const k = 1 - Math.exp(-P.laneLerp * delta);
        const dx = targetX - group.position.x;
        group.position.x += dx * k;

        if (!state.isGrounded) {
            state.velocityY -= P.gravity * delta;
            group.position.y += state.velocityY * delta;
            if (group.position.y <= 0) {
                group.position.y = 0; state.velocityY = 0; state.isGrounded = true;
            }
        }

        if (state.isRolling) {
            state.rollTimer -= delta;
            if (state.rollTimer <= 0) state.isRolling = false;
        }

        if (!state.dead) {
            rollK += ((state.isRolling ? 1 : 0) - rollK) * Math.min(1, delta * 18);
            const s = 1 - (1 - P.rollScale) * rollK;
            pivot.scale.setScalar(s);
            pivot.position.y = (P.height / 2) * s;
            pivot.rotation.x = state.isRolling ? -(1 - state.rollTimer / P.rollDuration) * Math.PI * 2 : 0;
            pivot.rotation.z = THREE.MathUtils.clamp(-dx * 0.12, -0.35, 0.35);   // lean into lane changes
        }

        shadow.position.x = group.position.x;
        const h = Math.max(0, group.position.y);
        shadow.scale.setScalar(Math.max(0.4, 1 - h * 0.25));
        shadow.material.opacity = 0.32 * Math.max(0.3, 1 - h * 0.3);

        if (mixer) mixer.update(delta);
    }

    function crash() {
        state.dead = true;
        if (actions.run) actions.run.timeScale = 0;
        if (window.gsap) {
            gsap.to(pivot.rotation, { x: 1.35, z: 0, duration: 0.35, ease: 'power2.in' });
            gsap.to(pivot.position, { y: 0.35, duration: 0.35, ease: 'power2.in' });
        }
    }

    function reset() {
        if (window.gsap) gsap.killTweensOf([pivot.rotation, pivot.position]);
        group.position.set(0, 0, 0);
        pivot.rotation.set(0, 0, 0);
        pivot.scale.setScalar(1);
        pivot.position.y = P.height / 2;
        rollK = 0;
        Object.assign(state, { currentLane: 1, velocityY: 0, isGrounded: true, isRolling: false, rollTimer: 0, dead: false });
        if (actions.run) actions.run.timeScale = 1;
    }

    function getBounds() {
        return {
            x: group.position.x,
            bottom: group.position.y,
            top: group.position.y + (state.isRolling ? P.rollHeight : P.height),
            halfW: P.width / 2,
            halfD: P.depth / 2
        };
    }

    return { group, state, moveLeft, moveRight, jump, roll, update, getBounds, setPose, setRunSpeed, crash, reset };
}