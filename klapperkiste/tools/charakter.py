"""Figurenbogen (2 × 2 Gesten) in einzelne, freigestellte Gesten schneiden.

Die Trennlinien werden an den hellsten Zeilen und Spalten nahe der Bildmitte
gesucht, danach wird jede Geste freigestellt und auf die Figur zugeschnitten.

Reihenfolge der Gesten: 1 hallo (oben links), 2 nachdenken (oben rechts),
3 auftrag (unten links), 4 juhu (unten rechts).

Aufruf:
  python klapperkiste/tools/charakter.py EINGABE NAME [--arme] [--saum GESTE] [--loch GESTE:X,Y]
  --arme: auch weiße Lücken zwischen Arm und Körper entfernen (nicht bei weißer Kleidung)
  --saum GESTE: hellen Papiersaum um Kopf und Arme dieser Geste abtragen (nur obere
    Hälfte, sonst frisst er sich in weiße Hosenstreifen), z. B. --saum hallo bei Zylinda
  --loch GESTE:X,Y: eingeschlossene weiße Lücke an dieser Stelle (Anteile 0–1 der
    Geste) durchsichtig machen, z. B. zwischen Kopf und Arm neben einem weißen Handschuh
Ergebnis: assets/charaktere/NAME/hallo.png, nachdenken.png, auftrag.png, juhu.png
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageStat

sys.path.insert(0, os.path.dirname(__file__))
import teilwerk  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ZIEL_DIR = os.path.join(ROOT, "assets", "charaktere")
GESTEN = ["hallo", "nachdenken", "auftrag", "juhu"]


def _trenner(bild: Image.Image, achse: str) -> int:
    """Hellste Zeile/Spalte im mittleren Drittel."""
    grau = bild.convert("L")
    n = grau.width if achse == "x" else grau.height
    beste = (-1.0, n // 2)
    for i in range(n // 3, 2 * n // 3):
        box = (i, 0, i + 1, grau.height) if achse == "x" else (0, i, grau.width, i + 1)
        streifen = grau.crop(box)
        hell = ImageStat.Stat(streifen).mean[0]
        beste = max(beste, (hell, i))
    return beste[1]


def beine_frei(teil: Image.Image, ab: float = 0.5, arme: bool = False) -> Image.Image:
    """Eingeschlossenes Papierweiß zwischen den Beinen entfernen.

    Gesucht wird nur in der unteren Hälfte, und entfernt werden nur weiße Flächen,
    die hoch und schmal sind und bis zu den Füßen reichen (Lücke zwischen den
    Beinen). Augen, Brillengläser und breite weiße Flächen wie eine Schürze
    bleiben erhalten.

    Mit arme=True werden auch Lücken zwischen Arm und Körper entfernt: ab einem
    Viertel der Höhe jede eingeschlossene weiße Fläche, darüber nur seitlich
    neben dem Kopf. Nur bei Figuren mit kleinem Kopf oben und ohne weiße
    Kleidung verwenden (z. B. Brösel), sonst gehen Augen oder Zähne verloren."""
    if arme:
        ab = 0.1
    px = teil.load()
    y0 = round(teil.height * ab)
    kand = Image.new("L", teil.size, 0)
    kp = kand.load()
    for y in range(y0, teil.height):
        for x in range(teil.width):
            r, g, b, a = px[x, y]
            hell, grau = (198, 32) if arme else (215, 25)
            if a > 200 and min(r, g, b) > hell and max(r, g, b) - min(r, g, b) < grau:
                kp[x, y] = 255
    alpha = teil.getchannel("A")
    while True:
        box = kand.getbbox()
        if not box:
            break
        # erstes Pixel des Kandidaten suchen und seine Fläche füllen
        x0, yy = next((x, box[1]) for x in range(box[0], box[2]) if kp[x, box[1]] == 255)
        ImageDraw.floodfill(kand, (x0, yy), 128)
        flaeche = kand.point(lambda v: 255 if v == 128 else 0)
        fx0, fy0, fx1, fy1 = flaeche.getbbox()
        b, h = fx1 - fx0, fy1 - fy0
        schmal_hoch = h >= 1.2 * b and b < teil.width * 0.3
        mitte_x = (fx0 + fx1) / 2 / teil.width
        seitlich = mitte_x < 0.33 or mitte_x > 0.66  # neben dem Kopf, nicht Augen oder Zähne
        arm_luecke = arme and (fy0 >= teil.height * 0.25 or seitlich)
        if flaeche.histogram()[255] >= 60 and (arm_luecke or schmal_hoch and fy1 > teil.height * 0.75):
            alpha.paste(0, (0, 0), flaeche)
        kand.paste(0, (0, 0), flaeche)
    teil.putalpha(alpha)
    return teil


def saum_weg(teil: Image.Image, runden: int = 4, bis: float = 0.5) -> Image.Image:
    """Hellen, fast farblosen Papiersaum an der Außenkante abtragen: je Runde werden
    helle Pixel entfernt, die direkt an Durchsichtiges grenzen. Weiße Handschuhe oder
    Augen bleiben, weil sie von einer dunklen Kontur umgeben sind."""
    px = teil.load()
    b, h = teil.size
    for _ in range(runden):
        weg = []
        for y in range(round(h * bis)):
            for x in range(b):
                r, g, bl, a = px[x, y]
                if not a or min(r, g, bl) < 175 or max(r, g, bl) - min(r, g, bl) > 45:
                    continue
                if any(not (0 <= x + dx < b and 0 <= y + dy < h) or px[x + dx, y + dy][3] < 40
                       for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                    weg.append((x, y))
        for x, y in weg:
            r, g, bl, _ = px[x, y]
            px[x, y] = (r, g, bl, 0)
        if not weg:
            break
    return teil


def kleine_loecher_zu(teil: Image.Image, max_flaeche: int = 80) -> Image.Image:
    """Kleine durchsichtige Löcher mitten in der Figur (z. B. Pünktchen im weißen
    Handschuh) wieder schließen. Nur ringsum eingeschlossene Löcher bis max_flaeche
    Pixel; Lücken zwischen Beinen oder Fingern sind größer oder offen nach außen."""
    a = teil.getchannel("A").point(lambda v: 255 if v < 40 else 0)
    rand = Image.new("L", (a.width + 2, a.height + 2), 255)
    rand.paste(a, (1, 1))
    ImageDraw.floodfill(rand, (0, 0), 0, thresh=0)  # alles von außen Erreichbare weg
    innen = rand.crop((1, 1, a.width + 1, a.height + 1))
    px, ipx = teil.load(), innen.load()
    gesehen = set()
    for y in range(teil.height):
        for x in range(teil.width):
            if ipx[x, y] != 255 or (x, y) in gesehen:
                continue
            loch, stapel = [], [(x, y)]
            gesehen.add((x, y))
            while stapel and len(loch) <= max_flaeche:
                cx, cy = stapel.pop()
                loch.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    drin = 0 <= nx < teil.width and 0 <= ny < teil.height
                    if drin and ipx[nx, ny] == 255 and (nx, ny) not in gesehen:
                        gesehen.add((nx, ny))
                        stapel.append((nx, ny))
            if len(loch) <= max_flaeche and not stapel:
                for lx, ly in loch:
                    r, g, b, _ = px[lx, ly]
                    px[lx, ly] = (r, g, b, 255)
    return teil


def loch_frei(teil: Image.Image, fx: float, fy: float) -> Image.Image:
    """Weiße Fläche ab dem Punkt (Anteile der Bildgröße) durchsichtig machen."""
    rgb = teil.convert("RGB")
    start = (round(fx * (teil.width - 1)), round(fy * (teil.height - 1)))
    if min(rgb.getpixel(start)) < 200:
        raise SystemExit(f"--loch: Punkt {start} ist nicht weiß {rgb.getpixel(start)}.")
    ImageDraw.floodfill(rgb, start, (1, 254, 3), thresh=45)
    px, rpx = teil.load(), rgb.load()
    for y in range(teil.height):
        for x in range(teil.width):
            if rpx[x, y] == (1, 254, 3):
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return teil


def schneiden(eingabe: str, name: str, arme: bool = False, saum: tuple[str, ...] = (),
              loecher: tuple[tuple[str, float, float], ...] = ()) -> list[str]:
    bild = Image.open(eingabe).convert("RGB")
    tx, ty = _trenner(bild, "x"), _trenner(bild, "y")
    b, h = bild.size
    felder = [(0, 0, tx, ty), (tx, 0, b, ty), (0, ty, tx, h), (tx, ty, b, h)]
    ziel = os.path.join(ZIEL_DIR, name)
    os.makedirs(ziel, exist_ok=True)
    pfade = []
    for geste, feld in zip(GESTEN, felder):
        teil = teilwerk.freistellen(bild.crop(feld), toleranz=30, inseln=False)
        # Papierkrümel am Rand (fast weiß, kaum Farbe) entfernen
        px = teil.load()
        for y in range(teil.height):
            for x in range(teil.width):
                r, g, b, a = px[x, y]
                if a and min(r, g, b) > 205 and max(r, g, b) - min(r, g, b) < 18:
                    nachbar_leer = any(0 <= x + dx < teil.width and 0 <= y + dy < teil.height
                                       and px[x + dx, y + dy][3] == 0
                                       for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)))
                    if nachbar_leer:
                        px[x, y] = (r, g, b, 0)
        teil = teil.crop(teil.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox())
        teil = beine_frei(teil, arme=arme)
        if geste in saum:
            teil = saum_weg(teil)
        teil = kleine_loecher_zu(teil)
        for g, fx, fy in loecher:
            if g == geste:
                teil = loch_frei(teil, fx, fy)
        pfad = os.path.join(ziel, f"{geste}.png")
        teil.save(pfad)
        pfade.append(pfad)
        print(f"{os.path.relpath(pfad)}: {teil.width}×{teil.height} px")
    return pfade


if __name__ == "__main__":
    argumente, saum, loecher = [], [], []
    rest = iter(sys.argv[1:])
    for a in rest:
        if a == "--saum":
            saum.append(next(rest, ""))
        elif a == "--loch":
            g, _, xy = next(rest, "").partition(":")
            loecher.append((g, *(float(v) for v in xy.split(","))))
        elif a != "--arme":
            argumente.append(a)
    if len(argumente) != 2:
        print(__doc__)
        sys.exit(1)
    schneiden(argumente[0], argumente[1], arme="--arme" in sys.argv, saum=tuple(saum), loecher=tuple(loecher))
