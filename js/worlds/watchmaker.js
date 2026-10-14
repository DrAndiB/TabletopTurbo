// World 16: the watchmaker's bench at night. Under a big magnifier lamp a giant pocket-watch movement lies open
// on a green bench mat, and the race runs across its works: up a spare bridge onto the perlage plate, round the
// turning mainspring barrel and centre wheel (both carry you along), over a jump across the motion-works pit and
// off the plate's west edge; along the bench past tweezers and a spilt oil pot, up again on the far side, round
// the swinging balance wheel and its hairspring, through the escapement (a ruby pallet that blocks half the road
// on every beat), against the turning fourth wheel, along a skeletonised bridge between open pits and off the
// edge again, round a pocket-watch case and across an enamel dial to the line at XII.

const PI = Math.PI, TAU = PI * 2;
const MV = { x: -28, z: 0, R: 84, H: 3 }; // the movement: centre, radius, plate height

const RAW = [
  [138, 63.2], [136.8, 37.6], [135.6, 12], [134.4, -13.7], [133.2, -39.3], [132, -64.9], [128.8, -74.9], [120.9, -81.9], [110.6, -84],
  [100.7, -80.5], [80.2, -66.5], [59.7, -52.4], [39.2, -38.4], [18.7, -24.3], [8.5, -21], [-1.9, -23.8], [-32.5, -42.4], [-37, -44.2],
  [-41.9, -44.4], [-66, -41.2], [-90.1, -38.1], [-114.2, -35], [-138.3, -31.9], [-146.6, -28.6], [-152.2, -21.8], [-154, -13.1],
  [-152.6, 12.3], [-151.3, 37.7], [-150, 63], [-146.2, 73.8], [-137.1, 80.7], [-125.7, 81.5], [-115.7, 76], [-101.3, 61.3],
  [-86.8, 46.6], [-72.3, 31.8], [-66.3, 28.1], [-59.2, 27.8], [-32.8, 33], [-6.4, 38.3], [1.1, 37.4], [26.4, 26.2], [51.8, 15.1],
  [77.1, 3.9], [88.1, 2.1], [98.5, 5.9], [105.7, 14.3], [108, 25.1], [107, 44.1], [106, 63.2], [107.9, 71.5], [113.7, 77.7],
  [122, 80], [130.2, 77.7], [136.1, 71.6],
];
// a little narrower on the movement (13) than on the bench (14)
const TRACK = RAW.map(([x, z]) => [x, z, Math.hypot(x - MV.x, z - MV.z) < MV.R + 3 ? 13 : 14]);
const START_S = 63;
const BOUNDS = { minX: -172, maxX: 172, minZ: -104, maxZ: 104 };

// The going train. Every driven wheel is a spinner deck flush with the plate; the road arcs round each one on
// a circle concentric with its arbor, so a turning wheel only moves you along the road (a conveyor) without
// twisting you off it. Barrel and centre wheel turn with the race, the fourth wheel against it.
const GEAR = {
  barrel: { x: 8, z: -40, rho: 19, R: 26, n: 34, w: 0.45 },
  centre: { x: -40, z: -30, rho: 14.5, R: 22.5, n: 29, w: 0 },
  balance: { x: -62, z: 42, rho: 14.5, R: 22 },
  fourth: { x: -4, z: 26, rho: 12.5, R: 20, n: 26, w: 0.9 },
  third: { x: -22, z: -2, R: 10.5, n: 15 },
  escape: { x: -30, z: 51.5, R: 10.5 },
};
GEAR.centre.w = -GEAR.barrel.w * GEAR.barrel.R / GEAR.centre.R; // meshes with the barrel
GEAR.third.w = -GEAR.centre.w * GEAR.centre.R / GEAR.third.R;
const BAL = { P: 2.8, amp: 0.5 };           // balance: swings +-0.5 rad, one beat each half period
const BEAT = BAL.P / 2;
const GATE = { lat: 3.25, hw: 2.2, hd: 3.6, h: 2.8, tr: 0.2, warn: 0.55 };
const balAngle = (t) => BAL.amp * Math.sin(TAU * t / BAL.P);
const escAngle = (t) => { const k = Math.floor(t / BEAT), u = t - k * BEAT, f = Math.min(1, u / 0.12); return (k + f * f * (3 - 2 * f)) * TAU / 15; };
// the ruby pallet: blocks the left half of the road on one beat, the right half on the next
function palletLat(t) {
  const k = Math.floor(t / BEAT), u = t - k * BEAT, side = (k & 1) ? 1 : -1;
  if (u >= GATE.tr) return side * GATE.lat;
  const f = u / GATE.tr, e = f * f * (3 - 2 * f);
  return (-side + 2 * side * e) * GATE.lat;
}
const anchorAngle = (t) => palletLat(t) / GATE.lat * 0.16;

let A = null;

export default {
  id: 'watchmaker',
  name: "Watchmaker's Bench",
  blurb: 'Race across an open watch movement: turning wheels, a ticking pallet and a balance.',
  vehicle: 'sports',
  seed: 47,
  track: { points: TRACK, width: 14, startS: START_S },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 15,
  skidColor: 0x15120f,
  dustColor: 0xc9b98f,
  dust: {
    normal: null,
    slick: { color: 0xd8a032, size: 0.6, life: 0.55, up: 3, grav: 22, alpha: 0.95, grow: 1, rate: 1.6 },
    rough: { color: 0x9fb4ff, size: 0.35, life: 0.25, up: 5, grav: 40, alpha: 1, grow: 1, rate: 2.5 },
  },
  lighting: {
    sunDir: [-0.16, 1, -0.62], sunColor: 0xffe4c2, sunIntensity: 0.95,
    hemiSky: 0x7a7f96, hemiGround: 0x1c140d, hemiIntensity: 0.2,
    envIntensity: 0.3, exposure: 1.06, background: 0x070605, shadowRadius: 2.2,
    fog: { color: 0x090706, near: 210, far: 600 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length, H = MV.H;
    const BU = K.BufferGeometryUtils;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const keep = []; // animated objects: not merged
    A = { rot: [], screws: [], lastBeat: -1, glints: [] };
    const sAt = (x, z) => track.distTo(x, z).s;
    const dM = (x, z) => Math.hypot(x - MV.x, z - MV.z);
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`watchmaker: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // batched contact shadows (opacity rides in the unused y scale)
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.05) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });

    // ============================================================================================
    // ENVIRONMENT for the metals: a dark workshop with the ring of the magnifier lamp overhead
    // ============================================================================================
    const ENV = (() => {
      const W = 512, Hh = 256, c = TX.makeCanvas(W, Hh), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, Hh);
      gr.addColorStop(0, '#5c4c3a'); gr.addColorStop(0.1, '#45392c'); gr.addColorStop(0.22, '#2e251c'); gr.addColorStop(0.4, '#17120e');
      gr.addColorStop(0.5, '#0c0a08'); gr.addColorStop(1, '#040303');
      g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      // the lamp's ring tube near the zenith, brightest towards the north (u = 0.25)
      for (let k = 0; k < 2; k++) {
        const y = 14 + k * 7;
        const band = g.createLinearGradient(0, y - 7, 0, y + 7);
        band.addColorStop(0, 'rgba(255,236,205,0)'); band.addColorStop(0.5, `rgba(255,246,228,${k ? 0.75 : 1})`); band.addColorStop(1, 'rgba(255,236,205,0)');
        g.fillStyle = band; g.fillRect(0, y - 7, W, 14);
      }
      const blob = (x, y, rx, ry, col) => { const q = g.createRadialGradient(x, y, 0, x, y, rx); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = q; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore(); };
      blob(128, 30, 90, 26, 'rgba(255,226,180,0.24)');
      blob(128, 44, 60, 16, 'rgba(255,214,160,0.14)');
      blob(384, 60, 70, 20, 'rgba(120,140,190,0.18)'); // the dark window behind
      blob(250, 112, 24, 12, 'rgba(255,170,90,0.35)'); // a far bench lamp
      blob(20, 104, 30, 10, 'rgba(255,190,120,0.25)');
      const t = TX.toTexture(c, { wrap: false });
      t.mapping = T.EquirectangularReflectionMapping;
      return t;
    })();
    const MET = (color, rough, extra = {}) => K.std({ color, roughness: rough, metalness: 1, envMap: ENV, envMapIntensity: 1, ...extra });

    // ============================================================================================
    // TEXTURES
    // ============================================================================================
    // perlage (circular graining): overlapping spots, each with fine concentric rings
    const perlage = (() => {
      const S = 256, n = 4, gs = S / n, Rr = gs * 0.7;
      const hgt = new Float32Array(S * S), col = new Float32Array(S * S);
      const pr = K.rng(5), bright = [];
      for (let i = 0; i < n * n; i++) bright.push(0.9 + pr() * 0.12);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let best = -1e9, bd = 0, bi = 0;
        const j0 = Math.floor(y / gs);
        for (let dj = -1; dj <= 1; dj++) {
          const j = j0 + dj, off = (((j % 2) + 2) % 2) ? gs / 2 : 0;
          const i0 = Math.floor((x - off) / gs);
          for (let di = -1; di <= 1; di++) {
            const i = i0 + di, cx = i * gs + off + gs / 2, cy = j * gs + gs / 2;
            const d = Math.hypot(x - cx, y - cy);
            if (d < Rr) { const ord = j * 1000 + i; if (ord > best) { best = ord; bd = d; bi = (((j % n) + n) % n) * n + (((i % n) + n) % n); } }
          }
        }
        const f = bd / Rr;
        hgt[y * S + x] = 0.55 + 0.09 * Math.cos(f * 15) * (1 - f * 0.5) - (f > 0.86 ? (f - 0.86) * 2.2 : 0);
        col[y * S + x] = bright[bi] * (0.95 + 0.05 * Math.cos(f * 15)) * (f > 0.9 ? 0.9 : 1);
      }
      const map = TX.paint(S, S, (x, y, u, v, o) => { const k = col[y * S + x] * 236; o[0] = k; o[1] = k * 0.985; o[2] = k * 0.96; });
      const rough = TX.paint(S, S, (x, y, u, v, o) => { const k = (0.42 + (0.55 - hgt[y * S + x]) * 0.5) * 255; o[0] = o[1] = o[2] = Math.max(20, Math.min(255, k)); });
      return { map: TX.toTexture(map), normalMap: TX.toTexture(TX.normalFromHeight(hgt, S, S, 1.6), { srgb: false }), roughnessMap: TX.toTexture(rough, { srgb: false }) };
    })();
    // Geneva stripes (Cotes de Geneve): bands of curved fine grooves, each band shaded light to dark
    const geneva = (bands = 3, W = 128, Hh = 256) => {
      const hgt = new Float32Array(W * Hh);
      const map = TX.paint(W, Hh, (x, y, u, v, o) => {
        const bu = u * bands, b = Math.floor(bu), f = bu - b;
        const ph = v * 12 + (f - 0.5) * (f - 0.5) * 6 + b * 0.37;
        const gro = Math.cos(ph * TAU);
        const edge = Math.min(f, 1 - f);
        hgt[y * W + x] = 0.5 + 0.05 * gro - (edge < 0.035 ? (0.035 - edge) * 6 : 0);
        const k = (0.84 + 0.16 * Math.pow(1 - f, 1.4)) * (0.97 + 0.03 * gro) * (edge < 0.02 ? 0.8 : 1);
        o[0] = o[1] = o[2] = 240 * k;
      });
      return { map: TX.toTexture(map), normalMap: TX.toTexture(TX.normalFromHeight(hgt, W, Hh, 1.4), { srgb: false }) };
    };
    const genRoad = geneva(3);
    const genBridge = geneva(5, 128, 128);
    // circular graining for wheel faces (rotation invariant, so the rings look still while the wheel turns)
    const ringNormal = (() => {
      const S = 512, hgt = new Float32Array(S * S), nf = TX.noiseField(128, { seed: 9, period: 8, oct: 3 });
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const rr = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
        hgt[y * S + x] = 0.5 + 0.1 * Math.cos(rr * TAU * 26 + nf[(y >> 2) * 128 + (x >> 2)] * 2);
      }
      return TX.toTexture(TX.normalFromHeight(hgt, S, S, 1.6), { srgb: false, wrap: false });
    })();

    // ============================================================================================
    // MATERIALS
    // ============================================================================================
    for (const t of Object.values(perlage)) t.repeat.set(1 / 10, 1 / 10);
    const plateTop = MET(0xd8d3c8, 0.45, { map: perlage.map, normalMap: perlage.normalMap, normalScale: V2(0.5), roughnessMap: perlage.roughnessMap, envMapIntensity: 1.25 });
    const plateSide = MET(0xe6e0d2, 0.1, { envMapIntensity: 1.4 });
    const gilt = MET(0xe0b65e, 0.24, { metalness: 0.85, envMapIntensity: 1.2 });
    const giltDark = MET(0x9a7a3a, 0.4);
    const steel = MET(0xc8ccd2, 0.16, { envMapIntensity: 1.1 });
    const steelDark = MET(0x8a8f96, 0.3);
    const blued = MET(0x3a68e0, 0.28, { envMapIntensity: 2.2 });
    const ruby = K.phys({ color: 0xc0102c, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0x5a0010, emissiveIntensity: 0.6, envMap: ENV, envMapIntensity: 2, sheen: 0.4, sheenColor: new T.Color(0xff6080) });
    const sinkMat = K.std({ color: 0x241d14, roughness: 0.7, metalness: 0.4 });
    const pitFloor = MET(0x6b5532, 0.45, { map: perlage.map, normalMap: perlage.normalMap, envMapIntensity: 0.5 });

    // ============================================================================================
    // BENCH, MAT, FLOOR
    // ============================================================================================
    {
      const bw = BOUNDS.maxX - BOUNDS.minX, bd = BOUNDS.maxZ - BOUNDS.minZ;
      const wood = TX.woodTextures({ size: 512, seed: 17, planks: 4, base: 0x5a3820, dark: 0x2e1b0e, light: 0x7d5232, ringFreq: 14, gap: 0.003, roughBase: 0.45, lacquer: 0.3 });
      for (const t of Object.values(wood)) { t.repeat.set(bw / 90, bd / 90); t.rotation = PI / 2; t.center.set(0.5, 0.5); }
      const benchMat = K.std({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, normalScale: V2(0.5) });
      K.mesh(new K.RoundedBoxGeometry(bw, 6, bd, 2, 0.8), benchMat, 0, -3.35, 0, { cast: false });
      const legMat = K.std({ map: wood.map, color: 0x6a4a30, roughness: 0.6 });
      K.mesh(new T.BoxGeometry(bw - 14, 9, bd - 14), legMat, 0, -10, 0, { cast: false });
      for (const [x, z] of [[-160, -92], [160, -92], [-160, 92], [160, 92]]) K.mesh(new T.BoxGeometry(9, 70, 9), legMat, x, -42, z, { cast: false });
      // green rubber bench mat
      const mt = TX.mottledTextures({ size: 512, a: 0x2f6c4d, b: 0x285e43, c: 0x3a7756, seed: 23, period: 7, speck: 0.08, bump: 1.4 });
      for (const t of Object.values(mt)) t.repeat.set(5, 3);
      const matMat = K.std({ map: mt.map, normalMap: mt.normalMap, normalScale: V2(0.6), roughness: 0.82 });
      K.mesh(new K.RoundedBoxGeometry(bw - 10, 0.5, bd - 10, 2, 0.22), matMat, 0, -0.25, 0, { cast: false });
      // workshop floor far below: dark boards
      const fw = TX.woodTextures({ size: 512, seed: 31, planks: 6, base: 0x3a2a1e, dark: 0x1d140d, light: 0x51392a, ringFreq: 10, gap: 0.006, roughBase: 0.7 });
      for (const t of Object.values(fw)) { t.repeat.set(8, 8); }
      K.mesh(new T.PlaneGeometry(1600, 1600), K.std({ map: fw.map, normalMap: fw.normalMap, roughness: 0.8, color: 0x8a7a6a }), 0, -76, 0, { rx: -PI / 2, cast: false });
    }

    // ============================================================================================
    // KEY PLACES along the track (computed from the layout)
    // ============================================================================================
    const N = track.N;
    A.plateau = new Uint8Array(N);
    for (let i = 0; i < N; i++) A.plateau[i] = dM(track.x[i], track.z[i]) < MV.R - 2 ? 1 : 0;
    // plate edge crossings (in = onto the plate)
    const cross = [];
    for (let i = 0; i < N; i++) {
      const a = dM(track.x[i], track.z[i]) < MV.R, b = dM(track.x[(i + 1) % N], track.z[(i + 1) % N]) < MV.R;
      if (a !== b) cross.push({ s: (i + 0.5) * track.ds, into: b });
    }
    const sIn = cross.filter((c) => c.into).map((c) => c.s), sOut = cross.filter((c) => !c.into).map((c) => c.s);
    // in driving order from the start: NE entry, west exit, SW entry, east exit
    const sNE = sIn.find((s) => track.at(s).x > 0), sSW = sIn.find((s) => track.at(s).x < 0);
    const sW = sOut.find((s) => track.at(s).x < 0), sE = sOut.find((s) => track.at(s).x > 0);
    const deckRange = (G) => {
      // first and last s of the centreline on the deck
      let a = -1, b = -1;
      for (let i = 0; i < N; i++) if (Math.hypot(track.x[i] - G.x, track.z[i] - G.z) < G.R) { if (a < 0) a = i; b = i; }
      return [a * track.ds, b * track.ds];
    };
    const dB = deckRange(GEAR.barrel), dC = deckRange(GEAR.centre), dBal = deckRange(GEAR.balance), dF = deckRange(GEAR.fourth);
    // concentricity check (road radius round each wheel)
    for (const [nm, G, d] of [['barrel', GEAR.barrel, dB], ['centre', GEAR.centre, dC], ['balance', GEAR.balance, dBal], ['fourth', GEAR.fourth, dF]]) {
      let lo = 99, hi = 0;
      for (let s = d[0]; s <= d[1]; s += 1) { const p = track.at(s); const q = Math.hypot(p.x - G.x, p.z - G.z); lo = Math.min(lo, q); hi = Math.max(hi, q); }
      A['dbg_' + nm] = [lo.toFixed(1), hi.toFixed(1), d[0].toFixed(0), d[1].toFixed(0)];
    }
    const sGate = (dBal[1] + dF[0]) / 2;
    const JUMP = { r0: dC[1] + 7, r1: dC[1] + 16, p1: dC[1] + 25.5 };
    A.sLand = JUMP.p1 + 2;
    Object.assign(A, { sNE, sSW, sW, sE, sGate, dB, dC, dBal, dF, JUMP });

    const discPlatforms = (cx, cz, R, h, n) => { for (let k = 0; k < n; k++) { const f = (k + 0.5) * (PI / 2) / n; K.platform(cx, cz, R * Math.cos(f), R * Math.sin(f), 0, h); } };
    const edgeRect = (s0, s1, h, hd = 7.6) => {
      const pa = track.at(s0), pb = track.at(s1), ang = Math.atan2(pb.z - pa.z, pb.x - pa.x);
      K.platform((pa.x + pb.x) / 2, (pa.z + pb.z) / 2, Math.hypot(pb.x - pa.x, pb.z - pa.z) / 2, hd, ang, h);
    };

    // ============================================================================================
    // HOLES: wheel sinks (flush decks), the jump pit and the skeleton pits
    // ============================================================================================
    const sinkR = (G) => G.R + 1.6 + 0.9;
    const sinks = [GEAR.barrel, GEAR.centre, GEAR.balance, GEAR.fourth].map((G) => ({ x: G.x, z: G.z, r: G === GEAR.balance ? G.R + 1.5 : sinkR(G) }));
    const inSink = (x, z, m = 0) => sinks.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + m);
    // rectangular pits along the road: {s0, s1, l0, l1} (lateral range) -> polygon + trapdoor
    const pits = [];
    const addPit = (s0, s1, l0, l1, kind) => {
      const pa = track.at(s0), pb = track.at(s1);
      const ang = Math.atan2(pb.z - pa.z, pb.x - pa.x), cs = Math.cos(ang), sn = Math.sin(ang);
      const nx = -sn, nz = cs;
      const cx = (pa.x + pb.x) / 2 + nx * (l0 + l1) / 2, cz = (pa.z + pb.z) / 2 + nz * (l0 + l1) / 2;
      const hw = Math.hypot(pb.x - pa.x, pb.z - pa.z) / 2, hd = Math.abs(l1 - l0) / 2;
      const poly = [];
      const rc = Math.min(1.6, hd * 0.5);
      // rounded rectangle outline
      for (const [qa, qb, a0] of [[hw - rc, hd - rc, 0], [-(hw - rc), hd - rc, PI / 2], [-(hw - rc), -(hd - rc), PI], [hw - rc, -(hd - rc), PI * 1.5]]) {
        for (let k = 0; k <= 4; k++) {
          const a = a0 + (k / 4) * PI / 2, lx = qa + Math.cos(a) * rc, lz = qb + Math.sin(a) * rc;
          poly.push([cx + lx * cs - lz * sn, cz + lx * sn + lz * cs]);
        }
      }
      const pit = { cx, cz, hw, hd, ang, poly, kind };
      // stay clear of the plate edge and the wheel sinks
      for (const [x, z] of poly) {
        if (dM(x, z) > MV.R - 2.2) console.warn('watchmaker: pit near plate edge', kind, x.toFixed(1), z.toFixed(1));
        if (inSink(x, z, 1.2)) console.warn('watchmaker: pit overlaps a sink', kind, x.toFixed(1), z.toFixed(1));
      }
      K.trapdoor(cx, cz, hw, hd, ang, true);
      pits.push(pit);
      return pit;
    };
    const jumpPit = addPit(JUMP.r1 + 0.3, JUMP.p1, -8.2, 8.2, 'jump');
    A.jumpPit = jumpPit;
    // skeleton pits beside the road after the fourth wheel (lateral 8..15 on both sides)
    {
      const okRange = (l0, l1) => {
        let a = -1, b = -1;
        for (let s = dF[1]; s < sE; s += 0.5) {
          const p = track.at(s);
          let ok = true;
          for (const l of [l0, l1]) for (const ds of [-2.5, 2.5]) {
            const q = track.place(s + ds, l);
            if (dM(q.x, q.z) > MV.R - 4.5 || inSink(q.x, q.z, 3)) ok = false;
          }
          if (ok) { if (a < 0) a = s; b = s; } else if (a >= 0) break;
        }
        return [a, b];
      };
      for (const [l0, l1] of [[-15.5, -8.1], [8.1, 15.5]]) {
        const [a, b] = okRange(l0, l1);
        if (a > 0 && b - a > 8) addPit(a, b, l0, l1, 'skeleton');
      }
    }
    const inPit = (x, z, m = 0) => pits.some((p) => {
      const dx = x - p.cx, dz = z - p.cz, c = Math.cos(p.ang), s = Math.sin(p.ang);
      return Math.abs(dx * c + dz * s) < p.hw + m && Math.abs(-dx * s + dz * c) < p.hd + m;
    });

    const gearShape = (R, n, m, holes = []) => {
      const s = new T.Shape(), Rr = R - 1.25 * m, Rt = R + m, p = TAU / n;
      const prof = [[-0.5, Rr], [-0.24, Rr], [-0.19, R - 0.2 * m], [-0.14, R + 0.45 * m], [-0.08, Rt - 0.1 * m], [0, Rt], [0.08, Rt - 0.1 * m], [0.14, R + 0.45 * m], [0.19, R - 0.2 * m], [0.24, Rr]];
      for (let k = 0; k < n; k++) for (const [f, rr] of prof) {
        const a = (k + f) * p, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (k === 0 && f === -0.5) s.moveTo(x, y); else s.lineTo(x, y);
      }
      s.closePath();
      for (const h of holes) s.holes.push(h);
      return s;
    };
    // ============================================================================================
    // THE PLATE: perlage rhodium with polished bevels, sinks for the wheels and open pits
    // ============================================================================================
    {
      const sh = new T.Shape();
      sh.absarc(MV.x, -MV.z, MV.R, 0, TAU, false);
      // barrel + centre sinks overlap (the wheels mesh): one hole = union of two circles
      const unionPath = (a, b, n = 72) => {
        const pts = [];
        const add = (c, o) => {
          for (let k = 0; k < n; k++) {
            const t = (k / n) * TAU, x = c.x + Math.cos(t) * c.r, z = c.z + Math.sin(t) * c.r;
            if (Math.hypot(x - o.x, z - o.z) > o.r) pts.push([x, z, Math.atan2(z - (a.z + b.z) / 2, x - (a.x + b.x) / 2)]);
          }
        };
        add(a, b); add(b, a);
        pts.sort((p, q) => p[2] - q[2]);
        const path = new T.Path();
        pts.forEach(([x, z], i) => (i ? path.lineTo(x, -z) : path.moveTo(x, -z)));
        path.closePath();
        return path;
      };
      sh.holes.push(unionPath(sinks[0], sinks[1]));
      for (const k of sinks.slice(2)) { const p = new T.Path(); p.absarc(k.x, -k.z, k.r, 0, TAU, true); sh.holes.push(p); }
      for (const p of pits) { const hp = new T.Path(); p.poly.forEach(([x, z], i) => (i ? hp.lineTo(x, -z) : hp.moveTo(x, -z))); hp.closePath(); sh.holes.push(hp); }
      const bt = 0.35;
      const g = new T.ExtrudeGeometry(sh, { depth: H - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 2, curveSegments: 96 });
      g.rotateX(-PI / 2); g.translate(0, bt, 0);
      const plate = K.mesh(g, [plateTop, plateSide], 0, 0, 0, { cast: true });
      plate.receiveShadow = true;
      AO(MV.x, MV.z, MV.R + 5, MV.R + 5, 0.6, 0, 0.02);
      // physics: the disc as a union of inscribed rectangles (corners on the rim), plus exact rectangles where the
      // road climbs on (ramp ends) and drops off, so the step is exactly at the visible edge there
      discPlatforms(MV.x, MV.z, MV.R, H, 36);
      for (const s0 of [sNE, sSW]) edgeRect(s0 - 0.3, s0 + 9, H);
      for (const s0 of [sW, sE]) edgeRect(s0 - 9, s0 - 0.25, H);
      // sink floors (dark, under the decks) and pit floors (the dial-side plate, far down)
      for (const k of sinks) K.mesh(new T.CircleGeometry(k.r, 48), sinkMat, k.x, H - 1.9, k.z, { rx: -PI / 2, cast: false });
      const lowGear = MET(0xc9cdd3, 0.2, { envMapIntensity: 0.9 });
      for (const p of pits) {
        K.flatShape(p.poly, pitFloor, 0.08, { cast: false });
        AO(p.cx, p.cz, p.hw + 1, p.hd + 1, 0.7, p.ang, 0.12);
        // the motion works far below: a couple of steel wheels lying in the pit
        const c = Math.cos(p.ang), sn = Math.sin(p.ang);
        for (const [f, gr] of [[-0.45, 0.5], [0.4, 0.62]]) {
          const R = Math.min(p.hd, p.hw) * gr + 1.2, gx = p.cx + c * f * p.hw, gz = p.cz + sn * f * p.hw;
          const gg = new T.ExtrudeGeometry(gearShape(R, Math.max(10, Math.round(R * 3)), 0.6), { depth: 0.5, bevelEnabled: false, curveSegments: 4 });
          gg.rotateX(-PI / 2);
          K.mesh(gg, lowGear, gx, 0.5 + f, gz, { ry: f * 3 });
          K.mesh(new T.CylinderGeometry(0.7, 0.7, 2.4, 10), lowGear, gx, 1.2 + f, gz);
        }
      }
    }

    // ============================================================================================
    // ROAD SURFACES
    // ============================================================================================
    // masked ribbon: quads along the track from lateral lat0(w) to lat1(w), kept where keep(x, z, s) is true
    const ribbon = ({ mat, y, lat0, lat1, mask, vScale = 20, step = 1, uSeg = 6, cast = false, bands = null }) => {
      const rows = Math.ceil(L / step), cols = uSeg + 1;
      const P = [], U = [], idx = [];
      for (const [b0, b1] of bands || [[lat0, lat1]]) { lat0 = b0; lat1 = b1; const base = P.length / 3;
      for (let i = 0; i <= rows; i++) {
        const s = Math.min(L, i * step), p = track.at(s % L);
        const o0 = lat0(p.w), o1 = lat1(p.w);
        for (let j = 0; j < cols; j++) {
          const o = o0 + (o1 - o0) * j / uSeg;
          P.push(p.x + p.nx * o, y, p.z + p.nz * o); U.push(j / uSeg, s / vScale);
        }
      }
      for (let i = 0; i < rows; i++) for (let j = 0; j < uSeg; j++) {
        const a = base + i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        const cx = (P[a * 3] + P[d * 3]) / 2, cz = (P[a * 3 + 2] + P[d * 3 + 2]) / 2;
        if (!mask(cx, cz, (i + 0.5) * step)) continue;
        idx.push(a, b, c, b, d, c);
      }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      const m = new T.Mesh(g, mat); m.receiveShadow = true; m.castShadow = cast;
      K.group.add(m);
      return m;
    };
    const inS = (s, a, b) => { const L2 = L; s = ((s % L2) + L2) % L2; return a <= b ? s >= a && s <= b : s >= a || s <= b; };
    // ramps (on the bench, leading up to the plate)
    const RAMP_LEN = 13;
    const rampS = [[sNE - RAMP_LEN - 0.3, sNE - 0.3], [sSW - RAMP_LEN - 0.3, sSW - 0.3]];
    const onPlateRoad = (x, z, s) => dM(x, z) < MV.R - 0.45 && !inSink(x, z, 0.15) && !inPit(x, z, 0.2) && !inS(s, JUMP.r0 - 0.5, JUMP.r1 + 0.5);
    // the dial on the start straight
    const DIAL = (() => { const p = track.at(START_S); return { x: p.x, z: p.z, R: 31, ang: p.angle }; })();
    const onDial = (x, z) => Math.hypot(x - DIAL.x, z - DIAL.z) < DIAL.R - 0.3;
    const onBenchRoad = (x, z, s) => dM(x, z) > MV.R + 0.3 && Math.hypot(x - DIAL.x, z - DIAL.z) > DIAL.R - 3 && !rampS.some(([a, b]) => inS(s, a - 0.3, b));
    // plate road: rhodium Geneva stripes running along the road, a shade darker and cooler than the plate
    {
      for (const t of Object.values(genRoad)) t.repeat.set(1, 1);
      const roadMat = MET(0x34373e, 0.34, { map: genRoad.map, normalMap: genRoad.normalMap, normalScale: V2(0.25), envMapIntensity: 0.7 });
      ribbon({ mat: roadMat, y: H + 0.025, lat0: (w) => -w / 2, lat1: (w) => w / 2, mask: onPlateRoad, vScale: 13, uSeg: 16, step: 0.5 });
      // engraved, gilt-filled double edge lines and a polished chamfer strip
      const lineMat = MET(0xf0c060, 0.18, { emissive: 0x2a1800, emissiveIntensity: 0.4 });
      const darkLine = K.std({ color: 0x14100a, roughness: 0.6 });
      for (const sd of [-1, 1]) {
        ribbon({ mat: lineMat, y: H + 0.04, lat0: (w) => sd * (w / 2 - 0.05), lat1: (w) => sd * (w / 2 + 0.38), mask: onPlateRoad, uSeg: 1, step: 0.5 });
        ribbon({ mat: darkLine, y: H + 0.035, lat0: (w) => sd * (w / 2 + 0.38), lat1: (w) => sd * (w / 2 + 0.6), mask: onPlateRoad, uSeg: 1 });
        ribbon({ mat: lineMat, y: H + 0.04, lat0: (w) => sd * (w / 2 + 1.05), lat1: (w) => sd * (w / 2 + 1.25), mask: (x, z, s) => onPlateRoad(x, z, s), uSeg: 1 });
      }
    }
    // bench road: a long strip of graph paper with inked borders
    {
      const W = 256, Hh = 512, c = TX.makeCanvas(W, Hh), g = c.getContext('2d');
      g.fillStyle = '#efeadb'; g.fillRect(0, 0, W, Hh);
      const pr = K.rng(77);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,100,70,${pr() * 0.05})`; g.fillRect(pr() * W, pr() * Hh, 2, 2); }
      const pxu = W / 14.6; // ribbon is 14.6 wide; 512 px = 32 units
      g.strokeStyle = 'rgba(70,120,170,0.28)'; g.lineWidth = 1;
      for (let u = 0; u < 15; u++) { const x = 0.3 * pxu + u * pxu; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke(); }
      for (let v = 0; v < 32; v++) { const y = v * 16; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = 'rgba(70,120,170,0.5)'; g.lineWidth = 1.6;
      for (let v = 0; v < 32; v += 5) { const y = v * 16; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      // inked double border
      g.fillStyle = '#1d2a4a'; g.fillRect(0.55 * pxu, 0, 0.42 * pxu, Hh); g.fillRect(W - 0.97 * pxu, 0, 0.42 * pxu, Hh);
      g.fillRect(1.25 * pxu, 0, 0.12 * pxu, Hh); g.fillRect(W - 1.37 * pxu, 0, 0.12 * pxu, Hh);
      // scale ticks along the inner border
      for (let v = 0; v < 64; v++) { const y = v * 8, len = v % 4 ? 0.35 : 0.8; g.fillRect(1.4 * pxu, y, len * pxu, 1.4); g.fillRect(W - 1.4 * pxu - len * pxu, y, len * pxu, 1.4); }
      // torn, slightly shaded paper edges
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 3, Hh); g.fillRect(W - 3, 0, 3, Hh);
      const tex = TX.toTexture(c);
      const paper = K.std({ map: tex, roughness: 0.92 });
      ribbon({ mat: paper, y: 0.035, lat0: (w) => -w / 2 - 0.3, lat1: (w) => w / 2 + 0.3, mask: onBenchRoad, vScale: 32, uSeg: 4 });
      // the paper casts a faint shadow line on the mat at both edges
      const sh = K.std({ color: 0x0b1a12, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false });
      ribbon({ mat: sh, y: 0.02, bands: [-1, 1].map((sd) => [(w) => sd * (w / 2 + 0.3), (w) => sd * (w / 2 + 0.8)]), mask: onBenchRoad, uSeg: 1 });
    }

    // ============================================================================================
    // WHEELS
    // ============================================================================================
    // face texture of a wheel: polished rim and spokes on a frosted web, engraved road rings, hub
    const wheelFace = (R, Rt, { spokes = 5, rho = 0, web = '#b8913f', polish = '#f2cf7a', dark = '#4a3814', hub = 0, snail = false } = {}) => {
      const S = 512, c = TX.makeCanvas(S, S), g = c.getContext('2d'), rc = TX.makeCanvas(S, S), rg = rc.getContext('2d');
      const k = (S / 2) / Rt;
      g.translate(S / 2, S / 2); rg.translate(S / 2, S / 2);
      g.fillStyle = polish; g.fillRect(-S, -S, 2 * S, 2 * S);
      rg.fillStyle = '#262626'; rg.fillRect(-S, -S, 2 * S, 2 * S);
      const ring = (ctx, r0, r1, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r1 * k, 0, TAU); ctx.arc(0, 0, r0 * k, 0, TAU, true); ctx.fill(); };
      const rimIn = R - 3.6;
      if (spokes > 0) {
        // frosted web
        const wg = g.createRadialGradient(0, 0, 0, 0, 0, rimIn * k); wg.addColorStop(0, web); wg.addColorStop(1, web);
        g.fillStyle = wg; g.beginPath(); g.arc(0, 0, rimIn * k, 0, TAU); g.fill();
        rg.fillStyle = '#8a8a8a'; rg.beginPath(); rg.arc(0, 0, rimIn * k, 0, TAU); rg.fill();
        // polished spokes with engraved outlines
        for (let i = 0; i < spokes; i++) {
          const a = i * TAU / spokes;
          for (const [ctx, col, lw] of [[g, dark, 0.2 * R * k + 3], [g, polish, 0.2 * R * k], [rg, '#262626', 0.2 * R * k]]) {
            ctx.save(); ctx.rotate(a); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(rimIn * k, 0); ctx.stroke(); ctx.restore();
          }
        }
        ring(g, rimIn - 0.25, rimIn, dark);
      }
      if (snail) {
        // snailing: a spiral of fine polished grooves (barrel cover)
        g.strokeStyle = 'rgba(255,240,200,0.22)'; g.lineWidth = 1.6;
        g.beginPath();
        for (let t = 0; t < 34 * TAU; t += 0.05) { const rr = (t / (34 * TAU)) * (R - 4) * k; const x = Math.cos(t) * rr, y = Math.sin(t) * rr; t ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        g.strokeStyle = 'rgba(70,50,10,0.25)'; g.lineWidth = 1;
        g.beginPath();
        for (let t = 0.6; t < 34 * TAU; t += 0.05) { const rr = (t / (34 * TAU)) * (R - 4) * k + 2.4; const x = Math.cos(t) * rr, y = Math.sin(t) * rr; t > 0.6 ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      // engraved road rings, gilt-filled (they are circles, so they stand still while the wheel turns)
      if (rho) for (const rr of [rho - 6.5, rho + 6.5]) { ring(g, rr - 0.42, rr + 0.42, '#1a1206'); ring(g, rr - 0.22, rr + 0.22, '#ffd27a'); ring(rg, rr - 0.42, rr + 0.42, '#202020'); }
      if (hub) { ring(g, 0, hub, polish); ring(g, hub, hub + 0.3, dark); }
      ring(g, R + 0.2, Rt + 2, '#d9ae5a');
      const map = TX.toTexture(c, { wrap: false }), rough = TX.toTexture(rc, { wrap: false, srgb: false });
      return { map, rough };
    };
    const wheelMesh = (G, { n, m = 1.6, thick = 1.6, spokes = 5, web, polish, dark, hub = 5, snail = false, color = 0xffffff, holes = [], side = gilt }) => {
      const R = G.R, Rt = R + m;
      const geo = new T.ExtrudeGeometry(gearShape(R, n, m, holes), { depth: thick, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 1, curveSegments: 6 });
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * Rt) + 0.5, pos.getY(i) / (2 * Rt) + 0.5);
      geo.rotateX(-PI / 2); geo.translate(0, -(thick + 0.14), 0);
      const face = wheelFace(R, Rt, { spokes, rho: G.rho || 0, web, polish, dark, hub, snail });
      const mat = MET(color, 1, { map: face.map, roughnessMap: face.rough, normalMap: ringNormal, normalScale: V2(0.22), envMapIntensity: 1.25 });
      const mesh = new T.Mesh(geo, [mat, side]);
      mesh.castShadow = false; mesh.receiveShadow = true;
      return mesh;
    };
    const jewelGeo = (() => { const g = new T.SphereGeometry(1, 20, 8, 0, TAU, 0, PI / 2); g.scale(1, 0.38, 1); return g; })();
    const chatonGeo = K.lathe([[0.001, 0], [1.55, 0], [1.6, 0.25], [1.25, 0.45], [1.05, 0.4], [0.001, 0.4]], 28);
    const jewels = [], chatons = [], screwsB = [];
    const jewel = (x, y, z, s = 1, withScrews = true, ang = 0) => {
      chatons.push({ x, y, z, s });
      jewels.push({ x, y: y + 0.38 * s, z, s: s * 0.95 });
      if (withScrews) for (const sd of [-1, 1]) screwsB.push({ x: x + Math.cos(ang) * sd * 2.4 * s, y, z: z + Math.sin(ang) * sd * 2.4 * s, s: 0.55 * s, ry: ang + sd });
    };
    const screwHeadGeo = K.lathe([[0.001, 0], [1.2, 0], [1.25, 0.1], [1.18, 0.38], [0.9, 0.55], [0.001, 0.6]], 24);
    const slotGeo = new T.BoxGeometry(2.3, 0.3, 0.32);
    // ---------------- driving decks (spinners) ----------------
    const spinGroup = (G, fn, children) => {
      const grp = new T.Group(); grp.position.set(G.x, H, G.z);
      for (const c of children) grp.add(c);
      K.add(grp, { cast: false }); keep.push(grp);
      A.rot.push({ o: grp, f: fn });
      return grp;
    };
    const barrelAng = (t) => GEAR.barrel.w * t;
    const centreAng = (t) => GEAR.centre.w * t + 0.07; // phase so the teeth mesh
    const fourthAng = (t) => GEAR.fourth.w * t;
    K.spinner(GEAR.barrel.x, GEAR.barrel.z, GEAR.barrel.R, barrelAng, { h: H, fling: 1, pull: 0.5 });
    K.spinner(GEAR.centre.x, GEAR.centre.z, GEAR.centre.R, centreAng, { h: H, fling: 1, pull: 0.5 });
    K.spinner(GEAR.balance.x, GEAR.balance.z, GEAR.balance.R, balAngle, { h: H, fling: 1, pull: 0.6 });
    K.spinner(GEAR.fourth.x, GEAR.fourth.z, GEAR.fourth.R, fourthAng, { h: H, fling: 1, pull: 0.5 });
    // mainspring barrel: toothed drum with a snailed cover; the steel ratchet wheel on the arbor stays still
    {
      const G = GEAR.barrel;
      const w = wheelMesh(G, { n: G.n, m: 1.7, thick: 2.2, spokes: 0, polish: '#e8c271', dark: '#5a4318', hub: 0, snail: true });
      spinGroup(G, barrelAng, [w]);
      // ratchet wheel (static), click and its big blued screw
      const rs = new T.Shape();
      const n = 28, R0 = 8.6, R1 = 9.6;
      for (let k = 0; k < n; k++) { const a = k * TAU / n, b = (k + 0.8) * TAU / n; k ? rs.lineTo(Math.cos(a) * R0, Math.sin(a) * R0) : rs.moveTo(Math.cos(a) * R0, Math.sin(a) * R0); rs.lineTo(Math.cos(b) * R1, Math.sin(b) * R1); }
      rs.closePath();
      const rg = new T.ExtrudeGeometry(rs, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 });
      const ruv = rg.attributes.uv, rpos = rg.attributes.position;
      for (let i = 0; i < rpos.count; i++) ruv.setXY(i, rpos.getX(i) / 20 + 0.5, rpos.getY(i) / 20 + 0.5);
      rg.rotateX(-PI / 2);
      const ratchetMat = MET(0xd5d9de, 0.22, { normalMap: ringNormal, normalScale: V2(0.25), envMapIntensity: 1.3 });
      K.mesh(rg, ratchetMat, G.x, H + 0.12, G.z);
      K.mesh(new T.CylinderGeometry(3.4, 3.6, 0.9, 32), blued, G.x, H + 1.8, G.z);
      K.mesh(new T.BoxGeometry(6.4, 0.5, 0.7), K.std({ color: 0x0c0c12, roughness: 0.5 }), G.x, H + 2.1, G.z, { ry: 0.6 });
      K.circle(G.x, G.z, 9.7, H + 1.6);
      // the click (pawl) and its spring, fixed to the plate beside the barrel... on the barrel bridge foot
      AO(G.x, G.z, 11, 11, 0.4, 0, H + 0.06);
    }
    // centre wheel: five-spoke gilt wheel, cannon pinion and jewel in the middle
    {
      const G = GEAR.centre;
      const w = wheelMesh(G, { n: G.n, m: 1.6, thick: 1.6, spokes: 5, web: '#a98336', polish: '#f0cb78', dark: '#4a3714', hub: 4.6 });
      spinGroup(G, centreAng, [w]);
      K.mesh(K.lathe([[0.001, 0], [3.3, 0], [3.3, 1.2], [2.4, 1.6], [2.4, 3.4], [1.6, 3.8], [0.001, 3.8]], 32), steel, G.x, H, G.z);
      jewel(G.x, H + 3.8, G.z, 0.9, false);
      K.circle(G.x, G.z, 3.4, H + 3.6);
    }
    // fourth wheel (turns against the race)
    {
      const G = GEAR.fourth;
      const w = wheelMesh(G, { n: G.n, m: 1.5, thick: 1.5, spokes: 4, web: '#a07c32', polish: '#efc874', dark: '#4a3714', hub: 3.6 });
      spinGroup(G, fourthAng, [w]);
      K.mesh(K.lathe([[0.001, 0], [2.6, 0], [2.6, 1.0], [1.8, 1.3], [1.8, 2.6], [0.001, 2.6]], 28), steel, G.x, H, G.z);
      jewel(G.x, H + 2.6, G.z, 0.8, false);
      K.circle(G.x, G.z, 2.7, H + 2.4);
    }
    // balance wheel: gold rim with timing screws, three arms over a dark smoked web, hairspring on top
    {
      const G = GEAR.balance, R = G.R;
      const S = 512, c = TX.makeCanvas(S, S), g = c.getContext('2d'), k = (S / 2) / (R + 0.6);
      g.translate(S / 2, S / 2);
      g.fillStyle = '#d9b260'; g.fillRect(-S, -S, 2 * S, 2 * S);
      const webR = R - 2.6;
      const wg = g.createRadialGradient(0, 0, 0, 0, 0, webR * k); wg.addColorStop(0, '#2a2f3a'); wg.addColorStop(1, '#151820');
      g.fillStyle = wg; g.beginPath(); g.arc(0, 0, webR * k, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) {
        g.save(); g.rotate(i * TAU / 3);
        g.strokeStyle = '#3a2a0e'; g.lineWidth = 3.2 * k + 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(webR * k, 0); g.stroke();
        g.strokeStyle = '#efc977'; g.lineWidth = 3.2 * k; g.beginPath(); g.moveTo(0, 0); g.lineTo(webR * k, 0); g.stroke();
        g.restore();
      }
      for (const rr of [G.rho - 6.5, G.rho + 6.5]) { g.strokeStyle = '#ffd27a'; g.lineWidth = 0.45 * k; g.beginPath(); g.arc(0, 0, rr * k, 0, TAU); g.stroke(); }
      g.fillStyle = '#efc977'; g.beginPath(); g.arc(0, 0, 3.2 * k, 0, TAU); g.fill();
      const geo = new T.CylinderGeometry(R + 0.6, R + 0.6, 1.4, 96);
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R + 1.2) + 0.5, -pos.getZ(i) / (2 * R + 1.2) + 0.5);
      geo.translate(0, -0.7, 0);
      const mat = MET(0xffffff, 0.3, { map: TX.toTexture(c, { wrap: false }), normalMap: ringNormal, normalScale: V2(0.4), envMapIntensity: 1.2 });
      const disc = new T.Mesh(geo, mat); disc.receiveShadow = true;
      // timing screws round the rim (instanced inside the turning group)
      const ts = new T.InstancedMesh(screwHeadGeo, gilt, 20);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(0.75, 0.9, 0.75);
      for (let i = 0; i < 20; i++) { const a = i * TAU / 20; m4.compose(new T.Vector3(Math.cos(a) * (R - 0.4), 0, Math.sin(a) * (R - 0.4)), q, sc); ts.setMatrixAt(i, m4); }
      ts.castShadow = true;
      // hairspring: a flat spiral of blued steel, r 2.8 .. 12.6, sitting on the arms
      const pts = [], turns = 11;
      for (let i = 0; i <= turns * 72; i++) { const t = i / 72 * TAU, rr = 2.8 + (12.6 - 2.8) * (i / (turns * 72)); pts.push(new T.Vector3(Math.cos(t) * rr, 0.22, Math.sin(t) * rr)); }
      const hair = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), turns * 72, 0.17, 4, false), MET(0x2a55c8, 0.18, { envMapIntensity: 1.8 }));
      const grp = spinGroup(G, balAngle, [disc, ts]);
      const hg = new T.Group(); hg.position.set(G.x, H, G.z); hg.add(hair); K.add(hg, { cast: false }); keep.push(hg);
      A.hair = hg;
      // staff, roller and cap jewel
      K.mesh(K.lathe([[0.001, 0], [2.3, 0], [2.3, 0.9], [1.4, 1.2], [1.4, 3.2], [0.001, 3.2]], 24), steel, G.x, H, G.z);
      jewel(G.x, H + 3.2, G.z, 0.75, false);
      K.circle(G.x, G.z, 2.4, H + 3);
      // the hairspring is underfoot: a rough, bumpy ride on the inner half of the road
      K.surface('rough', { x: G.x, z: G.z, r: 12.8 });
      // the balance cock: a gilt bridge from the south-west reaching over the staff, with the regulator index
      const ck = new T.Shape();
      ck.moveTo(-3.2, 0); ck.bezierCurveTo(-3.6, 9, -2.2, 16, -4.5, 24); ck.lineTo(4.5, 24); ck.bezierCurveTo(2.2, 16, 3.6, 9, 3.2, 0); ck.absarc(0, 0, 3.2, 0, PI, true);
      const cg = new T.ExtrudeGeometry(ck, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2 });
      cg.rotateX(-PI / 2);
      const cock = new T.Mesh(cg, gilt);
      const cgrp = new T.Group(); cgrp.add(cock); cgrp.position.set(G.x, H + 5.2, G.z); cgrp.rotation.y = Math.atan2(-Math.cos(0.75 * PI), -Math.sin(0.75 * PI));
      K.add(cgrp);
      const footA = 0.75 * PI;
      const fx = G.x + Math.cos(footA) * 27, fz = G.z + Math.sin(footA) * 27;
      K.mesh(new K.RoundedBoxGeometry(9, 5.2, 9, 2, 1.2), gilt, fx, H + 2.6, fz, { ry: -footA });
      K.circle(fx, fz, 4.6, H + 5.4);
      jewel(G.x, H + 6.4, G.z, 0.9, false);
      AO(fx, fz, 7, 7, 0.45, 0, H + 0.06);
      warnRoad('balance cock foot', fx, fz, 1);
    }
    // ---------------- visible gears that do not carry cars ----------------
    // third wheel (raised, meshing between the centre and fourth wheels) under the train bridge
    {
      const G = GEAR.third;
      const w = wheelMesh(G, { n: G.n, m: 1.4, thick: 1.0, spokes: 4, web: '#9a7630', polish: '#efc874', dark: '#4a3714', hub: 2.6 });
      w.castShadow = true;
      const grp = new T.Group(); grp.position.set(G.x, H + 1.4, G.z); grp.add(w); K.add(grp); keep.push(grp);
      A.rot.push({ o: grp, f: (t) => GEAR.third.w * t });
      K.mesh(new T.CylinderGeometry(1.6, 1.6, 1.4, 16), steel, G.x, H + 0.7, G.z);
      K.circle(G.x, G.z, 12, H + 4);
      AO(G.x, G.z, 12, 12, 0.5, 0, H + 0.06);
    }
    // the escape wheel: polished steel, fifteen club teeth, it jumps one tooth per beat. Its teeth reach over
    // the road edge and kick anything that touches them.
    {
      const G = GEAR.escape, R = G.R, n = 15;
      const s = new T.Shape();
      for (let k = 0; k < n; k++) {
        const a = k * TAU / n, p = TAU / n;
        const P = (f, rr) => [Math.cos(a + f * p) * rr, Math.sin(a + f * p) * rr];
        const seq = [P(0, R - 2.4), P(0.1, R - 2.2), P(0.55, R + 0.4), P(0.62, R + 1.3), P(0.75, R + 1.5), P(0.82, R + 1.1), P(0.7, R - 0.6), P(1.0, R - 2.4)];
        seq.forEach(([x, y], i) => (k === 0 && i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
      }
      s.closePath();
      for (let i = 0; i < 4; i++) { const h = new T.Path(); h.absarc(0, 0, R - 3.4, i * PI / 2 + 0.28, (i + 1) * PI / 2 - 0.28, false); h.lineTo(Math.cos((i + 1) * PI / 2 - 0.4) * 3.0, Math.sin((i + 1) * PI / 2 - 0.4) * 3.0); h.absarc(0, 0, 3.0, (i + 1) * PI / 2 - 0.4, i * PI / 2 + 0.4, true); h.closePath(); s.holes.push(h); }
      const g = new T.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 1, curveSegments: 10 });
      g.rotateX(-PI / 2);
      const m = new T.Mesh(g, MET(0xd8dce2, 0.14, { envMapIntensity: 1.2 }));
      m.castShadow = true;
      const grp = new T.Group(); grp.position.set(G.x, H + 1.2, G.z); grp.add(m); K.add(grp); keep.push(grp);
      A.rot.push({ o: grp, f: escAngle });
      K.mesh(new T.CylinderGeometry(1.5, 1.5, 1.4, 16), steel, G.x, H + 0.7, G.z);
      jewel(G.x, H + 2.25, G.z, 0.6, false);
      A.escMover = K.mover({ type: 'circle', r: R + 1.2, h: H + 2.2, kick: 20 }, (t) => ({ x: G.x, z: G.z, angle: escAngle(t) }));
      AO(G.x, G.z, R + 2, R + 2, 0.45, 0, H + 0.06);
    }
    // ---------------- the escapement gate: a big ruby pallet sliding in a steel track across the road ----------------
    {
      const p = track.at(sGate), w = p.w;
      const yawS = new T.Group(), yaw = new T.Group();
      for (const y of [yawS, yaw]) { y.position.set(p.x, H, p.z); y.rotation.y = -p.angle; }
      // the track: two polished rails with a dark slot between them, flush with the road
      const trk = new T.Mesh(new T.BoxGeometry(GATE.hw * 2 + 0.6, 0.12, w + 3.4), sinkMat); trk.position.y = 0.04; yawS.add(trk);
      for (const sd of [-1, 1]) { const rl = new T.Mesh(new K.RoundedBoxGeometry(0.7, 0.3, w + 3.4, 2, 0.12), steel); rl.position.set(sd * (GATE.hw + 0.5), 0.1, 0); yawS.add(rl); }
      // banking pins at both road edges; their ruby caps and ruby lamps in the road are the warning lights
      const lampL = K.std({ color: 0x400010, emissive: 0xff2040, emissiveIntensity: 0, roughness: 0.2 });
      const lampR = lampL.clone();
      const lampGeos = { '-1': [], '1': [] };
      const capG = new T.SphereGeometry(0.9, 16, 10), insG = new T.CylinderGeometry(0.9, 0.9, 0.2, 18);
      for (const sd of [-1, 1]) {
        const post = new T.Mesh(K.lathe([[1.9, 0], [1.9, 0.5], [1.2, 0.8], [1.0, 2.8], [1.4, 3.0], [1.4, 3.4], [0.001, 3.5]], 24), steel);
        post.position.set(0, 0, sd * (w / 2 + 1.9)); yawS.add(post);
        lampGeos[sd].push(capG.clone().translate(0, 3.7, sd * (w / 2 + 1.9)));
        const q = track.place(sGate, sd * (w / 2 + 1.9));
        K.circle(q.x, q.z, 1.6, H + 4);
        AO(q.x, q.z, 2.6, 2.6, 0.45, 0, H + 0.06);
        for (const ds of [-8, -13]) {
          lampGeos[sd].push(insG.clone().translate(ds, 0.08, sd * 3.25));
          const c = new T.Mesh(new T.TorusGeometry(1.0, 0.18, 6, 18), gilt); c.rotation.x = PI / 2; c.position.set(ds, 0.1, sd * 3.25); yawS.add(c);
        }
      }
      for (const sd of [-1, 1]) { const m = new T.Mesh(BU.mergeGeometries(lampGeos[sd].map((g) => { const q = g.toNonIndexed(); return q; }), false), sd < 0 ? lampL : lampR); m.castShadow = false; yaw.add(m); }
      K.add(yawS); K.add(yaw, { cast: false });
      // the pallet stone: a big ruby set in a polished steel shoe
      const stone = new T.Group();
      const rubyMat = K.phys({ color: 0xd8102c, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xff1030, emissiveIntensity: 0.4, envMap: ENV, envMapIntensity: 2 });
      const rb = new T.Mesh(new K.RoundedBoxGeometry(GATE.hw * 2, GATE.h, GATE.hd * 2, 3, 0.55), rubyMat); rb.position.y = GATE.h / 2 + 0.2; rb.castShadow = true; stone.add(rb);
      const shoe = new T.Mesh(new K.RoundedBoxGeometry(GATE.hw * 2 + 0.8, 0.6, GATE.hd * 2 + 0.8, 2, 0.2), steel); shoe.position.y = 0.3; stone.add(shoe);
      yaw.add(stone); keep.push(yaw);
      A.gate = { yaw, stone, rubyMat, lampL, lampR, x: p.x, z: p.z };
      K.mover({ type: 'box', hw: GATE.hw, hd: GATE.hd, h: H + GATE.h }, (t) => { const l = palletLat(t); return { x: p.x + p.nx * l, z: p.z + p.nz * l, angle: p.angle }; });
      // the anchor (pallet fork) beside the road, rocking on the beat, between the escape wheel and the balance
      const an = new T.Shape();
      an.moveTo(-1, 0); an.lineTo(-1.1, -9); an.lineTo(-2.6, -10.5); an.lineTo(-7.5, -6.5); an.lineTo(-8.6, -7.6); an.lineTo(-3, -12.6); an.lineTo(0, -12.6);
      an.lineTo(3, -12.6); an.lineTo(8.6, -7.6); an.lineTo(7.5, -6.5); an.lineTo(2.6, -10.5); an.lineTo(1.1, -9); an.lineTo(1, 0); an.lineTo(1.6, 2.4); an.lineTo(-1.6, 2.4); an.closePath();
      const ag = new T.ExtrudeGeometry(an, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 });
      ag.rotateX(-PI / 2);
      const anchor = new T.Mesh(ag, MET(0xdfe3e8, 0.12, { envMapIntensity: 1.6 })); anchor.castShadow = true;
      const pal = new T.InstancedMesh(new K.RoundedBoxGeometry(1.2, 0.9, 2.2, 2, 0.2), ruby, 2);
      const m4 = new T.Matrix4();
      m4.compose(new T.Vector3(-8.1, 0.5, 7.0), new T.Quaternion().setFromEuler(new T.Euler(0, 0.7, 0)), new T.Vector3(1, 1, 1)); pal.setMatrixAt(0, m4);
      m4.compose(new T.Vector3(8.1, 0.5, 7.0), new T.Quaternion().setFromEuler(new T.Euler(0, -0.7, 0)), new T.Vector3(1, 1, 1)); pal.setMatrixAt(1, m4);
      const ax = GEAR.escape.x + Math.cos(2.1) * 22, az = GEAR.escape.z + Math.sin(2.1) * 22;
      const agrp = new T.Group(); agrp.position.set(ax, H + 1.6, az); agrp.add(anchor, pal);
      const aroot = new T.Group(); aroot.add(agrp);
      K.add(aroot); keep.push(aroot);
      A.anchor = { grp: agrp, base: PI / 2 - Math.atan2(GEAR.escape.z - az, GEAR.escape.x - ax) };
      K.mesh(new T.CylinderGeometry(1.3, 1.3, 1.6, 16), steel, ax, H + 0.8, az);
      jewel(ax, H + 2.4, az, 0.55, false);
      warnRoad('anchor', ax, az, 2);
    }
    // ---------------- bridges: the train bridge over the third wheel, a pillar bridge by the barrel ----------------
    const bridgeMat = MET(0xe2b862, 0.26, { metalness: 0.85, map: genBridge.map, normalMap: genBridge.normalMap, normalScale: V2(0.5), envMapIntensity: 1.2 });
    for (const t of Object.values(genBridge)) t.repeat.set(0.07, 0.07);
    const bridge = (pts, y, thick = 1.4) => {
      const s = new T.Shape();
      pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
      s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.45, bevelSegments: 2, curveSegments: 16 });
      g.rotateX(-PI / 2);
      const m = K.mesh(g, [bridgeMat, plateSide], 0, y, 0);
      for (const [x, z] of pts) if (!K.offRoad(x, z, 0.3)) console.warn('watchmaker: bridge corner on road', x.toFixed(1), z.toFixed(1));
      return m;
    };
    {
      // train bridge: from a foot north-west of the third wheel to a foot east of it, between barrel and fourth
      const G = GEAR.third;
      const P = [];
      const spine = [[G.x - 6, G.z + 3], [G.x, G.z], [G.x + 16, G.z - 1], [G.x + 34, G.z - 4]];
      const curve = new T.CatmullRomCurve3(spine.map(([x, z]) => new T.Vector3(x, 0, z)));
      const pp = curve.getPoints(24), wd = (t) => 3.4 + 2.2 * Math.exp(-((t - 0.28) ** 2) / 0.01) + 1.5 * Math.exp(-((t - 1) ** 2) / 0.006) + 1.5 * Math.exp(-(t ** 2) / 0.006);
      const left = [], right = [];
      pp.forEach((p, i) => {
        const t = i / (pp.length - 1), q = curve.getTangent(t), nx = -q.z, nz = q.x;
        left.push([p.x + nx * wd(t), p.z + nz * wd(t)]); right.push([p.x - nx * wd(t), p.z - nz * wd(t)]);
      });
      bridge(left.concat(right.reverse()), H + 3.0, 1.4);
      for (const [x, z] of [spine[0], spine[3]]) { K.mesh(new T.CylinderGeometry(2.4, 2.6, 3.0, 20), gilt, x, H + 1.5, z); K.circle(x, z, 2.6, H + 4.6); jewel(x, H + 4.8, z, 0.65, false); }
      jewel(G.x, H + 4.8, G.z, 0.9, true, 0.3);
      for (const [x, z] of [spine[0], spine[3]]) screwsB.push({ x: x + 2.6, y: H + 4.8, z: z + 1, s: 0.7, ry: 0.4 });
      AO(G.x + 10, G.z - 2, 24, 9, 0.35, -0.05, H + 0.06);
    }
    // ---------------- the crown and winding stem at XII (north) ----------------
    {
      const cx = MV.x, cz = MV.z - MV.R;
      const stem = K.mesh(new T.CylinderGeometry(1.1, 1.1, 22, 16), steel, cx, 4.4, cz - 3, { rx: PI / 2 });
      const crownG = new T.Group();
      const prof = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * PI; prof.push([5.5 + Math.sin(a) * 1.4, -3.5 + i * 0.7]); }
      const body = new T.Mesh(K.lathe([[0.001, -3.6], [5.6, -3.6], ...prof, [5.4, 3.6], [0.001, 3.8]], 48), gilt); crownG.add(body);
      // knurled ribs
      const rib = new T.Mesh(new T.BoxGeometry(0.5, 6.6, 0.7), gilt);
      const ribs = new T.InstancedMesh(rib.geometry, gilt, 36);
      const m4 = new T.Matrix4();
      for (let i = 0; i < 36; i++) { const a = i * TAU / 36; m4.makeRotationY(-a).setPosition(Math.cos(a) * 6.8, 0, Math.sin(a) * 6.8); ribs.setMatrixAt(i, m4); }
      crownG.add(ribs);
      crownG.position.set(cx, 7.4, cz - 15); crownG.rotation.x = PI / 2;
      K.add(crownG);
      K.mesh(new T.CylinderGeometry(3.4, 3.6, 3.5, 24), gilt, cx, 4.4, cz - 9.5, { rx: PI / 2 });
      AO(cx, cz - 13, 9, 7, 0.55);
      K.circle(cx, cz - 14, 8, 15);
      // keyless works on the plate: crown wheel and winding pinion
      K.mesh(new T.CylinderGeometry(4.2, 4.2, 0.9, 30), MET(0xe3e6ea, 0.14, { normalMap: ringNormal }), cx + 9, H + 0.45, cz + 12);
      jewel(cx + 9, H + 0.9, cz + 12, 0.6, false);
    }

    // ============================================================================================
    // RAMPS: spare gilt bridges leaning against the plate; the jump ramp is the sloped end of a bridge
    // ============================================================================================
    const rampVis = (s0, s1, y0, y1, width, mat) => {
      const pa = track.at(s0), pb = track.at(s1);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z), ang = Math.atan2(pb.z - pa.z, pb.x - pa.x);
      const grp = new T.Group();
      const slope = Math.atan2(y1 - y0, len);
      const plank = new T.Mesh(new K.RoundedBoxGeometry(len / Math.cos(slope) + 0.6, 0.8, width, 2, 0.3), mat);
      plank.position.y = -0.42; grp.add(plank);
      grp.position.set((pa.x + pb.x) / 2, (y0 + y1) / 2, (pa.z + pb.z) / 2);
      grp.rotation.order = 'YZX'; grp.rotation.y = -ang; grp.rotation.z = slope;
      K.add(grp);
      return { ang, len, mid: [(pa.x + pb.x) / 2, (pa.z + pb.z) / 2] };
    };
    const genRamp = geneva(4, 128, 128);
    const rampMat = MET(0xe0b660, 0.3, { metalness: 0.75, map: genRamp.map, normalMap: genRamp.normalMap, normalScale: V2(0.5), envMapIntensity: 1.2 });
    for (const [a, b] of rampS) {
      const pa = track.at(a), pb = track.at(b);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z), ang = Math.atan2(pb.z - pa.z, pb.x - pa.x);
      K.ramp((pa.x + pb.x) / 2, (pa.z + pb.z) / 2, ang, len, 14.5, H, 0);
      const v = rampVis(a, b, 0.0, H + 0.02, 15.2, rampMat);
      // jewels and screws along the spare bridge's edges, a polished end
      for (const sd of [-1, 1]) for (const f of [0.25, 0.7]) {
        const q = track.place(a + (b - a) * f, sd * 6.4);
        screwsB.push({ x: q.x, y: H * f + 0.05, z: q.z, s: 0.55, ry: f * 3 });
      }
      AO(v.mid[0], v.mid[1], len * 0.6, 8.5, 0.5, ang);
    }
    // jump: a gilt wedge on the plate, launching over the motion-works pit
    {
      const pa = track.at(JUMP.r0), pb = track.at(JUMP.r1);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z), ang = Math.atan2(pb.z - pa.z, pb.x - pa.x);
      const hgt = 2.1;
      K.ramp((pa.x + pb.x) / 2, (pa.z + pb.z) / 2, ang, len, 14, hgt, H);
      const prof = new T.Shape(); prof.moveTo(0, 0); prof.lineTo(len, 0); prof.lineTo(len, hgt); prof.lineTo(len - 0.6, hgt + 0.05); prof.closePath();
      const g = new T.ExtrudeGeometry(prof, { depth: 14, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 });
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getZ(i) / 14, pos.getX(i) / 14);
      g.translate(-len / 2, 0, -7);
      const wc = TX.makeCanvas(256, 256), wg = wc.getContext('2d');
      for (let i = 0; i < 8; i++) { const gg = wg.createLinearGradient(i * 32, 0, i * 32 + 32, 0); gg.addColorStop(0, '#f6d58a'); gg.addColorStop(1, '#a8802e'); wg.fillStyle = gg; wg.fillRect(i * 32, 0, 32, 256); }
      for (let i = 0; i < 3; i++) {
        const y = 200 - i * 62; // canvas up = towards the pit
        wg.fillStyle = '#1a0d04'; wg.beginPath(); wg.moveTo(20, y + 30); wg.lineTo(128, y - 18); wg.lineTo(236, y + 30); wg.lineTo(236, y + 50); wg.lineTo(128, y + 2); wg.lineTo(20, y + 50); wg.closePath(); wg.fill();
        wg.fillStyle = '#d61f2e'; wg.beginPath(); wg.moveTo(28, y + 30); wg.lineTo(128, y - 12); wg.lineTo(228, y + 30); wg.lineTo(228, y + 42); wg.lineTo(128, y + 8); wg.lineTo(28, y + 42); wg.closePath(); wg.fill();
      }
      const wt = TX.toTexture(wc, { wrap: false });
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getZ(i) / 14 + 0.5, (pos.getX(i) + len / 2) / len);
      const wedgeMat = MET(0xffffff, 0.32, { metalness: 0.7, map: wt, envMapIntensity: 1.1 });
      const m = new T.Mesh(g, [plateSide, wedgeMat]); // caps are the triangular sides, the slope is a side wall
      const grp = new T.Group(); grp.add(m); grp.position.set((pa.x + pb.x) / 2, H, (pa.z + pb.z) / 2); grp.rotation.y = -ang;
      K.add(grp);
      AO((pa.x + pb.x) / 2, (pa.z + pb.z) / 2, len / 2 + 1, 8, 0.4, ang, H + 0.06);
    }

    // ============================================================================================
    // PLATE DETAIL: jewels in chatons, blued screws, engravings, road-edge screws, plate pillars
    // ============================================================================================
    {
      // rows of blued screws along the road edges on the plate (every 9 units), rubies every third
      for (const sd of [-1, 1]) for (const p of track.edgePoints(sd, 9, 1.95)) {
        const s = p.s;
        if (!onPlateRoad(p.x, p.z, s) || inSink(p.x, p.z, 1.6) || inPit(p.x, p.z, 2) || dM(p.x, p.z) > MV.R - 2.5) continue;
        if (Math.abs(s - sGate) < 5 || inS(s, JUMP.r0 - 2, JUMP.p1 + 2)) continue;
        if (Math.round(s / 9) % 3 === 0) jewel(p.x, H, p.z, 0.55, false);
        else screwsB.push({ x: p.x, y: H, z: p.z, s: 0.62, ry: s * 0.7 });
      }
      // plate pillar screws round the rim
      for (let k = 0; k < 14; k++) {
        const a = k * TAU / 14 + 0.12, x = MV.x + Math.cos(a) * (MV.R - 3.2), z = MV.z + Math.sin(a) * (MV.R - 3.2);
        if (!K.offRoad(x, z, 1.5) || inSink(x, z, 1.5) || inPit(x, z, 1.5)) continue;
        screwsB.push({ x, y: H, z, s: 1.05, ry: a * 2 });
      }
      // decorative jewels in free spots of the plate
      for (const [x, z] of [[-70, -12], [-95, 12], [22, -2], [38, -12], [-8, -70], [-48, -62], [-20, 70], [12, 64], [-86, -58], [40, 40]]) {
        if (dM(x, z) > MV.R - 4 || !K.offRoad(x, z, 3) || inSink(x, z, 2) || inPit(x, z, 2)) continue;
        jewel(x, H, z, 1.0, true, x * 0.1);
      }
      // engravings: gilt-filled lettering on the plate
      const engr = (text, x, z, ang, size, w = 60) => {
        const c = TX.makeCanvas(512, 64), g = c.getContext('2d');
        g.clearRect(0, 0, 512, 64);
        g.font = `600 40px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(25,16,4,0.85)'; g.fillText(text, 257, 34);
        g.fillStyle = '#f2c46a'; g.fillText(text, 256, 32);
        const m = new T.Mesh(new T.PlaneGeometry(w * size, w * size / 8), K.std({ map: TX.toTexture(c, { wrap: false }), transparent: true, depthWrite: false, metalness: 0.6, roughness: 0.3, envMap: ENV, polygonOffset: true, polygonOffsetFactor: -2 }));
        m.rotation.x = -PI / 2; m.rotation.z = -ang; m.position.set(x, H + 0.05, z);
        m.renderOrder = 2;
        K.group.add(m);
      };
      engr('TWENTY-ONE  JEWELS', -84, -4, -1.35, 0.42);
      engr('ADJUSTED  ·  5  POSITIONS', 34, -6, 0.0, 0.34);
      engr('No 1847', 4, 64, 0.2, 0.3);
      engr('UNADJUSTED  HEAT & COLD', -46, 10, 0.55, 0.3);
    }

    // ============================================================================================
    // THE DIAL on the start straight (enamel, Roman numerals, XII by the line)
    // ============================================================================================
    {
      const R = DIAL.R, S = 1024, k = S / (2 * R);
      const c = TX.makeCanvas(S, S), g = c.getContext('2d');
      g.translate(S / 2, S / 2);
      const eg = g.createRadialGradient(-80, -100, 50, 0, 0, S / 2); eg.addColorStop(0, '#fffdf7'); eg.addColorStop(1, '#efe9da');
      g.fillStyle = eg; g.beginPath(); g.arc(0, 0, S / 2, 0, TAU); g.fill();
      // the dial is rotated so that XII lies just west of the road at the start line
      // canvas: +x = along the road (driving direction), +y = road's right; road runs through the centre
      const toC = (wx, wz) => { const dx = wx - DIAL.x, dz = wz - DIAL.z, c2 = Math.cos(-DIAL.ang), s2 = Math.sin(-DIAL.ang); return [(dx * c2 - dz * s2) * k, (dx * s2 + dz * c2) * k]; };
      // minute track (railway) and chapter rings
      g.strokeStyle = '#1b1b22'; g.lineWidth = 2.2;
      for (const rr of [R - 1.5, R - 3.0, R - 9.2]) { g.beginPath(); g.arc(0, 0, rr * k, 0, TAU); g.stroke(); }
      // XII points to the road's left (west); hour angle 0 at -y
      const hourAng = (h) => -PI / 2 + h * TAU / 12;
      for (let m = 0; m < 60; m++) {
        const a = hourAng(m / 5);
        g.save(); g.rotate(a); g.fillStyle = '#1b1b22';
        g.fillRect((R - 3.0) * k, -(m % 5 ? 0.12 : 0.3) * k, 1.5 * k, (m % 5 ? 0.24 : 0.6) * k);
        g.restore();
      }
      const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      g.fillStyle = '#16161c'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let h = 0; h < 12; h++) {
        const a = hourAng(h), rr = (R - 6.1) * k;
        g.save(); g.translate(Math.cos(a) * rr, Math.sin(a) * rr); g.rotate(a + PI / 2);
        g.font = `${Math.round(5.0 * k)}px Georgia, serif`; g.fillText(roman[h], 0, 0);
        g.restore();
      }
      // maker's name and sub-seconds dial at VI
      g.save(); g.rotate(hourAng(0) + PI / 2);
      g.font = `italic ${Math.round(2.4 * k)}px Georgia, serif`; g.fillStyle = '#222'; g.fillText('Tabletop & Fils', 0, -11.5 * k);
      g.font = `${Math.round(1.4 * k)}px Georgia, serif`; g.fillText('CHRONOMÈTRE  ·  GENÈVE-SUR-TABLE', 0, -9.0 * k);
      g.restore();
      {
        const a = hourAng(6), sx = Math.cos(a) * 14 * k, sy = Math.sin(a) * 14 * k;
        g.strokeStyle = '#2a2a30'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx, sy, 6 * k, 0, TAU); g.stroke();
        for (let i = 0; i < 60; i++) { const b = i * TAU / 60; g.beginPath(); g.moveTo(sx + Math.cos(b) * 6 * k, sy + Math.sin(b) * 6 * k); g.lineTo(sx + Math.cos(b) * (i % 5 ? 5.4 : 4.8) * k, sy + Math.sin(b) * (i % 5 ? 5.4 : 4.8) * k); g.stroke(); }
      }
      // the road across the dial: thin double black borders, chequered start band across the centre
      const half = 7, bandW = 3.6;
      g.fillStyle = 'rgba(20,20,26,0.92)';
      for (const sd of [-1, 1]) { g.fillRect(-R * k, (sd * half - (sd > 0 ? 0 : 0.5)) * k, 2 * R * k, 0.5 * k); g.fillRect(-R * k, (sd * (half + 1.0) - (sd > 0 ? 0 : 0.18)) * k, 2 * R * k, 0.18 * k); }
      const cell = 2 * half / 8;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#15151a' : '#fbf9f2'; g.fillRect((-bandW / 2 + i * bandW / 2) * k, (-half + j * cell) * k, (bandW / 2) * k + 1, cell * k + 1); }
      // small hole for the hands
      g.fillStyle = '#2a2016'; g.beginPath(); g.arc(0, 0, 0.7 * k, 0, TAU); g.fill();
      const tex = TX.toTexture(c, { wrap: false });
      const geo = new T.CylinderGeometry(R, R, 0.4, 96);
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      // map: canvas x along the road (track angle), canvas y to the right
      const ca = Math.cos(DIAL.ang), sa = Math.sin(DIAL.ang);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const along = x * ca + z * sa, right = -x * sa + z * ca;
        uv.setXY(i, along / (2 * R) + 0.5, 1 - (right / (2 * R) + 0.5));
      }
      const enamel = K.phys({ map: tex, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMap: ENV, envMapIntensity: 0.7 });
      const dial = new T.Mesh(geo, [K.std({ color: 0xc9a050, metalness: 1, roughness: 0.3, envMap: ENV }), enamel, enamel]);
      dial.position.set(DIAL.x, 0.2, DIAL.z); dial.receiveShadow = true; dial.castShadow = true;
      K.add(dial);
      discPlatforms(DIAL.x, DIAL.z, DIAL.R, 0.4, 10);
      AO(DIAL.x, DIAL.z, R + 2, R + 2, 0.45, 0, 0.02);
      A.dial = DIAL;
    }

    // ============================================================================================
    // BENCH PROPS
    // ============================================================================================
    const black = K.phys({ color: 0x121214, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    // tweezers (west bench, between the road and the plate)
    const tweezers = (x, z, ang, len = 40, open = 0.08) => {
      const g = new T.Group();
      for (const sd of [-1, 1]) {
        const arm = new T.Shape();
        arm.moveTo(0, -1.3); arm.lineTo(len * 0.7, -1.0); arm.lineTo(len, -0.12); arm.lineTo(len, 0.12); arm.lineTo(len * 0.7, 1.0); arm.lineTo(0, 1.3); arm.closePath();
        const ag = new T.ExtrudeGeometry(arm, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 1 });
        ag.rotateX(-PI / 2);
        const m = new T.Mesh(ag, steel);
        const pv = new T.Group(); pv.add(m); pv.rotation.y = sd * open; pv.position.y = 0.3 + (sd > 0 ? 0.5 : 0);
        pv.rotation.z = sd > 0 ? -0.02 : 0;
        g.add(pv);
      }
      // grip ridges
      const gr = new T.InstancedMesh(new T.BoxGeometry(0.3, 0.15, 2.4), steelDark, 10);
      const m4 = new T.Matrix4();
      for (let i = 0; i < 10; i++) { m4.makeTranslation(len * 0.3 + i * 1.1, 1.2, 0); gr.setMatrixAt(i, m4); }
      g.add(gr);
      g.position.set(x, 0, z); g.rotation.y = -ang;
      K.add(g);
      const ex = x + Math.cos(ang) * len, ez = z + Math.sin(ang) * len;
      K.capsule(x, z, ex, ez, 1.4, 1.6);
      AO((x + ex) / 2, (z + ez) / 2, len / 2 + 1, 2.4, 0.4, ang);
      warnRoad('tweezers', x, z, 1); warnRoad('tweezers tip', ex, ez, 1);
    };
    tweezers(-126, -14, PI / 2 - 0.05, 40);
    tweezers(90, -46, 0.15, 30, 0.12);
    // screwdriver stand (north-west) with five drivers, coloured caps
    {
      const cx = -145, cz = -82;
      K.mesh(K.lathe([[0.001, 0], [12, 0], [12.4, 0.6], [11.6, 2.6], [10.6, 3], [0.001, 3]], 48), K.phys({ color: 0x23262c, roughness: 0.3, metalness: 0.5, clearcoat: 0.6, envMap: ENV }), cx, 0, cz);
      const caps = [0xd63a2c, 0x2f6fe0, 0xf0bb1c, 0x27a352, 0x7a4fc8, 0xe0e0e0].map((c) => K.plastic(c, 0.3));
      const knurl = MET(0xcfd3d8, 0.32);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + 0.3, x = cx + Math.cos(a) * 7.2, z = cz + Math.sin(a) * 7.2, h = 26 + (i % 3) * 3;
        // knurled steel handle, cap, blade
        K.mesh(new T.CylinderGeometry(1.5, 1.5, h - 6, 18), knurl, x, 3 + (h - 6) / 2 + 3, z);
        K.mesh(new T.CylinderGeometry(1.45, 1.5, 1.6, 18), caps[i], x, h + 0.8, z);
        K.mesh(new T.CylinderGeometry(0.45, 0.25, 6, 10), steel, x, 3, z);
      }
      K.circle(cx, cz, 12.4, 30);
      AO(cx, cz, 14, 14, 0.55);
      // a single screwdriver lying on the bench, south strip
      const sd = new T.Group();
      const hd = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 22, 18), knurl); hd.rotation.z = PI / 2; sd.add(hd);
      const cp = new T.Mesh(new T.CylinderGeometry(1.45, 1.5, 1.6, 18), caps[0]); cp.rotation.z = PI / 2; cp.position.x = -11.8; sd.add(cp);
      const bl = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 9, 10), steel); bl.rotation.z = PI / 2; bl.position.x = 15.5; sd.add(bl);
      const tip = new T.Mesh(new T.BoxGeometry(1.4, 0.2, 0.9), steel); tip.position.x = 20.5; sd.add(tip);
      sd.position.set(-60, 1.5, 93); sd.rotation.y = 0.08;
      K.add(sd);
      K.capsule(-72, 94, -40, 91.5, 1.6, 3);
      AO(-56, 93, 18, 2.4, 0.4, -0.08);
    }
    // oil pot (glass dome on a brass base) north of the west corner, its oil spilt across the road
    {
      const x = -128, z = -58;
      K.mesh(K.lathe([[0.001, 0], [7.4, 0], [7.8, 0.6], [7.4, 2.2], [6.2, 2.6], [0.001, 2.6]], 40), gilt, x, 0, z);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3, px = x + Math.cos(a) * 3.6, pz = z + Math.sin(a) * 3.6; K.mesh(K.lathe([[0.001, 0], [2.1, 0], [2.2, 1.2], [1.8, 1.25], [0.001, 0.6]], 24), steel, px, 2.6, pz); K.mesh(new T.CircleGeometry(1.75, 20), K.liquid(0xd59a2a, { roughness: 0.05 }), px, 3.45, pz, { rx: -PI / 2 }); }
      K.mesh(new T.SphereGeometry(7, 32, 16, 0, TAU, 0, PI / 2), K.glass(0xffffff, 0.16), x + 9, 0, z + 6, { cast: false, rz: 1.75 });
      K.circle(x, z, 7.8, 4);
      AO(x, z, 9, 9, 0.5);
      // the oiler lying beside it
      const ol = new T.Group();
      const hnd = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 14, 12), K.phys({ color: 0x8a2b1c, roughness: 0.35, clearcoat: 0.5 })); hnd.rotation.z = PI / 2; ol.add(hnd);
      const nd = new T.Mesh(new T.CylinderGeometry(0.25, 0.1, 7, 8), steel); nd.rotation.z = PI / 2; nd.position.x = 10.5; ol.add(nd);
      ol.position.set(x - 2, 0.9, z + 12); ol.rotation.y = 0.5; K.add(ol);
      // spill: a trail of oil from the pot to a slick across the west corner
      const oil = K.phys({ color: 0x6a4210, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.72, envMap: ENV, envMapIntensity: 2.2 });
      const sp = sAt(-150, -24);
      const q = track.place(sp, -1);
      const spill = K.spill(q.x, q.z, 8.5, oil, { lump: 0.38, stretch: 1.5, angle: q.angle + 0.5, y: 0.13, thick: 0.12 });
      K.surface('slick', { poly: spill.poly });
      for (let i = 1; i < 5; i++) K.spill(x + (q.x - x) * i / 5 + r.range(-1.5, 1.5), z + (q.z - z) * i / 5 + r.range(-1.5, 1.5), r.range(1, 2.2), oil, { y: 0.1, thick: 0.1, n: 18 });
    }
    // oil drops on the plate after the centre wheel (watch oil on rhodium)
    {
      const oil = K.phys({ color: 0x5a3a10, roughness: 0.08, clearcoat: 0.6, clearcoatRoughness: 0.08, transparent: true, opacity: 0.62, envMap: ENV, envMapIntensity: 1.2 });
      const q = track.place(JUMP.p1 + 9, 2.2);
      const sp = K.spill(q.x, q.z, 4.8, oil, { lump: 0.3, stretch: 1.4, angle: q.angle, y: H + 0.12, thick: 0.08 });
      K.surface('slick', { poly: sp.poly });
      const q2 = track.place(dBal[0] - 6, -2.5);
      const sp2 = K.spill(q2.x, q2.z, 4.2, oil, { lump: 0.3, stretch: 1.3, angle: q2.angle, y: H + 0.12, thick: 0.08 });
      K.surface('slick', { poly: sp2.poly });
    }
    // loupe (black eyeglass cone) on the east bench
    {
      const x = 104, z = -30;
      const lp = K.lathe([[6.2, 0], [6.6, 0.4], [6.4, 1.2], [5.2, 9], [4.6, 11.2], [4.2, 11.2], [4.6, 9], [5.7, 1.2], [5.6, 0.4], [0.001, 0.4]], 48);
      K.mesh(lp, black, x, 0, z);
      K.mesh(new T.CircleGeometry(5.6, 40), K.glass(0xcfe6ff, 0.35), x, 0.7, z, { rx: -PI / 2, cast: false });
      K.mesh(new T.TorusGeometry(4.4, 0.35, 8, 40), gilt, x, 11.2, z, { rx: PI / 2 });
      K.circle(x, z, 6.6, 11);
      AO(x, z, 7.5, 7.5, 0.55);
      warnRoad('loupe', x, z, 7);
    }
    // parts tray with compartments and tiny screws (east bench, north of the case bend)
    {
      const x = 76, z = -24, w = 30, d = 17;
      const trayMat = K.phys({ color: 0x2b3a56, roughness: 0.35, clearcoat: 0.6 });
      K.mesh(new K.RoundedBoxGeometry(w, 1.0, d, 2, 0.4), trayMat, x, 0.5, z);
      const wall = (wx, wz, ww, wd) => K.mesh(new K.RoundedBoxGeometry(ww, 2.4, wd, 2, 0.2), trayMat, x + wx, 1.2, z + wz);
      wall(0, -d / 2 + 0.4, w, 0.8); wall(0, d / 2 - 0.4, w, 0.8); wall(-w / 2 + 0.4, 0, 0.8, d); wall(w / 2 - 0.4, 0, 0.8, d);
      wall(-w / 6, 0, 0.6, d); wall(w / 6, 0, 0.6, d); wall(0, 0, w, 0.6);
      const tiny = [];
      for (let i = 0; i < 6; i++) {
        const cx = x + (i % 3 - 1) * w / 3, cz = z + (i < 3 ? -1 : 1) * d / 4;
        for (let k = 0; k < 9; k++) tiny.push({ x: cx + r.range(-3.6, 3.6), y: 1.2, z: cz + r.range(-2.6, 2.6), s: r.range(0.35, 0.5), ry: r() * 6, rx: r.range(-0.5, 0.5), color: i % 2 ? 0x2a4fb8 : 0xd8d2c0 });
      }
      K.instances(screwHeadGeo, MET(0xffffff, 0.25), tiny, { colors: true, cast: false });
      for (let k = 0; k < 8; k++) jewels.push({ x: x + w / 3 + r.range(-3, 3), y: 1.25, z: z - d / 4 + r.range(-2, 2), s: 0.5 });
      K.box(x, z, w / 2, d / 2, 0, 2.4);
      AO(x, z, w / 2 + 2, d / 2 + 2, 0.5);
      warnRoad('tray', x, z, d / 2);
    }
    // pocket-watch case (inside the case bend) with its back lid lying open beside it
    {
      const x = 86, z = 24, R = 12.4;
      const prof = [[0.001, 0], [R - 1.2, 0], [R - 0.2, 0.6], [R, 1.8], [R - 0.3, 3.4], [R - 1.0, 4.0], [R - 1.6, 4.0], [R - 1.6, 1.2], [0.001, 1.2]];
      K.mesh(K.lathe(prof, 64), gilt, x, 0, z);
      K.mesh(new T.CircleGeometry(R - 1.6, 48), MET(0xd4ab55, 0.35, { normalMap: ringNormal, normalScale: V2(0.6) }), x, 1.25, z, { rx: -PI / 2 });
      // pendant and bow at the top
      // pendant and bow point away from the road (south-west, into the open side of the bend)
      const bA = 2.2, bc = Math.cos(bA), bs = Math.sin(bA);
      K.mesh(new T.CylinderGeometry(1.4, 1.6, 3.4, 16), gilt, x + bc * (R + 1.2), 2, z + bs * (R + 1.2), { rx: PI / 2, ry: -bA + PI / 2 }).rotation.order = 'YXZ';
      const bow = K.mesh(new T.TorusGeometry(3.6, 0.55, 10, 32), gilt, x + bc * (R + 5.4), 1.0, z + bs * (R + 5.4), { rx: PI / 2 });
      // lid lying beside it, inside up, engraved
      const lc = TX.makeCanvas(256, 256), lg = lc.getContext('2d');
      lg.fillStyle = '#d8b260'; lg.fillRect(0, 0, 256, 256);
      lg.strokeStyle = 'rgba(80,50,10,0.6)'; lg.lineWidth = 2;
      for (let i = 0; i < 9; i++) { lg.beginPath(); lg.arc(128, 128, 30 + i * 11, 0, TAU); lg.stroke(); }
      lg.fillStyle = 'rgba(70,45,10,0.8)'; lg.font = 'italic 26px Georgia, serif'; lg.textAlign = 'center'; lg.fillText('for A. B.', 128, 120); lg.font = '18px Georgia, serif'; lg.fillText('with love · 1891', 128, 150);
      const lid = K.mesh(K.lathe([[0.001, 0.9], [R - 0.6, 0.9], [R - 0.2, 0.3], [R, 0], [R - 0.4, 0.05], [0.001, 0.05]], 64), gilt, x - 4, 0, z + 34);
      K.mesh(new T.CircleGeometry(R - 0.7, 48), MET(0xffffff, 0.3, { map: TX.toTexture(lc, { wrap: false }) }), x - 4, 0.95, z + 34, { rx: -PI / 2, cast: false });
      K.circle(x, z, R, 4.2); K.circle(x + bc * (R + 5.4), z + bs * (R + 5.4), 4, 2.2);
      K.circle(x - 4, z + 34, R, 1.2);
      AO(x, z, R + 1.5, R + 1.5, 0.55); AO(x - 4, z + 34, R + 1, R + 1, 0.4);
      warnRoad('case lid', x - 4, z + 34, R);
    }
    // the watch hands, lying beside the start straight (blued steel, spade and whip)
    {
      const hand = (x, z, ang, len, wide) => {
        const s = new T.Shape();
        s.moveTo(-3, -0.6); s.lineTo(len * 0.62, -0.5); s.bezierCurveTo(len * 0.7, -wide, len * 0.8, -wide, len * 0.86, -0.2); s.lineTo(len, 0); s.lineTo(len * 0.86, 0.2);
        s.bezierCurveTo(len * 0.8, wide, len * 0.7, wide, len * 0.62, 0.5); s.lineTo(-3, 0.6); s.closePath();
        const ring = new T.Path(); ring.absarc(0, 0, 0.8, 0, TAU, true); s.holes.push(ring);
        const g = new T.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
        g.rotateX(-PI / 2);
        const m = K.mesh(g, blued, x, 0.05, z, { ry: -ang });
        K.mesh(new T.CylinderGeometry(1.8, 1.8, 0.35, 24), blued, x, 0.2, z);
        AO(x + Math.cos(ang) * len / 2, z + Math.sin(ang) * len / 2, len / 2, 2.2, 0.35, ang);
      };
      hand(157, -66, PI / 2 + 0.1, 30, 2.4);
      hand(162, 20, PI / 2 - 0.15, 22, 3.2);
    }
    // the movement holder: a ring with three jaws (south-east bench)
    {
      const x = 70, z = 88;
      K.mesh(new T.TorusGeometry(10.5, 1.6, 12, 48), K.phys({ color: 0x3a3f48, roughness: 0.3, metalness: 0.7, envMap: ENV }), x, 1.6, z, { rx: PI / 2 });
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; K.mesh(new K.RoundedBoxGeometry(5, 3.4, 2.4, 2, 0.4), steel, x + Math.cos(a) * 10.5, 1.7, z + Math.sin(a) * 10.5, { ry: -a }); }
      K.circle(x, z, 12.5, 3.4);
      AO(x, z, 13, 13, 0.45);
      warnRoad('holder', x, z, 12);
    }
    // cleaning brush (south of the movement)
    {
      const g = new T.Group();
      const hnd = new T.Mesh(new T.CylinderGeometry(1.4, 1.1, 24, 16), K.phys({ color: 0x8a5a32, roughness: 0.45, clearcoat: 0.4 })); hnd.rotation.z = PI / 2; g.add(hnd);
      const fer = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 3, 16), gilt); fer.rotation.z = PI / 2; fer.position.x = 13; g.add(fer);
      const bri = new T.Mesh(new T.CylinderGeometry(1.6, 2.2, 7, 16), K.std({ color: 0xe8dcc0, roughness: 0.95 })); bri.rotation.z = PI / 2; bri.position.x = 18; g.add(bri);
      g.position.set(18, 1.5, 88); g.rotation.y = 0.18;
      K.add(g);
      K.capsule(6, 90.2, 40, 84, 2, 3);
      AO(22, 87.5, 17, 2.6, 0.4, -0.18);
    }
    // a blob of cleaning putty and a rubber dust blower at the north-east
    {
      K.mesh(new T.SphereGeometry(3.2, 20, 14), K.phys({ color: 0x5bc8b6, roughness: 0.5, clearcoat: 0.3 }), 72, 1.4, -92, { scale: 1 }).scale.set(1.2, 0.5, 1);
      AO(72, -92, 4, 3.4, 0.4);
      const bl = new T.Group();
      const bulb = new T.Mesh(new T.SphereGeometry(6, 28, 18), K.phys({ color: 0xc8302a, roughness: 0.45, clearcoat: 0.3 })); bulb.scale.set(1.25, 1, 1); bl.add(bulb);
      const noz = new T.Mesh(new T.CylinderGeometry(0.8, 2.2, 8, 16), black); noz.rotation.z = PI / 2; noz.position.x = 10; bl.add(noz);
      bl.position.set(40, 6, -94); bl.rotation.y = 0.3; K.add(bl);
      K.circle(40, -94, 7.5, 12);
      AO(41, -94, 9, 7, 0.5);
    }
    // the magnifier lamp at the north edge: clamp, arm, ring head with its lens
    {
      const bx = -60, bz = -103;
      const lampMat = K.phys({ color: 0xe8e6e0, roughness: 0.35, clearcoat: 0.6, metalness: 0.1 });
      K.mesh(new K.RoundedBoxGeometry(12, 6, 8, 2, 1), lampMat, bx, 3, bz);
      const arm1 = K.mesh(new T.CylinderGeometry(1.1, 1.1, 46, 12), steel, bx, 26, bz - 4, { rx: -0.25 });
      const arm2 = K.mesh(new T.CylinderGeometry(1.1, 1.1, 44, 12), steel, bx + 14, 50, bz - 12, { rz: -1.0 });
      const head = new T.Group();
      head.add(new T.Mesh(new T.TorusGeometry(19, 3.2, 14, 64), lampMat));
      const tube = new T.Mesh(new T.TorusGeometry(19, 1.4, 10, 64), K.std({ color: 0xfff6e0, emissive: 0xfff2d8, emissiveIntensity: 2.2 }));
      tube.position.y = -1.6; head.add(tube);
      head.add(new T.Mesh(new T.CircleGeometry(17, 48), K.glass(0xe0f0ff, 0.12)).rotateX(-PI / 2));
      head.position.set(bx + 34, 66, bz - 26); head.rotation.x = 0.35; head.rotation.z = 0.15;
      K.add(head, { cast: false });
      // its light: a warm pool on the movement
      const spot = new T.SpotLight(0xffe8c8, 3.8, 0, 0.62, 0.8, 0);
      spot.position.set(-30, 150, -95); spot.target.position.set(-22, 0, 4);
      spot.castShadow = false;
      K.group.add(spot, spot.target);
      A.spot = spot;
    }
    // loose screws: pushable, lying on the bench road and on the barrel deck
    {
      const sg = new T.Group();
      const head = new T.Mesh(screwHeadGeo, blued); head.rotation.z = PI / 2; head.position.x = -1.2; head.scale.setScalar(1.1); sg.add(head);
      const shank = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 3.2, 12), steel); shank.rotation.z = PI / 2; shank.position.x = 0.8; sg.add(shank);
      const spots = [[START_S + 70, 2.5], [START_S + 82, -3], [sAt(-152, 30), 1.5], [sAt(-152, 40), -2.8], [sAt(107, 50), 2], [dB[0] + 14, -3.2], [dB[0] + 22, 3.4]];
      for (const [s, lat] of spots) {
        const q = track.place(s, lat);
        const g0 = groundY(q.x, q.z);
        const m = sg.clone(); m.position.set(q.x, g0 + 1.1, q.z); m.rotation.y = r() * 6;
        K.add(m);
        const d = K.physics.addDynamic({ x: q.x, z: q.z, r: 1.6, m: 0.55, h: 2.2, mesh: m, slide: true, friction: 20, baseY: g0 + 1.1 });
        d.lift = 1.1;
        A.screws.push(d);
      }
    }
    function groundY(x, z) { return K.physics.groundAt(x, z).g; }

    // ============================================================================================
    // FINE SCATTER: stray jewels, tiny screws, brass shavings, dust on the mat
    // ============================================================================================
    {
      const scat = [], shav = [];
      for (let i = 0; i < 260; i++) {
        const x = r.range(BOUNDS.minX + 8, BOUNDS.maxX - 8), z = r.range(BOUNDS.minZ + 8, BOUNDS.maxZ - 8);
        if (dM(x, z) < MV.R + 2 || !K.offRoad(x, z, 1.5) || onDial(x, z)) continue;
        if (r() < 0.5) shav.push({ x, y: 0.12, z, ry: r() * 6, s: r.range(0.5, 1.2), color: r.pick([0xd8b25a, 0xc9c9c9, 0xb08a3a]) });
        else scat.push({ x, y: 0.05, z, ry: r() * 6, s: r.range(0.28, 0.45), color: r.pick([0x2a4fb8, 0xd0d4da, 0xd0d4da, 0xc9a24a]) });
      }
      K.instances(screwHeadGeo, MET(0xffffff, 0.3), scat, { colors: true, cast: false });
      const shg = new T.TorusGeometry(1, 0.08, 4, 10, PI * 1.4); shg.rotateX(PI / 2);
      K.instances(shg, MET(0xffffff, 0.3), shav, { colors: true, cast: false });
      for (let i = 0; i < 26; i++) {
        const x = r.range(-160, 160), z = r.range(-95, 95);
        if (dM(x, z) < MV.R + 2 || !K.offRoad(x, z, 2) || onDial(x, z)) continue;
        jewels.push({ x, y: 0.15, z, s: r.range(0.4, 0.6) });
      }
    }

    // ============================================================================================
    // INSTANCED JEWELS, CHATONS, SCREWS, CONTACT SHADOWS + MERGE
    // ============================================================================================
    {
      keep.push(K.instances(chatonGeo, gilt, chatons, { cast: false }));
      keep.push(K.instances(jewelGeo, ruby, jewels, { cast: false }));
      keep.push(K.instances(screwHeadGeo, blued, screwsB, { cast: true }));
      keep.push(K.instances(slotGeo, K.std({ color: 0x0a0c14, roughness: 0.6 }), screwsB.map((q) => ({ x: q.x, y: q.y + 0.55 * q.s, z: q.z, ry: q.ry, s: q.s })), { cast: false }));
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.push(im);
    }
    {
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          g.clearGroups();
          geos.push(g);
        }
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        const m = new T.Mesh(merged, list[0].material);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
    if (typeof window !== 'undefined') window.__wm = A;
  },

  // fixed rate: catch cars that dropped off the plate away from the road, and cars that fell into the jump pit
  tick(dt, time, game) {
    if (!A) return;
    const racing = game.state === 'race' || game.state === 'roundEnd' || game.state === 'attract';
    const P = A.jumpPit;
    for (const e of game.cars) {
      if (e.out) continue;
      const c = e.car;
      if (c.state === 'falling') {
        if (P && c.fallKind === 'hole') {
          const dx = c.x - P.cx, dz = c.z - P.cz, cs = Math.cos(P.ang), sn = Math.sin(P.ang);
          if (Math.abs(dx * cs + dz * sn) < P.hw + 3 && Math.abs(-dx * sn + dz * cs) < P.hd + 3) e.lastGoodS = A.sLand + 3;
        }
        continue;
      }
      if (c.state !== 'drive') continue;
      if (!c.airborne && c.y < 1 && A.plateau[e.trackI]) {
        e.wmDrop = (e.wmDrop || 0) + dt;
        if (e.wmDrop > 0.35 && racing) { e.offT = 2; e.wmDrop = 0; }
      } else e.wmDrop = 0;
      // about to be respawned: forget the wheel it stood on, or the engine would fling it from the old wheel's centre
      if (e.offT > 1.45) c.spinner = null;
    }
    for (const d of A.screws) if (d.state === 'live') d.baseY = game.physics.groundAt(d.x, d.z).g + d.lift;
  },

  animate(time, dt, game) {
    if (!A) return;
    for (const s of A.rot) s.o.rotation.y = -s.f(time);
    if (A.hair) A.hair.rotation.y = -balAngle(time) * 0.85;
    const st = game && game.state;
    const live = st === 'race' || st === 'countdown' || st === 'roundEnd' || st === 'attract';
    // the pallet and its warning lamps
    if (A.gate) {
      const G = A.gate, l = palletLat(time);
      G.stone.position.set(0, 0, l);
      const u = time - Math.floor(time / BEAT) * BEAT;
      const warn = u > BEAT - GATE.warn ? (u - (BEAT - GATE.warn)) / GATE.warn : 0;
      const flash = u < 0.12 ? 1 - u / 0.12 : 0;
      G.rubyMat.emissiveIntensity = 0.35 + warn * 1.4 + flash * 2.2;
      const k = Math.floor(time / BEAT), open = (k & 1) ? -1 : 1; // the open half closes on the next beat
      const blink = warn > 0 ? (Math.floor(time * 14) % 2 ? 3.4 : 0.5) : 0;
      G.lampL.emissiveIntensity = open < 0 ? blink : 0.15;
      G.lampR.emissiveIntensity = open > 0 ? blink : 0.15;
      if (k !== A.lastBeat) {
        A.lastBeat = k;
        if (live && game.sound && game.sound.ctx && game.onScreen(G.x, MV.H + 3, G.z, 0.35)) {
          game.sound.tone(k & 1 ? 2600 : 1950, 0.03, { type: 'square', vol: 0.06 });
          game.sound.tone(k & 1 ? 5200 : 3900, 0.012, { type: 'triangle', vol: 0.03, when: 0.004 });
        }
      }
    }
    if (A.anchor) A.anchor.grp.rotation.y = A.anchor.base + anchorAngle(time);
  },
};
