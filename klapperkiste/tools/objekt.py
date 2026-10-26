"""Kartenobjekte (Bäume, Büsche, Felsen …) von oben freistellen und einpassen.

Das Bild wird freigestellt, auf das Objekt zugeschnitten und auf seine echte
Größe im Kartenmaßstab gebracht (32 px pro Meter). Den Schatten zeichnet das
Spiel; die Probe zeigt ihn schon mit (nach unten rechts, Licht von oben links).

Aufruf:
  python klapperkiste/tools/objekt.py einpassen EINGABE NAME --meter 7 [--loch] [--weicher-rand 0.8]
  python klapperkiste/tools/objekt.py probe AUSGABE --boden gras_ruhig NAME[@x,y] ... [--auto auto.png]

Ergebnis: assets/karte/objekte/NAME.png (Breite = --meter, Höhe im Verhältnis)
"""

from __future__ import annotations

import argparse
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
import boden  # noqa: E402
import teilwerk  # noqa: E402

OBJEKT_DIR = os.path.join(boden.ROOT, "assets", "karte", "objekte")
PX = boden.PX_PRO_M


def loch_frei(teil: Image.Image, toleranz: int = 40) -> Image.Image:
    """Weiße Fläche in der Bildmitte durchsichtig machen (z. B. das Loch im Reifen)."""
    rgb = teil.convert("RGB")
    mitte = (teil.width // 2, teil.height // 2)
    ImageDraw.floodfill(rgb, mitte, (1, 254, 3), thresh=toleranz)
    loch = ImageChops.difference(rgb, Image.new("RGB", rgb.size, (1, 254, 3))).convert("L")
    alpha = ImageChops.multiply(teil.getchannel("A"), loch.point(lambda v: 255 if v > 0 else 0))
    teil.putalpha(alpha)
    return teil


def weicher_rand(teil: Image.Image, breite_px: int, seed: int = 3) -> Image.Image:
    """Außenkante über etwa breite_px ausblenden, leicht unregelmäßig (z. B. Schlamm
    um die Hütte, der ins Gras übergeht). Die Mitte bleibt deckend."""
    a = teil.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    k = max(3, breite_px) | 1  # so weit nach innen, dass auch die Umrisslinie verschwindet
    innen = a.filter(ImageFilter.MinFilter(k))
    rampe = innen.filter(ImageFilter.GaussianBlur(breite_px / 2))
    rnd = random.Random(seed)
    klein = Image.new("L", (max(1, teil.width // 6), max(1, teil.height // 6)))
    klein.putdata([rnd.randint(0, 255) for _ in range(klein.width * klein.height)])
    rauschen = klein.resize(teil.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    # Rauschen um 128 verschiebt die Rampe ein wenig nach innen oder außen
    rampe = ImageChops.add(rampe, rauschen.point(lambda v: max(0, v - 128) // 2))
    rampe = ImageChops.subtract(rampe, rauschen.point(lambda v: max(0, 128 - v) // 2))
    teil.putalpha(ImageChops.darker(teil.getchannel("A"), rampe))
    return teil


def einpassen(eingabe: str, name: str, meter: float, dicker: float = 1.0, loch: bool = False,
              rand: float = 0.0) -> str:
    teil = teilwerk.freistellen(Image.open(eingabe), inseln=False)
    if loch:
        teil = loch_frei(teil)
    teil = teil.crop(teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox())
    breite = round(meter * PX)
    teil = teil.resize((breite, round(teil.height * breite / teil.width * dicker)), Image.LANCZOS)
    if rand:
        teil = weicher_rand(teil, round(rand * PX))
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
    def y_von(eintrag: str) -> float:
        pos = eintrag.partition("@")[2]
        return float(pos.split(",")[1]) if pos else meter / 2

    for eintrag in sorted(objekte, key=y_von):  # von oben nach unten, untere überdecken obere
        name, _, pos = eintrag.partition("@")
        fest = name.endswith("!")  # z. B. zaun!@x,y: nicht drehen oder verändern (Zäune aneinanderreihen)
        name = name.rstrip("!")
        obj = Image.open(os.path.join(OBJEKT_DIR, f"{name}.png")).convert("RGBA")
        # Abwechslung: an der Diagonale spiegeln (Licht bleibt oben links), Größe leicht ändern
        if not fest and rnd.random() < 0.5:
            obj = obj.transpose(Image.TRANSPOSE)
        if not fest:
            obj = obj.rotate(rnd.uniform(-20, 20), Image.BICUBIC, expand=True)  # Licht bleibt fast gleich
        f = 1.0 if fest else rnd.uniform(0.85, 1.15)
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
    e.add_argument("--dicker", type=float, default=1.0,
                   help="Höhe im Bild strecken, damit dünne Dinge (Zaun) auf dem Handy sichtbar bleiben")
    e.add_argument("--loch", action="store_true", help="Weiße Fläche in der Mitte freistellen (Reifen)")
    e.add_argument("--weicher-rand", type=float, default=0.0, metavar="METER",
                   help="Außenkante über so viele Meter ins Gelände ausblenden (Schlamm, Erde)")
    pr = sub.add_parser("probe")
    pr.add_argument("ausgabe")
    pr.add_argument("objekte", nargs="+", help="NAME oder NAME@x,y (Meter), NAME! = unverändert")
    pr.add_argument("--boden", default="gras_ruhig")
    pr.add_argument("--meter", type=int, default=32)
    pr.add_argument("--auto")
    args = p.parse_args(argv)
    if args.befehl == "einpassen":
        einpassen(args.eingabe, args.name, args.meter, args.dicker, args.loch, args.weicher_rand)
    else:
        probe(args.ausgabe, args.boden, args.objekte, args.meter, args.auto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
