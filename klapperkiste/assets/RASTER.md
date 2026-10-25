# Klapperkiste – Teile-Raster & Asset-Bibel

Damit jedes Teil zu jedem anderen passt, egal was man einbaut, entstehen alle
Teile nach denselben Regeln. Die Maße stehen maschinenlesbar in
[`raster.json`](raster.json). Spiel, Vorlagen und Werkzeug lesen alle aus
dieser Datei.

## 1. Das Raster

- **1 Zelle = 128 × 128 px** im fertigen Bild.
- Ein Auto ist in der **Seitenansicht 10 × 7 Zellen** (1280 × 896 px) groß,
  in der **Draufsicht 10 × 4 Zellen** (1280 × 512 px).
- **Vorne ist immer rechts**, in beiden Ansichten.
- Jede Kategorie hat eine **feste Box**. Ein Motor ist immer 2 × 2 Zellen,
  egal ob Rasenmäher oder V8. Deshalb passt jeder Motor auf jeden Rahmen.

![Gesamtplan Seite](vorlagen/gesamtplan_seite.png)
![Gesamtplan Draufsicht](vorlagen/gesamtplan_oben.png)

| Kategorie | Seite (Zellen) | Seite (px) | Draufsicht (Zellen) | Draufsicht (px) | Kontaktkante |
|---|---|---|---|---|---|
| Rahmen | 8 × 1 | 1024 × 128 | 8 × 2 | 1024 × 256 | wird exakt auf die Box gestreckt |
| Rad | 2 × 2 | 256 × 256 | 2 × 1 | 256 × 128 | Seite: exakt auf die Box gestreckt, Nabe in der Mitte. Draufsicht: volle Länge, Reifenbreite bleibt |
| Motor | 2 × 2 | 256 × 256 | 2 × 2 | 256 × 256 | unten (steht auf dem Rahmen) |
| Energie | 1 × 2 | 128 × 256 | 1 × 2 | 128 × 256 | unten |
| Sitz | 2 × 2 | 256 × 256 | 2 × 2 | 256 × 256 | unten, **ohne Fahrer** |
| Lenkung | 1 × 2 | 128 × 256 | 1 × 2 | 128 × 256 | unten |
| Vorderbau | 2 × 2 | 256 × 256 | 2 × 2 | 256 × 256 | unten (Lampen, Hupe, Kühler …) |
| Vorne | 1 × 2 | 128 × 256 | 1 × 4 | 128 × 512 | links (hängt am Rahmenende) |
| Heck | 1 × 2 | 128 × 256 | 1 × 2 | 128 × 256 | rechts (hängt am Rahmenende) |
| Achse | 2 × 2 | 256 × 256 | 2 × 4 | 256 × 512 | Seite: Achsende mit Nabe in der Mitte, hinter dem Rad. Draufsicht: volle Höhe, von Rad zu Rad |
| Licht | 1 × 1 | 128 × 128 | 1 × 1 | 128 × 128 | links (vorne vor der Karosserie), oben links und rechts je eine Lampe |
| Karosserie hinten | 3 × 5 | 384 × 640 | 3 × 4 | 384 × 512 | wird aus einer ganzen Karosserie geschnitten |
| Karosserie Mitte | 3 × 5 | 384 × 640 | 3 × 4 | 384 × 512 | wird aus einer ganzen Karosserie geschnitten |
| Karosserie vorne | 4 × 5 | 512 × 640 | 4 × 4 | 512 × 512 | wird aus einer ganzen Karosserie geschnitten |

**Einbaureihenfolge:** Rahmen, dann Achsen, dann Räder, dann der Rest. Die
Karosserie kommt ganz zum Schluss, wenn das Auto fahrbereit ist, und muss als
Erstes wieder ab. Davor: Rahmen, dann Achsen, dann Räder. Die Räder sitzen auf
der Achse und verdecken in der Seitenansicht ihr Ende. Ohne Rad sieht man die
Nabe der Achse. Zum Achsentausch müssen die Räder ab.

Die roten Linien in den Vorlagen (`vorlagen/vorlage_<kategorie>_<ansicht>.png`)
zeigen, welche Kante das Teil berühren muss.

## 2. Bildregeln (gelten für jedes Teil)

1. **Ein Teil pro Bild**, mittig, füllt das Bild gut aus.
2. **Einfarbiger, heller Hintergrund** (am besten reines Weiß), kein
   Bodenschatten, keine Schrift, keine Personen.
3. **Licht immer von oben links.**
4. **Seitenansicht:** genau im Profil, vorne zeigt nach rechts. Die Kamera
   schaut nur ganz leicht von oben (ca. 15°), sodass die Oberseite gerade
   noch sichtbar ist. Das gibt den 3D-Eindruck, ohne dass die Teile beim
   Zusammensetzen schief wirken.
5. **Draufsicht:** senkrecht von oben, ohne Perspektive, vorne zeigt nach rechts.
6. **Seitenverhältnis** passend zur Box erzeugen (siehe Tabelle), z. B.
   Motor 1:1, Tank 1:2 hochkant, Rad in der Draufsicht 2:1.
7. **Gleicher Stil-Block** in jedem Prompt (siehe unten), damit alles
   zusammen aussieht.
8. **Comic-Look:** gleich dicke schwarze Konturen, flache Farben mit einem
   Schattenton. Keine Raster- oder Punktmuster, vor allem nicht im
   Hintergrund, sonst klappt das Freistellen schlecht.

## 3. Ablauf für ein neues Teil

**Empfohlen: ein Doppelbild pro Teil.** Ein Prompt erzeugt beide Ansichten in
einem Bild: oben die Seitenansicht, unten die Draufsicht, mit weißem Abstand
dazwischen. So hat das Teil in beiden Ansichten dieselben Farben, Details und
dieselbe Länge. Das Werkzeug trennt das Bild und passt beide Ansichten ein:

```bash
python klapperkiste/tools/teilwerk.py blatt roh_blatt.png maeher motor
# -> assets/teile/maeher/seite.png und assets/teile/maeher/oben.png
```

Einzelbilder gehen weiterhin:

1. Prompt aus Abschnitt 4 nehmen, Teil einsetzen, Bild erzeugen.
2. Optional: Hintergrund im Bildprogramm entfernen. Das Werkzeug kann
   einfarbige Hintergründe aber auch selbst entfernen, auch eingeschlossene
   Löcher (z. B. innerhalb einer Seilschlaufe). Reinweiße Flächen am Teil
   selbst würden dabei als Loch gelten. Im Comic-Look sind sie meist leicht
   getönt und bleiben deshalb stehen. Sonst mit `--keine-inseln` einpassen.
3. Einpassen. Das Werkzeug stellt frei, schneidet zu, skaliert und setzt das
   Teil exakt an die Kontaktkante:
   ```bash
   python klapperkiste/tools/teilwerk.py einpassen roh.png motor seite assets/teile/maeher/seite.png
   python klapperkiste/tools/teilwerk.py einpassen roh_oben.png motor oben assets/teile/maeher/oben.png
   ```
4. Probe-Zusammenbau, um zu sehen, ob alles passt:
   ```bash
   python klapperkiste/tools/teilwerk.py bauen seite probe.png \
     rahmen=assets/teile/bettgestell/seite.png motor=assets/teile/maeher/seite.png \
     radH=assets/teile/schubkarre/seite.png radV=assets/teile/schubkarre/seite.png
   ```
5. Ablage: `klapperkiste/assets/teile/<teil-id>/seite.png` und `oben.png`.
6. Stand aktualisieren: `python klapperkiste/tools/teilwerk.py geliefert` schreibt
   `design/geliefert.js` (Prompt-Liste) und `design/teile.js` (volle Auflösung
   für Fahrprobe und Spiel, wird nicht eingecheckt).

Korrekturen beim Einpassen eines Doppelbilds:

- `--kappen seite unten 27`: ungewollte Anbauten abschneiden (z. B. Bettrollen
  unter dem Rahmen), Prozent vom Teil.
- `--rot-grau oben`: rote Reste grau färben (z. B. Felge in der Rad-Draufsicht).
- `einpassen ... --drehen 90`: Einzelbild drehen, wenn vorne nicht rechts ist.

## 3b. Karosserie: drei Teile, alle untereinander kompatibel

Jedes Karosserie-Modell besteht aus **hinten, Mitte und vorne**. Die Teile
werden einzeln gefunden (Karte, Aufträge) und lassen sich **modellübergreifend
mischen**. Geplant sind etwa 20 Modelle, also 60 Teile. Damit das passt, gilt:

- Die Karosserie sitzt auf der Rahmenoberkante (y = 5) und braucht keine
  Radläufe. Die Räder liegen darunter.
- **Nähte** bei x = 3 und x = 6 Zellen. Hinten ist 3 Zellen lang, die Mitte 3,
  vorne 4.
- **Gürtellinie als Mindestmaß:** An beiden Nähten ist die Karosserie
  mindestens 2 Zellen hoch geschlossen (y = 3 bis 5), sonst entsteht neben
  anderen Modellen eine Lücke. Darüber ist jede Höhe erlaubt, auch hinten und
  vorne (Kastenwagen, Bus). Neben flacheren Modellen gibt es dann eine Stufe,
  aber nie eine Lücke.
- Normale Autos (Nahthöhe ungefähr 2 Zellen) rasten beim Schneiden **genau**
  auf die Gürtellinie ein und sitzen untereinander bündig. Hohe Aufbauten
  behalten ihre Proportionen.
- **Draufsicht:** An den Nähten reicht die Karosserie von y = 0,5 bis 3,5.

Erzeugt wird **jedes Modell als ganze Karosserie** (Doppelbild: Seite oben,
Draufsicht unten). Das Werkzeug bringt sie auf Autolänge, zieht die Höhe an
den Nähten genau auf die Gürtellinie und schneidet sie in drei Teile:

```bash
python klapperkiste/tools/teilwerk.py karosserie roh_karosserie.png kaefer
# -> assets/teile/kaefer_hinten, kaefer_mitte, kaefer_vorne (je seite.png + oben.png)
```

Liegt ein Modell an einer Naht unter der Gürtellinie, meldet das Werkzeug das.
Drei gezeichnete Platzhalter (`karosserie-platzhalter`: Pick-up, Kugel,
Kastenwagen) zeigen, wie das Mischen aussieht.

## 4. Prompt-Vorlagen

Bildgeneratoren verstehen Englisch zuverlässiger, deshalb sind die Prompts
englisch. `[TEIL]` wird durch die Beschreibung des Teils ersetzt.

**Stil-Block Comic-Look (immer gleich):**

```
Comic book illustration, bold uniform black ink outlines, flat cel-shaded colours with one clear
shadow tone and small white highlights, bright saturated but warm palette, slightly exaggerated
chunky cartoon proportions, light coming from the upper left.
Single object, isolated and centred on a plain flat white background, filling most of the frame.
No ground shadow, no text, no people, no other objects.
```

**Doppelbild (Seite oben, Draufsicht unten):**

```
[TEIL]. Orthographic model sheet showing this same object twice, stacked vertically with a wide
empty white gap between the two views. Top half: flat side elevation like a technical side view
drawing, the long side faces the viewer straight on, not rotated, camera at object height looking
only very slightly down so the top surface is barely visible. Bottom half: plan view seen straight
from directly above, orthographic, without perspective. Both views at the same scale and aligned,
the front points to the right in both views. + Stil-Block
```

**Seitenansicht:**

```
[TEIL], flat side elevation like a technical side view drawing, the long side faces the viewer
straight on, not rotated, camera at object height looking only very slightly down so the top
surface is barely visible, the front points to the right. + Stil-Block
```

**Karosserie (ganzes Modell als Doppelbild):**

```
[MODELL] car body shell for a junk car, only the body: no wheels, no chassis, no engine, no driver.
Orthographic model sheet showing this same car body twice, stacked vertically with a wide empty white
gap between the two views. Top half: flat side elevation, the front points to the right, the body is
long and low, the lower body has the same height along its whole length with a straight waistline,
only the middle section (cabin) rises higher with roof and windows, the rear and front sections stay
low. Bottom half: plan view seen straight from directly above, same length, the body has the same
width along its whole length. Both views at the same scale and aligned. + Stil-Block
```

Für hohe Aufbauten (Kastenwagen, Bus) statt „only the middle section … stay low“:
`the body is a tall box along its whole length, with a straight lower edge`.

Bildgeneratoren rutschen gern in eine schräge Dreiviertel-Ansicht. Ist das
Teil sichtbar gedreht, lieber neu erzeugen: Räder wären sonst oval und die
Anschlüsse im Raster stimmen nicht mehr.

**Draufsicht:**

```
[TEIL], seen straight from directly above, orthographic top-down view without perspective,
the front points to the right. + Stil-Block
```

## 5. Erste Serie: die Schrottkarre (Karrierestart)

Mit diesem Auto beginnt die Karriere: Es fährt gerade so bis zum
Schrottplatz. 6 Teile, je 2 Ansichten = 12 Bilder. Alle 12 fertigen Prompts
mit Kopier-Knopf, Format und Dateinamen stehen in
[`design/prompts.html`](../design/prompts.html). Die Reihenfolge dort ist
auch die empfohlene Reihenfolge: zuerst den Motor als Stil-Referenz.

| Nr. | ID | Kategorie | Teil | Format Seite / Oben |
|---|---|---|---|---|
| 1 | `maeher` | Motor | Rasenmäher-Motor | 1:1 / 1:1 |
| 2 | `schubkarre` | Rad | Schubkarrenrad | 1:1 / 2:1 |
| 3 | `bettgestell` | Rahmen | Rahmen aus einem alten Metall-Bettgestell | 21:9 / 4:1 |
| 4 | `giesskanne` | Energie | Gießkanne als Tank | 1:2 / 1:2 |
| 5 | `kuechenstuhl` | Sitz | Küchenstuhl (Lehne hinten = links) | 1:1 / 1:1 |
| 6 | `fahrradlenker` | Lenkung | Fahrradlenker (Griffe zeigen nach hinten = links) | 1:2 / 1:2 |

Dateinamen: `<id>_seite.png` und `<id>_oben.png`, z. B. `maeher_seite.png`.

## 6. Was später dazukommt

- **Fahrerfigur** als eigenes Bild (Seite und oben), sitzt auf jedem Sitz.
- **Werkstatt-Hintergrund** als gemaltes Bild mit Raumtiefe (3D-Wirkung), das
  Auto steht davor auf der Hebebühne.
- **Karten-Raster** für die große Draufsicht-Karte: kommt mit Phase B, sobald
  die Fahrphysik von oben steht.
