-- Welfare Avenue Hub: wave276, Task 1, 02/11/26. Team availability: every team member keeps a typical week of when they can meet, and each team's
-- Agenda tab shows the overlay so a manager can propose a meeting time. This file is the database part: two tables, who-can predicates, the RPCs the
-- page calls, the grid settings, the term asks and two notification kinds. All reads and writes go through the RPCs, so the page never works out
-- "which grid is current" or "who manages" by itself.
-- Plan: docs/superpowers/plans/2026-11-02-team-availability.md (Task 1). Spec: docs/superpowers/specs/2026-11-02-team-availability-design.md.
-- Proved offline first: node test/w276sql.mjs (PGlite). Safe to run twice. Nothing here sends anything.
-- A slot is weekday * 1440 + minute of the day (weekday 0 = Monday, Toronto wall time); a grid is a list of the slots a person is free.
-- Undo: build/wa276_undo.sql

-- 1. the grid settings (kept if an admin already changed them)
insert into public.app_config (key, value) values
  ('avail_min_hours', '10'),
  ('avail_grid_start', '480'),
  ('avail_grid_end', '1320'),
  ('avail_cell_min', '30')
on conflict (key) do nothing;

-- 2. each person's typical week, per team and per start date
create table if not exists public.hub_team_avail (
  id bigserial primary key,
  email text not null,
  department text not null,
  effective_from date not null default current_date,
  slots smallint[] not null default '{}',
  hours numeric not null default 0,
  snoozed_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (email, department, effective_from)
);
create index if not exists hub_team_avail_dept_idx on public.hub_team_avail (department, effective_from);
comment on table public.hub_team_avail is 'wave276: when each team member is usually free to meet, one row per person, team and start date. Written only through wa_avail_save and wa_avail_snooze. The current grid is the newest row whose effective_from is today or earlier; a row with a later date waits for its day. A person reads their own rows and the rows of a team they are on or manage.';
comment on column public.hub_team_avail.id is 'Row id.';
comment on column public.hub_team_avail.email is 'Whose week this is: their sign-in email in lower case (wa_email() at save time).';
comment on column public.hub_team_avail.department is 'Team code (dept_meta.department). A person on two teams keeps one grid for each.';
comment on column public.hub_team_avail.effective_from is 'The first day this week applies, for example the first day of term. The newest row on or before today is the current one.';
comment on column public.hub_team_avail.slots is 'The free cells, each the start of a cell as weekday * 1440 + minute of the day (weekday 0 = Monday, Toronto wall time), sorted with no repeats. Cells are avail_cell_min minutes long.';
comment on column public.hub_team_avail.hours is 'Hours free in the week: the number of slots times avail_cell_min, over 60, worked out when the grid is saved.';
comment on column public.hub_team_avail.snoozed_until is 'Set by Ask me later (3 days from then). While it is in the future the Home pop-up does not ask again. Saving clears it.';
comment on column public.hub_team_avail.created_at is 'When the row was first written.';
comment on column public.hub_team_avail.updated_at is 'When the person last saved this grid. Null on a row that only holds an Ask me later from someone who never saved: that is not an answer.';
comment on index public.hub_team_avail_dept_idx is 'wave276: finds a team''s grids for the team view.';

-- 3. when a team asks for everyone's week again (start of term, or a manager pressing Ask the team)
create table if not exists public.hub_team_avail_ask (
  id bigserial primary key,
  department text not null,
  ask_date date not null,
  set_by text,
  note text,
  created_at timestamptz default now()
);
create index if not exists hub_team_avail_ask_dept_idx on public.hub_team_avail_ask (department, ask_date);
comment on table public.hub_team_avail_ask is 'wave276: the dates a team asks everyone for their typical week again. On and after an ask date, a member whose grid was last saved before it sees the Home pop-up. Seeded with the term starts; a manager adds one through wa_avail_ask_set. Staff read it; nobody writes it from the browser.';
comment on column public.hub_team_avail_ask.id is 'Row id.';
comment on column public.hub_team_avail_ask.department is 'Team code (dept_meta.department).';
comment on column public.hub_team_avail_ask.ask_date is 'The day the ask starts. Only asks on or before today count.';
comment on column public.hub_team_avail_ask.set_by is 'Who set it: the manager''s email, or wave276 for the term dates seeded with the wave.';
comment on column public.hub_team_avail_ask.note is 'A short reason the manager typed, for example term. May be empty.';
comment on column public.hub_team_avail_ask.created_at is 'When the ask was written.';
comment on index public.hub_team_avail_ask_dept_idx is 'wave276: finds the latest ask for a team.';

-- 4. a grid setting as a number (internal; the page reads app_config itself)
create or replace function public.wa_avail_setting(p_key text) returns numeric
language sql stable security definer set search_path to '' as $$
  select coalesce((select nullif(trim(c.value), '')::numeric from public.app_config c where c.key = p_key),
                  case p_key when 'avail_min_hours' then 10 when 'avail_grid_start' then 480 when 'avail_grid_end' then 1320 when 'avail_cell_min' then 30 end)
$$;
revoke all on function public.wa_avail_setting(text) from public, anon, authenticated;
grant execute on function public.wa_avail_setting(text) to service_role;
comment on function public.wa_avail_setting(text) is 'wave276: an avail_ setting from app_config as a number, with the wave''s default (10 hours, 480, 1320, 30 minutes) when it is missing. Used inside the wa_avail_ functions only.';

-- 5. who manages a team: an admin, HR, any leader of the team, or the person the team's seats report to on the org chart
create or replace function public.wa_avail_can_manage(p_dept text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(p_dept, '') <> '' and (
    public.is_hub_admin() or public.wa_is_hr() or public.wa_leads_team(p_dept)
    or exists (select 1 from public.org_positions o
                 join public.org_positions b on b.id = o.reports_to
                 join public.team_members m on m.id = b.member_id
                 join public.team_members s on s.id = o.member_id
                where lower(m.email) = any (public.my_emails()) and s.department = p_dept))
$$;
revoke all on function public.wa_avail_can_manage(text) from public, anon;
grant execute on function public.wa_avail_can_manage(text) to authenticated, service_role;
comment on function public.wa_avail_can_manage(text) is 'wave276: true when the signed-in person manages the team: an admin, HR, any leader of the team (wa_leads_team), or the person a team member''s seat reports to in org_positions. Managers see who has not entered a week, ask the team again and propose meeting times.';

create or replace function public.wa_avail_can_see(p_dept text) returns boolean
language sql stable security definer set search_path to '' as $$
  select public.wa_in_team(p_dept) or public.wa_avail_can_manage(p_dept)
$$;
revoke all on function public.wa_avail_can_see(text) from public, anon;
grant execute on function public.wa_avail_can_see(text) to authenticated, service_role;
comment on function public.wa_avail_can_see(text) is 'wave276: true when the signed-in person may see the team''s availability: they are on the team (wa_in_team) or manage it (wa_avail_can_manage).';

create or replace function public.wa_avail_manager_of(p_email text, p_dept text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(p_dept, '') <> '' and coalesce(p_email, '') <> '' and (
    exists (select 1 from public.hub_roles r where r.email = lower(p_email) and r.role = 'admin')
    or exists (select 1 from public.wa_hr_access h where h.email = lower(p_email))
    or exists (select 1 from public.hub_roles r
                where r.email = lower(p_email) and r.role = 'leader'
                  and (r.profile = p_dept or exists (select 1 from public.team_members t
                                                      where lower(t.email) = lower(p_email) and t.department = p_dept and coalesce(t.active, true))))
    or exists (select 1 from public.org_positions o
                 join public.org_positions b on b.id = o.reports_to
                 join public.team_members m on m.id = b.member_id
                 join public.team_members s on s.id = o.member_id
                where lower(m.email) = lower(p_email) and s.department = p_dept))
$$;
revoke all on function public.wa_avail_manager_of(text, text) from public, anon, authenticated;
grant execute on function public.wa_avail_manager_of(text, text) to service_role;
comment on function public.wa_avail_manager_of(text, text) is 'wave276: the wa_avail_can_manage rule for any email (admin, HR, a leader of the team, or the person the team''s seats report to). The notify function calls it with the service key before it lets someone message the whole team; the browser cannot call it.';

-- 6. the signed-in person: which of their teams want their week, their current grid, save, and Ask me later
create or replace function public.wa_avail_due()
returns table (department text, ask_date date, last_saved timestamptz)
language sql stable security definer set search_path to '' as $$
  select t.dept, a.ask_date, s.last_saved
    from unnest(public.wa180_my_teams()) t(dept)
    left join lateral (select max(k.ask_date) as ask_date from public.hub_team_avail_ask k
                        where k.department = t.dept and k.ask_date <= current_date) a on true
    left join lateral (select max(h.updated_at) as last_saved, max(h.snoozed_until) as snoozed
                         from public.hub_team_avail h
                        where h.department = t.dept and lower(h.email) = any (public.my_emails())) s on true
   where (s.snoozed is null or s.snoozed <= now())
     and (s.last_saved is null or (a.ask_date is not null and s.last_saved < a.ask_date))
   order by t.dept
$$;
revoke all on function public.wa_avail_due() from public, anon;
grant execute on function public.wa_avail_due() to authenticated, service_role;
comment on function public.wa_avail_due() is 'wave276: the signed-in person''s teams that want their typical week now, one row each: never saved for that team (even if the team has no ask yet), or last saved before the latest ask dated today or earlier; and no Ask me later still running. ask_date is that latest ask (null if none) and last_saved their last save (null if never). The Home pop-up opens for the first row.';

create or replace function public.wa_avail_mine(p_dept text) returns jsonb
language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', h.id, 'effective_from', h.effective_from, 'slots', to_jsonb(h.slots), 'hours', h.hours,
                            'updated_at', h.updated_at, 'snoozed_until', h.snoozed_until)
    from public.hub_team_avail h
   where h.department = p_dept and lower(h.email) = any (public.my_emails()) and h.effective_from <= current_date
   order by (h.updated_at is not null) desc, h.effective_from desc, h.id desc
   limit 1
$$;
revoke all on function public.wa_avail_mine(text) from public, anon;
grant execute on function public.wa_avail_mine(text) to authenticated, service_role;
comment on function public.wa_avail_mine(text) is 'wave276: the signed-in person''s current grid for a team as {id, effective_from, slots, hours, updated_at, snoozed_until}: the newest saved row dated today or earlier (a row dated later waits for its day). Null when there is none.';

create or replace function public.wa_avail_save(p_dept text, p_from date, p_slots smallint[]) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_email text := public.wa_email();
  v_slots smallint[];
  v_hours numeric;
  v_id bigint;
begin
  if coalesce(v_email, '') = '' then raise exception 'Sign in to save your availability'; end if;
  if p_dept is null or not (p_dept = any (public.wa180_my_teams())) then
    raise exception 'You can only save availability for a team you are on (%)', coalesce(p_dept, 'no team');
  end if;
  if exists (select 1 from unnest(coalesce(p_slots, '{}'::smallint[])) s where s is null or s < 0 or s >= 7 * 1440) then
    raise exception 'A slot is outside the week';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}'::smallint[]) into v_slots from unnest(coalesce(p_slots, '{}'::smallint[])) s;
  v_hours := trim_scale(round(cardinality(v_slots) * public.wa_avail_setting('avail_cell_min') / 60.0, 2));
  insert into public.hub_team_avail as h (email, department, effective_from, slots, hours, snoozed_until, updated_at)
  values (v_email, p_dept, coalesce(p_from, current_date), v_slots, v_hours, null, now())
  on conflict (email, department, effective_from) do update
    set slots = excluded.slots, hours = excluded.hours, snoozed_until = null, updated_at = now()
  returning h.id into v_id;
  update public.hub_team_avail h set snoozed_until = null
   where h.department = p_dept and lower(h.email) = any (public.my_emails()) and h.snoozed_until is not null;
  return jsonb_build_object('id', v_id, 'hours', v_hours, 'min_hours', public.wa_avail_setting('avail_min_hours'));
end $$;
revoke all on function public.wa_avail_save(text, date, smallint[]) from public, anon;
grant execute on function public.wa_avail_save(text, date, smallint[]) to authenticated, service_role;
comment on function public.wa_avail_save(text, date, smallint[]) is 'wave276: saves the signed-in person''s typical week for one of their teams from a date (today when empty). Same person, team and date: the row is replaced. Hours = number of slots times avail_cell_min over 60. Clears any Ask me later. Returns {id, hours, min_hours}; under min_hours the page shows its note but the grid is saved anyway. Refuses a team the person is not on.';

create or replace function public.wa_avail_snooze(p_dept text) returns void
language plpgsql security definer set search_path to '' as $$
declare
  v_email text := public.wa_email();
begin
  if coalesce(v_email, '') = '' then raise exception 'Sign in first'; end if;
  if p_dept is null or not (p_dept = any (public.wa180_my_teams())) then
    raise exception 'You can only answer for a team you are on (%)', coalesce(p_dept, 'no team');
  end if;
  update public.hub_team_avail h set snoozed_until = now() + interval '3 days'
   where h.id = (select x.id from public.hub_team_avail x
                  where x.department = p_dept and lower(x.email) = any (public.my_emails())
                  order by x.effective_from desc, x.id desc limit 1);
  if not found then
    insert into public.hub_team_avail (email, department, effective_from, slots, hours, snoozed_until, updated_at)
    values (v_email, p_dept, current_date, '{}', 0, now() + interval '3 days', null);
  end if;
end $$;
revoke all on function public.wa_avail_snooze(text) from public, anon;
grant execute on function public.wa_avail_snooze(text) to authenticated, service_role;
comment on function public.wa_avail_snooze(text) is 'wave276: Ask me later. The Home pop-up stays away for 3 days for that team. Sets snoozed_until on the person''s newest row, or adds an empty row (with no save time, so it is not an answer) if they have none. Refuses a team the person is not on.';

-- 7. the team view and the manager's ask
create or replace function public.wa_avail_team(p_dept text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare
  v_cell int := public.wa_avail_setting('avail_cell_min')::int;
  v_start int := public.wa_avail_setting('avail_grid_start')::int;
  v_end int := public.wa_avail_setting('avail_grid_end')::int;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v jsonb;
begin
  if not public.wa_avail_can_see(p_dept) then
    raise exception 'Only the team and the people who manage it can see its availability';
  end if;
  with tm as (
    select distinct on (lower(t.email)) lower(t.email) as email, t.name
      from public.team_members t
     where t.department = p_dept and t.active is not false and coalesce(t.email, '') <> ''
     order by lower(t.email), t.id
  ), cur as (
    select distinct on (lower(h.email)) lower(h.email) as email, h.slots, h.hours, h.updated_at
      from public.hub_team_avail h
     where h.department = p_dept and h.effective_from <= current_date and h.updated_at is not null
     order by lower(h.email), h.effective_from desc, h.id desc
  ), ev as (
    select lower(a.e) as email,
           e.start_at at time zone 'America/Toronto' as ls,
           greatest(coalesce(e.end_at, e.start_at + make_interval(mins => v_cell)), e.start_at + interval '1 minute') at time zone 'America/Toronto' as le
      from public.hub_events e
      cross join lateral unnest(e.attendee_emails) a(e)
     where coalesce(e.status, 'confirmed') = 'confirmed'
       and e.start_at < ((v_today + 28)::timestamp at time zone 'America/Toronto')
       and coalesce(e.end_at, e.start_at) > (v_today::timestamp at time zone 'America/Toronto')
       and coalesce(e.end_at, e.start_at) - e.start_at < interval '12 hours'
       and lower(a.e) in (select tm.email from tm)
  ), cells as (
    select ev.email, c.t
      from ev
      cross join lateral generate_series(
        date_trunc('day', ev.ls) + floor(extract(epoch from ev.ls - date_trunc('day', ev.ls)) / 60 / v_cell) * v_cell * interval '1 minute',
        ev.le - interval '1 microsecond', v_cell * interval '1 minute') c(t)
  ), folded as (
    select cells.email,
           ((extract(isodow from cells.t)::int - 1) * 1440 + extract(hour from cells.t)::int * 60 + extract(minute from cells.t)::int) as slot,
           (cells.t::date - v_today) / 7 as week
      from cells
     where cells.t::date between v_today and v_today + 27
       and extract(hour from cells.t)::int * 60 + extract(minute from cells.t)::int between v_start and v_end - v_cell
  ), clash as (
    select folded.email, folded.slot from folded group by folded.email, folded.slot having count(distinct folded.week) >= 3
  )
  select jsonb_build_object(
    'can_manage', public.wa_avail_can_manage(p_dept),
    'cell_min', v_cell, 'start', v_start, 'end', v_end,
    'min_hours', public.wa_avail_setting('avail_min_hours'),
    'ask_date', (select max(k.ask_date) from public.hub_team_avail_ask k where k.department = p_dept and k.ask_date <= current_date),
    'members', coalesce((select jsonb_agg(jsonb_build_object('email', tm.email, 'name', tm.name, 'slots', to_jsonb(cur.slots), 'hours', cur.hours,
                                                             'updated_at', cur.updated_at) order by tm.name, tm.email)
                           from tm join cur on cur.email = tm.email), '[]'::jsonb),
    'missing', coalesce((select jsonb_agg(jsonb_build_object('email', tm.email, 'name', tm.name) order by tm.name, tm.email)
                           from tm where not exists (select 1 from cur where cur.email = tm.email)), '[]'::jsonb),
    'clashes', coalesce((select jsonb_agg(jsonb_build_object('email', clash.email, 'slot', clash.slot) order by clash.email, clash.slot) from clash), '[]'::jsonb))
  into v;
  return v;
end $$;
revoke all on function public.wa_avail_team(text) from public, anon;
grant execute on function public.wa_avail_team(text) to authenticated, service_role;
comment on function public.wa_avail_team(text) is 'wave276: a team''s availability for its Agenda tab, for the team and its managers only. Returns {can_manage, cell_min, start, end, min_hours, ask_date, members:[{email, name, slots, hours, updated_at}], missing:[{email, name}], clashes:[{email, slot}]}. members are the active roster with a current saved grid; missing the rest of the active roster with an email; clashes the grid cells where a member is in a confirmed hub_events meeting in 3 or more of the next 4 weeks (Toronto time, events of 12 hours or more left out).';

create or replace function public.wa_avail_ask_set(p_dept text, p_date date, p_note text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_date date := coalesce(p_date, current_date);
  v_missing jsonb;
begin
  if not public.wa_avail_can_manage(p_dept) then
    raise exception 'Only a manager of the team can ask it for availability';
  end if;
  insert into public.hub_team_avail_ask (department, ask_date, set_by, note)
  values (p_dept, v_date, nullif(public.wa_email(), ''), nullif(trim(coalesce(p_note, '')), ''));
  select coalesce(jsonb_agg(m.email order by m.email), '[]'::jsonb) into v_missing
    from (select distinct lower(t.email) as email from public.team_members t
           where t.department = p_dept and t.active is not false and coalesce(t.email, '') <> ''
             and not exists (select 1 from public.hub_team_avail h
                              where h.department = p_dept and lower(h.email) = lower(t.email)
                                and h.effective_from <= current_date and h.updated_at is not null)) m;
  return jsonb_build_object('ask_date', v_date, 'missing', v_missing);
end $$;
revoke all on function public.wa_avail_ask_set(text, date, text) from public, anon;
grant execute on function public.wa_avail_ask_set(text, date, text) to authenticated, service_role;
comment on function public.wa_avail_ask_set(text, date, text) is 'wave276: a manager asks the team for its typical week again from a date (today when empty), with an optional note. From that date, everyone whose grid was saved before it sees the Home pop-up. Returns {ask_date, missing}: the emails of active members with no current saved grid, for the message the page sends next. Refuses anyone who does not manage the team.';

-- 8. access: own rows, the team's rows, and the asks for staff; writes from the browser only on your own grid
alter table public.hub_team_avail enable row level security;
alter table public.hub_team_avail_ask enable row level security;
revoke all on public.hub_team_avail, public.hub_team_avail_ask from public, anon, authenticated;
revoke all on sequence public.hub_team_avail_id_seq, public.hub_team_avail_ask_id_seq from public, anon, authenticated;
grant select, insert, update on public.hub_team_avail to authenticated;
grant usage on sequence public.hub_team_avail_id_seq to authenticated;
grant select on public.hub_team_avail_ask to authenticated;
grant all on public.hub_team_avail, public.hub_team_avail_ask to service_role;
grant usage, select on sequence public.hub_team_avail_id_seq, public.hub_team_avail_ask_id_seq to service_role;

drop policy if exists hub_team_avail_own_read on public.hub_team_avail;
create policy hub_team_avail_own_read on public.hub_team_avail for select to authenticated using (lower(email) = any (public.my_emails()));
comment on policy hub_team_avail_own_read on public.hub_team_avail is 'wave276: a person reads their own grids.';
drop policy if exists hub_team_avail_team_read on public.hub_team_avail;
create policy hub_team_avail_team_read on public.hub_team_avail for select to authenticated using (public.wa_avail_can_see(department));
comment on policy hub_team_avail_team_read on public.hub_team_avail is 'wave276: the team and the people who manage it read the team''s grids.';
drop policy if exists hub_team_avail_own_insert on public.hub_team_avail;
create policy hub_team_avail_own_insert on public.hub_team_avail for insert to authenticated with check (lower(email) = any (public.my_emails()));
comment on policy hub_team_avail_own_insert on public.hub_team_avail is 'wave276: a person may add only their own grid (the page uses wa_avail_save).';
drop policy if exists hub_team_avail_own_update on public.hub_team_avail;
create policy hub_team_avail_own_update on public.hub_team_avail for update to authenticated
  using (lower(email) = any (public.my_emails())) with check (lower(email) = any (public.my_emails()));
comment on policy hub_team_avail_own_update on public.hub_team_avail is 'wave276: a person may change only their own grid (the page uses wa_avail_save).';
drop policy if exists hub_team_avail_ask_read on public.hub_team_avail_ask;
create policy hub_team_avail_ask_read on public.hub_team_avail_ask for select to authenticated using (public.is_wa_staff());
comment on policy hub_team_avail_ask_read on public.hub_team_avail_ask is 'wave276: staff read the ask dates. New asks go through wa_avail_ask_set only.';

-- 9. the term asks: every team, the first ask today (02/11/26, so everyone sees the pop-up once) and the start of each term after it
insert into public.hub_team_avail_ask (department, ask_date, set_by, note)
select d.department, x.ask_date, 'wave276', x.note
  from public.dept_meta d
 cross join (values (date '2026-11-02', 'The first ask'), (date '2027-01-04', 'Winter term'), (date '2027-05-03', 'Summer'), (date '2027-09-06', 'Fall term')) x(ask_date, note)
 where not exists (select 1 from public.hub_team_avail_ask a where a.department = d.department and a.ask_date = x.ask_date and a.set_by = 'wave276');

-- 10. the two notification kinds the notify function sends for this (Hub and Slack, no email)
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender, active, updated_at) values
('meet_propose', 'people', 'People and HR', 60, 'A leader proposed a new meeting time for my team',
 'When a leader or manager of your team proposes moving the team meeting to a new time, picked from the weeks the team entered in the Hub.',
 'Who proposed it, the new day and time, how many on the team can make it, and a link to the team''s Agenda tab.',
 'Operations Montreal meetings may move', 'Alex Tremblay is proposing Operations Montreal meetings move to Tuesday 5:00 p.m. 4 can make it. Reply on Slack if that does not work.', '#team/opsmtl/agenda',
 true, true, false, false, 'everyone on the team except the person proposing', 'notify', true, now()),
('meet_avail_ask', 'people', 'People and HR', 61, 'My team needs my availability',
 'When a manager of your team presses Ask the team and the Hub does not have your typical week since the last ask.',
 'Which team is planning meeting times, and a link to My page to add your typical week.',
 'Operations Montreal needs your availability', 'Operations Montreal is planning meeting times. Add your typical week in the Hub.', '#mypage',
 true, true, false, false, 'team members who have not entered their week since the last ask', 'notify', true, now())
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says,
  example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email,
  channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = excluded.active, updated_at = now();
