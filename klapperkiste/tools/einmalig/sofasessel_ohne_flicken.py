"""Einmalige Bearbeitung: Ohrensessel ohne die aufgenähten Flicken.

Die Flicken passen nicht recht zum Sessel. Jeder wird mit einem Stück Stoff aus
der Nähe überdeckt (wie ein Kopierstempel), mit weichem Rand.
Danach: python klapperkiste/tools/teilwerk.py blatt …/sofasessel_blatt.png sofasessel sitz --keine-inseln

Aufruf:
  python klapperkiste/tools/einmalig/sofasessel_ohne_flicken.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "sofasessel", "roh")
# (Rahmen des Flickens x0, y0, x1, y1), (Versatz dx, dy der Stoffquelle)
FLICKEN = [((440, 194, 510, 228), (-52, 18)),   # Seite, auf der Armlehne (unter der Kontur)
           ((476, 490, 558, 578), (0, 76))]     # Draufsicht, auf dem Sitzkissen


def main() -> int:
    bild = Image.open(os.path.join(ROH, "sofasessel_blatt.jpg")).convert("RGB")
    for (x0, y0, x1, y1), (dx, dy) in FLICKEN:
        stoff = bild.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy))
        maske = Image.new("L", stoff.size, 0)
        ImageDraw.Draw(maske).rounded_rectangle((4, 4, stoff.width - 5, stoff.height - 5), radius=8, fill=255)
        bild.paste(stoff, (x0, y0), maske.filter(ImageFilter.GaussianBlur(3)))
    ziel = os.path.join(ROH, "sofasessel_blatt.png")
    bild.save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
