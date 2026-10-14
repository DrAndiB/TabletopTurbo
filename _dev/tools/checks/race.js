(async () => {
  const s = __tt.settings();
  s.world = 'desk'; s.mode = 'race'; s.laps = 3; s.skill = 'normal';
  s.slots = [{ type: 'keys' }, { type: 'simple' }, { type: 'cpu' }, { type: 'cpu' }];
  await __tt.start();
  const g = __tt.game; const log = [];
  const AI = g.cars.find(e => e.ai).ai.constructor;
  g.cars.filter(e => e.human).forEach((e, k) => { e.ai = new AI(e.car, g.track, g.physics, k ? 'easy' : 'normal', 50 + k); });
  let prev = '';
  for (let i = 0; i < 600 && g.state !== 'matchEnd'; i++) {
    g.simulate(0.5);
    const st = `${g.state} laps=${g.cars.map(e => e.lap).join(',')} fin=${g.cars.map(e => e.finished ? e.place : '-').join('')}`;
    if (st !== prev) { log.push(`${g.time.toFixed(1)} ${st} camW=${g.camW.toFixed(0)}`); prev = st; }
  }
  await new Promise(r => setTimeout(r, 1500));
  log.push('screen=' + document.body.dataset.screen + ' title=' + document.getElementById('results-title').textContent + ' list=' + document.getElementById('results-list').innerText.replace(/\n/g, ' | '));
  log.push('chips=' + document.getElementById('chips').innerText.replace(/\n/g, ' '));
  return log.join('\n');
})()
