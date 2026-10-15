// World: Pinball Wizard. A giant novelty pinball machine (about 2.5x real size) standing in a dark arcade.
// The cars race a printed, lamp-lit lane across the glossy "Turbo Galaxy" playfield: round the pop-bumper bay
// past a drop-target bank, under a spinner, over an acrylic jump ramp and across the flipper zone, where two
// flippers (they flash before they fire) bat anyone on the wrong line, with the drain waiting behind them.
// The chrome steel ball is bigger than the cars: the plunger fires it up the shooter lane, bumpers and flippers
// kick it about and the tilt of the table rolls it back down towards the flippers, across the road.

const TRACK = [
  [-48, -58], [94, -58], [112, -55.9], [119, -47.5], [119, -36.5], [112, -28.1], [94, -26], [-12, -26],
  [-29, -18], [-35, -3], [-29, 12], [-12, 20], [94, 21], [111.5, 23], [118.1, 30.9], [118.1, 41.1], [111.5, 49],
  [94, 51], [30, 51.5], [-30, 51], [-62, 48], [-80, 34], [-85, 0], [-80, -38], [-64, -55],
];

const HX = 150, HZ = 75;            // playfield half size (inner faces of the cabinet walls)
const WT = 7, WH = 12;              // cabinet wall thickness and height above the playfield
const BALL_R = 3.4;                 // steel ball (2.5x a real 27 mm ball)
const LANE = { zw: 63.5, zc: 69.3, x0: -150, x1: 127, home: -134 }; // shooter lane along the south wall
const APRON_X = -128;
const DRAIN = { x: -121, z: 0, r: 7 };
const BAY = { x: -12, z: -3, r: 23 }; // centre of the U-turn round the bumper bay
const BUMP = [[56, -2.5], [80, -9.5], [80, 4.5]], BUMP_R = 7;
const SLING = [[-60, -11], [-48, -31.8], [-66, -30]]; // north sling: face A->B kicks, C is the back corner
const TOPLANES = [-18, -9, 0, 9, 18];   // z of the top-lane guides (four lanes)
const TILT = 7;                         // pull of the tilted table on the ball (units/s^2, towards -x)

// Flippers: pivots, length; each flips on a fixed rhythm (fast swing, then a slower push at the top so cars
// on the road get shoved rather than shot), with a warning light before every flip.
const FLIP = { L: 24, r: 2.25, piv: [[-101, -29], [-101, 29]], P: 5.2, off: [0.9, 3.5], warn: 0.9, fast: 0.07, slow: 0.22, hold: 0.34, down: 0.2, kF: 0.78 };
function flipState(t, i) {
  const F = FLIP, P = F.P;
  let u = (((t - F.off[i]) % P) + P) % P;
  if (u < F.fast) return { f: F.kF * (u / F.fast), up: true, warn: 0 };
  u -= F.fast;
  if (u < F.slow) { const q = u / F.slow; return { f: F.kF + (1 - F.kF) * (1 - (1 - q) * (1 - q)), up: true, warn: 0 }; }
  u -= F.slow;
  if (u < F.hold) return { f: 1, up: false, warn: 0 };
  u -= F.hold;
  if (u < F.down) { const q = u / F.down; return { f: 1 - q * q * (3 - 2 * q), up: false, warn: 0 }; }
  u -= F.down;
  const left = P - F.fast - F.slow - F.hold - F.down - u; // seconds until the next flip
  return { f: 0, up: false, warn: left < F.warn ? 1 - left / F.warn : 0 };
}
function flipPose(t, i) {
  const st = flipState(t, i);
  const a = (i === 0 ? 1 : -1) * (2 * Math.PI / 3 - (Math.PI / 3) * st.f); // 120 deg at rest -> 60 deg up
  const [px, pz] = FLIP.piv[i];
  return { st, a, x1: px, z1: pz, x2: px + Math.cos(a) * (FLIP.L - 1), z2: pz + Math.sin(a) * (FLIP.L - 1) };
}

// Shooter-lane arc: the ball runs up the lane, round the south-east corner and back west into the top lanes.
const ARC = [[123, 69.3], [131, 69.0], [138, 66.5], [143, 61], [145.3, 53], [145.5, 40], [145.3, 20], [144, 9], [138, 4]];

let A = null;

export default {
  id: 'pinball',
  name: 'Pinball Wizard',
  blurb: 'A giant neon pinball table: dodge the flippers, pop bumpers and a rolling steel ball.',
  vehicle: 'formula',
  seed: 23,
  track: { points: TRACK, width: 14, startS: 40 },
  bounds: { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ },
  fallOffEdges: false,
  floorY: -76,
  offCourse: 18,
  skidColor: 0x120a1c,
  clackOnBump: true,
  dust: { normal: null },
  lighting: {
    sunDir: [0.5, 1, 0.14], sunColor: 0xffe4c4, sunIntensity: 1.85,
    hemiSky: 0x8d86c8, hemiGround: 0x1a0c26, hemiIntensity: 0.32,
    envIntensity: 0.36, exposure: 1.06, background: 0x06040b, shadowRadius: 3.5,
    fog: { color: 0x0a0612, near: 230, far: 620 },
  },

  async build(K) {
    const { THREE: T, TX, r, track } = K;
    const PI = Math.PI, TAU = PI * 2, L = track.length;
    const V2 = (a, b = a) => new T.Vector2(a, b);
    const BU = K.BufferGeometryUtils;
    A = { anim: [], t0: 0 };
    const keep = []; // objects that must not be merged (animated)
    const sAt = (x, z) => track.distTo(x, z).s;
    const warnRoad = (what, x, z, m = 0.3) => { if (!K.offRoad(x, z, m)) console.warn(`pinball: ${what} on road at ${x.toFixed(1)},${z.toFixed(1)}`); };

    // ---------------- batched contact shadows (opacity rides in the unused y scale, as in pool.js) ----------------
    const contacts = [];
    const AO = (x, z, rx, rz = rx, op = 0.35, ang = 0, y = 0.05) => contacts.push({ x, y, z, ry: -ang, sx: rx * 2, sy: op, sz: rz * 2 });

    // ---------------- glow cards: additive light pools on the playfield, coloured per frame ----------------
    const glowList = [];
    const glow = (x, y, z, size, color, k = 1) => { glowList.push({ x, y, z, s: size, base: new T.Color(color).multiplyScalar(k), color }); return glowList.length - 1; };
    // ---------------- lamp inserts: flat plastic shapes set into the playfield, lit per frame ----------------
    const inserts = { circle: [], arrow: [], tri: [], star: [] };
    const insert = (kind, x, z, size, color, ang = 0, mode = 'steady', ph = 0) => {
      const it = { x, y: 0.06, z, s: size, ry: -ang, color, col: new T.Color(color), mode, ph, lit: 0 };
      inserts[kind].push(it);
      return it;
    };

    // ================================================================================================
    // CANVAS HELPERS
    // ================================================================================================
    const star5 = (g, x, y, R, r0 = R * 0.45, rot = -PI / 2) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = rot + i * PI / 5, rr = i % 2 ? r0 : R; i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath();
    };
    const sparkle = (g, x, y, R) => {
      g.beginPath(); g.moveTo(x, y - R); g.quadraticCurveTo(x, y, x + R, y); g.quadraticCurveTo(x, y, x, y + R); g.quadraticCurveTo(x, y, x - R, y); g.quadraticCurveTo(x, y, x, y - R); g.fill();
    };
    const outlinedText = (g, txt, x, y, font, fill, stroke, lw, align = 'center') => {
      g.font = font; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(txt, x, y);
      g.fillStyle = fill; g.fillText(txt, x, y);
    };
    const rr = K.rng(77);

    // ================================================================================================
    // PLAYFIELD: two 1024^2 canvases (west / east halves) painted in world units
    // ================================================================================================
    const roadMaskPts = [];
    for (let s = 0; s < L; s += 2) roadMaskPts.push(track.at(s));
    const paintPF = (g) => {
      const rr = K.rng(91);
      // deep space base
      let gr = g.createLinearGradient(-150, 0, 150, 0);
      gr.addColorStop(0, '#3a0f3a'); gr.addColorStop(0.28, '#26124f'); gr.addColorStop(0.62, '#132462'); gr.addColorStop(1, '#0c1540');
      g.fillStyle = gr; g.fillRect(-150, -75, 300, 150);
      const neb = (x, z, rad, col, a) => { const q = g.createRadialGradient(x, z, 0, x, z, rad); q.addColorStop(0, col.replace('A', a)); q.addColorStop(1, col.replace('A', 0)); g.fillStyle = q; g.fillRect(x - rad, z - rad, rad * 2, rad * 2); };
      neb(-70, -40, 60, 'rgba(255,60,170,A)', 0.35); neb(20, 40, 70, 'rgba(40,200,255,A)', 0.22); neb(90, -50, 55, 'rgba(160,80,255,A)', 0.3);
      neb(-110, 30, 50, 'rgba(255,120,40,A)', 0.28); neb(120, 50, 45, 'rgba(255,60,120,A)', 0.25); neb(70, -3, 48, 'rgba(255,170,40,A)', 0.25);
      // printed halftone dot field (classic playfield printing)
      for (let x = -150; x < 150; x += 2.2) for (let z = -75; z < 75; z += 2.2) {
        const k = 0.5 + 0.5 * Math.sin(x * 0.045 + z * 0.03) * Math.cos(z * 0.06 - x * 0.02);
        if (k < 0.55) continue;
        g.fillStyle = `rgba(255,255,255,${(k - 0.55) * 0.12})`;
        g.beginPath(); g.arc(x + ((z / 2.2) % 2) * 1.1, z, 0.35 * k, 0, TAU); g.fill();
      }
      // sunburst rays behind the bumper bay
      g.save(); g.translate(68, -2.5);
      for (let i = 0; i < 28; i++) {
        g.rotate(TAU / 28);
        g.fillStyle = i % 2 ? 'rgba(255,190,60,0.16)' : 'rgba(255,90,40,0.1)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(80, -9); g.lineTo(80, 9); g.closePath(); g.fill();
      }
      g.restore();
      // starfield
      for (let i = 0; i < 1300; i++) {
        const x = -150 + rr() * 300, z = -75 + rr() * 150, b = rr();
        g.fillStyle = b > 0.93 ? '#fff6c8' : b > 0.8 ? '#bfe6ff' : `rgba(255,255,255,${0.25 + b * 0.5})`;
        g.beginPath(); g.arc(x, z, b > 0.93 ? 0.42 : 0.18 + b * 0.12, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(255,250,220,0.85)';
      for (let i = 0; i < 70; i++) sparkle(g, -150 + rr() * 300, -75 + rr() * 150, 0.8 + rr() * 1.6);
      // ringed planet (north-west of the flippers) and a small moon
      const planet = (x, z, R, c1, c2, ringA) => {
        g.save();
        const q = g.createRadialGradient(x - R * 0.35, z - R * 0.35, R * 0.1, x, z, R);
        q.addColorStop(0, c1); q.addColorStop(1, c2);
        g.fillStyle = q; g.beginPath(); g.arc(x, z, R, 0, TAU); g.fill();
        g.lineWidth = 0.6; g.strokeStyle = '#0a0614'; g.stroke();
        g.globalAlpha = 0.35; g.strokeStyle = '#ffffff'; g.lineWidth = R * 0.12;
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x, z + k * R * 0.28, R * Math.sqrt(1 - (k * 0.28) ** 2) * 0.98, R * 0.05, 0, 0, TAU); g.stroke(); }
        g.globalAlpha = 1;
        g.translate(x, z); g.rotate(ringA);
        g.strokeStyle = '#ffd36b'; g.lineWidth = R * 0.16; g.beginPath(); g.ellipse(0, 0, R * 1.75, R * 0.42, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#0a0614'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(0, 0, R * 1.86, R * 0.52, 0, 0, TAU); g.stroke();
        g.restore();
      };
      planet(-112, -52, 9, '#ffb36b', '#c0392b', -0.35);
      planet(136, 58, 6, '#8ff0ff', '#2266cc', 0.4);
      planet(-60, 3, 5.5, '#ff9ee8', '#8a2bb8', 0.2);
      // comet streaks
      for (const [x, z, a, len] of [[30, -42, -0.1, 34], [-20, 36, 0.12, 28], [128, -64, 0.6, 18], [-138, 52, -0.9, 16]]) {
        g.save(); g.translate(x, z); g.rotate(a);
        const q = g.createLinearGradient(-len, 0, 0, 0); q.addColorStop(0, 'rgba(120,230,255,0)'); q.addColorStop(1, 'rgba(200,250,255,0.75)');
        g.fillStyle = q; g.beginPath(); g.moveTo(-len, -0.3); g.lineTo(0, -1.4); g.lineTo(0, 1.4); g.lineTo(-len, 0.3); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 1.5, 0, TAU); g.fill();
        g.restore();
      }
      // flipper zone: hot orange glow print behind the flippers and the SHOOT AGAIN plate
      neb(-112, 0, 34, 'rgba(255,120,30,A)', 0.4);
      g.save();
      g.fillStyle = 'rgba(10,6,20,0.7)'; g.beginPath(); g.ellipse(-101, 0, 7.5, 5.5, 0, 0, TAU); g.fill();
      outlinedText(g, 'SHOOT', -101, -1.6, '700 2.6px Rubik, sans-serif', '#ffe9a8', '#1a0a20', 0.5);
      outlinedText(g, 'AGAIN', -101, 1.7, '700 2.6px Rubik, sans-serif', '#ffe9a8', '#1a0a20', 0.5);
      g.restore();
      // bonus ladder labels between the slings
      const bon = ['1x', '2x', '3x', '4x', '5x'];
      for (let i = 0; i < 5; i++) outlinedText(g, bon[i], -71 + i * 5.8, 4.4, '700 2.0px Rubik, sans-serif', '#fff2c0', '#120818', 0.45);
      outlinedText(g, 'BONUS', -59.4, -4.6, '700 2.6px "Lilita One", Rubik, sans-serif', '#ff7ad9', '#120818', 0.6);
      // printed lane strip text
      outlinedText(g, 'ORBIT  25,000', 22, -42, 'italic 700 5px "Lilita One", Rubik, sans-serif', '#7ff6ff', '#0b0420', 1.0);
      outlinedText(g, 'EXTRA BALL', 72, -42, 'italic 700 3.6px "Lilita One", Rubik, sans-serif', '#ffdf5e', '#0b0420', 0.8);
      outlinedText(g, 'JUMP FOR 50K', 34, 36.5, 'italic 700 4.6px "Lilita One", Rubik, sans-serif', '#ffb0f0', '#0b0420', 1.0);
      outlinedText(g, 'SUPER JETS', 75, 36.5, 'italic 700 3.6px "Lilita One", Rubik, sans-serif', '#9dffa8', '#0b0420', 0.8);
      // big title in the bay, under the rocket plastic
      g.save(); g.lineWidth = 0.5;
      for (let k = 0; k < 4; k++) { g.strokeStyle = ['rgba(127,246,255,0.5)', 'rgba(255,95,184,0.45)', 'rgba(255,216,74,0.45)', 'rgba(166,92,255,0.5)'][k]; g.setLineDash([2.2, 1.4]); g.beginPath(); g.ellipse(22, -2.5, 26 - k * 4.5, 13 - k * 2.6, -0.08, 0, TAU); g.stroke(); }
      g.restore();
      outlinedText(g, 'LAUNCH  BAY', 66, 11.2, 'italic 700 2.6px Rubik, sans-serif', '#7ff6ff', '#0b0420', 0.5);
      // drop-target labels
      for (let i = 0; i < 4; i++) {
        const a = PI * (150 + i * 20) / 180;
        const x = BAY.x + Math.cos(a) * 8.6, z = BAY.z + Math.sin(a) * 8.6;
        outlinedText(g, ['S', 'T', 'A', 'R'][i], x, z, '700 2.4px Rubik, sans-serif', '#ffffff', '#120818', 0.5);
      }
      // top lanes: lane floors + letters
      for (let i = 0; i < 4; i++) {
        const z = (TOPLANES[i] + TOPLANES[i + 1]) / 2;
        g.fillStyle = 'rgba(8,4,18,0.55)'; g.fillRect(120, z - 3.6, 22, 7.2);
        outlinedText(g, ['R', 'A', 'C', 'E'][i], 113, z, '700 3.4px "Lilita One", Rubik, sans-serif', '#ffffff', '#120818', 0.6);
      }
      // dark printed underlay along the road (soft shadow band so the lane prints crisply on the art)
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(4,2,10,0.55)'; g.lineWidth = 23;
      g.beginPath(); roadMaskPts.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.closePath(); g.stroke();
      g.restore();
      // plunger lane: bare varnished wood with arrows
      const wg = g.createLinearGradient(0, 63.5, 0, 75); wg.addColorStop(0, '#6e4320'); wg.addColorStop(0.5, '#9a6534'); wg.addColorStop(1, '#6a3f1c');
      g.fillStyle = wg; g.fillRect(-150, 63.5, 300, 11.5);
      g.strokeStyle = 'rgba(60,30,10,0.5)'; g.lineWidth = 0.15;
      for (let i = 0; i < 26; i++) { const z = 64 + rr() * 10.5; g.beginPath(); g.moveTo(-150, z); for (let x = -150; x <= 150; x += 10) g.lineTo(x, z + Math.sin(x * 0.07 + i) * 0.4); g.stroke(); }
      for (let x = -100; x < 120; x += 22) { g.fillStyle = 'rgba(255,230,160,0.55)'; g.beginPath(); g.moveTo(x + 4, 69.3); g.lineTo(x - 1, 66.8); g.lineTo(x - 1, 71.8); g.closePath(); g.fill(); }
      outlinedText(g, 'SHOOTER LANE', -60, 69.3, 'italic 700 3.2px Rubik, sans-serif', '#ffe2a0', '#3a1c08', 0.4);
      // outer border: black keyline round the printed field
      g.strokeStyle = '#05030a'; g.lineWidth = 2.2; g.strokeRect(-150, -75, 300, 138.5);
    };
    const pfMat = [];
    for (const half of [0, 1]) {
      const c = TX.makeCanvas(1024, 1024);
      const g = c.getContext('2d');
      const S = 1024 / 150;
      g.setTransform(S, 0, 0, S, (half ? 0 : 150) * S, 75 * S);
      paintPF(g);
      const tex = TX.toTexture(c, { wrap: false });
      const m = K.phys({ map: tex, roughness: 0.5, specularIntensity: 0.45, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6 });
      pfMat.push(m);
      K.mesh(new T.PlaneGeometry(150, 150), m, half ? 75 : -75, 0, 0, { rx: -PI / 2, cast: false });
    }

    // ================================================================================================
    // THE LANE: dark printed road with a lamp-dot border, yellow edge lines and chasing arrow inserts
    // ================================================================================================
    const RW = 20, EDGE = 3; // ribbon width (track + printed borders)
    const roadMat = (() => {
      const W = 256, H = 1024, pxu = W / RW, VS = 32; // 1024 px = 32 units along
      const c = TX.makeCanvas(W, H), g = c.getContext('2d');
      const m = TX.makeCanvas(W, H), mg = m.getContext('2d');
      mg.fillStyle = '#000'; mg.fillRect(0, 0, W, H);
      // lane body
      const lg = g.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, '#1d1630'); lg.addColorStop(0.5, '#2a2140'); lg.addColorStop(1, '#1d1630');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      // fine sparkle flakes in the print
      for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${200 + rr() * 55 | 0},${180 + rr() * 75 | 0},255,${0.05 + rr() * 0.14})`; g.fillRect(rr() * W, rr() * H, 1.3, 1.3); }
      // thin pinstripes
      g.strokeStyle = 'rgba(160,140,255,0.13)'; g.lineWidth = 1.2;
      for (const u of [0.33, 0.67]) { g.beginPath(); g.moveTo(u * W, 0); g.lineTo(u * W, H); g.stroke(); }
      for (const side of [0, 1]) {
        const X = (d) => (side ? W - d * pxu : d * pxu); // d = distance (units) in from the ribbon's outer edge
        const band = (d0, d1, col) => { g.fillStyle = col; const a = X(d0), b = X(d1); g.fillRect(Math.min(a, b), 0, Math.abs(b - a), H); };
        band(0, 0.45, '#05030a');                 // keyline
        band(0.45, 2.3, '#3a1442');               // lamp-dot band
        band(2.3, 2.55, '#05030a');
        band(2.55, 3.45, '#ffd23f');              // edge line straddling the track edge
        band(3.45, 3.7, '#05030a');
        // lamp dots: dark plastic in the colour map, lit through the emissive mask (G channel)
        for (let k = 0; k < 8; k++) {
          const y = (k + 0.5) * H / 8, x = X(1.37);
          g.fillStyle = '#1a0a1a'; g.beginPath(); g.arc(x, y, 0.62 * pxu, 0, TAU); g.fill();
          g.fillStyle = '#7a2a3a'; g.beginPath(); g.arc(x, y, 0.5 * pxu, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - 0.15 * pxu, y - 0.18 * pxu, 0.16 * pxu, 0, TAU); g.fill();
          mg.fillStyle = '#00ff00'; mg.beginPath(); mg.arc(x, y, 0.5 * pxu, 0, TAU); mg.fill();
        }
      }
      // chevron arrow inserts on the centre line (pointing along +v = driving direction = canvas up)
      const arrow = (ctx, y, fill, outline) => {
        const cx = W / 2, w = 3.2 * pxu, h = 3.6 * pxu, t = 1.25 * pxu;
        ctx.beginPath();
        ctx.moveTo(cx, y - h / 2); ctx.lineTo(cx + w, y + h / 2 - t * 0.2); ctx.lineTo(cx + w, y + h / 2 + t * 0.8);
        ctx.lineTo(cx, y - h / 2 + t); ctx.lineTo(cx - w, y + h / 2 + t * 0.8); ctx.lineTo(cx - w, y + h / 2 - t * 0.2); ctx.closePath();
        if (outline) { ctx.lineWidth = 0.45 * pxu; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.stroke(); }
        ctx.fillStyle = fill; ctx.fill();
      };
      for (let k = 0; k < 2; k++) {
        const y = (k + 0.5) * H / 2;
        arrow(g, y, '#5a3412', '#05030a');
        arrow(mg, y, '#ff0000', null);
      }
      const map = TX.toTexture(c, {});
      const em = TX.toTexture(m, { srgb: false });
      const mat = K.phys({ map, emissiveMap: em, emissive: 0xffffff, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 });
      const U = { uTime: { value: 0 } };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = U.uTime;
        sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
          #ifdef USE_EMISSIVEMAP
            vec4 emT = texture2D( emissiveMap, vEmissiveMapUv );
            float vv = vEmissiveMapUv.y;
            float ch = fract( vv * 2.0 - uTime * 1.35 );
            float c1 = 0.12 + 2.6 * pow( ch, 5.0 );
            float c2 = 0.25 + 1.5 * step( 0.62, fract( vv * 8.0 - uTime * 3.2 ) );
            totalEmissiveRadiance = vec3( 1.0, 0.62, 0.12 ) * emT.r * c1 + vec3( 1.0, 0.28, 0.55 ) * emT.g * c2;
          #endif`);
      };
      mat.customProgramCacheKey = () => 'pinball-road';
      A.roadU = U;
      return { mat, VS };
    })();
    {
      const rib = K.ribbon({ mat: roadMat.mat, width: RW, y: 0.04, vScale: roadMat.VS, step: 1 });
      rib.renderOrder = 0;
      keep.push(rib);
    }

    // start / finish: checkered decal + START print, two blinking inserts
    {
      const c = TX.makeCanvas(512, 128), g = c.getContext('2d');
      for (let y = 0; y < 3; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f2ea'; g.fillRect(x * 32, 16 + y * 32, 32, 32); }
      g.fillStyle = '#05030a'; g.fillRect(0, 0, 512, 16); g.fillRect(0, 112, 512, 16);
      const p = track.at(40);
      const m = K.mesh(new T.PlaneGeometry(15.2, 3.8), K.phys({ map: TX.toTexture(c, { wrap: false }), roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }), p.x, 0.06, p.z, { cast: false });
      m.rotation.order = 'YXZ'; m.rotation.y = -p.angle + PI / 2; m.rotation.x = -PI / 2;
      keep.push(m);
      for (const sd of [-1, 1]) { const q = track.place(40, sd * 10.4); insert('circle', q.x, q.z, 1.1, 0xffffff, 0, 'blink', sd > 0 ? 0 : 0.5); }
    }

    // ================================================================================================
    // SHARED MATERIALS
    // ================================================================================================
    const chrome = K.metal(0xe9ecf2, 0.12, { envMapIntensity: 1.2 });
    const steel = K.metal(0xbfc4cc, 0.32);
    const rubber = K.phys({ color: 0xf2f0ea, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const blackPl = K.phys({ color: 0x141018, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const whitePl = K.phys({ color: 0xf6f3ee, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15 });
    const redRub = K.phys({ color: 0xc0141c, roughness: 0.5, clearcoat: 0.3 });
    // vertex-colour a geometry (and strip it to position/normal/uv/color) so differently coloured parts merge into one mesh
    const vc = (g0, hex) => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const c = new T.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      g.clearGroups();
      return g;
    };
    const bulbMat = K.std({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.3 });

    // posts with rubber rings (instanced)
    const posts = [], rings = [], bulbs = [];
    const post = (x, z, h = 5.5, ring = true, col = true) => {
      posts.push({ x, y: h / 2, z, sy: h });
      if (ring) rings.push({ x, y: 1.6, z, rx: PI / 2 });
      AO(x, z, 2.2, 2.2, 0.4);
      if (col) K.circle(x, z, ring ? 1.5 : 0.8, h);
    };
    const bulb = (x, z, y = 1.4, warm = true) => { bulbs.push({ x, y, z, s: 1 }); glow(x, 0.12, z, 9, warm ? 0xffc278 : 0x9fd8ff, 0.55); };

    // rails: chrome wire-form guides (two wires on little posts), colliders for cars and the ball
    const railGeos = [];
    const rail = (pts, { h = 3.4, col = true, wires = [1.4, 3.0], r0 = 0.32, postStep = 9 } = {}) => {
      const v3 = pts.map(([x, z]) => new T.Vector3(x, 0, z));
      const curve = new T.CatmullRomCurve3(v3, false, 'centripetal');
      const len = curve.getLength();
      for (const y of wires) {
        const g = new T.TubeGeometry(curve, Math.max(4, Math.ceil(len / 2)), r0, 6, false);
        g.translate(0, y, 0);
        railGeos.push(g);
      }
      const n = Math.max(1, Math.round(len / postStep));
      for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n);
        const g = new T.CylinderGeometry(0.28, 0.32, wires[wires.length - 1] + 0.3, 6);
        g.translate(p.x, (wires[wires.length - 1] + 0.3) / 2, p.z);
        railGeos.push(g);
        AO(p.x, p.z, 1.4, 1.4, 0.3);
      }
      if (col) {
        const sp = curve.getSpacedPoints(Math.max(2, Math.ceil(len / 6)));
        for (let i = 0; i < sp.length - 1; i++) K.capsule(sp[i].x, sp[i].z, sp[i + 1].x, sp[i + 1].z, 0.7, h, { bounce: 0.45 });
      }
      return curve;
    };
    const edgeRail = (side, s0, s1, extra = 2.6, opts = {}) => {
      const pts = [];
      for (let s = s0; s <= s1 + 0.01; s += 4) { const p = track.at(s); const o = side * (p.w / 2 + extra); pts.push([p.x + p.nx * o, p.z + p.nz * o]); }
      return rail(pts, opts);
    };

    // ================================================================================================
    // CABINET: side walls with art blades, chrome side rails, lockdown bar, legs, flipper buttons
    // ================================================================================================
    {
      // inner art blades (printed plastic on the inside of the walls)
      const bladeTex = (() => {
        const c = TX.makeCanvas(1024, 64), g = c.getContext('2d');
        const q = g.createLinearGradient(0, 0, 0, 64); q.addColorStop(0, '#2a0a3a'); q.addColorStop(1, '#0c0418');
        g.fillStyle = q; g.fillRect(0, 0, 1024, 64);
        for (let i = 0; i < 40; i++) { g.strokeStyle = i % 2 ? 'rgba(255,80,200,0.55)' : 'rgba(80,220,255,0.5)'; g.lineWidth = 2; g.beginPath(); const x = i * 26; g.moveTo(x, 64); g.lineTo(x + 30, 0); g.stroke(); }
        for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,230,0.8)'; g.fillRect(rr() * 1024, rr() * 64, 1.5, 1.5); }
        g.fillStyle = '#ffd84a'; g.font = '30px "Lilita One", Impact, sans-serif'; g.textBaseline = 'middle';
        for (let x = 40; x < 1024; x += 340) { g.lineWidth = 5; g.strokeStyle = '#1a0626'; g.strokeText('TURBO GALAXY', x, 34); g.fillText('TURBO GALAXY', x, 34); }
        return TX.toTexture(c, { repeat: [1, 1] });
      })();
      const blade = K.phys({ map: bladeTex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveMap: bladeTex, emissiveIntensity: 0.25 });
      const sideArt = (() => {
        const c = TX.makeCanvas(1024, 128), g = c.getContext('2d');
        g.fillStyle = '#0b0710'; g.fillRect(0, 0, 1024, 128);
        for (let i = 0; i < 14; i++) {
          const x = 40 + i * 75, y = 64 + Math.sin(i * 1.7) * 30, R = 14 + (i % 3) * 8;
          const q = g.createRadialGradient(x, y, 0, x, y, R * 2.4); q.addColorStop(0, i % 2 ? 'rgba(255,60,180,0.55)' : 'rgba(60,200,255,0.5)'); q.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = q; g.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
        }
        g.strokeStyle = '#ffcf3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 104); for (let x = 0; x <= 1024; x += 32) g.lineTo(x, 104 + ((x / 32) % 2 ? -14 : 0)); g.stroke();
        g.font = '64px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#000';
        g.strokeText('TURBO GALAXY', 512, 52); g.fillStyle = '#ff5fb8'; g.fillText('TURBO GALAXY', 512, 52);
        return TX.toTexture(c, { wrap: false });
      })();
      const paintBlack = K.phys({ color: 0x15111a, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const sideOuter = K.phys({ map: sideArt, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
      const BOT = -34; // cabinet body bottom
      // long walls (north/south) and short walls (west = front, east = back)
      const wallH = WH - BOT;
      for (const sd of [-1, 1]) {
        const z = sd * (HZ + WT / 2);
        K.mesh(new T.BoxGeometry(2 * HX + 2 * WT, wallH, WT), paintBlack, 0, BOT + wallH / 2, z, { cast: false });
        K.box(0, z, HX + WT, WT / 2, 0, 40);
      }
      for (const sd of [-1, 1]) {
        const x = sd * (HX + WT / 2), hh = wallH + (sd > 0 ? 6 : 0);
        K.mesh(new T.BoxGeometry(WT, hh, 2 * HZ), paintBlack, x, BOT + hh / 2, 0, { cast: false });
        K.box(x, 0, WT / 2, HZ, 0, 40);
      }
      // cabinet side art on the outside of the front-facing (south) wall
      keep.push(K.mesh(new T.PlaneGeometry(2 * HX + 2 * WT, wallH), sideOuter, 0, BOT + wallH / 2, HZ + WT + 0.05, { cast: false }));
      // printed art blades lining the inside of the walls above the playfield (one merged mesh)
      {
        const bg = [];
        const bl = (w, x, z, ry) => { const g = new T.PlaneGeometry(w, WH); g.rotateY(ry); g.translate(x, WH / 2, z); bg.push(g); };
        bl(2 * HX, 0, -HZ + 0.05, 0);
        bl(2 * HZ, -HX + 0.05, 0, PI / 2);
        bl(2 * HZ, HX - 0.05, 0, -PI / 2);
        keep.push(K.add(new T.Mesh(BU.mergeGeometries(bg, false), blade), { cast: false }));
      }
      // chrome side rails on top of the long walls, lockdown bar at the front
      for (const sd of [-1, 1]) {
        const g = new K.RoundedBoxGeometry(2 * HX + 2 * WT + 1, 1.6, WT + 1.2, 2, 0.5);
        K.mesh(g, chrome, 0, WH + 0.8, sd * (HZ + WT / 2), { cast: false });
      }
      K.mesh(new K.RoundedBoxGeometry(WT + 3, 2.6, 2 * HZ + 2 * WT + 1, 3, 0.9), chrome, -HX - WT / 2 - 0.5, WH + 1.3, 0, { cast: false });
      K.mesh(new K.RoundedBoxGeometry(WT + 1, 1.6, 2 * HZ + 2 * WT + 1, 2, 0.5), steel, HX + WT / 2, WH + 6.8, 0, { cast: false });
      // flipper buttons on the outside of the cabinet near the front
      const btnMat = K.phys({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 0.6, roughness: 0.2, clearcoat: 1 });
      A.btnMat = btnMat;
      for (const sd of [-1, 1]) {
        K.mesh(new T.CylinderGeometry(2.4, 2.4, 1.2, 24), chrome, -HX + 12, WH - 6, sd * (HZ + WT + 0.6), { rx: PI / 2, cast: false });
        K.mesh(new T.CylinderGeometry(1.9, 1.9, 1.6, 24), btnMat, -HX + 12, WH - 6, sd * (HZ + WT + 1.6), { rx: PI / 2, cast: false });
      }
      // plunger knob through the front wall
      {
        const rod = new T.CylinderGeometry(0.7, 0.7, 26, 12); rod.rotateZ(PI / 2);
        const knob = K.lathe([[0, 0], [2.6, 0.2], [3.0, 1.6], [2.2, 4.4], [1.1, 5.4], [0, 5.6]], 24); knob.rotateZ(PI / 2); knob.translate(-13, 0, 0);
        const tip = new T.CylinderGeometry(1.6, 1.6, 1.6, 16); tip.rotateZ(PI / 2); tip.translate(13, 0, 0);
        const sp = [];
        for (let k = 0; k < 7; k++) { const t = new T.TorusGeometry(1.25, 0.16, 5, 14); t.rotateY(PI / 2); t.translate(4 + k * 1.2, 0, 0); sp.push(vc(t, 0xd8dce4)); }
        const g = new T.Mesh(BU.mergeGeometries([vc(rod, 0xd8dce4), vc(knob, 0xff3d2e), vc(tip, 0x1a1a1a), ...sp], false), K.phys({ vertexColors: true, metalness: 0.55, roughness: 0.22, clearcoat: 0.8 }));
        g.position.set(LANE.home - 3.4 - 13.8, BALL_R, LANE.zc);
        K.add(g, { cast: false }); keep.push(g);
        A.plunger = { g, x0: g.position.x };
      }
      // legs and leg plates down to the arcade floor
      const legMat = K.metal(0x2a2a30, 0.35);
      for (const [x, z] of [[-HX + 4, -HZ - 3], [-HX + 4, HZ + 3], [HX - 4, -HZ - 3], [HX - 4, HZ + 3]]) {
        K.mesh(new T.BoxGeometry(8, BOT + 76, 8), legMat, x, (BOT - 76) / 2, z, { cast: false });
        K.mesh(new T.BoxGeometry(11, 2, 11), chrome, x, BOT + 4, z, { cast: false });
        K.mesh(new T.CylinderGeometry(4, 4.6, 2, 16), chrome, x, -75, z, { cast: false });
      }
      // cabinet bottom
      K.mesh(new T.BoxGeometry(2 * HX, 2, 2 * HZ), paintBlack, 0, BOT + 1, 0, { cast: false });
    }

    // ================================================================================================
    // ARCADE FLOOR far below: blacklight carpet, and other machines glowing in the dark
    // ================================================================================================
    {
      const c = TX.makeCanvas(512, 512), g = c.getContext('2d');
      g.fillStyle = '#07040c'; g.fillRect(0, 0, 512, 512);
      const neon = ['#ff2fb4', '#36e0ff', '#ffe23a', '#7dff4a', '#a65cff'];
      for (let i = 0; i < 46; i++) {
        g.strokeStyle = neon[i % 5]; g.lineWidth = 3 + rr() * 3; g.lineCap = 'round';
        const x = rr() * 512, y = rr() * 512, kind = i % 4;
        g.beginPath();
        if (kind === 0) { g.moveTo(x, y); for (let k = 1; k < 6; k++) g.lineTo(x + k * 12, y + (k % 2 ? 10 : -10)); }
        else if (kind === 1) g.arc(x, y, 8 + rr() * 14, 0, TAU);
        else if (kind === 2) { star5(g, x, y, 14, 6); }
        else { g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 30, x + 40, y + 30, x + 70, y); }
        g.stroke();
      }
      for (let i = 0; i < 300; i++) { g.fillStyle = neon[i % 5]; g.globalAlpha = 0.6; g.fillRect(rr() * 512, rr() * 512, 2, 2); }
      g.globalAlpha = 1;
      const t = TX.toTexture(c, { repeat: [14, 14] });
      K.mesh(new T.PlaneGeometry(1700, 1700), K.std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.95 }), 0, -76, 0, { rx: -PI / 2, cast: false });
      // our machine's dark footprint on the carpet
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, alphaMap: TX.blobShadowTexture(), depthWrite: false }));
      sh.rotation.x = -PI / 2; sh.scale.set(380, 220, 1); sh.position.set(0, -75.6, 0); sh.renderOrder = 1;
      K.group.add(sh);
      // other machines: dark cabinets with lit backglasses and playfields (merged into three draw calls)
      const atlas = TX.makeCanvas(512, 256), ag = atlas.getContext('2d');
      const pal = [['#ff2f8f', '#ffd23a'], ['#2fd8ff', '#ff5f2f'], ['#8f5cff', '#5fff8f'], ['#ffb02f', '#2f6fff']];
      for (let i = 0; i < 4; i++) {
        const x0 = i * 128;
        let q = ag.createLinearGradient(x0, 0, x0, 128); q.addColorStop(0, pal[i][0]); q.addColorStop(1, '#120820');
        ag.fillStyle = q; ag.fillRect(x0, 0, 128, 128);
        ag.fillStyle = pal[i][1]; ag.font = '30px "Lilita One", Impact, sans-serif'; ag.textAlign = 'center'; ag.fillText(['STAR', 'RALLY', 'ROBO', 'SURF'][i], x0 + 64, 60);
        for (let k = 0; k < 12; k++) { ag.fillStyle = 'rgba(255,255,255,0.8)'; ag.fillRect(x0 + rr() * 128, rr() * 128, 2, 2); }
        q = ag.createLinearGradient(x0, 128, x0, 256); q.addColorStop(0, '#1a1040'); q.addColorStop(1, pal[i][0]);
        ag.fillStyle = q; ag.fillRect(x0, 128, 128, 128);
        for (let k = 0; k < 9; k++) { ag.fillStyle = pal[i][(k % 2)]; ag.beginPath(); ag.arc(x0 + 20 + rr() * 88, 140 + rr() * 110, 5 + rr() * 6, 0, TAU); ag.fill(); }
      }
      const aT = TX.toTexture(atlas, { wrap: false });
      const bodyG = [], glowG = [];
      const machine = (x, z, ry, kind) => {
        const grp = new T.Group();
        const add = (geo, list, px, py, pz, rx = 0) => { geo.rotateX(rx); geo.translate(px, py, pz); list.push(geo); };
        const cab = new T.BoxGeometry(30, 16, 60); add(cab, bodyG, 0, -76 + 34, 0);
        for (const [lx, lz] of [[-13, -27], [13, -27], [-13, 27], [13, 27]]) add(new T.BoxGeometry(2.2, 26, 2.2), bodyG, lx, -76 + 13, lz);
        const bb = new T.BoxGeometry(30, 26, 7); add(bb, bodyG, 0, -76 + 55, -31);
        // backglass (u: atlas cell)
        const bg = new T.PlaneGeometry(26, 20); const uv = bg.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (kind + uv.getX(i)) / 4, 0.5 + uv.getY(i) * 0.5);
        add(bg, glowG, 0, -76 + 56, -27.4);
        const pf = new T.PlaneGeometry(26, 54); const uv2 = pf.attributes.uv;
        for (let i = 0; i < uv2.count; i++) uv2.setXY(i, (kind + uv2.getX(i)) / 4, uv2.getY(i) * 0.5);
        add(pf, glowG, 0, -76 + 42.2, 1, -PI / 2 + 0.06);
        const m = new T.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
        for (const list of [bodyG, glowG]) for (let k = list.length - (list === bodyG ? 6 : 2); k < list.length; k++) list[k].applyMatrix4(m);
      };
      let kind = 0;
      for (const x of [-230, -150, -70, 70, 150, 230]) machine(x, -150, 0, kind++ % 4);
      for (const x of [-190, -100, 100, 190]) machine(x, 165, PI, kind++ % 4);
      for (const z of [-60, 30]) { machine(-260, z, PI / 2, kind++ % 4); machine(262, z, -PI / 2, kind++ % 4); }
      const mergeAll = (list) => BU.mergeGeometries(list.map((g) => { const q = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }), false);
      K.add(new T.Mesh(mergeAll(bodyG), K.std({ color: 0x18121e, roughness: 0.5, metalness: 0.2 })), { cast: false });
      K.add(new T.Mesh(mergeAll(glowG), new T.MeshBasicMaterial({ map: aT, color: 0xffffff })), { cast: false });
      // a few pools of coloured light on the carpet in front of them
      for (const [x, z, col] of [[-150, -110, 0xff2f8f], [70, -110, 0x2fd8ff], [230, -112, 0x8f5cff], [-100, 125, 0xffb02f], [-230, -40, 0x2f6fff], [235, 40, 0xff5f2f]]) glow(x, -75.5, z, 120, col, 0.5);
    }

    // ================================================================================================
    // APRON with instruction cards, the drain, outlane guides
    // ================================================================================================
    {
      const c = TX.makeCanvas(256, 1024), g = c.getContext('2d');
      // u across x (APRON_X..-150), v along z ; canvas x = (x - (-150)) / 22 * 256 ; canvas y = (z + 63.5) / 127 * 1024
      const q = g.createLinearGradient(0, 0, 256, 0); q.addColorStop(0, '#2a2d38'); q.addColorStop(1, '#4a4f5e');
      g.fillStyle = q; g.fillRect(0, 0, 256, 1024);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rr() * 0.06})`; g.fillRect(rr() * 256, rr() * 1024, 2, 1); }
      g.fillStyle = '#ff5fb8'; g.fillRect(222, 0, 10, 1024); g.fillStyle = '#36e0ff'; g.fillRect(236, 0, 6, 1024);
      const card = (y0, lines, title) => {
        g.save(); g.translate(110, y0); g.rotate(PI / 2);
        g.fillStyle = '#f4ecd8'; g.fillRect(-150, -80, 300, 160);
        g.strokeStyle = '#c0392b'; g.lineWidth = 5; g.strokeRect(-142, -72, 284, 144);
        g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.font = '700 26px Rubik, sans-serif'; g.fillText(title, 0, -40);
        g.font = '17px Rubik, sans-serif'; lines.forEach((l, i) => g.fillText(l, 0, -10 + i * 22));
        g.restore();
      };
      card(250, ['STAR targets light SPECIAL', 'RACE lanes advance bonus', 'Jets score 1,000 each'], 'HOW TO RACE');
      card(780, ['3 laps per race', 'Replay at 4,000,000', 'Do not drain!'], 'TURBO GALAXY');
      g.fillStyle = '#ffd84a'; g.font = '700 30px "Lilita One", Impact, sans-serif'; g.textAlign = 'center';
      g.save(); g.translate(170, 512); g.rotate(PI / 2); g.fillText('INSERT COIN', 0, 0); g.restore();
      const tex = TX.toTexture(c, { wrap: false });
      // shape with a notch for the drain
      const pts = [[-150, -63.5], [APRON_X, -63.5], [APRON_X, -12], [-125, -9], [-123.5, -4], [-123.5, 4], [-125, 9], [APRON_X, 12], [APRON_X, 63.2], [-150, 63.2]];
      const sh = new T.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); for (const p of pts.slice(1)) sh.lineTo(p[0], -p[1]); sh.closePath();
      const geo = new T.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.4, bevelSegments: 2, curveSegments: 4 });
      geo.rotateX(-PI / 2);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 150) / 22, 1 - (pos.getZ(i) + 63.5) / 127);
      const ap = K.mesh(geo, K.phys({ map: tex, metalness: 0.5, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }), 0, 0, 0, { cast: false });
      keep.push(ap);
      K.box(-139, 0, 11, 63.5, 0, 1.8);
      AO(-127, 0, 3, 60, 0.5);
      // the drain: dark outhole with a chrome lip, half under the apron
      K.mesh(new T.CircleGeometry(DRAIN.r, 40), new T.MeshBasicMaterial({ color: 0x000000 }), DRAIN.x, 0.05, DRAIN.z, { rx: -PI / 2, cast: false });
      const lip = K.mesh(new T.TorusGeometry(DRAIN.r + 0.2, 0.45, 8, 40), chrome, DRAIN.x, 0.15, DRAIN.z, { rx: PI / 2, cast: false });
      lip.scale.z = 0.5;
      K.hole(DRAIN.x, DRAIN.z, DRAIN.r);
      glow(DRAIN.x + 2, 0.1, 0, 22, 0xff4020, 0.35);
      // outlane / inlane guides in the bottom corners
      for (const sd of [-1, 1]) {
        rail([[-127, sd * 61], [-117, sd * 50], [-106, sd * 38]], { wires: [1.4, 3.0] });
        post(-106, sd * 36.5, 5);
        post(-121, sd * 44, 4.5);
        insert('arrow', -114, sd * 56, 1.6, 0x36e0ff, PI + sd * 0.7, 'chase', 0.2);
        insert('arrow', -120, sd * 52, 1.6, 0x36e0ff, PI + sd * 0.7, 'chase', 0.4);
        bulb(-133, sd * 40, 1.6);
      }
    }

    // ================================================================================================
    // FLIPPERS (movers) with their warning lights
    // ================================================================================================
    {
      const R0 = 3.0, R1 = 1.6, Lf = FLIP.L;
      const ct = Math.acos((R0 - R1) / Lf);
      const outline = (grow = 0) => {
        const s = new T.Shape(), n = 14;
        const a0 = R0 + grow, a1 = R1 + grow;
        for (let i = 0; i <= n; i++) { const a = ct - i * (2 * ct) / n; const x = Lf + Math.cos(a) * a1, y = Math.sin(a) * a1; i ? s.lineTo(x, y) : s.moveTo(x, y); }
        for (let i = 0; i <= n * 2; i++) { const a = -ct - i * (TAU - 2 * ct) / (n * 2); s.lineTo(Math.cos(a) * a0, Math.sin(a) * a0); }
        s.closePath();
        return s;
      };
      const body = new T.ExtrudeGeometry(outline(-0.25), { depth: 2.8, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2 });
      body.rotateX(-PI / 2); body.translate(0, 0.35, 0);
      const ringS = outline(0.55); ringS.holes.push(new T.Path(outline(-0.2).getPoints(28).reverse()));
      const ring = new T.ExtrudeGeometry(ringS, { depth: 1.5, bevelEnabled: false });
      ring.rotateX(-PI / 2); ring.translate(0, 0.8, 0);
      const capG = new T.CylinderGeometry(1.2, 1.2, 0.8, 16); capG.translate(0, 3.8, 0);
      const flipGeo = BU.mergeGeometries([vc(body, 0xfbfaf6), vc(ring, 0xc0141c), vc(capG, 0x9aa0aa)], false);
      const flipMat = K.phys({ vertexColors: true, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.1 });
      // printed logo on the bat top
      const logoC = TX.makeCanvas(256, 64), lg = logoC.getContext('2d');
      lg.fillStyle = '#fbfaf6'; lg.fillRect(0, 0, 256, 64);
      lg.font = '40px "Lilita One", Impact, sans-serif'; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillStyle = '#d0202a'; lg.fillText('TURBO', 140, 34);
      const logoT = TX.toTexture(logoC, { wrap: false });
      const logo = new T.PlaneGeometry(17, 3.4); logo.rotateX(-PI / 2); logo.translate(12.5, 3.47, 0);
      A.flips = [];
      for (let i = 0; i < 2; i++) {
        const grp = new T.Group();
        const fm = new T.Mesh(flipGeo, flipMat); fm.castShadow = true; fm.receiveShadow = true; grp.add(fm);
        const lm = new T.Mesh(logo, K.phys({ map: logoT, roughness: 0.25, clearcoat: 0.9, transparent: false }));
        grp.add(lm);
        const [px, pz] = FLIP.piv[i];
        grp.position.set(px, 0, pz);
        K.group.add(grp); keep.push(grp);
        const mv = K.mover({ type: 'capsule', r: FLIP.r, h: 3.6 }, (t) => { const q = flipPose(t, i); return { x1: q.x1, z1: q.z1, x2: q.x2, z2: q.z2, kick: q.st.up ? 22 : 0 }; });
        // warning inserts (flash before each flip) and a light pool
        const wi = [];
        for (let k = 0; k < 3; k++) wi.push(insert('arrow', -93 + k * 4.2, (i ? 1 : -1) * (16 - k * 1.4), 1.25, 0xff3020, (i ? -1 : 1) * 0.35, 'flipwarn'));
        const gi = glow(px + 4, 0.12, pz * 0.55, 30, 0xff3020, 0);
        A.flips.push({ grp, mv, wi, gi, i, last: 0 });
        AO(px, pz, 4, 4, 0.45);
      }
      // rubber posts round the flipper pivots
      for (const sd of [-1, 1]) post(-104, sd * 33.5, 4.5);
    }

    // ================================================================================================
    // SLINGSHOTS: rubber triangles with a kicking face and a printed plastic on top
    // ================================================================================================
    A.slings = [];
    const plastics = []; // {pts: [[x,z]...] world outline, y, art(g, P)}
    const plastic = (pts, y, art) => plastics.push({ pts, y, art });
    const keyline = (g, pts, col = '#120818', w = 0.7) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath(); g.lineJoin = 'round'; g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
    const grad = (g, P, stops, vertical = false) => {
      const q = vertical ? g.createLinearGradient(0, P.z0, 0, P.z1) : g.createLinearGradient(P.x0, 0, P.x1, 0);
      stops.forEach((c, i) => q.addColorStop(i / (stops.length - 1), c));
      g.fillStyle = q; g.fillRect(P.x0 - 1, P.z0 - 1, P.x1 - P.x0 + 2, P.z1 - P.z0 + 2);
    };
    {
      for (const sd of [-1, 1]) {
        const Q = SLING.map(([x, z]) => [x, sd < 0 ? z : -z]);
        const [a, b, c] = Q;
        const face = K.capsule(a[0], a[1], b[0], b[1], 1.5, 4.5, { kick: 30 });
        K.capsule(b[0], b[1], c[0], c[1], 1.5, 4.5, { bounce: 0.6 });
        K.capsule(c[0], c[1], a[0], a[1], 1.5, 4.5, { bounce: 0.6 });
        for (const p of Q) post(p[0], p[1], 5.6, false, false);
        // rubber band round the three posts (a thin extruded loop)
        const shp = new T.Shape(); shp.moveTo(a[0], -a[1]); shp.lineTo(b[0], -b[1]); shp.lineTo(c[0], -c[1]); shp.closePath();
        const loopPts = (grow) => {
          const out = []; const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[1] + b[1] + c[1]) / 3;
          for (const p of [a, b, c]) { const dx = p[0] - cx, dz = p[1] - cz, l = Math.hypot(dx, dz); out.push(new T.Vector2(p[0] + dx / l * grow, -(p[1] + dz / l * grow))); }
          return out;
        };
        const band = new T.Shape(loopPts(2.0)); band.holes.push(new T.Path(loopPts(1.2).reverse()));
        const bg = new T.ExtrudeGeometry(band, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 });
        bg.rotateX(-PI / 2); bg.translate(0, 0.9, 0);
        const bm = K.mesh(bg, rubber, 0, 0, 0, { cast: false });
        keep.push(bm);
        // white plastic sling cover on top, printed
        const cover = new T.Shape(loopPts(2.4));
        const cpts = loopPts(2.4).map((v) => [v.x, -v.y]);
        plastic(cpts, 6.0, (g, P) => {
          grad(g, P, sd < 0 ? ['#ff4fb0', '#8a2bd8'] : ['#ff4fb0', '#2b8ad8'], true);
          const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[1] + b[1] + c[1]) / 3;
          g.fillStyle = sd < 0 ? '#ffd84a' : '#7ff6ff'; star5(g, cx, cz, 6.2, 2.7); g.fill(); g.lineWidth = 0.6; g.strokeStyle = '#120818'; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 6; k++) sparkle(g, cx + Math.cos(k * 1.7) * 7, cz + Math.sin(k * 2.3) * 7, 0.9);
          keyline(g, cpts, '#ffffff', 1.4); keyline(g, cpts, '#120818', 0.7);
        });
        // kicker light under the plastic
        const gi = glow((a[0] + b[0] + c[0]) / 3 + 3, 0.12, (a[1] + b[1] + c[1]) / 3, 26, 0xff60c0, 0.25);
        bulb((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 1.3);
        A.slings.push({ c: face, last: 0, gi, band: bm, t: 0, nx: 0.866, nz: sd < 0 ? 0.5 : -0.5 });
        AO((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, 10, 8, 0.4);
      }
      // bonus ladder inserts between the slings and the shoot-again light
      for (let i = 0; i < 5; i++) insert('circle', -71 + i * 5.8, 0.5, 1.5, 0xffb020, 0, 'ladder', i);
      insert('tri', -101, 6.6, 1.6, 0xff3060, PI, 'blink', 0.3);
      insert('tri', -101, -6.6, 1.6, 0xff3060, 0, 'blink', 0.3);
    }

    // ================================================================================================
    // POP BUMPERS (kickers) in the bay
    // ================================================================================================
    A.bumpers = [];
    {
      // white cap art, tinted per bumper through the instance colour
      const capTex = (() => {
        const c = TX.makeCanvas(256, 256), g = c.getContext('2d');
        const q = g.createRadialGradient(118, 110, 10, 128, 128, 128); q.addColorStop(0, '#ffffff'); q.addColorStop(0.75, '#f2f2f2'); q.addColorStop(1, '#b8b8b8');
        g.fillStyle = q; g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#7a7a7a'; star5(g, 128, 128, 96, 42); g.fill();
        g.fillStyle = '#ffffff'; star5(g, 128, 128, 84, 36); g.fill();
        g.fillStyle = '#2a2a2a'; g.font = '40px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1000', 128, 134);
        g.strokeStyle = '#3a3a3a'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 121, 0, TAU); g.stroke();
        return TX.toTexture(c, { wrap: false });
      })();
      const capCols = [0xff4fb0, 0xffc12e, 0x3ad8ff];
      const statics = [], capList = [], ringList = [];
      for (let i = 0; i < BUMP.length; i++) {
        const [x, z] = BUMP[i];
        warnRoad('bumper', x, z, BUMP_R);
        const g1 = new T.CylinderGeometry(7.6, 7.9, 0.7, 40); g1.translate(x, 0.35, z); statics.push(vc(g1, 0x141018));
        const g2 = K.lathe([[7.2, 0], [7.3, 0.5], [6.8, 1.6], [5.6, 2.1], [5.4, 2.0]], 40); g2.translate(x, 0.7, z); statics.push(vc(g2, 0x1a7cff));
        const g3 = new T.CylinderGeometry(4.6, 4.9, 4.4, 32, 1, true); g3.translate(x, 4.2, z); statics.push(vc(g3, 0xfff3e2));
        capList.push({ x, y: 6.4, z, color: capCols[i] });
        ringList.push({ x, y: 3.0, z, rx: PI / 2 });
        const c = K.circle(x, z, BUMP_R, 8.5, { kick: 34 });
        const gi = glow(x, 0.14, z, 34, capCols[i], 0.32);
        A.bumpers.push({ i, x, z, c, last: 0, gi, flash: 0, col: new T.Color(capCols[i]) });
        AO(x, z, 9.5, 9.5, 0.5);
        for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.4; bulb(x + Math.cos(a) * 9.4, z + Math.sin(a) * 9.4, 1.2); }
      }
      keep.push(K.add(new T.Mesh(BU.mergeGeometries(statics, false), K.phys({ vertexColors: true, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }))));
      const capGeo = K.lathe([[0, -0.1], [6.3, -0.1], [6.7, 0], [6.6, 0.5], [5.8, 1.1], [3, 1.45], [0, 1.5]], 40);
      { const pos = capGeo.attributes.position, uv = capGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / 13.4, 0.5 - pos.getZ(i) / 13.4); }
      const capMat = K.phys({ map: capTex, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xffffff, emissiveMap: capTex, emissiveIntensity: 0.22 });
      A.caps = K.instances(capGeo, capMat, capList, { colors: true, cast: true });
      A.rings = K.instances(new T.TorusGeometry(5.6, 0.45, 8, 40), chrome, ringList, { cast: false });
      keep.push(A.caps, A.rings);
    }

    // ================================================================================================
    // DROP TARGETS (STAR bank) inside the bay's U-turn
    // ================================================================================================
    A.drops = [];
    {
      const tc = TX.makeCanvas(128, 128), g = tc.getContext('2d');
      g.fillStyle = '#ffcc1a'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#e0181a'; star5(g, 64, 70, 46, 20); g.fill();
      g.strokeStyle = '#7a3a00'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
      const tmat = K.phys({ map: TX.toTexture(tc, { wrap: false }), roughness: 0.3, clearcoat: 0.7 });
      const geo = new K.RoundedBoxGeometry(1.1, 5.0, 4.4, 2, 0.2);
      const list = [];
      for (let i = 0; i < 4; i++) {
        const a = PI * (150 + i * 20) / 180;
        const R = 13.4, x = BAY.x + Math.cos(a) * R, z = BAY.z + Math.sin(a) * R;
        list.push({ x, y: 2.5, z, ry: -a });
        const c = K.box(x, z, 0.55, 2.2, a, 5);
        A.drops.push({ c, x, z, a, down: 0, last: 0, t: 0, y: 2.5 });
        insert('circle', BAY.x + Math.cos(a) * 10.2, BAY.z + Math.sin(a) * 10.2, 0.9, 0xffd23a, 0, 'drop', i);
        AO(x, z, 2.4, 3.2, 0.4, a);
      }
      A.dropIM = K.instances(geo, tmat, list, { cast: true });
      keep.push(A.dropIM);
      // the bank's black plastic frame behind the targets
      K.mesh(new T.TorusGeometry(12.3, 0.5, 6, 30, PI * 0.42), blackPl, BAY.x, 0.6, BAY.z, { rx: -PI / 2, rz: PI * (180 - 39) / 180 });
    }

    // ================================================================================================
    // TOP LANES ("RACE") and the shooter lane / arc guides
    // ================================================================================================
    A.lanes = [];
    {
      for (const z of TOPLANES) {
        K.capsule(124, z, 138, z, 0.9, 4.2);
        const g = new T.CapsuleGeometry(0.9, 14, 4, 10); g.rotateZ(PI / 2); g.translate(131, 2.0, z);
        railGeos.push(g);
        post(123, z, 4.5, true, false);
        AO(131, z, 8, 1.8, 0.35);
      }
      for (let i = 0; i < 4; i++) {
        const z = (TOPLANES[i] + TOPLANES[i + 1]) / 2;
        A.lanes.push({ z, ins: insert('circle', 118, z, 1.5, [0xff3d8a, 0x3dd8ff, 0xffd23a, 0x7dff5a][i], 0, 'lane', i), t: 0 });
        // rollover wire
        const w = new T.TorusGeometry(2.4, 0.18, 4, 16, PI); w.rotateY(PI / 2); w.scale(1, 0.3, 1); w.translate(131, 0, z); railGeos.push(w);
        bulb(140, z, 1.2, false);
      }
      // shooter lane separator wall and the corner arcs
      rail([[-149, LANE.zw], [-60, LANE.zw], [40, LANE.zw], [LANE.x1, LANE.zw]], { wires: [1.2, 2.8], postStep: 14 });
      const arcPts = [];
      for (let k = 0; k <= 10; k++) { const a = PI / 2 - k * PI / 20; arcPts.push([126 + Math.cos(a) * 24, 51 + Math.sin(a) * 24]); }
      const sw = [];
      for (let k = 0; k <= 12; k++) { const a = PI / 2 - k * (PI / 2) / 12; sw.push([150 - 24 + Math.cos(a) * 24, 75 - 24 + Math.sin(a) * 24]); }
      // SE corner: a curved steel wall the ball rides round
      const seg = (pts, h, mat, th = 0.8) => {
        for (let k = 0; k < pts.length - 1; k++) {
          const [x1, z1] = pts[k], [x2, z2] = pts[k + 1];
          const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
          const g = new T.BoxGeometry(len + 0.1, h, th); g.rotateY(-ang); g.translate((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
          railGeos.push(g);
          K.capsule(x1, z1, x2, z2, th / 2 + 0.3, h, { bounce: 0.5 });
        }
      };
      seg(sw, 4.6, steel);
      const nw = [];
      for (let k = 0; k <= 12; k++) { const a = -PI / 2 + k * (PI / 2) / 12; nw.push([150 - 30 + Math.cos(a) * 30, -75 + 30 + Math.sin(a) * 30]); }
      seg(nw, 4.6, steel);
      // wooden infill behind the corner arcs
      const fillMat = K.phys({ color: 0x2a1640, roughness: 0.5, clearcoat: 0.6 });
      const fill = (pts, cx, cz) => { const poly = pts.concat([[cx, cz]]); K.flatShape(poly, fillMat, 0.07); };
      fill(sw, 150, 75); fill(nw, 150, -75);
      // lane-guide plastic over the top lanes
      const tl = new T.Shape(); tl.moveTo(121, 23); tl.lineTo(139.5, 23); tl.lineTo(139.5, -23); tl.lineTo(121, -23); tl.quadraticCurveTo(115, 0, 121, 23);
      const tpts = tl.getPoints(8).map((v) => [v.x, -v.y]);
      plastic(tpts, 7.6, (g, P) => {
        grad(g, P, ['#a65cff', '#36e0ff', '#a65cff'], true);
        g.save(); g.translate(131, 0); g.rotate(-PI / 2);
        outlinedText(g, 'RACE  LANES', 0, 0, '6px "Lilita One", Impact, sans-serif', '#ffffff', '#120818', 1.1);
        g.restore();
        g.fillStyle = '#ffd84a'; for (const z of [-17, 17]) { star5(g, 131, z, 2.6, 1.1); g.fill(); }
        keyline(g, tpts, '#ffffff', 1.4); keyline(g, tpts, '#120818', 0.7);
      });
      for (const [x, z] of [[122, 21.5], [122, -21.5], [138.5, 21.5], [138.5, -21.5]]) post(x, z, 7.6, false, true);
    }

    // ================================================================================================
    // SPINNER over the north straight
    // ================================================================================================
    {
      const s = sAt(55, -58), p = track.at(s);
      const hw = p.w / 2 + 2.6;
      const grp = new T.Group();
      grp.position.set(p.x, 0, p.z); grp.rotation.y = -p.angle;
      for (const sd of [-1, 1]) {
        const pm = new T.Mesh(new T.CylinderGeometry(0.55, 0.7, 10.5, 10), chrome); pm.position.set(0, 5.25, sd * hw); grp.add(pm);
        const q = track.place(s, sd * hw); K.circle(q.x, q.z, 0.9, 10.5); AO(q.x, q.z, 1.6, 1.6, 0.4);
      }
      const bar = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 2 * hw, 8), chrome); bar.rotation.x = PI / 2; bar.position.y = 9.6; grp.add(bar);
      const flagT = (() => { const c = TX.makeCanvas(256, 64), g = c.getContext('2d'); const q = g.createLinearGradient(0, 0, 256, 0); q.addColorStop(0, '#9aa2ad'); q.addColorStop(0.5, '#f4f6fa'); q.addColorStop(1, '#8a929c'); g.fillStyle = q; g.fillRect(0, 0, 256, 64); g.fillStyle = '#d0202a'; g.font = '700 34px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SPINNER', 128, 34); return TX.toTexture(c, { wrap: false }); })();
      const flag = new T.Group(); flag.position.y = 9.6; grp.add(flag);
      const flagM = K.metal(0xffffff, 0.18, { map: flagT });
      const fm = new T.Mesh(new T.BoxGeometry(0.3, 4.6, 2 * hw - 2.6), flagM);
      fm.position.y = -2.5; flag.add(fm);
      K.add(grp); keep.push(flag);
      A.spinner = { flag, s, x: p.x, z: p.z, w: 0, ang: 0 };
    }

    // ================================================================================================
    // ACRYLIC JUMP RAMP on the south straight (heading west)
    // ================================================================================================
    {
      const sJ = sAt(54, 51.3), LEN = 14, HGT = 3.8, WID = 13.6;
      const p = track.at(sJ);
      K.ramp(p.x, p.z, p.angle, LEN, WID, HGT);
      const grp = new T.Group(); grp.position.set(p.x, 0, p.z); grp.rotation.y = -p.angle;
      // wedge: clear acrylic with lit chevrons printed on it
      const sh = new T.Shape(); sh.moveTo(-LEN / 2, 0); sh.lineTo(LEN / 2, HGT); sh.lineTo(LEN / 2, 0); sh.closePath();
      const wg = new T.ExtrudeGeometry(sh, { depth: WID, bevelEnabled: false }); wg.translate(0, 0, -WID / 2);
      const acr = K.phys({ color: 0x9fd8ff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.3, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false });
      // the wedge's triangular side panels are opaque printed plastic (they show the ramp's height), its top is clear
      const sideP = (() => { const c = TX.makeCanvas(256, 64), g = c.getContext('2d'); const q = g.createLinearGradient(0, 0, 256, 0); q.addColorStop(0, '#ff4fb0'); q.addColorStop(1, '#a03cff'); g.fillStyle = q; g.fillRect(0, 0, 256, 64); g.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 9; k++) g.fillRect(k * 30 + 6, 0, 10, 64); return TX.toTexture(c, { wrap: false }); })();
      const wedge = new T.Mesh(wg, [K.phys({ map: sideP, roughness: 0.25, clearcoat: 1, side: T.DoubleSide }), acr]); wedge.renderOrder = 2; grp.add(wedge);
      { const pos = wg.attributes.position, uv = wg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + LEN / 2) / LEN, pos.getY(i) / HGT); }
      // top deck: printed chevrons (opaque, readable surface to drive on)
      const dc = TX.makeCanvas(256, 256), dg = dc.getContext('2d');
      const dq = dg.createLinearGradient(0, 0, 256, 0); dq.addColorStop(0, 'rgba(30,60,140,0.55)'); dq.addColorStop(0.75, 'rgba(70,170,255,0.85)'); dq.addColorStop(1, 'rgba(200,240,255,0.95)');
      dg.fillStyle = dq; dg.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 3; k++) { dg.strokeStyle = `rgba(255,214,60,${0.55 + k * 0.2})`; dg.lineWidth = 16; dg.lineJoin = 'miter'; dg.beginPath(); const x = 40 + k * 66; dg.moveTo(x, 44); dg.lineTo(x + 46, 128); dg.lineTo(x, 212); dg.stroke(); }
      dg.fillStyle = 'rgba(255,255,255,0.9)'; dg.fillRect(0, 4, 256, 8); dg.fillRect(0, 244, 256, 8);
      const deckT = TX.toTexture(dc, { wrap: false });
      const deckLen = Math.hypot(LEN, HGT);
      const deck = new T.Mesh(new T.PlaneGeometry(deckLen, WID - 0.6), K.phys({ map: deckT, emissive: 0xffffff, emissiveMap: deckT, emissiveIntensity: 0.45, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.95, depthWrite: false, envMapIntensity: 1.4 }));
      deck.renderOrder = 3;
      deck.rotation.order = 'ZXY'; deck.rotation.x = -PI / 2; deck.rotation.z = Math.atan2(HGT, LEN); deck.position.set(0, HGT / 2 + 0.06, 0); grp.add(deck);
      // chrome side rails and the steel entry flap
      const flG = [];
      for (const sd of [-1, 1]) {
        const g = new T.CylinderGeometry(0.3, 0.3, deckLen + 0.6, 8); const m = new T.Mesh(g, chrome);
        m.rotation.z = PI / 2 + Math.atan2(HGT, LEN); m.position.set(0, HGT / 2 + 2.3, sd * (WID / 2 + 0.2)); grp.add(m);
        for (const ex of [-LEN / 2 + 0.4, 0, LEN / 2]) {
          const hh = HGT * (ex + LEN / 2) / LEN + 2.3;
          const lp = new T.Mesh(new T.CylinderGeometry(0.28, 0.32, hh, 8), chrome); lp.position.set(ex, hh / 2, sd * (WID / 2 + 0.2)); grp.add(lp);
        }
        // clear acrylic side flange
        const fs = new T.Shape(); fs.moveTo(-LEN / 2, 0); fs.lineTo(LEN / 2, HGT); fs.lineTo(LEN / 2, HGT + 2.3); fs.lineTo(-LEN / 2, 2.3); fs.closePath();
        const fg = new T.ExtrudeGeometry(fs, { depth: 0.3, bevelEnabled: false }); fg.translate(0, 0, sd * (WID / 2 + 0.2) - 0.15);
        flG.push(fg);
      }
      const fl = new T.Mesh(BU.mergeGeometries(flG, false), K.phys({ color: 0xff7ad9, emissive: 0x5a1040, roughness: 0.04, transparent: true, opacity: 0.5, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false, side: T.DoubleSide }));
      // steel lip across the top end, and a lit strip under it
      const lipM = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, WID + 0.8, 10), chrome); lipM.rotation.x = PI / 2; lipM.position.set(LEN / 2, HGT + 0.1, 0); grp.add(lipM);
      const strip = new T.Mesh(new T.BoxGeometry(0.5, 0.5, WID - 1), K.std({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 2.4 })); strip.position.set(LEN / 2 - 0.3, HGT - 0.45, 0); grp.add(strip);
      fl.renderOrder = 3; grp.add(fl);
      const flap = new T.Mesh(new T.BoxGeometry(1.6, 0.12, WID), steel); flap.position.set(-LEN / 2 - 0.5, 0.06, 0); grp.add(flap);
      K.add(grp);
      AO(p.x, p.z, 8, 7.5, 0.35, p.angle);
      glow(p.x - p.tx * 2, 0.15, p.z - p.tz * 2, 26, 0x36e0ff, 0.45);
      // landing inserts
      for (let k = 0; k < 3; k++) { const q = track.place(sJ + 18 + k * 4, 0); insert('arrow', q.x, q.z, 2.2, 0x36e0ff, q.angle, 'chase', k * 0.25); }
    }

    // ================================================================================================
    // PLASTICS on posts (atlas-printed, translucent, lit from below)
    // ================================================================================================
    {
      // rocket plastic in the bay
      const half = [[44, 0], [41, -2.6], [36, -4.3], [28, -5.4], [20, -5.6], [14, -5.2], [8, -10.5], [3.5, -10.2], [6.5, -3.8], [3.5, -2.6], [2.5, 0]];
      const rkp = half.concat(half.slice(1, -1).reverse().map(([x, y]) => [x, -y]));
      const rk = new T.Shape(rkp.map(([x, y]) => new T.Vector2(x, y)));
      const rpts = rkp.map(([x, y]) => [x - 2, -(y + 2.5)]);
      plastic(rpts, 7.0, (g, P) => {
        const zc = -2.5;
        grad(g, P, ['#d8dde8', '#ffffff', '#c8ceda'], true);
        g.fillStyle = '#ff4a2a'; g.beginPath(); g.moveTo(31, zc - 6); g.quadraticCurveTo(40, zc - 3, 43, zc); g.quadraticCurveTo(40, zc + 3, 31, zc + 6); g.closePath(); g.fill();
        g.fillStyle = '#d0202a'; g.fillRect(9, zc - 12, 9, 24); g.fillRect(22, zc - 6, 1.6, 12);
        g.fillStyle = '#3aa8ff'; g.beginPath(); g.arc(27, zc, 2.6, 0, TAU); g.fill(); g.lineWidth = 0.7; g.strokeStyle = '#1a1a2a'; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(26.2, zc - 0.9, 0.8, 0, TAU); g.fill();
        outlinedText(g, 'TURBO', 15.5, zc + 0.2, '4.2px "Lilita One", Impact, sans-serif', '#ffd84a', '#120818', 0.8);
        keyline(g, rpts, '#120818', 0.8);
      });
      for (const [x, z] of [[6, -6], [6, 1], [36, -2.5]]) post(x, z, 7.0, false, true);
      // outlane plastics over the bottom corners
      for (const sd of [-1, 1]) {
        const zo = sd < 0 ? -74 : 62;
        const s2 = new T.Shape(); const P = [[-148, zo], [-106, zo], [-100, sd * 58], [-116, sd * 46], [-148, sd * 50]];
        s2.moveTo(P[0][0], -P[0][1]); for (const q of P.slice(1)) s2.lineTo(q[0], -q[1]); s2.closePath();
        plastic(P, 6.2, (g, Q) => {
          grad(g, Q, sd < 0 ? ['#ff8a1a', '#ffd84a'] : ['#2b8ad8', '#36e0ff'], false);
          const cx = -125, cz = sd < 0 ? -63 : 54;
          g.save(); g.translate(cx, cz);
          for (let k = 0; k < 16; k++) { g.rotate(TAU / 16); g.fillStyle = k % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(40, -5); g.lineTo(40, 5); g.fill(); }
          g.restore();
          outlinedText(g, sd < 0 ? 'SPECIAL' : 'EXTRA BALL', cx, cz, (sd < 0 ? '6px' : '4.6px') + ' "Lilita One", Impact, sans-serif', '#ffffff', '#120818', 1.1);
          keyline(g, P, '#ffffff', 1.4); keyline(g, P, '#120818', 0.7);
        });
        for (const [x, z] of [[-112, sd < 0 ? -70 : 59], [-104, sd * 57]]) post(x, z, 6.2, false, true);
      }
      // atlas: each plastic's outline bbox gets its own rect (shelf-packed, same px per unit), art drawn in world units
      const AW = 1024, AH = 512, PX = 6.2, PAD = 6;
      for (const pl of plastics) {
        const xs = pl.pts.map((q) => q[0]), zs = pl.pts.map((q) => q[1]);
        pl.P = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
        pl.w = Math.ceil((pl.P.x1 - pl.P.x0) * PX), pl.h = Math.ceil((pl.P.z1 - pl.P.z0) * PX);
      }
      const order = plastics.slice().sort((p1, p2) => p2.h - p1.h);
      let cx = 0, cy = 0, shelf = 0;
      for (const pl of order) {
        if (cx + pl.w + PAD > AW) { cx = 0; cy += shelf + PAD; shelf = 0; }
        pl.rx = cx; pl.ry = cy; cx += pl.w + PAD; shelf = Math.max(shelf, pl.h);
      }
      if (cy + shelf > AH) console.warn('pinball: plastic atlas overflow');
      const AT = TX.makeCanvas(AW, AH), ag = AT.getContext('2d');
      for (const pl of plastics) {
        ag.save();
        ag.beginPath(); ag.rect(pl.rx, pl.ry, pl.w, pl.h); ag.clip();
        ag.setTransform(PX, 0, 0, PX, pl.rx - pl.P.x0 * PX, pl.ry - pl.P.z0 * PX);
        pl.art(ag, pl.P);
        ag.restore();
      }
      const atT = TX.toTexture(AT, { wrap: false });
      const geos = [];
      for (const pl of plastics) {
        const sh = new T.Shape(pl.pts.map(([x, z]) => new T.Vector2(x, -z)));
        const g0 = new T.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.12, bevelSegments: 1 });
        const g = g0.index ? g0.toNonIndexed() : g0;
        g.rotateX(-PI / 2); g.translate(0, pl.y, 0);
        const pos = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          const px = pl.rx + (pos.getX(i) - pl.P.x0) * PX, py = pl.ry + (pos.getZ(i) - pl.P.z0) * PX;
          uv.setXY(i, px / AW, 1 - py / AH);
        }
        g.clearGroups();
        geos.push(g);
        AO((pl.P.x0 + pl.P.x1) / 2, (pl.P.z0 + pl.P.z1) / 2, (pl.P.x1 - pl.P.x0) * 0.42, (pl.P.z1 - pl.P.z0) * 0.42, 0.2);
      }
      const pm = new T.Mesh(BU.mergeGeometries(geos, false), K.phys({ map: atT, emissive: 0xffffff, emissiveMap: atT, emissiveIntensity: 0.3, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.9, envMapIntensity: 1.3 }));
      pm.renderOrder = 2;
      K.add(pm, { cast: true, receive: true });
      keep.push(pm);
    }

    // ================================================================================================
    // ROAD EDGES: chrome wire guides on the outside of the corners and along the north orbit
    // ================================================================================================
    {
      const sN = sAt(-20, -58), sSp = sAt(55, -58), sU1b = sAt(100, -26);
      edgeRail(-1, sN, sSp - 4, 2.6);                        // north orbit (split round the spinner posts)
      edgeRail(-1, sSp + 4, sU1b - 4, 2.6);                  // ... and the outside of the first east U-turn
      const sU2a = sAt(100, 21.5), sU2b = sAt(100, 51);
      edgeRail(-1, sU2a + 4, sU2b + 6, 2.6);                 // outside of the second east U-turn
      const sSW0 = sAt(-30, 51), sSW1 = sAt(-84, 18);
      edgeRail(-1, sSW0, sSW1, 2.6);                         // south-west corner (outside = driver's left)
      const sNW0 = sAt(-83, -24); let sNW1 = sAt(-40, -58); if (sNW1 < sNW0) sNW1 += L;
      edgeRail(-1, sNW0, sNW1, 2.6);                         // north-west corner
      // bay U-turn: rubber posts on the outside of its apex
      for (const a of [140, 165, 195, 220]) { const ang = a * PI / 180; post(BAY.x + Math.cos(ang) * 33, BAY.z + Math.sin(ang) * 33, 4.5); }
      // east U-turn: a rubber post on the tip of the island, so the hairpin can't be cut across the tip
      post(107.5, 36, 5.5);
    }

    // ================================================================================================
    // INSERTS on the playfield: arrows along the lanes, rollover stars on the road, misc lamps
    // ================================================================================================
    {
      // arrow fans pointing into the bay and up the north orbit
      for (let k = 0; k < 4; k++) insert('arrow', 92 - k * 7, -2.5, 2.4, 0xff9a1a, PI, 'chase', k * 0.25);
      [-12, -6, 0, 46, 52, 92, 98].forEach((x, k) => insert('arrow', x, -42, 1.7, 0x36e0ff, 0, 'chase', k * 0.14));
      [100, 94, 58, 52, 8, 2, -4].forEach((x, k) => insert('arrow', x, 36.3, 1.7, 0xff60c0, PI, 'chase', k * 0.14));
      for (let k = 0; k < 6; k++) insert('circle', -46 + k * 4.4, -42, 1.0, 0x7dff5a, 0, 'chase', k / 6);
      for (let k = 0; k < 6; k++) insert('circle', -46 + k * 4.4, 36.3, 1.0, 0xffd23a, 0, 'chase', k / 6);
      // rollover stars on the road itself (light up as cars run over them)
      A.rollovers = [];
      for (const s of [70, 230, 300, 420, 560, 700, 760, 820]) {
        for (const off of [-3.6, 3.6]) { const q = track.place(s, off); A.rollovers.push(insert('star', q.x, q.z, 1.25, 0xfff2b0, q.angle, 'roll')); }
      }
      // GI bulbs round the edges of the playfield and under plastics
      for (let x = -90; x <= 120; x += 30) { bulb(x, -71.5); }
      for (let x = -100; x <= 110; x += 35) { bulb(x, 60.5); }
      for (const [x, z] of [[-55, -48], [-55, 44], [28, -14], [28, 9], [-104, -50], [-104, 50], [138, 30], [138, -30]]) bulb(x, z);
    }

    // ================================================================================================
    // THE STEEL BALL
    // ================================================================================================
    {
      // environment painted with arcade neon for the chrome reflections
      const c = TX.makeCanvas(512, 256), g = c.getContext('2d');
      let q = g.createLinearGradient(0, 0, 0, 256); q.addColorStop(0, '#fffaf0'); q.addColorStop(0.18, '#c9c2dc'); q.addColorStop(0.42, '#6a5a88'); q.addColorStop(0.5, '#1c1428'); q.addColorStop(0.62, '#4a3070'); q.addColorStop(1, '#7a5aa8');
      g.fillStyle = q; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 9; i++) { g.fillStyle = ['#ff2fb4', '#36e0ff', '#ffe23a', '#ffffff'][i % 4]; g.fillRect(i * 58 + 10, 70 + (i % 3) * 12, 34, 7); }
      g.fillStyle = '#ffffff'; g.fillRect(0, 4, 512, 14); g.fillRect(120, 30, 90, 8); g.fillRect(330, 34, 70, 8); // GI tubes and the glass overhead
      for (let i = 0; i < 40; i++) { g.fillStyle = ['#ff60c0', '#36e0ff', '#ffd23a'][i % 3]; g.beginPath(); g.arc(rr() * 512, 150 + rr() * 100, 2 + rr() * 4, 0, TAU); g.fill(); }
      const env = TX.toTexture(c, { wrap: false });
      env.mapping = T.EquirectangularReflectionMapping;
      const ballMat = K.std({ color: 0xffffff, metalness: 1, roughness: 0.05, envMap: env, envMapIntensity: 1.25 });
      const m = K.mesh(new T.SphereGeometry(BALL_R, 32, 20), ballMat, LANE.home, BALL_R, LANE.zc);
      keep.push(m);
      const d = K.physics.addDynamic({ x: LANE.home, z: LANE.zc, r: BALL_R, m: 4, h: BALL_R * 2, mesh: m, friction: 3.2, baseY: BALL_R, respawn: 1.6 });
      d.home = [LANE.home, LANE.zc];
      A.ball = { d, mode: 'wait', t: 0, still: 0, arcS: 0, arcV: 0, lane: 0 };
      // arc path lengths
      A.arc = ARC.map((p) => ({ x: p[0], z: p[1] }));
      let acc = 0; A.arc[0].s = 0;
      for (let i = 1; i < A.arc.length; i++) { acc += Math.hypot(A.arc[i].x - A.arc[i - 1].x, A.arc[i].z - A.arc[i - 1].z); A.arc[i].s = acc; }
      A.arcLen = acc;
      A.ballShadow = K.contact(LANE.home, LANE.zc, 3.4, 3.4, 0.5);
      keep.push(A.ballShadow);
    }

    // ================================================================================================
    // LIGHTS: a magenta pool over the jets, a cyan one over the flippers, and a flasher that fires on hits
    // ================================================================================================
    {
      const l1 = new T.PointLight(0xff3fa8, 26, 70, 1); l1.position.set(70, 16, -3); K.group.add(l1);
      const l2 = new T.PointLight(0x40c8ff, 30, 80, 1); l2.position.set(-112, 26, 0); K.group.add(l2);
      const fl = new T.PointLight(0xfff0c0, 0, 60, 1); fl.position.set(0, 12, 0); K.group.add(fl);
      A.flasher = fl; A.flashT = 0; A.white = new T.Color(0xffffff);
    }

    // ================================================================================================
    // BUILD THE BATCHES: inserts, glows, posts, rubber rings, bulbs, rails, contact shadows
    // ================================================================================================
    {
      const mk = (kind) => {
        if (kind === 'circle') { const g = new T.CircleGeometry(1, 24); g.rotateX(-PI / 2); return g; }
        const s = new T.Shape();
        if (kind === 'arrow') { s.moveTo(1.2, 0); s.lineTo(-0.6, 1.0); s.lineTo(-0.25, 0); s.lineTo(-0.6, -1.0); s.closePath(); }
        else if (kind === 'tri') { s.moveTo(1.1, 0); s.lineTo(-0.7, 0.95); s.lineTo(-0.7, -0.95); s.closePath(); }
        else { for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, q = i % 2 ? 0.45 : 1; i ? s.lineTo(Math.cos(a) * q, Math.sin(a) * q) : s.moveTo(Math.cos(a) * q, Math.sin(a) * q); } s.closePath(); }
        const g = new T.ShapeGeometry(s); g.rotateX(-PI / 2); return g;
      };
      A.ins = [];
      for (const kind of Object.keys(inserts)) {
        const list = inserts[kind];
        if (!list.length) continue;
        const mat = new T.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        const im = K.instances(mk(kind), mat, list.map((it) => ({ ...it, color: new T.Color(it.color).multiplyScalar(0.25) })), { cast: false, receive: false, colors: true });
        im.renderOrder = 1;
        A.ins.push({ im, list });
        keep.push(im);
        // bevelled insert rims
        const rim = kind === 'circle' ? new T.RingGeometry(1, 1.22, 24) : null;
        if (rim) { rim.rotateX(-PI / 2); const ri = K.instances(rim, new T.MeshBasicMaterial({ color: 0x0a0610 }), list.map((it) => ({ x: it.x, y: 0.055, z: it.z, s: it.s })), { cast: false, receive: false }); keep.push(ri); }
      }
      // glow cards
      const gc = TX.makeCanvas(128, 128), gg = gc.getContext('2d');
      const q = gg.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.25, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = q; gg.fillRect(0, 0, 128, 128);
      const gt = TX.toTexture(gc, { wrap: false });
      const gGeo = new T.PlaneGeometry(1, 1); gGeo.rotateX(-PI / 2);
      const gMat = new T.MeshBasicMaterial({ map: gt, transparent: true, blending: T.AdditiveBlending, depthWrite: false, color: 0xffffff });
      const gim = K.instances(gGeo, gMat, glowList.map((g) => ({ x: g.x, y: g.y, z: g.z, s: g.s, color: g.base })), { cast: false, receive: false, colors: true });
      gim.renderOrder = 3;
      A.glow = { im: gim, list: glowList };
      keep.push(gim);
      // posts, rubber rings, bulbs
      if (posts.length) keep.push(K.instances(new T.CylinderGeometry(0.75, 0.85, 1, 12), whitePl, posts, { cast: true }));
      if (posts.length) keep.push(K.instances(new T.CylinderGeometry(0.95, 0.95, 0.5, 12), chrome, posts.map((p) => ({ x: p.x, y: p.sy + 0.25, z: p.z })), { cast: false }));
      if (rings.length) keep.push(K.instances(new T.TorusGeometry(1.15, 0.42, 8, 20), rubber, rings, { cast: true }));
      if (bulbs.length) keep.push(K.instances(new T.SphereGeometry(0.55, 10, 8), bulbMat, bulbs, { cast: false }));
      // rails merged
      if (railGeos.length) {
        const geos = railGeos.map((g) => { const q2 = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q2.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q2.deleteAttribute(k); return q2; });
        const m = new T.Mesh(BU.mergeGeometries(geos, false), chrome);
        K.add(m, { cast: true, receive: false }); keep.push(m);
      }
      // contact shadows
      const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
      const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: TX.blobShadowTexture(), depthWrite: false });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvOp = length(instanceMatrix[1].xyz);\n#endif');
        sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vOp;');
      };
      const im = K.instances(g, mat, contacts, { cast: false, receive: false });
      im.renderOrder = 1; keep.push(im);
    }

    // merge remaining static meshes per material (fewer draw calls)
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
  },

  // fixed-rate: the steel ball (shooter lane, arc, tilt) and the drop targets
  tick(dt, time, game) {
    if (!A || !A.ball) return;
    const B = A.ball, d = B.d;
    if (d.state !== 'live') { B.mode = 'drained'; B.t = 0; return; }
    if (B.mode === 'drained') { B.mode = 'wait'; B.t = 0; }
    if (B.mode === 'wait') {
      d.x = LANE.home; d.z = LANE.zc; d.vx = d.vz = 0;
      B.t += dt;
      if (B.t > 1.5 && game.state !== 'countdown') { B.mode = 'fire'; d.vx = 105; A.fired = time; }
      return;
    }
    if (B.mode === 'fire') {
      d.z = LANE.zc; d.vz = 0; d.vx = Math.max(d.vx, 40);
      if (d.x > ARC[0][0]) { B.mode = 'arc'; B.arcS = 0; B.arcV = Math.max(55, d.vx * 0.8); }
      return;
    }
    if (B.mode === 'arc') {
      B.arcS += B.arcV * dt;
      const P = A.arc;
      if (B.arcS >= A.arcLen) {
        B.mode = 'free';
        B.lane = (B.lane + 1) % 2;
        const zz = B.lane ? -4.5 : 4.5;
        d.x = P[P.length - 1].x; d.z = zz; d.vx = -B.arcV * 0.85; d.vz = 0;
        return;
      }
      let k = 1; while (k < P.length - 1 && P[k].s < B.arcS) k++;
      const a = P[k - 1], b = P[k], f = (B.arcS - a.s) / (b.s - a.s);
      const nx = a.x + (b.x - a.x) * f, nz = a.z + (b.z - a.z) * f;
      d.vx = (nx - d.x) / dt; d.vz = (nz - d.z) / dt; d.x = nx; d.z = nz;
      return;
    }
    // free: the table's tilt pulls the ball down towards the flippers, a gentle crown keeps it off the edges
    d.vx -= TILT * dt;
    d.vz -= d.z * 0.09 * dt;
    const sp = Math.hypot(d.vx, d.vz);
    if (sp > 62) { d.vx *= 62 / sp; d.vz *= 62 / sp; }
    if (sp < 2.5) B.still += dt; else B.still = 0;
    if (B.still > 2.2) { B.still = 0; d.vx = 34; d.vz = 22 * Math.sin(time * 3.7); }
    // rolled back into the shooter lane from the top: back to the plunger
    if (d.z > LANE.zw && d.x < LANE.x1 - 4) { B.mode = 'wait'; B.t = 0; d.pop = 1; }
    // ball out of the playfield somehow: re-plunge
    if (Math.abs(d.x) > HX + 2 || Math.abs(d.z) > HZ + 2) { B.mode = 'wait'; B.t = 0; d.pop = 1; }
  },

  animate(time, dt, game) {
    if (!A) return;
    if (A.roadU) A.roadU.uTime.value = time;
    const st = game && game.state;
    const live = st === 'race' || st === 'countdown' || st === 'roundEnd' || st === 'attract';
    // flippers
    for (const F of A.flips) {
      const q = flipPose(time, F.i);
      F.grp.rotation.y = -q.a;
      const w = q.st.warn > 0 ? (Math.floor(time * 12) % 2 ? 1 : 0.15) : q.st.f > 0 ? 1 : 0;
      F.warn = w;
      A.glow.list[F.gi].k = w * 0.9;
      if (q.st.up && F.last === 0 && live && game.sound && game.sound.ctx && game.onScreen(q.x1, 0, q.z1, 0.3)) game.sound.tone(150, 0.08, { type: 'square', vol: 0.06, slideTo: 90 });
      F.last = q.st.up ? 1 : 0;
    }
    // bumpers: pop the ring and flash the cap when hit
    {
      const m4 = A._m4 || (A._m4 = new A.caps.matrixWorld.constructor());
      for (const b of A.bumpers) {
        const h = b.c.hits || 0;
        if (h !== b.last) {
          b.last = h; b.flash = 1;
          A.flasher.position.set(b.x, 12, b.z); A.flashT = 1; A.flasher.color.copy(b.col).lerp(A.white, 0.5);
          if (live && game.sound && game.sound.ctx && game.onScreen(b.x, 3, b.z, 0.2)) { game.sound.tone(520, 0.07, { type: 'square', vol: 0.07, slideTo: 260 }); }
        }
        b.flash = Math.max(0, b.flash - dt * 4);
        m4.makeRotationX(Math.PI / 2).setPosition(b.x, 3.0 - b.flash * 1.6, b.z);
        A.rings.setMatrixAt(b.i, m4);
        b._c = b._c || b.col.clone();
        b._c.copy(b.col).multiplyScalar(1 + b.flash * 1.6);
        A.caps.setColorAt(b.i, b._c);
        A.glow.list[b.gi].k = 0.32 + b.flash * 1.4;
      }
      A.rings.instanceMatrix.needsUpdate = true; A.caps.instanceColor.needsUpdate = true;
    }
    // slings
    for (const s of A.slings) {
      const h = s.c.hits || 0;
      if (h !== s.last) { s.last = h; s.t = 1; A.flasher.position.set(-60, 10, s.nz > 0 ? -22 : 22); A.flasher.color.set(0xff70d0); A.flashT = Math.max(A.flashT, 0.8); if (live && game.sound && game.sound.ctx) game.sound.tone(380, 0.06, { type: 'square', vol: 0.06, slideTo: 200 }); }
      s.t = Math.max(0, s.t - dt * 5);
      s.band.position.set(s.nx * s.t * 0.8, 0, s.nz * s.t * 0.8);
      A.glow.list[s.gi].k = 0.25 + s.t * 1.4;
    }
    // drop targets
    let allDown = true;
    for (const t of A.drops) {
      const h = t.c.hits || 0;
      if (h !== t.last) {
        t.last = h;
        if (!t.down) { t.down = 1; t.t = 0; t.c.h = 0; t.cx = t.c.x; t.c.x = 9999; game.physics.computeBB(t.c); if (live && game.sound && game.sound.ctx) game.sound.tone(900, 0.05, { type: 'square', vol: 0.05, slideTo: 300 }); }
      }
      if (t.down) t.t += dt;
      if (!t.down) allDown = false;
      const y = t.down ? Math.max(-2.6, 2.5 - t.t * 30) : Math.min(2.5, t.y + dt * 30);
      if (y !== t.y) {
        t.y = y;
        const m4 = A._m4b || (A._m4b = new A.caps.matrixWorld.constructor());
        m4.makeRotationY(-t.a).setPosition(t.x, y, t.z);
        A.dropIM.setMatrixAt(A.drops.indexOf(t), m4); A.dropIM.instanceMatrix.needsUpdate = true;
      }
    }
    if (allDown || A.drops.some((t) => t.down && t.t > 14)) {
      const due = allDown ? A.drops.every((t) => t.t > 2.5) : true;
      if (due) for (const t of A.drops) if (t.down && (allDown || t.t > 14)) { t.down = 0; t.c.h = 5; t.c.x = t.cx; game.physics.computeBB(t.c); }
    }
    // spinner: spins up when cars pass underneath
    if (A.spinner) {
      const S = A.spinner;
      for (const e of game.cars) {
        const c = e.car;
        if (c.state !== 'drive') continue;
        if (Math.abs(c.x - S.x) < 2.2 && Math.abs(c.z - S.z) < 8) S.w = Math.max(S.w, Math.abs(c.speed) * 0.55);
      }
      S.w *= Math.exp(-0.9 * dt);
      S.ang += S.w * dt;
      S.flag.rotation.z = S.ang + 0.42 + Math.sin(time * 1.3) * 0.05; // hangs a little tilted so its face shows
    }
    // top lanes light when the ball rolls through
    const B = A.ball, d = B.d;
    for (const ln of A.lanes) { if (d.state === 'live' && d.x > 124 && d.x < 138 && Math.abs(d.z - ln.z) < 4) ln.t = 3; ln.t = Math.max(0, ln.t - dt); }
    // plunger
    if (A.plunger) {
      let pull = 0;
      if (B.mode === 'wait') pull = Math.min(1, B.t / 1.3);
      const since = time - (A.fired ?? -9);
      const back = since < 0.12 ? 1 - since / 0.12 : 0;
      A.plunger.g.position.x = A.plunger.x0 - (B.mode === 'wait' ? pull * 5 : back * 0);
    }
    // ball contact shadow
    if (A.ballShadow) { A.ballShadow.visible = d.state === 'live'; A.ballShadow.position.set(d.x + 0.6, 0.05, d.z + 0.4); }
    // flasher light
    A.flashT = Math.max(0, A.flashT - dt * 3.5);
    A.flasher.intensity = A.flashT * 60;
    // inserts
    const t2 = time;
    for (const grp of A.ins) {
      const { im, list } = grp;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        let k = 0.25;
        switch (it.mode) {
          case 'steady': k = 1.6; break;
          case 'blink': k = (Math.floor(t2 * 2.2 + it.ph * 2) % 2) ? 2.2 : 0.25; break;
          case 'chase': { const ph = ((t2 * 1.4 - it.ph) % 1 + 1) % 1; k = 0.25 + 2.4 * Math.pow(1 - ph, 4); break; }
          case 'ladder': { const n = Math.floor(t2 * 0.8) % 6; k = it.ph < n ? 2.0 : 0.25; break; }
          case 'flipwarn': k = 0.2; break;
          case 'drop': k = A.drops[it.ph].down ? 2.4 : 0.3; break;
          case 'lane': k = A.lanes[it.ph].t > 0 ? 2.6 : 0.35 + 0.25 * Math.sin(t2 * 3 + it.ph); break;
          case 'roll': {
            if (game && game.cars) for (const e of game.cars) { const c = e.car; if (c.state === 'drive' && Math.abs(c.x - it.x) < 2.4 && Math.abs(c.z - it.z) < 2.4) it.lit = 1.2; }
            it.lit = Math.max(0, it.lit - dt);
            k = 0.3 + it.lit * 2.2;
            break;
          }
        }
        if (it.mode === 'flipwarn') {
          for (const F of A.flips) if (F.wi.includes(it)) k = 0.2 + (F.warn || 0) * 2.6;
        }
        it._c = it._c || it.col.clone();
        it._c.copy(it.col).multiplyScalar(k);
        im.setColorAt(i, it._c);
      }
      im.instanceColor.needsUpdate = true;
    }
    // glows
    {
      const { im, list } = A.glow;
      for (let i = 0; i < list.length; i++) {
        const g = list[i];
        if (g.k == null) continue;
        g._c = g._c || g.base.clone();
        g._c.set(g.color).multiplyScalar(g.k);
        im.setColorAt(i, g._c);
      }
      im.instanceColor.needsUpdate = true;
    }
    // flipper buttons light with their flippers
    if (A.btnMat) A.btnMat.emissiveIntensity = 0.3 + Math.max(A.flips[0].warn || 0, A.flips[1].warn || 0) * 2;
  },
};
