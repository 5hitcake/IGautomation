# Sky Tower

Endless-Jumper fürs Handy, angelehnt an den PC-Klassiker *Icy Tower*.
Konzept und Fahrplan: [KONZEPT.md](KONZEPT.md).

## Stand: Prototyp v0.4 (Phasen 1, 3 und 5)

- Automatisches Springen, Sprunghöhe hängt vom Anlauf ab
- Steuerung: linke/rechte Bildschirmhälfte halten (am PC: Pfeiltasten oder A/D, P = Pause)
- Wandabpraller mit Höhenbonus
- Kamera startet ab Etage 5 (spätestens nach 8 s) und wird alle 30 s schneller
- Combos nach Icy-Tower-Regeln (Punkte = Etagen²) mit Combo-Rufen
- 7 Himmelszonen mit Farbübergängen, zerfallende Regenwolken, bewegliche Plattformen
- Wolki mit 6 Gesichtern (Übersicht: `design/wolki-gesichter.png`); das ^^-Gesicht
  im Menü sowie bei Combos ab 25 Etagen und beim Erreichen einer neuen Zone
- Bei „Neuer Rekord!“ jubelt Wolki über dem Ergebnis
- **Skins-Shop (Phase 5):** 12 Skins (Übersicht: `design/wolki-skins.png`) – 4 für Münzen,
  4 über Erfolge (Etage 200/500, 50er-Combo, 100 Runden), 3 Premium (In-App-Käufe folgen
  in Phase 6; die Goldene Wolke gibt es alternativ für 1.000.000 gesammelte Punkte).
  Logik in `src/systems/progress.js`, Grafiken in `src/art.js` (`SKINS`)
- Münzen, lokaler Highscore, Tutorial-Hinweise, Pause, Game-Over-Bildschirm
- Hintergrundmusik (live erzeugt, `src/services/music.js`): 32-Takt-Song mit Strophe,
  Überleitung und Refrain; wird mit jeder Kamerastufe schneller und voller und wechselt
  ab Stufe 3 und 6 einen Halbton höher. Ruhige Fassung im Menü.
- Grafiken im Code gezeichnet (`src/art.js`), Sounds und Musik live synthetisiert
  (`src/services/audio.js`, `src/services/music.js`), beides Platzhalter und später austauschbar

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

- Capacitor-Projekt in `android/`, App-ID `de.wolki.skytower`, nur Hochformat
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
