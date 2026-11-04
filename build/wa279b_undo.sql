-- Welfare Avenue Hub: undo of wave279b (build/wa279b_template.sql), 04/11/26. Run it BEFORE build/wa279a_undo.sql (it uses the setup_covered column if it is still there).
-- Puts back every changed template row exactly as live had it on 04/11/26 (name, description, section, parent_id, sort, priority, active, academy_path,
-- training_id, setup_covered), deletes the rows wa279b inserted (and their steps on the plans), and deletes the onboard_role_recommend setting.
-- The values below are literals captured from live; nothing is computed at run time. Safe to run twice.
-- Note: switching Gmail signature, Your team's Learning Avenue and Pick a Learning Avenue back on adds them to the active plans as open steps (the trigger),
-- and steps that were removed or deleted from plans by wa279b come back open, not done.

-- 1. the setup_covered flags off again (only if wa279a's column is still there)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'onboarding_template' and column_name = 'setup_covered') then
    execute $e$update public.onboarding_template set setup_covered = false where id in ('86e1cj9gj', '86e1cj9gp', '86e1cj9gy', '86e1cj9h3')$e$;
  end if;
end $$;

-- 2. the changed rows, as they were
update public.onboarding_template t set section = v.section, parent_id = v.parent_id, name = v.name, description = v.description, sort = v.sort::int,
  priority = v.priority, active = v.active::boolean, academy_path = v.academy_path, training_id = v.training_id::bigint
from (values
('wa166usehub', 'WEEK 1', 'wa166hub', 'Using the Hub (Avenue Academy)', $q$Nine short modules on how the Hub works: Home, your team's page and tasks, meeting transcripts, requests between teams, goals, the Volunteer Manager, training, Ask the Hub and who sees what. Everyone does this avenue.

*This step ticks itself when you finish the avenue.*$q$, 7, NULL, true, 'hub', NULL),
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
('86e1cj9gq', 'WEEK 1', '86e1cj9gh', 'Performance and discipline tracking', $q$Read [performance and discipline tracking](https://docs.google.com/document/d/1PHhf41ChaLOZu4ybsWyEpXrsKIQLDDlCN-_kfq7sH5c/edit), then watch Our policies in practice, from HR, in the Avenue Academy.

**To complete this step:** if you have not signed the policies yet (the step above), ask HR to send them to you on DocuSign.

*This step ticks itself when you mark the video watched.*$q$, 80, NULL, true, NULL, 217),
('86e1cj9h2', 'WEEK 1', '86e1cj9h0', 'Understanding Slack, part 1', $q$Watch how our Slack is laid out, in the Avenue Academy.

**To complete this step:** find your team's channel.

*This step ticks itself when you mark the video watched.*$q$, 110, NULL, true, NULL, 213),
('86e1cj9h8', 'WEEK 1', '86e1cj9h0', 'Optimizing and organizing your Slack', $q$Watch Organising your Slack in the Avenue Academy, then make a section for each team so you can see everyone at Welfare Avenue (the Org chart in the Hub shows who is where).

**To complete this step:** send your onboarding channel a screenshot of your sections.

*This step ticks itself when you mark the video watched.*$q$, 130, NULL, true, NULL, 94),
('86e1cj9h6', 'WEEK 1', NULL, 'About Welfare Avenue', $q$Meet Welfare Avenue through other people's eyes:

- [Our CityNews segment](https://www.youtube.com/watch?v=_K5C8O6HEZE)
- [Our mission, vision and activities](https://www.youtube.com/watch?v=mt8jNvv9uso): jump to the 50-minute mark; the question period is worth it
- [Montreal Guardian on Welfare Avenue](https://montrealguardian.com/montreal-charity-welfare-avenue/)
- [The Link on the gentrification of thrifting](https://thelinknewspaper.ca/article/the-gentrification-of-thrifting)
- [CBC on Montreal homelessness and Welfare Avenue](https://www.cbc.ca/news/canada/montreal/montreal-homeless-welfare-avenue-1.6470047)

**To complete this step:** tell us in your onboarding channel what stuck with you or what you learned about us. A short message is plenty.$q$, 150, NULL, true, NULL, NULL),
('86e1cj9hh', 'WEEK 1', NULL, 'Loom', $q$Our meetings are recorded on Loom, and the trainings you watch in the Avenue Academy are Loom videos too. You should get an invitation to Loom from your onboarding team; if not, ask for one.

**To complete this step:** make sure you have a Loom profile on your Welfare Avenue email, then message your onboarding channel once you have finished week 1.$q$, 180, NULL, true, NULL, NULL),
('wa272appsetup', 'WEEK 1', NULL, 'Add the Hub as an app and turn on notifications', $q$Keep the Hub one tap away on your phone and computer, and hear when someone mentions you or gives you work. It takes under a minute.

**To complete this step:** on Home, open Set up your Hub. Add the Hub as an app, then turn on notifications. Show me how has a short film for iPhone and Android.$q$, 190, NULL, true, NULL, NULL),
('86e1cj9gm', 'WEEK 2', NULL, 'Canva', $q$We design in Canva.

**To complete this step:** ask Marketing for the Canva invitation, then for the folders and files you need (the folders especially).$q$, 20, NULL, true, NULL, NULL),
('wa166team', 'WEEK 3', NULL, 'Your team''s Learning Avenue (Avenue Academy)', $q$Your team has its own Learning Avenues in the Avenue Academy (Marketing basics, Operations basics, People and HR, Fundraising and grants, and more). Work through one; ask your lead which fits your role. If your team has none yet, any avenue besides the three everyone does counts.

*This step ticks itself when you finish one.*$q$, 15, NULL, true, 'team', NULL),
('86e1cj9j4', '60 DAYS', '86e1cj9j1', 'Charitable receipts', $q$Watch, read and review everything in the [charitable receipts training in Slack](https://welfareavenue.slack.com/lists/T0223LPS4NS/F07NETWRVE1?record_id=Rec07PC0EF9AL).

**To complete this step:** share two things you learned about charitable receipts in your onboarding channel: one from the video and one from the CRA website.$q$, 12, NULL, true, NULL, NULL),
('86e1cj9j0', '60 DAYS', NULL, 'Pick a Learning Avenue', $q$Pick a Learning Avenue in the Avenue Academy that fits where you want to grow (Leading a team, Charity governance, Marketing basics and more) and work through it; your lead can help you choose.

*This step ticks itself when you finish one besides the three everyone does and the one you did for your team.*$q$, 20, NULL, true, 'any', NULL),
('86e1cj9j6', '60 DAYS', NULL, 'Meet one of our co-executive directors', $q$Book 15 minutes with one of our co-executive directors.

**To complete this step:** send them a Google Calendar invite (see Setting up a meeting, week 1) and post in your onboarding channel once it is booked.$q$, 30, NULL, true, NULL, NULL)
) as v(id, section, parent_id, name, description, sort, priority, active, academy_path, training_id)
where t.id = v.id;

-- 3. the rows wa279b inserted, and their steps on the plans
delete from public.onboarding_steps where template_id in ('wa279role60', 'wa279role90', 'wa279serving', 'wa279review', 'wa279share', 'wa279feedback',
  'wa279t119', 'wa279t205', 'wa279t68', 'wa279t122', 'wa279t103', 'wa279t82', 'wa279t201', 'wa279t71', 'wa279t126', 'wa279t121', 'wa279t120', 'wa279t148');
delete from public.onboarding_template where id in ('wa279role60', 'wa279role90', 'wa279serving', 'wa279review', 'wa279share', 'wa279feedback',
  'wa279t119', 'wa279t205', 'wa279t68', 'wa279t122', 'wa279t103', 'wa279t82', 'wa279t201', 'wa279t71', 'wa279t126', 'wa279t121', 'wa279t120', 'wa279t148');

-- 4. the setting (absent live before wa279b)
delete from public.app_config where key = 'onboard_role_recommend';
