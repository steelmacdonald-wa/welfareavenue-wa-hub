# 05/11/26 - wave274: the Toronto Volunteers app

Steel (05/11/26): "review a little bit about how Tate runs his volunteering events with Sama ... a robust, easy to use volunteer management tool for Toronto using Emil's design and animation skills for this new app in the hub ... It also should integrate with the CRM as well in the hub, like the Montreal volunteer manager does."

Toronto runs a different kind of event from Montreal's Sunday servings. About once a month the team books a community kitchen (usually the Ralph Thornton Community Centre) for a time window, one crew cooks there, and the meals go to one or two organizations that sent a headcount and dietary needs ("40 people, halal and nut-free, three vegetarian and one vegan"). Sometimes a second crew serves the meals outdoors. Intake is still two Keela forms, and Sama confirms people by hand, by email, phone or WhatsApp.

Toronto Volunteers is a new app in the Hub (page `toronto`), built for that way of working, on the same tables as Montreal. A Toronto volunteer is the same CRM contact, with the same servings count and history, as anyone else. The plan behind it is `docs/05-11-26 - the Toronto Volunteer Manager plan.md`; this wave's brief is `docs/toronto/wave274 brief.md`.

## The screens

| Screen | Where | What it does |
|---|---|---|
| The app | launcher, `#w153pop` and Home's Your apps | Toronto Volunteers (purple, the people icon), after the Volunteer Manager. Your apps for the Toronto team (profile `opsto`, with the CRM). The rail: Events, then Volunteers. The app's action is New event: on a computer wave197 shows it at the masthead's right (Toronto's purple on Events, quiet on the other pages), on a phone the app bar shows it. |
| Events | `#toronto` | "Toronto events", "Cook together, then bring the meals to the people who need them." The next event as a dark hero card: the date large, "In 9 days, at 10:00", the title, the kitchen and its time, "Meals for: Eva's Initiatives (40)" (a private organization reads "1 organization, not named publicly"), "3 of 9 confirmed", one bar per crew (confirmed over waiting), the stage. Then the upcoming events as compact cards with the same facts (a cancelled one dashed, with its chip). Then "Past events (n)", folded, each with its meals delivered. Empty: "No Toronto events yet." with New event. |
| New event and Edit | sheet | Date (required), Start time (10:00), Kitchen (suggestions from past Toronto events and Ralph Thornton Community Centre), Kitchen time ("10:00 to 14:00"), Meals planned, Title ("Free meal event"), Note. Create opens the new event's page. |
| The event page | `#toronto/e/<id>` | The title, the date, the time and the kitchen in the masthead with All events; the status, the code, how far away; Edit; More (Cancel this event, with a confirm sheet; Plan this event again, or Reopen this event). The stage strip Plan, Crew, Confirm, Wrap up: the current stage from the date (more than 10 days Plan, 10 to 3 Crew, 2 to 0 Confirm, past or completed Wrap up), each a button to its section. The current stage's main action is the page's primary button. |
| Plan | section | The kitchen card (place, time, contact, start; Edit opens a small sheet) and Who the meals go to: each organization with its meals, dietary chips (Halal, Nut-free, 3 vegetarian, 1 vegan, other), drop-off, contact, a lock for one not named publicly; Add an organization, Edit, Remove (confirmed in place). "40 of 50 planned meals placed". Without the recipients table: one quiet line. |
| Crew | section | One column per crew (stacked on a phone) with "3 of 4" and its bar: Lead, Kitchen crew, Serving crew, Delivery, Photos (Photos only when it needs someone or has someone). Each person: name, school chip or General, status chip, a menu (Confirmed, Can't come, Waiting, Open in the CRM, Take off the crew with a 5 second Undo). Add people (the Toronto pool in a sheet: search, the same filters, a crew, Add), each column's own add button, Edit the targets (`spot_counts`). |
| Confirm | section | "4 confirmed, 2 waiting, 1 can't come"; Waiting to hear back with each person's phone and email and a Called toggle (who and when); Copy phone numbers and Copy emails, for all the crew or only those waiting (clipboard, then a fallback, then a box to copy from); the WhatsApp group link (open, add, edit, remove; only chat.whatsapp.com, wa.me or whatsapp.com links). |
| Wrap up | section | Meals delivered per organization (Save meals delivered), Who came (the confirmed people, Came or Didn't come), Mark this event completed (one more step while the event is still to come). A completed event shows a quiet summary at the top: "Completed. 40 meals delivered to 2 organizations. 3 people came." |
| Volunteers | `#toronto/people` | "Toronto volunteers" with the count. Search by name, email, phone or school; All, Students, General; School; Area; the days Mon to Sun; Sort by Newest, Last event or Name. Each row: name, school chip or General, area, the days as seven dots, Toronto events and the last (or next) one, Copy email, Open in the CRM (`#crm/c/<id>`), Add to an event (an upcoming Toronto event and a crew). An empty result says what to clear, with Clear the filters and Clear the search. |

Motion and the look follow the brief's design bar (section 6): the Hub's tokens and faces, the purple as Toronto's accent, press feedback (scale 0.97, 160 ms) on everything pressable, sheets up from the bottom on a phone and in from the right on a computer (the drawer curve, 280 ms in, 200 ms out), the bars filling from the left and the lists rising 40 ms apart on a page's first draw only, the status chips crossfading in 200 ms, the stage marker moving in 240 ms, hover only with a mouse, nothing moving on a keyboard action, reduced motion keeping the fades and dropping every movement. Escape closes a sheet or a menu and focus goes back to what opened it; focus stays inside an open sheet; saves and errors are said in an `aria-live` note or in words where the action was.

## The data

- A Toronto event is `volunteer_events` with `kind = 'meal'` and `location = 'Toronto'` (every Montreal automation filters `kind = 'service'`). The app reads them with `.eq('kind', 'meal')` and keeps only a Toronto location in the browser too; it never writes a service row.
- New event: the code from `wa274_next_code(p_date)`, or `TO-<yy>-<n>` worked out from the loaded Toronto events until the SQL is applied.
- Crews are `event_roster` rows with the shared role keys: `team_leader` Lead, `cook` Kitchen crew, `server` Serving crew, `driver` Delivery, `photographer` Photos. Targets from `spot_counts`, else 1, 4, 4, 1 and 0. Confirmed: `status 'Confirmed'`, `confirm_status 'confirmed'`, `confirmed_at`. Can't come: `'Unavailable'`, `'declined'`. Waiting: `'TBD'`, null. Called: `detail.called_at` and `detail.called_by`. Taking someone off deletes the row after the 5 seconds of Undo.
- Adding a person: `wa274_crew_add(p_event, p_contact, p_role)`, which gives a CRM contact a volunteer record when it has none. Until the SQL is applied, a contact with a `volunteer_id` goes straight onto the crew (`event_id, person_id, person_name, role, status 'TBD', detail {source 'toronto', contact_id}`) and one without is named in the sheet: "needs the wave274 database update first".
- Who the meals go to: `volunteer_event_recipients` (new in `build/data/wa274_toronto.sql`, not applied).
- The Toronto pool: `crm_contacts` not merged, with a tag `toronto`, `toronto volunteer` or `toronto student`, or a city in the GTA, or a volunteer record on a Toronto crew; asked of the server three ways and filtered again in the browser. School from `org_id` (`volunteer_orgs`); area, days, age and consent from `crm_contact_fields` (`gta_area`, `days_available`, `age_16_plus`, `photo_consent`; strings, lists and sentences all read).
- Edits go to the audit trail through `logChange('volunteer_event', ...)` and `logChange('event_roster', ...)`, never in the way of a save.
- Access: the page follows the Volunteer Manager's until the SQL gives every profile `toronto` (a `wa40Allowed` wrapper that reads the person's profile through `window.w127`); a profile's own word for `toronto` wins once it has one; directors never get it.

## Montreal leaves Toronto out

`waVolLoad` (wave20) fills `WA_VOL_EVENTS` from `volunteer_event_summary`, every row. Wave274 wraps it: after it resolves, the list leaves out rows with `kind = 'meal'` or a Toronto location. Find volunteers (`parts191/f_recruit.js`, `upcoming()`) and the spots bars (`234_wave234`) read that same list. Readers that load events themselves and still see Toronto: the CRM Forms editor's event picker (`parts152/i_forms.js`, `LOADERS.fevents`: every planned upcoming event, any kind) and the planned events count in wave35's stats (`035_wave35.seg`). The Operations Montreal tile (wave116), Assign (wave257), the Home serving card (wave171) and wave218 already keep to `kind = 'service'`. The Hub's calendars (124, 128) show volunteer events of every kind, Toronto's included.

## Also in this wave

- `parts153`: `APPS.toronto`, `'toronto'` in `ORDER` after the Volunteer Manager, `TEAM_APPS.opsto = ['toronto', 'crm']`, the tab hidden from the Hub's menu, the New event action. With ten apps the launcher no longer fitted a 900 px tall screen (840 px in a 780 px box), so up to 960 px tall each blurb keeps to one line.
- `parts127`, `parts131`: `toronto` in the Teams group, labelled Toronto Volunteers. `parts134`: `toronto` in the apps group. `110`: the label. `118`: the masthead.
- Home's Your apps is drawn again once the page is registered, so the app is there from the start.
- Wave272's corner note (add the Hub as an app) closes when a Toronto sheet opens, keeping its own rule of never sitting over a window.

## Tests

- `test/w274fx.js`: three Toronto events (TO-26-1 past and completed, TO-26-2 in 9 days, TO-26-3 in 40 days), their crews, fourteen made-up CRM contacts (eleven in the pool: tags, a GTA city, only a crew place, two schools, one without a volunteer record; one merged away and two in Montreal that must stay out), area and days answers, who the meals go to for two events (one not named publicly), and a Montreal serving on the same day as a Toronto event.
- `test/w274drive.js`: admin and plain (a member on the opsto profile) at 1366 and 390 px; then the fallbacks before the SQL (a direct crew row, a contact without a volunteer record named in the sheet, the code worked out locally, the recipients line); the other edits on a phone (Edit with only the changed fields and the audit trail, the kitchen, the targets, removing an organization, meals delivered, Didn't come, Cancel); and a board viewer: 222 passed, 0 failed. Run it with `export WA_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome; bash build/build.sh && CAND=build/candidate.html node test/w274drive.js` (`WA_SHOTS=<folder>` saves the screenshots).
- Regression on the same build: `w259drive` 22 of 22, `w191drive` 39 of 39, `w272drive` 152 of 152, `w195drive` 52 of 52, `w153drive` 45 of 46. Its one failure (the dock at the foot of a menu taller than the screen) fails the same way on the build before this wave. Its launcher check now lists Toronto Volunteers after the Volunteer Manager.

## Design review

A separate reviewer checked the screens and the code against `docs/toronto/design review brief.md` (Emil Kowalski's rules and Apple's fluid-interface rules). Applied:

- **On a phone**:
  - The School, Area and Sort selects are 16 px, so iOS no longer zooms in when one is tapped. They also sit in one label column.
  - Each phone number and email in Confirm is its own 44 px line.
  - The note at the foot of the screen fits on one line (`width: max-content`).
  - A sheet takes focus itself on a touch screen, so no keyboard or date wheel rises while it slides in.
  - The grab handle is gone, since there is no drag to dismiss.
  - A long press doesn't select a button's label.
  - An empty `touchstart` listener lets iOS Safari show the press.
- **Contrast**: the hero card's focus ring is the purple one; gold on the page was about 2:1. Placeholders use the app's muted ink, 4.5:1 or better.
- **Hierarchy**:
  - A crew's "2 of 4" is the largest thing in its column (Barlow 24 px).
  - Add an organization is full size when it is the Plan stage's primary.
  - "Upcoming" and "Past events" match the other titles (30 px, no tracking), and the big numerals are tightened (-0.01em).
- **Motion**: a menu closes when the page scrolls away from its button. With reduced motion, a press dims to 85% instead of doing nothing.
- **Words**:
  - "the Toronto database update", not "wave274".
  - "Counting meals delivered opens once …".
  - "Mei Example: not called yet."

Not done here, outside this wave's selectors:

- The phone's app rail shows "TORONTO VOLUNTEERS" in capitals and a filled New event next to the page's own primary.
- `000_head_base.seg` has no `viewport-fit=cover`, so the sheet's safe-area padding is 0 on an iPhone.

## Left for later waves (the plan, section 5)

- wave274c: the Toronto sign-up forms in the Hub (general and student) and Sign-ups.
- wave274d: the Keela answers imported onto the CRM contacts.
- wave274e: messages: the confirmation email, the call for volunteers, reminders, a Toronto switch for anything automatic.
- wave274f: Prep (the recipe scaled to the headcount and dietary needs, groceries, the kit) and Setup.
- wave274g: the Toronto SOP, the page tour, an Avenue Academy lesson.
- Applying `build/data/wa274_toronto.sql` (Steel).
