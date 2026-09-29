-- wa165_speakers (29/09/26): one-on-ones only for the people speaking in them, and an archive-only kind of meeting (wave165).
-- Steel: "Yea so pull all these in, including July and August but don't create any tasks from them just enhance the "Ask the
-- Hub". 1on1s should be confidential and not searchable by anyone except for those that are speaking in the meeting. Loom gives
-- you those that are speaking in the meeting."
-- A fourth level of who sees a meeting, 'speakers': the people in allowed_people and nobody else, no admin, leader, director
-- or uploader override (the levels so far: everyone, leaders, confidential to picked people plus the leaders and admins).
-- What a one-on-one files (updates, tasks, decisions, wins, mentions, comments and their audit rows) follows it; a task also
-- stays with its owner and assignees. Meetings kept for the archive and Ask the Hub only (archive_only) are never processed
-- into tasks. The 29 one-on-ones already in the archive were open to every member: they and what they filed are now for their
-- speakers. The audit trail (change_log) of every restricted meeting follows the meeting, and a task's comments show only
-- where the task does. Ask the Hub gets wa_ask_meetings: the meetings that match a question best, as the asker may read them.
-- Every change is guarded: running it twice changes nothing.

-- 1. the new level, on every table that carries a meeting's visibility, on the audit trail and on task comments
alter table public.transcripts drop constraint if exists transcripts_visibility_check;
alter table public.transcripts add constraint transcripts_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.dept_tasks drop constraint if exists dept_tasks_visibility_check;
alter table public.dept_tasks add constraint dept_tasks_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.dept_updates drop constraint if exists dept_updates_visibility_check;
alter table public.dept_updates add constraint dept_updates_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.decisions drop constraint if exists decisions_visibility_check;
alter table public.decisions add constraint decisions_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.goal_wins drop constraint if exists goal_wins_visibility_check;
alter table public.goal_wins add constraint goal_wins_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.mentions drop constraint if exists mentions_visibility_check;
alter table public.mentions add constraint mentions_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.change_log add column if not exists visibility text;
alter table public.change_log add column if not exists allowed_people jsonb;
alter table public.change_log drop constraint if exists change_log_visibility_check;
alter table public.change_log add constraint change_log_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));
alter table public.task_comments add column if not exists visibility text;
alter table public.task_comments add column if not exists allowed_people jsonb;
alter table public.task_comments drop constraint if exists task_comments_visibility_check;
alter table public.task_comments add constraint task_comments_visibility_check check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers']));

-- 2. who sees what: 'speakers' comes before the admin override
create or replace function public.wa_sees_restricted(vis text, ap jsonb, creator text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case
    when vis is null or vis in ('','department') then true
    -- wave165: a one-on-one is for the people speaking in it and nobody else: no admin, leader, director or uploader sees it
    when vis = 'speakers' then exists (select 1 from jsonb_array_elements_text(
                   case when jsonb_typeof(coalesce(ap,'[]'::jsonb)) = 'array' then coalesce(ap,'[]'::jsonb) else '[]'::jsonb end) p
                 where public.wa_name_matches(p))
    when public.is_hub_admin() then true
    when vis = 'leadership' then (public.is_hub_leader() or public.is_board_circle() or public.is_board_viewer())
    when vis = 'private' then (
      public.wa_name_matches(creator)
      or exists (select 1 from jsonb_array_elements_text(
                   case when jsonb_typeof(coalesce(ap,'[]'::jsonb)) = 'array' then coalesce(ap,'[]'::jsonb) else '[]'::jsonb end) p
                 where public.wa_name_matches(p))
    )
    else true
  end;
$function$;

-- a list of people plus one more (a task's owner, a decision's owner), without duplicates
create or replace function public.wa_people_plus(ap jsonb, extra text)
 returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when coalesce(trim(extra), '') = '' then coalesce(ap, '[]'::jsonb)
    when coalesce(ap, '[]'::jsonb) @> to_jsonb(array[trim(extra)]) then coalesce(ap, '[]'::jsonb)
    else coalesce(ap, '[]'::jsonb) || to_jsonb(array[trim(extra)])
  end;
$function$;

-- the other sign-in addresses of a member (read only by the Hub's own functions: no policy, so no member reads it)
create table if not exists public.wa_email_aliases (
  email text primary key,
  aliases text[] not null default '{}',
  note text,
  updated_at timestamptz not null default now()
);
alter table public.wa_email_aliases enable row level security;
insert into public.wa_email_aliases (email, aliases, note)
  values ('steel.macdonald@welfareavenue.com', array['steelmacdonald@gmail.com'], 'Steel signs in to the Hub with both (hub_roles has both as admin)')
  on conflict (email) do nothing;

-- a one-on-one's people as names and every address they sign in with, so each of them matches however they sign in
create or replace function public.wa_people_expand(ap jsonb)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with given as (
    select distinct trim(x) as v from jsonb_array_elements_text(case when jsonb_typeof(ap) = 'array' then ap else '[]'::jsonb end) x
    where trim(x) <> ''
  ), emails as (
    select distinct lower(tm.email) as e from public.team_members tm join given g on lower(tm.name) = lower(g.v) or lower(tm.email) = lower(g.v)
    where coalesce(tm.email, '') <> ''
  ), aliases as (
    select distinct lower(a) as e from emails join public.wa_email_aliases w on lower(w.email) = emails.e, unnest(w.aliases) a
  ), everyone as (
    select v, 1 as o from given
    union all select e, 2 from emails where e not in (select lower(v) from given)
    union all select e, 3 from aliases where e not in (select lower(v) from given) and e not in (select e from emails)
  )
  select coalesce(jsonb_agg(v order by o, v), '[]'::jsonb) from everyone;
$function$;
create or replace function public.wa_tx_people()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.visibility = 'speakers' and jsonb_typeof(new.allowed_people) = 'array' then
    new.allowed_people := public.wa_people_expand(new.allowed_people);
  end if;
  return new;
end $function$;
drop trigger if exists trg_wa165_people on public.transcripts;
create trigger trg_wa165_people before insert or update of visibility, allowed_people on public.transcripts for each row execute function public.wa_tx_people();

-- whether the signed-in person may see a task (for its comments); a comment on a task that is gone stays readable
create or replace function public.wa_task_visible(p_task bigint)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select ((not coalesce(t.board_only, false)) or public.is_board_circle()) and public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner)
                   from public.dept_tasks t where t.id = p_task), true);
$function$;

-- 3. the audit trail follows the meeting it came from; a mention from a one-on-one shows only where its meeting does; a task's
--    comments show where the task does (and a note a one-on-one left on a task, only to its speakers); a one-on-one's Loom row
--    only to its speakers
drop policy if exists wa_staff_all_change_log on public.change_log;
create policy wa_staff_all_change_log on public.change_log for all to authenticated
  using (public.is_wa_staff() and ((not board_only) or public.is_board_circle()) and public.wa_sees_restricted(visibility, allowed_people, null::text))
  with check (public.is_wa_staff());
drop policy if exists mentions_read on public.mentions;
create policy mentions_read on public.mentions for select to authenticated
  using ((public.is_hub_admin() or (public.is_hub_leader() and coalesce(visibility, '') <> 'private') or (public.is_wa_staff() and public.wa_name_matches(person)))
         and (coalesce(visibility, '') <> 'speakers' or exists (select 1 from public.transcripts t where t.id = mentions.transcript_id)));
drop policy if exists task_comments_staff on public.task_comments;
create policy task_comments_staff on public.task_comments for all to authenticated
  using (public.is_wa_staff() and public.wa_sees_restricted(visibility, allowed_people, null::text) and public.wa_task_visible(task_id))
  with check (public.is_wa_staff());
drop policy if exists loom_videos_admin_read on public.loom_videos;
create policy loom_videos_admin_read on public.loom_videos for select to authenticated
  using (public.is_wa_admin() and (coalesce(visibility, '') <> 'speakers' or public.wa_sees_restricted(visibility, allowed_people, null::text)));

-- 4. archive only: kept for the archive, search and Ask the Hub, never processed into tasks, updates or decisions
alter table public.transcripts add column if not exists archive_only boolean not null default false;
drop trigger if exists trg_transcript_insert on public.transcripts;
create trigger trg_transcript_insert after insert on public.transcripts for each row when (not new.archive_only) execute function public.on_transcript_insert();
drop trigger if exists trg_wa65_leadership on public.transcripts;
create trigger trg_wa65_leadership after insert on public.transcripts for each row when ((new.department ~~* '%leadership%'::text) and not new.archive_only) execute function public.wa65_on_leadership_insert();

-- 5. what a processed restricted meeting files follows it (the audit rows too; one-on-ones: also the wins and the mentions;
--    a task stays with its owner and assignees)
create or replace function public.wa_stamp_restricted()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare cb text; v_ap jsonb;
begin
  if new.processed is true and coalesce(old.processed, false) is not true
     and new.visibility in ('leadership','private','speakers') then
    cb := 'AI: ' || coalesce(new.title, 'transcript ' || new.id);
    v_ap := case when new.visibility in ('private', 'speakers') then new.allowed_people end;
    update public.dept_updates set visibility = new.visibility, allowed_people = new.allowed_people
      where added_by = cb and created_at >= new.created_at and visibility is null;
    update public.dept_tasks t set visibility = new.visibility,
        allowed_people = case when new.visibility = 'speakers'
          then public.wa_people_plus(new.allowed_people, t.owner) || coalesce((select jsonb_agg(tm.name) from public.task_assignees ta join public.team_members tm on tm.id = ta.member_id where ta.task_id = t.id), '[]'::jsonb)
          else new.allowed_people end
      where t.updated_by = cb and t.opened_at >= new.created_at and t.visibility is null;
    update public.decisions d set visibility = new.visibility,
        allowed_people = case when new.visibility = 'speakers' then public.wa_people_plus(new.allowed_people, d.owner) else new.allowed_people end
      where d.raised_by = cb and d.opened_at >= new.created_at and d.visibility is null;
    -- wave165: the audit rows follow the meeting (they held its tasks' titles and its summary for every member to read)
    update public.change_log set visibility = new.visibility, allowed_people = v_ap
      where visibility is null and changed_at >= new.created_at and (changed_by = cb or (entity_type = 'transcript' and entity_id = new.id::text));
    if new.visibility = 'speakers' then
      update public.goal_wins set visibility = 'speakers', allowed_people = new.allowed_people where transcript_id = new.id and visibility is null;
      update public.mentions set visibility = 'speakers' where transcript_id = new.id and visibility is null;
    end if;
  end if;
  return new;
end $function$;

-- the meeting's own audit row (its summary) is written before the meeting is marked processed, so the stamp above covers it
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.apply_transcript_result(bigint, jsonb, text)'::regprocedure);
  if position('wave165' in d) = 0 then
    d := replace(d, $r$  update public.transcripts
    set processed = true, processed_at = now(), ai_summary = p->>'summary'
    where id = p_transcript_id;

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('transcript', p_transcript_id::text, 'processed', null, coalesce(p->>'summary',''), p_changed_by);
$r$, $r$  -- wave165: the audit row first, so a restricted meeting's stamp (wa_stamp_restricted, on the update below) covers it too
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('transcript', p_transcript_id::text, 'processed', null, coalesce(p->>'summary',''), p_changed_by);

  update public.transcripts
    set processed = true, processed_at = now(), ai_summary = p->>'summary'
    where id = p_transcript_id;
$r$);
    if position('wave165' in d) = 0 then raise exception 'apply_transcript_result: the processed block was not found'; end if;
    execute d;
  end if;
end $do$;

-- 6. Search everything: a meeting shows only to the people who may read it (it ran with the owner's rights and missed this)
create or replace function public.search_transcripts(q text)
 returns table(id bigint, department text, title text, meeting_date date, snippet text, ai_summary text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select t.id, t.department, t.title, t.meeting_date,
    case
      when websearch_to_tsquery('english', q) <> ''::tsquery and t.fts @@ websearch_to_tsquery('english', q)
        then coalesce(ts_headline('english', left(t.body, 20000), websearch_to_tsquery('english', q), 'MaxWords=30, MinWords=15'), '')
      else substring(t.body from greatest(1, position(lower(q) in lower(t.body)) - 60) for 180)
    end as snippet,
    t.ai_summary
  from public.transcripts t
  where public.is_wa_staff()
    and (not t.board_only or public.is_board_circle())
    and public.wa_sees_restricted(t.visibility, t.allowed_people, t.added_by)
    and (
      (websearch_to_tsquery('english', q) <> ''::tsquery and t.fts @@ websearch_to_tsquery('english', q))
      or t.title ilike '%' || q || '%' or t.body ilike '%' || q || '%'
    )
  order by
    case when websearch_to_tsquery('english', q) <> ''::tsquery
      then ts_rank(t.fts, websearch_to_tsquery('english', q)) else 0 end desc,
    t.meeting_date desc nulls last
  limit 20;
$function$;

-- Ask the Hub: the meetings that answer a question best (any of its words, ranked), with the passages that match, as the
-- asker may read them (one-on-ones only for their speakers, leadership meetings for the leaders, and so on)
create or replace function public.wa_ask_meetings(q text, lim integer default 8)
 returns table(id bigint, department text, title text, meeting_date date, visibility text, archive_only boolean, board_only boolean, ai_summary text, passage text, rank real)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_q tsquery;
begin
  if not public.is_wa_staff() then return; end if;
  select string_agg(quote_literal(w), ' | ')::tsquery into v_q
    from (select distinct regexp_replace(u.lexeme, '[^[:alnum:]]', '', 'g') as w
          from unnest(to_tsvector('english', left(coalesce(q, ''), 1000))) as u(lexeme, positions, weights)) x
    where length(w) >= 2;
  if v_q is null then return; end if;
  return query
    select t.id, t.department, t.title, t.meeting_date, coalesce(nullif(t.visibility, ''), 'department'), t.archive_only, t.board_only, t.ai_summary,
      ts_headline('english', left(t.body, 80000), v_q, 'MaxWords=45, MinWords=18, MaxFragments=2, FragmentDelimiter=" ... "'),
      ts_rank(t.fts, v_q, 1)
    from public.transcripts t
    where t.fts @@ v_q
      and ((not t.board_only) or public.is_board_circle())
      and public.wa_sees_restricted(t.visibility, t.allowed_people, t.added_by)
    order by ts_rank(t.fts, v_q, 1) desc, t.meeting_date desc nulls last
    limit greatest(1, least(coalesce(lim, 8), 20));
end $function$;
revoke all on function public.wa_ask_meetings(text, integer) from public, anon;
grant execute on function public.wa_ask_meetings(text, integer) to authenticated;

-- 7. content ideas never come from a one-on-one or an archive-only meeting
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.content_ideas_from_meeting(bigint, jsonb, text)'::regprocedure);
  if position('''speakers''' in d) = 0 then
    d := replace(d, $r$coalesce(tx.visibility, '') in ('leadership', 'private')$r$, $r$coalesce(tx.visibility, '') in ('leadership', 'private', 'speakers') or coalesce(tx.archive_only, false)$r$);
    if position('''speakers''' in d) = 0 then raise exception 'content_ideas_from_meeting: the restricted check was not found'; end if;
    execute d;
  end if;
end $do$;

-- 8. the Loom pull files a one-on-one for its speakers, Finance's meetings under Finance, and archive-only meetings with a summary
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
  v_archive boolean := coalesce(nullif(p ->> 'archive_only', '')::boolean, false);
  v_summary text := nullif(trim(coalesce(p ->> 'ai_summary', '')), '');
  v_id bigint; v_existing bigint; v_by text := coalesce(nullif(p ->> 'added_by', ''), 'Loom pull (scheduled)');
begin
  if v_lid !~ '^[0-9a-f]{32}$' then raise exception 'bad Loom id'; end if;
  if coalesce(trim(p ->> 'body'), '') = '' then raise exception 'no transcript'; end if;
  if v_dept is null or v_dept not in ('opsmtl', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'progdev', 'board', 'Leadership meeting') then raise exception 'unknown team %', v_dept; end if;
  if v_vis is not null and v_vis not in ('department', 'leadership', 'private', 'speakers') then raise exception 'unknown visibility %', v_vis; end if;
  if v_vis in ('private', 'speakers') and (v_allowed is null or jsonb_array_length(v_allowed) = 0) then raise exception 'a confidential meeting needs its people'; end if;
  if v_vis = 'speakers' then v_allowed := public.wa_people_expand(v_allowed); end if;
  perform pg_advisory_xact_lock(hashtext('wa_loom_file_' || v_lid));
  select t.id into v_existing from public.transcripts t where t.source_url ~ ('loom\.com/(share|embed)/' || v_lid) order by t.id limit 1;
  if v_existing is not null then
    insert into public.loom_videos (loom_id, title, meeting_date, status, reason, transcript_id, url, decided_by)
      values (v_lid, left(p ->> 'title', 300), nullif(p ->> 'meeting_date', '')::date, 'filed', 'Already in the archive', v_existing, 'https://www.loom.com/share/' || v_lid, v_by)
      on conflict (loom_id) do update set status = 'filed', transcript_id = v_existing, reason = 'Already in the archive', updated_at = now();
    return jsonb_build_object('transcript_id', v_existing, 'already', true);
  end if;
  insert into public.transcripts (department, meeting_date, title, body, added_by, created_at, processed, processed_at, ai_summary, archive_only, source_url, board_only, visibility, allowed_people)
    values (v_dept, coalesce(nullif(p ->> 'meeting_date', '')::date, (now() at time zone 'America/Toronto')::date), left(coalesce(nullif(trim(p ->> 'title'), ''), 'Loom meeting'), 200),
            left(p ->> 'body', 400000), v_by, now(), v_archive, case when v_archive then now() end, case when v_archive then left(v_summary, 6000) end, v_archive,
            'https://www.loom.com/share/' || v_lid, v_dept = 'board' and coalesce(v_vis, '') <> 'speakers',
            case when v_vis = 'department' then null else v_vis end, case when v_vis in ('private', 'speakers') then v_allowed else null end)
    returning id into v_id;
  insert into public.loom_videos as v (loom_id, title, recorded_at, meeting_date, duration_s, owner_name, speakers, url, loom_privacy, status, reason, department, visibility, allowed_people, transcript_id, decided_by, updated_at)
    values (v_lid, left(p ->> 'title', 300), nullif(p ->> 'recorded_at', '')::timestamptz, nullif(p ->> 'meeting_date', '')::date, nullif(p ->> 'duration_s', '')::numeric::int,
            left(p ->> 'owner_name', 120), coalesce((select array_agg(left(x, 80)) from (select jsonb_array_elements_text(coalesce(p -> 'speakers', '[]'::jsonb)) as x limit 15) s), '{}'::text[]),
            'https://www.loom.com/share/' || v_lid, left(p ->> 'loom_privacy', 60), 'filed', left(p ->> 'reason', 300), v_dept, coalesce(v_vis, 'department'),
            case when v_vis in ('private', 'speakers') then v_allowed else null end, v_id, v_by, now())
    on conflict (loom_id) do update set status = 'filed', transcript_id = v_id, title = excluded.title, reason = excluded.reason, department = excluded.department,
      visibility = excluded.visibility, allowed_people = excluded.allowed_people, speakers = excluded.speakers, owner_name = excluded.owner_name,
      recorded_at = coalesce(excluded.recorded_at, v.recorded_at), meeting_date = coalesce(excluded.meeting_date, v.meeting_date), decided_by = excluded.decided_by, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, board_only, visibility, allowed_people)
    values ('loom', v_lid, 'filed', null, 'transcript ' || v_id || ' (' || v_dept || ', ' || coalesce(v_vis, 'everyone') || case when v_archive then ', archive only' else '' end || ')', v_by,
            (v_dept = 'board' and coalesce(v_vis, '') <> 'speakers') or v_vis in ('leadership', 'private'),
            case when v_vis in ('leadership', 'private', 'speakers') then v_vis end, case when v_vis in ('private', 'speakers') then v_allowed end);
  return jsonb_build_object('transcript_id', v_id, 'already', false);
end $function$;

-- the Loom card: a one-on-one shows as "A one-on-one" (no title, names or link) to an admin who was not in it; the older
-- meetings kept for the archive and Ask the Hub only are counted
create or replace function public.loom_pull_status()
 returns jsonb
 language plpgsql
 stable security definer
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
    'recent', coalesce((select jsonb_agg(case when v.visibility = 'speakers' and not public.wa_sees_restricted(v.visibility, v.allowed_people, null::text)
                            then jsonb_build_object('loom_id', v.loom_id, 'status', v.status, 'title', 'A one-on-one', 'masked', true, 'visibility', 'speakers',
                                                    'recorded_at', v.recorded_at, 'meeting_date', v.meeting_date, 'first_seen', v.first_seen, 'duration_s', v.duration_s,
                                                    'department', v.department, 'updated_at', v.updated_at)
                            else to_jsonb(v) - 'allowed_people' end
                          order by coalesce(v.recorded_at, v.first_seen) desc) from (
                          select * from public.loom_videos where status not in ('personal', 'needs_look') and coalesce(meeting_date, first_seen::date) >= v_since
                          order by coalesce(recorded_at, first_seen) desc limit 30) v), '[]'::jsonb),
    'archive_only', (select count(*) from public.transcripts where archive_only),
    'one_on_ones', (select count(*) from public.loom_videos where status = 'filed' and visibility = 'speakers')
  );
end $function$;

-- 9. the one-on-ones already in the archive (open to every member until now): the meeting and what it filed are for the
--    people speaking in it; its suggestions waiting for a yes are set aside; the serving event items it made keep their task
--    but no longer name the meeting
create temp table w165_one (id bigint primary key, ap jsonb not null) on commit drop;
insert into w165_one (id, ap) values
    (1, '["Valex", "valex.sanon@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (2, '["Amanda", "amanda.zoldak@welfareavenue.com", "Rami", "rami.al-siq@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (3, '["Ian", "ian.odhiambo@welfareavenue.com", "Patricia", "patricia.kamara@welfareavenue.com"]'::jsonb),
    (6, '["Shima", "shima.butera@welfareavenue.com", "Ahmed", "ahmedfakhir@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (7, '["Suhaib", "suhaib.abdillahi@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (25, '["Suhaib", "suhaib.abdillahi@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (26, '["Suhaib", "suhaib.abdillahi@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (31, '["Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com", "Suhaib", "suhaib.abdillahi@welfareavenue.com"]'::jsonb),
    (33, '["Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com", "Suhaib", "suhaib.abdillahi@welfareavenue.com"]'::jsonb),
    (34, '["Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com", "Suhaib", "suhaib.abdillahi@welfareavenue.com"]'::jsonb),
    (55, '["Kahkashan", "kahkashan.ansary@welfareavenue.com", "Ian", "ian.odhiambo@welfareavenue.com"]'::jsonb),
    (56, '["Ahmed", "ahmedfakhir@welfareavenue.com", "Shima", "shima.butera@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (58, '["Amanda", "amanda.zoldak@welfareavenue.com", "Rami", "rami.al-siq@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (59, '["Amanda", "amanda.zoldak@welfareavenue.com", "Rami", "rami.al-siq@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (60, '["Ian", "ian.odhiambo@welfareavenue.com", "Andrea", "andrea.perez@welfareavenue.com"]'::jsonb),
    (69, '["Ian", "ian.odhiambo@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (71, '["Ian", "ian.odhiambo@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (72, '["Valex", "valex.sanon@welfareavenue.com", "Natasha", "natasha.sharp@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (79, '["Ian", "ian.odhiambo@welfareavenue.com", "Kahkashan", "kahkashan.ansary@welfareavenue.com"]'::jsonb),
    (86, '["Ahmed", "ahmedfakhir@welfareavenue.com", "Shima", "shima.butera@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com", "Kahkashan", "kahkashan.ansary@welfareavenue.com"]'::jsonb),
    (87, '["Ian", "ian.odhiambo@welfareavenue.com", "Kahkashan", "kahkashan.ansary@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (88, '["Valex", "valex.sanon@welfareavenue.com", "Natasha", "natasha.sharp@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (95, '["Amanda", "amanda.zoldak@welfareavenue.com", "Rami", "rami.al-siq@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (127, '["Amanda", "amanda.zoldak@welfareavenue.com", "Rami", "rami.al-siq@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (136, '["Ian", "ian.odhiambo@welfareavenue.com", "Eduardo de Freitas", "eduardofreitas@welfareavenue.com"]'::jsonb),
    (139, '["Ian", "ian.odhiambo@welfareavenue.com", "Robert"]'::jsonb),
    (144, '["Valex", "valex.sanon@welfareavenue.com", "Natasha", "natasha.sharp@welfareavenue.com", "Suhaib", "suhaib.abdillahi@welfareavenue.com"]'::jsonb),
    (147, '["Ian", "ian.odhiambo@welfareavenue.com", "Kahkashan", "kahkashan.ansary@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
    (148, '["Ahmed", "ahmedfakhir@welfareavenue.com", "Shima", "shima.butera@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb);
update public.transcripts t set visibility = 'speakers', allowed_people = o.ap, board_only = false from w165_one o where t.id = o.id and (t.visibility is distinct from 'speakers' or t.board_only);
update public.dept_updates u set visibility = 'speakers', allowed_people = o.ap, board_only = false
  from w165_one o join public.transcripts t on t.id = o.id
  where u.added_by = 'AI: ' || t.title and u.created_at >= t.created_at - interval '1 minute' and coalesce(u.visibility, '') in ('', 'department');
update public.dept_tasks k set visibility = 'speakers', board_only = false,
    allowed_people = public.wa_people_plus(o.ap, k.owner) || coalesce((select jsonb_agg(tm.name) from public.task_assignees ta join public.team_members tm on tm.id = ta.member_id where ta.task_id = k.id), '[]'::jsonb)
  from w165_one o join public.transcripts t on t.id = o.id
  where coalesce(k.visibility, '') in ('', 'department')
    and (k.updated_by = 'AI: ' || t.title
         or k.id::text in (select c.entity_id from public.change_log c where c.entity_type = 'dept_task' and c.field in ('added', 'banked') and c.changed_by = 'AI: ' || t.title));
update public.decisions d set visibility = 'speakers', allowed_people = public.wa_people_plus(o.ap, d.owner)
  from w165_one o join public.transcripts t on t.id = o.id
  where d.raised_by = 'AI: ' || t.title and coalesce(d.visibility, '') in ('', 'department');
update public.goal_wins g set visibility = 'speakers', allowed_people = o.ap from w165_one o where g.transcript_id = o.id and coalesce(g.visibility, '') in ('', 'department');
update public.mentions m set visibility = 'speakers' from w165_one o where m.transcript_id = o.id and coalesce(m.visibility, '') in ('', 'department');
update public.change_log c set visibility = 'speakers', allowed_people = o.ap, board_only = false
  from w165_one o join public.transcripts t on t.id = o.id
  where c.visibility is null and (c.changed_by = 'AI: ' || t.title or (c.entity_type = 'transcript' and c.entity_id = o.id::text));
update public.task_comments c set visibility = 'speakers', allowed_people = o.ap
  from w165_one o where c.source = 'transcript' and c.source_ref = o.id::text and c.visibility is null;
update public.task_due_suggestions s set status = 'dismissed', decided_by = 'wave165 (from a one-on-one, kept to its speakers)', decided_at = now()
  from w165_one o where s.transcript_id = o.id and s.status = 'pending';
update public.request_suggestions s set status = 'dismissed', decided_by = 'wave165 (from a one-on-one, kept to its speakers)', decided_at = now()
  from w165_one o where s.transcript_id = o.id and s.status = 'pending';
update public.sop_event_extras e set detail = regexp_replace(e.detail, '^From "[^"]*"( \([^)]*\))?', 'From a one-on-one')
  from w165_one o where e.transcript_id = o.id and e.detail ~ '^From "';
update public.loom_videos v set visibility = 'speakers', allowed_people = o.ap from w165_one o where v.transcript_id = o.id and v.visibility is distinct from 'speakers';

-- the leadership meeting's audit rows follow it too
update public.change_log c set visibility = t.visibility, allowed_people = case when t.visibility = 'private' then t.allowed_people end
  from public.transcripts t
  where t.visibility in ('leadership', 'private') and c.visibility is null and c.changed_at >= t.created_at
    and (c.changed_by = 'AI: ' || t.title or (c.entity_type = 'transcript' and c.entity_id = t.id::text));

-- 10. the model route for the archive's summaries
insert into public.ai_routes (task, label, chain, jev, max_tokens, notes, updated_by, mode)
  values ('transcript_archive', 'Transcripts: archive summaries', array['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'moonshotai/kimi-k2.6'], false, 1200,
          'wave165: a plain summary of a meeting kept for the archive and Ask the Hub only (the Loom backfill): what was discussed, decided and planned, with names, dates and numbers. No tasks are made from it.', 'wave165', 'chain')
  on conflict (task) do nothing;

-- 11. Hub module 3 says who sees a one-on-one, what archive-only means and what Ask the Hub answers from
update public.trainings set description = replace(replace(description,
    'one-on-ones, interviews and other meetings stay confidential to the people in them and the leaders.',
    'a one-on-one only to the people speaking in it (nobody else, not even an admin or a leader, can open it, find it in a search or get answers from it); interviews and other meetings stay confidential to the people in them and the leaders. Older Loom meetings the Hub pulled in later are kept for the archive and Ask the Hub only: no tasks, updates or suggestions come from them. Ask the Hub answers from every meeting you may see, and only those.'),
    'set the Meeting visibility (everyone, leaders only, or confidential to picked people)',
    'set the Meeting visibility (everyone, leaders only, confidential to picked people, or a one-on-one that only the people in it see)'),
  updated_at = now()
  where id = 41 and position('one-on-one only to the people speaking' in description) = 0
    and position('one-on-ones, interviews and other meetings stay confidential to the people in them and the leaders.' in description) > 0;

-- 12. what the columns mean
comment on column public.transcripts.visibility is 'Who sees the meeting and what it files: null or department (everyone on staff), leadership (leaders, the board circle, admins), private (the people in allowed_people and the uploader, plus leaders and admins), speakers (wave165: only the people in allowed_people, the ones speaking in a one-on-one; no admin, leader or uploader override).';
comment on column public.transcripts.allowed_people is 'Names and emails for private and speakers meetings (for speakers: the people speaking in it, matched to the roster, with every address they sign in with: wa_people_expand, trg_wa165_people).';
comment on column public.transcripts.archive_only is 'wave165: kept for the archive, search and Ask the Hub only. Never processed into tasks, updates, decisions, suggestions or ideas (the insert triggers skip it); ai_summary is written when it is filed.';
comment on column public.change_log.visibility is 'wave165: the visibility of the meeting a row came from (speakers for a one-on-one, leadership, private); rows with a visibility are read through wa_sees_restricted like the meeting.';
comment on column public.change_log.allowed_people is 'wave165: the people who may read a row that came from a restricted meeting (see change_log.visibility).';
comment on column public.task_comments.visibility is 'wave165: a note a restricted meeting left on a task is read like that meeting (speakers for a one-on-one); every comment also needs its task to be visible (wa_task_visible).';
comment on column public.task_comments.allowed_people is 'wave165: the people who may read a note a restricted meeting left (see task_comments.visibility).';
comment on table public.wa_email_aliases is 'wave165: the other addresses a member signs in with (Steel: his gmail). Read only by security definer functions (wa_people_expand); no policy, so no member reads it.';
comment on function public.wa_people_plus(jsonb, text) is 'wave165: a people list plus one more name (a task''s owner), without duplicates.';
comment on function public.wa_people_expand(jsonb) is 'wave165: a list of people (names or emails) with every roster email and alias of the ones on the roster added, so a one-on-one''s people match however they sign in.';
comment on function public.wa_task_visible(bigint) is 'wave165: whether the signed-in person may see a task (the task_comments policy uses it; a comment whose task is gone stays readable).';
comment on function public.wa_ask_meetings(text, integer) is 'wave165: Ask the Hub''s meeting search, run as the asker: the meetings any of the question''s words match, ranked, with the matching passages; only what the asker may read (wa_sees_restricted, board_only).';

-- 13. the release (written when the page ships; see the release row in wa165b)
