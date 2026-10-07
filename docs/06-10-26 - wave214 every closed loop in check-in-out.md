# 06/10/26 - wave214: every closed loop goes to #check-in-out-wa

Live md5 `a4a8eb5c04ba1968c5878745a763abfd` (6,664,918 bytes), deployed through the gated pipeline on top of `269c4fb5` (the parallel session's wave213, the due-date check). Function: checkin-post v6 (platform version 16). Migration: `wa213_loop_one_channel` (build/data/wa213_loop_one_channel.sql). Numbered 214 at release: the due-date check shipped as wave213 while this was being built, so the migration, its SQL file and its change_log lines keep the wa213 / wave213 name.

## What Steel asked

Steel (06/10/26): "All closed loops should be done in the check in out channel". Asked which version he wanted (a parallel session had shipped wave212 at 23:07 Toronto the same evening: I'm in and Close the loop also posted in #check-in-out-wa, but a note still went to the person's team channel first, so it showed up twice), he chose **Only #check-in-out-wa**: every closed loop posts its note there and nowhere else; the My team / Everyone / Just the Hub choice comes off the wrap-up sheet; Close without a note still posts a one-line "closed the loop" there.

## What changed for people

- **The wrap-up sheet:** Who sees it is gone. Where it goes shows #check-in-out-wa (in Slack, for the whole team) and says every closed loop goes there, with no clock time and no hours, and that every note also shows on Home.
- **The post:** one post, in #check-in-out-wa: `:repeat: *Name* (Team) closed the loop`, the lines, and `Closed:` with the open task titles (a private task counted, never named). The team's name is in the post because every team shares the channel. No mention ping, no time, no hours.
- **Close without a note:** ends the session and posts only `:repeat: *Name* (Team) closed the loop` there. The toast says "#check-in-out-wa shows you closed it, with no note".
- **I'm in** (wave212, unchanged here): posts `:large_green_circle: @Name is in the loop` there. The button's words and the tour now say so (they still said "Nothing is posted").
- **The walkthrough (tour "loop")**: the I'm in step says a short line goes to #check-in-out-wa, never the time; the Who sees it step is now Where it goes; the Close the loop step says the note goes to #check-in-out-wa.
- **Training 216** (the reading): What it is not, step 5, Good to know and Try it say notes go to #check-in-out-wa. **Training 226** (the walkthrough row): "what moved, where it goes, and what never goes in the post". The old text of 216 is in change_log. The French copies refresh on the next i18n-translate run (stale rows are not served meanwhile).

## Server

checkin-post v6 (platform version 16; v5 was wave212's, platform 14; platform 15 was this wave's first deploy with "wave213" in the comments):
- `close` ignores `share_to` from the page (a cached older page still sends it) and posts once in the check-in-out channel (`app_config.checkinout_channel`, default `check-in-out-wa`; the Loop channel `loop_channel` only as a fallback). `share_to` on the row: `everyone` for a note, `hub` for a close without one. The `teamChannel` helper is gone.
- `draft` returns `team_channel: null` and `everyone_channel` = the check-in-out channel.
- `start` is wave212's (the "is in the loop" line).
- `app_config.loop_channel` is now `check-in-out-wa` too: the rename to #the-loop is off.
- Checked live with `dry: true` (trigger secret, `as_email`): a note sent with `share_to: team` and one with `share_to: hub` both answer channel `check-in-out-wa`; a close without a note answers the one line; `draft` answers `team_channel: null`, `everyone_channel: check-in-out-wa`. Nothing was posted.
- hours-pull skips bot messages, so the Hub's lines in #check-in-out-wa never count as hours.

## Files

- `build/src/192_wave192.seg` (the sheet, the button's title, the tour; the `.share` styles and the change handler removed; `.where` added).
- `fn/checkin-post/index.ts`, `meta.json` (version 16).
- `build/data/wa213_loop_one_channel.sql`.
- `test/w192drive.js` (Where it goes, the close always to everyone, the skip toast, the tour's step names, the reading names #check-in-out-wa), `test/fx_w192.json` (216 and 226 with this wave's words).
- `docs/EDGE_FUNCTIONS.md`, `docs/HUB_RELEASE_CHECKLIST.md`.

## Verification

- `test/w192drive.js` on the candidate: 76 passed, 4 failed. The 4 (the chrome tour's step; the reading's headings, numbered steps and callouts) fail the same way on the live build before this wave with the test as it was (75 passed, 4 failed): drift from later waves, not this one.
- Screenshots of the sheet at 1366 and 390 wide: Where it goes as one green pill, no sideways scroll.
- `check_remaps.py` clean; the scripts parse.
- Live: hub.welfareavenue.com serves `a4a8eb5c...`; host-sync answered ok (Netlify deploy made).

## Temporary tables

`wa_stage_pull213` (the repo files pulled) and `wa_stage_214` (the deploy parts) are closed to the API; the hourly sweep drops them.
