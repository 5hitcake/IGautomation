"""Komponiert und rendert die zwei Titelsongs der Story-Reels - komplett im Code
(eigene Musik, keine Samples, keine Lizenzfragen).

  horror    "Hinterland"  - D-Moll, 60 BPM: Spieluhr-Motiv mit Tritonus, tiefe Drones,
                            Streicherflaechen, Herzschlag, kalter Wind.
  mysteries "Beyond the Signal" - Fis-Moll, 80 BPM, aetherischer Cosmic-/Dream-Synth-Stil
                            (wie er oft unter Mystery-/Alien-Edits liegt): verhallte Supersaw-
                            Flaechen mit Sidechain-Pumpen, "Ooh"-Gesangsmelodie, Glitzer-Arps,
                            808-Bass, Halftime-Beat. Eigene Komposition.

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


def choir(freq, dur, vowel="a", attack=1.8, release=1.8):
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
    return out * env_adsr(dur, attack, 1.0, 1.0, release)


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


def highpass(sig, cutoff):
    spec = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    spec *= 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(spec, len(sig))


def supersaw(freq, dur, voices=7, spread=0.012, attack=0.6, release=1.2, cutoff=3000, seed=0):
    """Breite, schwebende Synth-Flaeche (mehrere verstimmte Saegezaehne, links/rechts verteilt)."""
    t = t_axis(dur)
    rng = np.random.default_rng(seed)
    left, right = np.zeros_like(t), np.zeros_like(t)
    for v in range(voices):
        det = 1 + spread * (v / (voices - 1) - 0.5)
        f0 = freq * det
        ph = rng.uniform(0, 2 * np.pi)
        wave = np.zeros_like(t)
        for k in range(1, 40):
            if f0 * k > cutoff * 2.5:
                break
            wave += np.sin(2 * np.pi * f0 * k * t + ph * k) / k / (1 + (f0 * k / cutoff) ** 2)
        pan = v / (voices - 1)
        left += wave * np.cos(pan * np.pi / 2)
        right += wave * np.sin(pan * np.pi / 2)
    env = env_adsr(dur, attack, 1.0, 1.0, release)
    return np.stack([left, right]) * env / voices


def sub808(freq, dur=1.6):
    t = t_axis(dur)
    f = freq * (1 + 1.5 * np.exp(-t * 35))
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(phase) * np.exp(-t * 1.6) * np.minimum(1, t / 0.002)
    return np.tanh(sig * 1.8) / np.tanh(1.8)


def clap(seed=0):
    rng = np.random.default_rng(seed)
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = highpass(lowpass(rng.standard_normal(n), 3500), 900)
    env = np.zeros(n)
    for off in (0.0, 0.011, 0.023):
        env += np.where(t >= off, np.exp(-(t - off) * (60 if off < 0.02 else 14)), 0)
    return noise * env * 0.6


def hat(open_=False, seed=0):
    rng = np.random.default_rng(seed)
    dur = 0.18 if open_ else 0.05
    n = int(dur * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 70)) * 0.5


def riser(dur, seed=3):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = highpass(rng.standard_normal(n), 2500)
    return noise * (t / dur) ** 2.5 * 0.5


def stereo(sig, pan=0.0):
    return np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)])


def place(bus, start, sig2):
    i = int(start * SR)
    if i >= bus.shape[1]:
        return
    sig2 = sig2[:, : bus.shape[1] - i]
    bus[:, i : i + sig2.shape[1]] += sig2


def delay_fx(bus, beat, feedback=0.35, mix=0.35):
    """Ping-Pong-Delay (punktierte Achtel)."""
    d = int(beat * 0.75 * SR)
    out = bus.copy()
    echo = bus.copy()
    for k in range(1, 5):
        echo = np.roll(echo, d, axis=1) * feedback
        echo[:, :d] = 0
        out[(k % 2)] += echo[(k % 2)] * mix / feedback
    return out


def mysteries():
    bpm, bars = 80, 22
    beat = 60 / bpm
    total = bars * 4 * beat
    n = int(total * SR)
    pads, vox, arps, drums, bass = (np.zeros((2, n)) for _ in range(5))
    # Akkorde (je 1 Takt): F#m - Dmaj7 - Bm7 - C#m7
    chords = [
        ("F#3", "A3", "C#4", "E4"),
        ("D3", "F#3", "A3", "C#4"),
        ("B2", "D3", "F#3", "A3"),
        ("C#3", "E3", "G#3", "B3"),
    ]
    roots = ["F#1", "D1", "B0", "C#1"]
    arp_notes = [
        ["F#4", "A4", "C#5", "E5"],
        ["D4", "F#4", "A4", "C#5"],
        ["B3", "D4", "F#4", "A4"],
        ["C#4", "E4", "G#4", "B4"],
    ]
    drop = lambda b: 4 <= b < 12 or 16 <= b < 21  # noqa: E731
    for bar in range(bars):
        start = bar * 4 * beat
        ci = bar % 4
        cutoff = 900 if bar < 4 else (1800 if 12 <= bar < 16 else 3200)
        for i, note in enumerate(chords[ci]):
            place(pads, start, supersaw(hz(note), 4 * beat + 1.0, cutoff=cutoff, seed=bar * 7 + i) * 0.5)
        # Gesangsflaeche "ooh" eine Oktave hoeher
        for note in chords[ci][1:3]:
            f = hz(note) * 2
            place(vox, start, stereo(choir(f, 4 * beat + 1.2, "u", attack=1.0, release=1.5) * 0.18))
        # Glitzer-Arpeggio (Sechzehntel) ausser im Intro
        if bar >= 4:
            for k in range(16):
                f = hz(arp_notes[ci][k % 4]) * (2 if k % 8 >= 4 else 1)
                place(
                    arps, start + k * beat / 4, stereo(bell(f, 0.6, 0.5) * 0.12, pan=0.6 if k % 2 else -0.6)
                )
        if drop(bar):
            place(bass, start, stereo(sub808(hz(roots[ci]) * 2, 2.2) * 0.9))
            place(bass, start + 2.5 * beat, stereo(sub808(hz(roots[ci]) * 2, 1.2) * 0.6))
            place(drums, start + 2 * beat, stereo(clap(bar)))
            for k in range(8):
                if bar % 4 == 3 and k >= 6:  # Triolen-Roll am Ende jeder Phrase
                    for tri in range(3):
                        place(
                            drums,
                            start + (k + tri / 3) * beat / 2,
                            stereo(hat(seed=bar * 50 + k * 3 + tri), 0.3),
                        )
                else:
                    place(drums, start + k * beat / 2, stereo(hat(open_=(k == 7), seed=bar * 50 + k), 0.3))
        if bar in (3, 15):
            place(drums, start, stereo(riser(4 * beat)))
    # Gesangsmelodie ("ooh", eigene Melodie) in den Drops
    phrase = [
        [("C#5", 1.5), ("B4", 0.5), ("A4", 1.0), ("F#4", 1.0)],
        [("A4", 1.0), ("B4", 1.0), ("C#5", 1.0), ("E5", 1.0)],
        [("D5", 2.0), ("C#5", 1.0), ("B4", 1.0)],
        [("C#5", 3.0), ("G#4", 1.0)],
    ]
    for first in (4, 8, 16):
        for pb, notes in enumerate(phrase):
            pos = (first + pb) * 4 * beat
            for note, length in notes:
                v = choir(
                    hz(note), length * beat + 0.4, "a" if first == 16 else "u", attack=0.08, release=0.4
                )
                place(vox, pos, stereo(v * 0.55, pan=0.05))
                pos += length * beat
    # Sidechain: Flaechen "pumpen" mit der Kick (Viertel im Drop)
    duck = np.ones(n)
    for bar in range(bars):
        if not drop(bar):
            continue
        for b in range(4):
            i = int((bar * 4 + b) * beat * SR)
            m = int(0.38 * SR)
            if i + m <= n:
                duck[i : i + m] = np.minimum(duck[i : i + m], 0.3 + 0.7 * np.linspace(0, 1, m) ** 0.6)
    pads *= duck
    arps *= 0.6 + 0.4 * duck
    mix = (
        reverb(pads, 4.5, 0.5, 11) * 1.0
        + reverb(delay_fx(vox, beat), 5.0, 0.55, 12) * 1.0
        + reverb(delay_fx(arps, beat, 0.4, 0.5), 3.5, 0.45, 13) * 0.9
        + reverb(drums, 1.6, 0.18, 14) * 0.8
        + bass * 0.9
    )
    return np.tanh(mix * 1.2)


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
