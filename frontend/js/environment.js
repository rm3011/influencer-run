import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ROWS, ZONE_GROUND, zoneAtDistance, makeScenery } from './scenery.js';

const START_Z = -170, END_Z = 14;
const SHORE_X = 15;
const ROAD_TILE = 12;              // metres of road per texture repeat
const FOG_COLOR = 0xffd6b8;        // matches the sky horizon

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || innerWidth < 700;

function makeRoadTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#4a4b57';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
        const v = (60 + Math.random() * 50) | 0;
        g.fillStyle = `rgba(${v},${v},${v + 8},0.35)`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    g.fillStyle = '#f4f4f4';
    for (const u of [0.0375, 0.9625]) g.fillRect(u * 512 - 4, 0, 8, 512);            // edge lines
    for (const u of [0.3625, 0.6375]) g.fillRect(u * 512 - 4, 0, 8, 200);            // lane dashes
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 360 / ROAD_TILE);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

function makeCloudTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    const blobs = [[70, 78, 46], [118, 60, 54], [170, 76, 44], [100, 86, 40], [150, 88, 36]];
    for (const [x, y, r] of blobs) {
        const grad = g.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.7, 'rgba(255,240,235,0.95)');
        grad.addColorStop(1, 'rgba(255,225,220,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function createEnvironment() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(FOG_COLOR, 55, 185);

    const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, 340);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;       // keeps anime colours punchy
    const maxPR = isMobile ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxPR));
    renderer.setSize(innerWidth, innerHeight);
    document.body.appendChild(renderer.domElement);

    // ----- lights (no shadow maps - fake blob shadows instead) -----
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0xe0b88a, 1.35));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
    sun.position.set(10, 25, 20);
    scene.add(sun);

    // ----- sky dome: blue -> peach horizon, sun low over the sea -----
    const sunDir = new THREE.Vector3(0.55, 0.3, -0.78).normalize();
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(300, 24, 12),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: {
                uTop: { value: new THREE.Color(0x2a74d8) },
                uMid: { value: new THREE.Color(0x72b8ff) },
                uHor: { value: new THREE.Color(0xffd2b0) },
                uSun: { value: sunDir }
            },
            vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `
                uniform vec3 uTop, uMid, uHor, uSun; varying vec3 vDir;
                void main(){
                    vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
                    vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.25, h));
                    col = mix(col, uTop, smoothstep(0.2, 0.8, h));
                    float s = max(dot(d, normalize(uSun)), 0.0);
                    col += vec3(1.0, 0.85, 0.6) * pow(s, 24.0) * 0.55;
                    col = mix(col, vec3(1.0, 0.97, 0.85), smoothstep(0.9975, 0.9988, s));
                    gl_FragColor = vec4(col, 1.0);
                }`
        })
    );
    sky.renderOrder = -1;
    scene.add(sky);

    // ----- drifting clouds -----
    const cloudMat = new THREE.SpriteMaterial({ map: makeCloudTexture(), transparent: true, depthWrite: false, fog: false });
    const clouds = [];
    for (let i = 0; i < 8; i++) {
        const s = new THREE.Sprite(cloudMat);
        s.scale.set(70 + Math.random() * 40, 32 + Math.random() * 16, 1);
        s.position.set(-180 + i * 48 + Math.random() * 20, 45 + Math.random() * 40, -230 - Math.random() * 40);
        scene.add(s);
        clouds.push(s);
    }

    // ----- ground (unlit = cheap, colours stay vivid) -----
    const flat = (w, l, color, x, y, z) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
            new THREE.MeshBasicMaterial({ color }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        scene.add(m);
        return m;
    };
    const CZ = -150, LEN = 360;
    const leftGround = flat(200, LEN, ZONE_GROUND.park, -104.6, 0, CZ);
    flat(1.8, LEN, 0xc9b8a2, -5.5, 0.01, CZ);                 // left pavement
    flat(1.8, LEN, 0xcdbfae, 5.5, 0.01, CZ);                  // promenade
    flat(SHORE_X - 4.6, LEN, 0xf2dca4, (SHORE_X + 4.6) / 2, 0, CZ);   // beach sand
    flat(1.6, LEN, 0xd2b98a, SHORE_X - 0.8, 0.012, CZ);       // wet sand at the waterline

    // kerbs
    const kerbGeo = new THREE.BoxGeometry(0.6, 0.2, LEN);
    const kerbMat = new THREE.MeshBasicMaterial({ color: 0xd9d2c6 });
    for (const x of [-4.3, 4.3]) {
        const k = new THREE.Mesh(kerbGeo, kerbMat);
        k.position.set(x, 0.1, CZ);
        scene.add(k);
    }

    // road: ONE plane, scrolling texture (no per-dash meshes)
    const roadTex = makeRoadTexture();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, LEN), new THREE.MeshBasicMaterial({ map: roadTex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, CZ);
    scene.add(road);

    // ----- sea: animated foam + sparkle, fogged like everything else -----
    const seaUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uScroll: { value: 0 }
    }]);
    const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(210, LEN),
        new THREE.ShaderMaterial({
            uniforms: seaUniforms, fog: true,
            vertexShader: `
                varying vec3 vWorld;
                #include <fog_pars_vertex>
                void main(){
                    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    #include <fog_vertex>
                }`,
            fragmentShader: `
                uniform float uTime, uScroll; varying vec3 vWorld;
                #include <fog_pars_fragment>
                void main(){
                    float d = max(vWorld.x - ${SHORE_X.toFixed(1)}, 0.0);
                    float zz = vWorld.z - uScroll;
                    vec3 shallow = vec3(0.22, 0.80, 0.80);
                    vec3 deep = vec3(0.05, 0.33, 0.68);
                    vec3 col = mix(shallow, deep, smoothstep(0.0, 45.0, d));
                    float f = sin(d * 0.9 - uTime * 1.5 + sin(zz * 0.2) * 1.5);
                    col += vec3(0.55) * smoothstep(0.85, 1.0, f) * (1.0 - smoothstep(0.0, 10.0, d));
                    col += vec3(0.8) * smoothstep(1.2, 0.0, d);
                    col += vec3(0.9, 0.95, 1.0) * pow(max(0.0, sin(vWorld.x * 1.7 + zz * 2.3 + uTime * 3.0)), 40.0) * 0.35;
                    col += 0.04 * sin(zz * 0.35 + uTime * 0.8);
                    gl_FragColor = vec4(col, 1.0);
                    #include <fog_fragment>
                }`
        })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(SHORE_X + 105, -0.05, CZ);
    scene.add(sea);

    // ----- scenery rows (recycled slots, zone chosen at the moment a slot re-enters at the far end) -----
    let distance = 0;
    const rows = ROWS.map(def => {
        const count = Math.ceil((END_Z - START_Z) / def.spacing);
        const row = { ...def, period: count * def.spacing, slots: [] };
        for (let i = 0; i < count; i++) {
            const g = new THREE.Group();
            scene.add(g);
            const slot = { g, z: START_Z + i * def.spacing };
            populate(slot, row);
            row.slots.push(slot);
        }
        return row;
    });

    function populate(slot, row) {
        slot.g.clear();
        const s = makeScenery(row.side, row.layer, zoneAtDistance(distance - slot.z));
        s.obj.rotation.y = s.yaw;
        slot.g.add(s.obj);
        slot.g.position.set(s.x, 0, slot.z);
    }

    // left ground colour follows the zone (look-ahead so it matches what is in view)
    let groundZone = 'park';
    function syncGround() {
        const z = zoneAtDistance(distance + 45);
        if (z === groundZone) return;
        groundZone = z;
        const c = new THREE.Color(ZONE_GROUND[z]);
        const tween = window.gsap && window.gsap.to;
        if (tween) window.gsap.to(leftGround.material.color, { r: c.r, g: c.g, b: c.b, duration: 2.5, ease: 'power1.inOut' });
        else leftGround.material.color.copy(c);
    }

    let time = 0;
    function updateWorld(delta, speed) {
        time += delta;
        distance += speed * delta;
        seaUniforms.uTime.value = time;
        seaUniforms.uScroll.value = distance;
        if (speed > 0) roadTex.offset.y = (roadTex.offset.y + speed * delta / ROAD_TILE) % 1;

        for (const c of clouds) {
            c.position.x += delta * 1.6;
            if (c.position.x > 220) c.position.x = -220;
        }
        if (speed > 0) {
            const step = speed * delta;
            for (const row of rows) {
                for (const slot of row.slots) {
                    slot.z += step;
                    if (slot.z > END_Z) { slot.z -= row.period; populate(slot, row); }
                    else slot.g.position.z = slot.z;
                }
            }
            syncGround();
        }
    }

    const baseFov = () => (innerWidth / innerHeight < 1 ? CONFIG.camera.fovPortrait : CONFIG.camera.fov);

    function resize() {
        camera.aspect = innerWidth / innerHeight;
        camera.fov = baseFov();
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    }
    addEventListener('resize', resize);
    resize();

    return { scene, camera, renderer, updateWorld, resize, baseFov, maxPixelRatio: Math.min(devicePixelRatio, maxPR) };
}