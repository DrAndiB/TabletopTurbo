"""Pinball table, "Pinball Wizard": fast arcade drive in A minor, 156 bpm, 40 bars (A, B, C, A', B'), loops seamlessly.
A: the hook on a soft square lead doubled by clavinet, 16th-note electric-piano arpeggios, synth bass 8ths, power kit.
B: an answering tune on synth brass (clavinet still doubling); C: a quieter bridge, vibraphone tune over a pad and
half-time drums, building over its last two bars; A'/B': the top again with overdriven-guitar stabs added; B' ends on E7.
Final lap: a saw-lead harmony line under the hook and the B tune (chord tones, a third/fourth below) + shaker 16ths,
tambourine and agogo "bumper" pings."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *

S = Song('pinball', 156, 40, seed=21)
A_CH = ['Am', 'F', 'G', 'E', 'Am', 'F', 'G E', 'Am']
B_CH = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E7']
C_CH = ['Dm', 'E', 'Am', 'F', 'Dm', 'E', 'Am', 'E7']
S.set_chart(A_CH + B_CH + C_CH + A_CH + B_CH)
SEC = lambda b: ['A1', 'B1', 'C', 'A2', 'B2'][b // 8]
A_MIN = {9, 11, 0, 2, 4, 5, 7, 8}  # natural minor + the raised 7th (G#) of the E chords
S.scale = A_MIN


def mel(part, start_bar, bars, vel=88, legato=0.92, accent=None, meter=4):
    """like S.melody, but the timing slop only ever lands late, so no note starts before its chord"""
    for i, txt in enumerate(bars):
        beat = (start_bar + i) * meter
        for tok in txt.split():
            p, d = tok.split(':'); d = float(d)
            if p != 'r':
                for q in p.split('+'):
                    part.add(beat + random.uniform(0, 0.012), d * legato, midi(q), vel + (accent(beat % meter) if accent else 0) + random.uniform(-3, 3))
            beat += d
        assert abs(beat - (start_bar + i + 1) * meter) < 1e-9, (part.name, start_bar + i, txt)


def limit(x, over=12.0):
    """lookahead peak limiter: peaks held to `over` dB above the signal's own integrated loudness"""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    c = db(L + over); w = int(0.004 * SR)
    pk = maximum_filter1d(np.abs(x).max(1), 2 * w + 1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    g = uniform_filter1d(minimum_filter1d(g, int(0.04 * SR)), int(0.03 * SR))
    return x * g[:, None]


def harm(src, dst, vel=-10):
    """a harmony under src: the nearest chord tone 3-5 semitones below, else a third below in the key"""
    for b, d, m, v in src.notes:
        root, iv = chord(S.chord_at(b % S.end).split('/')[0]); pcs = {(root + x) % 12 for x in iv}
        h = next((m - k for k in (3, 4, 5) if (m - k) % 12 in pcs), None)
        if h is None: h = next(m - k for k in (3, 4) if (m - k) % 12 in A_MIN - {8})
        dst.add(b, d, h, v + vel)


kit = S.part('kit', 16, 9, vol=110, rev=18)                 # power kit
bass = S.part('bass', 38, 0, vol=104, rev=8)                # synth bass 1
arp = S.part('arp', 5, 1, vol=80, pan=84, rev=40, cho=30)   # electric piano 2, 16ths
lead = S.part('lead', 80, 2, vol=78, pan=60, rev=45, cho=20)  # square lead, kept soft
clav = S.part('clav', 7, 3, vol=92, pan=70, rev=30)         # clavinet doubling the tunes
brass = S.part('brass', 62, 4, vol=90, pan=56, rev=45)      # synth brass: the B tune
vibes = S.part('vibes', 11, 5, vol=96, pan=60, rev=65)      # bridge tune
pad = S.part('pad', 89, 6, vol=80, rev=70)                  # warm pad
gtr = S.part('gtr', 29, 7, vol=80, pan=36, rev=25)          # overdriven guitar stabs in A'/B'
fharm = S.part('fharm', 81, 8, final=True, vol=72, pan=44, rev=45)
fperc = S.part('fperc', 0, 9, final=True, vol=100, rev=20)

HOOK = [
    'A4:0.5 C5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 C5:0.5',
    'F5:1 A5:0.5 C6:1 A5:0.5 F5:1',
    'G5:0.5 B5:0.5 D6:0.5 B5:0.5 G5:0.5 D5:0.5 B4:0.5 D5:0.5',
    'E5:1.5 G#5:0.5 B5:1 r:1',
    'A4:0.5 C5:0.5 E5:0.5 A5:1 B5:0.5 C6:0.5 E6:0.5',
    'F6:1 E6:0.5 C6:0.5 A5:1 C6:1',
    'B5:0.5 D6:0.5 B5:0.5 G5:0.5 G#5:0.5 B5:0.5 E6:0.5 D6:0.5',
    'C6:0.5 B5:0.5 A5:2 r:1',
]
BTUNE = [
    'r:0.5 C5:0.5 F5:0.5 A5:0.5 C6:1.5 A5:0.5',
    'B5:1 A5:0.5 G5:0.5 D5:1.5 G5:0.5',
    'E5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 E5:1',
    'C5:1.5 E5:0.5 A5:2',
    'r:0.5 A4:0.5 D5:0.5 F5:0.5 A5:1.5 F5:0.5',
    'G5:1 B5:0.5 D6:0.5 B5:1.5 G5:0.5',
    'E5:0.5 G5:0.5 C6:1 E6:1 D6:0.5 C6:0.5',
    'B5:1.5 G#5:0.5 E5:0.5 D5:0.5 B4:0.5 G#4:0.5',
]
BRIDGE = [
    'F5:2 A5:2', 'G#5:2 B5:1 E5:1', 'A5:3 C6:1', 'C6:2 A5:2',
    'D6:2 F5:2', 'E5:1 G#5:1 B5:2', 'C6:2 E6:2', 'D6:1 B5:1 G#5:1 E5:1',
]
acc = lambda b: 8 if b in (0, 2) else 0
for b0 in (0, 24):
    mel(lead, b0, HOOK, 84, legato=0.85, accent=acc)
    mel(clav, b0, HOOK, 86, legato=0.6, accent=acc)
for b0 in (8, 32):
    mel(brass, b0, BTUNE, 88, legato=0.85, accent=acc)
    mel(clav, b0, BTUNE, 80, legato=0.6, accent=acc)
mel(vibes, 16, BRIDGE, 86, legato=1.0)
harm(lead, fharm, -6); harm(brass, fharm, -6)

# arpeggios: 16ths at the top, 8ths in the quiet half of the bridge, 16ths again for the build
S.arp(arp, midi('A4'), 0.25, 'updown', 3, 66, length=0.2, only=lambda b: SEC(b) != 'C' or b >= 22)
S.arp(arp, midi('A4'), 0.5, 'up', 3, 56, length=0.4, only=lambda b: SEC(b) == 'C' and b < 22)
S.pad(pad, midi('A4'), 3, 58, only=lambda b: SEC(b) == 'C')
S.pad(pad, midi('A4'), 3, 44, only=lambda b: SEC(b) in ('B1', 'B2'))
for t, d, sym in S.chords:  # power-chord stabs (root, fifth, octave) on 1 and the and-of-2 in the second half
    if SEC(int(t // 4)) not in ('A2', 'B2'): continue
    r = S.bass_root(sym, midi('E3'))
    for b in (0, 1.5, 3) if d >= 4 else (0,):
        for m in (r, r + 7, r + 12): gtr.add(t + b + random.uniform(0, 0.006), 0.35 if b else 0.6, m, 84 if b == 0 else 74)

# bass: driving 8ths, long notes in the bridge, pulsing 8ths into the build
S.bassline(bass, midi('E1'), 'root8', 100, only=lambda b: SEC(b) != 'C')
S.bassline(bass, midi('E1'), 'root', 92, only=lambda b: SEC(b) == 'C' and b < 22)
for b in (22, 23):
    for t, d, sym in S.chords:
        if int(t // 4) == b:
            for i in range(int(d * 2)): bass.add(t + i * 0.5, 0.42, S.bass_root(sym, midi('E1')) + (12 if i % 2 else 0), 86 + (b - 22) * 6 + i)

# drums
for b in range(40):
    s, t = SEC(b), b * 4
    if s == 'C' and b < 22:
        S.pattern(kit, b, 'x.........x.....', KICK, 86)
        S.pattern(kit, b, '........x.......', STICK, 74)
        S.pattern(kit, b, 'x...x...x...x...', HAT, 50)
        continue
    if s == 'C':
        S.pattern(kit, b, 'x...x...x...x...', KICK, 90 + (b - 22) * 6)
        S.pattern(kit, b, 'x.x.x.x.x.x.x.x.' if b == 22 else 'xxxxxxxxxxxxxxxx', SNARE, 60 + (b - 22) * 14, acc=4)
        continue
    S.pattern(kit, b, 'x.....x.x.....x.' if s[0] == 'A' else 'x.....x...x.....', KICK, 104)
    S.pattern(kit, b, '....x.......x...', SNARE, 100)
    S.pattern(kit, b, 'x.x.x.x.x.x.x.xo' if s[0] == 'A' else 'x.x.x.x.x.x.x.x.', HAT if b % 4 != 3 else OHAT, 62)
    if s[0] == 'B': S.pattern(kit, b, 'x...x...x...x...', RIDE, 52)
    if b % 8 == 7: S.pattern(kit, b, '............x.xx', SNARE, 84)
    if b % 8 == 0: S.hit(kit, t, CRASH, 96 if b in (0, 24) else 84)

# final layer percussion: shaker 16ths, tambourine on 2 and 4, agogo "bumper" pings at the phrase ends
for b in range(40):
    if SEC(b) == 'C' and b < 22: S.pattern(fperc, b, 'x.x.x.x.x.x.x.x.', SHAKER, 52); continue
    S.pattern(fperc, b, 'xoxoxoxoxoxoxoxo', SHAKER, 60, acc=4)
    S.pattern(fperc, b, '....x.......x...', TAMB, 66)
    if b % 4 == 3: S.pattern(fperc, b, '........x.x.x...', AGOGO_H if b % 8 == 3 else AGOGO_L, 64)

S.check_key(A_MIN)
GAIN = {'kit': -19, 'bass': -20, 'arp': -26.5, 'lead': -20.5, 'clav': -22.5, 'brass': -19.5, 'vibes': -19.5, 'pad': -28,
        'gtr': -26, 'fharm': -25, 'fperc': -25.5}
bus = lambda x: limit(eq(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 2200, 0.9, -1.5), 'peak', 3500, 1.0, -2.5), 'highshelf', 5000, 0.7, -3))
print('loop', S.finish(GAIN, bus=bus))
