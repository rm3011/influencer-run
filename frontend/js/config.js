export const CONFIG = {
    player: {
        height: 0.5,
        baseY: 0.25,
        jumpVelocity: 8,
        gravity: 30,
        rollDuration: 0.5,
        rollScale: 0.4,
        laneX: [-2, 0, 2],
        laneLerp: 0.25,
        width: 0.8
    },
    camera: {
        position: [0, 3.5, 6],
        lookAt: [0, 0.5, 0]
    },
    game: {
        baseSpeed: 10,
        maxSpeed: 22,
        speedPerScore: 0.02,
        spawnInterval: 1.8,
        poolSize: 8,
        spawnZ: -60,
        recycleZ: 8,
        collideWindow: 0.6,
        scorePerObstacle: 10
    },
    colors: {
        sky: 0x87CEEB,
        ground: 0x3a7d3a,
        tall: 0x0000cc,
        block: 0x8800cc,
        flat: 0xcc0000,
        gate: 0x00aa44
    }
};