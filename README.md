# Social-Media-Automatisierung

Dieses Repo generiert automatisch Content und veröffentlicht ihn über offizielle
Plattform-APIs – zeitgesteuert über GitHub Actions. Kein Login-Bot, kein Risiko
für eine Account-Sperre.

**Instagram (@mindset_und.motivation)** – Motivations-Content über die
**Instagram Graph API**:
- **Täglich**: 1 Zitat-Bild (`daily_post.yml`)
- **Wöchentlich** (sonntags): 1 Reel mit animiertem Text-Overlay, optional mit Musik (`weekly_reel.yml`)

**TikTok (@weirdworld.ai) + zweiter Instagram-Account** – täglich ein
KI-generiertes Ghibli/Anime-Video, gleichzeitig über die **TikTok Content
Posting API** und (als Reel) über die **Instagram Graph API** auf einem
zweiten, eigenständigen Instagram-Account veröffentlicht - unabhängig vom
Mindset-Account oben (Details weiter unten unter
[TikTok-Automatisierung](#tiktok-automatisierung-weirdworldai)):
- **Täglich**: 1 narratives Kurzvideo (`tiktok_daily.yml`)

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

## TikTok-Automatisierung (@weirdworld.ai)

Zusätzlich zum Instagram-Teil oben generiert und postet dieses Repo **täglich ein
KI-Video im Ghibli/Anime-Stil** (`tiktok_daily.yml`) - nach demselben Prinzip:
kein Login-Bot, GitHub Actions als Zeitgeber, offizielle Plattform-APIs zum
Veröffentlichen. Dasselbe generierte Video geht dabei an **zwei Ziele
gleichzeitig**: TikTok (@weirdworld.ai) und einen zweiten, eigenständigen
Instagram-Account (als Reel) - unabhängig vom Mindset-Account weiter oben.

**Kosten: 0 €.** Es werden ausschließlich kostenlose Dienste genutzt:
- **Bilder**: Hybrid aus einem größeren Modell über die kostenlose Hugging-Face-
  Inference-API (4 kritische Beats) und einem selbst gehosteten, kostenlosen Modell
  (5 einfache Beats) - siehe unten.
- **Sprachausgabe**: `edge-tts` (kein Account, kein Key)
- **Zusammenschnitt**: ffmpeg (in der GitHub-Actions-Umgebung vorinstalliert)

### Wie ein Video entsteht

1. `scripts/tiktok_generate_video.py` wählt ein noch nicht verwendetes Thema aus
   `content/tiktok_topics.json` (Format: Hook → Ort/Jahr → Suche → Fund →
   Experten-Reaktion → Vertuschung → Auflösung → Follow-CTA, 9 Beats). Der
   Suche-Beat baut zusätzlichen Spannungsbogen auf und zeigt themenspezifisch die
   reale Such-/Ausgrabungsmethode (z.B. Taucher am Schiffswrack beim Antikythera-
   Mechanismus, Archäologen beim Freilegen, Astronomen am Teleskop).
2. **Hybrid-Bildgenerierung** (siehe unten): 4 Beats über ein größeres Modell
   (kostenlose HF Inference API), 5 Beats über ein kostenloses, selbst gehostetes
   Modell. Jede Sprachzeile wird über `edge-tts` vertont, inkl. Wort-für-Wort-Zeitstempeln.
3. ffmpeg legt einen sanften Zoom (Ken-Burns-Effekt) auf jedes Bild, blendet die
   Untertitel Wort für Wort ein und fügt alle Beats zu einem 1080x1920-Video zusammen.
4. `scripts/tiktok_publish.py` lädt das Video über die offizielle **TikTok Content
   Posting API** hoch (Direct Post, `FILE_UPLOAD`).
5. Direkt danach postet `scripts/publish.py --post-file assets/tiktok_generated/next_post.json`
   dasselbe Video als Reel über die **Instagram Graph API** auf den zweiten
   Instagram-Account (derselbe Code wie beim Mindset-Account oben, nur mit
   anderen Zugangsdaten und anderer next_post.json als Quelle).

**Wichtig zu den Charakteren**: Bei erfundenen Szenen wird bei **jedem Video eine
neue, zufällige Figur** ausgewürfelt (Geschlecht, Alter, Herkunft, Outfit) - es gibt
absichtlich keine wiederkehrende "Maskottchen"-Figur. Geht es um eine reale
historische Person (`real_person` in `content/tiktok_topics.json`), wird diese
Person nur *innerhalb desselben Videos* konsistent beschrieben.

### Warum Hybrid statt ein einziges Modell?

Kleine SD1.5-Klasse-Bildmodelle (getestet: ein selbst gehostetes
`nitrosocke/Ghibli-Diffusion`) scheitern zuverlässig daran, "eine Person hält ein
bestimmtes Objekt in der Hand" korrekt darzustellen - eine bekannte Schwäche dieser
Modellklasse (im Chat mehrfach gegengetestet, siehe Session-Verlauf). Higgsfield
(Bezahl-API) war ein Zwischenschritt, ist aber ohne Guthaben nicht nutzbar. Deshalb:

- **4 kritische Beats** (Hook, Fund, Reaktion, Auflösung - dort hält der Charakter
  das Artefakt) laufen über **`stabilityai/stable-diffusion-3-medium-diffusers`**
  auf der kostenlosen Hugging-Face-Inference-API (`router.huggingface.co/hf-inference`)
  - laut aktueller HF-Doku das einzige Text-zu-Bild-Modell, das dieser kostenlose
  Provider noch bedient (FLUX.1-schnell wurde dort bereits abgekündigt, 410 im
  Live-Test). SD3-medium nutzt einen T5-Textencoder statt CLIPs 77-Token-Cutoff
  und ist damit potenziell staerker bei komplexen Kompositionen als SD1.5-Modelle -
  aber noch nicht firmenspezifisch für "Person hält Objekt" verifiziert.
- **5 einfache Beats** (Ort, Suche, Vertuschung ×2, Follow-CTA - reine Umgebungs-/
  Handlungsbilder ohne kritische Objekt-Interaktion) laufen über ein **selbst gehostetes,
  kostenloses** `nitrosocke/Ghibli-Diffusion`-Modell direkt im GitHub-Actions-Runner
  (CPU, kein GPU nötig - dauert dafür ca. 10-15 Min./Bild. Das ist bewusst so:
  Qualität hat hier Vorrang vor Geschwindigkeit, die Automation läuft ohnehin
  unbeaufsichtigt).

### Schritt 1: Hugging-Face-API-Token einrichten

1. Auf [huggingface.co](https://huggingface.co) anmelden (bestehender oder neuer
   Account, kostenlos, keine Kreditkarte nötig).
2. Unter **Settings → Access Tokens** einen neuen Token erzeugen (Typ "Read"
   reicht für die Inference API).
3. Den Token als GitHub Secret `HF_API_TOKEN` hinterlegen (Settings → Secrets
   and variables → Actions → New repository secret).

Die kostenlose Inference API ist ratenlimitiert (nicht unbegrenzt parallel
nutzbar), für 4 Bilder/Tag aber problemlos ausreichend.

### Schritt 2: TikTok Content Posting API einrichten

1. Auf [developers.tiktok.com](https://developers.tiktok.com) anmelden und eine
   neue App anlegen.
2. Produkt **"Content Posting API"** hinzufügen, Scope `video.publish` aktivieren.
3. Über den OAuth-Flow der App einen Access Token für den Ziel-Account erzeugen.
4. Solange die App noch nicht von TikTok freigegeben ist ("in Prüfung"), können
   Videos nur mit `privacy_level: PRIVATE_TO_SELF` gepostet werden (Standard in
   `tiktok_publish.py`, steuerbar über `TIKTOK_PRIVACY_LEVEL`). Nach Freigabe der
   App auf `PUBLIC_TO_EVERYONE` umstellen.
5. Access Token als GitHub Secret `TIKTOK_ACCESS_TOKEN` hinterlegen.

### Schritt 3: Zweiten Instagram-Account einrichten

Genau dieselben Schritte wie in **[Schritt 2: Instagram API einrichten](#schritt-2-instagram-api-einrichten-ohne-facebook-seite)**
weiter oben, aber diesmal für den zweiten (weirdworld.ai-)Account statt für
@mindset_und.motivation - separates professionelles Konto, separate Meta-App
(oder separater Tester-Eintrag in derselben App), separater Access Token.

Die Werte als **eigene** GitHub Secrets hinterlegen (bewusst andere Namen als
`IG_ACCESS_TOKEN`/`IG_ACCOUNT_ID`, damit sich die beiden Instagram-Accounts
nicht überschreiben):

| Name | Wert |
|---|---|
| `WEIRDWORLD_IG_ACCESS_TOKEN` | Long-Lived Token des zweiten Instagram-Accounts |
| `WEIRDWORLD_IG_ACCOUNT_ID` | Instagram-Business-Account-ID des zweiten Accounts |

### Schritt 4: Testen

**Lokal (benötigt ffmpeg + `pip install -r requirements.txt`; der erste Lauf lädt
zusätzlich das ca. 2 GB große Ghibli-Diffusion-Modell einmalig herunter):**
```
export HF_API_TOKEN=...
python scripts/tiktok_generate_video.py
python scripts/tiktok_publish.py --dry-run
python scripts/publish.py --post-file assets/tiktok_generated/next_post.json --dry-run
```

**Erster echter Post:** Im GitHub-Repo unter **Actions → Daily TikTok Post →
Run workflow** manuell auslösen.

### TikTok-Themen erweitern

Neue Themen: in `content/tiktok_topics.json` einen neuen Eintrag mit fortlaufender
`id` ergänzen (Felder wie bei den bestehenden Einträgen). `real_person` auf `null`
setzen für frei erfundene Figuren, oder mit `name` + `description` befüllen, wenn
eine reale Person möglichst akkurat dargestellt werden soll.

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
assets/tiktok_generated/ Wird von tiktok_generate_video.py befuellt (Output)
content/tiktok_topics.json Themen-Datenbank fuer die TikTok-Videos
scripts/                 Python-Skripte (Generierung + Publish, IG und TikTok)
tests/                   Unit-Tests fuer scripts/common.py und scripts/tiktok_common.py
.github/workflows/ci.yml Lint + Tests + Smoke-Tests bei jedem Push
.github/workflows/tiktok_daily.yml Taeglicher TikTok-Post (Cron)
requirements-dev.txt     Zusaetzliche Dev-Abhaengigkeiten (pytest, ruff)
posted_log.json          Trackt bereits verwendete Zitate/Assets (wird automatisch committet)
tiktok_posted_log.json   Trackt bereits verwendete TikTok-Themen (wird automatisch committet)
```
