-- wa280a (05/11/26): the job watchdog. Steel: "could you notify admins next time something like this isn't working".
-- The Loom pull failed every half hour from 26/10/26 to 05/11/26 (344 runs) and nobody knew: call_edge sends a job's request and
-- forgets it, pg_net keeps the answer for about six hours without saying which function it came from, and loom-pull answers
-- "started" before its run fails in the background. Now:
--   1. call_edge notes which function each request went to (wa_edge_calls, two days); a failed note never stops the job.
--   2. wa280_job_health() reads each watched job's state: the Loom pull's last three finished runs, the Meet attendance sync, and
--      every function called by call_edge (its last three answers in pg_net's six hours: 5xx, 401 or 403, or a 2xx saying
--      "ok": false; timeouts after call_edge's 10 seconds do not count, many jobs run longer than that). A job seldom called
--      counts with fewer answers (a daily job's one failed answer is enough).
--   3. health-check v3 runs it every hour (wa-job-watch, :20) and tells the admins by Slack DM when a job stops working, again
--      once a day while it stays down, and when it works again.
-- Undo: build/wa280a_undo.sql.

create table if not exists public.wa_edge_calls (
  id bigint primary key,                       -- pg_net's request id (net._http_response.id)
  fn text not null,
  at timestamptz not null default now()
);
create index if not exists wa_edge_calls_fn_at on public.wa_edge_calls (fn, at desc);
alter table public.wa_edge_calls enable row level security;   -- no policies: the service role and definer functions only
comment on table public.wa_edge_calls is 'wave280: which edge function each call_edge request went to, so the watchdog can read pg_net''s answers per job. Kept two days.';

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
  begin   -- wave280: the watchdog's note; never stops the job
    insert into public.wa_edge_calls (id, fn) values (rid, fn) on conflict (id) do nothing;
  exception when others then null;
  end;
  return rid;
end $function$;

alter table public.wa_health_checks
  add column if not exists label text,
  add column if not exists down_since timestamptz,
  add column if not exists last_alert_at timestamptz;

create or replace function public.wa280_job_health()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  out jsonb := '[]'::jsonb;
  r record;
  v_n int; v_bad int; v_note text; v_since timestamptz; v_lastok timestamptz;
begin
  delete from public.wa_edge_calls where at < now() - interval '2 days';

  /* 1. the Loom pull: down when its last three finished runs all failed */
  select count(*), count(*) filter (where x.status in ('error', 'refused', 'no_key'))
    into v_n, v_bad
    from (select status from public.loom_pull_runs where finished_at is not null order by started_at desc limit 3) x;
  if v_n > 0 then
    select max(started_at) into v_lastok from public.loom_pull_runs where status in ('ok', 'partial');
    select l.note into v_note from public.loom_pull_runs l where l.finished_at is not null order by l.started_at desc limit 1;
    select min(started_at) into v_since from public.loom_pull_runs where finished_at is not null and started_at > coalesce(v_lastok, '-infinity'::timestamptz);
    out := out || jsonb_build_array(jsonb_build_object(
      'service', 'job:loom-pull', 'label', 'The Loom pull (meetings into the Hub)',
      'ok', not (v_n = 3 and v_bad = 3),
      'error', case when v_n = 3 and v_bad = 3 then left(coalesce(v_note, 'failed'), 400) end,
      'since', case when v_n = 3 and v_bad = 3 then v_since end));
  end if;

  /* 2. the Meet attendance sync (every six hours): down after two failed runs in a row (no success for 13 hours) */
  for r in select m.last_ok, m.last_ok_at, m.note from public.meet_sync_state m order by m.id limit 1 loop
    out := out || jsonb_build_array(jsonb_build_object(
      'service', 'job:meet-attendance', 'label', 'The Google Meet attendance sync',
      'ok', coalesce(r.last_ok, true) or coalesce(r.last_ok_at, now()) > now() - interval '13 hours',
      'error', case when not coalesce(r.last_ok, true) then left(coalesce(r.note, 'failed'), 400) end,
      'since', case when not coalesce(r.last_ok, true) then r.last_ok_at end));
  end loop;

  /* 3. every function call_edge calls: its last three answers in pg_net's window all failed (fewer for a job seldom called).
        The two jobs checked above are left out here, so one failure is not told twice (and the Meet sync gets its 13 hours). */
  for r in
    with c as (
      select e.fn, e.at, x.status_code, x.content
        from public.wa_edge_calls e
        join net._http_response x on x.id = e.id
       where e.at > now() - interval '6 hours' and not coalesce(x.timed_out, false) and x.status_code is not null
         and e.fn not in ('loom-pull', 'meet-attendance')
    ), f as (
      select fn, at, status_code,
             (status_code >= 500 or status_code in (401, 403) or (status_code < 300 and coalesce(content, '') ~ '"ok"\s*:\s*false')) as failed,
             coalesce(nullif(substring(coalesce(content, '') from '"(?:error|message)"\s*:\s*"([^"]{1,250})'), ''), nullif(left(coalesce(content, ''), 200), '')) as what,
             row_number() over (partition by fn order by at desc) as rn
        from c
    )
    select fn,
           bool_and(failed) filter (where rn <= 3) as all_bad,
           max(what) filter (where rn = 1) as last_what,
           max(status_code) filter (where rn = 1) as last_code,
           min(at) filter (where rn <= 3) as since
      from f group by fn
  loop
    out := out || jsonb_build_array(jsonb_build_object(
      'service', 'fn:' || r.fn, 'label', 'The scheduled job ' || r.fn,
      'ok', not coalesce(r.all_bad, false),
      'error', case when r.all_bad then 'It answered ' || r.last_code || coalesce(': ' || r.last_what, '') end,
      'since', case when r.all_bad then r.since end));
  end loop;

  return out;
end $function$;
revoke all on function public.wa280_job_health() from public, anon, authenticated;
comment on function public.wa280_job_health() is 'wave280: the watched jobs and whether each works now ({service, label, ok, error, since}); read hourly by health-check v3 (action jobs).';

select cron.unschedule('wa-job-watch') where exists (select 1 from cron.job where jobname = 'wa-job-watch');
select cron.schedule('wa-job-watch', '20 * * * *', $$select public.call_edge('health-check', '{"action":"jobs"}'::jsonb)$$);
