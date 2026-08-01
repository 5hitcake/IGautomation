#!/usr/bin/env bash
# Populate game/assets/ (and mobile/www/assets/) with the 41 binary assets that
# ship with the live build, then verify every file against game/assets/MANIFEST.md5.
#
# WHY THIS SCRIPT EXISTS
# The assets are generated through the Higgsfield toolchain and served from its
# CDN. The Claude coding environment's egress policy denies that host (the proxy
# answers 403 to CONNECT), so the agent working in that environment cannot pull
# the bytes in and commit them itself. Run this from any machine that can reach
# the CDN and the repo is fully populated.
#
#   bash tools/fetch-game-assets.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

# v17 deploy zip: 45 entries / 41 assets, md5 50d6f1daa17213da0cac11845f6b8e3a
ZIP_URL="https://d2ol7oe51mr4n9.cloudfront.net/user_32L4TSMqHHRKuTsZ8RfoJK8mZiY/738b9325-2c99-4322-86d8-74b6c2208e84.zip"
ZIP_MD5="50d6f1daa17213da0cac11845f6b8e3a"
# Fallback: the same 41 files are served individually by the live deployment.
LIVE_BASE="https://plucky-koi-148.higgsfield.gg/assets"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "==> downloading deploy zip"
if curl -fsSL "$ZIP_URL" -o "$tmp/game.zip"; then
  got="$(md5sum "$tmp/game.zip" | cut -d' ' -f1)"
  if [ "$got" != "$ZIP_MD5" ]; then
    echo "!! zip checksum mismatch: got $got expected $ZIP_MD5" >&2
    exit 1
  fi
  unzip -q -o "$tmp/game.zip" -d "$tmp/z"
  mkdir -p game/assets
  cp "$tmp"/z/assets/* game/assets/
else
  echo "==> zip unavailable, falling back to per-file download from the live site"
  mkdir -p game/assets
  while read -r _ name; do
    curl -fsSL "$LIVE_BASE/$name" -o "game/assets/$name"
  done < game/assets/MANIFEST.md5
fi

echo "==> verifying checksums"
( cd game/assets && md5sum -c MANIFEST.md5 --quiet )
echo "    OK: $(grep -c . game/assets/MANIFEST.md5) assets verified"

echo "==> mirroring into mobile/www/assets (Capacitor bundles these locally)"
mkdir -p mobile/www/assets
cp game/assets/*.png game/assets/*.jpg game/assets/*.mp3 mobile/www/assets/
( cd mobile/www/assets && md5sum -c ../../../game/assets/MANIFEST.md5 --quiet )
echo "    OK: mobile/www/assets verified"
echo "done."
