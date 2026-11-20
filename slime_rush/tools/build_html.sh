#!/bin/bash
# baut die eigenständige HTML-Datei aus proto/assets.js + proto/game.js
cd "$(dirname "$0")/.."
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slime Rush Prototyp</title><style>html,body{margin:0;background:#111;height:100%;display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100vh;aspect-ratio:16/9;border-radius:12px;cursor:pointer}</style></head><body><canvas id="c"></canvas><script>'
  cat proto/assets.js; echo; cat proto/game.js; echo '</script></body></html>'; } > slime_rush_prototyp.html
