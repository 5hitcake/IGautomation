# Mjölnir Lost

A Mario-style Viking platformer. Loki has stolen Thor's hammer, and you chase him through eleven Norse realms:
Midgard, Vanaheim, Jötunheim, Járnviðr (the Iron Wood), Niflheim, Muspelheim, Ægir's Sea, Svartalfheim, Alfheim, Helheim and Asgard, roughly from easiest to hardest, with 3 stages each (1-1 to 11-3). Stages 1-2 of a
realm end at a rune gate; in stage 3 Thor almost grabs Mjölnir, but Loki snatches it and flees to the next realm. In
Asgard 11-3, Thor finally takes it back.

Stage 1 of every realm is hand-built (with the Völva's lessons) and continues into a generated stretch. Stages 2-3 are assembled by `genStage()` from
hand-made chunks drawn from a shuffled deck (stone columns, bridges, falling-board runs, stair pyramids, ambushes,
storms with foes caught in them, and each realm's own enemies) (gaps, plank pits, wolf packs, draugar, ravens, rune blocks, hills, spikes, sheep jumps, stairs and
lightning storms), seeded so they are the same every time and getting harder each stage. A realm map on the title
screen lets you replay any unlocked stage.

The art style is dark, misty chibi-anime: ink-outlined characters with big anime eyes, layered moonlit landscapes,
fog, glowing runes and fireflies. Loki follows the old myths rather than Marvel: a sly shapeshifter with wild black hair, ram horns, dark blue eyes, a royal-blue cloak over black leather and blue seiðr flame
(repainted from the green original with FLUX.2 edits, `assets/raw/loki_blue.png`, finished by `tools/loki_finish.py`). Thor wears dark
earthy colours: green mail, brown trousers and a burnt-orange cloak (`assets/raw/thor_earth.png`, `thorpose_earth.png`), with bright
green eyes from `tools/eye_colour.py`. The soundtrack is seven recorded tracks (made with the music AI Donna, originals in `assets/raw/music/`), cut into
seamless loops by `tools/build_music.py`: a Valhalla triumph (title screen, Asgard 11-3 and the hidden Valhalla realm: two epic orchestral pieces made with MiniMax Music on Hugging Face,
joined on the beat into `assets/raw/music/triumph.mp3`), a hero theme (Asgard), an anthem for Midgard, adventure (Alfheim), Vanaheim's own playful theme, cold and death (Jötunheim, Járnviðr, Niflheim, Helheim), fire and storm (Muspelheim, Ægir's Sea,
Svartalfheim), each realm playing its track a touch faster or slower, and a fast track for the Rainbow Rush.
In Járnviðr Thor rides a compact goat chariot drawn by Tanngrisnir and Tanngnjóstr (the stages are unchanged), the goats white with
black eye masks and brown horns of their own, as in the old paintings: a small cart with
the two goats pulled right up against it, only about twice his length, the team galloping through three painted phases
(`tools/build_chariot.py` from `assets/raw/chariot_gallop0..2.png`, a Z-Image painting and two FLUX.1 Kontext edits). At the goal he
hops off and leaves it standing behind him.
The animals have real voices, cut by `tools/cut_sfx.py` from field recordings on Wikimedia Commons (originals in `assets/raw/sfx/`):
a short, high lamb's bleat when Thor bounces on a sheep ("Sheep bleating", earthcalling, public domain, cut short and pitched up),
now and then a wolf howling far off in the woods when a wolf steps onto the screen (muffled and quiet) ("Wolf howls", U.S. Fish and Wildlife Service, public domain) and the raven's angry caw as it dives
(Yellowstone sound library, National Park Service, public domain). The eagle's screech before its swoop, the serpent's long hiss
when it appears and before it strikes, and the boar's heavy breathing before it charges are synthesized.
Without them the game falls back to its own music, epic quest music rendered once per realm into a seamless loop: a driving string ostinato,
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
- **Svartalfheim**, the deep halls of the dwarves: plenty of little red-capped gnomes (tomtes), often in pairs, dash at you as soon as they see you, and Viking dwarves
  march along and hurl their axes in spinning arcs (walking empty-handed until they fetch another)
  (dodge, then stomp them), and stalactites tremble and fall when you walk below them, (a painted dripstone turning into amethyst, `assets/raw/stalactite_ext.jpg`) their crystal tips glowing as a
  warning.
- **Alfheim**, the shining forest of the light elves: sea eagles circle above the trees, follow you, screech and swoop
  down in a long arc, or drop a stone when they are right above you; stomp them. The dark stags of Yggdrasil crouch and leap at you in big arcs: run under them
  or stomp them.
- **Helheim**, the cold realm of the dead: misty barrows, the river Gjöll and Hel's hall Éljúðnir. Draugr rise in
  numbers, Garm's wolves hunt you and carrion eagles swoop out of the fog.
- **Vanaheim**, the golden hills of the Vanir, with standing stones, the great oak and turf-roofed longhouses. Freyja's cats
  sit there in threes (calico, ginger and tuxedo), a little smaller than the wolves, washing a paw or, leg in the air,
  their bottom; when Thor comes close they leap up in fright and hop wildly around their spot (never into a pit), and
  scratch if they hit you (lightning only startles them, it never kills a cat). They spit and yowl when startled and let out a sinking
  cry when knocked out: two recorded clips ("angry cat" by tanweraman and "angry cat meow" by cartoon_music,
  Pixabay), trimmed into `assets/sounds/` and embedded; each coat plays them at its own pitch. The synthesized
  `yowl()` is only the fallback; once he is past they trot back and groom again. A stomp knocks a cat out, spiral eyes and
  all, like any other foe. Each cat has its own painted sheet (`assets/raw/cat_<coat>_sheet.png`, repainted with FLUX.2 Klein on Cloudflare in the wolf sprites' style from the earlier `_v1` sheets), cut into poses along their outlines
  by `tools/cats_fix.py`.
- **Fire boars** hunt you through Muspelheim: they trot toward you, paw the ground and charge with a trail of flame,
  and between charges (or when you are out of reach above them) they snort fireballs at you. Jump over them or stomp
  them and their fire goes out.
- **Fire serpents** lie coiled on the path in Muspelheim. When you come close they hiss and rear back, then snap low
  along the ground: jump over the bite, or stomp them. The pits there are lava.
- **Sheep** are bouncy trampolines that reach high platforms.
- **Touch controls** are carved runestones (painted stone disc via Higgsfield, runes drawn in SVG): ᚲ and its mirror
  to run, ᛏ (Tiwaz, the arrow rune) to jump; the rune glows when pressed.
- **The Völva**, a bald seeress with a ram-horned staff, turns to Thor and gives hints along the way.
- **Valkyries** fly by when you raise a checkpoint banner, and one carries Thor back when he falls.
- **Treasure** comes three ways: wooden rune coins (worth 1), rarer gold coins (worth 10, also inside some rune crates),
  and secret gems (worth 50) hidden inside one or two plain-looking stone blocks per stage. Every 100 earns an extra life.
- **Hidden ale**: one wooden tankard of ale is hidden in every stage, inside a plain stone block or a rune crate. Thor
  drinks it and starts a 10-second **Rainbow Rush**: he glows in rainbow colours, runs much faster, its own euphoric music plays,
  and every wolf, raven or draugr he touches is knocked out. Lightning can't hurt him either, but pits still can.
- **Valhalla**, the bonus realm: finishing the quest a second time opens it (and adds it to the title menu). Thor already
  carries Mjölnir; there are no enemies and no coins, only gems and boards that fall the moment you land on them.
  It is one long, unbroken run of 92 falling boards (trickier toward the end: more single boards, steeper steps, wider gaps on the way down): no banners, no resting stones, no Valkyrie to carry you, and gems
  never add extra lives here. A fall sends Thor back to the start. The gems are spinning, brilliant-cut diamonds with
  light flares, rendered once as a turning 3D model (`gemSheet`). At the
  end Odin welcomes Thor, they raise their horns and drink, and the Einherjar's Feast trophy is yours.
- Falling into a pit during a Rainbow Rush ends it: the Valkyrie brings Thor back without the rainbow.
- **Floating planks** hold for a moment after Thor lands on them, then shake, fall, and grow back a few seconds later.
- **Rune blocks** (ᚠ) give coins or a horn of mead (+1 shield, or +1 life when all shields are full).
- **Lightning-banner checkpoints** (a black and orange banner that unrolls when you reach it and shows a jagged bolt of polished golden lightning, made by `tools/flag_bolt.py`), 3 shields of health per life, and 3 lives. Your furthest stage is saved.
- **The stone altar** at the end of each realm carries the runes ᛋ ᛏ ᛞ (Sowilo, Tiwaz, Dagaz: sun, warrior, victory).
- **Save & back to menu** in the pause menu keeps the stage, the last checkpoint, score, treasure and lives;
  **Continue** on the title screen carries on from there. The journey is also saved at the start of every stage.
- **Speech bubbles** in cutscenes can be skipped with a tap, Space or Enter.
- **Sleipnir**: when a realm is done and Loki has fled, Odin's eight-legged horse gallops down from the sky and
  carries Thor off to the next realm.
- **Trophy Hall**: trophies are a reward for playing again. During the first journey nothing is counted and the hall
  is hidden. Taking Mjölnir back for the first time earns the first trophy, Worthy of Mjölnir, and opens the hall on the
  title screen. Each trophy has its own painted cup (FLUX.2 Klein on Cloudflare Workers AI, `tools/trophy_cups.py`,
  `tools/build_trophies.py`) themed to it, with its rune carved into the metal (grooves, shading and inlay, `tools/carve_trophy_runes.py`). Counting trophies (wolves, eagles, gems, sheep jumps, Allfather...) show a gold progress bar
  and "12 / 20" in the hall. There is one trophy for each of the 24 runes of the Elder Futhark, all named from the myths (Andvari's
  Hoard, Mímir's Eye, Baldr's Blessing, Gullinbursti's Fall, Rán's Net, Brísingamen, Einherjar's Feast and more), plus one cursed trophy, the Angel of
  Death, for losing 5 lives in a single stage, and the Allfather's trophy for earning all the others, the cursed one included. Locked trophies are greyed out but say how to earn them.

## Painted art

Some art is generated (Higgsfield GPT Image 2.5 and Google Gemini) and lives in `assets/` as WebP: the Thor, Loki, wolf, raven
and draugr sprite sheets, sheep, the Völva, Sleipnir, the mead horn, the Valkyrie, Mjölnir, the rune coin, the checkpoint banners (black and orange with a painted golden lightning bolt, `tools/flag_bolt.py`; the older red raven banner, its raven swapped for a bolt by `tools/raven_to_bolt.py`, stays as the fallback), real amethyst crystal spikes for Svartalfheim, glossy obsidian spikes with lava cracks for Muspelheim (`assets/raw/obsidianspike_ext.jpg`), glacier ice spikes for the frozen realms, ground props (runestones, mushrooms, lanterns, bones, ice crystals, ferns, boulders, snow mounds, frost grass), rune crates, stone blocks, stakes, ice spikes, golden spears, bridge planks, the rune gate, Asgard braziers, shield racks and golden shrubs, and painted backdrops for all six realms, the Muspelheim fire boar and fire serpent, the Svartalfheim dwarf, two Svartalfheim cave backdrops, three Alfheim backdrops (day, dusk, night), three Helheim backdrops, the Alfheim stag, three Vanaheim backdrops, the longship, narwhal, great wave and storm backdrop of Ægir's Sea, Odin for the Valhalla feast (standing with Gungnir, welcoming, raising his horn) and a midday and a night backdrop for Asgard. Thor also has painted poses for cutscenes (lifting Mjölnir, shaking his fist, being carried off by the Valkyrie). The untouched originals are in `assets/raw/`.
`tools/prepare_sprite.py` keys out a white background, splits the poses and builds the atlas. `tools/embed_assets.py` embeds them into `index.html` so the
game stays one file. Every character or realm without a painted image keeps its code-drawn version, so new images can be
added one at a time: drop the `.webp` (and sprite frames in `sprites.json`) into `assets/` and rerun the script.

## Language

The game starts in Spanish (Argentina, with *vos*); the main menu switches to English ("Idioma / Language"), and the
choice is remembered. All text is written in English in the code and goes through `tr()` when drawn: the `ES` table
holds the translations and `ES_RX` the ones with numbers or names in them.

## Download and install

`python3 mjolnir/tools/build_dist.py` builds `mjolnir/dist/` (not in git):

- `mjolnir-lost-web.zip`: unzip it into a folder on the homepage (for example `/mjolnir-lost/`) and link to that
  folder. Served over HTTPS it is an installable app (PWA): on Android/Chrome "Install app" or "Add to home screen", on
  iPhone Share → "Add to Home Screen", on a PC the install icon in the address bar (Chrome/Edge). After the first visit it
  works offline, with its own icon, full screen.
- Installed apps update themselves: online the game page is always loaded fresh (network first), offline the last
  saved copy starts.
- `mjolnir-lost.html`: the whole game in one file to download; open it by double-click in any browser, no internet needed.

The installable build shows "Install as an app" in the main menu: on Android and desktop Chrome/Edge it opens the
browser's install dialog, on iPhone it shows the three steps with the Share icon.

Both embed the fonts, so nothing is loaded from the internet. Progress and trophies are kept per browser.
