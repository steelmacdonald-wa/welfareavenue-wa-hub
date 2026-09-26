-- wave147: Google Search Console in Analytics. The search-console edge function reads how people find welfareavenue.com on
-- Google (clicks, impressions, click-through rate, average position; the top searches and pages) once a day, as soon as the
-- Hub's service account (or Steel's account) can see the site in Search Console. Read like the rest of Analytics.

create table if not exists public.search_sites (
  site_url text primary key,
  via text not null default 'sa' check (via in ('sa', 'steel')),
  permission text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  first_day date,
  last_day date
);

create table if not exists public.search_daily (
  site_url text not null references public.search_sites (site_url) on delete cascade,
  day date not null,
  clicks numeric not null default 0,
  impressions numeric not null default 0,
  ctr numeric,
  position numeric,
  primary key (site_url, day)
);

create table if not exists public.search_top (
  site_url text not null references public.search_sites (site_url) on delete cascade,
  kind text not null check (kind in ('query', 'page')),
  key text not null,
  period_start date not null,
  period_end date not null,
  clicks numeric not null default 0,
  impressions numeric not null default 0,
  ctr numeric,
  position numeric,
  primary key (site_url, kind, key)
);

alter table public.search_sites enable row level security;
alter table public.search_daily enable row level security;
alter table public.search_top enable row level security;
drop policy if exists search_sites_read on public.search_sites;
create policy search_sites_read on public.search_sites for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
drop policy if exists search_daily_read on public.search_daily;
create policy search_daily_read on public.search_daily for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
drop policy if exists search_top_read on public.search_top;
create policy search_top_read on public.search_top for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
revoke all on public.search_sites, public.search_daily, public.search_top from anon;
grant select on public.search_sites, public.search_daily, public.search_top to authenticated;

comment on table public.search_sites is 'Google Search Console (wave147): the site the Hub reads (siteUrl as Search Console names it: https://welfareavenue.com/ or sc-domain:welfareavenue.com), how (via: the Hub''s service account added as a user, or Steel''s account through domain-wide delegation), and the last read. Connected by search-console on its own as soon as a site is visible.';
comment on table public.search_daily is 'Google Search Console (wave147): per day, clicks, impressions, click-through rate and average position for the site in Google Search (web). Google reports about three days late.';
comment on table public.search_top is 'Google Search Console (wave147): the top searches (kind query) and pages (kind page) over the last 28 days of data, replaced at each read.';
