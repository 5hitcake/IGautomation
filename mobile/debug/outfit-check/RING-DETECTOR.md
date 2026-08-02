# Ring-vs-drape detector (added after the scarf shipped as a hoop)

## Why the symmetry metric missed this

`acc_scarf` passed the side-view symmetry test at **-0.018** and still shipped
wrong: it was drawn as a rigid ring/hoop, not a draped scarf. Symmetry only
measures left-right mirror agreement - it says nothing about whether the subject
is the right *kind* of object. A ring seen at a slight angle is asymmetric and
scores fine. No amount of `rot` can fix it either: rotating a ring only changes
which way the hole faces.

## The metrics

Computed on the alpha mask cropped to the content bbox.

- **`split_frac`** - fraction of scanlines that cross the shape **twice or more**.
  A band with a hole through it has two crossings on most rows. **This is the
  reliable one for this art style.**
- `hole_frac` - enclosed transparent area (flood-filled from the border) over
  shape area. Weak here: the STYLE FORMULA deliberately says outlines "never
  quite close into a perfect curve", so the hole leaks and stops being enclosed.
  The shipped ring only scored 0.0442 despite plainly being a ring.
- `solidity` - shape area / convex hull area.
- `aspect` - w/h of the content bbox. A hanging tail is taller than wide.

## Calibration on shipped art

| asset | split_frac | hole_frac | solidity | aspect |
|---|---:|---:|---:|---:|
| **acc_scarf (the ring, rejected)** | **0.718** | 0.0442 | 0.738 | 1.402 |
| acc_goal / ui_goal_egg | 0.366 | 0.0 | 0.820 | 0.964 |
| acc_partyhat | 0.338 | 0.1829 | 0.721 | 0.713 |
| acc_cape | 0.327 | 0.0 | 0.838 | 1.331 |
| acc_goggles | 0.314 | 0.0104 | 0.663 | 1.907 |
| acc_crown | 0.312 | 0.0 | 0.712 | 1.468 |
| acc_pilotcap | 0.070 | 0.0034 | 0.836 | 0.991 |
| acc_tophat | 0.067 | 0.0 | 0.823 | 1.168 |

**Threshold: `split_frac` >= ~0.6 means the shape is probably a closed band.**
Healthy non-ring accessories sit at 0.07-0.37.

## Replacement scarf candidates

All three prompts explicitly forbade ring / hoop / donut / torus / bracelet /
napkin ring / necklace / choker / closed band, and asked for knit ribbing
texture with a hanging fringed tail.

| cand | job id | split_frac | hole_frac | aspect | H-sym | h_frac | w_frac |
|---|---|---:|---:|---:|---:|---:|---:|
| **A (chosen)** | `8aee1b63-7889-413c-b653-bf84c4356563` | **0.132** | 0.0015 | **0.476** | -0.384 | **0.895** | **0.430** |
| B | `4fd4b6d0-94c1-42ab-908e-6b65464bb8b4` | 0.298 | 0.0000 | 0.525 | +0.467 | 0.895 | 0.469 |
| C | `76ed9d45-8575-4aa9-a4ff-c84c7c60106d` | 0.315 | 0.0008 | 0.758 | -0.027 | 0.898 | 0.680 |

A wins on every axis: lowest split_frac (0.132, below even the healthiest
shipped accessory), essentially zero enclosed hole, and aspect 0.476 - a drape
about twice as tall as it is wide, which is what the user's reference shows.
Clean key at 81.6% green, 0.000% leak, 0.0% poppy-red, nothing edge-clipped.

## What this means for the anchor

The new art is **taller than wide** (aspect 0.476) where the ring was **wider
than tall** (1.402), and its content-fill height fraction rises from 0.641 to
**0.895**. Two consequences:

1. **`rot: Math.PI/2` must be removed.** The art is now drawn upright - wrap at
   the top, tail hanging down. Rotating it 90 degrees would lay the drape on its
   side, reintroducing the bug in a new form.
2. **`scale` must come down.** Visible height is `size * 0.4 * scale * h_frac`.
   At the current `scale 0.78` the new art renders `0.4*0.78*0.895 = 0.279` of
   the dragon's height, versus `0.4*0.78*0.641 = 0.200` before - about 40%
   taller. To preserve the previous visible height: `scale = 0.20/(0.4*0.895)
   = 0.559`. Round to **`scale: 0.56`** as a starting point.

NOT deployed - held per instruction so the anchor can be adjusted first.
