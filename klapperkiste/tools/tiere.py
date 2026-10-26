"""Tiere von oben: Bogen mit zwei Posen nebeneinander teilen, freistellen, einpassen.

Die Bilder kommen mit einem grauen Schlagschatten. Der liegt außerhalb der
schwarzen Kontur und wird mit einer großen Toleranz vom Rand her weggefüllt;
den Schatten zeichnet das Spiel selbst. Beide Posen behalten denselben
Maßstab (--meter ist die Länge der ersten Pose, Kopf zeigt nach rechts).

Aufruf:
  python klapperkiste/tools/tiere.py EINGABE NAME --meter 0.9
  python klapperkiste/tools/tiere.py EINGABE NAME --meter 2.8 --eine   (nur eine Pose, z. B. Kuh)

Ergebnis: assets/karte/tiere/NAME_1.png und NAME_2.png (64 px pro Meter, doppelt so fein wie
der Boden, weil Tiere klein sind und sonst unscharf werden)
"""

from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
import boden  # noqa: E402
import teilwerk  # noqa: E402

TIER_DIR = os.path.join(boden.ROOT, "assets", "karte", "tiere")
PX = 64  # Pixel pro Meter


def ohne_schatten(frei: Image.Image) -> Image.Image:
    """Grauen Schlagschatten entfernen: helle, ungesättigte Pixel, die von außen
    (ohne die schwarze Kontur zu kreuzen) erreichbar sind, werden durchsichtig."""
    hsv = frei.convert("RGB").convert("HSV")
    grau = ImageChops.multiply(hsv.getchannel("S").point(lambda v: 255 if v < 40 else 0),
                               hsv.getchannel("V").point(lambda v: 255 if v > 120 else 0))
    weg = ImageChops.lighter(grau, frei.getchannel("A").point(lambda v: 255 if v < 128 else 0))
    rand = Image.new("L", (weg.width + 2, weg.height + 2), 255)
    rand.paste(weg, (1, 1))
    ImageDraw.floodfill(rand, (0, 0), 128, thresh=0)
    aussen = rand.crop((1, 1, weg.width + 1, weg.height + 1)).point(lambda v: 0 if v == 128 else 255)
    frei.putalpha(ImageChops.multiply(frei.getchannel("A"), aussen))
    return frei


def posen(bild: Image.Image, toleranz: int = 100, eine: bool = False) -> list[Image.Image]:
    """Freistellen und an der breitesten leeren Spalte in der Mitte teilen.
    Mit eine=True gibt es nur eine Pose; sie wird für beide verwendet."""
    frei = ohne_schatten(teilwerk.freistellen(bild.convert("RGB"), toleranz=toleranz, inseln=False))
    a = frei.getchannel("A").point(lambda v: 255 if v > 16 else 0)
    if eine:
        t = frei.crop(a.getbbox())
        return [t, t.copy()]
    b = a.width
    voll = [a.crop((x, 0, x + 1, a.height)).getbbox() is not None for x in range(b)]
    # längste Lücke im mittleren Drittel
    beste, start, laenge = None, None, 0
    for x in range(b // 4, 3 * b // 4 + 1):
        if x < 3 * b // 4 and not voll[x]:
            start = x if start is None else start
            continue
        if start is not None and x - start > laenge:
            beste, laenge = (start + x) // 2, x - start
        start = None
    if beste is None:
        raise SystemExit("Keine Lücke zwischen den Posen gefunden.")
    teile = []
    for x0, x1 in ((0, beste), (beste, b)):
        t = frei.crop((x0, 0, x1, frei.height))
        teile.append(t.crop(t.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()))
    return teile


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("eingabe")
    p.add_argument("name")
    p.add_argument("--meter", type=float, required=True, help="Länge der ersten Pose in Metern")
    p.add_argument("--toleranz", type=int, default=100)
    p.add_argument("--eine", action="store_true", help="Bild zeigt nur eine Pose")
    args = p.parse_args(argv)
    teile = posen(Image.open(args.eingabe), args.toleranz, args.eine)
    faktor = args.meter * PX / teile[0].width
    os.makedirs(TIER_DIR, exist_ok=True)
    for i, t in enumerate(teile, 1):
        t = t.resize((max(1, round(t.width * faktor)), max(1, round(t.height * faktor))), Image.LANCZOS)
        pfad = os.path.join(TIER_DIR, f"{args.name}_{i}.png")
        t.save(pfad)
        print(f"{os.path.relpath(pfad)}: {t.width}×{t.height} px")
    return 0


if __name__ == "__main__":
    sys.exit(main())
