-- wave126: the board section around the three jobs of a board, the four committees, and each director's progress
-- (from the July 22, 2026 board deck, slides 16 to 27, and the July 22 minutes).
begin;

-- who counts as the board: a director or adviser on board_members (any of their emails), the board circle, or a board viewer
create table if not exists public.board_members (
  id bigserial primary key,
  name text not null,
  full_name text,
  emails text[] not null default '{}',
  seat text,
  renewal text,
  renewal_due date,
  status text not null default 'active' check (status in ('active', 'adviser', 'resigned', 'former')),
  note text,
  sort int not null default 100,
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists board_members_name on public.board_members (name);

create or replace function public.is_wa_leader() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.hub_roles r where r.email = lower(coalesce(auth.jwt()->>'email', '')) and r.role in ('admin', 'leader'));
$$;
create or replace function public.is_wa_admin() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.hub_roles r where r.email = lower(coalesce(auth.jwt()->>'email', '')) and r.role = 'admin');
$$;
create or replace function public.my_board_member_id() returns bigint
language sql stable security definer set search_path to '' as $$
  select m.id from public.board_members m
  where m.status in ('active', 'adviser') and lower(coalesce(auth.jwt()->>'email', '')) <> ''
    and lower(coalesce(auth.jwt()->>'email', '')) = any (select lower(e) from unnest(m.emails) e)
  order by m.sort limit 1;
$$;
create or replace function public.is_board_person() returns boolean
language sql stable security definer set search_path to '' as $$
  select public.my_board_member_id() is not null
    or public.is_board_viewer()
    or exists (select 1 from public.board_circle c where lower(c.email) = lower(coalesce(auth.jwt()->>'email', '')));
$$;
create or replace function public.can_see_board() returns boolean
language sql stable security definer set search_path to '' as $$
  select public.is_board_person() or public.is_wa_leader();
$$;

create table if not exists public.board_committees (
  key text primary key check (key in ('fundraising', 'people', 'operations', 'fiduciary')),
  name text not null,
  color text,
  purpose text,
  chair_id bigint references public.board_members(id) on delete set null,
  chair_confirmed boolean not null default false,
  member_ids bigint[] not null default '{}',
  internal_leads text[] not null default '{}',
  external_recruit text,
  depts text[] not null default '{}',
  status text not null default 'created',
  note text,
  sort int not null default 100,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.board_meetings (
  id bigserial primary key,
  meets_at timestamptz,
  kind text not null default 'board' check (kind in ('board', 'special', 'agm', 'strategy')),
  title text not null,
  status text not null default 'scheduled' check (status in ('held', 'scheduled', 'tentative', 'to schedule', 'cancelled')),
  agenda_url text,
  notes_url text,
  note text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.board_items (
  id bigserial primary key,
  job text not null check (job in ('steward', 'fiduciary', 'strategy')),
  committee text references public.board_committees(key) on delete set null,
  title text not null,
  detail text,
  status text not null default 'todo' check (status in ('done', 'in_progress', 'todo', 'at_risk', 'watch', 'standing')),
  owner text,
  due text,
  task_id bigint,
  source text,
  sort int not null default 100,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.board_touchpoints (
  id bigserial primary key,
  committee text not null references public.board_committees(key) on delete cascade,
  kind text not null check (kind in ('internal', 'external', 'meeting', 'recommendation', 'note')),
  happened_on date not null default current_date,
  with_whom text,
  summary text,
  recommendation text,
  member_id bigint references public.board_members(id) on delete set null,
  meeting_id bigint references public.board_meetings(id) on delete set null,
  logged_by_email text not null default lower(coalesce(auth.jwt()->>'email', '')),
  logged_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists board_touchpoints_committee on public.board_touchpoints (committee, happened_on desc);

alter table public.board_members enable row level security;
alter table public.board_committees enable row level security;
alter table public.board_meetings enable row level security;
alter table public.board_items enable row level security;
alter table public.board_touchpoints enable row level security;

drop policy if exists board_members_read on public.board_members;
create policy board_members_read on public.board_members for select to authenticated using (public.can_see_board());
drop policy if exists board_members_write on public.board_members;
create policy board_members_write on public.board_members for all to authenticated using (public.is_wa_admin()) with check (public.is_wa_admin());

drop policy if exists board_committees_read on public.board_committees;
create policy board_committees_read on public.board_committees for select to authenticated using (public.can_see_board());
drop policy if exists board_committees_update on public.board_committees;
create policy board_committees_update on public.board_committees for update to authenticated
  using (public.is_wa_leader() or chair_id = public.my_board_member_id()) with check (public.is_wa_leader() or chair_id = public.my_board_member_id());

drop policy if exists board_meetings_read on public.board_meetings;
create policy board_meetings_read on public.board_meetings for select to authenticated using (public.can_see_board());
drop policy if exists board_meetings_write on public.board_meetings;
create policy board_meetings_write on public.board_meetings for all to authenticated using (public.is_wa_leader()) with check (public.is_wa_leader());

drop policy if exists board_items_read on public.board_items;
create policy board_items_read on public.board_items for select to authenticated using (public.can_see_board());
drop policy if exists board_items_insert on public.board_items;
create policy board_items_insert on public.board_items for insert to authenticated with check (public.is_wa_leader() or public.my_board_member_id() is not null);
drop policy if exists board_items_update on public.board_items;
create policy board_items_update on public.board_items for update to authenticated
  using (public.is_wa_leader() or public.my_board_member_id() is not null) with check (public.is_wa_leader() or public.my_board_member_id() is not null);
drop policy if exists board_items_delete on public.board_items;
create policy board_items_delete on public.board_items for delete to authenticated using (public.is_wa_admin());

drop policy if exists board_touchpoints_read on public.board_touchpoints;
create policy board_touchpoints_read on public.board_touchpoints for select to authenticated using (public.can_see_board());
drop policy if exists board_touchpoints_insert on public.board_touchpoints;
create policy board_touchpoints_insert on public.board_touchpoints for insert to authenticated
  with check (public.can_see_board() and (logged_by_email = public.wa_email()) and (public.is_wa_admin() or member_id is null or member_id = public.my_board_member_id()));
drop policy if exists board_touchpoints_update on public.board_touchpoints;
create policy board_touchpoints_update on public.board_touchpoints for update to authenticated
  using (logged_by_email = public.wa_email() or public.is_wa_admin()) with check (logged_by_email = public.wa_email() or public.is_wa_admin());
drop policy if exists board_touchpoints_delete on public.board_touchpoints;
create policy board_touchpoints_delete on public.board_touchpoints for delete to authenticated using (logged_by_email = public.wa_email() or public.is_wa_admin());

grant select, insert, update, delete on public.board_members, public.board_committees, public.board_meetings, public.board_items, public.board_touchpoints to authenticated;
grant usage, select on sequence public.board_members_id_seq, public.board_meetings_id_seq, public.board_items_id_seq, public.board_touchpoints_id_seq to authenticated;

create or replace function public.board_me() returns jsonb
language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('member_id', public.my_board_member_id(), 'board', public.is_board_person(), 'leader', public.is_wa_leader(), 'admin', public.is_wa_admin());
$$;
grant execute on function public.board_me() to authenticated;

-- everything the board pages show, in one call (board members see aggregates, never the ledger or task details beyond the board's own)
create or replace function public.board_home() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
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
      from public.dept_tasks d where d.department = 'board' and coalesce(d.confidential, false) = false), '[]'::jsonb),
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
end $$;
grant execute on function public.board_home() to authenticated;
grant execute on function public.is_wa_leader(), public.is_wa_admin(), public.my_board_member_id(), public.is_board_person(), public.can_see_board() to authenticated;

-- the directors (seats from the board circle; renewals from the July 22 deck and minutes)
insert into public.board_members (name, full_name, emails, seat, renewal, renewal_due, status, note, sort) values
  ('Kellian', 'Kellian Debargis', array['kellian.debargis@welfareavenue.com'], 'Chair', 'Q3 2026', '2026-09-30', 'active', 'Chaired the July 22, 2026 meeting.', 10),
  ('Steel', 'Steel MacDonald', array['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com'], 'Vice chair', 'Q3 2026', '2026-09-30', 'active', 'Founder.', 20),
  ('Daniela', 'Daniela Nita', array['daniela.nita@welfareavenue.com'], 'Treasurer', 'Q1 2027', '2027-03-31', 'active', null, 30),
  ('Tamara', 'Tamara Angeline Medford Williams', array['consult.tamaraangeline@gmail.com', 'tamara.medfordw@welfareavenue.com'], 'Director', 'Q1 2027', '2027-03-31', 'active', null, 40),
  ('Mohamed', 'Mohamed Ashr', array['mai307@nyu.edu'], 'Director', 'Q2 2027', '2027-06-30', 'active', 'Renewed for a year on July 22, 2026 (4 in favour, 0 against).', 50),
  ('Suhaib', 'Suhaib Abdillahi', array['suhaib.abdillahi@welfareavenue.com'], 'Member at Large (co-ED)', null, null, 'active', 'The co-ED is now a director.', 60),
  ('Rima Naim', 'Rima Naim', '{}', 'Adviser (Canadian Red Cross board)', null, null, 'adviser', 'External adviser on board governance.', 80),
  ('Shanada', 'Shanada', '{}', 'Director', null, null, 'resigned', 'Resigned July 22, 2026; the HR & People seat needs a successor.', 90)
on conflict (name) do nothing;

-- the four committees (chairs as proposed on July 22; the minutes created the committees)
insert into public.board_committees (key, name, color, purpose, chair_id, member_ids, internal_leads, external_recruit, depts, status, note, sort)
select 'fundraising', 'Fundraising', '#1F4A3D', 'Events, donors, grants and sponsors: understand the fundraising team''s challenges, guide it, and bring in people who can help.',
  (select id from public.board_members where name = 'Kellian'), array(select id from public.board_members where name in ('Kellian', 'Daniela') order by sort), array['Rami', 'Amanda'], 'A fundraising or donor professional', array['fundraising'], 'created', 'Chair proposed on July 22.', 10
union all select 'people', 'HR & People', '#6F64AB', 'Recruitment, onboarding, policies and retention for staff and volunteers.',
  (select id from public.board_members where name = 'Steel'), array(select id from public.board_members where name in ('Steel', 'Kellian') order by sort), array['Valex', 'Natasha'], 'Someone from our HR network', array['hr'], 'created', 'Chair proposed on July 22. The seat Shanada left needs a successor.', 20
union all select 'operations', 'Operations', '#2A6F55', 'Servings, volunteers, logistics and programs in Montreal and Toronto.',
  (select id from public.board_members where name = 'Tamara'), array(select id from public.board_members where name in ('Tamara', 'Mohamed') order by sort), array['Tate', 'Shima', 'Ahmed'], 'An operations or logistics professional', array['opsmtl', 'opsto', 'progdev'], 'created', 'Chair proposed on July 22.', 30
union all select 'fiduciary', 'Fiduciary', '#C8961F', 'Finances, risk and compliance: statements, budgets, insurance, filings and disclosures.',
  (select id from public.board_members where name = 'Daniela'), array(select id from public.board_members where name in ('Daniela') order by sort), array['Suhaib (co-ED)'], 'A finance or accounting professional', array['fundraising'], 'created', 'Chair proposed on July 22.', 40
on conflict (key) do nothing;

-- board meetings
insert into public.board_meetings (meets_at, kind, title, status, agenda_url, notes_url, note)
select '2026-04-08 18:00-04'::timestamptz, 'board', 'Board meeting', 'held', null, 'https://docs.google.com/document/d/1iTPp0rIsbcN2fktfgNmDh-uxzKZUn8mrARSJvoFED-4/edit', null
where not exists (select 1 from public.board_meetings where meets_at = '2026-04-08 18:00-04')
union all select '2026-07-22 18:00-04'::timestamptz, 'board', 'Q2 board meeting', 'held', 'https://docs.google.com/document/d/1AJOSwwl1WLJCa14vVs_qfdcJyXv3R4EjEXYiuzkUqcg/edit', 'https://docs.google.com/document/d/1TqhHU4y2vQYDaDfc-d8S9SVNTW4YMMsPETKfQA4_nUM/edit', 'Committees created; Mohamed renewed; by-laws to be approved at the next meeting.'
where not exists (select 1 from public.board_meetings where meets_at = '2026-07-22 18:00-04')
union all select null::timestamptz, 'strategy', 'Fiscal year-end strategy session (board and operations)', 'to schedule', null, null, 'The special meeting in September from the July 22 minutes: align on assumptions, decide who we serve, revise the plan, and confirm the transition timeline.'
where not exists (select 1 from public.board_meetings where kind = 'strategy')
union all select '2026-10-19 18:00-04'::timestamptz, 'board', 'Q3 board meeting', 'tentative', null, null, 'Committees meet the week before. New by-laws and articles for approval.'
where not exists (select 1 from public.board_meetings where meets_at = '2026-10-19 18:00-04');

-- the three jobs: where each stands
insert into public.board_items (job, committee, title, detail, status, owner, due, task_id, source, sort)
select * from (values
  ('steward', null, 'Term limits and staggered renewals', 'First term one year, renewals up to two. Mohamed to Q2 2027 (renewed July 22), Steel and Kellian Q3 2026, Daniela and Tamara Q1 2027.', 'done', 'Board', null, null::bigint, 'July 22 deck', 10),
  ('steward', null, 'Renewals due: Steel and Kellian (Q3 2026)', 'Vote the renewals at the next board meeting.', 'todo', 'Board', 'Q3 board meeting', null, 'July 22 deck', 20),
  ('steward', 'people', 'Fill the open director seat (HR & People)', 'Recruit beyond the board: our networks, donors, past and standout volunteers, professors, director networks, working groups.', 'todo', 'Board', null, null, 'July 22 deck', 50),
  ('steward', null, 'Suhaib joined the board as Member at Large', 'The co-ED is now a director.', 'done', 'Board', null, null, 'July 22 deck', 60),
  ('fiduciary', null, 'Signing officers defined', 'Banking authority set to the President and Treasurer.', 'done', 'Board', null, null, 'July 22 deck', 10),
  ('fiduciary', null, 'New by-laws and articles of incorporation', 'Presented July 22; to be approved at the next board meeting.', 'in_progress', 'Board', 'Q3 board meeting', null, 'July 22 minutes', 20),
  ('fiduciary', null, 'Board and organization insurance (D&O)', 'Directors and officers cover for the board, plus the organization''s own policy.', 'todo', 'Steel', null, 54, 'Board task 54', 30),
  ('fiduciary', null, 'Publish the required financial disclosures on the website', 'Compliance: the financials go on welfareavenue.com.', 'at_risk', 'Fiduciary committee', null, null, 'July 22 deck', 40),
  ('fiduciary', 'fiduciary', 'A hard quarter: high costs, little summer revenue', 'From the July 22 financial overview. Watch spending against the budget and the fall events.', 'watch', 'Daniela', null, null, 'July 22 minutes', 50),
  ('fiduciary', 'fundraising', 'Ontario Trillium application (deadline August 19)', 'Confirm it was submitted; the preparation tasks are still open.', 'watch', 'Suhaib', 'August 19', 440, 'Tasks 436 to 440', 60),
  ('strategy', null, 'Fiscal year-end strategy session with operations', 'The deep dive on direction and assumptions.', 'todo', 'Steel', 'To schedule', null, 'July 22 deck', 10),
  ('strategy', null, 'Step 1: align on assumptions', 'Agree what we believe about the next three years: demand, demographics, climate, government funding.', 'todo', 'Board', null, null, 'July 22 deck', 20),
  ('strategy', null, 'Step 2: decide who we serve', 'Our sweet spot, and the referral partners for the people we are not built to serve.', 'todo', 'Board', null, null, 'July 22 deck', 30),
  ('strategy', null, 'Step 3: revise the plan together', 'Refresh November''s strategy with the board and operations, then measure against it; revisit every two to three years.', 'todo', 'Board', null, null, 'July 22 deck', 40),
  ('strategy', null, 'Revisit the organizational goals and the meeting cadence', null, 'in_progress', 'Steel', 'October 10', 107, 'Board task 107', 50),
  ('strategy', null, 'A strategy block at every board meeting', 'Everyone''s job, a standing block on every agenda.', 'standing', 'Steel', null, null, 'July 22 deck', 60)
) as v(job, committee, title, detail, status, owner, due, task_id, source, sort)
where not exists (select 1 from public.board_items);

insert into public.hub_settings (key, value, updated_at, updated_by)
values ('board', jsonb_build_object(
  'terms', 'First term one year; renewals up to two.',
  'cadence', jsonb_build_array('4 board meetings a year, plus an AGM', 'Committees meet twice between board meetings: once with the team, once with an outside professional', 'Monthly for committees chasing a target', 'An October fiscal year-end strategy session'),
  'source', 'Board meeting, July 22, 2026 (deck and minutes)'), now(), 'wa126')
on conflict (key) do nothing;

commit;
