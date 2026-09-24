#!/bin/bash
# WA Hub Phase 0 gate: render candidate vs baseline and diff every page snapshot.
# Usage: ./compare.sh <candidate.html>
# Exit 0 = every page + chrome DOM-identical for staff, board, and member runs.
set -u
CAND="$1"
cd "$(dirname "$0")"
FAIL=0
run () { # label role email name
  local label="$1" role="$2" email="$3" name="$4"
  rm -rf "cand_$label"
  node harness.js "$CAND" "cand_$label" "$role" "$email" "$name" >/dev/null 2>&1
  if ! diff -rq "baseline_$label/pages" "cand_$label/pages" > "/tmp/diff_$label.txt" 2>&1; then
    echo "DIFF ($label):"; cat "/tmp/diff_$label.txt"; FAIL=1
  fi
  if ! cmp -s "baseline_$label/chrome.html" "cand_$label/chrome.html"; then
    echo "DIFF ($label): chrome.html differs"; FAIL=1
  fi
  # error parity
  local be ce
  be=$(jq -r '.errors|length' "baseline_$label/report.json")
  ce=$(jq -r '.errors|length' "cand_$label/report.json")
  if [ "$be" != "$ce" ]; then echo "DIFF ($label): error count $be -> $ce"; FAIL=1; fi
}
run staff  staff steel.macdonald@welfareavenue.com "Steel MacDonald"
run board  board consult.tamaraangeline@gmail.com "Tamara Angeline"
run member staff amanda.zoldak@welfareavenue.com "Amanda Zoldak"
if [ "$FAIL" = "0" ]; then echo "ALL GREEN: candidate is DOM-identical to v75 baseline on every page, all 3 identities"; fi
exit $FAIL
