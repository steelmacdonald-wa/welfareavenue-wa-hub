-- wave237 (14/10/26): meetings from Loom only, tasks set right.
-- Steel, after the 14/10 marketing meeting came out with missing, doubled and wrongly owned tasks: "we should only be reading
-- from Loom, not Read AI or Otter AI. Those are no longer supposed to be added to the meetings. [...] definitely make sure the
-- tasks are set correctly. [...] if confirmations are needed, put it in the pop-up that people get when they open the hub on
-- confirming tasks and have them just confirm, okay, this is my task. No, this is someone else's task. [...] hopefully we can
-- avoid that without it prompting people to clarify tasks as much. I'd rather it just be where the AI takes care of that."
--
-- What this migration does:
--   1. team_members.nicknames: what else a person is called in meetings, so the transcript pipeline lands a spoken name on
--      the right person. Seeded: Roberto Toto (Robert, Rob), Patricia (Trish), Kahkashan (KK), Steel (Steele, Sue).
--   2. The roster had Roberto twice: "Robert" (July, no account) and "Roberto Toto" (October, with his account). Tasks and
--      assignments owned by "Robert" move to Roberto Toto, and the old row goes inactive, so his tasks reach his own check.
--   3. dept_tasks.owner_unsure: the meeting left the owner unsure (a guess, a toss-up, or work for the whole team given to
--      its lead). The due-date check asks "Is this yours?" (mine / not mine) and asks a team's lead who owns a task nobody owns.
--   4. wa237_upcoming_dates(): the named dates ahead (serving events, fundraisers, the team's meetings), so "before Sunday's
--      Oberoi event" resolves to a date in process-transcript.
--   5. wa237_due_check() (the due-date check's list, with the owner questions) and confirm_due_check (mine, not mine, assign).
--      my_due_date_check() stays as it is for pages still open on the old build (its return type cannot change in place).
--      Nothing here removes rows: discard closes a task with the status "Discarded"; "not mine" re-points the assignment to
--      the lead (while an owner is unsure the check goes by the name on the task, not by old assignments). Applied 14/10/26
--      22:40 through execute_sql in two parts (the connector held the first version, which deleted rows, for approval).
--   6. content_ideas_from_meeting keeps the platform the meeting named: all six of the Studio's, not only Instagram and Facebook.
--   7. The Loom pull runs every half hour through the day (Loom is the only source of meetings now; recap emails are not filed),
--      and meetings the pull files post the usual Slack line (loom_pull_slack on: the recap-email path that posted it is gone).

-- 1. nicknames
alter table public.team_members add column if not exists nicknames text[] not null default '{}'::text[];
comment on column public.team_members.nicknames is 'wave237: what else the person is called in meetings (Robert and Rob for Roberto Toto, Trish for Patricia, KK for Kahkashan); process-transcript maps a spoken nickname to the roster name. Edited on the person page by the person, HR, leaders and admins.';

update public.team_members set nicknames = array['Robert', 'Rob'] where id = 52 and name = 'Roberto Toto';
update public.team_members set nicknames = array['Trish', 'Tricia'] where name = 'Patricia' and department = 'marketing' and active;
update public.team_members set nicknames = array['KK'] where name = 'Kahkashan' and active;
update public.team_members set nicknames = array['Steele', 'Sue'] where name = 'Steel MacDonald';

-- 2. Robert is Roberto Toto
update public.dept_tasks set owner = regexp_replace(owner, '\mRobert\M', 'Roberto Toto', 'g'), updated_at = now()
  where owner ~ '\mRobert\M' and owner !~ 'Roberto';
update public.task_assignees a set member_id = 52
  where a.member_id = 24 and exists (select 1 from public.team_members m where m.id = 52 and m.name = 'Roberto Toto')
    and not exists (select 1 from public.task_assignees b where b.task_id = a.task_id and b.member_id = 52);
update public.team_members set active = false where id = 24 and name = 'Robert' and email is null;
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('team_member', '24', 'merged', 'Robert (no account, July 2026)', 'Roberto Toto (52): tasks and assignments moved, the old row inactive (wave237)', 'assistant');

-- 3. owner_unsure
alter table public.dept_tasks add column if not exists owner_unsure boolean not null default false;
comment on column public.dept_tasks.owner_unsure is 'wave237: the meeting left the owner unsure (a guess, a toss-up between two people, or work for the whole team given to its lead). The due-date check asks the owner "Is this yours?" and asks the team''s lead who owns it; cleared when someone confirms or assigns.';

-- 4. the named dates ahead, for process-transcript (service role only)
create or replace function public.wa237_upcoming_dates(p_dept text, p_from date)
returns text[] language sql stable security invoker set search_path to '' as $$
  select coalesce(array_agg(x.line order by x.d, x.line), '{}'::text[]) from (
    select e.event_date as d,
           to_char(e.event_date, 'YYYY-MM-DD FMDay') || ': ' || coalesce(nullif(trim(e.title), ''), 'Sunday serving')
             || ' (' || case when e.kind = 'service' then 'serving event' else coalesce(e.kind, 'event') end
             || coalesce(', ' || nullif(trim(e.location), ''), '') || ')' as line
      from public.volunteer_events e
      where e.event_date between p_from and p_from + 45 and coalesce(e.status, '') <> 'cancelled'
    union all
    select f.start_date,
           to_char(f.start_date, 'YYYY-MM-DD FMDay') || ': ' || f.title || ' (fundraiser'
             || coalesce(', to ' || to_char(f.end_date, 'YYYY-MM-DD'), '') || ')'
      from public.fund_events f
      where f.start_date between p_from and p_from + 60 and coalesce(f.status, '') in ('planned', 'idea')
    union all
    select (h.start_at at time zone 'America/Toronto')::date,
           to_char((h.start_at at time zone 'America/Toronto')::date, 'YYYY-MM-DD FMDay') || ': ' || coalesce(h.summary, 'Team meeting') || ' (team meeting)'
      from public.hub_events h
      where h.department = p_dept and coalesce(h.status, '') <> 'cancelled' and coalesce(h.all_day, false) = false
        and (h.start_at at time zone 'America/Toronto')::date between p_from + 1 and p_from + 45
  ) x
$$;
comment on function public.wa237_upcoming_dates(text, date) is 'wave237: the named dates in the 45 days after a meeting (serving events, fundraisers, the team''s own meetings), one line each, for process-transcript (the service role) to resolve "before Sunday''s event". Security invoker: anyone else gets only what row security lets them read.';

-- 5. the due-date check with the owner questions
create or replace function public.wa237_due_check()
returns table (task_id bigint, title text, department text, owner text, due_date date, why text,
               meeting_title text, meeting_date date, next_meeting date, following_meeting date, suggested date,
               owner_unsure boolean, for_lead boolean)
language plpgsql stable security invoker set search_path to '' as $$
declare v_me public.team_members%rowtype; v_first text; v_lead boolean := false; v_today date; v_label text;
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  select * into v_me from public.team_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and m.active limit 1;
  if v_me.id is null then return; end if;
  v_first := regexp_replace(lower(split_part(trim(v_me.name), ' ', 1)), '[^a-z]', '', 'g');
  if v_first = '' then return; end if;
  /* a team's lead: a Hub leader or admin on that team, or its director */
  v_lead := exists (select 1 from public.hub_roles r where r.email = lower(v_me.email) and r.role in ('admin', 'leader'))
            or coalesce(v_me.role, '') ~* 'director';
  select lower(coalesce(dm.label, '')) into v_label from public.dept_meta dm where dm.department = v_me.department;
  return query
  with mine as (
    /* my own tasks: assigned to me (unless the meeting left the owner unsure and the name on it is not mine), or carrying my name */
    select d.id, d.title, d.department, d.owner, d.due_date, d.opened_at, d.due_confirmed_at, d.owner_unsure,
           (select l.transcript_id from public.transcript_tasks l where l.task_id = d.id and l.kind = 'added' order by l.id limit 1) as tx_id,
           (select l.due_date from public.transcript_tasks l where l.task_id = d.id and l.kind = 'added' order by l.id limit 1) as tx_due,
           false as lead_row
    from public.dept_tasks d
    where d.done = false and d.banked_at is null
      and ((not d.owner_unsure and exists (select 1 from public.task_assignees a where a.task_id = d.id and a.member_id = v_me.id))
           or lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)'))
      and not (v_lead and d.owner_unsure and d.department = v_me.department)
    union all
    /* the lead's own team: tasks nobody on the roster owns (the meeting gave them to the team), and unsure tasks that
       landed on the lead by name or by the team's label (someone said "not mine"): "Who owns this?" */
    select d.id, d.title, d.department, d.owner, d.due_date, d.opened_at, d.due_confirmed_at, d.owner_unsure,
           null::bigint, null::date, true
    from public.dept_tasks d
    where v_lead and d.department = v_me.department and d.done = false and d.banked_at is null
      and d.opened_at >= '2026-09-01'
      and ((not exists (select 1 from public.task_assignees a where a.task_id = d.id)
            and not exists (select 1 from public.team_members m where m.active
                              and lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || regexp_replace(lower(split_part(trim(m.name), ' ', 1)), '[^a-z]', '', 'g') || '([^a-z]|$)'))
            and lower(coalesce(d.owner, '')) !~ '(^|[^a-z])(steel|suhaib|both)([^a-z]|$)')
           or (d.owner_unsure and (lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)')
                                   or (v_label <> '' and lower(trim(coalesce(d.owner, ''))) = v_label)
                                   or lower(trim(coalesce(d.owner, ''))) = lower(d.department))))
  ), pick as (
    select m.*, t.title as mt, t.meeting_date as md,
           case when m.lead_row then 'needs_owner'
                when m.due_date is null then 'no_date'
                when m.due_date < v_today then 'overdue'
                when m.due_confirmed_at is null and m.tx_id is not null and m.opened_at >= '2026-09-01' and m.due_date = m.tx_due then 'meeting_set'
                else 'owner_check' end as why_
    from mine m left join public.transcripts t on t.id = m.tx_id
    where m.lead_row
       or m.owner_unsure
       or m.due_date is null
       or m.due_date < v_today
       or (m.due_confirmed_at is null and m.tx_id is not null and m.opened_at >= '2026-09-01' and m.due_date = m.tx_due)
  ), dated as (
    select p.*, public.wa213_team_meetings(p.department, v_today + 1) as mts from pick p
  )
  select x.id, x.title, x.department, x.owner, x.due_date, x.why_, x.mt, x.md,
         coalesce(x.mts[1], v_today + 7),
         coalesce(x.mts[2], v_today + 14),
         case when x.mts[1] is not null and x.mts[1] >= v_today + 2 then x.mts[1]
              when x.mts[2] is not null then x.mts[2]
              when x.mts[1] is not null then x.mts[1]
              else v_today + 7 end,
         x.owner_unsure, x.lead_row
  from dated x
  order by case x.why_ when 'owner_check' then 0 when 'overdue' then 1 when 'no_date' then 2 when 'meeting_set' then 3 else 4 end,
           x.due_date nulls last, x.md desc nulls last, x.id;
end $$;
comment on function public.wa237_due_check() is 'wave237: the due-date check''s list for the signed-in person: their open tasks that are overdue, undated, dated by a meeting and unconfirmed, or whose owner a meeting left unsure (owner_unsure: "Is this yours?"), plus, for a team''s lead, the team''s tasks nobody on the roster owns (for_lead: "Who owns this?"). Replaces my_due_date_check() for the pop-up; that one stays for pages on the old build.';
grant execute on function public.wa237_due_check() to authenticated;

-- save: [{"id": 12, "action": "date", "due": "2026-10-20"}, {"id": 13, "action": "done"}, {"id": 14, "action": "bank", "until": ...},
--        {"id": 15, "action": "discard"}, {"id": 16, "action": "notmine"}, {"id": 17, "action": "assign", "owner": "Patricia"}];
-- "mine": true on any item clears owner_unsure (the person said it is theirs)
create or replace function public.confirm_due_check(p jsonb)
returns jsonb language plpgsql security invoker set search_path to '' as $$
declare v_item jsonb; v_id bigint; v_due date; v_old date; v_n int := 0; v_email text; v_name text; v_dept text; v_me_id bigint;
        v_act text; v_row public.dept_tasks%rowtype; v_skip jsonb := '[]'::jsonb; v_today date; v_lead text; v_lead_id bigint; v_new_owner text; v_member bigint;
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select m.id, m.name, m.department into v_me_id, v_name, v_dept from public.team_members m where lower(m.email) = v_email and m.active limit 1;
  if v_name is null then raise exception 'not on the team roster'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint;
    if v_id is null then continue; end if;
    v_act := coalesce(nullif(v_item ->> 'action', ''), case when coalesce(v_item ->> 'done', '') = 'true' then 'done' else 'date' end);
    begin
      if not exists (select 1 from public.wa237_due_check() c where c.task_id = v_id) then
        v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'not on your list any more'); continue;
      end if;
      select * into v_row from public.dept_tasks where id = v_id;
      /* wave237: "this is my task" */
      if coalesce(v_item ->> 'mine', '') = 'true' and v_row.owner_unsure then
        update public.dept_tasks set owner_unsure = false, updated_at = now(), updated_by = v_name where id = v_id;
        insert into public.task_assignees (task_id, member_id) values (v_id, v_me_id) on conflict do nothing;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'owner', v_row.owner, coalesce(v_row.owner, '') || ' (confirmed as theirs in the due-date check)', v_name);
        v_n := v_n + 1;
        if v_act = 'mine' then continue; end if;
      end if;
      if v_act = 'done' then
        update public.dept_tasks set done = true, updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'done', 'false', 'true (marked done in the due-date check)', v_name);
        end if;
      elsif v_act = 'bank' then
        if coalesce(v_item ->> 'until', '') !~ '^\d{4}-\d{2}-\d{2}$' or (v_item ->> 'until')::date <= v_today then
          v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'the bank needs a day in the future'); continue;
        end if;
        perform public.bank_task(v_id, (v_item ->> 'until')::date, 'Put in the bank from the due-date check');
        v_n := v_n + 1;
      elsif v_act = 'discard' then
        /* wave237: a discarded task closes with the status "Discarded" (nothing is removed; the change log keeps the row as it was) */
        update public.dept_tasks set done = true, status = 'Discarded', closed_at = now(), updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'discarded', to_jsonb(v_row)::text, 'discarded in the due-date check: ' || coalesce(v_row.title, ''), v_name);
        end if;
      elsif v_act = 'notmine' then
        /* wave237: "this is someone else's task": it goes to the team's lead to re-home, still marked unsure */
        select m.id, m.name into v_lead_id, v_lead from public.team_members m
          where m.active and m.department = v_row.department and m.id <> v_me_id
            and (coalesce(m.role, '') ~* 'director' or exists (select 1 from public.hub_roles r where r.email = lower(m.email) and r.role in ('admin', 'leader')))
          order by case when coalesce(m.role, '') ~* 'director' then 0 else 1 end, m.name limit 1;
        update public.dept_tasks set owner = coalesce(v_lead, (select dm.label from public.dept_meta dm where dm.department = v_row.department), v_row.department), owner_unsure = true, updated_at = now(), updated_by = v_name where id = v_id and done = false;
        /* the assignment moves to the lead; while the owner is unsure, wa237_due_check goes by the name on the task, not by old assignments */
        if v_lead_id is not null and not exists (select 1 from public.task_assignees a where a.task_id = v_id and a.member_id = v_lead_id) then
          update public.task_assignees set member_id = v_lead_id where task_id = v_id and member_id = v_me_id;
        end if;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'owner', v_row.owner, coalesce(v_lead, 'the team') || ' (' || v_name || ' said it is not theirs, in the due-date check)', v_name);
        v_n := v_n + 1;
      elsif v_act = 'assign' then
        /* wave237: the lead names the owner (someone on the roster) */
        v_new_owner := nullif(trim(coalesce(v_item ->> 'owner', '')), '');
        select m.id, m.name into v_member, v_new_owner from public.team_members m where m.active and lower(m.name) = lower(v_new_owner) limit 1;
        if v_member is null then v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'pick someone on the roster'); continue; end if;
        update public.dept_tasks set owner = v_new_owner, owner_unsure = false, updated_at = now(), updated_by = v_name where id = v_id and done = false;
        if not exists (select 1 from public.task_assignees a where a.task_id = v_id and a.member_id = v_member) then
          /* an old assignment (the lead's, or the person who said "not mine") is re-pointed; otherwise the owner is added */
          update public.task_assignees set member_id = v_member where ctid = (select a.ctid from public.task_assignees a where a.task_id = v_id limit 1);
          if not found then insert into public.task_assignees (task_id, member_id) values (v_id, v_member); end if;
        end if;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'owner', v_row.owner, v_new_owner || ' (assigned by ' || v_name || ' in the due-date check)', v_name);
        v_n := v_n + 1;
        if coalesce(v_item ->> 'due', '') ~ '^\d{4}-\d{2}-\d{2}$' and (v_item ->> 'due')::date between v_today - 1 and v_today + 400 then
          update public.dept_tasks set due_date = (v_item ->> 'due')::date, updated_at = now() where id = v_id and done = false;
        end if;
      else
        if coalesce(v_item ->> 'due', '') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
        v_due := (v_item ->> 'due')::date;
        if v_due < v_today - 1 or v_due > v_today + 400 then
          v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'that date is out of range'); continue;
        end if;
        v_old := v_row.due_date;
        update public.dept_tasks set due_date = v_due, due_confirmed_at = now(), due_confirmed_by = v_email,
               updated_at = now(), updated_by = v_name
          where id = v_id and done = false;
        if found then
          v_n := v_n + 1;
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('dept_task', v_id::text, 'due_date', v_old::text,
                  v_due::text || case when v_old is not distinct from v_due then ' (confirmed)' else ' (set in the due-date check)' end, v_name);
        end if;
      end if;
    exception when others then
      v_skip := v_skip || jsonb_build_object('id', v_id, 'why', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('saved', v_n, 'skipped', v_skip);
end $$;
comment on function public.confirm_due_check(jsonb) is 'wave213c, wave237: saves what a person chose in the due-date check: a date, done, to the bank, discard (closes the task with the status Discarded), mine (clears owner_unsure), not mine (the task goes to the team''s lead, still unsure) and, for a lead, assign (names the owner). Their own listed tasks only; a change_log line each.';

-- 6. content ideas keep the platform the meeting named
create or replace function public.content_ideas_from_meeting(p_transcript_id bigint, p_ideas jsonb, p_by text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  tx public.transcripts%rowtype; it jsonb; v_title text; v_idea text; v_for date; v_norm text; v_fmt text;
  v_pl text[]; v_by text; v_camp text; v_notes text; v_id bigint; v_until date; v_today date := public.wa_today();
  v_added int := 0; v_banked int := 0; v_skipped int := 0; v_ids bigint[] := '{}';
begin
  select * into tx from public.transcripts where id = p_transcript_id;
  if tx.id is null then raise exception 'transcript not found'; end if;
  if coalesce(tx.board_only, false) or coalesce(tx.visibility, '') in ('leadership', 'private', 'speakers') or coalesce(tx.archive_only, false) then
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
    -- wave237: the platforms the meeting named, any of the Studio's six; Instagram and Facebook when it named none
    select coalesce(array_agg(distinct lower(x)), '{}') into v_pl
      from jsonb_array_elements_text(case when jsonb_typeof(it->'platforms') = 'array' then it->'platforms' else '[]'::jsonb end) x
      where lower(x) in ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'threads');
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
comment on function public.content_ideas_from_meeting(bigint, jsonb, text) is 'wave136, wave237: files the content ideas a marketing meeting raised into the Content calendar''s Ideas (draft posts with the meeting as their source), keeping the platforms the meeting named (any of the Studio''s six; Instagram and Facebook when none), banking an idea three months or more away until six weeks before.';

-- 7. the Loom pull every half hour through the day (Toronto 7:00 to 23:30), and its Slack line
select cron.schedule('wa-loom-pull', '*/30 11-23,0-3 * * *', $$select public.call_edge('loom-pull', '{"action":"sync","why":"schedule"}'::jsonb)$$);
insert into public.app_config (key, value, updated_at) values ('loom_pull_slack', 'on', now())
  on conflict (key) do update set value = 'on', updated_at = now();

insert into public.change_log (entity_type, entity_id, field, new_value, changed_by)
values ('hub', 'release', 'wave237', 'Meetings from Loom only, tasks set right: the whole transcript is read, nicknames land on the right person, named dates ahead resolve due dates, doubles are merged, an unsure owner is asked in the due-date check (mine / not mine; a lead names the owner); Read AI and Otter recaps are no longer filed; the Loom pull runs every half hour', 'assistant');
