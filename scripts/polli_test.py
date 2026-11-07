"""Temporaerer Test: dieselbe Person mit mehreren kostenlosen Pollinations-Modellen.
Token aus POLLI_TOKEN (GitHub-Secret), wird nie ausgegeben."""
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import people_generate as pg  # noqa: E402

TOKEN = os.environ["POLLI_TOKEN"]
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "polli_test")
MODELS = ["black-forest-labs/flux.1.1-pro", "microsoft/mai-image-2.6"]
BAL = {}


def get(url, timeout=180):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}",
                                               "User-Agent": "people-test"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.headers.get("Content-Type", ""), r.read()


def balance():
    for path in ("/account/balance", "/account/profile"):
        try:
            _, _, body = get("https://gen.pollinations.ai" + path, 30)
            BAL.setdefault(path, []).append(body[:400].decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            print(f"{path}: {e}")


persona = pg.roll_persona({"recent": []}, random.Random(int(os.environ.get("SEED", "7"))))
prompt = pg.build_prompt(persona)
print("Prompt:", prompt)
os.makedirs(OUT, exist_ok=True)
balance()
results = {}
for model in MODELS:
    q = urllib.parse.urlencode({"model": model, "width": 1088, "height": 1344, "seed": 42, "nologo": "true"})
    url = f"https://gen.pollinations.ai/image/{urllib.parse.quote(prompt)}?{q}"
    t = time.time()
    try:
        status, ctype, data = get(url)
        name = model.split("/")[-1].replace(".", "_") + (".png" if "png" in ctype else ".jpg")
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        results[model] = f"ok {len(data)//1024} KB, {time.time()-t:.0f}s"
    except urllib.error.HTTPError as e:
        results[model] = f"HTTP {e.code}: {e.read()[:300].decode('utf-8', 'replace')}"
    except Exception as e:  # noqa: BLE001
        results[model] = f"Fehler: {e}"
    print(model, "->", results[model])
balance()
with open(os.path.join(OUT, "results.json"), "w", encoding="utf-8") as f:
    json.dump({"prompt": prompt, "results": results, "balance": BAL}, f, ensure_ascii=False, indent=2)
