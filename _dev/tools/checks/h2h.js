(async () => {
  const s = __tt.settings();
  s.world = 'breakfast'; s.mode = 'h2h'; s.points = 3; s.skill = 'normal';
  s.slots = [{ type: 'keys' }, { type: 'cpu' }, { type: 'cpu' }, { type: 'off' }];
  await __tt.start();
  const g = __tt.game; const log = [];
  __tt.input.down.add('ArrowUp');
  let prev = '';
  for (let i = 0; i < 400 && g.state !== 'matchEnd'; i++) {
    g.simulate(0.5);
    const st = `${g.state} r${g.round} pts=${g.cars.map(e => e.points).join('')} out=${g.cars.map(e => e.out ? 1 : 0).join('')}`;
    if (st !== prev) { log.push(`${g.time.toFixed(1)} ${st}`); prev = st; }
  }
  await new Promise(r => setTimeout(r, 1500));
  log.push('screen=' + document.body.dataset.screen + ' title=' + document.getElementById('results-title').textContent + ' list=' + document.getElementById('results-list').innerText.replace(/\n/g, ' | '));
  return log.join('\n');
})()
