# Team availability (wave276) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every team member enters a typical week of meeting availability from a Home pop-up; each team's Agenda tab shows the overlay so a leader can propose a slot in one click.

**Architecture:** One SQL migration (two tables, predicates, RPCs, seeds), one edge function change (notify learns two relay kinds with a server-side manager check), and one Hub wave segment `276_wave276` built from `build/parts276/` that adds the pop-up to Home and a panel above the Agenda tab. All reads and writes go through RPCs so the client never computes "active grid" or "who manages".

**Tech Stack:** Postgres (Supabase, RLS, security-definer functions), Deno edge function `notify`, vanilla JS wave segment, PGlite for SQL tests, Playwright drive test, node:test for notify.

**Spec:** `docs/superpowers/specs/2026-11-02-team-availability-design.md`

## Global Constraints

- Minimum availability is 10 hours (`app_config.avail_min_hours = 10`); under it the note shows, Save stays enabled.
- The note text is fixed (copy from the spec, "Hour count and note"). No other wording.
- Typical week only: slot = `weekday * 1440 + minuteOfDay` (weekday 0 = Monday … 6 = Sunday, Toronto wall time), stored as `smallint[]`. Grid 08:00 to 22:00, 30-minute cells (`avail_grid_start = 480`, `avail_grid_end = 1320`, `avail_cell_min = 30`).
- Managers = admin, HR, `wa_leads_team(dept)` (every leader), or the person the team's seats report to in `org_positions`.
- Calendar clash = the same weekday slot busy in 3 or more of the next 4 weeks of `hub_events` where the person is in `attendee_emails` and `status = 'confirmed'`.
- Snooze = 3 days. Pop-up shows when no row for the team or newest `updated_at < latest ask_date` (ask_date ≤ today) and `snoozed_until` is null or past.
- Every new table, column and function gets a `COMMENT`; regenerate `docs/DATA_MODEL.md` with `build/gen_data_model.py`.
- Edit sources only (`build/parts276/`, `fn/notify/index.ts`, SQL in `build/`), never `build/candidate.html`. Wave IIFE guard `window.__wa276`. Non-ASCII escaped by `assemble.py`.
- Steel runs no SQL by hand: the migration is applied through the Supabase connector (large files by commit-pinned fetch, see `../claude/01-11-26 - Publishing workspace setup.md`).
- No em dashes in any user-facing copy.

## Review Focus

1. A member with zero rows and a team with no ask row yet: the pop-up must still show once (treated as due). Test in Task 1 (`wa_avail_due` with no ask) and Task 4.
2. A leader of two teams opening `#team/opsmtl/agenda` then `#team/hr/agenda` without reload: the panel must re-render for the second team, not keep the first. Test in Task 4.
3. A grid saved with `effective_from` in the future: `wa_avail_mine` returns the newest past row for the heat map and the pop-up does not fire. Test in Task 1.
4. `meet_propose` called by a non-manager with a valid staff JWT must get 403 and send nothing. Test in Task 2.
5. Phone width (375px): the pop-up becomes a bottom sheet and the grid scrolls horizontally with no page overflow. Test in Task 4 (phone run).

---

### Task 1: Database: tables, predicates, RPCs, seeds

**Files:**
- Create: `build/wa276_avail.sql`, `build/wa276_undo.sql`
- Create: `test/w276schema.sql` (slice of live schema: `team_members`, `hub_roles`, `org_positions`, `hub_events`, `app_config`, `hub_notification_kinds`, `dept_meta`; stub helpers `wa_email()`, `my_emails()`, `mybox_me()`, `is_hub_admin()`, `wa_is_hr()`, `is_wa_staff()`, `wa_leads_team()`, `wa_in_team()`, `wa180_my_teams()`, `auth.role()`; copy the bodies from `test/w271schema.sql:234-257` and `build/data/wa144_meet.sql:66-80`)
- Create: `test/w276sql.mjs`, `test/w276sql.sql` (same shape as `test/w271sql.mjs` / `w271sql.sql`)

**Interfaces:**
- Produces (all `security definer set search_path to ''`, revoked from public/anon, granted to authenticated unless noted):
  - `public.wa_avail_can_see(p_dept text) returns boolean`: `wa_in_team` or `wa_avail_can_manage`.
  - `public.wa_avail_can_manage(p_dept text) returns boolean`: `is_hub_admin() or wa_is_hr() or wa_leads_team(p_dept)` or reports-to join (`org_positions o join org_positions b on b.id = o.reports_to join team_members m on m.id = b.member_id join team_members s on s.id = o.member_id where lower(m.email) = any(my_emails()) and s.department = p_dept`).
  - `public.wa_avail_manager_of(p_email text, p_dept text) returns boolean`: same rule for an arbitrary email; granted to `service_role` only (notify calls it).
  - `public.wa_avail_due() returns table (department text, ask_date date, last_saved timestamptz)`: one row per team in `wa180_my_teams()` that is due (Global Constraints rule).
  - `public.wa_avail_mine(p_dept text) returns jsonb`: `{id, effective_from, slots, hours, updated_at, snoozed_until}` or `null`; active = newest `effective_from <= current_date`, else `null`.
  - `public.wa_avail_save(p_dept text, p_from date, p_slots smallint[]) returns jsonb`: upsert on `(email, department, effective_from)` using `wa_email()`; `hours = cardinality(p_slots) * avail_cell_min / 60.0`; clears `snoozed_until`; returns `{id, hours, min_hours}`. Raises if `p_dept` not in `wa180_my_teams()`.
  - `public.wa_avail_snooze(p_dept text) returns void`: sets `snoozed_until = now() + interval '3 days'` on the newest row, inserting an empty-slots row if none.
  - `public.wa_avail_team(p_dept text) returns jsonb`: raises unless `wa_avail_can_see`; `{can_manage, cell_min, start, end, min_hours, ask_date, members:[{email,name,slots,hours,updated_at}], missing:[{email,name}], clashes:[{email, slot}]}` where `members` are active `team_members` of the dept with a current grid, `missing` the rest with an email, `clashes` the slots busy in ≥3 of the next 4 weeks (fold `hub_events` into `weekday*1440 + minute` at `America/Toronto`, step `avail_cell_min`).
  - `public.wa_avail_ask_set(p_dept text, p_date date, p_note text) returns jsonb`: raises unless `wa_avail_can_manage`; inserts the ask; returns `{ask_date, missing:[emails]}`.
- Tables: `public.hub_team_avail (id bigserial pk, email text not null, department text not null, effective_from date not null default current_date, slots smallint[] not null default '{}', hours numeric not null default 0, snoozed_until timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(), unique (email, department, effective_from))`, RLS: own-row select/insert/update where `lower(email) = any(my_emails())`; team select where `wa_avail_can_see(department)`. `public.hub_team_avail_ask (id bigserial pk, department text not null, ask_date date not null, set_by text, note text, created_at timestamptz default now())`, select to authenticated where `is_wa_staff()`, insert only through the RPC.
- Seeds: `app_config` keys above (insert if absent). `hub_team_avail_ask` rows for every `dept_meta` code dated `2026-11-02` (the first ask), `2027-01-04`, `2027-05-03`, `2027-09-06`, `set_by = 'wave276'`. `hub_notification_kinds` rows `meet_propose` (title "A leader proposed a new meeting time for my team") and `meet_avail_ask` (title "My team needs my availability"), `grp = 'people'`, sorts 60 and 61, hub and slack true, email false.

- [ ] **Step 1: Write `test/w276sql.sql` assertions** (each a `do $$ … raise exception … $$` block, final `select 'w276sql: all assertions passed' as result`), with `set request.jwt.claims` switching the caller:
  - member `sam.lee@welfareavenue.com` on `opsmtl`, no rows, ask dated today: `wa_avail_due()` returns `opsmtl`.
  - same member, team with no ask row at all: `wa_avail_due()` still returns that team (Review Focus 1).
  - `wa_avail_save('opsmtl', current_date, array[1020,1050,1080,1110])` returns `hours = 2` and `min_hours = 10`; `wa_avail_due()` is now empty.
  - `wa_avail_save` with 20 slots then `wa_avail_mine('opsmtl')->>'hours' = '10'`.
  - save a row with `effective_from = current_date + 30`: `wa_avail_mine` still returns the current-dated row (Review Focus 3).
  - `wa_avail_snooze` then `wa_avail_due()` empty; after `update … set snoozed_until = now() - interval '1 day'` and a newer ask, due again.
  - leader `ruth.owen@welfareavenue.com` (`hub_roles.role='leader'`, `profile='opsmtl'`): `wa_avail_can_manage('opsmtl')` true, `('hr')` false; a second leader on the same team is also true.
  - reports-to manager (org_positions chain) with no `hub_roles.leader`: true.
  - `wa_avail_team('opsmtl')` as a member: `can_manage = false`, `members` has Sam, `missing` has the other active member, and one `clashes` entry after inserting 3 weekly `hub_events` for Sam at Tuesday 17:00 (`slot = 1*1440+1020`).
  - `wa_avail_team('hr')` as Sam raises.
  - `wa_avail_ask_set('opsmtl', current_date + 1, 'term')` as Ruth returns `missing` with the member who has no grid; as Sam raises.
  - `wa_avail_manager_of('ruth.owen@welfareavenue.com','opsmtl')` true as service_role.
  - seeds: 4 ask rows per dept_meta code, 4 app_config keys, 2 kinds.
- [ ] **Step 2: Write `test/w276sql.mjs`** loading `w276schema.sql`, the migration twice, then `w276sql.sql`, then `wa276_undo.sql` and the migration again (copy the structure of `w271sql.mjs`). Run: `node test/w276sql.mjs`. Expected: FAIL (migration file missing).
- [ ] **Step 3: Write `build/wa276_avail.sql`** per Interfaces, with `COMMENT` on every object and `drop policy if exists` before each policy; and `build/wa276_undo.sql` dropping everything it created (keep seeds idempotent with `on conflict do nothing`).
- [ ] **Step 4: Run `node test/w276sql.mjs`.** Expected: `w276sql: all assertions passed` printed twice and exit 0.
- [ ] **Step 5: Commit** `git add build/wa276_avail.sql build/wa276_undo.sql test/w276*` / `feat(wave276): team availability tables and RPCs`.

### Task 2: notify v18: `meet_propose` and `meet_avail_ask`

**Files:**
- Modify: `fn/notify/index.ts:167` (HUB_EVENTS), `:603-614` (relay if and maps), `:651-664` (auth)
- Create: `test/w276notify.test.mjs` (on `test/w271rig.mjs`, run with `node --test`)

**Interfaces:**
- Consumes: `wa_avail_manager_of(p_email, p_dept)` from Task 1 via `svc.rpc`.
- Produces: `POST notify` with staff JWT and body `{event:'meet_propose', dept, slot_label, who_can:number, who_cant:number}` or `{event:'meet_avail_ask', dept}`. Recipients are never taken from the body: `meet_propose` goes to every active `team_members` row of `dept` with an email except the caller; `meet_avail_ask` goes to active members with no `hub_team_avail` row whose `updated_at >= latest ask_date` for that dept. Text: propose `"<Caller name> is proposing <dept label> meetings move to <slot_label>. <who_can> can make it. Reply on Slack if that does not work."`, url `#team/<dept>/agenda`; ask `"<dept label> is planning meeting times. Add your typical week in the Hub."`, url `#mypage`. Titles from the kinds registry. Returns `{event, outcome, hub, sent:number}`.

- [ ] **Step 1: Write failing tests** in `test/w276notify.test.mjs`: (a) manager JWT, `meet_propose` for `opsmtl` → one Slack DM per other active member, `sent = 2`, caller excluded, text contains the slot label; (b) non-manager JWT → status 403, no DM (Review Focus 4); (c) `meet_avail_ask` → only the member without a current grid is messaged; (d) `x-wa-secret` path still works for `onboard_remind` (regression). Run: `node --test test/w276notify.test.mjs`. Expected: FAIL.
- [ ] **Step 2: Implement** in `fn/notify/index.ts`: add both kinds to `HUB_EVENTS` and the maps; new branch before the v15 relay `if` that resolves recipients server-side and then reuses the same `deliver`/`hubRelay` loop; in `Deno.serve`, when `callerEmail` is set and event is one of the two, `authed = (await svc.rpc('wa_avail_manager_of', { p_email: callerEmail, p_dept: String(body.dept||'') })).data === true`, returning `json({error:'forbidden'}, 403)` when false. Bump the header comment to v18.
- [ ] **Step 3: Run `node --test test/w276notify.test.mjs` and `node --test test/w271notify.test.mjs`.** Expected: all pass.
- [ ] **Step 4: Commit** `feat(notify): meet_propose and meet_avail_ask relay kinds (v18)`.

### Task 3: Hub wave276 client: grid, pop-up, agenda panel

**Files:**
- Create: `build/parts276/a_head.js` (IIFE open, `W276` state, config load, slot helpers), `b_grid.js` (weekday grid component), `c_pop.js` (Home pop-up), `d_agenda.js` (Agenda panel), `z_wire.js` (wrappers, CSS inject, IIFE close, `window.w276` test hook), `assemble.py` (copy of `parts272/assemble.py` writing `276_wave276.seg`)
- Modify: `build/parts272/c_setup.js:367-374` (`otherOpen` gains `#w276pop`), then re-run `build/parts272/assemble.py`
- Modify: `build/src/MANIFEST.txt` (insert `276_wave276` with a comment line after `272_wave272`, before `271_wave271`)

**Interfaces:**
- Consumes: RPCs from Task 1 via the global `db`; `USER.email`; `WA_TEAMS` (`001_wave116a.seg:28`); `dept_meta` labels via the existing team label helper or `WA_TEAMS`; notify via `db.functions.invoke('notify', { body })`.
- Produces:
  - `W276.slot(di, min) -> number`, `W276.unslot(n) -> {di, min}`, `W276.hours(slots, cellMin) -> number`.
  - `W276.grid(host: Element, opts: {start, end, cellMin, slots: number[], clashes: number[], readOnly?: boolean, onChange(slots:number[])}) -> {get(): number[], set(number[]): void, destroy(): void}`. Markup: `#…` free, cells are `<button class="w276c" data-di data-min aria-pressed>`; clashes get class `w276x` and `title="Usually in a meeting"`. Port the pointer logic of `build/o/index.html:347-371` (mouse drags a rectangle, touch and keyboard click; `S.unwire` pattern for window listeners).
  - `W276.openPop(dept: string, due: {ask_date, last_saved}) -> void` renders `#w276pop` (`role="dialog" aria-modal="true"`, bottom sheet under 700px) with: title "Your availability for <team> meetings", date input `#w276from` labelled "Valid from" with helper "Pick the date your week changes, for example the first day of term.", the grid, live `#w276hours` "N hours selected", `#w276note` (the fixed note, shown only when hours < min_hours), buttons `#w276save` "Save" and `#w276later` "Ask me later", Escape closes = later. Save → `wa_avail_save`, then close; later → `wa_avail_snooze`. Never opens when wave272-style `otherOpen()` (copied list plus `#w276pop`) is true. Opens at most once per page load, for the first due team by `wa_avail_due()` order.
  - `W276.paintAgenda(dept) -> Promise<void>`: inserts or re-renders `#w276panel` before `#w116agHost` with heading "When can we meet?", a read-only heat-map grid (cell opacity = available/members, hover/tap title lists names available and not), "Best slots" list (`#w276best`, top 3 contiguous windows ≥ 60 min by headcount then fewest clashes, each with a "Propose" button when `can_manage`), a status line "`k` of `n` entered" with names on tap when `can_manage`, a "My availability" button (opens `openPop(dept)` with `due` null), and when `can_manage` an "Ask the team" button (prompt-free: sets ask to today via `wa_avail_ask_set`, then `notify meet_avail_ask`). Propose → confirm dialog (slot, who can, who cannot) → `notify meet_propose`.
  - `window.w276 = { paintAgenda, openPop, best(members, cellMin, clashes) }` for tests, where `best` is the pure ranking function.

- [ ] **Step 1: Write `build/parts276/assemble.py`** and an empty `a_head.js`/`z_wire.js` pair that opens and closes the IIFE with the `__wa276` guard; add `276_wave276` to MANIFEST; run `python build/parts276/assemble.py && node build/assemble_all.js` (or `build/build.sh`). Expected: `build/candidate.html` contains `__wa276`.
- [ ] **Step 2: Write the pure helpers** (`slot`, `unslot`, `hours`, `best`) in `a_head.js` and a node check `test/w276pure.test.mjs` that `require`s the file text evaluated in a sandbox (`vm.runInNewContext` with a stub `window`) and asserts: `slot(1,1020) === 2460`; `unslot(2460)` is `{di:1,min:1020}`; `hours([0,30,60], 30) === 1.5`; `best` on 3 members where Tuesday 17:00 to 18:30 has 3 available and Wednesday 10:00 to 11:00 has 2 with no clashes returns Tuesday first, and a 30-minute-only window is excluded. Run: `node --test test/w276pure.test.mjs`. Expected: PASS after implementing.
- [ ] **Step 3: Implement `b_grid.js`, `c_pop.js`, `d_agenda.js`** per Interfaces; styles in `z_wire.js` injected once (`#w276css`), using the Hub's existing CSS variables for colour.
- [ ] **Step 4: Wire** in `z_wire.js`: wrap `startApp` to load config (`app_config` keys `avail_*`, same read pattern as `parts271/a_ready.js:186-188`), then call `wa_avail_due()` and `openPop` after 1500 ms when on `#mypage`; wrap `renderMyPage` the same way; on `hashchange` and after `startApp`, when the hash matches `^#team/([a-z]+)/agenda`, retry every 300 ms up to 10 times for `#w116agHost` then `paintAgenda(code)`; re-paint when the code changes (Review Focus 2).
- [ ] **Step 5: Patch `otherOpen`** in `parts272/c_setup.js` (add `document.getElementById('w276pop')`), re-run `parts272/assemble.py`, rebuild. Expected: `grep -c w276pop build/candidate.html` ≥ 2.
- [ ] **Step 6: Run `node build/check_remaps.py`** (or the build's remap check) and `node test/w134drive.js`. Expected: both pass as before.
- [ ] **Step 7: Commit** `feat(wave276): availability grid, Home pop-up and Agenda panel`.

### Task 4: Drive test (offline Playwright)

**Files:**
- Create: `test/w276drive.js`, `test/w276fx.js` (fixture: 3 `opsmtl` members, Ruth as leader, Sam as member; `hub_team_avail` rows for 2 of 3; stubbed RPC replies for `wa_avail_due`, `wa_avail_mine`, `wa_avail_save`, `wa_avail_snooze`, `wa_avail_team`, `wa_avail_ask_set`; `db.functions.invoke` recorded into `window.__REC`)

**Interfaces:** Consumes `window.w276`, ids from Task 3. Pattern: `test/w259drive.js` skeleton and `fresh(b, { who, hash, fixture, rpcs, init })` from `test/boot.js`.

- [ ] **Step 1: Write the drive** with these checks, each `ok(...)`:
  - member, `#mypage`, `wa_avail_due` returns opsmtl → `#w276pop` visible within 3 s; paint 8 cells → `#w276hours` says "4 hours selected" and `#w276note` is visible and contains "at least 10 hours"; paint 12 more → note hidden; click Save → `__REC` has `wa_avail_save` with 20 slots and pop-up gone.
  - member, due but `#w177pop` injected visible by `init` → pop-up does not open.
  - member, click "Ask me later" → `wa_avail_snooze` called, pop-up gone.
  - leader, `#team/opsmtl/agenda` → `#w276panel` precedes `#w116agHost`; `#w276best` has 3 items; status reads "2 of 3 entered"; click first Propose then confirm → `db.functions.invoke('notify', {event:'meet_propose', dept:'opsmtl', …})` recorded.
  - leader, then `location.hash = '#team/hr/agenda'` → panel heading shows the HR label and `wa_avail_team` was called with `hr` (Review Focus 2).
  - member on the agenda tab → no Propose and no "Ask the team" buttons.
  - phone (width 375): pop-up `#w276pop` bottom ≥ viewport height − 2 and `document.documentElement.scrollWidth <= 375` (Review Focus 5).
- [ ] **Step 2: Run `node test/w276drive.js`.** Expected: all PASS, `fail === 0`, no `pageerror`.
- [ ] **Step 3: Commit** `test(wave276): drive test`.

### Task 5: Release

**Files:**
- Create: `docs/02-11-26 - wave276 team availability.md` (what it does, data, RPCs, kinds, how to change the ask dates by SQL, undo).
- Modify: `docs/DATA_MODEL.md` (regenerated), `docs/ARCHITECTURE.md` segment list if it enumerates waves, `../claude/` memory note via the session memory, not the repo.

- [ ] **Step 1: Apply SQL** through the Supabase connector: commit, then run `build/wa276_avail.sql` by commit-pinned fetch inside `execute_sql` (the standing method). Expected: `select count(*) from hub_team_avail_ask` = 4 × number of `dept_meta` rows; security advisor shows no ERROR for the new objects.
- [ ] **Step 2: Deploy notify** `python3 build/fn.py deploy notify`. Expected: `get notify` shows v18 header.
- [ ] **Step 3: Regenerate DATA_MODEL** `python3 build/gen_data_model.py`; write the wave doc.
- [ ] **Step 4: Build and gate**: `build/build.sh`, `python3 build/deploy_stage.py`, `python3 build/deploy_gate.py` and run the printed SQL through the connector, then `host-sync`. Expected: the live Hub serves a file containing `__wa276`.
- [ ] **Step 5: Smoke on the live Hub** as Steel: Home shows the pop-up (the 02/11/26 ask makes everyone due), save a grid, open `#team/opsmtl/agenda`, see the panel. Record the result in the wave doc.
- [ ] **Step 6: Commit and push** (`build/repo_push.py`): `release(wave276): team availability`.
