-- wa169_sync_assign (29/09/26): the HR centre's master onboarding drives what people see in the Avenue Academy, and trainings
-- can be assigned to the organization (wave169).
-- Steel: "the master onboarding in the hr center that controls the onboarding. I want to make that's synced to what people see
-- on their Avenue Academy page. Also, I want HR to have the ability to assign trainings to the org through that same page in the
-- hr center. Leaders should have that ability on the Avenue Academy page as well".
-- Every change is guarded: running it twice changes nothing more.

-- 1. a week's due date follows its name: WEEK n is n weeks, "90 DAYS" 90 days, "6 MONTHS" six months (it said 90 days)
create or replace function public.onb_due(p_section text, p_start date)
 returns date
 language sql
 immutable
 set search_path to 'public'
as $function$
  select p_start + (case
    when upper(coalesce(p_section, '')) ~ '^WEEK\s+[0-9]+$' then 7 * (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    when upper(coalesce(p_section, '')) ~ '^[0-9]+\s+DAYS?$' then (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    when upper(coalesce(p_section, '')) ~ '^[0-9]+\s+MONTHS?$' then 30 * (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    else 90 end)
$function$;

-- 2. what HR changes in the master reaches every plan in progress: a new or restored step (and ticked at once when it is an
-- Academy module the person already did), a retired step goes, a step moved to another week takes that week's due date, and a
-- step newly linked to an Academy module or Learning Avenue ticks itself for those who already did it
create or replace function public.onboarding_template_propagate()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
      on conflict (onboarding_id, template_id) do nothing;
      if new.training_id is not null or new.academy_path is not null then
        perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
      end if;
    end if;
    return new;
  end if;
  if new.active is distinct from old.active then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
      on conflict (onboarding_id, template_id) do nothing;
      if new.training_id is not null or new.academy_path is not null then
        perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
      end if;
    else
      delete from public.onboarding_steps s using public.onboardings o
      where s.template_id = new.id and s.onboarding_id = o.id and o.status = 'active';
    end if;
    return new;
  end if;
  if new.active and new.section is distinct from old.section then
    update public.onboarding_steps s set due_date = public.onb_due(new.section, o.started_at)
      from public.onboardings o
     where s.onboarding_id = o.id and o.status = 'active' and s.template_id = new.id and not coalesce(s.done, false);
  end if;
  if new.active and (new.training_id is not null or new.academy_path is not null)
     and (new.training_id is distinct from old.training_id or new.academy_path is distinct from old.academy_path) then
    perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
  end if;
  return new;
end $function$;

-- 3. the Learning Avenue "Your onboarding" is the master's own Academy modules, in the master's order: a module a step asks for
-- joins it (unless it belongs to another avenue, where it stays), and one no step asks for any more leaves it for the library
create or replace function public.wa169_onb_avenue_sync()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_avenue text; v_n int := 0; v_m int := 0;
begin
  select p.name into v_avenue from public.academy_paths p where p.key = 'firstweek';
  if v_avenue is null then return 0; end if;
  with linked as (
    select t.training_id as tid,
           min((case t.section when 'WEEK 1' then 1 when 'WEEK 2' then 2 when 'WEEK 3' then 3 when 'WEEK 4' then 4 when '60 DAYS' then 5
                               when '90 DAYS' then 6 when '6 MONTHS' then 7 else 9 end)::bigint * 1000000
               + coalesce(p.sort, t.sort, 0)::bigint * 1000
               + (case when t.parent_id is null then 0 else coalesce(t.sort, 0) + 1 end)::bigint) as ord
      from public.onboarding_template t left join public.onboarding_template p on p.id = t.parent_id
     where t.active and t.training_id is not null
     group by t.training_id
  ),
  ranked as (select l.tid, (row_number() over (order by l.ord, l.tid) * 10)::int as new_sort from linked l),
  upd as (
    update public.trainings tr set path_group = v_avenue, sort = r.new_sort, updated_at = now()
      from ranked r
     where tr.id = r.tid and (tr.path_group is null or tr.path_group = v_avenue)
       and (tr.path_group is distinct from v_avenue or tr.sort is distinct from r.new_sort)
    returning tr.id
  )
  select count(*) into v_n from upd;
  update public.trainings tr set path_group = null, updated_at = now()
   where tr.path_group = v_avenue
     and not exists (select 1 from public.onboarding_template t where t.active and t.training_id = tr.id);
  get diagnostics v_m = row_count;
  return v_n + v_m;
end $function$;
revoke all on function public.wa169_onb_avenue_sync() from public, anon, authenticated;

create or replace function public.wa169_tmpl_avenue()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.wa169_onb_avenue_sync();
  return null;
end $function$;
revoke all on function public.wa169_tmpl_avenue() from public, anon, authenticated;
drop trigger if exists trg_wa169_onb_avenue on public.onboarding_template;
create trigger trg_wa169_onb_avenue after insert or update or delete on public.onboarding_template
  for each statement execute function public.wa169_tmpl_avenue();

-- 4. who may change the onboarding and assign trainings: HR (its access profile), leaders and admins
create or replace function public.wa169_can_assign()
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select public.is_hub_leader()
      or exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role <> 'blocked' and r.profile = 'hr');
$function$;

-- 5. what people see each week: the master's section settings (title, photo, what they will learn, why it matters, the lesson
-- that opens it), kept in app_config.onboarding_journey, which the journey reads
create or replace function public.onboarding_journey_save(p_section text, p_week jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_raw text; v_cfg jsonb; v_week jsonb; v_learn jsonb := '[]'::jsonb; v_lesson text; v_x text; v_who text;
        v_path text; v_fx numeric; v_fy numeric; v_alt text;
begin
  if not public.wa169_can_assign() then raise exception 'Only HR, leaders and admins can change the onboarding'; end if;
  if p_section is null or not exists (select 1 from public.onboarding_template t where t.active and t.section = p_section) then
    raise exception 'That week is not in the master onboarding';
  end if;
  if length(trim(coalesce(p_week ->> 'title', ''))) = 0 then raise exception 'Give the week a title'; end if;
  if p_week ? 'photo_id' and nullif(p_week ->> 'photo_id', '') is not null then
    select ph.path_web, ph.focal_x, ph.focal_y, ph.alt_text into v_path, v_fx, v_fy, v_alt from public.wa_photos ph
     where ph.id = (p_week ->> 'photo_id')::bigint and ph.usage = 'ready' and ph.path_web is not null;
    if v_path is null then raise exception 'Pick a photo marked ready in the Photo library'; end if;
  end if;
  if jsonb_typeof(p_week -> 'learn') = 'array' then
    for v_x in select trim(x) from jsonb_array_elements_text(p_week -> 'learn') x loop
      if length(v_x) > 0 and jsonb_array_length(v_learn) < 3 then v_learn := v_learn || to_jsonb(left(v_x, 140)); end if;
    end loop;
  end if;
  v_lesson := nullif(p_week ->> 'lesson', '');
  if v_lesson is not null and not exists (select 1 from public.onboarding_template t where t.id = v_lesson and t.active and t.section = p_section and t.training_id is not null) then
    raise exception 'The lesson has to be an Academy step of that week';
  end if;
  select value into v_raw from public.app_config where key = 'onboarding_journey';
  begin v_cfg := coalesce(nullif(v_raw, '')::jsonb, '{}'::jsonb); exception when others then v_cfg := '{}'::jsonb; end;
  if jsonb_typeof(v_cfg -> 'weeks') is distinct from 'object' then v_cfg := jsonb_set(v_cfg, '{weeks}', '{}'::jsonb, true); end if;
  if v_cfg -> 'v' is null then v_cfg := jsonb_set(v_cfg, '{v}', '1'::jsonb, true); end if;
  v_week := coalesce(v_cfg -> 'weeks' -> p_section, '{}'::jsonb)
    || jsonb_build_object('title', left(trim(p_week ->> 'title'), 40), 'lesson', v_lesson, 'learn', v_learn,
                          'why', nullif(left(trim(coalesce(p_week ->> 'why', '')), 320), ''));
  if v_path is not null then
    v_week := v_week || jsonb_build_object('photo', v_path, 'fx', coalesce(v_fx, 0.5), 'fy', coalesce(v_fy, 0.5), 'alt', coalesce(v_alt, ''));
  end if;
  v_cfg := jsonb_set(v_cfg, array['weeks', p_section], v_week, true);
  update public.app_config set value = v_cfg::text, updated_at = now() where key = 'onboarding_journey';
  if not found then insert into public.app_config (key, value, updated_at) values ('onboarding_journey', v_cfg::text, now()); end if;
  select coalesce(tm.name, public.wa_email()) into v_who from public.team_members tm where lower(tm.email) = public.wa_email() limit 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('onboarding_journey', p_section, 'what people see', null, v_week::text, coalesce(v_who, public.wa_email()));
  return v_week;
end $function$;
revoke all on function public.onboarding_journey_save(text, jsonb) from public, anon;
grant execute on function public.onboarding_journey_save(text, jsonb) to authenticated;

-- 6. assigning trainings: a module or a Learning Avenue, to everyone (the whole team, not the board), teams or people, with an
-- optional due date; people who join later get it too unless it says otherwise. The rows in training_progress carry the
-- assignment and its due date, so the Academy, the HR centre and Home read them as before.
create table if not exists public.academy_assignments (
  id bigint generated by default as identity primary key,
  training_id bigint references public.trainings(id) on delete cascade,
  path_key text references public.academy_paths(key) on update cascade on delete cascade,
  audience text not null check (audience in ('everyone', 'team', 'people')),
  teams text[] not null default '{}',
  people text[] not null default '{}',
  member_ids bigint[] not null default '{}',
  include_new boolean not null default true,
  due_date date,
  due_days integer,
  note text,
  assigned_by text not null,
  assigned_by_email text,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  ended_at timestamptz,
  ended_by text,
  constraint academy_assignments_what check ((training_id is null) <> (path_key is null))
);
create index if not exists idx_academy_assignments_active on public.academy_assignments (active);
alter table public.academy_assignments enable row level security;
alter table public.training_progress add column if not exists assignment_id bigint;
alter table public.training_progress drop constraint if exists training_progress_assignment_id_fkey;
alter table public.training_progress add constraint training_progress_assignment_id_fkey foreign key (assignment_id) references public.academy_assignments(id) on delete set null;
create index if not exists idx_training_progress_assignment on public.training_progress (assignment_id);
alter table public.training_progress add column if not exists due_date date;

-- the people an assignment is for (active, on the roster with a sign-in address; everyone leaves out the board)
create or replace function public.wa169_targets(p_id bigint)
 returns table (member_id bigint, name text, email text, department text)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select tm.id, tm.name, lower(tm.email), tm.department
    from public.academy_assignments a
    join public.team_members tm on tm.active and tm.email is not null and tm.name is not null
   where a.id = p_id
     and (case when not a.include_new and cardinality(a.member_ids) > 0 then tm.id = any (a.member_ids)
               when a.audience = 'everyone' then coalesce(tm.department, '') <> 'board'
               when a.audience = 'team' then tm.department = any (a.teams)
               else lower(tm.email) = any (a.people) end);
$function$;
revoke all on function public.wa169_targets(bigint) from public, anon, authenticated;

-- the modules an assignment covers: the module, or the avenue's modules (no tours, nothing planned)
create or replace function public.wa169_modules(p_id bigint)
 returns table (training_id bigint)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select a.training_id from public.academy_assignments a where a.id = p_id and a.training_id is not null
  union
  select t.id from public.academy_assignments a join public.academy_paths p on p.key = a.path_key
    join public.trainings t on t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour'
                           and not coalesce((t.body ->> 'planned')::boolean, false)
   where a.id = p_id and a.path_key is not null;
$function$;
revoke all on function public.wa169_modules(bigint) from public, anon, authenticated;

-- write the rows: a person who has not started gets an assigned row; one who started keeps their progress and gains the
-- assignment's due date; one who finished is left alone. p_member limits it to one person (people who join later).
create or replace function public.academy_assign_apply(p_id bigint default null, p_member bigint default null)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare a record; v_n int := 0; v_k int;
begin
  for a in select * from public.academy_assignments x
            where x.active and (p_id is null or x.id = p_id) and (p_member is null or x.include_new) loop
    insert into public.training_progress as tp (training_id, person_name, email, status, assigned_by, note, assignment_id, due_date, updated_at)
    select m.training_id, t.name, t.email, 'assigned', a.assigned_by, a.note, a.id,
           case when p_member is not null and a.due_days is not null then current_date + a.due_days else a.due_date end, now()
      from public.wa169_targets(a.id) t cross join public.wa169_modules(a.id) m
     where (p_member is null or t.member_id = p_member)
    on conflict (training_id, person_name) do update
       set assignment_id = coalesce(tp.assignment_id, excluded.assignment_id),
           due_date = case when tp.due_date is null then excluded.due_date
                           when excluded.due_date is null then tp.due_date
                           else least(tp.due_date, excluded.due_date) end,
           assigned_by = coalesce(tp.assigned_by, excluded.assigned_by),
           email = coalesce(tp.email, excluded.email),
           updated_at = now()
     where tp.status is distinct from 'done'
       and (tp.assignment_id is null
            or tp.due_date is distinct from (case when tp.due_date is null then excluded.due_date
                                                  when excluded.due_date is null then tp.due_date
                                                  else least(tp.due_date, excluded.due_date) end));
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;
  return v_n;
end $function$;
revoke all on function public.academy_assign_apply(bigint, bigint) from public, anon, authenticated;

-- assign: {training_id | path_key, audience, teams, people (emails), include_new, due_date, note}
create or replace function public.academy_assign(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_id bigint; v_aud text := coalesce(p ->> 'audience', ''); v_teams text[] := '{}'; v_people text[] := '{}'; v_due date;
        v_tid bigint := nullif(p ->> 'training_id', '')::bigint; v_path text := nullif(p ->> 'path_key', ''); v_new boolean := coalesce((p ->> 'include_new')::boolean, true);
        v_who text; v_email text := public.wa_email(); v_rows int; v_people_n int; v_what text; v_ids bigint[] := '{}';
begin
  if not public.wa169_can_assign() then raise exception 'Only HR, leaders and admins can assign trainings'; end if;
  if (v_tid is null) = (v_path is null) then raise exception 'Pick a training or a Learning Avenue'; end if;
  if v_tid is not null and not exists (select 1 from public.trainings t where t.id = v_tid and coalesce(t.active, true)) then raise exception 'That training is not in the Academy'; end if;
  if v_path is not null and not exists (select 1 from public.academy_paths ap where ap.key = v_path and ap.active) then raise exception 'That Learning Avenue is not in the Academy'; end if;
  if v_aud not in ('everyone', 'team', 'people') then raise exception 'Say who it is for'; end if;
  if v_aud = 'team' then
    select coalesce(array_agg(distinct x), '{}') into v_teams from jsonb_array_elements_text(coalesce(p -> 'teams', '[]'::jsonb)) x
     where exists (select 1 from public.team_members tm where tm.active and tm.department = x);
    if cardinality(v_teams) = 0 then raise exception 'Pick at least one team'; end if;
  end if;
  if v_aud = 'people' then
    select coalesce(array_agg(distinct lower(x)), '{}') into v_people from jsonb_array_elements_text(coalesce(p -> 'people', '[]'::jsonb)) x
     where exists (select 1 from public.team_members tm where tm.active and lower(tm.email) = lower(x));
    if cardinality(v_people) = 0 then raise exception 'Pick at least one person'; end if;
    v_new := false;
  end if;
  v_due := nullif(p ->> 'due_date', '')::date;
  if v_due is not null and v_due < current_date then raise exception 'The due date has passed'; end if;
  select tm.name into v_who from public.team_members tm where lower(tm.email) = v_email and tm.active limit 1;
  insert into public.academy_assignments (training_id, path_key, audience, teams, people, include_new, due_date, due_days, note, assigned_by, assigned_by_email)
  values (v_tid, v_path, v_aud, v_teams, v_people, v_new, v_due, case when v_due is null then null else v_due - current_date end,
          nullif(left(trim(coalesce(p ->> 'note', '')), 400), ''), coalesce(v_who, split_part(v_email, '@', 1)), v_email)
  returning id into v_id;
  if not v_new then
    select coalesce(array_agg(t.member_id), '{}') into v_ids from public.wa169_targets(v_id) t;
    update public.academy_assignments set member_ids = v_ids where id = v_id;
  end if;
  v_rows := public.academy_assign_apply(v_id, null);
  select count(*) into v_people_n from public.wa169_targets(v_id);
  select coalesce((select t.title from public.trainings t where t.id = v_tid), (select ap.title from public.academy_paths ap where ap.key = v_path)) into v_what;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('academy_assignment', v_id::text, 'assigned', null,
          v_what || ' to ' || case v_aud when 'everyone' then 'everyone' when 'team' then array_to_string(v_teams, ', ') else v_people_n || ' people' end
          || coalesce(', due ' || v_due::text, ''), coalesce(v_who, v_email));
  return jsonb_build_object('id', v_id, 'people', v_people_n, 'rows', v_rows);
end $function$;
revoke all on function public.academy_assign(jsonb) from public, anon;
grant execute on function public.academy_assign(jsonb) to authenticated;

-- stop an assignment: rows nobody started go, started ones keep their progress without the assignment
create or replace function public.academy_assign_end(p_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_who text; v_gone int; v_kept int;
begin
  if not public.wa169_can_assign() then raise exception 'Only HR, leaders and admins can change assignments'; end if;
  select coalesce((select tm.name from public.team_members tm where lower(tm.email) = public.wa_email() limit 1), public.wa_email()) into v_who;
  update public.academy_assignments set active = false, ended_at = now(), ended_by = v_who where id = p_id and active;
  if not found then raise exception 'That assignment is not running'; end if;
  delete from public.training_progress where assignment_id = p_id and status = 'assigned' and started_at is null and coalesce(pct, 0) = 0;
  get diagnostics v_gone = row_count;
  update public.training_progress set assignment_id = null, due_date = null where assignment_id = p_id;
  get diagnostics v_kept = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('academy_assignment', p_id::text, 'stopped', null, v_gone || ' not started removed, ' || v_kept || ' kept', v_who);
  return jsonb_build_object('removed', v_gone, 'kept', v_kept);
end $function$;
revoke all on function public.academy_assign_end(bigint) from public, anon;
grant execute on function public.academy_assign_end(bigint) to authenticated;

-- the assignments with how far people are: for HR, leaders and admins
create or replace function public.academy_assignments_list()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case when not public.wa169_can_assign() then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x.active desc, x.created_at desc) from (
      select a.id, a.training_id, a.path_key, a.audience, a.teams, a.people, a.include_new, a.due_date, a.note, a.assigned_by, a.created_at, a.active, a.ended_at, a.ended_by,
             coalesce((select t.title from public.trainings t where t.id = a.training_id), (select ap.title from public.academy_paths ap where ap.key = a.path_key)) as title,
             (select count(*) from public.wa169_modules(a.id))::int as modules,
             (select jsonb_agg(jsonb_build_object('name', t.name, 'department', t.department,
                       'done', s.done, 'total', s.total, 'started', s.started, 'due', s.due)
                     order by (s.done >= s.total and s.total > 0), t.name)
                from public.wa169_targets(a.id) t
                cross join lateral (
                  select count(distinct m.training_id) filter (where tp.status = 'done')::int as done,
                         (select count(*) from public.wa169_modules(a.id))::int as total,
                         (count(*) filter (where tp.status <> 'done' and (tp.started_at is not null or coalesce(tp.pct, 0) > 0)) > 0) as started,
                         min(tp.due_date) filter (where tp.status <> 'done') as due
                    from public.wa169_modules(a.id) m
                    left join public.training_progress tp on tp.training_id = m.training_id and (lower(tp.person_name) = lower(t.name) or lower(coalesce(tp.email, '')) = t.email)
                ) s) as people_state
        from public.academy_assignments a
       where a.active or a.ended_at > now() - interval '30 days'
    ) x), '[]'::jsonb) end;
$function$;
revoke all on function public.academy_assignments_list() from public, anon;
grant execute on function public.academy_assignments_list() to authenticated;

-- who sees an assignment: the people it is for, and HR, leaders and admins (the rows themselves are written by the functions)
drop policy if exists academy_assignments_read on public.academy_assignments;
create policy academy_assignments_read on public.academy_assignments for select to authenticated
  using (public.wa169_can_assign()
         or audience = 'everyone'
         or (audience = 'team' and exists (select 1 from public.team_members tm where lower(tm.email) = public.wa_email() and tm.department = any (teams)))
         or (audience = 'people' and public.wa_email() = any (people)));
grant select on public.academy_assignments to authenticated;

-- people who join, or move to another team, get the assignments meant for them
create or replace function public.wa169_member_assign()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.active and new.email is not null and (tg_op = 'INSERT' or old.active is distinct from new.active or old.department is distinct from new.department or old.email is distinct from new.email) then
    perform public.academy_assign_apply(null, new.id);
  end if;
  return new;
end $function$;
revoke all on function public.wa169_member_assign() from public, anon, authenticated;
drop trigger if exists trg_wa169_member_assign on public.team_members;
create trigger trg_wa169_member_assign after insert or update of active, department, email on public.team_members
  for each row execute function public.wa169_member_assign();

-- every morning, modules added to an assigned avenue reach the people it is assigned to (06:18 Toronto)
select cron.unschedule('wa-academy-assign') where exists (select 1 from cron.job where jobname = 'wa-academy-assign');
select cron.schedule('wa-academy-assign', '18 10 * * *', $$select public.academy_assign_apply(null, null)$$);

-- the avenue follows the master from now on
select public.wa169_onb_avenue_sync();

-- 7. what they mean
comment on table public.academy_assignments is 'wave169: a training or a Learning Avenue assigned to everyone (the whole team, not the board), teams or people, from the HR centre or the Avenue Academy (academy_assign); include_new gives it to people who join later (trg_wa169_member_assign), due_days is their time to finish. The rows in training_progress carry it (assignment_id, due_date).';
comment on column public.training_progress.assignment_id is 'wave169: the assignment that put this training on the person''s list (academy_assignments.id); null for a person''s own start or an older one-to-one assignment.';
comment on column public.training_progress.due_date is 'wave169: when the assignment asks for it to be done (the earliest when two assignments ask).';
comment on function public.onboarding_journey_save(text, jsonb) is 'wave169: HR, leaders and admins set what people see for a week of the onboarding (title, photo from the Photo library, what they will learn, why it matters, the lesson that opens it) in app_config.onboarding_journey.';
comment on function public.academy_assign(jsonb) is 'wave169: assign a training or a Learning Avenue (HR, leaders and admins); writes the assignment and the people''s rows.';
comment on function public.academy_assign_end(bigint) is 'wave169: stop an assignment; rows nobody started are removed, started ones keep their progress.';
comment on function public.academy_assignments_list() is 'wave169: the assignments (running, and stopped in the last 30 days) with each person''s progress, for HR, leaders and admins.';
comment on function public.wa169_onb_avenue_sync() is 'wave169: the Learning Avenue Your onboarding is the master onboarding''s Academy modules, in the master''s order (trg_wa169_onb_avenue on onboarding_template).';

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929110000', 'wa169_sync_assign', array[$m$create or replace function public.onb_due(p_section text, p_start date)
 returns date
 language sql
 immutable
 set search_path to 'public'
as $function$
  select p_start + (case
    when upper(coalesce(p_section, '')) ~ '^WEEK\s+[0-9]+$' then 7 * (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    when upper(coalesce(p_section, '')) ~ '^[0-9]+\s+DAYS?$' then (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    when upper(coalesce(p_section, '')) ~ '^[0-9]+\s+MONTHS?$' then 30 * (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    else 90 end)
$function$$m$,$m$create or replace function public.onboarding_template_propagate()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
      on conflict (onboarding_id, template_id) do nothing;
      if new.training_id is not null or new.academy_path is not null then
        perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
      end if;
    end if;
    return new;
  end if;
  if new.active is distinct from old.active then
    if new.active then
      insert into public.onboarding_steps (onboarding_id, template_id, due_date)
      select o.id, new.id, public.onb_due(new.section, o.started_at) from public.onboardings o where o.status = 'active'
      on conflict (onboarding_id, template_id) do nothing;
      if new.training_id is not null or new.academy_path is not null then
        perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
      end if;
    else
      delete from public.onboarding_steps s using public.onboardings o
      where s.template_id = new.id and s.onboarding_id = o.id and o.status = 'active';
    end if;
    return new;
  end if;
  if new.active and new.section is distinct from old.section then
    update public.onboarding_steps s set due_date = public.onb_due(new.section, o.started_at)
      from public.onboardings o
     where s.onboarding_id = o.id and o.status = 'active' and s.template_id = new.id and not coalesce(s.done, false);
  end if;
  if new.active and (new.training_id is not null or new.academy_path is not null)
     and (new.training_id is distinct from old.training_id or new.academy_path is distinct from old.academy_path) then
    perform public.wa166_onb_sync(o.id) from public.onboardings o where o.status = 'active';
  end if;
  return new;
end $function$$m$,$m$create or replace function public.wa169_onb_avenue_sync()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_avenue text; v_n int := 0; v_m int := 0;
begin
  select p.name into v_avenue from public.academy_paths p where p.key = 'firstweek';
  if v_avenue is null then return 0; end if;
  with linked as (
    select t.training_id as tid,
           min((case t.section when 'WEEK 1' then 1 when 'WEEK 2' then 2 when 'WEEK 3' then 3 when 'WEEK 4' then 4 when '60 DAYS' then 5
                               when '90 DAYS' then 6 when '6 MONTHS' then 7 else 9 end)::bigint * 1000000
               + coalesce(p.sort, t.sort, 0)::bigint * 1000
               + (case when t.parent_id is null then 0 else coalesce(t.sort, 0) + 1 end)::bigint) as ord
      from public.onboarding_template t left join public.onboarding_template p on p.id = t.parent_id
     where t.active and t.training_id is not null
     group by t.training_id
  ),
  ranked as (select l.tid, (row_number() over (order by l.ord, l.tid) * 10)::int as new_sort from linked l),
  upd as (
    update public.trainings tr set path_group = v_avenue, sort = r.new_sort, updated_at = now()
      from ranked r
     where tr.id = r.tid and (tr.path_group is null or tr.path_group = v_avenue)
       and (tr.path_group is distinct from v_avenue or tr.sort is distinct from r.new_sort)
    returning tr.id
  )
  select count(*) into v_n from upd;
  update public.trainings tr set path_group = null, updated_at = now()
   where tr.path_group = v_avenue
     and not exists (select 1 from public.onboarding_template t where t.active and t.training_id = tr.id);
  get diagnostics v_m = row_count;
  return v_n + v_m;
end $function$$m$,$m$revoke all on function public.wa169_onb_avenue_sync() from public, anon, authenticated$m$,$m$create or replace function public.wa169_tmpl_avenue()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.wa169_onb_avenue_sync();
  return null;
end $function$$m$,$m$revoke all on function public.wa169_tmpl_avenue() from public, anon, authenticated$m$,$m$drop trigger if exists trg_wa169_onb_avenue on public.onboarding_template$m$,$m$create trigger trg_wa169_onb_avenue after insert or update or delete on public.onboarding_template
  for each statement execute function public.wa169_tmpl_avenue()$m$,$m$create or replace function public.wa169_can_assign()
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select public.is_hub_leader()
      or exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role <> 'blocked' and r.profile = 'hr');
$function$$m$,$m$create or replace function public.onboarding_journey_save(p_section text, p_week jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_raw text; v_cfg jsonb; v_week jsonb; v_learn jsonb := '[]'::jsonb; v_lesson text; v_x text; v_who text;
        v_path text; v_fx numeric; v_fy numeric; v_alt text;
begin
  if not public.wa169_can_assign() then raise exception 'Only HR, leaders and admins can change the onboarding'; end if;
  if p_section is null or not exists (select 1 from public.onboarding_template t where t.active and t.section = p_section) then
    raise exception 'That week is not in the master onboarding';
  end if;
  if length(trim(coalesce(p_week ->> 'title', ''))) = 0 then raise exception 'Give the week a title'; end if;
  if p_week ? 'photo_id' and nullif(p_week ->> 'photo_id', '') is not null then
    select ph.path_web, ph.focal_x, ph.focal_y, ph.alt_text into v_path, v_fx, v_fy, v_alt from public.wa_photos ph
     where ph.id = (p_week ->> 'photo_id')::bigint and ph.usage = 'ready' and ph.path_web is not null;
    if v_path is null then raise exception 'Pick a photo marked ready in the Photo library'; end if;
  end if;
  if jsonb_typeof(p_week -> 'learn') = 'array' then
    for v_x in select trim(x) from jsonb_array_elements_text(p_week -> 'learn') x loop
      if length(v_x) > 0 and jsonb_array_length(v_learn) < 3 then v_learn := v_learn || to_jsonb(left(v_x, 140)); end if;
    end loop;
  end if;
  v_lesson := nullif(p_week ->> 'lesson', '');
  if v_lesson is not null and not exists (select 1 from public.onboarding_template t where t.id = v_lesson and t.active and t.section = p_section and t.training_id is not null) then
    raise exception 'The lesson has to be an Academy step of that week';
  end if;
  select value into v_raw from public.app_config where key = 'onboarding_journey';
  begin v_cfg := coalesce(nullif(v_raw, '')::jsonb, '{}'::jsonb); exception when others then v_cfg := '{}'::jsonb; end;
  if jsonb_typeof(v_cfg -> 'weeks') is distinct from 'object' then v_cfg := jsonb_set(v_cfg, '{weeks}', '{}'::jsonb, true); end if;
  if v_cfg -> 'v' is null then v_cfg := jsonb_set(v_cfg, '{v}', '1'::jsonb, true); end if;
  v_week := coalesce(v_cfg -> 'weeks' -> p_section, '{}'::jsonb)
    || jsonb_build_object('title', left(trim(p_week ->> 'title'), 40), 'lesson', v_lesson, 'learn', v_learn,
                          'why', nullif(left(trim(coalesce(p_week ->> 'why', '')), 320), ''));
  if v_path is not null then
    v_week := v_week || jsonb_build_object('photo', v_path, 'fx', coalesce(v_fx, 0.5), 'fy', coalesce(v_fy, 0.5), 'alt', coalesce(v_alt, ''));
  end if;
  v_cfg := jsonb_set(v_cfg, array['weeks', p_section], v_week, true);
  update public.app_config set value = v_cfg::text, updated_at = now() where key = 'onboarding_journey';
  if not found then insert into public.app_config (key, value, updated_at) values ('onboarding_journey', v_cfg::text, now()); end if;
  select coalesce(tm.name, public.wa_email()) into v_who from public.team_members tm where lower(tm.email) = public.wa_email() limit 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('onboarding_journey', p_section, 'what people see', null, v_week::text, coalesce(v_who, public.wa_email()));
  return v_week;
end $function$$m$,$m$revoke all on function public.onboarding_journey_save(text, jsonb) from public, anon$m$,$m$grant execute on function public.onboarding_journey_save(text, jsonb) to authenticated$m$,$m$create table if not exists public.academy_assignments (
  id bigint generated by default as identity primary key,
  training_id bigint references public.trainings(id) on delete cascade,
  path_key text references public.academy_paths(key) on update cascade on delete cascade,
  audience text not null check (audience in ('everyone', 'team', 'people')),
  teams text[] not null default '{}',
  people text[] not null default '{}',
  member_ids bigint[] not null default '{}',
  include_new boolean not null default true,
  due_date date,
  due_days integer,
  note text,
  assigned_by text not null,
  assigned_by_email text,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  ended_at timestamptz,
  ended_by text,
  constraint academy_assignments_what check ((training_id is null) <> (path_key is null))
)$m$,$m$create index if not exists idx_academy_assignments_active on public.academy_assignments (active)$m$,$m$alter table public.academy_assignments enable row level security$m$,$m$alter table public.training_progress add column if not exists assignment_id bigint$m$,$m$alter table public.training_progress drop constraint if exists training_progress_assignment_id_fkey$m$,$m$alter table public.training_progress add constraint training_progress_assignment_id_fkey foreign key (assignment_id) references public.academy_assignments(id) on delete set null$m$,$m$create index if not exists idx_training_progress_assignment on public.training_progress (assignment_id)$m$,$m$alter table public.training_progress add column if not exists due_date date$m$,$m$create or replace function public.wa169_targets(p_id bigint)
 returns table (member_id bigint, name text, email text, department text)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select tm.id, tm.name, lower(tm.email), tm.department
    from public.academy_assignments a
    join public.team_members tm on tm.active and tm.email is not null and tm.name is not null
   where a.id = p_id
     and (case when not a.include_new and cardinality(a.member_ids) > 0 then tm.id = any (a.member_ids)
               when a.audience = 'everyone' then coalesce(tm.department, '') <> 'board'
               when a.audience = 'team' then tm.department = any (a.teams)
               else lower(tm.email) = any (a.people) end);
$function$$m$,$m$revoke all on function public.wa169_targets(bigint) from public, anon, authenticated$m$,$m$create or replace function public.wa169_modules(p_id bigint)
 returns table (training_id bigint)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select a.training_id from public.academy_assignments a where a.id = p_id and a.training_id is not null
  union
  select t.id from public.academy_assignments a join public.academy_paths p on p.key = a.path_key
    join public.trainings t on t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour'
                           and not coalesce((t.body ->> 'planned')::boolean, false)
   where a.id = p_id and a.path_key is not null;
$function$$m$,$m$revoke all on function public.wa169_modules(bigint) from public, anon, authenticated$m$,$m$create or replace function public.academy_assign_apply(p_id bigint default null, p_member bigint default null)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare a record; v_n int := 0; v_k int;
begin
  for a in select * from public.academy_assignments x
            where x.active and (p_id is null or x.id = p_id) and (p_member is null or x.include_new) loop
    insert into public.training_progress as tp (training_id, person_name, email, status, assigned_by, note, assignment_id, due_date, updated_at)
    select m.training_id, t.name, t.email, 'assigned', a.assigned_by, a.note, a.id,
           case when p_member is not null and a.due_days is not null then current_date + a.due_days else a.due_date end, now()
      from public.wa169_targets(a.id) t cross join public.wa169_modules(a.id) m
     where (p_member is null or t.member_id = p_member)
    on conflict (training_id, person_name) do update
       set assignment_id = coalesce(tp.assignment_id, excluded.assignment_id),
           due_date = case when tp.due_date is null then excluded.due_date
                           when excluded.due_date is null then tp.due_date
                           else least(tp.due_date, excluded.due_date) end,
           assigned_by = coalesce(tp.assigned_by, excluded.assigned_by),
           email = coalesce(tp.email, excluded.email),
           updated_at = now()
     where tp.status is distinct from 'done'
       and (tp.assignment_id is null
            or tp.due_date is distinct from (case when tp.due_date is null then excluded.due_date
                                                  when excluded.due_date is null then tp.due_date
                                                  else least(tp.due_date, excluded.due_date) end));
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;
  return v_n;
end $function$$m$,$m$revoke all on function public.academy_assign_apply(bigint, bigint) from public, anon, authenticated$m$,$m$create or replace function public.academy_assign(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_id bigint; v_aud text := coalesce(p ->> 'audience', ''); v_teams text[] := '{}'; v_people text[] := '{}'; v_due date;
        v_tid bigint := nullif(p ->> 'training_id', '')::bigint; v_path text := nullif(p ->> 'path_key', ''); v_new boolean := coalesce((p ->> 'include_new')::boolean, true);
        v_who text; v_email text := public.wa_email(); v_rows int; v_people_n int; v_what text; v_ids bigint[] := '{}';
begin
  if not public.wa169_can_assign() then raise exception 'Only HR, leaders and admins can assign trainings'; end if;
  if (v_tid is null) = (v_path is null) then raise exception 'Pick a training or a Learning Avenue'; end if;
  if v_tid is not null and not exists (select 1 from public.trainings t where t.id = v_tid and coalesce(t.active, true)) then raise exception 'That training is not in the Academy'; end if;
  if v_path is not null and not exists (select 1 from public.academy_paths ap where ap.key = v_path and ap.active) then raise exception 'That Learning Avenue is not in the Academy'; end if;
  if v_aud not in ('everyone', 'team', 'people') then raise exception 'Say who it is for'; end if;
  if v_aud = 'team' then
    select coalesce(array_agg(distinct x), '{}') into v_teams from jsonb_array_elements_text(coalesce(p -> 'teams', '[]'::jsonb)) x
     where exists (select 1 from public.team_members tm where tm.active and tm.department = x);
    if cardinality(v_teams) = 0 then raise exception 'Pick at least one team'; end if;
  end if;
  if v_aud = 'people' then
    select coalesce(array_agg(distinct lower(x)), '{}') into v_people from jsonb_array_elements_text(coalesce(p -> 'people', '[]'::jsonb)) x
     where exists (select 1 from public.team_members tm where tm.active and lower(tm.email) = lower(x));
    if cardinality(v_people) = 0 then raise exception 'Pick at least one person'; end if;
    v_new := false;
  end if;
  v_due := nullif(p ->> 'due_date', '')::date;
  if v_due is not null and v_due < current_date then raise exception 'The due date has passed'; end if;
  select tm.name into v_who from public.team_members tm where lower(tm.email) = v_email and tm.active limit 1;
  insert into public.academy_assignments (training_id, path_key, audience, teams, people, include_new, due_date, due_days, note, assigned_by, assigned_by_email)
  values (v_tid, v_path, v_aud, v_teams, v_people, v_new, v_due, case when v_due is null then null else v_due - current_date end,
          nullif(left(trim(coalesce(p ->> 'note', '')), 400), ''), coalesce(v_who, split_part(v_email, '@', 1)), v_email)
  returning id into v_id;
  if not v_new then
    select coalesce(array_agg(t.member_id), '{}') into v_ids from public.wa169_targets(v_id) t;
    update public.academy_assignments set member_ids = v_ids where id = v_id;
  end if;
  v_rows := public.academy_assign_apply(v_id, null);
  select count(*) into v_people_n from public.wa169_targets(v_id);
  select coalesce((select t.title from public.trainings t where t.id = v_tid), (select ap.title from public.academy_paths ap where ap.key = v_path)) into v_what;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('academy_assignment', v_id::text, 'assigned', null,
          v_what || ' to ' || case v_aud when 'everyone' then 'everyone' when 'team' then array_to_string(v_teams, ', ') else v_people_n || ' people' end
          || coalesce(', due ' || v_due::text, ''), coalesce(v_who, v_email));
  return jsonb_build_object('id', v_id, 'people', v_people_n, 'rows', v_rows);
end $function$$m$,$m$revoke all on function public.academy_assign(jsonb) from public, anon$m$,$m$grant execute on function public.academy_assign(jsonb) to authenticated$m$,$m$create or replace function public.academy_assign_end(p_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_who text; v_gone int; v_kept int;
begin
  if not public.wa169_can_assign() then raise exception 'Only HR, leaders and admins can change assignments'; end if;
  select coalesce((select tm.name from public.team_members tm where lower(tm.email) = public.wa_email() limit 1), public.wa_email()) into v_who;
  update public.academy_assignments set active = false, ended_at = now(), ended_by = v_who where id = p_id and active;
  if not found then raise exception 'That assignment is not running'; end if;
  delete from public.training_progress where assignment_id = p_id and status = 'assigned' and started_at is null and coalesce(pct, 0) = 0;
  get diagnostics v_gone = row_count;
  update public.training_progress set assignment_id = null, due_date = null where assignment_id = p_id;
  get diagnostics v_kept = row_count;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('academy_assignment', p_id::text, 'stopped', null, v_gone || ' not started removed, ' || v_kept || ' kept', v_who);
  return jsonb_build_object('removed', v_gone, 'kept', v_kept);
end $function$$m$,$m$revoke all on function public.academy_assign_end(bigint) from public, anon$m$,$m$grant execute on function public.academy_assign_end(bigint) to authenticated$m$,$m$create or replace function public.academy_assignments_list()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case when not public.wa169_can_assign() then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x.active desc, x.created_at desc) from (
      select a.id, a.training_id, a.path_key, a.audience, a.teams, a.people, a.include_new, a.due_date, a.note, a.assigned_by, a.created_at, a.active, a.ended_at, a.ended_by,
             coalesce((select t.title from public.trainings t where t.id = a.training_id), (select ap.title from public.academy_paths ap where ap.key = a.path_key)) as title,
             (select count(*) from public.wa169_modules(a.id))::int as modules,
             (select jsonb_agg(jsonb_build_object('name', t.name, 'department', t.department,
                       'done', s.done, 'total', s.total, 'started', s.started, 'due', s.due)
                     order by (s.done >= s.total and s.total > 0), t.name)
                from public.wa169_targets(a.id) t
                cross join lateral (
                  select count(distinct m.training_id) filter (where tp.status = 'done')::int as done,
                         (select count(*) from public.wa169_modules(a.id))::int as total,
                         (count(*) filter (where tp.status <> 'done' and (tp.started_at is not null or coalesce(tp.pct, 0) > 0)) > 0) as started,
                         min(tp.due_date) filter (where tp.status <> 'done') as due
                    from public.wa169_modules(a.id) m
                    left join public.training_progress tp on tp.training_id = m.training_id and (lower(tp.person_name) = lower(t.name) or lower(coalesce(tp.email, '')) = t.email)
                ) s) as people_state
        from public.academy_assignments a
       where a.active or a.ended_at > now() - interval '30 days'
    ) x), '[]'::jsonb) end;
$function$$m$,$m$revoke all on function public.academy_assignments_list() from public, anon$m$,$m$grant execute on function public.academy_assignments_list() to authenticated$m$,$m$drop policy if exists academy_assignments_read on public.academy_assignments$m$,$m$create policy academy_assignments_read on public.academy_assignments for select to authenticated
  using (public.wa169_can_assign()
         or audience = 'everyone'
         or (audience = 'team' and exists (select 1 from public.team_members tm where lower(tm.email) = public.wa_email() and tm.department = any (teams)))
         or (audience = 'people' and public.wa_email() = any (people)))$m$,$m$grant select on public.academy_assignments to authenticated$m$,$m$create or replace function public.wa169_member_assign()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.active and new.email is not null and (tg_op = 'INSERT' or old.active is distinct from new.active or old.department is distinct from new.department or old.email is distinct from new.email) then
    perform public.academy_assign_apply(null, new.id);
  end if;
  return new;
end $function$$m$,$m$revoke all on function public.wa169_member_assign() from public, anon, authenticated$m$,$m$drop trigger if exists trg_wa169_member_assign on public.team_members$m$,$m$create trigger trg_wa169_member_assign after insert or update of active, department, email on public.team_members
  for each row execute function public.wa169_member_assign()$m$,$m$select cron.unschedule('wa-academy-assign') where exists (select 1 from cron.job where jobname = 'wa-academy-assign')$m$,$m$select cron.schedule('wa-academy-assign', '18 10 * * *', $$select public.academy_assign_apply(null, null)$$)$m$,$m$select public.wa169_onb_avenue_sync()$m$,$m$comment on table public.academy_assignments is 'wave169: a training or a Learning Avenue assigned to everyone (the whole team, not the board), teams or people, from the HR centre or the Avenue Academy (academy_assign); include_new gives it to people who join later (trg_wa169_member_assign), due_days is their time to finish. The rows in training_progress carry it (assignment_id, due_date).'$m$,$m$comment on column public.training_progress.assignment_id is 'wave169: the assignment that put this training on the person''s list (academy_assignments.id); null for a person''s own start or an older one-to-one assignment.'$m$,$m$comment on column public.training_progress.due_date is 'wave169: when the assignment asks for it to be done (the earliest when two assignments ask).'$m$,$m$comment on function public.onboarding_journey_save(text, jsonb) is 'wave169: HR, leaders and admins set what people see for a week of the onboarding (title, photo from the Photo library, what they will learn, why it matters, the lesson that opens it) in app_config.onboarding_journey.'$m$,$m$comment on function public.academy_assign(jsonb) is 'wave169: assign a training or a Learning Avenue (HR, leaders and admins); writes the assignment and the people''s rows.'$m$,$m$comment on function public.academy_assign_end(bigint) is 'wave169: stop an assignment; rows nobody started are removed, started ones keep their progress.'$m$,$m$comment on function public.academy_assignments_list() is 'wave169: the assignments (running, and stopped in the last 30 days) with each person''s progress, for HR, leaders and admins.'$m$,$m$comment on function public.wa169_onb_avenue_sync() is 'wave169: the Learning Avenue Your onboarding is the master onboarding''s Academy modules, in the master''s order (trg_wa169_onb_avenue on onboarding_template).'$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
