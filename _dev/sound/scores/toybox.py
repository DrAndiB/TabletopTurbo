"""Toy Box Mayhem: a toy-soldier march in C, 132 bpm, 32 bars (A, B, A, quieter trio-style bridge with a snare build).
Music-box tune in A, clarinet tune in B, celesta in the bridge; xylophone arpeggios, tuba oom-pah, piano 'pah' chords,
marching snare and bass drum. Final lap: a piccolo doubles the tune, plus a ticking woodblock."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('toybox', 132, 32, seed=9)
A_CH = ['C', 'G', 'C', 'F', 'C', 'Am', 'D7 G7', 'C']
B_CH = ['F', 'C', 'G7', 'C', 'F', 'C', 'D7', 'G7']
C_CH = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm7', 'G7']
S.set_chart(A_CH + B_CH + A_CH + C_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'A2' if b < 24 else 'Cq' if b < 30 else 'Cb'
C_MAJ = {0, 2, 4, 5, 7, 9, 11}
S.scale = C_MAJ

kit = S.part('kit', 0, 9, vol=108, rev=30)
tuba = S.part('tuba', 58, 0, vol=110, rev=20)
pno = S.part('pno', 0, 1, vol=80, pan=78, rev=35)
xylo = S.part('xylo', 13, 2, vol=88, pan=40, rev=45)
mbox = S.part('mbox', 10, 3, vol=104, pan=60, rev=50)
clar = S.part('clar', 71, 4, vol=100, pan=64, rev=45)
cel = S.part('cel', 8, 5, vol=100, pan=58, rev=60)
horn = S.part('horn', 60, 6, vol=80, pan=50, rev=60)     # soft french horn pad in B and the bridge
picc = S.part('picc', 72, 7, final=True, vol=88, pan=72, rev=50)
fkit = S.part('fkit', 0, 9, final=True, vol=96, rev=25)

A = [
    'G5:0.75 G5:0.25 E5:0.5 G5:0.5 C6:1 G5:1',
    'B5:0.75 A5:0.25 G5:0.5 F5:0.5 D5:2',
    'E5:0.5 G5:0.5 C6:0.5 E6:0.5 D6:1 C6:1',
    'A5:1.5 C6:0.5 F5:2',
    'G5:0.75 G5:0.25 E5:0.5 G5:0.5 C6:1 E6:1',
    'E6:0.5 D6:0.5 C6:0.5 B5:0.5 A5:2',
    'F#5:0.5 A5:0.5 D6:1 B5:0.5 G5:0.5 F5:1',
    'E5:1 C5:1 r:1 C5:0.5 E5:0.5',
]
B = [
    'F5:1 A5:1 C6:1.5 A5:0.5',
    'G5:1 E5:1 C5:2',
    'D5:0.5 F5:0.5 B5:0.5 D6:0.5 C6:1 B5:1',
    'C6:1.5 G5:0.5 E5:2',
    'A5:0.5 C6:0.5 F6:1 E6:0.5 D6:0.5 C6:1',
    'E6:1 C6:1 G5:2',
    'F#5:1 A5:1 C6:1 D6:1',
    'B5:1 G5:1 D5:1 r:1',
]
C = [
    'E5:1.5 A5:0.5 C6:2',
    'A5:1.5 F5:0.5 C5:2',
    'E5:1 G5:1 C6:1 E6:1',
    'D6:3 r:1',
    'C6:1.5 B5:0.5 A5:2',
    'A5:1 C6:1 F6:2',
    'F6:1 E6:1 D6:1 C6:1',
    'B5:2 G5:1 r:1',
]
for x in A + B + C: assert abs(sum(float(t.split(':')[1]) for t in x.split()) - 4) < 1e-6, x
acc = lambda b: 10 if b == 0 else 5 if b == 2 else 0
S.melody(mbox, 0, A, 94, legato=0.7, accent=acc)
S.melody(clar, 8, B, 90, legato=0.8, accent=acc)
S.melody(mbox, 16, A, 96, legato=0.7, accent=acc)
S.melody(cel, 24, C, 88, legato=0.95, accent=acc)
for b0, tune in ((0, A), (8, B), (16, A)):
    S.melody(picc, b0, tune, 82, legato=0.75, accent=acc)
S.melody(picc, 28, C[4:], 76, legato=0.9)

# second A: the clarinet adds a third below the music box (not over the D7, where it would clash with F#)
for b, d, m, v in [n for n in mbox.notes if n[0] >= 64]:
    pcs = [o * 12 + p for o in range(11) for p in sorted(C_MAJ)]
    if m in pcs and S.chord_at(b + 0.01) != 'D7': clar.add(b, d, pcs[pcs.index(m) - 2], v - 24)

# accompaniment
S.bassline(tuba, midi('E1'), 'oompah', 100, only=lambda b: SEC(b) in ('A', 'B', 'A2', 'Cb'))
S.bassline(tuba, midi('E1'), 'root2', 84, only=lambda b: SEC(b) == 'Cq')
S.block(pno, [1, 3], midi('G4'), 3, 66, length=0.3, only=lambda b: SEC(b) in ('A', 'B', 'A2'))
S.block(pno, [1, 3], midi('G4'), 3, 56, length=0.3, only=lambda b: SEC(b) == 'Cb')
S.arp(xylo, midi('E5'), 0.5, 'updown', 3, 66, length=0.3, only=lambda b: SEC(b) in ('A', 'A2'))
S.arp(xylo, midi('G5'), 1.0, 'up', 3, 62, length=0.3, only=lambda b: SEC(b) == 'B')
S.arp(xylo, midi('C5'), 1.0, 'alberti', 3, 54, length=0.3, only=lambda b: SEC(b) == 'Cq')
S.pad(horn, midi('E4'), 3, 58, only=lambda b: SEC(b) in ('B', 'Cq'))

# marching drums
for b in range(32):
    s, t = SEC(b), b * 4
    if s in ('A', 'A2'):
        S.pattern(kit, b, 'x.......x.......', KICK, 100)
        S.pattern(kit, b, '....x..ox...x.xx' if b % 2 else '....x.......x...', SNARE, 88)
    elif s == 'B':
        S.pattern(kit, b, 'x.......x.......', KICK, 102)
        S.pattern(kit, b, 'x..ox..ox..ox.xx', SNARE, 80)
        S.pattern(kit, b, '....x.......x...', CRASH2 if b == 8 else HAT, 40 if b == 8 else 52)
    elif s == 'Cq':
        S.pattern(kit, b, 'x...............', KICK, 86)
        S.pattern(kit, b, '....x.......x...', STICK, 70)
    else:
        S.pattern(kit, b, 'x...x...x...x...', KICK, 92 + (b - 30) * 4)
        if b == 30: S.pattern(kit, b, 'x.x.x.x.x.x.xxxx', SNARE, 76)
        else:
            for j in range(16): S.hit(kit, t + j * 0.25, SNARE, 52 + j * 3.5)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 84)

# final layer: woodblock ticking on the off-beats (rests in the quiet half of the bridge)
for b in range(32):
    if SEC(b) == 'Cq': continue
    S.pattern(fkit, b, '..x...x...x...x.', WOOD_H, 70)
    S.pattern(fkit, b, 'x.......x.......', WOOD_L, 60)

for P in list(S.main.values()) + list(S.fin.values()):  # timing jitter must not pull a note in front of its bar line
    P.notes = [(max(b, round(b)) if round(b) - b < 0.02 else b, d, m, v) for b, d, m, v in P.notes]
S.check_key(C_MAJ)
GAIN = {'kit': -19, 'tuba': -20, 'pno': -25, 'xylo': -24.5, 'mbox': -18.5, 'clar': -19, 'cel': -19, 'horn': -27,
        'picc': -25, 'fkit': -27}
def limit(x, crest=13.5):
    """look-ahead peak limiter: peaks held to `crest` dB above the signal's integrated loudness"""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    env = maximum_filter1d(np.abs(x).max(1), 441)
    g = uniform_filter1d(np.minimum(1, db(L + crest) / np.maximum(env, 1e-9)), 441)
    return x * np.minimum(g, 1)[:, None]
# tuba, clarinet and music box crowd 700-1500 Hz; the top is already soft, so no high cut here
bus = lambda x: limit(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -3), 'highshelf', 4500, 0.7, 2))
print('loop', S.finish(GAIN, bus=bus))
