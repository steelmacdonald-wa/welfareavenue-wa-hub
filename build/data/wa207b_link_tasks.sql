-- wave207 (04/10/26): tasks with no project whose workstream names exactly one project of their own team are linked to it.
-- Only unambiguous cases (Steel: "link only unambiguous cases (for example workstream name equals project name)"):
--   Fundraising "Donor program" -> Donor Program (the project's name; General Outreach & Networking only shares the workstream)
--   Fundraising "Fundraising events" -> Fundraising Events (the project's name; the event projects only share the workstream)
--   Fundraising "Grants" -> Grants Program (the only project whose workstream is Grants)
-- Everything else is left for people (the project page's Link existing tasks). Logged per task in change_log.
with m as (
  select t.id as task_id, p.id as project_id, p.name
  from public.dept_tasks t
  join public.projects p on p.department = t.department and p.status = 'active' and p.banked_at is null
   and ((lower(btrim(t.subsection)) = 'donor program' and lower(btrim(p.name)) = 'donor program')
     or (lower(btrim(t.subsection)) = 'fundraising events' and lower(btrim(p.name)) = 'fundraising events')
     or (lower(btrim(t.subsection)) = 'grants' and lower(btrim(p.workstream)) = 'grants'))
  where t.project_id is null and t.parent_task_id is null and t.banked_at is null and t.department = 'fundraising'
), u as (
  update public.dept_tasks t set project_id = m.project_id, updated_at = now(), updated_by = 'wave207 (workstream matches one project)'
  from m where t.id = m.task_id and t.project_id is null
  returning t.id, m.project_id, m.name
)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'dept_task', u.id::text, 'project_id', null, u.project_id || ' ' || u.name || ' (wave207: its workstream names this project only)', 'wave207 migration' from u;
