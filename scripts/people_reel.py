"""Macht aus dem freigegebenen Portrait ein Reel (1080x1920, 30 fps, ~9 s, H.264/AAC)
und stellt next_post.json auf Typ "reel" um.

Ablauf des Clips:
  0.0-1.5 s  Nahaufnahme der Augen, langsamer Zoom heraus  "Look closely."
  1.5-4.0 s  Zoom aufs ganze Gesicht                        "Do you know this person?"
  4.0-4.4 s  Glitch: weisser Blitz, RGB-Versatz, Streifen
  4.4-7.0 s  Gesicht steht, leichtes Flackern               "Nobody does." -> "THIS PERSON DOES NOT EXIST"
  7.0-9.0 s  Gesicht zerfaellt in Pixel, wird dunkel        "No. 0012 · Name, Alter" + Doppelgaenger-Aufruf

Musik: der eigene Song aus assets/people_music/theme.* (falls vorhanden), mit
Ein- und Ausblendung. Ohne Song wird das Reel stumm erzeugt.

Das Video wird NICHT in main committet (Repo-Groesse), sondern vom Workflow auf den
Branch "people-media" gelegt; next_post.json zeigt per "branch" dorthin.
"""
import argparse
import glob
import json
import math
import os
import random
import subprocess

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
GENERATED_DIR = os.path.join(ROOT, "assets", "people_generated")
GENERATED_REL = "assets/people_generated"
MUSIC_DIR = os.path.join(ROOT, "assets", "people_music")
FONTS = os.path.join(ROOT, "assets", "fonts")
MEDIA_BRANCH = "people-media"

W, H = 1080, 1920
FPS = 30
DURATION = 9.0
TEXT_Y = 1390  # unter dem Kinn, oberhalb der Caption-Zone der Reels
GLITCH_START, GLITCH_END = 4.0, 4.4
DISSOLVE_START = 7.0
THUMB_OFFSET_MS = 6300  # Titelbild: Gesicht + "THIS PERSON DOES NOT EXIST"


def _font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Poppins-{weight}.ttf"), size)


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def cover_base(portrait):
    """Portrait (4:5) auf 9:16 bringen: mittig zuschneiden, etwas Reserve fuer den Zoom."""
    portrait = portrait.convert("RGB")
    target_ratio = W / H
    w, h = portrait.size
    new_w = round(h * target_ratio)
    left = (w - new_w) // 2
    crop = portrait.crop((left, 0, left + new_w, h))
    return crop.resize((W * 2, H * 2), Image.LANCZOS)  # hohe Aufloesung fuer scharfe Zooms


def zoom_frame(base, zoom, focus_y=0.36):
    """Ausschnitt mit Zoomfaktor zoom (1 = ganzes Bild), zentriert um die Augenhoehe."""
    bw, bh = base.size
    cw, ch = bw / zoom, bh / zoom
    cx = bw / 2
    cy = min(max(bh * focus_y, ch / 2), bh - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return base.resize((W, H), Image.BILINEAR, box=box)


_GRADIENT = None


def bottom_gradient(frame):
    """Dunkler Verlauf ab ca. 55 % Hoehe, damit die Texte auf jedem Gesicht lesbar sind."""
    global _GRADIENT
    if _GRADIENT is None:
        mask = Image.new("L", (1, H))
        for y in range(H):
            k = max(0.0, (y - H * 0.55) / (H * 0.45))
            mask.putpixel((0, y), int(170 * k ** 1.3))
        _GRADIENT = mask.resize((W, H))
    return Image.composite(Image.new("RGB", (W, H)), frame, _GRADIENT)


def glitch(frame, strength, rng):
    r, g, b = frame.split()
    dx = int(28 * strength)
    r = ImageChops.offset(r, dx, 0)
    b = ImageChops.offset(b, -dx, int(6 * strength))
    out = Image.merge("RGB", (r, g, b))
    for _ in range(int(9 * strength)):
        y = rng.randrange(0, H - 80)
        hgt = rng.randrange(12, 80)
        strip = out.crop((0, y, W, y + hgt))
        out.paste(ImageChops.offset(strip, rng.randrange(-90, 90), 0), (0, y))
    return out


def pixelate(frame, block):
    if block <= 1:
        return frame
    small = frame.resize((max(1, W // block), max(1, H // block)), Image.BILINEAR)
    return small.resize((W, H), Image.NEAREST)


def draw_text(frame, lines, alpha=1.0):
    """lines: [(text, font, color)] zentriert ab TEXT_Y, mit Schatten fuer Lesbarkeit."""
    if alpha <= 0:
        return frame
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    y = TEXT_Y
    a = int(255 * alpha)
    for text, font, color in lines:
        for ox, oy in ((0, 4), (3, 3), (-3, 3)):
            d.text((W / 2 + ox, y + oy), text, font=font, fill=(0, 0, 0, int(a * 0.55)), anchor="ma")
        d.text((W / 2, y), text, font=font, fill=color + (a,), anchor="ma")
        y += font.size + 22
    frame = frame.convert("RGBA")
    frame.alpha_composite(layer)
    return frame.convert("RGB")


def _fade(t, start, end, fade=0.25):
    if t < start or t > end:
        return 0.0
    return min(1.0, (t - start) / fade, (end - t) / fade)


def render_frame(base, t, number, name, age, rng):
    white, pink = (255, 255, 255), (255, 92, 120)
    if t < 1.5:
        frame = zoom_frame(base, 2.6 - 1.0 * ease(t / 1.5))
    elif t < GLITCH_START:
        frame = zoom_frame(base, 1.6 - 0.6 * ease((t - 1.5) / 2.5))
    else:
        frame = zoom_frame(base, 1.0 + 0.04 * (t - GLITCH_START) / (DURATION - GLITCH_START))

    if GLITCH_START <= t < GLITCH_END:
        k = (t - GLITCH_START) / (GLITCH_END - GLITCH_START)
        frame = glitch(frame, 1.0 - 0.6 * k, rng)
        if t < GLITCH_START + 0.07:
            frame = Image.blend(frame, Image.new("RGB", (W, H), white), 0.85)
    elif GLITCH_END <= t < DISSOLVE_START and rng.random() < 0.06:
        frame = glitch(frame, 0.25, rng)  # gelegentliches Flackern

    if t >= DISSOLVE_START:
        k = (t - DISSOLVE_START) / (DURATION - DISSOLVE_START)
        frame = pixelate(frame, int(1 + 70 * ease(k)))
        frame = ImageEnhance.Brightness(frame).enhance(1.0 - 0.75 * ease(k))
    else:
        frame = ImageEnhance.Brightness(frame).enhance(0.95)
    frame = bottom_gradient(frame)

    big, mid, small = _font("Bold", 74), _font("SemiBold", 56), _font("Regular", 40)
    frame = draw_text(frame, [("Look closely.", big, white)], _fade(t, 0.2, 1.5))
    frame = draw_text(frame, [("Do you know", big, white), ("this person?", big, white)], _fade(t, 1.6, 3.95))
    frame = draw_text(frame, [("Nobody does.", big, white)], _fade(t, 4.5, 5.6))
    frame = draw_text(frame, [("THIS PERSON", big, white), ("DOES NOT EXIST", big, pink)],
                      _fade(t, 5.7, 7.2, 0.15))
    frame = draw_text(frame, [(f"No. {number:04d}  ·  {name}, {age}", mid, white),
                              ("Know their real-life doppelgänger?", small, white),
                              ("Tag them in the comments", small, white)], _fade(t, 7.3, DURATION + 1))
    return frame


def find_theme():
    files = sorted(glob.glob(os.path.join(MUSIC_DIR, "theme.*")))
    return files[0] if files else None


def render_reel(portrait, number, name, age, out_path, music=None, seed=0):
    base = cover_base(portrait)
    rng = random.Random(seed)
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if music:
        fade_out = DURATION - 1.2
        cmd += ["-i", music, "-map", "0:v", "-map", "1:a",
                "-af", f"afade=t=in:d=0.4,afade=t=out:st={fade_out}:d=1.2", "-c:a", "aac", "-b:a", "160k"]
    cmd += ["-t", str(DURATION), "-c:v", "libx264", "-preset", "medium", "-crf", "22",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(DURATION * FPS)):
        frame = render_frame(base, i / FPS, number, name, age, rng)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg fehlgeschlagen")
    return out_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--post-file", default=os.path.join(GENERATED_DIR, "next_post.json"))
    args = parser.parse_args()
    with open(args.post_file, "r", encoding="utf-8") as f:
        post = json.load(f)
    image_rel = post.get("image", post["file"])
    portrait = Image.open(os.path.join(ROOT, image_rel))
    filename = os.path.basename(image_rel).replace("person_", "reel_", 1).rsplit(".", 1)[0] + ".mp4"
    out_path = os.path.join(GENERATED_DIR, filename)
    music = find_theme()
    print(f"Rendere Reel {filename} (Musik: {os.path.basename(music) if music else 'keine'})")
    render_reel(portrait, post["number"], post["name"], post["age"], out_path, music, seed=post["number"])
    post.update({
        "type": "reel",
        "image": image_rel,
        "file": filename,  # liegt auf dem Medien-Branch im Wurzelverzeichnis
        "branch": MEDIA_BRANCH,
        "thumb_offset": THUMB_OFFSET_MS,
    })
    with open(args.post_file, "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=2)
    print(f"Reel fertig: {out_path}")


if __name__ == "__main__":
    main()
