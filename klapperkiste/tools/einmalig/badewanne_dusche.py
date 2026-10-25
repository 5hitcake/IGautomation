"""Einmalige Bearbeitung: Dusche der Badewannen-Karosserie in der Draufsicht.

Im gelieferten Bild liegt die Duschstange in der Draufsicht als langes L in der
Wanne, in der Seitenansicht steht sie senkrecht. Die liegende Stange wird
übermalt und so neu gezeichnet, wie man die stehende Stange von oben sieht:
Kreis am Wannenrand, kurzer Arm nach vorne, Duschkopf.

Aufruf:
  python klapperkiste/tools/einmalig/badewanne_dusche.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "badewanne-roh")
SCHWARZ, STAHL, GLANZ = (20, 20, 22), (165, 172, 176), (225, 230, 232)

# Maße im Originalbild (1376 x 768), vermessen
STANGE = (566, 438, 588, 586)   # senkrechter Teil des L
ARM = (566, 556, 736, 588)      # waagerechter Teil
KOPF = (718, 538, 778, 608)     # Duschkopf


def _von(bild: Image.Image, rahmen: tuple, dx: int, dy: int) -> None:
    """Rahmen mit dem um (dx, dy) verschobenen Bildstück übermalen."""
    x0, y0, x1, y1 = rahmen
    bild.paste(bild.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy)), (x0, y0))


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB").copy()
    _von(bild, STANGE, -24, 0)   # Streifen der Wanne laufen waagerecht weiter
    _von(bild, ARM, 0, 30)       # weißer Wannenboden darunter
    _von(bild, KOPF, -62, 0)

    d = ImageDraw.Draw(bild)
    px, py = 578, 448             # Stange von oben: Kreis auf dem Wannenrand
    kx, ky = 634, 452             # Duschkopf vorne (rechts), wie in der Seitenansicht
    d.line([(px, py), (kx - 10, py)], fill=SCHWARZ, width=12)
    d.line([(px, py), (kx - 10, py)], fill=STAHL, width=6)
    d.ellipse((px - 9, py - 9, px + 9, py + 9), fill=STAHL, outline=SCHWARZ, width=3)
    d.ellipse((kx - 16, ky - 16, kx + 16, ky + 16), fill=STAHL, outline=SCHWARZ, width=3)
    d.ellipse((kx - 9, ky - 11, kx - 1, ky - 5), fill=GLANZ)
    for lx, ly in [(-5, 3), (2, 3), (9, 3), (-2, 9), (5, 9)]:
        d.ellipse((kx + lx - 1, ky + ly - 1, kx + lx + 1, ky + ly + 1), fill=SCHWARZ)
    return bild


def main() -> int:
    original = Image.open(os.path.join(ROH, "badewanne_blatt_original.jpg"))
    ziel = os.path.join(ROH, "badewanne_blatt.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: Dusche in der Draufsicht neu gezeichnet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
