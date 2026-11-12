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
  bounds: { minX: -186, maxX: 186, minZ: -136, maxZ: 136 },
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
    const TM = tmTools(K);
    const { G, P, toy, wedge, table, road, startLine, edges, scatter, sAt, geoOf } = TM;
    A = { prevT: null, rex: null, tail: null, bite: null };
    const paint = K.plastic(0xffffff, 0.5, { vertexColors: true });
    const matte = K.std({ color: 0xffffff, roughness: 0.9, vertexColors: true });
    const stone = K.std({ color: 0xffffff, roughness: 0.9 });

    // ---------------- table, felt mat, road ----------------
    table({ w: 380, d: 280, wood: [0xc79a62, 0x8a5a30, 0xe3bd86], floorA: '#d8cdb8', floorB: '#b9c7cf' });
    const felt = TX.feltTextures({ size: 512, color: 0x5d9b4a, seed: 21 });
    for (const t of Object.values(felt)) t.repeat.set(12, 8.5);
    // the play mat's print: jungle and sand, a dirt shoulder along the road, a stream and a pond, place names
    const MAT = { x0: -150, z0: -106, w: 300, d: 212, seed: 41 };
    const print = TM.groundCanvas(MAT, (g, C) => {
      const cw = g.canvas.width, ch = g.canvas.height;
      g.fillStyle = '#5f9d4c'; g.fillRect(0, 0, cw, ch);
      C.mottle(240, ['#55913f', '#69a852', '#4f8a3c', '#74b05b'], 5, 16, 0.35);
      C.mottle(18, ['#3f7d3a'], 9, 19, 0.5);
      for (const [x, z, rad] of [[92, 30, 17], [-22, 15, 15], [4, -98, 12], [-104, 6, 17], [120, -80, 31], [40, 34, 9], [-60, -72, 11]]) C.blob(x, z, rad, '#cdb680', 0.55, 0.35);
      C.band(W + 1, 6, '#c9ad78', 0.8);
      const stream = [[18, -24], [26, -12], [38, -2], [46, 10], [58, 18]];
      C.line(stream, 4.4, '#cdb680', 0.8); C.line(stream, 3, '#8fd3e8', 0.95); C.line(stream, 1.5, '#5db9dc', 0.95);
      C.blob(62, 22, 9.5, '#cdb680', 0.8, 0.25); C.blob(62, 22, 8.2, '#8fd3e8', 0.95, 0.25); C.blob(62, 22, 6.2, '#5db9dc', 0.95, 0.25);
      g.strokeStyle = '#3f8438'; g.lineWidth = 1; g.globalAlpha = 0.5;
      for (let i = 0; i < 1500; i++) { const x = C.rr() * cw, y = C.rr() * ch; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (C.rr() - 0.5) * 5, y - 3 - C.rr() * 5); g.stroke(); }
      g.globalAlpha = 1;
      C.dots(520, ['#f6e27a', '#ffffff', '#f4a6c0', '#e8e0c8'], 0.18, 0.4, 0.8);
      C.dots(260, ['#8a8478', '#b5ab98', '#9a948a'], 0.2, 0.55, 0.7);
      const lab = (t, x, z, sz = 4, ang = 0) => C.text(t, x, z, sz, '#2c6332', { alpha: 0.75, ang, spacing: 0.6 });
      lab('DINO VALLEY', 0, 97.5, 6.4); lab('T-REX RIDGE', 44, 56); lab('TAR PITS', 30, -38, 3.6, -0.5); lab('MT. KABOOM', 84, -97, 3.8);
      lab('STEGO MEADOW', -56, -2, 3.4, 0.25); lab('FERN GULLY', -58, -92, 3.6); lab('BONE YARD', -139.5, 30, 3.2, -Math.PI / 2);
      // a compass rose in the south-west corner
      g.save(); g.translate(C.X(-136), C.Z(92)); g.strokeStyle = g.fillStyle = '#2c6332'; g.globalAlpha = 0.75; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 5 * C.ppu, 0, 7); g.stroke();
      for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -6.4 * C.ppu); g.lineTo(1.3 * C.ppu, 0); g.lineTo(-1.3 * C.ppu, 0); g.fill(); }
      g.font = `${4 * C.ppu}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.fillText('N', 0, -7.4 * C.ppu); g.restore();
      C.border(1.2, 2.6, '#2f6a35', '#f3e9c8');
    });
    K.mesh(TM.groundUV(new T.BoxGeometry(300, 0.3, 212), 0, 0, MAT), K.std({ map: print.texture(), normalMap: felt.normalMap, roughness: 1 }), 0, -0.15, 0, { cast: false });
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
      const m = K.mesh(wedge(len, h, 2.2, W + 1.5), K.std({ color: 0x8f673a, roughness: 1 }), p.x, 0.02, p.z);
      m.rotation.y = -p.angle;
      // two half-buried logs hold the hump's lip
      for (const side of [-1, 1]) {
        const q = track.place(s + len / 2 + 0.6, side * (W / 2 + 2.2));
        K.mesh(G.cyl(1.25, 1.5, 2.6, 10), K.std({ color: 0x6d4a2b, roughness: 0.95 }), q.x, 1.3, q.z);
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
      // computer drivers keep out of the jaws' reach while they come down
      A.haz = [{ s: sB, lo: side * 3.6 - 5.2, hi: side * 3.6 + 5.2, busy: (t) => { const u = rexU(t); return u > 1.2 && u < 2.45; } }];
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
      toy(body, paint, STEG.x, 0, STEG.z, 0); // head to the west (local -x), the tail towards the road
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
      ];
      // the neck: an arc from the shoulders up and over the road, the head on the far side; its own mesh, hinged
      // at the shoulders, so it can sway and dip to the tree
      const N = 15, neck = [], SH = { y: 12.5, z: 6 };
      for (let i = 0; i <= N; i++) {
        const k = i / N, zz = k * 21, yy = Math.sin(k * PI * 0.82) * 9.5 - k * 2.5;
        neck.push(P(G.sph(1, 10), i % 2 ? b1 : b2, 0, yy, zz, { sx: 2.3 - k * 0.9, sy: 2.3 - k * 0.9, sz: 2.2 }));
      }
      neck.push(P(G.rbox(3.4, 2.6, 5.4, 1), b1, 0, 2.3, 23.6), P(G.sph(0.5, 6), 0xffffff, 1.3, 3.5, 24.6), P(G.sph(0.5, 6), 0xffffff, -1.3, 3.5, 24.6), P(G.sph(0.26, 6), 0x111111, 1.4, 3.8, 24.9), P(G.sph(0.26, 6), 0x111111, -1.4, 3.8, 24.9), P(G.rbox(2.6, 0.5, 3, 0.2), b2, 0, 0.9, 24.4));
      toy(parts, paint, x, 0, z, 0);
      A.neck = toy(neck, paint, x, SH.y, z + SH.z, 0);
      // its tail swishes too
      A.btail = toy([P(G.cone(2.2, 11, 10), b1, 0, 0, -5.5, { rx: -PI / 2 - 0.2 })], paint, x, 9, z - 7, 0);
      K.contact(x, z, 7, 10, 0.45);
      K.box(x, z, 5, 7.5, 0, 9);
      // the tree it is eating, south of the road
      toy([P(G.cyl(1, 1.5, 11, 8), 0x7a5632, 0, 5.5, 0), P(G.sph(4.6, 10), 0x2f8f3c, 0, 13, 0, { sy: 0.7 }), P(G.sph(3.2, 10), 0x49b050, 1.5, 15, 1, { sy: 0.7 })], matte, x + 4, 0, z + 36.5, 0, { scale: 0.8 });
      K.circle(x + 4, z + 36.5, 1.4, 10); K.contact(x + 4, z + 36.5, 3.4, 3.4, 0.4);
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
      // the rest of the skeleton: the skull on the west side of the road, tail vertebrae on the east
      const pc = track.at(s0), ax = Math.cos(pc.angle), az = Math.sin(pc.angle);
      for (let i = 0; i < 4; i++) { const d = -(W / 2 + 4 + i * 2); ribs.push(P(G.sph(0.9 - i * 0.12, 6), 0xe9dfc6, pc.x + pc.nx * d, 0.7, pc.z + pc.nz * d)); }
      const hd = W / 2 + 6.5;
      ribs.push(P(G.rbox(5.4, 2.6, 3.4, 0.9), 0xf3ecd9, pc.x + pc.nx * hd, 1.3, pc.z + pc.nz * hd, { ry: -pc.angle + PI / 2 }), P(G.sph(0.7, 6), 0x2a2620, pc.x + pc.nx * hd + ax * 1.3, 2.3, pc.z + pc.nz * hd + az * 1.3), P(G.sph(0.7, 6), 0x2a2620, pc.x + pc.nx * hd - ax * 1.3, 2.3, pc.z + pc.nz * hd - az * 1.3));
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
      ], paint, -95, 0, 27, -1.95);
      K.circle(-95, 27, 5, 6); K.contact(-95, 27, 7, 5, 0.4, -1.95);
    }

    // ---------------- a pterodactyl on a wire stand (east infield) ----------------
    {
      const x = 46, z = 34, pc = 0x8f5fb8;
      toy([P(G.cyl(3, 3.4, 0.8, 16), 0x3a3a3a, 0, 0.4, 0), P(G.cyl(0.18, 0.18, 12, 6), 0xb8b8b8, 0, 6.5, 0)], paint, x, 0, z, 0.5);
      A.ptero = toy([
        P(G.sph(1, 10), pc, 0, 0, 0, { sx: 2.6, sy: 1, sz: 1.1 }),
        P(G.cone(0.7, 4.6, 6), pc, 3.6, 0.3, 0, { rz: -PI / 2 }), P(G.cone(0.5, 3, 5), 0xe07a2a, 0.6, 0.9, 0, { rz: PI / 2 + 0.5 }),
        P(G.cone(3.2, 9, 3), 0xb48ad6, -0.3, 0, 4.6, { rx: PI / 2, sx: 1, sz: 0.12 }), P(G.cone(3.2, 9, 3), 0xb48ad6, -0.3, 0, -4.6, { rx: -PI / 2, sx: 1, sz: 0.12 }),
      ], paint, x, 13, z, 0.5);
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

    // ---------------- more life on the mat: raptors, boulders, footprints, reeds, a lava stream ----------------
    {
      const rp = (c1, c2) => [P(G.sph(1, 10), c1, 0, 2.6, 0, { sx: 2.4, sy: 1.1, sz: 1 }), P(G.cone(0.8, 4.4, 6), c1, -3.6, 2.9, 0, { rz: PI / 2 + 0.15 }), P(G.cap(0.5, 1.4), c1, 2, 3.8, 0, { rz: -0.7 }), P(G.rbox(2, 1, 0.9, 0.3), c2, 3.2, 4.7, 0), P(G.cap(0.35, 1.5), c2, 0.2, 1, 0.6), P(G.cap(0.35, 1.5), c2, 0.2, 1, -0.6), P(G.sph(0.16, 5), 0x111111, 3.5, 5, 0.45), P(G.sph(0.16, 5), 0x111111, 3.5, 5, -0.45)];
      const rg = geoOf(rp(0xc9573a, 0xe8b23a));
      const pack = [];
      for (const [x, z, a] of [[30, 6, 0.4], [37, 12, 0.2], [26, 15, 0.7], [-54, 62, -0.3], [-46, 66, -0.1], [-100, -30, 1.2], [70, 52, -2.6], [78, 46, -2.4]]) if (K.offRoad(x, z, 4)) { pack.push({ x, y: 0, z, ry: -a, s: r.range(0.9, 1.15) }); K.circle(x, z, 1.6, 4); K.contact(x, z, 3, 2, 0.35, a); }
      K.instances(rg, paint, pack);
      // boulders you cannot drive through
      const big = [];
      for (let i = 0, t = 0; i < 9 && t < 300; t++) {
        const x = r.range(-140, 140), z = r.range(-98, 98);
        if (!K.offRoad(x, z, 7) || !K.offRoad(x, z - 4, 3) || big.some((b) => Math.hypot(b.x - x, b.z - z) < 30)) continue;
        const sz = r.range(2.6, 4.2); big.push({ x, y: sz * 0.45, z, ry: r() * 6, rx: r() * 0.5, s: sz, sy: sz * 0.7, color: r.pick(stoneCols) });
        K.circle(x, z, sz * 0.9, sz * 1.4); K.contact(x, z, sz * 1.4, sz * 1.4, 0.4); i++;
      }
      K.instances(G.ico(1), stone, big, { colors: true });
      // three-toed footprints wandering across the mat
      const print = geoOf([P(G.box(0.5, 0.02, 1.5), 0x3f7d3a, 0.9, 0, 0, { ry: 0 }), P(G.box(1.6, 0.02, 0.45), 0x3f7d3a, 0.2, 0, 0.55, { ry: -0.5 }), P(G.box(1.6, 0.02, 0.45), 0x3f7d3a, 0.2, 0, -0.55, { ry: 0.5 }), P(G.box(1.7, 0.02, 0.45), 0x3f7d3a, 0.3, 0, 0)]);
      const prints = [];
      for (const [x0, z0, a0, n] of [[-60, -90, 0.5, 16], [20, -30, 2.4, 14], [130, 60, 2.9, 14], [-140, 80, -0.6, 10]]) {
        let x = x0, z = z0, a = a0;
        for (let i = 0; i < n; i++) { a += r.range(-0.25, 0.25); x += Math.cos(a) * 4.6; z += Math.sin(a) * 4.6; if (Math.abs(x) < 146 && Math.abs(z) < 102 && K.offRoad(x, z, 1)) prints.push({ x: x - Math.sin(a) * (i % 2 ? 1.3 : -1.3), y: 0.04, z: z + Math.cos(a) * (i % 2 ? 1.3 : -1.3), ry: -a, s: 1.25 }); }
      }
      K.instances(print, matte, prints, { cast: false });
      // reeds round the lake
      const reeds = [];
      for (let i = 0; i < 34; i++) { const a = r() * 6.28, d = r.range(10.5, 14); const x = -104 + Math.cos(a) * d * 0.85, z = 6 + Math.sin(a) * d * 1.2; if (K.offRoad(x, z, 1.5)) reeds.push({ x, y: 1.6, z, rz: r.range(-0.2, 0.2), rx: r.range(-0.2, 0.2), sy: r.range(0.7, 1.3), color: r.pick([0x4f9a3f, 0x6fb04a, 0x3f8a3a]) }); }
      K.instances(G.cyl(0.14, 0.2, 3.2, 5), stone, reeds, { colors: true });
      // lava running down from the volcano into a pool
      const lava = K.std({ color: 0xff6a1f, emissive: 0xff3a08, emissiveIntensity: 0.9, roughness: 0.35 });
      for (const [x, z, rad, st, an] of [[100, -68, 4.2, 2.2, 0.5], [93, -62, 5.5, 1.2, 0.3]]) K.spill(x, z, rad, lava, { lump: 0.35, stretch: st, angle: an, y: 0.1, thick: 0.12 });
      K.surface('slow', { x: 93, z: -62, r: 5 });
    }

    // ---------------- crayons and a toy magnifying glass left on the mat ----------------
    {
      const cr = [];
      const spots = [[-56, 58, 0.3], [-48, 62, -0.5], [20, -50, 1.1], [128, 84, 0.2], [-140, -92, 0.9], [70, 8, -0.3]];
      spots.forEach(([x, z, a], i) => { if (K.offRoad(x, z, 6)) { cr.push({ x, y: 0.55, z, ry: a, rz: PI / 2, color: [0xe8443a, 0x2f6fe0, 0xf5d331, 0x9a5cc7, 0xf59a23, 0x6fc04b][i] }); K.capsule(x - Math.cos(a) * 4, z + Math.sin(a) * 4, x + Math.cos(a) * 4, z - Math.sin(a) * 4, 0.6, 1.2); } });
      K.instances(G.cyl(0.55, 0.55, 9, 10), K.plastic(0xffffff, 0.5), cr, { colors: true });
    }
    // ================= detail pass: start line, more dinosaurs, small life, things left on the table =================
    {
      TM.signBoard(-14, 65, 'DINO DASH', { w: 26, h: 5.6, bg: '#8a5a30', fg: '#ffe9a8', edge: '#5e3c22' });
      TM.bunting(41.5, [0xe8443a, 0xf5d331, 0x2f6fe0, 0x6fc04b, 0xf59a23], { post: 0xf1ead8, mat: paint });
      // the stretch the stegosaurus's tail sweeps, scuffed into the road
      const bx = STEG.x + 9.5, bz = STEG.z;
      K.mesh(new T.RingGeometry(4, STEG.len + 0.8, 28, 1, -(STEG.a0 + STEG.swing + 0.12), 2 * STEG.swing + 0.24), K.std({ color: 0x6a4a2c, roughness: 1, transparent: true, opacity: 0.4, depthWrite: false }), bx, 0.085, bz, { rx: -PI / 2, cast: false });

      // an ankylosaurus in the north-west, two parasaurolophus drinking at the lake
      const a1 = 0x8a8f4a, a2 = 0x6a6f34;
      toy([
        P(G.sph(1, 14), a1, 0, 2.6, 0, { sx: 5.4, sy: 2.2, sz: 3.7 }),
        ...[-3, -1.5, 0, 1.5, 3].flatMap((x) => [-1.6, 0, 1.6].map((z) => P(G.cone(0.55, 1.2, 5), a2, x, 4.6 - Math.abs(z) * 0.3 - Math.abs(x) * 0.12, z))),
        ...[[-3, 2.4], [-3, -2.4], [3, 2.4], [3, -2.4]].map(([x, z]) => P(G.cap(0.8, 1), a2, x, 1.1, z)),
        P(G.cone(1.3, 6.4, 8), a1, -7.6, 2.3, 0, { rz: PI / 2 }), P(G.sph(1.5, 8), a2, -11, 2.2, 0, { sx: 1.2 }),
        P(G.rbox(3, 2, 2.6, 0.7), a1, 6.2, 2.3, 0), P(G.sph(0.22, 5), 0x111111, 7.2, 3.1, 1), P(G.sph(0.22, 5), 0x111111, 7.2, 3.1, -1),
      ], paint, -60, 0, -72, 0.3);
      K.capsule(-66, -73.8, -55, -70.4, 3.6, 5); K.contact(-60, -72, 8, 5, 0.4, 0.3);
      const para = (c1, c2) => [
        P(G.sph(1, 12), c1, 0, 5.2, 0, { sx: 4, sy: 2.4, sz: 2 }), P(G.cone(1.4, 7.5, 8), c1, -6.4, 5, 0, { rz: PI / 2 + 0.15 }),
        P(G.cap(0.85, 3.4), c1, 3.6, 5.2, 0, { rz: -1.25 }), P(G.rbox(3, 1.4, 1.4, 0.5), c1, 6.6, 3.2, 0, { rz: -0.5 }), P(G.cone(0.5, 3.4, 6), c2, 4.6, 5.1, 0, { rz: 1.9 }),
        P(G.cap(0.8, 2.6), c2, -0.6, 2.2, 1.1), P(G.cap(0.8, 2.6), c2, -0.6, 2.2, -1.1), P(G.cap(0.4, 1.6), c2, 2.4, 2.6, 0.9, { rz: -0.5 }), P(G.cap(0.4, 1.6), c2, 2.4, 2.6, -0.9, { rz: -0.5 }),
        P(G.sph(0.2, 5), 0x111111, 6.9, 3.6, 0.6), P(G.sph(0.2, 5), 0x111111, 6.9, 3.6, -0.6),
      ];
      for (const [x, z, a, sc, c1, c2] of [[-108, -15, 1.45, 1, 0x3fa7a0, 0xf59a23], [-98, -17, 1.75, 0.72, 0x55b8b0, 0xf5b84a]]) {
        if (!K.offRoad(x, z, 6)) continue;
        toy(para(c1, c2), paint, x, 0, z, a, { scale: sc }); K.circle(x, z, 3.2 * sc, 8); K.contact(x, z, 6 * sc, 3.4 * sc, 0.4, a);
      }
      // hatchlings and broken shells at the nest
      {
        const n = track.place(186, -(W / 2 + 4.5)), sh = [];
        for (const [dx, dz, a] of [[2.6, 2.2, 0.3], [-2.8, 1.6, 2], [0.6, -3.2, 4]]) sh.push(P(G.sph(1.1, 8), 0xf4efd9, n.x + dx, 0.3, n.z + dz, { sy: 0.55, ry: a }), P(G.sph(0.55, 6), 0x8fd06a, n.x + dx, 1.0, n.z + dz), P(G.sph(0.12, 4), 0x111111, n.x + dx + 0.3, 1.2, n.z + dz + 0.42), P(G.sph(0.12, 4), 0x111111, n.x + dx - 0.3, 1.2, n.z + dz + 0.42));
        toy(sh, paint);
      }
      // fallen logs, mushrooms, flowers, tufts of grass
      const log = geoOf([P(G.cyl(1.15, 1.25, 9, 9), 0x7a5632, 0, 1.15, 0, { rz: PI / 2 }), P(G.cyl(0.95, 0.95, 9.1, 9), 0xd9b98a, 0, 1.15, 0, { rz: PI / 2 }), P(G.cyl(0.5, 0.4, 1.6, 6), 0x7a5632, 1.5, 2.1, 0.5, { rx: 0.5 })]);
      const logs = [];
      for (const [x, z, a] of [[-14, -44, 0.4], [72, -8, 1.2], [18, 62, -0.3], [-58, 16, 0.9], [112, 84, 0.1], [-112, -88, -0.4], [50, -98, 0.2], [-140, 60, 1.4]]) {
        if (!K.offRoad(x, z, 7)) continue;
        logs.push({ x, y: 0, z, ry: -a }); K.capsule(x - Math.cos(a) * 3.6, z - Math.sin(a) * 3.6, x + Math.cos(a) * 3.6, z + Math.sin(a) * 3.6, 1.2, 2.4); K.contact(x, z, 6, 2.2, 0.4, a);
      }
      K.instances(log, matte, logs);
      const shroom = geoOf([P(G.cyl(0.22, 0.3, 0.9, 6), 0xf3ecd9, 0, 0.45, 0), P(G.sph(0.7, 8), 0xd8423a, 0, 0.95, 0, { sy: 0.6 }), P(G.sph(0.14, 4), 0xffffff, 0.3, 1.28, 0.2), P(G.sph(0.14, 4), 0xffffff, -0.25, 1.3, -0.2)]);
      scatter(shroom, matte, 46, [-146, 146, -102, 102], 2, (x, z) => ({ x, y: 0, z, ry: r() * 6, s: r.range(0.7, 1.4) }));
      scatter(G.sph(0.45, 6), stone, 170, [-146, 146, -102, 102], 1.6, (x, z) => ({ x, y: 0.3, z, s: r.range(0.6, 1.1), sy: 0.6, color: r.pick([0xf6e27a, 0xffffff, 0xf4a6c0, 0xff9a5a, 0xc9a0f0]) }), { cast: false });
      const tuft = geoOf([-0.35, 0, 0.35].map((o, i) => P(G.cone(0.22, 1.5 + i * 0.3, 4), i === 1 ? 0x6fb04a : 0x4f9a3f, o, 0.8, (i - 1) * 0.2, { rz: -o * 0.6 })));
      scatter(tuft, matte, 300, [-146, 146, -102, 102], 1.2, (x, z) => ({ x, y: 0, z, ry: r() * 6, s: r.range(0.7, 1.5) }), { cast: false });

      // the volcano glows and smokes; dragonflies over the lake
      A.lavaMat = K.std({ color: 0xff8a2a, emissive: 0xff4a10, emissiveIntensity: 1.4, roughness: 0.4 });
      K.mesh(G.sph(3.6, 12), A.lavaMat, 120, 22.6, -80, { cast: false });
      A.puffs = [0, 1, 2, 3].map(() => K.mesh(G.sph(1, 10), K.std({ color: 0xf2efe8, roughness: 1, transparent: true, opacity: 0.8 }), 120, 30, -80, { cast: false }));
      const fly = geoOf([P(G.cyl(0.09, 0.05, 1.6, 4), 0x2a6fd0, 0, 0, 0, { rz: PI / 2 }), P(G.box(0.5, 0.02, 2.2), 0xcfeeff, 0.3, 0.05, 0), P(G.box(0.4, 0.02, 1.8), 0xcfeeff, -0.2, 0.05, 0)]);
      A.flies = [0, 1, 2, 3, 4, 5].map((i) => ({ m: K.add(new T.Mesh(fly, paint)), cx: i < 4 ? -104 + r.range(-4, 4) : 62, cz: i < 4 ? 6 + r.range(-6, 6) : 22, rad: r.range(3, 7), sp: r.range(1.2, 2.2) * (i % 2 ? 1 : -1), ph: r() * 6, y: r.range(2, 4.5) }));
    }

    // ================= what was left lying on the table round the mat =================
    {
      const book = TM.flat(-168, -44, 28, 36, (g, w, h) => {
        g.fillStyle = '#2f8a4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6d84a'; g.fillRect(0, 0, w, h * 0.2);
        g.fillStyle = '#1e5a30'; g.textAlign = 'center'; g.font = `${Math.round(h * 0.085)}px "Lilita One", sans-serif`; g.fillText('MY BIG BOOK OF', w / 2, h * 0.09); g.font = `${Math.round(h * 0.11)}px "Lilita One", sans-serif`; g.fillText('DINOSAURS', w / 2, h * 0.18);
        g.fillStyle = '#f59a23'; g.beginPath(); g.ellipse(w * 0.5, h * 0.62, w * 0.3, h * 0.12, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(w * 0.78, h * 0.47, w * 0.1, h * 0.05, -0.5, 0, 7); g.fill(); g.fillRect(w * 0.68, h * 0.48, w * 0.08, h * 0.12);
        g.beginPath(); g.moveTo(w * 0.24, h * 0.6); g.lineTo(w * 0.04, h * 0.7); g.lineTo(w * 0.26, h * 0.68); g.fill();
        g.fillRect(w * 0.36, h * 0.68, w * 0.07, h * 0.14); g.fillRect(w * 0.58, h * 0.68, w * 0.07, h * 0.14);
        g.fillStyle = '#d8423a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(w * (0.3 + i * 0.07), h * 0.52); g.lineTo(w * (0.335 + i * 0.07), h * 0.44); g.lineTo(w * (0.37 + i * 0.07), h * 0.52); g.fill(); }
        g.fillStyle = '#111'; g.beginPath(); g.arc(w * 0.8, h * 0.46, w * 0.012, 0, 7); g.fill();
      }, { thick: 2.6, ang: 0.12, edge: 0xf3ecd9 });
      void book; K.box(-168, -44, 14, 18, 0.12, 2.6); K.contact(-168, -44, 16, 20, 0.35, 0.12);
      // a tub of spare dinosaurs, a cup of juice with a straw
      toy([P(G.cyl(13, 11, 15, 22), 0xf5c531, 0, 7.5, 0), P(G.cyl(13.6, 13.6, 1.2, 22), 0xf59a23, 0, 15, 0), P(G.cyl(12, 12, 0.3, 22), 0x3a3a3a, 0, 14.8, 0),
        P(G.cone(1.6, 9, 8), 0x6f9a3a, -4, 17, 2, { rz: 0.5 }), P(G.sph(2.6, 10), 0xd98a2b, 3, 16, -3, { sy: 0.8 }), P(G.cone(1.2, 6, 6), 0x4f8fb0, 5, 18, 4, { rz: -0.6 }), P(G.rbox(4, 2.4, 2.4, 0.7), 0xc9573a, -5, 16.4, -5, { ry: 0.6 })], paint, 169, 0, -52);
      K.circle(169, -52, 13.6, 20); K.contact(169, -52, 16, 16, 0.4);
      toy([P(G.cyl(7.6, 6.2, 17, 20), 0xd8ecf5, 0, 8.5, 0), P(G.cyl(7, 7, 0.3, 20), 0xf59a23, 0, 14.5, 0), P(G.cyl(0.6, 0.6, 24, 8), 0xe8443a, 2, 14, 0, { rz: -0.25 }), P(G.cyl(0.62, 0.62, 2, 8), 0xffffff, 3.6, 20.4, 0, { rz: -0.25 })], paint, 169, 0, 46);
      K.circle(169, 46, 7.8, 20); K.contact(169, 46, 10, 10, 0.4);
      // crayons and their box, a drawing, a ruler, a magnifying glass
      TM.flat(-168, 44, 20, 28, (g, w, h) => { g.fillStyle = '#f5c531'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f8a4a'; g.fillRect(0, 0, w, h * 0.24); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `${Math.round(h * 0.11)}px "Lilita One", sans-serif`; g.fillText('CRAYONS', w / 2, h * 0.16); const cs = ['#e8443a', '#f59a23', '#f5d331', '#6fc04b', '#2f6fe0', '#9a5cc7']; cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(w * (0.08 + i * 0.145), h * 0.34, w * 0.11, h * 0.58); }); }, { thick: 3, ang: -0.2, edge: 0xf5c531 });
      K.box(-168, 44, 10, 14, -0.2, 3);
      const cr = [];
      for (const [x, z, a, c] of [[-166, 76, 0.5, 0xe8443a], [-172, 84, -0.3, 0x2f6fe0], [-160, 10, 1.3, 0x6fc04b], [-174, -96, 0.2, 0xf59a23], [150, 122, 0.1, 0x9a5cc7], [-60, 122, 0.3, 0xf5d331], [172, 100, 1.1, 0xe8443a]]) { cr.push({ x, y: 0.6, z, ry: -a, rz: PI / 2, color: c }); K.capsule(x - Math.cos(a) * 4.5, z - Math.sin(a) * 4.5, x + Math.cos(a) * 4.5, z + Math.sin(a) * 4.5, 0.6, 1.3); }
      K.instances(G.cyl(0.6, 0.6, 10, 10), K.plastic(0xffffff, 0.5), cr, { colors: true });
      TM.flat(-40, -121, 44, 26, (g, w, h) => {
        g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineWidth = w * 0.012;
        g.strokeStyle = '#6fc04b'; g.beginPath(); g.ellipse(w * 0.4, h * 0.55, w * 0.16, h * 0.16, 0, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(w * 0.54, h * 0.48); g.quadraticCurveTo(w * 0.62, h * 0.2, w * 0.7, h * 0.26); g.stroke(); g.beginPath(); g.arc(w * 0.72, h * 0.28, w * 0.03, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(w * 0.25, h * 0.6); g.lineTo(w * 0.1, h * 0.74); g.stroke(); for (const x of [0.33, 0.47]) { g.beginPath(); g.moveTo(w * x, h * 0.7); g.lineTo(w * x, h * 0.86); g.stroke(); }
        g.strokeStyle = '#f5c531'; g.beginPath(); g.arc(w * 0.88, h * 0.2, w * 0.05, 0, 7); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * 0.785; g.beginPath(); g.moveTo(w * 0.88 + Math.cos(a) * w * 0.065, h * 0.2 + Math.sin(a) * w * 0.065); g.lineTo(w * 0.88 + Math.cos(a) * w * 0.09, h * 0.2 + Math.sin(a) * w * 0.09); g.stroke(); }
        g.strokeStyle = '#2f6fe0'; g.beginPath(); for (let x = 0.04; x < 0.96; x += 0.04) g.lineTo(w * x, h * (0.92 + 0.02 * Math.sin(x * 60))); g.stroke();
      }, { y: 0.04, ang: 0.06 });
      TM.flat(40, 123, 86, 6, (g, w, h) => { g.fillStyle = '#e8c88a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5e3c22'; for (let i = 0; i <= 43; i++) g.fillRect(w * (0.01 + i * 0.0228), 0, Math.max(1, w * 0.002), h * (i % 5 ? 0.3 : 0.55)); }, { thick: 0.5, px: 512, edge: 0xe8c88a });
      toy([P(G.tor(8, 1, PI * 2, 28), 0x3a3a3a, 0, 1, 0, { rx: PI / 2 }), P(G.cyl(1.1, 1.3, 14, 10), 0xd8423a, 13.5, 1.2, 9.5, { rz: PI / 2, ry: -0.62 })], paint, 60, 0, -121);
      K.mesh(new T.CircleGeometry(7.4, 28), K.phys({ color: 0xcfeeff, roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1 }), 60, 1.2, -121, { rx: -PI / 2, cast: false });
      K.circle(60, -121, 8.6, 2);
    }

  },

  aiHazards() { return A ? A.haz : null; },

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
    // the brachiosaurus chews, sways and now and then dips its head to the tree; its tail swishes
    const dip = Math.max(0, Math.sin(time * 0.45)) ** 6;
    A.neck.rotation.x = 0.03 * Math.sin(time * 1.3) + 0.13 * dip + 0.012 * Math.sin(time * 9) * dip;
    A.neck.rotation.y = 0.05 * Math.sin(time * 0.7);
    A.btail.rotation.y = 0.3 * Math.sin(time * 1.1);
    // the T-rex's tail balances its lunge; the pterodactyl rocks on its wire
    if (A.lavaMat) {
      A.lavaMat.emissiveIntensity = 1.3 + 0.7 * Math.sin(time * 2.3) + 0.3 * Math.sin(time * 7.1);
      A.puffs.forEach((m, i) => { const k = ((time * 0.16 + i / A.puffs.length) % 1); m.position.set(120 - k * 9 + Math.sin(time * 0.5 + i) * 1.2, 26 + k * 22, -80 - k * 3); m.scale.setScalar(1.6 + k * 4.2); m.material.opacity = 0.8 * (1 - k) * Math.min(1, k * 6); });
      for (const f of A.flies) { const a = f.ph + time * f.sp; f.m.position.set(f.cx + Math.cos(a) * f.rad, f.y + 0.5 * Math.sin(time * 3 + f.ph), f.cz + Math.sin(a) * f.rad * 0.8); f.m.rotation.y = -(a + (f.sp > 0 ? 1 : -1) * PI / 2); }
    }
    if (A.ptero) { A.ptero.rotation.z = 0.12 * Math.sin(time * 2.2); A.ptero.rotation.x = 0.08 * Math.sin(time * 1.7); }
  },
};
