// World: Ten-Pin Drift. The far end of a bowling alley at real size, raced on toy drift coupes: glossy, freshly
// oiled maple lanes that mirror the pins, black gutters you drop into if you run wide, the pin decks with full-size
// pins towering over the cars, the dark pit and its curtain behind them. The road runs up lane 12 along its gutter,
// threads into a nearly full rack and hairpins round the fallen kingpin in front of the back row, comes back down the
// lane, crosses the gutters on a plank bridge, runs up lane 13 to the strike deck (a house ball rolls up the lane every
// so often, crosses the road twice and knocks pins into the pit while the pinsetter sweeps and re-racks), drops back
// down along lane 13's far gutter and races the long south straight over a second bridge. Spare pins stand at the
// apexes and topple when hit.
import * as THREE from '../../vendor/three.bundle.js';

// ---- track: built from straights and arcs (see the report), sampled to 49 control points
const TRACK = [
  [60.0, 105.0], [-18.0, 104.9], [-95.5, 104.6], [-110.3, 101.0], [-120.7, 90.4], [-124.2, 75.5], [-124.2, 35.1],
  [-120.9, 21.1], [-110.7, 10.3], [-101.1, -0.3], [-97.9, -14.8], [-97.8, -83.3], [-96.6, -88.7], [-93.2, -93.7],
  [-88.2, -97.0], [-82.2, -98.1], [-76.4, -96.8], [-71.4, -93.3], [-68.2, -88.2], [-67.3, -82.3], [-67.2, -33.7],
  [-67.0, 15.5], [-63.1, 30.3], [-52.1, 41.1], [-36.7, 44.9], [-1.6, 44.9], [34.1, 44.8], [47.0, 41.3], [56.4, 31.6],
  [59.5, 18.5], [59.6, -19.2], [59.7, -56.9], [61.4, -65.2], [66.4, -72.7], [73.9, -77.6], [82.8, -79.3],
  [91.6, -77.4], [99.0, -72.3], [103.8, -64.8], [105.4, -55.9], [105.4, -34.5], [108.0, -21.6], [115.3, -10.6],
  [122.3, 0.6], [124.1, 13.6], [124.1, 76.5], [120.5, 90.8], [109.9, 101.2], [95.0, 104.9],
];
const W = 16;
const PI = Math.PI, TAU = PI * 2;

// ---- the alley at real size (1 unit = 1 cm): lane 105 wide, gutters 23, capping 14 -> lane pitch 165
const LHW = 52.5, GUT = 23, CAP = 14, PITCH = 165;
const LANES = [-247.5, -82.5, 82.5, 247.5]; // lanes 11, 12, 13, 14 (west to east)
const XA = -82.5, XB = 82.5;
const ZH = -30, ROW = 26.4, SP = 15.25; // head pin, row spacing, half pin spacing (pins 30.5 apart)
const PIT = ZH - 86.8; // back edge of the pin decks
const DECK0 = ZH + 11; // front edge of the pin decks
const FOUL = 126; // foul line (approach beyond it)
const PIN_H = 38.1, PIN_R = 4.0; // collider at car height: the base of the pin (the belly overhangs the cars)
const BALL_R = 10.9;
const BOUNDS = { minX: -232, maxX: 232, minZ: PIT, maxZ: 190 };
// bridges of lane boards laid across the gutters (z of the road centre, half width)
const BRIDGES = [{ z: 44.9, hw: 10 }, { z: 104.9, hw: 10 }];
// gutters as [x0, x1, laneSide] (laneSide -1: lane on the x0 side)
const GUTTERS = [];
for (const xc of LANES) { GUTTERS.push([xc - LHW - GUT, xc - LHW, 1]); GUTTERS.push([xc + LHW, xc + LHW + GUT, -1]); }
const CAPS = [-PITCH, 0, PITCH]; // capping centres between the lanes

// the house ball rolling up lane 13: one roll every P seconds. Pure functions of time.
const BALL = { P: 17, ph: 2.4, z0: 152, v1: 46, v2: 30, hookZ: 10, hookX: 20, hookL: 142 };
BALL.zc1 = ZH + 17; // touches the head pin
BALL.tA = (BALL.z0 - BALL.zc1) / BALL.v1;
BALL.zc2 = ZH - 3 * ROW + 7.5; // touches pins 8 and 9
BALL.t2 = BALL.tA + (BALL.zc1 - BALL.zc2) / BALL.v2;
BALL.tPit = BALL.tA + (BALL.zc1 - PIT) / BALL.v2;
BALL.sweep = BALL.tPit + 0.5; // sweep bar comes down
BALL.reset = BALL.tPit + 3.6; // fresh pins come down
BALL.done = BALL.reset + 1.1;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ballU = (t) => ((((t + BALL.ph) % BALL.P) + BALL.P) % BALL.P);
function ballPose(t) {
  const u = ballU(t);
  const d = u < BALL.tA ? BALL.v1 * u : BALL.v1 * BALL.tA + BALL.v2 * (u - BALL.tA);
  const z = BALL.z0 - d;
  const x = z > BALL.hookZ ? XB - BALL.hookX * ((z - BALL.hookZ) / BALL.hookL) ** 2 : XB;
  let y = BALL_R, vis = u < BALL.tPit + 0.5;
  if (u > BALL.tPit) y = BALL_R - 0.5 * 260 * (u - BALL.tPit) ** 2;
  return { u, x, y, z, d, vis, live: u < BALL.tPit - 0.05 };
}
// pin spots of a rack (pins 1..10 -> index 0..9)
const spots = (xc) => [
  [xc, ZH], [xc - SP, ZH - ROW], [xc + SP, ZH - ROW], [xc - 2 * SP, ZH - 2 * ROW], [xc, ZH - 2 * ROW], [xc + 2 * SP, ZH - 2 * ROW],
  [xc - 3 * SP, ZH - 3 * ROW], [xc - SP, ZH - 3 * ROW], [xc + SP, ZH - 3 * ROW], [xc + 3 * SP, ZH - 3 * ROW],
];
// the three pins of the strike deck that the ball knocks over: index, knock time, flight
const KNOCK = [
  { k: 0, at: () => BALL.tA, vx: 3, vy: 40, vz: -72, g: 70, spin: 8.5 },
  { k: 7, at: () => BALL.t2, vx: -14, vy: 16, vz: -46, g: 120, spin: 11 },
  { k: 8, at: () => BALL.t2 + 0.05, vx: 15, vy: 18, vz: -44, g: 120, spin: -10 },
];
function knockedPin(i, t) { // pose of strike-deck pin i at time t: {x, y, z, rx, rz, vis, standing}
  const K = KNOCK[i], [hx, hz] = spots(XB)[K.k], u = ballU(t), t0 = K.at();
  if (u < t0) return { x: hx, y: 0, z: hz, rx: 0, rz: 0, vis: true, standing: true };
  if (u >= BALL.reset) { // fresh pin lowered by the pinsetter
    const f = ss(BALL.reset, BALL.done, u);
    return { x: hx, y: (1 - f) * 34, z: hz, rx: 0, rz: 0, vis: true, standing: u >= BALL.done };
  }
  const dt = u - t0;
  let y = K.vy * dt - 0.5 * K.g * dt * dt;
  const z = hz + K.vz * dt, x = hx + K.vx * dt;
  if (y < 0 && z > PIT + 2) y = 0; // landed on the deck: slides on towards the pit
  const tumble = Math.min(dt * K.spin, K.spin > 0 ? 40 : -40);
  return { x, y, z, rx: tumble, rz: K.vx * 0.02 * dt, vis: dt < 1.7 && y > -14, standing: false };
}
// sweep bar height (lowers behind the strike deck's apex after the ball has gone into the pit)
function sweepY(t) {
  const u = ballU(t), a = BALL.sweep;
  return 58 - 50 * ss(a, a + 0.8, u) + 50 * ss(a + 2.0, a + 2.8, u);
}

let A = null; // runtime state for tick / animate

export default {
  id: 'bowling',
  name: 'Ten-Pin Drift',
  blurb: 'Slide down mirror-oiled lanes, hairpin round towering pins, dodge the gutter.',
  vehicle: 'drifter',
  seed: 33,
  track: { points: TRACK, width: W, startS: 22 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -4.6, // bottom of the gutters (and the pit floor)
  offCourse: 16,
  skidColor: 0x1b1612,
  clackOnBump: true,
  dust: {
    normal: null,
    slick: { color: 0xd9a441, size: 0.55, life: 0.45, up: 3, grav: 26, alpha: 0.85, grow: 1, rate: 1.8 },
  },
  lighting: {
    sunDir: [0.22, 1, 0.62], sunColor: 0xffe2c4, sunIntensity: 0.9,
    hemiSky: 0x463c66, hemiGround: 0x1c1410, hemiIntensity: 0.28,
    envIntensity: 0.3, exposure: 1.14, background: 0x050407, shadowRadius: 2.4,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const lowQ = K.quality && K.quality.tilt === false;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { push: [], lastU: null, rumbleT: 0 };

    // ============================================================ helpers
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const prep = (geo, c, M) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (M) g.applyMatrix4(M);
      _c.set(c);
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      g.clearGroups();
      return g;
    };
    // parts merged per material (and per 160-unit cell so the far ones are culled)
    const bins = new Map();
    const put = (geo, c, o = {}, mat, cast = true) => {
      const g = prep(geo, c, mtx(o));
      const x = o.x ?? 0, z = o.z ?? 0;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 400) / 160) + ':' + Math.floor((z + 400) / 160);
      if (!bins.has(key)) bins.set(key, { mat, cast, parts: [] });
      bins.get(key).parts.push(g);
    };
    const flushBins = () => {
      for (const { mat, cast, parts } of bins.values()) {
        const g = BU.mergeGeometries(parts, false);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
        K.group.add(m);
      }
      bins.clear();
    };
    const canvas = (w, h, draw) => { const c = TX.makeCanvas(w, h); draw(c.getContext('2d'), w, h); return c; };
    const tex = (c, rep = [1, 1], wrap = true, srgb = true) => TX.toTexture(c, { repeat: rep, wrap, srgb });
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, rad = 0.3, seg = 2) => new K.RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2.01, h / 2.01, d / 2.01));
    const cyl = (r1, r2, h, seg = 12, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 16, hs = 12) => new T.SphereGeometry(rad, ws, hs);
    const sAt = (x, z) => track.distTo(x, z).s;
    const dRoad = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; };
    const onBridge = (x, z) => Math.abs(x) < 34 && BRIDGES.some((b) => Math.abs(z - b.z) < b.hw + 0.5);
    // contact shadows: one instanced mesh, opacity in the instance's y scale
    const contactMat = new T.MeshBasicMaterial({ color: 0x020103, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.07) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    // flat quad strip in world space (for lanes, decks, approach): uv/colour from callbacks
    const flatQuad = (x0, x1, z0, z1, y, nz, uvf, colf) => {
      const pos = [], uv = [], col = [], idx = [];
      for (let j = 0; j <= nz; j++) {
        const z = lerp(z0, z1, j / nz);
        for (const x of [x0, x1]) {
          pos.push(x, y, z); uv.push(...uvf(x, z));
          _c.set(colf ? colf(x, z) : 0xffffff); col.push(_c.r, _c.g, _c.b);
        }
        if (j < nz) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      return g;
    };
    // partial ribbon along the track between s0 and s1 at lateral offset `off`
    const strip = (s0, s1, off, wid, y = 0.06, step = 1, vScale = 10) => {
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s);
        for (let k = 0; k < 2; k++) {
          const o = off + (k - 0.5) * wid, x = p.x + p.nx * o, z = p.z + p.nz * o;
          pos.push(x, y + (onBridge(x, z) ? 0.26 : 0), z); uv.push(k, s / vScale);
        }
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      return g;
    };
    const noise = TX.noiseField(256, { seed: 33, period: 8, oct: 4 });
    const grain = TX.noiseField(256, { seed: 71, period: 4, oct: 4, sx: 12, sy: 0.5 });
    const nAt = (f, x, y) => f[(((y | 0) % 256 + 256) % 256) * 256 + (((x | 0) % 256 + 256) % 256)];

    // ============================================================ environment for the glossy surfaces
    // an equirectangular "alley" around the lanes: warm deck lights and neon strips up the lanes (north),
    // dim ceiling panels elsewhere. Reflected by the lacquer, the pins and the ball.
    const envC = canvas(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#0c0a14'); gr.addColorStop(0.42, '#1b1426'); gr.addColorStop(0.5, '#2a1d2c'); gr.addColorStop(0.56, '#0d0a0c'); gr.addColorStop(1, '#050405');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const ey = (deg) => (0.5 - deg / 180) * h; // elevation -> canvas row
      const ax = (u) => u * w;
      // ceiling panels all round
      for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(255,236,210,0.16)'; g.fillRect(ax(i / 16 + 0.01), ey(78), w / 26, 10); }
      // north (u = 0.25): the deck lights, a wide warm band, and neon above the pinsetters
      const nG = g.createRadialGradient(ax(0.25), ey(58), 4, ax(0.25), ey(58), 190);
      nG.addColorStop(0, 'rgba(255,240,214,0.85)'); nG.addColorStop(0.4, 'rgba(255,214,170,0.28)'); nG.addColorStop(1, 'rgba(255,200,160,0)');
      g.fillStyle = nG; g.fillRect(0, 0, w, h);
      for (let i = -3; i <= 3; i++) {
        g.fillStyle = 'rgba(255,246,228,0.95)'; g.fillRect(ax(0.25 + i * 0.045) - 22, ey(56) - 6, 44, 12);
      }
      g.fillStyle = 'rgba(255,60,170,0.95)'; g.fillRect(ax(0.08), ey(40) - 3, ax(0.34), 6);
      g.fillStyle = 'rgba(40,230,255,0.9)'; g.fillRect(ax(0.1), ey(33) - 2, ax(0.3), 4);
      g.fillStyle = 'rgba(255,60,170,0.6)'; g.fillRect(ax(0.18), ey(68) - 2, ax(0.14), 4);
      // a few dim signs south/east/west
      g.fillStyle = 'rgba(40,230,255,0.45)'; g.fillRect(ax(0.62), ey(30), ax(0.08), 5);
      g.fillStyle = 'rgba(255,170,60,0.4)'; g.fillRect(ax(0.82), ey(26), ax(0.06), 6);
    });
    const envTex = tex(envC, [1, 1], false);
    envTex.mapping = T.EquirectangularReflectionMapping;

    // ============================================================ lane maple (13 boards across a 35-unit tile)
    const BOARD = (2 * LHW) / 39;
    const laneC = TX.paint(1024, 512, (x, y, u, v, o) => {
      const bu = u * 13, b = Math.floor(bu), f = bu - b;
      const bv = Math.sin(b * 12.9898 + 4.1) * 43758.5453, bh = bv - Math.floor(bv);
      const gr = nAt(grain, x / 4 + b * 37, y / 2);
      const fine = nAt(noise, x / 2 + b * 11, y);
      let k = 0.93 + bh * 0.09 + (gr - 0.5) * 0.12 + (fine - 0.5) * 0.03;
      const seam = f < 0.025 || f > 0.99 ? 0.8 : f < 0.05 || f > 0.97 ? 0.95 : 1;
      k *= seam;
      o[0] = clamp(255 * k * 1.02, 0, 255); o[1] = clamp(208 * k, 0, 255); o[2] = clamp(142 * k * (0.96 + bh * 0.08), 0, 255);
    });
    const laneTex = tex(laneC);
    const laneNC = TX.paint(256, 64, (x, y, u, v, o) => {
      const f = (u * 13) % 1; const d = f < 0.04 ? -1 : f > 0.97 ? 1 : 0;
      o[0] = 128 + d * 60; o[1] = 128; o[2] = 255;
    });
    const laneN = tex(laneNC, [1, 1], true, false);
    const laneMat = K.phys({
      map: laneTex, vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.16,
      clearcoatNormalMap: laneN, clearcoatNormalScale: V2(0.35), envMap: envTex, envMapIntensity: 1.1,
      transparent: true, opacity: 0.7, depthWrite: true,
    });
    // lanes: from the pin decks to the foul line, darker towards the bowlers (south)
    const laneShade = (x, z) => { const k = 1.08 - 0.55 * ss(-30, 140, z); _c.setRGB(k, k * 0.985, k * 0.96); return _c.getHex(); };
    const laneGeos = [];
    for (const xc of LANES) {
      laneGeos.push(flatQuad(xc - LHW, xc + LHW, DECK0, FOUL, 0, 24, (x, z) => [(x - (xc - LHW)) / 35, -z / 35], laneShade));
    }
    const lanes = new T.Mesh(BU.mergeGeometries(laneGeos), laneMat);
    lanes.receiveShadow = true; lanes.renderOrder = -2;
    K.group.add(lanes);

    // pin decks: the same maple, a little paler, with the ten pin spots
    const deckC = canvas(512, 512, (g, w, h) => {
      const img = TX.paint(512, 512, (x, y, u, v, o) => {
        const bu = u * 39, b = Math.floor(bu), f = bu - b;
        const bv = Math.sin(b * 7.31 + 1.7) * 43758.5453, bh = bv - Math.floor(bv);
        const gr = nAt(grain, x / 2 + b * 37, y);
        let k = 0.9 + bh * 0.07 + (gr - 0.5) * 0.1;
        if (f < 0.07 || f > 0.95) k *= 0.88;
        o[0] = clamp(250 * k, 0, 255); o[1] = clamp(212 * k, 0, 255); o[2] = clamp(158 * k, 0, 255);
      });
      g.drawImage(img, 0, 0);
      // spots: v = 0 at the front edge (DECK0), 1 at the pit
      const L = DECK0 - PIT;
      for (const [sx, sz] of spots(0)) {
        const px = ((sx + LHW) / (2 * LHW)) * w, py = ((DECK0 - sz) / L) * h;
        g.fillStyle = 'rgba(92,30,24,0.9)'; g.beginPath(); g.ellipse(px, py, 14, 14 * (w / h) * (L / (2 * LHW)), 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(160,70,52,0.85)'; g.beginPath(); g.ellipse(px, py, 9, 9 * (L / (2 * LHW)), 0, 0, TAU); g.fill();
      }
      // the deck's front seam and the tail plank at the back
      g.fillStyle = 'rgba(70,40,20,0.8)'; g.fillRect(0, 0, w, 3);
      g.fillStyle = 'rgba(40,22,12,0.9)'; g.fillRect(0, h - 10, w, 10);
    });
    const deckMat = K.phys({
      map: tex(deckC, [1, 1], false), vertexColors: true, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12,
      envMap: envTex, envMapIntensity: 0.7, transparent: true, opacity: 0.74,
    });
    const deckGeos = [];
    for (const xc of LANES) deckGeos.push(flatQuad(xc - LHW, xc + LHW, PIT, DECK0, 0, 4, (x, z) => [(x - (xc - LHW)) / (2 * LHW), (z - PIT) / (DECK0 - PIT)], () => 0xffffff));
    const decks = new T.Mesh(BU.mergeGeometries(deckGeos), deckMat);
    decks.receiveShadow = true; decks.renderOrder = -2;
    K.group.add(decks);

    // approach beyond the foul line: lighter, matte pine
    const apprMat = K.std({ map: laneTex, color: 0xf2e6d2, roughness: 0.55, envMap: envTex, envMapIntensity: 0.2 });
    {
      const m = new T.Mesh(flatQuad(-420, 420, FOUL + 0.6, BOUNDS.maxZ + 60, 0, 2, (x, z) => [x / 35, -z / 35], () => 0x8a7c6a), apprMat);
      m.receiveShadow = true; K.group.add(m);
    }

    // ============================================================ gutters (rounded black channels) and cappings
    const gutC = TX.paint(64, 512, (x, y, u, v, o) => {
      const n = nAt(grain, x * 3, y / 2), k = 52 + (n - 0.5) * 18 + (Math.abs(u - 0.5) < 0.04 ? 8 : 0);
      o[0] = k; o[1] = k; o[2] = k * 1.1;
    });
    const gutMat = K.phys({ map: tex(gutC, [1, 1]), roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.18, envMap: envTex, envMapIntensity: 0.7 });
    {
      const R = (GUT / 2) ** 2 / (2 * 4.8) + 4.8 / 2, cy = R - 4.8; // circle through the lips, 4.8 deep
      const gs = [];
      for (const [g0] of GUTTERS) {
        const nx = 14, pos = [], uv = [], idx = [];
        const z0 = PIT - 2, z1 = FOUL;
        for (let j = 0; j <= 1; j++) {
          const z = j ? z1 : z0;
          for (let i = 0; i <= nx; i++) {
            const lx = (i / nx) * GUT, y = cy - Math.sqrt(R * R - (lx - GUT / 2) ** 2);
            pos.push(g0 + lx, y, z); uv.push(i / nx, -z / 40);
          }
        }
        for (let i = 0; i < nx; i++) { const a = i, b = i + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        gs.push(g);
      }
      const m = new T.Mesh(BU.mergeGeometries(gs), gutMat); m.receiveShadow = true; K.group.add(m);
    }
    // cappings: glossy black laminate, a row of LED studs along each (they chase red when a ball comes)
    const capMat = K.phys({ color: 0x121116, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMap: envTex, envMapIntensity: 0.9 });
    const capLen = FOUL - PIT + 16;
    for (const cx of CAPS) put(rbox(CAP, 7, capLen, 0.6, 2), 0xffffff, { x: cx, y: -3.25, z: (FOUL + PIT - 16) / 2 }, capMat, false);
    // the lane edges: a thin dark lip where the maple meets the gutter
    const lipMat = K.std({ color: 0x2a1e16, roughness: 0.5 });
    for (const xc of LANES) for (const sd of [-1, 1]) put(box(0.5, 0.5, FOUL - PIT), 0xffffff, { x: xc + sd * (LHW + 0.15), y: -0.22, z: (FOUL + PIT) / 2 }, lipMat, false);

    // LED studs (instanced; colours set in animate). Lane 13 also has flush warning lights either side of the
    // ball's line where it crosses the road (they flash amber while a ball is coming)
    const ledList = [];
    for (const zc of [104.9, -79.3]) {
      const zz = zc;
      const bx = zz > 0 ? XB - BALL.hookX * ((zz - BALL.hookZ) / BALL.hookL) ** 2 : XB;
      const p0 = track.place(track.distTo(bx, zz).s, 0);
      for (const sd of [-1, 1]) for (let k = -2; k <= 2; k++) {
        const q = { x: p0.x + Math.cos(p0.angle) * sd * (BALL_R + 3.5) + p0.nx * k * 3.2, z: p0.z + Math.sin(p0.angle) * sd * (BALL_R + 3.5) + p0.nz * k * 3.2 };
        ledList.push({ x: q.x, y: 0.12, z: q.z, cap: zz > 0 ? 'xs' : 'xa' });
      }
    }
    for (const cx of CAPS) for (let z = FOUL - 4; z > PIT + 6; z -= 7) if (!onBridge(cx, z)) ledList.push({ x: cx, y: 0.32, z, cap: cx });
    const ledMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const leds = K.instances(cyl(0.75, 0.75, 0.2, 14), ledMat, ledList.map((l) => ({ ...l, color: 0x0a7f99 })), { cast: false, receive: false, colors: true });
    A.leds = leds; A.ledList = ledList;
    {
      const hc = canvas(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const haloMat = new T.MeshBasicMaterial({ map: tex(hc, [1, 1], false), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      A.halos = K.instances(new T.PlaneGeometry(6, 6).rotateX(-PI / 2), haloMat, ledList.map((l) => ({ x: l.x, y: 0.45, z: l.z, color: 0x0a7f99 })), { cast: false, receive: false, colors: true });
      A.halos.renderOrder = 4;
    }

    // ============================================================ the pit and its curtain
    {
      const pitMat = K.std({ color: 0x09080b, roughness: 0.9 });
      const beltC = TX.paint(64, 256, (x, y, u, v, o) => { const k = (Math.floor(v * 48) % 2 ? 18 : 10) + nAt(noise, x, y) * 8; o[0] = k; o[1] = k; o[2] = k + 2; });
      const beltMat = K.std({ map: tex(beltC, [30, 1]), roughness: 0.85 });
      const pw = BOUNDS.maxX - BOUNDS.minX + 260;
      put(box(pw, 0.4, 16), 0xffffff, { x: 0, y: -5.4, z: PIT - 8 }, beltMat, false);
      // the face of the deck's tail plank dropping into the pit
      put(box(pw, 5.4, 0.6), 0xffffff, { x: 0, y: -2.7, z: PIT - 0.3 }, pitMat, false);
      put(box(pw, 0.5, 1.2), 0x3a2414, { x: 0, y: -0.24, z: PIT + 0.5 }, lipMat, false);
      // pit curtain: heavy black rubberised cloth hanging in folds
      const cw = pw, nx = 220, cg = new T.PlaneGeometry(cw, 64, nx, 1);
      const p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 0.55) * 0.9 + Math.sin(x * 0.13) * 0.6); }
      cg.computeVertexNormals();
      const curtMat = K.std({ color: 0x0d0c10, roughness: 0.82, side: T.DoubleSide, envMap: envTex, envMapIntensity: 0.25 });
      const curt = K.mesh(cg, curtMat, 0, 26, PIT - 15, { cast: false });
      curt.receiveShadow = true;
      // a strip of the pinsetter frame above the curtain
      put(box(pw, 6, 4), 0xffffff, { x: 0, y: 60, z: PIT - 13 }, K.metal(0x3a3c44, 0.4), false);
    }

    // ============================================================ kickbacks between the decks: tall panels with neon lane numbers
    {
      const kbC = canvas(256, 512, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1d1640'); gr.addColorStop(1, '#0d0a1e');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 9; i++) {
          g.strokeStyle = i % 3 === 0 ? 'rgba(255,70,180,0.55)' : i % 3 === 1 ? 'rgba(60,220,255,0.5)' : 'rgba(255,214,90,0.35)';
          g.lineWidth = 5; g.beginPath(); g.moveTo(-20, 60 + i * 52); g.bezierCurveTo(80, 20 + i * 52, 160, 120 + i * 52, w + 20, 70 + i * 52); g.stroke();
        }
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.4})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 0, TAU); g.fill(); }
      });
      const kbMat = K.std({ map: tex(kbC, [1, 1], false), roughness: 0.5, envMap: envTex, envMapIntensity: 0.3 });
      const kbTop = K.std({ color: 0x15121c, roughness: 0.45 });
      const z0 = ZH + 4, z1 = PIT - 14, kl = z0 - z1, kh = 44;
      for (const cx of CAPS) {
        const g = box(12, kh, kl);
        put(g, 0xffffff, { x: cx, y: kh / 2, z: (z0 + z1) / 2 }, kbMat, true);
        put(box(12.6, 1.2, kl + 0.6), 0xffffff, { x: cx, y: kh + 0.6, z: (z0 + z1) / 2 }, kbTop, true);
        K.box(cx, (z0 + z1) / 2, 6, kl / 2, 0, kh);
        AO(cx, z0 - 2, 9, 5, 0.5);
      }
      // neon numbers on the front of each kickback (two numbers: the lanes either side)
      const numC = canvas(512, 256, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        g.font = '700 150px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const nums = [['11', '12'], ['12', '13'], ['13', '14']];
        // a strip of three plates; each plate gets a quarter of the canvas per number
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const cx = (i * 2 + j + 0.5) * (w / 6);
          g.shadowColor = j ? '#ff3fb0' : '#3fe6ff'; g.shadowBlur = 18;
          g.strokeStyle = j ? '#ff8ad0' : '#a8f4ff'; g.lineWidth = 7;
          g.font = '700 70px Rubik, sans-serif'; g.strokeText(nums[i][j], cx, h / 2);
          g.shadowBlur = 0; g.fillStyle = '#fff'; g.font = '700 70px Rubik, sans-serif'; g.globalAlpha = 0.35; g.fillText(nums[i][j], cx, h / 2); g.globalAlpha = 1;
        }
      });
      const numTex = tex(numC, [1, 1], false);
      const numMat = new T.MeshBasicMaterial({ map: numTex, toneMapped: false });
      CAPS.forEach((cx, i) => {
        const pg = new T.PlaneGeometry(11.4, 9);
        const uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 3);
        K.mesh(pg, numMat, cx, 34, z0 + 0.05, { cast: false });
      });
      A.numMat = numMat;
    }

    // ============================================================ bridges: lane boards laid across the gutters
    const plankC = TX.paint(512, 64, (x, y, u, v, o) => {
      const gr = nAt(grain, y * 2, x / 3), k = 0.92 + (gr - 0.5) * 0.14 + (v < 0.06 || v > 0.94 ? -0.18 : 0);
      o[0] = clamp(240 * k, 0, 255); o[1] = clamp(206 * k, 0, 255); o[2] = clamp(150 * k, 0, 255);
    });
    const plankMat = K.phys({ map: tex(plankC, [1, 1], false), roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.12, envMap: envTex, envMapIntensity: 0.5 });
    for (const b of BRIDGES) {
      const n = 5, pw = (2 * b.hw) / n;
      for (let i = 0; i < n; i++) {
        const z = b.z - b.hw + pw * (i + 0.5);
        put(rbox(68 + r.range(-0.8, 0.8), 0.26, pw - 0.18, 0.08, 1), 0xffffff, { x: r.range(-0.4, 0.4), y: 0.13, z, ry: r.range(-0.004, 0.004) }, plankMat, true);
      }
      // cleats underneath, resting on the capping
      put(box(10, 3.5, 2 * b.hw - 1), 0x5a4128, { x: 0, y: -1.6, z: b.z }, lipMat, false);
    }

    // ============================================================ physics: gutters are holes (except under the bridges)
    for (const [g0, g1, side] of GUTTERS) {
      const inL = side > 0 ? 0.8 : 0.4, inR = side > 0 ? 0.4 : 0.8; // the lane side: a car more than half over the lip drops in
      const x0 = g0 + inL, x1 = g1 - inR, hw = (x1 - x0) / 2, cx = (x0 + x1) / 2;
      // only gutters a car can reach
      if (Math.abs(cx) > 175) continue;
      let spans = [[PIT - 4, FOUL + 20]];
      if (Math.abs(cx) < 40) {
        for (const b of BRIDGES) {
          const out = [];
          for (const [a, c] of spans) {
            if (c <= b.z - b.hw || a >= b.z + b.hw) { out.push([a, c]); continue; }
            if (a < b.z - b.hw) out.push([a, b.z - b.hw]);
            if (c > b.z + b.hw) out.push([b.z + b.hw, c]);
          }
          spans = out;
        }
      }
      for (const [a, c] of spans) {
        const n = Math.ceil((c - a) / 10);
        for (let k = 0; k < n; k++) { const za = a + ((c - a) * k) / n, zb = a + ((c - a) * (k + 1)) / n; K.trapdoor(cx, (za + zb) / 2, hw, (zb - za) / 2, 0, true); }
      }
    }

    // ============================================================ pins
    // real profile (cm): radius at height, two red neck stripes
    const PROF = [[0.01, 0], [2.3, 0.02], [2.6, 0.25], [3.25, 0.9], [3.6, 1.9], [4.35, 3.6], [4.96, 5.7], [5.45, 7.2], [5.73, 8.6], [5.95, 10], [6.05, 11.4],
      [5.97, 13], [5.73, 14.9], [5.25, 16.6], [4.6, 18.4], [3.85, 20.1], [3.06, 21.9], [2.62, 23.2], [2.43, 23.8], [2.3, 24.8], [2.28, 25.4], [2.3, 26.2],
      [2.37, 27.6], [2.6, 28.7], [2.81, 29.8], [3.05, 30.9], [3.21, 31.8], [3.2, 32.8], [3.06, 34.3], [2.62, 35.8], [2.1, 36.8], [1.3, 37.7], [0.01, 38.1]];
    const STRIPES = [[22.4, 23.9], [25.0, 26.5]];
    const pinProfile = (() => {
      const out = [];
      const rAt = (y) => { for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][1]) { const a = PROF[i - 1], b = PROF[i]; return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])); } return 0.01; };
      const cuts = new Set(); for (const [a, b] of STRIPES) { cuts.add(a); cuts.add(b); }
      for (const p of PROF) out.push({ r: p[0], y: p[1] });
      for (const c of cuts) { out.push({ r: rAt(c - 0.01), y: c - 0.01 }); out.push({ r: rAt(c + 0.01), y: c + 0.01 }); }
      out.sort((a, b) => a.y - b.y);
      return out;
    })();
    const makePinGeo = (segs, fade) => {
      const g = new T.LatheGeometry(pinProfile.map((p) => new T.Vector2(p.r, p.y)), segs);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      const white = new T.Color(0xf6f4ee), red = new T.Color(0xc0161f), c = new T.Color();
      for (let i = 0; i < n; i++) {
        const y = g.attributes.position.getY(i);
        const st = STRIPES.some(([a, b]) => y > a && y < b);
        c.copy(st ? red : white);
        if (fade) c.multiplyScalar(0.82 * (1 - 0.82 * Math.pow(y / PIN_H, 0.75)));
        else if (y < 0.4) c.multiplyScalar(0.8);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      return g;
    };
    const pinGeo = makePinGeo(lowQ ? 14 : 20, false);
    const pinMirGeo = makePinGeo(12, true);
    const scuffC = TX.paint(128, 256, (x, y, u, v, o) => {
      const n = nAt(noise, x * 2, y), m = nAt(grain, x * 4, y * 2);
      const belly = Math.exp(-(((v - 0.68) / 0.09) ** 2));
      const k = 255 - belly * Math.max(0, n - 0.45) * 160 - (m > 0.82 ? 30 : 0);
      o[0] = k; o[1] = k; o[2] = k;
    });
    const pinMat = K.phys({ vertexColors: true, map: tex(scuffC), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMap: envTex, envMapIntensity: 0.9 });
    const mirMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
    const FLIP = new T.Matrix4().makeScale(1, -1, 1);
    // a mesh of pins plus its reflection under the lacquer
    const pinSet = (list) => {
      const im = K.instances(pinGeo, pinMat, list, { cast: true });
      const mm = new T.InstancedMesh(pinMirGeo, mirMat, list.length);
      const M = new T.Matrix4();
      for (let i = 0; i < list.length; i++) { im.getMatrixAt(i, M); mm.setMatrixAt(i, FLIP.clone().multiply(M)); }
      mm.instanceMatrix.needsUpdate = true; mm.computeBoundingSphere(); mm.renderOrder = -3;
      K.group.add(mm);
      return { im, mm };
    };
    const standing = (xc, ks) => ks.map((k) => { const [x, z] = spots(xc)[k - 1]; return { x, y: 0, z, ry: r() * TAU, color: 0xffffff }; });
    // lane 12 (A): the "pin forest" - 2, 3 and the kingpin are down; the road threads in between the pins and
    // hairpins in front of the back row (nothing stands south of the apex, so it is never hidden)
    const AK = [1, 4, 6, 7, 8, 9, 10];
    pinSet(standing(XA, AK));
    for (const k of AK) { const [x, z] = spots(XA)[k - 1]; K.circle(x, z, PIN_R, PIN_H); AO(x, z, 6.5, 6.5, 0.55); }
    // lane 13 (B): the strike deck. 4, 6, 7, 10 stay up; 1, 8, 9 are knocked by the ball and re-racked
    const BK = [4, 6, 7, 10];
    pinSet(standing(XB, BK));
    for (const k of BK) { const [x, z] = spots(XB)[k - 1]; K.circle(x, z, PIN_R, PIN_H); AO(x, z, 6.5, 6.5, 0.55); }
    // lane 14 (C): a full rack; lane 11 (Z): the 7-10 split
    pinSet(standing(LANES[3], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    pinSet(standing(LANES[0], [7, 10]));
    for (const [x, z] of spots(LANES[3])) AO(x, z, 6.5, 6.5, 0.5);
    for (const k of [7, 10]) { const [x, z] = spots(LANES[0])[k - 1]; AO(x, z, 6.5, 6.5, 0.5); }

    // the strike deck's three moving pins (instanced, matrices set in animate) and their colliders
    {
      const list = KNOCK.map((kn) => { const [x, z] = spots(XB)[kn.k]; return { x, y: 0, z }; });
      const set = pinSet(list);
      set.im.frustumCulled = false; set.mm.frustumCulled = false;
      A.kPins = set;
      KNOCK.forEach((kn, i) => {
        const [x, z] = spots(XB)[kn.k];
        K.mover({ type: 'circle', r: PIN_R, h: PIN_H }, (t) => ({ x, z, angle: 0, h: knockedPin(i, t).standing ? PIN_H : 0 }));
        A.kAO = A.kAO || [];
        A.kAO.push(K.contact(x, z, 6.5, 6.5, 0.5));
      });
    }

    // deadwood: knocked-down pins lying on their sides (static barriers) and in the gutters
    {
      const lying = [];
      const lie = (x, z, ang, collide = true, y = 7.6, tilt = -0.14) => {
        // ang: direction the head points (physics angle); the pin's axis is local +y -> rotate to horizontal
        const c = Math.cos(ang), s = Math.sin(ang);
        lying.push({ x: x - c * PIN_H / 2, y, z: z - s * PIN_H / 2, rx: 0, ry: -ang, rz: -PI / 2 + tilt, order: 'YXZ' });
        if (collide) K.capsule(x - c * 15, z - s * 15, x + c * 13, z + s * 13, 4.6, 11);
        AO(x, z, 19, 6.5, 0.45, ang);
      };
      // between lane 12's two legs at the deck front (keeps the two legs apart) and the kingpin inside the hairpin
      lie(-82.5, 3.5, PI / 2 - 0.03);
      lying.push({ x: XA + 0.4, y: 7.6, z: -47.5, rx: 0, ry: PI / 2 + 0.01, rz: -PI / 2 - 0.14, order: 'YXZ' });
      K.capsule(XA, -50, XA, -83.5, 4.6, 11);
      AO(XA, -66, 6.5, 19, 0.45);
      // in the gutters
      lie(XA + LHW + GUT / 2, -62, -PI / 2 + 0.06, false, 2.6, -0.12);
      lie(XB - LHW - GUT / 2, -48, -PI / 2 - 0.05, false, 2.6, -0.12);
      lie(XB + LHW + GUT / 2, -70, PI / 2 + 0.04, false, 2.6, -0.12);
      lie(XA - LHW - GUT / 2, -95, -PI / 2, false, 2.6, -0.12);
      lie(LANES[3] - LHW - GUT / 2, 10, -PI / 2 + 0.05, false, 2.6, -0.12);
      const im = K.instances(pinGeo, pinMat, lying, { cast: true });
      const mm = new T.InstancedMesh(pinMirGeo, mirMat, lying.length);
      const M = new T.Matrix4();
      for (let i = 0; i < lying.length; i++) { im.getMatrixAt(i, M); mm.setMatrixAt(i, FLIP.clone().multiply(M)); }
      mm.instanceMatrix.needsUpdate = true; mm.computeBoundingSphere(); mm.renderOrder = -3; K.group.add(mm);
    }

    // spare pins standing at the apexes: pushable, they topple when a car hits them and the pinsetter puts them back
    {
      const corners = [
        { x: -95.5, z: 76, side: 1 }, { x: -37.25, z: 15, side: -1 }, { x: 33.6, z: 19, side: -1 }, { x: 95.5, z: 76, side: 1 },
      ];
      for (const c of corners) {
        // the arc's middle: nearest track point to the corner centre, then towards the inside
        const n = track.distTo(c.x, c.z), s = n.s;
        const q = track.place(s, c.side * (W / 2 + 2.2 + PIN_R));
        const wrap = new T.Group(); wrap.position.set(q.x, 0, q.z);
        const tilt = new T.Group(); wrap.add(tilt);
        const pm = new T.Mesh(pinGeo, pinMat); pm.castShadow = true; pm.receiveShadow = true; tilt.add(pm);
        const mir = new T.Group(); mir.scale.y = -1; wrap.add(mir);
        const tiltM = new T.Group(); mir.add(tiltM);
        const mm = new T.Mesh(pinMirGeo, mirMat); mm.renderOrder = -3; tiltM.add(mm);
        K.group.add(wrap);
        const d = K.physics.addDynamic({ x: q.x, z: q.z, r: PIN_R, m: 0.4, h: PIN_H, mesh: wrap, slide: true, spin: 0, friction: 30, baseY: 0, respawn: 7 });
        A.push.push({ d, tilt, tiltM, knock: null, dir: 0, still: 0, prev: 'live', ao: K.contact(q.x, q.z, 6, 6, 0.45) });
      }
    }

    // ============================================================ the house ball
    {
      const bc = canvas(1024, 512, (g, w, h) => {
        g.fillStyle = '#3b0a4a'; g.fillRect(0, 0, w, h);
        // marbled urethane swirls
        for (let i = 0; i < 260; i++) {
          const y = Math.random() * h, x = Math.random() * w, len = 60 + Math.random() * 220;
          const cols = ['rgba(232,48,150,0.35)', 'rgba(120,30,200,0.35)', 'rgba(20,6,30,0.5)', 'rgba(255,140,220,0.22)', 'rgba(70,200,255,0.18)'];
          g.strokeStyle = cols[i % cols.length]; g.lineWidth = 3 + Math.random() * 10;
          g.beginPath(); g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (Math.random() - 0.5) * 120, x + len * 0.7, y + (Math.random() - 0.5) * 120, x + len, y + (Math.random() - 0.5) * 60);
          g.stroke();
        }
        // finger holes and the engraved logo
        const hole = (x, y, rr) => {
          const gr = g.createRadialGradient(x, y, rr * 0.2, x, y, rr);
          gr.addColorStop(0, '#000'); gr.addColorStop(0.75, '#08020a'); gr.addColorStop(1, 'rgba(255,200,240,0.6)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * 1.35, 0, 0, TAU); g.fill();
        };
        hole(w * 0.25, h * 0.2, 16); hole(w * 0.28, h * 0.27, 16); hole(w * 0.215, h * 0.34, 19);
        g.fillStyle = 'rgba(255,220,240,0.7)'; g.font = '700 30px Rubik, sans-serif'; g.textAlign = 'center';
        g.fillText('ORBIT 14', w * 0.75, h * 0.55);
      });
      const ballTex = tex(bc, [1, 1], false);
      const ballMat = K.phys({ map: ballTex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, envMap: envTex, envMapIntensity: 1.1 });
      const ball = K.mesh(sph(BALL_R, 36, 24), ballMat, XB, BALL_R, BALL.z0);
      const mball = new T.Mesh(sph(BALL_R, 24, 16), new T.MeshBasicMaterial({ map: ballTex, color: 0x6a5a70 }));
      mball.renderOrder = -3; K.group.add(mball);
      const shadow = K.contact(XB, BALL.z0, BALL_R * 0.9, BALL_R * 0.9, 0.55);
      K.mover({ type: 'circle', r: BALL_R, h: 22 }, (t) => { const b = ballPose(t); return b.live ? { x: b.x, z: b.z, angle: 0, h: 22 } : { x: b.x, z: b.z, angle: 0, h: 0 }; });
      A.ball = ball; A.mball = mball; A.ballShadow = shadow; A.ballQ = new T.Quaternion(); A.ballLastD = null;
    }

    // ============================================================ the pinsetter's sweep bar behind the strike deck
    {
      const sw = new T.Group();
      const stC = canvas(256, 32, (g, w, h) => { g.fillStyle = '#e8b51c'; g.fillRect(0, 0, w, h); g.fillStyle = '#16120c'; for (let i = -2; i < 18; i++) { g.beginPath(); g.moveTo(i * 16, h); g.lineTo(i * 16 + 8, h); g.lineTo(i * 16 + 20, 0); g.lineTo(i * 16 + 12, 0); g.fill(); } });
      const stMat = K.std({ map: tex(stC, [6, 1]), roughness: 0.5, metalness: 0.2 });
      const steel = K.metal(0x5b5f68, 0.35);
      const bar = new T.Mesh(box(2 * LHW + 6, 3.4, 2.2), [steel, steel, steel, steel, stMat, steel]); bar.castShadow = true; sw.add(bar);
      for (const sd of [-1, 1]) { const arm = new T.Mesh(box(2, 70, 2), steel); arm.position.set(sd * (LHW + 2), 36, -0.6); arm.castShadow = true; sw.add(arm); }
      sw.position.set(XB, 58, ZH - 3 * ROW + 14.5);
      K.add(sw);
      A.sweep = sw;
    }

    // ============================================================ track markings: neon tape, kerbs, start line
    const tapeMat = K.std({ color: 0xff4fb6, emissive: 0xff2a96, emissiveIntensity: 0.45, roughness: 0.55 });
    {
      const L = track.length;
      for (const sd of [-1, 1]) K.group.add(Object.assign(new T.Mesh(strip(0, L, sd * (W / 2 - 0.6), 1.2, 0.07, 1), tapeMat), { receiveShadow: true }));
      // kerbs: striped tape on the outside of the corners (where the road turns hard)
      const kC = canvas(32, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff6f0' : '#ff3aa8'; g.fillRect(0, (i * h) / 4, w, h / 4); } });
      const kMat = K.std({ map: tex(kC, [1, 1]), emissive: 0xff2a96, emissiveMap: tex(kC, [1, 1]), emissiveIntensity: 0.25, roughness: 0.55 });
      const N = track.N, ds = track.ds;
      let i = 0;
      const curvAt = (k) => { let a = 0; for (let j = -6; j <= 6; j++) a += track.curv[(k + j + N) % N]; return a / 13; };
      const runs = [];
      let cur = null;
      for (i = 0; i < N; i++) {
        const kv = curvAt(i), on = Math.abs(kv) > 1 / 32;
        if (on && (!cur || Math.sign(kv) !== cur.sg)) { if (cur) runs.push(cur); cur = { a: i, b: i, sg: Math.sign(kv) }; } else if (on) cur.b = i; else if (cur) { runs.push(cur); cur = null; }
      }
      if (cur) runs.push(cur);
      for (const rn of runs) {
        if (rn.b - rn.a < 10) continue;
        const s0 = rn.a * ds - 2, s1 = rn.b * ds + 2, off = -rn.sg * (W / 2 + 0.45);
        const m = new T.Mesh(strip(s0, s1, off, 1.5, 0.075, 0.5, 1.6), kMat); m.receiveShadow = true; K.group.add(m);
      }
      // start/finish: a strip of checkered tape across the road
      const sC = canvas(256, 32, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#151217' : '#f7f2ea'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(22);
      const sl = K.mesh(new T.PlaneGeometry(W - 0.2, 2.6), K.std({ map: tex(sC, [1, 1], false), roughness: 0.6 }), p.x, 0.08 + (onBridge(p.x, p.z) ? 0.26 : 0), p.z, { cast: false });
      sl.rotation.order = 'YXZ'; sl.rotation.y = -p.angle + PI / 2; sl.rotation.x = -PI / 2;
      sl.receiveShadow = true;
    }

    // ============================================================ lane markings inlaid in the wood: arrows, dots, range finders, foul line
    {
      const inlay = K.std({ vertexColors: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
      const DARK = 0x3b2516, DOT = 0x6a3a1c, RED = 0x9a1d1d;
      const arrow = new T.Shape(); arrow.moveTo(0, -5.5); arrow.lineTo(1.1, 3.5); arrow.lineTo(0, 2.4); arrow.lineTo(-1.1, 3.5); arrow.closePath();
      const arrowGeo = new T.ShapeGeometry(arrow); arrowGeo.rotateX(PI / 2);
      for (const xc of LANES) {
        for (let b = 5; b <= 35; b += 5) {
          const x = xc + LHW - (b - 0.5) * BOARD, z = 62 + (Math.abs(b - 20) / 5) * 3.2;
          if (dRoad(x, z) < 1) continue;
          put(arrowGeo, DARK, { x, y: 0.03, z }, inlay, false);
        }
        for (const b of [3, 5, 8, 11, 14, 25, 28, 31, 34, 36]) {
          const x = xc + LHW - (b - 0.5) * BOARD, z = 118;
          if (dRoad(x, z) < 1) continue;
          put(new T.CircleGeometry(0.5, 12).rotateX(-PI / 2), DOT, { x, y: 0.03, z }, inlay, false);
        }
        // range finders (boards 10 and 30)
        for (const b of [10, 30]) {
          const x = xc + LHW - (b - 0.5) * BOARD;
          for (const z0 of [0, 14]) if (dRoad(x, z0) > 1) put(new T.PlaneGeometry(0.5, 9).rotateX(-PI / 2), DARK, { x, y: 0.03, z: z0 }, inlay, false);
        }
        // foul line and the approach dots
        put(new T.PlaneGeometry(2 * LHW, 1.1).rotateX(-PI / 2), DARK, { x: xc, y: 0.04, z: FOUL }, inlay, false);
        put(new T.PlaneGeometry(2 * LHW, 0.4).rotateX(-PI / 2), RED, { x: xc, y: 0.04, z: FOUL + 1.4 }, inlay, false);
        for (const b of [5, 10, 15, 20, 25, 30, 35]) put(new T.CircleGeometry(0.7, 12).rotateX(-PI / 2), DARK, { x: xc + LHW - (b - 0.5) * BOARD, y: 0.03, z: FOUL + 16 }, inlay, false);
      }
      // foul-line sensor posts on the cappings and lane-number plaques
      const plC = canvas(512, 64, (g, w, h) => {
        g.fillStyle = '#1a1a1f'; g.fillRect(0, 0, w, h);
        g.font = '700 46px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        ['11 | 12', '12 | 13', '13 | 14'].forEach((s, i) => { g.fillStyle = i === 1 ? '#ffd35a' : '#9fe9ff'; g.fillText(s, (i + 0.5) * (w / 3), h / 2 + 2); });
      });
      const plMat = K.std({ map: tex(plC, [1, 1], false), roughness: 0.4, emissive: 0xffffff, emissiveMap: tex(plC, [1, 1], false), emissiveIntensity: 0.5 });
      CAPS.forEach((cx, i) => {
        const pg = rbox(7, 0.6, 2.4, 0.25, 2);
        const uv = pg.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 3);
        K.mesh(pg, plMat, cx, 0.45, FOUL - 3);
        put(box(4, 2, 2.4), 0x232328, { x: cx, y: 1, z: FOUL + 3 }, capMat, true);
      });
    }

    // ============================================================ oil puddles (slick, off the line)
    {
      const oilMat = K.phys({ color: 0xc58a2a, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.0, transparent: true, opacity: 0.55, envMap: envTex, envMapIntensity: 1.4 });
      const spots2 = [[sAt(59.6, -5), -W / 2 + 1.4, 3.6], [sAt(-60, 104.8), -W / 2 + 1.6, 3.4]];
      for (const [s, off, rad] of spots2) {
        const q = track.place(s, off);
        const sp = K.spill(q.x, q.z, rad, oilMat, { lump: 0.35, stretch: 1.6, angle: q.angle, y: 0.1, thick: 0.08 });
        K.surface('slick', { poly: sp.poly });
        for (let i = 0; i < 3; i++) { const p2 = track.place(s + r.range(-9, 9), off + r.range(-4, -1)); if (dRoad(p2.x, p2.z) > -W) K.spill(p2.x, p2.z, r.range(0.5, 1.1), oilMat, { y: 0.08, thick: 0.05, n: 16 }); }
      }
    }

    // ============================================================ the rental shoe (landmark in lane 12's infield), its lace, scorecard and pencil
    const leather = (c, rgh = 0.5) => K.phys({ color: c, roughness: rgh, clearcoat: 0.35, clearcoatRoughness: 0.4, envMap: envTex, envMapIntensity: 0.4 });
    {
      const sx = -74, sz = 74, ang = 0.42; // shoe centre and heading (toe direction, physics angle)
      const grp = new T.Group();
      // loft along x (heel at -14.5, toe at +14.5): width and height per station, rounded-rect sections
      const st = [[-14.5, 6.4, 8.6], [-13.4, 7.8, 9.6], [-11, 8.6, 9.6], [-7, 8.8, 8.4], [-3, 9.2, 7.6], [1, 10, 6.9], [5, 10.4, 6.2], [9, 10.2, 5.2], [12, 9.0, 4.3], [13.9, 6.9, 3.4], [14.6, 4.4, 2.6]];
      const sections = 24, pos = [], col = [], idx = [];
      const red = new T.Color(0xa8232b), cream = new T.Color(0xe7dcc4), navy = new T.Color(0x1f2a4a), c = new T.Color();
      st.forEach(([x, w, h], i) => {
        for (let j = 0; j <= sections; j++) {
          const a = (j / sections) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          const ex = 2.6; // superellipse
          const yy = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / ex), zz = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / ex);
          const y = (yy * 0.5 + 0.5) * h + 0.9, z = zz * w / 2;
          pos.push(x, y, z);
          const toeHeel = x > 8.5 || x < -10.5;
          const stripe = !toeHeel && y > 2.4 && y < 3.6;
          c.copy(toeHeel ? red : stripe ? navy : cream);
          if (y < 1.6) c.copy(cream).multiplyScalar(0.92);
          col.push(c.r, c.g, c.b);
        }
      });
      for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < sections; j++) {
        const a = i * (sections + 1) + j, b = a + sections + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const ug = new T.BufferGeometry();
      ug.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      ug.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      ug.setIndex(idx); ug.computeVertexNormals();
      const upper = new T.Mesh(ug, K.phys({ vertexColors: true, roughness: 0.48, clearcoat: 0.4, clearcoatRoughness: 0.35, envMap: envTex, envMapIntensity: 0.4 }));
      upper.castShadow = true; grp.add(upper);
      // end caps (heel and toe)
      const cap1 = new T.Mesh(new T.SphereGeometry(1, 16, 10), leather(0xa8232b)); cap1.scale.set(1.6, 4.2, 3.2); cap1.position.set(-14.4, 5.2, 0); grp.add(cap1);
      const cap2 = new T.Mesh(new T.SphereGeometry(1, 16, 10), leather(0xa8232b)); cap2.scale.set(1.4, 1.6, 2.2); cap2.position.set(14.5, 2.2, 0); grp.add(cap2);
      // sole: dark rubber heel, smooth leather slide sole
      const soleS = new T.Shape(); soleS.moveTo(-14.6, -3.2); soleS.bezierCurveTo(-15.6, 0, -15, 3.6, -13, 3.9); soleS.bezierCurveTo(-6, 4.4, 2, 5.4, 9, 5.2);
      soleS.bezierCurveTo(14, 4.8, 15.8, 1.5, 15, -1.4); soleS.bezierCurveTo(14, -4.4, 8, -5.4, 3, -5.0); soleS.bezierCurveTo(-4, -4.2, -11, -4.4, -14.6, -3.2);
      const soleG = new T.ExtrudeGeometry(soleS, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 10 });
      soleG.rotateX(-PI / 2);
      const sole = new T.Mesh(soleG, K.phys({ color: 0x2b211c, roughness: 0.75 })); sole.position.y = 0.2; sole.castShadow = true; grp.add(sole);
      // collar opening and tongue
      const open = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, TAU, 0, PI / 2), K.std({ color: 0x120c0a, roughness: 0.9 }));
      open.scale.set(4.6, 0.35, 2.7); open.position.set(-8.8, 10.4, 0); grp.add(open);
      const tongue = new T.Mesh(rbox(9, 0.8, 4.4, 0.35, 2), leather(0xe7dcc4)); tongue.position.set(-1.8, 9.2, 0); tongue.rotation.z = -0.25; tongue.castShadow = true; grp.add(tongue);
      // eyelets and the (untied) laces
      const lace = K.std({ color: 0xf4f0e6, roughness: 0.8 });
      const eyes = [], ties = [];
      for (let i = 0; i < 5; i++) {
        const x = -4.5 + i * 2.1, y = 8.9 - i * 0.55;
        for (const sd of [-1, 1]) eyes.push(new T.TorusGeometry(0.32, 0.1, 6, 10).rotateX(PI / 2).translate(x, y + 0.25, sd * 2.6));
        ties.push(cyl(0.18, 0.18, 5.4, 6).rotateX(PI / 2).translate(x + 0.4, y + 0.4, 0));
      }
      grp.add(new T.Mesh(BU.mergeGeometries(eyes), K.metal(0xc9c3b4, 0.3)));
      const tm = new T.Mesh(BU.mergeGeometries(ties), lace); tm.castShadow = true; grp.add(tm);
      // size patch on the heel
      const szC = canvas(128, 128, (g, w, h) => { g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1018'; g.font = '700 70px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('9½', w / 2, h / 2 + 4); });
      const szM = new T.Mesh(new T.CircleGeometry(1.9, 24), K.std({ map: tex(szC, [1, 1], false), roughness: 0.6 }));
      szM.position.set(-16.05, 5.6, 0); szM.rotation.y = -PI / 2; grp.add(szM);
      grp.position.set(sx, 0, sz); grp.rotation.y = -ang;
      K.add(grp);
      K.box(sx, sz, 15.2, 5.4, ang, 10);
      AO(sx, sz, 18, 8, 0.55, ang);
      // the lace that came out, trailing over the lane
      const lp = [];
      const c0 = Math.cos(ang), s0 = Math.sin(ang);
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const lx = -1 + t * 26 + Math.sin(t * 9) * 2.5, lz = 6 + t * 10 + Math.sin(t * 6 + 1) * 5;
        lp.push(new T.Vector3(sx + lx * c0 - lz * s0, i === 0 ? 8.4 : i === 1 ? 3 : 0.3, sz + lx * s0 + lz * c0));
      }
      const lg = new T.TubeGeometry(new T.CatmullRomCurve3(lp), 120, 0.28, 6, false);
      K.mesh(lg, lace, 0, 0, 0);
      K.mesh(cyl(0.34, 0.34, 1.6, 8), K.plastic(0x1a1a1a, 0.3), lp[14].x, 0.36, lp[14].z, { rz: PI / 2, ry: -ang });
      // scorecard and the little pencil
      const scC = canvas(512, 340, (g, w, h) => {
        g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c4212b'; g.fillRect(0, 0, w, 46);
        g.fillStyle = '#fff'; g.font = '700 30px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('STARLANE BOWL  ·  LANE 12', w / 2, 33);
        g.strokeStyle = '#7a6f62'; g.lineWidth = 2;
        const names = ['RED', 'BLU', 'YEL', 'GRN'];
        const marks = [['X', '9/', '7-', 'X', 'X', '8/', '9-', 'X', '7/', 'X'], ['9-', 'X', '8/', '9/', '72', 'X', '9/', 'X', '8-', '9/'], ['7/', '8-', 'X', '9-', '6/', '9/', 'X', '8/', '9-', 'X'], ['X', 'X', '9/', '8-', 'X', '7/', '9-', '9/', 'X', '8/']];
        for (let row = 0; row < 4; row++) {
          const y = 60 + row * 68;
          g.fillStyle = '#2a2a2a'; g.font = '700 24px Rubik, sans-serif'; g.textAlign = 'left'; g.fillText(names[row], 10, y + 40);
          for (let f = 0; f < 10; f++) {
            const x = 80 + f * 42;
            g.strokeRect(x, y, 42, 60); g.strokeRect(x + 21, y, 21, 22);
            g.fillStyle = '#1d3a8a'; g.font = '22px Georgia, serif'; g.textAlign = 'center';
            g.fillText(marks[row][f], x + 26, y + 18);
            g.fillText(String((f + 1) * 17 + row * 3 - (f % 3) * 4), x + 21, y + 50);
          }
        }
      });
      const card = K.mesh(new T.PlaneGeometry(14, 9.3), K.std({ map: tex(scC, [1, 1], false), roughness: 0.85, side: T.DoubleSide }), -96, 0.06, 52, { cast: false });
      card.rotation.order = 'YXZ'; card.rotation.y = 0.35; card.rotation.x = -PI / 2;
      const pencil = new T.Group();
      const body = new T.Mesh(cyl(0.38, 0.38, 7.4, 6), K.std({ color: 0xf2c21e, roughness: 0.5 })); body.rotation.z = PI / 2; pencil.add(body);
      const cone = new T.Mesh(new T.ConeGeometry(0.38, 1.5, 6), K.std({ color: 0xe0b98a, roughness: 0.8 })); cone.rotation.z = -PI / 2; cone.position.x = 4.45; pencil.add(cone);
      const lead = new T.Mesh(new T.ConeGeometry(0.12, 0.5, 6), K.std({ color: 0x2a2a2a, roughness: 0.6 })); lead.rotation.z = -PI / 2; lead.position.x = 5.2; pencil.add(lead);
      pencil.position.set(-88, 0.38, 60); pencil.rotation.y = -0.9;
      K.add(pencil);
      AO(-96, 52, 8, 5.5, 0.2, -0.35);
      // a spare house ball resting beside the shoe
      const sbC = canvas(512, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0f5a7a'); gr.addColorStop(0.5, '#1aa0b8'); gr.addColorStop(1, '#0b3550');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 90; i++) { g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(0,20,40,0.3)'; g.lineWidth = 2 + Math.random() * 6; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 40, w * 0.6, y - 40, w, y + 10); g.stroke(); }
        for (const [x, y, rr] of [[0.7, 0.3, 9], [0.73, 0.38, 9], [0.66, 0.44, 11]]) { g.fillStyle = '#020608'; g.beginPath(); g.ellipse(x * w, y * h, rr, rr * 1.3, 0, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '700 26px Rubik, sans-serif'; g.fillText('12', w * 0.3, h * 0.6);
      });
      K.mesh(sph(BALL_R, 32, 20), K.phys({ map: tex(sbC, [1, 1], false), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMap: envTex, envMapIntensity: 1 }), -48, BALL_R, 72, { ry: 1.2, rx: 0.4 });
      K.circle(-48, 72, BALL_R, 22);
      AO(-48, 72, 9, 9, 0.6);
      const sbm = new T.Mesh(sph(BALL_R, 20, 12), new T.MeshBasicMaterial({ map: tex(sbC, [1, 1], false), color: 0x506068 }));
      sbm.position.set(-48, -BALL_R, 72); sbm.rotation.set(-0.4, 1.2, 0); sbm.renderOrder = -3; K.group.add(sbm);
    }

    // ============================================================ rosin bag and chalk dust (lane 13's infield)
    {
      const rx = 40, rz = 74;
      const dustC = canvas(256, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          const a = Math.random() * TAU, d = Math.pow(Math.random(), 1.3) * 100;
          g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
          g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.7, 0.8 + Math.random() * 2.2, 0, TAU); g.fill();
        }
        for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.ellipse(w / 2 + (Math.random() - 0.5) * 90, h / 2 + (Math.random() - 0.5) * 60, 14, 6, Math.random() * 3, 0, TAU); g.fill(); }
        // a shoe print through the dust
        g.fillStyle = 'rgba(0,0,0,0)'; g.globalCompositeOperation = 'destination-out';
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.ellipse(w * 0.62, h * 0.42, 16, 34, 0.4, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over';
      });
      const dm = K.mesh(new T.PlaneGeometry(30, 30), K.std({ map: tex(dustC, [1, 1], false), transparent: true, depthWrite: false, roughness: 1 }), rx + 3, 0.09, rz + 2, { rx: -PI / 2, cast: false });
      dm.renderOrder = 1;
      const bagC = canvas(256, 128, (g, w, h) => { g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2c4f9a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#2c4f9a'; g.font = '700 50px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ROSIN', w / 2, h / 2 + 2); });
      K.mesh(rbox(6.6, 2.6, 4.8, 1.1, 3), K.std({ map: tex(bagC, [1, 1], false), roughness: 0.95 }), rx, 1.25, rz, { ry: 0.5 });
      AO(rx, rz, 5, 4, 0.4, -0.5);
      K.box(rx, rz, 3.4, 2.5, -0.5, 2.6);
    }

    // ============================================================ the ball return behind the foul line (between lanes 12 and 13)
    {
      const shell = K.phys({ color: 0x2b2f3a, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, envMap: envTex, envMapIntensity: 0.6 });
      const trim = K.metal(0xb8bcc6, 0.25);
      const z0 = FOUL + 22;
      put(rbox(30, 12, 64, 3, 3), 0xffffff, { x: 0, y: 6, z: z0 + 32 }, shell, true);
      put(box(31, 1, 65), 0xffffff, { x: 0, y: 12.3, z: z0 + 32 }, trim, true);
      const hood = new T.SphereGeometry(16, 28, 14, 0, TAU, 0, PI / 2);
      put(hood, 0xffffff, { x: 0, y: 10, z: z0 + 2, sz: 1.1 }, K.phys({ color: 0x8a1a6a, roughness: 0.25, clearcoat: 1, envMap: envTex, envMapIntensity: 0.8 }), true);
      const cols = [[0xc0242a, 0x2a0608], [0x1c8a3a, 0x041a0a], [0xe6b81e, 0x3a2a04], [0x2a62d0, 0x060c22]];
      cols.forEach(([c1], i) => {
        const z = z0 + 20 + i * 11.2;
        put(sph(BALL_R * 0.98, 24, 16), c1, { x: 0, y: 12.6 + BALL_R * 0.72, z }, K.phys({ vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, envMap: envTex, envMapIntensity: 1 }), true);
      });
      K.box(0, z0 + 32, 15, 32, 0, 30);
    }

    // ============================================================ scuffs and the odd dropped thing
    {
      const scC = canvas(128, 64, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(20,14,10,${0.15 + Math.random() * 0.3})`; g.lineWidth = 1 + Math.random() * 4; g.beginPath(); const y = 10 + Math.random() * 44; g.moveTo(10 + Math.random() * 20, y); g.quadraticCurveTo(64, y + (Math.random() - 0.5) * 20, 100 + Math.random() * 20, y + (Math.random() - 0.5) * 10); g.stroke(); } });
      const scMat = K.std({ map: tex(scC, [1, 1], false), transparent: true, depthWrite: false, roughness: 0.8 });
      const list = [];
      for (let i = 0; i < (lowQ ? 14 : 30); i++) {
        const x = r.pick(LANES.slice(1, 3)) + r.range(-48, 48), z = r.range(-10, 120);
        if (dRoad(x, z) < 1.5) continue;
        list.push({ x, y: 0.05, z, ry: r() * TAU, sx: r.range(4, 9), sy: 1, sz: r.range(2, 4) });
      }
      const im = K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), scMat, list, { cast: false });
      im.renderOrder = 1;
      // a scatter of resin crumbs / lint
      const crumbs = [];
      for (let i = 0; i < (lowQ ? 40 : 90); i++) {
        const x = r.range(-150, 150), z = r.range(-20, 122);
        if (dRoad(x, z) < 0.5) continue;
        crumbs.push({ x, y: 0.12, z, s: r.range(0.12, 0.3), ry: r() * 6, rx: r() * 6, color: r.pick([0xf2efe6, 0xd9d2c4, 0x2a2420, 0x8a7a66]) });
      }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.9 }), crumbs, { cast: false, colors: true });
      // a folded microfibre towel (lane 13, beside the way up to the strike deck)
      {
        const tC = canvas(128, 128, (g, w, h) => { g.fillStyle = '#5b2a8c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.fillStyle = '#ff4fb6'; g.fillRect(0, h - 12, w, 6); });
        const tMat = K.std({ map: tex(tC, [1, 1], false), roughness: 1, side: T.DoubleSide });
        const tx = 41, tz = -14;
        // a heap of cloth: a draped sheet, high in the middle, edges lying on the lane, wrinkled
        const cg = new T.PlaneGeometry(19, 14, 30, 22).rotateX(-PI / 2);
        const cp = cg.attributes.position;
        for (let i = 0; i < cp.count; i++) {
          const x = cp.getX(i), z = cp.getZ(i), u = x / 9.5, v = z / 7;
          const e = Math.min(1, Math.hypot(u * 0.9, v));
          const lump = 2.3 * (1 - e * e) * (0.65 + 0.35 * Math.sin(2.6 * u + 0.8) * Math.cos(1.9 * v - 0.4));
          const folds = 0.7 * Math.abs(Math.sin(2.4 * u + 1.3 * v + 0.5)) * (1 - e) + 0.25 * Math.sin(9 * v - 2 * u) * (1 - e * 0.7);
          cp.setY(i, Math.max(0.12, lump + folds));
          // a ragged outline: push the edge in and out
          const a2 = Math.atan2(v, u), wob = 1 + 0.13 * Math.sin(a2 * 3 + 1) + 0.07 * Math.sin(a2 * 7);
          cp.setX(i, x * wob + Math.sin(v * 2.2) * 0.8); cp.setZ(i, z * wob);
        }
        cg.computeVertexNormals();
        K.mesh(cg, tMat, tx, 0, tz, { ry: -0.35 });
        AO(tx, tz, 11, 8, 0.4, -0.35);
        K.box(tx, tz, 8.5, 6, -0.35, 3);
      }
      // a bowling glove (wrist support) dropped beside lane 13's S-bend
      {
        const gx = 104.5, gz = 8, ga = PI / 2 + 0.25;
        const glove = new T.Group();
        const blk = K.std({ color: 0x1b1b20, roughness: 0.75 }), redT = K.std({ color: 0xc0242a, roughness: 0.6 }), metalP = K.metal(0xb9bcc4, 0.3);
        const palm = new T.Mesh(rbox(10, 1.9, 9.5, 0.8, 3), blk); palm.position.y = 0.95; glove.add(palm);
        const fingers = [];
        for (let i = 0; i < 4; i++) fingers.push(new T.CapsuleGeometry(0.95, 4.2 - Math.abs(i - 1.5) * 0.7, 4, 8).rotateZ(PI / 2).translate(7.4 - Math.abs(i - 1.5) * 0.35, 0.95, -3.4 + i * 2.25));
        fingers.push(new T.CapsuleGeometry(1.0, 3.4, 4, 8).rotateZ(PI / 2).rotateY(-0.9).translate(1.5, 0.95, 6.2));
        const fm = new T.Mesh(BU.mergeGeometries(fingers), blk); fm.castShadow = true; glove.add(fm);
        const strap = new T.Mesh(rbox(5.5, 2.3, 11, 0.6, 2), redT); strap.position.set(-6.2, 1.15, 0); glove.add(strap);
        const plate = new T.Mesh(rbox(5, 0.5, 6, 0.2, 1), metalP); plate.position.set(0.5, 2.0, -0.5); glove.add(plate);
        glove.position.set(gx, 0, gz); glove.rotation.y = -ga;
        K.add(glove);
        AO(gx, gz, 11, 7, 0.45, ga);
        K.box(gx, gz, 9, 5.5, ga, 2.6);
      }
      // an orange house ball parked on a rubber ball cup beside lane 12's way down
      {
        const bx = -43, bz = -44;
        const oC = canvas(512, 256, (g, w, h) => {
          g.fillStyle = '#e8641a'; g.fillRect(0, 0, w, h);
          for (let i = 0; i < 70; i++) { g.strokeStyle = i % 2 ? 'rgba(255,214,120,0.3)' : 'rgba(120,30,0,0.3)'; g.lineWidth = 2 + Math.random() * 8; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 50, w * 0.6, y + 50, w, y); g.stroke(); }
          for (const [x, y, rr] of [[0.2, 0.3, 9], [0.23, 0.38, 9], [0.16, 0.44, 11]]) { g.fillStyle = '#140600'; g.beginPath(); g.ellipse(x * w, y * h, rr, rr * 1.3, 0, 0, TAU); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '700 26px Rubik, sans-serif'; g.fillText('10', w * 0.62, h * 0.55);
        });
        const oMat = K.phys({ map: tex(oC, [1, 1], false), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMap: envTex, envMapIntensity: 1 });
        K.mesh(sph(BALL_R, 32, 20), oMat, bx, BALL_R + 1.2, bz, { ry: -0.6, rx: 0.5 });
        put(new T.TorusGeometry(5.2, 1.3, 10, 28).rotateX(PI / 2), 0x1a1a1e, { x: bx, y: 1.2, z: bz }, K.std({ color: 0xffffff, roughness: 0.75 }), true);
        const om = new T.Mesh(sph(BALL_R, 20, 12), new T.MeshBasicMaterial({ map: oMat.map, color: 0x6a5a50 }));
        om.position.set(bx, -BALL_R - 1.2, bz); om.renderOrder = -3; K.group.add(om);
        AO(bx, bz, 9, 9, 0.55);
        K.circle(bx, bz, BALL_R, 24);
      }
    }

    // ============================================================ lights: bright over the decks, neon accents, dark towards the bowlers
    {
      const deckL = (x) => { const l = new T.PointLight(0xffe9d0, 8000, 0, 2); l.position.set(x, 70, -42); K.group.add(l); return l; };
      deckL(XA); deckL(XB);
      const pink = new T.PointLight(0xff3aa8, 700, 0, 2); pink.position.set(0, 26, -40); K.group.add(pink);
      const cyan = new T.PointLight(0x30d8ff, 520, 0, 2); cyan.position.set(PITCH, 22, 10); K.group.add(cyan);
      const cyan2 = new T.PointLight(0x30d8ff, 420, 0, 2); cyan2.position.set(-PITCH, 22, 10); K.group.add(cyan2);
      A.pink = pink;
    }

    // contact shadows (one instanced mesh)
    {
      const g = new T.PlaneGeometry(1, 1).rotateX(-PI / 2);
      const im = new T.InstancedMesh(g, contactMat, contacts.length);
      contacts.forEach((c, i) => im.setMatrixAt(i, mtx(c)));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.renderOrder = 1;
      K.group.add(im);
    }
    flushBins();
  },

  tick(dt, time, game) {
    if (!A) return;
    // spare pins: once knocked they slide and lie still for a moment, then the pinsetter takes them away
    for (const p of A.push) {
      const d = p.d;
      if (d.state === 'live' && p.prev !== 'live') { p.knock = null; p.still = 0; }
      p.prev = d.state;
      if (d.state !== 'live') continue;
      const sp = Math.hypot(d.vx, d.vz);
      if (p.knock == null && (sp > 2.5 || Math.hypot(d.x - d.home[0], d.z - d.home[1]) > 1.2)) { p.knock = time; p.dir = Math.atan2(d.vz, d.vx); }
      if (p.knock != null) {
        p.still = sp < 0.8 ? p.still + dt : 0;
        if (p.still > 1.1 && time - p.knock > 1.4) { d.state = 'sunk'; d.t = 0; d.vx = d.vz = 0; }
      }
    }
    // the strike: clacks when the ball reaches the pins, a bell as the ball is sent down the lane
    const u = ballU(time), pu = A.lastU;
    A.lastU = u;
    if (pu == null) return;
    const crossed = (a) => (pu <= u ? pu < a && u >= a : pu < a || u >= a);
    const b = ballPose(time);
    if (crossed(BALL.tA)) game.physics.events.push({ type: 'clack', strength: 34, x: b.x, z: b.z });
    if (crossed(BALL.t2)) { game.physics.events.push({ type: 'clack', strength: 30, x: b.x - 10, z: b.z }); game.physics.events.push({ type: 'clack', strength: 26, x: b.x + 10, z: b.z }); }
    for (const a of [BALL.P - 1.3, BALL.P - 0.95, BALL.P - 0.6]) if (crossed(a)) game.sound.cue('bell', { x: XB, z: 100, game });
    if (crossed(BALL.reset)) game.sound.cue('clank', { x: XB, z: ZH - 60, game });
  },

  animate(time, dt, game) {
    if (!A) return;
    const V = A.tmp || (A.tmp = { M: new THREE.Matrix4(), MM: new THREE.Matrix4(), FL: new THREE.Matrix4().makeScale(1, -1, 1), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), o: new THREE.Vector3(), ax: new THREE.Vector3(), X: new THREE.Vector3(1, 0, 0), col: new THREE.Color() });
    // ---- the ball
    const b = ballPose(time);
    A.ball.visible = b.vis; A.mball.visible = b.vis && b.z > PIT;
    A.ballShadow.visible = b.vis && b.z > PIT;
    if (b.vis) {
      A.ball.position.set(b.x, b.y, b.z);
      A.mball.position.set(b.x, -b.y, b.z);
      A.ballShadow.position.set(b.x, 0.07, b.z);
      if (A.ballLastD != null) {
        const dd = b.d - A.ballLastD;
        if (dd > 0 && dd < 20) {
          A.ball.rotateOnWorldAxis(V.X, -dd / BALL_R);
          const q = A.ball.quaternion; A.mball.quaternion.set(-q.x, q.y, -q.z, q.w);
        }
      }
      A.ballLastD = b.d;
      // rumble while it rolls on screen
      A.rumbleT -= dt;
      if (b.live && A.rumbleT <= 0 && game.sound.ctx && (game.state === 'race' || game.state === 'countdown') && game.onScreen(b.x, 5, b.z)) {
        A.rumbleT = 0.11;
        game.sound.tone(46 + Math.random() * 8, 0.16, { type: 'triangle', vol: 0.06, pan: game.panOf ? game.panOf(b.x, b.z) : 0 });
      }
    } else A.ballLastD = null;
    // ---- the strike deck's moving pins (tumbling round their middle)
    for (let i = 0; i < KNOCK.length; i++) {
      const k = knockedPin(i, time);
      V.e.set(k.rx, 0, k.rz, 'XYZ'); V.q.setFromEuler(V.e);
      V.o.set(0, PIN_H / 2, 0).applyQuaternion(V.q);
      const lift = k.standing || k.y > 30 ? 0 : 5.5 * Math.min(1, Math.abs(k.rx));
      V.p.set(k.x, k.y + lift, k.z);
      if (!k.standing && !(k.y > 30)) V.p.set(k.x - V.o.x, k.y + lift + PIN_H / 2 - V.o.y, k.z - V.o.z);
      V.s.setScalar(k.vis ? 1 : 0.0001);
      V.M.compose(V.p, V.q, V.s);
      A.kPins.im.setMatrixAt(i, V.M);
      if (k.vis && k.z > PIT && k.y < 1) V.MM.copy(V.FL).multiply(V.M); else V.MM.makeScale(0.0001, 0.0001, 0.0001);
      A.kPins.mm.setMatrixAt(i, V.MM);
      const ao = A.kAO[i];
      ao.visible = k.vis && k.y < 12 && Math.abs(k.z - ao.position.z) < 3;
      if (ao.visible) ao.material.opacity = 0.5 * (1 - k.y / 12);
    }
    A.kPins.im.instanceMatrix.needsUpdate = true; A.kPins.mm.instanceMatrix.needsUpdate = true;
    // ---- sweep bar
    A.sweep.position.y = sweepY(time);
    // ---- LED studs: idle shimmer, a red chase up lane 13's cappings while a ball is coming
    {
      const u = ballU(time), warn = u > BALL.P - 1.4 || u < BALL.tA + 0.6;
      const col = V.col;
      A.ledList.forEach((l, i) => {
        const flank = l.cap === 0 || l.cap === PITCH;
        if (l.cap === 'xs' || l.cap === 'xa') {
          const act = l.cap === 'xs' ? u > BALL.P - 1.4 || u < 1.6 : u > BALL.tA + 0.9 && u < BALL.t2;
          const on = act ? (Math.floor(time * 5) % 2 ? 1 : 0.1) : 0.03;
          col.setRGB(1.7 * on, 0.75 * on, 0.06 * on);
        } else if (warn && flank) {
          const ph = (((time * 2.2 + l.z * 0.04) % 1) + 1) % 1;
          const near = Math.max(0, 1 - Math.abs(l.z - b.z) / 26);
          const on = ph < 0.45 ? 1 : 0.12;
          col.setRGB(1.6 * on + near, 0.5 * on + near * 0.7, 0.04 * on + near * 0.2);
        } else {
          const k = 0.55 + 0.25 * Math.sin(time * 1.3 + l.z * 0.05 + l.cap * 0.01);
          if (l.cap !== 0) col.setRGB(0.06 * k, 0.75 * k, 0.95 * k); else col.setRGB(0.95 * k, 0.12 * k, 0.6 * k);
        }
        A.leds.setColorAt(i, col);
        A.halos.setColorAt(i, col.multiplyScalar(0.45));
      });
      A.leds.instanceColor.needsUpdate = true; A.halos.instanceColor.needsUpdate = true;
    }
    // ---- spare pins toppling (fall in the direction they were hit, slide on their side)
    for (const p of A.push) {
      const d = p.d;
      let tilt = 0;
      if (p.knock != null && d.state === 'live') tilt = Math.min(PI / 2 - 0.1, ((time - p.knock) / 0.42) ** 2 * (PI / 2));
      const dx = Math.cos(p.dir), dz = Math.sin(p.dir), st = Math.sin(tilt);
      V.ax.set(dz, 0, -dx);
      p.tilt.quaternion.setFromAxisAngle(V.ax, tilt);
      p.tilt.position.set(-dx * 17 * st, 6.1 * st, -dz * 17 * st);
      p.tiltM.quaternion.copy(p.tilt.quaternion); p.tiltM.position.copy(p.tilt.position);
      // its contact shadow follows it and stretches as it lies down
      p.ao.visible = d.state === 'live';
      p.ao.position.set(d.x + dx * 2 * st, 0.07, d.z + dz * 2 * st);
      p.ao.rotation.z = -p.dir;
      p.ao.scale.set(12 + 26 * st, 12 - 0 * st, 1);
    }
    // neon numbers flicker a touch
    A.numMat.color.setScalar(0.92 + 0.08 * Math.sin(time * 23) * Math.sin(time * 3.1));
  },
};
