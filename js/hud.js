// In-game overlay: player chips with points / laps, the time-trial clock, centre messages and short flashes.
import { ordinal } from './game.js';
import { formatTime } from './records.js';

export class Hud {
  constructor(root) {
    this.root = root;
    this.chips = root.querySelector('#chips');
    this.msg = root.querySelector('#msg');
    this.flashEl = root.querySelector('#flash');
    this.tt = root.querySelector('#tt');
    this.ttCur = root.querySelector('#tt-cur');
    this.ttLast = root.querySelector('#tt-last');
    this.ttBest = root.querySelector('#tt-best');
    this.ttLap = root.querySelector('#tt-lap');
    this.lastKey = '';
    this.flashTimer = null;
  }

  setup(game) {
    this.chips.innerHTML = '';
    this.chipEls = game.cars.map((e) => {
      const el = document.createElement('div');
      el.className = 'chip';
      el.style.setProperty('--pc', e.color.hex);
      el.innerHTML = `<span class="chip-name">${e.human ? e.color.name : 'CPU'}</span><span class="chip-info"></span>`;
      this.chips.appendChild(el);
      return el;
    });
    this.lastKey = '';
    this.flashEl.innerHTML = '';
    if (this.tt) {
      this.tt.hidden = game.mode !== 'tt';
      this.tt.style.setProperty('--pc', game.cars[0] ? game.cars[0].color.hex : '#fff');
      this._tt = {};
    }
    this.visible(true);
  }

  visible(v) { this.root.classList.toggle('hidden', !v); }

  setText(el, key, text) {
    if (!el || this._tt[key] === text) return;
    el.textContent = text; this._tt[key] = text;
  }

  update(game) {
    if (!this.chipEls || game.state === 'attract') return;
    const race = game.mode === 'race', tt = game.mode === 'tt';
    let order = [];
    if (race) order = [...game.cars].sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.place - b.place : b.progress - a.progress));
    game.cars.forEach((e, i) => {
      let info;
      if (tt) {
        info = `lap ${Math.max(1, e.lap + 1)}`;
      } else if (race) {
        const pos = e.finished ? e.place : order.indexOf(e) + 1;
        const lap = Math.min(game.laps, Math.max(1, e.lap + 1));
        info = e.finished ? `${ordinal(pos)} · done` : `${ordinal(pos)} · lap ${lap}/${game.laps}`;
      } else {
        info = '●'.repeat(e.points) + '○'.repeat(Math.max(0, game.pointsToWin - e.points));
      }
      const out = !race && !tt && e.out;
      const el = this.chipEls[i];
      if (!el) return;
      if (el._info !== info) { el.querySelector('.chip-info').textContent = info; el._info = info; }
      if (el._out !== out) { el.classList.toggle('out', out); el._out = out; }
    });
    if (tt && game.tt && this.tt) {
      const T = game.tt, e = game.cars[0];
      const cur = T.recording ? Math.max(0, game.raceTime - e.lapStart) : 0;
      this.setText(this.ttCur, 'cur', formatTime(cur));
      this.setText(this.ttLast, 'last', T.lastLap != null ? formatTime(T.lastLap) : '–');
      this.setText(this.ttBest, 'best', T.best != null ? formatTime(T.best) : '–');
      this.setText(this.ttLap, 'lap', `Lap ${Math.max(1, e.lap + 1)}`);
      const fresh = T.newBest && game.time - T.newBest < 2.5;
      if (this._tt.fresh !== fresh) { this.tt.classList.toggle('fresh', !!fresh); this._tt.fresh = fresh; }
    }
  }

  message(text, kind, color) {
    this.msg.textContent = text || '';
    this.msg.className = 'msg' + (kind ? ' ' + kind : '') + (text ? ' show' : '');
    this.msg.style.setProperty('--mc', color || '#fff');
    if (kind === 'count' || kind === 'go') {
      this.msg.classList.remove('pop'); void this.msg.offsetWidth; this.msg.classList.add('pop');
    }
  }

  flash(text, color) {
    const el = document.createElement('div');
    el.className = 'flash-item';
    el.style.setProperty('--fc', color || '#fff');
    el.textContent = text;
    this.flashEl.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }
}
