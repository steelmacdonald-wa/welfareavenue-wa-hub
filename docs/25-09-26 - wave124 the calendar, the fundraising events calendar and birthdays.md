# 25/09/26 - wave124 the calendar, the fundraising events calendar and birthdays

Live md5 `7166ec40f061ce73918567ce0d2a62fd` (3,162,809 bytes), deployed through the gated pipeline (`wa_stage_qs`, guard on live `52b18710`, dropped after).

## What Steel asked

"Set up fundraising events calendar under fundraising and finance tab", "a master calendar with all fundraising events, meetings (limited to each user and where they are invited), marketing posts past and future, volunteering events, etc", and "allow individuals to add birthdays to their profile". (The SOPs for past events are the next wave.)

## The calendar (#calendar)

In the menu right after Home (the board has no Home, so for board viewers it sits in Strategy after the Executive dashboard). Month grid or agenda list, previous and next month, Today, and five layers you switch on and off (remembered per browser):

- **Fundraising events** from the events calendar. One-day events sit on their day; month-long and season-long events sit in a band above the grid ("This month").
- **My meetings**: only meetings you are invited to. `calendar_my_meetings(p_from, p_to)` (security definer) returns the hub calendar's events where the organizer or an attendee is one of `my_emails()`: your sign-in email, its dotless spelling, your Workspace aliases (directory-sync v1.4 now stores `hub_directory.aliases`), and the primary address of any account that lists you as an alias. Cancelled events are left out.
- **Marketing posts**: published posts from social analytics (Instagram, Facebook, LinkedIn, TikTok) and planned or scheduled posts from the content calendar.
- **Volunteering**: serving events (staff only).
- **Birthdays** (staff only), per each person's sharing choice.

Every item opens a sheet with its links: join the meeting (Meet link, Google Calendar, the team agenda), the post, the planned post in the content calendar, the serving event, the person, or the fundraising event. The side column has Up next (five weeks), Fundraising next and the month's birthdays with "Add your birthday". Deep links: `#calendar/2026-12`, `#calendar/agenda`, `#calendar/month`. The agenda always shows a Today row for the current month.

## The events calendar (#fundevents)

Under Fundraising & Finances (in its menu before Finances, and an "Events calendar" link on the Fundraising team page); for board viewers in Strategy after the calendar.

- **Goals**: fiscal 2026-27 from October 1, what the events raised against the $10K minimum, $15K healthy and $20K target (from the plan), the sum of the targets of the planned events, and what the summer 2026 kickoff raised in fiscal 2025-26.
- **The year at a glance**: every dated event on a strip from August 2026 to September 2027, with a mark where the fiscal year starts.
- **Season by season**: Summer 2026 (the kickoff), Fall 2026, Winter 2027, Spring and summer 2027, then the ideas backlog and the planning notes. Each card: status, when, partners, target, raised, result or notes, a warning when the date has passed and nobody recorded how it went, and links to the project board and the SOP (the SOP link fills in with the next wave).
- Leaders and the fundraising team add events and ideas, edit them and record results (raised, a result note, status done); leaders delete. Everyone else reads. Deep link `#fundevents/<id>`.

Data: `fund_events` (22 rows seeded from "Fundraising Events Calendar 2026-27"; Flag Football 2026 is done with $2,800 raised, 13 teams and 78 players on August 8; Rally Paper 2026 is set for September 19 and 20 and still planned, so its card asks for the result) and the `fund_goals` setting (minimum, healthy, target, notes, planning notes, source).

## Birthdays

`hub_birthdays` (email, month, day, share: everyone, team or me; checked days, so no February 30). People add or change theirs from their profile (a pill beside their email) or from the calendar; other people's profiles show theirs when it is shared with them. RLS: staff read what is shared with them (everyone, their own, or their team), and write only their own; admins can delete.

## Access

Both pages are enrolled for every role. People with their own tab list (three admins and two leaders today) never had the new pages on it, so `wa40Allowed` now adds the calendar for everyone signed in and the events calendar for anyone who can see Fundraising or Finances, and for the board.

## Academy

Page tours for both pages (trainings 82 and 83, `build/data/wa124_tours.sql`), registered into wave122's tour engine from wave124.

## Files

- `build/data/wa124_calendar.sql` (migration wa124_calendar), `build/data/wa124_tours.sql`
- `build/parts124/*.js` assembled by `build/parts124/assemble.py` into `build/src/124_wave124.seg`
- `fn/directory-sync` v1.4 (aliases)
- Tests: `test/w124drive.js`, `test/w124shots.js`, fixture rows from `build/data/w124_fixture.py`

## Verification

`test/w124drive.js`: 35 checks as Steel, 35 at phone width, 29 as Amanda (a custom tab list, no edit rights), 20 as a board viewer. Harness 36 pages x3 identities against the live build with the same fixture: only the two new pages and the menu differ (plus the known timing noise on hrcentre and goals); only ERR_FAILED errors. Churn zero on twelve views (calendar, agenda, a deep-linked month, events calendar, an event, the Fundraising team page, two profiles, Home, Marketing, Requests, the Executive dashboard). Every page tour runs to the end (31), academy drive 35/35. Screenshots in `test/shots_p124`.

## For Steel

- Rally Paper 2026: the date has passed; record how it went (raised, result) from its card. The task list said September 19 and 20; one meeting summary said September 21 and 22.
- Après-Ski: the plan names the partner "Croissound (St-Sauveur)" but the note says "Croissant runs one each winter". The card says "They run one each winter"; tell me the right name.
- Seen while testing (live before this wave): board viewers see seven empty chevrons at the top of the menu (the department rows they cannot open). Goes on the browser test list.
