"""Einmalige Bearbeitung: Wasser-Textur aus dem Mühlgraben der Mühle (von oben).

Das Wasser im Mühlgraben (dunkles Blau mit weißen Schaumkronen) wirkt echter als die
alte Wasser-Kachel. Der Graben ist schmal: Viele kleine, rund ausgeblendete Stücke daraus
werden zufällig (über die Ränder hinweg) auf eine Kachel gestempelt, dann macht boden.py
daraus die Kachel für See und Mühlbach.

Aufruf:
  python klapperkiste/tools/einmalig/wasser_muehle.py
"""

from __future__ import annotations

import os
import random
import sys

from PIL import Image, ImageOps

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import boden  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ROH = os.path.join(ROOT, "assets", "karte", "objekte", "roh", "muehle.jpg")
ZIEL_ROH = os.path.join(ROOT, "assets", "karte", "boden", "roh", "wasser_muehle.png")
QUELLE = (632, 590, 668, 870)    # sauberes Wasser in der Mitte des Grabens (ohne Ufersteine und Rad)
SEITE, STUECK, ANZAHL = 240, 34, 420


def main() -> int:
    roh = Image.open(ROH).convert("RGB")
    x0, y0, x1, y1 = QUELLE
    quelle = roh.crop(QUELLE)
    # Schaum etwas dämpfen und das Ganze blauer machen (wie der Graben auf dem Bild wirkt)
    r, g, b = quelle.split()
    weich = lambda v: v if v < 120 else 120 + (v - 120) * 0.55  # noqa: E731
    quelle = Image.merge("RGB", (r.point(lambda v: weich(v) * 0.82), g.point(lambda v: weich(v) * 0.95),
                                 b.point(lambda v: min(255, weich(v) * 1.15))))
    grund = quelle.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    flaeche = Image.new("RGB", (SEITE, SEITE), grund)
    # weiche, runde Maske für jedes Stück
    maske = Image.new("L", (STUECK, STUECK), 0)
    r = STUECK / 2
    for y in range(STUECK):
        for x in range(STUECK):
            d = ((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2) ** 0.5 / r
            maske.putpixel((x, y), round(255 * max(0.0, min(1.0, (1 - d) / 0.45))))
    rnd = random.Random(5)
    for _ in range(ANZAHL):
        qx, qy = rnd.randint(0, quelle.width - STUECK), rnd.randint(0, quelle.height - STUECK)
        s = quelle.crop((qx, qy, qx + STUECK, qy + STUECK))
        if rnd.random() < 0.5:
            s = ImageOps.mirror(s)
        zx, zy = rnd.randint(0, SEITE - 1), rnd.randint(0, SEITE - 1)
        for dx in (-SEITE, 0, SEITE):  # über die Ränder hinaus: Kachel wiederholt sich ohne Naht
            for dy in (-SEITE, 0, SEITE):
                flaeche.paste(s, (zx + dx - STUECK // 2, zy + dy - STUECK // 2), maske)
    flaeche.save(ZIEL_ROH)
    boden.kachel(ZIEL_ROH, "wasser", 11, wiederholung=SEITE, saettigung=1.3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
