"""Einmalige Bearbeitung: Bodenschatten aller Figuren schwarz statt weißgrau.

Unter den Füßen liegt bei allen Figuren eine helle, weißgraue Schraffur. Im untersten
Streifen werden helle, fast farblose Pixel dunkel gefärbt, wenn sie von außen
(von durchsichtigen Pixeln her) erreichbar sind oder kleine Inseln in der
Schraffur bilden. Helle Schuhe (Opas graue Schuhe, Zylindas weiße Gamaschen)
sind von ihrer dunklen Umrisslinie eingeschlossen und bleiben hell.
Förster Moos ist schon mit moos_schatten.py bearbeitet und wird übersprungen.

Aufruf:
  python klapperkiste/tools/einmalig/schatten_schwarz.py [--probe DATEI]
  --probe: nichts speichern, nur Füße aller Figuren nebeneinander in DATEI
"""

from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CH = os.path.join(ROOT, "assets", "charaktere")
AUSLASSEN = {"roh", "hintergrund", "moos"}
BAND = 0.10        # Schatten liegt im untersten Streifen dieser Höhe (Anteil der Bildhöhe)
INSEL = 0.002      # eingeschlossene helle Flächen bis zu dieser Größe (Anteil der Bildfläche);
                   # Schuhinneres ist ab 0.0029 groß, Schatteninseln höchstens 0.0016


def hell_und_grau(r: int, g: int, b: int) -> bool:
    return min(r, g, b) > 95 and max(r, g, b) - min(r, g, b) < 40


def schatten_schwarz(bild: Image.Image) -> int:
    """Helle, farblose Pixel im unteren Streifen schwarz färben, wenn sie von
    außen erreichbar sind oder nur kleine Inseln in der Schraffur bilden.

    Von außen heißt: von durchsichtigen Pixeln aus, nur über helle oder
    durchsichtige Pixel (4er-Nachbarschaft). Das helle Innere eines Schuhs ist
    von seiner dunklen Umrisslinie eingeschlossen und groß, es bleibt hell."""
    px = bild.load()
    w, h = bild.size
    unten = max(y for y in range(h) if any(px[x, y][3] for x in range(w)))
    oben = max(0, unten - round(h * BAND))

    def sperre(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return bool(a) and not hell_und_grau(r, g, b)

    # Umrisslinien um einen Pixel verdicken, damit kleine Lücken nicht durchlassen
    dick = {(x, y) for y in range(oben, h) for x in range(w)
            if any(sperre(xx, yy) for xx, yy in ((x, y), (x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                   if 0 <= xx < w and oben <= yy < h)}

    def frei(x: int, y: int) -> bool:
        return (x, y) not in dick

    gesehen = set()
    stapel = [(x, y) for y in range(oben, h) for x in range(w) if not px[x, y][3] and frei(x, y)]
    gesehen.update(stapel)
    while stapel:
        x, y = stapel.pop()
        for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if oben <= nb[1] < h and 0 <= nb[0] < w and nb not in gesehen and frei(*nb):
                gesehen.add(nb)
                stapel.append(nb)
    maske = {(x, y) for x, y in gesehen if px[x, y][3]}
    # kleine eingeschlossene Inseln zwischen Schraffurstrichen dazunehmen (nur direkt
    # neben dem Schatten, damit Glanzlichter auf dunklen Stiefeln hell bleiben)
    aussen = set(maske)
    rest = {(x, y) for y in range(oben, h) for x in range(w)
            if px[x, y][3] and hell_und_grau(*px[x, y][:3]) and (x, y) not in maske}
    while rest:
        stapel = [rest.pop()]
        insel = []
        while stapel:
            x, y = stapel.pop()
            insel.append((x, y))
            for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nb in rest:
                    rest.remove(nb)
                    stapel.append(nb)
        neben_schatten = any((x + dx, y + dy) in aussen for x, y in insel
                             for dx in (-2, 0, 2) for dy in (-2, 0, 2))
        if len(insel) <= INSEL * w * h and min(y for _, y in insel) > oben and neben_schatten:
            maske.update(insel)
    for x, y in maske:
        r, g, b, a = px[x, y]
        v = round((255 - (r + g + b) / 3) * 0.35)
        px[x, y] = (v, v, v, a)
    return len(maske)


def main() -> int:
    probe = sys.argv[sys.argv.index("--probe") + 1] if "--probe" in sys.argv else None
    reihen = []
    for name in sorted(os.listdir(CH)):
        ordner = os.path.join(CH, name)
        if name in AUSLASSEN or not os.path.isdir(ordner):
            continue
        teile = []
        for datei in sorted(os.listdir(ordner)):
            if not datei.endswith(".png"):
                continue
            pfad = os.path.join(ordner, datei)
            bild = Image.open(pfad).convert("RGBA")
            n = schatten_schwarz(bild)
            print(f"{name}/{datei}: {n} px")
            if probe:
                k = bild.resize((round(bild.width * 640 / bild.height), 640))
                c = Image.new("RGB", k.size, (90, 120, 70))
                c.paste(k, (0, 0), k)
                teile.append(c.crop((0, 500, k.width, 640)))
            else:
                bild.save(pfad)
        if probe:
            reihe = Image.new("RGB", (sum(t.width for t in teile), 140))
            x = 0
            for t in teile:
                reihe.paste(t, (x, 0))
                x += t.width
            reihen.append(reihe)
    if probe:
        bogen = Image.new("RGB", (max(r.width for r in reihen), 140 * len(reihen)), "white")
        for i, r in enumerate(reihen):
            bogen.paste(r, (0, 140 * i))
        bogen.save(probe)
    return 0


if __name__ == "__main__":
    sys.exit(main())
