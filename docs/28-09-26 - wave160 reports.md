# 28/09/26 - wave160: reports (the CRM's Reports tab: one fiscal year at a glance, against the year before)

The first of the plan's month-by-month items after the five Keela waves ("reports: retention, campaigns, volunteer funnel"), built now because the next Keela steps wait on decisions: wave158b on the treasurer's receipt settings and Steel's word on whether the Hub issues receipts (his Zeffy verdict), wave159 on Keela's exports. The fiscal year closes on Wednesday 30 September, so the year-end numbers for the board come from here. The tab only reads, apart from Make a list; it needed no decision and sends nothing.

## What it does

- **Reports** (`#crm/reports`; another year at `#crm/reports/<the year it starts>`, so `#crm/reports/2024` is 2024-25): the CRM's tenth tab, and the rail's Reports group (the rail had shown Reports as "next in the CRM" since wave153). A year picker (the fiscal years with a gift or a serving), Copy the summary, Print (the report alone), Refresh, and the time the figures were worked out.
- **The headline numbers:** raised, donors (and how many are new), volunteers who served (and how many for the first time), servings (and at how many events), each against the year before; while the year is still running, against the year before at the same date.
- **The year in a few lines**, ready for the board: the gifts against last year, the donors (first-time, retained with the rate, came back after a gap, gave last year and not yet this year), the volunteers (served, for the first time, came back), the applications, and the emails and form answers when there are any. Copy the summary puts "Fiscal year 2025-26, to 28 Sep 2026" and the lines on the clipboard.
- **Gifts:** by month for both years with the best month; where the money came from (kind, campaign, platform with the method), the receipt status of the year's gifts with a link to Receipts, and a note that Keela's gifts came in as donations; gift sizes (six bands, the average, the middle gift, the largest) and the ten largest donors.
- **Donors:** gave for the first time, gave again, came back after a gap, gave last year and not yet this year; the retention rate; the people who gave last year and not yet this year (the largest givers first, with their last gift and their gifts in all), and **Make a list of them**, which saves them as a fixed list in Lists for a thank-you or an appeal.
- **Email:** permission today, counted from the contacts with the CRM's own rule (who can get a newsletter, express, implied, implied consent ending within 90 days, unsubscribed, bouncing, no permission, no address); the emails of the year (sent, delivered, opened, clicked, unsubscribed; from campaigns and from automations; tests left out) and the form answers of the year.
- **Volunteering:** servings by month for both years; volunteers (served, for the first time, came back from last year, retention), roles, the ten with the most servings, from applying to serving (people whose latest application falls in the year, then served at least once, twice, three times since), and the hours and meals in words (the Hub records neither; the old website recorded hours until 9 Feb 2025 and meals until 19 Jan 2025).
- **How it is counted**, at the foot of the page. Names open the contact's page. On a phone the page is one column and nothing scrolls sideways.

## The database

`crm_report(p_fy int default null)` (migration `wa160_reports`): the fiscal year that starts on 1 October of p_fy (the current one when null) as JSON. Security invoker, so every table's RLS applies; it checks `is_wa_staff()` and the CRM page first; stable and read-only; revoked from public and anon, granted to authenticated. Counting rules are the CRM's: a gift counts on the day it was received in Montreal time; a serving is a Confirmed roster row at a completed volunteer event (as in `crm_contacts_v`, the old website's events included since wave152); a person on the roster without a volunteer record counts once by name; first-time means the first gift or serving ever falls in the year; retained means the year and the year before; came back means a gift in the year, none the year before, and an earlier one. It takes under a second on today's data.

## What it says today (live data, 28/09/26)

Run as Steel's account inside a transaction that was rolled back: in 2025-26 to 28 September, 28 people gave $3,708.19 in 29 gifts (2024-25: $4,567.10 from 21 people). 23 gave for the first time, 5 of the 21 donors of 2024-25 gave again (24% retention), and 16 have not given yet this year. 20 of the 29 gifts are the Football Fundraiser 2026 registrations that Keela recorded as donations ($2,400); the other 9 are the fundraising campaign ($1,308.19). 86 volunteers served 187 times at 11 events (2024-25: 92 volunteers, 157 servings at 10 events); 69 served for the first time and 12 of the 92 came back (13%). 42 people applied (their latest application), and 12 have served since. No email has gone out from the Hub (test mode) and no form has been answered (the forms are drafts). A check of the first-time volunteers against Possible duplicates found one who may have served before under a second record.

## Access

No new page: the tab follows the CRM page. `crm_report` was run for every signed-in account inside a transaction that was rolled back: the 31 staff with the CRM page get the report, the other 5 accounts are refused, and the outcome matched the CRM's access rule for every one. Make a list writes `crm_lists` under its wave155 policies (staff with the CRM page). Security advisor after the migration: no ERROR, and nothing new (crm_report is security invoker; no CRM function is callable by anon; the signed-in security-definer list is the known one).

## Files

`build/data/wa160_reports.sql` (applied as `wa160_reports`); `build/parts152/l_reports.js` (the tab) with hooks in `c_list.js` (the tenth tab, the route, the paint), `f_wire.js` (tour step, test hook `window.w160`), `assemble.py`; `build/parts153/a_head.js` (the rail's Reports group replaces the "next" item) and `e_wire.js` (the apps tour's last step); `test/w160drive.js` (39 checks); `w152drive` to `w157drive` updated for ten tabs and the rail's Reports item; `docs/DATA_MODEL.md` regenerated.

## Deploy

Live since 09:30 on 28/09/26 (Toronto): the Hub at md5 91ff97c07342408e21883fbb1fd93f44 (4,528,797 bytes), through the gated pipeline (stage table `wa_stage_w160`, guard on the live ffad5da9, dropped after); the form page and `_redirects` unchanged. The release is in `change_log` (entity_type release, wave160). The live page boots with wave160 and no page errors (checked headless through the sandbox proxy).

## Tests

On the candidate: `w160drive` 39, `w158drive` 23, `w157drive` 26, `w156drive` 26, `w156page` 14, `w155drive` 22, `w154drive` 30, `w153drive` 44, `w152drive` 68, `w151drive` 26, `w147drive` 12, `w143drive` 16, `w141drive` 11, `w140drive` 50, `w139drive` 7, `w136drive` 16, `w134drive` 37, all green; `w150drive` 34 of 35 (the logo check needs the network, as before).

## Next

Once sending starts, the campaigns part of the reports (results by campaign, list growth, unsubscribes by month); once the forms are live, the volunteer funnel from the form answers rather than the latest application date. Other ideas when wanted: a Reports tile on the Executive dashboard, retention by the year people first gave or served, and a download of a report as a spreadsheet.
