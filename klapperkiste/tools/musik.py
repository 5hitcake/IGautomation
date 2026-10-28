"""Hintergrundmusik als Datendatei für den Browser.

Die Stücke in assets/ton/musik/*.mp3 sind mit MiniMax Music (Hugging Face Space
victor/MiniMax-Music3-Jam) erzeugt, rein instrumental. Dieses Werkzeug schneidet
Stille am Anfang und Ende weg, macht sie mono mit 64 kbit/s und schreibt
design/musik_daten.js. ton.js spielt sie in Schleife mit weicher Überblendung;
fehlt die Datei, nimmt es die selbst gespielten Noten.

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

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
QUELLE = os.path.join(ROOT, "assets", "ton", "musik")
ZIEL = os.path.join(ROOT, "design", "musik_daten.js")
STILLE = "silenceremove=start_periods=1:start_threshold=-45dB,areverse," \
         "silenceremove=start_periods=1:start_threshold=-45dB,areverse"


def umwandeln(pfad: str) -> bytes:
    befehl = ["ffmpeg", "-v", "error", "-i", pfad, "-af", STILLE, "-ac", "1", "-ar", "44100",
              "-b:a", "64k", "-f", "mp3", "-"]
    return subprocess.run(befehl, check=True, capture_output=True).stdout


def main() -> int:
    daten = {}
    for pfad in sorted(glob.glob(os.path.join(QUELLE, "*.mp3"))):
        name = os.path.splitext(os.path.basename(pfad))[0]
        roh = umwandeln(pfad)
        daten[name] = "data:audio/mpeg;base64," + base64.b64encode(roh).decode("ascii")
        print(f"{name}: {len(roh) // 1024} KB")
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/musik.py. Nicht von Hand ändern.\n")
        f.write("window.MUSIK_DATEN = " + json.dumps(daten) + ";\n")
    print(f"{os.path.relpath(ZIEL)}: {os.path.getsize(ZIEL) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
