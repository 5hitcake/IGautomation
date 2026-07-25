"""Veroeffentlicht den zuletzt generierten Post (assets/generated/next_post.json)
ueber die "Instagram API with Instagram Login" (graph.instagram.com) - funktioniert
mit einem Instagram Business/Creator-Konto ohne Verknuepfung zu einer Facebook-Seite.

Benoetigte Umgebungsvariablen:
  IG_ACCESS_TOKEN   - Long-Lived Access Token mit instagram_business_content_publish Scope
  IG_ACCOUNT_ID     - Instagram Business Account ID (aus GET /me?fields=user_id)
  GITHUB_REPOSITORY - wird von GitHub Actions automatisch gesetzt (owner/repo),
                       dient zur Bildung der oeffentlichen raw.githubusercontent.com URL

Nutzung:
  python publish.py            (echter Publish-Call)
  python publish.py --dry-run  (zeigt nur die Payloads, ruft die API nicht auf)
"""
import argparse
import json
import os
import sys
import time

import requests
from common import GENERATED_DIR
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

GRAPH_API_VERSION = "v21.0"
# graph.instagram.com = "Instagram API with Instagram Login": funktioniert direkt mit einem
# Instagram Business/Creator-Konto, OHNE Verknuepfung zu einer Facebook-Seite.
GRAPH_API_BASE = f"https://graph.instagram.com/{GRAPH_API_VERSION}"
POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 30


def make_session():
    """requests-Session mit automatischem Retry (Exponential Backoff) fuer
    voruebergehende Netzwerk-/Server-Fehler (Timeouts, 429, 5xx). Echte
    Client-Fehler (4xx wie ungueltiger Token) werden NICHT wiederholt, da sie
    sich durch erneutes Versuchen nicht loesen."""
    session = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=2,  # 2s, 4s, 8s, 16s
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session


def raise_with_details(resp):
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        try:
            detail = resp.json()
        except ValueError:
            detail = resp.text
        raise RuntimeError(f"Graph-API-Fehler ({resp.status_code}): {detail}") from exc


SESSION = make_session()


def public_asset_url(relative_path, dry_run=False):
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        if dry_run:
            repo = "<owner>/<repo>"
        else:
            raise RuntimeError(
                "GITHUB_REPOSITORY ist nicht gesetzt. Lokal: setze es manuell auf 'owner/repo'."
            )
    return f"https://raw.githubusercontent.com/{repo}/main/{relative_path}"


def wait_for_media_ready(creation_id, access_token, dry_run):
    """Pollt den Media-Container, bis Instagram ihn fertig verarbeitet hat
    (status_code=FINISHED). Noetig sowohl fuer Reels als auch fuer Bilder -
    media_publish schlaegt sonst mit "Media ID is not available" fehl, wenn
    zu frueh aufgerufen wird."""
    if dry_run:
        print(f"[dry-run] wuerde auf status_code=FINISHED fuer {creation_id} pollen")
        return
    for attempt in range(MAX_POLL_ATTEMPTS):
        resp = SESSION.get(
            f"{GRAPH_API_BASE}/{creation_id}",
            params={"fields": "status_code", "access_token": access_token},
            timeout=30,
        )
        raise_with_details(resp)
        status = resp.json().get("status_code")
        print(f"Status ({attempt + 1}/{MAX_POLL_ATTEMPTS}): {status}")
        if status == "FINISHED":
            return
        if status == "ERROR":
            raise RuntimeError(f"Media-Verarbeitung fehlgeschlagen: {resp.json()}")
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError("Media wurde nicht rechtzeitig verarbeitet (status_code != FINISHED)")


def create_media_container(ig_account_id, access_token, post, dry_run):
    asset_url = public_asset_url(post["file"], dry_run=dry_run)
    params = {"caption": post["caption"], "access_token": access_token}
    if post["type"] == "reel":
        params["media_type"] = "REELS"
        params["video_url"] = asset_url
    else:
        params["image_url"] = asset_url

    if dry_run:
        print("[dry-run] POST /media mit:")
        print(json.dumps({**params, "access_token": "***"}, ensure_ascii=False, indent=2))
        return "dry-run-creation-id"

    resp = SESSION.post(f"{GRAPH_API_BASE}/{ig_account_id}/media", data=params, timeout=60)
    raise_with_details(resp)
    creation_id = resp.json()["id"]
    print(f"Media-Container erstellt: {creation_id}")
    return creation_id


def publish_media(ig_account_id, access_token, creation_id, dry_run):
    if dry_run:
        print(f"[dry-run] POST /media_publish mit creation_id={creation_id}")
        return
    resp = SESSION.post(
        f"{GRAPH_API_BASE}/{ig_account_id}/media_publish",
        data={"creation_id": creation_id, "access_token": access_token},
        timeout=60,
    )
    raise_with_details(resp)
    print(f"Veroeffentlicht: {resp.json()}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    next_post_path = os.path.join(GENERATED_DIR, "next_post.json")
    if not os.path.exists(next_post_path):
        print(
            "Kein next_post.json gefunden - zuerst generate_quote_card.py "
            "oder generate_reel.py ausfuehren."
        )
        sys.exit(1)

    with open(next_post_path, "r", encoding="utf-8") as f:
        post = json.load(f)

    access_token = os.environ.get("IG_ACCESS_TOKEN", "" if args.dry_run else None)
    ig_account_id = os.environ.get("IG_ACCOUNT_ID", "" if args.dry_run else None)
    if not args.dry_run and (not access_token or not ig_account_id):
        print("IG_ACCESS_TOKEN und IG_ACCOUNT_ID muessen gesetzt sein (siehe README Setup).")
        sys.exit(1)

    creation_id = create_media_container(ig_account_id, access_token, post, args.dry_run)
    wait_for_media_ready(creation_id, access_token, args.dry_run)
    publish_media(ig_account_id, access_token, creation_id, args.dry_run)


if __name__ == "__main__":
    main()
