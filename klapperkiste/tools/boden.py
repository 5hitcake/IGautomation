"""Boden-Texturen für die Karte nahtlos machen und als Probe zeigen.

Bildgeneratoren liefern „nahtlose“ Texturen oft schon als 2 × 2-Wiederholung
oder mit leichten Kanten. Das Werkzeug findet die Wiederholung, schneidet genau
eine Kachel heraus, blendet die Ränder weich über (damit sich die Kachel ohne
Kante wiederholt) und rechnet sie auf den Kartenmaßstab um (32 px pro Meter).

Aufruf:
  python klapperkiste/tools/boden.py kachel EINGABE NAME [--meter 8] [--ohne-erde]
  python klapperkiste/tools/boden.py probe NAME [ausgabe.png]

Ergebnis: assets/karte/boden/NAME.png
"""

from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BODEN_DIR = os.path.join(ROOT, "assets", "karte", "boden")
PX_PRO_M = 32
UEBERGANG = 0.08  # Anteil der Kachel, über den die Ränder ineinander geblendet werden


def periode(bild: Image.Image, achse: str) -> int:
    """Kleinste Verschiebung (ab einem Viertel der Bildgröße), bei der sich das Bild wiederholt;
    ohne deutliche Wiederholung die volle Größe."""
    groesse = bild.width if achse == "x" else bild.height
    klein = bild.convert("RGB").resize((bild.width // 4, bild.height // 4))
    n = groesse // 4
    beste = (1e9, n)
    for p in range(n // 4, n * 3 // 4 + 1):
        if achse == "x":
            a, b = klein.crop((0, 0, n - p, klein.height)), klein.crop((p, 0, n, klein.height))
        else:
            a, b = klein.crop((0, 0, klein.width, n - p)), klein.crop((0, p, klein.width, n))
        abw = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
        beste = min(beste, (abw, p))
    return beste[1] * 4 if beste[0] < 16 else groesse


def nahtlos(kachel: Image.Image, anteil: float = UEBERGANG) -> Image.Image:
    """Blendet gegenüberliegende Ränder ineinander, damit die Kachel ohne Kante wiederholt."""
    w, h = kachel.size
    verschoben = ImageChops.offset(kachel, w // 2, h // 2)
    maske = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(maske)
    rx, ry = int(w * anteil), int(h * anteil)
    for i in range(rx):  # weiche senkrechte Naht in der Mitte (dort liegt jetzt die alte Kante)
        wert = int(255 * (1 - abs(i - rx / 2) / (rx / 2)))
        d.line((w // 2 - rx // 2 + i, 0, w // 2 - rx // 2 + i, h), fill=wert)
    for i in range(ry):
        wert = int(255 * (1 - abs(i - ry / 2) / (ry / 2)))
        d.line((0, h // 2 - ry // 2 + i, w, h // 2 - ry // 2 + i), fill=max(wert, 0))
    gemischt = Image.composite(kachel, verschoben, maske)
    return ImageChops.offset(gemischt, -(w // 2), -(h // 2))


def erde_weg(bild: Image.Image, versatz: tuple[int, int] = (97, 61)) -> Image.Image:
    """Braune Erdstellen mit Gras von einer verschobenen Stelle der Kachel übermalen."""
    rgb = bild.convert("RGB")
    r, g, b = rgb.split()
    rot_vor_gruen = ImageChops.subtract(r, g).point(lambda v: 255 if v > 0 else 0)
    dunkel = g.point(lambda v: 255 if v < 110 else 0)  # Blumen (gelb, weiß) sind hell und bleiben
    braun = ImageChops.multiply(rot_vor_gruen, dunkel)
    braun = braun.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
    ersatz = ImageChops.offset(rgb, *versatz)
    ersatz_braun = ImageChops.offset(braun, *versatz)
    nutzbar = ImageChops.subtract(braun, ersatz_braun)  # nur wo die Ersatzstelle selbst grün ist
    return Image.composite(ersatz, rgb, nutzbar)


def kachel(eingabe: str, name: str, meter: float, ohne_erde: bool = False) -> str:
    bild = Image.open(eingabe).convert("RGB")
    px, py = periode(bild, "x"), periode(bild, "y")
    teil = nahtlos(bild.crop((0, 0, px, py)))
    if ohne_erde:
        for v in ((97, 61), (-131, 83), (53, -149)):
            teil = erde_weg(teil, v)
    ziel_px = round(meter * PX_PRO_M)
    teil = teil.resize((ziel_px, ziel_px), Image.LANCZOS)
    os.makedirs(BODEN_DIR, exist_ok=True)
    pfad = os.path.join(BODEN_DIR, f"{name}.png")
    teil.save(pfad)
    print(f"{os.path.relpath(pfad)}: Wiederholung {px}×{py} px im Bild, Kachel {ziel_px} px = {meter:g} m")
    return pfad


def probe(name: str, auto: str | None = None, meter: int = 32) -> Image.Image:
    """Fläche von meter × meter mit der Kachel füllen, Auto zum Größenvergleich in die Mitte."""
    k = Image.open(os.path.join(BODEN_DIR, f"{name}.png")).convert("RGB")
    groesse = meter * PX_PRO_M
    flaeche = Image.new("RGB", (groesse, groesse))
    for y in range(0, groesse, k.height):
        for x in range(0, groesse, k.width):
            flaeche.paste(k, (x, y))
    if auto and os.path.exists(auto):
        wagen = Image.open(auto).convert("RGBA")
        wagen = wagen.resize((4 * PX_PRO_M, round(4 * PX_PRO_M * wagen.height / wagen.width)), Image.LANCZOS)
        flaeche.paste(wagen, ((groesse - wagen.width) // 2, (groesse - wagen.height) // 2), wagen)
    return flaeche


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="befehl", required=True)
    k = sub.add_parser("kachel")
    k.add_argument("eingabe")
    k.add_argument("name")
    k.add_argument("--meter", type=float, default=8, help="Kantenlänge der Kachel in Metern (Standard 8)")
    k.add_argument("--ohne-erde", action="store_true", help="braune Erdstellen übermalen (z. B. für Gras)")
    pr = sub.add_parser("probe")
    pr.add_argument("name")
    pr.add_argument("ausgabe", nargs="?")
    pr.add_argument("--auto", help="Draufsicht eines Autos als Größenvergleich")
    args = p.parse_args(argv)
    if args.befehl == "kachel":
        kachel(args.eingabe, args.name, args.meter, args.ohne_erde)
    else:
        ziel = args.ausgabe or os.path.join(BODEN_DIR, f"probe_{args.name}.png")
        probe(args.name, args.auto).save(ziel)
        print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
