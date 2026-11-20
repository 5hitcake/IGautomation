"""Mischt Musik (geloopt) + synthetische Soundeffekte zu den Spiel-Ereignissen.
Aufruf: python3 mix_audio.py events.json dauer_s musik.wav ausgabe.wav
events.json = [[frame, typ], ...] bei 30 fps
"""
import sys, json, wave
import numpy as np

SR = 44100
ev_path, dur, music_path, out = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
rng = np.random.default_rng(1)


def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, decay=6.0):
    t = np.arange(n) / SR
    e = np.exp(-t * decay)
    na = max(1, int(a * SR)); e[:na] *= np.linspace(0, 1, na)
    return e
def sweep(f0, f1, d, wave_='sine'):
    t = t_(d); f = np.geomspace(f0, f1, len(t)); ph = 2 * np.pi * np.cumsum(f) / SR
    if wave_ == 'square': return np.sign(np.sin(ph)) * .5
    if wave_ == 'tri': return 2 / np.pi * np.arcsin(np.sin(ph))
    return np.sin(ph)
def tone(f, d, wave_='sine'): return sweep(f, f, d, wave_)
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def lp(x, a):  # einfacher Tiefpass
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y
def cat(*xs): return np.concatenate(xs)

def make():
    S = {}
    S['pop'] = sweep(350, 900, .09) * env(int(SR * .09), decay=25) * .6
    S['beep'] = tone(880, .16, 'square') * env(int(SR * .16), decay=10) * .35
    S['go'] = tone(1320, .45, 'square') * env(int(SR * .45), decay=5) * .4
    n = noise(.9); S['boom'] = (lp(n, .04) * 3 + sweep(90, 35, .9) * .8) * env(len(n), decay=4.5) * .9
    S['hit'] = (lp(noise(.15), .3) * .8 + sweep(320, 110, .15) * .6) * env(int(SR * .15), decay=20)
    b = sweep(180, 650, .35) * (1 + .3 * np.sin(2 * np.pi * 18 * t_(.35))); S['boing'] = b * env(len(b), decay=7) * .45
    S['zoom'] = sweep(250, 1600, .25, 'tri') * env(int(SR * .25), decay=6) * .35
    S['coin'] = cat(tone(988, .06, 'square'), tone(1319, .22, 'square') * env(int(SR * .22), decay=12)) * .22
    c = noise(.35) * (rng.random(int(SR * .35)) > .985) * 3; S['crack'] = lp(c, .5) * env(len(c), decay=8) * .8
    n = noise(.6); S['splash'] = (n - lp(n, .08)) * env(len(n), a=.01, decay=6) * .6
    S['splat'] = lp(noise(.2), .15) * env(int(SR * .2), decay=15) * .7
    S['bonk'] = (sweep(220, 90, .14) + lp(noise(.14), .3) * .4) * env(int(SR * .14), decay=22) * .6
    n = noise(.35); w = np.sin(np.linspace(0, np.pi, len(n))) ** 2; S['whoosh'] = (lp(n, .12) * 2) * w * .5
    S['throw'] = S['whoosh'] * .7
    S['swoosh'] = cat(S['whoosh'], np.zeros(100)) * .8
    S['catch'] = tone(620, .06, 'tri') * env(int(SR * .06), decay=30) * .5
    S['tick'] = tone(2200, .025) * env(int(SR * .025), decay=80) * .45
    S['jump'] = sweep(300, 600, .1, 'tri') * env(int(SR * .1), decay=20) * .3
    S['elim'] = cat(sweep(440, 330, .22, 'tri') * env(int(SR * .22), decay=4), sweep(330, 196, .5, 'tri') * env(int(SR * .5), decay=3)) * .45
    S['slip'] = sweep(900, 180, .45, 'tri') * env(int(SR * .45), decay=4) * .4
    S['ding'] = tone(1568, .4, 'tri') * env(int(SR * .4), decay=7) * .35
    notes = [523, 659, 784, 1047]
    fan = cat(*[tone(f, .13, 'square') * env(int(SR * .13), decay=8) for f in notes], tone(1047, .9, 'square') * env(int(SR * .9), decay=2.5))
    harm = cat(np.zeros(int(SR * .52)), tone(784, .9, 'tri') * env(int(SR * .9), decay=2.5))
    S['fanfare'] = (fan * .35 + harm[:len(fan)] * .3)
    n = noise(2.5); am = 1 + .5 * np.sin(2 * np.pi * 3.3 * t_(2.5)) * np.sin(2 * np.pi * .7 * t_(2.5))
    shape = np.minimum(1, t_(2.5) / .3) * np.minimum(1, (2.5 - t_(2.5)) / 1.2)
    S['cheer'] = (lp(n, .25) - lp(n, .02)) * am * shape * 1.6
    return S

def read_wav(p):
    with wave.open(p) as w:
        ch, sw, sr = w.getnchannels(), w.getsampwidth(), w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    a = a.reshape(-1, ch)
    if ch == 1: a = np.repeat(a, 2, axis=1)
    assert sr == SR, sr
    return a

N = int(SR * dur)
mix = np.zeros((N, 2), np.float32)
# Musik loopen mit 1 s Überblendung
m = read_wav(music_path); xf = SR
pos, first = 0, True
while pos < N:
    seg = m.copy()
    if not first:
        seg[:xf] *= np.linspace(0, 1, xf)[:, None]
    seg[-xf:] *= np.linspace(1, 0, xf)[:, None]
    end = min(N, pos + len(seg)); mix[pos:end] += seg[:end - pos] * .5
    pos += len(seg) - xf; first = False
fade = int(SR * 2.5); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]

S = make()
events = json.load(open(ev_path))
for f, typ in events:
    s = S.get(typ)
    if s is None: continue
    i = int(f / 30 * SR)
    if i >= N: continue
    seg = s[:N - i].astype(np.float32)
    mix[i:i + len(seg)] += seg[:, None] * .8

peak = np.abs(mix).max()
mix = np.tanh(mix / max(peak, 1e-6) * 1.2) * .89
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('audio ok', out, len(events), 'events')
