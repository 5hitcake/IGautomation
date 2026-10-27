"""Einmalige Bearbeitung: Milchkanne.

Die beiden Ansichten liegen nebeneinander statt untereinander. Sie werden an
der Lücke getrennt. In der Seitenansicht hängt der Schlauch unter die Kanne;
er wird am Kannenboden abgeschnitten, sonst würde die Kanne über dem Rahmen
schweben. Die Glanzlichter auf dem Aluminium sind weiß, darum keine allgemeine
Lochsuche; nur die Öffnungen der Griffe werden gezielt durchsichtig.

Aufruf:
  python klapperkiste/tools/einmalig/milchkanne_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "milchkanne")
ROH = os.path.join(TEIL, "roh")
TRENNUNG_X = 650   # in der Lücke zwischen Seite (links) und Draufsicht (rechts)
BODEN_Y = 722      # unter dem Kannenboden: Schlauchende weg
# Öffnungen der Griffe (Anteile der eingepassten Bilder); der nächste weiße Punkt zählt
GRIFFE = {"seite": [(0.04, 0.40), (0.96, 0.41), (0.45, 0.22)], "oben": [(0.07, 0.47), (0.93, 0.48)]}


def griffe_frei(pfad: str, punkte: list[tuple[float, float]]) -> None:
    bild = Image.open(pfad).convert("RGBA")
    for fx, fy in punkte:
        rgb = bild.convert("RGB")
        cx, cy = round(fx * (bild.width - 1)), round(fy * (bild.height - 1))
        kandidaten = [(x, y) for y in range(cy - 8, cy + 9) for x in range(cx - 8, cx + 9)
                      if 0 <= x < bild.width and 0 <= y < bild.height
                      and bild.getpixel((x, y))[3] > 0 and min(rgb.getpixel((x, y))) > 215]
        if not kandidaten:
            print(f"{os.path.basename(pfad)}: bei {(cx, cy)} keine weiße Öffnung gefunden")
            continue
        start = min(kandidaten, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
        ImageDraw.floodfill(rgb, start, (1, 254, 3), thresh=40)
        loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
        loch = loch.point(lambda v: 255 if v > 0 else 0)
        if loch.histogram()[0] > 0.02 * bild.width * bild.height:
            print(f"{os.path.basename(pfad)}: Fläche bei {start} zu groß, übersprungen")
            continue
        bild.putalpha(ImageChops.multiply(bild.getchannel("A"), loch))
    bild.save(pfad)


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "milchkanne_blatt.jpg")).convert("RGB")
    seite = blatt.crop((0, 0, TRENNUNG_X, blatt.height))
    ImageDraw.Draw(seite).rectangle((0, BODEN_Y, seite.width, seite.height), fill=(255, 255, 255))
    pfade = {v: os.path.join(ROH, f"milchkanne_{v}.png") for v in ("seite", "oben")}
    seite.save(pfade["seite"])
    blatt.crop((TRENNUNG_X, 0, blatt.width, blatt.height)).save(pfade["oben"])
    for ansicht, pfad in pfade.items():
        ziel = os.path.join(TEIL, f"{ansicht}.png")
        teilwerk.main(["einpassen", pfad, "energie", ansicht, ziel, "--keine-inseln"])
        griffe_frei(ziel, GRIFFE[ansicht])
    return 0


if __name__ == "__main__":
    sys.exit(main())
