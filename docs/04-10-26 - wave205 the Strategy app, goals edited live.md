# 04/10/26 - wave205: the Strategy app rebuilt; the organizational goals edited live

Live md5 `d775535b07ee37f98727a08a1926246c` (6,477,010 bytes): wave205 shipped as `4cad1a6ee3b10d74cb777a95ce709f43` on wave204's `3247cbcd` (stage `wa_stage_205d`, host-sync ok), then one fix-up deploy (stage `wa_stage_205e`, change_log release wave205b): presence carries the roster id and first name only (the Realtime channel is public to anyone with the page's key, so never an email), and on a phone each goal's presence, status and Saved share one row. Two deploys in all. Migrations `wa205_strategy` (schema and seed, staged in `wa_stage_205q` runs 10 and 11 and run with their md5 checked), `wa205_release`, `wa205b_guards`, `wa205c_helper_grants`. change_log release line `release / wave205 / hub_build`.

## What Steel asked (04/10/26)

A rebuilt, interactive Strategy app where the organizational goals can be edited live, Google-Doc style. His decisions: organizational goals, and departments own projects (department goals retired as a tier, retired never removed, a one-time move to a project, the three current org goals replaced by the five new ones); live editing, all four: click-to-edit with autosave, who is editing live, comments on goals and milestones with @mentions, version history with Restore; each goal's owners and admins edit, all staff read and comment, board viewers read only, enforced in the database; the cleanest page of the Hub, with a pinned Strategy Library; goal-sync checked before any goal row changed.

The content is the approved draft, the Claude Doc "29/09/26 - Welfare Avenue Organizational Goals FY27-FY31 (Draft)" (revision 367): `build/data/wa205_seed.py` holds it (the five goals, SMART, Why, Paths, the milestone tables split on "; " only, owners, the at-a-glance measures, the roadmap, the checkpoint and the FY29 gate, the strategy documents with their links) and writes both the migration's data (`wa205_strategy_data.sql`) and the tests' fixture (`wa205_seed.json`, read by `test/w205fixture.js`). Marked "Draft for board approval (19 Oct 2026)" until an admin marks the goals approved.

## The page (one page, `orggoals`, wave116f's, taken over)

- `#orggoals` Goals: the mission (green band), the draft badge (Mark approved by the board for admins), Why these goals, the goals at a glance, the five goal cards, the roadmap (four phases, the checkpoint Oct 2027, the FY29 gate Oct 2029, the gate rule, how we track it), the pinned Strategy Library, projects not linked to a goal yet, tiles to Goal alignment, Projects and Retired goals.
- A goal card: number, title, status, Saved; owners (roster chips, lead, focus; + Owner); progress (milestones done FY27 to FY29, this fiscal year's); SMART and Why; headline measure, baseline, FY29 and FY31 targets; paths; milestones by year (FY27, FY28, FY29, FY31 gated) with a status circle, the projects serving each, its comments; projects serving the goal; Comments, History, the due date. Fold remembered per person (localStorage `w205folded`).
- `#orggoals/goal/<id>[/comments[/<comment>]|/history]` opens a goal (the @mention links point here). `#orggoals/library` the Strategy Library (search, shelves Our plans, Consulting work, Sources; admins add, edit, pin, take out). `#orggoals/retired` Retired goals (the three earlier org goals and the 25 department goals by the goal each served; Make it a project for leaders and admins, once). `#goals` opens Retired goals.
- The rail (parts153): Goals, Projects, Goal alignment, Strategy Library. Department goals left the rail.
- Goal alignment (116f): projects to the five goals (the milestone a project serves on its node); the department goals column is gone. Projects (116e): a retired goal reads Not linked yet; the goal line opens the link sheet.
- Directors (board mode) read the goals from their menu's Board group (parts134, the 153 hide rule spares them); the board profile already decides `orggoals` all.
- Retired goals leave the older pages: `waLoadGoals` is wrapped so `GOALS_CACHE` holds no retired row.

## Live editing

- Autosave: every field is a textarea (or the status select); typing marks it dirty and saves 800 ms after the pause (at once on leaving the box, at once for a select) through `strategy_save(entity, id, field, value, old)`. `old` is the value the page started from; the database compares it per field and answers `{conflict, current, by, at}` instead of saving when someone else got there first. The page then shows "Ian just changed this" with their version under the box; my words stay in it until I choose Keep mine (saved over theirs, checked against it) or Use theirs. Saved, Saving, Editing or Not saved sits in each card's header.
- Realtime: one channel `wa205-strategy` while the page is open: postgres_changes on goals (department=eq.org), goal_milestones, goal_paths, goal_owners, goal_comments and projects (row security applies per reader, so only staff and board viewers receive rows), and presence (key `m<roster id>`; payload: the roster id, the first name, the goal and the field the person is in; never an email, because a public channel's presence can be read by anyone holding the publishable key). Another person's save lands in the field with a gold flash; if I am typing in that field it becomes the notice instead. Presence shows Here now at the top, faces on each goal, and "Ian editing" on the field. The channel closes when the page is left.
- Comments: threaded (`goal_comments.parent_id`), on the goal or a milestone (`milestone_id`), through `strategy_comment_add`; the composer is one of wave138's fields (`#w205drawer textarea[data-w205cmt]`), so @ opens the picker and the existing trigger files `hub_mentions`, which wave138's notify sends as a Slack DM (Steel's standing choice of 26/09/26; no new kind of message). Authors (and admins) edit their own.
- History: the trigger `wa205_hist()` writes `goal_history` for every change to an org goal's fields, milestones, paths, owners and its projects' links (who, when, field, old, new; ids for links); the drawer lists it by day with Restore (`strategy_restore`, itself a change in the history, `restored_from`).

## Permissions, in the database

- `wa205_can_edit(goal)`: staff and (admin or an active owner in `goal_owners`). Inside every writer: `strategy_save`, `strategy_add`, `strategy_remove`, `strategy_owner_set`, `strategy_restore`.
- `wa205_can_comment()`: staff, not viewers (the board view), not blocked. Inside `strategy_comment_add`, `strategy_link_project`.
- Admins only: `strategy_set_approval`, `strategy_doc_save`. Leaders and admins: `strategy_retired_to_project`.
- Restrictive policies: `goals_wa205_write` (update: an org goal only by its owners or admins, a retired goal only by admins), `goals_wa205_insert` (admins), `goals_wa205_remove` (admins), `goal_comments_wa205_insert` (who may comment), `goal_comments_wa205_update` and `goal_comments_wa205_remove` (the author or an admin). New tables read by staff and board viewers only; no write grants (the functions write). Nothing is executable by anon.
- Checked in a rolled-back transaction as Shima (owner of 1, 2, 5), Samson (member), Kellian (viewer), Tamara (board viewer), anon, Steel and Ian (admins), before and after the migration.

## Department goals and ClickUp

goal-sync (v3, platform version 10) only pulls from ClickUp on its daily cron (it never writes there on its own and never removes anything), skips archived goals and knows every ClickUp id the Hub holds; its status and comment actions write to ClickUp only when the older Department goals page calls them for a goal with a ClickUp id. Retiring sets `status = archived` (the old status kept in `status_before_retire`), so the pull leaves the rows alone and transcript-requests stops filing wins on them. The cron `wa-goals-sync` (job 6) is paused (`cron.alter_job(6, active := false)`, logged): with the tier retired it could only add department goals back from the Q4 FY2026 lists. Nothing in ClickUp was touched. `select cron.alter_job(6, active := true)` turns it back on.

The mapping (retired goal -> the org goal it served): 23, 27, 29, 40, 43, 44 -> 4 (flagship events, donor program, Rally Paper, the Ad Grant); 30, 31, 32 -> 5 (policies, structure); 33 to 39 -> 3 (recruiting, onboarding, development, reviews, team life); 66 -> 1 (the community kitchen pilot); 19 to 22 -> 2 (beneficiary feedback, the employment program, the referral brochure, new programs); 24, 25, 26, 28 no obvious fit (brand refresh, website, intro video, photographers). Earlier org goals: 41 superseded by goal 4, 45 by goal 2, 42 retired outright (follower growth becomes a marketing KPI). Seventeen projects re-linked (history rows by "wave205 migration"); Brand Refresh, Website Redesign, WA Intro Video and the General projects wait under Not linked yet.

## The board pack (board-pack v21)

`fn/board-pack/index.ts` (meta version 14, deployed as platform version 21, the deployed source checked identical to the repo's): the Organizational goals slide reads the five goals (`department = org`, not retired, numbered, in order) as "n. Title (FY29: target)"; a retired department goal reports the status it had when retired (`status_before_retire`). A read-only `preview` for the Oct 19 board meeting (id 4) listed the five goals and left `board_meetings.pack` unchanged. Deployed with the Supabase MCP because fn-deploy answers 401 (the Management API token has expired).

## Files

- `build/parts205/` (a_head, b_css, c_data, d_goals, e_drawers, f_library, h_tours, z_wire; assemble.py) -> `src/205_wave205.seg`, in MANIFEST after 202.
- Edited: parts153 (rail, hide rule), parts134 (directors' Board group), parts127 and parts131 (labels), 110 (TAB_LABEL), 116e (goal line), 116f (map, pickGoalFor), 122 (old tours removed; they live in h_tours), 138 (the comment field).
- `build/data/wa205_seed.py`, `wa205_seed.json`, `wa205_strategy.sql`, `wa205_strategy_data.sql`, `wa205_dryrun_checks.sql`, `wa205_release.sql`, `wa205b_guards.sql`, `wa205c_helper_grants.sql`; `build/sql_stage_run.py` (staging by run).
- Tests: `test/w205drive.js` (91), `test/w205fixture.js`, `test/w205shots.js`; `tour1.js` takes CAND and FIXTURE; `w163drive.js` follows the rail.
- Trainings: tour:orggoals (59) rewritten, tour:goals (60) off, tour:goalmap (62), tour:strategylib (new), Hub module 5 (43) rewritten.
