"""Grund Prix (Luxembourg's Grund, by the Alzette): celtic folk-rock reel in D mixolydian, 132 bpm, 32 bars = 58.2 s.
A (fiddle reel) | B (Bm side) | A' (second fiddle in thirds) | bridge (B chords, flute in long notes over bodhran,
fiddle and kit build back in its last two bars). Fiddle, acoustic guitar strums, bass, folk-rock kit + bodhran toms.
Final layer: tin whistle counter-line in long notes + tambourine 8ths."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('grund', 132, 32, seed=21)
A_CH = ['D', 'D', 'C', 'G', 'D', 'D', 'G A', 'D']
B_CH = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em A', 'D']
S.set_chart(A_CH + B_CH + A_CH + B_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'A2' if b < 24 else 'C' if b < 30 else 'CB'
D_MIX = {2, 4, 6, 7, 9, 11, 0}
S.scale = D_MIX

kit = S.part('kit', 0, 9, vol=110, rev=22)
bass = S.part('bass', 33, 0, vol=106, rev=10)
gtr = S.part('gtr', 25, 1, vol=88, pan=42, rev=40, cho=25)
fid = S.part('fid', 40, 2, vol=100, pan=66, rev=45)
fid2 = S.part('fid2', 40, 3, vol=90, pan=88, rev=45)
flute = S.part('flute', 73, 4, vol=100, pan=60, rev=60)
whistle = S.part('whistle', 78, 5, final=True, vol=92, pan=36, rev=55)
fkit = S.part('fkit', 0, 9, final=True, vol=100, rev=20)

A = ['D5:0.5 F#5:0.5 A5:0.5 F#5:0.5 B5:0.5 A5:0.5 F#5:0.5 E5:0.5',
     'D5:0.5 E5:0.5 F#5:0.5 A5:0.5 D6:0.5 C6:0.5 A5:0.5 F#5:0.5',
     'G5:0.5 E5:0.5 C5:0.5 E5:0.5 G5:0.5 A5:0.5 G5:0.5 E5:0.5',
     'D5:0.5 G5:0.5 B5:0.5 G5:0.5 A5:0.5 G5:0.5 E5:0.5 G5:0.5',
     'F#5:0.5 A5:0.5 D6:0.5 A5:0.5 F#5:0.5 A5:0.5 E6:0.5 D6:0.5',
     'C6:0.5 A5:0.5 F#5:0.5 A5:0.5 C6:0.5 D6:0.5 E6:0.5 C6:0.5',
     'B5:0.5 G5:0.5 D5:0.5 G5:0.5 A5:0.5 E5:0.5 C#5:0.5 E5:0.5',
     'D5:1.5 A4:0.5 D5:0.5 E5:0.5 F#5:0.5 E5:0.5']
B = ['F#5:1 B5:0.5 A5:0.5 F#5:0.5 D5:0.5 B4:0.5 D5:0.5',
     'G5:1 B5:0.5 A5:0.5 G5:0.5 D5:0.5 B4:0.5 D5:0.5',
     'F#5:0.5 A5:0.5 D6:1 E6:0.5 D6:0.5 A5:0.5 F#5:0.5',
     'E5:0.5 A5:0.5 C#6:1 B5:0.5 A5:0.5 E5:0.5 C#5:0.5',
     'D5:0.5 F#5:0.5 B5:1 D6:0.5 E6:0.5 D6:0.5 B5:0.5',
     'G5:0.5 B5:0.5 D6:1 C6:0.5 B5:0.5 A5:0.5 G5:0.5',
     'E5:0.5 G5:0.5 B5:0.5 G5:0.5 A5:0.5 C#6:0.5 E6:0.5 C#6:0.5',
     'D6:1.5 A5:0.5 F#5:0.5 E5:0.5 D5:0.5 E5:0.5']
A2 = A[:7] + ['D5:1 F#5:0.5 A5:0.5 D6:1 B5:0.5 A5:0.5']
BRIDGE = ['D6:2 B5:1 F#5:1', 'G5:1.5 A5:0.5 B5:2', 'A5:2 F#5:1 D5:1', 'E5:1 A5:1 C#6:2', 'D6:2 F#6:1 E6:1', 'D6:1.5 B5:0.5 G5:2']
BUILD = ['E5:0.5 G5:0.5 B5:0.5 E6:0.5 C#6:0.5 A5:0.5 E5:0.5 A5:0.5', 'D5:0.5 F#5:0.5 A5:0.5 D6:0.5 C6:0.5 A5:0.5 F#5:0.5 E5:0.5']
acc = lambda b: 10 if b in (0, 2) else 4 if b in (1, 3) else 0     # reel lift on the beats
S.melody(fid, 0, A + B + A2, 90, legato=0.85, accent=acc)
S.melody(flute, 24, BRIDGE, 84, legato=0.95)
S.melody(fid, 30, BUILD, 88, legato=0.85, accent=acc)

def thirds(src, dst, scale, vel=-12, bars=None):
    """a third below each note, preferring a chord tone 3-5 semitones down, else the diatonic third"""
    sc = sorted(scale); pcs = [o * 12 + p for o in range(11) for p in sc]
    for b, d, m, v in src.notes:
        if bars and int(b // S.meter) not in bars: continue
        root, iv = chord(S.chord_at(b % S.end).split('/')[0]); ct = {(root + x) % 12 for x in iv}
        c = [m - k for k in (3, 4, 5) if (m - k) % 12 in ct]
        if c: dst.add(b, d, c[0], v + vel)
        elif m in pcs: dst.add(b, d, pcs[pcs.index(m) - 2], v + vel)
thirds(fid, fid2, D_MIX, -12, bars=range(16, 24))

# final layer: tin whistle counter-line (long notes against the reel), in every section
WA = ['A5:2 F#5:2', 'A5:1 B5:1 A5:2', 'G5:2 E5:2', 'D5:2 G5:2', 'F#5:2 A5:2', 'C6:2 A5:2', 'B5:2 C#6:2', 'D6:2 A5:2']
WB = ['D5:2 F#5:2', 'G5:2 B5:2', 'A5:2 F#5:2', 'E5:2 C#5:2', 'D5:2 F#5:2', 'B4:2 D5:2', 'E5:2 C#5:2', 'D5:4']
WC = ['F#5:4', 'D5:4', 'F#5:4', 'E5:4', 'F#5:4', 'G5:4', 'G5:2 A5:2', 'A5:2 F#5:2']
S.melody(whistle, 0, WA + WB + WA + WC, 78, legato=0.95)

# guitar: folk-rock strum; one ringing strum per chord in the bridge
STRUM = [(0, 'D', 1.0), (1, 'D', 0.75), (1.5, 'U', 0.6), (2.5, 'U', 0.65), (3, 'D', 0.8), (3.5, 'U', 0.6)]
S.strum(gtr, STRUM, midi('D4'), 4, 72, bass=midi('A3'), only=lambda b: SEC(b) in ('A', 'B', 'A2', 'CB'))
S.strum(gtr, [(0, 'D', 0.8), (2, 'D', 0.6)], midi('D4'), 4, 64, bass=midi('A3'), only=lambda b: SEC(b) == 'C')

# bass: driving 8ths, whole notes in the bridge, pulsing into the top
S.bassline(bass, midi('E1'), 'root8', 96, only=lambda b: SEC(b) in ('A', 'B', 'A2'))
S.bassline(bass, midi('E1'), 'root', 88, only=lambda b: SEC(b) == 'C')
for b in (30, 31):
    for i in range(8):
        sym = S.chord_at(b * 4 + i * 0.5); bass.add(b * 4 + i * 0.5, 0.42, S.bass_root(sym, midi('E1')), 86 + i * 2)

# drums: kick/snare/hats + bodhran-ish floor tom in the reel; bridge = bodhran alone; build with toms and snare
for b in range(32):
    s, t = SEC(b), b * 4
    if s in ('A', 'B', 'A2'):
        S.pattern(kit, b, 'x.....x.x.....x.' if s != 'B' else 'x.......x.x.....', KICK, 100)
        S.pattern(kit, b, '....x.......x...', SNARE, 94)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.' if s != 'B' else 'x...x...x...x...', HAT if s != 'B' else RIDE, 60)
        S.pattern(kit, b, 'x.ox.ox.x.ox.ox.', LFTOM, 58)
        if b % 8 == 7: S.pattern(kit, b, '............xxxx', SNARE, 82)
    elif s == 'C':
        S.pattern(kit, b, 'x.ox.ox.x.ox.oxo', LFTOM, 56)
        S.pattern(kit, b, 'x.......x.......', KICK, 78)
    else:
        S.pattern(kit, b, 'x...x...x...x...', KICK, 90 + (b - 30) * 6)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', HAT, 56 + (b - 30) * 6)
        S.pattern(kit, b, '....x.......x...', SNARE, 90)
        if b == 31:
            for j in range(8): S.hit(kit, t + 2 + j * 0.25, [HTOM, HTOM, MTOM, MTOM, LTOM, LTOM, LFTOM, LFTOM][j], 80 + j * 3)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 96)

for b in range(32):
    if SEC(b) == 'C': S.pattern(fkit, b, 'x...x...x...x...', TAMB, 54)
    else: S.pattern(fkit, b, 'x.o.x.o.x.o.x.o.', TAMB, 62)

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

for P in (fid, fid2, flute, whistle):   # humanised starts never run ahead of the bar line
    P.notes = [(b + 0.006, d, m, v) for b, d, m, v in P.notes]
S.check_key(D_MIX)
GAIN = {'kit': -19, 'bass': -20, 'gtr': -23.5, 'fid': -18.5, 'fid2': -24, 'flute': -19, 'whistle': -25.5, 'fkit': -26.5}
bus = lambda x: limiter(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 3500, 1.0, -2.5),
                              'highshelf', 5000, 0.7, -3), 'peak', 1000, 0.8, -2.5))
print('loop', S.finish(GAIN, bus=bus))
