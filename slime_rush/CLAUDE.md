# Slime Rush – Brand Battle Royale

## Idee
Marken zahlen dafür, in einem täglichen, automatisch ablaufenden 2D-Spiel gegeneinander anzutreten.
Der Sieger bekommt 24 h lang den Top-Werbeplatz. Das Spiel läuft als Instagram/TikTok-Reel
(9:16, ca. 2 Minuten). Die Spielfiguren sind süße Glibber-Slimes mit Mützen in Markenfarbe,
im Stil „Cartoon Colorido“. Echte Logos kommen später als Overlay auf die Mützen.

## Zusammenarbeit (Präferenzen des Projektinhabers)
- Antworten bitte **kurz und auf Deutsch + Spanisch (argentinisches Voseo)**.
- Grafiken erzeugt der Nutzer mit externen Bild-KIs. Claude liefert die Prompts (auf Englisch),
  schneidet danach die Bilder aus, stellt sie frei, färbt sie um und baut das Spiel.
- Der Ablauf ist **deterministisch per Seed** (Standard: das Datum). Das ist wichtig für Fairness
  und Nachweisbarkeit. Die Spiellogik nutzt `rnd`, reine Optik nutzt `vr`. Beide nicht vermischen.

## Ordner
| Pfad | Inhalt |
|---|---|
| `vorlagen/` | Original-KI-Bilder (Stil, Slimes, Strecke, Hindernisse) |
| `assets/` | Ausgeschnittene Objekte (PNG) und Hintergründe (`bg_dschungel/eis/lava.jpg`) |
| `sprites/<farbe>/` | Slimes in rot/gruen/lila/blau mit 5 Posen: idle, jump, hit, eliminated, victory |
| `audio/musik_rennen.wav` | KI-Musik (Hugging Face Space `victor/MiniMax-Music3-Jam`, 44,6 s, wird geloopt). Lizenz vor kommerzieller Nutzung prüfen! |
| `reel/reel.js` | **Reel-Engine 2.0** (Canvas 2D, 540×960 intern) |
| `reel/assets.js` | Alle Bilder als Data-URIs, erzeugt von `tools/make_assets_js.py` |
| `charaktere_d/` | Figuren „Konzept D – Festival“ (aus `vorlagen/charaktere_konzepte.png`, freigestellt mit rembg isnet-anime). Posen idle/run1/run2/jump/hit, abgeleitet aus einem Bild (keine echten Neuzeichnungen) |
| `reel/cast_d.js`, `reel/assets_d.js` | Besetzung D: 6 Figuren, nur Hindernisrennen → Podest (Titel „BRAND ARENA“) |
| `proto/` | Erster spielbarer Prototyp (nur Rennen, 960×540), veraltet |
| `tools/` | Build-, Test- und Render-Skripte |
| `beispiel/` | Beispiel-Ergebnis-JSON eines Reels |

## Befehle
Voraussetzungen: `node` mit `playwright` (Chromium), `ffmpeg`, `python3` mit `numpy` und `pillow`.

```bash
cd slime_rush
python3 tools/make_assets_js.py              # nach Bildänderungen: reel/assets.js neu bauen
bash tools/build_reel_html.sh                # -> slime_rush_reel.html (im Browser abspielbar, ?seed=xyz)
node tools/sim_check.js 2026-11-20 30,60     # schneller Simulationstest + Screenshots bei 30 s / 60 s
CAST=d node tools/make_reel2.js test-1       # Testrennen mit Figuren aus Konzept D (~52 s)
node tools/make_reel2.js 2026-11-20          # fertiges MP4 (1080x1920, 30 fps, Musik + SFX), ca. 4 min
python3 tools/cut_objects.py bild.png assets/ name1,name2,...   # Objekt-Sheet zerschneiden
```
`make_reel2.js` schreibt zusätzlich `reel_<seed>.json` mit Seed, Spielen und Podest als Nachweis.

## Aufbau der Reel-Engine (`reel/reel.js`)
- **12 Marken** im Array `BRANDS` (zurzeit Parodie-Namen als Platzhalter), je eine von 4 Slime-Farben.
- **Ablauf:** Intro (Hook „12 MARKEN – NUR 1 GEWINNT“) → 3 zufällige Minispiele aus `GAMES`
  (KEEP = 12→8→5→3) → Finale `FINALE` „Kronenjagd“ (Turm klettern) → Podest-Szene.
- **Minispiele in `GAMES`:** `race` (Hindernisrennen), `meteor`, `ice` (Dünnes Eis), `sumo`, `bomb`.
  Jedes Spiel hat `setup(keep)`, `update()` und `draw()`. Eliminieren immer über `eliminate()` bzw.
  `killSome()`, die nie unter `keep` fallen.
- `gameScene` übernimmt die Phasen title → count (3-2-1) → play → result.
- **Ton:** `sfx(typ)` loggt Ereignisse `[frame, typ]` in `EVENTS`. `tools/mix_audio.py` synthetisiert
  daraus die Effekte und mischt sie mit der geloopten Musik.
- **Steuerung von außen:** `window.reelStep()` rechnet einen Frame (true = fertig), dazu kommen
  `window.REEL_INFO` und `podiumRank`.
- Texte stehen zweisprachig auf DE + ES im Bild.

## Offene Ideen / nächste Schritte
- Echte Marken-Logos als Overlay auf die Mützen (Parodie-Namen ersetzen)
- KI-Kommentator-Stimme (TTS, z. B. HF Space ResembleAI/Chatterbox) und zweiter Musiktrack fürs Finale
- **Fairness-Test** über viele Seeds (jede Marke ca. gleich oft Sieger?), rechtlich wichtig
- Automatisches tägliches Rendern und Posten über die Posting-Skripte dieses Repos (`scripts/`)
- Dateigröße des MP4 reduzieren (zurzeit ca. 50 MB bei crf 19)
