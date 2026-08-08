#!/usr/bin/env bash
# Fetch the app icon + splash (and the store screenshots), verify their
# checksums, and regenerate every native Android/iOS icon and splash size.
#
# ONE COMMAND completes the whole "real icon instead of the Capacitor robot"
# task:
#
#     bash mobile/fetch-brand-assets.sh
#
# WHY THIS SCRIPT EXISTS
# The artwork lives on the Higgsfield CDN. The Claude coding environment's
# egress policy denies that host (the agent proxy answers 403 to CONNECT), so
# the agent cannot pull the bytes in and commit them itself. Run this from any
# machine or CI runner that can reach the CDN and the repo is fully populated.
# Then commit mobile/resources/, mobile/android/app/src/main/res/mipmap-*/,
# mobile/android/app/src/main/res/drawable*/ and
# mobile/ios/App/App/Assets.xcassets/.
set -euo pipefail
cd "$(dirname "$0")"

CDN="https://d2ol7oe51mr4n9.cloudfront.net/user_32L4TSMqHHRKuTsZ8RfoJK8mZiY"

# name|path|cdn-id|md5
ASSETS=(
  "icon|resources/icon.png|865f2dbd-60d2-42b6-9468-6f95cae8147e|ed43e676293bee396268e06a6f0e5f98"
  "splash|resources/splash.png|3a67c0b0-5b7f-4c16-ba7b-c7dff144c965|d6f5af76d443a7019e5604ecbab0524e"
  "shot-freedraw|store/screenshots/1-freedraw.png|01aad5e8-f2fa-45b0-94a6-720f8ccca770|e448a012087f623e4abfaa15febb252e"
  "shot-campaign|store/screenshots/2-campaign.png|d13c156f-1fd3-4e8f-8c26-0d81c4b3cee6|72be1800025d2deed72ecc4fb457d6d0"
  "shot-shop|store/screenshots/3-shop.png|0cfd23c3-7765-4ab9-b2b3-afa60b22d04f|2608656a0b7e174e15de6915f72680eb"
  "shot-coins|store/screenshots/4-coins.png|742c4d67-8d6c-4775-beb5-4d05c3f13e72|6147f59b590e3693a2fa4af86f99ec2a"
)

echo "==> fetching brand assets"
for row in "${ASSETS[@]}"; do
  IFS='|' read -r name path id want <<< "$row"
  mkdir -p "$(dirname "$path")"
  curl -fsSL "$CDN/$id.png" -o "$path"
  got="$(md5sum "$path" | cut -d' ' -f1)"
  if [ "$got" != "$want" ]; then
    echo "!! checksum mismatch for $name ($path)" >&2
    echo "   got $got, expected $want" >&2
    exit 1
  fi
  printf '    %-14s %s  %s\n' "$name" "$got" "$path"
done

echo "==> sanity-checking the icon"
# The icon must stay text-free: the app is dual-named (Dragonslide / Kritzeldrache).
python3 - <<'PY'
from PIL import Image
im = Image.open("resources/icon.png")
assert im.size == (1024, 1024), f"icon must be 1024x1024, got {im.size}"
assert im.mode in ("RGB", "RGBA"), im.mode
sp = Image.open("resources/splash.png")
assert sp.size == (2732, 2732), f"splash must be 2732x2732, got {sp.size}"
print("    icon 1024x1024, splash 2732x2732 - OK")
PY

if [ ! -d node_modules ]; then
  echo "==> installing node deps (needed for @capacitor/assets)"
  npm ci
fi

echo "==> regenerating native icons/splashes (overwrites the Capacitor placeholder)"
npm run assets

echo
echo "==> done. Review and commit:"
echo "    git add mobile/resources mobile/store/screenshots \\"
echo "            mobile/android/app/src/main/res mobile/ios/App/App/Assets.xcassets"
echo "    git commit -m 'Mobile: real app icon and splash, regenerated native sizes'"
