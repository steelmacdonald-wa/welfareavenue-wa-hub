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
- Tests: `test/w152drive.js` (68 checks: admin, a member on a profile, a member whose profile says none, a member with their own tab list, a director, phone width).
- Tour: `w122.tours.crm` (10 steps).

## The same day: the imports (wave 152b)

Steel: "OK to events and photos - both fundraising and volunteering", then "You can probably add a lot of our past events given the volunteering events recorded in the old website".

- **The old website's volunteer sign-ups**: the Django admin has no export with attendance, so the 86 volunteering events' change pages were read in the browser (Steel logged in) and staged into Supabase: 644 sign-ups, 304 Django volunteers, every one matched to a CRM contact (299 by email, 6 by phone; when the two disagreed, the contact whose name matched and who has a volunteer record won, and the site's email went on the contact so the pair shows under Possible duplicates). `crm_volunteer_history` holds them all (529 served, 1,114 hours); the contacts carry `legacy_refs.django` (the site's volunteer id, email, phone, address). `build/data/wa152_django_history.sql`.
- **The website's messages**: 582 contact-form rows are 235 distinct messages (the form saved most of them several times); 14 bot messages stay out; 221 messages for 162 senders went into `crm_interactions` (kind `website_message`, source `website`, `source_ref` contactform:<id>), 101 senders new to the CRM as supporters from the website (tag `wrote to us`, no permission recorded). The form never kept a date: the messages carry `occurred_at` 2000-01-01 and `meta.undated`, the timeline shows "date not recorded" and keeps them last. `build/data/wa152_django_messages.sql`.
- **The old website's events are MTL volunteering's past events**: 74 `volunteer_events` rows (WA-20-01 to WA-25-23; the 12 Sundays of 2026 already in the Hub were linked by day, not copied), each with its roster of who served (529 `event_roster` rows, Confirmed, in their role, `detail.source` old website with the hours), 2 hidden empty events as cancelled, 3 tabling days as kind `outreach`, the run-sheet steps the trigger seeded removed. `crm_volunteer_history.volunteer_event_id` points at the Hub event and `crm_contacts_v` counts a serving once: through the Hub roster when linked, else as the old website's (`legacy_hours` stays the old site's record). The volunteers' roles on their record gained the roles they served in. `site_events.volunteer_event_id` links every website event to its Hub event; the 4 hidden Django events joined `site_events` unpublished. `build/data/wa152_history_into_hub.sql` (migration `wa152_history_into_hub`).
- **Possible duplicates** now compares every email a contact has (case ignored) and phones by their digits, not the first email and the phone as typed: 36 pairs instead of 27. `build/data/wa152_duplicates_any_email.sql` (migration `wa152_duplicates_any_email`).
- The contact page: "N servings with us (MTL volunteering), the last on …, H hours on the old website's records"; a served row that is in the Hub shows once, from the roster ("The old website, now in MTL volunteering"); undated messages say so. Tests: `test/w152drive.js` (68 checks).

## Still to come

The Keela companies (Partners?), Zeffy gifts, and the email layer (auto-replies, receipts, campaigns with the CASL check) in later waves; the 9-dot app launcher (Admin centre, HR centre, Finance, CRM) with the CRM's side rail.
