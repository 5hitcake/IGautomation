"""Silben für das Gebrummel der Figuren aus zwei gesprochenen Fantasie-Aufnahmen.

Die Aufnahmen (assets/ton/roh/weiblich.wav und maennlich.wav) sind mit einer
Sprachausgabe (Chatterbox auf Hugging Face) aus Fantasie-Silben wie „Mabba lomi,
nuka tefo“ erzeugt, also ohne echte Wörter. Dieses Werkzeug schneidet sie an den
leisen Stellen in einzelne Silben (etwa 0,08 bis 0,25 s), hängt sie zu einer Datei
je Stimme aneinander und schreibt design/stimmen_daten.js mit den Abschnitten.
Im Spiel spielt ton.js zufällige Silben je Figur höher oder tiefer ab.

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


def main() -> int:
    daten = {}
    for name in STIMMEN:
        x = lesen(os.path.join(ROH, f"{name}.wav"))
        teile = silben(x)
        stuecke, abschnitte, pos = [], [], 0
        for a, b in teile:
            s = x[a:b].copy()
            rampe = min(len(s) // 4, RATE // 100 * 2)  # 20 ms ein- und ausblenden
            s[:rampe] *= np.linspace(0, 1, rampe)
            s[-rampe:] *= np.linspace(1, 0, rampe)
            s *= 0.9 / max(1e-4, np.abs(s).max())  # jede Silbe gleich laut
            stuecke.append(s)
            abschnitte.append([round(pos / RATE, 4), round(len(s) / RATE, 4)])
            pos += len(s)
        alles = (np.concatenate(stuecke) * 32767).astype(np.int16)
        puffer = io.BytesIO()
        with wave.open(puffer, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(alles.tobytes())
        daten[name] = {"wav": "data:audio/wav;base64," + base64.b64encode(puffer.getvalue()).decode("ascii"),
                       "silben": abschnitte}
        print(f"{name}: {len(abschnitte)} Silben, {pos / RATE:.1f} s")
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/stimmen.py. Nicht von Hand ändern.\n")
        f.write("window.STIMMEN_DATEN = " + json.dumps(daten) + ";\n")
    print(f"{os.path.relpath(ZIEL)}: {os.path.getsize(ZIEL) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
