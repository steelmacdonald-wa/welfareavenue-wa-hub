# 09/10/26 - wave227: someone to meet this week

Steel (09/10/26): "once every week someone gets a pop-up window when they open up the hub to introduce them to someone that they may have not interacted with that's at Welfare Avenue that might be worth you know introducing themselves to because of potential work or projects that they can work on together and just you know introduce do an introduction."

His choices: the team plus the board; the Hub picks the person and writes why (about a cent a person a week); Say hi on Slack, Book a 15-minute coffee chat and Tell the other person too, all as options on the pop-up.

## How it works

- **Every Monday** (cron wa-intros, 10:10 UTC) the edge function intros asks `wa227_intro_plan` for the week: everyone on the roster with an address (directors included, through their board address) gets one person from **another team** they have **not worked with**: no shared tasks, no meeting they both spoke in over the last 180 days, no reporting line, the executive team and the board count as working together, and no introduction to each other in the last 12 weeks. Among those, the best match has shared organizational goals, projects under the same goal and overlapping words in their roles and responsibilities; someone already picked that week is a little less likely.
- **The Hub writes** a two-sentence note (who they are, one concrete thing to explore together) and a first hello for Slack, for both sides, in each reader's language (task intro_note through the llm router). It only uses open profile facts (`wa227_profile`: role, team, city, responsibilities, the profile line, projects led, goals owned); never meetings, tasks, HR, pay or the board's business, and it never mentions how they were matched.
- **The pop-up** (#w227) opens once, the first time the person opens the Hub after it is written, after the loading screen and any other pop-up (the due-date check goes first, and the introduction steps aside if it opens later):
  - Say hi on Slack: copies the hello and opens their Slack profile (Message is one click there).
  - Book a 15-minute coffee chat: a Google Calendar invite with them, the next weekday at 10:00, the hello in the description.
  - Tell <name> too: they get the same introduction from their side (the note written for them) in their next pop-up, headed "<you> would like to meet you".
  - See <name>'s profile, and Maybe later (or Esc, or the x): not again this week.
- **Nothing is sent by the Hub**: no Slack message, email or notification. Off switch: app_config intros_on = false.

## Data

`hub_intros` (one row per person a week, plus shared rows), `wa227_my_member`, `wa227_people`, `wa227_together`, `wa227_profile`, `wa227_intro_plan` (service role), `wa227_my_intro` and `wa227_intro_act` (signed-in people, only their own), app_config intros_on, ai_routes intro_note. Admins can read every row; others read only their own through the functions. Migrations wa227_intros, wa227b_intros_tuning, wa227c_intros_cron.

## The first week

Written at release for the week of 5 October: 33 introductions (everyone on the roster with an address). Three were rewritten after the first draft wrote in French for English readers and mentioned payroll; the prompt now follows each reader's language setting and stays off HR and money. Daniela was picked three times and Mohamed twice this week (the penalty for repeats is gentle); the 12-week rule spreads it out from next week.

## Tests

- `test/w227drive.js` 21 checks: the pop-up and its words (escaped), initials when there is no photo, seen recorded, Tell Ian too, Say hi on Slack (profile link, hello copied), the coffee invite (Google Calendar, Ian invited, 15 minutes on a weekday), Esc as Maybe later, a shared introduction, See the profile, nothing when there is none, waiting for the due-date check, the phone bottom sheet, no page errors.
- In the database: each person sees only their own (a member reads no rows of the table; Ian cannot act on Valex's), a director signing in with the board address is found, an outsider gets nothing, anon cannot run the functions, the plan is service-role only.
- Regression on the build: w213 21, w219 82, w220 21, w221 9, w222 13, w225 48, w226 28. The sources rebuilt the live build exactly (a1593f2e) before the change.

## Release

Live md5 0162510282b04b70834a226f573e562c (on a1593f2e: waves 222, 225, 226 from parallel sessions). Edge function intros v1 (platform version 3).
