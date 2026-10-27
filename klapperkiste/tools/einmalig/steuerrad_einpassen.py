"""Einmalige Bearbeitung: Schiffs-Steuerrad.

Das Blatt hat die Draufsicht quer liegend; der Lenkungs-Platz ist aber schmal und
hoch (1 × 2). Die Draufsicht wird darum um 90° gedreht, damit der lange Steg von
oben nach unten läuft (wie beim Fahrradlenker). Beide Ansichten werden einzeln
eingepasst.

Aufruf:
  python klapperkiste/tools/einmalig/steuerrad_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "steuerrad")
ROH = os.path.join(TEIL, "roh")
TRENNUNG_Y = 455  # zwischen Seiten- und Draufsicht


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "steuerrad_blatt.jpg")).convert("RGB")
    seite = os.path.join(ROH, "steuerrad_seite.png")
    oben = os.path.join(ROH, "steuerrad_oben_gedreht.png")
    blatt.crop((0, 0, blatt.width, TRENNUNG_Y)).save(seite)
    unten = blatt.crop((0, TRENNUNG_Y, blatt.width, blatt.height))
    unten.rotate(90, expand=True, fillcolor=(255, 255, 255)).save(oben)
    teilwerk.main(["einpassen", seite, "lenkung", "seite", os.path.join(TEIL, "seite.png")])
    teilwerk.main(["einpassen", oben, "lenkung", "oben", os.path.join(TEIL, "oben.png")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
