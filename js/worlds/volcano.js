// World: Eruption! (Mayhem Cup, table 4 of 4). A school science fair at real size: a huge papier-mache volcano on
// a display table under a blue plastic tablecloth, the tri-fold poster behind it, beakers, a vinegar bottle, a box of
// baking soda and the judge's clipboard around it. The road climbs onto the volcano's lower flank, runs round the
// south face on a rock-walled terrace and comes back down; the rest of the lap winds round the table.
// Every 20 s the volcano erupts. It rumbles, its crater glows, the steam whistle shrieks and the crossing beacons
// flash first; then red-orange foam surges down the south channel and floods its two crossings (the terrace, then the
// start straight) for a few seconds, and lava bombs come down on glowing target marks and blast cars aside. Between
// eruptions papier-mache boulders roll down the south face across the terrace into the foam ponds below, and the
// permanent west river is crossed on two little craft-stick bridges. Spilled vinegar and foam puddles do the rest.
import * as THREE from '../../vendor/three.bundle.js';

const TRACK = [
  [-56, 85], [20, 85], [92, 82], [130, 71], [150, 46], [146, 18], [126, 2], [114, -20], [122, -44], [118, -63], [96, -73],
  [68, -71], [48, -58], [40, -40], [40, -20], [38.64, -9.65], [34.64, 0], [28.28, 8.28], [20, 14.64], [10.35, 18.64], [0, 20],
  [-10.35, 18.64], [-20, 14.64], [-28.28, 8.28], [-34.64, 0], [-38.64, -9.65], [-40, -20], [-40, -40], [-48, -58], [-68, -71],
  [-100, -74], [-136, -66], [-156, -42], [-160, -10], [-152, 18], [-128, 32], [-110, 44], [-100, 62], [-84, 80],
];
const W = 15;
const PI = Math.PI, TAU = PI * 2;
const DEG = PI / 180;
const BOUNDS = { minX: -176, maxX: 176, minZ: -106, maxZ: 104 };
// the volcano: centre, terrace road radius and height, the climbs, the cone
const C = { x: 0, z: -20 };
const RW = 40, HT = 4.5, RAMP = 36;
const CONE = { rim: 7.5, rimH: 44, floor: 37.5, foot: 44 };
// the eruption cycle (s): period, first boom after GO, warning before it, flood time per strip, sticky crust after it
const ERU = { P: 20, first: 9, warn: 5.5, D: 3.4, stick: 1.6 };
// the south surge channel: crater rim -> terrace crossing (0, 20) -> table -> start straight crossing (0, 85) -> edge
const CH_PTS = [[0, -12.5], [0, 12.5], [0, 27.5], [0, 34], [2.5, 46], [-2.5, 58], [1.5, 70], [0, 79], [0, 92], [0, 108]];
const CH = { hw: 3.6, u0: 0.35, vCone: 30, vTerr: 22, vTable: 16, aCone: 25, aTable: 46.5 };
// the permanent west river: down the cone at 160 degrees, under the terrace bridge, across the table, under the west bridge
const RIV_TH = 160 * DEG;
const RIV_PTS = [[-60.4, 1.4], [-74, 4.5], [-96, -1], [-120, 5], [-142, 3], [-158, 2.6], [-190, 4]];
const RIV = { hw: 3.3, deck: 5.2 };
// boulders: two runs down the south face (angle round the cone, phase), one every 5 s
const ROCK = { P: 10, R: 3.1, r0: 24.5, wob: 1.6, acc: 34, dec: 8, pond: 66, runs: [{ th: 42 * DEG, ph: 0 }, { th: 128 * DEG, ph: 5 }] };
// lava bombs: six per eruption, spots by track position (s, lateral) in three sets that take turns
const BOMB = { n: 6, R: 4.6, splat: 4.5 };
const BOMB_SETS = [
  [[380, 3.5], [440, -3], [476, -3.5], [616, 3], [660, -3.5], [690, 3]],
  [[300, -3], [396, -3.5], [452, 3], [624, -3.5], [672, 3.5], [742, 3]],
  [[102, 3.5], [366, -3], [410, 3.5], [633, 3], [651, -3], [706, -3.5]],
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

// height of the papier-mache cone at radius r from the centre (no road, no channels)
function coneH(r) {
  const R0 = CONE.rim;
  if (r < R0) { const k = r / R0; return CONE.floor + (CONE.rimH - CONE.floor) * k * k * (1.6 - 0.6 * k); }
  if (r < R0 + 1.6) { const k = (r - R0) / 1.6; return CONE.rimH + 0.35 * Math.sin(k * PI) - 0.25 * k; }
  const x = clamp((r - R0 - 1.6) / (CONE.foot - R0 - 1.6), 0, 1);
  return (CONE.rimH - 0.25) * (1 - x) * (1 - x) * (1 + 0.85 * x);
}

let A = null; // runtime state for tick / animate

// ---- the volcano clock: every hazard is a pure function of the time since GO (A.t0 is set when a countdown starts)
const raceT = (t) => t - (A ? A.t0 : 0);
const eruX = (t) => raceT(t) - ERU.first;
const eruU = (t) => mod(eruX(t), ERU.P); // seconds since the last boom
const eruK = (t) => Math.floor(eruX(t) / ERU.P); // which eruption
const warnOf = (u) => (u > ERU.P - ERU.warn ? (u - (ERU.P - ERU.warn)) / ERU.warn : 0); // 0..1 in the build-up
// surge front: time after the boom at which the foam reaches along-distance a of the channel, and its inverse
function chT(a) {
  return CH.u0 + Math.min(a, CH.aCone) / CH.vCone + clamp(a - CH.aCone, 0, CH.aTable - CH.aCone) / CH.vTerr + Math.max(0, a - CH.aTable) / CH.vTable;
}
function chFront(u) {
  let t = u - CH.u0;
  if (t <= 0) return -1;
  const t1 = CH.aCone / CH.vCone, t2 = (CH.aTable - CH.aCone) / CH.vTerr;
  if (t < t1) return t * CH.vCone;
  t -= t1;
  if (t < t2) return CH.aCone + t * CH.vTerr;
  return CH.aTable + (t - t2) * CH.vTable;
}
// boulder on run k at time t: radius from the centre, state, spin distance
const ROCK_O = { r: 0, vis: true, scale: 1, sink: 0, wob: 0, live: false, u: 0 };
function rockPose(k, t, o = ROCK_O) {
  const run = ROCK.runs[k], u = mod(raceT(t) + run.ph, ROCK.P);
  const t1 = Math.sqrt((2 * (32.5 - ROCK.r0)) / ROCK.acc), v1 = ROCK.acc * t1;
  const dP = ROCK.pond - 32.5, t2 = (v1 - Math.sqrt(Math.max(0, v1 * v1 - 2 * ROCK.dec * dP))) / ROCK.dec;
  o.r = ROCK.r0; o.vis = true; o.scale = 1; o.sink = 0; o.wob = 0; o.live = false; o.u = u;
  if (u < 0.5) { o.scale = ss(0, 0.5, u); return o; }
  if (u < ROCK.wob) { o.wob = Math.sin(u * 26) * ss(0.5, 0.8, u); return o; }
  const tau = u - ROCK.wob;
  if (tau < t1) o.r = ROCK.r0 + 0.5 * ROCK.acc * tau * tau;
  else if (tau < t1 + t2) { const q = tau - t1; o.r = 32.5 + v1 * q - 0.5 * ROCK.dec * q * q; }
  else {
    const q = tau - t1 - t2, v2 = v1 - ROCK.dec * t2;
    o.r = ROCK.pond + v2 * 0.35 * (1 - Math.exp(-q * 3)); o.sink = ss(0, 0.8, q);
    if (q > 0.8) o.vis = false;
  }
  o.live = o.r > 29.5 && o.r < 44.5;
  return o;
}
// cycle time at which the boulder's centre passes radius rr (rolling down)
function rockUAt(rr) {
  const t1 = Math.sqrt((2 * (32.5 - ROCK.r0)) / ROCK.acc), v1 = ROCK.acc * t1;
  if (rr <= 32.5) return ROCK.wob + Math.sqrt((2 * Math.max(0, rr - ROCK.r0)) / ROCK.acc);
  return ROCK.wob + t1 + (v1 - Math.sqrt(Math.max(0, v1 * v1 - 2 * ROCK.dec * (rr - 32.5)))) / ROCK.dec;
}
// lava bomb i of the current eruption: spot, launch and impact times (s after the boom)
const BOMB_O = { spot: null, u: 0, tL: 0, tI: 0 };
function bombOf(i, t, o = BOMB_O) {
  const k = eruK(t), spot = A.bombSpots[mod(k, 3)][i];
  o.spot = spot; o.u = eruU(t); o.tL = 0.2 + i * 0.14; o.tI = o.tL + spot.flight;
  return o;
}

export default {
  id: 'volcano',
  name: 'Eruption!',
  blurb: 'Climb the science-fair volcano, beat the foam surge, dodge the lava bombs.',
  vehicle: 'monster',
  seed: 79,
  track: { points: TRACK, width: W, startS: 30 },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x10131c,
  dust: {
    normal: null,
    sticky: { color: 0xff5a2a, size: 0.8, life: 0.45, up: 2, grav: 12, alpha: 0.9, grow: 1.3, rate: 1.4 },
    slick: { color: 0xf4f0e0, size: 0.7, life: 0.4, up: 2.5, grav: 22, alpha: 0.8, grow: 1.1, rate: 1.6 },
    slow: { color: 0xfffaf0, size: 0.9, life: 0.5, up: 2.5, grav: 12, alpha: 0.7, grow: 1.6, rate: 1.4 },
  },
  lighting: {
    sunDir: [0.55, 1, 0.32], sunColor: 0xfff0dc, sunIntensity: 2.8,
    hemiSky: 0xd8e2ff, hemiGround: 0x4a3c30, hemiIntensity: 0.5,
    envIntensity: 0.5, exposure: 1.0, background: 0x2a241f, shadowRadius: 2.4,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { L, t0: 0, prevState: null, prevU: null, cross: [], rocks: [], bombs: [], bombSpots: [] };

    // ============================================================ helpers
    const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
    const mtx = (o) => new T.Matrix4().compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ')), _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    const prep = (geo, c, M) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (M) g.applyMatrix4(M);
      if (!g.attributes.color || c != null) {
        _c.set(c ?? 0xffffff);
        const n = g.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
        g.setAttribute('color', new T.BufferAttribute(a, 3));
      }
      g.clearGroups();
      return g;
    };
    // static parts merged per material and per 140-unit cell (far cells are culled)
    const bins = new Map();
    const put = (geo, c, o, mat, cast = true) => {
      const g = prep(geo, c, mtx(o || {}));
      const x = o?.x ?? 0, z = o?.z ?? 0;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 420) / 140) + ':' + Math.floor((z + 420) / 140);
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
    const cyl = (r1, r2, h, seg = 16, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (rad, ws = 16, hs = 12) => new T.SphereGeometry(rad, ws, hs);
    const sAt = (x, z) => track.distTo(x, z).s;
    const sRel = (s, a) => mod(s - a, L);
    // contact shadows: one instanced mesh, opacity in the instance's y scale
    const contactMat = new T.MeshBasicMaterial({ color: 0x05040a, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.07) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op * 0.7, sz: rz * 2 });
    const NF = TX.noiseField(256, { seed: 79, period: 8, oct: 4 });
    const NF2 = TX.noiseField(256, { seed: 83, period: 16, oct: 3 });
    const bil = (f, x, y) => {
      x = ((x % 256) + 256) % 256; y = ((y % 256) + 256) % 256;
      const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, fx = x - x0, fy = y - y0;
      return (f[y0 * 256 + x0] * (1 - fx) + f[y0 * 256 + x1] * fx) * (1 - fy) + (f[y1 * 256 + x0] * (1 - fx) + f[y1 * 256 + x1] * fx) * fy;
    };
    const n1 = (x, z, sc, o = 0) => bil(NF, x * sc + 37 + o, z * sc + 91 + o * 0.7);
    const n2 = (x, z, sc, o = 0) => bil(NF2, x * sc + 11 + o, z * sc + 53);
    // a polyline with arc length: {pts, cum, len, at(a) -> {x, z, tx, tz}}
    const pathOf = (pts) => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const len = cum[cum.length - 1];
      const at = (a) => {
        a = clamp(a, 0, len);
        let i = 1; while (i < pts.length - 1 && cum[i] < a) i++;
        const f = (a - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), p0 = pts[i - 1], p1 = pts[i];
        const l = cum[i] - cum[i - 1] || 1;
        return { x: lerp(p0[0], p1[0], f), z: lerp(p0[1], p1[1], f), tx: (p1[0] - p0[0]) / l, tz: (p1[1] - p0[1]) / l };
      };
      return { pts, cum, len, at };
    };
    // smooth a polyline (Catmull-Rom through the points, `step` spacing)
    const smoothPts = (pts, step = 1) => {
      const cv = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
      const n = Math.max(2, Math.ceil(cv.getLength() / step));
      return cv.getSpacedPoints(n).map((v) => [v.x, v.z]);
    };

    // ============================================================ the terrace: where it is along the track
    const sArc0 = sAt(C.x + RW, C.z), sArc1 = sAt(C.x - RW, C.z);
    const SA = sArc0 - RAMP, SB = sArc0, SC = sArc1, SD = sArc1 + RAMP;
    const arcLen = SC - SB;
    const roadY = (s) => {
      const u = sRel(s, SA);
      if (u < RAMP) return HT * (u / RAMP);
      if (u < RAMP + arcLen) return HT;
      if (u < 2 * RAMP + arcLen) return HT * (1 - (u - RAMP - arcLen) / RAMP);
      return 0;
    };
    const onTerrace = (s) => sRel(s, SA) < 2 * RAMP + arcLen;
    const sOfTh = (th) => SB + RW * th; // track s on the arc at angle th (0 = east, PI/2 = south)
    Object.assign(A, { SA, SB, SC, SD, roadY });

    // physics: the climb and the descent as chains of short ramps, the terrace as a chain of platforms
    {
      const n = Math.round(RAMP / 4), sl = RAMP / n;
      for (let i = 0; i < n; i++) {
        for (const up of [true, false]) {
          const s0 = up ? SA + i * sl : SC + i * sl, s1 = s0 + sl;
          const p0 = track.at(s0), p1 = track.at(s1);
          const y0 = roadY(s0 + 0.001), y1 = roadY(s1 - 0.001);
          const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2, len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.35;
          if (up) K.ramp(mx, mz, Math.atan2(p1.z - p0.z, p1.x - p0.x), len, W + 3.4, y1 - y0, y0);
          else K.ramp(mx, mz, Math.atan2(p0.z - p1.z, p0.x - p1.x), len, W + 3.4, y0 - y1, y1);
        }
      }
      const m = Math.ceil(arcLen / 6), pl = arcLen / m;
      for (let i = 0; i < m; i++) {
        const s0 = SB + i * pl - 0.4, s1 = SB + (i + 1) * pl + 0.4;
        const p0 = track.at(s0), p1 = track.at(s1);
        K.platform((p0.x + p1.x) / 2, (p0.z + p1.z) / 2, Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2, W / 2 + 2.6, Math.atan2(p1.z - p0.z, p1.x - p0.x), HT);
      }
    }

    // ============================================================ the south surge channel and its two crossings
    const chPath = pathOf(smoothPts(CH_PTS, 1));
    A.ch = chPath;
    // along-distance on the channel nearest to a point
    const chAlong = (x, z) => { let best = 0, bd = 1e9; for (let a = 0; a <= chPath.len; a += 0.5) { const p = chPath.at(a), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = a; } } return best; };
    for (const [cx, cz] of [[0, 20], [0, 85]]) {
      const s = sAt(cx, cz), p = track.at(s), ac = chAlong(p.x, p.z), cp = chPath.at(ac);
      const ang = Math.atan2(cp.tz, cp.tx), span = W / 2 + 1.1;
      // three strips across the road, each opening as the foam reaches it
      const strips = [];
      for (let k = 0; k < 3; k++) {
        const a0 = ac - span + (k * 2 * span) / 3, a1 = a0 + (2 * span) / 3, q = chPath.at((a0 + a1) / 2);
        const hole = K.trapdoor(q.x, q.z, span / 3 + 0.05, CH.hw, ang, false);
        strips.push({ hole, a0, a1, t0: chT(a0), t1: chT(a1) + ERU.D });
      }
      const c = Math.cos(ang), sn = Math.sin(ang), hw = span, hd = CH.hw + 0.4;
      const poly = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [p.x + a * c - b * sn, p.z + a * sn + b * c]);
      const surf = K.surface('normal', { poly });
      const tF0 = chT(ac - span), tF1 = chT(ac + span) + ERU.D;
      A.cross.push({ s, x: p.x, z: p.z, y: roadY(s), ang, ac, strips, surf, tF0, tF1, tS1: tF1 + ERU.stick, roadAng: p.angle });
    }

    // ============================================================ the permanent west river and its two bridges
    const rivPts = (() => {
      // down the cone in its gully, across the terrace, down the apron, then across the table
      const out = [];
      for (let rr = 9; rr <= 58; rr += 1) out.push([C.x + Math.cos(RIV_TH) * rr, C.z + Math.sin(RIV_TH) * rr]);
      return out.concat(smoothPts(RIV_PTS, 1).slice(1));
    })();
    const rivPath = pathOf(rivPts);
    A.riv = rivPath;
    const sBr1 = sOfTh(RIV_TH);
    const br2 = (() => { // where the river meets the west road
      let best = null;
      for (let a = 60; a < rivPath.len; a += 0.25) { const q = rivPath.at(a), n = track.distTo(q.x, q.z); if (!best || n.dist < best.d) best = { a, d: n.dist, s: n.s, x: q.x, z: q.z }; }
      return best;
    })();
    {
      // terrace bridge: the gully either side of the deck (radial strips)
      const ca = Math.cos(RIV_TH), sa = Math.sin(RIV_TH);
      for (const [r0, r1] of [[31.9, RW - RIV.deck], [RW + RIV.deck, 48.3]]) {
        const rc = (r0 + r1) / 2;
        K.trapdoor(C.x + ca * rc, C.z + sa * rc, (r1 - r0) / 2, RIV.hw, RIV_TH, true);
      }
      // west bridge: the river either side of the deck, in the road's frame
      const p = track.at(br2.s);
      for (const sd of [-1, 1]) {
        const lc = sd * (RIV.deck + 4.2), q = track.place(br2.s, lc);
        K.trapdoor(q.x, q.z, RIV.hw + 0.6, 4.2, p.angle, true);
      }
      K.platform(p.x, p.z, 5.0, RIV.deck, p.angle, 0.6);
      // the river across the table: round holes along it, clear of the road and the bridge
      for (let a = 50; a < rivPath.len; a += 2) {
        const q = rivPath.at(a);
        if (Math.hypot(q.x - C.x, q.z - C.z) < 50.5) continue;
        if (Math.hypot(q.x - br2.x, q.z - br2.z) < 13.5) continue;
        if (q.x < BOUNDS.minX + 1) continue;
        K.hole(q.x, q.z, RIV.hw);
      }
      A.br2 = br2;
    }

    // ============================================================ rock walls along the terrace, the cone's colliders
    {
      const wall = (side, s0, s1) => {
        const n = Math.ceil((s1 - s0) / 4.5);
        for (let i = 0; i < n; i++) {
          const a = s0 + ((s1 - s0) * i) / n, b = s0 + ((s1 - s0) * (i + 1)) / n;
          const pa = track.place(a, side * (W / 2 + 1.5)), pb = track.place(b, side * (W / 2 + 1.5));
          K.capsule(pa.x, pa.z, pb.x, pb.z, 1.05, Math.max(roadY(a), roadY(b)) + 2.8, { solid: true });
        }
      };
      wall(-1, SA, SD);
      wall(1, SA, SB + 3);
      wall(1, SC - 3, SD);
      K.circle(C.x, C.z, RW - W / 2 - 0.2, 70, { solid: true });
      // the cone's back foot (between the two climbs)
      for (let a = 200; a <= 340; a += 14) { const t = a * DEG; K.circle(C.x + Math.cos(t) * 35, C.z + Math.sin(t) * 35, 3.2, 8, { solid: true }); }
    }

    // ============================================================ boulders (movers, live only while on the terrace)
    for (let k = 0; k < ROCK.runs.length; k++) {
      const th = ROCK.runs[k].th, ca = Math.cos(th), sa = Math.sin(th);
      const out = { x: 0, z: 0, angle: 0, h: 0 }, tmp = { r: 0 };
      const mv = K.mover({ type: 'circle', r: ROCK.R, h: 0, solid: true }, (t) => {
        const q = rockPose(k, t, tmp);
        out.x = C.x + ca * q.r; out.z = C.z + sa * q.r; out.h = q.live ? 40 : 0;
        return out;
      });
      A.rocks.push({ k, th, ca, sa, mv, s: sOfTh(th) });
    }
    A.rockW = [rockUAt(28.5), rockUAt(44.5)];

    // ============================================================ lava bombs: spots, their blast domes and foam splats
    {
      const top = { x: C.x, y: CONE.rimH + 4, z: C.z };
      for (const set of BOMB_SETS) {
        A.bombSpots.push(set.map(([s, lat]) => {
          const q = track.place(s, lat), y = roadY(s), d = Math.hypot(q.x - top.x, q.z - top.z);
          return { s, lat, x: q.x, z: q.z, y, flight: 1.15 + d / 80, dist: d };
        }));
      }
      for (let i = 0; i < BOMB.n; i++) {
        const out = { x: 0, z: 0, angle: 0, h: 0, r: 1.4 }, tmp = {};
        const mv = K.mover({ type: 'circle', r: 2.4, h: 0, kick: 22, solid: true }, (t) => {
          const b = bombOf(i, t, tmp), live = b.u >= b.tI && b.u < b.tI + 0.45;
          out.x = b.spot.x; out.z = b.spot.z; out.h = live ? b.spot.y + 3.2 : 0; out.r = live ? 1.4 + 1.2 * ss(b.tI, b.tI + 0.12, b.u) : 1.4;
          return out;
        });
        const surf = K.surface('normal', { x: 0, z: -999, r: 3.4 });
        A.bombs.push({ i, mv, surf });
      }
    }

    // ============================================================ secondary hazards: spilled vinegar, foam puddles
    const slicks = [], puddles = [];
    {
      // the vinegar from the tipped bottle runs onto the inside of the south-east corner
      const q = track.place(195, 3.8);
      slicks.push({ x: q.x, z: q.z, rad: 6.0, stretch: 1.5, ang: q.angle + 0.15 });
      // foam puddles left by earlier eruptions (one side of the road, so there is always a way past)
      for (const [s, lat, rad] of [[338, -4.2, 3.0], [700, 4, 3.2], [846, -4.0, 3.0], [262, 4.4, 2.6]]) {
        const p = track.place(s, lat); puddles.push({ x: p.x, z: p.z, rad, ang: p.angle });
      }
    }

    // ============================================================ the visuals
    // ---- table, cloth, floor
    {
      const fl = canvas(512, 512, (g) => {
        const img = TX.paint(512, 512, (x, y, u, v, o) => {
          const row = Math.floor(v * 32), off = (row * 0.37) % 1, bu = (u * 4 + off) % 1;
          const k = 0.86 + 0.1 * n1(x * 0.5, y * 4, 1) + (bu < 0.006 ? -0.25 : 0) + ((v * 32) % 1 < 0.04 ? -0.18 : 0) + 0.06 * Math.sin(row * 7.1);
          o[0] = clamp(214 * k, 0, 255); o[1] = clamp(168 * k, 0, 255); o[2] = clamp(112 * k, 0, 255);
        });
        g.drawImage(img, 0, 0);
        g.strokeStyle = 'rgba(30,70,170,0.9)'; g.lineWidth = 6;
        g.beginPath(); g.arc(256, 256, 100, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
        g.strokeStyle = 'rgba(200,40,40,0.85)'; g.lineWidth = 5; g.strokeRect(60, 150, 150, 212);
      });
      const floorMat = K.phys({ map: tex(fl, [3, 3]), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
      K.mesh(new T.PlaneGeometry(1800, 1800), floorMat, 0, -76, 0, { rx: -PI / 2, cast: false });
      const steel = K.metal(0x8a8f98, 0.4);
      const legGeo = cyl(1.4, 1.4, 72, 10);
      for (const [x, z] of [[-160, -92], [160, -92], [-160, 90], [160, 90], [0, -92], [0, 90]]) put(legGeo, null, { x, y: -38, z }, steel, false);
      put(box(BOUNDS.maxX - BOUNDS.minX - 10, 4, BOUNDS.maxZ - BOUNDS.minZ - 10), 0x5a5048, { y: -4.5 }, K.std({ color: 0x6b6058, roughness: 0.8 }), false);
    }
    const clothTex = (() => {
      const h = new Float32Array(512 * 512);
      const map = TX.paint(512, 512, (x, y, u, v, o) => {
        const fu = (u + 0.5) % 1, fv = (v + 0.5) % 1, bend = (n1(x * 0.5, y * 0.5, 1) - 0.5) * 0.02;
        const crease = Math.exp(-((Math.min(fu, 1 - fu) + bend) ** 2) / 0.00002) * 0.6 + Math.exp(-((Math.min(fv, 1 - fv) - bend) ** 2) / 0.00002) * 0.6;
        const wr = n1(x, y, 0.6) - 0.5, wr2 = n2(x, y, 1.4) - 0.5, wr3 = n1(x * 2.5, y * 0.8, 1, 9) - 0.5;
        h[y * 512 + x] = -crease * 0.5 + wr * 0.6 + wr2 * 0.3 + wr3 * 0.25;
        const k = 1 - crease * 0.08 + wr * 0.06 + wr3 * 0.04;
        o[0] = clamp(30 * k, 0, 255); o[1] = clamp(78 * k, 0, 255); o[2] = clamp(178 * k, 0, 255);
      });
      return { map: tex(map, [3, 2]), normalMap: tex(TX.normalFromHeight(h, 512, 512, 1.4), [3, 2], true, false) };
    })();
    const clothMat = K.phys({ map: clothTex.map, normalMap: clothTex.normalMap, normalScale: V2(0.5), roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new T.Color(0x9fb8ff) });
    {
      const cw = BOUNDS.maxX - BOUNDS.minX, cd = BOUNDS.maxZ - BOUNDS.minZ;
      K.mesh(new T.PlaneGeometry(cw, cd), clothMat, (BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2, { rx: -PI / 2, cast: false });
      const drop = 30, segs = 140;
      const skirt = (len, cx, cz, ang) => {
        const g = new T.PlaneGeometry(len, drop, segs, 6);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), k = (drop / 2 - y) / drop;
          p.setZ(i, (Math.sin(x * 0.31) * 0.9 + Math.sin(x * 0.11 + 1.3) * 1.4) * k * k + 0.3);
        }
        g.computeVertexNormals();
        K.mesh(g, clothMat, cx, -drop / 2, cz, { ry: ang, cast: false });
      };
      skirt(cw, (BOUNDS.minX + BOUNDS.maxX) / 2, BOUNDS.maxZ, 0);
      skirt(cw, (BOUNDS.minX + BOUNDS.maxX) / 2, BOUNDS.minZ, PI);
      skirt(cd, BOUNDS.maxX, (BOUNDS.minZ + BOUNDS.maxZ) / 2, PI / 2);
      skirt(cd, BOUNDS.minX, (BOUNDS.minZ + BOUNDS.maxZ) / 2, -PI / 2);
    }

    // ---- the volcano: a heightfield of papier-mache. Distance to the terrace road on a 1-unit grid first.
    const GX0 = -70, GZ0 = -74, GW = 141, GH = 125;
    const RD = new Float32Array(GW * GH).fill(99), RS = new Float32Array(GW * GH), RLAT = new Float32Array(GW * GH);
    for (let i = 0; i < track.N; i++) {
      const s = i * track.ds;
      if (sRel(s, SA - 30) > 2 * RAMP + arcLen + 60) continue;
      const x = track.x[i], z = track.z[i], nx = -track.tz[i], nz = track.tx[i], R = 22;
      const gx0 = Math.max(0, Math.floor(x - R - GX0)), gx1 = Math.min(GW - 1, Math.ceil(x + R - GX0));
      const gz0 = Math.max(0, Math.floor(z - R - GZ0)), gz1 = Math.min(GH - 1, Math.ceil(z + R - GZ0));
      for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
        const dx = gx + GX0 - x, dz = gz + GZ0 - z, d = Math.hypot(dx, dz), k = gz * GW + gx;
        if (d >= RD[k]) continue;
        RD[k] = d; RS[k] = s; RLAT[k] = dx * nx + dz * nz;
      }
    }
    const gridAt = (F, x, z, def) => {
      const gx = x - GX0, gz = z - GZ0;
      if (gx < 0 || gz < 0 || gx >= GW - 1 || gz >= GH - 1) return def;
      const x0 = gx | 0, z0 = gz | 0, fx = gx - x0, fz = gz - z0, k = z0 * GW + x0;
      return (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fz) + (F[k + GW] * (1 - fx) + F[k + GW + 1] * fx) * fz;
    };
    const gridN = (F, x, z, def) => {
      const gx = Math.round(x - GX0), gz = Math.round(z - GZ0);
      if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return def;
      return F[gz * GW + gx];
    };
    // grooves down the cone: the surge channel (dry crust between eruptions) and the river gully
    const groove = (x, z, th, hw) => {
      const dx = x - C.x, dz = z - C.z, ca = Math.cos(th), sa = Math.sin(th);
      const along = dx * ca + dz * sa, perp = -dx * sa + dz * ca;
      if (along < 6) return { k: 0, along };
      return { k: 1 - ss(hw - 1.1, hw + 0.7, Math.abs(perp)), along };
    };
    // paint streaks the young volcanologist dribbled down from the rim (angle, length, half-width, wiggle)
    const STREAKS = [], CRUST = [];
    {
      const rr = K.rng(555);
      for (let i = 0; i < 12; i++) STREAKS.push({ th: (i / 12) * TAU + rr() * 0.4, len: 9 + rr() * 17, w: 0.8 + rr() * 1.3, wig: rr() * 6 });
      for (let i = 0; i < 7; i++) CRUST.push({ th: rr() * TAU, len: 6 + rr() * 12, w: 0.9 + rr() * 1.2, wig: rr() * 6 });
    }
    const streakAt = (r, th, list) => {
      let k = 0;
      for (const st of list) {
        const rr = r - CONE.rim - 1.2;
        if (rr < 0 || rr > st.len + 1.5) continue;
        let d = th - st.th - 0.07 * Math.sin(r * 0.45 + st.wig);
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const lat = Math.abs(d) * r, f = rr / st.len;
        const w = st.w * (1 - 0.45 * f) + (f > 0.85 ? 0.5 * Math.sin(PI * Math.min(1, (f - 0.85) / 0.25)) : 0);
        k = Math.max(k, (1 - ss(w - 0.35, w + 0.3, lat)) * (1 - ss(st.len, st.len + 1.2, rr)));
      }
      return k;
    };
    // terrain height: the cone, the road cut into it, the skirt of the raised road with its rock-wall shelf, the grooves
    const terrain = (x, z) => {
      const r = Math.hypot(x - C.x, z - C.z), th = Math.atan2(z - C.z, x - C.x);
      const fur = Math.abs(Math.sin(th * 13 + n1(r * 0.35, th * 5, 1) * 4));
      const relief = ((fur - 0.6) * 1.7 * ss(11, 17, r) * ss(37, 27, r) + (n1(x, z, 1.3) - 0.5) * 2.4 + (n2(x, z, 2.6) - 0.5) * 0.9) * ss(CONE.foot, 32, r) * ss(4, 11, r);
      let h = coneH(r) + relief - 0.32 * ss(37, 45, r);
      const d = gridAt(RD, x, z, 99);
      let road = null;
      if (d < 22) {
        const s = gridN(RS, x, z, 0), y0 = roadY(s), hw = W / 2;
        if (onTerrace(s) || sRel(s, SA - 6) < 6) {
          const e = d - hw;
          if (e <= 0.2) road = y0 - 0.1;
          else {
            const sk = e < 3.2 ? y0 + 0.05 : y0 + 0.05 - (e - 3.2) * 1.3 + (n1(x, z, 2.2) - 0.5) * 0.7 * ss(3.2, 5, e);
            const cone = r < RW ? lerp(y0 + 0.1, h, ss(0.2, 2.8, e)) : h;
            h = Math.max(cone, sk);
          }
        } else if (d <= hw + 1) h = Math.min(h, -0.3);
      }
      if (road != null) h = road;
      // the river gully: a deep groove down the cone, under the terrace bridge and down the skirt
      const gv = groove(x, z, RIV_TH, RIV.hw + 0.4);
      if (gv.k > 0 && gv.along < 60) {
        const fl = gv.along < 31.5 ? coneH(gv.along) - 2.2 : gv.along < 49 ? 1.2 : Math.max(0.25, 1.2 - (gv.along - 49) * 0.12);
        h = lerp(h, Math.min(h, fl), gv.k);
      }
      // the surge channel: a shallower groove on the cone and the skirt (the road crosses it flat)
      const cv = groove(x, z, PI / 2, CH.hw + 0.3);
      if (cv.k > 0 && road == null && cv.along < 60) {
        const fl = cv.along < 31.5 ? coneH(cv.along) - 1.3 : Math.max(0.1, h - 0.9);
        h = lerp(h, Math.min(h, fl), cv.k);
      }
      return Math.max(h, -0.25);
    };
    A.terrain = terrain;
    // its paint: basalt grey at the top, brown flanks, a green-painted foot, red lava paint and old pink foam crust
    const cBase = new T.Color(0x6e5848), cMid = new T.Color(0x56463d), cDark = new T.Color(0x3a302c), cInner = new T.Color(0x1e1714), cGreen = new T.Color(0x5d7f34),
      cPaint = new T.Color(0xc8321a), cPaint2 = new T.Color(0xe8701c), cCrust = new T.Color(0xc89a8c), cRock = new T.Color(0x7a6c60), cc = new T.Color();
    const colorAt = (x, z, h) => {
      const rr = Math.hypot(x - C.x, z - C.z), th = Math.atan2(z - C.z, x - C.x);
      const nn = n1(x, z, 2.2), dRd = gridAt(RD, x, z, 99) - W / 2;
      cc.copy(cBase).lerp(cMid, ss(32, 20, rr)).lerp(cDark, ss(22, 11, rr) * 0.85).lerp(cInner, ss(CONE.rim + 0.8, CONE.rim - 1.5, rr));
      // the skirt below the terrace and the foot: rockier, then painted grass at the bottom
      if (dRd > 3 && dRd < 22 && rr > 30) cc.lerp(cRock, 0.5);
      cc.lerp(cGreen, (h < 2.2 ? ss(2.2, 0.6, h) : 0) * (rr > 36 ? 0.85 : 0));
      cc.multiplyScalar(0.78 + nn * 0.42);
      const pk = streakAt(rr, th, STREAKS);
      if (pk > 0) cc.lerp(n2(x, z, 4) > 0.5 ? cPaint : cPaint2, pk * 0.85);
      const ck = Math.max(streakAt(rr, th, CRUST) * 0.8, (() => { const cv = groove(x, z, PI / 2, CH.hw + 0.3); return cv.k > 0 && cv.along < 58 ? cv.k * 0.75 : 0; })());
      if (ck > 0) cc.lerp(cCrust, ck * (0.45 + 0.2 * nn));
      return cc;
    };
    {
      const step = 0.8, x0 = -66, x1 = 66, z0 = -72, z1 = 44;
      const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
      const pos = new Float32Array((nx + 1) * (nz + 1) * 3), col = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
      const hs = new Float32Array((nx + 1) * (nz + 1));
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = x0 + i * step, z = z0 + j * step, k = j * (nx + 1) + i;
        const h = terrain(x, z);
        hs[k] = h;
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        uv[k * 2] = x / 14; uv[k * 2 + 1] = -z / 14;
        const c = colorAt(x, z, h);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      const idx = [];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        if (hs[a] < -0.2 && hs[b] < -0.2 && hs[c] < -0.2 && hs[d] < -0.2) continue;
        idx.push(a, c, b, b, c, d);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // papier-mache: torn newspaper strips under the paint (rasterised straight into a tileable height field)
      const hh = new Float32Array(512 * 512).fill(0.5);
      {
        const rr = K.rng(791);
        for (let i = 0; i < 260; i++) {
          const cx = rr() * 512, cy = rr() * 512, a = rr() * PI, l = 40 + rr() * 90, t = 14 + rr() * 26, v = (100 + rr() * 80) / 255;
          const ca = Math.cos(a), sa = Math.sin(a), ex = Math.abs(ca) * l / 2 + Math.abs(sa) * t / 2 + 3, ey = Math.abs(sa) * l / 2 + Math.abs(ca) * t / 2 + 3;
          const j1 = rr() * 9, j2 = rr() * 9;
          for (let y = Math.floor(cy - ey); y <= cy + ey; y++) for (let x = Math.floor(cx - ex); x <= cx + ex; x++) {
            const dx = x - cx, dy = y - cy, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
            if (Math.abs(lx) > l / 2) continue;
            const jag = (Math.sin(lx * 0.9 + j1) + Math.sin(lx * 2.3 + j2)) * 1.0;
            if (Math.abs(ly) > t / 2 + jag) continue;
            hh[((y & 511) << 9) + (x & 511)] = v;
          }
        }
        for (let i = 0; i < hh.length; i++) hh[i] += (NF[(i & 255) + ((i >> 9) & 255) * 256] - 0.5) * 0.3;
      }
      const pmN = tex(TX.normalFromHeight(hh, 512, 512, 3), [1, 1], true, false);
      const volMat = K.phys({ vertexColors: true, roughness: 0.82, normalMap: pmN, normalScale: V2(0.7), sheen: 0.2, sheenColor: new T.Color(0xffe0c0) });
      const vm = new T.Mesh(g, volMat); vm.castShadow = true; vm.receiveShadow = true;
      K.group.add(vm);
      A.volMat = volMat;
    }
    // curbs: an exact strip along both edges of the raised road, from the road edge up onto the terrain (hides the
    // grid's steps where the cone meets the road)
    {
      const pos = [], col = [], uvs = [], idx = [], offs = [-0.05, 0.6, 1.4, 2.4, 3.4];
      let row = 0;
      const gapA = sBr1 - RIV.hw - 0.4, gapB = sBr1 + RIV.hw + 0.4;
      for (const side of [-1, 1]) {
        let prev = false;
        for (let s = SA - 3; s <= SD + 3; s += 0.7) {
          const inGap = s > gapA && s < gapB;
          if (inGap) { prev = false; continue; }
          const p = track.at(s), y0 = roadY(s), hw = W / 2;
          for (let j = 0; j < offs.length; j++) {
            const o = side * (hw + offs[j]), x = p.x + p.nx * o, z = p.z + p.nz * o;
            const y = j === 0 ? y0 + 0.07 : Math.max(terrain(x, z), y0 - 3) + 0.04;
            pos.push(x, y, z); uvs.push(x / 14, -z / 14);
            const c = colorAt(x, z, y); col.push(c.r, c.g, c.b);
          }
          if (prev) for (let j = 0; j < offs.length - 1; j++) {
            const a0 = (row - 1) * offs.length + j, a1 = a0 + 1, b0 = row * offs.length + j, b1 = b0 + 1;
            if (side > 0) idx.push(a0, b0, a1, a1, b0, b1); else idx.push(a0, a1, b0, a1, b1, b0);
          }
          prev = true; row++;
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, A.volMat); m.receiveShadow = true; m.castShadow = true; K.group.add(m);
    }

    // ---- the road: black craft paper with chalk edge lines and a dashed centre line
    const roadTex = (() => {
      const c = TX.paint(256, 512, (x, y, u, v, o) => {
        const fib = n1(x * 3, y * 0.6, 1) * 0.5 + n2(x, y, 2) * 0.5;
        const k = 38 + fib * 22;
        let rr = k, gg = k, bb = k + 4;
        if (u < 0.045 || u > 0.955) { const e = 205 + fib * 40; rr = e; gg = e; bb = e - 6; }
        if (Math.abs(u - 0.5) < 0.016 && (v * 4) % 1 < 0.55) { rr = 240; gg = 196; bb = 40; }
        o[0] = rr; o[1] = gg; o[2] = bb;
      });
      return tex(c, [1, 1]);
    })();
    const roadMat = K.std({ map: roadTex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1 });
    const strip = (s0, s1, off, wid, yOff = 0.06, step = 1, vScale = 30) => {
      const n = Math.max(2, Math.ceil((s1 - s0) / step));
      const pos = [], uvs = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n, p = track.at(s), y = roadY(s) + yOff;
        for (let k = 0; k < 2; k++) {
          const o = off + (k - 0.5) * wid;
          pos.push(p.x + p.nx * o, y, p.z + p.nz * o); uvs.push(k, s / vScale);
        }
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      return g;
    };
    {
      // the paper road, cut where the river gully passes under the terrace bridge
      const gap = RIV.hw + 0.6;
      const pieces = [[0, sBr1 - gap], [sBr1 + gap, L]];
      for (const [a, b] of pieces) { const m = new T.Mesh(strip(a, b, 0, W, 0.06, 1), roadMat); m.receiveShadow = true; K.group.add(m); }
      const sC = canvas(256, 32, (g) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#141416' : '#f5f2ea'; g.fillRect(x * 16, y * 16, 16, 16); } });
      const p = track.at(30);
      const sl = K.mesh(new T.PlaneGeometry(W - 0.4, 2.8), K.std({ map: tex(sC, [1, 1], false), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }), p.x, 0.09, p.z, { cast: false });
      sl.rotation.order = 'YXZ'; sl.rotation.y = -p.angle + PI / 2; sl.rotation.x = -PI / 2;
    }

    // ---- rock walls (instanced papier-mache lumps)
    const rockMat = K.phys({ roughness: 0.82, normalMap: tex(TX.normalFromHeight(NF, 256, 256, 4), [1, 1], true, false), normalScale: V2(0.8) });
    const rockGeo = (() => { const g = new T.IcosahedronGeometry(1, 1); const p = g.attributes.position; const rr = K.rng(17); for (let i = 0; i < p.count; i++) { const k = 0.82 + rr() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
    {
      const rocks = [];
      const gapAt = [{ s: A.cross[0].s, w: CH.hw + 0.8 }, { s: sBr1, w: RIV.hw + 0.8 }];
      const wallVis = (side, s0, s1) => {
        for (let s = s0; s < s1; s += 1.6) {
          if (side < 0 && gapAt.some((g) => Math.abs(s - g.s) < g.w)) continue;
          const q = track.place(s + r.range(-0.3, 0.3), side * (W / 2 + 1.5 + r.range(-0.3, 0.5))), y = roadY(s);
          const sc = r.range(1.1, 1.8), v = r.range(0.75, 1.15);
          rocks.push({ x: q.x, y: y + sc * 0.55, z: q.z, rx: r() * 6, ry: r() * 6, rz: r() * 6, sx: sc * r.range(0.9, 1.3), sy: sc * r.range(0.8, 1.1), sz: sc, color: new T.Color(0x8a7b6e).multiplyScalar(v).getHex() });
        }
      };
      wallVis(-1, SA, SD);
      wallVis(1, SA, SB + 3);
      wallVis(1, SC - 3, SD);
      K.instances(rockGeo, rockMat, rocks, { colors: true });
    }

    // ---- foam: red-orange bubbly baking-soda-and-vinegar lava
    const bubbleTex = (() => {
      const S = 256, h = new Float32Array(S * S);
      const rr = K.rng(4242);
      const col = canvas(S, S, (g) => {
        g.fillStyle = '#f0400f'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 420; i++) {
          const x = rr() * S, y = rr() * S, rad = 2 + rr() * rr() * 14;
          for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
            const gr = g.createRadialGradient(x + ox - rad * 0.3, y + oy - rad * 0.3, rad * 0.1, x + ox, y + oy, rad);
            gr.addColorStop(0, 'rgba(255,190,150,0.55)'); gr.addColorStop(0.3, 'rgba(255,110,50,0.3)'); gr.addColorStop(0.85, 'rgba(160,18,6,0.5)'); gr.addColorStop(1, 'rgba(160,18,6,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, rad, 0, TAU); g.fill();
          }
          const ix = x | 0, iy = y | 0, ir = Math.ceil(rad);
          for (let yy = -ir; yy <= ir; yy++) for (let xx = -ir; xx <= ir; xx++) {
            const d = Math.hypot(xx, yy) / rad;
            if (d < 1) { const k = (((iy + yy) % S) + S) % S * S + ((((ix + xx) % S) + S) % S); h[k] = Math.max(h[k], Math.sqrt(1 - d * d) * (0.4 + rad / 20)); }
          }
        }
      });
      return { map: tex(col, [1, 1]), normalMap: tex(TX.normalFromHeight(h, S, S, 3.5), [1, 1], true, false) };
    })();
    const foamParams = { map: bubbleTex.map, normalMap: bubbleTex.normalMap, normalScale: V2(1.0), roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.18, emissive: new T.Color(0xff2200), emissiveIntensity: 0.3, sheen: 0.25, sheenColor: new T.Color(0xff9a70) };
    const foamMat = K.phys({ ...foamParams });
    A.foamMat = foamMat;

    // a domed foam ribbon along a path: cross-section raised in the middle; attributes aAlong (distance) and aLat (-1..1)
    const foamRibbon = (path, a0, a1, hw, yAt, thick = 0.7, step = 0.6) => {
      const n = Math.max(2, Math.ceil((a1 - a0) / step)), cols = 7;
      const pos = [], uvs = [], al = [], la = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n, q = path.at(a), nx = -q.tz, nz = q.tx;
        for (let j = 0; j < cols; j++) {
          const l = (j / (cols - 1)) * 2 - 1, wob = 1 + 0.12 * Math.sin(a * 0.7 + j) * (Math.abs(l) > 0.6 ? 1 : 0);
          const x = q.x + nx * l * hw * wob, z = q.z + nz * l * hw * wob;
          pos.push(x, yAt(x, z, a) + thick * Math.sqrt(Math.max(0, 1 - l * l)) + 0.04, z);
          uvs.push((l * hw) / 10, a / 10); al.push(a); la.push(l);
        }
        if (i < n) for (let j = 0; j < cols - 1; j++) { const p0 = i * cols + j, p1 = p0 + 1, p2 = p0 + cols, p3 = p2 + 1; idx.push(p0, p1, p2, p1, p3, p2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.setAttribute('aAlong', new T.Float32BufferAttribute(al, 1));
      g.setAttribute('aLat', new T.Float32BufferAttribute(la, 1));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    // the surge: a foam ribbon down the channel, drawn only between the tail and the front of the current surge
    {
      const mat = K.phys({ ...foamParams, emissiveIntensity: 0.45 });
      const U = { uFront: { value: -10 }, uTail: { value: -10 }, uTime: { value: 0 } };
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = 'attribute float aAlong; attribute float aLat; varying float vAlong; varying float vLat; uniform float uFront; uniform float uTime;\n' +
          sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = aAlong; vLat = aLat;\ntransformed.y += 0.55 * smoothstep(uFront - 7.0, uFront - 1.5, aAlong) * (1.0 - aLat * aLat) * step(aAlong, uFront + 1.0);\n#ifdef USE_MAP\nvMapUv.y -= uTime * 0.35;\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv.y -= uTime * 0.35;\n#endif');
        sh.fragmentShader = 'varying float vAlong; varying float vLat; uniform float uFront; uniform float uTail;\n' +
          sh.fragmentShader.replace('void main() {', 'void main() {\nif (vAlong > uFront - 1.6 * vLat * vLat || vAlong < uTail + 1.2 * vLat * vLat) discard;');
      };
      const yAt = (x, z, a) => {
        const rr = Math.hypot(x - C.x, z - C.z);
        if (a < 24.5) return coneH(a + 7.5) - 1.3;
        const s = track.distTo(x, z);
        if (s.dist < W / 2 + 0.5) return roadY(s.s) + 0.05;
        return rr < 56 ? Math.max(0.05, terrain(x, z)) : 0.05;
      };
      const g = foamRibbon(chPath, 0, chPath.len, CH.hw, yAt, 0.75, 0.6);
      const m = new T.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
      K.group.add(m);
      A.surge = { mat, U, mesh: m };
      // the dry crust of earlier surges on the road and across the table
      const crust = canvas(128, 256, (cg, w, h) => {
        cg.clearRect(0, 0, w, h);
        const rr = K.rng(99);
        for (let i = 0; i < 520; i++) {
          const x = w / 2 + (rr() - 0.5) * w * (0.55 + 0.4 * rr()), y = rr() * h, rad = 1 + rr() * 5;
          cg.fillStyle = `rgba(${230 + rr() * 25 | 0},${150 + rr() * 60 | 0},${140 + rr() * 50 | 0},${0.25 + rr() * 0.4})`;
          cg.beginPath(); cg.arc(x, y, rad, 0, TAU); cg.fill();
        }
      });
      const crustMat = K.std({ map: tex(crust, [1, 1]), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 });
      const cg = foamRibbon(chPath, CH.aCone - 1, chPath.len, CH.hw + 0.6, (x, z, a) => yAt(x, z, a) + 0.03, 0, 1.0);
      const cm = new T.Mesh(cg, crustMat); cm.renderOrder = 1; K.group.add(cm);
    }
    // the permanent river: flowing foam in the gully and across the table, off the table edge
    {
      const mat = K.phys({ ...foamParams, map: bubbleTex.map.clone(), normalMap: bubbleTex.normalMap.clone(), emissiveIntensity: 0.4 });
      mat.map.needsUpdate = true; mat.normalMap.needsUpdate = true;
      const yAt = (x, z, a) => {
        const rr = Math.hypot(x - C.x, z - C.z);
        if (rr < 31.5) return coneH(rr) - 2.2;
        if (rr < 49) return 1.2;
        if (rr < 58) return Math.max(0.25, 1.2 - (rr - 49) * 0.12);
        return 0.05;
      };
      const g = foamRibbon(rivPath, 0, rivPath.len - 6, RIV.hw, yAt, 0.55, 0.7);
      const m = new T.Mesh(g, mat); m.receiveShadow = true; K.group.add(m);
      A.river = { mat };
      // dripping over the west edge of the table down the cloth
      const q = rivPath.at(rivPath.len - 6);
      K.mesh(new T.PlaneGeometry(RIV.hw * 2.2, 26, 1, 8), mat, BOUNDS.minX - 0.6, -13, q.z, { ry: -PI / 2, cast: false });
    }
    // ---- bridges: craft sticks laid across, two stringers underneath
    {
      const stickMat = K.std({ vertexColors: true, roughness: 0.75, map: tex(TX.paint(64, 256, (x, y, u, v, o) => { const g = n1(x * 0.3, y * 2, 1); const k = 0.88 + g * 0.18; o[0] = 236 * k; o[1] = 208 * k; o[2] = 158 * k; }), [1, 1]) });
      const stick = rbox(1.0, 0.22, 11.4, 0.1, 1);
      const bridge = (x, z, y, ang, len) => {
        const c = Math.cos(ang), s = Math.sin(ang), n = Math.round(len / 1.05);
        for (let i = 0; i < n; i++) {
          const a = (i - (n - 1) / 2) * 1.05;
          put(stick, 0xffffff, { x: x + c * a, y: y + 0.12, z: z + s * a, ry: -ang + r.range(-0.03, 0.03) }, stickMat, true);
        }
        for (const sd of [-1, 1]) put(rbox(len + 1.5, 0.9, 1.0, 0.1, 1), 0xd9bd86, { x: x - s * sd * 4.6, y: y - 0.35, z: z + c * sd * 4.6, ry: -ang }, stickMat, true);
      };
      const p1 = track.at(sBr1);
      bridge(p1.x, p1.z, HT, p1.angle, RIV.hw * 2 + 2.4);
      const p2 = track.at(br2.s);
      bridge(p2.x, p2.z, 0.48, p2.angle, 10.4);
    }
    // ---- wet foam left on a crossing while it is sticky
    for (const cr of A.cross) {
      const mat = K.phys({ ...foamParams, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
      const m = K.mesh(new T.PlaneGeometry(2 * (W / 2 + 1.1), 2 * (CH.hw + 0.4)), mat, cr.x, cr.y + 0.12, cr.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.set(-PI / 2, -cr.ang, 0);
      m.visible = false;
      cr.residue = m;
    }
    // ---- the crossings: red beacons on craft-stick posts either side, and a warning card
    {
      const list = [], postMat = K.std({ vertexColors: true, roughness: 0.7 });
      for (const cr of A.cross) {
        for (const sd of [-1, 1]) {
          const q = track.place(cr.s - CH.hw - 1.5, sd * (W / 2 + 1.0));
          list.push({ x: q.x, y: cr.y, z: q.z });
          put(cyl(0.35, 0.35, 3.0, 6), 0xe7cf9c, { x: q.x, y: cr.y + 1.5, z: q.z }, postMat, true);
          put(cyl(0.75, 0.95, 0.6, 12), 0x26262a, { x: q.x, y: cr.y + 3.1, z: q.z }, postMat, true);
        }
      }
      const bulbMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const bulbs = K.instances(sph(0.95, 14, 10), bulbMat, list.map((l) => ({ x: l.x, y: l.y + 3.7, z: l.z, color: 0x401010 })), { cast: false, colors: true });
      const hc = canvas(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const haloMat = new T.MeshBasicMaterial({ map: tex(hc, [1, 1], false), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      const halos = K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), haloMat, list.map((l) => ({ x: l.x, y: l.y + 0.25, z: l.z, s: 11, color: 0x000000 })), { cast: false, receive: false, colors: true });
      halos.renderOrder = 4;
      A.beacons = { bulbs, halos, list };
    }

    // ---- crater: the bottle neck, the foam pool, the eruption column, the crater light
    {
      put(new T.TorusGeometry(3.1, 0.55, 10, 28).rotateX(PI / 2), 0xd8f0e0, { x: C.x, y: CONE.floor + 0.3, z: C.z }, K.glass(0xcfe8d8, 0.5, { depthWrite: true, transparent: false }), false);
      const pool = K.mesh(new T.CircleGeometry(CONE.rim - 0.6, 40), K.phys({ ...foamParams, emissiveIntensity: 0.6 }), C.x, CONE.floor + 1.2, C.z, { rx: -PI / 2, cast: false });
      const colN = 16;
      const col = K.instances(sph(1, 18, 12), foamMat, Array.from({ length: colN }, () => ({ x: C.x, y: CONE.floor, z: C.z, s: 0.001 })), { cast: true });
      const overN = 14;
      const over = K.instances(sph(1, 16, 10), foamMat, Array.from({ length: overN }, () => ({ x: C.x, y: CONE.floor, z: C.z, s: 0.001 })), { cast: true });
      col.frustumCulled = false; over.frustumCulled = false;
      const light = new T.PointLight(0xff6a2a, 0, 0, 2); light.position.set(C.x, CONE.rimH + 8, C.z); K.group.add(light);
      A.crater = { pool, col, colN, over, overN, light };
    }
    // ---- bombs: flying blobs, ground marks, splats
    {
      const blob = K.instances(sph(1.7, 18, 12), foamMat, Array.from({ length: BOMB.n }, () => ({ x: 0, y: -50, z: 0, s: 0.001 })), { cast: true });
      blob.frustumCulled = false;
      const ring = canvas(128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const cx = w / 2;
        g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cx, cx - 6, 0, TAU); g.stroke();
        g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.arc(cx, cx, cx * 0.62, 0, TAU); g.stroke(); g.setLineDash([]);
        const gr = g.createRadialGradient(cx, cx, 0, cx, cx, cx); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, cx - 8, 0, TAU); g.fill();
      });
      const markMat = new T.MeshBasicMaterial({ map: tex(ring, [1, 1], false), transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, toneMapped: false });
      const marks = K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), markMat, Array.from({ length: BOMB.n }, () => ({ x: 0, y: -50, z: 0, s: 0.001, color: 0x000000 })), { cast: false, receive: false, colors: true });
      marks.frustumCulled = false; marks.renderOrder = 5;
      const shadows = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), contactMat, BOMB.n);
      shadows.frustumCulled = false; shadows.renderOrder = 2; K.group.add(shadows);
      const splat = K.instances(new T.SphereGeometry(1, 20, 10, 0, TAU, 0, PI / 2), foamMat, Array.from({ length: BOMB.n }, () => ({ x: 0, y: -50, z: 0, s: 0.001 })), { cast: false });
      splat.frustumCulled = false;
      A.bombVis = { blob, marks, shadows, splat };
    }
    // ---- boulders, their caves on the slope and the foam ponds they roll into
    {
      const bg = new T.IcosahedronGeometry(ROCK.R, 2); const p = bg.attributes.position; const rr = K.rng(31);
      for (let i = 0; i < p.count; i++) { const v = _v.set(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + (n1(v.x * 3 + 40, v.y * 3 + v.z * 2, 1) - 0.5) * 0.45 + (rr() - 0.5) * 0.06; p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
      bg.computeVertexNormals();
      const bm = K.phys({ color: 0x7d7064, roughness: 0.85, normalMap: rockMat.normalMap, normalScale: V2(1.2) });
      for (const rk of A.rocks) {
        const m = K.mesh(bg, bm, rk.ca * ROCK.r0, -40, rk.sa * ROCK.r0);
        rk.mesh = m;
        const sh = K.contact(0, 0, ROCK.R * 1.2, ROCK.R * 1.2, 0.5); rk.shadow = sh;
        // the cave the boulder comes out of
        const cx = C.x + rk.ca * (ROCK.r0 - 1.5), cz = C.z + rk.sa * (ROCK.r0 - 1.5), cy = terrain(cx, cz);
        const cave = K.mesh(new T.CircleGeometry(ROCK.R * 1.25, 20), K.std({ color: 0x120c0a, roughness: 1 }), cx, cy + 1.2, cz, { cast: false });
        cave.lookAt(C.x + rk.ca * 80, cy - 30, C.z + rk.sa * 80);
        // the pond at the bottom
        const px = C.x + rk.ca * ROCK.pond, pz = C.z + rk.sa * ROCK.pond;
        K.spill(px, pz, 6.5, foamMat, { lump: 0.3, y: 0.55, thick: 0.5 });
        for (let i = 0; i < 6; i++) { const a = r() * TAU, d = 6 + r() * 2.5; put(sph(r.range(0.8, 1.6), 10, 8), 0xffffff, { x: px + Math.cos(a) * d, y: 0.2, z: pz + Math.sin(a) * d, sy: 0.6 }, foamMat, false); }
      }
    }
    // ---- spills: vinegar (slick) and foam puddles (sticky)
    {
      const vinegar = K.phys({ color: 0xe8e2c0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.8, depthWrite: false });
      for (const sl of slicks) { const sp = K.spill(sl.x, sl.z, sl.rad, vinegar, { lump: 0.3, stretch: sl.stretch, angle: sl.ang, y: 0.12, thick: 0.1 }); K.surface('slick', { poly: sp.poly }); }
      for (const pu of puddles) { const sp = K.spill(pu.x, pu.z, pu.rad, foamMat, { lump: 0.4, stretch: 1.3, angle: pu.ang, y: 0.3, thick: 0.3 }); K.surface('sticky', { poly: sp.poly }); }
    }

    // ============================================================ the science fair around the volcano
    const plasticV = K.phys({ vertexColors: true, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 });
    const matteV = K.std({ vertexColors: true, roughness: 0.85 });
    const metalV = K.metal(0xffffff, 0.3, { vertexColors: true });
    const glassM = K.glass(0xf4fbff, 0.2, { side: T.DoubleSide });
    const lathe = (prof, seg = 32) => K.lathe(prof, seg);
    const hand = '"Lilita One", Impact, sans-serif';
    const title = (g, txt, x, y, size, fill = '#e0401c') => { g.font = `${size}px ${hand}`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#1d1a18'; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y); };
    const note = (g, txt, x, y, size = 30, col = '#22324a', align = 'left') => { g.font = `${size}px "Rubik", sans-serif`; g.textAlign = align; g.fillStyle = col; g.fillText(txt, x, y); };
    // ---- the tri-fold poster board at the north edge
    {
      const H = 91, CW = 61, SW = 30.5, Z0 = BOUNDS.minZ + 12, ANG = 0.32;
      const board = (w, h, draw) => tex(canvas(w, h, (g) => { g.fillStyle = '#fbfaf4'; g.fillRect(0, 0, w, h); draw(g, w, h); }), [1, 1], false);
      const card = (g, x, y, w, h, col, rot = 0) => { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); };
      const centre = board(1024, 1536, (g, w, h) => {
        title(g, 'HOW VOLCANOES', w / 2, 150, 120); title(g, 'WORK!', w / 2, 280, 140, '#f08a1e');
        note(g, 'a science fair project by Maya R., Grade 5', w / 2, 340, 34, '#5a5048', 'center');
        // cross-section of a volcano
        g.save(); g.translate(w / 2, 900);
        const layer = (k, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(-420 + k * 20, 260); g.lineTo(-60 + k * 6, -300 + k * 40); g.lineTo(60 - k * 6, -300 + k * 40); g.lineTo(420 - k * 20, 260); g.closePath(); g.fill(); };
        layer(0, '#7a5a44'); layer(2, '#9a7454'); layer(4, '#6e503c'); layer(6, '#a88262');
        g.fillStyle = '#e8401a'; g.beginPath(); g.ellipse(0, 330, 230, 90, 0, 0, TAU); g.fill();
        g.fillRect(-26, -300, 52, 640);
        g.fillStyle = '#ffb030'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((i - 4) * 18, -330 - (i % 3) * 30, 26, 0, TAU); g.fill(); }
        g.strokeStyle = '#1d1a18'; g.lineWidth = 5; g.beginPath(); g.moveTo(-420, 260); g.lineTo(420, 260); g.stroke();
        const lab = (txt, x, y, tx, ty) => { g.strokeStyle = '#22324a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); note(g, txt, x + (x < 0 ? -10 : 10), y + 10, 34, '#22324a', x < 0 ? 'right' : 'left'); };
        lab('CRATER', 220, -380, 40, -310); lab('VENT', 230, -60, 30, -60); lab('MAGMA CHAMBER', -150, 470, -90, 360); lab('ASH + LAVA LAYERS', -250, -180, -170, -120);
        g.restore();
        note(g, 'baking soda + vinegar = CO2 gas + LOTS of foam!', w / 2, 1470, 36, '#c8321a', 'center');
      });
      const left = board(512, 1536, (g, w, h) => {
        title(g, 'MATERIALS', w / 2, 120, 70, '#2f6fe0');
        ['1 cup baking soda', '2 cups vinegar', 'red food colouring', 'a squirt of dish soap', 'papier-mache (LOTS)', '1 old soda bottle', 'safety goggles!'].forEach((t, i) => note(g, '- ' + t, 40, 210 + i * 56, 30));
        title(g, 'QUESTION', w / 2, 690, 64, '#2fae5a');
        ['What makes the', 'foam shoot out', 'of the top?'].forEach((t, i) => note(g, t, w / 2, 760 + i * 46, 32, '#22324a', 'center'));
        card(g, 70, 960, 180, 150, '#e7ddc8', -0.08); card(g, 270, 1000, 180, 150, '#e7ddc8', 0.07); card(g, 140, 1200, 220, 170, '#e7ddc8', -0.04);
        g.fillStyle = '#8a6a50'; g.beginPath(); g.moveTo(100, 1090); g.lineTo(160, 990); g.lineTo(220, 1090); g.fill();
        g.fillStyle = '#e8401a'; g.beginPath(); g.arc(160, 990, 18, 0, TAU); g.fill();
        g.fillStyle = '#d8c06a'; g.fillRect(300, 1040, 120, 70); g.fillStyle = '#2f6fe0'; g.fillRect(180, 1240, 140, 100);
      });
      const right = board(512, 1536, (g, w, h) => {
        title(g, 'RESULTS', w / 2, 120, 76, '#e0401c');
        note(g, 'foam height (cm)', w / 2, 180, 30, '#5a5048', 'center');
        g.strokeStyle = '#22324a'; g.lineWidth = 5; g.beginPath(); g.moveTo(70, 220); g.lineTo(70, 640); g.lineTo(470, 640); g.stroke();
        [180, 260, 330, 400].forEach((v, i) => { g.fillStyle = ['#f08a1e', '#e8401a', '#c8321a', '#8a1a12'][i]; g.fillRect(100 + i * 92, 640 - v, 64, v); note(g, 'test ' + (i + 1), 132 + i * 92, 680, 24, '#22324a', 'center'); });
        title(g, 'CONCLUSION', w / 2, 820, 60, '#2fae5a');
        ['More vinegar =', 'a BIGGER eruption.', 'Do not stand', 'too close!!'].forEach((t, i) => note(g, t, w / 2, 900 + i * 48, 32, '#22324a', 'center'));
        title(g, 'SAFETY FIRST', w / 2, 1180, 52, '#2f6fe0');
        g.strokeStyle = '#2f6fe0'; g.lineWidth = 10; g.beginPath(); g.ellipse(180, 1320, 70, 46, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(330, 1320, 70, 46, 0, 0, TAU); g.stroke();
      });
      const edge = K.std({ color: 0xeeeae0, roughness: 0.9 });
      const panel = (w, map, x, z, ry) => {
        put(box(w, H, 0.6), 0xeeeae0, { x, y: H / 2, z, ry }, matteV, true);
        const c = Math.cos(ry), sn = Math.sin(ry);
        K.mesh(new T.PlaneGeometry(w - 0.1, H - 0.1), K.std({ map, roughness: 0.88 }), x + sn * 0.31, H / 2, z + c * 0.31, { ry, cast: false });
      };
      panel(CW, centre, 0, Z0, 0);
      for (const sd of [-1, 1]) {
        const cx = sd * (CW / 2 + Math.cos(ANG) * SW / 2), cz = Z0 + Math.sin(ANG) * SW / 2;
        panel(SW, sd < 0 ? left : right, cx, cz, -sd * ANG);
        K.box(cx, cz, SW / 2, 0.6, sd * ANG, H, { solid: true });
      }
      K.box(0, Z0, CW / 2, 0.6, 0, H, { solid: true });
      AO(0, Z0 + 2, CW / 2 + 4, 3, 0.45);
      // the project number tent card in front of it
      const tc = tex(canvas(256, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, w, 24); note(g, 'PROJECT', w / 2, 62, 30, '#22324a', 'center'); title(g, '#27', w / 2, 116, 50, '#e0401c'); }), [1, 1], false);
      const tcm = K.std({ map: tc, roughness: 0.8 });
      for (const sd of [-1, 1]) K.mesh(new T.PlaneGeometry(10, 5), tcm, 46, 2.3, Z0 + 10 + sd * 1.2, { rx: sd * 0.5, ry: sd < 0 ? PI : 0 }).rotation.order = 'YXZ';
      AO(46, Z0 + 10, 6, 3, 0.35);
    }
    // ---- a roll of paper towels for the clean-up, behind the north-east straight
    {
      const x = 108, z = -92, ang = 0.15;
      const towel = K.std({ map: tex(TX.paint(256, 64, (px, py, u, v, o) => { const q = 0.92 + 0.08 * Math.sin(u * TAU * 24) + (Math.abs(((u * 6) % 1) - 0.5) < 0.012 ? -0.12 : 0); o[0] = 246 * q; o[1] = 244 * q; o[2] = 236 * q; }), [1, 1]), roughness: 0.95 });
      const roll = K.mesh(cyl(6, 6, 28, 36), [towel, K.std({ color: 0xf2f0e8, roughness: 0.95 }), K.std({ color: 0xf2f0e8, roughness: 0.95 })], x, 6, z, { rz: PI / 2, ry: ang });
      roll.rotation.order = 'YXZ'; roll.rotation.set(0, -ang, PI / 2);
      for (const sd of [-1, 1]) K.mesh(new T.RingGeometry(1.9, 2.3, 20), K.std({ color: 0xb08a5a, roughness: 0.8, side: T.DoubleSide }), x + Math.cos(ang) * sd * 14.02, 6, z + Math.sin(ang) * sd * 14.02, { ry: -ang + PI / 2 });
      K.capsule(x - Math.cos(ang) * 13, z - Math.sin(ang) * 13, x + Math.cos(ang) * 13, z + Math.sin(ang) * 13, 6, 12, { solid: true });
      AO(x, z, 15, 5, 0.45, ang);
      // a torn-off sheet with a pink foam stain
      const sheet = tex(canvas(128, 128, (g, w, h) => { g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(230,90,70,0.55)'; g.beginPath(); g.ellipse(70, 60, 34, 26, 0.4, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,40,30,0.5)'; g.beginPath(); g.ellipse(64, 66, 16, 12, 0.2, 0, TAU); g.fill(); }), [1, 1], false);
      K.mesh(new T.PlaneGeometry(22, 24), K.std({ map: sheet, roughness: 0.95 }), x - 30, 0.06, z + 2, { rx: -PI / 2, rz: 0.5, cast: false });
    }
    // ---- the first-prize rosette (it already won), lying in the infield by the start
    {
      const x = -46, z = 62, ang = 0.4;
      const ribbon = K.phys({ color: 0x1f4fc8, roughness: 0.35, sheen: 1, sheenColor: new T.Color(0x8fb0ff), sheenRoughness: 0.4 });
      const gold = tex(canvas(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#d89a1e'); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.strokeStyle = '#8a5a10'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 10, 0, TAU); g.stroke(); title(g, '1st', w / 2, 128, 86, '#1f4fc8'); g.font = '700 34px Rubik, sans-serif'; g.fillStyle = '#5a3a08'; g.textAlign = 'center'; g.fillText('PLACE', w / 2, 180); g.fillText('SCIENCE FAIR', w / 2, 222); }), [1, 1], false);
      const grp = new T.Group();
      const parts = [];
      for (const sd of [-1, 1]) {
        const tail = new T.Shape(); tail.moveTo(-1.8, 0); tail.lineTo(1.8, 0); tail.lineTo(2.1, -15); tail.lineTo(0, -12.5); tail.lineTo(-2.1, -15); tail.closePath();
        const tg = new T.ExtrudeGeometry(tail, { depth: 0.12, bevelEnabled: false }); tg.rotateX(-PI / 2);
        parts.push(prep(tg, null, mtx({ x: sd * 1.6, y: 0.08, z: 1, ry: sd * 0.28 })));
      }
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; parts.push(prep(rbox(2.6, 0.35, 2.0, 0.15, 1), null, mtx({ x: Math.cos(a) * 5.2, y: 0.4 + (i % 2) * 0.12, z: Math.sin(a) * 5.2, ry: -a, rz: 0.25, order: 'YZX' }))); }
      grp.add(new T.Mesh(BU.mergeGeometries(parts, false), ribbon));
      const disc = new T.Mesh(cyl(4.0, 4.0, 0.5, 40), [K.std({ color: 0xd8a02a, roughness: 0.4, metalness: 0.4 }), K.std({ map: gold, roughness: 0.4, metalness: 0.3 }), K.std({ color: 0xd8a02a })]);
      disc.position.y = 0.75; grp.add(disc);
      grp.position.set(x, 0, z); grp.rotation.y = ang;
      K.add(grp);
      AO(x, z, 8, 8, 0.3);
    }
    // ---- beakers, the measuring jug and the food colouring in the west infield
    {
      const gm = tex(canvas(256, 128, (g, w, hh) => { g.clearRect(0, 0, w, hh); g.fillStyle = '#ffffff'; g.font = '700 16px Rubik, sans-serif'; for (let i = 1; i < 6; i++) { const y = hh - i * 20; g.fillRect(20, y, i % 2 ? 26 : 40, 3); g.fillText(String(i * 50), 50, y + 6); } }), [1, 1], false);
      const gradMat = K.std({ map: gm, transparent: true, depthWrite: false, roughness: 0.5, side: T.DoubleSide });
      const beaker = (x, z, rad, h, liq, liqCol) => {
        K.mesh(lathe([[rad - 0.3, 0], [rad, 0.2], [rad, h], [rad + 0.35, h + 0.25], [rad - 0.1, h + 0.1], [rad - 0.15, 0.3], [0.01, 0.3]], 36), glassM, x, 0, z, { cast: false });
        if (liq > 0) K.mesh(cyl(rad - 0.2, rad - 0.2, liq, 30), K.liquid(liqCol, { transparent: true, opacity: 0.85 }), x, 0.3 + liq / 2, z);
        // white graduation marks
        K.mesh(cyl(rad + 0.02, rad + 0.02, h * 0.8, 30, true), gradMat, x, h * 0.45, z, { cast: false });
        K.circle(x, z, rad + 0.1, h + 0.3, { solid: true });
        AO(x, z, rad * 1.4, rad * 1.4, 0.3);
      };
      beaker(-104, -36, 3.6, 9.5, 5.2, 0xd01a10);
      beaker(-92, -44, 4.6, 12.5, 0, 0);
      beaker(-118, -26, 3.6, 9.5, 2.0, 0xf2eee0);
      // measuring jug (1 l): translucent plastic, handle, spout, red scale
      {
        const x = -122, z = -46, jug = K.phys({ color: 0xf6f8ff, roughness: 0.25, transmission: 0, transparent: true, opacity: 0.45, clearcoat: 0.6, side: T.DoubleSide, depthWrite: false });
        const prof = [[5.6, 0], [5.8, 0.3], [6.6, 15.5], [6.9, 16.2], [6.5, 16.1], [5.5, 0.6], [0.01, 0.5]];
        K.mesh(lathe(prof, 40), jug, x, 0, z, { cast: false });
        const handle = K.mesh(new T.TorusGeometry(4.4, 0.8, 10, 24, PI), jug, x - 7.2, 8.4, z, { rz: PI / 2, cast: false });
        handle.rotation.order = 'ZYX';
        const sc = tex(canvas(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#d42a1a'; g.font = '700 18px Rubik, sans-serif'; for (let i = 1; i <= 8; i++) { const y = h - i * 28; g.fillRect(100, y, i % 2 ? 24 : 40, 3); if (i % 2 === 0) g.fillText(String(i * 125), 146, y + 6); } }), [1, 1], false);
        K.mesh(cyl(6.3, 6.0, 13, 40, true), K.std({ map: sc, transparent: true, depthWrite: false, side: T.DoubleSide }), x, 7.6, z, { cast: false });
        K.mesh(cyl(5.9, 5.65, 5.5, 32), K.liquid(0xe63a12, { transparent: true, opacity: 0.9 }), x, 3.2, z);
        K.circle(x, z, 6.7, 17, { solid: true });
        AO(x, z, 9, 9, 0.35);
      }
      // food colouring: little dropper bottles and red drops on the cloth
      const dropMat = K.phys({ color: 0xc8120e, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 });
      [[-96, -30, 0xd8140e], [-93, -31.5, 0xf0c010], [-95, -27, 0x1f8a2a]].forEach(([x, z, c]) => {
        put(lathe([[1.4, 0], [1.4, 3.8], [1.0, 4.6], [0.5, 5], [0.01, 5]], 16), c, { x, z }, plasticV, true);
        put(new T.ConeGeometry(0.55, 2.4, 12), 0xf4f4f0, { x, y: 6.1, z }, plasticV, true);
        AO(x, z, 2, 2, 0.4);
      });
      for (let i = 0; i < 14; i++) { const x = -97 + r.range(-6, 9), z = -30 + r.range(-5, 8); K.spill(x, z, r.range(0.4, 1.1), dropMat, { y: 0.08, thick: 0.1, n: 14 }); }
    }
    // ---- the tipped vinegar bottle at the south-east corner (its vinegar is the slick)
    {
      const q = track.place(224, 18.5), m0 = track.place(197, 14.5), ang = Math.atan2(m0.z - q.z, m0.x - q.x), c = Math.cos(ang), s = Math.sin(ang);
      const pet = K.phys({ color: 0xf2f6f4, roughness: 0.12, transparent: true, opacity: 0.35, clearcoat: 1, side: T.DoubleSide, depthWrite: false });
      const prof = [[4.2, 0], [4.4, 0.6], [4.4, 18], [3.6, 21.5], [1.7, 24.5], [1.5, 26.5], [1.9, 26.7], [1.5, 27.2]];
      const grp = new T.Group();
      const body = new T.Mesh(lathe(prof, 36), pet); grp.add(body);
      const lbl = tex(canvas(512, 256, (g, w, h) => { g.fillStyle = '#f7f1dc'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a8a3a'; g.fillRect(0, 0, w, 40); g.fillRect(0, h - 40, w, 40); g.font = `92px ${hand}`; g.textAlign = 'center'; g.fillStyle = '#2a8a3a'; g.fillText('ZING!', w / 2, 140); g.font = '700 32px Rubik, sans-serif'; g.fillStyle = '#3a3a30'; g.fillText('WHITE VINEGAR  5%', w / 2, 192); }), [1, 1], false);
      const lab = new T.Mesh(cyl(4.46, 4.46, 9, 36, true), K.std({ map: lbl, roughness: 0.6 })); lab.position.y = 9.5; grp.add(lab);
      const liq = new T.Mesh(new T.BoxGeometry(5.2, 1.6, 17), K.liquid(0xefeadb, { transparent: true, opacity: 0.6 })); liq.position.set(0, 9, 0); liq.rotation.x = PI / 2; grp.add(liq);
      grp.rotation.order = 'YZX'; grp.rotation.set(0, -ang, -PI / 2);
      grp.position.set(q.x, 4.4, q.z);
      K.add(grp);
      const cq = track.place(186, 17), vin = K.phys({ color: 0xe8e2c0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.8, depthWrite: false });
      const cap = K.mesh(cyl(1.9, 1.9, 1.6, 20), K.plastic(0x2a8a3a, 0.4), cq.x, 0.8, cq.z);
      const mq = track.place(197, 11.2); K.spill(mq.x, mq.z, 3.2, vin, { lump: 0.3, stretch: 1.4, angle: mq.angle, y: 0.1, thick: 0.08 });
      cap.rotation.x = PI / 2 * 0.95;
      K.capsule(q.x + c * 1, q.z + s * 1, q.x + c * 22, q.z + s * 22, 4.4, 8.8, { solid: true });
      AO(q.x + c * 12, q.z + s * 12, 15, 5.5, 0.4, ang);
    }
    // ---- the baking-soda box, opened, in the north-east pocket
    {
      const x = 86, z = -38, ang = 0.35;
      const face = (w, h, draw) => K.std({ map: tex(canvas(w, h, draw), [1, 1], false), roughness: 0.75 });
      const front = face(256, 384, (g, w, h) => { g.fillStyle = '#f5c428'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8401a'; g.fillRect(0, 0, w, 70); g.font = `64px ${hand}`; g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.fillText('FIZZ-O', w / 2, 56); g.fillStyle = '#2a2a6a'; g.font = '700 34px Rubik, sans-serif'; g.fillText('BAKING', w / 2, 150); g.fillText('SODA', w / 2, 190); g.beginPath(); g.fillStyle = '#ffffff'; g.arc(w / 2, 270, 52, 0, TAU); g.fill(); g.fillStyle = '#e8401a'; g.font = '700 26px Rubik, sans-serif'; g.fillText('PURE', w / 2, 278); g.fillStyle = '#2a2a6a'; g.font = '20px Rubik, sans-serif'; g.fillText('NET WT 500 g', w / 2, 360); });
      const side = K.std({ color: 0xf2bc20, roughness: 0.75 }), inner = K.std({ color: 0xd8c8a0, roughness: 0.9 });
      const bx = K.mesh(new T.BoxGeometry(12, 17, 6.5), side, x, 8.5, z, { ry: ang });
      K.mesh(new T.PlaneGeometry(11.9, 16.9), front, x + Math.sin(ang) * 3.27, 8.5, z + Math.cos(ang) * 3.27, { ry: ang, cast: false });
      const flap = K.mesh(new T.BoxGeometry(12, 0.15, 6.4), side, x + Math.sin(ang) * 5.4, 17.6, z + Math.cos(ang) * 5.4, { ry: ang, rx: 1.0 });
      K.mesh(new T.BoxGeometry(11.4, 0.3, 6.0), K.std({ color: 0xfbfaf6, roughness: 1 }), x, 16.6, z, { ry: ang, cast: false });
      K.box(x, z, 6, 3.3, -ang, 17, { solid: true });
      AO(x, z, 8, 5, 0.45, -ang);
      // a spilled heap of white powder
      const pw = K.std({ color: 0xfbfaf6, roughness: 1 });
      K.spill(x - 9, z + 6, 3.4, pw, { lump: 0.45, y: 0.3, thick: 0.3 });
      for (let i = 0; i < 26; i++) put(sph(r.range(0.2, 0.5), 6, 4), 0xffffff, { x: x - 9 + r.gauss() * 3, y: 0.15, z: z + 6 + r.gauss() * 3, sy: 0.5 }, matteV, false);
      void bx; void flap;
    }
    // ---- safety goggles and the magnifying glass in the north-east pocket
    {
      const x = 90, z = -14, ang = -0.5;
      const lens = K.phys({ color: 0xbfe2ff, roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1, depthWrite: false });
      const frame = K.plastic(0x2f6fe0, 0.3);
      const grp = new T.Group();
      const fr = [], ls = [];
      for (const sd of [-1, 1]) {
        fr.push(prep(new T.TorusGeometry(3.4, 0.55, 8, 28), null, mtx({ x: sd * 4.2, y: 2.8, sx: 1.15, sy: 0.78 })));
        ls.push(prep(new T.CircleGeometry(3.3, 28), null, mtx({ x: sd * 4.2, y: 2.8, z: 0.1, sx: 1.15, sy: 0.78 })));
      }
      fr.push(prep(rbox(2.2, 1.0, 1.0, 0.3, 2), null, mtx({ y: 3.2 })));
      grp.add(new T.Mesh(BU.mergeGeometries(fr, false), frame), new T.Mesh(BU.mergeGeometries(ls, false), lens));
      const strap = new T.Mesh(new T.TorusGeometry(8.6, 0.6, 6, 40, PI * 1.1), K.std({ color: 0x1a1a22, roughness: 0.8 })); strap.rotation.x = -PI / 2; strap.position.set(0, 0.5, -5); strap.rotation.z = -0.05; grp.add(strap);
      grp.rotation.x = -1.25; grp.position.set(x, 1.2, z); grp.rotation.order = 'YXZ'; grp.rotation.y = ang;
      K.add(grp);
      K.box(x, z, 9, 3.5, -ang, 3, { solid: true });
      AO(x, z, 10, 5, 0.35, -ang);
      // magnifying glass
      const mx = 30, mz = 46, ma = 0.9;
      const mg = new T.Group();
      const rim = new T.Mesh(new T.TorusGeometry(4.6, 0.45, 10, 40), K.plastic(0x1a1a1e, 0.3)); rim.rotation.x = PI / 2; mg.add(rim);
      const gl = new T.Mesh(new T.CircleGeometry(4.5, 40), K.glass(0xffffff, 0.16, { side: T.DoubleSide })); gl.rotation.x = -PI / 2; mg.add(gl);
      const hd = new T.Mesh(cyl(0.7, 0.85, 11, 14), K.plastic(0x1a1a1e, 0.35)); hd.rotation.z = PI / 2; hd.position.x = 10.4; mg.add(hd);
      mg.position.set(mx, 0.55, mz); mg.rotation.y = -ma; K.add(mg);
      K.circle(mx, mz, 4.6, 1.2);
      AO(mx + Math.cos(ma) * 5, mz + Math.sin(ma) * 5, 11, 5, 0.25, ma);
    }
    // ---- the potato clock (two potatoes, copper and zinc, wires to a little LCD clock) south of the west river
    {
      const x = -100, z = 14;
      const potGeo = (() => { const g = new T.SphereGeometry(1, 24, 16); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = _v.set(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + (n1(v.x * 6 + 20, v.y * 6 + v.z * 4, 1) - 0.5) * 0.25; p.setXYZ(i, v.x * k, v.y * k, v.z * k); } g.computeVertexNormals(); const col = []; for (let i = 0; i < p.count; i++) { const e = n2(p.getX(i) * 40, p.getZ(i) * 40 + p.getY(i) * 30, 1) > 0.7 ? 0.6 : 1; col.push(0.72 * e, 0.55 * e, 0.34 * e); } g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g; })();
      const potMat = K.std({ vertexColors: true, roughness: 0.85, normalMap: rockMat.normalMap, normalScale: V2(0.4) });
      for (const [dx, ry] of [[-5, 0.3], [5, -0.4]]) {
        const m = K.mesh(potGeo, potMat, x + dx, 2.7, z, { ry }); m.scale.set(4.8, 2.9, 3.0);
        K.circle(x + dx, z, 3.6, 5.6, { solid: true });
        AO(x + dx, z, 4.8, 3.4, 0.4, ry);
        put(box(0.25, 3.6, 1.6), 0xd8763a, { x: x + dx - 1.4, y: 5.4, z: z + 0.2 }, metalV, true);
        put(cyl(0.22, 0.22, 4.2, 8), 0xc8ccd0, { x: x + dx + 1.4, y: 5.3, z: z - 0.2 }, metalV, true);
      }
      // the clock
      const lcd = tex(canvas(256, 128, (g, w, h) => { g.fillStyle = '#9fb09a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e2a1e'; g.font = '700 84px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('12:00', w / 2, 96); }), [1, 1], false);
      const cm = K.mesh(rbox(6.4, 1.8, 4.4, 0.5, 2), [K.plastic(0x3a3e46, 0.4)], x, 0.9, z + 9);
      K.mesh(new T.PlaneGeometry(4.6, 2.4), K.std({ map: lcd, roughness: 0.3, emissive: 0x223322, emissiveIntensity: 0.2 }), x, 1.82, z + 9, { rx: -PI / 2, cast: false });
      K.box(x, z + 9, 3.2, 2.2, 0, 1.8);
      void cm;
      // wires with crocodile clips (tubes)
      const wire = (pts, col) => { const cv = new T.CatmullRomCurve3(pts.map(([a, b, c]) => new T.Vector3(a, b, c))); put(new T.TubeGeometry(cv, 30, 0.22, 6, false), col, null, plasticV, true); };
      wire([[x - 6.4, 7, z + 0.2], [x - 9, 6, z + 4], [x - 6, 1, z + 8], [x - 2.6, 1.2, z + 9]], 0xd8241a);
      wire([[x - 3.6, 7.2, z - 0.2], [x - 0.5, 9, z - 1], [x + 3.6, 7.2, z + 0.2]], 0x1a1a1a);
      wire([[x + 6.4, 7, z - 0.2], [x + 9, 5, z + 4], [x + 5, 1, z + 8.4], [x + 2.6, 1.2, z + 9]], 0x1a1a1a);
      AO(x, z + 9, 4.5, 3.2, 0.4);
    }
    // ---- a plastic T. rex running for its life (south infield)
    {
      const x = 58, z = 52, ang = 0.75, sc = 1.15;
      const green = K.phys({ vertexColors: true, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 });
      const grp = new T.Group(), dino = [];
      const add = (geo, col, o) => { dino.push(prep(geo, col, mtx(o))); };
      const G1 = 0x4f8a2e, G2 = 0x3c6e22, BEL = 0xc8c870;
      add(sph(1, 20, 14), G1, { x: 0, y: 9, z: 0, sx: 6.2, sy: 3.6, sz: 3.2, rz: 0.25 });
      add(sph(1, 16, 12), BEL, { x: 1.2, y: 8.2, z: 0, sx: 4.6, sy: 2.8, sz: 2.6, rz: 0.25 });
      add(new T.ConeGeometry(2.6, 13, 14), G1, { x: -9.5, y: 7.6, z: 0, rz: PI / 2 - 0.3 });
      add(sph(1, 16, 12), G1, { x: 6, y: 12.4, z: 0, sx: 2.4, sy: 2.2, sz: 1.9, rz: -0.6 });
      add(rbox(6, 3, 3.2, 1, 2), G1, { x: 8.4, y: 15, z: 0, rz: -0.15 });
      add(rbox(5.4, 1.1, 2.8, 0.4, 2), G2, { x: 8.8, y: 13.2, z: 0, rz: 0.3 });
      for (const sd of [-1, 1]) {
        add(sph(1, 12, 10), 0xfff2a0, { x: 9.6, y: 16, z: sd * 1.45, s: 0.45 });
        add(sph(1, 8, 6), 0x101010, { x: 9.85, y: 16.05, z: sd * 1.6, s: 0.22 });
        add(sph(1, 14, 10), G2, { x: -1, y: 6.5, z: sd * 2.4, sx: 2.4, sy: 3.4, sz: 1.6, rz: sd * 0.3 + 0.2 });
        add(cyl(0.9, 0.7, 6, 10), G1, { x: -1 + sd * 1.6, y: 3, z: sd * 2.5, rz: sd * 0.45 });
        add(rbox(3.6, 0.9, 2.0, 0.4, 2), G2, { x: sd * 2.2, y: 0.45, z: sd * 2.6 });
        add(cyl(0.35, 0.3, 2.6, 8), G1, { x: 6.4, y: 9.8, z: sd * 1.6, rz: -1.1 });
      }
      grp.add(new T.Mesh(BU.mergeGeometries(dino, false), green));
      grp.position.set(x, 0, z); grp.rotation.y = -ang; grp.scale.setScalar(sc);
      K.add(grp);
      K.circle(x, z, 4.2, 12, { solid: true });
      K.circle(x - Math.cos(ang) * 9, z - Math.sin(ang) * 9, 2.6, 8, { solid: true });
      AO(x, z, 9, 6, 0.4, ang);
    }
    // ---- the judge's clipboard with the score sheet, outside the south-west corner
    {
      const x = -140, z = 74, ang = -0.35;
      const sheet = tex(canvas(512, 704, (g, w, h) => {
        g.fillStyle = '#fdfdf8'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#22324a'; g.font = '700 30px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('SCIENCE FAIR', w / 2, 60); g.fillText('JUDGING FORM', w / 2, 98);
        g.textAlign = 'left'; g.font = '24px Rubik, sans-serif';
        ['Project: #27 Volcano', 'Hypothesis', 'Method', 'Display', 'Creativity', 'Safety'].forEach((t, i) => { const y = 170 + i * 72; g.fillStyle = '#22324a'; g.fillText(t, 40, y); g.strokeStyle = '#a0a8b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, y + 14); g.lineTo(w - 40, y + 14); g.stroke(); if (i) for (let k = 0; k < 5; k++) { g.strokeRect(300 + k * 34, y - 22, 26, 26); } });
        g.strokeStyle = '#1f4fc8'; g.lineWidth = 4; for (let i = 1; i < 6; i++) { const k = i === 5 ? 1 : 4, y = 170 + i * 72; g.beginPath(); g.moveTo(304 + k * 34, y - 12); g.lineTo(312 + k * 34, y - 2); g.lineTo(326 + k * 34, y - 24); g.stroke(); }
        g.fillStyle = '#c8321a'; g.font = `64px ${hand}`; g.fillText('WOW!!', 270, 640); g.strokeStyle = '#c8321a'; g.lineWidth = 5; g.beginPath(); g.ellipse(240, 600, 160, 70, -0.1, 0, TAU); g.stroke();
      }), [1, 1], false);
      put(rbox(23, 0.45, 32, 0.4, 2), 0x9a6a3e, { x, y: 0.23, z, ry: -ang }, matteV, true);
      K.mesh(new T.PlaneGeometry(21, 28.8), K.std({ map: sheet, roughness: 0.9 }), x - Math.sin(ang) * 1.2, 0.5, z + Math.cos(ang) * 1.2, { rx: -PI / 2, rz: -ang, cast: false });
      put(rbox(9, 1.4, 3.2, 0.4, 2), 0xb8bcc4, { x: x + Math.sin(ang) * 14.2, y: 0.9, z: z - Math.cos(ang) * 14.2, ry: -ang }, metalV, true);
      put(cyl(0.38, 0.38, 16, 6), 0xf2c21e, { x: x + 6, y: 0.9, z: z + 2, rx: PI / 2, rz: 0.4 }, matteV, true);
      AO(x, z, 13, 17, 0.3, ang);
    }
    // ---- the school glue bottle, a water jar with brushes and a paint palette inside the east S-bend
    {
      const x = 135.5, z = 27;
      put(lathe([[2.9, 0], [3.0, 0.4], [3.0, 9.5], [2.4, 10.6], [1.2, 11.4], [0.01, 11.5]], 28), 0xfaf8f0, { x, z }, plasticV, true);
      put(new T.ConeGeometry(0.9, 2.6, 14), 0xe8701c, { x, y: 12.6, z }, plasticV, true);
      const gl = tex(canvas(256, 128, (g, w, h) => { g.fillStyle = '#faf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8701c'; g.fillRect(0, 30, w, 68); g.font = `52px ${hand}`; g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.fillText('STICKY', w / 2, 84); }), [1, 1], false);
      K.mesh(cyl(3.04, 3.04, 4.2, 28, true), K.std({ map: gl, roughness: 0.5 }), x, 5, z, { ry: 2.2 });
      K.circle(x, z, 3.1, 12, { solid: true });
      AO(x, z, 3.8, 3.8, 0.45);
      // water jar with two brushes
      const jx = 124, jz = 40;
      K.mesh(lathe([[3.6, 0], [3.8, 0.4], [3.8, 9], [3.4, 9.6], [3.5, 10.2], [3.1, 10.2], [3.1, 0.5], [0.01, 0.5]], 32), glassM, jx, 0, jz, { cast: false });
      K.mesh(cyl(3.4, 3.4, 6, 28), K.liquid(0xb05a8a, { transparent: true, opacity: 0.55 }), jx, 3.4, jz);
      for (const [a, c] of [[0.35, 0xd8241a], [-0.3, 0x2f6fe0]]) {
        const b = new T.Group();
        const hdl = new T.Mesh(cyl(0.32, 0.25, 15, 8), K.plastic(c, 0.35)); hdl.position.y = 7.5; b.add(hdl);
        const fer = new T.Mesh(cyl(0.36, 0.36, 1.6, 8), K.metal(0xc8ccd0, 0.3)); fer.position.y = -0.6; b.add(fer);
        b.position.set(jx + a * 2, 1.5, jz); b.rotation.z = a; K.add(b);
      }
      K.circle(jx, jz, 3.9, 10, { solid: true });
      AO(jx, jz, 4.6, 4.6, 0.4);
      // paint palette with blobs of colour
      const px = 112, pz = 24;
      put(rbox(14, 0.4, 9, 0.4, 2), 0xf4f2ec, { x: px, y: 0.2, z: pz, ry: 0.3 }, plasticV, true);
      [[0xc8321a, -4, -2], [0xe8701c, -1, -2.6], [0xf2c21e, 2, -2], [0x5d7f34, 4.4, 0], [0x4a3a30, -3.6, 1.6], [0xfafafa, 0.4, 1.8]].forEach(([c, dx, dz]) => {
        const ca = Math.cos(0.3), sa = Math.sin(0.3);
        put(sph(1.2, 10, 6), c, { x: px + dx * ca + dz * sa, y: 0.4, z: pz - dx * sa + dz * ca, sy: 0.35 }, plasticV, false);
      });
      AO(px, pz, 8, 5.5, 0.3, -0.3);
    }
    // ---- a little papier-mache village in danger at the foot of the north-east climb
    {
      const houses = [[64, -16, 0.3, 0xe8d8b0, 0xa83a26], [68, -5, -0.2, 0xd8e4f0, 0x3a4a6a], [61, 4, 0.9, 0xf0c8a0, 0x8a3a20], [72, 9, 0.1, 0xe8e0c8, 0xa04020]];
      for (const [x, z, a, wall, roof] of houses) {
        put(box(5, 4, 4), wall, { x, y: 2, z, ry: a }, matteV, true);
        const rg = new T.CylinderGeometry(0.01, 3.8, 2.6, 4, 1); rg.rotateY(PI / 4); rg.scale(1.0, 1, 0.8);
        put(rg, roof, { x, y: 5.3, z, ry: a }, matteV, true);
        put(box(1, 1.6, 0.1), 0x3a2a20, { x: x + Math.sin(a) * 2.05, y: 0.8, z: z + Math.cos(a) * 2.05, ry: a }, matteV, false);
        K.box(x, z, 2.6, 2.2, -a, 5);
        AO(x, z, 3.4, 2.8, 0.35, -a);
      }
    }
    // ---- sponge trees on the volcano's foot and round the climbs
    {
      const trunks = [], crowns = [];
      const spots = [];
      for (let a = 205; a <= 335; a += 9) spots.push([C.x + Math.cos(a * DEG) * r.range(34, 41), C.z + Math.sin(a * DEG) * r.range(34, 41)]);
      for (const [x, z] of [[58, -34], [56, -46], [-58, -36], [-57, -44], [60, -26], [-60, -26], [54, -66], [-54, -66], [78, 18], [-70, 12]]) spots.push([x, z]);
      for (const [x, z] of spots) {
        if (track.distTo(x, z).dist < W / 2 + 3.2) continue;
        const y = Math.max(0, terrain(x, z)), h = r.range(3.2, 5.5);
        trunks.push({ x, y: y + h / 2, z, sx: 1, sy: h, sz: 1 });
        const g = new T.Color(0x3f6a26).multiplyScalar(r.range(0.75, 1.15)).getHex();
        for (let k = 0; k < 3; k++) crowns.push({ x: x + r.range(-0.8, 0.8), y: y + h + k * 1.3 - 0.3, z: z + r.range(-0.8, 0.8), s: (2.3 - k * 0.5) * r.range(0.85, 1.15), color: g });
      }
      K.instances(cyl(0.3, 0.4, 1, 6), K.std({ color: 0x5a3e28, roughness: 0.9 }), trunks);
      K.instances(new T.IcosahedronGeometry(1, 1), K.std({ roughness: 0.95, normalMap: rockMat.normalMap, normalScale: V2(1.5) }), crowns, { colors: true });
    }
    // ---- debris below the cone: papier-mache chunks, foam blobs, newspaper scraps; gravel along the table roads
    {
      const chunks = [], blobs = [], scraps = [];
      const okOff = (x, z, m = 2.5) => track.distTo(x, z).dist > W / 2 + m && Math.hypot(x - C.x, z - C.z) > 52;
      for (let i = 0; i < 220 && chunks.length < 90; i++) {
        const a = r.range(0.15, PI - 0.15), d = r.range(52, 88), x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
        if (!okOff(x, z) || z > 76) continue;
        const sc = r.range(0.4, 1.4);
        chunks.push({ x, y: sc * 0.4, z, rx: r() * 6, ry: r() * 6, rz: r() * 6, sx: sc * r.range(0.8, 1.6), sy: sc * 0.7, sz: sc, color: new T.Color(0x6e5848).multiplyScalar(r.range(0.7, 1.2)).getHex() });
      }
      K.instances(rockGeo, rockMat, chunks, { colors: true });
      for (let i = 0; i < 400 && blobs.length < 120; i++) {
        const x = r.range(BOUNDS.minX + 8, BOUNDS.maxX - 8), z = r.range(BOUNDS.minZ + 14, BOUNDS.maxZ - 8);
        const near = Math.hypot(x - C.x, z - C.z);
        if (r() > 1.3 - near / 140 || !okOff(x, z, 1.5)) continue;
        const sc = r.range(0.35, 1.2) * (near < 90 ? 1.3 : 1);
        blobs.push({ x, y: 0.05, z, sx: sc * r.range(1, 1.6), sy: sc * 0.55, sz: sc, ry: r() * 6 });
      }
      const blobGeo = new T.SphereGeometry(1, 14, 8, 0, TAU, 0, PI / 2);
      K.instances(blobGeo, foamMat, blobs, { cast: false });
      const news = tex(canvas(256, 256, (g, w, h) => { g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#4a4a46'; const rr = K.rng(5); for (let y = 10; y < h; y += 12) for (let x = 8; x < w - 8;) { const l = 10 + rr() * 34; g.fillRect(x, y, Math.min(l, w - 8 - x), 5); x += l + 6; } g.font = '700 40px Georgia, serif'; g.fillText('DAILY', 20, 60); }), [1, 1], false);
      for (let i = 0; i < 160 && scraps.length < 26; i++) {
        const x = r.range(-150, 150), z = r.range(-80, 95);
        if (!okOff(x, z, 2)) continue;
        scraps.push({ x, y: 0.05 + scraps.length * 0.002, z, ry: r() * 6, sx: r.range(2.5, 6), sy: 1, sz: r.range(1.5, 3.5) });
      }
      const sc = K.instances(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), K.std({ map: news, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), scraps, { cast: false });
      sc.renderOrder = 1;
      // gravel along the road edges where the road lies on the cloth
      const grav = [];
      for (const side of [-1, 1]) {
        for (const p of track.edgePoints(side, 1.35, 0.75)) {
          if (onTerrace(p.s) || sRel(p.s, SA - 3) < 3) continue;
          if (Math.abs(p.s - br2.s) < 6.5) continue;
          if (A.cross.some((c) => Math.abs(sRel(p.s - c.s + L / 2, 0) - L / 2) < CH.hw + 0.8 && c.y === 0)) continue;
          const jit = r.range(-0.3, 0.35), x = p.x + Math.cos(p.angle + PI / 2) * jit * side, z = p.z + Math.sin(p.angle + PI / 2) * jit * side;
          const s2 = r.range(0.42, 0.75);
          grav.push({ x, y: s2 * 0.35, z, rx: r() * 6, ry: r() * 6, rz: r() * 6, sx: s2 * r.range(0.9, 1.4), sy: s2 * 0.7, sz: s2, color: r.pick([0x2a2624, 0x463c36, 0x5e3a2c, 0x6a625a, 0x3a3634]) });
        }
      }
      const gravMat = K.std({ roughness: 0.9 });
      const gm = K.instances(new T.IcosahedronGeometry(1, 0), gravMat, grav, { colors: true, cast: false });
      void gm;
    }

    // contact shadows (one instanced mesh)
    if (contacts.length) {
      const g = new T.PlaneGeometry(1, 1).rotateX(-PI / 2);
      const im = new T.InstancedMesh(g, contactMat, contacts.length);
      contacts.forEach((c, i) => im.setMatrixAt(i, mtx(c)));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.renderOrder = 1;
      K.group.add(im);
    }
    flushBins();
    A.tmp = { M: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), p: new T.Vector3(), s: new T.Vector3(), col: new T.Color(), ax: new T.Vector3() };
  },

  // fixed-rate: the volcano clock, flood states, bomb blasts, CPU drivers waiting or dodging
  tick(dt, time, game) {
    if (!A || !A.cross.length) return;
    // a countdown starts the volcano clock again (the first eruption comes ERU.first s after GO)
    if (game.state === 'countdown' && A.prevState !== 'countdown') { A.t0 = time + Math.max(0, game.countT); A.prevU = null; }
    A.prevState = game.state;
    const u = eruU(time), pu = A.prevU;
    A.prevU = u;
    const crossed = (a) => pu != null && (pu <= u ? pu < a && u >= a : pu < a || u >= a);
    // the crossings: strips open as the foam reaches them, a sticky crust stays a moment after
    for (const cr of A.cross) {
      for (const st of cr.strips) st.hole.open = u >= st.t0 && u < st.t1;
      cr.surf.kind = u >= cr.tF1 && u < cr.tS1 ? 'sticky' : 'normal';
    }
    // bombs: blast on impact, then a sticky splat
    const cars = game.cars;
    for (const b of A.bombs) {
      const q = bombOf(b.i, time), sp = q.spot;
      const splat = q.u >= q.tI && q.u < q.tI + BOMB.splat;
      b.surf.x = splat ? sp.x : 0; b.surf.z = splat ? sp.z : -999;
      b.surf.bb[0] = b.surf.x - 3.4; b.surf.bb[2] = b.surf.x + 3.4; b.surf.bb[1] = b.surf.z - 3.4; b.surf.bb[3] = b.surf.z + 3.4;
      b.surf.kind = splat ? 'sticky' : 'normal';
      if (crossed(q.tI)) {
        for (const e of cars) {
          const c = e.car;
          if (e.out || c.state !== 'drive') continue;
          const dx = c.x - sp.x, dz = c.z - sp.z, d = Math.hypot(dx, dz);
          if (d > BOMB.R || Math.abs(c.y - sp.y) > 3) continue;
          const nx = d > 0.3 ? dx / d : -Math.sin(c.angle), nz = d > 0.3 ? dz / d : Math.cos(c.angle);
          const add = 13 + 15 * (1 - d / BOMB.R);
          c.vx += nx * add; c.vz += nz * add;
          c.w += (c.index % 2 ? 1 : -1) * (1.2 + 1.6 * (1 - d / BOMB.R));
          c.stun = Math.max(c.stun, 0.3);
        }
        game.physics.events.push({ type: 'clack', strength: 26, x: sp.x, z: sp.z });
        if (game.addShake && game.onScreen(sp.x, sp.y, sp.z, 0.1)) game.addShake(0.35);
      }
    }
    // sounds: the steam whistle in the build-up, the boom
    if (crossed(ERU.P - 3.4)) game.sound.cue('whistle', { x: C.x, z: C.z, game });
    if (crossed(0)) {
      game.physics.events.push({ type: 'clack', strength: 40, x: C.x, z: C.z });
      if (eruK(time) === 0 && game.state === 'race' && game.hud && game.cars.some((e) => e.human)) game.hud.flash('ERUPTION!', '#ff5a1f');
    }

    const L = game.track.length;
    // a car that sank into a flooded crossing comes back a few lengths before it, not on its edge
    for (const e of cars) {
      if (e.car.state !== 'falling' || e.car.fallKind !== 'hole') continue;
      for (const cr of A.cross) {
        const d = mod(e.lastGoodS - cr.s + L / 2, L) - L / 2;
        if (d > -(CH.hw + 9) && d < CH.hw + 2) e.lastGoodS = mod(cr.s - CH.hw - 7, L);
      }
    }
    for (const e of cars) {
      const c = e.car;
      if (e.out || c.state !== 'drive') continue;
      // respawned or placed cars on the terrace start on its deck
      if (!c.airborne && c.speed < 4) { const g = game.physics.groundAt(c.x, c.z).g; if (g > c.y + 0.85) c.y = g; }
      // anyone queuing at a flooded (or about to flood) crossing is waiting, not stuck
      for (const cr of A.cross) {
        const d = mod(cr.s - e.trackS, L);
        if (d < 35 && ((u >= cr.tF0 && u < cr.tF1 + 0.3) || mod(cr.tF0 - u, ERU.P) < 2.5)) e.holdT = 0.25;
      }
      if (!e.ai || c.airborne) continue;
      const sp = Math.max(c.fwdSpeed, 8);
      let vmax = Infinity;
      // flooded crossings: stop short unless the strip can be cleared before the foam reaches it
      for (const cr of A.cross) {
        const d = mod(cr.s - e.trackS, L);
        if (d > 80 || d > L - 4) continue;
        let tOpen = cr.tF0 - u, tClose = cr.tF1 - u;
        if (tClose < -0.05) { tOpen += ERU.P; tClose += ERU.P; }
        if (tOpen > 12) continue;
        if (tOpen > (d + CH.hw + 4) / sp + 0.35) continue; // through before it floods
        const stopD = d - CH.hw - 4.2;
        if (stopD < -1.5) continue; // committed (already on the strip)
        vmax = Math.min(vmax, Math.sqrt(2 * 70 * Math.max(0, stopD)));
        e.ai.stuckT = 0;
      }
      // boulders: don't arrive at the rock's line while it rolls across the terrace
      for (const rk of A.rocks) {
        const d = mod(rk.s - e.trackS, L);
        if (d > 45 || d < 5) continue;
        const uu = mod(raceT(time) + ROCK.runs[rk.k].ph, ROCK.P);
        let w0 = A.rockW[0] - uu, w1 = A.rockW[1] - uu;
        if (w1 < -0.05) { w0 += ROCK.P; w1 += ROCK.P; }
        // best case: accelerating flat out from the current speed (time to clear the rock's line)
        const v0 = Math.max(0, c.fwdSpeed), vt = 40, ta = Math.max(0, (vt - v0) / 45), da = (v0 + vt) / 2 * ta, dd = d + 4.5;
        const leaveFast = dd <= da ? (Math.sqrt(v0 * v0 + 90 * dd) - v0) / 45 : ta + (dd - da) / vt;
        if (leaveFast < w0 - 0.25 || (d - 4.5) / sp > w1 + 0.1 || w0 > 4) continue;
        vmax = Math.min(vmax, Math.max(3, (d - 5) / Math.max(0.05, w1 + 0.15)));
        e.ai.stuckT = 0;
      }
      if (vmax < Infinity && c.fwdSpeed > vmax) { const k = vmax / Math.max(c.fwdSpeed, 0.01); c.vx *= k; c.vz *= k; }
      // lava bombs: steer to the far side of a mark that will be live when the car gets there
      for (const b of A.bombs) {
        const q = bombOf(b.i, time);
        if (q.u < q.tL || q.u > q.tI + 0.6) continue;
        const d = mod(q.spot.s - e.trackS, L);
        if (d > 42 || d > L - 4) continue;
        const tImp = q.tI - q.u, arr = d / sp;
        if (arr < tImp - 1.0 || arr > tImp + 0.7) continue;
        const want = q.spot.lat > 0 ? -4.5 : 4.5;
        const shift = want - e.ai.lineOffset(e.trackS + 10);
        e.ai.avoid += (shift - e.ai.avoid) * Math.min(1, dt * 8);
      }
    }
  },

  animate(time, dt, game) {
    if (!A || !A.cross.length) return;
    const V = A.tmp, u = eruU(time), wk = warnOf(u);
    const live = game.state === 'race' || game.state === 'countdown' || game.state === 'roundEnd';
    // ---- the surge
    const front = chFront(u), tail = chFront(u - ERU.D);
    A.surge.U.uFront.value = front; A.surge.U.uTail.value = tail; A.surge.U.uTime.value = time;
    A.river.mat.map.offset.y = -time * 0.25; A.river.mat.normalMap.offset.y = -time * 0.25;
    // ---- crater: glow in the build-up, the column at the boom, foam over the rim
    const cr = A.crater;
    const boom = u < 3 ? 1 - ss(0.2, 3, u) : 0;
    cr.light.intensity = 900 * wk * wk + 5200 * boom * boom + 60;
    cr.pool.material.emissiveIntensity = 0.5 + wk * 1.6 + boom * 2;
    cr.pool.position.y = CONE.floor + 1.2 + wk * 3.5 + boom * 4;
    const colH = u < 2.6 ? 20 * Math.sin(PI * Math.min(1, u / 2.6)) ** 0.6 : 0;
    for (let i = 0; i < cr.colN; i++) {
      const f = i / (cr.colN - 1), sc = colH > 0.5 ? (3.6 - f * 1.2) * (0.85 + 0.15 * Math.sin(time * 9 + i)) : 0.001;
      V.p.set(C.x + Math.sin(i * 2.3 + time * 3) * 1.4 * f, CONE.floor + 3 + f * colH, C.z + Math.cos(i * 1.7 + time * 2.6) * 1.4 * f);
      V.M.compose(V.p, V.q.identity(), V.s.setScalar(sc));
      cr.col.setMatrixAt(i, V.M);
    }
    cr.col.instanceMatrix.needsUpdate = true;
    const ov = u < 8 ? ss(0.2, 1.0, u) * (1 - ss(5, 8, u)) : wk * 0.25;
    for (let i = 0; i < cr.overN; i++) {
      const a = (i / cr.overN) * TAU + 0.3, rr = CONE.rim + 0.6 + (i % 2) * 0.8;
      const sc = ov > 0.02 ? ov * (1.6 + 0.6 * Math.sin(i * 3.1) + 0.25 * Math.sin(time * 5 + i)) : 0.001;
      V.p.set(C.x + Math.cos(a) * rr, CONE.rimH - 0.2, C.z + Math.sin(a) * rr);
      V.M.compose(V.p, V.q.identity(), V.s.set(sc * 1.3, sc * 0.8, sc * 1.3));
      cr.over.setMatrixAt(i, V.M);
    }
    cr.over.instanceMatrix.needsUpdate = true;
    // ---- the wet crust on the crossings (sticky)
    for (const x of A.cross) {
      const k = u >= x.tF1 - 0.4 && u < x.tS1 ? Math.min(1, (u - x.tF1 + 0.4) / 0.4) * (1 - ss(x.tS1 - 0.5, x.tS1, u)) : 0;
      x.residue.visible = k > 0.01;
      x.residue.material.opacity = 0.8 * k;
    }
    // ---- crossing beacons: flash from the build-up until the crust is gone
    {
      const B = A.beacons, on = Math.floor(time * 5) % 2 === 0;
      A.cross.forEach((x, ci) => {
        const act = (u > ERU.P - ERU.warn) || (u < x.tS1);
        for (let k = 0; k < 2; k++) {
          const i = ci * 2 + k, lit = act && (on ? k === 0 : k === 1);
          V.col.setRGB(lit ? 2.6 : act ? 0.55 : 0.3, lit ? 0.3 : 0.05, lit ? 0.12 : 0.03);
          B.bulbs.setColorAt(i, V.col);
          V.col.setRGB(lit ? 0.9 : 0, lit ? 0.12 : 0, lit ? 0.05 : 0);
          B.halos.setColorAt(i, V.col);
        }
      });
      B.bulbs.instanceColor.needsUpdate = true; B.halos.instanceColor.needsUpdate = true;
    }
    // ---- bombs
    {
      const BV = A.bombVis;
      for (let i = 0; i < BOMB.n; i++) {
        const q = bombOf(i, time), sp = q.spot;
        // in flight: a parabola from the crater
        if (q.u >= q.tL && q.u < q.tI) {
          const f = (q.u - q.tL) / (q.tI - q.tL), apex = Math.min(24, 8 + sp.dist * 0.13);
          V.p.set(lerp(C.x, sp.x, f), lerp(CONE.rimH + 3, sp.y + 1.2, f) + apex * 4 * f * (1 - f), lerp(C.z, sp.z, f));
          V.M.compose(V.p, V.q.identity(), V.s.setScalar(1));
          if (game.particles && game.onScreen(V.p.x, V.p.y, V.p.z, 0.2) && dt > 0) game.particles.emit(V.p.x, V.p.y, V.p.z, { color: 0xff6a2a, n: 1, size: 1.2, life: 0.35, spread: 1, up: 0.5, grav: 4, alpha: 0.8, grow: 0.6 });
        } else V.M.makeScale(0.0001, 0.0001, 0.0001);
        BV.blob.setMatrixAt(i, V.M);
        // the mark: grows and brightens as the bomb comes down, flashes at the impact
        const pre = q.u >= q.tL - 0.1 && q.u < q.tI + 0.35;
        if (pre) {
          const f = ss(q.tL, q.tI, q.u), pulse = 0.75 + 0.25 * Math.sin(time * (10 + f * 14));
          const scl = BOMB.R * 2 * (0.55 + 0.45 * f) * (q.u > q.tI ? 1 + (q.u - q.tI) * 3 : 1);
          V.p.set(sp.x, sp.y + 0.14, sp.z); V.M.compose(V.p, V.q.identity(), V.s.set(scl, 1, scl));
          BV.marks.setMatrixAt(i, V.M);
          const k = (0.35 + 0.65 * f) * pulse * (q.u > q.tI ? 1 - (q.u - q.tI) / 0.35 : 1);
          V.col.setRGB(1.5 * k, 0.35 * k, 0.08 * k); BV.marks.setColorAt(i, V.col);
          // the bomb's shadow (opacity in the y scale)
          V.p.set(sp.x, sp.y + 0.1, sp.z); V.M.compose(V.p, V.q.identity(), V.s.set(1.2 + 2.6 * f, 0.15 + 0.5 * f, 1.2 + 2.6 * f));
          BV.shadows.setMatrixAt(i, V.M);
        } else { V.M.makeScale(0.0001, 0.0001, 0.0001); BV.marks.setMatrixAt(i, V.M); BV.shadows.setMatrixAt(i, V.M); }
        // the splat: bursts, then sags and shrinks
        if (q.u >= q.tI && q.u < q.tI + BOMB.splat) {
          const t2 = q.u - q.tI, burst = 1 + 0.6 * Math.exp(-t2 * 8), sag = 1 - ss(BOMB.splat - 1.2, BOMB.splat, t2);
          V.p.set(sp.x, sp.y + 0.05, sp.z); V.M.compose(V.p, V.q.identity(), V.s.set(3.2 * burst * sag + 0.001, (0.9 * Math.exp(-t2 * 1.5) + 0.35) * sag + 0.001, 3.2 * burst * sag + 0.001));
          if (A.lastSplat && A.lastSplat[i] < q.tI && game.particles && game.onScreen(sp.x, sp.y, sp.z, 0.2)) {
            game.particles.emit(sp.x, sp.y + 1, sp.z, { color: 0xff5a2a, n: 16, size: 1.3, life: 0.7, spread: 22, up: 14, grav: 40, alpha: 0.95, grow: 0.8 });
            game.particles.emit(sp.x, sp.y + 1, sp.z, { color: 0xffd0b8, n: 8, size: 1.0, life: 0.5, spread: 16, up: 10, grav: 30, alpha: 0.9 });
            if (live && game.sound.ctx) { game.sound.tone(180, 0.3, { type: 'sine', vol: 0.18, slideTo: 60, pan: game.panOf(sp.x, sp.z) }); game.sound.noiseBurst(0.35, { freq: 900, vol: 0.14, pan: game.panOf(sp.x, sp.z) }); }
          }
        } else V.M.makeScale(0.0001, 0.0001, 0.0001);
        BV.splat.setMatrixAt(i, V.M);
        if (!A.lastSplat) A.lastSplat = new Float32Array(BOMB.n).fill(99);
        A.lastSplat[i] = q.u;
      }
      BV.blob.instanceMatrix.needsUpdate = true; BV.marks.instanceMatrix.needsUpdate = true; BV.marks.instanceColor.needsUpdate = true;
      BV.shadows.instanceMatrix.needsUpdate = true; BV.splat.instanceMatrix.needsUpdate = true;
    }
    // ---- boulders
    for (const rk of A.rocks) {
      const q = rockPose(rk.k, time);
      const x = C.x + rk.ca * q.r, z = C.z + rk.sa * q.r;
      const gy = A.terrain(x, z);
      rk.mesh.visible = q.vis;
      rk.shadow.visible = q.vis;
      if (!q.vis) continue;
      const sc = q.scale;
      rk.mesh.position.set(x + rk.ca * q.wob * 0.15, Math.max(gy, q.r > 60 ? 0.3 : gy) + ROCK.R * sc * (1 - q.sink * 1.1) + (q.r < 32.5 ? 0.6 : 0), z + rk.sa * q.wob * 0.15);
      rk.mesh.scale.setScalar(Math.max(0.001, sc));
      V.ax.set(-rk.sa, 0, rk.ca);
      rk.mesh.quaternion.setFromAxisAngle(V.ax, (q.r - ROCK.r0) / ROCK.R + q.wob * 0.08);
      rk.shadow.position.set(x, gy + 0.08, z);
      rk.shadow.material.opacity = 0.5 * sc * (1 - q.sink);
      // a rumble while it rolls on screen
      if (live && q.r > ROCK.r0 + 0.5 && q.r < ROCK.pond && game.sound.ctx && game.onScreen(x, gy, z, 0.1)) {
        rk.rumbleT = (rk.rumbleT || 0) - dt;
        if (rk.rumbleT <= 0) { rk.rumbleT = 0.12; game.sound.tone(52 + q.r * 0.3, 0.16, { type: 'triangle', vol: 0.07, pan: game.panOf(x, z) }); }
      }
    }
    // ---- the build-up: rumble, shake, steam; the boom
    if (live && dt > 0) {
      if (wk > 0) {
        if (game.addShake && game.state === 'race') game.addShake(0.05 + 0.2 * wk * wk);
        A.rumbleT = (A.rumbleT || 0) - dt;
        if (A.rumbleT <= 0 && game.sound.ctx) { A.rumbleT = 0.14 - 0.06 * wk; game.sound.tone(38 + Math.sin(time * 7) * 6, 0.22, { type: 'triangle', vol: 0.05 + 0.12 * wk }); game.sound.noiseBurst(0.2, { freq: 180, vol: 0.04 + 0.08 * wk }); }
        if (game.particles && Math.sin(time * 40) > 0.6) game.particles.emit(C.x, CONE.rimH + 1, C.z, { color: 0xf4eee8, n: 1, size: 3.5, life: 1.4, spread: 3, up: 6, grav: -3, alpha: 0.5, grow: 1.8 });
      }
      if (A.lastU != null && A.lastU > ERU.P - 1 && u < 1) {
        if (game.addShake) game.addShake(0.8);
        if (game.sound.ctx) { game.sound.tone(46, 1.1, { type: 'sine', vol: 0.4, slideTo: 24 }); game.sound.noiseBurst(1.3, { freq: 380, vol: 0.32 }); game.sound.noiseBurst(0.6, { freq: 2400, type: 'bandpass', q: 0.6, vol: 0.08 }); }
        if (game.particles) for (let i = 0; i < 3; i++) game.particles.emit(C.x, CONE.rimH + 2, C.z, { color: i ? 0xff5a2a : 0xffd0b8, n: 26, size: 2.2, life: 1.3, spread: 30, up: 34, grav: 45, alpha: 0.95, grow: 0.9 });
      }
      if (u < 2.2 && game.particles && Math.sin(time * 50) > 0) game.particles.emit(C.x, CONE.rimH + 4 + colH * 0.6, C.z, { color: 0xff6a2a, n: 2, size: 1.8, life: 0.9, spread: 16, up: 10, grav: 40, alpha: 0.9, grow: 0.9 });
    }
    A.lastU = u;
  },
};
