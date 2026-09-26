# 26/09/26 - wave133: the org chart, interactive

Live md5 `1ed9af924cb00b25e05fab39db943f1c` (3,794,274 bytes), deployed through the gated pipeline (`wa_stage_rc`, guarded on the live md5 `a73fdd9e` and dropped after). Schema: `wa133_org` (a seat for everyone on staff, from the roster), `wa133_tours` for the academy and the access profiles, and `wa133_security` (two fixes from the security review, below).

## What Steel asked

"I want the org chart to be more interactive where we can choose direct reports and move things around as executives. Executives should also be able to visualize empty positions."

## What it is

**The chart** (People > Org chart) now reads the reporting lines instead of guessing them from job titles:

- **The board of directors** at the top (with a link to the Board overview for those who can open it), then **the executive directors**, then **each team**: its leads first and everyone nested under the person they report to. A number on a card is how many report to that person; someone who reports to one executive director in particular says so ("reports to Suhaib"); someone who reports across teams carries their team's colour.
- **Open positions** are dashed cards with their status (open, hiring or on hold) and a note, placed where they would sit. A switch hides or shows them.
- **Search** lights up the person and scrolls to them; a **team chip** shows one team; **Not on the chart yet** lists anyone on the roster who has no seat.
- **Click anyone** for their reporting line: who they report to, who reports to them, and their profile. An open position offers **Ask HR to recruit** (the Position recruitment request).
- **A person's page** now says who they report to, their direct reports, and **See on the org chart** (which opens the chart with their card).

**Executives and admins** (the Admin and Executive profiles) can change it:

- **Rearrange**: drag someone onto the person they report to, or onto their team's name to make them one of its leads; their people move with them. An Undo follows every move. Nobody can be moved under someone who reports to them.
- In anyone's card: **Reports to** (anyone except their own people, or the executive directors), **Direct reports** (tick who reports to them; anyone unticked moves up a level), the **title** (their role everywhere in the Hub), **Add an open position under them**, and **Take them off this seat** (the seat stays as an open position).
- **Open positions**: add one anywhere (or with + on any card while rearranging), set its title, team, status and note, **fill it** with someone (their old seat stays as an open position), or **remove** it (anyone under it moves up).
- **Place** someone who is not on the chart yet (their team's lead is suggested).

The roster keeps the chart in step: someone new gets a seat under their team's lead, someone who leaves leaves an open position behind (with "Was Name's seat"), and a changed role changes the seat's title.

## The first chart

Built from the roster on 26/09/26: 38 seats. The two co-executive directors at the top; the team leads report to them (Ahmed and Eno for Operations Montreal, Shima for Program Development, Tate for Operations Toronto, Ian and Kahkashan for Marketing, Amanda for Fundraising, Valex for HR); each team reports to its first lead, with two readings from the roster: Tuna to Valex (his role says so) and Cindy to Suhaib (grants). It is a starting point for the executives to adjust.

## How it works underneath

- `org_positions`: one seat per person (`member_id`, empty for an open position), a `title`, a `department`, `reports_to` (another seat; empty means the executive directors), `kind` (exec or staff), `status` (filled, open, hiring, on hold) and a `note`. Everyone on staff reads it; nobody writes to it directly.
- Every change goes through a checked function (`org_move`, `org_set_reports`, `org_add_opening`, `org_update`, `org_fill`, `org_place`, `org_vacate`, `org_remove`) that allows only `wa_org_editor()` (admins and the Executive profile), refuses loops, and writes the change to the audit trail.
- A trigger on `team_members` gives new people a seat, empties the seat of someone who leaves, and keeps titles in step with roles.

## Release checklist

- **Access**: no new page. Reading follows the Org chart page (every staff profile; Board member: nobody, as before). Changing it needs the Admin or Executive profile, enforced in the database; the profile editor's note for the Org chart says so, and the Executive and Admin profiles list "Rearrange the org chart" among what they can do (logged in the audit trail).
- **Training**: the Org chart page tour is rewritten for the new chart (seven steps: the page, the bar, the board, the executive directors, a team, an open position, Rearrange); the academy's "Page tour: Org chart" says what it now shows.
- **Security review** (the Supabase security advisor, run after the deploy): no new findings from the org chart (its functions are for signed-in staff only and check `wa_org_editor()` inside). It showed two older ERROR findings, both fixed in `wa133_security` after a rolled-back dry run (`wa133_security_test.sql`):
  - `wa_brand_assets_list` was a SECURITY DEFINER view that kept the default write grants, so any signed-in account (not only admins) could change the brand assets through it; confirmed in the dry run (an outside account could update all 54 rows). It now runs with the reader's rights and is read only; everyone can still read it, and admins still write to `wa_brand_assets`.
  - `task_files_delete` let staff delete an attachment when their own profile name matched its author, and anyone can change their own profile name. Each attachment now records the verified email of whoever added it (`by_email`, stamped by a trigger whatever the request says), and that is what the delete rule checks (admins can still remove any). There were no attachments yet, so nothing needed backfilling.
  - Two stage tables left over from earlier deploys (`wa_stage_pw`, which still let anonymous callers write to it, and `wa_stage_v69`) are dropped.

## Verification

- Database: a dry run in one rolled-back transaction covered the seed (38 seats, the eight leads, nobody left out), moves, loops refused, the executive directors kept at the top, choosing direct reports (in and out), adding an open position, filling it (the old seat left open, the role updated), removing (only empty seats), taking someone off a seat and placing them again, retitling, the roster trigger (a new person, a changed role, someone leaving), someone who is not an editor refused, staff reading, no direct writes, and no anonymous reads.
- `test/w133drive.js`: an editor at 1366 (43 checks) and 390 (39), a member at 1366 (20) and 390 (21), and a board viewer.
- Regression: the drives for waves 132, 131, 127, 130, 122 (36 of 36), 116k and 116m (updated to open a person from the new chart) are green; the harness for three identities differs from the previous live build only on the Org chart page; churn is clean; the Org chart tour and the person page tour walk to the end without errors (the open-position step is skipped while the chart has none).
- Live: the md5 matches the build, and the live page boots with no errors.
- Security fixes: the dry run checked that an attachment records its real author even when the request claims someone else, the author cannot rewrite it, someone who copies the author's name cannot delete it, the author and an admin can, and admins still write the brand assets. A signed-in outsider can read the brand view but is refused when writing to it, and anonymous visitors can still read it. The advisor shows neither ERROR after the fix.
