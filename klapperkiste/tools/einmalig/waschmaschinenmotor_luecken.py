"""Einmalige Bearbeitung: Waschmaschinen-Motor, weiße Lücken am Kabel.

Die Trommel ist selbst weiß, darum keine allgemeine Lochsuche. Gezielt
durchsichtig werden nur die Lücken zwischen Kabelschlaufe und Motor (Seite)
und zwischen Kabel und Trommelende (Draufsicht).
Vorher: python klapperkiste/tools/teilwerk.py blatt …/waschmaschinenmotor_blatt.jpg \
        waschmaschinenmotor motor --keine-inseln

Aufruf:
  python klapperkiste/tools/einmalig/waschmaschinenmotor_luecken.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "waschmaschinenmotor")
LUECKEN = {"seite": [(0.845, 0.83)], "oben": [(0.60, 0.36)]}  # Punkte in den Lücken (Anteile)
MAX_FLAECHE = 0.03  # Sicherung: nie mehr als 3 % des Bildes (sonst wäre es die Trommel)


def main() -> int:
    for ansicht, punkte in LUECKEN.items():
        pfad = os.path.join(TEIL, f"{ansicht}.png")
        bild = Image.open(pfad).convert("RGBA")
        for fx, fy in punkte:
            rgb = bild.convert("RGB")
            start = (round(fx * bild.width), round(fy * bild.height))
            if min(rgb.getpixel(start)) < 200:
                raise SystemExit(f"{ansicht}: Punkt {start} ist nicht weiß: {rgb.getpixel(start)}")
            ImageDraw.floodfill(rgb, start, (1, 254, 3), thresh=45)
            loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
            loch = loch.point(lambda v: 255 if v > 0 else 0)
            flaeche = loch.histogram()[0]
            if flaeche > MAX_FLAECHE * bild.width * bild.height:
                raise SystemExit(f"{ansicht}: Lücke bei {start} ist zu groß ({flaeche} px), Punkt prüfen")
            bild.putalpha(ImageChops.multiply(bild.getchannel("A"), loch))
            print(f"{ansicht}: Lücke bei {start} entfernt ({flaeche} px)")
        bild.save(pfad)
    return 0


if __name__ == "__main__":
    sys.exit(main())
