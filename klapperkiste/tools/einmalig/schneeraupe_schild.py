"""Einmalige Bearbeitung: Räumschild der Schneeraupe als eigenes Anbauteil.

Das Schild hängt im gelieferten Bild vorne an der Karosserie. Im Spiel soll es
größer und tief am Boden vor dem Vorderrad sitzen. Es wird deshalb aus beiden
Ansichten herausgeschnitten (assets/teile/schneeraupe_schild/) und in der
Karosserie weiß übermalt. Die Werkstatt zeichnet das Schild automatisch, sobald
das vordere Schneeraupen-Teil eingebaut ist (raster.json, "anbauten").

Aufruf (danach kabine_mitte.py und teilwerk karosserie):
  python klapperkiste/tools/einmalig/schneeraupe_schild.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import teilwerk  # noqa: E402

ROH = os.path.join(teilwerk.TEILE_DIR, "schneeraupe-roh")
ZIEL = os.path.join(teilwerk.TEILE_DIR, "schneeraupe_schild")

# Maße im Originalbild (1408 x 768), vermessen
SCHILD_SEITE = (1222, 215, 1360, 392)   # Schild mit Haltearmen, rechts der Stoßstange
SCHILD_OBEN = (1208, 425, 1368, 748)


def bearbeiten(original: Image.Image) -> tuple[Image.Image, dict]:
    bild = original.convert("RGB").copy()
    teile = {}
    for ansicht, rahmen in (("seite", SCHILD_SEITE), ("oben", SCHILD_OBEN)):
        teil = teilwerk.freistellen(bild.crop(rahmen), inseln=False)
        teile[ansicht] = teil.crop(teil.getchannel("A").getbbox())
        ImageDraw.Draw(bild).rectangle(rahmen, fill=(255, 255, 255))
    return bild, teile


def main() -> int:
    original = Image.open(os.path.join(ROH, "schneeraupe_blatt_original.jpg"))
    karosserie, teile = bearbeiten(original)
    karosserie.save(os.path.join(ROH, "schneeraupe_blatt_ohne_schild.png"))
    os.makedirs(ZIEL, exist_ok=True)
    for ansicht, teil in teile.items():
        teil.save(os.path.join(ZIEL, f"{ansicht}.png"))
        print(f"{ansicht}: Schild {teil.width}×{teil.height} px")
    return 0


if __name__ == "__main__":
    sys.exit(main())
