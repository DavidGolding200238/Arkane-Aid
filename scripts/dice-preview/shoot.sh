#!/usr/bin/env bash
# Usage: scripts/dice-preview/shoot.sh out.png "dice=20:20&t=0.6"
set -euo pipefail
cd "$(dirname "$0")/../.."
npx --yes esbuild@0.25.0 scripts/dice-preview/preview.ts --bundle --format=iife --outfile=/tmp/dice-preview.js --log-level=warning
printf '<!doctype html><html><body><script src="dice-preview.js"></script></body></html>' > /tmp/dice-preview.html
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=${W:-660},${H:-560} --virtual-time-budget=4000 --screenshot="$1" "file:///tmp/dice-preview.html?${2:-}" 2>/dev/null
