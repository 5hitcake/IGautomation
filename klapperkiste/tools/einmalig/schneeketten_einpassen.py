"""Einmalige Bearbeitung: Rad mit Schneeketten.

Das Blatt hat links das Rad von der Seite und rechts zwei Draufsichten
übereinander; genommen wird die obere. Keine Lochsuche, sonst verschwindet der
Schnee zwischen den Kettengliedern.

Aufruf:
  python klapperkiste/tools/einmalig/schneeketten_einpassen.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

TEIL = os.path.join(teilwerk.TEILE_DIR, "schneeketten")
ROH = os.path.join(TEIL, "roh")
SEITE = (0, 0, 700, 768)        # Rad von der Seite
OBEN = (700, 0, 1408, 370)      # obere der beiden Draufsichten


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "schneeketten_blatt.jpg")).convert("RGB")
    for ansicht, box in (("seite", SEITE), ("oben", OBEN)):
        roh = os.path.join(ROH, f"schneeketten_{ansicht}.png")
        blatt.crop(box).save(roh)
        ziel = os.path.join(TEIL, f"{ansicht}.png")
        teilwerk.main(["einpassen", roh, "rad", ansicht, ziel, "--keine-inseln"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
