-- wave147: Search Console read every day (and connected on its own as soon as the property is shared); Analytics readers
-- are told in their profiles
select cron.unschedule('wa-search-console') where exists (select 1 from cron.job where jobname = 'wa-search-console');
select cron.schedule('wa-search-console', '37 9 * * *', $$select public.call_edge('search-console', '{"action":"sync","days":10}'::jsonb)$$);
update public.hub_access_profiles
   set can = can || to_jsonb('Google Search on the Analytics page: how people find the website, the searches that bring them and the pages they open'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key in ('marketing', 'executive') and not (can::text like '%Google Search%');
