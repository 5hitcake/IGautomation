"""Boden-Texturen für die Karte nahtlos machen und als Probe zeigen.

Bildgeneratoren liefern „nahtlose“ Texturen oft schon als 2 × 2-Wiederholung
oder mit leichten Kanten. Das Werkzeug findet die Wiederholung, schneidet genau
eine Kachel heraus, blendet die Ränder weich über (damit sich die Kachel ohne
Kante wiederholt) und rechnet sie auf den Kartenmaßstab um (32 px pro Meter).

Aufruf:
  python klapperkiste/tools/boden.py kachel EINGABE NAME [--meter 8] [--ohne-erde]
  python klapperkiste/tools/boden.py probe NAME [ausgabe.png]
  python klapperkiste/tools/boden.py flaeche gras_ruhig gras --ausgabe probe.png [--meter 32]

Ergebnis: assets/karte/boden/NAME.png
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageMath, ImageStat

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BODEN_DIR = os.path.join(ROOT, "assets", "karte", "boden")
PX_PRO_M = 32
UEBERGANG = 0.08  # Anteil der Kachel, über den die Ränder ineinander geblendet werden


def eigenschaften(name: str) -> dict:
    """Eigenschaften eines Bodens aus assets/karte/boden/boden.json (z. B. gerichtet)."""
    pfad = os.path.join(BODEN_DIR, "boden.json")
    if not os.path.exists(pfad):
        return {}
    with open(pfad, encoding="utf-8") as f:
        return json.load(f).get(name, {})


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


def ausgleichen(kachel: Image.Image) -> Image.Image:
    """Großflächige Hell-dunkel-Verläufe (z. B. Lichtschein quer übers Bild) entfernen,
    die feinen Details bleiben. Sonst sieht man jede Wiederholung als Fleck."""
    w, h = kachel.size
    gross = Image.new("RGB", (w * 3, h * 3))  # rundum fortsetzen, damit der Rand richtig weichgezeichnet wird
    for y in range(3):
        for x in range(3):
            gross.paste(kachel, (x * w, y * h))
    weich = gross.filter(ImageFilter.GaussianBlur(w / 6)).crop((w, h, 2 * w, 2 * h))
    mittel = ImageStat.Stat(kachel).mean
    kanaele = []
    for k, wk, m in zip(kachel.split(), weich.split(), mittel):  # je Kanal: kachel - weich + mittel
        formel = lambda e, m=m: e["min"](e["max"](e["k"] - e["w"] + int(m), 0), 255)  # noqa: E731
        neu = ImageMath.lambda_eval(formel, k=k, w=wk)
        kanaele.append(neu.convert("L"))
    return Image.merge("RGB", kanaele)


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


def kachel(eingabe: str, name: str, meter: float, ohne_erde: bool = False, wiederholung: int = 0,
           ausgleich: bool = False) -> str:
    bild = Image.open(eingabe).convert("RGB")
    px, py = (wiederholung, wiederholung) if wiederholung else (periode(bild, "x"), periode(bild, "y"))
    teil = nahtlos(bild.crop((0, 0, px, py)), 0.25 if ausgleich else UEBERGANG)
    if ausgleich:
        teil = ausgleichen(teil)
    if px != py:  # nicht quadratisch: durch Aneinanderlegen quadratisch machen
        seite = max(px, py)
        quadrat = Image.new("RGB", (seite, seite))
        for y in range(0, seite, py):
            for x in range(0, seite, px):
                quadrat.paste(teil, (x, y))
        teil = quadrat
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


def _kachelflaeche(k: Image.Image, groesse: int) -> Image.Image:
    flaeche = Image.new("RGB", (groesse, groesse))
    for y in range(0, groesse, k.height):
        for x in range(0, groesse, k.width):
            flaeche.paste(k, (x, y))
    return flaeche


def _stempeln(flaeche: Image.Image, k: Image.Image, anzahl: int, rnd: random.Random,
              gerichtet: bool = False) -> None:
    """Gedrehte Ausschnitte der Kachel mit weichem Rand verstreut aufstempeln.
    Bricht die sichtbare Wiederholung auf, ohne Kanten zu erzeugen. Gerichtete
    Texturen (Pinselstriche in eine Richtung) nur um 180° drehen, nie spiegeln."""
    gross = _kachelflaeche(k, k.width * 2)
    r = k.width // 2
    maske = Image.new("L", (2 * r, 2 * r), 0)
    ImageDraw.Draw(maske).ellipse((r * 0.25, r * 0.25, r * 1.75, r * 1.75), fill=255)
    maske = maske.filter(ImageFilter.GaussianBlur(r * 0.25))
    for _ in range(anzahl):
        x0, y0 = rnd.randrange(k.width), rnd.randrange(k.height)
        stueck = gross.crop((x0, y0, x0 + 2 * r, y0 + 2 * r))
        stueck = stueck.rotate(180 if gerichtet else rnd.choice((90, 180, 270)))
        if not gerichtet and rnd.random() < 0.5:
            stueck = stueck.transpose(Image.FLIP_LEFT_RIGHT)
        ziel = (rnd.randrange(-r, flaeche.width - r), rnd.randrange(-r, flaeche.height - r))
        flaeche.paste(stueck, ziel, maske)


def _rauschen(groesse: int, rnd: random.Random, zellen: int = 6) -> Image.Image:
    """Weiche, großflächige Graustufen-Maske zum Mischen zweier Böden."""
    n = zellen * 2  # größer anlegen und schräg drehen, damit kein Raster zu sehen ist
    klein = Image.new("L", (n, n))
    klein.putdata([rnd.randrange(256) for _ in range(n * n)])
    gross = klein.resize((groesse * 2, groesse * 2), Image.BICUBIC).rotate(rnd.uniform(20, 70), Image.BICUBIC)
    mitte = groesse // 2
    ausschnitt = gross.crop((mitte, mitte, mitte + groesse, mitte + groesse))
    return ausschnitt.filter(ImageFilter.GaussianBlur(groesse / 14))


def flaeche(namen: list[str], meter: int = 32, seed: int = 1, auto: str | None = None) -> Image.Image:
    """Fläche aus einem oder zwei Böden: verstreut gedreht gegen Wiederholung,
    bei zwei Böden über eine weiche Rauschmaske gemischt."""
    rnd = random.Random(seed)
    groesse = meter * PX_PRO_M
    lagen = []
    for name in namen:
        k = Image.open(os.path.join(BODEN_DIR, f"{name}.png")).convert("RGB")
        f = _kachelflaeche(k, groesse)
        gerichtet = eigenschaften(name).get("gerichtet", False)
        _stempeln(f, k, anzahl=(meter // 4) ** 2, rnd=rnd, gerichtet=gerichtet)
        lagen.append(f)
    bild = lagen[0]
    if len(lagen) > 1:
        maske = _rauschen(groesse, rnd).point(lambda v: max(0, min(255, (v - 118) * 8)))
        bild = Image.composite(lagen[1], lagen[0], maske)
    if auto and os.path.exists(auto):
        wagen = Image.open(auto).convert("RGBA")
        wagen = wagen.resize((4 * PX_PRO_M, round(4 * PX_PRO_M * wagen.height / wagen.width)), Image.LANCZOS)
        bild.paste(wagen, ((groesse - wagen.width) // 2, (groesse - wagen.height) // 2), wagen)
    return bild


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="befehl", required=True)
    k = sub.add_parser("kachel")
    k.add_argument("eingabe")
    k.add_argument("name")
    k.add_argument("--meter", type=float, default=8, help="Kantenlänge der Kachel in Metern (Standard 8)")
    k.add_argument("--wiederholung", type=int, default=0,
                   help="Wiederholung im Bild in Pixeln vorgeben, falls die Erkennung danebenliegt")
    k.add_argument("--ausgleichen", action="store_true",
                   help="großflächige Lichtverläufe entfernen (wenn Kanten oder Flecken sichtbar sind)")
    k.add_argument("--ohne-erde", action="store_true", help="braune Erdstellen übermalen (z. B. für Gras)")
    pr = sub.add_parser("probe")
    pr.add_argument("name")
    pr.add_argument("ausgabe", nargs="?")
    pr.add_argument("--auto", help="Draufsicht eines Autos als Größenvergleich")
    fl = sub.add_parser("flaeche", help="Fläche gegen Wiederholung gedreht und gemischt")
    fl.add_argument("namen", nargs="+", help="ein oder zwei Böden, z. B. gras_ruhig gras")
    fl.add_argument("--ausgabe", required=True)
    fl.add_argument("--meter", type=int, default=32)
    fl.add_argument("--seed", type=int, default=1)
    fl.add_argument("--auto")
    args = p.parse_args(argv)
    if args.befehl == "kachel":
        kachel(args.eingabe, args.name, args.meter, args.ohne_erde, args.wiederholung, args.ausgleichen)
    elif args.befehl == "flaeche":
        flaeche(args.namen, args.meter, args.seed, args.auto).save(args.ausgabe)
        print(os.path.relpath(args.ausgabe))
    else:
        ziel = args.ausgabe or os.path.join(BODEN_DIR, f"probe_{args.name}.png")
        probe(args.name, args.auto).save(ziel)
        print(os.path.relpath(ziel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
