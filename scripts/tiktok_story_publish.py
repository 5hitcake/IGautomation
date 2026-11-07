"""Laedt ein fertiges Story-Reel zusaetzlich auf TikTok hoch (offizielle Content Posting API).

Anders als tiktok_publish.py (fester Access-Token, der nach 24 h ablaeuft) holt dieses Skript
sich bei jedem Lauf selbst einen frischen Access-Token ueber den Refresh-Token (365 Tage gueltig).

Zwei Modi (Umgebungsvariable TIKTOK_MODE):
  inbox   (Standard) Video landet als Entwurf in der TikTok-App (Benachrichtigung "Bearbeiten
          und posten"), du tippst nur noch auf Posten. Funktioniert auch ohne App-Pruefung
          durch TikTok. Scope: video.upload
  direct  Video wird direkt veroeffentlicht. Oeffentlich erst, wenn TikTok die App geprueft
          hat - vorher nur "Nur ich" (SELF_ONLY). Scope: video.publish

Benoetigte Umgebungsvariablen:
  TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET   aus der TikTok-Developer-App
  TIKTOK_REFRESH_TOKEN                      einmalig mit scripts/tiktok_auth.py geholt
  optional TIKTOK_PRIVACY_LEVEL             nur fuer direct (Standard: oeffentlich, falls erlaubt)

Nutzung:
  python scripts/tiktok_story_publish.py --post-file assets/story_reels/horror/next_post.json
  python scripts/tiktok_story_publish.py --post-file ... --dry-run
"""

import argparse
import json
import os
import sys
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
API_BASE = "https://open.tiktokapis.com/v2"
POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 36
MAX_TITLE = 2200
CHUNK_MAX = 64 * 1024 * 1024


def make_session():
    session = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST", "PUT"],
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


SESSION = make_session()


def _check(resp, what):
    try:
        data = resp.json()
    except ValueError:
        data = {"raw": resp.text[:300]}
    err = (data.get("error") or {}) if isinstance(data, dict) else {}
    if not resp.ok or (err.get("code") not in (None, "ok")):
        raise RuntimeError(f"TikTok {what} fehlgeschlagen ({resp.status_code}): {json.dumps(data)[:400]}")
    return data


def refresh_access_token(client_key, client_secret, refresh_token):
    resp = SESSION.post(
        f"{API_BASE}/oauth/token/",
        data={
            "client_key": client_key,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    data = _check(resp, "Token-Erneuerung")
    if "access_token" not in data:
        raise RuntimeError(f"Keine access_token in der Antwort: {list(data)}")
    if data.get("refresh_token") and data["refresh_token"] != refresh_token:
        # Den neuen Wert NICHT ausgeben (oeffentliche Logs). Der alte bleibt in der Regel
        # bis zu seinem Ablauf gueltig; sonst einmal tiktok_auth.py neu ausfuehren.
        print(
            "::notice::TikTok hat einen neuen Refresh-Token ausgegeben. Laeuft der Upload irgendwann "
            "nicht mehr, einmal scripts/tiktok_auth.py ausfuehren und das Secret erneuern."
        )
    days = int(data.get("refresh_expires_in", 0)) // 86400
    if days and days < 30:
        print(f"::warning::TikTok-Refresh-Token laeuft in {days} Tagen ab - bitte bald erneuern.")
    return data["access_token"]


def check_account(token, expected):
    """Bricht ab, wenn der Token zu einem anderen TikTok-Account gehoert als erwartet."""
    resp = SESSION.get(
        f"{API_BASE}/user/info/",
        params={"fields": "display_name"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    actual = (_check(resp, "Account-Abfrage").get("data", {}).get("user", {}) or {}).get("display_name", "")
    if actual.strip().lower() != expected.strip().lower():
        raise RuntimeError(
            f"Falscher TikTok-Account: Token gehoert zu '{actual}', erwartet '{expected}'. "
            "Es wurde NICHT hochgeladen - Refresh-Token pruefen "
            "(Anzeigename geaendert? -> tiktok_name anpassen)."
        )
    print(f"Account-Check ok: {actual}")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"}


def choose_privacy(token):
    """Fragt ab, welche Sichtbarkeit der Account erlaubt (Pflicht laut TikTok-Richtlinien)."""
    resp = SESSION.post(
        f"{API_BASE}/post/publish/creator_info/query/", headers=auth_headers(token), timeout=30
    )
    info = _check(resp, "creator_info").get("data", {})
    options = info.get("privacy_level_options") or ["SELF_ONLY"]
    wanted = os.environ.get("TIKTOK_PRIVACY_LEVEL", "").strip()
    if wanted in options:
        return wanted
    return "PUBLIC_TO_EVERYONE" if "PUBLIC_TO_EVERYONE" in options else options[0]


def build_payload(mode, video_size, caption, privacy=None):
    chunk = video_size if video_size <= CHUNK_MAX else CHUNK_MAX
    payload = {
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": video_size,
            "chunk_size": chunk,
            "total_chunk_count": max(1, video_size // chunk),
        }
    }
    if mode == "direct":
        payload["post_info"] = {
            "title": caption[:MAX_TITLE],
            "privacy_level": privacy or "SELF_ONLY",
            "disable_duet": False,
            "disable_comment": False,
            "disable_stitch": False,
            "video_cover_timestamp_ms": 1500,
        }
    return payload


def upload(upload_url, video_path, payload):
    size = payload["source_info"]["video_size"]
    chunk = payload["source_info"]["chunk_size"]
    count = payload["source_info"]["total_chunk_count"]
    with open(video_path, "rb") as f:
        for i in range(count):
            start = i * chunk
            end = size - 1 if i == count - 1 else start + chunk - 1  # letzter Chunk nimmt den Rest
            f.seek(start)
            body = f.read(end - start + 1)
            resp = SESSION.put(
                upload_url,
                data=body,
                timeout=300,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{size}",
                    "Content-Length": str(len(body)),
                    "Content-Type": "video/mp4",
                },
            )
            if resp.status_code not in (200, 201, 206):
                raise RuntimeError(
                    f"Upload-Teil {i + 1}/{count} fehlgeschlagen ({resp.status_code}): {resp.text[:200]}"
                )
    print(f"Video hochgeladen ({size / 1e6:.1f} MB, {count} Teil(e)).")


def wait_for_status(token, publish_id, mode):
    done = {"PUBLISH_COMPLETE"} | ({"SEND_TO_USER_INBOX"} if mode == "inbox" else set())
    for attempt in range(MAX_POLL_ATTEMPTS):
        resp = SESSION.post(
            f"{API_BASE}/post/publish/status/fetch/",
            headers=auth_headers(token),
            json={"publish_id": publish_id},
            timeout=30,
        )
        data = _check(resp, "Statusabfrage").get("data", {})
        status = data.get("status")
        print(f"Status ({attempt + 1}/{MAX_POLL_ATTEMPTS}): {status}")
        if status in done:
            return status
        if status == "FAILED":
            raise RuntimeError(f"TikTok meldet FAILED: {data.get('fail_reason')}")
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError("TikTok hat das Video nicht rechtzeitig verarbeitet.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--post-file", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.post_file, "r", encoding="utf-8") as f:
        post = json.load(f)
    video_path = os.path.join(os.path.dirname(args.post_file), post["file"])
    if not os.path.exists(video_path):
        video_path = os.path.join(ROOT, post["file"])
    mode = os.environ.get("TIKTOK_MODE", "inbox").strip().lower()
    if mode not in ("inbox", "direct"):
        sys.exit(f"TIKTOK_MODE muss 'inbox' oder 'direct' sein, nicht '{mode}'")
    size = os.path.getsize(video_path) if os.path.exists(video_path) else 20_000_000

    if args.dry_run:
        payload = build_payload(mode, size, post["caption"], "SELF_ONLY")
        print(f"[dry-run] Modus {mode}, Video {video_path}")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    creds = [
        os.environ.get(k, "").strip()
        for k in ("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN")
    ]
    if not all(creds):
        sys.exit("TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET und TIKTOK_REFRESH_TOKEN muessen gesetzt sein.")
    token = refresh_access_token(*creds)
    expected = os.environ.get("TIKTOK_EXPECT_NAME", "").strip()
    if expected:
        check_account(token, expected)
    privacy = choose_privacy(token) if mode == "direct" else None
    if privacy:
        print(f"Sichtbarkeit: {privacy}")
    payload = build_payload(mode, size, post["caption"], privacy)
    endpoint = "inbox/video/init" if mode == "inbox" else "video/init"
    resp = SESSION.post(
        f"{API_BASE}/post/publish/{endpoint}/", headers=auth_headers(token), json=payload, timeout=60
    )
    data = _check(resp, "Upload-Start")["data"]
    upload(data["upload_url"], video_path, payload)
    status = wait_for_status(token, data["publish_id"], mode)
    if status == "SEND_TO_USER_INBOX":
        print("Fertig: Das Video liegt als Entwurf in deiner TikTok-App (Benachrichtigungen) - dort posten.")
    else:
        print("Fertig: Auf TikTok veroeffentlicht.")


if __name__ == "__main__":
    main()
