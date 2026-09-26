-- wave146: the security check on the first of each month (08:07 in Toronto), and the admin profile says so
select cron.unschedule('wa-security-check') where exists (select 1 from cron.job where jobname = 'wa-security-check');
select cron.schedule('wa-security-check', '7 12 1 * *', $$select public.call_edge('security-check', '{"action":"run","days":30}'::jsonb)$$);
update public.hub_access_profiles
   set can = can || to_jsonb('The monthly security check in Admin, Security: 2-step verification, unused accounts, files anyone with the link can open, sharing outside Welfare Avenue, unusual sign-ins and connected apps, each with what to do'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'admin' and not (can::text like '%monthly security check%');
