# Mjölnir Lost

A Mario-style Viking platformer. Loki has stolen Thor's hammer, and you chase him through ten Norse realms:
Midgard, Ægir's Sea, Vanaheim, Jötunheim, Járnviðr (the Iron Wood), Niflheim, Muspelheim, Svartalfheim, Alfheim and Asgard, with 3 stages each (1-1 to 10-3). Stages 1-2 of a
realm end at a rune gate; in stage 3 Thor almost grabs Mjölnir, but Loki snatches it and flees to the next realm. In
Asgard 10-3, Thor finally takes it back.

Stage 1 of every realm is hand-built (with Ratatoskr's lessons) and continues into a generated stretch. Stages 2-3 are assembled by `genStage()` from
hand-made chunks (gaps, plank pits, wolf packs, draugar, ravens, rune blocks, hills, spikes, sheep jumps, stairs and
lightning storms), seeded so they are the same every time and getting harder each stage. A realm map on the title
screen lets you replay any unlocked stage.

The art style is dark, misty chibi-anime: ink-outlined characters with big anime eyes, layered moonlit landscapes,
fog, glowing runes and fireflies. Loki follows the old myths rather than Marvel: a sly, wild-haired shapeshifter with ram horns and seiðr-green flame. The music is epic quest music, rendered once per realm into a seamless loop: a driving string ostinato,
war drums and toms, a heroic horn melody, choir and cymbals, with its own chord progression per realm.

Open `index.html` in any modern browser. It's one self-contained file with no build step and no assets. All art is
drawn on a canvas and all sound is synthesized with WebAudio. (The only external request is the Google Fonts
stylesheet, and the game falls back to system fonts without it.)

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Run | ← → or A / D | ◀ ▶ |
| Jump (hold for higher) | Space, W or ↑ | JUMP |
| Sprint | Shift (or X) | – |
| Pause / sound | P / M | top-right buttons |

## What's in it

- **Lightning storms** are the main enemy. A glowing Thurisaz rune (ᚦ) appears on the ground about a second before a
  bolt hits that spot. Each storm follows its own pattern: sweeping left or right, bouncing back and forth, alternating
  checkerboards, random rain, or hunting your position. You have to move forward and back to slip through. Stone roofs
  shelter you, and lightning also knocks out wolves and scorches sheep.
- **Wolves** of Fenrir's blood patrol, and from the Iron Wood onward some of them pounce. Stomp them like goombas.
- **Draugar**, the undead Vikings of the barrows, need two stomps: one knocks the helmet off, the second sends them back to Hel.
- **Ravens** circle overhead, and their eye turns red just before they dive at you.
- **Ægir's Sea** is a water realm: at the start of each stage Thor jumps into a Viking longship and sails the whole
  stage through a storm. The boat jumps with him. Great waves roll in and must be jumped, narwhals leap out of the
  water (stomp them or stay clear), and lightning, ravens and floating rune blocks wait above the waves.
- **Svartalfheim**, the deep halls of the dwarves: dwarf miners march along and hurl their pickaxes in spinning arcs
  (dodge, then stomp them), and stalactites tremble and fall when you walk below them, their crystal tips glowing as a
  warning.
- **Alfheim**, the shining forest of the light elves: mischievous elf lights drift about and chase you when you come
  close; stomp them to pop them. The dark stags of Yggdrasil crouch and leap at you in big arcs: run under them
  or stomp them.
- **Vanaheim**, the golden hills of the Vanir, with standing stones, the great oak and turf-roofed longhouses.
- **Fire boars** hunt you through Muspelheim: they trot toward you, paw the ground and charge with a trail of flame,
  and between charges (or when you are out of reach above them) they snort fireballs at you. Jump over them or stomp
  them and their fire goes out.
- **Fire serpents** lie coiled on the path in Muspelheim. When you come close they hiss and rear back, then snap low
  along the ground: jump over the bite, or stomp them. The pits there are lava.
- **Sheep** are bouncy trampolines that reach high platforms.
- **Ratatoskr**, the messenger squirrel of Yggdrasil, sits on rune stumps and gives hints.
- **Valkyries** fly by when you raise a raven banner, and one carries Thor back when he falls.
- **Treasure** comes three ways: wooden rune coins (worth 1), rarer gold coins (worth 10, also inside some rune crates),
  and secret gems (worth 50) hidden inside one or two plain-looking stone blocks per stage. Every 100 earns an extra life.
- **Hidden ale**: one wooden tankard of ale is hidden in every stage, inside a plain stone block or a rune crate. Thor
  drinks it and starts a 10-second **Rainbow Rush**: he glows in rainbow colours, runs much faster, the music speeds up,
  and every wolf, raven or draugr he touches is knocked out. Lightning can't hurt him either, but pits still can.
- **Floating planks** hold for a moment after Thor lands on them, then shake, fall, and grow back a few seconds later.
- **Rune blocks** (ᚠ) give coins or a horn of mead (+1 shield, or +1 life when all shields are full).
- **Raven-banner checkpoints**, 3 shields of health per life, and 3 lives. Your furthest stage is saved.
- **Trophy Hall**: trophies are a reward for playing again. During the first journey nothing is counted and the hall
  is hidden. Taking Mjölnir back for the first time earns the first trophy, Worthy of Mjölnir, and opens the hall on the
  title screen. It holds 16 trophies, all named from the myths (Andvari's Hoard, Mímir's Eye, Baldr's Blessing,
  Valhalla Can Wait, Fenrir's Bane, Hel's Gatekeeper, Huginn's Dread and more), up to the Allfather's trophy for
  earning all the others. Locked trophies are greyed out but say how to earn them.

## Painted art

Some art is generated (Higgsfield GPT Image 2.5 and Google Gemini) and lives in `assets/` as WebP: the Thor, Loki, wolf, raven
and draugr sprite sheets, sheep, Ratatoskr, the mead horn, the Valkyrie, Mjölnir, the rune coin, the raven banners, ground props (runestones, mushrooms, lanterns, bones, ice crystals, ferns, boulders, snow mounds, frost grass), rune crates, stone blocks, stakes, ice spikes, golden spears, bridge planks, the rune gate, Asgard braziers, shield racks and golden shrubs, and painted backdrops for all six realms, the Muspelheim fire boar and fire serpent, the Svartalfheim dwarf, two Svartalfheim cave backdrops, three Alfheim forest backdrops, the Alfheim stag, the Vanaheim sunset backdrop, and the longship, narwhal, great wave and storm backdrop of Ægir's Sea. Thor also has painted poses for cutscenes (lifting Mjölnir, shaking his fist, being carried off by the Valkyrie). The untouched originals are in `assets/raw/`.
`tools/prepare_sprite.py` keys out a white background, splits the poses and builds the atlas. `tools/embed_assets.py` embeds them into `index.html` so the
game stays one file. Every character or realm without a painted image keeps its code-drawn version, so new images can be
added one at a time: drop the `.webp` (and sprite frames in `sprites.json`) into `assets/` and rerun the script.
