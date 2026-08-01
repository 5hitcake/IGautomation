# Side-view accessory regeneration - measurements for setting `scale`

Four accessories regenerated in side-view profile. **The PNGs are not committed**
(same egress denial as before - the media CDN is 403 from this environment). They
are staged on the CDN by job id and will be baked into the next deploy zip.

## Acceptance test: horizontal mirror symmetry

`sym = 1 - mean|alpha - fliplr(alpha)| / mean(alpha)` over the content bbox.
Calibration: genuine side-view art in this game scores **-0.19 .. +0.61**
(enemy_archer -0.187, obs_catapult 0.333, char_idle 0.374, enemy_bat 0.605).
Frontal art scores **~0.87 .. 0.96**.

| asset    | job id                               | sym BEFORE | sym AFTER | verdict |
|----------|--------------------------------------|-----------:|----------:|---------|
| scarf    | 92a0fcc5-0d57-4cfe-8ca3-a1034853d33b |     +0.802 |  **-0.018** | pass |
| partyhat | 2da5aa14-1075-429a-b957-0888cdcf3b4b |     +0.937 |  **+0.212** | pass |
| cape     | b29d26c4-83ef-4ec0-9b00-19b8533a7eca |     +0.872 |  **+0.265** | pass |
| pilotcap | a6ba73ae-5b06-49e6-816f-84d6ea371185 |     +0.959 |  **+0.433** | pass (2nd attempt) |

pilotcap attempt 1 (`e28fe8d5-ed34-442c-898b-ba6485077729`) scored +0.612 - inside
the band but only barely, so it was rejected and regenerated with a prompt that
described the lopsided profile outline explicitly.

All four: green leak <= 0.002%, poppy-red 0.0%, acid-yellow 0.0%, nothing
edge-clipped, backgrounds keyed from 67-85% green.

## Content-fill fractions, for setting `scale`

Each PNG is padded to a square and resized to 256x256, so `ow === oh` in
`drawOutfit` and only these fractions determine apparent size.

| asset    | h_frac | w_frac | aspect |
|----------|-------:|-------:|-------:|
| scarf    |  0.641 |  0.898 |  1.398 |
| partyhat |  0.898 |  0.641 |  0.716 |
| pilotcap |  0.898 |  0.891 |  0.994 |
| cape     |  0.672 |  0.895 |  1.336 |

**Formula.** `drawOutfit` gives `oh = size * 0.4 * scale`, so the artwork's
visible height on screen is:

    visible_height = size * 0.4 * scale * h_frac

Invert it to pick a scale for a target size expressed as a fraction of the
dragon's height:

    scale = target_height_frac / (0.4 * h_frac)

Worked example - to make the scarf 25% of the dragon's height:
`scale = 0.25 / (0.4 * 0.641) = 0.975`.

For reference the shipped goggles are `scale 0.85` with `h_frac 0.336`, giving a
visible height of `0.4 * 0.85 * 0.336 = 0.114` of the dragon - and the user
confirmed that size reads correctly, so it is a reasonable yardstick for the
other head-worn items.
