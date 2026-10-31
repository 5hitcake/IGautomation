# Klapperkiste – Geschichte und Ausbau (Entwurf)

Entschieden: Die Karte wächst Gegend für Gegend wie bei Dredge, mehrere Aufträge
sind gleichzeitig offen, und drei Fäden halten alles zusammen. Als Nächstes kommt
der Wald, dann folgen Dorf, Felder, Fluss usw. (Reihenfolge der Gegenden:
[`KARTE.md`](KARTE.md), Abschnitt 4).

## Der rote Faden: drei Stränge in einer Geschichte

1. **Das Klappertal-Rennen.** Am Ende der Saison findet auf der Kiesrennbahn das
   große Rennen statt. Opa erzählt davon, sobald die Klapperkiste das erste Mal
   ordentlich fährt: Er will, dass du mit einer selbst gebauten Kiste antrittst.
   Über das Spiel verteilt gibt es **Vorrunden** in den Gegenden, jede mit eigenem
   Spielprinzip (siehe unten). Wer genug Vorrunden schafft, darf ins Finale.
2. **Opas altes Traumauto, der „Donnerkeil“.** Opa hat das Rennen früher dreimal
   mit dem Donnerkeil gewonnen. Nach einem Streit wurde der Wagen zerlegt, die Teile
   sind im ganzen Tal verstreut. Jede Gegend hat ein Donnerkeil-Teil (Motor, Lenkrad,
   Räder, Sitz, Karosserie …), das eine Figur am Ende ihrer Geschichte herausgibt.
   Donnerkeil-Teile sind besser als alles andere, aber man braucht viele davon,
   damit es sich lohnt.
3. **Das Geheimnis im Wald.** Nachts sieht man im Wald seltsame Lichter und hört
   einen Motor brummen. Förster Moos macht sich Sorgen, bei Knut verschwindet nachts
   Schrott, Pieps findet einen glänzenden Bolzen mit Opas Zeichen. Die Spur führt
   tief in den Wald zu **Tüftler Kauz**, Opas altem Beifahrer, mit dem er den
   Donnerkeil gebaut hat. Seit dem Streit lebt Kauz versteckt im Wald und bewahrt
   heimlich den Rahmen des Donnerkeils auf. Er baut daraus nachts etwas Neues.
   Am Ende versöhnen sich Opa und Kauz, beide stehen beim Finale an der Box, und
   die Klapperkiste fährt als neuer Donnerkeil.

## So beginnt es (G2)

- Kommt man nach Knuts erstem Auftrag (die Reifen) zurück in die Werkstatt, erzählt
  Opa einmal vom Klappertal-Rennen, von seinem Donnerkeil und dem Streit, nach dem
  die Teile im Tal verstreut wurden. Er schickt dich zu Förster Moos.
- Im Auftragsbuch stehen dann „Opas Donnerkeil“ (0/8 Teile, noch ohne Spur) und
  „Anmeldung zur Waldrallye“ (zu Moos, nur mit Licht und bekanntem Waldweg).
- Moos erzählt von der ersten Vorrunde auf dem alten Holzweg hinter seiner Hütte,
  der noch von umgestürzten Bäumen versperrt ist, und flüstert von den Lichtern und
  dem Motorbrummen nachts im Wald (erste Spur zu Kauz). Danach steht „Die Waldrallye“
  im Buch, bis der Holzweg frei ist (G3).
- **Opas altes Foto** (`assets/geschichte/donnerkeil_foto.jpg`) hängt danach oben
  rechts an der Werkstattwand und leuchtet einmal auf. Antippen zeigt es groß: der
  junge Opa und ein langer, dünner Mann mit Werkzeuggürtel mit dem Pokal neben dem
  Donnerkeil. Opa: „Der Lange daneben? Ach … lassen wir das.“ Das ist Kauz, die
  Auflösung kommt viel später.

## Der Holzweg (G3)

- Hinter der Försterhütte führt der alte **Holzweg** durch den dunklen Wald nach
  Süden zum **Campingplatz am Waldsee** (`objekte/campingplatz.png`, 30 m; See aus
  Kreisen mit Sandufer, Wasser und Sand aus `boden/`). Auf dem Weg liegen anfangs
  zwei umgestürzte Stämme (Hindernis „baeume“, man kommt nicht vorbei).
- Moos erzählt bei der Rallye-Anmeldung von seinem kaputten Seilzug: Er braucht
  **2 Kabel und 2 Federn** vom Wegrand (Auftrag „Ein Seilzug für den Holzweg“ im
  Buch, der Fahrknopf führt zum nächsten passenden Fund). Bringt man sie, zieht er
  die Stämme weg, gibt 20 Münzen und 2 Schrauben, und Holzweg, Campingplatz und See
  erscheinen auf der Karte (Gebiet „camping“).
- Am Campingplatz wohnt **Anglerin Rosi**, die Platzwartin. Beim ersten Besuch
  erzählt sie vom Brummen und den Lichtern am anderen Seeufer (zweite Spur zu Kauz)
  und gibt einen Lieferauftrag: **Fisch gegen Milch** (Fisch zu Hilde, Milch zurück).
  Belohnung: 25 Münzen, 1 Blech und das Vorderteil der Badewannen-Karosserie (die
  anderen Teile hat „vielleicht der Sperrmüll-Händler“, Spur für später).
- Der Start der Waldrallye am Campingplatz kommt als Nächstes (G7).

## Die Waldrallye (G7)

- Start am Campingplatz (nach Rosis erstem Gespräch, Holzweg frei, nur bei Tag).
  Nach jedem Besuch bei Rosi fragt das Spiel „🏁 Starten / Später“.
- Eigener Bildschirm (`design/rallye.js`): Holzweg von oben, das Auto fährt von links
  nach rechts von selbst, man hält den Finger auf die Höhe, in die es lenken soll
  (oder Pfeiltasten). 480 m, immer dieselbe Strecke, damit man sie lernen kann. Der
  Wegrand ist gewellt, Baumkronen ragen darüber.
- **Start mit Countdown** wie bei Mario Kart: 3, 2, 1, GO (je eine Sekunde, die Ampel
  zählt mit), dann fährt das Auto von selbst los.
- **Hindernisse:** Pfützen (bremsen, weniger mit viel Grip), Wurzeln (rumpeln),
  Schlaglöcher (bremsen stark, das Auto hüpft), Hasen, die vor dem Auto über den Weg
  hoppeln (Vollbremsung),
  Stämme und Steine (fast Stillstand). Münzen auf der Strecke gibt es dazu.
- **Es geht nach Zeit**, schnellere Autos lohnen sich: Höchstgeschwindigkeit 5 m/s +
  Tempo/10 (Rasenmäher 6,5, Moped 8,5, Rakete 17). Probefahrten mit vier Beispielautos
  und Bestzeiten je Auto: `design/rallyeprobe.html`.
- **Werte zählen:** Tempo (Höchstgeschwindigkeit), Schub des Motors und Gewicht
  (Beschleunigung; das Raketen-Triebwerk zieht mit Flamme am Heck davon),
  Lenkung (wie schnell man ausweicht), Grip (Pfützen).
- **Medaillen:** 🥇 66 s · 🥈 78 s · 🥉 92 s. Gold schafft man erst mit einem
  schnelleren Motor als dem Rasenmäher. Bronze reicht zur Qualifikation.
- **Erste Medaille:** 30 Münzen, 1 Feder und von Rosi ein altes **Lenkrad mit Blitz**,
  das seit Jahren an ihrer Hütte hing: das erste Donnerkeil-Teil (1/8). Opa erkennt es
  in der Werkstatt („Den Blitz hab ich selbst draufgemalt!“) und wundert sich, wie es
  in den Wald kam (Spur zu Kauz). Erstes Gold: 20 Münzen extra.

## Rennen über das Spiel verteilt

Die Werte des Autos zählen jedes Mal (siehe `design/teilwerte.js`).

| Rennen | Gegend | Spielprinzip | Was zählt |
|---|---|---|---|
| Waldrallye | Wald | Zeitfahren auf dem Waldweg von oben: Wurzeln, Pfützen und Äste ausweichen | Grip, Lenkung |
| Feldweg-Sprint | Felder | Drag Race: Ampelstart mit Reaktion, dann im richtigen Moment hochschalten | Tempo, Gewicht |
| Dorf-Slalom | Dorf | Um Pylonen und Marktstände fahren, so schnell es geht | Lenkung, Gewicht |
| Finale | Kiesrennbahn | Ampelstart, dann mehrere Runden gegen drei Figuren mit eigenen Autos, ausweichen und Turbo-Kanister sammeln | alles |

## Systeme wie bei Dredge

- **Auftragsbuch** ✅: Knopf „📖 Aufträge“ oben links auf der Karte. Zeigt alle
  offenen Aufträge mit Figur, Aufgabe, Stand und Belohnung, darunter die
  erledigten. „🚗 …“ fährt zum nächsten Schritt (Fundstück, Figur oder Hindernis).
  Mehrere Aufträge sind gleichzeitig offen, die Reihenfolge ist frei.
- **Tag und Nacht** ✅: Die Uhr (oben rechts, z. B. „🕒 14:20“) läuft nur auf der
  Karte, nicht in Gesprächen, Fenstern oder der Werkstatt. Ein Tag dauert 15 Minuten
  Spielzeit: **10 Minuten Tag** (6–20 Uhr), 1 Minute Abenddämmerung (warm orange),
  **3 Minuten Nacht** (21–5 Uhr, kühles Blau), 1 Minute Morgen. Nachts:
  - leuchten Fenster, Laternen, das Lagerfeuer und der Scheinwerfer,
  - fährt man ohne Licht nur Schritttempo, mit Licht zieht der Scheinwerfer Strom,
  - schläft Knut, der Laden hat zu,
  - tanzen am Ostufer des Waldsees drei blasse Lichter (Spur zu Kauz).
  Abends und nachts kann man in der Werkstatt **bei Opa schlafen** (🛏), dann ist
  sofort Morgen. Jeder Morgen bringt neue Materialien und Preise. Im Einstieg steht
  die Uhr still.
- **Materialien im Beutel** ✅: Schrauben 🔩, Kabel 🔌, Federn 🌀 und Blech 🥫 liegen
  am Wegrand (zehn zugleich, in bekannten Gegenden). Antippen wie die Reifen, der
  Beutel hat 6 Plätze (🎒 rechts auf der Karte). Knut kauft sie an, die Preise
  schwanken. Jedes Mal bei Opa beginnt ein neuer Tag: neue Funde, neue Preise.
  (Bilder dafür kommen noch, vorerst Zeichen.)
  Abgeschlossene Aufträge geben ab und zu auch Materialien (Knuts Reifen: 2 Schrauben,
  Batterie: 1 Kabel, Hildes Schafe: 2 Federn). Passt nicht alles in den Beutel, gibt
  es den Rest als Münzen.
- **Verbrauch** ✅, bei Knut immer wieder zu kaufen:
  - **Sprit:** Der Tank leert sich beim Fahren, so weit wie die Reichweite des
    Energie-Teils (Gießkanne 1500 m, Milchkanne 2200 m, Kanister 3500 m).
    Volltanken bei Knut (1 Münze je 150 m). Leer: Reservekanister aus dem Beutel
    (+600 m) oder Opa schleppt ab (10 Münzen, mit etwas Sprit).
  - **Batterieladung:** Der Scheinwerfer zieht im dunklen Wald Strom (etwa 3 Minuten
    Licht). Leer = kein Licht. Laden bei Knut (5 Münzen).
  - **Flickzeug:** Unterwegs liegt ab und zu ein Nagel, eine Scherbe oder ein spitzer
    Stein auf dem Weg: im Schnitt etwa alle 2 km ein Platten (Auto langsam und
    wackelig). Griffige, dicke Reifen erwischt es seltener (Traktorreifen etwa alle
    4 km), das Schubkarrenrad öfter. Flicken mit Flickzeug aus dem Beutel (6
    Münzen) oder kostenlos bei Opa.
- **Laden:** Knut verkauft Verbrauch und einzelne Teile als Lieferung nach Aufträgen
  (z. B. die Spezialhupe). Karosserien gibt es nur als Belohnung.

## Der Wald (nächste Gegend)

- Der Waldweg geht hinter der Försterhütte weiter, in Kurven durch den dunklen Wald,
  bis zu einem **Campingplatz am Waldsee** mit eigener Figur.
- **Förster Moos** bekommt seine Aufträge:
  1. *Pieps ist ausgebüxt:* Der Vogel aus Moos' Bart sitzt irgendwo im Wald, man hört
     ihn piepsen. Finden und zurückbringen (Belohnung: Kartenstück für den weiteren
     Waldweg).
  2. *Vogelhäuschen:* Knut hat alte Vogelhäuschen im Schrott, die sollen an drei
     Stellen im Wald aufgehängt werden (Liefern mit Zwischenstopps).
  3. *Die Lichter im Wald* (nachts): Moos hat Lichter gesehen. Erste Spur zu Kauz.
- **Waldrallye** als erste Vorrunde zum Klappertal-Rennen.

## Reihenfolge der Schritte

| Schritt | Inhalt | Stand |
|---|---|---|
| G1 | Auftragsbuch | ✅ |
| G2 | Opa erzählt vom Rennen und vom Donnerkeil; Moos weiß von der Waldrallye und den Lichtern (mit Opas altem Foto an der Werkstattwand) | ✅ |
| G3 | Holzweg hinter der Försterhütte, Campingplatz am Waldsee; Moos braucht Kabel und Federn für seinen Seilzug | ✅ (die Figur am Campingplatz fehlt noch: „Bin angeln, komme gleich!“) |
| G4 | Moos' Aufträge (Pieps, Vogelhäuschen) | offen, braucht Bilder |
| G5 | Tag und Nacht | ✅ |
| G6 | Materialien im Beutel, Verbrauch (Sprit, Batterie, Flickzeug) | ✅ |
| G7 | Waldrallye (erstes Rennen) | ✅ |
| G8 | Die Lichter im Wald, erste Spur zu Kauz | offen |
