import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createEnvironment() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.sky);

    const camera = new THREE.PerspectiveCamera(
        60, innerWidth / innerHeight, 0.1, 100
    );
    camera.position.set(...CONFIG.camera.position);
    camera.lookAt(...CONFIG.camera.lookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(1);
    document.body.appendChild(renderer.domElement);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 200),
        new THREE.MeshBasicMaterial({ color: CONFIG.colors.ground })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -90;
    scene.add(ground);

    addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    return { scene, camera, renderer };
}