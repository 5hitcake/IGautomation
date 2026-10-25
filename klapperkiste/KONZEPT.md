# Klapperkiste – Konzept & Fahrplan

Arbeitstitel für ein Handyspiel, das die Spielidee von *Autos bauen mit Willy
Werkel* (1997) neu umsetzt: in eigenem Stil, mit eigenen Figuren und für
Touch-Bedienung.

## 1. Was am Original so gut funktioniert

Der Kern-Kreislauf ist einfach und trägt das ganze Spiel:

1. **Bauen:** Auf einen Rahmen kommen Motor, Energie, Räder, Lenkung und
   Extras. Jedes Teil verändert sichtbar die Werte des Autos.
2. **Fahren:** Mit dem eigenen Auto durch eine kleine Welt.
3. **Helfen:** Nachbarn haben Aufgaben, und für jede braucht man eine
   bestimmte Bauweise (stark, geländegängig, mit Kran oder Schneeschild …).
4. **Belohnt werden:** Neue Teile landen auf dem Schrottplatz, und damit
   werden neue Aufgaben möglich.

Es gibt keine Zeitlimits und keinen Game-Over-Druck. Man experimentiert, und
auch eine verrückte Konstruktion darf fahren.

## 2. Was wir anders machen (eigener Stil)

| Bereich | Original | Klapperkiste |
|---|---|---|
| Figuren | Willy Werkel, Hund Buffa | Eigene Mechanikerin mit Mütze und Schweißerbrille (Name offen) |
| Grafik | Handgemalte 2D-Szenen | Kräftige Tusche-Kontur, flache Farben, Werkstatt in Dunkeltürkis mit Senfgelb |
| Bedienung | Maus, Drag & Drop | Touch: Antippen setzt das Teil automatisch ein, Ziehen für Feinarbeit |
| Werte | Versteckt / grob | Echte Einheiten: km/h, maximale Steigung in Grad, Reichweite in Metern, kg |
| Physik | Geskriptet | Kleine echte Physik: Kraft gegen Gewicht, Grip gegen Hangneigung, Verbrauch |

**Rechtliches:** Spielmechaniken sind nicht geschützt, Namen, Figuren, Grafiken,
Musik und Texte des Originals aber schon. Deshalb übernehmen wir nichts davon,
sondern nur die Idee „Auto aus Schrott bauen und damit Aufgaben lösen“.

## 3. Fahrplan

| Schritt | Inhalt | Stand |
|---|---|---|
| **1** | Werkstatt: Teile-Katalog, Drag & Drop auf Slots, Werte-Tafel, Prüfung „fahrbereit?“, Probefahrt auf einer Teststrecke | ✅ fertig |
| **1b** | Gestaltung: alle 24 Teile mit Fundort und eigenem Aussehen, Karte vom Klappertal mit 9 Orten, Nachbarn, Aufträgen und Belohnungen (`design/gestaltungsbuch.html`) | ✅ Entwurf 1, wartet auf Feedback |
| 2 | Spielgefühl: Sounds (Motor je Typ, Schrauben, Hupe), Partikel, Wackeln beim Einbauen, Tutorial durch die Mechanikerin | offen |
| 3 | Welt spielbar machen: Karte als Bildschirm, zu den 9 Orten fahren, Aufträge prüfen und Teile freischalten | offen |
| 4 | Fortschritt: Teile freischalten, Schrottplatz zum Stöbern, Speichern mehrerer Autos in der Garage | offen |
| 5 | Mehr Teile & Lackierung: Farben, Aufkleber, Spezialteile (Schwimmkörper, Propeller) | offen |
| 6 | App-Verpackung: Capacitor (Android/iOS), Icon, Splash, Offline-Schriften, Store-Einträge | offen |

## 4. Technik

- **Reines HTML5/Canvas/JavaScript**, keine Abhängigkeiten. Läuft im Browser
  und später unverändert in einer Capacitor-App (wie schon beim Kritzeldrachen
  in diesem Repo).
- Aufteilung in `src/`:
  - `parts.js` – Teile-Katalog (nur Daten, neue Teile kommen nur hier dazu)
  - `car.js` – Bauplan-Regeln, Werte, Fahrphysik (ohne DOM, testbar)
  - `track.js` – Teststrecke
  - `world.js` – Orte, Nachbarn, Aufträge, Belohnungen, Auftrags-Prüfung
  - `map.js` – Kartenzeichnung vom Klappertal
  - `art.js` – alle Grafiken als Canvas-Code
  - `garage.js` – Werkstatt-Bildschirm
  - `drive.js` – Probefahrt
  - `main.js` – Start, Speichern
- Tests: `node --test klapperkiste/tests/*.test.js`. Sie prüfen unter anderem,
  dass die Teststrecke verschiedene Bauweisen belohnt: Kinderwagenräder
  scheitern am 28°-Hang, Autoreifen am 42°-Hang, Traktorreifen schaffen alles.
  `world.test.js` probiert alle Bauweisen durch und stellt sicher, dass jeder
  Auftrag mit den bis dahin gewonnenen Teilen lösbar ist, aber nicht schon
  mit den Startteilen.

## 5. Ausprobieren

`klapperkiste/index.html` im Browser öffnen, am besten mit dem Handy im
Querformat. Lokal geht auch:

```bash
cd klapperkiste && python3 -m http.server 8000
```

`node klapperkiste/build-artifact.mjs ausgabe.html` erzeugt eine einzelne
HTML-Datei mit allen Skripten, z. B. für eine schnelle Vorschau.

## 6. Die Welt: Klappertal (Entwurf 1)

| Nr. | Ort | Nachbar | Das Auto braucht | Belohnung |
|---|---|---|---|---|
| ★ | Schrottplatz | Rita, Mechanikerin | – | Startteile |
| 1 | Dorfplatz | Bruno, Bäcker | ab 50 km/h | Autoreifen, Scheinwerfer, Anhängerkupplung |
| 2 | Hof Krautkopf | Hilde, Bäuerin | Steigung ab 25°, etwas zum Ziehen | Traktorreifen, Traktor- und Lieferwagen-Rahmen |
| 3 | Leuchtturm | Lotte, Leuchtturmwärterin | Licht, Robustheit ab 4 | Ballonreifen, Wellblechdach |
| 4 | Unkenmoor | Ulla, Moorforscherin | Grip ab 7, höchstens 130 kg | Waschmaschinen-Motor, Autobatterie |
| 5 | Gipfelhütte | Sepp, Hüttenwirt | Steigung ab 40°, Reichweite ab 1500 m | Schneeschild, Bettlaken-Segel |
| 6 | Frostpass | Frost, Wetterforscherin | Schneeschild, Robustheit ab 6 | Dicker V8, Ölfass-Tank |
| 7 | Kiesrennbahn | Frieda, Rennfahrerin | ab 100 km/h | Turbo-Auspuff, Holz-Lenkrad |
| 8 | Steinbruch | Rocko, Sprengmeister | Robustheit ab 10, Steigung ab 30° | Abschleppkran, Blaulicht |
| 9 | Feuerwache | Funke, Feuerwehrfrau | Kran, Blaulicht | Goldener Schraubenschlüssel |

Alle Namen sind Platzhalter, bis die Figuren festgelegt sind.
