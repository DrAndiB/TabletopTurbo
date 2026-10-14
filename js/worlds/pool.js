// World 5: a full-size 9-ft pool table in a dim games room at night, lit by a three-shade billiard lamp.
// A chalk-drawn serpentine road (kerbs, arrows, grid boxes) on green felt, three cues lying between the
// lanes, ten pushable pool balls that can be knocked into the leather-and-net pockets, a beer-mat jump
// over spilt cola, slippery blue chalk dust, and two side pockets waiting for anyone running wide.

const TRACK = [
  [-72, 47], [-28, 47.5], [0, 52], [28, 47.5], [92, 47], [105.64, 39.12], [105.64, 23.38], [92, 15.5], [48, 15],
  [24, 19.5], [0, 17], [-14, 15.5], [-25, 11], [-29.5, 0], [-25, -11], [-14, -15.5], [20, -12], [52, -17],
  [92, -15.5], [105.64, -23.38], [105.64, -39.12], [92, -47], [0, -51.5], [-80, -46.5], [-104, -31], [-112, 0], [-104, 31],
];

const HX = 127, HZ = 63.5; // playing surface half size (cushion noses)
const BX = 132, BZ = 68.5; // cushion backs = inner edge of the wooden rails
const OX = 141, OZ = 77.5; // outer edge of the rails
const RAIL_Y = 4.6, CUSH_Y = 4.0;
const BALL_R = 2.85;
const POCKETS = [
  { x: -129.6, z: -65.6, r: 6.5 }, { x: 129.6, z: -65.6, r: 6.5 },
  { x: -129.6, z: 65.6, r: 6.5 }, { x: 129.6, z: 65.6, r: 6.5 },
  { x: 0, z: -67.3, r: 6.6 }, { x: 0, z: 67.3, r: 6.6 },
];

let A = null;

// The break shot: the middle cue (lying between the lanes) slides back, pauses and plays the cue ball west across
// the hairpin into the rack at the foot spot; the ball rebounds, and is re-spotted before the next shot. Pure time.
const CUE = { x: -17.2, z: 0.62, tipZ: 0.6, butt: [117, 1.4], P: 6.8, hit: 2.155, reset: 5.2 };
function cueStroke(t) { // how far the cue tip has gone past the point where it meets the resting ball (+ = west)
  const u = ((t % CUE.P) + CUE.P) % CUE.P;
  const ease = (f) => f * f * (3 - 2 * f);
  if (u < 1.2) return -1 - 7 * ease(u / 1.2);
  if (u < 1.5) return -8 + Math.sin((u - 1.2) * 24) * 0.12;
  if (u < 2.25) { const q = (u - 1.5) / 0.75; return -8 + 10.5 * q * q; }
  if (u < 2.7) return 2.5;
  if (u < 3.5) return 2.5 - 3.5 * ease((u - 2.7) / 0.8);
  return -1;
}

export default {
  id: 'pool',
  name: 'Corner Pocket',
  blurb: 'Late-night pool table: chalk-lined felt, cue dividers, rolling balls, hungry pockets.',
  vehicle: 'sports',
  seed: 5,
  track: { points: TRACK, width: 14, startS: 36 },
  bounds: { minX: -136, maxX: 136, minZ: -72, maxZ: 72 },
  fallOffEdges: false,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x0a2c18,
  clackOnBump: true,
  dust: {
    normal: null,
    slick: { color: 0x4f86d8, size: 1.0, life: 0.7, up: 3, grav: 6, alpha: 0.75, grow: 2.2, rate: 2 },
    sticky: { color: 0x2a1206, size: 0.7, life: 0.45, up: 3, grav: 35, alpha: 0.95, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.2, 1, -0.3], sunColor: 0xffdcae, sunIntensity: 1.15,
    hemiSky: 0x8c7a62, hemiGround: 0x140d08, hemiIntensity: 0.24,
    envIntensity: 0.26, exposure: 1.08, background: 0x050403, shadowRadius: 4,
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = { anim: [] };
    const keep = []; // objects that must not be merged (dynamic)
    const warnRoad = (what, x, z, m = 0.5) => { if (!K.offRoad(x, z, m)) console.warn(`pool: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const sAt = (x, z) => track.distTo(x, z).s;
    const inPoly = (x, z, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };

    // ---------------- batched contact shadows (opacity rides in the unused y scale) ----------------
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });

    // ---------------- chalk decals: one atlas, one mesh ----------------
    const decals = [];
    const decal = (cell, x, z, w, h, ang = 0, y = 0.07) => decals.push({ cell, x, z, w, h, ang, y });

    // polygon minus pocket circles (outline sampled, covered runs replaced by arcs bulging into the polygon)
    const cutCircles = (poly, circles, step = 0.35) => {
      const cover = (x, z) => { for (const c of circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return c; return null; };
      const S = [];
      for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
        const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
        for (let j = 0; j < m; j++) S.push([ax + (bx - ax) * j / m, az + (bz - az) * j / m, j === 0]);
      }
      const N = S.length;
      let st = 0; while (cover(S[st][0], S[st][1])) st++;
      const out = [];
      for (let k = 0; k < N;) {
        const s = S[(st + k) % N];
        const c = cover(s[0], s[1]);
        if (!c) { if (s[2]) out.push([s[0], s[1]]); k++; continue; }
        let e = k; while (e < N && cover(S[(st + e) % N][0], S[(st + e) % N][1]) === c) e++;
        const a = S[(st + k - 1 + N) % N], b = S[(st + e) % N];
        const a0 = Math.atan2(a[1] - c.z, a[0] - c.x), a1 = Math.atan2(b[1] - c.z, b[0] - c.x);
        let d = a1 - a0; while (d <= -PI) d += 2 * PI; while (d > PI) d -= 2 * PI;
        const mid = (dd) => [c.x + Math.cos(a0 + dd / 2) * c.r * 0.999, c.z + Math.sin(a0 + dd / 2) * c.r * 0.999];
        let dd = d; { const q = mid(dd); if (!inPoly(q[0], q[1], poly)) dd = d > 0 ? d - 2 * PI : d + 2 * PI; }
        const m = Math.ceil(Math.abs(dd) / 0.1);
        for (let i = 0; i <= m; i++) { const ang = a0 + dd * i / m; out.push([c.x + Math.cos(ang) * c.r, c.z + Math.sin(ang) * c.r]); }
        k = e;
      }
      return out;
    };
    const shapeOf = (pts) => { const s = new T.Shape(); s.moveTo(pts[0][0], -pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]); s.closePath(); return s; };

    // =====================================================================================
    // FELT
    // =====================================================================================
    const pocketU = POCKETS.map((p) => V2(p.x, p.z));
    const macroTex = (() => {
      const n = TX.noiseField(128, { seed: 77, period: 4, oct: 4 });
      const c = TX.paint(128, 128, (x, y, u, v, o) => { const t = n[y * 128 + x]; o[0] = o[1] = o[2] = t * 255; });
      return TX.toTexture(c, { srgb: false });
    })();
    const felt = (() => {
      const S = 512;
      const blot = TX.noiseField(256, { seed: 31, period: 6, oct: 4 });
      const streak = TX.noiseField(S, { seed: 32, period: 96, oct: 2, sx: 0.08, sy: 1 });
      const h = new Float32Array(S * S);
      const rr = K.rng(9);
      const C = [20, 100, 64];
      const map = TX.paint(S, S, (x, y, u, v, o) => {
        const b = TX.sampleField(blot, 256, u * 256, v * 256);
        const st = streak[y * S + x];
        const fz = rr();
        const k = 0.93 + (b - 0.5) * 0.12 + (st - 0.5) * 0.09 + (fz - 0.5) * 0.17;
        o[0] = C[0] * k; o[1] = C[1] * k; o[2] = C[2] * k;
        h[y * S + x] = fz * 0.55 + st * 0.45;
      });
      // a few lighter lint fibres
      const g = map.getContext('2d');
      g.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const x = rr() * S, y = rr() * S, a = rr() * 6.283, l = 2 + rr() * 6;
        g.strokeStyle = `rgba(${150 + rr() * 60 | 0},${190 + rr() * 50 | 0},${160 + rr() * 40 | 0},${0.1 + rr() * 0.18})`; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      const t = TX.toTexture(map), n = TX.toTexture(TX.normalFromHeight(h, S, S, 0.9), { srgb: false });
      for (const tt of [t, n]) tt.repeat.set(1 / 26, 1 / 26);
      return { map: t, normalMap: n };
    })();
    const feltMat = K.phys({ map: felt.map, normalMap: felt.normalMap, normalScale: V2(0.7), roughness: 0.97, color: 0xffffff, envMapIntensity: 0.4, sheen: 0.55, sheenRoughness: 0.55, sheenColor: new T.Color(0x5fae7c) });
    feltMat.onBeforeCompile = (sh) => {
      sh.uniforms.uPk = { value: pocketU };
      sh.uniforms.uMacro = { value: macroTex };
      sh.vertexShader = 'varying vec2 vWXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = 'varying vec2 vWXZ;\nuniform vec2 uPk[6];\nuniform sampler2D uMacro;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 wp = vWXZ;
          float mac = texture2D(uMacro, wp / 190.0).r;
          diffuseColor.rgb *= 0.9 + mac * 0.2;
          float lp = length(wp / vec2(150.0, 84.0));
          diffuseColor.rgb *= 1.0 - 0.45 * smoothstep(0.28, 1.05, lp);
          float wear = 0.0;
          for (int i = 0; i < 6; i++) wear = max(wear, 1.0 - smoothstep(4.5, 15.0, distance(wp, uPk[i])));
          wear = max(wear, 0.4 * (1.0 - smoothstep(0.0, 3.5, abs(abs(wp.y) - 60.8))) * step(abs(wp.x), 125.0));
          wear = max(wear, 0.4 * (1.0 - smoothstep(0.0, 3.5, abs(abs(wp.x) - 124.3))) * step(abs(wp.y), 61.0));
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 worn = mix(diffuseColor.rgb, vec3(lum), 0.35) * 1.35 + vec3(0.006, 0.01, 0.008);
          diffuseColor.rgb = mix(diffuseColor.rgb, worn, wear * 0.55);
        }`);
    };
    {
      const outline = cutCircles([[-BX, -BZ], [BX, -BZ], [BX, BZ], [-BX, BZ]], POCKETS);
      const g = new T.ShapeGeometry(shapeOf(outline), 8);
      g.rotateX(-PI / 2);
      K.mesh(g, feltMat, 0, 0, 0, { cast: false });
    }

    // =====================================================================================
    // CUSHIONS, RAILS, POCKETS, TABLE BODY
    // =====================================================================================
    const railWood = TX.woodTextures({ size: 512, seed: 41, planks: 1, gap: 0, base: 0x431b0d, dark: 0x1c0803, light: 0x6c3019, ringFreq: 9, roughBase: 0.3, lacquer: 0.8, varyPlanks: 0, figure: 1.3 });
    for (const t of Object.values(railWood)) t.repeat.set(1 / 36, 1 / 90);
    const railMat = K.phys({ map: railWood.map, normalMap: railWood.normalMap, normalScale: V2(0.12), color: 0xb08070, roughness: 0.55, specularIntensity: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
    // cushions: felt-covered rubber, nose at the playing-surface edge
    {
      const cushions = [];
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
        // long rails: from the corner jaw to the side jaw
        cushions.push([[sx * 119.5, sz * HZ], [sx * 7.0, sz * HZ], [sx * 6.3, sz * BZ], [sx * 123.8, sz * BZ]]);
      }
      for (const sx of [-1, 1]) cushions.push([[sx * HX, -55.5], [sx * HX, 55.5], [sx * BX, 59.5], [sx * BX, -59.5]]);
      const geos = [];
      for (const q of cushions) {
        // pull the nose 0.6 back so the bevel lands it on the cushion line
        const cx = q.reduce((a, p) => a + p[0], 0) / 4, cz = q.reduce((a, p) => a + p[1], 0) / 4;
        const qq = q.map(([x, z], i) => {
          if (i > 1) return [x, z];
          const horiz = Math.abs(q[0][1] - q[1][1]) < 0.01;
          return horiz ? [x + Math.sign(cx - x) * 0.6, z + Math.sign(cz - z) * 0.6] : [x + Math.sign(cx - x) * 0.6, z + Math.sign(cz - z) * 0.6];
        });
        const g = new T.ExtrudeGeometry(shapeOf(qq), { depth: CUSH_Y - 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3, curveSegments: 4 });
        g.rotateX(-PI / 2); g.translate(0, 0.6, 0);
        geos.push(g);
      }
      const m = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false), feltMat);
      K.add(m);
      // colliders: cushion faces + jaws (rubber: a bit bouncy)
      const B = { bounce: 0.5 };
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
        K.box(sx * 63.25, sz * 66.5, 56.25, 3, 0, 7, B);
        K.capsule(sx * 7.0, sz * HZ, sx * 6.3, sz * BZ, 0.5, 7, B);
        K.capsule(sx * 119.5, sz * HZ, sx * 123.8, sz * BZ, 0.5, 7, B);
      }
      for (const sx of [-1, 1]) {
        K.box(sx * 130, 0, 3, 55.5, 0, 7, B);
        K.capsule(sx * HX, -55.5, sx * BX, -59.5, 0.5, 7, B);
        K.capsule(sx * HX, 55.5, sx * BX, 59.5, 0.5, 7, B);
      }
      // shadow line along the base of the cushions
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) AO(sx * 63.25, sz * 63.6, 57, 1.6, 0.42);
      for (const sx of [-1, 1]) AO(sx * 127.1, 0, 1.6, 56, 0.42);
    }
    // wooden rails: four mitred pieces with the pocket cut-outs
    {
      const pieces = [
        { poly: [[-BX, BZ], [BX, BZ], [OX, OZ], [-OX, OZ]], along: 'x' },
        { poly: [[-OX, -OZ], [OX, -OZ], [BX, -BZ], [-BX, -BZ]], along: 'x' },
        { poly: [[BX, -BZ], [OX, -OZ], [OX, OZ], [BX, BZ]], along: 'z' },
        { poly: [[-OX, -OZ], [-BX, -BZ], [-BX, BZ], [-OX, OZ]], along: 'z' },
      ];
      const geos = [];
      for (const pc of pieces) {
        const out = cutCircles(pc.poly, POCKETS, 0.3);
        const g = new T.ExtrudeGeometry(shapeOf(out), { depth: RAIL_Y + 1 - 1.4, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.55, bevelSegments: 3, curveSegments: 6 });
        g.rotateX(-PI / 2); g.translate(0, -1 + 0.7, 0);
        if (pc.along === 'x') { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i)); }
        geos.push(g.index ? g.toNonIndexed() : g);
      }
      const rail = new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), railMat);
      K.add(rail, { cast: true });
      // mother-of-pearl diamond sights inlaid in the rail tops
      const ds = new T.Shape(); ds.moveTo(-0.95, 0); ds.lineTo(0, 0.5); ds.lineTo(0.95, 0); ds.lineTo(0, -0.5); ds.closePath();
      const dg = new T.ShapeGeometry(ds); dg.rotateX(-PI / 2);
      const pearl = K.phys({ color: 0xf3eee4, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 520], sheen: 0.4, sheenColor: new T.Color(0xcfe6ff) });
      const list = [];
      const midL = (BZ + OZ) / 2, midS = (BX + OX) / 2;
      for (const sz of [-1, 1]) for (const x of [-95.25, -63.5, -31.75, 31.75, 63.5, 95.25]) list.push({ x, y: RAIL_Y + 0.02, z: sz * midL, ry: PI / 2 });
      for (const sx of [-1, 1]) for (const z of [-31.75, 0, 31.75]) list.push({ x: sx * midS, y: RAIL_Y + 0.02, z, ry: 0 });
      K.instances(dg, pearl, list, { cast: false });
      // thin brass-coloured bead along the rail's inner top edge
    }
    // pockets: leather cups with a rolled leather rim where they cut the rail
    {
      const leather = K.phys({ color: 0x24140b, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: new T.Color(0x6a4a30), side: T.DoubleSide });
      // pocket liner: stitched leather collar (v 0..0.25 of the lathe), then a crocheted net bag
      const pc = TX.makeCanvas(128, 256); const pg = pc.getContext('2d');
      const pgr = pg.createLinearGradient(0, 0, 0, 256);
      pgr.addColorStop(0, '#020101'); pgr.addColorStop(0.55, '#0b0705'); pgr.addColorStop(0.75, '#120a05'); pgr.addColorStop(0.76, '#1c110a'); pgr.addColorStop(1, '#2c1a0e');
      pg.fillStyle = pgr; pg.fillRect(0, 0, 128, 256);
      // net: diagonal cords
      pg.lineWidth = 2.2;
      for (let i = -8; i < 16; i++) for (const d of [1, -1]) {
        pg.strokeStyle = 'rgba(120,96,70,0.55)';
        pg.beginPath(); pg.moveTo(i * 16, 0); pg.lineTo(i * 16 + d * 192, 192); pg.stroke();
      }
      const fade = pg.createLinearGradient(0, 0, 0, 192); fade.addColorStop(0, 'rgba(2,1,1,0.92)'); fade.addColorStop(0.7, 'rgba(2,1,1,0.25)'); fade.addColorStop(1, 'rgba(2,1,1,0)');
      pg.fillStyle = fade; pg.fillRect(0, 0, 128, 192);
      // leather collar: grain + stitching
      const nr0 = K.rng(91);
      for (let i = 0; i < 700; i++) { pg.fillStyle = nr0() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,220,180,0.06)'; pg.fillRect(nr0() * 128, 194 + nr0() * 62, 2, 2); }
      pg.strokeStyle = 'rgba(200,170,120,0.5)'; pg.lineWidth = 2; pg.setLineDash([6, 5]);
      pg.beginPath(); pg.moveTo(0, 204); pg.lineTo(128, 204); pg.stroke();
      pg.beginPath(); pg.moveTo(0, 248); pg.lineTo(128, 248); pg.stroke();
      pg.setLineDash([]);
      const pocketTex = TX.toTexture(pc);
      pocketTex.repeat.set(4, 1);
      const inner = K.std({ map: pocketTex, color: 0x9a9a9a, roughness: 0.7, envMapIntensity: 0.3, side: T.DoubleSide });
      const rimGeos = [];
      for (const p of POCKETS) {
        const cup = K.lathe([[p.r - 0.18, RAIL_Y + 0.05], [p.r - 0.18, -1.0], [p.r - 0.5, -7], [p.r - 1.4, -12.4], [0.01, -13]], 32);
        // the liner only rises above the cloth where it lines the cushion/rail cut-out; on the
        // playing-surface side the pocket simply opens at felt level
        const cp = cup.attributes.position;
        for (let i = 0; i < cp.count; i++) if (cp.getY(i) > 0 && Math.abs(p.x + cp.getX(i)) < HX - 0.05 && Math.abs(p.z + cp.getZ(i)) < HZ - 0.05) cp.setY(i, -0.03);
        K.mesh(cup, inner, p.x, 0, p.z, { cast: true });
        // rim arc over the rail
        const pts = [];
        let a0 = null, a1 = null;
        const outside = (a) => { const x = p.x + Math.cos(a) * p.r, z = p.z + Math.sin(a) * p.r; return Math.abs(x) > BX + 0.2 || Math.abs(z) > BZ + 0.2; };
        // find the contiguous outside range
        const N = 180; let startI = 0;
        for (let i = 0; i < N; i++) if (!outside(i / N * 2 * PI)) { startI = i; break; }
        for (let k = 1; k <= N; k++) {
          const a = ((startI + k) % N) / N * 2 * PI;
          if (outside(a)) { if (a0 === null) a0 = startI + k; a1 = startI + k; }
        }
        for (let i = a0 - 1; i <= a1 + 1; i++) { const a = i / N * 2 * PI; pts.push(new T.Vector3(p.x + Math.cos(a) * (p.r + 0.15), RAIL_Y + 0.05, p.z + Math.sin(a) * (p.r + 0.15))); }
        rimGeos.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.8, 8, false).toNonIndexed());
        // leather apron down the jaws
        AO(p.x - Math.sign(p.x) * 2.5, p.z - Math.sign(p.z) * 2.5, 6.5, 6.5, 0.35);
      }
      K.add(new T.Mesh(K.BufferGeometryUtils.mergeGeometries(rimGeos, false), leather));
      for (const p of POCKETS) K.hole(p.x, p.z, p.r);
    }
    // table body, legs, floor, rug
    const bodyMat = K.std({ map: railWood.map, color: 0x9a7a6a, roughness: 0.38, envMapIntensity: 0.6 });
    {
      for (const sz of [-1, 1]) K.mesh(new T.BoxGeometry(2 * OX - 2, 19, 2.2), bodyMat, 0, -10.6, sz * (OZ - 2.1), { cast: false });
      for (const sx of [-1, 1]) K.mesh(new T.BoxGeometry(2.2, 19, 2 * OZ - 2), bodyMat, sx * (OX - 2.1), -10.6, 0, { cast: false });
      K.mesh(new T.BoxGeometry(2 * OX + 1.2, 2.2, 2 * OZ + 1.2), railMat, 0, -20.6, 0, { cast: false });
      const legProf = [[9, 0], [9, 4], [7.5, 5], [6, 9], [5.2, 18], [6.5, 24], [5, 30], [4.6, 40], [6.5, 46], [7.5, 50], [7.5, 54.5], [0.01, 54.5]];
      const legGeo = K.lathe(legProf, 20);
      for (const [x, z] of [[-122, -60], [0, -60], [122, -60], [-122, 60], [0, 60], [122, 60]]) K.mesh(legGeo, bodyMat, x, -76, z, { cast: false });
      // floor: dark oak boards with the lamp's spill fading out into the room
      const fw = TX.woodTextures({ size: 512, seed: 41, planks: 4, base: 0x4a2c18, dark: 0x22120a, light: 0x6a4428, ringFreq: 14, gap: 0.006, gapColor: 0x0c0604, roughBase: 0.45, lacquer: 0.3 });
      for (const t of Object.values(fw)) t.repeat.set(1600 / 64, 1600 / 64);
      const fg = new T.PlaneGeometry(1600, 1600, 48, 48); fg.rotateX(-PI / 2);
      const pos = fg.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i) / 1.6, pos.getZ(i));
        const k = 0.12 + 0.88 * Math.exp(-((d / 210) ** 2));
        col[i * 3] = k; col[i * 3 + 1] = k * 0.95; col[i * 3 + 2] = k * 0.9;
      }
      fg.setAttribute('color', new T.BufferAttribute(col, 3));
      K.mesh(fg, K.std({ map: fw.map, normalMap: fw.normalMap, roughnessMap: fw.roughnessMap, vertexColors: true, normalScale: V2(0.5) }), 0, -76, 0, { cast: false });
      // rug under the table
      const rc = TX.makeCanvas(512, 340);
      const g = rc.getContext('2d');
      g.fillStyle = '#5a1418'; g.fillRect(0, 0, 512, 340);
      g.strokeStyle = '#1d2a44'; g.lineWidth = 26; g.strokeRect(22, 22, 468, 296);
      g.strokeStyle = '#b8893a'; g.lineWidth = 4; g.strokeRect(8, 8, 496, 324); g.strokeRect(38, 38, 436, 264);
      for (let i = 0; i < 60; i++) { g.fillStyle = i % 2 ? '#8a6a32' : '#5a2420'; g.fillRect(14 + (i / 59) * 476, 19, 8, 6); g.fillRect(14 + (i / 59) * 476, 315, 8, 6); }
      g.fillStyle = '#7a2228'; g.beginPath(); g.ellipse(256, 170, 120, 70, 0, 0, 6.283); g.fill();
      g.strokeStyle = '#b8893a'; g.lineWidth = 3; g.beginPath(); g.ellipse(256, 170, 100, 56, 0, 0, 6.283); g.stroke();
      g.fillStyle = '#1d2a44'; g.beginPath(); g.ellipse(256, 170, 40, 24, 0, 0, 6.283); g.fill();
      // darken (dim room) and add a little pile speckle without a pixel readback
      g.fillStyle = 'rgba(8,4,3,0.5)'; g.fillRect(0, 0, 512, 340);
      const nr = K.rng(4);
      for (let i = 0; i < 2500; i++) { g.fillStyle = nr() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,200,0.05)'; g.fillRect(nr() * 512, nr() * 340, 2, 2); }
      K.mesh(new T.PlaneGeometry(400, 266), K.std({ map: TX.toTexture(rc, { wrap: false }), roughness: 1 }), 0, -75.7, 6, { rx: -PI / 2, cast: false });
      // two bar stools waiting at the ends of the table (seen past the short rails)
      {
        const vinyl = K.phys({ color: 0x4a1410, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new T.Color(0x8a4a3a) });
        const chrome = K.metal(0xd8dade, 0.18);
        const seatGeo = K.lathe([[0.01, 0], [14.5, 0], [17.3, 0.9], [18.5, 2.9], [18.7, 5.6], [18.1, 7.8], [16.3, 9.0], [8, 9.5], [0.01, 9.6]], 40);
        const pipeGeo = new T.TorusGeometry(18.55, 0.45, 6, 48);
        const legGeo = new T.CylinderGeometry(0.9, 0.9, 1, 10);
        const ringGeo = new T.TorusGeometry(17, 0.85, 8, 40);
        const up = new T.Vector3(0, 1, 0);
        for (const [sx, sz, rot] of [[-171, 14, 0.4], [173, -24, 1.1]]) {
          const top = -13.3;
          K.mesh(seatGeo, vinyl, sx, top, sz);
          K.mesh(pipeGeo, vinyl, sx, top + 5.6, sz, { rx: PI / 2 });
          K.mesh(new T.CylinderGeometry(13, 13, 2.2, 32), chrome, sx, top - 1.1, sz);
          for (let i = 0; i < 4; i++) {
            const a = rot + i * PI / 2;
            const p0 = new T.Vector3(sx + Math.cos(a) * 10, top - 2, sz + Math.sin(a) * 10);
            const p1 = new T.Vector3(sx + Math.cos(a) * 19, -76, sz + Math.sin(a) * 19);
            const d = p1.clone().sub(p0);
            const leg = K.mesh(legGeo, chrome, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
            leg.scale.y = d.length();
            leg.quaternion.setFromUnitVectors(up, d.normalize());
          }
          K.mesh(ringGeo, chrome, sx, -50, sz, { rx: PI / 2, scale: 0.92 });
        }
      }
      // the table's own shadow on the rug
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      sh.rotation.x = -PI / 2; sh.scale.set(OX * 2.7, OZ * 2.9, 1); sh.position.set(-8, -75.5, -10); sh.renderOrder = 1;
      K.group.add(sh);
    }

    // the three-shade billiard lamp: three warm pools of light along the table (the directional light
    // carries the shadows); the far corners and the room fall off into darkness
    {
      for (const x of [-84, 0, 84]) {
        const spot = new T.SpotLight(0xffc483, 1.35, 0, 0.84, 1.0, 0);
        spot.position.set(x, 100, -3);
        spot.target.position.set(x, 0, -1);
        spot.castShadow = false;
        K.group.add(spot, spot.target);
      }
    }

    // =====================================================================================
    // CHALK ROAD: edge lines + faint centre dashes drawn on the felt
    // =====================================================================================
    const RW = 16.6;
    {
      const EW = 256, EH = 1024; // EH px = 64 units along
      const c = TX.makeCanvas(EW, EH);
      const g = c.getContext('2d');
      const pxu = EW / RW;
      const sinP = (y, k, ph) => Math.sin((y / EH) * 2 * PI * k + ph);
      for (const side of [0, 1]) {
        const cx0 = side ? EW - 1.3 * pxu : 1.3 * pxu;
        for (let y = 0; y < EH; y += 1) {
          const wob = sinP(y, 3, side * 2) * 1.6 + sinP(y, 7, side + 1) * 0.9 + sinP(y, 17, side * 3) * 0.35;
          const wid = 11 + sinP(y, 5, side) * 1.5 + sinP(y, 11, 1 + side) * 1;
          const al = 0.86 + 0.12 * sinP(y, 9, side * 4) - (sinP(y, 2, side * 5) > 0.93 ? 0.4 : 0);
          // core stroke + softer chalk edges
          g.fillStyle = `rgba(245,247,240,${al * 0.35})`; g.fillRect(cx0 + wob - wid / 2 - 2.5, y, wid + 5, 1);
          g.fillStyle = `rgba(245,247,240,${al})`; g.fillRect(cx0 + wob - wid / 2, y, wid, 1);
        }
      }
      // centre dashes every 8 units
      for (let k = 0; k < 8; k++) {
        const y0 = k * 128 + 20;
        for (let y = y0; y < y0 + 38; y++) {
          const t = (y - y0) / 38, al = 0.42 * Math.min(1, t * 6, (1 - t) * 6);
          g.fillStyle = `rgba(255,255,255,${al})`; g.fillRect(EW / 2 - 3 + Math.sin(y * 0.2) * 0.6, y, 6, 1);
        }
      }
      // chalk grain: streaky alpha noise along the stroke
      const nf = TX.noiseField(256, { seed: 12, period: 64, oct: 2, sx: 1, sy: 0.08 });
      const nr = K.rng(13);
      // grain mask (alpha = how much chalk to rub away), composited without a pixel readback
      const grain = TX.paint(EW, EH, (x, y, u, v, o) => {
        const k = Math.min(1, 0.32 + 0.45 * TX.sampleField(nf, 256, x, y * 0.25) + nr() * 0.38);
        o[0] = o[1] = o[2] = 0; o[3] = (1 - k) * 255;
      });
      g.globalCompositeOperation = 'destination-out'; g.drawImage(grain, 0, 0); g.globalCompositeOperation = 'source-over';
      const t = TX.toTexture(c);
      const mat = K.std({ map: t, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      K.ribbon({ mat, y: 0.05, vScale: L / Math.round(L / 64), widthFn: (w) => w + 2.6 });
    }

    // =====================================================================================
    // SHARED MATERIALS / TEXTURES FOR PROPS
    // =====================================================================================
    // ---- pool balls: one atlas for all 16 ----
    const BALL_COL = { 1: '#f2b100', 2: '#1a48a8', 3: '#cf1b1b', 4: '#4a2779', 5: '#ef6a10', 6: '#0e7a3c', 7: '#7a1616', 8: '#121212' };
    const ballAtlas = TX.makeCanvas(1024, 512);
    {
      const ag = ballAtlas.getContext('2d');
      for (let n = 0; n < 16; n++) {
        const c = TX.makeCanvas(256, 128); const g = c.getContext('2d');
        const stripe = n >= 9, colr = n === 0 ? '#f3efe2' : BALL_COL[stripe ? n - 8 : n];
        g.fillStyle = stripe || n === 0 ? '#f3efe2' : colr; g.fillRect(0, 0, 256, 128);
        if (stripe) { g.fillStyle = colr; g.fillRect(0, 128 * 0.3, 256, 128 * 0.4); }
        if (n > 0) for (const cx of [64, 192]) {
          g.fillStyle = '#f6f2e6'; g.beginPath(); g.arc(cx, 64, 14, 0, 6.283); g.fill();
          g.fillStyle = '#121212'; g.font = `700 ${n > 9 ? 15 : 18}px Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(String(n), cx, 65);
          if (n === 6 || n === 9) g.fillRect(cx - 4, 74, 8, 1.6);
        } else {
          // cue ball: a red spot and blue chalk kisses
          g.fillStyle = '#c8322c'; g.beginPath(); g.arc(64, 64, 4, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(60,110,200,0.5)';
          for (const [x, y] of [[150, 50], [170, 80], [30, 90], [210, 40]]) { g.beginPath(); g.arc(x, y, 2.4, 0, 6.283); g.fill(); }
        }
        const x = (n % 4) * 256, y = Math.floor(n / 4) * 128;
        ag.save(); ag.beginPath(); ag.rect(x, y, 256, 128); ag.clip();
        ag.drawImage(c, x - 10, y - 5, 276, 138);
        ag.restore();
        ag.drawImage(c, x + 8, y + 4, 240, 120);
      }
    }
    const ballTex = TX.toTexture(ballAtlas, { wrap: false });
    const ballMat = K.phys({ map: ballTex, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1 });
    const ballBase = new T.SphereGeometry(BALL_R, 32, 20);
    const ballGeo = (n) => {
      const g = ballBase.clone();
      const uv = g.attributes.uv;
      const x = (n % 4) * 256, y = Math.floor(n / 4) * 128;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + 8 + uv.getX(i) * 240) / 1024, 1 - (y + 4 + (1 - uv.getY(i)) * 120) / 512);
      return g;
    };
    const randQuat = (m) => { m.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28); };
    const staticBall = (n, x, z, y = BALL_R, rot = true) => {
      const m = K.mesh(ballGeo(n), ballMat, x, y, z);
      if (rot) { m.rotation.set(r.range(-0.6, 0.6), r() * 6.28, r.range(-0.6, 0.6)); }
      return m;
    };
    const pushBall = (n, x, z) => {
      const m = K.mesh(ballGeo(n), ballMat, x, BALL_R, z);
      randQuat(m); m.rotation.x = r.range(-0.5, 0.5);
      keep.push(m);
      K.physics.addDynamic({ x, z, r: BALL_R, m: 1.5, h: BALL_R * 2, mesh: m, friction: 5.5, baseY: BALL_R, respawn: 5 });
      return m;
    };

    // ---- blue chalk cube: wrapper on the sides, worn chalk dish on top ----
    const chalkMat = (() => {
      const c = TX.makeCanvas(256, 128); const g = c.getContext('2d');
      g.fillStyle = '#1d4c9c'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#f2efe4'; g.fillRect(0, 44, 128, 40);
      g.fillStyle = '#1d4c9c'; g.font = '700 22px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHALK', 64, 65);
      g.fillStyle = '#d9c46a'; for (const [x, y] of [[20, 22], [108, 22], [20, 106], [108, 106]]) { g.beginPath(); g.arc(x, y, 5, 0, 6.283); g.fill(); }
      g.strokeStyle = 'rgba(120,170,240,0.6)'; g.lineWidth = 3; g.strokeRect(3, 3, 122, 122);
      // top: blue chalk, worn into a hollow by the cue tip
      const nf = TX.noiseField(128, { seed: 61, period: 16, oct: 3 });
      const top = TX.paint(128, 128, (x, y, u, v, o) => {
        const t = nf[y * 128 + x]; const d = Math.hypot(u - 0.5, v - 0.47);
        const dish = d < 0.3 ? 0.72 + d * 0.6 : d < 0.34 ? 1.12 : 1;
        o[0] = (54 + t * 40) * dish; o[1] = (110 + t * 50) * dish; o[2] = (196 + t * 40) * dish;
      });
      g.drawImage(top, 128, 0);
      return K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.92 });
    })();
    const chalkGeo = (() => {
      const g = new K.RoundedBoxGeometry(2.3, 2.3, 2.3, 2, 0.16);
      const uv = g.attributes.uv, blk = uv.count / 6;
      for (let i = 0; i < uv.count; i++) { const face = Math.floor(i / blk); uv.setX(i, face === 2 ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5); }
      g.clearGroups();
      return g;
    })();
    const chalkCube = (x, z, { y = 0, ry = r() * 6.28, push = false } = {}) => {
      const m = K.mesh(chalkGeo, chalkMat, x, y + 1.15, z, { ry });
      if (push) {
        keep.push(m);
        K.physics.addDynamic({ x, z, r: 1.45, m: 0.6, h: 2.3, mesh: m, slide: true, friction: 24, baseY: y + 1.15 });
      } else if (y === 0) K.box(x, z, 1.15, 1.15, -ry, 2.3);
      if (!push) AO(x, z, 2.0, 2.0, 0.42, -ry, y + 0.06);
      return m;
    };

    // ---- cues ----
    const cueTex = (design) => {
      const W = 64, H = 2048, Lc = 147;
      const c = TX.makeCanvas(W, H); const g = c.getContext('2d');
      const Y = (s) => (1 - s / Lc) * H; // distance from the tip -> canvas row
      const band = (s0, s1, col) => { g.fillStyle = col; g.fillRect(0, Y(s1), W, Y(s0) - Y(s1)); };
      const nr = K.rng(design.seed);
      // shaft: maple with fine grain, a little grubby where the bridge hand slides
      band(0, 147, design.shaft);
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(150,110,60,${0.05 + nr() * 0.08})`; g.lineWidth = 0.6 + nr(); const x = nr() * W; g.beginPath(); g.moveTo(x, Y(72)); g.lineTo(x + nr() * 3 - 1.5, Y(3)); g.stroke(); }
      const grime = g.createLinearGradient(0, Y(40), 0, Y(14)); grime.addColorStop(0, 'rgba(90,100,120,0)'); grime.addColorStop(0.5, 'rgba(90,100,120,0.18)'); grime.addColorStop(1, 'rgba(90,100,120,0)');
      g.fillStyle = grime; g.fillRect(0, Y(40), W, Y(14) - Y(40));
      band(0, 1.25, '#3e6cb4'); // chalked leather tip
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(30,60,120,${nr() * 0.5})`; g.fillRect(nr() * W, Y(1.25) + nr() * (Y(0) - Y(1.25)), 2, 2); }
      band(1.25, 3.1, '#f1ebdc'); // ferrule
      band(72, 74.8, '#c9cdd2'); band(72.8, 73.2, '#1a1a1a'); band(74.0, 74.4, '#1a1a1a'); // joint
      band(74.8, 112, design.fore); // forearm
      if (design.points) {
        for (let k = 0; k < 4; k++) {
          const cx = (k + 0.5) * W / 4;
          const tri = (wh, col, tip) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - wh, Y(112)); g.lineTo(cx, Y(tip)); g.lineTo(cx + wh, Y(112)); g.closePath(); g.fill(); };
          tri(7.2, design.v1, 82.5); tri(6.2, design.v2, 84); tri(5.2, design.points, 85.5);
        }
      }
      for (let i = 0; i < 20; i++) { g.strokeStyle = `rgba(0,0,0,${0.04 + nr() * 0.06})`; g.lineWidth = 1; const x = nr() * W; g.beginPath(); g.moveTo(x, Y(112)); g.lineTo(x + nr() * 4 - 2, Y(75)); g.stroke(); }
      band(112, 113.2, '#e9e3d2'); band(112.4, 112.8, design.ring);
      band(113.2, 133, design.wrap); // linen wrap
      g.save(); g.beginPath(); g.rect(0, Y(133), W, Y(113.2) - Y(133)); g.clip();
      for (let y = Y(133); y < Y(113.2); y += 3) { g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 10); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(0, y + 1.5); g.lineTo(W, y + 11.5); g.stroke(); }
      g.restore();
      band(133, 134.2, '#e9e3d2'); band(133.4, 133.8, design.ring);
      band(134.2, 145, design.sleeve);
      if (design.label) {
        g.save(); g.translate(W / 2, (Y(144) + Y(135)) / 2); g.rotate(-PI / 2);
        g.fillStyle = design.label; g.font = '700 18px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(design.text, 0, 0);
        g.restore();
      } else {
        for (let k = 0; k < 8; k++) { g.fillStyle = '#efe9f4'; const x = (k + 0.5) * W / 8, y = Y(139.5); g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 2.6, y); g.lineTo(x, y + 9); g.lineTo(x - 2.6, y); g.closePath(); g.fill(); }
      }
      band(145, 147, '#111111'); // rubber bumper
      return c;
    };
    const cueGeo = (() => {
      const prof = [[0.01, 0], [0.5, 0.04], [0.63, 0.25], [0.64, 1.25], [0.665, 1.3], [0.665, 3.1], [0.65, 3.15], [0.66, 30], [0.82, 72], [1.0, 72.05], [1.0, 74.8],
        [0.98, 74.85], [1.2, 112], [1.25, 112.05], [1.25, 133], [1.28, 133.05], [1.28, 134.2], [1.45, 145], [1.43, 146.5], [1.25, 147], [0.01, 147]];
      const g = K.lathe(prof, 24);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / 147);
      g.rotateZ(-PI / 2); // tip at x=0, butt at x=147
      g.rotateZ(Math.atan2(1.45 - 0.64, 147)); // lies on the felt at both ends
      return g;
    })();
    // all cues share one texture atlas (64 px column each) and one merged mesh
    const cueList = [];
    const cue = (x0, z0, x1, z1, design) => {
      const ang = Math.atan2(z1 - z0, x1 - x0), len = Math.hypot(x1 - x0, z1 - z0);
      cueList.push({ x0, z0, ang, len, design });
      K.capsule(x0 + Math.cos(ang) * 1, z0 + Math.sin(ang) * 1, x1 - Math.cos(ang) * 1, z1 - Math.sin(ang) * 1, 1.15, 2.6);
      for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; AO(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, len / 12 + 1, 0.9 + t * 0.9, 0.42, ang); }
      for (const t of [0.05, 0.3, 0.55, 0.8, 0.98]) warnRoad('cue', x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 1.5);
    };
    const flushCues = () => {
      const n = cueList.length;
      const atlas = TX.makeCanvas(64 * n, 2048); const ag = atlas.getContext('2d');
      const geos = cueList.map((c, i) => {
        ag.drawImage(cueTex(c.design), i * 64, 0);
        const g = cueGeo.clone();
        const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + 0.02 + uv.getX(k) * 0.96) / n);
        g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(c.x0, 0.64, c.z0), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -c.ang), new T.Vector3(c.len / 147, 1, 1)));
        return g;
      });
      K.add(new T.Mesh(K.BufferGeometryUtils.mergeGeometries(geos, false), K.phys({ map: TX.toTexture(atlas, { wrap: false }), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 })));
    };

    // ---- wood for the rack, pencil, bowl ----
    const lightWood = TX.woodTextures({ size: 256, seed: 41, planks: 1, gap: 0, base: 0xb0703a, dark: 0x6a3a18, light: 0xd8a065, ringFreq: 16, roughBase: 0.35, lacquer: 0.6, varyPlanks: 0 });
    for (const t of Object.values(lightWood)) t.repeat.set(1 / 6, 1 / 30);
    const lightWoodMat = K.phys({ map: lightWood.map, normalMap: lightWood.normalMap, normalScale: V2(0.3), roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15 });

    // =====================================================================================
    // LANDMARKS
    // =====================================================================================
    // ---- three cues lying between the lanes ----
    cue(91, 31.6, -56, 34.2, { seed: 1, shaft: '#e6cb98', fore: '#d6b277', points: '#16100c', v1: '#f2eee2', v2: '#a8261c', wrap: '#1b1b1d', sleeve: '#1a110c', ring: '#c8a24a' });
    // (the middle cue is the moving one: built with the cue ball below)
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, x0 = -13.2, x1 = 117; AO(x0 + (x1 - x0) * t, 0.6 + 0.8 * t, (x1 - x0) / 12 + 1, 0.9 + t * 0.9, 0.42, 0.006); }
    cue(95, -31.4, -40, -33.2, { seed: 3, shaft: '#e2c690', fore: '#dcbc86', points: null, wrap: '#1d1d1d', sleeve: '#0f3d26', ring: '#d4b04c', label: '#e8d38a', text: '19 oz' });
    flushCues();

    // ---- the rack at the foot spot, ten balls racked (10-ball), back row empty ----
    {
      const ax = -63.5, az = 0; // apex ball on the foot spot, rows go towards the foot rail (-x)
      const dx = BALL_R * 2 * Math.sqrt(3) / 2 + 0.02;
      const racked = [1, 3, 9, 4, 10, 5, 7, 6, 2, 12];
      let k = 0;
      for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) {
        const x = ax - row * dx, z = az + (j - row / 2) * (BALL_R * 2 + 0.03);
        staticBall(racked[k++], x, z);
      }
      // wooden triangle around all five rows
      const off = BALL_R + 0.75; // frame centreline offset from the ball centres
      const apex = [ax + off * 2, az];
      const backX = ax - 4 * dx - off;
      const halfW = (4 * (BALL_R * 2) / 2) + off * Math.sqrt(3);
      const P = [apex, [backX, az - halfW], [backX, az + halfW]];
      for (let i = 0; i < 3; i++) {
        const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 3];
        const len = Math.hypot(x1 - x0, z1 - z0) + 1.2, ang = Math.atan2(z1 - z0, x1 - x0);
        const bar = new T.Mesh(new K.RoundedBoxGeometry(len, 3.0, 1.5, 2, 0.45), lightWoodMat);
        bar.position.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2); bar.rotation.y = -ang;
        K.add(bar);
        K.capsule(x0, z0, x1, z1, 0.9, 3.0);
        AO((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 1, 1.6, 0.42, ang);
      }
      AO(ax - 1.5 * dx, az, 13, 12, 0.3);
      // the foot spot sticker peeking out in front
      warnRoad('rack', apex[0], apex[1], 2); warnRoad('rack', backX, az - halfW, 2); warnRoad('rack', backX, az + halfW, 2);
    }

    // ---- loose balls (pushable): they roll, clack and can be potted ----
    {
      const pl = (s, off) => track.place(s, off);
      let p;
      pushBall(0, CUE.x, CUE.z);                                   // cue ball on the spot by the middle cue: see the break shot below
      const cueBall = K.physics.dynamics[K.physics.dynamics.length - 1];
      pushBall(8, 9.8, 59.9);                                      // 8 hanging over the south side pocket
      p = pl(sAt(46, 47.7), -5.6); pushBall(11, p.x, p.z);         // on the start straight
      pushBall(13, -9.5, -59.9);                                   // at the north side pocket
      p = pl(sAt(-110, 12), -5.8); pushBall(14, p.x, p.z);         // west sweeper, inside
      p = pl(sAt(35, -14), 5.6); pushBall(15, p.x, p.z);           // north-middle lane
      // more loose balls resting against the cushions (pushable, far enough from the racing line)
      pushBall(3, 56, 60.5);
      pushBall(9, -84, -60.5);
      pushBall(5, -124.1, 30);
      pushBall(1, 121.2, -57.6);
      // balls that already went down, lying in the bottom of four pockets
      staticBall(2, -1.2, 65.6, -10);
      staticBall(7, 1.0, -69.0, -10);
      staticBall(12, 130.6, -67.4, -10);
      staticBall(4, -130.6, -67.2, -10);

      // ---- moving hazard: the middle cue slides back and breaks the cue ball across the west hairpin ----
      {
        const ang = Math.atan2(CUE.butt[1] - CUE.tipZ, CUE.butt[0] - (CUE.x + 4));
        const len = Math.hypot(CUE.butt[1] - CUE.tipZ, CUE.butt[0] - (CUE.x + 4));
        const tex = TX.toTexture(cueTex({ seed: 2, shaft: '#e9d1a2', fore: '#5e2412', points: '#efe6d0', v1: '#141414', v2: '#d8c08a', wrap: '#1d2c55', sleeve: '#4a1a0c', ring: '#e8e8ea' }), { wrap: false });
        const stick = new T.Mesh(cueGeo, K.phys({ map: tex, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
        stick.scale.x = len / 147; stick.rotation.y = -ang;
        K.add(stick); keep.push(stick);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const tipAt = (o) => ({ x: CUE.x + 3 - o * ca, z: CUE.tipZ - o * sa }); // tip where the capsule end just meets the ball at o = 0
        K.mover({ type: 'capsule', r: 1.15, h: 2.6 }, (t) => {
          const tp = tipAt(cueStroke(t));
          return { x1: tp.x + ca, z1: tp.z + sa, x2: tp.x + ca * (len - 1), z2: tp.z + sa * (len - 1) };
        });
        A.cue = { stick, tipAt, ball: cueBall, lastU: 0 };
      }
    }

    // ---- pushable chalk cubes on the road edges ----
    {
      let p;
      p = track.place(sAt(62, 47.7), -5.2); chalkCube(p.x, p.z, { push: true });
      p = track.place(sAt(105, 31), -5.4); chalkCube(p.x, p.z, { push: true });
      p = track.place(sAt(-29.5, 0) - 11, 5.2); chalkCube(p.x, p.z, { push: true }); // clear of the break-shot line
    }

    // ---- knocked-over glass of cola: sticky spill across the north lane, beer-mat jump before it ----
    {
      const sR = sAt(-40, -50.3);
      const p = track.place(sR, 0);
      const ang = p.angle, len = 9.7, hgt = 2.35;
      K.ramp(p.x, p.z, ang, len, 10.2, hgt, 0);
      // beer mat
      const mc = TX.makeCanvas(256, 256); const mg = mc.getContext('2d');
      mg.fillStyle = '#efe4c8'; mg.fillRect(0, 0, 256, 256);
      mg.fillStyle = '#8c1d1d'; mg.beginPath(); mg.arc(128, 128, 104, 0, 6.283); mg.fill();
      mg.fillStyle = '#efe4c8'; mg.beginPath(); mg.arc(128, 128, 92, 0, 6.283); mg.fill();
      mg.fillStyle = '#1b1b1b'; mg.beginPath(); mg.arc(128, 128, 30, 0, 6.283); mg.fill();
      mg.fillStyle = '#efe4c8'; mg.font = '700 34px Rubik, sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('8', 128, 130);
      mg.fillStyle = '#8c1d1d'; mg.font = '64px "Lilita One", Impact, sans-serif'; mg.fillText('OLD', 128, 62);
      mg.font = '40px "Lilita One", Impact, sans-serif'; mg.fillText('RAIL ALE', 128, 196);
      mg.strokeStyle = '#8c1d1d'; mg.lineWidth = 5; mg.strokeRect(8, 8, 240, 240);
      const nr = K.rng(21);
      for (let i = 0; i < 1500; i++) { mg.fillStyle = nr() < 0.6 ? 'rgba(90,60,30,0.08)' : 'rgba(255,255,255,0.08)'; mg.fillRect(nr() * 256, nr() * 256, 2, 2); }
      // a wet ring from a glass
      mg.strokeStyle = 'rgba(110,70,30,0.35)'; mg.lineWidth = 8; mg.beginPath(); mg.arc(150, 110, 70, 0.5, 5.6); mg.stroke();
      const matTex = TX.toTexture(mc, { wrap: false });
      matTex.center.set(0.5, 0.5); matTex.rotation = PI; // read upright from the camera
      const coasterSide = K.std({ color: 0xe0d2b0, roughness: 0.9 });
      const coasterTop = K.std({ map: matTex, roughness: 0.85 });
      const coasterGeo = new K.RoundedBoxGeometry(10.2, 0.28, 10.2, 1, 0.12);
      {
        const grp = new T.Group();
        const m = new T.Mesh(coasterGeo, [coasterSide, coasterSide, coasterTop, coasterSide, coasterSide, coasterSide]);
        m.position.y = 0.05;
        grp.add(m);
        grp.position.set(p.x, hgt / 2 + 0.05, p.z);
        grp.rotation.order = 'YZX'; grp.rotation.y = -ang; grp.rotation.z = Math.atan2(hgt, len);
        K.add(grp);
        keep.push(grp);
        // the chalk cube propping it up
        const cx = p.x + Math.cos(ang) * (len / 2 - 1.3), cz = p.z + Math.sin(ang) * (len / 2 - 1.3);
        const cm = K.mesh(chalkGeo, chalkMat, cx, 1.15, cz, { ry: -ang + 0.08 });
        // no collider for the cube: it sits under the mat, and the ramp's own sides already block cars
        AO(p.x, p.z, 6, 5.5, 0.38, ang);
        // chalk arrow on the road pointing at the jump
        const q = track.place(sR - 13, 0);
        decal('arrow', q.x, q.z, 9, 3.2, q.angle);
      }
      // the spill: across the road just beyond the jump
      const colaMat = K.phys({ color: 0x3a1206, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.01, transparent: true, opacity: 0.88, envMapIntensity: 1.6 });
      const sp = track.place(sR + 14, -0.5);
      const spill = K.spill(sp.x, sp.z, 6.7, colaMat, { lump: 0.32, stretch: 1.3, angle: sp.angle + 0.15, y: 0.12, thick: 0.12, n: 56 });
      // amber meniscus where the film thins out, then the wet, darkened felt around it
      K.flatShape(spill.poly.map(([x, z]) => [sp.x + (x - sp.x) * 1.05, sp.z + (z - sp.z) * 1.05]), K.std({ color: 0x8a4214, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false }), 0.055).renderOrder = 1;
      const halo = K.flatShape(spill.poly.map(([x, z]) => [sp.x + (x - sp.x) * 1.16, sp.z + (z - sp.z) * 1.16]), K.std({ color: 0x0a1c10, roughness: 0.6, transparent: true, opacity: 0.42, depthWrite: false }), 0.045);
      // lamp reflections make it read as liquid
      for (const [a, b, sx, sz, op] of [[-1.5, -1.2, 5.5, 1.1, 0.32], [2.2, 1.6, 2.6, 0.6, 0.26], [-3.6, 2.2, 1.4, 0.4, 0.22]]) {
        const hl = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xfff1dc, transparent: true, opacity: op, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
        hl.rotation.order = 'YXZ'; hl.rotation.y = -sp.angle - 0.3; hl.rotation.x = -PI / 2; hl.scale.set(sx, sz, 1);
        hl.position.set(sp.x + a, 0.27, sp.z + b); hl.renderOrder = 3;
        K.group.add(hl);
      }
      halo.renderOrder = 0;
      K.surface('sticky', { poly: spill.poly });
      // stream from the glass mouth
      const gp = track.place(sR + 13, -15.2); // glass centre, in the infield south of the road
      const gAng = Math.atan2(sp.z - gp.z, sp.x - gp.x); // glass axis points at the puddle
      for (let i = 0; i < 4; i++) {
        const t = 0.36 + i * 0.11;
        K.spill(gp.x + (sp.x - gp.x) * t + r.range(-0.5, 0.5), gp.z + (sp.z - gp.z) * t, 2.3 - i * 0.15, colaMat, { lump: 0.3, stretch: 1.6, angle: gAng, y: 0.1, thick: 0.1, n: 28 });
      }
      // bubbles along the puddle rim
      const bub = [];
      for (let i = 0; i < spill.poly.length; i += 2) {
        const [x, z] = spill.poly[i];
        const k = r.range(0.9, 0.98);
        bub.push({ x: sp.x + (x - sp.x) * k, y: 0.13, z: sp.z + (z - sp.z) * k, s: r.range(0.1, 0.24), sy: 0.08 });
        if (r() < 0.5) bub.push({ x: sp.x + (x - sp.x) * (k - 0.05), y: 0.13, z: sp.z + (z - sp.z) * (k - 0.05), s: r.range(0.06, 0.14), sy: 0.06 });
      }
      K.instances(new T.SphereGeometry(1, 8, 5), K.phys({ color: 0xb48a62, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.7 }), bub, { cast: false });
      // the tumbler lying on its side
      {
        const G = 1.0;
        const prof = [[0.01, 0], [3.4, 0], [3.9, 0.2], [4.05, 1.4], [4.25, 9.6], [3.95, 9.6], [3.75, 1.6], [0.01, 1.3]].map(([a, b]) => [a * G, b * G]);
        const glassGeo = K.lathe(prof, 40);
        const grp = new T.Group();
        const gm = new T.Mesh(glassGeo, K.glass(0xe8f4ee, 0.075, { envMapIntensity: 0.75, side: T.FrontSide }));
        gm.renderOrder = 2;
        grp.add(gm);
        // inner wall (back faces) a touch darker so the far wall reads through the near one
        const gIn = new T.Mesh(glassGeo, K.glass(0xc8dcd2, 0.06, { envMapIntensity: 0.4, side: T.BackSide }));
        gIn.renderOrder = 1; grp.add(gIn);
        // heavy glass base: a greenish solid disc
        const base = new T.Mesh(new T.CylinderGeometry(3.7, 3.85, 1.25, 32), K.phys({ color: 0xbfd8c8, roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.2 }));
        base.position.y = 0.66; base.renderOrder = 1; grp.add(base);
        // the last of the cola, lying in the low side of the glass (local +z is world down here)
        const lqm = K.phys({ color: 0x2e0f05, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.72, depthWrite: false });
        const lq = new T.Mesh(new T.PlaneGeometry(5.4, 6.4), lqm);
        lq.position.set(0, 4.6, 2.55); lq.rotation.y = PI; lq.renderOrder = 1; grp.add(lq);
        const lqs = new T.Mesh(new T.CylinderGeometry(3.72, 3.72, 6.4, 24, 1, true, -0.81, 1.62), lqm);
        lqs.position.y = 4.6; lqs.renderOrder = 1; grp.add(lqs);
        grp.rotation.order = 'YXZ';
        grp.rotation.y = PI / 2 - gAng; grp.rotation.x = PI / 2; // axis along gAng, mouth towards the road
        grp.position.set(gp.x - Math.cos(gAng) * 4.8, 4.2, gp.z - Math.sin(gAng) * 4.8);
        K.add(grp, { cast: true });
        keep.push(grp);
        K.capsule(gp.x - Math.cos(gAng) * 9, gp.z - Math.sin(gAng) * 9, gp.x + Math.cos(gAng) * 0.2, gp.z + Math.sin(gAng) * 0.2, 4.2, 8.4);
        AO(gp.x - Math.cos(gAng) * 4.6, gp.z - Math.sin(gAng) * 4.6, 6.2, 4.2, 0.5, gAng);
        warnRoad('glass', gp.x, gp.z, 4.5);
      }
      // ice cubes and a lemon slice spilled out (two cubes can be pushed around)
      {
        const iceMat = K.phys({ color: 0xe6f3fa, roughness: 0.06, transparent: true, opacity: 0.26, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2.2, depthWrite: false, side: T.DoubleSide });
        const iceGeo = new K.RoundedBoxGeometry(2.0, 1.7, 2.0, 2, 0.5);
        const spots = [[1.4, -3.2, true], [3.6, 2.4, false], [-1.8, 3.6, false], [5.5, -1.0, true]];
        for (const [a, b, push] of spots) {
          const x = sp.x + a, z = sp.z + b;
          const m = K.mesh(iceGeo, iceMat, x, 0.95 + 0.1, z, { ry: r() * 6 });
          m.renderOrder = 2;
          if (push) { keep.push(m); K.physics.addDynamic({ x, z, r: 1.35, m: 0.4, h: 1.9, mesh: m, slide: true, friction: 16, baseY: 1.05 }); }
          else { keep.push(m); AO(x, z, 1.6, 1.6, 0.25); }
        }
        const lc = TX.makeCanvas(128); const lg = lc.getContext('2d');
        lg.fillStyle = '#f2d23a'; lg.beginPath(); lg.arc(64, 64, 63, 0, 6.283); lg.fill();
        lg.fillStyle = '#fbf3c2'; lg.beginPath(); lg.arc(64, 64, 56, 0, 6.283); lg.fill();
        for (let i = 0; i < 9; i++) { const a0 = i / 9 * 6.283 + 0.06, a1 = (i + 1) / 9 * 6.283 - 0.06; lg.fillStyle = '#f4dd5a'; lg.beginPath(); lg.moveTo(64 + Math.cos((a0 + a1) / 2) * 6, 64 + Math.sin((a0 + a1) / 2) * 6); lg.arc(64, 64, 52, a0, a1); lg.closePath(); lg.fill(); }
        const lemon = K.mesh(new T.CylinderGeometry(2.6, 2.6, 0.5, 28), [K.std({ color: 0xf0cf2a, roughness: 0.5 }), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.55, envMapIntensity: 0.5 }), K.std({ color: 0xf0cf2a })], gp.x + 6, 0.3, gp.z + 5.5, { ry: 0.5 });
        keep.push(lemon);
        AO(gp.x + 6, gp.z + 5.5, 2.8, 2.8, 0.3);
      }
    }

    // ---- blue chalk dust on the west sweeper (slick) ----
    {
      const s0 = sAt(-111.5, -6);
      const p = track.place(s0, 0.8);
      const poly = K.blobOutline(r, p.x, p.z, 5.6, 0.3, 36, 1.7, p.angle);
      K.surface('slick', { poly });
      decal('blue1', p.x, p.z, 21, 14, p.angle + 0.1, 0.075);
      const q = track.place(s0 + 9, -2); decal('blue2', q.x, q.z, 12, 8, q.angle, 0.072);
      // crushed chalk cube just off the road + crumbs strewn into the powder
      const cx = -121.2, cz = -10;
      chalkCube(cx, cz, { ry: 0.4 });
      const crumbs = [];
      for (let i = 0; i < 70; i++) {
        const t = r(), a = r() * 6.28;
        const x = cx + (p.x - cx) * t * 1.2 + Math.cos(a) * r() * 3.5, z = cz + (p.z - cz) * t * 1.2 + Math.sin(a) * r() * 4.5;
        crumbs.push({ x, y: 0.1, z, s: r.range(0.12, 0.42), ry: r() * 6, rx: r() * 6, color: r.pick([0x3f74c4, 0x2f5fae, 0x6c9ae0]) });
      }
      K.instances(new T.DodecahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 0.95 }), crumbs, { colors: true, cast: false });
      const w = track.place(s0 - 26, -11.5); decal('slow', w.x, w.z, 9, 3.4, 0);
    }

    // ---- scorepad and pencil in the south-west corner ----
    {
      const c = TX.makeCanvas(256, 340); const g = c.getContext('2d');
      g.fillStyle = '#f5f1e4'; g.fillRect(0, 0, 256, 340);
      g.fillStyle = '#2a4f8a'; g.fillRect(0, 0, 256, 44);
      g.fillStyle = '#f5f1e4'; g.font = '700 24px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('SCORE', 128, 31);
      g.strokeStyle = 'rgba(60,100,170,0.5)'; g.lineWidth = 2;
      for (let y = 78; y < 330; y += 28) { g.beginPath(); g.moveTo(10, y); g.lineTo(246, y); g.stroke(); }
      g.beginPath(); g.moveTo(128, 50); g.lineTo(128, 330); g.stroke();
      g.fillStyle = 'rgba(30,30,40,0.9)'; g.font = 'italic 700 24px Georgia, serif'; g.fillText('Mia', 64, 70); g.fillText('Leo', 192, 70);
      const tally = (x, y, n) => { g.strokeStyle = 'rgba(30,30,40,0.85)'; g.lineWidth = 2.5; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x + i * 9, y - 9); g.lineTo(x + i * 9 + 1, y + 9); g.stroke(); } if (n >= 5) { g.beginPath(); g.moveTo(x - 4, y + 6); g.lineTo(x + 40, y - 6); g.stroke(); } };
      tally(30, 98, 5); tally(30, 126, 3); tally(160, 98, 5); tally(160, 126, 4); tally(30, 154, 2);
      const pad = K.mesh(new K.RoundedBoxGeometry(9.5, 0.5, 12.6, 1, 0.15), [K.std({ color: 0xece6d6, roughness: 0.9 }), K.std({ color: 0xece6d6 }), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.85 }), K.std({ color: 0xece6d6 }), K.std({ color: 0xece6d6 }), K.std({ color: 0xece6d6 })], -113, 0.26, 53, { ry: 0.35 });
      keep.push(pad);
      AO(-113, 53, 5.8, 7.4, 0.35, -0.35);
      // stubby pencil
      const pg = new T.Group();
      const body = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 7.5, 6), K.plastic(0x2b6a3a, 0.4)); body.rotation.z = PI / 2; pg.add(body);
      const wood = new T.Mesh(new T.ConeGeometry(0.42, 1.4, 6), lightWoodMat); wood.rotation.z = -PI / 2; wood.position.x = 4.45; pg.add(wood);
      const lead = new T.Mesh(new T.ConeGeometry(0.13, 0.42, 6), K.std({ color: 0x222222, roughness: 0.4 })); lead.rotation.z = -PI / 2; lead.position.x = 5.3; pg.add(lead);
      pg.position.set(-104.5, 0.42, 55.5); pg.rotation.y = 1.9;
      K.add(pg);
      AO(-104.5, 55.5, 4.2, 0.8, 0.35, -1.9);
      warnRoad('scorepad', -113, 53, 3);
    }

    // ---- on the rails: coins for the next game, chalk, a pint and a bowl of peanuts (north side) ----
    {
      const coinC = TX.makeCanvas(128); const cg = coinC.getContext('2d');
      cg.fillStyle = '#808080'; cg.fillRect(0, 0, 128, 128);
      cg.strokeStyle = '#d0d0d0'; cg.lineWidth = 6; cg.beginPath(); cg.arc(64, 64, 58, 0, 6.28); cg.stroke();
      cg.fillStyle = '#d8d8d8'; cg.font = '700 50px Rubik, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText('1', 64, 66);
      const coinMat = K.std({ color: 0xffffff, metalness: 1, roughness: 0.3, bumpMap: TX.toTexture(coinC, { srgb: false, wrap: false }), bumpScale: 1.2 });
      const coins = [];
      const yR = RAIL_Y + 0.1;
      for (let i = 0; i < 4; i++) for (let k = 0; k < (i === 1 ? 3 : i === 3 ? 2 : 1); k++) coins.push({ x: 22 + i * 3.4, y: yR + k * 0.22, z: 73 + r.range(-0.2, 0.2), ry: r() * 6, color: i % 2 ? 0xd9b45a : 0xc8ccd2 });
      coins.push({ x: -40, y: 0.11, z: 22, ry: 1, color: 0xd9b45a }, { x: -38, y: 0.11, z: 23.2, ry: 2, color: 0xc8ccd2 }, { x: 116, y: 0.11, z: 4, ry: 2, color: 0xb87348 });
      // a few more dropped coins in the felt between the lanes
      for (const [x, z, n] of [[40, 27.6, 2], [42.4, 28.4, 1], [74, -5.2, 1], [-6, -40.5, 1]]) {
        for (let k = 0; k < n; k++) coins.push({ x: x + k * 0.5, y: 0.11 + k * 0.21, z: z + k * 0.3, ry: r() * 6, rx: k ? 0.04 : 0, color: r.pick([0xd9b45a, 0xc8ccd2, 0xb87348]) });
        warnRoad('coin', x, z, 0.8);
      }
      K.instances(new T.CylinderGeometry(1.2, 1.2, 0.2, 28), coinMat, coins, { colors: true, cast: false });
      chalkCube(-95, 73.1, { y: RAIL_Y, ry: 0.3 });
      chalkCube(136.6, 30, { y: RAIL_Y, ry: 1.1 });
      chalkCube(-120, 73.4, { y: RAIL_Y, ry: 2.2 });
      // pint of ale on the north rail
      {
        const x = 46, z = -73;
        const prof = [[3.0, 0], [3.25, 0.15], [3.3, 0.8], [3.75, 9.5], [4.05, 12.2], [4.1, 14.5], [3.85, 14.5], [3.8, 12.2], [3.5, 9.5], [3.05, 1.2], [0.01, 1.0]];
        K.mesh(K.lathe(prof, 40), K.glass(0xfff8ea, 0.2), x, RAIL_Y, z, { cast: false }).renderOrder = 2;
        const ale = K.phys({ color: 0xc87a16, roughness: 0.1, transparent: true, opacity: 0.88, clearcoat: 1 });
        K.mesh(K.lathe([[0.01, 1.05], [3.0, 1.05], [3.45, 9.5], [3.72, 11.6], [0.01, 11.6]], 36), ale, x, RAIL_Y, z);
        const foam = K.mesh(new T.CylinderGeometry(3.95, 3.75, 2.2, 36), K.phys({ color: 0xfaf3e0, roughness: 0.75, sheen: 1, sheenColor: new T.Color(0xffffff) }), x, RAIL_Y + 12.7, z);
        AO(x, z, 4.4, 4.4, 0.5, 0, RAIL_Y + 0.06);
      }
      // a longneck of the same made-up ale as the beer mat, standing on the north rail
      {
        const x = -70, z = -73.1;
        const bottle = K.lathe([[0.01, 0], [2.7, 0], [3.05, 0.4], [3.1, 1.0], [3.1, 13.5], [2.9, 15], [2.2, 16.6], [1.45, 18.2], [1.3, 21.6], [1.48, 21.9], [1.48, 22.9], [1.2, 23.2], [0.01, 23.2]], 36);
        K.mesh(bottle, K.phys({ color: 0x1f4d22, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.86, envMapIntensity: 1.3 }), x, RAIL_Y, z).renderOrder = 2;
        const lc = TX.makeCanvas(512, 128); const lg = lc.getContext('2d');
        lg.fillStyle = '#efe4c8'; lg.fillRect(0, 0, 512, 128);
        lg.fillStyle = '#8c1d1d'; lg.fillRect(0, 0, 512, 14); lg.fillRect(0, 114, 512, 14);
        lg.fillStyle = '#8c1d1d'; lg.font = '58px "Lilita One", Impact, sans-serif'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
        lg.fillText('OLD 8', 128, 54); lg.fillText('OLD 8', 384, 54);
        lg.fillStyle = '#1b1b1b'; lg.font = '700 20px Rubik, sans-serif'; lg.fillText('RAIL ALE · 5.2%', 128, 96); lg.fillText('RAIL ALE · 5.2%', 384, 96);
        K.mesh(new T.CylinderGeometry(3.16, 3.16, 6.2, 36, 1, true), K.std({ map: TX.toTexture(lc, { wrap: false }), roughness: 0.6 }), x, RAIL_Y + 7.4, z, { ry: 0.6 });
        const foil = K.metal(0xc9a24a, 0.3);
        K.mesh(new T.CylinderGeometry(1.36, 1.5, 1.6, 24, 1, true), foil, x, RAIL_Y + 19.6, z);
        K.mesh(new T.CylinderGeometry(1.55, 1.55, 0.55, 21), foil, x, RAIL_Y + 23.4, z);
        AO(x, z, 3.8, 3.8, 0.5, 0, RAIL_Y + 0.06);
      }
      // bowl of peanuts on the north rail + shells on the felt
      {
        const x = -46, z = -73.2;
        K.mesh(K.lathe([[0.01, 0], [2.6, 0], [3.0, 0.3], [4.3, 2.4], [4.5, 3.4], [4.2, 3.4], [3.9, 2.4], [2.6, 0.9], [0.01, 0.8]], 32), K.ceramic(0x2c3d52, { roughness: 0.3 }), x, RAIL_Y, z);
        const nuts = [];
        for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 3.1; nuts.push({ x: x + Math.cos(a) * d, y: RAIL_Y + 2.2 + r() * 0.8 - d * 0.15, z: z + Math.sin(a) * d, sx: 0.6, sy: 0.42, sz: 0.42, ry: r() * 6, rz: r.range(-0.4, 0.4), color: r.pick([0xb07a44, 0xc08850, 0x9a6a3a]) }); }
        const shells = [];
        const shellAt = (cx, cz, n, spread, y = 0.2) => { for (let i = 0; i < n; i++) shells.push({ x: cx + r.gauss() * spread, y, z: cz + r.gauss() * spread, sx: 0.95, sy: 0.4, sz: 0.55, ry: r() * 6, rx: r.range(-0.3, 0.3), color: r.pick([0xc9a272, 0xb48c5c, 0xd8b88a, 0x8a6a48]) }); };
        shellAt(-52, -60.2, 4, 1.5); shellAt(-40, 25, 5, 2.4); shellAt(116, -6, 4, 2.2); shellAt(-118, 40, 4, 2); shellAt(30, 60, 3, 1.4); shellAt(-28, -60.5, 3, 1.5);
        for (let i = 0; i < 5; i++) shells.push({ x: x + r.range(-6, 6), y: RAIL_Y + 0.25, z: z + r.range(-2.5, 2.5), sx: 0.95, sy: 0.4, sz: 0.55, ry: r() * 6, color: 0xc9a272 });
        const nutGeo = new T.SphereGeometry(1, 10, 7);
        K.instances(nutGeo, K.std({ color: 0xffffff, roughness: 0.75 }), nuts.concat(shells), { colors: true });
        AO(x, z, 5, 5, 0.5, 0, RAIL_Y + 0.06);
      }
    }

    // ---- a phone left on the felt, its scoreboard screen glowing in the dim room ----
    {
      const x = 63, z = -37.6, ang = 0.03;
      const c = TX.makeCanvas(512, 256); const g = c.getContext('2d');
      const bgG = g.createLinearGradient(0, 0, 0, 256); bgG.addColorStop(0, '#13234a'); bgG.addColorStop(1, '#070c1c');
      g.fillStyle = bgG; g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#1f7a46'; g.fillRect(0, 0, 512, 40);
      g.fillStyle = '#eaf2ff'; g.font = '700 24px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('8-BALL NIGHT  ·  RACE TO 7', 256, 21);
      g.font = '400 28px Rubik, sans-serif'; g.fillText('MIA', 120, 78); g.fillText('LEO', 392, 78);
      g.font = '96px "Lilita One", Impact, sans-serif'; g.fillStyle = '#ffd34a'; g.fillText('5', 120, 160); g.fillStyle = '#7fc8ff'; g.fillText('4', 392, 160);
      g.fillStyle = '#8fa2c8'; g.font = '700 40px Rubik, sans-serif'; g.fillText(':', 256, 150);
      g.font = '400 20px Rubik, sans-serif'; g.fillText('frame 10  ·  23:47', 256, 230);
      for (let i = 0; i < 7; i++) { g.fillStyle = i < 5 ? '#ffd34a' : '#2a3654'; g.beginPath(); g.arc(40 + i * 14, 222, 5, 0, 6.283); g.fill(); g.fillStyle = i < 4 ? '#7fc8ff' : '#2a3654'; g.beginPath(); g.arc(388 + i * 14, 222, 5, 0, 6.283); g.fill(); }
      const st = TX.toTexture(c, { wrap: false });
      const body = K.mesh(new K.RoundedBoxGeometry(14.6, 0.8, 7.1, 3, 0.7), K.phys({ color: 0x1c1d22, roughness: 0.3, metalness: 0.6, clearcoat: 0.6 }), x, 0.4, z, { ry: -ang });
      const scr = K.mesh(new T.PlaneGeometry(13.4, 6.3), K.phys({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.7, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, color: 0x777777 }), x, 0.82, z, { cast: false });
      scr.rotation.order = 'YXZ'; scr.rotation.y = -ang; scr.rotation.x = -PI / 2;
      keep.push(scr);
      K.box(x, z, 7.3, 3.55, ang, 0.8);
      AO(x, z, 8.2, 4.4, 0.45, ang);
      // soft screen glow on the felt
      const gl = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x4a78d0, transparent: true, opacity: 0.035, alphaMap: TX.blobShadowTexture(), depthWrite: false, blending: T.AdditiveBlending }));
      gl.rotation.order = 'YXZ'; gl.rotation.y = -ang; gl.rotation.x = -PI / 2; gl.scale.set(24, 15, 1); gl.position.set(x, 0.09, z); gl.renderOrder = 2;
      K.group.add(gl);
      warnRoad('phone', x - 7, z, 1); warnRoad('phone', x + 7, z + 3.5, 1); warnRoad('phone', x - 7, z + 3.5, 1);
      // a couple of coins and a chalk cube in the north strip
      chalkCube(28, -60.7, { ry: 0.5 });
    }

    // ---- the table-hire ticket, folded once, left between the north lanes ----
    {
      const x = 16, z = -38.1, ang = 0.06;
      const c = TX.makeCanvas(512, 192); const g = c.getContext('2d');
      g.fillStyle = '#f4efe0'; g.fillRect(0, 0, 512, 192);
      g.fillStyle = '#2a2a2e'; g.font = '700 30px Rubik, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('THE CORNER POCKET', 24, 34);
      g.font = '400 22px "Courier New", monospace';
      g.fillText('TABLE 3 .......... 2 HRS', 24, 78); g.fillText('2x OLD 8 ALE ..... PAID', 24, 108); g.fillText('PEANUTS ........... 1', 24, 138);
      g.fillText('21:12  -  23:12', 24, 168);
      g.strokeStyle = 'rgba(40,40,40,0.4)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(16, 56); g.lineTo(496, 56); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(120,80,40,0.12)'; g.beginPath(); g.arc(420, 120, 50, 0, 6.283); g.fill();
      const tex = TX.toTexture(c, { wrap: false });
      // two panels meeting at a soft tent-shaped fold across the middle
      const geo = new T.PlaneGeometry(10.5, 3.9, 8, 1);
      const pp = geo.attributes.position;
      for (let i = 0; i < pp.count; i++) { const u = pp.getX(i) / 5.25; pp.setZ(i, 0.55 * (1 - Math.abs(u)) ** 1.5); }
      geo.computeVertexNormals();
      geo.rotateX(-PI / 2);
      const tk = K.mesh(geo, K.std({ map: tex, roughness: 0.85, side: T.DoubleSide }), x, 0.05, z, { ry: -ang });
      keep.push(tk);
      AO(x, z, 5.6, 2.4, 0.3, ang);
      warnRoad('ticket', x - 5.2, z - 2, 0.5); warnRoad('ticket', x + 5.2, z + 2, 0.5); warnRoad('ticket', x - 5.2, z + 2, 0.5);
    }

    // ---- the bridge rest lying along the east cushion (brass head at the north end) ----
    {
      const brass = K.metal(0xc9a14a, 0.28);
      const x = 122.4, z0 = -47, z1 = 47;
      const shaft = K.mesh(new T.CylinderGeometry(0.62, 0.78, z1 - z0 - 3, 16), K.phys({ color: 0x2a1a10, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, map: railWood.map }), x, 0.78, (z0 + z1) / 2 + 1.5, { rx: PI / 2 });
      K.mesh(new T.CylinderGeometry(0.8, 0.8, 1.6, 16), K.std({ color: 0x111111, roughness: 0.6 }), x, 0.8, z1 + 0.5, { rx: PI / 2 });
      K.mesh(new T.CylinderGeometry(0.72, 0.72, 2.4, 16), brass, x, 0.75, z0 + 1.2, { rx: PI / 2 });
      // flat brass head with three notches, lying on its side
      const hs = new T.Shape();
      hs.moveTo(-4.6, 0); hs.lineTo(4.6, 0); hs.lineTo(4.6, 3.2);
      for (const nx of [3.0, 0, -3.0]) { hs.lineTo(nx + 1.0, 3.2); hs.absarc(nx, 3.2, 1.0, 0, PI, true); }
      hs.lineTo(-4.6, 3.2); hs.closePath();
      const hg = new T.ExtrudeGeometry(hs, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 10 });
      hg.rotateX(-PI / 2); // shape y -> -z
      K.mesh(hg, brass, x, 0.12, z0 - 0.2, { cast: true });
      K.capsule(x, z0 - 3, x, z1 + 1.3, 0.9, 1.7);
      for (let i = 0; i < 5; i++) AO(x, z0 + (i + 0.5) * (z1 - z0) / 5, 1.2, (z1 - z0) / 10 + 1, 0.4);
      AO(x, z0 - 1.8, 5, 2.4, 0.4);
      warnRoad('bridge', x, z0, 1); warnRoad('bridge', x, 0, 1); warnRoad('bridge', x, z1, 1);
    }

    // ---- a bunch of keys in the north-west corner, a bottle cap in the south-east ----
    {
      const keyShape = () => {
        const s = new T.Shape();
        s.absarc(0, 0, 1.15, 0.35, 2 * PI - 0.35, false);
        s.lineTo(4.9, -0.32); s.lineTo(4.9, -0.75); s.lineTo(4.4, -0.75); s.lineTo(4.2, -0.45); s.lineTo(3.8, -0.75); s.lineTo(3.4, -0.45); s.lineTo(3.0, -0.75); s.lineTo(2.5, -0.45); s.lineTo(2.5, 0.42);
        s.closePath();
        const hole = new T.Path(); hole.absarc(-0.35, 0, 0.32, 0, 2 * PI, true); s.holes.push(hole);
        const g = new T.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 12 });
        g.rotateX(-PI / 2);
        return g;
      };
      const kx = -112, kz = -51;
      const kg = keyShape();
      K.mesh(kg, K.metal(0xd4b25c, 0.3), kx + 1.6, 0.2, kz + 0.3, { ry: 0.25 });
      K.mesh(kg, K.metal(0xc8ccd2, 0.25), kx + 1.1, 0.34, kz - 1.0, { ry: -0.6 });
      K.mesh(new T.TorusGeometry(1.5, 0.11, 6, 28), K.metal(0xbfc3c8, 0.25), kx, 0.14, kz, { rx: PI / 2 });
      const fob = K.mesh(new K.RoundedBoxGeometry(2.6, 0.6, 1.6, 2, 0.3), K.plastic(0x1d1d22, 0.4), kx - 2.6, 0.3, kz + 0.9, { ry: 0.7 });
      AO(kx, kz, 4, 2.6, 0.3);
      warnRoad('keys', kx, kz, 2);
      // bottle cap, crimped edge
      const capG = new T.CylinderGeometry(1.4, 1.45, 0.6, 21, 1);
      const pp = capG.attributes.position;
      for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getZ(i), pp.getX(i)); const k = 1 + 0.06 * Math.cos(a * 21); if (Math.hypot(pp.getX(i), pp.getZ(i)) > 1) { pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); } }
      capG.computeVertexNormals();
      const capC = TX.makeCanvas(128); const ccg = capC.getContext('2d');
      ccg.fillStyle = '#b02a24'; ccg.fillRect(0, 0, 128, 128);
      ccg.strokeStyle = '#f3ead8'; ccg.lineWidth = 7; ccg.beginPath(); ccg.arc(64, 64, 44, 0, 6.283); ccg.stroke();
      ccg.fillStyle = '#f3ead8'; ccg.beginPath();
      for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr2 = i % 2 ? 11 : 27; ccg.lineTo(64 + Math.cos(a) * rr2, 64 + Math.sin(a) * rr2); }
      ccg.closePath(); ccg.fill();
      const capTop = K.std({ map: TX.toTexture(capC, { wrap: false }), metalness: 0.6, roughness: 0.35 });
      const liner = K.std({ color: 0xd9d0b4, roughness: 0.7 });
      K.mesh(capG, [K.metal(0xb83228, 0.35), capTop, liner], 118, 0.3, 57, { ry: 0.3 });
      K.mesh(capG, [K.metal(0xd9b84a, 0.3), K.metal(0xd9b84a, 0.3), liner], -118, 0.3, -30, { rx: PI, ry: 0.3 });
      AO(118, 57, 1.8, 1.8, 0.35); AO(-118, -30, 1.8, 1.8, 0.35);
    }

    // =====================================================================================
    // CHALK MARKINGS ON THE FELT (start line, grid, chevrons, title, smudges)
    // =====================================================================================
    {
      const s0 = 36;
      const p = track.at(s0);
      decal('start', p.x, p.z, 2.6, 14.6, p.angle, 0.076);
      for (let k = 0; k < 4; k++) {
        const row = Math.floor(k / 2), col = k % 2;
        const q = track.place(s0 - row * 7.5 - col * 2.5, (col === 0 ? -1 : 1) * 3.2);
        decal('box', q.x, q.z, 6.0, 3.6, q.angle, 0.074);
        const nq = track.place(s0 - row * 7.5 - col * 2.5 - 2.2, (col === 0 ? -1 : 1) * 5.8);
        decal('n' + (k + 1), nq.x, nq.z, 1.8, 1.8, 0, 0.075);
      }
      const w1 = track.place(s0 + 1, -9.4); decal('wstart', w1.x, w1.z, 9.5, 3.0, 0, 0.074);
      const w2 = track.place(s0 + 1, 11.2); decal('wfinish', w2.x, w2.z, 9.5, 3.0, 0, 0.074);
      // title in the west infield
      decal('title', -63, 25, 38, 9.5, -0.04, 0.074);
      // chevrons on the outside of the hairpins
      decal('chev', 116.2, 31, 12, 4.2, -PI / 2, 0.074);
      decal('chev', 116.2, -31, 12, 4.2, -PI / 2, 0.074);
      decal('chev', -42, 0, 11, 4, -PI / 2, 0.074);
      // direction arrows in each lane of the serpentine (so nobody heads the wrong way)
      for (const [x, z] of [[52, 47.4], [62, 15.4], [72, -15.8], [44, -49.4], [-104, 18]]) {
        const q = track.at(sAt(x, z));
        decal('arrow', q.x, q.z, 7, 2.3, q.angle, 0.074);
      }
      // chalk kerbs on the inside of the hairpins
      {
        const step = 2.5;
        let k = 0;
        for (let s = 0; s < L; s += step) {
          let c = 0; for (const d of [-6, -3, 0, 3, 6]) c += track.at(s + d).curv; c /= 5;
          if (Math.abs(c) < 1 / 24) { k = 0; continue; }
          const q = track.place(s, Math.sign(c) * 5.95);
          decal(k % 2 ? 'kr' : 'kw', q.x, q.z, step * 0.96, 1.5, q.angle, 0.073);
          k++;
        }
      }
      // doodles and warnings in the spare felt
      decal('noshort', -78, -30, 22, 6.2, -0.05, 0.074);
      decal('car', -94, -16, 9, 9, 0.15, 0.074);
      decal('mind', -21.5, 60.2, 18, 4.5, 0, 0.074);
      decal('flat', 80, -59.6, 13, 4.2, 0, 0.074);
      for (const [x, z] of [[-78, -30], [-94, -16], [-29, 60.2], [-21.5, 60.2], [-13, 60.2], [80, -59.6], [86, -59.6], [74, -59.6]]) warnRoad('doodle', x, z, 1.5);
      // blue chalk smudges and scuffs scattered on the felt, off the road
      const placed = [];
      let tries = 0;
      while (placed.length < 34 && tries++ < 600) {
        const x = r.range(-123, 123), z = r.range(-60, 60);
        if (!K.offRoad(x, z, 2.5)) continue;
        if (placed.some(([a, b]) => Math.hypot(a - x, b - z) < 14)) continue;
        placed.push([x, z]);
        const kind = r.pick(['blue2', 'blue2', 'dots', 'blue2']);
        const s = r.range(3, 6);
        decal(kind, x, z, s, s, r() * 6.28, 0.068);
      }
      // a few tyre-dragged chalk smudges near the pockets
      decal('blue2', 7, 57, 5, 4, 0.3, 0.07); decal('blue2', -6, -58, 5, 4, 2, 0.07);
    }

    // ---- fine scatter: chalk specks + felt lint ----
    {
      const specks = [];
      const around = (cx, cz, n, spread) => { for (let i = 0; i < n; i++) specks.push({ x: cx + r.gauss() * spread, y: 0.06, z: cz + r.gauss() * spread, s: r.range(0.08, 0.2), ry: r() * 6, color: r.pick([0x4a7cc8, 0x3a68b8, 0x8fb0e6]) }); };
      for (const p of POCKETS) around(p.x - Math.sign(p.x) * 7, p.z - Math.sign(p.z) * 6, 14, 3);
      around(91, 31.6, 10, 2); around(-17, 0.6, 10, 2); around(95, -31.4, 10, 2); around(-63, 0, 14, 7);
      for (let i = 0; i < 120; i++) { const x = r.range(-124, 124), z = r.range(-61, 61); if (K.offRoad(x, z, 1)) specks.push({ x, y: 0.06, z, s: r.range(0.06, 0.16), ry: r() * 6, color: r() < 0.6 ? 0x4a7cc8 : 0xd8d4c8 }); }
      K.instances(new T.IcosahedronGeometry(1, 0), K.std({ color: 0xffffff, roughness: 1 }), specks.filter((q) => Math.abs(q.x) < HX - 0.3 && Math.abs(q.z) < HZ - 0.3 && POCKETS.every((p) => Math.hypot(q.x - p.x, q.z - p.z) > p.r + 0.5)), { colors: true, cast: false });
      const lint = [];
      for (let i = 0; i < 90; i++) { const x = r.range(-124, 124), z = r.range(-61, 61); lint.push({ x, y: 0.05, z, sx: r.range(0.5, 1.4), sy: 0.04, sz: 0.04, ry: r() * 6, color: r.pick([0xe8e4da, 0xc8d8cc, 0x9ab8a4]) }); }
      K.instances(new T.BoxGeometry(1, 1, 1), K.std({ color: 0xffffff, roughness: 1 }), lint, { colors: true, cast: false });
    }

    // =====================================================================================
    // FLUSH: chalk decal atlas, contact shadows, static merge
    // =====================================================================================
    {
      const W = 1024, H = 512;
      const c = TX.makeCanvas(W, H); const g = c.getContext('2d');
      const cells = {};
      const cell = (name, x, y, w, h, draw) => { cells[name] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(w, h); g.restore(); };
      const nr = K.rng(77);
      const chalkStroke = (pts, w, col = '255,255,255', a = 0.85) => {
        for (let pass = 0; pass < 3; pass++) {
          g.strokeStyle = `rgba(${col},${a * (pass === 0 ? 0.5 : 0.8)})`; g.lineWidth = w * (pass === 0 ? 1.5 : 1) * (0.85 + nr() * 0.3); g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); pts.forEach(([x, y], i) => { const jx = x + (nr() - 0.5) * w * 0.3, jy = y + (nr() - 0.5) * w * 0.3; if (i) g.lineTo(jx, jy); else g.moveTo(jx, jy); }); g.stroke();
        }
      };
      const chalkText = (txt, x, y, size, col = '255,255,255', font = 'Rubik, sans-serif', weight = 700) => {
        g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(${col},${i ? 0.35 : 0.6})`; g.fillText(txt, x + (nr() - 0.5) * 2.5, y + (nr() - 0.5) * 2.5); }
      };
      // start band: 2 x 11 checks across the road (canvas x = along track, y = across)
      cell('start', 0, 0, 48, 256, (w, h) => {
        const n = 11, sq = h / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) {
          for (let k = 0; k < 9; k++) chalkStroke([[j * 24 + 2, i * sq + k * sq / 9 + 2], [j * 24 + 22, i * sq + k * sq / 9 + 4]], 3.2, '255,255,255', 0.75);
        }
        chalkStroke([[1, 2], [1, h - 2]], 2.4); chalkStroke([[47, 2], [47, h - 2]], 2.4);
      });
      cell('box', 48, 0, 160, 96, (w, h) => { chalkStroke([[150, 10], [12, 10], [12, 86], [150, 86]], 5, '255,255,255', 0.7); });
      for (let k = 1; k <= 4; k++) cell('n' + k, 208 + (k - 1) * 64, 0, 64, 64, (w, h) => chalkText(String(k), 32, 34, 50));
      cell('wstart', 464, 0, 280, 88, (w, h) => chalkText('START', w / 2, h / 2 + 2, 62, '255,255,255', '"Lilita One", Impact, sans-serif', 400));
      cell('wfinish', 744, 0, 280, 88, (w, h) => chalkText('FINISH', w / 2, h / 2 + 2, 62, '255,255,255', '"Lilita One", Impact, sans-serif', 400));
      cell('chev', 208, 64, 256, 96, (w, h) => { for (let i = 0; i < 3; i++) { const x = 40 + i * 70; chalkStroke([[x, 12], [x + 44, h / 2], [x, h - 12]], 12, '255,255,255', 0.8); } });
      cell('arrow', 464, 88, 300, 100, (w, h) => { chalkStroke([[16, h / 2], [w - 30, h / 2]], 11); chalkStroke([[w - 80, 16], [w - 22, h / 2], [w - 80, h - 16]], 11); });
      cell('slow', 764, 88, 260, 100, (w, h) => chalkText('SLOW!', w / 2, h / 2 + 3, 70, '255,255,255', '"Lilita One", Impact, sans-serif', 400));
      cell('title', 0, 256, 640, 160, (w, h) => {
        chalkText('CORNER POCKET', w / 2, 62, 78, '255,255,255', '"Lilita One", Impact, sans-serif', 400);
        chalkText('GRAND PRIX', w / 2, 128, 46, '120,170,255', '"Lilita One", Impact, sans-serif', 400);
        chalkStroke([[90, 98], [550, 98]], 4, '255,255,255', 0.6);
      });
      const smudge = (w, h, col, n, a) => {
        for (let i = 0; i < n; i++) {
          const x = w / 2 + nr.gauss() * w * 0.16, y = h / 2 + nr.gauss() * h * 0.16, rad = 6 + nr() * w * 0.12;
          const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * (1 + nr()), rad, nr() * 3, 0, 6.283); g.fill();
        }
      };
      cell('blue1', 640, 188, 256, 228, (w, h) => {
        smudge(w, h, '70,120,210', 90, 0.3);
        for (let i = 0; i < 9; i++) { const y = 30 + nr() * (h - 60); chalkStroke([[20 + nr() * 30, y], [w - 20 - nr() * 30, y + (nr() - 0.5) * 16]], 5 + nr() * 6, '110,155,235', 0.18); }
        for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(60,110,205,${0.2 + nr() * 0.5})`; g.beginPath(); g.arc(w / 2 + nr.gauss() * w * 0.22, h / 2 + nr.gauss() * h * 0.2, 0.8 + nr() * 2.2, 0, 6.283); g.fill(); }
      });
      cell('blue2', 896, 188, 128, 128, (w, h) => smudge(w, h, '60,110,205', 22, 0.35));
      // kids' chalk doodles and warnings
      const circ = (cx, cy, rad, n = 18) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(i / n * 6.283) * rad, cy + Math.sin(i / n * 6.283) * rad]);
      cell('car', 48, 96, 160, 160, () => {
        chalkStroke([[22, 104], [26, 84], [58, 76], [76, 56], [112, 55], [130, 76], [148, 82], [150, 104], [22, 104]], 4.5, '255,255,255', 0.8);
        chalkStroke([[82, 60], [80, 76], [124, 76]], 3, '255,255,255', 0.6);
        chalkStroke(circ(52, 106, 13), 4.5); chalkStroke(circ(120, 106, 13), 4.5);
        for (const y of [64, 82, 98]) chalkStroke([[2, y], [16, y]], 3.5, '255,255,255', 0.55);
        chalkText('7', 104, 90, 18, '255,255,255');
      });
      cell('noshort', 0, 416, 340, 96, (w, h) => chalkText('NO SHORTCUTS!', w / 2, h / 2 + 3, 44, '255,255,255', '"Lilita One", Impact, sans-serif', 400));
      cell('flat', 340, 416, 300, 96, (w, h) => chalkText('FLAT OUT!', w / 2, h / 2 + 3, 62, '255,255,255', '"Lilita One", Impact, sans-serif', 400));
      cell('mind', 640, 416, 384, 96, (w, h) => {
        chalkText('MIND THE POCKET', 150, h / 2 + 3, 37, '255,255,255', '"Lilita One", Impact, sans-serif', 400);
        chalkStroke([[318, h / 2], [372, h / 2]], 6); chalkStroke([[350, 30], [374, h / 2], [350, 66]], 6);
      });
      // racing kerbs: hatched chalk blocks, white and red
      const kerb = (col) => (w, h) => {
        for (let i = 0; i < 22; i++) { const x = 8 + i * (w - 16) / 21; chalkStroke([[x - 5, h - 7], [x + 5, 7]], 5.5, col, 0.8); }
        chalkStroke([[5, 7], [w - 5, 7]], 4, col, 0.7); chalkStroke([[5, h - 7], [w - 5, h - 7]], 4, col, 0.7);
      };
      cell('kw', 208, 160, 128, 48, kerb('250,250,245'));
      cell('kr', 336, 160, 128, 48, kerb('232,84,72'));
      cell('dots', 896, 316, 128, 100, (w, h) => { for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,120,210,${0.2 + nr() * 0.5})`; g.beginPath(); g.arc(w / 2 + nr.gauss() * 18, h / 2 + nr.gauss() * 14, 1 + nr() * 3, 0, 6.283); g.fill(); } });
      // chalk grain over everything
      const nf = TX.noiseField(256, { seed: 15, period: 48, oct: 3 });
      const grain = TX.paint(W, H, (x, y, u, v, o) => {
        const k = Math.min(1, 0.5 + 0.45 * TX.sampleField(nf, 256, x, y) + nr() * 0.35);
        o[0] = o[1] = o[2] = 0; o[3] = (1 - k) * 255;
      });
      g.globalCompositeOperation = 'destination-out'; g.drawImage(grain, 0, 0); g.globalCompositeOperation = 'source-over';
      const tex = TX.toTexture(c, { wrap: false });
      const pos = [], uv = [], nrm = [];
      for (const dc of decals) {
        const cl = cells[dc.cell]; if (!cl) continue;
        const ca = Math.cos(dc.ang), sa = Math.sin(dc.ang), hw = dc.w / 2, hh = dc.h / 2;
        const P = (lx, lz) => [dc.x + lx * ca - lz * sa, dc.y, dc.z + lx * sa + lz * ca];
        const TL = P(-hw, -hh), TR = P(hw, -hh), BL = P(-hw, hh), BR = P(hw, hh);
        const [u0, v0, u1, v1] = cl;
        pos.push(...TL, ...BL, ...TR, ...TR, ...BL, ...BR);
        uv.push(u0, v1, u0, v0, u1, v1, u1, v1, u0, v0, u1, v0);
        for (let i = 0; i < 6; i++) nrm.push(0, 1, 0);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      const m = new T.Mesh(geo, K.std({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.receiveShadow = true; m.renderOrder = 0;
      K.group.add(m);
    }
    {
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1;
    }
    // merge static meshes per material and area (fewer draw calls)
    {
      const BU = K.BufferGeometryUtils;
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        if (o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 60) return;
        const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        const cell = Math.floor((c.x + 200) / 100) + ':' + Math.floor((c.z + 200) / 100);
        const key = o.material.uuid + cell + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = [];
        for (const o of list) {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          g.clearGroups();
          geos.push(g);
        }
        if (geos.some((g) => !!g.attributes.color) !== geos.every((g) => !!g.attributes.color)) continue;
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        const m = new T.Mesh(merged, list[0].material);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
  },

  // fixed-rate: re-spot the cue ball before the next shot (only when nobody is parked on the spot)
  tick(dt, time, game) {
    if (!A || !A.cue) return;
    const u = ((time % CUE.P) + CUE.P) % CUE.P;
    if (u < CUE.reset || u > CUE.P - 0.05) return;
    const d = A.cue.ball;
    if (d.state !== 'live') return;
    if (Math.abs(d.x - CUE.x) < 0.3 && Math.abs(d.z - CUE.z) < 0.3 && Math.hypot(d.vx, d.vz) < 0.5) return;
    for (const e of game.cars) if (Math.hypot(e.car.x - CUE.x, e.car.z - CUE.z) < 6.5) return;
    for (const o of game.physics.dynamics) if (o !== d && o.state === 'live' && Math.hypot(o.x - CUE.x, o.z - CUE.z) < o.r + BALL_R + 0.2) return;
    d.x = CUE.x; d.z = CUE.z; d.vx = d.vz = 0; d.pop = 1;
  },

  animate(time, dt, game) {
    if (!A || !A.cue) return;
    const C = A.cue, o = cueStroke(time), tp = C.tipAt(o);
    C.stick.position.set(tp.x, 0.64, tp.z);
    const u = ((time % CUE.P) + CUE.P) % CUE.P;
    if (C.lastU < CUE.hit && u >= CUE.hit && game && game.particles && dt > 0.001) {
      // a puff of blue chalk off the tip
      game.particles.emit(tp.x - 0.5, 1.2, tp.z, { color: 0x4f86d6, n: 10, size: 0.7, life: 0.6, spread: 7, up: 4, grav: 6, grow: 1.8, alpha: 0.8, vx: -6 });
    }
    C.lastU = u;
  },
};
