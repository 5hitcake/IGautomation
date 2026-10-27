"""Einmalige Bearbeitung: Benzinkanister (zweite Fassung, aufrecht).

Die Seitenansicht steht schon aufrecht. Die Draufsicht liegt quer; der Tank-Platz
ist aber schmal und hoch (1 × 2), darum wird sie um 90° gedreht. Weiße Löcher in
den Griffen werden mit der normalen Lochsuche entfernt.
(Die erste, liegende Fassung liegt als roh/kanister_v1_liegend.jpg daneben.)

Aufruf:
  python klapperkiste/tools/einmalig/kanister_hochkant.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "kanister")
ROH = os.path.join(TEIL, "roh")
TRENNUNG_Y = 1060  # in der Lücke zwischen Seiten- und Draufsicht


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "kanister_blatt.png")).convert("RGB")
    seite = os.path.join(ROH, "kanister_seite.png")
    oben = os.path.join(ROH, "kanister_oben_gedreht.png")
    blatt.crop((0, 0, blatt.width, TRENNUNG_Y)).save(seite)
    unten = blatt.crop((0, TRENNUNG_Y, blatt.width, blatt.height))
    unten.rotate(90, expand=True, fillcolor=(255, 255, 255)).save(oben)
    teilwerk.main(["einpassen", seite, "energie", "seite", os.path.join(TEIL, "seite.png")])
    teilwerk.main(["einpassen", oben, "energie", "oben", os.path.join(TEIL, "oben.png")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
