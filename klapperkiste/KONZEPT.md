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
2. **Start in der Werkstatt** (Opas Schuppen) mit einem kleinen Tutorial,
   siehe unten. Danach ist der **Schrottplatz die erste und einzige Option**
   auf der Karte.
3. **Teile gibt es für Aufträge und bei Händlern gegen Geld**, Knut auf dem
   Schrottplatz ist der erste. Händler bekommen nach Aufträgen und Spielstand
   neue Teile, siehe „Teile, Geld und Händler“.
4. **Nachbarn geben Aufträge** (liefern, abschleppen, Schnee räumen …). Belohnt
   wird mit Teilen, Geld oder neuen Wegen.

### Spielstart und Tutorial (Entwurf)

Kurz, nicht verlierbar und überspringbar. Opa führt durch, im Gesprächsstil
wie bei Knut (Figur plus Hintergrund, Text tippt sich ein). Höchstens ein,
zwei Sätze pro Schritt; was gerade dran ist, leuchtet.

| Schritt | Wo | Was passiert | Was man lernt |
|---|---|---|---|
| 1 | Werkstatt | Opa begrüßt: Die alte Klapperkiste steht in Einzelteilen im Schuppen. | Gespräche weitertippen |
| 2 | Werkstatt | Der Rahmen steht schon, ein Rad leuchtet im Regal: in den leuchtenden Platz ziehen. | Teile ziehen und einbauen |
| 3 | Werkstatt | Die übrigen Startteile selbst einbauen (Achsen, Räder, Motor, Tank, Sitz, Lenkung). Fehlt etwas, zeigt der Platz es an. | Plätze und Kategorien |
| 4 | Werkstatt | Auto ist fahrbereit, Opa: „Fahr zu Knut auf den Schrottplatz, der hat Teile.“ Knopf „Losfahren“. | Fahrbereit-Prüfung |
| 5 | Karte | Knopf „Karte“ leuchtet. Auf der großen Karte ist nur der Schrottplatz wählbar. Antippen, das Auto fährt selbst, die Route ist blau auf der Minikarte. | Ziel wählen, Minikarte |
| 6 | Schrottplatz | Knut begrüßt und gibt den ersten Auftrag. Tutorial endet. | Aufträge |

Karosserie spielt im Tutorial noch keine Rolle: Die Schrottkarre fährt ohne.

Probe: `design/spielstart.html`. Rahmen und Achsen sind dort schon montiert,
der Weg zum Schrottplatz ist von Anfang an aufgedeckt, und während des
Tutorials ist der Schrottplatz das einzige wählbare Ziel. „Zur Werkstatt“ und
die Ankunft an Opas Schuppen führen zurück in die Werkstatt. Losfahren geht
nur fahrbereit und ohne Karosserie oder mit komplettem Satz.

### Teile, Geld und Händler (entschieden, wie bei Dredge)

**Woher Teile kommen:**

1. **Belohnung für Aufträge:** Abgeschlossene Aufträge geben Teile, Geld oder
   beides.
2. **Händler:** Man kauft Teile mit Geld. Knut auf dem Schrottplatz ist der
   erste Händler, später gibt es weitere an anderen Orten.
3. **Geld** bekommt man für:
   - abgeschlossene Aufträge,
   - Preise (z. B. Wettbewerbe oder Rennen, noch auszuarbeiten),
   - den Verkauf von Teilen (alte, ausgebaute Teile an Händler),
   - den Verkauf von **Materialien** (siehe unten).

**Materialien (kommt später):** Schrauben, Kabel, Schläuche, Federn, Blech …
werden unterwegs gefunden oder gesammelt und bei Händlern verkauft, ähnlich
wie die Fische bei Dredge. Sie kommen in einen **Beutel** (Rucksack oder
Tasche), nicht ins Auto, damit das Auto so bleibt, wie es ist. Idee: Der
Beutel hat begrenzt Platz und lässt sich später gegen einen größeren tauschen.
Ob Materialien zusätzlich zum Bauen oder Reparieren gebraucht werden, klären
wir später.

**Neue Teile bei Händlern (Lieferungen):** Händler bekommen ab und zu ein
neues Teil, und zwar abhängig von **erledigten Aufträgen und dem
Spielstand**. Manches gibt es erst, wenn man bestimmte Orte erreicht hat
(wie bei Dredge, wo neue Ware an Fortschritt und Orte gebunden ist). Knuts
Lieferungen sind meist minderwertig (rostig, wackelig, schwach), gute Teile
gibt es eher als Belohnung und bei Händlern weiter draußen.

**Dosierung:** Karosserie-Teile und Innenleben (Motor, Tank, Licht, Reifen …)
werden **Stück für Stück** herausgegeben, nie alles auf einmal. Zu jedem
Zeitpunkt reicht es nur für **manche** Aufträge, man entscheidet selbst, was
man zuerst angeht. Die drei Teile eines Karosserie-Satzes kommen dabei oft aus
verschiedenen Quellen (z. B. hinten bei Knut, Mitte als Auftragsbelohnung,
vorne bei einem anderen Händler).

**Beispiel für den Anfang (Entwurf):**

| Stand | Bei Knut zu kaufen | Aufträge offen | Belohnung |
|---|---|---|---|
| Nach dem Tutorial | wenig, z. B. bessere Reifen | Knut: 3 alte Reifen | Geld, Scheinwerfer |
| Wald erreichbar (Licht) | Lieferung: Badewanne hinten | Förster Moos | Geld, Badewanne Mitte |
| Weitere Orte | Lieferung: stärkerer Motor | mehrere parallel | … |

Noch offen: Name der Währung, Preise und wie stark Teile sich in den Werten
unterscheiden (kommt mit den Teile-Werten).

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
| See (tiefes Wasser) zu den Inseln | Kompletter Satz Schlauchboot-Karosserie (alle drei Teile) |
| Eingestürzte Brücke, Loch in der Straße | Betonmischer-Karosserie: Quest beim Kieswerk, Beton holen und die Stelle reparieren, danach dauerhaft offen |

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
- Vorerst **17 Modelle, also 51 Teile** (Liste in `KAROSSERIEN.md`).
- **Auf der Karte nur komplette Sätze:** Die Teile werden einzeln eingebaut,
  in der Werkstatt darf man auch mischen und ausprobieren. Losfahren geht aber
  nur ohne Karosserie oder mit allen drei Teilen desselben Modells. Am Anfang
  fährt man ohne Karosserie (die Schrottkarre ist nur Rahmen, Motor, Sitz).
  Ohne Karosserie hat das Auto **keine Fähigkeit**, mit komplettem Satz genau
  die Fähigkeit dieses Modells. Halbe oder gemischte Karosserien fahren nicht.
- **Offen, später durchdenken:** Nicht jedes Bauteil passt zu jeder Karosserie
  (z. B. braucht ein schwerer Aufbau einen stärkeren Motor). Regeln dafür
  legen wir fest, wenn die Teile Werte bekommen.
- Die Karosserie wird **als Letztes** eingebaut, wenn das Auto fahrbereit ist,
  und muss als Erstes wieder ab.
- Jeder Satz bringt seine Fähigkeit mit (Liste in `KAROSSERIEN.md`).
- Manche Modelle bringen ein **Anbauteil** mit, das automatisch erscheint,
  z. B. das Räumschild der Schneeraupe tief am Boden (`assets/raster.json`,
  „anbauten“).

### Karten-Ideen

Das ausführliche Konzept mit Maßstab und Raster steht in [`KARTE.md`](KARTE.md).


- **Zwei Seen mit Inseln.** Die Inseln sind nur mit der
  **Schlauchboot-Karosserie** erreichbar. Die Badewanne reicht nur für Furten und
  flaches Wasser.
- **Bootsmotor** als eigenes Sammel-Teil (Kategorie Heck): ohne Motor wird
  auf dem See gepaddelt, mit Motor geht es schneller und weiter hinaus.
- Auf den Inseln liegen lohnende Funde (seltene Teile, Karosserie-Teile
  anderer Modelle, Aufträge).

### Anleihen bei Dredge

- **Beutel statt Ladefläche:** Materialien und Fundstücke kommen in einen
  Beutel (Rucksack oder Tasche), das Auto bleibt unverändert. Ein größerer
  Beutel bringt mehr Platz.
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
| C1 | Karriere-Start: Werkstatt mit Tutorial, dann mit der Schrottkarre zum Schrottplatz | Probe: `design/spielstart.html` |
| C2 | Geld, Händler (zuerst Knut) und Lieferungen nach Aufträgen und Spielstand | offen |
| C3 | Nachbarn und Aufträge | offen |
| C4 | Beutel für Materialien und Fundstücke (Schrauben, Kabel, Schläuche …), Tag und Nacht | offen |
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
