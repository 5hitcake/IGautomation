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

**„These people do not exist“ (eigener Instagram-Account, englisch)** – 3× täglich
ein fotorealistisches KI-Portrait einer Person, die es nicht gibt, kostenlos über
Cloudflare Workers AI (`people_post.yml`, Details unter
[These people do not exist](#these-people-do-not-exist)).

**Story-Reels (2 Themen-Accounts)** – täglich je ein ~1-Minuten-Reel mit Sprecher, Szenenbildern und eigenem Song:
wahre Gruselgeschichten und Rätsel/Verschwörungen mit wahrem Kern (`story_reels.yml`,
Details unter [Story-Reels](#story-reels-wahre-gruselgeschichten--rätsel--verschwörungen)).

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
4. Liegt ein Track in `assets/tiktok_music/`, wird er per ffmpeg (`amix`, deutlich
   gedämpft, `MUSIC_VOLUME = 0.15`) unter die Erzählerstimme gemischt - die Stimme
   bleibt dabei unangetastet und klar im Vordergrund, die Musik läuft in einer
   Schleife und wird auf die Länge der Erzählung zugeschnitten. Ohne Dateien dort
   bleibt es beim reinen Erzähler-Ton (kein Fehler, kein Zutun nötig).
5. `scripts/tiktok_publish.py` lädt das Video über die offizielle **TikTok Content
   Posting API** hoch (Direct Post, `FILE_UPLOAD`).
6. Direkt danach postet `scripts/publish.py --post-file assets/tiktok_generated/next_post.json`
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
  das Artefakt) laufen über **FLUX.1-schnell** auf **Cloudflare Workers AI**.
  Lief anfangs über die Hugging-Face-Inference-API
  (`stabilityai/stable-diffusion-3-medium-diffusers`), die aber auf ein reines
  Credits-Modell umgestellt wurde und seitdem mit „no remaining credits" (402)
  ablehnt. Cloudflare Workers AI bietet FLUX.1-schnell - das ursprünglich
  vorgesehene, architektonisch stärkere Modell - mit großzügigem kostenlosem
  Kontingent an.
- **5 einfache Beats** (Ort, Suche, Vertuschung ×2, Follow-CTA - reine Umgebungs-/
  Handlungsbilder ohne kritische Objekt-Interaktion) laufen über ein **selbst gehostetes,
  kostenloses** `nitrosocke/Ghibli-Diffusion`-Modell direkt im GitHub-Actions-Runner
  (CPU, kein GPU nötig - dauert dafür ca. 10-15 Min./Bild. Das ist bewusst so:
  Qualität hat hier Vorrang vor Geschwindigkeit, die Automation läuft ohnehin
  unbeaufsichtigt).

### Schritt 1: Cloudflare Workers AI einrichten

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com) anmelden (bestehender
   oder neuer Account) und die **Account-ID** notieren (rechte Seitenleiste des
   Dashboards, oder unter **Workers & Pages → Overview**).
2. Unter **My Profile → API Tokens → Create Token** einen Token mit der
   Berechtigung **„Workers AI – Edit"** (oder das Template „Workers AI")
   erzeugen.
3. Beide Werte als GitHub Secrets hinterlegen (Settings → Secrets and
   variables → Actions → New repository secret):

| Name | Wert |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Account-ID aus Schritt 1 |
| `CLOUDFLARE_API_TOKEN` | API-Token aus Schritt 2 |

Das kostenlose Kontingent von Workers AI reicht für 4 Bilder/Tag problemlos aus.

### Schritt 2: TikTok Content Posting API einrichten

1. Auf [developers.tiktok.com](https://developers.tiktok.com) anmelden und eine
   neue App anlegen.
2. Produkt **"Content Posting API"** hinzufügen, Scope `video.publish` aktivieren.
3. Über den OAuth-Flow der App einen Access Token für den Ziel-Account erzeugen.
4. Solange die App noch nicht von TikTok freigegeben ist ("in Prüfung"), können
   Videos nur mit `privacy_level: SELF_ONLY` gepostet werden (Standard in
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
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...
python scripts/tiktok_generate_video.py
python scripts/tiktok_publish.py --dry-run
python scripts/publish.py --post-file assets/tiktok_generated/next_post.json --dry-run
```

**Erster echter Post:** Im GitHub-Repo unter **Actions → Daily TikTok Post →
Run workflow** manuell auslösen.

### Musik einbauen

Weder die TikTok Content Posting API noch die Instagram Graph API erlauben es,
programmatisch einen Sound aus der jeweiligen Plattform-Musikbibliothek an ein
hochgeladenes Video anzuhängen - das geht nur manuell in der App. Die Musik wird
deshalb **direkt ins Video eingebettet** (fest im MP4, bevor es hochgeladen wird):

- Lizenzfreie Tracks (mp3/wav/m4a/aac) in `assets/tiktok_music/` ablegen - ein
  zufälliger Track wird automatisch gedämpft unter die Erzählerstimme gemischt.
  Ohne Dateien dort läuft nur die Erzählerstimme (kein Fehler).
- Details, Stil-Empfehlung (dunkel/mysteriös statt Mindset-Motivation) und
  Quellen: `assets/tiktok_music/README.md`.
- Lautstärke-Balance: `MUSIC_VOLUME` in `scripts/tiktok_generate_video.py`
  (Standard `0.15`) steuert, wie leise die Musik unter der Stimme liegt.

### TikTok-Themen erweitern

Neue Themen: in `content/tiktok_topics.json` einen neuen Eintrag mit fortlaufender
`id` ergänzen (Felder wie bei den bestehenden Einträgen). `real_person` auf `null`
setzen für frei erfundene Figuren, oder mit `name` + `description` befüllen, wenn
eine reale Person möglichst akkurat dargestellt werden soll.

---

## Jota-Labs-Stories (@jota_labsweb)

Täglich um ca. **20 Uhr Buenos-Aires-Zeit** postet `jotalabs_story.yml` eine Story
für das Webdesign-Konto **@jota_labsweb**, über dieselbe Instagram Graph API
(`publish.py`, Typ `story`). Das kostet nichts und braucht keine KI-Generierung.

- **Stories**: 14 fertige Bilder (1080x1920, JPEG) in `assets/jotalabs_stories/`, darunter
  Demos, Preise, Ablauf, Tipps und Aufrufe zum Schreiben. Sie werden der Reihe nach gepostet;
  nach der letzten beginnt die Rotation wieder bei `story_01`. Wo sie steht, protokolliert
  `jotalabs_posted_log.json`.
- **Neue Stories**: In `content/jotalabs/stories.html` eine weitere `section` ergänzen
  und mit `node content/jotalabs/render_stories.mjs` neu rendern (braucht Playwright).
  Alternativ einfach ein eigenes JPEG (1080x1920) als `story_15.jpg` usw. in den Ordner legen.
- **Einschränkungen der API**: Link-Sticker, Umfragen und Musik lassen sich per API
  nicht setzen. Deshalb verweisen die Stories auf „Link en la bio“ bzw. aufs Antworten per DM.

### Einrichtung

1. @jota_labsweb in der Instagram-App auf ein **professionelles Konto** umstellen.
2. Wie in [Schritt 2](#schritt-2-instagram-api-einrichten-ohne-facebook-seite) einen Token
   für @jota_labsweb erzeugen: das Konto als Instagram-Tester in der bestehenden Meta-App
   hinzufügen, die Einladung annehmen und auf „Generate token“ klicken.
3. Zwei GitHub Secrets anlegen:

| Name | Wert |
|---|---|
| `JOTALABS_IG_ACCESS_TOKEN` | Long-Lived Token von @jota_labsweb |
| `JOTALABS_IG_ACCOUNT_ID` | Instagram-Account-ID von @jota_labsweb |

4. Test: **Actions → Daily Jota Labs Story → Run workflow**.

Solange die Secrets fehlen, überspringt der Workflow den Lauf mit einer Warnung, statt
fehlzuschlagen. Token-Erneuerung alle ~50 Tage wie unter „Wartung“ beschrieben.

---

## These people do not exist

`people_post.yml` postet **3× täglich** ein fotorealistisches Portrait einer erfundenen
Person auf **@people.that.dont.exist**. Die Zeiten sind auf ein internationales Publikum
ausgelegt: 11:13, 17:13 und 23:43 UTC (Argentinien: 8:13, 14:13, 20:43 Uhr).

| UTC | Argentinien | Was passiert |
|---|---|---|
| 07:30 | 04:30 | Sammel-Freigabe per Telegram: beide Personen für 8:13 und 14:13 Uhr auf einmal |
| 11:13 | 08:13 | Post aus der Warteschlange (`assets/people_queue/`), 1 h später die Story |
| 17:13 | 14:13 | Post aus der Warteschlange, 1 h später die Story |
| 20:43 | 17:43 | Freigabe per Telegram für den Abend-Post |
| 23:43 | 20:43 | Abend-Post, 1 h später die Story |

Bei der Sammel-Freigabe gilt: ohne Antwort bis 8:13 Uhr werden beide gepostet.

- **Freigabe per Telegram** (`scripts/people_review.py`): vor jedem Termin kommt
  das Bild mit Caption in deinen Telegram-Chat, mit den Knöpfen **✅ Posten · 🔄 Neue Person ·
  ❌ Verwerfen**. ✅ postet zum Termin, 🔄 erzeugt einmal eine neue Person, ❌ lässt den Post
  ausfallen. **Ohne Antwort wird zum Termin automatisch gepostet.** Nach dem Posten kommt
  eine Bestätigung, bei Fehlern eine Warnung. Nur Klicks aus deinem eigenen Chat zählen.
  Ohne Telegram-Secrets wird ohne Rückfrage gepostet.

- **Jede Person ist neu**: `scripts/people_generate.py` würfelt Herkunft (32 Gruppen),
  Geschlecht, Alter (nur Erwachsene, 20–85), Frisur, Details, Kleidung, Ort, Licht und
  Kamera-Look aus. Rund die Hälfte wirkt ganz alltäglich. Ca. 40 % bekommen dezente Merkmale
  (Brille, Sommersprossen, kleines Tattoo, Platinblond …). Nur ca. jede 7. Person bekommt
  **ein** auffälliges Merkmal (Neon-Haare, Gesichtstattoo, Septum, Vitiligo, verschiedenfarbige
  Augen …), nie zwei. Kulturelle Kopfbedeckungen wie Hijab oder Turban gibt es nur bei
  passender Herkunft. Herkunft, Ort und Geschlecht+Altersgruppe der letzten 3 Personen werden
  vermieden, und es kommt nie dreimal hintereinander dasselbe Geschlecht.
  Das Gedächtnis liegt in `people_posted_log.json`.
- **Bilder**: kostenlos über Cloudflare Workers AI, in dieser Reihenfolge:
  FLUX-2 Klein 9B → FLUX-2 Klein 4B → Leonardo Lucid Origin. Fällt ein Modell aus, wird
  automatisch das nächste genommen. Ausgabe: JPEG 1080×1350 (4:5).
- **Gratis-Kontingent**: 10.000 Neurons pro Tag (Reset 00:00 UTC). FLUX-2 Klein 9B
  braucht ca. 1.450 pro Bild, 3 Posts kosten also ca. 4.400. Teure Modelle wie FLUX-2 Dev
  (8.000+) sind deshalb nicht in der Kette.
- **Mix aus Bild und Reel**: Der Morgen-Post (8:13 AR) ist ein Bild-Post, die Posts um 14:13 und
  20:43 AR sind Reels (`REEL_SLOTS` in `people_post.yml`). Reels lassen sich insgesamt über
  `REEL_ENABLED` ein- und ausschalten, sie sind aus, bis der eigene Song da ist.
- **Reels** (`scripts/people_reel.py`, 9 s, 1080×1920): Nahaufnahme der
  Augen mit Zoom heraus („Look closely.“ → „Do you know this person?“), Glitch-Effekt mit Blitz,
  „Nobody does.“ → „THIS PERSON DOES NOT EXIST“, am Ende zerfällt das Gesicht in Pixel und es
  erscheinen Nummer, Name, Alter und der Doppelgänger-Aufruf. Unterlegt ist der eigene Song
  `assets/people_music/theme.*` (KI-generiert mit ACE-Step, frei von Rechten Dritter). Titelbild
  ist der Moment mit „THIS PERSON DOES NOT EXIST“. Die Videos liegen nicht in `main`, sondern auf
  dem Branch `people-media`, der bei jedem Post überschrieben wird. So wächst das Repo nicht.
- **Story zu jedem Post** (`scripts/people_story.py`): 60 Minuten nach dem Feed-Post kommt
  eine Story (1080×1920) mit dem Portrait als Karte auf unscharfem Hintergrund, „THIS PERSON
  DOES NOT EXIST“, Nummer, Name und Alter sowie dem Doppelgänger-Aufruf. Die Verzögerung
  steht in `people_post.yml` (`STORY_DELAY_MINUTES`, 0 = gleichzeitig). **Musik, Link- und
  Umfrage-Sticker sind über die Instagram-API nicht möglich**, nur beim manuellen Posten in der App.
- **Reservebilder**: Ist das Kontingent leer oder fallen alle Modelle aus, wird das nächste
  unbenutzte Bild aus `assets/people_reserve/` genommen (Freigabe per Telegram wie immer,
  markiert als „♻️ Reservebild“). Jedes Reservebild wird höchstens einmal gepostet. Nachfüllen:
  JPEG in 1080×1350 dort ablegen und in `reserve.json` eintragen.
- **Beispielbilder**: `python scripts/people_generate.py --samples 5` legt 5 Bilder plus
  Captions in `assets/people_samples/` ab, ohne Zähler und Log zu ändern.
- **Caption (englisch)**: Hook („This person does not exist.“), laufende Nummer mit
  fiktivem Vornamen und Alter, ein Doppelgänger-Aufruf („Tag their real-life
  doppelgänger 👇“), die KI-Kennzeichnung und 10 Hashtags.
- **Repo-Größe**: Im Ordner `assets/people_generated/` bleiben nur die letzten 12 Bilder
  liegen. Die Git-Historie wächst trotzdem um ca. 250 KB pro Bild.

### Einrichtung

1. Neuen Instagram-Account anlegen und in der App auf ein **professionelles Konto**
   (Creator oder Business) umstellen. In die Bio gehört, dass alle Personen KI-generiert
   sind, z. B. „None of these people exist. 100% AI-generated faces. Find your doppelgänger 👇“.
2. Wie in [Schritt 2](#schritt-2-instagram-api-einrichten-ohne-facebook-seite) einen Token
   erzeugen: Den Account als Instagram-Tester in der bestehenden Meta-App hinzufügen, die
   Einladung annehmen und auf „Generate token“ klicken.
3. GitHub Secrets anlegen (die Cloudflare-Secrets sind schon vorhanden):

| Name | Wert |
|---|---|
| `PTNE_API_TOKEN` | Long-Lived Token des neuen Accounts |
| `PTNE_ACCOUNT_TOKEN` | Instagram-Account-ID des neuen Accounts |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID (32 Zeichen) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token mit Workers-AI-Berechtigung |
| `TELEGRAM_BOT_TOKEN` | Token deines Telegram-Bots (von @BotFather) |
| `TELEGRAM_CHAT_ID` | Deine Telegram-User-ID (Zahl, z. B. von @userinfobot) |

**Telegram-Bot einrichten:** In Telegram **@BotFather** öffnen, `/newbot` senden, Namen und
Benutzernamen wählen und den Token kopieren. Dann deinen neuen Bot öffnen und **Start**
drücken, sonst darf er dir nicht schreiben. Deine Chat-ID bekommst du von **@userinfobot**
(die Zahl hinter „Id“).

4. Test: **Actions → These People Do Not Exist → Run workflow**. Das postet wirklich!

Solange die Instagram-Secrets fehlen, überspringen die Läufe mit einer Warnung.
Ein manueller Lauf (**Run workflow**) fragt per Telegram nach und postet nach der
eingestellten Bedenkzeit (Standard: 15 Minuten).
Token-Erneuerung alle ~50 Tage wie unter „Wartung“ beschrieben.

---

## Story-Reels: Wahre Gruselgeschichten + Rätsel & Verschwörungen

Zwei Themen-Accounts, **täglich je ein Reel**, komplett automatisch und **kostenlos**
(`story_reels.yml`):

| Account | Inhalt | Uhrzeit (DE, Winter) |
|---|---|---|
| `horror` | Wahre Gruselgeschichten, Paranormales, Kriminalfälle, Unglücke | 20:07 |
| `mysteries` | Verschwörungen mit wahrem Kern, Ancient Aliens, Rätsel der Geschichte, Weltraum | 18:37 |

### So sieht ein Reel aus (~1 Minute)

1. **Hook** mit Aufhänger in Akzentfarbe („WAHRE GESCHICHTE“, „Wusstest du…?“,
   „Was niemand weiß…“) und einem packenden Satz.
2. **8 Szenen**, jede mit **eigenem, passenden KI-Bild**. Die Bilder bekommen einen langsamen
   Zoom und werden weich überblendet.
3. **Sprecher**: eine tiefe deutsche Männerstimme liest alles vor. Sie wird zusätzlich
   tiefer gepitcht und mit Bass und leichtem Hall nachbearbeitet. Der Text steht mit im
   Bild, gesprochene Wörter leuchten auf, wichtige Wörter sind farbig.
4. **Folge-Aufruf** mit deinem @Handle (gesprochen + eingeblendet), zurück zum Titelbild,
   damit das Reel sauber loopt.
5. **Eigener Titelsong pro Seite** leise unter der Stimme (siehe „Musik“).

Bildstil passend zu den bisherigen Reels: Grusel = dunkle, realistische Malerei,
Rätsel = gemalter Anime-Look. Caption + Hashtags werden automatisch gebaut.

### Bilder: Kontingent

Pro Reel entstehen 9 Bilder (Hook + 8 Szenen), also 18 pro Tag für beide Seiten.
**Cloudflare Workers AI reicht dafür aus**: FLUX-2 Klein 4B kostet ca. 160 der 10.000
kostenlosen Neurons pro Tag und Bild, zusammen also ca. 3.000. Der People-Account braucht
ca. 4.400. Ist das Kontingent doch einmal leer, wird automatisch FLUX-1 Schnell (ca. 60 pro Bild)
versucht, danach optional **Pollinations** (kostenloser Schlüssel von
[enter.pollinations.ai](https://enter.pollinations.ai), als Secret `POLLI_TOKEN`).
Erst wenn alles scheitert, kommt ein dunkler Verlaufshintergrund.
Mehr Bilder? Der Cloudflare-Plan „Workers Paid“ (5 $/Monat) behält die 10.000 Gratis-Neurons
und berechnet darüber ca. 0,002 $ pro Bild.

### Einrichtung (einmalig)

1. **Handles eintragen**: In `content/story_reels/horror.json` und `mysteries.json`
   jeweils `"handle": "@DEIN_..._ACCOUNT"` durch den echten Account-Namen ersetzen.
2. **Instagram-Zugang pro Account** wie in Schritt 2 oben beschrieben erzeugen
   (beide Accounts als Tester in derselben Meta-App reicht) und als GitHub Secrets hinterlegen:

| Name | Wert |
|---|---|
| `HORROR_IG_ACCESS_TOKEN` / `HORROR_IG_ACCOUNT_ID` | Grusel-Account |
| `MYSTERY_IG_ACCESS_TOKEN` / `MYSTERY_IG_ACCOUNT_ID` | Rätsel-Account |

   Ist einer der beiden Accounts der bestehende zweite Account (@weirdworld), einfach die
   Werte von `WEIRDWORLD_IG_ACCESS_TOKEN` / `WEIRDWORLD_IG_ACCOUNT_ID` erneut eintragen.
   Dann aber den TikTok-Workflow für Instagram abschalten, sonst kommen zwei Reels am Tag.
3. `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` sind schon da (People-Account).
   Optional als Reserve: `POLLI_TOKEN` (siehe „Bilder: Kontingent“).
4. **Testen**: Actions → *Story Reels (Grusel + Rätsel)* → *Run workflow* → Häkchen
   bei „Auch auf Instagram posten?“ **entfernen**. Dann wird nur das Video gebaut, und
   du kannst es unten im Lauf unter **Artifacts** herunterladen und anschauen.

### Musik

Jede Seite hat einen **eigenen Titelsong**, komplett im Code komponiert und gerendert
(`scripts/compose_theme.py`, keine Samples und damit keine Lizenzfragen):

- **Grusel – „Hinterland“**: D-Moll, 60 BPM. Spieluhr-Wiegenlied mit Tritonus, tiefe
  Drones, Streicherflächen, Herzschlag, kalter Wind.
- **Rätsel – „Ancient Signal“**: E-Phrygisch, 90 BPM. Pulsierendes Bass-Arpeggio,
  Chorflächen, Trommeln, Glocken-Melodie.

Die Songs liegen als `assets/story_music/<account>/theme.mp3` und loopen nahtlos. Neu erzeugen
oder anpassen: `python scripts/compose_theme.py`. Eigene Tracks kannst du zusätzlich in den
Ordner legen, dann wird pro Reel zufällig gewechselt.

### Sprecher

Standard ist `de-DE-KillianNeural` (die tiefste deutsche Stimme von edge-tts, kostenlos und
ohne Kontingent), plus Nachbearbeitung im Code (`DARK_VOICE_FILTER` in `story_reel.py`):
ca. 2,4 Halbtöne tiefer, mehr Bass, Kompressor, leichter Hall. Andere Stimme: in der
Account-Datei `"voice"` ändern (z.B. `de-DE-ConradNeural`). Ohne Sprecher:
`"voiceover": false`, dann richten sich die Szenen nach der Lesezeit.

Warum nicht Cloudflare oder Hugging Face? Cloudflare hat keine deutsche Stimme (nur Englisch
und Spanisch), und die Hugging-Face-Gratis-GPU-Zeit reicht nicht für tägliche Minuten-Reels.

### Neue Geschichten hinzufügen

Einfach am Ende von `"stories"` in der jeweiligen JSON-Datei einen Eintrag ergänzen:

```json
{
  "id": "eindeutige_id",
  "hook": {"text": "Packender erster Satz mit *hervorgehobenen Wörtern*.",
           "image": "englische Bildbeschreibung fürs Titelbild"},
  "scenes": [
    {"text": "Szene 1 (ca. 12-25 Wörter)", "image": "englische Bildbeschreibung"},
    {"text": "Szene 2", "image": "..."},
    "… insgesamt 6-10 Szenen, zusammen ca. 100-150 Wörter = ~1 Minute"
  ],
  "tags": ["#extrahashtag"]
}
```

Bildbeschreibungen auf Englisch und ohne Gewalt/Gore (das blockieren die Bildmodelle).
Neue Einträge kommen der Reihe nach dran. Sind alle Geschichten gepostet, beginnt der
Zyklus von vorn (die älteste zuerst). Aktuell: 20 Grusel- und 22 Rätsel-Geschichten à 8 Szenen,
also ca. 3 Wochen ohne Wiederholung.

Lokal testen (ohne API-Aufrufe, Video landet in `assets/story_reels/<account>/`):
```
python scripts/story_reel.py --account horror --story dyatlov --dry-run --preview
```

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
assets/tiktok_music/  Optionale lizenzfreie Musiktracks fuer TikTok-Videos (von dir befuellt)
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
assets/jotalabs_stories/ Fertige Story-Bilder fuer @jota_labsweb
content/jotalabs/        HTML-Vorlage + Render-Skript fuer die Jota-Labs-Stories
jotalabs_posted_log.json Merkt sich die zuletzt gepostete Jota-Labs-Story (wird automatisch committet)
scripts/people_generate.py   Wuerfelt eine erfundene Person + erzeugt das Portrait (Cloudflare)
assets/people_generated/     Die letzten Portraits + next_post.json (Output)
people_posted_log.json       Zaehler + Gedaechtnis der letzten Personen (wird automatisch committet)
.github/workflows/people_post.yml 3x taeglicher Post "These people do not exist"
```
