"""Einmalige Bearbeitung: Spezialhupe, Seitenansicht.

Das Innere der Rohrschleife ist weiß und von Rohr umschlossen. Die normale
Lochsuche würde auch einen langen Glanzstreifen auf dem Rohr entfernen, darum
wird nur die Schleife gezielt durchsichtig gemacht (Füllen ab einem Punkt darin).
Vorher: python klapperkiste/tools/teilwerk.py blatt … spezialhupe hupe --keine-inseln

Aufruf:
  python klapperkiste/tools/einmalig/hupe_schleife.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

PFAD = os.path.join(teilwerk.TEILE_DIR, "spezialhupe", "seite.png")
PUNKT = (0.45, 0.64)  # Mitte der Schleife, Anteile der Bildgröße


def main() -> int:
    bild = Image.open(PFAD).convert("RGBA")
    rgb = bild.convert("RGB")
    start = (round(PUNKT[0] * bild.width), round(PUNKT[1] * bild.height))
    if min(rgb.getpixel(start)) < 200:
        raise SystemExit(f"Punkt {start} liegt nicht im weißen Inneren der Schleife.")
    ImageDraw.floodfill(rgb, start, (1, 254, 3), thresh=60)
    loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
    bild.putalpha(ImageChops.multiply(bild.getchannel("A"), loch.point(lambda v: 255 if v > 0 else 0)))
    bild.save(PFAD)
    print(f"{os.path.relpath(PFAD)}: Schleife freigestellt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
