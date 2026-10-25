"""Einmalige Bearbeitung: Dusche der Badewannen-Karosserie in der Draufsicht.

Im gelieferten Bild passen die beiden Ansichten der Dusche nicht zusammen.
Neu gezeichnet: Der Arm geht vom Wannenrand in die Wanne hinein, der Duschkopf
schaut nach unten in die Wanne. Seitenansicht: senkrechte Stange, Duschkopf
von vorne gesehen, nach unten gerichtet. Draufsicht: kurze Strecke vom
Wannenrand nach innen, Duschkopf am Ende.

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
WEISS = (255, 255, 255)
WASSER = (120, 190, 235)
SCHWARZ, STAHL, GLANZ = (20, 20, 22), (165, 172, 176), (225, 230, 232)

# Maße im Originalbild (1376 x 768), vermessen
STANGE = (566, 438, 588, 586)   # senkrechter Teil des L
ARM = (566, 556, 736, 588)      # waagerechter Teil
KOPF = (718, 538, 778, 608)     # Duschkopf
SEITE_WEG_RECHTS = (588, 8, 672, 110)   # Seitenansicht: Arm und Kopf rechts der Stange
SEITE_WEG_OBEN = (565, 8, 592, 46)     # Seitenansicht: Bogen oben an der Stange


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
    # Seitenansicht: Arm und Kopf rechts der Stange weg, oben neu
    d.rectangle(SEITE_WEG_RECHTS, fill=WEISS)
    d.rectangle(SEITE_WEG_OBEN, fill=WEISS)
    sx = 579
    d.rounded_rectangle((sx - 8, 24, sx + 8, 62), radius=8, fill=STAHL, outline=SCHWARZ, width=3)
    d.line([(sx - 3, 30), (sx - 3, 58)], fill=GLANZ, width=3)
    d.ellipse((sx - 9, 30, sx + 9, 48), fill=STAHL, outline=SCHWARZ, width=3)  # Arm, kommt auf uns zu
    d.chord((sx - 32, 46, sx + 32, 86), 180, 360, fill=STAHL, outline=SCHWARZ, width=3)  # Kuppel
    d.arc((sx - 24, 52, sx + 4, 78), 200, 260, fill=GLANZ, width=3)
    d.ellipse((sx - 32, 60, sx + 32, 74), fill=(120, 126, 130), outline=SCHWARZ, width=3)  # Brause
    for lx in (-18, -9, 0, 9, 18):
        d.ellipse((sx + lx - 1, 66, sx + lx + 1, 68), fill=SCHWARZ)
    for tx, ty in [(-18, 84), (0, 92), (18, 84), (-9, 104), (9, 104)]:  # Wassertropfen
        x, y = sx + tx, ty
        d.polygon([(x, y - 7), (x - 4, y), (x + 4, y)], fill=WASSER)
        d.ellipse((x - 4, y - 3, x + 4, y + 5), fill=WASSER, outline=SCHWARZ, width=2)

    # Draufsicht: kurzer Arm vom Wannenrand in die Wanne, Duschkopf am Ende
    px, py = 578, 446             # Stange von oben: Kreis auf dem Wannenrand
    kx, ky = 578, 494             # Duschkopf über der Wanne
    d.line([(px, py), (kx, ky - 10)], fill=SCHWARZ, width=12)
    d.line([(px, py), (kx, ky - 10)], fill=STAHL, width=6)
    d.ellipse((px - 9, py - 9, px + 9, py + 9), fill=STAHL, outline=SCHWARZ, width=3)
    d.ellipse((kx - 17, ky - 17, kx + 17, ky + 17), fill=STAHL, outline=SCHWARZ, width=3)
    d.ellipse((kx - 10, ky - 12, kx - 2, ky - 6), fill=GLANZ)
    return bild


def main() -> int:
    original = Image.open(os.path.join(ROH, "badewanne_blatt_original.jpg"))
    ziel = os.path.join(ROH, "badewanne_blatt.png")
    bearbeiten(original).save(ziel)
    print(f"{os.path.relpath(ziel)}: Dusche in beiden Ansichten neu gezeichnet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
