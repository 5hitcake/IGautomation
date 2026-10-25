# Boden-Kacheln

Erzeugt mit `tools/boden.py kachel` aus den Rohbildern in `roh/`:

| Kachel | Befehl |
|---|---|
| gras | `kachel roh/gras.jpg gras --ohne-erde` |
| gras_ruhig | `kachel roh/gras_ruhig.jpg gras_ruhig` |
| erde | `kachel roh/erde.jpg erde --wiederholung 512 --ausgleichen` |
| schotter | `kachel roh/schotter.jpg schotter --meter 6 --ausgleichen` |
| asphalt | `kachel roh/asphalt.jpg asphalt --meter 16 --wiederholung 1024 --ausgleichen --saettigung 0.45 --helligkeit 0.78` |
| sand | `kachel roh/sand.jpg sand --meter 16 --wiederholung 1024 --ausgleichen` |
| wasser | `kachel roh/wasser.jpg wasser --meter 16 --wiederholung 1024 --ausgleichen` |
| fels | `kachel roh/fels.jpg fels --meter 8 --wiederholung 512 --ausgleichen` |
