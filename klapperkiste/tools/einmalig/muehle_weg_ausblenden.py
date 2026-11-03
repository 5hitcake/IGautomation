"""Einmalige Bearbeitung: Mühle von oben, Weg unten weich in den Mühlenweg übergehen lassen.

Nach dem Einpassen mit weichem Rand wird der untere Teil des Bilds (der Weg, der aus dem
Hof führt) zusätzlich über einige Meter nach unten hin ausgeblendet. So liegt der Weg im
Bild auf dem gemalten Mühlenweg der Karte, ohne harte Kante.

Aufruf:
  python klapperkiste/tools/objekt.py einpassen klapperkiste/assets/karte/objekte/roh/muehle.jpg muehle \\
    --meter 22 --weicher-rand 0.9 --rand-schutz 0,0,1,0.47
  python klapperkiste/tools/einmalig/muehle_weg_ausblenden.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PFAD = os.path.join(ROOT, "assets", "karte", "objekte", "muehle.png")
AB = 0.66      # ab diesem Höhenanteil beginnt das Ausblenden
BIS = 0.97     # hier ist es ganz durchsichtig


def main() -> int:
    bild = Image.open(PFAD).convert("RGBA")
    w, h = bild.size
    rampe = Image.new("L", (1, h))
    for y in range(h):
        f = (y / h - AB) / (BIS - AB)
        f = max(0.0, min(1.0, f))
        rampe.putpixel((0, y), round(255 * (1 - f * f * (3 - 2 * f))))
    bild.putalpha(ImageChops.multiply(bild.getchannel("A"), rampe.resize((w, h))))
    bild.save(PFAD)
    print(f"{os.path.relpath(PFAD)}: Weg unten ausgeblendet ({AB:.0%} bis {BIS:.0%} der Höhe)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
