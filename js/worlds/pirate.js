// World: Pirate Cove (Time Machine Cup, table 3 of 4). A blue paddling tray on the table, filled with water and a
// pirate play set: sandy islands with paper palms, a skull rock, a bath duck and a toy galleon. Speedboats follow the
// buoys: a whirlpool on the east side drags you round (ride its rim for a slingshot, or keep to the outside), the
// rapids in the narrows hurry you along, the galleon fires its cannon at two foam marks on the west side (the mark
// flashes before the splash), and a kraken reaches its tentacles into the south channel in turn.
import { tmTools, blast, fired, mod, ss, clamp } from './_tm.js';

const TRACK = [
  [-60, 84], [0, 88], [56, 80], [96, 58], [116, 22], [112, -20], [90, -52], [56, -64], [30, -46], [26, -14], [40, 14],
  [30, 40], [0, 48], [-28, 34], [-36, 4], [-24, -28], [-6, -58], [-30, -84], [-74, -86], [-108, -66], [-124, -30],
  [-122, 14], [-106, 52], [-88, 74],
];
const W = 18, PI = Math.PI;
const TRAY = { x0: -146, x1: 146, z0: -108, z1: 108 };
const POOL = { x: 105.5, z: 2, r: 12.5, w: -1.5 }; // whirlpool: centre, radius, turn rate (rad/s)
const SHIP = { x: -80, z: -14, period: 5.5, phase: 2.5, fly: 0.95, R: 6.2 };
const KRAK = { x: 3, z: 68.5, period: 6.6, n: 4 };
const ISLES = [ // x, z, radius, height
  { x: 70, z: 8, r: 23, h: 5 }, { x: -72, z: 36, r: 19, h: 4 }, { x: 1, z: 12, r: 12.5, h: 3.4 }, { x: -62, z: -54, r: 13, h: 3 },
  { x: 126, z: -90, r: 12, h: 4 }, { x: -130, z: 92, r: 11, h: 3 }, { x: 130, z: 92, r: 10, h: 3 },
];
// how far tentacle k reaches into the lane at time t (0 = curled up beside it, 1 = right across the outer half)
const reach = (k, t) => { const u = mod(t / KRAK.period - k / KRAK.n, 1); return u < 0.42 ? Math.sin((u / 0.42) * PI) ** 1.5 : 0; };
const shipU = (t) => mod(t - SHIP.phase, SHIP.period);
const shipShot = (t) => Math.floor((t - SHIP.phase) / SHIP.period);

let A = null;

export default {
  id: 'pirate',
  name: 'Pirate Cove',
  blurb: 'Speedboats in a pirate play set: ride the whirlpool, dodge the cannon and the kraken.',
  vehicle: 'boat',
  seed: 107,
  track: { points: TRACK, width: W, startS: 34 },
  noGrid(track) {
    const sp = track.nearest(POOL.x + 9, POOL.z).s, sk = track.nearest(KRAK.x, KRAK.z - 18).s;
    return [[sp - 18, sp + 18], [sk - 26, sk + 26], ...(A ? A.spots.map((q) => [q.s - 8, q.s + 8]) : [])];
  },
  bounds: { minX: TRAY.x0, maxX: TRAY.x1, minZ: TRAY.z0, maxZ: TRAY.z1 },
  fallOffEdges: false,
  floorY: -80,
  offCourse: 20,
  wake: { color: 0xf2fbff },
  dustColor: 0xeef8ff,
  lighting: {
    sunDir: [-0.6, 1.1, 0.35], sunColor: 0xfff2d6, sunIntensity: 3.0,
    hemiSky: 0xcfe6ff, hemiGround: 0x3f7fa8, hemiIntensity: 0.6,
    envIntensity: 0.55, exposure: 1.0, background: 0x2a2420, shadowRadius: 1.6,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const { G, P, toy, table, startLine, edges, scatter, sAt, geoOf } = tmTools(K);
    const L = track.length;
    A = { prevT: null, L, spots: [], rings: [], tent: [], sN0: 0, sN1: 0 };
    const paint = K.plastic(0xffffff, 0.5, { vertexColors: true });
    const matte = K.std({ color: 0xffffff, roughness: 0.9, vertexColors: true });
    const plain = K.plastic(0xffffff, 0.45);

    // ---------------- table, the tray, the water ----------------
    table({ w: 330, d: 250, wood: [0xd9b684, 0x9a7446, 0xf0d8ae], floorA: '#cfd8dc', floorB: '#9fb4bd', top: -7 });
    const tray = K.plastic(0x2f8fe0, 0.35);
    K.mesh(new T.BoxGeometry(TRAY.x1 - TRAY.x0 + 8, 1, TRAY.z1 - TRAY.z0 + 8), tray, 0, -6.5, 0, { cast: false });
    for (const [x, z, w, d] of [[0, TRAY.z0 - 2, 300, 4], [0, TRAY.z1 + 2, 300, 4], [TRAY.x0 - 2, 0, 4, 216], [TRAY.x1 + 2, 0, 4, 216]]) K.mesh(new K.RoundedBoxGeometry(w, 9.5, d, 2, 1.2), tray, x, -2.2, z);
    const wt = TX.mottledTextures({ size: 512, a: 0x27a4dc, b: 0x1f96d2, seed: 5, period: 5, speck: 0, bump: 1.6 });
    for (const t of Object.values(wt)) if (t && t.isTexture) t.repeat.set(3.5, 2.6);
    const water = K.phys({ map: wt.map, normalMap: wt.normalMap, normalScale: new T.Vector2(0.35, 0.35), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
    K.mesh(new T.PlaneGeometry(TRAY.x1 - TRAY.x0, TRAY.z1 - TRAY.z0), water, 0, 0, 0, { rx: -PI / 2, cast: false });
    A.water = wt.normalMap;
    startLine(34, 0.06, '#d8322a', '#ffffff');

    // buoys mark the channel: red on the left, white on the right, a mast on every fourth
    const buoy = geoOf([P(G.sph(0.95, 10), 0xffffff, 0, 0.2, 0, { sy: 0.8 }), P(G.cyl(0.98, 0.98, 0.3, 10), 0x222222, 0, 0.25, 0)]);
    edges(buoy, plain, 6.5, 0.4, (p, side) => (Math.hypot(p.x - POOL.x, p.z - POOL.z) < POOL.r + 1 ? null : { x: p.x, y: 0, z: p.z, color: side < 0 ? 0xe8443a : 0xffe14a }));

    // ---------------- islands: sand, palms, rocks ----------------
    const sandT = TX.mottledTextures({ size: 256, a: 0xecd9a0, b: 0xdcc486, seed: 3, period: 14, bump: 2 });
    const sand = K.std({ map: sandT.map, normalMap: sandT.normalMap, roughness: 1 });
    const shallow = K.std({ color: 0x8fe0f0, roughness: 0.2, transparent: true, opacity: 0.5 });
    const palm = geoOf([
      ...[0, 1, 2, 3, 4].map((i) => P(G.cyl(0.55 - i * 0.05, 0.62 - i * 0.05, 2.1, 7), i % 2 ? 0x9a6f3f : 0x86602f, i * i * 0.12, 1 + i * 2, 0, { rz: -i * 0.06 })),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => P(G.cone(1.1, 7, 4), i % 2 ? 0x2f9a4a : 0x45b356, 2.9 + Math.cos(i * 0.9) * 3, 10.2, Math.sin(i * 0.9) * 3, { rz: -Math.cos(i * 0.9) * 1.3, rx: Math.sin(i * 0.9) * 1.3, order: 'XZY', sz: 0.3 })),
      P(G.sph(0.6, 6), 0x6a4a2a, 2.9, 10.4, 0.6), P(G.sph(0.6, 6), 0x6a4a2a, 2.5, 10.3, -0.5),
    ]);
    const palms = [], rocks = [];
    for (const I of ISLES) {
      const prof = [[I.r, -0.6], [I.r * 0.93, 0.25], [I.r * 0.72, I.h * 0.55], [I.r * 0.4, I.h * 0.9], [0, I.h]];
      K.mesh(K.lathe(prof, 36), sand, I.x, 0, I.z);
      K.mesh(new T.CircleGeometry(I.r + 3.5, 36), shallow, I.x, 0.03, I.z, { rx: -PI / 2, cast: false });
      K.circle(I.x, I.z, I.r * 0.95, 12);
      const n = Math.round(I.r / 4);
      for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r.range(0.15, 0.6) * I.r; palms.push({ x: I.x + Math.cos(a) * d, y: I.h * (1 - d / I.r) * 0.9, z: I.z + Math.sin(a) * d - (I.z > 30 ? 0 : 0), ry: r() * 6, s: r.range(0.8, 1.2) }); }
      for (let i = 0; i < n + 2; i++) { const a = r() * 6.28, d = r.range(0.7, 0.98) * I.r; rocks.push({ x: I.x + Math.cos(a) * d, y: 0.5, z: I.z + Math.sin(a) * d, ry: r() * 6, rx: r() * 3, s: r.range(0.8, 2), sy: r.range(0.6, 1), color: r.pick([0x8a8478, 0x9d968a, 0x777066]) }); }
    }
    // rocks on the inside of the two bends in the narrows, so nobody goes straight through
    for (const [x, z] of [[38.5, -15], [27, 15]]) {
      for (let i = 0; i < 4; i++) rocks.push({ x: x + r.range(-1.6, 1.6), y: 0.6, z: z + r.range(-1.6, 1.6), ry: r() * 6, rx: r() * 3, s: r.range(1.4, 2.4), sy: r.range(0.8, 1.2), color: r.pick([0x8a8478, 0x9d968a, 0x777066]) });
      K.circle(x, z, 2.6, 6);
    }
    K.instances(palm, matte, palms);
    K.instances(G.ico(1), K.std({ color: 0xffffff, roughness: 0.95 }), rocks, { colors: true });

    // skull rock on the east island, with a waterfall of blue ribbon
    {
      const I = ISLES[0], x = I.x - 2, z = I.z - 6, g1 = 0x8f897e, g2 = 0x77716a;
      toy([
        P(G.sph(1, 14), g1, 0, 9, 0, { sx: 9, sy: 8, sz: 8 }), P(G.rbox(9, 5, 7, 2), g1, 0, 3.4, 2.2), P(G.sph(1, 10), g2, -6, 3, -3, { sx: 6, sy: 4, sz: 6 }), P(G.sph(1, 10), g2, 7, 2.6, -2, { sx: 5, sy: 3.4, sz: 5 }),
        P(G.sph(2.4, 10), 0x1c1a18, -3.4, 12.6, 5.0, { sz: 0.6, rx: -0.6 }), P(G.sph(2.4, 10), 0x1c1a18, 3.4, 12.6, 5.0, { sz: 0.6, rx: -0.6 }), P(G.cone(1.3, 2.4, 3), 0x1c1a18, 0, 9.4, 7.3, { rx: 0.5 }),
        ...[-3, -1.5, 0, 1.5, 3].map((xx) => P(G.box(1.1, 1.8, 0.8), 0xf1ead8, xx, 5.4, 6.0)),
        P(G.box(3, 0.2, 9), 0x6fd0f0, 9.5, 3.6, 3, { rx: 0.55 }),
      ], matte, x, I.h * 0.5, z);
      K.circle(x, z, 9, 20);
      // the treasure chest and a few coins on the beach
      toy([P(G.rbox(4.4, 2.4, 3, 0.3), 0x8a5a30, 0, 1.2, 0), P(G.cyl(1.5, 1.5, 4.4, 10, 1), 0x9a6a3a, 0, 2.4, 0, { rz: PI / 2, sx: 0.7 }), P(G.box(0.5, 3.4, 3.1), 0xf2c230, -1.3, 1.6, 0), P(G.box(0.5, 3.4, 3.1), 0xf2c230, 1.3, 1.6, 0), P(G.box(0.9, 0.9, 0.3), 0xf2c230, 0, 1.9, 1.55)], paint, I.x + 6, 2.2, I.z + 13, -0.4);
      const coins = [];
      for (let i = 0; i < 14; i++) coins.push({ x: I.x + 6 + r.range(-5, 5), y: 2.3 - 0.0, z: I.z + 17 + r.range(-2, 3), ry: r() * 6, rx: r.range(-0.3, 0.3) });
      K.instances(G.cyl(0.45, 0.45, 0.12, 8), K.metal(0xf2c230, 0.3), coins, { cast: false });
    }
    // a beach hut and a jetty on the west island, a flag with crossed bones
    {
      const I = ISLES[1];
      toy([P(G.cyl(4.2, 4.2, 4, 10), 0xcfae78, 0, 2, 0), P(G.cone(5.8, 4.6, 10), 0xb8904e, 0, 6.2, 0), P(G.box(1.6, 2.8, 0.3), 0x5e3c22, 0, 1.4, 4.1)], matte, I.x - 3, I.h * 0.75, I.z - 3);
      K.circle(I.x - 3, I.z - 3, 4.6, 12);
      const j = [];
      for (let i = 0; i < 8; i++) j.push(P(G.box(1.5, 0.3, 4.4), i % 2 ? 0xb07a45 : 0x9a6a3a, 0, 1.4, i * 1.7), ...(i % 3 === 0 ? [P(G.cyl(0.35, 0.35, 3.4, 6), 0x6d4a2b, -2, 0.3, i * 1.7), P(G.cyl(0.35, 0.35, 3.4, 6), 0x6d4a2b, 2, 0.3, i * 1.7)] : []));
      toy(j, matte, I.x + 4, 0, I.z + I.r - 6);
      K.box(I.x + 4, I.z + I.r + 1, 2.4, 6.5, 0, 3);
      toy([P(G.cyl(0.2, 0.2, 11, 5), 0x6d4a2b, 0, 5.5, 0), P(G.box(4.6, 3, 0.1), 0x1c1a18, 2.4, 9.3, 0), P(G.sph(0.6, 6), 0xf1ead8, 2.4, 9.6, 0.1), P(G.box(2.4, 0.3, 0.12), 0xf1ead8, 2.4, 8.5, 0.1, { rz: 0.4 }), P(G.box(2.4, 0.3, 0.12), 0xf1ead8, 2.4, 8.5, 0.1, { rz: -0.4 })], matte, I.x + 9, I.h * 0.4, I.z - 9);
    }
    // the bath duck (north), a lighthouse on the north-east rock
    {
      toy([P(G.sph(1, 16), 0xffd21f, 0, 3.4, 0, { sx: 8, sy: 5, sz: 6.4 }), P(G.sph(3.8, 14), 0xffd21f, 4.6, 9, 0), P(G.cone(1.6, 3.4, 8), 0xf58a1f, 8.8, 8.6, 0, { rz: -PI / 2, sz: 1.4, sx: 0.6 }), P(G.sph(0.55, 8), 0x111111, 6.6, 10.4, 2.6), P(G.sph(0.55, 8), 0x111111, 6.6, 10.4, -2.6), P(G.cone(3, 5, 8), 0xffd21f, -7.4, 5.4, 0, { rz: 0.9 })], paint, 20, 0, -90, 0.5);
      K.circle(20, -90, 7.6, 12); K.contact(20, -90, 9, 8, 0.25);
      const I = ISLES[4];
      toy([P(G.cyl(2.6, 3.4, 14, 14), 0xffffff, 0, 7, 0), P(G.cyl(3.05, 3.2, 3.2, 14), 0xd8322a, 0, 4.4, 0), P(G.cyl(2.75, 2.9, 3.2, 14), 0xd8322a, 0, 10.6, 0), P(G.cyl(3.4, 3.4, 0.6, 14), 0x333333, 0, 14.3, 0), P(G.cyl(2, 2, 2.6, 10), 0xffe89a, 0, 15.9, 0), P(G.cone(3, 2.6, 12), 0xd8322a, 0, 18.5, 0)], paint, I.x, I.h * 0.8, I.z);
      K.circle(I.x, I.z, 3.4, 20);
    }

    // ---------------- the whirlpool ----------------
    {
      const c = TX.makeCanvas(256), g = c.getContext('2d');
      g.translate(128, 128);
      const gr = g.createRadialGradient(0, 0, 4, 0, 0, 126); gr.addColorStop(0, 'rgba(6,40,80,0.95)'); gr.addColorStop(0.35, 'rgba(18,110,180,0.8)'); gr.addColorStop(1, 'rgba(40,160,220,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 126, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineCap = 'round';
      for (let arm = 0; arm < 4; arm++) { g.beginPath(); for (let k = 0; k <= 60; k++) { const a = arm * 1.571 + k * 0.085, rr = 8 + k * 1.95; g.lineWidth = 1.5 + k * 0.06; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
      A.pool = K.mesh(new T.CircleGeometry(POOL.r + 1.5, 40), K.std({ map: TX.toTexture(c, { wrap: false }), transparent: true, roughness: 0.2, depthWrite: false }), POOL.x, 0.05, POOL.z, { rx: -PI / 2, cast: false });
      K.spinner(POOL.x, POOL.z, POOL.r, (t) => POOL.w * t, { h: 0, fling: 0.9, pull: -0.25 });
      // a rowing boat that has been going round for a while
      A.dinghy = toy([P(G.sph(1, 10), 0xb07a45, 0, 0.5, 0, { sx: 2.8, sy: 1, sz: 1.3 }), P(G.box(3.6, 0.2, 1.6), 0x8a5a30, 0, 1.0, 0), P(G.cyl(0.12, 0.12, 4.6, 5), 0xe2c08a, 0.4, 1.2, 0, { rx: PI / 2 })], matte, POOL.x, 0, POOL.z);
    }

    // ---------------- the rapids in the narrows: a current that hurries you along ----------------
    {
      A.sN0 = sAt(30, -42); A.sN1 = sAt(38, 10);
      const st = [];
      for (let s = A.sN0; s < A.sN1; s += 2.2) { const q = track.place(s, r.range(-8, 8)); st.push({ x: q.x, y: 0.05, z: q.z, ry: -q.angle, sx: r.range(2, 5), sy: 0.02, sz: 0.22 }); }
      K.instances(G.box(1, 1, 1), K.std({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.7 }), st, { cast: false });
    }

    // ---------------- the galleon and its two marks on the west side ----------------
    {
      const hull = 0x6d4526, trim = 0xf2c230, sail = 0xf5ecd6;
      const parts = [
        P(G.sph(1, 16), hull, 0, 1.6, 0, { sx: 13, sy: 4.4, sz: 4.6 }), P(G.box(20, 2.2, 8.4), hull, 0, 3.2, 0), P(G.box(20.4, 0.5, 8.8), trim, 0, 4.4, 0),
        P(G.box(6, 3.4, 8.4), hull, -8, 5.8, 0), P(G.box(6.4, 0.5, 8.8), trim, -8, 7.6, 0), P(G.box(4, 2, 8), hull, 9, 5.2, 0),
        P(G.cyl(0.3, 0.3, 9, 5), 0x8a5a30, 12, 6.4, 0, { rz: -PI / 2 + 0.35 }),
        ...[[-3, 20], [4.5, 17]].flatMap(([x, h]) => [P(G.cyl(0.45, 0.5, h, 8), 0x8a5a30, x, 4.4 + h / 2, 0), P(G.box(0.3, h * 0.42, 10), sail, x + 0.9, 4.4 + h * 0.62, 0, { rz: 0.06 }), P(G.box(0.3, h * 0.22, 7), sail, x + 0.8, 4.4 + h * 0.96, 0), P(G.box(0.4, 0.4, 10.6), 0x8a5a30, x, 4.4 + h * 0.84, 0)]),
        P(G.box(3.6, 2.4, 0.1), 0x1c1a18, -1.2, 25.6, 0), P(G.sph(0.5, 6), 0xf1ead8, -1.2, 25.8, 0.1),
        ...[-5, 0, 5].map((x) => P(G.cyl(0.55, 0.65, 3, 8), 0x2a2a2a, x, 3.6, 4.6, { rx: PI / 2 })),
      ];
      const sA = sAt(-124, -24), sB = sAt(-123, 8);
      for (const [s, lat] of [[sA, -3.4], [sB, 3.4]]) { const q = track.place(s, lat); A.spots.push({ x: q.x, z: q.z, s }); }
      // broadside towards the marks: the ship's +z side faces west
      toy(parts, paint, SHIP.x, 0, SHIP.z, -PI / 2);
      K.box(SHIP.x, SHIP.z, 4.6, 12.5, 0, 12); K.contact(SHIP.x, SHIP.z, 7, 14, 0.25);
      A.ball = K.mesh(G.sph(1.3, 10), K.metal(0x2a2a2e, 0.5), SHIP.x, -5, SHIP.z);
      A.puff = K.mesh(G.sph(1, 10), K.std({ color: 0xf2efe8, roughness: 1, transparent: true, opacity: 0.9 }), SHIP.x - 6, 4, SHIP.z, { cast: false });
      for (const sp of A.spots) {
        const mat = K.std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, transparent: true, opacity: 0.6, depthWrite: false });
        const ring = K.mesh(new T.RingGeometry(SHIP.R - 1.1, SHIP.R - 0.3, 36), mat, sp.x, 0.07, sp.z, { rx: -PI / 2, cast: false });
        K.mesh(new T.RingGeometry(1.2, 1.7, 20), mat, sp.x, 0.07, sp.z, { rx: -PI / 2, cast: false });
        A.rings.push({ ring, mat });
      }
    }

    // ---------------- the kraken in the south channel ----------------
    {
      const c1 = 0x8a3fa0, c2 = 0xf2a7c8;
      toy([P(G.sph(1, 16), c1, 0, 2.4, 0, { sx: 6.4, sy: 5.4, sz: 6 }), P(G.sph(1, 12), c1, 0, 6, -3.4, { sx: 4.6, sy: 4.4, sz: 4.6 }), P(G.sph(1.5, 10), 0xffe14a, -2.8, 4.6, 4.6), P(G.sph(1.5, 10), 0xffe14a, 2.8, 4.6, 4.6), P(G.sph(0.7, 8), 0x111111, -2.8, 4.8, 5.8), P(G.sph(0.7, 8), 0x111111, 2.8, 4.8, 5.8)], paint, KRAK.x, 0, KRAK.z, PI);
      K.circle(KRAK.x, KRAK.z, 6.2, 10);
      const seg = [];
      for (let i = 0; i < 9; i++) { const k = i / 8, rr = 2.2 - k * 1.5; seg.push(P(G.sph(rr, 8), c1, Math.sin(k * 2.4) * 3.4 * k, 0.4 + i * 1.4 - k * k * 2.6, 0)); if (i % 2) seg.push(P(G.sph(rr * 0.4, 5), c2, Math.sin(k * 2.4) * 3.4 * k + rr * 0.8, 0.4 + i * 1.4 - k * k * 2.6, 0)); }
      const tg = geoOf(seg);
      // two tentacles reach north into the inner channel, two south into the start straight
      const bases = [[sAt(18, 46), 1], [sAt(-12, 44), 1], [sAt(-14, 87), -1], [sAt(20, 86), -1]];
      bases.forEach(([s, sg], k) => {
        const p = track.at(s), side = (KRAK.x - p.x) * p.nx + (KRAK.z - p.z) * p.nz > 0 ? 1 : -1;
        const out = W / 2 + 1.6, inn = 1.0;
        const b = { x: p.x, z: p.z, nx: p.nx * side, nz: p.nz * side, out, inn, k, a: Math.atan2(-p.nz * side, -p.nx * side) };
        void sg;
        const m = K.add(new T.Mesh(tg, paint));
        const T0 = { ...b, m }; A.tent.push(T0);
        T0.mv = K.mover({ type: 'circle', r: 1.9, h: 9 }, (t) => { const q = b.out + (b.inn - b.out) * reach(k, t); return { x: b.x + b.nx * q, z: b.z + b.nz * q, angle: 0 }; });
      });
    }

    // ---------------- flotsam: barrels and crates to shove about, lilos, a shark fin ----------------
    {
      const barrel = geoOf([P(G.cyl(1.25, 1.25, 2.6, 10), 0xb07a45, 0, 0, 0, { rz: PI / 2 }), P(G.cyl(1.3, 1.3, 0.3, 10), 0x3a3a3a, 0.7, 0, 0, { rz: PI / 2 }), P(G.cyl(1.3, 1.3, 0.3, 10), 0x3a3a3a, -0.7, 0, 0, { rz: PI / 2 })]);
      for (const [s, lat] of [[120, 5], [210, -5], [470, 4], [560, -3], [640, 5], [735, -4], [880, 3]]) {
        const q = track.place(s, lat), m = K.mesh(barrel, matte, q.x, 0.5, q.z, { ry: r() * 6 });
        K.physics.addDynamic({ x: q.x, z: q.z, r: 1.4, m: 0.4, h: 2.2, mesh: m, slide: true, friction: 5, baseY: 0.5 });
      }
      scatter(geoOf([P(G.cone(1.3, 2.8, 3), 0x5a6a78, 0, 1.1, 0, { sz: 0.25, rz: -0.2 })]), matte, 5, [-136, 136, -100, 100], 9, (x, z) => (ISLES.some((I) => Math.hypot(I.x - x, I.z - z) < I.r + 6) ? null : { x, y: 0, z, ry: r() * 6 }));
      scatter(G.tor(2.2, 0.8, PI * 2, 14), plain, 5, [-136, 136, -100, 100], 10, (x, z) => (ISLES.some((I) => Math.hypot(I.x - x, I.z - z) < I.r + 6) || Math.hypot(x - 20, z + 90) < 16 ? null : (K.circle(x, z, 3, 2, { bounce: 0.7 }), { x, y: 0.3, z, rx: PI / 2, color: r.pick([0xe8443a, 0xffe14a, 0xf27aa8, 0x6fc04b]) })));
    }
  },

  tick(dt, time, game) {
    if (!A || !A.spots.length) return;
    // the rapids
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive') continue;
      if (mod(e.trackS - A.sN0, A.L) < A.sN1 - A.sN0) { const p = game.track.at(e.trackS); c.vx += p.tx * 9 * dt; c.vz += p.tz * 9 * dt; }
    }
    // a tentacle is only in the way while it is up
    for (const t of A.tent) t.mv.h = reach(t.k, time) > 0.04 ? 9 : 0;
    if (fired(A.prevT, time, SHIP.period, SHIP.phase) && game.sound) game.sound.cue('clank', { x: SHIP.x, z: SHIP.z, game });
    if (fired(A.prevT, time, SHIP.period, SHIP.phase + SHIP.fly)) {
      const sp = A.spots[mod(shipShot(time - SHIP.fly * 0.5), 2)];
      blast(game, sp.x, sp.z, SHIP.R, 16, { shake: 0.3, clack: 0 });
      if (game.state !== 'attract') {
        if (game.sound && game.sound.splash) game.sound.splash(40, game.panOf(sp.x, sp.z));
        if (game.particles) game.particles.emit(sp.x, 0.2, sp.z, { color: 0xeaf6ff, n: 26, size: 1.3, life: 0.7, spread: 16, up: 20, grav: 44, alpha: 0.9, grow: 1.2 });
      }
    }
    A.prevT = time;
  },

  animate(time) {
    if (!A || !A.pool) return;
    A.water.offset.set(Math.sin(time * 0.21) * 0.03, time * 0.012);
    A.pool.rotation.z = -POOL.w * time;
    const da = POOL.w * time * 0.8;
    A.dinghy.position.set(POOL.x + Math.cos(da) * 7.5, 0, POOL.z + Math.sin(da) * 7.5); A.dinghy.rotation.y = -(da - PI / 2);
    // galleon: the ball's arc to this shot's mark, a puff of smoke at the gun, the next mark flashing
    const u = shipU(time), n = shipShot(time), sp = A.spots[mod(n, 2)];
    if (u < SHIP.fly) { const k = u / SHIP.fly; A.ball.position.set(SHIP.x - 5 + (sp.x - SHIP.x + 5) * k, 4 + 9 * 4 * k * (1 - k) - 4 * k, SHIP.z + (sp.z - SHIP.z) * k); } else A.ball.position.y = -6;
    const pk = clamp(u / 0.9, 0, 1);
    A.puff.scale.setScalar(u < 0.9 ? 1 + 3 * pk : 0.001); A.puff.material.opacity = 0.85 * (1 - pk); A.puff.position.set(SHIP.x - 6 - pk * 3, 4 + pk * 2, SHIP.z + (sp.z - SHIP.z) * 0.08);
    const warm = clamp((u - (SHIP.period - 2)) / 1.6, 0, 1), nextI = mod(n + 1, 2);
    A.rings.forEach((R, i) => {
      const hot = i === mod(n, 2) && u < SHIP.fly ? 1 : i === nextI ? warm * (0.55 + 0.45 * Math.sin(time * 14)) : 0;
      R.mat.emissiveIntensity = hot * 1.2; R.mat.opacity = 0.35 + 0.6 * hot; R.ring.scale.setScalar(1 + 0.1 * hot);
    });
    // tentacles: lean over the lane as they reach in, sink back beside it
    for (const t of A.tent) {
      const e = reach(t.k, time), q = t.out + (t.inn - t.out) * e;
      t.m.position.set(t.x + t.nx * q, -3.2 + 3.2 * ss(0, 0.25, e) + Math.sin(time * 3 + t.k) * 0.15, t.z + t.nz * q);
      t.m.rotation.y = -t.a; t.m.rotation.z = -0.25 - 0.5 * e + Math.sin(time * 2.3 + t.k * 2) * 0.08;
    }
  },
};
