"""Einmalige Bearbeitung: Kutschenrad.

Seite (links) und Draufsicht (rechts) liegen nebeneinander und werden getrennt.
In der Seitenansicht entfernt die normale Lochsuche das Weiß zwischen den Speichen.

Aufruf:
  python klapperkiste/tools/einmalig/kutschenrad_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "kutschenrad")
ROH = os.path.join(TEIL, "roh")
TRENNUNG_X = 700  # zwischen Rad (links) und Draufsicht (rechts)


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "kutschenrad_blatt.jpg")).convert("RGB")
    boxen = {"seite": (0, 0, TRENNUNG_X, blatt.height), "oben": (TRENNUNG_X, 0, blatt.width, blatt.height)}
    for ansicht, box in boxen.items():
        roh = os.path.join(ROH, f"kutschenrad_{ansicht}.png")
        blatt.crop(box).save(roh)
        teilwerk.main(["einpassen", roh, "rad", ansicht, os.path.join(TEIL, f"{ansicht}.png")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
