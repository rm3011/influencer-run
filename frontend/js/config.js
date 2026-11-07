export const CONFIG = {
    player: {
        height: 0.4,                 // COLLISION height (unchanged)
        renderHeight: 1.7,           // <<< the ACTUAL rendered world height of Soldier.glb (measure once)
        realHeightMeters: 1.75,      // real-world reference: human height
        baseY: 0.25,
        jumpVelocity: 8,
        gravity: 30,
        rollDuration: 0.5,
        rollScale: 0.4,
        laneX: [-2, 0, 2],
        laneLerp: 0.25,
        width: 0.8
    },
    camera: { position: [0, 3.5, 6], lookAt: [0, 0.5, 0] },
    game: {
        baseSpeed: 10, maxSpeed: 22, speedPerScore: 0.02,
        spawnInterval: 1.8, poolSize: 8, spawnZ: -60, recycleZ: 8,
        collideWindow: 0.6, scorePerObstacle: 10
    },
    collectibles: { spawnIntervalMin: 1.2, spawnIntervalMax: 2.2 },
    zones: { length: 40, order: ['trees', 'city', 'beach', 'landmark'] },
    characters: {
        soldier: {
            name: 'Soldier',
            model: './assets/models/Soldier.glb',
            collectibleColor: 0xffd700,
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

// 1 real-world meter in game units, derived from the RENDERED character height:
//   METER = renderHeight / realHeightMeters
// With renderHeight = 1.7 → METER ≈ 0.971. A car (1.45 m) becomes 1.41 units tall.
// Previously this was 0.4/1.75 ≈ 0.229 → 6x smaller. That's what shrank everything.
export const METER = CONFIG.player.renderHeight / CONFIG.player.realHeightMeters;