# Sky Tower

Endless-Jumper fürs Handy, angelehnt an den PC-Klassiker *Icy Tower*.
Konzept und Fahrplan: [KONZEPT.md](KONZEPT.md).

## Stand: Prototyp v0.2 (Phase 1)

- Automatisches Springen, Sprunghöhe hängt vom Anlauf ab
- Steuerung: linke/rechte Bildschirmhälfte halten (am PC: Pfeiltasten oder A/D, P = Pause)
- Wandabpraller mit Höhenbonus
- Kamera startet ab Etage 5 (spätestens nach 8 s) und wird alle 30 s schneller
- Combos nach Icy-Tower-Regeln (Punkte = Etagen²) mit Combo-Rufen
- 7 Himmelszonen mit Farbübergängen, zerfallende Regenwolken, bewegliche Plattformen
- Wolki mit 6 Gesichtern (Übersicht: `design/wolki-gesichter.png`); das ^^-Gesicht
  im Menü sowie bei Combos ab 25 Etagen und beim Erreichen einer neuen Zone
- Münzen, lokaler Highscore, Tutorial-Hinweise, Pause, Game-Over-Bildschirm
- Hintergrundmusik (live erzeugt), wird mit jeder Kamerastufe schneller und voller
- Grafiken im Code gezeichnet (`src/art.js`), Sounds und Musik live synthetisiert
  (`src/services/audio.js`), beides Platzhalter und später austauschbar

## Entwickeln

```bash
npm install
npm run dev            # lokaler Server, im WLAN auch am Handy erreichbar
npm test               # Logik-Tests (Combo/Punkte)
npm run build          # dist/ für Capacitor/Android
npm run build:preview  # eine einzige HTML-Datei zum Testen (dist-single/preview.html)
```

Balancing-Werte (Physik, Kamera, Combos, Zonen) stehen alle in `src/config.js`.
