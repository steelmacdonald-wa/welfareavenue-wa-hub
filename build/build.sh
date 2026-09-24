#!/bin/bash
# Assemble the WA Hub single-file build from src/ segments in MANIFEST order.
set -e
cd "$(dirname "$0")"
OUT="${1:-candidate.html}"
: > "$OUT.tmp"
while read -r seg; do
  [ -z "$seg" ] && continue
  cat "src/$seg.seg" >> "$OUT.tmp"
done < src/MANIFEST.txt
# strip the final newline artifact: segments each end with \n; original file ends with \n after </html>
printf '%s' "$(cat "$OUT.tmp")" > "$OUT"; printf '\n' >> "$OUT"
rm "$OUT.tmp"
# wave114 (24/09/26): rewrite legacy palette values to the brand palette, unless NO_REMAP=1 (baseline builds)
if [ -z "$NO_REMAP" ] && [ -f "brand_remap.py" ]; then python3 brand_remap.py "$OUT"; fi
# wave116 (24/09/26): team rename and split (labels + workstream lists later waves hard code)
if [ -f "teams_remap.py" ]; then python3 teams_remap.py "$OUT"; fi
wc -c "$OUT"
