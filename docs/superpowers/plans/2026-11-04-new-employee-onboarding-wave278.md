# New-employee onboarding experience (wave278) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new hire gets one short welcome email from the person who sent the offer and one personal Hub page that walks them through twelve setup steps, while the Hub itself adds them to their Google Groups, shared drives, weekly meeting and Slack onboarding channel.

**Architecture:** Extends wave275 (live): four new steps in onboard-run's STEPS table (`groups`, `drives` at Accept; `meeting` at booking; `channel` from the hourly job once the hire is in Slack), the welcome rewritten and sent through Gmail delegation as the offer's sender, the setup rundown in onboard-link and `/o/index.html` replaced by twelve steps plus an install mode with a QR code, and the card (parts275) showing the new steps, the leader decision and the welcome copies. Every rule that names a drive, group, meeting or title is an `app_config` setting HR can change.

**Tech Stack:** Supabase Postgres (PGlite tests), Deno edge functions (single `index.ts`, tested with the `test/w271rig.mjs` stubs), the vanilla JS page parts (`build/parts275`, `build/o/index.html`), Playwright drives, Google Directory, Drive and Calendar APIs through the existing `token(sub, scope)` helper, Slack Web API through the existing bot token.

**Spec:** `claude/04-11-26 - New-employee onboarding experience, design (wave278).md` (and its companion `claude/04-11-26 - Onboarding email rewrite and the Hub setup flow.md`, which holds the email text and the twelve steps word for word).

## Global Constraints

- Everything in wave275's Global Constraints holds (`docs/superpowers/plans/2026-11-02-streamlined-onboarding-wave275.md`): Steel's yes for every live step; no real email, Slack, Calendar, Drive or Google call from any test; practice applicants simulate and say so; never take functionality away; Toronto times through Intl; comments, RLS and `search_path ''` on every new object; Hub words: no "AI", no em dashes; English and French on every hire-facing and manager-facing text; 390 px; the server is the lock for every card action (`CARD_BY_MANAGER` + `wa275_manager_of`; HR or admin for the rest).
- The first password is read only in `runGoogle` and `sendWelcome`, put only into the hire's copies of the welcome; staff copies carry `(the password is in <first name>'s copy)` in its place; never in the database, change_log, step details, the card, tests or logs.
- Only new hires are added automatically: a step runs only for the flow's own hire, never touches other members, and the Hub never removes anyone from a group, drive, meeting or channel.
- The Google account is `first.last@welfareavenue.com` (the existing `suggestAddress`); the Hub profile is built on that address (unchanged).
- Branch `wave278-onboarding` from `wave275-release` (live). Functions deploy as stubs pinned to a pushed commit; the page through the staged, gated swap; `/o/index.html` by its own pinned fetch into `site_files` (it is not carried by the swap).

### Fixed values

| Name | Value |
|---|---|
| New step keys, in order after the existing ones | `groups` (at Accept, needs `google`), `drives` (at Accept, needs `google`), `meeting` (at booking, needs `roster`), `channel` (no `at`: run by the hourly job once the hire is in Slack, needs `roster`) |
| Step switches (`app_config`, default `on`) | `onboard_auto_groups`, `onboard_auto_drives`, `onboard_auto_meeting`, `onboard_auto_channel` |
| Leader rule | `onboard_leader_titles` = `director, lead, head, chief, manager`; a position title containing one of these words (whole word, any case) means leader; `hub_onboard_flows.leader boolean` stores the decision, set at Accept, changeable from the card |
| Groups rule (`onboard_groups` jsonb) | `{"all": ["org@welfareavenue.com"], "leaders": ["admin@welfareavenue.com", "directors@welfareavenue.com"], "by_department": {"marketing": ["marketing@welfareavenue.com"], "fundraising": ["fundraising@welfareavenue.com", "grants@welfareavenue.com"], "opsmtl": ["operations@welfareavenue.com"], "opsto": ["operations@welfareavenue.com", "toronto@welfareavenue.com"], "outreach": ["outreach@welfareavenue.com"], "hr": ["job@welfareavenue.com"], "finance": ["finance@welfareavenue.com"], "progdev": []}}`; a group that does not exist is reported, not failed ("no Toronto group yet") |
| Drives rule (`onboard_drives` jsonb) | `{"all": ["<Org's Files id>"], "leaders_all_except": ["<Accounting id>", "<Board of Directors id>"], "by_department": {"marketing": ["<Marketing & Web id>"], "fundraising": ["<Fundraising id>"], "opsmtl": ["<Operations id>"], "opsto": ["<Operations id>", "<Toronto Branch id>"], "hr": ["<Human Resources id>"], "progdev": ["<Program Development id>"], "finance": ["<Accounting id>"]}}`; role `fileOrganizer` is not used: members and leaders get `writer` (Drive's "Content manager"); leaders get every shared drive the service account can list except the two named; ids filled in at release from `drives.list` (Task 7) |
| Weekly meetings (`onboard_weekly_meetings` jsonb) | `{"<department>": "<recurring_event_id>"}` seeded from `hub_events` at release (fundraising: Steel picks one of the two) |
| Slack | `onboard_slack_join_link` (set, live), `onboard_slack_channel_link` = `https://join.slack.com/share/enQtMTI1MDM3NDg0MjE0NDQtMDUyMjMzYjY0ZDY5MDUyMjI2NzMzNTg5N2VlYTgzMjExYjU2MjUzMjdkZmVlMDk0Yzg2ODliY2QwYTg2ZWU2NQ`, `onboard_slack_channel_id` (HR pastes the channel id; empty = the step ends `hr_task` "no channel id") |
| Welcome sender | `hub_candidates.offer_sent_by text` = the Hub user's email who pressed Send (recruit-actions `who.email`); fallback order in `sendWelcome`: `offer_sent_by`, the candidate's `owner` email, `hub@welfareavenue.com`; Reply-To = the sender |
| Welcome recipients | To: the personal email and `wa_email`, always; Cc: the candidate's `owner` (recruitment) plus `hub_onboard_flows.welcome_cc text[]` (staff emails HR ticks on the card); staff copies are a second send with the password line replaced |
| Setup rundown keys, in order (`SETUP` in onboard-link) | `google`, `chrome`, `bookmarks`, `drive`, `groups`, `hub`, `slack`, `canva`, `academy`, `jd`, `weekly`, `phone`; ticks stored as `rd_<key>`; carried over from the old keys at release: `profile`→`chrome`, `bookmarks`→`bookmarks`, `hub`→`hub`, `slack`→`slack`, `canva`→`canva`, `academy`→`academy`, `drives`→`drive`, `weekly`→`weekly`; `loom` dropped |
| Chrome download links | Mac and Windows `https://www.google.com/chrome/`, Android `https://play.google.com/store/apps/details?id=com.android.chrome`, iPhone `https://apps.apple.com/app/google-chrome/id535886823` |
| Install page | `/o/<offer token>?install`: the add-to-home-screen steps for Safari and for Chrome, then the Slack app links (`https://slack.com/download`), then "Open the Hub" (`https://hub.welfareavenue.com/`); the QR on the setup page's `phone` step encodes that URL, drawn with `qrcode-generator` 1.4.4 from cdnjs as `build/src/225_wave225.seg` already does |
| Hub-signed-in tick | `rd_hub` set by the Hub page itself: on sign-in, the page calls `wa278_hub_seen()` (security definer, uses `auth.jwt() ->> 'email'`), which sets `rd_hub` on the flow whose `wa_email` matches |
| Walkthrough video | `onboard_setup_video` (`app_config`, empty until Steel records it): shown at the top of the setup page when set |
| notify kinds | none new |

## Review Focus

1. **A hire whose position title is "Community Manager" is a member in Steel's eyes but matches `manager`:** the card shows "added as a leader", HR changes it to member with one press, and the re-run adds nothing more and removes nothing (the Hub never removes). (Task 3, Task 6)
2. **The welcome sender's mailbox refuses delegation** (a personal Gmail owner, a suspended account): the email still goes, from hub@, the card says "sent from hub@ (the sender's mailbox could not send)", the password is still only in the hire's copies. (Task 4)
3. **The hire joins Slack with their personal address, not the Welfare Avenue one:** the channel step must still find them (by the personal email too) rather than wait forever. (Task 3)
4. **A group in the rule does not exist (toronto@) or the service account lacks the scope:** the step ends `hr_task` with the plain reason, the other groups are still added, and nothing is retried in a loop. (Task 3)
5. **Old ticks after the key change:** a hire who ticked `rd_profile` yesterday sees "Add the account to Chrome" ticked today, and the card's "N of 12" counts carried ticks once, never twice. (Task 1, Task 5)

---

## File structure

- `build/wa278a_onboarding.sql` (+ `build/wa278a_undo.sql`): settings, `offer_sent_by`, `leader`, `welcome_cc`, the tick carry-over, `wa278_hub_seen()`, `wa275_flow_row` additions. Tests `test/w278sql.sql` run by `test/w271sql.mjs`.
- `fn/recruit-actions/index.ts`: saves `offer_sent_by`. Tests `test/w271offer.test.mjs`.
- `fn/onboard-run/index.ts`: the four steps and their Google and Slack helpers in a new section "wave278"; the leader decision; `set_leader`, `recheck_access`, `set_welcome_cc`; the rewritten welcome and its delegated send. Tests `test/w271run.test.mjs`, rig `test/w271rig.mjs` (extend the fetch recorder with the Directory groups, Drive permissions, Calendar patch and Slack conversations URLs).
- `fn/onboard-link/index.ts` + `build/o/index.html`: the twelve `SETUP` steps, the `?install` mode, the QR. Tests `test/w271link.test.mjs`, `test/w275page.js`.
- `build/parts275/a_card.js` (+ `275_wave275.seg` re-assembled): the new step rows, leader line, Re-check, welcome copies picker. Tests `test/w275drive.js`, fixture `test/w275fx.js`.
- `build/parts272` or the sign-in wrapper: one call to `wa278_hub_seen` after sign-in (Task 5 names the file after reading how sign-in completes).
- `docs/02-11-26 - wave275 streamlined onboarding.md` gains a wave278 section at release; `docs/EDGE_FUNCTIONS.md` updated in Task 7.

---

### Task 1: Database (wa278a)

**Files:**
- Create: `build/wa278a_onboarding.sql`, `build/wa278a_undo.sql`, `test/w278sql.sql`
- Modify: `test/w271sql.mjs` (run the new file after wa275b, and the undo round trip), `test/w271schema.sql` (any live column the tests need)

**Interfaces:**
- Produces: `hub_candidates.offer_sent_by text`; `hub_onboard_flows.leader boolean` (null = not decided), `hub_onboard_flows.welcome_cc text[] default '{}'`; `app_config` keys from Fixed values (`onboard_auto_groups/drives/meeting/channel` on, `onboard_leader_titles`, `onboard_groups`, `onboard_drives` with placeholder ids `"<fill at release>"`, `onboard_weekly_meetings` `{}`, `onboard_slack_channel_link`, `onboard_slack_channel_id` empty); `wa278_hub_seen() returns boolean` (security definer, `search_path ''`, granted to authenticated: sets `setup_ticks.rd_hub` to now() on the flow whose `wa_email` = `lower(auth.jwt() ->> 'email')` and whose `rd_hub` is null, through `wa275_tick_set`; returns whether a flow was ticked); `wa275_flow_row` returns `leader`, `welcome_cc`, `offer_sent_by`, `owner_email`; the tick carry-over as one `update` over `setup_ticks` (rename `rd_profile`→`rd_chrome`, `rd_drives`→`rd_drive`, drop `rd_loom`, never overwriting an existing new key).

- [ ] **Step 1: Write the failing tests** in `test/w278sql.sql`: the columns exist with their defaults; `onboard_groups` parses and `onboard_groups->'by_department'->'fundraising'` holds grants@; `wa278_hub_seen()` as a signed-in `hire@welfareavenue.com` ticks `rd_hub` once and returns false the second time; as another email returns false and ticks nothing; the carry-over turns `{"rd_profile": "t1", "rd_loom": "t2", "rd_hub": "t3"}` into `{"rd_chrome": "t1", "rd_hub": "t3"}` and leaves a row that already has `rd_chrome` alone; `wa275_flow_row` returns the four new fields; the undo round trip restores wa275b's `wa275_flow_row` text and drops the columns and keys.
- [ ] **Step 2: Run** `node test/w271sql.mjs`. Expected: FAIL on the first missing column.
- [ ] **Step 3: Write the migration and undo** in wave275's style (idempotent, every object commented, `revoke` from public and anon, the function callable by `authenticated` only).
- [ ] **Step 4: Run** `node test/w271sql.mjs`. Expected: OK, twice, and the undo round trip.
- [ ] **Step 5: Commit** `wave278a: settings, the welcome sender and copies, the leader decision, the Hub-signed-in tick, the rundown key carry-over`.

### Task 2: The offer records who pressed Send

**Files:**
- Modify: `fn/recruit-actions/index.ts` (`offerSend`, the `card` update ~718-722)
- Test: `test/w271offer.test.mjs`

**Interfaces:**
- Consumes: Task 1's `offer_sent_by`.
- Produces: `hub_candidates.offer_sent_by = who.email` written in the same statement as `offer_sent_at` (so the trigger sees it); unchanged response shape.

- [ ] **Step 1: Write the failing test**: `offer_send` by `shima.butera@welfareavenue.com` writes `offer_sent_by: 'shima.butera@welfareavenue.com'` in the candidate update; a re-send keeps the first value (`offer_sent_by` set only when null).
- [ ] **Step 2: Run** `node --test test/w271offer.test.mjs`. Expected: FAIL (field absent).
- [ ] **Step 3: Implement**: add `offer_sent_by: c.offer_sent_by || who.email` to the `card` object.
- [ ] **Step 4: Run** the suite. Expected: PASS.
- [ ] **Step 5: Commit** `wave278: the offer records who pressed Send`.

### Task 3: Groups, drives, the weekly meeting and the Slack channel as steps

**Files:**
- Modify: `fn/onboard-run/index.ts` (STEPS ~183-196, `token` ~482, `remind` ~2440, the card actions switch ~2600; new section "wave278")
- Modify: `test/w271rig.mjs` (recorder routes for `admin.googleapis.com/admin/directory/v1/groups/<group>/members`, `www.googleapis.com/drive/v3/files/<id>/permissions?supportsAllDrives=true`, `www.googleapis.com/drive/v3/drives?pageSize=100`, `www.googleapis.com/calendar/v3/calendars/<cal>/events/<recurring_event_id>` PATCH, `slack.com/api/conversations.invite`, `slack.com/api/users.lookupByEmail`)
- Test: `test/w271run.test.mjs`

**Interfaces:**
- Consumes: Task 1's columns and settings; the existing `token(sub, scope)`, `setStep`, `HrTask`, `wa275_tick_set`, `cfg`; `wa_slack_ids` and notify's `users.lookupByEmail` pattern; the hub@ Slack bot token from `get_secret('SLACK_BOT_TOKEN')` (the name notify uses).
- Produces:
  - `leaderOf(title: string | null, titles: string): boolean` (whole-word, case-insensitive match against `onboard_leader_titles`); `decideLeader(ctx)` sets `flows.leader` at Accept when null, from the position's title, and logs "added as a leader/member" in the step detail.
  - `runGroups(ctx): Promise<string>`: the groups from `onboard_groups` for `all`, the department(s) of the roster row, and `leaders` when `leader`; one `POST /groups/{group}/members {email, role: 'MEMBER'}` each with scope `admin.directory.group.member` as `steel.macdonald@welfareavenue.com` (the subject `runGoogle` uses); 409 "already exists" counts as done; 404 "group not found" is reported in the detail ("no Toronto group yet") and the step ends `done` if every other add worked, `hr_task` if any add failed for another reason; detail lists the groups added; `setup_ticks.groups_added` = the addresses added (the rundown lists them).
  - `runDrives(ctx)`: the drive ids from `onboard_drives` (`all` + `by_department`, or for a leader every drive from `GET /drive/v3/drives` except `leaders_all_except`); one `POST /drive/v3/files/{id}/permissions?supportsAllDrives=true&sendNotificationEmail=false {type: 'user', role: 'writer', emailAddress}` each with scope `drive`; "already has access" counts as done; the detail lists the drive names; `setup_ticks.drives_added` = the names (the rundown lists them).
  - `runMeeting(ctx)`: the `recurring_event_id` for the roster department from `onboard_weekly_meetings`; `GET` the master event on the organizer's calendar (`hub_events.calendar_id`/`organizer`), `PATCH` attendees + the hire's `wa_email`, scope `calendar.events`, subject = the organizer when it is a welfareavenue.com address, else hub@; `sendUpdates=all`; missing mapping → `hr_task` "no weekly meeting set for <department>"; `setup_ticks.weekly_meeting` = `{summary, next_at}` for the rundown and the email.
  - `runChannel(ctx)`: finds the hire's Slack id by `wa_email` then by the personal email (`wa_slack_ids`, then `users.lookupByEmail`); if not found yet, returns `waiting` (the step stays pending; the hourly job retries for 14 days, then `hr_task` "has not joined Slack yet"); if found, `conversations.invite {channel: onboard_slack_channel_id, users}`; `already_in_channel` counts as done; `missing_scope` → `hr_task` naming the scope.
  - `remind` runs `runChannel` for flows with a pending `channel` step and `onboard_auto_channel` on.
  - Card actions (HR, admin or `wa275_manager_of`): `set_leader {flow_id, leader: boolean}` (writes the column, re-runs `groups` and `drives` through the existing retry path), `recheck_access {flow_id}` (re-runs `groups` and `drives`), `set_welcome_cc {flow_id, emails: string[]}` (staff emails only: each must be an active `team_members` email; refused before `welcome_sent_at`).
  - Practice flows: every new step ends `done` with the practice sentence and no fetch (the existing rule at ~320).

- [ ] **Step 1: Write the failing tests** (rig): `leaderOf('Fundraising Director')` true, `('Community Manager')` true, `('Coordinator')` false, `('Head of Grants')` true; Accept on a fundraising member adds org@, fundraising@, grants@ and no admin@; a leader also admin@ and directors@; a 404 on toronto@ ends done with "no Toronto group yet" in the detail; a 403 on one group ends hr_task naming it; drives for a member = Org's Files + the department's; for a leader = all listed drives minus the two; a weekly meeting patch adds the attendee and keeps the others; no mapping → hr_task; channel waits when the hire is not in Slack, invites by `wa_email`, then by the personal email, `already_in_channel` is done; `set_leader` by the hire's manager re-runs and adds the two leader groups; a plain member on another flow gets 403; `set_welcome_cc` refuses a non-staff email; practice makes no fetch (fetch log empty) for all four.
- [ ] **Step 2: Run** `node --test test/w271run.test.mjs`. Expected: FAIL (steps unknown).
- [ ] **Step 3: Implement** the section "wave278" with the signatures above, the STEPS rows, the `remind` extension and the three actions in `CARD_BY_MANAGER`.
- [ ] **Step 4: Run** the five node suites. Expected: PASS, count given.
- [ ] **Step 5: Commit** `wave278: groups, drives, the weekly meeting and the Slack channel as steps; the leader decision; Re-check and the welcome copies`.

### Task 4: The welcome email, rewritten and sent as the offer's sender

**Files:**
- Modify: `fn/onboard-run/index.ts` (`welcomeTemplate` ~1020-1053, `WELCOME_SLOTS`, `sendWelcome` ~1130-1180, `deliver` ~627, `LOGIN_OWN` ~935)
- Test: `test/w271run.test.mjs`, `test/w271fx.js` (expected texts)

**Interfaces:**
- Consumes: Task 1's `offer_sent_by`, `welcome_cc`, `owner`; Task 3's `setup_ticks.drives_added` and `weekly_meeting`; the existing `firstPassword()`, `fillWelcome`, `hubToken`-style delegation (`token(sub, SCOPE_GMAIL)`).
- Produces: the template text of the companion note, EN and FR, with slots `[first day]`, `[call]`, `[callmeet]`, `[one]`, `[onemeet]`, `[manager]`, `[new address]`, `[first password]`, `[video]`, `[setup]` (the personal link), `[jd]`, `[offer letter]` (`hub_candidates.offer_doc_url`), `[drives]` (one line per name from `drives_added`, or "HR will share your Drives" when empty); `sendWelcome` sends the hire's copy to `[personal, wa_email]` as the sender (delegation; fallback hub@ with the card note "sent from hub@: the sender's mailbox could not send"), then the staff copy to `[owner, ...welcome_cc]` with the password line replaced by `(the password is in <first>'s copy)`; both under the one `welcome_sent_at` claim; `steps.welcome.detail` says "sent to <personal> and <wa> from <sender>; copied to <n> staff"; the template editor on the card (`set_welcome`, `OLD_SLOTS`) keeps working for texts saved with the old slots.

- [ ] **Step 1: Write the failing tests**: the EN text equals the companion note's text with the fixture's values (first day = the call's date in words, two meetings only, no DocuSign line, no in-person line, the Hub link line, the documents block with three drive lines); FR likewise; the sender is `shima.butera@welfareavenue.com` when `offer_sent_by` is set, the owner when not, hub@ when neither; delegation refused → sent from hub@ and the detail says so; the staff copy contains `(the password is in Nia's copy)` and never the password; the hire's copy contains it exactly once; `welcome_sent_at` claimed once for both sends; a practice flow sends nothing.
- [ ] **Step 2: Run** `node --test test/w271run.test.mjs`. Expected: FAIL on the text.
- [ ] **Step 3: Implement**: the new `welcomeTemplate`, the two-send `sendWelcome`, the sender lookup `welcomeSender(c, f): Promise<{email: string, fallback: boolean}>`.
- [ ] **Step 4: Run** the suites. Expected: PASS.
- [ ] **Step 5: Commit** `wave278: the welcome email, rewritten and sent as the offer's sender to both addresses, staff copies without the password`.

### Task 5: The twelve-step setup page and the phone install page

**Files:**
- Modify: `fn/onboard-link/index.ts` (`SETUP` ~747, `ticksOf`, the offer GET's setup fields, the `setup_tick` POST, a new `install` GET mode), `build/o/index.html` (the setup view, the new `?install` view, the QR), `build/wa278a_onboarding.sql` only if a read is missing
- Modify: the Hub's sign-in completion (find the one place `startApp` resolves after `WA40_MINE` is set; add `supabase.rpc('wa278_hub_seen')` once per load, errors ignored) and re-assemble its segment
- Test: `test/w271link.test.mjs`, `test/w275page.js`, `test/w271page.js`

**Interfaces:**
- Consumes: the keys and texts from Fixed values and the companion note's step table; `setup_ticks.drives_added`, `groups_added`, `weekly_meeting` (Task 3), `canva_link`, `jd_url`, `onboard_slack_join_link`, `onboard_slack_channel_link`, `onboard_google_video`, `onboard_setup_video` (Task 1 adds the key, empty).
- Produces: `SETUP` with twelve entries `{key, title: {en, fr}, body: {en, fr}, links?: [{label: {en, fr}, url}]}`; the offer GET's `setup` object gains `drives: string[]`, `groups: [{address, purpose}]` (purpose from a fixed EN/FR map by address: org@ "everyone at Welfare Avenue", the department groups "your team's list", grants@ "grant work", admin@ "the leadership team", directors@ "the directors"), `weekly: {summary, nextAt} | null`, `channelLink`, `installUrl`, `video`; `GET /o/<token>?install` returns `{ok, install: {hub: 'https://hub.welfareavenue.com/', slack: 'https://slack.com/download'}}` (scanner-safe, saves nothing); the page's install view with the Safari and Chrome add-to-home-screen steps (EN/FR), then Slack, then Open the Hub; the setup view's `phone` step draws the QR of the install URL with `qrcode-generator` 1.4.4 (cdnjs, as 225 loads it) and shows the URL under it; `rd_hub` is read-only on the page (the Hub sets it).

- [ ] **Step 1: Write the failing tests**: link: the GET lists twelve steps in order with both languages, `drives` and `groups` from the ticks, `weekly` from the tick, `installUrl` ending in `?install`; `?install` GET saves nothing (snapshot unchanged) and returns the two links; `setup_tick` accepts the new keys and refuses `loom`; page: the twelve steps render in EN and FR at 390 px, the Chrome step shows four download links, the groups step shows one line per group with its purpose, the `phone` step shows a QR image and the install URL, the install view shows the Safari and Chrome steps and the two app links, `rd_hub` has no tick box.
- [ ] **Step 2: Run** `node --test test/w271link.test.mjs` and `cd test && node w275page.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the `SETUP` table, the GET fields, the install mode, the page views, the sign-in hook.
- [ ] **Step 4: Run** the link suite, `w275page`, `w271page`. Expected: PASS.
- [ ] **Step 5: Commit** `wave278: the twelve-step setup page, the phone install page with its QR, the Hub-signed-in tick`.

### Task 6: The card

**Files:**
- Modify: `build/parts275/a_card.js` (steps list, state lines, actions), `build/parts275/assemble.py` run, `build/src/275_wave275.seg`
- Test: `test/w275drive.js`, `test/w275fx.js`

**Interfaces:**
- Consumes: `wa275_flow_row`'s `leader`, `welcome_cc`, `offer_sent_by`, `owner_email`, the step rows for `groups`, `drives`, `meeting`, `channel`; Task 3's `set_leader`, `recheck_access`, `set_welcome_cc`.
- Produces: the four new step rows through wave271's `stepHtml` (Retry, "I did it" for `hr_task`); the line "Joining as a member" / "Joining as a leader" with "Change" (calls `set_leader`); "Re-check Drives and Groups" button; "Welcome email: from <sender>, copied to <owner> and <n> others" with "Add people" (a picker of active staff, calls `set_welcome_cc`, hidden once sent); the rundown count "N of 12 setup steps done"; the `channel` step shown as "Waiting for them to join Slack" while pending.

- [ ] **Step 1: Write the failing drive checks**: admin sees the four new rows on an accepted new-path card; the leader line and Change flips it and the rows show "re-running"; Re-check calls `recheck_access`; Add people lists staff only and saves; the count says "of 12"; the plain-member manager (Joy) can press Change and Re-check on her own hire and sees no other card; 390 px no sideways scroll; no console errors.
- [ ] **Step 2: Run** `CAND=<candidate> node test/w275drive.js`. Expected: FAIL.
- [ ] **Step 3: Implement** in `a_card.js`, re-assemble.
- [ ] **Step 4: Run** `w275drive`, `w271drive`, `w276drive`. Expected: PASS.
- [ ] **Step 5: Commit** `wave278: the card shows the access steps, the leader decision, Re-check, and the welcome copies`.

### Task 7: Release (only on Steel's yes)

**Files:**
- Modify: `docs/02-11-26 - wave275 streamlined onboarding.md` (a wave278 section), `docs/EDGE_FUNCTIONS.md`, `build/wa278a_onboarding.sql` (the real drive ids and the weekly meeting ids go in as the release's setting values, through `execute_sql`, not in the file)

- [ ] **Step 1: Probe** before anything: `directory-sync`'s scope probe for `admin.directory.group.member`, `admin.directory.group.readonly` and `drive` (granted on 02/11/26 per its notes; confirm), `GET /drive/v3/drives` as steel.macdonald to list the shared drive ids, `conversations.info` on the channel id Steel pastes with the bot token (`missing_scope` means Steel adds `channels:manage` / `groups:write` to the Hub's Slack app first), and the Hub page's sign-in on an iPhone (Safari, installed) and an Android phone (Chrome, installed) by Steel; report, and settle Review Focus 5's carry-over count on live data.
- [ ] **Step 2: Fill the settings** with the real ids (`onboard_drives`, `onboard_weekly_meetings` with Steel's choice for fundraising, `onboard_slack_channel_id`) and get Steel's yes.
- [ ] **Step 3: Release in order**: wa278a by pinned fetch (with the tick carry-over), recruit-actions, onboard-run, onboard-link, the Hub page (staged, gated), `/o/index.html` by pinned fetch; then the proof: a practice applicant end to end, then the next real hire (Samuel Aubrey if still before Accept, else the one after): the email from the sender's mailbox at both addresses with the copies, the twelve ticks, the groups and drives in their Google account, the weekly meeting invite, the channel once they join, both apps on the phone.
- [ ] **Step 4: Docs, ledger, memory; Steel records the walkthrough video** (steps 1 to 6) and HR pastes its link into `onboard_setup_video`. If Steel has said yes to the cleaned HR checklist (`claude/03-11-26 - HR setup checklist, cleaned and what to automate.md`), the same release sets the eight removed steps to `active = false` in `hr_setup_template` and rewords the two Slack steps, keeping every existing mark.
