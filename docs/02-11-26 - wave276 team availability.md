# wave276: team availability, when can we meet (built 02/11/26)

Steel asked (02/11/26) for a when-to-meet tool so managers can move a department meeting without the Slack back-and-forth: members enter a typical week of availability, and the team's Agenda tab shows when everyone can make it. Design: `docs/superpowers/specs/2026-11-02-team-availability-design.md` (approved 02/11/26); plan: `docs/superpowers/plans/2026-11-02-team-availability.md`. Numbered 276 because another session holds wave275 (streamlined onboarding).

## What it does

- **Home pop-up** (`#w276pop`): "Your availability for <team> meetings". A typical week, Monday to Sunday, 08:00 to 22:00 in half-hour cells, Toronto time, painted by dragging (mouse) or tapping. "Valid from" is the date the week changes (first day of term). Under 10 hours the note below the grid asks for a little more; Save still works. "Ask me later" snoozes 3 days. It opens once per page load, for the first team that is due, and never on top of another pop-up (both wave272's and wave276's `otherOpen` lists know each other).
- **Agenda tab panel** (`#w276panel`, above the agenda tool on `#team/<code>/agenda`): the team heat map (cell shade = how many can make it; tap for names), the three best windows of at least an hour ranked by headcount then fewest recurring calendar clashes, "k of n up to date since <ask date>", and **My availability**. Leaders (every `hub_roles` leader of the team, the reports-to manager in the org chart, admins, HR) also get **Propose** on each window (a confirm, then a Slack DM to the team) and **Ask the team** (sets today's ask, DMs everyone not saved since it).
- **Re-asking**: a team "ask" row with a date. Seeded for every `dept_meta` code: 02/11/26 (so everyone is asked once at release), then 04/01/27, 03/05/27 and 06/09/27 (first Mondays). A leader's "Ask the team" adds one dated today. Someone is due when they have no saved grid for the team or their last save is before the latest ask on or before today.
- **Calendar clashes**: a weekday cell is dimmed when the person's hub@ calendar has it busy in 3 or more of the next 4 weeks (recurring meetings); one-offs are ignored; events of 12 hours or more are skipped.

## Steel's decisions
Typical week with an effective-from date, not specific dates. Every leader on a team gets Propose and Ask, not only the reporting line. The 10-hour minimum is a note, never a block. The note's wording is the medium draft Steel chose (`../docs/availability-note.md` in the workspace).

## Database
`build/wa276_avail.sql` (undo `build/wa276_undo.sql`; proof `node test/w276sql.mjs` on PGlite). Tables `hub_team_avail` (one row per person, team and effective-from date; the browser can only read, all writes go through `wa_avail_save` and `wa_avail_snooze`) and `hub_team_avail_ask`. Predicates `wa_avail_can_see`, `wa_avail_can_manage`, `wa_avail_manager_of` (service role only; notify calls it). RPCs `wa_avail_due`, `wa_avail_mine`, `wa_avail_save`, `wa_avail_snooze`, `wa_avail_team`, `wa_avail_ask_set`. Settings in `app_config`: `avail_grid_start` 480, `avail_grid_end` 1320, `avail_cell_min` 30, `avail_min_hours` 10. Slot encoding: weekday × 1440 + minute of day (Monday = 0), Toronto wall time. Kinds `meet_propose` and `meet_avail_ask` in `hub_notification_kinds`. Comments are mirrored in `build/data/wa276_team_avail.sql` for `DATA_MODEL.md`.

Applied 02/11/26 (UTC evening) by fetch from this repo at commit 3ca456b (md5 f465590b8d66d9d21c4d4024eb977ed5), recorded as schema_migrations `wa276_team_avail`: 28 ask rows (7 teams × 4 dates), 2 kinds, 4 settings, 10 functions.

Notes for later: re-running the migration puts a seeded ask date back if Steel has moved it by SQL (edit the row, do not re-run). `wa_avail_due` lists teams by code. Someone who saves "valid from 1 September" in August is re-asked by the September ask (the first such ask is 04/01/27); if that annoys people, count a save as answering when its effective-from is within two weeks before the ask.

## Edge function
notify v18 (`fn/notify/index.ts`): relay kinds `meet_propose` and `meet_avail_ask`. On the staff-JWT path the caller must pass `wa_avail_manager_of` for the team (else 403) and recipients come only from the roster (`to` in the body is ignored). Tests: `node --test test/w276notify.test.mjs` (on the wave271 rig). Deployed 02/11/26 as a one-line stub importing the source at commit 3ca456b (function version 29; the vault's fn-deploy token is still invalid; the Supabase connector deployed). To roll back: redeploy the stub pointing at 8970cca (v17).

## Hub
`build/parts276/` (`a_head` helpers and config, `b_grid` the drag grid, `c_pop` the pop-up, `d_agenda` the panel, `z_wire` wrappers and CSS) → `build/src/276_wave276.seg`, in the manifest after 272 and before 271. wave272's `parts272/c_setup.js` `otherOpen` gained `#w276pop`. Tests: `node --test test/w276pure.test.mjs`, `node test/w276drive.js` (22 checks; set `WA_CHROME` to Playwright's chrome.exe), `node test/w134drive.js` unchanged at 34.

## Build and deploy
Live before: `709e4b06fd06dd49c7ae710ab3ded153` (7,863,575 bytes). The baseline rebuilds it byte for byte only when `build/src/271_wave271.seg` is LF in the working copy (autocrlf gives it CRLF on this PC; live has LF there, and CRLF inside the older segments). Candidate `8d4e2c490f9c0f64f25c998bfa65dbe9` (7,911,293 bytes, 225 segments; `build/candidate.html` in this commit). Staged in `wa_stage276` by `build/deploy_stage.py` (10 parts, all 201, md5s match; the table is closed to anon and authenticated after the upload). Gate: `build/deploy_gate.py wa_stage276 709e4b06… __wa276`, run through the connector on Steel's yes; then host-sync. Result: TODO.

Branch `wave276-availability` also carries commit 70ec7e7 (social-connect: LinkedIn asks only for scopes the app holds), made by another session; it is not deployed by this wave.

## Verification
TODO: live smoke as Steel.
