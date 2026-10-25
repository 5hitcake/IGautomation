"""Einmalige Bearbeitung: Mini-Wohnwagen (Version 2) aufräumen.

Der Generator hat eine Beschriftung zwischen die Ansichten geschrieben und ein
Markenlogo auf die Front gemalt. Beides wird mit der Umgebungsfarbe übermalt.

Aufruf:
  python klapperkiste/tools/einmalig/wohnwagen_aufraeumen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "wohnwagen-roh")

# Maße im Originalbild (1408 x 768), vermessen
SCHRIFT = (530, 372, 900, 410)    # Beschriftung zwischen den Ansichten
LOGO = (1200, 557, 1241, 607)     # Markenlogo vorne in der Draufsicht
LOGO_FARBE_BEI = (1195, 555)      # cremefarbene Front daneben


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB").copy()
    d = ImageDraw.Draw(bild)
    d.rectangle(SCHRIFT, fill=(255, 255, 255))
    d.ellipse(LOGO, fill=bild.getpixel(LOGO_FARBE_BEI))
    return bild


def main() -> int:
    original = Image.open(os.path.join(ROH, "wohnwagen_blatt_v2_original.jpg"))
    ziel = os.path.join(ROH, "wohnwagen_blatt_v2.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: Schrift und Logo entfernt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
