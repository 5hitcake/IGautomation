"""Baut zur zuletzt geposteten Person eine Story (1080x1920, JPEG) und schreibt
assets/people_generated/next_story.json fuer publish.py (Typ "story").

Aufbau: unscharfer, abgedunkelter Hintergrund aus dem Portrait, darauf das
Portrait als Karte mit runden Ecken, oben "THIS PERSON DOES NOT EXIST", unten
Nummer, Name, Alter und ein Hinweis auf den Doppelgaenger-Post. Alle Texte liegen
ausserhalb der Bereiche, die Instagram oben/unten mit Bedienelementen verdeckt.

Musik, Link- oder Umfrage-Sticker lassen sich ueber die Instagram-API nicht setzen.
"""
import json
import os

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
GENERATED_DIR = os.path.join(ROOT, "assets", "people_generated")
GENERATED_REL = "assets/people_generated"
FONTS = os.path.join(ROOT, "assets", "fonts")

W, H = 1080, 1920
CARD_W, CARD_H = 840, 1050
CARD_TOP = 430
RADIUS = 36


def _font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Poppins-{weight}.ttf"), size)


def _cover(img, size):
    w, h = size
    scale = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))


def _center_text(draw, y, text, font, fill=(255, 255, 255), spacing=0):
    x = W / 2
    if spacing:
        total = sum(font.getlength(c) for c in text) + spacing * (len(text) - 1)
        x0 = x - total / 2
        for c in text:
            draw.text((x0, y), c, font=font, fill=fill)
            x0 += font.getlength(c) + spacing
    else:
        draw.text((x, y), text, font=font, fill=fill, anchor="ma")


def build_story(portrait, number, name, age):
    portrait = portrait.convert("RGB")
    bg = _cover(portrait, (W, H)).filter(ImageFilter.GaussianBlur(45))
    bg = ImageEnhance.Brightness(bg).enhance(0.45)

    card = _cover(portrait, (CARD_W, CARD_H))
    mask = Image.new("L", (CARD_W, CARD_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, CARD_W, CARD_H), RADIUS, fill=255)
    left = (W - CARD_W) // 2

    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left, CARD_TOP + 18, left + CARD_W, CARD_TOP + CARD_H + 18), RADIUS, fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    bg.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow)
    bg.paste(card, (left, CARD_TOP), mask)

    d = ImageDraw.Draw(bg)
    _center_text(d, 268, "THIS PERSON", _font("Bold", 58), spacing=6)
    _center_text(d, 338, "DOES NOT EXIST", _font("Bold", 58), fill=(255, 92, 120), spacing=6)
    y = CARD_TOP + CARD_H + 40
    _center_text(d, y, f"No. {number:04d}  ·  {name}, {age}", _font("SemiBold", 44))
    _center_text(d, y + 72, "Know their real-life doppelgänger?", _font("Regular", 36), fill=(225, 225, 225))
    _center_text(d, y + 120, "Tag them on our latest post", _font("Regular", 36), fill=(225, 225, 225))
    return bg


def main():
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "r", encoding="utf-8") as f:
        post = json.load(f)
    image_rel = post.get("image", post["file"])  # bei Reels liegt das Portrait unter "image"
    portrait = Image.open(os.path.join(ROOT, image_rel))
    story = build_story(portrait, post["number"], post["name"], post["age"])
    filename = os.path.basename(image_rel).replace("person_", "story_", 1)
    story.save(os.path.join(GENERATED_DIR, filename), format="JPEG", quality=90, optimize=True)
    with open(os.path.join(GENERATED_DIR, "next_story.json"), "w", encoding="utf-8") as f:
        json.dump({"type": "story", "file": f"{GENERATED_REL}/{filename}"}, f, indent=2)
    print(f"Story gespeichert: {GENERATED_REL}/{filename}")


if __name__ == "__main__":
    main()
