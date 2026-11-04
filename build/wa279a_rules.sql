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
