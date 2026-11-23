"""Text-Overlays (Pillow) und Videoschnitt (ffmpeg)."""
import random
from pathlib import Path

from common import CFG, FONTS, duration, random_music, sh
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = CFG["images"]["width"], CFG["images"]["height"]
GOLD = (232, 199, 122, 255)
IVORY = (250, 243, 228, 255)
FPS = 30


def font(name, size, weight=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if weight:
        try:
            f.set_variation_by_axes([weight])
        except Exception:  # noqa: BLE001
            pass
    return f


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def shadow_text(base, xy, text, fnt, fill, anchor="ma", blur=6):
    sh_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh_layer).text((xy[0] + 2, xy[1] + 3), text, font=fnt, fill=(0, 0, 0, 230), anchor=anchor)
    sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh_layer)
    ImageDraw.Draw(base).text(xy, text, font=fnt, fill=fill, anchor=anchor)


def ornament(draw, cx, y, half=150):
    draw.line([(cx - half, y), (cx - 18, y)], fill=GOLD, width=2)
    draw.line([(cx + 18, y), (cx + half, y)], fill=GOLD, width=2)
    draw.polygon([(cx, y - 9), (cx + 9, y), (cx, y + 9), (cx - 9, y)], fill=GOLD)


def verse_overlay(text, ref, path):
    """Transparente PNG mit Abdunklung, Vers und Stellenangabe."""
    # sanfte Abdunklung zur Bildmitte hin für Lesbarkeit
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).rectangle([0, int(H * 0.24), W, int(H * 0.76)], fill=150)
    shade = shade.filter(ImageFilter.GaussianBlur(160))
    img = Image.merge("RGBA", (*Image.new("RGB", (W, H), (12, 8, 4)).split(), shade))

    draw = ImageDraw.Draw(img)
    max_w = W - 170
    size = 76
    while size > 40:
        f = font("CormorantGaramond-Italic.ttf", size, 600)
        lines = wrap(draw, f"„{text}“", f, max_w)
        lh = int(size * 1.22)
        if lh * len(lines) <= H * 0.40:
            break
        size -= 3
    block = lh * len(lines)
    top = int(H * 0.50 - block / 2)
    ornament(draw, W // 2, top - 70)
    for i, line in enumerate(lines):
        shadow_text(img, (W // 2, top + i * lh), line, f, IVORY)
    fr = font("Cinzel.ttf", 40, 600)
    y_ref = top + block + 40
    shadow_text(img, (W // 2, y_ref), ref.upper(), fr, GOLD)
    ornament(ImageDraw.Draw(img), W // 2, y_ref + 85)
    handle = CFG["account"].get("instagram_username", "").strip().lstrip("@")
    if handle:
        fh = font("CormorantGaramond.ttf", 36, 600)
        shadow_text(img, (W // 2, int(H * 0.79)), "@" + handle, fh, (240, 230, 210, 200), blur=4)
    img.save(path)
    return path


def title_overlay(title, ref, path):
    """Obere Leiste für Story-Reels: Titel + Kapitelangabe (bleibt das ganze Video stehen)."""
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).rectangle([0, 0, W, 430], fill=170)
    shade = shade.filter(ImageFilter.GaussianBlur(90))
    img = Image.merge("RGBA", (*Image.new("RGB", (W, H), (10, 6, 2)).split(), shade))
    draw = ImageDraw.Draw(img)
    size = 62
    while size > 38:
        ft = font("Cinzel.ttf", size, 700)
        lines = wrap(draw, title.upper(), ft, W - 140)
        if len(lines) <= 2:
            break
        size -= 4
    y = 170
    for line in lines:
        shadow_text(img, (W // 2, y), line, ft, IVORY)
        y += int(size * 1.15)
    ornament(ImageDraw.Draw(img), W // 2, y + 22, 120)
    fr = font("CormorantGaramond-Italic.ttf", 54, 700)
    shadow_text(img, (W // 2, y + 48), ref, fr, GOLD)
    img.save(path)
    return path


def _zoom_filter(seconds, direction):
    frames = int(seconds * FPS) + 1
    if direction == "in":
        z = "min(1.0+0.12*on/{f},1.12)".format(f=frames)
    else:
        z = "max(1.12-0.12*on/{f},1.0)".format(f=frames)
    pans = ["iw/2-(iw/zoom/2)", "(iw-iw/zoom)*on/{f}".format(f=frames), "(iw-iw/zoom)*(1-on/{f})".format(f=frames)]
    x = random.choice(pans)
    return (f"scale={W*2}:{H*2}:flags=lanczos,"
            f"zoompan=z='{z}':x='{x}':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},"
            f"setsar=1,format=yuv420p")


def ken_burns_clip(image, seconds, out, direction="in"):
    sh(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", str(FPS), "-t", f"{seconds:.3f}",
        "-i", str(image), "-vf", _zoom_filter(seconds, direction), "-t", f"{seconds:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", str(out)])
    return out


def verse_video(bg, overlay, out, seconds):
    tmp = Path(out).with_name("bg.mp4")
    ken_burns_clip(bg, seconds, tmp, "in")
    music = random_music("verse")
    vol = CFG["verse_reel"]["music_volume"]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-loop", "1", "-i", str(overlay)]
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(music)]
        audio = (f"[2:a]volume={vol},afade=t=in:d=1,afade=t=out:st={seconds-1.5}:d=1.5,"
                 f"atrim=0:{seconds}[a]")
    else:
        cmd += ["-f", "lavfi", "-t", str(seconds), "-i", "anullsrc=r=44100:cl=stereo"]
        audio = "[2:a]anull[a]"
    filt = (f"[1:v]format=rgba,fade=t=in:st=0.6:d=1.4:alpha=1[ov];"
            f"[0:v][ov]overlay=0:0:format=auto,fade=t=out:st={seconds-0.8}:d=0.8,format=yuv420p[v];{audio}")
    cmd += ["-filter_complex", filt, "-map", "[v]", "-map", "[a]", "-t", str(seconds),
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
    sh(cmd)
    tmp.unlink(missing_ok=True)
    return out


def _ass_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def write_ass(cues, path):
    """cues: Liste von (start, ende, text). Untertitel mittig-unten, über der Instagram-Leiste."""
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,PoC Serif,82,&H00E4F3FA,&H000000FF,&H00101010,&H96000000,0,0,0,0,100,100,0,0,1,4,2,2,90,90,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},Default,,0,0,0,,{{\\fad(120,80)}}{t}" for a, b, t in cues]
    Path(path).write_text(head + "\n".join(lines) + "\n", encoding="utf-8")
    return path


def chunk_cues(text, start, end, words_per=5):
    words = text.split()
    chunks = [" ".join(words[i:i + words_per]) for i in range(0, len(words), words_per)]
    total = sum(len(c) for c in chunks) or 1
    cues, t = [], start
    for c in chunks:
        d = (end - start) * len(c) / total
        cues.append((t, t + d, c))
        t += d
    return cues


def story_video(scene_clips, narration_wav, title_png, ass, out, music_volume):
    listfile = Path(out).with_name("clips.txt")
    listfile.write_text("".join(f"file '{Path(c).resolve()}'\n" for c in scene_clips))
    joined = Path(out).with_name("joined.mp4")
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listfile),
        "-c", "copy", str(joined)])
    total = duration(narration_wav)
    music = random_music("story")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(joined), "-loop", "1", "-i", str(title_png),
           "-i", str(narration_wav)]
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(music)]
        audio = (f"[3:a]volume={music_volume},atrim=0:{total},afade=t=out:st={max(total-2,0)}:d=2[m];"
                 f"[2:a][m]amix=inputs=2:duration=first:normalize=0[a]")
    else:
        audio = "[2:a]anull[a]"
    fontsdir = str(FONTS).replace(":", r"\:")
    filt = (f"[0:v][1:v]overlay=0:0:format=auto[t];"
            f"[t]subtitles='{ass}':fontsdir='{fontsdir}',fade=t=in:d=0.5,"
            f"fade=t=out:st={total-0.7}:d=0.7,format=yuv420p[v];{audio}")
    cmd += ["-filter_complex", filt, "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
    sh(cmd)
    for p in (listfile, joined):
        p.unlink(missing_ok=True)
    return out


def cover_frame(video, at, out):
    sh(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(at), "-i", str(video), "-frames:v", "1",
        "-q:v", "2", str(out)])
    return out
