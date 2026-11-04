-- wave279: the slice of the live schema that build/wa279a_rules.sql and the wave279 assertions touch, for the offline proof in test/w279sql.mjs (PGlite).
-- Copied read-only from live (zwnmulmnvopclzcvytce) on 04/11/26: column lists, constraints, triggers and pg_get_functiondef bodies. No foreign keys to tables outside
-- this slice, no data except a few generic template rows. Not a copy of live: do not apply it anywhere but the offline PGlite database.
-- Organised in sections. A wave279 task that needs more of live adds its own section at the end (marked "Task n"), so earlier sections stay as they are.

-- 1. roles and the Supabase defaults for new objects in public (tables and functions are open to the API roles until revoked)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;


-- 2. the auth helpers (claims come from the request.jwt.claims setting) and the pg_cron / pg_net stand-ins PGlite lacks
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as
$$ select nullif(auth.jwt() ->> 'role', '') $$;
grant execute on function auth.jwt(), auth.role() to anon, authenticated, service_role;
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid into v_id;
  return v_id;
end $$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin
  delete from cron.job where jobname = job_name;
  if not found then raise exception 'could not find valid entry for job ''%''', job_name; end if;
  return true;
end $$;
create table public.w279_edge_calls (id bigserial primary key, fn text, payload jsonb);
create function public.call_edge(fn text, payload jsonb) returns bigint language plpgsql security definer set search_path to '' as $$
declare v_id bigint;
begin insert into public.w279_edge_calls (fn, payload) values (fn, payload) returning id into v_id; return v_id; end $$;
revoke all on function public.call_edge(text, jsonb) from public, anon, authenticated;

-- 3. tables (live columns; foreign keys only to tables inside this slice)
create table public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

create table public.change_log (
  id bigint generated always as identity primary key,
  entity_type text,
  entity_id text,
  field text,
  old_value text,
  new_value text,
  changed_by text,
  changed_at timestamptz not null default now(),
  board_only boolean not null default false,
  visibility text check (visibility is null or visibility = any (array['', 'department', 'leadership', 'private', 'speakers'])),
  allowed_people jsonb
);

create table public.hub_roles (
  email text primary key,
  role text not null default 'member' check (role = any (array['admin', 'leader', 'member', 'viewer', 'blocked'])),
  tabs jsonb,
  note text,
  updated_by text,
  updated_at timestamptz default now(),
  profile text   -- live: foreign key to hub_access_profiles(key)
);

create table public.wa_hr_access (
  email text primary key
);

create table public.team_members (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  department text,
  role text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  start_date date,
  start_source text,
  position_id bigint   -- live: foreign key to hub_positions(id)
);
create table public.hub_candidates (   -- only the columns wa271_move_start writes
  id bigserial primary key,
  name text not null,
  start_date date,
  member_id bigint references public.team_members (id) on delete set null
);

create table public.onboarding_template (
  id text primary key,
  section text not null,
  parent_id text references public.onboarding_template (id),
  name text not null,
  description text,
  sort integer not null default 0,
  priority text,
  active boolean not null default true,
  content_pending boolean not null default false,
  clickup_url text,
  updated_at timestamptz default now(),
  academy_path text,
  training_id bigint   -- live: foreign key to trainings(id)
);

create table public.onboardings (
  id bigint generated always as identity primary key,
  member_id bigint references public.team_members (id),
  person_name text not null,
  status text not null default 'active',
  started_at date not null default current_date,
  assigned_by text,
  completed_at timestamptz,
  note text
);

create table public.onboarding_steps (
  id bigint generated always as identity primary key,
  onboarding_id bigint not null references public.onboardings (id) on delete cascade,
  template_id text not null references public.onboarding_template (id),
  done boolean not null default false,
  done_at timestamptz,
  done_by text,
  due_date date,
  unique (onboarding_id, template_id)
);

create table public.hr_setup_template (
  id text primary key,
  phase text not null,
  name text not null,
  description text,
  sort integer not null default 0,
  active boolean not null default true,
  who text not null default 'hr' check (who = any (array['hr', 'lead'])),
  due_day integer
);

create table public.hr_setup_steps (
  id bigint generated always as identity primary key,
  onboarding_id bigint not null references public.onboardings (id) on delete cascade,
  template_id text not null references public.hr_setup_template (id),
  done boolean not null default false,
  done_at timestamptz,
  done_by text,
  unique (onboarding_id, template_id)
);

create table public.hub_onboard_flows (
  id bigserial primary key,
  candidate_id bigint not null unique references public.hub_candidates (id),
  practice boolean not null default false,
  status text not null default 'waiting' check (status = any (array['offered', 'waiting', 'ready', 'running', 'started', 'backed_out'])),
  manager_member_id bigint,
  wa_email text,
  call_at timestamptz,
  one_on_one_at timestamptz,
  group_session text,
  call_event_id text,
  one_on_one_event_id text,
  onboarding_id bigint,   -- live: no foreign key
  slack_channel_id text,
  slack_user_id text,
  welcome_subject text,
  welcome_text text,
  pw_nonce text,
  pw_expires_at timestamptz,
  pw_used_at timestamptz,
  reminded_hire_at timestamptz,
  reminded_manager_at timestamptz,
  started_by text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  roster_created boolean,
  canva_link text,
  welcome_edited boolean,
  manager_link_member_id bigint,
  manager_link_sent_at timestamptz,
  proposed_call_at timestamptz,
  proposed_one_on_one_at timestamptz,
  proposed_by text,
  proposed_at timestamptz,
  hire_answer text check (hire_answer is null or hire_answer = any (array['yes', 'no'])),
  hire_answered_at timestamptz,
  setup_ticks jsonb not null default '{}'::jsonb,
  welcome_sent_at timestamptz,
  accounts_at timestamptz,
  ask_availability boolean not null default false,
  leader boolean,
  welcome_cc text[] not null default '{}'::text[]
);

create table public.trainings (
  id bigserial primary key,
  category text not null,
  title text not null,
  description text,
  resource_url text,
  source text default 'loom',
  ext_id text,
  duration_sec integer,
  path_group text,
  sort integer default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  kind text,
  key text,
  body jsonb,
  minutes integer,
  xp integer,
  updated_at timestamptz default now()
);
alter table public.onboarding_template add constraint onboarding_template_training_id_fkey foreign key (training_id) references public.trainings (id);
create table public.training_progress (
  id bigserial primary key,
  training_id bigint references public.trainings (id),
  person_name text not null,
  status text not null default 'assigned',
  assigned_by text,
  note text,
  done_at timestamptz,
  updated_at timestamptz default now(),
  email text,
  started_at timestamptz,
  pct integer,
  last_step integer,
  score integer,
  seconds integer,
  data jsonb,
  assignment_id bigint,   -- live: foreign key to academy_assignments(id), added with Task 3
  due_date date
);
create table public.academy_paths (
  key text primary key,
  name text not null,
  title text not null,
  blurb text,
  dept text,
  required boolean not null default false,
  cert_title text,
  color text,
  icon text,
  sort integer not null default 100,
  active boolean not null default true,
  updated_at timestamptz default now()
);

-- 4. functions: the helpers (live bodies)
create or replace function public.is_hub_admin()
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1 from public.hub_roles
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and role = 'admin'
  )
$function$;

create or replace function public.wa_is_hr()
returns boolean language sql stable security definer set search_path to 'public' as $function$ select exists (select 1 from wa_hr_access where email = lower(coalesce(auth.jwt() ->> 'email', ''))) $function$;

create or replace function public.is_wa_staff()
returns boolean language sql stable security definer set search_path to '' as $function$
  select case
    when lower(coalesce(auth.jwt()->>'email','')) = '' then false
    when exists (select 1 from public.hub_roles r
                 where r.email = lower(coalesce(auth.jwt()->>'email','')) and r.role = 'blocked') then false
    when exists (select 1 from public.hub_roles r
                 where r.email = lower(coalesce(auth.jwt()->>'email',''))
                   and r.role in ('admin','leader','member','viewer')) then true
    else coalesce(lower(auth.jwt()->>'email') like '%@welfareavenue.com', false)
  end;
$function$;
revoke all on function public.is_wa_staff() from public, anon;   -- live: postgres, authenticated, service_role
create or replace function public.is_wa_admin()
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_roles r where r.email = lower(coalesce(auth.jwt()->>'email', '')) and r.role = 'admin');
$function$;
create or replace function public.wa271_can()
returns boolean language sql stable security definer set search_path to '' as $function$
  select coalesce(auth.role(), '') = 'service_role' or public.wa_is_hr() or public.is_hub_admin()
$function$;
revoke all on function public.wa271_can() from public, anon, authenticated;   -- live: postgres, service_role

-- 5. functions: the onboarding plan (live bodies, pg_get_functiondef 04/11/26) and their triggers
create or replace function public.onb_due(p_section text, p_start date)
returns date language sql immutable set search_path to 'public' as $function$
  select p_start + (case
    when upper(coalesce(p_section, '')) ~ '^WEEK\s+[0-9]+$' then 7 * (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    when upper(coalesce(p_section, '')) ~ '^[0-9]+\s+DAYS?$' then (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    when upper(coalesce(p_section, '')) ~ '^[0-9]+\s+MONTHS?$' then 30 * (regexp_replace(p_section, '[^0-9]', '', 'g'))::int
    else 90 end)
$function$;

create or replace function public.wa166_training_done(p_member bigint, p_training bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.training_progress tp join public.team_members tm on tm.id = p_member
                 where tp.training_id = p_training and tp.status = 'done'
                   and (lower(tp.person_name) = lower(tm.name) or (tm.email is not null and lower(coalesce(tp.email, '')) = lower(tm.email))));
$function$;
revoke all on function public.wa166_training_done(bigint, bigint) from public, anon, authenticated;   -- live: postgres, service_role

create or replace function public.wa166_path_state(p_member bigint, p_key text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  with me as (select tm.name, tm.email, tm.department from public.team_members tm where tm.id = p_member),
  st as (
    select p.key, p.title, p.dept, coalesce(p.required, false) as required, p.sort,
      (select count(*) from public.trainings t
        where t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour' and not coalesce((t.body ->> 'planned')::boolean, false))::int as total,
      (select count(distinct t.id) from public.trainings t join public.training_progress tp on tp.training_id = t.id cross join me
        where t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour' and not coalesce((t.body ->> 'planned')::boolean, false)
          and tp.status = 'done'
          and (lower(tp.person_name) = lower(me.name) or (me.email is not null and lower(coalesce(tp.email, '')) = lower(me.email))))::int as done
    from public.academy_paths p where p.active
  ),
  s2 as (select st.*, (st.total > 0 and st.done >= st.total) as complete,
                case when st.total > 0 then least(st.done, st.total)::numeric / st.total else 0 end as ratio from st),
  elig as (select * from s2 where not s2.required and s2.key not in ('tours', 'firstweek', 'keela')),
  team as (select e.* from elig e, me where e.dept is not null and e.dept = me.department),
  team_pick as (
    select x.* from (select * from team union all select * from elig where not exists (select 1 from team)) x
    order by x.complete desc, x.ratio desc, x.sort nulls last, x.key limit 1
  ),
  cand as (
    select * from s2 where p_key not in ('team', 'any') and s2.key = p_key
    union all select * from team_pick where p_key = 'team'
    union all select e.* from elig e where p_key = 'any' and not exists (select 1 from team_pick tp where tp.complete and tp.key = e.key)
  )
  select coalesce(
    (select jsonb_build_object('key', c.key, 'title', c.title, 'done', least(c.done, c.total), 'total', c.total, 'complete', c.complete, 'asked', p_key)
       from cand c order by c.complete desc, c.ratio desc, c.sort nulls last, c.key limit 1),
    jsonb_build_object('key', p_key, 'title', null, 'done', 0, 'total', 0, 'complete', false, 'asked', p_key));
$function$;
revoke all on function public.wa166_path_state(bigint, text) from public, anon, authenticated;   -- live: postgres, service_role

create or replace function public.wa166_onb_sync(p_onb bigint)
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_member bigint; v_n int := 0; r record; v_ok boolean;
begin
  select o.member_id into v_member from public.onboardings o where o.id = p_onb and o.status = 'active';
  if v_member is null then return 0; end if;
  for r in select s.id, t.academy_path, t.training_id
             from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
            where s.onboarding_id = p_onb and not coalesce(s.done, false) and t.active and (t.academy_path is not null or t.training_id is not null) loop
    v_ok := case when r.training_id is not null then public.wa166_training_done(v_member, r.training_id)
                 else coalesce((public.wa166_path_state(v_member, r.academy_path) ->> 'complete')::boolean, false) end;
    if v_ok then
      update public.onboarding_steps set done = true, done_at = now(), done_by = 'Avenue Academy' where id = r.id and not coalesce(done, false);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;   -- the plan completes itself when its last step is ticked (trg_wa166_onb_done)
end $function$;
revoke all on function public.wa166_onb_sync(bigint) from public, anon, authenticated;   -- live: postgres, service_role

create or replace function public.wa166_onb_done()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.done is distinct from old.done then
    if coalesce(new.done, false) then
      if not exists (select 1 from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
                      where s.onboarding_id = new.onboarding_id and t.active and not coalesce(s.done, false)) then
        update public.onboardings set status = 'completed', completed_at = now() where id = new.onboarding_id and status = 'active';
      end if;
    else
      update public.onboardings set status = 'active', completed_at = null where id = new.onboarding_id and status = 'completed';
    end if;
  end if;
  return new;
end $function$;
create trigger trg_wa166_onb_done after update of done on public.onboarding_steps
  for each row execute function public.wa166_onb_done();

create or replace function public.onboarding_template_propagate()
returns trigger language plpgsql security definer set search_path to '' as $function$
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
revoke all on function public.onboarding_template_propagate() from public, anon, authenticated;   -- live: postgres, service_role
comment on function public.onboarding_template_propagate() is 'Trigger on onboarding_template: adds new or re-activated steps to active onboarding plans and removes deactivated ones.';
create trigger trg_onb_tmpl_propagate after insert or update on public.onboarding_template
  for each row execute function public.onboarding_template_propagate();

create or replace function public.onboarding_assign(p_member_id bigint, p_by text, p_start date default current_date)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_name text; v_start date := coalesce(p_start, current_date);   -- wave271: was current_date
begin
  if not public.is_wa_staff() then raise exception 'Only staff can start an onboarding plan'; end if;   -- audit 26/09/26
  select name into v_name from public.team_members where id = p_member_id;
  if v_name is null then raise exception 'member not found'; end if;
  insert into public.onboardings (member_id, person_name, assigned_by, started_at)
  values (p_member_id, v_name, p_by, v_start) returning id into v_id;
  insert into public.onboarding_steps (onboarding_id, template_id, due_date)
  select v_id, t.id, public.onb_due(t.section, v_start) from public.onboarding_template t where t.active on conflict do nothing;
  insert into public.hr_setup_steps (onboarding_id, template_id)
  select v_id, t.id from public.hr_setup_template t where t.active on conflict do nothing;
  perform public.wa166_onb_sync(v_id);   -- wave166: what they already did in the Avenue Academy is ticked
  return v_id;
end $function$;
revoke all on function public.onboarding_assign(bigint, text, date) from public, anon;   -- live: postgres, authenticated, service_role

create or replace function public.wa271_move_start(p_onboarding bigint, p_new date)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_member bigint; v_old date;
begin
  if not public.wa271_can() then raise exception 'Only HR can move a start date'; end if;
  if p_new is null then raise exception 'A new start date is needed'; end if;
  select member_id, started_at into v_member, v_old from public.onboardings where id = p_onboarding for update;
  if not found then raise exception 'Onboarding % not found', p_onboarding; end if;
  update public.onboardings set started_at = p_new where id = p_onboarding;
  update public.onboarding_steps s set due_date = public.onb_due(t.section, p_new)
    from public.onboarding_template t where s.onboarding_id = p_onboarding and t.id = s.template_id and not s.done;
  if v_member is not null then
    update public.team_members set start_date = p_new, start_source = 'manual' where id = v_member;   -- manual: directory-sync leaves it alone
  end if;
  update public.hub_candidates c set start_date = p_new from public.hub_onboard_flows f where f.onboarding_id = p_onboarding and c.id = f.candidate_id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('onboardings', p_onboarding::text, 'started_at', v_old::text, p_new::text, coalesce(nullif(auth.jwt() ->> 'email', ''), 'wave271'));
end $function$;
revoke all on function public.wa271_move_start(bigint, date) from public, anon;   -- live: postgres, authenticated, service_role

-- 6. generic rows (what live has, without the wording): one template step per due-date shape, and one HR step
insert into public.onboarding_template (id, section, name) values
  ('t-w1', 'WEEK 1', 'Test step in week 1'),
  ('t-w2', 'WEEK 2', 'Test step in week 2'),
  ('t-d30', '30 DAYS', 'Test step at 30 days');
insert into public.hr_setup_template (id, phase, name, sort, who, due_day) values
  ('h-before', 'Before day one', 'Test step before day one', 1, 'hr', 0);

-- 7. Task 1 (wa279a) needed nothing more.

-- 8. Task 2 (wa279a, part 2): role picks. Academy assignments, the org chart, and the live comment on wa166_path_state (copied read-only from live 04/11/26).
comment on function public.wa166_path_state(bigint, text) is 'wave166: how far a person (team_members.id) is in a Learning Avenue: {key, title, done, total, complete, asked}. ''team'': the avenue of their team they are furthest in (any avenue besides the three everyone does when their team has none); ''any'': an avenue besides the three everyone does and besides the one that counted for ''team''. Keela, page tours, Your first week and planned trainings do not count there.';
alter table public.training_progress add constraint training_progress_training_id_person_name_key unique (training_id, person_name);

create table public.org_positions (   -- the columns the lead order reads
  id bigint generated always as identity primary key,
  member_id bigint references public.team_members (id),
  title text,
  department text,
  reports_to bigint references public.org_positions (id)
);

create table public.academy_assignments (
  id bigint generated always as identity primary key,
  training_id bigint references public.trainings (id) on delete cascade,
  path_key text references public.academy_paths (key) on update cascade on delete cascade,
  audience text not null check (audience = any (array['everyone', 'team', 'people'])),
  teams text[] not null default '{}'::text[],
  people text[] not null default '{}'::text[],
  member_ids bigint[] not null default '{}'::bigint[],
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
create index idx_academy_assignments_active on public.academy_assignments (active);
alter table public.academy_assignments enable row level security;
alter table public.training_progress add constraint training_progress_assignment_id_fkey foreign key (assignment_id) references public.academy_assignments (id) on delete set null;

create or replace function public.wa_email()
returns text language sql stable security definer set search_path to '' as $function$ select lower(coalesce(auth.jwt()->>'email','')) $function$;
create or replace function public.is_hub_leader()
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_roles r
                 where r.email = lower(coalesce(auth.jwt()->>'email','')) and r.role in ('admin','leader'));
$function$;
create or replace function public.wa169_can_assign()
returns boolean language sql stable security definer set search_path to '' as $function$
  select public.is_hub_leader()
      or exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role <> 'blocked' and r.profile = 'hr');
$function$;
revoke all on function public.wa169_can_assign() from public, anon;   -- live: postgres, authenticated, service_role

create or replace function public.wa169_targets(p_id bigint)
returns table(member_id bigint, name text, email text, department text)
language sql stable security definer set search_path to '' as $function$
  select tm.id, tm.name, lower(tm.email), tm.department
    from public.academy_assignments a
    join public.team_members tm on tm.active and tm.email is not null and tm.name is not null
   where a.id = p_id
     and (case when not a.include_new and cardinality(a.member_ids) > 0 then tm.id = any (a.member_ids)
               when a.audience = 'everyone' then coalesce(tm.department, '') <> 'board'
               when a.audience = 'team' then tm.department = any (a.teams)
               else lower(tm.email) = any (a.people) end);
$function$;
revoke all on function public.wa169_targets(bigint) from public, anon, authenticated;   -- live: postgres, service_role

create or replace function public.wa169_modules(p_id bigint)
returns table(training_id bigint)
language sql stable security definer set search_path to '' as $function$
  select a.training_id from public.academy_assignments a where a.id = p_id and a.training_id is not null
  union
  select t.id from public.academy_assignments a join public.academy_paths p on p.key = a.path_key
    join public.trainings t on t.path_group = p.name and coalesce(t.active, true) and coalesce(t.kind, '') <> 'tour'
                           and not coalesce((t.body ->> 'planned')::boolean, false)
   where a.id = p_id and a.path_key is not null;
$function$;
revoke all on function public.wa169_modules(bigint) from public, anon, authenticated;   -- live: postgres, service_role

create or replace function public.academy_assign_apply(p_id bigint default null::bigint, p_member bigint default null::bigint)
returns integer language plpgsql security definer set search_path to '' as $function$
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
revoke all on function public.academy_assign_apply(bigint, bigint) from public, anon, authenticated;   -- live: postgres, service_role

-- the two live entry points, read-only copies. Their permission check is wa169_can_assign (leaders, admins, the HR access profile): a plain manager fails it, which is why wave279 writes the assignment itself.
create or replace function public.academy_assign(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
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
revoke all on function public.academy_assign(jsonb) from public, anon;   -- live: postgres, authenticated, service_role

create or replace function public.academy_assign_end(p_id bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
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
revoke all on function public.academy_assign_end(bigint) from public, anon;   -- live: postgres, authenticated, service_role

create or replace function public.wa166_tp_onb()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    perform public.wa166_onb_sync(o.id)
       from public.onboardings o join public.team_members tm on tm.id = o.member_id
      where o.status = 'active'
        and (lower(tm.name) = lower(new.person_name) or (new.email is not null and tm.email is not null and lower(tm.email) = lower(new.email)));
  end if;
  return new;
end $function$;
create trigger trg_wa166_tp_onb after insert or update of status on public.training_progress
  for each row execute function public.wa166_tp_onb();

-- 9. Task 3 (wa279a, part 3): the policy tables (columns, constraints, RLS policies and ACLs copied read-only from live 04/11/26; no triggers live on either).
--    is_board_viewer() is a stand-in (live looks at the board viewer list); the sign-off rule only needs the insert policy.
create or replace function public.is_board_viewer() returns boolean language sql stable as $$ select false $$;
create table public.wa_policies (
  key text primary key,
  title text not null,
  url text not null,
  required boolean not null default true,
  active boolean not null default true,
  sort integer not null default 100
);
create table public.wa_policy_signoffs (
  id bigint generated always as identity primary key,
  email text not null,
  name text not null,
  policy_key text not null references public.wa_policies (key),
  signed_at timestamptz not null default now(),
  unique (email, policy_key)
);
create index idx_wa_policy_signoffs_policy_key on public.wa_policy_signoffs (policy_key);
alter table public.wa_policies enable row level security;
alter table public.wa_policy_signoffs enable row level security;
create policy policies_hr_write on public.wa_policies for all to authenticated using (public.wa_is_hr()) with check (public.wa_is_hr());
create policy policies_read on public.wa_policies for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_viewer()));
create policy signoff_own_insert on public.wa_policy_signoffs for insert to authenticated with check (email = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy signoff_read on public.wa_policy_signoffs for select to authenticated using (email = lower(coalesce(auth.jwt() ->> 'email', '')) or public.wa_is_hr());
revoke all on public.wa_policies, public.wa_policy_signoffs from anon;   -- live: postgres, authenticated, service_role
