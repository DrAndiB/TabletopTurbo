// Time-trial records: best lap per world plus a compact ghost of that lap, kept in localStorage.
// Also the championship trophies (best finish per cup), further down.
// Ghost = samples at GHOST_HZ of position (0.05-unit steps) and heading (1/1000 rad), stored as
// int16 deltas in base64, so a 25 s lap is ~5 KB.
const KEY = 'tabletop-turbo.best.v1.';
export const GHOST_HZ = 20;

export function formatTime(t) {
  if (!isFinite(t) || t == null) return '–';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function loadBest(worldId) {
  try {
    const r = JSON.parse(localStorage.getItem(KEY + worldId) || 'null');
    if (r && typeof r.t === 'number' && r.t > 0) return r;
  } catch (e) { /* storage unavailable or corrupt */ }
  return null;
}

export function saveBest(worldId, rec) {
  try { localStorage.setItem(KEY + worldId, JSON.stringify(rec)); return true; } catch (e) { return false; }
}

export function clearBest(worldId) {
  try { localStorage.removeItem(KEY + worldId); } catch (e) { /* ignore */ }
}

// Championship trophies: the best finish per cup ('all' = Grand Tour), kept in one localStorage entry
// { <cupId>: { place: 1|2|3, races, t } }. place 1 = gold, 2 = silver, 3 = bronze.
const TROPHY_KEY = 'tabletop-turbo.trophies.v1';
export const MEDALS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export function loadTrophies() {
  try {
    const r = JSON.parse(localStorage.getItem(TROPHY_KEY) || 'null');
    if (!r || typeof r !== 'object') return {};
    const out = {};
    for (const [k, v] of Object.entries(r)) if (v && MEDALS[v.place]) out[k] = v;
    return out;
  } catch (e) { return {}; }
}

// medal for a cup, or null
export function cupMedal(cupId, trophies = loadTrophies()) {
  const r = trophies[cupId];
  return r ? MEDALS[r.place] : null;
}

// Record a finish; only places 1-3 earn a trophy and only a better place replaces the stored one.
// -> { place, medal, prev (previous best place or null), improved, saved }
export function awardTrophy(cupId, place, races) {
  const all = loadTrophies();
  const prev = all[cupId] ? all[cupId].place : null;
  const medal = MEDALS[place] || null;
  const improved = !!medal && (prev == null || place < prev);
  let saved = false;
  if (improved) {
    all[cupId] = { place, races, t: Date.now() };
    try { localStorage.setItem(TROPHY_KEY, JSON.stringify(all)); saved = true; } catch (e) { /* storage unavailable */ }
  }
  return { place, medal, prev, improved, saved };
}

// samples: flat array [x, y, z, angle, x, y, z, angle, ...]
export function encodeGhost(samples) {
  const n = Math.floor(samples.length / 4);
  if (!n) return null;
  const q = new Int32Array(n * 4);
  let unwrapped = samples[3], prevA = samples[3];
  for (let i = 0; i < n; i++) {
    const a = samples[i * 4 + 3];
    if (i > 0) {
      let d = a - prevA;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      unwrapped += d;
    }
    prevA = a;
    q[i * 4] = Math.round(samples[i * 4] * 20);
    q[i * 4 + 1] = Math.round(samples[i * 4 + 1] * 20);
    q[i * 4 + 2] = Math.round(samples[i * 4 + 2] * 20);
    q[i * 4 + 3] = Math.round(unwrapped * 1000);
  }
  const d = new Int16Array((n - 1) * 4);
  for (let i = 1; i < n; i++) {
    for (let k = 0; k < 4; k++) d[(i - 1) * 4 + k] = Math.max(-32768, Math.min(32767, q[i * 4 + k] - q[(i - 1) * 4 + k]));
  }
  const bytes = new Uint8Array(d.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 4096) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
  return { n, f: Array.from(q.subarray(0, 4)), d: btoa(bin) };
}

// -> Float32Array [x, y, z, angle, ...] (angle unwrapped)
export function decodeGhost(g) {
  if (!g || !g.n || !g.f) return null;
  try {
    const bin = atob(g.d || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const d = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    const n = Math.min(g.n, d.length / 4 + 1);
    const out = new Float32Array(n * 4);
    const cur = g.f.slice();
    for (let i = 0; i < n; i++) {
      if (i > 0) for (let k = 0; k < 4; k++) cur[k] += d[(i - 1) * 4 + k];
      out[i * 4] = cur[0] / 20; out[i * 4 + 1] = cur[1] / 20; out[i * 4 + 2] = cur[2] / 20; out[i * 4 + 3] = cur[3] / 1000;
    }
    return out;
  } catch (e) { return null; }
}
