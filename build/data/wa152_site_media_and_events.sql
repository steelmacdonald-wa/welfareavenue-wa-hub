-- wa152_site_media_and_events (27/09/26): the public website's events and their pictures move into Supabase, so the
-- rebuilt welfareavenue.com reads them from here and nothing is lost when the old server goes.
-- Applied as migration wa152_site_media_and_events; the anon read policy was split out afterwards (a policy for anon
-- must not call the staff-only helpers). Fill: 14 fundraising events from the old site's public feed, with 29 posters,
-- hero images and gallery photos in site-media/events/fundraising/. The volunteering events follow once the old
-- server answers again.
insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true) on conflict (id) do nothing;
create policy site_media_public_read on storage.objects for select using (bucket_id = 'site-media');
create policy site_media_leader_write on storage.objects for all to authenticated using (bucket_id = 'site-media' and public.is_hub_leader()) with check (bucket_id = 'site-media' and public.is_hub_leader());

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('fundraising', 'volunteering', 'program', 'other')),
  slug text not null unique,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  city text,
  description text,
  summary text,
  paragraphs text[] not null default '{}',
  meals_served int,
  ticket_url text,
  links jsonb not null default '{}'::jsonb,
  poster_url text,
  hero_url text,
  gallery text[] not null default '{}',
  published boolean not null default true,
  legacy jsonb not null default '{}'::jsonb,
  fund_event_id bigint references public.fund_events(id) on delete set null,
  volunteer_event_id bigint references public.volunteer_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);
create index if not exists site_events_kind_starts_idx on public.site_events (kind, starts_at desc);
alter table public.site_events enable row level security;
create policy site_events_anon_read on public.site_events for select to anon using (published);
create policy site_events_staff_read on public.site_events for select to authenticated using (published or public.is_wa_staff() or public.is_board_viewer());
create policy site_events_leader_write on public.site_events for all to authenticated using (public.is_hub_leader()) with check (public.is_hub_leader());
grant select on public.site_events to anon, authenticated;
grant insert, update, delete on public.site_events to authenticated;
create trigger site_events_touch before update on public.site_events for each row execute function public.crm_touch();

comment on table public.site_events is 'The public website''s events (welfareavenue.com): fundraising and volunteering events with their text, poster, hero image and gallery (files in the public site-media bucket). Anyone reads the published ones (the website is anonymous); staff and directors read all; leaders write. legacy keeps the old Django site''s ids and paths.';
comment on column public.site_events.kind is 'fundraising, volunteering, program or other.';
comment on column public.site_events.slug is 'The address on the website (unique), e.g. holiday-gift-baskets-2025.';
comment on column public.site_events.paragraphs is 'The extra paragraphs of a past event''s page (the old site''s par2 to par5).';
comment on column public.site_events.links is 'Social links for the event: ig, tiktok, fb, linkedin, twitter.';
comment on column public.site_events.gallery is 'Photo URLs (site-media bucket) shown on the event page.';
comment on column public.site_events.legacy is 'Where it came from: django_id, django_kind (FundraiserEvents or VolunteeringEvents), the original image paths, created and updated stamps.';
comment on column public.site_events.fund_event_id is 'The Hub''s fundraising calendar row (fund_events) for the same event, when matched.';
comment on column public.site_events.volunteer_event_id is 'The Hub''s serving event (volunteer_events) for the same event, when matched.';
