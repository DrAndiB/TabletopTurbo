// World: Robo Rumble (Time Machine Cup, table 4 of 4). The year 3000 as a tin-toy collector imagined it: a robot city on
// a circuit-board desk mat at night, the road edged in neon. Boost pads fire you down three straights, two laser gates
// close one half of the road and then the other (the beam flickers before it turns solid and throws you back), two
// guard robots slam an arm across the inside lane (their eyes turn red first), a conveyor belt runs against you in the
// middle of the city, and a ramp jumps a row of sleeping service robots. Coolant has leaked into the west hairpin.
import { tmTools, fired, mod, ss, clamp } from './_tm.js';

const TRACK = [
  [-80, 80], [-30, 82], [20, 80], [60, 84], [96, 74], [116, 50], [112, 24], [90, 14], [62, 22], [44, 40], [20, 46], [0, 30],
  [2, 4], [24, -14], [58, -20], [92, -30], [116, -48], [112, -74], [86, -88], [50, -84], [30, -62], [4, -52], [-22, -66],
  [-46, -86], [-80, -86], [-108, -68], [-112, -40], [-92, -22], [-64, -26], [-44, -10], [-48, 16], [-72, 28], [-104, 26],
  [-124, 44], [-116, 70],
];
const W = 14, PI = Math.PI;
const GATE = { period: 4.4, on: 2.0, warn: 0.6 };
const ARM = { period: 5.2, len: 9 };
// a laser half (side 0 = left, 1 = right) of gate g at time t: 0 off, 0..1 warning flicker, 2 solid
function laser(g, side, t) {
  const u = mod(t - g.phase - side * GATE.period / 2, GATE.period);
  return u < GATE.on ? 2 : u > GATE.period - GATE.warn ? (u - (GATE.period - GATE.warn)) / GATE.warn : 0;
}
// how far a guard's arm is across the road at time t (0 parked along the kerb, 1 right across the inside lane)
function swing(b, t) {
  const u = mod(t - b.phase, ARM.period);
  return u < 0.22 ? (u / 0.22) ** 2 : u < 1.5 ? 1 : u < 2.3 ? 1 - ss(1.5, 2.3, u) : 0;
}
const armWarn = (b, t) => { const u = mod(t - b.phase, ARM.period); return u > ARM.period - 1.1 || u < 1.5; };

let A = null;

export default {
  id: 'robot',
  name: 'Robo Rumble',
  blurb: 'A tin-robot city at night: boost pads, laser gates, slamming robot arms and a conveyor belt.',
  vehicle: 'formula',
  seed: 109,
  headlights: { intensity: 55, distance: 52, angle: 0.6, color: 0xeaf4ff },
  track: { points: TRACK, width: W, startS: 30 },
  noGrid() { return A ? [...A.gates.map((g) => [g.s - 8, g.s + 8]), ...A.bots.map((b) => [b.s - 9, b.s + 9]), [A.sR - 14, A.sR + 34]] : []; },
  bounds: { minX: -150, maxX: 150, minZ: -106, maxZ: 106 },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  offroad: { kind: 'slow', margin: 1.2 },
  skidColor: 0x050508,
  dustColor: 0x9fb4c8,
  dust: {
    normal: { color: 0xa8b8cc, size: 0.8, life: 0.35, up: 1.2, grav: 3, alpha: 0.12, grow: 2, rate: 0.4 },
    slow: { color: 0x3fd0c0, size: 0.6, life: 0.35, up: 3, grav: 20, alpha: 0.5, grow: 1.2, rate: 1.2 },
    slick: { color: 0x40f0e0, size: 0.7, life: 0.5, up: 3, grav: 25, alpha: 0.8, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.4, 1, 0.3], sunColor: 0x9aaef0, sunIntensity: 0.9,
    hemiSky: 0x3a4a8a, hemiGround: 0x101422, hemiIntensity: 0.5,
    envIntensity: 0.2, exposure: 1.15, background: 0x04050a, shadowRadius: 2.5,
    fog: { color: 0x05060c, near: 340, far: 900 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const { G, P, toy, wedge, table, road, cutRibbon, startLine, scatter, sAt, geoOf } = tmTools(K);
    const L = track.length;
    A = { prevT: null, L, gates: [], bots: [], pads: [], blink: [], sR: 0 };
    const paint = K.plastic(0xffffff, 0.4, { vertexColors: true });
    const tin = K.std({ color: 0xffffff, roughness: 0.35, metalness: 0.55, vertexColors: true });
    const glow = (c, k = 1.6) => K.std({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.5 });
    const CY = 0x25e6ff, MG = 0xff3fb4, YL = 0xffd23a, RD = 0xff3030;

    // ---------------- desk, the circuit-board mat ----------------
    table({ w: 306, d: 218, wood: [0x3a3038, 0x1c161c, 0x54464e], floorA: '#23232b', floorB: '#191920' });
    {
      const c = TX.makeCanvas(1024), g = c.getContext('2d'), e = TX.makeCanvas(1024), ge = e.getContext('2d'), rr = K.rng(77);
      g.fillStyle = '#0b1a1c'; g.fillRect(0, 0, 1024, 1024); ge.fillStyle = '#000'; ge.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 150; i++) {
        let x = Math.floor(rr() * 64) * 16, y = Math.floor(rr() * 64) * 16;
        const lit = rr() < 0.22, col = lit ? '#1fd7c8' : '#12484a';
        for (const cx of [g, ge]) { cx.strokeStyle = cx === ge ? (lit ? '#0c8f88' : '#000') : col; cx.lineWidth = 3; cx.lineJoin = 'round'; cx.beginPath(); cx.moveTo(x, y); }
        const x0 = x, y0 = y;
        for (let k = 0; k < 4; k++) { const d = Math.floor(rr() * 4), len = (2 + Math.floor(rr() * 8)) * 16; x += [len, 0, -len, 0][d]; y += [0, len, 0, -len][d]; g.lineTo(x, y); ge.lineTo(x, y); }
        g.stroke(); ge.stroke();
        for (const [px, py] of [[x0, y0], [x, y]]) { g.fillStyle = '#c9a23a'; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill(); g.fillStyle = '#0b1a1c'; g.beginPath(); g.arc(px, py, 2, 0, 7); g.fill(); }
      }
      for (let i = 0; i < 26; i++) { const x = Math.floor(rr() * 60) * 16, y = Math.floor(rr() * 60) * 16, w = 32 + Math.floor(rr() * 3) * 16; g.fillStyle = '#15171c'; g.fillRect(x, y, w, w); g.fillStyle = '#8a8f98'; for (let k = 4; k < w; k += 8) { g.fillRect(x + k, y - 4, 3, 4); g.fillRect(x + k, y + w, 3, 4); } }
      const map = TX.toTexture(c, { repeat: [3, 2.1] }), em = TX.toTexture(e, { repeat: [3, 2.1] });
      K.mesh(new T.BoxGeometry(300, 0.3, 212), K.std({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.45, metalness: 0.2 }), 0, -0.15, 0, { cast: false });
    }

    // ---------------- the road: dark, with neon edges and stud lights ----------------
    road({ a: 0x2c3038, b: 0x22252c, seed: 13, rough: 0.7, period: 16, bump: 1 });
    K.ribbon({ mat: glow(CY, 1.8), width: 0.5, offset: -(W / 2 - 0.1), y: 0.09 });
    K.ribbon({ mat: glow(MG, 1.8), width: 0.5, offset: W / 2 - 0.1, y: 0.09 });
    K.ribbon({ mat: K.std({ color: 0x8892a0, roughness: 0.6, transparent: true, opacity: 0.35 }), width: 0.25, y: 0.085 });
    startLine(30, 0.1, '#0a0a0e', '#e8f0ff');

    // ---------------- boost pads ----------------
    {
      const c = TX.makeCanvas(128, 128), g = c.getContext('2d');
      g.fillStyle = '#1a1400'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffd23a'; g.lineWidth = 14; g.lineJoin = 'miter';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(14, 118 - k * 42); g.lineTo(64, 84 - k * 42); g.lineTo(114, 118 - k * 42); g.stroke(); }
      const tex = TX.toTexture(c, { wrap: false });
      for (const s of [sAt(-2, 82), sAt(-62, -86), sAt(40, -18)]) {
        const p = track.at(s), len = 9;
        const mat = K.std({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.4 });
        const m = K.mesh(new T.PlaneGeometry(W - 3, len), mat, p.x, 0.11, p.z, { cast: false });
        m.rotation.order = 'YXZ'; m.rotation.y = -p.angle - PI / 2; m.rotation.x = -PI / 2;
        A.pads.push({ s: s - len / 2, len, mat });
      }
    }

    // ---------------- the conveyor belt in the middle of the city (runs against you) ----------------
    {
      A.sC0 = sAt(8, 38); A.sC1 = sAt(3, 2);
      const c = TX.makeCanvas(64, 64), g = c.getContext('2d');
      g.fillStyle = '#3a3d44'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#17181c'; g.fillRect(0, 0, 64, 10); g.fillStyle = '#ff8a1f';
      g.beginPath(); g.moveTo(32, 22); g.lineTo(46, 46); g.lineTo(18, 46); g.fill();
      const tex = TX.toTexture(c, { repeat: [2, 1] });
      A.belt = tex;
      const m = K.ribbon({ mat: K.std({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.6 }), width: W - 1.4, y: 0.1, vScale: 5 });
      cutRibbon(m, (x, z) => { const n = track.nearest(x, z).s; return !(mod(n - A.sC0, L) < A.sC1 - A.sC0); });
      // rollers at both ends
      for (const s of [A.sC0, A.sC1]) { const p = track.at(s); const m2 = K.mesh(G.cyl(0.6, 0.6, W, 10), K.metal(0x8a8f98, 0.4), p.x, 0.25, p.z, { rx: PI / 2, ry: -p.angle, cast: false }); m2.rotation.order = 'YXZ'; }
    }

    // ---------------- laser gates: one half of the road, then the other ----------------
    {
      const beamGeo = G.cyl(0.22, 0.22, 1, 8);
      [[sAt(74, 82), 0.4], [sAt(66, -87), 2.4]].forEach(([s, phase]) => {
        const p = track.at(s), gate = { s, phase, half: [] }, posts = [];
        for (const side of [-1, 1]) {
          const q = track.place(s, side * (W / 2 + 1.6)), mid = track.place(s, side * (W / 4 + 0.2));
          posts.push(P(G.cyl(0.9, 1.2, 5, 8), 0x8a94a8, q.x, 2.5, q.z), P(G.sph(1, 8), 0xff5050, q.x, 5.4, q.z), P(G.cyl(1.5, 1.7, 0.6, 8), 0x3a4050, q.x, 0.3, q.z));
          K.circle(q.x, q.z, 1.3, 7);
          const mat = glow(RD, 2.4); mat.transparent = true;
          const beam = K.mesh(beamGeo, mat, mid.x, 2.2, mid.z, { rx: PI / 2, ry: -p.angle, cast: false });
          beam.rotation.order = 'YXZ';
          beam.scale.y = W / 2 + 1;
          const col = K.box(mid.x, mid.z, W / 4 + 0.3, 0.45, p.angle + PI / 2, 0, { kick: 26, bounce: 0.6 });
          gate.half.push({ beam, mat, col });
        }
        toy(posts, tin);
        A.gates.push(gate);
      });
    }

    // ---------------- guard robots: an arm slams across the inside lane ----------------
    {
      [[sAt(113, 36), 1, 0.6], [sAt(-110, -52), 1, 3.1]].forEach(([s, sg, phase]) => {
        // stand on the inside of the bend
        const p = track.at(s), pa = track.at(s - 6), pb = track.at(s + 6), side = pa.tx * pb.tz - pa.tz * pb.tx >= 0 ? sg : -sg;
        const lat = side * (W / 2 + 4.2), b = track.place(s, lat);
        const c1 = 0xd8423a, c2 = 0x8a94a8;
        toy([
          P(G.rbox(5, 6.5, 4.4, 0.5), c1, 0, 6.8, 0), P(G.rbox(3.6, 3, 3.4, 0.5), c2, 0, 11.6, 0), P(G.cyl(0.15, 0.15, 2.4, 5), c2, 0, 14.2, 0), P(G.sph(0.5, 8), YL, 0, 15.5, 0),
          P(G.rbox(1.6, 3.6, 2, 0.4), c2, 0, 1.8, 1.4), P(G.rbox(1.6, 3.6, 2, 0.4), c2, 0, 1.8, -1.4), P(G.rbox(2.6, 1, 2.2, 0.3), 0x3a4050, 0.4, 0.5, 1.4), P(G.rbox(2.6, 1, 2.2, 0.3), 0x3a4050, 0.4, 0.5, -1.4),
          P(G.box(0.2, 2.2, 3), YL, 2.55, 7.2, 0), P(G.cyl(1, 1, 1.2, 10), c2, 0, 8.6, 2.8, { rx: PI / 2 }), P(G.cyl(1, 1, 1.2, 10), c2, 0, 8.6, -2.8, { rx: PI / 2 }),
          P(G.cap(0.7, 4), c2, 0.4, 6, -3.4, { rz: 0.2 }),
        ], tin, b.x, 0, b.z, p.angle + (side > 0 ? -PI / 2 : PI / 2));
        K.circle(b.x, b.z, 3.2, 14); K.contact(b.x, b.z, 5, 5, 0.5);
        const eyes = glow(0x7fffe0, 2); eyes.userData.base = 1;
        const dir = p.angle + (side > 0 ? -PI / 2 : PI / 2);
        for (const d of [-0.9, 0.9]) K.mesh(G.sph(0.55, 8), eyes, b.x + Math.cos(dir) * 1.85 - Math.sin(dir) * d, 11.9, b.z + Math.sin(dir) * 1.85 + Math.cos(dir) * d, { cast: false });
        // the arm: parked along the kerb pointing up the road, swings out across the lane
        const sh = track.place(s, lat - side * 3.4);
        const arm = toy([P(G.rbox(ARM.len - 2, 1.5, 1.5, 0.4), c1, (ARM.len - 2) / 2, 0, 0), P(G.rbox(2.4, 2.6, 2.6, 0.5), YL, ARM.len - 1, 0, 0), P(G.box(0.5, 2.7, 2.7), 0x15171c, ARM.len - 1, 0, 0), P(G.sph(1.2, 8), c2, 0, 0, 0)], tin, sh.x, 3.2, sh.z, 0);
        const a0 = p.angle + PI, a1 = a0 + side * (PI / 2); // from pointing back down the road to pointing across it
        const B = { s, phase, x: sh.x, z: sh.z, a0, a1, arm, eyes };
        const ang = (t) => B.a0 + (B.a1 - B.a0) * swing(B, t);
        B.ang = ang;
        K.mover({ type: 'capsule', r: 1.2, h: 6 }, (t) => { const a = ang(t); return { x1: B.x, z1: B.z, x2: B.x + Math.cos(a) * (ARM.len - 0.6), z2: B.z + Math.sin(a) * (ARM.len - 0.6) }; });
        A.bots.push(B);
      });
    }

    // ---------------- the ramp over a row of sleeping service robots ----------------
    {
      const s = sAt(72, -24), len = 8, h = 2.4, p = track.at(s);
      A.sR = s;
      K.ramp(p.x, p.z, p.angle, len, W + 1, h, 0);
      toy([P(wedge(len, h, 0.01, W + 1), 0x3a4050, 0, 0.02, 0), ...[-1, 1].map((sd) => P(G.box(len + 0.4, 0.3, 0.5), YL, 0, h / 2 + 0.2, sd * (W / 2 + 0.2), { rz: Math.atan2(h, len) }))], tin, p.x, 0, p.z, p.angle);
      const bot = geoOf([P(G.rbox(2.2, 1.3, 2, 0.3), 0x4f8fd0, 0, 0.65, 0), P(G.sph(0.9, 8), 0xc8d0dc, 0, 1.2, 0, { sy: 0.6 }), P(G.cyl(0.1, 0.1, 0.8, 4), 0xc8d0dc, 0.5, 1.7, 0)]);
      const row = [];
      for (let i = -2; i <= 2; i++) { const q = track.place(s + len / 2 + 5.5, i * 2.9); row.push({ x: q.x, y: 0, z: q.z, ry: -q.angle + (i % 2 ? 0.3 : -0.2) }); K.circle(q.x, q.z, 1.2, 1.5); }
      K.instances(bot, tin, row);
    }

    // ---------------- coolant in the west hairpin ----------------
    {
      const q = track.place(sAt(-54, -20), 1.5);
      const sp = K.spill(q.x, q.z, 6.5, K.phys({ color: 0x1fe0d0, emissive: 0x0a7a70, emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }), { lump: 0.4, stretch: 1.4, angle: q.angle, y: 0.12, thick: 0.15 });
      K.surface('slick', { poly: sp.poly });
      const e = track.place(sAt(-54, -20), -(W / 2 + 4));
      toy([P(G.cyl(2.2, 2.2, 5.4, 12), 0x4f8fd0, 0, 1.1, 0, { rz: PI / 2 + 0.0 }), P(G.cyl(2.3, 2.3, 0.5, 12), YL, 1.6, 1.1, 0, { rz: PI / 2 }), P(G.cyl(2.3, 2.3, 0.5, 12), YL, -1.6, 1.1, 0, { rz: PI / 2 })], tin, e.x, 1.1, e.z, q.angle + 0.5);
      K.circle(e.x, e.z, 3, 4);
    }

    // ---------------- the city: lit tower blocks, tin robots, saucers, a rocket, a sign ----------------
    {
      const wc = TX.makeCanvas(64, 128), g = wc.getContext('2d'), ec = TX.makeCanvas(64, 128), ge = ec.getContext('2d'), rr = K.rng(5);
      g.fillStyle = '#20242e'; g.fillRect(0, 0, 64, 128); ge.fillStyle = '#000'; ge.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 4; x++) { const on = rr() < 0.6, col = on ? ['#ffe89a', '#7fe8ff', '#ff9ad8'][Math.floor(rr() * 3)] : '#12141a'; g.fillStyle = col; g.fillRect(6 + x * 14, 6 + y * 12, 9, 7); if (on) { ge.fillStyle = col; ge.fillRect(6 + x * 14, 6 + y * 12, 9, 7); } }
      const bm = K.std({ map: TX.toTexture(wc), emissiveMap: TX.toTexture(ec), emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.5, metalness: 0.3 });
      const blocks = [], tops = [];
      for (let i = 0, tries = 0; i < 30 && tries < 900; tries++) {
        const x = r.range(-142, 142), z = r.range(-100, 98), w = r.range(5, 8), h = r.range(7, 19);
        if (!K.offRoad(x, z, w + 4) || !K.offRoad(x, z - h * 0.3, w + 1) || !K.offRoad(x, z - h * 0.58, 3) || blocks.some((b) => Math.hypot(b.x - x, b.z - z) < 13)) continue;
        if (A.bots.some((b) => Math.hypot(b.x - x, b.z - z) < 16) || Math.hypot(x, z + 92) < 16 || Math.hypot(x - 80, z - 48) < 14) continue;
        blocks.push({ x, y: h / 2, z, sx: w, sy: h, sz: w, color: r.pick([0xffffff, 0xcfe0ff, 0xffd8f0]) });
        tops.push({ x, y: h + 0.3, z, sx: w + 0.6, sy: 0.6, sz: w + 0.6, color: r.pick([CY, MG, YL]) });
        K.box(x, z, w / 2, w / 2, 0, h + 3); K.contact(x, z, w * 0.9, w * 0.9, 0.5);
        i++;
      }
      K.instances(G.box(1, 1, 1), bm, blocks, { colors: true });
      for (const c of [CY, MG, YL]) { const l = tops.filter((t) => t.color === c); if (l.length) K.instances(G.box(1, 1, 1), glow(c, 1.3), l, { cast: false }); }
      // small tin robots standing about
      const mini = geoOf([P(G.rbox(2.4, 2.8, 1.8, 0.3), 0xffffff, 0, 2.6, 0), P(G.rbox(1.8, 1.5, 1.6, 0.3), 0xc8d0dc, 0, 4.8, 0), P(G.cyl(0.08, 0.08, 1, 4), 0xc8d0dc, 0, 6, 0), P(G.box(0.7, 1.4, 0.8), 0x3a4050, 0, 0.7, 0.55), P(G.box(0.7, 1.4, 0.8), 0x3a4050, 0, 0.7, -0.55), P(G.box(0.6, 2, 0.5), 0xc8d0dc, 0, 2.8, 1.25), P(G.box(0.6, 2, 0.5), 0xc8d0dc, 0, 2.8, -1.25), P(G.box(0.1, 0.5, 1.1), 0x15171c, 0.92, 4.9, 0)]);
      scatter(mini, tin, 34, [-144, 144, -100, 100], 3, (x, z) => (blocks.some((b) => Math.hypot(b.x - x, b.z - z) < 8) ? null : { x, y: 0, z, ry: r() * 6, s: r.range(0.8, 1.2), color: r.pick([0x4f8fd0, 0xd8423a, 0xf2c230, 0x6fc04b, 0xb46ad8]) }));
      // the rocket on its pad (north edge)
      toy([P(G.cyl(8, 8.6, 1, 20), 0x3a4050, 0, 0.5, 0), P(G.cyl(3.6, 4.2, 18, 16), 0xe8eef6, 0, 12, 0), P(G.cone(3.6, 8, 16), 0xd8423a, 0, 25, 0), P(G.cyl(3.7, 3.7, 1.4, 16), 0xd8423a, 0, 15, 0),
        ...[0, 1, 2].map((i) => P(G.box(0.5, 8, 5), 0xd8423a, Math.cos(i * 2.094) * 5, 5, Math.sin(i * 2.094) * 5, { ry: -i * 2.094 + PI / 2 })), P(G.cyl(1.2, 1.2, 0.3, 12), 0x25e6ff, 0, 17.5, 3.7, { rx: PI / 2 })], paint, 0, 0, -92);
      K.circle(0, -92, 8.6, 30); K.contact(0, -92, 11, 11, 0.5);
      // a flying saucer on a stand, its lights chasing round
      {
        const x = 80, z = 48;
        toy([P(G.cyl(2.4, 3, 0.8, 12), 0x3a4050, 0, 0.4, 0), P(G.cyl(0.3, 0.3, 9, 6), 0x8a94a8, 0, 5, 0), P(G.sph(1, 20), 0xc8d0dc, 0, 10, 0, { sx: 8, sy: 1.5, sz: 8 }), P(G.sph(3.4, 14), 0x7fe8ff, 0, 10.8, 0, { sy: 0.8 })], tin, x, 0, z);
        K.circle(x, z, 3, 6); K.contact(x, z, 8, 8, 0.4);
        for (let i = 0; i < 8; i++) { const m = glow(YL, 0.2), a = i * PI / 4; K.mesh(G.sph(0.6, 6), m, x + Math.cos(a) * 6.6, 9.6, z + Math.sin(a) * 6.6, { cast: false }); A.blink.push(m); }
      }
      // the neon sign on the north edge
      {
        const c = TX.makeCanvas(512, 128), g2 = c.getContext('2d');
        g2.fillStyle = '#0a0a12'; g2.fillRect(0, 0, 512, 128); g2.strokeStyle = '#25e6ff'; g2.lineWidth = 6; g2.strokeRect(8, 8, 496, 112);
        g2.fillStyle = '#ff3fb4'; g2.font = '82px "Lilita One", sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('ROBO CITY', 256, 68);
        const tx = TX.toTexture(c, { wrap: false });
        K.mesh(new T.PlaneGeometry(44, 11), K.std({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.5 }), 96, 15, -101, { rx: -0.35 });
        for (const dx of [-18, 18]) K.mesh(G.cyl(0.5, 0.5, 11, 6), K.metal(0x8a94a8, 0.4), 96 + dx, 5.5, -102);
      }
      // wind-up keys and batteries lying about
      const bat = geoOf([P(G.cyl(1.1, 1.1, 5, 10), 0xffffff, 0, 0, 0, { rz: PI / 2 }), P(G.cyl(1.12, 1.12, 1.4, 10), 0xc9a23a, 1.9, 0, 0, { rz: PI / 2 }), P(G.cyl(0.4, 0.4, 0.5, 6), 0xc8d0dc, 2.8, 0, 0, { rz: PI / 2 })]);
      scatter(bat, tin, 12, [-144, 144, -100, 100], 5, (x, z) => (blocks.some((b) => Math.hypot(b.x - x, b.z - z) < 9) ? null : { x, y: 1.1, z, ry: r() * 6, color: r.pick([0x25e6ff, 0xff3fb4, 0x6fc04b, 0xf59a23]) }));
    }
  },

  tick(dt, time, game) {
    if (!A || !A.gates.length) return;
    for (const g of A.gates) g.half.forEach((h, i) => { h.col.h = laser(g, i, time) === 2 ? 6 : 0; });
    const tr = game.track;
    for (const e of game.cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive' || c.airborne) continue;
      const onRoad = Math.abs(e.lateral ?? 0) < W / 2;
      // boost pads fire you along the road; the conveyor drags you back
      for (const p of A.pads) if (onRoad && mod(e.trackS - p.s, A.L) < p.len && c.speed < 66) { const q = tr.at(e.trackS); c.vx += q.tx * 85 * dt; c.vz += q.tz * 85 * dt; }
      if (onRoad && mod(e.trackS - A.sC0, A.L) < A.sC1 - A.sC0) { const q = tr.at(e.trackS); c.vx -= q.tx * 13 * dt; c.vz -= q.tz * 13 * dt; }
    }
    for (const b of A.bots) if (fired(A.prevT, time, ARM.period, b.phase - 1.0) && game.sound) game.sound.cue('tick', { x: b.x, z: b.z, game });
    for (const b of A.bots) if (fired(A.prevT, time, ARM.period, b.phase + 0.22) && game.state !== 'attract') game.physics.events.push({ type: 'clack', strength: 22, x: b.x, z: b.z });
    A.prevT = time;
  },

  animate(time) {
    if (!A || !A.gates.length) return;
    for (const g of A.gates) g.half.forEach((h, i) => {
      const v = laser(g, i, time);
      h.beam.visible = v > 0;
      h.beam.scale.x = h.beam.scale.z = v === 2 ? 1 : 0.35;
      h.mat.opacity = v === 2 ? 1 : 0.35 + 0.45 * (Math.sin(time * 50) > 0 ? 1 : 0);
    });
    for (const b of A.bots) {
      b.arm.rotation.y = -b.ang(time);
      const w = armWarn(b, time);
      b.eyes.color.setHex(w ? 0xff3030 : 0x7fffe0); b.eyes.emissive.setHex(w ? 0xff3030 : 0x7fffe0);
      b.eyes.emissiveIntensity = w ? 1.6 + Math.sin(time * 16) * 1.0 : 1.6;
    }
    A.pads.forEach((p, i) => { p.mat.emissiveIntensity = 1.1 + 0.7 * Math.sin(time * 9 - i); });
    A.belt.offset.y = (time * 2.2) % 1;
    A.blink.forEach((m, i) => { m.emissiveIntensity = mod(Math.floor(time * 6) - i, 8) < 2 ? 2.4 : 0.15; });
    void clamp;
  },
};
