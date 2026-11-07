import * as THREE from 'three';

const MAT = {
    trunk:      new THREE.MeshBasicMaterial({ color: 0x5a3a1a }),
    pineDark:   new THREE.MeshBasicMaterial({ color: 0x235523 }),
    pineLight:  new THREE.MeshBasicMaterial({ color: 0x2d6a2d }),
    palmTrunk:  new THREE.MeshBasicMaterial({ color: 0x6b4a2a }),
    palmLeaf:   new THREE.MeshBasicMaterial({ color: 0x3a8a3a }),
    bldg1:      new THREE.MeshBasicMaterial({ color: 0xd4b896 }),
    bldg2:      new THREE.MeshBasicMaterial({ color: 0xb85555 }),
    bldg3:      new THREE.MeshBasicMaterial({ color: 0x8a8a8a }),
    bldg4:      new THREE.MeshBasicMaterial({ color: 0xe8d4a8 }),
    window:     new THREE.MeshBasicMaterial({ color: 0x335577 }),
    roofCap:    new THREE.MeshBasicMaterial({ color: 0x3a3a3a }),
    hutWall:    new THREE.MeshBasicMaterial({ color: 0xf0e6d0 }),
    hutRoof:    new THREE.MeshBasicMaterial({ color: 0x8a6030 }),
    lhWhite:    new THREE.MeshBasicMaterial({ color: 0xeeeeee }),
    lhRed:      new THREE.MeshBasicMaterial({ color: 0xcc2222 }),
    lhTop:      new THREE.MeshBasicMaterial({ color: 0x333333 }),
    gopuram1:   new THREE.MeshBasicMaterial({ color: 0xc8704a }),
    gopuram2:   new THREE.MeshBasicMaterial({ color: 0xe0a050 }),
    gopuramGold:new THREE.MeshBasicMaterial({ color: 0xffcc44 }),
    tankBase:   new THREE.MeshBasicMaterial({ color: 0x888888 }),
    tankBody:   new THREE.MeshBasicMaterial({ color: 0x4a7aba }),
    tankTop:    new THREE.MeshBasicMaterial({ color: 0x3a3a3a })
};

export function buildTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), MAT.trunk);
    trunk.position.y = 1.2; g.add(trunk);
    const low = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 7), MAT.pineDark);
    low.position.y = 2.4; g.add(low);
    const mid = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 7), MAT.pineLight);
    mid.position.y = 3.8; g.add(mid);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 7), MAT.pineDark);
    top.position.y = 5.0; g.add(top);
    return g;
}

export function buildPalmTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 5.5, 6), MAT.palmTrunk);
    trunk.position.y = 2.75; g.add(trunk);
    const frondGeo = new THREE.ConeGeometry(0.45, 3.0, 4);
    for (let i = 0; i < 7; i++) {
        const frond = new THREE.Mesh(frondGeo, MAT.palmLeaf);
        const angle = (i / 7) * Math.PI * 2;
        frond.rotation.z = Math.PI / 2.2;
        frond.rotation.y = angle;
        frond.position.set(Math.cos(angle) * 1.1, 5.5, Math.sin(angle) * 1.1);
        g.add(frond);
    }
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), MAT.palmTrunk);
    crown.position.y = 5.5; g.add(crown);
    return g;
}

function buildBuilding(colorKey, stories, width) {
    const g = new THREE.Group();
    const height = stories * 1.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(width * 2.2, height, width * 2.2), MAT[colorKey]);
    body.position.y = height / 2; g.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 2.35, 0.3, width * 2.35), MAT.roofCap);
    cap.position.y = height + 0.15; g.add(cap);
    const winGeo = new THREE.BoxGeometry(0.4, 0.55, 0.05);
    for (let s = 0; s < stories; s++) {
        for (let c = 0; c < 3; c++) {
            const win = new THREE.Mesh(winGeo, MAT.window);
            win.position.set((c - 1) * (width * 0.6), s * 1.4 + 0.75, width * 1.1 + 0.026);
            g.add(win);
        }
    }
    return g;
}

export function buildBuildingVariant() {
    const variants = [
        () => buildBuilding('bldg1', 2, 1.2),
        () => buildBuilding('bldg2', 3, 1.0),
        () => buildBuilding('bldg3', 4, 1.3),
        () => buildBuilding('bldg4', 2, 1.4),
        () => buildBuilding('bldg1', 5, 1.1),
        () => buildBuilding('bldg2', 4, 1.2)
    ];
    return variants[Math.floor(Math.random() * variants.length)]();
}

export function buildBeachHut() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), MAT.hutWall);
    body.position.y = 0.7; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 4), MAT.hutRoof);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.95; g.add(roof);
    return g;
}

export function buildLighthouse() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 8.0, 12), MAT.lhWhite);
    body.position.y = 4.0; g.add(body);
    for (const y of [2.0, 4.0, 6.0]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.4, 12), MAT.lhRed);
        ring.position.y = y; g.add(ring);
    }
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.0, 10), MAT.lhTop);
    lantern.position.y = 8.5; g.add(lantern);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.2, 10), MAT.lhTop);
    top.position.y = 9.6; g.add(top);
    return g;
}

export function buildTempleGopuram() {
    const g = new THREE.Group();
    const tiers = [
        { w: 3.5, h: 1.8, y: 0.9,  mat: MAT.gopuram1 },
        { w: 2.9, h: 1.6, y: 2.6,  mat: MAT.gopuram2 },
        { w: 2.3, h: 1.4, y: 4.1,  mat: MAT.gopuram1 },
        { w: 1.7, h: 1.2, y: 5.4,  mat: MAT.gopuram2 }
    ];
    for (const t of tiers) {
        const tier = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.w * 0.85), t.mat);
        tier.position.y = t.y; g.add(tier);
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 4), MAT.gopuramGold);
    spire.position.y = 6.75; g.add(spire);
    return g;
}

export function buildWaterTank() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.5, 8), MAT.tankBase);
    base.position.y = 1.25; g.add(base);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 14), MAT.tankBody);
    tank.position.y = 3.4; g.add(tank);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 14), MAT.tankTop);
    roof.position.y = 4.65; g.add(roof);
    return g;
}

// ---- Zone specs: TWO rows per side (near + far) ---------------------------
// near = the props you brush past
// far  = a taller, deeper row that hides the sky at the edges of the viewport
export const ZONES = {
    trees: {
        builders: [buildTree, buildTree, buildTree, buildTree],
        xNear: 6.5,  jitterNear: 1.2,
        xFar:  14.0, jitterFar: 2.0, farScale: 2.4
    },
    city: {
        builders: [buildBuildingVariant, buildBuildingVariant, buildBuildingVariant],
        xNear: 9.0,  jitterNear: 2.0,
        xFar:  18.0, jitterFar: 2.5, farScale: 1.9
    },
    landmark: {
        builders: [buildLighthouse, buildTempleGopuram, buildWaterTank],
        xNear: 9.5,  jitterNear: 1.0,
        xFar:  19.0, jitterFar: 1.5, farScale: 1.5
    },
    beach: {
        builders: [buildPalmTree, buildPalmTree, buildBeachHut],
        xNear: 7.0,  jitterNear: 1.5,
        xFar:  15.0, jitterFar: 1.8, farScale: 2.2
    }
};

// World scroll spacings (in world units). NEAR_SPACING must be small enough
// that no gap appears between props along the road; FAR_SPACING can be larger
// because the far row is behind the near row visually.
export const NEAR_SPACING = 4;
export const FAR_SPACING  = 5;

// ---- Zone sequence (based on distance travelled) -------------------------
export const ZONE_ORDER = ['trees', 'city', 'landmark', 'beach'];
export const ZONE_LENGTH = 60;

export function zoneAtDistance(dist) {
    const band = Math.floor(dist / ZONE_LENGTH);
    const idx = ((band % ZONE_ORDER.length) + ZONE_ORDER.length) % ZONE_ORDER.length;
    return ZONE_ORDER[idx];
}

export function buildSceneryFor(zoneId) {
    const zone = ZONES[zoneId];
    return zone.builders[Math.floor(Math.random() * zone.builders.length)]();
}