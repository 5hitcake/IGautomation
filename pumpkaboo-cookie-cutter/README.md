# Pumpkaboo clay cutter

A 3D-printable cutter in the shape of Pumpkaboo, made for pottery. The outline and the detail lines are traced directly from the official artwork (Pokédex #710): the red line in the preview is the cut line laid over the original.

![preview](preview.png)

## Files

| File | What it is |
|---|---|
| `pumpkaboo_cutter_stamp.stl` | Cuts the outline **and** presses the details into the clay in one push: eyes and fangs (as small wells), mouth, cloak folds, the rings of the lantern holes and the pumpkin ridges. |
| `pumpkaboo_cutter_outline.stl` | Outline only. The clay comes out more easily, and you can carve or stamp the details by hand. |
| `make_cutter.py` | Generator script. It downloads the artwork, traces it, and builds the STLs. Change the parameters at the top and run it again. |
| `screenshots/` | Renders of both models from all sides (`uebersicht_*.png` is an overview sheet). |

The cut shape is **93 × 100 mm**. With the flange the part is 106 × 113 mm and 25 mm tall. Change `TARGET_H` to resize.

## Printing

- Print with the **flange flat on the bed** (the orientation the STL already has). No supports needed.
- Layer height 0.2 mm. Use at least 3 perimeters, or "detect thin walls". The cutting edge is 0.9 mm (two lines with a 0.4 mm nozzle).
- PLA works fine. PETG holds up better if you wash it with warm water.

## Using it with clay

- The details are set for a **6 mm slab** and press about **2 mm** deep. For a different slab thickness, set `SLAB` (and `IMPRINT` if you want) in `make_cutter.py` and run `python3 make_cutter.py`.
- The design is mirrored in the model on purpose, so the tuft curls the right way on the clay once you flip the cutter blade-down.
- Dust the cutter with cornstarch, or put a piece of plastic wrap over the slab before pressing (this also gives softer, rounded imprint edges). Either way the clay releases more cleanly.
- Clay shrinks about 10–15 % from drying and firing. To get a finished piece of a certain size, raise `TARGET_H` to make up for it (e.g. `TARGET_H = 115`).

## Rebuilding

```bash
pip install shapely manifold3d trimesh numpy matplotlib opencv-python-headless scikit-image
python3 make_cutter.py
```
