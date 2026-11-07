"""Temporaerer Test: trifft MAI 2.6 das Alter (mit/ohne Zusatz) besser als Z-Image?"""
import json
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import people_generate as pg  # noqa: E402

TOKEN = os.environ["POLLI_TOKEN"]
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "polli_test")
os.makedirs(OUT, exist_ok=True)


def persona_with_age(lo, hi, seed):
    rng = random.Random(seed)
    while True:
        p = pg.roll_persona({"recent": []}, rng)
        if lo <= p["age"] <= hi:
            return p


results = {}
for lo, hi, seed in ((24, 26, 1), (32, 34, 2), (40, 42, 3)):
    p = persona_with_age(lo, hi, seed)
    base = pg.build_prompt(p)
    fixed = base.replace(f"{p['age']}-year-old", f"{p['age']}-year-old", 1).replace(
        ", photorealistic", f", looks exactly {p['age']} years old, age-accurate face, photorealistic", 1)
    for label, model, prompt in (("mai", "microsoft/mai-image-2.6", base),
                                 ("mai_agefix", "microsoft/mai-image-2.6", fixed),
                                 ("zimage", "tongyi-mai/z-image-turbo", base)):
        name = f"age{p['age']}_{label}.jpg"
        try:
            data = pg.generate_pollinations(model, prompt, TOKEN)
            with open(os.path.join(OUT, name), "wb") as f:
                f.write(pg.to_instagram_jpeg(data))
            results[name] = "ok"
        except Exception as e:  # noqa: BLE001
            results[name] = str(e)[:300]
        print(name, results[name])
    results[f"prompt_{p['age']}"] = base
with open(os.path.join(OUT, "results.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
