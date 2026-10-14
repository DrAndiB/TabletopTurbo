// Boot, menus, championship flow and the main loop.
import { GameRenderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Game, ordinal } from './game.js';
import { Hud } from './hud.js';
import { WORLDS, worldById } from './worlds/index.js';
import { PLAYER_COLORS } from './util.js';
import { formatTime, loadBest } from './records.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const SETTINGS_KEY = 'tabletop-turbo.settings.v1';
const MODES = ['h2h', 'race', 'tt', 'champ'];

const defaults = {
  world: WORLDS[0].id,
  mode: 'h2h',
  points: 5,
  laps: 3,
  skill: 'normal',
  catchup: 'mild',
  quality: 'auto',
  slots: [{ type: 'keys' }, { type: 'cpu' }, { type: 'cpu' }, { type: 'cpu' }],
};
let settings = loadSettings();
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (s && Array.isArray(s.slots) && s.slots.length === 4) {
      const out = { ...defaults, ...s, slots: s.slots.map((x) => (x.type === 'pad' ? { type: 'cpu' } : x)) };
      if (!MODES.includes(out.mode)) out.mode = defaults.mode;
      if (!['off', 'mild', 'strong'].includes(out.catchup)) out.catchup = defaults.catchup;
      return out;
    }
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
let champ = null; // championship in progress: {ids, index, drivers, totals, names, last}

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
const HUMAN_TYPES = ['keys', 'simple', 'pad', 'touch'];
const CHAMP_POINTS = { 1: [10], 2: [10, 4], 3: [10, 5, 2], 4: [10, 6, 3, 1] };
const MODE_HELP = {
  h2h: 'Head-to-head: the screen follows the leader. Drop off its edge and you\'re out. Last car on screen scores a point.',
  race: 'Race: a set number of laps, first across the line wins. The view frames the human drivers.',
  tt: 'Time trial: just you, no CPU cars, as many laps as you like. Beat your best lap and chase its ghost. Esc to stop.',
  champ: 'Championship: one race on every table in turn, 10 · 6 · 3 · 1 points per finish. Most points takes the trophy.',
};

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
// time trial: the first human seat drives (Red on the keyboard if every seat is a CPU)
function ttSlot() {
  const i = settings.slots.findIndex((s) => HUMAN_TYPES.includes(s.type));
  return i;
}

function renderLobby() {
  const mode = settings.mode;
  // worlds
  const wl = $('#world-list');
  wl.innerHTML = '';
  wl.classList.toggle('champ', mode === 'champ');
  $('#worlds-h').innerHTML = mode === 'champ' ? `1 · The tables <span class="sub">all ${WORLDS.length}, in this order</span>` : '1 · Pick a table';
  WORLDS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'world-card' + (settings.world === w.id && mode !== 'champ' ? ' selected' : '');
    const best = loadBest(w.id);
    const bestTag = best ? `<span class="wbest" title="Your best time-trial lap">Best ${formatTime(best.t)}</span>` : '';
    b.innerHTML = `<span class="thumb" style="background-image:url(img/${w.id}.jpg)">${mode === 'champ' ? `<span class="wnum">${i + 1}</span>` : ''}</span><span class="wname">${w.name}${bestTag}</span><span class="wblurb">${w.blurb}</span>`;
    if (mode === 'champ') b.setAttribute('aria-disabled', 'true');
    b.onclick = () => { if (settings.mode === 'champ') return; sound.click(); settings.world = w.id; saveSettings(); renderLobby(); };
    wl.appendChild(b);
  });
  // players
  const pl = $('#player-list');
  pl.innerHTML = '';
  const solo = mode === 'tt' ? Math.max(0, ttSlot()) : -1;
  settings.slots.forEach((s, i) => {
    const c = PLAYER_COLORS[i];
    const card = document.createElement('div');
    const idle = mode === 'tt' && i !== solo;
    card.className = 'slot slot-' + s.type + (idle ? ' slot-idle' : '');
    card.style.setProperty('--pc', c.hex);
    let hint = slotHint(i, s);
    if (mode === 'tt' && i === solo && !HUMAN_TYPES.includes(s.type)) hint = 'Drives the time trial on the keyboard: ' + slotHint(i, { type: 'keys' });
    else if (idle) hint = 'Sits this one out: time trial is solo';
    card.innerHTML = `<div class="slot-head"><span class="slot-car"></span><span class="slot-name">${c.name}</span>${mode === 'tt' && i === solo ? '<span class="slot-tag">Time trial</span>' : ''}</div>
      <button class="slot-type" aria-label="Change ${c.name} driver">${TYPE_LABEL[s.type]}<span class="cyc">⟳</span></button>
      <div class="slot-hint">${hint}</div>`;
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
  $('[data-mode-help]').textContent = MODE_HELP[mode] || '';
  $('#opt-points').hidden = mode !== 'h2h';
  $('#opt-laps').hidden = mode !== 'race' && mode !== 'champ';
  $('#opt-catchup').hidden = mode === 'tt';
  $('#opt-skill').hidden = mode === 'tt';
  const warn = $('#kbd-warn');
  const keyPlayers = settings.slots.filter((s) => s.type === 'keys').length;
  warn.hidden = keyPlayers < 3 || mode === 'tt';
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
  if (settings.mode === 'tt') {
    const i = ttSlot();
    const s = i >= 0 ? settings.slots[i] : { type: 'keys' };
    const d = { type: s.type, slot: Math.max(0, i), color: Math.max(0, i) };
    if (s.type === 'pad') d.pad = s.pad;
    return [d];
  }
  settings.slots.forEach((s, i) => {
    if (s.type === 'off') return;
    const d = { type: s.type, slot: i, color: i };
    if (s.type === 'pad') d.pad = s.pad;
    drivers.push(d);
  });
  return drivers;
}

function afterStart() {
  hud.setup(game);
  $('#touch').classList.toggle('show', game.cars.some((e) => e.driver.type === 'touch'));
  fpsAcc = 0; fpsN = 0;
}

// A fresh session from the lobby (or "Again"): championships start over at the first table.
async function startRace() {
  sound.ensure();
  if (settings.mode !== 'tt' && activeCount() < 2) return;
  if (settings.mode === 'champ') return startChampionship();
  champ = null;
  showScreen('none');
  await ensureWorld(settings.world);
  game.startMatch({ drivers: buildDrivers(), mode: settings.mode, pointsToWin: settings.points, laps: settings.laps, skill: settings.skill, catchup: settings.catchup });
  afterStart();
}

// Pause menu "Restart": the same race again (inside a championship: the current table, scores kept).
function restartCurrent() {
  if (champ) return runChampRace();
  return startRace();
}

// ---------- championship ----------
function startChampionship() {
  const drivers = buildDrivers();
  champ = {
    ids: WORLDS.map((w) => w.id), index: 0, drivers,
    totals: Object.fromEntries(drivers.map((d) => [d.color, 0])),
    wins: Object.fromEntries(drivers.map((d) => [d.color, 0])),
    names: {}, last: [],
  };
  return runChampRace();
}

async function runChampRace() {
  if (!champ) return;
  sound.ensure();
  showScreen('none');
  const id = champ.ids[champ.index];
  await ensureWorld(id);
  game.startMatch({ drivers: champ.drivers, mode: 'race', laps: settings.laps, skill: settings.skill, catchup: settings.catchup });
  afterStart();
  hud.flash(`Championship · race ${champ.index + 1} of ${champ.ids.length}`, '#ffc93c');
}

function scoreChampRace(standings) {
  const table = CHAMP_POINTS[standings.length] || CHAMP_POINTS[4];
  champ.last = standings.map((e, i) => {
    const pts = table[i] || 0;
    champ.totals[e.colorIndex] = (champ.totals[e.colorIndex] || 0) + pts;
    if (i === 0) champ.wins[e.colorIndex] = (champ.wins[e.colorIndex] || 0) + 1;
    champ.names[e.colorIndex] = { name: e.name, hex: e.color.hex };
    return { color: e.colorIndex, place: i + 1, pts, time: e.finishTime };
  });
}

// order by total points, then race wins, then the latest race
function champTable() {
  const lastPlace = Object.fromEntries(champ.last.map((r) => [r.color, r.place]));
  return Object.keys(champ.totals).map(Number)
    .map((c) => ({ color: c, total: champ.totals[c], wins: champ.wins[c] || 0, ...champ.names[c], race: champ.last.find((r) => r.color === c) }))
    .sort((a, b) => b.total - a.total || b.wins - a.wins || (lastPlace[a.color] ?? 9) - (lastPlace[b.color] ?? 9));
}

function showStandings() {
  if (!champ) return;
  if (champ.index >= champ.ids.length - 1) return showPodium();
  const w = worldById(champ.ids[champ.index]);
  const next = worldById(champ.ids[champ.index + 1]);
  $('#standings-kicker').textContent = `Championship · race ${champ.index + 1} of ${champ.ids.length}`;
  $('#standings-sub').textContent = `after ${w.name}`;
  const list = $('#standings-list');
  list.innerHTML = '';
  champTable().forEach((r, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--pc', r.hex);
    const race = r.race ? `${ordinal(r.race.place)} <b>+${r.race.pts}</b>` : '';
    li.innerHTML = `<span class="pos">${ordinal(i + 1)}</span><span class="who">${r.name}</span><span class="gain">${race}</span><span class="tot">${r.total}</span>`;
    list.appendChild(li);
  });
  $('#next-thumb').style.backgroundImage = `url(img/${next.id}.jpg)`;
  $('#next-name').textContent = next.name;
  hud.visible(false);
  showScreen('standings');
}

function nextChampRace() {
  if (!champ || screen !== 'standings') return;
  sound.click();
  champ.index++;
  runChampRace();
}

function showPodium() {
  const rows = champTable();
  const champion = rows[0];
  $('#podium-title').textContent = `${champion.name} wins!`;
  $('#podium-title').style.setProperty('--pc', champion.hex);
  $('#podium-sub').textContent = `${champ.ids.length} tables · ${rows.reduce((a, r) => a + r.wins, 0)} races`;
  // podium blocks: 2nd, 1st, 3rd
  const pod = $('#podium');
  pod.innerHTML = '';
  for (const k of [1, 0, 2]) {
    const r = rows[k];
    if (!r) continue;
    const el = document.createElement('div');
    el.className = 'pod pod-' + (k + 1);
    el.style.setProperty('--pc', r.hex);
    el.innerHTML = `<span class="pod-car"></span><span class="pod-name">${r.name}</span><span class="pod-pts">${r.total} pts</span><span class="pod-block">${k + 1}</span>`;
    pod.appendChild(el);
  }
  const list = $('#podium-list');
  list.innerHTML = '';
  rows.forEach((r, i) => {
    if (i < 3) return;
    const li = document.createElement('li');
    li.style.setProperty('--pc', r.hex);
    li.innerHTML = `<span class="pos">${ordinal(i + 1)}</span><span class="who">${r.name}</span><span class="gain"></span><span class="tot">${r.total}</span>`;
    list.appendChild(li);
  });
  list.hidden = rows.length <= 3;
  hud.visible(false);
  sound.matchWin();
  showScreen('podium');
}

game.onMatchEnd = ({ winner, standings, mode }) => {
  if (champ && mode === 'race') {
    scoreChampRace(standings);
    setTimeout(() => { if (champ && screen === 'none') showStandings(); }, 1200);
    return;
  }
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

function quitToMenu() {
  champ = null;
  hud.visible(false);
  $('#touch').classList.remove('show');
  sound.stopEngines();
  game.startAttract();
  showScreen('lobby');
  renderLobby();
}

function togglePause() {
  if (screen === 'pause') { game.pause(false); showScreen('none'); return; }
  if (screen === 'none' && game.pause(true)) {
    $('#btn-restart').textContent = champ ? 'Restart this race' : game.mode === 'tt' ? 'Restart time trial' : 'Restart';
    $('#btn-quit').textContent = champ ? 'Quit championship' : 'Quit to menu';
    showScreen('pause');
  }
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
$('#btn-restart').onclick = () => { game.pause(false); restartCurrent(); };
$('#btn-quit').onclick = () => { game.pause(false); quitToMenu(); };
$('#btn-again').onclick = () => startRace();
$('#btn-menu').onclick = () => quitToMenu();
$('#btn-next').onclick = () => nextChampRace();
$('#btn-champ-quit').onclick = () => { sound.click(); quitToMenu(); };
$('#btn-champ-again').onclick = () => { sound.click(); startRace(); };
$('#btn-champ-menu').onclick = () => { sound.click(); quitToMenu(); };
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
    else if ((screen === 'standings' || screen === 'podium') && e.code === 'Escape') quitToMenu();
  }
  if (e.code === 'KeyF' && (screen === 'none' || screen === 'pause')) toggleFullscreen();
  if (e.code === 'Enter') {
    if (screen === 'title') $('#btn-play').click();
    else if (screen === 'lobby') startRace();
    else if (screen === 'results') startRace();
    else if (screen === 'standings') nextChampRace();
    else if (screen === 'podium') startRace();
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
let firstVisit = false;
try { firstVisit = !localStorage.getItem(SETTINGS_KEY); } catch (e) { /* ignore */ }
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches && firstVisit) {
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
    if (screen === 'standings' && (p.button === 0 || p.button === 9)) nextChampRace();
    if (screen === 'podium' && p.button === 0) startRace();
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
    window.__tt.screen = () => screen;
    window.__tt.champ = () => champ;
    window.__tt.lobby = () => { showScreen('lobby'); renderLobby(); };
    window.__tt.ready = true;
  } else requestAnimationFrame(frame);
})().catch((err) => {
  console.error(err);
  $('#boot').innerHTML = `<p>Sorry, the game could not start.<br><small>${String(err && err.message || err)}</small></p>`;
});
