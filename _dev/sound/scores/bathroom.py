"""Bath Time Overflow: bubbly pop in A, 126 bpm, 32 bars (verse, hook, verse, half-time bridge with a build).
Marimba tune in the verses, steel drums in the hook, kalimba in the bridge; pizzicato off-beat plucks, clean guitar
strums in the hook, picked bass, light pop kit. Final lap: a bubbly celesta arpeggio in 16ths (resting in the quiet bridge)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('bathroom', 126, 32, seed=21)
V_CH = ['A', 'C#m', 'D', 'E', 'A', 'C#m', 'Bm7', 'E']
H_CH = ['D', 'E', 'C#m', 'F#m', 'D', 'E', 'A', 'E']
BR_CH = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'Bm7', 'E']
S.set_chart(V_CH + H_CH + V_CH + BR_CH)
SEC = lambda b: 'V' if b < 8 else 'H' if b < 16 else 'V2' if b < 24 else 'Bq' if b < 30 else 'Bb'
A_MAJ = {9, 11, 1, 2, 4, 6, 8}
S.scale = A_MAJ

kit = S.part('kit', 0, 9, vol=108, rev=25)
bass = S.part('bass', 34, 0, vol=108, rev=10)
pluck = S.part('pluck', 45, 1, vol=86, pan=36, rev=40)
gtr = S.part('gtr', 27, 2, vol=84, pan=88, rev=40, cho=40)
mar = S.part('mar', 12, 3, vol=104, pan=58, rev=45)
steel = S.part('steel', 114, 4, vol=96, pan=66, rev=50)
kal = S.part('kal', 108, 5, vol=100, pan=60, rev=60)
strs = S.part('str', 48, 6, vol=72, rev=70)
bub = S.part('bub', 8, 7, final=True, vol=84, pan=80, rev=60)

V = [
    'C#6:0.5 r:0.5 C#6:0.5 E6:0.5 r:0.5 C#6:0.5 B5:0.5 A5:0.5',
    'G#5:1 E5:0.5 G#5:0.5 B5:1 r:1',
    'A5:0.5 r:0.5 A5:0.5 F#5:0.5 r:0.5 A5:0.5 D6:0.5 C#6:0.5',
    'B5:1.5 G#5:0.5 E5:1 r:1',
    'C#6:0.5 r:0.5 C#6:0.5 E6:0.5 r:0.5 F#6:0.5 E6:0.5 C#6:0.5',
    'B5:1 G#5:0.5 E5:0.5 C#5:1 E5:1',
    'F#5:0.5 A5:0.5 D6:0.5 C#6:0.5 B5:0.5 A5:0.5 F#5:1',
    'G#5:1 B5:1 E5:1 r:1',
]
H = [
    'F#5:1 A5:1 D6:1.5 C#6:0.5',
    'B5:1.5 G#5:0.5 E5:2',
    'E5:0.5 G#5:0.5 C#6:1 B5:0.5 C#6:0.5 E6:1',
    'C#6:3 r:0.5 C#6:0.5',
    'D6:1 C#6:0.5 B5:0.5 A5:1 F#5:1',
    'G#5:1 B5:0.5 E6:0.5 D6:1 B5:1',
    'C#6:1.5 B5:0.5 A5:2',
    'r:2 E5:0.5 G#5:0.5 B5:0.5 r:0.5',
]
BR = [
    'A5:2 C#6:2', 'F#5:2 A5:1 B5:1', 'C#6:2 E6:2', 'B5:3 r:1',
    'C#6:1 A5:1 F#5:1 A5:1', 'D6:1 C#6:1 A5:1 F#5:1', 'D6:1 E6:1 F#6:1 D6:1', 'E6:1 B5:1 G#5:1 B5:0.5 r:0.5',
]
for x in V + H + BR: assert abs(sum(float(t.split(':')[1]) for t in x.split()) - 4) < 1e-6, x
acc = lambda b: 8 if b in (0, 2) else 0
S.melody(mar, 0, V, 96, legato=0.6, accent=acc)
S.melody(mar, 16, V, 98, legato=0.6, accent=acc)
S.melody(steel, 8, H, 90, legato=0.85, accent=acc)
S.melody(kal, 24, BR, 94, legato=0.95, accent=acc)
# second verse: steel drums answer a sixth below on the held notes only (sparse, in key)
for b, d, m, v in [n for n in mar.notes if n[0] >= 64 and n[1] >= 0.55]:
    pcs = [o * 12 + p for o in range(11) for p in sorted(A_MAJ)]
    if m in pcs: steel.add(b, d, pcs[pcs.index(m) - 5], v - 26)

# accompaniment
S.block(pluck, [0.5, 1.5, 2.5, 3.5], midi('E5'), 3, 70, length=0.2, only=lambda b: SEC(b) in ('V', 'V2'))
S.block(pluck, [0, 1.5, 3], midi('A4'), 3, 60, length=0.25, only=lambda b: SEC(b) == 'H')
S.strum(gtr, [(0, 'D', 1.0), (1, 'D', 0.7), (1.5, 'U', 0.6), (2.5, 'U', 0.65), (3, 'D', 0.8), (3.5, 'U', 0.6)], midi('E4'), 4, 68,
        bass=midi('A3'), only=lambda b: SEC(b) in ('H', 'Bb'))
S.pad(strs, midi('A4'), 3, 56, only=lambda b: SEC(b) in ('H', 'Bq'))
S.arp(pluck, midi('C#5'), 1.0, 'up', 3, 54, length=0.3, only=lambda b: SEC(b) == 'Bq')

# bass
S.bassline(bass, midi('E1'), 'root8', 96, only=lambda b: SEC(b) in ('V', 'V2', 'H'))
S.bassline(bass, midi('E1'), 'root2', 86, only=lambda b: SEC(b) == 'Bq')
for b in (30, 31):
    for i in range(8): bass.add(b * 4 + i * 0.5, 0.42, S.bass_root(S.chart[b], midi('E1')) + (12 if i % 2 else 0), 86 + i * 1.5)

# drums
for b in range(32):
    s, t = SEC(b), b * 4
    if s in ('V', 'V2'):
        S.pattern(kit, b, 'x.....x.x.....x.' if b % 2 else 'x.....x.x.......', KICK, 98)
        S.pattern(kit, b, '....x.......x...', SNARE, 84)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', PHAT if s == 'V' else HAT, 54)
    elif s == 'H':
        S.pattern(kit, b, 'x.....x.x.......', KICK, 102)
        S.pattern(kit, b, '....x.......x...', SNARE, 92); S.pattern(kit, b, '....x.......x...', CLAP, 70)
        S.pattern(kit, b, 'xoxoxoxoxoxoxoxo', HAT, 56)
        if b % 2: S.hit(kit, t + 3.5, OHAT, 50)
    elif s == 'Bq':
        S.pattern(kit, b, 'x.......x.......', KICK, 82)
        S.pattern(kit, b, '........x.......', CLAP, 58)
        S.pattern(kit, b, '..x...x...x...x.', CABASA, 48)
    else:
        S.pattern(kit, b, 'x...x...x...x...', KICK, 92 + (b - 30) * 4)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.' if b == 30 else 'xxxxxxxxxxxxxxxx', SNARE, 62 + (b - 30) * 10)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 84)
    if b in (7, 23): S.pattern(kit, b, '............x.xx', SNARE, 76)

# final layer: bubbles, a high celesta arpeggio in 16ths
S.arp(bub, midi('A5'), 0.25, 'updown', 3, 62, length=0.2, only=lambda b: SEC(b) != 'Bq')

for P in list(S.main.values()) + list(S.fin.values()):  # timing jitter must not pull a note in front of its bar line
    P.notes = [(max(b, round(b)) if round(b) - b < 0.02 else b, d, m, v) for b, d, m, v in P.notes]
S.check_key(A_MAJ)
GAIN = {'kit': -19, 'bass': -20, 'pluck': -24.5, 'gtr': -25, 'mar': -18.5, 'steel': -19.5, 'kal': -19, 'str': -27, 'bub': -26}
def limit(x, crest=13.5):
    """look-ahead peak limiter: peaks held to `crest` dB above the signal's integrated loudness"""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    env = maximum_filter1d(np.abs(x).max(1), 441)
    g = uniform_filter1d(np.minimum(1, db(L + crest) / np.maximum(env, 1e-9)), 441)
    return x * np.minimum(g, 1)[:, None]
# marimba, steel drums and plucks pile up around 1 kHz; the top is soft already, so a gentle lift instead of a cut
bus = lambda x: limit(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -3), 'highshelf', 4500, 0.7, 2.5))
print('loop', S.finish(GAIN, bus=bus))
