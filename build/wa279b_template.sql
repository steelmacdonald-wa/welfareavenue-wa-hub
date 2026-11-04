-- Welfare Avenue Hub: wave279 (279b), 04/11/26. The onboarding plan revamp, the content.
-- The reviewed plan (design "Onboarding plan revamp, design (wave279)"): which steps setup already covers, which are switched off, which move, the reworded
-- steps, the new role and content steps, the Avenue Academy trainings for everyone, and the role-recommend setting. Needs build/wa279a_rules.sql first (the
-- setup_covered column, and the role60, role90 and policies path keys). The wave169 trigger (onboarding_template_propagate) pushes every change into the
-- active plans: new steps are added with their due dates, switched-off steps are removed, a moved step gets its new section's due date (open steps only).
-- Result for a fresh plan that went through setup: WEEK 1 14, WEEK 2 12, WEEK 3 10, WEEK 4 8, 60 DAYS 8, 90 DAYS 5. A plan with no setup flow also keeps
-- the four setup-covered steps in WEEK 1.
-- Safe to run twice (updates by id, inserts with on conflict do update). Undo: build/wa279b_undo.sql (exact previous text, captured from live 04/11/26).
-- Two changes beyond the design's table, both needed so no active step sends the hire to HR for something the Hub now does: Google Groups (groups are added at
-- Accept, so it no longer says "ask HR to add you"), and Performance and discipline tracking (policies are signed on Home, so it no longer says DocuSign).

-- 1. steps the setup page covers (left off the plans of people who went through setup)
update public.onboarding_template set setup_covered = true where id in ('86e1cj9gj', '86e1cj9gp', '86e1cj9gy', '86e1cj9h3');

-- 2. steps switched off (kept, so HR can switch them back on)
update public.onboarding_template set active = false where id in ('86e1cj9gx', 'wa166team', '86e1cj9j0');

-- 3. moves
update public.onboarding_template set section = 'WEEK 3', parent_id = null, sort = 5 where id = 'wa166usehub';
update public.onboarding_template set section = 'WEEK 2', parent_id = null, sort = 40 where id = '86e1cj9gr';
update public.onboarding_template set section = 'WEEK 2', parent_id = null, sort = 9 where id = '86e1cj9h8';
update public.onboarding_template set section = 'WEEK 2', sort = 2 where id = '86e1cj9h6';

-- 4. rewords
update public.onboarding_template set description = $d$Google Meet is how we meet. Watch the Avenue Academy module on setting up a Google Meet. To find a time that suits everyone, keep [this short video on When2Meet](https://www.loom.com/share/500d4af7547742a89458dfaf3e3194be) handy.

*This step ticks itself when you mark the module watched.*$d$ where id = '86e1cj9gr';

update public.onboarding_template set description = $d$Google Groups are shared email addresses for a group of people. You are added to your groups when your account is made. [Watch the short training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07NETWRVE1?record_id=Rec07QRFM2Q4V) to see how they work.

**To complete this step:** send a test email to one of your groups with "Onboarding test" as the subject. If you are missing a group, tell HR.$d$ where id = '86e1cj9gy';

update public.onboarding_template set description = $d$Our policies are what we commit to as a team. Read each one in full, in the [full version](https://docs.google.com/document/d/1_M0fdr3P71Y95ptj-6toA6phRYHaKCsG/edit) or the [summarized version](https://docs.google.com/document/d/1Sg62q5H4KktrYTp0tGneto4ruouwgLbU5lej4gkMo5E/edit). Questions are welcome: ask in your onboarding channel, or comment on the doc and tag someone.

The policies also live in the shared [Org Files > HR folder](https://drive.google.com/drive/folders/1Q0YRW5TroUNSI411lYaNbWIEvz7BvKvb), with the [90 day evaluation](https://docs.google.com/document/d/1TXKgL8V-JGvRneKa6BGuRUrjeGJ_pYfs/edit).

**To complete this step:** on Home, open each policy and read it for 10 minutes, then sign it. Sign unlocks once the 10 minutes are up.

*This step ticks itself once you have signed both policies on Home.*$d$, academy_path = 'policies' where id = '86e1cj9gh';

update public.onboarding_template set description = $d$Read [performance and discipline tracking](https://docs.google.com/document/d/1PHhf41ChaLOZu4ybsWyEpXrsKIQLDDlCN-_kfq7sH5c/edit), then watch Our policies in practice, from HR, in the Avenue Academy.

**To complete this step:** if you have not signed the policies yet (the step above), sign them on Home.

*This step ticks itself when you mark the video watched.*$d$ where id = '86e1cj9gq';

update public.onboarding_template set description = $d$Watch how our Slack is laid out, in the Avenue Academy. Want Slack on your computer too? Get it for [Windows](https://slack.com/downloads/windows) or [Mac](https://slack.com/downloads/mac).

**To complete this step:** find your team's channel.

*This step ticks itself when you mark the video watched.*$d$ where id = '86e1cj9h2';

update public.onboarding_template set description = $d$Our meetings are recorded on Loom, and the trainings you watch in the Avenue Academy are Loom videos too. HR sends you an invitation to Loom: accept it.

**To complete this step:** accept HR's Loom invite and check that your name shows in Loom. If the invite has not come, ask in your onboarding channel.$d$ where id = '86e1cj9hh';

update public.onboarding_template set name = 'Turn on Hub notifications', description = $d$Hear when someone mentions you or gives you work, even when the Hub is closed. It takes under a minute.

**To complete this step:** on Home, open Set up your Hub and turn on notifications. If you have not added the Hub as an app yet, do that first. Show me how has a short film for iPhone and Android.$d$ where id = 'wa272appsetup';

update public.onboarding_template set name = 'Your Canva folders', description = $d$We design in Canva. Your Canva invitation comes in your welcome email.

**To complete this step:** ask Marketing for the folders and files you need (the folders especially).$d$ where id = '86e1cj9gm';

update public.onboarding_template set training_id = 8, description = $d$Watch the Avenue Academy module on gifting and receipting, and read the CRA pages it links.

**To complete this step:** share two things you learned about charitable receipts in your onboarding channel: one from the video and one from the CRA website.

*This step ticks itself when you mark the module watched.*$d$ where id = '86e1cj9j4';

update public.onboarding_template set description = $d$Book 15 minutes with one of our co-executive directors.

**To complete this step:** send them a Google Calendar invite (see Setting up a meeting, week 2) and post in your onboarding channel once it is booked.$d$ where id = '86e1cj9j6';

-- 5. new steps: the role trainings, the content steps, and the trainings for everyone
insert into public.onboarding_template (id, section, parent_id, name, description, sort, priority, active, academy_path, training_id) values
('wa279role60', '60 DAYS', null, 'Your role trainings', $d$Your manager picks 2 or 3 trainings for your role in week 3. If nobody has picked by day 29, the Hub picks for you. Each picked training shows on this step and in your Avenue Academy as assigned to you.

**To complete this step:** finish every training on the list.

*This step ticks itself when all of them are done.*$d$, 50, null, true, 'role60', null),
('wa279role90', '90 DAYS', null, 'Your role trainings', $d$Your manager picks 5 or 6 trainings for your role in week 3, for your last month. If nobody has picked by day 59, the Hub picks for you. Each picked training shows on this step and in your Avenue Academy as assigned to you.

**To complete this step:** finish every training on the list.

*This step ticks itself when all of them are done.*$d$, 10, null, true, 'role90', null),
('wa279serving', '60 DAYS', null, 'Your first serving', $d$In week 3 you confirmed a serving. By day 60 you should have been to one. Volunteering four times a year is part of every role.

**To complete this step:** serve at a Welfare Avenue serving, then tick this step. Not sure when the next one is? Open the Volunteer calendar in the Hub, or ask the operations lead.

[Open the link](https://welfareavenue.com/volunteer/)$d$, 35, null, true, null, null),
('wa279review', '90 DAYS', null, 'Your 90-day review', $d$Fill in your part of the 90 day evaluation and send it to your lead. The form is in the [Org Files > HR folder](https://drive.google.com/drive/folders/1Q0YRW5TroUNSI411lYaNbWIEvz7BvKvb), next to the [90 day evaluation](https://docs.google.com/document/d/1TXKgL8V-JGvRneKa6BGuRUrjeGJ_pYfs/edit).

**To complete this step:** send your lead your part of the evaluation.$d$, 30, null, true, null, null),
('wa279share', '90 DAYS', null, 'Share one thing you know', $d$Record a short Loom on one process you now own. HR adds it to the Avenue Academy: this is how the Academy grows.

**To complete this step:** post your Loom link in your onboarding channel.$d$, 40, null, true, null, null),
('wa279feedback', '90 DAYS', null, 'Tell us how onboarding went', $d$Send HR three lines: what helped, what we should cut, and what was missing. It closes the loop on Continuous improvement and makes onboarding better for the next person.

**To complete this step:** send HR your three lines in your onboarding channel.$d$, 50, null, true, null, null),
('wa279t119', 'WEEK 2', null, 'A walk through our Google Drive', $d$Open this in the Avenue Academy. It shows where things live across the shared drives you were added to at setup.

*This step ticks itself when you finish the module.*$d$, 15, null, true, null, 119),
('wa279t205', 'WEEK 2', null, 'Page tour: the apps', $d$Take the tour in the Avenue Academy. It is the map of every app in the Hub.

*This step ticks itself when you finish the tour.*$d$, 6, null, true, null, 205),
('wa279t68', 'WEEK 2', null, 'Page tour: Org chart', $d$Take the tour in the Avenue Academy. It shows who is where, and Organizing your Slack uses it.

*This step ticks itself when you finish the tour.*$d$, 7, null, true, null, 68),
('wa279t122', 'WEEK 3', null, 'Group emails: sending as a team address', $d$Watch this in the Avenue Academy. You are in a team group, and this shows how to send email as its address.

*This step ticks itself when you mark the video watched.*$d$, 20, null, true, null, 122),
('wa279t103', 'WEEK 3', null, 'Searching Slack like a pro', $d$Watch this in the Avenue Academy. Finding what was already said saves everyone time.

*This step ticks itself when you mark the video watched.*$d$, 22, null, true, null, 103),
('wa279t82', 'WEEK 3', null, 'Page tour: Calendar', $d$Take the tour in the Avenue Academy. Every team's meetings and events are in one calendar.

*This step ticks itself when you finish the tour.*$d$, 30, null, true, null, 82),
('wa279t201', 'WEEK 3', null, 'Page tour: Document finder', $d$Take the tour in the Avenue Academy. It helps you find any of our documents by what it is about.

*This step ticks itself when you finish the tour.*$d$, 32, null, true, null, 201),
('wa279t71', 'WEEK 3', null, 'Page tour: Volunteering', $d$Take the tour in the Avenue Academy. Every member volunteers four times a year, and this is where the servings are.

*This step ticks itself when you finish the tour.*$d$, 14, null, true, null, 71),
('wa279t126', 'WEEK 4', null, 'Member reimbursements', $d$Open this in the Avenue Academy. Anyone can spend for an event, and this goes with the Expense Policy you signed.

*This step ticks itself when you finish the module.*$d$, 40, null, true, null, 126),
('wa279t121', '60 DAYS', null, 'The difference between a nonprofit and a charity', $d$Open this in the Avenue Academy. It is the base of the charity steps above.

*This step ticks itself when you finish the module.*$d$, 15, null, true, null, 121),
('wa279t120', '60 DAYS', null, 'The board of directors: what it is and what it does', $d$Open this in the Avenue Academy. Everyone should know who governs us.

*This step ticks itself when you finish the module.*$d$, 16, null, true, null, 120),
('wa279t148', '90 DAYS', null, 'Meetings with external partners (our SOP)', $d$Open this in the Avenue Academy. Every team meets partners sooner or later, and this is how we run those meetings.

*This step ticks itself when you finish the module.*$d$, 20, null, true, null, 148)
on conflict (id) do update set section = excluded.section, parent_id = excluded.parent_id, name = excluded.name, description = excluded.description,
  sort = excluded.sort, priority = excluded.priority, active = excluded.active, academy_path = excluded.academy_path, training_id = excluded.training_id;

-- 6. the recommended role trainings per department (HR can change this setting without a release)
insert into public.app_config (key, value) values ('onboard_role_recommend', $j${"by_department": {
  "marketing": {"paths": ["mktbasics", "campaigns", "marketing", "studio"], "trainings": [241, 231, 74, 75, 79, 76]},
  "fundraising": {"paths": ["fundraising", "clubs", "thriving", "keela"], "trainings": [227, 228, 204, 245, 83]},
  "opsmtl": {"paths": ["ops"], "trainings": [44, 244, 246, 58, 200]},
  "opsto": {"paths": ["ops"], "trainings": [44, 244, 246, 58, 200]},
  "hr": {"paths": ["people", "hrcentre"], "trainings": [72]},
  "board": {"paths": ["governance"], "trainings": [90, 91, 73, 230]},
  "exec": {"paths": ["leading", "governance"], "trainings": [57, 73, 90, 91, 80]},
  "progdev": {"paths": ["leading"], "trainings": [61, 63, 62, 232, 200]}
}, "leaders": {"paths": ["leading"]}}$j$)
on conflict (key) do nothing;
