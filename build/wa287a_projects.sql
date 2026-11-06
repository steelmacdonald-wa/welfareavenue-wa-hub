-- wa287a (06/11/26): projects replace workstreams, a General project in every team, every task in a project.
-- Steel, 06/11/26: "have a general catch-all project like most departments have, and then the work stream should just turn into
-- the different projects, and each task should be categorized in that way."
-- Design: claude/06-11-26 - Team overview, tasks and projects, design (wave287).md, section 1.
--   1. projects.is_general marks each team's catch-all (one per team). Program Development and Finance get one.
--   2. Each workstream points at a project (projects.workstream); five new projects cover the workstreams no project covered.
--   3. Every task gets a project: none -> its workstream's project, else its team's General; in its own team's General but its
--      workstream has a more specific project -> that project; in another team's General -> its own team's. A task in another
--      team's specific project stays (real cross-team work). subsection is left as it is (the pages stop showing it).
--   4. A trigger files any task saved without a project the same way.
-- Every move is logged in change_log (field project_id, by 'wa287'). Backups: wa_tmp287_tasks_backup, wa_tmp287_projects_backup.
-- Undo: build/wa287a_undo.sql.

create table if not exists public.wa_tmp287_projects_backup as select p.*, now() as saved_at from public.projects p;
create table if not exists public.wa_tmp287_tasks_backup as select t.id, t.project_id, t.subsection, now() as saved_at from public.dept_tasks t;
alter table public.wa_tmp287_projects_backup enable row level security;
alter table public.wa_tmp287_tasks_backup enable row level security;

alter table public.projects add column if not exists is_general boolean not null default false;
create unique index if not exists projects_one_general on public.projects (department) where is_general;
comment on column public.projects.is_general is 'wave287: the team''s catch-all project (one per team); a task saved without a project lands here unless its workstream has a project.';

/* 1. the General projects */
update public.projects set is_general = true where id in (21, 20, 17, 19, 18, 16) and not is_general;   -- Governance, Fundraising, HR, Marketing, Ops Montreal, Ops Toronto
update public.projects set workstream = null where id = 20 and workstream is not null;                  -- General Fundraising spans the whole team
insert into public.projects (department, name, description, status, sort, workstream, is_general)
select x.d, x.n, x.descr, 'active', x.s, x.ws, x.g
  from (values
    ('finance',  'General Finance',             'Finance work that is not tied to one project.',                       0,  null::text,                 true),
    ('finance',  'Bills and receipts',          'Bills to pay, receipts to file and reimbursements.',                  10, 'Bills and receipts',       false),
    ('hr',       'Organizational structure',    'Roles, teams, the org chart and how the organization is set up.',     40, 'Organizational structure', false),
    ('marketing','Content',                     'Social media posts, videos and everyday content.',                    5,  'Content',                  false),
    ('progdev',  'General Program Development', 'Program Development work that is not tied to one project.',          0,  null,                       true),
    ('progdev',  'Community team',              'Community leads, partnerships and outreach.',                         30, 'Community team',           false)
  ) as x(d, n, descr, s, ws, g)
 where not exists (select 1 from public.projects p where p.department = x.d and p.name = x.n);

/* 2. the workstreams the existing projects stand for */
update public.projects set workstream = v.ws
  from (values (5, 'Branding'), (6, 'Website'), (15, 'Digital advertising and Google Ads'), (18, 'General'),
               (3, 'Research and data'), (4, 'Beneficiary programs'), (8, 'Onboarding and recruitment'), (9, 'Onboarding and recruitment')) as v(id, ws)
 where projects.id = v.id and projects.workstream is distinct from v.ws;

/* 3. how a task is filed */
create or replace function public.wa287_general_of(p_dept text)
 returns bigint language sql stable security definer set search_path to '' as $$
  select p.id from public.projects p where p.department = p_dept and p.is_general limit 1
$$;

create or replace function public.wa287_ws_project(p_dept text, p_ws text, p_title text)
 returns bigint language sql stable security definer set search_path to '' as $$
  /* the project standing for this workstream in this team: top-level, active, not banked; where two share a workstream
     (HR's Onboarding Program and Recruitment), the one whose first word is in the title, else the one with more tasks */
  select p.id
    from public.projects p
   where p.department = p_dept and nullif(btrim(coalesce(p_ws, '')), '') is not null
     and lower(p.workstream) = lower(btrim(p_ws)) and p.parent_id is null
     and coalesce(p.status, 'active') = 'active' and p.banked_at is null
   order by (position(lower(left(split_part(p.name, ' ', 1), 7)) in lower(coalesce(p_title, ''))) > 0) desc,
            (select count(*) from public.dept_tasks t where t.project_id = p.id) desc, p.id
   limit 1
$$;

create or replace function public.wa287_file_task(p_dept text, p_ws text, p_title text)
 returns bigint language sql stable security definer set search_path to '' as $$
  select coalesce(public.wa287_ws_project(p_dept, p_ws, p_title), public.wa287_general_of(p_dept))
$$;
revoke all on function public.wa287_general_of(text), public.wa287_ws_project(text, text, text), public.wa287_file_task(text, text, text) from public, anon;
grant execute on function public.wa287_general_of(text), public.wa287_ws_project(text, text, text), public.wa287_file_task(text, text, text) to authenticated;

/* 4. every task in a project */
create temp table wa287_moves on commit drop as
with t as (
  select d.id, d.department, d.subsection, d.title, d.project_id, d.board_only, d.visibility, d.allowed_people,
         p.department as pdept, coalesce(p.is_general, false) as pgen,
         public.wa287_general_of(d.department) as own_gen,
         public.wa287_ws_project(d.department, d.subsection, d.title) as ws_proj
    from public.dept_tasks d left join public.projects p on p.id = d.project_id
)
select id, project_id as old_pid,
       case
         when project_id is null then coalesce(ws_proj, own_gen)                                       -- no project
         when pgen and pdept = department and ws_proj is not null and ws_proj <> project_id then ws_proj -- own General, a specific workstream
         when pgen and pdept <> department then coalesce(ws_proj, own_gen)                             -- another team's General
       end as new_pid,
       board_only, visibility, allowed_people
  from t;
delete from wa287_moves where new_pid is null or new_pid is not distinct from old_pid;

update public.dept_tasks d set project_id = m.new_pid from wa287_moves m where m.id = d.id;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, changed_at, board_only, visibility, allowed_people)
select 'dept_task', m.id::text, 'project_id', m.old_pid::text, m.new_pid::text, 'wa287 (projects replace workstreams)', now(),
       coalesce(m.board_only, false), m.visibility, m.allowed_people
  from wa287_moves m;

/* 5. from now on: a task saved without a project is filed the same way */
create or replace function public.wa287_task_project()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.project_id is null then
    new.project_id := public.wa287_file_task(new.department, new.subsection, new.title);
  end if;
  return new;
end $$;
drop trigger if exists trg_wa287_task_project on public.dept_tasks;
create trigger trg_wa287_task_project before insert or update of project_id, department on public.dept_tasks
  for each row execute function public.wa287_task_project();

comment on function public.wa287_task_project() is 'wave287: a task saved without a project goes to its workstream''s project, else its team''s General project.';
