# Instagram-Automatisierung für @mindset_und.motivation

Dieses Repo generiert automatisch Motivations-Content (Zitat-Bilder + Reels) und
veröffentlicht ihn über die offizielle **Instagram Graph API** – zeitgesteuert über
GitHub Actions. Kein Login-Bot, kein Risiko für eine Account-Sperre.

- **Täglich**: 1 Zitat-Bild (`daily_post.yml`)
- **Wöchentlich** (sonntags): 1 Reel mit animiertem Text-Overlay, optional mit Musik (`weekly_reel.yml`)

## Wie es funktioniert

1. GitHub Actions läuft zeitgesteuert (Cron) auf GitHub-Servern – dein PC muss nicht an sein.
2. Ein Python-Skript wählt ein noch nicht verwendetes Zitat + Hintergrundbild/-video aus
   `content/` bzw. `assets/` und rendert den fertigen Post.
3. Der generierte Post wird ins Repo committet (dadurch über
   `raw.githubusercontent.com` öffentlich abrufbar – das braucht die Graph API).
4. `publish.py` ruft die Instagram Graph API auf und veröffentlicht den Post.

---

## Schritt 1: GitHub-Account + Repo einrichten

Am einfachsten ohne Kommandozeile:

1. Account auf [github.com](https://github.com) anlegen (kostenlos).
2. [GitHub Desktop](https://desktop.github.com) installieren und mit dem Account anmelden
   (bringt Git direkt mit, keine separate Installation nötig).
3. In GitHub Desktop: **File → New Repository** oder **Add Local Repository** und diesen
   Ordner (`ig-automation`) auswählen. Repository **muss public sein** (private Repos
   liefern keine öffentlich abrufbaren `raw.githubusercontent.com`-URLs auf dem Free Plan).
4. **Publish repository** klicken.

Der Ordner enthält nur generierte Motivations-Assets und Code – keine sensiblen Daten.
Der Zugriffstoken (Schritt 2) wird separat und verschlüsselt als GitHub Secret hinterlegt,
landet also nie im sichtbaren Repo-Inhalt.

---

## Schritt 2: Instagram API einrichten (ohne Facebook-Seite)

Das ist der einzige Teil, den ich nicht für dich automatisieren kann (erfordert deinen
Login bei Meta). Genutzt wird die neuere **"Instagram API with Instagram Login"** -
dafür brauchst du **keine Facebook-Seite** und dein privates Facebook-Profil bleibt
komplett unberührt. Ein Facebook-Konto ist nur nötig, um dich am Meta-Developer-Portal
anzumelden (reiner Login-Zweck, keine Verknüpfung/Veröffentlichung).

1. **Professionelles Konto**: In der Instagram-App → Einstellungen → Konto →
   "Zu professionellem Konto wechseln" → Creator oder Business auswählen.
2. **Meta Developer App anlegen**: Auf [developers.facebook.com/apps](https://developers.facebook.com/apps)
   → "App erstellen" → Typ **"Business"** wählen.
3. In der App das Produkt **"Instagram"** hinzufügen und dort **"API setup with
   Instagram login"** auswählen (nicht die alte "Instagram Graph API", die eine
   Facebook-Seite verlangt).
4. Im Setup-Assistenten: dein eigenes Instagram-Konto als "Instagram tester"
   hinzufügen. Im Instagram-Account unter Einstellungen → Apps und Websites →
   Tester-Einladungen die Einladung annehmen.
5. Im Abschnitt **"Generate access token"**: Button **"Generate token"** neben deinem
   Konto klicken → mit deinen Instagram-Zugangsdaten einloggen → Berechtigungen
   bestätigen (u.a. `instagram_business_content_publish`). Der Access Token wird
   danach direkt im Dashboard angezeigt.
6. Instagram-Business-Account-ID ermitteln: entweder direkt im Dashboard ablesen,
   oder abrufen über
   `GET https://graph.instagram.com/v21.0/me?fields=user_id&access_token=<TOKEN>`.
7. Das generierte Token ist bereits langlebig (~60 Tage). Erneuerung siehe
   "Wartung" weiter unten.

---

## Schritt 3: GitHub Secrets hinterlegen

Im GitHub-Repo: **Settings → Secrets and variables → Actions → New repository secret**

| Name | Wert |
|---|---|
| `IG_ACCESS_TOKEN` | Der Long-Lived Token aus Schritt 2.7 |
| `IG_ACCOUNT_ID` | Die Instagram-Business-Account-ID aus Schritt 2.8 |

---

## Schritt 4: Testen

**Lokal (ohne echten API-Call):**
```
pip install -r requirements.txt
python scripts/generate_quote_card.py
python scripts/publish.py --dry-run
```
Das Bild landet in `assets/generated/`, die geplante API-Anfrage wird nur angezeigt,
nicht ausgeführt.

**Erster echter Post (nach Abschluss von Schritt 2+3):**
Im GitHub-Repo unter **Actions → Daily Quote Post → Run workflow** manuell auslösen
(statt auf den Zeitplan zu warten) und danach den Instagram-Account prüfen.

Für Reels lokal: `python scripts/generate_reel.py` benötigt zusätzlich **ffmpeg**
installiert (auf GitHub Actions bereits vorhanden, lokal z.B. via
`winget install Gyan.FFmpeg`).

---

## Qualitätssicherung (CI)

Bei jedem Push/Pull Request prüft `.github/workflows/ci.yml` automatisch:
- **Lint** (`ruff check .`) - Code-Stil und offensichtliche Fehler (unbenutzte Imports etc.)
- **Unit-Tests** (`pytest tests/`) - testet die Auswahl-Logik in `scripts/common.py`
  (Zitat-/Hintergrund-/Musik-Auswahl, Zyklus-Verhalten, Caption-Aufbau)
- **Smoke-Tests** - führt `generate_quote_card.py` und `generate_reel.py` einmal
  wirklich aus und prüft, ob ein gültiger Post entsteht
- **Dry-Run** von `publish.py` - prüft, dass die Publish-Logik fehlerfrei durchläuft

Lokal ausführen:
```
pip install -r requirements-dev.txt
ruff check .
pytest tests/ -q
```

Netzwerk-Aufrufe an die Graph API in `publish.py` versuchen bei vorübergehenden
Fehlern (Timeout, 429, 5xx) automatisch bis zu 4x erneut (Exponential Backoff).
Bei echten Fehlern (z.B. ungültiger Token) wird sofort mit der vollen Fehlermeldung
von Meta abgebrochen, statt sinnlos zu wiederholen. Schlägt ein geplanter Post
trotzdem fehl, schickt GitHub automatisch eine E-Mail an dich (Standardverhalten
bei fehlgeschlagenen Actions-Workflows) - im Log unter **Actions** siehst du dann
die genaue Fehlermeldung.

---

## Wartung: Token-Erneuerung

Der Long-Lived Token läuft nach **~60 Tagen** ab. Alle **50 Tage**:
1. Im Meta Developer Dashboard → App → Instagram → "API setup with Instagram login"
   → im Abschnitt "Generate access token" erneut "Generate token" klicken (Schritt 2.5).
2. `IG_ACCESS_TOKEN` Secret in GitHub mit dem neuen Wert überschreiben.

Ohne diesen Schritt schlagen die Posts irgendwann mit einem Auth-Fehler fehl (sichtbar
im Actions-Log).

---

## Content erweitern

- **Neue Zitate**: In `content/quotes_de.json` einfach neue Einträge mit fortlaufender
  `id` ergänzen.
- **Neue Hintergrundbilder**: PNG/JPG (Hochformat, ca. 4:5) in `assets/backgrounds/`
  ablegen – wird automatisch mit einbezogen.
- **Neue Reels**: Neues Hintergrundvideo in `assets/bg_videos/` ablegen und/oder in
  `content/reels.json` einen neuen Eintrag mit Text ergänzen. Kein Code muss angefasst werden.
- **Musik für Reels**: Lizenzfreie Tracks (mp3/wav/m4a/aac) in `assets/music/` ablegen –
  wird automatisch gedämpft unter die Reels gelegt. Ohne Dateien dort bleiben Reels stumm.
  Details und Quellen: `assets/music/README.md`.
- **Posting-Frequenz ändern**: Cron-Zeile in `.github/workflows/daily_post.yml` bzw.
  `weekly_reel.yml` anpassen ([crontab.guru](https://crontab.guru) hilft beim Format).

## Struktur

```
assets/backgrounds/   Hintergrundbilder fuer Zitat-Cards
assets/bg_videos/     Hintergrund-Clips fuer Reels
assets/music/         Optionale lizenzfreie Musiktracks fuer Reels (von dir befuellt)
assets/fonts/         Poppins (Open Font License)
assets/generated/     Wird von den Skripten befuellt (Output)
content/quotes_de.json   Zitat-Datenbank
content/hashtags.json    Hashtag-Bank
content/reels.json       Reel-Texte + Zuordnung zu Kategorien
scripts/                 Python-Skripte (Generierung + Publish)
tests/                   Unit-Tests fuer scripts/common.py
.github/workflows/ci.yml Lint + Tests + Smoke-Tests bei jedem Push
requirements-dev.txt     Zusaetzliche Dev-Abhaengigkeiten (pytest, ruff)
posted_log.json          Trackt bereits verwendete Zitate/Assets (wird automatisch committet)
```
