"""Einmalige Bearbeitung: Zirkus-Karosserie, doppelte Clownsnase in der Draufsicht.

In der Draufsicht sitzt neben der Nase an der Spitze eine zweite rote Nase
mitten auf der Haube. Sie wird mit dem Streifenmuster links daneben übermalt;
die Streifen laufen dort waagerecht, ein waagerecht verschobenes Stück passt.

Aufruf:
  python klapperkiste/tools/einmalig/zirkus_nase.py
  (danach kabine_mitte.py zirkus_blatt.png zirkus_blatt.png 545 990)
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "zirkus-roh")
NASE = (1178, 526, 1292, 646)   # zweite Nase auf der Haube (mit Kontur)
VERSATZ = 130                   # Streifenstück so weit links davon


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB").copy()
    x0, y0, x1, y1 = NASE
    bild.paste(bild.crop((x0 - VERSATZ, y0, x1 - VERSATZ, y1)), (x0, y0))
    return bild


def main() -> int:
    original = Image.open(os.path.join(ROH, "zirkus_blatt_original.jpg"))
    ziel = os.path.join(ROH, "zirkus_blatt.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: zweite Nase entfernt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
