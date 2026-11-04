-- Welfare Avenue Hub: wave275b, 03/11/26. Steel: "Can we make the availability check for onboarding optional." Asked which: all four. The fourth (the hire's
-- 10-hour grid minimum, onboard_grid_min_hours) is already a setting and is 0 live. This file makes the other three settings HR can change, with Steel's
-- defaults, off:
--   onboard_ask_hire_availability  whether a new flow starts with "Availability: ask the hire" on (the offer-sent trigger reads it). Off: already communicated,
--                                  so a No shows "<manager> will be in touch with other times" and HR or the manager books from the card.
--   onboard_manager_hours          whether the manager's typical week (wave276, through wa275_availability_of) limits the times. Read by onboard-run (propose,
--                                  the hire's Yes, the card's times) and onboard-link (the mgr page, the hire's No grid); the card row carries it (manager_hours).
--   onboard_require_hours          whether Accept needs the "I confirm I can give at least N hours a week" box. Read by onboard-link.
-- On top of build/wa275a_streamlined.sql (live since 03/11/26). Safe to run twice: the keys are added once (on conflict do nothing, so a value HR set stays),
-- and the one-time switch of live flows below runs only on the run that adds onboard_ask_hire_availability.
-- Proved offline first: node test/w271sql.mjs (PGlite, with test/w275sql.sql's wave275b section). Undo: build/wa275b_undo.sql (before build/wa275a_undo.sql).

-- 1. live flows that have not been answered yet follow Steel's rule too (Samuel Aubrey's flow 8 on 03/11/26): offered or waiting, no hire_answer, still asking
--    the hire, become "already communicated", each logged in change_log as the card logs its switch. Once only: on the run that adds the setting. The card's
--    per-flow switch stays and still overrides.
do $wa275b$
begin
  if not exists (select 1 from public.app_config where key = 'onboard_ask_hire_availability') then
    with switched as (
      update public.hub_onboard_flows set ask_availability = false, updated_at = now()
       where status in ('offered', 'waiting') and hire_answer is null and ask_availability
      returning id)
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    select 'onboard_flow', s.id::text, 'ask_availability', 'ask the hire', 'already communicated', 'wa275b (Steel 03/11/26: availability optional, off by default)' from switched s;
  end if;
end $wa275b$;

-- 2. the three settings (HR can change them in app_config): off
insert into public.app_config (key, value) values
  ('onboard_ask_hire_availability', 'off'), ('onboard_manager_hours', 'off'), ('onboard_require_hours', 'off')
on conflict (key) do nothing;

-- 3. a flow made any other way (Accept with no offer-sent flow) takes the column default: already communicated
alter table public.hub_onboard_flows alter column ask_availability set default false;
comment on column public.hub_onboard_flows.ask_availability is 'wave275, wave275b: true, the hire is asked for their availability when they say no; false, availability was already communicated, so a no shows "thanks, the manager will be in touch" and HR or the manager enters the hire''s times on the card. A new flow takes app_config onboard_ask_hire_availability (on: true; off or absent: false, the default since wave275b, 03/11/26). Set from the card, whose switch overrides.';

-- 4. the offer going out starts the flow (wa275a section 4, replaced in full; only the ask_availability line is new)
create or replace function public.wa275_offer_sent()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  insert into public.hub_onboard_flows (candidate_id, practice, status, manager_member_id, ask_availability)
  values (new.id, new.practice, 'offered', new.onboard_manager_id,
          coalesce((select lower(trim(k.value)) = 'on' from public.app_config k where k.key = 'onboard_ask_hire_availability'), false))
  on conflict (candidate_id) do nothing;
  return new;
end $function$;
revoke all on function public.wa275_offer_sent() from public, anon, authenticated;
comment on function public.wa275_offer_sent() is 'wave275, wave275b: trigger function. When hub_candidates.offer_sent_at goes from empty to a time, creates the candidate''s onboarding flow in status offered (practice copied, manager_member_id = onboard_manager_id, ask_availability from app_config onboard_ask_hire_availability: on true, off or absent false) once; if a flow exists already (a candidate who accepted on the wave271 path) it does nothing. Not callable.';

-- 5. the card row (wa275a section 6, replaced in full; only manager_hours is new): whether the manager's week limits the times, so the card words its
--    week line as a prompt (on) or as information (off). The page never reads app_config for it.
create or replace function public.wa275_flow_row(p_flow bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'flow_id', f.id,
    'candidate_id', c.id,
    'status', f.status,
    'practice', f.practice,
    'name', c.name,
    'role', c.role,
    'email', c.email,
    'accepted_on', c.accepted_on,
    'offer_respond_by', c.offer_respond_by,
    'offer_start', c.offer_start,
    'late', coalesce(c.accepted_on > c.offer_respond_by, false),
    'grids', jsonb_build_object(
      'hire', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'hire' and cardinality(g.slots) > 0) then 'marked' else 'none' end,
      'manager', case when exists (select 1 from public.hub_onboard_grids g where g.flow_id = f.id and g.who = 'manager' and cardinality(g.slots) > 0) then 'marked' else 'none' end),
    'call_at', f.call_at,
    'one_on_one_at', f.one_on_one_at,
    'manager_member_id', f.manager_member_id,
    'manager_name', m.name,
    'default_manager', case when public.wa271_can() then public.wa271_default_manager(c.id) end,   -- HR only; null for a manager (the function raises for anyone else)
    'other_open_rows', (select count(*) from public.hub_candidates o
                         where o.id <> c.id and nullif(lower(trim(coalesce(c.email, ''))), '') is not null
                           and lower(trim(coalesce(o.email, ''))) = lower(trim(c.email))
                           and o.status not in ('declined', 'withdrawn')),
    'offer_hours', c.offer_hours,
    'hours_confirmed_at', c.hours_confirmed_at,
    'proposed_call_at', f.proposed_call_at,
    'proposed_one_on_one_at', f.proposed_one_on_one_at,
    'proposed_by', f.proposed_by,
    'proposed_at', f.proposed_at,
    'hire_answer', f.hire_answer,
    'hire_answered_at', f.hire_answered_at,
    'ask_availability', f.ask_availability,
    'setup_ticks', f.setup_ticks,
    'welcome_sent_at', f.welcome_sent_at,
    'accounts_at', f.accounts_at,
    'manager_availability_at', w.week -> 'availability_at',
    'manager_no_week', coalesce(w.week -> 'no_week', 'true'::jsonb),
    'manager_week_stale', coalesce(w.week -> 'stale', 'true'::jsonb))
  || jsonb_build_object(   -- Task 6: what the card shows for a manager, who cannot read the flow and step tables themselves
    'offer_sent_at', c.offer_sent_at,
    'created_at', f.created_at,
    'propose_path', (f.status = 'offered' or f.proposed_at is not null
                     or coalesce(f.created_at >= (select case when trim(k.value) ~ '^\d{4}-\d{2}-\d{2}' then trim(k.value)::timestamptz end from public.app_config k where k.key = 'onboard_v2_since'), false)),
    'member_id', c.member_id,
    'wa_email', f.wa_email,
    'canva_link', f.canva_link,
    'roster_created', f.roster_created,
    'slack_channel_id', f.slack_channel_id,
    'onboarding_id', f.onboarding_id,
    'group_session', f.group_session,
    'started_at', f.started_at,
    'updated_at', f.updated_at,
    'steps', coalesce((select jsonb_agg(jsonb_build_object('step', s.step, 'status', s.status, 'detail', s.detail, 'practice', s.practice, 'at', s.at) order by s.step)
                         from public.hub_onboard_steps s where s.flow_id = f.id), '[]'::jsonb),
    'manager_hours', coalesce((select lower(trim(k.value)) = 'on' from public.app_config k where k.key = 'onboard_manager_hours'), false))   -- wave275b
  from public.hub_onboard_flows f
  left join lateral (select public.wa275_week_of(f.manager_member_id) as week) w on f.manager_member_id is not null
  join public.hub_candidates c on c.id = f.candidate_id
  left join public.team_members m on m.id = f.manager_member_id
  where f.id = p_flow
$function$;
revoke all on function public.wa275_flow_row(bigint) from public, anon, authenticated;
comment on function public.wa275_flow_row(bigint) is 'wave275, wave275b: one flow as the card list shows it (jsonb): everything wave271''s Ready list gave (flow_id, candidate_id, status, practice, name, role, email, accepted_on, offer dates, late, grids, call_at, one_on_one_at, manager_member_id, default_manager, other_open_rows) plus manager_name, offer_hours, hours_confirmed_at, the proposal (proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at), the answer (hire_answer, hire_answered_at), ask_availability, setup_ticks, welcome_sent_at, accounts_at, and the manager''s week (amended 02/11/26: wa275_week_of, wave276''s typical week): manager_availability_at (when it was saved), manager_no_week and manager_week_stale, and (wave275b) manager_hours: app_config onboard_manager_hours is on, so the week limits the times (off or absent: false, the week is information only). default_manager is HR''s only (null for a manager). Does no access check of its own: only wa271_ready_list and wa275_my_cards call it, after theirs. Not callable from the browser.';
