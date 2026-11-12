// World: Dino Dash (Time Machine Cup, table 1 of 4). A prehistoric play set on a green felt mat: a dirt road lined
// with pebbles between plastic dinosaurs, cycads and a papier-mâché volcano. A toy T-rex tips forward and snaps at
// the outer lane (it rears back with its jaws open first), a stegosaurus sweeps its spiked tail across the inside of
// the road, the brachiosaurus holds its neck over the north straight, the road runs through a rib cage and over a
// dirt hump, a tar pit sticks in the north-east bend and the eggs of a raided nest roll about.
import { tmTools, blast, fired, mod, ss } from './_tm.js';

const TRACK = [
  [-70, 80], [-20, 82], [35, 80], [80, 72], [110, 48], [116, 14], [104, -18], [78, -36], [60, -58], [38, -78], [4, -82],
  [-26, -70], [-40, -44], [-30, -16], [-6, 4], [-4, 30], [-30, 44], [-62, 36], [-80, 10], [-80, -24], [-84, -50],
  [-98, -68], [-116, -64], [-126, -40], [-128, 0], [-122, 44], [-102, 70],
];
const W = 16, PI = Math.PI;
const REX = { x: 90, z: 30, period: 8, phase: 2.2, reach: 16.5, R: 6.5 };
const STEG = { x: -24, z: 15, len: 10.5, period: 3.4, swing: 0.62 };
// the T-rex's pitch (radians, forward is negative) and jaw at time u into its cycle: rear up, lunge, hold, back
function rexPose(u) {
  if (u < 1.3) { const k = ss(0, 1.1, u); return { pitch: 0.22 * k, jaw: k }; }
  if (u < 1.5) { const k = (u - 1.3) / 0.2; return { pitch: 0.22 - 0.97 * k * k, jaw: 1 - k }; }
  if (u < 2.3) return { pitch: -0.75, jaw: 0 };
  if (u < 3.3) return { pitch: -0.75 * (1 - ss(2.3, 3.3, u)), jaw: 0 };
  return { pitch: 0, jaw: 0 };
}
const rexU = (t) => mod(t - REX.phase, REX.period);
const tailA = (t) => STEG.a0 + STEG.swing * Math.sin((t * 2 * PI) / STEG.period);

let A = null;

export default {
  id: 'dino',
  name: 'Dino Dash',
  blurb: 'A prehistoric play set: mind the T-rex that snaps, the swinging tail and the tar pit.',
  vehicle: 'truck',
  seed: 101,
  track: { points: TRACK, width: W, startS: 40 },
  bounds: { minX: -150, maxX: 150, minZ: -106, maxZ: 106 },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 18,
  offroad: { kind: 'slow', margin: 1 },
  skidColor: 0x5a3d22,
  dustColor: 0xc9a777,
  dust: {
    normal: { color: 0xc9a777, size: 1.0, life: 0.45, up: 1.4, grav: 3, alpha: 0.25, grow: 2, rate: 0.45 },
    slow: { color: 0x7fae5a, size: 0.8, life: 0.4, up: 3, grav: 14, alpha: 0.5, grow: 1.4, rate: 1.2 },
    sticky: { color: 0x15110e, size: 0.7, life: 0.45, up: 4, grav: 40, alpha: 0.95, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.5, 1.2, 0.35], sunColor: 0xfff0d2, sunIntensity: 2.8,
    hemiSky: 0xd6ecff, hemiGround: 0x6f8a4a, hemiIntensity: 0.6,
    envIntensity: 0.45, exposure: 1.0, background: 0x2a2620,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const { G, P, toy, wedge, table, road, startLine, edges, scatter, sAt, geoOf } = tmTools(K);
    A = { prevT: null, rex: null, tail: null, bite: null };
    const paint = K.plastic(0xffffff, 0.5, { vertexColors: true });
    const matte = K.std({ color: 0xffffff, roughness: 0.9, vertexColors: true });
    const stone = K.std({ color: 0xffffff, roughness: 0.9 });

    // ---------------- table, felt mat, road ----------------
    table({ w: 304, d: 216, wood: [0xc79a62, 0x8a5a30, 0xe3bd86], floorA: '#d8cdb8', floorB: '#b9c7cf' });
    const felt = TX.feltTextures({ size: 512, color: 0x5d9b4a, seed: 21 });
    for (const t of Object.values(felt)) t.repeat.set(12, 8.5);
    K.mesh(new T.BoxGeometry(300, 0.3, 212), K.std({ map: felt.map, normalMap: felt.normalMap, roughness: 1 }), 0, -0.15, 0, { cast: false });
    // darker printed "jungle" patches on the mat
    const patchMat = K.std({ color: 0x3f7d3a, roughness: 1, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 16; i++) K.spill(r.range(-140, 140), r.range(-98, 98), r.range(9, 20), patchMat, { lump: 0.5, y: 0.02, thick: 0.01, n: 24 });
    road({ a: 0xc49a66, b: 0xa67c4c, seed: 7 });
    startLine(40, 0.08, '#3a2a1c', '#f3ead6');

    // pebbles along both edges, a bone now and then
    const stoneCols = [0x9a948a, 0xb5ab98, 0x7d776f, 0xc9bda6, 0x8c8072];
    edges(G.ico(0.62), stone, 2.3, 0.7, (p) => ({ x: p.x + r.range(-0.3, 0.3), y: 0.3, z: p.z + r.range(-0.3, 0.3), ry: r() * 6, rx: r() * 3, s: r.range(0.7, 1.25), sy: r.range(0.5, 0.8), color: r.pick(stoneCols) }));
    const boneGeo = geoOf([P(G.cyl(0.22, 0.22, 2.4, 8), 0xf1ead8, 0, 0, 0, { rz: PI / 2 }), P(G.sph(0.42, 8), 0xf1ead8, -1.2, 0, 0.22), P(G.sph(0.42, 8), 0xf1ead8, -1.2, 0, -0.22), P(G.sph(0.42, 8), 0xf1ead8, 1.2, 0, 0.22), P(G.sph(0.42, 8), 0xf1ead8, 1.2, 0, -0.22)]);
    scatter(boneGeo, matte, 34, [-144, 144, -100, 100], 3, (x, z) => ({ x, y: 0.4, z, ry: r() * 6, s: r.range(0.8, 1.5) }));

    // ---------------- the dirt hump on the south straight ----------------
    {
      const s = 118, len = 6, h = 1.15, p = track.at(s);
      K.ramp(p.x, p.z, p.angle, len, W + 1, h, 0);
      const m = K.mesh(wedge(len, h, 2.2, W + 1.5), K.std({ color: 0xa67c4c, roughness: 1 }), p.x, 0.02, p.z);
      m.rotation.y = -p.angle;
      // two half-buried logs hold the hump's lip
      for (const side of [-1, 1]) {
        const q = track.place(s + len / 2 + 0.6, side * (W / 2 + 2.2));
        K.mesh(G.cyl(1.2, 1.3, 5, 10), K.std({ color: 0x6d4a2b, roughness: 0.95 }), q.x, 0.9, q.z, { rx: PI / 2, ry: -q.angle + PI / 2 });
        K.circle(q.x, q.z, 1.6, 2.4); K.contact(q.x, q.z, 3, 2, 0.35);
      }
    }

    // ---------------- plants: ferns, cycads, rocks ----------------
    const fern = geoOf([0, 1, 2, 3, 4, 5, 6].map((i) => P(G.cone(0.7, 3.6, 5), i % 2 ? 0x2f8f3c : 0x3fa84a, Math.cos(i * 0.9) * 1.25, 0.95, Math.sin(i * 0.9) * 1.25, { rz: -Math.cos(i * 0.9) * 0.95, rx: Math.sin(i * 0.9) * 0.95, order: 'XZY', sz: 0.35 })));
    scatter(fern, matte, 150, [-146, 146, -102, 102], 2.5, (x, z) => ({ x, y: 0, z, ry: r() * 6, s: r.range(0.7, 1.5) }));
    const cycad = geoOf([
      P(G.cyl(0.9, 1.25, 6, 8), 0x7a5632, 0, 3, 0), P(G.cyl(1.0, 1.0, 0.5, 8), 0x5f4226, 0, 2, 0), P(G.cyl(0.95, 0.95, 0.5, 8), 0x5f4226, 0, 4, 0),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => P(G.cone(0.9, 6.5, 5), i % 2 ? 0x2c8a3a : 0x49b050, Math.cos(i * 0.785) * 2.6, 6.2, Math.sin(i * 0.785) * 2.6, { rz: -Math.cos(i * 0.785) * 1.25, rx: Math.sin(i * 0.785) * 1.25, order: 'XZY', sz: 0.3 })),
    ]);
    const trees = [];
    scatter(cycad, matte, 26, [-144, 144, -100, 96], 6, (x, z) => {
      // keep them off the south side of a road, where they would hide it
      if (!K.offRoad(x, z - 7, 3) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 12)) return null;
      const t = { x, y: 0, z, ry: r() * 6, s: r.range(0.9, 1.35) };
      trees.push(t); K.circle(x, z, 1.3, 7); K.contact(x, z, 3.2, 3.2, 0.35);
      return t;
    });
    scatter(G.ico(1), stone, 60, [-146, 146, -102, 102], 2.5, (x, z) => ({ x, y: 0.3, z, ry: r() * 6, rx: r() * 3, s: r.range(0.6, 1.8), sy: r.range(0.4, 0.9), color: r.pick(stoneCols) }));

    // ---------------- the papier-mâché volcano (north-east corner) ----------------
    {
      const x = 120, z = -80;
      const prof = [[25, 0], [21, 4], [15, 11], [10, 18], [7, 23], [5.2, 25.5], [4.2, 25], [3, 22]];
      const g = K.lathe(prof, 28), pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new T.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), a = Math.atan2(pos.getZ(i), pos.getX(i));
        const lava = y > 9 && Math.sin(a * 5 + y * 0.35) > 0.72 - (y - 9) * 0.03;
        c.set(lava ? 0xff5a1f : y > 20 ? 0x4a3a34 : 0x7a5a44); if (lava && y < 14) c.set(0xffa322);
        cols.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new T.BufferAttribute(cols, 3));
      K.mesh(g, K.std({ vertexColors: true, roughness: 0.95, flatShading: true }), x, 0, z);
      K.mesh(new T.CircleGeometry(4.3, 20), K.std({ color: 0xff7a22, emissive: 0xff4a10, emissiveIntensity: 1.2, roughness: 0.4 }), x, 24.2, z, { rx: -PI / 2, cast: false });
      K.circle(x, z, 24, 30); K.contact(x, z, 29, 29, 0.4);
      // cotton-wool smoke
      const puffs = [];
      for (let i = 0; i < 7; i++) puffs.push({ x: x + r.range(-2, 2) - i * 0.9, y: 27 + i * 2.6, z: z + r.range(-2, 2), s: 2.4 + i * 0.55 });
      K.instances(G.sph(1, 10), K.std({ color: 0xf2efe8, roughness: 1 }), puffs);
    }

    // ---------------- the T-rex (east infield): tips forward and snaps at the outer lane ----------------
    {
      const sB = sAt(REX.x + 22, REX.z + 6), tp = track.at(sB);
      // it stands inside the bend and bites the lane nearest to it
      const side = (REX.x - tp.x) * tp.nx + (REX.z - tp.z) * tp.nz > 0 ? 1 : -1;
      const b = track.place(sB, side * 3.6), d = Math.hypot(b.x - REX.x, b.z - REX.z);
      const ang = Math.atan2(b.z - REX.z, b.x - REX.x);
      const rx = b.x - Math.cos(ang) * REX.reach, rz = b.z - Math.sin(ang) * REX.reach;
      void d;
      const g1 = 0x6f9a3a, g2 = 0x4f7a2a, belly = 0xd9cf8a;
      const body = [
        P(G.sph(1, 16), g1, 0, 9.4, 0, { sx: 6.2, sy: 4.2, sz: 3.6, rz: 0.35 }),
        P(G.sph(1, 12), belly, 0.6, 8.6, 0, { sx: 5.2, sy: 3.6, sz: 3.1, rz: 0.35 }),
        P(G.cone(2.9, 13, 10), g1, -9.5, 6.4, 0, { rz: PI / 2 + 0.3, sz: 0.8 }),
        P(G.cap(1.7, 4.2), g2, -0.6, 3.6, 2.6, { rz: -0.25 }), P(G.cap(1.7, 4.2), g2, -0.6, 3.6, -2.6, { rz: -0.25 }),
        P(G.rbox(4.4, 1.1, 2.6, 0.4), g2, 0.6, 0.55, 2.7), P(G.rbox(4.4, 1.1, 2.6, 0.4), g2, 0.6, 0.55, -2.7),
        P(G.cap(0.45, 1.6), g2, 4.6, 9.2, 1.9, { rz: -1.0 }), P(G.cap(0.45, 1.6), g2, 4.6, 9.2, -1.9, { rz: -1.0 }),
        P(G.cap(2.1, 3.4), g1, 4.9, 12.2, 0, { rz: -0.75 }),
        ...[0, 1, 2, 3, 4, 5].map((i) => P(G.cone(0.55, 1.5, 4), 0x8a5a2a, -2.5 - i * 1.6, 12.6 - i * 0.95, 0, { rz: 0.3 })),
      ];
      const head = [
        P(G.rbox(6.4, 3.0, 3.6, 1.0), g1, 2.6, 0.6, 0), P(G.rbox(3.0, 1.6, 3.0, 0.6), g1, 0.2, 2.0, 0),
        P(G.sph(0.5, 8), 0xffe14a, 1.3, 1.7, 1.75), P(G.sph(0.5, 8), 0xffe14a, 1.3, 1.7, -1.75),
        P(G.sph(0.24, 6), 0x111111, 1.55, 1.75, 2.1), P(G.sph(0.24, 6), 0x111111, 1.55, 1.75, -2.1),
        ...[0, 1, 2, 3, 4].flatMap((i) => [1.5, -1.5].map((zz) => P(G.cone(0.28, 0.9, 4), 0xfffbe8, 1.2 + i * 1.0, -1.2, zz, { rz: PI }))),
      ];
      const jaw = [
        P(G.rbox(5.4, 1.1, 3.1, 0.5), belly, 2.6, -0.3, 0), P(G.rbox(5.0, 0.3, 2.6, 0.1), 0xb8323a, 2.5, 0.3, 0),
        ...[0, 1, 2, 3].flatMap((i) => [1.25, -1.25].map((zz) => P(G.cone(0.25, 0.8, 4), 0xfffbe8, 1.4 + i * 1.0, 0.7, zz))),
      ];
      const grp = new T.Group(); grp.position.set(rx, 0, rz); grp.rotation.y = -ang;
      const tip = new T.Group(); grp.add(tip);
      tip.add(new T.Mesh(geoOf(body), paint));
      const hd = new T.Group(); hd.position.set(6.4, 14.4, 0); tip.add(hd);
      hd.add(new T.Mesh(geoOf(head), paint));
      const jw = new T.Group(); jw.position.set(0.4, -1.0, 0); hd.add(jw);
      jw.add(new T.Mesh(geoOf(jaw), paint));
      K.add(grp);
      K.contact(rx, rz, 8, 6, 0.45, ang);
      K.circle(rx, rz, 4.4, 14);
      A.rex = { tip, jw, x: b.x, z: b.z };
      A.bite = K.circle(b.x, b.z, 2.8, 0);
      // the scuffed target where the jaws come down
      K.mesh(new T.RingGeometry(REX.R - 0.9, REX.R - 0.3, 36), K.std({ color: 0x7a2a1c, roughness: 1, transparent: true, opacity: 0.6 }), b.x, 0.09, b.z, { rx: -PI / 2, cast: false });
      const marks = [];
      for (let i = 0; i < 12; i++) { const a = r() * 6.28, q = r.range(0.5, REX.R - 1.4); marks.push({ x: b.x + Math.cos(a) * q, y: 0.09, z: b.z + Math.sin(a) * q, ry: r() * 6, sx: r.range(0.6, 1.4), sy: 0.02, sz: 0.14, color: 0x6a4a2c }); }
      K.instances(G.box(1, 1, 1), stone, marks, { colors: true, cast: false });
    }

    // ---------------- the stegosaurus (centre): its spiked tail sweeps the inside of the road ----------------
    {
      const sT = sAt(-5, 17), tp = track.at(sT);
      const base = { x: STEG.x + 9.5, z: STEG.z };
      STEG.a0 = Math.atan2(tp.z - base.z, tp.x - base.x);
      const o1 = 0xd98a2b, o2 = 0xb5651d, pl = 0x8a3a2a;
      const body = [
        P(G.sph(1, 16), o1, 0, 5.2, 0, { sx: 9, sy: 4.4, sz: 4.4 }),
        P(G.sph(1, 10), 0xf0d9a0, 0, 4.2, 0, { sx: 7.6, sy: 3.2, sz: 3.8 }),
        ...[[-5, 2.6], [-5, -2.6], [5, 2.6], [5, -2.6]].map(([x, z]) => P(G.cap(1.25, 2.2), o2, x, 2.2, z)),
        P(G.cap(1.3, 4), o1, -10.2, 3.6, 0, { rz: PI / 2 - 0.5 }), P(G.rbox(3.6, 1.8, 2.2, 0.6), o1, -12.9, 2.3, 0),
        P(G.sph(0.3, 6), 0x111111, -13.6, 2.9, 1.0), P(G.sph(0.3, 6), 0x111111, -13.6, 2.9, -1.0),
        ...[0, 1, 2, 3, 4, 5, 6].map((i) => P(G.cone(1.7, 3.6 - Math.abs(i - 3) * 0.55, 4), pl, -6.6 + i * 2.2, 9.9 - Math.abs(i - 3) * 0.55, (i % 2 ? 0.6 : -0.6), { sz: 0.3 })),
      ];
      const ry = PI; // head to the west, tail to the road
      toy(body, paint, STEG.x, 0, STEG.z, ry);
      K.contact(STEG.x, STEG.z, 12, 6, 0.45);
      K.capsule(STEG.x - 13, STEG.z, STEG.x + 8, STEG.z, 4, 10);
      const tail = [
        P(G.cone(2.4, STEG.len, 10), o1, STEG.len / 2, 0, 0, { rz: -PI / 2, sz: 0.85 }),
        ...[0, 1].flatMap((i) => [1, -1].map((sg) => P(G.cone(0.42, 3.4, 6), 0xf6eed8, STEG.len - 1.6 - i * 2, 0.9, sg * 1.3, { rx: sg * 1.1 }))),
      ];
      A.tail = toy(tail, paint, base.x, 3.2, base.z, STEG.a0);
      K.mover({ type: 'capsule', r: 1.5, h: 6 }, (t) => { const a = tailA(t); return { x1: base.x, z1: base.z, x2: base.x + Math.cos(a) * (STEG.len - 1), z2: base.z + Math.sin(a) * (STEG.len - 1) }; });
    }

    // ---------------- the brachiosaurus: stands north of the road, neck arched over it ----------------
    {
      const p = track.at(sAt(4, -82));
      const x = p.x, z = p.z - 15.5, b1 = 0x4f8fb0, b2 = 0x3a6f8c;
      const parts = [
        P(G.sph(1, 16), b1, 0, 10.5, 0, { sx: 5.2, sy: 4.6, sz: 8 }),
        ...[[-3, -5], [3, -5], [-3, 5], [3, 5]].map(([xx, zz]) => P(G.cap(1.5, 6), b2, xx, 4.4, zz)),
        P(G.cone(2.4, 12, 10), b1, 0, 8.4, -12, { rx: -PI / 2 - 0.25 }),
      ];
      // the neck: an arc from the shoulders up and over the road, the head on the far side
      const N = 9;
      for (let i = 0; i <= N; i++) {
        const k = i / N, zz = 6 + k * 21, yy = 12.5 + Math.sin(k * PI * 0.82) * 9.5 - k * 2.5;
        parts.push(P(G.sph(1, 10), i % 2 ? b1 : b2, 0, yy, zz, { sx: 2.3 - k * 0.9, sy: 2.3 - k * 0.9, sz: 2.2 }));
      }
      parts.push(P(G.rbox(2.6, 2.2, 4.4, 0.8), b1, 0, 14.6, 29.4), P(G.sph(0.3, 6), 0x111111, 1.25, 15.2, 29.8), P(G.sph(0.3, 6), 0x111111, -1.25, 15.2, 29.8));
      toy(parts, paint, x, 0, z, 0);
      K.contact(x, z, 7, 10, 0.45);
      K.box(x, z, 5, 7.5, 0, 9);
      // the tree it is eating, south of the road
      toy([P(G.cyl(1, 1.5, 11, 8), 0x7a5632, 0, 5.5, 0), P(G.sph(4.6, 10), 0x2f8f3c, 0, 13, 0, { sy: 0.7 }), P(G.sph(3.2, 10), 0x49b050, 1.5, 15, 1, { sy: 0.7 })], matte, x + 2, 0, z + 31.5);
      K.circle(x + 2, z + 31.5, 1.6, 12); K.contact(x + 2, z + 31.5, 4, 4, 0.4);
    }

    // ---------------- the rib cage over the west straight ----------------
    {
      const s0 = sAt(-128, 2), ribs = [];
      for (let i = -2; i <= 2; i++) {
        const p = track.at(s0 + i * 4.2), R = W / 2 + 2.6 - Math.abs(i) * 0.5;
        ribs.push(P(G.tor(R, 0.55, PI, 18), 0xf3ecd9, p.x, 0, p.z, { ry: -p.angle + PI / 2, sy: 0.92 }));
        for (const sd of [-1, 1]) { const q = track.place(s0 + i * 4.2, sd * R); K.circle(q.x, q.z, 0.9, 6); }
      }
      const pa = track.at(s0 - 10), pb = track.at(s0 + 10), R0 = (W / 2 + 2.6) * 0.92;
      ribs.push(P(G.cyl(0.8, 0.8, 21, 8), 0xe9dfc6, (pa.x + pb.x) / 2, R0, (pa.z + pb.z) / 2, { rz: PI / 2, ry: -track.at(s0).angle }));
      toy(ribs, matte);
    }

    // ---------------- the tar pit in the north-east bend ----------------
    {
      const s = sAt(62, -57), q = track.place(s, 3.2);
      const tar = K.phys({ color: 0x0e0c0b, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
      const sp = K.spill(q.x, q.z, 6.2, tar, { lump: 0.4, stretch: 1.4, angle: q.angle, y: 0.12, thick: 0.2 });
      K.surface('sticky', { poly: sp.poly });
      const bub = [];
      for (let i = 0; i < 7; i++) bub.push({ x: q.x + r.range(-4, 4), y: 0.12, z: q.z + r.range(-3, 3), s: r.range(0.4, 0.9), sy: 0.35 });
      K.instances(G.sph(1, 10), tar, bub, { cast: false });
      // a tiny mammoth-tusk skull sinking at the edge
      const e = track.place(s, 11.5);
      toy([P(G.sph(1.6, 10), 0xeee6d0, 0, 0.9, 0, { sy: 0.7 }), P(G.tor(1.8, 0.28, PI * 0.8, 10), 0xf7f1e0, 1.4, 0.8, 0.9, { rx: PI / 2 }), P(G.tor(1.8, 0.28, PI * 0.8, 10), 0xf7f1e0, 1.4, 0.8, -0.9, { rx: PI / 2 })], matte, e.x, 0, e.z, r() * 6);
    }

    // ---------------- the lake (west infield) and a triceratops drinking ----------------
    {
      const water = K.phys({ color: 0x3fa7d6, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
      const sp = K.spill(-104, 6, 10, water, { lump: 0.3, stretch: 1.25, angle: 1.4, y: 0.1, thick: 0.12 });
      K.surface('water', { poly: sp.poly });
      const t1 = 0xb86a4a, t2 = 0x8f4e36;
      toy([
        P(G.sph(1, 14), t1, 0, 3.6, 0, { sx: 5.2, sy: 3, sz: 3 }),
        ...[[-3, 1.9], [-3, -1.9], [3, 1.9], [3, -1.9]].map(([x, z]) => P(G.cap(0.95, 1.4), t2, x, 1.5, z)),
        P(G.cone(1.6, 6, 8), t1, -6.4, 3.2, 0, { rz: PI / 2 + 0.2 }),
        P(G.rbox(3.4, 2.6, 2.8, 0.8), t1, 6, 3, 0), P(G.cyl(3.4, 3.4, 0.6, 14), t2, 4.6, 4.4, 0, { rz: PI / 2 - 0.5 }),
        P(G.cone(0.4, 2.6, 6), 0xf7f1e0, 6.8, 5, 1, { rz: -0.9 }), P(G.cone(0.4, 2.6, 6), 0xf7f1e0, 6.8, 5, -1, { rz: -0.9 }), P(G.cone(0.4, 1.3, 6), 0xf7f1e0, 7.9, 3.4, 0, { rz: -0.9 }),
      ], paint, -100, 0, 21, -1.2);
      K.circle(-100, 21, 5, 6); K.contact(-100, 21, 7, 5, 0.4, -1.2);
    }

    // ---------------- a pterodactyl on a wire stand (east infield) ----------------
    {
      const x = 46, z = 34, pc = 0x8f5fb8;
      toy([
        P(G.cyl(3, 3.4, 0.8, 16), 0x3a3a3a, 0, 0.4, 0), P(G.cyl(0.18, 0.18, 12, 6), 0xb8b8b8, 0, 6.5, 0),
        P(G.sph(1, 10), pc, 0, 13, 0, { sx: 2.6, sy: 1, sz: 1.1 }),
        P(G.cone(0.7, 4.6, 6), pc, 3.6, 13.3, 0, { rz: -PI / 2 }), P(G.cone(0.5, 3, 5), 0xe07a2a, 0.6, 13.9, 0, { rz: PI / 2 + 0.5 }),
        P(G.cone(3.2, 9, 3), 0xb48ad6, -0.3, 13, 4.6, { rx: PI / 2, sx: 1, sz: 0.12 }), P(G.cone(3.2, 9, 3), 0xb48ad6, -0.3, 13, -4.6, { rx: -PI / 2, sx: 1, sz: 0.12 }),
      ], paint, x, 0, z, 0.5);
      K.circle(x, z, 3.4, 2); K.contact(x, z, 4.5, 4.5, 0.4);
    }

    // ---------------- the raided nest: eggs that roll about ----------------
    {
      const s = 186, n = track.place(s, -(W / 2 + 4.5));
      K.mesh(G.tor(3.4, 1.1, PI * 2, 14), K.std({ color: 0x8a6a3a, roughness: 1 }), n.x, 0.5, n.z, { rx: PI / 2 });
      K.contact(n.x, n.z, 5, 5, 0.4);
      const eggGeo = G.sph(1.25, 12); eggGeo.scale(1, 1.25, 1);
      const eggMat = K.plastic(0xf4efd9, 0.4);
      for (let i = 0; i < 6; i++) {
        const q = i < 2 ? { x: n.x + (i ? 1.2 : -1.2), z: n.z } : track.place(s + r.range(-12, 16), r.range(-6.5, 6.5));
        const m = K.mesh(eggGeo, eggMat, q.x, 1.3, q.z, { rz: PI / 2 });
        if (i >= 2) K.physics.addDynamic({ x: q.x, z: q.z, r: 1.3, m: 0.35, h: 2.6, mesh: m, friction: 9, baseY: 1.3 });
      }
    }

    // ---------------- crayons and a toy magnifying glass left on the mat ----------------
    {
      const cr = [];
      const spots = [[-56, 58, 0.3], [-48, 62, -0.5], [20, -50, 1.1], [128, 84, 0.2], [-140, -92, 0.9], [70, 8, -0.3]];
      spots.forEach(([x, z, a], i) => { if (K.offRoad(x, z, 6)) { cr.push({ x, y: 0.55, z, ry: a, rz: PI / 2, color: [0xe8443a, 0x2f6fe0, 0xf5d331, 0x9a5cc7, 0xf59a23, 0x6fc04b][i] }); K.capsule(x - Math.cos(a) * 4, z + Math.sin(a) * 4, x + Math.cos(a) * 4, z - Math.sin(a) * 4, 0.6, 1.2); } });
      K.instances(G.cyl(0.55, 0.55, 9, 10), K.plastic(0xffffff, 0.5), cr, { colors: true });
    }
  },

  tick(dt, time, game) {
    if (!A || !A.bite) return;
    const u = rexU(time);
    A.bite.h = u > 1.45 && u < 2.4 ? 8 : 0;
    if (fired(A.prevT, time, REX.period, REX.phase + 1.45)) {
      blast(game, A.rex.x, A.rex.z, REX.R, 15, { shake: 0.35 });
      if (game.sound) game.sound.cue('snap', { x: A.rex.x, z: A.rex.z, game });
    }
    A.prevT = time;
  },

  animate(time) {
    if (!A || !A.rex) return;
    const p = rexPose(rexU(time));
    A.rex.tip.rotation.z = p.pitch;
    A.rex.jw.rotation.z = -p.jaw * 0.55;
    A.tail.rotation.y = -tailA(time);
  },
};
