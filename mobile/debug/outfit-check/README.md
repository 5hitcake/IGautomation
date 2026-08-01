# Outfit placement ground truth

## Why there are no PNGs in this folder

The 9 screenshots were captured successfully (real headless Chromium, `mobile/www`
served locally, build gated on commit `6837207` / `index.html` md5
`d60af6957f89fd59d5b3e6895a9961be`), but they **could not be committed from the
Claude coding environment**: outbound HTTPS here goes through an agent proxy and
the org egress policy denies the media hosts —
`curl` exits 56, `CONNECT tunnel failed, response 403`, for both
`d2ol7oe51mr4n9.cloudfront.net` and `plucky-koi-148.higgsfield.gg`.
`/root/.ccr/README.md` states such denials must be reported, not routed around,
so the bytes were not relayed in by another channel.

**To unblock:** allowlist those two hosts for the session, or run
`tools/fetch-game-assets.sh` from a machine with access (same blocker, same fix).

What *is* committed here is the measured geometry, which is what the anchor
numbers actually need.

## Files

- `silhouette.txt` — ASCII map of `char_idle.png` on the exact `OUTFIT_ANCHOR`
  coordinate grid. Read it directly to see where head / neck / back / wing are.
- `geometry.json` — measured landmarks in anchor space, plus each accessory's
  content fill inside its padded square PNG.

## Coordinate space

Identical to `OUTFIT_ANCHOR`: `dx = px/imgW - 0.5`, `dy = px/imgH - 0.5`.
The sprite is drawn filling `-size*ar/2 .. +size*ar/2` by `-size/2 .. +size/2`,
so these map 1:1 onto anchor `dx,dy`. `char_idle.png` is 448x343, ar = 1.3061.
The dragon faces RIGHT.

## The finding that is NOT about anchors

`drawOutfit` computes `ow = oh * img.width/img.height`. **Every accessory PNG is
a 256x256 square** (they were padded to square during the chroma-key step), so
`ow === oh` for all 8 and the drawn box is always the same 29.6 x 29.6 canvas px
— confirmed at runtime for all 8 outfits.

But the *content* inside that square differs a lot:

| outfit   | content w frac | content h frac | aspect |
|----------|---------------:|---------------:|-------:|
| goggles  | 0.895          | 0.336          | 2.66   |

The goggles occupy only ~34% of their square's height, so they render roughly
10 px tall inside a 29.6 px box, while a tall item like the top hat fills far
more of its square. Anchoring alone will not fix relative sizing — each outfit
also needs a scale factor (or the source PNGs need trimming to content), or
goggles will keep looking like a small flat sticker next to oversized hats.
