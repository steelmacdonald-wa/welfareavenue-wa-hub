# Onboarding plan revamp (wave279) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The plan new hires work through after setup is revised section by section. Steps covered by setup leave plans that went through setup, a 90 days section is added, the manager picks role trainings, policies must be open 10 minutes before they can be signed, the Hub messages the hire and their manager when a plan falls behind, and new hires' Google job title is set at Accept.

**Architecture:**
- **Data:** content changes go into `onboarding_template` (wa279b). The existing wave169 trigger carries them into running plans.
- **Rules:** new rules live in SQL (wa279a): the setup-covered filter, role picks, the policy reading rule, and the daily behind and pick-reminder job, which sends through `notify` and `hub-push` like wa242.
- **Page:** a new page segment `279_wave279.seg` (parts279) holds the role-pick pop-up and the plan's role step. It also has small hooks into the plan, HR centre and Home policy code.
- **Functions:** notify gets three relay kinds. onboard-run sends the job title in `users.insert`.

**Tech Stack:**
- Supabase Postgres (PGlite tests);
- Deno edge functions (single `index.ts`, `node --test` with the `test/w271rig.mjs` stubs);
- vanilla JS page parts assembled into `build/src/*.seg`;
- Playwright drives with fixtures.

**Spec:** `claude/04-11-26 - Onboarding plan revamp, design (wave279).md` (approved by Steel 04/11/26). Read it first; it carries every step's verdict and Steel's answers.

## Global Constraints

- Steel's yes for every live step. No real email, Slack, Google or notify call from any test. Nothing is applied to the live database until Task 9.
- Never put the first password (`ONBOARD_FIRST_PASSWORD`) anywhere: not in tests, logs, docs or change_log.
- Never take functionality away. Removed steps are `active = false` with their text kept. A done tick is never cleared by this wave (except when a removed step's row goes, as the wave169 trigger already does).
- Branch `wave279-onboarding-plan` in the worktree `hub-repo-279`, from `wave278-onboarding` (179c2bb). Do not touch the `hub-repo` checkout or the wave278 branch.
- Release rules as wave278:
  - functions deploy as one-line stubs pinned to a pushed commit;
  - the page goes through the staged, gated swap (`deploy_stage.py`, `deploy_gate.py` tail rule `'</html>\r\n'`, `build/src/271_wave271.seg` made LF before the candidate is built);
  - large SQL goes by commit-pinned fetch inside the database.
- notify: read the live notify source before changing it (live: v31, header v20; deployed version is a stub, so read its pinned commit). The change goes on top of that, as the next header version.
- Practice plans and test messages say so ("(practice)" prefix), as wave275 does.
- Copy is in plain short sentences, in Steel's voice. No em dashes.

### Fixed values

| Name | Value |
|---|---|
| Template column | `onboarding_template.setup_covered boolean not null default false` |
| Setup-covered steps | `86e1cj9gj` (Chrome and your Welfare Avenue account), `86e1cj9gp` (Download Chrome), `86e1cj9gy` (Google Groups), `86e1cj9h3` (Download Slack) |
| "Went through setup" | the plan has a `hub_onboard_flows` row with `onboarding_id` = the plan's id |
| Steps switched off | `86e1cj9gx` (Gmail signature), `wa166team` (Your team's Learning Avenue), `86e1cj9j0` (Pick a Learning Avenue) |
| Moves | `wa166usehub` to WEEK 3 (parent null); `86e1cj9gr` (Setting up a meeting) to WEEK 2, parent null; `86e1cj9h8` (Optimizing Slack) to WEEK 2, parent null; `86e1cj9h6` (About Welfare Avenue) to WEEK 2 |
| Rewords | `86e1cj9gr` (drop "bookmark your Google Calendar"); `86e1cj9gh` Policies (sign on Home, 10 minutes, ticks itself); `86e1cj9h2` (adds the desktop app line from Download Slack); `86e1cj9hh` Loom (accept HR's invite, check your name shows); `wa272appsetup` renamed "Turn on Hub notifications"; `86e1cj9gm` renamed "Your Canva folders"; `86e1cj9j4` Charitable receipts (links Academy module 8, `training_id = 8`); `86e1cj9j6` (reference "Setting up a meeting, week 2") |
| New role steps | `wa279role60` "Your role trainings" in `60 DAYS`, `academy_path = 'role60'`; `wa279role90` "Your role trainings" in `90 DAYS`, `academy_path = 'role90'` |
| New content steps | `60 DAYS`: `wa279serving` "Your first serving". `90 DAYS`: `wa279review` "Your 90-day review", `wa279share` "Share one thing you know", `wa279feedback` "Tell us how onboarding went" |
| Everyone trainings (one step each, `training_id`, id `wa279t<training id>`) | WEEK 2: 119, 205, 68. WEEK 3: 122, 103, 82, 201, 71. WEEK 4: 126. 60 DAYS: 121, 120. 90 DAYS: 148 |
| Role counts | `60 DAYS`: 2 to 3 picks. `90 DAYS`: 5 to 6 picks |
| Role recommend (`app_config` `onboard_role_recommend`, jsonb) | `{"by_department": {"<dept>": {"paths": [...], "trainings": [...]}}, "leaders": {"paths": ["leading"]}}`, seeded from the spec's two tables. Path keys: marketing `mktbasics, campaigns, marketing, studio`; fundraising `fundraising, clubs, thriving, keela`; opsmtl and opsto `ops`; hr `people, hrcentre`; board `governance`; exec `leading, governance`; progdev `leading`. Trainings: the app tour ids per department in the spec |
| Pick timing | pop-up from day 21 (day one = `onboardings.started_at`); manager reminded every 7 days while a list is short; Hub auto-pick: 60 days list at day ≥ 29, 90 days list at day ≥ 59, never before `onboard_role_picks_since` + 7 days |
| Policy rule | `app_config` `policy_read_minutes` = `10` (0 = off). It applies to required, active policies (`wa_policies.required and active`), per policy, from its first open, and only to sign-offs a signed-in user inserts for their own email |
| Behind | open step, `due_date < current_date - 2`. Role steps with no picks never count. Plans count when `status = 'active'` and `started_at >= onboard_behind_since` |
| Behind cadence | weekdays at 12:35 UTC (cron `wa-onboard-behind`, `35 12 * * 1-5`); at most one message per plan per 7 days; HR (`app_config` `hr_notify_emails`) is added from the third message on a plan |
| Switches | `onboard_behind_on` (`off` until release); `onboard_behind_since` (release date); `onboard_role_picks_since` (release date) |
| Notification kinds (`hub_notification_kinds`) | `onboard_behind` (to the hire, "Onboarding: you're behind"); `onboard_behind_lead` (to the manager, "Onboarding: a hire is behind"); `onboard_role_pick` (to the manager, "Onboarding: pick role trainings"). Hub and Slack default on |
| Manager of a plan | `hub_onboard_flows.manager_member_id` when a flow exists; else the same order `onboarding_lead_view` uses (reporting line, then the team's leaders, then admins) |
| Restart at release | Alyx Denison (onboarding 4) and Zachee Leonel Ngue (5): `wa271_move_start` to the release date |
| Job title at Accept | onboard-run `users.insert` body gains `organizations: [{ title: <hub_positions.title>, primary: true }]` when the position has a title |

## Review Focus

1. **A plan made by HR's Assign for someone who never had a setup page** must keep the four setup-covered steps. Only a flow linked to the plan removes them, and only the open ones. (Task 1)
2. **The manager picks a module the hire already finished,** or picks 4 for 60 days: refused with a plain reason. A training picked for 60 days can't also be picked for 90. (Task 2)
3. **A sign-off the Hub inserts with the service role** (an import, HR on paper), or one for a policy that isn't required, must not be blocked by the 10 minute rule. A sign-off from before release stays valid. (Task 3)
4. **A plan whose manager has no email or left** (`team_members.active = false`): the behind message still reaches the hire, the manager message falls back to the next in the lead order, and the job never errors for the other plans. (Task 4)
5. **The job runs twice in a day,** or after a week off: no second message inside 7 days, and the reminder count used for HR doesn't double. (Task 4)

---

## File structure

- `build/wa279a_rules.sql` (+ `build/wa279a_undo.sql`): the template column and the trigger changes; role picks; policy opens and the sign-off rule; the path states `role60`, `role90`, `policies`; the behind and pick job with its cron; the notification kinds; settings (off). Tests: `test/w279sql.sql`, run by the new `test/w279sql.mjs` on PGlite, with `test/w279schema.sql` (the live definitions of the tables and wa166/wa169/wa271 functions these depend on, taken from live with `pg_get_functiondef`).
- `build/wa279b_template.sql` (+ `build/wa279b_undo.sql`): the content (Fixed values: moves, rewords, new steps, trainings, `onboard_role_recommend` seed). Tests: in `test/w279sql.sql`.
- `fn/notify/index.ts`: the three relay kinds. Test: `test/w279notify.test.mjs`.
- `fn/onboard-run/index.ts`: the job title. Test: `test/w271run.test.mjs`.
- `build/parts279/` (`a_picks.js`, `b_hooks.js`, `assemble.py`) → `build/src/279_wave279.seg`: the pick pop-up (Home and HR card), the plan's role step, labels and pace, the HR board count, the policy timer. Hooks edit the smallest possible lines in `build/src/166_wave166.seg` (weekOf), `build/src/046_wave46.seg` (pace), `build/src/037_wave37.seg` (order), `build/parts272/c_setup.js` (Home sign) and `build/src/122_wave122.seg` (Academy sign). Test: `test/w279drive.js` with `test/w279fx.js`.
- `docs/04-11-26 - wave279 onboarding plan revamp.md`: the release note (Task 9).

### Task 1: Setup-covered steps and the 90 days rules (wa279a, part 1)

**Files:**
- Create: `build/wa279a_rules.sql`, `build/wa279a_undo.sql`, `test/w279sql.mjs`, `test/w279sql.sql`, `test/w279schema.sql`

**Interfaces:**
- Produces:
  - `onboarding_template.setup_covered`;
  - `wa279_via_setup(p_onb bigint) returns boolean`;
  - trigger `trg_wa279_flow_plan`, after insert or update of `onboarding_id` on `hub_onboard_flows`: deletes the plan's open steps whose template row is `setup_covered`;
  - `onboarding_template_propagate()`: on insert or reactivation of a `setup_covered` row, it skips plans where `wa279_via_setup` is true. Its other behaviour is unchanged.

- [ ] **Step 1: Write the failing tests** in `test/w279sql.sql`:
  - A plan assigned by `onboarding_assign` with no flow keeps a setup-covered step.
  - Linking a flow to it (`update hub_onboard_flows set onboarding_id`) removes that step when open, and keeps it when done.
  - Inserting a new active `setup_covered` template row adds it to the no-flow plan only.
  - `onb_due('90 DAYS', '2026-11-05')` = `2027-02-03`.
  - The undo brings `onboarding_template_propagate` back exactly (compare `pg_get_functiondef` before and after) and drops the column.
- [ ] **Step 2: Run** `node test/w279sql.mjs`. Expected: FAIL on the missing column.
- [ ] **Step 3: Write** `test/w279schema.sql` from live (read-only `execute_sql`: the table definitions and `pg_get_functiondef` of `onb_due`, `onboarding_template_propagate`, `onboarding_assign`, `wa166_path_state`, `wa166_onb_sync`, `wa166_training_done`, `wa271_move_start`, `onboarding_lead_view`, plus a stub `call_edge` and `cron.schedule`/`cron.unschedule` as in `test/w271schema.sql`). Then write the migration part and the undo in wave278's style: idempotent, comments on every object, `revoke` from public and anon.
- [ ] **Step 4: Run** `node test/w279sql.mjs`. Expected: OK. The migration is loaded twice and the undo round trip passes.
- [ ] **Step 5: Commit** `wave279a: steps covered by setup leave plans that went through setup`.

### Task 2: Role picks (wa279a, part 2)

**Files:**
- Modify: `build/wa279a_rules.sql`, `build/wa279a_undo.sql`, `test/w279sql.sql`

**Interfaces:**
- Consumes: Task 1's schema file and runner.
- Produces:
  - Table `onboarding_role_picks (id bigserial, onboarding_id bigint references onboardings on delete cascade, section text check in ('60 DAYS','90 DAYS'), training_id bigint references trainings, picked_by text, picked_at timestamptz default now(), auto boolean default false, assignment_id bigint, unique (onboarding_id, training_id))`, with RLS on and no direct grants.
  - `wa279_plan_manager(p_onb bigint) returns table(member_id bigint, email text, name text)`: the Fixed values order. It skips inactive members and members with no email.
  - `wa279_role_options(p_onb bigint) returns jsonb`: `{member, department, leader, day, sections: {"60 DAYS": {min, max, picked: [...]}, "90 DAYS": {...}}, recommended: [{training_id, title, path, done}], can_pick: boolean}`. `leader` comes from the flow's `leader`, else false.
  - `wa279_role_save(p_onb bigint, p_section text, p_training_ids bigint[]) returns jsonb`: it replaces that section's picks.
    - Allowed for: the plan's manager (by `auth.jwt() ->> 'email'`), HR or admin (`is_wa_admin()` or `hub_roles.role = 'hr'`; the builder confirms the HR role name used by the HR centre).
    - Refused: counts outside 2–3 or 5–6; a module already done; a module picked in the other section.
    - For each pick, it creates a people-only Academy assignment (via `academy_assign`, due date = that section's due date, note `Role training (60 days)` / `(90 days)`). It ends the assignments of unpicked modules (`academy_assign_end`). Then it runs `wa166_onb_sync`.
  - `wa279_role_autopick() returns jsonb`: the Fixed values rule. It picks recommended modules in recommendation order, not done and not already picked, with `auto = true` and `picked_by = 'the Hub'`.
  - `wa166_path_state` gains keys `role60` and `role90`: complete when that section has at least one pick and every picked module is `done` for the member.

- [ ] **Step 1: Write the failing tests**:
  - the manager can save 3 for 60 days, and 4 is refused with "Pick 2 or 3";
  - an outsider is refused;
  - a done module is refused;
  - the same module can't go in both sections;
  - saving creates people-only assignments with the section's due date, and re-saving without one module ends that one's assignment;
  - the step `wa279role60` ticks when all picked modules are done, and not when the list is empty;
  - autopick fills 3 on day 29 and does nothing on day 28, and nothing before `onboard_role_picks_since` + 7 days;
  - `wa279_plan_manager` falls back past an inactive manager.
- [ ] **Step 2: Run** `node test/w279sql.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** in the migration and the undo.
- [ ] **Step 4: Run** `node test/w279sql.mjs`. Expected: OK.
- [ ] **Step 5: Commit** `wave279a: the manager picks role trainings for 60 and 90 days`.

### Task 3: Policies, the 10 minute rule (wa279a, part 3)

**Files:**
- Modify: `build/wa279a_rules.sql`, `build/wa279a_undo.sql`, `test/w279sql.sql`

**Interfaces:**
- Produces:
  - Table `wa_policy_opens (email text, policy_key text, opened_at timestamptz default now(), primary key (email, policy_key))`.
  - `wa279_policy_open(p_key text) returns jsonb` (granted to authenticated). It records the first open for `auth.jwt() ->> 'email'` and returns `{opened_at, unlock_at, minutes}`.
  - `wa279_policy_state() returns jsonb`: the caller's `{key: {opened_at, unlock_at}}`.
  - A BEFORE INSERT trigger on `wa_policy_signoffs`. It raises `Read it for N more minutes first` when all of these hold:
    - the inserting role is `authenticated`;
    - the row's email = the caller's;
    - the policy is required and active;
    - `policy_read_minutes > 0`;
    - there's no open, or the open is younger than the rule.
  - `wa166_path_state(member, 'policies')`: true when every required, active policy is signed by the member's email.
  - A trigger on `wa_policy_signoffs` insert runs `wa166_onb_sync` for that person's active plan.

- [ ] **Step 1: Write the failing tests**:
  - sign without opening: refused;
  - open then sign at once: refused, with the minutes left;
  - an open back-dated 11 minutes: signed;
  - the service role inserts at once: signed;
  - a non-required policy: signed at once;
  - `policy_read_minutes = 0`: signed at once;
  - a sign-off from before (inserted before the trigger exists) stays;
  - the Policies step (`86e1cj9gh` with `academy_path = 'policies'`) ticks when both required policies are signed.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: OK.
- [ ] **Step 5: Commit** `wave279a: policies open 10 minutes before they can be signed, and the Policies step ticks itself`.

### Task 4: The behind check and the pick reminders (wa279a, part 4)

**Files:**
- Modify: `build/wa279a_rules.sql`, `build/wa279a_undo.sql`, `test/w279sql.sql`

**Interfaces:**
- Consumes: `wa279_plan_manager`, `wa279_role_autopick` (Task 2).
- Produces:
  - Table `onboarding_behind_log (id bigserial, onboarding_id bigint, kind text, sent_at timestamptz default now(), late int, detail jsonb)`.
  - `wa279_behind_list(p_onb bigint) returns jsonb`: the late steps, `[{template_id, name, section, due_date}]`, oldest first, with the role steps left out when they have no picks.
  - `wa279_onboard_tick(p_dry boolean default false) returns jsonb`. It is restricted like `wa242_due_reminders`, and does the following in order:
    1. `wa279_role_autopick()`;
    2. for each counting plan with late steps and no `onboard_behind` row in the last 7 days, it sends `onboard_behind` to the hire and `onboard_behind_lead` to the manager, and adds `hr_notify_emails` as extra `onboard_behind_lead` recipients from the third `onboard_behind` row on that plan;
    3. for plans at day ≥ 21 with a section short of its minimum and no `onboard_role_pick` row in 7 days, it sends `onboard_role_pick` to the manager.
  - Payloads are `{event, to_email, url, tag, title, body, text}`. `url` is `#mypage` for the hire, and `#hrcentre/onboarding` for the manager and HR. They go through `call_edge('notify')`, and `call_edge('hub-push')` when the person has a device, exactly as wa242.
  - Nothing is sent when `onboard_behind_on` is `off`; a dry run still returns the plan.
  - Cron `wa-onboard-behind` at `35 12 * * 1-5` calling `wa279_onboard_tick()`.
  - The three `hub_notification_kinds` rows.
  - Settings `onboard_behind_on = off`, `onboard_behind_since`, `onboard_role_picks_since` (both left empty, to be set at release).

- [ ] **Step 1: Write the failing tests** (`call_edge` stubbed to record its calls):
  - a plan started 10 days ago with an open Week 1 step sends one hire and one manager message;
  - a second run the same day and one 6 days later send nothing, and 7 days later sends again;
  - the third message adds HR;
  - a plan started before `onboard_behind_since` sends nothing;
  - `off` sends nothing, but the dry run lists the plan;
  - an unpicked role step doesn't make the hire late;
  - the manager gets `onboard_role_pick` on day 21 and not again for 7 days;
  - a manager who left: the message goes to the next in order, and the other plans are still processed.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: OK.
- [ ] **Step 5: Commit** `wave279a: the Hub tells the hire and their manager when onboarding falls behind`.

### Task 5: The content (wa279b)

**Files:**
- Create: `build/wa279b_template.sql`, `build/wa279b_undo.sql`
- Modify: `test/w279sql.mjs` (loads wa279b after wa279a, twice), `test/w279sql.sql`, `test/w279schema.sql` (a copy of the live template rows, taken read-only)

**Interfaces:**
- Consumes: Tasks 1 to 3 (`setup_covered`, the `role60`/`role90`/`policies` path keys).
- Produces: every Fixed values row from "Setup-covered steps" to "Role recommend". The new steps' wording follows the spec's tables. Each self-ticking step ends with the existing line style ("*This step ticks itself when ...*"). The undo puts back every changed row's exact previous text, section, parent, sort and active flag, from values captured in the file.

- [ ] **Step 1: Write the failing tests**:
  - section counts on a fresh plan with a flow: WEEK 1 14, WEEK 2 12, WEEK 3 10, WEEK 4 8, 60 DAYS 8, 90 DAYS 5;
  - without a flow, WEEK 1 also has the four setup-covered steps;
  - no active step mentions ClickUp, When2Meet bookmarking or "ask HR to add you to the groups";
  - every `training_id` and `academy_path` named exists in `trainings` / `academy_paths`, or is `role60`, `role90` or `policies`;
  - `onboard_role_recommend` parses and covers all eight departments (`opsto, progdev, board, fundraising, opsmtl, marketing, hr, exec`);
  - the undo restores the captured rows exactly.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Write** the content and the undo.
- [ ] **Step 4: Run.** Expected: OK.
- [ ] **Step 5: Commit** `wave279b: the reviewed plan, 90 days, and the everyone-trainings`.

### Task 6: notify knows the three kinds; onboard-run sets the job title

**Files:**
- Modify: `fn/notify/index.ts` (header, `RELAY_TITLE`, `RELAY_URL`, `HUB_EVENTS`, the relay `if` at ~674), `fn/onboard-run/index.ts` (the `users.insert` body ~623)
- Test: `test/w279notify.test.mjs`, `test/w271run.test.mjs`

**Interfaces:**
- Consumes: Task 4's payload shape.
- Produces: notify relays `onboard_behind`, `onboard_behind_lead` and `onboard_role_pick` as it does `onboard_remind`, respecting `wa_notify_prefs`. onboard-run sends `organizations` with the title.

- [ ] **Step 1: Read the live source.** `get_edge_function` notify and onboard-run, read the pinned commit, and diff it against the branch file. Report any difference before editing.
- [ ] **Step 2: Write the failing tests**:
  - each new kind becomes a Slack DM to `to_email`, with its title and URL;
  - a person whose prefs set the kind's `slack` to false gets none;
  - onboard-run's `users.insert` body carries `organizations[0].title = 'Event Coordinator'` for a position with that title, and no `organizations` when the position has none.
- [ ] **Step 3: Run** `node --test test/w279notify.test.mjs test/w271run.test.mjs`. Expected: FAIL.
- [ ] **Step 4: Implement.** The notify header gains the next version's line.
- [ ] **Step 5: Run** both suites and the existing notify and run suites. Expected: PASS.
- [ ] **Step 6: Commit** `wave279: notify relays the onboarding behind and pick kinds; new hires get their Google job title at Accept`.

### Task 7: The role-pick pop-up and the plan's role step (page)

**Files:**
- Create: `build/parts279/a_picks.js`, `build/parts279/assemble.py`, `build/src/279_wave279.seg`, `test/w279drive.js`, `test/w279fx.js`
- Modify: the build's segment list if it doesn't pick up new segments by itself (check `build/build.sh`)

**Interfaces:**
- Consumes: `wa279_role_options`, `wa279_role_save` (Task 2).
- Produces:
  - **On Home,** for a signed-in manager with a hire at day ≥ 21 and a short list: a card "Pick [name]'s role trainings". It opens a sheet with two lists, 60 days and 90 days. Recommended modules come first, in order; there's a search over all active modules; done modules show greyed and can't be picked; the counts show and Save is enabled only inside 2–3 and 5–6. The DB's refusal text is shown as is.
  - **On the HR centre's onboarding checklist** for a person, a "Role trainings" button opens the same sheet.
  - **On the plan view,** the role steps list the picked modules with a tick each and "picked by [name]" or "picked by the Hub". With no picks, they show "Your manager picks these in week 3".

- [ ] **Step 1: Write the failing drive** `test/w279drive.js` with fixture `test/w279fx.js` (a manager, a hire at day 22 in marketing, recommended modules, one done module). It checks:
  - the Home card shows;
  - Save is disabled at 1 and at 4;
  - the done module can't be picked;
  - Save sends one `wa279_role_save` call per section;
  - the plan shows the picks;
  - the HR button opens the sheet;
  - phone width (375) has no horizontal scroll.
- [ ] **Step 2: Run** `node test/w279drive.js`. Expected: FAIL.
- [ ] **Step 3: Implement** in `a_picks.js`, assemble the segment, and build.
- [ ] **Step 4: Run** the drive and the w166/w169/w272/w275 drives. Expected: PASS. (Run Chrome drives one at a time on this PC.)
- [ ] **Step 5: Commit** `wave279: the manager's role-pick pop-up and the plan's role step`.

### Task 8: 90 days in the page, the HR count, the policy timer (page)

**Files:**
- Create: `build/parts279/b_hooks.js`
- Modify: `build/src/166_wave166.seg:385` (weekOf: "Week n of 4", then "Up to 60 days", then "Up to 90 days", then "Past 90 days"), `build/src/046_wave46.seg:215` (pace `days / 90`), `build/src/037_wave37.seg:16` (`WA37_WEEK_ORDER` gains `'90 DAYS': 6`), `build/parts272/c_setup.js` (Home sign) and its assembled segment, `build/src/122_wave122.seg` (the Academy's sign path, around 2439)
- Test: `test/w279drive.js`

**Interfaces:**
- Consumes: `wa279_policy_open`, `wa279_policy_state` (Task 3).
- Produces:
  - **Policies:** Open calls `wa279_policy_open`. Sign shows "Sign in N min" until `unlock_at`, then "Sign". A refusal shows the DB message.
  - **HR board:** each person's row shows "Academy trainings d of t" (their plan's steps with `training_id` or `academy_path`, plus role picks).
  - **Labels:** "90 days" shows in the plan's labels and sorting.

- [ ] **Step 1: Extend the failing drive**:
  - Home: Sign is disabled with "Sign in 10 min" after Open, and enabled when the fixture's `unlock_at` is past;
  - the Academy's policy page behaves the same;
  - a 70-day plan shows "Up to 90 days";
  - the HR board shows the trainings count;
  - the pace check at day 45 with 50% isn't late.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with the smallest edits in the named lines.
- [ ] **Step 4: Run** the drive and the existing drives touched (w166, w169, w272). Expected: PASS.
- [ ] **Step 5: Commit** `wave279: 90 days in the page, the HR trainings count, the policy reading timer`.

### Task 9: Release (only on Steel's yes)

**Files:**
- Create: `docs/04-11-26 - wave279 onboarding plan revamp.md` (release note, with the undo)
- Modify: `docs/EDGE_FUNCTIONS.md`, `docs/DATA_MODEL.md`

- [ ] **Step 1: Check live against the branch.**
  - The live index.html md5, notify, onboard-run and the wa278 SQL against what this branch was built on. If wave278 or anything else moved, rebuild on it first.
  - List the done ticks the release removes (expected: Alyx's two Learning Avenue ticks), and put them in the note.
- [ ] **Step 2: Back up** `onboarding_template`, `onboarding_steps`, `onboardings` and `wa_policy_signoffs` to `claude/backups/` (JSON), and write the note's undo order.
- [ ] **Step 3: Get Steel's yes** on the exact list (the SQL, the functions, the page).
- [ ] **Step 4: Release in order:**
  1. wa279a by pinned fetch;
  2. wa279b by pinned fetch;
  3. set `onboard_behind_since` and `onboard_role_picks_since` to the release date;
  4. `wa271_move_start` for onboardings 4 and 5 to the release date;
  5. notify and onboard-run stubs pinned to the pushed commit;
  6. the page (staged, gated);
  7. `onboard_behind_on = on` last.
- [ ] **Step 5: Prove it:**
  - `wa279_onboard_tick(true)` dry run, showing who would be messaged;
  - a practice plan with a flow, showing the section counts;
  - the Home policy timer in the browser, signed in as Steel (read only; no sign-off is made for him unless he does it);
  - Alyx's and Zachee's plans show the new steps and keep their setup steps.
- [ ] **Step 6: Wrap up.** Push the branch; update the docs, the ledger and memory (`hr-onboarding-automation.md` gets a wave279 line).
