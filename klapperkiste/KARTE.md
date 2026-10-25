# Klapperkiste – Karte (Konzept, Entwurf)

Die Karte wird von oben gezeigt (wie die Draufsicht der Teile) und Stück für
Stück gebaut. Jedes Stück wird in ein festes Raster eingesetzt, am Ende ergibt
das eine große, zusammenhängende Welt mit Orten, Strecken, Hindernissen und
Charakteren, ähnlich wie bei Dredge.

## 1. Wie groß kann die Karte werden?

**Technisch fast beliebig groß.** Die Karte ist kein riesiges Bild, sondern
besteht aus Daten (wo liegt welche Straße, welches Haus, welcher Baum) und
wenigen wiederverwendbaren Grafiken (Boden-Texturen, Bäume, Häuser, Orte).
Das Spiel lädt immer nur die Abschnitte rund ums Auto. Damit sind auch 8 × 8 km
auf dem Handy machbar.

**Die eigentliche Grenze ist die Arbeit am Inhalt**, nicht die Technik. Eine
große, leere Karte macht keinen Spaß. Mein Vorschlag:

| Ausbau | Größe | Abschnitte (à 64 m) | Fahrzeit von Rand zu Rand (Schrottkarre, ca. 20 km/h) | Inhalt |
|---|---|---|---|---|
| Startgebiet | 0,3 × 0,3 km | 5 × 5 | gut 1 Minute | Startplatz, Weg zum Schrottplatz |
| Erste Version | 1 × 1 km | 16 × 16 | 3 Minuten | 5–6 Orte, erste Hindernisse |
| **Endausbau (Ziel)** | **2 × 2 km** | **32 × 32** | **6–7 Minuten** | 15–20 Orte, 2 Seen mit Inseln, Berge mit Frostpass |
| Möglich später | 4 × 4 km | 64 × 64 | 12–14 Minuten | Erweiterungen, neue Regionen |

2 × 2 km klingt klein, fühlt sich im Spiel aber riesig an: Die Straßen
schlängeln sich, viele Wege sind anfangs gesperrt, und mit der Schrottkarre
fährt man langsam. Mit schnellen Teilen (Rakete) schrumpft die Welt, das ist
gewollt. Wird die Karte später zu eng, hängen wir einfach Abschnitte an, das
Raster ist darauf ausgelegt.

## 2. Maßstab und Raster

- **1 Meter = 32 Pixel** auf der Karte. Das Auto (Draufsicht 10 × 4 Zellen)
  ist im Spiel **4 m lang und 1,6 m breit**, also 128 × 51 Pixel.
- **Abschnitt (Kachel): 64 × 64 m = 2048 × 2048 Pixel.** Jeder Abschnitt hat
  eine Koordinate, z. B. `C7` oder `(2, 6)`. Gespeichert wird je Abschnitt eine
  kleine Datei mit Boden, Straßen und Objekten.
- **Straßenanschlüsse:** Straßen verlassen einen Abschnitt nur an festen
  Stellen der Kante (Mitte oder Viertel), damit Nachbarn immer zusammenpassen,
  egal in welcher Reihenfolge wir bauen. Das ist dasselbe Prinzip wie die
  Nähte bei den Karosserien.
- **Straßenbreite:** einspurig 4 m, zweispurig 7 m.
- **Bildschirm:** Auf dem Handy (hochkant) sieht man etwa 34 × 60 m, also ein
  gutes halbes Stück eines Abschnitts. Die Kamera folgt dem Auto.

## 3. Woraus eine Karte besteht

| Ebene | Was | Woher |
|---|---|---|
| Boden | Gras, Wiese, Erde, Sand, Schnee, Wasser | Wiederholbare Texturen, je eine Kachel 512 × 512 px. Ihr erzeugt sie, ich mache sie nahtlos. |
| Wege | Feldweg, Schotter, Asphalt, Brücke, Furt | Vom Spiel entlang einer Linie gezeichnet, mit Textur. Keine Einzelbilder nötig. |
| Objekte | Bäume, Büsche, Felsen, Zäune, Schilder, Schafe | Einzelbilder von oben im Comic-Stil, frei platzierbar |
| Orte | Schrottplatz, Bauernhof, Hafen … | Größere Bilder von oben (z. B. 2 × 2 Abschnitte), jeweils ein Motiv |
| Hindernisse | Schranken, Schotterfelder, Dunkelheit, Schnee, Wasser | Spielregeln plus Grafik, verlangen bestimmte Teile oder Karosserien |
| Charaktere | Bewohner an ihren Wohnorten | Figur von oben für die Karte, Porträt für Gespräche und Aufträge |

So brauchen wir für eine große Karte überschaubar viele Bilder: etwa 10
Boden-Texturen, 30–40 Objekte und pro Ort ein Bild.

## 4. Regionen und Orte (Idee)

Übersichtsskizze: [`design/karte_skizze.png`](design/karte_skizze.png), erzeugt mit
`python klapperkiste/tools/karte_skizze.py`. Sie ist nur ein Plan, Lage und
Namen ändern wir, wie es passt.

Grob von Süd nach Nord, also von leicht zu schwer:

| Region | Orte | Hindernis | Was man braucht |
|---|---|---|---|
| **Start (Süden)** | Opas Schuppen (Start), Schrottplatz | – | Schrottkarre |
| **Dorf** | Werkstatt, Eisdiele, Bank, Kneipe, Feuerwache | – | – |
| **Felder** | Bauernhof, Mühle, Gärtnerei | Schotterwege, Schafe auf der Straße | bessere Reifen, Spezialhupe |
| **Wald** | Försterhütte, Campingplatz | Dunkelheit | Licht |
| **Fluss** | Kieswerk, eingestürzte Brücke, Furt | Wasser, kaputte Brücke | Badewanne (Furt), Betonmischer (Brücke reparieren) |
| **Kirmesplatz** | Zirkus, Fußballplatz | – | Aufträge für Zirkus und Hot-Dog-Wagen |
| **Seen (zwei)** | Hafen, Strand, Inseln | tiefes Wasser | Schlauchboot (komplett), Bootsmotor |
| **Weite Ebene** | Tankstelle am Ende einer langen Strecke | lange Strecke ohne Tankstelle | größerer Tank |
| **Berge (Norden)** | Steinbruch, Bergwerk, Frostpass, Schloss | Steigungen, Schnee | starker Motor, Schneeraupe |
| **Brandgebiet (Idee)** | verkohlter Wald, Köhlerei, glimmende Glut | Glutfelder, die Reifen beschädigen | Feuerwehr (löscht die Glut, danach dauerhaft offen) |

Jeder Ort bekommt einen **Charakter** mit eigenem Wohnort, der Aufträge
vergibt (liefern, abholen, Schnee räumen, Brücke reparieren). Die Belohnung
sind Teile, Karosserie-Teile oder neue Wege.

## 5. Fahrplan Karte in kleinen Schritten

| Schritt | Inhalt |
|---|---|
| **K1** | Dieses Konzept, Maßstab, Raster, Übersichtsskizze der ganzen Karte |
| K2 | Boden-Texturen: Gras, Erde, Schotter, Asphalt, Sand, Wasser, Fels, Schnee, Glut (Prompts, ich mache sie nahtlos) |
| K3 | Erste Objekte von oben: 2 Bäume, Busch, Felsen, Zaun, Schild |
| K4 | Startgebiet (5 × 5 Abschnitte): Opas Schuppen und der Weg zum Schrottplatz, als Fahrprobe mit dem gebauten Auto |
| K5 | Erster Ort als Bild: der Schrottplatz, mit erstem Charakter |
| K6 … | Region für Region anbauen, jeweils mit Hindernis und Auftrag |

## 6. Stil und Muster

- **Stil zwischen Comic und echt:** Boden (Gras, Erde, Wasser) gemalt und
  etwas realistischer, ohne schwarze Konturen. Objekte, Häuser und Figuren im
  Comic-Stil mit Konturen wie die Autoteile. So heben sich Auto und wichtige
  Dinge vom Boden ab, und alles wirkt trotzdem wie aus einem Guss.
- **Muster für einen Abschnitt:** [`design/vorlage_abschnitt.png`](design/vorlage_abschnitt.png)
  (64 × 64 m, 8-m-Raster, orange Straßenanschlüsse, Auto zum Größenvergleich).
  Erzeugt mit `python klapperkiste/tools/karte_skizze.py --vorlage`. Gebraucht
  wird es für Orte; Boden-Texturen brauchen kein Muster.

## 7. Dunkler Wald

Der dunkle Wald ist eine eigene Fläche. Von außen sieht man nur das geschlossene
Walddach (eigene Textur, dunkle Baumkronen), Weg und Auto verschwinden darunter.
Fährt man hinein, wird alles bis auf das Licht dunkel: Man sieht nur, was die
Scheinwerfer im Lichtkegel treffen, dazu einen schwachen Schein ums Auto. Ohne
Licht-Teil ist der Wald praktisch nicht befahrbar. Bessere Lampen geben einen
längeren und breiteren Lichtkegel. Probe: Lichtkegel auf einem Feldweg
(`design/probe_dunkel.png`).
