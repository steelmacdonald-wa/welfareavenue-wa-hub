-- wave144: Meet attendance. Who came to the team meetings, the leadership meetings and the board meetings, from the Google
-- Meet log (meet-attendance edge function). Written only by the function (service role); read under the rules below.

create table if not exists public.meet_meetings (
  id text primary key,
  kind text not null check (kind in ('team', 'leadership', 'board')),
  department text,
  board_meeting_id bigint,
  series_id text,
  title text,
  organizer text,
  meeting_code text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  held boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  conference_ids text[] not null default '{}',
  expected_n int not null default 0,
  came_n int not null default 0,
  expected_came_n int not null default 0,
  team_n int not null default 0,
  team_came_n int not null default 0,
  visitors_n int not null default 0,
  guests_n int not null default 0,
  avg_minutes int,
  synced_at timestamptz not null default now()
);
create index if not exists meet_meetings_dept on public.meet_meetings (department, scheduled_start desc);
create index if not exists meet_meetings_kind on public.meet_meetings (kind, scheduled_start desc);

create table if not exists public.meet_attendance (
  meeting_id text not null references public.meet_meetings (id) on delete cascade,
  person text not null,
  member_id bigint,
  director_id bigint,
  name text,
  expected boolean not null default false,
  came boolean not null default false,
  home_team boolean not null default false,
  optional boolean not null default false,
  rsvp text,
  joined_at timestamptz,
  left_at timestamptz,
  minutes int,
  sessions int,
  late_min int,
  primary key (meeting_id, person)
);
create index if not exists meet_attendance_member on public.meet_attendance (member_id);
create index if not exists meet_attendance_director on public.meet_attendance (director_id);

create table if not exists public.meet_sync_state (
  id int primary key default 1 check (id = 1),
  last_run_at timestamptz,
  last_ok boolean,
  last_ok_at timestamptz,
  note text,
  days int,
  meetings_n int,
  rows_n int,
  oldest_log timestamptz
);

/* who leads a team: a leader on the Hub whose profile or roster team is that team */
create or replace function public.wa_leads_team(p_dept text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(p_dept, '') <> '' and exists (
    select 1 from public.hub_roles r
     where r.email = public.wa_email() and r.role = 'leader'
       and (r.profile = p_dept or exists (select 1 from public.team_members t where lower(t.email) = any (public.my_emails()) and t.department = p_dept and coalesce(t.active, true))));
$$;
/* who is on a team: the roster, or a Hub profile for that team */
create or replace function public.wa_in_team(p_dept text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(p_dept, '') <> '' and (
    exists (select 1 from public.team_members t where lower(t.email) = any (public.my_emails()) and t.department = p_dept and coalesce(t.active, true))
    or exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.profile = p_dept and r.role <> 'blocked'));
$$;
/* a meeting's own rows are open to: the admins and the Executive profile; for a team meeting, the person who runs it and
   the team's leader; for a board meeting, whoever sees the board */
create or replace function public.wa_meet_people_ok(p_meeting text) returns boolean
language sql stable security definer set search_path to '' as $$
  select public.wa_org_editor() or exists (
    select 1 from public.meet_meetings m
     where m.id = p_meeting
       and ((m.kind = 'team' and (lower(coalesce(m.organizer, '')) = any (public.my_emails()) or public.wa_leads_team(m.department)))
         or (m.kind = 'board' and public.can_see_board())));
$$;

alter table public.meet_meetings enable row level security;
alter table public.meet_attendance enable row level security;
alter table public.meet_sync_state enable row level security;

drop policy if exists meet_meetings_read on public.meet_meetings;
create policy meet_meetings_read on public.meet_meetings for select to authenticated using (
  public.wa_org_editor()
  or (kind = 'team' and (lower(coalesce(organizer, '')) = any (public.my_emails()) or public.wa_leads_team(department) or public.wa_in_team(department)))
  or (kind = 'leadership' and public.is_hub_leader())
  or (kind = 'board' and public.can_see_board()));

drop policy if exists meet_attendance_read on public.meet_attendance;
create policy meet_attendance_read on public.meet_attendance for select to authenticated using (
  person = any (public.my_emails()) or public.wa_meet_people_ok(meeting_id));

drop policy if exists meet_sync_state_read on public.meet_sync_state;
create policy meet_sync_state_read on public.meet_sync_state for select to authenticated using (public.wa_org_editor());

revoke all on public.meet_meetings, public.meet_attendance, public.meet_sync_state from anon;
grant select on public.meet_meetings, public.meet_attendance, public.meet_sync_state to authenticated;

comment on table public.meet_meetings is 'Meet attendance (wave144): one row per team meeting, leadership meeting or board meeting that was scheduled on the hub@ calendar (or in board_meetings) or held on a team''s Meet link. id is cal:<calendar instance id>, conf:<conference id> (a call on the team''s link with no scheduled meeting) or board:<board_meetings.id>. Counts: expected (invited people, or the active directors), came, team (the team''s own roster among the invited), visitors (came without an invitation), guests (not identified: signed out, phone). Written by meet-attendance only.';
comment on column public.meet_meetings.held is 'At least two people stayed three minutes or more on a call matched to this meeting.';
comment on column public.meet_meetings.conference_ids is 'The Meet conferences (Reports API conference_id) matched to this meeting; a meeting restarted on the same link has two.';
comment on table public.meet_attendance is 'Meet attendance (wave144): one row per expected person (invited, or an active director for a board meeting) and per identified person who came without an invitation. person is the canonical email (aliases folded) or director:<id>. came: three minutes or more on the call. Read by the person themselves, the admins and the Executive profile, the person who runs a team meeting and the team''s leader, and for board meetings whoever sees the board.';
comment on column public.meet_attendance.late_min is 'Minutes between the scheduled start and the first join, when positive.';
comment on table public.meet_sync_state is 'The last meet-attendance run: when, whether it worked, the window and the counts.';
comment on function public.wa_leads_team(text) is 'True when the signed-in person is a Hub leader for that team (their profile or their roster team).';
comment on function public.wa_in_team(text) is 'True when the signed-in person is on that team (the roster, or a Hub profile for it).';
comment on function public.wa_meet_people_ok(text) is 'True when the signed-in person may read everyone''s attendance for that meeting.';
