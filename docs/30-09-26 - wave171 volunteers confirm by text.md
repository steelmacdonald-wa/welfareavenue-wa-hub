# 30/09/26 - wave171: volunteers confirm by text (planned as wave169a), and the serving's format

Planned in the project docs as wave169a (claude/hub-wave169-plan-texts-whatsapp-itineraries.md). A parallel session shipped a different wave169 (the master onboarding and Academy assignments) and started wave170 (the inbox) while this was built, so it ships as wave171; its first migration went in as `wa169a_texts` and `wa171_texts` renamed its functions from `wa169_*` to `wa171_*`.

Steel (29/09/26): "confirm with volunteers using a Quo text function in the hub. It sends them a personalized message to confirm their volunteer date and position via a link for them to press confirm on their phone which then opens up what they should expect in their position in Welfare Avenue branding and photos (cooks get a cook photo, drivers get a driver photo, etc)"; "confirmations should be 7 days before with a link to confirm which shows the dashboard it's confirmed".

## What volunteers get

- **The text**, from the ops line (438) 808-7754 (Quo number `PNoy535A78`, "Welfare Phone", checked through the API): "Hi <first name>, it's Welfare Avenue! You're on the list as a <role> for our serving on <Sunday, October 4>. Please confirm here: https://hub.welfareavenue.com/c/<token> (or reply YES or NO). Reply STOP to stop texts." In French when the person's CRM contact says French.
- **When:** 7 days before the serving from 10 am Toronto (`sms_confirm_days`, `sms_confirm_hour`), to everyone on the roster not confirmed, declined or cancelled and never texted for that serving; anyone added later gets theirs at the next quarter hour; only between 8 am and 8 pm. Staff can also press Text to confirm on the event.
- **The page** (hub.welfareavenue.com/c/<token>, `build/c`): phone-first, the brand's green band with the role's photo, the lockup, EN and FR; first name, role, date, place and the format; Confirm, I will be there and I can't make it. After Confirm: "You're confirmed!", the role's photo, what to expect as a <role>, what to bring and when to arrive (`volunteer_role_guides`), the ops line, and a way to change the answer. A past or cancelled serving and an unknown link say so. `?test=1` shows everything and saves nothing. Old `#confirm/<token>` links go to the new page.
- **Replies:** YES/OUI (and OK, CONFIRM) confirms, NO/NON marks the person Unavailable, each with a short thank-you text; STOP/ARRET stops all texts to that number (always, whatever the mode); START turns them back on; anything else waits for the team under Replies on the event (answering questions by text is the planned wave169b).

## What the team sees

- **The event page:** a Texts card at the top of the side rail: texts off, test or on; confirmed of the list, by text, waiting (and how many were texted), can't make it; when the texts go out; Text to confirm (leaders, HR, admins: who has not answered, already-texted people unticked, no-phone people greyed, the text's preview); Send me a test (admins: the first person's text with a test link, to the test phone only); Text settings; the latest replies with what the Hub did with them. Each roster card says "Confirmed by text link · time", "Replied YES", "Can't make it (text link)", "Texted · no answer yet", "The text did not go through" or "No phone number". The masthead shows the format and "x of y confirmed · z by text". The page re-reads the roster every 30 seconds while it is open, so a tap on a phone shows up without reloading.
- **The Volunteering calendar:** each upcoming serving shows its format, "format not set" when it has none, and "n by text".
- **Home and the Executive dashboard (staff):** the next serving: when, the format, x of y confirmed, by text, can't make it, a bar, who we are still waiting on, and Open the serving. Board viewers do not see it.
- **Text settings:** the switch (off, test, on; admins, with a confirm step; `wa171_sms_mode_set`, logged in change_log; switching off skips anything queued), the test phone (Steel's, 438 869 4539), and per role what volunteers see (the names in English and French, the photo from the Photo library's ready photos, what to expect, bring and arrival in both languages).
- **The format** (wave169 plan part 1): Home-cooked or Community kitchen on every serving (click the pill in the masthead), with the kitchen, the cooking shift, the kitchen contact and the ingredients for a kitchen serving.

## The switch

`sms_mode` is **off**. Nothing is texted until an admin switches it (test first: only the test phone gets texts, so Steel can put himself on a roster and try the whole flow; then on). The assistant never switches it. Replies are still filed while it is off.

## Built

- Database (`wa169a_texts`, then `wa171_texts`, `wa171b_guides_wording`, `wa171c_training`, `wa171d_grants`): `quo_messages` gains direction, kind, roster_id, quo_id, handled, sent_at (checks on direction, kind and status; one live confirmation per roster row; one row per incoming Quo message); `volunteer_role_guides` (9 roles seeded from the past itineraries; staff read and edit); `volunteer_events.format`, `kitchen_place`, `kitchen_shift`, `kitchen_contact`, `ingredients_note`; `volunteer_event_summary` adds format, roster_by_link, roster_declined, roster_texted; `volunteer_confirm_get` and `volunteer_confirm_submit` rewritten (the statuses the Hub uses: Confirmed and Unavailable; past and cancelled servings refused; logged); `wa171_queue_confirms`, `wa171_sms_tick` (cron `wa-sms-tick`, every 15 minutes, only while test or live), `wa171_text_to_confirm`, `wa171_sms_mode_set`, `wa171_inbound`, and helpers (not callable from outside); app_config `sms_mode`, `sms_test_phones`, `sms_confirm_days`, `sms_confirm_hour`, `sms_link_base`, `quo_webhook_id`; the `sms_` keys are admin-only in `wa_app_config_guard`.
- Edge functions: quo-send v3 (platform 12: leaders, HR and admins only, audit item 17; drain; test_confirm; numbers; webhook_setup and webhook_status; STOP respected in the Text volunteers window), quo-events v1 (platform 2, new, the webhook), host-sync v8 (platform 15, the c page).
- Quo: webhook 41951 (`message.received`, API 2026-03-30) to quo-events; its signing key in the vault as `QUO_WEBHOOK_SECRET`. A real reply arrived at 01:37 UTC on 30/09/26 and was filed (texts off: kept only).
- The page: `build/c/src.html` and `make.py`; `_redirects` (source `build/site/_redirects` since this wave) adds `/c/*`; `_headers` adds the Hub's strict policy on `/c/*`.
- The Hub: `build/parts171` (a_head, b_data, c_event, d_settings, e_cards, z_wire) → `src/171_wave171.seg`; `src/031_wave31.seg` (old links forward to /c/, Unavailable counts as declined).
- Training: the Volunteering tour's Texts and format stops, the Home tour's next serving stop, both tours' descriptions in the Academy.

## Tests

`test/w171page.js` (24: the page offline, both languages, test links, past and unknown links, the kitchen format, the phone width) and `test/w171drive.js` (43: the Texts card, tags, masthead, format editor, Text to confirm, Send me a test, Text settings, the live refresh, calendar, Home and the Executive dashboard, a leader, a board viewer, the phone). In the database, rolled back: queueing in live and test mode, a YES, a question, a duplicate delivery, STOP, a non-test number in test mode. Live: the webhook with a signed test delivery (filed, then removed); the page at hub.welfareavenue.com/c/ with a test link (nothing saved, checked in the database).

## Left for later (the wave169 plan)

The day-before text (WhatsApp link and itinerary), the morning-of text, itineraries by format, answering questions by text (wave169b), telling the event lead about a decline, moving the shared Quo login out of staff_notes.
