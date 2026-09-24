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

## Backend

- `public.hub_events` + `public.hub_calendar_state` (migration `wa116_hub_events`), RLS read for staff/board/admin.
- Edge function `calendar-sync` v2 (probe / sync / status). Service account `wa-hub-drive@welfare-avenue-dashboard.iam.gserviceaccount.com` reads hub@welfareavenue.com's calendar (shared by Steel). Window -7d..+60d, attendees + RSVP, Meet links, department tag via `dept_meta.calendar_match`; refreshes `dept_meta.meeting_cache`. Cron `wa-calendar-sync` at :05 and :35 every hour (jobid 13). First sync: 29 events (Weekly Fundraising, Weekly Operations, HR).
- Migration `wa116_program_development_split`: progdev dept_meta; Shima, Brianna, Ola, Amena, Zachee → progdev; 22 tasks (Program development workstream + PD projects), projects 3 and 4, all 8 opsmtl goals, 16 PD transcripts, 3 PD-meeting updates, 3 mentions, agenda 6 (Ahmed & Shima 1:1), slack source #program-development, slack_digest map. Slack digests of the shared Ops channel stayed with Ops Montreal.
- `apply_transcript_result` RPC and `process-transcript` v7 map "Program Development" uploads to `progdev` (old combined labels still map to Ops Montreal); Slack notices link to `#team/<dept>`.

## Follow-ups

- Invite hub@welfareavenue.com to the Marketing and Program Development meeting series (only Fundraising, Operations and HR are on its calendar so far).
- Consider dropping the calendar share from "Make changes and manage sharing" to "Make changes to events".
- Custom SMTP for hub@ (branded auth emails) still returns 500; deferred by Steel.
- `metrics` table drives "KPIs we track" per team (staff can update values inline); add rows for Program Development, HR, Ops Toronto when the teams pick their numbers.
