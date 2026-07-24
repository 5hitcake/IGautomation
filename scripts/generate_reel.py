"""Rendert ein Reel (1080x1920) aus einem Hintergrund-Clip + Text-Overlay,
optional mit Hintergrundmusik aus assets/music, und schreibt
assets/generated/next_post.json fuer publish.py. Benoetigt ffmpeg."""
import json
import os
import shutil
import subprocess

from common import (
    FONTS_DIR,
    GENERATED_DIR,
    ROOT,
    build_caption,
    load_state,
    pick_music,
    pick_next_reel,
    save_state,
)
from PIL import Image, ImageDraw, ImageFont

CANVAS_SIZE = (1080, 1920)
HANDLE = "@mindset_und.motivation"
MUSIC_VOLUME = 0.25  # 0-1, gedaempft damit es nicht aufdringlich wirkt


def check_ffmpeg():
    if not shutil.which("ffmpeg"):
        raise SystemExit(
            "ffmpeg wurde nicht gefunden. Lokal installieren z.B. via "
            "'winget install Gyan.FFmpeg' (danach Terminal neu starten). "
            "Auf GitHub Actions wird es im weekly_reel.yml Workflow automatisch installiert."
        )


def reading_duration(text):
    words = len(text.split())
    return max(5.0, min(12.0, words / 2.0 + 2.0))


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


def build_overlay_png(text, output_path):
    img = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    max_width = int(CANVAS_SIZE[0] * 0.85)
    font = ImageFont.truetype(os.path.join(FONTS_DIR, "Poppins-Bold.ttf"), 70)
    lines = wrap_text(draw, text, font, max_width)
    line_height = 95
    total_height = line_height * len(lines)

    box_padding = 60
    box_top = (CANVAS_SIZE[1] - total_height) // 2 - box_padding
    box_bottom = (CANVAS_SIZE[1] + total_height) // 2 + box_padding
    draw.rectangle([(0, box_top), (CANVAS_SIZE[0], box_bottom)], fill=(0, 0, 0, 120))

    y = (CANVAS_SIZE[1] - total_height) // 2
    for line in lines:
        line_width = draw.textlength(line, font=font)
        x = (CANVAS_SIZE[0] - line_width) // 2
        draw.text((x + 2, y + 2), line, font=font, fill=(0, 0, 0, 180))
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_height

    handle_font = ImageFont.truetype(os.path.join(FONTS_DIR, "Poppins-Regular.ttf"), 34)
    handle_width = draw.textlength(HANDLE, font=handle_font)
    draw.text(
        ((CANVAS_SIZE[0] - handle_width) // 2, CANVAS_SIZE[1] - 120),
        HANDLE,
        font=handle_font,
        fill=(255, 255, 255, 220),
    )

    img.save(output_path, "PNG")


def render_video(bg_video_path, overlay_path, music_path, output_path, duration):
    base_cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", bg_video_path, "-i", overlay_path]
    video_filter = (
        f"[0:v]scale={CANVAS_SIZE[0]}:{CANVAS_SIZE[1]}:force_original_aspect_ratio=increase,"
        f"crop={CANVAS_SIZE[0]}:{CANVAS_SIZE[1]}[bgv];[bgv][1:v]overlay=0:0[v]"
    )

    if music_path:
        cmd = base_cmd + ["-stream_loop", "-1", "-i", music_path]
        filter_complex = f"{video_filter};[2:a]volume={MUSIC_VOLUME}[a]"
        cmd += [
            "-filter_complex", filter_complex,
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-t", str(duration),
            output_path,
        ]
    else:
        cmd = base_cmd + [
            "-filter_complex", video_filter,
            "-map", "[v]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-t", str(duration),
            output_path,
        ]
    subprocess.run(cmd, check=True)


def main():
    check_ffmpeg()
    os.makedirs(GENERATED_DIR, exist_ok=True)
    state = load_state()
    reel, bg_video_path = pick_next_reel(state)
    music_path = pick_music()
    duration = reading_duration(reel["text"])

    overlay_path = os.path.join(GENERATED_DIR, f"reel_{reel['id']:04d}_overlay.png")
    build_overlay_png(reel["text"], overlay_path)

    output_path = os.path.join(GENERATED_DIR, f"reel_{reel['id']:04d}.mp4")
    render_video(bg_video_path, overlay_path, music_path, output_path, duration)

    caption = build_caption(reel["text"], reel["category"])
    next_post = {
        "type": "reel",
        "file": os.path.relpath(output_path, ROOT).replace("\\", "/"),
        "caption": caption,
    }
    with open(os.path.join(GENERATED_DIR, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(next_post, f, ensure_ascii=False, indent=2)

    save_state(state)
    print(f"Erstellt: {output_path} (Musik: {'ja' if music_path else 'nein'})")
    print(caption)


if __name__ == "__main__":
    main()
