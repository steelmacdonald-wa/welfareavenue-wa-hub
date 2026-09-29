-- =====================================================================================================================
-- wave162c (28/09/26): the Loom connection through Atlassian's sign-in and approval (OAuth 2.1 with PKCE), for the Loom pull.
-- Atlassian refused the personal API token for the Welfare Avenue site ("cloud id isn't explicitly granted by the user") while
-- the same account, connected through the approval screen, could read Loom. An admin now presses Connect Loom on the Loom card,
-- signs in to Atlassian as hub@welfareavenue.com and approves reading Loom; loom-connect keeps the lasting key in the vault
-- (LOOM_OAUTH_REFRESH, with the client registration in LOOM_OAUTH_CLIENT) and loom-pull uses it before the API token.
-- =====================================================================================================================

create table if not exists public.loom_oauth_pending (
  nonce text primary key,
  verifier text not null,
  who text,
  created_at timestamptz not null default now()
);
alter table public.loom_oauth_pending enable row level security;
comment on table public.loom_oauth_pending is 'One row per Connect Loom press (wave162c): the PKCE verifier for the approval that is under way, kept server side and used once when Atlassian sends the admin back (loom-connect). No policies: only the service role reads or writes it; rows older than 15 minutes are ignored and cleared.';

create or replace function public.loom_pull_status()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare v_since date; v_next timestamptz;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Admins only'; end if;
  v_since := coalesce((select nullif(trim(value), '')::date from public.app_config where key = 'loom_pull_since' and value ~ '^\s*\d{4}-\d{2}-\d{2}\s*$'), date '2026-09-02');
  select min(t) into v_next from (
    select ((d::date + time '07:30') at time zone 'America/Toronto') as t
    from generate_series((now() at time zone 'America/Toronto')::date, (now() at time zone 'America/Toronto')::date + 8, interval '1 day') d
    where extract(isodow from d) in (1, 3, 5)) x
  where t > now();
  return jsonb_build_object(
    'since', v_since,
    'next_run', v_next,
    'scheduled', exists (select 1 from cron.job where jobname = 'wa-loom-pull' and active),
    'connected', exists (select 1 from vault.secrets where name = 'LOOM_OAUTH_REFRESH'),
    'connected_at', (select updated_at from vault.secrets where name = 'LOOM_OAUTH_REFRESH'),
    'last', (select to_jsonb(r) from public.loom_pull_runs r order by r.started_at desc limit 1),
    'last_ok', (select to_jsonb(r) from public.loom_pull_runs r where r.status in ('ok', 'partial') order by r.started_at desc limit 1),
    'runs', coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc) from (select * from public.loom_pull_runs order by started_at desc limit 8) r), '[]'::jsonb),
    'counts', coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) as n from public.loom_videos
                         where coalesce(meeting_date, first_seen::date) >= v_since or status in ('needs_look', 'waiting', 'error') group by status) s), '{}'::jsonb),
    'look', coalesce((select jsonb_agg(to_jsonb(v) - 'allowed_people' order by v.recorded_at desc nulls last) from public.loom_videos v where v.status = 'needs_look'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(v) order by coalesce(v.recorded_at, v.first_seen) desc) from (
                          select * from public.loom_videos where status not in ('personal', 'needs_look') and coalesce(meeting_date, first_seen::date) >= v_since
                          order by coalesce(recorded_at, first_seen) desc limit 30) v), '[]'::jsonb)
  );
end $function$;
comment on function public.loom_pull_status() is 'The Loom card in the Transcript archive (wave162, admins only): the next scheduled pull (Monday, Wednesday and Friday at 7:30, Toronto), whether the schedule is on, whether Loom is connected through Atlassian''s approval (wave162c: the vault holds LOOM_OAUTH_REFRESH, and since when; never the key itself), the last run and the last good one, the last eight runs, counts by status since loom_pull_since, the recordings that need a look, and the latest 30 recordings the pull handled (personal recordings never listed).';

create or replace function public.loom_oauth_forget()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from vault.secrets where name in ('LOOM_OAUTH_REFRESH', 'LOOM_OAUTH_ACCESS');
end $function$;
revoke all on function public.loom_oauth_forget() from public, anon, authenticated;
grant execute on function public.loom_oauth_forget() to service_role;
comment on function public.loom_oauth_forget() is 'Forgets the Loom connection (wave162c): removes LOOM_OAUTH_REFRESH and LOOM_OAUTH_ACCESS from the vault after loom-connect revoked the key at Atlassian (Disconnect) or when Atlassian says it has lapsed. The client registration (LOOM_OAUTH_CLIENT) stays. The loom-connect and loom-pull functions only.';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('loom', 'wave162c', 'Loom connection', 'a personal API token (refused by Atlassian for the site)', 'Atlassian sign-in and approval (Connect Loom on the Loom card), the API token as a fallback', 'wave162c');
