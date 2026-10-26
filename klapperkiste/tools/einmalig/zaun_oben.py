"""Einmalige Bearbeitung: Zaunstück streng von oben.

Das gelieferte Bild zeigt den Zaun leicht schräg (zwei Latten untereinander,
Pfosten mit Beinen). Von oben liegen die Latten übereinander, man sieht nur
eine. Gebaut wird daraus: obere Latte, an beiden Enden die runden Pfostenköpfe.

Aufruf (danach objekt.py einpassen ... zaun --meter 4):
  python klapperkiste/tools/einmalig/zaun_oben.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import objekt  # noqa: E402
import teilwerk  # noqa: E402

ROH = os.path.join(objekt.OBJEKT_DIR, "roh")
LATTE = (85, 298, 1328, 380)                      # obere Latte samt Kontur
KOPF_LINKS, KOPF_RECHTS = (32, 330, 152, 446), (1252, 330, 1376, 446)


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = teilwerk.freistellen(original.convert("RGB"), inseln=False)
    latte = bild.crop(LATTE)
    links, rechts = bild.crop(KOPF_LINKS), bild.crop(KOPF_RECHTS)
    # nur der runde Kopf: Kreis-Maske, damit die Latte darunter nicht mitkommt
    for kopf in (links, rechts):
        m = Image.new("L", kopf.size, 0)
        ImageDraw.Draw(m).ellipse((2, 2, kopf.width - 3, kopf.height - 3), fill=255)
        kopf.putalpha(Image.composite(kopf.getchannel("A"), m, m))
    h = max(latte.height, links.height)
    neu = Image.new("RGBA", (KOPF_RECHTS[2] - KOPF_LINKS[0], h), (0, 0, 0, 0))
    y_latte = (h - latte.height) // 2
    neu.alpha_composite(latte, (LATTE[0] - KOPF_LINKS[0], y_latte))
    neu.alpha_composite(links, (0, (h - links.height) // 2))
    neu.alpha_composite(rechts, (neu.width - rechts.width, (h - rechts.height) // 2))
    return neu


def main() -> int:
    ziel = os.path.join(ROH, "zaun_oben.png")
    bearbeiten(Image.open(os.path.join(ROH, "zaun_v1.jpg"))).save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
