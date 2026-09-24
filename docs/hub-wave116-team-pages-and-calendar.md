# 24/09/26 - Hub wave116: team pages, task boards, scoped agendas, calendar sync

Live build: `4e1e68fdfd7b919eaa5fbbad5929feb4` (1,718,240 bytes), deployed 24/09/26 21:45 UTC via site_files parts + host-sync (third cut: menu polish; second cut `c4013f71…` at 21:00, first cut `e95e28eb…` at 20:19). Previous: wave115 `fbb59f49…` (1,561,454).

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
- Git: `/root/wa-hub` is now a git repository (branch `main`, first commit `2629e39` = this deploy). `.gitignore` keeps harness outputs, screenshots and keys out. Standing rule from here: every deploy ends with a commit (message names the wave and the live md5) and a push to GitHub once the remote and token are in place (vault `GITHUB_TOKEN`, app_config `github_repo`).

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
