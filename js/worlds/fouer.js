// PLACEHOLDER (being built): Fouer Frenzy. Replaced by the real world.
const TRACK = [[-90, 50], [0, 58], [90, 50], [118, 0], [90, -50], [0, -58], [-90, -50], [-118, 0]];

export default {
  id: 'fouer',
  name: 'Fouer Frenzy',
  blurb: 'The funfair at night: Ferris wheel, roller coaster and the bumper-car rink.',
  vehicle: 'bumper',
  seed: 22,
  track: { points: TRACK, width: 14, startS: 40 },
  bounds: { minX: -150, maxX: 150, minZ: -95, maxZ: 95 },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  lighting: { sunDir: [-0.5, 1, -0.4], sunIntensity: 2.4, background: 0x2a2420 },
  async build(K) {
    const T = K.THREE;
    K.mesh(new T.BoxGeometry(300, 4, 190), K.std({ color: 0x9a7a5a, roughness: 0.7 }), 0, -2, 0, { cast: false });
    K.ribbon({ mat: K.std({ color: 0x555555, roughness: 0.9 }), width: 14, y: 0.05 });
  },
};
