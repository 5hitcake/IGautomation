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

## 2. Unsere Version

| Bereich | Original | Klapperkiste |
|---|---|---|
| Figuren | Willy Werkel, Hund Buffa | Eigene Figuren (noch offen) |
| Grafik | Handgemalte Szenen | Eigene, selbst erzeugte Bilder (KI-Prompts / Bildprogramme) nach festem Raster, siehe [`assets/RASTER.md`](assets/RASTER.md) |
| Werkstatt | Gemalter Raum | Gemalter Raum mit Tiefe (3D-Wirkung), Auto in Seitenansicht auf der Hebebühne |
| Fahren | Große Karte von oben | Ebenfalls große Karte von oben, aus Abschnitten zusammengesetzt |
| Bedienung | Maus | Touch |
| Werte | Grob | Echte Einheiten: km/h, Steigung in Grad, Reichweite in Metern, kg |

**Rechtliches:** Spielmechaniken sind nicht geschützt, Namen, Figuren, Grafiken,
Musik und Texte des Originals aber schon. Die Bilder des Originals dienen nur
als Stimmung, nichts davon wird übernommen oder als Vorlage für Bilder benutzt.

### Karriere

1. Man startet mit einer **absoluten Schrottkarre**: Bettgestell-Rahmen,
   Schubkarrenräder, Rasenmäher-Motor, Gießkanne als Tank, Küchenstuhl.
2. Erstes Ziel: **bis zum Schrottplatz kommen.** Er wird die eigene Werkstatt.
3. Der **Schrottplatz hat ab und zu neue Teile**: wechselndes Angebot,
   manches nur kurz verfügbar.
4. **Nachbarn geben Aufträge** (liefern, abschleppen, Schnee räumen …). Belohnt
   wird mit Teilen, Geld oder neuen Wegen.

### Wege, die man sich erarbeitet

Die Karte ist von Anfang an groß, aber viele Wege sind erst mit dem passenden
Auto befahrbar:

| Hindernis | Was man braucht |
|---|---|
| Schotter, Matsch | Grip (bessere Reifen) |
| Steigungen | Kraft, wenig Gewicht oder Grip |
| Dunkelheit (Wald, Tunnel, Nacht) | Licht |
| Schafe auf der Straße | Hupe |
| Weite Strecken ohne Tankstelle | Größerer Tank oder sparsamer Motor |
| Schnee | Schneeschild |
| Schmale oder schwache Brücke | Wenig Gewicht |
| Furt, flaches Wasser | Große Räder |
| See (tiefes Wasser) zu den Inseln | Kompletter Satz Ruderboot-Karosserie (alle drei Teile) |

### Achsen

Achsen sind eigene Teile mit Wirkung. Eingebaut wird in fester Reihenfolge:
Rahmen, dann Achsen, dann Räder. Wer die Achse tauscht, muss erst die Räder
abnehmen. Die Details legen wir beim Werkstatt-System fest.

| Achse | Wirkung | öffnet zum Beispiel |
|---|---|---|
| Rostige Achse (Start) | nichts Besonderes, klappert | – |
| Blattfeder-Achse | federt, kein Schaden auf Schotter | Schotter- und Feldwege |
| Hochgelegte Geländeachse | mehr Bodenfreiheit | Furt, Matsch |
| Lenkachse | kleiner Wendekreis | enge Serpentinen |
| Allrad-Achse | treibt auch vorne an, mehr Grip | Schnee, steile Hänge |

### Werkstatt (Entwurf, `design/werkstatt.html`)

- Regal mit **Kategorien** als Vorauswahl: Grundgestell, Achsen, Räder, Motor,
  Energie, Sitz, Lenkung, Licht, Karosserie. Ist eine Kategorie fertig,
  springt das Regal zur nächsten, in der gerade etwas geht.
- Hebebühne mit zwei Ansichten zum Umschalten: **Seite** und **Draufsicht**.
  Achsen baut man in der Draufsicht ein, weil sie von der Seite hinter den
  Rädern liegen. Tippt man in der Seitenansicht auf eine Achse, schaltet die
  Werkstatt selbst um.
- Einbauen per **Tippen** (Teil im Regal antippen, es kommt auf den nächsten
  freien Platz) oder per **Ziehen** (Teil auf einen gelben Platz ziehen; auf
  dem Handy kurz halten, dann ziehen, damit Wischen weiter scrollt). Beim
  Ziehen zeigt die Bühne nur die Plätze, auf die das Teil passt.
- Ausbauen: Teil auf der Bühne antippen, von der Bühne herunterziehen oder
  seine Karte im Regal antippen. Auf einen anderen passenden Platz ziehen
  setzt es um.
- Reihenfolge: Rahmen, dann Achsen, dann Räder. Ausbau in umgekehrter
  Reihenfolge. Fehlt ein Schritt, sagt die Werkstatt, welcher.
- Offen: mehrere Teile pro Kategorie zur Auswahl,
  Werkstatt-Raum mit Tiefe, Fahrerfigur.

### Karosserie

- Jedes Modell besteht aus drei Teilen: **hinten, Mitte, vorne**. Die Teile
  sind auf der Karte und über Aufträge verteilt und werden einzeln gesammelt.
- Ziel: etwa **20 Modelle, also 60 Teile**. Alle Teile passen an alle anderen
  (feste Nähte und Gürtellinie, siehe `assets/RASTER.md`).
- Die Karosserie wird **als Letztes** eingebaut, wenn das Auto fahrbereit ist,
  und muss als Erstes wieder ab.
- Idee: Ein **kompletter Satz** eines Modells (alle drei Teile gleich) gibt
  einen kleinen Bonus. Gemischte Karossen sind erlaubt und gewollt.
- Idee für Dredge: Das Mittelteil bestimmt die **Ladefläche** (Pick-up viel,
  Kugel wenig), hinten und vorne beeinflussen Luftwiderstand und Robustheit.

### Karten-Ideen

- **Zwei Seen mit Inseln.** Die Inseln sind nur mit der **kompletten
  Ruderboot-Karosserie** erreichbar, also hinten, Mitte und vorne vom
  Ruderboot. Einzelne Bootsteile oder die Badewanne reichen nur für Furten
  und flaches Wasser.
- Auf den Inseln liegen lohnende Funde (seltene Teile, Karosserie-Teile
  anderer Modelle, Aufträge).

### Anleihen bei Dredge

- **Ladefläche als Raster:** Fracht und Fundstücke haben Formen und müssen auf
  die Ladefläche passen. Ein größerer Aufbau oder Anhänger bringt mehr Platz.
- **Unterwegs sammeln:** Schrottteile, Fundstücke und Lieferware liegen auf
  der Karte verteilt.
- **Tag und Nacht:** Nachts wird es ohne Licht schwierig, manche Dinge gibt es
  nur nachts.
- **Aufrüsten als Fortschritt:** Jedes neue Teil öffnet sichtbar neue Wege.

## 3. Fahrplan in kleinen Schritten

Was bisher gebaut wurde (Werkstatt mit Code-Grafik, Teststrecke, erster
Kartenentwurf) bleibt als spielbarer Prototyp und Platzhalter, bis die echten
Bilder da sind.

| Schritt | Inhalt | Stand |
|---|---|---|
| **A1** | Teile-Raster festlegen: Boxen pro Kategorie, Seite + Draufsicht, Vorlagen, Werkzeug zum Einpassen und Probe-Zusammenbau, Prompt-Vorlagen | ✅ fertig |
| **A2** | Erste Serie erzeugen: die 7 Teile der Schrottkarre (inkl. Achse), je Seite + Draufsicht | ✅ fertig |
| A3 | Werkstatt-System genauer festlegen (Einbaureihenfolge, Bedienung) und echte Teil-Bilder auf dem Raster zeigen | als Nächstes |
| A4 | Fahrerfigur und Werkstatt-Hintergrund mit Raumtiefe | offen |
| B1 | Fahren von oben: Steuerung und Physik auf einer kleinen Testkarte | offen |
| B2 | Karten-Raster: Abschnitte, Straßenanschlüsse, Maßstab Auto zu Karte | offen |
| B3 | Erster Kartenabschnitt: Zuhause bis Schrottplatz | offen |
| B4 | Hindernisse einzeln einbauen: Schotter, Steigung, Dunkelheit, Schafe, Distanz … | offen |
| C1 | Karriere-Start: mit der Schrottkarre zum Schrottplatz | offen |
| C2 | Schrottplatz mit wechselndem Teile-Angebot | offen |
| C3 | Nachbarn und Aufträge | offen |
| C4 | Ladefläche als Raster, Fundstücke, Tag und Nacht | offen |
| D | App-Verpackung (Android/iOS) | offen |

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
- Teile-Bilder: [`assets/RASTER.md`](assets/RASTER.md) (Regeln und Prompts),
  `assets/raster.json` (Maße), `assets/vorlagen/` (Vorlagen),
  `tools/teilwerk.py` (Vorlagen erzeugen, Bilder einpassen, Probe-Zusammenbau).
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

## 6. Erster Kartenentwurf: Klappertal (wird durch die große Karte ersetzt)

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
