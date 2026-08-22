"""Veroeffentlicht das zuletzt generierte TikTok-Video
(assets/tiktok_generated/next_post.json) ueber die offizielle TikTok
Content Posting API (Direct Post, FILE_UPLOAD).

Benoetigte Umgebungsvariable:
  TIKTOK_ACCESS_TOKEN - Access Token einer TikTok-Developer-App mit dem Scope
                         "video.publish" (siehe README Setup)

Nutzung:
  python tiktok_publish.py            (echter Publish-Call)
  python tiktok_publish.py --dry-run  (zeigt nur die Payloads, ruft die API nicht auf)
"""
import argparse
import json
import os
import sys
import time

import requests
from requests.adapters import HTTPAdapter
from tiktok_common import ROOT, TIKTOK_GENERATED_DIR
from urllib3.util.retry import Retry

API_BASE = "https://open.tiktokapis.com/v2"
POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 30
# PRIVATE_TO_SELF ist der sichere Default fuer unbeaufsichtigte Automation
# (z.B. waehrend die App noch im TikTok-Review-Status "in Pruefung" ist).
# Auf PUBLIC_TO_EVERYONE umstellen, sobald die App freigegeben ist.
DEFAULT_PRIVACY_LEVEL = os.environ.get("TIKTOK_PRIVACY_LEVEL", "PRIVATE_TO_SELF")


def make_session():
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
        raise RuntimeError(f"TikTok-API-Fehler ({resp.status_code}): {detail}") from exc


SESSION = make_session()


def init_upload(access_token, video_path, caption, dry_run):
    video_size = os.path.getsize(video_path)
    payload = {
        "post_info": {
            "title": caption,
            "privacy_level": DEFAULT_PRIVACY_LEVEL,
            "disable_duet": False,
            "disable_comment": False,
            "disable_stitch": False,
            "video_cover_timestamp_ms": 1000,
        },
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": video_size,
            "chunk_size": video_size,
            "total_chunk_count": 1,
        },
    }

    if dry_run:
        print("[dry-run] POST /post/publish/video/init/ mit:")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return "dry-run-publish-id", None

    resp = SESSION.post(
        f"{API_BASE}/post/publish/video/init/",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        },
        json=payload,
        timeout=60,
    )
    raise_with_details(resp)
    data = resp.json()["data"]
    print(f"Upload initialisiert: publish_id={data['publish_id']}")
    return data["publish_id"], data["upload_url"]


def upload_video(upload_url, video_path, dry_run):
    if dry_run:
        print(f"[dry-run] PUT Video-Bytes an {upload_url}")
        return

    video_size = os.path.getsize(video_path)
    with open(video_path, "rb") as f:
        resp = SESSION.put(
            upload_url,
            data=f,
            headers={
                "Content-Range": f"bytes 0-{video_size - 1}/{video_size}",
                "Content-Type": "video/mp4",
            },
            timeout=120,
        )
    raise_with_details(resp)
    print("Video hochgeladen.")


def wait_for_publish(access_token, publish_id, dry_run):
    if dry_run:
        print(f"[dry-run] wuerde auf status=PUBLISH_COMPLETE fuer {publish_id} pollen")
        return
    for attempt in range(MAX_POLL_ATTEMPTS):
        resp = SESSION.post(
            f"{API_BASE}/post/publish/status/fetch/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json={"publish_id": publish_id},
            timeout=30,
        )
        raise_with_details(resp)
        status = resp.json()["data"]["status"]
        print(f"Status ({attempt + 1}/{MAX_POLL_ATTEMPTS}): {status}")
        if status == "PUBLISH_COMPLETE":
            return
        if status == "FAILED":
            raise RuntimeError(f"Veroeffentlichung fehlgeschlagen: {resp.json()}")
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError("Video wurde nicht rechtzeitig verarbeitet (status != PUBLISH_COMPLETE)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    next_post_path = os.path.join(TIKTOK_GENERATED_DIR, "next_post.json")
    if not os.path.exists(next_post_path):
        print("Kein next_post.json gefunden - zuerst tiktok_generate_video.py ausfuehren.")
        sys.exit(1)

    with open(next_post_path, "r", encoding="utf-8") as f:
        post = json.load(f)
    video_path = os.path.join(ROOT, post["file"])

    access_token = os.environ.get("TIKTOK_ACCESS_TOKEN", "" if args.dry_run else None)
    if not args.dry_run and not access_token:
        print("TIKTOK_ACCESS_TOKEN muss gesetzt sein (siehe README Setup).")
        sys.exit(1)

    publish_id, upload_url = init_upload(access_token, video_path, post["caption"], args.dry_run)
    upload_video(upload_url, video_path, args.dry_run)
    wait_for_publish(access_token, publish_id, args.dry_run)


if __name__ == "__main__":
    main()
