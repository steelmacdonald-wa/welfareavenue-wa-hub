# CRM slice 1: final verification (07/11/26)

Branch `crm-slice1-280-284`, HEAD 92dc070. Nothing was written to the database, no function or page was deployed, no site_files were touched.

## Candidate

- Rebuilt from HEAD with pybuild.py: 232 segments, 8,585,190 bytes raw (CRLF checkout, md5 017b8482). After CRLF to LF: 8,485,983 bytes, md5 2913f36f4cc98d7e095666ba4593ac89. Same as the committed `build/candidate.html`.
- `git show HEAD:build/f/index.html | md5sum`: da9c679fa5e1a8d3a20926e918652543 (53,378 bytes, LF).
- The working tree shows three files as modified (`build/src/271_wave271.seg`, `build/src/279_wave279.seg`, `test/w281schema.sql`). They differ from HEAD only in line endings (git diff --ignore-cr-at-eol is empty). They were not committed.

## PGlite suites (all pass, run on the committed files as they are)

| Suite | Result |
|---|---|
| w281sql | OK, 178 runner checks |
| w282sql | OK, 56 |
| w283sql | OK, 79 |
| w284sql | OK, 21 |
| w284import (node --test) | 4 pass, 0 fail |
| w286sql | OK, 23 |
| w288sql | OK, 65 |

No CRLF md5 failure, so no LF copy was needed.

## Drive tests (candidate = build/candidate.html, Chrome from the Playwright cache, Playwright from hub-repo/test/node_modules)

How they find things: `test/boot.js` reads `WA_CHROME` for the Chrome path and `CAND` for the page (default `build/candidate.html`); Playwright came from `NODE_PATH`.

| Drive | Pass | Fail |
|---|---|---|
| w152 | 68 | 0 |
| w153 | 44 | 2 |
| w154 | 30 | 0 |
| w155 | 22 | 0 |
| w156 | 26 | 0 |
| w157 | 26 | 0 |
| w158 | 23 | 0 |
| w158b | 25 | 0 |
| w283drive | 51 | 0 |
| w284drive | 40 | 0 |
| w288drive | 30 | 0 |
| crm1ui_imports_worst | 104 | 0 |
| crm1ui_crm_worst | 145 | 0 |
| w274drive | 222 | 0 |
| w274onedrive | 163 | 0 |
| w285drive | 209 | 0 |

The two w153 failures are the known pair, which also fail on live: the menu foot staying in view when the menu is taller than the screen, and the HR centre opening on Overview with its own rail. Nothing else failed.

## Runbook and docs

- Runbook: candidate 2913f36f / 8,485,983; `f/index.html` blob da9c679f / 53,378. The old values (ff9aeae0, 8,447,299; 4adaf708, 52,764) are kept as history. The build is `bash build/build.sh`, or the pybuild helper if present, then LF conversion. New step 2.6: the four Toronto forms open only after the new /f/ page is live; the website pull request waits for it too.
- wave281 doc: undo order now SQL first, then the two functions, as in the runbook.
- wave288 doc: the reason for the undo order no longer says wave281's undo drops crm_chapters.
