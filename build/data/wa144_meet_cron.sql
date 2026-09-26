-- wave144: the Meet attendance run every six hours (the last eight days, so moved meetings and late log rows settle)
select cron.unschedule('wa-meet-attendance') where exists (select 1 from cron.job where jobname = 'wa-meet-attendance');
select cron.schedule('wa-meet-attendance', '47 */6 * * *', $$select public.call_edge('meet-attendance', '{"action":"sync","days":8}'::jsonb)$$);
comment on column public.meet_meetings.held is 'Someone stayed three minutes or more on a call matched to this meeting (meeting notetakers are not counted).';
-- the attendance helpers are for signed-in people only (applied as wa144_meet_grants)
revoke execute on function public.wa_leads_team(text), public.wa_in_team(text), public.wa_meet_people_ok(text) from public, anon;
grant execute on function public.wa_leads_team(text), public.wa_in_team(text), public.wa_meet_people_ok(text) to authenticated, service_role;
