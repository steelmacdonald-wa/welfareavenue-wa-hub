# 03/10/26 - wave198: the Hub in French

Live md5 4b608fb4e3b79067cf4e06a612b56d37 (on wave196's 62789827, which carries wave197).

## What Steel asked (02/10/26)

> "He's also french so I'd love to make the effort in putting the entire hub in french as an option. This is for future recruits too."

His choices: the interface, the onboarding and the Avenue Academy in French; what people type stays as written; Quebec French, vous; each person picks their language.

## How it works

- **The choice.** The account menu (top right) has Français / English. It is saved in `hub_user_prefs` (one row per person, their own only), so it follows them to any device, and in the browser (`localStorage wa198lang`) so the page starts in it. Changing it reloads the page; another device picks it up at the next load.
- **The interface.** `hub_i18n` is a dictionary of the Hub's own words (English as the page shows it, numbers as `{0}`, `{1}`…). A French reader's page loads it once through `wa198_dict` (about 800 KB, kept in the browser until its version changes) and translates every piece of text as it is drawn (a MutationObserver on the body): whole; with its numbers set aside; piece by piece around separators (·, —, |); without symbols around it (+, ?, ✨); a phrase with a note in brackets; a known phrase beside a number, a date or people on the roster (Handled by Ahmed); dates and times the French way (ven. 2 oct., 20 h 47). Names on the roster are never translated. Anything else (tasks, notes, meeting summaries, names) has no entry and stays as written. Placeholders, attributes (placeholder, title, aria-label, alt) and the tab title are covered.
- **Loops.** Some pages check their own words and put the English back (Finance's title follows its section). The second time an element is set back to the English it had, it keeps the English. `w198.same(text, en)` lets a page accept the French as the same words: wave164 (Finance's title) and wave197 (the HR centre's title) use it.
- **What is missing.** Text with no entry is reported (`wa198_seen`, at most 80 a call, 400 a page load) into `hub_i18n_queue`. Every night at 03:35 Toronto (cron `wa-i18n-translate`, 07:35 UTC) the edge function `i18n-translate` takes the queued text whose word-pieces all appear in the live build (`wa198_queue_take`: what people type is never sent to a model), translates it with the glossary (llm route `i18n_fr`, Sonnet first) and saves it as `auto`; anything else is marked skip.
- **Content.** `hub_i18n_content` holds the French of the onboarding and the Avenue Academy: trainings (title, description, body), onboarding_template (name, description), academy_paths (name, title, blurb, cert_title), hr_setup_template (name, description) and app_config onboarding_journey, each with the md5 of the English it was made from. `wa198_content` serves only the fields whose English has not changed; the page swaps them in as it reads those tables (the supabase client's `from()` is wrapped for these five tables when the reader is in French). The same nightly run translates new or changed fields (`wa198_content_stale`).
- **Editing safely.** A save never writes the French over the English: on update, insert and upsert to those tables, a value still equal to the French that was shown goes back to the English. On the Onboarding plan and the Training catalog a gold note tells a French reader that the original is in English and that what they type replaces it.
- **Corrections.** An admin can set one translation with `select wa198_fix('<English>', '<French>')` (kind manual, never overwritten, logged in change_log). There is no editing screen yet.

## Seed

- 11,679 interface entries: string literals from the build (parsed with acorn, split at tags and separators, code and keys filtered out), translated in this session against /root/i18n/GLOSSARY.md (copied in build/data/wa198_ui_fr.json), plus 167 found by crawling the French build as admin, an HR member and a director (87 pages).
- 756 content fields from 303 rows (219 trainings, 45 onboarding steps, 17 avenues, 21 HR setup steps, the journey). Line-start markers the renderers look for (Goal:, Try it:, Done when:, To complete this step:) were kept in English and are translated on screen.
- Not translated: Loom videos, emails and Slack posts the Hub sends, documents in Drive, the public website (it has its own French), the forms.

## Tests

- test/w198drive.js 20 checks: French on with the dictionary, the menu, the HR centre's title and rail, names untouched, dates, a phrase beside a name, numbers, typed text untouched, content swapped in, a save keeps the English, the CRM, the account menu in both languages, English readers unchanged, a phone.
- Regression on the shipped build: w152 68, w153 46, w157 26, w164 31, w176 14, w181 61, w193 44, w196 52, w197 98, w198 20.
- i18n-translate checked live: a queued UI string was translated (auto); a typed sentence was skipped.

## Database (migrations wa198_french, wa198_french_seed, seed2, seed3, wa198b_translate_helpers)

hub_i18n, hub_i18n_content, hub_i18n_queue, hub_user_prefs; wa198_dict, wa198_dict_v, wa198_content, wa198_seen, wa198_fix, wa198_queue_take, wa198_content_stale; ai_routes i18n_fr; cron wa-i18n-translate (jobid 89). Edge function i18n-translate v1 (verify_jwt on; x-wa-secret or an admin).
