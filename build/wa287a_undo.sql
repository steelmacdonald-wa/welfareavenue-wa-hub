-- wa287a undo: every task back in the project it had before wave287, the workstream tags back, the trigger, the filing
-- functions and is_general gone, and the new projects removed once no task points at them. Run after putting the page back.
-- A task created after the release in one of the new projects keeps it: move it first, or the project stays (the last
-- statement says how many stayed).

drop trigger if exists trg_wa287_task_project on public.dept_tasks;
drop function if exists public.wa287_task_project();

with back as (
  update public.dept_tasks d set project_id = b.project_id
    from public.wa_tmp287_tasks_backup b
   where b.id = d.id and d.project_id is distinct from b.project_id
     and exists (select 1 from public.change_log c where c.entity_type = 'dept_task' and c.entity_id = d.id::text
                   and c.field = 'project_id' and c.changed_by = 'wa287 (projects replace workstreams)')
  returning d.id, b.project_id as old_pid
)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, changed_at)
select 'dept_task', id::text, 'project_id', null, old_pid::text, 'wa287 undo', now() from back;

update public.projects p set workstream = b.workstream
  from public.wa_tmp287_projects_backup b
 where b.id = p.id and p.workstream is distinct from b.workstream;

delete from public.projects p
 where not exists (select 1 from public.wa_tmp287_projects_backup b where b.id = p.id)
   and not exists (select 1 from public.dept_tasks t where t.project_id = p.id)
   and not exists (select 1 from public.projects c where c.parent_id = p.id);

drop function if exists public.wa287_file_task(text, text, text);
drop function if exists public.wa287_ws_project(text, text, text);
drop function if exists public.wa287_general_of(text);
drop index if exists public.projects_one_general;
alter table public.projects drop column if exists is_general;

select count(*) as new_projects_kept_because_in_use
  from public.projects p where not exists (select 1 from public.wa_tmp287_projects_backup b where b.id = p.id);
-- The backups (wa_tmp287_tasks_backup, wa_tmp287_projects_backup) stay until Steel says to drop them.
