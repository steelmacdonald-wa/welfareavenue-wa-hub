-- wave207 (04/10/26): each organizational goal anchored on WA's registered charitable activities, and this year's goals
-- (FY27) as yearly targets with quarterly checkpoints. Steel (04/10/26): store them structurally, show them on each goal,
-- editable live like the other goal fields, with history; "Copy the doc's wording exactly; no invented targets."
-- Source: the Claude Doc "29/09/26 - Welfare Avenue Organizational Goals FY27-FY31 (Draft)" (revision 369), sections
-- "Anchored in our 8 charitable activities", each goal's "Charitable activities:" line and "This year's goals: FY27".
-- Applied after wa207a_history_kinds (goal_history's entity check gains activity, target and checkpoint).

-- ---------- the eight registered charitable activities (reference) ----------
create table public.charitable_activities (
  id smallint primary key check (id between 1 and 20),
  title text not null,
  sort smallint not null default 0,
  source text,
  created_at timestamptz not null default now()
);
comment on table public.charitable_activities is 'wave207: Welfare Avenue''s charitable activities as registered with the CRA (the July 2026 board deck), numbered 1 to 8 with their wording. A reference: written by migrations only (the wording is what the CRA holds, so it is not edited on the page). Read by staff and board viewers. Goals are anchored on them through goal_activities.';
comment on column public.charitable_activities.id is 'The activity''s number as the plan uses it (1 to 8).';
comment on column public.charitable_activities.title is 'The activity''s wording, exactly as the plan states it.';
comment on column public.charitable_activities.source is 'Where the wording comes from.';

-- ---------- which activities each organizational goal serves, and why ----------
create table public.goal_activities (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.goals(id),
  activity_id smallint not null references public.charitable_activities(id),
  reason text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz,
  unique (goal_id, activity_id)
);
create index goal_activities_goal_id_idx on public.goal_activities(goal_id, sort);
create index goal_activities_activity_id_idx on public.goal_activities(activity_id);
comment on table public.goal_activities is 'wave207: the charitable activities an organizational goal is anchored on (one row per goal and activity), with the short reason from the plan (free, healthy meals). Written only through strategy_activity_set() and strategy_save() (field reason) by the goal''s owners and admins; read by staff and board viewers. Taken off with archived_at, never removed; every change in goal_history (entity activity).';
comment on column public.goal_activities.reason is 'Why the goal serves that activity, in a few words, as the plan''s goal line says it.';
comment on column public.goal_activities.archived_at is 'Set when the activity was taken off the goal (Restore in the history brings it back).';

alter table public.goals add column if not exists activities_note text;
comment on column public.goals.activities_note is 'wave207: a goal''s note on the charitable activities beyond its own (It funds all eight.), as the plan says it; edited through strategy_save().';

-- ---------- this year's goals: a yearly target per goal, four quarterly checkpoints under it ----------
create table public.goal_year_targets (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.goals(id),
  fy text not null check (fy in ('FY27', 'FY28', 'FY29', 'FY30', 'FY31')),
  body text not null default '',
  owners text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz
);
create unique index goal_year_targets_one_idx on public.goal_year_targets(goal_id, fy) where archived_at is null;
create index goal_year_targets_fy_idx on public.goal_year_targets(fy, goal_id);
comment on table public.goal_year_targets is 'wave207: an organizational goal''s target for one fiscal year (This year''s goals: FY27 is the first), with the owners who report on it; its quarterly checkpoints are goal_checkpoints. Written only through strategy_save() (fields body, owners) by the goal''s owners and admins; read by staff and board viewers. One live row per goal and year; every change in goal_history (entity target).';
comment on column public.goal_year_targets.fy is 'The fiscal year (Oct 1 to Sep 30): FY27 is Oct 1, 2026 to Sep 30, 2027.';
comment on column public.goal_year_targets.body is 'The year''s target, in the plan''s words (3,000 meals, counted at 100% of services).';
comment on column public.goal_year_targets.owners is 'Who reports on the year''s target, as the plan names them (Shima, Suhaib); the goal''s editors are its goal_owners.';
comment on column public.goal_year_targets.archived_at is 'Set if the year''s target is taken off (kept for the history).';

create table public.goal_checkpoints (
  id bigint generated always as identity primary key,
  target_id bigint not null references public.goal_year_targets(id),
  goal_id bigint not null references public.goals(id),
  quarter smallint not null check (quarter between 1 and 4),
  due_date date not null,
  body text not null default '',
  status text not null default 'not started' check (status in ('not started', 'on track', 'at risk', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz,
  unique (target_id, quarter)
);
create index goal_checkpoints_goal_id_idx on public.goal_checkpoints(goal_id, due_date);
create index goal_checkpoints_due_idx on public.goal_checkpoints(due_date) where archived_at is null;
comment on table public.goal_checkpoints is 'wave207: the quarterly checkpoints of a yearly target (Q1 to Q4, due Dec 31, Mar 31, Jun 30 and Sep 30), each with its status; owners report against them at each board meeting. goal_id repeats the target''s goal for the row rules and the history. Written only through strategy_save() (fields body, status, due_date) by the goal''s owners and admins; read by staff and board viewers. Projects can serve one (projects.checkpoint_id). Every change in goal_history (entity checkpoint).';
comment on column public.goal_checkpoints.quarter is 'The fiscal quarter: 1 is Oct to Dec, 2 Jan to Mar, 3 Apr to Jun, 4 Jul to Sep.';
comment on column public.goal_checkpoints.due_date is 'When the checkpoint is due (the last day of its quarter unless the owners change it). The page flags it overdue once this day has passed and it is not done.';
comment on column public.goal_checkpoints.status is 'not started, on track, at risk or done.';

alter table public.projects add column if not exists checkpoint_id bigint references public.goal_checkpoints(id);
create index if not exists projects_checkpoint_id_idx on public.projects(checkpoint_id);
comment on column public.projects.checkpoint_id is 'wave207: the quarterly checkpoint of its goal (goal_id) this project serves, or null. Set through strategy_link_checkpoint(); cleared when the project moves to another goal.';

-- ---------- the history trigger learns the new rows ----------
create or replace function public.wa205_hist() returns trigger
language plpgsql security definer set search_path to '' as $$
declare
  v_ent text := tg_argv[0];
  v_fields text[] := string_to_array(tg_argv[1], ',');
  o jsonb; n jsonb; f text; v_goal bigint; v_who text; v_name text; v_rest bigint; v_title text;
begin
  if coalesce(current_setting('wa205.seed', true), '') = '1' then return null; end if;
  v_who := public.wa205_who(); v_name := public.wa205_name(v_who);
  v_rest := nullif(current_setting('wa205.restored_from', true), '')::bigint;
  if tg_op = 'INSERT' then n := to_jsonb(new); o := '{}'::jsonb; else n := to_jsonb(new); o := to_jsonb(old); end if;
  if v_ent = 'goal' then
    if coalesce(n->>'department', '') <> 'org' and coalesce(o->>'department', '') <> 'org' then return null; end if;
    v_goal := (n->>'id')::bigint;
  elsif v_ent = 'project_checkpoint' then
    -- wave207: a project's checkpoint link, recorded on the goal of the checkpoint it points at (or pointed at)
    if tg_op <> 'UPDATE' or (o->>'checkpoint_id') is not distinct from (n->>'checkpoint_id') then return null; end if;
    select c.goal_id into v_goal from public.goal_checkpoints c where c.id = coalesce((n->>'checkpoint_id')::bigint, (o->>'checkpoint_id')::bigint);
    if v_goal is null then return null; end if;
    insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
    values (v_goal, 'project', (n->>'id')::bigint, 'checkpoint_id',
      (select t.fy || ' Q' || c.quarter || ': ' || c.body from public.goal_checkpoints c join public.goal_year_targets t on t.id = c.target_id where c.id = (o->>'checkpoint_id')::bigint),
      (select t.fy || ' Q' || c.quarter || ': ' || c.body from public.goal_checkpoints c join public.goal_year_targets t on t.id = c.target_id where c.id = (n->>'checkpoint_id')::bigint),
      (o->>'checkpoint_id')::bigint, (n->>'checkpoint_id')::bigint, v_who, v_name, v_rest);
    return null;
  elsif v_ent = 'project' then
    if tg_op <> 'UPDATE' then return null; end if;
    v_title := n->>'name';
    if (o->>'goal_id') is distinct from (n->>'goal_id') then
      if (o->>'goal_id') is not null and exists (select 1 from public.goals g where g.id = (o->>'goal_id')::bigint and g.department = 'org') then
        insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
        values ((o->>'goal_id')::bigint, 'project', (n->>'id')::bigint, 'goal_id', v_title, null, (o->>'goal_id')::bigint, (n->>'goal_id')::bigint, v_who, v_name, v_rest);
      end if;
      if (n->>'goal_id') is not null and exists (select 1 from public.goals g where g.id = (n->>'goal_id')::bigint and g.department = 'org') then
        insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
        values ((n->>'goal_id')::bigint, 'project', (n->>'id')::bigint, 'goal_id', null, v_title, (o->>'goal_id')::bigint, (n->>'goal_id')::bigint, v_who, v_name, v_rest);
      end if;
    end if;
    if (o->>'milestone_id') is distinct from (n->>'milestone_id') and (n->>'goal_id') is not null and exists (select 1 from public.goals g where g.id = (n->>'goal_id')::bigint and g.department = 'org') then
      insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
      values ((n->>'goal_id')::bigint, 'project', (n->>'id')::bigint, 'milestone_id',
        (select m.fy || ': ' || m.body from public.goal_milestones m where m.id = (o->>'milestone_id')::bigint),
        (select m.fy || ': ' || m.body from public.goal_milestones m where m.id = (n->>'milestone_id')::bigint),
        (o->>'milestone_id')::bigint, (n->>'milestone_id')::bigint, v_who, v_name, v_rest);
    end if;
    return null;
  else
    v_goal := (n->>'goal_id')::bigint;
  end if;
  if tg_op = 'INSERT' then
    insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, changed_by, changed_by_name, restored_from)
    values (v_goal, v_ent, (n->>'id')::bigint, 'added', null,
      case when v_ent = 'owner' then (select m.name from public.team_members m where m.id = (n->>'member_id')::bigint)
           when v_ent = 'milestone' then (n->>'fy') || ': ' || (n->>'body')
           when v_ent = 'activity' then (n->>'activity_id') || '. ' || (select a.title from public.charitable_activities a where a.id = (n->>'activity_id')::smallint)
           when v_ent = 'target' then (n->>'fy') || ': ' || (n->>'body')
           when v_ent = 'checkpoint' then 'Q' || (n->>'quarter') || ': ' || (n->>'body')
           else n->>'body' end,
      v_who, v_name, v_rest);
    return null;
  end if;
  foreach f in array v_fields loop
    if (o->f) is distinct from (n->f) then
      insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, changed_by, changed_by_name, restored_from)
      values (v_goal, v_ent, (n->>'id')::bigint,
        case when v_ent = 'owner' and f = 'removed_at' then case when (n->>'removed_at') is null then 'added' else 'removed' end else f end,
        case when v_ent = 'owner' and f = 'removed_at' then (select m.name from public.team_members m where m.id = (n->>'member_id')::bigint)
             when v_ent = 'activity' and f = 'archived_at' then (n->>'activity_id') || '. ' || (select a.title from public.charitable_activities a where a.id = (n->>'activity_id')::smallint)
             else o->>f end,
        case when v_ent = 'owner' and f = 'removed_at' then (select m.name from public.team_members m where m.id = (n->>'member_id')::bigint)
             when v_ent = 'activity' and f = 'archived_at' then case when (n->>'archived_at') is null then null else (n->>'activity_id') || '. ' || (select a.title from public.charitable_activities a where a.id = (n->>'activity_id')::smallint) end
             else n->>f end,
        v_who, v_name, v_rest);
    end if;
  end loop;
  return null;
end $$;
comment on function public.wa205_hist() is 'wave205, extended in wave207: writes goal_history for every change to an organizational goal (goals), its milestones, paths, owners, charitable activities (goal_activities), yearly targets (goal_year_targets) and quarterly checkpoints (goal_checkpoints), and to a project''s goal, milestone or checkpoint link. Arguments: the entity and the fields to compare. Skipped while wa205.seed is 1 (the seed). Access: trigger only.';

create or replace trigger goals_wa205_hist after update on public.goals for each row
  execute function public.wa205_hist('goal', 'title,detail,why,measure,baseline,target_fy29,target_fy31,status,due_date,progress,approval,retired_at,activities_note');
create trigger goal_activities_wa207_hist after insert or update on public.goal_activities for each row
  execute function public.wa205_hist('activity', 'reason,archived_at');
create trigger goal_year_targets_wa207_hist after insert or update on public.goal_year_targets for each row
  execute function public.wa205_hist('target', 'body,owners,archived_at');
create trigger goal_checkpoints_wa207_hist after insert or update on public.goal_checkpoints for each row
  execute function public.wa205_hist('checkpoint', 'body,status,due_date,archived_at');
create trigger projects_wa207_hist after update of checkpoint_id on public.projects for each row
  execute function public.wa205_hist('project_checkpoint', '');

-- ---------- autosave learns the new fields ----------
create or replace function public.strategy_save(p_entity text, p_id bigint, p_field text, p_value text, p_old text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_goal bigint; v_cur text; v_who text := public.wa_email(); h record; v_val text := p_value;
begin
  if not public.is_wa_staff() then raise exception 'Sign in with a Welfare Avenue account.'; end if;
  if p_entity = 'goal' then
    if p_field not in ('title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'status', 'due_date', 'activities_note') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select g.id into v_goal from public.goals g where g.id = p_id and g.department = 'org' and g.retired_at is null;
    if v_goal is null then raise exception 'That goal is not an active organizational goal.'; end if;
    execute format('select (%I)::text from public.goals where id = $1', p_field) into v_cur using p_id;
  elsif p_entity = 'milestone' then
    if p_field not in ('body', 'status', 'fy') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select m.goal_id into v_goal from public.goal_milestones m where m.id = p_id and m.archived_at is null;
    if v_goal is null then raise exception 'That milestone is not there any more.'; end if;
    execute format('select (%I)::text from public.goal_milestones where id = $1', p_field) into v_cur using p_id;
  elsif p_entity = 'path' then
    if p_field <> 'body' then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select p.goal_id into v_goal from public.goal_paths p where p.id = p_id and p.archived_at is null;
    if v_goal is null then raise exception 'That path is not there any more.'; end if;
    select p.body into v_cur from public.goal_paths p where p.id = p_id;
  elsif p_entity = 'activity' then
    if p_field <> 'reason' then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select a.goal_id, a.reason into v_goal, v_cur from public.goal_activities a where a.id = p_id and a.archived_at is null;
    if v_goal is null then raise exception 'That activity is not on the goal any more.'; end if;
  elsif p_entity = 'target' then
    if p_field not in ('body', 'owners') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select t.goal_id into v_goal from public.goal_year_targets t where t.id = p_id and t.archived_at is null;
    if v_goal is null then raise exception 'That yearly target is not there any more.'; end if;
    execute format('select (%I)::text from public.goal_year_targets where id = $1', p_field) into v_cur using p_id;
  elsif p_entity = 'checkpoint' then
    if p_field not in ('body', 'status', 'due_date') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select c.goal_id into v_goal from public.goal_checkpoints c where c.id = p_id and c.archived_at is null;
    if v_goal is null then raise exception 'That checkpoint is not there any more.'; end if;
    execute format('select (%I)::text from public.goal_checkpoints where id = $1', p_field) into v_cur using p_id;
  else
    raise exception 'Unknown kind of item (%).', p_entity;
  end if;
  if not exists (select 1 from public.goals g where g.id = v_goal and g.department = 'org' and g.retired_at is null) then raise exception 'That goal is not an active organizational goal.'; end if;
  if not public.wa205_can_edit(v_goal) then raise exception 'Only this goal''s owners and the admins can change it.'; end if;
  -- the per-field check: someone else saved this field since the page read it
  if coalesce(v_cur, '') <> coalesce(p_old, '') then
    select x.changed_by, x.changed_by_name, x.changed_at into h from public.goal_history x
      where x.entity = p_entity and x.entity_id = p_id and x.field = p_field order by x.id desc limit 1;
    return jsonb_build_object('ok', false, 'conflict', true, 'current', v_cur, 'by', h.changed_by_name, 'by_email', h.changed_by, 'at', h.changed_at);
  end if;
  if coalesce(v_cur, '') = coalesce(v_val, '') then return jsonb_build_object('ok', true, 'value', v_cur, 'same', true); end if;
  v_val := left(coalesce(v_val, ''), 4000);
  if p_entity = 'goal' then
    if p_field = 'title' and btrim(v_val) = '' then raise exception 'A goal needs a title.'; end if;
    if p_field = 'status' and v_val not in ('not started', 'in progress', 'on track', 'at risk', 'delayed', 'done') then raise exception 'Pick a status from the list.'; end if;
    if p_field = 'due_date' then
      if v_val !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use a date like 2029-09-30.'; end if;
      update public.goals set due_date = v_val::date, updated_at = now(), updated_by = v_who where id = p_id;
    else
      execute format('update public.goals set %I = $1, updated_at = now(), updated_by = $2 where id = $3', p_field) using nullif(v_val, ''), v_who, p_id;
    end if;
  elsif p_entity = 'milestone' then
    if p_field = 'status' and v_val not in ('not started', 'in progress', 'done', 'at risk', 'carried forward') then raise exception 'Pick a status from the list.'; end if;
    if p_field = 'fy' and v_val not in ('FY27', 'FY28', 'FY29', 'FY30', 'FY31') then raise exception 'Pick a fiscal year from FY27 to FY31.'; end if;
    execute format('update public.goal_milestones set %I = $1, updated_at = now(), updated_by = $2 where id = $3', p_field) using v_val, v_who, p_id;
  elsif p_entity = 'path' then
    update public.goal_paths set body = v_val, updated_at = now(), updated_by = v_who where id = p_id;
  elsif p_entity = 'activity' then
    update public.goal_activities set reason = nullif(btrim(v_val), ''), updated_at = now(), updated_by = v_who where id = p_id;
  elsif p_entity = 'target' then
    if p_field = 'body' then update public.goal_year_targets set body = v_val, updated_at = now(), updated_by = v_who where id = p_id;
    else update public.goal_year_targets set owners = nullif(btrim(v_val), ''), updated_at = now(), updated_by = v_who where id = p_id; end if;
  else
    if p_field = 'status' and v_val not in ('not started', 'on track', 'at risk', 'done') then raise exception 'Pick a status from the list.'; end if;
    if p_field = 'due_date' then
      if v_val !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use a date like 2027-03-31.'; end if;
      update public.goal_checkpoints set due_date = v_val::date, updated_at = now(), updated_by = v_who where id = p_id;
    else
      execute format('update public.goal_checkpoints set %I = $1, updated_at = now(), updated_by = $2 where id = $3', p_field) using v_val, v_who, p_id;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'value', v_val, 'at', now());
end $$;
comment on function public.strategy_save(text, bigint, text, text, text) is 'wave205, extended in wave207: autosave of one field of an organizational goal (title, detail = SMART, why, measure, baseline, target_fy29, target_fy31, status, due_date, activities_note), a milestone (body, status, fy), a path (body), a charitable activity on the goal (reason), a yearly target (body, owners) or a quarterly checkpoint (body, status, due_date). p_old is the value the page started from: when the stored value differs, nothing is saved and the answer is {conflict, current, by, at}. Checks inside: staff, an active org goal, its owners or an admin, the field list. Access: authenticated.';

-- ---------- add or take off a charitable activity ----------
create or replace function public.strategy_activity_set(p_goal bigint, p_activity smallint, p_on boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_sort int; v_id bigint;
begin
  if not exists (select 1 from public.goals g where g.id = p_goal and g.department = 'org' and g.retired_at is null) then raise exception 'That goal is not an active organizational goal.'; end if;
  if not public.wa205_can_edit(p_goal) then raise exception 'Only this goal''s owners and the admins can change it.'; end if;
  if not exists (select 1 from public.charitable_activities a where a.id = p_activity) then raise exception 'Pick one of the eight charitable activities.'; end if;
  if p_on then
    select coalesce(max(sort), 0) + 1 into v_sort from public.goal_activities where goal_id = p_goal;
    insert into public.goal_activities (goal_id, activity_id, reason, sort, updated_by)
    values (p_goal, p_activity, nullif(btrim(coalesce(p_reason, '')), ''), v_sort, public.wa_email())
    on conflict (goal_id, activity_id) do update set archived_at = null, updated_at = now(), updated_by = public.wa_email(),
      reason = case when p_reason is null then public.goal_activities.reason else nullif(btrim(p_reason), '') end
    returning id into v_id;
  else
    update public.goal_activities set archived_at = now(), updated_at = now(), updated_by = public.wa_email()
      where goal_id = p_goal and activity_id = p_activity and archived_at is null returning id into v_id;
  end if;
  return (select to_jsonb(a) from public.goal_activities a where a.id = v_id);
end $$;
comment on function public.strategy_activity_set(bigint, smallint, boolean, text) is 'wave207: anchors an organizational goal on one of the charitable activities (p_on true, with an optional short reason) or takes it off (p_on false; the row is kept with archived_at). Recorded in goal_history by the trigger. Checks inside: the goal''s owners or an admin. Returns the row. Access: authenticated.';

-- ---------- a project can serve a checkpoint as well as a goal ----------
create or replace function public.strategy_link_checkpoint(p_project bigint, p_checkpoint bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_goal bigint;
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff link projects.'; end if;
  if not exists (select 1 from public.projects p where p.id = p_project and p.banked_at is null) then raise exception 'That project is not there.'; end if;
  if p_checkpoint is null then
    update public.projects set checkpoint_id = null, updated_at = now() where id = p_project;
    return jsonb_build_object('ok', true);
  end if;
  select c.goal_id into v_goal from public.goal_checkpoints c join public.goals g on g.id = c.goal_id
    where c.id = p_checkpoint and c.archived_at is null and g.department = 'org' and g.retired_at is null;
  if v_goal is null then raise exception 'Link projects to a checkpoint of an active organizational goal.'; end if;
  update public.projects set
      milestone_id = case when goal_id is distinct from v_goal then null else milestone_id end,
      goal_id = v_goal, checkpoint_id = p_checkpoint, updated_at = now()
    where id = p_project;
  return jsonb_build_object('ok', true, 'goal_id', v_goal);
end $$;
comment on function public.strategy_link_checkpoint(bigint, bigint) is 'wave207: links a department''s project to one quarterly checkpoint of an organizational goal (the project then serves that goal too; a milestone of another goal is cleared), or clears the checkpoint (p_checkpoint null). Staff who may comment, as for strategy_link_project; board viewers cannot. Recorded in goal_history by the trigger. Access: authenticated.';

create or replace function public.strategy_link_project(p_project bigint, p_goal bigint, p_milestone bigint default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff link projects.'; end if;
  if not exists (select 1 from public.projects p where p.id = p_project and p.banked_at is null) then raise exception 'That project is not there.'; end if;
  if p_goal is not null and not exists (select 1 from public.goals g where g.id = p_goal and g.department = 'org' and g.retired_at is null) then raise exception 'Link projects to one of the active organizational goals.'; end if;
  if p_milestone is not null and not exists (select 1 from public.goal_milestones m where m.id = p_milestone and m.goal_id = p_goal and m.archived_at is null) then raise exception 'That milestone belongs to another goal.'; end if;
  update public.projects set goal_id = p_goal, milestone_id = case when p_goal is null then null else p_milestone end,
      checkpoint_id = case when p_goal is null then null
                           when checkpoint_id is not null and exists (select 1 from public.goal_checkpoints c where c.id = checkpoint_id and c.goal_id = p_goal) then checkpoint_id
                           else null end,
      updated_at = now()
    where id = p_project;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.strategy_link_project(bigint, bigint, bigint) is 'wave205, extended in wave207: links a department''s project to an organizational goal and, optionally, one of its milestones (p_goal null unlinks); a checkpoint of another goal is cleared. Departments own projects, so any staff account that may comment links them; board viewers cannot. Recorded in goal_history by the trigger. Access: authenticated.';

-- ---------- Restore learns the new rows ----------
create or replace function public.strategy_restore(p_history bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare h record; v_cur text; r jsonb;
begin
  select * into h from public.goal_history where id = p_history;
  if h.id is null then raise exception 'That change is not in the history.'; end if;
  perform set_config('wa205.restored_from', h.id::text, true);
  if h.entity = 'project' then
    if not public.wa205_can_comment() then raise exception 'Board viewers read the goals.'; end if;
    if h.field = 'goal_id' then
      update public.projects set goal_id = h.old_ref, milestone_id = case when h.old_ref is distinct from goal_id then null else milestone_id end,
        checkpoint_id = case when h.old_ref is distinct from goal_id then null else checkpoint_id end, updated_at = now() where id = h.entity_id;
    elsif h.field = 'milestone_id' then
      update public.projects set milestone_id = h.old_ref, updated_at = now() where id = h.entity_id;
    elsif h.field = 'checkpoint_id' then
      update public.projects set checkpoint_id = h.old_ref, updated_at = now() where id = h.entity_id;
    end if;
    r := jsonb_build_object('ok', true);
  elsif not public.wa205_can_edit(h.goal_id) then
    raise exception 'Only this goal''s owners and the admins can restore its changes.';
  elsif h.entity = 'owner' then
    if h.field = 'added' then update public.goal_owners set removed_at = now(), is_lead = false where id = h.entity_id;
    elsif h.field = 'removed' then update public.goal_owners set removed_at = null where id = h.entity_id;
    elsif h.field = 'is_lead' then update public.goal_owners set is_lead = coalesce(h.old_value::boolean, false) where id = h.entity_id;
    elsif h.field = 'focus' then update public.goal_owners set focus = h.old_value where id = h.entity_id;
    end if;
    r := jsonb_build_object('ok', true);
  elsif h.field = 'added' then
    if h.entity = 'milestone' then update public.goal_milestones set archived_at = now(), updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'path' then update public.goal_paths set archived_at = now(), updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'activity' then update public.goal_activities set archived_at = now(), updated_at = now(), updated_by = public.wa_email() where id = h.entity_id; end if;
    r := jsonb_build_object('ok', true);
  elsif h.field = 'archived_at' then
    if h.entity = 'milestone' then update public.goal_milestones set archived_at = case when h.new_value is null then now() else null end, updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'path' then update public.goal_paths set archived_at = case when h.new_value is null then now() else null end, updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'activity' then update public.goal_activities set archived_at = case when h.new_value is null then now() else null end, updated_at = now(), updated_by = public.wa_email() where id = h.entity_id; end if;
    r := jsonb_build_object('ok', true);
  elsif (h.entity in ('goal', 'milestone', 'path') and h.field in ('title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'status', 'due_date', 'body', 'fy', 'activities_note'))
     or (h.entity = 'activity' and h.field = 'reason') or (h.entity = 'target' and h.field in ('body', 'owners')) or (h.entity = 'checkpoint' and h.field in ('body', 'status', 'due_date')) then
    if h.entity = 'goal' then execute format('select (%I)::text from public.goals where id = $1', h.field) into v_cur using h.entity_id;
    elsif h.entity = 'milestone' then execute format('select (%I)::text from public.goal_milestones where id = $1', h.field) into v_cur using h.entity_id;
    elsif h.entity = 'activity' then select reason into v_cur from public.goal_activities where id = h.entity_id;
    elsif h.entity = 'target' then execute format('select (%I)::text from public.goal_year_targets where id = $1', h.field) into v_cur using h.entity_id;
    elsif h.entity = 'checkpoint' then execute format('select (%I)::text from public.goal_checkpoints where id = $1', h.field) into v_cur using h.entity_id;
    else select body into v_cur from public.goal_paths where id = h.entity_id; end if;
    r := public.strategy_save(h.entity, h.entity_id, h.field, coalesce(h.old_value, ''), v_cur);
  else
    raise exception 'That change cannot be restored here (%).', h.field;
  end if;
  perform set_config('wa205.restored_from', '', true);
  return r;
end $$;
comment on function public.strategy_restore(bigint) is 'wave205, extended in wave207: Restore in a goal''s history puts back the old value of that change (a field, a milestone, path or charitable activity added or taken off, an owner added or removed, a yearly target or checkpoint field, a project''s goal, milestone or checkpoint link). The restore is itself a change in the history (restored_from). Checks inside: the goal''s owners or an admin; project links by staff who may comment. Access: authenticated.';

-- ---------- row security: staff and board viewers read; the functions write ----------
alter table public.charitable_activities enable row level security;
alter table public.goal_activities enable row level security;
alter table public.goal_year_targets enable row level security;
alter table public.goal_checkpoints enable row level security;
create policy charitable_activities_read on public.charitable_activities for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
create policy goal_activities_read on public.goal_activities for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
create policy goal_year_targets_read on public.goal_year_targets for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
create policy goal_checkpoints_read on public.goal_checkpoints for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
comment on policy charitable_activities_read on public.charitable_activities is 'wave207: staff and board viewers read the charitable activities.';
comment on policy goal_activities_read on public.goal_activities is 'wave207: staff and board viewers read which activities each goal serves; writes go through strategy_activity_set and strategy_save.';
comment on policy goal_year_targets_read on public.goal_year_targets is 'wave207: staff and board viewers read the yearly targets; writes go through strategy_save.';
comment on policy goal_checkpoints_read on public.goal_checkpoints is 'wave207: staff and board viewers read the quarterly checkpoints; writes go through strategy_save.';
revoke all on public.charitable_activities, public.goal_activities, public.goal_year_targets, public.goal_checkpoints from anon, authenticated;
grant select on public.charitable_activities, public.goal_activities, public.goal_year_targets, public.goal_checkpoints to authenticated;

revoke all on function public.strategy_activity_set(bigint, smallint, boolean, text), public.strategy_link_checkpoint(bigint, bigint) from public, anon;
grant execute on function public.strategy_activity_set(bigint, smallint, boolean, text), public.strategy_link_checkpoint(bigint, bigint) to authenticated;
revoke all on function public.wa205_hist() from public, anon, authenticated;

-- ---------- live ----------
alter publication supabase_realtime add table public.goal_activities, public.goal_year_targets, public.goal_checkpoints;

-- ---------- the content, in the plan's words (the seed writes no history) ----------
select set_config('wa205.seed', '1', true);
insert into public.charitable_activities (id, title, sort, source) values
  (1, 'Build relationships with organizations, businesses and schools', 1, 'CRA registration (July 2026 board deck)'),
  (2, 'Relieve poverty by providing basic necessities', 2, 'CRA registration (July 2026 board deck)'),
  (3, 'Address food insecurity with free, healthy meals', 3, 'CRA registration (July 2026 board deck)'),
  (4, 'Reduce isolation by building community around the meal', 4, 'CRA registration (July 2026 board deck)'),
  (5, 'Increase access to resources through referrals', 5, 'CRA registration (July 2026 board deck)'),
  (6, 'Mobilize youth and volunteers', 6, 'CRA registration (July 2026 board deck)'),
  (7, 'Collaborate with other non-profits', 7, 'CRA registration (July 2026 board deck)'),
  (8, 'Be a voice for the people we serve', 8, 'CRA registration (July 2026 board deck)');

insert into public.goal_activities (goal_id, activity_id, reason, sort, updated_by)
select g.id, x.a, x.reason, x.s, 'wave207 migration'
from (values
  (1, 3::smallint, 'free, healthy meals', 1), (1, 4::smallint, 'community around the meal', 2), (1, 7::smallint, 'collaborating with DESTA, TYFPC and shelters', 3),
  (2, 2::smallint, 'basic necessities', 1), (2, 5::smallint, 'referrals, including housing organizations', 2), (2, 8::smallint, 'a voice for the people we serve, through feedback', 3),
  (3, 6::smallint, 'mobilizing youth and volunteers', 1), (3, 1::smallint, 'relationships with schools and universities', 2),
  (4, 1::smallint, 'relationships with businesses and sponsors', 1), (4, 7::smallint, 'joint grant applications with other non-profits', 2),
  (5, 6::smallint, 'youth leadership that lasts beyond one school year', 1)
) as x(num, a, reason, s)
join public.goals g on g.department = 'org' and g.retired_at is null and g.number = x.num;

update public.goals g set activities_note = x.note
from (values (4, 'It funds all eight.'), (5, 'It keeps all eight running.')) as x(num, note)
where g.department = 'org' and g.retired_at is null and g.number = x.num;

insert into public.goal_year_targets (goal_id, fy, body, owners, sort, updated_by)
select g.id, 'FY27', x.body, x.owners, x.num, 'wave207 migration'
from (values
  (1, '3,000 meals, counted at 100% of services', 'Shima, Suhaib'),
  (2, 'Hygiene kits at 50% of services; first feedback round', 'Shima'),
  (3, '20% of volunteers return; 110 volunteers; half of applicants serve', 'Ian, Suhaib'),
  (4, '$25,000 revenue; 25 monthly donors; first grant; 2 paid summer roles', 'Suhaib, Ian'),
  (5, 'Executive transition done; HR seat filled; Keela retired; every role written', 'Suhaib, Ian, Shima')
) as x(num, body, owners)
join public.goals g on g.department = 'org' and g.retired_at is null and g.number = x.num;

insert into public.goal_checkpoints (target_id, goal_id, quarter, due_date, body, updated_by)
select t.id, t.goal_id, x.q, x.due::date, x.body, 'wave207 migration'
from (values
  (1, 1, '2026-12-31', 'Meal counts logged at every service'),
  (1, 2, '2027-03-31', '1,500 meals; TMU Cook & Share with TYFPC (Jan)'),
  (1, 3, '2027-06-30', '2,250 meals'),
  (1, 4, '2027-09-30', '3,000 meals'),
  (2, 1, '2026-12-31', 'Kit source confirmed with a partner'),
  (2, 2, '2027-03-31', 'First referral partner invited (housing a priority)'),
  (2, 3, '2027-06-30', 'First feedback round complete'),
  (2, 4, '2027-09-30', 'Kits at 50% of services'),
  (3, 1, '2026-12-31', '7-day follow-up for every first-time volunteer'),
  (3, 2, '2027-03-31', 'Recognition budget decided'),
  (3, 3, '2027-06-30', 'Applicant-to-served rate at 50%'),
  (3, 4, '2027-09-30', '110 volunteers; 20% return'),
  (4, 1, '2026-12-31', 'FY27 budget approved; donor program launched; Canada Summer Jobs applied (if the window opens)'),
  (4, 2, '2027-03-31', 'Ad Grant live; 10 monthly donors; every flagship event has a lead'),
  (4, 3, '2027-06-30', '2 summer roles start; first grant awarded'),
  (4, 4, '2027-09-30', '$25,000; 25 monthly donors'),
  (5, 1, '2026-12-31', 'Goals approved (Oct 19); Keela notice by Dec 5'),
  (5, 2, '2027-03-31', 'Executive transition complete; HR seat filled'),
  (5, 3, '2027-06-30', 'Every leadership role written, with hours'),
  (5, 4, '2027-09-30', 'First yearly handover cycle run')
) as x(num, q, due, body)
join public.goals g on g.department = 'org' and g.retired_at is null and g.number = x.num
join public.goal_year_targets t on t.goal_id = g.id and t.fy = 'FY27' and t.archived_at is null;

insert into public.strategy_plan (key, value, updated_by) values
  ('activities', jsonb_build_object(
     'title', 'Anchored in our 8 charitable activities',
     'intro', 'Every goal serves at least one of the eight activities registered with the CRA (July 2026 board deck). All eight are covered.'), 'wave207 migration'),
  ('year_fy27', jsonb_build_object(
     'fy', 'FY27',
     'title', 'This year''s goals: FY27 (Oct 1, 2026 to Sep 30, 2027)',
     'intro', 'Five goals for this year, each the first step on its 3-year goal. Owners report against the quarterly checkpoints at each board meeting.',
     'note', 'The FY27 budget, the Keela notice date (by Dec 5 to beat the Dec 19 renewal) and the Canada Summer Jobs window are fixed by outside dates; the rest are our proposals for the board.'), 'wave207 migration')
on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
select set_config('wa205.seed', '', true);

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('strategy', 'org_goals', 'wave207', null, 'charitable activities (8, 11 goal links) and FY27 targets (5) with quarterly checkpoints (20), from the 29/09/26 draft', 'wave207 migration');

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261004213000', 'wa207_activities_fy27', array[$m$create table public.charitable_activities (
  id smallint primary key check (id between 1 and 20),
  title text not null,
  sort smallint not null default 0,
  source text,
  created_at timestamptz not null default now()
)$m$,$m$comment on table public.charitable_activities is 'wave207: Welfare Avenue''s charitable activities as registered with the CRA (the July 2026 board deck), numbered 1 to 8 with their wording. A reference: written by migrations only (the wording is what the CRA holds, so it is not edited on the page). Read by staff and board viewers. Goals are anchored on them through goal_activities.'$m$,$m$comment on column public.charitable_activities.id is 'The activity''s number as the plan uses it (1 to 8).'$m$,$m$comment on column public.charitable_activities.title is 'The activity''s wording, exactly as the plan states it.'$m$,$m$comment on column public.charitable_activities.source is 'Where the wording comes from.'$m$,$m$create table public.goal_activities (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.goals(id),
  activity_id smallint not null references public.charitable_activities(id),
  reason text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz,
  unique (goal_id, activity_id)
)$m$,$m$create index goal_activities_goal_id_idx on public.goal_activities(goal_id, sort)$m$,$m$create index goal_activities_activity_id_idx on public.goal_activities(activity_id)$m$,$m$comment on table public.goal_activities is 'wave207: the charitable activities an organizational goal is anchored on (one row per goal and activity), with the short reason from the plan (free, healthy meals). Written only through strategy_activity_set() and strategy_save() (field reason) by the goal''s owners and admins; read by staff and board viewers. Taken off with archived_at, never removed; every change in goal_history (entity activity).'$m$,$m$comment on column public.goal_activities.reason is 'Why the goal serves that activity, in a few words, as the plan''s goal line says it.'$m$,$m$comment on column public.goal_activities.archived_at is 'Set when the activity was taken off the goal (Restore in the history brings it back).'$m$,$m$alter table public.goals add column if not exists activities_note text$m$,$m$comment on column public.goals.activities_note is 'wave207: a goal''s note on the charitable activities beyond its own (It funds all eight.), as the plan says it; edited through strategy_save().'$m$,$m$create table public.goal_year_targets (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.goals(id),
  fy text not null check (fy in ('FY27', 'FY28', 'FY29', 'FY30', 'FY31')),
  body text not null default '',
  owners text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz
)$m$,$m$create unique index goal_year_targets_one_idx on public.goal_year_targets(goal_id, fy) where archived_at is null$m$,$m$create index goal_year_targets_fy_idx on public.goal_year_targets(fy, goal_id)$m$,$m$comment on table public.goal_year_targets is 'wave207: an organizational goal''s target for one fiscal year (This year''s goals: FY27 is the first), with the owners who report on it; its quarterly checkpoints are goal_checkpoints. Written only through strategy_save() (fields body, owners) by the goal''s owners and admins; read by staff and board viewers. One live row per goal and year; every change in goal_history (entity target).'$m$,$m$comment on column public.goal_year_targets.fy is 'The fiscal year (Oct 1 to Sep 30): FY27 is Oct 1, 2026 to Sep 30, 2027.'$m$,$m$comment on column public.goal_year_targets.body is 'The year''s target, in the plan''s words (3,000 meals, counted at 100% of services).'$m$,$m$comment on column public.goal_year_targets.owners is 'Who reports on the year''s target, as the plan names them (Shima, Suhaib); the goal''s editors are its goal_owners.'$m$,$m$comment on column public.goal_year_targets.archived_at is 'Set if the year''s target is taken off (kept for the history).'$m$,$m$create table public.goal_checkpoints (
  id bigint generated always as identity primary key,
  target_id bigint not null references public.goal_year_targets(id),
  goal_id bigint not null references public.goals(id),
  quarter smallint not null check (quarter between 1 and 4),
  due_date date not null,
  body text not null default '',
  status text not null default 'not started' check (status in ('not started', 'on track', 'at risk', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz,
  unique (target_id, quarter)
)$m$,$m$create index goal_checkpoints_goal_id_idx on public.goal_checkpoints(goal_id, due_date)$m$,$m$create index goal_checkpoints_due_idx on public.goal_checkpoints(due_date) where archived_at is null$m$,$m$comment on table public.goal_checkpoints is 'wave207: the quarterly checkpoints of a yearly target (Q1 to Q4, due Dec 31, Mar 31, Jun 30 and Sep 30), each with its status; owners report against them at each board meeting. goal_id repeats the target''s goal for the row rules and the history. Written only through strategy_save() (fields body, status, due_date) by the goal''s owners and admins; read by staff and board viewers. Projects can serve one (projects.checkpoint_id). Every change in goal_history (entity checkpoint).'$m$,$m$comment on column public.goal_checkpoints.quarter is 'The fiscal quarter: 1 is Oct to Dec, 2 Jan to Mar, 3 Apr to Jun, 4 Jul to Sep.'$m$,$m$comment on column public.goal_checkpoints.due_date is 'When the checkpoint is due (the last day of its quarter unless the owners change it). The page flags it overdue once this day has passed and it is not done.'$m$,$m$comment on column public.goal_checkpoints.status is 'not started, on track, at risk or done.'$m$,$m$alter table public.projects add column if not exists checkpoint_id bigint references public.goal_checkpoints(id)$m$,$m$create index if not exists projects_checkpoint_id_idx on public.projects(checkpoint_id)$m$,$m$comment on column public.projects.checkpoint_id is 'wave207: the quarterly checkpoint of its goal (goal_id) this project serves, or null. Set through strategy_link_checkpoint(); cleared when the project moves to another goal.'$m$,$m$create or replace function public.wa205_hist() returns trigger
language plpgsql security definer set search_path to '' as $$
declare
  v_ent text := tg_argv[0];
  v_fields text[] := string_to_array(tg_argv[1], ',');
  o jsonb; n jsonb; f text; v_goal bigint; v_who text; v_name text; v_rest bigint; v_title text;
begin
  if coalesce(current_setting('wa205.seed', true), '') = '1' then return null; end if;
  v_who := public.wa205_who(); v_name := public.wa205_name(v_who);
  v_rest := nullif(current_setting('wa205.restored_from', true), '')::bigint;
  if tg_op = 'INSERT' then n := to_jsonb(new); o := '{}'::jsonb; else n := to_jsonb(new); o := to_jsonb(old); end if;
  if v_ent = 'goal' then
    if coalesce(n->>'department', '') <> 'org' and coalesce(o->>'department', '') <> 'org' then return null; end if;
    v_goal := (n->>'id')::bigint;
  elsif v_ent = 'project_checkpoint' then
    -- wave207: a project's checkpoint link, recorded on the goal of the checkpoint it points at (or pointed at)
    if tg_op <> 'UPDATE' or (o->>'checkpoint_id') is not distinct from (n->>'checkpoint_id') then return null; end if;
    select c.goal_id into v_goal from public.goal_checkpoints c where c.id = coalesce((n->>'checkpoint_id')::bigint, (o->>'checkpoint_id')::bigint);
    if v_goal is null then return null; end if;
    insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
    values (v_goal, 'project', (n->>'id')::bigint, 'checkpoint_id',
      (select t.fy || ' Q' || c.quarter || ': ' || c.body from public.goal_checkpoints c join public.goal_year_targets t on t.id = c.target_id where c.id = (o->>'checkpoint_id')::bigint),
      (select t.fy || ' Q' || c.quarter || ': ' || c.body from public.goal_checkpoints c join public.goal_year_targets t on t.id = c.target_id where c.id = (n->>'checkpoint_id')::bigint),
      (o->>'checkpoint_id')::bigint, (n->>'checkpoint_id')::bigint, v_who, v_name, v_rest);
    return null;
  elsif v_ent = 'project' then
    if tg_op <> 'UPDATE' then return null; end if;
    v_title := n->>'name';
    if (o->>'goal_id') is distinct from (n->>'goal_id') then
      if (o->>'goal_id') is not null and exists (select 1 from public.goals g where g.id = (o->>'goal_id')::bigint and g.department = 'org') then
        insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
        values ((o->>'goal_id')::bigint, 'project', (n->>'id')::bigint, 'goal_id', v_title, null, (o->>'goal_id')::bigint, (n->>'goal_id')::bigint, v_who, v_name, v_rest);
      end if;
      if (n->>'goal_id') is not null and exists (select 1 from public.goals g where g.id = (n->>'goal_id')::bigint and g.department = 'org') then
        insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
        values ((n->>'goal_id')::bigint, 'project', (n->>'id')::bigint, 'goal_id', null, v_title, (o->>'goal_id')::bigint, (n->>'goal_id')::bigint, v_who, v_name, v_rest);
      end if;
    end if;
    if (o->>'milestone_id') is distinct from (n->>'milestone_id') and (n->>'goal_id') is not null and exists (select 1 from public.goals g where g.id = (n->>'goal_id')::bigint and g.department = 'org') then
      insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, old_ref, new_ref, changed_by, changed_by_name, restored_from)
      values ((n->>'goal_id')::bigint, 'project', (n->>'id')::bigint, 'milestone_id',
        (select m.fy || ': ' || m.body from public.goal_milestones m where m.id = (o->>'milestone_id')::bigint),
        (select m.fy || ': ' || m.body from public.goal_milestones m where m.id = (n->>'milestone_id')::bigint),
        (o->>'milestone_id')::bigint, (n->>'milestone_id')::bigint, v_who, v_name, v_rest);
    end if;
    return null;
  else
    v_goal := (n->>'goal_id')::bigint;
  end if;
  if tg_op = 'INSERT' then
    insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, changed_by, changed_by_name, restored_from)
    values (v_goal, v_ent, (n->>'id')::bigint, 'added', null,
      case when v_ent = 'owner' then (select m.name from public.team_members m where m.id = (n->>'member_id')::bigint)
           when v_ent = 'milestone' then (n->>'fy') || ': ' || (n->>'body')
           when v_ent = 'activity' then (n->>'activity_id') || '. ' || (select a.title from public.charitable_activities a where a.id = (n->>'activity_id')::smallint)
           when v_ent = 'target' then (n->>'fy') || ': ' || (n->>'body')
           when v_ent = 'checkpoint' then 'Q' || (n->>'quarter') || ': ' || (n->>'body')
           else n->>'body' end,
      v_who, v_name, v_rest);
    return null;
  end if;
  foreach f in array v_fields loop
    if (o->f) is distinct from (n->f) then
      insert into public.goal_history (goal_id, entity, entity_id, field, old_value, new_value, changed_by, changed_by_name, restored_from)
      values (v_goal, v_ent, (n->>'id')::bigint,
        case when v_ent = 'owner' and f = 'removed_at' then case when (n->>'removed_at') is null then 'added' else 'removed' end else f end,
        case when v_ent = 'owner' and f = 'removed_at' then (select m.name from public.team_members m where m.id = (n->>'member_id')::bigint)
             when v_ent = 'activity' and f = 'archived_at' then (n->>'activity_id') || '. ' || (select a.title from public.charitable_activities a where a.id = (n->>'activity_id')::smallint)
             else o->>f end,
        case when v_ent = 'owner' and f = 'removed_at' then (select m.name from public.team_members m where m.id = (n->>'member_id')::bigint)
             when v_ent = 'activity' and f = 'archived_at' then case when (n->>'archived_at') is null then null else (n->>'activity_id') || '. ' || (select a.title from public.charitable_activities a where a.id = (n->>'activity_id')::smallint) end
             else n->>f end,
        v_who, v_name, v_rest);
    end if;
  end loop;
  return null;
end $$$m$,$m$comment on function public.wa205_hist() is 'wave205, extended in wave207: writes goal_history for every change to an organizational goal (goals), its milestones, paths, owners, charitable activities (goal_activities), yearly targets (goal_year_targets) and quarterly checkpoints (goal_checkpoints), and to a project''s goal, milestone or checkpoint link. Arguments: the entity and the fields to compare. Skipped while wa205.seed is 1 (the seed). Access: trigger only.'$m$,$m$create or replace trigger goals_wa205_hist after update on public.goals for each row
  execute function public.wa205_hist('goal', 'title,detail,why,measure,baseline,target_fy29,target_fy31,status,due_date,progress,approval,retired_at,activities_note')$m$,$m$create trigger goal_activities_wa207_hist after insert or update on public.goal_activities for each row
  execute function public.wa205_hist('activity', 'reason,archived_at')$m$,$m$create trigger goal_year_targets_wa207_hist after insert or update on public.goal_year_targets for each row
  execute function public.wa205_hist('target', 'body,owners,archived_at')$m$,$m$create trigger goal_checkpoints_wa207_hist after insert or update on public.goal_checkpoints for each row
  execute function public.wa205_hist('checkpoint', 'body,status,due_date,archived_at')$m$,$m$create trigger projects_wa207_hist after update of checkpoint_id on public.projects for each row
  execute function public.wa205_hist('project_checkpoint', '')$m$,$m$create or replace function public.strategy_save(p_entity text, p_id bigint, p_field text, p_value text, p_old text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_goal bigint; v_cur text; v_who text := public.wa_email(); h record; v_val text := p_value;
begin
  if not public.is_wa_staff() then raise exception 'Sign in with a Welfare Avenue account.'; end if;
  if p_entity = 'goal' then
    if p_field not in ('title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'status', 'due_date', 'activities_note') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select g.id into v_goal from public.goals g where g.id = p_id and g.department = 'org' and g.retired_at is null;
    if v_goal is null then raise exception 'That goal is not an active organizational goal.'; end if;
    execute format('select (%I)::text from public.goals where id = $1', p_field) into v_cur using p_id;
  elsif p_entity = 'milestone' then
    if p_field not in ('body', 'status', 'fy') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select m.goal_id into v_goal from public.goal_milestones m where m.id = p_id and m.archived_at is null;
    if v_goal is null then raise exception 'That milestone is not there any more.'; end if;
    execute format('select (%I)::text from public.goal_milestones where id = $1', p_field) into v_cur using p_id;
  elsif p_entity = 'path' then
    if p_field <> 'body' then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select p.goal_id into v_goal from public.goal_paths p where p.id = p_id and p.archived_at is null;
    if v_goal is null then raise exception 'That path is not there any more.'; end if;
    select p.body into v_cur from public.goal_paths p where p.id = p_id;
  elsif p_entity = 'activity' then
    if p_field <> 'reason' then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select a.goal_id, a.reason into v_goal, v_cur from public.goal_activities a where a.id = p_id and a.archived_at is null;
    if v_goal is null then raise exception 'That activity is not on the goal any more.'; end if;
  elsif p_entity = 'target' then
    if p_field not in ('body', 'owners') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select t.goal_id into v_goal from public.goal_year_targets t where t.id = p_id and t.archived_at is null;
    if v_goal is null then raise exception 'That yearly target is not there any more.'; end if;
    execute format('select (%I)::text from public.goal_year_targets where id = $1', p_field) into v_cur using p_id;
  elsif p_entity = 'checkpoint' then
    if p_field not in ('body', 'status', 'due_date') then raise exception 'That field cannot be changed here (%).', p_field; end if;
    select c.goal_id into v_goal from public.goal_checkpoints c where c.id = p_id and c.archived_at is null;
    if v_goal is null then raise exception 'That checkpoint is not there any more.'; end if;
    execute format('select (%I)::text from public.goal_checkpoints where id = $1', p_field) into v_cur using p_id;
  else
    raise exception 'Unknown kind of item (%).', p_entity;
  end if;
  if not exists (select 1 from public.goals g where g.id = v_goal and g.department = 'org' and g.retired_at is null) then raise exception 'That goal is not an active organizational goal.'; end if;
  if not public.wa205_can_edit(v_goal) then raise exception 'Only this goal''s owners and the admins can change it.'; end if;
  -- the per-field check: someone else saved this field since the page read it
  if coalesce(v_cur, '') <> coalesce(p_old, '') then
    select x.changed_by, x.changed_by_name, x.changed_at into h from public.goal_history x
      where x.entity = p_entity and x.entity_id = p_id and x.field = p_field order by x.id desc limit 1;
    return jsonb_build_object('ok', false, 'conflict', true, 'current', v_cur, 'by', h.changed_by_name, 'by_email', h.changed_by, 'at', h.changed_at);
  end if;
  if coalesce(v_cur, '') = coalesce(v_val, '') then return jsonb_build_object('ok', true, 'value', v_cur, 'same', true); end if;
  v_val := left(coalesce(v_val, ''), 4000);
  if p_entity = 'goal' then
    if p_field = 'title' and btrim(v_val) = '' then raise exception 'A goal needs a title.'; end if;
    if p_field = 'status' and v_val not in ('not started', 'in progress', 'on track', 'at risk', 'delayed', 'done') then raise exception 'Pick a status from the list.'; end if;
    if p_field = 'due_date' then
      if v_val !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use a date like 2029-09-30.'; end if;
      update public.goals set due_date = v_val::date, updated_at = now(), updated_by = v_who where id = p_id;
    else
      execute format('update public.goals set %I = $1, updated_at = now(), updated_by = $2 where id = $3', p_field) using nullif(v_val, ''), v_who, p_id;
    end if;
  elsif p_entity = 'milestone' then
    if p_field = 'status' and v_val not in ('not started', 'in progress', 'done', 'at risk', 'carried forward') then raise exception 'Pick a status from the list.'; end if;
    if p_field = 'fy' and v_val not in ('FY27', 'FY28', 'FY29', 'FY30', 'FY31') then raise exception 'Pick a fiscal year from FY27 to FY31.'; end if;
    execute format('update public.goal_milestones set %I = $1, updated_at = now(), updated_by = $2 where id = $3', p_field) using v_val, v_who, p_id;
  elsif p_entity = 'path' then
    update public.goal_paths set body = v_val, updated_at = now(), updated_by = v_who where id = p_id;
  elsif p_entity = 'activity' then
    update public.goal_activities set reason = nullif(btrim(v_val), ''), updated_at = now(), updated_by = v_who where id = p_id;
  elsif p_entity = 'target' then
    if p_field = 'body' then update public.goal_year_targets set body = v_val, updated_at = now(), updated_by = v_who where id = p_id;
    else update public.goal_year_targets set owners = nullif(btrim(v_val), ''), updated_at = now(), updated_by = v_who where id = p_id; end if;
  else
    if p_field = 'status' and v_val not in ('not started', 'on track', 'at risk', 'done') then raise exception 'Pick a status from the list.'; end if;
    if p_field = 'due_date' then
      if v_val !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use a date like 2027-03-31.'; end if;
      update public.goal_checkpoints set due_date = v_val::date, updated_at = now(), updated_by = v_who where id = p_id;
    else
      execute format('update public.goal_checkpoints set %I = $1, updated_at = now(), updated_by = $2 where id = $3', p_field) using v_val, v_who, p_id;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'value', v_val, 'at', now());
end $$$m$,$m$comment on function public.strategy_save(text, bigint, text, text, text) is 'wave205, extended in wave207: autosave of one field of an organizational goal (title, detail = SMART, why, measure, baseline, target_fy29, target_fy31, status, due_date, activities_note), a milestone (body, status, fy), a path (body), a charitable activity on the goal (reason), a yearly target (body, owners) or a quarterly checkpoint (body, status, due_date). p_old is the value the page started from: when the stored value differs, nothing is saved and the answer is {conflict, current, by, at}. Checks inside: staff, an active org goal, its owners or an admin, the field list. Access: authenticated.'$m$,$m$create or replace function public.strategy_activity_set(p_goal bigint, p_activity smallint, p_on boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_sort int; v_id bigint;
begin
  if not exists (select 1 from public.goals g where g.id = p_goal and g.department = 'org' and g.retired_at is null) then raise exception 'That goal is not an active organizational goal.'; end if;
  if not public.wa205_can_edit(p_goal) then raise exception 'Only this goal''s owners and the admins can change it.'; end if;
  if not exists (select 1 from public.charitable_activities a where a.id = p_activity) then raise exception 'Pick one of the eight charitable activities.'; end if;
  if p_on then
    select coalesce(max(sort), 0) + 1 into v_sort from public.goal_activities where goal_id = p_goal;
    insert into public.goal_activities (goal_id, activity_id, reason, sort, updated_by)
    values (p_goal, p_activity, nullif(btrim(coalesce(p_reason, '')), ''), v_sort, public.wa_email())
    on conflict (goal_id, activity_id) do update set archived_at = null, updated_at = now(), updated_by = public.wa_email(),
      reason = case when p_reason is null then public.goal_activities.reason else nullif(btrim(p_reason), '') end
    returning id into v_id;
  else
    update public.goal_activities set archived_at = now(), updated_at = now(), updated_by = public.wa_email()
      where goal_id = p_goal and activity_id = p_activity and archived_at is null returning id into v_id;
  end if;
  return (select to_jsonb(a) from public.goal_activities a where a.id = v_id);
end $$$m$,$m$comment on function public.strategy_activity_set(bigint, smallint, boolean, text) is 'wave207: anchors an organizational goal on one of the charitable activities (p_on true, with an optional short reason) or takes it off (p_on false; the row is kept with archived_at). Recorded in goal_history by the trigger. Checks inside: the goal''s owners or an admin. Returns the row. Access: authenticated.'$m$,$m$create or replace function public.strategy_link_checkpoint(p_project bigint, p_checkpoint bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_goal bigint;
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff link projects.'; end if;
  if not exists (select 1 from public.projects p where p.id = p_project and p.banked_at is null) then raise exception 'That project is not there.'; end if;
  if p_checkpoint is null then
    update public.projects set checkpoint_id = null, updated_at = now() where id = p_project;
    return jsonb_build_object('ok', true);
  end if;
  select c.goal_id into v_goal from public.goal_checkpoints c join public.goals g on g.id = c.goal_id
    where c.id = p_checkpoint and c.archived_at is null and g.department = 'org' and g.retired_at is null;
  if v_goal is null then raise exception 'Link projects to a checkpoint of an active organizational goal.'; end if;
  update public.projects set
      milestone_id = case when goal_id is distinct from v_goal then null else milestone_id end,
      goal_id = v_goal, checkpoint_id = p_checkpoint, updated_at = now()
    where id = p_project;
  return jsonb_build_object('ok', true, 'goal_id', v_goal);
end $$$m$,$m$comment on function public.strategy_link_checkpoint(bigint, bigint) is 'wave207: links a department''s project to one quarterly checkpoint of an organizational goal (the project then serves that goal too; a milestone of another goal is cleared), or clears the checkpoint (p_checkpoint null). Staff who may comment, as for strategy_link_project; board viewers cannot. Recorded in goal_history by the trigger. Access: authenticated.'$m$,$m$create or replace function public.strategy_link_project(p_project bigint, p_goal bigint, p_milestone bigint default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff link projects.'; end if;
  if not exists (select 1 from public.projects p where p.id = p_project and p.banked_at is null) then raise exception 'That project is not there.'; end if;
  if p_goal is not null and not exists (select 1 from public.goals g where g.id = p_goal and g.department = 'org' and g.retired_at is null) then raise exception 'Link projects to one of the active organizational goals.'; end if;
  if p_milestone is not null and not exists (select 1 from public.goal_milestones m where m.id = p_milestone and m.goal_id = p_goal and m.archived_at is null) then raise exception 'That milestone belongs to another goal.'; end if;
  update public.projects set goal_id = p_goal, milestone_id = case when p_goal is null then null else p_milestone end,
      checkpoint_id = case when p_goal is null then null
                           when checkpoint_id is not null and exists (select 1 from public.goal_checkpoints c where c.id = checkpoint_id and c.goal_id = p_goal) then checkpoint_id
                           else null end,
      updated_at = now()
    where id = p_project;
  return jsonb_build_object('ok', true);
end $$$m$,$m$comment on function public.strategy_link_project(bigint, bigint, bigint) is 'wave205, extended in wave207: links a department''s project to an organizational goal and, optionally, one of its milestones (p_goal null unlinks); a checkpoint of another goal is cleared. Departments own projects, so any staff account that may comment links them; board viewers cannot. Recorded in goal_history by the trigger. Access: authenticated.'$m$,$m$create or replace function public.strategy_restore(p_history bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare h record; v_cur text; r jsonb;
begin
  select * into h from public.goal_history where id = p_history;
  if h.id is null then raise exception 'That change is not in the history.'; end if;
  perform set_config('wa205.restored_from', h.id::text, true);
  if h.entity = 'project' then
    if not public.wa205_can_comment() then raise exception 'Board viewers read the goals.'; end if;
    if h.field = 'goal_id' then
      update public.projects set goal_id = h.old_ref, milestone_id = case when h.old_ref is distinct from goal_id then null else milestone_id end,
        checkpoint_id = case when h.old_ref is distinct from goal_id then null else checkpoint_id end, updated_at = now() where id = h.entity_id;
    elsif h.field = 'milestone_id' then
      update public.projects set milestone_id = h.old_ref, updated_at = now() where id = h.entity_id;
    elsif h.field = 'checkpoint_id' then
      update public.projects set checkpoint_id = h.old_ref, updated_at = now() where id = h.entity_id;
    end if;
    r := jsonb_build_object('ok', true);
  elsif not public.wa205_can_edit(h.goal_id) then
    raise exception 'Only this goal''s owners and the admins can restore its changes.';
  elsif h.entity = 'owner' then
    if h.field = 'added' then update public.goal_owners set removed_at = now(), is_lead = false where id = h.entity_id;
    elsif h.field = 'removed' then update public.goal_owners set removed_at = null where id = h.entity_id;
    elsif h.field = 'is_lead' then update public.goal_owners set is_lead = coalesce(h.old_value::boolean, false) where id = h.entity_id;
    elsif h.field = 'focus' then update public.goal_owners set focus = h.old_value where id = h.entity_id;
    end if;
    r := jsonb_build_object('ok', true);
  elsif h.field = 'added' then
    if h.entity = 'milestone' then update public.goal_milestones set archived_at = now(), updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'path' then update public.goal_paths set archived_at = now(), updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'activity' then update public.goal_activities set archived_at = now(), updated_at = now(), updated_by = public.wa_email() where id = h.entity_id; end if;
    r := jsonb_build_object('ok', true);
  elsif h.field = 'archived_at' then
    if h.entity = 'milestone' then update public.goal_milestones set archived_at = case when h.new_value is null then now() else null end, updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'path' then update public.goal_paths set archived_at = case when h.new_value is null then now() else null end, updated_at = now(), updated_by = public.wa_email() where id = h.entity_id;
    elsif h.entity = 'activity' then update public.goal_activities set archived_at = case when h.new_value is null then now() else null end, updated_at = now(), updated_by = public.wa_email() where id = h.entity_id; end if;
    r := jsonb_build_object('ok', true);
  elsif (h.entity in ('goal', 'milestone', 'path') and h.field in ('title', 'detail', 'why', 'measure', 'baseline', 'target_fy29', 'target_fy31', 'status', 'due_date', 'body', 'fy', 'activities_note'))
     or (h.entity = 'activity' and h.field = 'reason') or (h.entity = 'target' and h.field in ('body', 'owners')) or (h.entity = 'checkpoint' and h.field in ('body', 'status', 'due_date')) then
    if h.entity = 'goal' then execute format('select (%I)::text from public.goals where id = $1', h.field) into v_cur using h.entity_id;
    elsif h.entity = 'milestone' then execute format('select (%I)::text from public.goal_milestones where id = $1', h.field) into v_cur using h.entity_id;
    elsif h.entity = 'activity' then select reason into v_cur from public.goal_activities where id = h.entity_id;
    elsif h.entity = 'target' then execute format('select (%I)::text from public.goal_year_targets where id = $1', h.field) into v_cur using h.entity_id;
    elsif h.entity = 'checkpoint' then execute format('select (%I)::text from public.goal_checkpoints where id = $1', h.field) into v_cur using h.entity_id;
    else select body into v_cur from public.goal_paths where id = h.entity_id; end if;
    r := public.strategy_save(h.entity, h.entity_id, h.field, coalesce(h.old_value, ''), v_cur);
  else
    raise exception 'That change cannot be restored here (%).', h.field;
  end if;
  perform set_config('wa205.restored_from', '', true);
  return r;
end $$$m$,$m$comment on function public.strategy_restore(bigint) is 'wave205, extended in wave207: Restore in a goal''s history puts back the old value of that change (a field, a milestone, path or charitable activity added or taken off, an owner added or removed, a yearly target or checkpoint field, a project''s goal, milestone or checkpoint link). The restore is itself a change in the history (restored_from). Checks inside: the goal''s owners or an admin; project links by staff who may comment. Access: authenticated.'$m$,$m$alter table public.charitable_activities enable row level security$m$,$m$alter table public.goal_activities enable row level security$m$,$m$alter table public.goal_year_targets enable row level security$m$,$m$alter table public.goal_checkpoints enable row level security$m$,$m$create policy charitable_activities_read on public.charitable_activities for select to authenticated using (public.is_wa_staff() or public.is_board_viewer())$m$,$m$create policy goal_activities_read on public.goal_activities for select to authenticated using (public.is_wa_staff() or public.is_board_viewer())$m$,$m$create policy goal_year_targets_read on public.goal_year_targets for select to authenticated using (public.is_wa_staff() or public.is_board_viewer())$m$,$m$create policy goal_checkpoints_read on public.goal_checkpoints for select to authenticated using (public.is_wa_staff() or public.is_board_viewer())$m$,$m$comment on policy charitable_activities_read on public.charitable_activities is 'wave207: staff and board viewers read the charitable activities.'$m$,$m$comment on policy goal_activities_read on public.goal_activities is 'wave207: staff and board viewers read which activities each goal serves; writes go through strategy_activity_set and strategy_save.'$m$,$m$comment on policy goal_year_targets_read on public.goal_year_targets is 'wave207: staff and board viewers read the yearly targets; writes go through strategy_save.'$m$,$m$comment on policy goal_checkpoints_read on public.goal_checkpoints is 'wave207: staff and board viewers read the quarterly checkpoints; writes go through strategy_save.'$m$,$m$revoke all on public.charitable_activities, public.goal_activities, public.goal_year_targets, public.goal_checkpoints from anon, authenticated$m$,$m$grant select on public.charitable_activities, public.goal_activities, public.goal_year_targets, public.goal_checkpoints to authenticated$m$,$m$revoke all on function public.strategy_activity_set(bigint, smallint, boolean, text), public.strategy_link_checkpoint(bigint, bigint) from public, anon$m$,$m$grant execute on function public.strategy_activity_set(bigint, smallint, boolean, text), public.strategy_link_checkpoint(bigint, bigint) to authenticated$m$,$m$revoke all on function public.wa205_hist() from public, anon, authenticated$m$,$m$alter publication supabase_realtime add table public.goal_activities, public.goal_year_targets, public.goal_checkpoints$m$,$m$select set_config('wa205.seed', '1', true)$m$,$m$insert into public.charitable_activities (id, title, sort, source) values
  (1, 'Build relationships with organizations, businesses and schools', 1, 'CRA registration (July 2026 board deck)'),
  (2, 'Relieve poverty by providing basic necessities', 2, 'CRA registration (July 2026 board deck)'),
  (3, 'Address food insecurity with free, healthy meals', 3, 'CRA registration (July 2026 board deck)'),
  (4, 'Reduce isolation by building community around the meal', 4, 'CRA registration (July 2026 board deck)'),
  (5, 'Increase access to resources through referrals', 5, 'CRA registration (July 2026 board deck)'),
  (6, 'Mobilize youth and volunteers', 6, 'CRA registration (July 2026 board deck)'),
  (7, 'Collaborate with other non-profits', 7, 'CRA registration (July 2026 board deck)'),
  (8, 'Be a voice for the people we serve', 8, 'CRA registration (July 2026 board deck)')$m$,$m$insert into public.goal_activities (goal_id, activity_id, reason, sort, updated_by)
select g.id, x.a, x.reason, x.s, 'wave207 migration'
from (values
  (1, 3::smallint, 'free, healthy meals', 1), (1, 4::smallint, 'community around the meal', 2), (1, 7::smallint, 'collaborating with DESTA, TYFPC and shelters', 3),
  (2, 2::smallint, 'basic necessities', 1), (2, 5::smallint, 'referrals, including housing organizations', 2), (2, 8::smallint, 'a voice for the people we serve, through feedback', 3),
  (3, 6::smallint, 'mobilizing youth and volunteers', 1), (3, 1::smallint, 'relationships with schools and universities', 2),
  (4, 1::smallint, 'relationships with businesses and sponsors', 1), (4, 7::smallint, 'joint grant applications with other non-profits', 2),
  (5, 6::smallint, 'youth leadership that lasts beyond one school year', 1)
) as x(num, a, reason, s)
join public.goals g on g.department = 'org' and g.retired_at is null and g.number = x.num$m$,$m$update public.goals g set activities_note = x.note
from (values (4, 'It funds all eight.'), (5, 'It keeps all eight running.')) as x(num, note)
where g.department = 'org' and g.retired_at is null and g.number = x.num$m$,$m$insert into public.goal_year_targets (goal_id, fy, body, owners, sort, updated_by)
select g.id, 'FY27', x.body, x.owners, x.num, 'wave207 migration'
from (values
  (1, '3,000 meals, counted at 100% of services', 'Shima, Suhaib'),
  (2, 'Hygiene kits at 50% of services; first feedback round', 'Shima'),
  (3, '20% of volunteers return; 110 volunteers; half of applicants serve', 'Ian, Suhaib'),
  (4, '$25,000 revenue; 25 monthly donors; first grant; 2 paid summer roles', 'Suhaib, Ian'),
  (5, 'Executive transition done; HR seat filled; Keela retired; every role written', 'Suhaib, Ian, Shima')
) as x(num, body, owners)
join public.goals g on g.department = 'org' and g.retired_at is null and g.number = x.num$m$,$m$insert into public.goal_checkpoints (target_id, goal_id, quarter, due_date, body, updated_by)
select t.id, t.goal_id, x.q, x.due::date, x.body, 'wave207 migration'
from (values
  (1, 1, '2026-12-31', 'Meal counts logged at every service'),
  (1, 2, '2027-03-31', '1,500 meals; TMU Cook & Share with TYFPC (Jan)'),
  (1, 3, '2027-06-30', '2,250 meals'),
  (1, 4, '2027-09-30', '3,000 meals'),
  (2, 1, '2026-12-31', 'Kit source confirmed with a partner'),
  (2, 2, '2027-03-31', 'First referral partner invited (housing a priority)'),
  (2, 3, '2027-06-30', 'First feedback round complete'),
  (2, 4, '2027-09-30', 'Kits at 50% of services'),
  (3, 1, '2026-12-31', '7-day follow-up for every first-time volunteer'),
  (3, 2, '2027-03-31', 'Recognition budget decided'),
  (3, 3, '2027-06-30', 'Applicant-to-served rate at 50%'),
  (3, 4, '2027-09-30', '110 volunteers; 20% return'),
  (4, 1, '2026-12-31', 'FY27 budget approved; donor program launched; Canada Summer Jobs applied (if the window opens)'),
  (4, 2, '2027-03-31', 'Ad Grant live; 10 monthly donors; every flagship event has a lead'),
  (4, 3, '2027-06-30', '2 summer roles start; first grant awarded'),
  (4, 4, '2027-09-30', '$25,000; 25 monthly donors'),
  (5, 1, '2026-12-31', 'Goals approved (Oct 19); Keela notice by Dec 5'),
  (5, 2, '2027-03-31', 'Executive transition complete; HR seat filled'),
  (5, 3, '2027-06-30', 'Every leadership role written, with hours'),
  (5, 4, '2027-09-30', 'First yearly handover cycle run')
) as x(num, q, due, body)
join public.goals g on g.department = 'org' and g.retired_at is null and g.number = x.num
join public.goal_year_targets t on t.goal_id = g.id and t.fy = 'FY27' and t.archived_at is null$m$,$m$insert into public.strategy_plan (key, value, updated_by) values
  ('activities', jsonb_build_object(
     'title', 'Anchored in our 8 charitable activities',
     'intro', 'Every goal serves at least one of the eight activities registered with the CRA (July 2026 board deck). All eight are covered.'), 'wave207 migration'),
  ('year_fy27', jsonb_build_object(
     'fy', 'FY27',
     'title', 'This year''s goals: FY27 (Oct 1, 2026 to Sep 30, 2027)',
     'intro', 'Five goals for this year, each the first step on its 3-year goal. Owners report against the quarterly checkpoints at each board meeting.',
     'note', 'The FY27 budget, the Keela notice date (by Dec 5 to beat the Dec 19 renewal) and the Canada Summer Jobs window are fixed by outside dates; the rest are our proposals for the board.'), 'wave207 migration')
on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by$m$,$m$select set_config('wa205.seed', '', true)$m$,$m$insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('strategy', 'org_goals', 'wave207', null, 'charitable activities (8, 11 goal links) and FY27 targets (5) with quarterly checkpoints (20), from the 29/09/26 draft', 'wave207 migration')$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
