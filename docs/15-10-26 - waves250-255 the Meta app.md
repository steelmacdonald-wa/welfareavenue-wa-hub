# 15/10/26 - wave250: Meta, live (webhooks)

Steel, 14/10/26 Meta app prompt, item 2: Meta tells the Hub when something happens, instead of the Hub asking every few
minutes. Live 15/10/26.

## What is set up in Meta (HUB-Analytics, app 1094841356812815, business 686100608981552)
- Callback `https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/meta-events`, verify token `META_VERIFY_TOKEN`
  (generated into the vault by wa250; nobody types it; admins can read it with `meta_verify_token()`, which is logged).
  Meta verified the callback three times on 15/10/26.
- The app's subscriptions: page, instagram and whatsapp_business_account (`app_subscribe`, with the app token).
- The Page's subscribed_apps (Page 100248828522234): feed, messages, message_echoes, mention, leadgen (`subscribe`).
- Signature: every POST carries `X-Hub-Signature-256`; the function checks it with `META_APP_SECRET` (Steel added it as an
  Edge Function secret on 15/10/26; the function reads the vault first, then the env). A bad signature is refused.

## The function (fn/meta-events, v1.1, platform 4, verify_jwt off)
- Each event goes into `meta_events` (object, field, account, ref id, signed, status, result) with message text stripped;
  60 days (cron `wa-meta-events-prune`, Mondays 08:30 UTC).
- Events are hints: the Hub reads the real thing back from Meta before acting (a lead with GET /{lead}, a DM thread with
  social-dms, comments with social-inbox).
- feed / mention / Instagram comments: social-inbox sync, 7 days, at most once a minute.
- messages: social-dms `dm_sync` for that person. leadgen: wave252. whatsapp: wave254.
- Actions (x-wa-secret or an admin): status, subscribe, app_subscribe, probe, lead {id, dry}, replay {id}, prune.
- Never posts, DMs or emails anyone.

## In the Hub
- Content Studio > Connections > "Meta, live": live updates (the subscribed fields), signed by Meta, the last update,
  Messenger readable, Instagram DMs limited until App Review, lead forms, ad accounts; Check and Subscribe again.

## Test
- The dashboard's "Test" for the Page feed field could not be pressed from automation (the dialog ignores scripted
  clicks), so no sample event has landed yet; `meta_events` is empty. The first real comment, DM or lead will show in the
  card's "Last update". Steel can also press Webhooks > Page > feed > Test > Send to server himself.

# 15/10/26 - wave251: Messages in the Content Studio

Item 1: Messenger and Instagram direct messages answered in the Hub; the marketing team and admins reply, the leads
delete. Live 15/10/26 (index.html 5879e6f2).

## Page (Content Studio > Messages, `#studio/messages`; build/parts225/m_meta.js)
- Counts: waiting for us, window closing (under 4 hours left of Meta's 24-hour window), answered from the Hub (7 days),
  last check and Check now.
- Filters: Open, Answered, Everything, Removed; All / Messenger / Instagram.
- A thread: the conversation, reply box (only inside the 24 hours; after that it points to Meta Business Suite), a
  suggested reply (the llm router), assign to a teammate, resolve / reopen, mark read; leads (wa225_publisher) archive and
  restore. The rail shows the count waiting.
- Instagram note: until App Review, Meta only shows conversations with people who have a role on the app, so the page says
  to answer most Instagram DMs in Meta Business Suite for now.

## Data (build/data/wa251_dms.sql, wa251b_comments.sql)
- `social_threads` and `social_messages`; read by `wa225_marketing()` or `wa225_publisher()`; written only by social-dms.
- `hub_settings studio_dm_sync`: the last sync, counts, `limited`.

## Functions
- social-dms (platform 3): dm_sync, dm_reply (Send API, messaging_type RESPONSE), dm_resolve, dm_reopen, dm_read,
  dm_assign, dm_archive, dm_unarchive, status. Nothing is sent except when a person presses Send.
- social-inbox v2 (platform 4): a sync of 14 days or more also syncs DMs (the nightly 45-day run).
- meta-events: a `messages` event syncs that person's thread within seconds.

## Found on 15/10/26
- Messenger is readable (the last conversation is from January 2026). Instagram DMs: "too many conversations with users
  who do not have a role on app, please request advanced access" beyond the first page.

## Tests
- test/w250drive.js 24 of 24 (Messages and Paid and organic, desktop and phone); test/w225drive.js 47 of 47 (nine cards).

# 15/10/26 - wave252: lead ads into Applicants received

Item 3. No lead forms exist on the Page yet, so this waits for the first form; the path is live.

## How a lead is filed (fn/meta-events, `fileLead`)
- A `leadgen` event: the lead is read back with GET /{lead id} (field_data, form, ad, campaign, organic or paid).
- Name from full_name (or first_name and last_name), email, phone, city; the role from a question whose key mentions role,
  position, poste, volunteer, bénévole or "how would you like to help", else the form's name.
- A volunteer role (`wa209_volunteer_roles` on that text; anything about volunteering, serving, cooking, driving or the
  kitchen counts as volunteer) goes to `wa209_volunteer_apply` with source facebook and source_ref `fblead:<id>`: the
  same path as the website volunteer forms, so it lands in Applicants received, the CRM and the volunteer directory.
- Anything else becomes a New card in Recruitment (`hub_candidates`, source facebook), one card per person and role within
  90 days, with a change_log line.
- The other answers are kept on the record. Nothing is sent to the person.
- `lead {id, dry: true}` shows where a lead would go without filing it.

## For Steel
- Name forms so the role is obvious ("Volunteer - Montreal Sunday serving", "Bénévole - service du dimanche"), or add a
  multiple-choice question "How would you like to help?". Ask for full name, email and phone.

# 15/10/26 - wave253: Paid and organic

Item 4: ads beside organic, read-only. Live 15/10/26.

## Page (Content Studio > Paid and organic, `#studio/ads`)
- 7, 30 and 90 days. Organic: posts, reach (sum of posts), engagements, from Analytics. Paid: spent, people reached,
  results and cost each, a daily spend bar, impressions and clicks, the campaigns table, the ad accounts and a link to
  Ads Manager. "The Hub never changes an ad."

## Data and function
- `social_ad_daily` (account, campaign, day; read by staff and board viewers); `hub_settings studio_ads_summary`.
- social-ads v1: sync (Marketing API insights at campaign level, one row a day; a result is the action matching the
  campaign's objective), summary, accounts. Cron `wa-social-ads` daily 07:40 UTC.

## Found on 15/10/26
- act_570313852513008 (CAD): $136.96 lifetime, one campaign in September ("Instagram post: 10 DAYS AWAY!!", link
  clicks); last 30 days $33.28, 2.8k reached, 106 link clicks at $0.31.
- act_352486075290612 (CAD): no spend.

# 15/10/26 - wave254: WhatsApp beside the texts

Item 5, built on Meta's test number. Everything is off: nothing is sent until Steel switches it.

## Meta
- Test number +1 555 676 5057 (phone id 1442123962307619, WABA 984036304713487).
- Four UTILITY templates, approved 15/10/26: wa_serving_reminder (en 1097502786369851, fr 1887907846271680) and
  wa_still_in (en 2723660278048450, fr 4222004394602891), with Yes / No quick replies and a STOP footer.

## Data (build/data/wa254_whatsapp.sql)
- `whatsapp_messages` (staff read): one row per WhatsApp message, its wamid and delivery status.
- `crm_contacts.whatsapp_opt_out`.
- `trg_wa254_mirror` on `quo_messages`: a confirm or still-in text also queues its WhatsApp copy (only counts when the
  channel is on; errors never block the text).
- `wa254_inbound(p)`: replies and button presses, YES / NO / STOP read the same way as the texts.
- app_config (admins only): `sms_whatsapp_mode` off | test | live, `sms_whatsapp_channel` off | both,
  `sms_whatsapp_test_phones`, `sms_whatsapp_phone_id`. All off.
- Cron `wa-whatsapp-drain` every 15 minutes; sends nothing while off, and only inside the texts' hours (9 am to 7 pm).

## Function whatsapp-send v1
- status, templates_create (admin), drain (secret), inbound (secret, from meta-events), test (an admin, to a test phone).
- Rollback test 15/10/26: a real confirm row (Andres, driver, Sunday 18 Oct 11:30) mirrored, confirmed and queued its
  acknowledgement; everything rolled back, nothing sent, 0 rows left.

## In the Hub
- Connections > WhatsApp: the number, business verification, the mode, the four templates' status, Sending (Off / Test /
  Live), With the texts (Texts only / Texts and WhatsApp), Test phones, Send me a test.

## Going live (Steel)
- Welfare Avenue's own number (not already on WhatsApp), business verification, a payment method in WhatsApp Manager.
  The production number sits in a new WABA, so the templates are created again there (templates_create) and
  `sms_whatsapp_phone_id` is switched.

# 15/10/26 - wave255: Facebook Fundraisers (written up, not built)

Item 6: build only what works without enrolment. Nothing does, so this is the write-up.

- Reading fundraisers and donations (the Fundraiser API's reporting) needs the Page enrolled in Meta's charitable giving
  tools and the `page_read_donations` permission, which our token does not have.
- In Canada, enrolment goes through PayPal Giving Fund Canada (Meta pays out through it), with the charity's registration.
- Creating fundraisers through the API is for peer-to-peer fundraising platforms, not for a charity's own Page.
- Once enrolled and the permission is granted, a small read of the Page's fundraisers and donations into the Hub (beside
  the donations from the Give page) is the next build.

Sources: developers.facebook.com/docs/fundraiser-api/reporting and /integrate; PayPal Giving Fund Canada.

# 15/10/26 - Meta app: what Steel needs to do

The six Meta additions are in the Hub (waves 250 to 255). These are the steps only you can take; nothing below needs me
to touch a password or a document.

## 1. App Review, once business verification is approved
You submitted verification today. When Meta approves it, in the HUB-Analytics app (App Review > Permissions and
features) request Advanced Access for:
- `instagram_manage_messages` (Instagram DMs beyond people with a role on the app; until then, answer most Instagram DMs
  in Meta Business Suite, as the Messages page says).
- `pages_messaging` (replies from the Hub to anyone on Messenger).
Meta asks for a screen recording of the Messages page in use and a line on why; I can draft that text when you're ready.

## 2. WhatsApp: try it on your own phone (optional, now)
- Meta app > WhatsApp > API Setup > "To": add your number and enter the code Meta sends (up to five test numbers).
- Hub > Content Studio > Connections > WhatsApp: add the same number to Test phones, set Sending to Test, press
  "Send me a test". Set Sending back to Off after.

## 3. WhatsApp: going live
- A Welfare Avenue phone number that is not already on WhatsApp.
- Business verification (submitted today).
- A payment method in WhatsApp Manager (you enter it; I never do).
Then tell me, and I'll move the templates to the new number, switch the phone id, and you choose Test, then Live.

## 4. Lead forms
None exist yet. In Meta Business Suite > Instant Forms, name each form for its role ("Volunteer - Montreal Sunday
serving") or add a question "How would you like to help?", and ask for full name, email and phone. Sign-ups go straight
to Applicants received (volunteer roles) or Recruitment (team roles).

## 5. Facebook Fundraisers
Enrol the Page in Meta's charitable giving tools through PayPal Giving Fund Canada, then add `page_read_donations` to the
system user's token. After that I can bring fundraisers and donations into the Hub.

## 6. Optional check of the live updates
Meta app > Webhooks > Page > feed > Test > Send to server. It should show under Connections > Meta, live > Last update.
