"""Einmalige Bearbeitung: Hildes Mähbalken (Kategorie Vorne) passend zur Box machen.

Die Box „Vorne“ ist in der Draufsicht 1 × 4 Zellen groß (der Balken reicht über die
ganze Autobreite), das gelieferte Bild ist aber fast quadratisch. Deshalb wird in der
Draufsicht der Messerbalken verlängert: Ein Streifen mit genau einem Zahn wird über
und unter dem Getriebe mehrmals wiederholt. Die lange Halterung links wird gekürzt.
In der Seitenansicht fällt nur ein Teil der Halteplatte weg.

Aufruf:
  python klapperkiste/tools/einmalig/maehbalken_lang.py
  python klapperkiste/tools/teilwerk.py blatt klapperkiste/assets/teile/maehbalken/blatt.png maehbalken vorne
"""

from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ORDNER = os.path.join(ROOT, "assets", "teile", "maehbalken")
SEITE = (560, 40, 935, 360)      # Seitenansicht im Rohbild (Halteplatte vorne gekürzt)
OBEN = (630, 415, 910, 740)      # Draufsicht ohne den langen Haltearm
ZAHN_OBEN = (43, 80)             # ein Zahn über dem Getriebe (Zeilen in OBEN)
ZAHN_UNTEN = (228, 265)          # ein Zahn unter dem Getriebe
WIEDERHOLEN = 10                 # so oft je Seite zusätzlich


def verlaengern(oben: Image.Image) -> Image.Image:
    w = oben.width
    a, b = ZAHN_OBEN
    c, d = ZAHN_UNTEN
    teile = [oben.crop((0, 0, w, b))]
    teile += [oben.crop((0, a, w, b))] * WIEDERHOLEN
    teile.append(oben.crop((0, b, w, d)))
    teile += [oben.crop((0, c, w, d))] * WIEDERHOLEN
    teile.append(oben.crop((0, d, w, oben.height)))
    neu = Image.new("RGB", (w, sum(t.height for t in teile)), "white")
    y = 0
    for t in teile:
        neu.paste(t, (0, y))
        y += t.height
    return neu


def main() -> int:
    roh = Image.open(os.path.join(ORDNER, "blatt_roh.jpg")).convert("RGB")
    seite = roh.crop(SEITE)
    oben = verlaengern(roh.crop(OBEN))
    luecke = 80
    breite, hoehe = max(seite.width, oben.width) + 40, seite.height + oben.height + luecke + 40
    blatt = Image.new("RGB", (breite, hoehe), "white")
    blatt.paste(seite, (20, 20))
    blatt.paste(oben, (20, 20 + seite.height + luecke))
    ziel = os.path.join(ORDNER, "blatt.png")
    blatt.save(ziel)
    print(f"{os.path.relpath(ziel)}: {blatt.width}×{blatt.height} px (Draufsicht {oben.width}×{oben.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
