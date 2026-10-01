# 01/10/26 - wave191: the Volunteer Manager's flow, Find volunteers, and texts only 9 am to 7 pm

Steel's asks (01/10/26):
- "Our operations team needs the Volunteer manager to be easy to use and make each part of the event planning process as seamless as possible. There's a lot of information everywhere and I'd like to clean it up and better show the flow of our event planning process ... Apple UI, but with ClickUp's robustness and Welfare Avenue's Montreal operations processes in place." Scope: everything, the SOP included. SOP steps the Hub now does: linked to the Hub (they tick themselves; the Hub drafts new wording for ops to approve). Servings close the day after.
- The operations sheet the team is leaving ("Reoccurring Volunteers 2026"): the Hub's rosters replaced with the sheet's.
- "A feature in the recruit section of the event to help recruit for upcoming event(s) and look through our CRM to find people that signed up and never volunteered, volunteered a lot but haven't in a while, volunteered once before, submitted a survey saying they liked the experience ... and then shoot them personalized texts." "It should use QUO to enable conversations with people and only message them throughout 9am to 7pm."

## The serving page: six stages
Plan, Recruit, Confirm, Prepare, Day of, Wrap up (more than 14 days out, 14 to 8, 7 to 3, 2 to 1, the day, after).
- A calm header: the date, the countdown, the format, one gold action for the stage, All servings, a More menu, and the stage bar.
- **Next up**: what the serving needs (the format, a short roster, people to confirm, the WhatsApp link) and the steps a person must do now.
- **The team**: the roster board with confirmed of listed, what the roles need (targets in `volunteer_role_guides.target`: team leader 1, cooks 4, drivers 2, servers 8, dishes 1, photographer 1, community lead 1) and the short roles; partner organizations labelled as such.
- One section per stage holding its cards and steps (the plan in Plan, the Texts card in Confirm, the itinerary in Prepare, the day's contacts in Day of, the survey and the recap in Wrap up). The current stage is open; the others fold to one line.
- Steps the Hub does tick themselves (`wa191_autotick`, `sop_template.hub_signal`) and say so; a person's untick is never overridden.

## This week, the SOP, closing
- The calendar opens on **This week**: the servings by stage with their next step, overdue steps, steps with no owner, the signed-in person's own steps, **Did it happen?** for past servings the Hub cannot tell about, and (wave191e) how many texts from volunteers wait for an answer.
- **The SOP** shows each step's stage, the Hub-done badge, and 13 proposals for outdated wording (the Excel sheet, Canva, email drafts) that leaders, HR and admins approve or dismiss.
- A finished serving closes itself the day after only with evidence it happened (someone confirmed, a survey answer, a step a person ticked); otherwise it waits in Did it happen?

## Find volunteers (wave191e)
In the Recruit stage (gold button), in Next up when roles are short, and in the More menu.
- **Who**: every volunteer the CRM knows, in five groups: **Never came** (signed up, never served), **Regulars we miss** (3 or more servings, none in the last 60 days; both numbers editable), **Came once**, **Loved it** (Excellent or Good on the Hub's survey or the volunteer feedback form, matched by the email they left, unless they said "not at this time"), **Everyone**. Servings count as the CRM counts them (confirmed at completed servings, plus the old website's attended servings).
- **Filters**: role, search, not texted in 7 days, not on these servings yet, has a phone; sorted by best fit, most servings, longest away, most recent or name.
- **Invite to one or several upcoming servings**: they go on the roster as Waiting For Response (`detail.source = recruit`); a CRM contact without a volunteer record gets one, linked to their contact.
- **The texts**: one personal text each from the ops line through Quo, in their language, worded per group (placeholders `{first} {dates} {served} {last} {role} {answer} {link}`), with their own link and "Reply STOP to stop texts". Review the texts shows the real ones before anything goes; the wording can be saved as the default (`app_config recruit_templates`). A YES by text or a tap on the link confirms them; their link opens on Yes or Can't make it whatever the date.
- **Conversations**: every number that texted or was texted lately, who waits for an answer, the thread (the Hub's copy plus what was typed in the Quo app), and a reply from the ops line. The Texts card's replies have Reply.
- **Rules**: `sms_mode` decides as for every automatic text (test: only the test phone gets one; the rest are added without a text), STOP is respected, nobody gets two invitations in 3 days, an invitation is not a sign-up (no sign-up text, no automatic 7-day confirmation). Adding: staff; texting and replying: leaders, HR and admins.

## Texts only 9 am to 7 pm
Every text to volunteers (confirmations, sign-up notices, surveys, itineraries, invitations, thank-yous after a YES or NO, replies, Text volunteers) goes only between 9 am and 7 pm Montreal time (`app_config sms_window_start` 9 and `sms_window_end` 19, admin-only; `wa191_sms_window()`). Outside those hours texts wait in the queue and go at 9 am.

## Data brought in from the operations sheet
- Upcoming servings WA-26-21 to WA-26-27: the sheet's rosters replaced the copied ones (wa191c; backups in `event_roster_backup_w191`); WA-26-27 cancelled and WA-26-22 named "Oberoi Financial partnership", as in the sheet. The sheet's rows never get the sign-up text.
- Past servings WA-26-18 (23/08) and WA-26-19 (06/09) had no one confirmed in the Hub: the sheet's rosters replaced them (wa191f; 12 and 17 confirmed), and 12 people who served but were not in the directory got a volunteer record. Without this, someone who served on 6 September would have been invited as a regular "we miss".
- WA-26-20 (20/09) is cancelled, as in the sheet (wa191b).

## Pieces
- Migrations: `wa191_flow`, `wa191b_close_evidence`, `wa191c_sheet_import`, `wa191d_role_targets`, `wa191e_recruit` (20261001200000), `wa191f_past_rosters` (20261001200500), `wa191g_stage_search_path` (20261001201000).
- Functions: `wa191_signal`, `wa191_autotick`, `wa191_sop_proposal`, `wa191_stage`, `wa191_this_week`, `wa191_this_week_unclosed`, `wa191_happened`, `wa191_close_past`, `wa191_settle`; `wa191_sms_window`, `wa191_recruit_pool`, `wa191_person_served`, `wa191_recruit_send`, `wa191_recruit_render`, `wa191_recruit_templates`, `wa191_recruit_templates_save`, `wa191_recruit_default_templates`, `wa191_recruit_inbox`, `wa191_recruit_thread`, `wa191_text_reply`. Patched: `wa171_sms_tick`, `wa171_queue_confirms`, `wa171_inbound`, `wa172_queue_signups`, `wa182_itinerary_tick`, `wa182_auto_itineraries`, `volunteer_confirm_get`. Cron `wa-serving-flow` (new) and `wa-sms-tick` (runs while texts are on or something is queued).
- `quo_messages.kind` adds `recruit` and `reply`.
- Edge function `quo-send` v5 (platform 14): the window for every kind, person-written texts (manual, reply) whatever `sms_mode`, STOP checked again before sending, Text volunteers queued outside the hours, `thread` (the Quo conversation with one number).
- The Hub: `build/parts191` (a_head, b_model, c_event, d_week, e_sop, f_recruit, z_wire) into `src/191_wave191.seg`; `parts171` (the window wording, Reply on replies); `src/020`, `106`, `122` (the tour), `023` and `031` (Text volunteers queued outside the hours).
- The volunteer's page: `build/c/src.html` (an invitation's wording).
- Tests: `test/w191drive.js` (39), `test/w191rec.js` (40), `test/w191cpage.js` (7); `test/w173drive.js`, `test/w174drive.js`, `test/w182drive.js` updated for the stages.

## Release
Live on 01/10/26 (about 16:45 Toronto): the Hub at md5 e0f7167608d8b2a75716536e4ed560e5 (5,440,692 bytes; on top of wave192 The Loop, first shipped as 72a1b7db and then with the sheet in the brand cream), `c/index.html` 5a7e755c92c22f516e4accc651459b0e, in gated deploys with host-sync; the plain build of `build/src` reproduces live. quo-send v5 (platform 14). change_log release wave191. Nothing was texted to a volunteer: `sms_mode` is test.
Checks: `test/w191drive.js` 39/39, `test/w191rec.js` 40/40, `test/w191cpage.js` 7/7, `test/w173drive.js` 53/53, `test/w174drive.js` 21/21, `test/w182drive.js` 31/31, `test/w174page.js` 41/41, `test/w182page.js` 30/30; the drive regression (51 files that pass on the live build) green; the volunteering tour highlights 13 of 16 steps (12 before). Security advisor: no new ERROR (the one ERROR is `volunteer_people`, wave176); `wa191_stage` got its search_path (wa191g).

## Open
- Turning texts on (`sms_mode` live) is Steel's switch: the 4 October serving's people still waiting get their confirmation at the next quarter hour between 9 am and 7 pm.
- `crm_contacts.language` is empty for everyone, so every text goes in English until languages are set.
- Replies typed in the Quo app show in the Hub's conversations for leaders, HR and admins (read from Quo); the Hub's own copy only has what it sent.
