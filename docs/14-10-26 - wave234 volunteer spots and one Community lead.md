# 14/10/26 - wave234: volunteer spots on each serving card, and one Community lead

Steel, 14/10/26: "I'd like to have a bar that shows how we are filling up the total amount of roles for volunteers for the
event" (on the Volunteer Manager's serving cards), and "Community Lead position and Community Talker is the same position -
please combine the 2 and keep the name Community Lead". His choices: one Community lead spot a serving.

## The bar (build/src/234_wave234.seg)
- Each upcoming serving card on the Volunteer Manager's calendar shows, above the SOP bar: a bar in two parts (teal:
  confirmed, gold: signed up and not confirmed yet) over every spot the serving needs, "N of M volunteer spots filled
  · W to confirm" ("All M volunteer spots filled" when full), and a tooltip with what is still open ("Still open: 1 team
  leader, 4 cooks, 1 driver").
- The spots are the serving page's: `volunteer_role_guides.target` per role (today 18: team leader 1, cooks 4, drivers 2,
  servers 8, dishwasher 1, photographer 1, Community lead 1), the serving's own spot counts first (`volunteer_events.spot_counts`,
  wave232), and a partner's share as wave191o counts it (what they cover is filled by them; their own food means no cooks;
  food brought ready means one driver). A role counts at most its spots (ten servers never fill the drivers' spots).
  Cancelled, unavailable and declined rows do not count.
- One query per table for all the upcoming servings (event_roster, volunteer_role_guides, volunteer_events, volunteer_event_partners),
  cached 20 s; painted in place after the calendar renders (wrapper on waVolRenderCalendar) and when cards are redrawn
  (an observer that ignores its own `.w234` nodes). `window.w234` exposes state, fillOf(id) and paint().

## One Community lead
- Database (migration wa234_community_lead, build/data/wa234_community_lead.sql): 8 volunteer records' roles folded
  (community_talker to community_debrief, deduped; no roster rows or applications had it); trigger `wa234_fold_role` on
  event_roster, volunteer_profiles and volunteer_applications writes the old key as the new one from now on;
  `vol_role_targets` and `vol_signup_roles` lost community_talker; wa191_onb_signup, wa191_partner_save and
  wa209_volunteer_roles no longer offer or produce it; volunteer_role_guides keeps the old row for history (comment says so).
- The pickers and labels in 020, 119, 119b, 152 (parts152), 171 (parts171), 191 (parts191: ROLE_ORDER, the partner's
  covers, the onboarding choices), 209 (parts209, kept the same as wa209_volunteer_roles) and 218 (parts218).
- The public volunteer forms (volunteer, benevole) dropped the Community debrief choice at first (Steel then asked for
  Community lead to be offered with its description: wave235).
- welfareavenue.com: the events page's "Who do we need?" lost the Community welcome card (EN and FR), edited in www_files
  (events/index.html, fr/evenements/index.html) as wave233 did; port into build/www/content.py SERVING_TEAM before the
  next make.py run.

## www-sync v3
The website deploy answered "website files missing": one select of all of www_files (about 25 MB since wave233's video)
hit the statement timeout. v3 reads eight rows at a time (fn/www-sync/index.ts). Deployed through the MCP (platform
version 3); deploy 6acfad78 ready, 2 files uploaded, checked live.

## Release
- Live md5 1c29f92bcc74a2859758a07a9320448a (on 1e6db54a, wave232), gate wa234_deploy_gate, stage table wa_stage_234
  (closed to the API, swept by wa_tmp_sweep). build/candidate.html was not pushed (7 MB): rebuild from the sources with
  build.sh, which reproduces the live build exactly.
- Tests: test/w234drive.js (27 checks: the numbers, the widths, the tooltip, the place above the SOP bar, own spot counts
  with a partner, a full serving, an empty one, no bar on past servings, one bar per card after a repaint and after
  returning from a serving, no "Community welcome" anywhere, no page errors; staff at 1366 and 390 px, a board viewer).
  w191drive 39/39 on both builds; w119drive's only differences are the old column gone (22 places become 20).
