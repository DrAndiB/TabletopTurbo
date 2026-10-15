// Synthesised sound: engines and skids per vehicle type, crashes and landings, jingles, cues from the worlds,
// race music and each world's background, the menu theme. No audio files.
//
// Buses: master (the corner mute button) <- effects (engines, one-shots, cues, ambience; setting "Effects")
//                                        <- music (setting "Music") <- duck (dips under loud engines) <- music in + reverb
// Per frame the game calls updateEngine() for every car (setTargetAtTime only, no new nodes) and frame().
// Music and ambience are scheduled ~0.3 s ahead on the AudioContext clock by pump(), from a 50 ms timer.
// Muted or in the background, the AudioContext is suspended: nothing runs.
import { MusicKit, Player, compileSong, pieceFor, mulberry } from './music.js';
import { Ambience, CUES, EV, makeNoises } from './ambience.js';

const LOOKAHEAD = 0.3;
const MUSIC_LEVEL = 0.133; // race music sits ~4 dB under one engine at full throttle (see _dev/README.md, Audio)

// ---------------------------------------------------------------- vehicle voices
// base Hz (+ step per car), gears (fake gear steps: each adds `spread`, within a gear the revs rise by `range`),
// a/b oscillator types (b at bRatio, mix bMix, det cents), drive = rasp (waveshaper), am = [ratio of revs, depth]
// firing pulses (chug, burble, rattle), lp = lowpass [base, +speed, +throttle] Hz, tc = how fast the revs follow,
// vol = level; extras: whine, crackle (lift-off pops), clatter (diesel), gurgle (outboard), fan (hovercraft),
// servo (rover), hum + sparks (bumper car), electric (no gears: base..top Hz), cvt (snowmobile clutch).
const VEH = {
  sports: { base: 92, step: 9, gears: 4, spread: 0.3, range: 0.8, a: 'sawtooth', b: 'square', bRatio: 0.5, bMix: 0.35, lp: [520, 1500, 550], q: 1.8, vib: [23, 4], vol: 1, skid: 'squeal' },
  formula: { base: 150, step: 11, gears: 6, spread: 0.2, range: 0.75, a: 'sawtooth', b: 'square', bRatio: 2, bMix: 0.16, whine: 4, lp: [1300, 4400, 900], q: 3.5, vib: [41, 3], tc: 0.025, vol: 1.3, skid: 'sharp' },
  rally: { base: 96, step: 8, gears: 5, spread: 0.28, range: 0.8, a: 'square', b: 'sawtooth', bRatio: 0.5, bMix: 0.6, drive: 3, am: [0.5, 0.3], lp: [700, 2600, 700], q: 1.6, vol: 0.77, crackle: true, skid: 'gravel' },
  truck: { base: 44, step: 3, gears: 4, spread: 0.25, range: 0.9, a: 'square', b: 'sine', bRatio: 0.5, bMix: 1, am: [0.5, 0.6], clatter: 0.2, lp: [300, 700, 320], q: 1.2, tc: 0.14, vol: 0.82, skid: 'dirt' },
  monster: { base: 34, step: 2.5, gears: 3, spread: 0.3, range: 0.9, a: 'sawtooth', b: 'square', bRatio: 0.5, bMix: 0.8, am: [0.25, 0.7], lp: [210, 600, 260], q: 1.3, tc: 0.12, vol: 1.17, skid: 'rumble' },
  suv: { base: 80, step: 6, gears: 6, spread: 0.15, range: 0.55, a: 'triangle', b: 'sine', bRatio: 2, bMix: 0.4, am: [1, 0.12], lp: [380, 1000, 300], q: 0.7, tc: 0.07, vol: 0.72, skid: 'soft' },
  rover: { electric: true, base: 240, top: 1500, step: 25, a: 'sine', b: 'triangle', bRatio: 1.51, bMix: 0.4, lp: [2400, 4000, 0], q: 0.7, servo: true, vol: 0.7, skid: 'sand' },
  boat: { base: 72, step: 6, gears: 1, spread: 0, range: 1.5, a: 'sawtooth', b: 'square', bRatio: 1, bMix: 0.5, det: 9, drive: 2, am: [1, 0.25], lp: [900, 2600, 800], q: 2, gurgle: true, vol: 0.85, skid: 'spray' },
  hover: { fan: true, base: 55, step: 4, gears: 1, spread: 0, range: 0.7, a: 'sine', b: 'sawtooth', bRatio: 2, bMix: 0.25, lp: [260, 380, 200], q: 0.8, vol: 0.8, skid: 'air' },
  snowmobile: { cvt: true, base: 84, step: 7, a: 'square', b: 'sawtooth', bRatio: 1, bMix: 0.6, det: 12, drive: 4, am: [0.5, 0.45], lp: [1100, 3000, 700], q: 2.5, vol: 0.7, skid: 'snow' },
  bumper: { electric: true, hum: 100, base: 170, top: 520, step: 12, a: 'triangle', b: 'sine', bRatio: 1, bMix: 1, lp: [900, 900, 300], q: 0.7, sparks: true, vol: 0.66, skid: 'rubber' },
};
// skid layer: noise (buffer name, playback rate) through a filter; g = level at full slide, roll = level while
// simply rolling at speed (snow, water, sand), step = filter Hz added per car so a pack doesn't phase
const SKID = {
  squeal: { n: 'white', f: ['bandpass', 1500, 2.5], g: 0.28, step: 120 },
  sharp: { n: 'white', f: ['bandpass', 2300, 8], g: 0.4, step: 90 },
  soft: { n: 'white', f: ['bandpass', 1250, 2], g: 0.16, step: 80 },
  gravel: { n: 'gravel', f: ['bandpass', 800, 0.8], g: 0.5 },
  dirt: { n: 'gravel', rate: 0.7, f: ['lowpass', 900, 0.7], g: 0.55 },
  rumble: { n: 'gravel', rate: 0.45, f: ['lowpass', 420, 0.9], g: 0.8, roll: 0.12 },
  sand: { n: 'white', f: ['highpass', 3200, 0.7], g: 0.09, roll: 0.05 },
  spray: { n: 'white', f: ['bandpass', 2800, 0.6], g: 0.22, roll: 0.07 },
  air: { n: 'white', f: ['highpass', 4200, 0.7], g: 0.12 },
  snow: { n: 'snow', f: ['bandpass', 2000, 0.8], g: 0.3, roll: 0.16 },
  rubber: { n: 'white', f: ['bandpass', 950, 6], g: 0.25, step: 60 },
};
export const VEHICLE_SOUNDS = Object.keys(VEH);

// a small, darkening room for the music (mono: one convolution, cheap enough for phones)
function makeIR(ctx, sec = 0.8) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), r = mulberry(7), d = b.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, k = 0.35 + 0.6 * Math.exp(-t * 4); lp += k * ((r() * 2 - 1) - lp); d[i] = t < 0.01 ? 0 : lp * Math.exp(-t * 6.5); }
  return b;
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('tabletop-turbo.muted') === '1'; } catch (e) { /* ignore */ }
    this.musicOn = true; // settings (main.js): music and effects
    this.fxOn = true;
    this.engines = [];
    this.vtype = 'sports';
    this.held = false; // engines silenced (pause, results, menus)
    this.menu = null; this.wantMenu = false;
    this.race = null; this.raceId = null; this.song = null; this.finalLap = false;
    this.songs = new Map();
    this.gameOff = null; this.duckV = 1;
    this.offline = false; // rendering into an OfflineAudioContext (tools): never resume it from here
    // Browsers only allow audio after a click or key press: create the context on the first one.
    this.unlocked = false;
    const unlock = () => {
      this.unlocked = true;
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, unlock, true);
      this.ensure();
      if (this.wantMenu) this.startMusic();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, true);
  }

  // true when sound can play (context running or resumable, not muted)
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.muted && !this.offline && !document.hidden) this.ctx.resume();
      return !this.muted;
    }
    if (!this.unlocked) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.attach(new AC({ latencyHint: 'interactive' }));
    if (this.muted) this.ctx.suspend();
    return !this.muted;
  }
  fx() { return this.fxOn && this.ensure(); }

  // build the graph on a context (the game's own, or an OfflineAudioContext in the tools)
  attach(ctx) {
    this.ctx = ctx; this.unlocked = true;
    this.offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    this.master = gain(this.muted ? 0 : 0.8);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = gain(this.fxOn ? 0.9 : 0, this.master);
    this.engBus = gain(1, this.sfx);
    this.ambBus = gain(1, this.sfx);
    this.music = gain(this.musicOn ? 1 : 0, this.master);
    this.duck = gain(1, this.music);
    this.musicIn = gain(MUSIC_LEVEL, this.duck);
    this.rev = ctx.createConvolver(); this.rev.buffer = makeIR(ctx);
    this.revIn = gain(1); this.revIn.channelCount = 1; this.revIn.channelCountMode = 'explicit';
    this.revIn.connect(this.rev); this.rev.connect(this.musicIn);
    this.N = makeNoises(ctx);
    this.noise = this.N.white;
    this.kit = new MusicKit(ctx, this.revIn);
    this.fxA = { ctx, N: this.N, bus: this.sfx };
    this.shapers = new Map();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('tabletop-turbo.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
    // muted: suspend the whole context once the fade is done, so nothing runs at all
    clearTimeout(this.muteT);
    if (m) this.muteT = setTimeout(() => { if (this.muted && this.ctx.state === 'running') this.ctx.suspend(); }, 250);
    else { this.ensure(); if (this.wantMenu) this.startMusic(); }
  }
  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    if (!on) { if (this.menu) { this.menu.stop(0.3); this.menu = null; } if (this.race && this.race.player) { this.race.player.stop(0.3); this.race.player = null; } }
    else if (this.wantMenu) this.startMusic();
  }
  setEffects(on) {
    this.fxOn = on;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    if (!on) { this.stopEngines(); if (this.race && this.race.amb) { this.race.amb.stop(0.3); this.race.amb = null; } }
  }

  // ---------------------------------------------------------------- engines
  shaper(k) {
    let s = this.shapers.get(k);
    if (!s) {
      const n = 1024, c = new Float32Array(n), m = Math.tanh(k);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / m; }
      s = c; this.shapers.set(k, s);
    }
    return s;
  }
  // one voice per car, built for the world's vehicle type when the race starts
  createEngines(n, vtype = 'sports') {
    this.stopEngines();
    this.vtype = VEH[vtype] ? vtype : 'sports';
    this.held = false;
    if (!this.ctx || !this.fxOn) return; // audio starts only after a click or key press
    this.ensure();
    const ctx = this.ctx, V = VEH[this.vtype], K = SKID[V.skid];
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const loop = (name, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = this.N[name]; s.loop = true; s.playbackRate.value = rate; return s; };
    for (let i = 0; i < n; i++) {
      const e = { V, base: V.base + i * V.step, srcs: [], gear: 0, shift: 0, prevThr: 0, level: 0 };
      const out = gain(0); e.g = out;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; e.pan = pan;
      if (pan) { out.connect(pan); pan.connect(this.engBus); } else out.connect(this.engBus);
      const lp = filt('lowpass', V.lp[0], V.q); e.f = lp;
      // firing pulses: the whole engine passes through a gain wobbled at a fraction of the revs
      let body = lp;
      if (V.am) {
        const amNode = gain(1 - V.am[1] * 0.5), am = osc('sine', e.base * V.am[0]), amG = gain(V.am[1] * 0.5);
        am.connect(amG); amG.connect(amNode.gain); lp.connect(amNode); body = amNode; e.am = am; e.srcs.push(am);
      }
      body.connect(out);
      let mix = lp;
      if (V.drive) { const ws = ctx.createWaveShaper(); ws.curve = this.shaper(V.drive); ws.connect(lp); mix = ws; }
      e.o1 = osc(V.a, V.hum || e.base); e.o2 = osc(V.b, e.base * V.bRatio);
      if (V.det) e.o2.detune.value = V.det;
      const g2 = gain(V.bMix);
      e.o1.connect(mix); e.o2.connect(g2); g2.connect(mix);
      e.srcs.push(e.o1, e.o2);
      if (V.vib) {
        const lfo = osc('sine', V.vib[0] + i * 3), lg = gain(V.vib[1]);
        lfo.connect(lg); lg.connect(e.o1.frequency); lg.connect(e.o2.frequency); e.srcs.push(lfo);
      }
      if (V.whine) { e.o3 = osc('sine', e.base * V.whine); const wg = gain(0.12); e.o3.connect(wg); wg.connect(lp); e.srcs.push(e.o3); }
      if (V.clatter) { const s = loop('white'), bp = filt('bandpass', 2200, 1.2), cg = gain(V.clatter); s.connect(bp); bp.connect(cg); cg.connect(body === lp ? out : body); e.srcs.push(s); }
      if (V.gurgle) { const s = loop('brown'), f = filt('lowpass', 420, 1); e.gurg = gain(0); s.connect(f); f.connect(e.gurg); e.gurg.connect(out); e.srcs.push(s); }
      if (V.fan) {
        const s = loop('white'); e.fanF = filt('bandpass', 600, 1.1); const fanAm = gain(0.75), bl = osc('sine', 20), bg = gain(0.25);
        bl.connect(bg); bg.connect(fanAm.gain); s.connect(e.fanF); e.fanF.connect(fanAm); e.fanG = gain(0); fanAm.connect(e.fanG); e.fanG.connect(out);
        e.blade = bl; e.srcs.push(s, bl);
      }
      if (V.servo) { e.sv = osc('square', 170); const bp = filt('bandpass', 1100, 3); e.svG = gain(0); e.sv.connect(bp); bp.connect(e.svG); e.svG.connect(out); e.srcs.push(e.sv); }
      if (V.crackle || V.sparks) {
        const s = loop('crackle'), f = filt(V.sparks ? 'highpass' : 'bandpass', V.sparks ? 3000 : 1600, V.sparks ? 0.7 : 1);
        e.crk = gain(0); s.connect(f); f.connect(e.crk); e.crk.connect(pan || this.engBus); e.srcs.push(s);
      }
      // skid layer
      const sk = loop(K.n, K.rate || 1), skf = filt(K.f[0], K.f[1] + i * (K.step || 0), K.f[2]);
      e.skg = gain(0); sk.connect(skf); skf.connect(e.skg); e.skg.connect(pan || this.engBus); e.srcs.push(sk);
      const t = ctx.currentTime;
      for (const s of e.srcs) s.start(t, s.buffer ? Math.random() * 1.5 : undefined);
      this.engines.push(e);
    }
  }
  stopEngines() {
    for (const e of this.engines) {
      for (const s of e.srcs) try { s.stop(); } catch (err) { /* already stopped */ }
      e.g.disconnect(); e.skg.disconnect(); if (e.crk) e.crk.disconnect(); if (e.pan) e.pan.disconnect();
    }
    this.engines = [];
  }
  // speedFrac 0..1, throttle 0..1, slip 0.., pan -1..1, vol 0..1
  updateEngine(i, speedFrac, throttle, slip, pan, vol) {
    const e = this.engines[i];
    if (!e || this.held || (!this.offline && this.ctx.state !== 'running')) return;
    const t = this.ctx.currentTime, V = e.V, dt = Math.min(0.1, Math.max(0.004, t - (e.lastT ?? t - 0.016)));
    e.lastT = t;
    const sp = Math.min(1.1, speedFrac);
    // revs: fake gear steps, an electric motor straight up with speed, or a snowmobile's clutch
    let f, shiftK = 1;
    if (V.electric) f = e.base + (V.top - V.base) * sp + throttle * 25;
    else if (V.cvt) f = e.base * (1 + 0.55 * throttle + 0.75 * sp);
    else {
      const gpos = Math.min(0.999, sp) * V.gears, gear = Math.floor(gpos), inGear = gpos - gear;
      f = e.base * (1 + gear * V.spread + inGear * V.range + throttle * 0.12);
      if (gear > e.gear && throttle > 0.3) e.shift = t + 0.09; // a short dip as the gear changes
      e.gear = gear;
      if (t < e.shift) shiftK = 0.55;
    }
    const tc = V.tc ?? 0.04;
    if (V.hum) e.o2.frequency.setTargetAtTime(f, t, tc);
    else { e.o1.frequency.setTargetAtTime(f, t, tc); e.o2.frequency.setTargetAtTime(f * V.bRatio, t, tc); }
    if (e.o3) e.o3.frequency.setTargetAtTime(f * V.whine, t, tc);
    if (e.am) e.am.frequency.setTargetAtTime(f * V.am[0], t, tc);
    e.f.frequency.setTargetAtTime(V.lp[0] + V.lp[1] * sp + V.lp[2] * throttle, t, 0.05);
    const lvl = vol * V.vol * (0.05 + 0.05 * throttle + 0.04 * sp) * shiftK;
    e.g.gain.setTargetAtTime(lvl, t, 0.06);
    if (e.gurg) e.gurg.gain.setTargetAtTime(vol * 0.12 * (1 - 0.6 * Math.min(1, sp)) * (0.4 + throttle), t, 0.1);
    if (e.fanF) {
      e.fanF.frequency.setTargetAtTime(450 + 1300 * sp + 300 * throttle, t, 0.08);
      e.blade.frequency.setTargetAtTime(14 + 36 * sp + 10 * throttle, t, 0.1);
      e.fanG.gain.setTargetAtTime(vol * (0.045 + 0.09 * throttle + 0.055 * sp), t, 0.08);
    }
    if (e.svG) { // servo whirr when the drive changes or the rover slides
      const k = Math.min(1, Math.abs(throttle - e.prevThr) / dt * 0.25 + (slip > 4 ? 0.35 : 0));
      e.svG.gain.setTargetAtTime(vol * 0.06 * k, t, 0.06); e.sv.frequency.setTargetAtTime(150 + 160 * k + 60 * sp, t, 0.06);
    }
    if (e.crk) {
      if (V.crackle && e.prevThr > 0.6 && throttle < 0.25 && sp > 0.35) burst(e.crk.gain, t, vol * 0.5, 0.2); // pops on lifting off
      else if (V.crackle && throttle < 0.2 && sp > 0.45 && Math.random() < dt * 2.5) burst(e.crk.gain, t, vol * 0.25, 0.1);
      else if (V.sparks && sp > 0.08 && Math.random() < dt * (0.2 + 0.7 * sp)) burst(e.crk.gain, t, vol * (0.25 + 0.3 * Math.random()), 0.06); // pole sparks
    }
    e.prevThr = throttle;
    const K = SKID[V.skid];
    const sv = (Math.max(0, Math.min(1, (slip - 7) / 25)) + (K.roll ? K.roll * Math.min(1, sp) * (slip > 0 ? 1 : 0.4) : 0)) * vol * K.g;
    e.skg.gain.setTargetAtTime(sv, t, 0.05);
    if (e.pan) e.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, pan)), t, 0.05);
    e.level = vol * (0.35 + 0.65 * throttle) * (0.4 + 0.6 * Math.min(1, sp));
  }
  silenceEngines() {
    this.held = true;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const e of this.engines) { e.g.gain.setTargetAtTime(0, t, 0.08); e.skg.gain.setTargetAtTime(0, t, 0.05); if (e.fanG) e.fanG.gain.setTargetAtTime(0, t, 0.08); if (e.gurg) e.gurg.gain.setTargetAtTime(0, t, 0.08); if (e.svG) e.svG.gain.setTargetAtTime(0, t, 0.05); e.level = 0; }
  }

  // per frame (game.updateAudio): the game clock for music that keeps time with the world, and the duck
  frame(game) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, off = t - game.time;
    this.gameOff = this.gameOff == null || Math.abs(off - this.gameOff) > 0.1 ? off : this.gameOff + (off - this.gameOff) * 0.1;
    let loud = 0;
    for (const e of this.engines) loud = Math.max(loud, e.level);
    const duck = 1 - 0.3 * Math.min(1, loud);
    if (Math.abs(duck - this.duckV) > 0.02) { this.duckV = duck; this.duck.gain.setTargetAtTime(duck, t, 0.3); }
  }

  // ---------------------------------------------------------------- race music and ambience
  compiled(id) {
    const k = pieceFor(id);
    let s = this.songs.get(k);
    if (!s) { s = compileSong(k); this.songs.set(k, s); }
    return s;
  }
  // start of every match (also the menu's attract race): the world's piece is compiled and its notes rendered
  // now, behind the loading card, so GO doesn't stutter
  prepareRace(id) {
    this.raceStop(0.3);
    this.raceId = id; this.finalLap = false; this.song = null;
    if (!this.ctx || !this.musicOn) return;
    this.song = this.compiled(id);
    this.kit.prepare(this.song);
  }
  // GO: music and background start (once per match; head-to-head rounds keep them going)
  raceGo(game) {
    if (!this.ctx || this.race || !this.raceId) return;
    const t = this.ctx.currentTime + 0.06, R = (this.race = { id: this.raceId, game });
    // (muted: built anyway; the suspended context runs nothing until it is unmuted)
    if (this.musicOn) {
      const song = this.song || this.compiled(this.raceId);
      R.player = new Player(this.kit, song, this.musicIn);
      let sync = null;
      // bars locked to the game clock: step 0 of the loop falls on a multiple of sync.bar in game time
      if (song.sync) sync = { g0: Math.floor(game.time / song.sync.bar) * song.sync.bar, off: () => this.gameOff ?? (this.ctx.currentTime - game.time) };
      R.player.start(t, sync);
      if (this.finalLap) R.player.setFinal(true);
    }
    if (this.fxOn) { R.amb =new Ambience(this.fxA, this.raceId, this.ambBus); R.amb.start(t); }
    this.pump();
    this.tick();
  }
  finalLapReached() { this.finalLap = true; if (this.race && this.race.player) this.race.player.setFinal(true); }
  // the race is over (results): fade out
  raceEnd() { this.raceStop(1.2); }
  raceStop(fade = 0.5) {
    const R = this.race;
    this.race = null;
    if (!R) return;
    if (R.player) R.player.stop(fade);
    if (R.amb) R.amb.stop(fade * 1.3);
  }
  setPaused(on) {
    const R = this.race;
    if (on) this.silenceEngines(); else this.held = false;
    if (!R) return;
    // frame() didn't run while paused: refresh the game-clock offset now, or a synced piece skips ahead
    if (!on && R.game && this.ctx) this.gameOff = this.ctx.currentTime - R.game.time;
    for (const p of [R.player, R.amb]) if (p) { if (on) p.pause(); else p.resume(); }
  }
  pump() {
    if (!this.ctx) return;
    const until = this.ctx.currentTime + LOOKAHEAD, R = this.race;
    if (R) { if (R.player) R.player.pump(until); if (R.amb) R.amb.pump(until); }
    if (this.menu) this.menu.pump(until);
  }
  tick() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.race && !this.menu) { clearInterval(this.timer); this.timer = null; return; }
      if (this.ctx.state === 'running') this.pump();
    }, 50);
  }

  // menu theme (title and lobby)
  startMusic() {
    this.wantMenu = true;
    if (this.menu || !this.musicOn || !this.ensure()) return;
    this.raceStop(0.4);
    this.menu = new Player(this.kit, this.compiled('menu'), this.musicIn);
    this.menu.start(this.ctx.currentTime + 0.1);
    this.pump();
    this.tick();
  }
  stopMusic() { this.wantMenu = false; if (this.menu) { this.menu.stop(0.4); this.menu = null; } }

  // ---------------------------------------------------------------- cues from the worlds
  // sound.cue(name, {x, z, game}) or {pan, vol}: 'whistle' (steam train), 'toot' (toy train), 'bell'
  // (crossing), 'clank' (sluice gate), 'tick' ({alt} for the tock). With a position the cue is panned and gets
  // quieter away from the middle of the view, but never silent.
  cue(name, o = {}) {
    const C = CUES[name];
    if (!C || !this.fx()) return;
    let pan = o.pan ?? 0, vol = o.vol ?? 1;
    const g = o.game;
    if (g) {
      if (g.state !== 'race' && g.state !== 'countdown' && g.state !== 'roundEnd') return;
      if (o.x != null) {
        pan = g.panOf(o.x, o.z);
        const d = Math.hypot(o.x - g.camX, o.z - g.camZ) / Math.max(40, g.camW || 90);
        vol *= Math.max(0.25, Math.min(1, 1.2 - d));
      }
    }
    C(this.fxA, this.ctx.currentTime + 0.01, pan, vol, o);
  }

  // ---------------------------------------------------------------- one-shots
  tone(freq, dur, { type = 'square', vol = 0.2, when = 0, slideTo = null, attack = 0.005, pan = 0 } = {}) {
    if (!this.fx()) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g), p = null;
    if (pan && ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.9, Math.min(0.9, pan)); node = node.connect(p); }
    node.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { g.disconnect(); if (p) p.disconnect(); };
  }
  noiseBurst(dur, { freq = 800, q = 1, vol = 0.3, type = 'lowpass', pan = 0, when = 0, buf = 'white', rate = 1 } = {}) {
    if (!this.fx()) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.N[buf] || this.noise; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = s.connect(f).connect(g), p = null;
    if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    s.onended = () => { f.disconnect(); g.disconnect(); if (p) p.disconnect(); };
  }
  // car hits a wall or another car (other: 'car', or 'bounce' for bouncy cars, spec.carBounce: bumper cars);
  // the sound follows the vehicle type
  bump(strength, pan = 0, other = null) {
    const v = Math.min(0.5, 0.06 + strength * 0.012), T = this.vtype;
    if (other === 'bounce' || (T === 'bumper' && other === 'car')) { this.boing(strength, pan); return; }
    if (T === 'boat') { this.tone(170 + Math.random() * 30, 0.14, { type: 'triangle', vol: v * 0.7, slideTo: 110, pan }); this.noiseBurst(0.18, { freq: 1600, q: 0.7, type: 'bandpass', vol: v * 0.35, pan }); return; }
    const low = T === 'monster' ? 0.6 : T === 'truck' ? 0.8 : T === 'formula' ? 1.3 : 1;
    this.noiseBurst(0.12, { freq: (500 + strength * 20) * low, vol: v * (T === 'suv' ? 0.7 : 1), pan });
    this.tone((90 + Math.random() * 30) * low, 0.12, { type: 'sine', vol: v * 0.8, pan });
  }
  clack(strength, pan = 0) {
    const v = Math.min(0.35, 0.05 + strength * 0.01);
    this.tone(1900 + Math.random() * 600, 0.06, { type: 'sine', vol: v });
    this.noiseBurst(0.03, { freq: 4000, type: 'highpass', vol: v * 0.6, pan });
  }
  thud(strength) { this.tone(70, 0.18, { type: 'sine', vol: Math.min(0.4, strength * 0.006), slideTo: 45 }); }
  // landing after a jump, per vehicle type
  land(strength, pan = 0) {
    const T = this.vtype, v = Math.min(0.4, strength * 0.006);
    if (T === 'boat') { this.splash(strength, pan); return; }
    if (T === 'monster') {
      this.tone(52, 0.38, { type: 'sine', vol: Math.min(0.55, strength * 0.009), slideTo: 26, pan });
      this.noiseBurst(0.4, { freq: 260, q: 0.8, vol: Math.min(0.35, strength * 0.005), pan, buf: 'gravel', rate: 0.5 });
      this.noiseBurst(0.12, { freq: 1800, q: 0.7, type: 'bandpass', vol: v * 0.4, pan });
      return;
    }
    if (T === 'hover') { this.sweep(0.35, { from: 900, to: 200, q: 0.8, vol: v * 0.5, type: 'lowpass', pan, attack: 0.02 }); this.tone(80, 0.2, { type: 'sine', vol: v * 0.6, slideTo: 50, pan }); return; }
    if (T === 'bumper') { this.boing(strength * 0.6, pan); return; }
    if (T === 'snowmobile') { this.noiseBurst(0.25, { freq: 1800, q: 0.8, type: 'bandpass', vol: v * 0.8, pan, buf: 'snow' }); this.tone(75, 0.15, { type: 'sine', vol: v * 0.7, slideTo: 48, pan }); return; }
    const k = T === 'truck' ? 0.8 : T === 'formula' ? 1.3 : T === 'rover' ? 0.9 : 1;
    this.tone(70 * k, 0.18, { type: 'sine', vol: v, slideTo: 45 * k, pan });
    if (T === 'rally' || T === 'truck') this.noiseBurst(0.2, { freq: 900, q: 0.8, type: 'bandpass', vol: v * 0.5, pan, buf: 'gravel' });
    if (T === 'rover') this.noiseBurst(0.3, { freq: 3500, type: 'highpass', vol: v * 0.3, pan });
  }
  // rubbery fairground-bumper "boing"
  boing(strength, pan = 0) {
    if (!this.fx()) return;
    const ctx = this.ctx, t = ctx.currentTime, v = Math.min(0.3, 0.06 + strength * 0.006), f = 150 + Math.random() * 60;
    const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.3, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.4);
    l.frequency.value = 13; lg.gain.setValueAtTime(f * 0.25, t); lg.gain.exponentialRampToValueAtTime(1, t + 0.4); l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    let node = o.connect(g), p = null;
    if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.9, Math.min(0.9, pan)); node = node.connect(p); }
    node.connect(this.sfx);
    o.start(t); l.start(t); o.stop(t + 0.5); l.stop(t + 0.5);
    o.onended = () => { for (const x of [lg, g, p]) if (x) x.disconnect(); };
    this.noiseBurst(0.06, { freq: 400, vol: v * 0.5, pan });
  }
  splash(strength, pan = 0) {
    if (!this.fx()) return;
    const v = Math.min(0.4, 0.08 + strength * 0.005);
    EV.splash(this.fxA, this.ctx.currentTime, v, Math.random, pan);
    this.tone(300, 0.25, { type: 'sine', vol: v * 0.6, slideTo: 80, pan });
    EV.bubbles(this.fxA, this.ctx.currentTime + 0.12, v * 0.3, Math.random, pan);
  }
  fall() { this.tone(950, 0.7, { type: 'triangle', vol: 0.16, slideTo: 140 }); }
  plop() { this.tone(300, 0.25, { type: 'sine', vol: 0.25, slideTo: 80 }); this.noiseBurst(0.15, { freq: 600, vol: 0.12 }); }
  jump() { this.tone(300, 0.25, { type: 'triangle', vol: 0.1, slideTo: 700 }); }
  beep(go = false) { this.tone(go ? 880 : 440, go ? 0.5 : 0.22, { type: 'square', vol: 0.14 }); }
  out() { this.tone(330, 0.16, { type: 'square', vol: 0.12 }); this.tone(220, 0.3, { type: 'square', vol: 0.12, when: 0.15 }); }
  roundWin() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.11, when: i * 0.09 }));
  }
  matchWin() {
    const seq = [523, 523, 523, 659, 784, 659, 784, 1047];
    const dur = [0.12, 0.12, 0.12, 0.25, 0.12, 0.12, 0.12, 0.6];
    let t = 0;
    seq.forEach((f, i) => { this.tone(f, dur[i] + 0.05, { type: 'square', vol: 0.11, when: t }); this.tone(f / 2, dur[i] + 0.05, { type: 'triangle', vol: 0.08, when: t }); t += dur[i]; });
  }
  click() { this.tone(1200, 0.04, { type: 'square', vol: 0.05 }); }

  // filtered noise whose filter (and level) glide over time: whooshes and rushes
  sweep(dur, { from = 500, to = 2000, q = 1.2, vol = 0.1, type = 'bandpass', pan = 0, attack = 0.1, when = 0 } = {}) {
    if (!this.fx()) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = s.connect(f).connect(g), p = null;
    if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.9, Math.min(0.9, pan)); node = node.connect(p); }
    node.connect(this.sfx);
    s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
    s.onended = () => { f.disconnect(); g.disconnect(); if (p) p.disconnect(); };
  }
  // soft rush of air when a car tucks into a slipstream
  whoosh(pan = 0, vol = 1) { this.sweep(0.75, { from: 380, to: 2400, q: 0.9, vol: 0.09 * vol, pan, attack: 0.25 }); }
  // turbo start: a rising "fwoom" with a little engine yelp
  turbo(pan = 0) {
    this.sweep(0.9, { from: 260, to: 3200, q: 0.7, vol: 0.16, pan, attack: 0.06 });
    this.tone(140, 0.55, { type: 'sawtooth', vol: 0.07, slideTo: 420, attack: 0.02 });
  }
  // bogged-down launch: a sputter and a short tyre squeal
  bog(pan = 0) {
    for (let i = 0; i < 4; i++) this.tone(62 + i * 3, 0.07, { type: 'square', vol: 0.07, when: i * 0.09 });
    this.noiseBurst(0.5, { freq: 1700, q: 2.5, type: 'bandpass', vol: 0.12, pan });
  }
  // hard crash: a crunch on top of the bump (bumper cars bounce, boats crack and splash)
  crunch(strength, pan = 0) {
    const v = Math.min(0.32, 0.08 + strength * 0.004), T = this.vtype;
    if (T === 'bumper') { this.boing(strength * 1.2, pan); this.noiseBurst(0.15, { freq: 3500, type: 'highpass', vol: v * 0.5, pan, buf: 'crackle' }); return; }
    if (T === 'boat') { this.noiseBurst(0.1, { freq: 2200, q: 1, type: 'bandpass', vol: v * 0.7, pan }); this.splash(strength * 0.6, pan); return; }
    const low = T === 'monster' ? 0.65 : 1;
    this.noiseBurst(0.22, { freq: 2600 * low, q: 0.8, type: 'highpass', vol: v * 0.7, pan });
    this.tone((150 + Math.random() * 40) * low, 0.22, { type: 'triangle', vol: v, slideTo: 55 * low, pan });
  }
  newBest() {
    [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.2, { type: 'square', vol: 0.1, when: i * 0.08 }));
    this.tone(1319, 0.5, { type: 'triangle', vol: 0.08, when: 0.32 });
  }
}

// a short level burst on a gain param (automation only: pops, sparks)
function burst(param, t, v, dur) { param.cancelScheduledValues(t); param.setValueAtTime(v, t); param.setTargetAtTime(0, t + 0.01, dur / 3); }
