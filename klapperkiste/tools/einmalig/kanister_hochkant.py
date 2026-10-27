"""Einmalige Bearbeitung: Benzinkanister hochkant.

Das Blatt zeigt den Kanister liegend, gut dreimal so breit wie hoch. Der Tank-Platz
ist schmal und hoch (1 × 2). Beide Ansichten werden um 90° gegen den Uhrzeigersinn
gedreht: Der Kanister steht dann aufrecht, der Verschluss ist oben.

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
TRENNUNG_Y = 410  # zwischen Seiten- und Draufsicht


def main() -> int:
    blatt = Image.open(os.path.join(ROH, "kanister_blatt.jpg")).convert("RGB")
    teile = {"seite": blatt.crop((0, 0, blatt.width, TRENNUNG_Y)),
             "oben": blatt.crop((0, TRENNUNG_Y, blatt.width, blatt.height))}
    for ansicht, bild in teile.items():
        roh = os.path.join(ROH, f"kanister_{ansicht}_hochkant.png")
        bild.rotate(90, expand=True, fillcolor=(255, 255, 255)).save(roh)
        teilwerk.main(["einpassen", roh, "energie", ansicht, os.path.join(TEIL, f"{ansicht}.png")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
