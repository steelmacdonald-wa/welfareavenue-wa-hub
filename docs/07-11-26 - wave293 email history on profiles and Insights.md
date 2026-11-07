# wave293: the email history on profiles and the Insights tab (07/11/26)

**Status: built, not released.** Branch `email-history-289` (worktree `hub-repo-mail289`), on top of wave289 and wave292, neither released. Nothing applied, deployed or swapped. Design: `claude/crm-rebuild/03 email history, interactions and insights - design.md` v2, section 11.5 (with 5.8, 5.9, 6, 11.1 and 11.2). The third and last of the email history waves: wave289 scans Steel's mailbox and hub@ (info@ arrives there) into a private holding area, wave292 moves it into the CRM through the Import page and writes the summaries, wave293 shows it.

## What it does

**A contact's page (`#crm/c/<id>`)**
- **Email threads on the timeline.** The email history's lines (`crm_interactions` with `source = 'gmail'`) have their own query, so a long correspondence never pushes notes and gifts off. They are grouped by thread: "Email thread: <first subject>", "5 emails, 12 Mar to 2 Apr 2021", the latest line, and Show the emails, which lists each one (date, from or to them, mailbox, line). One email stays one item ("Email from them: <subject>"). The by line names the mailboxes ("From Steel's mailbox", "From hub@ and info@").
- **Filters by kind:** All, Emails, Notes and calls, Forms, Gifts, Volunteering (only the kinds the person has, with counts); under Emails, the topics. Page state only. A long history shows 50 items and Show 50 more.
- **Open in Gmail** shows only to Steel and only on items from his mailbox. **No Delete** on an email item (wave292's policy refuses it anyway; Undo on the Import page is the way back).
- **The Relationship card**, above the timeline: the type and how sure ("Partner, 86% sure", or "Not sure (perhaps partner)" under `mail_history_type_unsure`), May be out of date when stale, the counts in words ("First email 14 Mar 2021, last 2 Oct 2026, 23 emails in 6 threads", "One email, 12 Mar 2021"), the topics, anything still open (with the date it was written), the summary, "Written by the Hub on <date>" and Refresh (about 1¢). Refresh runs the one summary path, mail-history `insight` (crm_insight_input, the `mail_history_insight` route, crm_insight_save), and shows the function's own words when it refuses. Never "AI".
- **Visibility (M3, H1).** Steel's mailbox lines and summaries marked `from_steel` reach admins only until `mail_history_steel_open` is true: wave292's row security does it, and this page simply draws what comes back. An admin sees "admins only for now" on those items and a note on the card.

**The Insights tab (`#crm/insights`)**, a CRM tab after Reports and a rail item under Reports, drawn from one call, `crm_insights_overview()`:
- **Relationships by type over time:** the people who emailed with Welfare Avenue each year since 2020, one stacked bar a year by type (Partners, Donors, Volunteers, Supporters, Government, Media, Suppliers, Other, Not typed), the total at the end.
- **Top organisations:** by the people who wrote and their emails, All time or Last 12 months (each ranked on its own: `orgs` and `orgs_12`), with relationship, status and the last email; "the top 25 of N" for the period shown.
- **Gone quiet:** donors, partners, supporters and volunteers with history and nothing on their timeline (any source) and no gift for `mail_insights_quiet_months` (12), the 100 who went quiet most recently first; never deceased, merged or do-not-contact people; a name opens the contact.
- No "waiting on a reply" list. While Steel's lines are closed, an admin is told the team does not see his mailbox yet; a member is told only that some email history is for admins for now (never whose), on the header and under Gone quiet.

The CRM tour gains two steps (the emails and the Relationship card on a contact's page; the Insights tab) and its tab list names Insights.

## What it changes

**Database** (`build/data/wa293_insights.sql`, md5 `21d56b61281415f03a66d5438dfd0768`; undo `build/data/wa293_undo.sql`, md5 `ebfd62d51997cabae052c1643c191f66`): one function, `crm_insights_overview()` (security invoker; `authenticated` and the service role; a comment). Being security invoker, every count passes the reader's row security: Steel's mailbox lines count only for admins until `mail_history_steel_open`, partners marked leadership only for leaders, and someone without the CRM page (or a board viewer, or nobody signed in) gets `allowed: false` and empty lists. It returns counts, dates, organisation names and the names of the people who went quiet; no email line, subject or summary. A release line in `change_log`. No live definition is changed and nothing is stored.

**The page**
- `build/parts152`: `d_sheet.js` (the split query, the thread grouping, the filters, the disclosure, the Relationship card, Refresh), `c_list.js` (the Insights tab and route, `paintInsights` into `#w293root`), `f_wire.js` (the handlers, the open threads kept across repaints, two tour steps, test hooks), `b_css.js` (the chips, the disclosure, the card). Segment `152_wave152.seg` regenerated.
- `build/parts293` (new, a guarded IIFE, `window.__wa293`): `a_insights.js` and `b_css.js`, the Insights tab (`window.w293.open(host)`). Segment `293_wave293.seg`, listed in `build/src/MANIFEST.txt` right after `284_wave284`.
- `build/parts153/a_head.js`: the rail item `#crm/insights` after Reports. Segment `153_wave153.seg` regenerated.
- Segment md5s: 152 `31b6ad95452f99641fcf41daff9846d0`, 153 `1fe4d45bfffeac82edd70854779c3278`, 293 `8a505bb5ae0168b85ba0d70d0c6fa1a1`; candidate `fd3b3590af1d76204d4d98a87a6c9bc1` (LF, 233 segments, check_remaps clean).
- The house style: press scale .97 at 160ms on `cubic-bezier(0.23, 1, 0.32, 1)`, never on a keyboard press (`:not(:focus-visible)`); hover only under `(hover: hover) and (pointer: fine)`; reduced motion keeps fades only (the thread list fades, the chevron turns); tabular numbers; 44px targets on a phone.

## Proofs

- `node test/w293sql.mjs` (PGlite, slice 1, wave289 and wave292 loaded): the migration twice with the body, grant and comment compared; `test/w293sql.sql` twice (as an admin: every count, Steel's lines included, the leadership organisation; as a member: Steel's lines and the leadership organisation left out; Steel's lines opened; the quiet setting moved and a bad value falling back to 12; gone quiet leaves out recent, giving, deceased, merged and staff-only contacts and a media type; no subject, line or address in the answer; no CRM page, a board viewer and nobody signed in get the empty answer); the undo twice; the stop without wave292; the live check files offline.
- `test/crm1ui_email_worst.js` with demo, worst, empty, one and huge data at 1366, 390 and 320 px and at 200% zoom; `test/w293drive.js` (its demo and one sets at 1366 and 390 px). Before and after screenshots in `.superpowers/sdd/01 foundations and Keela import - design/ui10-shots/eh293/` (hub-repo-crm1).
- `test/crm1ui_email_worst.js`: all five sets at 1366, 390 and 320 px 374 passed, 0 failed; at 200% zoom 118 passed, 0 failed. `test/w293drive.js`: 136 passed. The CRM tour (`tour1.js crm`): 20 steps, the Insights step highlighted, the new centred step shown, no error.
- The existing drives: w152 to w158b, w283drive 51/51, w284drive 40/40, crm1ui_crm_worst 145/145; w152 to w157 hold the CRM's tab and rail lists, now twelve tabs with Insights after Reports (updated). w153's two failures (the dock at the foot of a tall menu; the HR centre's rail) were failing before wave293.
- Live, rolled back (`build/sql_rollback_test.py`'s block): slice 1 in release order (wa281, wa282, wa283, wa284, wa286, wa288), wa289, wa292, wa293 and `test/w293live.sql` gave ROLLBACK_OK; the same with the undo twice and `test/w293live_undo.sql` gave ROLLBACK_OK. A read afterwards found nothing kept.

## Release steps (after wave292, each on Steel's yes)

wave293 rides with wave292 (design 11.7 steps 5 and 6):
1. After `wa292_batches.sql`, run `build/data/wa293_insights.sql` through the Supabase connector, a rolled-back run first (`build/sql_rollback_test.py` with slice 1's files, wa289, wa292, wa293 and `test/w293live.sql`). Check the advisor shows no ERROR.
2. Swap the page once for wave292 and wave293, rebuilt on the live page of the day (`build/parts152`, `build/parts153`, `build/parts293` and the manifest line).
3. Nothing to deploy: Refresh uses mail-history v2 (wave292's step 2).
4. After the batches are applied, open a contact with email history and `#crm/insights` signed in as an admin and as a member, and check the member sees no line from Steel's mailbox until Steel decides H1.

## Undo

- **The page:** swap back to the previous page.
- **The database:** `build/data/wa293_undo.sql` drops `crm_insights_overview()` and records the undo. Run it before wave292's undo (the order is 293, 292, 289, 284). Nothing else to put back.

## The wave293 fix round (07/11/26, from the review eh-293-review.md)

- **Refresh is no oracle (A-I1).** For a non-admin while Steel's lines are closed, mail-history `insight` answers a contact with lines from his mailbox exactly as it answers a contact with no lines (`{ok, saved: false}`), after the daily limit check that applies to everyone; neither the function nor the page mentions his mailbox to a non-admin. The card says "Nothing to summarise yet." The rule lives in `insightAnswer` (`fn/mail-history/summary.ts`), tested by `test/w292summary.test.mjs`.
- **Gone quiet leaves out do-not-contact people (A-I2).**
- **Last 12 months ranked on its own (A-M1):** the overview returns `orgs_12` and `orgs_12_total`.
- **A member's quiet list says it may be partial (A-M2)**, without naming the mailbox.
- **The timeline says when it shows only the latest 600 emails (A-M3).**
- The tab strip's icon is `trend`; the rail's is `chart` (A-M4).

## Where the build differs from the design, and why

- **The Insights tab is its own segment (`build/parts293`)**: new page code is a guarded IIFE with its manifest line after the newest slice wave (the controller's build rule), as wave284's Import page is; the design now says so. parts152 keeps the hooks (the tab, the route, `paintInsights`), exactly as it does for `#w284root`.
- **Gone quiet also counts a gift as being heard from, and leaves out do-not-contact people** (deceased and merged ones too); the design now says so.
- **The rail icon is `chart`, as the design says;** the tab strip uses `trend`.

## Files

`build/data/wa293_insights.sql`, `build/data/wa293_undo.sql`, `build/parts152/d_sheet.js`, `build/parts152/c_list.js`, `build/parts152/f_wire.js`, `build/parts152/b_css.js`, `build/parts153/a_head.js`, `build/parts293/a_insights.js`, `build/parts293/b_css.js`, `build/parts293/assemble.py`, `build/src/152_wave152.seg`, `build/src/153_wave153.seg`, `build/src/293_wave293.seg`, `build/src/MANIFEST.txt`, `build/candidate.html`, `test/w293sql.mjs`, `test/w293sql.sql`, `test/w293live.sql`, `test/w293live_undo.sql`, `test/w293fx.js`, `test/w293drive.js`, `test/crm1ui_email_worst.js`.
