-- Welfare Avenue Hub: wave279 (279a) undo, 04/11/26. Reverses build/wa279a_rules.sql in reverse order: part 2 (Task 2, role picks) first, then part 1 (Task 1).
-- Part 2: wa166_path_state comes back exactly as live had it (same body, comment and grants), the wa279 role functions and the onboarding_role_picks table go.
--   Academy assignments the picks created are kept (they are ordinary assignments, note "Role training (60 days)" or "(90 days)"); HR can end them in the Academy.
-- Part 1: onboarding_template_propagate() comes back exactly as live had it before wave279 (same body, comment and grants), the flow trigger and the two new
-- functions go, and onboarding_template.setup_covered is dropped.
-- Steps already deleted from plans by the flow trigger are not put back (they were covered by the setup page). Safe to run twice.
-- Later parts of wa279a (Tasks 3 and 4) add their undo here, ABOVE this part 2 block where they depend on it.

-- Part 2, 1. wa166_path_state back to the live body (before wa279_role_state goes, which the wave279 body reads)
create or replace function public.wa166_path_state(p_member bigint, p_key text)
returns jsonb language sql stable security definer set search_path to '' as $function$
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

-- Part 2, 2. the role functions and the table (the picks table goes with its rows)
drop function if exists public.wa279_role_autopick(date);
drop function if exists public.wa279_role_save(bigint, text, bigint[]);
drop function if exists public.wa279_role_options(bigint, date);
drop function if exists public.wa279_role_state(bigint, text);
drop function if exists public.wa279_pick_remove(bigint, text);
drop function if exists public.wa279_pick_add(bigint, text, bigint, text, boolean);
drop function if exists public.wa279_recommended(bigint);
drop function if exists public.wa279_can_pick(bigint);
drop function if exists public.wa279_plan_manager(bigint);
drop table if exists public.onboarding_role_picks;

-- 1. the flow trigger and its function
drop trigger if exists trg_wa279_flow_plan on public.hub_onboard_flows;
drop function if exists public.wa279_flow_plan();

-- 2. propagate back to the live body (before wa279_via_setup and the column go, which the wave279 body reads)
create or replace function public.onboarding_template_propagate()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'INSERT' then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
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
comment on function public.onboarding_template_propagate() is 'Trigger on onboarding_template: adds new or re-activated steps to active onboarding plans and removes deactivated ones.';

-- 3. the helper and the column
drop function if exists public.wa279_via_setup(bigint);
alter table public.onboarding_template drop column if exists setup_covered;
