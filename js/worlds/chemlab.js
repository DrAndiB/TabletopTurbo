// World stub: replaced by the full world.
export default {
  id: 'chemlab',
  name: "Chemistry Lab",
  blurb: 'Coming soon.',
  vehicle: 'rally',

  seed: 5,
  track: { points: [[-60, 40], [60, 40], [90, 0], [60, -40], [-60, -40], [-90, 0]], width: 14, startS: 20 },
  bounds: { minX: -130, maxX: 130, minZ: -80, maxZ: 80 },
  lighting: {},
  async build(K) {
    const T = K.THREE;
    K.mesh(new T.BoxGeometry(260, 4, 160), K.std({ color: 0x8a6a4a, roughness: 0.8 }), 0, -2, 0, { cast: false });
    K.ribbon({ mat: K.std({ color: 0x444444, roughness: 0.9 }), y: 0.03 });
  },
};
