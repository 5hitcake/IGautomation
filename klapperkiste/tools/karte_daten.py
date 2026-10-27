"""Bilder für die Karten-Fahrprobe (design/kartenprobe.html) als design/karte_daten.js.

Dazu design/spielstart_teile.js mit den Teilen der Schrottkarre (Werkstatt im
Spielstart). Die ganze Teile-Sammlung wäre für die Spielstart-Seite zu groß.

Enthält die Boden-Kacheln, die Kartenobjekte und fertig zusammengebaute Autos
von oben: die Schrottkarre ohne Karosserie und mit jedem kompletten
Karosserie-Satz (inklusive Anbauteilen wie dem Räumschild).

Aufruf:
  python klapperkiste/tools/karte_daten.py
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import teilwerk  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ZIEL = os.path.join(ROOT, "design", "karte_daten.js")
ZIEL_TEILE = os.path.join(ROOT, "design", "spielstart_teile.js")
BODEN = ["gras_ruhig", "gras", "erde", "schotter"]
OBJEKTE = ["laubbaum", "nadelbaum", "busch", "felsbrocken", "zaun", "schild", "schuppen", "schrottplatz",
           "reifen", "batterie", "huette",
           "bauernhof", "foersterhuette"]
GRUND = {"rahmen": "bettgestell", "achseH": "rostachse", "achseV": "rostachse", "radH": "schubkarre",
         "radV": "schubkarre", "motor": "maeher", "energie": "giesskanne", "sitz": "kuechenstuhl",
         "lenkung": "fahrradlenker"}
MODELLE = {"rundling": "Rundling", "pickup": "Pick-up", "badewanne": "Badewanne",
           "telefonzelle": "Telefonzelle", "eiswagen": "Eiswagen", "heuscheune": "Heuscheune",
           "rakete": "Rakete", "kutsche": "Kutsche",
           "hotdog": "Hot-Dog-Wagen", "feuerwehr": "Feuerwehr", "betonmischer": "Betonmischer",
           "wohnwagen": "Mini-Wohnwagen", "geldtransporter": "Geldtransporter", "schneeraupe": "Schneeraupe",
           "gewaechshaus": "Gewächshaus", "zirkus": "Zirkus", "schlauchboot": "Schlauchboot"}
TIERE = ["vogel", "hase", "schaf", "kuh"]  # je zwei Posen: NAME_1.png, NAME_2.png
LADEN = ["rundling_hinten", "rundling_mitte", "rundling_vorne", "scheinwerfer", "spezialhupe",
         "pickup_hinten"]  # Knuts Laden und Belohnungen
AUTO_PX = 320  # Breite des Autobilds (10 Zellen = 4 m)


def _uri(bild: Image.Image) -> str:
    puffer = io.BytesIO()
    bild.save(puffer, "WEBP", quality=88, method=4)
    return "data:image/webp;base64," + base64.b64encode(puffer.getvalue()).decode("ascii")


LENKACHSE = ("achseV", "radV")  # dreht sich auf der Karte beim Lenken mit


def auto(raster: dict, modell: str | None) -> tuple[Image.Image, Image.Image, list[float]]:
    """Auto von oben in zwei Ebenen: Rumpf (alles außer Vorderachse und Vorderrädern)
    und Lenkachse (nur diese, gleiche Leinwand wie der Rumpf ohne Anbauteil).
    Dazu der Drehpunkt der Lenkachse in Metern (x ab Heck, y ab linker Kante)."""
    teile = {slot: Image.open(os.path.join(teilwerk.TEILE_DIR, tid, "oben.png")).convert("RGBA")
             for slot, tid in GRUND.items()}
    if modell:
        for slot, teil in (("karoH", "hinten"), ("karoM", "mitte"), ("karoV", "vorne")):
            pfad = os.path.join(teilwerk.TEILE_DIR, f"{modell}_{teil}", "oben.png")
            teile[slot] = Image.open(pfad).convert("RGBA")
    lenkachse = teilwerk.bauen(raster, "oben", {s: t for s, t in teile.items() if s in LENKACHSE})
    bild = teilwerk.bauen(raster, "oben", {s: t for s, t in teile.items() if s not in LENKACHSE})
    z = raster["zelle_px"]
    anbau = raster.get("anbauten", {}).get(f"{modell}_vorne") if modell else None
    if anbau:  # Anbauteil kann über das Auto hinausragen: Leinwand vorne verlängern
        x, y, b, h = anbau["oben"]
        breiter = Image.new("RGBA", (max(bild.width, round((x + b) * z)), bild.height), (0, 0, 0, 0))
        breiter.alpha_composite(bild)
        teil = Image.open(os.path.join(teilwerk.TEILE_DIR, anbau["teil"], "oben.png")).convert("RGBA")
        teil = teil.resize((round(b * z), round(h * z)), Image.LANCZOS)
        breiter.alpha_composite(teil, (round(x * z), round(y * z)))
        bild = breiter
    faktor = AUTO_PX / (raster["oben"]["breite"] * z)
    klein = lambda b: b.resize((round(b.width * faktor), round(b.height * faktor)), Image.LANCZOS)  # noqa: E731
    # Drehpunkt: Mitte der Vorderachse (Box in Zellen), umgerechnet in Meter (10 Zellen = 4 m)
    ax, ay = raster["slots"]["achseV"]["oben"][0]
    ab, ah = raster["kategorien"]["achse"]["oben"]
    m = 4 / raster["oben"]["breite"]
    return klein(bild), klein(lenkachse), [(ax + ab / 2) * m, (ay + ah / 2) * m]


def figuren() -> dict:
    """Figuren (vier Gesten, Höhe 640 px) und Gesprächshintergründe (Breite 1280 px)."""
    ch = os.path.join(ROOT, "assets", "charaktere")
    daten = {"figuren": {}, "hintergruende": {}}
    for name in sorted(os.listdir(ch)):
        ordner = os.path.join(ch, name)
        if name in ("roh", "hintergrund") or not os.path.isdir(ordner):
            continue
        gesten = {}
        for datei in sorted(os.listdir(ordner)):
            if datei.endswith(".png"):
                b = Image.open(os.path.join(ordner, datei)).convert("RGBA")
                b = b.resize((round(b.width * 640 / b.height), 640), Image.LANCZOS)
                gesten[datei[:-4]] = _uri(b)
        daten["figuren"][name] = gesten
    hg = os.path.join(ch, "hintergrund")
    for datei in sorted(os.listdir(hg)) if os.path.isdir(hg) else []:
        b = Image.open(os.path.join(hg, datei)).convert("RGB")
        b = b.resize((1280, round(b.height * 1280 / b.width)), Image.LANCZOS)
        daten["hintergruende"][datei.rsplit(".", 1)[0]] = _uri(b)
    return daten


def spielstart_teile() -> None:
    """Teile der Schrottkarre und aus Knuts Laden (Seite und Draufsicht) für die Werkstatt im Spielstart."""
    teile, vorschau = {}, {}
    # dazu, was Knut im Laden hat (Karosserie-Teile kommen Stück für Stück)
    for tid in [*dict.fromkeys(GRUND.values()), *LADEN]:
        for ansicht in ("seite", "oben"):
            uri = _uri(Image.open(os.path.join(teilwerk.TEILE_DIR, tid, f"{ansicht}.png")).convert("RGBA"))
            teile[f"{tid}_{ansicht}"] = uri
            vorschau[f"{tid}_{ansicht}"] = {"bild": uri}
    with open(ZIEL_TEILE, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/karte_daten.py. Nicht von Hand ändern.\n")
        f.write("window.TEILE = " + json.dumps(teile) + ";\n")
        f.write("window.GELIEFERT = " + json.dumps(vorschau) + ";\n")
    print(f"{os.path.relpath(ZIEL_TEILE)}: {len(teile)} Bilder, {os.path.getsize(ZIEL_TEILE) // 1024} KB")


def main() -> int:
    raster = teilwerk.lade_raster()
    daten = {"boden": {}, "objekte": {}, "tiere": {}, "autos": [], **figuren()}
    for name in BODEN:
        k = Image.open(os.path.join(ROOT, "assets", "karte", "boden", f"{name}.png")).convert("RGB")
        daten["boden"][name] = {"bild": _uri(k), "meter": k.width / 32}
    for name in OBJEKTE:
        o = Image.open(os.path.join(ROOT, "assets", "karte", "objekte", f"{name}.png")).convert("RGBA")
        daten["objekte"][name] = {"bild": _uri(o), "breite": o.width / 32, "hoehe": o.height / 32}
    for name in TIERE:
        posen = []
        for i in (1, 2):
            pfad = os.path.join(ROOT, "assets", "karte", "tiere", f"{name}_{i}.png")
            if os.path.exists(pfad):
                t = Image.open(pfad).convert("RGBA")
                posen.append({"bild": _uri(t), "breite": t.width / 64, "hoehe": t.height / 64})  # 64 px/m
        if posen:
            daten["tiere"][name] = posen
    ohne, achse, dreh = auto(raster, None)
    daten["autos"].append({"id": "ohne", "name": "Schrottkarre (ohne Karosserie)", "bild": _uri(ohne),
                           "achse": _uri(achse), "drehpunkt": dreh, "laenge": ohne.width / AUTO_PX * 4})
    for mid, name in MODELLE.items():
        if not os.path.isdir(os.path.join(teilwerk.TEILE_DIR, f"{mid}_hinten")):
            continue
        a, achse, dreh = auto(raster, mid)
        daten["autos"].append({"id": mid, "name": name, "bild": _uri(a), "achse": _uri(achse),
                               "drehpunkt": dreh, "laenge": a.width / AUTO_PX * 4})
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/karte_daten.py. Nicht von Hand ändern.\n")
        f.write("window.KARTE_DATEN = " + json.dumps(daten) + ";\n")
    print(f"{os.path.relpath(ZIEL)}: {len(daten['autos'])} Autos, {os.path.getsize(ZIEL) // 1024} KB")
    spielstart_teile()
    return 0


if __name__ == "__main__":
    sys.exit(main())
