export const CONFIG = {
    player: {
        height: 1.9,
        renderHeight: 0.4,
        realHeightMeters: 1.75,
        baseY: 0.25,
        jumpVelocity: 8,
        gravity: 30,
        rollDuration: 0.5,
        rollScale: 0.4,
        rollHeight: 0.28,
        laneX: [-2, 0, 2],
        laneLerp: 18,
        modelYaw: 0,
        width: 0.8,
        depth: 0.7
    },
    camera: {
        menu: { pos: [0, 2.5, 8], look: [0, 1, 0] },
        game: { pos: [0, 4.2, 8], look: [0, 1, -8] },
        fov: 55,
        fovPortrait: 65
    },
    game: {
        baseSpeed: 10, maxSpeed: 22, speedPerScore: 0.02,
        spawnGap: 22, poolSize: 16, spawnZ: -60, recycleZ: 8,
        collideWindow: 0.6, scorePerObstacle: 10, coinScore: 5, kcalPerMeter: 0.045
    },
    collectibles: { spawnIntervalMin: 1.2, spawnIntervalMax: 2.2 },
    
    zones: { length: 140, order: ['park', 'city', 'temple'] },
    
    characters: {
        soldier: {
            name: 'Soldier',
            model: './assets/models/Soldier.glb',
            collectibleColor: 0xffd700,
            collectibleValue: 5
        },
        bheem: {
            name: 'Bheem',
            model: './assets/models/bheem.glb',
            collectibleType: 'ladoo',
            collectibleColor: 0xffa51e,
            collectibleValue: 5
        }
    },
    currentCharacter: 'soldier',
    colors: {
        sky: 0x87CEEB, ground: 0x3a7d3a,
        tall: 0x0000cc, block: 0x8800cc,
        flat: 0xcc0000, gate: 0x00aa44
    }
};

export const METER = CONFIG.player.renderHeight / CONFIG.player.realHeightMeters;