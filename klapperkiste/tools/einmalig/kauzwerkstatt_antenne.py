"""Einmalige Bearbeitung: Kauz' Werkstatt (Kartenobjekt), weißer Rest in der Antenne.

Zwischen Mast und Kabeln der Antenne oben rechts bleibt nach dem Freistellen
Papierweiß stehen. Helle, farblose Pixel im Antennenbereich werden durchsichtig,
nur die Glühbirnen der beiden Lampen bleiben.

Aufruf:
  python klapperkiste/tools/objekt.py einpassen \
    klapperkiste/assets/karte/objekte/roh/kauzwerkstatt.jpg kauzwerkstatt --meter 24
  python klapperkiste/tools/einmalig/kauzwerkstatt_antenne.py
"""

from __future__ import annotations

import math
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PFAD = os.path.join(ROOT, "assets", "karte", "objekte", "kauzwerkstatt.png")
ANTENNE = (525, 15, 625, 140)       # Bereich in Pixeln (Bild 768 px breit)
LAMPEN = [(547, 98), (607, 111)]    # Mitte der Glühbirnen, die bleiben
LAMPE_R = 11


def main() -> int:
    bild = Image.open(PFAD).convert("RGBA")
    px = bild.load()
    x0, y0, x1, y1 = ANTENNE
    n = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            weiss = a and min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 30
            if weiss and all(math.hypot(x - lx, y - ly) > LAMPE_R for lx, ly in LAMPEN):
                px[x, y] = (r, g, b, 0)
                n += 1
    bild.save(PFAD)
    print(f"{os.path.relpath(PFAD)}: {n} px Weiß in der Antenne entfernt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
