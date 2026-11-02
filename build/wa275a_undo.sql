-- Welfare Avenue Hub: wave275 (275a) undo, 02/11/26. Reverses build/wa275a_streamlined.sql: puts wa271_cand_accepted and wa271_ready_list back exactly as wave271 had them
-- (build/wa271a_onboard.sql sections 7 and 9), drops the offer-sent trigger, the wa275 functions, the availability check, the new columns, the three notification kinds
-- and the three settings, and takes the flow status check back to the wave271 list. Safe to run twice. Run it BEFORE build/wa271a_undo.sql.
-- It deletes the flows still in status offered (no hire has accepted; the wave271 flow never existed before Accept) and with them their grids and step results.
-- Everything a hire accepted keeps its flow (waiting or later), minus the wave275 columns (the proposal, the answer, the setup ticks). hub_candidates keeps its
-- other data; it loses offer_hours, onboard_manager_id and hours_confirmed_at. team_members loses availability and availability_at.
-- If wa271a_undo.sql has already run, the wave271 objects are left gone (the restore is skipped).

-- 1. the trigger and its function
drop trigger if exists wa275_offer_sent on public.hub_candidates;
drop function if exists public.wa275_offer_sent();

-- 2. flows that were only offered go; the rest keep their row. The wave271 status list comes back.
do $undo$
begin
  if to_regclass('public.hub_onboard_flows') is not null then
    delete from public.hub_onboard_flows where status = 'offered';
    alter table public.hub_onboard_flows drop constraint if exists hub_onboard_flows_status_check;
    alter table public.hub_onboard_flows add constraint hub_onboard_flows_status_check check (status in ('waiting', 'ready', 'running', 'started', 'backed_out'));
    comment on column public.hub_onboard_flows.status is 'waiting (accepted, grid not done or not picked), ready (times picked), running (Start onboarding is working), started (done, leaves the Ready list), backed_out (the hire withdrew after accepting).';
    alter table public.hub_onboard_flows drop column if exists proposed_call_at;
    alter table public.hub_onboard_flows drop column if exists proposed_one_on_one_at;
    alter table public.hub_onboard_flows drop column if exists proposed_by;
    alter table public.hub_onboard_flows drop column if exists proposed_at;
    alter table public.hub_onboard_flows drop column if exists hire_answer;
    alter table public.hub_onboard_flows drop column if exists hire_answered_at;
    alter table public.hub_onboard_flows drop column if exists setup_ticks;
    alter table public.hub_onboard_flows drop column if exists welcome_sent_at;
    alter table public.hub_onboard_flows drop column if exists accounts_at;
    alter table public.hub_onboard_flows drop column if exists ask_availability;
  end if;
end $undo$;

-- 3. the two wave271 functions, exactly as build/wa271a_onboard.sql has them (only while the wave271 objects exist)
do $undo$
begin
  if to_regclass('public.hub_onboard_flows') is not null then
    execute $wa271$
create or replace function public.wa271_cand_accepted()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  insert into public.hub_onboard_flows (candidate_id, practice, status) values (new.id, new.practice, 'waiting')
  on conflict (candidate_id) do nothing;
  return new;
end $function$;
$wa271$;
    execute $wa271$
create or replace function public.wa271_ready_list()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.wa271_can() then raise exception 'Only HR can see the onboarding list'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.accepted_on, x.id) from (
      select f.id, c.accepted_on, jsonb_build_object(
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
        'default_manager', public.wa271_default_manager(c.id),
        'other_open_rows', (select count(*) from public.hub_candidates o
                             where o.id <> c.id and nullif(lower(trim(coalesce(c.email, ''))), '') is not null
                               and lower(trim(coalesce(o.email, ''))) = lower(trim(c.email))
                               and o.status not in ('declined', 'withdrawn'))) as j
        from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id
       where f.status not in ('started', 'backed_out')
         and c.status not in ('declined', 'withdrawn')
         and not exists (select 1 from public.onboardings p join public.team_members m on m.id = p.member_id
                          where p.completed_at is null and p.id is distinct from f.onboarding_id
                            and (m.id = c.member_id or (nullif(lower(trim(coalesce(c.email, ''))), '') is not null and lower(trim(coalesce(m.email, ''))) = lower(trim(c.email)))))) x
  ), '[]'::jsonb);
end $function$;
$wa271$;
  end if;
end $undo$;
do $undo$
begin
  if to_regclass('public.hub_onboard_flows') is not null then
    revoke all on function public.wa271_cand_accepted() from public, anon, authenticated;
    comment on function public.wa271_cand_accepted() is 'wave271: trigger function. When hub_candidates.accepted_on goes from empty to a date, creates the candidate''s onboarding flow (waiting, practice copied) once. Not callable.';
    revoke all on function public.wa271_ready_list() from public, anon;
    grant execute on function public.wa271_ready_list() to authenticated, service_role;
    comment on function public.wa271_ready_list() is 'wave271: the HR Center Ready to onboard list as jsonb: every flow not started or backed out, on a card not declined or withdrawn, for someone with no other open plan, with name, role, personal email, offer dates, late (answered after the respond-by date), grid statuses (none or marked), the default manager and other_open_rows (other applications with the same email that are not declined or withdrawn). HR, admins and the service key only; raises for anyone else.';
  end if;
end $undo$;

-- 4. the wave275 functions (the availability check constraint goes before the functions it calls)
alter table if exists public.team_members drop constraint if exists team_members_availability_check;
drop function if exists public.wa275_my_cards();
drop function if exists public.wa275_flow_row(bigint);
drop function if exists public.wa275_manager_of(bigint);
drop function if exists public.wa275_availability_set(jsonb);
drop function if exists public.wa275_availability_of(bigint);
drop function if exists public.wa275_tick_set(bigint, text, jsonb, boolean);
drop function if exists public.wa275_plan_assign(bigint, text, date);
drop function if exists public.wa275_availability_ok(jsonb);
drop function if exists public.wa275_blocks_ok(jsonb);

-- 5. the columns and the index
drop index if exists public.hub_candidates_onboard_manager_idx;
alter table if exists public.hub_candidates drop column if exists offer_hours;
alter table if exists public.hub_candidates drop column if exists onboard_manager_id;
alter table if exists public.hub_candidates drop column if exists hours_confirmed_at;
alter table if exists public.team_members drop column if exists availability;
alter table if exists public.team_members drop column if exists availability_at;

-- 6. the notification kinds and the settings (onboard_v2_since too, if it was set at release)
delete from public.hub_notification_kinds where key in ('onboard_propose', 'onboard_answer', 'onboard_ready');
delete from public.app_config where key in ('onboard_auto_hub', 'onboard_propose_lead_hours', 'onboard_yes_lead_hours', 'onboard_v2_since');
