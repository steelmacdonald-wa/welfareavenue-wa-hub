-- wa193b (02/10/26): two fixes found by the first test scan (run 1).
-- 1. fund_sources carried the touch trigger (wa_fund_touch sets updated_by) without an updated_by column, so every update of a
--    source failed ("record new has no field updated_by") and the scanner could not record what it had read.
-- 2. A scan runs in steps now (the function's wall clock is limited): fund_scan_runs counts them.
alter table public.fund_sources add column if not exists updated_by text;
comment on column public.fund_sources.updated_by is 'Who last changed the row (an email, or the function); kept by wa_fund_touch().';

alter table public.fund_scan_runs add column if not exists steps integer not null default 0;
comment on column public.fund_scan_runs.steps is 'How many function invocations the run took (grant-scan chains itself every ~2 minutes of work until every source is read).';

-- the first run never finished (the function was interrupted before the fix): close it
update public.fund_scan_runs set status = 'error', finished_at = coalesce(finished_at, now()),
  summary = 'The run stopped without finishing (the first test run, before the source updates were fixed).'
  where id = 1 and status = 'running';
