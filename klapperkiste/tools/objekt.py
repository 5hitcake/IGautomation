"""Kartenobjekte (Bäume, Büsche, Felsen …) von oben freistellen und einpassen.

Das Bild wird freigestellt, auf das Objekt zugeschnitten und auf seine echte
Größe im Kartenmaßstab gebracht (32 px pro Meter). Den Schatten zeichnet das
Spiel; die Probe zeigt ihn schon mit (nach unten rechts, Licht von oben links).

Aufruf:
  python klapperkiste/tools/objekt.py einpassen EINGABE NAME --meter 7
  python klapperkiste/tools/objekt.py probe AUSGABE --boden gras_ruhig NAME[@x,y] ... [--auto auto.png]

Ergebnis: assets/karte/objekte/NAME.png (Breite = --meter, Höhe im Verhältnis)
"""

from __future__ import annotations

import argparse
import os
import random
import sys

from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
import boden  # noqa: E402
import teilwerk  # noqa: E402

OBJEKT_DIR = os.path.join(boden.ROOT, "assets", "karte", "objekte")
PX = boden.PX_PRO_M


def einpassen(eingabe: str, name: str, meter: float) -> str:
    teil = teilwerk.freistellen(Image.open(eingabe), inseln=False)
    teil = teil.crop(teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox())
    breite = round(meter * PX)
    teil = teil.resize((breite, round(teil.height * breite / teil.width)), Image.LANCZOS)
    os.makedirs(OBJEKT_DIR, exist_ok=True)
    pfad = os.path.join(OBJEKT_DIR, f"{name}.png")
    teil.save(pfad)
    print(f"{os.path.relpath(pfad)}: {teil.width}×{teil.height} px = {meter:g} m breit")
    return pfad


def schatten(obj: Image.Image, versatz: float = 0.14,
             deckkraft: int = 120) -> tuple[Image.Image, tuple[int, int]]:
    """Weicher Schlagschatten des Objekts, nach unten rechts versetzt (mit Rand, damit
    die Weichzeichnung nicht abgeschnitten wird)."""
    rand = max(4, obj.width // 10)
    a = Image.new("L", (obj.width + 2 * rand, obj.height + 2 * rand), 0)
    a.paste(obj.getchannel("A").point(lambda v: deckkraft if v > 16 else 0), (rand, rand))
    s = Image.new("RGBA", a.size, (15, 30, 10, 0))
    s.putalpha(a.filter(ImageFilter.GaussianBlur(max(2, obj.width // 25))))
    d = round(obj.width * versatz)
    return s, (d - rand, d - rand)


def probe(ausgabe: str, bodenname: str, objekte: list[str], meter: int = 32, auto: str | None = None) -> None:
    rnd = random.Random(1)
    bild = boden.flaeche([bodenname], meter, seed=1).convert("RGBA")
    for eintrag in objekte:
        name, _, pos = eintrag.partition("@")
        obj = Image.open(os.path.join(OBJEKT_DIR, f"{name}.png")).convert("RGBA")
        # Abwechslung: an der Diagonale spiegeln (Licht bleibt oben links), Größe leicht ändern
        if rnd.random() < 0.5:
            obj = obj.transpose(Image.TRANSPOSE)
        f = rnd.uniform(0.85, 1.15)
        obj = obj.resize((round(obj.width * f), round(obj.height * f)), Image.LANCZOS)
        x, y = (float(v) * PX for v in pos.split(",")) if pos else (bild.width / 2, bild.height / 2)
        lx, ly = round(x - obj.width / 2), round(y - obj.height / 2)
        sch, (dx, dy) = schatten(obj)
        bild.alpha_composite(sch, (lx + dx, ly + dy))
        bild.alpha_composite(obj, (lx, ly))
    if auto and os.path.exists(auto):
        wagen = Image.open(auto).convert("RGBA")
        wagen = wagen.resize((4 * PX, round(4 * PX * wagen.height / wagen.width)), Image.LANCZOS)
        bild.alpha_composite(wagen, ((bild.width - wagen.width) // 2, (bild.height - wagen.height) // 2))
    bild.convert("RGB").save(ausgabe)
    print(os.path.relpath(ausgabe))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="befehl", required=True)
    e = sub.add_parser("einpassen")
    e.add_argument("eingabe")
    e.add_argument("name")
    e.add_argument("--meter", type=float, required=True, help="Breite des Objekts in Metern")
    pr = sub.add_parser("probe")
    pr.add_argument("ausgabe")
    pr.add_argument("objekte", nargs="+", help="NAME oder NAME@x,y (Meter)")
    pr.add_argument("--boden", default="gras_ruhig")
    pr.add_argument("--meter", type=int, default=32)
    pr.add_argument("--auto")
    args = p.parse_args(argv)
    if args.befehl == "einpassen":
        einpassen(args.eingabe, args.name, args.meter)
    else:
        probe(args.ausgabe, args.boden, args.objekte, args.meter, args.auto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
