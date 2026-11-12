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
// room kept free of tower blocks for the signs, billboards and other landmarks: [x, z, radius]
const KEEP = [[-50, 66, 19], [10, 60, 16], [-82, -54, 15], [84, -58, 15]];
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
  bounds: { minX: -186, maxX: 186, minZ: -136, maxZ: 136 },
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
    const TM = tmTools(K);
    const { G, P, toy, wedge, table, road, cutRibbon, startLine, scatter, sAt, geoOf } = TM;
    const L = track.length;
    A = { prevT: null, L, gates: [], bots: [], pads: [], blink: [], sR: 0, haz: [] };
    const paint = K.plastic(0xffffff, 0.4, { vertexColors: true });
    const tin = K.std({ color: 0xffffff, roughness: 0.35, metalness: 0.55, vertexColors: true });
    const glow = (c, k = 1.6) => K.std({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.5 });
    const CY = 0x25e6ff, MG = 0xff3fb4, YL = 0xffd23a, RD = 0xff3030;

    // ---------------- desk, the circuit-board mat ----------------
    table({ w: 380, d: 280, wood: [0x3a3038, 0x1c161c, 0x54464e], floorA: '#23232b', floorB: '#191920' });
    {
      // one painting for the colours and one for what glows: traces and chips, the neon spilling off the road's
      // edges, sector names, a lit border
      const MAT = { x0: -150, z0: -106, w: 300, d: 212, seed: 77 };
      const pcb = (em) => (g, C) => {
        const cw = g.canvas.width, ch = g.canvas.height, u = C.ppu, q = 4 * u;
        g.fillStyle = em ? '#000000' : '#0b1a1c'; g.fillRect(0, 0, cw, ch);
        if (!em) C.mottle(60, ['#0d2226', '#0a1517'], 10, 26, 0.5); else C.mottle(60, ['#000000'], 10, 26, 0.5);
        g.lineJoin = 'round'; g.lineWidth = Math.max(2, u * 0.55);
        for (let i = 0; i < 620; i++) {
          let x = Math.floor(C.rr() * cw / q) * q, y = Math.floor(C.rr() * ch / q) * q;
          const lit = C.rr() < 0.2, x0 = x, y0 = y;
          g.strokeStyle = em ? (lit ? '#0c8f88' : '#000000') : (lit ? '#1fd7c8' : '#12484a');
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 4; k++) { const d = Math.floor(C.rr() * 4), len = (2 + Math.floor(C.rr() * 8)) * q; x += [len, 0, -len, 0][d]; y += [0, len, 0, -len][d]; g.lineTo(x, y); }
          g.stroke();
          if (!em) for (const [px, py] of [[x0, y0], [x, y]]) { g.fillStyle = '#c9a23a'; g.beginPath(); g.arc(px, py, u * 1.1, 0, 7); g.fill(); g.fillStyle = '#0b1a1c'; g.beginPath(); g.arc(px, py, u * 0.45, 0, 7); g.fill(); }
        }
        for (let i = 0; i < 90; i++) {
          const x = Math.floor(C.rr() * cw / q) * q, y = Math.floor(C.rr() * ch / q) * q, w = (2 + Math.floor(C.rr() * 3)) * q, led = C.rr() < 0.5, lc = ['#ff3030', '#30ff80', '#ffd23a'][Math.floor(C.rr() * 3)];
          if (!em) { g.fillStyle = '#15171c'; g.fillRect(x, y, w, w); g.fillStyle = '#8a8f98'; for (let k = u; k < w; k += 2 * u) { g.fillRect(x + k, y - u, u * 0.7, u); g.fillRect(x + k, y + w, u * 0.7, u); } g.fillStyle = '#2a2e36'; g.fillRect(x + u, y + u, w - 2 * u, u * 1.2); }
          if (led) { g.fillStyle = lc; g.beginPath(); g.arc(x + w - u * 1.4, y + w - u * 1.4, u * 0.7, 0, 7); g.fill(); }
        }
        if (em) { C.band(1, 3.4, '#0b6a78', 0.95, 6, -(W / 2)); C.band(1, 3.4, '#7a1454', 0.95, 6, W / 2); } else C.band(W + 2, 4, '#070b0e', 0.7);
        const lab = (t, x, z, sz = 3.4, ang = 0) => C.text(t, x, z, sz, em ? '#0c7f86' : '#2fc0c8', { alpha: em ? 0.9 : 0.85, ang, font: '"Courier New", monospace', weight: 'bold', spacing: 0.5 });
        lab('ROBO CITY 3000', -40, 98.4, 5); lab('SECTOR 7', 46, 64); lab('CHARGING BAY', -96, 40.5, 2.8); lab('LAUNCH PAD', 0, -77, 3); lab('ARM REACH: KEEP OUT', 84, 34, 2.4, 0.3); lab('COOLANT', -58, -40, 2.6); lab('BELT 01', -12, 18, 2.6, Math.PI / 2);
        g.strokeStyle = em ? '#0c8f88' : '#1fd7c8'; g.lineWidth = u * 0.7; g.strokeRect(u * 1.6, u * 1.6, cw - u * 3.2, ch - u * 3.2);
        g.setLineDash([u * 6, u * 3]); g.lineWidth = u * 0.4; g.strokeRect(u * 3.4, u * 3.4, cw - u * 6.8, ch - u * 6.8); g.setLineDash([]);
      };
      const col = TM.groundCanvas(MAT, pcb(false)).texture(), glowMap = TM.groundCanvas(MAT, pcb(true)).texture();
      K.mesh(TM.groundUV(new T.BoxGeometry(300, 0.3, 212), 0, 0, MAT), K.std({ map: col, emissiveMap: glowMap, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.45, metalness: 0.2 }), 0, -0.15, 0, { cast: false });
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
          const hi = gate.half.length - 1;
          A.haz.push({ s, lo: side < 0 ? -99 : -0.8, hi: side < 0 ? 0.8 : 99, busy: (t) => laser(gate, hi, t) === 2 });
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
        const B = { s, phase, x: sh.x, z: sh.z, a0, a1, arm, eyes, side };
        const ang = (t) => B.a0 + (B.a1 - B.a0) * swing(B, t);
        B.ang = ang;
        K.mover({ type: 'capsule', r: 1.2, h: 6 }, (t) => { const a = ang(t); return { x1: B.x, z1: B.z, x2: B.x + Math.cos(a) * (ARM.len - 0.6), z2: B.z + Math.sin(a) * (ARM.len - 0.6) }; });
        A.bots.push(B);
        const tip = W / 2 + 0.8 - ARM.len - 1.6;
        A.haz.push(side > 0 ? { s, lo: tip, hi: 99, busy: (t) => swing(B, t) > 0.08 } : { s, lo: -99, hi: -tip, busy: (t) => swing(B, t) > 0.08 });
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
      for (let i = 0, tries = 0; i < 40 && tries < 1600; tries++) {
        const x = r.range(-142, 142), z = r.range(-100, 98), w = r.range(5, 8), h = r.range(7, 19);
        if (!K.offRoad(x, z, w + 4) || !K.offRoad(x, z - h * 0.3, w + 1) || !K.offRoad(x, z - h * 0.58, 3) || blocks.some((b) => Math.hypot(b.x - x, b.z - z) < 11)) continue;
        if (A.bots.some((b) => Math.hypot(b.x - x, b.z - z) < 16) || Math.hypot(x, z + 92) < 16 || Math.hypot(x - 80, z - 48) < 14 || Math.hypot(x + 96, z - 52) < 14 || Math.hypot(x + 132, z + 92) < 14 || Math.hypot(x - 134, z - 92) < 14 || KEEP.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr) || z < -96) continue;
        blocks.push({ x, y: h / 2, z, sx: w, sy: h, sz: w, color: r.pick([0xffffff, 0xcfe0ff, 0xffd8f0]) });
        tops.push({ x, y: h + 0.5, z, sx: w * 0.4, sy: 1, sz: w * 0.4, color: r.pick([CY, MG, YL]), w, h });
        K.box(x, z, w / 2, w / 2, 0, h + 3); K.contact(x, z, w * 0.9, w * 0.9, 0.5);
        i++;
      }
      K.instances(G.box(1, 1, 1), bm, blocks, { colors: true });
      // on the roofs: air-conditioning boxes, and a mast with a blinking beacon on the tall ones
      const ac = [], masts = [], beacons = [];
      for (const b of blocks) {
        const w = b.sx, h = b.sy;
        ac.push({ x: b.x - w * 0.22, y: h + 0.7, z: b.z + w * 0.2, sx: w * 0.28, sy: 0.9, sz: w * 0.22 }, { x: b.x + w * 0.24, y: h + 0.55, z: b.z - w * 0.22, sx: w * 0.2, sy: 0.6, sz: w * 0.2 });
        if (h > 12.5) { masts.push({ x: b.x + w * 0.25, y: h + 2.4, z: b.z + w * 0.25 }); beacons.push({ x: b.x + w * 0.25, y: h + 4.9, z: b.z + w * 0.25 }); }
      }
      K.instances(G.box(1, 1, 1), K.metal(0x596274, 0.6), ac, { cast: false });
      K.instances(G.cyl(0.1, 0.16, 4.8, 4), K.metal(0x8a94a8, 0.5), masts, { cast: false });
      A.beacon = glow(RD, 2); K.instances(G.sph(0.4, 6), A.beacon, beacons, { cast: false });
      // dark roofs with a parapet, a small lit roof light in one of three colours
      K.instances(G.box(1, 1, 1), K.std({ color: 0x2a2f3a, roughness: 0.8 }), tops.map((t) => ({ x: t.x, y: t.h + 0.15, z: t.z, sx: t.w + 0.5, sy: 0.3, sz: t.w + 0.5 })), { cast: false });
      for (const c of [CY, MG, YL]) { const l = tops.filter((t) => t.color === c); if (l.length) K.instances(G.box(1, 1, 1), glow(c, 1.1), l, { cast: false }); }
      // street lamps along the outside of the road
      const lamps = [], heads = [];
      for (let s = 12; s < L; s += 34) { const sd = Math.floor(s / 34) % 2 ? 1 : -1, q = track.place(s, sd * (W / 2 + 2.6)); lamps.push({ x: q.x, y: 2.2, z: q.z }); heads.push({ x: q.x, y: 4.6, z: q.z }); }
      K.instances(G.cyl(0.18, 0.25, 4.4, 5), K.metal(0x596274, 0.5), lamps);
      K.instances(G.sph(0.55, 8), glow(0xeaf4ff, 1.8), heads, { cast: false });
      // the energy core in the south-west pocket: a pulsing sphere inside turning rings
      {
        const x = -96, z = 52;
        toy([P(G.cyl(6, 6.6, 1, 16), 0x3a4050, 0, 0.5, 0), ...[0, 1, 2].map((i) => P(G.cyl(0.5, 0.7, 9, 6), 0x8a94a8, Math.cos(i * 2.094) * 5, 4.5, Math.sin(i * 2.094) * 5, { rz: Math.cos(i * 2.094) * 0.25, rx: -Math.sin(i * 2.094) * 0.25 }))], tin, x, 0, z);
        A.coreMat = glow(CY, 2); K.mesh(G.sph(2.6, 14), A.coreMat, x, 7.4, z, { cast: false });
        A.rings = [0, 1].map((i) => K.mesh(G.tor(4 + i * 0.9, 0.22, PI * 2, 24), glow(i ? MG : YL, 1.4), x, 7.4, z, { cast: false }));
        K.circle(x, z, 6.4, 12); K.contact(x, z, 8, 8, 0.5);
      }
      // the giant robot in the north-west corner, a radar dish turning in the south-east
      {
        const x = -132, z = -92, c1 = 0x4f8fd0, c2 = 0xc8d0dc;
        toy([P(G.rbox(9, 10, 6.5, 0.8), c1, 0, 13, 0), P(G.rbox(6, 5, 5, 0.8), c2, 0, 21, 0), P(G.rbox(3, 8, 3.4, 0.6), c2, -2.6, 4, 0), P(G.rbox(3, 8, 3.4, 0.6), c2, 2.6, 4, 0), P(G.rbox(2.4, 9, 2.8, 0.6), c2, -6, 13, 0), P(G.rbox(2.4, 9, 2.8, 0.6), c2, 6, 13, 0), P(G.cyl(0.2, 0.2, 4, 5), c2, 0, 25.5, 0), P(G.sph(0.7, 8), RD, 0, 27.6, 0), P(G.box(5, 3, 0.3), 0x15171c, 0, 13.6, 3.3), P(G.box(4, 0.8, 0.3), 0x15171c, 0, 19.8, 2.55)], tin, x, 0, z);
        for (const d of [-1.5, 1.5]) K.mesh(G.sph(0.8, 8), glow(YL, 2), x + d, 21.8, z + 2.6, { cast: false });
        for (let i = 0; i < 3; i++) K.mesh(G.box(0.9, 0.9, 0.2), glow([CY, MG, YL][i], 1.6), x - 1.4 + i * 1.4, 13.6, z + 3.5, { cast: false });
        K.box(x, z, 5.5, 3.5, 0, 30); K.contact(x, z, 9, 6, 0.5);
        const rx = 134, rz = 92;
        toy([P(G.cyl(3, 3.6, 1.2, 12), 0x3a4050, 0, 0.6, 0), P(G.cyl(0.7, 0.9, 7, 8), 0x8a94a8, 0, 4.5, 0)], tin, rx, 0, rz);
        A.dish = toy([P(K.lathe([[0.3, 0], [3, 0.6], [5, 1.8], [5.6, 2.8]], 20), 0xe8eef6, 0, 0, 0, { rx: PI / 2 - 0.5 }), P(G.cyl(0.12, 0.12, 4, 5), 0x8a94a8, 0, 1, 1.8, { rx: PI / 2 - 0.5 }), P(G.sph(0.45, 6), RD, 0, 2, 3.5)], tin, rx, 8.4, rz);
        K.circle(rx, rz, 3.6, 10); K.contact(rx, rz, 5, 5, 0.5);
      }
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
    // ================= detail pass: the start gantry, road markings, traffic in the air, adverts, the desk round the mat =================
    {
      TM.signBoard(-50, 66, 'ROBO RUMBLE', { w: 28, h: 5.8, y: 6.5, bg: '#0a0a14', fg: '#25e6ff', edge: '#ff3fb4', post: 0x596274, glow: 1.5 });
      // the start gantry with its row of lights
      {
        const p = track.at(31.5), hw = W / 2 + 1.7;
        toy([P(G.box(0.9, 0.9, hw * 2), 0x596274, 0, 8, 0), P(G.cyl(0.5, 0.7, 8, 8), 0x8a94a8, 0, 4, hw), P(G.cyl(0.5, 0.7, 8, 8), 0x8a94a8, 0, 4, -hw), P(G.box(1.6, 0.5, 1.6), 0x3a4050, 0, 0.25, hw), P(G.box(1.6, 0.5, 1.6), 0x3a4050, 0, 0.25, -hw)], tin, p.x, 0, p.z, p.angle);
        for (const sg of [-1, 1]) { const q = track.place(31.5, sg * hw); K.circle(q.x, q.z, 0.8, 8); }
        A.startLights = [-2, -1, 0, 1, 2].map((i) => { const q = track.place(31.5, i * 2.4), m = glow(0x30ff80, 1.5); K.mesh(G.sph(0.55, 8), m, q.x, 8.75, q.z, { cast: false }); return m; });
      }
      // dashes down the middle of the road
      const dash = [];
      for (let d = 4; d < L; d += 7) { const q = track.at(d); dash.push({ x: q.x, y: 0.1, z: q.z, ry: -q.angle }); }
      K.instances(G.box(2.2, 0.02, 0.24), glow(0xdfe8ff, 0.45), dash, { cast: false });
      // warning stripes before each laser gate, a hatched red patch where each guard's arm comes down
      const stripes = (c1, c2) => (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2; for (let i = -h; i < w + h; i += 22) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.lineTo(i + h + 11, 0); g.lineTo(i + 11, h); g.fill(); } };
      for (const gt of A.gates) TM.decal(gt.s - 8, 0, 3.2, W - 1, stripes('rgba(20,16,0,0.9)', '#ffd23a'), { glow: 0.5, px: 256 });
      for (const b of A.bots) TM.decal(b.s, b.side * (W / 2 - 4), 3.6, 8.4, stripes('rgba(60,0,0,0.55)', 'rgba(255,48,48,0.85)'), { glow: 0.6, px: 128 });

      // drones holding station over the city
      const drone = geoOf([P(G.rbox(1.8, 0.7, 1.8, 0.3), 0xc8d0dc, 0, 0, 0), P(G.box(4.6, 0.16, 0.3), 0x596274, 0, 0.1, 0, { ry: 0.785 }), P(G.box(4.6, 0.16, 0.3), 0x596274, 0, 0.1, 0, { ry: -0.785 }), ...[0, 1, 2, 3].map((i) => P(G.cyl(1.1, 1.1, 0.06, 10), 0x2a2f3a, Math.cos(0.785 + i * 1.571) * 2.2, 0.3, Math.sin(0.785 + i * 1.571) * 2.2))]);
      A.drones = [];
      for (const [x, z] of [[-22, 62], [70, -52], [-74, 2], [22, -34], [100, -4], [-126, -12], [132, 12], [-30, -98]]) {
        if (!K.offRoad(x, z, 4) || !K.offRoad(x, z - 5, 3)) continue;
        const m = K.add(new T.Mesh(drone, tin)); m.add(new T.Mesh(G.sph(0.45, 6), glow([CY, MG, YL][A.drones.length % 3], 2)));
        m.children[0].position.y = -0.5;
        A.drones.push({ m, x, z, ph: r() * 6, y: r.range(8, 11) });
      }
      // the monorail along the north edge
      {
        const z = -102.5, x0 = -116, x1 = -18, y = 6;
        const parts = [P(G.box(x1 - x0, 0.5, 1), 0x8a94a8, (x0 + x1) / 2, y, z)];
        for (let x = x0; x <= x1; x += 14) parts.push(P(G.cyl(0.5, 0.7, y, 6), 0x596274, x, y / 2, z));
        toy(parts, tin);
        A.train = toy([0, 1, 2].flatMap((i) => [P(G.rbox(6, 2.2, 2.2, 0.7), i === 1 ? 0xe8eef6 : 0xff3fb4, i * 6.6, 1.5, 0), P(G.box(4.4, 0.8, 2.3), 0x15171c, i * 6.6, 1.8, 0)]), tin, x0 + 4, y, z);
        A.trainX = [x0 + 4, x1 - 18];
      }
      // neon adverts
      TM.signBoard(10, 60, 'OIL BAR', { w: 18, h: 5, y: 6, bg: '#1a0a1e', fg: '#ff3fb4', edge: '#ffd23a', post: 0x596274, glow: 1.5, sub: 'OPEN 25 HOURS' });
      TM.signBoard(-82, -54, 'CHARGE 3000', { w: 20, h: 5, y: 6, bg: '#06141e', fg: '#30ff80', edge: '#25e6ff', post: 0x596274, glow: 1.5 });
      TM.signBoard(84, -58, 'ROBO-COLA', { w: 18, h: 5, y: 6, bg: '#1e0a0a', fg: '#ffd23a', edge: '#ff3030', post: 0x596274, glow: 1.5, sub: 'NOW WITH REAL BOLTS' });
      // searchlights at the launch pad
      A.beams = [-1, 1].map((sg) => {
        const g = new T.ConeGeometry(5, 46, 14, 1, true); g.translate(0, -23, 0); g.rotateX(PI);
        const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
        m.position.set(sg * 11, 1, -94); K.add(m, { cast: false });
        toy([P(G.cyl(1.2, 1.5, 1.6, 10), 0x596274, 0, 0.8, 0), P(G.sph(1, 8), 0xdfe8ff, 0, 1.8, 0)], tin, sg * 11, 0, -94);
        return m;
      });
    }

    // ================= the workbench round the mat =================
    {
      TM.flat(-168, 42, 30, 40, (g, w, h) => {
        g.fillStyle = '#10182c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3fb4'; g.fillRect(0, 0, w, h * 0.16); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `${Math.round(h * 0.085)}px "Lilita One", sans-serif`; g.fillText('ROBO CITY 3000', w / 2, h * 0.11);
        g.fillStyle = '#4f8fd0'; g.fillRect(w * 0.32, h * 0.42, w * 0.36, h * 0.3); g.fillStyle = '#c8d0dc'; g.fillRect(w * 0.37, h * 0.26, w * 0.26, h * 0.15); g.fillRect(w * 0.36, h * 0.72, w * 0.1, h * 0.14); g.fillRect(w * 0.54, h * 0.72, w * 0.1, h * 0.14); g.fillRect(w * 0.2, h * 0.44, w * 0.1, h * 0.22); g.fillRect(w * 0.7, h * 0.44, w * 0.1, h * 0.22);
        g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(w * 0.44, h * 0.33, w * 0.03, 0, 7); g.arc(w * 0.56, h * 0.33, w * 0.03, 0, 7); g.fill();
        g.fillStyle = '#25e6ff'; g.font = `${Math.round(h * 0.05)}px "Lilita One", sans-serif`; g.fillText('248 PIECES · AGES 6+', w / 2, h * 0.95);
      }, { thick: 5, ang: 0.1, edge: 0x10182c, glow: 0.25 });
      K.box(-168, 42, 15, 20, 0.1, 5); K.contact(-168, 42, 17, 22, 0.5, 0.1);
      // a mug, a soldering iron on its stand, screwdrivers, gears and bolts, the plans on a tablet
      toy([P(G.cyl(11, 10, 16, 22), 0xe8eef6, 0, 8, 0), P(G.cyl(9.8, 9.8, 0.3, 22), 0x3a2418, 0, 14.6, 0), P(G.tor(5.4, 1.5, PI, 14), 0xe8eef6, 12, 8, 0, { rz: -PI / 2 })], paint, -168, 0, -60, 0.6);
      K.circle(-168, -60, 11.4, 20); K.contact(-168, -60, 14, 14, 0.5);
      toy([P(G.cyl(5, 6, 1.6, 14), 0x3a4050, 0, 0.8, 0), P(G.tor(2.6, 0.3, PI * 2, 10), 0xc8d0dc, 0, 5, 0, { ry: 0 }), P(G.cyl(0.3, 0.3, 4, 5), 0xc8d0dc, 0, 3, 0),
        P(G.cyl(1.4, 1.6, 16, 10), 0xf59a23, 0, 6.6, 9, { rx: PI / 2 - 0.25 }), P(G.cyl(0.5, 0.6, 9, 8), 0xc8d0dc, 0, 4.4, -2.5, { rx: PI / 2 - 0.25 })], tin, 168, 0, -40, 0.3);
      A.ironTip = glow(0xff7a2a, 1.6); K.mesh(G.cone(0.5, 2.4, 6), A.ironTip, 168 - 2.2, 3.3, -40 - 7.3, { rx: -PI / 2 - 0.25, ry: -0.3, cast: false });
      K.circle(168, -40, 6, 4); K.capsule(170.5, -32, 173.5, -22, 1.6, 8);
      const sd = [];
      for (const [x, z, a, c] of [[30, 122, 0.1, 0xe8443a], [62, 126, -0.2, 0xffd23a], [-96, 123, 0.3, 0x25e6ff], [172, 84, 1.3, 0x6fc04b]]) { sd.push(P(G.cyl(1.3, 1.3, 9, 8), c, x - Math.cos(a) * 6, 1.3, z - Math.sin(a) * 6, { rz: PI / 2, ry: -a }), P(G.cyl(0.4, 0.4, 13, 6), 0xc8d0dc, x + Math.cos(a) * 5, 1.3, z + Math.sin(a) * 5, { rz: PI / 2, ry: -a })); K.capsule(x - Math.cos(a) * 10, z - Math.sin(a) * 10, x + Math.cos(a) * 11, z + Math.sin(a) * 11, 1.2, 2.6); }
      toy(sd, tin);
      const gear = geoOf([P(G.cyl(2, 2, 0.5, 12), 0xffffff, 0, 0.25, 0), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => P(G.box(0.8, 0.5, 0.8), 0xffffff, Math.cos(i * 0.785) * 2.2, 0.25, Math.sin(i * 0.785) * 2.2, { ry: -i * 0.785 })), P(G.cyl(0.6, 0.6, 0.52, 8), 0x2a2f3a, 0, 0.26, 0)]);
      const bits = [], bolts = [];
      for (let i = 0; i < 40; i++) {
        const side = i % 4, x = side === 0 ? r.range(-184, -154) : side === 1 ? r.range(154, 184) : r.range(-180, 180), z = side === 2 ? r.range(-134, -110) : side === 3 ? r.range(110, 134) : r.range(-130, 130);
        if (Math.hypot(x + 168, z - 42) < 26 || Math.hypot(x + 168, z + 60) < 16 || Math.hypot(x - 168, z + 40) < 14 || (Math.abs(x - 60) < 26 && z < -106)) continue;
        if (i % 3) bolts.push({ x, y: 0.5, z, ry: r() * 6, rz: PI / 2, color: 0xc8d0dc }); else bits.push({ x, y: 0, z, ry: r() * 6, s: r.range(0.8, 1.6), color: r.pick([0xc9a23a, 0xc8d0dc, 0x8a94a8]) });
      }
      K.instances(gear, K.metal(0xffffff, 0.4), bits, { colors: true });
      K.instances(G.cyl(0.5, 0.5, 2.4, 6), K.metal(0xffffff, 0.4), bolts, { colors: true });
      TM.flat(60, -122, 44, 24, (g, w, h) => {
        g.fillStyle = '#06203a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#25e6ff'; g.lineWidth = 1.5; g.globalAlpha = 0.35; for (let x = 0; x < w; x += w / 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += h / 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.globalAlpha = 1; g.lineWidth = 3; g.strokeRect(w * 0.12, h * 0.3, w * 0.2, h * 0.42); g.strokeRect(w * 0.16, h * 0.12, w * 0.12, h * 0.18); g.beginPath(); g.arc(w * 0.6, h * 0.5, h * 0.28, 0, 7); g.stroke(); g.beginPath(); g.arc(w * 0.6, h * 0.5, h * 0.1, 0, 7); g.stroke();
        g.fillStyle = '#25e6ff'; g.font = `${Math.round(h * 0.09)}px "Courier New", monospace`; g.fillText('UNIT RB-3000 // REV C', w * 0.1, h * 0.92);
      }, { thick: 0.8, ang: -0.05, edge: 0x15171c, glow: 0.9 });
    }

  },

  aiHazards() { return A ? A.haz : null; },

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
    A.coreMat.emissiveIntensity = 1.6 + 1.2 * Math.sin(time * 3.2);
    if (A.drones) {
      for (const d of A.drones) { d.m.position.set(d.x + Math.cos(time * 0.5 + d.ph) * 2.5, d.y + 0.6 * Math.sin(time * 1.7 + d.ph), d.z + Math.sin(time * 0.4 + d.ph) * 2.5); d.m.rotation.y = time * 0.6 + d.ph; d.m.rotation.z = 0.08 * Math.sin(time * 2 + d.ph); }
      const k = 0.5 - 0.5 * Math.cos(time * 0.35); A.train.position.x = A.trainX[0] + (A.trainX[1] - A.trainX[0]) * k;
      A.beacon.emissiveIntensity = (time % 1.4) < 0.25 ? 3 : 0.15;
      A.startLights.forEach((m, i) => { m.emissiveIntensity = 0.5 + 1.6 * Math.max(0, Math.sin(time * 4 - i * 0.9)); });
      A.beams.forEach((m, i) => { m.rotation.z = 0.35 * Math.sin(time * 0.5 + i * 2.1); m.rotation.x = 0.3 * Math.cos(time * 0.37 + i); });
      A.ironTip.emissiveIntensity = 1.2 + 0.5 * Math.sin(time * 2.3);
    }
    A.rings.forEach((m, i) => { m.rotation.x = time * (0.9 + i * 0.5); m.rotation.y = time * (0.6 - i * 1.1); });
    A.dish.rotation.y = time * 0.7;
    A.blink.forEach((m, i) => { m.emissiveIntensity = mod(Math.floor(time * 6) - i, 8) < 2 ? 2.4 : 0.15; });
    void clamp;
  },
};
