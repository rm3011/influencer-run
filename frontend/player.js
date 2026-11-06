import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

export function createPlayer(scene) {
    const player = new THREE.Group();
    player.position.set(0, CONFIG.player.baseY, 0);
    scene.add(player);

    let mixer = null;
    const actions = {};

    new GLTFLoader().load('./models/Soldier.glb', (gltf) => {
        const model = gltf.scene;
        player.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        model.scale.setScalar(CONFIG.player.height / size.y);

        const box2 = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box2.getCenter(center);
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= box2.min.y;

        mixer = new THREE.AnimationMixer(model);
        const anims = gltf.animations;
        actions.idle = mixer.clipAction(anims.find(a => a.name === 'Idle') || anims[0]);
        actions.run  = mixer.clipAction(anims.find(a => a.name === 'Run')  || anims[1] || anims[0]);
        actions.run.play();
    });

    const state = {
        currentLane: 1,
        velocityY: 0,
        isGrounded: true,
        isRolling: false,
        rollTimer: 0
    };

    function moveLeft() {
        if (state.currentLane > 0) state.currentLane--;
    }

    function moveRight() {
        if (state.currentLane < CONFIG.player.laneX.length - 1) state.currentLane++;
    }

    function jump() {
        if (!state.isGrounded || state.isRolling) return;
        state.velocityY = CONFIG.player.jumpVelocity;
        state.isGrounded = false;
    }

    function roll() {
        if (!state.isGrounded || state.isRolling) return;
        state.isRolling = true;
        state.rollTimer = CONFIG.player.rollDuration;
        player.scale.y = CONFIG.player.rollScale;
        player.position.y = CONFIG.player.baseY * CONFIG.player.rollScale;
    }

    function update(delta) {
        // Lane lerp
        const targetX = CONFIG.player.laneX[state.currentLane];
        player.position.x += (targetX - player.position.x) * CONFIG.player.laneLerp;

        // Jump physics
        if (!state.isGrounded) {
            state.velocityY -= CONFIG.player.gravity * delta;
            player.position.y += state.velocityY * delta;
            if (player.position.y <= CONFIG.player.baseY) {
                player.position.y = CONFIG.player.baseY;
                state.velocityY = 0;
                state.isGrounded = true;
            }
        }

        // Roll timer
        if (state.isRolling) {
            state.rollTimer -= delta;
            if (state.rollTimer <= 0) {
                state.isRolling = false;
                player.scale.y = 1;
                player.position.y = CONFIG.player.baseY;
            }
        }

        if (mixer) mixer.update(delta);
    }

    function getBounds() {
        return {
            x: player.position.x,
            y: player.position.y,
            height: player.scale.y * CONFIG.player.height,
            width: CONFIG.player.width * player.scale.x
        };
    }

    return { group: player, state, moveLeft, moveRight, jump, roll, update, getBounds };
}