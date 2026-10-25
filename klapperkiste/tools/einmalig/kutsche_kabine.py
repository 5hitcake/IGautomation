"""Einmalige Bearbeitung: Kutschenkabine ganz ins Mittelteil schieben.

Im gelieferten Bild reicht die Kabine über die vordere Naht (x=6) und wird
beim Schneiden geteilt. Das Bild wird waagerecht stückweise verzerrt: das Heck
etwas gestaucht, die Kabine fast unverändert nach links verschoben, die
Vorderpartie etwas gestreckt. Gilt für Seite und Draufsicht gleich, beide
Ansichten bleiben übereinander ausgerichtet.

Aufruf:
  python klapperkiste/tools/einmalig/kutsche_kabine.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "kutsche-roh")

# Stützstellen alt -> neu (x im Originalbild 1408 x 768). Auto von 75 bis 1345,
# eine Zelle sind 127 px, die Nähte liegen bei 456 und 837.
# Kabine (Dachkontur) 543..925 -> 466..830, mit etwas Luft zu beiden Nähten.
STUETZEN = [(0, 0), (75, 75), (543, 466), (925, 830), (1345, 1345), (1408, 1408)]


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB")
    neu = Image.new("RGB", bild.size, (255, 255, 255))
    for (a0, b0), (a1, b1) in zip(STUETZEN, STUETZEN[1:]):
        stueck = bild.crop((a0, 0, a1, bild.height)).resize((b1 - b0, bild.height), Image.LANCZOS)
        neu.paste(stueck, (b0, 0))
    return neu


def main() -> int:
    original = Image.open(os.path.join(ROH, "kutsche_blatt.jpg"))
    ziel = os.path.join(ROH, "kutsche_blatt.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: Kabine ins Mittelteil verschoben")
    return 0


if __name__ == "__main__":
    sys.exit(main())
