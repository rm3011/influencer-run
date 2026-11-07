import * as THREE from 'three';
import { Builder, rnd, pick } from './toon.js';

/*
 * LEFT side cycles through zones: park -> city -> temple district (Mylapore style).
 * RIGHT side is always the Marina coast: sand, palms, boats, huts, a lighthouse, then the sea.
 * Every prop is a merged vertex-colour mesh; variants are built once and clone()d (shared geometry).
 */

const PASTEL = [0xf4a6a0, 0xffd27a, 0x9fdcc8, 0xfff1d6, 0xf08a5d, 0x8fc0f0, 0xd9b3f0];
const BRIGHT = [0xe63946, 0xffb703, 0x2a9d8f, 0x4361ee, 0xf72585, 0x80ed99];
const WIN = 0x2c3e5a, LIT = 0xffe9a0;
const ri = (n) => (Math.random() * n) | 0;

// ---------------- left: park ----------------
function neem() {
    const b = new Builder();
    b.cyl(0.35, 0.5, 4.2, 7, 0x6a4a2e, 0, 2.1, 0);
    const greens = [0x4fae48, 0x3e9c3c, 0x6cc455];
    for (let i = 0; i < 5; i++) {
        b.ico(rnd(1.5, 2.3), 1, pick(greens), rnd(-1.4, 1.4), rnd(4.8, 7), rnd(-1.4, 1.4), { sy: 0.85 });
    }
    return b.mesh();
}
function banyan() {
    const b = new Builder();
    b.cyl(0.7, 0.9, 3.4, 8, 0x5a3e28, 0, 1.7, 0);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.ico(rnd(2.2, 3), 1, pick([0x3a8f3a, 0x4fae48]), Math.cos(a) * 2.6, rnd(4.2, 5.6), Math.sin(a) * 2.6, { sy: 0.7 });
        b.cyl(0.07, 0.07, 3.5, 4, 0x6a4a2e, Math.cos(a) * 3.1, 2.4, Math.sin(a) * 3.1);
    }
    b.ico(2.8, 1, 0x4fae48, 0, 6, 0, { sy: 0.7 });
    return b.mesh();
}
function lamp(dir) {
    const b = new Builder();
    b.cyl(0.08, 0.11, 6, 6, 0x4a4a55, 0, 3, 0);
    b.box(1.4, 0.1, 0.1, 0x4a4a55, dir * 0.7, 6, 0);
    b.box(0.6, 0.14, 0.32, 0xfff0b0, dir * 1.35, 5.92, 0);
    return b.mesh();
}

// ---------------- left: city ----------------
function apartment() {
    const b = new Builder();
    const d = 6, w = rnd(6, 7), fl = 4 + ri(3), h = fl * 3.2, c = pick(PASTEL);
    b.box(d, h, w, c, 0, h / 2, 0);
    b.box(d + 0.3, 0.5, w + 0.3, 0xe9e2d6, 0, h + 0.25, 0);
    const cols = 3, cw = w / cols;
    for (let f = 0; f < fl; f++) {
        const y = f * 3.2 + (f === 0 ? 2.1 : 1.9);
        for (let k = 0; k < cols; k++) {
            const z = -w / 2 + cw * (k + 0.5);
            b.box(0.12, 1.3, 1.3, Math.random() < 0.2 ? LIT : WIN, d / 2 + 0.05, y, z);
            if (f > 0) b.box(0.9, 0.12, cw * 0.85, 0xf2ece0, d / 2 + 0.45, y - 0.7, z);
            if (f > 0 && Math.random() < 0.35) b.box(0.4, 0.45, 0.5, 0xf5f5f5, d / 2 + 0.2, y + 0.1, z + 0.6);
        }
    }
    b.box(1.2, 0.15, w * 0.9, pick(BRIGHT), d / 2 + 0.6, 3.1, 0, { rz: -0.2 });
    b.cyl(0.8, 0.8, 1.2, 10, 0x1c1c22, 1, h + 1.1, 1.4);   // roof water tank
    return b.mesh();
}
function shop() {
    const b = new Builder();
    const w = 6.5, h = 6.4;
    b.box(5, h, w, pick(PASTEL), 0, h / 2, 0);
    b.box(0.3, 1.3, w + 0.1, pick(BRIGHT), 2.6, 3.7, 0);               // signboard
    b.box(0.1, 2.2, w * 0.8, 0x2a2a34, 2.5, 1.2, 0);                   // shutter
    b.box(1.2, 0.15, w * 0.9, pick(BRIGHT), 3.1, 2.6, 0, { rz: -0.25 });
    for (const z of [-1.8, 0, 1.8]) b.box(0.1, 1.4, 1.2, Math.random() < 0.25 ? LIT : WIN, 2.5, 5.2, z);
    b.box(5.3, 0.4, w + 0.3, 0xe9e2d6, 0, h + 0.2, 0);
    return b.mesh();
}
function tower() {   // OMR IT-corridor glass tower
    const b = new Builder();
    const h = rnd(26, 38), s = 6;
    b.box(s, h, s, 0x4f9bd6, 0, h / 2, 0);
    for (let c = -2; c <= 2; c++) b.box(0.12, h, 0.12, 0xbfe6ff, s / 2 + 0.05, h / 2, c * 1.1);
    for (let y = 3; y < h; y += 4) b.box(0.14, 0.25, s + 0.1, 0x2f6ca8, 0, y, 0);
    b.cyl(0.08, 0.08, 4, 5, 0x888899, 0, h + 2, 0);
    b.sph(0.18, 0xff3030, 0, h + 4, 0);
    return b.mesh();
}

// ---------------- left: temple district ----------------
function wall() {   // red-and-white striped temple compound wall (exactly one row-spacing long)
    const b = new Builder();
    const L = 7, sw = L / 14;
    b.box(0.7, 2.6, L, 0xf6efe4, 0, 1.3, 0);
    for (let i = 0; i < 7; i++) b.box(0.74, 2.6, sw, 0xd8402e, 0, 1.3, -L / 2 + sw * (2 * i + 0.5));
    b.box(0.9, 0.25, L, 0xb9301f, 0, 2.72, 0);
    for (const z of [-L / 2 + 0.4, L / 2 - 0.4]) b.sph(0.22, 0xffd23d, 0, 3.0, z);
    return b.mesh();
}
function gopuram() {
    const b = new Builder();
    b.box(12, 3, 10, 0xe9d9b8, 0, 1.5, 0);
    b.box(0.3, 2.4, 3, 0x3a1c10, 6.1, 1.3, 0);
    let y = 3;
    for (let i = 0; i < 8; i++) {
        const w = 10.5 - i * 1.05, d = 9 - i * 0.9, h = 2.3;
        b.box(w, h, d, i % 2 ? 0xd9623a : 0xf0cf8a, 0, y + h / 2, 0);
        b.box(w + 0.4, 0.3, d + 0.4, 0x9b3a22, 0, y + h, 0);
        for (let k = 0; k < 5; k++) {
            b.box(0.3, 0.9, 0.5, pick(BRIGHT), w / 2 + 0.1, y + 1.2, -d / 2 + (k + 0.5) * (d / 5));
        }
        y += h + 0.3;
    }
    b.cyl(1.0, 1.0, 4.2, 8, 0xc2502c, 0, y + 0.8, 0, { rx: Math.PI / 2 });
    for (const z of [-1.4, 0, 1.4]) b.cone(0.3, 1.2, 6, 0xffd23d, 0, y + 2.1, z);
    return b.mesh();
}

// ---------------- right: Marina coast ----------------
function palm() {
    const b = new Builder();
    const h = rnd(5.5, 7.5), lean = rnd(-0.35, 0.35), segs = 6, sh = h / segs;
    let x = 0, y = 0;
    for (let i = 0; i < segs; i++) {
        const a = lean * (i / segs);
        b.cyl(0.2 - 0.015 * i, 0.24 - 0.015 * i, sh * 1.05, 6, i % 2 ? 0x7a5a38 : 0x6b4c2e,
            x + Math.sin(a) * sh / 2, y + Math.cos(a) * sh / 2, 0, { rz: -a });
        x += Math.sin(a) * sh; y += Math.cos(a) * sh;
    }
    for (let i = 0; i < 9; i++) {
        const az = (i / 9) * Math.PI * 2, droop = 0.55;
        b.box(0.5, 0.05, 2.6, i % 2 ? 0x3fae4e : 0x58c85c,
            x + Math.sin(az) * 1.15, y - Math.sin(droop) * 1.2, Math.cos(az) * 1.15, { ry: az, rx: droop });
    }
    for (let i = 0; i < 3; i++) b.sph(0.18, 0x6b4423, x + rnd(-0.25, 0.25), y - 0.3, rnd(-0.25, 0.25));
    return b.mesh();
}
function umbrella() {
    const b = new Builder();
    b.cyl(0.04, 0.04, 2.2, 5, 0xf2f2f2, 0, 1.1, 0);
    b.cone(1.3, 0.5, 8, pick([0xe63946, 0xffb703, 0x4361ee, 0xf72585]), 0, 2.35, 0);
    b.box(1.6, 0.1, 0.5, 0xf4f4f4, 1.5, 0.35, 0.4);
    return b.mesh();
}
function hut() {
    const b = new Builder();
    b.box(2.2, 1.4, 2.2, 0xe9d3a3, 0, 0.7, 0);
    b.cone(2, 1.3, 4, 0xb88a3e, 0, 2.05, 0, { ry: Math.PI / 4 });
    b.box(0.1, 1.0, 0.7, 0x3a2410, -1.12, 0.5, 0);
    return b.mesh();
}
function boat() {   // fishing catamaran
    const b = new Builder();
    const hull = pick([0x2f7bd9, 0xe85a2a, 0xffc61a, 0x2a9d8f]);
    b.box(0.9, 0.35, 4.4, hull, 0, 0.45, 0);
    b.cone(0.5, 1.0, 4, hull, 0, 0.45, -2.6, { rx: -Math.PI / 2 });
    b.box(0.95, 0.12, 4.5, 0xf5f0e0, 0, 0.68, 0);
    b.cyl(0.05, 0.05, 3.4, 5, 0x6b4c2e, 0, 2.2, -0.4);
    b.box(0.04, 2.4, 1.5, pick([0xffffff, 0xffe9a0, 0xff9a6a]), 0, 2.2, 0.4);
    return b.mesh();
}
function lighthouse() {
    const b = new Builder();
    for (let i = 0; i < 5; i++) b.cyl(1.6 - 0.12 * (i + 1), 1.6 - 0.12 * i, 3.6, 12, i % 2 ? 0xe53935 : 0xffffff, 0, 1.8 + i * 3.6, 0);
    b.cyl(2, 2, 0.3, 12, 0x30303a, 0, 18.2, 0);
    b.cyl(1, 1, 1.6, 10, 0xffe9a0, 0, 19.2, 0);
    b.cone(1.4, 1.2, 10, 0xe53935, 0, 20.6, 0);
    return b.mesh();
}

const BUILD = {
    neem, banyan, apartment, shop, tower, wall, gopuram, palm, umbrella, hut, boat, lighthouse,
    lamp: () => lamp(1), lampR: () => lamp(-1)
};
const VARIANTS = {
    neem: 4, banyan: 2, apartment: 5, shop: 4, tower: 3, wall: 1, gopuram: 2,
    palm: 5, umbrella: 3, hut: 3, boat: 4, lighthouse: 1, lamp: 1, lampR: 1
};
const SPIN = new Set(['neem', 'banyan', 'palm', 'umbrella']);
const _cache = {};
function variant(name) {
    if (!_cache[name]) _cache[name] = Array.from({ length: VARIANTS[name] || 3 }, () => BUILD[name]());
    return pick(_cache[name]);
}

// x = distance from road centre (negative = left). Right side is identical for every zone.
const RIGHT = {
    near: { x: 8,    j: 1.0, items: ['palm', 'palm', 'lampR', 'umbrella'] },
    far:  { x: 12.5, j: 1.2, items: ['hut', 'boat', 'palm', 'boat', 'umbrella'] }
};
const LEFT = {
    park:   { near: { x: -8,    j: 1.2, items: ['neem', 'neem', 'banyan', 'lamp'] },
              far:  { x: -18,   j: 3.0, items: ['neem', 'banyan', 'neem'] } },
    city:   { near: { x: -10.5, j: 0.5, items: ['apartment', 'shop', 'apartment', 'lamp'] },
              far:  { x: -22,   j: 1.5, items: ['tower', 'apartment', 'tower'] } },
    temple: { near: { x: -6.2,  j: 0,   items: ['wall'] },
              far:  { x: -24,   j: 0.5, items: ['gopuram', 'apartment', 'gopuram', 'tower'] } }
};

export const ROWS = [
    { side: 'left',  layer: 'near', spacing: 7 },
    { side: 'left',  layer: 'far',  spacing: 12 },
    { side: 'right', layer: 'near', spacing: 7 },
    { side: 'right', layer: 'far',  spacing: 12 }
];

export const ZONE_ORDER = ['park', 'city', 'temple'];
export const ZONE_LENGTH = 140;
export const ZONE_GROUND = { park: 0x7cc96a, city: 0xbfae98, temple: 0xd9b98a };

export function zoneAtDistance(d) {
    const band = Math.floor(d / ZONE_LENGTH);
    return ZONE_ORDER[((band % ZONE_ORDER.length) + ZONE_ORDER.length) % ZONE_ORDER.length];
}

export function makeScenery(side, layer, zone) {
    const spec = side === 'left' ? LEFT[zone][layer] : RIGHT[layer];
    let name = pick(spec.items);
    if (side === 'right' && layer === 'far' && Math.random() < 0.06) name = 'lighthouse';
    let x = spec.x + (Math.random() - 0.5) * spec.j;
    if (name === 'lamp') x = -5.4;
    if (name === 'lampR') x = 5.4;
    return { obj: variant(name).clone(true), x, yaw: SPIN.has(name) ? Math.random() * Math.PI * 2 : 0 };
}