// World: Vinyl Frenzy (Mayhem Cup, table 2 of 4, expert). A club DJ booth at night, at real size (1 unit = 1 cm),
// raced on toy hovercraft. The road is gaffer tape edged with LED strip, and it runs over the gear: down across the
// right-hand turntable's spinning record (it turns with you: a slingshot that throws you into the U-turn), back west
// over the mixer, where four long-throw channel faders sweep across the road in a rolling wave and the crossfader
// shuttles in the near lane, round a knocked-over cocktail, north across the left-hand record (it turns against you),
// and along the back of the booth past the two monitor speakers, whose cones kick on every beat and shove you towards
// the booth's open side. Each tone arm lifts (its target light pops up and a pool of light marks where it will land)
// and then swings in across the road and tracks inward: time the crossing or squeeze through the gap by the label.
// Everything that moves keeps time with a 124 bpm house beat and is a pure function of time.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

// ---- tempo
const BPM = 124, BEAT = 60 / BPM;

// ---- the track (driving order, clockwise): the long back straight past the speakers, a U-turn and a hook down onto
// the right deck, the swoop down and round into the mixer, west across it, the SW U-turn round the spilt drink, north
// over the left deck, a left kink and the NW U-turn back onto the straight
const TRACK = [
  [-139, -93], [1, -93], [141, -93], [158, -86], [165, -69], [158, -52], [123.3, -37.7], [116, -20], [114.4, -0.4],
  [109.6, 10.3], [100.8, 24.3], [83.2, 35.5], [63.5, 28.6], [48.2, 13.3], [38.5, 6.8], [27, 4.5], [-27, 4.5],
  [-41.1, 10.4], [-47, 24.5], [-55, 58], [-80, 71], [-105, 58], [-112.2, 27.4], [-112.2, -23], [-118.6, -38.6],
  [-156, -52], [-163, -69], [-156, -86],
];
const W = 15;
const START_S = 140;
const BOUNDS = { minX: -190, maxX: 190, minZ: -138, maxZ: 92 };

// ---- the decks (standard club orientation: tone arm at the back right). Both platters turn clockwise seen from
// above like real turntables. 33 1/3 and 45 rpm (3.5 and 4.7 rad/s) would throw toy cars off at once, so they are
// scaled down to 0.75 and 1.0 rad/s (the same 3:4 ratio).
const PLINTH = { hw: 22.65, hd: 17.65 };
const R_PLAT = 16, R_MAT = 15.4, R_REC = 15, R_LAB = 5, H_DECK = 0.8;
const ARM = { px: 19.8, pz: -9.4, L: 23, tip: 1.6, back: 6.8, r: 1.05, rest: 1.536, y: 2.7 };
ARM.d = Math.hypot(ARM.px, ARM.pz); ARM.phi = Math.atan2(ARM.pz, ARM.px);
const DECKS = [
  { id: 'L', x: -112, z: 0, w: 0.75, rpm: '33', phase: 8, fling: 0.6, label: 0 },
  { id: 'R', x: 114, z: 0, w: 1.0, rpm: '45', phase: 0, fling: 0.6, label: 1 },
];
for (const d of DECKS) { d.sx = d.x - 5.2; d.sz = d.z; d.pvx = d.sx + ARM.px; d.pvz = d.sz + ARM.pz; }
// arm angle with the stylus at radius rho from the spindle
const armAt = (rho) => ARM.phi + PI - Math.acos(clamp((ARM.d * ARM.d + ARM.L * ARM.L - rho * rho) / (2 * ARM.L * ARM.d), -1, 1));
const TH_IN = armAt(14.4), TH_OUT = armAt(9.5);
// one cycle = 16 beats: on the rest; lifted (the telegraph: target light up, landing spot lit); swings in across the
// road (it hits); needle down, tracking inward (it blocks the outer lane, the gap by the label stays open); lifted and
// back (passes over the cars); set down on the rest
const ARMC = { n: 16, lift0: 8, swing0: 10, swing1: 11.5, play1: 14.5, back1: 15.6 };
const armBeat = (t, d) => (((t / BEAT + d.phase) % ARMC.n) + ARMC.n) % ARMC.n;
const crossedB = (pb, b, x) => (pb <= b ? pb < x && b >= x : pb < x || b >= x);
function armPose(t, d) {
  const b = armBeat(t, d);
  let th = ARM.rest, lift = 0, hot = true, warn = 0;
  if (b < ARMC.lift0) { th = ARM.rest; lift = 0; }
  else if (b < ARMC.swing0) { lift = ss(ARMC.lift0, ARMC.lift0 + 0.5, b); warn = 1; hot = false; }
  else if (b < ARMC.swing1) { th = lerp(ARM.rest, TH_IN, ss(ARMC.swing0, ARMC.swing1, b)); lift = 0.45 * (1 - ss(ARMC.swing1 - 0.4, ARMC.swing1, b)); warn = 1; }
  else if (b < ARMC.play1) { th = lerp(TH_IN, TH_OUT, (b - ARMC.swing1) / (ARMC.play1 - ARMC.swing1)); lift = 0; }
  else if (b < ARMC.back1) { th = lerp(TH_OUT, ARM.rest, ss(ARMC.play1 + 0.3, ARMC.back1, b)); lift = ss(ARMC.play1, ARMC.play1 + 0.3, b); hot = false; }
  else { th = ARM.rest; lift = 1 - ss(ARMC.back1, ARMC.n, b); hot = lift < 0.4; }
  return { th, lift, hot, warn, b };
}

// ---- the mixer (flush in the booth like the decks): four long-throw channel faders sweep across the road in a wave
// that rolls west at about racing speed (ride it and every gap opens as you get there); the crossfader shuttles in
// the road's near (south) lane. MIX.zc (the road's centre line over the mixer) is measured from the track in build().
const MIX = { x: 0, z: 0, hw: 20, hd: 25, zc: 4.6 };
const CH = [-12.75, -4.25, 4.25, 12.75];
const CH_COL = [0xff3aa8, 0x38d8ff, 0xffc030, 0x9b6bff];
const FAD = { z0: 0, z1: 0, hw: 1.45, hd: 0.8, h: 2.0 };
const XF = { z: 0, x0: -7, x1: 7, hw: 0.8, hd: 1.8, h: 2.0 };
const setMixZ = (zc) => { MIX.zc = zc; FAD.z0 = zc - 7.9; FAD.z1 = zc + 3.2; XF.z = zc + 6.2; };
setMixZ(4.6);
const faderZ = (t, i) => { const u = fract(t / (8 * BEAT) + i * 0.0625); return lerp(FAD.z0, FAD.z1, 0.5 - 0.5 * Math.cos(TAU * u)); };
const xfaderX = (t) => lerp(XF.x0, XF.x1, 0.5 - 0.5 * Math.cos(TAU * fract(t / (8 * BEAT) + 0.3)));

// ---- the monitor speakers at the back edge: on every kick the cars in front of a cone are shoved away from it
const SPK = [{ x: -64, z: -119 }, { x: 64, z: -119 }];
const SPKD = { hw: 17, hd: 16, h: 52, front: -103, cy: 17, R: 13.6 };
const BASS = { R: 36, kick: 20, hop: 9 };
const kickPump = (t) => { const u = fract(t / BEAT); return Math.pow(Math.max(0, 1 - u / 0.3), 2); };

// ---- props that matter for the course
const PHONES = { x: -80, z: 38 };    // DJ headphones dropped in the SW U-turn
const CAN = { x: 79, z: 14 };        // an energy drink can standing inside the swoop after the right deck
const CUP = { x: 8, z: 37 };          // the knocked-over cocktail in front of the mixer

let A = null;

export default {
  id: 'vinyl',
  name: 'Vinyl Frenzy',
  blurb: 'Hovercraft on spinning records at a club DJ booth: tone arms, faders and bass.',
  vehicle: 'hover',
  seed: 67,
  headlights: { intensity: 46, distance: 46, angle: 0.62, color: 0xf2ecff },
  track: { points: TRACK, width: W, startS: START_S },
  bounds: BOUNDS,
  fallOffEdges: true,
  floorY: -96,
  offCourse: 16,
  skidColor: 0x0d0d10,
  hoverSpray: 0x6c6290,
  dust: {
    normal: { color: 0x5e5684 },
    rough: { color: 0x4a4466 },
    slick: { color: 0x40e0ff, size: 0.8, life: 0.6, up: 2.5, grav: 8, alpha: 0.7, grow: 1.5, rate: 2 },
  },
  lighting: {
    sunDir: [-0.32, 1, -0.5], sunColor: 0xa496ff, sunIntensity: 0.85,
    hemiSky: 0x3e3070, hemiGround: 0x0e0a12, hemiIntensity: 0.5,
    envIntensity: 0.22, exposure: 1.18, background: 0x050309, shadowRadius: 2.6,
    fog: { color: 0x07050d, near: 300, far: 900 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const BU = K.BufferGeometryUtils;
    const L = track.length;
    const lowQ = !!(K.quality && K.quality.tilt === false);
    const V2 = (a, b = a) => new T.Vector2(a, b);
    A = {
      decks: [], cones: [], rings: [], vu: null, uTime: { value: 0 }, uBeat: { value: 0 }, lastB: [], L,
      spots: [], col: new T.Color(), m4: new T.Matrix4(),
    };
    const keep = []; // animated objects: not merged

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
    // static parts merged per material and per 150-unit cell (far cells get culled)
    const bins = new Map();
    const put = (geo, c, o, mat, cast = true) => {
      const g = prep(geo, c, mtx(o || {}));
      const x = o?.x ?? 0, z = o?.z ?? 0;
      const key = mat.uuid + (cast ? 'c' : 'n') + Math.floor((x + 450) / 150) + ':' + Math.floor((z + 450) / 150);
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
    const sph = (rad, ws = 16, hs = 12, ...rest) => new T.SphereGeometry(rad, ws, hs, ...rest);
    const dRoad = (x, z) => { const n = track.distTo(x, z); return n.dist - track.w[n.i] / 2; };
    const warnRoad = (what, x, z, m = 0.5) => { if (dRoad(x, z) < m) console.warn(`vinyl: ${what} near the road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const nf = TX.noiseField(256, { seed: 67, period: 8, oct: 4 });
    const nAt = (x, y) => nf[(((y | 0) % 256 + 256) % 256) * 256 + (((x | 0) % 256 + 256) % 256)];
    // contact shadows: one instanced mesh, opacity in the instance's y scale
    const contactMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
    contactMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
      sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
    };
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.06) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    // glow sprite texture (additive halos)
    const glowTex = tex(canvas(128, 128, (g, w, h) => {
      const q = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.25, 'rgba(255,255,255,0.55)'); q.addColorStop(0.6, 'rgba(255,255,255,0.12)'); q.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = q; g.fillRect(0, 0, w, h);
    }), [1, 1], false);
    const addMat = (color, opacity = 1, map = glowTex) => new T.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const flatGeo = (w, d) => { const g = new T.PlaneGeometry(w, d); g.rotateX(-PI / 2); return g; };

    // ============================================================ environment for the glossy surfaces: a dark club
    const envC = canvas(512, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#0c0818'); gr.addColorStop(0.4, '#1a1030'); gr.addColorStop(0.5, '#241436'); gr.addColorStop(0.56, '#0a0710'); gr.addColorStop(1, '#030205');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const blob = (x, y, rx, ry, col) => { const q = g.createRadialGradient(x, y, 0, x, y, rx); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = q; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore(); };
      blob(128, 60, 70, 30, 'rgba(255,60,190,0.75)'); blob(200, 40, 50, 22, 'rgba(60,220,255,0.7)'); blob(60, 90, 40, 16, 'rgba(255,170,60,0.55)');
      blob(330, 70, 60, 26, 'rgba(140,90,255,0.6)'); blob(430, 50, 50, 20, 'rgba(255,60,120,0.5)');
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,240,255,0.5)'; g.fillRect(i * 57 + 10, 18 + (i % 3) * 6, 14, 4); }
    });
    const ENV = tex(envC, [1, 1], false);
    ENV.mapping = T.EquirectangularReflectionMapping;

    // ============================================================ shared materials (vertex coloured, merged)
    const mPlastic = K.phys({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, envMap: ENV, envMapIntensity: 0.7 });
    const mMatte = K.std({ vertexColors: true, roughness: 0.85, envMap: ENV, envMapIntensity: 0.2 });
    const mMetal = K.std({ vertexColors: true, roughness: 0.28, metalness: 1, envMap: ENV, envMapIntensity: 1.2 });
    const mRubber = K.std({ vertexColors: true, roughness: 0.68, envMap: ENV, envMapIntensity: 0.35 });
    // LEDs that don't change: the vertex colour is the glow
    const mGlow = K.std({ vertexColors: true, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 1.0, toneMapped: false });
    mGlow.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb * 1.6;'); };
    // the same for instanced LEDs whose colour is the instance colour
    const glowInst = (k) => {
      const m = K.std({ color: 0x080808, emissive: 0xffffff, emissiveIntensity: k, roughness: 0.5, toneMapped: false });
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); };
      return m;
    };

    // ============================================================ the booth, the club floor far below
    {
      const bw = BOUNDS.maxX - BOUNDS.minX, bd = BOUNDS.maxZ - BOUNDS.minZ, cx = (BOUNDS.minX + BOUNDS.maxX) / 2, cz = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
      // black melamine booth top: fine speckle, wiped smears, scratches and the odd cup ring (a little sheen)
      const S = 1024, hgt = new Float32Array(S * S);
      const big = TX.noiseField(256, { seed: 12, period: 4, oct: 3 });
      const bt = TX.paint(S, S, (x, y, u, v, o) => {
        const n = nAt(x, y), b = big[((y >> 2) & 255) * 256 + ((x >> 2) & 255)];
        hgt[y * S + x] = n * 0.3 + b * 0.2;
        const k = 15 + n * 5 + (b - 0.5) * 8;
        o[0] = k; o[1] = k * 0.96; o[2] = k * 1.12;
      });
      const bg = bt.getContext('2d'), pr = K.rng(21);
      for (let i = 0; i < 160; i++) { // scratches
        const x = pr() * S, y = pr() * S, a = pr() * TAU, l = 10 + pr() * 60;
        bg.strokeStyle = `rgba(150,140,170,${0.05 + pr() * 0.1})`; bg.lineWidth = 0.6 + pr();
        bg.beginPath(); bg.moveTo(x, y); bg.quadraticCurveTo(x + Math.cos(a + 0.3) * l * 0.5, y + Math.sin(a + 0.3) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); bg.stroke();
      }
      for (let i = 0; i < 7; i++) { // cup rings
        const x = pr() * S, y = pr() * S, rr = 22 + pr() * 10;
        bg.strokeStyle = 'rgba(90,80,110,0.18)'; bg.lineWidth = 3 + pr() * 3; bg.beginPath(); bg.arc(x, y, rr, pr() * 2, pr() * 2 + 5.4); bg.stroke();
      }
      const roughC = TX.paint(512, 512, (x, y, u, v, o) => { const b = big[((y >> 1) & 255) * 256 + ((x >> 1) & 255)]; const k = (0.38 + (b - 0.5) * 0.35 + nAt(x * 2, y * 2) * 0.08) * 255; o[0] = o[1] = o[2] = clamp(k, 30, 230); });
      const topT = tex(bt, [bw / 110, bd / 110]), topR = TX.toTexture(roughC, { srgb: false, repeat: [bw / 90, bd / 90] });
      const topN = TX.toTexture(TX.normalFromHeight(hgt, S, S, 0.5), { srgb: false, repeat: [bw / 110, bd / 110] });
      const topMat = K.std({ map: topT, roughnessMap: topR, normalMap: topN, normalScale: V2(0.25), roughness: 1, metalness: 0.05, envMap: ENV, envMapIntensity: 0.6 });
      const top = K.mesh(new T.BoxGeometry(bw, 5, bd), topMat, cx, -2.5, cz, { cast: false });
      top.receiveShadow = true;
      // the booth cabinet below, a metal lip and an LED strip under it on both long edges
      const cab = K.std({ color: 0x0c0b0e, roughness: 0.7 });
      K.mesh(box(bw - 6, 88, bd - 6), cab, cx, -50, cz, { cast: false });
      const lip = K.metal(0x3a3a42, 0.35);
      K.mesh(box(bw, 1.6, 1.2), lip, cx, -0.8, BOUNDS.maxZ + 0.4, { cast: false });
      const ledFront = K.std({ color: 0x111111, emissive: 0xff2aa8, emissiveIntensity: 2.2, roughness: 0.4, toneMapped: false });
      A.ledFront = K.mesh(box(bw - 4, 0.7, 0.4), ledFront, cx, -2.6, BOUNDS.maxZ + 1.1, { cast: false });
      K.mesh(box(bw - 4, 0.7, 0.4), ledFront, cx, -2.6, BOUNDS.minZ - 1.1, { cast: false });
      // a low LED light bar lying along the back of the booth between the speakers
      K.mesh(rbox(72, 2.6, 3.2, 0.6), K.std({ color: 0x15151a, roughness: 0.5, metalness: 0.4 }), 0, 1.3, -112, { cast: true });
      K.mesh(box(70, 0.4, 1.6), ledFront, 0, 2.65, -111.4, { cast: false });
      K.box(0, -112, 36, 1.6, 0, 2.6);
      const barGlow = K.mesh(flatGeo(80, 14), addMat(0xff2aa8, 0.35), 0, 0.12, -106, { cast: false, receive: false }); barGlow.renderOrder = 3;
      A.barGlow = barGlow;
      // the club's floor: dark rubber tiles with coloured light pools from the dance floor
      const fc = canvas(512, 512, (g, w, h) => {
        g.fillStyle = '#0c0b10'; g.fillRect(0, 0, w, h);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const k = 10 + ((x * 7 + y * 13) % 5); g.fillStyle = `rgb(${k},${k},${k + 4})`; g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); }
        const pr = K.rng(9);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${pr() * 0.05})`; g.fillRect(pr() * w, pr() * h, 1.5, 1.5); }
      });
      K.mesh(new T.PlaneGeometry(1800, 1800), K.std({ map: tex(fc, [30, 30]), roughness: 0.6, metalness: 0.1 }), 0, -96, 0, { rx: -PI / 2, cast: false });
      for (const [x, z, rr, c] of [[-120, -260, 160, 0xff2aa8], [140, -300, 190, 0x28d8ff], [0, -420, 230, 0x9b6bff], [-330, -120, 150, 0xffa030], [330, -60, 150, 0x28d8ff]]) {
        const m = K.mesh(flatGeo(rr * 2, rr * 2), addMat(c, 0.22), x, -95.5, z, { cast: false, receive: false });
        m.renderOrder = 2;
      }
    }

    // ============================================================ road: three strips of matte gaffer tape, LED edges
    const onPlatter = (x, z, m = 0) => DECKS.some((d) => Math.hypot(x - d.sx, z - d.sz) < R_PLAT + m);
    const onPlinth = (x, z, m = 0) => DECKS.some((d) => Math.abs(x - d.x) < PLINTH.hw + m && Math.abs(z - d.z) < PLINTH.hd + m);
    const onMixer = (x, z, m = 0) => Math.abs(x - MIX.x) < MIX.hw + m && Math.abs(z - MIX.z) < MIX.hd + m;
    // ribbon of quads between two lateral offsets, kept where keepFn(x, z, s) is true
    const ribbon = ({ mat, y, lat0, lat1, keepFn, vScale = 20, step = 1, uSeg = 1, cast = false, ro = 0 }) => {
      const rows = Math.ceil(L / step), cols = uSeg + 1;
      const P = [], U = [], idx = [];
      for (let i = 0; i <= rows; i++) {
        const s = Math.min(L, i * step), p = track.at(s % L);
        const o0 = lat0(p.w), o1 = lat1(p.w);
        for (let j = 0; j < cols; j++) { const o = o0 + (o1 - o0) * j / uSeg; P.push(p.x + p.nx * o, y, p.z + p.nz * o); U.push(j / uSeg, s / vScale); }
      }
      for (let i = 0; i < rows; i++) for (let j = 0; j < uSeg; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        const cx = (P[a * 3] + P[d * 3]) / 2, cz = (P[a * 3 + 2] + P[d * 3 + 2]) / 2;
        if (keepFn && !keepFn(cx, cz, (i + 0.5) * step)) continue;
        idx.push(a, b, c, b, d, c);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      const m = new T.Mesh(g, mat); m.receiveShadow = true; m.castShadow = cast; m.renderOrder = ro;
      K.group.add(m);
      return m;
    };
    {
      // gaffer tape: woven cloth, three 5 cm strips side by side with slightly overlapping seams, a few creases
      const S = 512;
      const hgt = new Float32Array(S * S);
      const tc = TX.paint(S, S, (x, y, u, v, o) => {
        const wv = 0.5 + 0.25 * Math.sin(x * 1.9) * Math.sin(y * 1.9) + 0.25 * Math.sin((x + y) * 0.7);
        const n = nAt(x * 0.5, y * 0.5);
        const strip = u * 3, f = strip - Math.floor(strip), seam = f < 0.012 || f > 0.988;
        const crease = Math.abs(Math.sin(y * 0.031 + Math.floor(strip) * 2.1 + n * 2)) > 0.995 ? 1 : 0;
        hgt[y * S + x] = wv * 0.25 + n * 0.6 + (seam ? 0.6 : 0) + crease * 0.3;
        const k = 38 + wv * 8 + (n - 0.5) * 16 + (seam ? 16 : 0) + crease * 8;
        o[0] = k; o[1] = k * 0.98; o[2] = k * 1.05;
      });
      const tapeMap = tex(tc, [1, 1]);
      const tapeN = TX.toTexture(TX.normalFromHeight(hgt, S, S, 1.2), { srgb: false });
      const tapeMat = K.std({ map: tapeMap, normalMap: tapeN, normalScale: V2(0.6), roughness: 0.88, envMap: ENV, envMapIntensity: 0.15 });
      const onGear = (x, z) => onPlinth(x, z, -0.3) || onMixer(x, z, -0.3);
      ribbon({ mat: tapeMat, y: 0.03, lat0: (w) => -w / 2 - 0.15, lat1: (w) => w / 2 + 0.15, keepFn: (x, z) => !onGear(x, z), vScale: 30, uSeg: 3 });
      // a faint shadow line where the tape edge lifts
      const sh = K.std({ color: 0x000000, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });
      for (const sd of [-1, 1]) ribbon({ mat: sh, y: 0.02, lat0: (w) => sd * (w / 2 + 0.15), lat1: (w) => sd * (w / 2 + 0.55), keepFn: (x, z) => !onGear(x, z) });
    }
    // LED strips along both edges: a white PCB with an SMD chip every 1.67 (60/m), chasing with the beat
    {
      const lc = canvas(64, 256, (g, w, h) => {
        g.fillStyle = '#d8d8dc'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) { const y = i * 64 + 18; g.fillStyle = '#ffffff'; g.fillRect(14, y, 36, 28); g.fillStyle = '#fff6ff'; g.fillRect(20, y + 6, 24, 16); g.fillStyle = '#7a7a80'; g.fillRect(28, y + 40, 8, 12); }
      });
      const ec = canvas(64, 256, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) { const y = i * 64 + 18; const q = g.createRadialGradient(32, y + 14, 2, 32, y + 14, 26); q.addColorStop(0, '#fff'); q.addColorStop(0.5, '#ccc'); q.addColorStop(1, '#000'); g.fillStyle = q; g.fillRect(0, y - 12, w, 52); }
      });
      const mk = (color) => {
        const m = K.std({ map: tex(lc, [1, 1]), emissiveMap: tex(ec, [1, 1]), emissive: color, emissiveIntensity: 2.4, roughness: 0.45, toneMapped: false });
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = A.uTime; sh.uniforms.uBeat = A.uBeat;
          sh.fragmentShader = 'uniform float uTime;\nuniform float uBeat;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\nfloat chase = 0.5 + 0.5 * sin(vEmissiveMapUv.y * 6.2831 / 6.0 - uTime * 6.5);\ntotalEmissiveRadiance *= 0.35 + 0.65 * chase * chase + 0.9 * uBeat;');
        };
        return m;
      };
      // the strips run on the booth, the plinths and the mixer, but not on the spinning records
      const keepLED = (x, z) => !onPlatter(x, z, 0.2);
      A.ledL = mk(0xff2aa8); A.ledR = mk(0x28d8ff);
      ribbon({ mat: A.ledL, y: 0.07, lat0: (w) => -w / 2 - 0.15, lat1: (w) => -w / 2 + 0.55, keepFn: keepLED, vScale: 6.67 });
      ribbon({ mat: A.ledR, y: 0.07, lat0: (w) => w / 2 - 0.55, lat1: (w) => w / 2 + 0.15, keepFn: keepLED, vScale: 6.67 });
      // soft glow spilling onto the booth on either side of each strip
      const hc = canvas(64, 8, (g, w, h) => { const q = g.createLinearGradient(0, 0, w, 0); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.5, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
      const hmap = tex(hc, [1, 1], false);
      A.haloL = addMat(0xff2aa8, 0.5, hmap); A.haloR = addMat(0x28d8ff, 0.5, hmap);
      ribbon({ mat: A.haloL, y: 0.09, lat0: (w) => -w / 2 - 1.8, lat1: (w) => -w / 2 + 1.4, keepFn: keepLED, ro: 3 });
      ribbon({ mat: A.haloR, y: 0.09, lat0: (w) => w / 2 - 1.4, lat1: (w) => w / 2 + 1.8, keepFn: keepLED, ro: 3 });
    }
    // start / finish: a strip of chequered spike tape across the road
    {
      const cc = canvas(256, 64, (g) => {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#eee'; g.fillRect(x * 16, y * 16, 16, 16); }
      });
      const m = K.std({ map: tex(cc, [1, 1], false), roughness: 0.8 });
      const p = track.at(START_S);
      const g = new T.PlaneGeometry(W + 0.4, 2.8); g.rotateX(-PI / 2);
      const mesh = new T.Mesh(g, m); mesh.position.set(p.x, 0.06, p.z); mesh.rotation.y = -p.angle + PI / 2; mesh.receiveShadow = true;
      K.group.add(mesh);
    }

    // ============================================================ the turntables
    // record labels (made up)
    const LABELS = [
      { name: 'NIGHT OWL', sub: 'RECORDS', bg: '#ff7a1a', bg2: '#ffb347', ink: '#2a1204', side: 'SIDE A · 33⅓ RPM', track: 'MIDNIGHT SPIN (CLUB MIX)' },
      { name: 'VELVET', sub: 'GROOVE', bg: '#e8147c', bg2: '#ff5ab0', ink: '#ffffff', side: 'SIDE B · 45 RPM', track: 'BASSLINE FEVER' },
    ];
    const labelTex = (L0) => tex(canvas(256, 256, (g, w) => {
      const c = w / 2;
      const q = g.createRadialGradient(c, c, 10, c, c, c); q.addColorStop(0, L0.bg2); q.addColorStop(1, L0.bg);
      g.fillStyle = q; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
      g.strokeStyle = L0.ink; g.globalAlpha = 0.5; g.lineWidth = 3; g.beginPath(); g.arc(c, c, c - 8, 0, TAU); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = L0.ink; g.textAlign = 'center';
      g.font = 'bold 34px "Lilita One", Rubik, sans-serif'; g.fillText(L0.name, c, 72);
      g.font = 'bold 18px Rubik, sans-serif'; g.fillText(L0.sub, c, 94);
      g.font = '15px Rubik, sans-serif'; g.fillText(L0.track, c, 176); g.fillText(L0.side, c, 198);
      g.lineWidth = 4; g.strokeStyle = L0.ink; g.beginPath(); g.arc(c - 46, c, 12, 0, TAU); g.stroke(); g.beginPath(); g.arc(c + 46, c, 12, 0, TAU); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(c, c, 7, 0, TAU); g.fill();
    }), [1, 1], false);
    // vinyl: concentric grooves (normal map) with the dead wax and track gaps, anisotropic sheen along the grooves
    const vinyl = (() => {
      const S = 512, hgt = new Float32Array(S * S), cS = S / 2;
      const col = TX.paint(S, S, (x, y, u, v, o) => {
        const rr = Math.hypot(x - cS, y - cS) / cS * R_REC; // radius in cm
        let k = 14, hh = 0.5;
        if (rr < R_LAB + 0.2) { k = 10; hh = 0.5; }
        else if (rr < 6.2) { k = 18; hh = 0.5; } // dead wax
        else if (rr < 14.6) {
          const gap = [8.4, 10.5, 12.6].some((gr) => Math.abs(rr - gr) < 0.12);
          hh = gap ? 0.5 : 0.5 + 0.22 * Math.sin(rr * 46);
          k = gap ? 22 : 13 + 3 * Math.sin(rr * 46);
        } else { k = 16; hh = 0.5 + 0.1 * (rr - 14.6); }
        hgt[y * S + x] = hh; o[0] = k; o[1] = k; o[2] = k * 1.08;
      });
      const an = TX.paint(S, S, (x, y, u, v, o) => {
        // direction along the groove (tangent of the circle), in texture space, strength 1
        const dx = x - cS, dy = y - cS, l = Math.hypot(dx, dy) || 1;
        o[0] = (-dy / l * 0.5 + 0.5) * 255; o[1] = (dx / l * 0.5 + 0.5) * 255; o[2] = 255;
      });
      return { map: tex(col, [1, 1], false), normalMap: TX.toTexture(TX.normalFromHeight(hgt, S, S, 0.9), { srgb: false, wrap: false }), anisotropyMap: TX.toTexture(an, { srgb: false, wrap: false }) };
    })();
    const recMat = K.phys({ map: vinyl.map, normalMap: vinyl.normalMap, normalScale: V2(0.6), roughness: 0.28, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.18, anisotropy: 0.85, anisotropyMap: vinyl.anisotropyMap, envMap: ENV, envMapIntensity: 1.1 });
    const recEdge = K.std({ color: 0x0b0b0d, roughness: 0.35 });
    // the platter's rim: aluminium with rows of strobe dots
    const rimTex = tex(canvas(512, 32, (g, w) => {
      g.fillStyle = '#c8cad0'; g.fillRect(0, 0, w, 32);
      for (let row = 0; row < 3; row++) { const n = [90, 100, 110][row]; for (let i = 0; i < n; i++) { g.fillStyle = '#4a4c52'; g.fillRect(i * w / n, 4 + row * 9, w / n * 0.5, 5); } }
    }), [1, 1], true);
    const rimMat = K.std({ map: rimTex, roughness: 0.3, metalness: 0.9, envMap: ENV, envMapIntensity: 1.2 });
    const matTex = tex(canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#16151a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3cf'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, TAU); g.stroke();
    }), [1, 1], false);
    const slipMat = K.std({ map: matTex, roughness: 0.95 });
    // plinth top: satin black with printed markings
    const plinthTex = (d) => tex(canvas(512, 400, (g, w, h) => {
      const sx = w / (PLINTH.hw * 2), sz = h / (PLINTH.hd * 2), X = (x) => (x + PLINTH.hw) * sx, Z = (z) => (z + PLINTH.hd) * sz;
      g.fillStyle = '#1b1b20'; g.fillRect(0, 0, w, h);
      const pr = K.rng(d.label + 5);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${pr() * 0.025})`; g.fillRect(pr() * w, pr() * h, 2, 1); }
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = 'rgba(230,230,240,0.75)'; g.textAlign = 'left'; g.font = 'bold 13px Rubik, sans-serif';
      g.fillText('DIRECT DRIVE · QUARTZ', X(-21.5), Z(-15.8));
      g.fillText('START · STOP', X(-21.6), Z(10.6));
      g.fillText('33', X(-13.2), Z(12.2)); g.fillText('45', X(-10.2), Z(12.2));
      g.textAlign = 'center'; g.fillText('PITCH', X(18.5), Z(-0.6)); g.font = '11px Rubik, sans-serif';
      for (let i = -8; i <= 8; i += 2) { const z = Z(8 + i * 0.75); g.fillRect(X(16.9), z, 8, 1.5); if (i % 4 === 0) g.fillText(String(Math.abs(i)), X(15.8), z + 4); }
      g.fillText('ANTI-SKATE', X(19.5), Z(-15));
      g.fillStyle = '#060607'; g.fillRect(X(18.2), Z(1), 0.7 * sx, 14 * sz);
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.arc(X(ARM.px - 5.2), Z(ARM.pz), 4.2 * sx, 0, TAU); g.stroke();
    }), [1, 1], false);
    const plinthEdge = K.metal(0x2a2a30, 0.4);
    const armMetal = K.std({ color: 0xd8dade, roughness: 0.16, metalness: 1, envMap: ENV, envMapIntensity: 1.5 });
    const armDark = K.std({ color: 0x1c1c20, roughness: 0.35, metalness: 0.6, envMap: ENV, envMapIntensity: 0.8 });
    const cartMats = [K.plastic(0xd41e2a, 0.3), K.plastic(0x18a8e0, 0.3)];
    for (const d of DECKS) {
      // plinth: a flush satin-black top in a metal frame
      const pt = K.std({ map: plinthTex(d), roughness: 0.5, metalness: 0.3, envMap: ENV, envMapIntensity: 0.6 });
      K.mesh(box(PLINTH.hw * 2, 0.5, PLINTH.hd * 2), [plinthEdge, plinthEdge, pt, plinthEdge, plinthEdge, plinthEdge], d.x, -0.24, d.z, { cast: false });
      put(box(PLINTH.hw * 2 + 0.9, 0.12, 0.45), 0x3a3a44, { x: d.x, y: 0.0, z: d.z - PLINTH.hd }, mMetal, false);
      put(box(PLINTH.hw * 2 + 0.9, 0.12, 0.45), 0x3a3a44, { x: d.x, y: 0.0, z: d.z + PLINTH.hd }, mMetal, false);
      put(box(0.45, 0.12, PLINTH.hd * 2), 0x3a3a44, { x: d.x - PLINTH.hw, y: 0.0, z: d.z }, mMetal, false);
      put(box(0.45, 0.12, PLINTH.hd * 2), 0x3a3a44, { x: d.x + PLINTH.hw, y: 0.0, z: d.z }, mMetal, false);
      // the spinning part: platter (rim with strobe dots), slipmat, record, label, spindle
      const g = new T.Group(); g.position.set(d.sx, 0, d.sz);
      const plat = new T.Mesh(cyl(R_PLAT, R_PLAT, 0.62, 64, true), rimMat); plat.position.y = 0.31; g.add(plat);
      const platTop = new T.Mesh(new T.CircleGeometry(R_PLAT, 64), armMetal); platTop.rotation.x = -PI / 2; platTop.position.y = 0.6; g.add(platTop);
      const slip = new T.Mesh(new T.CircleGeometry(R_MAT, 64), slipMat); slip.rotation.x = -PI / 2; slip.position.y = 0.64; g.add(slip);
      const recGeo = cyl(R_REC, R_REC, 0.14, 64);
      { const uv = recGeo.attributes.uv, pos = recGeo.attributes.position; for (let i = 0; i < uv.count; i++) if (Math.abs(pos.getY(i) - 0.07) < 1e-4) uv.setXY(i, pos.getX(i) / (2 * R_REC) + 0.5, -pos.getZ(i) / (2 * R_REC) + 0.5); }
      const rec = new T.Mesh(recGeo, [recEdge, recMat, recEdge]); rec.position.y = 0.73; g.add(rec);
      const lab = new T.Mesh(new T.CircleGeometry(R_LAB, 48), K.std({ map: labelTex(LABELS[d.label]), roughness: 0.55 })); lab.rotation.x = -PI / 2; lab.position.y = H_DECK + 0.012; g.add(lab);
      const spin = new T.Mesh(cyl(0.36, 0.36, 1.3, 12), armMetal); spin.position.y = H_DECK + 0.65; g.add(spin);
      K.add(g, { cast: false }); plat.castShadow = true; rec.receiveShadow = true;
      keep.push(g);
      K.spinner(d.sx, d.sz, R_PLAT, (t) => d.w * t, { h: H_DECK, fling: d.fling, pull: 0.5 });
      AO(d.sx, d.sz, R_PLAT + 1.5, R_PLAT + 1.5, 0.55, 0, 0.03);

      // tone arm: base, gimbal, straight arm with headshell and cartridge, counterweight; the arm rest and cue lever
      put(cyl(3.6, 3.8, 1.2, 32), 0x2a2a30, { x: d.pvx, y: 0.6, z: d.pvz }, mMetal);
      put(cyl(2.4, 2.6, 1.0, 32), 0xb8bcc4, { x: d.pvx, y: 1.7, z: d.pvz }, mMetal);
      put(cyl(1.3, 1.5, 1.2, 20), 0x1a1a1e, { x: d.pvx, y: 2.6, z: d.pvz }, mMetal);
      K.circle(d.pvx, d.pvz, 3.7, 4);
      AO(d.pvx, d.pvz, 4.6, 4.6, 0.6);
      const restX = d.pvx + Math.cos(ARM.rest) * 21.6, restZ = d.pvz + Math.sin(ARM.rest) * 21.6;
      put(cyl(0.55, 0.7, 2.3, 12), 0x2a2a30, { x: restX, y: 1.15, z: restZ }, mMetal);
      put(box(1.6, 0.5, 0.5), 0x1a1a1e, { x: restX, y: 2.35, z: restZ, ry: -ARM.rest }, mRubber);
      K.circle(restX, restZ, 0.9, 2.5);
      put(box(0.6, 0.6, 2.6), 0x1a1a1e, { x: d.pvx + 4.4, y: 0.4, z: d.pvz + 8 }, mPlastic); // cue lever base
      put(cyl(0.9, 0.9, 0.5, 16), 0xb8bcc4, { x: d.pvx + 1.5, y: 0.3, z: d.pvz - 5.6 }, mMetal); // anti-skate dial
      const yaw = new T.Group(); yaw.position.set(d.pvx, ARM.y, d.pvz);
      const lift = new T.Group(); yaw.add(lift);
      const tube = new T.Mesh(cyl(0.52, 0.52, 21.2, 14), armMetal); tube.rotation.z = PI / 2; tube.position.set(10.4, -0.05, 0); lift.add(tube);
      const stub = new T.Mesh(cyl(0.55, 0.55, 4.2, 14), armMetal); stub.rotation.z = PI / 2; stub.position.set(-2.4, 0, 0); lift.add(stub);
      const cw = new T.Mesh(cyl(1.55, 1.55, 3.2, 24), armDark); cw.rotation.z = PI / 2; cw.position.set(-5.2, 0, 0); lift.add(cw);
      const cwRing = new T.Mesh(cyl(1.62, 1.62, 0.5, 24), armMetal); cwRing.rotation.z = PI / 2; cwRing.position.set(-3.7, 0, 0); lift.add(cwRing);
      const hs = new T.Group(); hs.position.set(22.0, -0.35, 0); hs.rotation.y = 0.32; lift.add(hs); // headshell with its offset angle
      const shell = new T.Mesh(rbox(3.6, 0.35, 1.9, 0.15), armDark); shell.position.x = 0.9; hs.add(shell);
      const finger = new T.Mesh(box(2.2, 0.18, 0.35), armMetal); finger.position.set(2.6, 0.25, 0.9); finger.rotation.z = 0.3; hs.add(finger);
      const cart = new T.Mesh(rbox(2.0, 1.1, 1.4, 0.2), cartMats[d.label]); cart.position.set(1.0, -0.72, 0); hs.add(cart);
      const ledMat = K.std({ color: 0x220000, emissive: 0xff1a1a, emissiveIntensity: 0, toneMapped: false });
      const led = new T.Mesh(sph(0.32, 10, 8), ledMat); led.position.set(-0.6, 0.35, 0); hs.add(led);
      const glowArm = new T.Mesh(flatGeo(30, 6), addMat(0xff2040, 0)); glowArm.position.set(10, -ARM.y + 0.9, 0); lift.add(glowArm); glowArm.renderOrder = 4;
      K.add(yaw);
      keep.push(yaw);
      K.mover({ type: 'capsule', r: ARM.r, h: 3.2 }, (t) => {
        const p = armPose(t, d), c = Math.cos(p.th), s = Math.sin(p.th);
        return { x1: d.pvx - c * ARM.back, z1: d.pvz - s * ARM.back, x2: d.pvx + c * (ARM.L + ARM.tip), z2: d.pvz + s * (ARM.L + ARM.tip), h: p.hot ? 3.2 : 0 };
      });
      // the target light (pops up and shines at the landing groove) and the strobe lamp by the platter
      const tlx = d.x - 19.5, tlz = d.z + 12.5;
      put(cyl(1.2, 1.2, 0.3, 16), 0x2a2a30, { x: tlx, y: 0.1, z: tlz }, mMetal, false);
      const tl = new T.Group(); tl.position.set(tlx, 0, tlz);
      const tlPost = new T.Mesh(cyl(0.45, 0.45, 2.6, 10), armMetal); tlPost.position.y = 1.3; tl.add(tlPost);
      const tlHeadMat = K.std({ color: 0x333333, emissive: 0xfff4e0, emissiveIntensity: 0, toneMapped: false });
      const tlHead = new T.Mesh(sph(0.75, 12, 10), tlHeadMat); tlHead.position.y = 2.7; tl.add(tlHead);
      K.add(tl); keep.push(tl);
      const strobe = new T.Mesh(sph(0.9, 14, 8, 0, TAU, 0, PI / 2), K.std({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 1.4, toneMapped: false }));
      strobe.position.set(d.x - 21.2, 0, d.z + 5.5); K.add(strobe, { cast: false });
      // pool of light where the needle will land (shows during the telegraph) and the target light's beam
      const lx = d.pvx + Math.cos(TH_IN) * ARM.L, lz = d.pvz + Math.sin(TH_IN) * ARM.L;
      const pool = new T.Mesh(flatGeo(9, 9), addMat(0xfff0d8, 0)); pool.position.set(lx, H_DECK + 0.05, lz); pool.renderOrder = 5; K.group.add(pool);
      const bl = Math.hypot(lx - tlx, lz - tlz);
      const bg = cyl(0.4, 3.6, bl, 16, true); bg.rotateX(PI / 2); bg.translate(0, 0, bl / 2);
      const beam = new T.Mesh(bg, addMat(0xfff0d8, 0, null)); beam.position.set(tlx, 2.7, tlz); beam.lookAt(lx, H_DECK, lz); beam.renderOrder = 5; K.group.add(beam);
      // start/stop button, 33/45 buttons with their LEDs, pitch fader
      put(rbox(4.8, 0.6, 3.0, 0.3), 0x2c2c32, { x: d.x - 18.4, y: 0.15, z: d.z + 13.6 }, mPlastic, false);
      put(rbox(2.2, 0.5, 1.4, 0.2), 0x2c2c32, { x: d.x - 12.2, y: 0.15, z: d.z + 14.6 }, mPlastic, false);
      put(rbox(2.2, 0.5, 1.4, 0.2), 0x2c2c32, { x: d.x - 9.2, y: 0.15, z: d.z + 14.6 }, mPlastic, false);
      put(sph(0.3, 8, 6), d.rpm === '33' ? 0xff9a20 : 0x401808, { x: d.x - 12.2, y: 0.45, z: d.z + 13.3 }, mGlow, false);
      put(sph(0.3, 8, 6), d.rpm === '45' ? 0xff9a20 : 0x401808, { x: d.x - 9.2, y: 0.45, z: d.z + 13.3 }, mGlow, false);
      put(rbox(2.6, 0.9, 1.4, 0.25), 0x1c1c22, { x: d.x + 18.55, y: 0.45, z: d.z + 8.3 }, mPlastic, false);
      put(box(2.4, 0.08, 0.2), 0xffffff, { x: d.x + 18.55, y: 0.92, z: d.z + 8.3 }, mGlow, false);
      A.decks.push({ d, g, yaw, lift, ledMat, glowArm, tlHeadMat, tl, pool, beam });
      A.lastB.push(-1);
    }

    // ============================================================ the mixer
    {
      const n = track.distTo(MIX.x, 4.5);
      setMixZ(track.at(n.s).z);
      // faceplate print
      const fc = canvas(512, 640, (g, w, h) => {
        const sx = w / (MIX.hw * 2), sz = h / (MIX.hd * 2), X = (x) => (x + MIX.hw) * sx, Z = (z) => (z + MIX.hd) * sz;
        g.fillStyle = '#23242a'; g.fillRect(0, 0, w, h);
        const pr = K.rng(77);
        for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(255,255,255,${pr() * 0.02})`; g.fillRect(pr() * w, pr() * h, 2, 2); }
        g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
        g.fillStyle = 'rgba(235,235,245,0.8)'; g.textAlign = 'center'; g.font = 'bold 14px Rubik, sans-serif';
        CH.forEach((x, i) => {
          g.fillText(String(i + 1), X(x), Z(-23.6));
          ['GAIN', 'HI', 'MID', 'LOW'].forEach((t, k) => { g.font = '10px Rubik, sans-serif'; g.fillText(t, X(x), Z(-21.5 + k * 4 - 1.7)); });
          g.font = 'bold 14px Rubik, sans-serif';
          // fader slot and scale
          g.fillStyle = '#050506'; g.fillRect(X(x) - 3, Z(FAD.z0), 6, (FAD.z1 - FAD.z0) * sz);
          g.fillStyle = 'rgba(235,235,245,0.6)';
          for (let k = 0; k <= 10; k++) { const z = Z(FAD.z0 + (FAD.z1 - FAD.z0) * k / 10); g.fillRect(X(x) + 9, z, k % 5 ? 5 : 9, 1.5); g.fillRect(X(x) - 9 - (k % 5 ? 5 : 9), z, k % 5 ? 5 : 9, 1.5); }
          g.fillStyle = 'rgba(235,235,245,0.8)'; g.font = '10px Rubik, sans-serif'; g.fillText('CUE', X(x), Z(17.6));
        });
        g.fillStyle = '#050506'; g.fillRect(X(XF.x0), Z(XF.z) - 3, (XF.x1 - XF.x0) * sx, 6);
        g.fillStyle = 'rgba(235,235,245,0.7)'; g.font = '10px Rubik, sans-serif'; g.fillText('A', X(XF.x0 - 1.5), Z(XF.z) + 4); g.fillText('B', X(XF.x1 + 1.5), Z(XF.z) + 4);
        g.font = 'bold 15px "Lilita One", Rubik, sans-serif'; g.fillText('MX-4 CLUB MIXER', X(0), Z(22.8));
        g.font = '10px Rubik, sans-serif'; g.fillText('PHONES', X(15.5), Z(20.5)); g.fillText('MASTER', X(-15.5), Z(20.5));
      });
      const faceMat = K.std({ map: tex(fc, [1, 1], false), roughness: 0.45, metalness: 0.45, envMap: ENV, envMapIntensity: 0.7 });
      const edge = K.metal(0x34343c, 0.35);
      K.mesh(box(MIX.hw * 2, 0.5, MIX.hd * 2), [edge, edge, faceMat, edge, edge, edge], MIX.x, -0.24, MIX.z, { cast: false });
      for (const [w, dd, x, z] of [[MIX.hw * 2 + 0.9, 0.45, 0, -MIX.hd], [MIX.hw * 2 + 0.9, 0.45, 0, MIX.hd], [0.45, MIX.hd * 2, -MIX.hw, 0], [0.45, MIX.hd * 2, MIX.hw, 0]]) put(box(w, 0.12, dd), 0x3a3a44, { x: MIX.x + x, y: 0, z: MIX.z + z }, mMetal, false);
      // knobs with LED rings (gain, hi, mid, low per channel) and the master/phones knobs
      const knobGeo = K.lathe([[0.001, 0], [1.3, 0], [1.3, 0.25], [1.15, 0.35], [1.1, 1.3], [0.95, 1.5], [0.001, 1.55]], 24);
      const kn = [], rings = [];
      CH.forEach((x, i) => {
        for (let k = 0; k < 4; k++) {
          const z = -21.5 + k * 4;
          kn.push({ x: MIX.x + x, y: 0, z: MIX.z + z, ry: r() * 6 });
          rings.push({ x: MIX.x + x, y: 0.04, z: MIX.z + z, s: 1, color: CH_COL[i] });
          K.circle(MIX.x + x, MIX.z + z, 1.3, 1.8);
        }
      });
      for (const [x, z] of [[-15.5, 18.4], [15.5, 18.4], [-15.5, 14.6], [15.5, 14.6]]) { kn.push({ x: MIX.x + x, y: 0, z: MIX.z + z, ry: r() * 6, s: 0.85 }); rings.push({ x: MIX.x + x, y: 0.04, z: MIX.z + z, s: 0.85, color: 0xffffff }); }
      K.instances(knobGeo, K.std({ color: 0x202024, roughness: 0.5, metalness: 0.2 }), kn, { cast: true });
      const capG = cyl(0.95, 0.95, 0.06, 20); capG.translate(0, 1.56, 0);
      K.instances(capG, K.std({ color: 0xd8d8de, roughness: 0.3, metalness: 0.8 }), kn, { cast: false });
      const ptrG = box(0.18, 0.08, 0.9); ptrG.translate(0, 1.6, 0.45);
      K.instances(ptrG, K.std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }), kn, { cast: false });
      const ringG = new T.RingGeometry(1.45, 1.85, 28, 1, -PI * 0.75, PI * 1.5); ringG.rotateX(-PI / 2);
      K.instances(ringG, glowInst(1.4), rings, { colors: true, cast: false, receive: false });
      // VU meters: an LED ladder beside each channel's knobs
      const vu = [];
      CH.forEach((x, i) => { for (let k = 0; k < 11; k++) vu.push({ x: MIX.x + x + 3.0, y: 0.05, z: MIX.z - 9.0 - k * 1.25, ch: i, k, color: 0x000000 }); });
      const vuIM = K.instances(box(1.0, 0.16, 0.7), glowInst(1.6), vu, { colors: true, cast: false, receive: false });
      A.vu = { im: vuIM, list: vu };
      // cue buttons
      CH.forEach((x) => { put(rbox(2.4, 0.5, 1.5, 0.2), 0xff8a20, { x: MIX.x + x, y: 0.12, z: MIX.z + 16.2 }, mGlow, false); });
      // channel faders (box movers): black caps with a white line and a coloured LED stripe (instanced, moved in animate)
      {
        const capG = rbox(FAD.hw * 2, FAD.h, FAD.hd * 2, 0.35); capG.translate(0, FAD.h / 2, 0);
        const lineG = box(FAD.hw * 2 - 0.3, 0.06, 0.22); lineG.translate(0, FAD.h + 0.02, 0);
        const stripeG = box(FAD.hw * 2 + 0.06, 0.3, FAD.hd * 2 + 0.06); stripeG.translate(0, 0.55, 0);
        const haloG = flatGeo(7, 5); haloG.translate(0, 0.06, 0);
        const list = CH.map((x, i) => ({ x: MIX.x + x, y: 0, z: MIX.z + faderZ(0, i), color: CH_COL[i] }));
        A.fadStripe = glowInst(2.2);
        const ims = [
          K.instances(capG, K.std({ color: 0x18181c, roughness: 0.45, envMap: ENV, envMapIntensity: 0.5 }), list, { cast: true }),
          K.instances(lineG, K.std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }), list, { cast: false }),
          K.instances(stripeG, A.fadStripe, list, { colors: true, cast: false }),
          K.instances(haloG, addMat(0xffffff, 0.45), list, { colors: true, cast: false, receive: false }),
        ];
        ims[3].renderOrder = 4;
        for (const im of ims) { im.boundingSphere = new T.Sphere(new T.Vector3(MIX.x, 1, MIX.z + MIX.zc), 26); keep.push(im); }
        A.fadIM = ims;
        for (let i = 0; i < 4; i++) K.mover({ type: 'box', hw: FAD.hw, hd: FAD.hd, h: FAD.h, bounce: 0.1 }, (t) => ({ x: MIX.x + CH[i], z: MIX.z + faderZ(t, i), angle: 0 }));
      }
      {
        const grp = new T.Group();
        const cap = new T.Mesh(rbox(XF.hw * 2, XF.h, XF.hd * 2, 0.35), K.std({ color: 0x18181c, roughness: 0.45, envMap: ENV, envMapIntensity: 0.5 })); cap.position.y = XF.h / 2; grp.add(cap);
        const stripeMat = K.std({ color: 0x111111, emissive: 0xff3040, emissiveIntensity: 2.4, toneMapped: false });
        const stripe = new T.Mesh(box(XF.hw * 2 + 0.06, 0.3, XF.hd * 2 + 0.06), stripeMat); stripe.position.y = 0.55; grp.add(stripe);
        const line = new T.Mesh(box(0.22, 0.06, XF.hd * 2 - 0.3), K.std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 })); line.position.y = XF.h + 0.02; grp.add(line);
        const halo = new T.Mesh(flatGeo(5, 7), addMat(0xff3040, 0.5)); halo.position.y = 0.06; halo.renderOrder = 4; grp.add(halo);
        grp.position.set(MIX.x + xfaderX(0), 0, MIX.z + XF.z);
        K.add(grp); keep.push(grp);
        K.mover({ type: 'box', hw: XF.hw, hd: XF.hd, h: XF.h, bounce: 0.1 }, (t) => ({ x: MIX.x + xfaderX(t), z: MIX.z + XF.z, angle: 0 }));
        A.xfader = { g: grp, stripeMat };
      }
      AO(MIX.x, MIX.z, MIX.hw + 2, MIX.hd + 2, 0.4, 0, 0.02);
      // a gooseneck booth lamp clamped to the back of the mixer, lighting the faders
      {
        const lx = 22, lz = -31;
        put(rbox(5, 2.4, 4, 0.5), 0x1a1a1e, { x: lx, y: 1.2, z: lz }, mPlastic);
        const pts = [new T.Vector3(lx, 2.2, lz), new T.Vector3(lx - 1, 14, lz + 1), new T.Vector3(lx - 6, 22, lz + 6), new T.Vector3(lx - 13, 22.5, lz + 13), new T.Vector3(lx - 17, 19.5, lz + 17)];
        put(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.42, 8, false), 0x2a2a30, {}, mMetal);
        put(cyl(1.0, 1.6, 3.2, 16), 0x1a1a1e, { x: lx - 18, y: 18.6, z: lz + 18, rx: 0.7, ry: -0.8 }, mPlastic);
        put(cyl(1.4, 1.4, 0.2, 16), 0xfff6e0, { x: lx - 18.6, y: 17.6, z: lz + 18.8, rx: 0.7, ry: -0.8 }, mGlow, false);
        const sp = new T.SpotLight(0xffe8cc, 900, 0, 0.62, 0.7, 2);
        sp.position.set(lx - 18.6, 17.2, lz + 18.8); sp.target.position.set(MIX.x - 2, 0, MIX.z + 4); sp.castShadow = false;
        K.group.add(sp, sp.target);
        AO(lx, lz, 4, 3.4, 0.5);
      }
    }

    // ============================================================ the monitor speakers (pumping woofers)
    {
      const cabC = canvas(256, 256, (g) => { const img = TX.paint(256, 256, (x, y, u, v, o) => { const n = nAt(x * 2, y * 2), k = 18 + n * 14; o[0] = k; o[1] = k; o[2] = k + 2; }); g.drawImage(img, 0, 0); });
      const cabMat = K.std({ map: tex(cabC, [3, 4]), roughness: 0.8, envMap: ENV, envMapIntensity: 0.25 });
      const baffleMat = K.std({ color: 0x141418, roughness: 0.55, envMap: ENV, envMapIntensity: 0.4 });
      const coneC = canvas(256, 256, (g, w, h) => {
        const q = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); q.addColorStop(0, '#2a2a30'); q.addColorStop(1, '#141418'); g.fillStyle = q; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(w / 2, h / 2, 20 + i * 2.6, 0, TAU); g.stroke(); }
      });
      const coneMat = K.std({ map: tex(coneC, [1, 1], false), roughness: 0.85, side: T.DoubleSide });
      const badge = tex(canvas(256, 64, (g, w, h) => { g.fillStyle = '#0e0e12'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8d8e0'; g.font = 'bold 30px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('SUBWAVE 12', w / 2, 42); }), [1, 1], false);
      const ringTex = tex(canvas(128, 128, (g, w, h) => {
        const q = g.createRadialGradient(w / 2, h / 2, w * 0.36, w / 2, h / 2, w / 2); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.7, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h);
      }), [1, 1], false);
      for (const s of SPK) {
        const fz = SPKD.front;
        K.mesh(rbox(SPKD.hw * 2, SPKD.h, SPKD.hd * 2, 1.2), cabMat, s.x, SPKD.h / 2 + 0.6, s.z);
        K.mesh(box(SPKD.hw * 2 - 2, SPKD.h - 2, 0.6), baffleMat, s.x, SPKD.h / 2 + 0.6, fz + 0.1);
        K.box(s.x, s.z, SPKD.hw, SPKD.hd, 0, SPKD.h);
        for (const dx of [-13, 13]) for (const dz of [-12, 12]) put(cyl(1.6, 1.8, 0.6, 12), 0x111114, { x: s.x + dx, y: 0.3, z: s.z + dz }, mRubber);
        AO(s.x, s.z, SPKD.hw + 4, SPKD.hd + 4, 0.75);
        // woofer: bezel ring, surround and a cone group that pumps forward on each kick
        put(new T.TorusGeometry(SPKD.R + 1.3, 0.7, 10, 48), 0x3a3a42, { x: s.x, y: SPKD.cy, z: fz + 0.5 }, mMetal);
        const surround = new T.Mesh(new T.TorusGeometry(SPKD.R, 0.95, 10, 48), K.std({ color: 0x18181c, roughness: 0.6 }));
        surround.position.set(s.x, SPKD.cy, fz + 0.3); K.add(surround); keep.push(surround);
        const cone = new T.Group(); cone.position.set(s.x, SPKD.cy, fz + 0.2);
        const cg = K.lathe([[SPKD.R - 0.6, 0], [10, -1.2], [6, -2.6], [4.2, -3.2]], 48); cg.rotateX(-PI / 2);
        cone.add(new T.Mesh(cg, coneMat));
        const cap = new T.Mesh(sph(4.4, 24, 12, 0, TAU, 0, PI / 2), K.std({ color: 0x24242a, roughness: 0.4, envMap: ENV, envMapIntensity: 0.6 })); cap.rotation.x = PI / 2; cap.scale.set(1, 0.4, 1); cap.position.z = -3.2; cone.add(cap);
        K.add(cone); keep.push(cone);
        A.cones.push({ cone, surround, z: fz + 0.2 });
        // horn tweeter, bass ports, power LED, badge
        put(rbox(18, 8, 1.4, 0.8), 0x0e0e12, { x: s.x, y: 40, z: fz - 0.3 }, mPlastic);
        put(rbox(14, 5.2, 0.6, 1.4), 0x050506, { x: s.x, y: 40, z: fz + 0.35 }, mMatte, false);
        put(cyl(1.2, 1.2, 0.5, 16), 0x3a3a42, { x: s.x, y: 40, z: fz + 0.55, rx: PI / 2 }, mMetal, false);
        for (const dx of [-11, 11]) put(rbox(7, 2.4, 0.6, 1.0), 0x030304, { x: s.x + dx, y: 3.4, z: fz + 0.15 }, mMatte, false);
        put(sph(0.4, 8, 6), 0x2a80ff, { x: s.x + 13, y: 48, z: fz + 0.4 }, mGlow, false);
        const bm = new T.Mesh(new T.PlaneGeometry(10, 2.5), K.std({ map: badge, roughness: 0.4, metalness: 0.4 })); bm.position.set(s.x, 47.6, fz + 0.45); K.add(bm, { cast: false });
        // the shock ring of each kick spreading over the booth
        const ring = new T.Mesh(flatGeo(2, 2), addMat(s.x < 0 ? 0xff2aa8 : 0x28d8ff, 0, ringTex));
        ring.position.set(s.x, 0.1, fz + 1); ring.renderOrder = 4; K.group.add(ring);
        A.rings.push(ring);
      }
    }

    // ============================================================ the laptop on its stand behind the mixer (DJ software on screen)
    {
      const lx = 0, lz = -47;
      for (const dx of [-11, 11]) put(box(1.0, 12, 20), 0xb8bcc4, { x: lx + dx, y: 6, z: lz }, mMetal);
      put(box(26, 0.8, 22), 0xa8acb4, { x: lx, y: 12.2, z: lz + 1, rx: 0.22 }, mMetal);
      AO(lx, lz, 15, 13, 0.6);
      K.box(lx, lz, 13, 11, 0, 30);
      // laptop base with keyboard
      const kc = canvas(256, 180, (g, w, h) => {
        g.fillStyle = '#5a5e68'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#111114';
        for (let row = 0; row < 5; row++) for (let k = 0; k < 13; k++) g.fillRect(14 + k * 17.6, 14 + row * 17, 15, 14);
        g.fillRect(56, 100, 144, 14);
        g.fillStyle = '#4a4e58'; g.fillRect(84, 124, 88, 50);
      });
      const kbMat = K.std({ map: tex(kc, [1, 1], false), roughness: 0.35, metalness: 0.7, envMap: ENV, envMapIntensity: 0.9 });
      const alu = K.std({ color: 0xb8bcc4, roughness: 0.3, metalness: 1, envMap: ENV, envMapIntensity: 1.1 });
      K.mesh(box(32, 1.2, 22), [alu, alu, kbMat, alu, alu, alu], lx, 13.3, lz + 1.4, { rx: 0.22 });
      // screen: the lid tilted back, the display glowing
      const sc = canvas(512, 320, (g, w, h) => {
        g.fillStyle = '#0a0b10'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#14161e'; g.fillRect(0, 0, w, 22); g.fillStyle = '#9aa3c0'; g.font = 'bold 13px Rubik, sans-serif'; g.fillText('DECKMIX PRO', 8, 15);
        const deckInfo = (y, name, bpm, col) => {
          g.fillStyle = '#141824'; g.fillRect(6, y, w - 12, 34);
          g.fillStyle = col; g.font = 'bold 16px Rubik, sans-serif'; g.fillText(name, 14, y + 22);
          g.fillStyle = '#e8ecff'; g.font = 'bold 18px Rubik, sans-serif'; g.fillText(bpm, w - 110, y + 23);
        };
        deckInfo(26, 'A  Midnight Spin (Club Mix)', '124.00', '#ffb347');
        deckInfo(130, 'B  Bassline Fever', '124.00', '#ff5ab0');
        g.fillStyle = '#10121a'; g.fillRect(6, 234, w - 12, 80);
        const songs = ['Neon Nights', 'After Hours Edit', 'Spin Cycle', 'Low Frequency', 'Velvet Drop'];
        g.font = '12px Rubik, sans-serif';
        songs.forEach((t, i) => { g.fillStyle = i === 1 ? '#3cf' : '#8d94ad'; g.fillText(`${i + 1}  ${t}`, 14, 252 + i * 14); g.fillText(['124', '125', '123', '126', '124'][i], w - 60, 252 + i * 14); });
      });
      const scrMat = new T.MeshBasicMaterial({ map: tex(sc, [1, 1], false), toneMapped: false, color: 0xbfc4d8 });
      const lid = new T.Group(); lid.position.set(lx, 16.1, lz - 9.3); lid.rotation.x = -0.26;
      const shell = new T.Mesh(box(32, 21, 0.7), alu); shell.position.y = 10.5; lid.add(shell);
      const scr = new T.Mesh(new T.PlaneGeometry(30, 19), scrMat); scr.position.set(0, 10.6, 0.37); lid.add(scr);
      // waveforms (scroll with the music)
      const wc = canvas(1024, 64, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const pr = K.rng(31);
        for (let x = 0; x < w; x += 2) {
          const beat = (x % 64) < 6 ? 1 : 0.35 + 0.35 * Math.abs(Math.sin(x * 0.05)) + pr() * 0.2;
          const a = beat * h * 0.46;
          const q = g.createLinearGradient(0, h / 2 - a, 0, h / 2 + a); q.addColorStop(0, '#3cf'); q.addColorStop(0.5, '#fff'); q.addColorStop(1, '#f3a');
          g.fillStyle = q; g.fillRect(x, h / 2 - a, 2, a * 2);
        }
      });
      const wt1 = tex(wc, [0.5, 1], true), wt2 = tex(wc, [0.5, 1], true); wt2.offset.x = 0.37;
      for (const [y, t] of [[14.8, wt1], [8.2, wt2]]) {
        const m = new T.Mesh(new T.PlaneGeometry(28, 3.6), new T.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, color: 0xd8e0ff }));
        m.position.set(0, y, 0.39); lid.add(m);
      }
      const ph = new T.Mesh(new T.PlaneGeometry(0.3, 10.5), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); ph.position.set(0, 11.5, 0.4); lid.add(ph);
      K.add(lid); keep.push(lid);
      A.wave = [wt1, wt2];
      const glow = new T.PointLight(0x9ab4ff, 140, 60, 1.6); glow.position.set(lx, 10, lz + 20); K.group.add(glow);
    }

    // ============================================================ record crates in the back corners
    {
      const crateC = canvas(256, 256, (g, w, h) => {
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#000';
        for (let y = 1; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.roundRect(12 + x * 60, 14 + y * 60, 44, 40, 8); g.fill(); }
      });
      const am = tex(crateC, [1, 1], false);
      const sleeveCols = [0xff3aa8, 0x38d8ff, 0xffc030, 0x9b6bff, 0xf0f0f0, 0x1a1a1a, 0xff6a2a, 0x30e090, 0xe82040, 0x2a6aff];
      for (const [cx, cz, col, ang] of [[-167, -119, 0xff6a1a, 0.06], [167, -119, 0x2a7aff, -0.05]]) {
        const cm = K.std({ color: col, roughness: 0.55, alphaMap: am, alphaTest: 0.5, side: T.DoubleSide });
        const cg = new T.Group(); cg.position.set(cx, 0, cz); cg.rotation.y = ang;
        const S = 33, H = 28;
        for (const [px, pz, ry] of [[0, -S / 2, 0], [0, S / 2, 0], [-S / 2, 0, PI / 2], [S / 2, 0, PI / 2]]) {
          const m = new T.Mesh(new T.PlaneGeometry(S, H), cm); m.position.set(px, H / 2, pz); m.rotation.y = ry; cg.add(m);
        }
        const bot = new T.Mesh(box(S, 0.8, S), K.std({ color: col, roughness: 0.6 })); bot.position.y = 0.4; cg.add(bot);
        K.add(cg);
        K.box(cx, cz, S / 2 + 0.5, S / 2 + 0.5, ang, H);
        AO(cx, cz, S / 2 + 4, S / 2 + 4, 0.6, ang);
        // records standing inside, leaning a little
        const recs = [];
        for (let i = 0; i < 24; i++) {
          const zz = -S / 2 + 2 + i * 1.22, tilt = (r() - 0.5) * 0.14 + 0.08;
          recs.push({ x: cx - Math.sin(-ang) * zz, y: 15.6 + r() * 1.2, z: cz + Math.cos(-ang) * zz, ry: -ang, rx: tilt, sx: 31.2, sy: 31.2, sz: 0.5, color: r.pick(sleeveCols) });
        }
        K.instances(box(1, 1, 1), K.std({ roughness: 0.6 }), recs, { colors: true, cast: true });
      }
    }

    // ============================================================ record sleeves with made-up cover art (flat)
    const coverTex = (i) => tex(canvas(256, 256, (g, w, h) => {
      const pal = [['#ff3aa8', '#1a0830', '#ffd0f0'], ['#38d8ff', '#04121e', '#e0fbff'], ['#ffc030', '#2a1400', '#fff0c8'], ['#9b6bff', '#0e0624', '#efe4ff'], ['#30e090', '#03140c', '#d8ffee'], ['#ff6a2a', '#200800', '#ffe2d4']][i % 6];
      const pr = K.rng(100 + i);
      g.fillStyle = pal[1]; g.fillRect(0, 0, w, h);
      const style = i % 4;
      if (style === 0) { for (let k = 0; k < 9; k++) { g.strokeStyle = pal[0]; g.globalAlpha = 1 - k * 0.1; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h * 0.45, 20 + k * 14, 0, TAU); g.stroke(); } }
      else if (style === 1) { for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? pal[0] : pal[2]; g.globalAlpha = 0.85; g.fillRect(0, k * 18 + pr() * 6, w, 8); } }
      else if (style === 2) { for (let k = 0; k < 7; k++) { g.fillStyle = pal[k % 2 ? 0 : 2]; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(pr() * w, pr() * h); g.lineTo(pr() * w, pr() * h); g.lineTo(pr() * w, pr() * h); g.fill(); } }
      else { const q = g.createLinearGradient(0, 0, w, h); q.addColorStop(0, pal[0]); q.addColorStop(1, pal[1]); g.fillStyle = q; g.fillRect(0, 0, w, h); g.fillStyle = pal[2]; g.beginPath(); g.arc(w * 0.7, h * 0.3, 36, 0, TAU); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = pal[2]; g.textAlign = 'left';
      g.font = 'bold 30px "Lilita One", Rubik, sans-serif'; g.fillText(['NEON NIGHTS', 'SPIN CYCLE', 'AFTER HOURS', 'LOW FREQ', 'MIDNIGHT EDIT', 'BASSLINE'][i % 6], 14, h - 40);
      g.font = 'bold 14px Rubik, sans-serif'; g.fillText(['THE WAXWORKS', 'DJ SOLENOID', 'GROOVE UNIT', 'KICK & SNARE', 'NOCTURNE', 'SUBSONIC'][i % 6], 16, h - 18);
    }), [1, 1], false);
    const sleeveSide = K.std({ color: 0x14141a, roughness: 0.8 });
    const sleeve = (x, z, ang, i, y = 0.02) => {
      K.mesh(box(31.5, 0.3, 31.5), [sleeveSide, sleeveSide, K.std({ map: coverTex(i), roughness: 0.6, envMap: ENV, envMapIntensity: 0.3 }), sleeveSide, sleeveSide, sleeveSide], x, y + 0.15, z, { ry: -ang, cast: true });
      AO(x, z, 17.5, 17.5, 0.35, ang, 0.012);
    };

    // ============================================================ the headphones, dropped in the SW U-turn
    {
      const { x, z } = PHONES, ax = 0.4;
      const c = Math.cos(ax), s = Math.sin(ax);
      const cupGeo = K.lathe([[0.001, 0], [4.4, 0], [4.7, 0.6], [4.7, 2.2], [4.2, 3.2], [2.5, 3.6], [0.001, 3.7]], 32);
      const padGeo = new T.TorusGeometry(3.6, 1.15, 12, 32); padGeo.rotateX(PI / 2);
      for (const sd of [-1, 1]) {
        const ex = x + c * sd * 6.8, ez = z + s * sd * 6.8;
        put(cupGeo, 0x1a1a20, { x: ex, y: 1.6, z: ez }, mPlastic);
        put(padGeo, 0x2a2a30, { x: ex, y: 1.1, z: ez }, mRubber);
        put(cyl(2.6, 2.6, 0.1, 24), 0xc0c4cc, { x: ex, y: 5.35, z: ez }, mMetal);
        put(new T.TorusGeometry(2.7, 0.18, 8, 32), 0xff3aa8, { x: ex, y: 5.38, z: ez, rx: PI / 2 }, mGlow, false);
        K.circle(ex, ez, 4.9, 5);
        AO(ex, ez, 5.6, 5.6, 0.6);
      }
      // headband arching over between the cups
      put(new T.TorusGeometry(6.8, 0.75, 10, 32, PI), 0x1c1c22, { x, y: 4.4, z, ry: -ax }, mRubber);
      put(new T.TorusGeometry(6.8, 0.82, 10, 20, PI * 0.5), 0xb8bcc4, { x, y: 4.42, z, ry: -ax, rz: PI * 0.25 }, mMetal);
      AO(x, z, 10, 4, 0.35, ax);
      warnRoad('headphones', x + c * 6.8, z + s * 6.8, 6);
      warnRoad('headphones', x - c * 6.8, z - s * 6.8, 6);
    }
    // an energy drink can standing in the SE U-turn, on a coaster
    {
      const { x, z } = CAN;
      const canC = canvas(256, 128, (g, w, h) => {
        const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#20242c'); q.addColorStop(0.5, '#3a4050'); q.addColorStop(1, '#14161c'); g.fillStyle = q; g.fillRect(0, 0, w, h);
        g.fillStyle = '#30ff90'; g.beginPath(); g.moveTo(20, 100); g.lineTo(70, 20); g.lineTo(64, 60); g.lineTo(110, 30); g.lineTo(60, 112); g.lineTo(66, 72); g.closePath(); g.fill();
        g.fillStyle = '#e8fff0'; g.font = 'bold 34px "Lilita One", Rubik, sans-serif'; g.fillText('VOLT', 128, 60); g.font = 'bold 16px Rubik, sans-serif'; g.fillText('NIGHT ENERGY', 124, 86);
      });
      const canMat = K.std({ map: tex(canC, [1, 1], false), roughness: 0.25, metalness: 0.8, envMap: ENV, envMapIntensity: 1.3 });
      const can = new T.Mesh(cyl(3.3, 3.3, 11.6, 28, true), canMat);
      can.position.set(x, 6.25, z); can.rotation.y = 2.4; K.add(can);
      put(cyl(3.3, 3.0, 0.45, 28), 0xc8ccd4, { x, y: 0.22, z }, mMetal);
      put(cyl(3.0, 3.3, 0.45, 28), 0xc8ccd4, { x, y: 12.27, z }, mMetal);
      put(cyl(2.6, 2.6, 0.2, 28), 0xb8bcc4, { x, y: 12.5, z }, mMetal);
      put(box(1.2, 0.15, 2.0), 0xd8dce4, { x: x + 0.8, y: 12.65, z: z - 0.4, ry: 0.5 }, mMetal);
      K.circle(x, z, 3.3, 12.6);
      const coast = tex(canvas(128, 128, (g, w, h) => { g.fillStyle = '#e8dcc8'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.strokeStyle = '#a02040'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 50, 0, TAU); g.stroke(); g.fillStyle = '#a02040'; g.font = 'bold 22px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('CLUB', 64, 72); }), [1, 1], false);
      const cm = new T.Mesh(cyl(5, 5, 0.25, 32), K.std({ map: coast, roughness: 0.9 })); cm.position.set(x, 0.13, z); cm.rotation.y = 0.4; K.add(cm);
      can.position.y += 0.25;
      // a tin of USB sticks and an earplug case on the insides of the bends into and out of the mixer
      put(cyl(2.6, 2.6, 1.8, 24), 0xc0c4cc, { x: 32, y: 0.9, z: 19.5 }, mMetal);
      put(cyl(2.4, 2.4, 0.2, 24), 0xff3aa8, { x: 32, y: 1.85, z: 19.5 }, mPlastic);
      K.circle(32, 19.5, 2.6, 2);
      AO(32, 19.5, 3.4, 3.4, 0.5);
      put(new T.CapsuleGeometry(1.5, 3.4, 4, 12), 0xffa020, { x: -32, y: 1.5, z: 19.5, rz: PI / 2, ry: 0.3 }, mPlastic);
      K.capsule(-32 - Math.cos(0.3) * 1.7, 19.5 + Math.sin(0.3) * 1.7, -32 + Math.cos(0.3) * 1.7, 19.5 - Math.sin(0.3) * 1.7, 1.5, 3);
      AO(-32, 19.5, 3.6, 2, 0.5, -0.3);
      warnRoad('usb tin', 32, 19.5, 4.4); warnRoad('earplugs', -32, 19.5, 4.4);
      AO(x, z, 5.5, 5.5, 0.6);
      warnRoad('can', x, z, 5.3);
    }

    // ============================================================ the knocked-over cocktail in front of the mixer: the spill
    // runs onto the mixer's front strip (slick), right up to the edge of the road, so going round the faders there spins you
    {
      const { x, z } = CUP;
      const glassMat = K.glass(0xe8f4ff, 0.3);
      const cup = new T.Mesh(cyl(4.3, 3.1, 11.5, 28, true), glassMat);
      cup.rotation.x = -PI / 2; cup.rotation.y = -0.25; cup.position.set(x, 4.0, z); K.add(cup, { cast: true });
      put(cyl(3.1, 3.1, 0.3, 28), 0xdde8f0, { x: x + Math.sin(-0.25) * 5.8, y: 3.4, z: z + Math.cos(-0.25) * 5.8, rx: PI / 2, ry: -0.25 }, mPlastic);
      K.capsule(x - Math.sin(-0.25) * 5.2, z - Math.cos(-0.25) * 5.2, x + Math.sin(-0.25) * 5.2, z + Math.cos(-0.25) * 5.2, 4.3, 8);
      AO(x, z, 5.5, 7.5, 0.5, PI / 2 - 0.25);
      const liq = K.liquid(0x18c8ff, { emissive: 0x0a7aff, emissiveIntensity: 0.45, transparent: true, opacity: 0.82, envMap: ENV, envMapIntensity: 1.2 });
      const sp = K.spill(MIX.x + 7, MIX.z + MIX.zc + 14.2, 5.4, liq, { stretch: 2.1, angle: 0.06, lump: 0.25, y: 0.1, thick: 0.12 });
      K.surface('slick', { poly: sp.poly });
      const sp2 = K.spill(x + 1.5, z - 9, 3.4, liq, { stretch: 1.3, angle: PI / 2, lump: 0.3, y: 0.09, thick: 0.1 });
      K.surface('slick', { poly: sp2.poly });
      // the straw and a lime wheel, ice cubes skidded across the booth
      const st = new T.Mesh(cyl(0.32, 0.32, 17, 10), K.plastic(0xff3aa8, 0.3)); st.rotation.set(PI / 2, 0, -0.6); st.position.set(x - 9, 0.9, z + 3); K.add(st);
      const lime = new T.Mesh(cyl(2.4, 2.4, 0.5, 24), K.std({ map: tex(canvas(128, 128, (g) => {
        g.fillStyle = '#3a9a2a'; g.beginPath(); g.arc(64, 64, 64, 0, TAU); g.fill(); g.fillStyle = '#e8f4b0'; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.fill();
        g.fillStyle = '#b8e070'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 52, i * TAU / 9 + 0.06, (i + 1) * TAU / 9 - 0.06); g.fill(); }
      }), [1, 1], false), roughness: 0.4 }));
      lime.position.set(x + 9, 0.4, z + 6); lime.rotation.z = 0.12; K.add(lime);
      const ice = K.phys({ color: 0xe8f8ff, roughness: 0.08, transmission: 0.6, thickness: 1.2, transparent: true, opacity: 0.75, clearcoat: 1, envMap: ENV, envMapIntensity: 1.6 });
      const cubes = [[x + 8, z - 4, 0.4], [x - 7, z - 6, 1.1], [x + 13, z + 1, 0.2], [x - 4, z + 11, 0.8]].map(([ix, iz, ia]) => rbox(2.4, 2.2, 2.4, 0.5).applyMatrix4(mtx({ x: ix, y: 1.1, z: iz, rx: 0.1, ry: ia, rz: 0.08 })));
      K.add(new T.Mesh(BU.mergeGeometries(cubes, false), ice));
      warnRoad('cup', x, z, 8);
    }

    // ============================================================ cable spaghetti (some cross the road as low bumps)
    const cable = (pts, rad, col, rough = true) => {
      const curve = new T.CatmullRomCurve3(pts.map(([x, z, y]) => new T.Vector3(x, y ?? rad, z)), false, 'catmullrom', 0.4);
      const n = Math.ceil(curve.getLength() / 2);
      put(new T.TubeGeometry(curve, n, rad, 8, false), col, {}, mRubber);
      // where it crosses the road: a strip of rough surface under it
      if (rough) {
        const P = curve.getSpacedPoints(n * 2);
        let run = null;
        const flush = () => {
          if (run && run.length > 1) {
            const a = run[0], b = run[run.length - 1];
            const ang = Math.atan2(b.z - a.z, b.x - a.x), len = Math.hypot(b.x - a.x, b.z - a.z);
            const c = Math.cos(ang), s = Math.sin(ang), hw = len / 2 + 0.6, hd = rad + 0.9, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            K.surface('rough', { poly: [[mx - c * hw + s * hd, mz - s * hw - c * hd], [mx + c * hw + s * hd, mz + s * hw - c * hd], [mx + c * hw - s * hd, mz + s * hw + c * hd], [mx - c * hw - s * hd, mz - s * hw + c * hd]] });
          }
          run = null;
        };
        for (const q of P) { if (dRoad(q.x, q.z) < 1) (run || (run = [])).push(q); else flush(); }
        flush();
      }
    };
    // speaker cables from the mixer's back panel, across the back straight
    cable([[-8, -25.4], [-14, -40], [-30, -58], [-46, -78], [-52, -96], [-58, -102.6, 3]], 0.55, 0x101014);
    cable([[8, -25.4], [16, -42], [34, -60], [48, -80], [56, -96], [60, -102.6, 3]], 0.55, 0x101014);
    // laptop USB to the mixer
    cable([[4, -25.4], [8, -30], [14, -35], [16, -41, 1], [14.2, -44, 11.5]], 0.3, 0xdedee4, false);
    // phono pairs (red/white) from the decks' back panels to the mixer
    for (const sd of [-1, 1]) for (const k of [0, 1]) {
      const x0 = sd < 0 ? -102 + k * 0.8 : 96 + k * 0.8, z0 = -17.9, x1 = sd * (14 + k * 0.8), z1 = -25.4;
      cable([[x0, z0], [x0 + sd * -8, -24], [sd * 60, -30 - k], [sd * 34, -32 - k], [x1, z1]], 0.28, k ? 0xe8e8ee : 0xd02030, false);
    }
    // deck power cables out over the back edge
    cable([[-130, -17.9], [-136, -40], [-128, -70], [-122, -98], [-126, -125], [-128, -137.5]], 0.38, 0x0c0c0e);
    cable([[134, -17.9], [140, -36], [132, -72], [126, -100], [130, -126], [131, -137.5]], 0.38, 0x0c0c0e);
    // headphone cable coiling from the headphones to the mixer's phones jack, over the east return road
    cable([[PHONES.x + 4, PHONES.z + 6], [PHONES.x + 2, PHONES.z + 12], [PHONES.x - 6, PHONES.z + 14], [PHONES.x - 9, PHONES.z + 8]], 0.32, 0x15151a, false);
    for (let i = 0; i < 8; i++) { const a = i * 0.9; put(new T.TorusGeometry(1.2, 0.3, 6, 16), 0x15151a, { x: PHONES.x - 12 + Math.cos(a) * 0.6 + i * 0.8, y: 0.4, z: PHONES.z + 6 + Math.sin(a) * 0.4, rx: PI / 2 + 0.3, ry: -0.3 }, mRubber); }
    for (const [x, z] of [[-8, -25.6], [8, -25.6], [4, -25.6]]) put(cyl(0.7, 0.7, 2.4, 10), 0x1a1a1e, { x, y: 0.7, z, rx: PI / 2 }, mMetal);

    // ============================================================ the rest of the booth: sleeves, phone, setlist, tape, glowsticks
    sleeve(-58, -60, 0.32, 0); sleeve(62, -58, -0.42, 1); sleeve(-2, 66, 0.18, 2); sleeve(-170, 40, 0.1, 3); sleeve(-160, 62, -0.3, 4, 0.32); sleeve(165, 30, -0.2, 5);
    // a record out of its sleeve, lying by the west stack
    {
      const rg = cyl(R_REC, R_REC, 0.14, 64);
      { const uv = rg.attributes.uv, pos = rg.attributes.position; for (let i = 0; i < uv.count; i++) if (Math.abs(pos.getY(i) - 0.07) < 1e-4) uv.setXY(i, pos.getX(i) / (2 * R_REC) + 0.5, -pos.getZ(i) / (2 * R_REC) + 0.5); }
      const m = new T.Mesh(rg, [recEdge, recMat, recEdge]); m.position.set(-150, 0.5, 72); m.rotation.y = 0.7;
      K.add(m);
      const lab = new T.Mesh(new T.CircleGeometry(R_LAB, 40), K.std({ map: labelTex({ name: 'MOONLIT', sub: 'DISCS', bg: '#30e090', bg2: '#a0ffd0', ink: '#03140c', side: 'SIDE A · 33⅓', track: 'DEEP CUTS VOL. 2' }), roughness: 0.55 }));
      lab.rotation.x = -PI / 2; lab.position.set(-150, 0.58, 72); K.add(lab, { cast: false });
      AO(-150, 72, 16, 16, 0.4);
    }
    // phone with a lit screen (in the DJ's pocket of booth, south of the mixer)
    {
      const x = -14, z = 40, ang = -0.3;
      put(rbox(7.4, 0.8, 15, 1.0), 0x18181c, { x, y: 0.4, z, ry: -ang }, mPlastic);
      const scr = tex(canvas(128, 256, (g, w, h) => {
        const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#2a1060'); q.addColorStop(1, '#ff2aa8'); g.fillStyle = q; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fff'; g.font = 'bold 36px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('01:24', w / 2, 70);
        g.font = '14px Rubik, sans-serif'; g.fillText('set time left 0:46', w / 2, 96);
      }), [1, 1], false);
      const m = new T.Mesh(new T.PlaneGeometry(6.6, 14), new T.MeshBasicMaterial({ map: scr, toneMapped: false, color: 0xaaaaaa })); m.rotation.set(-PI / 2, 0, -ang); m.position.set(x, 0.82, z); K.add(m, { cast: false });
      AO(x, z, 5, 9, 0.5, ang);
    }
    // handwritten setlist taped to the booth by the mixer
    {
      const sc = canvas(256, 360, (g, w, h) => {
        g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(80,120,200,0.35)'; for (let y = 40; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.fillStyle = '#1a1a3a'; g.font = 'italic 22px Georgia, serif';
        ['SET 01:00', '1. Neon Nights', '2. After Hours', '3. Spin Cycle *', '4. Low Freq', '5. Velvet Drop', '6. Bassline!!', '7. Midnight Edit'].forEach((t, i) => g.fillText(t, 14, 34 + i * 24));
      });
      const m = new T.Mesh(new T.PlaneGeometry(14, 19.6), K.std({ map: tex(sc, [1, 1], false), roughness: 0.9 })); m.rotation.set(-PI / 2, 0, 0.2); m.position.set(26, 0.05, 50); K.add(m, { cast: false });
      put(box(5, 0.05, 2.2), 0x2a2a30, { x: 25, y: 0.07, z: 40.6, ry: -0.2 }, mMatte, false);
      AO(26, 50, 8, 11, 0.2, -0.2, 0.03);
    }
    // a roll of gaffer tape in the NE U-turn, a marker; a 45 adapter by the NW U-turn
    {
      const x = 141, z = -69;
      put(new T.TorusGeometry(4.2, 1.6, 12, 32), 0x1a1a1e, { x, y: 2.5, z, rx: PI / 2 }, mMatte);
      put(cyl(2.7, 2.7, 4.9, 24, true), 0xb89a70, { x, y: 2.5, z }, mMatte);
      K.circle(x, z, 5.9, 5);
      AO(x, z, 7, 7, 0.55);
      put(cyl(0.55, 0.55, 12, 12), 0x101012, { x: x + 9, y: 0.55, z: z + 3, rz: PI / 2, ry: 0.6 }, mPlastic);
      put(cyl(0.6, 0.6, 2.6, 12), 0xffffff, { x: x + 9 + Math.cos(0.6) * 6.4, y: 0.55, z: z + 3 - Math.sin(0.6) * 6.4, rz: PI / 2, ry: 0.6 }, mPlastic);
      put(cyl(1.9, 1.9, 0.5, 20), 0xffc020, { x: -139, y: 0.25, z: -66 }, mPlastic);
      put(cyl(0.6, 0.6, 0.6, 12), 0x8a6a10, { x: -139, y: 0.5, z: -66 }, mPlastic);
    }
    // a spare slipmat in the NW U-turn and a cleaning brush
    {
      const m = new T.Mesh(new T.CircleGeometry(15, 48), K.std({ map: tex(canvas(256, 256, (g) => {
        g.fillStyle = '#121216'; g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
        g.fillStyle = '#ff3aa8'; g.font = 'bold 44px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('SPIN', 128, 116); g.fillStyle = '#38d8ff'; g.fillText('DOCTOR', 128, 162);
      }), [1, 1], false), roughness: 0.95 }));
      m.rotation.set(-PI / 2, 0, 0.5); m.position.set(-139, 0.04, -69); K.add(m, { cast: false });
      put(rbox(11, 1.6, 3.2, 0.6), 0x6a3a1a, { x: -96, y: 0.8, z: -48, ry: 0.4 }, mPlastic);
      put(rbox(10, 0.8, 2.6, 0.4), 0x2a2a30, { x: -96, y: 0.2, z: -48, ry: 0.4 }, mRubber);
      AO(-96, -48, 6.5, 2.4, 0.4, -0.4);
    }
    // a soft DJ record bag on the east end of the booth, flap open, a few sleeves showing
    {
      const x = 168, z = -4, ang = 0.12;
      const bagC = canvas(128, 128, (g, w, h) => { const img = TX.paint(128, 128, (px, py, u, v, o) => { const k = 30 + 10 * Math.sin(px * 1.6) * Math.sin(py * 1.6) + nAt(px * 3, py * 3) * 12; o[0] = k; o[1] = k * 0.95; o[2] = k * 1.1; }); g.drawImage(img, 0, 0); });
      const bagMat = K.std({ map: tex(bagC, [4, 3]), roughness: 0.95 });
      K.mesh(rbox(20, 18, 36, 2.5, 3), bagMat, x, 9, z, { ry: -ang });
      K.mesh(rbox(20, 1.6, 37, 0.8, 2), bagMat, x - 12.8, 0.8, z, { ry: -ang }); // the flap, folded down on the booth
      put(rbox(20.4, 1.4, 1.4, 0.3), 0xff3aa8, { x, y: 9, z: z - 18, ry: -ang }, mPlastic);
      put(rbox(20.4, 1.4, 1.4, 0.3), 0xff3aa8, { x, y: 9, z: z + 18, ry: -ang }, mPlastic);
      for (let i = 0; i < 6; i++) put(box(0.35, 4, 31), [0xff3aa8, 0x38d8ff, 0xffc030, 0xf0f0f0, 0x9b6bff, 0x30e090][i], { x: x - 6 + i * 2.2, y: 16.5 + r() * 1.2, z, ry: -ang }, mMatte);
      K.box(x, z, 10.5, 18.5, ang, 18);
      AO(x, z, 13, 22, 0.6, ang);
      warnRoad('record bag', x, z, 20);
    }
    // glowsticks, earplugs and bottle caps
    {
      const glows = [];
      const gcol = [0x40ff60, 0xff3aa8, 0x38d8ff, 0xffd020, 0xb070ff];
      const spots = [[-30, -45], [30, -70], [-80, -70], [92, -60], [-150, 0], [150, 0], [0, 75], [-40, 78], [40, 80], [-120, 75], [120, 72], [-60, 20], [70, -20], [-2, -60]];
      for (const [x, z] of spots) {
        if (dRoad(x, z) < 2) continue;
        glows.push({ x, y: 0.4, z, ry: r() * TAU, rz: PI / 2, color: r.pick(gcol) });
      }
      K.instances(cyl(0.4, 0.4, 7, 10), glowInst(1.8), glows, { colors: true, cast: false });
      const hal = K.instances(flatGeo(8, 4), addMat(0xffffff, 0.35), glows.map((q) => ({ x: q.x, y: 0.08, z: q.z, ry: q.ry, color: q.color })), { colors: true, cast: false, receive: false });
      hal.renderOrder = 3;
      const plugs = [];
      for (let i = 0; i < 30; i++) {
        const x = r.range(-185, 185), z = r.range(-100, 88);
        if (dRoad(x, z) < 1.5 || onPlinth(x, z, 2) || onMixer(x, z, 2) || Math.hypot(x - CUP.x, z - CUP.z) < 12 || Math.hypot(x - PHONES.x, z - PHONES.z) < 14 || Math.hypot(x - CAN.x, z - CAN.z) < 10) continue;
        plugs.push({ x, y: 0.45, z, ry: r() * TAU, rz: PI / 2, color: r.pick([0xff8a20, 0xffd020, 0x30e090, 0xc0c4cc]) });
      }
      K.instances(cyl(0.45, 0.4, 1.4, 10), K.plastic(0xffffff, 0.4), plugs, { colors: true, cast: false });
    }
    // stickers on the booth (made-up names)
    {
      const words = [['SUBSONIC', '#ff3aa8', '#111'], ['WAX LAB', '#111', '#38d8ff'], ['NIGHT SHIFT', '#ffc030', '#111'], ['DEEP CUTS ONLY', '#fff', '#111'], ['KICK & SNARE', '#9b6bff', '#fff'], ['VELVET GROOVE', '#e8147c', '#fff'], ['124 BPM', '#30e090', '#111'], ['NO REQUESTS', '#ff6a2a', '#fff']];
      const spots = [[-150, -20, 0.3], [150, -25, -0.4], [-20, -80, 0.1], [90, -80, -0.2], [-90, -80, 0.25], [-180, 85, 0], [175, 80, 0.2], [0, 84, -0.1], [-128, 84, 0.15], [100, 84, -0.3], [-40, -30, 0.4], [70, 70, 0.5]];
      spots.forEach(([x, z, a], i) => {
        if (dRoad(x, z) < 6) return;
        const [t, bg, ink] = words[i % words.length];
        const c = canvas(256, 96, (g, w, h) => { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill(); g.fillStyle = ink; g.font = 'bold 40px "Lilita One", Rubik, sans-serif'; g.textAlign = 'center'; g.fillText(t, w / 2, 62); });
        const m = new T.Mesh(new T.PlaneGeometry(12, 4.5), K.std({ map: tex(c, [1, 1], false), roughness: 0.5, transparent: true })); m.rotation.set(-PI / 2, 0, a); m.position.set(x, 0.025, z); m.renderOrder = 1; K.add(m, { cast: false });
      });
    }
    // confetti from the last drop (thinned at Low after placement, so the random sequence is the same)
    {
      const conf = [];
      const cc = [0xff3aa8, 0x38d8ff, 0xffc030, 0x9b6bff, 0x30e090, 0xffffff, 0xff6a2a];
      for (let i = 0; i < 520; i++) {
        const x = r.range(-186, 186), z = r.range(-134, 90), ry = r() * TAU, c = r.pick(cc), s = r.range(0.6, 1.1), rx = r.range(-0.2, 0.2), y = 0.05 + r() * 0.03;
        if (lowQ && i % 2) continue;
        if (onPlatter(x, z, 0.5) || onMixer(x, z, -1) || (x > -15 && x < 15 && z < -33 && z > -59)) continue;
        conf.push({ x, y, z, ry, rx, sx: s, sy: 1, sz: s * 0.55, color: c });
      }
      K.instances(flatGeo(1, 1), K.std({ roughness: 0.4, metalness: 0.3, side: T.DoubleSide, envMap: ENV, envMapIntensity: 1 }), conf, { colors: true, cast: false });
    }

    // ============================================================ stage lighting: moving heads sweep coloured pools
    for (const [col, ph, i] of [[0xff2aa8, 0, 0], [0x28d8ff, 2.1, 1], [0xffa030, 4.2, 2]]) {
      const sp = new T.SpotLight(col, 16000, 0, 0.2, 0.55, 2);
      sp.position.set(-120 + i * 120, 190, -60); sp.castShadow = false;
      K.group.add(sp, sp.target);
      A.spots.push({ sp, ph, i });
    }

    // ============================================================ contact shadows, then merge the static parts
    {
      const im = K.instances(flatGeo(1, 1), contactMat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.push(im);
    }
    flushBins();
    {
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.material.transparent || o.renderOrder || o.material.vertexColors) return;
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

    // ============================================================ where the road runs over each deck (for the CPU drivers)
    for (const D of A.decks) {
      const d = D.d; let a = -1, b = -1;
      for (let i = 0; i < track.N; i++) {
        const inside = Math.hypot(track.x[i] - d.sx, track.z[i] - d.sz) < R_PLAT;
        const j = (i - 1 + track.N) % track.N, prevIn = Math.hypot(track.x[j] - d.sx, track.z[j] - d.sz) < R_PLAT;
        if (inside && !prevIn) a = i;
        if (inside) b = i;
      }
      d.s0 = a * track.ds; d.s1 = b * track.ds;
      const p = track.at((d.s0 + d.s1) / 2); d.westSide = p.nx < 0 ? 1 : -1; // (the arm comes in from the east)
    }
    if (typeof window !== 'undefined') window.__vy = A;
  },

  // fixed rate: the bass kicks, the CPU drivers' lane choice at the decks, the cues
  tick(dt, time, game) {
    if (!A) return;
    const racing = game.state === 'race' || game.state === 'roundEnd' || game.state === 'attract';
    // CPU drivers: when a tone arm will be down while they cross its record, they take the west lane (the gap)
    for (const e of game.cars) {
      const ai = e.ai || (e.finished ? e.cooldown : null);
      if (!ai || e.out) continue;
      const c = e.car;
      if (c.state !== 'drive') continue;
      for (const D of A.decks) {
        const d = D.d, dist = (((d.s0 - e.trackS) % A.L) + A.L) % A.L, inside = (((e.trackS - d.s0) % A.L) + A.L) % A.L < d.s1 - d.s0;
        if (dist > 45 && !inside) continue;
        const v = Math.max(12, c.fwdSpeed), ta = inside ? 0 : dist / v, tb = ta + (d.s1 - d.s0 + 4) / v;
        let danger = false;
        for (let k = 0; k <= 4 && !danger; k++) { const b = armBeat(time + ta + (tb - ta) * k / 4, d); if (b >= ARMC.lift0 + 1 && b < ARMC.back1) danger = true; }
        if (!danger) continue;
        const want = d.westSide * 4.2, lo = ai.lineOffset(e.trackS + 6 + Math.max(0, c.fwdSpeed) * 0.28);
        if (d.westSide > 0 ? lo + ai.avoid < want : lo + ai.avoid > want) ai.avoid = want - lo;
      }
    }
    // the kick: cars in front of a cone get shoved away from it
    const k1 = Math.floor(time / BEAT), k0 = Math.floor((time - dt) / BEAT);
    if (k1 !== k0 && racing) {
      for (const e of game.cars) {
        const c = e.car;
        if (e.out || c.state !== 'drive') continue;
        for (const s of SPK) {
          const dx = c.x - s.x, dz = c.z - SPKD.front, d = Math.hypot(dx, dz);
          if (d > BASS.R || dz < 0) continue;
          const k = Math.sqrt(1 - d / BASS.R), f = BASS.kick * k / Math.max(d, 1);
          c.vx += dx * f; c.vz += dz * f;
          // ...and the floor bounces: a little hop on the beat (no grip until it lands)
          if (!c.airborne) { c.airborne = true; c.vy = BASS.hop * k; }
        }
      }
    }
    // tone arm cues: the cue lever clicks as an arm lifts, and again as its needle drops
    for (let i = 0; i < A.decks.length; i++) {
      const d = A.decks[i].d, b = armBeat(time, d), pb = A.lastB[i];
      A.lastB[i] = b;
      if (pb < 0) continue;
      if (crossedB(pb, b, ARMC.lift0)) game.sound.cue('tick', { x: d.pvx, z: d.pvz, game });
      if (crossedB(pb, b, ARMC.swing1)) game.sound.cue('tick', { x: d.pvx, z: d.pvz, game, alt: 1 });
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    const beat = time / BEAT, bu = fract(beat), pump = kickPump(time);
    A.uTime.value = time; A.uBeat.value = Math.pow(Math.max(0, 1 - bu / 0.25), 2) * 0.6;
    // decks: platters, tone arms and their warnings
    for (const D of A.decks) {
      D.g.rotation.y = -D.d.w * time;
      const p = armPose(time, D.d);
      D.yaw.rotation.y = -p.th;
      D.lift.rotation.z = p.lift * 0.1;
      const blink = p.warn ? (Math.floor(time * 8) % 2 ? 1 : 0.25) : 0;
      D.ledMat.emissiveIntensity = p.warn ? 4 * blink : p.hot && p.th !== ARM.rest ? 1.5 : 0;
      D.glowArm.material.opacity = p.warn ? 0.4 * blink : p.hot && p.th !== ARM.rest ? 0.22 : 0;
      // the target light pops up for the telegraph and the swing and lights the landing groove
      const up = ss(ARMC.lift0 - 0.4, ARMC.lift0, p.b) * (1 - ss(ARMC.swing1 + 0.2, ARMC.swing1 + 0.7, p.b));
      D.tl.scale.y = 0.12 + 0.88 * up;
      D.tlHeadMat.emissiveIntensity = 3.5 * up;
      D.pool.material.opacity = 0.8 * up * (0.7 + 0.3 * blink);
      D.beam.material.opacity = 0.16 * up;
    }
    // mixer faders, crossfader and the meters
    for (let i = 0; i < 4; i++) {
      A.m4.makeTranslation(MIX.x + CH[i], 0, MIX.z + faderZ(time, i));
      for (const im of A.fadIM) im.setMatrixAt(i, A.m4);
    }
    for (const im of A.fadIM) im.instanceMatrix.needsUpdate = true;
    A.fadStripe.emissiveIntensity = 1.6 + 2.2 * pump;
    A.xfader.g.position.x = MIX.x + xfaderX(time); A.xfader.stripeMat.emissiveIntensity = 1.8 + 2.2 * pump;
    if (A.vu) {
      const col = A.col;
      for (let i = 0; i < A.vu.list.length; i++) {
        const q = A.vu.list[i];
        const lvl = 3 + 7.5 * pump * (0.75 + 0.25 * Math.sin(q.ch * 1.7 + beat * 0.5)) + 1.5 * Math.sin(time * 9 + q.ch * 2);
        if (q.k < lvl) col.setHex(q.k > 8 ? 0xff2020 : q.k > 6 ? 0xffc020 : 0x30ff60); else col.setRGB(0.03, 0.03, 0.03);
        A.vu.im.setColorAt(i, col);
      }
      A.vu.im.instanceColor.needsUpdate = true;
    }
    // speakers: the cones kick out and spring back, the shock ring spreads over the booth
    for (const C of A.cones) { C.cone.position.z = C.z + pump * 1.6; C.surround.scale.setScalar(1 + pump * 0.02); }
    for (const R of A.rings) { const s = 6 + bu * 64; R.scale.set(s, 1, s); R.material.opacity = 0.55 * Math.pow(1 - bu, 2); }
    // the LED lip and the moving heads (they sweep round the action)
    A.ledFront.material.emissive.setHSL(fract(time * 0.03), 0.9, 0.5);
    A.ledFront.material.emissiveIntensity = 1.6 + 2 * pump;
    A.barGlow.material.color.copy(A.ledFront.material.emissive); A.barGlow.material.opacity = 0.25 + 0.3 * pump;
    const cx = game ? game.camX : 0, cz = game ? game.camZ : 0;
    for (const S of A.spots) {
      const a = time * (0.31 + S.i * 0.07) + S.ph;
      S.sp.target.position.set(cx + Math.sin(a) * 34 + Math.sin(a * 2.3) * 8, 0, cz + Math.cos(a * 1.3) * 20);
      S.sp.position.set(cx - 70 + S.i * 70, 190, cz - 80);
      S.sp.intensity = 13000 + 6000 * pump;
    }
    if (A.wave) for (let i = 0; i < A.wave.length; i++) A.wave[i].offset.x = (time * 0.04 + i * 0.37) % 1;
  },
};
