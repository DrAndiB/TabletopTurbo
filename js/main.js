// Boot, menus and the main loop.
import { GameRenderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Game, ordinal } from './game.js';
import { Hud } from './hud.js';
import { WORLDS, worldById } from './worlds/index.js';
import { PLAYER_COLORS } from './util.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const SETTINGS_KEY = 'tabletop-turbo.settings.v1';

const defaults = {
  world: WORLDS[0].id,
  mode: 'h2h',
  points: 5,
  laps: 3,
  skill: 'normal',
  quality: 'auto',
  slots: [{ type: 'keys' }, { type: 'cpu' }, { type: 'cpu' }, { type: 'cpu' }],
};
let settings = loadSettings();
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (s && Array.isArray(s.slots) && s.slots.length === 4) return { ...defaults, ...s, slots: s.slots.map((x) => (x.type === 'pad' ? { type: 'cpu' } : x)) };
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(defaults));
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

// ---------- engine objects ----------
const canvas = $('#game');
let quality = params.get('quality') || settings.quality;
const R = new GameRenderer(canvas, quality === 'auto' ? 'medium' : quality);
const input = new Input();
const sound = new Sound();
const hud = new Hud($('#hud'));
const game = new Game(R, input, sound, hud);
window.__tt = { game, R, input, sound, settings: () => settings };

let screen = 'title';
let loadedWorld = null;
let lastT = performance.now();
let fpsAcc = 0, fpsN = 0, fpsCheckDone = false;

function showScreen(name) {
  screen = name;
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === 'screen-' + name);
  document.body.dataset.screen = name;
  if (name === 'title' || name === 'lobby') sound.startMusic(); else sound.stopMusic();
}

async function ensureWorld(id) {
  if (loadedWorld === id && game.world) return;
  $('#loading').classList.add('show');
  await new Promise((r) => setTimeout(r, 30));
  await game.loadWorld(worldById(id), {});
  loadedWorld = id;
  $('#loading').classList.remove('show');
}

// ---------- lobby ----------
const TYPE_ORDER = ['keys', 'simple', 'cpu', 'off'];
const TYPE_LABEL = { keys: 'Keyboard', simple: 'Easy keys', cpu: 'CPU', off: 'Off', pad: 'Gamepad', touch: 'Touch' };
function slotHint(i, s) {
  const b = input.bindings[i];
  const k = (c) => `<kbd>${input.keyLabel(c)}</kbd>`;
  if (s.type === 'keys') return `${k(b.up)} gas ${k(b.down)} brake ${k(b.left)}${k(b.right)} steer`;
  if (s.type === 'simple') return `Auto gas · ${k(b.left)}${k(b.right)} steer · both = brake`;
  if (s.type === 'pad') return `Pad ${s.pad + 1}: stick steers, RT/A gas, LT/B brake`;
  if (s.type === 'touch') return 'Hold left or right side of the screen to steer';
  if (s.type === 'cpu') return 'Computer driver';
  return 'Empty seat';
}

function renderLobby() {
  // worlds
  const wl = $('#world-list');
  wl.innerHTML = '';
  for (const w of WORLDS) {
    const b = document.createElement('button');
    b.className = 'world-card' + (settings.world === w.id ? ' selected' : '');
    b.innerHTML = `<span class="thumb" style="background-image:url(img/${w.id}.jpg)"></span><span class="wname">${w.name}</span><span class="wblurb">${w.blurb}</span>`;
    b.onclick = () => { sound.click(); settings.world = w.id; saveSettings(); renderLobby(); };
    wl.appendChild(b);
  }
  // players
  const pl = $('#player-list');
  pl.innerHTML = '';
  settings.slots.forEach((s, i) => {
    const c = PLAYER_COLORS[i];
    const card = document.createElement('div');
    card.className = 'slot slot-' + s.type;
    card.style.setProperty('--pc', c.hex);
    card.innerHTML = `<div class="slot-head"><span class="slot-car"></span><span class="slot-name">${c.name}</span></div>
      <button class="slot-type" aria-label="Change ${c.name} driver">${TYPE_LABEL[s.type]}<span class="cyc">⟳</span></button>
      <div class="slot-hint">${slotHint(i, s)}</div>`;
    card.querySelector('.slot-type').onclick = () => {
      sound.click();
      let idx = TYPE_ORDER.indexOf(s.type);
      s.type = TYPE_ORDER[(idx + 1) % TYPE_ORDER.length];
      delete s.pad;
      if (activeCount() < 2) s.type = 'keys';
      saveSettings(); renderLobby();
    };
    pl.appendChild(card);
  });
  // options
  for (const el of document.querySelectorAll('[data-opt]')) {
    const k = el.dataset.opt, v = el.dataset.val;
    el.classList.toggle('on', String(settings[k]) === v);
  }
  $('#opt-points').hidden = settings.mode !== 'h2h';
  $('#opt-laps').hidden = settings.mode !== 'race';
  const warn = $('#kbd-warn');
  const keyPlayers = settings.slots.filter((s) => s.type === 'keys').length;
  warn.hidden = keyPlayers < 3;
}
function activeCount() { return settings.slots.filter((s) => s.type !== 'off').length; }

for (const el of document.querySelectorAll('[data-opt]')) {
  el.addEventListener('click', () => {
    sound.click();
    const k = el.dataset.opt, v = el.dataset.val;
    settings[k] = isNaN(+v) ? v : +v;
    if (k === 'quality') applyQuality(v);
    saveSettings(); renderLobby();
  });
}

function applyQuality(q) {
  quality = q;
  R.setQuality(q === 'auto' ? 'medium' : q);
  game.updateParticleScale();
  fpsCheckDone = q !== 'auto';
}

// ---------- controls screen ----------
function renderControls() {
  const box = $('#controls-grid');
  box.innerHTML = '';
  PLAYER_COLORS.forEach((c, i) => {
    const b = input.bindings[i];
    const col = document.createElement('div');
    col.className = 'ctl-col';
    col.style.setProperty('--pc', c.hex);
    col.innerHTML = `<h3>${c.name}</h3>`;
    for (const [act, label] of [['up', 'Gas'], ['down', 'Brake / reverse'], ['left', 'Steer left'], ['right', 'Steer right']]) {
      const row = document.createElement('button');
      row.className = 'ctl-row';
      row.innerHTML = `<span>${label}</span><kbd>${input.keyLabel(b[act])}</kbd>`;
      row.onclick = () => {
        row.classList.add('listening');
        row.querySelector('kbd').textContent = 'press a key…';
        input.capture = (code) => {
          if (code !== 'Escape') {
            // a key can only belong to one action: swap if needed
            for (const bb of input.bindings) for (const kk of Object.keys(bb)) if (bb[kk] === code) bb[kk] = b[act];
            b[act] = code;
            input.saveBindings();
          }
          renderControls();
        };
      };
      col.appendChild(row);
    }
    box.appendChild(col);
  });
}

// ---------- start / end ----------
function buildDrivers() {
  const drivers = [];
  settings.slots.forEach((s, i) => {
    if (s.type === 'off') return;
    const d = { type: s.type, slot: i, color: i };
    if (s.type === 'pad') d.pad = s.pad;
    drivers.push(d);
  });
  return drivers;
}

async function startRace() {
  sound.ensure();
  if (activeCount() < 2) return;
  showScreen('none');
  await ensureWorld(settings.world);
  game.startMatch({ drivers: buildDrivers(), mode: settings.mode, pointsToWin: settings.points, laps: settings.laps, skill: settings.skill });
  hud.setup(game);
  $('#touch').classList.toggle('show', settings.slots.some((s) => s.type === 'touch'));
  fpsAcc = 0; fpsN = 0;
}

game.onMatchEnd = ({ winner, standings, mode }) => {
  setTimeout(() => {
    const list = $('#results-list');
    list.innerHTML = '';
    standings.forEach((e, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--pc', e.color.hex);
      const detail = mode === 'h2h' ? `${e.points} point${e.points === 1 ? '' : 's'}` : (e.finishTime ? formatTime(e.finishTime) : 'did not finish');
      li.innerHTML = `<span class="pos">${ordinal(i + 1)}</span><span class="who">${e.name}</span><span class="det">${detail}</span>`;
      list.appendChild(li);
    });
    $('#results-title').textContent = winner ? `${winner.name} wins!` : 'Finished';
    $('#results-title').style.setProperty('--pc', winner ? winner.color.hex : '#fff');
    hud.visible(false);
    showScreen('results');
  }, 1200);
};
function formatTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; }

function quitToMenu() {
  hud.visible(false);
  $('#touch').classList.remove('show');
  sound.stopEngines();
  game.startAttract();
  showScreen('lobby');
  renderLobby();
}

function togglePause() {
  if (screen === 'pause') { game.pause(false); showScreen('none'); return; }
  if (screen === 'none' && game.pause(true)) showScreen('pause');
}

// ---------- buttons ----------
$('#btn-play').onclick = () => { sound.ensure(); sound.click(); showScreen('lobby'); renderLobby(); };
$('#btn-controls').onclick = () => { sound.click(); showScreen('controls'); renderControls(); };
$('#btn-controls-back').onclick = () => { sound.click(); showScreen(prevForControls || 'title'); if (prevForControls === 'lobby') renderLobby(); };
$('#btn-controls-reset').onclick = () => { input.resetBindings(); renderControls(); };
let prevForControls = 'title';
$('#btn-lobby-controls').onclick = () => { sound.click(); prevForControls = 'lobby'; showScreen('controls'); renderControls(); };
$('#btn-controls').addEventListener('click', () => { prevForControls = 'title'; });
$('#btn-lobby-back').onclick = () => { sound.click(); showScreen('title'); };
$('#btn-start').onclick = () => startRace();
$('#btn-resume').onclick = () => togglePause();
$('#btn-restart').onclick = () => { game.pause(false); startRace(); };
$('#btn-quit').onclick = () => { game.pause(false); quitToMenu(); };
$('#btn-again').onclick = () => startRace();
$('#btn-menu').onclick = () => quitToMenu();
$('#btn-sound').onclick = () => { sound.ensure(); sound.setMuted(!sound.muted); updateSoundBtn(); };
$('#btn-fs').onclick = () => toggleFullscreen();
function updateSoundBtn() { $('#btn-sound').textContent = sound.muted ? '🔇' : '🔊'; $('#btn-sound').setAttribute('aria-label', sound.muted ? 'Sound off' : 'Sound on'); }
updateSoundBtn();
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

input.on((type, e) => {
  if (type === 'layout') { if (screen === 'lobby') renderLobby(); if (screen === 'controls') renderControls(); return; }
  if (type !== 'keydown') return;
  if (input.capture) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (screen === 'none' || screen === 'pause') togglePause();
    else if (screen === 'lobby' && e.code === 'Escape') showScreen('title');
    else if (screen === 'controls' && e.code === 'Escape') $('#btn-controls-back').click();
  }
  if (e.code === 'KeyF' && (screen === 'none' || screen === 'pause')) toggleFullscreen();
  if (e.code === 'Enter') {
    if (screen === 'title') $('#btn-play').click();
    else if (screen === 'lobby') startRace();
    else if (screen === 'results') startRace();
  }
});

// touch zones
for (const side of ['left', 'right']) {
  const z = $('#touch-' + side);
  const on = (v) => (e) => { e.preventDefault(); input.touch[side] = v; z.classList.toggle('down', v); };
  z.addEventListener('pointerdown', on(true));
  z.addEventListener('pointerup', on(false));
  z.addEventListener('pointercancel', on(false));
  z.addEventListener('pointerleave', on(false));
}
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches && !localStorage.getItem(SETTINGS_KEY)) {
  settings.slots[0] = { type: 'touch' };
}

// gamepads: press A in the lobby to take a seat, Start to begin
function pollPads() {
  const presses = input.pollPadPresses();
  for (const p of presses) {
    if (screen === 'title' && (p.button === 0 || p.button === 9)) { $('#btn-play').click(); continue; }
    if (screen === 'lobby') {
      if (p.button === 9) { startRace(); continue; }
      if (p.button === 0) {
        if (settings.slots.some((s) => s.type === 'pad' && s.pad === p.pad)) continue;
        let idx = settings.slots.findIndex((s) => s.type === 'cpu' || s.type === 'off');
        if (idx < 0) idx = settings.slots.findIndex((s) => s.type !== 'pad');
        if (idx >= 0) { settings.slots[idx] = { type: 'pad', pad: p.pad }; sound.click(); renderLobby(); }
      }
      if (p.button === 1) { const i = settings.slots.findIndex((s) => s.type === 'pad' && s.pad === p.pad); if (i >= 0) { settings.slots[i] = { type: 'cpu' }; renderLobby(); } }
    }
    if ((screen === 'none' || screen === 'pause') && p.button === 9) togglePause();
    if (screen === 'results' && p.button === 0) startRace();
  }
}
window.addEventListener('gamepadconnected', () => { if (screen === 'lobby') renderLobby(); $('#pad-hint').hidden = false; });

window.addEventListener('resize', () => { R.resize(); game.updateParticleScale(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'none') togglePause(); });

// ---------- main loop ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  pollPads();
  game.update(dt);
  if (screen === 'none' && game.state === 'race' && !fpsCheckDone && quality === 'auto') {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 4) {
      const fps = fpsN / fpsAcc;
      if (fps < 42 && R.qualityName !== 'low') { R.setQuality('low'); game.updateParticleScale(); }
      fpsCheckDone = true;
    }
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
(async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('16px Rubik')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* fonts optional */ }
  const w = params.get('world') || settings.world;
  await ensureWorld(w);
  if (params.get('view') === 'top') {
    // layout overview for development
    game.startAttract();
    game.state = 'idle';
    R.elevation = Math.PI / 2 - 0.001;
    const b = game.def.bounds;
    R.placeCamera((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, (b.maxX - b.minX) * 1.08);
    game.updateCamera = () => {};
    showScreen('none');
  } else if (params.get('autostart')) {
    if (params.get('p')) params.get('p').split(',').forEach((t, i) => { settings.slots[i] = { type: t }; });
    if (params.get('mode')) settings.mode = params.get('mode');
    settings.world = w;
    await startRace();
  } else {
    game.startAttract();
    showScreen('title');
  }
  $('#boot').classList.add('done');
  if (params.get('test')) {
    // automated tests drive the clock themselves
    window.__tt.step = (sec = 0) => { const info = R.renderer.info; info.autoReset = false; game.simulate(sec); info.reset(); game.update(0.0001); return { ...info.render, geometries: info.memory.geometries, textures: info.memory.textures }; };
    window.__tt.start = startRace;
    window.__tt.ready = true;
  } else requestAnimationFrame(frame);
})().catch((err) => {
  console.error(err);
  $('#boot').innerHTML = `<p>Sorry, the game could not start.<br><small>${String(err && err.message || err)}</small></p>`;
});
