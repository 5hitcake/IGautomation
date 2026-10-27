"""Einmalige Bearbeitung: Traktormotor ohne das lange Getriebe.

Mit Getriebe ist der Motor fast dreimal so lang wie hoch und wird im
quadratischen Motor-Platz winzig. Alles links von SCHNITT_X (Getriebe) wird in
beiden Ansichten weiß, die Schnittkante bekommt eine schwarze Kontur.
Danach: python klapperkiste/tools/teilwerk.py blatt …/traktormotor_blatt.png traktormotor motor --keine-inseln
Zum Schluss (--nachher): in der Draufsicht schmale weiße Streifen zwischen
Schienen und Motorblock durchsichtig machen (nur größere fast weiße Flächen,
kleine Glanzlichter bleiben).

Aufruf:
  python klapperkiste/tools/einmalig/traktormotor_ohne_getriebe.py
  python klapperkiste/tools/einmalig/traktormotor_ohne_getriebe.py --nachher
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "traktormotor", "roh")
SCHNITT_X = 655  # zwischen Getriebe und Motorblock


MIN_FLAECHE = 25  # kleinere weiße Flecken sind Glanzlichter


def nachher() -> None:
    pfad = os.path.join(teilwerk.TEILE_DIR, "traktormotor", "oben.png")
    bild = Image.open(pfad).convert("RGBA")
    px = bild.load()
    b, h = bild.size
    def fast_weiss(p: tuple) -> bool:
        return p[3] > 128 and min(p[:3]) > 210 and max(p[:3]) - min(p[:3]) < 30

    weiss = {(x, y) for y in range(h) for x in range(b) if fast_weiss(px[x, y])}
    weg = 0
    while weiss:
        stapel = [weiss.pop()]
        flaeche = list(stapel)
        while stapel:
            x, y = stapel.pop()
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in weiss:
                    weiss.remove(n)
                    stapel.append(n)
                    flaeche.append(n)
        if len(flaeche) >= MIN_FLAECHE:
            weg += 1
            for x, y in flaeche:
                r, g, bl, _ = px[x, y]
                px[x, y] = (r, g, bl, 0)
    bild.save(pfad)
    print(f"{os.path.relpath(pfad)}: {weg} weiße Flächen entfernt")


def main() -> int:
    if "--nachher" in sys.argv:
        nachher()
        return 0
    bild = Image.open(os.path.join(ROH, "traktormotor_original.jpg")).convert("RGB")
    d = ImageDraw.Draw(bild)
    d.rectangle((0, 0, SCHNITT_X, bild.height), fill=(255, 255, 255))
    px = bild.load()
    for y in range(bild.height):
        if min(px[SCHNITT_X + 4, y]) < 235:
            d.line([(SCHNITT_X + 1, y), (SCHNITT_X + 5, y)], fill=(20, 12, 10))
    ziel = os.path.join(ROH, "traktormotor_blatt.png")
    bild.save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
