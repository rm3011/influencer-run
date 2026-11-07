import * as THREE from 'three';

const MAT = {
    trunk:      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }),
    pineDark:   new THREE.MeshStandardMaterial({ color: 0x2d6a2d, roughness: 0.8 }),
    pineLight:  new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8 }),
    
    glassBlue:  new THREE.MeshStandardMaterial({ color: 0x4a7a9a, roughness: 0.1, metalness: 0.9 }),
    glassCyan:  new THREE.MeshStandardMaterial({ color: 0x4ac8c8, roughness: 0.1, metalness: 0.9 }),
    concrete:   new THREE.MeshStandardMaterial({ color: 0xd8d0c8, roughness: 0.9 }),
    windowLit:  new THREE.MeshBasicMaterial({ color: 0xffffee }),
    windowOff:  new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.2, metalness: 0.8 }),
    
    palmTrunk:  new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }),
    palmLeaf:   new THREE.MeshStandardMaterial({ color: 0x3a9a3a, roughness: 0.8 }),
};

export function buildTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 8), MAT.trunk);
    trunk.position.y = 1.2; g.add(trunk);
    const createFluff = (radius, y, mat) => {
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), mat);
        m.position.y = y; m.scale.y = 0.8;
        return m;
    };
    g.add(createFluff(1.4, 2.4, MAT.pineDark));
    g.add(createFluff(1.0, 3.4, MAT.pineLight));
    return g;
}

export function buildPalmTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 5.5, 8), MAT.palmTrunk);
    trunk.position.y = 2.75; g.add(trunk);
    const frondGeo = new THREE.ConeGeometry(0.4, 3.2, 4);
    for (let i = 0; i < 8; i++) {
        const frond = new THREE.Mesh(frondGeo, MAT.palmLeaf);
        const angle = (i / 8) * Math.PI * 2;
        frond.rotation.z = Math.PI / 2.5;
        frond.rotation.y = angle;
        frond.position.set(Math.cos(angle) * 1.2, 5.5, Math.sin(angle) * 1.2);
        g.add(frond);
    }
    return g;
}

function buildSkyscraper() {
    const g = new THREE.Group();
    const height = 20 + Math.random() * 15; 
    const width = 3 + Math.random() * 2;
    const mat = Math.random() > 0.5 ? MAT.glassBlue : MAT.glassCyan;
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), mat);
    body.position.y = height / 2; g.add(body);
    const winGeo = new THREE.BoxGeometry(width * 0.8, 0.6, 0.05);
    const rows = Math.floor(height / 1.5);
    for (let s = 0; s < rows; s++) {
        for (let c = -1; c <= 1; c++) {
            const wMat = Math.random() > 0.7 ? MAT.windowLit : MAT.windowOff;
            const win = new THREE.Mesh(winGeo, wMat);
            win.position.set(c * (width * 0.25), s * 1.5 + 1.0, width / 2 + 0.01);
            g.add(win);
        }
    }
    return g;
}

function buildBeachHut() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), MAT.concrete);
    body.position.y = 0.75; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 4), MAT.palmTrunk);
    roof.rotation.y = Math.PI / 4; roof.position.y = 2.1; g.add(roof);
    return g;
}

export const ZONES = {
    trees:   { builders: [buildTree], xNear: 5.0, jitterNear: 1.0, xFar: 12.0, jitterFar: 2.0, farScale: 2.0 },
    city:    { builders: [buildSkyscraper], xNear: 8.0, jitterNear: 2.0, xFar: 15.0, jitterFar: 2.5, farScale: 1.5 },
    // Coastal is pushed out further to sit on the sand (xNear: 10, xFar: 18)
    coastal: { builders: [buildPalmTree, buildBeachHut], xNear: 10.0, jitterNear: 1.5, xFar: 18.0, jitterFar: 1.8, farScale: 1.8 },
};

export const NEAR_SPACING = 6;
export const FAR_SPACING  = 8;
export const ZONE_ORDER = ['trees', 'city', 'coastal'];
export const ZONE_LENGTH = 80;

export function zoneAtDistance(dist) {
    const band = Math.floor(dist / ZONE_LENGTH);
    const idx = ((band % ZONE_ORDER.length) + ZONE_ORDER.length) % ZONE_ORDER.length;
    return ZONE_ORDER[idx];
}

export function buildSceneryFor(zoneId) {
    const zone = ZONES[zoneId];
    return zone.builders[Math.floor(Math.random() * zone.builders.length)]();
}