-- Welfare Avenue Hub: wave276 undo, 02/11/26. Reverses build/wa276_avail.sql: drops the two tables (every saved grid and ask goes with them), the wa_avail_
-- functions, the two notification kinds and the four avail_ settings. Touches nothing else: wa_leads_team, wa_in_team, wa180_my_teams, my_emails, hub_events
-- and the other kinds stay as they are. The hub_notifications_sent rows already logged stay (they are a record). Safe to run twice.
-- Run it only when the wave is being backed out (the page segment 276_wave276 and notify v18 should come out first).

drop table if exists public.hub_team_avail;
drop table if exists public.hub_team_avail_ask;

drop function if exists public.wa_avail_ask_set(text, date, text);
drop function if exists public.wa_avail_team(text);
drop function if exists public.wa_avail_snooze(text);
drop function if exists public.wa_avail_save(text, date, smallint[]);
drop function if exists public.wa_avail_mine(text);
drop function if exists public.wa_avail_due();
drop function if exists public.wa_avail_manager_of(text, text);
drop function if exists public.wa_avail_can_see(text);
drop function if exists public.wa_avail_can_manage(text);
drop function if exists public.wa_avail_setting(text);

delete from public.hub_notification_kinds where key in ('meet_propose', 'meet_avail_ask');
delete from public.app_config where key in ('avail_min_hours', 'avail_grid_start', 'avail_grid_end', 'avail_cell_min');
