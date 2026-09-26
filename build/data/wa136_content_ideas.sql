-- wave136 (26/09/26): content ideas from marketing meetings land in the Content calendar's Ideas,
-- and an idea for three months or more away waits in the bank until six weeks before its date.
-- Steel: "Alot of great content ideas come out of our marketing meetings. I'd like to keep those either
-- in the bank or in the ideas section of the content calendar"
-- Additive: new columns on content_posts, one new function for the pipeline, one for banking an idea by
-- hand, and the bank functions learn a third kind ('idea') next to 'task' and 'project'.

-- 1. where an idea came from, who raised it, what it is for, and the bank
alter table public.content_posts
  add column if not exists source_transcript_id bigint,
  add column if not exists suggested_by text,
  add column if not exists idea_for date,
  add column if not exists banked_at timestamptz,
  add column if not exists bank_until date,
  add column if not exists bank_note text,
  add column if not exists banked_by text,
  add column if not exists resurfaced_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'content_posts_source_transcript_id_fkey') then
    alter table public.content_posts add constraint content_posts_source_transcript_id_fkey
      foreign key (source_transcript_id) references public.transcripts(id) on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_posts_bank_check') then
    alter table public.content_posts add constraint content_posts_bank_check
      check (banked_at is null or (scheduled_at is null and status = 'draft' and bank_until is not null));
  end if;
end $$;
create index if not exists idx_content_posts_source_transcript_id on public.content_posts (source_transcript_id);
create index if not exists content_posts_bank_idx on public.content_posts (bank_until) where banked_at is not null;

comment on table public.content_posts is 'Content calendar posts: planned, scheduled and published to the Facebook Page and Instagram by social-publish (cron every 5 minutes). A draft without a date is an idea (the Ideas tray); ideas raised in marketing meetings are added by process-transcript (source_transcript_id), and an idea in the bank (banked_at) is out of the calendar until bank_until. Outgoing posts; social_posts holds published posts and their metrics. Staff write; staff and board viewers read.';
comment on column public.content_posts.source_transcript_id is 'The meeting (transcripts.id) an idea came from, when process-transcript found it in a marketing meeting. NULL for posts made in the calendar.';
comment on column public.content_posts.suggested_by is 'Display name of who raised the idea in the meeting (a roster name when the AI was sure), else NULL.';
comment on column public.content_posts.idea_for is 'The date, event or season the idea is for, when the meeting tied it to one. An idea for three months or more away goes to the bank until six weeks before this date.';
comment on column public.content_posts.banked_at is 'Set while the idea is in the bank (the bank page lists it; the Content calendar leaves it out). Only an undated draft can be banked (content_posts_bank_check).';
comment on column public.content_posts.bank_until is 'The day a banked idea comes back to the Ideas tray (the daily bank_resurface job).';
comment on column public.content_posts.bank_note is 'Why the idea waits, such as "For December 2, 2026: Giving Tuesday".';
comment on column public.content_posts.banked_by is 'Display name of who banked it, or "the meeting" when process-transcript did.';
comment on column public.content_posts.resurfaced_at is 'When the idea came back from the bank (shown as back from the bank for two weeks).';

-- 2. the pipeline: ideas found in a marketing meeting (process-transcript, service role)
create or replace function public.content_ideas_from_meeting(p_transcript_id bigint, p_ideas jsonb, p_by text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  tx public.transcripts%rowtype; it jsonb; v_title text; v_idea text; v_for date; v_norm text; v_fmt text;
  v_pl text[]; v_by text; v_camp text; v_notes text; v_id bigint; v_until date; v_today date := public.wa_today();
  v_added int := 0; v_banked int := 0; v_skipped int := 0; v_ids bigint[] := '{}';
begin
  select * into tx from public.transcripts where id = p_transcript_id;
  if tx.id is null then raise exception 'transcript not found'; end if;
  if coalesce(tx.board_only, false) or coalesce(tx.visibility, '') in ('leadership', 'private') then
    return jsonb_build_object('added', 0, 'banked', 0, 'skipped', jsonb_array_length(coalesce(p_ideas, '[]'::jsonb)), 'reason', 'restricted meeting');
  end if;
  for it in select value from jsonb_array_elements(coalesce(p_ideas, '[]'::jsonb)) limit 15 loop
    v_title := left(trim(coalesce(it->>'title', '')), 120);
    v_idea := left(trim(coalesce(it->>'idea', '')), 1200);
    if v_title = '' or v_idea = '' then v_skipped := v_skipped + 1; continue; end if;
    v_norm := trim(regexp_replace(lower(v_title), '[^a-z0-9]+', ' ', 'g'));
    if v_norm = '' or exists (select 1 from public.content_posts c where trim(regexp_replace(lower(coalesce(c.title, '')), '[^a-z0-9]+', ' ', 'g')) = v_norm) then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_for := null;
    begin v_for := nullif(it->>'for_date', '')::date; exception when others then v_for := null; end;
    if v_for is not null and v_for < v_today then v_skipped := v_skipped + 1; continue; end if;   -- its moment has passed
    select coalesce(array_agg(distinct lower(x)), '{}') into v_pl
      from jsonb_array_elements_text(case when jsonb_typeof(it->'platforms') = 'array' then it->'platforms' else '[]'::jsonb end) x
      where lower(x) in ('instagram', 'facebook');
    if cardinality(v_pl) = 0 then v_pl := array['instagram', 'facebook']; end if;
    v_fmt := lower(coalesce(it->>'format', ''));
    v_by := nullif(left(trim(coalesce(it->>'suggested_by', '')), 80), '');
    v_camp := nullif(left(trim(coalesce(it->>'campaign', '')), 80), '');
    v_notes := v_idea
      || case when v_fmt in ('reel', 'carousel', 'story', 'series', 'video', 'live') then E'\nFormat: ' || v_fmt || '.' else '' end
      || E'\n\nFrom the meeting "' || coalesce(tx.title, 'a meeting') || '"' || coalesce(' (' || to_char(tx.meeting_date, 'FMMonth FMDD') || ')', '')
      || coalesce(', raised by ' || v_by, '') || '.';
    insert into public.content_posts (title, platforms, format, caption, notes, status, campaign, created_by, updated_by, source_transcript_id, suggested_by, idea_for)
    values (v_title, v_pl, 'post', null, v_notes, 'draft', v_camp, 'AI: ' || left(coalesce(tx.title, 'a meeting'), 80), coalesce(p_by, 'the Hub'), tx.id, v_by, v_for)
    returning id into v_id;
    v_added := v_added + 1; v_ids := v_ids || v_id;
    if v_for is not null and v_for >= v_today + 90 then
      v_until := greatest(v_for - 42, v_today + 1);
      update public.content_posts
        set banked_at = now(), bank_until = v_until, banked_by = 'the meeting',
            bank_note = 'For ' || to_char(v_for, 'FMMonth FMDD, YYYY') || coalesce(': ' || v_camp, '')
        where id = v_id;
      v_banked := v_banked + 1;
    end if;
  end loop;
  if v_added > 0 then
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('transcript', tx.id::text, 'content ideas', null,
            v_added || ' content idea' || case when v_added = 1 then '' else 's' end || ' for the Content calendar'
              || case when v_banked > 0 then ' (' || v_banked || ' in the bank)' else '' end,
            coalesce(p_by, 'the Hub'));
  end if;
  return jsonb_build_object('added', v_added, 'banked', v_banked, 'skipped', v_skipped, 'ids', to_jsonb(v_ids));
end $$;
revoke all on function public.content_ideas_from_meeting(bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.content_ideas_from_meeting(bigint, jsonb, text) to service_role;
comment on function public.content_ideas_from_meeting(bigint, jsonb, text) is 'Adds the content ideas process-transcript found in a marketing meeting to the Content calendar as undated drafts (title, idea in notes with the meeting, suggested_by, idea_for, source_transcript_id); skips a title already in the calendar and an idea whose date has passed; banks an idea for three months or more away until six weeks before its date. Refuses board-only, leadership and private meetings. Logged. Access: service role only.';

-- 3. bank an idea by hand (the Content calendar)
create or replace function public.bank_idea(p_id bigint, p_until date, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare r public.content_posts%rowtype; v_by text := public.wa_actor_name();
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if p_until is null or p_until <= public.wa_today() then raise exception 'pick a date after today'; end if;
  if p_until > public.wa_today() + 1100 then raise exception 'pick a date in the next three years'; end if;
  select * into r from public.content_posts where id = p_id;
  if r.id is null then raise exception 'that idea is gone'; end if;
  if r.banked_at is not null then raise exception 'it is already in the bank'; end if;
  if r.scheduled_at is not null or r.status <> 'draft' then raise exception 'only an idea without a date can go in the bank'; end if;
  update public.content_posts
    set banked_at = now(), bank_until = p_until, bank_note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
        banked_by = v_by, resurfaced_at = null, updated_at = now(), updated_by = v_by
    where id = p_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('content_post', p_id::text, 'to the bank', coalesce(r.title, 'an idea'),
          'back on ' || to_char(p_until, 'FMMonth FMDD, YYYY') || coalesce(': ' || nullif(trim(coalesce(p_note, '')), ''), ''), v_by);
  return jsonb_build_object('until', p_until);
end $$;
revoke all on function public.bank_idea(bigint, date, text) from public, anon;
grant execute on function public.bank_idea(bigint, date, text) to authenticated, service_role;
comment on function public.bank_idea(bigint, date, text) is 'Puts a Content calendar idea (an undated draft) in the bank until a date, with an optional reason; it leaves the calendar and comes back to the Ideas tray on that day. Checks wa_can_bank(). Logged. Called by the Content calendar. Access: authenticated.';

-- 4. the bank functions learn the third kind, 'idea'
create or replace function public.bank_unbank_do(p_kind text, p_id bigint, p_why text, p_by text)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare v_n int := 0; v_title text; v_at timestamptz; v_bo boolean := false; v_today date := public.wa_today();
begin
  if p_kind = 'project' then
    select name, banked_at into v_title, v_at from public.projects where id = p_id and banked_at is not null;
    if v_title is null then raise exception 'that project is not in the bank'; end if;
    update public.projects set banked_at = null, bank_until = null, bank_note = null, banked_by = null, resurfaced_at = now(), updated_at = now()
      where id in (select public.wa_project_tree(p_id)) and banked_at = v_at;
    update public.dept_tasks set banked_at = null, bank_until = null, bank_note = null, banked_by = null, bank_project_id = null,
        due_date = case when bank_due >= v_today then bank_due else null end, bank_due = null, resurfaced_at = now(), updated_by = p_by, updated_at = now()
      where bank_project_id = p_id and banked_at is not null;
    get diagnostics v_n = row_count;
  elsif p_kind = 'idea' then
    select coalesce(nullif(title, ''), 'an idea'), banked_at into v_title, v_at from public.content_posts where id = p_id and banked_at is not null;
    if v_at is null then raise exception 'that idea is not in the bank'; end if;
    update public.content_posts set banked_at = null, bank_until = null, bank_note = null, banked_by = null, resurfaced_at = now(), updated_at = now(), updated_by = p_by
      where id = p_id;
    get diagnostics v_n = row_count;
  else
    select title, banked_at, coalesce(board_only, false) into v_title, v_at, v_bo from public.dept_tasks where id = p_id and banked_at is not null;
    if v_title is null then raise exception 'that task is not in the bank'; end if;
    update public.dept_tasks d set banked_at = null, bank_until = null, bank_note = null, banked_by = null, bank_project_id = null,
        project_id = case when d.project_id is not null and exists (select 1 from public.projects pp where pp.id = d.project_id and pp.banked_at is not null) then null else d.project_id end,
        parent_task_id = case when d.id = p_id and d.parent_task_id is not null and exists (select 1 from public.dept_tasks pt where pt.id = d.parent_task_id and pt.banked_at is not null and pt.banked_at <> v_at) then null else d.parent_task_id end,
        due_date = case when d.bank_due >= v_today then d.bank_due else null end, bank_due = null, resurfaced_at = now(), updated_by = p_by, updated_at = now()
      where d.id in (select public.wa_task_tree(p_id)) and d.banked_at = v_at;
    get diagnostics v_n = row_count;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, board_only)
  values (case when p_kind = 'project' then 'project' when p_kind = 'idea' then 'content_post' else 'dept_task' end, p_id::text, 'back from the bank', v_title,
          coalesce(nullif(trim(coalesce(p_why, '')), ''), 'brought back'), p_by, v_bo);
  return v_n;
end;
$function$;
comment on function public.bank_unbank_do(text, bigint, text, text) is 'Internal: brings a banked task, project or content idea (p_kind task, project or idea) back; tasks get their future due dates back. Used by bank_unbank(), bank_undo(), bank_resurface() and the process-transcript edge function. Access: service role only.';

create or replace function public.bank_unbank(p_kind text, p_id bigint, p_why text default 'brought back')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare t public.dept_tasks%rowtype;
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if p_kind = 'project' then
    if not public.wa_leads_project(p_id) then raise exception 'only the project''s lead or a leader can bring a project back'; end if;
  elsif p_kind = 'idea' then
    null;   -- any staff member who can bank can bring an idea back
  else
    select * into t from public.dept_tasks where id = p_id;
    if not found then raise exception 'that task is not in the bank'; end if;
    if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
  end if;
  return jsonb_build_object('back', public.bank_unbank_do(case when p_kind in ('project', 'idea') then p_kind else 'task' end, p_id, coalesce(nullif(trim(coalesce(p_why, '')), ''), 'brought back'), public.wa_actor_name()));
end;
$function$;
comment on function public.bank_unbank(text, bigint, text) is 'Brings a banked task, project or content idea back now, with a reason. Checks wa_can_bank(), visibility, and project lead rights. Called by the page. Access: authenticated.';

create or replace function public.bank_redate(p_kind text, p_id bigint, p_until date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_by text := public.wa_actor_name(); v_at timestamptz; t public.dept_tasks%rowtype; v_old date;
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if p_until is null or p_until <= public.wa_today() then raise exception 'pick a date after today'; end if;
  if p_until > public.wa_today() + 1100 then raise exception 'pick a date in the next three years'; end if;
  if p_kind = 'project' then
    if not public.wa_leads_project(p_id) then raise exception 'only the project''s lead or a leader can change a project''s date'; end if;
    select banked_at, bank_until into v_at, v_old from public.projects where id = p_id and banked_at is not null;
    if v_at is null then raise exception 'that project is not in the bank'; end if;
    update public.projects set bank_until = p_until, updated_at = now() where id in (select public.wa_project_tree(p_id)) and banked_at = v_at;
    update public.dept_tasks set bank_until = p_until where bank_project_id = p_id and banked_at is not null;
  elsif p_kind = 'idea' then
    select banked_at, bank_until into v_at, v_old from public.content_posts where id = p_id and banked_at is not null;
    if v_at is null then raise exception 'that idea is not in the bank'; end if;
    update public.content_posts set bank_until = p_until, updated_at = now(), updated_by = v_by where id = p_id;
  else
    select * into t from public.dept_tasks where id = p_id and banked_at is not null;
    if not found then raise exception 'that task is not in the bank'; end if;
    if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
    v_at := t.banked_at; v_old := t.bank_until;
    update public.dept_tasks set bank_until = p_until, updated_at = now() where id in (select public.wa_task_tree(p_id)) and banked_at = v_at;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values (case when p_kind = 'project' then 'project' when p_kind = 'idea' then 'content_post' else 'dept_task' end, p_id::text, 'bank date',
          'back on ' || to_char(v_old, 'FMMonth FMDD, YYYY'), 'back on ' || to_char(p_until, 'FMMonth FMDD, YYYY'), v_by);
  return jsonb_build_object('until', p_until);
end;
$function$;
comment on function public.bank_redate(text, bigint, date) is 'Changes the return date of a banked task (p_kind task), project (project) or content idea (idea). Projects need their lead or a leader. Called by the page. Access: authenticated.';

create or replace function public.bank_undo(p_kind text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_at timestamptz; v_n int; t public.dept_tasks%rowtype;
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if p_kind = 'project' then
    if not public.wa_leads_project(p_id) then raise exception 'only the project''s lead or a leader can do that'; end if;
    select banked_at into v_at from public.projects where id = p_id;
  elsif p_kind = 'idea' then
    select banked_at into v_at from public.content_posts where id = p_id;
  else
    select * into t from public.dept_tasks where id = p_id;
    if not found then raise exception 'that task is not in the bank'; end if;
    if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
    v_at := t.banked_at;
  end if;
  if v_at is null then raise exception 'that is not in the bank any more'; end if;
  if v_at < now() - interval '30 minutes' then raise exception 'too late to undo: bring it back from the bank instead'; end if;
  v_n := public.bank_unbank_do(case when p_kind in ('project', 'idea') then p_kind else 'task' end, p_id, 'undone straight away', public.wa_actor_name());
  -- nothing was really away: no "back from the bank" mark
  update public.dept_tasks set resurfaced_at = null where resurfaced_at = now();
  update public.projects set resurfaced_at = null where resurfaced_at = now();
  update public.content_posts set resurfaced_at = null where resurfaced_at = now();
  return jsonb_build_object('back', v_n);
end;
$function$;
comment on function public.bank_undo(text, bigint) is 'Undoes a bank action (a task, project or content idea) within 30 minutes of banking. Called by the page. Access: authenticated.';

create or replace function public.bank_resurface()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare r record; v_t int := 0; v_p int := 0; v_i int := 0; v_today date := public.wa_today();
begin
  -- nothing comes back before the project, parent project or parent task it belongs to
  update public.projects c set bank_until = par.bank_until from public.projects par
    where c.banked_at is not null and c.bank_until <= v_today and par.id = c.parent_id and par.banked_at is not null and par.banked_at <> c.banked_at and par.bank_until > v_today;
  update public.dept_tasks t set bank_until = p.bank_until from public.projects p
    where t.banked_at is not null and t.bank_until <= v_today and t.bank_project_id is null and p.id = t.project_id and p.banked_at is not null and p.bank_until > v_today;
  update public.dept_tasks t set bank_until = par.bank_until from public.dept_tasks par
    where t.banked_at is not null and t.bank_until <= v_today and par.id = t.parent_task_id and par.banked_at is not null and par.banked_at <> t.banked_at and par.bank_until > v_today;
  for r in select p.id from public.projects p
      where p.banked_at is not null and p.bank_until <= v_today
        and not exists (select 1 from public.projects par where par.id = p.parent_id and par.banked_at = p.banked_at) loop
    begin
      perform public.bank_unbank_do('project', r.id, 'back on its date', 'the bank'); v_p := v_p + 1;
    exception when others then raise warning 'bank: project % did not come back: %', r.id, sqlerrm;
    end;
  end loop;
  for r in select t.id from public.dept_tasks t
      where t.banked_at is not null and t.bank_until <= v_today and t.bank_project_id is null
        and not exists (select 1 from public.dept_tasks par where par.id = t.parent_task_id and par.banked_at = t.banked_at) loop
    begin
      if exists (select 1 from public.dept_tasks where id = r.id and banked_at is not null) then
        perform public.bank_unbank_do('task', r.id, 'back on its date', 'the bank'); v_t := v_t + 1;
      end if;
    exception when others then raise warning 'bank: task % did not come back: %', r.id, sqlerrm;
    end;
  end loop;
  -- wave136: content ideas come back to the Content calendar's Ideas
  for r in select c.id from public.content_posts c where c.banked_at is not null and c.bank_until <= v_today loop
    begin
      perform public.bank_unbank_do('idea', r.id, 'back on its date', 'the bank'); v_i := v_i + 1;
    exception when others then raise warning 'bank: idea % did not come back: %', r.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('tasks', v_t, 'projects', v_p, 'ideas', v_i, 'on', v_today);
end;
$function$;
comment on function public.bank_resurface() is 'Daily job (cron wa-bank-resurface, 10:05 UTC): brings back banked tasks, projects and content ideas whose date has come, keeping children with a still-banked parent. Access: service role only.';

create or replace function public.bank_list()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare v_board boolean := public.is_board_circle(); v_work boolean := public.wa_can_bank();
begin
  if not public.is_wa_staff() then return jsonb_build_object('tasks', '[]'::jsonb, 'projects', '[]'::jsonb, 'ideas', '[]'::jsonb, 'back', '[]'::jsonb, 'today', public.wa_today(), 'can_bank', false, 'leader', false); end if;
  return jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'department', t.department, 'owner', t.owner,
        'project_id', t.project_id, 'project', p.name, 'parent_task_id', t.parent_task_id, 'parent', par.title,
        'bank_until', t.bank_until, 'bank_note', t.bank_note, 'banked_at', t.banked_at, 'banked_by', t.banked_by,
        'bank_due', t.bank_due, 'priority', t.priority, 'description', left(coalesce(t.description, ''), 600),
        'subtasks', (select count(*) from public.dept_tasks c where c.parent_task_id = t.id and c.banked_at = t.banked_at and c.done = false))
        order by t.bank_until, t.id)
      from public.dept_tasks t
        left join public.projects p on p.id = t.project_id
        left join public.dept_tasks par on par.id = t.parent_task_id
      where t.banked_at is not null and t.done = false and t.bank_project_id is null
        and (par.id is null or par.banked_at is distinct from t.banked_at)
        and ((not coalesce(t.board_only, false)) or v_board) and (v_work or not coalesce(t.confidential, false))
        and public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner)), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'department', p.department, 'parent_id', p.parent_id, 'parent', par.name,
        'description', left(coalesce(p.description, ''), 600), 'leads', p.leads,
        'bank_until', p.bank_until, 'bank_note', p.bank_note, 'banked_at', p.banked_at, 'banked_by', p.banked_by,
        'lead', public.wa_leads_project(p.id),
        'subprojects', (select count(*) from public.projects c where c.parent_id = p.id and c.banked_at = p.banked_at),
        'tasks', (select count(*) from public.dept_tasks t where t.bank_project_id = p.id and t.banked_at is not null and t.done = false),
        'task_titles', (select coalesce(jsonb_agg(x.title), '[]'::jsonb) from (
          select t.title from public.dept_tasks t
          where t.bank_project_id = p.id and t.banked_at is not null and t.done = false and t.parent_task_id is null
            and ((not coalesce(t.board_only, false)) or v_board) and public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner)
          order by t.priority desc nulls last, t.sort, t.id limit 8) x))
        order by p.bank_until, p.id)
      from public.projects p left join public.projects par on par.id = p.parent_id
      where p.banked_at is not null and (par.id is null or par.banked_at is distinct from p.banked_at)), '[]'::jsonb),
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', coalesce(nullif(c.title, ''), 'A content idea'), 'department', 'marketing',
        'idea', left(coalesce(c.notes, ''), 600), 'idea_for', c.idea_for, 'suggested_by', c.suggested_by, 'campaign', c.campaign,
        'platforms', c.platforms, 'source_transcript_id', c.source_transcript_id, 'source', tx.title, 'source_date', tx.meeting_date,
        'bank_until', c.bank_until, 'bank_note', c.bank_note, 'banked_at', c.banked_at, 'banked_by', c.banked_by)
        order by c.bank_until, c.id)
      from public.content_posts c left join public.transcripts tx on tx.id = c.source_transcript_id
      where c.banked_at is not null), '[]'::jsonb),
    'back', coalesce((
      select jsonb_agg(x order by (x->>'at') desc) from (
        select jsonb_build_object('kind', 'task', 'id', t.id, 'title', t.title, 'department', t.department, 'at', t.resurfaced_at, 'owner', t.owner, 'project_id', t.project_id) x
          from public.dept_tasks t
            left join public.dept_tasks par on par.id = t.parent_task_id
            left join public.projects pp on pp.id = t.project_id
          where t.resurfaced_at > now() - interval '14 days' and t.banked_at is null and t.done = false
            and (par.id is null or par.resurfaced_at is distinct from t.resurfaced_at)
            and (pp.id is null or pp.resurfaced_at is distinct from t.resurfaced_at)
            and ((not coalesce(t.board_only, false)) or v_board) and (v_work or not coalesce(t.confidential, false))
            and public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner)
        union all
        select jsonb_build_object('kind', 'project', 'id', p.id, 'title', p.name, 'department', p.department, 'at', p.resurfaced_at, 'owner', null, 'project_id', p.id)
          from public.projects p left join public.projects par on par.id = p.parent_id
          where p.resurfaced_at > now() - interval '14 days' and p.banked_at is null
            and (par.id is null or par.resurfaced_at is distinct from p.resurfaced_at)
        union all
        select jsonb_build_object('kind', 'idea', 'id', c.id, 'title', coalesce(nullif(c.title, ''), 'A content idea'), 'department', 'marketing', 'at', c.resurfaced_at, 'owner', c.suggested_by, 'project_id', null)
          from public.content_posts c
          where c.resurfaced_at > now() - interval '14 days' and c.banked_at is null and c.status = 'draft' and c.scheduled_at is null) s), '[]'::jsonb),
    'today', public.wa_today(),
    'can_bank', v_work,
    'leader', public.is_wa_leader()
  );
end;
$function$;
comment on function public.bank_list() is 'Everything in the bank for the bank page: banked tasks and projects the caller may see, banked content ideas (Marketing), items back recently, today''s date and whether the caller can bank or leads. Returns empty lists for non-staff. Called by the page. Access: authenticated.';

-- 5. the model route for the ideas pass (Admin > AI models shows it)
insert into public.ai_routes (task, label, chain, jev, mode, notes, updated_by)
values ('content_ideas', 'Marketing meetings: content ideas', array['anthropic/claude-sonnet-5', 'openai/gpt-5', 'anthropic/claude-sonnet-4.5'], false, 'chain',
        'Reads a whole marketing meeting for post, reel and series ideas (process-transcript, after the board update). Each idea carries a quote from the meeting; ideas without one are dropped.', 'Hub release (wave136)')
on conflict (task) do nothing;

-- 6. Hub training: the modules that describe uploads and the calendar
update public.trainings
  set description = replace(description, 'Work the meeting puts off by three months or more goes straight to the bank, with the reason, and comes back on its date.',
        'Work the meeting puts off by three months or more goes straight to the bank, with the reason, and comes back on its date. In a marketing meeting, the ideas for posts, reels and series go to the Content calendar''s Ideas, each with the meeting it came from; an idea for three months or more away waits in the bank until six weeks before its date.'),
      updated_at = now()
  where id = 41 and position('ideas for posts, reels and series' in description) = 0;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
  ('hub', 'wave136', 'content ideas', null, 'Marketing meetings: content ideas go to the Content calendar''s Ideas (far ones to the bank)', 'Hub release (wave136)'),
  ('ai_route', 'content_ideas', 'chain', null, 'anthropic/claude-sonnet-5 > openai/gpt-5 > anthropic/claude-sonnet-4.5 (new: the content ideas pass)', 'Hub release (wave136)');
