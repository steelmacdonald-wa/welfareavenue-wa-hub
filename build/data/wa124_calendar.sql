-- wa124_calendar: the fundraising events calendar, the master calendar and birthdays (wave124). Idempotent.
-- Steel: "set up fundraising events calendar under fundraising and finance tab", "a master calendar
-- with all fundraising events, meetings (limited to each user and where they are invited), marketing
-- posts past and future, volunteering events, etc", and "allow individuals to add birthdays to their profile".

-- 1. fundraising events (seeded from "Fundraising Events Calendar 2026-27", updated June 2026)
create table if not exists public.fund_events (
  id bigint generated always as identity primary key,
  title text not null,
  plan text not null default '2026-27',
  season text,
  precision text not null default 'day' check (precision in ('day', 'month', 'range', 'season', 'flexible', 'none')),
  start_date date,
  end_date date,
  timing text,
  partners text,
  target_min numeric,
  target_max numeric,
  target_note text,
  notes text,
  status text not null default 'planned' check (status in ('idea', 'planned', 'confirmed', 'done', 'cancelled')),
  lead text,
  project_id bigint references public.projects(id) on delete set null,
  raised numeric,
  result_note text,
  sop_training_id bigint,
  sort int not null default 100,
  source text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fund_events_dates_idx on public.fund_events(start_date);
create unique index if not exists fund_events_plan_title_uidx on public.fund_events(plan, title);
alter table public.fund_events enable row level security;
drop policy if exists fund_events_read on public.fund_events;
create policy fund_events_read on public.fund_events for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
drop policy if exists fund_events_insert on public.fund_events;
create policy fund_events_insert on public.fund_events for insert to authenticated with check (public.is_wa_staff());
drop policy if exists fund_events_update on public.fund_events;
create policy fund_events_update on public.fund_events for update to authenticated using (public.is_wa_staff()) with check (public.is_wa_staff());
drop policy if exists fund_events_delete on public.fund_events;
create policy fund_events_delete on public.fund_events for delete to authenticated using (public.is_hub_leader());
grant select, insert, update, delete on public.fund_events to authenticated;

insert into public.hub_settings(key, value, updated_by) values ('fund_goals', $j${
  "plan": "2026-27",
  "source": "Fundraising Events Calendar 2026-27, updated June 2026 (the June 22 planning meeting: Steel, Amanda, Rami)",
  "minimum": 10000,
  "healthy": 15000,
  "target": 20000,
  "notes": [
    "$10,000 to $15,000 a year runs Welfare Avenue at its current level, including small budgets for marketing and program development.",
    "$20,000 is the year over year target, with the donor program included in that total.",
    "The donor program is close to zero today. From October 1, the new fiscal year, every donation is tracked in Keela and feeds the annual impact report."
  ],
  "planning": [
    "Collaboration is the default: until the audience is larger, most events run with a partner organization that shares the planning.",
    "Cap each season at roughly three to four events, given the current small team.",
    "The July 14 board presentation pitched club presidents on low-effort ways to get involved (Eventbrite round-up donations, team volunteering days, social exposure): a funnel for club-led fundraisers and recruitment."
  ]
}$j$::jsonb, 'wa124') on conflict (key) do nothing;

insert into public.fund_events (title, season, precision, start_date, end_date, timing, partners, target_min, target_max, target_note, notes, status, project_id, raised, result_note, sort, source) values
  ('Flag Football 2026', 'summer-2026', 'day', '2026-08-08', null, 'August', 'MTL Flag Plus; Poulet Rouge (sponsor)', 4000, null, 'About $4K on a conservative budget at 40 teams', '12 teams signed within two weeks of outreach, so 40 teams looked realistic.', 'done', 12, 2800, '13 teams and 78 players on August 8; $2,800 raised.', 10, 'plan + tasks'),
  ('Rally Paper 2026', 'summer-2026', 'day', '2026-09-19', '2026-09-20', 'September', 'JMCC, plus as many student organizations as possible', null, null, null, 'Multi-organization collaboration to widen reach. The challenge weekend ran September 19 and 20.', 'planned', 11, null, null, 20, 'plan + tasks'),
  ('Thrift Fashion Show', 'fall-2026', 'month', '2026-11-01', '2026-11-30', 'November', 'Co-host a larger organization (for example JMCC) for reach', 3000, 4000, null, 'The fundraiser that feeds the Gift Basket Drive, held in November to avoid December overload. Clothing donated by thrift stores and brand overstock; leftovers go to Chez Doris. A gala is the alternative if the fashion show does not run.', 'planned', null, null, null, 30, 'plan'),
  ('Gift Basket Drive 2026', 'fall-2026', 'month', '2026-12-01', '2026-12-31', 'December', 'Operations-led', null, null, null, 'Runs near Christmas. The November fashion show builds momentum and donations ahead of it.', 'planned', 13, null, null, 40, 'plan'),
  ('JMCC offload events', 'fall-2026', 'range', '2026-09-01', '2026-12-31', 'September to December', 'JMCC (their VP Charity leads the planning)', 2500, null, 'JMCC is mandated to raise $2.5K at minimum, so usually two events', 'Options: Reggie''s Night (with Casa X for engagement), a board game tournament, a casino night, a cook-off. We provide guidance and attend.', 'planned', null, null, null, 50, 'plan'),
  ('St. Patrick''s Party at Reggie''s', 'winter-2027', 'day', '2027-03-17', null, 'March 17', 'Co-host a club (Casa X drove engagement before)', null, null, null, 'Book Reggie''s in early January. Only feasible if the partner handles most of the planning, given the party and drinking image considerations. St. Patrick''s suits the green branding.', 'planned', null, null, null, 60, 'plan'),
  ('Women''s Day Fundraiser', 'winter-2027', 'month', '2027-03-01', '2027-03-31', 'March', 'JMWL and Chez Doris', null, null, null, 'Reconnect through Jemeela and Daniela (who led it before) and Medina (the JMWL delegate). Possible formats: a spin or Pilates class (Paula, instructor), or the Pilates and padel venue in Griffintown. Open to a three-way collaboration.', 'planned', null, null, null, 70, 'plan'),
  ('Après-Ski', 'winter-2027', 'season', '2027-01-01', '2027-03-31', 'Winter', 'Concordia Ski Club and Croissound (St-Sauveur); alternatively Brewski through Casa', null, null, null, 'They run one each winter, so explore partnering rather than building from scratch.', 'planned', null, null, null, 80, 'plan'),
  ('Corporate Cook-Off', 'winter-2027', 'season', '2027-01-01', '2027-03-31', 'Winter', 'Two or three companies (for example Scotia, Arden, Sportira)', null, null, null, 'A bake-sale competition: companies compete to raise the most across one week (Monday to Friday), then donate the leftovers to the people we serve that weekend.', 'planned', null, null, null, 90, 'plan'),
  ('Corporate Volunteering', 'winter-2027', 'flexible', null, null, 'Flexible', 'Corporate partners', null, null, null, 'Companies fundraise to cover and support their volunteering day. Ties in with the DESTA community kitchen.', 'planned', null, null, null, 100, 'plan'),
  ('Sports Tournament', 'spring-2027', 'range', '2027-04-01', '2027-07-31', 'April to July', 'To be decided', null, null, null, 'Golf (the start of golf season), soccer or tennis as the weather improves. One larger flagship event.', 'planned', null, null, null, 110, 'plan'),
  ('Art4All', 'spring-2027', 'season', '2027-06-01', '2027-08-31', 'Summer (to confirm)', 'Scattered', null, null, null, 'Only if Scattered brings it back in an aligned format (donations, plus shelters contributing art that is sold for proceeds). We could also sell art at the event.', 'idea', null, null, null, 120, 'plan'),
  ('Flag Football 2027', 'spring-2027', 'season', '2027-06-01', '2027-08-31', 'Summer', 'MTL Flag Plus; Poulet Rouge', null, null, null, 'A repeat of the proven summer event.', 'planned', null, null, null, 130, 'plan'),
  ('Rally Paper 2027', 'spring-2027', 'season', '2027-06-01', '2027-08-31', 'Summer', 'JMCC, plus other organizations', null, null, null, 'A repeat, multi-organization.', 'planned', null, null, null, 140, 'plan'),
  ('Comedy show or trivia night', 'backlog', 'none', null, null, 'Not yet scheduled', null, null, null, null, 'Comedy is costly and harder to run, as performers usually charge.', 'idea', null, null, null, 200, 'plan'),
  ('Indoor sport tournament', 'backlog', 'none', null, null, 'Not yet scheduled', null, null, null, null, 'Ping pong, padel and similar.', 'idea', null, null, null, 210, 'plan'),
  ('Auction', 'backlog', 'none', null, null, 'Not yet scheduled', null, null, null, null, null, 'idea', null, null, null, 220, 'plan'),
  ('Cooking or art class at Time Out Market', 'backlog', 'none', null, null, 'Not yet scheduled', 'Time Out Market', null, null, null, null, 'idea', null, null, null, 230, 'plan'),
  ('Cinema or haunted house partnership', 'backlog', 'none', null, null, 'Not yet scheduled', null, null, null, null, null, 'idea', null, null, null, 240, 'plan'),
  ('Talent show, karaoke or spelling bee', 'backlog', 'none', null, null, 'Not yet scheduled', null, null, null, null, null, 'idea', null, null, null, 250, 'plan'),
  ('Old Brewery Mission art event', 'backlog', 'none', null, null, 'Not yet scheduled', 'Old Brewery Mission', null, null, null, 'Students donate art, gallery patrons buy it, the proceeds come to us and the art goes to the OBM cafeteria. On the back burner: too complex for now.', 'idea', null, null, null, 260, 'plan'),
  ('Tabling at Montreal events', 'backlog', 'none', null, null, 'Not yet scheduled', null, null, null, null, 'A Welfare Avenue table at city events (for example Kwasan, Croissant Race Week) for awareness and donations.', 'idea', null, null, null, 270, 'plan')
on conflict (plan, title) do nothing;

-- 2. birthdays: month and day only, entered by the person, shown on the calendar to whom they choose
create table if not exists public.hub_birthdays (
  email text primary key,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  share text not null default 'everyone' check (share in ('everyone', 'team', 'me')),
  updated_at timestamptz not null default now(),
  constraint hub_birthdays_valid_day check (day <= case when month = 2 then 29 when month in (4, 6, 9, 11) then 30 else 31 end)
);
alter table public.hub_birthdays enable row level security;
drop policy if exists hub_birthdays_read on public.hub_birthdays;
create policy hub_birthdays_read on public.hub_birthdays for select to authenticated using (
  public.is_wa_staff() and (
    share = 'everyone' or email = public.wa_email()
    or (share = 'team' and exists (
      select 1 from public.team_members a join public.team_members b on a.department = b.department
      where lower(a.email) = hub_birthdays.email and lower(b.email) = public.wa_email() and a.department is not null))));
drop policy if exists hub_birthdays_insert on public.hub_birthdays;
create policy hub_birthdays_insert on public.hub_birthdays for insert to authenticated with check (public.is_wa_staff() and email = public.wa_email());
drop policy if exists hub_birthdays_update on public.hub_birthdays;
create policy hub_birthdays_update on public.hub_birthdays for update to authenticated using (email = public.wa_email()) with check (email = public.wa_email());
drop policy if exists hub_birthdays_delete on public.hub_birthdays;
create policy hub_birthdays_delete on public.hub_birthdays for delete to authenticated using (email = public.wa_email() or public.is_hub_admin());
grant select, insert, update, delete on public.hub_birthdays to authenticated;

-- 3. meetings on the calendar: only the ones the person is invited to (their email, its Workspace aliases, or the dotless spelling)
alter table public.hub_directory add column if not exists aliases text[];
create or replace function public.my_emails() returns text[]
language sql stable security definer set search_path = '' as $$
  select array_remove(array_agg(distinct e), null) from (
    select public.wa_email() as e
    union select regexp_replace(split_part(public.wa_email(), '@', 1), '\.', '', 'g') || '@' || split_part(public.wa_email(), '@', 2)
    union select lower(a) from public.hub_directory d, unnest(coalesce(d.aliases, '{}'::text[])) a where lower(d.email) = public.wa_email()
    union select lower(d.email) from public.hub_directory d where public.wa_email() = any (select lower(x) from unnest(coalesce(d.aliases, '{}'::text[])) x)
  ) s where coalesce(e, '') <> '' and e <> '@'
$$;
grant execute on function public.my_emails() to authenticated;
create or replace function public.calendar_my_meetings(p_from timestamptz, p_to timestamptz)
returns setof public.hub_events
language sql stable security definer set search_path = '' as $$
  select ev.* from public.hub_events ev
  where (public.is_wa_staff() or public.is_board_viewer())
    and ev.start_at < p_to and coalesce(ev.end_at, ev.start_at) >= p_from
    and coalesce(ev.status, 'confirmed') <> 'cancelled'
    and (lower(coalesce(ev.organizer, '')) = any (public.my_emails())
      or exists (select 1 from unnest(coalesce(ev.attendee_emails, '{}'::text[])) x where lower(x) = any (public.my_emails())))
  order by ev.start_at
  limit 500
$$;
grant execute on function public.calendar_my_meetings(timestamptz, timestamptz) to authenticated;
