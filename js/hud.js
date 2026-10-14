// In-game overlay: player chips with points / laps, centre messages and short flashes.
import { ordinal } from './game.js';

export class Hud {
  constructor(root) {
    this.root = root;
    this.chips = root.querySelector('#chips');
    this.msg = root.querySelector('#msg');
    this.flashEl = root.querySelector('#flash');
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
    this.visible(true);
  }

  visible(v) { this.root.classList.toggle('hidden', !v); }

  update(game) {
    if (!this.chipEls || game.state === 'attract') return;
    const parts = [];
    const race = game.mode === 'race';
    let order = [];
    if (race) order = [...game.cars].sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.place - b.place : b.progress - a.progress));
    game.cars.forEach((e, i) => {
      let info;
      if (race) {
        const pos = e.finished ? e.place : order.indexOf(e) + 1;
        const lap = Math.min(game.laps, Math.max(1, e.lap + 1));
        info = e.finished ? `${ordinal(pos)} · done` : `${ordinal(pos)} · lap ${lap}/${game.laps}`;
      } else {
        info = '●'.repeat(e.points) + '○'.repeat(Math.max(0, game.pointsToWin - e.points));
      }
      const out = !race && e.out;
      parts.push(info + (out ? 'x' : ''));
      const el = this.chipEls[i];
      if (el._info !== info) { el.querySelector('.chip-info').textContent = info; el._info = info; }
      if (el._out !== out) { el.classList.toggle('out', out); el._out = out; }
    });
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
