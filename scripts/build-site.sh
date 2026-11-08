#!/usr/bin/env bash
# Builds the download site into _site/: copies site/ and zips each extension into _site/downloads/.
# Used by both deploy workflows (GitHub Pages and AWS).
set -euo pipefail

# Extensions offered for download (add new ones here).
EXTENSIONS=(bamboo-panda web-bingo find-pip longest-word-tracker page-flipper)

cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/downloads
cp -r site/. _site/

for ext in "${EXTENSIONS[@]}"; do
  (cd "$ext" && zip -r -q "../_site/downloads/$ext.zip" .)
done

ls -la _site _site/downloads
