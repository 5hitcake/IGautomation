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
- **Tag und Nacht** (geplant): Ein Tag dauert einige Minuten Spielzeit. Nachts ist
  es überall dunkel und man braucht Licht, Knuts Laden hat zu, manche Aufträge gibt
  es nur nachts (die Lichter im Wald). Bei Opa übernachten springt zum Morgen.
- **Materialien im Beutel** (geplant): Schrauben, Kabel, Federn, Blech liegen
  unterwegs herum und kommen jeden Morgen neu. Der Beutel hat wenige Plätze und lässt
  sich vergrößern. Materialien verkauft man bei Händlern, später braucht man sie
  auch für Reparaturen.

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
| G2 | Opa erzählt vom Rennen und vom Donnerkeil (altes Foto in der Werkstatt) | offen |
| G3 | Waldweg verlängern, Campingplatz am Waldsee mit neuer Figur | offen, braucht Bilder |
| G4 | Moos' Aufträge (Pieps, Vogelhäuschen) | offen, braucht Bilder |
| G5 | Tag und Nacht | offen |
| G6 | Materialien im Beutel | offen |
| G7 | Waldrallye (erstes Rennen) | offen |
| G8 | Die Lichter im Wald, erste Spur zu Kauz | offen |
