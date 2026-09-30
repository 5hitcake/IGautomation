# Mjölnir Lost

A Mario-style Viking platformer. Loki has stolen Thor's hammer, and you chase him through five Norse realms:
Midgard, Jötunheim, Járnviðr (the Iron Wood), Niflheim and Asgard. At the end of each realm Thor almost grabs
Mjölnir, but Loki snatches it and flees to the next realm. In Asgard, Thor finally takes it back.

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
- **Wolves** patrol, and from the Iron Wood onward some of them pounce. Stomp them like goombas.
- **Ravens** circle overhead, and their eye turns red just before they dive at you.
- **Sheep** are bouncy trampolines that reach high platforms.
- **Rune blocks** (ᚠ) give coins or a horn of mead (+1 shield). Every 100 coins earns an extra life.
- **Raven-banner checkpoints**, 3 shields of health per life, and 3 lives. Your furthest realm is saved, so you can
  continue later.
