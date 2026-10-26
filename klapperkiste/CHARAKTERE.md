# Klapperkiste – Charaktere (Entwurf)

Jeder Ort hat einen Bewohner, der Aufträge vergibt. Gespräche laufen wie bei
Pokémon: unten ein Textfeld, darüber groß die Figur, die je nach Satz ihre
Geste wechselt.

## Stil

- **Lockere schwarze Tuschezeichnung** wie ein alter Zeitungscartoon: dünne,
  schwungvolle Linien, Gummiarme, große Nasen, übertriebene Proportionen.
- **Voll farbig** mit warmen, flachen Farben wie aquarelliert. Jede Figur hat
  eine **Hauptfarbe** (Kleidung), die zu ihrem Merkmal gehört und später auch
  an ihrem Wohnort auf der Karte wieder auftaucht.
- **Abstrakt mit einem Merkmal:** Jede Figur hat ein übertriebenes
  Erkennungszeichen (riesiger Schnurrbart, Brille wie Untertassen …), an dem
  man sie sofort erkennt.

## Bildbogen

Ein Bild pro Figur, Format 1:1, **vier Gesten im 2 × 2-Raster**, jede Geste
ganzer Körper, gleich groß, mit viel Weiß dazwischen. Ich schneide sie aus.

| Feld | Geste | Wofür |
|---|---|---|
| oben links | winkt zur Begrüßung | Gesprächsbeginn |
| oben rechts | kratzt sich nachdenklich am Kopf | Frage, Problem |
| unten links | zeigt auffordernd zur Seite | Auftrag geben |
| unten rechts | jubelt, Daumen hoch | Auftrag erledigt |

## Figuren (Vorschlag)

| Ort | Name | Merkmal | Akzentfarbe |
|---|---|---|---|
| Opas Schuppen | Opa Bolzen | Brille wie zwei Untertassen, Schraubenschlüssel hinterm Ohr | Ölgrün |
| Schrottplatz | Knut Kurbel | riesiger Schnurrbart, der bis zu den Schultern reicht | Rostorange |
| Bauernhof | Bäuerin Hilde | Strohhut, so breit wie ein Wagenrad | Weizengelb |
| Försterhütte | Förster Moos | Bart wie ein Vogelnest, ein Vogel wohnt darin | Tannengrün |
| Eisdiele | Gino Gelato | Haartolle wie eine Eiskugel | Erdbeerrosa |
| Feuerwache | Hauptfrau Funke | Helm doppelt so groß wie der Kopf | Signalrot |
| Kieswerk | Polier Brösel | Schultern breit wie ein Schrank, winziger Kopf | Betongrau |
| Zirkus | Direktorin Zylinda | Zylinder höher als sie selbst | Lila |
| Hafen | Kapitänin Kiel | Pfeife mit Dampfwolken in Ankerform | Marineblau |
| Frostpass | Hüttenwirt Frieder | Nase rot wie eine Tomate, dicker Schal bis zu den Knien | Eisblau |

## Prompts

Alle mit demselben Aufbau, Format 1:1. Erzeugt mit Z-Image (Hugging Face) oder
extern. Der Stil-Satz am Ende bleibt immer gleich:

`Vintage 1930s newspaper comic strip style, loose scratchy black ink pen lines, rubbery limbs, exaggerated proportions, fully coloured with warm flat watercolour-like colours. White background, no text.`

Anfang immer: `Cartoon character model sheet, the same [FIGUR] shown in four poses arranged in a 2x2 grid on white paper: top left waving hello, top right scratching [his/her] head puzzled, bottom left pointing to the side, bottom right laughing with a big thumbs up.`

| Figur | [FIGUR] und Aussehen |
|---|---|
| Knut Kurbel | funny tall thin old junk dealer · Bald head, enormous grey walrus moustache hanging down to his chest, long pointy red nose, tiny round glasses, long patched rust orange work coat, grey trousers, oversized brown boots. |
| Opa Bolzen | funny little old grandpa mechanic · Short and round, enormous thick glasses as big as saucers that make his eyes look huge, a wrench tucked behind his ear, white fluffy hair on the sides, olive green work jacket with oil stains, brown trousers, slippers. |
| Bäuerin Hilde | funny sturdy farmer woman · Enormous straw hat as wide as a cart wheel, rosy round cheeks, blond braids, wheat yellow dress with a checkered apron, rubber boots. |
| Förster Moos | funny old forester · Huge round bushy brown beard like a bird nest with a little bird sitting in it, small green felt hat with a feather, dark green jacket, leather trousers, big boots. |
| Gino Gelato | funny cheerful ice cream seller · A tall round pink hair quiff shaped exactly like a scoop of strawberry ice cream, thin curled moustache, strawberry pink and white striped shirt, white apron, small bow tie. |
| Hauptfrau Funke | funny energetic fire chief woman · A shiny red fire helmet twice as big as her head, freckles, red uniform jacket with yellow stripes, black boots, a small brass whistle. |
| Polier Brösel | funny construction foreman · Shoulders as wide as a wardrobe with a tiny head on top, small yellow hard hat, concrete grey overalls covered in dust, a folding ruler in the pocket. |
| Direktorin Zylinda | funny small circus director woman · A purple top hat taller than she is, big curly red hair, purple tailcoat with golden buttons, white gloves, a little cane. |
| Kapitänin Kiel | funny old sea captain woman · A pipe whose smoke puffs come out in the shape of little anchors, white captain's cap, grey bun of hair, navy blue coat with golden buttons, rain boots. |
| Hüttenwirt Frieder | funny round mountain hut keeper · Nose red and round like a tomato, a thick ice blue knitted scarf reaching down to his knees, bobble hat, warm brown jumper, fur boots. |
