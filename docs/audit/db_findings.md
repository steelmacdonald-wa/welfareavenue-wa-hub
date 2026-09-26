# Welfare Avenue Hub: database audit (public schema)

Date: 26 September 2026, about 06:00 UTC. Project: `zwnmulmnvopclzcvytce` (production).
Scope: the `public` schema (120 tables, 3 views, 106 functions), plus the things around it that shape it: the built page (`build/candidate.html`), all 54 live edge functions, 21 cron jobs, the migration history and the release notes.
Method: read-only. Catalog queries, `count(*)` per table, value distributions for code-like columns, grep and Python over the code. Nothing was changed.

Goal from the owner: the data should be easy for AI agents and developers to understand, with nothing needlessly repetitive.

## How to read this

Each finding has **Evidence** (numbers and where they came from) and a **Recommendation** tagged:

- **[OBVIOUS: safe to do now]**: additive or reversible, no code change needed, no business choice involved.
- **[DECISION: needs the owner]**: removes data, changes behaviour, or needs code changes (every rename does, because the page and the edge functions call tables by name).

Companion files in this folder:

- `db_inventory.json`: one object per table and view (rows, size, keys, references from the page, edge functions, SQL functions, triggers, views and cron, write activity, purpose, flags).
- `db_comments.sql`: draft `COMMENT ON` statements for every table and view, the non-obvious columns, and the functions the page or edge functions call. Applying it is the single most useful step for agents, and it is **[OBVIOUS: safe to do now]**.

No personal data is copied here. People are counted, never named.

---

## Summary: the ten findings that matter most

| # | Finding | Why it matters | Action |
|---|---------|----------------|--------|
| 1 | Almost nothing is documented: 5 of 120 tables, 5 of 1,341 columns and 0 of 106 functions have a comment. 18 tables and 1 view were created outside the migration history, including `dept_tasks`, `decisions`, `transcripts`, `dept_meta` and `dept_updates`. | An agent cannot learn the schema from the database or from the migrations. | Apply `db_comments.sql` [OBVIOUS] |
| 2 | `dept_tasks.status` contradicts `done` in 261 of the 324 done tasks (229 still say Open or New, 27 In progress). `status` has 26 distinct values, many of them free-text notes. `priority` is never true, while "priority" appears inside status text. | Any agent that reads `status` misreports open work. | Treat `done` as the truth now; clean and constrain `status` [DECISION] |
| 3 | People are identified four different ways: `team_members.id` (6 foreign keys), email (primary key or match key in about 25 tables), display name (at least 25 columns, plus JSON lists) and Slack ids or names (3 tables). 38 of 48 roster names are a single first name. In 122 tasks the `task_assignees` rows disagree with the `owner` text. | Joins by name are fragile and ambiguous; the same fact is stored twice and drifts. | Adopt `team_members.id` as the person key [DECISION] |
| 4 | The seven team codes live in `dept_meta` but no column has a foreign key or CHECK to them (34 team columns). Data has variants (`org` in 284 rows, `split-mtl-to`, "Leadership meeting", and labels such as "Ops MTL" in `decisions.area`). The code list is hardcoded 26 times in 10 sources, and code-to-label maps 27 times in 15 sources, because `dept_meta` has no label column. | Agents cannot tell which values are valid or what they mean. | Add `label` to `dept_meta` [OBVIOUS]; fix variants and add foreign keys [DECISION] |
| 5 | Backups sit inside the production database: 2 frozen tables in `public` and two whole schemas (`backup_p0_20260806`, 69 tables; `backup_p1_20260806`, 2 tables; 6.8 MB). The nightly `db-backup` job skips them. Three more tables are dead (`item_status`, `plaud_seen`, `wa_loom_stage`) and `wa_usage` never fills because the page never sends its calls. | Clutter that agents will read as live data. | Export, then drop [DECISION] |
| 6 | The word "event" means three unrelated things (`hub_events` = Google Calendar, `volunteer_events` = serving days, `fund_events` = fundraising calendar). There are two onboarding systems (`onboardings` and `wa_onboarding`), two settings stores (`app_config`, `hub_settings`) plus `staff_notes`, board access in four places, and "SOP" means two things. | Name collisions send agents to the wrong table. | Comments now [OBVIOUS]; consolidate or rename [DECISION] |
| 7 | Rows that AI created from a transcript are linked back to it only by text: `updated_by = 'AI: <transcript title>'` (325 tasks) and `added_by` (138 updates). Two SQL functions join on that text. About 20 `*_id` columns have no foreign key, yet only 1 orphan exists among them. | Renaming a transcript breaks the link; missing foreign keys hide relationships from agents. | Add foreign keys where orphans are 0 [OBVIOUS]; add `source_transcript_id` [DECISION] |
| 8 | Enum-like text columns have no CHECK: `hub_roles.role` (drives access), `event_roster.status` (Title Case in the data, lower case written by the confirm form), `goals.status` (7 values), `request_types.default_status` ("requested" and "Requested"), and more. `visibility` exists in 5 tables with no CHECK and has never been set. | Agents guess allowed values and casing. | Add CHECKs where code fixes the set [OBVIOUS]; normalise the rest [DECISION] |
| 9 | JSON hides structure and duplicates data: `event_roster.detail` copies volunteer contact data already in `volunteer_people` (465 phones, 421 emails, 147 addresses); `dept_requests.details` is a string in 6 rows and an object in 4; `hub_events.attendees` repeats `attendee_emails`; `projects.leads` and `allowed_people` hold names. | Duplicate personal data drifts and widens exposure. | Stop copying contact data [DECISION]; document shapes [OBVIOUS] |
| 10 | Confidentiality needs up to four checks on the same row (`confidential`, `board_only`, `visibility` plus `allowed_people`, and the restrictive `banked_at` policy). Edge functions use the service role and bypass row-level security, so each one re-implements filters: 14 functions were edited in wave132 only to leave out banked rows. 53 SECURITY DEFINER functions are executable by `anon`. | Every new job must remember every filter; drift leaks data or shows parked work. | Shared filtered views [DECISION]; revoke `anon` where not needed [DECISION] |

---

## 1. Tables that can go: backups, leftovers and dead tables

### 1.1 Backup copies inside the live database

**Evidence**
- `public.sop_template_backup_20260802` (94 rows, 72 kB) and `public.transcripts_backup_20260722` (62 rows, 664 kB). No primary key, no policies, no references anywhere (page, edge functions, SQL functions, views, cron). Created outside the migrations.
- Schema `backup_p0_20260806`: 69 tables, including copies of both backup tables above and a stage table `wa_stage_v69`. Schema `backup_p1_20260806`: `goals` and `site_files`. Together 6.8 MB. None has a primary key (the performance advisor lists all 71 under "no primary key").
- The nightly `db-backup` edge function already exports every public table to the private `db-backups` bucket with 30-day retention (2,272 objects today). It takes its table list from `wa_backup_tables()`, which excludes names containing `backup`, so these frozen copies are not in the storage backups.
- `transcripts_backup_20260722.department` still holds old long labels ("Marketing, Branding & Web" and similar), which is exactly the kind of value an agent should never learn from.

**Recommendation**
- Comment them as frozen copies now so no agent treats them as live. **[OBVIOUS: safe to do now]** (included in `db_comments.sql`).
- Export each to the `db-backups` bucket (one JSON file per table, same format as the nightly job), then drop the two public backup tables and both backup schemas. **[DECISION: needs the owner]**

### 1.2 Tables no code uses

| Table | Rows | Last row timestamp | References | Evidence |
|-------|------|--------------------|------------|----------|
| `item_status` | 7 | 30 Jun 2026 | none | Keys like `hr-6`, `dec-2`, `fund-8` (checkbox state of the original static dashboard). Created before the first tracked migration. |
| `plaud_seen` | 87 | 11 Jul 2026 | none | Ledger of Plaud recording ids from an earlier import. No page, function or job touches it. |
| `wa_loom_stage` | 0 | never | none | Staging table from a Loom import. The 26 Sep migration `drop_leftover_stage_tables` dropped two other stage tables (`wa_stage_pw`, `wa_stage_v69`) but not this one. |
| `wa_usage` | 0 | never | page calls 2 functions | See 1.3. |

**Recommendation**: drop `item_status`, `wa_loom_stage` and `plaud_seen` after confirming no outside tool (for example a Claude or Cowork routine) still writes `plaud_seen`. **[DECISION: needs the owner]**

### 1.3 `wa_usage` never fills

**Evidence**: the page calls `db.rpc('wa_usage_visit')` and `db.rpc('wa_usage_beat', ...)` in `w93Track()` without `await` or `.then()`. Supabase query builders only send a request when awaited, so neither call ever reaches the database. The table has 0 rows (1 insert and 1 delete ever, likely a test). `hub_visits` (wave116r) and `user_state` now cover the same need and do receive data.

**Recommendation**: remove `w93Track`, the two functions and the table. **[DECISION: needs the owner]** (or fix the call if daily seconds are still wanted).

### 1.4 Empty feature tables (keep, but label them)

Ten tables are empty because the feature is new or unused: `board_touchpoints`, `hub_announcements`, `hub_birthdays`, `hub_candidates`, `onboarding_help`, `request_notes`, `task_files`, `wa_access_requests`, `wa_change_requests`, `wa_notify_prefs`. `wa_rate_limits` is empty by design (short-lived counters). Their comments in `db_comments.sql` say "empty so far" so an agent does not conclude the feature is broken. **[OBVIOUS: safe to do now]**

### 1.5 Columns that are always NULL

100 columns are NULL in every row of a non-empty table (query in Appendix A). Many are fine (error fields, the bank columns added today). These ones mislead, because they look like real data an agent should use:

- `goals.owner`, `why`, `approach`, `success`, `progress`: always NULL in 28 goals. `goals.task_ids`: empty in every row.
- `hub_roles.tabs`: NULL in all 26 rows. It is the legacy per-person page list; access now comes from `hub_roles.profile` and `hub_access_profiles.pages`, but `wa_page_ok()` still reads `tabs` first.
- `visibility` and `allowed_people`: NULL in every row of `dept_tasks`, `dept_updates`, `decisions`, `transcripts` and `goal_wins` (and `mentions.visibility`), although RLS policies and two functions check them.
- `dept_tasks.parent_task_id` (subtasks never used), `dept_tasks.priority` (false in all 568 rows).
- `event_roster.confirm`, `confirm_status`, `confirmed_at`, `recipe_id`; `hub_mail.team_state`, `team_done_by`, `team_done_at`, `assignee`, `request_id`, `amount`, `due_date`, `meeting_date`, `notify`.
- `sop_event_steps.done_at`, `done_by`, `note`, and `done` is false in all 2,291 rows: the event checklist has never been ticked. `hr_setup_steps.done_at` and `done_by` likewise.
- `volunteer_inventory.qty_remaining`, `reorder_needed`; `agendas.purpose`, `summary`; `fund_events.lead`, `created_by`.

**Recommendation**: comment each as "not used yet" or "legacy" now **[OBVIOUS: safe to do now]**; drop the legacy ones (`hub_roles.tabs` once `wa_page_ok()` stops reading it, `goals.task_ids`, `dept_tasks.priority` if `flag` is the real marker) **[DECISION: needs the owner]**.

---

## 2. Duplicated concepts, and which table is the source of truth

### 2.1 People and identity

**Evidence**

| Where a person appears | Key used | Rows |
|------------------------|----------|------|
| `team_members` (staff and board roster) | `id`, plus `name` and `email` | 48 (42 active) |
| `hub_directory` (Google Workspace mirror) | `email`, `member_id` (no foreign key) | 48 |
| `hub_roles` (access) | `email` | 26, of which 4 emails are not on the roster |
| `board_members` (directors) | `id`, `emails[]` | 8 |
| `board_circle`, `board_viewers`, `wa_hr_access` (access lists) | `email` | 6, 2, 6 |
| `user_state`, `hub_visits`, `wa_onboarding`, `hub_birthdays`, `hub_connections`, `wa_notify_prefs`, `wa_policy_signoffs`, `wa_timeoff`, `wa_discipline`, `wa_access_requests`, `hub_checkins`, `academy_awards`, `training_progress` | `email` (often with a copy of the name) | |
| `wa_slack_ids` (email to Slack id), `wa_slack_names` (name to Slack id), `wa_checkin_scope` (Slack id to name) | Slack id | 20, 33, 9 |
| `slack_hours` | `slack_name` and `member_name` (text) | 302 |
| Free-text person columns (owner, lead, person, person_name, assignee, raised_by, with_person and about 20 `*_by` columns) | display name or email or a system label | see section 4 |

- 38 of 48 roster names are one word (a first name). 12 roster rows have no email.
- `task_assignees` (344 tasks) and `dept_tasks.owner` (text) both say who owns a task. 224 tasks have an owner name but no assignee row, and in 122 tasks an assignee's name differs from the owner text. 32 owner values name several people in one string.
- `event_roster.person_name` copies `volunteer_people.full_name` (20 rows already differ) and `event_roster.detail` copies phone, email and address (see section 6).

**Source of truth**: `team_members.id` for staff and board people; `volunteer_people.id` for volunteers; `hub_directory` is a mirror of Google and should stay one; `hub_roles` is access, not identity.

**Recommendation**
- Say this in comments now. **[OBVIOUS: safe to do now]**
- New tables reference `team_members.id` (`member_id`), never a name. Existing name columns get an id column next to them, filled by matching, then the name column becomes display only. Start with `dept_tasks.owner` (use `task_assignees` as the truth), `sop_event_steps.owner`, `mentions.person`, `training_progress.person_name`, `academy_awards.person_name`, `projects.leads`. **[DECISION: needs the owner]**
- Fold `wa_slack_ids` and `wa_slack_names` into one `slack_user_id` column on `team_members` (plus an alias list if needed). **[DECISION: needs the owner]**

### 2.2 Access is defined in many places

**Evidence**: who may see what is decided by `hub_roles.role`, `hub_roles.profile` with `hub_access_profiles.pages`, the legacy `hub_roles.tabs`, `board_members.emails`, `board_circle`, `board_viewers`, `wa_hr_access`, the email domain (`is_wa_staff()`), three founder emails hardcoded in `wa72_founder_guard()`, and further hardcoded emails in the policies of `slack_hours`, `wa_checkin_scope` and `wa_drive_docs` (the last two check the domain directly instead of calling `is_wa_staff()`). Founder emails are also hardcoded in 20 code sources (38 times in the page).

Board access alone has four lists: `board_members` (directors), `board_circle` (board-only confidentiality tier), `board_viewers` (read-only viewers), plus leaders and admins through `wa_board_leader()`.

**Recommendation**: comments now explaining each list **[OBVIOUS]**; longer term one `access_grants` style table or at least one function per question ("is staff", "can see board", "can see board-only") used by every policy, with no emails inside policies or functions **[DECISION]**.

### 2.3 Events, meetings and calendars

| Table | What it is | Source of truth |
|-------|------------|-----------------|
| `hub_events` | Google Calendar events of hub@welfareavenue.com | Google Calendar (mirror, refreshed every 30 minutes) |
| `volunteer_events` | Sunday serving days and other volunteer events | the Hub |
| `fund_events` | fundraising events calendar 2026-27 | the Hub |
| `board_meetings` | board meeting register | the Hub |
| `agendas.meeting_date`, `transcripts.meeting_date` | the meeting an agenda or transcript belongs to | the Hub (no link to `hub_events`) |
| `dept_meta.meeting_schedule`, `calendar_match`, `meeting_cache` | per-team meeting text, match words and a cache of upcoming meetings | derived from `hub_events` by `calendar-sync` |

**Recommendation**: comments now **[OBVIOUS]**. When a rename window opens: `calendar_events` (for `hub_events`), `serving_events` or keep `volunteer_events`, `fundraising_events` (for `fund_events`) **[DECISION]**. Consider replacing `dept_meta.meeting_cache` with a query on `hub_events` **[DECISION]**.

### 2.4 Tasks and to-do lists

`dept_tasks` is the source of truth for work. Other to-do shaped tables:

- `board_items`: board to-dos with free-text `owner` and a free-text `due` ("due" is not a date), and an optional `task_id` to `dept_tasks` (3 rows use it).
- `sop_event_extras`: per-event to-dos from transcripts with `owner`, `due_date`, `done` (15 rows). These are tasks with an event attached.
- Three template-and-instance checklists with the same shape: `sop_template` and `sop_event_steps`, `onboarding_template` and `onboarding_steps`, `hr_setup_template` and `hr_setup_steps`. The pattern is fine; the three copies of the propagate triggers are the repetition.
- `dept_requests` (requests with status, assignee and done), `task_due_suggestions` and `request_suggestions` (AI proposals awaiting a decision; all 28 due suggestions are still pending).
- `item_status` (legacy, see 1.2).

**Recommendation**: comments now **[OBVIOUS]**; consider moving `sop_event_extras` into `dept_tasks` with an `event_id`, and giving `board_items` a real date **[DECISION]**.

### 2.5 Two onboarding systems with almost the same name

- `onboardings`, `onboarding_steps`, `onboarding_template`, `onboarding_update_acks`, `onboarding_help`, `hr_setup_*`: HR onboarding plan for a new team member (by `member_id`).
- `wa_onboarding`: the "first steps in the Hub" checklist for any signed-in person (by email, steps in JSON).

**Recommendation**: comments now **[OBVIOUS]**; rename `wa_onboarding` to something like `hub_first_steps` **[DECISION]**.

### 2.6 Goals, KPIs and priorities

Goal-like data lives in `goals` (source of truth for goals), `metrics` (KPIs per team), `dept_meta.priorities` (JSON list per team, written by AI), `hub_settings` key `fund_goals` (JSON), `goal_ideas.payload` (AI suggestions per team) and `goals.suggestions` (AI suggestions per goal, same `{note, generated, suggestions}` shape). Fiscal periods are written three ways: `goals.quarter` ("Q4 FY2026", "FY2027"), `finance_budgets.fiscal_year` ("FY26") and `fund_events.plan` ("2026-27"); `board_home()` computes the fiscal year from 1 October.

**Recommendation**: comments now **[OBVIOUS]**; pick one fiscal period format (for example `fiscal_year int` plus `quarter smallint`) **[DECISION]**.

### 2.7 Notes, updates and logs

- Notes and comments: `task_comments`, `goal_comments`, `request_notes`, `board_touchpoints`, `social_notes` (AI insights), `staff_notes` (a key-value store, see 2.8), `hub_knowledge`, `hub_announcements`, `dept_updates`, and the text columns `dept_meta.read` and `dept_meta.progress`. Each is scoped to one parent, which is fine; the naming ("notes") is what confuses.
- `change_log` (2,509 rows) is two things: an audit trail of edits, and a run log for jobs (`site_deploy`, `hours_pull`, `db_backup`, `drive_pull`, `edge_function`, `calendar_sync`, `repo_sync` and more; 44 entity types in all).
- The same entity is logged under two names: a `dept_tasks` row is `dept_task` (752 rows; page and SQL functions) or `task` (185 rows; page and 4 edge functions); a roster row is `member` (55) or `team_member` (48).
- Sync state lives in three singleton tables (`hub_calendar_state`, `hub_mail_state`, `hub_directory_state`), in `wa_health_checks`, and in `app_config` key `slack_last_pull`.

**Recommendation**
- Standardise `entity_type` to the table name (`dept_tasks`, `team_members`) and backfill the old spellings. **[DECISION: needs the owner]** (code change in the page and 4 functions).
- Move job runs to a `job_runs` table (job, started_at, ok, summary) or at least give them a distinct `entity_type` prefix such as `job:`. **[DECISION: needs the owner]**

### 2.8 Settings are stored three ways

- `app_config` (12 keys, text values): site URL, repo, Netlify id, Slack digest settings, a cached Quo phone id, the WA writing style, an email template, `slack_last_pull` (job state). Code also reads `finance_ai_guidance`, which is not present.
- `hub_settings` (5 keys, JSON values): `team_inbox`, `fund_goals`, `hours_minimums`, `inventory_share` (holds a share token and expiry), `board`. `social-publish` also reads `content_calendar`, which is not present.
- `staff_notes` (1 key, `k` and `v` columns): the shared Quo login (a credential; see 11.5).
- Plus `hub_access_settings` (singleton) and per-team settings in `dept_meta`.

**Recommendation**: comments listing each key and its reader now **[OBVIOUS]**; merge into one `settings` table with JSON values and a `description` column, and move credentials out **[DECISION]**.

### 2.9 "SOP" means two things

- `sop_template`, `sop_event_steps`, `sop_roles`, `sop_shots`, `sop_event_extras`: the Sunday serving run-sheet imported from one ClickUp list.
- `trainings` rows with `kind = 'sop'` (6 rows, category "Our SOPs"): SOP lessons in the Training Academy. `fund_events.sop_training_id` points to these, not to `sop_template`.

**Recommendation**: comments now **[OBVIOUS]**; a `serving_` prefix for the run-sheet tables in a rename window **[DECISION]**.

### 2.10 Ledgers that could be columns

`transcript_request_scans` (one row per transcript: scanned_at, n_found) could be two columns on `transcripts`. **[DECISION]**

### 2.11 Duplicate helper functions

`is_wa_admin()` and `is_hub_admin()` have the same body (role = admin in `hub_roles`). `is_wa_leader()` and `is_hub_leader()` are also identical. Policies use both names.

**Recommendation**: comment each pair as aliases now **[OBVIOUS]**; later keep one name and make the other a wrapper, then remove it **[DECISION]**.

---

## 3. Team (department) codes

**Canonical codes** (the 7 rows of `dept_meta`, also the keys of `hub_access_profiles` and the list in `bank_add_task()`):

| Code | Meaning (from code label maps) |
|------|--------------------------------|
| `opsmtl` | Operations Montreal |
| `opsto` | Operations Toronto |
| `progdev` | Program Development (split from opsmtl in wave116) |
| `marketing` | Marketing |
| `fundraising` | Fundraising and Finances |
| `hr` | HR and People |
| `board` | Board and Governance |

**Evidence**

- 34 columns hold a team: `department` in 29 tables (including the primary keys of `dept_meta` and `goal_ideas`), plus `academy_paths.dept`, `board_committees.depts[]`, `hub_access_profiles.team`, `hub_shoutouts.team` and `decisions.area`. None has a foreign key or CHECK.
- Values outside the canonical seven:

| Column | Value | Rows | Note |
|--------|-------|------|------|
| `finance_transactions.department` | `org` | 281 | organisation-wide costs; `finance-import` allows `org` and has no `progdev` |
| `goals.department` | `org` | 3 | organisation goals |
| `clickup_sources.department` | `split-mtl-to` | 1 | a routing instruction ("split by list name"), not a team |
| `transcripts.department` | "Leadership meeting" | 1 | a meeting type, not a team |
| `mentions.department` | "Leadership meeting" | 2 | copied from the transcript |
| `decisions.area` | "Fundraising", "Ops TO", "HR", "Ops MTL", "Board", "Grants", "Marketing" | 21 (all rows) | labels, not codes; "Grants" is a workstream |

- Other team-ish columns use their own vocabularies: `projects.workstream` (free labels: "Fundraising events", "Donor program", "Grants"), `dept_tasks.subsection` (11 labels), `trainings.category` and `training_categories.name` (labels such as "Marketing", "Operations"), `hub_directory.org_unit` (Google org unit paths).
- `dept_meta` has no label, sort or Slack channel column, so every consumer keeps its own copy: literal lists of team codes appear 26 times in 10 sources (16 in the page, `finance-import`, `bank_add_task()` and others), and code-to-label maps appear 27 times in 15 sources. `apply_transcript_result()` holds one more mapping, from old long labels to codes with `ilike` patterns.
- `slack_sources` still lists an archived channel (noted in the 25 Sep release notes).

**Recommendation**
1. Add `label`, `short_label`, `sort` and `slack_channel` to `dept_meta` (or create a `teams` table with the same seven codes) and comment it as the canonical list. **[OBVIOUS: safe to do now]** (additive).
2. Decide what `org` is. Either add it as an eighth code ("Organisation-wide") or move those rows to a separate `scope` column. **[DECISION: needs the owner]**
3. Fix the variants: `decisions.area` to codes (keep "Grants" as a workstream), "Leadership meeting" to a `meeting_kind` column on `transcripts`, `split-mtl-to` to a separate `split_rule` column on `clickup_sources`. **[DECISION: needs the owner]**
4. Then add a foreign key from every team column to the canonical list, and rename `dept`, `depts`, `team` and `area` to `department` (or `departments` for arrays) in a rename window. **[DECISION: needs the owner]**
5. Make code read labels from the table instead of 27 local maps. **[DECISION: needs the owner]**

---

## 4. References stored as text instead of ids

### 4.1 People named in free text

Share of values that exactly match a roster display name (`team_members.name`):

| Column | Non-null | Distinct | Match a roster name | Note |
|--------|----------|----------|---------------------|------|
| `dept_tasks.owner` | 568 | 72 | 490 | 32 values name several people |
| `sop_event_steps.owner` | 528 | 6 | 528 | |
| `slack_hours.member_name` | 299 | 28 | 299 | `slack_name` is the key; 3 rows unmatched |
| `mentions.person` | 71 | 31 | 69 | RLS matches it by name (`wa_name_matches`) |
| `training_progress.person_name` | 77 | 32 | 77 | part of the unique key |
| `event_roster.person_name` | 503 | 133 | 19 | volunteers; `person_id` exists and 16 rows lack it |
| `decisions.owner` | 12 | 2 | 6 | |
| `board_items.owner` | 16 | 5 | 6 | |
| `projects.leads` (JSON array) | 25 | | | names; used by `wa_leads_project()` |
| `agendas.created_by` | 13 | 2 | 0 | used by RLS through `wa_name_matches` |

"Who did it" columns mix formats inside one column: `change_log.changed_by` (2,509 rows, 188 distinct values) holds 106 emails, 15 exact roster names, and otherwise job and system labels (such as "db-backup v1", "notify v7", "automation", "weekly cron", "AI: ...") and names in other spellings; `dept_tasks.updated_by` mixes names and "AI: ..." labels; `org_positions.updated_by` is "wave133 seed"; `hub_roles.updated_by`, `ai_routes.updated_by` and `hub_directory.placed_by` are emails; `wa_actor_name()` writes a roster name, falling back to the email.

**Recommendation**
- Standardise actor columns on email (what `auth.jwt()` gives, so it can be a default) or on `member_id`, and keep system writers as a separate `source` value. **[DECISION: needs the owner]**
- Document the formats per column now (done in `db_comments.sql`). **[OBVIOUS: safe to do now]**

### 4.2 AI provenance hidden in `*_by` text

**Evidence**: 325 of 568 tasks have `updated_by` starting with "AI: " and 138 of 177 updates have `added_by` starting with "AI: ". The value is `'AI: ' || transcripts.title`. Two triggers use it as a join key: `wa_stamp_restricted()` copies a transcript's visibility to rows where `added_by = 'AI: ' || title`, and `wa69_general_link()` links tasks to a team's general project the same way. Renaming a transcript, or two transcripts with the same title, breaks or crosses these links. `updated_by` also changes on every later edit, so the provenance is lost as soon as a person edits the task.

**Recommendation**: add `source_transcript_id bigint references transcripts(id)` to `dept_tasks`, `dept_updates` and `decisions`, backfill it from the text, and switch the two triggers to use it. **[DECISION: needs the owner]**

### 4.3 `*_id` columns without a foreign key

Orphans counted for each (rows with a value / rows pointing nowhere):

| Column | Points to | With value | Orphans | Suggested ON DELETE |
|--------|-----------|------------|---------|---------------------|
| `task_comments.task_id` | `dept_tasks.id` | 169 | 0 | cascade |
| `task_due_suggestions.task_id` | `dept_tasks.id` | 28 | 0 | cascade |
| `task_due_suggestions.transcript_id` | `transcripts.id` | 28 | 0 | set null |
| `mentions.transcript_id` | `transcripts.id` | 71 | 0 | cascade |
| `goal_wins.transcript_id` | `transcripts.id` | 19 | 0 | set null |
| `request_suggestions.transcript_id` | `transcripts.id` | 9 | 0 | cascade |
| `request_suggestions.request_id`, `target_request_id` | `dept_requests.id` | 5, 0 | 0 | set null |
| `request_suggestions.type_key` | `request_types.key` | 9 | 0 | none (restrict) |
| `sop_event_extras.transcript_id` | `transcripts.id` | 15 | 0 | set null |
| `transcript_request_scans.transcript_id` | `transcripts.id` | 126 | 0 | cascade |
| `onboarding_update_acks.onboarding_id` | `onboardings.id` | 2 | 0 | cascade |
| `onboarding_update_acks.template_id` | `onboarding_template.id` | 2 | 0 | cascade |
| `sop_template.parent_id` | `sop_template.id` | 86 | 0 | set null |
| `hub_roles.profile` | `hub_access_profiles.key` | 16 | 0 | set null |
| `board_items.task_id` | `dept_tasks.id` | 3 | 0 | set null |
| `fund_events.sop_training_id` | `trainings.id` | 9 | 0 | set null |
| `hub_shoutouts.member_id` | `team_members.id` | 4 | 0 | set null |
| `hub_directory.member_id` | `team_members.id` | 37 | **1** | set null (fix the orphan first) |
| `hub_directory.deactivated_member_id` | `team_members.id` | 1 | 0 | set null |
| `dept_requests.mail_id`, `hub_candidates.mail_id` | `hub_mail.id` | 0 | 0 | set null |
| `hub_mail.request_id`, `hub_candidates.request_id` | `dept_requests.id` | 0 | 0 | set null |
| `dept_tasks.bank_project_id` | `projects.id` | 0 | 0 | set null |
| `trainings.category` | `training_categories.name` | 93 | **6** ("Our SOPs" is missing from the categories) | restrict |
| `ai_calls.task` | `ai_routes.task` | 135 | 11 (test calls) | none: keep as a log |

Id lists that cannot carry a foreign key: `agenda_items.task_ids[]` (229 ids, 0 orphans), `goals.task_ids[]` (all empty), `hub_checkins.closed_task_ids[]`, `board_committees.member_ids[]` (7 ids, 0 orphans), `sop_roles.step_ids` (JSON). Join tables would make these visible to agents.

**Recommendation**
- Add the foreign keys with zero orphans, using `NOT VALID` then `VALIDATE CONSTRAINT`, with the ON DELETE shown. Tables are tiny, so locking is not a concern. **[OBVIOUS: safe to do now]**
- Fix the one `hub_directory` orphan and add "Our SOPs" to `training_categories` first, then add those two. **[OBVIOUS: safe to do now]**
- Replace id arrays with join tables (`agenda_item_tasks`, `board_committee_members`, `sop_role_steps`) when those features are next touched; drop `goals.task_ids`. **[DECISION: needs the owner]**

### 4.4 Keys built on display names

- `training_progress` is unique on `(training_id, person_name)` and `academy_awards` on `(person_name, award)`. Both tables also have an `email` column, filled in only 16 of 77 and 16 of 16 rows. A renamed person loses their progress; two people with the same first name would share it.
- `board_members` is unique on `name`.
- `academy_paths` is joined by `trainings.path_group = academy_paths.name` (all 8 path groups match `name`), although `academy_paths.key` exists and `name` and `title` differ in 3 of 8 rows.

**Recommendation**: add `member_id` (or at least make `email` required) and move the unique keys to it; join trainings to paths by `key` through a `path_key` column. **[DECISION: needs the owner]**

---

## 5. Status and enum columns

### 5.1 `dept_tasks`: `done` and `status` disagree

**Evidence**

| done | status looks like | Tasks |
|------|-------------------|-------|
| true | Done (or "Hired...") | 63 |
| true | Open or New | 229 |
| true | In progress | 27 |
| true | something else | 5 |
| false | Open or New | 211 |
| false | In progress | 30 |
| false | something else | 3 |

- `status` has 26 distinct values: "Open" (422), "Done" (60), "In progress" (52), "Waiting", "Blocked", dated variants such as "Open (Jun 25)" and "New (Jun 30)", and more than a dozen one-off free-text notes (some name people).
- `closed_at` always agrees with `done` (trigger `set_task_closed_at`), so `done` plus `closed_at` is the reliable state.
- `priority` is false in every row, while two rows say "Open, priority" in `status`. `flag` (44 rows true) is the marker the page and the Slack digest actually use.
- `reason_category` has its own vocabulary (4 values) shared with `decisions.reason_category` (6 values, including "Board Strat", which the tasks never use).

**Recommendation**
- Comment now: "`done` is the source of truth; `status` is a legacy free-text label". **[OBVIOUS: safe to do now]**
- Backfill `status` from `done` (Done when done), move the free-text notes to a `status_note` column, then constrain `status` to a short list (for example open, in_progress, waiting, blocked, done). **[DECISION: needs the owner]**

### 5.2 Code-like text columns without a CHECK constraint

Existing CHECKs are good where they exist (for example `agendas.status`, `board_items.status`, `org_positions.status`, `wa_timeoff.status`, `wa_photos`). These have none:

| Column | Values seen (rows) | Recommendation |
|--------|--------------------|----------------|
| `hub_roles.role` | member 10, admin 7, blocked 5, leader 4; `viewer` is handled by code | CHECK in (admin, leader, member, viewer, blocked) **[OBVIOUS]** |
| `sop_template.phase` | t_minus_2w, t_minus_1w, week_of, event_day, post_event (default anytime) | CHECK matching `sop_phase_due()` **[OBVIOUS]** |
| `onboarding_template.section` | WEEK 1 to WEEK 4, 60 DAYS | CHECK matching `onb_due()` **[OBVIOUS]** |
| `training_progress.status` | assigned, started, done | CHECK **[OBVIOUS]** |
| `finance_statements.status` | processing, done, failed | CHECK **[OBVIOUS]** |
| `social_posts.platform`, `social_daily.platform` | instagram, facebook, linkedin, ga4 | same CHECK as `social_accounts.platform` **[OBVIOUS]** |
| `social_posts.source`, `social_daily.source` | api, csv | CHECK **[OBVIOUS]** |
| `ai_routes.mode` | chain, jev | CHECK **[OBVIOUS]** |
| `task_comments.source` | transcript, slack, manual | CHECK **[OBVIOUS]** |
| `hub_connections.provider` | slack, google_calendar, google_drive | CHECK **[OBVIOUS]** |
| `trainings.kind` | tour, video, read, doc, sop, lesson | CHECK **[OBVIOUS]** |
| `wa_brand_assets.kind` | doodle, e_component, logo_primary, logo_secondary, logo_lockup (listed in the table comment) | CHECK **[OBVIOUS]** |
| `event_roster.status` | Confirmed 239, TBD 136, Unavailable 62, Waiting For Response 57; `volunteer_confirm_submit()` writes lower-case "confirmed" or "declined" (and "needs attention" into `confirm_status`, which is still NULL in every row); readers use `ilike` or `lower()` | pick one casing and list, then CHECK **[DECISION]** |
| `event_roster.role` | server, cook, driver, photographer, dishwasher, team_leader, community_debrief (page targets also name community_talker) | CHECK after confirming the list **[DECISION]** |
| `goals.status` | in progress 15, not started 7, closed 2, in review, delayed, incomplete, on track (ClickUp vocabulary via goal-sync) | map to a short list **[DECISION]** |
| `request_types.default_status` and `dept_requests.status` | "requested" and "Requested", "position requested", "pending approval", "recruited", "interviewing", "hr onboarding", "closed task"; each type lists its own statuses in `request_types.statuses` (40 distinct across types, with casing twins such as "Done"/"completed", "In progress"/"in progress", and a typo, "appproved") | normalise casing and fix the typo; keep per-type lists but validate against them **[DECISION]** |
| `volunteer_events.status` | completed, planned, cancelled, "in progress" (space) | CHECK after choosing `in_progress` or "in progress" **[DECISION]** |
| `content_drafts.status` ("draft", "in review"), `content_posts.status`, `hub_mail.kind`, `hub_mail.status`, `quo_messages.status`, `onboardings.status`, `social_accounts.status` | few values each | CHECK once the full lists are confirmed from code **[DECISION]** |
| `visibility` in `dept_tasks`, `dept_updates`, `decisions`, `transcripts`, `goal_wins`, `mentions` | never set; `wa_sees_restricted()` understands NULL, '' or 'department', 'leadership', 'private' | CHECK in (department, leadership, private) **[OBVIOUS]** |
| `wa_discipline.level` | two HR levels in use | CHECK with HR's list **[DECISION]** |

### 5.3 The same idea spelled differently across tables

- In progress: "In progress" (`dept_tasks`), "in progress" (`goals`, `volunteer_events`), `in_progress` (`board_items`).
- Seasons: "Winter" (`volunteer_events`), "winter-2027" (`fund_events`), "winter" (`wa_photos`).
- Fiscal periods: see 2.6.
- Done markers: `done` (8 tables), `status`, `closed_at`, `completed_at` (`onboardings`), `done_at` (steps), `team_state` (`hub_mail`, unused), `confirm_status`.
- Soft delete and switches: `active` (9 tables), `enabled` (4), `archived`, `suspended`, `dismissed`, `skipped`, `deleted_at` (`hub_directory`), `status = 'archived'` (`wa_photos`), `role = 'blocked'` (`hub_roles`).

**Recommendation**: adopt one vocabulary (lower-case snake_case codes; `is_active` for switches; `done_at` for completion) for new work and during clean-ups. **[DECISION: needs the owner]**

---

## 6. JSON columns that hide structure

| Column | Shape found | Issue | Recommendation |
|--------|-------------|-------|----------------|
| `event_roster.detail` | object with phone (465 rows), email (421), address (147), pickup_dropoff, ingredients_delivered, type_of_food | copies volunteer contact data that belongs in `volunteer_people`, per event row | move contact fields back to `volunteer_people`; keep only per-event facts (pickup, ingredients) **[DECISION]** |
| `dept_requests.details` | string in 6 rows, object in 4 (keys are form labels such as "Role title", "Needed by date") | two types in one column; keys are display labels | always an object keyed by `request_types.fields[].name` **[DECISION]** |
| `hub_events.attendees` | array of {email, name, status, optional, organizer} | repeats `attendee_emails` (text[] with a GIN index, used by `calendar_my_meetings()`) | document now **[OBVIOUS]**; keep one **[DECISION]** |
| `projects.leads` | array of names (0 to 2) | people by name; `wa_leads_project()` matches names | array of `member_id` or a `project_leads` table **[DECISION]** |
| `allowed_people` (5 tables) | never set | would hold names matched by `wa_name_matches()` | use member ids if the feature is kept **[DECISION]** |
| `hub_access_profiles.pages` | object: page key to "all", "lead" or "none" (30 or more page keys) | central to access, undocumented | document the page keys and values **[OBVIOUS]** |
| `hub_access_profiles.can` | array of strings | undocumented | document **[OBVIOUS]** |
| `clickup_weekly.status_counts` | object keyed by raw ClickUp status labels (30+ variants, including "to do " with a trailing space) | agents cannot aggregate reliably | map to canonical statuses in `clickup-pull` **[DECISION]** |
| `goal_ideas.payload`, `goals.suggestions` | both {note, generated, suggestions} (goals also `covered`) | same AI shape in two places | document **[OBVIOUS]** |
| `dept_meta.priorities`, `calendar_match` | arrays of strings | fine | document **[OBVIOUS]** |
| `dept_meta.meeting_cache` | array of {title, start, link} | cache of `hub_events` | document **[OBVIOUS]** |
| `hub_settings.value` | different object per key | undocumented per key | document per key **[OBVIOUS]** |
| `trainings.body` | tour {tab, tour}, sop {phases, roles, dayof, money, ...}, lesson {chapters, quiz, ...} | shape depends on `kind` | document per kind **[OBVIOUS]** |
| `wa_brand.meta` | different keys per `category` | expected | document **[OBVIOUS]** |
| `request_types.fields`, `statuses` | [{name, label, type, required}], [string] | fine | document **[OBVIOUS]** |
| `sop_roles.step_ids` | array of `sop_template.id` strings | a hidden foreign key | join table **[DECISION]** |
| `team_members.responsibilities` | array of strings | fine | document **[OBVIOUS]** |
| `hub_mail.filed` | object {type, id, title, department, site, ...} | the link from an email to what it created | document **[OBVIOUS]** |

---

## 7. Naming

**Evidence**

- Prefixes carry no meaning: `wa_` (20 tables) and `hub_` (18 tables) mark the build phase, not a domain; every table is Welfare Avenue and every table is the Hub. `dept_` (5 tables) abbreviates a word that columns spell out (`department`).
- Wave numbers are baked into names: functions `wa132_bank_close`, `wa133_roster_sync`, `wa65_on_leadership_insert`, `wa69_general_link`, `wa72_founder_guard`, `trg_wa89_*` (5), `trg_wa123_*` (4), and triggers `trg_wa133_roster`, `wa127_auto_profile`. The name says when, not what.
- Near-collisions: `onboardings` vs `wa_onboarding`; `is_wa_admin` vs `is_hub_admin`; `hub_events` vs `volunteer_events` vs `fund_events`; `content_posts` (outgoing) vs `social_posts` (incoming); `sop_*` vs `trainings.kind = 'sop'`.
- Singular and plural mixed: `goals`, `projects`, `decisions` but `change_log`, `event_roster`, `item_status`, `user_state`, `wa_discipline`, `wa_onboarding`, `wa_brand`, `social_daily` (an adjective), `dept_meta`.
- Abbreviations and reserved or vague words: `staff_notes.k`/`v`, `hub_visits.at` and `ua`, `ai_calls.ms`, `hub_shoutouts.by`, `task_files.by`, `fund_events.precision` (a SQL keyword that Postgres prints in quotes), `dept_meta.read` (the AI's read of the team), `wa_usage.day`, `social_daily.day`, `wa_loom_stage.created`.
- The team concept has six column names (`department`, `dept`, `depts`, `team`, `area`, `scope`). People have more than twenty (`owner`, `lead`, `leads`, `assignee`, `person`, `person_name`, `member_name`, `name`, `full_name`, `with_person`, `raised_by`, `requested_by`, `author`, `by`, and the `*_by` family).
- Timestamps mostly end in `_at`, but `created`, `at`, `day`, `captured_on`, `happened_on`, `earned_at`, `stage_at` also appear. Dates use `_date`, `_on` or nothing (`due`, a text column).

**Proposed convention** (for new objects now; for existing ones only in a planned rename window)

- Tables: plural snake_case nouns grouped by a domain prefix that means something: `people_`, `access_`, `board_`, `task_`, `goal_`, `request_`, `volunteer_`, `finance_`, `social_`, `content_`, `training_`, `integration_` or `sync_`. No `wa_` or `hub_`.
- Suffixes: `_log` for append-only logs, `_state` for singleton sync status, `_settings` for key-value configuration, `_template` and `_steps` for checklists.
- Columns: `<table_singular>_id` for foreign keys; `department` for a team code (`departments` for arrays); `*_at` for timestamptz and `*_on` or `*_date` for dates; `*_by_email` or `*_by_member_id` for actors; `is_*` for booleans; `status` with a CHECK.
- Functions: verb or domain first (`bank_*`, `org_*` already follow this); triggers `trg_<table>_<what>`; no wave numbers.

**Rename candidates** (all **[DECISION: needs the owner]**, each needs page and edge function changes; a simple view under the old name keeps old callers working during the switch): `wa_onboarding` to `hub_first_steps`; `hub_events` to `calendar_events`; `fund_events` to `fundraising_events`; `dept_meta` to `teams` (or `departments`); `staff_notes` merged into settings; `item_status` dropped; wave-numbered functions and triggers to descriptive names; `decisions.area` to `department`; `academy_paths.dept`, `board_committees.depts`, `hub_access_profiles.team`, `hub_shoutouts.team` to `department(s)`.

---

## 8. Confidentiality, access and the service role

**Evidence**

- A task, update, decision or transcript can be hidden four ways: `confidential` (true in 3 decisions, no tasks or updates), `board_only` (25 tasks, 8 updates, 5 decisions, 8 transcripts, 71 change_log rows), `visibility` plus `allowed_people` (never set), and for tasks and projects the restrictive `banked_at is null` policy. Staff and board viewers get different combinations (board viewers also need `confidential = false`).
- Edge functions read with the service role, which bypasses row-level security. So each job repeats the filters: 6 functions add `.eq('board_only', false)` and 14 functions were edited in wave132 only to leave out banked rows. The next new job will have to remember all of this.
- 53 SECURITY DEFINER functions are executable by `anon` (security advisor). Most are trigger functions or harmless helpers, but some run with owner rights and no caller check: `onboarding_assign()` (creates an onboarding plan, and trusts the caller-supplied `p_by`), `ai_usage()` (AI usage and cost by job), `ensure_event_steps()` and `sop_sync_all_events()` (insert checklist rows). `volunteer_confirm_get()` and `volunteer_confirm_submit()` are meant to be public (token links).
- 8 tables have row-level security on and no policies, so only the service role can use them: `site_files`, `wa_health_checks`, `wa_loom_stage`, `wa_rate_limits`, `wa_slack_ids`, `wa_slack_names` and the two backup tables. That is intended but undocumented.
- `wa_hr_access` is readable by every signed-in user (policy `true`), which reveals who has HR access.
- `search_transcripts()` runs as owner and filters `board_only`, but not `visibility`. Once restricted meetings are used, private and leadership transcripts would appear in every staff member's search results.

**Recommendation**
- Document the model in the comments (done in `db_comments.sql`). **[OBVIOUS: safe to do now]**
- Create views that encode the filters once, for example `tasks_open_visible` (done = false, banked_at is null, board_only = false, visibility is null or 'department'), and have jobs read those. **[DECISION: needs the owner]**
- Decide whether `confidential` is still needed next to `board_only`, and whether `visibility` is kept. **[DECISION: needs the owner]**
- Revoke `EXECUTE` from `anon` on SECURITY DEFINER functions that do not need it, and add a caller check to `onboarding_assign()` and `ai_usage()`. **[DECISION: needs the owner]** (low effort; test the public confirmation form after).

---

## 9. Documentation and schema history

**Evidence**

- Comments: 5 tables (`content_drafts`, `hub_candidates`, `wa_brand`, `wa_brand_assets`, `wa_photos`), 5 columns, 0 functions, 0 views.
- 18 tables and 1 view have no `CREATE` in `supabase_migrations.schema_migrations`: `dept_tasks`, `decisions`, `dept_meta`, `dept_updates`, `transcripts`, `task_comments`, `request_suggestions`, `transcript_request_scans`, `sop_roles`, `hub_knowledge`, `wa_brand`, `wa_brand_assets`, `wa_health_checks`, `wa_rate_limits`, `item_status`, `wa_loom_stage`, both public backup tables, and the view `wa_brand_assets_list`. The first five and `item_status` predate the first tracked migration (2 July 2026); the others were created later with ad hoc SQL.
- The migration history contains 17 stage create and drop migrations from the release pipeline (`wa_stage_qz_create`, `wa_stage_qz_drop` and similar) plus one clean-up, which add noise for anyone reading it. A copy of one dropped stage table (`wa_stage_v69`) survives in `backup_p0_20260806`.
- Only 37 of 54 live edge functions are in the repo; the other 17 exist only in Supabase.

**Recommendation**
- Apply `db_comments.sql`. **[OBVIOUS: safe to do now]**
- Capture the current definitions of the 19 objects in a baseline migration file in the repo (no-op on production), and save the 17 missing edge functions to `fn/`. **[OBVIOUS: safe to do now]** (repo only; nothing changes in the database).
- Keep comments current: add "every new table and column gets a COMMENT" to `HUB_RELEASE_CHECKLIST.md`. **[DECISION: needs the owner]**

---

## 10. Indexes and performance

At current sizes (largest table `social_daily`, 18,780 rows; the whole public schema is about 27 MB including indexes) nothing here is urgent.

- 24 foreign keys have no covering index (advisor `unindexed_foreign_keys`), for example `event_roster.person_id`, `finance_transactions.statement_id`, `social_posts.account_id`, `task_assignees.member_id`. **[OBVIOUS: safe to do now]**
- 17 policies call `auth.jwt()` or helper functions per row (`auth_rls_initplan`), and many staff policies call `is_wa_staff()` unwrapped. The result shows in the stats: `hub_roles` (26 rows) has 3.5 million index scans and 697,000 sequential scans, and `board_circle` (6 rows) 60,000 sequential scans. Wrapping calls as `(select is_wa_staff())`, as some policies already do, fixes it. **[OBVIOUS: safe to do now]**
- `is_board_circle()` and `is_board_viewer()` compare `lower(email)`, which cannot use the primary key index. Emails are already stored lower case. **[OBVIOUS: safe to do now]** (compare `email = lower(...)` instead).
- 29 "multiple permissive policies" (for example a staff policy plus a board read policy on the same table) and 15 unused indexes (mostly on empty or new tables). Leave until tables grow. **[DECISION]**
- Heavily filtered columns without an index (`dept_tasks.department`, `transcripts.processed`) are small enough not to matter yet.

---

## 11. Other things that trip people up

### 11.1 Dates and numbers stored as text

- `board_items.due` is free text (4 distinct values, none a date). `board_members.renewal` is text such as "Q3 2026" next to a real `renewal_due` date.
- `volunteer_inventory.qty_in` is text although all 21 values are numbers; `qty_remaining` and `reorder_needed` are text and never set.
- `goals.quarter`, `finance_budgets.fiscal_year` and `fund_events.plan` are text periods in three formats (2.6).
- `fund_events.timing` is free text next to `start_date`, `end_date` and `precision` (fine, but comment it as display only).
- `dept_updates.entry_label` packs a date and a source into text, such as "Aug 9 (Otter)", "Jul 12 (Slack digest)" or "May (Loom)" (88 distinct labels). The source (Otter, Plaud, Loom, Slack, email) deserves its own column, and the date is already in `created_at` or the source transcript.

**Recommendation**: numeric and date types for the first three **[DECISION]**; comments now **[OBVIOUS]**.

### 11.2 "Today" depends on the function

`wa_today()` uses America/Toronto. `onboarding_assign()`, `board_home()`, `social_overview()` and several column defaults (`current_date`) use the database time zone (UTC, checked). For four or five hours every evening the two "todays" differ. All timestamp columns are `timestamptz`, which is good.

**Recommendation**: use `wa_today()` everywhere a calendar day matters. **[DECISION]** (small code change).

### 11.3 Hardcoded values inside functions and policies

- `bank_add_task()` hardcodes the seven team codes; `bank_project_do()` hardcodes eight "General ..." project names.
- `wa_fix_names()` hardcodes spelling corrections for specific people's names; an alias table would be data, not code.
- `wa72_founder_guard()` and three policies hardcode founder emails (2.2).
- `call_edge()` and `on_transcript_insert()` embed the project URL and the anon key (public by design, but a second copy to keep in sync).

**Recommendation**: move lists into tables or settings **[DECISION]**.

### 11.4 Duplicates by natural key

- `team_members`: no duplicate names or emails. 4 `hub_roles` emails match no roster row at all (accounts with an access row but no `team_members` entry).
- `volunteer_people`: 2 duplicate full names and 65 rows flagged `needs_review` (the merge tool exists).
- `finance_transactions`: 792 rows have only 780 distinct fingerprints (12 repeats), yet `duplicate_of` is never set; the importer only pairs a row with rows from other statements.

### 11.5 Credentials stored in tables

`staff_notes` holds one row, the shared Quo login shown on the volunteer messaging screen, and `info_links` has `username` and `secret` columns (3 rows set, kind = 'password'). Both are readable by all staff through the API, and both are copied nightly into JSON backups. `sop-import` already scrubs a shared password from SOP text, so the intent to keep secrets out is there.

**Recommendation**: move shared passwords to the password manager and keep only a pointer in `info_links`; drop `staff_notes`. **[DECISION: needs the owner]**

### 11.6 Cron quirks worth knowing

- `wa-ai-calls-prune` deletes from `ai_calls` directly in SQL; everything else goes through `call_edge()`. Comment it on the table (done).
- `wa-bank-resurface` (new today) calls `bank_resurface()` directly and has not run yet.

---

## Appendix A: evidence queries

All run read-only on 26 Sep 2026. Abbreviated.

```sql
-- tables, sizes, RLS, policies, comments, write stats
select c.relname, c.relkind, pg_total_relation_size(c.oid), c.relrowsecurity,
       (select count(*) from pg_policy p where p.polrelid = c.oid),
       obj_description(c.oid, 'pg_class') is not null,
       s.n_tup_ins, s.n_tup_upd, s.n_tup_del, s.n_live_tup
from pg_class c join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public' and c.relkind in ('r','v');

-- exact row counts
select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';

-- team code values (one branch per team column)
select 'dept_tasks.department', department, count(*) from public.dept_tasks group by 2
union all select 'decisions.area', area, count(*) from public.decisions group by 2;  -- and 32 more

-- done vs status in dept_tasks
select done, case when status ilike 'done%' or status ilike 'hired%' then 'done-like'
                  when status ilike 'open%' or status ilike 'new%' then 'open-like'
                  when status ilike 'in progress%' then 'in-progress' else 'other' end, count(*)
from dept_tasks group by 1, 2;

-- owner text vs task_assignees
select count(*) filter (where exists (select 1 from task_assignees a join team_members m on m.id = a.member_id
                                      where a.task_id = t.id and lower(m.name) <> lower(coalesce(t.owner, ''))))
from dept_tasks t;

-- AI provenance in text
select count(*) filter (where updated_by like 'AI: %') from dept_tasks;
select count(*) filter (where added_by like 'AI: %') from dept_updates;

-- orphans for an id column without a foreign key (pattern)
select count(*) filter (where not exists (select 1 from dept_tasks d where d.id = c.task_id)) from task_comments c;

-- all-NULL columns in non-empty tables
select table_name, column_name from (select c.table_name, c.column_name,
  (xpath('/row/n/text()', query_to_xml(format('select count(%I) as n from public.%I', c.column_name, c.table_name), false, true, '')))[1]::text::int nn,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.table_name), false, true, '')))[1]::text::int total
  from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE') s where nn = 0 and total > 0;

-- tables created outside the migration history
select t.relname from pg_class t join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relkind in ('r','v') and not exists (
  select 1 from supabase_migrations.schema_migrations m
  where array_to_string(m.statements, ' ') ~* ('create (or replace )?(table|view)( if not exists)? (public\.)?"?' || t.relname || '"?[\s(]'));

-- backup schemas
select n.nspname, count(*), pg_size_pretty(sum(pg_total_relation_size(c.oid)))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname like 'backup_%' and c.relkind = 'r' group by 1;
```

Code evidence (Python over the sources):
- `.from('<table>')` and `.rpc('<fn>')` counts in `build/candidate.html` (530 table calls to 97 objects; 38 functions called).
- Edge functions: 37 sources from `/root/wa-hub/fn`, 8 cached copies whose version matches live, 9 fetched from the live project; `.from('<table>').<op>` gives reads and writes per function.
- Literal team-code lists: regex for a bracketed list of four or more codes (26 hits in 10 sources); code-to-label maps: `opsmtl: '<Label>'` (27 hits in 15 sources).
- Advisors: `get_advisors` performance and security, parsed from the saved output.

## Appendix B: notes on `db_inventory.json`

- `rows`: exact `count(*)` for tables (all are under 50,000 rows); for the three views, the row count of the base table (each view returns one row per base row).
- `frontend_candidate_html.from_calls`: number of `.from('name')` calls in the built page; `operations` splits them by select, insert, update, upsert and delete.
- `edge_functions.references`, `reads`, `writes`: from all 54 live edge functions.
- `sql_functions`: public functions whose body names the table. `triggers`: trigger functions attached to the table.
- `cron_jobs.direct`: cron commands that name the table; `via_edge_functions`: cron jobs that call an edge function which references the table.
- `write_activity`: `pg_stat_user_tables` counters since the last statistics reset.
- `last_write_seen_in_data`: the newest created or updated style timestamp found in the rows (NULL when the table has no such column or no rows). For tables without an `updated_at` column this under-reports updates.
- `created_in_migration`: the first migration whose SQL creates the object; NULL means it was created outside the tracked migrations.
- `flags`: `backup-copy`, `no-primary-key`, `empty`, `no-code-references`, `service-role-only (RLS on, no policies)`, `create-not-in-migration-history`, `no-writes-since-<date>` (newest row timestamp is before 15 Aug 2026), `no-comment`.
