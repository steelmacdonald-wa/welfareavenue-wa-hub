# 05/11/26 - The Toronto Volunteer Manager: the plan

Steel (05/11/26): "review a little bit about how Tate runs his volunteering events with Sama, and understand maybe through
Kila a bit about how they structure their intake for volunteers ... use the goldfish and elephant model to help us create
a volunteer manager for Toronto ... a robust, easy to use volunteer management tool for Toronto using Emil's design and
animation skills for this new app in the hub ... It also should integrate with the CRM as well in the hub, like the
Montreal volunteer manager does."

This document is the elephant: the one place that remembers everything about the Toronto build. Every wave starts by
reading it and ends by updating its ledger (section 9). Nothing in it is invented: each fact names where it came from.

## 1. How the build is run: the elephant, the goldfish and Emil

- **The elephant** is this plan and the session that keeps it. It holds the whole picture (what Toronto does, what the Hub
  already has, every decision and why) and never forgets between waves. It writes each wave's brief, reviews what comes
  back, runs the checks and updates the ledger.
- **The goldfish** are builders with no memory. Each one gets one brief (`docs/toronto/waveNNN brief.md`) that says
  everything it needs: the goal, the files, the patterns to copy, what not to touch and what done looks like. It builds that
  one wave on the branch and hands back. A goldfish never needs this whole document, and a brief that needs more context
  than it carries is a brief to rewrite.
- **Emil** is the design and motion bar every screen has to clear (section 6), applied twice: in the brief, as rules, and
  after the build, as a review of real screenshots at 390 px and 1280 px, reported as a Before / After / Why table and fixed
  before the pull request.
- Steel approves every database change and every publish. Waves build on a branch, with the SQL as a file that is not
  applied, until he says so.

## 2. How Toronto runs today

Sources: #general-toronto (June to November 2026), Tate's DMs to Steel, the Toronto team meeting of 07/10/26 (Loom recap,
`transcripts` 259 and 268), the Toronto operations check-in of 14/08/26 (`transcripts` 141), the website's Toronto page.

**The team** (the Hub's roster, `team_members.department = 'opsto'`): Tate (Operations Manager, the Hub's opsto leader),
Karan (Operations co-lead: recipes, the budget breakdown), Gamze (kitchen), Sama (intake and confirmations), Melvina
(programs, grants), plus Simu (student engagement, joined November) and Norma (interviewed for operations assistant).
Tate's proposed titles (18/10/26): Ontario Program Development Lead, Toronto Operations Lead, Kitchen Coordinator,
Administrative Coordinator, Program Development Specialist, Student Engagement Coordinator.

**An event, start to finish** (Tate, 15/06/26, 17/07/26, 24/08/26; the check-in of 14/08/26):

1. **Date and kitchen.** About one event a month. The Ralph Thornton Community Centre kitchen is booked for a window
   (10:00 to 14:00, 14:00 to 18:00, 15:00 to 19:00); another kitchen when it is closed (September 2026, renovations).
   Tate is now talking with TMU about holding the events there on Sundays, "it would match Montreal operations really well"
   (28/10/26).
2. **Who the meals go to.** A shelter, drop-in or non-profit each time (Eva's Initiatives for Homeless Youth, St. Felix
   Centre, the Toronto Disability Pride March), sometimes two at once ("50 meals, 25 for each organization"). The Toronto
   Youth Food Policy Council (TYFPC) often chooses the organization and brings volunteers, under the October 2026 to July
   2027 collaboration agreement. Some partners must not be named publicly (the TDPM support, 24/08/26).
3. **The request.** The organization sends a headcount and its dietary needs ("40 people ... halal and nut-free ... three
   vegetarian and one vegan", 14/08/26).
4. **Menu and groceries.** Tate and Karan adapt a recipe (the pasta primavera) to the request and reorder its groceries on
   Instacart. Tate is getting a debit card to shop in person at Costco instead (task 497).
5. **Volunteers.** Sama watches the Keela form answers in the Welfare Avenue admin inbox and confirms people by email,
   phone or WhatsApp (07/10/26). Sama sends and schedules the call-for-volunteers emails (her check-ins, 13/08/26 and
   27/02/26). Students come through schools and unions: TMU (TMAPS), George Brown culinary students, a TMU talk that drew
   about 60 students (07/10/26).
6. **The day.** Two crews: one cooks in the kitchen (4 volunteers with Gamze), one serves or delivers (4 at Allan Gardens,
   17/07/26). Tate brings the kit: WA pinnies and shirts, 4 IKEA serving containers, the Cambro food box, utensils
   (13/08/26).
7. **After.** Meals counted ("40 meals to Eva's", 24/08/26), photos uploaded, kind words from the shelters shared.

**Intake today: two Keela forms** (Tate, 12/10/26; the website's Toronto page):
- *Volunteer in Toronto* (`form-can.keela.co/TorontoVolunteerRegistration`): the part of the GTA they live in, 16 or older,
  photo consent, the days of the week they can give, food non-profit experience, anything we should know to support them.
- *Student volunteers* (`.../welfare-avenue-toronto-student-registration-form`): the same, plus the school ("so we can see
  who is a TMU student or who is a UFT student").
- Tate's question to the Hub (12/10/26): "Will this be remade in the hub, so we can distinguish Toronto volunteers on our
  contact system. General compared to student, school etc?" This plan answers yes (wave274c).

**What was agreed on 07/10/26** (Loom recap): Toronto adopts the Hub; keep Keela until the move is ready (Steel: Google
Forms "lack data granularity"); Sama gives a procedure list of the intake and confirmation steps; a working session with
Tate and Sama to map the process (moved to the Toronto meeting of 10/11/26); migrate the volunteer and event data from
Keela (task 733); Keela costs about $750 a quarter (app_config `keela_quarterly_cost` 657, next charge
`keela_next_charge` 2026-12-19); Steel's aim is to cancel by 05/12/26 (to Amanda, 02/11/26).

## 3. What the Hub already has

Checked in the code and, read only, in the database on 05/11/26.

- **Access.** Tate (leader), Sama, Karan, Melvina and Gamze have the `opsto` profile, which opens the Volunteer Manager and
  the CRM. Rows are guarded by `is_wa_staff()` only, so every staff member reads every city's servings and volunteers.
  `TEAM_APPS.opsto` is empty, so Toronto has no app under Your apps (`parts153/a_head.js:266`).
- **Servings are Montreal.** 159 `volunteer_events`, none in Toronto; `location` is the city key ("Montreal", one "Ottawa").
  The Volunteer Manager loads every row of `volunteer_event_summary` (`020_wave20.seg:241`), so a Toronto serving would
  appear in Montreal's lists, Find volunteers and Assign.
- **The automations key on `kind = 'service'`.** Confirmations, sign-up notices, reminders, check-ins, itineraries,
  surveys, the SOP steps (`trg_event_steps`), self sign-up and Assign all filter `kind = 'service'`; every text goes from
  the Montreal ops line (`fn/quo-send` FROM_NUMBER) and `texts_by_email` is on. A Toronto event of any other kind is out of
  their reach.
- **The CRM already holds the Toronto people from Keela**: 44 contacts tagged `toronto volunteer` (43 from Keela custom
  forms, 07/11/25 to 11/08/26), only 1 with a volunteer record, none with a city. The import was Keela's contacts export:
  **the form answers (area, school, days) are still only in Keela.**
- **A Toronto form exists, closed**: `toronto-volunteer` (wave156) mirrors the general Keela form with CRM fields
  `gta_area`, `age_16_plus`, `photo_consent`, `days_available`, `food_nonprofit_experience`, `support_note`; settings
  `{city: Toronto, tags: [toronto], volunteer_record: false}`. There is no student form. `volunteer_orgs` already lists
  Toronto Metropolitan University (TMU) and the University of Toronto, and `crm_contacts.org_id` points to it (wave264).
- **One record per person** (wave176): `crm_contacts.volunteer_id` points to `volunteer_profiles`; `volunteer_people` is
  the view over both; a roster row's `person_id` is the profile. The CRM's contact sheet shows Hub servings
  (`hub_servings`: Confirmed rows at completed events) and history, and opens the Volunteer Manager.
- **The website** still embeds the two Keela forms on `/toronto/` and `/fr/toronto/` (frontend repo).

## 4. The design: one database, two apps

**Toronto Volunteers is its own app** (page `toronto`, in the launcher, Your apps for the opsto profile), built for the way
Toronto works, on the same tables as Montreal so the CRM, hours, sign-offs and history work the same.

- **A Toronto event** is a `volunteer_events` row with `kind = 'meal'`, `location = 'Toronto'`, the kitchen in
  `kitchen_place` / `kitchen_shift` / `kitchen_contact`, `planned_meals`, `start_time`, `whatsapp_url`, and codes
  `TO-26-1`, `TO-26-2`. `kind = 'meal'` keeps every Montreal automation and the Montreal SOP away from it without changing
  a Montreal function; the Montreal Volunteer Manager leaves `meal` and Toronto rows out of its lists.
- **Who the meals go to** is a new table, `volunteer_event_recipients` (one row per organization: name, meals, dietary
  needs, drop-off time, contact, meals delivered, a do-not-name flag), because Toronto splits meals across organizations.
- **Crews** are roster rows with the shared role keys, labelled the Toronto way: `team_leader` Lead, `cook` Kitchen crew,
  `server` Serving crew, `driver` Delivery, `photographer` Photos. The counts the event needs live in `spot_counts`.
- **The Toronto pool** is the CRM: contacts tagged `toronto`, `toronto volunteer` or `toronto student`, with a GTA city,
  or on a Toronto crew. School from `org_id`; area, days, age and consent from the CRM fields. Adding a person to a crew
  gives them a volunteer record if they have none (`wa274_crew_add`), so the CRM counts their servings like anyone's.
- **Messages go by email and by hand first.** No automatic text reaches a Toronto volunteer until the Toronto messaging
  wave (274e) and Steel's switch. Until then the app makes Sama's way fast: copy the crew's emails or numbers, the
  WhatsApp group link, mark who was called.
- **The stages follow Tate's sequence**: Plan (date, kitchen, who the meals go to), Crew (who comes, by crew), Confirm (who
  said yes, who to call), Prep (menu, groceries, kit, wave274f), Wrap up (meals delivered, who came, mark completed).

The rail: **Events | Volunteers, Sign-ups | Setup** (Sign-ups with wave274c, Setup with wave274f).

## 5. The waves

Each wave is one pull request, built by a goldfish from its brief, reviewed against section 6, approved by Steel.
Waves 275 to 279 were taken by other Hub work at the same time (onboarding, availability, connections), so Toronto's
later waves are 274b to 274g.

| Wave | What it delivers | Database | Needs first |
|---|---|---|---|
| **274** | The app: Events (next event, upcoming, past), New event, the event page (Plan with who the meals go to, Crew with targets and Add people, Confirm with copy emails and numbers and the WhatsApp link, Wrap up with meals delivered and Mark completed), Volunteers (the pool with Students / General, school, area, day filters, Open in the CRM, Add to an event). Montreal's lists leave Toronto out. | `build/data/wa274_toronto.sql`: the recipients table, `wa274_crew_add`, the `toronto` page in every access profile | Nothing |
| **274b** | Anticipated spend: what each Toronto event is expected to cost, set in Plan, shown on the Hub's shared calendar (each event and the month's total) beside Montreal's servings. | a `budget` amount on `volunteer_events` | Steel's ask (05/11/26) |
| **274c** | Intake in the Hub: *Volunteer in Toronto* reopened and *Student volunteers in Toronto* new (school from `volunteer_orgs`), both making volunteer records tagged `toronto` / `toronto student`; Sign-ups, Sama's inbox (Welcome email, Called, Add to an event); the website's Toronto page swaps Keela for the Hub forms, English and French. | form rows, the schools in `volunteer_orgs` | Tate's school list, Steel's approval for the website forms |
| **274d** | Keela out: import the two forms' answers (area, school, days, consent) onto the 44 contacts and any newer ones, matched by email, with a dry run and a report of what changed. | an import script and its report | **The two Keela form exports (CSV), before 05/12/26** |
| **274e** | Messages: the confirmation email with the volunteer's own link (Toronto kitchen, time, what to bring), the call for volunteers to a chosen part of the pool (school, area, day), reminders by email, a Toronto switch for anything automatic, Toronto role guides. | Toronto email templates, a `toronto_auto` switch, the role guides by city | Sama's procedure list |
| **274f** | Prep and Setup: the recipe scaled to the headcount and the dietary needs, the grocery list, the Toronto kit; Setup with kitchens, partner organizations and the usual crew sizes; a grant report (meals per organization, volunteer hours) for Tate's applications. | kitchens and kit lists | Tate and Karan's recipes |
| **274g** | The Toronto SOP from Sama's procedure, the page tour, an Avenue Academy lesson. | the SOP rows, `trainings` `tour:toronto` | Sama's procedure list |

Dates that matter: the Toronto meeting on 10/11/26 (Sama's procedure, the schools, the Keela exports); the events of
22/11/26 (TMU, likely) and 29/11/26; cancelling Keela by 05/12/26; Keela's next charge 19/12/26. Wave274 applied and
published by about 15/11/26 lets the 22/11 and 29/11 events run in the Hub.

## 6. The design bar (Emil's rules, made specific)

- **Look.** The Hub's own tokens and faces only (cream, green, ink, purple, gold; Barlow Condensed titles in sentence
  case, Space Grotesk text). Toronto's accent is the Hub purple. One clear primary action per screen. Numbers people act
  on (meals, crew filled, days to go) are big; everything else is quiet.
- **Motion has a reason or it does not move.** Press feedback on every button (`scale(0.97)`, 160 ms ease-out). Sheets
  slide up from the bottom on a phone and in from the side on a computer (the drawer curve
  `cubic-bezier(0.32, 0.72, 0, 1)`, 280 ms in, 200 ms out). Crew bars fill with `transform: scaleX` from the left, once,
  when the page first draws. Lists stagger in 40 ms apart on the first draw only, never on a filter or a save. A status
  change crossfades in 200 ms. Nothing animates from `scale(0)`, nothing uses `transition: all` or `ease-in`, nothing over
  300 ms except a sheet, nothing on keyboard shortcuts.
- **Hover** only under `@media (hover: hover) and (pointer: fine)`. **Reduced motion** keeps the fades and drops every
  movement.
- **Phone first**: everything works at 390 px with targets of at least 44 px, nothing scrolls sideways, sheets are full
  width with the action at the thumb.
- **Accessible**: real buttons and labels, focus visible, Escape closes, focus returns to what opened it, saves announced.
- **Words**: plain, warm and specific, Canadian spelling, no dashes. Toronto's words: event (not serving), kitchen, crew,
  "who the meals go to".

## 7. Decisions for Steel

1. **Decided 05/11/26: Toronto is its own app** on the same tables, rather than a city switch inside the Montreal
   Volunteer Manager. Steel: "I don't want Montreal methodologies to mess up Toronto methodologies and operations." You said "this new app in the hub"; the 07/10 recap had "a toggle to distinguish Montreal vs
   Toronto". The separate app keeps Toronto's flow simple and leaves Montreal untouched.
2. **Who sees whom.** Today every staff member can read every volunteer in both cities. Keep it (simplest), or limit the
   Toronto team to Toronto people and Montreal's to Montreal's (a row-security change for wave274d or later).
3. **The name** in the launcher: "Toronto Volunteers" (proposed), and whether Montreal's becomes "Montreal Volunteers".
4. **Approved 05/11/26: applying wave274's SQL** (additive: one new table, two functions, the page in the access
   profiles) and publishing.
5. **The website's Toronto forms** (wave274c): replace the Keela embeds with the Hub forms once they are live.

## 8. What Tate, Sama and Steel need to bring

- **10/11/26 Toronto meeting:** Sama's procedure list (intake to thank-you); the schools to list (TMU, University of Toronto
  and UTM, George Brown, others); the kitchens; the organizations that receive meals; who owns what in the app.
- **Before 05/12/26:** the two Keela form exports as CSV (Sama or Steel, from Keela's form responses).
- **Steel:** the decisions in section 7.

## 9. The ledger (the elephant's memory)

| Date | What | Why or where |
|---|---|---|
| 05/11/26 | Research done: Slack, transcripts 141, 259, 268, the CRM's Toronto contacts, the Hub's Volunteer Manager and database | Sections 2 and 3 |
| 05/11/26 | Toronto events are `kind = 'meal'`, `location = 'Toronto'` | Every Montreal automation filters `kind = 'service'` (checked in the live function definitions) |
| 05/11/26 | Shared role keys with Toronto labels | The CRM, hours letters and history read the keys |
| 05/11/26 | Who the meals go to is its own table | Two organizations per event happens (24/08/26) |
| 05/11/26 | No automatic message to Toronto volunteers before wave274e | Montreal's wording and line; Sama confirms by hand |
| 05/11/26 | The `toronto` page copies each profile's `volunteering` access | Same people, same rule |
| 05/11/26 | wave274 brief written, built on the branch, SQL not applied | `docs/toronto/wave274 brief.md` |
| 05/11/26 | `wa274_toronto.sql` dry-run on a throwaway local Postgres 16 with the live column types: applies, re-applies cleanly; `wa274_crew_add` refuses non-staff, Montreal (`service`) events, unknown roles and completed events, gives a contact a volunteer record once, never duplicates a crew row, leaves tags alone; `wa274_next_code` gives TO-26-1, TO-26-2, TO-27-1; profiles copy their `volunteering` value | The database half is safe to apply once Steel approves |
| 05/11/26 | Every wave's design review uses one brief | `docs/toronto/design review brief.md` |
| 05/11/26 | wave274c and wave274d briefs written, ready for their inputs | `docs/toronto/wave274c brief.md` (needs Tate's schools), `docs/toronto/wave274d brief.md` (needs the Keela exports) |
| 05/11/26 | The school question needs a city: form-submit offers every `on_form` organization, Montreal's included | wave274c adds `volunteer_orgs.city` and a question's `org_city` (form-submit v10) |
| 05/11/26 | The Keela import adds tags, which fires `crm_auto_on_tags` | wave274d's report and doc warn first |
| 05/11/26 | wave274 built from its brief: `test/w274drive.js` 222 passed, 0 failed (admin and opsto, 1366 and 390, every fallback for the unapplied SQL); w259, w191, w272, w195 unchanged; w153 45 of 46 before and after (the "dock stays in view" check fails on the unchanged build too) | `docs/05-11-26 - wave274 the Toronto Volunteers app.md` |
| 05/11/26 | Three Montreal places still show Toronto events: the Forms editor's event picker (`parts152/i_forms.js:18`), the planned-events count (`035_wave35.seg:86`), the Hub calendars (124, 128; may be right) | Left for wave274c or a small follow-up |
| 05/11/26 | New event is the Hub's own app action (wave197's masthead button, the app bar on a phone), tinted purple in Toronto | A second button overlapped it |
| 05/11/26 | Ten apps overflowed the launcher at a 900 px window height; a `max-height: 960px` rule keeps the tile blurbs on one line | `parts153/b_css.js`, marked `wave274` |
| 05/11/26 | Builder's calls to confirm: taking someone off a crew deletes the row after 5 seconds of Undo; Mark completed asks again if the date is ahead; More reopens a cancelled or completed event; Copy emails for "only those waiting" leaves out people who can't come | Steel or Sama |
| 05/11/26 | Tests need `WA_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` here | `test/boot.js` points at an old path |
| 05/11/26 | Call with Tate and Sama asked for this weekend (Slack DM to Tate) | Section 8 inputs, before the 10/11 meeting |
| 05/11/26 | wave274 design review (Emil and Apple): 19 findings, all applied, w274drive still 222 of 222; on touch a sheet focuses itself, not its first field | The release note's Design review section |
| 05/11/26 | Two Hub-wide fixes the review found, outside any wave's scope: the phone rail's capitals and second filled button, and no `viewport-fit=cover` in the head | A small shared wave, or wave274g's polish |
| 05/11/26 | Still to judge on a real iPhone: press feedback, the sheet's header and footer scroll, where the note sits beside Ask | Steel or Edison on a phone, once published |
| 05/11/26 | Steel decided Toronto is its own app, approved the SQL and publishing, and asked for the anticipated spend on the shared calendar and a break-UI pass | Sections 5 and 7 |
| 05/11/26 | The live Hub is built from `wave279-onboarding-plan` (index.html bcf0c01b), not `main` (other sessions released 271, 273, 275 to 279 from their branches). This branch merges it, so Toronto goes on top of what is live | Deploy only on top of the live md5 |
| 05/11/26 | Waves 275 to 279 are taken; Toronto's later waves renumbered 274b to 274g (briefs renamed) | Section 5 |
| 05/11/26 | Break-UI pass: 26 findings, 20 fixed (the worst was a long school chip making the page 1,544 px wide); `test/w274break.js` 238 passed stays as the regression test | The release note's Break-UI section |
| 05/11/26 | For Steel: a cue when a crew or the meals go over, whether notes queue, folding the picker's filters on a phone, length limits on the event title and kitchen | From the break-UI pass |
