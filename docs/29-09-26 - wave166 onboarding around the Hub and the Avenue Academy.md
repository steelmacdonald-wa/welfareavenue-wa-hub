# 29/09/26 - wave166: onboarding around the Hub and the Avenue Academy

Steel (29/09/26): "please consider embedding Loom videos in the Avenue Academy for trainings and for the onboarding as well (which I believe needs some revision giving the move away from ClickUp, the new Hub). In fact the onboarding could include members doing some of the Avenue Academy modules. Give the onboarding a whole revamp. I also believe that managers or leads that have people onboarding should have something on their home page to show the progress their member is making and where they need to come in to ensure they progress."

## The plan

- Out: the ClickUp beginner course and its five topics, ClickUp x Slack and the Helpful integrations step, Keela basics and its three trainings (Keela is being closed), the Slack trainings and development channel (the Academy holds the trainings now) and a test step. The propagation trigger took them out of the two plans in progress (Alyx, Zachee; nothing was ticked yet).
- In: **The Hub** first (week 1, important), with the Hub's first steps and **Using the Hub** (the nine Hub modules); **Welfare Avenue foundations** and **Our brand** (week 2), **Your work in the Hub** (Hub module 2, then your team's page and tasks; your lead gives the first tasks); **Your team's Learning Avenue** and **Find your team's meeting in the Hub** (week 3: the Transcript archive and one question to Ask the Hub). 41 steps, 15 of them done in the Academy.
- The steps that stay are written for the Hub: Chrome and your Welfare Avenue account, Setting up a Google Meet, the Gmail signature, Checking in and out (the Check in button), Our policies in practice, Understanding Slack parts 1 and 2 (part 2 is its own step now), Organising and Managing your Slack notifications, Loom (our meetings and the Academy's videos), Canva and Google Photos without ClickUp, Pick a Learning Avenue (60 days), Meet one of our co-executive directors, and Continuous improvement says where to ask for help. The week 4 Charitable activities step now builds on the foundations avenue instead of repeating it.
- **Steps done in the Academy tick themselves.** A step names its module (`training_id`) or its Learning Avenue (`academy_path`: `hub`, `foundations`, `branding`, `team` or `any`). When the person finishes it in the Academy, the step is ticked "by Avenue Academy" (`trg_wa166_tp_onb`), and a new plan starts with what they already did (`onboarding_assign`). `team` is the person's team's avenue (any avenue besides the three everyone does when the team has none); `any` is an avenue besides the three and the one that counted for the team, so one avenue never ticks both. Keela, the page tours and Your first week never count there.
- **A plan completes itself** when its last step is ticked, by anyone, and opens again when one is unticked (`trg_wa166_onb_done`; the page used to do this from what it had loaded, which missed steps the Academy ticked since).
- **The week 1 Loom videos are Academy modules** in a new avenue, **Your first week** (certificate First Week Done): Getting started with Chrome and your Google account, Understanding Slack parts 1 and 2, Managing your Slack notifications, Checking in and out, Our policies in practice. All six are public on Loom, so they play for someone who has no Loom account yet.

## In the Academy (the person's plan)

- Each Academy step says so ("Avenue Academy module · 4 min", or the avenue and how far the person is in it), opens the module or the avenue (Open it, Go to the avenue, Browse the avenues when they choose), and shows done at once when it is finished in the Academy (ticked and locked: the Academy holds it). The header counts them. Finishing a module reads the plan again, so the Academy home, the plan and Home follow without a reload.
- **Watch here**: a Loom link in a step, an Academy lesson or reading, the HR centre or a modal gets a Watch here button; the video plays under the paragraph (a Loom embed, loaded only when asked) and Hide the video closes it. The Loom card's meeting recordings are left alone (they are meetings, not trainings).
- **Stuck on a step? Ask for help** under the plan: pick the step, say what is in the way, send. HR and the lead see it in the Hub (the old form's promise of Slack is gone: it never reached Slack).
- The ClickUp "syncing" note is gone from every step.

## On the lead's Home

- **Your people's onboarding** (`#w166lead`, after Get started): each person the signed-in lead is onboarding, with their title, team and why they are there (reports to you; your team, for a team's leaders when the person has no manager in the org chart; no lead set, for admins), the day and week of their onboarding, how far they are, whether they are on pace or how many steps are late, when they last ticked a step and what is next, each week's count, the avenues (the three everyone does and their team's), their open help requests (Dealt with closes one), and See their plan (the whole plan by week, late steps in red, Academy steps marked).
- **Where you come in**: the lead's moments due within the week, with their dates, ticked right there: introduce them at your team's meeting and give them their first tasks in a meeting (first week), check in at two weeks (new), review their quizzes (the card says when they are in), the 30-day evaluation with HR, probation (four months). The later ones are summed up ("Later: 4 more of yours, starting Oct 9").
- Who sees whom: `onboarding_lead_view()` (the org chart's reporting lines first). Checked as each person: Amanda sees Alyx, Shima sees Zachee, Steel and the new people see no card; Shima cannot tick Alyx's moments (`onboarding_lead_tick` refuses), Amanda can.

## HR

- The HR setup list: who does each step and when (`who`, `due_day`: before day one and the onboarding call are HR's; Manager follow-through is the lead's), two new lead moments, Keela out, "Show them the Avenue Academy and their plan" instead of the Slack trainings channel, Assign their onboarding in the HR centre.
- **The onboarding email** (the Welcome kit's template in `app_config` and the branded version): no ClickUp or Keela; the setup video is the real one (the old link, `loom.com/share/welfare-avenue-google-setup`, did not exist); a new step, Open the Hub; and **no password in the email**: it printed a fixed temporary password for every new account ("Welfare Avenue"). The first password is shared one to one, as the HR setup step and the People and HR training already said.
- The Welcome kit: no Keela, the first password shared one to one, the plan is already in the Hub, and the lead's moments (it used to be a three-line manager checklist).

## Training and access

- Hub module 7 (training 45) says how onboarding works now; the Leading a team lesson (197) gets Follow their plan on Home; the Home tour has a stop for the card; the Academy tour says Academy steps tick themselves.
- The access profiles: every team profile's lead note and the Executive and Admin profiles say where a lead follows their new people. No access changes: the card follows the org chart.

## Releases

- The page: `0711df6833b691d900551661f899ac31` to `4024ea230f7d2d254535fc024f8b96df` (4,715,024 bytes), gated deploy, host-sync, byte-for-byte check; stage table dropped.
- Migrations: `wa166_onboarding` (20260929090000), `wa166b_lead_names` (20260929091000), `wa166c_access_notes` (20260929092000).

## For Steel

- The onboarding email template also lives in your Google Doc (the Hub's copy is updated; the Doc still has ClickUp, Keela, the old video link and the fixed password).
- Your own finished plan shows its changed steps under "Updated since you finished" in the Academy (Got it clears each).
- Help requests still do not reach Slack (the trigger was never wired): they show on the lead's Home and in the HR centre. Say if a Slack post should go to the lead or to #onboarding-updates.

## Files

- `build/data/wa166_onboarding.sql` (+ `.rec.sql`), `wa166b_lead_names.sql`, `wa166c_access_notes.sql`.
- `build/parts166/` (a_head, b_loom, c_plan, d_lead, z_wire, assemble.py) into `build/src/166_wave166.seg`; `039` (the help form's promise), `046` (the Welcome kit), `108` (the branded email), `036` (the classic catalogue's words).
- `test/w166drive.js` (45 checks); the suite w130 to w166 passes (w149's hover check flaked once and passed on its own).
