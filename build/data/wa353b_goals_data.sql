-- wave353b (18/11/26): the goals ecosystem, data.
-- Sources: the leadership meeting of 10 Nov 2026 (Ian and Kahkashan's marketing goals, Amanda's 2027 events),
-- the 16 Nov Fundraising & Marketing session (Steel and Ian on goal 3 and goal 4 measures), and Steel's decisions
-- of 17 Nov: "Key events", years FY27 to FY29 on view with the SMART text unchanged, co-EDs own and leads contribute.
-- Goals: 78 Feed more people, 79 Go beyond the meal, 80 Grow a community that stays, 81 Build funding that lasts, 82 Run on systems.
-- Team members: 3 Shima, 17 Ian, 38 Suhaib; 1 Ahmed, 4 Brianna, 9 Tate, 16 Karan, 18 Kahkashan, 20 Eduardo, 23 Soraya,
-- 27 Amanda, 60 Albert, 61 Adelina, 62 Vatsala.

-- 1. Owners, as the co-executive model has it.
update public.goal_owners set focus = 'Montreal operations and program development' where goal_id = 78 and member_id = 3 and removed_at is null;
update public.goal_owners set focus = 'Ontario operations' where goal_id = 78 and member_id = 38 and removed_at is null;
update public.goal_owners set focus = 'Program development' where goal_id = 79 and member_id = 3 and removed_at is null;
update public.goal_owners set focus = 'Marketing: the community, content and partners' where goal_id = 80 and member_id = 17 and removed_at is null;
update public.goal_owners set removed_at = now() where goal_id = 80 and member_id = 38 and removed_at is null;
insert into public.goal_owners (goal_id, member_id, is_lead, focus, sort, added_by)
  select 80, 3, false, 'Volunteers at our servings', 2, 'wave353' where not exists (select 1 from public.goal_owners where goal_id = 80 and member_id = 3 and removed_at is null);
update public.goal_owners set is_lead = true, focus = 'Donors, events, sponsorships and the Ad Grant' where goal_id = 81 and member_id = 17 and removed_at is null;
update public.goal_owners set is_lead = false, focus = 'Grants and finance' where goal_id = 81 and member_id = 38 and removed_at is null;
update public.goal_owners set focus = 'Finance and grants' where goal_id = 82 and member_id = 38 and removed_at is null;
update public.goal_owners set focus = 'The Hub for marketing and fundraising' where goal_id = 82 and member_id = 17 and removed_at is null;
update public.goal_owners set focus = 'The Hub for operations and programs' where goal_id = 82 and member_id = 3 and removed_at is null;
update public.goal_year_targets set owners = 'Ian, Shima' where goal_id = 80 and fy = 'FY27';
update public.goal_year_targets set owners = 'Ian, Suhaib' where goal_id = 81 and fy = 'FY27';

-- 2. Contributors: the leads whose teams carry each goal.
insert into public.goal_contributors (goal_id, member_id, focus, sort, added_by) values
  (78, 1, 'Montreal operations', 1, 'wave353'), (78, 61, 'Montreal operations', 2, 'wave353'),
  (78, 9, 'Toronto servings', 3, 'wave353'), (78, 16, 'Toronto operations', 4, 'wave353'),
  (79, 4, 'Resources and feedback from the people we serve', 1, 'wave353'), (79, 62, 'Program development', 2, 'wave353'),
  (80, 18, 'Marketing and content', 1, 'wave353'), (80, 23, 'Newsletters and email', 2, 'wave353'), (80, 1, 'The volunteer experience', 3, 'wave353'),
  (81, 27, 'Fundraising events', 1, 'wave353'), (81, 60, 'Sponsorships and the donor program', 2, 'wave353'),
  (82, 20, 'Brand and website', 1, 'wave353')
on conflict (goal_id, member_id) do nothing;

-- 3. Goal 5 wording: nothing on a page every staff member reads may name a leadership change or an HR matter
--    (Steel's standing rule). Their old words are taken out of the goal's history too.
update public.goal_milestones set body = 'Half of leadership roles written, each with a trained backup' where id = 44 and body = 'Executive transition complete';
update public.goal_milestones set body = 'FY27 budget and a city funding rule in the Hub' where id = 45 and body = 'HR seat filled';
update public.goal_year_targets set body = 'Half of leadership roles written with a trained backup; FY27 budget and a city funding rule in the Hub; Keela retired; every role written'
  where goal_id = 82 and fy = 'FY27';
update public.goals set why = 'Many roles turn over each school year, and the work has grown past what a few people can carry in their heads.' where id = 82;
delete from public.goal_history where goal_id = 82 and (coalesce(old_value, '') ~* '(transition|HR seat|founder)' or coalesce(new_value, '') ~* '(transition|HR seat|founder)');

-- 4. Goal 3 measures the community that comes back (Steel and Ian, 16 Nov). The SMART statement stays as the board has it.
update public.goals set measure = 'Community that comes back: returning volunteers, donors and readers' where id = 80;

-- 5. The live measures each goal shows.
insert into public.goal_measures (goal_id, key, label, unit, source, target_fy27, is_headline, sort) values
  (78, 'meals_fy', 'Meals served this year', 'meals', 'Servings, the Volunteer Manager and the tally', 3000, true, 1),
  (78, 'servings_fy', 'Servings held this year', 'servings', 'The Volunteer Manager', null, false, 2),
  (78, 'toronto_servings_fy', 'Toronto servings this year', 'servings', 'The Volunteer Manager', null, false, 3),
  (78, 'people_served_fy', 'People counted on the tally', 'people', 'The tally at servings', null, false, 4),
  (79, 'conversations_fy', 'Real conversations with people we serve', 'conversations', 'Community lead debriefs', null, true, 1),
  (79, 'clothing_fy', 'Clothing items given', 'items', 'Community lead debriefs', null, false, 2),
  (79, 'feedback_fy', 'Survey answers this year', 'answers', 'Program Builder surveys', null, false, 3),
  (80, 'community_back', 'Community that comes back', 'people', 'Volunteers, the CRM and email', null, true, 1),
  (80, 'vol_returning_6m', 'Returning volunteers (6 months)', 'people', 'The Volunteer Manager', null, false, 2),
  (80, 'vol_unique_fy', 'Volunteers this year', 'people', 'The Volunteer Manager', 110, false, 3),
  (80, 'donors_back', 'Returning donors (6 months)', 'donors', 'The CRM', null, false, 4),
  (80, 'email_openers', 'Repeat email readers (90 days)', 'readers', 'Email in the CRM (Resend)', null, false, 5),
  (80, 'followers', 'Followers', 'followers', 'Instagram, Facebook, LinkedIn', null, false, 6),
  (80, 'web_returning_30d', 'Returning website visitors (30 days)', 'visitors', 'Google Analytics', null, false, 7),
  (81, 'raised_fy', 'Raised this year', '$', 'The CRM and Grants', 25000, true, 1),
  (81, 'avg_month_6m', 'Gifts a month (6-month average)', '$', 'The CRM', null, false, 2),
  (81, 'monthly_donors', 'Monthly donors', 'donors', 'The CRM', 25, false, 3),
  (81, 'events_raised_fy', 'Raised by events this year', '$', 'The Fundraising app', 10000, false, 4),
  (81, 'grants_awarded_fy', 'Grants awarded this year', '$', 'The Fundraising app: Grants', null, false, 5),
  (82, 'projects_linked_pct', 'Projects serving a goal', '%', 'Projects', null, true, 1),
  (82, 'overdue_tasks', 'Open tasks past due', 'tasks', 'Every team''s tasks', null, false, 2)
on conflict (key) do nothing;

-- 6. Live measures on the milestones that are numbers.
update public.goal_milestones set measure_key = 'meals_fy', target_value = 3000 where id = 2;
update public.goal_milestones set measure_key = 'meals_fy', target_value = 3500 where id = 3;
update public.goal_milestones set measure_key = 'meals_fy', target_value = 4000 where id = 5;
update public.goal_milestones set measure_key = 'meals_fy', target_value = 6000 where id = 8;
update public.goal_milestones set measure_key = 'toronto_servings_fy', target_value = 12 where id = 4;
update public.goal_milestones set measure_key = 'vol_unique_fy', target_value = 110 where id = 18;
update public.goal_milestones set measure_key = 'vol_unique_fy', target_value = 130 where id = 21;
update public.goal_milestones set measure_key = 'vol_unique_fy', target_value = 150 where id = 23;
update public.goal_milestones set measure_key = 'vol_unique_fy', target_value = 250 where id = 25;
update public.goal_milestones set measure_key = 'raised_fy', target_value = 25000 where id = 26;
update public.goal_milestones set measure_key = 'monthly_donors', target_value = 25 where id = 28;
update public.goal_milestones set measure_key = 'raised_fy', target_value = 40000 where id = 32;
update public.goal_milestones set measure_key = 'raised_fy', target_value = 60000 where id = 36;
update public.goal_milestones set measure_key = 'monthly_donors', target_value = 100 where id = 39;
update public.goal_milestones set measure_key = 'raised_fy', target_value = 100000 where id = 41;
update public.goal_milestones set quarter = 1 where id = 46;                  -- Keela retired (closes 5 December)
update public.goal_milestones set archived_at = now() where id = 54 and coalesce(body, '') = '';   -- an empty FY28 milestone on goal 2

-- 7. The milestones from the 10 Nov leadership meeting and the 16 Nov session (FY27, in quarters).
create temporary table w353_ms (tag text, goal_id bigint, fy text, quarter smallint, body text, status text, measure_key text, target_value numeric);
insert into w353_ms values
  ('toronto_site', 78, 'FY27', 2, 'Toronto serving at its own site (Metropolitan United Church)', 'in progress', null, null),
  ('guide',        79, 'FY27', 3, 'A resource guide for the people we serve, shaped by their feedback', 'in progress', null, null),
  ('community',    80, 'FY27', 2, 'Our returning community counted live in the Hub and read each month', 'in progress', 'community_back', null),
  ('collabs',      80, 'FY27', 4, '12 collaborative pieces with partners (joint posts, interviews, takeovers)', 'not started', null, null),
  ('film',         80, 'FY28', null, 'A professionally produced Welfare Avenue film for Montreal and Toronto', 'not started', null, null),
  ('ads_lead',     81, 'FY27', 2, 'An ad specialist running our Google Ad Grant and Meta ads', 'not started', null, null),
  ('ads_1000',     81, 'FY27', 3, 'First $1,000 raised through digital ads', 'not started', null, null),
  ('donors_10',    81, 'FY27', 3, '10 monthly donors by June', 'not started', 'monthly_donors', 10),
  ('events',       81, 'FY27', 4, 'Fundraising events raise $10,000 (stretch: $20,000)', 'in progress', 'events_raised_fy', 10000),
  ('content_hub',  82, 'FY27', 1, 'Content planned, scheduled and answered from the Hub', 'done', null, null),
  ('impact',       82, 'FY27', 2, 'Monthly impact numbers shared with marketing, fundraising and grants', 'not started', null, null);
create temporary table w353_msid (tag text primary key, id bigint);
with ins as (
  insert into public.goal_milestones (goal_id, fy, sort, body, status, quarter, measure_key, target_value, updated_by)
  select w.goal_id, w.fy, 100 + row_number() over (), w.body, w.status, w.quarter, w.measure_key, w.target_value, 'wave353'
  from w353_ms w
  where not exists (select 1 from public.goal_milestones m where m.goal_id = w.goal_id and m.body = w.body and m.archived_at is null)
  returning id, body
) insert into w353_msid select w.tag, ins.id from ins join w353_ms w on w.body = ins.body;
insert into w353_msid select w.tag, m.id from w353_ms w join public.goal_milestones m on m.goal_id = w.goal_id and m.body = w.body and m.archived_at is null
  on conflict (tag) do nothing;

-- 8. Key events: Amanda's 2027 events (10 Nov) and this season's drives, flowing into goal 4.
update public.fund_events set title = 'Golf Tournament 2027', notes = trim(both from concat_ws(E'\n', notes, 'April or May 2027; a sports fundraiser that reaches beyond students (leadership meeting, 10 Nov 2026).'))
  where id = 11 and title = 'Sports Tournament';
update public.fund_events set notes = trim(both from concat_ws(E'\n', notes, 'Back for a third year with MFL (leadership meeting, 10 Nov 2026).')) where id = 13 and coalesce(notes, '') not ilike '%third year%';
update public.fund_events set notes = trim(both from concat_ws(E'\n', notes, 'Companies compete to raise the most and cook and serve with us; there is an SOP, and Jamila has run one. Weigh the trade-off Tate raised: corporate partners can put off mutual aid groups; student clubs are the fallback (10 Nov 2026).'))
  where id = 9 and coalesce(notes, '') not ilike '%mutual aid%';
update public.fund_events set notes = trim(both from concat_ws(E'\n', notes, 'With Concordia clubs (10 Nov 2026).')) where id = 7 and coalesce(notes, '') not ilike '%Concordia clubs%';
insert into public.fund_events (title, season, start_date, status, partners, notes, source, created_by)
select x.title, x.season, x.start_date, x.status, x.partners, x.notes, 'leadership meeting 10 Nov 2026', 'wave353'
from (values
  ('5 Days for the Homeless 2027', 'winter-2027', date '2027-03-01', 'planned', 'CASA, Concordia', 'Every year with CASA at Concordia.'),
  ('Thrifted Fashion Show', 'fall-2027', date '2027-10-15', 'idea', 'Salvation Army, Renaissance', 'Thrift stores donate clothes, a ticketed show, then the clothes feed the Gift Basket Drive.'),
  ('Toronto fundraiser 2027', 'summer-2027', null, 'idea', null, 'Tate has early concepts for a Toronto fundraiser in 2027.'),
  ('Super Smash Bros. tournament', 'backlog', null, 'idea', null, 'Tate''s idea at the 10 Nov leadership meeting.')
) as x(title, season, start_date, status, partners, notes)
where not exists (select 1 from public.fund_events f where f.title = x.title);
update public.fund_events f set goal_id = 81,
  milestone_id = case when f.season in ('winter-2027', 'spring-2027', 'summer-2027') or f.start_date between '2026-10-01' and '2027-09-30' then (select id from w353_msid where tag = 'events') else null end
where f.goal_id is null and f.season <> 'backlog' and f.title <> 'Super Smash Bros. tournament';

-- 9. Projects: created or updated from the meetings.
create temporary table w353_pj (tag text, department text, parent_id bigint, name text, description text, leads jsonb, workstream text, goal_id bigint, ms_tag text, fe_title text);
insert into w353_pj values
  ('collabs', 'marketing', null, 'Partner Collaborations', 'At least 12 collaborative pieces in FY27 with Montreal nonprofits and community groups: joint posts, interviews, story takeovers. Plan themed months 6 to 8 weeks ahead (March is Nutrition Month). Start with the partners program development, fundraising and Toronto already know, and favour apolitical partners (Tate, 10 Nov).', '["Ian", "Kahkashan"]', 'Social media', 80, 'collabs', null),
  ('impact', 'marketing', null, 'Monthly Impact Numbers', 'A monthly routine (SOP) that turns what operations and program development already collect (meals, repeat visits, donations, volunteer and beneficiary feedback) into numbers marketing, fundraising and grant writing all use, on Instagram, TikTok and LinkedIn.', '["Ian"]', null, 82, 'impact', null),
  ('sponsors', 'fundraising', null, 'Sponsorships', 'Corporate sponsors and partners who give through the year; Albert leads, with the donor program beside it.', '["Albert"]', 'Sponsorships', 81, null, null),
  ('guide', 'progdev', null, 'Resource Guide for the People We Serve', 'A pamphlet that is useful to the people we serve: our schedule and place, and where to go for help in between. Shaped by what they tell community leads at servings (Brianna, 10 Nov).', '["Brianna"]', null, 79, 'guide', null),
  ('ev_cook', 'fundraising', 2, 'Corporate Cook-Off 2027', 'Companies compete to raise the most and cook and serve with us. Use the SOP; Jamila has run one.', '["Amanda"]', 'Fundraising events', 81, 'events', 'Corporate Cook-Off'),
  ('ev_golf', 'fundraising', 2, 'Golf Tournament 2027', 'April or May 2027, before flag football.', '["Amanda"]', 'Fundraising events', 81, 'events', 'Golf Tournament 2027'),
  ('ev_women', 'fundraising', 2, 'Women''s Day Fundraiser 2027', 'With Concordia clubs, in the winter.', '["Amanda"]', 'Fundraising events', 81, 'events', 'Women''s Day Fundraiser'),
  ('ev_5days', 'fundraising', 2, '5 Days for the Homeless 2027', 'With CASA at Concordia, every year.', '["Amanda"]', 'Fundraising events', 81, 'events', '5 Days for the Homeless 2027'),
  ('ev_flag', 'fundraising', 2, 'Flag Football 2027', 'Third year with MFL.', '["Amanda"]', 'Fundraising events', 81, 'events', 'Flag Football 2027'),
  ('ev_rally', 'fundraising', 2, 'Rally Paper 2027', 'Very likely back, better than ever.', '["Amanda"]', 'Fundraising events', 81, 'events', 'Rally Paper 2027');
insert into public.projects (department, parent_id, name, description, status, goal_id, milestone_id, leads, workstream, sort, created_at, updated_at)
select p.department, p.parent_id, p.name, p.description, 'active', p.goal_id, (select id from w353_msid where tag = p.ms_tag), p.leads, p.workstream,
       coalesce((select max(sort) from public.projects where department = p.department), 0) + row_number() over (partition by p.department), now(), now()
from w353_pj p where not exists (select 1 from public.projects x where x.name = p.name and x.banked_at is null);
update public.fund_events f set project_id = x.id from w353_pj p join public.projects x on x.name = p.name
  where p.fe_title is not null and f.title = p.fe_title and f.project_id is null;

-- existing projects linked to the goals and milestones they serve
update public.projects set goal_id = 80, milestone_id = (select id from w353_msid where tag = 'film'),
  description = coalesce(nullif(description, ''), 'A professionally produced film for Montreal and Toronto, with videographer Wentz (through Tate): the first thing a new visitor sees.')
  where id = 7;                                            -- WA Intro Video (it served a retired goal)
update public.projects set goal_id = 80, milestone_id = (select id from w353_msid where tag = 'community') where id = 49 and goal_id is null;   -- Content
update public.projects set goal_id = 78, milestone_id = (select id from w353_msid where tag = 'toronto_site') where id = 16 and goal_id is null;  -- General Ops Toronto
insert into public.project_milestones (project_id, milestone_id, created_by)
select x.pid, m.id, 'wave353' from (values
  (7, 'film'), (49, 'community'), (16, 'toronto_site'),
  (15, 'ads_lead'), (15, 'ads_1000'),
  (1, 'donors_10'),
  (2, 'events'), (13, 'events'), (25, 'events')
) as x(pid, tag) join w353_msid m on m.tag = x.tag
where exists (select 1 from public.projects where id = x.pid)
on conflict do nothing;
insert into public.project_milestones (project_id, milestone_id, created_by) select 1, 28, 'wave353' where exists (select 1 from public.goal_milestones where id = 28) on conflict do nothing;
insert into public.project_milestones (project_id, milestone_id, created_by)
  select x.id, m.id, 'wave353' from w353_pj p join public.projects x on x.name = p.name join w353_msid m on m.tag = p.ms_tag where p.ms_tag is not null
  on conflict do nothing;
update public.projects p set milestone_id = (select pm.milestone_id from public.project_milestones pm join public.goal_milestones m on m.id = pm.milestone_id
    where pm.project_id = p.id and m.goal_id = p.goal_id order by m.fy, coalesce(m.quarter, 9), m.id limit 1)
  where p.milestone_id is null and exists (select 1 from public.project_milestones pm where pm.project_id = p.id);

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'database', 'wave353', null, 'the goals ecosystem: Key events, many milestones per project, live measures, contributors, FY27 quarters; data from the 10 Nov leadership meeting and the 16 Nov session', 'wave353');

drop table if exists w353_ms; drop table if exists w353_msid; drop table if exists w353_pj;
