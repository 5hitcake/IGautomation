"""Einmalige Bearbeitung: Raketen-Triebwerk ohne Düsentrichter, gespiegelt.

Der Trichter mit der Flamme rechts wirkt verdreht. Er wird hinter dem letzten
Blechring abgeschnitten, die Schnittkante bekommt eine schwarze Kontur, danach
wird das ganze Blatt gespiegelt: Lufteinlass vorne (rechts), offenes Ende hinten.
Danach: python klapperkiste/tools/teilwerk.py blatt …/raketenmotor_blatt.png raketenmotor motor

Aufruf:
  python klapperkiste/tools/einmalig/raketenmotor_ohne_duese.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "raketenmotor", "roh")
SCHNITT_X = 926  # direkt hinter dem letzten Blechring, vor dem Kupferring der Düse


def main() -> int:
    bild = Image.open(os.path.join(ROH, "raketenmotor_original.jpg")).convert("RGB")
    d = ImageDraw.Draw(bild)
    d.rectangle((SCHNITT_X, 0, bild.width, bild.height), fill=(255, 255, 255))
    px = bild.load()
    # Kontur an der Schnittkante, nur wo Triebwerk ist
    for y in range(bild.height):
        if min(px[SCHNITT_X - 3, y]) < 235:
            d.line([(SCHNITT_X - 5, y), (SCHNITT_X, y)], fill=(12, 10, 14))
    bild = bild.transpose(Image.FLIP_LEFT_RIGHT)
    ziel = os.path.join(ROH, "raketenmotor_blatt.png")
    bild.save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
