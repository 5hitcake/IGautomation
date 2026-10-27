"""Einmalige Bearbeitung: Autoreifen ohne grauen Schlagschatten.

Das Blatt hat links neben Rad und Lauffläche einen grauen Schatten. Er wird wie
bei den Tieren entfernt (helles Grau, von außen erreichbar, ohne die schwarze
Kontur zu kreuzen), danach werden beide Ansichten eingepasst. Keine Lochsuche,
sonst verschwinden Glanzlichter auf der Felge.

Aufruf:
  python klapperkiste/tools/einmalig/autoreifen_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402
import tiere  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "autoreifen")
ROH = os.path.join(TEIL, "roh")
TRENNUNG_Y = 535  # zwischen Rad (oben) und Lauffläche (unten)


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "autoreifen_blatt.jpg")).convert("RGB")
    boxen = {"seite": (0, 0, blatt.width, TRENNUNG_Y), "oben": (0, TRENNUNG_Y, blatt.width, blatt.height)}
    for ansicht, box in boxen.items():
        teil = tiere.ohne_schatten(teilwerk.freistellen(blatt.crop(box), inseln=False))
        teil = teil.crop(teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox())
        roh = os.path.join(ROH, f"autoreifen_{ansicht}_frei.png")
        teil.save(roh)
        ziel = os.path.join(TEIL, f"{ansicht}.png")
        teilwerk.main(["einpassen", roh, "rad", ansicht, ziel, "--keine-inseln"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
