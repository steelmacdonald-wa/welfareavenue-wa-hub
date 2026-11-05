-- wave279b test data: the live onboarding template as it stood on 04/11/26, before wa279b (read-only select on project zwnmulmnvopclzcvytce).
-- Loaded by test/w279sql.mjs after the generic fixtures of test/w279schema.sql. Rows are in section and sort order, parents first.
-- Not loaded into the shared fixtures of w279schema.sql, because the wa279a assertions count the steps of a plan and expect only t-w1, t-w2 and t-d30 there.
-- Left out: the rows that are switched off and that wa279b never touches (the ClickUp mini topics, Keela basics, Helpful integrations, the old Slack channel
-- step children and the three empty test rows wa9urbzqx8, wak3k9xl78, wawy1xu7zb). Switched-off rows that wa279b does touch or that matter are kept.
-- Also stubs the Academy rows the template points at (the real titles for the modules wa279b links; the other titles are placeholders).

insert into public.trainings (id, category, title, kind, active) values
  (8, 'live', 'Gifting and receipting', 'video', true),
  (40, 'live', 'Live module 40', 'read', true),
  (68, 'live', 'Page tour: Org chart', 'tour', true),
  (71, 'live', 'Page tour: Volunteering', 'tour', true),
  (82, 'live', 'Page tour: Calendar', 'tour', true),
  (94, 'live', 'Organising your Slack', 'video', true),
  (103, 'live', 'Searching Slack like a pro', 'video', true),
  (109, 'live', 'Live module 109', 'video', true),
  (115, 'live', 'Setting up a Google Meet', 'video', true),
  (119, 'live', 'A walk through our Google Drive', 'read', true),
  (120, 'live', 'The board of directors: what it is and what it does', 'read', true),
  (121, 'live', 'The difference between a nonprofit and a charity', 'read', true),
  (122, 'live', 'Group emails: sending as a team address', 'video', true),
  (126, 'live', 'Member reimbursements', 'read', true),
  (148, 'live', 'Meetings with external partners (our SOP)', 'read', true),
  (201, 'live', 'Page tour: Document finder', 'tour', true),
  (205, 'live', 'Page tour: the apps', 'tour', true),
  (212, 'live', 'Live module 212', 'video', true),
  (213, 'live', 'Live module 213', 'video', true),
  (214, 'live', 'Live module 214', 'video', true),
  (215, 'live', 'Live module 215', 'video', true),
  (216, 'live', 'Live module 216', 'read', true),
  (217, 'live', 'Live module 217', 'video', true),
  (222, 'live', 'Live lesson 222', 'lesson', true),
  (223, 'live', 'Live lesson 223', 'lesson', true),
  (224, 'live', 'Live lesson 224', 'lesson', true),
  (225, 'live', 'Live lesson 225', 'lesson', true);
insert into public.academy_paths (key, name, title) values
  ('hub', 'Hub', 'Using the Hub'), ('foundations', 'Foundations', 'Welfare Avenue foundations'), ('branding', 'Branding', 'Our brand'),
  ('team', 'Team', 'Your team''s Learning Avenue'), ('any', 'Any', 'Pick a Learning Avenue');

insert into public.onboarding_template (id, section, parent_id, name, description, sort, priority, active, academy_path, training_id) values
('wa167w1', 'WEEK 1', NULL, 'Start here: Welcome to Welfare Avenue', $q$A 10-minute lesson in the Avenue Academy: who we are, how your onboarding works, the tools you will use and how we work together, with a short knowledge check.

*This step ticks itself when you pass the knowledge check.*$q$, 1, 'high', true, NULL, 222),
('wa166hub', 'WEEK 1', NULL, 'The Hub', $q$The Hub ([hub.welfareavenue.com](https://hub.welfareavenue.com)) is where Welfare Avenue's work lives: your team's tasks, meetings and requests, the calendar, and the Avenue Academy, where this plan and your trainings are.

**To complete this step:** sign in with your Welfare Avenue Google account and bookmark the Hub.$q$, 5, 'high', true, NULL, NULL),
('wa166hubfirst', 'WEEK 1', 'wa166hub', 'The Hub''s first steps', $q$The Get started card on Home walks you through your profile, your team and your first task, and ticks each part as you do it.

**To complete this step:** finish the Get started card in your first days.$q$, 6, NULL, true, NULL, NULL),
('wa166usehub', 'WEEK 1', 'wa166hub', 'Using the Hub (Avenue Academy)', $q$Nine short modules on how the Hub works: Home, your team's page and tasks, meeting transcripts, requests between teams, goals, the Volunteer Manager, training, Ask the Hub and who sees what. Everyone does this avenue.

*This step ticks itself when you finish the avenue.*$q$, 7, NULL, true, 'hub', NULL),
('86e1cj9gj', 'WEEK 1', NULL, 'Chrome and your Welfare Avenue account', $q$Set up Chrome with your Welfare Avenue Google account, so your work stays apart from your school or personal accounts. Work through the four steps below.$q$, 10, NULL, true, NULL, NULL),
('86e1cj9gp', 'WEEK 1', '86e1cj9gj', 'Download Chrome', $q$Download Chrome on your laptop, then watch the welcome video in the Avenue Academy: it sets up your Welfare Avenue profile.

*This step ticks itself when you mark the video watched.*$q$, 20, NULL, true, NULL, 212),
('86e1cj9gr', 'WEEK 1', '86e1cj9gj', 'Setting up a meeting', $q$Google Meet is how we meet. Watch the Avenue Academy module on setting up a Google Meet. To find a time that suits everyone, keep [this short video on When2Meet](https://www.loom.com/share/500d4af7547742a89458dfaf3e3194be) handy.

**To complete this step:** bookmark your Google Calendar.

*This step ticks itself when you mark the module watched.*$q$, 30, NULL, true, NULL, 115),
('86e1cj9gx', 'WEEK 1', '86e1cj9gj', 'Gmail signature', $q$Set up your Welfare Avenue email signature with the Avenue Academy module.

**To complete this step:** send your lead a test email that shows your signature.

*This step ticks itself when you mark the module watched.*$q$, 40, NULL, true, NULL, 109),
('86e1cj9gy', 'WEEK 1', '86e1cj9gj', 'Google Groups', $q$Google Groups are shared email addresses for a group of people. [Watch the short training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07NETWRVE1?record_id=Rec07QRFM2Q4V), then ask HR to add you to the groups you should be in.

**To complete this step:** once you are in a group, send it a test email with "Onboarding test" as the subject.$q$, 50, NULL, true, NULL, NULL),
('86e1cj9gh', 'WEEK 1', NULL, 'Policies', $q$Our policies are what we commit to as a team. Read them in full, in the [full version](https://docs.google.com/document/d/1_M0fdr3P71Y95ptj-6toA6phRYHaKCsG/edit) or the [summarized version](https://docs.google.com/document/d/1Sg62q5H4KktrYTp0tGneto4ruouwgLbU5lej4gkMo5E/edit), and keep this step open until you have. Questions are welcome: ask in your onboarding channel, or comment on the doc and tag someone.

The policies also live in the shared [Org Files > HR folder](https://drive.google.com/drive/folders/1Q0YRW5TroUNSI411lYaNbWIEvz7BvKvb), with the [90 day evaluation](https://docs.google.com/document/d/1TXKgL8V-JGvRneKa6BGuRUrjeGJ_pYfs/edit).

**To complete this step:** once you have read them, ask HR to send you the policies to sign on DocuSign.$q$, 60, NULL, true, NULL, NULL),
('86e1cj9gn', 'WEEK 1', '86e1cj9gh', 'The Loop: I''m in, close the loop (every time you work)', $q$Every time you work for Welfare Avenue (a meeting, your onboarding, a task), press I'm in at the top of the Hub when you start and Close the loop when you finish, with a few lines on what moved. It is how a team that works apart stays in the loop; it is not a timeclock, and the note never carries your hours. The reading in the Avenue Academy shows how in three minutes.

**To complete this step:** be in for your onboarding, then close the loop once with a note shared with your team or just the Hub.

*This step ticks itself when you have closed the loop once.*$q$, 70, 'high', true, NULL, 216),
('86e1cj9gq', 'WEEK 1', '86e1cj9gh', 'Performance and discipline tracking', $q$Read [performance and discipline tracking](https://docs.google.com/document/d/1PHhf41ChaLOZu4ybsWyEpXrsKIQLDDlCN-_kfq7sH5c/edit), then watch Our policies in practice, from HR, in the Avenue Academy.

**To complete this step:** if you have not signed the policies yet (the step above), ask HR to send them to you on DocuSign.

*This step ticks itself when you mark the video watched.*$q$, 80, NULL, true, NULL, 217),
('86e1cj9h0', 'WEEK 1', NULL, 'Slack', $q$Slack is where we talk to each other, so it matters from day one. Work through the five steps below.$q$, 90, NULL, true, NULL, NULL),
('86e1cj9h3', 'WEEK 1', '86e1cj9h0', 'Download Slack', $q$Slack is a must: communication is central to your role.

- On your phone: [Android](https://slack.com/downloads/android) or [Apple](https://apps.apple.com/ca/app/slack/id618783545)
- On your computer: [Windows](https://slack.com/downloads/windows) or [Mac](https://slack.com/downloads/mac), and pin Slack to your Chrome bookmarks

**To complete this step:** have Slack on your phone and on your computer.$q$, 100, NULL, true, NULL, NULL),
('86e1cj9h2', 'WEEK 1', '86e1cj9h0', 'Understanding Slack, part 1', $q$Watch how our Slack is laid out, in the Avenue Academy.

**To complete this step:** find your team's channel.

*This step ticks itself when you mark the video watched.*$q$, 110, NULL, true, NULL, 213),
('wa166slack2', 'WEEK 1', '86e1cj9h0', 'Understanding Slack, part 2: your profile', $q$Watch part 2 in the Avenue Academy.

**To complete this step:** set up your Slack profile: your photo, your name and your role.

*This step ticks itself when you mark the video watched.*$q$, 115, NULL, true, NULL, 214),
('86e1cj9h7', 'WEEK 1', '86e1cj9h0', 'Training and development channel', $q$[Watch the video](https://www.loom.com/share/81c73a6731474896afda755450b06723) and the [updated May 2025 rundown](https://www.loom.com/share/a8c8aa9d8f6842a998ab674dffc5d771). Ask your manager which additional trainings you should do. Once done, add your name to the training and say which ones you completed in your onboarding channel.$q$, 120, NULL, false, NULL, NULL),
('86e1cj9h8', 'WEEK 1', '86e1cj9h0', 'Optimizing and organizing your Slack', $q$Watch Organising your Slack in the Avenue Academy, then make a section for each team so you can see everyone at Welfare Avenue (the Org chart in the Hub shows who is where).

**To complete this step:** send your onboarding channel a screenshot of your sections.

*This step ticks itself when you mark the video watched.*$q$, 130, NULL, true, NULL, 94),
('86e1cj9hc', 'WEEK 1', '86e1cj9h0', 'Slack notifications', $q$Watch Managing your Slack notifications in the Avenue Academy.

**To complete this step:** make sure your team's channel notifies you on your phone.

**Tip:** add your lead and your teammates as VIP contacts, so you never miss their messages.

*This step ticks itself when you mark the video watched.*$q$, 140, NULL, true, NULL, 215),
('86e1cj9h6', 'WEEK 1', NULL, 'About Welfare Avenue', $q$Meet Welfare Avenue through other people's eyes:

- [Our CityNews segment](https://www.youtube.com/watch?v=_K5C8O6HEZE)
- [Our mission, vision and activities](https://www.youtube.com/watch?v=mt8jNvv9uso): jump to the 50-minute mark; the question period is worth it
- [Montreal Guardian on Welfare Avenue](https://montrealguardian.com/montreal-charity-welfare-avenue/)
- [The Link on the gentrification of thrifting](https://thelinknewspaper.ca/article/the-gentrification-of-thrifting)
- [CBC on Montreal homelessness and Welfare Avenue](https://www.cbc.ca/news/canada/montreal/montreal-homeless-welfare-avenue-1.6470047)

**To complete this step:** tell us in your onboarding channel what stuck with you or what you learned about us. A short message is plenty.$q$, 150, NULL, true, NULL, NULL),
('86e1cj9ha', 'WEEK 1', NULL, 'Continuous improvement', $q$As you go, tell us anything that is unclear, missing (a link, a file), repeated, or could be more helpful. It makes the onboarding better for the next person.

Stuck on a step (a link that does not open, an invite that never came)? Use Ask for help under your plan: HR and your lead see it in the Hub.$q$, 160, NULL, true, NULL, NULL),
('86e1cj9he', 'WEEK 1', NULL, 'Intros', $q$**Introduce yourself in your team's channel** before your first meeting with your department: your name and role, where you are, and a fun fact or something you enjoy.

**Introduce yourself in #general** within your first four days: your name and role, and a line on what you are looking forward to.$q$, 170, NULL, true, NULL, NULL),
('86e1cj9hh', 'WEEK 1', NULL, 'Loom', $q$Our meetings are recorded on Loom, and the trainings you watch in the Avenue Academy are Loom videos too. You should get an invitation to Loom from your onboarding team; if not, ask for one.

**To complete this step:** make sure you have a Loom profile on your Welfare Avenue email, then message your onboarding channel once you have finished week 1.$q$, 180, NULL, true, NULL, NULL),
('wa272appsetup', 'WEEK 1', NULL, 'Add the Hub as an app and turn on notifications', $q$Keep the Hub one tap away on your phone and computer, and hear when someone mentions you or gives you work. It takes under a minute.

**To complete this step:** on Home, open Set up your Hub. Add the Hub as an app, then turn on notifications. Show me how has a short film for iPhone and Android.$q$, 190, NULL, true, NULL, NULL),
('wa167w2', 'WEEK 2', NULL, 'Start here: Who we are', $q$A 12-minute lesson: our mission, our story from a car trunk to three cities, how a Sunday serving runs and how we speak, with a short knowledge check.

*This step ticks itself when you pass the knowledge check.*$q$, 1, 'high', true, NULL, 223),
('wa166found', 'WEEK 2', NULL, 'Welfare Avenue foundations (Avenue Academy)', $q$Three lessons: the eight charitable activities we are registered for, our partners, and our story since 2020. Everyone does this avenue.

*This step ticks itself when you finish the avenue.*$q$, 3, NULL, true, 'foundations', NULL),
('wa166brand', 'WEEK 2', NULL, 'Our brand (Avenue Academy)', $q$The Brand Guides, the brand refresh video and the knowledge check (12 of 15 to pass). Everyone does this avenue.

*This step ticks itself when you finish the avenue.*$q$, 5, NULL, true, 'branding', NULL),
('wa166work', 'WEEK 2', NULL, 'Your work in the Hub', $q$Your tasks live on your team's page in the Hub. Read Hub module 2 in the Avenue Academy, then open your team's page: find your tasks, open one, comment with @ to bring someone in, and close a task when it is done. Work for another team goes through Requests.

Your lead gives you your first tasks in a meeting this week.

*This step ticks itself when you finish Hub module 2.*$q$, 8, 'high', true, NULL, 40),
('86e1cj9gk', 'WEEK 2', NULL, 'ClickUp beginner guide', $q$Complete the [ClickUp Beginners Course, about 30 minutes](https://university.clickup.com/path/clickup-for-beginners). Once completed, send a message in your onboarding channel answering: what was most useful, and how do you see yourself using ClickUp at Welfare Avenue? Then work through the mini topics below.$q$, 10, NULL, false, NULL, NULL),
('86e1cj9gm', 'WEEK 2', NULL, 'Canva', $q$We design in Canva.

**To complete this step:** ask Marketing for the Canva invitation, then for the folders and files you need (the folders especially).$q$, 20, NULL, true, NULL, NULL),
('86e1cj9gv', 'WEEK 2', NULL, 'Google Photos', $q$[Watch the short Google Photos training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07MM3G4P18?record_id=Rec07MZPARJL9), then open [Google Photos](https://photos.google.com/) and bookmark it. Ask Marketing for the Team Share album.

**To complete this step:** add all the photos from the Team Share album to your own Google Photos.

**Tip:** the photos that are labelled and cleared for use are in the Hub's Photo library (Other Tools).$q$, 30, NULL, true, NULL, NULL),
('wa167w3', 'WEEK 3', NULL, 'Start here: Working with your team', $q$An 8-minute lesson: our teams, how a good team meeting runs, your tasks and requests in the Hub, and why every member volunteers four times a year (you choose your first servings in it), with a short knowledge check.

*This step ticks itself when you pass the knowledge check.*$q$, 1, 'high', true, NULL, 224),
('86e1cj9hg', 'WEEK 3', NULL, 'Mandatory volunteering', $q$Volunteering at a serving is part of every role at Welfare Avenue: every member volunteers **four times a year**. It is how you come to understand our work, and it helps you do your role better.

Choose your first servings in this week's lesson, or on this week's page in your onboarding: they are confirmed right away, and the operations lead gets your message.

*This step ticks itself when you confirm a serving.*

[Open the link](https://welfareavenue.com/volunteer/)$q$, 10, NULL, true, NULL, NULL),
('86e1cj9hm', 'WEEK 3', '86e1cj9hg', 'Understanding Montreal programming', $q$Watch [the itinerary training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07RK3A3NVD?record_id=Rec07RZGPAMK5) to see how our events run. Not on the Operations team? Skimming the videos is enough.

**To complete this step:** send your onboarding team a few lines on how you understand an event runs.$q$, 11, NULL, true, NULL, NULL),
('wa166team', 'WEEK 3', NULL, 'Your team''s Learning Avenue (Avenue Academy)', $q$Your team has its own Learning Avenues in the Avenue Academy (Marketing basics, Operations basics, People and HR, Fundraising and grants, and more). Work through one; ask your lead which fits your role. If your team has none yet, any avenue besides the three everyone does counts.

*This step ticks itself when you finish one.*$q$, 15, NULL, true, 'team', NULL),
('wa166meeting', 'WEEK 3', NULL, 'Find your team''s meeting in the Hub', $q$Your team's weekly meeting comes into the Hub by itself from Loom.

**To complete this step:** after your next one, find it in the Transcript archive (Other Tools) or on your team's page, and ask the Hub one question about it, like what was decided or what is yours to do.$q$, 17, NULL, true, NULL, NULL),
('wa167w4', 'WEEK 4', NULL, 'Start here: Look back, look ahead', $q$A 6-minute lesson: your 30-day evaluation, how to keep growing with us and what we hold on to, with a short knowledge check.

*This step ticks itself when you pass the knowledge check.*$q$, 1, 'high', true, NULL, 225),
('86e1cj9ht', 'WEEK 4', NULL, 'About Welfare Avenue (in depth)', $q$A deeper look at our charitable work, in the step below.$q$, 10, NULL, true, NULL, NULL),
('86e1cj9hx', 'WEEK 4', '86e1cj9ht', 'Charitable activities', $q$You met our eight charitable activities in the foundations avenue (week 2). Now go deeper with [the full document](https://docs.google.com/document/d/1jCbzwXECdzeRskF7NHjPB7n4_wW9wn-X/edit#heading=h.v8n7c0e22e).

**To complete this step:** leave at least three comments in the document.$q$, 11, NULL, true, NULL, NULL),
('86e1cj9hr', 'WEEK 4', NULL, 'Quiz', $q$Two short quizzes to check what you have learned, in the steps below.$q$, 20, NULL, true, NULL, NULL),
('86e1cj9hv', 'WEEK 4', '86e1cj9hr', 'Policy quiz', $q$This quiz checks your understanding of the policies you take on as a member of the team: [take the policy quiz (Google Form)](https://forms.gle/zesoPhpx9ga33j817).

**To complete this step:** message your onboarding channel once it is done, so HR can look over your answers.

*This step ticks itself when you send the form.*$q$, 21, NULL, true, NULL, NULL),
('86e1cj9hw', 'WEEK 4', '86e1cj9hr', '30 day quiz', $q$[Take the 30 day quiz (Google Form)](https://forms.gle/aoZVR1g6ELRnogMw9).

**To complete this step:** message your onboarding channel once you have sent it.

*This step ticks itself when you send the form.*$q$, 22, NULL, true, NULL, NULL),
('86e1cj9hz', 'WEEK 4', NULL, 'Self-assessment', $q$Write a short self-assessment of your first three weeks. Keep it light: it is only to hear how it is going for you.

- What went well, and what you like so far
- The challenges you faced
- The skills or areas you want to learn more about
- Where you see yourself contributing more

**To complete this step:** send your answers in your onboarding channel, or to your HR rep and your lead.$q$, 30, NULL, true, NULL, NULL),
('86e1cj9j1', '60 DAYS', NULL, 'How charities function', $q$How Canadian charities work, in the two steps below.$q$, 10, NULL, true, NULL, NULL),
('86e1cj9j3', '60 DAYS', '86e1cj9j1', 'Basics', $q$Watch [how charities work (YouTube)](https://www.youtube.com/watch?v=ZLA-trD_vVc).$q$, 11, NULL, true, NULL, NULL),
('86e1cj9j4', '60 DAYS', '86e1cj9j1', 'Charitable receipts', $q$Watch, read and review everything in the [charitable receipts training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07NETWRVE1?record_id=Rec07PC0EF9AL).

**To complete this step:** share two things you learned about charitable receipts in your onboarding channel: one from the video and one from the CRA website.$q$, 12, NULL, true, NULL, NULL),
('86e1cj9j0', '60 DAYS', NULL, 'Pick a Learning Avenue', $q$Pick a Learning Avenue in the Avenue Academy that fits where you want to grow (Leading a team, Charity governance, Marketing basics and more) and work through it; your lead can help you choose.

*This step ticks itself when you finish one besides the three everyone does and the one you did for your team.*$q$, 20, NULL, true, 'any', NULL),
('86e1cj9j6', '60 DAYS', NULL, 'Meet one of our co-executive directors', $q$Book 15 minutes with one of our co-executive directors.

**To complete this step:** send them a Google Calendar invite (see Setting up a meeting, week 1) and post in your onboarding channel once it is booked.$q$, 30, NULL, true, NULL, NULL);
