# HR onboarding automation (wave271) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An accepted offer flows into the HR Center's Onboarding section, availability is marked on a Hub grid, and one HR button runs the setup, with a visible result per step.

**Architecture:** Three new tables hold one onboarding "flow" per accepted candidate, its grids and its step results. A public function (`onboard-link`) serves a no-login page at `/o/<token>` for Accept, Decline, the grids and the one-time password. A signed-in function (`onboard-run`) runs the steps for HR. The HR screens are a new wave segment wrapping the existing Onboarding page.

**Tech Stack:** Supabase Postgres and Deno edge functions (single `index.ts`, deployed by `build/fn.py`), vanilla JS page segments (`build/parts271`, joined by `build/build.sh`), Playwright drive tests in `test/`, Node 24 for offline function tests.

**Spec:** `../claude/01-11-26 - HR onboarding automation, design (wave271).md` (approved by Steel 01/11/26; read it first)

## Global Constraints

- Nothing reaches live without Steel's own yes in the acting session: each SQL apply, function deploy and publish. Stop and ask at every "Steel's yes" step.
- No real email, Slack message, text, calendar invite or Google call from any test (`docs/HUB_RELEASE_CHECKLIST.md`). Offline tests stub `fetch`.
- A first password is never stored, logged or returned anywhere except the one-time response to the new hire.
- A practice applicant (`hub_candidates.practice`) writes only to `hub_onboard_steps`, marked practice, and nothing to `team_members`, `onboardings`, Google, Slack, Calendar or email.
- Google account creation refuses for real candidates while `app_config mail_mode` is not `live`. Mail in test mode goes to `mail_test_recipients`.
- Never take functionality away: the roster dropdown, manual acceptance and "reply to this email" all stay.
- Times use `America/Toronto`. The call date is day one: it fills `onboardings.started_at`, `team_members.start_date` and `hub_candidates.start_date`.
- Hub words: no "AI", no em dashes. Every public page and message to a new hire exists in English and French. Works at 390 px. WA brand colours through existing tokens (`check_remaps.py` must pass).
- Each new table, column and function gets a `COMMENT`; each new table has RLS; the security advisor shows no ERROR after applying (release checklist).
- Edit sources, never the build. Refresh a function from live before changing it, because the repo may be behind (`python build/fn.py get <name>`).
- On this PC `python3` may hit the Store alias: run `export PATH="/c/Users/iolui/AppData/Local/Programs/Python/Python312:$PATH"` and call `python`; `build.sh` needs a `python3` that resolves, so add a shell function if it doesn't. `build/fn.py` needs `/tmp/anon.key` and `/tmp/wa.secret`, which Steel provides; if absent, stop and ask rather than reading the vault.

### Fixed values

| Name | Value |
|---|---|
| Flow status | `waiting`, `ready`, `running`, `started`, `backed_out` |
| Step keys, in order | `roster`, `google`, `plan`, `invites`, `manager`, `hub`, `slack`, `welcome` |
| Step status | `pending`, `running`, `waiting`, `done`, `skipped`, `failed`, `hr_task` |
| Dependencies | `roster` needs nothing; `plan`, `invites`, `manager`, `slack`, `google` need `roster`; `hub`, `welcome` need `google` |
| `app_config` keys and defaults | `onboard_grid_days` 14, `onboard_grid_start` 8, `onboard_grid_end` 21, `onboard_grid_cell_min` 30, `onboard_call_min` 60, `onboard_one_on_one_min` 30, `onboard_remind_hours` 48, `onboard_password_days` 7, `onboard_auto_google` off, `onboard_auto_slack` off, `onboard_slack_join_link`, `onboard_google_video` |
| Token | `<id>.<20-char signature>`, HMAC-SHA256 as in `candidate-confirm`, key `onboard-<purpose>:` + service key. Purposes: `offer` (id = candidate), `mgr` (id = flow), `pw` (id = flow; signs `<id>.<pw_nonce>`) |

## Review Focus

1. **Names that don't fit `first.last`:** "José O'Neil-Tremblay" should suggest `jose.oneil-tremblay@welfareavenue.com`; a single-word name suggests nothing, and HR must type one. (Task 5)
2. **Clock changes:** a grid or booking across a daylight-saving change (01/11/26, 14/03/27) must keep the wall-clock times people chose, with no slot shifted by an hour. (Tasks 2 and 4)
3. **Two applications from one person:** accepting one role creates one flow, and the card warns about the other open row instead of allowing a second account. (Task 1)
4. **Double answers:** a double click, a second tab, or Accept after Decline changes nothing and shows the first answer. (Task 2)
5. **Stale actions:** a call time in the past is refused at Start, and a password or grid link for a backed-out flow does nothing and says to contact HR. (Tasks 5, 7 and 10)

---

## Build 1: Accept to Start onboarding

### Task 1: Database foundation

**Files:**
- Create: `build/wa271a_onboard.sql`, `build/wa271a_undo.sql`, `test/w271sql.sql`

**Interfaces:**
- Produces:
  - `hub_onboard_flows(id bigserial pk, candidate_id bigint unique references hub_candidates, practice boolean, status text, manager_member_id bigint, wa_email text, call_at timestamptz, one_on_one_at timestamptz, group_session text, call_event_id text, one_on_one_event_id text, onboarding_id bigint, slack_channel_id text, slack_user_id text, welcome_subject text, welcome_text text, pw_nonce text, pw_expires_at timestamptz, pw_used_at timestamptz, reminded_hire_at timestamptz, reminded_manager_at timestamptz, started_by text, started_at timestamptz, created_at, updated_at)`
  - `hub_onboard_grids(flow_id, who text check in ('hire','manager'), slots timestamptz[], updated_at, primary key (flow_id, who))`
  - `hub_onboard_steps(flow_id, step, status, detail text, practice boolean, at timestamptz, by text, primary key (flow_id, step))`
  - `hub_candidates.offer_respond_by date`, `hub_candidates.offer_start date`
  - `wa271_ready_list() returns jsonb` (HR or admin only): flows not `started` or `backed_out`, with name, role, personal email, offer dates, `late`, grid statuses, default manager, `other_open_rows`
  - `wa271_default_manager(p_candidate bigint) returns jsonb` `{member_id, name, how}`, where `how` is `reports_to`, `team_lead` or `none`
  - `onboarding_assign(p_member_id bigint, p_by text, p_start date default current_date) returns bigint`
  - `wa271_move_start(p_onboarding bigint, p_new date) returns void`

- [ ] **Step 1: Write `test/w271sql.sql`**, a `begin; ... rollback;` script that loads the migration and raises an exception on any failed assertion:
  - `update hub_candidates set accepted_on = ...` on a test row creates exactly one `waiting` flow; a second update creates none.
  - A `practice` candidate's flow has `practice = true`.
  - Two candidate rows with one email: `wa271_ready_list` shows `other_open_rows = 1` on the accepted one, and only one flow exists.
  - `onboarding_assign(m, 'x')` still starts today; `onboarding_assign(m, 'x', date '2026-12-07')` gives `started_at = 2026-12-07`, and a WEEK 1 step due `2026-12-14`.
  - `wa271_move_start` moves `started_at`, moves due dates only on steps not done, and updates `team_members.start_date` and `hub_candidates.start_date`.
  - `hr_setup_template` phase "The onboarding call" has `due_day = 0`.
  - `wa271_default_manager`: returns `reports_to` when an org position matches, `team_lead` for exactly one leader in the department, `none` for two leaders.
  - With a simulated non-HR JWT, reading the three tables returns nothing and `wa271_ready_list` raises.
- [ ] **Step 2: Write the migration:** the tables and comments; RLS with read for `wa_is_hr() or is_hub_admin()` and no direct writes; trigger `wa271_cand_accepted` on `hub_candidates` (accepted_on goes from null to a date: insert flow with `on conflict do nothing`); the `app_config` defaults; `due_day` change. Replace `onboarding_assign` by dropping the old signature and re-applying its exact grants and body with `v_start := p_start`. The default manager maps `hub_candidates.position_id` to `hub_positions(title, dept)`, then to the matching `org_positions.reports_to`; check the real `dept` values first, because they may need mapping to `team_members.department`.
- [ ] **Step 3: Write the undo:** drops the new objects, restores the 2-argument `onboarding_assign` and `due_day = 3`. It must leave `hub_candidates.accepted_on` data untouched.
- [ ] **Step 4: Steel's yes, then run the rolled-back test on live** through `execute_sql`. Expected: finishes with no exception, and `select to_regclass('public.hub_onboard_flows')` afterwards is null.
- [ ] **Step 5: Commit**

```bash
git checkout -b wave271-onboarding
git add build/wa271a_onboard.sql build/wa271a_undo.sql test/w271sql.sql
git commit -m "wave271a: onboarding flow tables, accept trigger, dated onboarding_assign"
```

### Task 2: `onboard-link` function, with the offline test rig

**Files:**
- Create: `fn/onboard-link/index.ts`, `fn/onboard-link/meta.json` (`verify_jwt: false`), `test/w271rig.mjs`, `test/w271link.test.mjs`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces:
  - `test/w271rig.mjs`: `loadFn(name, {secrets, config, tables}) -> {call(request) -> Response, db, fetchLog}`. It uses `module.registerHooks` to resolve `jsr:@supabase/supabase-js@2` to an in-memory stub, sets `globalThis.Deno` (`env.get`, `serve` capturing the handler), and replaces `fetch` with a recorder that fails on any unregistered URL.
  - `GET ?t=<token>` returns `{ok, kind:'offer'|'manager'|'password', first, role, lang, answered, closed, late, grid:{start, end, cellMin, days, slots}, slotsSaved}`
  - `POST {t, a:'accept'|'decline'|'grid'|'password', slots?}`
  - `wa271Token(purpose, id, extra?)` is exported as a pattern for `onboard-run` and `recruit-actions` to copy, since functions are single files

- [ ] **Step 1: Write failing tests in `test/w271link.test.mjs`** (`node:test`), asserting:
  - A GET saves nothing (scanner safety), and a bad signature gives 404 `bad_link`.
  - A `mgr` token can't be used as an `offer` token, and neither passes `candidate-confirm`'s key.
  - Accept sets `accepted_on` to the Toronto date, and a second Accept or Decline returns `repeated: true` with the first answer.
  - Decline sets status `declined` with `close_reason = 'Declined by link'`, logs to `change_log` and notifies the owner through `notify`.
  - A closed card gives `{closed: true}` and saves nothing; Accept after `offer_respond_by` works and returns `late: true`.
  - Grid POST rejects slots outside the window, off the cell boundary or over 2000 entries; a valid POST replaces the set and can be repeated until both meetings are booked.
  - A grid token on a `backed_out` flow returns `{closed: true}`.
  - Grid window on 01/11/26 Toronto, 21:00 is `2026-11-02T02:00:00Z`; on 31/10/26, 21:00 is `2026-11-01T01:00:00Z`.
- [ ] **Step 2: Run:** `node --test test/w271link.test.mjs`. Expected: FAIL, because the function doesn't exist.
- [ ] **Step 3: Implement `fn/onboard-link/index.ts`,** following `candidate-confirm`'s structure, with CORS for `https://hub.welfareavenue.com` only and `Cache-Control: no-store`. Slots are UTC instants generated from Toronto wall-clock times. Leave the `password` action returning `{error:'not_yet'}` until Task 10.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 3: Offer email buttons

**Files:**
- Modify: `fn/recruit-actions/index.ts` (after `python build/fn.py get recruit-actions`)
- Create: `test/w271offer.test.mjs`

**Interfaces:**
- Consumes: the `offer` token format; `hub_candidates.offer_respond_by`, `offer_start`.
- Produces: `offerSend` stores both dates, and the email carries `https://hub.welfareavenue.com/o/<token>` buttons.

- [ ] **Step 1: Write failing test** with the rig: `offer_send` in test mail mode stores the dates; HTML and text contain an Accept link and a Decline link whose tokens verify; the "just reply to this email" line stays; French offers get "Accepter" and "Refuser"; `practice` still goes to their own address, as today; the PDF is unchanged.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** in `offerEmailHtml` and the text version, in the same inline-table style.
- [ ] **Step 4: Run.** Expected: PASS. Also run `node --test test/w271link.test.mjs`.
- [ ] **Step 5: Commit.**

### Task 4: The `/o/` page

**Files:**
- Create: `build/o/index.html`, `test/w271page.js`
- Modify: `build/site/_redirects` (`/o/*  /o/index.html  200`), `build/site/_headers` (a `/o/*` block copied from `/c/*`), `fn/host-sync/index.ts` (add `o/index.html` to the extras at line 132)

**Interfaces:**
- Consumes: Task 2's GET and POST.

- [ ] **Step 1: Write failing `test/w271page.js`** (Playwright, function stubbed through `page.route`, viewports 1366 and 390):
  - Opening makes one GET and no POST.
  - Accept POSTs once under a double click, then shows the grid.
  - Drag selects cells on desktop, tap toggles on touch at 390 px, and Save posts exactly those instants.
  - With the clock set to 28/10/26, the days either side of the change (31/10/26 and 02/11/26) both read 8 am to 9 pm, and an 8 am cell posts `12:00Z` on the first and `13:00Z` on the second.
  - `?l=fr` shows French; `closed` shows the "contact HR" message; a saved grid reloads with its cells marked.
  - Page has no horizontal scroll at 390 px.
- [ ] **Step 2: Run:** `cd test && npm i && node w271page.js`. Expected: FAIL.
- [ ] **Step 3: Implement,** copying the head, tokens and fonts from `build/i/index.html`. Add `meta robots noindex` and `referrer no-referrer`. Leave a `password` view stubbed until Task 10.
- [ ] **Step 4: Run.** Expected: PASS, and screenshots checked by eye.
- [ ] **Step 5: Commit.**

### Task 5: `onboard-run`: preview, Start and the runner

**Files:**
- Create: `fn/onboard-run/index.ts`, `fn/onboard-run/meta.json` (`verify_jwt: true`), `test/w271run.test.mjs`

**Interfaces:**
- Consumes: Task 1 objects, `notify`, Calendar delegation as in `fn/hr-notify/index.ts`.
- Produces, as POST actions for HR or admins (`wa_is_hr` or `is_wa_admin` on the caller's JWT):
  - `preview {flow_id}` -> `{address, address_taken, needs_address, manager, grids, hub_events, steps, welcome:{subject,text}, warnings[]}`
  - `start {flow_id, wa_email, manager_member_id, call_at, one_on_one_at?, group_session?, skip[], welcome?}` -> `{steps}`
  - `retry {flow_id, step}` -> `{steps}`
  - `google_manual {flow_id, wa_email}` -> `{steps}`
  - `send_grid_link {candidate_id}` -> `{ok}` for offers already out, which sets `accepted_on` if HR confirms it
  - `suggestAddress(name) -> string | null`, and `nextSteps(steps) -> string[]`, a pure function following the dependency table

- [ ] **Step 1: Write failing tests,** with Google and Slack stubbed in the rig:
  - **Names:** `José O'Neil-Tremblay` -> `jose.oneil-tremblay`; `Madonna` -> null with `needs_address: true`; `Marie-Ève  Côté` -> `marie-eve.cote`.
  - **Auth:** a non-HR caller gets 403.
  - **Double press:** two `start` calls in parallel run the steps once, using a conditional update from `ready` or `waiting` to `running`.
  - **Refusals:** `call_at` in the past, no manager or a taken address with step `google` on: refused, with nothing written.
  - **Dependencies:** `roster` failed means all others `waiting`; `google` failed means `hub` and `welcome` `waiting` while `plan`, `invites`, `manager` and `slack` run; invites go to the personal address, then patch in the WA address once `google` is done.
  - **Retries:** `retry` reruns only that step and what was waiting on it; a `done` step is refused.
  - **Roster:** creates `team_members` with `start_date = call date` and `start_source = 'manual'`, links an existing profile by `member_id` or email instead of duplicating, sets candidate `hired`, `member_id` and `start_date`.
  - **Plan:** calls `onboarding_assign` with `p_start`, and ticks matching `hr_setup_steps` as each step finishes.
  - **Invites:** Calendar insert uses a stable client-supplied event id and `conferenceDataVersion=1`; a 409 on retry patches instead of duplicating.
  - **Build 1 setting:** with `onboard_auto_google` off, `google`, `hub` and `welcome` are `hr_task`; with `onboard_auto_slack` off, `slack` is `hr_task`. `google_manual` records the address and finishes the waiting steps.
  - **Skip:** any step but `roster` can be skipped; `skip:['roster']` is refused.
  - **Practice:** every step ends `done` with `practice = true`, the fetch recorder is empty, and `team_members` and `onboardings` have no new rows.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with the steps as a table of `{key, needs, run(flow)}` run in order, each writing its row, so later tasks add a `run` without changing the runner. Write each step's human-readable failure reason to `detail`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 6: Notifications and reminders

**Files:**
- Modify: `fn/notify/index.ts` (after `fn.py get notify`), `fn/onboard-run/index.ts`
- Create: `build/wa271b_remind.sql` (with undo in `build/wa271a_undo.sql`), `test/w271notify.test.mjs`

**Interfaces:**
- Produces: relay events `onboard_date` (the manager is told the date and time), `onboard_grid` (the manager's grid link), `onboard_remind` (a grid unanswered), added to `HUB_EVENTS` and the relay branch at `fn/notify/index.ts:578`, with switches in the notification centre's kind registry. `wa271_remind()` runs hourly on cron, calling `onboard-run` action `remind`.

- [ ] **Step 1: Write failing tests:** step `manager` sends `onboard_date` with date, time and the new hire's name, and the url `#hrcentre/onboarding`; a person's switch is honoured; `remind` after `onboard_remind_hours` tells HR (`hr_notify_emails`) about the hire's grid and the manager about theirs, once each (`reminded_*_at`); nothing is ever sent to the new hire; the manager's `onboard_grid` link goes when a default manager is unambiguous or HR confirms one, and is sent once.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Find the kind registry the notification centre reads (`grep -rn "timeoff_request" build/`) and add the three kinds in the same way.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 7: Changes after Start

**Files:**
- Modify: `fn/onboard-run/index.ts`, `test/w271run.test.mjs`

**Interfaces:**
- Produces: `book_one_on_one {flow_id, at}`, `change_time {flow_id, which:'call'|'one_on_one', at}`, `change_manager {flow_id, member_id}`, `backed_out {flow_id, reason}` -> `{remove:[...]}`

- [ ] **Step 1: Write failing tests:**
  - `book_one_on_one` works after Start and sends the invite then.
  - `change_time` patches the same event with `sendUpdates=all` and re-notifies the manager; on `call` it runs `wa271_move_start`, and refuses a past time.
  - `change_manager` moves the 1-on-1 to the new attendee and notifies both.
  - `backed_out` cancels both events, closes the onboarding, sets the flow `backed_out`, and returns the created items to remove (Google account, Slack channel, Hub access) without deleting anything.
  - After `backed_out`, the grid and password links return `{closed: true}`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 8: HR Center screens

**Files:**
- Create: `build/parts271/assemble.py`, `build/parts271/a_ready.js`, `build/parts271/b_pick.js`, `build/parts271/c_card.js`, `build/src/271_wave271.seg` (generated), `test/w271drive.js`, `test/w271fx.js`
- Modify: `build/src/MANIFEST.txt` (`271_wave271` after `262_wave262`, with a note line), the page's lead card rendering of `wa166_person_card` (locate with `grep -rln "lead_steps" build/`), `wa166_person_card` in a new `build/wa271c_card.sql` returning `starts_on` when `started_at` is in the future

**Interfaces:**
- Consumes: `wa271_ready_list`, `onboard-run` actions, `hub_events`.

- [ ] **Step 1: Write failing `test/w271drive.js`** (`test/boot.js`, identities admin, member on the HR profile, plain, board, plus 390 px):
  - Admin and HR see **Ready to onboard** above the existing Onboarding section, wrapping `wa46Render` per `docs/ARCHITECTURE.md` section 5; plain and board don't.
  - The existing assign dropdown still works.
  - A card shows role, grid status, a late flag, the other-application warning and **Send the availability link**.
  - The picker overlays the hire's grid with the manager's for the 1-on-1, greys `hub_events` where the person is an attendee, and accepts a typed time.
  - Start stays disabled until a call time and a valid address exist, and works without a 1-on-1.
  - The preview shows address, manager and which rule chose them, both times, editable email, group session field, step on/off switches (`roster` locked), and a warning when the job description link is missing.
  - After Start, the card shows each step's result and reason with Retry, plus "I created it, continue" on `google`.
  - Change time, Change manager, Book the 1-on-1 and They backed out appear on a started card.
  - The lead's card says "Starts on <date>" before the date.
  - No console errors, and no horizontal scroll at 390 px.
- [ ] **Step 2: Run:** `cd build && bash build.sh candidate.html && cd ../test && CAND=build/candidate.html node w271drive.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Copy `build/parts262/assemble.py`; use `esc()` on all data and an `.o271` class prefix.
- [ ] **Step 4: Run** the drive test and `test/w215drive.js` and `test/w211drive.js`, because they touch HR flows. Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 9: Release Build 1

**Files:**
- Create: `docs/2026-11-01 - wave271.md`
- Modify: `docs/ARCHITECTURE.md`, the wave262 What changed list, the HR walkthrough or training that covers onboarding (`build/parts215/b_walks.js`), and `hr_setup_template` descriptions where they now say something different

- [ ] **Step 1: Go through `docs/HUB_RELEASE_CHECKLIST.md`** and tick every item, including roles, training and the advisor.
- [ ] **Step 2: Check the base:** run `python build/rebase_live.py` per its usage, and confirm wave266e and wave269 page parts aren't accidentally included or lost. Compare the candidate against live md5 `aec989a28cf7116f419a49396e3ac93e`, or whatever live reads now. Steel must have closed the S2 lane, or tell him it's still open.
- [ ] **Step 3: Steel's yes,** then apply `wa271a`, `wa271b`, `wa271c` via `build/mig_record.py` and `build/sql_stage.py`. Check: `select count(*) from hub_onboard_flows` returns 0.
- [ ] **Step 4: Steel's yes,** then deploy `onboard-link` (`--verify-jwt false`), `onboard-run`, `recruit-actions`, `notify`, `host-sync`; publish the page through `deploy_stage.py`, `deploy_gate.py` and host-sync.
- [ ] **Step 5: Verify live with a practice applicant,** at desktop and 390 px, English and French: Accept, grid, Start. Confirm no roster row, no account, no invite and no email to anyone else. Confirm `https://hub.welfareavenue.com/o/x` returns the page with `X-Frame-Options: DENY`.
- [ ] **Step 6: Commit** with the live md5 in the message. Report to Steel, then stop until he says to continue with Build 2.

## Build 2: Google account, password, welcome email, Hub access

**Needs first:** Steel confirms `admin.directory.user` through `directory-sync`'s `probe` action and that a licence is free.

### Task 10: Google account and the one-time password

**Files:**
- Modify: `fn/onboard-run/index.ts`, `fn/onboard-link/index.ts`, `build/o/index.html`, `test/w271run.test.mjs`, `test/w271link.test.mjs`, `test/w271page.js`

**Interfaces:**
- Produces: `onboard-run` step `google`, action `new_password_link {flow_id}` -> `{ok}`, `onboard-link` action `password` -> `{ok, email, password}`, returned once

- [ ] **Step 1: Write failing tests:**
  - **Create:** `users.insert` to root org unit `/` with a random unseen password and `changePasswordAtNextLogin: true`, acting as `steel.macdonald@welfareavenue.com`; then a read-back must succeed before `done`.
  - **Existing address:** a 409 stops and asks HR; the account is not reused.
  - **Refusals:** refuses when `mail_mode` isn't `live`; refuses for practice, which simulates instead. Google's own reason, such as no licence, lands in `detail`.
  - **Password link:** a GET never touches Google. A POST claims `pw_used_at` with a conditional update first, then calls `users.update`; a generated password is 16+ characters; two parallel POSTs give one success and one `used`; if Google fails, the claim is released and the page says to try again. An expired link and a backed-out flow are refused.
  - **Reissue:** `new_password_link` changes the nonce, so the old token fails.
  - **No trace:** after a full run, a JSON dump of every stubbed table and the rig's console capture doesn't contain the password. `change_log` gets the event with no value.
  - **Page:** **Show my password** shows it once, with a copy button and the Google sign-in link, and reloading doesn't show it again.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Generate with `crypto.getRandomValues`; never put it in a variable that reaches a log line.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 11: Welcome email and Hub access

**Files:**
- Modify: `fn/onboard-run/index.ts`, `fn/hub-invite/index.ts` (after `fn.py get hub-invite`), `test/w271run.test.mjs`
- Create: `test/w271invite.test.mjs`

**Interfaces:**
- Produces: `hub-invite` accepts `x-wa-secret` for action `invite` only, with `changed_by` passed in and `hub_role` forced to `member`. `renderWelcome(flow, lang) -> {subject, text, html}` in `onboard-run`.

- [ ] **Step 1: Write failing tests:**
  - **hub-invite:** a secret call invites at member level; a secret call for any other action is refused; existing JWT rules are unchanged.
  - **Step `hub`:** a `notify` result of "no Slack account" still counts as `done`.
  - **Welcome content (EN and FR):** congratulations, role, the call as first day, 1-on-1 time or "will follow", WA address, the one-time password button when `onboard_auto_google` is on or the "HR will share it one to one" line when it isn't, video, Slack link, the flow's `canva_link` (the line is left out, with a warning, if empty), DocuSign note, job description from `hub_positions.jd_url`, signature.
  - **Optional lines:** the group session line and job description line are left out when empty.
  - **Sending:** from hub@ via `gmail.send` to the personal address, reply-to HR; HR's edits are used; `mail_mode` test redirects to `mail_test_recipients`; a password never appears in the body.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Reuse `hub-invite`'s MIME builder and token pattern, and base the wording on the SOP's email in the spec's source doc.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 12: Release Build 2 and one real test hire

- [ ] **Step 1: Run all `test/w271*`,** and update the release doc and training.
- [ ] **Step 2: Steel's yes,** then deploy `onboard-run`, `onboard-link`, `hub-invite`; publish `/o/`; set `onboard_slack_join_link` to `https://welfareavenue.slack.com` and `onboard_google_video` from the value Steel gives.
- [ ] **Step 3: Steel's yes,** then set `onboard_auto_google` to `on`.
- [ ] **Step 4: One real test hire Steel approves.** Verify: Google forces a change at first sign-in; a second press of the password link is refused; a search of `quo_messages`, `change_log` and `hub_onboard_steps` finds no password; the new account appears on the roster with no "Place on the roster" entry after the next `directory-sync`, and its start date stays the call date. Steel then removes the test account.
- [ ] **Step 5: Commit** and report. Stop until Steel says to continue.

## Build 3: Slack

### Task 13: Slack channel and the hourly check

**Files:**
- Modify: `fn/onboard-run/index.ts`, `test/w271run.test.mjs`
- Create: `build/wa271d_slack_cron.sql`

**Interfaces:**
- Produces: step `slack`, action `slack_check` (trigger secret only), run hourly by cron `wa-onboard-slack`

- [ ] **Step 1: Write failing tests:**
  - Creates `onboarding-<first>` (lowercase, no accents), with `-2` on `name_taken`, saves the id, invites manager and HR, and posts the SOP's welcome message with the Week 1 date (call + 7 days). A retry reuses the saved id.
  - `missing_scope` makes the step `hr_task` and names the scope.
  - `slack_check` finds the person by `users.lookupByEmail`, invites them once and records `slack_user_id`; it stops looking after 30 days and for `backed_out` flows; practice flows aren't checked.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Use public channels unless Steel says otherwise.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Steel's yes,** then check the bot's scopes, deploy, apply the cron, set `onboard_auto_slack` to `on`, and verify on the next real hire or a test Steel approves.
- [ ] **Step 6: Commit,** update the release doc and report.
