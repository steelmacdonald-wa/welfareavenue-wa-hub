# 30/09/26 - wave172: each role on the confirm page, the sign-up notice, and the survey

Follows wave171 (volunteers confirm by text). Steel (30/09/26): "maybe for cooks allow them to choose what recipe they plan to cook based on the options we have. Also confirmation texts should only be 7 days before the event they signed up to. When volunteers sign up for more than one event or an event one month in the future they should only be notified that they have the event(s) coming up and that they have the option to add it in their calendar but only get a confirmation text 7 days before each event they signed up to. Do the same for server (note that they could bring donations they want to give, they should also get a text after the event is done to do a quick survey), driver (if they are new we'd need to know their car model and type), photographer (we need to allow them to give them ways to share the photos with us if this is in the SOP on the options for them to share), Community Lead aka Community debrief should be given a run down and the forms needed to capture data at the events, and team leader."

## Texts

- **Confirmation, 7 days before each serving** (unchanged from wave171: only servings 7 days out or closer are ever asked to confirm).
- **Sign-up notice (new):** when someone is added to one or more servings more than 7 days away, one text per phone (after 10 minutes, so several sign-ups go together; only rows added in the last 3 days): "Hi <first name>, thanks for signing up with Welfare Avenue! You're on the list for: Sunday, November 15 (cook), Sunday, December 13 (server). See your servings and add them to your calendar: <link>. We'll text you 7 days before each one to confirm." Nothing to confirm. French for French contacts.
- **Survey (new):** after the serving, from 6 pm Toronto on the day (or the next day if missed), a thank-you with the Volunteer Survey (the Google Form in the master SOP) to the confirmed volunteers in the chosen roles (servers now; Text settings changes the roles, the hour and the link).
- All three follow the switch (off, test, on), STOP, the test phone and the 8 am to 8 pm window.

## The page (hub.welfareavenue.com/c/<token>)

- **More than 7 days away:** "You're signed up!", "We will text you on <date> to confirm your spot", Add to calendar (Google Calendar or an .ics file for Apple and Outlook), the role's questions, the person's other servings (each with its state, its own link and its calendar buttons), what to expect, and I can't make it. No Confirm button until 7 days before.
- **Each role:** cooks choose their dish from the Hub's recipes (how many cooks already chose each, the recipe's link; saved as the roster row's recipe, the same one the event summary shows); servers say what they are bringing to donate; drivers give their car type and model (a new driver's is asked, a known one is shown and can be updated; kept on the volunteer's record); photographers say how they will share (the Google Photos album, the Drive folder or email to marketing@).
- **Forms and guides per role** (from the master SOP): servers the survey; drivers the driver role document; photographers the content guide and the three ways to share; the community lead (the community_debrief role, now called Community lead) a run-down and the Beneficiary form; team leaders the Tracking form, the Beneficiary form, the weekly audit and restock form and the survey to share. Grouped before, during and after the serving.
- **After the serving:** the survey button for the survey roles.

## The Hub

- Roster cards also show "Cooking: <recipe>", "Bringing to donate: ...", "Car: ...", "Photos by ...", "Told they are signed up" and "Survey texted".
- Text settings: the survey (link, roles, hour; admins) and each role's forms and guides (one per line: before, during or after | English | French | link).
- The role label Community debrief reads Community lead (Volunteering, the CRM).

## Built

- Migration `wa172_roles`: app_config `sms_survey_url`, `sms_survey_roles`, `sms_survey_hour`; `event_roster.created_at` (new rows), `signup_noticed_at`, and a default `confirm_token`; quo_messages kinds `signup` and `survey` (one survey per row); `volunteer_role_guides.links` and the new wording; `volunteer_confirm_get` (state early, opens_on, recipes, details, events, survey_url, links), `volunteer_confirm_details` (new, anonymous by token), `wa172_queue_signups`, `wa172_queue_surveys`, `wa171_sms_tick` calls both.
- quo-send v4 (platform 13). The page `build/c` (c/index.html bfb1f0b5743ceb1582f757f451ea745e). The Hub: `build/parts171` (b_data, c_event, d_settings, z_wire, a_head), `src/020_wave20.seg` and `build/parts152/a_head.js` (the label).
- Tests: `test/w172page.js` (44), `test/w172drive.js` (50); in the database, rolled back: the sign-up notice (one text for two servings, not twice), the early state and the other servings, a recipe (and a refused one), donations, a driver's car, a survey the day after.

## Open

- The recipe links are the Drive files in the Recipes tab: check they are shared so volunteers can open them.
- Servings have no start time in the Hub, so calendar entries are all-day.
