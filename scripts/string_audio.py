"""Tonspur fuer die Fadenbild-Videos - komplett im Code erzeugt (keine Samples, keine Lizenzfragen).

  Hammer     kurzer, dumpfer Schlag (tiefer Sinus + Holz-Resonanz + Klick) je Nagel; bei vielen
             Naegeln pro Bild leiser und dichter, wie ein schneller Rhythmus.
  Faden      gezupfter Faden (Karplus-Strong) bei den ersten, einzeln gespannten Faeden, danach
             immer dichteres leises Zupfen + Rascheln, passend zum Tempo.
  Reveal     weicher Glockenklang, wenn das fertige Bild steht.
  Musik      ruhige, warme Akkordflaeche mit Arpeggio (Am - F - C - G), leise darunter.

Nutzung (aus string_art.render):  build_audio(events, seconds, wav_path)
events: Liste (zeit_s, art, staerke) mit art in {"nail", "pluck", "fast", "reveal"}.
"""

import wave

import numpy as np

SR = 44100


def _env(n, attack=0.002, decay=0.15):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def hammer(rng, strength=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (95 + 40 * np.exp(-t * 40)) * t) * _env(n, 0.001, 0.05)
    noise = rng.normal(0, 1, n)
    # Holz-Resonanz: grob bandbegrenztes Rauschen
    wood = np.convolve(noise, np.hanning(24), "same") * _env(n, 0.001, 0.035) * 0.35
    click = noise * _env(n, 0.0002, 0.003) * 0.5
    ring = np.sin(2 * np.pi * 2350 * t) * _env(n, 0.001, 0.04) * 0.06  # Nagelkopf "ting"
    return (thump * 0.9 + wood + click + ring) * strength


_PLUCK_CACHE = {}


def pluck(rng, freq, strength=1.0, seconds=0.9):
    """Karplus-Strong: gezupfte Saite/Faden (je Tonhoehe einmal berechnet, dann zwischengespeichert)."""
    key = (round(freq, 2), seconds)
    if key not in _PLUCK_CACHE:
        _PLUCK_CACHE[key] = _pluck(rng, freq, seconds)
    return _PLUCK_CACHE[key] * strength


def _pluck(rng, freq, seconds):
    n = int(seconds * SR)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out * _env(n, 0.001, seconds / 3)


def swish(rng, strength=1.0, seconds=0.12):
    n = int(seconds * SR)
    noise = np.convolve(rng.normal(0, 1, n), np.hanning(8), "same")
    win = np.sin(np.linspace(0, np.pi, n)) ** 2
    return noise * win * 0.15 * strength


def bell(seconds=3.5):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, a, d in ((523.25, 1.0, 1.6), (1046.5, 0.5, 1.0), (1568.0, 0.25, 0.7), (784.0, 0.4, 1.3)):
        out += a * np.sin(2 * np.pi * f * t) * _env(n, 0.005, d)
    return out * 0.35


NOTE = {"A2": 110.0, "C3": 130.81, "E3": 164.81, "F2": 87.31, "G2": 98.0, "A3": 220.0, "C4": 261.63,
        "E4": 329.63, "F3": 174.61, "G3": 196.0, "B3": 246.94, "D4": 293.66, "A4": 440.0, "G4": 392.0}
CHORDS = [("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("C3", ["G3", "C4", "E4"]),
          ("G2", ["G3", "B3", "D4"])]


def music(seconds, rng, bpm=76):
    """Ruhige Akkordflaeche + gezupftes Arpeggio, 2 Takte je Akkord."""
    n = int(seconds * SR)
    out = np.zeros(n + SR * 3)
    beat = 60 / bpm
    bar = 4 * beat
    t_all = np.arange(int(2 * bar * SR)) / SR
    pos, k = 0.0, 0
    while pos < seconds:
        bass, notes = CHORDS[k % len(CHORDS)]
        i0 = int(pos * SR)
        pad = np.zeros_like(t_all)
        for name in notes:
            f = NOTE[name]
            pad += np.sin(2 * np.pi * f * t_all) + 0.3 * np.sin(2 * np.pi * 2 * f * t_all + 0.5)
        pad += 0.8 * np.sin(2 * np.pi * NOTE[bass] * t_all)
        fade = np.minimum(1, np.minimum(t_all / 0.6, (t_all[-1] - t_all) / 0.6))
        seg = pad * fade * 0.05
        out[i0:i0 + len(seg)] += seg[: len(out) - i0]
        # Arpeggio in Achteln
        for s in range(16):
            name = notes[s % 3] if s % 4 != 3 else notes[(s // 4) % 3]
            f = NOTE[name] * (2 if s % 8 >= 4 else 1)
            p = pluck(rng, f, 0.09, seconds=1.2)
            j = i0 + int(s * beat / 2 * SR)
            if j < len(out):
                out[j:j + len(p)] += p[: len(out) - j]
        pos += 2 * bar
        k += 1
    out = out[:n]
    fade_n = int(1.5 * SR)
    out[:fade_n] *= np.linspace(0, 1, fade_n)
    out[-fade_n:] *= np.linspace(1, 0, fade_n)
    return out


def _add(buf, sig, t, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i < 0:
        return
    m = min(len(sig), buf.shape[1] - i)
    buf[0, i:i + m] += sig[:m] * (1 - max(0, pan))
    buf[1, i:i + m] += sig[:m] * (1 + min(0, pan))


def build_audio(events, seconds, path, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR) + SR
    buf = np.zeros((2, n))
    base = 196.0
    scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2]  # Dur-Pentatonik
    for t, kind, strength in events:
        pan = float(rng.uniform(-0.4, 0.4))
        if kind == "nail":
            _add(buf, hammer(rng, 0.55 * strength), t, pan)
        elif kind == "pluck":
            f = base * scale[int(rng.integers(len(scale)))] * (2 if rng.random() < 0.4 else 1)
            _add(buf, pluck(rng, f, 0.45 * strength), t, pan)
        elif kind == "fast":
            _add(buf, swish(rng, strength), t, pan)
            if rng.random() < min(0.9, 0.25 + strength):
                f = base * 2 * scale[int(rng.integers(len(scale)))]
                _add(buf, pluck(rng, f, 0.12 * strength, seconds=0.5), t, pan)
        elif kind == "reveal":
            _add(buf, bell(), t)
    mus = music(seconds, rng)
    buf[:, : len(mus)] += mus[None, :] * 0.9
    peak = np.abs(buf).max() or 1
    buf = buf / peak * 0.85
    pcm = (buf.T * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path
