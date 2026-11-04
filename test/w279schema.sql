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

-- 7. Task 1 (wa279a) needs nothing more. Later wave279 tasks add their sections below (policies, notification kinds, Academy assignments, the lead view).
