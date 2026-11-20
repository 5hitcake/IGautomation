#!/bin/bash
cd "$(dirname "$0")/.."
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slime Rush Reel</title><style>html,body{margin:0;background:#111;height:100%;display:flex;align-items:center;justify-content:center}canvas{height:100vh;max-width:100%;aspect-ratio:9/16}</style></head><body><canvas id="c"></canvas><script>'
  cat reel/assets.js; echo; cat reel/reel.js; echo '</script></body></html>'; } > slime_rush_reel.html
