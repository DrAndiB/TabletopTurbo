"""Write <game>/audio/CREDITS.md from the raw/*/<id>.json metadata of every recording the game uses.
usage: python -E -P credits.py GAME_DIR"""
import glob, json, os, re, sys
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
game = sys.argv[1]
meta = {}
for f in glob.glob(os.path.join(LAB, 'raw', '*', '*.json')):
    d = json.load(open(f, encoding='utf-8')); meta[str(d['id'])] = d

# which source ids went into which file
ENG = {'sports': [669623], 'formula': [481726], 'rally': [141459], 'truck': [487152], 'monster': [213977], 'suv': [748027],
       'boat': [637744], 'hover': [162251], 'snowmobile': [560870], 'rover': [824119], 'bumper': [846905]}
files = {f'eng/{k}.mp3': v for k, v in ENG.items()}
files.update({'amb/breakfast-room.mp3': [413852], 'amb/breakfast-window.mp3': [608154], 'amb/breakfast-fx.mp3': [565723, 848942, 665189, 181718]})
src = open(os.path.join(LAB, 'tools', 'amb.py'), encoding='utf-8').read()
A = json.load(open(os.path.join(LAB, 'work', 'amb.json'), encoding='utf-8'))
body = src[src.index('def W():'):src.index('def build(')]
for w, a in A.items():
    blk = body[body.index(f"'{w}': dict("):]; blk = blk[:blk.index("\n    '", 10) if "\n    '" in blk[10:] else len(blk)]
    beds = re.search(r'beds=\[(.*?)\],\n', blk, re.S).group(1)
    for k, m in enumerate(re.finditer(r'\((\d+),', beds)): files[f'amb/{w}-bed{k + 1}.mp3'] = [int(m.group(1))]
    fx = blk[blk.index('fx='):] if 'fx=' in blk else ''
    ids = [int(x) for x in re.findall(r'(?:loud|spans|hits)\((\d+)', fx)]
    if ids: files[f'amb/{w}-fx.mp3'] = list(dict.fromkeys(ids))

out = ['# Sound credits', '',
       'Recordings: Freesound previews released under CC0 1.0 (public domain dedication). Credit is not required by the',
       'licence; it is given here with thanks. Edited (cut, looped, filtered, levelled) for Tabletop Turbo.', '']
for f in sorted(files, key=lambda f: (not f.startswith('eng'), f)):
    if not os.path.exists(os.path.join(game, 'audio', f)): continue
    out.append(f'- `{f}`')
    for i in files[f]:
        d = meta.get(str(i))
        if not d: out.append(f'  - Freesound sound {i} — https://freesound.org/s/{i}/'); continue
        t = re.sub(r'^Freesound - ', '', d['title']); t = re.sub(r' by [^ ]+$', '', t)
        out.append(f"  - {t} by {d['user']} — {d['url']} ({d['license']})")
        if 'publicdomain/zero' not in d['license']: raise SystemExit(f'not CC0: {i}')
out += ['', 'Music: original compositions for Tabletop Turbo (the menu theme and one piece per table), rendered with',
        'FluidSynth and the GeneralUser GS SoundFont v2.0.3 by S. Christian Collins (https://www.schristiancollins.com),',
        'whose licence allows its use in music production, including commercial use.', '']
open(os.path.join(game, 'audio', 'CREDITS.md'), 'w', encoding='utf-8').write('\n'.join(out))
print(len(files), 'files credited')
