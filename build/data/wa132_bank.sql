-- wa132_bank (26/09/26): the bank. Tasks and projects that cannot be done in the next three to six months go to the
-- bank: out of every board, list, count and alert, and back on their date (a daily job at 6:05 Toronto time).
-- Steel: "store tasks that can't be done in the next three to six months, but kept in a bank to resurface later on,
-- like projects as well", and give the AI the option (process-transcript v13 and Ask the Hub bank what is put off).
-- The web app never reads a banked row (a restrictive select policy); the bank itself goes through the RPCs below.
-- Things banked together (a task with its subtasks, a project with its sub-projects and tasks) share one banked_at
-- and come back together; bank_project_id marks the tasks that went with a project.

alter table public.dept_tasks
  add column if not exists banked_at timestamptz,
  add column if not exists bank_until date,
  add column if not exists bank_note text,
  add column if not exists banked_by text,
  add column if not exists bank_due date,
  add column if not exists bank_project_id bigint,
  add column if not exists resurfaced_at timestamptz;
alter table public.projects
  add column if not exists banked_at timestamptz,
  add column if not exists bank_until date,
  add column if not exists bank_note text,
  add column if not exists banked_by text,
  add column if not exists resurfaced_at timestamptz;
create index if not exists dept_tasks_bank_idx on public.dept_tasks (bank_until) where banked_at is not null;
create index if not exists dept_tasks_bank_project_idx on public.dept_tasks (bank_project_id) where bank_project_id is not null;
create index if not exists dept_tasks_resurfaced_idx on public.dept_tasks (resurfaced_at) where resurfaced_at is not null;
create index if not exists projects_bank_idx on public.projects (bank_until) where banked_at is not null;

-- what is in the bank stays out of every read the web app makes
drop policy if exists dept_tasks_not_banked on public.dept_tasks;
create policy dept_tasks_not_banked on public.dept_tasks as restrictive for select to authenticated using (banked_at is null);
drop policy if exists projects_not_banked on public.projects;
create policy projects_not_banked on public.projects as restrictive for select to authenticated using (banked_at is null);

-- who is acting (for the audit trail and banked_by)
create or replace function public.wa_actor_name()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((select m.name from public.team_members m where lower(m.email) = public.wa_email() and m.active is not false order by m.id limit 1), nullif(public.wa_email(), ''), 'someone');
$$;

-- today in Toronto (the resurfacing date is a Toronto date)
create or replace function public.wa_today()
returns date
language sql
stable
set search_path to ''
as $$ select (now() at time zone 'America/Toronto')::date; $$;

-- who may bank: staff with a working role (a board viewer only reads)
create or replace function public.wa_can_bank()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_wa_staff() and not exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'viewer');
$$;

-- a task with its subtasks, and a project with its sub-projects, all the way down
create or replace function public.wa_task_tree(p_id bigint)
returns setof bigint
language sql
stable
security definer
set search_path to ''
as $$
  with recursive tree(id) as (
    select t.id from public.dept_tasks t where t.id = p_id
    union
    select c.id from public.dept_tasks c join tree on c.parent_task_id = tree.id
  ) select id from tree;
$$;
create or replace function public.wa_project_tree(p_id bigint)
returns setof bigint
language sql
stable
security definer
set search_path to ''
as $$
  with recursive tree(id) as (
    select p.id from public.projects p where p.id = p_id
    union
    select c.id from public.projects c join tree on c.parent_id = tree.id
  ) select id from tree;
$$;

-- a project's lead (by first name, as projects.leads holds them) or a leader
create or replace function public.wa_leads_project(p_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_wa_leader() or exists (
    select 1 from public.projects p,
      jsonb_array_elements_text(case when jsonb_typeof(p.leads) = 'array' then p.leads else '[]'::jsonb end) l
    where p.id = p_id and public.wa_name_matches(l));
$$;

-- the bank: what is in it and what came back in the last 14 days (staff; the same visibility as the boards)
create or replace function public.bank_list()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_board boolean := public.is_board_circle(); v_work boolean := public.wa_can_bank();
begin
  if not public.is_wa_staff() then return jsonb_build_object('tasks', '[]'::jsonb, 'projects', '[]'::jsonb, 'back', '[]'::jsonb, 'today', public.wa_today(), 'can_bank', false, 'leader', false); end if;
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
            and (par.id is null or par.resurfaced_at is distinct from p.resurfaced_at)) s), '[]'::jsonb),
    'today', public.wa_today(),
    'can_bank', v_work,
    'leader', public.is_wa_leader()
  );
end;
$$;

-- ---------- the work itself (no caller check: only the functions below, the daily job and the edge functions call these) ----------

-- bank a task with its open subtasks; the due date is kept aside so no alert fires while it waits
create or replace function public.bank_task_do(p_id bigint, p_until date, p_note text, p_by text)
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare t public.dept_tasks%rowtype; v_n int; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_until is null or p_until <= public.wa_today() then raise exception 'pick a date after today'; end if;
  if p_until > public.wa_today() + 1100 then raise exception 'pick a date in the next three years'; end if;
  select * into t from public.dept_tasks where id = p_id;
  if not found or t.done or t.banked_at is not null then raise exception 'that task is not open'; end if;
  update public.dept_tasks set banked_at = now(), bank_until = p_until, bank_note = left(v_note, 300), banked_by = p_by,
      bank_due = due_date, due_date = null, resurfaced_at = null, updated_by = p_by, updated_at = now()
    where id in (select public.wa_task_tree(p_id)) and done = false and banked_at is null;
  get diagnostics v_n = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, board_only)
  values ('dept_task', p_id::text, 'banked', t.title, 'in the bank until ' || to_char(p_until, 'FMMonth FMDD, YYYY') || coalesce(': ' || left(v_note, 300), ''), p_by, coalesce(t.board_only, false));
  return v_n;
end;
$$;

-- bank a project with its sub-projects and every open task in them (and their subtasks)
create or replace function public.bank_project_do(p_id bigint, p_until date, p_note text, p_by text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare p public.projects%rowtype; v_p int; v_t int; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_until is null or p_until <= public.wa_today() then raise exception 'pick a date after today'; end if;
  if p_until > public.wa_today() + 1100 then raise exception 'pick a date in the next three years'; end if;
  select * into p from public.projects where id = p_id;
  if not found or p.banked_at is not null then raise exception 'that project is not active'; end if;
  if lower(trim(p.name)) in ('general ops toronto', 'general ops montreal', 'general hr', 'general marketing', 'general fundraising', 'general governance', 'general program development', 'general programs') then raise exception 'a team''s general list stays on the board'; end if;
  update public.projects set banked_at = now(), bank_until = p_until, bank_note = left(v_note, 300), banked_by = p_by, resurfaced_at = null, updated_at = now()
    where id in (select public.wa_project_tree(p_id)) and banked_at is null;
  get diagnostics v_p = row_count;
  with recursive tree(id) as (
    select t.id from public.dept_tasks t where t.project_id in (select public.wa_project_tree(p_id))
    union
    select c.id from public.dept_tasks c join tree on c.parent_task_id = tree.id
  )
  update public.dept_tasks set banked_at = now(), bank_until = p_until, bank_note = left(v_note, 300), banked_by = p_by,
      bank_due = due_date, due_date = null, bank_project_id = p_id, resurfaced_at = null, updated_by = p_by, updated_at = now()
    where id in (select id from tree) and done = false and banked_at is null;
  get diagnostics v_t = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('project', p_id::text, 'banked', p.name, 'in the bank until ' || to_char(p_until, 'FMMonth FMDD, YYYY') || ' with ' || v_t || ' open task' || case when v_t = 1 then '' else 's' end || coalesce(': ' || left(v_note, 300), ''), p_by);
  return jsonb_build_object('projects', v_p, 'tasks', v_t, 'until', p_until);
end;
$$;

-- bring something back (with everything banked with it); a task whose project or parent is still in the bank comes back on its own
create or replace function public.bank_unbank_do(p_kind text, p_id bigint, p_why text, p_by text)
returns int
language plpgsql
security definer
set search_path to ''
as $$
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
  values (case when p_kind = 'project' then 'project' else 'dept_task' end, p_id::text, 'back from the bank', v_title, coalesce(nullif(trim(coalesce(p_why, '')), ''), 'brought back'), p_by, v_bo);
  return v_n;
end;
$$;

-- ---------- what the web app calls (staff; the same visibility as the boards) ----------

create or replace function public.bank_task(p_id bigint, p_until date, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare t public.dept_tasks%rowtype;
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  select * into t from public.dept_tasks where id = p_id;
  if not found then raise exception 'that task is not open'; end if;
  if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
  return jsonb_build_object('banked', public.bank_task_do(p_id, p_until, p_note, public.wa_actor_name()), 'until', p_until);
end;
$$;

-- something new that already knows it can wait: straight into the bank
create or replace function public.bank_add_task(p_department text, p_title text, p_until date, p_note text default null, p_project_id bigint default null, p_owner text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_id bigint; v_by text := public.wa_actor_name(); v_title text := left(trim(coalesce(p_title, '')), 250); v_proj bigint; v_note text := left(nullif(trim(coalesce(p_note, '')), ''), 300);
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if v_title = '' then raise exception 'give it a title'; end if;
  if coalesce(p_department, '') not in ('opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board') then raise exception 'pick a team'; end if;
  if p_until is null or p_until <= public.wa_today() then raise exception 'pick a date after today'; end if;
  if p_until > public.wa_today() + 1100 then raise exception 'pick a date in the next three years'; end if;
  if p_project_id is not null then select id into v_proj from public.projects where id = p_project_id and banked_at is null; end if;
  insert into public.dept_tasks (department, title, owner, status, flag, priority, done, sort, updated_by, updated_at, opened_at, project_id,
                                 banked_at, bank_until, bank_note, banked_by)
  values (p_department, v_title, coalesce(nullif(trim(coalesce(p_owner, '')), ''), ''), 'Open', false, false, false, 999, v_by, now(), now(), v_proj,
          now(), p_until, v_note, v_by)
  returning id into v_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('dept_task', v_id::text, 'banked', null, v_title || ' (added straight to the bank until ' || to_char(p_until, 'FMMonth FMDD, YYYY') || coalesce(': ' || v_note, '') || ')', v_by);
  return jsonb_build_object('id', v_id, 'until', p_until);
end;
$$;

-- a project goes to the bank at the word of its lead or a leader
create or replace function public.bank_project(p_id bigint, p_until date, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if not exists (select 1 from public.projects where id = p_id) then raise exception 'that project is not active'; end if;
  if not public.wa_leads_project(p_id) then raise exception 'only the project''s lead or a leader can bank a project'; end if;
  return public.bank_project_do(p_id, p_until, p_note, public.wa_actor_name());
end;
$$;

-- bring something back now
create or replace function public.bank_unbank(p_kind text, p_id bigint, p_why text default 'brought back')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare t public.dept_tasks%rowtype;
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if p_kind = 'project' then
    if not public.wa_leads_project(p_id) then raise exception 'only the project''s lead or a leader can bring a project back'; end if;
  else
    select * into t from public.dept_tasks where id = p_id;
    if not found then raise exception 'that task is not in the bank'; end if;
    if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
  end if;
  return jsonb_build_object('back', public.bank_unbank_do(case when p_kind = 'project' then 'project' else 'task' end, p_id, coalesce(nullif(trim(coalesce(p_why, '')), ''), 'brought back'), public.wa_actor_name()));
end;
$$;

-- a new date for something in the bank
create or replace function public.bank_redate(p_kind text, p_id bigint, p_until date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
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
  else
    select * into t from public.dept_tasks where id = p_id and banked_at is not null;
    if not found then raise exception 'that task is not in the bank'; end if;
    if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
    v_at := t.banked_at; v_old := t.bank_until;
    update public.dept_tasks set bank_until = p_until, updated_at = now() where id in (select public.wa_task_tree(p_id)) and banked_at = v_at;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values (case when p_kind = 'project' then 'project' else 'dept_task' end, p_id::text, 'bank date', 'back on ' || to_char(v_old, 'FMMonth FMDD, YYYY'), 'back on ' || to_char(p_until, 'FMMonth FMDD, YYYY'), v_by);
  return jsonb_build_object('until', p_until);
end;
$$;

-- ---------- the daily job: everything whose date has come goes back on the board ----------
create or replace function public.bank_resurface()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare r record; v_t int := 0; v_p int := 0; v_today date := public.wa_today();
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
  return jsonb_build_object('tasks', v_t, 'projects', v_p, 'on', v_today);
end;
$$;

-- a banked task that gets closed (a meeting, a check-in, the chat) leaves the bank as done, so its history shows
create or replace function public.wa132_bank_close()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.banked_at := null; new.bank_until := null; new.bank_note := null; new.banked_by := null; new.bank_project_id := null;
  if new.due_date is null then new.due_date := new.bank_due; end if;
  new.bank_due := null;
  return new;
end;
$$;
drop trigger if exists trg_wa132_bank_close on public.dept_tasks;
create trigger trg_wa132_bank_close before update on public.dept_tasks
  for each row when (new.done is true and old.done is not true and new.banked_at is not null)
  execute function public.wa132_bank_close();

-- grants: the web app gets the checked functions; the work functions stay with the database and the edge functions
revoke all on function public.wa_task_tree(bigint) from public, anon, authenticated;
revoke all on function public.wa_project_tree(bigint) from public, anon, authenticated;
revoke all on function public.wa_leads_project(bigint) from public, anon;
revoke all on function public.wa_can_bank() from public, anon;
revoke all on function public.wa_actor_name() from public, anon;  -- applied as wa132_bank_grants
revoke all on function public.bank_task_do(bigint, date, text, text) from public, anon, authenticated;
revoke all on function public.bank_project_do(bigint, date, text, text) from public, anon, authenticated;
revoke all on function public.bank_unbank_do(text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.bank_resurface() from public, anon, authenticated;
revoke all on function public.bank_list() from public, anon;
revoke all on function public.bank_task(bigint, date, text) from public, anon;
revoke all on function public.bank_add_task(text, text, date, text, bigint, text) from public, anon;
revoke all on function public.bank_project(bigint, date, text) from public, anon;
revoke all on function public.bank_unbank(text, bigint, text) from public, anon;
revoke all on function public.bank_redate(text, bigint, date) from public, anon;
grant execute on function public.bank_task_do(bigint, date, text, text) to service_role;
grant execute on function public.bank_project_do(bigint, date, text, text) to service_role;
grant execute on function public.bank_unbank_do(text, bigint, text, text) to service_role;
grant execute on function public.bank_resurface() to service_role;
grant execute on function public.bank_list() to authenticated, service_role;
grant execute on function public.bank_task(bigint, date, text) to authenticated;
grant execute on function public.bank_add_task(text, text, date, text, bigint, text) to authenticated;
grant execute on function public.bank_project(bigint, date, text) to authenticated;
grant execute on function public.bank_unbank(text, bigint, text) to authenticated;
grant execute on function public.bank_redate(text, bigint, date) to authenticated;
grant execute on function public.wa_actor_name() to authenticated;
grant execute on function public.wa_can_bank() to authenticated;
grant execute on function public.wa_leads_project(bigint) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'wa-bank-resurface';
select cron.schedule('wa-bank-resurface', '5 10 * * *', 'select public.bank_resurface()');

-- the page in every access profile: staff profiles open it, the board member profile does not
update public.hub_access_profiles set pages = pages || jsonb_build_object('bank', case when key = 'board' then 'none' else 'all' end) where not (pages ? 'bank');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'access_profile', key, 'pages', null, 'The bank: ' || case when key = 'board' then 'nobody' else 'everyone' end || ' (new page)', 'Hub release (wave132)'
from public.hub_access_profiles;

-- the board's own task list leaves out what is in the bank
CREATE OR REPLACE FUNCTION public.board_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v jsonb; fy_start date; fy_end date;
begin
  if not public.can_see_board() then return null; end if;
  fy_start := case when extract(month from current_date) >= 10 then make_date(extract(year from current_date)::int, 10, 1) else make_date(extract(year from current_date)::int - 1, 10, 1) end;
  fy_end := (fy_start + interval '1 year')::date;
  select jsonb_build_object(
    'me', jsonb_build_object('member_id', public.my_board_member_id(), 'leader', public.is_wa_leader(), 'admin', public.is_wa_admin(), 'email', public.wa_email()),
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort, m.id) from public.board_members m), '[]'::jsonb),
    'committees', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort) from public.board_committees c), '[]'::jsonb),
    'meetings', coalesce((select jsonb_agg(to_jsonb(x) order by x.meets_at nulls last, x.id) from public.board_meetings x), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.job, i.sort, i.id) from public.board_items i), '[]'::jsonb),
    'touchpoints', coalesce((select jsonb_agg(to_jsonb(t) order by t.happened_on desc, t.id desc) from (select * from public.board_touchpoints order by happened_on desc, id desc limit 400) t), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'owner', d.owner, 'status', d.status, 'done', d.done, 'due_date', d.due_date, 'closed_at', d.closed_at, 'opened_at', d.opened_at) order by d.done, d.due_date nulls last, d.id)
      from public.dept_tasks d where d.department = 'board' and coalesce(d.confidential, false) = false and d.banked_at is null), '[]'::jsonb),
    'finance', jsonb_build_object(
      'fy_start', fy_start,
      'income', (select coalesce(round(sum(amount) filter (where amount > 0)::numeric, 2), 0) from public.finance_transactions where duplicate_of is null and txn_date >= fy_start and txn_date < fy_end),
      'expenses', (select coalesce(round(-sum(amount) filter (where amount < 0)::numeric, 2), 0) from public.finance_transactions where duplicate_of is null and txn_date >= fy_start and txn_date < fy_end),
      'prev_income', (select coalesce(round(sum(amount) filter (where amount > 0)::numeric, 2), 0) from public.finance_transactions where duplicate_of is null and txn_date >= (fy_start - interval '1 year') and txn_date < fy_start),
      'prev_expenses', (select coalesce(round(-sum(amount) filter (where amount < 0)::numeric, 2), 0) from public.finance_transactions where duplicate_of is null and txn_date >= (fy_start - interval '1 year') and txn_date < fy_start),
      'last_txn', (select max(txn_date) from public.finance_transactions),
      'last_statement', (select max(period_end) from public.finance_statements)),
    'goals', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'status', g.status, 'progress', g.progress, 'quarter', g.quarter) order by g.sort, g.id) from public.goals g where g.department = 'org'), '[]'::jsonb),
    'fund', jsonb_build_object(
      'goals', (select value from public.hub_settings where key = 'fund_goals'),
      'raised', (select coalesce(sum(raised), 0) from public.fund_events where start_date >= fy_start and start_date < fy_end),
      'next', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'start_date', f.start_date, 'timing', f.timing, 'status', f.status) order by f.start_date) from (select * from public.fund_events where status in ('planned', 'confirmed') and coalesce(end_date, start_date) >= current_date order by start_date limit 4) f), '[]'::jsonb))
  ) into v;
  return v;
end $function$;

-- the AI may bank what a meeting puts off: a new task with bank_until (at least 45 days out) goes straight to the bank;
-- a project in the bank is never a routing target (its tasks would land out of sight)
CREATE OR REPLACE FUNCTION public.apply_transcript_result(p_transcript_id bigint, p jsonb, p_changed_by text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tx        public.transcripts%rowtype;
  v_dept      text;
  v_old       text;
  v_item      jsonb;
  v_name      text;
  v_member_id bigint;
  v_task_id   bigint;
  v_owner     text;
  v_unmatched text;
  v_pos       int;
  v_project   bigint;
  v_bank      date;
  v_due       date;
  n_updates   int := 0;
  n_tasks     int := 0;
  n_banked    int := 0;
  n_closed    int := 0;
  n_dec_new   int := 0;
  n_dec_done  int := 0;
begin
  select * into v_tx from public.transcripts where id = p_transcript_id;
  if not found then
    raise exception 'transcript % not found', p_transcript_id;
  end if;

  -- wave116: Program Development is its own team; the old combined labels still map to Ops Montreal
  v_dept := case
    when v_tx.department = 'progdev' or (v_tx.department ilike '%program dev%' and v_tx.department not ilike '%montreal%' and v_tx.department not ilike '%toronto%' and v_tx.department not ilike '%ops%') then 'progdev'
    when v_tx.department ilike '%montreal%' or v_tx.department = 'opsmtl' then 'opsmtl'
    when v_tx.department ilike '%toronto%' or v_tx.department = 'opsto' then 'opsto'
    when v_tx.department ilike '%marketing%' then 'marketing'
    when v_tx.department ilike '%fundrais%' or v_tx.department ilike '%grant%' then 'fundraising'
    when v_tx.department ilike '%human%' or lower(v_tx.department) = 'hr' then 'hr'
    when v_tx.department ilike '%board%' then 'board'
    else null end;
  if v_dept is null then
    raise exception 'could not map department %', v_tx.department;
  end if;

  if p ? 'progress' and jsonb_typeof(p->'progress') = 'string' then
    select progress into v_old from public.dept_meta where department = v_dept;
    if coalesce(v_old,'') <> (p->>'progress') then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('dept_meta', v_dept, 'progress', v_old, p->>'progress', p_changed_by);
      update public.dept_meta set progress = p->>'progress', updated_at = now() where department = v_dept;
    end if;
  end if;

  if p ? 'read' and jsonb_typeof(p->'read') = 'string' then
    select read into v_old from public.dept_meta where department = v_dept;
    if coalesce(v_old,'') <> (p->>'read') then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('dept_meta', v_dept, 'read', v_old, p->>'read', p_changed_by);
      update public.dept_meta set read = p->>'read', updated_at = now() where department = v_dept;
    end if;
  end if;

  if p ? 'priorities' and jsonb_typeof(p->'priorities') = 'array' then
    select priorities::text into v_old from public.dept_meta where department = v_dept;
    if coalesce(v_old,'') <> (p->'priorities')::text then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('dept_meta', v_dept, 'priorities', v_old, (p->'priorities')::text, p_changed_by);
      update public.dept_meta set priorities = p->'priorities', updated_at = now() where department = v_dept;
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p->'new_updates','[]'::jsonb)) loop
    insert into public.dept_updates (department, entry_label, text, added_by)
    values (v_dept, coalesce(v_item->>'label',''), v_item->>'text', p_changed_by);
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('dept_update', v_dept, 'added', null, coalesce(v_item->>'label','') || ': ' || (v_item->>'text'), p_changed_by);
    n_updates := n_updates + 1;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p->'new_tasks','[]'::jsonb)) loop
    v_owner := coalesce(v_item->>'owner','');
    v_unmatched := '';

    -- v6: validated project routing; unknown, inactive or banked ids fall back to general (null)
    v_project := null;
    if coalesce(v_item->>'project_id','') ~ '^[0-9]+$' then
      select id into v_project from public.projects
        where id = (v_item->>'project_id')::bigint and status = 'active' and banked_at is null;
    end if;

    -- wa132: work the meeting puts off by three months or more goes to the bank, back on its date
    v_due := case when coalesce(v_item->>'due_date','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_item->>'due_date')::date else null end;
    v_bank := null;
    if coalesce(v_item->>'bank_until','') ~ '^\d{4}-\d{2}-\d{2}$' then
      v_bank := (v_item->>'bank_until')::date;
      if v_bank < greatest(coalesce(v_tx.meeting_date, public.wa_today()), public.wa_today()) + 45 or v_bank > public.wa_today() + 1100 then v_bank := null; end if;
    end if;

    -- wa116v: description and priority come with the task
    insert into public.dept_tasks (department, subsection, title, owner, status, flag, priority, done, sort,
                                   due_date, reason_category, reason_note, updated_by, opened_at, project_id, description,
                                   banked_at, bank_until, bank_note, banked_by, bank_due)
    values (v_dept,
            nullif(v_item->>'subsection',''),
            v_item->>'title',
            v_owner,
            coalesce(nullif(v_item->>'status',''),'Open'),
            coalesce((v_item->>'flag')::boolean, false),
            coalesce((v_item->>'priority')::boolean, false), false, 999,
            case when v_bank is null then v_due else null end,
            nullif(v_item->>'reason_category',''),
            nullif(v_item->>'reason_note',''),
            p_changed_by, now(), v_project,
            nullif(v_item->>'description',''),
            case when v_bank is null then null else now() end,
            v_bank,
            case when v_bank is null then null else left(coalesce(nullif(v_item->>'bank_reason',''), 'The meeting put it off until later'), 300) end,
            case when v_bank is null then null else p_changed_by end,
            case when v_bank is null then null else v_due end)
    returning id into v_task_id;

    for v_name in select jsonb_array_elements_text(coalesce(v_item->'assignees','[]'::jsonb)) loop
      v_member_id := null;
      select id into v_member_id from public.team_members
        where lower(name) = lower(v_name) and department = v_dept and active limit 1;
      if v_member_id is null then
        select id into v_member_id from public.team_members
          where lower(name) = lower(v_name) and active limit 1;
      end if;
      if v_member_id is null then
        select min(id) into v_member_id from public.team_members
          where lower(split_part(name,' ',1)) = lower(split_part(v_name,' ',1)) and active
          having count(*) = 1;
      end if;
      if v_member_id is not null then
        insert into public.task_assignees (task_id, member_id) values (v_task_id, v_member_id)
        on conflict do nothing;
      else
        v_unmatched := v_unmatched || case when v_unmatched = '' then '' else ', ' end || v_name || ' (verify name)';
      end if;
    end loop;

    if v_unmatched <> '' then
      update public.dept_tasks
        set owner = case when coalesce(owner,'') = '' then v_unmatched else owner || '; ' || v_unmatched end
        where id = v_task_id;
    end if;

    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('dept_task', v_task_id::text, case when v_bank is null then 'added' else 'banked' end, null,
            case when v_bank is null then v_item->>'title' else (v_item->>'title') || ' (in the bank until ' || to_char(v_bank, 'FMMonth FMDD, YYYY') || ')' end, p_changed_by);
    n_tasks := n_tasks + 1;
    if v_bank is not null then n_banked := n_banked + 1; end if;
  end loop;

  for v_task_id in select (jsonb_array_elements_text(coalesce(p->'close_task_ids','[]'::jsonb)))::bigint loop
    update public.dept_tasks
      set done = true, updated_by = p_changed_by, updated_at = now()
      where id = v_task_id and department = v_dept and done = false;
    if found then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('dept_task', v_task_id::text, 'done', 'open', 'closed', p_changed_by);
      n_closed := n_closed + 1;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p->'new_decisions','[]'::jsonb)) loop
    select coalesce(max(pos),0) + 1 into v_pos from public.decisions;
    insert into public.decisions (pos, title, area, suggested_move, done, reason_category, reason_note,
                                  confidential, opened_at, raised_by, owner)
    values (v_pos,
            v_item->>'title',
            coalesce(v_item->>'area',''),
            coalesce(v_item->>'suggested_move',''),
            false,
            nullif(v_item->>'reason_category',''),
            nullif(v_item->>'reason_note',''),
            coalesce((v_item->>'confidential')::boolean, false),
            now(), p_changed_by,
            nullif(v_item->>'owner',''));
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('decision', v_pos::text, 'added', null, v_item->>'title', p_changed_by);
    n_dec_new := n_dec_new + 1;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p->'decide_decisions','[]'::jsonb)) loop
    update public.decisions
      set done = true, decided_at = now(), decided_note = v_item->>'decided_note',
          updated_by = p_changed_by, updated_at = now()
      where id = (v_item->>'id')::bigint and done = false;
    if found then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('decision', v_item->>'id', 'decided', 'open', coalesce(v_item->>'decided_note','decided'), p_changed_by);
      n_dec_done := n_dec_done + 1;
    end if;
  end loop;

  update public.transcripts
    set processed = true, processed_at = now(), ai_summary = p->>'summary'
    where id = p_transcript_id;

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('transcript', p_transcript_id::text, 'processed', null, coalesce(p->>'summary',''), p_changed_by);

  return jsonb_build_object(
    'department', v_dept,
    'updates', n_updates,
    'tasks_added', n_tasks - n_banked,
    'tasks_banked', n_banked,
    'tasks_closed', n_closed,
    'decisions_added', n_dec_new,
    'decisions_decided', n_dec_done
  );
end $function$;

-- ---------- applied as wa132_bank_undo: an Undo right after moving something to the bank puts it back as it was ----------
create or replace function public.bank_undo(p_kind text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_at timestamptz; v_n int; t public.dept_tasks%rowtype;
begin
  if not public.wa_can_bank() then raise exception 'staff only'; end if;
  if p_kind = 'project' then
    if not public.wa_leads_project(p_id) then raise exception 'only the project''s lead or a leader can do that'; end if;
    select banked_at into v_at from public.projects where id = p_id;
  else
    select * into t from public.dept_tasks where id = p_id;
    if not found then raise exception 'that task is not in the bank'; end if;
    if (coalesce(t.board_only, false) and not public.is_board_circle()) or not public.wa_sees_restricted(t.visibility, t.allowed_people, t.owner) then raise exception 'not allowed'; end if;
    v_at := t.banked_at;
  end if;
  if v_at is null then raise exception 'that is not in the bank any more'; end if;
  if v_at < now() - interval '30 minutes' then raise exception 'too late to undo: bring it back from the bank instead'; end if;
  v_n := public.bank_unbank_do(case when p_kind = 'project' then 'project' else 'task' end, p_id, 'undone straight away', public.wa_actor_name());
  -- nothing was really away: no "back from the bank" mark
  update public.dept_tasks set resurfaced_at = null where resurfaced_at = now();
  update public.projects set resurfaced_at = null where resurfaced_at = now();
  return jsonb_build_object('back', v_n);
end;
$$;
revoke all on function public.bank_undo(text, bigint) from public, anon;
grant execute on function public.bank_undo(text, bigint) to authenticated;
