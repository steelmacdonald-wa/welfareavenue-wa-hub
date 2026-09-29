-- wa166_onboarding (29/09/26): onboarding around the Hub and the Avenue Academy, and what a lead sees (wave166).
-- Steel: "please consider embedding Loom videos in the Avenue Academy for trainings and for the onboarding as well (which I believe
-- needs some revision giving the move away from ClickUp, the new Hub). In fact the onboarding could include members doing some of
-- the Avenue Academy modules. Give the onboarding a whole revamp. I also believe that managers or leads that have people onboarding
-- should have something on their home page to show the progress their member is making and where they need to come in to ensure
-- they progress."
-- The plan keeps its weeks (WEEK 1 to 4, 60 DAYS). ClickUp (gone) and Keela (being closed) leave it; the Hub and the Avenue Academy
-- come in: a step can be done in the Academy (a module, or a Learning Avenue: the three everyone does, the person's team's, or one
-- of their choice) and ticks itself when the person finishes it there. The week 1 Loom videos become Academy modules in a new
-- avenue, Your first week, so they play inside the Hub. The lead's moments (introduce them, first tasks, the two-week and 30-day
-- check-ins, the quizzes, probation) carry who does them and when; onboarding_lead_view() gives a lead their people's progress
-- and those moments, and they tick theirs on Home. Every change is guarded: running it twice changes nothing.

-- 1. a step done in the Avenue Academy; who does an HR setup step and when
alter table public.onboarding_template add column if not exists academy_path text;
alter table public.onboarding_template add column if not exists training_id bigint;
alter table public.onboarding_template drop constraint if exists onboarding_template_training_id_fkey;
alter table public.onboarding_template add constraint onboarding_template_training_id_fkey foreign key (training_id) references public.trainings(id) on delete set null;
create index if not exists idx_onboarding_template_training_id on public.onboarding_template (training_id);
alter table public.hr_setup_template add column if not exists who text not null default 'hr';
alter table public.hr_setup_template drop constraint if exists hr_setup_template_who_check;
alter table public.hr_setup_template add constraint hr_setup_template_who_check check (who in ('hr', 'lead'));
alter table public.hr_setup_template add column if not exists due_day integer;

-- 2. the week 1 videos as Academy modules (Your first week), so they play inside the Hub
insert into public.academy_paths (key, name, title, blurb, dept, required, cert_title, color, icon, sort, active)
  values ('firstweek', 'Your first week', 'Your first week', 'The videos behind the first week of onboarding: your Google account and Chrome, Slack, checking in and out, and our policies in practice.', null, false, 'First Week Done', '#2A8C7A', 'home', 12, true)
  on conflict (key) do nothing;
-- (all six are public on Loom: they play for someone who has no Loom account yet)
insert into public.trainings (category, title, description, resource_url, source, ext_id, path_group, sort, active, kind, key, minutes, duration_sec)
  values
  ('Onboarding', 'Getting started with Chrome and your Google account', 'A welcome, then setting up your Welfare Avenue Google account in Chrome: your profile, your login details, and the invitations to watch for (Slack and the other tools).' || chr(10) || chr(10) || 'Done when: Chrome is on your computer with your Welfare Avenue profile signed in.',
   'https://www.loom.com/share/522090b198054eb4aab13e0365efadf6', 'loom', '522090b198054eb4aab13e0365efadf6', 'Your first week', 10, true, 'video', 'onb:chrome', 4, 189),
  ('Onboarding', 'Understanding Slack, part 1', 'Slack is where the team talks every day. This part walks through how our workspace is laid out.' || chr(10) || chr(10) || 'Done when: you know where your team''s channel is and have posted in it.',
   'https://www.loom.com/share/1edbc0c25e1b484db405dfabd291dc1d', 'loom', '1edbc0c25e1b484db405dfabd291dc1d', 'Your first week', 20, true, 'video', 'onb:slack1', 6, 319),
  ('Onboarding', 'Understanding Slack, part 2', 'Setting up your Slack profile so people know who you are and what you do.' || chr(10) || chr(10) || 'Done when: your profile has your photo, your name and your role.',
   'https://www.loom.com/share/7dbc52dabfcc484181ce6f8ddc1f111d', 'loom', '7dbc52dabfcc484181ce6f8ddc1f111d', 'Your first week', 30, true, 'video', 'onb:slack2', 2, 107),
  ('Onboarding', 'Managing your Slack notifications', 'Notifications per channel and per person, why mentions stay on, and setting your status (with an end date) when you are away.' || chr(10) || chr(10) || 'Done when: your team''s channel notifies you on your phone.',
   'https://www.loom.com/share/661159d22e734711a885e7c0e8a896ec', 'loom', '661159d22e734711a885e7c0e8a896ec', 'Your first week', 40, true, 'video', 'onb:slacknotif', 5, 266),
  ('Onboarding', 'Checking in and out', 'Why we check in when we start working for Welfare Avenue and out when we finish, and what to write. In the Hub, the Check in button at the top of every page does it for you and posts in #check-in-out-wa.' || chr(10) || chr(10) || 'Done when: you have checked in and out once, for your onboarding.',
   'https://www.loom.com/share/ee8af32205ed42588b550c6be9160361', 'loom', 'ee8af32205ed42588b550c6be9160361', 'Your first week', 50, true, 'video', 'onb:checkin', 4, 222),
  ('Onboarding', 'Our policies in practice', 'How our policies are applied day to day: performance and discipline tracking, from HR. Read the policies first (week 1 of your onboarding).' || chr(10) || chr(10) || 'Done when: you know how performance and discipline are tracked and where the policies live.',
   'https://www.loom.com/share/4a330c1733b8473a8bf5252c0ce3f990', 'loom', '4a330c1733b8473a8bf5252c0ce3f990', 'Your first week', 60, true, 'video', 'onb:policies', 12, 698)
  on conflict (key) where key is not null do nothing;

-- 3. the plan. Out: the ClickUp course and its topics, ClickUp x Slack, Keela (being closed), the Slack trainings channel (the
--    Avenue Academy holds the trainings now) and a test step. The propagation trigger takes each out of the plans in progress.
update public.onboarding_template set active = false
  where id in ('86e1cj9gk', '86e1cj9gt', '86e1cj9gu', '86e1cj9gz', '86e1cj9h1', '86e1cj9h5',   -- ClickUp beginner guide and its topics
               '86e1cj9hq', '86e1cj9hu',                                                    -- Helpful integrations, ClickUp x Slack
               '86e1cj9hf', '86e1cj9hj', '86e1cj9hk', '86e1cj9hn',                          -- Keela basics
               '86e1cj9h7',                                                                 -- the trainings and development channel
               'wa9urbzqx8')                                                                -- Test
    and active;

-- what stays, in the Hub's words, with the Academy module that goes with it
update public.onboarding_template set name = 'Chrome and your Welfare Avenue account', description = 'Get set up on Chrome with your Welfare Avenue Google account. Complete the items below.', updated_at = now()
  where id = '86e1cj9gj' and name = 'Google Chrome';
update public.onboarding_template set training_id = (select id from public.trainings where key = 'onb:chrome'),
    description = 'Download Chrome on your laptop, then watch the welcome video in the Avenue Academy: it sets up your Welfare Avenue profile. This step ticks itself when you mark the video watched.', updated_at = now()
  where id = '86e1cj9gp' and training_id is null;
update public.onboarding_template set training_id = 115,
    description = 'Google Meet is how we run meetings. Watch the Avenue Academy module on setting up a Google Meet (and bookmark [finding a meeting time with When2Meet](https://www.loom.com/share/500d4af7547742a89458dfaf3e3194be)).' || chr(10) || chr(10) || '**To complete the task:** bookmark your Google Calendar. This step ticks itself when you mark the module watched.', updated_at = now()
  where id = '86e1cj9gr' and training_id is null and exists (select 1 from public.trainings where id = 115);
update public.onboarding_template set training_id = 109,
    description = 'Set up your Welfare Avenue signature: watch the Avenue Academy module, then send your lead a test email that shows it. This step ticks itself when you mark the module watched.', updated_at = now()
  where id = '86e1cj9gx' and training_id is null and exists (select 1 from public.trainings where id = 109);
update public.onboarding_template set training_id = (select id from public.trainings where key = 'onb:checkin'), name = 'Checking in and out (very important)',
    description = 'Watch the video in the Avenue Academy. Every time you work for Welfare Avenue (a meeting, your onboarding, a task), check in when you start and out when you finish, with a line on what you did: the Check in button at the top of the Hub does it and posts in #check-in-out-wa for you.' || chr(10) || chr(10) || '**To complete the task:** check in and out for your onboarding and your first team meeting.', updated_at = now()
  where id = '86e1cj9gn' and training_id is null;
update public.onboarding_template set training_id = (select id from public.trainings where key = 'onb:policies'),
    description = 'Read [performance and discipline tracking](https://docs.google.com/document/d/1PHhf41ChaLOZu4ybsWyEpXrsKIQLDDlCN-_kfq7sH5c/edit), then watch our policies in practice (from HR) in the Avenue Academy.' || chr(10) || chr(10) || '**Mini task:** after reading the policies, ask your HR representative to send you the policy document to sign. This step ticks itself when you mark the video watched.', updated_at = now()
  where id = '86e1cj9gq' and training_id is null;
update public.onboarding_template set name = 'Understanding Slack, part 1', training_id = (select id from public.trainings where key = 'onb:slack1'),
    description = 'Watch how our Slack is laid out in the Avenue Academy, then find your team''s channel. This step ticks itself when you mark the video watched.', updated_at = now()
  where id = '86e1cj9h2' and training_id is null;
update public.onboarding_template set training_id = 94,
    description = 'Watch organising your Slack in the Avenue Academy. Make sections for each team so you can see everyone at Welfare Avenue (the org chart in the Hub shows who is where), then send your onboarding channel a screenshot of your sections. This step ticks itself when you mark the video watched.', updated_at = now()
  where id = '86e1cj9h8' and training_id is null and exists (select 1 from public.trainings where id = 94);
update public.onboarding_template set training_id = (select id from public.trainings where key = 'onb:slacknotif'),
    description = 'Watch managing your Slack notifications in the Avenue Academy.' || chr(10) || chr(10) || '**To complete the task:** make sure your team''s channel notifies you on your phone. Pro tip: add your lead and your teammates as VIP contacts so you never miss their messages. This step ticks itself when you mark the video watched.', updated_at = now()
  where id = '86e1cj9hc' and training_id is null;
update public.onboarding_template set description = 'You should get an invite to Loom from your onboarding team; if not, ask for one. Our meetings are recorded on Loom, and the trainings you watch in the Avenue Academy are Loom videos too.' || chr(10) || chr(10) || '**To complete the task:** make sure you have a Loom profile on your Welfare Avenue email, then message your onboarding channel once you complete week 1.', updated_at = now()
  where id = '86e1cj9hh' and position('Avenue Academy' in coalesce(description, '')) = 0;
update public.onboarding_template set description = 'Ask Marketing for the Canva invitation, then ask them to share the folders and files you need (the folders especially).', updated_at = now()
  where id = '86e1cj9gm' and position('ClickUp' in coalesce(description, '')) > 0;
update public.onboarding_template set description = replace(description, ' (the ClickUp task has screenshots of other albums worth requesting)', ''), updated_at = now()
  where id = '86e1cj9gv' and position('ClickUp' in coalesce(description, '')) > 0;
update public.onboarding_template set name = 'Pick a Learning Avenue', academy_path = 'any',
    description = 'Pick a Learning Avenue in the Avenue Academy that fits where you want to grow (Leading a team, Charity governance, Marketing basics and more), and work through it; your lead can help you choose. This step ticks itself when you finish one besides the three everyone does and the one you did for your team.', updated_at = now()
  where id = '86e1cj9j0' and academy_path is null;
update public.onboarding_template set description = 'You met our eight charitable activities in the foundations avenue (week 2). Now go deeper: review [the full document](https://docs.google.com/document/d/1jCbzwXECdzeRskF7NHjPB7n4_wW9wn-X/edit#heading=h.v8n7c0e22e).' || chr(10) || chr(10) || 'The task is complete when you have left at least 3 comments throughout the document.', updated_at = now()
  where id = '86e1cj9hx' and position('foundations' in coalesce(description, '')) = 0;
update public.onboarding_template set description = description || chr(10) || chr(10) || 'Stuck on a step (a link that does not open, an invite that never came)? Use Ask for help under your plan: HR and your lead see it in the Hub.', updated_at = now()
  where id = '86e1cj9ha' and position('Ask for help' in coalesce(description, '')) = 0;
update public.onboarding_template set name = 'Meet one of our co-executive directors',
    description = 'Book 15 minutes with one of our co-executive directors: send a Google Calendar invite (see Setting up a meeting, week 1) and post in your onboarding channel once it is booked.', updated_at = now()
  where id = '86e1cj9j6' and name = 'Schedule a 15 minute meeting with the Executive Director';

-- what is new: the Hub, the three avenues everyone does, your work in the Hub, your team's avenue and meeting, the check-in
insert into public.onboarding_template (id, section, parent_id, name, description, sort, priority, active, content_pending, clickup_url, academy_path, training_id)
  values
  ('wa166hub', 'WEEK 1', null, 'The Hub', 'The Hub (wa-exec-dashboard.netlify.app) is where Welfare Avenue''s work lives: your team''s tasks, meetings and requests, the calendar, and the Avenue Academy, where this plan and your trainings are. Sign in with your Welfare Avenue Google account and bookmark it.', 5, 'high', true, false, null, null, null),
  ('wa166hubfirst', 'WEEK 1', 'wa166hub', 'The Hub''s first steps', 'On Home, the Get started card walks you through your profile, your team and your first task; each step ticks itself when you do it. Finish it in your first days.', 6, null, true, false, null, null, null),
  ('wa166usehub', 'WEEK 1', 'wa166hub', 'Using the Hub (Avenue Academy)', 'Nine short modules on how the Hub works: Home, your team''s page and tasks, meeting transcripts, requests between teams, goals, volunteering, training, Ask the Hub and who sees what. Everyone does this avenue; this step ticks itself when you finish it.', 7, null, true, false, null, 'hub', null),
  ('wa166slack2', 'WEEK 1', '86e1cj9h0', 'Understanding Slack, part 2: your profile', 'Watch the video in the Avenue Academy and set up your Slack profile (your photo, your name and your role). This step ticks itself when you mark the video watched.', 115, null, true, false, null, null, (select id from public.trainings where key = 'onb:slack2')),
  ('wa166found', 'WEEK 2', null, 'Welfare Avenue foundations (Avenue Academy)', 'Three lessons: the eight charitable activities we are registered for, our partners, and our story since 2020. Everyone does this avenue; this step ticks itself when you finish it.', 3, null, true, false, null, 'foundations', null),
  ('wa166brand', 'WEEK 2', null, 'Our brand (Avenue Academy)', 'The Brand Guides, the brand refresh video and the knowledge check (12 of 15 to pass). Everyone does this avenue; this step ticks itself when you pass.', 5, null, true, false, null, 'branding', null),
  ('wa166work', 'WEEK 2', null, 'Your work in the Hub', 'Your tasks live on your team''s page in the Hub. Read Hub module 2 in the Avenue Academy, then open your team''s page: find your tasks, open one, comment with @ to bring someone in, and close a task when it is done. Work for another team goes through Requests. Your lead gives you your first tasks in a meeting this week. This step ticks itself when you finish the module.', 8, 'high', true, false, null, null, 40),
  ('wa166team', 'WEEK 3', null, 'Your team''s Learning Avenue (Avenue Academy)', 'Your team has its own Learning Avenues in the Avenue Academy (Marketing basics, Operations basics, People and HR, Fundraising and grants, and more). Work through one; ask your lead which fits your role. If your team has none yet, any avenue besides the three everyone does counts. This step ticks itself when you finish one.', 15, null, true, false, null, 'team', null),
  ('wa166meeting', 'WEEK 3', null, 'Find your team''s meeting in the Hub', 'Your team''s weekly meeting comes into the Hub by itself from Loom. After your next one, find it in the Transcript archive (Other Tools) or on your team''s page, and ask the Hub one question about it, like what was decided or what is yours to do.', 17, null, true, false, null, null, null)
  on conflict (id) do nothing;

-- 4. HR setup: who does each step and by when (days after the start); the lead's moments; Keela out
update public.hr_setup_template set who = 'hr', due_day = 0 where phase = 'Before day one' and due_day is null;
update public.hr_setup_template set who = 'hr', due_day = 3 where phase = 'The onboarding call' and due_day is null;
update public.hr_setup_template set who = 'lead', due_day = 7 where id = 'hrm1' and due_day is null;
update public.hr_setup_template set who = 'lead', due_day = 30 where id = 'hrm2' and due_day is null;
update public.hr_setup_template set who = 'lead', due_day = 35 where id = 'hrm3' and due_day is null;
update public.hr_setup_template set who = 'lead', due_day = 120 where id = 'hrm4' and due_day is null;   -- "Due 4 months from their first day"
update public.hr_setup_template set active = false where id = 'hrc7' and name = 'Invite them to Keela' and active;
update public.hr_setup_template set name = 'Show them the Avenue Academy and their plan',
    description = 'Open the Avenue Academy with them: their onboarding plan week by week, the videos that play inside the Hub, the three avenues everyone does and their team''s, and how a module is marked done (Academy steps in the plan then tick themselves).'
  where id = 'hrc4' and name = 'Show #trainings-development';
update public.hr_setup_template set description = 'HR centre, Onboarding: Assign an onboarding to their name. The Welcome kit opens with the email and the channel message ready, and their lead sees them on Home from then on.'
  where id = 'hrb6' and position('Training tab' in coalesce(description, '')) > 0;
insert into public.hr_setup_template (id, phase, name, description, sort, active, who, due_day)
  values ('hrm0', 'Manager follow-through', 'Introduce them at your team''s meeting', 'Welcome them in your team''s channel and introduce them at the first team meeting they join.', (select coalesce(min(sort), 100) - 2 from public.hr_setup_template where phase = 'Manager follow-through'), true, 'lead', 7),
         ('hrm5', 'Manager follow-through', 'Check in at two weeks', 'Fifteen minutes around day 14: what is working, what is stuck, and whether their plan is on pace.', (select coalesce(min(sort), 100) - 1 from public.hr_setup_template where phase = 'Manager follow-through' and id = 'hrm2'), true, 'lead', 14)
  on conflict (id) do nothing;

-- 5. how far a person is in an avenue, and whether they finished a module. 'team': the avenue of their team they are furthest in
--    (any avenue besides the three everyone does when their team has none); 'any': an avenue besides the three everyone does and
--    besides the one that counted for their team, so one avenue never ticks both steps. Keela (being closed), the page tours and
--    Your first week never count for 'team' or 'any'.
create or replace function public.wa166_path_state(p_member bigint, p_key text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with me as (select tm.name, tm.email, tm.department from public.team_members tm where tm.id = p_member),
  st as (
    select p.key, p.title, p.dept, coalesce(p.required, false) as required, p.sort,
      (select count(*) from public.trainings t
        where t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour' and not coalesce((t.body ->> 'planned')::boolean, false))::int as total,
      (select count(distinct t.id) from public.trainings t join public.training_progress tp on tp.training_id = t.id cross join me
        where t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour' and not coalesce((t.body ->> 'planned')::boolean, false)
          and tp.status = 'done'
          and (lower(tp.person_name) = lower(me.name) or (me.email is not null and lower(coalesce(tp.email, '')) = lower(me.email))))::int as done
    from public.academy_paths p where p.active
  ),
  s2 as (select st.*, (st.total > 0 and st.done >= st.total) as complete,
                case when st.total > 0 then least(st.done, st.total)::numeric / st.total else 0 end as ratio from st),
  elig as (select * from s2 where not s2.required and s2.key not in ('tours', 'firstweek', 'keela')),
  team as (select e.* from elig e, me where e.dept is not null and e.dept = me.department),
  team_pick as (
    select x.* from (select * from team union all select * from elig where not exists (select 1 from team)) x
    order by x.complete desc, x.ratio desc, x.sort nulls last, x.key limit 1
  ),
  cand as (
    select * from s2 where p_key not in ('team', 'any') and s2.key = p_key
    union all select * from team_pick where p_key = 'team'
    union all select e.* from elig e where p_key = 'any' and not exists (select 1 from team_pick tp where tp.complete and tp.key = e.key)
  )
  select coalesce(
    (select jsonb_build_object('key', c.key, 'title', c.title, 'done', least(c.done, c.total), 'total', c.total, 'complete', c.complete, 'asked', p_key)
       from cand c order by c.complete desc, c.ratio desc, c.sort nulls last, c.key limit 1),
    jsonb_build_object('key', p_key, 'title', null, 'done', 0, 'total', 0, 'complete', false, 'asked', p_key));
$function$;
create or replace function public.wa166_training_done(p_member bigint, p_training bigint)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.training_progress tp join public.team_members tm on tm.id = p_member
                 where tp.training_id = p_training and tp.status = 'done'
                   and (lower(tp.person_name) = lower(tm.name) or (tm.email is not null and lower(coalesce(tp.email, '')) = lower(tm.email))));
$function$;

-- 6. the steps done in the Academy tick themselves, and a plan completes itself when its last step is ticked (in the Academy, by
--    the person, by HR), and opens again when a step is unticked (the page did this itself, from what it had loaded, which missed
--    steps the Academy ticked since)
create or replace function public.wa166_onb_done()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.done is distinct from old.done then
    if coalesce(new.done, false) then
      if not exists (select 1 from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
                      where s.onboarding_id = new.onboarding_id and t.active and not coalesce(s.done, false)) then
        update public.onboardings set status = 'completed', completed_at = now() where id = new.onboarding_id and status = 'active';
      end if;
    else
      update public.onboardings set status = 'active', completed_at = null where id = new.onboarding_id and status = 'completed';
    end if;
  end if;
  return new;
end $function$;
drop trigger if exists trg_wa166_onb_done on public.onboarding_steps;
create trigger trg_wa166_onb_done after update of done on public.onboarding_steps for each row execute function public.wa166_onb_done();

create or replace function public.wa166_onb_sync(p_onb bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_member bigint; v_n int := 0; r record; v_ok boolean;
begin
  select o.member_id into v_member from public.onboardings o where o.id = p_onb and o.status = 'active';
  if v_member is null then return 0; end if;
  for r in select s.id, t.academy_path, t.training_id
             from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
            where s.onboarding_id = p_onb and not coalesce(s.done, false) and t.active and (t.academy_path is not null or t.training_id is not null) loop
    v_ok := case when r.training_id is not null then public.wa166_training_done(v_member, r.training_id)
                 else coalesce((public.wa166_path_state(v_member, r.academy_path) ->> 'complete')::boolean, false) end;
    if v_ok then
      update public.onboarding_steps set done = true, done_at = now(), done_by = 'Avenue Academy' where id = r.id and not coalesce(done, false);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;   -- the plan completes itself when its last step is ticked (trg_wa166_onb_done)
end $function$;
create or replace function public.wa166_tp_onb()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    perform public.wa166_onb_sync(o.id)
       from public.onboardings o join public.team_members tm on tm.id = o.member_id
      where o.status = 'active'
        and (lower(tm.name) = lower(new.person_name) or (new.email is not null and tm.email is not null and lower(tm.email) = lower(new.email)));
  end if;
  return new;
end $function$;
drop trigger if exists trg_wa166_tp_onb on public.training_progress;
create trigger trg_wa166_tp_onb after insert or update of status on public.training_progress for each row execute function public.wa166_tp_onb();

-- a new plan starts with what the person already did in the Academy ticked
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.onboarding_assign(bigint, text)'::regprocedure);
  if position('wa166_onb_sync' in d) = 0 then
    d := replace(d, $r$  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  return v_id;$r$, $r$  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  perform public.wa166_onb_sync(v_id);   -- wave166: what they already did in the Avenue Academy is ticked
  return v_id;$r$);
    if position('wa166_onb_sync' in d) = 0 then raise exception 'onboarding_assign: the end was not found'; end if;
    execute d;
  end if;
end $do$;

-- 7. a lead's people: who reports to them in the org chart; without a manager in the org chart, the leaders of their team; without
--    either, the admins. Each person's plan, the lead's moments, help requests and the three avenues plus their team's
create or replace function public.wa166_person_card(p_onb bigint, p_via text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with ob as (
    select o.id, o.member_id, o.person_name, o.started_at, o.status, tm.email, tm.department,
           (select pos.title from public.org_positions pos where pos.member_id = o.member_id order by pos.id limit 1) as title
    from public.onboardings o join public.team_members tm on tm.id = o.member_id where o.id = p_onb
  ),
  st as (
    select s.id, s.done, s.done_at, s.due_date, t.section, t.name, t.parent_id, t.sort, coalesce(pt.sort, t.sort) as psort, t.academy_path, t.training_id, t.priority,
           case t.section when 'WEEK 1' then 1 when 'WEEK 2' then 2 when 'WEEK 3' then 3 when 'WEEK 4' then 4 when '60 DAYS' then 5 when '90 DAYS' then 6 when '6 MONTHS' then 7 else 9 end as rank
    from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id and t.active
    left join public.onboarding_template pt on pt.id = t.parent_id
    where s.onboarding_id = p_onb
  ),
  sec as (select section, min(rank) as rank, count(*)::int as total, count(*) filter (where done)::int as done, min(due_date) filter (where not done) as due from st group by section),
  hs as (
    select h.id, h.done, h.done_at, h.done_by, t.name, t.description, t.due_day, t.sort, (select started_at from ob) + coalesce(t.due_day, 0) as due
    from public.hr_setup_steps h join public.hr_setup_template t on t.id = h.template_id and t.active
    where h.onboarding_id = p_onb and t.who = 'lead'
  )
  select jsonb_build_object(
    'onboarding_id', ob.id, 'member_id', ob.member_id, 'name', ob.person_name, 'email', ob.email, 'department', ob.department, 'title', ob.title, 'via', p_via,
    'started_at', ob.started_at, 'day', greatest(1, ((now() at time zone 'America/Toronto')::date - ob.started_at) + 1),
    'done', (select count(*) from st where done), 'total', (select count(*) from st),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('name', section, 'done', done, 'total', total, 'due', due) order by rank, section) from sec), '[]'::jsonb),
    'late_count', (select count(*) from st where not coalesce(done, false) and due_date < (now() at time zone 'America/Toronto')::date),
    'late', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'due', x.due_date, 'section', x.section) order by x.due_date, x.rank, x.psort, x.sort)
                      from (select * from st where not coalesce(done, false) and due_date < (now() at time zone 'America/Toronto')::date order by due_date, rank, psort, sort limit 6) x), '[]'::jsonb),
    'next', (select jsonb_build_object('name', name, 'due', due_date, 'section', section) from st where not coalesce(done, false) order by rank, psort, parent_id nulls first, sort limit 1),
    'last_done_at', (select max(done_at) from st),
    'steps', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'section', section, 'child', parent_id is not null, 'done', coalesce(done, false), 'due', due_date,
                                                            'academy', academy_path is not null or training_id is not null, 'important', priority = 'high')
                              order by rank, psort, parent_id nulls first, sort) from st), '[]'::jsonb),
    'quizzes_done', (select count(*) from st where done and training_id is null and academy_path is null and name in ('Policy quiz', '30 day quiz'))::int,
    'lead_steps', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'description', description, 'due', due, 'done', coalesce(done, false), 'done_at', done_at, 'done_by', done_by) order by due, sort) from hs), '[]'::jsonb),
    'help', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'step', h.step_name, 'note', h.note, 'at', h.created_at) order by h.created_at)
                      from public.onboarding_help h where h.onboarding_id = p_onb and coalesce(h.status, 'open') = 'open'), '[]'::jsonb),
    'academy', jsonb_build_array(public.wa166_path_state(ob.member_id, 'hub'), public.wa166_path_state(ob.member_id, 'foundations'),
                                 public.wa166_path_state(ob.member_id, 'branding'), public.wa166_path_state(ob.member_id, 'team'))
  ) from ob;
$function$;
create or replace function public.onboarding_lead_view()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', '')); v_me record; v_seat bigint; v_admin boolean; v_leader boolean;
        v_out jsonb := '[]'::jsonb; r record; v_via text;
begin
  if not coalesce(public.is_wa_staff(), false) then return jsonb_build_object('people', '[]'::jsonb); end if;
  -- the signed-in person on the roster (a second sign-in address counts: wa_email_aliases)
  select tm.id, tm.name, tm.department into v_me from public.team_members tm
   where lower(tm.email) = v_email
      or lower(tm.email) in (select lower(a.email) from public.wa_email_aliases a where v_email = any (select lower(x) from unnest(a.aliases) x))
   order by tm.active desc nulls last, tm.id limit 1;
  v_admin := coalesce(public.is_hub_admin(), false); v_leader := coalesce(public.is_hub_leader(), false);
  if v_me.id is not null then select o.id into v_seat from public.org_positions o where o.member_id = v_me.id order by o.id limit 1; end if;
  for r in
    select ob.id, ob.member_id, tm.department,
           pos.reports_to, lp.member_id as lead_member
    from public.onboardings ob
    join public.team_members tm on tm.id = ob.member_id
    left join lateral (select p.reports_to from public.org_positions p where p.member_id = ob.member_id order by p.id limit 1) pos on true
    left join public.org_positions lp on lp.id = pos.reports_to
    where ob.status = 'active' and ob.member_id is distinct from v_me.id
    order by ob.started_at, ob.id
  loop
    v_via := null;
    if v_seat is not null and r.reports_to = v_seat then v_via := 'reports to you';
    elsif r.lead_member is null and v_leader and v_me.department is not null and v_me.department = r.department then v_via := 'your team';
    elsif r.lead_member is null and v_admin and not exists (
        select 1 from public.hub_roles hr join public.team_members l on lower(l.email) = hr.email
         where hr.role in ('leader', 'admin') and l.department = r.department and l.id <> r.member_id) then v_via := 'no lead set';
    end if;
    if v_via is null then continue; end if;
    v_out := v_out || jsonb_build_array(public.wa166_person_card(r.id, v_via));
  end loop;
  return jsonb_build_object('people', v_out, 'me', v_me.name);
end $function$;
-- a lead ticks their moment (or HR does)
create or replace function public.onboarding_lead_tick(p_step bigint, p_done boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_onb bigint; v_who text; v_by text; v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select h.onboarding_id, t.who into v_onb, v_who from public.hr_setup_steps h join public.hr_setup_template t on t.id = h.template_id where h.id = p_step;
  if v_onb is null then raise exception 'That step was not found'; end if;
  if not (coalesce(public.is_hub_admin(), false)
          or (v_who = 'lead' and exists (select 1 from jsonb_array_elements(public.onboarding_lead_view() -> 'people') p where (p ->> 'onboarding_id')::bigint = v_onb))) then
    raise exception 'Only their lead or HR can tick this';
  end if;
  select coalesce((select tm.name from public.team_members tm where lower(tm.email) = v_email limit 1), v_email) into v_by;
  update public.hr_setup_steps set done = coalesce(p_done, false), done_at = case when p_done then now() end, done_by = case when p_done then v_by end where id = p_step;
  return jsonb_build_object('ok', true, 'id', p_step, 'done', coalesce(p_done, false));
end $function$;
-- a lead (or HR) marks a help request as dealt with
create or replace function public.onboarding_help_resolve(p_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_onb bigint;
begin
  select h.onboarding_id into v_onb from public.onboarding_help h where h.id = p_id;
  if v_onb is null then raise exception 'That request was not found'; end if;
  if not (coalesce(public.is_hub_leader(), false)
          or exists (select 1 from jsonb_array_elements(public.onboarding_lead_view() -> 'people') p where (p ->> 'onboarding_id')::bigint = v_onb)) then
    raise exception 'Only their lead or HR can close this';
  end if;
  update public.onboarding_help set status = 'resolved' where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id);
end $function$;
revoke all on function public.onboarding_lead_view() from public, anon;
revoke all on function public.onboarding_lead_tick(bigint, boolean) from public, anon;
revoke all on function public.onboarding_help_resolve(bigint) from public, anon;
revoke all on function public.wa166_person_card(bigint, text) from public, anon, authenticated;
revoke all on function public.wa166_onb_sync(bigint) from public, anon, authenticated;
revoke all on function public.wa166_path_state(bigint, text) from public, anon, authenticated;
revoke all on function public.wa166_training_done(bigint, bigint) from public, anon, authenticated;
grant execute on function public.onboarding_lead_view() to authenticated;
grant execute on function public.onboarding_lead_tick(bigint, boolean) to authenticated;
grant execute on function public.onboarding_help_resolve(bigint) to authenticated;

-- 8. the plans in progress catch up with what their people already did in the Academy
select public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';

-- 9. Hub module 7 says how onboarding works now
update public.trainings set description = replace(description, 'HR manages onboarding and assigns trainings from the HR centre.',
    'HR manages onboarding and assigns trainings from the HR centre. Onboarding lives in the Hub now (no ClickUp): the plan runs week by week, the videos play inside the Hub, and many steps are Avenue Academy modules or Learning Avenues (the three everyone does, your team''s, one of your choice) that tick themselves when you finish them. Stuck on a step? Ask for help from the plan: HR and your lead see it. Leads see each person they are onboarding on Home: how far they are, what is late, and the moments that are the lead''s (introduce them, first tasks, the two-week and 30-day check-ins, the quizzes).'),
  updated_at = now()
  where id = 45 and position('Onboarding lives in the Hub now' in description) = 0 and position('HR manages onboarding and assigns trainings from the HR centre.' in description) > 0;

-- leads: the Leading a team lesson says where their people's onboarding lives now
update public.trainings t set body = jsonb_set(t.body, '{chapters}', (
    select jsonb_agg(case when c ->> 'id' = 'people' then jsonb_set(c, '{blocks}', (
        select jsonb_agg(case when b ->> 'type' = 'cards' then jsonb_set(b, '{items}', (b -> 'items') || jsonb_build_array(jsonb_build_object(
                 't', 'Follow their plan on Home',
                 'd', 'Everyone you are onboarding shows on your Home in the Hub: how far they are, what is late, their help requests, and your moments (introduce them, first tasks, the two-week check-in, the quizzes, the 30-day evaluation). Tick yours there.',
                 'icon', 'list'))) else b end order by bi)
        from jsonb_array_elements(c -> 'blocks') with ordinality as x(b, bi))) else c end order by ci)
    from jsonb_array_elements(t.body -> 'chapters') with ordinality as y(c, ci))),
  updated_at = now()
  where t.id = 197 and jsonb_typeof(t.body -> 'chapters') = 'array' and position('Follow their plan on Home' in t.body::text) = 0;

-- the onboarding email HR sends (the Welcome kit's template): no ClickUp or Keela, the real setup video (public on Loom), the Hub,
-- and no fixed password in the email (the first password is shared one to one, as the HR setup step and the People and HR
-- training say)
update public.app_config set value = $tpl$Dear {{first_name}},

Congratulations and welcome to the team at Welfare Avenue!

We're excited you've accepted the {{job_title}} role within our organization.

Your official start date is {{start_date}}, and we can't wait to have you on board. Before then, we'll meet on {{prep_day}} for two short sessions:
- {{session_1}}
- {{session_2}}

To get started, please complete the following steps:

1. Activate your Welfare Avenue Google account:
   - Watch this video to set it up: https://www.loom.com/share/522090b198054eb4aab13e0365efadf6 (or see Google's first-time sign-in FAQ: https://support.google.com/a/users/answer/9388045)
   - Email: {{wa_email}}
   - Your temporary password comes to you separately; you'll be asked to change it when you first sign in.

2. Accept your platform invitations. Each invite will arrive in your new {{wa_email}} inbox. Please accept each one; if you've never used a platform before, the linked FAQ walks you through joining:
   - Slack, the Welfare Avenue workspace: https://slack.com/help/articles/212675257-Join-a-Slack-workspace
   - Loom, where our meetings and training videos are recorded: https://support.loom.com/hc/en-us/articles/4404288978579-Join-a-Workspace
   - Canva, our design and graphics tool: https://www.canva.com/help/join-team/

3. Open the Hub, where Welfare Avenue's work lives: https://wa-exec-dashboard.netlify.app
   Sign in with your Welfare Avenue Google account. Your onboarding plan is waiting in the Avenue Academy, week by week, with the videos inside.

4. Sign your contract, sent via DocuSign to your personal email: https://support.docusign.com/s/articles/How-do-I-sign-a-DocuSign-document-Basic-Signing

5. Review your job description and note any questions you'd like to discuss during your onboarding session.

If you run into any technical issues or have questions, please don't hesitate to reach out; we're here to make your onboarding smooth and welcoming.

Looking forward to seeing all the great work you'll do with us!

Warmly,

{{sender_name}}
Welfare Avenue$tpl$, updated_at = now()
  where key = 'onboarding_email_template' and position('ClickUp' in coalesce(value, '')) > 0;

-- 10. what the columns mean
comment on column public.onboarding_template.academy_path is 'wave166: the step is done in the Avenue Academy, by finishing a Learning Avenue: an academy_paths key, ''team'' (one of the avenues of the person''s team, or any avenue when their team has none) or ''any'' (an avenue besides the three everyone does and the one that counted for ''team''). The step ticks itself (wa166_onb_sync, trg_wa166_tp_onb).';
comment on column public.onboarding_template.training_id is 'wave166: the step is done in the Avenue Academy, by finishing this module (trainings.id). The step ticks itself (wa166_onb_sync, trg_wa166_tp_onb).';
comment on column public.hr_setup_template.who is 'wave166: who does the step: hr (HR, before day one and on the onboarding call) or lead (the person''s lead: they see and tick it on Home, onboarding_lead_view and onboarding_lead_tick).';
comment on column public.hr_setup_template.due_day is 'wave166: when the step is due, in days after the onboarding started (0 = on the first day).';
comment on function public.wa166_path_state(bigint, text) is 'wave166: how far a person (team_members.id) is in a Learning Avenue: {key, title, done, total, complete, asked}. ''team'': the avenue of their team they are furthest in (any avenue besides the three everyone does when their team has none); ''any'': an avenue besides the three everyone does and besides the one that counted for ''team''. Keela, page tours, Your first week and planned trainings do not count there.';
comment on function public.wa166_training_done(bigint, bigint) is 'wave166: whether a person (team_members.id) finished an Academy module.';
comment on function public.wa166_onb_sync(bigint) is 'wave166: ticks the steps of an active onboarding that were done in the Avenue Academy (a module or an avenue). Called by trg_wa166_tp_onb and onboarding_assign; the plan completes itself when its last step is ticked (trg_wa166_onb_done).';
comment on function public.wa166_onb_done() is 'wave166: trigger on onboarding_steps: an onboarding completes when its last active step is ticked, and opens again when a step is unticked.';
comment on function public.wa166_person_card(bigint, text) is 'wave166: one onboarding as a lead sees it: the plan by week, what is late and next, the lead''s moments, open help requests and the avenues. Only through onboarding_lead_view.';
comment on function public.onboarding_lead_view() is 'wave166: the signed-in lead''s people with an onboarding in progress: those who report to them in the org chart, or without a manager there the leaders of their team, or without either the admins. Home shows it.';
comment on function public.onboarding_lead_tick(bigint, boolean) is 'wave166: a lead ticks one of their moments (an HR setup step whose who is lead) for a person they are onboarding; admins can tick any step.';
comment on function public.onboarding_help_resolve(bigint) is 'wave166: the person''s lead or a leader marks a help request on an onboarding step as dealt with.';
