# 16/10/26 - wave258v (the volunteer texts, clear and checked) and wave259 (the Volunteer Manager refresh, A and C)

Steel, after the operations meeting of 15/10/26: "all of them should be able to text"; "Clarify what automated texts
are going out to the volunteers so that we know going forward what [and] when"; confirmations "a week and a half before
the event"; a check-in "the Thursday before"; "they need to check a box saying they must cancel four days before ... All
the roles should say that in the confirmation text"; "the cooks should have been able to choose their recipe before
then"; and at 23:15: "I need the text to be very clear on when they send out for each event ... the UI is just getting
really messy ... consider some sort of refresh so that navigation, applications, the phone, everything makes more sense."
The review and the proposal: the project doc "15/10/26 - Volunteer Manager refresh, proposal and the text schedule".
(Another session shipped its own wave258, the Fundraising follow-through, the same evening; its segment keeps the name
`258_wave258.seg`, this one is `258v_wave258v.seg`; the live build carries both, rebased exactly.)

## The texts, for a Sunday serving (Toronto time, 9 am to 7 pm, once per person per serving)

| When | Text | Who |
|---|---|---|
| Thursday 10 days before, 10 am (`sms_confirm_days` 10, was 6) | Confirmation: role, date, link, YES/NO, "tell us at least 4 days before (by Wed ...)". Cooks: choose your dish and pick-up or drop-off first. | Everyone on the list who has not answered |
| Monday of the week, 10 am (`sms_reminder_days` 6) | Reminder (kind `reminder`): confirmed "you're confirmed, tell us by Wednesday if anything changes"; not answered "we still need your answer by Wednesday" | Confirmed or texted, not declined |
| Wednesday, 4 days before (`cancel_notice_days` 4) | Last day to cancel (no text) | |
| Thursday 3 days before, 10 am (`sms_checkin_days` 3) | Check-in (kind `checkin`): confirmed "see you Sunday, your details, call us right away"; not answered "can you still come? reply today" | Same |
| Saturday 5 pm | Itinerary | Confirmed team leaders, drivers, roles with an itinerary |
| Sunday 6 pm | Thank-you and survey | Everyone confirmed |

`wa258_queue_nudges` (from `wa171_sms_tick`), `wa258_nudge_text` (English and French), switches `sms_reminder_on`,
`sms_checkin_on`. The assignment text (wa257_text) and `wa171_confirm_text` carry the rule. After each automatic round
leaves the queue, one Hub notification (kind `volunteer_texts`, no Slack, no email) to `texts_notify` (Ibrahim, Mary,
Terry): how many went, failed (who), skipped (`wa258_round_notices`, `wa258_notify` through hub-push relay).

## Who may text

`wa256_can_text`: leaders, HR, admins, and `app_config text_staff` (Ibrahim, Mary, Terry). The six database checks
(wa171_text_to_confirm, wa191_recruit_send, wa191_text_done, wa191_text_reply, wa239_pool_send, wa182_staff_can_send)
patched in place to ask it; quo-send v7 `authorize` asks it too; the client checks in 171, 191 and 239 include it.

## The volunteer's page (build/c, live 7f619366)

Before Confirm, every role sees what it involves (guide, links) and its own questions; a required box "If I can't make
it, I'll tell Welfare Avenue at least 4 days before (by <date>)" and, when the role has a guide, "I've read what my role
involves". A cook must choose a dish and pick-up or drop-off, a driver say their car (when none is on file), a Community
lead read the briefing: `volunteer_confirm_submit` refuses otherwise (reason `rule` or `needs`, `wa258_needs`); Confirm
saves the details first (`volunteer_confirm_details`). Confirmed: the rule and its date. A confirmed volunteer saying no
under 4 days before is asked once to call us too; `late_cancel` on the row; the role's owner (`volunteer_role_owners`)
and `texts_notify` get a Hub notification. The page opens Confirm as soon as the confirmation text went (not only from
`sms_confirm_days`). Tests: test/w258page.js 29, w173page 54, w191cpage 7, w235page.

## The Hub, wave258v

- A serving: the **Texts strip** under the header (each automatic text with that serving's date and how many went; Mary:
  cooks, drivers, team leaders; Eleftherios: servers, dishwashers, photographers; Text log, My roles, Role owners), More >
  **Text log** (`wa258_text_log`: each person, their answer and the 4-day box, every text with what Quo says happened,
  replies; Not delivered or no phone, Not answered, My roles; **Check delivery now** = quo-send `delivery`; Text the ones
  not answered = Text to confirm). Roster cards: 4-day rule agreed, Cancelled late, No phone number, the last text and
  its delivery, **From the old sheet: check** with Keep (`wa258_sheet_keep`) or Remove (the card's Take off). My roles
  dims the other columns. Applicants received: My roles in the role filter; each card and Volunteers row say who last
  texted them (`wa258_contacted`). Role owners window (`wa258_role_owners`, `_set`; leaders and admins).
- Delivery: quo_messages.delivery, delivery_at (Quo's status, GET /v1/messages/{id}), read every quarter hour while texts
  of the last two days have no final status.
- Tests: test/w258drive.js 28.

## The Hub, wave259 (parts A and C of the proposal)

- Five places, the same on the rail and the phone chips: **Servings, Calendar | People, Messages | Setup**
  (parts153/a_head.js). Every old address opens; `#volunteering/messages` is `/phone`.
- **People**: one page, tabs under the title: Volunteers, New applicants (n), Sign-offs (n) (the three pages unchanged
  inside; the People badge is applicants plus sign-offs waiting). The rail lights People for all three, Setup for the
  SOP, recipes and inventory.
- **Messages**: wave256's Phone under its right name and title.
- **Setup** (`#volunteering/setup`): tiles for the SOP, Recipes, Inventory; **Texts to volunteers** (the schedule above
  for the next serving with real dates, the following servings in one line, the two switches, the four day counts,
  Text settings; `wa259_text_setup`, `wa259_text_switch`); **the usual spot counts** (volunteer_role_guides.target);
  **Role owners**.
- Words: All servings, Loading the serving, Who is on this serving, Cancel this serving (020, 106), Serving recap (119b),
  Dishwashers (209, 218), the Text settings window reads the real days (parts171). On a computer the card's repeated
  "Volunteering · Montreal" header is hidden under the page title.
- Tests: test/w259drive.js 22; regression w257 24, w256 30, w209 34, w195 52 (its chip and rail checks now expect the
  People tab and badge), w191 39, w191rec 50, w153 46, w176 14 (five places), w239 44, w244, w234, w218 27, w200 49.
  w173drive's 3 failures are pre-existing (social-publish capability calls in its stub).
- Still to do (parts B and D): the serving page in three bands with a short grouped More menu, and one placement window.

## Data and release

- Migrations: wa258_texts_a, _b, _c, _d (build/data/wa258_texts.sql), wa258_stage_c, wa259_setup, wa259_stage;
  build/data/wa258_release.sql (tour rows, release lines). quo-send v7 (platform 17).
- Live 16/10/26 about 01:05 Toronto: index.html `7678c6163af26d128aae2f07a8ceb6f3` (7,473,895 bytes) over the other
  session's 432cf499 (rebased byte for byte: their 258_wave258 segment and their edits to 110, 116, 122, 127, 131, 213
  match GitHub 961acb2e); c/index.html `7f6193669b52aa74cf9344ca0735900d` (live since 23:20 on 15/10). Stage tables
  wa_stage_258c, wa_stage_259 closed (anon revoked, policies false).
- Security advisor: no new ERROR (the two shown predate this: the volunteer_people view, wa_stage_push244_rids).
