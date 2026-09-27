# Sky Tower

Endless-Jumper fürs Handy, angelehnt an den PC-Klassiker *Icy Tower*.
Konzept und Fahrplan: [KONZEPT.md](KONZEPT.md).

## Stand: Prototyp v0.1 (Phase 1)

- Automatisches Springen, Sprunghöhe hängt vom Anlauf ab
- Steuerung: linke/rechte Bildschirmhälfte halten (am PC: Pfeiltasten oder A/D, P = Pause)
- Wandabpraller mit Höhenbonus
- Kamera startet ab Etage 5 und wird alle 30 s schneller
- Combos nach Icy-Tower-Regeln (Punkte = Etagen²) mit Combo-Rufen
- 7 Himmelszonen mit Farbübergängen, zerfallende Regenwolken, bewegliche Plattformen
- Münzen, lokaler Highscore, Tutorial-Hinweise, Pause, Game-Over-Bildschirm
- Grafiken im Code gezeichnet (`src/art.js`), Sounds live synthetisiert (`src/services/audio.js`),
  beides Platzhalter und später austauschbar

## Entwickeln

```bash
npm install
npm run dev            # lokaler Server, im WLAN auch am Handy erreichbar
npm test               # Logik-Tests (Combo/Punkte)
npm run build          # dist/ für Capacitor/Android
npm run build:preview  # eine einzige HTML-Datei zum Testen (dist-single/preview.html)
```

Balancing-Werte (Physik, Kamera, Combos, Zonen) stehen alle in `src/config.js`.
