-- wave210 (06/10/26; applied as migration wa209_transcript_tasks before the renumbering, so the database
-- objects keep wa209 names): what each transcript made. Every task a meeting adds, banks or closes is
-- linked to the transcript, so the Transcript archive can show the tasks with their owner and due
-- date. apply_transcript_result writes the link itself; a trigger on dept_tasks catches the tasks
-- process-leadership inserts and the tasks process-transcript closes (both write updated_by 'AI: <title>').
-- The history is backfilled from change_log.

create table if not exists public.transcript_tasks (
  id            bigint generated always as identity primary key,
  transcript_id bigint not null references public.transcripts(id) on delete cascade,
  task_id       bigint references public.dept_tasks(id) on delete set null,
  kind          text not null check (kind in ('added','banked','closed')),
  title         text,
  owner         text,
  due_date      date,
  created_at    timestamptz not null default now(),
  unique (transcript_id, task_id, kind)
);
comment on table public.transcript_tasks is 'wave210: the tasks a transcript added, banked or closed when it was processed (a snapshot of title, owner and due date; task_id points at the live task while it exists). Written by apply_transcript_result and by trg_wa209_task_link; read by the Transcript archive.';
comment on column public.transcript_tasks.kind is 'added (a new open task), banked (a new task put straight in the bank) or closed (an open task the meeting closed)';
comment on column public.transcript_tasks.title is 'the title as the meeting made it; the live title is on dept_tasks';
comment on column public.transcript_tasks.owner is 'the owner as the meeting named it';
comment on column public.transcript_tasks.due_date is 'the due date the meeting set (the bank date for a banked task)';
create index if not exists transcript_tasks_tx_idx on public.transcript_tasks (transcript_id);
create index if not exists transcript_tasks_task_idx on public.transcript_tasks (task_id);

alter table public.transcript_tasks enable row level security;
-- readable with the transcript (its own policy decides); written only by the database
create policy transcript_tasks_read on public.transcript_tasks for select to authenticated
  using (exists (select 1 from public.transcripts t where t.id = transcript_id));
grant select on public.transcript_tasks to authenticated;

-- what a transcript may show for each task: the live row when the reader may see it,
-- the snapshot for a banked task (hidden from every board) or one removed since
create or replace function public.transcript_outcomes(p_ids bigint[])
returns table (transcript_id bigint, task_id bigint, kind text, title text, owner text, due_date date,
               done boolean, banked boolean, department text, project_id bigint, live boolean)
language sql stable security invoker set search_path to '' as $$
  select l.transcript_id, l.task_id, l.kind,
         coalesce(d.title, l.title), coalesce(d.owner, l.owner),
         coalesce(d.due_date, d.bank_due, l.due_date),
         coalesce(d.done, l.kind = 'closed'),
         (l.kind = 'banked' and d.id is null),
         d.department, d.project_id, (d.id is not null)
  from public.transcript_tasks l
  left join public.dept_tasks d on d.id = l.task_id
  where l.transcript_id = any (p_ids)
    and (d.id is not null or l.kind = 'banked' or l.task_id is null)
  order by l.transcript_id, case l.kind when 'added' then 0 when 'banked' then 1 else 2 end, l.id
$$;
comment on function public.transcript_outcomes(bigint[]) is 'wave210: the tasks each transcript added, banked or closed, with the live owner, due date and state when the reader may see the task';
grant execute on function public.transcript_outcomes(bigint[]) to authenticated;

-- the trigger: a task written by the AI under a meeting's name is linked to that meeting
create or replace function public.wa209_task_link() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v_tx bigint; v_kind text;
begin
  if coalesce(new.updated_by, '') not like 'AI: %' then return new; end if;
  if tg_op = 'INSERT' then
    v_kind := case when new.banked_at is not null then 'banked' else 'added' end;
  elsif tg_op = 'UPDATE' and new.done = true and coalesce(old.done, false) = false then
    v_kind := 'closed';
  else
    return new;
  end if;
  -- apply_transcript_result says which transcript it is working for; otherwise the transcript whose
  -- name the AI signed with: the one still being processed first, then the latest
  if coalesce(current_setting('wa209.tx', true), '') ~ '^[0-9]+$' then
    v_tx := current_setting('wa209.tx', true)::bigint;
  else
  select id into v_tx from public.transcripts
    where 'AI: ' || coalesce(title, '') = new.updated_by
    order by (processed_at is null or processed_at > now() - interval '15 minutes') desc, created_at desc
    limit 1;
  end if;
  if v_tx is null then return new; end if;
  insert into public.transcript_tasks (transcript_id, task_id, kind, title, owner, due_date)
    values (v_tx, new.id, v_kind, new.title, new.owner, coalesce(new.due_date, new.bank_due, new.bank_until))
    on conflict do nothing;
  return new;
end $$;
create trigger trg_wa209_task_link after insert or update of done on public.dept_tasks
  for each row execute function public.wa209_task_link();
comment on function public.wa209_task_link() is 'wave210: links a task the AI inserted or closed (updated_by AI: <title>) to its transcript in transcript_tasks';

-- the backfill: change_log rows written by the AI, matched to the transcript of the same name
-- (the processing nearest in time when the same title was processed more than once)
with ai as (
  select c.id, c.entity_type, c.field, c.entity_id, c.changed_by, c.changed_at
  from public.change_log c
  where c.changed_by like 'AI: %'
    and ((c.entity_type = 'dept_task' and c.field in ('added','banked','done'))
      or (c.entity_type = 'task' and c.field in ('created','done')))
), tx as (
  select t.id, 'AI: ' || coalesce(t.title,'') as by, coalesce(t.processed_at, t.created_at) as at
  from public.transcripts t
), pick as (
  select distinct on (ai.id) ai.*, tx.id as transcript_id
  from ai join tx on tx.by = ai.changed_by
  order by ai.id, abs(extract(epoch from (tx.at - ai.changed_at)))
), rows_ as (
  select p.transcript_id,
         case when p.field <> 'created' and p.entity_id ~ '^[0-9]+$' then p.entity_id::bigint
              when p.field <> 'created' then null
              else (select d.id from public.dept_tasks d
                      where left(d.title, 120) = p.entity_id and d.updated_by = p.changed_by
                        and d.opened_at between p.changed_at - interval '2 minutes' and p.changed_at + interval '2 minutes'
                      order by d.id limit 1) end as task_id,
         case when p.field in ('done') then 'closed' when p.field = 'banked' then 'banked' else 'added' end as kind,
         p.changed_at
  from pick p
)
insert into public.transcript_tasks (transcript_id, task_id, kind, title, owner, due_date, created_at)
select r.transcript_id, r.task_id, r.kind, d.title, d.owner, coalesce(d.due_date, d.bank_due, d.bank_until), r.changed_at
from rows_ r join public.dept_tasks d on d.id = r.task_id
on conflict do nothing;

insert into public.change_log (entity_type, entity_id, field, new_value, changed_by)
values ('hub', 'release', 'wave210', 'The Transcript archive shows the tasks each meeting added, banked or closed, with owner and due date (transcript_tasks, backfilled from the change log)', 'assistant');
