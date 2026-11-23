"""Gemeinsame Helfer: Konfiguration, Verlauf, Claude, Bilder, Stimme, ffmpeg."""
import asyncio
import json
import os
import random
import re
import subprocess
import time
import urllib.parse
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
STATE = ROOT / "state" / "history.json"
OUT = ROOT / "output"
FONTS = ROOT / "assets" / "fonts"
MUSIC = ROOT / "assets" / "music"
BERLIN = ZoneInfo("Europe/Berlin")

CFG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))


def log(*a):
    print(f"[{datetime.now(BERLIN):%H:%M:%S}]", *a, flush=True)


# ---------------------------------------------------------------- Verlauf
def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {"verses": [], "stories": [], "story_count": 0, "posts": []}


def save_state(s):
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


def pick_unused(items, used_ids, rng=random):
    """Nimmt ein noch nicht benutztes Element; sind alle durch, beginnt der Zyklus neu."""
    free = [i for i in items if i["id"] not in used_ids]
    if not free:
        oldest = set(used_ids[: len(used_ids) // 2])  # ältere Hälfte wieder freigeben
        free = [i for i in items if i["id"] in oldest] or items
    return rng.choice(free)


def out_dir(kind):
    d = OUT / f"{datetime.now(BERLIN):%Y-%m-%d}_{kind}"
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------- Text-KI
# Standard: Cloudflare Workers AI (wie die anderen Accounts im Repo, kostenlos).
# Ist ANTHROPIC_API_KEY gesetzt, wird stattdessen Claude genutzt (bessere Texte).
CF_LLM_MODELS = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/zai-org/glm-4.7-flash",
    "@cf/google/gemma-4-26b-a4b-it",
]


def _extract_json(text):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("keine JSON-Antwort")
    return json.loads(text[start: end + 1], strict=False)  # erlaubt Zeilenumbrüche in Strings


def _claude(system, prompt):
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": CFG["claude"]["model"], "max_tokens": CFG["claude"]["max_tokens"],
              "system": system, "messages": [{"role": "user", "content": prompt}]},
        timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"Claude HTTP {r.status_code}: {r.text[:200]}")
    return "".join(b.get("text", "") for b in r.json()["content"])


def _cloudflare(system, prompt, model):
    acc, tok = os.environ.get("CLOUDFLARE_ACCOUNT_ID"), os.environ.get("CLOUDFLARE_API_TOKEN")
    if not acc or not tok:
        raise RuntimeError("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN fehlen")
    r = requests.post(
        f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/{model}",
        headers={"Authorization": f"Bearer {tok}"}, timeout=180,
        json={"messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
              "max_tokens": 2500, "temperature": 0.6},
    )
    if not r.ok:
        raise RuntimeError(f"{model}: HTTP {r.status_code} {r.text[:200]}")
    res = r.json().get("result", {})
    out = res.get("response")
    if out is None and res.get("choices"):
        out = res["choices"][0]["message"]["content"]
    return json.dumps(out, ensure_ascii=False) if isinstance(out, (dict, list)) else (out or "")


def _pollinations_text(system, prompt, model):
    key = (os.environ.get("POLLINATIONS_API_KEY") or os.environ.get("POLLINATIONS_TOKEN") or "").strip()
    if not key:
        raise RuntimeError("kein Pollinations-Key")
    r = requests.post(
        "https://gen.pollinations.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, timeout=180,
        json={"model": model, "temperature": 0.7,
              "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]},
    )
    if not r.ok:
        raise RuntimeError(f"Pollinations {model}: HTTP {r.status_code} {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"] or ""


POLLI_TEXT_MODELS = ["openai", "mistral"]


def llm_json(system, prompt, check=None):
    """Fragt die Text-KI nach JSON. check(obj) darf eine Liste von Problemen zurückgeben.
    Reihenfolge: Claude (falls Key) → Pollinations (POLLI_TOKEN) → Cloudflare Workers AI.
    Cloudflare zuletzt, weil sich alle Seiten im Repo dessen Gratis-Kontingent teilen."""
    def backends_for(pr):
        b = []
        if os.environ.get("ANTHROPIC_API_KEY"):
            b.append(("claude", lambda: _claude(system, pr)))
        for m in POLLI_TEXT_MODELS:
            b.append((f"pollinations/{m}", lambda m=m: _pollinations_text(system, pr, m)))
        for m in CF_LLM_MODELS:
            b.append((m, lambda m=m: _cloudflare(system, pr, m)))
        return b

    errors = []
    cf_dead = False
    for name, _ in backends_for(prompt):
        if cf_dead and name.startswith("@cf/"):
            continue
        pr = prompt
        for _ in range(3):
            call = dict(backends_for(pr))[name]
            try:
                obj = _extract_json(call())
                problems = check(obj) if check else []
                if not problems:
                    log("Text von", name)
                    return obj
                errors.append(f"{name}: {'; '.join(problems[:3])}")
                # Rückmeldung an das Modell und nochmal versuchen
                pr = (prompt + "\n\nDEIN LETZTER ENTWURF WAR UNGÜLTIG: " + "; ".join(problems)
                      + ". Halte die Vorgaben exakt ein (Wortzahl!) und antworte nur mit JSON.")
            except (ValueError, KeyError) as e:
                errors.append(f"{name}: {e}")
            except Exception as e:  # noqa: BLE001
                errors.append(f"{name}: {e}")
                if "daily free allocation" in str(e):
                    cf_dead = True
                break
    raise RuntimeError("Keine brauchbare KI-Antwort: " + " | ".join(errors[-4:]))


claude_json = llm_json  # alter Name


# ---------------------------------------------------------------- Bilder
_last_image = [0.0]


def _fit_and_clean(raw, path, w, h):
    """Unteren Rand (Wasserzeichen/Rahmen) abschneiden und exakt auf w×h bringen."""
    from io import BytesIO

    from PIL import Image
    im = Image.open(BytesIO(raw)).convert("RGB")
    cw, ch = im.size
    im = im.crop((int(cw * 0.03), int(ch * 0.02), int(cw * 0.97), int(ch * 0.93)))
    cw, ch = im.size
    scale = max(w / cw, h / ch)
    im = im.resize((round(cw * scale), round(ch * scale)), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    im.crop((left, top, left + w, top + h)).save(path, quality=94)
    return path


def generate_image(prompt, path, style, seed=None, retries=6):
    """style = (Kurz-Präfix, Details). Präfix steht vorne – so hält das Modell den Malstil besser ein."""
    ic = CFG["images"]
    prefix, details = style
    full = f"{prefix}: {prompt}. {details}"
    seed = seed if seed is not None else random.randint(1, 10_000_000)
    params = {"width": ic["width"], "height": ic["height"], "model": ic["model"],
              "nologo": "true", "seed": seed}
    token = (os.environ.get("POLLINATIONS_API_KEY") or os.environ.get("POLLINATIONS_TOKEN") or "").strip()
    if token:  # mit Key: volle Auflösung, kein Wasserzeichen, kein Tempolimit
        url = "https://gen.pollinations.ai/image/" + urllib.parse.quote(full)
        headers = {"Authorization": f"Bearer {token}"}
    else:      # ohne Key: kostenlos, aber 1 Bild/45 s und kleinere Auflösung
        url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(full)
        headers = {}
        wait = 47 - (time.time() - _last_image[0])
        if wait > 0:
            time.sleep(wait)
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=240)
            _last_image[0] = time.time()
            if r.ok and r.headers.get("content-type", "").startswith("image"):
                return _fit_and_clean(r.content, path, ic["width"], ic["height"])
            m = re.search(r"Retry after (\d+)s", r.text)
            delay = int(m.group(1)) + 3 if m else 15 * (attempt + 1)
            log("Bild-Fehler", r.status_code, r.text[:160], f"– neuer Versuch in {delay}s")
        except requests.RequestException as e:
            delay = 15 * (attempt + 1)
            log("Bild-Fehler", e)
        time.sleep(delay)
    log("Pollinations nicht erreichbar – versuche Cloudflare FLUX")
    return _cloudflare_image(full, path, ic["width"], ic["height"])


def _cloudflare_image(prompt, path, w, h):
    import base64
    acc, tok = os.environ.get("CLOUDFLARE_ACCOUNT_ID"), os.environ.get("CLOUDFLARE_API_TOKEN")
    if not acc or not tok:
        raise RuntimeError("Bildgenerierung fehlgeschlagen (kein Cloudflare-Zugang)")
    model = "@cf/black-forest-labs/flux-1-schnell"
    r = requests.post(f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/{model}",
                      headers={"Authorization": f"Bearer {tok}"}, json={"prompt": prompt[:2000], "steps": 8},
                      timeout=180)
    if not r.ok:
        raise RuntimeError(f"Cloudflare-Bild HTTP {r.status_code}: {r.text[:200]}")
    img = r.json().get("result", {}).get("image")
    if not img:
        raise RuntimeError("Cloudflare-Antwort ohne Bild")
    return _fit_and_clean(base64.b64decode(img), path, w, h)


# ---------------------------------------------------------------- Stimme
def tts(text, path):
    import edge_tts
    v = CFG["voice"]

    async def run():
        c = edge_tts.Communicate(text, v["name"], rate=v["rate"], pitch=v["pitch"])
        await c.save(str(path))

    for attempt in range(3):
        try:
            asyncio.run(run())
            return path
        except Exception as e:  # noqa: BLE001
            log("TTS-Fehler", e)
            time.sleep(5)
    raise RuntimeError("Sprachausgabe fehlgeschlagen")


# ---------------------------------------------------------------- ffmpeg
def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Befehl fehlgeschlagen: {' '.join(map(str, cmd))[:300]}\n{r.stderr[-1500:]}")
    return r.stdout


def duration(path):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=nw=1:nk=1", str(path)]).strip())


def random_music():
    files = sorted(list(MUSIC.glob("*.mp3")) + list(MUSIC.glob("*.m4a")) + list(MUSIC.glob("*.wav")))
    return random.choice(files) if files else None


def hashtags(extra=()):
    tags = list(CFG["hashtags"]["base"]) + list(extra)
    seen, out = set(), []
    for t in tags:
        t = t if t.startswith("#") else "#" + t
        if t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return " ".join(out[:15])
