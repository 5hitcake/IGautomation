"""Gebrummel der Figuren aus zwei gesprochenen Fantasie-Aufnahmen.

Die Aufnahmen (assets/ton/roh/weiblich.wav und maennlich.wav) sind mit einer
Sprachausgabe (Chatterbox auf Hugging Face) aus Fantasie-Silben wie „Mabba lomi,
nuka tefo“ erzeugt, also ohne echte Wörter. Dieses Werkzeug kürzt lange Pausen,
gleicht die Lautstärke an und merkt sich die leisen Stellen zwischen den Silben
(etwa 0,08 bis 0,25 s auseinander). design/stimmen_daten.js enthält je Stimme die
ganze Aufnahme und diese Grenzen. Im Spiel spielt ton.js ab einer zufälligen Grenze
mehrere Silben am Stück, damit sie natürlich ineinander übergehen.

Aufruf:
  python klapperkiste/tools/stimmen.py
"""

from __future__ import annotations

import base64
import io
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROH = os.path.join(ROOT, "assets", "ton", "roh")
ZIEL = os.path.join(ROOT, "design", "stimmen_daten.js")
RATE = 16000
STIMMEN = ["weiblich", "maennlich"]
KURZ, LANG = 0.08, 0.25  # Silbenlänge in Sekunden


def lesen(pfad: str) -> np.ndarray:
    """WAV mit ffmpeg auf 16 kHz mono bringen und als Zahlen -1..1 lesen."""
    befehl = ["ffmpeg", "-v", "error", "-i", pfad, "-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"]
    roh = subprocess.run(befehl, check=True, capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768


def silben(x: np.ndarray) -> list[tuple[int, int]]:
    """Abschnitte zwischen leisen Stellen; zu lange werden am leisesten Punkt geteilt."""
    hop = RATE // 100  # 10 ms
    energie = np.array([np.abs(x[i:i + hop]).mean() for i in range(0, len(x) - hop, hop)])
    glatt = np.convolve(energie, np.ones(3) / 3, mode="same")
    schwelle = np.percentile(glatt, 95) * 0.12
    laut = glatt > schwelle
    stuecke, start = [], None
    for i, an in enumerate(np.append(laut, False)):
        if an and start is None:
            start = i
        elif not an and start is not None:
            stuecke.append((start, i))
            start = None
    ergebnis = []
    kurz, lang = int(KURZ * 100), int(LANG * 100)
    while stuecke:
        a, b = stuecke.pop(0)
        if b - a < kurz:
            continue
        if b - a > lang:  # am leisesten Punkt in der Mitte teilen
            mitte = a + kurz + int(np.argmin(glatt[a + kurz:b - kurz])) if b - a > 2 * kurz else (a + b) // 2
            stuecke[0:0] = [(a, mitte), (mitte, b)]
            continue
        ergebnis.append((a * hop, b * hop))
    return ergebnis


def pausen_kuerzen(x: np.ndarray, laengste: float = 0.12) -> np.ndarray:
    """Leise Stellen länger als `laengste` auf diese Länge kürzen, damit es flüssig bleibt."""
    hop = RATE // 100
    energie = np.array([np.abs(x[i:i + hop]).mean() for i in range(0, len(x) - hop, hop)])
    leise = energie < np.percentile(energie, 95) * 0.06
    behalten, n, halb = [], int(laengste * 100), int(laengste * 50)
    i = 0
    while i < len(leise):
        j = i
        while j < len(leise) and leise[j] == leise[i]:
            j += 1
        if leise[i] and j - i > n:
            behalten += [(i, i + halb), (j - halb, j)]
        else:
            behalten.append((i, j))
        i = j
    return np.concatenate([x[a * hop:b * hop] for a, b in behalten])


def angleichen(x: np.ndarray) -> np.ndarray:
    """Langsame Lautstärkeregelung (Fenster 0,3 s), damit leise Silben nicht untergehen."""
    fenster = int(0.3 * RATE)
    huelle = np.sqrt(np.convolve(x ** 2, np.ones(fenster) / fenster, mode="same"))
    ziel = np.percentile(huelle, 90)
    y = x * np.clip(ziel / np.maximum(huelle, 1e-4), 0.5, 3)
    return y * 0.9 / max(1e-4, np.abs(y).max())


def main() -> int:
    daten = {}
    for name in STIMMEN:
        x = angleichen(pausen_kuerzen(lesen(os.path.join(ROH, f"{name}.wav"))))
        grenzen = set()
        for a, b in silben(x):  # leise Stellen kurz vor und nach jeder Silbe
            grenzen.add(round(max(0, a - RATE // 50) / RATE, 3))
            grenzen.add(round(min(len(x), b + RATE // 50) / RATE, 3))
        roh = sorted(grenzen)
        grenzen = [g for i, g in enumerate(roh) if i == 0 or g - roh[i - 1] > 0.03]
        alles = (x * 32767).astype(np.int16)
        puffer = io.BytesIO()
        with wave.open(puffer, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(alles.tobytes())
        daten[name] = {"wav": "data:audio/wav;base64," + base64.b64encode(puffer.getvalue()).decode("ascii"),
                       "grenzen": grenzen}
        print(f"{name}: {len(grenzen)} Grenzen, {len(x) / RATE:.1f} s")
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/stimmen.py. Nicht von Hand ändern.\n")
        f.write("window.STIMMEN_DATEN = " + json.dumps(daten) + ";\n")
    print(f"{os.path.relpath(ZIEL)}: {os.path.getsize(ZIEL) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
