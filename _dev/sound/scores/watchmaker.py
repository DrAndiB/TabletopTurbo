"""Watchmaker's Bench: baroque-ish clockwork in G, 4/4, one bar = exactly 2.8 s (the balance wheel's swing), so
bpm = 60 / 0.7; a chord per half bar. 22 bars = 61.6 s: A (8, music box over harpsichord alberti), B (8, E minor,
celesta over strings, quieter, building back in its last two bars), A' (6, shortened return ending on Am D7).
Woodblock tick-tock on every beat. Final layer: a second music box with a broken-chord counter-figure + cabasa."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('watchmaker', 60 / 0.7, 22, seed=11)
A_CH = ['G D', 'Em Bm', 'C G', 'Am D', 'G D/F#', 'Em C', 'Am D7', 'G']
B_CH = ['Em B7', 'Em Am', 'D7 G', 'C B7', 'Em Am', 'D G', 'C D7', 'G']
R_CH = A_CH[:4] + ['Em C', 'Am D7']
S.set_chart(A_CH + B_CH + R_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 14 else 'Bb' if b < 16 else 'R'
G_MAJ = {7, 9, 11, 0, 2, 4, 6}
S.scale = G_MAJ

kit = S.part('kit', 0, 9, vol=100, rev=30)
bass = S.part('bass', 32, 0, vol=100, rev=20)
hpsi = S.part('hpsi', 6, 1, vol=84, pan=44, rev=40)
mbox = S.part('mbox', 10, 2, vol=100, pan=70, rev=50)
cel = S.part('cel', 8, 3, vol=100, pan=66, rev=60)
strs = S.part('str', 48, 4, vol=76, rev=70)
pizz = S.part('pizz', 45, 5, vol=80, pan=34, rev=40)
mbox2 = S.part('mbox2', 10, 6, final=True, vol=90, pan=90, rev=55)
fkit = S.part('fkit', 0, 9, final=True, vol=96, rev=25)

A = [
    'D5:0.5 G5:0.5 B5:0.5 G5:0.5 A5:0.5 F#5:0.5 D5:1',
    'E5:0.5 G5:0.5 B5:1 B5:0.5 A5:0.25 G5:0.25 F#5:1',
    'E5:0.5 G5:0.5 C6:0.5 B5:0.5 B5:0.5 A5:0.25 G5:0.25 D5:1',
    'C5:0.5 E5:0.5 A5:0.75 G5:0.25 F#5:0.5 E5:0.5 F#5:0.5 A5:0.5',
    'G5:0.25 A5:0.25 B5:0.5 D6:1 C6:0.5 A5:0.5 F#5:1',
    'G5:0.5 B5:0.5 E6:1 E6:0.5 D6:0.25 C6:0.25 G5:1',
    'A5:0.5 C6:0.5 E6:0.5 C6:0.5 B5:0.5 A5:0.5 C6:0.5 F#5:0.5',
    'G5:1.5 D5:0.5 G5:0.5 B5:0.5 D6:0.5 r:0.5',
]
B = [
    'G5:1 B5:0.5 E6:0.5 D#6:1.5 B5:0.5',
    'E6:1 G5:0.5 B5:0.5 C6:1 A5:1',
    'F#5:0.5 A5:0.5 C6:0.5 A5:0.5 B5:1.5 G5:0.5',
    'E5:0.5 G5:0.5 C6:0.5 E6:0.5 B5:1 D#6:1',
    'G5:1 B5:0.5 E6:0.5 E6:0.5 D6:0.25 C6:0.25 A5:1',
    'F#5:0.5 A5:0.5 D6:1 D6:0.5 C6:0.25 B5:0.25 G5:1',
    'E5:0.5 G5:0.5 C6:0.5 E6:0.5 D6:0.5 C6:0.5 A5:0.5 F#5:0.5',
    'G5:2 D5:0.5 E5:0.5 F#5:0.5 A5:0.5',
]
R = A[:4] + [A[5], 'A5:0.5 C6:0.5 E6:0.5 C6:0.5 B5:0.5 A5:0.5 F#5:0.5 A5:0.5']
acc = lambda b: 8 if b in (0, 2) else 0
S.melody(mbox, 0, A, 90, legato=0.95, accent=acc)
S.melody(mbox, 16, R, 92, legato=0.95, accent=acc)
S.melody(cel, 8, B[:6], 82, legato=1.0, accent=acc)
S.melody(mbox, 14, B[6:], 86, legato=0.95, accent=acc)   # the music box takes the tune back for the build

# harpsichord: alberti 16ths in A / R / the build, gentle broken 8ths in the bridge
S.arp(hpsi, midi('D4'), 0.25, 'alberti', 3, 66, length=0.22, only=lambda b: SEC(b) in ('A', 'R', 'Bb'))
S.arp(hpsi, midi('D4'), 0.5, 'up', 3, 56, length=0.45, only=lambda b: SEC(b) == 'B')
S.pad(strs, midi('B4'), 3, 50, only=lambda b: SEC(b) in ('B', 'Bb'))

# bass: walking quarters (root, step into the next root); long notes in the quiet bridge; pizzicato on top in the bridge
S.bassline(bass, midi('E1'), 'walk', 92, only=lambda b: SEC(b) in ('A', 'R', 'Bb'))
S.bassline(bass, midi('E1'), 'root', 84, only=lambda b: SEC(b) == 'B')
S.bassline(pizz, midi('E2'), 'walk', 74, only=lambda b: SEC(b) in ('B', 'Bb'))

# clockwork: tick (high woodblock) on beats 1 & 3, tock (low) on 2 & 4; soft kick and rim in the A sections
for b in range(22):
    s, t = SEC(b), b * 4
    S.pattern(kit, b, 'x...o...x...o...', WOOD_H, 66)
    S.pattern(kit, b, '....x.......x...', WOOD_L, 66)
    if s in ('A', 'R'):
        S.pattern(kit, b, 'x.......x.....o.', KICK, 56)
        S.pattern(kit, b, '....x.......x...', STICK, 62)
    elif s == 'Bb':
        S.pattern(kit, b, 'x...x...x...x...', KICK, 54 + (b - 14) * 8)
        if b == 15:
            for j in range(8): S.hit(kit, t + 2 + j * 0.25, SNARE, 34 + j * 4)
    if b in (0, 16): S.hit(kit, t, TRI_O, 52)
    if b == 8: S.hit(kit, t, TRI_O, 48)

# final layer: second music box, broken-chord figure an octave up on the off-beats, and cabasa 16ths
for t, d, sym in S.chords:
    v = voicing(sym, midi('D6'), 3)
    for i, m in enumerate([v[0], v[2], v[1], v[2]]):
        mbox2.add(t + 0.5 + i * 0.5 - (0 if i < 3 else 0), 0.45, m, 62 + (6 if i == 0 else 0) + random.uniform(-4, 4)) if 0.5 + i * 0.5 < d else None
for b in range(22):
    if SEC(b) == 'B': S.pattern(fkit, b, 'x.o.x.o.x.o.x.o.', CABASA, 54)
    else: S.pattern(fkit, b, 'xoooxoooxoooxooo', CABASA, 58)

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
GAIN = {'kit': -24, 'bass': -21, 'hpsi': -24, 'mbox': -18.5, 'cel': -19.5, 'str': -27, 'pizz': -26, 'mbox2': -24.5, 'fkit': -27}
# the music box and harpsichord sit forward from 700 Hz to 3 kHz: pull that region down, a touch of warmth below
bus = lambda x: limiter(eq(eq(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 220, 0.8, 2),
                         'peak', 1100, 0.8, -3), 'peak', 2300, 0.9, -3), 'peak', 3500, 1.0, -2), 'highshelf', 5000, 0.7, -2))
print('loop', S.finish(GAIN, bus=bus))
