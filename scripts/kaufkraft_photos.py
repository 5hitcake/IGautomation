"""Produktbilder fuer @kaufkraft.check: schlicht, eindeutig, immer gleicher Stil.

Jedes Produkt wird einzeln und klar erkennbar gezeigt (Sprit = Zapfsaeule,
Butter = Butter, Doener = Doener), vor hellem cremefarbenem Hintergrund.

Reihenfolge:
  1. Liegt assets/kaufkraft_products/<id>.jpg im Repo, wird es genommen
     (eigene Fotos einfach unter diesem Namen ablegen - die haben immer Vorrang).
  2. Sonst wird ein fotorealistisches Studiobild aus dem Feld "prompt" der
     Produktliste erzeugt (Cloudflare Workers AI, dieselben Secrets wie beim
     People-Account) und gespeichert, damit es geprueft und wiederverwendet wird.

Erzeugte Bilder werden als "Symbolbild (KI-generiert)" gekennzeichnet (Grafik +
Caption), die Herkunft steht in assets/kaufkraft_products/credits.json.

  python kaufkraft_photos.py               (fehlende Bilder erzeugen + Uebersicht)
  python kaufkraft_photos.py --redo butter (Bild fuer ein Produkt neu erzeugen)
"""
import argparse
import io
import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
PHOTOS_DIR = os.path.join(ROOT, "assets", "kaufkraft_products")
CREDITS_FILE = "credits.json"
MAX_SIDE = 1600

STYLE = ("Professional studio product photo of {subject}, simple clean composition, the product "
         "clearly recognizable and centered, plain warm cream background, soft natural light, "
         "gentle shadow, sharp focus, photorealistic, no text, no letters, no logos, no brand names")
AI_CREDIT = {"source": "KI", "label": "Symbolbild (KI-generiert)"}


def load_credits(directory=None):
    path = os.path.join(directory or PHOTOS_DIR, CREDITS_FILE)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_credits(credits, directory=None):
    directory = directory or PHOTOS_DIR
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, CREDITS_FILE), "w", encoding="utf-8") as f:
        json.dump(credits, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def credit_line(credit):
    """Text fuer Grafik/Caption. Eigene Fotos (kein Eintrag) brauchen keinen Hinweis."""
    if not credit:
        return None
    if credit.get("label"):
        return credit["label"]
    return f"Foto: {credit.get('author') or 'unbekannt'} / {credit.get('source', '')}".strip(" /")


def prompt_for(product):
    return STYLE.format(subject=product.get("prompt") or product["name"])


def generate(product):
    """Erzeugt das Bild ueber Cloudflare Workers AI (Fallback-Kette aus people_generate)."""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not account_id or not api_token:
        raise RuntimeError("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN fehlen")
    from people_generate import generate_image

    raw, model = generate_image(prompt_for(product), account_id, api_token)
    return Image.open(io.BytesIO(raw)).convert("RGB"), model


def fetch_photo(product, directory=None, redo=False, generator=None):
    """Pfad zum Produktbild oder None (dann zeichnet die Karte einen Platzhalter)."""
    directory = directory or PHOTOS_DIR
    path = os.path.join(directory, f"{product['id']}.jpg")
    if os.path.exists(path) and not redo:
        return path
    try:
        img, model = (generator or generate)(product)
    except Exception as exc:  # noqa: BLE001 - lieber Platzhalter als gar kein Post
        print(f"Kein Bild fuer {product['id']}: {exc}")
        return path if os.path.exists(path) else None
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    os.makedirs(directory, exist_ok=True)
    img.save(path, "JPEG", quality=88)
    credits = load_credits(directory)
    credits[product["id"]] = {**AI_CREDIT, "model": model}
    save_credits(credits, directory)
    print(f"Bild fuer {product['id']} erzeugt ({model}) -> {path}")
    return path


def make_overview(products, directory=None, cols=6, cell=300):
    """Kontaktbogen aller Bilder mit Produkt-ID, zum schnellen Pruefen."""
    directory = directory or PHOTOS_DIR
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
            draw.text((x + 20, y + cell / 2 - 14), "kein Bild", font=font, fill=(90, 90, 90))
        draw.text((x + 10, y + cell + 6), pid, font=font, fill=(16, 27, 45))
    out = os.path.join(directory, "_uebersicht.jpg")
    sheet.save(out, "JPEG", quality=85)
    print(f"Uebersicht: {out}")
    return out


def main():
    import kaufkraft_data as kd

    parser = argparse.ArgumentParser()
    parser.add_argument("--redo", help="Produkt-IDs (kommagetrennt), deren Bild neu erzeugt wird")
    args = parser.parse_args()
    products = kd.load_products()
    if args.redo:
        ids = set(args.redo.split(","))
        for p in products:
            if p["id"] in ids:
                fetch_photo(p, redo=True)
    else:
        missing = [p for p in products if not os.path.exists(os.path.join(PHOTOS_DIR, f"{p['id']}.jpg"))]
        print(f"{len(missing)} Produkte ohne Bild")
        for p in missing:
            fetch_photo(p)
    make_overview(products)


if __name__ == "__main__":
    main()
