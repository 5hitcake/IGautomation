"""Einmalige Bearbeitung: Ballonreifen.

Unter dem Rad liegt in der Seitenansicht ein Sandhäufchen; damit wäre das Rad
nicht mehr rund und säße zu hoch. Alles unter der Unterkante des Reifens wird
weiß. Keine allgemeine Lochsuche (die Glanzstreifen auf dem Reifen sind weiß);
nur die Nabenbohrung in der Mitte der Seitenansicht wird gezielt durchsichtig.

Aufruf:
  python klapperkiste/tools/einmalig/ballonreifen_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "ballonreifen")
ROH = os.path.join(TEIL, "roh")
REIFEN_UNTEN = 400   # Unterkante des Reifens (Seitenansicht), darunter liegt Sand
TRENNUNG_Y = 460     # zwischen Seiten- und Draufsicht


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "ballonreifen_blatt.jpg")).convert("RGB")
    seite = blatt.crop((0, 0, blatt.width, TRENNUNG_Y))
    ImageDraw.Draw(seite).rectangle((0, REIFEN_UNTEN, seite.width, seite.height), fill=(255, 255, 255))
    pfade = {v: os.path.join(ROH, f"ballonreifen_{v}.png") for v in ("seite", "oben")}
    seite.save(pfade["seite"])
    blatt.crop((0, TRENNUNG_Y, blatt.width, blatt.height)).save(pfade["oben"])
    for ansicht, pfad in pfade.items():
        ziel = os.path.join(TEIL, f"{ansicht}.png")
        teilwerk.main(["einpassen", pfad, "rad", ansicht, ziel, "--keine-inseln"])
    pfad = os.path.join(TEIL, "seite.png")
    bild = Image.open(pfad).convert("RGBA")
    rgb = bild.convert("RGB")
    mitte = (bild.width // 2, bild.height // 2)
    if min(rgb.getpixel(mitte)) > 200:
        ImageDraw.floodfill(rgb, mitte, (1, 254, 3), thresh=40)
        loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
        bild.putalpha(ImageChops.multiply(bild.getchannel("A"), loch.point(lambda v: 255 if v > 0 else 0)))
        bild.save(pfad)
    return 0


if __name__ == "__main__":
    sys.exit(main())
