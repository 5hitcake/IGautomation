"""Baut das Profilbild (geteiltes Gesicht + Schriftring) fuer den These-people-do-not-exist-Account."""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "..", "fonts", "Poppins-Bold.ttf")
S = 1080            # Ausgabegroesse
INNER_R = 430       # Radius des Fotos
RING_C = (24, 28, 38)  # Ringfarbe
TEXT_C = (255, 255, 255)
TEXT = "THESE PEOPLE DO NOT EXIST  •  THESE PEOPLE DO NOT EXIST  •  "

# Gesichter: (datei, linkes auge xy, rechtes auge xy)
faces = {
    "woman": ("woman.webp", (410, 465), (625, 465)),
    "man": ("man.webp", (380, 443), (660, 443)),
}
TARGET_EYE_DIST = 300   # Augenabstand im Endbild (innerhalb des Foto-Kreises)
CENTER = (S // 2, S // 2 - 40)  # Augen-Mittelpunkt im Endbild


def aligned(name):
    f, (lx, ly), (rx, ry) = faces[name]
    img = Image.open(os.path.join(HERE, f)).convert("RGB")
    scale = TARGET_EYE_DIST / (rx - lx)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    mx, my = (lx + rx) / 2 * scale, (ly + ry) / 2 * scale
    canvas = Image.new("RGB", (S, S), (236, 200, 176))
    canvas.paste(img, (round(CENTER[0] - mx), round(CENTER[1] - my)))
    return canvas


def compose(order_and_splits):
    """order_and_splits: [(name, x_start, x_end), ...] in Endbild-Koordinaten"""
    out = Image.new("RGB", (S, S))
    for name, x0, x1 in order_and_splits:
        src = aligned(name)
        out.paste(src.crop((x0, 0, x1, S)), (x0, 0))
    # feine helle Trennlinien
    d = ImageDraw.Draw(out)
    for _, x0, _ in order_and_splits[1:]:
        d.line([(x0, 0), (x0, S)], fill=(255, 255, 255), width=4)
    return out


def ring(photo, text=TEXT, ring_color=RING_C, text_color=TEXT_C, size=46):
    base = Image.new("RGB", (S, S), ring_color)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse((S/2-INNER_R, S/2-INNER_R, S/2+INNER_R, S/2+INNER_R), fill=255)
    base.paste(photo, (0, 0), mask)
    font = ImageFont.truetype(FONT, size)
    text_r = (INNER_R + S / 2) / 2 + 2  # Mitte des Rings, IG schneidet bei S/2 rund ab
    total = sum(font.getlength(c) for c in text)
    circumference = 2 * math.pi * text_r
    spacing = (circumference - total) / len(text)
    angle = -math.pi / 2  # oben starten
    for ch in text:
        w = font.getlength(ch)
        a = angle + (w / 2) / text_r
        layer = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((size, size), ch, font=font, fill=text_color, anchor="mm")
        layer = layer.rotate(-math.degrees(a + math.pi / 2), resample=Image.BICUBIC)
        x = S / 2 + text_r * math.cos(a) - size
        y = S / 2 + text_r * math.sin(a) - size
        base.paste(layer, (round(x), round(y)), layer)
        angle += (w + spacing) / text_r
    return base


def preview_circle(img):
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse((0, 0, S, S), fill=255)
    bg = Image.new("RGB", (S, S), (255, 255, 255))
    bg.paste(img, (0, 0), m)
    return bg


if __name__ == "__main__":
    split = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    photo = compose([("man", 0, split), ("woman", split, S)])
    final = ring(photo)
    final.save("draft_a.png")
    preview_circle(final).save("draft_a_preview.png")
    # Mini-Vorschau in Originalgroesse auf Instagram (~110px)
    preview_circle(final).resize((110, 110), Image.LANCZOS).save("draft_a_small.png")
