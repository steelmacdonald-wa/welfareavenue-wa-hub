# 26/09/26 - wave141: the Slack training lists in the Avenue Academy

Live md5 `dfb637c25d8e4c98dbcfac6cbfb99dc8` (3,887,377 bytes), deployed through the gated pipeline (`wa_stage_rk`, guarded on the live md5 `b4dea6b3` and dropped after). Data: migration `wa141_academy` (the avenues, trainings, lesson and completions). Page: 122 (planned trainings) and 036 (the older training surfaces skip them).

## What Steel asked

"I'd also like you to look through my Slack lists, there's one per department on training. It could be smart to transfer things from there to Avenue Academy"

## What was in Slack

Five Slack Lists (General Trainings, Outreach Trainings and its early copy, Operations Department Trainings, Marketing Department Trainings): 171 rows with the training's name, area of work, description (usually a Loom or YouTube link and a small task), documents, time, status (Ready to Train, To Create, Needs Update, Good Enough) and who had done it. Five canvases were read too: the training channel's index, two on running meetings (turned into a lesson), one person's onboarding channel and the Marketing channel canvas (not training).

## What the Academy has now

- **Eight new Learning Avenues**: Tools and accounts (everyone), Leading a team (everyone), Marketing basics and Campaigns and storytelling (Marketing), People and HR (HR), Fundraising and grants, Student clubs and tabling, and the Thriving Nonprofits course (Fundraising & Finances). Keela donor CRM and Operations Basics have wider blurbs.
- **67 new trainings** (videos, documents and readings), each in its avenue, with the Slack task turned into a Try it or Done when box, the link as the training's own link and any other links listed under "More to watch or read".
- **12 rows were already in the Academy** (the Loom library import): they link to the existing training instead (Keela contacts and receipting gained the extra material from the lists). The LinkedIn job post and the phone menu moved to People and HR and Tools.
- **34 duplicates merged**: the same training appeared in two or three lists (Keela introduction in three, the sponsor contract and sponsorship guidance in three, the Outreach list's early copy almost entirely).
- **Leading a team**: a new lesson, "Running a team: meetings, follow-up and new people", in four chapters (before the meeting, in the meeting, between meetings, new people) with a four-question check, written from the "Running WA Meetings" and "Team Meetings & Leadership Guidance" canvases and pointed at the Hub (tasks, transcripts, @mentions), next to the operations meetings video.
- **36 planned trainings**: rows marked To Create, and rows whose only content was a link that did not survive Slack's export (Slack keeps links behind text out of the CSV). Learners never see them; inside each avenue, leaders see a Planned trainings block with Add the content, which opens the usual edit form; saving it with a link or new text publishes it (body.planned false, who filled it and when).
- **Completions carried over**: everyone still on the roster whom the lists name under Members Trained is marked done on that training (99 completions for 13 people). No date: the lists never recorded one.
- **Left out (22)**: trainings for Slack task lists, task requests and Slack Lists (the Hub replaced them), the org structure (the Hub's org chart replaced it, and its link pointed to the HR plan), rows already covered by the Academy's SOPs (gift baskets, corporate volunteering days, student association fundraisers) and empty rows.

## Security notes for Steel (not moved into the Hub)

- The Marketing channel canvas holds shared passwords for seven accounts (Linktree, the website admin, OpenPhone, Instagram, TikTok, Facebook, Thriving Nonprofits). They should be changed and kept out of Slack.
- The Outreach "Running a tabling event" row links a public imgur image with the storage unit's location and access codes. The training in the Hub leaves it out; the image should be deleted and the codes changed.
- "Setting up an onboardee" said to make an easy password to share; the Hub's version says to set a temporary password that must be changed at first sign-in.

## How it works underneath

- `build/data/wa141_academy.py` reads the lists (as saved from Slack) and writes `build/data/wa141_academy.sql`: one decision per row (new, merge, existing, planned, left out), Slack formatting cleaned (links, bold, people and channel mentions, bullets), idempotent by `trainings.key` (`slack:<list>:<row>`), and the lesson body. The completions were applied with the migration and are kept out of the committed file (they carry personal email addresses).
- Page: `visibleT()` hides a training whose body says planned; `plannedHtml()` draws the leaders' block in the avenue sheet; `data-w141fill` opens the form; `saveForm()` publishes a planned training when a link or new text is saved. `wa36Load()` filters planned trainings out of the older surfaces (the HR training board, search).

## Release checklist

- **Access:** no change. Trainings were already readable by staff; planned ones are hidden by the page, and only leaders (admin or leader role) see the block and can edit.
- **Training:** Hub module 7 (training and onboarding) now tells leaders about planned trainings.
- **Security review:** no new functions or policies; nothing from the password canvas or the imgur link was imported.

## Verification

- `test/w141drive.js` 11 of 11: a leader sees only the published training in the avenue and both planned ones in the block; Add the content opens the form; saving a link publishes it (planned false, filled_by) and it moves into the avenue; the older surfaces never list a planned training; a member sees no block and the library never shows a planned training; no page errors.
- `test/w122drive.js` smoke 36 of 36. The harness for three identities differs from the live build only on the HR centre, which varies from run to run on its own.
- Data: 16 avenues, 103 trainings from the lists (67 published, 36 planned), the lesson (id 197), 99 completions.
- Live: the md5 matches the build.
