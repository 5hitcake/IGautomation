"""Echte Produktfotos fuer @kaufkraft.check.

Reihenfolge:
  1. Liegt schon assets/kaufkraft_products/<id>.jpg im Repo, wird es genommen
     (eigene Fotos einfach unter diesem Namen ablegen - die haben immer Vorrang).
  2. Pexels (PEXELS_API_KEY, kostenlos unter https://www.pexels.com/api/):
     echte Fotos, kommerziell frei nutzbar, Namensnennung erwuenscht.
  3. Openverse (kein Schluessel): nur Fotos unter CC0 / Public Domain / CC BY.

Fotograf + Quelle landen in assets/kaufkraft_products/credits.json und werden
auf der Grafik und in der Caption genannt.

  python kaufkraft_photos.py               (fehlende Fotos fuer alle Produkte holen)
  python kaufkraft_photos.py --redo benzin (Foto fuer ein Produkt neu holen)
"""
import argparse
import io
import json
import os

import requests
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
PHOTOS_DIR = os.path.join(ROOT, "assets", "kaufkraft_products")
CREDITS_FILE = "credits.json"
USER_AGENT = "kaufkraft-check-bot/1.0"
MAX_SIDE = 1600

PEXELS_URL = "https://api.pexels.com/v1/search"
OPENVERSE_URL = "https://api.openverse.org/v1/images/"
OPENVERSE_LICENSES = {"cc0": "CC0", "pdm": "Public Domain", "by": "CC BY"}
# Quellen bei Openverse, die meist Grafiken/Cliparts statt Fotos liefern
OPENVERSE_SKIP_SOURCES = {"rawpixel", "svgsilh", "nappy"}


def photos_dir():
    return PHOTOS_DIR


def load_credits(directory=None):
    path = os.path.join(directory or photos_dir(), CREDITS_FILE)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_credits(credits, directory=None):
    directory = directory or photos_dir()
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, CREDITS_FILE), "w", encoding="utf-8") as f:
        json.dump(credits, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def credit_line(credit):
    """Kurzer Text fuer Grafik/Caption, z.B. 'Foto: Max Muster / Pexels'."""
    if not credit:
        return None
    text = f"Foto: {credit.get('author') or 'unbekannt'} / {credit['source']}"
    if credit.get("license"):
        text += f" ({credit['license']})"
    return text


def query_for(product):
    return product.get("photo_query") or product["name"]


def search_pexels(query, api_key, session=requests):
    resp = session.get(
        PEXELS_URL,
        params={"query": query, "per_page": 15, "orientation": "landscape"},
        headers={"Authorization": api_key, "User-Agent": USER_AGENT},
        timeout=30,
    )
    resp.raise_for_status()
    out = []
    for p in resp.json().get("photos", []):
        out.append({
            "image_url": p["src"].get("large2x") or p["src"]["original"],
            "author": p.get("photographer"),
            "source": "Pexels",
            "license": None,
            "page_url": p.get("url"),
            "id": f"pexels:{p['id']}",
        })
    return out


def search_openverse(query, session=requests):
    resp = session.get(
        OPENVERSE_URL,
        params={"q": query, "license": ",".join(OPENVERSE_LICENSES), "category": "photograph",
                "page_size": 20, "mature": "false"},
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    resp.raise_for_status()
    out = []
    for r in resp.json().get("results", []):
        if r.get("source") in OPENVERSE_SKIP_SOURCES or (r.get("width") or 0) < 800:
            continue
        if str(r.get("url", "")).lower().endswith((".svg", ".png", ".gif")):
            continue
        out.append({
            # ueber den offiziellen Openverse-Bildendpunkt laden (Originalhoster wie Flickr
            # sperren direkte Downloads von Skripten)
            "image_url": f"{OPENVERSE_URL}{r['id']}/thumb/?full_size=true",
            "author": r.get("creator"),
            "source": (r.get("source") or "Openverse").replace("_", " ").title(),
            "license": OPENVERSE_LICENSES.get(r.get("license")),
            "page_url": r.get("foreign_landing_url"),
            "id": f"openverse:{r.get('id')}",
        })
    return out


def download(url, session=requests):
    resp = session.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    resp.raise_for_status()
    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    return img


def candidates(product, session=requests):
    query = query_for(product)
    key = os.environ.get("PEXELS_API_KEY", "").strip()
    found = []
    if key:
        try:
            found += search_pexels(query, key, session)
        except Exception as exc:  # noqa: BLE001 - dann eben Openverse
            print(f"Pexels-Suche fehlgeschlagen ({product['id']}): {exc}")
    if not found:
        try:
            found += search_openverse(query, session)
        except Exception as exc:  # noqa: BLE001
            print(f"Openverse-Suche fehlgeschlagen ({product['id']}): {exc}")
    return found


def fetch_photo(product, directory=None, session=requests, redo=False):
    """Holt ein echtes Foto und speichert es als <id>.jpg. Rueckgabe: Pfad oder None."""
    directory = directory or photos_dir()
    path = os.path.join(directory, f"{product['id']}.jpg")
    if os.path.exists(path) and not redo:
        return path
    credits = load_credits(directory)
    used = {c.get("id") for pid, c in credits.items() if pid != product["id"]}
    skip = {credits.get(product["id"], {}).get("id")} if redo else set()
    for cand in candidates(product, session):
        if cand["id"] in used or cand["id"] in skip:
            continue  # nicht dasselbe Foto fuer zwei Produkte / beim Neu-Holen nicht wieder dasselbe
        try:
            img = download(cand["image_url"], session)
        except Exception as exc:  # noqa: BLE001 - naechsten Kandidaten probieren
            print(f"Download fehlgeschlagen: {exc}")
            continue
        os.makedirs(directory, exist_ok=True)
        img.save(path, "JPEG", quality=88)
        credits[product["id"]] = {k: cand[k] for k in ("author", "source", "license", "page_url", "id")}
        save_credits(credits, directory)
        print(f"Foto fuer {product['id']}: {credit_line(cand)} -> {path}")
        return path
    print(f"Kein passendes Foto fuer {product['id']} gefunden.")
    return None


def make_overview(products, directory=None, cols=6, cell=300):
    """Kontaktbogen aller vorhandenen Fotos mit Produkt-ID, zum schnellen Pruefen."""
    from PIL import ImageDraw, ImageFont

    directory = directory or photos_dir()
    items = [(p["id"], os.path.join(directory, f"{p['id']}.jpg")) for p in products]
    rows = (len(items) + cols - 1) // cols
    label_h = 44
    sheet = Image.new("RGB", (cols * cell, rows * (cell + label_h)), (246, 241, 232))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(os.path.join(ROOT, "assets", "fonts", "Poppins-SemiBold.ttf"), 24)
    for i, (pid, path) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + label_h)
        if os.path.exists(path):
            img = Image.open(path).convert("RGB")
            side = min(img.size)
            img = img.crop(((img.width - side) // 2, (img.height - side) // 2,
                            (img.width + side) // 2, (img.height + side) // 2))
            sheet.paste(img.resize((cell - 8, cell - 8)), (x + 4, y + 4))
        else:
            draw.rectangle((x + 4, y + 4, x + cell - 4, y + cell - 4), fill=(200, 200, 200))
            draw.text((x + 20, y + cell / 2 - 14), "kein Foto", font=font, fill=(90, 90, 90))
        draw.text((x + 10, y + cell + 6), pid, font=font, fill=(16, 27, 45))
    out = os.path.join(directory, "_uebersicht.jpg")
    sheet.save(out, "JPEG", quality=85)
    print(f"Uebersicht: {out}")
    return out


def main():
    import kaufkraft_data as kd

    parser = argparse.ArgumentParser()
    parser.add_argument("--redo", help="Produkt-IDs (kommagetrennt), deren Foto neu geholt wird")
    args = parser.parse_args()
    products = kd.load_products()
    if args.redo:
        ids = set(args.redo.split(","))
        for p in products:
            if p["id"] in ids:
                fetch_photo(p, redo=True)
        make_overview(products)
        return
    missing = [p for p in products if not os.path.exists(os.path.join(PHOTOS_DIR, f"{p['id']}.jpg"))]
    print(f"{len(missing)} Produkte ohne Foto")
    for p in missing:
        fetch_photo(p)
    make_overview(products)


if __name__ == "__main__":
    main()
