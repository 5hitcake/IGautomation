"""Einmalige Bearbeitung: Traktormotor ohne das lange Getriebe.

Mit Getriebe ist der Motor fast dreimal so lang wie hoch und wird im
quadratischen Motor-Platz winzig. Alles links von SCHNITT_X (Getriebe) wird in
beiden Ansichten weiß, die Schnittkante bekommt eine schwarze Kontur.
Danach: python klapperkiste/tools/teilwerk.py blatt …/traktormotor_blatt.png traktormotor motor --keine-inseln

Aufruf:
  python klapperkiste/tools/einmalig/traktormotor_ohne_getriebe.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "traktormotor", "roh")
SCHNITT_X = 655  # zwischen Getriebe und Motorblock


def main() -> int:
    bild = Image.open(os.path.join(ROH, "traktormotor_original.jpg")).convert("RGB")
    d = ImageDraw.Draw(bild)
    d.rectangle((0, 0, SCHNITT_X, bild.height), fill=(255, 255, 255))
    px = bild.load()
    for y in range(bild.height):
        if min(px[SCHNITT_X + 4, y]) < 235:
            d.line([(SCHNITT_X + 1, y), (SCHNITT_X + 5, y)], fill=(20, 12, 10))
    ziel = os.path.join(ROH, "traktormotor_blatt.png")
    bild.save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
