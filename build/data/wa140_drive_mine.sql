-- wave140 (26/09/26): mining the Google Drive for the Hub's history, partners, learnings and resources.
-- Steel: "I really just want to pour everything we have in the google drive, including shared drives to enhance our Hub.
-- That said, don't just add anything." Step 1 is an inventory (metadata only) so the mining can pick the gold.
create table if not exists public.drive_inventory (
  file_id text primary key,
  name text not null default '',
  mime text not null default '',
  drive_id text,
  drive_name text,
  parent_id text,
  path text,
  owner_email text,
  created_time timestamptz,
  modified_time timestamptz,
  size bigint,
  web_url text,
  source text not null check (source in ('shared_drive', 'my_drive', 'shared_with_me', 'connector')),
  trashed boolean not null default false,
  shortcut_target text,
  seen_at timestamptz not null default now(),
  triage text check (triage in ('gold', 'ore', 'waste', 'private')),
  triage_reason text,
  sensitivity text check (sensitivity in ('staff', 'leadership', 'board', 'hr', 'donor', 'personal', 'transition')),
  mined_at timestamptz,
  mine_note text
);
create index if not exists idx_drive_inventory_parent_id on public.drive_inventory (parent_id);
create index if not exists idx_drive_inventory_triage on public.drive_inventory (triage);
alter table public.drive_inventory enable row level security;
drop policy if exists drive_inventory_admin_read on public.drive_inventory;
create policy drive_inventory_admin_read on public.drive_inventory for select to authenticated using (public.is_hub_admin());
revoke all on public.drive_inventory from anon, authenticated;
grant select on public.drive_inventory to authenticated;
comment on table public.drive_inventory is 'Every Google Drive file Steel''s welfareavenue.com account can see (his My Drive, files shared with him, the shared drives he belongs to), metadata only, listed by drive-mine for the wave140 mining (history, partners, learnings, resources). triage says what the mining did with each file. File names can be sensitive: admins read, only the service role writes.';
comment on column public.drive_inventory.path is 'Where the file sits: the shared drive (or My Drive, Shared with me) and its folders, from drive_inventory_paths().';
comment on column public.drive_inventory.triage is 'gold: mined; ore: worth a later look; waste: nothing to mine (photos, templates, duplicates, forms); private: left out on purpose (personal, HR, donor details, board-only, Steel''s transition).';
comment on column public.drive_inventory.sensitivity is 'Why a file is private or restricted: staff, leadership, board, hr, donor, personal, transition.';

create table if not exists public.drive_mine_state (
  id int primary key default 1 check (id = 1),
  status text not null default 'idle',
  started_at timestamptz,
  finished_at timestamptz,
  progress jsonb,
  error text,
  updated_at timestamptz not null default now()
);
insert into public.drive_mine_state (id) values (1) on conflict (id) do nothing;
alter table public.drive_mine_state enable row level security;
drop policy if exists drive_mine_state_admin_read on public.drive_mine_state;
create policy drive_mine_state_admin_read on public.drive_mine_state for select to authenticated using (public.is_hub_admin());
revoke all on public.drive_mine_state from anon, authenticated;
grant select on public.drive_mine_state to authenticated;
comment on table public.drive_mine_state is 'One row: the last drive-mine inventory pass (status, progress by shared drive, error). Admins read; the service role writes.';

create or replace function public.drive_inventory_paths()
returns void
language sql
security definer
set search_path to ''
as $$
  with recursive chain as (
    select f.file_id, f.parent_id as cur, ''::text as path, 0 as depth from public.drive_inventory f
    union all
    select c.file_id, p.parent_id, p.name || case when c.path = '' then '' else '/' || c.path end, c.depth + 1
    from chain c join public.drive_inventory p on p.file_id = c.cur and p.mime = 'application/vnd.google-apps.folder'
    where c.depth < 30
  ), best as (
    select distinct on (file_id) file_id, path from chain order by file_id, depth desc
  )
  update public.drive_inventory d
     set path = case d.source when 'shared_drive' then coalesce(d.drive_name, 'Shared drive') when 'my_drive' then 'My Drive' when 'shared_with_me' then 'Shared with me' else 'Drive' end
                || case when b.path <> '' then '/' || b.path else '' end
    from best b where b.file_id = d.file_id;
$$;
revoke all on function public.drive_inventory_paths() from public, anon, authenticated;
grant execute on function public.drive_inventory_paths() to service_role;
comment on function public.drive_inventory_paths() is 'Fills drive_inventory.path from the folder rows (shared drive or My Drive, then the folders). Called by drive-mine after each inventory. Access: service role only.';
