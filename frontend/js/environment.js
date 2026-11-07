import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ZONES, zoneAtDistance, buildSceneryFor, NEAR_SPACING, FAR_SPACING } from './scenery.js';

const SCENERY_START = -160;
const SCENERY_END   = 10;
const SCENERY_SPAN  = SCENERY_END - SCENERY_START;
const RECYCLE_Z_START = 5;
const FADE_OUT_TIME   = 0.35;

function createPool(scene, count, sideSign, layer) {
    const slots = [];
    for (let i = 0; i < count; i++) {
        const container = new THREE.Group();
        container.visible = false;
        scene.add(container);
        slots.push({ container, content: null, zoneId: null, sideSign, layer, fade: 1, fadeDir: 0, baseScale: 1, groundY: 0 });
    }
    return slots;
}

function disposeContent(content) {
    if (!content) return;
    content.traverse((obj) => { if (obj.isMesh && obj.geometry) obj.geometry.dispose(); });
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
    const baseDist = isFar ? zone.xFar : zone.xNear;
    const jitter = isFar ? zone.jitterFar : zone.jitterNear;
    const scale  = isFar ? zone.farScale : 1.0;

    slot.baseScale = scale;
    slot.groundY = 0;

    const j = (Math.random() - 0.5) * jitter;
    
    // If it's the coastal zone on the right side, push it further out
    // so it sits on the sand next to the ocean.
    let extraX = 0;
    if (zoneId === 'coastal' && slot.sideSign > 0) {
        extraX = isFar ? 6 : 3; 
    }

    slot.container.position.set(slot.sideSign * baseDist + j + extraX, 0, z);
    slot.container.rotation.y = Math.random() * Math.PI * 2;
    slot.container.visible = true;

    if (instant) { slot.fade = 1; slot.fadeDir = 0; applyFade(slot, 1); }
    else { slot.fade = 0; slot.fadeDir = +1; applyFade(slot, 0); }
}

export function createEnvironment() {
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
    camera.position.set(...CONFIG.camera.position);
    camera.lookAt(...CONFIG.camera.lookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // Reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xaaccff);
    scene.environment = pmremGenerator.fromScene(envScene).texture;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xfff0d0, 2.5); 
    sunLight.position.set(20, 40, -50); 
    scene.add(sunLight);

    // Sky
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: {
            topColor: { value: new THREE.Color(0x3a80c0) },
            bottomColor: { value: new THREE.Color(0xffe0c0) },
            offset: { value: 20 }, exponent: { value: 0.6 }
        },
        vertexShader: `varying vec3 vWorldPosition; void main() { vec4 worldPos = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPos.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 topColor, bottomColor; uniform float offset, exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }`
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    const sunGeo = new THREE.CircleGeometry(25, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffdd, transparent: true, opacity: 1.0, fog: false });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(50, 60, -180);
    sun.lookAt(camera.position);
    scene.add(sun);

    // Ground, Beach, Ocean (Always there, but beach zone decorates the sand)
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(100, 300), new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 1.0 }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(-60, 0, -100);
    scene.add(grass);

    const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 300), new THREE.MeshStandardMaterial({ color: 0xe8d8a0, roughness: 0.9 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(25, 0, -100);
    scene.add(sand);

    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(100, 300), new THREE.MeshStandardMaterial({ color: 0x1a6080, metalness: 0.6, roughness: 0.1 }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(80, 0, -100);
    scene.add(ocean);

    // Road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 300), new THREE.MeshStandardMaterial({ color: 0x252525, roughness: 0.8 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -100);
    scene.add(road);

    // Lane Markings
    const laneMarkings = [];
    const markGeo = new THREE.PlaneGeometry(0.15, 2);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const x of [-1, 1]) { 
        for (let z = SCENERY_START; z < SCENERY_END; z += 5) {
            const mark = new THREE.Mesh(markGeo, markMat);
            mark.rotation.x = -Math.PI / 2;
            mark.position.set(x, 0.03, z);
            scene.add(mark);
            laneMarkings.push(mark);
        }
    }

    // Pools
    const nearCount = Math.ceil(SCENERY_SPAN / NEAR_SPACING);
    const farCount  = Math.ceil(SCENERY_SPAN / FAR_SPACING);

    const leftNear  = createPool(scene, nearCount, -1, 'near');
    const rightNear = createPool(scene, nearCount, +1, 'near');
    const leftFar   = createPool(scene, farCount,  -1, 'far');
    const rightFar  = createPool(scene, farCount,  +1, 'far');

    let distance = 0;
    const zoneForZ = (z) => zoneAtDistance(distance + (-z));

    function fillRow(row, spacing) {
        let z = SCENERY_START;
        for (const slot of row) { placeSceneryAtZone(slot, z, zoneForZ(z), true); z += spacing; }
    }
    fillRow(leftNear, NEAR_SPACING); fillRow(rightNear, NEAR_SPACING);
    fillRow(leftFar, FAR_SPACING);   fillRow(rightFar, FAR_SPACING);

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
                    placeSceneryAtZone(slot, slot.container.position.z, zoneForZ(slot.container.position.z), false);
                    continue;
                }
                applyFade(slot, slot.fade);
            }
            if (slot.fadeDir === 0 && slot.container.position.z > RECYCLE_Z_START) slot.fadeDir = -1;

            const wanted = zoneForZ(slot.container.position.z);
            if (slot.zoneId !== wanted && slot.container.position.z < -60) {
                placeSceneryAtZone(slot, slot.container.position.z, wanted, false);
            }
        }
    }

    function updateWorld(delta, speed) {
        distance += speed * delta;
        const step = speed * delta;
        
        // Animate Ocean shimmer slightly
        ocean.position.x = 80 + Math.sin(distance * 0.1) * 0.5;

        for (const mark of laneMarkings) {
            mark.position.z += step;
            if (mark.position.z > SCENERY_END) mark.position.z -= SCENERY_SPAN;
        }
        updateRow(leftNear, delta, speed); updateRow(rightNear, delta, speed);
        updateRow(leftFar, delta, speed);  updateRow(rightFar, delta, speed);
    }

    addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    return { scene, camera, renderer, updateWorld };
}