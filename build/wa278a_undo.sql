-- Welfare Avenue Hub: wave278 (278a) undo, 04/11/26. Reverses build/wa278a_onboarding.sql: the card row (wa275_flow_row) comes back exactly as
-- build/wa275b_optional.sql has it (section 5, copied from it; it is the live one), wa278_hub_seen() goes, the three columns (hub_candidates.offer_sent_by,
-- hub_onboard_flows.leader and welcome_cc) go, and the eleven settings go. Safe to run twice. Run it BEFORE wa275b_undo.sql.
-- The rundown ticks are not taken back to wave275's keys (a dropped rd_loom cannot be known again); instead, so the wave275 setup page and card still show
-- what the hire ticked, rd_profile is put back from rd_chrome and rd_drives from rd_drive wherever the old key is unset. The new keys stay beside them (the
-- wave275 page reads only its own keys), and applying wa278a again drops the old keys and keeps the new ones, so a tick is never counted twice.
-- The functions and the page must go back to versions that do not read these columns and settings first (recruit-actions, onboard-run, onboard-link, the
-- card and the sign-in call), or they fail on a missing column or read a missing setting as off.

-- 1. the card row back to wa275b's (only while wa278a's is the one in place: if wa275b or wa275a is already undone, it is left as it is)
do $undo$
begin
  if to_regprocedure('public.wa275_flow_row(bigint)') is not null
     and pg_get_functiondef('public.wa275_flow_row(bigint)'::regprocedure) like '%owner_email%' then
    execute $wa275b$
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
$function$
$wa275b$;
    execute $wa275b$
revoke all on function public.wa275_flow_row(bigint) from public, anon, authenticated
$wa275b$;
    execute $wa275b$
comment on function public.wa275_flow_row(bigint) is 'wave275, wave275b: one flow as the card list shows it (jsonb): everything wave271''s Ready list gave (flow_id, candidate_id, status, practice, name, role, email, accepted_on, offer dates, late, grids, call_at, one_on_one_at, manager_member_id, default_manager, other_open_rows) plus manager_name, offer_hours, hours_confirmed_at, the proposal (proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at), the answer (hire_answer, hire_answered_at), ask_availability, setup_ticks, welcome_sent_at, accounts_at, and the manager''s week (amended 02/11/26: wa275_week_of, wave276''s typical week): manager_availability_at (when it was saved), manager_no_week and manager_week_stale, and (wave275b) manager_hours: app_config onboard_manager_hours is on, so the week limits the times (off or absent: false, the week is information only). default_manager is HR''s only (null for a manager). Does no access check of its own: only wa271_ready_list and wa275_my_cards call it, after theirs. Not callable from the browser.'
$wa275b$;
  end if;
end $undo$;

-- 2. the Hub-signed-in tick
drop function if exists public.wa278_hub_seen();

-- 3. the ticks the wave275 page reads, put back beside the new keys (never over an old key that is set)
do $undo$
begin
  if to_regclass('public.hub_onboard_flows') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'setup_ticks') then
    update public.hub_onboard_flows f
       set setup_ticks = f.setup_ticks
             || case when f.setup_ticks ->> 'rd_chrome' is not null and f.setup_ticks ->> 'rd_profile' is null
                     then jsonb_build_object('rd_profile', f.setup_ticks -> 'rd_chrome') else '{}'::jsonb end
             || case when f.setup_ticks ->> 'rd_drive' is not null and f.setup_ticks ->> 'rd_drives' is null
                     then jsonb_build_object('rd_drives', f.setup_ticks -> 'rd_drive') else '{}'::jsonb end,
           updated_at = now()
     where (f.setup_ticks ->> 'rd_chrome' is not null and f.setup_ticks ->> 'rd_profile' is null)
        or (f.setup_ticks ->> 'rd_drive' is not null and f.setup_ticks ->> 'rd_drives' is null);
  end if;
end $undo$;

-- 4. the three columns (the card row above no longer reads them)
alter table if exists public.hub_onboard_flows drop column if exists leader;
alter table if exists public.hub_onboard_flows drop column if exists welcome_cc;
alter table if exists public.hub_candidates drop column if exists offer_sent_by;

-- 5. the eleven settings (onboard_slack_join_link is older than wave278 and stays)
delete from public.app_config where key in ('onboard_auto_groups', 'onboard_auto_drives', 'onboard_auto_meeting', 'onboard_auto_channel', 'onboard_leader_titles',
  'onboard_groups', 'onboard_drives', 'onboard_weekly_meetings', 'onboard_slack_channel_link', 'onboard_slack_channel_id', 'onboard_setup_video');
