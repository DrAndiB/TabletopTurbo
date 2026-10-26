"""Write work/amb.json (from amb.py) into samples.js: each world's `{ music: song(...) }` line gains beds, fx, ev.
usage: python -E -P amb_js.py GAME_DIR [world ...]"""
import json, os, re, sys
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
game = sys.argv[1]; A = json.load(open(os.path.join(LAB, 'work', 'amb.json'), encoding='utf-8'))
ids = sys.argv[2:] or list(A)
p = os.path.join(game, 'js', 'samples.js'); s = open(p, encoding='utf-8').read()
js = lambda v: json.dumps(v, ensure_ascii=False).replace('"', "'")
def num(x): return f'{x:g}' if isinstance(x, (int, float)) else js(x)
for w in ids:
    a = A[w]
    m = re.search(rf"^  {w}: \{{ music: (song\([^\n]*\)) \}},$", s, re.M)
    if not m: print('skip (not a one-line entry):', w); continue
    beds = ',\n'.join('      { ' + ', '.join(f"{k}: {js(v) if k == 'src' else num(v)}" for k, v in b.items()) + ' }' for b in a['beds'])
    out = [f"  {w}: {{", f"    music: {m.group(1)},", f"    // {a['note']}", f"    beds: [\n{beds},\n    ],"]
    if a['fx']:
        cuts = ',\n'.join(f"        {k}: {js(v)}" for k, v in a['fx']['cuts'].items())
        out.append(f"    fx: {{\n      src: '{a['fx']['src']}',\n      cuts: {{\n{cuts},\n      }},\n    }},")
    out.append('    ev: ' + js(a['ev']).replace(',', ', ') + ',')
    out.append('  },')
    s = s[:m.start()] + '\n'.join(out) + s[m.end():]
    print('updated', w)
open(p, 'w', encoding='utf-8').write(s)
