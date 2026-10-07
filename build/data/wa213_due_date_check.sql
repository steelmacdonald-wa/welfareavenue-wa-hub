-- wave213 (06/10/26): the due-date check. Steel: "I'd rather a pop up when the user gets on to the hub that they
-- should [set] their due dates for the tasks or confirm the due dates provided make sense", for new and existing
-- open tasks; then (same day) "overdue tasks should also pop to ask if items are done and if they aren't to push the due
-- date to a realistic date", and the pop-up stays until they save. Each person's open tasks that are overdue, with no due date, and the ones a meeting dated that nobody has confirmed
-- (meetings from 1 Sep 2026), come with a suggestion: the team's next meeting from the Hub calendar (hub_events),
-- or the one after when the next is less than two days away.

alter table public.dept_tasks add column if not exists due_confirmed_at timestamptz;
alter table public.dept_tasks add column if not exists due_confirmed_by text;
comment on column public.dept_tasks.due_confirmed_at is 'wave213: when the owner set or confirmed the due date in the due-date check';
comment on column public.dept_tasks.due_confirmed_by is 'wave213: who set or confirmed it (email)';

-- the next two meetings of a team on the Hub calendar, from a day on
create or replace function public.wa213_team_meetings(p_dept text, p_from date)
returns date[] language sql stable security definer set search_path to '' as $$
  select coalesce(array_agg(d order by d), '{}'::date[]) from (
    select distinct (e.start_at at time zone 'America/Toronto')::date d
    from public.hub_events e
    where e.department = p_dept and coalesce(e.status, '') <> 'cancelled' and coalesce(e.all_day, false) = false
      and (e.start_at at time zone 'America/Toronto')::date >= p_from
    order by 1 limit 2) x
$$;
comment on function public.wa213_team_meetings(text, date) is 'wave213: the next two dates the team meets (Hub calendar, Toronto), from a day on; dates only, nothing else about the events';
revoke all on function public.wa213_team_meetings(text, date) from public, anon;
grant execute on function public.wa213_team_meetings(text, date) to authenticated;

-- the signed-in person's tasks to date or confirm, with the suggestion
create or replace function public.my_due_date_check()
returns table (task_id bigint, title text, department text, owner text, due_date date, why text,
               meeting_title text, meeting_date date, next_meeting date, following_meeting date, suggested date)
language plpgsql stable security invoker set search_path to '' as $$
declare v_me public.team_members%rowtype; v_first text;
begin
  select * into v_me from public.team_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and m.active limit 1;
  if v_me.id is null then return; end if;
  v_first := regexp_replace(lower(split_part(trim(v_me.name), ' ', 1)), '[^a-z]', '', 'g');
  if v_first = '' then return; end if;
  return query
  with mine as (
    select d.id, d.title, d.department, d.owner, d.due_date, d.opened_at, d.due_confirmed_at,
           (select l.transcript_id from public.transcript_tasks l where l.task_id = d.id and l.kind = 'added' order by l.id limit 1) as tx_id,
           (select l.due_date from public.transcript_tasks l where l.task_id = d.id and l.kind = 'added' order by l.id limit 1) as tx_due
    from public.dept_tasks d
    where d.done = false and d.banked_at is null
      and (exists (select 1 from public.task_assignees a where a.task_id = d.id and a.member_id = v_me.id)
           or lower(coalesce(d.owner, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)'))
  ), pick as (
    select m.*, t.title as mt, t.meeting_date as md,
           case when m.due_date is null then 'no_date'
                when m.due_date < (now() at time zone 'America/Toronto')::date then 'overdue'
                else 'meeting_set' end as why_
    from mine m left join public.transcripts t on t.id = m.tx_id
    where m.due_date is null
       or m.due_date < (now() at time zone 'America/Toronto')::date
       or (m.due_confirmed_at is null and m.tx_id is not null and m.opened_at >= '2026-09-01' and m.due_date = m.tx_due)
  ), dated as (
    select p.*, public.wa213_team_meetings(p.department, (now() at time zone 'America/Toronto')::date + 1) as mts
    from pick p
  )
  select x.id, x.title, x.department, x.owner, x.due_date, x.why_, x.mt, x.md,
         coalesce(x.mts[1], (now() at time zone 'America/Toronto')::date + 7),
         coalesce(x.mts[2], (now() at time zone 'America/Toronto')::date + 14),
         case when x.mts[1] is not null and x.mts[1] >= (now() at time zone 'America/Toronto')::date + 2 then x.mts[1]
              when x.mts[2] is not null then x.mts[2]
              when x.mts[1] is not null then x.mts[1]
              else (now() at time zone 'America/Toronto')::date + 7 end
  from dated x
  order by case x.why_ when 'overdue' then 0 when 'no_date' then 1 else 2 end, x.due_date nulls last, x.md desc nulls last, x.id;
end $$;
comment on function public.my_due_date_check() is 'wave213: the signed-in person''s open tasks that are overdue or have no due date, and the ones a meeting dated that nobody confirmed (from 1 Sep 2026), each with the team''s next and following meetings and a suggestion';
grant execute on function public.my_due_date_check() to authenticated;

-- save what the person chose: [{"id": 12, "due": "2026-10-14"}, {"id": 13, "done": true}, ...]; only their open tasks, under the task's own rules
create or replace function public.confirm_due_dates(p jsonb)
returns int language plpgsql security invoker set search_path to '' as $$
declare v_item jsonb; v_id bigint; v_due date; v_old date; v_n int := 0; v_email text; v_name text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select m.name into v_name from public.team_members m where lower(m.email) = v_email and m.active limit 1;
  if v_name is null then raise exception 'not on the team roster'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint;
    if v_id is null then continue; end if;
    if not exists (select 1 from public.my_due_date_check() c where c.task_id = v_id) then continue; end if;
    if coalesce(v_item ->> 'done', '') = 'true' then
      update public.dept_tasks set done = true, updated_at = now(), updated_by = v_name where id = v_id and done = false;
      if found then
        v_n := v_n + 1;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_task', v_id::text, 'done', 'false', 'true (marked done in the due-date check)', v_name);
      end if;
      continue;
    end if;
    if coalesce(v_item ->> 'due', '') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
    v_due := (v_item ->> 'due')::date;
    if v_due < (now() at time zone 'America/Toronto')::date - 1 or v_due > (now() at time zone 'America/Toronto')::date + 400 then continue; end if;
    select due_date into v_old from public.dept_tasks where id = v_id;
    update public.dept_tasks set due_date = v_due, due_confirmed_at = now(), due_confirmed_by = v_email,
           updated_at = now(), updated_by = v_name
      where id = v_id and done = false;
    if found then
      v_n := v_n + 1;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('dept_task', v_id::text, 'due_date', v_old::text,
              v_due::text || case when v_old is not distinct from v_due then ' (confirmed)' else ' (set in the due-date check)' end, v_name);
    end if;
  end loop;
  return v_n;
end $$;
comment on function public.confirm_due_dates(jsonb) is 'wave213: saves the dates a person set or confirmed, and the tasks they marked done, in the due-date check (their own listed tasks only), with a change_log line each';
grant execute on function public.confirm_due_dates(jsonb) to authenticated;

insert into public.change_log (entity_type, entity_id, field, new_value, changed_by)
values ('hub', 'release', 'wave213', 'The due-date check: on opening the Hub, each person sets or confirms due dates on their open tasks (no date, or a date a meeting set), suggested from their team''s next meeting', 'assistant');
