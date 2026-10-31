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

Ein Ordner assets/ton/musik/<name>/ mit mehreren Teilen (1.mp3, 2.mp3, …, gleicher
Stil und gleiche Tonart) wird zu einem langen Stück <name> zusammengeschnitten: alle
Teile auf ein gemeinsames Tempo strecken, je zwei Teile an der Stelle verbinden, an der
sie am ähnlichsten klingen, und vom letzten Teil zurück in den ersten schleifen.

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


def lesen(pfad: str, tempo: float = 1.0) -> np.ndarray:
    filter_ = STILLE + (f",atempo={tempo:.5f}" if abs(tempo - 1) > 1e-3 else "")
    befehl = ["ffmpeg", "-v", "error", "-i", pfad, "-af", filter_, "-ac", "1", "-ar", str(RATE),
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


def einsaetze(x: np.ndarray, schritt: int = SCHRITT) -> np.ndarray:
    """Stärke der Toneinsätze je Rahmen (wie stark das Spektrum zunimmt)."""
    n = (len(x) - FENSTER) // schritt
    rahmen = np.lib.stride_tricks.sliding_window_view(x, FENSTER)[::schritt][:n] * np.hanning(FENSTER)
    spek = np.log1p(np.abs(np.fft.rfft(rahmen, axis=1)) * 10)
    return np.concatenate([[0], np.maximum(np.diff(spek, axis=0), 0).sum(axis=1)])


def tempo_schaetzen(x: np.ndarray) -> float:
    """Schläge pro Minute aus der Autokorrelation der Einsätze, gefaltet auf 120–240."""
    einsatz = einsaetze(x)
    einsatz -= einsatz.mean()
    ak = np.correlate(einsatz, einsatz, "full")[len(einsatz) - 1:]
    lags = np.arange(1, len(ak))
    bpm = 60 * RATE / SCHRITT / lags
    bereich = (bpm > 60) & (bpm < 300)
    lag = lags[bereich][np.argmax(ak[1:][bereich])]
    # genauer: Parabel durch den Gipfel
    li, mi, re = ak[lag - 1], ak[lag], ak[lag + 1]
    lag = lag + 0.5 * (li - re) / (li - 2 * mi + re)
    bpm = 60 * RATE / SCHRITT / lag
    while bpm < 120:
        bpm *= 2
    while bpm >= 240:
        bpm /= 2
    return bpm


def wellen_angleichen(x: np.ndarray, e: int, vorbild: np.ndarray, r: int = 512) -> int:
    """e um bis zu r Samples so verschieben, dass x vor e der Wellenform vorbild gleicht."""
    werte = [float(np.dot(x[e + v - len(vorbild):e + v], vorbild)) for v in range(-r, r)]
    return e + int(np.argmax(werte)) - r


def uebergang_finden(x: np.ndarray, y: np.ndarray) -> tuple[int, int]:
    """Stelle p im hinteren Teil von x und q im vorderen Teil von y, bei denen die 3 s davor
    möglichst gleich klingen. Von x[:p] geht es dann mit y[q:] weiter."""
    mx, my = merkmale(x), merkmale(y)
    ahn = mx @ my.T
    w, rand = int(3 * RATE / SCHRITT), int(1.5 * RATE / SCHRITT)
    p0, p1 = max(w, int(0.6 * len(mx))), len(mx) - rand
    q0, q1 = w, min(int(0.4 * len(my)), len(my) - rand)
    best = (-2.0, 0, 0)
    for v in range(q0 - p1, q1 - p0 + 1):  # Diagonale: q = p + v
        d = np.diagonal(ahn, v)  # d[k] = ahn[k, k + v] (bei v < 0: ahn[k - v, k])
        start = max(0, -v)
        mittel = np.convolve(d, np.ones(w) / w, mode="valid")  # endet bei Index i + w - 1
        for i in range(len(mittel)):
            p = start + i + w
            if p0 <= p < p1 and q0 <= p + v < q1 and mittel[i] > best[0]:
                best = (float(mittel[i]), p, p + v)
    _, p, q = best
    p, q = p * SCHRITT, q * SCHRITT
    # beide Stellen gemeinsam verschieben, bis q kurz vor einem kräftigen Schlag in y liegt:
    # der Einsatz überdeckt den Wechsel
    fein, weite = 256, int(0.35 * RATE)
    stark = einsaetze(y[q - weite - FENSTER // 2:q + weite + FENSTER // 2], fein)
    v = int(np.argmax(stark)) * fein - weite - int(0.01 * RATE)
    p, q = p + v, q + v
    return wellen_angleichen(x, p, y[q - 2048:q]), q


def zusammenfuegen(teile: list[np.ndarray]) -> tuple[np.ndarray, int, int]:
    """Teile hintereinander, an den Übergängen 120 ms überblendet. Rückgabe: das ganze
    Stück, Anfang und Ende der Schleife (Ende gleicht dem Anfang, zurück in Teil 1)."""
    f = int(0.12 * RATE)
    rampe = np.sqrt(np.linspace(0, 1, f))
    y, versatz = teile[0], 0
    for i, z in enumerate(teile[1:], 1):
        p, q = uebergang_finden(teile[i - 1], z)
        p += versatz  # Stelle im bisherigen Stück
        neu = y[:p].copy()
        neu[p - f:] = y[p - f:p] * rampe[::-1] + z[q - f:q] * rampe
        print(f"  Teil {i} → {i + 1}: bei {p / RATE:.2f} s weiter mit {q / RATE:.2f} s")
        y, versatz = np.concatenate([neu, z[q:]]), p - q
    p, a = uebergang_finden(teile[-1], teile[0])
    print(f"  Teil {len(teile)} → 1: Schleife {a / RATE:.2f}–{(p + versatz) / RATE:.2f} s")
    return y, a, p + versatz


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
    return a, wellen_angleichen(x, e, x[a - 2048:a])


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
    stuecke = {os.path.splitext(os.path.basename(p))[0]: [p]
               for p in glob.glob(os.path.join(QUELLE, "*.mp3"))}
    for ordner in glob.glob(os.path.join(QUELLE, "*", "")):
        stuecke[os.path.basename(ordner[:-1])] = sorted(glob.glob(os.path.join(ordner, "*.mp3")))
    for name, pfade in sorted(stuecke.items()):
        if len(pfade) == 1:
            x = lesen(pfade[0])
            a, e = schleife_finden(x)
        else:
            tempi = [tempo_schaetzen(lesen(p)) for p in pfade]
            ziel = float(np.median(tempi))
            print(f"{name}: Tempi {', '.join(f'{t:.1f}' for t in tempi)} → alle auf {ziel:.1f}")
            x, a, e = zusammenfuegen([lesen(p, ziel / t) for p, t in zip(pfade, tempi)])
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
