"""Mars, "Mars Rover Run": spacey minor groove in D minor, 96 bpm, 24 bars (A | B quiet choir bridge + build | A').
Ocarina lead (near-sine, the theremin role) with long notes, soft sawtooth plucks arpeggiating the chords, warm pad,
synth sub bass on a D pedal in A, chord roots in B, sparse 808 kit in half-time. Final layer: a higher 16th-note
celesta arpeggio and a soft open-hat pulse."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *
import mus
mus.QUAL.setdefault('7sus4', (0, 5, 7, 10))

S = Song('mars', 96, 24, seed=4, tail=4.0)
A_CH = ['Dm', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'Gm', 'A']
B_CH = ['F', 'C', 'Gm', 'Dm', 'Bb', 'F', 'Gm', 'A7sus4']
S.set_chart(A_CH + B_CH + A_CH)
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'A2'
DMIN = {2, 4, 5, 7, 9, 10, 0}   # natural minor; the C# only appears as the A chord's third
S.scale = DMIN

kit = S.part('kit', 25, 9, vol=104, rev=40)
sub = S.part('sub', 38, 0, vol=104, rev=10)
arp = S.part('arp', 81, 1, vol=70, pan=40, rev=60, cho=50)
pad = S.part('pad', 89, 2, vol=84, rev=80, cho=40)
lead = S.part('lead', 79, 3, vol=100, pan=64, rev=80)
choir = S.part('choir', 52, 4, vol=92, pan=70, rev=85)
farp = S.part('farp', 8, 5, final=True, vol=88, pan=90, rev=70)
fkit = S.part('fkit', 25, 9, final=True, vol=96, rev=40)

A_MEL = ['A4:1.5 D5:0.5 F5:2', 'F5:1.5 E5:0.5 D5:2', 'E5:2 G5:2', 'A5:2.5 G5:0.5 E5:1',
         'A4:1.5 D5:0.5 F5:1 A5:1', 'Bb5:2 A5:1 F5:1', 'G5:1.5 F5:0.5 D5:1 Bb4:1', 'C#5:3 E5:1']
A2_END = ['G5:1.5 A5:0.5 Bb5:1 D6:1', 'E5:2 C#5:1 r:1']
B_CHOIR = ['A4:4', 'G4:4', 'Bb4:2 D5:2', 'A4:4', 'D5:2 F5:2', 'C5:2 A4:2', 'Bb4:2 D5:2', 'E5:2 D5:2']
S.melody(lead, 0, A_MEL, 92, legato=0.98, hum=0.2)
S.melody(lead, 16, A_MEL[:6] + A2_END, 94, legato=0.98, hum=0.2)
S.melody(choir, 8, B_CHOIR, 80, legato=1.0, hum=0.1)
# in A' the choir hums the chord softly under the lead
S.pad(choir, midi('D4'), 2, 52, only=lambda b: SEC(b) == 'A2')
# a few lead echoes in the bridge's gaps
S.melody(lead, 9, ['r:2 D6:1 C6:1'], 64, legato=0.95)
S.melody(lead, 13, ['r:2 F5:1 A5:1'], 64, legato=0.95)

# plucked arpeggios: 8ths, thinner in the bridge, 16ths in the build
S.arp(arp, midi('D4'), 0.5, 'updown', 3, 62, length=0.22, only=lambda b: SEC(b) == 'A')
S.arp(arp, midi('F4'), 0.5, 'up', 3, 66, length=0.22, span=2, only=lambda b: SEC(b) == 'A2')
S.arp(arp, midi('D4'), 1.0, 'up', 3, 56, length=0.3, only=lambda b: SEC(b) == 'B' and b < 14)
S.arp(arp, midi('D4'), 0.25, 'up', 3, 54, length=0.16, span=2, only=lambda b: b in (14, 15))
S.pad(pad, midi('F4'), 3, 58)

# sub bass: D pedal pulses in A / A', chord roots held in the bridge, pulsing 8ths in the build
D2 = midi('D2')
for t, d, sym in S.chords:
    bar = int(t // 4); s = SEC(bar); r = S.bass_root(sym, midi('A1'))
    if s == 'B':
        if bar < 14: sub.add(t, 3.9, r, 96)
        else:
            for j in range(8): sub.add(t + j * 0.5, 0.4, r, 84 + j * 2)
        continue
    root = D2 if bar % 8 < 6 else r      # pedal, then the roots of the Gm - A turnaround
    for b_, L, m, v in [(0, 1.4, root, 100), (1.5, 0.4, root, 80), (2.5, 0.4, root + 12, 76), (3, 0.9, root, 88)]:
        sub.add(t + b_, L, m, v + random.uniform(-3, 3))

# sparse half-time 808 kit
for b in range(24):
    s, t = SEC(b), b * 4
    if s == 'B' and b < 14:
        S.pattern(kit, b, 'x...............', KICK, 84)
        S.pattern(kit, b, 'x...x...x...x...', HAT, 46)
        if b % 2: S.hit(kit, t + 3.5, 75, 54)  # claves blip
        continue
    if s == 'B':
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', KICK, 80 + (b - 14) * 8)
        S.pattern(kit, b, '........x.x.xxxx' if b == 15 else '........x.......', SNARE, 70 + (b - 14) * 10)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.', HAT, 52)
        continue
    S.pattern(kit, b, 'x.........x.....', KICK, 96)
    S.pattern(kit, b, '........x.......', CLAP if s == 'A2' else SNARE, 86)
    S.pattern(kit, b, 'x.x.x.x.x.x.x.xo', HAT, 50)
    if b % 4 == 3: S.pattern(kit, b, '..............x.', OHAT, 54)
    if b in (0, 16): S.hit(kit, t, CRASH, 70)

# final layer: high celesta arpeggio in 16ths + open-hat off-beats
S.arp(farp, midi('A5'), 0.25, 'updown', 3, 58, length=0.2, only=lambda b: not (SEC(b) == 'B' and b < 12))
S.arp(farp, midi('A5'), 0.5, 'up', 3, 48, length=0.4, only=lambda b: SEC(b) == 'B' and b < 12)
for b in range(24):
    S.pattern(fkit, b, '..x...x...x...x.' if not (SEC(b) == 'B' and b < 14) else '......x.......x.', OHAT, 50)
    S.pattern(fkit, b, 'oxoxoxoxoxoxoxox', SHAKER, 44)

def snap(P):
    P.notes = [((g + (g - b)) if 0 < g - b < 0.02 else b, d, m, v) for b, d, m, v in P.notes for g in [round(b)]]
for P in (lead, choir): snap(P)

S.check_key(DMIN)
GAIN = {'kit': -20, 'sub': -20, 'arp': -24.5, 'pad': -25, 'lead': -18.5, 'choir': -20.5, 'farp': -25, 'fkit': -27}
# the near-sine lead piles up around 1 kHz and the palette is dark: dip 1 kHz, no top cut
bus = lambda x: comp(eq(eq(comp(eq(x, 'highpass', 30), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -2.5), 'peak', 3000, 0.8, 2), thr=-10, ratio=6, att=0.0005, rel=0.06)
print('loop', S.finish(GAIN, bus=bus))
