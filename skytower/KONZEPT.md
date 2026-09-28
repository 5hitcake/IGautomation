# Sky Tower – Game-Design-Konzept (Entwurf v0.2)

> Status: **v0.2**. Entschieden: Steuerung, Zwischenwerbung, Sound-Quelle (✅).
> Punkte mit ❓ sind noch offen, jeweils mit Optionen und einer Empfehlung (⭐).

---

## 1. Überblick

| | |
|---|---|
| **Genre** | Endless Vertical Jumper, inspiriert von *Icy Tower* |
| **Plattform** | Android (Google Play Store), später optional iOS |
| **Technik** | Phaser 3 (HTML5) + Capacitor → signiertes App Bundle (`.aab`) |
| **Ausrichtung** | Hochformat, einhändig spielbar |
| **Rundenlänge** | 1–3 Minuten |
| **Stil** | Cartoon/bunt, KI-generierte Grafiken |
| **Thema** | Wolken & Himmel: von den Dächern der Stadt bis ins Weltall |

**Elevator Pitch:** Eine kleine Wolkenfigur hüpft automatisch von Plattform zu
Plattform einen endlosen Himmelsturm hinauf. Du steuerst nur links/rechts.
Wer Schwung holt, springt höher, überspringt ganze Etagen und baut riesige
Combos auf. Der Bildschirm scrollt immer schneller nach oben, und wer
herausfällt, hat verloren.

---

## 2. Kernmechanik

### 2.1 Automatisches Springen
- Die Figur springt **automatisch**, sobald sie auf einer Plattform landet.
- **Sprunghöhe hängt von der Horizontalgeschwindigkeit ab** (wie bei Icy
  Tower): Aus dem Stand erreicht man ca. 1,5 Etagen, mit vollem Anlauf 5+
  Etagen. So bleibt trotz Auto-Sprung viel Können im Spiel.
- **Wandabpraller:** Wer mit hohem Tempo gegen den Rand fliegt, prallt ab,
  behält ~90 % des Tempos und bekommt einen kleinen Höhenbonus. Das ist der
  Profi-Trick für große Combos.

### 2.2 Steuerung
✅ **Steuerungsart:** Standard ist A, B und C gibt es als Option in den Einstellungen.
- **A) Halten links/rechts:** linke oder rechte Bildschirmhälfte gedrückt
  halten = beschleunigen, loslassen = abbremsen. Einfach und präzise.
- **B) Finger-Folgen:** Die Figur läuft Richtung Fingerposition. Sehr intuitiv,
  aber weniger Kontrolle über den Anlauf.
- **C) Neigen:** Neigungssensor. Funktioniert gut, ist in Bus/Bahn aber
  unpraktisch.

### 2.3 Physik-Startwerte (Stand Prototyp v0.1, alle in `src/config.js`)
| Wert | Startwert |
|---|---|
| Logische Breite | 720 (Höhe passt sich dem Handy an) |
| Etagenabstand | 150 px |
| Schwerkraft | 2900 px/s² |
| Grund-Sprunggeschwindigkeit | 1200 px/s (~1,6 Etagen aus dem Stand) |
| Bonus pro Tempo | + 0,9 × horizontale Geschwindigkeit (~5 Etagen mit vollem Anlauf) |
| Max. Laufgeschwindigkeit | 870 px/s |
| Beschleunigung / Richtungswechsel / Abbremsen | 2400 / 4800 / 1400 px/s² |

### 2.4 Kamera & Druck
- Die Kamera steht still, bis der Spieler **Etage 5** erreicht (spätestens
  nach 8 Sekunden), danach scrollt sie konstant nach oben.
- **Alle 30 Sekunden** wird sie schneller („Schneller!“-Einblendung + Sound),
  über 8 Stufen hinweg.
- Ist der Spieler im oberen Bildschirmdrittel, zieht die Kamera mit ihm mit.
- **Game Over**, wenn die Figur unten aus dem Bild fällt.

---

## 3. Punkte & Combo-System

Angelehnt an die Original-Regeln von Icy Tower:

- **Combo-Sprung** = ein Sprung, der **mindestens 2 Etagen** überwindet.
- Eine Combo läuft weiter, solange der nächste Combo-Sprung innerhalb von
  **3 Sekunden** nach der Landung erfolgt (sichtbarer Combo-Balken im HUD).
- Die Combo **endet**, wenn ein Sprung weniger als 2 Etagen schafft oder der
  Timer abläuft.
- Eine Combo zählt nur, wenn sie aus **mindestens 2 Combo-Sprüngen** besteht.

**Punkte:**
```
Score = 10 × höchste Etage  +  Σ (Etagen einer Combo)²
```
Große Combos lohnen sich also überproportional.

**Combo-Rufe** (Text-Einblendung + Stimme):

| Etagen in der Combo | Ruf |
|---|---|
| 4+ | Gut! |
| 7+ | Super! |
| 15+ | Klasse! |
| 25+ | Fantastisch! |
| 35+ | Wahnsinn! |
| 50+ | Himmlisch! |
| 70+ | Überirdisch! |
| 100+ | Kosmisch! |
| 140+ | Unaufhaltsam! |
| 200+ | LEGENDE! |

---

## 4. Der Turm: Zonen & Plattformen

Alle **100 Etagen** wechselt die Zone (Hintergrund, Plattform-Look, Musikvariation).
Alle 50 Etagen gibt es eine breite **Meilenstein-Plattform** mit Etagenschild.

| Etagen | Zone | Plattformen |
|---|---|---|
| 0–99 | **Stadtdächer**: Morgendämmerung, Tauben, Antennen | Dachziegel |
| 100–199 | **Wolkenmeer**: blauer Himmel, Heißluftballons | Flauschwolken |
| 200–299 | **Sonnenuntergang**: orange/rosa, Zugvögel | Regenbogenstücke |
| 300–399 | **Gewitterfront**: Blitzeinschläge | Graue Sturmwolken |
| 400–499 | **Mondnacht**: großer Mond, Schlaflied-Musik | Mondgestein |
| 500–599 | **Polarlicht**: Nordlichter, glatt | Eiskristalle |
| 600–699 | **Stratosphäre**: Erdkrümmung, Wind | Satellitenteile |
| 700–799 | **Weltall**: Sterne, Planeten | Asteroiden |
| 800–899 | **Asteroidengürtel**: Meteoriteneinschläge | Glühende Meteoriten |
| 900–1000 | **Galaxie**: Farbnebel, Warp-Sterne; ab 999 heller Wolkenhimmel, Himmelstor bei 1000 = Ziel | Sternenstaub |

**Schwierigkeit steigt mit der Höhe:**
- Plattformen werden schmaler (100 % → 45 % der Startbreite).
- Ab Etage 100 gibt es **Regenwolken**, die nach der Landung kurz darauf zerfallen.
- Ab Etage 200 gibt es **bewegliche Plattformen** (Vögel, Ballons, Satelliten).
- ❓ Ab Etage 300 **Wind** (leichter seitlicher Drift)? ⭐ Ja, aber schwach.

---

### 4.1 Umgesetzt in v0.6/v0.7
- **Ziel:** Himmelstor bei Etage 1000: kurze Szene (ca. 6 s), +1.000 Münzen und der geheime
  Skin **Engel-Wolki** (nur dort freischaltbar). Das Tor ist die letzte Plattform, darüber
  heller Wolkenhimmel; Wolki fliegt hindurch und die Runde endet mit „Geschafft!“.
- **Regenschirm-Vorrat** (max. 3, bleibt gespeichert): einsammeln oder per Werbung nach Game Over.
- **Power-ups ab Etage 40:** Raketen-Wolke, Regenschirm-Schild, Münz-Magnet, Warp-Stern (Galaxie).
- **Münzen:** Silber (5), Gold (10), Diamant (25) werden mit der Höhe häufiger.
- **Zonen:** Gewitter = Blitze · Polarlicht = glatt · Stratosphäre = Wind · Asteroidengürtel =
  Meteoriten · Galaxie = Warp-Sterne · keine niedrigere Schwerkraft (wäre zu leicht) ·
  eigene Deko und Musik-Klangfarbe je Zone.

## 5. Münzen, Erfolge & Skins

### 5.1 Münzen
- Liegen auf einzelnen Plattformen, häufiger bei Combos (Belohnung für Risiko).
- Gemessen (v0.7): ~40–80 Münzen pro Runde bis Etage 200, ~130–290 bei Etage 400–500
  (Silber/Gold/Diamant weiter oben); Himmelstor +1.000.
- Preise: erster Skin nach ~5 Runden, Regenbogenschweif als Langzeitziel (~15–50 Runden).
- Werden für Skins im Shop ausgegeben.

### 5.2 Skins (Startauswahl, 12 Stück)
| Skin | Freischaltung |
|---|---|
| **Wolki** (Standard-Wölkchen) | von Anfang an |
| Regenwolke | 300 Münzen |
| Sonnenschein | 750 Münzen |
| Vogel Pip | 1.500 Münzen |
| Regenbogenschweif (mit Regenbogen-Schweif) | 3.000 Münzen |
| Heißluftballon | Erfolg: Etage 200 erreichen |
| Blitz | Erfolg: 50er-Combo |
| Astronaut | Erfolg: Etage 500 erreichen |
| Mond (mit Sternschnuppen-Schweif) | Erfolg: 100 Runden gespielt |
| Regenbogen-Einhorn | Premium (In-App-Kauf) |
| Mini-Drache | Premium (In-App-Kauf) |
| Goldene Wolke | Premium oder Erfolg: 1.000.000 Punkte |

Zusätzlich optional: **Sprungspuren** (Glitzer, Regenbogen, Sterne) als
günstigere Sammelobjekte.

### 5.3 Erfolge (werden auch in Google Play Games angezeigt)
Etage 50 / 100 / 200 / 500 / 1000 · Combo 25 / 50 / 100 / 200 · 10 Wandabpraller
in einer Runde · 1.000 Münzen gesammelt · 100 Runden gespielt · alle Zonen gesehen.

---

## 6. Google Play Games

- **Bestenlisten:** Höchster Score · Höchste Etage · Längste Combo
  (je täglich/wöchentlich/gesamt, liefert Google automatisch).
- **Erfolge:** siehe 5.3.
- Anmeldung automatisch im Hintergrund (Play Games v2), das Spiel funktioniert
  aber **auch komplett ohne Anmeldung/offline**; Highscores werden dann lokal
  gespeichert.
- Technik: Capacitor-Plugin für Play Games Services (z. B.
  `@openforge/capacitor-game-connect`; genaue Wahl wird in Phase 4 geprüft).

---

## 7. Monetarisierung

### 7.1 Werbung (Google AdMob)
- ⭐ **Belohnte Werbung** (freiwillig):
  - **Weiterleben** nach Game Over (1× pro Runde, Figur startet auf einer
    Rettungswolke)
  - **Münzen verdoppeln** am Rundenende
- ✅ **Zwischenwerbung** (Vollbild zwischen Runden): **sparsam**, frühestens ab
  Runde 5, danach max. alle 3 Runden und mindestens 3 Minuten Abstand.
- **Kein Banner** während des Spiels (stört auf kleinen Bildschirmen).

### 7.2 In-App-Käufe (Google Play Billing)
| Produkt | Preisvorschlag |
|---|---|
| Werbung entfernen (Zwischenwerbung weg, belohnte bleibt freiwillig) | 2,99 € |
| Premium-Skin (einzeln) | 0,99–1,99 € |
| Münzpaket klein / groß | 0,99 € / 4,99 € |
| ❓ Starterpaket (Werbefrei + 1 Premium-Skin + Münzen) | 4,99 € |

### 7.3 Rechtliches (Pflicht bei Werbung/Käufen)
- **Einwilligungsdialog (DSGVO)** über Googles UMP-SDK vor der ersten Werbung.
- **Datenschutzerklärung** für das Spiel (öffentliche URL, z. B. über GitHub Pages).
- **Händler-Status (EU-DSA):** Wer mit der App Geld verdient, muss sich in der
  Play Console als Händler angeben. Name, Adresse und Kontakt werden dann im
  Store öffentlich angezeigt.
- **Altersfreigabe** über den IARC-Fragebogen in der Play Console.
- ⭐ **Zielgruppe „ab 13“**, nicht „für Kinder“. Bei Kinder-Zielgruppe gelten
  strenge Werbe-Regeln (Families Policy).

---

## 8. Grafik (KI-generiert, Cartoon/bunt)

**Stil-Leitlinie:** weiche, runde Formen, kräftige Pastellfarben, dicke dunkle
Konturen, freundlicher Ausdruck, leichte Schattierung. Alle Assets mit
**transparentem Hintergrund**.

**Vorgehen:**
1. **Charakterblatt** für Wolki erstellen (einheitlicher Look über alle Posen).
2. Daraus Posen/Animationen generieren, freistellen, zu Spritesheets zusammenfügen.
3. Skins als Varianten desselben Charakterblatts.

**Asset-Liste:**
| Asset | Umfang |
|---|---|
| Figur (pro Skin) | Stehen, Sprung aufwärts, Fallen, Combo-Salto (Animation), Game Over |
| Plattformen | 10 Zonen × 3 Varianten (normal, zerfallend, beweglich) + Meilenstein-Plattform |
| Hintergründe | 10 Zonen × 3 Parallax-Ebenen (fern, mittel, nah), nahtlos vertikal kachelbar |
| Deko | Vögel, Ballons, Blitze, Sterne, Planeten |
| UI | Logo, Buttons, Münze, Combo-Balken, Etagenschild, Icons |
| Store | App-Icon 512², Feature-Grafik 1024×500, 4–8 Screenshots |

---

## 9. Sound & Musik

- **Soundeffekte:** Sprung (3 Tonhöhen je nach Kraft), Landung, Wandabpraller,
  Münze, Combo-Start, Combo-Ende, „Schneller!“, Game Over, Menü-Klicks.
- **Combo-Rufe:** gesprochene Stimme für die Rufe aus Kapitel 3.
- **Musik:** ein fröhlicher, loopbarer Haupttrack, der mit der Kamerastufe
  schneller/intensiver wird, plus ein ruhiger Menütrack.
- ✅ **Quelle: gemischt**. Soundeffekte aus CC0-Bibliotheken (z. B. Kenney,
  OpenGameArt), Musik und Combo-Stimme per KI.
- Getrennte Lautstärke-Regler für Musik/Effekte, Vibration an/aus.

---

## 10. Bildschirme & Ablauf

```
Splash ─► Hauptmenü ─┬─► Spiel ─► Game Over ─┬─► Nochmal
                     │                       ├─► Weiterleben (Werbung)
                     │                       └─► Hauptmenü
                     ├─► Skins / Shop
                     ├─► Bestenliste (Play Games)
                     ├─► Erfolge (Play Games)
                     └─► Einstellungen (Steuerung, Sound, Vibration, Datenschutz)
```

- **HUD im Spiel:** Etage · Score · Combo-Zähler + Timer-Balken · Pause-Button.
- **Game Over:** Score, Etage, beste Combo, gesammelte Münzen, neuer Rekord?
- **Tutorial:** 3 kurze Hinweise in der ersten Runde (halten = laufen, Anlauf =
  höher, Combo erklärt).

---

## 11. Technik & Projektstruktur

```
skytower/
├── KONZEPT.md            ← dieses Dokument
├── package.json          (Vite + Phaser 3 + Capacitor)
├── index.html
├── src/
│   ├── main.js
│   ├── scenes/           Boot, Menu, Game, GameOver, Shop, Settings
│   ├── systems/          Physik, Combo, Kamera, Spawner, Zonen
│   ├── services/         Speichern, Play Games, Werbung, Käufe, Audio
│   └── config.js         alle Balancing-Werte an einer Stelle
├── public/assets/        Grafiken, Sounds, Musik
└── android/              Capacitor-Android-Projekt
.github/workflows/skytower-android-release.yml   (signiertes .aab)
```

- **Speichern:** Capacitor Preferences (Highscores, Münzen, Skins, Einstellungen).
- **Ziel:** stabile 60 FPS auf Mittelklasse-Handys, App-Größe < 40 MB.
- **Testen:** Jede Version ist auch als Web-Build im Handy-Browser spielbar,
  ganz ohne Installation.
- Der bestehende Kritzeldrache (`game/`, `android-release.yml`) bleibt unberührt.

---

## 12. Fahrplan

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **1 Prototyp** | Physik, Auto-Sprung, Steuerung, Kamera, Combos, Score, lokaler Highscore – mit einfachen Platzhaltergrafiken | im Handy-Browser spielbar, Balancing testen |
| **2 Grafik & Sound** | Charakterblatt, Zonen, Plattformen, UI, Effekte, Musik | sieht aus wie das fertige Spiel |
| **3 Android-App** | Capacitor, App-Icon, Splash, Build-Workflow, signiertes `.aab` | interner Test über Play Console |
| **4 Play Games** | Anmeldung, Bestenlisten, Erfolge | Online-Rangliste |
| **5 Fortschritt** | Münzen, Shop, Skins, Erfolgs-Freischaltungen | Langzeitmotivation |
| **6 Monetarisierung** | AdMob (belohnt + Zwischenwerbung), Play Billing, Einwilligung, Datenschutz | Einnahmen |
| **7 Release** | Geschlossener Test, Store-Eintrag, Screenshots | Veröffentlichung |

**Wichtig für Phase 7:** Neue private Play-Console-Konten müssen vor der
Veröffentlichung einen **geschlossenen Test mit mindestens 12 Testern über 14
Tage** durchführen. Am besten Tester früh sammeln (Freunde, Familie, Follower).

---

## 13. Was du beisteuern musst

| Wann | Was |
|---|---|
| Phase 3 | Google-Play-Console-Konto (einmalig 25 $), Signatur-Schlüssel als GitHub Secrets |
| Phase 4 | Play-Games-Projekt in der Play Console anlegen (ich liefere eine Schritt-für-Schritt-Anleitung) |
| Phase 6 | AdMob-Konto, Händler-Angaben, Zahlungsprofil |
| Phase 7 | 12+ Tester mit Google-Konto |

---

## 14. Offene Entscheidungen – Übersicht

1. ~~Steuerung~~ ✅ Halten links/rechts
2. **Wind ab Etage 300** (4): ⭐ ja, schwach · nein
3. ~~Zwischenwerbung~~ ✅ sparsam
4. **Starterpaket** (7.2): ja · nein
5. ~~Sound-Quelle~~ ✅ gemischt (CC0-Effekte, KI-Musik/Stimme)
6. **Skin-Liste & Preise** (5.2, 7.2): so übernehmen oder anpassen?
