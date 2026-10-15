-- wave253 (15/10/26): paid ads beside the organic numbers in the Content Studio's analytics.
-- Steel, 14/10/26 (the Meta additions): "Ads next to organic — Marketing API read-only: ad accounts under the business,
-- campaigns and insights (spend, reach, results) shown beside the organic numbers in the Studio analytics."
--
-- What this migration does:
--   1. social_ad_daily: one row per ad account, campaign and day (spend, impressions, reach, clicks, results), read by the
--      social-ads edge function from the Marketing API (GET /act_<id>/insights, level campaign, one row a day) with the vault
--      token. Read-only: nothing in the Hub creates, changes or pauses an ad.
--   2. The cron wa-social-ads: every day at 07:40 UTC (03:40 Toronto) the last 30 days are read again, because Meta revises a
--      day's numbers for up to 28 days.
--   Totals for a period (reach is not a sum of days) are kept by social-ads in hub_settings studio_ads_summary.

create table if not exists public.social_ad_daily (
  account_id text not null,
  campaign_id text not null,
  day date not null,
  campaign_name text,
  objective text,
  currency text,
  spend numeric(12, 2) not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  results integer not null default 0,
  result_type text,
  actions jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (account_id, campaign_id, day),
  constraint social_ad_daily_account_chk check (account_id ~ '^act_[0-9]+$')
);
create index if not exists social_ad_daily_day_idx on public.social_ad_daily (day desc);
comment on table public.social_ad_daily is 'wave253: Meta ads, one row per ad account, campaign and day, from the Marketing API (insights, level campaign, time_increment 1), read-only. Written by social-ads with the service key (cron wa-social-ads daily, and Refresh in the Studio''s analytics); read by staff and board viewers like social_posts.';
comment on column public.social_ad_daily.account_id is 'wave253: the ad account (act_<id>) under the business 686100608981552.';
comment on column public.social_ad_daily.spend is 'wave253: the amount spent that day, in the account''s currency (CAD).';
comment on column public.social_ad_daily.reach is 'wave253: people reached that day. Reach is not additive across days: a period''s reach comes from studio_ads_summary, not a sum of rows.';
comment on column public.social_ad_daily.results is 'wave253: the campaign''s results that day, counted from the action that matches its objective (leads for lead ads, link clicks for traffic, messaging conversations for messages, post engagement for engagement, and so on); result_type names it.';
comment on column public.social_ad_daily.actions is 'wave253: every action Meta counted that day ({action_type: count}), for the detail view.';
alter table public.social_ad_daily enable row level security;
create policy social_ad_daily_read on public.social_ad_daily for select to authenticated using (public.is_wa_staff() or public.is_board_viewer());
grant select on public.social_ad_daily to authenticated;

select cron.schedule('wa-social-ads', '40 7 * * *', $c$select public.call_edge('social-ads', '{"action":"sync","days":30}'::jsonb)$c$);
