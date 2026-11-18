-- wave353a (18/11/26): the goals ecosystem, schema and functions.
-- Steel (17/11/26), from the 10 Nov leadership meeting and the 16 Nov session with Ian:
--   projects link to many milestones; fundraising events flow into the goals as Key events; each goal shows
--   live measures pulled from the Hub; goals carry contributors beside their owners; milestones sit in quarters.

-- 1. Milestones: a quarter (FY27 opens into Q1 to Q4) and an optional live measure with a target.
alter table public.goal_milestones
  add column if not exists quarter smallint,
  add column if not exists measure_key text,
  add column if not exists target_value numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'goal_milestones_quarter_chk') then
    alter table public.goal_milestones add constraint goal_milestones_quarter_chk check (quarter is null or quarter between 1 and 4);
  end if;
end $$;

-- 2. Key events: a fundraising event serves a goal (and optionally one of its milestones).
alter table public.fund_events
  add column if not exists goal_id bigint references public.goals(id) on delete set null,
  add column if not exists milestone_id bigint references public.goal_milestones(id) on delete set null;

-- 3. A project serves many milestones.
create table if not exists public.project_milestones (
  project_id bigint not null references public.projects(id) on delete cascade,
  milestone_id bigint not null references public.goal_milestones(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (project_id, milestone_id)
);
alter table public.project_milestones enable row level security;
drop policy if exists project_milestones_read on public.project_milestones;
create policy project_milestones_read on public.project_milestones for select using (public.is_wa_staff() or public.is_board_viewer());
grant select on public.project_milestones to authenticated;
insert into public.project_milestones (project_id, milestone_id, created_by)
  select p.id, p.milestone_id, 'wave353' from public.projects p join public.goal_milestones m on m.id = p.milestone_id
  where p.milestone_id is not null and m.archived_at is null
  on conflict do nothing;

-- 4. The live measures each goal shows (the numbers come from wa353_measures()).
create table if not exists public.goal_measures (
  id bigserial primary key,
  goal_id bigint not null references public.goals(id) on delete cascade,
  key text not null unique,
  label text not null,
  unit text,
  source text,
  target_fy27 numeric,
  is_headline boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz
);
alter table public.goal_measures enable row level security;
drop policy if exists goal_measures_read on public.goal_measures;
create policy goal_measures_read on public.goal_measures for select using (public.is_wa_staff() or public.is_board_viewer());
grant select on public.goal_measures to authenticated;

-- 5. Contributors: the leads whose teams carry a goal (they comment; owners and admins edit).
create table if not exists public.goal_contributors (
  id bigserial primary key,
  goal_id bigint not null references public.goals(id) on delete cascade,
  member_id bigint not null references public.team_members(id),
  focus text,
  sort integer not null default 0,
  added_at timestamptz not null default now(),
  added_by text,
  removed_at timestamptz,
  unique (goal_id, member_id)
);
alter table public.goal_contributors enable row level security;
drop policy if exists goal_contributors_read on public.goal_contributors;
create policy goal_contributors_read on public.goal_contributors for select using (public.is_wa_staff() or public.is_board_viewer());
grant select on public.goal_contributors to authenticated;

-- 6. The live numbers. One call returns every measure: {key: {v, prev, note, tracked}}.
create or replace function public.wa353_measures()
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare
  t date := (now() at time zone 'America/Toronto')::date;
  fy0 date := make_date(case when extract(month from t) >= 10 then extract(year from t)::int else extract(year from t)::int - 1 end, 10, 1);
  r jsonb := '{}'::jsonb;
  v numeric; p numeric; n2 numeric; n3 numeric; opened bigint;
begin
  if not (public.is_wa_staff() or public.is_board_viewer()) then raise exception 'staff and board only'; end if;

  -- Goal 1: meals and servings this fiscal year (team leader's count, else the tally, else the plan)
  with ev as (
    select e.id, e.planned_meals, public.wa298_city(e.location) city from public.volunteer_events e
    where e.event_date between fy0 and t and e.kind in ('service', 'meal') and coalesce(e.status, '') <> 'cancelled'
  ), m as (
    select ev.id, ev.city, coalesce(
      (select max((s.answers->>'meals')::numeric) from public.volunteer_survey_responses s where s.event_id = ev.id and s.role = 'team_leader' and jsonb_typeof(s.answers->'meals') = 'number'),
      nullif((select count(*) from public.pb_tally x where x.event_id = ev.id), 0),
      ev.planned_meals, 0) meals
    from ev)
  select coalesce(sum(meals), 0), count(*), count(*) filter (where city = 'Toronto') into v, p, n2 from m;
  r := r || jsonb_build_object('meals_fy', jsonb_build_object('v', v, 'note', 'Team leaders count meals after each serving; else the tally, else the plan.'),
                               'servings_fy', jsonb_build_object('v', p), 'toronto_servings_fy', jsonb_build_object('v', n2));
  select count(*) into v from public.pb_tally where served_on between fy0 and t;
  r := r || jsonb_build_object('people_served_fy', jsonb_build_object('v', v, 'note', 'People counted on the tally at servings.'));

  -- Goal 2: feedback, clothing, conversations this fiscal year
  select count(*) into v from public.volunteer_survey_responses s join public.volunteer_events e on e.id = s.event_id where e.event_date between fy0 and t;
  r := r || jsonb_build_object('feedback_fy', jsonb_build_object('v', v, 'note', 'Survey answers from volunteers, team leaders and community leads.'));
  select coalesce(sum(case when jsonb_typeof(s.answers->'clothes_before') = 'number' and jsonb_typeof(s.answers->'clothes_after') = 'number'
                           then greatest(0, (s.answers->>'clothes_before')::numeric - (s.answers->>'clothes_after')::numeric) end), 0),
         coalesce(sum(case when jsonb_typeof(s.answers->'conversations') = 'number' then (s.answers->>'conversations')::numeric end), 0)
    into v, p
    from public.volunteer_survey_responses s join public.volunteer_events e on e.id = s.event_id
    where e.event_date between fy0 and t and s.role = 'community_debrief';
  r := r || jsonb_build_object('clothing_fy', jsonb_build_object('v', v), 'conversations_fy', jsonb_build_object('v', p));

  -- Goal 3: the community that comes back
  with served as (
    select er.person_id, e.event_date from public.event_roster er join public.volunteer_events e on e.id = er.event_id
    where er.person_id is not null and lower(coalesce(er.status, '')) = 'confirmed' and coalesce(e.status, '') <> 'cancelled' and e.event_date <= t)
  select (select count(*) from (select person_id from served where event_date > t - 182 group by person_id having count(distinct event_date) >= 2) a),
         (select count(*) from (select person_id from served where event_date > t - 212 and event_date <= t - 30 group by person_id having count(distinct event_date) >= 2) b),
         (select count(distinct person_id) from served where event_date >= fy0)
    into v, p, n2;
  r := r || jsonb_build_object('vol_returning_6m', jsonb_build_object('v', v, 'prev', p, 'note', 'People who served at two or more events in the last 6 months.'),
                               'vol_unique_fy', jsonb_build_object('v', n2, 'note', 'Different people confirmed at an event this fiscal year.'));
  n3 := v;
  select count(*) into v from (
    select contact_id from public.crm_donations where contact_id is not null and donated_at > now() - interval '182 days'
    intersect select contact_id from public.crm_donations where contact_id is not null and donated_at <= now() - interval '182 days') d;
  r := r || jsonb_build_object('donors_back', jsonb_build_object('v', v, 'note', 'Donors who gave in the last 6 months and before.'));
  n3 := n3 + v;
  select count(*) into opened from public.crm_email_events where type = 'email.opened';
  if opened = 0 then
    r := r || jsonb_build_object('email_openers', jsonb_build_object('v', null, 'tracked', false, 'note', 'Not tracked yet: turn on open tracking and the opened webhook in Resend.'));
  else
    select count(*) into v from (
      select payload->'data'->'to'->>0 em from public.crm_email_events
      where type = 'email.opened' and received_at > now() - interval '90 days' group by 1 having count(distinct resend_id) >= 2) o;
    r := r || jsonb_build_object('email_openers', jsonb_build_object('v', v, 'note', 'Readers who opened two or more of our emails in 90 days.'));
    n3 := n3 + v;
  end if;
  r := r || jsonb_build_object('community_back', jsonb_build_object('v', n3, 'note', 'Returning volunteers + returning donors + repeat email readers.'));
  select coalesce(sum(x.value), 0) into v from (
    select distinct on (platform) platform, value from public.social_daily
    where metric = 'followers' and platform in ('instagram', 'facebook', 'linkedin') order by platform, day desc) x;
  select coalesce(sum(x.value), 0) into p from (
    select distinct on (platform) platform, value from public.social_daily
    where metric = 'followers' and platform in ('instagram', 'facebook', 'linkedin') and day <= t - 30 order by platform, day desc) x;
  r := r || jsonb_build_object('followers', jsonb_build_object('v', v, 'prev', nullif(p, 0), 'note', 'Instagram, Facebook and LinkedIn followers.'));
  select coalesce(sum(case when metric = 'users' then value else 0 end) - sum(case when metric = 'new_users' then value else 0 end), 0) into v
    from public.social_daily where platform = 'ga4' and day > t - 30;
  select coalesce(sum(case when metric = 'users' then value else 0 end) - sum(case when metric = 'new_users' then value else 0 end), 0) into p
    from public.social_daily where platform = 'ga4' and day > t - 60 and day <= t - 30;
  r := r || jsonb_build_object('web_returning_30d', jsonb_build_object('v', greatest(v, 0), 'prev', greatest(p, 0), 'note', 'Returning website visitors, last 30 days (Google Analytics, by day).'));

  -- Goal 4: funding that lasts
  select coalesce(sum(amount - coalesce(refunded_amount, 0)), 0) into v from public.crm_donations where donated_at >= fy0;
  select coalesce(sum(amount_awarded), 0) into p from public.fund_grants where decided_on >= fy0 and amount_awarded > 0;
  r := r || jsonb_build_object('raised_fy', jsonb_build_object('v', v + p, 'note', 'Gifts in the CRM plus grants awarded, this fiscal year.'),
                               'grants_awarded_fy', jsonb_build_object('v', p));
  select coalesce(sum(amount - coalesce(refunded_amount, 0)), 0) / 6 into v from public.crm_donations where donated_at > now() - interval '182 days';
  select coalesce(sum(amount - coalesce(refunded_amount, 0)), 0) / 6 into p from public.crm_donations where donated_at > now() - interval '364 days' and donated_at <= now() - interval '182 days';
  r := r || jsonb_build_object('avg_month_6m', jsonb_build_object('v', round(v), 'prev', round(p), 'note', 'Average gifts a month over the last 6 months, against the 6 before.'));
  select count(*) into v from public.crm_gift_plans where lower(coalesce(status, '')) in ('active', 'trialing') and cancelled_at is null;
  r := r || jsonb_build_object('monthly_donors', jsonb_build_object('v', v, 'note', 'Active monthly gift plans.'));
  select coalesce(sum(raised), 0) into v from public.fund_events where coalesce(start_date, end_date) between fy0 and (fy0 + interval '1 year' - interval '1 day')::date;
  r := r || jsonb_build_object('events_raised_fy', jsonb_build_object('v', v, 'note', 'What this fiscal year''s events raised, as the fundraising team records it.'));

  -- Goal 5: systems, not heroes
  select count(*) filter (where goal_id is not null), count(*) into v, p from public.projects
    where banked_at is null and coalesce(is_general, false) = false and coalesce(status, 'active') = 'active';
  r := r || jsonb_build_object('projects_linked_pct', jsonb_build_object('v', case when p > 0 then round(100 * v / p) else 0 end, 'note', 'Projects (not the general ones) serving a goal.'));
  select count(*) into v from public.dept_tasks where coalesce(done, false) = false and banked_at is null and due_date < t;
  r := r || jsonb_build_object('overdue_tasks', jsonb_build_object('v', v, 'note', 'Open tasks past their due date, every team.'));

  return r || jsonb_build_object('_as_of', now());
end $f$;
grant execute on function public.wa353_measures() to authenticated;

-- 7. Link a project to many milestones (staff who can comment, as strategy_link_project).
create or replace function public.strategy_link_milestones(p_project bigint, p_milestones bigint[])
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare old_ids text; new_ids text; first_ms bigint; first_goal bigint; cur_goal bigint;
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff link projects.'; end if;
  if not exists (select 1 from public.projects p where p.id = p_project and p.banked_at is null) then raise exception 'That project is not there.'; end if;
  if exists (select 1 from unnest(coalesce(p_milestones, '{}')) x where not exists (
      select 1 from public.goal_milestones m join public.goals g on g.id = m.goal_id where m.id = x and m.archived_at is null and g.retired_at is null)) then
    raise exception 'One of those milestones is not there any more.';
  end if;
  select string_agg(milestone_id::text, ',' order by milestone_id) into old_ids from public.project_milestones where project_id = p_project;
  delete from public.project_milestones where project_id = p_project and not (milestone_id = any(coalesce(p_milestones, '{}')));
  insert into public.project_milestones (project_id, milestone_id, created_by)
    select p_project, x, public.wa_email() from unnest(coalesce(p_milestones, '{}')) x on conflict do nothing;
  select string_agg(milestone_id::text, ',' order by milestone_id) into new_ids from public.project_milestones where project_id = p_project;
  first_ms := (coalesce(p_milestones, '{}'))[1];
  select goal_id into cur_goal from public.projects where id = p_project;
  if first_ms is not null then
    select goal_id into first_goal from public.goal_milestones where id = first_ms;
    update public.projects set goal_id = coalesce(cur_goal, first_goal),
      milestone_id = case when coalesce(cur_goal, first_goal) = first_goal then first_ms
                          else (select m.id from public.goal_milestones m where m.id = any(p_milestones) and m.goal_id = cur_goal limit 1) end,
      updated_at = now() where id = p_project;
  else
    update public.projects set milestone_id = null, updated_at = now() where id = p_project;
  end if;
  if coalesce(old_ids, '') <> coalesce(new_ids, '') then
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('project', p_project::text, 'milestones', old_ids, new_ids, public.wa_email());
  end if;
  return jsonb_build_object('ok', true, 'milestones', coalesce(new_ids, ''));
end $f$;
grant execute on function public.strategy_link_milestones(bigint, bigint[]) to authenticated;

-- 8. A milestone's quarter, live measure and target (the goal's owners and admins).
create or replace function public.strategy_milestone_meta(p_id bigint, p_quarter smallint, p_measure_key text, p_target numeric)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare g bigint; o record;
begin
  select m.goal_id, m.quarter, m.measure_key, m.target_value into o from public.goal_milestones m where m.id = p_id and m.archived_at is null;
  if not found then raise exception 'That milestone is not there.'; end if;
  g := o.goal_id;
  if not public.wa205_can_edit(g) then raise exception 'Only this goal''s owners and the admins can change it.'; end if;
  if p_quarter is not null and p_quarter not between 1 and 4 then raise exception 'Pick a quarter from Q1 to Q4.'; end if;
  if nullif(p_measure_key, '') is not null and not exists (select 1 from public.goal_measures where key = p_measure_key and archived_at is null) then
    raise exception 'That measure is not one the Hub counts.';
  end if;
  update public.goal_milestones set quarter = p_quarter, measure_key = nullif(p_measure_key, ''), target_value = p_target,
    updated_at = now(), updated_by = public.wa_email() where id = p_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('milestone', p_id::text, 'quarter, measure, target',
            concat_ws(' / ', o.quarter, o.measure_key, o.target_value), concat_ws(' / ', p_quarter, p_measure_key, p_target), public.wa_email());
  return (select to_jsonb(m) from public.goal_milestones m where m.id = p_id);
end $f$;
grant execute on function public.strategy_milestone_meta(bigint, smallint, text, numeric) to authenticated;

-- 9. Contributors on a goal (the goal's owners and admins).
create or replace function public.strategy_contributor_set(p_goal bigint, p_member bigint, p_on boolean, p_focus text default null)
returns jsonb language plpgsql security definer set search_path to '' as $f$
begin
  if not public.wa205_can_edit(p_goal) then raise exception 'Only this goal''s owners and the admins can change who contributes.'; end if;
  if not exists (select 1 from public.team_members where id = p_member) then raise exception 'That person is not on the team list.'; end if;
  if p_on then
    insert into public.goal_contributors (goal_id, member_id, focus, added_by)
      values (p_goal, p_member, nullif(left(coalesce(p_focus, ''), 120), ''), public.wa_email())
      on conflict (goal_id, member_id) do update set removed_at = null,
        focus = coalesce(nullif(left(coalesce(excluded.focus, ''), 120), ''), public.goal_contributors.focus);
  else
    update public.goal_contributors set removed_at = now() where goal_id = p_goal and member_id = p_member and removed_at is null;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('goal', p_goal::text, 'contributor', p_member::text, case when p_on then 'added' else 'removed' end, public.wa_email());
  return jsonb_build_object('ok', true);
end $f$;
grant execute on function public.strategy_contributor_set(bigint, bigint, boolean, text) to authenticated;

-- 10. A Key event's link to a goal (any staff, as fund_events already allows staff to update).
create or replace function public.strategy_link_event(p_event bigint, p_goal bigint, p_milestone bigint default null)
returns jsonb language plpgsql security definer set search_path to '' as $f$
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff link events.'; end if;
  if not exists (select 1 from public.fund_events where id = p_event) then raise exception 'That event is not there.'; end if;
  if p_goal is not null and not exists (select 1 from public.goals g where g.id = p_goal and g.department = 'org' and g.retired_at is null) then raise exception 'Link events to one of the active goals.'; end if;
  if p_milestone is not null and not exists (select 1 from public.goal_milestones m where m.id = p_milestone and m.goal_id = p_goal and m.archived_at is null) then raise exception 'That milestone belongs to another goal.'; end if;
  update public.fund_events set goal_id = p_goal, milestone_id = case when p_goal is null then null else p_milestone end,
    updated_at = now(), updated_by = public.wa_email() where id = p_event;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('fund_event', p_event::text, 'goal', null, concat_ws(' / ', p_goal, p_milestone), public.wa_email());
  return jsonb_build_object('ok', true);
end $f$;
grant execute on function public.strategy_link_event(bigint, bigint, bigint) to authenticated;

-- realtime: other people's links arrive without a refresh
do $$ begin
  begin alter publication supabase_realtime add table public.project_milestones; exception when others then null; end;
  begin alter publication supabase_realtime add table public.goal_contributors; exception when others then null; end;
end $$;
