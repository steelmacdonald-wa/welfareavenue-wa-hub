-- Welfare Avenue Hub: wave279 (279a) undo, 04/11/26. Reverses build/wa279a_rules.sql (part 1, Task 1): onboarding_template_propagate() comes back exactly as live
-- had it before wave279 (same body, comment and grants), the flow trigger and the two new functions go, and onboarding_template.setup_covered is dropped.
-- Steps already deleted from plans by the flow trigger are not put back (they were covered by the setup page). Safe to run twice.
-- Later parts of wa279a (Tasks 2 to 4) add their undo here, ABOVE the propagate restore only where they depend on it.

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
