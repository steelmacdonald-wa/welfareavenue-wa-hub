-- Welfare Avenue Hub: wave275b undo, 03/11/26. Reverses build/wa275b_optional.sql: the offer-sent trigger function, the card row (wa275_flow_row), the
-- ask_availability column default (true) and its comment come back exactly as build/wa275a_streamlined.sql has them (sections 2, 4 and 6, copied from it),
-- and the three settings onboard_ask_hire_availability, onboard_manager_hours and onboard_require_hours go. Safe to run twice. Run it BEFORE wa275a_undo.sql;
-- if wa275a is already undone, only the settings are removed (the wa275a objects are left gone).
-- It changes no flow: the switch wa275b turned to "already communicated" on unanswered flows stays as it is (logged in change_log by
-- 'wa275b (Steel 03/11/26: ...)'); HR turns any of them back with the card's switch. The functions must go back to versions that do not read the settings
-- first (onboard-run and onboard-link before wave275b, and the page), or a missing setting reads as off there too.

-- 1. the three settings
delete from public.app_config where key in ('onboard_ask_hire_availability', 'onboard_manager_hours', 'onboard_require_hours');

-- 2. wa275a's column default, comment, trigger function and card row (only while wa275a's objects exist)
do $undo$
begin
  if to_regprocedure('public.wa275_week_of(bigint)') is not null and to_regclass('public.hub_onboard_flows') is not null then
    alter table public.hub_onboard_flows alter column ask_availability set default true;
    execute $wa275a$
comment on column public.hub_onboard_flows.ask_availability is 'wave275: true (the default), the hire is asked for their availability when they say no; false, availability was already communicated, so a no shows "thanks, the manager will be in touch" and HR or the manager enters the hire''s times on the card. Set from the card.'
$wa275a$;
    execute $wa275a$
create or replace function public.wa275_offer_sent()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  insert into public.hub_onboard_flows (candidate_id, practice, status, manager_member_id)
  values (new.id, new.practice, 'offered', new.onboard_manager_id)
  on conflict (candidate_id) do nothing;
  return new;
end $function$
$wa275a$;
    execute $wa275a$
revoke all on function public.wa275_offer_sent() from public, anon, authenticated
$wa275a$;
    execute $wa275a$
comment on function public.wa275_offer_sent() is 'wave275: trigger function. When hub_candidates.offer_sent_at goes from empty to a time, creates the candidate''s onboarding flow in status offered (practice copied, manager_member_id = onboard_manager_id) once; if a flow exists already (a candidate who accepted on the wave271 path) it does nothing. Not callable.'
$wa275a$;
    execute $wa275a$
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
                         from public.hub_onboard_steps s where s.flow_id = f.id), '[]'::jsonb))
  from public.hub_onboard_flows f
  left join lateral (select public.wa275_week_of(f.manager_member_id) as week) w on f.manager_member_id is not null
  join public.hub_candidates c on c.id = f.candidate_id
  left join public.team_members m on m.id = f.manager_member_id
  where f.id = p_flow
$function$
$wa275a$;
    execute $wa275a$
revoke all on function public.wa275_flow_row(bigint) from public, anon, authenticated
$wa275a$;
    execute $wa275a$
comment on function public.wa275_flow_row(bigint) is 'wave275: one flow as the card list shows it (jsonb): everything wave271''s Ready list gave (flow_id, candidate_id, status, practice, name, role, email, accepted_on, offer dates, late, grids, call_at, one_on_one_at, manager_member_id, default_manager, other_open_rows) plus manager_name, offer_hours, hours_confirmed_at, the proposal (proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at), the answer (hire_answer, hire_answered_at), ask_availability, setup_ticks, welcome_sent_at, accounts_at, and the manager''s week (amended 02/11/26: wa275_week_of, wave276''s typical week): manager_availability_at (when it was saved), manager_no_week and manager_week_stale. default_manager is HR''s only (null for a manager). Does no access check of its own: only wa271_ready_list and wa275_my_cards call it, after theirs. Not callable from the browser.'
$wa275a$;
  end if;
end $undo$;
