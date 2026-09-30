# 30/09/26 - wave174: a survey for every role, the serving's times, and itineraries by role

Steel (30/09/26): "Every volunteer should get a survey, each tailored to their role, the experience they had, especially servers we need to know their thoughts on the beneficiaries very similar to the Google form one. Come up with the best questions possible for all"; "Serving times are typically around 12-1230 but definitely check on the itineraries. Also itineraries are sent out to driver and team lead. Servers and photographers get similar ones and then cooks don't usually get one. The community lead should also get their own so that they are ready for the survey type role and community building type role."

## What the itineraries said

The Canva itineraries from 6 September 2026, 23 August 2026 (the community kitchen pilot, at 1:00 pm) and 17 February 2024 show:

- **The serving:** 12:00 pm at 1500 Rue Berri, Place Émilie-Gamelin. The 2024 server itinerary says servers meet on the Maisonneuve side of the park.
- **The main driver and the team leader:** start at 11:00 am at the storage unit, 888 Rue Saint-Antoine W, unit 1253.
- **The pickup driver:** starts at 10:45 am and texts each cook 10 minutes before arriving.
- **After the serving:** dishwashing at the Old Brewery Mission, 915 Clark Street (ask for Rafael). Leftover food and clothing donations can be dropped there too.
- **For the team leader:** share the ETA in the group chat, check that every cook and server scans the QR code, fill in the weekly audit and restock form, and follow the important notes.

The storage codes were not copied into the Hub. Staff can type them in Text settings, under Itineraries.

## What volunteers get

- **Times:** every serving has a start time (12:00 pm unless changed on the event), and each role's time is counted from it:
  - Team leader and main driver: 11:00 am at the storage unit.
  - Pickup driver: 10:45 am, the first pickup.
  - An only driver: 10:45 am, the pickups first and then the storage unit.
  - Community lead: 11:45 am.
  - Servers, photographers, dishwashers and the community welcome: 12:00 pm.
  - Cooks: food ready for pickup from 10:45 am, or drop-off by 12:00 pm.

  The page shows the time under "When", and the calendar entries now have real start and end times.
- **The itinerary:** it appears on the volunteer's own page from the day before, for confirmed volunteers. When texts are on, a text with their link goes out at 5 pm the day before (`sms_itinerary_hour`). Each role gets its own version:
  - **Team leaders and drivers:**
    - The storage unit and its access.
    - The pickup driver's cooks, with their phones, addresses and dishes, plus the Google Maps route.
    - Who drops off, and who is staying to serve.
    - The serving itself.
    - After the serving: dishwashing and returning the equipment.
    - The team leader also gets the ETA and survey reminder and the audit form.
    - The team's names and phones, and the important notes.
  - **Servers, photographers, dishwashers and the community welcome:**
    - Where to meet the team, and when.
    - Role hints: servers hand donations to the team leader, and photographers ask before photographing faces and share the same day.
    - The dishwashing place.
    - A note that the survey comes by text.
    - The team, and the notes.
  - **The Community lead** follows four steps:
    - Arrive and count the clothing.
    - Welcome people and listen, filling in the tracking form.
    - Build the community by introducing regulars and inviting people back.
    - Close the day: count the clothing again and fill in the survey, which is the debrief.
  - **Cooks** get no itinerary.
- **The survey:** it is on the volunteer's own page from an hour after the serving starts, for 14 days. When texts are on, a thank-you text with their link goes to everyone confirmed (`sms_survey_roles` is now `*`), and answering again replaces the earlier answers. There are 50 questions (`build/data/gen_wa174_questions.py`):
  - **Everyone:** overall experience, feeling ready, communication, the best moment, one thing to do better, volunteering again, trying another role, and a shout-out.
  - **Servers** (the Volunteer Survey): the needs people told them about (with Other), what slowed the serving, how people reacted to the meal, whether it felt welcoming and respectful, whether there was enough food, and anything someone told them (without names).
  - **Cooks:** the recipe, portions, the pickup or drop-off, whether they had what they needed, and what would make cooking easier.
  - **Drivers:** on time, whether the food was ready, whether the itinerary was right, and what to fix.
  - **Photographers:** whether they shared their photos and where, how many, consent for faces, and a story for social media.
  - **Team leaders:** meals served, the start time, turnout, no-shows, needs, incidents, and equipment.
  - **Community lead** (the Beneficiary debrief form): clothing counted before and after, conversations, needs, barriers, the meal rating 0 to 5, service delivery 0 to 5, other services people use and which, familiar faces, follow-ups (the need, not the person), and the team's mood.
  - **Dishwashers and the community welcome:** a few questions each.

## What the team sees

- **The event page:** a "Survey and itinerary" card under the Texts card shows:
  - The start time, which leaders can edit, and each role's arrival.
  - A preview of each role's page as a test link.
  - The survey count (answered of confirmed), the average meal rating and meals served.
  - Tallies of overall experience, needs, barriers and meal reactions, and "Read every answer".
  - Roster cards also say "Survey answered", "Itinerary texted", and a driver's part (Main driver, Pickup driver or Only driver; click the tag to switch).
- **Text settings:**
  - The survey section now has only the roles and the hour. The Google form link is no longer used.
  - A new Itineraries section: the meeting spot, the storage unit, the storage access, the dishwashing, the pickup lead time, the audit form, and the notes in English and French.
  - Under each role, its survey questions, with a tick to switch one off.

## The switch

`sms_mode` is still **off**. Nothing is texted: not the itineraries, not the surveys. The pages work regardless, and test links (`?test=1`) preview the itinerary and the survey early and save nothing.

## Built

- **Database:** `wa174_surveys`, which adds:
  - `volunteer_events.start_time`.
  - `volunteer_role_guides.arrive_offset_min`, `duration_min` and `itinerary`.
  - The `volunteer_itinerary_settings` table (staff only).
  - The `volunteer_survey_questions` table (staff read, and update to switch questions off) and the `volunteer_survey_responses` table (staff read; written only by `volunteer_survey_submit`).
  - The helpers `wa174_set`, `wa174_driver_kind`, `wa174_times`, `wa174_survey_open`, `wa174_questions` and `wa174_itinerary`. They are not callable anonymously.
  - `volunteer_confirm_get(p_token, p_preview)` rewritten.
  - `volunteer_survey_submit`, which is anonymous and validates against the questions.
  - `wa172_queue_surveys`, which now sends the volunteer's own link to every role.
  - `wa174_queue_itineraries`, called by `wa171_sms_tick`.
  - Quo message kind `itinerary`, with one per roster row.
  - app_config `sms_itinerary_hour` set to 17.
  - The arrival wording.
- **The page:** `build/c/src.html` (times, timed calendar entries, the survey, the itinerary).
- **The Hub:** `build/parts171/f_w174.js`, plus edits to b_data, c_event, d_settings and z_wire.

## Tests

- **Offline:**
  - `test/w174page.js` (41 pass).
  - `test/w174drive.js` (21 pass).
  - `test/w173page.js` (54) and `test/w173drive.js` (53), updated for the survey on the page.
- **Regression:** w124, w126, w128, w134, w151, w152, w153 and w163 show the same results on the new build and the live one.
- **In the database, rolled back:**
  - A driver's itinerary with pickups and route.
  - A cook's drop-off times.
  - The Community lead's survey: required answers missing, a bad option, an out-of-range rating, and a full answer kept with an Other answer.
  - The day-before itinerary text and the survey texts queued in live mode.
- **Live:** a Community lead test link shows the debrief survey, flags the required answers, and saves nothing.
