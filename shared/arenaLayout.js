export const ArenaLayout = {
  groundLevel: 0,
  bounds: {
    min: { x: -35, y: -2, z: -35 },
    max: { x: 35, y: 15, z: 35 }
  },
  respawns: [
    { x: -8, y: 0, z: -10 },
    { x: -12, y: 0, z: 12 },
    { x: 10, y: 0, z: 6 },
    { x: 18, y: 0, z: -14 },
    { x: 4, y: 0, z: 14 },
    { x: -18, y: 0, z: -6 }
  ],
  obstacles: [
    { position: { x: 0, y: 1.5, z: 0 }, size: { x: 6, y: 3, z: 6 } },
    { position: { x: -14, y: 1.2, z: -4 }, size: { x: 5, y: 2.4, z: 9 } },
    { position: { x: 14, y: 2.2, z: 8 }, size: { x: 4, y: 4.4, z: 6 } },
    { position: { x: 6, y: 1.8, z: -16 }, size: { x: 8, y: 3.6, z: 4 } },
    { position: { x: -20, y: 2.5, z: 14 }, size: { x: 6, y: 5, z: 6 } }
  ],
  ramps: [
    { from: { x: -6, z: -18 }, to: { x: -12, z: -12 }, height: 3 },
    { from: { x: 12, z: 16 }, to: { x: 18, z: 10 }, height: 2.5 }
  ]
};
