# 14/10/26 - wave235: who becomes Community lead, and their briefing

Steel, 14/10/26: "We should pick volunteer servers that have been to 2 or more of our events and they need to be briefed on
what to do." Asked, he said: from servers with 2 or more servings "if we don't have someone. But we should also look within
our pool of community leads as well. I think people could sign up for it but should be aware of the role consists of before
applying"; the briefing on their page and in the text. Shipped in the same release as wave234 (one Community lead).

## Picking (Plan the roster, build/src/119b_wave119b.seg)
- The Community lead row suggests only: people who led the community before (served as community_debrief, at least one
  confirmed serving), first; then people with 2 or more confirmed servings who served as a server, or have server or
  Community lead on file. Nobody else. "led the community before" or "N servings" leads each line; the row says the rule.
- The Community lead is pre-ticked before the other roles, so a past lead is not used up as a server. Jev's re-sort keeps
  the tiers. ("Servings" here are confirmed roster rows from volunteer_history().)

## Signing up, knowing the role
- The volunteer forms (volunteer, benevole) offer "Community lead: welcome and talk with the people we serve, then run
  the short debrief" (FR "Responsable communautaire : ...") with the question's help: a role with more responsibility, for
  volunteers who have served with us at least twice, confirmed with them before the serving.
- Website accounts: vol_signup_roles has community_debrief again (1 spot, vol_role_targets); the "Sign up as ...?" box
  says what the role is first (welfareavenue.com assets/account.js, leadNote, EN and FR; build/www/live/assets/account.js).

## The briefing
- The guide (volunteer_role_guides community_debrief) is the briefing, Community welcome's duties folded in: link with the
  community, welcome and talk in the line, point people to the table and clothes, the debrief with the team leader, the
  Beneficiary form the same day.
- The volunteer's page (build/c, hub.welfareavenue.com/c/<token>): for a Community lead the guide is headed "Your
  Community lead briefing" and shows before they confirm too (with the forms and guides); "I have read my briefing and I am
  ready to lead with the community" is saved by volunteer_confirm_details (confirm.briefed_at, read back by
  volunteer_confirm_get), then "Briefing read <date>".
- The Hub's roster card: "Briefing read <date>" or "Briefing not read yet" (parts171 detailTags).
- Texts (sms_mode is live): the 7-day confirmation says "Please read your Community lead briefing and confirm here: <link>"
  (FR "Lisez vos consignes de responsable et confirmez ici"); the sign-up notice adds "As Community lead, please read your
  briefing on that page before the serving." (wa171_confirm_text, wa172_queue_signups). Same queue, window and STOP rules.

## Release
- Data: build/data/wa235_community_lead_briefing.sql (migration wa235_community_lead_briefing).
- Live: index.html 84784a569209b87c9519d50fa98e0400 (on wave234's 1c29f92b), c/index.html 766d05e07ca65e73df80a8b9196e7c53,
  welfareavenue.com assets/account.js 94dc63411b5540c8ddf29c2eb7aac64b (www-sync v3). Gate wa235_deploy_gate, stage wa_stage_235.
- build/www/content.py: the Community welcome card left SERVING_TEAM (it had left the live pages in wave234).
- Tests: test/w235drive.js (Plan the roster's Community lead row: the note, the order, the reasons, pre-ticked first, other
  roles untouched; the roster card's briefing tags; no errors) and test/w235page.js (the page: briefing heading and steps
  before confirming, the forms link, the box saved as briefed, read state, French, a server unchanged). w234drive, w191drive
  39/39 and w119drive unchanged on this build.
