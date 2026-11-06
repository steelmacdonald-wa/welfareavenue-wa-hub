# wave274 brief: the Toronto Volunteers app (for one builder with no other context)

You are building one wave of Welfare Avenue's internal Hub. Everything you need is in this brief and the files it points
to. Read the whole brief before you touch anything. The repository is `/home/user/welfareavenue-wa-hub`; all paths below
are relative to it. Work on the checked-out branch. **Do not commit, push, deploy, or connect to any database.** When you
are done, hand back the report described in section 10.

## 1. The goal

Welfare Avenue (a youth-powered charity fighting food insecurity) runs Sunday servings in Montreal with the Hub's
**Volunteer Manager** app (page `volunteering`). Its Toronto team runs a different kind of event: about once a month they
book a community kitchen (usually the Ralph Thornton Community Centre) for a time window, one crew cooks there, and the
meals go to one or two organizations (a shelter, a drop-in, a non-profit) that sent a headcount and dietary needs
("40 people, halal and nut-free, three vegetarian and one vegan"); sometimes a second crew serves the meals outdoors.
Intake today is two Keela forms (general and student, the student one with a school), and Sama confirms volunteers by
hand by email, phone or WhatsApp.

Build **Toronto Volunteers**, a new Hub app (page `toronto`) on the same database tables as Montreal, so a Toronto
volunteer is the same CRM contact, with the same servings count and history, as anyone else. This wave delivers:

1. **The app in the launcher**, under Your apps for the Toronto team (profile `opsto`), with its rail.
2. **Events** (`#toronto`): the next event as a hero card, then upcoming events, then past events (folded).
3. **New event** (a sheet): date, start time, kitchen, kitchen time, meals planned, title, a note.
4. **The event page** (`#toronto/e/<id>`): four stages as sections, the current one marked: **Plan** (kitchen, time,
   contact; who the meals go to, with meals and dietary needs, add, edit, remove), **Crew** (crews with targets and
   people, Add people from the Toronto pool, set someone Confirmed / Can't come / Waiting, take someone off with Undo),
   **Confirm** (confirmed and waiting counts; Copy emails, Copy phone numbers of the crew or of those not confirmed; the
   WhatsApp group link, editable), **Wrap up** (meals delivered per organization, who came, Mark this event completed).
5. **Volunteers** (`#toronto/people`): the Toronto pool from the CRM with search, Students / General, school, GTA area and
   day filters, each person's Toronto events and last event, Open in the CRM, Add to an event.
6. **Montreal's Volunteer Manager leaves Toronto out** of its lists.

Not in this wave (do not build, do not leave placeholders for): sign-up forms and a Sign-ups page, automatic emails or
texts, recipes and groceries, Setup, page tours. They come in later waves.

## 2. How the Hub is built (read these first)

- `docs/ARCHITECTURE.md` sections 1 to 11 (about 140 lines). The essentials: one HTML page assembled by `build/build.sh`
  from `build/src/*.seg` in the order of `build/src/MANIFEST.txt`; each wave is one guarded IIFE; behaviour is extended by
  wrapping globals (`startApp`, `showPanel`, `applyHash`, ...); the client is `db` (supabase-js v2, a script-level `let`,
  write `db`, never `window.db`); `esc(s)` escapes text and attributes; `toast(msg)`; `logChange(...)`.
- A wave made of parts: copy the shape of `build/parts272/` (its `assemble.py` writes `build/src/272_wave272.seg` with
  non-ASCII escaped). Create `build/parts274/` (for example `a_head.js`, `b_css.js`, `c_data.js`, `d_events.js`,
  `e_event.js`, `f_people.js`, `g_sheets.js`, `z_wire.js`) and `build/parts274/assemble.py` writing
  `build/src/274_wave274.seg`. Add to `build/src/MANIFEST.txt`, right after the `272_wave272` line, a comment line
  `# 274_wave274: the Toronto Volunteers app (...)` and the line `274_wave274`.
- Registering a page: `build/src/225_wave225.seg:2200-2202` and `build/src/193_wave193.seg:1596-1597`
  (`WA_NAV.register({ id, label, group: 'apps', dot, gate, onShow })`, inside a `startApp` wrapper, once).
- Where a page must also be named (all edits, keep them small, each with a `/* wave274 */` comment):
  - `build/parts134/a_head.js:46`: add `'toronto'` to the `apps` group items.
  - `build/parts127/a_head.js:38` and `:50`, `build/parts131/a_head.js:49` and `:61`: add `'toronto'` after
    `'volunteering'` in the Teams group and `toronto: 'Toronto Volunteers'` to the labels.
  - `build/src/110_wave110.seg:46-48` (`TAB_LABEL`): `toronto: 'Toronto Volunteers'`.
  - `build/src/118_wave118.seg:80-87` (`MAST`): `"toronto": ["Operations Toronto", "Toronto Volunteers", "Toronto's events, crews and volunteers.", true, "Toronto Volunteers"]`
    (copy the shape of the `volunteering` line exactly).
- The apps: `build/parts153/a_head.js`. `APPS.volunteer` (lines 178-197) is the model. Add `APPS.toronto` right after it:
  `{ id: 'toronto', label: 'Toronto Volunteers', color: PURPLE, ic: 'people', blurb: 'Toronto events, crews and volunteers', pages: ['toronto'], home: '#toronto', groups: ... }`
  with groups `[{ label: 'Events', items: [{ h: '#toronto', l: 'Events', ic: 'list', page: 'toronto' }] }, { label: 'People', solo: true, items: [{ h: '#toronto/people', l: 'Volunteers', ic: 'people', page: 'toronto' }] }]`
  and an action `{ k: 'newevent', l: 'New event', ic: 'plus', page: 'toronto' }` (see how `c_frame.js:163` handles an
  action key, and handle `newevent` the same way or by a published function). Add `'toronto'` to `ORDER` (line 254) right
  after `'volunteer'`, and set `TEAM_APPS.opsto = ['toronto', 'crm']` (line 266). In `build/parts153/b_css.js` add
  `nav.wa-nav #tabBar .tab[data-tab="toronto"]` to the rule that hides app pages' tabs from the Hub's own menu (see line 87
  for the studio's). `PURPLE` is defined at `a_head.js:30`. Icons are the keys of `P` (`a_head.js:44-95`).
  `WA_APP.open(id)`, `WA_APP.go`, `window.w153.paint()` repaint the rail (`WA_APP.renderRail` does not exist).
- After editing parts 127, 131, 134 and 153, run each one's `assemble.py` (they were checked drift-free on 05/11/26: an
  unchanged assembler reproduces its segment exactly). Then `bash build/build.sh` (writes `build/candidate.html`; it must end
  with `check_remaps: clean`). Never hand-edit a generated segment.
- Access. A profile's `pages` decides the menu (`build/src/127_wave127.seg:325-331`); the SQL for this wave
  (`build/data/wa274_toronto.sql`, already written, do not apply it) gives every profile `toronto` = its `volunteering`
  value. Until it is applied, add a `wa40Allowed` wrapper like `build/src/225_wave225.seg:2193` that adds `'toronto'`
  whenever the list already contains `'volunteering'` and the person is not in board mode. Gate `member`.

## 3. The data (the contract)

Tables are read and written with `db` directly; row security allows any staff member. Columns that exist today:

- `volunteer_events`: `id, code, event_date (date), start_time (time, default 12:00), title, location, kind, status
  ('planned' | 'completed' | 'cancelled'), notes, plan_note, planned_meals (int), kitchen_place, kitchen_contact,
  kitchen_shift (text such as '10:00 to 14:00'), whatsapp_url (must match ^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/
  or be null), spot_counts (jsonb, {role: n})`.
  **A Toronto event is `kind = 'meal'` and `location = 'Toronto'`.** Load them with
  `.eq('kind', 'meal')` and keep only `location` matching /toronto/i in the browser too. Never create or touch a
  `kind = 'service'` row from this app.
  New event code: `db.rpc('wa274_next_code', { p_date })`; if that fails (the SQL is not applied yet), compute
  `TO-<yy>-<n>` from the loaded Toronto events.
- `event_roster`: `id, event_id, person_id (the volunteer record), person_name, role, status ('TBD' | 'Waiting For Response'
  | 'Confirmed' | 'Unavailable' | 'Cancelled'), confirm_status ('confirmed' | 'declined' | null), confirmed_at, notes,
  detail (jsonb), sort`. Toronto crew roles and their labels:
  `team_leader` Lead, `cook` Kitchen crew, `server` Serving crew, `driver` Delivery, `photographer` Photos. Default
  targets when `spot_counts` has none: Lead 1, Kitchen crew 4, Serving crew 4, Delivery 1, Photos 0 (Photos shows only when
  its target is above 0 or someone is on it). Confirmed: `status 'Confirmed', confirm_status 'confirmed', confirmed_at now`.
  Can't come: `status 'Unavailable', confirm_status 'declined'`. Waiting: `status 'TBD', confirm_status null`. Called
  (Confirm stage, a small toggle per person): `detail.called_at` (ISO time) and `detail.called_by` (the signed-in email).
- **Adding a person to a crew**: `db.rpc('wa274_crew_add', { p_event, p_contact, p_role })` returns
  `{ ok, roster_id, person_id, already }`. It gives a CRM contact a volunteer record when it has none. If the RPC is
  missing (the SQL is not applied yet) and the contact has a `volunteer_id`, insert the roster row directly
  (`event_id, person_id: volunteer_id, person_name: full_name, role, status: 'TBD', detail: { source: 'toronto', contact_id }`);
  if it has none, say plainly that this person needs the wave274 database update first.
- `volunteer_event_recipients` (new in this wave's SQL): `id, event_id, partner_id, name, meals, meals_delivered, dietary
  (jsonb: { halal: bool, nut_free: bool, vegetarian: n, vegan: n, other: text }), drop_off (text), address, contact_name,
  contact_email, contact_phone, private (bool: supported but not named publicly), note, sort`. If reading it fails, the
  Plan section shows one quiet line ("Who the meals go to opens once the Toronto database update is applied") instead of
  the list; nothing else breaks.
- **The Toronto pool** (the CRM): `crm_contacts`: `id, full_name, first_name, last_name, primary_email, emails (text[]),
  phones (text[]), city, tags (text[]), kinds (text[]), volunteer_id, org_id (references volunteer_orgs), merged_into,
  created_at, last_activity_at, source`. A Toronto person: not merged, and a tag of `toronto`, `toronto volunteer` or
  `toronto student` (compare lower case), or a city in the GTA (Toronto, Mississauga, Brampton, Scarborough, North York,
  Etobicoke, East York, York, Markham, Vaughan, Richmond Hill, Oakville, Pickering, Ajax), or a `volunteer_id` on a Toronto
  event's roster. Ask the server for the tagged ones (`.or(...)` / `.overlaps('tags', [...])`), add the roster people by
  `volunteer_id`, and always apply the same rule again in the browser. **The test stub ignores `or`, `ilike`, `gte`,
  `contains` and `overlaps`** (`test/stub_supabase.js:45-60`), so the browser filter is what the tests see.
  - School: `org_id` → `volunteer_orgs (id, name, short)`. A student is a person with an `org_id`, or the tag
    `toronto student`. Everyone else is General.
  - Answers: `crm_contact_fields (contact_id, field_id, value)` with `crm_fields (id, key)`; keys `gta_area` (one of
    Downtown Toronto, Midtown (Yonge-Eglinton), North York, East York, York, Etobicoke, Scarborough), `days_available`
    (a list of weekday names), `age_16_plus`, `photo_consent`. `value` is jsonb: read strings and arrays defensively.
  - Their Toronto events: roster rows of Toronto events by `person_id = volunteer_id`.
- The CRM's contact sheet opens at `#crm/c/<contact id>` (`build/parts152/d_sheet.js`; a plain link with that href is
  how the Volunteer Manager does it, `build/src/026_wave26.seg:166`).
- Audit: call `logChange('volunteer_event', id, field, old, new)` on edits where the old value is known, as other waves
  do; never block a save on it.

## 4. Montreal must not see Toronto

`waVolLoad` in `build/src/020_wave20.seg:238-255` fills the Volunteer Manager's events from `volunteer_event_summary`.
Wrap it in this wave (the wrapping pattern of ARCHITECTURE.md section 5) so that, after it resolves, the events it filled
leave out rows with `kind === 'meal'` or a `location` matching /toronto/i. Find the exact variable it fills by reading
those lines. Do not edit `020_wave20.seg`. Check that Find volunteers (`build/parts191/f_recruit.js:48-53`, `upcoming()`)
and the spots bars (`234_wave234.seg`) read that same list; if one reads elsewhere, note it in your report instead of
patching it.

## 5. The screens

Words: plain, warm, specific, Canadian spelling, sentence case, **no dashes** (use a colon, a comma or a full stop).
Toronto's words: event (never serving), kitchen, crew, "who the meals go to". Dates like "Sun 22 Nov", times like "10:00".

- **Events.** Title "Toronto events", line "Cook together, then bring the meals to the people who need them."
  Primary button New event. The next event as a hero card: the date large, "in 17 days", the title, the kitchen and its
  time, "Meals for: Eva's Initiatives (40)" (a private recipient shows as "1 organization, not named publicly"), one bar
  per crew (filled / target), "5 of 9 confirmed", and the stage. Upcoming events as compact cards with the same facts.
  Past events folded under "Past events (n)", each with meals delivered. Empty state: "No Toronto events yet." with
  New event.
- **New event** (sheet): Date (required, a date input), Start time (default 10:00), Kitchen (text with suggestions from
  past Toronto events plus "Ralph Thornton Community Centre"), Kitchen time (text, "10:00 to 14:00"), Meals planned
  (number), Title (default "Free meal event"), Note. Create opens the new event's page.
- **The event page.** A header with the title, the date and time, the kitchen, the status, Edit (the same sheet) and More
  (Cancel this event, with a confirm step: status 'cancelled'). Under it the stage strip **Plan · Crew · Confirm · Wrap up**
  (anchors to the sections; the current stage from the date: more than 10 days away Plan, 10 to 3 days Crew, 2 to 0
  days Confirm, past Wrap up; a completed event is Wrap up). Sections:
  - Plan: the kitchen card (place, time, contact; Edit) and **Who the meals go to**: each organization's name, meals,
    dietary chips (Halal, Nut-free, 3 vegetarian, 1 vegan, other), drop-off, contact, a lock for private; Add an
    organization (sheet with those fields); edit; remove (confirm). "40 of 50 planned meals placed" when both are known.
  - Crew: one column per crew (on a phone, stacked) with "3 of 4" and a bar; each person a card: name, school chip or
    General, status chip, a menu (Confirmed, Can't come, Waiting, Open in the CRM, Take off the crew with a 5 second
    Undo). Add people opens the picker (section 5, Volunteers, in a sheet: search, the same filters, a role choice, Add).
    Edit the targets (a small sheet of numbers, saved to `spot_counts`).
  - Confirm: "5 confirmed, 3 waiting, 1 can't come"; the waiting list with Called toggles; Copy emails and Copy phone
    numbers (all the crew, or only those waiting), using `navigator.clipboard` with a fallback; the WhatsApp group link
    (open, edit; validate the pattern above).
  - Wrap up: meals delivered per organization (number inputs), who came (the confirmed people, each with a Came / Didn't
    come toggle that sets Confirmed or Unavailable), and Mark this event completed (status 'completed'; then the
    CRM counts it). A completed event shows a quiet summary at the top.
- **Volunteers.** Title "Toronto volunteers" with the count. Search (name, email, phone, school). Filter chips: All,
  Students, General; selects for School, Area; day chips Mon to Sun. Sort: Newest, Last event, Name. Each row: name,
  school chip or General, area, the days as seven small dots, Toronto events count and the last one, quick Copy email,
  Open in the CRM, Add to an event (choose an upcoming Toronto event and a crew). An empty result says what to clear.

## 6. The design bar (required, and it is reviewed against screenshots)

- The Hub's tokens and faces only: read the `:root` variables in `build/src/000_head_base.seg` and the faces wave190 uses
  (Barlow Condensed titles, Space Grotesk text). No new hex colours except through the existing tokens and `PURPLE`
  (#6F64AB) as Toronto's accent. `build/check_remaps.py` must stay clean.
- One stylesheet element `#wa274css`, every selector scoped under `#toronto` or the wave's own sheet ids (`#w274...`).
- Motion: buttons and cards that press get `transform: scale(0.97)` on `:active` with `transition: transform 160ms
  cubic-bezier(0.23, 1, 0.32, 1)`. Sheets slide up on a phone and in from the right on a computer with
  `cubic-bezier(0.32, 0.72, 0, 1)`, 280 ms in, 200 ms out, from `translateY(100%)` / `translateX(100%)`, with the backdrop
  fading; use CSS transitions (interruptible), not keyframes. Crew bars fill with `transform: scaleX()` and
  `transform-origin: left`, once on the first draw of a page (not on every repaint). Lists (event cards, people rows)
  stagger in 40 ms apart, 8 px up plus opacity, on the first draw only, never after a filter, search or save. Status chips
  change with a 200 ms crossfade. The stage strip's marker moves with `transform: translateX`, 240 ms
  `cubic-bezier(0.77, 0, 0.175, 1)`. Never `transition: all`, never `scale(0)`, never `ease-in`, nothing over 300 ms but
  a sheet, nothing on a keyboard action.
- Hover styles only inside `@media (hover: hover) and (pointer: fine)`. `@media (prefers-reduced-motion: reduce)`: drop
  every transform and stagger, keep opacity fades.
- Phone first: correct at 390 px and 1280 px, targets at least 44 px on a phone, nothing scrolls sideways, sheets full width
  on a phone with the primary action at the bottom.
- Accessible: real `<button>`s and `<label>`s, visible focus, Escape closes a sheet and focus returns to its opener, focus
  stays inside an open sheet, `aria-live="polite"` for "Saved" and errors, contrast at least 4.5 to 1.
- Errors are said in words where the action was ("Couldn't save the kitchen. Try again."), never only in the console.

## 7. Tests (write them, run them, make them pass)

- `test/w274fx.js`: a fixture helper in the style of `test/w176fx.js` / `test/w191fx.js` that adds to the base fixture:
  three Toronto events (one past and completed, one in 9 days, one in 40 days, relative to the frozen clock 2026-09-25 in
  `test/boot.js`), roster rows on them across the crews, about twelve Toronto contacts (tags, a few with `org_id` to two
  `volunteer_orgs` rows TMU and University of Toronto, `crm_fields` and `crm_contact_fields` for area and days, one with
  no `volunteer_id`), recipients for two events (one private), and one Montreal service event on the same day as a
  Toronto one.
- `test/w274drive.js`, in the style of `test/w259drive.js` (`fresh(...)`, an `INSTALL` that records `db.from` writes and
  `db.rpc` calls and answers `wa274_crew_add` and `wa274_next_code`), for **admin** and **plain** (a member on a team
  profile; give it the `opsto` profile through `init` if needed) at **1366** and **390** px. At least: the launcher shows
  Toronto Volunteers and, for opsto, under Your apps; `#toronto` draws the hero, the upcoming and the folded past; New
  event inserts `kind 'meal'`, `location 'Toronto'` and a `TO-` code; the event page draws the four sections and marks the
  right stage; adding a recipient, changing a status, Called, adding a person (the RPC call and its arguments), taking
  someone off with Undo, Mark completed each send the right write; `#toronto/people` filters by Students, school, area and
  day and its rows link to `#crm/c/<id>`; `#volunteering` (Montreal) does not list the Toronto events; no page errors; no
  sideways scroll (`scrollWidth <= innerWidth`); with `page.emulateMedia({ reducedMotion: 'reduce' })` sheets still open
  and close. Save screenshots of each screen at both widths to `$WA_SHOTS` when it is set.
- Run (Chromium is at a different path here than `test/boot.js` assumes):
  `export WA_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome; bash build/build.sh && CAND=build/candidate.html node test/w274drive.js`
- Regression (all must still pass; they passed before your change where noted): `test/w259drive.js` (22/22 on
  05/11/26), `test/w153drive.js`, `test/w191drive.js`, `test/w272drive.js`, `test/w195drive.js`. If one fails, run it on
  the unchanged build (`git stash`, build, run, `git stash pop`) to tell a pre-existing failure from yours, and say which.

## 8. Docs

- `docs/05-11-26 - wave274 the Toronto Volunteers app.md`: a release note in the style of the other wave notes (what and
  why in Steel's words from section 1, the screens, the data, the tests and their counts, what is left for later waves).
- `docs/ARCHITECTURE.md`: one paragraph entry for wave274 after the last wave entry, in the style of the others.

## 9. Do not

- Touch any Montreal behaviour beyond section 4, any `fn/` edge function, `build/site/`, `build/www/`, `build/c`, `build/me`
  or any `.sql` file; apply SQL; contact the network; commit; push.
- Rename or remove any existing id, class, data attribute, function or route.
- Add a library, a font, an external request or an inline `on...=` attribute.
- Put any real person's details in the fixture (use made-up names, `@example.com` addresses and 555 numbers).

## 10. Hand back

A short report: the files you created and changed; how each item of sections 1, 4 and 6 is met (or not, and why); the
test results with counts for `w274drive.js` and every regression test; the screenshot paths; anything you found that the
elephant should know (a Montreal list that still shows Toronto, a pattern that fought you, a decision you had to make).
