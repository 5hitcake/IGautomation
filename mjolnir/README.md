# Mjölnir Lost

A Mario-style Viking platformer. Loki has stolen Thor's hammer, and you chase him through five Norse realms:
Midgard, Jötunheim, Járnviðr (the Iron Wood), Niflheim and Asgard. At the end of each realm Thor almost grabs
Mjölnir, but Loki snatches it and flees to the next realm. In Asgard, Thor finally takes it back.

The art style is dark, misty chibi-anime: ink-outlined characters with big anime eyes, layered moonlit landscapes,
fog, glowing runes and fireflies. Loki follows the old myths rather than Marvel: a sly fire-haired jötunn with
seiðr-green flame and the dwarves' stitches across his lips. The music is dark Nordic ambient (drone, throat-chant,
frame drum, plucked lyre, choir, wind).

Open `index.html` in any modern browser. It's one self-contained file with no build step and no assets. All art is
drawn on a canvas and all sound is synthesized with WebAudio. (The only external request is the Google Fonts
stylesheet, and the game falls back to system fonts without it.)

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Run | ← → or A / D | ◀ ▶ |
| Jump (hold for higher) | Space, W or ↑ | JUMP |
| Sprint | Shift (or X) | RUN |
| Pause / sound | P / M | top-right buttons |

## What's in it

- **Lightning storms** are the main enemy. A glowing Thurisaz rune (ᚦ) appears on the ground about a second before a
  bolt hits that spot. Each storm follows its own pattern: sweeping left or right, bouncing back and forth, alternating
  checkerboards, random rain, or hunting your position. You have to move forward and back to slip through. Stone roofs
  shelter you, and lightning also knocks out wolves and scorches sheep.
- **Wolves** of Fenrir's blood patrol, and from the Iron Wood onward some of them pounce. Stomp them like goombas.
- **Draugar**, the undead Vikings of the barrows, need two stomps: one knocks the helmet off, the second sends them back to Hel.
- **Ravens** circle overhead, and their eye turns red just before they dive at you.
- **Sheep** are bouncy trampolines that reach high platforms.
- **Ratatoskr**, the messenger squirrel of Yggdrasil, sits on rune stumps and gives hints.
- **Valkyries** fly by when you raise a raven banner, and one carries Thor back when he falls.
- **Rune blocks** (ᚠ) give coins or a horn of mead (+1 shield). Every 100 coins earns an extra life.
- **Raven-banner checkpoints**, 3 shields of health per life, and 3 lives. Your furthest realm is saved, so you can
  continue later.

## Painted art

Some art is generated (Higgsfield GPT Image 2.5 and Google Gemini) and lives in `assets/` as WebP: the Thor, Loki and
draugr sprite sheets, sheep, Ratatoskr, the mead horn, the Valkyrie, and painted backdrops for all five realms. The untouched originals are in `assets/raw/`.
`tools/prepare_sprite.py` keys out a white background, splits the poses and builds the atlas. `tools/embed_assets.py` embeds them into `index.html` so the
game stays one file. Every character or realm without a painted image keeps its code-drawn version, so new images can be
added one at a time: drop the `.webp` (and sprite frames in `sprites.json`) into `assets/` and rerun the script.
