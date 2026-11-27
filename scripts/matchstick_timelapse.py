"""Prototyp: "Zeitraffer"-Video eines Modells aus Streichhoelzern, rein aus KI-Bildern.

v3: VORWAERTS bauen (leerer Tisch -> Stufe fuer Stufe hinzufuegen), Hintergrund ausserhalb des
Baubereichs bleibt pixelgenau gleich. Die Beschreibung unten ist der urspruengliche Plan (v1).

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

KLEIN_BIG = "@cf/black-forest-labs/flux-2-klein-9b"  # staerker, ~5x teurer - nur als Reserve

SUBJECT = "Eiffel Tower"
PLATE_PROMPT = (
    "Photorealistic photo of a plain light oak workbench seen from slightly above, the center of the "
    "table is completely empty, a neat pile of loose wooden matchsticks with red heads, an open "
    "matchbox and a small tube of wood glue lie in the lower left corner of the table, plain light "
    "grey wall in the background, warm soft window light from the left, vertical composition, "
    "sharp focus, no people, no hands, no model, no objects in the center"
)
KEEP = (
    " Keep everything that is already built exactly as it is and only add the new part. Everything "
    "is made of raw unpainted wooden matchsticks in natural light wood color, glued together. Keep "
    "the camera angle, framing, table, wall and lighting exactly the same. Photorealistic photo."
)
# Vorwaerts bauen: jede Stufe fuegt etwas zum vorherigen Bild hinzu (Hinzufuegen koennen
# Bildmodelle viel besser als Entfernen).
BUILD_STEPS = [
    "In the center of the table, add a flat square base plate made of wooden matchsticks laid "
    "side by side.",
    "On the matchstick base plate, add the four short feet of a tower at the four corners, each foot "
    "is a small lattice of crossed wooden matchsticks.",
    "Make the four matchstick legs taller, leaning inward toward each other, built as a lattice of "
    "crossed matchsticks.",
    "Connect the four matchstick legs with a first square platform made of matchsticks, with a wide "
    "arch below it.",
    "On top of the first platform, add the next section of the matchstick lattice tower, narrowing "
    "upward.",
    "Add a second, smaller square platform made of matchsticks on top of the tower.",
    "Above the second platform, continue the tower upward as a tall, slender lattice of matchsticks.",
    "Make the slender matchstick lattice tower even taller and narrower toward the top.",
    "Add a small top platform and a pointed spire made of matchsticks at the very top. It is now a "
    "complete Eiffel Tower model made of wooden matchsticks.",
    "Add fine details to the matchstick Eiffel Tower: more crossed matchstick bracing in the lattice "
    "and small red match heads as decoration along the platform edges.",
]
# Bereich, in dem gebaut wird (Anteile der Bildbreite/-hoehe). Ausserhalb bleibt jedes Bild
# pixelgenau der leere Tisch.
BUILD_BOX = (0.14, 0.06, 0.86, 0.80)


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


def cf_klein(prompt, width, height, input_png=None, retries=3, seed=SEED, model=KLEIN):
    acc = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    tok = os.environ["CLOUDFLARE_API_TOKEN"]
    url = f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/{model}"
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


def png_fit(img, max_side=512):
    """Eingabebild fuer Klein (max. 512 px Kantenlaenge)."""
    k = min(1.0, max_side / max(img.size))
    buf = io.BytesIO()
    img.convert("RGB").resize((round(img.width * k), round(img.height * k)), Image.LANCZOS).save(buf, "PNG")
    return buf.getvalue()


def out_size(w, h, max_side=1024):
    k = max_side / max(w, h)
    return max(256, round(w * k / 16) * 16), max(256, round(h * k / 16) * 16)


def klein_edit(prompt, img, max_side=1024, model=KLEIN):
    """Bearbeitet `img` mit Klein (Seed-Wechsel bei Filter-Fehlalarm) und liefert es in Originalgroesse."""
    ow, oh = out_size(img.width, img.height, max_side)
    for seed in (SEED, SEED + 1, SEED + 2):
        try:
            data = cf_klein(prompt, ow, oh, input_png=png_fit(img), seed=seed, model=model)
            return Image.open(io.BytesIO(data)).convert("RGB").resize(img.size, Image.LANCZOS)
        except Flagged:
            print("  Filter-Fehlalarm, neuer Seed ...", flush=True)
    return None


def model_box(base, empty):
    """Bereich des Modells = deutlichster Unterschied zwischen Endbild und leerem Tisch (+ Rand).
    Ist das unplausibel (fast das ganze Bild), gilt die Bildmitte, wo das Modell laut Prompt steht."""
    bw, bh = base.size
    fallback = (int(bw * 0.06), int(bh * 0.18), int(bw * 0.94), int(bh * 0.76))
    da = np.asarray(base.convert("L").filter(ImageFilter.GaussianBlur(8)), dtype=np.float32)
    db = np.asarray(empty.convert("L").filter(ImageFilter.GaussianBlur(8)), dtype=np.float32)
    diff = np.abs(da - db)
    m = diff > max(30.0, np.percentile(diff, 85))
    m_img = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))
    m = np.asarray(m_img.filter(ImageFilter.MaxFilter(9))) > 0
    ys, xs = np.nonzero(m)
    if len(xs) < 2000:
        return fallback
    x0, x1 = np.percentile(xs, [2, 98])
    y0, y1 = np.percentile(ys, [2, 98])
    px, py = (x1 - x0) * 0.12 + 20, (y1 - y0) * 0.12 + 20
    box = (max(0, int(x0 - px)), max(0, int(y0 - py)), min(bw, int(x1 + px)), min(bh, int(y1 + py)))
    if (box[2] - box[0]) * (box[3] - box[1]) > 0.7 * bw * bh:
        return fallback
    return box


def color_match(img, ref, border=24):
    """Farben/Helligkeit an `ref` angleichen, gemessen am Rand (dort ist nur Tisch/Wand)."""
    a = np.asarray(img, dtype=np.float32)
    r = np.asarray(ref, dtype=np.float32)
    mask = np.zeros(a.shape[:2], bool)
    mask[:border, :] = mask[-border:, :] = True
    mask[:, :border] = mask[:, -border:] = True
    out = a.copy()
    for c in range(3):
        am, asd = a[..., c][mask].mean(), a[..., c][mask].std() + 1e-3
        rm, rsd = r[..., c][mask].mean(), r[..., c][mask].std() + 1e-3
        out[..., c] = (a[..., c] - am) * (rsd / asd) + rm
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def paste_back(base, crop_img, box):
    """Bearbeiteten Ausschnitt mit weicher Kante ins (unveraenderte) Endbild setzen."""
    w, h = box[2] - box[0], box[3] - box[1]
    feather = max(8, min(w, h) // 12)
    mask = Image.new("L", (w, h), 0)
    inner = Image.new("L", (w - 2 * feather, h - 2 * feather), 255)
    mask.paste(inner, (feather, feather))
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    out = base.copy()
    out.paste(crop_img, box[:2], mask)
    return out


def changed(a, b):
    """Anteil (%) der Pixel, die sich deutlich veraendert haben (leichtes Rauschen zaehlt nicht)."""
    da = np.asarray(a.convert("L").filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    db = np.asarray(b.convert("L").filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    return float((np.abs(da - db) > 30).mean() * 100)


def generate_stages(out):
    os.makedirs(out, exist_ok=True)
    plate_path = os.path.join(out, "stage_00.png")
    if not os.path.exists(plate_path):
        data = None
        for model in ("tongyi-mai/z-image-turbo", "flux"):
            try:
                print(f"Leerer Tisch ueber Pollinations ({model}) ...", flush=True)
                data = pollinations(PLATE_PROMPT, model, 864, 1536)
                break
            except Exception as e:  # noqa: BLE001
                print(f"  {e}", flush=True)
        if data is None:
            print("Leerer Tisch ueber Cloudflare Klein ...", flush=True)
            data = cf_klein(PLATE_PROMPT, GEN_W, GEN_H)
        Image.open(io.BytesIO(data)).convert("RGB").save(plate_path)
    plate = Image.open(plate_path).convert("RGB")
    bw, bh = plate.size
    box = (int(bw * BUILD_BOX[0]), int(bh * BUILD_BOX[1]), int(bw * BUILD_BOX[2]), int(bh * BUILD_BOX[3]))
    ref_crop = plate.crop(box)
    prev_crop = ref_crop
    log = []
    for i, step in enumerate(BUILD_STEPS, start=1):
        path = os.path.join(out, f"stage_{i:02d}.png")
        if os.path.exists(path):
            prev_crop = Image.open(path).convert("RGB").crop(box)
            continue
        print(f"Stufe {i}/{len(BUILD_STEPS)}: {step[:70]}", flush=True)
        edited, used = klein_edit(step + KEEP, prev_crop), KLEIN
        # Hat das kleine Modell (fast) nichts veraendert, einmal mit dem grossen versuchen.
        if edited is None or changed(edited, prev_crop) < 0.7:
            print("  kaum Aenderung -> Klein 9B", flush=True)
            big = klein_edit(step + KEEP, prev_crop, model=KLEIN_BIG)
            if big is not None:
                edited, used = big, KLEIN_BIG
        if edited is None:
            print("  Stufe uebersprungen.", flush=True)
            continue
        diff = changed(edited, prev_crop)
        print(f"  Aenderung {diff:.1f} ({used.split('/')[-1]})", flush=True)
        log.append({"stage": i, "model": used, "change": round(diff, 1)})
        edited = color_match(edited, ref_crop)
        paste_back(plate, edited, box).save(path)
        prev_crop = edited
    with open(os.path.join(out, "stages_log.json"), "w") as f:
        json.dump(log, f, indent=1)


# --------------------------------------------------------------------------- v4: Pollinations

POLLI_BASE = "https://gen.pollinations.ai"
# Starke Bearbeitungsmodelle (Pollen-Guthaben). Reihenfolge = Vorzug; per POLLI_EDIT_MODEL ueberschreibbar.
EDIT_MODEL_PREFS = [
    "google/gemini-2.5-flash-image",
    "bytedance/seedream-4.5",
    "black-forest-labs/flux.1-kontext-pro",
    "openai/gpt-image-1.5",
]
TARGET_PROMPT = (
    "Add a complete, highly detailed miniature model of the Eiffel Tower in the center of the table, "
    "built entirely from raw unpainted wooden matchsticks glued together: four curved lattice legs "
    "with crossed matchstick bracing, a wide arch between the legs, two square platforms and a "
    "slender lattice top with a small spire, all clearly made of individual matchsticks, a few red "
    "match heads as decoration. The model stands on a flat base plate made of matchsticks laid side "
    "by side. Keep the table, wall, lighting, camera angle, matchbox, glue and loose matchsticks "
    "exactly the same. Photorealistic photo."
)
STEP_TEMPLATE = (
    "Image 1 shows the current building progress, image 2 shows the finished matchstick model. "
    "Edit image 1: {step} Build it exactly in the shape and style of the finished model in image 2, "
    "but ONLY this step - nothing above it exists yet. Keep everything already built in image 1 "
    "exactly as it is. Same camera angle, framing, table, wall and lighting as image 1. Raw unpainted "
    "wooden matchsticks. Photorealistic photo."
)
FORWARD_STEPS = BUILD_STEPS[:8]  # danach folgt das Zielbild als letzte Stufe


def polli_headers():
    return {"Authorization": f"Bearer {os.environ.get('POLLI_TOKEN', '').strip()}"}


def polli_models(out):
    """Modell-/Preisliste speichern und Bearbeitungsmodelle mit Bildeingabe zurueckgeben."""
    try:
        resp = requests.get(f"{POLLI_BASE}/image/models", headers=polli_headers(), timeout=60)
        data = resp.json()
    except Exception as e:  # noqa: BLE001
        print(f"Modellliste nicht abrufbar: {e}", flush=True)
        return None
    with open(os.path.join(out, "polli_models.json"), "w") as f:
        json.dump(data, f, indent=1)
    items = data if isinstance(data, list) else data.get("data") or data.get("models") or []
    can_edit = set()
    for m in items:
        if not isinstance(m, dict):
            continue
        mid = m.get("id") or m.get("name")
        if "image" in (m.get("input_modalities") or []):
            can_edit.add(mid)
        if mid in EDIT_MODEL_PREFS:
            print(f"  {mid}: input={m.get('input_modalities')} preis={m.get('pricing')}", flush=True)
    return can_edit


def pick_edit_model(out):
    forced = os.environ.get("POLLI_EDIT_MODEL", "").strip()
    if forced:
        return [forced]
    can_edit = polli_models(out)
    prefs = [m for m in EDIT_MODEL_PREFS if not can_edit or m in can_edit]
    print(f"Bearbeitungsmodelle (in Reihenfolge): {prefs}", flush=True)
    return prefs or EDIT_MODEL_PREFS


def polli_edit(prompt, images, models, size, retries=2):
    """POST /v1/images/edits mit hochgeladenen Bildern; probiert die Modelle der Reihe nach."""
    w, h = size
    last = None
    for model in models:
        for attempt in range(retries):
            files = []
            for k, img in enumerate(images):
                buf = io.BytesIO()
                img.convert("RGB").save(buf, "PNG")
                files.append(("image", (f"img{k}.png", buf.getvalue(), "image/png")))
            data = {"prompt": prompt, "model": model, "size": f"{w}x{h}", "response_format": "b64_json"}
            try:
                resp = requests.post(f"{POLLI_BASE}/v1/images/edits", headers=polli_headers(),
                                     data=data, files=files, timeout=300)
            except requests.RequestException as e:
                last = str(e)
                continue
            if resp.ok:
                try:
                    item = resp.json()["data"][0]
                    raw = (base64.b64decode(item["b64_json"]) if item.get("b64_json")
                           else requests.get(item["url"], timeout=120).content)
                    return Image.open(io.BytesIO(raw)).convert("RGB"), model
                except Exception as e:  # noqa: BLE001
                    last = f"{model}: unerwartete Antwort {resp.text[:200]} ({e})"
            else:
                last = f"{model}: HTTP {resp.status_code} {resp.text[:300]}"
                if resp.status_code in (400, 401, 402, 403, 404, 422):
                    break  # naechstes Modell
            print(f"  {last}", flush=True)
            time.sleep(8)
        print(f"  {model} fehlgeschlagen: {last}", flush=True)
    raise RuntimeError(f"Kein Bearbeitungsmodell erfolgreich: {last}")


def generate_stages_polli(out):
    os.makedirs(out, exist_ok=True)
    models = pick_edit_model(out)
    log = []
    plate_path = os.path.join(out, "stage_00.png")
    if not os.path.exists(plate_path):
        print("Leerer Tisch (z-image-turbo) ...", flush=True)
        Image.open(io.BytesIO(pollinations(PLATE_PROMPT, "tongyi-mai/z-image-turbo", 864, 1536))) \
            .convert("RGB").save(plate_path)
    plate = Image.open(plate_path).convert("RGB")
    bw, bh = plate.size
    box = (int(bw * BUILD_BOX[0]), int(bh * BUILD_BOX[1]), int(bw * BUILD_BOX[2]), int(bh * BUILD_BOX[3]))
    ref_crop = plate.crop(box)
    size = out_size(*ref_crop.size, max_side=1536)

    n_final = len(FORWARD_STEPS) + 1
    final_path = os.path.join(out, f"stage_{n_final:02d}.png")
    if not os.path.exists(final_path):
        print("Zielbild (fertiges Modell) ...", flush=True)
        target, used = polli_edit(TARGET_PROMPT, [ref_crop], models, size)
        target = color_match(target.resize(ref_crop.size, Image.LANCZOS), ref_crop)
        paste_back(plate, target, box).save(final_path)
        log.append({"stage": n_final, "model": used})
        models = [used] + [m for m in models if m != used]  # beim funktionierenden Modell bleiben
    target_crop = Image.open(final_path).convert("RGB").crop(box)

    prev_crop = ref_crop
    for i, step in enumerate(FORWARD_STEPS, start=1):
        path = os.path.join(out, f"stage_{i:02d}.png")
        if os.path.exists(path):
            prev_crop = Image.open(path).convert("RGB").crop(box)
            continue
        print(f"Stufe {i}/{len(FORWARD_STEPS)}: {step[:70]}", flush=True)
        try:
            edited, used = polli_edit(STEP_TEMPLATE.format(step=step), [prev_crop, target_crop], models, size)
        except RuntimeError as e:
            print(f"  uebersprungen: {e}", flush=True)
            continue
        edited = color_match(edited.resize(ref_crop.size, Image.LANCZOS), ref_crop)
        diff = changed(edited, prev_crop)
        print(f"  Aenderung {diff:.1f} % ({used})", flush=True)
        log.append({"stage": i, "model": used, "change": round(diff, 1)})
        paste_back(plate, edited, box).save(path)
        prev_crop = edited
    with open(os.path.join(out, "stages_log.json"), "w") as f:
        json.dump(log, f, indent=1)


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
    stages = [cover(Image.open(os.path.join(out, f)).convert("RGB")) for f in files]
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
    ap.add_argument("--engine", choices=["cloudflare", "pollinations"], default="cloudflare")
    args = ap.parse_args()
    if not args.render_only:
        (generate_stages_polli if args.engine == "pollinations" else generate_stages)(args.out)
    render(args.out, os.path.join(args.out, "matchstick_timelapse.mp4"))
    with open(os.path.join(args.out, "info.json"), "w") as f:
        json.dump({"subject": SUBJECT, "plate_prompt": PLATE_PROMPT, "steps": BUILD_STEPS}, f, indent=1)


if __name__ == "__main__":
    sys.exit(main())
