import * as THREE from 'three';
import { METER } from './config.js';

const m = (v) => v * METER;   // real meters → game units

const MAT = {
    vanBody:    new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }),
    vanWindow:  new THREE.MeshBasicMaterial({ color: 0x335577 }),
    vanWheel:   new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
    busBody:    new THREE.MeshBasicMaterial({ color: 0xf0c419 }),
    busWindow:  new THREE.MeshBasicMaterial({ color: 0x335577 }),
    lorryCab:   new THREE.MeshBasicMaterial({ color: 0xcc3333 }),
    lorryCargo: new THREE.MeshBasicMaterial({ color: 0x888888 }),
    truckBody:  new THREE.MeshBasicMaterial({ color: 0x2d8a3e }),
    schoolBody: new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
    car1:       new THREE.MeshBasicMaterial({ color: 0xdd2222 }),
    car2:       new THREE.MeshBasicMaterial({ color: 0x2255dd }),
    car3:       new THREE.MeshBasicMaterial({ color: 0x222222 }),
    bikeFrame:  new THREE.MeshBasicMaterial({ color: 0x111111 }),
    bikeTire:   new THREE.MeshBasicMaterial({ color: 0x222222 }),
    cycleFrame: new THREE.MeshBasicMaterial({ color: 0x2266cc }),
    cycleTire:  new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
    window:     new THREE.MeshBasicMaterial({ color: 0x335577 }),
    drain:      new THREE.MeshBasicMaterial({ color: 0x444444 }),
    drainHole:  new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
    dung:       new THREE.MeshBasicMaterial({ color: 0x5a3a1a }),
    barricade:  new THREE.MeshBasicMaterial({ color: 0xdd8800 }),
    barStripe:  new THREE.MeshBasicMaterial({ color: 0xffffff })
};

function addWheels(group, widthM, lengthM, wheelRadiusM, yM) {
    const r = m(wheelRadiusM);
    const w = m(0.15);
    const wheelGeo = new THREE.BoxGeometry(w, r * 2, r * 2);
    const xs = [-m(widthM) / 2 + w / 2, m(widthM) / 2 - w / 2];
    const zs = [-m(lengthM) / 2 + r, m(lengthM) / 2 - r];
    for (const x of xs) for (const z of zs) {
        const wheel = new THREE.Mesh(wheelGeo, MAT.vanWheel);
        wheel.position.set(x, m(yM), z);
        group.add(wheel);
    }
}

export function buildVan() {
    const g = new THREE.Group();
    const bodyH = 1.60, cabY = 0.30;
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(1.95), m(bodyH), m(5.20)), MAT.vanBody);
    body.position.y = m(cabY + bodyH / 2); g.add(body);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(m(1.7), m(0.55), m(0.05)), MAT.vanWindow);
    ws.position.set(0, m(cabY + bodyH * 0.7), -m(5.20) / 2 - m(0.03)); g.add(ws);
    addWheels(g, 1.95, 5.20, 0.32, 0.32);
    return g;
}

export function buildBus() {
    const g = new THREE.Group();
    const bodyH = 2.40, floorY = 0.45;
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(2.55), m(bodyH), m(11.0)), MAT.busBody);
    body.position.y = m(floorY + bodyH / 2); g.add(body);
    const win = new THREE.Mesh(new THREE.BoxGeometry(m(2.56), m(0.70), m(10.0)), MAT.busWindow);
    win.position.y = m(floorY + bodyH * 0.72); g.add(win);
    addWheels(g, 2.55, 11.0, 0.50, 0.50);
    return g;
}

export function buildLorry() {
    const g = new THREE.Group();
    const floorY = 0.50;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(m(2.40), m(2.20), m(2.00)), MAT.lorryCab);
    cab.position.set(0, m(floorY + 1.10), -m(3.30)); g.add(cab);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(m(2.50), m(2.80), m(6.50)), MAT.lorryCargo);
    cargo.position.set(0, m(floorY + 1.40), m(0.80)); g.add(cargo);
    const win = new THREE.Mesh(new THREE.BoxGeometry(m(1.8), m(0.6), m(0.05)), MAT.window);
    win.position.set(0, m(floorY + 1.75), -m(3.30) - m(1.0) - m(0.03)); g.add(win);
    addWheels(g, 2.50, 9.00, 0.50, 0.50);
    return g;
}

export function buildTruck() {
    const g = new THREE.Group();
    const floorY = 0.45;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(m(2.30), m(2.10), m(2.20)), MAT.truckBody);
    cab.position.set(0, m(floorY + 1.05), -m(3.80)); g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(m(2.40), m(1.40), m(7.00)), MAT.lorryCargo);
    bed.position.set(0, m(floorY + 0.70), m(1.10)); g.add(bed);
    addWheels(g, 2.40, 10.0, 0.50, 0.50);
    return g;
}

export function buildSchoolVan() {
    const g = new THREE.Group();
    const floorY = 0.30, bodyH = 2.10;
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(2.05), m(bodyH), m(5.50)), MAT.schoolBody);
    body.position.y = m(floorY + bodyH / 2); g.add(body);
    const win = new THREE.Mesh(new THREE.BoxGeometry(m(1.8), m(0.55), m(0.05)), MAT.window);
    win.position.set(0, m(floorY + bodyH * 0.7), -m(5.50) / 2 - m(0.03)); g.add(win);
    addWheels(g, 2.05, 5.50, 0.34, 0.34);
    return g;
}

export function buildCar(matKey = 'car1') {
    const g = new THREE.Group();
    const floorY = 0.28, bodyH = 0.60, cabinH = 0.50;
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(1.80), m(bodyH), m(4.50)), MAT[matKey]);
    body.position.y = m(floorY + bodyH / 2); g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(m(1.60), m(cabinH), m(2.40)), MAT[matKey]);
    cabin.position.set(0, m(floorY + bodyH + cabinH / 2), m(-0.20)); g.add(cabin);
    const win = new THREE.Mesh(new THREE.BoxGeometry(m(1.62), m(cabinH * 0.7), m(2.20)), MAT.window);
    win.position.set(0, m(floorY + bodyH + cabinH / 2), m(-0.20)); g.add(win);
    addWheels(g, 1.80, 4.50, 0.32, 0.32);
    return g;
}

export function buildBike() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(0.40), m(0.55), m(1.30)), MAT.bikeFrame);
    body.position.y = m(0.75); g.add(body);
    const wheelGeo = new THREE.TorusGeometry(m(0.32), m(0.09), 8, 14);
    const wF = new THREE.Mesh(wheelGeo, MAT.bikeTire); wF.rotation.y = Math.PI / 2;
    wF.position.set(0, m(0.32), -m(0.75)); g.add(wF);
    const wB = new THREE.Mesh(wheelGeo, MAT.bikeTire); wB.rotation.y = Math.PI / 2;
    wB.position.set(0, m(0.32), m(0.75)); g.add(wB);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(m(0.75), m(0.06), m(0.06)), MAT.bikeFrame);
    bar.position.set(0, m(1.10), -m(0.70)); g.add(bar);
    return g;
}

export function buildCycle() {
    const g = new THREE.Group();
    const wheelGeo = new THREE.TorusGeometry(m(0.33), m(0.04), 8, 14);
    const wF = new THREE.Mesh(wheelGeo, MAT.cycleTire); wF.rotation.y = Math.PI / 2;
    wF.position.set(0, m(0.33), -m(0.55)); g.add(wF);
    const wB = new THREE.Mesh(wheelGeo, MAT.cycleTire); wB.rotation.y = Math.PI / 2;
    wB.position.set(0, m(0.33), m(0.55)); g.add(wB);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(m(0.10), m(0.55), m(1.10)), MAT.cycleFrame);
    frame.position.y = m(0.55); g.add(frame);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(m(0.55), m(0.05), m(0.05)), MAT.cycleFrame);
    handle.position.set(0, m(1.00), -m(0.55)); g.add(handle);
    return g;
}

export function buildDrainageHole() {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(m(0.8), m(0.05), m(0.8)), MAT.drain);
    plate.position.y = m(0.025); g.add(plate);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(m(0.6), m(0.04), m(0.6)), MAT.drainHole);
    hole.position.y = m(0.06); g.add(hole);
    const barGeo = new THREE.BoxGeometry(m(0.6), m(0.02), m(0.06));
    for (let i = -2; i <= 2; i++) {
        const bar = new THREE.Mesh(barGeo, MAT.drain);
        bar.position.set(0, m(0.08), m(i * 0.12)); g.add(bar);
    }
    return g;
}

export function buildCowDung() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.28), m(0.35), m(0.15), 8), MAT.dung);
    base.position.y = m(0.08); g.add(base);
    const top = new THREE.Mesh(new THREE.SphereGeometry(m(0.20), 8, 6), MAT.dung);
    top.position.y = m(0.20); top.scale.y = 0.6; g.add(top);
    return g;
}

export function buildBarricade() {
    const g = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(m(0.12), m(1.10), m(0.12));
    const l = new THREE.Mesh(postGeo, MAT.barricade); l.position.set(-m(0.55), m(0.55), 0); g.add(l);
    const r = new THREE.Mesh(postGeo, MAT.barricade); r.position.set(m(0.55), m(0.55), 0); g.add(r);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(m(1.25), m(0.30), m(0.12)), MAT.barricade);
    bar.position.set(0, m(0.95), 0); g.add(bar);
    const stripeGeo = new THREE.BoxGeometry(m(0.15), m(0.28), m(0.13));
    for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(stripeGeo, MAT.barStripe);
        stripe.position.set(m(i * 0.24), m(0.95), 0); g.add(stripe);
    }
    return g;
}

// Registry — dimensions in REAL METERS; obstacles.js converts via METER.
export const OBSTACLE_MODELS = {
    tall:  { builders: [buildVan, buildBus, buildLorry, buildTruck, buildSchoolVan],
             yMeters: 0, halfHMeters: 1.60 },
    block: { builders: [() => buildCar('car1'), () => buildCar('car2'), () => buildCar('car3'),
                        buildBike, buildCycle],
             yMeters: 0, halfHMeters: 0.75 },
    flat:  { builders: [buildDrainageHole, buildCowDung],
             yMeters: 0, halfHMeters: 0.10 },
    gate:  { builders: [buildBarricade],
             yMeters: 0, halfHMeters: 0.55 }
};

export function buildRandomObstacle(category) {
    const def = OBSTACLE_MODELS[category];
    const idx = Math.floor(Math.random() * def.builders.length);
    return def.builders[idx]();
}