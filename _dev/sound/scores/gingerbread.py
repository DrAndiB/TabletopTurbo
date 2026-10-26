"""Gingerbread Village: snowy festive waltz in F, 138 bpm, 3/4, 48 bars (A 16, B 16, A 8, quiet bridge 8 with a build).
Celesta tune, harp arpeggios, pizzicato bass with pizzicato 'pah-pah' chords, string pad, sleigh bells, timpani accents.
The bridge gives the tune to the strings. Final lap: a glockenspiel doubles the tune."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('gingerbread', 138, 48, meter=3, seed=5)
A_CH = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Gm7', 'C7', 'F', 'Dm', 'Bb', 'Gm', 'F/C', 'C7', 'F', 'F']
B_CH = ['Bb', 'Bb', 'F', 'F', 'Gm', 'C7', 'F', 'F', 'Bb', 'Bbm', 'F', 'D7', 'Gm7', 'C7', 'F', 'C7']
A2_CH = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Gm7 . C7', 'F']
C_CH = ['Dm', 'Am', 'Bb', 'F', 'Gm', 'Am', 'Bb', 'C7']
S.set_chart(A_CH + B_CH + A2_CH + C_CH)
SEC = lambda b: 'A' if b < 16 else 'B' if b < 32 else 'A2' if b < 40 else 'Cq' if b < 46 else 'Cb'
F_MAJ = {5, 7, 9, 10, 0, 2, 4}
S.scale = F_MAJ

kit = S.part('kit', 0, 9, vol=100, rev=40)
bass = S.part('bass', 45, 0, vol=110, rev=30)            # pizzicato bass
pizz = S.part('pizz', 45, 1, vol=84, pan=80, rev=45)     # pizzicato pah-pah
harp = S.part('harp', 46, 2, vol=90, pan=40, rev=60)
cel = S.part('cel', 8, 3, vol=104, pan=60, rev=60)
strs = S.part('str', 48, 4, vol=80, rev=70)
smel = S.part('smel', 48, 5, vol=96, pan=66, rev=70)     # bridge tune on strings
timp = S.part('timp', 47, 6, vol=96, rev=50)
glock = S.part('glock', 9, 7, final=True, vol=86, pan=76, rev=60)

A = [
    'C5:1 F5:1 A5:1', 'C6:2 A5:1', 'Bb5:1 A5:1 G5:1', 'E5:2 C5:1',
    'F5:1 A5:1 C6:1', 'E6:2 C6:1', 'D6:1 C6:1 Bb5:1', 'G5:2 r:1',
    'A5:1 G5:1 F5:1', 'D6:2 C6:1', 'Bb5:1 D6:1 F6:1', 'D6:2 Bb5:1',
    'A5:1 C6:1 A5:1', 'G5:1 Bb5:1 E5:1', 'F5:3', 'r:1 A4:1 C5:1',
]
B = [
    'D5:2 F5:1', 'Bb5:2 A5:1', 'A5:2 C6:1', 'F5:3',
    'G5:1 Bb5:1 D6:1', 'C6:1 Bb5:1 E5:1', 'G5:2 A5:1', 'F5:2 r:1',
    'D6:2 F6:1', 'Db6:2 Bb5:1', 'C6:1 A5:1 F5:1', 'F#5:2 A5:1',
    'Bb5:1 A5:1 G5:1', 'E5:1 G5:1 C6:1', 'A5:3', 'G5:1 E5:1 C5:1',
]
A2 = A[:7] + ['F5:2 r:1']
C = ['F5:2 A5:1', 'E5:3', 'D5:2 F5:1', 'C5:3', 'D5:1 G5:1 Bb5:1', 'C6:2 A5:1', 'D6:2 Bb5:1', 'C6:1 Bb5:1 G5:1']
for x in A + B + C: assert abs(sum(float(t.split(':')[1]) for t in x.split()) - 3) < 1e-6, x

def waltz_acc(part, bar0, bars, vel, legato):
    """melody with the waltz lilt: beat 1 leans, beat 3 lighter"""
    for i, txt in enumerate(bars):
        t = (bar0 + i) * 3
        for tok in txt.split():
            p, d = tok.split(':'); d = float(d)
            if p != 'r':
                ib = round(t % 3, 3)
                for q in p.split('+'): part.add(t + random.uniform(0, 0.01), d * legato, midi(q), vel + (8 if ib == 0 else -4 if ib == 2 else 0) + random.uniform(-4, 4))
            t += d

waltz_acc(cel, 0, A, 92, 1.0); waltz_acc(cel, 16, B, 94, 1.0); waltz_acc(cel, 32, A2, 94, 1.0)
waltz_acc(smel, 40, C, 84, 0.98)
waltz_acc(glock, 0, A, 80, 1.0); waltz_acc(glock, 16, B, 82, 1.0); waltz_acc(glock, 32, A2, 82, 1.0)
waltz_acc(glock, 44, C[4:], 74, 1.0)

# accompaniment
S.bassline(bass, midi('C2'), 'waltz', 98, only=lambda b: SEC(b) != 'Cq')
S.bassline(bass, midi('C2'), 'root', 80, only=lambda b: SEC(b) == 'Cq')
S.block(pizz, [1, 2], midi('A4'), 3, 64, length=0.4, only=lambda b: SEC(b) in ('A', 'B', 'A2'))
S.arp(harp, midi('F4'), 0.5, 'updown', 4, 66, length=1.2, only=lambda b: SEC(b) in ('A', 'A2', 'Cq', 'Cb'))
S.arp(harp, midi('A4'), 1.0, 'up', 3, 60, length=1.5, only=lambda b: SEC(b) == 'B')
S.pad(strs, midi('A4'), 3, 54, only=lambda b: SEC(b) == 'B', bass=midi('F3'))
S.pad(strs, midi('F4'), 3, 50, only=lambda b: SEC(b) in ('Cq', 'Cb'))

# timpani: a stroke at each section top, a roll through the last bar into the loop
for b in (0, 16, 32):
    S.hit(timp, b * 3, S.bass_root(S.chart[b], midi('F2')), 92, dur=1.5)
for b in (8, 24):
    S.hit(timp, b * 3, S.bass_root(S.chart[b], midi('F2')), 80, dur=1.5)
for j in range(12): S.hit(timp, 47 * 3 + j * 0.25, midi('C3'), 58 + j * 3, dur=0.3)

# sleigh bells and a light kick on the downbeat
for b in range(48):
    s, t = SEC(b), b * 3
    if s in ('A', 'A2'):
        S.pattern(kit, b, 'x.o.o.', JINGLE, 70, sub=2)
        S.pattern(kit, b, 'x.....', KICK, 82, sub=2)
    elif s == 'B':
        S.pattern(kit, b, 'xoxoxo', JINGLE, 72, sub=2)
        S.pattern(kit, b, 'x.....', KICK, 88, sub=2)
        S.pattern(kit, b, '..x.x.', TAMB, 50, sub=2)
    elif s == 'Cq':
        S.pattern(kit, b, 'x.....', JINGLE, 58, sub=2)
        if b % 2: S.hit(kit, t + 2, TRI_O, 56)
    else:
        S.pattern(kit, b, 'xoxoxo' if b == 46 else 'xxxxxxxxxxxx', JINGLE, 62 + (b - 46) * 8, sub=2 if b == 46 else 4)
        S.pattern(kit, b, 'x.x.x.', KICK, 78 + (b - 46) * 6, sub=2)
    if b in (0, 16, 32): S.hit(kit, t, CRASH, 62)

S.check_key(F_MAJ)
GAIN = {'kit': -21, 'bass': -20, 'pizz': -25, 'harp': -24, 'cel': -18.5, 'str': -27, 'smel': -19, 'timp': -25, 'glock': -24.5}
# celesta and harp gather around 1 kHz: ease that, keep the default top cut a little lighter, and catch the bell/timpani peaks
def limit(x, crest=13.5):
    """look-ahead peak limiter: peaks held to `crest` dB above the signal's integrated loudness"""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    env = maximum_filter1d(np.abs(x).max(1), 441)
    g = np.minimum(1, db(L + crest) / np.maximum(env, 1e-9))
    g = uniform_filter1d(g, 441)
    return x * np.minimum(g, 1)[:, None]
bus = lambda x: limit(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -2.5), 'peak', 3800, 0.9, -3.5), 'highshelf', 6000, 0.7, -2))
print('loop', S.finish(GAIN, bus=bus))
