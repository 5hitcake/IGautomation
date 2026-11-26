"""Prototyp: "Zeitraffer"-Video eines Modells aus Streichhoelzern, rein aus KI-Bildern.

Idee: rueckwaerts bauen, damit Tisch, Licht und Kamera in allen Bildern gleich bleiben.
  1. Endbild (fertiges Modell) erzeugen: Pollinations (gratis), Reserve Cloudflare FLUX-2 Klein.
  2. Mit FLUX-2 Klein (Bildbearbeitung, Cloudflare Workers AI, gratis) Schritt fuer Schritt
     Teile entfernen - jedes Bild entsteht aus dem vorherigen.
  3. Reihenfolge umdrehen -> leerer Tisch ... fertiges Modell.
  4. Zwischen zwei Stufen waechst der Unterschied von unten nach oben in mehreren
     Teilschritten (Maske aus der Bilddifferenz) -> viel mehr "Zeitraffer"-Frames als KI-Bilder.
  5. Jeder Frame ~0,2 s, leichtes Kamerawackeln und Lichtflackern, am Ende bleibt das
     fertige Modell mit langsamem Zoom stehen.

Nutzung:
  python scripts/matchstick_timelapse.py --out experiments/matchstick/out
  python scripts/matchstick_timelapse.py --out ... --render-only   (nur Video aus vorhandenen Stufen)
"""

import argparse
import base64
import io
import json
import os
import random
import subprocess
import sys
import time
import urllib.parse

import numpy as np
import requests
from PIL import Image, ImageEnhance, ImageFilter

W, H = 1080, 1920
FPS = 30
FRAME_SECONDS = 0.2
GEN_W, GEN_H = 576, 1024  # Ausgabe Klein-Edit (Vielfache von 16)
IN_W, IN_H = 288, 512  # Eingabebilder muessen <= 512 px sein
SEED = 4242
KLEIN = "@cf/black-forest-labs/flux-2-klein-4b"

SUBJECT = "Neuschwanstein castle"
BASE_PROMPT = (
    f"Photorealistic photo of an extremely detailed miniature model of {SUBJECT} built entirely "
    "from thousands of glued wooden matchsticks with red match heads visible, standing on a plain "
    "light oak workbench, an open matchbox and a few loose matchsticks lying on the table nearby, "
    "warm soft window light from the left, fixed tripod camera at a slight high angle, the model is "
    "centered and fully visible with free space around it, vertical composition, sharp focus, "
    "realistic hobby craftsmanship, no people, no hands"
)
KEEP = (
    " Everything else stays exactly identical: same camera position and framing, same wooden table, "
    "same lighting, same matchbox, same colors. Photorealistic."
)
# Von "fertig" rueckwaerts bis "leerer Tisch".
REMOVE_STEPS = [
    "Remove the small flags and the thin spires on top of the towers of the matchstick castle.",
    "Remove the pointed roofs of all towers of the matchstick castle, the towers are now open at the top.",
    "Remove the upper third of every tower of the matchstick castle.",
    "Remove the main roof of the matchstick castle, the top of the walls is now open and unfinished.",
    "Remove the top floor of the matchstick castle walls and the remaining upper parts of the towers.",
    "Make the matchstick castle lower: remove another floor from all walls and towers.",
    "Remove the gatehouse and the front entrance wall of the matchstick castle.",
    "The matchstick walls are now only half as high, unfinished at the top.",
    "The matchstick walls are now only a third as high, unfinished at the top.",
    "Only low matchstick walls a few matchsticks high remain, showing the floor plan of the castle.",
    "Only a flat base platform made of matchsticks laid side by side remains, with a few first "
    "matchsticks of the walls standing on it.",
    "Only the flat base platform made of matchsticks laid side by side remains, nothing on it.",
    "Only half of the flat matchstick base platform remains, the other half is missing.",
    "The model is gone. Only a short row of a few matchsticks lies where the base started, next to "
    "a big pile of loose matchsticks and a tube of wood glue.",
    "An empty wooden table with a big neat pile of loose matchsticks, the open matchbox and a tube "
    "of wood glue. No model at all.",
]


# --------------------------------------------------------------------------- Bilder


def _decode(resp):
    if resp.headers.get("content-type", "").startswith("image/"):
        return resp.content
    data = resp.json()
    img = (data.get("result") or {}).get("image")
    if not img:
        raise RuntimeError(f"Antwort ohne Bild: {str(data)[:300]}")
    return base64.b64decode(img)


class Flagged(RuntimeError):
    pass


def cf_klein(prompt, width, height, input_png=None, retries=3, seed=SEED):
    acc = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    tok = os.environ["CLOUDFLARE_API_TOKEN"]
    url = f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/{KLEIN}"
    for attempt in range(retries):
        files = {
            "prompt": (None, prompt),
            "width": (None, str(width)),
            "height": (None, str(height)),
            "seed": (None, str(seed)),
        }
        if input_png is not None:
            files["input_image_0"] = ("in.png", input_png, "image/png")
        resp = requests.post(url, headers={"Authorization": f"Bearer {tok}"}, files=files, timeout=180)
        if resp.ok:
            return _decode(resp)
        print(f"  Cloudflare HTTP {resp.status_code}: {resp.text[:300]}", flush=True)
        if "flagged" in resp.text:
            raise Flagged(resp.text[:200])
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
            time.sleep(10 * (attempt + 1))
            continue
        raise RuntimeError(f"Cloudflare HTTP {resp.status_code}")
    raise RuntimeError("unerreichbar")


def pollinations(prompt, model, width, height):
    token = os.environ.get("POLLI_TOKEN", "").strip()
    url = f"https://gen.pollinations.ai/image/{urllib.parse.quote(prompt, safe='')}"
    params = {"model": model, "width": width, "height": height, "seed": SEED, "nologo": "true"}
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    resp = requests.get(url, params=params, headers=headers, timeout=240)
    if resp.ok and resp.headers.get("Content-Type", "").startswith("image/"):
        return resp.content
    raise RuntimeError(f"Pollinations {model} HTTP {resp.status_code}: {resp.text[:200]}")


def png_small(img):
    buf = io.BytesIO()
    img.convert("RGB").resize((IN_W, IN_H), Image.LANCZOS).save(buf, "PNG")
    return buf.getvalue()


def generate_stages(out):
    os.makedirs(out, exist_ok=True)
    base_path = os.path.join(out, "stage_00.png")
    if not os.path.exists(base_path):
        data = None
        for model in ("tongyi-mai/z-image-turbo", "flux"):
            try:
                print(f"Endbild ueber Pollinations ({model}) ...", flush=True)
                data = pollinations(BASE_PROMPT, model, 864, 1536)
                break
            except Exception as e:  # noqa: BLE001
                print(f"  {e}", flush=True)
        if data is None:
            print("Endbild ueber Cloudflare Klein ...", flush=True)
            data = cf_klein(BASE_PROMPT, GEN_W, GEN_H)
        Image.open(io.BytesIO(data)).convert("RGB").save(base_path)

    prev = Image.open(base_path).convert("RGB")
    for i, step in enumerate(REMOVE_STEPS, start=1):
        path = os.path.join(out, f"stage_{i:02d}.png")
        if os.path.exists(path):
            prev = Image.open(path).convert("RGB")
            continue
        print(f"Stufe {i}/{len(REMOVE_STEPS)}: {step[:70]}", flush=True)
        data = None
        for seed in (SEED, SEED + 1, SEED + 2):
            try:
                data = cf_klein(step + KEEP, GEN_W, GEN_H, input_png=png_small(prev), seed=seed)
                break
            except Flagged:
                print("  Filter-Fehlalarm, neuer Seed ...", flush=True)
        if data is None:
            print("  Stufe uebersprungen.", flush=True)
            continue
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.save(path)
        prev = img


# --------------------------------------------------------------------------- Video


def cover(img, w=W, h=H):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def grow_masks(a, b, parts, rng):
    """Masken, mit denen der Unterschied a->b von unten nach oben in `parts` Schritten waechst."""
    da = np.asarray(a.convert("L").filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    db = np.asarray(b.convert("L").filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    diff = np.abs(da - db)
    region = diff > max(18.0, np.percentile(diff, 70))
    region_img = Image.fromarray((region * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))
    region = np.asarray(region_img) > 0
    yy = np.linspace(1.0, 0.0, region.shape[0], dtype=np.float32)[:, None]  # unten = 0
    noise = np.asarray(
        Image.fromarray((rng.random((H // 40, W // 40)) * 255).astype(np.uint8)).resize(
            (W, H), Image.BICUBIC
        ),
        dtype=np.float32,
    ) / 255.0
    order = 0.75 * yy + 0.25 * noise
    masks = []
    for k in range(1, parts):
        m = region & (order <= k / parts)
        m_img = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
        masks.append(m_img)
    return masks


def jitter(img, rng, strength=1.0):
    """Leichtes Wackeln + Lichtflackern wie bei einer Zeitraffer-Kamera."""
    s = 1.02 + rng.uniform(-0.004, 0.004) * strength
    big = img.resize((round(W * s), round(H * s)), Image.BILINEAR)
    dx = (big.width - W) // 2 + round(rng.uniform(-5, 5) * strength)
    dy = (big.height - H) // 2 + round(rng.uniform(-5, 5) * strength)
    out = big.crop((dx, dy, dx + W, dy + H))
    out = ImageEnhance.Brightness(out).enhance(1 + rng.uniform(-0.035, 0.035) * strength)
    return out


def render(out, video_path, build_seconds=20.0, hold_seconds=6.0):
    files = sorted(f for f in os.listdir(out) if f.startswith("stage_") and f.endswith(".png"))
    stages = [cover(Image.open(os.path.join(out, f)).convert("RGB")) for f in reversed(files)]
    rng = np.random.default_rng(7)
    prng = random.Random(7)

    n_build_frames = round(build_seconds / FRAME_SECONDS)
    per_transition = max(2, n_build_frames // (len(stages) - 1))
    keyframes = []
    for a, b in zip(stages, stages[1:]):
        keyframes.append(a)
        for m in grow_masks(a, b, per_transition, rng):
            keyframes.append(Image.composite(b, a, m))
    keyframes.append(stages[-1])

    frames_dir = os.path.join(out, "_frames")
    os.makedirs(frames_dir, exist_ok=True)
    for f in os.listdir(frames_dir):
        os.remove(os.path.join(frames_dir, f))
    idx = 0
    hold_frames = round(FRAME_SECONDS * FPS)
    for kf in keyframes[:-1]:
        img = jitter(kf, prng)
        for _ in range(hold_frames):
            img.save(os.path.join(frames_dir, f"{idx:05d}.jpg"), quality=92)
            idx += 1
    # Kurzer Lichtblitz und dann ruhiger, langsamer Zoom auf das fertige Modell.
    final = stages[-1]
    n_hold = round(hold_seconds * FPS)
    for k in range(n_hold):
        t = k / max(1, n_hold - 1)
        s = 1.0 + 0.08 * t
        big = final.resize((round(W * s), round(H * s)), Image.LANCZOS)
        x, y = (big.width - W) // 2, (big.height - H) // 2
        frame = big.crop((x, y, x + W, y + H))
        if k < 4:
            frame = ImageEnhance.Brightness(frame).enhance(1.5 - 0.12 * k)
        frame.save(os.path.join(frames_dir, f"{idx:05d}.jpg"), quality=92)
        idx += 1

    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
            "-i", os.path.join(frames_dir, "%05d.jpg"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart",
            video_path,
        ],
        check=True,
    )
    print(f"Video: {video_path} ({idx / FPS:.1f} s, {len(keyframes)} Zeitraffer-Bilder "
          f"aus {len(stages)} KI-Bildern)", flush=True)

    # Kontaktbogen aller KI-Stufen zur schnellen Kontrolle.
    th_w, th_h = 216, 384
    cols = 8
    rows = (len(stages) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * th_w, rows * th_h), "black")
    for i, st in enumerate(stages):
        sheet.paste(st.resize((th_w, th_h)), ((i % cols) * th_w, (i // cols) * th_h))
    sheet.save(os.path.join(out, "contact_sheet.jpg"), quality=88)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="experiments/matchstick/out")
    ap.add_argument("--render-only", action="store_true")
    args = ap.parse_args()
    if not args.render_only:
        generate_stages(args.out)
    render(args.out, os.path.join(args.out, "matchstick_timelapse.mp4"))
    with open(os.path.join(args.out, "info.json"), "w") as f:
        json.dump({"subject": SUBJECT, "base_prompt": BASE_PROMPT, "steps": REMOVE_STEPS}, f, indent=1)


if __name__ == "__main__":
    sys.exit(main())
