-- =====================================================================================================================
-- wave162 (28/09/26): the Hub pulls meetings from Loom on Monday, Wednesday and Friday at 7:30 (Toronto), with nobody
-- having to open anything. Steel: "I want to make sure that the hub pulls from loom automatically every monday, wednesday,
-- and friday without the need for claude to be open", and "loom now has abilities to pull transcripts via mcps. It's a native
-- solution to rely on".
-- The loom-pull function reads Loom through the Atlassian Rovo MCP server (read tools only) with the scoped API token Steel
-- keeps as Edge Function secrets, and files each new meeting as a transcript, which then goes through the normal pipeline.
-- Who sees a filed meeting (Steel, 28/09/26: "Team meetings to all, the rest private"): the recurring team meetings are
-- visible to everyone; leadership meetings to the leaders; everything else is confidential to the people in it plus the
-- leaders. Board meetings, meetings that may hold something sensitive and meetings whose team is unclear wait for an admin.
-- This file: the two tables (loom_videos, loom_pull_runs), the settings, the function's helpers (service role only), the
-- admins' status and decisions, the schedule, and the 54 Loom meetings already filed by hand (so they are never filed twice).
-- =====================================================================================================================

-- ---------- 1. every Loom recording the pull has looked at ----------
create table if not exists public.loom_videos (
  loom_id text primary key,
  title text,
  recorded_at timestamptz,
  meeting_date date,
  duration_s integer,
  owner_name text,
  speakers text[] not null default '{}',
  url text,
  loom_privacy text,
  status text not null default 'needs_look',
  reason text,
  department text,
  visibility text,
  allowed_people jsonb,
  transcript_id bigint references public.transcripts(id) on delete set null,
  attempts integer not null default 0,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_by text
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loom_videos_id_check') then
    alter table public.loom_videos add constraint loom_videos_id_check check (loom_id ~ '^[0-9a-f]{32}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loom_videos_status_check') then
    alter table public.loom_videos add constraint loom_videos_status_check check (status in ('filed', 'needs_look', 'skipped', 'waiting', 'error', 'personal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loom_videos_personal_check') then
    alter table public.loom_videos add constraint loom_videos_personal_check check (status <> 'personal' or (title is null and speakers = '{}' and owner_name is null and reason is null and department is null and allowed_people is null));
  end if;
end $$;
create index if not exists loom_videos_status_idx on public.loom_videos (status, recorded_at desc);
alter table public.loom_videos enable row level security;
drop policy if exists loom_videos_admin_read on public.loom_videos;
create policy loom_videos_admin_read on public.loom_videos for select to authenticated using (public.is_wa_admin());
comment on table public.loom_videos is 'Every Loom recording the Loom pull has looked at (wave162), one row per Loom video id, so nothing is filed twice. status: filed (a transcript, transcript_id), needs_look (waits for an admin in the Transcript archive: a board meeting, something that may be sensitive, a team that is unclear, or a one-person recording an admin may still file), skipped (one person speaking, no transcript after five days, or skipped by an admin), waiting (Loom has no transcript yet; tried again next time), error (tried again, up to six times), personal (a personal recording: nothing is kept but the id, not even the title). Admins read it; only the loom-pull function (service role) writes it, and admins decide through loom_video_decide().';
comment on column public.loom_videos.loom_id is 'The Loom video id (32 hex characters, as in loom.com/share/<id>).';
comment on column public.loom_videos.title is 'The recording''s name in Loom. Null for a personal recording.';
comment on column public.loom_videos.recorded_at is 'When Loom says it was recorded (or created).';
comment on column public.loom_videos.meeting_date is 'The recording''s date in Toronto; the transcript''s meeting_date.';
comment on column public.loom_videos.speakers is 'The speakers named in Loom''s transcript (at most 15).';
comment on column public.loom_videos.loom_privacy is 'Loom''s own sharing setting for the recording, as Loom names it. One Loom keeps to its owner is filed as confidential.';
comment on column public.loom_videos.reason is 'Why it was filed that way, or why it waits or was skipped, in plain words for the Loom card.';
comment on column public.loom_videos.department is 'The team it was filed under (or would be): opsmtl, opsto, marketing, fundraising, hr, progdev, or Leadership meeting.';
comment on column public.loom_videos.visibility is 'How it was filed: null or department (everyone), leadership, or private (allowed_people and the admins).';
comment on column public.loom_videos.allowed_people is 'For a confidential meeting: the people in it who are on the Hub, plus the leaders (roster names, as the upload form stores them).';
comment on column public.loom_videos.attempts is 'How many runs tried it (waiting and error rows are tried again until six).';
comment on column public.loom_videos.decided_by is 'Who filed or skipped it: Loom pull (scheduled), an admin, or the person who uploaded it by hand before wave162.';

-- ---------- 2. every run of the pull ----------
create table if not exists public.loom_pull_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  why text not null default 'schedule',
  status text not null default 'running',
  seen integer not null default 0,
  filed integer not null default 0,
  needs_look integer not null default 0,
  skipped integer not null default 0,
  waiting integer not null default 0,
  errors integer not null default 0,
  note text
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loom_pull_runs_status_check') then
    alter table public.loom_pull_runs add constraint loom_pull_runs_status_check check (status in ('running', 'ok', 'partial', 'error', 'no_key', 'refused'));
  end if;
end $$;
create index if not exists loom_pull_runs_started_idx on public.loom_pull_runs (started_at desc);
alter table public.loom_pull_runs enable row level security;
drop policy if exists loom_pull_runs_admin_read on public.loom_pull_runs;
create policy loom_pull_runs_admin_read on public.loom_pull_runs for select to authenticated using (public.is_wa_admin());
comment on table public.loom_pull_runs is 'Every run of the Loom pull (wave162): why (schedule, pull now by an admin, check), when, what it did (seen, filed, needs a look, skipped, waiting, errors) and how it ended: ok, partial (more left for next time), error, no_key (the Atlassian API token is not set yet) or refused (Atlassian refused the token, for example once it expires). Admins read it; the loom-pull function writes it.';

-- ---------- 3. the settings (admins only, like mail_*, receipt_* and donate_*) ----------
insert into public.app_config (key, value, updated_at) values
  ('loom_pull_since', '2026-09-02', now()),
  ('loom_pull_max', '10', now()),
  ('loom_cloud_id', '', now()),
  ('loom_mcp_url', 'https://mcp.atlassian.com/v2/mcp', now())
on conflict (key) do nothing;
create or replace function public.wa_app_config_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page and Loom pull settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

-- ---------- 4. the function's helpers (service role only) ----------
create or replace function public.loom_pull_begin(p_why text)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('wa_loom_pull'));
  update public.loom_pull_runs set status = 'error', finished_at = now(), note = coalesce(note || ' ', '') || 'Stopped without finishing.'
    where status = 'running' and started_at < now() - interval '15 minutes';
  if exists (select 1 from public.loom_pull_runs where status = 'running') then return null; end if;
  insert into public.loom_pull_runs (why) values (left(coalesce(nullif(trim(p_why), ''), 'schedule'), 80)) returning id into v_id;
  return v_id;
end $function$;

create or replace function public.loom_pull_finish(p_run bigint, p_status text, p_counts jsonb, p_note text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.loom_pull_runs set
    status = case when p_status in ('ok', 'partial', 'error', 'no_key', 'refused') then p_status else 'error' end,
    finished_at = now(),
    seen = coalesce((p_counts ->> 'seen')::int, seen),
    filed = coalesce((p_counts ->> 'filed')::int, filed),
    needs_look = coalesce((p_counts ->> 'needs_look')::int, needs_look),
    skipped = coalesce((p_counts ->> 'skipped')::int, skipped),
    waiting = coalesce((p_counts ->> 'waiting')::int, waiting),
    errors = coalesce((p_counts ->> 'errors')::int, errors),
    note = left(nullif(trim(coalesce(p_note, '')), ''), 600)
  where id = p_run;
end $function$;

create or replace function public.loom_pull_context()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'since', coalesce((select nullif(trim(value), '') from public.app_config where key = 'loom_pull_since'), '2026-09-02'),
    'max', coalesce((select nullif(trim(value), '')::int from public.app_config where key = 'loom_pull_max' and value ~ '^\s*\d{1,3}\s*$'), 10),
    'cloud_id', coalesce((select trim(value) from public.app_config where key = 'loom_cloud_id'), ''),
    'mcp_url', coalesce((select nullif(trim(value), '') from public.app_config where key = 'loom_mcp_url'), 'https://mcp.atlassian.com/v2/mcp'),
    'roster', coalesce((select jsonb_agg(jsonb_build_object('name', tm.name, 'email', lower(tm.email), 'department', tm.department) order by tm.name)
                         from public.team_members tm where tm.active and coalesce(trim(tm.name), '') <> ''), '[]'::jsonb),
    'leaders', coalesce((select jsonb_agg(distinct tm.name) from public.hub_roles r join public.team_members tm on lower(tm.email) = r.email
                          where r.role = 'leader' and tm.active and coalesce(trim(tm.name), '') <> ''), '[]'::jsonb)
  );
$function$;

create or replace function public.loom_pull_known(p_ids text[])
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'videos', coalesce((select jsonb_object_agg(v.loom_id, jsonb_build_object('status', v.status, 'attempts', v.attempts, 'first_seen', v.first_seen, 'transcript_id', v.transcript_id))
                         from public.loom_videos v where v.loom_id = any(p_ids)), '{}'::jsonb),
    'archive', coalesce((select jsonb_object_agg(x.lid, x.id) from (
                          select distinct on (substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})')) substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})') as lid, t.id
                          from public.transcripts t
                          where t.source_url ~ 'loom\.com/(share|embed)/[0-9a-f]{32}'
                            and substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})') = any(p_ids)
                          order by substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})'), t.id) x), '{}'::jsonb)
  );
$function$;

create or replace function public.loom_video_save(p jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_status text := p ->> 'status'; v_personal boolean;
begin
  if v_status not in ('needs_look', 'skipped', 'waiting', 'error', 'personal', 'filed') then raise exception 'unknown status %', v_status; end if;
  v_personal := v_status = 'personal';
  insert into public.loom_videos as v (loom_id, title, recorded_at, meeting_date, duration_s, owner_name, speakers, url, loom_privacy, status, reason,
                                       department, visibility, allowed_people, transcript_id, attempts, decided_by, updated_at)
  values (lower(p ->> 'loom_id'),
          case when v_personal then null else left(p ->> 'title', 300) end,
          nullif(p ->> 'recorded_at', '')::timestamptz,
          nullif(p ->> 'meeting_date', '')::date,
          nullif(p ->> 'duration_s', '')::numeric::int,
          case when v_personal then null else left(p ->> 'owner_name', 120) end,
          case when v_personal then '{}'::text[] else coalesce((select array_agg(left(x, 80)) from (select jsonb_array_elements_text(coalesce(p -> 'speakers', '[]'::jsonb)) as x limit 15) s), '{}'::text[]) end,
          'https://www.loom.com/share/' || lower(p ->> 'loom_id'),
          left(p ->> 'loom_privacy', 60),
          v_status,
          case when v_personal then null else left(p ->> 'reason', 300) end,
          case when v_personal then null else left(p ->> 'department', 60) end,
          case when v_personal then null else left(p ->> 'visibility', 20) end,
          case when v_personal then null else p -> 'allowed_people' end,
          nullif(p ->> 'transcript_id', '')::bigint,
          case when v_status in ('waiting', 'error') then 1 else 0 end,
          coalesce(nullif(p ->> 'decided_by', ''), 'Loom pull (scheduled)'),
          now())
  on conflict (loom_id) do update set
    title = excluded.title, recorded_at = coalesce(excluded.recorded_at, v.recorded_at), meeting_date = coalesce(excluded.meeting_date, v.meeting_date),
    duration_s = coalesce(excluded.duration_s, v.duration_s), owner_name = excluded.owner_name, speakers = excluded.speakers,
    loom_privacy = coalesce(excluded.loom_privacy, v.loom_privacy), status = excluded.status, reason = excluded.reason,
    department = excluded.department, visibility = excluded.visibility, allowed_people = excluded.allowed_people,
    transcript_id = coalesce(excluded.transcript_id, v.transcript_id),
    attempts = case when excluded.status in ('waiting', 'error') then v.attempts + 1 else v.attempts end,
    decided_by = excluded.decided_by, updated_at = now()
  where v.status <> 'filed';
end $function$;

create or replace function public.loom_file(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_lid text := lower(p ->> 'loom_id');
  v_vis text := nullif(p ->> 'visibility', '');
  v_dept text := p ->> 'department';
  v_allowed jsonb := case when jsonb_typeof(p -> 'allowed_people') = 'array' then p -> 'allowed_people' else null end;
  v_id bigint; v_existing bigint; v_by text := coalesce(nullif(p ->> 'added_by', ''), 'Loom pull (scheduled)');
begin
  if v_lid !~ '^[0-9a-f]{32}$' then raise exception 'bad Loom id'; end if;
  if coalesce(trim(p ->> 'body'), '') = '' then raise exception 'no transcript'; end if;
  if v_dept is null or v_dept not in ('opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'progdev', 'board', 'Leadership meeting') then raise exception 'unknown team %', v_dept; end if;
  if v_vis is not null and v_vis not in ('department', 'leadership', 'private') then raise exception 'unknown visibility %', v_vis; end if;
  if v_vis = 'private' and (v_allowed is null or jsonb_array_length(v_allowed) = 0) then raise exception 'a confidential meeting needs its people'; end if;
  perform pg_advisory_xact_lock(hashtext('wa_loom_file_' || v_lid));
  select t.id into v_existing from public.transcripts t where t.source_url ~ ('loom\.com/(share|embed)/' || v_lid) order by t.id limit 1;
  if v_existing is not null then
    insert into public.loom_videos (loom_id, title, meeting_date, status, reason, transcript_id, url, decided_by)
      values (v_lid, left(p ->> 'title', 300), nullif(p ->> 'meeting_date', '')::date, 'filed', 'Already in the archive', v_existing, 'https://www.loom.com/share/' || v_lid, v_by)
      on conflict (loom_id) do update set status = 'filed', transcript_id = v_existing, reason = 'Already in the archive', updated_at = now();
    return jsonb_build_object('transcript_id', v_existing, 'already', true);
  end if;
  insert into public.transcripts (department, meeting_date, title, body, added_by, created_at, processed, source_url, board_only, visibility, allowed_people)
    values (v_dept, coalesce(nullif(p ->> 'meeting_date', '')::date, (now() at time zone 'America/Toronto')::date), left(coalesce(nullif(trim(p ->> 'title'), ''), 'Loom meeting'), 200),
            left(p ->> 'body', 400000), v_by, now(), false, 'https://www.loom.com/share/' || v_lid, v_dept = 'board',
            case when v_vis = 'department' then null else v_vis end, case when v_vis = 'private' then v_allowed else null end)
    returning id into v_id;
  insert into public.loom_videos as v (loom_id, title, recorded_at, meeting_date, duration_s, owner_name, speakers, url, loom_privacy, status, reason, department, visibility, allowed_people, transcript_id, decided_by, updated_at)
    values (v_lid, left(p ->> 'title', 300), nullif(p ->> 'recorded_at', '')::timestamptz, nullif(p ->> 'meeting_date', '')::date, nullif(p ->> 'duration_s', '')::numeric::int,
            left(p ->> 'owner_name', 120), coalesce((select array_agg(left(x, 80)) from (select jsonb_array_elements_text(coalesce(p -> 'speakers', '[]'::jsonb)) as x limit 15) s), '{}'::text[]),
            'https://www.loom.com/share/' || v_lid, left(p ->> 'loom_privacy', 60), 'filed', left(p ->> 'reason', 300), v_dept, coalesce(v_vis, 'department'),
            case when v_vis = 'private' then v_allowed else null end, v_id, v_by, now())
    on conflict (loom_id) do update set status = 'filed', transcript_id = v_id, title = excluded.title, reason = excluded.reason, department = excluded.department,
      visibility = excluded.visibility, allowed_people = excluded.allowed_people, speakers = excluded.speakers, owner_name = excluded.owner_name,
      recorded_at = coalesce(excluded.recorded_at, v.recorded_at), meeting_date = coalesce(excluded.meeting_date, v.meeting_date), decided_by = excluded.decided_by, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, board_only)
    values ('loom', v_lid, 'filed', null, 'transcript ' || v_id || ' (' || v_dept || ', ' || coalesce(v_vis, 'everyone') || ')', v_by, v_dept = 'board' or v_vis in ('leadership', 'private'));
  return jsonb_build_object('transcript_id', v_id, 'already', false);
end $function$;

create or replace function public.loom_file_seen(p_loom_id text, p_transcript_id bigint, p_title text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if lower(p_loom_id) !~ '^[0-9a-f]{32}$' then raise exception 'bad Loom id'; end if;
  if not exists (select 1 from public.transcripts where id = p_transcript_id) then raise exception 'no such transcript'; end if;
  insert into public.loom_videos as v (loom_id, title, meeting_date, department, visibility, status, reason, transcript_id, url, decided_by)
    select lower(p_loom_id), coalesce(nullif(trim(p_title), ''), t.title), t.meeting_date, t.department, coalesce(t.visibility, 'department'), 'filed', 'Already in the archive (' || t.added_by || ')', t.id,
           'https://www.loom.com/share/' || lower(p_loom_id), t.added_by
    from public.transcripts t where t.id = p_transcript_id
  on conflict (loom_id) do update set status = 'filed', transcript_id = excluded.transcript_id, reason = excluded.reason, department = excluded.department,
    visibility = excluded.visibility, decided_by = excluded.decided_by, updated_at = now()
  where v.status <> 'personal';
end $function$;

revoke all on function public.loom_file_seen(text, bigint, text) from public, anon, authenticated;
grant execute on function public.loom_file_seen(text, bigint, text) to service_role;
comment on function public.loom_file_seen(text, bigint, text) is 'Marks a Loom recording as filed when the archive already has it (someone uploaded it by hand, or the Hub inbox filed its summary email), so the pull never files it twice. The loom-pull function only.';
revoke all on function public.loom_pull_begin(text) from public, anon, authenticated;
revoke all on function public.loom_pull_finish(bigint, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.loom_pull_context() from public, anon, authenticated;
revoke all on function public.loom_pull_known(text[]) from public, anon, authenticated;
revoke all on function public.loom_video_save(jsonb) from public, anon, authenticated;
revoke all on function public.loom_file(jsonb) from public, anon, authenticated;
grant execute on function public.loom_pull_begin(text) to service_role;
grant execute on function public.loom_pull_finish(bigint, text, jsonb, text) to service_role;
grant execute on function public.loom_pull_context() to service_role;
grant execute on function public.loom_pull_known(text[]) to service_role;
grant execute on function public.loom_video_save(jsonb) to service_role;
grant execute on function public.loom_file(jsonb) to service_role;
comment on function public.loom_pull_begin(text) is 'Starts a run of the Loom pull (wave162) unless one is already running (a run left running for 15 minutes is closed as stopped). Returns the run id, or null. The loom-pull function only.';
comment on function public.loom_pull_finish(bigint, text, jsonb, text) is 'Closes a run of the Loom pull with its status, counts and note. The loom-pull function only.';
comment on function public.loom_pull_context() is 'What the Loom pull needs to decide (wave162): the settings (loom_pull_since, loom_pull_max, loom_cloud_id, loom_mcp_url), the active roster (name, email, team) to match speakers, and the leaders'' names, who join every confidential meeting. The loom-pull function only.';
comment on function public.loom_pull_known(text[]) is 'For a list of Loom ids: what the pull already knows about each (status, attempts) and which are already in the transcript archive (by their Loom link), so nothing is filed twice. The loom-pull function only.';
comment on function public.loom_video_save(jsonb) is 'Records what the Loom pull decided about a recording that was not filed (needs a look, skipped, waiting, error, personal); a personal recording keeps only its id and dates. Never changes a filed row. The loom-pull function only.';
comment on function public.loom_file(jsonb) is 'Files a Loom recording as a transcript (wave162): one transaction inserts the transcripts row (which starts the normal pipeline through its triggers) and marks the recording filed; if the archive already has that Loom link, nothing is inserted. Checks the team, the visibility and that a confidential meeting names its people. Logged in change_log (entity_type loom). The loom-pull function only.';

-- ---------- 5. for the admins: the Loom card and its decisions ----------
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

create or replace function public.loom_video_decide(p_loom_id text, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_row public.loom_videos; v_by text; v_to text;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Admins only'; end if;
  select * into v_row from public.loom_videos where loom_id = lower(p_loom_id) for update;
  if not found then raise exception 'That Loom recording is not in the list'; end if;
  if v_row.status in ('filed', 'personal') then raise exception 'That recording is already %', case when v_row.status = 'filed' then 'filed' else 'left out' end; end if;
  if p_action = 'skip' then v_to := 'skipped';
  elsif p_action = 'look' then v_to := 'needs_look';
  else raise exception 'Unknown action %', p_action; end if;
  select coalesce((select tm.name from public.team_members tm where lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1), auth.jwt() ->> 'email', 'an admin') into v_by;
  update public.loom_videos set status = v_to, decided_by = v_by, updated_at = now(),
    reason = case when v_to = 'skipped' then 'Skipped by ' || v_by else 'Put back for a look by ' || v_by end
    where loom_id = v_row.loom_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('loom', v_row.loom_id, 'status', v_row.status, v_to, v_by);
  return jsonb_build_object('loom_id', v_row.loom_id, 'status', v_to);
end $function$;
revoke all on function public.loom_pull_status() from public, anon;
revoke all on function public.loom_video_decide(text, text) from public, anon;
grant execute on function public.loom_pull_status() to authenticated;
grant execute on function public.loom_video_decide(text, text) to authenticated;
comment on function public.loom_pull_status() is 'The Loom card in the Transcript archive (wave162, admins only): the next scheduled pull (Monday, Wednesday and Friday at 7:30, Toronto), whether the schedule is on, the last run and the last good one, the last eight runs, counts by status since loom_pull_since, the recordings that need a look, and the latest 30 recordings the pull handled (personal recordings never listed).';
comment on function public.loom_video_decide(text, text) is 'An admin skips a Loom recording that needed a look (p_action skip) or puts a skipped one back (look). Filing goes through the loom-pull function (action file), which reads the transcript from Loom. Logged in change_log (entity_type loom).';

-- ---------- 6. the 54 Loom meetings already filed by hand ----------
insert into public.loom_videos (loom_id, title, meeting_date, status, reason, department, visibility, transcript_id, url, decided_by, first_seen, updated_at)
select distinct on (x.lid) x.lid, x.title, x.meeting_date, 'filed', 'Filed by hand before the Loom pull', x.department, coalesce(x.visibility, 'department'), x.id,
       'https://www.loom.com/share/' || x.lid, x.added_by, x.created_at, now()
from (select substring(tr.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})') as lid, tr.id, tr.title, tr.meeting_date, tr.department, tr.visibility, tr.added_by, tr.created_at
      from public.transcripts tr where tr.source_url ~ 'loom\.com/(share|embed)/[0-9a-f]{32}') x
order by x.lid, x.id desc
on conflict (loom_id) do nothing;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260928233300', 'wa162_loom_pull', array[$m$create table if not exists public.loom_videos (
  loom_id text primary key,
  title text,
  recorded_at timestamptz,
  meeting_date date,
  duration_s integer,
  owner_name text,
  speakers text[] not null default '{}',
  url text,
  loom_privacy text,
  status text not null default 'needs_look',
  reason text,
  department text,
  visibility text,
  allowed_people jsonb,
  transcript_id bigint references public.transcripts(id) on delete set null,
  attempts integer not null default 0,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_by text
)$m$,$m$do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loom_videos_id_check') then
    alter table public.loom_videos add constraint loom_videos_id_check check (loom_id ~ '^[0-9a-f]{32}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loom_videos_status_check') then
    alter table public.loom_videos add constraint loom_videos_status_check check (status in ('filed', 'needs_look', 'skipped', 'waiting', 'error', 'personal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loom_videos_personal_check') then
    alter table public.loom_videos add constraint loom_videos_personal_check check (status <> 'personal' or (title is null and speakers = '{}' and owner_name is null and reason is null and department is null and allowed_people is null));
  end if;
end $$$m$,$m$create index if not exists loom_videos_status_idx on public.loom_videos (status, recorded_at desc)$m$,$m$alter table public.loom_videos enable row level security$m$,$m$drop policy if exists loom_videos_admin_read on public.loom_videos$m$,$m$create policy loom_videos_admin_read on public.loom_videos for select to authenticated using (public.is_wa_admin())$m$,$m$comment on table public.loom_videos is 'Every Loom recording the Loom pull has looked at (wave162), one row per Loom video id, so nothing is filed twice. status: filed (a transcript, transcript_id), needs_look (waits for an admin in the Transcript archive: a board meeting, something that may be sensitive, a team that is unclear, or a one-person recording an admin may still file), skipped (one person speaking, no transcript after five days, or skipped by an admin), waiting (Loom has no transcript yet; tried again next time), error (tried again, up to six times), personal (a personal recording: nothing is kept but the id, not even the title). Admins read it; only the loom-pull function (service role) writes it, and admins decide through loom_video_decide().'$m$,$m$comment on column public.loom_videos.loom_id is 'The Loom video id (32 hex characters, as in loom.com/share/<id>).'$m$,$m$comment on column public.loom_videos.title is 'The recording''s name in Loom. Null for a personal recording.'$m$,$m$comment on column public.loom_videos.recorded_at is 'When Loom says it was recorded (or created).'$m$,$m$comment on column public.loom_videos.meeting_date is 'The recording''s date in Toronto; the transcript''s meeting_date.'$m$,$m$comment on column public.loom_videos.speakers is 'The speakers named in Loom''s transcript (at most 15).'$m$,$m$comment on column public.loom_videos.loom_privacy is 'Loom''s own sharing setting for the recording, as Loom names it. One Loom keeps to its owner is filed as confidential.'$m$,$m$comment on column public.loom_videos.reason is 'Why it was filed that way, or why it waits or was skipped, in plain words for the Loom card.'$m$,$m$comment on column public.loom_videos.department is 'The team it was filed under (or would be): opsmtl, opsto, marketing, fundraising, hr, progdev, or Leadership meeting.'$m$,$m$comment on column public.loom_videos.visibility is 'How it was filed: null or department (everyone), leadership, or private (allowed_people and the admins).'$m$,$m$comment on column public.loom_videos.allowed_people is 'For a confidential meeting: the people in it who are on the Hub, plus the leaders (roster names, as the upload form stores them).'$m$,$m$comment on column public.loom_videos.attempts is 'How many runs tried it (waiting and error rows are tried again until six).'$m$,$m$comment on column public.loom_videos.decided_by is 'Who filed or skipped it: Loom pull (scheduled), an admin, or the person who uploaded it by hand before wave162.'$m$,$m$create table if not exists public.loom_pull_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  why text not null default 'schedule',
  status text not null default 'running',
  seen integer not null default 0,
  filed integer not null default 0,
  needs_look integer not null default 0,
  skipped integer not null default 0,
  waiting integer not null default 0,
  errors integer not null default 0,
  note text
)$m$,$m$do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'loom_pull_runs_status_check') then
    alter table public.loom_pull_runs add constraint loom_pull_runs_status_check check (status in ('running', 'ok', 'partial', 'error', 'no_key', 'refused'));
  end if;
end $$$m$,$m$create index if not exists loom_pull_runs_started_idx on public.loom_pull_runs (started_at desc)$m$,$m$alter table public.loom_pull_runs enable row level security$m$,$m$drop policy if exists loom_pull_runs_admin_read on public.loom_pull_runs$m$,$m$create policy loom_pull_runs_admin_read on public.loom_pull_runs for select to authenticated using (public.is_wa_admin())$m$,$m$comment on table public.loom_pull_runs is 'Every run of the Loom pull (wave162): why (schedule, pull now by an admin, check), when, what it did (seen, filed, needs a look, skipped, waiting, errors) and how it ended: ok, partial (more left for next time), error, no_key (the Atlassian API token is not set yet) or refused (Atlassian refused the token, for example once it expires). Admins read it; the loom-pull function writes it.'$m$,$m$insert into public.app_config (key, value, updated_at) values
  ('loom_pull_since', '2026-09-02', now()),
  ('loom_pull_max', '10', now()),
  ('loom_cloud_id', '', now()),
  ('loom_mcp_url', 'https://mcp.atlassian.com/v2/mcp', now())
on conflict (key) do nothing$m$,$m$create or replace function public.wa_app_config_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page and Loom pull settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$$m$,$m$create or replace function public.loom_pull_begin(p_why text)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('wa_loom_pull'));
  update public.loom_pull_runs set status = 'error', finished_at = now(), note = coalesce(note || ' ', '') || 'Stopped without finishing.'
    where status = 'running' and started_at < now() - interval '15 minutes';
  if exists (select 1 from public.loom_pull_runs where status = 'running') then return null; end if;
  insert into public.loom_pull_runs (why) values (left(coalesce(nullif(trim(p_why), ''), 'schedule'), 80)) returning id into v_id;
  return v_id;
end $function$$m$,$m$create or replace function public.loom_pull_finish(p_run bigint, p_status text, p_counts jsonb, p_note text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.loom_pull_runs set
    status = case when p_status in ('ok', 'partial', 'error', 'no_key', 'refused') then p_status else 'error' end,
    finished_at = now(),
    seen = coalesce((p_counts ->> 'seen')::int, seen),
    filed = coalesce((p_counts ->> 'filed')::int, filed),
    needs_look = coalesce((p_counts ->> 'needs_look')::int, needs_look),
    skipped = coalesce((p_counts ->> 'skipped')::int, skipped),
    waiting = coalesce((p_counts ->> 'waiting')::int, waiting),
    errors = coalesce((p_counts ->> 'errors')::int, errors),
    note = left(nullif(trim(coalesce(p_note, '')), ''), 600)
  where id = p_run;
end $function$$m$,$m$create or replace function public.loom_pull_context()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'since', coalesce((select nullif(trim(value), '') from public.app_config where key = 'loom_pull_since'), '2026-09-02'),
    'max', coalesce((select nullif(trim(value), '')::int from public.app_config where key = 'loom_pull_max' and value ~ '^\s*\d{1,3}\s*$'), 10),
    'cloud_id', coalesce((select trim(value) from public.app_config where key = 'loom_cloud_id'), ''),
    'mcp_url', coalesce((select nullif(trim(value), '') from public.app_config where key = 'loom_mcp_url'), 'https://mcp.atlassian.com/v2/mcp'),
    'roster', coalesce((select jsonb_agg(jsonb_build_object('name', tm.name, 'email', lower(tm.email), 'department', tm.department) order by tm.name)
                         from public.team_members tm where tm.active and coalesce(trim(tm.name), '') <> ''), '[]'::jsonb),
    'leaders', coalesce((select jsonb_agg(distinct tm.name) from public.hub_roles r join public.team_members tm on lower(tm.email) = r.email
                          where r.role = 'leader' and tm.active and coalesce(trim(tm.name), '') <> ''), '[]'::jsonb)
  );
$function$$m$,$m$create or replace function public.loom_pull_known(p_ids text[])
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'videos', coalesce((select jsonb_object_agg(v.loom_id, jsonb_build_object('status', v.status, 'attempts', v.attempts, 'first_seen', v.first_seen, 'transcript_id', v.transcript_id))
                         from public.loom_videos v where v.loom_id = any(p_ids)), '{}'::jsonb),
    'archive', coalesce((select jsonb_object_agg(x.lid, x.id) from (
                          select distinct on (substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})')) substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})') as lid, t.id
                          from public.transcripts t
                          where t.source_url ~ 'loom\.com/(share|embed)/[0-9a-f]{32}'
                            and substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})') = any(p_ids)
                          order by substring(t.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})'), t.id) x), '{}'::jsonb)
  );
$function$$m$,$m$create or replace function public.loom_video_save(p jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_status text := p ->> 'status'; v_personal boolean;
begin
  if v_status not in ('needs_look', 'skipped', 'waiting', 'error', 'personal', 'filed') then raise exception 'unknown status %', v_status; end if;
  v_personal := v_status = 'personal';
  insert into public.loom_videos as v (loom_id, title, recorded_at, meeting_date, duration_s, owner_name, speakers, url, loom_privacy, status, reason,
                                       department, visibility, allowed_people, transcript_id, attempts, decided_by, updated_at)
  values (lower(p ->> 'loom_id'),
          case when v_personal then null else left(p ->> 'title', 300) end,
          nullif(p ->> 'recorded_at', '')::timestamptz,
          nullif(p ->> 'meeting_date', '')::date,
          nullif(p ->> 'duration_s', '')::numeric::int,
          case when v_personal then null else left(p ->> 'owner_name', 120) end,
          case when v_personal then '{}'::text[] else coalesce((select array_agg(left(x, 80)) from (select jsonb_array_elements_text(coalesce(p -> 'speakers', '[]'::jsonb)) as x limit 15) s), '{}'::text[]) end,
          'https://www.loom.com/share/' || lower(p ->> 'loom_id'),
          left(p ->> 'loom_privacy', 60),
          v_status,
          case when v_personal then null else left(p ->> 'reason', 300) end,
          case when v_personal then null else left(p ->> 'department', 60) end,
          case when v_personal then null else left(p ->> 'visibility', 20) end,
          case when v_personal then null else p -> 'allowed_people' end,
          nullif(p ->> 'transcript_id', '')::bigint,
          case when v_status in ('waiting', 'error') then 1 else 0 end,
          coalesce(nullif(p ->> 'decided_by', ''), 'Loom pull (scheduled)'),
          now())
  on conflict (loom_id) do update set
    title = excluded.title, recorded_at = coalesce(excluded.recorded_at, v.recorded_at), meeting_date = coalesce(excluded.meeting_date, v.meeting_date),
    duration_s = coalesce(excluded.duration_s, v.duration_s), owner_name = excluded.owner_name, speakers = excluded.speakers,
    loom_privacy = coalesce(excluded.loom_privacy, v.loom_privacy), status = excluded.status, reason = excluded.reason,
    department = excluded.department, visibility = excluded.visibility, allowed_people = excluded.allowed_people,
    transcript_id = coalesce(excluded.transcript_id, v.transcript_id),
    attempts = case when excluded.status in ('waiting', 'error') then v.attempts + 1 else v.attempts end,
    decided_by = excluded.decided_by, updated_at = now()
  where v.status <> 'filed';
end $function$$m$,$m$create or replace function public.loom_file(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_lid text := lower(p ->> 'loom_id');
  v_vis text := nullif(p ->> 'visibility', '');
  v_dept text := p ->> 'department';
  v_allowed jsonb := case when jsonb_typeof(p -> 'allowed_people') = 'array' then p -> 'allowed_people' else null end;
  v_id bigint; v_existing bigint; v_by text := coalesce(nullif(p ->> 'added_by', ''), 'Loom pull (scheduled)');
begin
  if v_lid !~ '^[0-9a-f]{32}$' then raise exception 'bad Loom id'; end if;
  if coalesce(trim(p ->> 'body'), '') = '' then raise exception 'no transcript'; end if;
  if v_dept is null or v_dept not in ('opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'progdev', 'board', 'Leadership meeting') then raise exception 'unknown team %', v_dept; end if;
  if v_vis is not null and v_vis not in ('department', 'leadership', 'private') then raise exception 'unknown visibility %', v_vis; end if;
  if v_vis = 'private' and (v_allowed is null or jsonb_array_length(v_allowed) = 0) then raise exception 'a confidential meeting needs its people'; end if;
  perform pg_advisory_xact_lock(hashtext('wa_loom_file_' || v_lid));
  select t.id into v_existing from public.transcripts t where t.source_url ~ ('loom\.com/(share|embed)/' || v_lid) order by t.id limit 1;
  if v_existing is not null then
    insert into public.loom_videos (loom_id, title, meeting_date, status, reason, transcript_id, url, decided_by)
      values (v_lid, left(p ->> 'title', 300), nullif(p ->> 'meeting_date', '')::date, 'filed', 'Already in the archive', v_existing, 'https://www.loom.com/share/' || v_lid, v_by)
      on conflict (loom_id) do update set status = 'filed', transcript_id = v_existing, reason = 'Already in the archive', updated_at = now();
    return jsonb_build_object('transcript_id', v_existing, 'already', true);
  end if;
  insert into public.transcripts (department, meeting_date, title, body, added_by, created_at, processed, source_url, board_only, visibility, allowed_people)
    values (v_dept, coalesce(nullif(p ->> 'meeting_date', '')::date, (now() at time zone 'America/Toronto')::date), left(coalesce(nullif(trim(p ->> 'title'), ''), 'Loom meeting'), 200),
            left(p ->> 'body', 400000), v_by, now(), false, 'https://www.loom.com/share/' || v_lid, v_dept = 'board',
            case when v_vis = 'department' then null else v_vis end, case when v_vis = 'private' then v_allowed else null end)
    returning id into v_id;
  insert into public.loom_videos as v (loom_id, title, recorded_at, meeting_date, duration_s, owner_name, speakers, url, loom_privacy, status, reason, department, visibility, allowed_people, transcript_id, decided_by, updated_at)
    values (v_lid, left(p ->> 'title', 300), nullif(p ->> 'recorded_at', '')::timestamptz, nullif(p ->> 'meeting_date', '')::date, nullif(p ->> 'duration_s', '')::numeric::int,
            left(p ->> 'owner_name', 120), coalesce((select array_agg(left(x, 80)) from (select jsonb_array_elements_text(coalesce(p -> 'speakers', '[]'::jsonb)) as x limit 15) s), '{}'::text[]),
            'https://www.loom.com/share/' || v_lid, left(p ->> 'loom_privacy', 60), 'filed', left(p ->> 'reason', 300), v_dept, coalesce(v_vis, 'department'),
            case when v_vis = 'private' then v_allowed else null end, v_id, v_by, now())
    on conflict (loom_id) do update set status = 'filed', transcript_id = v_id, title = excluded.title, reason = excluded.reason, department = excluded.department,
      visibility = excluded.visibility, allowed_people = excluded.allowed_people, speakers = excluded.speakers, owner_name = excluded.owner_name,
      recorded_at = coalesce(excluded.recorded_at, v.recorded_at), meeting_date = coalesce(excluded.meeting_date, v.meeting_date), decided_by = excluded.decided_by, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, board_only)
    values ('loom', v_lid, 'filed', null, 'transcript ' || v_id || ' (' || v_dept || ', ' || coalesce(v_vis, 'everyone') || ')', v_by, v_dept = 'board' or v_vis in ('leadership', 'private'));
  return jsonb_build_object('transcript_id', v_id, 'already', false);
end $function$$m$,$m$create or replace function public.loom_file_seen(p_loom_id text, p_transcript_id bigint, p_title text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if lower(p_loom_id) !~ '^[0-9a-f]{32}$' then raise exception 'bad Loom id'; end if;
  if not exists (select 1 from public.transcripts where id = p_transcript_id) then raise exception 'no such transcript'; end if;
  insert into public.loom_videos as v (loom_id, title, meeting_date, department, visibility, status, reason, transcript_id, url, decided_by)
    select lower(p_loom_id), coalesce(nullif(trim(p_title), ''), t.title), t.meeting_date, t.department, coalesce(t.visibility, 'department'), 'filed', 'Already in the archive (' || t.added_by || ')', t.id,
           'https://www.loom.com/share/' || lower(p_loom_id), t.added_by
    from public.transcripts t where t.id = p_transcript_id
  on conflict (loom_id) do update set status = 'filed', transcript_id = excluded.transcript_id, reason = excluded.reason, department = excluded.department,
    visibility = excluded.visibility, decided_by = excluded.decided_by, updated_at = now()
  where v.status <> 'personal';
end $function$$m$,$m$revoke all on function public.loom_file_seen(text, bigint, text) from public, anon, authenticated$m$,$m$grant execute on function public.loom_file_seen(text, bigint, text) to service_role$m$,$m$comment on function public.loom_file_seen(text, bigint, text) is 'Marks a Loom recording as filed when the archive already has it (someone uploaded it by hand, or the Hub inbox filed its summary email), so the pull never files it twice. The loom-pull function only.'$m$,$m$revoke all on function public.loom_pull_begin(text) from public, anon, authenticated$m$,$m$revoke all on function public.loom_pull_finish(bigint, text, jsonb, text) from public, anon, authenticated$m$,$m$revoke all on function public.loom_pull_context() from public, anon, authenticated$m$,$m$revoke all on function public.loom_pull_known(text[]) from public, anon, authenticated$m$,$m$revoke all on function public.loom_video_save(jsonb) from public, anon, authenticated$m$,$m$revoke all on function public.loom_file(jsonb) from public, anon, authenticated$m$,$m$grant execute on function public.loom_pull_begin(text) to service_role$m$,$m$grant execute on function public.loom_pull_finish(bigint, text, jsonb, text) to service_role$m$,$m$grant execute on function public.loom_pull_context() to service_role$m$,$m$grant execute on function public.loom_pull_known(text[]) to service_role$m$,$m$grant execute on function public.loom_video_save(jsonb) to service_role$m$,$m$grant execute on function public.loom_file(jsonb) to service_role$m$,$m$comment on function public.loom_pull_begin(text) is 'Starts a run of the Loom pull (wave162) unless one is already running (a run left running for 15 minutes is closed as stopped). Returns the run id, or null. The loom-pull function only.'$m$,$m$comment on function public.loom_pull_finish(bigint, text, jsonb, text) is 'Closes a run of the Loom pull with its status, counts and note. The loom-pull function only.'$m$,$m$comment on function public.loom_pull_context() is 'What the Loom pull needs to decide (wave162): the settings (loom_pull_since, loom_pull_max, loom_cloud_id, loom_mcp_url), the active roster (name, email, team) to match speakers, and the leaders'' names, who join every confidential meeting. The loom-pull function only.'$m$,$m$comment on function public.loom_pull_known(text[]) is 'For a list of Loom ids: what the pull already knows about each (status, attempts) and which are already in the transcript archive (by their Loom link), so nothing is filed twice. The loom-pull function only.'$m$,$m$comment on function public.loom_video_save(jsonb) is 'Records what the Loom pull decided about a recording that was not filed (needs a look, skipped, waiting, error, personal); a personal recording keeps only its id and dates. Never changes a filed row. The loom-pull function only.'$m$,$m$comment on function public.loom_file(jsonb) is 'Files a Loom recording as a transcript (wave162): one transaction inserts the transcripts row (which starts the normal pipeline through its triggers) and marks the recording filed; if the archive already has that Loom link, nothing is inserted. Checks the team, the visibility and that a confidential meeting names its people. Logged in change_log (entity_type loom). The loom-pull function only.'$m$,$m$create or replace function public.loom_pull_status()
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
end $function$$m$,$m$create or replace function public.loom_video_decide(p_loom_id text, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_row public.loom_videos; v_by text; v_to text;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Admins only'; end if;
  select * into v_row from public.loom_videos where loom_id = lower(p_loom_id) for update;
  if not found then raise exception 'That Loom recording is not in the list'; end if;
  if v_row.status in ('filed', 'personal') then raise exception 'That recording is already %', case when v_row.status = 'filed' then 'filed' else 'left out' end; end if;
  if p_action = 'skip' then v_to := 'skipped';
  elsif p_action = 'look' then v_to := 'needs_look';
  else raise exception 'Unknown action %', p_action; end if;
  select coalesce((select tm.name from public.team_members tm where lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1), auth.jwt() ->> 'email', 'an admin') into v_by;
  update public.loom_videos set status = v_to, decided_by = v_by, updated_at = now(),
    reason = case when v_to = 'skipped' then 'Skipped by ' || v_by else 'Put back for a look by ' || v_by end
    where loom_id = v_row.loom_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('loom', v_row.loom_id, 'status', v_row.status, v_to, v_by);
  return jsonb_build_object('loom_id', v_row.loom_id, 'status', v_to);
end $function$$m$,$m$revoke all on function public.loom_pull_status() from public, anon$m$,$m$revoke all on function public.loom_video_decide(text, text) from public, anon$m$,$m$grant execute on function public.loom_pull_status() to authenticated$m$,$m$grant execute on function public.loom_video_decide(text, text) to authenticated$m$,$m$comment on function public.loom_pull_status() is 'The Loom card in the Transcript archive (wave162, admins only): the next scheduled pull (Monday, Wednesday and Friday at 7:30, Toronto), whether the schedule is on, the last run and the last good one, the last eight runs, counts by status since loom_pull_since, the recordings that need a look, and the latest 30 recordings the pull handled (personal recordings never listed).'$m$,$m$comment on function public.loom_video_decide(text, text) is 'An admin skips a Loom recording that needed a look (p_action skip) or puts a skipped one back (look). Filing goes through the loom-pull function (action file), which reads the transcript from Loom. Logged in change_log (entity_type loom).'$m$,$m$insert into public.loom_videos (loom_id, title, meeting_date, status, reason, department, visibility, transcript_id, url, decided_by, first_seen, updated_at)
select distinct on (x.lid) x.lid, x.title, x.meeting_date, 'filed', 'Filed by hand before the Loom pull', x.department, coalesce(x.visibility, 'department'), x.id,
       'https://www.loom.com/share/' || x.lid, x.added_by, x.created_at, now()
from (select substring(tr.source_url from 'loom\.com/(?:share|embed)/([0-9a-f]{32})') as lid, tr.id, tr.title, tr.meeting_date, tr.department, tr.visibility, tr.added_by, tr.created_at
      from public.transcripts tr where tr.source_url ~ 'loom\.com/(share|embed)/[0-9a-f]{32}') x
order by x.lid, x.id desc
on conflict (loom_id) do nothing$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
