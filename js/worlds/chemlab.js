// World: Reaction Rally. A school chemistry lab bench late in the evening: black epoxy-resin top, the fume
// cupboard glowing at the back, glassware everywhere. Rally cars race a strip of white bench paper edged with
// yellow-black hazard tape: a test-tube-rack slalom, two Bunsen burners that flare (hiss, then a tall yellow
// flame that blasts you aside), an elephant-toothpaste eruption that floods the hairpin with foam, a magnetic
// stirrer whose turning top plate carries you round and flings you off, a lab-notebook jump over spilt acid,
// green PVA slime and spilled copper sulfate crystals.

const TRACK = [
  [-110, 64], [-70, 70], [-30, 73], [10, 79], [52, 80], [92, 72], [120, 52], [136, 24], [126, -2], [138, -28],
  [124, -54], [96, -72], [60, -74], [30, -68], [14, -46], [8, -20], [0, 2], [-18, 7], [-34, -6], [-38, -34, 11.5],
  [-50, -60], [-80, -74], [-114, -70], [-134, -46], [-140, -8], [-132, 32],
];

const BX = 160, BZN = -96, BZS = 94; // bench top extents (north edge meets the wall / fume cupboard)
const PI = Math.PI, TAU = PI * 2;

// Bunsen burners beside the north straight: calm blue cone, then the gas hisses and the flame flickers (warn),
// then a tall yellow flare that blasts cars aside. Two burners alternate.
const BUN = { P: 4.6, warn: 1.05, flare: 1.3, R: 12, list: [{ s: 414, off: -11.2, ph: 0 }, { s: 448, off: 11.2, ph: 2.3 }] };
function flareState(t, ph) {
  const { P, warn, flare } = BUN;
  const u = (((t - ph) % P) + P) % P;
  const a = P - warn - flare;
  if (u < a) return { w: 0, f: 0 };
  if (u < a + warn) return { w: (u - a) / warn, f: 0 };
  const q = (u - a - warn) / flare;
  return { w: 1, f: q < 0.1 ? q / 0.1 : q > 0.78 ? Math.max(0, (1 - q) / 0.22) : 1 };
}

// Elephant toothpaste in the hairpin: bubbling, eruption (the foam front surges outwards), hold, slump back.
const FOAM = { x: -15.5, z: -15, P: 12, ph: 5, bubble: 2.4, surge: 1.0, hold: 2.2, drain: 2.6, R0: 7.5, R1: 22 };
function foamState(t) {
  const F = FOAM;
  const u = (((t - F.ph) % F.P) + F.P) % F.P;
  const t1 = F.bubble, t2 = t1 + F.surge, t3 = t2 + F.hold, t4 = t3 + F.drain;
  if (u < t1) return { R: F.R0, bub: u / t1, surge: 0, col: 0, u };
  if (u < t2) { const q = (u - t1) / F.surge; return { R: F.R0 + (F.R1 - F.R0) * (1 - (1 - q) * (1 - q)), bub: 1, surge: 1, col: q, u }; }
  if (u < t3) return { R: F.R1, bub: 0.5, surge: 0, col: 1, u };
  if (u < t4) { const q = (u - t3) / F.drain; return { R: F.R0 + (F.R1 - F.R0) * (1 - q * q), bub: 0.2 * (1 - q), surge: 0, col: 1 - q, u }; }
  return { R: F.R0, bub: 0, surge: 0, col: 0, u };
}

// Magnetic stirrer the road crosses: low casing with chamfered ends, turning ceramic top plate and a stir bar.
const STIR = { s: 680, off: 3, R: 12, h: 2.0, half: 15, wide: 17, ramp: 8, bar: 4.2 };
const stirAngle = (t) => 1.05 * t + 0.4 * (13 / TAU) * (1 - Math.cos((TAU * t) / 13));

// Lab-notebook ramp (on a box of pipette tips) over the spilt acid
const JUMP = { s: 768, off: 3.0, len: 12, wid: 9.0, h: 3.4 };

let A = null;

export default {
  id: 'chemlab',
  name: 'Reaction Rally',
  blurb: 'Evening chem lab: Bunsen flares, a stirrer that flings you and erupting foam.',
  vehicle: 'rally',
  seed: 47,
  track: { points: TRACK, width: 13, startS: 40 },
  bounds: { minX: -BX, maxX: BX, minZ: BZN, maxZ: BZS },
  fallOffEdges: true,
  floorY: -76,
  offCourse: 16,
  skidColor: 0x2c2f36,
  clackOnBump: true,
  dustColor: 0xdfe6ee,
  dust: {
    normal: null,
    slick: { color: 0xeef6e8, size: 1.2, life: 0.7, up: 2.5, grav: -2, alpha: 0.35, grow: 2.2, rate: 2 },
    sticky: { color: 0x47d14a, size: 0.7, life: 0.4, up: 1.2, grav: 10, alpha: 0.9, grow: 1 },
    rough: { color: 0x2f8fe6, size: 0.45, life: 0.45, up: 4, grav: 30, alpha: 1, grow: 1, rate: 2 },
  },
  lighting: {
    sunDir: [-0.32, 1, -0.26], sunColor: 0xe6eeff, sunIntensity: 1.75,
    hemiSky: 0x9fb2d6, hemiGround: 0x15161c, hemiIntensity: 0.42,
    envIntensity: 0.42, exposure: 1.02, background: 0x07080c, shadowRadius: 2.6,
    fog: { color: 0x07080c, near: 260, far: 640 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const BU = K.BufferGeometryUtils;
    A = { burners: [], keep: [] };
    const keep = A.keep;
    const at = (s, off = 0) => track.place(s, off);
    const warnRoad = (what, x, z, m = 0.4) => { if (!K.offRoad(x, z, m)) console.warn(`chemlab: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };
    const rr = K.rng(1234);

    // batched contact shadows (opacity rides in the unused y scale)
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.4, ang = 0, y = 0.04) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });
    // additive light pools
    const glowList = [];
    const glow = (x, y, z, sx, sz, color, k = 1, ang = 0) => { glowList.push({ x, y, z, sx, sy: 1, sz, ry: -ang, base: new T.Color(color).multiplyScalar(k), color: new T.Color(color) }); return glowList.length - 1; };

    // ============================================================================================
    // MATERIALS
    // ============================================================================================
    const MC = new Map();
    const cache = (key, make) => { if (!MC.has(key)) MC.set(key, make()); return MC.get(key); };
    const plastic = (c, rough = 0.38) => cache('p' + c + rough, () => { const m = K.plastic(c, rough); m.userData.vc = 'pl' + rough; return m; });
    const metal = (c = 0xd6d9de, rough = 0.22) => cache('m' + c + rough, () => K.metal(c, rough));
    // borosilicate glass: thin, clear, with a Fresnel rim so the walls read even on a dark bench
    const mkGlass = (color = 0xeef6ff, op = 0.09, rim = 0.5, extra = {}) => {
      const m = K.phys({ color, roughness: 0.03, metalness: 0, transparent: true, opacity: op, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.6, ior: 1.47, ...extra });
      const code = `float clFr = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
        diffuseColor.a = clamp(diffuseColor.a + clFr * ${rim.toFixed(3)}, 0.0, 0.9);
        outgoingLight += clFr * vec3(0.07, 0.085, 0.1);
        #include <opaque_fragment>`;
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', code); };
      m.customProgramCacheKey = () => 'clglass' + rim.toFixed(3);
      return m;
    };
    const glass = mkGlass();
    const glassThick = mkGlass(0xe2f0f4, 0.13, 0.6);
    // coloured solutions: glossy, faintly self-lit as if the lab light shines through them
    const liquid = (c, e = 0.32) => cache('l' + c + e, () => (c === SOL.water ? K.phys({ color: 0x9cc8e4, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.38, depthWrite: false, envMapIntensity: 1.8 }) : (() => { const m = K.phys({ color: c, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, emissive: c, emissiveIntensity: e, envMapIntensity: 1.2 }); m.userData.vc = 'lq' + e; return m; })()));
    var SOL = {
      cuso4: 0x1f86e0, kmno4: 0x7d1186, phph: 0xf0359a, green: 0x35b34a, dichro: 0xf07612, chromate: 0xf2c51c,
      fecl3: 0xc77a18, iodine: 0x7c3410, water: 0x9ccbe8, cobalt: 0xd2457e, nickel: 0x2fa36a, ki: 0xf2e7a6, blue2: 0x2a52d0,
    };
    const UI = [0xd8202a, 0xe8401c, 0xf06a18, 0xf2a31c, 0xf2c81c, 0xb8d22a, 0x3caa3a, 0x1e9a8a, 0x1f7fc8, 0x2a5ad8, 0x3a2aa8, 0x5a1fa0, 0x6a1a9a];

    // ============================================================================================
    // CANVAS HELPERS: GHS pictograms, handwriting
    // ============================================================================================
    const ghs = (g, cx, cy, R, kind) => {
      g.save(); g.translate(cx, cy);
      g.beginPath(); g.moveTo(0, -R); g.lineTo(R, 0); g.lineTo(0, R); g.lineTo(-R, 0); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.lineWidth = R * 0.14; g.strokeStyle = '#d7151d'; g.stroke();
      g.fillStyle = '#111'; g.strokeStyle = '#111';
      const s = R / 50;
      g.scale(s, s);
      if (kind === 'flame' || kind === 'oxid') {
        if (kind === 'oxid') { g.lineWidth = 5; g.beginPath(); g.arc(0, 14, 11, 0, TAU); g.stroke(); }
        g.beginPath(); g.moveTo(-12, kind === 'oxid' ? 2 : 16); g.bezierCurveTo(-18, -2, -6, -10, -4, -26); g.bezierCurveTo(2, -14, 6, -16, 6, -22);
        g.bezierCurveTo(16, -8, 16, 6, 12, kind === 'oxid' ? 2 : 16); g.closePath(); g.fill();
        g.fillRect(-18, 20, 36, 4);
      } else if (kind === 'excl') {
        g.fillRect(-4, -26, 8, 32); g.beginPath(); g.arc(0, 16, 5, 0, TAU); g.fill();
      } else if (kind === 'corr') {
        g.save(); g.rotate(-0.5); g.fillRect(-22, -24, 8, 16); g.restore();
        g.save(); g.rotate(0.5); g.fillRect(14, -24, 8, 16); g.restore();
        for (const [x, y] of [[-12, -4], [-10, 4], [12, -4], [10, 4]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
        g.fillRect(-26, 12, 20, 5); g.fillRect(4, 12, 22, 5);
        g.beginPath(); g.moveTo(-6, 12); g.lineTo(-2, 17); g.lineTo(-8, 17); g.fill();
      } else if (kind === 'skull') {
        g.beginPath(); g.arc(0, -8, 11, 0, TAU); g.fill(); g.fillRect(-6, 0, 12, 7);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-4.5, -9, 3, 0, TAU); g.arc(4.5, -9, 3, 0, TAU); g.fill(); g.fillStyle = '#111';
        g.lineWidth = 4.5; g.beginPath(); g.moveTo(-16, 10); g.lineTo(16, 24); g.moveTo(16, 10); g.lineTo(-16, 24); g.stroke();
      } else if (kind === 'env') {
        g.lineWidth = 3; g.beginPath(); g.moveTo(-14, 14); g.lineTo(-14, -16); g.moveTo(-14, -6); g.lineTo(-22, -14); g.moveTo(-14, -2); g.lineTo(-6, -12); g.stroke();
        g.beginPath(); g.ellipse(8, 12, 10, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(16, 12); g.lineTo(24, 6); g.lineTo(24, 18); g.fill();
      } else if (kind === 'health') {
        g.beginPath(); g.arc(0, -18, 6, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-12, 22); g.lineTo(-10, -8); g.lineTo(10, -8); g.lineTo(12, 22); g.fill();
        g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.fillRect(Math.cos(a) * 5 - 1, 6 + Math.sin(a) * 5 - 1, 2, 2); } g.beginPath(); g.arc(0, 6, 3, 0, TAU); g.fill();
      }
      g.restore();
    };
    // handwriting: italic serif, a slight jitter per word
    const hand = (g, txt, x, y, size = 26, color = '#1c3a8c', rot = 0) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = color; g.font = `italic ${size}px Georgia, "Times New Roman", serif`; g.textBaseline = 'alphabetic';
      let cx = 0;
      for (const w of txt.split(' ')) {
        g.save(); g.translate(cx, rr.range(-1.2, 1.2)); g.rotate(rr.range(-0.03, 0.03)); g.fillText(w, 0, 0); g.restore();
        cx += g.measureText(w + ' ').width;
      }
      g.restore();
    };

    // ============================================================================================
    // LABEL ATLAS (bottles): 4 x 4 cells of 256 x 256
    // ============================================================================================
    const LABELS = [
      { n: 'Hydrochloric acid', f: 'HCl  2 mol/L', p: ['corr', 'excl'], c: '#c8202a' },
      { n: 'Sodium hydroxide', f: 'NaOH  1 mol/L', p: ['corr'], c: '#2a58c8' },
      { n: 'Copper(II) sulfate', f: 'CuSO₄·5H₂O', p: ['excl', 'env'], c: '#1f86e0' },
      { n: 'Potassium permanganate', f: 'KMnO₄  0.02 M', p: ['oxid', 'env'], c: '#7d1186' },
      { n: 'Ethanol 96 %', f: 'C₂H₅OH', p: ['flame'], c: '#e08a10' },
      { n: 'Acetone', f: '(CH₃)₂CO', p: ['flame', 'excl'], c: '#d03a2a' },
      { n: 'Hydrogen peroxide', f: 'H₂O₂  30 %', p: ['oxid', 'corr'], c: '#2a9a5a' },
      { n: 'Potassium iodide', f: 'KI  sat. soln.', p: ['excl'], c: '#8a7a20' },
      { n: 'Phenolphthalein', f: '1 % in ethanol', p: ['flame', 'health'], c: '#e0308f' },
      { n: 'Universal indicator', f: 'pH 1 – 14', p: ['flame'], c: '#3caa3a' },
      { n: 'Sodium chloride', f: 'NaCl', p: [], c: '#6a7a8a' },
      { n: 'Silver nitrate', f: 'AgNO₃  0.1 M', p: ['corr', 'env'], c: '#5a5a6a' },
      { n: 'Sulfuric acid', f: 'H₂SO₄  1 mol/L', p: ['corr'], c: '#b0182a' },
      { n: 'Distilled water', f: 'H₂O  aqua dest.', p: [], c: '#2a8ad0' },
      { n: 'Iodine solution', f: 'I₂ / KI', p: ['health', 'excl'], c: '#7c3410' },
      { n: 'PVA 4 % + borax', f: 'slime practical', p: ['health'], c: '#2fae3a' },
    ];
    const labelAtlas = (() => {
      const c = TX.makeCanvas(1024, 1024), g = c.getContext('2d');
      LABELS.forEach((L0, i) => {
        const x0 = (i % 4) * 256, y0 = Math.floor(i / 4) * 256;
        g.fillStyle = '#f3f1ea'; g.fillRect(x0, y0, 256, 256);
        g.fillStyle = L0.c; g.fillRect(x0, y0 + 14, 256, 26); g.fillRect(x0, y0 + 222, 256, 10);
        g.fillStyle = '#fff'; g.font = '700 15px Rubik, Arial, sans-serif'; g.textAlign = 'center';
        g.fillText('SCHOOL LAB SUPPLY', x0 + 128, y0 + 33);
        g.fillStyle = '#16181c'; g.font = '700 24px Rubik, Arial, sans-serif';
        const words = L0.n.split(' ');
        if (g.measureText(L0.n).width > 236 && words.length > 1) {
          const h = Math.ceil(words.length / 2);
          g.fillText(words.slice(0, h).join(' '), x0 + 128, y0 + 72); g.fillText(words.slice(h).join(' '), x0 + 128, y0 + 99);
        } else g.fillText(L0.n, x0 + 128, y0 + 82);
        g.font = '20px Georgia, serif'; g.fillStyle = '#2a2c30'; g.fillText(L0.f, x0 + 128, y0 + 126);
        const n = L0.p.length;
        L0.p.forEach((k, j) => ghs(g, x0 + 128 + (j - (n - 1) / 2) * 62, y0 + 172, 27, k));
        g.font = '11px Arial, sans-serif'; g.fillStyle = '#555';
        g.fillText('Lot 2417 · Store cool · Keep closed', x0 + 128, y0 + 214);
      });
      return TX.toTexture(c, { wrap: false });
    })();
    const labelMat = K.phys({ map: labelAtlas, roughness: 0.55, clearcoat: 0.2 });
    const cellUV = (geo, i, cols = 4, rows = 4, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
      const uv = geo.attributes.uv, cx = i % cols, cy = Math.floor(i / cols);
      for (let k = 0; k < uv.count; k++) {
        const u = u0 + (u1 - u0) * uv.getX(k), v = v0 + (v1 - v0) * uv.getY(k);
        uv.setXY(k, (cx + u) / cols, 1 - (cy + 1 - v) / rows);
      }
      return geo;
    };

    // ============================================================================================
    // PRINT ATLAS on glass: white enamel graduations / marking spots (alpha tested): 4 cells 256 x 512
    // ============================================================================================
    const printAtlas = (() => {
      const c = TX.makeCanvas(1024, 512), g = c.getContext('2d');
      g.clearRect(0, 0, 1024, 512);
      g.fillStyle = '#fbfbf6'; g.strokeStyle = '#fbfbf6';
      // 0: beaker: graduation ladder on the left of the arc, marking spot on the right
      {
        const x0 = 0;
        for (let i = 1; i <= 5; i++) {
          const y = 470 - i * 70;
          g.fillRect(x0 + 40, y - 2, 46, 5); g.font = '700 22px Arial'; g.textAlign = 'left'; g.fillText(String(i * 100), x0 + 92, y + 8);
          g.fillRect(x0 + 40, y + 33, 26, 4);
        }
        g.fillRect(x0 + 150, 300, 90, 64);
        g.font = '700 30px Arial'; g.textAlign = 'center'; g.fillText('600 ml', x0 + 190, 140); g.font = '20px Arial'; g.fillText('± 5 %', x0 + 190, 168);
        g.fillText('BORO 3.3', x0 + 190, 196);
      }
      // 1: erlenmeyer
      {
        const x0 = 256;
        for (let i = 1; i <= 4; i++) { const y = 470 - i * 80; g.fillRect(x0 + 60, y - 2, 40, 5); g.font = '700 20px Arial'; g.textAlign = 'left'; g.fillText(String(i * 50), x0 + 106, y + 7); }
        g.fillRect(x0 + 150, 330, 76, 50);
        g.font = '700 28px Arial'; g.textAlign = 'center'; g.fillText('250 ml', x0 + 186, 120); g.font = '18px Arial'; g.fillText('approx.', x0 + 186, 146);
      }
      // 2: cylinder / burette scale: fine ladder
      {
        const x0 = 512;
        for (let i = 0; i <= 50; i++) { const y = 490 - i * 9; g.fillRect(x0 + 90, y - 1, i % 5 === 0 ? 50 : 26, i % 5 === 0 ? 3.5 : 2); if (i % 10 === 0) { g.font = '700 18px Arial'; g.textAlign = 'left'; g.fillText(String(i * 2), x0 + 146, y + 6); } }
        g.font = '700 22px Arial'; g.fillText('100 ml', x0 + 20, 26); g.fillText('20°C', x0 + 20, 50);
      }
      // 3: flask marking spot + text
      {
        const x0 = 768;
        g.fillRect(x0 + 70, 200, 120, 90);
        g.font = '700 30px Arial'; g.textAlign = 'center'; g.fillText('500 ml', x0 + 130, 340); g.font = '18px Arial'; g.fillText('NS 29/32', x0 + 130, 366);
      }
      const t = TX.toTexture(c, { wrap: false });
      return t;
    })();
    const printMat = K.std({ map: printAtlas, alphaTest: 0.45, transparent: false, roughness: 0.5, side: T.FrontSide });
    const PRINT_PHI = 2.3; // printed arc width (radians) facing the camera (+z)

    // ============================================================================================
    // BENCH, EDGE, CABINETS, FLOOR, WALL
    // ============================================================================================
    {
      const ep = TX.mottledTextures({ size: 512, a: 0x1d2024, b: 0x16181b, c: 0x2a2d31, seed: 61, period: 10, speck: 0.35, bump: 0.8, roughness: [0.42, 0.62] });
      for (const t of [ep.map, ep.normalMap, ep.roughnessMap]) t.repeat.set(320 / 48, 190 / 48);
      const benchMat = K.phys({ map: ep.map, normalMap: ep.normalMap, normalScale: V2(0.35), roughnessMap: ep.roughnessMap, roughness: 1, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.6 });
      const W0 = BX * 2, D0 = BZS - BZN;
      K.mesh(new T.BoxGeometry(W0, 3.2, D0), benchMat, 0, -1.6, (BZS + BZN) / 2, { cast: false });
      // rounded front/side nosing with a drip groove underneath
      const nose = K.std({ color: 0x1a1c20, roughness: 0.45 });
      K.mesh(new T.CylinderGeometry(1.6, 1.6, W0, 16), nose, 0, -1.6, BZS, { rz: PI / 2, cast: false });
      for (const sx of [-1, 1]) K.mesh(new T.CylinderGeometry(1.6, 1.6, D0, 16), nose, sx * BX, -1.6, (BZS + BZN) / 2, { rx: PI / 2, cast: false });
      // cabinets below: grey melamine doors with steel bow handles and a dark plinth
      const doorC = TX.makeCanvas(512, 256), dg = doorC.getContext('2d');
      dg.fillStyle = '#9aa1a8'; dg.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 4; i++) { dg.fillStyle = '#b5bbc1'; dg.fillRect(i * 128 + 4, 8, 120, 240); dg.fillStyle = '#6e757c'; dg.fillRect(i * 128 + 54, 30, 20, 5); }
      const doorMat = K.std({ map: TX.toTexture(doorC, { repeat: [W0 / 120, 1] }), roughness: 0.6 });
      const doorMatS = K.std({ map: TX.toTexture(doorC, { repeat: [D0 / 120, 1] }), roughness: 0.6 });
      const dark = K.std({ color: 0x24272c, roughness: 0.8 });
      K.mesh(new T.BoxGeometry(W0 - 8, 62, D0 - 8), doorMat, 0, -36, (BZS + BZN) / 2 - 2, { cast: false }); void doorMatS;
      K.mesh(new T.BoxGeometry(W0 - 12, 8, D0 - 12), dark, 0, -72, (BZS + BZN) / 2 - 2, { cast: false });
      // lab floor: grey speckled safety vinyl with welded seams
      const fl = TX.mottledTextures({ size: 512, a: 0x6f747a, b: 0x5f646a, seed: 72, period: 6, speck: 0.6, bump: 1 });
      fl.map.repeat.set(10, 10); fl.normalMap.repeat.set(10, 10);
      K.mesh(new T.PlaneGeometry(1600, 1600), K.std({ map: fl.map, normalMap: fl.normalMap, roughness: 0.55 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      // floor safety line and a floor drain
      K.mesh(new T.PlaneGeometry(700, 5), K.std({ color: 0xe8c21a, roughness: 0.6 }), 0, -75.9, BZS + 60, { rx: -PI / 2, cast: false });
      // back wall: white tiles with a service spine
      const tileC = TX.makeCanvas(256, 256), tg = tileC.getContext('2d');
      tg.fillStyle = '#c9ced4'; tg.fillRect(0, 0, 256, 256); tg.fillStyle = '#e9edf0';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) tg.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      const tileT = TX.toTexture(tileC, { repeat: [W0 / 40, 4] });
      K.mesh(new T.PlaneGeometry(W0 + 40, 160), K.std({ map: tileT, roughness: 0.35 }), 0, 50, BZN - 58, { cast: false });
      // upstand along the back edge (cars cannot leave north)
      K.mesh(new T.BoxGeometry(W0, 6, 2), benchMat, 0, 3, BZN - 1, { cast: false });
      K.box(0, BZN - 1.5, BX, 1.5, 0, 8);
    }

    // ============================================================================================
    // ROAD: white absorbent bench paper, yellow-black hazard tape, stains
    // ============================================================================================
    {
      const pc = TX.paint(512, 1024, (x, y, u, v, o) => {
        const n = (Math.sin(x * 0.9 + y * 0.31) + Math.sin(x * 0.27 - y * 1.3)) * 2 + rr() * 9;
        const crease = Math.abs(((v * 3.0 + u * 0.15) % 1) - 0.5) < 0.004 ? -10 : 0;
        o[0] = 226 + n + crease; o[1] = 230 + n + crease; o[2] = 233 + n + crease;
      });
      const pt = TX.toTexture(pc, { repeat: [1, 1] });
      // embossed diamond quilting of absorbent bench liner + fibre noise
      const nf = TX.noiseField(256, { seed: 81, period: 16, oct: 4 });
      const ph = new Float32Array(256 * 512);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 256; x++) {
        const u = x / 256 * 10, v = y / 512 * 17;
        const dmd = Math.abs(((u + v) % 1) - 0.5) + Math.abs(((u - v + 100) % 1) - 0.5);
        ph[y * 256 + x] = Math.min(1, dmd * 1.1) * 0.55 + nf[(y % 256) * 256 + x] * 0.45;
      }
      const pn = TX.toTexture(TX.normalFromHeight(ph, 256, 512, 1.4), { srgb: false });
      const paperMat = K.std({ map: pt, normalMap: pn, normalScale: V2(0.5), roughness: 0.93, envMapIntensity: 0.25 });
      K.ribbon({ mat: paperMat, y: 0.05, vScale: 26, widthFn: (w) => w + 2.4 });
      // hazard tape on both edges
      const hc = TX.makeCanvas(64, 256), hg = hc.getContext('2d');
      hg.fillStyle = '#f2c812'; hg.fillRect(0, 0, 64, 256);
      hg.fillStyle = '#141414';
      for (let i = -2; i < 10; i++) { hg.beginPath(); hg.moveTo(0, i * 32); hg.lineTo(64, i * 32 + 32); hg.lineTo(64, i * 32 + 48); hg.lineTo(0, i * 32 + 16); hg.closePath(); hg.fill(); }
      const tapeT = TX.toTexture(hc, { repeat: [1, 1] });
      const tapeMat = K.phys({ map: tapeT, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      for (const sd of [-1, 1]) {
        const N = track.N, step = 2, rows = Math.ceil(N / step);
        const pos = new Float32Array((rows + 1) * 2 * 3), uv = new Float32Array((rows + 1) * 2 * 2), idx = [];
        for (let rw = 0; rw <= rows; rw++) {
          const i = (rw * step) % N, s = rw * step * track.ds;
          const nx = -track.tz[i], nz = track.tx[i], off = sd * (track.w[i] / 2 + 0.25);
          for (let c = 0; c < 2; c++) {
            const o2 = off + (c - 0.5) * 1.15, k = rw * 2 + c;
            pos[k * 3] = track.x[i] + nx * o2; pos[k * 3 + 1] = 0.1; pos[k * 3 + 2] = track.z[i] + nz * o2;
            uv[k * 2] = c; uv[k * 2 + 1] = s / 4.2;
          }
        }
        for (let rw = 0; rw < rows; rw++) { const a = rw * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
        g.setAttribute('normal', new T.BufferAttribute(new Float32Array(pos.length).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
        const m = new T.Mesh(g, tapeMat); m.receiveShadow = true; K.group.add(m);
      }

      // start / finish: a strip of white lab-label tape with marker chequers and START
      {
        const c = TX.makeCanvas(1024, 128), g = c.getContext('2d');
        g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 1024, 128);
        g.fillStyle = '#16171b';
        for (let y = 0; y < 2; y++) for (let x = 0; x < 28; x++) if ((x + y) % 2) g.fillRect(56 + x * 32, 10 + y * 32, 30 + rr.range(-1, 1), 30 + rr.range(-1, 1));
        g.save(); g.translate(512, 108); g.rotate(-0.01);
        g.font = '700 italic 36px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#1b1d8a'; g.fillText('START → FINISH   (3 laps!)', 0, 0); g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3; g.strokeRect(2, 2, 1020, 124);
        const p = track.at(40);
        const m = K.mesh(new T.PlaneGeometry(15.6, 2.0), K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.75 }), p.x, 0.14, p.z, { cast: false });
        m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
        keep.push(m);
      }

      // stains on the paper: one atlas (4 x 2 cells), all decals merged into one mesh
      const sc = TX.makeCanvas(1024, 512), sg = sc.getContext('2d');
      const blot = (cx, cy, R, col, a, n = 9) => { for (let i = 0; i < n; i++) { const q = sg.createRadialGradient(cx + rr.range(-R, R) * 0.4, cy + rr.range(-R, R) * 0.4, 0, cx, cy, R * rr.range(0.5, 1)); q.addColorStop(0, `rgba(${col},${a})`); q.addColorStop(0.7, `rgba(${col},${a * 0.6})`); q.addColorStop(1, `rgba(${col},0)`); sg.fillStyle = q; sg.fillRect(cx - R, cy - R, R * 2, R * 2); } };
      // 0 permanganate splash
      blot(128, 128, 90, '110,20,90', 0.32); for (let i = 0; i < 14; i++) blot(128 + rr.range(-110, 110), 128 + rr.range(-110, 110), rr.range(5, 14), '120,30,110', 0.7, 1);
      // 1 iodine ring (beaker ring)
      sg.strokeStyle = 'rgba(120,60,20,0.55)'; sg.lineWidth = 7; sg.beginPath(); sg.arc(384, 128, 88, 0.2, 5.9); sg.stroke(); sg.lineWidth = 16; sg.strokeStyle = 'rgba(140,80,30,0.18)'; sg.beginPath(); sg.arc(384, 128, 80, 0, TAU); sg.stroke();
      // 2 copper sulfate drops
      for (let i = 0; i < 18; i++) blot(640 + rr.range(-100, 100), 128 + rr.range(-100, 100), rr.range(6, 20), '30,120,220', 0.55, 1);
      // 3 scorch mark
      blot(896, 128, 105, '120,80,40', 0.22, 12); for (let i = 0; i < 10; i++) blot(896 + rr.range(-60, 60), 128 + rr.range(-60, 60), rr.range(14, 30), '70,45,25', 0.18, 2);
      // 4 indicator drips (rainbow)
      for (let i = 0; i < 9; i++) blot(40 + i * 22, 384 + Math.sin(i) * 30, 16, ['216,32,42', '240,106,24', '242,200,28', '184,210,42', '60,170,58', '30,154,138', '42,90,216', '58,42,168', '106,26,154'][i], 0.6, 2);
      // 5 pencil notes
      sg.save(); sg.translate(260, 330); sg.rotate(-0.12); sg.fillStyle = 'rgba(60,60,64,0.75)'; sg.font = 'italic 34px Georgia'; sg.fillText('rxn 3 → ΔT = 4.2 K', 0, 0); sg.font = 'italic 28px Georgia'; sg.fillText('pH ≈ 7', 40, 50); sg.restore();
      // 6 water marks
      sg.strokeStyle = 'rgba(150,160,170,0.35)'; sg.lineWidth = 4; for (let i = 0; i < 4; i++) { sg.beginPath(); sg.arc(640 + rr.range(-60, 60), 384 + rr.range(-60, 60), rr.range(20, 50), 0, TAU); sg.stroke(); }
      // 7 phenolphthalein pink
      blot(896, 384, 70, '230,50,140', 0.4); for (let i = 0; i < 8; i++) blot(896 + rr.range(-100, 100), 384 + rr.range(-100, 100), rr.range(5, 12), '230,40,140', 0.6, 1);
      const stainMat = K.std({ map: TX.toTexture(sc, { wrap: false }), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const geos = [];
      const stain = (s, off, size, cell, rot = rr() * TAU) => {
        const p = at(s, off);
        const g = new T.PlaneGeometry(size, size); cellUV(g, cell, 4, 2);
        g.rotateX(-PI / 2); g.rotateY(rot); g.translate(p.x, 0.08, p.z);
        geos.push(g);
      };
      for (let s = 15; s < L - 10; s += rr.range(18, 34)) stain(s, rr.range(-4.5, 4.5), rr.range(3.5, 7), [0, 1, 2, 4, 5, 6, 7][Math.floor(rr() * 7)]);
      for (const b of BUN.list) { stain(b.s, b.off * 0.6, 11, 3, 0); stain(b.s + 4, b.off * 0.4, 8, 3); }
      const sm = new T.Mesh(BU.mergeGeometries(geos, false), stainMat); sm.renderOrder = 1; sm.receiveShadow = true; K.group.add(sm);
    }

    // ============================================================================================
    // GLASSWARE BUILDERS
    // ============================================================================================
    const lathe = (pts, segs = 40, p0 = 0, pl = TAU) => new T.LatheGeometry(pts.map(([a, b]) => new T.Vector2(Math.max(0.001, a), b)), segs, p0, pl);
    // print band (graduations) on a vessel: partial lathe of profile pts just outside the wall, cell of print atlas
    const printBand = (pts, cell, x, y, z, ry = 0, segs = 20) => {
      const g = lathe(pts, segs, -PRINT_PHI / 2, PRINT_PHI);
      cellUV(g, cell, 4, 1);
      g.rotateY(ry); g.translate(x, y, z);
      return K.add(new T.Mesh(g, printMat), { cast: false });
    };
    const liquidLathe = (pts, mat, x, y, z) => K.mesh(lathe(pts, 32), mat, x, y, z, { cast: false });

    // beaker: radius R, height H, fill fraction, solution colour
    const beaker = (x, z, R, H, fill, col, { ry = 0, y = 0, collide = true, stir = false } = {}) => {
      const t = 0.22;
      const prof = [[0, 0], [R - 0.5, 0], [R, 0.4], [R, H - 0.1], [R + 0.32, H + 0.12], [R + 0.2, H + 0.32], [R - t, H + 0.1], [R - t, 0.5], [R - 0.6, t], [0, t]];
      K.mesh(lathe(prof, 44), glass, x, y, z, { cast: false });
      if (fill > 0) {
        const f = 0.4 + (H - 0.6) * fill;
        liquidLathe([[0, t + 0.02], [R - 0.62, t + 0.02], [R - t - 0.03, 0.55], [R - t - 0.03, f], [0, f]], liquid(col), x, y, z);
        glow(x + 1.5, 0.06, z + 1.5, R * 2.6, R * 2.2, col, 0.18);
      }
      printBand([[R + 0.02, H * 0.12], [R + 0.02, H * 0.92]], 0, x, y, z, ry);
      AO(x, z, R + 0.8, R + 0.8, 0.42);
      if (collide) K.circle(x, z, R + 0.2, y + H);
      return { x, z, R, H };
    };
    const ERL = (Rb, Hc, rn, H) => {
      const t = 0.22;
      return { Rb, Hc, rn, H, prof: [[0, 0], [Rb - 0.6, 0], [Rb, 0.5], [Rb, 0.9], [rn, Hc], [rn, H - 0.3], [rn + 0.28, H - 0.15], [rn + 0.18, H + 0.02], [rn - t, H - 0.05], [rn - t, Hc + 0.15], [Rb - t, 1.0], [Rb - 0.6, t + 0.05], [0, t]] };
    };
    const erlenmeyer = (x, z, sc, fill, col, { ry = 0, y = 0, collide = true, printIt = true } = {}) => {
      const E = ERL(4.3 * sc, 9.2 * sc, 1.45 * sc, 13.4 * sc);
      K.mesh(lathe(E.prof, 44), glass, x, y, z, { cast: false });
      if (fill > 0) {
        const t = 0.22, yf = 0.4 + (E.Hc - 1) * fill;
        const rAt = (yy) => (E.Rb - t - 0.04) + ((E.rn - t - 0.04) - (E.Rb - t - 0.04)) * Math.min(1, (yy - 1.0) / (E.Hc + 0.15 - 1.0));
        liquidLathe([[0, t + 0.02], [E.Rb - 0.62, t + 0.02], [E.Rb - t - 0.04, 1.0], [rAt(yf), yf], [0, yf]], liquid(col), x, y, z);
        glow(x + 1.6, 0.06, z + 1.6, E.Rb * 2.8, E.Rb * 2.4, col, 0.2);
      }
      if (printIt) printBand([[E.Rb + 0.03, 1.4], [E.Rb + 0.03 + (E.rn - E.Rb) * 0.6, 1.4 + (E.Hc - 1.4) * 0.6]], 1, x, y, z, ry);
      AO(x, z, E.Rb + 0.9, E.Rb + 0.9, 0.42);
      if (collide) K.circle(x, z, E.Rb + 0.1, y + E.H);
      return E;
    };
    const rbFlask = (x, z, Rs, fill, col, { y = 0, ring = true, neck = 6 } = {}) => {
      const t = 0.2, rn = Rs * 0.32;
      const out = [], inn = [];
      const a0 = Math.asin(rn / Rs);
      for (let i = 0; i <= 16; i++) { const a = -PI / 2 + (PI - a0) * (i / 16) ; out.push([Math.cos(a) * Rs, Rs + Math.sin(a) * Rs]); }
      const yN = Rs + Math.cos(a0) * Rs;
      out.push([rn, yN + neck], [rn + 0.3, yN + neck + 0.15], [rn + 0.2, yN + neck + 0.35], [rn - t, yN + neck + 0.1], [rn - t, yN]);
      for (let i = 16; i >= 0; i--) { const a = -PI / 2 + (PI - a0) * (i / 16); inn.push([Math.cos(a) * (Rs - t), Rs + Math.sin(a) * (Rs - t)]); }
      K.mesh(lathe(out.concat(inn), 40), glass, x, y, z, { cast: false });
      if (fill > 0) {
        const yf = Rs * 2 * fill, pts = [];
        for (let i = 0; i <= 12; i++) { const yy = 0.25 + (yf - 0.25) * (i / 12); const dy = yy - Rs; pts.push([Math.sqrt(Math.max(0, (Rs - t - 0.05) ** 2 - dy * dy)), yy]); }
        pts.unshift([0, 0.25]); pts.push([0, yf]);
        liquidLathe(pts, liquid(col), x, y, z);
        glow(x + 1.6, 0.06, z + 1.6, Rs * 2.8, Rs * 2.4, col, 0.2);
      }
      if (ring) { K.mesh(new T.TorusGeometry(Rs * 0.55, 0.55, 8, 24), K.std({ color: 0xb08a5a, roughness: 0.85 }), x, 0.5, z, { rx: PI / 2 }); }
      printBand([[Rs + 0.03, Rs * 0.7], [Rs * 0.97 + 0.03, Rs * 1.25]], 3, x, y, z, 0);
      AO(x, z, Rs, Rs, 0.4);
      K.circle(x, z, Rs, y + Rs * 2 + neck);
      return { yN, rn };
    };
    // reagent bottle (narrow neck, screw cap) with an atlas label
    const bottle = (x, z, sc, kind, labelI, { amber = true, cap = 0x1b56b8, ry = 0, fill = 0.7, col = SOL.water } = {}) => {
      const R = 2.9 * sc, H = 10 * sc;
      const prof = [[0, 0], [R - 0.4, 0], [R, 0.4], [R, H * 0.72], [R * 0.6, H * 0.88], [R * 0.4, H * 0.93], [R * 0.4, H]];
      if (amber) K.mesh(lathe(prof, 36), cache('amber', () => K.phys({ color: 0x5a2604, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x2a0e00, emissiveIntensity: 0.4 })), x, 0, z);
      else {
        K.mesh(lathe(prof, 36), glassThick, x, 0, z, { cast: false });
        liquidLathe([[0, 0.3], [R - 0.3, 0.3], [R - 0.3, H * 0.72 * fill], [0, H * 0.72 * fill]], liquid(col, 0.25), x, 0, z);
      }
      K.mesh(new T.CylinderGeometry(R * 0.46, R * 0.46, H * 0.12, 20), plastic(cap, 0.45), x, H * 1.05, z, { cast: false });
      const lg = new T.CylinderGeometry(R + 0.04, R + 0.04, H * 0.42, 28, 1, true, -1.25 + ry, 2.5);
      cellUV(lg, labelI);
      K.mesh(lg, labelMat, x, H * 0.36, z, { cast: false });
      AO(x, z, R + 0.7, R + 0.7, 0.45);
      K.circle(x, z, R, H * 1.1);
    };
    // test tube geometry (shared) and its liquid
    const TT_R = 0.82, TT_H = 13;
    const ttGeo = lathe([[0, 0], [0.45, 0.08], [0.7, 0.32], [TT_R, 0.8], [TT_R, TT_H], [TT_R + 0.12, TT_H + 0.1], [TT_R + 0.04, TT_H + 0.25], [TT_R - 0.14, TT_H + 0.1], [TT_R - 0.14, 0.8], [0.56, 0.38], [0.34, 0.18], [0, 0.12]], 18);
    const ttLiq = new T.CylinderGeometry(TT_R - 0.17, TT_R - 0.17, 1, 14); ttLiq.translate(0, 0.5, 0);
    const ttBot = new T.SphereGeometry(TT_R - 0.17, 12, 5, 0, TAU, PI / 2, PI / 2);

    // ============================================================================================
    // THE MAGNETIC STIRRER CROSSING
    // ============================================================================================
    {
      const p = at(STIR.s, 0), ang = p.angle;
      const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, nz = ca;
      const cx = p.x + nx * STIR.off, cz = p.z + nz * STIR.off; // casing centre = disc centre
      A.stir = { x: cx, z: cz };
      const H = STIR.h;
      K.platform(cx, cz, STIR.half, STIR.wide, ang, H);
      // chamfered ends act as ramps (up on the way in, down on the way out)
      const rl = STIR.ramp;
      K.ramp(cx - ca * (STIR.half + rl / 2), cz - sa * (STIR.half + rl / 2), ang, rl, STIR.wide * 2 - 2, H, 0);
      K.ramp(cx + ca * (STIR.half + rl / 2), cz + sa * (STIR.half + rl / 2), ang + PI, rl, STIR.wide * 2 - 2, H, 0);
      K.spinner(cx, cz, STIR.R, stirAngle, { h: H, fling: 1, pull: 0.55 });
      // stir bar: rotating capsule on the deck
      const bar = STIR.bar;
      K.mover({ type: 'capsule', r: 0.8, h: H + 1.6 }, (t) => { const a = stirAngle(t); return { x1: cx - Math.cos(a) * bar, z1: cz - Math.sin(a) * bar, x2: cx + Math.cos(a) * bar, z2: cz + Math.sin(a) * bar }; });

      // casing: painted aluminium, light grey, with chamfered ends
      const caseMat = K.phys({ color: 0xd3d8de, roughness: 0.38, metalness: 0.15, clearcoat: 0.5, clearcoatRoughness: 0.25 });
      const grp = new T.Group(); grp.position.set(cx, 0, cz); grp.rotation.y = -ang;
      const body = new T.Mesh(new K.RoundedBoxGeometry(STIR.half * 2, H, STIR.wide * 2, 3, 0.35), caseMat); body.position.y = H / 2; grp.add(body);
      const wedge = new T.Shape(); wedge.moveTo(0, 0); wedge.lineTo(rl, 0); wedge.lineTo(0, H); wedge.closePath();
      const wg = new T.ExtrudeGeometry(wedge, { depth: STIR.wide * 2 - 2, bevelEnabled: false }); wg.translate(0, 0, -(STIR.wide - 1));
      for (const sd of [-1, 1]) { const w = new T.Mesh(wg, caseMat); w.position.x = sd * STIR.half; w.rotation.y = sd < 0 ? PI : 0; grp.add(w); }
      // anti-slip rubber strips on the chamfers
      const strip = K.std({ color: 0x2a2c30, roughness: 0.9 });
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const st = new T.Mesh(new T.BoxGeometry(0.6, 0.12, STIR.wide * 2 - 5), strip); const f = 0.25 + i * 0.25; st.position.set(sd * (STIR.half + rl * f), H * (1 - f) + 0.06, 0); st.rotation.z = -sd * Math.atan2(H, rl); grp.add(st); }
      // top: printed panel around the disc
      const tc = TX.makeCanvas(512, 512), tg = tc.getContext('2d');
      tg.fillStyle = '#c9ced5'; tg.fillRect(0, 0, 512, 512);
      tg.fillStyle = '#2b2f36'; tg.font = '700 26px Rubik, Arial'; tg.textAlign = 'center';
      tg.fillText('MAGNETIC STIRRER  ·  MS-300', 256, 34);
      tg.fillStyle = '#d7151d'; tg.font = '700 22px Rubik, Arial'; tg.fillText('⚠ HOT TOP', 256, 64);
      const topT = TX.toTexture(tc, { wrap: false });
      const top = new T.Mesh(new T.PlaneGeometry(STIR.half * 2 - 0.8, STIR.wide * 2 - 0.8), K.std({ map: topT, roughness: 0.4 })); top.rotation.x = -PI / 2; top.rotation.z = PI; top.position.y = H + 0.01; grp.add(top);
      K.add(grp);
      // control knobs and display on the south (off-road) end of the deck
      const knobs = [];
      for (const [lx, lz] of [[-5, -STIR.wide + 3], [5, -STIR.wide + 3]]) {
        knobs.push([cx + ca * lx + nx * lz, cz + sa * lx + nz * lz]);
      }
      for (const [kx, kz] of knobs) {
        warnRoad('stirrer knob', kx, kz, 0.5);
        K.mesh(new T.CylinderGeometry(1.5, 1.7, 1.3, 20), plastic(0x1a1c20, 0.4), kx, H + 0.65, kz);
        K.mesh(new T.BoxGeometry(0.3, 0.2, 1.4), plastic(0xff5a1a, 0.4), kx, H + 1.35, kz + 0.2, { ry: 0.5 });
        K.circle(kx, kz, 1.7, H + 1.3);
      }
      // LCD
      {
        const lc = TX.makeCanvas(256, 96), lg = lc.getContext('2d');
        lg.fillStyle = '#0d1a12'; lg.fillRect(0, 0, 256, 96); lg.fillStyle = '#5cff8a'; lg.font = '700 52px "Courier New", monospace'; lg.textAlign = 'center'; lg.fillText('1100', 110, 66); lg.font = '700 24px Arial'; lg.fillText('rpm', 214, 66);
        const kx = cx + nx * (-STIR.wide + 3), kz = cz + nz * (-STIR.wide + 3);
        const d = K.mesh(new T.PlaneGeometry(6, 2.2), K.std({ map: TX.toTexture(lc, { wrap: false }), emissive: 0xffffff, emissiveMap: TX.toTexture(lc, { wrap: false }), emissiveIntensity: 0.9, roughness: 0.2 }), kx, H + 0.04, kz, { cast: false });
        d.rotation.order = 'YXZ'; d.rotation.y = -ang + PI; d.rotation.x = -PI / 2;
        glow(kx, H + 0.05, kz, 9, 5, 0x40ff80, 0.2, ang);
      }
      // the turning ceramic plate + stir bar (animated)
      const disc = new T.Group(); disc.position.set(cx, 0, cz);
      const dc = TX.makeCanvas(512, 512), dg = dc.getContext('2d');
      dg.fillStyle = '#f2f3f1'; dg.fillRect(0, 0, 512, 512);
      dg.strokeStyle = '#c42a24'; dg.lineWidth = 6; dg.beginPath(); dg.arc(256, 256, 236, 0, TAU); dg.stroke();
      dg.strokeStyle = '#9aa0a6'; dg.lineWidth = 3; for (const rad of [170, 110]) { dg.beginPath(); dg.arc(256, 256, rad, 0, TAU); dg.stroke(); }
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24; dg.lineWidth = i % 6 ? 3 : 7; dg.strokeStyle = i % 6 ? '#9aa0a6' : '#c42a24'; dg.beginPath(); dg.moveTo(256 + Math.cos(a) * 205, 256 + Math.sin(a) * 205); dg.lineTo(256 + Math.cos(a) * 232, 256 + Math.sin(a) * 232); dg.stroke(); }
      dg.fillStyle = 'rgba(180,120,60,0.18)'; dg.beginPath(); dg.arc(300, 210, 60, 0, TAU); dg.fill(); // old burnt ring
      dg.fillStyle = '#c42a24'; dg.font = '700 28px Rubik, Arial'; dg.textAlign = 'center'; dg.fillText('MAX 340 °C', 256, 150); dg.save(); dg.translate(256, 380); dg.rotate(PI); dg.fillText('CERAMIC', 0, 0); dg.restore();
      const plate = new T.Mesh(new T.CylinderGeometry(STIR.R, STIR.R, 0.3, 64), [K.phys({ color: 0xe7e9ea, roughness: 0.2, clearcoat: 0.8 }), K.phys({ map: TX.toTexture(dc, { wrap: false }), roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.08 }), K.phys({ color: 0xe7e9ea, roughness: 0.2 })]);
      plate.position.y = H - 0.1; plate.receiveShadow = true; plate.castShadow = false; disc.add(plate);
      const ptfe = K.phys({ color: 0xf6f6f2, roughness: 0.32, clearcoat: 0.3, sheen: 0.5 });
      const barM = new T.Mesh(new T.CapsuleGeometry(0.8, bar * 2, 6, 16), ptfe); barM.rotation.z = PI / 2; barM.position.y = H + 0.8; barM.castShadow = true; disc.add(barM);
      const pivot = new T.Mesh(new T.TorusGeometry(0.86, 0.14, 8, 20), ptfe); pivot.rotation.y = PI / 2; pivot.position.y = H + 0.8; disc.add(pivot);
      K.group.add(disc); keep.push(disc);
      A.disc = disc;
      AO(cx, cz, STIR.half + 4, STIR.wide + 3, 0.5, ang);
      glow(cx, H + 0.06, cz, STIR.R * 2.2, STIR.R * 2.2, 0xffffff, 0.06);
      // power cable to the back
      const cab = new T.CatmullRomCurve3([new T.Vector3(cx + nx * STIR.wide, 0.6, cz + nz * STIR.wide), new T.Vector3(cx + nx * (STIR.wide + 3) + 4, 0.5, BZN + 4), new T.Vector3(cx + 10, 0.5, BZN + 1)]);
      K.mesh(new T.TubeGeometry(cab, 20, 0.45, 6), plastic(0x1a1a1c, 0.6), 0, 0, 0);
    }

    // ============================================================================================
    // BUNSEN BURNERS (flaring) + gas turret + tubing
    // ============================================================================================
    const ironMat = K.phys({ color: 0x2b2e33, roughness: 0.55, metalness: 0.4, clearcoat: 0.2 });
    const chrome = metal(0xd8dce2, 0.16);
    const brass = metal(0xc9a24a, 0.3);
    const rubberOr = K.phys({ color: 0xe0601a, roughness: 0.55, clearcoat: 0.2, sheen: 0.3 });
    const flameTex = (() => {
      const c = TX.makeCanvas(64, 256), g = c.getContext('2d');
      const q = g.createLinearGradient(0, 256, 0, 0);
      q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.35, 'rgba(255,255,255,0.8)'); q.addColorStop(0.8, 'rgba(255,255,255,0.25)'); q.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = q; g.fillRect(0, 0, 64, 256);
      return TX.toTexture(c, { wrap: false, srgb: false });
    })();
    const haloTex = (() => { const c = TX.makeCanvas(128, 128), g = c.getContext('2d'); const q = g.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.25, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); return TX.toTexture(c, { wrap: false }); })();
    const flameProf = (n = 14) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([Math.max(0.001, Math.sin(Math.min(1, t * 1.4) * PI * 0.5) * (1 - t) ** 0.8), t]); } return pts; };
    const flameGeo = lathe(flameProf(), 20);
    const burner = (x, z, { flaring = false, ph = 0 } = {}) => {
      const g = new T.Group(); g.position.set(x, 0, z);
      const base = new T.Mesh(lathe([[0, 0], [4.2, 0], [4.3, 0.3], [3.8, 0.9], [1.6, 1.6], [0.9, 1.9], [0, 1.9]], 32), ironMat); g.add(base);
      const barrel = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 12, 20), chrome); barrel.position.y = 7.6; g.add(barrel);
      const collar = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 1.6, 20), brass); collar.position.y = 3.0; g.add(collar);
      const hole = new T.Mesh(new T.BoxGeometry(0.5, 0.7, 1.8), K.std({ color: 0x0a0a0a })); hole.position.set(0, 3.0, 0); g.add(hole);
      const inlet = new T.Mesh(new T.CylinderGeometry(0.35, 0.42, 3.4, 12), brass); inlet.rotation.z = PI / 2; inlet.position.set(-2.2, 2.2, 0); g.add(inlet);
      const top = new T.Mesh(new T.TorusGeometry(0.62, 0.1, 6, 16), chrome); top.rotation.x = PI / 2; top.position.y = 13.6; g.add(top);
      K.add(g);
      AO(x, z, 5, 5, 0.5);
      K.circle(x, z, 4.1, 2.2); K.circle(x, z, 0.9, 14);
      // flames: inner cone (bright blue), outer mantle (violet blue), luminous yellow flare
      const mk = (color, op) => new T.MeshBasicMaterial({ color, map: flameTex, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
      const fg = new T.Group(); fg.position.set(x, 13.6, z);
      const inner = new T.Mesh(flameGeo, mk(0x5fb8ff, 0.95)); inner.scale.set(0.55, 2.4, 0.55); fg.add(inner);
      const outer = new T.Mesh(flameGeo, mk(0x3a5cff, 0.8)); outer.scale.set(0.95, 5.2, 0.95); fg.add(outer);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: 0x3a6aff, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, fog: false })); halo.scale.set(5, 7, 1); halo.position.y = 2.5; fg.add(halo);
      const yel = new T.Mesh(flameGeo, mk(0xff6a10, 0.85)); yel.scale.set(1.6, 0.1, 1.6); yel.visible = false; fg.add(yel);
      const yel2 = new T.Mesh(flameGeo, mk(0xffc230, 0.8)); yel2.scale.set(0.9, 0.1, 0.9); yel2.visible = false; fg.add(yel2);
      K.group.add(fg); keep.push(fg);
      const gi = glow(x, 0.12, z, flaring ? BUN.R * 2.1 : 16, flaring ? BUN.R * 2.1 : 16, 0x4a70ff, 0.25);
      const light = new T.PointLight(0x6a8cff, 0, 46, 1); light.position.set(x, 16, z); K.group.add(light);
      return { x, z, ph, flaring, fg, inner, outer, yel, yel2, halo, gi, light, hit: new Set(), last: 0 };
    };
    {
      // gas service turret in the infield south of the straight, with two taps
      const tp = at(414, -25);
      warnRoad('turret', tp.x, tp.z, 3);
      const turret = new T.Group(); turret.position.set(tp.x, 0, tp.z);
      const col = new T.Mesh(new T.CylinderGeometry(2.6, 3.0, 9, 24), K.phys({ color: 0xe8ebee, roughness: 0.35, clearcoat: 0.5 })); col.position.y = 4.5; turret.add(col);
      const cap = new T.Mesh(new T.SphereGeometry(2.6, 24, 10, 0, TAU, 0, PI / 2), K.phys({ color: 0xe8ebee, roughness: 0.35 })); cap.position.y = 9; turret.add(cap);
      for (const sd of [-1, 1]) {
        const tap = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 3.4, 12), brass); tap.rotation.z = PI / 2; tap.position.set(sd * 3.4, 6.5, 0); turret.add(tap);
        const handle = new T.Mesh(new T.BoxGeometry(0.5, 2.4, 0.9), plastic(0xf2c21a, 0.4)); handle.position.set(sd * 3.0, 7.9, 0); turret.add(handle);
        const nozzle = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 1.6, 10), brass); nozzle.rotation.z = PI / 2; nozzle.position.set(sd * 5.6, 6.5, 0); turret.add(nozzle);
      }
      const lb = TX.makeCanvas(128, 64), lbg = lb.getContext('2d'); lbg.fillStyle = '#f2c21a'; lbg.fillRect(0, 0, 128, 64); lbg.fillStyle = '#111'; lbg.font = '700 34px Rubik, Arial'; lbg.textAlign = 'center'; lbg.fillText('GAS', 64, 46);
      const lbm = new T.Mesh(new T.CylinderGeometry(3.02, 3.02, 2.2, 24, 1, true, -0.7, 1.4), K.std({ map: TX.toTexture(lb, { wrap: false }), roughness: 0.5 })); lbm.position.y = 3; turret.add(lbm);
      K.add(turret);
      AO(tp.x, tp.z, 4.5, 4.5, 0.5);
      K.circle(tp.x, tp.z, 3, 10);
      // burners and their orange tubing to the taps
      for (const b of BUN.list) {
        const q = at(b.s, b.off);
        warnRoad('burner', q.x, q.z, 4.5);
        const B = burner(q.x, q.z, { flaring: true, ph: b.ph });
        const c0 = at(b.s, 0), dl = Math.hypot(c0.x - q.x, c0.z - q.z); B.ux = (c0.x - q.x) / dl; B.uz = (c0.z - q.z) / dl;
        A.burners.push(B);
        const inX = q.x - 4, inZ = q.z;
        let curve;
        if (b.off < 0) {
          const tapX = tp.x - 6.4, tapZ = tp.z;
          const mid = new T.Vector3((inX + tapX) / 2 - 3, 0.7, (inZ + tapZ) / 2);
          curve = new T.CatmullRomCurve3([new T.Vector3(inX + 1.4, 2.2, inZ), new T.Vector3(inX - 1.5, 0.8, inZ + 1), mid, new T.Vector3(tapX - 0.6, 1.6, tapZ), new T.Vector3(tapX, 6.5, tapZ)]);
        } else {
          // tap on the fume cupboard's front sill
          const tx = q.x - 7, tz = BZN + 0.2;
          const tap = new T.Group(); tap.position.set(tx, 2.4, tz);
          const body = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 3, 12), brass); body.rotation.x = PI / 2; tap.add(body);
          const nozzle = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 1.6, 10), brass); nozzle.rotation.x = PI / 2; nozzle.position.z = 2.2; tap.add(nozzle);
          const handle = new T.Mesh(new T.BoxGeometry(0.9, 2.4, 0.5), plastic(0xf2c21a, 0.4)); handle.position.set(0, 1.3, 0.6); tap.add(handle);
          K.add(tap);
          curve = new T.CatmullRomCurve3([new T.Vector3(inX + 1.4, 2.2, inZ), new T.Vector3(inX - 1.5, 0.8, inZ - 1), new T.Vector3(tx + 1, 0.7, (inZ + tz) / 2 - 2), new T.Vector3(tx, 1.4, tz + 4.5), new T.Vector3(tx, 2.4, tz + 3)]);
        }
        K.mesh(new T.TubeGeometry(curve, 40, 0.55, 8), rubberOr, 0, 0, 0);
      }
      // spent matches and a striker near the burners
      const mts = [];
      for (let i = 0; i < 9; i++) { const q = at(405 + rr() * 50, (rr() < 0.5 ? -1 : 1) * (8.5 + rr() * 8)); if (K.offRoad(q.x, q.z, 0.3)) mts.push({ x: q.x, y: 0.15, z: q.z, ry: rr() * TAU }); }
      const mg = new T.CylinderGeometry(0.1, 0.1, 3.4, 5); mg.rotateZ(PI / 2);
      K.instances(mg, K.std({ color: 0xd8b07a, roughness: 0.8 }), mts, { cast: true });
      K.instances(new T.SphereGeometry(0.22, 6, 4), K.std({ color: 0x1a1410, roughness: 0.9 }), mts.map((m) => ({ x: m.x + Math.cos(-m.ry) * 1.7, y: 0.2, z: m.z + Math.sin(-m.ry) * 1.7, s: 0.8 })), { cast: false });
    }

    // ============================================================================================
    // ELEPHANT TOOTHPASTE (hairpin)
    // ============================================================================================
    {
      const { x, z } = FOAM;
      // plastic demo tray
      K.mesh(lathe([[0, 0], [9.2, 0], [9.6, 0.9], [9.3, 1.0], [8.9, 0.25], [0, 0.25]], 48), plastic(0x9a9ea6, 0.45), x, 0, z);
      AO(x, z, 10.5, 10.5, 0.5);
      const E = ERL(6.0, 13, 2.0, 19.5);
      K.mesh(lathe(E.prof, 48), glassThick, x, 0.25, z, { cast: false });
      printBand([[E.Rb + 0.03, 1.6], [E.Rb + 0.03 + (E.rn - E.Rb) * 0.55, 1.6 + (E.Hc - 1.6) * 0.55]], 1, x, 0.25, z, 0);
      K.circle(x, z, 6.1, 20);
      // KI / peroxide mix inside, and a foam level that rises while it bubbles
      liquidLathe([[0, 0.5], [5.3, 0.5], [5.7, 1.2], [5.2, 2.8], [0, 2.8]], liquid(0xf3e2a0, 0.25), x, 0.25, z);
      const fillProf = []; for (let i = 0; i <= 8; i++) { const yy = 2.8 + (E.H - 3.5) * (i / 8); const rad = yy < E.Hc ? (E.Rb - 0.3) + ((E.rn - 0.25) - (E.Rb - 0.3)) * Math.min(1, (yy - 1) / (E.Hc - 1)) : E.rn - 0.25; fillProf.push([rad, yy]); }
      fillProf.unshift([0, 2.8]); fillProf.push([0, E.H - 0.7]);
      // foam texture: white foam with coloured food-colouring streaks
      const fc = TX.makeCanvas(512, 512), fg = fc.getContext('2d');
      fg.fillStyle = '#ffd77a'; fg.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 70; i++) {
        const cc = ['255,70,160', '255,150,40', '60,150,255', '255,240,200'][i % 4], bx = rr() * 512, by = rr() * 512, br = 30 + rr() * 60;
        for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) { const q = fg.createRadialGradient(bx + ox, by + oy, 0, bx + ox, by + oy, br); q.addColorStop(0, `rgba(${cc},0.6)`); q.addColorStop(1, `rgba(${cc},0)`); fg.fillStyle = q; fg.fillRect(bx + ox - br, by + oy - br, br * 2, br * 2); }
      }
      for (let i = 0; i < 900; i++) { const bx = rr() * 512, by = rr() * 512, br = 2 + rr() * rr() * 14; fg.strokeStyle = `rgba(150,140,150,${0.25 + rr() * 0.25})`; fg.lineWidth = 1.2; fg.beginPath(); fg.arc(bx, by, br, 0, TAU); fg.stroke(); fg.fillStyle = 'rgba(255,255,255,0.6)'; fg.beginPath(); fg.arc(bx - br * 0.3, by - br * 0.3, br * 0.25, 0, TAU); fg.fill(); }
      const foamT = TX.toTexture(fc, { repeat: [3, 2] });
      const fh = TX.noiseField(128, { seed: 33, period: 8, oct: 3 });
      const foamN = TX.toTexture(TX.normalFromHeight(fh, 128, 128, 3), { srgb: false }); foamN.repeat.set(4, 3);
      const foamMat = K.phys({ map: foamT, normalMap: foamN, normalScale: V2(1.2), roughness: 0.55, sheen: 0.8, sheenColor: new T.Color(0xffffff), clearcoat: 0.3, clearcoatRoughness: 0.5 });
      const inFoam = new T.Mesh(lathe(fillProf, 32), foamMat); inFoam.position.set(x, 0.25, z); K.add(inFoam); keep.push(inFoam);
      inFoam.scale.y = 0.05;
      // the spreading foam pile: lumpy dome of unit radius
      const NA = 72, NR = 12, pos = [], uvs = [], idx = [];
      for (let j = 0; j <= NR; j++) {
        const rf = j / NR;
        for (let i = 0; i <= NA; i++) {
          const a = (i / NA) * TAU;
          const edge = 1 + 0.1 * Math.sin(a * 5 + 1.3) + 0.06 * Math.sin(a * 11 + 0.2) + 0.04 * Math.sin(a * 17);
          const rad = (0.25 + 0.75 * rf) * edge;
          const hgt = j === NR ? 0.02 : (0.11 + 0.87 * Math.pow(1 - rf, 2.2) + 0.1 * Math.exp(-(((rf - 0.86) / 0.07) ** 2))) * (1 + 0.12 * Math.sin(a * 5 + rf * 7) + 0.04 * Math.sin(a * 11 - rf * 5));
          pos.push(Math.cos(a) * rad, hgt, Math.sin(a) * rad); uvs.push(Math.cos(a) * rad * 1.6, Math.sin(a) * rad * 1.6);
        }
      }
      for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + NA + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); pg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); pg.setIndex(idx); pg.computeVertexNormals();
      const pile = new T.Mesh(pg, foamMat); pile.position.set(x, 0.2, z); pile.castShadow = true; pile.receiveShadow = true; K.group.add(pile); keep.push(pile);
      // bubbly lumps on the pile (instanced, children of a group scaled with it)
      // the erupting column: a fat foam tube out of the neck that curls over
      const ny = 0.25 + E.H;
      const col = new T.CatmullRomCurve3([new T.Vector3(0, ny - 1, 0), new T.Vector3(0.3, ny + 4, 0.2), new T.Vector3(1.2, ny + 8, 0.8), new T.Vector3(3.5, ny + 9.5, 2.5), new T.Vector3(6, ny + 6, 4.5), new T.Vector3(7.5, ny + 1, 6), new T.Vector3(8, 1.2, 7)]);
      const tg = new T.TubeGeometry(col, 60, 1.9, 12, false);
      const tube = new T.Mesh(tg, foamMat); tube.position.set(x, 0, z); tube.castShadow = true; K.group.add(tube); keep.push(tube);
      A.foam = { pile, tube, tubeCount: tg.index.count, inFoam, x, z, ny, bubT: 0 };
      A.foamSurf = K.surface('sticky', { x, z, r: FOAM.R0 });
      // demo props between the legs: peroxide bottle, KI beaker, dish soap, food colouring, goggles
      bottle(-12, -40, 1.0, 'b', 6, { amber: false, cap: 0xd02a2a, fill: 0.8, col: 0xe8f4f6 });
      beaker(-21, -33, 3.3, 6.2, 0.5, SOL.ki, { ry: 0.3 });
      // dish soap bottle
      K.mesh(lathe([[0, 0], [2.0, 0], [2.2, 0.4], [2.2, 7], [1.4, 8.6], [0.6, 9.2], [0.5, 10.4]], 24), K.phys({ color: 0x2fc06a, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.88 }), -4, 0, -46);
      K.mesh(new T.CylinderGeometry(0.7, 0.9, 1.8, 14), plastic(0xffffff, 0.4), -4, 11, -46);
      AO(-4, -46, 2.8, 2.8, 0.45); K.circle(-4, -46, 2.3, 11);
      // food colouring droppers
      for (const [i, cc] of [[0, 0xff3a8a], [1, 0xffd23a], [2, 0x3a8aff]]) {
        const bx = -24 + i * 3.4, bz = -48 + i * 0.6;
        K.mesh(new T.CylinderGeometry(1.0, 1.0, 3.2, 14), K.phys({ color: cc, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.9 }), bx, 1.6, bz);
        K.mesh(new T.ConeGeometry(0.8, 1.8, 12), plastic(0xffffff, 0.35), bx, 4.1, bz);
        AO(bx, bz, 1.5, 1.5, 0.4);
      }
      K.capsule(-24, -48, -17.2, -46.8, 1.2, 4);
    }

    // ============================================================================================
    // SPILLS: acid (slick) after the notebook jump, slime (sticky) in the NE corner, crystals (rough) SW
    // ============================================================================================
    {
      // notebook ramp
      const p = at(JUMP.s, JUMP.off), ang = p.angle;
      K.ramp(p.x, p.z, ang, JUMP.len, JUMP.wid, JUMP.h, 0);
      const nc = TX.makeCanvas(512, 384), ng = nc.getContext('2d');
      const cg = ng.createLinearGradient(0, 0, 512, 384); cg.addColorStop(0, '#1d2a4a'); cg.addColorStop(1, '#141c33'); ng.fillStyle = cg; ng.fillRect(0, 0, 512, 384);
      ng.fillStyle = '#0d1222'; ng.fillRect(0, 0, 54, 384);
      ng.fillStyle = '#f0ece0'; ng.fillRect(150, 110, 300, 150); ng.strokeStyle = '#1d2a4a'; ng.lineWidth = 4; ng.strokeRect(160, 120, 280, 130);
      ng.fillStyle = '#1d2a4a'; ng.font = '700 34px Rubik, Arial'; ng.textAlign = 'center'; ng.fillText('LAB NOTEBOOK', 300, 160);
      ng.font = '20px Arial'; ng.fillText('Chemistry · Year 11', 300, 190);
      hand(ng, 'J. Weber   Set B', 210, 236, 26, '#1c3a8c');
      const coverT = TX.toTexture(nc, { wrap: false });
      const nb = new T.Group();
      const slab = new T.Mesh(new K.RoundedBoxGeometry(JUMP.len + 0.6, 1.0, JUMP.wid + 0.4, 2, 0.25), K.std({ color: 0x182240, roughness: 0.6 }));
      slab.position.y = -0.55; nb.add(slab);
      const pages = new T.Mesh(new T.BoxGeometry(JUMP.len - 0.2, 0.7, JUMP.wid - 0.4), K.std({ color: 0xece6d6, roughness: 0.9 })); pages.position.set(0.3, -0.55, 0); nb.add(pages);
      const cov = new T.Mesh(new T.PlaneGeometry(JUMP.len + 0.4, JUMP.wid + 0.2), K.std({ map: coverT, roughness: 0.55 })); cov.rotation.x = -PI / 2; cov.position.y = -0.04; nb.add(cov);
      nb.position.set(p.x, JUMP.h / 2, p.z); nb.rotation.order = 'YZX'; nb.rotation.y = -ang; nb.rotation.z = Math.atan2(JUMP.h, JUMP.len);
      K.add(nb);
      // box of pipette tips holding it up
      const ex = p.x + Math.cos(ang) * (JUMP.len / 2 - 1.0), ez = p.z + Math.sin(ang) * (JUMP.len / 2 - 1.0);
      K.mesh(new K.RoundedBoxGeometry(2.0, 1.95, JUMP.wid - 1.5, 2, 0.25), plastic(0x2a6fd8, 0.3), ex, 0.98, ez, { ry: -ang });
      AO(p.x, p.z, JUMP.len * 0.6, JUMP.wid * 0.55, 0.35, ang);
      // acid spill past the ramp + tipped bottle of HCl, fuming
      const sp = at(JUMP.s + 16, -0.3);
      const acidMat = K.phys({ color: 0xd2e8a4, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.72, envMapIntensity: 2.4, depthWrite: false, emissive: 0x2a3a10, emissiveIntensity: 0.25 });
      const spill = K.spill(sp.x, sp.z, 7.2, acidMat, { lump: 0.28, stretch: 1.05, angle: sp.angle, y: 0.16, thick: 0.08 });
      K.surface('slick', { poly: spill.poly });
      spill.mesh.renderOrder = 2;
      // trail to the tipped bottle on the infield side
      const bp = at(JUMP.s + 19, -14.5);
      K.spill((sp.x + bp.x) / 2, (sp.z + bp.z) / 2, 2.6, acidMat, { lump: 0.3, stretch: 2.4, angle: Math.atan2(bp.z - sp.z, bp.x - sp.x), y: 0.14, thick: 0.06 }).mesh.renderOrder = 2;
      // HCl bottle lying on its side, mouth towards the spill
      const dir = Math.atan2(sp.z - bp.z, sp.x - bp.x);
      const bg = new T.Group();
      const R = 3.0, H = 10.5;
      const prof = [[0, 0], [R - 0.4, 0], [R, 0.4], [R, H * 0.72], [R * 0.6, H * 0.88], [R * 0.4, H * 0.93], [R * 0.4, H]];
      const bm = new T.Mesh(lathe(prof, 32), glassThick); bm.rotation.z = -PI / 2; bm.position.set(-H / 2, R, 0); bg.add(bm);
      const lq = new T.Mesh(new T.CylinderGeometry(R - 0.35, R - 0.35, H * 0.68, 20), liquid(0xe8f0c8, 0.15)); lq.rotation.z = -PI / 2; lq.scale.set(1, 1, 0.55); lq.position.set(-H / 2 + H * 0.36, (R - 0.35) * 0.6 + 0.3, 0); bg.add(lq);
      const lgeo = new T.CylinderGeometry(R + 0.04, R + 0.04, H * 0.42, 24, 1, true, -PI / 2 - 1.5, 3.0); cellUV(lgeo, 0);
      const lb = new T.Mesh(lgeo, labelMat); lb.rotation.z = -PI / 2; lb.position.set(-H / 2 + H * 0.36, R, 0); bg.add(lb);
      bg.position.set(bp.x, 0, bp.z); bg.rotation.y = -dir;
      K.add(bg);
      const capx = bp.x + Math.cos(dir) * 9, capz = bp.z + Math.sin(dir) * 9 + 3;
      K.mesh(new T.CylinderGeometry(1.25, 1.25, 1.3, 18), plastic(0xc82020, 0.45), capx, 0.65, capz, { rz: 0.1 });
      AO(bp.x, bp.z, 6.5, 3.6, 0.45, dir);
      K.capsule(bp.x - Math.cos(dir) * 5, bp.z - Math.sin(dir) * 5, bp.x + Math.cos(dir) * 4, bp.z + Math.sin(dir) * 4, R, 6);
      warnRoad('HCl bottle', bp.x + Math.cos(dir) * 5, bp.z + Math.sin(dir) * 5, 0.5);
      A.fume = { x: sp.x, z: sp.z, bx: bp.x + Math.cos(dir) * 5.5, bz: bp.z + Math.sin(dir) * 5.5, t: 0 };
    }
    {
      // slime: a beaker knocked over in the NE corner, green PVA slime oozing onto the inside line
      const sp = at(372, -3.8);
      const slimeMat = K.phys({ color: 0x2fb83a, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, opacity: 0.88, emissive: 0x0f4a0a, emissiveIntensity: 0.3 });
      const s1 = K.spill(sp.x, sp.z, 5.4, slimeMat, { lump: 0.45, stretch: 1.3, angle: sp.angle + 0.4, y: 0.4, thick: 0.4 });
      K.surface('sticky', { poly: s1.poly });
      const bp = at(377, -17);
      const dir = Math.atan2(sp.z - bp.z, sp.x - bp.x);
      K.spill((sp.x + bp.x) / 2, (sp.z + bp.z) / 2, 3.2, slimeMat, { lump: 0.4, stretch: 2.2, angle: dir, y: 0.35, thick: 0.35 });
      const bg = new T.Group();
      const R = 3.8, H = 7.8, t = 0.22;
      const prof = [[0, 0], [R - 0.5, 0], [R, 0.4], [R, H - 0.1], [R + 0.32, H + 0.12], [R + 0.2, H + 0.32], [R - t, H + 0.1], [R - t, 0.5], [R - 0.6, t], [0, t]];
      const bk = new T.Mesh(lathe(prof, 40), glass); bk.rotation.z = -PI / 2; bk.position.set(-H / 2, R + 0.3, 0); bg.add(bk);
      const gl = new T.Mesh(new T.SphereGeometry(2.6, 16, 12), slimeMat); gl.scale.set(1.4, 0.6, 1); gl.position.set(1.5, 1.2, 0); bg.add(gl);
      bg.position.set(bp.x, 0, bp.z); bg.rotation.y = -dir; K.add(bg);
      AO(bp.x, bp.z, 5.5, 4.5, 0.4, dir);
      K.capsule(bp.x - Math.cos(dir) * 4, bp.z - Math.sin(dir) * 4, bp.x + Math.cos(dir) * 3, bp.z + Math.sin(dir) * 3, R, 7.8);
      bottle(bp.x - 9, bp.z - 6, 0.95, 'b', 15, { amber: false, cap: 0x2a9a3a, fill: 0.55, col: 0x3ad040 });
      glow(sp.x, 0.5, sp.z, 16, 12, 0x40ff40, 0.1, sp.angle);
    }
    {
      // copper sulfate crystals spilled from a watch glass across the SW corner
      const sp = at(841, -2.5);
      const poly = K.blobOutline(rr, sp.x, sp.z, 6.8, 0.35, 32, 1.5, sp.angle);
      K.surface('rough', { poly });
      const cry = [];
      const inPoly = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
      for (let i = 0; i < 420; i++) {
        const x = sp.x + rr.range(-12, 12), z = sp.z + rr.range(-12, 12);
        if (!inPoly(x, z) && rr() > 0.04) continue;
        cry.push({ x, y: 0.25, z, ry: rr() * TAU, rx: rr.range(-0.5, 0.5), rz: rr.range(-0.5, 0.5), sx: rr.range(0.3, 0.6), sy: rr.range(0.28, 0.5), sz: rr.range(0.25, 0.45), color: [0x1a6fe0, 0x2a8af0, 0x1258c0, 0x3a9cff][Math.floor(rr() * 4)] });
      }
      const cg = new T.DodecahedronGeometry(1, 0); cg.scale(1.4, 0.9, 0.85);
      K.instances(cg, K.phys({ color: 0xffffff, roughness: 0.08, clearcoat: 1, emissive: 0x0a3a80, emissiveIntensity: 0.35, transparent: false }), cry, { colors: true, cast: false });
      // the watch glass, tipped, with the rest of the crystals
      const wp = at(838, -19);
      warnRoad('watch glass', wp.x, wp.z, 1);
      const wg = new T.Mesh(new T.SphereGeometry(9, 32, 6, 0, TAU, PI - 0.6, 0.6), mkGlass(0xeef6ff, 0.12, 0.55, { side: T.DoubleSide })); wg.position.set(wp.x, 8.6, wp.z); wg.rotation.x = 0.12; K.add(wg, { cast: false });
      const pile = []; for (let i = 0; i < 70; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * 3.2; pile.push({ x: wp.x + Math.cos(a) * d, y: 0.5 + (3.2 - d) * 0.2, z: wp.z + Math.sin(a) * d, ry: rr() * TAU, rx: rr(), rz: rr(), s: rr.range(0.4, 0.8), color: [0x1f7ee6, 0x2a96f2, 0x1662c8][i % 3] }); }
      K.instances(cg, K.phys({ color: 0xffffff, roughness: 0.08, clearcoat: 1, emissive: 0x0a3a80, emissiveIntensity: 0.35 }), pile, { colors: true, cast: true });
      AO(wp.x, wp.z, 5, 5, 0.3);
      glow(wp.x, 0.1, wp.z, 14, 14, 0x2a8aff, 0.12);
      // brass spatula lying next to it
      const spg = new T.Group();
      const blade = new T.Mesh(new K.RoundedBoxGeometry(5, 0.15, 1.4, 2, 0.06), metal(0xcfd3d8, 0.2)); blade.position.x = 7; spg.add(blade);
      const shaft = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 10, 8), metal(0xcfd3d8, 0.2)); shaft.rotation.z = PI / 2; spg.add(shaft);
      spg.position.set(wp.x + 5, 0.3, wp.z - 6); spg.rotation.y = 0.6; K.add(spg);
    }

    // ============================================================================================
    // TEST-TUBE RACK SLALOM (east side) + beakers on the outside of each bend
    // ============================================================================================
    const rackMat = plastic(0x2b7bd6, 0.42);
    const holeTex = (() => { const c = TX.makeCanvas(512, 64), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 64); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(42 + i * 85.3, 32, 19, 0, TAU); g.fill(); } return TX.toTexture(c, { wrap: false }); })();
    const plateMat = K.phys({ color: 0x2b7bd6, roughness: 0.42, clearcoat: 0.3, alphaMap: holeTex, alphaTest: 0.5, side: T.DoubleSide });
    const ttList = [], ttLiqList = [];
    const rack = (x, z, ang, n = 6, colors = UI) => {
      const len = n * 3.2 + 1.6;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -ang;
      for (const yy of [5.2, 2.6]) { const pl = new T.Mesh(new T.PlaneGeometry(len - 1, 3.6), plateMat); pl.rotation.x = -PI / 2; pl.position.y = yy; g.add(pl); for (const sd of [-1, 1]) { const rim = new T.Mesh(new T.BoxGeometry(len - 1, 0.5, 0.3), rackMat); rim.position.set(0, yy - 0.2, sd * 1.8); g.add(rim); } }
      const bot = new T.Mesh(new K.RoundedBoxGeometry(len, 0.4, 4.0, 2, 0.15), rackMat); bot.position.y = 0.2; g.add(bot);
      for (const sd of [-1, 1]) { const e = new T.Mesh(new K.RoundedBoxGeometry(0.6, 5.6, 4.0, 2, 0.2), rackMat); e.position.set(sd * (len / 2 - 0.3), 2.8, 0); g.add(e); }
      K.add(g);
      const c = Math.cos(ang), s = Math.sin(ang);
      for (let i = 0; i < n; i++) {
        const lx = (i - (n - 1) / 2) * ((len - 1) / 6);
        if (rr() < 0.12) continue;
        const tx = x + c * lx, tz = z + s * lx;
        ttList.push({ x: tx, y: 0.5, z: tz, ry: rr() * TAU });
        const fill = rr.range(0.5, 0.78);
        ttLiqList.push({ x: tx, y: 0.5 + 0.82, z: tz, sx: 1, sy: TT_H * fill, sz: 1, color: colors[(i * 2 + Math.floor(rr() * 2)) % colors.length] });
      }
      AO(x, z, len / 2 + 1.5, 3.6, 0.45, ang);
      K.box(x, z, len / 2, 2.2, ang, 6);
    };
    {
      // apexes of the slalom: inside of each bend gets a rack, outside a beaker (narrow gates)
      const apex = [270, 300, 330];
      for (const s0 of apex) {
        const p = track.at(s0), sg = Math.sign(p.curv) || 1;
        const q = at(s0, sg * (p.w / 2 + 3.3));
        warnRoad('rack', q.x, q.z, 2);
        rack(q.x, q.z, p.angle, 6, s0 === 300 ? UI.slice().reverse() : UI);
        const o = at(s0 + 6, -sg * (p.w / 2 + 4.2));
        warnRoad('gate beaker', o.x, o.z, 3);
        beaker(o.x, o.z, 3.6, 7.2, rr.range(0.4, 0.7), [SOL.cuso4, SOL.kmno4, SOL.dichro][apex.indexOf(s0)], { ry: 0 });
      }
      // a fourth rack before the slalom on the outside of the SE sweeper and a test tube holder
      const p4 = at(236, 12.5); rack(p4.x, p4.z, at(236).angle, 5, [SOL.cobalt, SOL.nickel, SOL.cuso4, SOL.fecl3, SOL.kmno4]);
      // loose tubes lying around
      for (const [s0, off] of [[284, 10.5], [318, -10.5], [258, -9.5]]) { const q = at(s0, off); ttList.push({ x: q.x, y: TT_R, z: q.z, rz: PI / 2, ry: rr() * TAU }); }
    }

    // ============================================================================================
    // FUME CUPBOARD (north edge, behind the Bunsen straight) and REAGENT SHELF
    // ============================================================================================
    {
      const x0 = 18, x1 = 118, zf = BZN - 1.5, D = 46;
      const W0 = x1 - x0, xc = (x0 + x1) / 2;
      const white = K.phys({ color: 0xe9ecef, roughness: 0.4, clearcoat: 0.4 });
      const steel = metal(0xb9bec4, 0.3);
      // work surface (white ceramic), interior walls lit, baffle slots
      K.mesh(new T.BoxGeometry(W0, 2, D), K.phys({ color: 0xdfe3e6, roughness: 0.35, clearcoat: 0.3 }), xc, -1, zf - D / 2, { cast: false });
      const inC = TX.makeCanvas(512, 256), ig = inC.getContext('2d');
      const igr = ig.createLinearGradient(0, 0, 0, 256); igr.addColorStop(0, '#f6f9ff'); igr.addColorStop(1, '#c9d3dc'); ig.fillStyle = igr; ig.fillRect(0, 0, 512, 256);
      ig.fillStyle = 'rgba(40,50,60,0.55)'; for (let i = 0; i < 3; i++) ig.fillRect(20, 40 + i * 80, 472, 10);
      const inT = TX.toTexture(inC, { wrap: false });
      K.mesh(new T.PlaneGeometry(W0, 70), K.std({ map: inT, emissive: 0xdfe8ff, emissiveMap: inT, emissiveIntensity: 0.55, roughness: 0.6 }), xc, 35, zf - D + 0.5, { cast: false });
      for (const sd of [-1, 1]) K.mesh(new T.PlaneGeometry(D, 70), K.std({ color: 0xdfe5ec, emissive: 0xcfdcf0, emissiveIntensity: 0.25, roughness: 0.6 }), xc + sd * W0 / 2, 35, zf - D / 2, { ry: -sd * PI / 2, cast: false });
      // posts, airfoil sill, sash frame
      for (const sx of [x0, x1]) K.mesh(new T.BoxGeometry(5, 90, 6), white, sx, 45, zf - 1);
      K.mesh(new T.CylinderGeometry(1.4, 1.4, W0, 16, 1, false, 0, PI), steel, xc, 0.6, zf + 0.2, { rz: PI / 2 });
      const sashY = 15;
      K.mesh(new K.RoundedBoxGeometry(W0 - 4, 2.6, 2.2, 2, 0.5), steel, xc, sashY, zf - 0.5);
      K.mesh(new T.CylinderGeometry(0.6, 0.6, W0 - 14, 12), metal(0xe0e3e8, 0.15), xc, sashY - 1.6, zf + 1.2, { rz: PI / 2 });
      const sash = new T.Mesh(new T.PlaneGeometry(W0 - 4, 60), mkGlass(0xdcecf4, 0.08, 0.3)); sash.position.set(xc, sashY + 31, zf - 0.5); K.add(sash, { cast: false });
      // airflow monitor + label
      const mc = TX.makeCanvas(256, 256), mg = mc.getContext('2d');
      mg.fillStyle = '#e9ecef'; mg.fillRect(0, 0, 256, 256); mg.fillStyle = '#1b1d22'; mg.fillRect(24, 24, 208, 90);
      mg.fillStyle = '#6dff8a'; mg.font = '700 40px "Courier New", monospace'; mg.textAlign = 'center'; mg.fillText('0.52 m/s', 128, 84);
      mg.fillStyle = '#2b2f36'; mg.font = '700 22px Rubik, Arial'; mg.fillText('AIRFLOW OK', 128, 150); mg.fillStyle = '#2bd24a'; mg.beginPath(); mg.arc(70, 200, 16, 0, TAU); mg.fill(); mg.fillStyle = '#d0d0d0'; mg.beginPath(); mg.arc(186, 200, 16, 0, TAU); mg.fill();
      K.mesh(new T.PlaneGeometry(4.6, 4.6), K.std({ map: TX.toTexture(mc, { wrap: false }), emissive: 0xffffff, emissiveMap: TX.toTexture(mc, { wrap: false }), emissiveIntensity: 0.35 }), x1, 26, zf + 2.05, { cast: false });
      const sc2 = TX.makeCanvas(512, 96), sg2 = sc2.getContext('2d');
      sg2.fillStyle = '#f2c21a'; sg2.fillRect(0, 0, 512, 96); sg2.fillStyle = '#111'; sg2.font = '700 34px Rubik, Arial'; sg2.textAlign = 'center'; sg2.fillText('FUME CUPBOARD · KEEP SASH LOW', 256, 60);
      K.mesh(new T.PlaneGeometry(36, 6.75), K.std({ map: TX.toTexture(sc2, { wrap: false }), roughness: 0.5 }), xc, sashY + 4, zf - 0.45, { cast: false });
      // distillation set-up inside: heating mantle, round-bottom flask, still head, condenser, receiver
      const dx = xc - 18, dz = zf - 22;
      K.mesh(lathe([[0, 0], [6.4, 0], [6.6, 1], [6.4, 6], [5.2, 7.2], [0, 7.2]], 32), K.phys({ color: 0x4a4e56, roughness: 0.6 }), dx, 0, dz);
      const rbf = rbFlask(dx, dz, 5.4, 0.45, SOL.fecl3, { y: 4.8, ring: false, neck: 4 });
      const headY = 4.8 + rbf.yN + 4;
      const cond0 = new T.Vector3(dx + 1, headY + 3, dz), cond1 = new T.Vector3(dx + 34, headY - 12, dz + 2);
      const cdir = cond1.clone().sub(cond0), clen = cdir.length(); cdir.normalize();
      const cmid = cond0.clone().add(cond1).multiplyScalar(0.5);
      const cnd = new T.Mesh(new T.CylinderGeometry(2.0, 2.0, clen * 0.75, 24, 1, true), glassThick);
      cnd.position.copy(cmid); cnd.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), cdir); K.add(cnd, { cast: false });
      const inner = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, clen, 14, 1, true), glassThick); inner.position.copy(cmid); inner.quaternion.copy(cnd.quaternion); K.add(inner, { cast: false });
      const water = new T.Mesh(new T.CylinderGeometry(1.85, 1.85, clen * 0.73, 18), K.phys({ color: 0x9fd6ff, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false, emissive: 0x3a8ad0, emissiveIntensity: 0.3 })); water.position.copy(cmid); water.quaternion.copy(cnd.quaternion); K.add(water, { cast: false });
      const head = new T.Mesh(new T.CylinderGeometry(rbf.rn, rbf.rn, 6, 14, 1, true), glassThick); head.position.set(dx, headY, dz); K.add(head, { cast: false });
      erlenmeyer(dx + 36, dz + 2, 0.9, 0.3, SOL.chromate, { printIt: false, collide: false });
      // stand rods and clamps
      for (const [sx, sz, h] of [[dx - 9, dz - 6, 48], [dx + 22, dz - 6, 40]]) {
        K.mesh(new T.BoxGeometry(10, 1, 14), ironMat, sx, 0.5, sz + 4);
        K.mesh(new T.CylinderGeometry(0.55, 0.55, h, 12), chrome, sx, h / 2, sz);
      }
      // a few bottles at the back of the hood
      bottle(x1 - 14, zf - 34, 1.1, 'b', 12, { amber: true, cap: 0x1a1a1a });
      bottle(x1 - 24, zf - 36, 1.0, 'b', 5, { amber: false, cap: 0xd02a2a, fill: 0.6, col: 0xeef6fa });
      // fluorescent light in the hood, spilling onto the bench
      const fl = new T.PointLight(0xe4eeff, 70, 120, 1.1); fl.position.set(xc, 30, zf - 6); K.group.add(fl);
      K.mesh(new T.BoxGeometry(W0 - 10, 1.2, 3), K.std({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 2.2 }), xc, 68, zf - 10, { cast: false });
      glow(xc, 0.06, BZN + 10, W0 * 1.1, 34, 0xcfe0ff, 0.22);
      K.box(xc, zf + 1, W0 / 2, 2, 0, 6);
    }
    {
      // reagent shelf along the rest of the back edge: steel uprights, two shelves of bottles
      const x0 = -158, x1 = 12, zs = BZN - 7;
      const steel = metal(0xa8adb4, 0.35);
      const shelfM = K.phys({ color: 0xe6e3dc, roughness: 0.5, clearcoat: 0.2 });
      for (let x = x0; x <= x1; x += 34) K.mesh(new T.BoxGeometry(1.4, 64, 1.4), steel, x, 32, zs + 6);
      for (const y of [26, 50]) K.mesh(new T.BoxGeometry(x1 - x0 + 4, 1.2, 15), shelfM, (x0 + x1) / 2, y, zs);
      // instanced bottles on the shelves (amber / clear / white HDPE), labels by variant
      const amberM = K.phys({ color: 0x5a2604, roughness: 0.12, clearcoat: 1, emissive: 0x2a0e00, emissiveIntensity: 0.4 });
      const hdpe = K.phys({ color: 0xf2f0ea, roughness: 0.5, sheen: 0.3 });
      const bGeo = lathe([[0, 0], [2.5, 0], [2.9, 0.4], [2.9, 7.2], [1.8, 8.8], [1.2, 9.3], [1.2, 10]], 20);
      const lists = [[], [], [], []], caps = [];
      for (const y of [26.6, 50.6]) for (let x = x0 + 4; x < x1 - 2; x += rr.range(6.6, 8.5)) {
        const k = Math.floor(rr() * 4), s = rr.range(0.8, 1.25), z = zs + rr.range(-3, 3);
        lists[k].push({ x, y, z, s, ry: rr.range(-0.3, 0.3) });
        caps.push({ x, y: y + 10 * s, z, s, color: [0x1b56b8, 0xc82020, 0x1a1a1a, 0x2a9a3a, 0xf2c21a][Math.floor(rr() * 5)] });
      }
      K.instances(bGeo, amberM, lists[0].concat(lists[1]));
      K.instances(bGeo, hdpe, lists[2]);
      K.instances(bGeo, glassThick, lists[3], { cast: false });
      K.instances(new T.CylinderGeometry(1.3, 1.3, 1.4, 14), plastic(0xffffff, 0.45), caps, { colors: true });
      for (let v = 0; v < 4; v++) {
        const lg = new T.CylinderGeometry(2.95, 2.95, 4, 18, 1, true, -1.2, 2.4); cellUV(lg, [2, 4, 10, 13][v]); lg.translate(0, 3.8, 0);
        const all = lists[0].concat(lists[1], lists[2], lists[3]).filter((_, i) => i % 4 === v);
        K.instances(lg, labelMat, all, { cast: false });
      }
      // bottles standing on the bench in front of the shelf (visible from the road)
      const benchRow = [[-150, -88, 0, true, 0x1b56b8], [-142, -90, 3, true, 0xc82020], [-133, -88, 12, false, 0x1a1a1a], [-62, -89, 1, false, 0x1b56b8], [-54, -90, 13, false, 0x2a8ad0], [-30, -88, 4, true, 0xd02a2a], [-22, -90, 11, true, 0x1a1a1a], [4, -89, 8, false, 0x2a9a3a]];
      for (const [x, z, li, amber, cap] of benchRow) { warnRoad('shelf bottle', x, z, 3); bottle(x, z, 1.05, 'b', li, { amber, cap, fill: 0.65, col: li === 8 ? 0xf6f2ff : li === 13 ? SOL.water : 0xeef6fa }); }
    }

    // ============================================================================================
    // INFIELD AND OUTFIELD PROPS
    // ============================================================================================
    // titration: retort stand, burette with stopcock, conical flask with pink phenolphthalein on a white tile (NE)
    {
      const x = 141, z = -84;
      K.mesh(new K.RoundedBoxGeometry(14, 1.2, 10, 2, 0.3), ironMat, x, 0.6, z + 2);
      K.mesh(new T.CylinderGeometry(0.55, 0.55, 70, 12), chrome, x - 4, 35, z + 4);
      K.mesh(new K.RoundedBoxGeometry(8, 0.2, 8, 2, 0.1), K.ceramic(0xfafafa), x + 1.5, 1.3, z + 1);
      erlenmeyer(x + 1.5, z + 1, 0.85, 0.28, SOL.phph, { y: 1.4, collide: false });
      const bur = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 52, 16, 1, true), glassThick); bur.position.set(x + 1.5, 46, z + 1); K.add(bur, { cast: false });
      K.mesh(new T.CylinderGeometry(0.6, 0.6, 30, 12), liquid(0xf0f4ff, 0.15), x + 1.5, 50, z + 1);
      K.mesh(new T.ConeGeometry(0.6, 3, 12), glassThick, x + 1.5, 18.6, z + 1, { rx: PI, cast: false });
      K.mesh(new T.CylinderGeometry(0.35, 0.35, 3, 10), plastic(0x2a6fd8, 0.3), x + 1.5, 20.6, z + 1, { rz: PI / 2 });
      K.mesh(new T.BoxGeometry(5, 1.2, 1.4), chrome, x - 1.5, 40, z + 2);
      const sc = printBand([[0.78, 0], [0.78, 1]], 2, 0, 0, 0); sc.scale.set(1, 30, 1); sc.position.set(x + 1.5, 32, z + 1);
      AO(x, z + 2, 8, 6, 0.45);
      glow(x + 1.5, 1.45, z + 1, 12, 12, SOL.phph, 0.25);
      K.circle(x, z + 2, 7, 3);
    }
    // sink and swan-neck tap (NW outfield)
    {
      const x = -148, z = -86;
      K.mesh(new K.RoundedBoxGeometry(14, 0.3, 12, 2, 0.12), metal(0x9aa0a8, 0.3), x, 0.02, z, { cast: false });
      K.mesh(new T.CircleGeometry(1.2, 20), K.std({ color: 0x111111 }), x, 0.2, z, { rx: -PI / 2 });
      const curve = new T.CatmullRomCurve3([new T.Vector3(x, 0, z - 8), new T.Vector3(x, 22, z - 8), new T.Vector3(x, 26, z - 3), new T.Vector3(x, 20, z + 1)]);
      K.mesh(new T.TubeGeometry(curve, 30, 0.8, 10), metal(0xd4d8de, 0.12), 0, 0, 0);
      K.mesh(new T.CylinderGeometry(0.7, 0.7, 4, 10), plastic(0x2a6fd8, 0.3), x + 2.4, 12, z - 8, { rz: PI / 2 });
      K.circle(x, z - 8, 1.2, 20);
      AO(x, z, 8, 7, 0.3);
    }
    // decorative stirrer with a big beaker and a vortex (outfield north of the hairpin)
    {
      const x = -12, z = -82;
      warnRoad('vortex stirrer', x, z, 6);
      K.mesh(new K.RoundedBoxGeometry(16, 8, 20, 3, 1.2), K.phys({ color: 0xe6e8ea, roughness: 0.35, clearcoat: 0.6 }), x, 4, z);
      K.mesh(new T.CylinderGeometry(6.6, 6.6, 0.4, 40), K.phys({ color: 0xf2f3f1, roughness: 0.2, clearcoat: 0.9 }), x, 8.1, z - 1);
      for (const [kx, c] of [[-3.5, 0xff5a1a], [3.5, 0x1a1c20]]) K.mesh(new T.CylinderGeometry(1.4, 1.4, 1.2, 16), plastic(c, 0.4), x + kx, 5, z + 10.2, { rx: PI / 2 });
      const R = 5.8, H = 13.5, t = 0.25;
      K.mesh(lathe([[0, 0], [R - 0.5, 0], [R, 0.4], [R, H - 0.1], [R + 0.32, H + 0.12], [R + 0.2, H + 0.32], [R - t, H + 0.1], [R - t, 0.5], [R - 0.6, t], [0, t]], 48), glass, x, 8.3, z - 1, { cast: false });
      printBand([[R + 0.02, H * 0.12], [R + 0.02, H * 0.92]], 0, x, 8.3, z - 1, 0);
      // liquid with a vortex funnel in the middle
      const vp = []; for (let i = 0; i <= 14; i++) { const f = i / 14, rad = (R - t - 0.05) * f; vp.push([rad, 8.3 + 9.2 - 4.5 * Math.pow(1 - f, 3) + 0.35 * f]); }
      const vg = lathe([[0, 8.3 + 0.3], [R - t - 0.05, 8.3 + 0.3]].concat(vp.slice().reverse()), 40);
      const vort = new T.Mesh(vg, K.phys({ color: SOL.cuso4, roughness: 0.04, clearcoat: 1, emissive: SOL.cuso4, emissiveIntensity: 0.35 }));
      vort.position.set(x, 0, z - 1); K.add(vort); keep.push(vort); A.vortex = vort;
      const sb = new T.Mesh(new T.CapsuleGeometry(0.45, 3, 4, 10), K.phys({ color: 0xf6f6f2, roughness: 0.3 })); sb.rotation.z = PI / 2; sb.position.set(x, 8.9, z - 1); K.add(sb); keep.push(sb); A.vbar = sb;
      AO(x, z, 10, 12, 0.5);
      K.box(x, z, 8, 10, 0, 9);
      glow(x, 8.35, z - 1, 16, 16, SOL.cuso4, 0.35);
      glow(x + 2, 0.06, z + 9, 26, 14, SOL.cuso4, 0.18);
    }
    // tripod + gauze + calm burner heating a beaker; ring stand with funnel and filter paper; round-bottom flask (east infield)
    {
      const x = 62, z = -44;
      warnRoad('tripod', x, z, 8);
      const tri = new T.Group(); tri.position.set(x, 0, z);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; const leg = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 14.5, 8), ironMat); leg.position.set(Math.cos(a) * 5.4, 7, Math.sin(a) * 5.4); leg.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28); tri.add(leg); }
      const ring = new T.Mesh(new T.TorusGeometry(5.6, 0.4, 8, 32), ironMat); ring.rotation.x = PI / 2; ring.position.y = 14; tri.add(ring);
      const gc = TX.makeCanvas(256, 256), gg = gc.getContext('2d');
      gg.fillStyle = '#4a4d52'; gg.fillRect(0, 0, 256, 256); gg.strokeStyle = 'rgba(160,165,170,0.55)'; gg.lineWidth = 1.2; for (let i = 0; i < 256; i += 5) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 256); gg.moveTo(0, i); gg.lineTo(256, i); gg.stroke(); }
      gg.fillStyle = '#efece6'; gg.beginPath(); gg.arc(128, 128, 70, 0, TAU); gg.fill(); gg.fillStyle = 'rgba(120,80,40,0.35)'; gg.beginPath(); gg.arc(128, 128, 40, 0, TAU); gg.fill();
      const gauze = new T.Mesh(new T.BoxGeometry(12, 0.2, 12), K.std({ map: TX.toTexture(gc, { wrap: false }), roughness: 0.8, metalness: 0.3 })); gauze.position.y = 14.5; tri.add(gauze);
      K.add(tri);
      const B = burner(x, z); B.calm = true; A.burners.push(B); B.fg.scale.setScalar(0.85);
      beaker(x, z, 3.6, 8, 0.55, SOL.water, { y: 14.6, collide: false });
      A.boil = { x, y: 14.6 + 4.5, z };
      AO(x, z, 8, 8, 0.4);
      K.circle(x, z, 6.5, 15);
      // ring stand with filter funnel over a flask
      const fx = 92, fz = -28;
      warnRoad('funnel stand', fx, fz, 6);
      K.mesh(new K.RoundedBoxGeometry(14, 1.2, 9, 2, 0.3), ironMat, fx - 2, 0.6, fz);
      K.mesh(new T.CylinderGeometry(0.55, 0.55, 40, 12), chrome, fx - 7, 20, fz);
      K.mesh(new T.TorusGeometry(3.8, 0.35, 8, 28), ironMat, fx, 19, fz, { rx: PI / 2 });
      K.mesh(new T.CylinderGeometry(0.4, 0.4, 7, 8), ironMat, fx - 3.6, 19, fz, { rz: PI / 2 });
      K.mesh(lathe([[0.45, 0], [0.45, 7], [4.8, 13], [5.05, 13.2], [4.9, 13.35], [4.6, 13.1], [0.3, 7.1], [0.3, 0]], 32), glass, fx, 12, fz, { cast: false });
      // folded filter paper cone (fluted)
      const fp = new T.ConeGeometry(4.3, 5.6, 16, 1, true); fp.rotateX(PI); const fpp = fp.attributes.position; for (let i = 0; i < fpp.count; i++) { const a = Math.atan2(fpp.getZ(i), fpp.getX(i)); const k = 1 + 0.07 * Math.cos(a * 8); fpp.setX(i, fpp.getX(i) * k); fpp.setZ(i, fpp.getZ(i) * k); } fp.computeVertexNormals();
      K.mesh(fp, K.std({ color: 0xf6f4ee, roughness: 0.95, side: T.DoubleSide }), fx, 22.2 - 1.3, fz);
      K.mesh(new T.CircleGeometry(3.9, 24), liquid(SOL.kmno4, 0.25), fx, 21.0, fz, { rx: -PI / 2 });
      erlenmeyer(fx, fz, 0.8, 0.25, 0xd8a0d8);
      AO(fx - 2, fz, 8.5, 6, 0.4);
      K.circle(fx - 4, fz, 6, 2);
      // round-bottom flask on a cork ring with a Liebig condenser lying beside it
      rbFlask(40, -24, 4.6, 0.5, SOL.cobalt);
      const lc = new T.Group();
      const jacket = new T.Mesh(new T.CylinderGeometry(1.7, 1.7, 26, 20, 1, true), glassThick); jacket.rotation.z = PI / 2; lc.add(jacket);
      const innerT = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 34, 12, 1, true), glassThick); innerT.rotation.z = PI / 2; lc.add(innerT);
      for (const sd of [-1, 1]) { const nip = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 3, 10, 1, true), glassThick); nip.position.set(sd * 11, 1.9, 0); lc.add(nip); const end = new T.Mesh(new T.TorusGeometry(1.4, 0.35, 8, 20), glassThick); end.rotation.y = PI / 2; end.position.x = sd * 13; lc.add(end); }
      lc.position.set(58, 1.8, -12); lc.rotation.y = 0.35; K.add(lc, { cast: false });
      AO(58, -12, 15, 3, 0.35, -0.35);
      K.capsule(58 - Math.cos(-0.35) * 16, -12 - Math.sin(-0.35) * 16, 58 + Math.cos(-0.35) * 16, -12 + Math.sin(-0.35) * 16, 1.8, 3.6);
      // clamps and a boss head lying about
      K.mesh(new K.RoundedBoxGeometry(3, 1.2, 1.6, 2, 0.3), ironMat, 76, 0.6, -6, { ry: 0.8 });
      erlenmeyer(102, -48, 1.0, 0.55, SOL.green);
      beaker(80, 2, 4.0, 8.5, 0.6, SOL.dichro);
      beaker(110, -12, 3.0, 6, 0.4, SOL.iodine);
    }
    // south infield: periodic table mat, goggles, balance, Petri dishes, mortar, pH chart, open notebook, wash bottle
    {
      // periodic table bench mat
      const EL = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
      const cell = (Z) => {
        if (Z === 1) return [0, 0]; if (Z === 2) return [17, 0];
        if (Z <= 4) return [Z - 3, 1]; if (Z <= 10) return [Z - 5 + 12, 1];
        if (Z <= 12) return [Z - 11, 2]; if (Z <= 18) return [Z - 13 + 12, 2];
        if (Z <= 36) return [Z - 19, 3]; if (Z <= 54) return [Z - 37, 4];
        if (Z <= 56) return [Z - 55, 5]; if (Z <= 71) return [Z - 57 + 3, 8]; if (Z <= 86) return [Z - 72 + 3, 5];
        if (Z <= 88) return [Z - 87, 6]; if (Z <= 103) return [Z - 89 + 3, 9]; return [Z - 104 + 3, 6];
      };
      const cat = (Z, s) => {
        if ([3, 11, 19, 37, 55, 87].includes(Z)) return '#f2a0a0';
        if ([4, 12, 20, 38, 56, 88].includes(Z)) return '#f6c896';
        if (Z >= 57 && Z <= 71) return '#f6b4d8'; if (Z >= 89 && Z <= 103) return '#e0a8e8';
        if ([2, 10, 18, 36, 54, 86, 118].includes(Z)) return '#c6b4f2';
        if ([9, 17, 35, 53, 85, 117].includes(Z)) return '#9ee6f0';
        if ([1, 6, 7, 8, 15, 16, 34].includes(Z)) return '#a8e6a0';
        if ([5, 14, 32, 33, 51, 52].includes(Z)) return '#b8e0c8';
        if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(Z)) return '#cfd6dc';
        return '#f6e7a0';
      };
      const c = TX.makeCanvas(1024, 640), g = c.getContext('2d');
      g.fillStyle = '#1d3b6e'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = '#fff'; g.font = '700 34px Rubik, Arial'; g.textAlign = 'center'; g.fillText('PERIODIC TABLE OF THE ELEMENTS', 512, 44);
      const cw = 54, ch = 56, ox = 26, oy = 66;
      for (let Z = 1; Z <= 118; Z++) {
        const [cx, cy] = cell(Z); const y = oy + cy * ch + (cy >= 8 ? 14 : 0);
        g.fillStyle = cat(Z); g.fillRect(ox + cx * cw + 1, y + 1, cw - 2, ch - 2);
        g.fillStyle = '#16181c'; g.font = '700 22px Rubik, Arial'; g.fillText(EL[Z - 1], ox + cx * cw + cw / 2, y + 38);
        g.font = '12px Arial'; g.fillText(String(Z), ox + cx * cw + cw / 2, y + 15);
      }
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '14px Arial'; g.fillText('* lanthanoids     ** actinoids', 300, 630);
      const mat = K.std({ map: TX.toTexture(c, { wrap: false }), roughness: 0.75 });
      const mx = -72, mz = 38;
      K.mesh(new K.RoundedBoxGeometry(52, 0.3, 32.5, 2, 0.12), K.std({ color: 0x1d3b6e, roughness: 0.8 }), mx, 0.15, mz, { ry: 0.05, cast: false });
      K.mesh(new T.PlaneGeometry(51.4, 32.1), mat, mx, 0.31, mz, { rx: -PI / 2, cast: false }).rotation.z = 0.05;
      for (const [x, z] of [[mx - 26, mz - 16], [mx + 26, mz + 16], [mx + 26, mz - 16], [mx - 26, mz + 16]]) warnRoad('mat corner', x, z, 0);
      // safety goggles on the mat
      const gog = new T.Group();
      const lens = new T.Mesh(new T.CylinderGeometry(6.5, 6.5, 3.4, 32, 1, true, -1.3, 2.6), mkGlass(0xd6ecff, 0.18, 0.55, { side: T.DoubleSide })); lens.rotation.x = 0.2; gog.add(lens);
      const frame = new T.Mesh(new T.TorusGeometry(6.5, 0.4, 6, 40, 2.6), plastic(0x2a6fd8, 0.4)); frame.rotation.x = PI / 2; frame.rotation.z = -1.3 - PI / 2 + PI; frame.position.y = -1.7; gog.add(frame);
      const strap = new T.Mesh(new T.TorusGeometry(6.6, 0.12, 4, 40, PI * 0.9), K.std({ color: 0x3a3a40, roughness: 0.8 })); strap.rotation.x = PI / 2; strap.rotation.z = 1.3 + 0.4; strap.position.y = -1.6; gog.add(strap);
      gog.position.set(-62, 1.9, 34); gog.rotation.y = 2.6; K.add(gog);
      AO(-62, 34, 7, 5, 0.35);
      // balance: top-loading, with a weighing boat of crystals and a green display
      const bx = -12, bz = 40;
      K.mesh(new K.RoundedBoxGeometry(18, 5, 24, 3, 1.2), K.phys({ color: 0xeceeef, roughness: 0.35, clearcoat: 0.5 }), bx, 2.5, bz);
      K.mesh(new T.CylinderGeometry(7, 7, 0.5, 40), metal(0xd0d4da, 0.25), bx, 5.6, bz - 2);
      const dc = TX.makeCanvas(256, 64), dg = dc.getContext('2d'); dg.fillStyle = '#0d1a12'; dg.fillRect(0, 0, 256, 64); dg.fillStyle = '#62ff8a'; dg.font = '700 42px "Courier New", monospace'; dg.textAlign = 'center'; dg.fillText('12.48 g', 128, 47);
      const dtx = TX.toTexture(dc, { wrap: false });
      K.mesh(new T.PlaneGeometry(9, 2.25), K.std({ map: dtx, emissive: 0xffffff, emissiveMap: dtx, emissiveIntensity: 0.9 }), bx, 5.02, bz + 9.6, { rx: -PI / 2 + 0.1, cast: false });
      K.mesh(new K.RoundedBoxGeometry(6, 0.8, 6, 2, 0.3), K.phys({ color: 0xf4f4f4, roughness: 0.3, transparent: true, opacity: 0.85 }), bx, 6.3, bz - 2, { ry: 0.3 });
      const bc = []; for (let i = 0; i < 30; i++) bc.push({ x: bx + rr.range(-1.8, 1.8), y: 6.8, z: bz - 2 + rr.range(-1.8, 1.8), ry: rr() * TAU, s: rr.range(0.35, 0.6), color: [0x1f7ee6, 0x2a96f2][i % 2] });
      K.instances(new T.OctahedronGeometry(1, 0), K.phys({ color: 0xffffff, roughness: 0.1, clearcoat: 1, emissive: 0x0a3a80, emissiveIntensity: 0.3 }), bc, { colors: true, cast: false });
      AO(bx, bz, 11, 14, 0.5); K.box(bx, bz, 9, 12, 0, 6);
      glow(bx, 5.1, bz + 9.6, 12, 5, 0x40ff80, 0.18);
      // Petri dishes with bacterial colonies
      const pc = TX.makeCanvas(256, 256), pg = pc.getContext('2d');
      pg.fillStyle = '#e8d6a0'; pg.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * 110; pg.fillStyle = ['#f6f2e0', '#f2e6b0', '#e8f0d8', '#d8a050', '#c84a3a'][Math.floor(rr() * rr() * 5)]; pg.beginPath(); pg.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + rr() * rr() * 12, 0, TAU); pg.fill(); }
      const agarT = TX.toTexture(pc, { wrap: false });
      const agar = K.phys({ map: agarT, roughness: 0.25, clearcoat: 0.8, transparent: true, opacity: 0.92 });
      for (const [x, z, y] of [[34, 50, 0], [44, 54, 0], [38, 52, 1.6]]) {
        warnRoad('petri', x, z, 4);
        K.mesh(lathe([[0, 0], [4.6, 0], [4.6, 1.3], [4.45, 1.3], [4.45, 0.15], [0, 0.15]], 40), glass, x, y, z, { cast: false });
        K.mesh(new T.CylinderGeometry(4.4, 4.4, 0.6, 40), agar, x, y + 0.45, z);
        AO(x, z, 5, 5, 0.3);
      }
      K.circle(39, 52, 9, 3.2);
      // marker label on the lid
      // mortar and pestle
      K.mesh(lathe([[0, 0], [3.4, 0], [4.6, 0.6], [5.4, 2.4], [5.6, 4.6], [5.0, 4.8], [4.6, 3], [3.4, 1.4], [0, 1.2]], 40), K.ceramic(0xf2f0ea, { roughness: 0.6, clearcoat: 0.1 }), 72, 0, 46);
      K.mesh(new T.CircleGeometry(4.2, 24), K.std({ color: 0xbfe0f8, roughness: 0.9 }), 72, 2.2, 46, { rx: -PI / 2 });
      const pes = new T.Mesh(lathe([[0, 0], [1.3, 0.2], [1.5, 1.4], [0.7, 3], [0.6, 9], [0.8, 9.6], [0, 9.8]], 20), K.ceramic(0xf2f0ea, { roughness: 0.6 }));
      pes.position.set(73, 1.5, 46); pes.rotation.z = -0.9; K.add(pes);
      AO(72, 46, 6.5, 6.5, 0.45); K.circle(72, 46, 5.6, 4.8);
      // pH colour chart
      const hc = TX.makeCanvas(1024, 192), hg = hc.getContext('2d');
      hg.fillStyle = '#fbfaf6'; hg.fillRect(0, 0, 1024, 192);
      hg.fillStyle = '#16181c'; hg.font = '700 28px Rubik, Arial'; hg.textAlign = 'left'; hg.fillText('Universal indicator – pH colour chart', 24, 40);
      const phc = ['#d8202a', '#e8401c', '#f06a18', '#f2a31c', '#f2c81c', '#b8d22a', '#3caa3a', '#1e9a8a', '#1f7fc8', '#2a5ad8', '#3a2aa8', '#5a1fa0', '#6a1a9a', '#4a1470'];
      phc.forEach((cc, i) => { hg.fillStyle = cc; hg.fillRect(24 + i * 70, 60, 64, 80); hg.fillStyle = i < 3 || i > 9 ? '#fff' : '#111'; hg.font = '700 30px Rubik, Arial'; hg.textAlign = 'center'; hg.fillText(String(i + 1), 56 + i * 70, 112); });
      hg.fillStyle = '#16181c'; hg.font = '20px Arial'; hg.textAlign = 'left'; hg.fillText('acidic', 24, 172); hg.textAlign = 'right'; hg.fillText('alkaline', 1000, 172); hg.textAlign = 'center'; hg.fillText('neutral', 470, 172);
      K.mesh(new T.PlaneGeometry(30, 5.6), K.std({ map: TX.toTexture(hc, { wrap: false }), roughness: 0.7 }), 6, 0.08, 56, { rx: -PI / 2, cast: false }).rotation.z = 0.06;
      warnRoad('pH chart', 21, 56, 0.5); warnRoad('pH chart', -9, 56, 0.5);
      // open lab notebook with handwritten notes
      const oc = TX.makeCanvas(1024, 720), og = oc.getContext('2d');
      og.fillStyle = '#f7f5ee'; og.fillRect(0, 0, 1024, 720);
      og.strokeStyle = 'rgba(80,140,210,0.35)'; og.lineWidth = 1;
      for (let x = 0; x <= 1024; x += 20) { og.beginPath(); og.moveTo(x, 0); og.lineTo(x, 720); og.stroke(); }
      for (let y = 0; y <= 720; y += 20) { og.beginPath(); og.moveTo(0, y); og.lineTo(1024, y); og.stroke(); }
      og.fillStyle = 'rgba(0,0,0,0.12)'; og.fillRect(506, 0, 12, 720);
      hand(og, 'Exp. 7 – Titration of HCl with NaOH', 30, 60, 30);
      hand(og, 'HCl + NaOH → NaCl + H₂O', 40, 120, 28);
      hand(og, 'V(NaOH) = 23.4 mL   (3 runs: 23.5, 23.3, 23.4)', 40, 180, 22);
      hand(og, 'c(HCl) = c·V / V₀ = 0.117 mol/L', 40, 230, 24);
      hand(og, 'endpoint: faint pink (phenolphthalein)!', 40, 290, 24, '#b0186a');
      og.strokeStyle = '#1c3a8c'; og.lineWidth = 2.5; og.beginPath(); og.moveTo(90, 360); og.lineTo(90, 520); og.moveTo(110, 360); og.lineTo(110, 520); og.lineTo(100, 540); og.lineTo(90, 520); og.moveTo(60, 600); og.lineTo(140, 600); og.lineTo(125, 560); og.lineTo(105, 545); og.lineTo(95, 545); og.lineTo(75, 560); og.closePath(); og.stroke();
      hand(og, 'burette', 140, 420, 22); hand(og, 'conical flask', 160, 590, 22);
      hand(og, 'Elephant toothpaste demo:', 540, 60, 30, '#1c3a8c');
      hand(og, '2 H₂O₂ → 2 H₂O + O₂   (KI = catalyst)', 550, 120, 24);
      hand(og, '30 % H₂O₂ – GOGGLES + gloves!!', 550, 175, 24, '#c42020');
      hand(og, 'foam: dish soap + food colouring', 550, 230, 24);
      hand(og, 'CuSO₄·5H₂O crystals – deep blue', 550, 300, 24);
      og.strokeStyle = '#1c3a8c'; og.lineWidth = 2; og.beginPath(); og.moveTo(550, 360); og.lineTo(990, 360); og.stroke();
      hand(og, 'mass (g)    12.48    12.51    12.47', 550, 400, 22); hand(og, 'mean = 12.49 g', 550, 445, 24);
      hand(og, 'stirrer: 1100 rpm – too fast, vortex!', 550, 510, 22); og.strokeStyle = '#1c3a8c'; og.beginPath(); og.moveTo(550, 503); og.lineTo(880, 497); og.stroke();
      hand(og, '→ 750 rpm', 900, 510, 22);
      const ot = TX.toTexture(oc, { wrap: false });
      K.mesh(new K.RoundedBoxGeometry(30, 0.9, 21, 2, 0.3), K.std({ color: 0xece6d6, roughness: 0.9 }), 52, 0.45, 22, { ry: -0.12 });
      K.mesh(new T.PlaneGeometry(29.4, 20.4), K.std({ map: ot, roughness: 0.85 }), 52, 0.92, 22, { rx: -PI / 2, cast: false }).rotation.z = -0.12;
      AO(52, 22, 16, 11, 0.35, 0.12);
      K.mesh(new T.CylinderGeometry(0.4, 0.4, 14, 6), K.std({ color: 0x2a2a2e, roughness: 0.5 }), 68, 0.45, 30, { rz: PI / 2, ry: 0.8 });
      // wash bottle (aqua dest.)
      const wx = 100, wz = 36;
      K.mesh(lathe([[0, 0], [3.4, 0], [3.7, 0.5], [3.7, 11], [2.8, 13], [1.4, 13.8]], 32), K.phys({ color: 0xf4f6f6, roughness: 0.4, transparent: true, opacity: 0.82, sheen: 0.3 }), wx, 0, wz);
      K.mesh(new T.CylinderGeometry(1.6, 1.6, 1.6, 16), plastic(0x2a6fd8, 0.4), wx, 14.2, wz);
      const nz = new T.CatmullRomCurve3([new T.Vector3(wx, 14.6, wz), new T.Vector3(wx, 17.5, wz), new T.Vector3(wx + 1.5, 19, wz + 1), new T.Vector3(wx + 5, 17.6, wz + 3)]);
      K.mesh(new T.TubeGeometry(nz, 16, 0.32, 8), plastic(0xf4f6f6, 0.4), 0, 0, 0);
      const wl = new T.CylinderGeometry(3.74, 3.74, 4.2, 28, 1, true, -1.2, 2.4); cellUV(wl, 13); K.mesh(wl, labelMat, wx, 6, wz, { cast: false });
      AO(wx, wz, 4.5, 4.5, 0.45); K.circle(wx, wz, 3.8, 14);
      // Pasteur pipettes and a graduated pipette with a bulb
      for (const [x, z, a] of [[86, 52, 0.3], [90, 55, 0.4]]) {
        const pp = new T.Group();
        const tb = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 7, 10, 1, true), glassThick); tb.rotation.z = PI / 2; pp.add(tb);
        const tip = new T.Mesh(new T.CylinderGeometry(0.16, 0.42, 6, 8, 1, true), glassThick); tip.rotation.z = PI / 2; tip.position.x = 6.5; pp.add(tip);
        const teat = new T.Mesh(new T.CapsuleGeometry(0.7, 1.6, 4, 10), K.phys({ color: 0xd8401a, roughness: 0.5 })); teat.rotation.z = PI / 2; teat.position.x = -4.6; pp.add(teat);
        pp.position.set(x, 0.75, z); pp.rotation.y = a; K.add(pp, { cast: false });
      }
      // pipette tip box (open) in the west infield
      const tbx = -100, tbz = 4;
      K.mesh(new K.RoundedBoxGeometry(12, 4.5, 8.5, 2, 0.4), plastic(0x2a6fd8, 0.35), tbx, 2.25, tbz);
      const tips = []; for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) if (rr() > 0.18) tips.push({ x: tbx - 4.9 + i * 1.4, y: 4.5, z: tbz - 3.5 + j * 1.4, color: 0xf2d23a });
      const tipG = new T.CylinderGeometry(0.55, 0.45, 0.6, 10); tipG.translate(0, 0.3, 0);
      K.instances(tipG, K.phys({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.85 }), tips, { colors: true, cast: false });
      AO(tbx, tbz, 7.5, 5.5, 0.45); K.box(tbx, tbz, 6, 4.3, 0, 4.5);
      // more glassware dotted around the infields
      erlenmeyer(-88, -20, 1.1, 0.5, SOL.kmno4);
      beaker(-70, -34, 4.6, 9.5, 0.55, SOL.cuso4);
      erlenmeyer(-102, -44, 0.9, 0.6, SOL.phph);
      beaker(-60, 2, 3.2, 6.5, 0.6, SOL.nickel);
      rbFlask(-114, 22, 4.2, 0.55, SOL.chromate);
      erlenmeyer(-30, 54, 0.85, 0.55, SOL.green);
      beaker(-38, 26, 3.6, 7.4, 0.65, SOL.fecl3);
      erlenmeyer(20, 28, 1.0, 0.5, SOL.blue2);
      beaker(100, 10, 3.0, 6, 0.6, SOL.cobalt);
      bottle(-46, 48, 1.0, 'b', 1, { amber: false, cap: 0x1b56b8, fill: 0.7, col: 0xeef6fa });
      bottle(-118, -28, 1.05, 'b', 3, { amber: true, cap: 0x1a1a1a });
      bottle(118, 22, 1.0, 'b', 9, { amber: false, cap: 0x2a9a3a, fill: 0.6, col: SOL.green });
      // graduated cylinder with blue solution
      {
        const gx = 26, gz = -40;
        warnRoad('cylinder', gx, gz, 4);
        K.mesh(new T.CylinderGeometry(3.2, 3.6, 0.8, 6), plastic(0x2a6fd8, 0.4), gx, 0.4, gz);
        K.mesh(lathe([[1.9, 0.8], [1.9, 24], [2.2, 24.3], [2.0, 24.6], [1.7, 24.2], [1.7, 1.0], [0, 1.0]], 28), glass, gx, 0, gz, { cast: false });
        K.mesh(new T.CylinderGeometry(1.66, 1.66, 15, 20), liquid(SOL.cuso4, 0.35), gx, 8.5, gz);
        const pb = printBand([[1.92, 0], [1.92, 1]], 2, 0, 0, 0); pb.scale.set(1, 21, 1); pb.position.set(gx, 2, gz);
        AO(gx, gz, 4, 4, 0.45); K.circle(gx, gz, 2.6, 24);
        glow(gx + 2, 0.06, gz + 2, 10, 8, SOL.cuso4, 0.22);
      }
    }

    // ============================================================================================
    // FINE SCATTER: droplets, crystals, glass beads, pipette tips, labels
    // ============================================================================================
    {
      const drops = [], beads = [], tipsL = [], salt = [];
      for (let i = 0; i < 110; i++) {
        const x = rr.range(-BX + 3, BX - 3), z = rr.range(BZN + 4, BZS - 3);
        if (!K.offRoad(x, z, 1.5)) continue;
        const sz = rr.range(0.15, 0.45);
        drops.push({ x, y: 0.01, z, sx: sz * rr.range(0.8, 1.3), sy: 0.08 + sz * 0.15, sz });
      }
      for (let i = 0; i < 26; i++) { const s = rr() * L, q = at(s, (rr() < 0.5 ? -1 : 1) * rr.range(8.5, 13)); if (K.offRoad(q.x, q.z, 1.2)) beads.push({ x: q.x, y: 0.5, z: q.z, s: rr.range(0.4, 0.55), color: rr() < 0.7 ? 0xdfeef6 : 0x9ad0ff }); }
      for (let i = 0; i < 12; i++) { const s = rr() * L, q = at(s, (rr() < 0.5 ? -1 : 1) * rr.range(8.5, 15)); if (K.offRoad(q.x, q.z, 1.5)) tipsL.push({ x: q.x, y: 0.42, z: q.z, rz: PI / 2, ry: rr() * TAU, color: rr() < 0.5 ? 0x7ab0f0 : 0xf2e08a }); }
      for (let i = 0; i < 60; i++) { const s = rr() * L, q = at(s, (rr() < 0.5 ? -1 : 1) * rr.range(7.5, 12)); if (K.offRoad(q.x, q.z, 0.8)) salt.push({ x: q.x, y: 0.15, z: q.z, ry: rr() * TAU, s: rr.range(0.18, 0.35), color: [0xffffff, 0xf2f2f0, 0x2a8ae8, 0xf2a020][Math.floor(rr() * rr() * 4)] }); }
      const dm = K.phys({ color: 0xbfd0dc, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.28, envMapIntensity: 2.2, depthWrite: false });
      K.instances(new T.SphereGeometry(1, 12, 6, 0, TAU, 0, PI / 2), dm, drops, { cast: false }).renderOrder = 2;
      K.instances(new T.SphereGeometry(1, 14, 10), mkGlass(0xffffff, 0.16, 0.6), beads, { colors: true, cast: false });
      K.instances(tipG2(T), K.phys({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.7, depthWrite: false }), tipsL, { colors: true, cast: false });
      K.instances(new T.BoxGeometry(1, 1, 1), K.phys({ color: 0xffffff, roughness: 0.2, clearcoat: 0.6 }), salt, { colors: true, cast: false });
      // pushable rubber bungs near the road (they skid when hit)
      const bungG = new T.CylinderGeometry(1.1, 1.4, 2.2, 16);
      const bungM = K.phys({ color: 0x3a2a26, roughness: 0.7, sheen: 0.3 });
      for (const [s0, off] of [[130, 8.5], [560, 8.8], [620, -8.5], [740, 8.8]]) {
        const q = at(s0, off);
        const m = K.mesh(bungG, bungM, q.x, 1.1, q.z);
        K.physics.addDynamic({ x: q.x, z: q.z, r: 1.4, m: 0.5, h: 2.2, mesh: m, slide: true, friction: 20, baseY: 1.1 });
      }
    }

    // ============================================================================================
    // BATCHES: contact shadows, glows; merge static meshes
    // ============================================================================================
    // test tubes
    {
      K.instances(ttGeo, glassThick, ttList, { cast: false });
      const lm = K.phys({ color: 0xffffff, roughness: 0.06, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.0 });
      lm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance = vColor.rgb * 0.35;\n#endif'); };
      lm.customProgramCacheKey = () => 'cl-ttliq';
      K.instances(ttLiq, lm, ttLiqList, { colors: true, cast: true });
      K.instances(ttBot, lm, ttLiqList.map((t) => ({ x: t.x, y: t.y, z: t.z, color: t.color })), { colors: true, cast: false });
      for (const t of ttLiqList) glow(t.x + 0.6, 0.07, t.z + 0.6, 3.2, 3.2, t.color, 0.14);
    }
    {
      const gc = TX.makeCanvas(128, 128), gg = gc.getContext('2d');
      const q = gg.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.3, 'rgba(255,255,255,0.5)'); q.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = q; gg.fillRect(0, 0, 128, 128);
      const gGeo = new T.PlaneGeometry(1, 1); gGeo.rotateX(-PI / 2);
      const gMat = new T.MeshBasicMaterial({ map: TX.toTexture(gc, { wrap: false }), transparent: true, blending: T.AdditiveBlending, depthWrite: false, color: 0xffffff, fog: false });
      const gim = K.instances(gGeo, gMat, glowList.map((g) => ({ x: g.x, y: g.y, z: g.z, sx: g.sx, sy: 1, sz: g.sz, ry: g.ry, color: g.base })), { cast: false, receive: false, colors: true });
      gim.renderOrder = 3; keep.push(gim);
      A.glow = { im: gim, list: glowList };
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      mat.customProgramCacheKey = () => 'cl-ao';
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.push(im);
    }
    // merge remaining static meshes per material (fewer draw calls)
    {
      K.group.updateMatrixWorld(true);
      const isKept = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
      // identical untextured materials made in different places -> one shared material
      const TEXK = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'bumpMap', 'clearcoatNormalMap', 'aoMap', 'lightMap'];
      const canonMap = new Map();
      const hx = (c) => (c && c.getHexString ? c.getHexString() : '-');
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        const m = o.material;
        if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') || TEXK.some((k) => m[k])) return;
        const key = [m.type, hx(m.color), m.roughness, m.metalness, m.clearcoat, m.clearcoatRoughness, m.transparent, m.opacity, hx(m.emissive), m.emissiveIntensity, m.side, m.sheen, hx(m.sheenColor), m.vertexColors, m.depthWrite, m.envMapIntensity, m.alphaTest, m.transmission, m.polygonOffset, m.blending].join('|');
        if (!canonMap.has(key)) canonMap.set(key, m); else o.material = canonMap.get(key);
      });
      const buckets = new Map();
      K.group.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || isKept(o)) return;
        if (o.renderOrder) return;
        const vc = o.material.userData && o.material.userData.vc;
        const key = (vc ? 'vc:' + vc : o.material.uuid) + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
      // one material per colour family: the colour rides in a vertex attribute
      const vcMat = (src) => {
        const vcK = src.userData.vc;
        if (vcK.startsWith('pl')) return K.plastic(0xffffff, src.roughness, { vertexColors: true });
        const m = K.phys({ color: 0xffffff, vertexColors: true, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0xffffff, emissiveIntensity: src.emissiveIntensity, envMapIntensity: 1.2 });
        m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif'); };
        m.customProgramCacheKey = () => 'cl-vcliq';
        return m;
      };
      for (const list of buckets.values()) {
        const vcK = list[0].material.userData && list[0].material.userData.vc;
        if (list.length < 2 && !vcK) continue;
        const keepColor = !!list[0].material.vertexColors || !!vcK;
        const geos = [];
        for (const o of list) {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          if (vcK) { const c = o.material.color, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); }
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k) && !(keepColor && k === 'color')) g.deleteAttribute(k);
          if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          g.morphAttributes = {};
          g.clearGroups();
          geos.push(g);
        }
        const merged = BU.mergeGeometries(geos, false);
        if (!merged) continue;
        const m = new T.Mesh(merged, vcK ? vcMat(list[0].material) : list[0].material);
        m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
        for (const o of list) o.parent.remove(o);
        K.group.add(m);
      }
    }
  },

  tick(dt, time, game) {
    if (!A) return;
    // Bunsen flares: blast cars away from the burner (once per flare) and keep pushing while inside
    for (const b of A.burners) {
      if (b.calm) continue;
      const st = flareState(time, b.ph);
      if (st.f < 0.3) { if (b.hit.size) b.hit.clear(); continue; }
      for (const e of game.cars) {
        const c = e.car;
        if (c.state !== 'drive' || c.y > 8) continue;
        const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
        if (d > BUN.R || d < 0.01) continue;
        const k = st.f * (1 - (d / BUN.R) * 0.55), ux = dx / d, uz = dz / d;
        if (!b.hit.has(c)) {
          b.hit.add(c);
          c.vx += ux * 15 * k; c.vz += uz * 15 * k;
          c.stun = Math.max(c.stun, 0.42 * k);
          c.w += (Math.sin(c.angle * 3 + time * 7) > 0 ? 1 : -1) * 1.5 * k;
          A.scorched = A.scorched || []; if (A.scorched.length < 8) A.scorched.push(c);
        }
        c.vx += ux * 60 * k * dt; c.vz += uz * 60 * k * dt;
      }
    }
    // foam: sticky surface grows with the pile; the surging front shoves cars outwards
    if (A.foamSurf) {
      const fs = foamState(time), s = A.foamSurf, R = Math.max(0.5, fs.R - 1.2);
      s.r = R; s.bb[0] = s.x - R; s.bb[1] = s.z - R; s.bb[2] = s.x + R; s.bb[3] = s.z + R;
      if (fs.surge) {
        for (const e of game.cars) {
          const c = e.car;
          if (c.state !== 'drive' || c.y > 3) continue;
          const dx = c.x - FOAM.x, dz = c.z - FOAM.z, d = Math.hypot(dx, dz);
          if (d > fs.R + 1 || d < 0.01) continue;
          const k = d > fs.R - 4 ? 1 : 0.4;
          c.vx += (dx / d) * 70 * k * dt; c.vz += (dz / d) * 70 * k * dt;
        }
      }
    }
  },

  animate(time, dt, game) {
    if (!A) return;
    const st = game && game.state;
    const live = st === 'race' || st === 'countdown' || st === 'roundEnd';
    const snd = live && game.sound && game.sound.ctx;
    const P = game && game.particles;
    // stirrer
    if (A.disc) A.disc.rotation.y = -stirAngle(time);
    if (A.vortex) { A.vortex.rotation.y = -time * 6; A.vbar.rotation.y = -time * 14; }
    // burners
    const gl = A.glow;
    for (const b of A.burners) {
      const s = b.calm ? { w: 0, f: 0 } : flareState(time, b.ph);
      const fl = 1 + Math.sin(time * 31 + b.x) * 0.06 + Math.sin(time * 17.3 + b.z) * 0.05;
      const hiss = s.w * (1 - s.f);
      // calm blue cone, nervous flicker while the gas hisses
      const jit = hiss > 0 ? 1 + Math.sin(time * 60 + b.x) * 0.15 * hiss : 1;
      b.inner.scale.set(0.55, 2.4 * fl * jit * (1 - s.f * 0.5), 0.55);
      b.outer.scale.set(0.95 + hiss * 0.2, (5.2 + hiss * 2.5) * fl * jit, 0.95 + hiss * 0.2);
      b.outer.material.opacity = 0.8 * (1 - s.f * 0.7);
      b.halo.material.color.set(s.f > 0.05 ? 0xff9a30 : 0x3a6aff);
      b.halo.scale.set(5 + s.f * 9 + hiss * 2, 7 + s.f * 20 + hiss * 3, 1); b.halo.position.y = 2.5 + s.f * 8;
      b.halo.material.opacity = (0.55 + hiss * 0.2 + s.f * 0.35) * fl;
      const fy = s.f;
      b.yel.visible = b.yel2.visible = fy > 0.01 || hiss > 0.6;
      if (b.yel.visible) {
        const h = Math.max(hiss > 0.6 ? (hiss - 0.6) * 4 : 0, fy * 24) * (1 + Math.sin(time * 23 + b.x) * 0.08);
        b.yel.scale.set(1.5 + fy * 2.2, h, 1.5 + fy * 2.2);
        b.yel2.scale.set(0.9 + fy * 1.2, h * 0.75, 0.9 + fy * 1.2);
        b.yel.rotation.z = Math.sin(time * 5.1 + b.x) * 0.12 * fy; b.yel.rotation.x = Math.sin(time * 4.3) * 0.1 * fy;
        b.yel2.rotation.copy(b.yel.rotation);
      }
      const k = b.calm ? 0.2 : 0.18 + hiss * (0.35 + 0.25 * Math.sin(time * 18)) + fy * 1.1;
      const it = gl.list[b.gi];
      it._c = it._c || new it.color.constructor();
      it._c.set(fy > 0.05 ? 0xffa040 : 0x4a70ff).multiplyScalar(k);
      gl.im.setColorAt(b.gi, it._c);
      b.light.intensity = (b.calm ? 4 : 5 + hiss * 6 + fy * 70) * fl;
      b.light.color.set(fy > 0.05 ? 0xffa850 : 0x6a8cff);
      if (!b.calm && game && dt > 0 && game.onScreen(b.x, 6, b.z, 0.25)) {
        if (snd) {
          if (hiss > 0 && b.last === 0) game.sound.noiseBurst(BUN.warn, { freq: 4200, q: 0.7, vol: 0.06, type: 'highpass', pan: game.panOf(b.x, b.z) });
          if (fy > 0 && b.lastF === 0) { game.sound.noiseBurst(0.9, { freq: 260, q: 0.6, vol: 0.22, type: 'lowpass', pan: game.panOf(b.x, b.z) }); game.sound.tone(70, 0.5, { type: 'sawtooth', vol: 0.05, slideTo: 40 }); }
        }
        if (P && fy > 0.2 && Math.random() < dt * 40) P.emit(b.x + (Math.random() - 0.5) * 3, 14 + Math.random() * 10 * fy, b.z + (Math.random() - 0.5) * 3, { color: Math.random() < 0.5 ? 0xffc040 : 0xff7a1a, size: 0.5, life: 0.6, spread: 6, up: 12, grav: -6, alpha: 0.95, grow: 0.6 });
        if (P && fy > 0.3) for (let i = 0; i < 2; i++) { const sp = 14 + Math.random() * 16, h = 2 + Math.random() * 9; P.emit(b.x + b.ux * 2, h, b.z + b.uz * 2, { vx: b.ux * sp, vz: b.uz * sp, vy: 2, spread: 7, up: 3, grav: -8, color: [0xff5a10, 0xff9a20, 0xffd040][Math.floor(Math.random() * 3)], size: 2.4 + Math.random() * 1.6, life: 0.32, alpha: 0.75, grow: 1.6 }); }
        if (P && fy > 0.2 && Math.random() < dt * 8) P.emit(b.x, 24 + 8 * fy, b.z, { color: 0x3a3632, size: 2.4, life: 1.2, spread: 3, up: 3, grav: -4, alpha: 0.18, grow: 2.4 });
        if (P && hiss > 0 && fy === 0 && Math.random() < dt * 14) P.emit(b.x, 14, b.z, { color: 0x9ab8ff, size: 0.3, life: 0.25, spread: 2, up: 4, grav: 0, alpha: 0.6, grow: 1 });
      }
      b.last = hiss > 0 ? 1 : 0; b.lastF = fy > 0 ? 1 : 0;
    }
    if (A.scorched && P) { for (const c of A.scorched) P.emit(c.x, 1, c.z, { color: 0x2a2622, n: 6, size: 1.6, life: 0.7, spread: 5, up: 3, grav: -2, alpha: 0.5, grow: 2 }); A.scorched.length = 0; }
    // boiling beaker on the tripod
    if (A.boil && P && dt > 0 && Math.random() < dt * 6 && game.onScreen(A.boil.x, 18, A.boil.z, 0.2)) P.emit(A.boil.x + (Math.random() - 0.5) * 4, A.boil.y + 1, A.boil.z + (Math.random() - 0.5) * 4, { color: 0xf0f4f8, size: 1.8, life: 1.2, spread: 1.5, up: 3, grav: -3, alpha: 0.18, grow: 2.2 });
    // foam
    if (A.foam) {
      const F = A.foam, fs = foamState(time);
      const hY = 2.6 + 3.6 * Math.min(1, (fs.R - FOAM.R0) / (FOAM.R1 - FOAM.R0));
      F.pile.scale.set(fs.R, hY, fs.R);
      F.inFoam.scale.y = 0.05 + 0.95 * Math.max(fs.bub * fs.bub * 0.75, fs.col > 0 ? 1 : 0);
      F.tube.visible = fs.col > 0.01 || fs.bub > 0.97;
      F.tube.geometry.setDrawRange(0, Math.floor(F.tubeCount * Math.min(1, fs.col * 1.4 + 0.05) / 3) * 3);
      F.tube.scale.set(1, fs.u > FOAM.bubble + FOAM.surge + FOAM.hold ? 0.4 + 0.6 * fs.col : 1, 1);
      if (game && dt > 0 && game.onScreen(F.x, 10, F.z, 0.25)) {
        if (P && fs.bub > 0 && Math.random() < dt * 30 * fs.bub) P.emit(F.x + (Math.random() - 0.5) * 2, F.ny + 0.5, F.z + (Math.random() - 0.5) * 2, { color: 0xffffff, size: 0.5, life: 0.5, spread: 3, up: 5, grav: 8, alpha: 0.85, grow: 1 });
        if (P && fs.surge && Math.random() < dt * 60) { const a = Math.random() * TAU; P.emit(F.x + Math.cos(a) * fs.R, 1.5, F.z + Math.sin(a) * fs.R, { color: [0xff8ac0, 0xfff0a0, 0x9ad0ff, 0xffffff][Math.floor(Math.random() * 4)], size: 0.9, life: 0.6, spread: 4, up: 4, grav: 12, alpha: 0.9, grow: 1.2 }); }
        if (snd) {
          F.bubT -= dt;
          if (fs.bub > 0.05 && fs.surge === 0 && F.bubT <= 0) { F.bubT = 0.3; game.sound.noiseBurst(0.3, { freq: 2600 + fs.bub * 1600, q: 2, vol: 0.03 + 0.05 * fs.bub, type: 'bandpass', pan: game.panOf(F.x, F.z) }); }
          if (fs.surge && !F.wasSurge) { game.sound.noiseBurst(1.1, { freq: 500, q: 0.5, vol: 0.2, type: 'lowpass', pan: game.panOf(F.x, F.z) }); game.sound.tone(120, 0.6, { type: 'sine', vol: 0.12, slideTo: 240 }); }
        }
      }
      F.wasSurge = !!fs.surge;
    }
    // fuming acid
    if (A.fume && P && dt > 0 && game.onScreen(A.fume.x, 1, A.fume.z, 0.2) && Math.random() < dt * 7) {
      const f = A.fume, k = Math.random() < 0.6;
      P.emit((k ? f.x : f.bx) + (Math.random() - 0.5) * 9, 0.6, (k ? f.z : f.bz) + (Math.random() - 0.5) * 9, { color: 0xeef4ea, size: 2.2, life: 1.6, spread: 1.2, up: 1.6, grav: -1.2, alpha: 0.16, grow: 2.4 });
    }
    gl.im.instanceColor.needsUpdate = true;
  },
};

function tipG2(T) { const g = new T.ConeGeometry(0.45, 3, 8, 1, true); return g; }
