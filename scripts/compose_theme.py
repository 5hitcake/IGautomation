"""Komponiert und rendert die zwei Titelsongs der Story-Reels - komplett im Code
(eigene Musik, keine Samples, keine Lizenzfragen).

  horror    "Hinterland"  - D-Moll, 60 BPM: Spieluhr-Motiv mit Tritonus, tiefe Drones,
                            Streicherflaechen, Herzschlag, kalter Wind.
  mysteries "Ancient Signal" - E-Phrygisch, 90 BPM: pulsierendes Bass-Arpeggio,
                            Choir-Flaechen, Trommeln, Glocken-Melodie.

Beide Stuecke sind ~64 s lang und so gebaut, dass sie nahtlos loopen (Reels > 64 s).

Nutzung:
  python scripts/compose_theme.py            (beide -> assets/story_music/<account>/theme.mp3)
  python scripts/compose_theme.py horror
Benoetigt nur numpy + ffmpeg.
"""

import os
import subprocess
import sys

import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
SR = 44100
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):
    """'D4' -> Frequenz."""
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octave + 1) - 69) / 12)


class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.buf = np.zeros((2, self.n))

    def add(self, start, sig, gain=1.0, pan=0.0):
        i = int(start * SR)
        if i >= self.n:
            return
        sig = sig[: self.n - i] * gain
        left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.buf[0, i : i + len(sig)] += sig * left
        self.buf[1, i : i + len(sig)] += sig * right


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(dur, a, d, s, r):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = int(r * SR)
    if rel and n > rel:
        e[-rel:] *= np.linspace(1, 0, rel) ** 2
    return e


def lowpass(sig, cutoff):
    """Weicher Tiefpass ueber FFT (fuer ganze Spuren)."""
    spec = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    spec *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(spec, len(sig))


def bell(freq, dur, bright=1.0):
    """Spieluhr/Glocke: unharmonische Teiltoene, schnelles Abklingen."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for ratio, amp, decay in (
        (1, 1.0, 1.6),
        (2.76, 0.45 * bright, 0.9),
        (5.40, 0.22 * bright, 0.5),
        (8.93, 0.10 * bright, 0.3),
    ):
        out += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t * decay * 2.2)
    return out * np.minimum(1, t / 0.003)


def piano(freq, dur):
    t = t_axis(dur)
    out = np.zeros_like(t)
    for k in range(1, 9):
        f = freq * k * np.sqrt(1 + 0.0004 * k * k)
        out += np.sin(2 * np.pi * f * t) / k**1.3 * np.exp(-t * (0.9 + 0.5 * k))
    return out * np.minimum(1, t / 0.004)


def saw_pad(freq, dur, attack=2.0, release=2.0, harmonics=14, detune=0.004, bright=1.0):
    """Streicher-/Synth-Flaeche: verstimmte additive Saegezaehne."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    rng = np.random.default_rng(int(freq * 10))
    for voice in (-1, 0, 1):
        f0 = freq * (1 + voice * detune)
        ph = rng.uniform(0, 2 * np.pi)
        for k in range(1, harmonics + 1):
            out += np.sin(2 * np.pi * f0 * k * t + ph * k) / k * np.exp(-k / (6 * bright))
    vib = 1 + 0.15 * np.sin(2 * np.pi * 0.3 * t)
    return out / 3 * env_adsr(dur, attack, 1.0, 1.0, release) * vib


def choir(freq, dur, vowel="a"):
    """'Aah'-Chor: Obertoene, gewichtet nach Formanten."""
    formants = {"a": (730, 1090, 2440), "o": (570, 840, 2410), "u": (300, 870, 2240)}[vowel]
    t = t_axis(dur)
    out = np.zeros_like(t)
    vib = 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 1.5)
    for k in range(1, 30):
        f = freq * k
        if f > 5000:
            break
        w = sum(np.exp(-(((f - fm) / 110) ** 2)) * g for fm, g in zip(formants, (1.0, 0.6, 0.25)))
        w += 0.04 / k
        out += w * np.sin(2 * np.pi * f * t * (1 + vib))
    return out * env_adsr(dur, 1.8, 1.0, 1.0, 1.8)


def drum(dur=1.2, f_start=110, f_end=45, noise=0.25, seed=0):
    t = t_axis(dur)
    f = f_end + (f_start - f_end) * np.exp(-t * 18)
    phase = 2 * np.pi * np.cumsum(f) / SR
    rng = np.random.default_rng(seed)
    body = np.sin(phase) * np.exp(-t * 4.5)
    hit = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 30) * noise
    return body + hit


def heartbeat():
    a = drum(0.5, 70, 40, 0.05)
    b = drum(0.5, 60, 38, 0.05) * 0.7
    out = np.zeros(int(0.9 * SR))
    out[: len(a)] += a
    out[int(0.28 * SR) : int(0.28 * SR) + len(b)] += b
    return out


def wind(seconds, cutoff=500, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    noise = lowpass(rng.standard_normal(n), cutoff)
    t = np.arange(n) / SR
    swell = 0.5 + 0.5 * np.sin(2 * np.pi * t / 9.0) * np.sin(2 * np.pi * t / 23.0 + 1)
    return noise * swell


def reverb(buf, seconds=3.2, mix=0.32, seed=7):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.empty_like(buf)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir = lowpass(ir, 4500)
        ir[: int(0.02 * SR)] = 0
        size = 1 << int(np.ceil(np.log2(buf.shape[1] + n)))
        wet = np.fft.irfft(np.fft.rfft(buf[ch], size) * np.fft.rfft(ir, size), size)
        # Hallfahne an den Anfang falten -> nahtloser Loop
        tail = wet[buf.shape[1] : buf.shape[1] + n]
        wet = wet[: buf.shape[1]]
        wet[: len(tail)] += tail
        wet /= np.sqrt((ir**2).sum())
        out[ch] = buf[ch] * (1 - mix) + wet * mix
    return out


def horror():
    bpm, bars = 60, 16
    beat = 60 / bpm
    total = bars * 4 * beat
    tr = Track(total)
    # Drones (ganze Laenge, loopfaehig: konstante Lautstaerke)
    t = t_axis(total)
    drone = (
        np.sin(2 * np.pi * hz("D1") * t)
        + 0.6 * np.sin(2 * np.pi * hz("D2") * 1.003 * t)
        + 0.25 * np.sin(2 * np.pi * hz("A2") * t) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 16))
    )
    tr.add(0, drone, 0.16)
    tr.add(0, wind(total, 450), 0.05)
    # Streicherflaechen: Dm - Bb - Gm - A (je 2 Takte), ab Takt 5
    chords = [("D3", "F3", "A3"), ("A#2", "D3", "F3"), ("G2", "A#2", "D3"), ("A2", "C#3", "E3")]
    for bar in range(4, 14, 2):
        ch = chords[(bar // 2) % 4]
        for i, note in enumerate(ch):
            tr.add(
                bar * 4 * beat,
                saw_pad(hz(note), 8 * beat + 1.5, 2.5, 2.5, bright=0.6),
                0.05,
                pan=(i - 1) * 0.5,
            )
    # Spieluhr-Motiv (Wiegenlied mit Tritonus G#)
    motif = ["D5", "F5", "A5", "G#5", "A5", "F5", "E5", "D5"]
    motif2 = ["D5", "F5", "A5", "D6", "C#6", "A5", "G#5", "A5"]
    for bar in range(0, 16, 2):
        if bar in (12,):
            continue
        notes = motif2 if bar in (6, 10) else motif
        for i, n in enumerate(notes):
            start = bar * 4 * beat + i * beat
            tr.add(start, bell(hz(n), 3.0, 0.8), 0.085, pan=0.35 * np.sin(i))
    # Tiefe Klavier-Toene
    for bar, n in ((4, "D2"), (6, "A#1"), (8, "G1"), (10, "A1"), (14, "D2")):
        tr.add(bar * 4 * beat, piano(hz(n), 6), 0.22)
    # Herzschlag ab Takt 7 bis Takt 13
    for b in range(6 * 4, 13 * 4, 2):
        tr.add(b * beat, heartbeat(), 0.35)
    return reverb(tr.buf, 3.8, 0.38)


def mysteries():
    bpm, bars = 90, 24
    beat = 60 / bpm
    total = bars * 4 * beat
    tr = Track(total)
    t = t_axis(total)
    tr.add(0, np.sin(2 * np.pi * hz("E1") * t) * (0.7 + 0.3 * np.sin(2 * np.pi * t / 10.6)), 0.12)
    tr.add(0, wind(total, 1200, 3), 0.025)
    # Akkorde (Phrygisch): Em - F - Em - D, je 2 Takte
    roots = [
        ("E", ("E3", "G3", "B3")),
        ("F", ("F3", "A3", "C4")),
        ("E", ("E3", "G3", "B3")),
        ("D", ("D3", "F#3", "A3")),
    ]
    bass = {"E": ["E2", "B2", "E3", "G3"], "F": ["F2", "C3", "F3", "A3"], "D": ["D2", "A2", "D3", "F#3"]}
    for bar in range(0, bars, 2):
        root, chord = roots[(bar // 2) % 4]
        start = bar * 4 * beat
        # Pulsierendes Arpeggio (Achtel) ab Takt 3
        if bar >= 2:
            pattern = bass[root] + bass[root][::-1]
            for k in range(16):
                f = hz(pattern[k % 8])
                pluck = saw_pad(f, beat * 0.55, 0.005, 0.15, harmonics=10, bright=0.35)
                tr.add(start + k * beat / 2, pluck, 0.05, pan=-0.3 if k % 2 else 0.3)
        # Chor-Flaeche
        for i, n in enumerate(chord):
            tr.add(
                start, choir(hz(n), 8 * beat + 1.5, "a" if bar % 4 == 0 else "o"), 0.022, pan=(i - 1) * 0.6
            )
        # Trommeln
        if bar >= 4:
            tr.add(start, drum(1.6, 120, 42, 0.3, bar), 0.5)
            tr.add(start + 3 * beat, drum(1.0, 140, 60, 0.2, bar + 1), 0.25)
            tr.add(start + 4 * beat, drum(1.6, 120, 42, 0.3, bar + 2), 0.4)
            tr.add(start + 6.5 * beat, drum(0.8, 160, 70, 0.2, bar + 3), 0.2)
    # Glocken-Melodie ab Takt 9
    melody = [
        ("B4", 2),
        ("C5", 1),
        ("B4", 1),
        ("G4", 2),
        ("E4", 2),
        ("F4", 2),
        ("E4", 2),
        ("D4", 2),
        ("E4", 2),
        ("B4", 2),
        ("C5", 1),
        ("D5", 1),
        ("E5", 2),
        ("D5", 1),
        ("C5", 1),
        ("B4", 4),
        ("A4", 2),
        ("B4", 2),
    ]
    pos = 8 * 4 * beat
    for rep in range(2):
        p = pos + rep * 8 * 4 * beat
        for n, length in melody:
            if p >= total - 4 * beat:
                break
            tr.add(p, bell(hz(n), 3.5, 0.6), 0.07, pan=0.2)
            tr.add(p, choir(hz(n) / 2, length * beat + 0.8, "u") * 0.6, 0.02)
            p += length * beat
    return reverb(tr.buf, 3.0, 0.33)


def export(buf, path):
    buf = buf / (np.abs(buf).max() + 1e-9) * 0.89
    pcm = (np.clip(buf.T, -1, 1) * 32767).astype("<i2").tobytes()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "s16le",
            "-ar",
            str(SR),
            "-ac",
            "2",
            "-i",
            "-",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar",
            str(SR),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            path,
        ],
        input=pcm,
        check=True,
    )
    print(f"geschrieben: {path}")


def main():
    which = sys.argv[1:] or ["horror", "mysteries"]
    for name in which:
        buf = {"horror": horror, "mysteries": mysteries}[name]()
        export(buf, os.path.join(ROOT, "assets", "story_music", name, "theme.mp3"))


if __name__ == "__main__":
    main()
