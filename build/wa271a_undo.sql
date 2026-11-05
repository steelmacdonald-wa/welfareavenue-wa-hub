-- Welfare Avenue Hub: wave271 (271a) undo, 01/11/26. Reverses build/wa271a_onboard.sql and, first, build/wa271b_remind.sql (section 0): drops the onboarding flow objects, puts the two-argument
-- onboarding_assign back exactly as live had it, and restores the onboarding call checklist to day 3. Safe to run twice.
-- It does NOT touch hub_candidates.accepted_on, start_date or any other candidate data. It does drop the flows, grids and step results (and the two offer date columns),
-- so run it only when the wave is being backed out; anything HR set up on the Ready list is lost.

-- 0. wave271b (build/wa271b_remind.sql), first, while the tables it touches still exist: the hourly job, its function, the three notification kinds and the two
--    manager-link columns. The hub_notifications_sent rows already logged stay (they are a record, and nothing reads the kind from the registry to show them).
do $undo$
begin
  if to_regclass('cron.job') is not null and exists (select 1 from cron.job where jobname = 'wa-onboard-remind') then perform cron.unschedule('wa-onboard-remind'); end if;
end $undo$;
drop function if exists public.wa271_remind();
delete from public.hub_notification_kinds where key in ('onboard_date', 'onboard_grid', 'onboard_remind');
drop index if exists public.hub_onboard_flows_manager_link_idx;
alter table if exists public.hub_onboard_flows drop column if exists manager_link_sent_at;
alter table if exists public.hub_onboard_flows drop column if exists manager_link_member_id;

-- 0b. wave271c (build/wa271c_card.sql): the lead's card goes back to the wa167c body, with no starts_on
create or replace function public.wa166_person_card(p_onb bigint, p_via text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with ob as (
    select o.id, o.member_id, o.person_name, o.started_at, o.status, tm.email, tm.department, nullif(tm.avatar_url, '') as avatar_url,
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
    'onboarding_id', ob.id, 'member_id', ob.member_id, 'name', ob.person_name, 'email', ob.email, 'department', ob.department, 'title', ob.title, 'via', p_via, 'avatar_url', ob.avatar_url,
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
revoke all on function public.wa166_person_card(bigint, text) from public, anon, authenticated;
comment on function public.wa166_person_card(bigint, text) is 'wave166: one onboarding as a lead sees it: the plan by week, what is late and next, the lead''s moments, open help requests and the avenues. Only through onboarding_lead_view.';

-- 1. the accept trigger and its function
drop trigger if exists wa271_cand_accepted on public.hub_candidates;
drop function if exists public.wa271_cand_accepted();

-- 2. the tables (grids and steps go with their flow; their policies go with them)
drop table if exists public.hub_onboard_steps;
drop table if exists public.hub_onboard_grids;
drop table if exists public.hub_onboard_flows;

-- 3. the functions
drop function if exists public.wa271_ready_list();
drop function if exists public.wa271_default_manager(bigint);
drop function if exists public.wa271_move_start(bigint, date);
drop function if exists public.wa271_can();

-- 4. onboarding_assign: the two-argument version, as it was (v_start is today again), with its old grants
drop function if exists public.onboarding_assign(bigint, text, date);
create or replace function public.onboarding_assign(p_member_id bigint, p_by text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_name text; v_start date := current_date;
begin
  if not public.is_wa_staff() then raise exception 'Only staff can start an onboarding plan'; end if;   -- audit 26/09/26
  select name into v_name from public.team_members where id = p_member_id;
  if v_name is null then raise exception 'member not found'; end if;
  insert into public.onboardings (member_id, person_name, assigned_by, started_at)
  values (p_member_id, v_name, p_by, v_start) returning id into v_id;
  insert into public.onboarding_steps (onboarding_id, template_id, due_date)
  select v_id, t.id, public.onb_due(t.section, v_start) from public.onboarding_template t where t.active on conflict do nothing;
  insert into public.hr_setup_steps (onboarding_id, template_id)
  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  perform public.wa166_onb_sync(v_id);   -- wave166: what they already did in the Avenue Academy is ticked
  return v_id;
end $function$;
revoke all on function public.onboarding_assign(bigint, text) from public, anon;
grant execute on function public.onboarding_assign(bigint, text) to authenticated, service_role;
comment on function public.onboarding_assign(bigint, text) is 'Starts an HR onboarding plan for a roster member: creates the onboardings row, copies the onboarding_template steps with due dates, and copies the hr_setup_template steps. p_by is stored as given. Staff only (checked inside). Called by the page (HR centre). Access: authenticated.';

-- 5. the offer date columns, the settings and the checklist day
alter table public.hub_candidates drop column if exists offer_respond_by;
alter table public.hub_candidates drop column if exists offer_start;
delete from public.app_config where key in ('onboard_grid_days', 'onboard_grid_start', 'onboard_grid_end', 'onboard_grid_cell_min', 'onboard_call_min', 'onboard_one_on_one_min',
  'onboard_remind_hours', 'onboard_password_days', 'onboard_auto_google', 'onboard_auto_slack', 'onboard_slack_join_link', 'onboard_google_video');
update public.hr_setup_template set due_day = 3 where phase = 'The onboarding call' and due_day = 0;
delete from public.app_config where key = 'onboard_grid_min_hours';   -- wave271d (build/wa271d_min_hours.sql)
