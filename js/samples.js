// Recorded sound, in audio/: engine loops per vehicle type, each world's background and one-shots, and its rendered
// music. All optional: a vehicle or world with no entry here, or a file that fails to load in time, keeps the
// synthesised sound (audio.js, ambience.js, music.js). Sources and licences: audio/CREDITS.md.
//
// Engine loops are stored twice back to back (L L) and play with loopStart a little way in: mp3 decoders differ in
// how much silence they put at the start, and any window of length L inside a doubled loop is seamless.
// Beds are long recordings that loop by crossfading two copies (xf seconds); the file holds loop + xf.
// Music is rendered once with its reverb tail: copy k starts at k * loop and rings over copy k + 1 (no fades),
// and an optional `final` layer runs alongside in sync and fades in on the final lap.

// Engine recordings (audio/eng/, October 2026) were dropped again: the synthesised engines in audio.js sounded
// better in play. The loader still handles an entry here ({ src, loop, f0, bend, gain, lp }: see the git history).
export const ENGINES = {};

// the title and lobby theme (no final layer)
export const MENU = { src: 'music/menu.mp3', loop: 58.181814, gain: 2.1 };

// rendered music for a world: main loop and final-lap layer (sound-lab/scores/<id>.py)
const song = (id, loop, o = {}) => ({ src: `music/${id}.mp3`, final: `music/${id}-final.mp3`, loop, gain: 2.1, ...o });

export const WORLDS = {
  breakfast: {
    music: { src: 'music/breakfast.mp3', final: 'music/breakfast-final.mp3', loop: 61.935488, gain: 2.1 },
    // a quiet kitchen with birds outside, and a window open onto the garden
    beds: [
      { src: 'amb/breakfast-room.mp3', loop: 40, xf: 2, g: 0.24 },
      { src: 'amb/breakfast-window.mp3', loop: 31, xf: 2, g: 0.24, pan: 0.35 },
    ],
    fx: {
      src: 'amb/breakfast-fx.mp3',
      cuts: {
        clink: [[0.28, 0.94], [1.48, 0.94], [2.68, 0.94], [3.88, 0.94], [5.08, 0.94], [6.28, 0.94], [7.48, 0.94], [8.68, 0.94]],
        cups: [[9.88, 1.34], [11.48, 1.14], [12.88, 1.54]],
        stir: [[14.68, 2.64], [17.58, 2.64]],
        kettle: [[20.48, 11.34]],
      },
    },
    // [cut, min gap, max gap, first after, level]: like ambience.js, one cut picked at random each time
    ev: [['clink', 5, 13, 3, 0.19], ['cups', 9, 20, 6, 0.19], ['stir', 14, 30, 8, 0.15], ['kettle', 45, 80, 20, 0.15]],
  },
  garden: {
    music: song('garden', 57.931043),
    // a summer garden: birds, a breeze in the leaves; bees and a mower far off
    beds: [
      { src: 'amb/garden-bed1.mp3', loop: 44, xf: 2, g: 0.204 },
    ],
    fx: {
      src: 'amb/garden-fx.mp3',
      cuts: {
        bee: [[0.28, 4.54], [5.08, 4.54], [9.88, 5.04]],
        mower: [[15.18, 16.04]],
      },
    },
    ev: [['bee', 8, 18, 4, 0.136], ['mower', 40, 70, 15, 0.111]],
  },
  gingerbread: {
    music: song('gingerbread', 62.608685),
    // a cosy room with a crackling fire
    beds: [
      { src: 'amb/gingerbread-bed1.mp3', loop: 40, xf: 2, g: 0.589, pan: -0.2 },
    ],
    fx: {
      src: 'amb/gingerbread-fx.mp3',
      cuts: {
        pop: [[0.28, 0.54], [1.08, 0.54], [1.88, 0.54], [2.68, 0.54], [3.48, 0.54], [4.28, 0.54], [5.08, 0.54], [5.88, 0.54]],
      },
    },
    ev: [['pop', 3, 9, 2, 0.367]],
  },
  toybox: {
    music: song('toybox', 58.181814),
    // a quiet child's room; wind-up toys and squeaks
    beds: [
      { src: 'amb/toybox-bed1.mp3', loop: 30, xf: 2, g: 0.209 },
    ],
    fx: {
      src: 'amb/toybox-fx.mp3',
      cuts: {
        windup: [[0.28, 4.54], [5.08, 3.04]],
        squeak: [[8.38, 0.64], [9.28, 0.64], [10.18, 0.64], [11.08, 0.64]],
      },
    },
    ev: [['windup', 9, 20, 3, 0.131], ['squeak', 12, 28, 7, 0.104]],
  },
  desk: {
    music: song('desk', 60.0),
    // a study: a clock ticking, pencil scratches
    beds: [
      { src: 'amb/desk-bed1.mp3', loop: 40, xf: 2, g: 0.221, pan: 0.2 },
    ],
    fx: {
      src: 'amb/desk-fx.mp3',
      cuts: {
        scratch: [[0.28, 2.54], [3.08, 2.54], [5.88, 2.54]],
      },
    },
    ev: [['scratch', 5, 12, 2, 0.147]],
  },
  bathroom: {
    music: song('bathroom', 60.952381),
    // a bathroom: drips, the drain gurgles, bubbles
    beds: [
      { src: 'amb/bathroom-bed1.mp3', loop: 22, xf: 2, g: 0.216 },
    ],
    fx: {
      src: 'amb/bathroom-fx.mp3',
      cuts: {
        gurgle: [[0.28, 5.04]],
        bubbles: [[5.58, 1.24], [7.08, 1.24], [8.58, 1.24]],
      },
    },
    ev: [['gurgle', 12, 25, 6, 0.135], ['bubbles', 6, 14, 3, 0.135]],
  },
  pool: {
    music: song('pool', 65.084739),
    // a pub with a pool table
    beds: [
      { src: 'amb/pool-bed1.mp3', loop: 50, xf: 2, g: 0.337 },
    ],
    fx: {
      src: 'amb/pool-fx.mp3',
      cuts: {
        clacks: [[0.28, 1.44], [1.98, 1.44], [3.68, 1.44]],
      },
    },
    ev: [['clacks', 6, 14, 2, 0.26]],
  },
  watertable: {
    music: song('watertable', 60.0),
    // water lapping; gulls
    beds: [
      { src: 'amb/watertable-bed1.mp3', loop: 50, xf: 2, g: 0.417 },
    ],
    fx: {
      src: 'amb/watertable-fx.mp3',
      cuts: {
        gulls: [[0.28, 4.04], [4.58, 4.04], [8.88, 4.04]],
      },
    },
    ev: [['gulls', 10, 24, 5, 0.226]],
  },
  workshop: {
    music: song('workshop', 61.714286),
    // a wooden workshop; a radio being tuned, a drill
    beds: [
      { src: 'amb/workshop-bed1.mp3', loop: 50, xf: 2, g: 0.254 },
    ],
    fx: {
      src: 'amb/workshop-fx.mp3',
      cuts: {
        radio: [[0.28, 4.04], [4.58, 4.04]],
        drill: [[8.88, 3.04], [12.18, 3.04]],
      },
    },
    ev: [['radio', 10, 22, 4, 0.138], ['drill', 18, 35, 9, 0.138]],
  },
  boardroom: {
    music: song('boardroom', 60.952381),
    // an office: air conditioning, people at work; keyboards
    beds: [
      { src: 'amb/boardroom-bed1.mp3', loop: 50, xf: 2, g: 0.244 },
    ],
    fx: {
      src: 'amb/boardroom-fx.mp3',
      cuts: {
        typing: [[0.28, 3.04], [3.58, 3.04], [6.88, 3.04]],
      },
    },
    ev: [['typing', 5, 12, 1.5, 0.167]],
  },
  mars: {
    music: song('mars', 60.0),
    // thin wind over a desert; radio blips
    beds: [
      { src: 'amb/mars-bed1.mp3', loop: 38, xf: 2, g: 0.417 },
    ],
    fx: {
      src: 'amb/mars-fx.mp3',
      cuts: {
        beeps: [[0.28, 2.64], [3.18, 3.04], [6.48, 3.04]],
      },
    },
    ev: [['beeps', 9, 20, 3, 0.192]],
  },
  railway: {
    music: song('railway', 57.6),
    // open country, birds; a train passing far off
    beds: [
      { src: 'amb/railway-bed1.mp3', loop: 50, xf: 2, g: 0.327 },
    ],
    fx: {
      src: 'amb/railway-fx.mp3',
      cuts: {
        train: [[0.28, 18.04]],
      },
    },
    ev: [['train', 45, 80, 20, 0.163]],
  },
  pinball: {
    music: song('pinball', 61.538458),
    // an amusement arcade; pinball bells and flippers
    beds: [
      { src: 'amb/pinball-bed1.mp3', loop: 50, xf: 2, g: 0.217 },
    ],
    fx: {
      src: 'amb/pinball-fx.mp3',
      cuts: {
        ding: [[0.28, 1.24], [1.78, 1.24], [3.28, 1.24], [4.78, 1.24], [6.28, 1.24]],
        flip: [[7.78, 0.64], [8.68, 0.64], [9.58, 0.64], [10.48, 0.64]],
      },
    },
    ev: [['ding', 4, 10, 1, 0.151], ['flip', 3, 8, 2, 0.14]],
  },
  chemlab: {
    music: song('chemlab', 64.615374),
    // a lab: equipment hum, bubbling flasks
    beds: [
      { src: 'amb/chemlab-bed1.mp3', loop: 50, xf: 2, g: 0.192 },
      { src: 'amb/chemlab-bed2.mp3', loop: 18, xf: 2, g: 0.139, pan: 0.3 },
    ],
    fx: {
      src: 'amb/chemlab-fx.mp3',
      cuts: {
        boil: [[0.28, 5.04]],
      },
    },
    ev: [['boil', 12, 24, 6, 0.113]],
  },
  dollhouse: {
    music: song('dollhouse', 62.608685),
    // wind howling round an old house; creaks; distant thunder
    beds: [
      { src: 'amb/dollhouse-bed1.mp3', loop: 50, xf: 2, g: 0.191 },
    ],
    fx: {
      src: 'amb/dollhouse-fx.mp3',
      cuts: {
        creak: [[0.28, 1.64], [2.18, 1.64], [4.08, 1.64], [5.98, 1.64], [7.88, 1.64], [9.78, 1.64]],
        thunder: [[11.68, 14.04]],
      },
    },
    ev: [['creak', 6, 14, 3, 0.118], ['thunder', 24, 45, 12, 0.142]],
  },
  // bars locked to the balance wheel (one swing = 2.8 s = one bar), see SampledPlayer sync
  watchmaker: {
    music: song('watchmaker', 61.6, { sync: 2.8 }),
    // a quiet workshop with clocks; winding
    beds: [
      { src: 'amb/watchmaker-bed1.mp3', loop: 50, xf: 2, g: 0.238 },
    ],
    fx: {
      src: 'amb/watchmaker-fx.mp3',
      cuts: {
        wind: [[0.28, 5.04], [5.58, 3.54]],
      },
    },
    ev: [['wind', 14, 28, 6, 0.14]],
  },
  moselle: {
    music: song('moselle', 60.0),
    // the Moselle valley from the Moselhöhenweg; glasses clink
    beds: [
      { src: 'amb/moselle-bed1.mp3', loop: 50, xf: 2, g: 0.282 },
    ],
    fx: {
      src: 'amb/moselle-fx.mp3',
      cuts: {
        glasses: [[0.28, 1.24], [1.78, 1.24], [3.28, 1.24], [4.78, 1.24], [6.28, 1.24], [7.78, 2.04]],
      },
    },
    ev: [['glasses', 8, 18, 3, 0.175]],
  },
  fouer: {
    music: song('fouer', 60.0),
    // a funfair: the dodgem rink and the crowd; cheers
    beds: [
      { src: 'amb/fouer-bed1.mp3', loop: 50, xf: 2, g: 0.337 },
      { src: 'amb/fouer-bed2.mp3', loop: 40, xf: 2, g: 0.245, pan: 0.3 },
    ],
    fx: {
      src: 'amb/fouer-fx.mp3',
      cuts: {
        cheer: [[0.28, 5.04], [5.58, 5.04]],
      },
    },
    ev: [['cheer', 16, 32, 8, 0.199]],
  },
  grund: {
    music: song('grund', 58.181814),
    // a stream by the old quarter; church bells now and then
    beds: [
      { src: 'amb/grund-bed1.mp3', loop: 29.6, xf: 2, g: 0.405 },
    ],
    fx: {
      src: 'amb/grund-fx.mp3',
      cuts: {
        bells: [[0.28, 20.04]],
      },
    },
    ev: [['bells', 45, 75, 15, 0.239]],
  },
  oldtown: {
    music: song('oldtown', 55.652177),
    // a town square; pigeons
    beds: [
      { src: 'amb/oldtown-bed1.mp3', loop: 50, xf: 2, g: 0.297 },
    ],
    fx: {
      src: 'amb/oldtown-fx.mp3',
      cuts: {
        coo: [[0.28, 3.54], [4.08, 3.54], [7.88, 3.54]],
      },
    },
    ev: [['coo', 6, 14, 2, 0.189]],
  },
};

const BASE = new URL('../audio/', import.meta.url).href;

// files fetched before there is an AudioContext (the menu theme, while the title screen waits for a click)
const early = new Map();
export function prefetch(src) {
  if (!early.has(src)) early.set(src, fetch(BASE + src).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + src); return r.arrayBuffer(); }));
}

export class SampleLib {
  constructor(ctx) { this.ctx = ctx; this.bufs = new Map(); this.pending = new Map(); }
  get(src) { return this.bufs.get(src) || null; }
  load(src) {
    if (this.bufs.has(src)) return Promise.resolve(this.bufs.get(src));
    let p = this.pending.get(src);
    if (!p) {
      const bytes = early.get(src) || fetch(BASE + src).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + src); return r.arrayBuffer(); });
      early.delete(src);
      p = bytes.then((a) => new Promise((ok, no) => this.ctx.decodeAudioData(a, ok, no)))
        .then((b) => { this.bufs.set(src, b); return b; })
        .catch((e) => { console.warn('sound file skipped:', e.message || e); this.bufs.set(src, null); return null; })
        .finally(() => this.pending.delete(src));
      this.pending.set(src, p);
    }
    return p;
  }
  // everything a race on this world needs; resolves when loaded or after `wait` seconds, whichever comes first
  // (files still loading then are used from the next race on)
  preload(world, vtype, wait = 4) {
    const W = WORLDS[world], E = ENGINES[vtype], list = [];
    if (E) list.push(E.src);
    if (W) {
      if (W.music) list.push(W.music.src, W.music.final);
      for (const b of W.beds || []) list.push(b.src);
      if (W.fx) list.push(W.fx.src);
    }
    const all = Promise.all(list.filter(Boolean).map((s) => this.load(s)));
    return Promise.race([all, new Promise((r) => setTimeout(r, wait * 1000))]);
  }
  engine(vtype) { const E = ENGINES[vtype]; return E && this.get(E.src) ? E : null; }
  menu() { return this.get(MENU.src) ? MENU : null; }
  music(world) { const M = WORLDS[world] && WORLDS[world].music; return M && this.get(M.src) ? M : null; }
  ambience(world) { const W = WORLDS[world]; return W && W.beds && W.beds.every((b) => this.get(b.src)) ? W : null; }
}

// ---------------------------------------------------------------- music: same interface as music.js Player
export class SampledPlayer {
  constructor(lib, M, dest) {
    const ctx = (this.ctx = lib.ctx);
    this.M = M; this.main = lib.get(M.src); this.fin = M.final ? lib.get(M.final) : null;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.finG = ctx.createGain(); this.finG.gain.value = 0; this.finG.connect(this.out);
    this.live = []; this.running = false; this.final = false;
  }
  // sync: {g0, off()} as for music.js Player: the loop's start falls on game time g0 (+ whole loops), off() = audio
  // minus game time. A synced player starts mid-loop where the game clock says and re-locks if the clocks drift.
  start(t, sync = null) {
    this.sync = sync; this.running = true;
    const off = this.syncPos(t);
    if (off) { this.play(t, off); this.k = 1; } else this.k = 0;
    this.t0 = t - off;
    const g = this.out.gain, t0 = Math.max(this.ctx.currentTime, t - 0.05);
    g.cancelScheduledValues(0); g.setValueAtTime(0, t0); g.linearRampToValueAtTime(this.M.gain, t0 + 0.1);
  }
  // where in the loop audio time t falls by the game clock (0 when not synced)
  syncPos(t) {
    if (!this.sync) return 0;
    const L = this.M.loop;
    return (((t - this.sync.off() - this.sync.g0) % L) + L) % L;
  }
  // copies are queued once they are less than `until` away; a copy started mid-way (resume) gets an offset
  play(t, off = 0) {
    const ctx = this.ctx;
    for (const [b, to] of [[this.main, this.out], [this.fin, this.finG]]) {
      if (!b) continue;
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(to); s.start(Math.max(t, ctx.currentTime), off);
      s.onended = () => { s.disconnect(); this.live = this.live.filter((x) => x.s !== s); };
      this.live.push({ s, t: t - off });
    }
  }
  pump(until) {
    if (!this.running) return;
    if (this.sync) {
      // drift from the game clock (long frames, a slow tab): past 0.12 s, pick the loop up again where it should be
      const now = this.ctx.currentTime, L = this.M.loop, want = this.syncPos(now), have = (((now - this.t0) % L) + L) % L;
      let err = want - have; if (err > L / 2) err -= L; if (err < -L / 2) err += L;
      if (Math.abs(err) > 0.12 && now > (this.relock || 0)) { this.relock = now + 2; this.pause(); this.resume(); return; }
    }
    while (this.t0 + this.k * this.M.loop < until) { this.play(this.t0 + this.k * this.M.loop); this.k++; }
  }
  setFinal(on) {
    this.final = on;
    const t = this.ctx.currentTime; this.finG.gain.cancelScheduledValues(t); this.finG.gain.setTargetAtTime(on ? 1 : 0, t, 0.6);
  }
  hush(fade) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, fade / 4);
    for (const x of this.live) try { x.s.stop(t + fade + 0.05); } catch (e) { /* stopped */ }
    this.live = [];
  }
  pause() {
    if (!this.running) return;
    this.running = false;
    // where the loop is now, so resume carries on from there
    this.pos = ((this.ctx.currentTime - this.t0) % this.M.loop + this.M.loop) % this.M.loop;
    this.hush(0.12);
  }
  resume() {
    if (this.running || this.stopped) return;
    const t = this.ctx.currentTime + 0.05, pos = this.sync ? this.syncPos(t) : this.pos || 0;
    this.running = true;
    this.play(t, pos);
    this.t0 = t - pos; this.k = 1;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(this.M.gain, t, 0.08);
    if (this.final) this.setFinal(true);
  }
  stop(fade = 0.5) {
    if (this.stopped) return;
    this.stopped = true; this.running = false;
    this.hush(fade);
    setTimeout(() => { try { this.out.disconnect(); } catch (e) { /* gone */ } }, (fade + 1) * 1000);
  }
}

// ---------------------------------------------------------------- background: same interface as ambience.js Ambience
export class SampledAmbience {
  constructor(lib, W, dest, rnd) {
    const ctx = (this.ctx = lib.ctx);
    this.W = W; this.lib = lib; this.r = rnd;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.beds = W.beds.map((b) => {
      const g = ctx.createGain(); g.gain.value = b.g;
      let node = g;
      if (b.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = b.pan; g.connect(p); node = p; }
      node.connect(this.out);
      return { b, buf: lib.get(b.src), g, next: 0, live: [] };
    });
    this.fx = W.fx ? lib.get(W.fx.src) : null;
    this.running = false; this.next = [];
  }
  start(t) {
    // each bed starts somewhere random in its loop, so two worlds' visits never sound the same
    for (const B of this.beds) { const off = this.r() * B.b.loop; this.bedCopy(B, t, off, 0.05); B.next = t + B.b.loop - off; }
    this.next = (this.W.ev || []).map((e) => t + (e[3] ?? 1) + this.r() * 2);
    this.out.gain.setValueAtTime(0, t); this.out.gain.linearRampToValueAtTime(1, t + 1.5);
    this.running = true;
  }
  // one copy of a bed from `off`, fading in over `fin` and out over the crossfade at its end
  bedCopy(B, t, off, fin) {
    const ctx = this.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), xf = B.b.xf, end = t + B.b.loop + xf - off;
    s.buffer = B.buf; s.connect(g); g.connect(B.g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fin);
    g.gain.setValueAtTime(1, end - xf); g.gain.linearRampToValueAtTime(0, end);
    s.start(t, off); s.stop(end + 0.05);
    const x = { s, g }; B.live.push(x);
    s.onended = () => { s.disconnect(); g.disconnect(); B.live = B.live.filter((y) => y !== x); };
  }
  pump(until) {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    for (const B of this.beds) while (B.next < until) { this.bedCopy(B, B.next, 0, B.b.xf); B.next += B.b.loop; }
    (this.W.ev || []).forEach((e, i) => {
      let n = 0;
      while (this.next[i] < until && n++ < 8) {
        if (this.next[i] > now - 0.05) this.oneShot(e[0], this.next[i], e[4] ?? 1, (this.r() * 2 - 1) * 0.6);
        this.next[i] += e[1] + this.r() * (e[2] - e[1]);
      }
    });
  }
  oneShot(name, t, v, pan) {
    const cuts = this.W.fx && this.W.fx.cuts[name];
    if (!this.fx || !cuts || !cuts.length) return;
    const [at, dur] = cuts[Math.floor(this.r() * cuts.length)], ctx = this.ctx;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.fx; g.gain.value = v;
    s.playbackRate.value = 0.94 + this.r() * 0.12; // a little variety in pitch
    let node = s.connect(g);
    let p = null;
    if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.out);
    s.start(t, at, dur); s.onended = () => { s.disconnect(); g.disconnect(); if (p) p.disconnect(); };
  }
  pause() { if (!this.running) return; this.running = false; const t = this.ctx.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.05); this.pausedAt = t; }
  resume() {
    if (this.running || this.stopped) return;
    const t = this.ctx.currentTime; this.running = true;
    // the beds kept playing silently while paused (cheap: a couple of sources); events skip the gap
    this.next = this.next.map((x) => Math.max(x, t + 0.2));
    for (const B of this.beds) if (B.next < t) { this.bedCopy(B, t, 0, 0.05); B.next = t + B.b.loop; }
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(1, t, 0.1);
  }
  stop(fade = 0.6) {
    if (this.stopped) return;
    this.stopped = true; this.running = false;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, fade / 4);
    for (const B of this.beds) for (const x of B.live) try { x.s.stop(t + fade + 0.1); } catch (e) { /* stopped */ }
    setTimeout(() => { try { this.out.disconnect(); } catch (e) { /* gone */ } }, (fade + 2) * 1000);
  }
}
