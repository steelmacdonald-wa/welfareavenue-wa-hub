#!/bin/bash
# Assemble the WA Hub single-file build from src/ segments in MANIFEST order.
# Segments generated from parts (build/partsNNN/*.js) are rebuilt with partsNNN/assemble.py first.
# See docs/ARCHITECTURE.md for the layering rules.
set -e
cd "$(dirname "$0")"
OUT="${1:-candidate.html}"
: > "$OUT.tmp"
while read -r seg; do
  [ -z "$seg" ] && continue
  case "$seg" in \#*) continue ;; esac
  cat "src/$seg.seg" >> "$OUT.tmp"
done < src/MANIFEST.txt
# strip the final newline artifact: segments each end with \n; original file ends with \n after </html>
printf '%s' "$(cat "$OUT.tmp")" > "$OUT"; printf '\n' >> "$OUT"
rm "$OUT.tmp"
# The brand palette (wave114) and the team labels (wave116) are baked into the sources since the
# 26/09/26 audit (bake_remaps.py). This guard fails the build if a legacy value comes back.
python3 check_remaps.py "$OUT"
wc -c "$OUT"
