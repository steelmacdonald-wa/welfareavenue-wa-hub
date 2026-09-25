# 25/09/26 - wave122 the Training academy (plus wave121, wave120b and the social connections)

Live md5 `a7e4ca2101b3e4dbfcb94b9369e0408d` (2,933,005 bytes), deployed through the gated pipeline (`wa_stage_qq`, guard on live `872daeb9`, which was the other session's wave118c photo library, merged first).

## wave122: the Training academy (#training)

Steel asked for trainings with embedded Loom videos, designed HTML lessons for non-video content (the eight charitable activities; our partners and how we work with them), an Apple feel with a real academy sense of progress, accomplishments that feel important, the Hub onboarding stored on the page in its own section at the top, trainings that open wide enough to complete, and a training for every page of the Hub that walks through each section.

What the page is now, top to bottom:

- **Onboarding** (its own section, first): the person's onboarding plan from `onboardings` / `onboarding_steps` (the week-by-week checklist opens in the wide sheet and ticks through the existing wave37 handler), the Hub first steps from wave112 (`window.w112Api`, added to wave112 so ticks work here even after the My page card is dismissed), and the policies to sign (`wa_policies`, `wa_policy_signoffs`). "Updated since you finished" acks write `onboarding_update_acks`. When everything is done the section folds to a one-line "You are fully onboarded" with the certificate.
- **Hero**: level, XP bar, completed count, certificates, badges, day streak, and three rings (onboarding, required learning, progress to the next level).
- **Up next**: in progress, assigned to you, the next item of each required path, your team's paths, the first page tours.
- **Learning paths** (`academy_paths`, joined on `trainings.path_group`): Welfare Avenue foundations (required), Using the Hub (required), Hub page tours, and team paths (Marketing strategy, Our brand, Operations basics, Keela donor CRM, Charity governance). Each ends in a certificate.
- **Page tours**: 29 tours (every page a staff member can open, including the photo library). A spotlight coach-mark engine opens the page and steps through its sections; steps live in `TOURS` in the segment (they point at the DOM, so they version with the code) and the catalogue rows are `trainings` with `kind = 'tour'` and `key = 'tour:<page>'`.
- **Library** with type filters (videos, lessons, reading, documents, tours), topics and search.
- **Trophy case**: certificates (printable, A4 landscape) and 11 badges. **Recently earned** shows what people across Welfare Avenue achieved.
- **The reader**: every training opens in a wide sheet. Loom (and YouTube, Vimeo, Drive) embeds; lessons with a chapter rail and a knowledge check (80% to pass; a perfect score is a badge); readings that turn "Try it:" and "Done when:" into callouts and link their page tours; documents with Open and an inline preview for Google Docs, Slides, Drive files and Supabase PDFs. Passwords written into descriptions are masked.
- **Accomplishments**: XP and levels are computed from progress; badges, certificates and levels are stored in `academy_awards` and celebrated once (confetti, XP, level-up, the new awards). Certificates can be shared as a shout-out (`hub_shoutouts`, kind manual, source academy). Person pages get an Academy card (level, certificates, badges, last completed) in place of the old training card.
- **Leaders** (admin, leader): Assign any training to people, Add a training (Loom links become embedded videos), Edit and Retire, and links to the HR centre onboarding and training boards. **Classic view** brings back the previous page.
- Nav label is now "Training academy" (waves 106, 110, 118 and the wave43 help text updated).

Content sources: the two lessons are written from "Our 8 Charitable Activities" (the training copy of the CRA submission), the Partner Relations 2025-2030 sheet, the Partnership Outreach Document, the Partnership Email Templates, the community kitchen partnership plan and the 2026-27 fundraising calendar, in the 2026 brand voice (wa_brand voice terms). Stats come from the brand guide (3,000+ gifts, $40,000+ raised) and the DESTA grant application (25,000+ meals, 600+ volunteers); the "Welfare Avenue - Facts" doc was not found in Drive. Content lives in `build/data/w122_content.py`, which generates `build/data/wa122_academy.sql` and `test/fx_w122.json`.

Data (migrations `wa122_academy_schema` and the seed): `trainings` + kind, key (unique), body, minutes, xp, updated_at; `training_progress` + email, started_at, pct, last_step, score, seconds, data; `academy_paths` (staff read, leaders write); `academy_awards` (staff read; insert own or leader; update own or admin; delete admin). Categories "Welfare Avenue" and "Hub tours". Keela and governance trainings grouped into paths; module 7 rewritten for the academy.

CSP: `_headers` gained `frame-src 'self' https://www.loom.com https://www.youtube-nocookie.com https://player.vimeo.com https://docs.google.com https://drive.google.com https://zwnmulmnvopclzcvytce.supabase.co`. Loom thumbnails are signed (403 without the oEmbed signature), so cards use gradient covers.

Build: sources in `build/parts122/*.js`, `python3 build/parts122/assemble.py` writes `src/122_wave122.seg` (non-ASCII escaped); manifest after `121_wave121`.

Tests: `test/w122drive.js` (35 checks as Steel, 31 as Amanda: onboarding, lessons, quiz, celebrations, certificate and shout-out, video, reading, document preview, password masking, Hub step, policy sign-off, onboarding plan, assign, add, library filters and search, path sheet, person card, classic view); `test/tour1.js all` runs every tour (all complete; every step highlights except the two intentional centred steps and optional parts missing from the fixture); harness 36 pages x3 roles with only ERR_FAILED; churn probe zero on the academy, a lesson, My page, a person page and a team page; phone width checked.

## wave121 and wave120b (shipped earlier today)

- **Content calendar** (`#contentcal`, Marketing): month, week and list views, drag and drop with undo, an ideas tray, a composer with JPEG conversion and crops, AI captions in the WA voice, and plan / schedule / publish by what the Meta token allows; confirmations when posts appear on Meta; optional Slack announce. `content_posts`, `social-publish` v2 (cron every 5 minutes).
- **Analytics insights** (`#socialstats`): evidence against the rest of the posts, directional recommendations, and "Plan it" into the calendar.

## Social connections (today)

- **Meta**: Steel put the token in the vault as `META_SYSTEM_TOKEN`. Connected the Welfare Avenue Page and @welfareavenue; publishing permissions present (pages_manage_posts, instagram_content_publish). First sync: 30 days, 55 posts.
- **social-pull v1.3**: Instagram day series now walk back in 29-day windows (Meta caps a series at 30 days per request). **v1.4**: `ga4_list` action (properties the service account can read, and whether the Data API is on).
- **Google Analytics**: Steel added the service account and enabled the Analytics Data and Admin APIs in project 939437859037. Connected property 426291717 (welfareavenue.com), 90 days pulled.

## Open

- Training #22 ("Thriving Non-Profits course") has a username and password in its description. The academy masks it, but it should move to Important info or a password manager and the description be cleaned.
- Queue: Requests redo with a team inbox and Jev triage; fundraising events calendar, master calendar and birthdays; event SOPs; analytics depth and full history; a browser pass over the live Hub for bugs and design problems.
