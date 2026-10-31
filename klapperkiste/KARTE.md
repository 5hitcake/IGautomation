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

## 8. Fahrsteuerung (entschieden)

- **Ziel auf der großen Karte wählen:** Über den Knopf „Karte“ (oder die
  Übersichtskarte) öffnet sich die ganze Karte. Wählbar sind **nur markierte
  Ziele** (Orte, Wegweiser), keine beliebigen Stellen. Ziele im Nebel sind
  grau mit „?“ und erst nach dem passenden Kartenstück wählbar.
- **Das Auto fährt selbst, nur auf den offiziellen Wegen** (Wegenetz, nie
  übers Feld), bis es am Ziel ist.
- **Hindernisse:** Kann das Auto ein Hindernis mit den eingebauten Teilen nicht
  überwinden (z. B. dunkler Wald ohne Licht), bleibt es davor stehen. Eine
  Meldung sagt, was fehlt, mit dem Knopf **„Zur Werkstatt“** (Schnellreise).
  Das Hindernis ist zugleich eine feste Sperre: Auch beim Wenden, Zurücksetzen
  oder mit den Pfeiltasten kommt man ohne das Teil nicht hindurch.
- **Runde Wege:** Die Wege sind als Linien mit Knicken eingetragen und werden
  beim Start an jedem Knick zu einem Bogen gerundet (bis 9 m je Seite);
  Abzweigungen rücken auf den gerundeten Weg. Gilt für Bild, Wegenetz und
  Untergrund gleichermaßen.
- **Route nur auf der Minikarte:** Der Weg wird wie bei einer Navi-App als
  blaue Linie auf der Minikarte gezeigt, auf der großen Fahransicht nicht
  (dort nur ein Ring am Ziel).
- Pfeiltasten bleiben nur zum Testen.

## 9. Kartenstücke und Nebel

Am Anfang kennt man nur die Gegend um Opas Schuppen, der Rest liegt im Nebel
(alte Landkarte). Unterwegs findet man **Kartenstücke**; jedes deckt ein
Gebiet auf. Ins Ungewisse kann man nicht tippen, das Auto plant seine Route
nur durch aufgedeckte Gebiete. Kartenstücke liegen am Wegrand, auf Inseln
oder gibt es als Belohnung für Aufträge. Probe: `design/kartenprobe.html`
(Startgebiet plus zwei Gebiete).

## 10. Vom einen Weg zu vielen Möglichkeiten

Am Anfang gibt es **nur einen Weg und eine Option**: von Opas Schuppen zum
Schrottplatz, mit dem ersten Auftrag. Das ist der Einstieg. Mit jedem
Kartenstück, jedem Teil und jeder Karosserie wird die Welt breiter: Es gibt
mehrere Ziele zur Auswahl, verschiedene Wege zum selben Ort und mehrere
Aufträge gleichzeitig. Man muss selbst planen, wo man welche Teile bekommt
und was man zuerst schaffen kann (z. B. erst Licht für den Wald oder erst die
Spezialhupe für die Schafe). Aufträge sollen sich daher, wo es geht, auf
mehr als eine Art lösen lassen.

## 11. Gegenstände aufsammeln (entschieden)

Gegenstände wie die alten Reifen liegen etwas abseits der Wege. Man **tippt
sie an**, um sie aufzusammeln; sie kommen in den Beutel. Das klappt, wenn das
Auto nah genug ist (etwa 8 m) und langsam fährt (bis etwa 12 km/h), also auch
beim langsamen Vorbeifahren. Ist es zu schnell, hält der Knopf **„Stopp“**
(unten links, nur beim Selbstfahren sichtbar) das Auto an, „Weiter“ fährt
weiter. Beim ersten Gegenstand erklärt ein Hinweis, wie es geht.

Neu im Startgebiet: der **Weideweg** als Rundweg um die Weide (Kurve bei
Opa bis Feldrand) mit eigenem Gebiet und Kartenstück am Feldrand. Das Auto
plant nur noch durch aufgedeckte Gebiete.

## 12. Wetter

Das Wetter wechselt von selbst alle ein bis zwei Minuten und gleitet weich
über: **Sonnig** (wenige Wolkenschatten), **Wolkig** (Wolkenschatten ziehen
über die Karte), **Regen** (Tropfen, Ringe auf dem Boden, trüberes Licht),
**Nebel** (Dunst und Nebelschwaden) und **Windig** (fliegende Blätter,
schnellere Wolken). Beim Einstieg scheint immer die Sonne. In der Kartenprobe
lässt sich das Wetter zum Ausprobieren fest einstellen. Spielerisch hat das
Wetter noch keine Folgen (Idee: Regen macht Wiesen rutschig, Nebel
versteckt Gegenstände).

## 13. Tiere

Tierbilder kommen als Bogen mit zwei Posen nebeneinander (Kopf nach rechts)
und werden mit `python klapperkiste/tools/tiere.py EINGABE NAME --meter M`
geteilt, freigestellt (auch der graue Schlagschatten) und mit 64 px pro Meter
gespeichert. Größen etwas übertrieben, damit man sie sieht: Vogel 0,9 m,
Hase 1,3 m, Schaf 2 m.

- **Vögel** sitzen in kleinen Gruppen am Weg, picken und drehen sich. Kommt
  das Auto näher, fliegen sie auf, weg vom Auto, und steigen. Ihr Schatten
  rückt mit der Höhe nach unten rechts ab und wird blasser, so sieht man,
  wie hoch sie sind. Nach einer Weile landet ein neuer Schwarm. Ab und zu
  zieht ein Schwarm hoch über das Auto hinweg.
- **Hasen** hoppeln in kurzen Sprungfolgen um ihr Zuhause (manchmal über den
  Weg) und flüchten mit schnellen Sprüngen vor dem Auto.
- **Schafe** grasen auf der Weide (Kopf unten) und laufen langsam zum
  nächsten Grasplatz.
- **Kühe** (Bild mit einer Pose, `--eine`) grasen zusammen mit den Schafen, etwas langsamer.

## 14. Häuser

- **Hütte am Feldrand** (`objekte/huette.png`, 11 m): steht am Ende des
  Stichwegs zum Feldrand, Tür zum Weg. Bäume halten Abstand, das Auto stößt
  an Dach und Veranda. Der Schlamm drumherum läuft weich ins Gras aus
  (`objekt.py einpassen … --weicher-rand 0.9 --rand-schutz 0.58,0,0.70,0.22`,
  der Schutzbereich hält den Kamin, der über den Rand ragt, klar sichtbar).
- **Bauernhof** (`objekte/bauernhof.png`, 32 m, freigestellt mit
  `tools/einmalig/bauernhof_einpassen.py`): nordöstlich der Weide, mit einer
  Zufahrt vom Weideweg bis zum Hoftor und eigenem Ziel „Bauernhof“. Wohnhaus
  und Scheune sind Hindernisse. Hier soll später Bäuerin Hilde wohnen. Das
  erste Bild war schräg gezeichnet (`objekte/roh/bauernhof_v1_schraeg.jpg`)
  und wird nicht verwendet.

## 15. Lenkachse

Das Auto auf der Karte besteht aus zwei Ebenen (`tools/karte_daten.py`):
Rumpf (alles außer Vorderachse und Vorderrädern) und Lenkachse (Vorderachse
mit beiden Vorderrädern). Die Lenkachse liegt unter dem Rumpf und dreht sich
um ihre Mitte mit dem Lenkeinschlag, wie ein Drehschemel beim Bollerwagen.
Rahmen und Karosserie verdecken sie dabei wie am echten Auto teilweise.

## 16. Anzeigen und Zielmarken

**Anzeigen am Rand der Karte:**
- oben links: aktuelles Ziel mit Entfernung (📍, nur beim Fahren) und der Auftrag (📋)
- oben rechts: Minikarte, darunter das Wetter als rundes Symbol (beim Wechsel
  kurz mit Namen) und die Münzen (🪙)
- unten links: Stopp/Weiter (nur beim Fahren)
- unten rechts: kleiner Rundtacho (0–40 km/h, Nadel und Zahl, „R“ rückwärts)

**Zielmarken auf der großen Karte:**
- **Orte** (Hauptziele mit Bewohner): großer gelber Kreis mit Haus, fetter Name
  darunter (Opas Schuppen, Schrottplatz, Bauernhof).
- **Wegweiser** (Wegpunkte): kleines Holzschild, kleiner Name darüber
  (Wegweiser, Feldrand, Waldweg, Weide).
- **Unbekannte Orte**: graues Fragezeichen ohne Namen, z. B. im Nebel oder
  Orte, die es noch nicht gibt (`kommt: true`, vorerst die Försterhütte im
  Wald). Unbekannte Wegweiser werden gar nicht gezeigt.

## 17. Feldweg, Schafherde und Försterhütte

- **Feldweg** vom Weideweg nach Norden zu den Feldern (eigenes Gebiet, das
  Hilde aufdeckt). Ende: Wegweiser „Zu den Feldern“, dahinter die Mühle als
  „?“. Auf dem Weg steht Hildes **Schafherde** als Hindernis: Ohne Hupe hält
  das Auto mit Meldung, mit Hupe kommt der Knopf „📯 Hupen“, danach laufen die
  Schafe seitlich auf die Wiese und das Auto fährt weiter zum Ziel.
- **Försterhütte** (`objekte/foersterhuette.png`, 14 m, weicher Rand) am Ende
  des Waldwegs: Das Gatter ist jetzt ein offenes Tor, ein kurzer Pfad führt
  zur Hütte. Ihre Laterne leuchtet immer mit einem warmen, leicht
  flackernden Schein.
- **Dunkler Wald als Fläche:** Die ganze Waldfläche im Westen (`WALD` in
  `karte.js`, mehrere Kreise) hat das Walddach als Boden, mit weichem Rand ins
  Gras, und ist dicht mit Nadelbäumen bewachsen (keine hellen Laubbäume oder
  Büsche). Dunkel ist nur, was unter dem Dach liegt: der Waldweg ab dem
  Hindernis, der Pfad und (etwas heller) die Lichtung der Hütte. Dort sieht
  man nur im Lichtkegel.

## 18. Musik

Musik entsteht im Browser aus Noten in ABC-Schreibweise (`STUECKE` in
`design/ton.js`), dazu Bass und Akkorde aus den Akkordnamen. Stücke: Werkstatt
(Ragtime, Klavier), Fahren (Polka, Akkordeon), dunkler Wald (langsam, Moll,
Klarinette). Auf der Karte wechselt die Musik von selbst zwischen Fahren und
Wald, im Spielstart läuft in der Werkstatt der Ragtime. Bei Gesprächen wird sie
leiser. Knopf 🎵 unten links schaltet sie aus (wird gemerkt). Die Noten lassen
sich mit dem Notenblatt-Werkzeug vorab anhören und ändern.

Seit der zweiten Fassung haben Aufnahmen Vorrang: Werkstatt und Fahren sind mit
MiniMax Music (Hugging Face) erzeugt (`assets/ton/musik/*.mp3`).
`python klapperkiste/tools/musik.py` sucht in jedem Stück zwei gleich klingende
Stellen und schneidet den langsamer werdenden Schluss ab; dazwischen läuft das
Stück nahtlos im Kreis (`design/musik_daten.js`). Ein Stück `figur_<name>.mp3`
läuft deutlich leiser im Gespräch mit dieser Figur und löst die Ortsmusik so
lange ab; ohne eigenes Stück wird die Ortsmusik nur gedämpft. Wo eine Aufnahme
fehlt, spielen die Noten. Wald ist ein langsamer Walzer (MiniMax Music3 Demo).

Längere Stücke entstehen aus mehreren kurzen Teilen im gleichen Stil und der gleichen
Tonart, z. B. `assets/ton/musik/fahren/1.mp3 … 3.mp3`. Das Werkzeug misst das Tempo
jedes Teils (die Musik-KI hält die gewünschte Zahl nicht ein: 172, 180 und 199 Schläge),
streckt alle auf den mittleren Wert, verbindet je zwei Teile an ihrer ähnlichsten
Stelle direkt vor einem Schlag (120 ms Überblendung) und schleift vom letzten Teil
zurück in den ersten. Fahren läuft so 52 s, bevor sich etwas wiederholt.

## 19. Geräusche

Motor (`Ton.motor` in `design/ton.js`): tiefer Sägezahn und Rauschen, im Takt der
Zündungen zerhackt („Tuck-tuck“). Takt, Tonhöhe und Helligkeit steigen mit dem
Tempo und beim Gasgeben; im Stand tuckert er im Leerlauf. In der Werkstatt und
während Gesprächen ist er aus. Die Spezialhupe macht bei den Schafen „Trööööt“.
Beides hängt am Schalter 🔊 (Stimmen und Geräusche).
