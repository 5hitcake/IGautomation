"""Einmaliger Vergleichstest: erzeugt dasselbe Portrait mit allen kostenlosen
Bildmodellen (Cloudflare Workers AI + Pollinations) und speichert die
Ergebnisse unter assets/portrait_test/."""
import base64
import os
import time
import urllib.parse

import requests

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "assets", "portrait_test")

PROMPT = (
    "Candid street portrait photo of a 34-year-old Latin American woman with curly "
    "dark hair, light freckles, natural skin texture with visible pores, slight smile, "
    "wearing a mustard knit sweater, golden hour light in a European city street, "
    "shot on Fujifilm X-T4, 56mm f/1.2, shallow depth of field, subtle film grain, "
    "authentic, unretouched, photorealistic"
)

CF_MODELS = [
    "@cf/black-forest-labs/flux-2-dev",
    "@cf/black-forest-labs/flux-2-klein-9b",
    "@cf/black-forest-labs/flux-2-klein-4b",
    "@cf/black-forest-labs/flux-1-schnell",
    "@cf/leonardo/lucid-origin",
    "@cf/leonardo/phoenix-1.0",
    "@cf/bytedance/stable-diffusion-xl-lightning",
]


def _image_from_response(resp):
    ctype = resp.headers.get("content-type", "")
    if ctype.startswith("image/"):
        return resp.content
    data = resp.json()
    img = (data.get("result") or {}).get("image")
    if not img:
        raise RuntimeError(f"keine Bilddaten: {str(data)[:300]}")
    return base64.b64decode(img)


def cloudflare(model, account_id, token):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
    headers = {"Authorization": f"Bearer {token}"}
    if "flux-2" in model:
        form = {"prompt": PROMPT, "width": "896", "height": "1152"}
        resp = requests.post(url, headers=headers, files={k: (None, v) for k, v in form.items()}, timeout=180)
    else:
        payload = {"prompt": PROMPT, "width": 896, "height": 1152}
        if "schnell" in model:
            payload = {"prompt": PROMPT, "steps": 8}
        resp = requests.post(url, headers=headers, json=payload, timeout=180)
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    return _image_from_response(resp)


def pollinations():
    url = (
        "https://image.pollinations.ai/prompt/" + urllib.parse.quote(PROMPT)
        + "?width=896&height=1152&model=flux&nologo=true&seed=7"
    )
    for _ in range(4):
        resp = requests.get(url, timeout=180)
        if resp.ok and resp.headers.get("content-type", "").startswith("image/"):
            return resp.content
        time.sleep(50)
    raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")


def main():
    os.makedirs(OUT, exist_ok=True)
    account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    token = os.environ["CLOUDFLARE_API_TOKEN"]
    report = []
    jobs = [(m, lambda m=m: cloudflare(m, account_id, token)) for m in CF_MODELS]
    if os.environ.get("INCLUDE_POLLINATIONS"):
        jobs.append(("pollinations-flux", pollinations))
    for name, fn in jobs:
        slug = name.split("/")[-1]
        start = time.time()
        try:
            img = fn()
            ext = "png" if img[:4] == b"\x89PNG" else "jpg"
            with open(os.path.join(OUT, f"{slug}.{ext}"), "wb") as f:
                f.write(img)
            report.append(f"OK    {name} ({time.time() - start:.0f}s, {len(img) // 1024} KB)")
        except Exception as exc:  # noqa: BLE001
            report.append(f"FAIL  {name}: {exc}")
        print(report[-1], flush=True)
    with open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
# rerun 2026-11-03T17:03:40Z
