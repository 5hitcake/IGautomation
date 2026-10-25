"""Kabine einer Karosserie ganz ins Mittelteil schieben.

Reicht die Kabine im gelieferten Doppelbild über eine Naht, wird sie beim
Schneiden geteilt. Dieses Werkzeug verzerrt das Bild waagerecht stückweise:
Heck und Vorderpartie werden gestaucht oder gestreckt, die Kabine landet mit
etwas Luft zwischen den Nähten. Seite und Draufsicht bleiben ausgerichtet.

Aufruf:
  python klapperkiste/tools/kabine_mitte.py EINGABE AUSGABE KABINE_X0 KABINE_X1

KABINE_X0/X1 sind die linke und rechte Kante der Kabine in der Seitenansicht
(Pixel im Eingabebild). Die Länge des Autos wird aus den dunklen Konturen
bestimmt. Beispiel Kutsche:
  cd klapperkiste/assets/teile
  python ../../tools/kabine_mitte.py kutsche-roh/kutsche_blatt.jpg kutsche-roh/kutsche_blatt.png 543 925

Feuerwehr: dieselbe Zeile mit feuerwehr-roh/feuerwehr_blatt.jpg ... 557 965.
"""

from __future__ import annotations

import argparse
import sys

import teilwerk
from PIL import Image

LUFT = 0.05  # Abstand der Kabine zu den Nähten, in Zellen


def auto_laenge(bild: Image.Image, schwelle: int = 80) -> tuple[int, int]:
    """Linkes und rechtes Ende des Autos (dunkle Konturen), über beide Ansichten."""
    dunkel = bild.convert("L").point(lambda v: 255 if v < schwelle else 0)
    x0, _, x1, _ = dunkel.getbbox()
    return x0, x1


def verschieben(bild: Image.Image, kabine: tuple[int, int], raster: dict) -> Image.Image:
    bild = bild.convert("RGB")
    a0, a1 = auto_laenge(bild)
    zelle = (a1 - a0) / raster["seite"]["breite"]
    n0, n1 = (a0 + x * zelle for x in raster["karosserie"]["naehte_x"])
    ziel = (round(n0 + LUFT * zelle), round(n1 - LUFT * zelle))
    stuetzen = [(0, 0), (a0, a0), (kabine[0], ziel[0]), (kabine[1], ziel[1]), (a1, a1),
                (bild.width, bild.width)]
    neu = Image.new("RGB", bild.size, (255, 255, 255))
    for (q0, z0), (q1, z1) in zip(stuetzen, stuetzen[1:]):
        if q1 > q0 and z1 > z0:
            stueck = bild.crop((q0, 0, q1, bild.height)).resize((z1 - z0, bild.height), Image.LANCZOS)
            neu.paste(stueck, (z0, 0))
    return neu


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("eingabe")
    p.add_argument("ausgabe")
    p.add_argument("kabine_x0", type=int)
    p.add_argument("kabine_x1", type=int)
    args = p.parse_args(argv)
    neu = verschieben(Image.open(args.eingabe), (args.kabine_x0, args.kabine_x1), teilwerk.lade_raster())
    neu.save(args.ausgabe)
    print(f"{args.ausgabe}: Kabine ins Mittelteil verschoben")
    return 0


if __name__ == "__main__":
    sys.exit(main())
