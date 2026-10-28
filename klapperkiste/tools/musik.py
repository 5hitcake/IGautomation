"""Hintergrundmusik als Datendatei für den Browser.

Die Stücke in assets/ton/musik/*.mp3 sind mit MiniMax Music (Hugging Face Space
victor/MiniMax-Music3-Jam) erzeugt, rein instrumental. Die Stücke enden mit einem
Schluss, der langsamer wird. Dieses Werkzeug sucht deshalb zwei Stellen, an denen
die Musik gleich klingt (Anfang und Ende der Schleife), blendet kurz vor dem Ende
in den Anfang über (verträgt kleine Verschiebungen beim Dekodieren) und schneidet den
Schluss ab. Ausgabe mono mit 64 kbit/s in
design/musik_daten.js: { src, schleife: [Anfang, Ende] }. ton.js spielt die
Schleife nahtlos im Kreis; fehlt die Datei, nimmt es die selbst gespielten Noten.
Stücke namens figur_<name> laufen leise im Gespräch mit dieser Figur.

Aufruf:
  python klapperkiste/tools/musik.py
"""

from __future__ import annotations

import base64
import glob
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
QUELLE = os.path.join(ROOT, "assets", "ton", "musik")
ZIEL = os.path.join(ROOT, "design", "musik_daten.js")
RATE, FENSTER, SCHRITT = 44100, 2048, 1024
STILLE = "silenceremove=start_periods=1:start_threshold=-45dB,areverse," \
         "silenceremove=start_periods=1:start_threshold=-45dB,areverse"


def lesen(pfad: str) -> np.ndarray:
    befehl = ["ffmpeg", "-v", "error", "-i", pfad, "-af", STILLE, "-ac", "1", "-ar", str(RATE),
              "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(befehl, check=True, capture_output=True).stdout, dtype=np.float32)


def merkmale(x: np.ndarray) -> np.ndarray:
    """Klangbild je Rahmen (23 ms): Lautstärke in 48 Frequenzbändern, normiert."""
    n = (len(x) - FENSTER) // SCHRITT
    rahmen = np.lib.stride_tricks.sliding_window_view(x, FENSTER)[::SCHRITT][:n] * np.hanning(FENSTER)
    spek = np.abs(np.fft.rfft(rahmen, axis=1))[:, 1:]
    grenzen = np.unique(np.geomspace(1, spek.shape[1], 49).astype(int))
    baender = np.log1p(np.add.reduceat(spek, grenzen[:-1], axis=1) * 10)
    baender -= baender.mean(axis=1, keepdims=True)
    return baender / np.maximum(np.linalg.norm(baender, axis=1, keepdims=True), 1e-6)


def schleife_finden(x: np.ndarray) -> tuple[int, int]:
    """Anfang a und Ende e (Samples), bei denen die 3 s davor möglichst gleich klingen."""
    m = merkmale(x)
    ahn = m @ m.T
    w, n = int(3 * RATE / SCHRITT), len(m)
    kandidaten = []  # (Ähnlichkeit, Länge, Anfang) – je Länge die beste Stelle
    for lag in range(int(0.3 * n), n - w):
        d = np.diagonal(ahn, lag)  # d[k] = ahn[k, k + lag]
        summe = np.convolve(d, np.ones(w) / w, mode="valid")  # Mittel über d[k-w+1..k]
        k0 = max(0, int(1.5 * RATE / SCHRITT) - w)
        k1 = min(len(summe), n - int(1.5 * RATE / SCHRITT) - lag - w + 1)
        if k1 > k0:
            k = k0 + int(np.argmax(summe[k0:k1]))
            kandidaten.append((float(summe[k]), lag, k + w))
    # die längste Schleife, die fast so gut passt wie die beste
    best = max(c[0] for c in kandidaten)
    _, lag, a = max((c for c in kandidaten if c[0] >= best - 0.03), key=lambda c: c[1])
    wahl = (a, a + lag)
    a, e = wahl[0] * SCHRITT, wahl[1] * SCHRITT
    # fein: Ende so verschieben, dass die Wellenform vor dem Ende zu der vor dem Anfang passt
    probe, r = x[a - 2048:a], 512
    werte = [float(np.dot(x[e + v - 2048:e + v], probe)) for v in range(-r, r)]
    e += int(np.argmax(werte)) - r
    return a, e


def schleife_bauen(x: np.ndarray, a: int, e: int) -> np.ndarray:
    """Bis kurz nach e kürzen. Vor e geht die Musik in 80 ms weich in das über, was um a
    herum kommt, und rund um e (±60 ms) steht genau das Stück um a. So bleibt der Sprung
    nahtlos, auch wenn ein Browser die MP3 um ein paar Millisekunden verschoben dekodiert."""
    f, m = int(0.08 * RATE), int(0.06 * RATE)
    y = x[:e + m].copy()
    rampe = np.linspace(0, 1, f)
    y[e - m - f:e - m] = x[e - m - f:e - m] * (1 - rampe) + x[a - m - f:a - m] * rampe
    y[e - m:e + m] = x[a - m:a + m]
    return y


def umwandeln(y: np.ndarray) -> bytes:
    befehl = ["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "-",
              "-b:a", "64k", "-f", "mp3", "-"]
    eingabe = y.astype(np.float32).tobytes()
    return subprocess.run(befehl, input=eingabe, check=True, capture_output=True).stdout


def main() -> int:
    daten = {}
    for pfad in sorted(glob.glob(os.path.join(QUELLE, "*.mp3"))):
        name = os.path.splitext(os.path.basename(pfad))[0]
        x = lesen(pfad)
        a, e = schleife_finden(x)
        roh = umwandeln(schleife_bauen(x, a, e))
        daten[name] = {"src": "data:audio/mpeg;base64," + base64.b64encode(roh).decode("ascii"),
                       "schleife": [round(a / RATE, 4), round(e / RATE, 4)]}
        print(f"{name}: {len(x) / RATE:.1f} s, Schleife {a / RATE:.2f}–{e / RATE:.2f} s, "
              f"{len(roh) // 1024} KB")
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/musik.py. Nicht von Hand ändern.\n")
        f.write("window.MUSIK_DATEN = " + json.dumps(daten) + ";\n")
    print(f"{os.path.relpath(ZIEL)}: {os.path.getsize(ZIEL) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
