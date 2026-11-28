"""Fadenbild-Reel automatisch erstellen: Motiv waehlen -> Vorlage erzeugen -> Video rendern ->
Vorschau per Telegram (Freigabe) -> next_post.json fuer publish.py.

Motive (content/string_art/motifs.json), gewichtet gemischt:
  trending   was gerade gefragt ist: meistgelesene Wikipedia-Artikel (de + en) von gestern,
             per KI auf geeignete Motive gefiltert (Personen der Popkultur, Figuren, Tiere, Bauwerke)
  superhero  Marvel / DC / Star Wars - realistisch statt Comic
  game       GTA 6
  animal, icon, building   Tiere, Ikonen (Kunst, Geschichte), Bauwerke
  illusion   Wurmloch / 3D-Kugel (ohne Vorlage, aus Kreis-Sehnen)

Die Vorlage wird als kontrastreiches Schwarz-Weiss-Portraet vor hellem Studio-Hintergrund erzeugt
(Cloudflare FLUX-2 Klein, Ersatz Pollinations) - so wird das Fadenbild am deutlichsten.

Nutzung:
  python scripts/string_post.py --target 11:07            (Termin UTC; Freigabe bis dahin)
  python scripts/string_post.py --wait-minutes 15
  python scripts/string_post.py --preview                 (nur rendern, nie posten, Log unveraendert)
  python scripts/string_post.py --preview --motif batman
  python scripts/string_post.py --preview --kind trending
"""

import argparse
import base64
import io
import json
import os
import random
import re
import secrets
import sys
import urllib.parse
from datetime import datetime, timedelta, timezone

import requests
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import string_art as sa  # noqa: E402

ROOT = sa.ROOT
CONFIG = os.path.join(ROOT, "content", "string_art", "motifs.json")
LOG = os.path.join(ROOT, "string_art_posted_log.json")
OUT = os.path.join(ROOT, "assets", "string_art", "out")
MEDIA_BRANCH = "string-art-media"
MAX_REROLLS = 2
NO_REPEAT_DAYS = 30
UA = {"User-Agent": "IGautomation-stringart/1.0 (GitHub Actions)"}

PORTRAIT_PROMPT = (
    "{subject}, photorealistic cinematic close-up portrait, head and shoulders, the face fills most of "
    "the frame and is centered, dramatic high-contrast black and white photograph, strong soft key light "
    "from the side, deep shadows, crisp details, plain pure white seamless studio background, no text"
)
SUPERHERO_PROMPT = (
    "realistic live-action movie still of {subject}, photorealistic close-up portrait, head and shoulders "
    "centered and filling most of the frame, dramatic high-contrast black and white photograph, strong key "
    "light, deep shadows, crisp details, plain pure white seamless studio background, no text, no logo"
)
ANIMAL_PROMPT = (
    "{subject}, photorealistic close-up wildlife portrait, the head fills most of the frame and is centered, "
    "dramatic high-contrast black and white photograph, crisp fur details, plain pure white background"
)
BUILDING_PROMPT = (
    "{subject}, dramatic high-contrast black and white photograph, centered, crisp architectural details, "
    "plain bright white overcast sky, nothing else in the picture"
)


# =========================================================================== Motivwahl


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def recent_ids(log, days=NO_REPEAT_DAYS):
    cut = datetime.now(timezone.utc) - timedelta(days=days)
    out = set()
    for e in log.get("posts", []) + log.get("skipped", []):
        try:
            if datetime.fromisoformat(e["date"]) >= cut:
                out.add(e["id"])
        except (KeyError, ValueError):
            continue
    return out


def cf_chat(prompt):
    """KI-Text: Cloudflare Workers AI, bei Fehler/erschoepftem Kontingent Pollinations."""
    try:
        return _cf_chat(prompt)
    except Exception as e:  # noqa: BLE001
        print(f"Cloudflare-Text nicht verfuegbar ({e}) - Pollinations als Ersatz.")
    token = os.environ.get("POLLI_TOKEN", "").strip()
    last = None
    for model in ("openai", "mistral"):
        try:
            r = requests.post("https://gen.pollinations.ai/v1/chat/completions", timeout=120,
                              headers={"Authorization": f"Bearer {token}"} if token else {},
                              json={"model": model, "messages": [{"role": "user", "content": prompt}],
                                    "temperature": 0.3})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(f"Kein KI-Text verfuegbar: {last}")


def _cf_chat(prompt):
    acc, tok = os.environ.get("CLOUDFLARE_ACCOUNT_ID"), os.environ.get("CLOUDFLARE_API_TOKEN")
    if not acc or not tok:
        raise RuntimeError("Cloudflare-Zugang fehlt")
    url = f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    resp = requests.post(url, headers={"Authorization": f"Bearer {tok}"}, timeout=120,
                         json={"messages": [{"role": "user", "content": prompt}], "max_tokens": 1500,
                               "temperature": 0.3})
    resp.raise_for_status()
    res = resp.json().get("result", {})
    out = res.get("response")
    return json.dumps(out) if isinstance(out, (dict, list)) else (out or "")


TREND_PROMPT = """Here are yesterday's most viewed Wikipedia articles:
{titles}

Pick up to 4 that would make a striking black-and-white string-art PORTRAIT for Instagram and that
people currently care about. Allowed: actors, musicians, athletes, other pop-culture celebrities,
fictional characters (movies, series, games, comics), animals, famous landmarks.
NOT allowed: politicians, people known for crimes, victims, people in the news because of death,
illness or scandal, minors, private persons, events, lists, countries, abstract topics.
For each pick give a short English visual description of the subject's typical look (hair, beard,
glasses, costume...) without inventing details you are unsure about.
Answer ONLY with JSON: {{"picks": [{{"title": "...", "kind": "person|character|animal|building",
"subject_en": "...", "title_en": "..."}}]}}"""


def trending_motifs(avoid):
    titles = []
    day = datetime.now(timezone.utc) - timedelta(days=1)
    for lang in ("en", "de"):
        url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/{lang}.wikipedia/all-access/"
               f"{day:%Y/%m/%d}")
        try:
            r = requests.get(url, headers=UA, timeout=30)
            r.raise_for_status()
            arts = r.json()["items"][0]["articles"]
        except Exception as e:  # noqa: BLE001
            print(f"Trends ({lang}) nicht abrufbar: {e}")
            continue
        skip = re.compile(
            r"^(Spezial|Special|Wikipedia|Datei|File|Hauptseite|Main_Page|Portal|Liste|List_of)", re.I)
        titles += [a["article"].replace("_", " ") for a in arts[:60] if not skip.match(a["article"])]
    if not titles:
        return []
    try:
        answer = cf_chat(TREND_PROMPT.format(titles="\n".join(titles)))
        data = json.loads(re.search(r"\{.*\}", answer, re.S).group(0))
    except Exception as e:  # noqa: BLE001
        print(f"Trend-Auswahl per KI fehlgeschlagen: {e}")
        return []
    out = []
    for p in data.get("picks", []):
        mid = "trend_" + re.sub(r"[^a-z0-9]+", "_", p.get("title", "").lower()).strip("_")
        if not p.get("subject_en") or mid in avoid:
            continue
        kind = {"animal": "animal", "building": "building"}.get(p.get("kind"), "trending")
        out.append({"id": mid, "kind": kind, "trend": True, "title": p.get("title_en") or p["title"],
                    "subject": p["subject_en"], "tags": [re.sub(r"\W+", "", p["title"].lower())]})
    return out


def pick_motif(cfg, log, rng, kind=None, motif_id=None, exclude=()):
    avoid = recent_ids(log) | set(exclude)
    motifs = cfg["motifs"]
    if motif_id:
        return next(m for m in motifs if m["id"] == motif_id)
    weights = dict(cfg["weights"])
    for _ in range(6):
        k = kind or rng.choices(list(weights), weights=list(weights.values()))[0]
        if k == "trending":
            cands = trending_motifs(avoid)
        else:
            cands = [m for m in motifs if m["kind"] == k and (m["id"] not in avoid or k == "illusion")]
        if cands:
            return rng.choice(cands[:2] if k == "trending" else cands)
        print(f"Keine freien Motive fuer '{k}' - andere Kategorie.")
        weights.pop(k, None)
        kind = None
        if not weights:
            break
    return rng.choice([m for m in motifs if m["kind"] != "illusion"])


# =========================================================================== Vorlage erzeugen


def prompt_for(m):
    tmpl = {"superhero": SUPERHERO_PROMPT, "game": PORTRAIT_PROMPT, "animal": ANIMAL_PROMPT,
            "building": BUILDING_PROMPT}.get(m["kind"], PORTRAIT_PROMPT)
    return tmpl.format(subject=m["subject"])


def gen_pollinations(prompt, model, seed):
    token = os.environ.get("POLLI_TOKEN", "").strip()
    url = f"https://gen.pollinations.ai/image/{urllib.parse.quote(prompt, safe='')}"
    params = {"model": model, "width": 1024, "height": 1024, "seed": seed, "nologo": "true"}
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.get(url, params=params, headers=headers, timeout=240)
    if r.ok and r.headers.get("Content-Type", "").startswith("image/"):
        return r.content
    raise RuntimeError(f"Pollinations {model}: HTTP {r.status_code} {r.text[:150]}")


def gen_cloudflare(prompt, seed):
    acc, tok = os.environ["CLOUDFLARE_ACCOUNT_ID"], os.environ["CLOUDFLARE_API_TOKEN"]
    url = f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/@cf/black-forest-labs/flux-2-klein-4b"
    form = {"prompt": prompt, "width": 1024, "height": 1024, "seed": seed}
    files = {k: (None, str(v)) for k, v in form.items()}
    r = requests.post(url, headers={"Authorization": f"Bearer {tok}"}, files=files, timeout=180)
    r.raise_for_status()
    if r.headers.get("content-type", "").startswith("image/"):
        return r.content
    return base64.b64decode(r.json()["result"]["image"])


def make_template(m, path, rng):
    prompt = prompt_for(m)
    seed = rng.randint(1, 2**31 - 1)
    errors = []
    # Zuerst Cloudflare (Gratis-Kontingent), Pollinations (Pollen-Guthaben) nur als Ersatz
    for name, fn in (("cloudflare:klein", lambda: gen_cloudflare(prompt, seed)),
                     ("pollinations:flux", lambda: gen_pollinations(prompt, "flux", seed)),
                     ("pollinations:z-image",
                      lambda: gen_pollinations(prompt, "tongyi-mai/z-image-turbo", seed))):
        try:
            data = fn()
            Image.open(io.BytesIO(data)).convert("RGB").save(path)
            print(f"Vorlage: {name}")
            return name
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
            print(f"  {name} fehlgeschlagen: {e}")
    raise RuntimeError("Keine Vorlage erzeugt: " + " | ".join(errors))


# =========================================================================== Video + Text


ILLUSION_PALETTES = [
    [(20, 20, 25), (40, 110, 180), (20, 20, 25), (200, 60, 45), (20, 20, 25)],
    [(20, 20, 25), (215, 150, 30), (20, 20, 25), (40, 150, 90), (20, 20, 25)],
    [(30, 30, 60), (120, 60, 160), (30, 30, 60), (220, 80, 120), (20, 20, 25)],
]


def build_spec(m, template, rng):
    import string_figures as sf

    if m["kind"] == "illusion":
        pal = rng.choice(ILLUSION_PALETTES)
        if m.get("figure") == "sphere":
            spec = sf.circle_sphere()
            spec["colors"] = [pal[0]] * (len(spec["colors"]) - 3) + [pal[3]] * 3
        else:
            sx, sy = rng.choice([(1, -1), (-1, -1), (1, 1), (-1, 1)])
            layers = [(sx * ox, sy * abs(oy), r, pal[k % len(pal)]) for k, (ox, oy, r, _) in enumerate([
                (0.00, 0.00, 0.62, 0), (0.08, 0.05, 0.48, 0), (0.17, 0.10, 0.35, 0), (0.26, 0.15, 0.23, 0),
                (0.33, 0.19, 0.12, 0)])]
            spec = sf.circle_wormhole(layers=layers)
        return spec, "circle"
    shape = "circle" if rng.random() < 0.75 else "square"
    crop = (0.5, 0.5, 0.95) if m["kind"] == "building" else (0.5, 0.45, 0.85)
    spec = sa.style_portrait(template, shape=shape, center=crop[:2], scale=crop[2], preset="ultra")
    return spec, shape


def caption_for(m, spec):
    n_nails, n_threads = len(spec["nails"]), len(spec["segs"])
    hook = rng_choice([
        f"{m['title']} – made from nails and a single thread 🧵",
        f"{n_nails} nails. {n_threads} lines of thread. Can you tell who it is? 👀",
        f"Thread by thread … {m['title']} appears 🧵",
        f"Hard to believe this is just thread. {m['title']} 🔨🧵",
    ])
    if m["kind"] == "illusion":
        hook = rng_choice(["Only straight threads – and your brain still sees 3D 🤯",
                           f"{n_threads} straight lines. Not a single curve. 🌀"])
    tags = ["#stringart", "#threadart", "#nailart", "#satisfying", "#oddlysatisfying", "#art", "#diy",
            "#artwork", "#portrait", "#asmr"] + [f"#{t}" for t in m.get("tags", [])]
    from common import support_line

    support = support_line("string_art")
    return (f"{hook}\n\n{n_nails} nails · {n_threads} lines of thread · calculated line by line.\n\n"
            f"Who or what should I make next? Tell me in the comments 👇\n\n"
            + (f"{support}\n\n" if support else "")
            + " ".join(dict.fromkeys(tags)))


_rng = random.Random()


def rng_choice(xs):
    return _rng.choice(xs)


def produce(m, rng, workdir):
    os.makedirs(workdir, exist_ok=True)
    template, source = None, None
    if m["kind"] != "illusion":
        template = os.path.join(workdir, f"vorlage_{m['id']}.png")
        source = make_template(m, template, rng)
    spec, shape = build_spec(m, template, rng)
    panel = rng.choice(["panel_white", "panel_white", "panel_natural"])
    name = f"reel_{m['id']}_{datetime.now(timezone.utc):%Y%m%d_%H%M}"
    video = sa.render(spec, "dark_walnut", panel, shape, workdir, name)
    with open(os.path.join(workdir, f"{name}.json")) as f:
        info = json.load(f)
    post = {
        "type": "reel", "file": os.path.basename(video), "branch": MEDIA_BRANCH,
        "thumb_offset": int((info["seconds"] - 2.0) * 1000),  # Titelbild = fertiges Bild
        "caption": caption_for(m, spec), "motif": m["id"], "kind": m["kind"], "title": m["title"],
        "template_source": source, "nails": len(spec["nails"]), "threads": len(spec["segs"]),
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    return video, post


# =========================================================================== Telegram


def telegram():
    import people_review as pr

    token = (os.environ.get("STRINGART_TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
             or "").strip()
    chat = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    if not token or not chat:
        return None

    class TG(pr.Telegram):
        def send_video(self, path, caption, tok):
            kb = {"inline_keyboard": [[{"text": "✅ Jetzt posten", "callback_data": f"{pr.APPROVE}:{tok}"}],
                                      [{"text": "🔄 Anderes Motiv", "callback_data": f"{pr.REROLL}:{tok}"},
                                       {"text": "❌ Auslassen", "callback_data": f"{pr.REJECT}:{tok}"}]]}
            with open(path, "rb") as f:
                msg = self.call("sendVideo", files={"video": (os.path.basename(path), f, "video/mp4")},
                                http_timeout=300, chat_id=self.chat_id, caption=caption[:1024],
                                supports_streaming="true", reply_markup=json.dumps(kb))
            return msg["message_id"]

    return TG(token, chat)


def write_output(**kv):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            f.writelines(f"{k}={v}\n" for k, v in kv.items())
    print(kv)


def main():
    import people_review as pr

    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--target", help="Posting-Termin HH:MM (UTC)")
    g.add_argument("--wait-minutes", type=float)
    g.add_argument("--preview", action="store_true", help="nur rendern + per Telegram zeigen, nie posten")
    ap.add_argument("--motif")
    ap.add_argument("--kind")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    cfg = load_json(CONFIG, {})
    log = load_json(LOG, {"posts": [], "skipped": []})
    rng = random.Random()
    now = datetime.now(timezone.utc)
    if args.target:
        hh, mm = map(int, args.target.split(":"))
        deadline = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if deadline < now - timedelta(minutes=5):
            deadline += timedelta(days=1)
    else:
        deadline = now + timedelta(minutes=args.wait_minutes or 0)

    tg = telegram()
    if tg:
        tg.skip_old_updates()
    tried = []
    for attempt in range(MAX_REROLLS + 1):
        m = pick_motif(cfg, log, rng, kind=args.kind if attempt == 0 else None,
                       motif_id=args.motif if attempt == 0 else None, exclude=tried)
        tried.append(m["id"])
        print(f"Motiv: {m['title']} ({m['kind']})")
        try:
            video, post = produce(m, rng, args.out)
        except Exception as e:  # noqa: BLE001
            print(f"Erstellung fehlgeschlagen: {e}")
            continue
        with open(os.path.join(args.out, "next_post.json"), "w", encoding="utf-8") as f:
            json.dump(post, f, ensure_ascii=False, indent=2)
        if args.preview:
            if tg:
                text = f"🧵 Vorschau (wird nicht gepostet): {m['title']}\n\n{post['caption']}"
                tg.send_video(video, text, "x")
            write_output(publish="false", motif=m["id"])
            return
        decision = pr.APPROVE
        if tg:
            tok = secrets.token_hex(4)
            left = max(1, int((deadline - datetime.now(timezone.utc)).total_seconds() // 60))
            msg = tg.send_video(video, f"🧵 Fadenbild: {m['title']} – postet automatisch in ~{left} Min.\n\n"
                                       f"{post['caption']}", tok)
            decision = tg.wait_for_decision(tok, deadline) or pr.APPROVE
            tg.set_status(msg, {pr.APPROVE: "✅ Wird gepostet", pr.REROLL: "🔄 Anderes Motiv kommt",
                                pr.REJECT: "❌ Ausgelassen"}[decision])
        if decision == pr.APPROVE:
            log["posts"].append({"id": m["id"], "date": now.isoformat(timespec="seconds"),
                                 "title": m["title"]})
            with open(LOG, "w", encoding="utf-8") as f:
                json.dump(log, f, ensure_ascii=False, indent=1)
            write_output(publish="true", motif=m["id"], video=os.path.relpath(video, ROOT))
            return
        log["skipped"].append({"id": m["id"], "date": now.isoformat(timespec="seconds")})
        with open(LOG, "w", encoding="utf-8") as f:
            json.dump(log, f, ensure_ascii=False, indent=1)
        if decision == pr.REJECT or datetime.now(timezone.utc) >= deadline:
            break
    write_output(publish="false")


if __name__ == "__main__":
    main()
