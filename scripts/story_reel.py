"""Story-Reels fuer die beiden Themen-Accounts (wahre Gruselgeschichten / Raetsel &
Verschwoerungen mit wahrem Kern).

Pro Lauf:
  1. Naechste noch nicht gepostete Story aus content/story_reels/<account>.json waehlen
     (Gedaechtnis: story_reels_posted_log.json; sind alle durch, beginnt der Zyklus neu).
  2. Pro Story 2-3 Hintergrundbilder ueber Cloudflare Workers AI erzeugen (kostenlos,
     dieselben Secrets wie beim People-Account). Ohne Zugang / bei Ausfall: dunkler
     Verlauf als Ersatz, damit trotzdem gepostet werden kann.
  3. Reel rendern (1080x1920, 30 fps, H.264/AAC):
       Hook-Folie ("Wusstest du...?" + packender Satz) -> 3-4 Story-Folien -> Folge-Aufruf.
     Langsamer Zoom auf den Bildern, Ueberblendungen, fette Schrift mit Kontur,
     *Woerter in Sternchen* werden in der Akzentfarbe hervorgehoben.
     Die Anzeigedauer jeder Folie richtet sich nach der Textlaenge (Lesezeit).
  4. Musik: zufaelliger Track aus assets/story_music/<account>/ - ist der Ordner leer,
     wird ein passender dunkler Ambient-Klangteppich per ffmpeg synthetisiert
     (komplett lizenzfrei). Optional Sprecherstimme per edge-tts ("voiceover": true).
  5. next_post.json fuer publish.py schreiben. Das Video selbst liegt nicht in main,
     sondern wird vom Workflow auf den Branch story-media-<account> gelegt.

Nutzung:
  python scripts/story_reel.py --account horror              (naechste Story)
  python scripts/story_reel.py --account mysteries --story wow_signal
  python scripts/story_reel.py --account horror --dry-run    (ohne API-Aufrufe, fuer CI)
  python scripts/story_reel.py --account horror --story dyatlov --preview
                                                    (nur rendern, Log/next_post unveraendert)
"""
import argparse
import asyncio
import base64
import glob
import io
import json
import math
import os
import random
import re
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone

import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
CONTENT_DIR = os.path.join(ROOT, "content", "story_reels")
STATE_PATH = os.path.join(ROOT, "story_reels_posted_log.json")
OUT_ROOT = os.path.join(ROOT, "assets", "story_reels")
MUSIC_ROOT = os.path.join(ROOT, "assets", "story_music")
FONTS = os.path.join(ROOT, "assets", "fonts")
ACCOUNTS = ("horror", "mysteries")

W, H = 1080, 1920
FPS = 30
TEXT_MAX_W = 900
TEXT_CENTER_Y = 860  # etwas oberhalb der Mitte: unten liegen Caption + Buttons von Instagram
FADE = 0.35
XFADE = 0.6  # Ueberblendung zwischen zwei Bildern
CTA_SECONDS = 3.2
MUSIC_VOLUME = 0.55
MUSIC_VOLUME_UNDER_VOICE = 0.16
THUMB_OFFSET_MS = 1500  # Titelbild: Hook-Folie
STATE_HISTORY_LIMIT = 200

# Bildmodelle (Cloudflare Workers AI, kostenloses Tageskontingent 10.000 Neurons,
# geteilt mit dem People-Account): FLUX-2 Klein 4B ~250 Neurons/Bild -> 6 Bilder/Tag ~1.500.
MODEL_CHAIN = [
    "@cf/black-forest-labs/flux-2-klein-4b",
    "@cf/black-forest-labs/flux-1-schnell",
]
GEN_W, GEN_H = 768, 1360  # 9:16, Vielfache von 16

WORDS_PER_SECOND = 2.7  # angenehme Lesegeschwindigkeit auf dem Handy


# --------------------------------------------------------------------------- Inhalte


def load_account(account):
    with open(os.path.join(CONTENT_DIR, f"{account}.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    ids = [s["id"] for s in data["stories"]]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{account}.json enthaelt doppelte Story-IDs")
    return data["account"], data["stories"]


def load_state(path=STATE_PATH):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state, path=STATE_PATH):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")


def pick_story(stories, account_state, rng=random, story_id=None):
    """Naechste ungepostete Story (in Dateireihenfolge, damit neue Eintraege am Ende
    planbar nachkommen). Sind alle durch, beginnt der Zyklus von vorn - die zuletzt
    geposteten werden dabei ans Ende geschoben."""
    if story_id:
        for s in stories:
            if s["id"] == story_id:
                return s
        raise SystemExit(f"Story '{story_id}' nicht gefunden")
    posted = account_state.get("posted", [])
    unused = [s for s in stories if s["id"] not in posted]
    if unused:
        return unused[0]
    # Neuer Zyklus: die am laengsten nicht gepostete Story zuerst.
    order = {sid: i for i, sid in enumerate(posted)}
    return min(stories, key=lambda s: order.get(s["id"], -1))


def strip_marks(text):
    return text.replace("*", "")


def build_caption(account_cfg, story, rng=random):
    tags = list(dict.fromkeys(story.get("tags", []) + account_cfg["hashtags"]))[:15]
    teaser = strip_marks(story["slides"][0])
    return (
        f"{strip_marks(story['hook'])}\n\n"
        f"{teaser}\n\n"
        f"{rng.choice(account_cfg['caption_cta'])}\n"
        f"Folge {account_cfg['handle']} für mehr.\n\n"
        f"{' '.join(tags)}"
    )


def reading_seconds(text):
    words = len(strip_marks(text).split())
    return max(3.0, min(8.5, 1.3 + words / WORDS_PER_SECOND))


def build_segments(account_cfg, story, rng=random):
    """Folien: (art, text, bild_index, kicker). Bilder werden gleichmaessig verteilt."""
    n_img = max(1, len(story.get("images", [])))
    kicker = story.get("kicker") or rng.choice(account_cfg["kickers"])
    segs = [{"kind": "hook", "text": story["hook"], "kicker": kicker}]
    for text in story["slides"]:
        segs.append({"kind": "slide", "text": text})
    cta_lines = [line.format(handle=account_cfg["handle"]) for line in account_cfg["cta"]]
    segs.append({"kind": "cta", "text": "\n".join(cta_lines)})
    body = len(segs) - 1
    for i, seg in enumerate(segs):
        if seg["kind"] == "cta":
            seg["image"] = 0  # zurueck zum Titelbild -> sauberer Loop
        else:
            seg["image"] = min(n_img - 1, i * n_img // body)
        seg["duration"] = CTA_SECONDS if seg["kind"] == "cta" else reading_seconds(seg["text"])
    segs[0]["duration"] = max(segs[0]["duration"], 3.5)
    return segs


# --------------------------------------------------------------------------- Bilder


def _decode_image(resp):
    if resp.headers.get("content-type", "").startswith("image/"):
        return resp.content
    data = resp.json()
    img = (data.get("result") or {}).get("image")
    if not img:
        raise RuntimeError(f"Cloudflare-Antwort ohne Bild: {str(data)[:300]}")
    return base64.b64decode(img)


def generate_cloudflare(model, prompt, account_id, api_token, retries=3, seed=None):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
    headers = {"Authorization": f"Bearer {api_token}"}
    for attempt in range(retries):
        if "flux-2" in model:
            form = {"prompt": prompt, "width": str(GEN_W), "height": str(GEN_H)}
            if seed is not None:
                form["seed"] = str(seed)
            resp = requests.post(url, headers=headers, files={k: (None, v) for k, v in form.items()},
                                 timeout=180)
        else:
            payload = {"prompt": prompt, "steps": 8}
            if seed is not None:
                payload["seed"] = seed
            resp = requests.post(url, headers=headers, json=payload, timeout=180)
        if resp.ok:
            return _decode_image(resp)
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
            time.sleep(10 * (attempt + 1))
            continue
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    raise RuntimeError("unerreichbar")


def generate_image(prompt, account_id, api_token, seed=None):
    errors = []
    for model in MODEL_CHAIN:
        try:
            raw = generate_cloudflare(model, prompt, account_id, api_token, seed=seed)
            return Image.open(io.BytesIO(raw)).convert("RGB"), model
        except Exception as exc:  # noqa: BLE001 - naechstes Modell probieren
            print(f"  {model} fehlgeschlagen: {exc}")
            errors.append(str(exc))
            if "daily free allocation" in str(exc):
                break
    raise RuntimeError("Alle Bildmodelle fehlgeschlagen: " + " | ".join(errors))


def fallback_background(accent, seed):
    """Dunkler, leicht verrauschter Verlauf mit Akzent-Schimmer (wenn keine KI-Bilder)."""
    rng = random.Random(seed)
    small = Image.new("RGB", (54, 96))
    px = small.load()
    cx, cy = rng.uniform(0.3, 0.7), rng.uniform(0.25, 0.55)
    for y in range(96):
        for x in range(54):
            d = math.hypot(x / 54 - cx, (y / 96 - cy) * 1.6)
            k = max(0.0, 1.0 - d * 1.6)
            n = rng.uniform(-6, 6)
            px[x, y] = tuple(int(max(0, min(255, 10 + c * 0.35 * k + n))) for c in accent)
    return small.resize((GEN_W, GEN_H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(8))


def color_grade(img, grade):
    img = ImageEnhance.Contrast(img).enhance(1.08)
    if grade == "cold":
        img = ImageEnhance.Color(img).enhance(0.55)
        tint = Image.new("RGB", img.size, (20, 40, 70))
    else:
        img = ImageEnhance.Color(img).enhance(0.95)
        tint = Image.new("RGB", img.size, (70, 45, 15))
    img = Image.blend(img, tint, 0.12)
    return ImageEnhance.Brightness(img).enhance(0.82)


def prepare_base(img, grade):
    """Auf 9:16 zuschneiden, Farblook anwenden, mit Reserve fuer den Zoom skalieren."""
    img = img.convert("RGB")
    w, h = img.size
    ratio = W / H
    if w / h > ratio:
        nw = round(h * ratio)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    elif w / h < ratio:
        nh = round(w / ratio)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    img = img.resize((int(W * 1.25), int(H * 1.25)), Image.LANCZOS)
    return color_grade(img, grade)


def get_images(account, account_cfg, story, out_dir, dry_run, seed):
    """Laedt/erzeugt die Hintergrundbilder einer Story (Cache in out_dir)."""
    prompts = story.get("images") or [story["hook"]]
    creds = (os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(),
             os.environ.get("CLOUDFLARE_API_TOKEN", "").strip())
    images, sources = [], []
    for i, prompt in enumerate(prompts):
        cache = os.path.join(out_dir, f"img_{story['id']}_{i}.jpg")
        if os.path.exists(cache):
            images.append(Image.open(cache).convert("RGB"))
            sources.append("cache")
            continue
        img, source = None, "fallback"
        if not dry_run and all(creds):
            full = f"{prompt}, {account_cfg['image_style']}"
            try:
                img, source = generate_image(full, *creds, seed=seed + i)
                img.save(cache, quality=92)
            except Exception as exc:  # noqa: BLE001 - lieber Ersatzbild als gar kein Post
                print(f"::warning::Bild {i + 1} konnte nicht erzeugt werden ({exc}) - nutze Ersatz.")
        elif not dry_run:
            print("::warning::CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN fehlen - nutze Ersatzbilder.")
        if img is None:
            img = fallback_background(account_cfg["accent"], seed + i)
        images.append(img)
        sources.append(source)
        print(f"  Bild {i + 1}/{len(prompts)}: {source}")
    return images, sources


# --------------------------------------------------------------------------- Text


def _font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Poppins-{weight}.ttf"), size)


def parse_marked(text):
    """'Ein *Wort* hier' -> [(wort, hervorgehoben)] - Sternchen markieren Akzent-Woerter."""
    words, accent = [], False
    for part in re.split(r"(\*)", text):
        if part == "*":
            accent = not accent
            continue
        for w in part.split():
            words.append((w, accent))
    return words


def layout_lines(words, font, max_w, draw):
    lines, cur, cur_w = [], [], 0
    space = draw.textlength(" ", font=font)
    for word, acc in words:
        ww = draw.textlength(word, font=font)
        add = ww if not cur else cur_w + space + ww
        if cur and add > max_w:
            lines.append((cur, cur_w))
            cur, cur_w = [(word, acc, ww)], ww
        else:
            cur.append((word, acc, ww))
            cur_w = add
    if cur:
        lines.append((cur, cur_w))
    return lines


def fit_text(text, weight, size, max_w, max_lines, draw, upper=False):
    """Groesste Schriftgroesse, bei der der Text in max_lines Zeilen passt und kein
    einzelnes Wort breiter als max_w ist (lange deutsche Komposita!)."""
    words = parse_marked(text.upper() if upper else text)
    while size > 30:
        font = _font(weight, size)
        lines = layout_lines(words, font, max_w, draw)
        widest = max(lw for _, lw in lines)
        if len(lines) <= max_lines and widest <= max_w:
            return font, lines
        size -= 4
    font = _font(weight, size)
    return font, layout_lines(words, font, max_w, draw)


def render_text_card(seg, accent):
    """Transparente Ebene mit dem Text einer Folie (wird pro Folie einmal berechnet)."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    white = (255, 255, 255, 255)
    acc = tuple(accent) + (255,)
    blocks = []  # (font, lines, gap, default_color)
    if seg["kind"] == "hook":
        kf, kl = fit_text(seg["kicker"], "Bold", 50, TEXT_MAX_W, 1, d, upper=True)
        blocks.append((kf, [([(w, True, ww) for w, _, ww in kl[0][0]], kl[0][1])], 34, acc))
        f, lines = fit_text(seg["text"], "Bold", 82, TEXT_MAX_W, 6, d)
        blocks.append((f, lines, 0, white))
    elif seg["kind"] == "cta":
        parts = seg["text"].split("\n")
        f, lines = fit_text(parts[0], "Bold", 76, TEXT_MAX_W, 2, d)
        blocks.append((f, [([(w, True, ww) for w, _, ww in ln], lw) for ln, lw in lines], 24, acc))
        for p in parts[1:]:
            f2, l2 = fit_text(p, "SemiBold", 54, TEXT_MAX_W, 3, d)
            blocks.append((f2, l2, 0, white))
    else:
        f, lines = fit_text(seg["text"], "Bold", 70, TEXT_MAX_W, 7, d)
        blocks.append((f, lines, 0, white))

    line_h = [int(f.size * 1.22) for f, lines, _, _ in blocks for _ in lines]
    total = sum(line_h) + sum(g for _, _, g, _ in blocks)
    y = TEXT_CENTER_Y - total // 2
    # Weicher dunkler Schatten hinter dem Textblock fuer Lesbarkeit auf jedem Bild.
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).rounded_rectangle((60, y - 70, W - 60, y + total + 70), 60, fill=150)
    shade = shade.filter(ImageFilter.GaussianBlur(60))
    layer.putalpha(shade)  # schwarz, Deckkraft = weicher Schatten
    d = ImageDraw.Draw(layer)
    for font, lines, gap, default in blocks:
        stroke = max(3, font.size // 14)
        space = d.textlength(" ", font=font)
        for words, lw in lines:
            x = (W - lw) / 2
            for word, hi, ww in words:
                color = acc if hi else default
                d.text((x, y), word, font=font, fill=color, stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
                x += ww + space
            y += int(font.size * 1.22)
        y += gap
    return layer


def render_handle(handle):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((W / 2, 200), handle, font=_font("SemiBold", 34), fill=(255, 255, 255, 150), anchor="ma",
           stroke_width=2, stroke_fill=(0, 0, 0, 120))
    return layer


# --------------------------------------------------------------------------- Video


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def kenburns(base, progress, direction):
    """Langsamer Zoom mit leichter Schwenkbewegung (progress 0..1)."""
    bw, bh = base.size
    zoom = 1.08 + 0.14 * progress
    cw, ch = bw / zoom, bh / zoom
    max_dx, max_dy = (bw - cw) / 2, (bh - ch) / 2
    cx = bw / 2 + direction * max_dx * (progress - 0.5)
    cy = bh / 2 - max_dy * 0.5 * (progress - 0.5)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return base.resize((W, H), Image.BILINEAR, box=box)


def vignette_mask():
    small = Image.new("L", (108, 192))
    px = small.load()
    for y in range(192):
        for x in range(108):
            d = math.hypot((x - 54) / 54, (y - 96) / 96)
            px[x, y] = int(max(0, min(255, (d - 0.55) * 300)))
    return small.resize((W, H), Image.BICUBIC)


def timeline(segments):
    t = 0.0
    for seg in segments:
        seg["start"] = t
        t += seg["duration"]
        seg["end"] = t
    return t


def image_spans(segments):
    """Zeitraeume, in denen jedes Bild (Index) am Stueck zu sehen ist."""
    spans = []
    for seg in segments:
        if spans and spans[-1][0] == seg["image"]:
            spans[-1][2] = seg["end"]
        else:
            spans.append([seg["image"], seg["start"], seg["end"]])
    return spans


def frame_at(t, spans, bases, black):
    for k, (idx, start, end) in enumerate(spans):
        if start <= t < end or k == len(spans) - 1:
            prog = (t - start) / max(0.001, end - start)
            frame = kenburns(bases[idx], min(1.0, prog), 1 if k % 2 == 0 else -1)
            if k + 1 < len(spans) and t > end - XFADE:
                nidx, nstart, nend = spans[k + 1]
                nxt = kenburns(bases[nidx], 0.0, -1 if k % 2 == 0 else 1)
                frame = Image.blend(frame, nxt, ease((t - (end - XFADE)) / XFADE))
            return frame
    return black


def text_alpha(t, seg):
    a_in = (t - seg["start"]) / FADE
    a_out = (seg["end"] - t) / (FADE * 0.7)
    return max(0.0, min(1.0, a_in, a_out))


def render_video(segments, bases, handle, accent, out_path):
    total = timeline(segments)
    spans = image_spans(segments)
    cards = [render_text_card(seg, accent) for seg in segments]
    handle_layer = render_handle(handle)
    vig = vignette_mask()
    black = Image.new("RGB", (W, H))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n_frames = int(round(total * FPS))
    seg_i = 0
    for i in range(n_frames):
        t = i / FPS
        while seg_i < len(segments) - 1 and t >= segments[seg_i]["end"]:
            seg_i += 1
        seg = segments[seg_i]
        frame = frame_at(t, spans, bases, black)
        frame = Image.composite(black, frame, vig).convert("RGBA")
        frame.alpha_composite(handle_layer)
        a = text_alpha(t, seg)
        if a > 0:
            card = cards[seg_i]
            if a < 1:
                rise = int(24 * (1 - ease(a)))
                faded = card.copy()
                faded.putalpha(card.getchannel("A").point(lambda v, a=a: int(v * a)))
                frame.alpha_composite(faded, (0, rise))
            else:
                frame.alpha_composite(card)
        proc.stdin.write(frame.convert("RGB").tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg (Video) fehlgeschlagen")
    return total


# --------------------------------------------------------------------------- Audio


def pick_music(account, account_state, rng=random):
    files = sorted(
        f for ext in ("mp3", "wav", "m4a", "aac", "ogg")
        for f in glob.glob(os.path.join(MUSIC_ROOT, account, f"*.{ext}"))
    )
    if not files:
        return None
    recent = account_state.get("recent_music", [])
    candidates = [f for f in files if os.path.basename(f) not in recent] or files
    choice = rng.choice(candidates)
    account_state["recent_music"] = (recent + [os.path.basename(choice)])[-max(1, len(files) - 1):]
    return choice


def synth_ambient(grade, duration, out_path, seed=0):
    """Dunkler Ambient-Klangteppich (lizenzfrei, rein synthetisch) als Musik-Ersatz."""
    rng = random.Random(seed)
    if grade == "cold":  # Grusel: tiefe, leicht schwebende Moll-Fläche + Rauschen
        root = rng.choice([49.0, 51.9, 55.0])
        tones = [(root, 0.30, 0.07), (root * 1.06, 0.12, 0.05), (root * 1.5, 0.12, 0.11),
                 (root * 2.38, 0.05, 0.03)]
        noise, lp = 0.05, 900
    else:  # Mystery: offene Quinten, schimmernde Obertöne
        root = rng.choice([65.4, 73.4, 61.7])
        tones = [(root, 0.26, 0.06), (root * 1.5, 0.16, 0.09), (root * 2, 0.10, 0.05), (root * 3, 0.05, 0.13),
                 (root * 4.5, 0.025, 0.21)]
        noise, lp = 0.03, 2500
    expr = "+".join(
        f"{amp}*sin(2*PI*{f:.3f}*t)*(0.6+0.4*sin(2*PI*{lfo}*t+{rng.uniform(0, 6):.2f}))"
        for f, amp, lfo in tones
    )
    fade_out = max(0.0, duration - 2.5)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"aevalsrc='{expr}':s=44100:d={duration:.2f}",
        "-f", "lavfi", "-i", f"anoisesrc=color=brown:amplitude={noise}:d={duration:.2f}:r=44100",
        "-filter_complex",
        f"[0][1]amix=inputs=2:normalize=0,lowpass=f={lp},aecho=0.8:0.6:400|900:0.25|0.15,"
        f"afade=t=in:d=2,afade=t=out:st={fade_out:.2f}:d=2.5,volume=1.6,aformat=channel_layouts=stereo",
        "-c:a", "aac", "-b:a", "160k", out_path,
    ]
    subprocess.run(cmd, check=True)
    return out_path


async def _tts(text, voice, path):
    import edge_tts

    await edge_tts.Communicate(text, voice, rate="+5%").save(path)


def ffprobe_duration(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def make_voiceover(segments, voice, work_dir):
    """Spricht jede Folie (ausser dem Folge-Aufruf) und verlaengert Folien, deren
    Sprechzeit laenger als die Lesezeit ist. Gibt Pfad zur Sprachspur zurueck."""
    parts = []
    for i, seg in enumerate(segments):
        if seg["kind"] == "cta":
            parts.append((None, seg["duration"]))
            continue
        text = strip_marks(seg["text"])
        if seg["kind"] == "hook":
            text = f"{strip_marks(seg['kicker'])} {text}"
        path = os.path.join(work_dir, f"vo_{i}.mp3")
        asyncio.run(_tts(text, voice, path))
        dur = ffprobe_duration(path)
        seg["duration"] = max(seg["duration"], dur + 0.6)
        parts.append((path, seg["duration"]))
    inputs, filters = [], []
    for k, (path, dur) in enumerate(parts):
        if path:
            inputs += ["-i", path]
            filters.append(f"[{len(inputs) // 2 - 1}]adelay=250|250,apad,atrim=0:{dur:.3f},"
                           f"aformat=sample_rates=44100:channel_layouts=stereo[s{k}]")
        else:
            filters.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{dur:.3f}[s{k}]")
    concat = "".join(f"[s{k}]" for k in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[out]"
    out = os.path.join(work_dir, "voice.m4a")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex",
                    ";".join(filters + [concat]), "-map", "[out]", "-c:a", "aac", out], check=True)
    return out


def mux(video, music, voice, duration, out_path):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-stream_loop", "-1", "-i", music]
    fade = f"afade=t=in:d=0.8,afade=t=out:st={max(0.0, duration - 1.8):.2f}:d=1.8"
    if voice:
        cmd += ["-i", voice]
        fc = (f"[1:a]volume={MUSIC_VOLUME_UNDER_VOICE},atrim=0:{duration:.3f},{fade}[m];"
              f"[2:a]volume=1.0[v];[m][v]amix=inputs=2:normalize=0:duration=first[a]")
    else:
        fc = f"[1:a]volume={MUSIC_VOLUME},atrim=0:{duration:.3f},{fade}[a]"
    cmd += ["-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy",
            "-c:a", "aac", "-b:a", "160k", "-t", f"{duration:.3f}", "-movflags", "+faststart", out_path]
    subprocess.run(cmd, check=True)


# --------------------------------------------------------------------------- Ablauf


def make_reel(account, story_id=None, dry_run=False, preview=False, rng=None):
    rng = rng or random.Random()
    account_cfg, stories = load_account(account)
    state = load_state()
    acc_state = state.setdefault(account, {"posted": [], "recent_music": []})
    story = pick_story(stories, acc_state, rng, story_id)
    seed = rng.randrange(1_000_000)
    out_dir = os.path.join(OUT_ROOT, account)
    os.makedirs(out_dir, exist_ok=True)
    print(f"[{account}] Story: {story['id']}")

    images, sources = get_images(account, account_cfg, story, out_dir, dry_run, seed)
    bases = [prepare_base(img, account_cfg.get("grade", "cold")) for img in images]
    segments = build_segments(account_cfg, story, rng)

    work = tempfile.mkdtemp(prefix="story_reel_")
    try:
        voice = None
        if account_cfg.get("voiceover") and not dry_run:
            try:
                voice = make_voiceover(segments, account_cfg.get("voice", "de-DE-ConradNeural"), work)
            except Exception as exc:  # noqa: BLE001 - dann eben nur Text + Musik
                print(f"::warning::Sprecherstimme fehlgeschlagen ({exc}) - Reel ohne Stimme.")
                voice = None
        silent = os.path.join(work, "video.mp4")
        duration = render_video(segments, bases, account_cfg["handle"], account_cfg["accent"], silent)
        music = pick_music(account, acc_state, rng)
        if not music:
            ambient = os.path.join(work, "ambient.m4a")
            music = synth_ambient(account_cfg.get("grade", "cold"), duration, ambient, seed)
        filename = f"reel_{story['id']}.mp4"
        out_path = os.path.join(out_dir, filename)
        mux(silent, music, voice, duration, out_path)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(f"Reel fertig: {out_path} ({duration:.1f} s, Musik: "
          f"{os.path.basename(music) if MUSIC_ROOT in music else 'synthetisch'})")

    if preview:
        return out_path, None
    post = {
        "type": "reel",
        "file": filename,  # liegt auf dem Medien-Branch im Wurzelverzeichnis
        "branch": f"story-media-{account}",
        "thumb_offset": THUMB_OFFSET_MS,
        "caption": build_caption(account_cfg, story, rng),
        "account": account,
        "story_id": story["id"],
        "image_sources": sources,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    with open(os.path.join(out_dir, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=2)
    posted = [s for s in acc_state.get("posted", []) if s != story["id"]] + [story["id"]]
    acc_state["posted"] = posted[-STATE_HISTORY_LIMIT:]
    save_state(state)
    # Nur die Bilder der letzten Stories behalten.
    for old in sorted(glob.glob(os.path.join(out_dir, "img_*.jpg")), key=os.path.getmtime)[:-9]:
        os.remove(old)
    for old in glob.glob(os.path.join(out_dir, "reel_*.mp4")):
        if os.path.basename(old) != filename:
            os.remove(old)
    return out_path, post


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--account", required=True, choices=ACCOUNTS)
    parser.add_argument("--story", help="bestimmte Story-ID statt der naechsten")
    parser.add_argument("--dry-run", action="store_true", help="keine API-Aufrufe (Ersatzbilder)")
    parser.add_argument("--preview", action="store_true", help="nur rendern, Log bleibt unveraendert")
    args = parser.parse_args()
    make_reel(args.account, args.story, args.dry_run, args.preview)


if __name__ == "__main__":
    main()
