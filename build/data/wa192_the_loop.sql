-- wave192 (01/10/26): The Loop. I'm in when you start, Close the loop when you finish.
-- Steel's choices (01/10/26): the name The Loop; a wrap-up goes to the person's team channel by default, or to everyone
-- (#the-loop) or just the Hub, their choice each time; the shared post carries only what moved (no clock time, no hours);
-- the note drafts itself from the records the person changed (never clicks or pages).
-- This file is the data side (ships before the page): the columns, the trail function, the onboarding tick.

-- 1. hub_checkins: where the wrap-up went and what the Hub drafted
alter table public.hub_checkins add column if not exists share_to text;
alter table public.hub_checkins add column if not exists share_channel text;
alter table public.hub_checkins add column if not exists trail jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hub_checkins_share_to_check') then
    alter table public.hub_checkins add constraint hub_checkins_share_to_check check (share_to is null or share_to in ('team', 'everyone', 'hub'));
  end if;
end $$;
comment on column public.hub_checkins.share_to is 'wave192: where the wrap-up note was shared: team (the department''s Slack channel), everyone (the Loop channel) or hub (no Slack post; Home only). Null before wave192 or for a session closed without a note.';
comment on column public.hub_checkins.share_channel is 'wave192: the Slack channel name the wrap-up was posted to, when it was.';
comment on column public.hub_checkins.trail is 'wave192: what the Hub drafted for the wrap-up from the person''s own records (loop_trail at close); the person edits the bullets before sharing. Shown back only to them.';
comment on table public.hub_checkins is 'The Loop (wave192; check in and out before): a session starts with I''m in and ends with Close the loop, with minutes worked and the wrap-up note (summary.bullets) the person chose to share: to their team''s channel, to everyone (the Loop channel) or just the Hub. Starting posts nothing; the shared post carries what moved, never times or hours. Open sessions close themselves after eight hours (auto_closed).';

-- 2. the Loop channel (everyone): #the-loop once Steel renames #check-in-out-wa; checkin-post falls back to the old name until then
insert into public.app_config (key, value, updated_at) values ('loop_channel', 'the-loop', now()) on conflict (key) do nothing;

-- 3. the trail: what this person changed in the Hub between two moments, for their own wrap-up
create or replace function public.loop_trail(p_email text, p_since timestamptz, p_until timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_me text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_role text := coalesce(auth.role(), '');
  v_name text; v_first text; v_dept text; v_member bigint; v_unique boolean := true;
  v_since timestamptz := coalesce(p_since, now() - interval '8 hours') - interval '2 minutes';
  v_until timestamptz := coalesce(p_until, now()) + interval '1 minute';
  v_items jsonb := '[]'::jsonb; v_hidden int := 0;
begin
  if v_email = '' then return jsonb_build_object('items', '[]'::jsonb, 'hidden', 0); end if;
  if v_role in ('authenticated', 'anon') and v_me <> v_email then raise exception 'loop_trail: your own trail only'; end if;
  select id, name, department into v_member, v_name, v_dept from public.team_members where lower(email) = v_email and coalesce(active, true) order by id limit 1;
  if v_name is null then v_name := split_part(v_email, '@', 1); end if;
  v_first := split_part(lower(trim(v_name)), ' ', 1);
  -- a name the Hub wrote matches this person when it is the same name, or the same first name and nobody else shares it
  select count(*) = 1 into v_unique from public.team_members where coalesce(active, true) and split_part(lower(trim(name)), ' ', 1) = v_first;

  with tasks as (
    select c.changed_at as at, c.field, c.new_value, t.id, t.title,
           (coalesce(t.confidential, false) or coalesce(t.board_only, false) or (t.visibility is not null and t.visibility <> 'department')) as hid
      from public.change_log c
      left join public.dept_tasks t on t.id::text = c.entity_id
     where c.entity_type = 'dept_task' and c.changed_at between v_since and v_until
       and c.changed_by is not null
       and (lower(trim(c.changed_by)) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(c.changed_by)), ' ', 1) = v_first))
  ), items as (
    select at, 'task_done' as k, title as t, id::text as id, hid from tasks where field = 'done' and new_value = 'closed' and title is not null
    union all
    select at, 'task_new', coalesce(title, new_value), coalesce(id::text, ''), coalesce(hid, false) from tasks where field = 'added'
    union all
    select at, 'task_note', title, id::text, hid from tasks where field in ('comment', 'description') and title is not null
    union all
    select at, 'task_edit', title, id::text, hid from tasks where field in ('status', 'owner', 'due_date', 'flag', 'priority', 'project', 'assignees', 'workstream', 'banked', 'department') and title is not null
    union all
    select tc.created_at, 'task_note', t.title, t.id::text,
           (coalesce(t.confidential, false) or coalesce(t.board_only, false) or (t.visibility is not null and t.visibility <> 'department'))
      from public.task_comments tc join public.dept_tasks t on t.id = tc.task_id
     where tc.created_at between v_since and v_until
       and (lower(trim(coalesce(tc.author, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(tc.author, ''))), ' ', 1) = v_first))
    union all
    select r.created_at, 'request_new', r.title || case when r.department is not null then ' (' || coalesce((select d.label from public.dept_meta d where d.department = r.department), r.department) || ')' else '' end, r.id::text, false
      from public.dept_requests r
     where r.created_at between v_since and v_until and lower(coalesce(r.requested_email, '')) = v_email
    union all
    select c.changed_at, 'request_done', r.title, r.id::text, false
      from public.change_log c join public.dept_requests r on r.id::text = c.entity_id
     where c.entity_type = 'request' and c.field in ('done', 'status') and c.new_value in ('true', 'completed', 'done', 'closed task')
       and c.changed_at between v_since and v_until
       and (lower(trim(coalesce(c.changed_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(c.changed_by, ''))), ' ', 1) = v_first))
    union all
    select n.created_at, 'request_note', r.title, r.id::text, false
      from public.request_notes n join public.dept_requests r on r.id = n.request_id
     where n.created_at between v_since and v_until and lower(coalesce(n.email, '')) = v_email
    union all
    select c.changed_at, 'goal', g.title, g.id::text, false
      from public.change_log c join public.goals g on g.id::text = c.entity_id
     where c.entity_type = 'goal' and c.changed_at between v_since and v_until and c.field <> 'removed duplicate'
       and (lower(trim(coalesce(c.changed_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(c.changed_by, ''))), ' ', 1) = v_first))
    union all
    select gc.created_at, 'goal_note', g.title, g.id::text, false
      from public.goal_comments gc join public.goals g on g.id = gc.goal_id
     where gc.created_at between v_since and v_until
       and (lower(trim(coalesce(gc.author, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(gc.author, ''))), ' ', 1) = v_first))
    union all
    select c.changed_at, 'decision', d.title, d.id::text, (coalesce(d.confidential, false) or coalesce(d.board_only, false) or (d.visibility is not null and d.visibility <> 'department'))
      from public.change_log c join public.decisions d on d.id::text = c.entity_id
     where c.entity_type = 'decision' and c.changed_at between v_since and v_until
       and (lower(trim(coalesce(c.changed_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(c.changed_by, ''))), ' ', 1) = v_first))
    union all
    select u.created_at, 'update', left(regexp_replace(coalesce(u.text, ''), '\s+', ' ', 'g'), 90), u.id::text, (coalesce(u.confidential, false) or coalesce(u.board_only, false) or (u.visibility is not null and u.visibility <> 'department'))
      from public.dept_updates u
     where u.created_at between v_since and v_until
       and (lower(trim(coalesce(u.added_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(u.added_by, ''))), ' ', 1) = v_first))
    union all
    select coalesce(tp.done_at, tp.updated_at), 'learned', tr.title, tr.id::text, false
      from public.training_progress tp join public.trainings tr on tr.id = tp.training_id
     where tp.status = 'done' and coalesce(tp.done_at, tp.updated_at) between v_since and v_until and tr.id <> 216
       and (lower(coalesce(tp.email, '')) = v_email or lower(trim(coalesce(tp.person_name, ''))) = lower(trim(v_name)))
    union all
    select coalesce(ma.joined_at, mm.started_at, mm.scheduled_start), 'meeting', coalesce(mm.title, 'a meeting'), mm.id::text, false
      from public.meet_attendance ma join public.meet_meetings mm on mm.id = ma.meeting_id
     where coalesce(ma.came, false) and coalesce(ma.joined_at, mm.started_at, mm.scheduled_start) between v_since and v_until
       and ((v_member is not null and ma.member_id = v_member)
            or lower(trim(coalesce(ma.name, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(ma.name, ''))), ' ', 1) = v_first))
    union all
    select ts.created_at, 'transcript', coalesce(ts.title, 'a meeting'), ts.id::text, (coalesce(ts.board_only, false) or (ts.visibility is not null and ts.visibility <> 'department'))
      from public.transcripts ts
     where ts.created_at between v_since and v_until
       and (lower(trim(coalesce(ts.added_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(ts.added_by, ''))), ' ', 1) = v_first))
    union all
    select m.created_at, 'mention', coalesce(m.to_name, 'someone') || case when m.ref_title is not null then ' on ' || m.ref_title else '' end, m.id::text, coalesce(m.private, false)
      from public.hub_mentions m
     where m.created_at between v_since and v_until and lower(coalesce(m.from_email, '')) = v_email
    union all
    select a.created_at, 'announce', a.title, a.id::text, false
      from public.hub_announcements a
     where a.created_at between v_since and v_until
       and (lower(coalesce(a.created_by, '')) = v_email or lower(trim(coalesce(a.created_name, ''))) = lower(trim(v_name)))
    union all
    select c.changed_at, 'post', coalesce(p.title, c.new_value), coalesce(p.id::text, c.entity_id), false
      from public.change_log c left join public.content_posts p on p.id::text = c.entity_id
     where c.entity_type = 'content_post' and c.changed_at between v_since and v_until
       and (lower(trim(coalesce(c.changed_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(c.changed_by, ''))), ' ', 1) = v_first))
    union all
    select c.changed_at, 'roster', 'a serving''s roster', c.entity_id, false
      from public.change_log c
     where c.entity_type = 'event_roster' and c.changed_at between v_since and v_until
       and (lower(trim(coalesce(c.changed_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(c.changed_by, ''))), ' ', 1) = v_first))
    union all
    select h.team_done_at, 'mail', 'a team email', h.id::text, false
      from public.hub_mail h
     where h.team_done_at between v_since and v_until
       and (lower(trim(coalesce(h.team_done_by, ''))) = lower(trim(v_name)) or (v_unique and split_part(lower(trim(coalesce(h.team_done_by, ''))), ' ', 1) = v_first))
    union all
    select cc.updated_at, 'crm', 'a contact', cc.id::text, false
      from public.crm_contacts cc
     where cc.updated_at between v_since and v_until
       and (lower(coalesce(cc.updated_by, '')) in (v_email, lower(trim(v_name))) or (v_unique and split_part(lower(trim(coalesce(cc.updated_by, ''))), ' ', 1) = v_first))
    union all
    select s.done_at, 'onboarding', t.name, s.id::text, false
      from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id join public.onboardings o on o.id = s.onboarding_id
     where coalesce(s.done, false) and s.done_at between v_since and v_until and s.done_by is not null and s.done_by not in ('Avenue Academy', 'the Hub')
       and v_member is not null and o.member_id = v_member
  ), dedup as (
    select k, t, id, bool_or(coalesce(hid, false)) as hid, max(at) as at
      from items where t is not null and t <> '' group by k, t, id
  )
  select coalesce((select jsonb_agg(jsonb_build_object('k', s.k, 't', left(s.t, 140), 'id', s.id, 'at', s.at) order by s.at)
                     from (select * from dedup where not hid order by at desc limit 80) s), '[]'::jsonb),
         (select count(*) from dedup where hid)
    into v_items, v_hidden;
  return jsonb_build_object('items', v_items, 'hidden', v_hidden, 'name', v_name, 'department', v_dept, 'since', v_since, 'until', v_until);
end $$;
comment on function public.loop_trail(text, timestamptz, timestamptz) is 'wave192: what one person changed in the Hub between two moments (tasks closed, opened, commented or edited; requests; goals; decisions; team updates; Academy modules finished; meetings joined; transcripts; @mentions; announcements; posts; rosters; team emails handled; CRM contacts; onboarding steps), as items {k, t, id, at} the wrap-up drafts from, plus the count of restricted items left out (confidential, board-only, private or one-on-one work never pre-fills a note that may reach Slack). A signed-in person reads their own trail only; the service role (checkin-post) reads anyone''s for their own wrap-up.';
revoke all on function public.loop_trail(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.loop_trail(text, timestamptz, timestamptz) to authenticated, service_role;

-- 4. closing the loop once completes the onboarding training (216) for the person; the Academy trigger
--    (trg_wa166_tp_onb) then ticks the step in their active plan
create or replace function public.wa192_loop_done()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_name text; v_email text := lower(coalesce(new.email, ''));
begin
  if new.ended_at is null or (tg_op = 'UPDATE' and old.ended_at is not null) or coalesce(new.auto_closed, false) then return new; end if;
  select name into v_name from public.team_members where lower(email) = v_email and coalesce(active, true) order by id limit 1;
  if v_name is null then v_name := coalesce(new.name, split_part(v_email, '@', 1)); end if;
  if exists (select 1 from public.trainings where id = 216 and coalesce(active, true)) then
    if not exists (select 1 from public.training_progress where training_id = 216 and (lower(trim(person_name)) = lower(trim(v_name)) or lower(coalesce(email, '')) = v_email) and status = 'done') then
      update public.training_progress set status = 'done', pct = 100, done_at = now(), updated_at = now(), email = coalesce(email, v_email), note = coalesce(note, 'Closed the loop once')
       where training_id = 216 and (lower(trim(person_name)) = lower(trim(v_name)) or lower(coalesce(email, '')) = v_email);
      if not found then
        insert into public.training_progress (training_id, person_name, email, status, pct, started_at, done_at, updated_at, note)
        values (216, v_name, v_email, 'done', 100, now(), now(), now(), 'Closed the loop once');
      end if;
    end if;
  end if;
  return new;
exception when others then
  return new;   -- the tick never blocks a check-out
end $$;
comment on function public.wa192_loop_done() is 'wave192: when a Loop session ends (not auto-closed), marks the onboarding training The Loop (216) done for the person in training_progress; trg_wa166_tp_onb then ticks the step in their active onboarding plan. Never blocks the check-out.';
create or replace trigger trg_wa192_loop_done after insert or update of ended_at on public.hub_checkins for each row execute function public.wa192_loop_done();
