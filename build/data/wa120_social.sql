-- wa120_social: Marketing analytics (Meta, Instagram, TikTok, LinkedIn, GA4)
-- Accounts the hub reads, one row of numbers per platform per day per metric,
-- the posts with their numbers, and the weekly note the AI writes.
create table if not exists public.social_accounts (
  id bigserial primary key,
  platform text not null check (platform in ('facebook','instagram','tiktok','linkedin','ga4','youtube')),
  external_id text,
  handle text,
  name text,
  url text,
  picture_url text,
  status text not null default 'pending',   -- connected | csv | pending | error
  last_sync_at timestamptz,
  last_error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);
create table if not exists public.social_daily (
  id bigserial primary key,
  platform text not null,
  account_id bigint references public.social_accounts(id) on delete cascade,
  day date not null,
  metric text not null,
  value numeric not null default 0,
  source text not null default 'api',
  updated_at timestamptz not null default now(),
  unique (platform, account_id, day, metric)
);
create index if not exists social_daily_day_idx on public.social_daily (day desc);
create table if not exists public.social_posts (
  id bigserial primary key,
  platform text not null,
  account_id bigint references public.social_accounts(id) on delete cascade,
  external_id text not null,
  url text,
  kind text,
  caption text,
  thumb_url text,
  published_at timestamptz,
  reach numeric, views numeric, likes numeric, comments numeric, shares numeric, saves numeric, clicks numeric,
  engagement numeric,
  raw jsonb,
  source text not null default 'api',
  updated_at timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists social_posts_pub_idx on public.social_posts (published_at desc);
create table if not exists public.social_notes (
  id bigserial primary key,
  week_start date not null,
  platform text,
  body text not null,
  model text,
  created_at timestamptz not null default now()
);

alter table public.social_accounts enable row level security;
alter table public.social_daily enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_notes enable row level security;
drop policy if exists social_accounts_read on public.social_accounts;
create policy social_accounts_read on public.social_accounts for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
drop policy if exists social_daily_read on public.social_daily;
create policy social_daily_read on public.social_daily for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
drop policy if exists social_posts_read on public.social_posts;
create policy social_posts_read on public.social_posts for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
drop policy if exists social_notes_read on public.social_notes;
create policy social_notes_read on public.social_notes for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
grant select on public.social_accounts, public.social_daily, public.social_posts, public.social_notes to authenticated;

-- One call for the page: accounts, the period totals against the previous
-- period, 90 days of series per platform, the top posts and the latest note.
create or replace function public.social_overview(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to date := current_date;
  v_from date := current_date - (p_days - 1);
  v_prev_from date := current_date - (2 * p_days - 1);
  v_prev_to date := current_date - p_days;
  v_accounts jsonb; v_totals jsonb; v_series jsonb; v_posts jsonb; v_note jsonb; v_followers jsonb;
begin
  if not (public.is_wa_staff() or public.is_board_viewer() or current_user in ('service_role', 'postgres')) then
    raise exception 'not allowed';
  end if;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.platform), '[]'::jsonb) into v_accounts from public.social_accounts a;
  -- summed metrics (reach, views, engagement...) for the period and the one before it
  select coalesce(jsonb_object_agg(platform, m), '{}'::jsonb) into v_totals from (
    select platform, jsonb_object_agg(metric, jsonb_build_object('cur', cur, 'prev', prev)) as m from (
      select platform, metric,
        sum(value) filter (where day between v_from and v_to) as cur,
        sum(value) filter (where day between v_prev_from and v_prev_to) as prev
      from public.social_daily
      where day >= v_prev_from and metric <> 'followers'
      group by platform, metric
    ) x group by platform
  ) y;
  -- followers: latest value and the value p_days ago
  select coalesce(jsonb_object_agg(platform, jsonb_build_object('now', now_v, 'then', then_v, 'day', now_day)), '{}'::jsonb) into v_followers from (
    select platform,
      (select value from public.social_daily d2 where d2.platform = d.platform and d2.metric = 'followers' order by day desc limit 1) as now_v,
      (select day from public.social_daily d2 where d2.platform = d.platform and d2.metric = 'followers' order by day desc limit 1) as now_day,
      (select value from public.social_daily d3 where d3.platform = d.platform and d3.metric = 'followers' and d3.day <= v_from order by day desc limit 1) as then_v
    from public.social_daily d where metric = 'followers' group by platform
  ) f;
  -- 90 day series per platform per metric: [[day, value], ...]
  select coalesce(jsonb_object_agg(platform, m), '{}'::jsonb) into v_series from (
    select platform, jsonb_object_agg(metric, pts) as m from (
      select platform, metric, jsonb_agg(jsonb_build_array(day, value) order by day) as pts
      from public.social_daily where day >= current_date - 89
      group by platform, metric
    ) s group by platform
  ) t;
  select coalesce(jsonb_agg(to_jsonb(p) order by coalesce(p.engagement, 0) + coalesce(p.views, 0) / 20.0 + coalesce(p.reach, 0) / 20.0 desc), '[]'::jsonb) into v_posts from (
    select id, platform, external_id, url, kind, caption, thumb_url, published_at, reach, views, likes, comments, shares, saves, clicks, engagement, source
    from public.social_posts where published_at >= v_from - 0 and published_at < v_to + 1
    order by coalesce(engagement, 0) + coalesce(views, 0) / 20.0 + coalesce(reach, 0) / 20.0 desc limit 24
  ) p;
  select to_jsonb(n) into v_note from (select id, week_start, platform, body, model, created_at from public.social_notes order by created_at desc limit 1) n;
  return jsonb_build_object('days', p_days, 'from', v_from, 'to', v_to, 'accounts', v_accounts, 'totals', v_totals, 'followers', v_followers, 'series', v_series, 'posts', v_posts, 'note', v_note);
end $$;
grant execute on function public.social_overview(int) to authenticated;
