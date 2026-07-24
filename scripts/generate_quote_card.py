"""Rendert ein Zitat-Bild (1080x1350) aus einem Hintergrundbild + Text und schreibt
assets/generated/next_post.json mit Pfad + Caption fuer publish.py."""
import json
import os

from common import (
    FONTS_DIR,
    GENERATED_DIR,
    ROOT,
    build_caption,
    load_state,
    pick_background,
    pick_next_quote,
    save_state,
)
from PIL import Image, ImageDraw, ImageFont

CANVAS_SIZE = (1080, 1350)
OVERLAY_OPACITY = 90  # 0-255
MAX_TEXT_WIDTH_RATIO = 0.82
HANDLE = "@mindset_und.motivation"


def cover_resize(image, size):
    src_ratio = image.width / image.height
    dst_ratio = size[0] / size[1]
    if src_ratio > dst_ratio:
        new_height = size[1]
        new_width = int(new_height * src_ratio)
    else:
        new_width = size[0]
        new_height = int(new_width / src_ratio)
    image = image.resize((new_width, new_height), Image.LANCZOS)
    left = (new_width - size[0]) // 2
    top = (new_height - size[1]) // 2
    return image.crop((left, top, left + size[0], top + size[1]))


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def fit_font_and_lines(draw, text, max_width, max_height):
    size = 88
    min_size = 40
    while size >= min_size:
        font = ImageFont.truetype(os.path.join(FONTS_DIR, "Poppins-Bold.ttf"), size)
        lines = wrap_text(draw, text, font, max_width)
        line_height = int(size * 1.3)
        total_height = line_height * len(lines)
        if total_height <= max_height:
            return font, lines, line_height
        size -= 4
    font = ImageFont.truetype(os.path.join(FONTS_DIR, "Poppins-Bold.ttf"), min_size)
    lines = wrap_text(draw, text, font, max_width)
    line_height = int(min_size * 1.3)
    return font, lines, line_height


def render(quote_text, background_path, output_path):
    bg = Image.open(background_path).convert("RGB")
    bg = cover_resize(bg, CANVAS_SIZE)

    overlay = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, OVERLAY_OPACITY))
    base = Image.alpha_composite(bg.convert("RGBA"), overlay)

    draw = ImageDraw.Draw(base)
    max_width = int(CANVAS_SIZE[0] * MAX_TEXT_WIDTH_RATIO)
    max_height = int(CANVAS_SIZE[1] * 0.55)
    font, lines, line_height = fit_font_and_lines(draw, quote_text, max_width, max_height)

    total_text_height = line_height * len(lines)
    y = (CANVAS_SIZE[1] - total_text_height) // 2

    for line in lines:
        line_width = draw.textlength(line, font=font)
        x = (CANVAS_SIZE[0] - line_width) // 2
        draw.text((x + 2, y + 2), line, font=font, fill=(0, 0, 0, 160))
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_height

    handle_font = ImageFont.truetype(os.path.join(FONTS_DIR, "Poppins-Regular.ttf"), 30)
    handle_width = draw.textlength(HANDLE, font=handle_font)
    draw.text(
        ((CANVAS_SIZE[0] - handle_width) // 2, CANVAS_SIZE[1] - 80),
        HANDLE,
        font=handle_font,
        fill=(255, 255, 255, 200),
    )

    base.convert("RGB").save(output_path, "JPEG", quality=92)


def main():
    os.makedirs(GENERATED_DIR, exist_ok=True)
    state = load_state()
    quote = pick_next_quote(state)
    background_path = pick_background(state)

    filename = f"quote_{quote['id']:04d}.jpg"
    output_path = os.path.join(GENERATED_DIR, filename)
    render(quote["text"], background_path, output_path)

    caption = build_caption(quote["text"], quote["category"])
    next_post = {
        "type": "image",
        "file": os.path.relpath(output_path, ROOT).replace("\\", "/"),
        "caption": caption,
    }
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(next_post, f, ensure_ascii=False, indent=2)

    save_state(state)
    print(f"Erstellt: {output_path}")
    print(caption)


if __name__ == "__main__":
    main()
