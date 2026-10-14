// Game state: loading a world, the race loop, head-to-head elimination, race mode, time trial, scoring,
// and the arcade layer (catch-up, slipstream, turbo starts, crash juice).
import * as THREE from '../vendor/three.bundle.js';
import { Track } from './track.js';
import { PhysicsWorld, Car, VEHICLES } from './physics.js';
import { buildCar, syncCar } from './cars.js';
import { AIDriver } from './ai.js';
import { makeKit } from './kit.js';
import { SkidMarks, Particles } from './fx.js';
import { PLAYER_COLORS, clamp, damp, smoothstep } from './util.js';
import { loadBest, saveBest, clearBest, encodeGhost, decodeGhost, GHOST_HZ, formatTime } from './records.js';

const STEP = 1 / 120;
const GHOST_OPACITY = 0.45;

// Catch-up (rubber-banding). Humans behind the leader get more top speed (and a bit more pull),
// growing with the gap; CPU cars ahead of the best-placed human ease off (straights and corners);
// CPU cars far behind the leader get a small push so the pack stays together.
// Gaps are in track units: full effect at `full` (race) or `fullH2H` (head-to-head, where ~30 units
// behind is already near the screen edge).
export const CATCHUP = {
  off: null,
  mild: { human: 0.07, cpuEase: 0.07, cpuPush: 0.04 },
  strong: { human: 0.14, cpuEase: 0.14, cpuPush: 0.08 },
  full: 60, fullH2H: 30, rate: 2.5,
};

// Slipstream: close behind another car, inside a narrow cone, both at speed.
export const DRAFT = { range: 14, minBehind: 3, halfWidth: 1.4, spread: 0.08, minSpeed: 20, build: 0.4, fade: 0.15, top: 0.10, accel: 0.4 };

// Turbo start: gas pressed in the last `window` s before GO (or within `grace` after it).
// Gas held since before the last beep (`early` s before GO) bogs the car down (full countdowns only).
// cpu: [turbo chance, bog chance] per skill.
export const TURBO = {
  window: 0.3, grace: 0.06, early: 1.0, dur: 1.2, top: 0.15, accel: 1.0, bogDur: 0.9, bogAccel: 0.25,
  cpu: { easy: [0.15, 0.12], normal: [0.35, 0.06], hard: [0.6, 0.02] },
};

const autoGas = (d) => d.type === 'simple' || d.type === 'touch';

export class Game {
  constructor(renderer, input, sound, hud) {
    this.R = renderer; this.input = input; this.sound = sound; this.hud = hud;
    this.state = 'idle'; // idle | countdown | race | roundEnd | matchEnd | paused | attract
    this.world = null;
    this.cars = [];
    this.time = 0;
    this.acc = 0;
    this.tmpV = new THREE.Vector3();
    this.camX = 0; this.camZ = 0; this.camW = 90;
    this.onMatchEnd = null;
    this.debug = { freeze: false };
    this.catchup = 'mild';
    this.shake = 0;
    this.tt = null;
    this.ghostModel = null;
    try { this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { this.reduceMotion = false; }
  }

  // ---------- world loading ----------
  async loadWorld(def, settings = {}) {
    this.unloadWorld();
    this.def = def;
    const track = new Track(def.track.points, { width: def.track.width ?? 14 });
    this.track = track;
    const physics = new PhysicsWorld(track, {
      bounds: def.bounds, fallOffEdges: def.fallOffEdges ?? true, floorY: def.floorY ?? -70, offroad: def.offroad || null, gravity: def.gravity ?? 1,
    });
    this.physics = physics;
    const kit = makeKit({ scene: this.R.scene, track, physics, quality: this.R.quality, seed: def.seed ?? 7 });
    this.kit = kit;
    this.R.setLighting(def.lighting || {});
    await def.build(kit, settings);
    this.skids = new SkidMarks(kit.group);
    if (def.skidColor) this.skids.setColor(def.skidColor);
    this.particles = new Particles(kit.group);
    this.updateParticleScale();
    this.world = def;
    this.startS = def.track.startS ?? 0;
    this.camX = track.x[0]; this.camZ = track.z[0];
  }

  unloadWorld() {
    for (const c of this.cars) { this.R.scene.remove(c.model.root); this.R.scene.remove(c.model.shadow); }
    this.cars = [];
    this.removeGhostModel();
    this.tt = null;
    if (this.kit) this.kit.dispose();
    this.kit = null; this.world = null;
  }

  updateParticleScale() {
    if (!this.particles) return;
    const h = this.R.renderer.domElement.height;
    this.particles.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(this.R.camera.fov) / 2)));
  }

  // Distance past the start/finish line (laps are counted where the line is drawn, at startS).
  relS(s) { const L = this.track.length; return (((s - this.startS) % L) + L) % L; }
  humanCount() { return this.cars.filter((e) => e.human).length; }

  // ---------- match setup ----------
  // drivers: [{type:'keys'|'simple'|'pad'|'touch'|'cpu', slot, pad, color}]
  // mode: 'h2h' | 'race' | 'tt' (time trial, one driver)
  startMatch({ drivers, mode = 'h2h', pointsToWin = 5, laps = 3, skill = 'normal', catchup = 'mild' }) {
    for (const c of this.cars) { this.R.scene.remove(c.model.root); this.R.scene.remove(c.model.shadow); }
    this.mode = mode;
    this.pointsToWin = pointsToWin;
    this.laps = laps;
    this.skill = skill;
    this.catchup = CATCHUP[catchup] ? catchup : 'off';
    if (mode === 'tt') drivers = drivers.slice(0, 1);
    const vtype = this.def.vehicle || 'sports';
    this.cars = drivers.map((d, i) => {
      const spec = { ...VEHICLES[vtype] };
      const car = new Car(spec, i);
      const colorDef = PLAYER_COLORS[d.color];
      const model = buildCar(vtype, colorDef, d.color + 1);
      if (this.def.headlights) addHeadlights(model, this.def.headlights);
      this.R.scene.add(model.root); this.R.scene.add(model.shadow);
      const ent = {
        car, model, driver: d, color: colorDef, colorIndex: d.color, human: d.type !== 'cpu',
        name: d.type === 'cpu' ? `CPU ${colorDef.name}` : `${colorDef.name}`,
        points: 0, out: false, finished: false, finishTime: 0, place: 0,
        trackI: 0, trackS: 0, lap: 0, maxLap: 0, progress: 0, lastGoodS: 0, offT: 0, respawnT: 0, lateral: 0,
        ai: d.type === 'cpu' ? new AIDriver(car, this.track, this.physics, skill, i + 1) : null,
        lapStart: 0, bestLap: Infinity, midSeen: false,
        cu: 1, cuTarget: 1, gasT0: null, turboGrace: 0, launch: null, whooshT: 0, rumbleT: 0,
      };
      car.ent = ent;
      return ent;
    });
    this.sound.createEngines(this.cars.length);
    this.round = 0;
    this.raceTime = 0;
    this.finishOrder = [];
    this.raceDoneT = 0;
    this.shake = 0;
    this.removeGhostModel();
    this.tt = null;
    if (mode === 'tt') this.setupTimeTrial();
    this.placeGrid(this.startS, null, 0);
    this.snapCamera();
    this.beginCountdown(true);
  }

  // Line the cars up behind s0 (2 x 2 grid). baseProg = race progress at s0, so lap counts stay
  // consistent even when the grid straddles the start/finish line.
  placeGrid(s0, front, baseProg = 0) {
    const order = [...this.cars];
    if (front) { order.splice(order.indexOf(front), 1); order.unshift(front); }
    const tr = this.track, L = tr.length;
    order.forEach((e, k) => {
      let back, lat;
      if (this.mode === 'tt') { back = 10; lat = 0; } // a short run-up: the clock starts at the line
      else {
        const row = Math.floor(k / 2), col = k % 2;
        back = row * 7.5 + col * 2.5;
        const w = tr.at(s0 - back).w;
        lat = (col === 0 ? -1 : 1) * Math.min(3.2, w / 2 - 2.2);
      }
      const p = tr.place(s0 - back, lat);
      e.car.place(p.x, p.z, p.angle);
      e.car.y = e.car.groundY = this.physics.groundAt(p.x, p.z).g; // grid slots on a ramp or platform
      e.car.turbo = 0; e.car.bog = 0;
      e.out = false; e.offT = 0; e.respawnT = 0;
      const n = tr.nearest(p.x, p.z);
      e.trackI = n.i; e.trackS = n.s; e.lastGoodS = n.s;
      const r = this.relS(n.s);
      e.lap = Math.round((baseProg - back - r) / L);
      e.maxLap = e.lap; e.midSeen = false;
      e.progress = e.lap * L + r;
      e.car.trackS = n.s;
      e.car.ghost = 0;
      e.gasT0 = null; e.turboGrace = 0; e.launch = null;
      if (e.ai) { e.ai.stuckT = 0; e.ai.reverseT = 0; e.ai.avoid = 0; }
      this.skids?.break(e.car.index + 'l'); this.skids?.break(e.car.index + 'r');
    });
  }

  beginCountdown(full) {
    this.state = 'countdown';
    this.countT = full ? 3.2 : 1.8;
    this.countFull = full;
    this.lastBeep = null;
    this.roundTime = 0;
    this.hud.message(full ? '' : 'Ready…', null);
  }

  snapCamera() {
    const f = this.cameraFocus();
    this.camX = f.x; this.camZ = f.z; this.camW = f.w;
    this.R.placeCamera(this.camX, this.camZ, this.camW);
  }

  // ---------- per-frame ----------
  update(dtReal) {
    if (!this.world) return;
    if (this.state === 'paused') { this.R.shake = 0; this.R.render(); return; }
    const dt = Math.min(dtReal, 0.05);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.fixedStep(STEP);
      this.acc -= STEP; steps++;
    }
    if (steps === 8) this.acc = 0;
    this.particles.update(dt);
    this.updateCamera(dt);
    this.updateVisuals(dt);
    this.updateAudio();
    this.hud.update(this);
    if (this.world.animate) this.world.animate(this.time, dt, this);
    this.shake *= Math.exp(-8 * dt);
    this.R.shake = this.reduceMotion ? 0 : this.shake;
    this.R.render();
  }

  // Advance the simulation without rendering (used by automated tests).
  simulate(seconds) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
      this.fixedStep(STEP);
      if (i % 4 === 0) { this.particles.update(STEP * 4); this.updateCamera(STEP * 4); this.updateVisuals(STEP * 4); }
    }
    this.hud.update(this);
  }

  fixedStep(dt) {
    this.time += dt;
    const P = this.physics;
    const racing = this.state === 'race' || this.state === 'roundEnd' || this.state === 'attract';
    if (this.state === 'countdown') {
      const before = this.countT;
      this.countT -= dt;
      const n = Math.ceil(this.countT);
      if (this.countFull) {
        if (n !== this.lastBeep && n >= 1 && n <= 3) { this.lastBeep = n; this.sound.beep(false); this.hud.message(String(n), 'count'); }
      } else if (before > 1 && this.countT <= 1) {
        // short restart: one "set" beep a second before GO gives the turbo-start rhythm
        this.sound.beep(false); this.hud.message('Set…', null);
      }
      if (before > 0 && this.countT <= 0) {
        this.state = 'race';
        this.sound.beep(true);
        this.hud.message('GO!', 'go');
        setTimeout(() => { if (this.state === 'race') this.hud.message('', null); }, 700);
        this.launch();
      }
    }
    if (racing) { this.raceTime += dt; this.roundTime += dt; }

    this.updateCatchUp(dt);
    this.updateDraft(dt);

    // controls
    const allCars = this.cars.map((x) => x.car);
    for (const e of this.cars) {
      const c = e.car;
      if (e.finished && this.mode === 'race') {
        // cool-down lap: finished cars keep rolling on autopilot instead of parking on the racing line
        if (!e.cooldown) e.cooldown = e.ai || new AIDriver(c, this.track, this.physics, 'easy', 90 + e.colorIndex);
        e.cooldown.update(dt, allCars, { speedMul: 0.7 });
      } else if (e.ai) {
        e.ai.update(dt, allCars, { speedMul: e.cu * this.boostTop(c), paceMul: e.cu });
      } else {
        const ctl = this.input.read(e.driver);
        c.throttle = ctl.throttle; c.brake = ctl.brake; c.steer = ctl.steer;
        this.trackGas(e, ctl.throttle);
      }
      if (!racing) {
        c.revs = c.throttle; c.throttle = 0; c.brake = 0; c.steer = 0;
        // held on the grid: don't let the CPU decide it is stuck and reverse at GO
        if (e.ai) { e.ai.stuckT = 0; e.ai.reverseT = 0; }
      }
    }
    for (const e of this.cars) {
      if (e.out) continue;
      const c = e.car;
      if (!racing && c.state === 'drive') { c.vx = c.vz = c.w = 0; continue; } // held on the grid
      // humans get the catch-up bonus as more top speed and pull; CPU ease-off lives in the AI's pace
      const cu = e.human ? e.cu : Math.max(1, e.cu);
      const top = this.boostTop(c) * cu;
      const acc = this.boostAcc(c) * (1 + (cu - 1) * 1.5);
      P.stepCar(c, dt, { lateral: e.lateral, trackW: this.track.w[e.trackI], speedMul: top, accelMul: acc });
      if (c.turbo > 0) c.turbo = Math.max(0, c.turbo - dt);
      if (c.bog > 0) {
        c.bog = Math.max(0, c.bog - dt);
        c.slip = Math.max(c.slip, 24 * Math.min(1, c.bog / 0.3)); // wheelspin: squeal and rubber on the grid
      }
    }
    P.collideCars(this.cars.filter((e) => !e.out).map((e) => e.car));
    if (P.movers.length) P.updateMovers(this.time, dt);
    if (P.spinners.length) { P.updateSpinners(this.time, dt); P.carrySpinners(this.cars.filter((e) => !e.out).map((e) => e.car), dt); }
    // fixed-rate gameplay hook for worlds (currents, wind, force zones): tick(dt, time, game)
    if (this.def.tick && racingOrHeld(this.state)) this.def.tick(dt, this.time, this);
    P.stepDynamics(dt, this.cars.filter((e) => !e.out).map((e) => e.car));

    // track progress, laps, off-course and respawn
    const tr = this.track, L = tr.length;
    for (const e of this.cars) {
      if (e.out) continue;
      const c = e.car;
      if (c.state === 'drive') {
        const n = tr.nearest(c.x, c.z, e.trackI);
        // no extreme shortcuts: the nearest road point may only move on a little at a time. A big forward jump
        // means the car crossed the infield to a later part of the lap: put it back where it left the road.
        let skip = n.s - e.trackS;
        if (skip > L / 2) skip -= L; else if (skip < -L / 2) skip += L;
        if (Math.abs(skip) > (this.def.maxShortcut ?? 45) && (racing || this.state === 'countdown')) { this.caughtCutting(e, skip > 0); continue; }
        const r0 = this.relS(e.trackS), r1 = this.relS(n.s);
        const dr = r1 - r0;
        if (dr < -L / 2) { e.lap++; this.onLap(e); }
        else if (dr > L / 2) { e.lap--; }
        if (r1 > L * 0.3 && r1 < L * 0.7) e.midSeen = true;
        e.trackI = n.i; e.trackS = n.s; e.lateral = n.lateral;
        e.progress = e.lap * L + r1;
        c.trackS = n.s;
        const w = tr.w[n.i];
        const limit = w / 2 + (this.def.offCourse ?? 14);
        if (Math.abs(n.lateral) < w / 2 + 1 && !c.airborne) e.lastGoodS = n.s;
        if (Math.abs(n.lateral) > limit) e.offT += dt; else e.offT = Math.max(0, e.offT - dt * 2);
        if (e.offT > 1.6 && racing) { this.particles.emit(c.x, c.y + 1, c.z, { color: 0xffffff, n: 14, size: 2.2, life: 0.6, spread: 8, up: 4, grav: 0, grow: 2.5, alpha: 0.7 }); this.respawn(e); }
        c.groundY = c.y;
      } else if (c.state === 'falling') {
        e.respawnT += dt;
        if (e.respawnT > (c.fallKind === 'hole' ? 0.9 : 1.25)) this.respawn(e);
      }
    }
    if (this.tt) this.recordGhost(dt);

    // events -> sound + particles
    for (const ev of P.events) this.handleEvent(ev);
    P.events.length = 0;

    if (this.state === 'race') {
      if (this.mode === 'h2h') this.checkElimination(dt);
      else if (this.mode === 'race') this.checkRace(dt);
    }
    if (this.state === 'roundEnd') {
      this.roundEndT -= dt;
      if (this.roundEndT <= 0) this.nextRound();
    }
  }

  // ---------- arcade layer ----------
  updateCatchUp(dt) {
    const lvl = this.mode === 'tt' || this.state === 'attract' ? null : CATCHUP[this.catchup];
    let leadP = -Infinity, bestH = -Infinity, humans = 0;
    for (const e of this.cars) {
      if (e.out || e.finished) continue;
      leadP = Math.max(leadP, e.progress);
      if (e.human) { humans++; bestH = Math.max(bestH, e.progress); }
    }
    const full = this.mode === 'h2h' ? CATCHUP.fullH2H : CATCHUP.full;
    const k = 1 - Math.exp(-CATCHUP.rate * dt);
    for (const e of this.cars) {
      let t = 1;
      if (lvl && humans && !e.out && !e.finished && this.state !== 'countdown') {
        if (e.human) t = 1 + lvl.human * smoothstep(6, full, leadP - e.progress);
        else {
          const lead = e.progress - bestH;
          if (lead > 0) t = 1 - lvl.cpuEase * smoothstep(4, full, lead);
          else t = 1 + lvl.cpuPush * smoothstep(full * 0.7, full * 1.8, leadP - e.progress);
        }
      }
      e.cuTarget = t;
      e.cu += (t - e.cu) * k;
    }
  }

  // Slipstream: build up over DRAFT.build s inside the cone behind another car, fade fast outside it.
  updateDraft(dt) {
    const list = this.cars;
    for (const e of list) {
      const a = e.car;
      let target = 0;
      if (!e.out && a.state === 'drive' && !a.airborne && a.speed > DRAFT.minSpeed && this.state !== 'countdown') {
        const ac = Math.cos(a.angle), as = Math.sin(a.angle);
        for (const o of list) {
          if (o === e || o.out) continue;
          const b = o.car;
          if (b.state !== 'drive' || b.speed < DRAFT.minSpeed || Math.abs(a.y - b.y) > 2) continue;
          const bc = Math.cos(b.angle), bs = Math.sin(b.angle);
          if (ac * bc + as * bs < 0.8) continue; // heading the same way
          const dx = a.x - b.x, dz = a.z - b.z;
          const behind = -(dx * bc + dz * bs);
          if (behind < DRAFT.minBehind || behind > DRAFT.range) continue;
          const side = Math.abs(-dx * bs + dz * bc);
          if (side > DRAFT.halfWidth + behind * DRAFT.spread) continue;
          target = Math.max(target, behind < 9 ? 1 : 1 - ((behind - 9) / (DRAFT.range - 9)) * 0.5);
        }
      }
      const was = a.draft;
      if (target > a.draft) a.draft = Math.min(target, a.draft + dt / DRAFT.build);
      else a.draft = Math.max(target, a.draft - dt / DRAFT.fade);
      e.whooshT = Math.max(0, e.whooshT - dt);
      if (was < 0.6 && a.draft >= 0.6 && e.whooshT <= 0) {
        e.whooshT = 1.5;
        if (e.human || this.onScreen(a.x, a.y, a.z, 0)) this.sound.whoosh(this.panOf(a.x, a.z), e.human ? 1 : 0.35);
      }
    }
  }

  boostTop(c) { return (1 + DRAFT.top * c.draft) * (1 + TURBO.top * Math.min(1, c.turbo / 0.3)); }
  boostAcc(c) { return (1 + DRAFT.accel * c.draft) * (1 + TURBO.accel * Math.min(1, c.turbo / 0.3)) * (c.bog > 0 ? TURBO.bogAccel : 1); }

  // gas timing during the countdown (turbo start / too early)
  trackGas(e, thr) {
    if (autoGas(e.driver)) return;
    if (this.state === 'countdown') {
      if (thr > 0.5) { if (e.gasT0 == null) e.gasT0 = this.time; } else e.gasT0 = null;
    } else if (e.turboGrace > 0) {
      e.turboGrace -= STEP;
      if (thr > 0.5) { e.turboGrace = 0; this.giveTurbo(e); }
    }
  }

  // GO: hand out turbo starts and bogged launches
  launch() {
    for (const e of this.cars) {
      const c = e.car;
      c.turbo = 0; c.bog = 0; e.turboGrace = 0; e.launch = null;
      if (e.out || c.state !== 'drive') continue;
      if (e.ai) {
        const p = TURBO.cpu[this.skill] || TURBO.cpu.normal;
        const r = e.ai.r();
        if (r < p[0]) this.giveTurbo(e);
        else if (this.countFull && r < p[0] + p[1]) this.giveBog(e);
      } else if (!autoGas(e.driver)) {
        if (e.gasT0 != null) {
          const held = this.time - e.gasT0;
          if (held <= TURBO.window + 1e-6) this.giveTurbo(e);
          else if (held > TURBO.early && this.countFull) this.giveBog(e);
        } else e.turboGrace = TURBO.grace;
      }
      e.gasT0 = null;
    }
  }

  giveTurbo(e) {
    const c = e.car;
    c.turbo = TURBO.dur; c.bog = 0; e.launch = 'turbo';
    this.exhaust(c, 1, 8);
    if (e.human) {
      this.sound.turbo(this.panOf(c.x, c.z));
      this.hud.flash(this.humanCount() > 1 ? `${e.name}: Turbo start!` : 'Turbo start!', e.color.hex);
      this.rumble(e, 0.35, 250);
    }
  }

  giveBog(e) {
    const c = e.car;
    c.bog = TURBO.bogDur; c.turbo = 0; e.launch = 'bog';
    if (e.human) {
      this.sound.bog(this.panOf(c.x, c.z));
      this.hud.flash(this.humanCount() > 1 ? `${e.name}: Too early!` : 'Too early!', e.color.hex);
      this.rumble(e, 0.7, 350);
    }
  }

  // flame and smoke from the exhaust (turbo)
  exhaust(c, k = 1, n = 1) {
    const cs = Math.cos(c.angle), sn = Math.sin(c.angle);
    const x = c.x - cs * c.spec.len * 0.52, z = c.z - sn * c.spec.len * 0.52, y = c.y + 0.55;
    for (let i = 0; i < n; i++) {
      // a hot core and an orange lick that stay close behind the car, then a grey puff
      this.particles.emit(x, y, z, { color: 0xfff1a8, size: 0.9 * k, life: 0.12, spread: 1.2, up: 0.4, grav: 0, grow: 0.7, alpha: 1, vx: c.vx * 0.85 - cs * 5, vz: c.vz * 0.85 - sn * 5 });
      this.particles.emit(x - cs * 0.4, y, z - sn * 0.4, { color: Math.random() < 0.5 ? 0xff8a1e : 0xffb23a, size: 1.35 * k, life: 0.2, spread: 2.5, up: 0.8, grav: 0, grow: 0.5, alpha: 0.95, vx: c.vx * 0.75 - cs * 8, vz: c.vz * 0.75 - sn * 8 });
      if (Math.random() < 0.6) this.particles.emit(x, y + 0.2, z, { color: 0x8d8a86, size: 1.4 * k, life: 0.6, spread: 3, up: 1.6, grav: -2, grow: 2.6, alpha: 0.35, vx: c.vx * 0.3 - cs * 6, vz: c.vz * 0.3 - sn * 6 });
    }
  }

  addShake(a) { if (this.state !== 'attract') this.shake = Math.min(1.1, Math.max(this.shake, a)); }

  // gamepad rumble for a human driver on a pad (guarded: not every browser/pad supports it)
  rumble(e, strength, ms = 120) {
    if (!e || !e.human || e.driver.type !== 'pad') return;
    const now = performance.now();
    if (now - e.rumbleT < 90) return;
    e.rumbleT = now;
    try {
      const p = this.input.pad(e.driver.pad);
      const act = p && p.vibrationActuator;
      if (act && act.playEffect) {
        const r = act.playEffect('dual-rumble', { startDelay: 0, duration: Math.round(ms), weakMagnitude: Math.min(1, strength * 0.8), strongMagnitude: Math.min(1, strength) });
        if (r && r.catch) r.catch(() => {});
      }
    } catch (err) { /* no rumble */ }
  }

  // big hits: crunch, camera shake (stronger when a human is involved), rumble for the humans involved
  crashJuice(ev, pan) {
    const s = ev.strength;
    if (s < 15) return;
    const a = ev.car && ev.car.ent, b = ev.other && ev.other.ent;
    const human = (a && a.human) || (b && b.human);
    const k = clamp((s - 15) / 35, 0, 1);
    this.addShake((human ? 1 : 0.45) * (0.25 + 0.75 * k));
    if (s > 24) this.sound.crunch(s, pan);
    for (const e of [a, b]) if (e && e.human) this.rumble(e, 0.25 + 0.75 * k, 90 + 170 * k);
  }

  onLap(e) {
    if (e.lap <= e.maxLap) return; // crossing the line again after backing over it
    e.maxLap = e.lap;
    if (this.mode === 'tt') { this.onTimeTrialLap(e); return; }
    if (this.mode !== 'race') return;
    const lapTime = this.raceTime - e.lapStart;
    if (e.lap > 0 && lapTime < e.bestLap) e.bestLap = lapTime;
    e.lapStart = this.raceTime;
    if (e.lap >= this.laps && !e.finished) {
      e.finished = true; e.finishTime = this.raceTime;
      this.finishOrder.push(e);
      e.place = this.finishOrder.length;
      if (e.human) { this.sound.roundWin(); this.hud.flash(`${e.name} finishes ${ordinal(e.place)}!`, e.color.hex); }
    } else if (e.human && e.lap > 0 && e.lap === this.laps - 1) {
      this.hud.flash('Final lap!', e.color.hex);
    }
  }

  caughtCutting(e, forward = true) {
    e.cuts = (e.cuts || 0) + 1;
    if (e.human && forward) this.hud.flash(this.humanCount?.() > 1 ? `${e.name}: no shortcuts!` : 'No shortcuts!', e.color.hex);
    this.particles.emit(e.car.x, e.car.y + 1, e.car.z, { color: 0xffffff, n: 14, size: 2.2, life: 0.6, spread: 8, up: 4, grav: 0, grow: 2.5, alpha: 0.7 });
    this.respawn(e);
  }

  respawn(e) {
    const c = e.car, tr = this.track;
    let s = e.lastGoodS - 3;
    // find a free spot (not on top of another car)
    let lat = 0;
    for (const tryLat of [0, -3.5, 3.5, -6, 6]) {
      const p = tr.place(s, tryLat);
      if (!this.cars.some((o) => o !== e && !o.out && o.car.state === 'drive' && Math.hypot(o.car.x - p.x, o.car.z - p.z) < 4.5)) { lat = tryLat; break; }
    }
    const p = tr.place(s, lat);
    c.place(p.x, p.z, p.angle);
    c.y = c.groundY = this.physics.groundAt(p.x, p.z).g; // respawning on a viaduct, bridge or platform
    c.ghost = 1.2;
    e.offT = 0; e.respawnT = 0;
    const n = tr.nearest(p.x, p.z, e.trackI);
    // keep the lap count: pick the lap that puts the car nearest to its progress before the respawn
    const r = this.relS(n.s), L = tr.length;
    e.lap = Math.round((e.progress - r) / L);
    e.progress = e.lap * L + r;
    e.trackI = n.i; e.trackS = n.s; c.trackS = n.s;
    this.skids.break(c.index + 'l'); this.skids.break(c.index + 'r');
    this.particles.emit(p.x, 1, p.z, { color: 0xffffff, n: 10, size: 2, life: 0.5, spread: 6, up: 3, grav: 0, grow: 2.5, alpha: 0.6 });
  }

  handleEvent(ev) {
    const S = this.sound;
    const pan = ev.car ? this.panOf(ev.car.x, ev.car.z) : (ev.x != null ? this.panOf(ev.x, ev.z) : 0);
    const onScreen = ev.car ? this.onScreen(ev.car.x, ev.car.y, ev.car.z, 0.2) : true;
    if (!onScreen) return;
    switch (ev.type) {
      case 'hit': S.bump(ev.strength, pan); this.sparks(ev.car, ev.strength); this.crashJuice(ev, pan); break;
      case 'bump':
        S.bump(ev.strength * 0.8, pan);
        if (ev.obj && this.def.clackOnBump) S.clack(ev.strength, pan);
        if (!ev.obj && ev.strength >= 14) this.sparksAt(ev.x, ev.car.y + 0.8, ev.z, ev.strength);
        this.crashJuice(ev, pan);
        break;
      case 'clack': S.clack(ev.strength, pan); break;
      case 'land': S.thud(ev.strength); this.particles.emit(ev.car.x, 0.3, ev.car.z, { color: this.def.dustColor ?? 0xe8e0d0, n: 8, size: 1.4, life: 0.5, spread: 10, up: 2, grav: 4, grow: 1.6, alpha: 0.5 }); break;
      case 'jump': S.jump(); break;
      case 'fall': if (ev.kind === 'hole') S.plop(); else S.fall(); break;
      case 'pocket': S.plop(); break;
    }
  }

  sparks(car, strength) {
    if (strength < 12) return;
    this.sparksAt(car.x, car.y + 0.8, car.z, strength);
  }
  sparksAt(x, y, z, strength) {
    this.particles.emit(x, y, z, { color: 0xfff2c0, n: Math.min(14, strength / 3 | 0), size: 0.5, life: 0.25, spread: 25, up: 8, grav: 60, alpha: 1 });
  }

  // ---------- head-to-head ----------
  aliveCars() { return this.cars.filter((e) => !e.out); }
  leader(list = this.aliveCars()) {
    let best = null;
    for (const e of list) if (!best || e.progress > best.progress) best = e;
    return best;
  }

  onScreen(x, y, z, margin = 0) {
    const p = this.R.project(x, y, z, this.tmpV);
    return p.z < 1 && Math.abs(p.x) <= 1 + margin && Math.abs(p.y) <= 1 + margin;
  }

  checkElimination() {
    const alive = this.aliveCars();
    for (const e of alive) {
      const c = e.car;
      // only judged while driving or falling on screen; a respawned car off screen is out too
      const off = !this.onScreen(c.x, Math.max(0, c.y), c.z, 0.04);
      if (off && c.state !== 'hidden') {
        e.out = true; c.state = 'out';
        this.sound.out();
        this.hud.flash(`${e.name} is out!`, e.color.hex);
      }
    }
    let still = this.aliveCars();
    // every human is out but several CPU cars remain: give the round to the leading CPU after a short moment
    const hasHumans = this.cars.some((e) => e.human);
    if (hasHumans && still.length > 1 && !still.some((e) => e.human)) {
      this.cpuOnlyT = (this.cpuOnlyT || 0) + STEP;
      if (this.cpuOnlyT > 2.2) still = [this.leader(still)];
    } else this.cpuOnlyT = 0;
    if (still.length <= 1) {
      this.cpuOnlyT = 0;
      const w = still[0] || null;
      this.state = 'roundEnd';
      this.roundEndT = 2.6;
      this.roundWinner = w;
      if (w) {
        w.points++;
        this.sound.roundWin();
        this.hud.message(`${w.name} wins the round`, 'round', w.color.hex);
      } else {
        this.hud.message('Nobody survived!', 'round');
      }
      const ref = w || this.leader(this.cars);
      this.lastRoundS = ref ? ref.trackS : this.startS;
      this.lastRoundProg = ref ? ref.progress : 0;
    }
  }

  nextRound() {
    const champ = this.cars.find((e) => e.points >= this.pointsToWin);
    if (champ) return this.endMatch(champ);
    this.round++;
    for (const e of this.cars) { e.out = false; e.car.state = 'drive'; }
    // everybody restarts where the round was won
    this.placeGrid(this.lastRoundS + 4, this.roundWinner, (this.lastRoundProg ?? 0) + 4);
    this.snapCamera();
    this.hud.message('', null);
    this.beginCountdown(false);
  }

  // ---------- race ----------
  checkRace() {
    const humans = this.cars.filter((e) => e.human);
    const done = humans.length ? humans.every((e) => e.finished) : this.cars.every((e) => e.finished);
    // humans that fall too far behind the shared screen get pulled forward
    if (humans.length > 1) {
      for (const e of humans) {
        if (e.finished || e.car.state !== 'drive') continue;
        if (!this.onScreen(e.car.x, e.car.y, e.car.z, 0.02)) {
          const lead = this.leader(humans.filter((h) => !h.finished)) || e;
          e.lastGoodS = lead.trackS - 10;
          e.progress = lead.progress - 10; // respawn() keeps the lap count consistent with this
          this.respawn(e);
        }
      }
    }
    if (done && !this.raceDoneT) this.raceDoneT = 1.5;
    if (this.raceDoneT) {
      this.raceDoneT -= STEP;
      if (this.raceDoneT <= 0) {
        this.raceDoneT = 0;
        // rank the rest by progress
        const rest = this.cars.filter((e) => !e.finished).sort((a, b) => b.progress - a.progress);
        for (const e of rest) { this.finishOrder.push(e); e.place = this.finishOrder.length; }
        this.endMatch(this.finishOrder[0]);
      }
    }
  }

  endMatch(winner) {
    this.state = 'matchEnd';
    this.sound.silenceEngines();
    this.sound.matchWin();
    const standings = this.mode === 'h2h'
      ? [...this.cars].sort((a, b) => b.points - a.points)
      : [...this.finishOrder];
    this.hud.message('', null);
    if (this.onMatchEnd) this.onMatchEnd({ winner, standings, mode: this.mode });
  }

  // ---------- time trial ----------
  trackSig() { return Math.round(this.track.length * 10) + ':' + this.startS; }

  setupTimeTrial() {
    const id = this.def.id;
    let rec = loadBest(id);
    // the track changed since the record was set: its ghost would drive through the scenery
    if (rec && rec.sig !== this.trackSig()) { clearBest(id); rec = null; }
    this.tt = {
      best: rec ? rec.t : null, ghost: rec ? decodeGhost(rec.g) : null,
      lastLap: null, laps: 0, rec: [], recAcc: 0, recording: false, newBest: 0,
    };
    this.buildGhostModel(this.cars[0].colorIndex);
  }

  sampleGhost(e) { const c = e.car; this.tt.rec.push(c.x, c.y, c.z, c.angle); }

  recordGhost(dt) {
    const T = this.tt;
    if (!T.recording || this.state !== 'race') return;
    T.recAcc += dt;
    if (T.recAcc >= 1 / GHOST_HZ - 1e-9) { T.recAcc -= 1 / GHOST_HZ; this.sampleGhost(this.cars[0]); }
    if (T.rec.length > 4 * GHOST_HZ * 300) T.recording = false; // a five-minute lap isn't going to be a record
  }

  onTimeTrialLap(e) {
    const T = this.tt, now = this.raceTime;
    if (e.lap >= 1 && T.recording && e.midSeen) {
      const lapTime = now - e.lapStart;
      T.lastLap = lapTime; T.laps++;
      const prev = T.best;
      if (prev == null || lapTime < prev) {
        T.best = lapTime;
        this.sampleGhost(e); // final sample at the line
        const g = encodeGhost(T.rec);
        saveBest(this.def.id, { t: lapTime, sig: this.trackSig(), veh: this.def.vehicle, hz: GHOST_HZ, g, date: Date.now() });
        T.ghost = decodeGhost(g); // race the stored (quantised) version from now on
        T.newBest = this.time;
        this.hud.flash(`New best lap! ${formatTime(lapTime)}`, '#ffc93c');
        this.sound.newBest();
      } else {
        this.hud.flash(`${formatTime(lapTime)}  +${(lapTime - prev).toFixed(2)}`, '#fff4dc');
      }
    }
    // next lap: restart the clock, the recording and the ghost
    e.lapStart = now; e.midSeen = false;
    T.rec = []; T.recAcc = 0; T.recording = true;
    this.sampleGhost(e);
  }

  buildGhostModel(colorIndex) {
    this.removeGhostModel();
    const vtype = this.def.vehicle || 'sports';
    const model = buildCar(vtype, PLAYER_COLORS[colorIndex], colorIndex + 1);
    // the car's own look, see-through: translucent clones of its materials (the real cars keep theirs)
    const clones = new Map();
    model.root.traverse((o) => {
      if (!o.isMesh) return;
      let m = clones.get(o.material);
      if (!m) {
        m = o.material.clone();
        m.transparent = true; m.opacity = GHOST_OPACITY; m.depthWrite = true;
        if (m.emissive) { m.emissive.set(0x9fd0ff); m.emissiveIntensity = 0.18; }
        clones.set(o.material, m);
      }
      o.material = m; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 4;
    });
    model.root.visible = false;
    this.R.scene.add(model.root);
    this.ghostModel = model; this.ghostMats = [...clones.values()]; this.ghostSpin = 0;
  }

  removeGhostModel() {
    const m = this.ghostModel;
    if (!m) return;
    this.R.scene.remove(m.root);
    m.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    m.shadow.geometry.dispose();
    for (const mat of this.ghostMats) mat.dispose();
    this.ghostModel = null; this.ghostMats = [];
  }

  // The ghost replays the best lap from the moment the current lap started.
  ghostPose() {
    const T = this.tt, G = T && T.ghost;
    if (!G || !T.recording || (this.state !== 'race' && this.state !== 'paused')) return null;
    const t = this.raceTime - this.cars[0].lapStart;
    const n = G.length / 4, f = t * GHOST_HZ;
    if (f < 0 || f >= n - 1) return null; // the ghost has finished its lap
    const i = Math.floor(f), k = f - i, a = i * 4, b = a + 4;
    return {
      x: G[a] + (G[b] - G[a]) * k, y: G[a + 1] + (G[b + 1] - G[a + 1]) * k, z: G[a + 2] + (G[b + 2] - G[a + 2]) * k,
      angle: G[a + 3] + (G[b + 3] - G[a + 3]) * k, speed: Math.hypot(G[b] - G[a], G[b + 2] - G[a + 2]) * GHOST_HZ,
    };
  }

  updateGhost(dt) {
    const m = this.ghostModel;
    if (!m) return;
    const p = this.ghostPose();
    if (!p) { m.root.visible = false; return; }
    m.root.visible = true;
    m.root.position.set(p.x, p.y, p.z);
    m.root.rotation.y = -p.angle;
    this.ghostSpin += p.speed * dt / 0.55;
    for (const wh of m.wheels) wh.spinner.rotation.z = -this.ghostSpin * (0.5 / wh.r);
    // fade out when the player drives right through it
    const c = this.cars[0].car;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    const op = GHOST_OPACITY * clamp((d - 1.5) / 4, 0.4, 1);
    for (const mat of this.ghostMats) mat.opacity = op;
  }

  // ---------- camera ----------
  cameraFocus() {
    if (this.camOverride) return this.camOverride;
    const tr = this.track;
    const baseW = this.R.camera.aspect < 1 ? 70 : 88;
    if (this.mode === 'h2h' || this.state === 'attract') {
      const L = this.leader() || this.cars[0];
      if (!L) return { x: tr.x[0], z: tr.z[0], w: baseW };
      const c = L.car;
      const ahead = tr.at(L.trackS + 13);
      // look toward where the leader is heading on the track
      let x = c.x * 0.55 + ahead.x * 0.45, z = c.z * 0.55 + ahead.z * 0.45;
      let w = baseW;
      // after a long round the view slowly closes in to force a result
      if (this.state === 'race' && this.roundTime > 40) w = baseW - Math.min(32, (this.roundTime - 40) * 1.1);
      return { x, z, w };
    }
    // race / time trial: frame the human drivers
    const humans = this.cars.filter((e) => e.human && !e.finished);
    const list = humans.length ? humans : this.cars.filter((e) => e.human);
    const focus = list.length ? list : [this.leader(this.cars)];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sx = 0, sz = 0;
    for (const e of focus) {
      const a = tr.at(e.trackS + 10);
      const fx = e.car.x * 0.6 + a.x * 0.4, fz = e.car.z * 0.6 + a.z * 0.4;
      minX = Math.min(minX, fx); maxX = Math.max(maxX, fx); minZ = Math.min(minZ, fz); maxZ = Math.max(maxZ, fz);
      sx += fx; sz += fz;
    }
    const spread = Math.max(maxX - minX, (maxZ - minZ) * this.R.camera.aspect);
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: clamp(spread * 1.25 + 20, baseW * 0.9, 150) };
  }

  updateCamera(dt) {
    const f = this.cameraFocus();
    const rate = this.camOverride ? 1000 : this.state === 'countdown' ? 6 : 3.2;
    this.camX = damp(this.camX, f.x, rate, dt);
    this.camZ = damp(this.camZ, f.z, rate, dt);
    this.camW = damp(this.camW, f.w, 2, dt);
    this.R.placeCamera(this.camX, this.camZ, this.camW);
  }

  // ---------- visuals & audio ----------
  updateVisuals(dt) {
    // pushable objects: rolling balls and sliding cubes
    for (const d of this.physics.dynamics) {
      const m = d.mesh;
      if (!m) continue;
      m.visible = d.state !== 'sunk';
      if (d.pop) { d.pop = Math.max(0, d.pop - dt * 3); m.scale.setScalar(1 - d.pop * 0.9); } else if (m.scale.x !== 1 && !d.keepScale) m.scale.setScalar(1);
      m.position.set(d.x, (d.baseY ?? d.r) + (d.y || 0), d.z);
      const sp = Math.hypot(d.vx, d.vz);
      if (sp > 0.01) {
        if (d.slide) m.rotation.y += (d.spin ?? 0.08) * sp * dt * (d.spinDir || (d.spinDir = Math.random() < 0.5 ? -1 : 1));
        else {
          // roll around the axis perpendicular to motion
          const ang = (sp * dt) / d.r;
          this._axis = this._axis || new THREE.Vector3();
          this._q = this._q || new THREE.Quaternion();
          this._axis.set(d.vz / sp, 0, -d.vx / sp);
          this._q.setFromAxisAngle(this._axis, ang);
          m.quaternion.premultiply(this._q);
        }
      }
    }
    this.updateGhost(dt);
    for (const e of this.cars) {
      const c = e.car, m = e.model;
      if (c.bog > 0 && c.state === 'drive') c.wheelSpin += dt * 70; // wheels spinning on the spot
      syncCar(m, c, this.time);
      // ghost blink after respawn
      if (c.ghost > 0 && c.state === 'drive') m.root.visible = Math.floor(this.time * 14) % 2 === 0;
      if (c.state !== 'drive' || c.airborne) { this.skids.break(c.index + 'l'); this.skids.break(c.index + 'r'); continue; }
      const sp = c.speed;
      const cs = Math.cos(c.angle), sn = Math.sin(c.angle);
      // turbo start: flames and puffs from the exhaust
      if (c.turbo > 0) this.exhaust(c, 0.6 + 0.4 * Math.min(1, c.turbo / 0.5), Math.max(1, Math.round(dt * 45)));
      // slipstream: faint wind streaks streaming past the car
      if (c.draft > 0.3 && sp > 18 && Math.random() < dt * 30 * c.draft) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const along = c.spec.len * (0.2 + Math.random() * 0.5), out = c.spec.wid * (0.6 + Math.random() * 0.4);
        const px = c.x + cs * along - sn * out * side, pz = c.z + sn * along + cs * out * side, py = c.y + 0.4 + Math.random() * 1.0;
        // a short dotted line along the car that streams backwards past it
        for (let k = 0; k < 6; k++) {
          this.particles.emit(px - cs * k * 0.3, py, pz - sn * k * 0.3, { color: 0xcfe0f2, size: 0.3 - k * 0.025, life: 0.22, spread: 0.15, up: 0, grav: 0, grow: 1, alpha: 0.8 * c.draft, vx: c.vx * 0.6, vz: c.vz * 0.6 });
        }
      }
      if (c.spec.boat) {
        // boats: foam wake from the stern, spray from the bow in hard turns, no skid marks
        const sx = c.x - cs * 2.4, sz = c.z - sn * 2.4;
        const wake = this.def.wake || { color: 0xf4fbff };
        if (sp > 6 && Math.random() < dt * (6 + sp * 0.9)) {
          this.particles.emit(sx, 0.15, sz, { color: wake.color, size: 1.1 + sp * 0.02, life: 0.9, spread: 2.2, up: 0.4, grav: 0, grow: 3.2, alpha: 0.55, vx: -c.vx * 0.1, vz: -c.vz * 0.1 });
        }
        if (c.slip > 10 && sp > 15 && Math.random() < dt * 30) {
          const side = Math.sign(-c.vx * sn + c.vz * cs) || 1;
          this.particles.emit(c.x + cs * 1.2 + sn * side, 0.5, c.z + sn * 1.2 - cs * side, { color: wake.color, size: 0.6, life: 0.45, spread: 6, up: 9, grav: 40, grow: 1.2, alpha: 0.85 });
        }
        continue;
      }
      if (c.spec.hover) {
        // hovercraft: a ring of spray/dust blown out from under the skirt, no skid marks
        const surf = this.def.dust?.[c.surface] || this.def.dust?.normal;
        const col = c.surface === 'water' ? (this.def.wake?.color ?? 0xf4fbff) : (surf?.color ?? this.def.hoverSpray ?? 0xe8e4dc);
        if (Math.random() < dt * (5 + sp * 0.6)) {
          const a = Math.random() * Math.PI * 2;
          this.particles.emit(c.x + Math.cos(a) * 2.2, 0.2, c.z + Math.sin(a) * 1.5, { color: col, size: 0.9, life: 0.5, spread: 3, up: 1.2, grav: 2, grow: 2.4, alpha: 0.4, vx: Math.cos(a) * 6 - c.vx * 0.2, vz: Math.sin(a) * 6 - c.vz * 0.2 });
        }
        continue;
      }
      // skid marks from the rear wheels when sliding or braking hard
      const skid = clamp((c.slip - 8) / 20, 0, 1) + (c.brake > 0.5 && sp > 20 ? 0.35 : 0) + (c.surface === 'slick' ? 0.1 : 0);
      const bx = c.x - cs * c.spec.axle * 1.1, bz = c.z - sn * c.spec.axle * 1.1;
      const wz = c.spec.wid * 0.45;
      if (skid > 0.05 && c.surface !== 'water') {
        this.skids.add(c.index + 'l', bx - sn * wz, c.y, bz + cs * wz, 0.45, skid);
        this.skids.add(c.index + 'r', bx + sn * wz, c.y, bz - cs * wz, 0.45, skid);
      } else { this.skids.break(c.index + 'l'); this.skids.break(c.index + 'r'); }
      // surface particles
      const dust = this.def.dust?.[c.surface] ?? (c.surface === 'normal' ? this.def.dust?.normal : null);
      if (dust && sp > 12 && Math.random() < dt * (sp / 6) * (dust.rate ?? 1)) {
        this.particles.emit(bx, 0.4, bz, { color: dust.color, size: dust.size ?? 1.2, life: dust.life ?? 0.6, spread: 4, up: dust.up ?? 2, grav: dust.grav ?? 3, grow: dust.grow ?? 1.8, alpha: dust.alpha ?? 0.5, vx: -c.vx * 0.15, vz: -c.vz * 0.15 });
      }
      if ((skid > 0.4 || c.bog > 0) && Math.random() < dt * (c.bog > 0 ? 40 : 20) && this.def.smoke !== false) {
        this.particles.emit(bx, 0.4, bz, { color: 0xdddddd, size: 1.4, life: 0.5, spread: 3, up: 1.5, grav: -1, grow: 2.2, alpha: 0.28 });
      }
    }
  }

  panOf(x, z) {
    const p = this.R.project(x, 0, z, this.tmpV);
    return clamp(p.x, -1, 1);
  }

  updateAudio() {
    const S = this.sound;
    if (!S.ctx) return;
    this.cars.forEach((e, i) => {
      const c = e.car;
      const vis = !e.out && c.state === 'drive';
      const vol = vis ? (e.human ? 1 : 0.55) * (this.onScreen(c.x, c.y, c.z, 0.3) ? 1 : 0.3) : 0;
      const rev = this.state === 'countdown' ? (e.human ? this.input.read(e.driver).throttle : 0.3) : c.throttle;
      // a bogged launch screams at high revs with little speed
      const spd = c.bog > 0 ? Math.max(0.75, Math.abs(c.fwdSpeed) / c.spec.maxSpeed) : Math.abs(c.fwdSpeed) / c.spec.maxSpeed;
      S.updateEngine(i, Math.min(1.1, spd), rev, c.airborne ? 0 : c.slip, this.panOf(c.x, c.z), vol);
    });
  }

  pause(on) {
    if (on && (this.state === 'race' || this.state === 'countdown' || this.state === 'roundEnd')) {
      this.prevState = this.state; this.state = 'paused'; this.sound.silenceEngines();
      return true;
    }
    if (!on && this.state === 'paused') { this.state = this.prevState; this.acc = 0; return true; }
    return false;
  }

  // Attract mode: CPU cars racing behind the menu.
  startAttract() {
    this.startMatch({ drivers: [0, 1, 2, 3].map((i) => ({ type: 'cpu', color: i })), mode: 'h2h', pointsToWin: 99, skill: 'hard', catchup: 'off' });
    this.state = 'attract';
    this.sound.silenceEngines();
    this.hud.message('', null);
  }
}

function racingOrHeld(state) { return state === 'race' || state === 'roundEnd' || state === 'attract' || state === 'countdown'; }

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Dark worlds (`headlights: true` or {intensity, distance, angle, color}): each car lights the road ahead.
function addHeadlights(model, cfg) {
  const o = cfg === true ? {} : cfg;
  const L = new THREE.SpotLight(o.color ?? 0xfff1d6, o.intensity ?? 40, o.distance ?? 48, o.angle ?? 0.6, o.penumbra ?? 0.55, o.decay ?? 1.2);
  L.position.set(1.9, 1.3, 0);
  L.target.position.set(16, -1.5, 0);
  L.castShadow = false;
  model.tilt.add(L); model.tilt.add(L.target);
  model.headlight = L;
}
