# Power of Christ

Täglich zwei Reels auf Deutsch für die Instagram-Seite „Power of Christ“:

| Deutsche Zeit | Reel | Inhalt |
|---|---|---|
| Start 06:52, online ca. 07:00 | Vers-Reel (12 s) | Bibelvers über einem Gemälde im Stil der Florentiner Goldgrund-Tafeln (Uffizien) |
| Start 16:22, online ca. 16:35 | Story-Reel (~60 s) | Bibelgeschichte mit Sprecher, 7 gemalten Szenen, Untertiteln, Titel + Kapitelangabe |

- **234 Verse**: Menge-Bibel 1939 (gemeinfrei) + 16 Henoch-Worte in freier Übertragung
- **108 Geschichten**: 51 AT, 42 NT, 15 Buch Henoch; Reihenfolge AT → NT → AT → NT → Henoch
- Bereits Gepostetes steht in `state/history.json` (keine Wiederholungen)

## Ablauf
Der Cloudflare-Zeitgeber (`cloudflare/people_scheduler`, `POC_SLOTS`) startet `.github/workflows/poc_post.yml`.
Der Workflow baut das Reel (`poc/src/run.py build`), legt es auf den Branch `poc-media-verse` bzw.
`poc-media-story` und postet es mit `scripts/publish.py` (Instagram Login, wie die anderen Accounts).
Ergebnis kommt per Telegram. Der Token wird montags von `token_refresh.yml` mit verlängert.

## Secrets
| Secret | Wofür |
|---|---|
| `POWEROFCHRIST_ACCESS_TOKEN`, `POWEROFCHRIST_ACCOUNT_ID` | Posten |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Texte (Workers AI) + Ersatz-Bilder |
| `POLLI_TOKEN` | Bilder (Pollinations FLUX) |
| `ANTHROPIC_API_KEY` (optional) | Wenn vorhanden, schreibt Claude die Texte statt Workers AI |

## Anpassen (`poc/config.yaml`)
- `account.instagram_username` – Nutzername ohne @ (steht im Vers-Bild, Sicherheitscheck vor dem Posten)
- Malstil, Stimme (`de-DE-ConradNeural`), Rotation AT/NT/Henoch
- Musik: lizenzfreie `.mp3` nach `poc/assets/music/` legen (sonst ohne Musik)

## Testen
GitHub → Actions → „Power of Christ (Vers + Bibelgeschichte)“ → Run workflow, `publish` aus →
Video unter *Artifacts* herunterladen.

Profilbild-Vorschläge: `poc/assets/profilbild_kreuz.png`, `poc/assets/profilbild_christus.png`.
