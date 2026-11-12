"""Verlaengert alle Instagram- und TikTok-Tokens und speichert neue Werte als GitHub-Secret.

Instagram (Instagram API with Instagram Login): Long-Lived Tokens gelten 60 Tage und
lassen sich per refresh_access_token um weitere 60 Tage verlaengern (frueheste nach 24 h,
nur solange sie noch gueltig sind). Laeuft das woechentlich, laufen sie nie ab.

TikTok: Der Refresh-Token gilt 365 Tage; gibt TikTok beim Erneuern einen neuen aus,
wird er gespeichert.

Neue Werte werden mit der GitHub-CLI (`gh secret set`) zurueckgeschrieben. Dafuer braucht
der Workflow das Secret SECRETS_WRITE_TOKEN (fein granularer GitHub-Token, nur dieses Repo,
Berechtigung "Secrets: Read and write"). Tokens werden NIE ausgegeben (oeffentliche Logs).

Ergebnis kommt per Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), wenn gesetzt.

  python refresh_tokens.py            (alles verlaengern)
  python refresh_tokens.py --dry-run  (nur pruefen, nichts speichern)
"""
import argparse
import os
import subprocess
import sys

import requests

# Secret-Name -> Anzeigename
INSTAGRAM_SECRETS = {
    "IG_ACCESS_TOKEN": "@mindset_und.motivation",
    "WEIRDWORLD_IG_ACCESS_TOKEN": "WeirdWorld (Instagram)",
    "JOTALABS_IG_ACCESS_TOKEN": "@jota_labsweb",
    "PTNE_API_TOKEN": "These people do not exist",
    "HORROR_IG_ACCESS_TOKEN": "Gruselgeschichten",
    "MYSTERY_IG_ACCESS_TOKEN": "Rätsel & Verschwörungen",
    "WOE_ACCOUNT_TOKEN": "@kaufkraft.check",
}
TIKTOK_SECRETS = {
    "HORROR_TIKTOK_REFRESH_TOKEN": "Gruselgeschichten (TikTok)",
    "MYSTERY_TIKTOK_REFRESH_TOKEN": "Rätsel & Verschwörungen (TikTok)",
}
IG_REFRESH_URL = "https://graph.instagram.com/refresh_access_token"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"


def mask(value):
    """Wert in GitHub-Actions-Logs unkenntlich machen, bevor irgendetwas passiert."""
    if value and os.environ.get("GITHUB_ACTIONS"):
        print(f"::add-mask::{value}")


def save_secret(name, value, dry_run=False, runner=subprocess.run):
    """Schreibt das Secret per `gh secret set` (Wert ueber stdin, nie in der Kommandozeile)."""
    if dry_run:
        return True, "Probelauf - nicht gespeichert"
    if not os.environ.get("GH_TOKEN"):
        return False, "SECRETS_WRITE_TOKEN fehlt - neuer Token konnte nicht gespeichert werden"
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    cmd = ["gh", "secret", "set", name] + (["--repo", repo] if repo else [])
    result = runner(cmd, input=value, text=True, capture_output=True)
    if result.returncode != 0:
        return False, f"Speichern fehlgeschlagen ({(result.stderr or '').strip()[:150]})"
    return True, "neuer Token gespeichert"


def refresh_instagram(name, token, dry_run=False, http=requests, saver=save_secret):
    """Rueckgabe: (ok, Text). Text enthaelt nie den Token."""
    try:
        resp = http.get(IG_REFRESH_URL, params={"grant_type": "ig_refresh_token", "access_token": token},
                        timeout=30)
    except requests.RequestException as exc:
        return False, f"Netzwerkfehler ({type(exc).__name__})"
    if not resp.ok:
        try:
            msg = resp.json().get("error", {}).get("message", "")
        except ValueError:
            msg = ""
        return False, f"abgelehnt (HTTP {resp.status_code}) {msg[:120]}".strip()
    data = resp.json()
    new = data.get("access_token")
    days = int(data.get("expires_in", 0)) // 86400
    if not new:
        return False, "Antwort ohne Token"
    mask(new)
    if new == token:
        return True, f"verlängert, gültig noch {days} Tage"
    ok, info = saver(name, new, dry_run)
    return ok, f"verlängert ({days} Tage), {info}"


def refresh_tiktok(name, refresh_token, key, secret, dry_run=False, http=requests, saver=save_secret):
    try:
        resp = http.post(TIKTOK_TOKEN_URL, data={
            "client_key": key, "client_secret": secret,
            "grant_type": "refresh_token", "refresh_token": refresh_token,
        }, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=30)
    except requests.RequestException as exc:
        return False, f"Netzwerkfehler ({type(exc).__name__})"
    try:
        data = resp.json()
    except ValueError:
        data = {}
    if not resp.ok or "access_token" not in data:
        detail = str(data.get("error_description", ""))[:120]
        return False, f"abgelehnt (HTTP {resp.status_code}) {detail}".strip()
    mask(data.get("access_token"))
    days = int(data.get("refresh_expires_in", 0)) // 86400
    new = data.get("refresh_token")
    if not new or new == refresh_token:
        return True, f"gültig, Refresh-Token noch {days} Tage"
    mask(new)
    ok, info = saver(name, new, dry_run)
    return ok, f"neuer Refresh-Token ({days} Tage), {info}"


def run_all(env, dry_run=False, http=requests, saver=save_secret):
    results = []
    for name, label in INSTAGRAM_SECRETS.items():
        token = env.get(name, "").strip()
        if not token:
            continue
        mask(token)
        ok, text = refresh_instagram(name, token, dry_run, http, saver)
        results.append((ok, label, text))
    key, secret = env.get("TIKTOK_CLIENT_KEY", "").strip(), env.get("TIKTOK_CLIENT_SECRET", "").strip()
    for name, label in TIKTOK_SECRETS.items():
        token = env.get(name, "").strip()
        if not (token and key and secret):
            continue
        mask(token)
        ok, text = refresh_tiktok(name, token, key, secret, dry_run, http, saver)
        results.append((ok, label, text))
    return results


def report(results):
    lines = ["🔑 Token-Erneuerung"]
    for ok, label, text in results:
        lines.append(f"{'✅' if ok else '⚠️'} {label}: {text}")
    if any(not ok for ok, _, _ in results):
        lines.append("\nBei ⚠️: Token im Meta-Dashboard bzw. per tiktok_auth.py neu erzeugen "
                     "und das Secret ersetzen.")
    return "\n".join(lines)


def send_telegram(text, http=requests):
    bot, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not bot or not chat:
        return
    try:
        http.post(f"https://api.telegram.org/bot{bot}/sendMessage", json={"chat_id": chat, "text": text},
                  timeout=30)
    except requests.RequestException:
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    results = run_all(os.environ, args.dry_run)
    if not results:
        print("Keine Tokens gesetzt - nichts zu tun.")
        return
    text = report(results)
    print(text)
    failed = [r for r in results if not r[0]]
    # Nur melden, wenn etwas schiefging oder ein Token neu gespeichert wurde - sonst Ruhe.
    if failed or any("gespeichert" in t for _, _, t in results):
        send_telegram(text)
    if failed:
        sys.exit(1)  # Lauf rot markieren, damit es in GitHub auffaellt


if __name__ == "__main__":
    main()
