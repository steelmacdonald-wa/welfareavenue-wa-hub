# 30/09/26 - wave181: the HR centre's Analytics, and start dates from Slack

Steel (30/09/26), with Slack's Member Analytics export (29 Aug 2025 to 29 Sep 2026): "Here's a slack analytics sheet. To help you add start dates, add an analytics tab to the hr center, show trends, and know who's been a part of the org and for how long ish (we may have deactivated their accounts late)".

## Start dates

- The export gives each Slack account its creation, join (claimed) and deactivation days back to 2021. Each account was linked to its roster person (by email, or an obvious second address; six by first name only, flagged for HR to confirm).
- A roster person's start date is now the earliest of their Workspace account and the day they joined Slack (`start_source` slack). 15 changed: Steel (2021-05-18), Tamara (2021-05-23), Kellian (2021-05-25), Tate (2022-10-26), Ian (2023-05-11), Jemeela (2023-10-04) and Soraya (2024-02-14) had Workspace dates (several the 17/01/2024 Workspace setup day); Mohamed, Robert, Amena, Danielle, Mandeep, Natasha, Cindy and Gamze had none. Each change is in change_log. Dates HR set by hand are never touched.
- directory-sync writes the Workspace date whenever it differs; the trigger `wa181_keep_start` keeps an earlier Slack date (no function change).

## The Analytics section (HR centre, `#hrcentre/analytics`)

For HR and admins only (`wa181_can_see`: the HR access list, the HR profile, admins). Leaders who open the HR centre do not get the tab, and the data is refused in the database.

- The headline: on the team now, joined and left in the last 12 months, the typical time with us (the team today) and the typical stay of people who left, everyone since 2021.
- The team over time: people on the team at the end of each month since May 2021 and the month's joiners; hover, tap or the arrow keys for a month's numbers.
- Each fiscal year (October to September): joined, left by, on the team at the year's end, joiners still here.
- How long people stay (the team today, and people who left), and the team today by team with the median time.
- Worth a look: on Slack this year but not on the roster; left on the roster with Slack still open; on the roster with Slack switched off; Slack open and unused for a year (and unused second accounts); links made by first name; no start date.
- Everyone who has been part of Welfare Avenue: filters (on the team, left, Slack unused, never joined, everyone), search, team, sort, and a sheet per person with their Slack accounts, where HR links an account to a roster person or marks it as not a team member (`wa181_link`). Download (CSV), named dd-mm-yy.
- Import a new Slack export: the page reads Slack's CSV (the window from the file name, or typed), and `wa181_import` updates known accounts (their links kept), links new ones by email, and fills earlier start dates.

## Honest dates

Accounts were switched off late and in batches (21/10/2025: 22 at once), so a leaving date is "left by": the day the last account was switched off, or the first day of the export's window when the person was not active once in it. Times with us for people who left are "up to". People still on Slack but marked as left on the roster have no leaving date ("not known"). The headcount line before September 2025 is a ceiling.

## Data

- `hr_slack_accounts` (one row per Slack account; HR and admins read it; written by imports and `wa181_link`).
- `hr_people_tenure_v` (security invoker; one row per person: the roster joined to the team Slack accounts, with `started_on`, `status` current / left / quiet / never_joined, `left_by`).
- Functions: `wa181_can_see`, `wa181_import`, `wa181_link` (authenticated only, checked inside), trigger function `wa181_keep_start`.
- Migrations: `wa181_people_analytics`, `wa181b_tenure_view`, `wa181c_start_dates`, `wa181d_import_link` (the import of the first export was run from `build/data/wa181_slack_import.py`; the CSV itself is not in the repo).

## Code

`build/parts181/` (a_head, b_data, c_paint, d_sheet, z_wire) into `build/src/181_wave181.seg`, listed after 180 in the manifest. The rail icon is in `parts153/a_head.js`. The HR centre tour gets an Analytics stop after Sections.

## Checks

- `test/w181drive.js`: 61 checks (an admin at 1366: the tab, the rail, the address, the other sections hidden, the tiles, the chart and its hover and keys, the fiscal years, the stay and team cards, Worth a look, the list's filters, search, sort, a sheet and its save and a refused save, the CSV, the import and a wrong file, the tour, leaving the tab; the deep link; HR's profile; a leader and a member without it; a phone at 390). w134, w153 and w163 pass on the new build as on the old one.
- Database, as the people themselves (rolled back): Joy and Ahmed read no Slack rows and cannot link; Samson (HR) and Steel's gmail read all 105; an import updates, links by email and fills a start date; the trigger keeps a Slack date against a later Workspace one and lets an earlier one through.
- Live: Hub `b73865396ade0028a6fb55e682bb5bd9` to `fa06b32cd0496545dfded330b57c308c`, then `e865a0bf446acdd1253866adfc1b5d7a` (the over-time note names people without a start date); both addresses checked; read in the browser signed in as Steel: 52 on the team, 92 people since 2021, 98 rows in all.
- Security advisor: no new ERROR (the one ERROR is `volunteer_people`, a security definer view from wave176); the new functions are not executable by anon.
