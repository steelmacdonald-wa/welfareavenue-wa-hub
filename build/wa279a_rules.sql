-- Welfare Avenue Hub: wave279 (279a), 04/11/26. The onboarding plan revamp, the database rules.
-- Part 1 (Task 1): steps the setup page already covers are not on the plan of someone who went through setup.
--   onboarding_template.setup_covered marks a template step as one the new-hire setup page (hub_onboard_flows) already does.
--   wa279_via_setup(p_onb) is true when a hub_onboard_flows row points at the plan: that person went through setup.
--   trg_wa279_flow_plan: when a flow is linked to a plan (insert, or update of onboarding_id), the plan's OPEN covered steps are deleted. A step that is
--     already done stays, so no one's finished work disappears.
--   onboarding_template_propagate(): when a covered template row is added or switched back on, it skips plans where wa279_via_setup is true.
--     Everything else it does is as live has it (taken with pg_get_functiondef 04/11/26): switching a row off, a changed section, the Academy sync.
--   The 90 days due-date check needs no change: onb_due('90 DAYS', date) is already the date plus 90 days (5 November 2026 gives 3 February 2027).
--   No existing template row is flagged here: HR flags the rows in the onboarding template, so nothing on a live plan changes when this runs.
-- Later parts of wa279a (Tasks 2 to 4) are added to this file below.
-- Proved offline first: node test/w279sql.mjs (PGlite, with test/w279sql.sql). Safe to run twice: the column only if absent, the trigger dropped and
-- created, the functions create or replace. Needs the live onboarding tables (wave166, wave271, wave278). Undo: build/wa279a_undo.sql.

-- 1. the flag on the template
alter table public.onboarding_template add column if not exists setup_covered boolean not null default false;
comment on column public.onboarding_template.setup_covered is 'wave279: true when the new-hire setup page already covers this step. Such a step is left off the plan of someone who went through setup (a hub_onboard_flows row points at the plan) and is deleted from it when the flow is linked, unless it is already done. Plans with no flow keep it.';

-- 2. did this plan go through setup
create or replace function public.wa279_via_setup(p_onb bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_onboard_flows f where f.onboarding_id = p_onb)
$function$;
revoke all on function public.wa279_via_setup(bigint) from public, anon, authenticated;
comment on function public.wa279_via_setup(bigint) is 'wave279: true when a hub_onboard_flows row points at this onboarding plan, that is, the person went through the new-hire setup page. Used by onboarding_template_propagate and trg_wa279_flow_plan.';

-- 3. linking a flow to a plan removes the plan's open covered steps
create or replace function public.wa279_flow_plan()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.onboarding_id is not null and (tg_op = 'INSERT' or new.onboarding_id is distinct from old.onboarding_id) then
    delete from public.onboarding_steps s using public.onboarding_template t
     where s.onboarding_id = new.onboarding_id and t.id = s.template_id and t.setup_covered and not coalesce(s.done, false);
  end if;
  return new;
end $function$;
revoke all on function public.wa279_flow_plan() from public, anon, authenticated;
comment on function public.wa279_flow_plan() is 'wave279: trigger function on hub_onboard_flows. When a flow is linked to an onboarding plan, deletes that plan''s open steps whose template row is setup_covered. Done steps stay.';

drop trigger if exists trg_wa279_flow_plan on public.hub_onboard_flows;
create trigger trg_wa279_flow_plan after insert or update of onboarding_id on public.hub_onboard_flows
  for each row execute function public.wa279_flow_plan();
comment on trigger trg_wa279_flow_plan on public.hub_onboard_flows is 'wave279: removes the open setup-covered steps from the plan a flow is linked to.';

-- 4. propagate: a covered row skips plans that went through setup (live body, only the two inserts into onboarding_steps changed)
create or replace function public.onboarding_template_propagate()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'INSERT' then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
        and not (new.setup_covered and public.wa279_via_setup(o.id))   -- wave279
      on conflict (onboarding_id, template_id) do nothing;
      if new.training_id is not null or new.academy_path is not null then
        perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
      end if;
    end if;
    return new;
  end if;
  if new.active is distinct from old.active then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
        and not (new.setup_covered and public.wa279_via_setup(o.id))   -- wave279
      on conflict (onboarding_id, template_id) do nothing;
      if new.training_id is not null or new.academy_path is not null then
        perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
      end if;
    else
      delete from public.onboarding_steps s using public.onboardings o
      where s.template_id = new.id and s.onboarding_id = o.id and o.status = 'active';
    end if;
    return new;
  end if;
  if new.active and new.section is distinct from old.section then
    update public.onboarding_steps s set due_date = public.onb_due(new.section, o.started_at)
      from public.onboardings o
     where s.onboarding_id = o.id and o.status = 'active' and s.template_id = new.id and not coalesce(s.done, false);
  end if;
  if new.active and (new.training_id is not null or new.academy_path is not null)
     and (new.training_id is distinct from old.training_id or new.academy_path is distinct from old.academy_path) then
    perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
  end if;
  return new;
end $function$;
revoke all on function public.onboarding_template_propagate() from public, anon, authenticated;   -- as live: postgres and service_role only
comment on function public.onboarding_template_propagate() is 'Trigger on onboarding_template: adds new or re-activated steps to active onboarding plans and removes deactivated ones. wave279: a setup_covered row is not added to a plan that went through setup (wa279_via_setup).';

-- ======================================================================================================================================================
-- Part 2 (Task 2): the manager picks role trainings for the hire's 60 days and 90 days sections. Undo (first, before part 1's): build/wa279a_undo.sql.
--   onboarding_role_picks is the source of truth for the plan steps wa279role60 and wa279role90 (academy_path 'role60' / 'role90'). Each pick also becomes a
--     people-only Academy assignment, so the module shows as "assigned to you" in the Academy.
--   Why the assignment is written here and not through academy_assign(): academy_assign checks wa169_can_assign() against the CALLER (leaders, admins, the HR
--     access profile). A plain manager fails that, and it refuses a due date that has passed. So wa279_pick_add inserts the academy_assignments row with the same
--     columns academy_assign writes (audience people, people = the hire's email, member_ids = the hire, include_new false, due_date, note, assigned_by) and then
--     calls academy_assign_apply for the training_progress row. wa279_pick_remove does what academy_assign_end does, without the caller check.
--   Who may pick: the plan's manager (wa279_plan_manager, by sign-in email), HR (wa_is_hr) or an admin (is_hub_admin), or the service role (wa271_can()).
--   Counts: 60 DAYS 2 to 3, 90 DAYS 5 to 6. A module can be in one section only. A finished module cannot be newly picked (one already picked that has since been
--     finished stays).
--   Recommended modules (the pop-up and the Hub's own pick): app_config onboard_role_recommend, for the hire's department: the modules of each listed path
--     (by_department.<dept>.paths, then leaders.paths when the flow's leader is true) in sort order, then the listed single training ids (by_department.<dept>.trainings).
--     Path modules are the same set wa166_path_state counts for a path (active, not a tour, not planned). A repeat keeps its first place.
--   wa279_role_autopick: only when app_config onboard_role_picks_since holds a date and today is at least 7 days after it. 60 DAYS list from day 29, 90 DAYS list from
--     day 59 (day one = onboardings.started_at). When a list is below its minimum it is topped up to its maximum with recommended modules, not done and not picked.
--   wa166_path_state gains role60 and role90 (complete when the member's active plan has at least one pick in that section and all are done). Otherwise its
--     body is exactly as live has it (pg_get_functiondef 04/11/26).
--   wa279_plan_manager returns the first non-empty tier of: the flow's manager_member_id, the org-chart line manager, the leaders of the hire's team, the admins.
--     Inactive members and members without an email are skipped, so an inactive manager falls through to the next tier.

create table if not exists public.onboarding_role_picks (
  id bigserial primary key,
  onboarding_id bigint not null references public.onboardings (id) on delete cascade,
  section text not null check (section = any (array['60 DAYS', '90 DAYS'])),
  training_id bigint not null references public.trainings (id),
  picked_by text,
  picked_at timestamptz not null default now(),
  auto boolean not null default false,
  assignment_id bigint,
  unique (onboarding_id, training_id)
);
alter table public.onboarding_role_picks enable row level security;
revoke all on table public.onboarding_role_picks from anon, authenticated;
revoke all on sequence public.onboarding_role_picks_id_seq from anon, authenticated;
comment on table public.onboarding_role_picks is 'wave279: the role trainings picked for a plan''s 60 DAYS and 90 DAYS sections (by the manager, HR, or the Hub itself when auto). Read and written only through the wa279_role_* functions.';

-- who manages this plan
create or replace function public.wa279_plan_manager(p_onb bigint)
returns table(member_id bigint, email text, name text)
language sql stable security definer set search_path to '' as $function$
  with hire as (
    select o.member_id as hid, tm.department as dept from public.onboardings o join public.team_members tm on tm.id = o.member_id where o.id = p_onb
  ),
  cand as (
    select 1 as tier, f.manager_member_id as mid from hire h join public.hub_onboard_flows f on f.onboarding_id = p_onb where f.manager_member_id is not null
    union all
    select 2, lp.member_id from hire h join public.org_positions p on p.member_id = h.hid join public.org_positions lp on lp.id = p.reports_to where lp.member_id is not null
    union all
    select 3, tm.id from hire h join public.hub_roles r on r.role in ('leader', 'admin')
      join public.team_members tm on lower(tm.email) = lower(r.email) and h.dept is not null and tm.department = h.dept
    union all
    select 4, tm.id from hire h join public.hub_roles r on r.role = 'admin' join public.team_members tm on lower(tm.email) = lower(r.email)
  ),
  ok as (
    select c.tier, m.id as mid, lower(btrim(m.email)) as em, m.name as nm
      from cand c join public.team_members m on m.id = c.mid cross join hire h
     where m.active and coalesce(btrim(m.email), '') <> '' and m.id <> h.hid
  )
  select o.mid, o.em, o.nm from (select distinct on (k.mid) k.* from ok k where k.tier = (select min(tier) from ok) order by k.mid) o order by o.nm, o.mid;
$function$;
revoke all on function public.wa279_plan_manager(bigint) from public, anon, authenticated;
comment on function public.wa279_plan_manager(bigint) is 'wave279: who manages an onboarding plan: the flow''s manager, else the org-chart line manager, else the leaders of the hire''s team, else the admins (the first group that has anyone active with an email). Inactive members and members with no email are skipped.';

-- may the signed-in person pick for this plan
create or replace function public.wa279_can_pick(p_onb bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  select public.wa271_can()
      or exists (select 1 from public.wa279_plan_manager(p_onb) m
                  where m.email = lower(coalesce(auth.jwt() ->> 'email', '')) and m.email <> '')
$function$;
revoke all on function public.wa279_can_pick(bigint) from public, anon, authenticated;
comment on function public.wa279_can_pick(bigint) is 'wave279: true for the service role, HR, an admin, or the plan''s manager (by sign-in email).';

-- the recommended modules for a plan, in order
create or replace function public.wa279_recommended(p_onb bigint)
returns table(training_id bigint, title text, path text, done boolean)
language plpgsql stable security definer set search_path to '' as $function$
#variable_conflict use_column
declare v_member bigint; v_dept text; v_leader boolean; v_cfg jsonb; v_paths jsonb; v_trs jsonb;
begin
  select o.member_id, tm.department into v_member, v_dept from public.onboardings o join public.team_members tm on tm.id = o.member_id where o.id = p_onb;
  if v_member is null then return; end if;
  select coalesce(f.leader, false) into v_leader from public.hub_onboard_flows f where f.onboarding_id = p_onb order by f.id limit 1;
  v_leader := coalesce(v_leader, false);
  select coalesce((select nullif(btrim(c.value), '')::jsonb from public.app_config c where c.key = 'onboard_role_recommend'), '{}'::jsonb) into v_cfg;
  v_paths := coalesce(v_cfg #> array['by_department', v_dept, 'paths'], '[]'::jsonb)
             || case when v_leader then coalesce(v_cfg #> '{leaders,paths}', '[]'::jsonb) else '[]'::jsonb end;
  v_trs := coalesce(v_cfg #> array['by_department', v_dept, 'trainings'], '[]'::jsonb);
  return query
  select x.id, x.title, x.path, public.wa166_training_done(v_member, x.id)
    from (
      select distinct on (u.id) u.id, u.title, u.path, u.grp, u.ord, u.srt
        from (
          select t.id, t.title, ap.title as path, 1 as grp, pe.ord, coalesce(t.sort, 0) as srt
            from jsonb_array_elements_text(v_paths) with ordinality pe(k, ord)
            join public.academy_paths ap on ap.key = pe.k and ap.active
            join public.trainings t on t.path_group = ap.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour'
                                   and not coalesce((t.body ->> 'planned')::boolean, false)
          union all
          select t.id, t.title, null::text, 2, te.ord, 0
            from jsonb_array_elements_text(v_trs) with ordinality te(k, ord)
            join public.trainings t on t.id = te.k::bigint and coalesce(t.active, true)
        ) u
       order by u.id, u.grp, u.ord, u.srt
    ) x
   order by x.grp, x.ord, x.srt, x.id;
end $function$;
revoke all on function public.wa279_recommended(bigint) from public, anon, authenticated;
comment on function public.wa279_recommended(bigint) is 'wave279: the role trainings recommended for a plan (app_config onboard_role_recommend, for the hire''s department): the modules of each listed path in sort order (leader paths too when the flow says leader), then the listed single trainings. A repeat keeps its first place. done = the hire already finished it.';

-- one pick: the row and the people-only Academy assignment
create or replace function public.wa279_pick_add(p_onb bigint, p_section text, p_training bigint, p_by text, p_auto boolean)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_member bigint; v_email text; v_start date; v_due date; v_aid bigint; v_id bigint; v_note text; v_title text;
begin
  select o.member_id, lower(tm.email), o.started_at into v_member, v_email, v_start
    from public.onboardings o join public.team_members tm on tm.id = o.member_id where o.id = p_onb;
  if v_member is null then raise exception 'That onboarding plan was not found'; end if;
  v_due := public.onb_due(p_section, v_start);
  v_note := 'Role training (' || lower(p_section) || ')';
  select t.title into v_title from public.trainings t where t.id = p_training;
  if coalesce(btrim(v_email), '') <> '' then
    insert into public.academy_assignments (training_id, audience, teams, people, member_ids, include_new, due_date, due_days, note, assigned_by, assigned_by_email)
    values (p_training, 'people', '{}', array[v_email], array[v_member], false, v_due, null, v_note, coalesce(p_by, 'the Hub'), nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''))
    returning id into v_aid;
    perform public.academy_assign_apply(v_aid, null);
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('academy_assignment', v_aid::text, 'assigned', null, coalesce(v_title, p_training::text) || ' to 1 people, due ' || v_due::text || ' (' || v_note || ')', coalesce(p_by, 'the Hub'));
  end if;
  insert into public.onboarding_role_picks (onboarding_id, section, training_id, picked_by, auto, assignment_id)
  values (p_onb, p_section, p_training, coalesce(p_by, 'the Hub'), coalesce(p_auto, false), v_aid) returning id into v_id;
  return v_id;
end $function$;
revoke all on function public.wa279_pick_add(bigint, text, bigint, text, boolean) from public, anon, authenticated;
comment on function public.wa279_pick_add(bigint, text, bigint, text, boolean) is 'wave279: adds one role pick and its people-only Academy assignment (due date = the section''s due date). Internal.';

-- one pick taken off: the row goes and the assignment ends (as academy_assign_end does, without its caller check)
create or replace function public.wa279_pick_remove(p_pick bigint, p_by text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_aid bigint; v_gone int; v_kept int;
begin
  delete from public.onboarding_role_picks where id = p_pick returning assignment_id into v_aid;
  if v_aid is null then return; end if;
  update public.academy_assignments set active = false, ended_at = now(), ended_by = coalesce(p_by, 'the Hub') where id = v_aid and active;
  if not found then return; end if;
  delete from public.training_progress where assignment_id = v_aid and status = 'assigned' and started_at is null and coalesce(pct, 0) = 0;
  get diagnostics v_gone = row_count;
  update public.training_progress set assignment_id = null, due_date = null where assignment_id = v_aid;
  get diagnostics v_kept = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('academy_assignment', v_aid::text, 'stopped', null, v_gone || ' not started removed, ' || v_kept || ' kept', coalesce(p_by, 'the Hub'));
end $function$;
revoke all on function public.wa279_pick_remove(bigint, text) from public, anon, authenticated;
comment on function public.wa279_pick_remove(bigint, text) is 'wave279: removes one role pick and ends its Academy assignment (rows nobody started are removed, started ones keep their progress). Internal.';

-- what the pop-up and the plan need
create or replace function public.wa279_role_options(p_onb bigint, p_today date default current_date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare o record; v_me text := lower(coalesce(auth.jwt() ->> 'email', '')); v_can boolean; v_leader boolean; s text; v_pk jsonb; v_sec jsonb := '{}'::jsonb; v_rec jsonb;
begin
  select ob.id, ob.started_at, ob.status, tm.name, tm.email, tm.department, tm.id as mid into o
    from public.onboardings ob join public.team_members tm on tm.id = ob.member_id where ob.id = p_onb;
  if o.id is null then raise exception 'That onboarding plan was not found'; end if;
  v_can := public.wa279_can_pick(p_onb);
  if not v_can and not (v_me <> '' and lower(coalesce(o.email, '')) = v_me) then
    raise exception 'You cannot see the role trainings for this plan';
  end if;
  select coalesce(f.leader, false) into v_leader from public.hub_onboard_flows f where f.onboarding_id = p_onb order by f.id limit 1;
  foreach s in array array['60 DAYS', '90 DAYS'] loop
    select coalesce(jsonb_agg(jsonb_build_object('training_id', k.training_id, 'title', t.title, 'done', public.wa166_training_done(o.mid, k.training_id),
                                                 'auto', k.auto, 'picked_by', k.picked_by) order by k.picked_at, k.id), '[]'::jsonb)
      into v_pk from public.onboarding_role_picks k join public.trainings t on t.id = k.training_id where k.onboarding_id = p_onb and k.section = s;
    v_sec := v_sec || jsonb_build_object(s, jsonb_build_object('min', case when s = '60 DAYS' then 2 else 5 end, 'max', case when s = '60 DAYS' then 3 else 6 end,
                                                                'due', public.onb_due(s, o.started_at), 'picked', v_pk));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('training_id', r.training_id, 'title', r.title, 'path', r.path, 'done', r.done)), '[]'::jsonb)
    into v_rec from public.wa279_recommended(p_onb) with ordinality r(training_id, title, path, done, ord);
  return jsonb_build_object('member', o.name, 'member_id', o.mid, 'department', o.department, 'leader', coalesce(v_leader, false),
                            'day', p_today - o.started_at, 'sections', v_sec, 'recommended', v_rec, 'can_pick', v_can and o.status = 'active');
end $function$;
revoke all on function public.wa279_role_options(bigint, date) from public, anon;
grant execute on function public.wa279_role_options(bigint, date) to authenticated, service_role;
comment on function public.wa279_role_options(bigint, date) is 'wave279: the role-training picture for a plan: {member, department, leader, day, sections {60 DAYS, 90 DAYS: min, max, due, picked}, recommended [{training_id, title, path, done}], can_pick}. For the plan''s manager, HR, an admin or the hire.';

-- replace one section's picks
create or replace function public.wa279_role_save(p_onb bigint, p_section text, p_training_ids bigint[])
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare o record; v_ids bigint[]; v_min int; v_max int; v_me text := lower(coalesce(auth.jwt() ->> 'email', '')); v_by text; v_other text; v_id bigint; r record; v_t record;
begin
  if p_section is null or p_section not in ('60 DAYS', '90 DAYS') then raise exception 'Say which section: 60 DAYS or 90 DAYS'; end if;
  select ob.id, ob.member_id, ob.status, tm.name into o from public.onboardings ob join public.team_members tm on tm.id = ob.member_id where ob.id = p_onb for update of ob;
  if o.id is null then raise exception 'That onboarding plan was not found'; end if;
  if not public.wa279_can_pick(p_onb) then raise exception 'Only the manager, HR or an admin can pick role trainings'; end if;
  if o.status <> 'active' then raise exception 'This onboarding plan is finished'; end if;
  v_min := case when p_section = '60 DAYS' then 2 else 5 end;
  v_max := case when p_section = '60 DAYS' then 3 else 6 end;
  v_other := case when p_section = '60 DAYS' then '90 DAYS' else '60 DAYS' end;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_training_ids, '{}'::bigint[])) x where x is not null;
  if cardinality(v_ids) < v_min or cardinality(v_ids) > v_max then
    raise exception 'Pick % or % role trainings for %', v_min, v_max, lower(p_section);
  end if;
  v_by := coalesce((select tm.name from public.team_members tm where lower(tm.email) = v_me and tm.active limit 1), nullif(v_me, ''), 'the Hub');
  -- check the new ones before changing anything
  for v_t in select t.id, t.title from unnest(v_ids) u(id) left join public.trainings t on t.id = u.id
              where not exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = p_onb and k.section = p_section and k.training_id = u.id) loop
    if v_t.title is null or not exists (select 1 from public.trainings x where x.id = v_t.id and coalesce(x.active, true)) then
      raise exception 'One of those modules is not in the Academy';
    end if;
    if exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = p_onb and k.section = v_other and k.training_id = v_t.id) then
      raise exception '"%" is already picked for %. A module can only go in one section.', v_t.title, lower(v_other);
    end if;
    if public.wa166_training_done(o.member_id, v_t.id) then
      raise exception '% has already finished "%". Pick another one.', o.name, v_t.title;
    end if;
  end loop;
  -- take off what is no longer picked
  for r in select k.id from public.onboarding_role_picks k where k.onboarding_id = p_onb and k.section = p_section and not (k.training_id = any (v_ids)) loop
    perform public.wa279_pick_remove(r.id, v_by);
  end loop;
  update public.onboarding_role_picks set auto = false, picked_by = v_by
   where onboarding_id = p_onb and section = p_section and training_id = any (v_ids) and (auto or picked_by is distinct from v_by);
  -- add the new ones
  for r in select u.id from unnest(v_ids) u(id)
            where not exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = p_onb and k.section = p_section and k.training_id = u.id) loop
    v_id := public.wa279_pick_add(p_onb, p_section, r.id, v_by, false);
  end loop;
  perform public.wa166_onb_sync(p_onb);
  return public.wa279_role_options(p_onb);
end $function$;
revoke all on function public.wa279_role_save(bigint, text, bigint[]) from public, anon;
grant execute on function public.wa279_role_save(bigint, text, bigint[]) to authenticated, service_role;
comment on function public.wa279_role_save(bigint, text, bigint[]) is 'wave279: replaces the role trainings picked for one section (60 DAYS: 2 to 3, 90 DAYS: 5 to 6) of a plan. For the plan''s manager, HR or an admin. Refuses a finished module and a module already in the other section. Each pick gets a people-only Academy assignment due on the section''s due date; unpicked ones are ended.';

-- the Hub fills a short list itself
create or replace function public.wa279_role_autopick(p_today date default current_date)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_raw text; v_since date; o record; s text; v_day int; v_gate int; v_n int; v_min int; v_max int; r record; v_added int; v_total int := 0; v_plans int := 0;
begin
  select nullif(btrim(c.value), '') into v_raw from public.app_config c where c.key = 'onboard_role_picks_since';
  if v_raw is null or v_raw !~ '^\d{4}-\d{2}-\d{2}$' then return jsonb_build_object('picked', 0, 'plans', 0, 'reason', 'off'); end if;
  v_since := v_raw::date;
  if p_today < v_since + 7 then return jsonb_build_object('picked', 0, 'plans', 0, 'reason', 'too early'); end if;
  for o in select ob.id, ob.started_at from public.onboardings ob where ob.status = 'active' and ob.member_id is not null order by ob.id loop
    v_day := p_today - o.started_at;
    v_added := 0;
    foreach s in array array['60 DAYS', '90 DAYS'] loop
      v_gate := case when s = '60 DAYS' then 29 else 59 end;
      v_min := case when s = '60 DAYS' then 2 else 5 end;
      v_max := case when s = '60 DAYS' then 3 else 6 end;
      if v_day >= v_gate then
        select count(*) into v_n from public.onboarding_role_picks k where k.onboarding_id = o.id and k.section = s;
        if v_n < v_min then
          for r in select rec.training_id from public.wa279_recommended(o.id) with ordinality rec(training_id, title, path, done, ord)
                    where not rec.done
                      and not exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = o.id and k.training_id = rec.training_id)
                    order by rec.ord limit (v_max - v_n) loop
            perform public.wa279_pick_add(o.id, s, r.training_id, 'the Hub', true);
            v_added := v_added + 1;
          end loop;
        end if;
      end if;
    end loop;
    if v_added > 0 then
      perform public.wa166_onb_sync(o.id);
      v_total := v_total + v_added; v_plans := v_plans + 1;
    end if;
  end loop;
  return jsonb_build_object('picked', v_total, 'plans', v_plans);
end $function$;
revoke all on function public.wa279_role_autopick(date) from public, anon, authenticated;
grant execute on function public.wa279_role_autopick(date) to service_role;
comment on function public.wa279_role_autopick(date) is 'wave279: for each active plan whose 60 DAYS list is short at day 29 (90 DAYS at day 59), picks recommended modules (not done, not already picked) up to the maximum, auto = true, picked_by the Hub. Does nothing unless app_config onboard_role_picks_since is a date and today is at least 7 days after it.';

-- the path state behind the plan steps
create or replace function public.wa279_role_state(p_member bigint, p_key text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  with ob as (select o.id from public.onboardings o where o.member_id = p_member and o.status = 'active' order by o.id desc limit 1),
  pk as (
    select public.wa166_training_done(p_member, k.training_id) as d
      from public.onboarding_role_picks k join ob on ob.id = k.onboarding_id
     where k.section = case when p_key = 'role60' then '60 DAYS' else '90 DAYS' end
  )
  select jsonb_build_object('key', p_key, 'title', 'Your role trainings', 'done', (select count(*) filter (where d) from pk), 'total', (select count(*) from pk),
                            'complete', (select count(*) > 0 and count(*) = count(*) filter (where d) from pk), 'asked', p_key)
$function$;
revoke all on function public.wa279_role_state(bigint, text) from public, anon, authenticated;
comment on function public.wa279_role_state(bigint, text) is 'wave279: role60 / role90 for wa166_path_state: complete when the member''s active plan has at least one pick in that section and every pick is done.';

-- wa166_path_state: the live body, with role60 and role90 in front
create or replace function public.wa166_path_state(p_member bigint, p_key text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select case when p_key in ('role60', 'role90') then public.wa279_role_state(p_member, p_key) else (
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
    jsonb_build_object('key', p_key, 'title', null, 'done', 0, 'total', 0, 'complete', false, 'asked', p_key))
  ) end;
$function$;
