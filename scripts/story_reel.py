"""Story-Reels fuer die beiden Themen-Accounts (wahre Gruselgeschichten / Raetsel &
Verschwoerungen mit wahrem Kern).

Pro Lauf:
  1. Naechste noch nicht gepostete Story aus content/story_reels/<account>.json waehlen
     (Gedaechtnis: story_reels_posted_log.json; sind alle durch, beginnt der Zyklus neu).
  2. Fuer JEDE Szene ein eigenes, passendes Bild erzeugen:
       Cloudflare Workers AI (FLUX-2 Klein 4B, Reserve FLUX-1 Schnell) -> Pollinations
       (optional, Reserve) -> dunkler Verlauf als letzte Notloesung.
  3. Sprecher: tiefe deutsche Maennerstimme (edge-tts, kostenlos), zusaetzlich tiefer
     gepitcht und mit Bass/Hall "dunkel" gemacht. Die Szenen dauern so lange wie gesprochen
     wird (~1 Minute pro Reel). Der Text steht mit im Bild, gesprochene Woerter leuchten auf.
  4. Reel rendern (1080x1920, 30 fps, H.264/AAC): Hook ("Wusstest du...?" + packender
     Satz) -> 7-9 Szenen -> Folge-Aufruf. Langsamer Zoom, Ueberblendungen, fette Schrift
     mit Kontur, *Woerter in Sternchen* in der Akzentfarbe.
  5. Musik: eigener Titelsong pro Account (assets/story_music/<account>/theme.mp3, erzeugt
     von scripts/compose_theme.py), leise unter der Stimme.
  6. next_post.json fuer publish.py schreiben. Das Video selbst liegt nicht in main,
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
import urllib.parse
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
TEXT_CENTER_Y = 1080  # untere Bildhaelfte, aber oberhalb von Caption + Buttons von Instagram
FADE = 0.3
XFADE = 0.5  # Ueberblendung zwischen zwei Bildern
CTA_SECONDS = 3.0
MUSIC_VOLUME = 0.55
MUSIC_VOLUME_UNDER_VOICE = 0.22
THUMB_OFFSET_MS = 1500  # Titelbild: Hook-Folie
STATE_HISTORY_LIMIT = 200
DIM_FACTOR = 0.55  # Helligkeit noch nicht gesprochener Woerter (Kontur bleibt voll)

# ---- Bilder ---------------------------------------------------------------------------
# Cloudflare Workers AI, kostenloses Tageskontingent 10.000 Neurons (geteilt mit dem
# People-Account, der ~4.400/Tag braucht). Kosten laut Preisliste:
#   FLUX-2 Klein 4B: 26 Neurons pro 512er-Kachel -> 768x1344 (6 Kacheln) ~ 160/Bild
#   FLUX-1 Schnell:  4,8/Kachel + 9,6/Schritt   -> 1024x1024, 4 Schritte ~ 60/Bild
# 2 Reels x ~10 Bilder = ~3.200 Neurons/Tag -> passt.
MODEL_CHAIN = [
    "@cf/black-forest-labs/flux-2-klein-4b",
    "@cf/black-forest-labs/flux-1-schnell",
]
GEN_W, GEN_H = 768, 1344  # ~9:16, Vielfache von 16
POLLINATIONS_URL = "https://gen.pollinations.ai/image/{prompt}"

# ---- Stimme ---------------------------------------------------------------------------
DEFAULT_VOICE = "de-DE-KillianNeural"  # tiefste deutsche edge-tts-Stimme (~100 Hz)
VOICE_RATE = "+4%"
VOICE_PITCH = "-6Hz"
# Klang der Stimme pro Account (in content/story_reels/<account>.json -> "voice_fx"):
#   pitch_hz:     Tonhoehe direkt bei edge-tts
#   pitch_factor: zusaetzliche Tonverschiebung im Nachgang (<1 = tiefer, Tempo bleibt gleich)
#   bass_db:      Bass-Anhebung bei 110 Hz
#   echo:         Hall/Echo (ffmpeg aecho: in_gain:out_gain:delays:decays)
DEFAULT_VOICE_FX = {  # "dunkel": tiefe Erzaehlerstimme (Grusel)
    "pitch_hz": "-6Hz",
    "pitch_factor": 0.87,
    "bass_db": 5,
    "echo": "0.85:0.6:70|140:0.16|0.08",
}


def voice_filter(fx=None):
    """ffmpeg-Filterkette fuer die Stimme. pitch_factor 1.0 = keine Tonverschiebung,
    echo leer = trocken (kein Hall)."""
    fx = {**DEFAULT_VOICE_FX, **(fx or {})}
    pf = float(fx["pitch_factor"])
    chain = []
    if abs(pf - 1.0) > 1e-3:
        chain.append(f"asetrate=24000*{pf},aresample=44100,atempo={1 / pf:.5f}")
    else:
        chain.append("aresample=44100")
    chain += [
        f"equalizer=f=110:t=q:w=1:g={fx['bass_db']}",
        f"equalizer=f=4000:t=q:w=1.5:g={fx.get('presence_db', -3)}",
        "highpass=f=50",
        "acompressor=threshold=-20dB:ratio=3:attack=8:release=250:makeup=2",
    ]
    if fx.get("echo"):
        chain.append(f"aecho={fx['echo']}")
    return ",".join(chain)


DARK_VOICE_FILTER = voice_filter()
VOICE_LEAD_IN = 0.15  # Sekunden Stille vor jeder Szene
VOICE_GAP = 0.25  # Pause nach jeder Szene

WORDS_PER_SECOND = 2.7  # Lesetempo, falls ohne Stimme


# --------------------------------------------------------------------------- Inhalte


def load_account(account):
    with open(os.path.join(CONTENT_DIR, f"{account}.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    ids = [s["id"] for s in data["stories"]]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{account}.json enthaelt doppelte Story-IDs")
    return data["account"], data["stories"]


def load_state(path=None):
    path = path or STATE_PATH  # erst beim Aufruf auswerten (Tests biegen STATE_PATH um)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state, path=None):
    with open(path or STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")


def pick_story(stories, account_state, rng=random, story_id=None):
    """Naechste ungepostete Story (in Dateireihenfolge, damit neue Eintraege am Ende
    planbar nachkommen). Sind alle durch, beginnt der Zyklus von vorn - mit der Story,
    die am laengsten nicht gepostet wurde."""
    if story_id:
        for s in stories:
            if s["id"] == story_id:
                return s
        raise SystemExit(f"Story '{story_id}' nicht gefunden")
    posted = account_state.get("posted", [])
    blocked = set(posted) | set(account_state.get("skipped", []))
    unused = [s for s in stories if s["id"] not in blocked]
    if unused:
        return unused[0]
    order = {sid: i for i, sid in enumerate(posted)}
    return min(stories, key=lambda s: order.get(s["id"], -1))


def strip_marks(text):
    return text.replace("*", "")


GERMAN_HINTS = {"der", "die", "das", "und", "mit", "ein", "eine", "einem", "einer", "auf", "im", "dem", "den"}


def tidy_story(story):
    """Kleine Formfehler von KI-Texten automatisch korrigieren (Satzende, Leerzeichen)."""
    for part in [story.get("hook", {})] + list(story.get("scenes", [])):
        text = re.sub(r"\s+", " ", str(part.get("text", ""))).strip()
        if text and text[-1] not in '.!?…“"':
            text += "."
        part["text"] = text
        part["image"] = re.sub(r"\s+", " ", str(part.get("image", "")).replace("*", "")).strip()
    story["tags"] = [t if t.startswith("#") else f"#{t}" for t in story.get("tags", [])][:3]
    return story


def validate_story(story):
    """Prueft eine Geschichte auf das Reel-Format. Gibt eine Liste von Problemen zurueck
    (leer = in Ordnung). Wird fuer handgeschriebene und KI-geschriebene Geschichten genutzt."""
    problems = []
    try:
        if not re.fullmatch(r"[a-z0-9_]{3,60}", story.get("id", "")):
            problems.append("id muss aus a-z, 0-9 und _ bestehen")
        hook, scenes = story["hook"], story["scenes"]
        if not (hook.get("text") and hook.get("image")):
            problems.append("Hook braucht text und image")
        if not 6 <= len(scenes) <= 10:
            problems.append(f"{len(scenes)} Szenen (erlaubt 6-10)")
        texts = [hook.get("text", "")] + [sc.get("text", "") for sc in scenes]
        for i, sc in enumerate(scenes):
            if not sc.get("image") or not sc.get("text"):
                problems.append(f"Szene {i + 1} braucht text und image")
        for t in texts:
            if t.count("*") % 2:
                problems.append(f"unpaarige Sternchen: {t[:40]}")
            if len(strip_marks(t).split()) > 34:
                problems.append(f"Szene zu lang: {t[:40]}")
        words = sum(len(strip_marks(t).split()) for t in texts)
        if not 85 <= words <= 170:
            problems.append(f"{words} Woerter (Ziel 100-150 fuer ~1 Minute)")
        images = [hook.get("image", "")] + [sc.get("image", "") for sc in scenes]
        for img in images:
            if "*" in img:
                problems.append("Bildbeschreibungen ohne Sternchen")
                break
        german = sum(1 for img in images for w in re.findall(r"\w+", img.lower()) if w in GERMAN_HINTS)
        if german > len(images):
            problems.append("Bildbeschreibungen muessen auf Englisch sein")
        for t in texts:
            if t.count("*") > 4:
                problems.append(f"zu viele Hervorhebungen (max. 2 pro Szene): {t[:40]}")
                break
        for tag in story.get("tags", []):
            if not re.fullmatch(r"#[\wäöüÄÖÜß]+", tag):
                problems.append(f"ungueltiger Hashtag: {tag}")
    except (KeyError, TypeError, AttributeError) as exc:
        problems.append(f"Formatfehler: {exc}")
    return problems


def unused_count(stories, account_state):
    used = set(account_state.get("posted", [])) | set(account_state.get("skipped", []))
    return sum(1 for s in stories if s["id"] not in used)


def build_caption(account_cfg, story, rng=random):
    tags = list(dict.fromkeys(story.get("tags", []) + account_cfg["hashtags"]))[:15]
    teaser = strip_marks(story["scenes"][0]["text"])
    return (
        f"{strip_marks(story['hook']['text'])}\n\n"
        f"{teaser} …\n\n"
        f"{rng.choice(account_cfg['caption_cta'])}\n"
        f"Folge {account_cfg['handle']} für mehr.\n\n"
        f"{' '.join(tags)}"
    )


def build_tiktok_caption(account_cfg, story, rng=random):
    """Kuerzere Beschreibung fuer TikTok: Hook, Teaser, Frage, 5 Hashtags (TikTok mag wenige, passende)."""
    story_tags = story.get("tags", [])[:2]
    tags = list(dict.fromkeys(story_tags + account_cfg.get("tiktok_hashtags", account_cfg["hashtags"])))[:5]
    teaser = strip_marks(story["scenes"][0]["text"])
    return (
        f"{strip_marks(story['hook']['text'])}\n\n"
        f"{teaser} …\n\n"
        f"{rng.choice(account_cfg['caption_cta'])}\n\n"
        f"{' '.join(tags)}"
    )[:2200]


def reading_seconds(text):
    words = len(strip_marks(text).split())
    return max(3.0, min(8.5, 1.3 + words / WORDS_PER_SECOND))


def image_prompts(story):
    return [story["hook"]["image"]] + [s["image"] for s in story["scenes"]]


def build_segments(account_cfg, story, rng=random):
    """Hook (Bild 0) -> eine Szene pro Bild -> Folge-Aufruf (zurueck zu Bild 0 = Loop)."""
    kicker = story.get("kicker") or rng.choice(account_cfg["kickers"])
    segs = [{"kind": "hook", "text": story["hook"]["text"], "kicker": kicker, "image": 0}]
    for i, scene in enumerate(story["scenes"]):
        segs.append({"kind": "scene", "text": scene["text"], "image": i + 1})
    cta_lines = [line.format(handle=account_cfg["handle"]) for line in account_cfg["cta"]]
    segs.append(
        {"kind": "cta", "text": "\n".join(cta_lines), "image": 0, "speech": account_cfg.get("cta_voice", "")}
    )
    for seg in segs:
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
            resp = requests.post(
                url, headers=headers, files={k: (None, v) for k, v in form.items()}, timeout=180
            )
        else:
            payload = {"prompt": prompt, "steps": 4}
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


def generate_pollinations(prompt, seed, api_key="", retries=3):
    """Reserve-Anbieter (FLUX ueber pollinations.ai). Braucht einen kostenlosen Schluessel
    von enter.pollinations.ai (Secret POLLINATIONS_API_KEY)."""
    url = POLLINATIONS_URL.format(prompt=urllib.parse.quote(prompt[:1500], safe=""))
    params = {"width": GEN_W, "height": GEN_H, "model": "flux", "seed": seed, "nologo": "true"}
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    for attempt in range(retries):
        resp = requests.get(url, params=params, headers=headers, timeout=180)
        if resp.ok and resp.headers.get("content-type", "").startswith("image/"):
            return resp.content
        if resp.status_code in (402, 429, 500, 502, 503) and attempt < retries - 1:
            wait = min(90, int(resp.headers.get("Retry-After", "0") or 0) or 45)
            time.sleep(wait)
            continue
        raise RuntimeError(f"Pollinations HTTP {resp.status_code}: {resp.text[:200]}")
    raise RuntimeError("unerreichbar")


class ImageMaker:
    """Probiert die Anbieter der Reihe nach: Pollinations (falls Schluessel da) -> Cloudflare
    FLUX-2 Klein -> Cloudflare FLUX-1 Schnell. Merkt sich, welche in diesem Lauf ausgefallen sind
    (z.B. Kontingent leer) und springt dann fuer die restlichen Bilder gleich zum naechsten."""

    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.cf = (
            os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(),
            os.environ.get("CLOUDFLARE_API_TOKEN", "").strip(),
        )
        self.pollinations_key = os.environ.get("POLLINATIONS_API_KEY", "").strip()
        self.pollinations_on = bool(self.pollinations_key)
        self.dead = set()

    def make(self, prompt, seed):
        if self.dry_run:
            return None, "fallback"
        if self.pollinations_on and "pollinations" not in self.dead:
            try:
                raw = generate_pollinations(prompt, seed, self.pollinations_key)
                return Image.open(io.BytesIO(raw)).convert("RGB"), "pollinations"
            except Exception as exc:  # noqa: BLE001
                print(f"  Pollinations fehlgeschlagen: {exc}")
                self.dead.add("pollinations")
        if all(self.cf):
            for model in MODEL_CHAIN:
                if model in self.dead or "cloudflare" in self.dead:
                    continue
                try:
                    raw = generate_cloudflare(model, prompt, *self.cf, seed=seed)
                    return Image.open(io.BytesIO(raw)).convert("RGB"), model.split("/")[-1]
                except Exception as exc:  # noqa: BLE001 - naechsten Anbieter probieren
                    print(f"  {model} fehlgeschlagen: {exc}")
                    self.dead.add("cloudflare" if "daily free allocation" in str(exc) else model)
        return None, "fallback"


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
        img = ImageEnhance.Color(img).enhance(0.6)
        tint = Image.new("RGB", img.size, (20, 40, 70))
    else:
        img = ImageEnhance.Color(img).enhance(0.95)
        tint = Image.new("RGB", img.size, (70, 45, 15))
    img = Image.blend(img, tint, 0.10)
    return ImageEnhance.Brightness(img).enhance(0.85)


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


def get_images(account_cfg, story, out_dir, dry_run, seed):
    """Ein Bild pro Szene (Cache in out_dir, damit ein abgebrochener Lauf nichts doppelt kostet)."""
    maker = ImageMaker(dry_run)
    images, sources = [], []
    for i, prompt in enumerate(image_prompts(story)):
        cache = os.path.join(out_dir, f"img_{story['id']}_{i}.jpg")
        if os.path.exists(cache):
            images.append(Image.open(cache).convert("RGB"))
            sources.append("cache")
            continue
        img, source = maker.make(f"{prompt}, {account_cfg['image_style']}", seed + i)
        if img is None:
            if not dry_run:
                print(f"::warning::Bild {i + 1} konnte nicht erzeugt werden - nutze Ersatzhintergrund.")
            img = fallback_background(account_cfg["accent"], seed + i)
        else:
            img.save(cache, quality=92)
        images.append(img)
        sources.append(source)
        print(f"  Bild {i + 1}: {source}")
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
            if words and all(ch in ".,;:!?…“”\"')" for ch in w):
                words[-1] = (words[-1][0] + w, words[-1][1])  # Satzzeichen ans vorige Wort haengen
            else:
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


def count_words(seg):
    return len(parse_marked(seg["text"].split("\n")[0] if seg["kind"] == "cta" else seg["text"]))


def _layout(seg, accent, d):
    """Textbloecke einer Folie: [(font, lines, gap, default_color, karaoke)]."""
    white = (255, 255, 255)
    acc = tuple(accent)
    blocks = []
    if seg["kind"] == "hook":
        kf, kl = fit_text(seg["kicker"], "Bold", 50, TEXT_MAX_W, 1, d, upper=True)
        blocks.append((kf, [([(w, True, ww) for w, _, ww in kl[0][0]], kl[0][1])], 30, acc, False))
        f, lines = fit_text(seg["text"], "Bold", 80, TEXT_MAX_W, 6, d)
        blocks.append((f, lines, 0, white, True))
    elif seg["kind"] == "cta":
        parts = seg["text"].split("\n")
        f, lines = fit_text(parts[0], "Bold", 74, TEXT_MAX_W, 2, d)
        blocks.append((f, [([(w, True, ww) for w, _, ww in ln], lw) for ln, lw in lines], 22, acc, False))
        for p in parts[1:]:
            f2, l2 = fit_text(p, "SemiBold", 52, TEXT_MAX_W, 3, d)
            blocks.append((f2, l2, 0, white, False))
    else:
        f, lines = fit_text(seg["text"], "Bold", 66, TEXT_MAX_W, 7, d)
        blocks.append((f, lines, 0, white, True))
    return blocks


def render_text_card(seg, accent, revealed=None):
    """Transparente Ebene mit dem Text einer Folie. revealed = Anzahl bereits gesprochener
    Woerter (None = alles voll sichtbar); die uebrigen werden abgedunkelt."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    blocks = _layout(seg, accent, d)
    total = sum(int(f.size * 1.22) * len(lines) + gap for f, lines, gap, _, _ in blocks)
    y = TEXT_CENTER_Y - total // 2
    # Weicher dunkler Schatten hinter dem Textblock fuer Lesbarkeit auf jedem Bild.
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).rounded_rectangle((50, y - 70, W - 50, y + total + 70), 60, fill=165)
    layer.putalpha(shade.filter(ImageFilter.GaussianBlur(60)))  # schwarz, Deckkraft = Schatten
    d = ImageDraw.Draw(layer)
    for font, lines, gap, default, karaoke in blocks:
        stroke = max(3, font.size // 14)
        space = d.textlength(" ", font=font)
        idx = 0
        for words, lw in lines:
            x = (W - lw) / 2
            for word, hi, ww in words:
                color = tuple(accent) if hi else default
                if karaoke and revealed is not None and idx >= revealed:
                    color = tuple(int(c * DIM_FACTOR) for c in color)
                d.text(
                    (x, y),
                    word,
                    font=font,
                    fill=color + (255,),
                    stroke_width=stroke,
                    stroke_fill=(0, 0, 0, 255),
                )
                x += ww + space
                idx += 1
            y += int(font.size * 1.22)
        y += gap
    return layer


def render_handle(handle):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(
        (W / 2, 200),
        handle,
        font=_font("SemiBold", 34),
        fill=(255, 255, 255, 150),
        anchor="ma",
        stroke_width=2,
        stroke_fill=(0, 0, 0, 120),
    )
    return layer


# --------------------------------------------------------------------------- Video


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def kenburns(base, progress, direction):
    """Langsamer Zoom mit leichter Schwenkbewegung (progress 0..1)."""
    bw, bh = base.size
    zoom = 1.06 + 0.12 * progress
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
                nidx = spans[k + 1][0]
                nxt = kenburns(bases[nidx], 0.0, -1 if k % 2 == 0 else 1)
                frame = Image.blend(frame, nxt, ease((t - (end - XFADE)) / XFADE))
            return frame
    return black


def text_alpha(t, seg):
    a_in = (t - seg["start"]) / FADE
    a_out = (seg["end"] - t) / (FADE * 0.7)
    return max(0.0, min(1.0, a_in, a_out))


def revealed_words(t, seg):
    """Wie viele Woerter der Folie zum Zeitpunkt t schon gesprochen wurden (None = kein Effekt)."""
    times = seg.get("word_times")
    if not times:
        return None
    local = t - seg["start"]
    return sum(1 for w in times if w <= local + 0.05)


def render_video(segments, bases, handle, accent, out_path):
    total = timeline(segments)
    spans = image_spans(segments)
    cards = {}
    handle_layer = render_handle(handle)
    vig = vignette_mask()
    black = Image.new("RGB", (W, H))
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        out_path,
    ]
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
            key = (seg_i, revealed_words(t, seg))
            if key not in cards:
                cards[key] = render_text_card(seg, accent, key[1])
            card = cards[key]
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
        f
        for ext in ("mp3", "wav", "m4a", "aac", "ogg")
        for f in glob.glob(os.path.join(MUSIC_ROOT, account, f"*.{ext}"))
    )
    if not files:
        return None
    recent = account_state.get("recent_music", [])
    candidates = [f for f in files if os.path.basename(f) not in recent] or files
    choice = rng.choice(candidates)
    account_state["recent_music"] = (recent + [os.path.basename(choice)])[-max(1, len(files) - 1) :]
    return choice


def synth_ambient(grade, duration, out_path, seed=0):
    """Notloesung, falls kein Titelsong da ist: dunkler Ambient-Klangteppich per ffmpeg."""
    rng = random.Random(seed)
    root = rng.choice([49.0, 55.0]) if grade == "cold" else rng.choice([65.4, 73.4])
    tones = [(root, 0.3, 0.07), (root * 1.5, 0.14, 0.11), (root * 2, 0.08, 0.05)]
    expr = "+".join(f"{a}*sin(2*PI*{f:.3f}*t)*(0.6+0.4*sin(2*PI*{lfo}*t))" for f, a, lfo in tones)
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"aevalsrc='{expr}':s=44100:d={duration:.2f}",
        "-af",
        "lowpass=f=1200,aecho=0.8:0.6:400|900:0.25|0.15,aformat=channel_layouts=stereo",
        "-c:a",
        "aac",
        out_path,
    ]
    subprocess.run(cmd, check=True)
    return out_path


async def _tts(text, voice, path, pitch=VOICE_PITCH):
    """Sprachausgabe + Wort-Zeitstempel (Sekunden ab Beginn der Datei)."""
    import edge_tts

    com = edge_tts.Communicate(
        text,
        voice,
        rate=VOICE_RATE,
        pitch=pitch,
        boundary="WordBoundary",
        proxy=os.environ.get("HTTPS_PROXY") or None,
    )
    times = []
    with open(path, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                times.append(chunk["offset"] / 10_000_000)
    return times


def ffprobe_duration(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def map_word_times(boundaries, skip, n_display):
    """Ordnet die Zeitstempel der gesprochenen Woerter den angezeigten Woertern zu.
    skip = gesprochene Woerter vor dem angezeigten Text (z.B. der Aufhaenger)."""
    spoken = boundaries[skip:]
    if not spoken or not n_display:
        return []
    return [spoken[min(len(spoken) - 1, int(i * len(spoken) / n_display))] for i in range(n_display)]


def make_voiceover(segments, voice, work_dir, tts=None, fx=None):
    """Spricht jede Folie (Klang laut fx, siehe DEFAULT_VOICE_FX). Die Folien dauern dann so lange wie
    gesprochen wird. Gibt den Pfad der kompletten Sprachspur zurueck."""
    tts = tts or _tts
    fx = {**DEFAULT_VOICE_FX, **(fx or {})}
    vfilter = voice_filter(fx)
    parts = []
    for i, seg in enumerate(segments):
        if seg["kind"] == "cta":
            text = seg.get("speech", "")
        elif seg["kind"] == "hook":
            text = f"{strip_marks(seg['kicker']).rstrip('…. ')}. {strip_marks(seg['text'])}"
        else:
            text = strip_marks(seg["text"])
        if not text:
            parts.append((None, seg["duration"]))
            continue
        raw = os.path.join(work_dir, f"vo_{i}.mp3")
        boundaries = asyncio.run(tts(text, voice, raw, fx["pitch_hz"]))
        dark = os.path.join(work_dir, f"vo_{i}.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", vfilter, "-ac", "2", dark],
            check=True,
        )
        dur = ffprobe_duration(dark)
        seg["duration"] = max(dur + VOICE_LEAD_IN + VOICE_GAP, CTA_SECONDS if seg["kind"] == "cta" else 0)
        if seg["kind"] != "cta":
            skip = len(strip_marks(seg["kicker"]).split()) if seg["kind"] == "hook" else 0
            seg["word_times"] = [
                VOICE_LEAD_IN + b for b in map_word_times(boundaries, skip, count_words(seg))
            ]
        parts.append((dark, seg["duration"]))
    inputs, filters = [], []
    for k, (path, dur) in enumerate(parts):
        if path:
            inputs += ["-i", path]
            delay = int(VOICE_LEAD_IN * 1000)
            filters.append(
                f"[{len(inputs) // 2 - 1}]adelay={delay}|{delay},apad,atrim=0:{dur:.3f},"
                f"aformat=sample_rates=44100:channel_layouts=stereo[s{k}]"
            )
        else:
            filters.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{dur:.3f}[s{k}]")
    concat = (
        "".join(f"[s{k}]" for k in range(len(parts)))
        + f"concat=n={len(parts)}:v=0:a=1,loudnorm=I=-15:TP=-1.5[out]"
    )
    out = os.path.join(work_dir, "voice.wav")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            *inputs,
            "-filter_complex",
            ";".join(filters + [concat]),
            "-map",
            "[out]",
            "-ar",
            "44100",
            out,
        ],
        check=True,
    )
    return out


def mux(video, music, voice, duration, out_path):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-stream_loop", "-1", "-i", music]
    fade = f"afade=t=in:d=0.8,afade=t=out:st={max(0.0, duration - 1.8):.2f}:d=1.8"
    if voice:
        cmd += ["-i", voice]
        fc = (
            f"[1:a]volume={MUSIC_VOLUME_UNDER_VOICE},atrim=0:{duration:.3f},{fade}[m];"
            f"[2:a]volume=1.0[v];[m][v]amix=inputs=2:normalize=0:duration=first[a]"
        )
    else:
        fc = f"[1:a]volume={MUSIC_VOLUME},atrim=0:{duration:.3f},{fade}[a]"
    cmd += [
        "-filter_complex",
        fc,
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-t",
        f"{duration:.3f}",
        "-movflags",
        "+faststart",
        out_path,
    ]
    subprocess.run(cmd, check=True)


# --------------------------------------------------------------------------- Ablauf


def make_reel(account, story_id=None, dry_run=False, preview=False, rng=None, voice=None):
    rng = rng or random.Random()
    account_cfg, stories = load_account(account)
    state = load_state()
    acc_state = state.setdefault(account, {"posted": [], "recent_music": []})
    story = pick_story(stories, acc_state, rng, story_id)
    seed = rng.randrange(1_000_000)
    out_dir = os.path.join(OUT_ROOT, account)
    os.makedirs(out_dir, exist_ok=True)
    print(f"[{account}] Story: {story['id']} ({len(story['scenes'])} Szenen)")

    images, sources = get_images(account_cfg, story, out_dir, dry_run, seed)
    bases = [prepare_base(img, account_cfg.get("grade", "cold")) for img in images]
    segments = build_segments(account_cfg, story, rng)

    work = tempfile.mkdtemp(prefix="story_reel_")
    try:
        voice_track = None
        use_voice = account_cfg.get("voiceover", True) if voice is None else voice
        if use_voice and not dry_run:
            try:
                voice_track = make_voiceover(
                    segments, account_cfg.get("voice", DEFAULT_VOICE), work, fx=account_cfg.get("voice_fx")
                )
            except Exception as exc:  # noqa: BLE001 - dann eben nur Text + Musik
                print(f"::warning::Sprecherstimme fehlgeschlagen ({exc}) - Reel ohne Stimme.")
                for seg in segments:
                    seg.pop("word_times", None)
                    seg["duration"] = CTA_SECONDS if seg["kind"] == "cta" else reading_seconds(seg["text"])
                voice_track = None
        silent = os.path.join(work, "video.mp4")
        duration = render_video(segments, bases, account_cfg["handle"], account_cfg["accent"], silent)
        music = pick_music(account, acc_state, rng)
        if not music:
            music = synth_ambient(
                account_cfg.get("grade", "cold"), duration, os.path.join(work, "amb.m4a"), seed
            )
        filename = f"reel_{story['id']}.mp4"
        out_path = os.path.join(out_dir, filename)
        mux(silent, music, voice_track, duration, out_path)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(
        f"Reel fertig: {out_path} ({duration:.1f} s, Stimme: {'ja' if voice_track else 'nein'}, "
        f"Musik: {os.path.basename(music) if MUSIC_ROOT in music else 'Notloesung'})"
    )

    if preview:
        return out_path, None
    post = {
        "type": "reel",
        "file": filename,  # liegt auf dem Medien-Branch im Wurzelverzeichnis
        "branch": f"story-media-{account}",
        "thumb_offset": THUMB_OFFSET_MS,
        "caption": build_caption(account_cfg, story, rng),
        "tiktok_caption": build_tiktok_caption(account_cfg, story, rng),
        "account": account,
        "story_id": story["id"],
        "duration": round(duration, 1),
        "image_sources": sources,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    with open(os.path.join(out_dir, "next_post.json"), "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=2)
    posted = [s for s in acc_state.get("posted", []) if s != story["id"]] + [story["id"]]
    acc_state["posted"] = posted[-STATE_HISTORY_LIMIT:]
    save_state(state)
    for old in glob.glob(os.path.join(out_dir, "img_*.jpg")):
        if not os.path.basename(old).startswith(f"img_{story['id']}_"):
            os.remove(old)
    for old in glob.glob(os.path.join(out_dir, "reel_*.mp4")):
        if os.path.basename(old) != filename:
            os.remove(old)
    return out_path, post


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--account", required=True, choices=ACCOUNTS)
    parser.add_argument("--story", help="bestimmte Story-ID statt der naechsten")
    parser.add_argument(
        "--dry-run", action="store_true", help="keine API-Aufrufe (Ersatzbilder, keine Stimme)"
    )
    parser.add_argument("--preview", action="store_true", help="nur rendern, Log bleibt unveraendert")
    parser.add_argument("--no-voice", action="store_true", help="ohne Sprecher")
    args = parser.parse_args()
    make_reel(args.account, args.story, args.dry_run, args.preview, voice=False if args.no_voice else None)


if __name__ == "__main__":
    main()
