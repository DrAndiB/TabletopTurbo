"""Crémant Curves (Moselle vineyards): French musette waltz in G, 3/4, 144 bpm, 48 bars = 60 s.
A1 A2 (accordion) | B1 (accordion) B2 (violin takes the tune) | A3 (quiet: clarinet, no brushes) | B3 (build, accordion
back, ends on D7 into the top). Guitar chops on beats 2 and 3, bass on 1 with pickups, light brushes.
Final layer: a second accordion in thirds (chord-aware) under the tune + soft shaker."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('moselle', 144, 48, meter=3, seed=5)
A_CH = ['G', 'Em', 'Am', 'D7', 'G', 'B7', 'C . D7', 'G']
B_CH = ['C', 'G', 'D', 'G', 'Em', 'A7', 'D', 'D7']
S.set_chart(A_CH * 2 + B_CH * 2 + A_CH + B_CH)
SEC = lambda b: ['A1', 'A2', 'B1', 'B2', 'A3', 'B3'][b // 8]
G_MAJ = {7, 9, 11, 0, 2, 4, 6}
S.scale = G_MAJ

kit = S.part('kit', 40, 9, vol=100, rev=30)        # GS brush kit
bass = S.part('bass', 32, 0, vol=104, rev=15)
gtr = S.part('gtr', 25, 1, vol=84, pan=40, rev=35)
acc = S.part('acc', 21, 2, vol=100, pan=70, rev=40)
vln = S.part('vln', 40, 3, vol=100, pan=60, rev=50)
clar = S.part('clar', 71, 4, vol=100, pan=58, rev=50)
pno = S.part('pno', 0, 5, vol=76, pan=86, rev=45)
acc2 = S.part('acc2', 21, 6, final=True, vol=92, pan=40, rev=40)
fkit = S.part('fkit', 0, 9, final=True, vol=96, rev=25)

A = ['B4:0.5 D5:0.5 G5:1.5 F#5:0.5', 'E5:0.5 G5:0.5 B5:1.5 A5:0.5', 'C6:0.5 B5:0.5 A5:0.5 E5:0.5 A5:0.5 C6:0.5',
     'C6:1 A5:0.5 F#5:0.5 D5:0.5 F#5:0.5', 'G5:1 B5:0.5 D6:0.5 B5:0.5 G5:0.5', 'F#5:0.5 A5:0.5 D#6:1.5 B5:0.5',
     'E6:0.5 D6:0.5 C6:0.5 G5:0.5 F#5:0.5 A5:0.5', 'G5:2 r:0.5 D5:0.5']
A2 = A[:4] + ['G5:0.5 B5:0.5 D6:1 C6:0.5 B5:0.5', 'A5:0.5 F#5:0.5 D#5:1 B4:0.5 D#5:0.5',
              'E5:0.5 G5:0.5 C6:1 A5:0.5 F#5:0.5', 'G5:1.5 r:0.5 G5:0.5 B5:0.5']
B = ['C6:0.5 E6:0.5 G6:1 E6:0.5 C6:0.5', 'D6:1.5 B5:0.5 G5:0.5 B5:0.5', 'A5:0.5 D6:0.5 F#6:1 E6:0.5 D6:0.5',
     'D6:1.5 B5:0.5 G5:1', 'G5:0.5 B5:0.5 E6:1.5 D6:0.5', 'C#6:0.5 E6:0.5 G6:1 E6:0.5 C#6:0.5',
     'D6:1 A5:0.5 F#5:0.5 A5:0.5 D6:0.5', 'C6:1.5 A5:0.5 F#5:0.5 D5:0.5']
B_END = B[:7] + ['C6:0.5 A5:0.5 F#5:0.5 D5:0.5 C5:0.5 A4:0.5']   # runs down into the B4 pickup of bar 1
S.melody(acc, 0, A, 88, legato=0.9)
S.melody(acc, 8, A2, 90, legato=0.9)
S.melody(acc, 16, B, 92, legato=0.9)
S.melody(vln, 24, B, 88, legato=0.95)
S.melody(clar, 32, A[:7] + ['G5:2 r:0.5 D5:0.5'], 80, legato=0.95)
S.melody(acc, 40, B_END, 94, legato=0.9)

def thirds(src, dst, vel=-12):
    """a third below each note, preferring a chord tone 3-5 semitones down, else the diatonic third"""
    sc = sorted(G_MAJ); pcs = [o * 12 + p for o in range(11) for p in sc]
    for b, d, m, v in src.notes:
        root, iv = chord(S.chord_at(b % S.end).split('/')[0]); ct = {(root + x) % 12 for x in iv}
        c = [m - k for k in (3, 4, 5) if (m - k) % 12 in ct]
        if c: dst.add(b, d, c[0], v + vel)
        elif m in pcs: dst.add(b, d, pcs[pcs.index(m) - 2], v + vel)
for P in (acc, vln, clar):
    if P is clar: continue                     # leave the quiet A3 to the clarinet alone
    thirds(P, acc2)

# guitar: chops on beats 2 and 3 (shorter and softer in the quiet A3)
for b in range(48):
    s = SEC(b)
    for k, beat in enumerate((1, 2)):
        t = b * 3 + beat; sym = S.chord_at(t)
        for j, m in enumerate(voicing(sym, midi('B3'), 4)):
            gtr.add(t + j * 0.012, 0.32 if s != 'A3' else 0.22, m, (70 if k == 0 else 64) - (14 if s == 'A3' else 0) + random.uniform(-4, 4))
# piano: light off-beat sparkle answering the tune in B1/B3
S.block(pno, [1.5], midi('D5'), 3, 58, length=0.3, only=lambda b: SEC(b) in ('B1', 'B3'))

# bass: root on 1 (the fifth below on every second bar of a held phrase), pickups into the next bar in the busier sections
for b in range(48):
    s, t = SEC(b), b * 3
    sym = S.chart[b].split()[0]; r = S.bass_root(sym, midi('E1'))
    f5 = r - 5 if r - 5 >= midi('D1') else r + 7
    note = r if b % 2 == 0 or sym in ('B7', 'A7', 'D7') else f5
    bass.add(t, 0.9, note, 96 if s != 'A3' else 84)
    if S.chart[b].endswith('D7') and S.chart[b] != 'D7': bass.add(t + 2, 0.9, S.bass_root('D7', midi('E1')), 88)
    nxt = S.bass_root(S.chart[(b + 1) % 48].split()[0], midi('E1'))
    if s in ('A2', 'B1', 'B3') and b % 2 == 1 and not S.chart[b].endswith('D7'):
        # two scale steps walking up into the next root
        sc = [o * 12 + p for o in range(1, 5) for p in sorted(G_MAJ)]
        k = sc.index(nxt) if nxt in sc else None
        if k: bass.add(t + 2, 0.45, sc[k - 2], 78); bass.add(t + 2.5, 0.45, sc[k - 1], 82)

# brushes: soft kick on 1, brush taps on 2 and 3, swish on the off-beats; tacet in A3 apart from a tap on 3; build in B3
for b in range(48):
    s, t = SEC(b), b * 3
    if s == 'A3':
        S.hit(kit, t + 2, SNARE, 46)
        continue
    S.hit(kit, t, KICK, 60)
    S.hit(kit, t + 1, SNARE, 62); S.hit(kit, t + 2, SNARE, 56)
    for o in (0.5, 1.5, 2.5): S.hit(kit, t + o, ESNARE, 36)
    S.hit(kit, t, PHAT, 40)
    if s == 'B3': S.hit(kit, t + 2.5, SNARE, 40 + (b - 40) * 3)
    if b in (0, 16, 40): S.hit(kit, t, CRASH, 60)
for j in range(6): S.hit(kit, 47 * 3 + j * 0.5, SNARE, 38 + j * 4)   # brush pickup into bar 1

# final layer: shaker on the 8ths (not in the quiet A3) with a lift on 1
for b in range(48):
    if SEC(b) == 'A3': continue
    S.pattern(fkit, b, 'xoxoxo', SHAKER, 58, sub=2)

for P in (acc, vln, clar):   # humanised starts never run ahead of the bar line (keeps them inside their chord)
    P.notes = [(b + 0.006, d, m, v) for b, d, m, v in P.notes]
def limiter(x, over=13.5, look=0.004, rel=0.08):
    """transparent peak limiter: holds peaks to `over` dB above the signal's own loudness (look-ahead, smooth release)"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    a = np.abs(x).max(1); g = np.minimum(1.0, db(L + over) / np.maximum(a, 1e-9))
    n = int(look * SR); g = minimum_filter1d(g, 2 * n + 1)
    step = 64; gd = g[: len(g) // step * step].reshape(-1, step).min(1); r = np.exp(-step / (rel * SR)); y = np.empty_like(gd); e = 1.0
    for i, v in enumerate(gd): e = v if v < e else r * e + (1 - r) * v; y[i] = e
    g = np.minimum(g, np.concatenate([np.repeat(y, step), np.ones(len(g) - len(y) * step)]))
    return x * uniform_filter1d(g, n)[:, None]

S.check_key(G_MAJ)
GAIN = {'kit': -22, 'bass': -21, 'gtr': -23.5, 'acc': -18.5, 'vln': -19, 'clar': -19, 'pno': -27, 'acc2': -24.5, 'fkit': -27}
# accordion reeds sit forward from 1 to 3 kHz: pull that region down
bus = lambda x: limiter(eq(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1100, 0.8, -2.5),
                         'peak', 2200, 0.9, -5), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3))
print('loop', S.finish(GAIN, bus=bus))
