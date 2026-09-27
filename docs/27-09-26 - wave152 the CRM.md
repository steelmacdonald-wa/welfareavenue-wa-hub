# Wave 152: the CRM (27/09/26)

Steel: "hub.welfareavenue.com: the Hub ... the CRM as an app inside the Hub, hub being the back end", "All contacts essentially, email marketing capabilities and automation, details about each contact we have", and "CRM visible to all staff".

## What shipped

A new page under People, **CRM** (`#crm`), on the tables of the CRM foundation (migration `wa150_crm_foundation`, 27/09/26): 481 contacts from the old website's volunteer sign-ups (the Django export of July 2026), the Hub roster and MTL volunteering, each volunteer with their servings from the event rosters.

- **Contacts** (`#crm`): everyone, with what they are to us (volunteer, donor, partner contact, supporter, staff, alumni), how to reach them, their volunteer roles, how often they served and when we last saw them. Found by kind, volunteer role, activity (served in the last 12 months, never served, record to review, no email, new this month) and email permission, or by any name (accents ignored), email, phone (any format), school or tag. Sixty at a time.
- **A contact's page** (`#crm/c/<id>`): their details, what they did with Welfare Avenue (roles, Hub servings, the old website's servings and hours, gifts, organizations from Partners, the roster and Hub profile links), their email permission (CASL), tags, and one timeline: notes, calls, meetings, emails and texts logged here, servings (confirmed, could not come, upcoming), gifts with their tax receipts, and the old website's history. Staff edit the details (a volunteer's name, emails, phones and address are saved on their volunteer record too, so MTL volunteering and the CRM stay one record), log what happened, tag, record the permission and link an organization. Adding a contact stops on an email or phone already in the CRM; a new volunteer gets a volunteer record first.
- **Possible duplicates** (`#crm/dupes`): the same email or phone on two contacts. Keep one (`crm_merge_contacts()`, which also merges two volunteer records through `volunteer_merge()`) or mark them as different people (`crm_dupe_dismissals`).
- **Sources** (`#crm/sources`): where the contacts come from, what joins next (the old website's history, website messages, Zeffy gifts, the Keela export), the email permission count before any campaign, and what to tidy.

## Access

Every profile gets the page (`all`); the Board member profile gets `none`, and directors never see it. The database follows the page: every CRM policy carries `coalesce(wa_page_ok('crm'), true)`, so a profile without the page reads nothing through the API either (checked with a simulated JWT: a board-profile staff account reads 0 rows, a marketing member reads 481). The author of a timeline entry (or an admin) deletes it; `crm_merge_contacts` is not executable by `anon` and checks the page access inside.

## Files

- `build/parts152/*.js` → `build/src/152_wave152.seg` (in MANIFEST after 151, before 110).
- Menu: `parts134/a_head.js` (People: orgchart, training, crm). Labels and groups: `parts127/a_head.js`, `parts131/a_head.js` (`LABEL`, `GROUPS`, `LOCK`), `TAB_LABEL` in `src/110_wave110.seg`. The parts of 127, 131 and 134 also caught up with wave140's edits (they had been made in the segments only).
- Database: `build/data/wa152_crm.sql` (applied as migration `wa152_crm`), `build/data/wa152_crm_access.sql` (profiles, audit trail, the `tour:crm` training; run at deploy).
- Tests: `test/w152drive.js` (65 checks: admin, a member on a profile, a member whose profile says none, a member with their own tab list, a director, phone width).
- Tour: `w122.tours.crm` (10 steps).

## Still to come

The old website's history (`crm_volunteer_history`) and messages, the Keela contacts and gifts, Zeffy, and the email layer (auto-replies, receipts, campaigns with the CASL check) in later waves.
