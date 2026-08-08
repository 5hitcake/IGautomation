#!/usr/bin/env bash
# Populate game/assets/ AND mobile/www/assets/ with the 33 binary game assets
# the current build references, then verify every file against
# game/assets/MANIFEST.md5.
#
#     bash tools/fetch-game-assets.sh
#
# WHY THIS SCRIPT EXISTS
# The assets are generated through the Higgsfield toolchain and served from its
# CDN. The Claude coding environment's egress policy denies that host (the agent
# proxy answers 403 to CONNECT), so the agent working there cannot pull the
# bytes in and commit them itself. Run this from any machine or CI runner that
# can reach the CDN and both directories are fully populated.
#
# mobile/www/assets/ is what Capacitor bundles into the native app. If it is
# empty the installed app has NO sprites or audio and the game silently falls
# back to placeholder rendering (a plain coloured triangle instead of the
# dragon) - so this script is a hard prerequisite for any real device test.
set -euo pipefail
cd "$(dirname "$0")/.."

# v27 deploy zip - the build currently live at plucky-koi-148.higgsfield.gg.
# It contains 41 files; only the 33 in MANIFEST.md5 are still referenced (the
# 8 acc_*.png accessory sprites were retired when the outfit feature was
# dropped, and are deliberately NOT copied out).
ZIP_URL="https://d2ol7oe51mr4n9.cloudfront.net/user_32L4TSMqHHRKuTsZ8RfoJK8mZiY/65013e62-7a04-435f-8676-d7ac1fcb686a.zip"
ZIP_MD5="41ac5a8cc14a5e2d4f1756b0631e1a6b"
LIVE_BASE="https://plucky-koi-148.higgsfield.gg/assets"

MANIFEST="game/assets/MANIFEST.md5"
[ -f "$MANIFEST" ] || { echo "!! $MANIFEST missing" >&2; exit 1; }
COUNT="$(grep -c . "$MANIFEST")"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p game/assets

echo "==> downloading deploy zip ($COUNT assets wanted)"
if curl -fsSL "$ZIP_URL" -o "$tmp/game.zip"; then
  got="$(md5sum "$tmp/game.zip" | cut -d' ' -f1)"
  if [ "$got" != "$ZIP_MD5" ]; then
    echo "!! zip checksum mismatch: got $got expected $ZIP_MD5" >&2
    exit 1
  fi
  unzip -q -o "$tmp/game.zip" -d "$tmp/z"
  # copy ONLY the files named in the manifest, so retired assets never come back
  while read -r _ name; do
    [ -n "$name" ] || continue
    cp "$tmp/z/assets/$name" "game/assets/$name"
  done < "$MANIFEST"
else
  echo "==> zip unavailable, falling back to per-file download from the live site"
  while read -r _ name; do
    [ -n "$name" ] || continue
    curl -fsSL "$LIVE_BASE/$name" -o "game/assets/$name"
  done < "$MANIFEST"
fi

echo "==> verifying game/assets"
( cd game/assets && md5sum -c MANIFEST.md5 --quiet )
echo "    OK: $COUNT assets verified"

echo "==> mirroring into mobile/www/assets (Capacitor bundles these into the app)"
rm -rf mobile/www/assets
mkdir -p mobile/www/assets
while read -r _ name; do
  [ -n "$name" ] || continue
  cp "game/assets/$name" "mobile/www/assets/$name"
done < "$MANIFEST"
( cd mobile/www/assets && md5sum -c ../../../game/assets/MANIFEST.md5 --quiet )
echo "    OK: mobile/www/assets verified ($(ls mobile/www/assets | wc -l) files)"

echo
echo "==> done. Commit both directories:"
echo "    git add game/assets mobile/www/assets"
echo "    git commit -m 'Bundle current game assets into the repo and the native app'"
