import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const gradientData = new Uint8Array([0, 96, 176, 255]);
export const TOON_GRADIENT = new THREE.DataTexture(gradientData, 4, 1, THREE.RedFormat);
TOON_GRADIENT.minFilter = THREE.NearestFilter;
TOON_GRADIENT.magFilter = THREE.NearestFilter;
TOON_GRADIENT.generateMipmaps = false;
TOON_GRADIENT.needsUpdate = true;

const outlineMaterial = new THREE.MeshToonMaterial({
    color: 0x1a1026,
    side: THREE.BackSide,
    gradientMap: TOON_GRADIENT
});
outlineMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vec3 outlineNormal = normalize(normalMatrix * objectNormal);
         gl_Position.xy += normalize((projectionMatrix * vec4(outlineNormal, 0.0)).xy) * 0.0045 * gl_Position.w;`
    );
};

const toonMaterial = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: TOON_GRADIENT,
    vertexColors: true
});

export const toonCoin = toonMaterial.clone();

export const rnd = (min, max) => min + Math.random() * (max - min);
export const pick = (items) => items[(Math.random() * items.length) | 0];

export class Builder {
    constructor() {
        this.geometries = [];
    }

    add(geometry, color, x = 0, y = 0, z = 0, options = {}) {
        const { sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0 } = options;
        const matrix = new THREE.Matrix4()
            .makeScale(sx, sy, sz)
            .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)))
            .setPosition(x, y, z);
        const transformed = geometry.clone().applyMatrix4(matrix);
        const mergedReady = transformed.index ? transformed.toNonIndexed() : transformed;
        if (mergedReady !== transformed) transformed.dispose();
        const rgb = new THREE.Color(color);
        const colors = new Float32Array(mergedReady.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) {
            colors[i] = rgb.r;
            colors[i + 1] = rgb.g;
            colors[i + 2] = rgb.b;
        }
        mergedReady.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometries.push(mergedReady);
        return this;
    }

    box(width, height, depth, color, x, y, z, options) {
        return this.add(new THREE.BoxGeometry(width, height, depth), color, x, y, z, options);
    }

    cyl(radiusTop, radiusBottom, height, segments, color, x, y, z, options) {
        return this.add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, x, y, z, options);
    }

    cone(radius, height, segments, color, x, y, z, options) {
        return this.add(new THREE.ConeGeometry(radius, height, segments), color, x, y, z, options);
    }

    sph(radius, color, x, y, z, options) {
        return this.add(new THREE.SphereGeometry(radius, 12, 8), color, x, y, z, options);
    }

    ico(radius, detail, color, x, y, z, options) {
        return this.add(new THREE.IcosahedronGeometry(radius, detail), color, x, y, z, options);
    }

    mesh({ material = toonMaterial, outline = false } = {}) {
        const geometry = mergeGeometries(this.geometries, false);
        for (const part of this.geometries) part.dispose();
        this.geometries.length = 0;

        if (!geometry) {
            throw new Error('Cannot build a mesh without geometry.');
        }

        const mesh = new THREE.Mesh(geometry, material);
        if (!outline) return mesh;

        const group = new THREE.Group();
        group.add(mesh);
        group.add(new THREE.Mesh(geometry, outlineMaterial));
        return group;
    }
}

export function makeWheel(radius, width) {
    const wheel = new THREE.Group();
    const tireGeometry = new THREE.CylinderGeometry(radius, radius, width, 12);
    tireGeometry.rotateZ(Math.PI / 2);
    wheel.add(new THREE.Mesh(tireGeometry, new THREE.MeshToonMaterial({ color: 0x202027, gradientMap: TOON_GRADIENT })));

    const hubGeometry = new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, width + 0.02, 10);
    hubGeometry.rotateZ(Math.PI / 2);
    wheel.add(new THREE.Mesh(hubGeometry, new THREE.MeshToonMaterial({ color: 0x9ca3af, gradientMap: TOON_GRADIENT })));
    return wheel;
}
