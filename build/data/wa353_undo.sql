-- wave353 undo (only if needed). Run in the SQL editor. Reverses wa353b's data, then wa353a's schema.
-- The page: put back the site_files backup site_files_bak_wa353 (made by the release) and call host-sync.

-- data: projects and events created by wave353
delete from public.project_milestones where created_by = 'wave353';
update public.fund_events set project_id = null where project_id in (select id from public.projects where name in
  ('Partner Collaborations', 'Monthly Impact Numbers', 'Sponsorships', 'Resource Guide for the People We Serve', 'Corporate Cook-Off 2027',
   'Golf Tournament 2027', 'Women''s Day Fundraiser 2027', '5 Days for the Homeless 2027', 'Flag Football 2027', 'Rally Paper 2027'));
delete from public.projects where name in
  ('Partner Collaborations', 'Monthly Impact Numbers', 'Sponsorships', 'Resource Guide for the People We Serve', 'Corporate Cook-Off 2027',
   'Golf Tournament 2027', 'Women''s Day Fundraiser 2027', '5 Days for the Homeless 2027', 'Flag Football 2027', 'Rally Paper 2027')
  and not exists (select 1 from public.dept_tasks t where t.project_id = projects.id);
update public.projects set goal_id = 42, milestone_id = null where id = 7;
update public.projects set goal_id = null, milestone_id = null where id in (16, 49);
delete from public.fund_events where source = 'leadership meeting 10 Nov 2026' and created_by = 'wave353';
update public.fund_events set title = 'Sports Tournament' where id = 11 and title = 'Golf Tournament 2027';
update public.fund_events set goal_id = null, milestone_id = null;

-- milestones added by wave353, and the measures put on existing ones
update public.projects set milestone_id = null where milestone_id in (select id from public.goal_milestones where updated_by = 'wave353');
delete from public.goal_milestones where updated_by = 'wave353' and sort > 100;
update public.goal_milestones set measure_key = null, target_value = null, quarter = null;
update public.goal_milestones set archived_at = null where id = 54;

-- owners and contributors
update public.goal_owners set removed_at = null where goal_id = 80 and member_id = 38;
update public.goal_owners set removed_at = now() where goal_id = 80 and member_id = 3 and added_by = 'wave353';
update public.goal_owners set is_lead = false where goal_id = 81 and member_id = 17;
update public.goal_owners set is_lead = true where goal_id = 81 and member_id = 38;
update public.goal_year_targets set owners = 'Ian, Suhaib' where goal_id = 80 and fy = 'FY27';
update public.goal_year_targets set owners = 'Suhaib, Ian' where goal_id = 81 and fy = 'FY27';
update public.goals set measure = 'Volunteers returning next year' where id = 80;
-- Goal 5's reworded milestones and why are NOT put back: the old words broke the confidentiality rule.

-- schema
drop function if exists public.wa353_measures();
drop function if exists public.strategy_link_milestones(bigint, bigint[]);
drop function if exists public.strategy_milestone_meta(bigint, smallint, text, numeric);
drop function if exists public.strategy_contributor_set(bigint, bigint, boolean, text);
drop function if exists public.strategy_link_event(bigint, bigint, bigint);
drop table if exists public.project_milestones;
drop table if exists public.goal_measures;
drop table if exists public.goal_contributors;
alter table public.fund_events drop column if exists goal_id, drop column if exists milestone_id;
alter table public.goal_milestones drop constraint if exists goal_milestones_quarter_chk;
alter table public.goal_milestones drop column if exists quarter, drop column if exists measure_key, drop column if exists target_value;
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'database', 'wave353 undo', null, 'wave353 taken back', 'wave353');
