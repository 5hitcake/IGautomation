# Wolki: Sky Climber

Endless-Jumper fürs Handy, angelehnt an den PC-Klassiker *Icy Tower*.
Konzept und Fahrplan: [KONZEPT.md](KONZEPT.md).

## Stand: v0.9 – Vorbereitung für den Play Store

- **Sprachen:** Deutsch und Englisch nach Handy-Sprache (`src/i18n.js`, Texte als `tr('Deutsch', 'English')`)
- **Leistung:** Plattformen als Canvas-Texturen, feste Vektorgrafiken als Bilder vorberechnet
  (`bakeGraphics` in `src/view.js`) – keine Ruckler mehr beim Start und in höheren Zonen

- Automatisches Springen, Sprunghöhe hängt vom Anlauf ab
- Steuerung (im Menü wählbar): linke/rechte Bildschirmhälfte halten **oder Handy neigen**
  (stufenlos, `src/services/tilt.js`; ohne Sensor automatisch Tippen). Am PC: Pfeiltasten oder A/D, P = Pause
- Wandabpraller mit Höhenbonus
- Kamera startet ab Etage 5 (spätestens nach 8 s) und wird alle 30 s schneller
- Combos nach Icy-Tower-Regeln (Punkte = Etagen²) mit Combo-Rufen
- 10 Himmelszonen (je 100 Etagen, Übersicht: `design/zonen-10.png`) mit Farbübergängen, zerfallende Regenwolken, bewegliche Plattformen
- Wolki mit 6 Gesichtern (Übersicht: `design/wolki-gesichter.png`); das ^^-Gesicht
  im Menü sowie bei Combos ab 25 Etagen und beim Erreichen einer neuen Zone
- Bei „Neuer Rekord!“ jubelt Wolki über dem Ergebnis
- **Skins-Shop (Phase 5):** 12 Skins plus 4 geheime (Alien-Wolki ab Etage 800, Roboter-Wolki
  für eine 100er-Combo, Stern-Wolki für den perfekten Aufstieg, Engel-Wolki am Himmelstor –
  im Shop erst sichtbar, wenn freigeschaltet) (Übersicht: `design/wolki-skins.png`) – 4 für Münzen,
  7 über Erfolge (Etage 200/500/700, 50er-/75er-Combo, 100 Runden, 1.000.000 Punkte). Einhorn,
  Mini-Drache und Goldene Wolke sind als spätere In-App-Käufe vorgemerkt (`iap`).
  Logik in `src/systems/progress.js`, Grafiken in `src/art.js` (`SKINS`)
- Schweife (`src/systems/trail.js`): Regenbogenschweif (Nyan-Stil) und Sternschnuppe (Mond),
  im Spiel, im Menü (Wolki fliegt dann statt zu hüpfen) und als Vorschau im Shop
- **Ziel: Himmelstor bei Etage 1000** – kurze Szene (Lichtstrahlen, Blitz, Feuerwerk), +1.000 Münzen
  und der geheime Skin **Engel-Wolki** (Flügel, Heiligenschein, goldener Schweif), der im Shop
  vorher gar nicht zu sehen ist (`design/himmelstor-szene.png`). **Perfekter Aufstieg** (Tor ohne Regenschirm und ohne Weiterspielen):
  +2.000 Münzen extra und die geheime Stern-Wolki (Wolki wird komplett zum Stern ⭐, mit Sternenstaub-Schweif). Das Tor ist die letzte Plattform:
  ab Etage 999 wird der Himmel hell und wolkig, Wolki fliegt durchs Tor und die Runde endet mit „Geschafft!“
- **Power-ups ab Etage 40, bewusst selten** (höchstens eins je 60 Etagen, im Schnitt etwa alle 130) (`src/systems/powerups.js`): Raketen-Wolke (+30 Etagen, zählt als
  Combo), Regenschirm (rettet vorm Absturz; Vorrat bis 3, bleibt über Runden erhalten,
  wird eingesammelt; Anzeige oben rechts im HUD), Münz-Magnet (10 s), in der Galaxie Warp-Sterne
- **Weiterspielen** nach einem Absturz ohne Regenschirm: 1× pro Runde gratis (`REVIVE` in
  `src/config.js`, später per belohnter Werbung) – ein Regenschirm fängt Wolki auf, nach einem
  Countdown (3 – 2 – 1 – Los!) geht die Runde weiter
- **Wertvollere Münzen weiter oben:** Silber (5), Gold (10), Diamant (25)
- **Zonen-Mechaniken** (`ZONE_RULES` in `src/config.js`): Gewitter mit Blitzeinschlägen
  (`src/systems/hazards.js`), rutschiges Eis im Polarlicht, Wind in der Stratosphäre,
  Meteoriteneinschläge im Asteroidengürtel, Warp-Sterne in der Galaxie (Schwerkraft bleibt überall gleich)
- 5 verschiedene Planeten, großer Mond, Satelliten und Felsbrocken – bewusst sparsam verteilt
- **Mehr Atmosphäre:** Nordlichter, Wetterleuchten, Sternschnuppen, Nebel (Übersicht:
  `design/zonen-uebersicht.png`, `design/neu-oben.png`)
- **Musik je Zone:** eigene Klangfarbe, im Gewitter in Moll, im Weltall schwebend (lydisch)
- Münzen, lokaler Highscore, Tutorial-Hinweise, Pause (weiter mit Countdown 3 – 2 – 1 – Los!), Game-Over-Bildschirm
- Hintergrundmusik (live erzeugt, `src/services/music.js`): 32-Takt-Song mit Strophe,
  Überleitung und Refrain; wird mit jeder Kamerastufe schneller und voller und wechselt
  ab Stufe 3 und 6 einen Halbton höher. Ruhige Fassung im Menü.
- Grafiken im Code gezeichnet (`src/art.js`), Sounds und Musik live synthetisiert
  (`src/services/audio.js`, `src/services/music.js`), beides Platzhalter und später austauschbar

## Test-Werkzeuge

In Test-Versionen (Browser-Testseite, Test-APK) aktiv, im Store-Build aus:

- Beim ersten Start einmalig **10.000 Münzen**
- Im Shop **5× auf den Münzstand** tippen: +10.000 Münzen
- Im Shop **5× auf „Skins“** tippen: alle Skins freischalten, auch die geheimen

Store-Build ohne Test-Werkzeuge: `SKYTOWER_RELEASE=1 npm run build`

## Play Store

- Store-Material in `store/`: Icon, Titelbild, Screenshots (DE/EN), Texte und Formular-Antworten
  (`store/STORE-EINTRAG.md`), Datenschutzerklärung (`store/datenschutz.html`) und die
  Schritt-für-Schritt-Anleitung `store/ANLEITUNG-PLAY-CONSOLE.md`
- Store-Build: `SKYTOWER_RELEASE=1 npm run build && npx cap sync android && (cd android && ./gradlew bundleRelease)`;
  signiert mit dem Upload-Schlüssel aus `android/keystore.properties` (nicht im Repository)

## Entwickeln

```bash
npm install
npm run dev            # lokaler Server, im WLAN auch am Handy erreichbar
npm test               # Logik-Tests (Combo/Punkte)
npm run build          # dist/ für Capacitor/Android
npm run build:preview  # eine einzige HTML-Datei zum Testen (dist-single/preview.html)
```

Balancing-Werte (Physik, Kamera, Combos, Zonen) stehen alle in `src/config.js`.

## Android-App (Phase 3)

- Capacitor-Projekt in `android/`, App-ID `de.wolki.skyclimber`, nur Hochformat
- Zurück-Taste: im Spiel Pause, in der Pause weiter, im Menü App schließen (`src/services/native.js`)
- App-Icon und Startbildschirm mit Wolki: `PLAYWRIGHT=… node scripts/make-icons.mjs`
- **Test-APK automatisch:** Der Workflow `.github/workflows/skytower-apk.yml` baut bei jeder
  Änderung an `skytower/` eine APK und legt sie unter *Releases → Sky Tower Testversion* ab.
- Test-APKs sind mit einem festen Test-Schlüssel (`android/app/debug.keystore`) signiert,
  damit Updates die installierte App überschreiben. Für den Play Store kommt ein
  eigener, geheimer Release-Schlüssel.

Lokal bauen (braucht Java 21 und das Android SDK):

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug   # -> app/build/outputs/apk/debug/app-debug.apk
```
