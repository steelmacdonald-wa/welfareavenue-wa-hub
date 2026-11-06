-- wa280a undo: the job watchdog off, call_edge back to its wave279 form. The three columns added to wa_health_checks stay (harmless).
select cron.unschedule('wa-job-watch') where exists (select 1 from cron.job where jobname = 'wa-job-watch');
create or replace function public.call_edge(fn text, payload jsonb default '{}'::jsonb)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare rid bigint;
begin
  select net.http_post(
    url := 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4',
      'x-wa-secret', public.get_secret('WA_TRIGGER_SECRET')
    ),
    body := payload,
    timeout_milliseconds := 10000
  ) into rid;
  return rid;
end $function$;
drop function if exists public.wa280_job_health();
drop table if exists public.wa_edge_calls;
