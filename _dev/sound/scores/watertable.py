"""Water table, "Splash Lagoon Regatta": calypso in C, 112 bpm, 28 bars (A verse | B chorus | A' | C break + build).
Steel pan lead (A, B), clarinet takes the tune in A' with soft pan rolls under it, high steel-string off-beat strum
(ukulele role), bouncy bass, congas/bongos/shaker. Final layer: a second steel pan counter-line + light cabasa."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('watertable', 112, 28, seed=5)
A_CH = ['C', 'C', 'F', 'G7', 'C', 'Am', 'Dm7 G7', 'C']
B_CH = ['F', 'G7', 'C', 'Am', 'Dm7', 'G7', 'C', 'G7']
C_CH = ['F', 'C', 'Dm7', 'G7']
S.set_chart(A_CH + B_CH + A_CH + C_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'A2' if b < 24 else 'C'
CMAJ = {0, 2, 4, 5, 7, 9, 11}
S.scale = CMAJ

kit = S.part('kit', 0, 9, vol=110, rev=25)
bass = S.part('bass', 33, 0, vol=108, rev=10)
gtr = S.part('gtr', 25, 1, vol=84, pan=42, rev=40, cho=30)
pan = S.part('pan', 114, 2, vol=100, pan=70, rev=50)
clar = S.part('clar', 71, 3, vol=100, pan=62, rev=50)
mar = S.part('mar', 12, 4, vol=88, pan=88, rev=40)
roll = S.part('roll', 114, 5, vol=80, pan=50, rev=60)
fpan = S.part('fpan', 114, 6, final=True, vol=96, pan=36, rev=50)
fperc = S.part('fperc', 0, 9, final=True, vol=100, rev=20)

A_MEL = [
    'E5:0.5 G5:0.5 r:0.5 C6:1 A5:0.5 G5:1',
    'E5:0.5 D5:0.5 C5:1 r:1 G4:0.5 C5:0.5',
    'F5:0.5 A5:0.5 r:0.5 C6:1 A5:0.5 F5:1',
    'G5:1.5 F5:0.5 D5:1 B4:1',
    'E5:0.5 G5:0.5 r:0.5 C6:1 D6:0.5 C6:1',
    'A5:0.5 G5:0.5 E5:1 r:1 E5:0.5 G5:0.5',
    'F5:0.5 A5:0.5 F5:0.5 D5:0.5 B4:0.5 D5:0.5 G5:0.5 F5:0.5',
    'E5:1.5 D5:0.5 C5:1 r:1',
]
B_MEL = [
    'A5:1 A5:0.5 C6:1 A5:0.5 G5:0.5 F5:0.5',
    'G5:1 G5:0.5 B5:1 G5:0.5 F5:0.5 D5:0.5',
    'E5:0.5 G5:1 C6:1 G5:0.5 E5:1',
    'A5:1.5 G5:0.5 E5:1 C5:1',
    'D5:0.5 F5:0.5 A5:1 C6:1 A5:0.5 F5:0.5',
    'B5:1.5 A5:0.5 G5:1 F5:1',
    'E5:0.5 C5:0.5 E5:0.5 G5:1 C6:1.5',
    'B5:1 A5:0.5 G5:0.5 F5:1 D5:1',
]
acc = lambda b: 8 if b in (0, 1.5, 2.5) else 0
S.melody(pan, 0, A_MEL, 92, legato=0.9, accent=acc)
S.melody(pan, 8, B_MEL, 96, legato=0.9, accent=acc)
S.melody(clar, 16, A_MEL[:7] + ['E5:1.5 D5:0.5 C5:1.5 r:0.5'], 88, legato=0.88, accent=acc)
S.arp(roll, midi('E5'), 0.5, 'updown', 3, 58, length=0.45, only=lambda b: SEC(b) == 'A2')
# break: the pan holds soft rolled chords, then a pickup into the top
for b in range(24, 27):
    for t, d, sym in [c for c in S.chords if int(c[0] // 4) == b]:
        for k in range(int(d * 4)):
            for m in voicing(sym, midi('G5'), 3)[k % 2::2]: roll.add(t + k * 0.25, 0.3, m, 50 + (k % 4 == 0) * 8)
S.melody(pan, 27, ['r:2 G4:0.5 A4:0.5 B4:0.5 D5:0.5'], 86)

# final layer: a second pan answering and filling the gaps
CA = ['G4:1.5 C5:1.5 E5:1', 'r:2 G5:0.5 E5:0.5 r:1', 'A4:1.5 C5:1.5 F5:1', 'r:2 B4:0.5 D5:0.5 F5:1',
      'G4:1.5 C5:1.5 E5:1', 'r:2 C6:0.5 A5:0.5 r:1', 'A4:2 B4:2', 'r:3 E5:0.5 G5:0.5']
CB = ['F4:1.5 A4:1.5 C5:1', 'G4:1.5 B4:1.5 D5:1', 'E4:1.5 G4:1.5 C5:1', 'r:2 C5:0.5 E5:0.5 A5:1',
      'F4:1.5 A4:1.5 D5:1', 'G4:1.5 B4:1.5 D5:1', 'C5:1.5 E5:1.5 G5:1', 'r:2 D5:0.5 F5:0.5 G5:1']
CC = ['A4:2 C5:2', 'G4:2 E5:2', 'F4:2 A4:2', 'B4:2 r:2']
S.melody(fpan, 0, CA, 76, legato=0.9)
S.melody(fpan, 8, CB, 76, legato=0.9)
S.melody(fpan, 16, CA, 80, legato=0.9)
S.melody(fpan, 24, CC, 70, legato=0.95)

# ukulele-style off-beat strum, high voicing; marimba off-beat double-stops in the chorus
UKE = [(0, 'D', 0.5), (0.5, 'U', 0.9), (1.5, 'U', 0.8), (2, 'D', 0.5), (2.5, 'U', 0.9), (3.5, 'U', 0.8)]
S.strum(gtr, UKE, midi('A4'), 4, 70, spread=0.012, length=0.24, only=lambda b: SEC(b) != 'C')
S.strum(gtr, [(0, 'D', 0.7)], midi('A4'), 4, 60, length=1.8, only=lambda b: SEC(b) == 'C' and b < 27)
S.block(mar, [0.5, 1.5, 2.5, 3.5], midi('E5'), 2, 70, length=0.2, only=lambda b: SEC(b) in ('B', 'A2'))

# calypso bass: boom (1), bounce on the &2, fifth on 3, octave + step into the next chord
ch = S.chords
for k, (t, d, sym) in enumerate(ch):
    bar = int(t // 4); s = SEC(bar)
    r = S.bass_root(sym, midi('E1')); nx = S.bass_root(ch[(k + 1) % len(ch)][2], midi('E1'))
    fifth = r + 7
    app = next((a for a in (nx - 1, nx + 2, nx - 2, nx + 1) if a % 12 in CMAJ), nx)
    if s == 'C' and bar < 27:
        bass.add(t, 1.4, r, 94); bass.add(t + 1.5, 0.4, r, 74); bass.add(t + 2, 1.8, fifth, 84); continue
    if s == 'C':
        for j in range(8): bass.add(t + j * 0.5, 0.4, [r, r, fifth, fifth, r + 12, r + 12, fifth, app][j], 80 + j * 3)
        continue
    pat = [(0, r, 1.0, 100), (1.5, r, 0.4, 84), (2, fifth, 0.9, 92), (3, r + 12, 0.4, 82), (3.5, app, 0.4, 80)] if d >= 4 else \
          [(0, r, 1.0, 98), (1.5, app, 0.4, 82)]
    for b_, m, L, v in pat: bass.add(t + b_, L, m, v + random.uniform(-4, 4))

# percussion
for b in range(28):
    s, t = SEC(b), b * 4
    if s != 'C' or b == 27:
        S.pattern(kit, b, 'x.......x.......', KICK, 92)
    if s == 'C' and b < 27:
        S.pattern(kit, b, 'x.....x.........', KICK, 78)
        S.pattern(kit, b, 'x.....x...x.x...', CONGA_L, 74); S.pattern(kit, b, '....x.......x..x', CONGA_H, 70)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', MARACAS, 52)
        continue
    if b == 27:
        for j in range(16): S.hit(kit, t + j * 0.25, [BONGO_H, BONGO_L][j % 2] if j < 8 else [TIMB_H, TIMB_L][j % 2], 62 + j * 3)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', MARACAS, 60)
        continue
    S.pattern(kit, b, 'x.....x...x.x...', CONGA_L, 82)
    S.pattern(kit, b, '..o.x...o...x..x', CONGA_H, 78)
    S.pattern(kit, b, 'o.......o.......', CONGA_M, 70)
    S.pattern(kit, b, 'xoxoxoxoxoxoxoxo', SHAKER, 54)
    if s in ('B', 'A2'): S.pattern(kit, b, '....x.......x...', STICK, 76)
    if s == 'B': S.pattern(kit, b, '..x...x...x...x.', COWBELL, 40)
    if b in (7, 15, 23): S.pattern(kit, b, '........x.x.xxxx', BONGO_H, 70)
    if b in (0, 8, 16): S.hit(kit, t, CRASH, 70 if b else 76)

# final layer percussion: cabasa 16ths (off in the break's first bars)
for b in range(28):
    if SEC(b) == 'C' and b < 27: continue
    S.pattern(fperc, b, 'x.o.x.o.x.o.x.o.'.replace('.', 'o'), CABASA, 58)

S.check_key(CMAJ)
GAIN = {'kit': -19, 'bass': -20, 'gtr': -23.5, 'pan': -18.5, 'clar': -19, 'mar': -26, 'roll': -27, 'fpan': -24, 'fperc': -26}
# steel pans sit forward around 2 kHz: an extra dip there
bus = lambda x: comp(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 2100, 0.8, -3.5), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3), thr=-10, ratio=6, att=0.0005, rel=0.06)
print('loop', S.finish(GAIN, bus=bus))
