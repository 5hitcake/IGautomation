"""Einmalige Bearbeitung: Schrottplatz (Ort, 26 m breit) für die Karte.

Freistellen, auf das Bild zuschneiden (7, 53, 783, 1168) und auf 26 m (832 px)
bringen, weiße Reste am Weg entfernen und den Weg unten auslaufen lassen.
Zaun, Wracks, Bagger und Hütte sind in design/kartenprobe.html in Bildpixeln
dieses Ausschnitts vermessen und werden dort umgerechnet.

Aufruf:
  python klapperkiste/tools/einmalig/schrottplatz_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import objekt  # noqa: E402
import teilwerk  # noqa: E402


def main() -> int:
    roh = Image.open(os.path.join(objekt.OBJEKT_DIR, "roh", "schrottplatz.jpg"))
    f = teilwerk.freistellen(roh, inseln=False)
    f = f.crop((7, 53, 783, 1168))
    f = f.resize((26 * 32, round(f.height * 26 * 32 / f.width)), Image.LANCZOS)
    # weiße Reste am Weg entfernen und den Weg unten weich auslaufen lassen (3 m)
    px = f.load()
    for y in range(f.height * 3 // 4, f.height):
        for x in range(f.width):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 175 and max(r, g, b) - min(r, g, b) < 40:
                px[x, y] = (r, g, b, 0)
    aus = 3 * 32
    for y in range(f.height - aus, f.height):
        k = (f.height - y) / aus
        for x in range(f.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, round(a * k))
    ziel = os.path.join(objekt.OBJEKT_DIR, "schrottplatz.png")
    f.save(ziel)
    print(os.path.relpath(ziel), f.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
