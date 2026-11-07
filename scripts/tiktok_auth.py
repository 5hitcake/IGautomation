"""Einmalig am eigenen PC ausfuehren, um den TikTok-Refresh-Token fuer einen Account zu holen.

Ablauf:
  1. python scripts/tiktok_auth.py
  2. Client Key + Client Secret der TikTok-Developer-App eingeben
     (developers.tiktok.com -> deine App -> "App details").
  3. Den angezeigten Link im Browser oeffnen, mit dem TikTok-Account einloggen, der posten soll,
     und zustimmen.
  4. TikTok leitet auf deine Redirect-URI weiter. Die komplette Adresse aus der Adresszeile
     kopieren und hier einfuegen.
  5. Das Skript zeigt den Refresh-Token an -> als GitHub-Secret speichern
     (z.B. HORROR_TIKTOK_REFRESH_TOKEN). Gueltig 365 Tage.

Benoetigt nur Python + requests (pip install requests).
"""

import secrets
import sys
import urllib.parse

import requests

AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
DEFAULT_SCOPES = "user.info.basic,video.upload,video.publish"
DEFAULT_REDIRECT = "https://5hitcake.github.io/IGautomation/callback.html"


def main():
    print(__doc__)
    client_key = input("Client Key: ").strip()
    client_secret = input("Client Secret: ").strip()
    redirect_uri = (
        input(f"Redirect-URI (genau wie in der App eingetragen) [{DEFAULT_REDIRECT}]: ").strip()
        or DEFAULT_REDIRECT
    )
    scopes = input(f"Scopes [{DEFAULT_SCOPES}]: ").strip() or DEFAULT_SCOPES
    state = secrets.token_urlsafe(16)
    params = {
        "client_key": client_key,
        "scope": scopes,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    print("\n1) Diesen Link im Browser oeffnen und zustimmen:\n")
    print(AUTH_URL + "?" + urllib.parse.urlencode(params))
    back = input("\n2) Komplette Adresse nach der Weiterleitung hier einfuegen:\n").strip()
    query = urllib.parse.parse_qs(urllib.parse.urlparse(back).query)
    if query.get("state", [""])[0] != state:
        sys.exit("Der 'state' passt nicht - bitte den Link aus Schritt 1 erneut verwenden.")
    if "code" not in query:
        sys.exit(f"Kein 'code' in der Adresse gefunden: {query.get('error_description') or query}")
    resp = requests.post(
        TOKEN_URL,
        data={
            "client_key": client_key,
            "client_secret": client_secret,
            "code": query["code"][0],
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    data = resp.json()
    if "refresh_token" not in data:
        sys.exit(f"Fehler von TikTok: {data}")
    print("\nErfolg! Erlaubte Scopes:", data.get("scope"))
    print(f"Gueltig fuer {int(data.get('refresh_expires_in', 0)) // 86400} Tage.\n")
    print("Als GitHub-Secret speichern (z.B. HORROR_TIKTOK_REFRESH_TOKEN):\n")
    print(data["refresh_token"])


if __name__ == "__main__":
    main()
