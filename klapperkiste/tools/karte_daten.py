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
OBJEKTE = ["laubbaum", "nadelbaum", "busch", "felsbrocken", "zaun", "schild", "schuppen", "schrottplatz", "reifen"]
GRUND = {"rahmen": "bettgestell", "achseH": "rostachse", "achseV": "rostachse", "radH": "schubkarre",
         "radV": "schubkarre", "motor": "maeher", "energie": "giesskanne", "sitz": "kuechenstuhl",
         "lenkung": "fahrradlenker"}
MODELLE = {"rundling": "Rundling", "pickup": "Pick-up", "badewanne": "Badewanne",
           "telefonzelle": "Telefonzelle", "eiswagen": "Eiswagen", "heuscheune": "Heuscheune",
           "rakete": "Rakete", "kutsche": "Kutsche",
           "hotdog": "Hot-Dog-Wagen", "feuerwehr": "Feuerwehr", "betonmischer": "Betonmischer",
           "wohnwagen": "Mini-Wohnwagen", "geldtransporter": "Geldtransporter", "schneeraupe": "Schneeraupe",
           "gewaechshaus": "Gewächshaus", "zirkus": "Zirkus", "schlauchboot": "Schlauchboot"}
LADEN = ["rundling_hinten", "rundling_mitte", "rundling_vorne"]  # Knuts erstes Angebot
AUTO_PX = 320  # Breite des Autobilds (10 Zellen = 4 m)


def _uri(bild: Image.Image) -> str:
    puffer = io.BytesIO()
    bild.save(puffer, "WEBP", quality=88, method=4)
    return "data:image/webp;base64," + base64.b64encode(puffer.getvalue()).decode("ascii")


def auto(raster: dict, modell: str | None) -> Image.Image:
    teile = {slot: Image.open(os.path.join(teilwerk.TEILE_DIR, tid, "oben.png")).convert("RGBA")
             for slot, tid in GRUND.items()}
    if modell:
        for slot, teil in (("karoH", "hinten"), ("karoM", "mitte"), ("karoV", "vorne")):
            pfad = os.path.join(teilwerk.TEILE_DIR, f"{modell}_{teil}", "oben.png")
            teile[slot] = Image.open(pfad).convert("RGBA")
    bild = teilwerk.bauen(raster, "oben", teile)
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
    return bild.resize((round(bild.width * faktor), round(bild.height * faktor)), Image.LANCZOS)


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
    daten = {"boden": {}, "objekte": {}, "autos": [], **figuren()}
    for name in BODEN:
        k = Image.open(os.path.join(ROOT, "assets", "karte", "boden", f"{name}.png")).convert("RGB")
        daten["boden"][name] = {"bild": _uri(k), "meter": k.width / 32}
    for name in OBJEKTE:
        o = Image.open(os.path.join(ROOT, "assets", "karte", "objekte", f"{name}.png")).convert("RGBA")
        daten["objekte"][name] = {"bild": _uri(o), "breite": o.width / 32, "hoehe": o.height / 32}
    ohne = auto(raster, None)
    daten["autos"].append({"id": "ohne", "name": "Schrottkarre (ohne Karosserie)", "bild": _uri(ohne),
                           "laenge": ohne.width / AUTO_PX * 4})
    for mid, name in MODELLE.items():
        if not os.path.isdir(os.path.join(teilwerk.TEILE_DIR, f"{mid}_hinten")):
            continue
        a = auto(raster, mid)
        daten["autos"].append({"id": mid, "name": name, "bild": _uri(a), "laenge": a.width / AUTO_PX * 4})
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write("// Automatisch erzeugt von tools/karte_daten.py. Nicht von Hand ändern.\n")
        f.write("window.KARTE_DATEN = " + json.dumps(daten) + ";\n")
    print(f"{os.path.relpath(ZIEL)}: {len(daten['autos'])} Autos, {os.path.getsize(ZIEL) // 1024} KB")
    spielstart_teile()
    return 0


if __name__ == "__main__":
    sys.exit(main())
