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

-- the active plans the signed-in person manages (final review): the flow's named manager is not always on the lead card (onboarding_lead_view), so Home
-- asks this too. The same people wa279_can_pick lets pick as manager: wa279_plan_manager's first group (the flow's manager, the line manager, the team's
-- leaders, the admins). HR and admins as such are not in it: they pick from the HR centre. day = today (Toronto) minus day one, as the database counts it.
create or replace function public.wa279_my_hires()
returns jsonb language sql stable security definer set search_path to '' as $function$
  with me as (select lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) as em)
  select coalesce(jsonb_agg(jsonb_build_object('onboarding_id', ob.id, 'name', coalesce(tm.name, ob.person_name),
                                               'day', (now() at time zone 'America/Toronto')::date - ob.started_at) order by ob.started_at, ob.id), '[]'::jsonb)
    from public.onboardings ob join public.team_members tm on tm.id = ob.member_id cross join me
   where ob.status = 'active' and me.em <> ''
     and exists (select 1 from public.wa279_plan_manager(ob.id) m where m.email = me.em)
$function$;
revoke all on function public.wa279_my_hires() from public, anon;
grant execute on function public.wa279_my_hires() to authenticated, service_role;
comment on function public.wa279_my_hires() is 'wave279: the active onboarding plans the signed-in person manages (wa279_plan_manager by sign-in email, the flow''s manager first), as [{onboarding_id, name, day}] with day = today (Toronto) minus day one. Home lists these with the lead card''s hires for the role-pick card.';

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
  -- a setting that is not valid JSON, or a list that is not a list, counts as no recommendations (it never raises)
  begin
    select coalesce((select nullif(btrim(c.value), '')::jsonb from public.app_config c where c.key = 'onboard_role_recommend'), '{}'::jsonb) into v_cfg;
  exception when others then v_cfg := '{}'::jsonb;
  end;
  v_paths := case when jsonb_typeof(v_cfg #> array['by_department', v_dept, 'paths']) = 'array' then v_cfg #> array['by_department', v_dept, 'paths'] else '[]'::jsonb end
             || case when v_leader and jsonb_typeof(v_cfg #> '{leaders,paths}') = 'array' then v_cfg #> '{leaders,paths}' else '[]'::jsonb end;
  v_trs := case when jsonb_typeof(v_cfg #> array['by_department', v_dept, 'trainings']) = 'array' then v_cfg #> array['by_department', v_dept, 'trainings'] else '[]'::jsonb end;
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
            join public.trainings t on t.id = (case when te.k ~ '^[0-9]{1,15}$' then te.k::bigint end) and coalesce(t.active, true)
        ) u
       order by u.id, u.grp, u.ord, u.srt
    ) x
   order by x.grp, x.ord, x.srt, x.id;
end $function$;
revoke all on function public.wa279_recommended(bigint) from public, anon, authenticated;
comment on function public.wa279_recommended(bigint) is 'wave279: the role trainings recommended for a plan (app_config onboard_role_recommend, for the hire''s department): the modules of each listed path in sort order (leader paths too when the flow says leader), then the listed single trainings. A repeat keeps its first place. done = the hire already finished it. A malformed setting (not JSON, a list that is not a list, a training id that is not a number) gives no recommendations and never raises.';

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
declare o record; v_me text := lower(coalesce(auth.jwt() ->> 'email', '')); v_can boolean; v_leader boolean; s text; v_pk jsonb; v_sec jsonb := '{}'::jsonb; v_rec jsonb; v_done jsonb;
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
                                                                'due', public.onb_due(s, o.started_at), 'picked', v_pk,
                                                                -- done: picked and every pick finished (wa279_role_state's rule); the list can't change then
                                                                'done', jsonb_array_length(v_pk) > 0 and not exists (select 1 from jsonb_array_elements(v_pk) e where not (e ->> 'done')::boolean)));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('training_id', r.training_id, 'title', r.title, 'path', r.path, 'done', r.done) order by r.ord), '[]'::jsonb)
    into v_rec from public.wa279_recommended(p_onb) with ordinality r(training_id, title, path, done, ord);
  -- every module the hire finished (wa166_training_done's match: their name or their email), so a module found by search shows done too
  select coalesce(jsonb_agg(distinct tp.training_id order by tp.training_id), '[]'::jsonb) into v_done
    from public.training_progress tp
   where tp.status = 'done' and tp.training_id is not null
     and (lower(tp.person_name) = lower(o.name) or (o.email is not null and lower(coalesce(tp.email, '')) = lower(o.email)));
  return jsonb_build_object('member', o.name, 'member_id', o.mid, 'department', o.department, 'leader', coalesce(v_leader, false),
                            'day', p_today - o.started_at, 'sections', v_sec, 'recommended', v_rec, 'done_ids', v_done, 'can_pick', v_can and o.status = 'active');
end $function$;
revoke all on function public.wa279_role_options(bigint, date) from public, anon;
grant execute on function public.wa279_role_options(bigint, date) to authenticated, service_role;
comment on function public.wa279_role_options(bigint, date) is 'wave279: the role-training picture for a plan: {member, department, leader, day, sections {60 DAYS, 90 DAYS: min, max, due, picked, done}, recommended [{training_id, title, path, done}], done_ids (every module the hire finished), can_pick}. A section is done when it has picks and every pick is finished. For the plan''s manager, HR, an admin or the hire.';

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
  -- a section whose picks are all finished (wa279_role_state's complete) is closed: its step is done
  if exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = p_onb and k.section = p_section)
     and not exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = p_onb and k.section = p_section and not public.wa166_training_done(o.member_id, k.training_id)) then
    raise exception 'These trainings are all done, so the list can''t change now.';
  end if;
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
comment on function public.wa279_role_save(bigint, text, bigint[]) is 'wave279: replaces the role trainings picked for one section (60 DAYS: 2 to 3, 90 DAYS: 5 to 6) of a plan. For the plan''s manager, HR or an admin. Refuses a finished module, a module already in the other section, and any change to a section whose picks are all finished. Each pick gets a people-only Academy assignment due on the section''s due date; unpicked ones are ended.';

-- the Hub fills a short list itself
create or replace function public.wa279_role_autopick(p_today date default ((now() at time zone 'America/Toronto')::date))
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_raw text; v_since date; o record; s text; v_day int; v_gate int; v_n int; v_min int; v_max int; r record; v_added int; v_total int := 0; v_plans int := 0;
        pl record; v_failed jsonb := '[]'::jsonb; v_ids bigint[]; v_plan_added jsonb; v_list jsonb := '[]'::jsonb;
begin
  select nullif(btrim(c.value), '') into v_raw from public.app_config c where c.key = 'onboard_role_picks_since';
  if v_raw is null or v_raw !~ '^\d{4}-\d{2}-\d{2}$' then return jsonb_build_object('picked', 0, 'plans', 0, 'reason', 'off'); end if;
  v_since := v_raw::date;
  if p_today < v_since + 7 then return jsonb_build_object('picked', 0, 'plans', 0, 'reason', 'too early'); end if;
  for pl in select ob.id from public.onboardings ob where ob.status = 'active' and ob.member_id is not null order by ob.id loop
    -- each plan on its own: one that fails is recorded and the others still run
    begin
      -- the same row lock wa279_role_save takes, so a manager's save and this run take turns; the plan is read again once the lock is ours
      select ob.id, ob.started_at into o from public.onboardings ob where ob.id = pl.id and ob.status = 'active' for update of ob;
      if not found then continue; end if;
      v_day := p_today - o.started_at;
      v_added := 0;
      v_plan_added := '[]'::jsonb;
      foreach s in array array['60 DAYS', '90 DAYS'] loop
        v_gate := case when s = '60 DAYS' then 29 else 59 end;
        v_min := case when s = '60 DAYS' then 2 else 5 end;
        v_max := case when s = '60 DAYS' then 3 else 6 end;
        if v_day >= v_gate then
          select count(*) into v_n from public.onboarding_role_picks k where k.onboarding_id = o.id and k.section = s;
          if v_n < v_min then
            v_ids := '{}';
            for r in select rec.training_id from public.wa279_recommended(o.id) with ordinality rec(training_id, title, path, done, ord)
                      where not rec.done
                        and not exists (select 1 from public.onboarding_role_picks k where k.onboarding_id = o.id and k.training_id = rec.training_id)
                      order by rec.ord limit (v_max - v_n) loop
              perform public.wa279_pick_add(o.id, s, r.training_id, 'the Hub', true);
              v_added := v_added + 1;
              v_ids := v_ids || r.training_id;
            end loop;
            if cardinality(v_ids) > 0 then
              v_plan_added := v_plan_added || jsonb_build_object('onboarding_id', o.id, 'section', s, 'training_ids', to_jsonb(v_ids));
            end if;
          end if;
        end if;
      end loop;
      if v_added > 0 then
        perform public.wa166_onb_sync(o.id);
        v_total := v_total + v_added; v_plans := v_plans + 1;
        v_list := v_list || v_plan_added;   -- last, so a plan that failed above never shows here
      end if;
    exception when others then
      v_failed := v_failed || jsonb_build_object('onboarding_id', pl.id, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('picked', v_total, 'plans', v_plans, 'added', v_list, 'failed', v_failed);
end $function$;
revoke all on function public.wa279_role_autopick(date) from public, anon, authenticated;
grant execute on function public.wa279_role_autopick(date) to service_role;
comment on function public.wa279_role_autopick(date) is 'wave279: for each active plan whose 60 DAYS list is short at day 29 (90 DAYS at day 59), picks recommended modules (not done, not already picked) up to the maximum, auto = true, picked_by the Hub. Today is the Toronto date, as wa279_onboard_tick counts it. Does nothing unless app_config onboard_role_picks_since is a date and today is at least 7 days after it. Each plan runs in its own sub-block under the same row lock wa279_role_save takes; a plan that fails is listed in failed and the rest go on. Returns {picked, plans, added [{onboarding_id, section, training_ids}], failed}; wa279_onboard_tick tells the manager from added.';

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

-- Part 3 (Task 3): the path state behind the Policies step. Complete when every required, active policy is signed by the member's email.
create or replace function public.wa279_policies_state(p_member bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  with me as (select lower(tm.email) as email from public.team_members tm where tm.id = p_member),
  req as (
    select p.key, exists (select 1 from public.wa_policy_signoffs s, me where lower(s.email) = me.email and s.policy_key = p.key) as signed
      from public.wa_policies p where p.required and p.active
  )
  select jsonb_build_object('key', 'policies', 'title', 'Policies', 'done', (select count(*) filter (where signed) from req)::int, 'total', (select count(*) from req)::int,
                            'complete', (select count(*) > 0 and count(*) = count(*) filter (where signed) from req), 'asked', 'policies')
$function$;
revoke all on function public.wa279_policies_state(bigint) from public, anon, authenticated;
comment on function public.wa279_policies_state(bigint) is 'wave279: policies for wa166_path_state: complete when every required, active policy has a sign-off from the member''s email.';

-- wa166_path_state: the live body, with role60, role90 and policies in front
create or replace function public.wa166_path_state(p_member bigint, p_key text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select case when p_key in ('role60', 'role90') then public.wa279_role_state(p_member, p_key)
              when p_key = 'policies' then public.wa279_policies_state(p_member) else (
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

-- ====================================================================================================================================================
-- Part 3 (Task 3): a required policy must have been open for policy_read_minutes (default 10) before the person can sign it; the Policies step ticks itself
-- ====================================================================================================================================================
-- Rules:
--   wa_policy_opens (email, policy_key, opened_at) records the first time a person opened a policy. No direct grants: people reach it only through
--     wa279_policy_open(key) (records the first open, returns {opened_at, unlock_at, minutes}) and wa279_policy_state() (the caller's own opens).
--   BEFORE INSERT on wa_policy_signoffs refuses when the insert is by the authenticated role, the row's email is the caller's (compared lower-cased), the
--     policy is required and active, policy_read_minutes is above 0, and there is no open or it is younger than the rule. No open: 'Open it first, then read
--     it for N minutes.' An open that is too young: 'Read it for N more minutes first.' ('1 more minute' when one is left). N is the whole minutes left,
--     rounded up, at least 1. The service role and every other insert pass. Existing sign-offs are never looked at again.
--   policy_read_minutes (app_config, text): missing or not a whole number = 10; 0 = off. This file seeds it as '0' (a new key only), so the rule is off
--     between the SQL release and the page release; the release's last step sets it to '10' with onboard_behind_on.
--   AFTER INSERT on wa_policy_signoffs runs wa166_onb_sync for the signer's active plan(s) (found by team_members.email, lower-cased). It never fails a sign-off.
--   wa166_path_state(member, 'policies') (above, in the wrapper) is complete when every required, active policy is signed by the member's email.

create table if not exists public.wa_policy_opens (
  email text not null,
  policy_key text not null,
  opened_at timestamptz not null default now(),
  primary key (email, policy_key)
);
alter table public.wa_policy_opens enable row level security;   -- no policies: only the two functions below (security definer) reach it
revoke all on table public.wa_policy_opens from public, anon, authenticated;
comment on table public.wa_policy_opens is 'wave279: the first time each person opened each policy (lower-case email). Written only by wa279_policy_open; read by the sign-off rule.';

-- the rule in minutes
create or replace function public.wa279_policy_minutes()
returns int language sql stable security definer set search_path to '' as $function$
  select coalesce((select case when btrim(c.value) ~ '^\d{1,4}$' then btrim(c.value)::int end from public.app_config c where c.key = 'policy_read_minutes'), 10)
$function$;
revoke all on function public.wa279_policy_minutes() from public, anon, authenticated;
comment on function public.wa279_policy_minutes() is 'wave279: app_config policy_read_minutes as whole minutes. Missing or not a number = 10. 0 = the rule is off.';
-- off until the page is out (the page shows the timer); the release's last step sets it to '10'. A value already there is kept.
insert into public.app_config (key, value) values ('policy_read_minutes', '0') on conflict (key) do nothing;

create or replace function public.wa279_policy_open(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', '')); v_min int := public.wa279_policy_minutes(); v_at timestamptz;
begin
  if v_email = '' then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.wa_policies p where p.key = p_key and p.active) then raise exception 'That policy was not found'; end if;
  insert into public.wa_policy_opens (email, policy_key) values (v_email, p_key) on conflict (email, policy_key) do nothing;
  select o.opened_at into v_at from public.wa_policy_opens o where o.email = v_email and o.policy_key = p_key;
  return jsonb_build_object('opened_at', v_at, 'unlock_at', v_at + make_interval(mins => v_min), 'minutes', v_min);
end $function$;
revoke all on function public.wa279_policy_open(text) from public, anon;
grant execute on function public.wa279_policy_open(text) to authenticated, service_role;
comment on function public.wa279_policy_open(text) is 'wave279: records the first time the caller opened an active policy and returns {opened_at, unlock_at, minutes}. A second open keeps the first time. Unknown or inactive policy: refused.';

create or replace function public.wa279_policy_state()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_object_agg(o.policy_key, jsonb_build_object('opened_at', o.opened_at, 'unlock_at', o.opened_at + make_interval(mins => public.wa279_policy_minutes()))), '{}'::jsonb)
    from public.wa_policy_opens o where o.email = lower(coalesce(auth.jwt() ->> 'email', ''))
$function$;
revoke all on function public.wa279_policy_state() from public, anon;
grant execute on function public.wa279_policy_state() to authenticated, service_role;
comment on function public.wa279_policy_state() is 'wave279: the caller''s own policy opens as {policy_key: {opened_at, unlock_at}}.';

-- the 10 minute rule
create or replace function public.wa279_policy_rule()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_me text := lower(coalesce(auth.jwt() ->> 'email', '')); v_min int; v_at timestamptz; v_left int;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_me = '' or lower(new.email) <> v_me then return new; end if;
  if not exists (select 1 from public.wa_policies p where p.key = new.policy_key and p.required and p.active) then return new; end if;
  v_min := public.wa279_policy_minutes();
  if v_min <= 0 then return new; end if;
  select o.opened_at into v_at from public.wa_policy_opens o where o.email = v_me and o.policy_key = new.policy_key;
  -- final review: never opened says so; otherwise the minutes left, "1 more minute" or "7 more minutes"
  if v_at is null then raise exception 'Open it first, then read it for % minute%.', v_min, case when v_min = 1 then '' else 's' end; end if;
  if now() < v_at + make_interval(mins => v_min) then
    v_left := greatest(1, ceil(extract(epoch from (v_at + make_interval(mins => v_min) - now())) / 60)::int);
    raise exception 'Read it for % more minute% first.', v_left, case when v_left = 1 then '' else 's' end;
  end if;
  return new;
end $function$;
revoke all on function public.wa279_policy_rule() from public, anon, authenticated;
comment on function public.wa279_policy_rule() is 'wave279: BEFORE INSERT on wa_policy_signoffs. A signed-in person signing a required, active policy for themselves must have had it open for policy_read_minutes (default 10, 0 = off). The service role and other inserts pass.';
drop trigger if exists trg_wa279_policy_read on public.wa_policy_signoffs;
create trigger trg_wa279_policy_read before insert on public.wa_policy_signoffs for each row execute function public.wa279_policy_rule();

-- a new sign-off ticks the Policies step
create or replace function public.wa279_policy_sync()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare r record;
begin
  begin
    for r in select ob.id from public.onboardings ob join public.team_members tm on tm.id = ob.member_id
              where lower(tm.email) = lower(new.email) and ob.status = 'active' loop
      perform public.wa166_onb_sync(r.id);
    end loop;
  exception when others then
    null;   -- a sign-off never fails because the plan could not be updated
  end;
  return new;
end $function$;
revoke all on function public.wa279_policy_sync() from public, anon, authenticated;
comment on function public.wa279_policy_sync() is 'wave279: AFTER INSERT on wa_policy_signoffs. Runs wa166_onb_sync for the signer''s active plan(s), found by team_members.email. Swallows any error so a sign-off never fails.';
drop trigger if exists trg_wa279_policy_sync on public.wa_policy_signoffs;
create trigger trg_wa279_policy_sync after insert on public.wa_policy_signoffs for each row execute function public.wa279_policy_sync();


-- ====================================================================================================================================================
-- Part 4 (Task 4): the Hub tells the hire and their manager when onboarding falls behind, and reminds the manager to pick role trainings
-- ====================================================================================================================================================
-- Rules:
--   Behind: an open step with a due date more than 2 days gone (due_date < today - 2, Toronto date). The role steps (academy_path role60 / role90) never count
--     while their section has no picks. A plan counts when status = 'active' and started_at >= app_config onboard_behind_since (a date; empty = no plan counts).
--   wa279_onboard_tick (cron wa-onboard-behind, weekdays 12:35 UTC): 1. wa279_role_autopick(Toronto date) (its own switch is onboard_role_picks_since); 1b. for
--     each plan and section the Hub just picked for, onboard_role_pick to the manager ("The Hub picked <name>'s role trainings", what it picked, change them on
--     Home), once per plan and section (log kind onboard_role_autopicked); 2. for each counting
--     plan with late steps and no onboard_behind row in the last 7 days (by Toronto date): onboard_behind to the hire, onboard_behind_lead to the manager (the first
--     of wa279_plan_manager by member id; none = only the hire hears), and from the third onboard_behind row on a plan the hr_notify_emails as well;
--     3. for each plan at day 21 or more (started_at >= onboard_role_picks_since) with a section under its minimum (60 DAYS 2, 90 DAYS 5) whose auto-pick day (29, 59) is still ahead and no onboard_role_pick
--     row in the last 7 days: onboard_role_pick to the manager. app_config onboard_behind_on must be 'on' to send anything; a dry run still returns the plan.
--   Links: the hire and the manager go to Home (#mypage, where the pick card is); HR (the behind message from the third on) to #hrcentre/onboarding.
--   Each plan runs in its own sub-block: a plan that fails is listed in failed and the others go on. The log row is written before the messages go.
--   Sending goes through notify only (its relay branch sends the Hub notification too, honouring push_on), wrapped so it never raises.
--   onboarding_behind_log is the memory (one row per plan, kind and send); nothing reads it but this function.

create table if not exists public.onboarding_behind_log (
  id bigserial primary key,
  onboarding_id bigint not null references public.onboardings (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  late int,
  detail jsonb
);
create index if not exists onboarding_behind_log_plan_kind on public.onboarding_behind_log (onboarding_id, kind, sent_at);
alter table public.onboarding_behind_log enable row level security;
revoke all on table public.onboarding_behind_log from public, anon, authenticated;
revoke all on sequence public.onboarding_behind_log_id_seq from public, anon, authenticated;
comment on table public.onboarding_behind_log is 'wave279: one row each time wa279_onboard_tick sent a plan''s behind message (kind onboard_behind), role-pick reminder (kind onboard_role_pick) or what the Hub picked (kind onboard_role_autopicked, detail.section). It sets the 7 day pause and the third-message rule. No direct access.';

-- the late steps of a plan, oldest first
create or replace function public.wa279_behind_list(p_onb bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('template_id', t.id, 'name', t.name, 'section', t.section, 'due_date', s.due_date) order by s.due_date, t.sort, t.id), '[]'::jsonb)
    from public.onboarding_steps s
    join public.onboarding_template t on t.id = s.template_id
   where s.onboarding_id = p_onb and not coalesce(s.done, false)
     and s.due_date < (now() at time zone 'America/Toronto')::date - 2
     and (t.academy_path is null or t.academy_path not in ('role60', 'role90')
          or exists (select 1 from public.onboarding_role_picks k
                      where k.onboarding_id = p_onb and k.section = case t.academy_path when 'role60' then '60 DAYS' else '90 DAYS' end));
$function$;
revoke all on function public.wa279_behind_list(bigint) from public, anon, authenticated;
comment on function public.wa279_behind_list(bigint) is 'wave279: the late steps of an onboarding plan, [{template_id, name, section, due_date}], oldest first: open, due more than 2 days ago (Toronto date). A role step (role60, role90) with no picks in its section never counts.';

-- one message to one person through notify (its relay branch sends the Hub notification too, through hub-push, so there is no direct hub-push call); never raises
create or replace function public.wa279_tell(p_event text, p_to text, p_url text, p_tag text, p_title text, p_body text)
returns void language plpgsql security definer set search_path to '' as $function$
declare
  v_to text := lower(btrim(coalesce(p_to, '')));
  v_text text := replace(replace(replace(p_body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || ' <https://hub.welfareavenue.com/' || p_url || '|Open the Hub>';
begin
  if v_to = '' then return; end if;
  begin
    perform public.call_edge('notify', jsonb_build_object('event', p_event, 'to_email', v_to, 'url', p_url, 'tag', p_tag, 'title', p_title, 'body', p_body, 'text', v_text));
  exception when others then null; end;
end $function$;
revoke all on function public.wa279_tell(text, text, text, text, text, text) from public, anon, authenticated;
comment on function public.wa279_tell(text, text, text, text, text, text) is 'wave279: sends one onboarding message to one person through notify (which also sends the Hub notification). Internal; never raises.';

-- the daily job
create or replace function public.wa279_onboard_tick(p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  o record;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_on boolean := lower(btrim(coalesce((select c.value from public.app_config c where c.key = 'onboard_behind_on'), ''))) = 'on';
  v_raw text; v_since date; v_pick_since date;
  v_list jsonb; v_n int; v_prev int; v_names text; v_label text; v_body text; v_lead_title text; v_lead_body text; v_title text;
  v_mgr text; v_hire text; v_leads text[]; v_hr text[]; v_to jsonb; v_x text; v_day int; v_short text[]; v_auto jsonb;
  v_plan jsonb := '[]'::jsonb; v_failed jsonb := '[]'::jsonb; v_behind int := 0; v_picks int := 0; v_told int := 0;
  a jsonb; v_onb bigint; v_sec text; v_word text; v_titles text; v_k int;
begin
  if session_user = 'authenticator' and coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'not allowed';
  end if;
  -- 1. the Hub's own role-training pick (it has its own switch, onboard_role_picks_since), on the same Toronto date; a dry run changes nothing
  if p_dry then v_auto := jsonb_build_object('skipped', 'dry run'); else v_auto := public.wa279_role_autopick(v_today); end if;
  -- the switch: anything but 'on' sends nothing (a dry run still shows the plan)
  if not v_on and not p_dry then return jsonb_build_object('day', v_today, 'off', true, 'sent', 0, 'autopick', v_auto); end if;

  -- 1b. the manager hears what the Hub picked: one message per plan and section, ever (onboarding_behind_log kind onboard_role_autopicked)
  for a in select e.value from jsonb_array_elements(coalesce(v_auto -> 'added', '[]'::jsonb)) e loop
    begin
      v_onb := (a ->> 'onboarding_id')::bigint;
      v_sec := a ->> 'section';
      v_mgr := (select x.email from public.wa279_plan_manager(v_onb) x where x.email <> '' order by x.member_id limit 1);
      if v_mgr is not null and not exists (select 1 from public.onboarding_behind_log l
                                            where l.onboarding_id = v_onb and l.kind = 'onboard_role_autopicked' and l.detail ->> 'section' = v_sec) then
        select string_agg(t.title, ', ' order by e.i), count(*)::int into v_titles, v_k
          from jsonb_array_elements_text(a -> 'training_ids') with ordinality e(id, i) join public.trainings t on t.id = e.id::bigint;
        v_hire := coalesce((select tm.name from public.onboardings ob join public.team_members tm on tm.id = ob.member_id where ob.id = v_onb), 'A new hire');
        v_word := case when v_sec = '60 DAYS' then '60 days' else '90 days' end;
        v_title := 'The Hub picked ' || v_hire || '''s role trainings';
        v_body := 'The Hub picked ' || v_k || ' training' || case when v_k = 1 then '' else 's' end || ' for ' || v_hire || '''s ' || v_word || ': ' || v_titles
                  || '. You can change them on Home.';
        insert into public.onboarding_behind_log (onboarding_id, kind, late, detail)
        values (v_onb, 'onboard_role_autopicked', v_k, jsonb_build_object('to', v_mgr, 'section', v_sec, 'training_ids', a -> 'training_ids'));
        perform public.wa279_tell('onboard_role_pick', v_mgr, '#mypage', 'onboard-role-autopicked-' || v_onb || '-' || replace(lower(v_sec), ' ', '') || '-' || v_today, v_title, v_body);
        v_told := v_told + 1;
        v_plan := v_plan || jsonb_build_object('kind', 'onboard_role_autopicked', 'onboarding_id', v_onb, 'section', v_sec, 'to', jsonb_build_array(v_mgr), 'title', v_title, 'body', v_body);
      end if;
    exception when others then
      v_failed := v_failed || jsonb_build_object('onboarding_id', v_onb, 'error', sqlerrm);
    end;
  end loop;
  select nullif(btrim(c.value), '') into v_raw from public.app_config c where c.key = 'onboard_behind_since';
  v_since := case when v_raw ~ '^\d{4}-\d{2}-\d{2}$' then v_raw::date end;
  select nullif(btrim(c.value), '') into v_raw from public.app_config c where c.key = 'onboard_role_picks_since';
  v_pick_since := case when v_raw ~ '^\d{4}-\d{2}-\d{2}$' then v_raw::date end;
  v_hr := coalesce((select array_agg(distinct x) from unnest(regexp_split_to_array(lower(coalesce((select c.value from public.app_config c where c.key = 'hr_notify_emails'), '')), '[,\s]+')) x
                     where x ~ '@'), '{}');

  for o in select ob.id, ob.started_at, coalesce(tm.name, 'A new hire') as hire_name, lower(btrim(coalesce(tm.email, ''))) as hire_email
             from public.onboardings ob join public.team_members tm on tm.id = ob.member_id
            where ob.status = 'active'
              and ((v_since is not null and ob.started_at >= v_since) or (v_pick_since is not null and ob.started_at >= v_pick_since))
            order by ob.id loop
    -- each plan on its own: one that fails is listed and the others still go
    begin
      v_mgr := (select x.email from public.wa279_plan_manager(o.id) x where x.email <> '' order by x.member_id limit 1);

      -- 2. behind
      if v_since is not null and o.started_at >= v_since then
        v_list := public.wa279_behind_list(o.id);
        v_n := jsonb_array_length(v_list);
        if v_n > 0 and not exists (select 1 from public.onboarding_behind_log l
                                    where l.onboarding_id = o.id and l.kind = 'onboard_behind' and (l.sent_at at time zone 'America/Toronto')::date > v_today - 7) then
          select count(*)::int into v_prev from public.onboarding_behind_log l where l.onboarding_id = o.id and l.kind = 'onboard_behind';
          select string_agg(t.e ->> 'name', ', ' order by t.i) into v_names from jsonb_array_elements(v_list) with ordinality t(e, i) where t.i <= 5;
          select upper(left(t.e ->> 'section', 1)) || lower(substr(t.e ->> 'section', 2)) into v_label from jsonb_array_elements(v_list) with ordinality t(e, i) where t.i = 1;
          v_body := 'behind on ' || v_n || ' onboarding step' || case when v_n = 1 then '' else 's' end || ' from ' || v_label || ': ' || v_names || '.';
          v_hire := nullif(o.hire_email, '');
          -- the manager, and HR from the third message on this plan; never the hire twice
          v_leads := coalesce((select array_agg(distinct x) from unnest(array_cat(case when v_mgr is not null then array[v_mgr] else '{}'::text[] end,
                                                                                   case when v_prev >= 2 then v_hr else '{}'::text[] end)) x
                                where x is distinct from v_hire), '{}');
          v_to := (case when v_hire is not null then jsonb_build_array(v_hire) else '[]'::jsonb end) || to_jsonb(v_leads);
          v_lead_title := o.hire_name || ' is behind on onboarding';
          v_lead_body := o.hire_name || ' is ' || v_body;
          if jsonb_array_length(v_to) > 0 then
            if not p_dry then
              -- the memory first, so a failure after this point can never send twice
              insert into public.onboarding_behind_log (onboarding_id, kind, late, detail)
              values (o.id, 'onboard_behind', v_n, jsonb_build_object('to', v_to, 'hr', v_prev >= 2, 'steps', (select jsonb_agg(t.e ->> 'name') from jsonb_array_elements(v_list) with ordinality t(e, i) where t.i <= 5)));
              if v_hire is not null then
                perform public.wa279_tell('onboard_behind', v_hire, '#mypage', 'onboard-behind-' || o.id || '-' || v_today, 'You''re behind on onboarding', 'You''re ' || v_body);
              end if;
              -- the manager's link goes to Home (where the pick card is); HR's to Onboarding in the HR centre
              foreach v_x in array v_leads loop
                perform public.wa279_tell('onboard_behind_lead', v_x, case when v_x = v_mgr then '#mypage' else '#hrcentre/onboarding' end,
                                          'onboard-behind-lead-' || o.id || '-' || v_today, v_lead_title, v_lead_body);
              end loop;
            end if;
            v_behind := v_behind + 1;
            v_plan := v_plan || jsonb_build_object('kind', 'onboard_behind', 'onboarding_id', o.id, 'late', v_n, 'to', v_to, 'hr', v_prev >= 2, 'title', v_lead_title, 'body', v_lead_body);
          end if;
        end if;
      end if;

      -- 3. the manager is asked to pick role trainings (day 21 on, while a list is under its minimum)
      v_day := v_today - o.started_at;
      if v_pick_since is not null and o.started_at >= v_pick_since and v_day >= 21 and v_mgr is not null then
        -- a section is asked about while it is short and its auto-pick day (29, 59) is still ahead; after that day the Hub has had its go
        select array_agg(s.sec order by s.sec) into v_short
          from (values ('60 DAYS', 2, 29), ('90 DAYS', 5, 59)) s(sec, mn, gate)
         where v_day < s.gate and (select count(*) from public.onboarding_role_picks k where k.onboarding_id = o.id and k.section = s.sec) < s.mn;
        if v_short is not null and not exists (select 1 from public.onboarding_behind_log l
                                                where l.onboarding_id = o.id and l.kind = 'onboard_role_pick' and (l.sent_at at time zone 'America/Toronto')::date > v_today - 7) then
          v_title := 'Pick ' || o.hire_name || '''s role trainings';
          v_body := case
            when v_short = array['60 DAYS'] then 'Pick 2 or 3 trainings for ' || o.hire_name || '''s 60 days. The Hub picks for you on day 29 if you don''t.'
            when v_short = array['90 DAYS'] then 'Pick 5 or 6 trainings for ' || o.hire_name || '''s 90 days. The Hub picks for you on day 59 if you don''t.'
            else 'Pick 2 or 3 trainings for ' || o.hire_name || '''s 60 days and 5 or 6 for their 90 days. The Hub picks for you on day 29 and day 59 if you don''t.' end;
          if not p_dry then
            insert into public.onboarding_behind_log (onboarding_id, kind, late, detail)
            values (o.id, 'onboard_role_pick', cardinality(v_short), jsonb_build_object('to', v_mgr, 'short', to_jsonb(v_short), 'day', v_day));
            perform public.wa279_tell('onboard_role_pick', v_mgr, '#mypage', 'onboard-role-pick-' || o.id || '-' || v_today, v_title, v_body);
          end if;
          v_picks := v_picks + 1;
          v_plan := v_plan || jsonb_build_object('kind', 'onboard_role_pick', 'onboarding_id', o.id, 'short', to_jsonb(v_short), 'to', jsonb_build_array(v_mgr), 'title', v_title, 'body', v_body);
        end if;
      end if;
    exception when others then
      v_failed := v_failed || jsonb_build_object('onboarding_id', o.id, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('day', v_today, 'dry', p_dry, 'off', not v_on, 'behind', v_behind, 'role_pick', v_picks, 'autopick_told', v_told,
                            'sent', case when p_dry or not v_on then 0 else v_behind + v_picks + v_told end, 'autopick', v_auto, 'plan', v_plan, 'failed', v_failed);
end $function$;
revoke all on function public.wa279_onboard_tick(boolean) from public, anon, authenticated;
grant execute on function public.wa279_onboard_tick(boolean) to service_role;
comment on function public.wa279_onboard_tick(boolean) is 'wave279: the daily onboarding job (cron wa-onboard-behind, weekdays 12:35 UTC): the Hub''s role-training pick (on the Toronto date) and a message to the manager saying what it picked (once per plan and section), then a behind message to the hire and their manager (HR too from the third), then the manager''s reminder to pick role trainings. Managers'' links go to Home, HR''s to Onboarding in the HR centre. Nothing is sent unless app_config onboard_behind_on is on; p_dry returns the plan and sends nothing.';

-- the notification kinds
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender, active) values
  ('onboard_behind', 'people', 'People and HR', 81, 'Onboarding: you''re behind',
   'When steps on your onboarding plan are more than 2 days past their due date. At most once a week while you are behind.',
   'How many steps are late, the section they are in and the first five, with a link to My page.',
   'You''re behind on onboarding', 'You''re behind on 3 onboarding steps from Week 1: Meet your buddy, Set up your calendar, Read the handbook.', '#mypage',
   true, true, false, false, 'a new hire', 'wa279_onboard_tick, notify', true),
  ('onboard_behind_lead', 'people', 'People and HR', 82, 'Onboarding: a hire is behind',
   'When steps on the onboarding plan of someone you manage are more than 2 days past their due date. At most once a week. HR hears too from the third message on a plan.',
   'Who is behind, how many steps and the first five, with a link to Home (HR''s link goes to Onboarding in the HR centre).',
   'Alex Tremblay is behind on onboarding', 'Alex Tremblay is behind on 3 onboarding steps from Week 1: Meet your buddy, Set up your calendar, Read the handbook.', '#mypage',
   true, true, false, false, 'the new hire''s manager and the HR notify list (from the third message)', 'wa279_onboard_tick, notify', true),
  ('onboard_role_pick', 'people', 'People and HR', 83, 'Onboarding: pick role trainings',
   'From day 21 of a new hire''s plan, every 7 days while their 60 days or 90 days list of role trainings is short. The Hub picks for you on day 29 and day 59 if you don''t, and tells you what it picked.',
   'Who needs role trainings picked and how many, or what the Hub picked, with a link to Home.',
   'Pick Alex Tremblay''s role trainings', 'Pick 2 or 3 trainings for Alex Tremblay''s 60 days and 5 or 6 for their 90 days. The Hub picks for you on day 29 and day 59 if you don''t.', '#mypage',
   true, true, false, false, 'the new hire''s manager', 'wa279_onboard_tick, notify', true)
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says,
  example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email,
  channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = excluded.active, updated_at = now();

-- the settings: off until release; the two dates are set at release
insert into public.app_config (key, value) values ('onboard_behind_on', 'off'), ('onboard_behind_since', ''), ('onboard_role_picks_since', '')
on conflict (key) do nothing;

-- weekdays at 12:35 UTC (8:35 Toronto in summer time)
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'wa-onboard-behind') then perform cron.unschedule('wa-onboard-behind'); end if;
  perform cron.schedule('wa-onboard-behind', '35 12 * * 1-5', 'select public.wa279_onboard_tick()');
end $cron$;
