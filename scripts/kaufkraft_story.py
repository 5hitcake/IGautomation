"""Baut zum zuletzt erzeugten @kaufkraft.check-Post eine Story (1080x1920, JPEG) und
schreibt assets/kaufkraft_generated/next_story.json fuer publish.py (Typ "story").

Aufbau: Markenfarbe als Hintergrund, oben "KAUFKRAFT CHECK" + Hinweis "Neuer Beitrag",
in der Mitte die komplette Feed-Grafik als Karte, unten der Verweis auf den Post.
Alle Texte liegen ausserhalb der Bereiche, die Instagram oben/unten verdeckt.
Link- oder Umfrage-Sticker lassen sich ueber die Instagram-API nicht setzen.
"""
import json
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
GENERATED_DIR = os.path.join(ROOT, "assets", "kaufkraft_generated")
FONTS = os.path.join(ROOT, "assets", "fonts")

W, H = 1080, 1920
CARD_W = 880
CARD_H = round(CARD_W * 1350 / 1080)  # Feed-Format 4:5
CARD_TOP = 400
RADIUS = 34
NAVY = (16, 27, 45)
GOLD = (222, 170, 60)
WHITE = (255, 255, 255)
SOFT = (190, 198, 212)


def _font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Poppins-{weight}.ttf"), size)


def build_story(post_image, kind="product"):
    bg = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(bg)

    # Kopf: Marke + Hinweis
    big = _font("Bold", 64)
    left_w = d.textlength("KAUFKRAFT ", font=big)
    total = left_w + d.textlength("CHECK", font=big)
    x = (W - total) / 2
    d.text((x, 232), "KAUFKRAFT ", font=big, fill=WHITE)
    d.text((x + left_w, 232), "CHECK", font=big, fill=GOLD)
    sub = "Inflation der Woche" if kind == "inflation" else "Neuer Preis-Check"
    d.text((W / 2, 322), sub, font=_font("Regular", 38), fill=SOFT, anchor="ma")

    # Feed-Grafik als Karte mit Schatten
    card = post_image.convert("RGB").resize((CARD_W, CARD_H), Image.LANCZOS)
    left = (W - CARD_W) // 2
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left, CARD_TOP + 16, left + CARD_W, CARD_TOP + CARD_H + 16), RADIUS, fill=170)
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    bg.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow)
    mask = Image.new("L", (CARD_W, CARD_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, CARD_W, CARD_H), RADIUS, fill=255)
    bg.paste(card, (left, CARD_TOP), mask)

    # Fuss: Verweis auf den Post
    y = CARD_TOP + CARD_H + 44
    d.text((W / 2, y), "Mehr dazu im neuen Beitrag", font=_font("SemiBold", 42), fill=WHITE, anchor="ma")
    d.text((W / 2, y + 62), "@kaufkraft.check", font=_font("Regular", 36), fill=GOLD, anchor="ma")
    return bg


def main():
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "r", encoding="utf-8") as f:
        post = json.load(f)
    image_rel = post["file"]
    kind = "inflation" if os.path.basename(image_rel).startswith("inflation_") else "product"
    story = build_story(Image.open(os.path.join(ROOT, image_rel)), kind)
    story_rel = os.path.join(os.path.dirname(image_rel), "story_" + os.path.basename(image_rel))
    story.save(os.path.join(ROOT, story_rel), format="JPEG", quality=90, optimize=True)
    with open(os.path.join(GENERATED_DIR, "next_story.json"), "w", encoding="utf-8") as f:
        json.dump({"type": "story", "file": story_rel.replace("\\", "/")}, f, indent=2)
    print(f"Story gespeichert: {story_rel}")


if __name__ == "__main__":
    main()
