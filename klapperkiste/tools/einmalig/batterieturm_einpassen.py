"""Einmalige Bearbeitung: Batterie-Turm.

Seite (links) und Draufsicht (rechts) liegen nebeneinander und werden an der
Lücke getrennt. Die Draufsicht liegt quer; der Tank-Platz ist schmal und hoch
(1 × 2), darum wird sie um 90° gedreht. In der Seitenansicht wird die weiße
Lücke unter dem Bügel des Messerschalters durchsichtig gemacht.

Aufruf:
  python klapperkiste/tools/einmalig/batterieturm_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "batterieturm")
ROH = os.path.join(TEIL, "roh")
TRENNUNG_X = 700  # in der Lücke zwischen Seite (links) und Draufsicht (rechts)
BUEGEL = (72, 32)  # Pixel in der Lücke unter dem Schalterbügel (eingepasste Seitenansicht)


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "batterieturm_blatt.jpg")).convert("RGB")
    seite = os.path.join(ROH, "batterieturm_seite.png")
    oben = os.path.join(ROH, "batterieturm_oben_gedreht.png")
    blatt.crop((0, 0, TRENNUNG_X, blatt.height)).save(seite)
    rechts = blatt.crop((TRENNUNG_X, 0, blatt.width, blatt.height))
    rechts.rotate(90, expand=True, fillcolor=(255, 255, 255)).save(oben)
    teilwerk.main(["einpassen", seite, "energie", "seite", os.path.join(TEIL, "seite.png"), "--keine-inseln"])
    teilwerk.main(["einpassen", oben, "energie", "oben", os.path.join(TEIL, "oben.png"), "--keine-inseln"])
    pfad = os.path.join(TEIL, "seite.png")
    bild = Image.open(pfad).convert("RGBA")
    rgb = bild.convert("RGB")
    if min(rgb.getpixel(BUEGEL)) < 200:
        raise SystemExit(f"{BUEGEL} ist nicht weiß: {rgb.getpixel(BUEGEL)}")
    ImageDraw.floodfill(rgb, BUEGEL, (1, 254, 3), thresh=40)
    loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
    bild.putalpha(ImageChops.multiply(bild.getchannel("A"), loch.point(lambda v: 255 if v > 0 else 0)))
    bild.save(pfad)
    return 0


if __name__ == "__main__":
    sys.exit(main())
