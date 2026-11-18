/* wave353 (18/11/26): Triage. Tasks and requests sorted one card at a time.
   Steel, 18/11/26: tasks as swipe cards (right = done, left = a later date: next meeting, in 7 days or a date), with
   Task bank, Reassign and Move to another project on the card; leaders triage the requests that reach them (keep,
   route to a person or a team, status, done) and the Hub learns where each kind of request belongs. */

/* ---------- tasks: move to another project ---------- */
create or replace function public.wa353_task_project(p_task bigint, p_project bigint)
returns jsonb language plpgsql set search_path = '' as $$
declare v_name text; v_old bigint; v_dept text; v_pname text; v_title text;
begin
  select m.name into v_name from public.team_members m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and m.active limit 1;
  if v_name is null then raise exception 'not on the team roster'; end if;
  if p_task is null or (not exists (select 1 from public.wa237_due_check() c where c.task_id = p_task)
     and not exists (select 1 from public.dept_tasks d join public.task_assignees a on a.task_id = d.id
                     join public.team_members m on m.id = a.member_id where d.id = p_task and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))) then
    raise exception 'that task is not on your list';
  end if;
  select d.project_id, d.title into v_old, v_title from public.dept_tasks d where d.id = p_task;
  if p_project is not null then
    select p.department, p.name into v_dept, v_pname from public.projects p where p.id = p_project and p.banked_at is null;
    if v_pname is null then raise exception 'that project is not open'; end if;
  end if;
  update public.dept_tasks set project_id = p_project, department = coalesce(v_dept, department), updated_at = now(), updated_by = v_name where id = p_task;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('dept_task', p_task::text, 'project_id', v_old::text, coalesce(p_project::text, 'none') || ' (' || coalesce(v_pname, 'no project') || ', moved in Triage)', v_name);
  return jsonb_build_object('ok', true, 'project', v_pname, 'department', v_dept);
end $$;
comment on function public.wa353_task_project(bigint, bigint) is 'wave353 Triage: moves one of the caller''s own tasks (on their due-date list or assigned to them) to another open project, and to that project''s team; logs to change_log. Called from the Triage cards.';
revoke all on function public.wa353_task_project(bigint, bigint) from public, anon;
grant execute on function public.wa353_task_project(bigint, bigint) to authenticated;

/* ---------- requests: triage marks, routes, rules ---------- */
alter table public.dept_requests add column if not exists triaged_at timestamptz;
alter table public.dept_requests add column if not exists triaged_by text;
comment on column public.dept_requests.triaged_at is 'wave353: when someone sorted this request in Triage (kept it, routed it, set its status or closed it). Null = still to sort; Triage shows it to its owner or the team''s lead.';
comment on column public.dept_requests.triaged_by is 'wave353: roster name of whoever sorted it in Triage.';

create table if not exists public.wa353_request_routes (
  id bigint generated always as identity primary key,
  request_id bigint references public.dept_requests(id) on delete set null,
  type_key text, source text,
  from_department text, from_person text,
  to_department text, to_person text,
  routed_by text not null,
  routed_at timestamptz not null default now()
);
create index if not exists wa353_request_routes_type on public.wa353_request_routes (type_key, routed_at desc);
create index if not exists wa353_request_routes_req on public.wa353_request_routes (request_id);
comment on table public.wa353_request_routes is 'wave353: every request sent on in Triage (from which team or person to which). Written only by wa353_request_triage; read by wa353_request_deck to suggest where the same kind of request went last time. Staff read.';
alter table public.wa353_request_routes enable row level security;
create policy wa353_routes_staff_read on public.wa353_request_routes for select using (public.is_wa_staff());
grant select on public.wa353_request_routes to authenticated;

create table if not exists public.wa353_request_rules (
  id bigint generated always as identity primary key,
  type_key text not null,
  source_prefix text,
  to_department text,
  to_person text,
  made_by text not null,
  made_at timestamptz not null default now(),
  active boolean not null default true,
  constraint wa353_rules_target check (to_department is not null or to_person is not null)
);
create unique index if not exists wa353_request_rules_one on public.wa353_request_rules (type_key, coalesce(source_prefix, '')) where active;
comment on table public.wa353_request_rules is 'wave353: where a kind of request goes from now on ("Always send these here" in Triage). A new dept_requests row of that type_key (and source starting with source_prefix, if set) gets this team and/or person before it is announced (trigger wa353_route_new). Written only by wa353_request_triage (the team''s lead or an admin); staff read.';
alter table public.wa353_request_rules enable row level security;
create policy wa353_rules_staff_read on public.wa353_request_rules for select using (public.is_wa_staff());
grant select on public.wa353_request_rules to authenticated;

create or replace function public.wa353_route_new() returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.wa353_request_rules%rowtype;
begin
  select * into v from public.wa353_request_rules r
   where r.active and r.type_key = new.type_key
     and (r.source_prefix is null or coalesce(new.source, '') like r.source_prefix || '%')
   order by (r.source_prefix is null), r.made_at desc limit 1;
  if v.id is not null then
    if v.to_department is not null then new.department := v.to_department; end if;
    if v.to_person is not null and new.assignee is null then new.assignee := v.to_person; end if;
  end if;
  return new;
end $$;
comment on function public.wa353_route_new() is 'wave353: before a request is inserted, applies the newest active wa353_request_rules row for its type (the Hub learning where these go).';
create trigger wa353_route_new before insert on public.dept_requests for each row execute function public.wa353_route_new();

/* who leads which teams: a Hub leader or admin (or a director) leads their own team; Finance belongs to whoever leads with
   "finance" in their role */
create or replace function public.wa353_my_teams() returns text[] language sql stable set search_path = '' as $$
  with me as (select m.* from public.team_members m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and m.active limit 1),
  lead as (select me.*, (exists (select 1 from public.hub_roles r where r.email = lower(me.email) and r.role in ('admin', 'leader')) or coalesce(me.role, '') ~* 'director') as is_lead from me)
  select case when not coalesce((select is_lead from lead), false) then '{}'::text[]
              else array_remove(array[(select department from lead), case when (select coalesce(role, '') from lead) ~* 'finance' then 'finance' end], null) end
$$;
comment on function public.wa353_my_teams() is 'wave353: the team codes the caller sorts requests for in Triage (their own team if they lead it; plus finance for a lead whose role names finance).';
revoke all on function public.wa353_my_teams() from public, anon;
grant execute on function public.wa353_my_teams() to authenticated;

create or replace function public.wa353_request_deck()
returns table(id bigint, type_key text, type_label text, department text, title text, details jsonb, status text, statuses jsonb,
              requested_by text, created_at timestamptz, needed_by date, priority text, source text, assignee text, why text,
              suggest_department text, suggest_person text, same_kind int)
language plpgsql stable set search_path = '' as $$
declare v_me public.team_members%rowtype; v_first text; v_teams text[]; v_admin boolean;
begin
  select * into v_me from public.team_members m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and m.active limit 1;
  if v_me.id is null then return; end if;
  v_first := regexp_replace(lower(split_part(trim(v_me.name), ' ', 1)), '[^a-z]', '', 'g');
  v_teams := public.wa353_my_teams();
  v_admin := exists (select 1 from public.hub_roles r where r.email = lower(v_me.email) and r.role = 'admin');
  return query
  with cand as (
    select r.*, case when v_first <> '' and lower(coalesce(r.assignee, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)') then 'yours' else 'team' end as why_
    from public.dept_requests r
    where not coalesce(r.done, false) and r.triaged_at is null
      and lower(coalesce(r.status, '')) not in ('done', 'closed task', 'denied', 'reimbursement received')
      and ((v_first <> '' and lower(coalesce(r.assignee, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)'))
           or (r.assignee is null and r.department = any (v_teams))
           /* an admin also sorts unowned requests for a team nobody leads */
           or (v_admin and r.assignee is null and (r.department is null or not exists (
                 select 1 from public.team_members m where m.active and (m.department = r.department or (r.department = 'finance' and coalesce(m.role, '') ~* 'finance'))
                   and (exists (select 1 from public.hub_roles h where h.email = lower(m.email) and h.role in ('admin', 'leader')) or coalesce(m.role, '') ~* 'director')))))
  ), hist as (
    select x.type_key, x.to_department, x.to_person, count(*) n, max(x.routed_at) last
    from public.wa353_request_routes x where x.routed_at > now() - interval '120 days' group by 1, 2, 3
  )
  select c.id, c.type_key, t.label, c.department, c.title, c.details, c.status, coalesce(to_jsonb(t.statuses), '[]'::jsonb),
         c.requested_by, c.created_at, c.needed_by, c.priority, c.source, c.assignee, c.why_,
         h.to_department, h.to_person,
         (count(*) over (partition by c.type_key, c.department))::int
  from cand c
  left join public.request_types t on t.key = c.type_key
  left join lateral (select hh.to_department, hh.to_person from hist hh where hh.type_key = c.type_key order by hh.n desc, hh.last desc limit 1) h on true
  order by case c.why_ when 'yours' then 0 else 1 end, c.needed_by nulls last, c.created_at
  limit 200;
end $$;
comment on function public.wa353_request_deck() is 'wave353 Triage: the open, unsorted requests the caller should sort: assigned to them by name, or unowned for a team they lead (admins also get unowned ones for a team with no lead). With where this kind went last time (wa353_request_routes) and how many of the same kind wait.';
revoke all on function public.wa353_request_deck() from public, anon;
grant execute on function public.wa353_request_deck() to authenticated;

create or replace function public.wa353_request_triage(p jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_item jsonb; v_id bigint; v_act text; v_row public.dept_requests%rowtype; v_name text; v_email text; v_first text;
        v_teams text[]; v_admin boolean; v_ok boolean; v_n int := 0; v_skip jsonb := '[]'::jsonb; v_dept text; v_person text;
        v_status text; v_rule boolean; v_rules int := 0;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select m.name into v_name from public.team_members m where lower(m.email) = v_email and m.active limit 1;
  if v_name is null then raise exception 'not on the team roster'; end if;
  v_first := regexp_replace(lower(split_part(trim(v_name), ' ', 1)), '[^a-z]', '', 'g');
  v_teams := public.wa353_my_teams();
  v_admin := exists (select 1 from public.hub_roles r where r.email = v_email and r.role = 'admin');
  for v_item in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint; v_act := coalesce(v_item ->> 'action', '');
    if v_id is null then continue; end if;
    begin
      select * into v_row from public.dept_requests where id = v_id;
      if v_row.id is null then v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'not found'); continue; end if;
      v_ok := v_admin or v_row.department = any (v_teams)
              or (v_first <> '' and lower(coalesce(v_row.assignee, '')) ~ ('(^|[^a-z])' || v_first || '([^a-z]|$)'));
      if not v_ok then v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'not yours to sort'); continue; end if;

      if v_act = 'keep' then
        update public.dept_requests set assignee = coalesce(assignee, v_name), triaged_at = now(), triaged_by = v_name, updated_at = now(), updated_by = v_name where id = v_id;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_request', v_id::text, 'triage', v_row.assignee, coalesce(v_row.assignee, v_name) || ' keeps it (Triage)', v_name);
      elsif v_act = 'done' then
        update public.dept_requests set done = true, done_at = now(), status = 'Done', triaged_at = now(), triaged_by = v_name, updated_at = now(), updated_by = v_name where id = v_id;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_request', v_id::text, 'done', v_row.status, 'Done (Triage)', v_name);
      elsif v_act = 'status' then
        v_status := nullif(trim(coalesce(v_item ->> 'status', '')), '');
        if v_status is null then continue; end if;
        update public.dept_requests set status = v_status, done = (lower(v_status) = 'done'), done_at = case when lower(v_status) = 'done' then now() else done_at end,
               assignee = coalesce(assignee, v_name), triaged_at = now(), triaged_by = v_name, updated_at = now(), updated_by = v_name where id = v_id;
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_request', v_id::text, 'status', v_row.status, v_status || ' (Triage)', v_name);
      elsif v_act = 'route' then
        v_dept := nullif(v_item ->> 'department', ''); v_person := nullif(trim(coalesce(v_item ->> 'person', '')), '');
        if v_person is not null then
          select m.name, coalesce(v_dept, m.department) into v_person, v_dept from public.team_members m where m.active and lower(m.name) = lower(v_person) limit 1;
          if v_person is null then v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'pick someone on the roster'); continue; end if;
        end if;
        if v_dept is not null and v_dept <> 'finance' and not exists (select 1 from public.dept_meta d where d.department = v_dept) then
          v_skip := v_skip || jsonb_build_object('id', v_id, 'why', 'unknown team'); continue;
        end if;
        if v_dept is null and v_person is null then continue; end if;
        /* sent to a team: it waits there for that team's lead (unowned, unsorted); sent to a person: theirs, still to sort by them */
        update public.dept_requests set department = coalesce(v_dept, department), assignee = v_person,
               triaged_at = null, triaged_by = null, updated_at = now(), updated_by = v_name where id = v_id;
        insert into public.wa353_request_routes (request_id, type_key, source, from_department, from_person, to_department, to_person, routed_by)
        values (v_id, v_row.type_key, v_row.source, v_row.department, v_row.assignee, coalesce(v_dept, v_row.department), v_person, v_name);
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('dept_request', v_id::text, 'routed', coalesce(v_row.assignee, '') || ' / ' || coalesce(v_row.department, ''),
                coalesce(v_person, 'the team') || ' / ' || coalesce(v_dept, v_row.department, '') || ' (sent on in Triage)', v_name);
        /* the team or person it now belongs to hears about it the way a new request is announced */
        if v_dept is distinct from v_row.department or v_person is distinct from v_row.assignee then
          begin perform public.wa_notify_call(jsonb_build_object('event', 'request_filed', 'request_id', v_id)); exception when others then null; end;
        end if;
        v_rule := coalesce((v_item ->> 'always')::boolean, false);
        if v_rule and v_row.type_key is not null and (v_admin or v_row.department = any (v_teams)) then
          update public.wa353_request_rules set active = false where type_key = v_row.type_key and source_prefix is null and active;
          insert into public.wa353_request_rules (type_key, to_department, to_person, made_by) values (v_row.type_key, v_dept, v_person, v_name);
          insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
          values ('request_rule', v_row.type_key, 'route', null, 'from now on: ' || coalesce(v_person, '') || case when v_person is not null and v_dept is not null then ', ' else '' end || coalesce(v_dept, ''), v_name);
          v_rules := v_rules + 1;
        end if;
      else
        continue;
      end if;
      v_n := v_n + 1;
    exception when others then
      v_skip := v_skip || jsonb_build_object('id', v_id, 'why', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('saved', v_n, 'rules', v_rules, 'skipped', v_skip);
end $$;
comment on function public.wa353_request_triage(jsonb) is 'wave353 Triage: sorts requests. Items {id, action: keep | done | status (status) | route (department and/or person, always)}. Allowed for the request''s assignee, the lead of its team, or an admin. route logs wa353_request_routes, announces it like a new request (notify request_filed) and, with always, saves a wa353_request_rules row (lead of the team or admin).';
revoke all on function public.wa353_request_triage(jsonb) from public, anon;
grant execute on function public.wa353_request_triage(jsonb) to authenticated;
