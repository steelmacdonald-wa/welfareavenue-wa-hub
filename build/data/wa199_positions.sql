-- wave199: positions, their job descriptions and CVs, read from the HR shared drive
-- (*Recruitment* > Job descriptions > <Department> > <Position> > Resumes / the latest JD / Older JDs)
create table if not exists public.hub_positions (
  id bigserial primary key,
  title text not null,
  dept text,                      -- the Hub's department key (exec, board, fundraising, marketing, hr, progdev, opsmtl, opsto)
  folder_id text unique,          -- the position's Drive folder
  resumes_id text,                -- its Resumes folder
  older_id text,                  -- its Older JDs folder (made when a second JD arrives)
  jd_id text, jd_name text, jd_url text, jd_mime text, jd_modified timestamptz,
  older_count int not null default 0,
  stage text not null default 'closed',   -- requested, defined, posted, interviewing, offer, filled, closed
  owner text, needed_by date, priority text, notes text,
  clickup_id text, clickup_url text, request_id bigint,
  baseline_at timestamptz,        -- CVs already in Resumes before this are kept on file, not added to Applications
  gone boolean not null default false,
  synced_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), updated_by text
);
create table if not exists public.hub_position_files (
  id bigserial primary key,
  position_id bigint references public.hub_positions(id) on delete cascade,  -- null: Unsorted Resumes
  kind text not null,             -- resume | old_jd
  file_id text unique not null,
  name text, mime text, url text, size bigint,
  created_time timestamptz, modified_time timestamptz,
  candidate_id bigint references public.hub_candidates(id) on delete set null,
  member_id bigint references public.team_members(id) on delete set null,
  gone boolean not null default false,
  seen_at timestamptz not null default now()
);
create index if not exists hub_position_files_pos on public.hub_position_files(position_id);
-- who has held a position (Ahmed: Volunteer Relations Coordinator, then Operations Manager)
create table if not exists public.hub_position_people (
  id bigserial primary key,
  position_id bigint not null references public.hub_positions(id) on delete cascade,
  member_id bigint not null references public.team_members(id) on delete cascade,
  since date, until date, note text,
  created_at timestamptz not null default now(), created_by text,
  unique (position_id, member_id, since)
);
alter table public.hub_candidates add column if not exists position_id bigint references public.hub_positions(id) on delete set null;
alter table public.hub_candidates add column if not exists drive_file_id text;
alter table public.team_members add column if not exists position_id bigint references public.hub_positions(id) on delete set null;

alter table public.hub_positions enable row level security;
alter table public.hub_position_files enable row level security;
alter table public.hub_position_people enable row level security;
drop policy if exists hub_positions_staff on public.hub_positions;
create policy hub_positions_staff on public.hub_positions for all using ((select public.is_wa_staff()) or (select public.is_hub_admin())) with check ((select public.is_wa_staff()) or (select public.is_hub_admin()));
drop policy if exists hub_position_files_staff on public.hub_position_files;
create policy hub_position_files_staff on public.hub_position_files for all using ((select public.is_wa_staff()) or (select public.is_hub_admin())) with check ((select public.is_wa_staff()) or (select public.is_hub_admin()));
drop policy if exists hub_position_people_staff on public.hub_position_people;
create policy hub_position_people_staff on public.hub_position_people for all using ((select public.is_wa_staff()) or (select public.is_hub_admin())) with check ((select public.is_wa_staff()) or (select public.is_hub_admin()));
grant select, insert, update, delete on public.hub_positions, public.hub_position_files, public.hub_position_people to authenticated;
grant usage, select on sequence public.hub_positions_id_seq, public.hub_position_files_id_seq, public.hub_position_people_id_seq to authenticated;
