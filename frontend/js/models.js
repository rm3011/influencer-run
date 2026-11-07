import * as THREE from 'three';
import { Builder, makeWheel, pick } from './toon.js';

/*
 * Chennai traffic. Front of every model faces -Z.
 * `speed` = the vehicle's own ground speed relative to the road:
 *    > 0  oncoming (rotated to face the player, drives toward you)
 *    < 0  same direction as the runner (drives away, slower than you)
 *    = 0  static (cow, barricade, hazards)
 * Obstacles move at (scrollSpeed + speed) in obstacles.js, and wheels spin from |speed|.
 */

export const VEH_SCALE = 0.9;
const GLASS = 0x1a2a40, DARK = 0x16161c, HEAD = 0xfff4c8, TAIL = 0xff2a2a;
const SKIN = [0xc98b5e, 0xa66a42, 0xe0a97a];

function assemble(body, wheels) {
    const g = new THREE.Group();
    g.add(body);
    for (const [x, y, z, r, w] of wheels) {
        const wh = makeWheel(r, w);
        wh.position.set(x, y, z);
        g.add(wh);
    }
    g.scale.setScalar(VEH_SCALE);
    return g;
}

function rider(b, shirt, y, z, lean = -0.25) {
    b.box(0.42, 0.6, 0.28, shirt, 0, y, z, { rx: lean });
    b.sph(0.15, pick(SKIN), 0, y + 0.55, z - 0.1);
    b.sph(0.17, pick([0xe63946, 0x1c1c20, 0xffd23d]), 0, y + 0.6, z - 0.1, { sy: 0.8 });
    for (const sx of [-0.2, 0.2]) b.box(0.14, 0.55, 0.18, 0x2a3550, sx, y - 0.4, z + 0.05, { rx: -0.9 });
}

// ---------- cars ----------
function car(color, roof = color) {
    const b = new Builder();
    b.box(1.75, 0.55, 4.0, color, 0, 0.62, 0);
    b.box(1.7, 0.16, 1.0, color, 0, 0.9, -1.45, { rx: 0.1 });
    b.box(1.55, 0.52, 2.0, color, 0, 1.17, 0.25);
    b.box(1.58, 0.34, 1.6, GLASS, 0, 1.19, 0.25);
    b.box(1.35, 0.36, 0.06, GLASS, 0, 1.17, -0.78, { rx: -0.3 });
    b.box(1.35, 0.34, 0.06, GLASS, 0, 1.19, 1.28);
    b.box(1.58, 0.07, 2.02, roof, 0, 1.46, 0.25);
    b.box(1.8, 0.16, 0.16, DARK, 0, 0.4, -2.02);
    b.box(1.8, 0.16, 0.16, DARK, 0, 0.4, 2.02);
    for (const x of [-0.6, 0.6]) {
        b.box(0.4, 0.12, 0.06, HEAD, x, 0.72, -2.02);
        b.box(0.4, 0.1, 0.06, TAIL, x, 0.74, 2.02);
    }
    const wy = 0.32, wx = 0.82, wz = 1.3;
    return assemble(b.mesh({ outline: true }), [
        [-wx, wy, -wz, 0.32, 0.24], [wx, wy, -wz, 0.32, 0.24],
        [-wx, wy, wz, 0.32, 0.24], [wx, wy, wz, 0.32, 0.24]
    ]);
}

// Chennai auto-rickshaw: black body, yellow top
function auto() {
    const b = new Builder();
    const Y = 0xffc61a, K = 0x1b1b20;
    b.box(1.3, 0.5, 2.3, K, 0, 0.6, 0.3);
    b.box(0.9, 0.7, 0.8, Y, 0, 0.95, -1.15);
    b.box(0.5, 0.08, 0.7, K, 0, 0.45, -1.2);
    b.box(0.2, 0.14, 0.06, HEAD, 0, 1.0, -1.56);
    b.box(1.2, 0.7, 0.05, GLASS, 0, 1.55, -0.55, { rx: -0.2 });
    for (const x of [-0.62, 0.62]) {
        b.box(0.06, 1.1, 0.06, K, x, 1.4, -0.5);
        b.box(0.06, 1.1, 0.06, K, x, 1.4, 1.1);
    }
    b.box(1.45, 0.08, 2.0, Y, 0, 1.97, 0.3);
    b.box(1.1, 0.25, 0.6, 0xb02a2a, 0, 0.95, 0.75);
    b.box(1.1, 0.5, 0.12, 0xb02a2a, 0, 1.25, 1.05);
    b.box(1.3, 0.9, 0.06, K, 0, 1.1, 1.45);
    rider(b, 0x7fa6d8, 1.2, -0.3, -0.05);
    return assemble(b.mesh({ outline: true }), [
        [0, 0.28, -1.2, 0.28, 0.14], [-0.7, 0.28, 0.85, 0.28, 0.16], [0.7, 0.28, 0.85, 0.28, 0.16]
    ]);
}

function bike() {
    const b = new Builder();
    const C = pick([0xd02828, 0x2a5bd0, 0x1c1c20]);
    b.box(0.28, 0.3, 1.2, C, 0, 0.62, 0);
    b.box(0.3, 0.16, 0.5, DARK, 0, 0.84, 0.35);
    b.cyl(0.03, 0.03, 0.7, 6, 0xaaaaaa, 0, 0.8, -0.62, { rx: 0.35 });
    b.box(0.7, 0.04, 0.04, DARK, 0, 1.12, -0.7);
    b.box(0.16, 0.14, 0.08, HEAD, 0, 1.0, -0.78);
    b.box(0.12, 0.06, 0.04, TAIL, 0, 0.8, 0.95);
    rider(b, pick([0xff7a3d, 0x3dd0a0, 0xffd23d, 0xe040a0]), 1.3, 0.3);
    for (const sx of [-0.25, 0.25]) b.box(0.1, 0.5, 0.1, 0xc98b5e, sx, 1.3, -0.2, { rx: 1.1 });
    return assemble(b.mesh({ outline: true }), [[0, 0.33, -0.75, 0.33, 0.12], [0, 0.33, 0.78, 0.33, 0.14]]);
}

function cycle() {   // milk-vendor cycle
    const b = new Builder();
    b.box(0.05, 0.05, 1.0, 0xd04030, 0, 0.78, 0);
    b.box(0.05, 0.5, 0.05, 0xd04030, 0, 0.55, 0.45);
    b.box(0.6, 0.04, 0.04, DARK, 0, 1.1, -0.55);
    b.box(0.14, 0.05, 0.3, DARK, 0, 0.95, 0.35);
    rider(b, 0xf2f2f2, 1.3, 0.3, -0.2);
    for (const sx of [-0.3, 0.3]) b.cyl(0.14, 0.14, 0.5, 8, 0xcfd4dc, sx, 0.75, 0.8);
    return assemble(b.mesh({ outline: true }), [[0, 0.34, -0.55, 0.34, 0.05], [0, 0.34, 0.55, 0.34, 0.05]]);
}

// ---------- heavy ----------
function bus() {   // city bus
    const b = new Builder();
    const BLU = 0x2468d8, WHT = 0xf4f6fb, RED = 0xe03030;
    b.box(2.5, 1.5, 10.4, BLU, 0, 1.45, 0);
    b.box(2.5, 1.4, 10.4, WHT, 0, 2.9, 0);
    b.box(2.52, 0.14, 10.4, RED, 0, 2.2, 0);
    b.box(2.54, 0.75, 9.2, GLASS, 0, 2.85, 0.4);
    b.box(2.2, 1.2, 0.06, GLASS, 0, 2.75, -5.22);
    b.box(1.6, 0.28, 0.06, 0xffa020, 0, 3.4, -5.22);
    b.box(2.5, 0.12, 10.4, 0xdfe3ea, 0, 3.62, 0);
    b.box(2.56, 0.3, 0.2, DARK, 0, 0.65, -5.2);
    b.box(2.56, 0.3, 0.2, DARK, 0, 0.65, 5.2);
    for (const x of [-0.85, 0.85]) { b.box(0.35, 0.18, 0.06, HEAD, x, 1.0, -5.22); b.box(0.3, 0.18, 0.06, TAIL, x, 1.0, 5.22); }
    const w = [];
    for (const x of [-1.2, 1.2]) for (const z of [-3.4, 3.0]) w.push([x, 0.5, z, 0.5, 0.38]);
    return assemble(b.mesh({ outline: true }), w);
}

function truck() {   // Indian lorry with colourful body art
    const b = new Builder();
    b.box(2.4, 2.2, 2.0, 0xff7a1a, 0, 1.75, -3.9);
    b.box(2.2, 0.85, 0.06, GLASS, 0, 2.4, -4.91);
    b.box(2.0, 0.6, 0.06, DARK, 0, 1.2, -4.92);
    b.box(2.5, 0.3, 9.2, 0x3a3a42, 0, 0.95, 0.6);
    b.box(2.5, 2.3, 6.6, 0xd92b2b, 0, 2.25, 1.4);
    b.box(2.54, 0.22, 6.6, 0xffcc00, 0, 1.7, 1.4);
    b.box(2.54, 0.12, 6.6, 0x1e9e50, 0, 2.0, 1.4);
    b.box(2.6, 0.08, 6.7, 0x8a1a1a, 0, 3.45, 1.4);
    for (const x of [-0.8, 0.8]) b.box(0.4, 0.2, 0.06, HEAD, x, 1.0, -4.92);
    const w = [];
    for (const x of [-1.1, 1.1]) for (const z of [-3.9, 2.0, 3.3]) w.push([x, 0.55, z, 0.55, 0.34]);
    return assemble(b.mesh({ outline: true }), w);
}

function schoolVan() {
    const b = new Builder();
    b.box(2.1, 2.1, 5.2, 0xffc414, 0, 1.45, 0);
    b.box(2.12, 0.55, 4.6, GLASS, 0, 1.95, 0.2);
    b.box(2.14, 0.14, 5.2, 0x1b1b20, 0, 1.3, 0);
    b.box(1.9, 0.9, 0.06, GLASS, 0, 1.85, -2.62);
    for (const x of [-0.7, 0.7]) b.box(0.3, 0.16, 0.06, HEAD, x, 0.95, -2.62);
    const w = [];
    for (const x of [-0.95, 0.95]) for (const z of [-1.7, 1.7]) w.push([x, 0.38, z, 0.38, 0.26]);
    return assemble(b.mesh({ outline: true }), w);
}

// ---------- street life ----------
function cow() {   // the classic Chennai road-block
    const b = new Builder();
    const W = 0xf3eee4, BR = 0x5a3a22;
    b.box(1.0, 0.75, 1.9, W, 0, 0.5, 0.1);
    b.box(0.6, 0.04, 0.7, BR, 0.15, 0.89, 0.35);
    b.box(1.02, 0.4, 0.5, BR, 0, 0.55, 0.7);
    b.box(0.42, 0.42, 0.6, W, 0, 0.95, -1.05);
    b.box(0.3, 0.22, 0.2, 0xe3a79a, 0, 0.82, -1.4);
    for (const x of [-0.2, 0.2]) b.cone(0.05, 0.3, 5, 0xfff4d6, x, 1.2, -0.95, { rz: x > 0 ? -0.6 : 0.6 });
    for (const x of [-0.3, 0.3]) b.box(0.15, 0.05, 0.25, W, x, 1.12, -0.8);
    b.box(0.06, 0.6, 0.06, W, 0, 0.6, 1.1, { rx: 0.2 });
    return assemble(b.mesh({ outline: true }), []);
}

function manhole() {
    const b = new Builder();
    b.cyl(0.6, 0.6, 0.07, 14, 0x6a6a72, 0, 0.035, 0);
    b.cyl(0.46, 0.46, 0.08, 14, 0x0e0e12, 0, 0.04, 0);
    return assemble(b.mesh({ outline: true }), []);
}

function dung() {
    const b = new Builder();
    b.sph(0.4, 0x5a381c, 0, 0.1, 0, { sy: 0.45 });
    b.sph(0.28, 0x6b4423, 0.05, 0.22, 0, { sy: 0.5 });
    b.sph(0.16, 0x7a5030, 0, 0.32, 0, { sy: 0.6 });
    return assemble(b.mesh({ outline: true }), []);
}

function barricade() {   // overhead bar: roll under or jump over
    const b = new Builder();
    for (let i = 0; i < 5; i++) b.box(0.4, 0.45, 0.2, i % 2 ? 0xffffff : 0xe03030, -0.8 + i * 0.4, 1.2, 0);
    for (const x of [-0.95, 0.95]) b.box(0.1, 1.45, 0.1, 0x30303a, x, 0.72, 0);
    for (const x of [-0.95, 0.95]) b.box(0.5, 0.06, 0.5, 0x30303a, x, 0.03, 0);
    return assemble(b.mesh({ outline: true }), []);
}

const DEFS = [
    { type: 'tall',  name: 'bus',      build: bus,                         speed: 6 },
    { type: 'tall',  name: 'truck',    build: truck,                       speed: 5 },
    { type: 'tall',  name: 'van',      build: schoolVan,                   speed: 7 },
    { type: 'block', name: 'carRed',   build: () => car(0xd62f3a),         speed: -6 },
    { type: 'block', name: 'carBlue',  build: () => car(0x2f6bd6),         speed: 9 },
    { type: 'block', name: 'taxi',     build: () => car(0xffc61a, 0x1b1b20), speed: 8 },
    { type: 'block', name: 'carWhite', build: () => car(0xf2f4f8),         speed: -6 },
    { type: 'block', name: 'auto',     build: auto,                        speed: -5 },
    { type: 'block', name: 'bike',     build: bike,                        speed: -9 },
    { type: 'block', name: 'cycle',    build: cycle,                       speed: -4 },
    { type: 'block', name: 'cow',      build: cow,                         speed: 0 },
    { type: 'flat',  name: 'manhole',  build: manhole,                     speed: 0 },
    { type: 'flat',  name: 'dung',     build: dung,                        speed: 0 },
    { type: 'gate',  name: 'barricade', build: barricade,                  speed: 0, bottom: 0.9, top: 1.3 }
];

let CATALOG = null;

/** Built once (lazily). Each entry owns a prototype that is clone()d per spawn - geometry is shared. */
export function getCatalog() {
    if (CATALOG) return CATALOG;
    CATALOG = DEFS.map(d => {
        const inner = d.build();
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        const center = box.getCenter(new THREE.Vector3());
        const root = new THREE.Group();
        root.add(inner);
        inner.position.z -= center.z;       // centre the vehicle on its own origin
        inner.position.x -= center.x;
        return {
            ...d,
            proto: root,
            halfW: Math.max(0.3, (box.max.x - box.min.x) / 2 * 0.92),
            halfLen: (box.max.z - box.min.z) / 2 * 0.95,
            bottom: d.bottom ?? 0,
            top: d.top ?? box.max.y
        };
    });
    return CATALOG;
}