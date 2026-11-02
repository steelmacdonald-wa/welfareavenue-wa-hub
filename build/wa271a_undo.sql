-- Welfare Avenue Hub: wave271 (271a) undo, 01/11/26. Reverses build/wa271a_onboard.sql and, first, build/wa271b_remind.sql (section 0): drops the onboarding flow objects, puts the two-argument
-- onboarding_assign back exactly as live had it, and restores the onboarding call checklist to day 3. Safe to run twice.
-- It does NOT touch hub_candidates.accepted_on, start_date or any other candidate data. It does drop the flows, grids and step results (and the two offer date columns),
-- so run it only when the wave is being backed out; anything HR set up on the Ready list is lost.

-- 0. wave271b (build/wa271b_remind.sql), first, while the tables it touches still exist: the hourly job, its function, the three notification kinds and the two
--    manager-link columns. The hub_notifications_sent rows already logged stay (they are a record, and nothing reads the kind from the registry to show them).
do $undo$
begin
  if to_regclass('cron.job') is not null and exists (select 1 from cron.job where jobname = 'wa-onboard-remind') then perform cron.unschedule('wa-onboard-remind'); end if;
end $undo$;
drop function if exists public.wa271_remind();
delete from public.hub_notification_kinds where key in ('onboard_date', 'onboard_grid', 'onboard_remind');
alter table if exists public.hub_onboard_flows drop column if exists manager_link_sent_at;
alter table if exists public.hub_onboard_flows drop column if exists manager_link_member_id;

-- 1. the accept trigger and its function
drop trigger if exists wa271_cand_accepted on public.hub_candidates;
drop function if exists public.wa271_cand_accepted();

-- 2. the tables (grids and steps go with their flow; their policies go with them)
drop table if exists public.hub_onboard_steps;
drop table if exists public.hub_onboard_grids;
drop table if exists public.hub_onboard_flows;

-- 3. the functions
drop function if exists public.wa271_ready_list();
drop function if exists public.wa271_default_manager(bigint);
drop function if exists public.wa271_move_start(bigint, date);
drop function if exists public.wa271_can();

-- 4. onboarding_assign: the two-argument version, as it was (v_start is today again), with its old grants
drop function if exists public.onboarding_assign(bigint, text, date);
create or replace function public.onboarding_assign(p_member_id bigint, p_by text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_name text; v_start date := current_date;
begin
  if not public.is_wa_staff() then raise exception 'Only staff can start an onboarding plan'; end if;   -- audit 26/09/26
  select name into v_name from public.team_members where id = p_member_id;
  if v_name is null then raise exception 'member not found'; end if;
  insert into public.onboardings (member_id, person_name, assigned_by, started_at)
  values (p_member_id, v_name, p_by, v_start) returning id into v_id;
  insert into public.onboarding_steps (onboarding_id, template_id, due_date)
  select v_id, t.id, public.onb_due(t.section, v_start) from public.onboarding_template t where t.active on conflict do nothing;
  insert into public.hr_setup_steps (onboarding_id, template_id)
  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  perform public.wa166_onb_sync(v_id);   -- wave166: what they already did in the Avenue Academy is ticked
  return v_id;
end $function$;
revoke all on function public.onboarding_assign(bigint, text) from public, anon;
grant execute on function public.onboarding_assign(bigint, text) to authenticated, service_role;
comment on function public.onboarding_assign(bigint, text) is 'Starts an HR onboarding plan for a roster member: creates the onboardings row, copies the onboarding_template steps with due dates, and copies the hr_setup_template steps. p_by is stored as given. Staff only (checked inside). Called by the page (HR centre). Access: authenticated.';

-- 5. the offer date columns, the settings and the checklist day
alter table public.hub_candidates drop column if exists offer_respond_by;
alter table public.hub_candidates drop column if exists offer_start;
delete from public.app_config where key in ('onboard_grid_days', 'onboard_grid_start', 'onboard_grid_end', 'onboard_grid_cell_min', 'onboard_call_min', 'onboard_one_on_one_min',
  'onboard_remind_hours', 'onboard_password_days', 'onboard_auto_google', 'onboard_auto_slack', 'onboard_canva_link', 'onboard_slack_join_link', 'onboard_google_video');
update public.hr_setup_template set due_day = 3 where phase = 'The onboarding call' and due_day = 0;
