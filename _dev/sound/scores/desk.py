"""Homework Hustle: lo-fi hip-hop in F, 80 bpm with swung 16ths, 20 bars (theme, answer, 4-bar breakdown).
Chords Fmaj7 Em7 Dm7 Cmaj7 / Bbmaj7 Am7 Gm7 C7sus4. Electric piano, fingered bass, laid-back jazz kit; flute tune in
the theme, jazz guitar tune in the answer (with a warm pad under it), the flute again over the breakdown.
Final lap: vibraphone doubling the tune and a soft swung shaker."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
from song import *
import mus
mus.QUAL.setdefault('7sus4', (0, 5, 7, 10))   # C7sus4 (local to this process)

def tr(text, n):
    names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    out = []
    for tok in text.split():
        p, d = tok.split(':')
        if p != 'r': p = '+'.join(names[(midi(q) + n) % 12] + str((midi(q) + n) // 12 - 1) for q in p.split('+'))
        out.append(f'{p}:{d}')
    return ' '.join(out)

PROG = ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gm7', 'C7sus4']
S = Song('desk', 80, 20, seed=4)
S.set_chart(PROG + PROG + PROG[4:])
SEC = lambda b: 'A' if b < 8 else 'B' if b < 16 else 'C'
F_MAJ = {5, 7, 9, 10, 0, 2, 4}
S.scale = F_MAJ

kit = S.part('kit', 32, 9, vol=104, rev=30)              # jazz kit
bass = S.part('bass', 33, 0, vol=108, rev=10)
ep = S.part('ep', 4, 1, vol=92, pan=56, rev=45, cho=30)
flute = S.part('flute', 73, 2, vol=96, pan=66, rev=60)
gtr = S.part('gtr', 26, 3, vol=100, pan=70, rev=45)
pad = S.part('pad', 89, 4, vol=70, rev=60)
vibes = S.part('vibes', 11, 5, final=True, vol=92, pan=48, rev=60)
fkit = S.part('fkit', 32, 9, final=True, vol=96, rev=25)

A = [
    'r:0.5 A5:0.5 C6:0.5 E6:1 C6:0.5 A5:1',
    'G5:0.75 B5:0.25 D6:1 B5:0.5 G5:1.5',
    'r:0.5 F5:0.5 A5:0.5 C6:1 A5:0.5 F5:0.5 E5:0.5',
    'G5:2.5 r:1.5',
    'r:0.5 D6:0.5 C6:0.5 A5:1 F5:0.5 D5:1',
    'E5:0.75 G5:0.25 C6:1 E6:0.5 D6:1.5',
    'Bb5:0.5 A5:0.5 G5:0.5 F5:1 D5:0.5 F5:1',
    'G5:3 r:1',
]
B = [
    'C6:0.5 A5:0.25 G5:0.25 A5:1 r:0.5 E5:0.5 F5:0.5 G5:0.5',
    'B5:1.5 A5:0.5 G5:1 E5:1',
    'F5:0.5 A5:0.5 C6:0.5 D6:0.5 E6:1 D6:0.5 C6:0.5',
    'B5:1 G5:1 E5:2',
    'D6:0.5 C6:0.25 Bb5:0.25 A5:1 r:0.5 F5:0.5 G5:0.5 A5:0.5',
    'C6:1.5 A5:0.5 G5:1 E5:1',
    'F5:0.5 G5:0.5 Bb5:0.5 D6:0.5 F6:1 D6:1',
    'C6:2 Bb5:0.5 G5:0.5 F5:1',
]
C = ['F5:2 A5:1 D6:1', 'C6:3 r:1', 'Bb5:1 A5:1 G5:1 F5:1', 'G5:2.5 r:1.5']
for x in A + B + C: assert abs(sum(float(t.split(':')[1]) for t in x.split()) - 4) < 1e-6, x
acc = lambda b: 6 if b in (0, 2) else 0
S.melody(flute, 0, A, 86, legato=0.9, hum=0.4, accent=acc)
S.melody(gtr, 8, [tr(x, -12) for x in B], 90, legato=0.85, hum=0.4, accent=acc)
S.melody(flute, 16, C, 80, legato=0.95, hum=0.4)
S.melody(vibes, 0, A, 80, legato=1.0, hum=0.3)
S.melody(vibes, 8, B, 80, legato=1.0, hum=0.3)
S.melody(vibes, 16, C, 74, legato=1.0, hum=0.3)

# electric piano: chord on the one, re-struck on the and of three; just the one in the breakdown
for t, d, sym in S.chords:
    v = voicing(sym, midi('A4') if sym != 'C7sus4' else midi('G4'), 4)
    hits = [(0, 2.3, 66), (2.5, 1.4, 56)] if SEC(int(t // 4)) != 'C' else [(0, 3.8, 60)]
    for b, L, vel in hits:
        for j, m in enumerate(v): ep.add(t + b + j * 0.02, L, m, vel + random.uniform(-4, 4))
S.pad(pad, midi('F4'), 3, 50, only=lambda b: SEC(b) in ('B', 'C'))

# bass: root held, a pickup on the a of two, fifth or octave on the and of three, a step into the next bar
sc = sorted(F_MAJ)
for k, (t, d, sym) in enumerate(S.chords):
    r = S.bass_root(sym, midi('E1')); nx = S.bass_root(S.chords[(k + 1) % len(S.chords)][2], midi('E1'))
    app = next(a for a in (nx - 1, nx + 2, nx - 2, nx + 1) if a % 12 in F_MAJ)
    if SEC(int(t // 4)) == 'C' and int(t // 4) < 19:
        bass.add(t, 3.0, r, 92); bass.add(t + 3.5, 0.4, app, 70); continue
    for b, m, L, v in [(0, r, 1.4, 96), (1.75, r, 0.4, 72), (2.5, r + 7 if k % 2 else r + 12, 0.7, 82), (3.5, app, 0.4, 74)]:
        bass.add(t + b, L, m, v + random.uniform(-4, 4))

# drums: lazy boom-bap
for b in range(20):
    s, t = SEC(b), b * 4
    if s in ('A', 'B'):
        S.pattern(kit, b, 'x......x..x.....' if b % 2 == 0 else 'x.........x..x..', KICK, 98)
        S.pattern(kit, b, '....x.......x...', SNARE, 84)
        S.pattern(kit, b, 'x.xox.x.x.xox.xo', HAT, 50)
        if b % 4 == 3: S.hit(kit, t + 3.5, OHAT, 46)
    else:
        S.pattern(kit, b, 'x.........x.....', KICK, 86)
        S.pattern(kit, b, '............x...', STICK, 62)
        S.pattern(kit, b, 'x...x...x...x...', HAT, 40)
        if b == 19: S.pattern(kit, b, '..........o.xoxo', SNARE, 66)
# laid-back snare: a hair behind the beat
kit.notes = [(b + (0.03 if m == SNARE and abs(b % 1) < 0.05 else 0), d, m, v) for b, d, m, v in kit.notes]
for b in range(20):
    if SEC(b) == 'C' and b < 19: continue
    S.pattern(fkit, b, 'xoooxoooxoooxooo', MARACAS, 54)
    S.pattern(fkit, b, '....x.......x...', TAMB, 44)

def swing(P, amt=0.07):
    """swung 16ths: every off-beat 16th lands late (and the note it starts shortens by the same)"""
    out = []
    for b, d, m, v in P.notes:
        f = b % 0.5
        if abs(f - 0.25) < 0.04: b += amt; d = max(0.05, d - amt)
        out.append((b, d, m, v))
    P.notes = out
for P in list(S.main.values()) + list(S.fin.values()):
    swing(P)
    P.notes = [(max(b, round(b)) if round(b) - b < 0.02 else b, d, m, v) for b, d, m, v in P.notes]

S.check_key(F_MAJ)
GAIN = {'kit': -19, 'bass': -19.5, 'ep': -23.5, 'flute': -18.5, 'gtr': -19, 'pad': -28, 'vibes': -24, 'fkit': -27}
def limit(x, crest=13.5):
    """look-ahead peak limiter: peaks held to `crest` dB above the signal's integrated loudness"""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    L = loudness(x)
    if not np.isfinite(L): return x
    env = maximum_filter1d(np.abs(x).max(1), 441)
    g = uniform_filter1d(np.minimum(1, db(L + crest) / np.maximum(env, 1e-9)), 441)
    return x * np.minimum(g, 1)[:, None]
# the EP, flute and jazz kit are dark already: no top cut (lo-fi, but not muffled), a little less 1 kHz box
bus = lambda x: limit(eq(eq(comp(eq(x, 'highpass', 35), thr=-20, ratio=2.5, att=0.01, rel=0.15), 'peak', 1000, 0.8, -2), 'highshelf', 3500, 0.7, 3))
print('loop', S.finish(GAIN, bus=bus))
