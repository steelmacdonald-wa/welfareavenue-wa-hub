-- Welfare Avenue photo library (25/09/26): one row per photo, three renditions in
-- content-images/photos/{full,web,thumb}/<key>.jpg. Read: staff and board; write: staff;
-- delete: hub admins (the hub archives instead of deleting).
-- Applied as migration wa118c_photo_library (version 20260925152446). Kept here for the record.
create table if not exists public.wa_photos (
  id bigint generated always as identity primary key,
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  title text not null check (length(title) between 1 and 160),
  alt_text text check (alt_text is null or length(alt_text) <= 400),
  caption text,
  description text,
  taken_on date,
  date_note text,
  season text check (season is null or season in ('winter','spring','summer','autumn')),
  place text,
  event text,
  scene text check (scene is null or scene in ('serving','volunteers','food','media','portrait','setup','other')),
  tags text[] not null default '{}',
  usage text not null default 'check' check (usage in ('ready','crop','consent','internal','check')),
  usage_note text,
  people text,
  partner text[] not null default '{}',
  branding text check (branding is null or branding in ('legacy','current','none')),
  notes text,
  series text,
  is_pick boolean not null default false,
  orientation text check (orientation is null or orientation in ('landscape','portrait','square')),
  width integer,
  height integer,
  focal_x real not null default 0.5 check (focal_x between 0 and 1),
  focal_y real not null default 0.5 check (focal_y between 0 and 1),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  best_for text[] not null default '{}',
  credit text,
  path_full text,
  path_web text,
  path_thumb text,
  bytes_full integer,
  bytes_web integer,
  bytes_thumb integer,
  version integer not null default 1,
  status text not null default 'ready' check (status in ('ready','needs_labels','archived')),
  source text,
  labelled_by text,
  ai_suggestion jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.wa_photos is 'Welfare Avenue photo library: labels, usage guidance and storage paths (content-images/photos/). usage: ready | crop (crop the named edge first) | consent (a community member or child is identifiable) | internal | check (not reviewed yet).';

create index if not exists wa_photos_taken_idx on public.wa_photos (taken_on desc nulls last);
create index if not exists wa_photos_tags_idx on public.wa_photos using gin (tags);
create index if not exists wa_photos_status_idx on public.wa_photos (status);

create or replace function public.wa_photos_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists wa_photos_touch on public.wa_photos;
create trigger wa_photos_touch before update on public.wa_photos for each row execute function public.wa_photos_touch();

alter table public.wa_photos enable row level security;
drop policy if exists wa_photos_read on public.wa_photos;
drop policy if exists wa_photos_insert on public.wa_photos;
drop policy if exists wa_photos_update on public.wa_photos;
drop policy if exists wa_photos_delete on public.wa_photos;
create policy wa_photos_read on public.wa_photos for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
create policy wa_photos_insert on public.wa_photos for insert to authenticated with check (public.is_wa_staff());
create policy wa_photos_update on public.wa_photos for update to authenticated using (public.is_wa_staff()) with check (public.is_wa_staff());
create policy wa_photos_delete on public.wa_photos for delete to authenticated using (public.is_hub_admin());
revoke all on public.wa_photos from anon;

create or replace view public.wa_photos_list with (security_invoker = true) as
select p.*,
  case when p.path_full is null then null else 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/' || p.path_full || '?v=' || p.version end as url_full,
  case when p.path_web is null then null else 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/' || p.path_web || '?v=' || p.version end as url_web,
  case when p.path_thumb is null then null else 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/' || p.path_thumb || '?v=' || p.version end as url_thumb
from public.wa_photos p;
revoke all on public.wa_photos_list from anon;
grant select on public.wa_photos_list to authenticated;

-- the router job that suggests labels for photos the team uploads later (vision-capable chain)
insert into public.ai_routes (task, label, chain, jev, mode, notes, updated_by)
values ('photo_label', 'Photo labels', array['anthropic/claude-sonnet-5','anthropic/claude-haiku-4.5','google/gemini-3.8-flash'], false, 'chain',
        'Photo library: reads a new photo and suggests the title, alt text, caption, tags, scene, season and usage (vision models only).', 'wave118c')
on conflict (task) do nothing;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('migration', 'wa118c_photo_library', 'applied', null, 'wa_photos + wa_photos_list + ai route photo_label', 'automation');
