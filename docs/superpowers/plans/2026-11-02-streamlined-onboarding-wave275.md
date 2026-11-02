# One streamlined onboarding (wave275) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the offer onward, one flow: the manager proposes times from their availability, the hire accepts (confirming weekly hours) and says yes or no, the Hub creates the Google account and Hub access at Accept and sends one welcome email with times, login and the setup rundown when the times are booked.

**Architecture:** Extends wave271 (live). The flow row is created when the offer goes out (new status `offered`), carries the manager's proposal and the hire's answer, and the step runner gains "at Accept" steps (roster, google, hub) and "at booking" steps (plan, invites, welcome). Managers' availability lives on `team_members` as blocks. The `/o/` page gains the hours confirmation, the yes-or-no view, the closing view and the setup rundown; the `mgr` link becomes the manager's proposal page. The card opens to a hire's manager through a checked function.

**Tech Stack:** as wave271: Supabase Postgres, Deno edge functions (single `index.ts`, deployed as one-line stubs importing the source from GitHub by commit), vanilla JS page segments (`build/parts275`), Node 24 offline rig (`test/w271rig.mjs`), Playwright drive tests.

**Spec:** `../claude/02-11-26 - One streamlined onboarding, design (wave275).md` (approved by Steel 02/11/26). Its predecessor, kept as the fallback path: `../claude/01-11-26 - HR onboarding automation, design (wave271).md`.

## Global Constraints

- Everything in wave271's Global Constraints still holds (Steel's yes for every live step; no real email, Slack, Calendar or Google call from any test; practice applicants simulate; test mail mode; never take functionality away; Toronto times through Intl; comments, RLS and an empty search_path on every new object; Hub words: no "AI", no em dashes; English and French on every public page and hire-facing message; 390 px).
- **The first password:** read from the vault secret `ONBOARD_FIRST_PASSWORD` at the moment of creating an account or sending the welcome email, and nowhere else. Never in the database, change_log, step details, the card, the preview, test files or any log line. The template placeholder is `[first password]`. Google's rule: at least 8 characters; `set_first_password` refuses shorter.
- **Scanner safety:** no link saves anything on open; Accept, Yes, No and Save are POSTs behind a button.
- **People already in the wave271 flow keep their path**: a flow without `offer_hours` shows Accept without the hours line; the at-Accept steps never run for a candidate whose `accepted_on` was set before this release (`hub_onboard_flows.created_at` before the release timestamp in `app_config onboard_v2_since`).
- **The manager** acts signed in for card actions; the `mgr` link only proposes times and edits availability. A manager who is a plain member sees only their own hires' cards.
- Release checklist: `docs/HUB_RELEASE_CHECKLIST.md`. Functions deploy as stubs pinned to a pushed commit (see `docs/02-11-26 - wave271 HR onboarding.md`); the page publishes through the base64 stage and the gated swap.

### Fixed values

| Name | Value |
|---|---|
| Flow status (extended) | `offered`, `waiting`, `ready`, `running`, `started`, `backed_out` |
| Step keys, in order | `roster`, `google`, `hub`, `plan`, `invites`, `manager`, `slack`, `welcome` |
| Step timing | at Accept: `roster`, `google`, `hub`; at booking: `plan`, `invites`, `manager`, `welcome`; `slack` stays an HR task |
| Dependencies | `google` and `plan` need `roster`; `hub` needs `google`; `invites`, `manager`, `welcome` need `plan`; `welcome` also waits on nothing else (login paragraph varies) |
| Hours a week | `4`, `6`, `8`; default `4`; stored as `hub_candidates.offer_hours int` |
| Proposal lead time | at least 48 hours ahead when proposed; at least 24 hours ahead when the hire presses Yes |
| Meeting lengths | call `onboard_call_min` (60), 1-on-1 `onboard_one_on_one_min` (30) |
| Manager reminder | 48 hours with no proposal: `onboard_remind_hours` |
| Availability | `team_members.availability jsonb`: `{ "weekly": { "mon": [["09:00","17:00"]], ... }, "except": [{"date":"2026-11-11","free":[]}], "tz":"America/Toronto" }`, plus `availability_at timestamptz`; "recent" means within 30 days |
| Default availability | Monday to Friday 09:00 to 17:00 |
| New `app_config` keys | `onboard_v2_since` (set at release), `onboard_auto_hub` on, `onboard_propose_lead_hours` 48, `onboard_yes_lead_hours` 24 |
| Tokens | as wave271 (`offer` id = candidate, `mgr` id = flow); the setup page uses the `offer` token with `?setup` |
| notify kinds added | `onboard_propose` (to the manager: propose times), `onboard_answer` (to the manager and HR: the hire said yes or no), `onboard_ready` (to the manager: setup done, rundown ticks) |

## Review Focus

1. **A hire presses Yes after the manager's calendar changed:** Yes must re-check both times and fall to the grid with a plain message rather than book a clash or a past time. (Task 3)
2. **Two hires, one manager, same proposed slot:** the second proposal for a slot already booked for another hire must be refused when proposed, not discovered at Yes. (Task 2)
3. **Accept with the password unset or Google refusing:** nothing may crash the acceptance; the hire still gets the times flow, the card shows the HR task with the reason. (Task 3)
4. **A manager who is not a leader opens the card:** sees only their own hires, can book and change times, cannot see other cards. (Task 6)
5. **The welcome email sent while HR is still editing the template:** the sent text is the saved template with brackets filled at send time; the password never appears in the saved copy. (Task 4)

---

## Task 1: Database (wa275a)

**Files:**
- Create: `build/wa275a_streamlined.sql`, `build/wa275a_undo.sql`, `test/w275sql.sql`; extend `test/w271schema.sql` and `test/w271sql.mjs` to load and prove them (PGlite).

**Interfaces:**
- Produces:
  - `hub_candidates.offer_hours int`, `hub_candidates.onboard_manager_id bigint references team_members`, `hub_candidates.hours_confirmed_at timestamptz`
  - `hub_onboard_flows`: status check extended with `offered`; columns `proposed_call_at timestamptz`, `proposed_one_on_one_at timestamptz`, `proposed_by text`, `proposed_at timestamptz`, `hire_answer text check in ('yes','no')`, `hire_answered_at timestamptz`, `setup_ticks jsonb default '{}'`, `welcome_sent_at timestamptz`, `accounts_at timestamptz`, `ask_availability boolean not null default true` (off = already communicated)
  - `team_members.availability jsonb`, `team_members.availability_at timestamptz`
  - trigger `wa275_offer_sent` on `hub_candidates` (offer_sent_at from null to a value): inserts a flow in status `offered` with `manager_member_id = onboard_manager_id`, `on conflict do nothing`; `wa271_cand_accepted` now moves `offered` to `waiting` instead of inserting (and still inserts when no flow exists)
  - `wa275_manager_of(p_flow bigint) returns boolean`: the signed-in person's roster email equals the flow's manager's email (or HR or admin)
  - `wa275_my_cards() returns jsonb`: the flows whose manager is the signed-in person, same shape as `wa271_ready_list` rows plus proposal fields
  - `wa271_ready_list` rows gain `offer_hours`, `proposed_call_at`, `proposed_one_on_one_at`, `hire_answer`, `manager_availability_at`
  - `wa275_availability_set(p_availability jsonb) returns void` (a signed-in person sets their own), and the read of a manager's availability is through the function `wa275_availability_of(p_member bigint)` (HR, admin, or the person)
  - `hub_notification_kinds` rows for the three new kinds; `app_config` keys from Fixed values (except `onboard_v2_since`, set at release)

- [ ] **Step 1: Write `test/w275sql.sql`** (begin/rollback), asserting: an offer sent creates an `offered` flow with the manager; accepting moves it to `waiting` and keeps the proposal; a second offer_sent update creates no second flow; `wa275_manager_of` is true for the manager's email, HR and admins, false for another member; `wa275_my_cards` returns only that manager's flows; availability validation (a block end after its start, times on 5-minute marks, weekday keys only; `except` dates valid); `hours_confirmed_at` set is readable by HR; `onboard_v2_since` absent until release.
- [ ] **Step 2: Run the PGlite runner.** Expected: FAIL.
- [ ] **Step 3: Write the migration and undo**, in wave271's style, every object commented, RLS on nothing new (no new tables), column grants excluding nothing new. The availability validation is a check function `wa275_availability_ok(jsonb)`.
- [ ] **Step 4: Run.** Expected: PASS, twice, and the undo round trip.
- [ ] **Step 5: Commit** (`wave275a:` prefix; branch `wave275-streamlined` from `wave271-onboarding`).

## Task 2: The manager's side: `mgr` link proposes times and edits availability

**Files:**
- Modify: `fn/onboard-link/index.ts`, `test/w271link.test.mjs` (add a `w275` section), `build/o/index.html`, `test/w271page.js`

**Interfaces:**
- Consumes: Task 1 columns and functions (read with the service key).
- Produces, on the `mgr` link:
  - GET adds `{proposal: {call_at, one_on_one_at, by, at} | null, availability: {...}, availabilityAt, availabilityStale: boolean, busy: [{start, end, title}] (hub@ events the manager is invited to, next 21 days), lengths: {callMin, oneMin}, leadHours}`
  - POST `{t, a: 'availability', availability}`: validates (Task 1 rule), saves on the manager's roster row with `availability_at = now()`
  - POST `{t, a: 'propose', call_at, one_on_one_at}`: both at least `onboard_propose_lead_hours` ahead, both inside the manager's availability blocks, neither overlapping a hub@ event they are invited to, neither overlapping another flow's booked or proposed times for the same manager (Review Focus 2); saves the proposal; tells HR and, if the hire already accepted, emails the hire the yes-or-no link (through `onboard-run` `hire_times {flow_id}` with the trigger secret); refusals carry EN and FR messages (`lead_time`, `outside_hours`, `busy`, `taken`)
  - POST `{t, a: 'propose', ...}` on a flow already answered `yes` is refused (`already_booked`)
- The page: the manager's view in `/o/index.html` shows the availability editor (weekday rows with blocks; add a block, remove a block; exceptions by date), the stale notice ("Please confirm your availability: it was last set on <date>" when older than 30 days or missing), the two picks from a grid of their free cells (busy greyed), and "Propose these times".

- [ ] **Step 1: Write failing tests** for each rule above, including: default availability when none saved; a block outside 00:00 to 24:00 refused; a proposal inside an exception refused; a slot taken by another flow refused; propose then hire-accepts path sends `hire_times`; practice flow proposes without any fetch.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the manager page in `/o/index.html` (the design leaves the split to the builder; one file keeps the headers and redirects as they are).
- [ ] **Step 4: Run** `node --test test/w271link.test.mjs` and `cd test && node w271page.js`. Expected: PASS.
- [ ] **Step 5: Commit.**

## Task 3: The hire's side: Accept with hours, Yes or No, the closing page, the rundown; the at-Accept setup

**Files:**
- Modify: `fn/onboard-link/index.ts`, `fn/onboard-run/index.ts`, `build/o/index.html`, tests as Task 2 plus `test/w271run.test.mjs`

**Interfaces:**
- Consumes: Task 2's proposal fields; wave271's runner.
- Produces:
  - `offer` GET adds `{offerHours, hoursConfirmed, proposal, answer, setup: {steps: [{key, title, body}], ticks}}`; POST `accept` requires `hours_ok: true` when `offerHours` is set (`hours_required` otherwise, EN and FR), sets `hours_confirmed_at`, then calls `onboard-run` `accept_setup {flow_id}` (trigger secret) and returns at once
  - POST `yes`: re-checks both proposed times (Review Focus 1: `onboard_yes_lead_hours`, hub@ busy, availability) and calls `onboard-run` `book {flow_id, call_at, one_on_one_at, by: 'hire'}`; on a failed re-check returns `{stale: true}` and the page shows the grid
  - POST `no`: records `hire_answer = 'no'`, tells the manager and HR (`onboard_answer`); with `ask_availability` on, the page shows the grid with the 10-hour minimum (wave271d) and grid Save shows the closing view; with it off, the page shows the closing view at once ("<manager> will be in touch with other times") and no grid
  - POST `setup_tick {key, done}` on the setup page; GET `?setup` returns the rundown
  - `onboard-run` actions (trigger secret): `accept_setup` runs `roster`, `google`, `hub` for flows created on or after `onboard_v2_since` (otherwise no-op); `book` runs `plan`, `invites`, `manager`, `welcome` and moves the flow to `started`; `hire_times` sends the hire the yes-or-no email
  - `roster` at Accept creates or links the profile active with **no start date** (`start_source = 'manual'`) and leaves the card at `offer`; `plan` at booking fills `team_members.start_date`, `hub_candidates.start_date` and moves the card to `hired` (the settled rule 7)
  - A second `no` on the same flow is refused (`answered`): the page says a person will be in touch, and the manager is told; with no proposal yet, the accept page shows "We are choosing your times now; you will get an email within two days" and no grid
  - Step `google` run: `users.insert` to `/` with the vault password and `changePasswordAtNextLogin: true`, acting as `steel.macdonald@welfareavenue.com`; read back before done; 409 or no licence become `hr_task` with Google's reason; password unset becomes `hr_task` "The first password is not set in admin settings"; practice simulates. Step `hub` run: hub-invite at member level through the secret path (`fn/hub-invite/index.ts` gains `x-wa-secret` for `invite` only, member level forced).
- The closing view: "Thank you, <name>. Your invites are on their way; <manager> will see you on <date>." (or "<manager> will pick from your times") with the rundown link.

- [ ] **Step 1: Write failing tests:** Accept without `hours_ok` refused when hours set, allowed when hours null (wave271 offers); roster at Accept has no start date and the card stays `offer`, both filled at booking; a second `no` refused; accept with no proposal shows the waiting message; Accept triggers `accept_setup` once; Yes books and the flow is `started` with both events and the welcome sent; Yes with a stale time returns `stale` and books nothing; No records and notifies; grid save after No shows closing; setup ticks save and are idempotent; `google` with password unset is `hr_task`; a Workspace 409 is `hr_task`; `hub` through the secret path; practice: no fetch; the password never appears in any table snapshot or captured console (Global Constraint).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, reusing wave271's step table: give `google` and `hub` their `run`, add the timing field, and split `advance` into the two groups.
- [ ] **Step 4: Run** all `test/w271*` suites. Expected: PASS.
- [ ] **Step 5: Commit.**

## Task 4: The welcome email and the first password setting

**Files:**
- Modify: `fn/onboard-run/index.ts`, `build/parts271/b_pick.js` and `c_card.js` (template editor and card copy), `test/w271run.test.mjs`, `test/w271drive.js`

**Interfaces:**
- Produces:
  - `renderWelcome` gains the login paragraph with `[first password]` and `[new address]`, the setup rundown as numbered steps, Meet links, and the variant "HR will send your login details separately" when `google` is not done
  - `sendWelcome(flow)`: fills brackets at send time, substitutes the vault password only into the outgoing message, sends from hub@ (wave271's `deliver`), sets `welcome_sent_at`, keeps the bracketed text on the flow; test mode to `mail_test_recipients`
  - `set_first_password {password}` (admins only, JWT): refuses under 8 characters or without a letter and a digit; stores through `wa_vault_set('ONBOARD_FIRST_PASSWORD', ...)`; writes change_log "set" with no value; `first_password_state` returns `{set: boolean, set_at}`
  - the card shows "First password: set on <date>" or "not set", with the admin field to set it (type password, never echoed)

- [ ] **Step 1: Write failing tests:** the rendered preview and the saved copy contain `[first password]` and never the vault value; the sent MIME contains the value exactly once; the variant when `google` is `hr_task`; `set_first_password` refusals and the change_log row without the value; a non-admin refused; the drive test shows the state line and never a password in the DOM.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

## Task 5: The offer panel asks for the manager and the hours; the manager is asked for times

**Files:**
- Modify: `fn/recruit-actions/index.ts` (after comparing with live, as wave271 did), `build/parts211/a_rec.js`, `fn/notify/index.ts` (the three kinds), `test/w271offer.test.mjs`, `test/w271notify.test.mjs`, `test/w211drive.js`

**Interfaces:**
- Produces: `offer_send` requires `hours` in `{4,6,8}` and `manager_member_id` (default from `wa271_default_manager` shown in the panel), stores `offer_hours` and `onboard_manager_id`, then (the trigger made the `offered` flow) calls `onboard-run` `ask_manager {flow_id}` (secret): a Slack DM and an email from hub@ to the manager with their `mgr` link, and a reminder after `onboard_remind_hours` through `remind` (extend wave271's `remind`: flows `offered` with no proposal)
- The panel: "Onboarding manager" select (required) and "Hours a week" as 4, 6 or 8.

- [ ] **Step 1: Write failing tests:** send refused without a manager or with hours outside the set; stored values; `ask_manager` sends the DM and the email with a token that verifies through `onboard-link`; the reminder once; the drive test shows the two fields and the refusal.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

## Task 6: The card for HR and the manager; availability on My page

**Files:**
- Create: `build/parts275/` (`assemble.py`, `a_card.js`, `b_avail.js`), `build/src/275_wave275.seg`, `test/w275drive.js`
- Modify: `build/src/MANIFEST.txt` (275 after 271), `build/parts271/*` where the Ready card changes

**Interfaces:**
- Consumes: `wa275_my_cards`, `wa271_ready_list` (extended), `onboard-run` actions (`propose` from the card for HR or the manager: same rules as Task 2; `book` from the grid; wave271's change actions now allowed to `wa275_manager_of`), `wa275_availability_set`/`_of`.
- Produces: the card has the switch "Availability: ask the hire / already communicated" (`set_ask_availability {flow_id, on}`), "Enter their availability" (HR or the manager fills the hire's grid on their behalf through `grid_for {flow_id, who, slots}`) and "Set <manager>'s availability" (`availability_for {member_id, availability}`, HR or admin); the Ready card shows the proposal state ("Proposed by Kahkashan: Wed 4 Nov 10 am and Thu 5 Nov 10 am; waiting for James"), the hire's answer, the hours confirmation, the setup steps with results, the rundown ticks ("3 of 8 setup steps done"); a manager sees their own hires' cards on their team page and Home; My page gets "My availability" (the same editor as Task 2) with the stale notice.

- [ ] **Step 1: Write failing `test/w275drive.js`** (admin, HR member, a plain member who manages a hire, a leader, board; 390 px): who sees which cards; propose from the card; the already-communicated switch hides the hire's grid on No and lets HR enter the hire's times; HR sets a manager's availability; the plain-member manager can book and change time but not see other cards; the availability editor saves; no console errors; no sideways scroll.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, wrapping wave271's renderers per `docs/ARCHITECTURE.md` section 5.
- [ ] **Step 4: Run** `w275drive`, `w271drive`, `w211drive`. Expected: PASS.
- [ ] **Step 5: Commit.**

## Task 7: Release

- [ ] **Step 1:** release checklist; `docs/02-11-26 - wave275 streamlined onboarding.md`; update `docs/EDGE_FUNCTIONS.md` and the HR walkthrough.
- [ ] **Step 2:** merge main; build with the Python join; stage as base64; gate.
- [ ] **Step 3: Steel's yes,** then: apply `wa275a`; set `onboard_v2_since` to now; deploy `notify`, `onboard-link`, `onboard-run`, `hub-invite`, then `recruit-actions` last; publish the page.
- [ ] **Step 4: Steel sets the first password** in the card's admin field (never in chat).
- [ ] **Step 5: Proof:** a practice applicant end to end (nothing real); then James MacDonald's live card: Retry on the Google step creates his real account; sign in once as James to confirm the forced change; search change_log, the step rows and the flow rows for the password.
- [ ] **Step 6:** commit, push, report; Build 3 (Slack channel) stays as planned.
