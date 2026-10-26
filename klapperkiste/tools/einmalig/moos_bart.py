"""Einmalige Bearbeitung: Förster Moos, Bart im Bild unten rechts braun färben.

Der Generator hat den Bart in der vierten Geste weiß gemalt. Helle, kaum
farbige Pixel im Bartbereich (ohne Mund und Zähne) bekommen die Brauntöne der
anderen drei Bilder; die Helligkeit bleibt, damit Strichzeichnung und Struktur
erhalten bleiben. Der Papierhintergrund bleibt unberührt.

Aufruf (danach charakter.py moos_blatt.png moos):
  python klapperkiste/tools/einmalig/moos_bart.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import charakter  # noqa: E402

ROH = os.path.join(charakter.ZIEL_DIR, "roh")
BART = (476, 662, 652, 782)          # Bartbereich in der Geste unten rechts
MUND = (538, 692, 584, 722)          # Mund mit Zähnen bleibt
DUNKEL, HELL = (58, 34, 18), (196, 146, 92)


def bearbeiten(original: Image.Image) -> Image.Image:
    bild = original.convert("RGB").copy()
    px = bild.load()
    figur = charakter.teilwerk.freistellen(bild, toleranz=30, inseln=False).getchannel("A").load()
    x0, y0, x1, y1 = BART
    mx0, my0, mx1, my1 = MUND
    for y in range(y0, y1):
        for x in range(x0, x1):
            if mx0 <= x < mx1 and my0 <= y < my1 and ((x - (mx0 + mx1) / 2) / ((mx1 - mx0) / 2)) ** 2 + (
                    (y - (my0 + my1) / 2) / ((my1 - my0) / 2)) ** 2 < 1:
                continue
            if figur[x, y] < 200:
                continue
            r, g, b = px[x, y]
            hell = (r + g + b) / 3
            if max(r, g, b) - min(r, g, b) < 48 and hell > 95:
                t = min(1.0, (hell - 60) / 190)
                px[x, y] = tuple(round(d + (h - d) * t) for d, h in zip(DUNKEL, HELL))
    return bild


def main() -> int:
    ziel = os.path.join(ROH, "moos_blatt.png")
    bearbeiten(Image.open(os.path.join(ROH, "moos.jpg"))).save(ziel)
    print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
