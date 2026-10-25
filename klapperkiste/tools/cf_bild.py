"""Bild über Cloudflare Workers AI erzeugen (Modell FLUX.1 schnell).

Braucht zwei Umgebungsvariablen:
  CLOUDFLARE_ACCOUNT_ID   Konto-ID aus dem Cloudflare-Dashboard
  CLOUDFLARE_API_TOKEN    API-Token mit der Berechtigung "Workers AI"

Beispiel:
  python klapperkiste/tools/cf_bild.py "Prompt ..." roh.jpg
  python klapperkiste/tools/cf_bild.py --prompt-datei prompt.txt roh.jpg --seed 7

FLUX.1 schnell liefert quadratische Bilder (1024 x 1024) und nimmt keine
Stil-Referenz an. Der Stil kommt allein aus dem Prompt.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

MODELL = "@cf/black-forest-labs/flux-1-schnell"


def erzeugen(prompt: str, steps: int = 8, seed: int | None = None) -> bytes:
    konto = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not konto or not token:
        raise SystemExit("CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN müssen gesetzt sein.")
    daten = {"prompt": prompt, "steps": steps}
    if seed is not None:
        daten["seed"] = seed
    anfrage = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{konto}/ai/run/{MODELL}",
        data=json.dumps(daten).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(anfrage, timeout=120) as antwort:
            ergebnis = json.load(antwort)
    except urllib.error.HTTPError as fehler:
        text = fehler.read().decode("utf-8", "replace")
        raise SystemExit(f"Cloudflare antwortet mit {fehler.code}: {text}")
    if not ergebnis.get("success"):
        raise SystemExit(f"Cloudflare meldet einen Fehler: {ergebnis.get('errors')}")
    return base64.b64decode(ergebnis["result"]["image"])


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("prompt", nargs="?", help="Prompt-Text (oder --prompt-datei)")
    p.add_argument("ausgabe", help="Zieldatei, z. B. roh.jpg")
    p.add_argument("--prompt-datei", help="Prompt aus einer Textdatei lesen")
    p.add_argument("--steps", type=int, default=8, help="Rechenschritte, 1 bis 8 (Standard 8)")
    p.add_argument("--seed", type=int, help="Fester Zufallswert für wiederholbare Ergebnisse")
    args = p.parse_args(argv)
    if args.prompt_datei:
        with open(args.prompt_datei, encoding="utf-8") as f:
            prompt = f.read().strip()
    elif args.prompt:
        prompt = args.prompt
    else:
        p.error("Prompt fehlt.")
    bild = erzeugen(prompt, args.steps, args.seed)
    with open(args.ausgabe, "wb") as f:
        f.write(bild)
    print(f"{args.ausgabe}: {len(bild) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
