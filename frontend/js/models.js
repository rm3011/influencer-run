import * as THREE from 'three';
import { METER } from './config.js';

const m = (v) => v * METER;

const MAT = {
    // Physical Car Paint (Clearcoat makes it look wet/shiny)
    paintRed:   new THREE.MeshPhysicalMaterial({ color: 0xcc1111, metalness: 0.6, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.1 }),
    paintBlue:  new THREE.MeshPhysicalMaterial({ color: 0x1133aa, metalness: 0.6, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.1 }),
    paintBlack: new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.0 }),
    paintWhite: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.2 }),
    
    // Truck/Bus Heavy Colors
    busYellow:  new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.4, roughness: 0.4 }),
    autoGreen:  new THREE.MeshStandardMaterial({ color: 0x22aa22, metalness: 0.4, roughness: 0.4 }),
    truckOrange:new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.4, roughness: 0.4 }),
    
    // Glass (Dark and Reflective)
    glass:      new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 1.0, roughness: 0.0, transmission: 0.5, opacity: 0.8, transparent: true }),
    
    // Metallic details
    chrome:     new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.0 }),
    rubber:     new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 }),
    
    // Lights
    headlight:  new THREE.MeshBasicMaterial({ color: 0xffffff }),
    taillight:  new THREE.MeshBasicMaterial({ color: 0xff0000 })
};

function createWheel(radius, width) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(m(radius), m(radius), m(width), 32), MAT.rubber);
    tire.rotation.z = Math.PI / 2;
    g.add(tire);
    
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(m(radius*0.7), m(radius*0.7), m(width+0.02), 16), MAT.chrome);
    rim.rotation.z = Math.PI / 2;
    g.add(rim);
    return g;
}

function addWheels(g, widthM, lengthM, radiusM, yM) {
    const xs = [-m(widthM)/2 + m(radiusM), m(widthM)/2 - m(radiusM)];
    const zs = [-m(lengthM)/2 + m(radiusM*1.5), m(lengthM)/2 - m(radiusM*1.5)];
    for (const x of xs) {
        for (const z of zs) {
            const w = createWheel(radiusM, 0.3);
            w.position.set(x, m(yM), z);
            g.add(w);
        }
    }
}

// 1. Realistic Sedan
export function buildCar(paintType = 'paintRed') {
    const g = new THREE.Group();
    const paint = MAT[paintType];
    
    // Chassis (Slightly rounded using scaled cylinders)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(m(1.9), m(0.5), m(4.6)), paint);
    chassis.position.y = m(0.6); g.add(chassis);
    
    // Hood & Trunk curvature
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(m(0.25), m(0.25), m(1.9), 16), paint);
    hood.rotation.z = Math.PI / 2; hood.rotation.x = Math.PI / 2;
    hood.position.set(0, m(0.6), -m(2.1)); g.add(hood);

    // Cabin (Glass)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(m(1.6), m(0.55), m(2.2)), MAT.glass);
    cabin.position.set(0, m(1.1), m(0.2)); g.add(cabin);
    
    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(m(1.55), m(0.05), m(2.1)), paint);
    roof.position.set(0, m(1.35), m(0.2)); g.add(roof);

    // Headlights (Glowing)
    const hlGeo = new THREE.BoxGeometry(m(0.4), m(0.1), m(0.05));
    const hlL = new THREE.Mesh(hlGeo, MAT.headlight);
    hlL.position.set(-m(0.6), m(0.6), -m(2.3)); g.add(hlL);
    const hlR = hlL.clone(); hlR.position.x = m(0.6); g.add(hlR);

    // Taillights (Red)
    const tlL = new THREE.Mesh(hlGeo, MAT.taillight);
    tlL.position.set(-m(0.6), m(0.6), m(2.3)); g.add(tlL);
    const tlR = tlL.clone(); tlR.position.x = m(0.6); g.add(tlR);

    addWheels(g, 1.9, 4.6, 0.33, 0.33);
    return g;
}

// 2. Realistic Auto Rickshaw (Chennai Style)
export function buildAuto() {
    const g = new THREE.Group();
    
    // Lower Green Chassis
    const lower = new THREE.Mesh(new THREE.BoxGeometry(m(1.4), m(0.6), m(2.6)), MAT.autoGreen);
    lower.position.y = m(0.5); g.add(lower);
    
    // Yellow Roof
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(m(0.75), m(0.75), m(2.6), 3), MAT.busYellow);
    roof.rotation.z = Math.PI / 2;
    roof.position.y = m(1.6); g.add(roof);
    
    // Windshield
    const ws = new THREE.Mesh(new THREE.BoxGeometry(m(1.3), m(0.8), m(0.1)), MAT.glass);
    ws.position.set(0, m(1.1), -m(1.2)); g.add(ws);

    addWheels(g, 1.4, 2.6, 0.28, 0.28);
    return g;
}

// 3. Heavy Bus
export function buildBus() {
    const g = new THREE.Group();
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(2.6), m(2.8), m(11)), MAT.busYellow);
    body.position.y = m(1.8); g.add(body);
    
    // Glass Band
    const win = new THREE.Mesh(new THREE.BoxGeometry(m(2.62), m(0.8), m(10.5)), MAT.glass);
    win.position.y = m(2.4); g.add(win);
    
    // Front Windshield
    const ws = new THREE.Mesh(new THREE.BoxGeometry(m(2.5), m(1.2), m(0.1)), MAT.glass);
    ws.position.set(0, m(2.0), -m(5.55)); g.add(ws);

    addWheels(g, 2.6, 11.0, 0.5, 0.5);
    return g;
}

// 4. Semi Truck
export function buildTruck() {
    const g = new THREE.Group();
    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(m(2.4), m(2.4), m(2.4)), MAT.truckOrange);
    cab.position.set(0, m(1.6), -m(3.8)); g.add(cab);
    
    // Cab Glass
    const ws = new THREE.Mesh(new THREE.BoxGeometry(m(2.2), m(0.9), m(0.1)), MAT.glass);
    ws.position.set(0, m(2.1), -m(5.0)); g.add(ws);
    
    // Trailer
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(m(2.5), m(2.8), m(7.0)), MAT.paintWhite);
    trailer.position.set(0, m(1.8), m(1.5)); g.add(trailer);

    addWheels(g, 2.4, 12.0, 0.5, 0.5);
    return g;
}

// 5. School Van
export function buildSchoolVan() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(2.1), m(2.2), m(5.5)), MAT.busYellow);
    body.position.y = m(1.4); g.add(body);
    
    const win = new THREE.Mesh(new THREE.BoxGeometry(m(2.12), m(0.6), m(5.0)), MAT.glass);
    win.position.y = m(1.8); g.add(win);

    addWheels(g, 2.1, 5.5, 0.35, 0.35);
    return g;
}

// 6. Motorcycle
export function buildBike() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(0.4), m(0.4), m(1.6)), MAT.paintBlack);
    body.position.y = m(0.8); g.add(body);
    
    const wF = createWheel(0.35, 0.15); wF.position.set(0, m(0.35), -m(0.8)); g.add(wF);
    const wB = createWheel(0.35, 0.15); wB.position.set(0, m(0.35), m(0.8)); g.add(wB);
    return g;
}

// 7. Bicycle
export function buildCycle() {
    const g = new THREE.Group();
    const wF = createWheel(0.35, 0.05); wF.position.set(0, m(0.35), -m(0.6)); g.add(wF);
    const wB = createWheel(0.35, 0.05); wB.position.set(0, m(0.35), m(0.6)); g.add(wB);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(m(0.05), m(0.6), m(1.1)), MAT.chrome);
    frame.position.y = m(0.6); g.add(frame);
    return g;
}

// 8. Barricade
export function buildBarricade() {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(m(1.5), m(0.4), m(0.2)), MAT.paintWhite);
    bar.position.y = m(1.0); g.add(bar);
    const stripeGeo = new THREE.BoxGeometry(m(0.3), m(0.41), m(0.21));
    for (let i = -2; i <= 2; i++) {
        if (i % 2 !== 0) {
            const stripe = new THREE.Mesh(stripeGeo, MAT.paintRed);
            stripe.position.set(m(i * 0.3), m(1.0), 0); g.add(stripe);
        }
    }
    for (const x of [-m(0.6), m(0.6)]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(m(0.1), m(1.0), m(0.1)), MAT.chrome);
        leg.position.set(x, m(0.5), 0); g.add(leg);
    }
    return g;
}

// 9. Drainage Hole
export function buildDrainageHole() {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(m(1.0), m(0.05), m(1.0)), MAT.paintBlack);
    plate.position.y = m(0.025); g.add(plate);
    return g;
}

// 10. Cow Dung
export function buildCowDung() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.SphereGeometry(m(0.4), 12, 8), MAT.paintBlack);
    base.scale.set(1, 0.4, 1);
    base.position.y = m(0.15); g.add(base);
    return g;
}

export const OBSTACLE_MODELS = {
    tall:  { builders: [buildBus, buildTruck, buildSchoolVan], yMeters: 0, halfHMeters: 1.60 },
    block: { builders: [() => buildCar('paintRed'), () => buildCar('paintBlue'), () => buildCar('paintBlack'), buildAuto, buildBike, buildCycle], yMeters: 0, halfHMeters: 0.75 },
    flat:  { builders: [buildDrainageHole, buildCowDung], yMeters: 0, halfHMeters: 0.10 },
    gate:  { builders: [buildBarricade], yMeters: 0, halfHMeters: 0.55 }
};

export function buildRandomObstacle(category) {
    const def = OBSTACLE_MODELS[category];
    return def.builders[Math.floor(Math.random() * def.builders.length)]();
}