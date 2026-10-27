"""Einmalige Bearbeitung: Mopedmotor.

1. Vorher: In der Draufsicht ragt das Auspuffrohr weit nach links hinaus und wirkt
   unpassend. Alles links vom runden Zylinder (untere Bildhälfte) wird weiß.
2. Nachher (--nachher, nach teilwerk blatt): In der Seitenansicht ist das Innere der
   Auspuffschleife (und unter Kabel und Sockel) weiß und eingeschlossen; das wird gezielt durchsichtig (eine
   allgemeine Lochsuche würde auch die Glanzlichter auf dem Chrom entfernen).

Aufruf:
  python klapperkiste/tools/einmalig/mopedmotor_ohne_rohr.py
  python klapperkiste/tools/teilwerk.py blatt …/mopedmotor_blatt.png mopedmotor motor --keine-inseln
  python klapperkiste/tools/einmalig/mopedmotor_ohne_rohr.py --nachher
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "mopedmotor")
ROH = os.path.join(TEIL, "roh")
DRAUFSICHT_Y = 390   # ab hier beginnt die Draufsicht
ZYLINDER_X = 614     # linke Kante des runden Zylinders in der Draufsicht
# Eingeschlossene weiße Flächen der Seitenansicht (Anteile): unter dem Kabelbogen,
# in der Auspuffschleife, unter dem Bogen des Sockels
INNEN = [(0.45, 0.33), (0.12, 0.78), (0.57, 0.88)]


def vorher() -> None:
    bild = Image.open(os.path.join(ROH, "mopedmotor_original.jpg")).convert("RGB")
    ImageDraw.Draw(bild).rectangle((0, DRAUFSICHT_Y, ZYLINDER_X, bild.height), fill=(255, 255, 255))
    ziel = os.path.join(ROH, "mopedmotor_blatt.png")
    bild.save(ziel)
    print(os.path.relpath(ziel))


def nachher() -> None:
    pfad = os.path.join(TEIL, "seite.png")
    bild = Image.open(pfad).convert("RGBA")
    rgb = bild.convert("RGB")
    for fx, fy in INNEN:
        start = (round(fx * bild.width), round(fy * bild.height))
        if min(rgb.getpixel(start)) < 200:
            raise SystemExit(f"Punkt {start} ist nicht weiß: {rgb.getpixel(start)}")
        ImageDraw.floodfill(rgb, start, (1, 254, 3), thresh=60)
    loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
    bild.putalpha(ImageChops.multiply(bild.getchannel("A"), loch.point(lambda v: 255 if v > 0 else 0)))
    bild.save(pfad)
    print(f"{os.path.relpath(pfad)}: {len(INNEN)} weiße Flächen freigestellt")


if __name__ == "__main__":
    nachher() if "--nachher" in sys.argv else vorher()
