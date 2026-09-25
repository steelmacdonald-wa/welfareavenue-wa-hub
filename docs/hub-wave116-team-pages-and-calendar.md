# 24/09/26 - Hub wave116: team pages, task boards, scoped agendas, calendar sync

Live build: `417a5ed4d31c8225b4972428cf3c90ef` (1,891,546 bytes), deployed 24/09/26 23:40 UTC via site_files parts + host-sync (sixth cut: Hub inbox). Fifth cut `c2df2e54…` (Strategy goal pages + Executive dashboard) at 23:15. Earlier cuts the same day: `e29e8974…` (Projects page, menu fix), `4e1e68fd…` (menu polish), `c4013f71…`, `e95e28eb…`. Previous: wave115 `fbb59f49…` (1,561,454).

## What Steel asked for

- Each department dropdown holds a page per team: its own Overview (bullet updates, mentions from other departments, KPIs), its own Agenda tool, tasks. The Agendas entry under Meetings becomes the master tool, admins only.
- Operations Montreal and Program Development are separate teams. Operations Montreal carries Volunteering in its dropdown.
- Fundraising & Finances (renamed from Fundraising & Grants): Grants, Event fundraising, Donor relations and Finance each get a ClickUp-style task page with their projects; Finance also opens the existing Finance tool (QuickBooks, statements, forecast).
- Tasks: the clean interface with what it already had plus ClickUp/Asana capabilities.
- Meeting times follow the hub@welfareavenue.com calendar; each person's home page lists exactly the meetings they have upcoming, with who accepted.

## Routes

- `#team/<dept>` Overview, `#team/<dept>/agenda`, `#team/<dept>/tasks[/<workstream>]`, `#team/opsmtl/volunteering` (redirects to `#volunteering`).
- `#team/fundraising/grants|events|donors|finance` (task boards), `#team/fundraising/tasks` (everything, grouped by sub-team). The Finance page has a segmented link to `#finances` (the tool).
- `#dept/<dept>` (the classic page) still exists: the flyout's Executive decisions and Transcripts go there, and the Overview footer links to it.
- Keys: `opsmtl` Operations Montreal, `progdev` Program Development (new), `opsto` Operations Toronto, `marketing`, `fundraising` (Fundraising & Finances), `hr`, `board`.

## Build pieces

- `src/001_wave116a.seg` runs first after the base: adds `progdev` to DEPT_ORDER/LABEL/COLOR/SECTIONS, renames labels, defines `window.WA_TEAMS` (order, pages, sub-team boards, board→project map), extends `txDeptKey`, creates the `#progdev` panel and tab, patches selects.
- `teams_remap.py` (build time, after brand_remap): rewrites hard-coded labels in older waves and the wave71 workstream lists (Program development leaves Ops Montreal; Finance joins Fundraising).
- `src/116_wave116.seg`: styles, `#team` panel + routing, nav flyouts, permissions (progdev + team enrolled; master `agendas` stripped from leader/member/viewer defaults and non-admin overrides), Overview renderer, scoped agenda (moves the existing `.ag-page-card` into the team page with department locked; back on leaving), calendar mirror loading, Home "Your upcoming meetings", `loadMeetings` override (chips read `dept_meta.meeting_cache`, which the sync refreshes).
- `src/116b_wave116b.seg`: `w116Board` (List/Board/Calendar, group by project/workstream/status/owner/due/sub-team, filters, search, sort, quick add, inline edits, drag and drop, bulk bar, task drawer with comments + activity, delete). Writes go through `dept_tasks` + `change_log` + in-memory caches, then `renderSection(dept)` repaints the classic page.
- Harness: `test/w116drive.js` (staff/member/board), fixture gained `hub_events`, `hub_calendar_state`, progdev dept_meta, finance/grants tasks. Baselines `test/p116_*`.

## Second cut (same day)

- Department menus hold only the team's pages. Transcripts and Executive decisions entries are gone (Transcript Archive under Meetings serves everyone; decisions live on the Executive dashboard).
- Finances (the QuickBooks tool), HR centre and MTL volunteering moved out of More/People into the Fundraising & Finances, Human Resources and Operations Montreal menus. The real tab buttons are adopted into the flyouts (`ADOPT` in 116_wave116), so role gating and wiring are untouched; a MutationObserver plus three timers re-apply the layout after wave73/wave95 rebuild the bar.
- Menus open on click, never on hover: clicking a team opens its Overview and expands its pages (accordion follows the active page); the chevron at the right of each team expands or collapses without navigating.
- New Strategy section: Executive dashboard (the `overview` page, unchanged) and Goal alignment (the `goals` page, renamed at build time). "Needs me" button hidden (Home covers it).
- Profiles (`116c_wave116c`): "Main responsibilities" (3 to 5 lines) plus a job-description link on every person page, stored in `team_members.responsibilities`, `jd_url`, `jd_name`. Admins, leaders and the person edit; the picker lists Drive docs named like a job description (wa_drive_docs) and "Pull from the job description" lifts the responsibilities list out of the synced Google Doc text.
- Task boards gained "Select all" for bulk actions.
- Team changes: Amena HajjDiab, Rami and Danielle marked inactive; Rami's hub sign-in blocked. Rami still owns 27 open fundraising tasks (and 2 shared with Alexis), Danielle 2: filter by owner on the Event fundraising / Donor relations boards, select all, set owner.

## Menu polish (third cut) and source control

- Team rows are flex rows: label (wraps cleanly), a small chevron on the right, then the pages on their own line. Row-level highlight for the active team; the sidebar rules are prefixed `body nav.wa-nav` so they beat the wave114 skin, which is kept last in `<head>`.
- Git: `/root/wa-hub` is a git repository (branch `main`). `.gitignore` keeps harness outputs, screenshots, keys and `.pushed.json` out.
- GitHub: **https://github.com/steelmacdonald-wa/welfareavenue-wa-hub** (private). The build sandbox cannot push directly (its egress proxy swaps in the session's own GitHub identity), so pushes go through the `repo-sync` edge function: `build/repo_push.py "<message>"` sends changed files as blobs and makes one commit via the Git Data API with the vault `GITHUB_TOKEN` (fine-grained PAT of steelmacdonald-wa, Contents read/write). The script needs `/tmp/wa.secret` (WA_TRIGGER_SECRET) in the session; `app_config.github_repo` records the repo. First push: commit `123efe54`, 195 files.
- Standing rule from here: every deploy ends with `git commit` (message names the wave and the live md5) and `python3 build/repo_push.py "<same message>"`, so GitHub always matches the site.

## Strategy section (fourth and fifth cuts)

- Menu order: Executive dashboard, Organizational goals, Department goals, Projects, Goal alignment (116d builds the group; the three new buttons are created there and gated like the goals page: members and up, not the board).
- **Projects** (`116e_wave116e`, `#projects`): the master page. Summary tiles, Cards or List, filters by team, status and lead, search, collapsible team groups with sub-projects nested, each card with its lead (`projects.leads`), owner team, status, goal, progress and open work; inline lead, owner and status changes; "+ New project"; edits logged to change_log. The Goal alignment page lost its Projects tab.
- **Organizational goals** (`116f_wave116f`, `#orggoals`): one card per org goal with the SMART grid (Specific = `goals.detail`, Measurable = `measure`, Achievable = `approach`, Relevant = `why`, Time-bound = quarter/horizon + `due_date`), "What achieved looks like" (`success`), owner, status (inline), progress (manual `progress`, else linked tasks done, else the average of its department goals), and the teams, department goals (`parent_goal_id`), projects (`projects.goal_id`, of the goal or its children) and tasks (task_ids + project tasks) that carry it. Missing SMART parts read "Not written yet. Click to add it." Comments reuse the wave16 thread.
- **Department goals** (`#goals`, relabelled): the page body is rebuilt after the older waves run: tiles, team chips, quarter segments (This quarter, next, All), status filter (In play, Needs attention, Achieved or closed, Everything), search, one collapsible group per team with goal cards (status inline, quarter, due, roll-up chip, projects, open tasks, owner), "Open" expands the SMART detail, tasks with tick boxes (wave16 handler) and comments; the wave30 AI suggestions stay per team. Status changes still push to ClickUp when the goal is mapped there.
- **Goal alignment** (`#goalmap`): a fresh map, projects -> department goals -> organizational goals, SVG connectors, hover and click focus, team filter and search, rollup counts, dashed nodes for anything unlinked with a one-click "Link to a goal" / "Roll up to an org goal".
- One editor for every tier (`w116GoalModal`): title, team, horizon/quarter, status, owner, due date, progress, the four SMART texts, what achieved looks like, rolls-up-to, and the projects that serve the goal (tick boxes write `projects.goal_id`). Archive from the editor.
- Migration `wa116f_goals_smart_and_announcements`: `goals.why`, `approach`, `success`, `owner`; table `public.hub_announcements`.
- Goal data: the goal-sync run of 13/09 read zero goals (transient) and re-inserted 20 ClickUp tasks as duplicates (ids 46-65). Removed (`wa116g_remove_goal_sync_duplicates`, logged per goal). `goal-sync` v3 aborts when the read fails and treats every goal with a ClickUp id as known, whatever its quarter; archived goals are not refreshed; the Q4 OP GOALS list now maps to Program Development.

## Executive dashboard (`116g_wave116g`)

- The ClickUp movement card and chip render nothing (the weekly snapshot table keeps filling; nothing else reads it). Help text patched at build time.
- "Open decisions" is "Executive decisions". Each decision names the executive who decides: Ian (Marketing, fundraising events), Shima (Montreal operations, program development), Suhaib (Grants, Toronto operations, HR, finance), Steel (Board, financial decisions). The area sets the default (Marketing, Events, Fundraising -> Ian; Ops MTL, Program Development -> Shima; Grants, Ops TO, HR, Finance -> Suhaib; Board -> Steel); legacy "Both" reads Steel & Suhaib. Filter chips, the add/edit modal (areas gained Program Development, Events, Finance) and the wave111 Decisions waiting folder use the names.
- "What's new" sits under the KPI strip and shows only major announcements: manual posts (`hub_announcements`; admins and leaders post, pin, set an expiry, take down), departures and hub invitations (change_log), transactions and donations of $1,000 or more in the last 60 days (finance_transactions, only for people who can open Finances), cancelled serving events. "N new since you last looked" uses the last visit. The old what's-new strip is hidden.

## hub@ inbox (`116h_wave116h`, `mail-pull` v2)

- Steel enabled domain-wide delegation for the service account (client id 107460787452614031265, gmail.readonly + calendar.readonly); `mail-pull` reads hub@welfareavenue.com as itself. Steel's call on the flow: **fully automatic, with an activity trail and an undo**.
- Cron `wa-mail-pull` (jobid 14, :12 and :42 every hour) calls `mail-pull {action:'sync'}`: new messages since the last one (14 days back on the first run), noise filtered by rule (Google notices, calendar mail, newsletters, mail from hub@ itself), the rest classified by the model (`file_email` tool; Haiku 4.5 then Sonnet; keyword rules as fallback): kind (invoice, meeting_summary, update, noise), team, one line summary, amount, vendor, dates.
- Filing: invoices become Finance tasks (`dept_tasks` fundraising / Finance, flagged Budget or purchase at $1,000+) with attachments stored in the private `hub-mail` bucket; meeting summaries become `transcripts` rows sent through `process-transcript` (short link-only emails become updates instead); everything else lands as a `dept_updates` entry on the team's page; an email the model cannot place waits on the Hub inbox page ("File to a team"). Every filing writes `hub_mail.filed`, a change_log row (`hub_mail`) and one Slack line.
- `hub_mail` + `hub_mail_state` (migration `wa116h_hub_mail`). Actions: `probe`, `sync`, `undo {mail_id}` (removes what the email created; for transcripts also the AI-tagged tasks, updates and open decisions), `refile {mail_id, kind?, department?}`, `test {from, subject, body}` (files a made-up email, for checks).
- Hub inbox page (`#hubmail`, Meetings menu, leaders and admins): last check, tiles, filters, each email with what happened and where, attachment links (signed urls), Undo, Move to another team, File to a team, File anyway, Check the inbox now.
- First sync: 8 messages, all noise (Google welcome and security notices, the two calendar invitations). Test invoice and test update filed correctly through the rules fallback and were undone.
- **Blocker for the model path**: the vault `ANTHROPIC_API_KEY` returns "credit balance too low", which also stops `process-transcript`, goal suggestions and the Brain. Top up the Anthropic console balance; nothing else changes.

## Classic department page retired (`116i_wave116i`)

- Steel: "We don't need this page anymore for all departments because of the reorganising we did... as long as we aren't losing functionality." Everything the classic page did now lives on the team pages: the Overview gained "Where the team is" (progress this period, the high-priority list, the team pulse, re-run from transcripts), the team's executive decisions with the AI recommendation button, "+ Add an update" (a modal, no browser prompt), "+ Add a task", "+ Add a project", "+ Invite", all updates, mentions and the tools row; the Tasks page already had list, board, calendar, workstreams and (new) "move to another team" in the drawer.
- Routes: `#dept/<team>` and `#<team>` land on the team Overview; `#task/<id>` opens the team board with that task's drawer; `showPanel(<team>)` and `renderSection(<team>)` from older code route to the team page. The classic panels stay in the DOM, hidden.
- Projects aligned everywhere: one shared store (`window.w116Projects()`, `w116LoadProjects`, `w116ProjectsChanged`) feeds the Projects page, the team Overview, the task board grouping, the goal pages and the alignment map, so an edit on the Projects page repaints the rest live. Boards: `projects.workstream` decides which sub-team board a project belongs to (Grants, Fundraising events, Donor program) instead of a static id list; the project editors pick it. Data fixes (`wa116i_projects_workstream_and_alignment`, `wa116i_project_leads_from_task_ownership`): workstreams set, projects linked to their goals, department goals rolled up to org goal 45, leads filled from who owns the open tasks.

## The header (`116j_wave116j`)

- Steel: one bubble with the photo and name; the cloud pill replaced by who is active; a check in / check out for hours; a Settings tab to connect Slack, Google Calendar and Google Drive.
- The identity pill is one bubble (photo + first name + caret). The menu: My profile (the person page), Edit profile and photo, Notifications, Settings: Slack, Google Calendar, Drive, Change password, Request more access, Sign out. "Signed in:" is gone.
- The "Cloud connected" pill is now the active bubbles: everyone seen in the last ten minutes (`user_state` heartbeat), a green ring for people checked in, hover for the names.
- Check in / Check out (staff): `hub_checkins` rows with minutes; sessions left open close themselves at eight hours; a change_log line per check-in. The HR centre hours tab gained "Hours checked in on the hub" (this week, last week, five weeks, sessions); the profile page shows the month.
- Settings (modal): Connections (Slack by profile email, Google Calendar, Google Drive through the new `hub-connect` function, plus hub@ and Loom/Otter as info), Notifications (the wave89 switches and a test), Account (photo/profile links, password via Supabase auth, sign out). Home meeting rows gained Accept / Decline once Calendar is on (`hub-connect rsvp`); the pill still opens Google Calendar.
- `hub-connect` v1 (`status`, `toggle`, `rsvp`, `drive_recent`): the delegated service account acts for the signed-in person only after they switch a service on. **To finish**: add `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/drive.readonly` to the domain-wide delegation entry for client id 107460787452614031265 (Admin console > Security > API controls > Domain-wide delegation); until then the switches return a clear error. Slack shows "connected" only when the person's Slack profile email matches their hub email.
- Migration `wa116j_checkins_connections_prefs`: `hub_checkins`, `hub_connections`, `wa_notify_prefs.prefs`.

## The profile page (`116k_wave116k`)

- Steel: "make an actual profile page that shows role, responsibilities, tasks completed, a link to the job description (Human Resources folder in the Drive), and what projects one is leading."
- `#person/<id>` rebuilt in the wave116 look: header (photo, name, role, team, email, onboarding bar, "On the hub now"), KPIs (open now with overdue, finished this fiscal year with the all-time count, hours on the hub this month, projects leading), then Main responsibilities (the wave116c block with the job-description link and its editor), Projects they lead (`projects.leads`, click through to the project page), On their plate (click opens the task on the team board), Finished this fiscal year; on the right About (the AI summary when the model is available), Hours on the hub (`hub_checkins`: this month, last month, sessions), Their meetings (hub@ calendar), Training (wave36) and the team. Admins, leaders and the person edit responsibilities; the person edits photo and settings from the header.
- Job descriptions: the HR shared drive keeps them under *Recruitment* > Job descriptions (J.D. - Operations, Marketing, fundraising, Executive), Board Job Descriptions, Program Development > Job Descriptions, plus "Fundraising Team Structure - JDs" (May 2026, per person). Migration `wa116k_job_descriptions_and_responsibilities` linked a job description for 38 people and wrote three to five responsibilities for 43 (from the document where one exists, from the roster role and project leads otherwise), logged in change_log. No document in the Drive yet for the HR roles (Valex, Natasha, Samson, Tuna), Melvina or Rima; the picker in the editor lists every job description the Drive mirror knows.
- The profile keeps the older chain alive (wave33 base, wave36 training, wave37 onboarding, wave116c responsibilities) by letting it render into a decoy section and lifting its blocks into the new layout, so every editor and link keeps working.

## The roster follows Google Workspace (`116l_wave116l`, `directory-sync` v1)

- Steel added the read-only directory scope and said go for all three. `directory-sync` reads the welfareavenue.com user list through the delegation (acting as Steel's admin account, the only kind the Directory API answers) once a day (cron `wa-directory-sync`, jobid 15, 06:20 Montreal) and on "Check Workspace now".
- New accounts that match no roster profile by email wait in **Workspace accounts > Place on the roster** (People and access, admins): name, email, Google title, created, last sign-in. "Add to the roster" opens one modal: link to an existing profile that has no email (the closest first-name match is preselected; keeps their tasks, projects and history) or create a new profile with team (Program Development included; hub-invite v4 and the wave113 list gained `progdev`), role title from the Google title, hub access and the sign-in email; the Google photo is copied. "Not a person" skips shared mailboxes and test accounts (undo under the skipped list); hub@, info@, org@, jobs@ and friends are skipped by rule.
- An account suspended, archived or deleted in Workspace marks the profile inactive the same day with a change_log line (`team_member/active`, which the Executive dashboard shows as a departure); an account the sync deactivated that comes back is reactivated. A Slack line summarises each pass that changed something.
- Google profile photos fill in for anyone without a hub photo (avatars bucket, `google/<member_id>`), refreshed when the Google photo changes; a photo uploaded on the hub is never overwritten.
- Tables `hub_directory` and `hub_directory_state` (migration `wa116l_hub_directory`). The first run needs the **Admin SDK API enabled** in the Google Cloud project (939437859037): the card shows the exact link until it is.

## Backend

- `public.hub_events` + `public.hub_calendar_state` (migration `wa116_hub_events`), RLS read for staff/board/admin.
- Edge function `calendar-sync` v2 (probe / sync / status). Service account `wa-hub-drive@welfare-avenue-dashboard.iam.gserviceaccount.com` reads hub@welfareavenue.com's calendar (shared by Steel). Window -7d..+60d, attendees + RSVP, Meet links, department tag via `dept_meta.calendar_match`; refreshes `dept_meta.meeting_cache`. Cron `wa-calendar-sync` at :05 and :35 every hour (jobid 13). First sync: 29 events (Weekly Fundraising, Weekly Operations, HR).
- Migration `wa116_program_development_split`: progdev dept_meta; Shima, Brianna, Ola, Amena, Zachee → progdev; 22 tasks (Program development workstream + PD projects), projects 3 and 4, all 8 opsmtl goals, 16 PD transcripts, 3 PD-meeting updates, 3 mentions, agenda 6 (Ahmed & Shima 1:1), slack source #program-development, slack_digest map. Slack digests of the shared Ops channel stayed with Ops Montreal.
- `apply_transcript_result` RPC and `process-transcript` v7 map "Program Development" uploads to `progdev` (old combined labels still map to Ops Montreal); Slack notices link to `#team/<dept>`.

## Follow-ups

- Google connections: scopes added by Steel (25/09). Enable the Admin SDK API in the Cloud project so the roster sync can run; the Calendar and Drive switches can be tested now.
- Anthropic credit: the vault key still returns "credit balance too low" (Brain, goal suggestions, transcript processing, the mail classifier and the profile About summary wait on it).
- Job descriptions for the HR team, Melvina and Rima: none in the Drive; link them from the profile editor once written.

- Invite hub@welfareavenue.com to the Marketing and Program Development meeting series (only Fundraising, Operations and HR are on its calendar so far).
- Consider dropping the calendar share from "Make changes and manage sharing" to "Make changes to events".
- Custom SMTP for hub@ (branded auth emails) still returns 500; deferred by Steel.
- `metrics` table drives "KPIs we track" per team (staff can update values inline); add rows for Program Development, HR, Ops Toronto when the teams pick their numbers.
