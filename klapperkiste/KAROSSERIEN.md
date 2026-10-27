# Klapperkiste – Karosserie-Modelle (Entwurf)

Vorerst 17 Modelle à 3 Teile (hinten, Mitte, vorne) = 51 Teile. Weitere
kommen später, wenn neue Ideen da sind. Die Teile werden
einzeln gefunden (Karte, Aufträge) und einzeln eingebaut. In der Werkstatt darf
man Teile verschiedener Modelle ausprobieren, **auf die Karte geht es aber nur
ohne Karosserie oder mit einem kompletten Satz** eines Modells. Bis der erste
Satz komplett ist, fährt man ohne Karosserie.

Jeder Satz bringt seine Fähigkeit (Spalte „Satz-Bonus“) mit. Weil gemischt
nicht gefahren wird, muss die Kabine nicht mehr genau ins Mittelteil passen.

| Nr. | Modell | hinten | Mitte | vorne | Satz-Bonus (Idee) | Fundort (Idee) |
|---|---|---|---|---|---|---|
| 1 | Rundling | runder Kofferraum mit Rücklicht | Kabine mit runden Fenstern | runde Haube mit Glotzaugen-Lampen | keiner, dafür leicht | Schrottplatz (Start) |
| 2 | Pick-up | offene Ladefläche mit Bordwand | eckige Fahrerkabine | lange Motorhaube mit Kühlergrill | große Ladefläche | Bauernhof |
| 3 | Badewanne | Wannenende mit Stöpselkette | Wanne mit Duschvorhang-Stange und Brause | Wannenende mit Gummiente als Kühlerfigur | schwimmt durch Furten | Strand, Hotel, Sperrmüll |
| 4 | Telefonzelle | Kabeltrommel als Kofferraum | rote Telefonzelle mit Glasfenstern | Wählscheibe als Kühlergrill | Regen- und Windschutz | Bahnhof |
| 5 | Eiswagen | Eistruhe mit Eiskugeln | Verkaufsbude mit gestreifter Markise | Haube mit Waffelhörnchen-Figur | Kühlware bleibt frisch, Eis verkaufen | Eisdiele, Strand |
| 6 | Heuscheune | Heuballen mit Mistgabel | kleine Holzscheune mit Dach | Bretterhaube mit Kuhglocke | Tiere transportieren | Bauernhof, Mühle |
| 7 | Rakete | Düsen mit Heckflossen | Cockpit-Kuppel mit Nieten | spitze Raketennase | Tempo höher | Kirmes, Museum |
| 8 | Kutsche | Gepäckablage mit Koffern | Kutschenkabine mit Gardinen | Kutschbock mit Laterne | Komfort, Hochzeitsauftrag | Schloss |
| 9 | Hot-Dog-Kastenwagen | hoher Kasten mit Hecktür und Ketchup- und Senfflaschen | hoher Kasten mit Verkaufsklappe und Riesen-Hot-Dog auf dem Dach | hohe Fahrerkabine mit Würstchen als Stoßstange | unterwegs verkaufen, Hunde laufen hinterher | Kirmes, Fußballplatz |
| 10 | Feuerwehr | Wassertank mit Schlauchtrommel | Mannschaftskabine mit Glocke | rote Haube mit Martinshorn | Brände löschen | Feuerwache |
| 11 | Betonmischer | Plattform mit Betonrutsche und Leiter | große schräge Mischtrommel | kurze Fahrerkabine mit Wassertank | Beton liefern, kaputte Brücken und Wege reparieren | Baustelle, Kieswerk |
| 12 | Mini-Wohnwagen | Küchenklappe mit Töpfen | runde Wohnkabine mit Fensterchen | Gasflaschenkasten | übernachten (Tag und Nacht) | Campingplatz |
| 13 | Geldtransporter | gepanzerter Laderaum mit Doppeltür und Tresorrad | Laderaum mit vergitterten Sehschlitzen und Tresor-Drehrad | kurze Panzerkabine mit Rammstoßstange | Robustheit hoch | Bank, Steinbruch |
| 14 | Schneeraupe | kleine Ladefläche mit Kanister und Schneeschaufel | beheizte Fahrerkabine mit Rundumleuchte | Haube mit großem Räumschild | Kälteschutz, fährt durch Schnee | Frostpass |
| 15 | Gewächshaus | Blumenkasten mit Tulpen | Glashaus mit Tomatenpflanzen | Haube aus Gießkannen | Pflanzen liefern | Gärtnerei |
| 16 | Zirkus | Menschenkanone | gestreifte Zirkuszelt-Kuppel | Clownsnase als Kühler | Zuschauer locken | Zirkus |
| 17 | Schlauchboot | Spiegelbrett (ohne Motor) | Schlauchwülste mit Ruderbänken und Paddeln | runder Bug mit Schleppöse | als kompletter Satz über die Seen zu den Inseln | Hafen, See |

## Prompt-Anfänge

Für den Prompt wird `[MODELL]` in der Karosserie-Vorlage aus
`assets/RASTER.md` (Abschnitt 4) ersetzt. Alles ab „Orthographic model sheet“
bleibt gleich.

| Nr. | `[MODELL]` |
|---|---|
| 1 | A small round 1950s style compact car body shell with round windows and round headlights |
| 2 | A pick-up truck body shell with an open cargo bed at the rear, a boxy cab in the middle and a long hood with a big grille at the front |
| 3 | A car body made from an old enamel bathtub, a shower curtain rod with a shower head above the middle, a rubber duck as hood ornament at the front |
| 4 | A car body whose middle is a red telephone box with glass panes, a cable reel as the rear, a rotary dial as the front grille |
| 5 | An ice cream van body with an ice cream chest full of scoops at the rear, a sales booth with a striped awning in the middle and a waffle cone figure on the front hood |
| 6 | A car body with a small wooden barn with a roof in the middle, hay bales with a pitchfork at the rear and a plank hood with a cow bell at the front |
| 7 | A retro rocket car body with rocket nozzles and tail fins at the rear, a riveted cockpit dome in the middle and a pointed rocket nose at the front |
| 8 | A horse carriage car body with a luggage rack with suitcases at the rear, a carriage cabin with curtains in the middle and a coachman's box with a lantern at the front |
| 9 | A tall boxy hot dog food truck body (a tall box along its whole length, with a straight lower edge), rear doors with ketchup and mustard bottles painted on, a serving hatch and a giant hot dog sculpture on the roof in the middle, a driver's cab with a sausage-shaped bumper at the front |
| 10 | A fire engine body with a water tank and hose reel at the rear, a crew cab with a bell in the middle and a red hood with a siren at the front |
| 11 | A concrete mixer truck car body (siehe Prompt-Liste) |
| 12 | A tiny teardrop camper car body with a kitchen hatch with pots at the rear, a round living cabin with small windows in the middle and a gas bottle box at the front |
| 13 | An armoured money transport box van body (hoher Aufbau, siehe Prompt-Liste) |
| 14 | A snowcat car body (siehe Prompt-Liste) |
| 15 | A greenhouse car body with a flower box with tulips at the rear, a glass house with tomato plants in the middle and a hood made of watering cans at the front |
| 16 | A circus car body with a human cannon at the rear, a striped circus tent dome in the middle and a red clown nose as the front grille |
| 17 | An inflatable rubber dinghy car body (siehe Prompt-Liste) |

## Hauptfarben

Jedes Modell hat eine eigene Hauptfarbe, damit man die Teile auch gemischt
auseinanderhält. Sie steht im Prompt hinter dem Modell als `Main colours: …`.

| Nr. | Modell | Hauptfarbe |
|---|---|---|
| 1 | Rundling | blassblau, creme, viel Rost |
| 2 | Pick-up | dunkles Waldgrün, Ladefläche aus Holz (neu geliefert, vorher zu nah am Rundling) |
| 3 | Badewanne | weiß-cremige Emaille, abgeplatztes Blassblau |
| 4 | Telefonzelle | Briefkastenrot |
| 5 | Eiswagen | creme mit Pastellrosa und Mint |
| 6 | Heuscheune | verwittertes Braunholz, scheunenrotes Dach |
| 7 | Rakete | Silber-Chrom, türkise Flossen (neu geliefert, mit `--keine-inseln` geschnitten; seitlich schlank, an den Nähten niedriger als die Gürtellinie) |
| 8 | Kutsche | warmes Orange und Ocker mit dunklem Holz |
| 9 | Hot-Dog-Kastenwagen | Senfgelb und Ketchuprot |
| 10 | Feuerwehr | Signalrot mit weißen Streifen und Chrom |
| 11 | Betonmischer | Betongrau und leuchtendes Limettengrün, dunkle Schrägstreifen auf der Trommel |
| 12 | Mini-Wohnwagen | Mintgrün und Creme |
| 13 | Geldtransporter | dunkles Stahlgrau, Messingnieten, gelber Warnstreifen |
| 14 | Schneeraupe | leuchtendes Eisblau und Weiß, schwarzer Gummi |
| 15 | Gewächshaus | grüne Fensterrahmen, Glas, Terrakotta |
| 16 | Zirkus | Lila und Gold gestreift |
| 17 | Schlauchboot | leuchtendes Orangerot, graue Flicken |

## Schneeraupe und Raupenketten

Die Ketten gehören nicht zur Karosserie, sonst passt sie nicht auf jedes
Fahrgestell. Die Raupenkette wird ein eigenes Teil in der Kategorie Räder:
sie ersetzt beide Räder einer Seite, fährt durch Schnee und Matsch, ist aber
langsam. Zusammen mit der Schneeraupen-Karosserie gibt es den Satz-Bonus.

## Bootsmotor

Der Außenborder ist kein Teil der Schlauchboot-Karosserie, sondern ein eigenes
Bauteil zum Sammeln (Kategorie Heck). Ohne Motor wird auf dem See gepaddelt
(langsam), mit Bootsmotor geht es schneller und weiter hinaus.

## Gestrichen

Wohnzimmer, Bienenstock und Dampflok (Nr. 18–20) sind raus. Schafe vertreibt
eine **Spezialhupe** (eigenes Sammel-Teil), Ausruhen gibt es nicht, und
Abschleppen wird bei Bedarf später neu überlegt.
