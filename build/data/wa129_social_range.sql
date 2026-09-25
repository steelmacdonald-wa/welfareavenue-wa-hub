-- wa129 (25/09/26): social_range(p_from, p_to), the analytics for any range: a week to everything the platforms kept.
-- p_from null = all time (from the first daily number or the first post, whichever is earlier); p_to null = today.
-- Buckets: by day up to 120 days, by week up to 540, by month beyond. The previous period only counts when it is
-- at least 90% covered, so a two-year range does not compare against the one day before the data starts.
-- Staff and board viewers only (and the service role). posts_all: every post in the range (up to 3,000), captions
-- cut to 280 characters; coverage: how far back each platform goes.
create or replace function public.social_range(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_to date := coalesce(p_to, current_date);
  v_from date;
  v_days int;
  v_prev_from date; v_prev_to date;
  v_bucket text;
  v_accounts jsonb; v_totals jsonb; v_series jsonb; v_posts jsonb; v_all jsonb; v_pages jsonb; v_note jsonb; v_insights jsonb; v_followers jsonb; v_cov jsonb;
begin
  if not (public.is_wa_staff() or public.is_board_viewer() or current_user in ('service_role', 'postgres')) then
    raise exception 'not allowed';
  end if;
  v_from := coalesce(p_from, least((select min(day) from public.social_daily), (select min(published_at)::date from public.social_posts where platform <> 'ga4')), v_to - 29);
  if v_from > v_to then v_from := v_to; end if;
  v_days := (v_to - v_from) + 1;
  v_prev_to := v_from - 1;
  v_prev_from := v_from - v_days;
  v_bucket := case when v_days <= 120 then 'day' when v_days <= 540 then 'week' else 'month' end;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.platform), '[]'::jsonb) into v_accounts from public.social_accounts a;

  select coalesce(jsonb_object_agg(platform, m), '{}'::jsonb) into v_totals from (
    select platform, jsonb_object_agg(metric, jsonb_build_object('cur', cur, 'prev', case when prev_days >= greatest(1, floor(v_days * 0.9)) then prev end)) as m from (
      select platform, metric,
        sum(value) filter (where day between v_from and v_to) as cur,
        sum(value) filter (where day between v_prev_from and v_prev_to) as prev,
        count(distinct day) filter (where day between v_prev_from and v_prev_to) as prev_days
      from public.social_daily
      where day between v_prev_from and v_to and metric <> 'followers'
      group by platform, metric
    ) x group by platform
  ) y;

  select coalesce(jsonb_object_agg(platform, jsonb_build_object('now', now_v, 'then', then_v, 'day', now_day)), '{}'::jsonb) into v_followers from (
    select platform,
      (select value from public.social_daily d2 where d2.platform = d.platform and d2.metric = 'followers' and d2.day <= v_to order by day desc limit 1) as now_v,
      (select day from public.social_daily d2 where d2.platform = d.platform and d2.metric = 'followers' and d2.day <= v_to order by day desc limit 1) as now_day,
      (select value from public.social_daily d3 where d3.platform = d.platform and d3.metric = 'followers' and d3.day <= v_from order by day desc limit 1) as then_v
    from public.social_daily d where metric = 'followers' group by platform
  ) f;

  select coalesce(jsonb_object_agg(platform, m), '{}'::jsonb) into v_series from (
    select platform, jsonb_object_agg(metric, pts) as m from (
      select platform, metric, jsonb_agg(jsonb_build_array(b, v) order by b) as pts from (
        select platform, metric, b,
          case when metric = 'followers' then (array_agg(value order by day desc))[1] else sum(value) end as v
        from (
          select platform, metric, day, value,
            case v_bucket when 'day' then day when 'week' then date_trunc('week', day)::date else date_trunc('month', day)::date end as b
          from public.social_daily where day between v_from and v_to
        ) r group by platform, metric, b
      ) q group by platform, metric
    ) s group by platform
  ) t;

  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_posts from (
    select id, platform, external_id, url, kind, caption, thumb_url, published_at, reach, views, likes, comments, shares, saves, clicks, engagement, source
    from public.social_posts where platform <> 'ga4' and published_at >= v_from and published_at < v_to + 1
    order by coalesce(engagement, 0) + coalesce(views, 0) / 20.0 + coalesce(reach, 0) / 20.0 desc limit 24
  ) p;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.published_at desc), '[]'::jsonb) into v_all from (
    select id, platform, external_id, url, kind, left(caption, 280) as caption, thumb_url, published_at, reach, views, likes, comments, shares, saves, clicks, engagement
    from public.social_posts where platform <> 'ga4' and published_at >= v_from and published_at < v_to + 1
    order by published_at desc limit 3000
  ) p;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.views desc nulls last), '[]'::jsonb) into v_pages from (
    select id, platform, external_id, url, kind, caption, published_at, reach, views from public.social_posts where platform = 'ga4' order by views desc nulls last limit 20
  ) p;

  select coalesce(jsonb_object_agg(platform, c), '{}'::jsonb) into v_cov from (
    select d.platform, jsonb_build_object('from', min(d.day), 'to', max(d.day), 'days', count(distinct d.day),
      'posts', (select count(*) from public.social_posts sp where sp.platform = d.platform),
      'posts_from', (select min(published_at) from public.social_posts sp where sp.platform = d.platform)) as c
    from public.social_daily d group by d.platform
  ) c;

  select to_jsonb(n) into v_note from (select id, week_start, platform, body, model, created_at from public.social_notes where kind = 'note' order by created_at desc limit 1) n;
  select to_jsonb(n) into v_insights from (select id, week_start, body, data, model, created_at from public.social_notes where kind = 'insights' order by created_at desc limit 1) n;

  return jsonb_build_object('days', v_days, 'from', v_from, 'to', v_to, 'prev_from', v_prev_from, 'prev_to', v_prev_to, 'bucket', v_bucket,
    'accounts', v_accounts, 'totals', v_totals, 'followers', v_followers, 'series', v_series, 'posts', v_posts, 'posts_all', v_all, 'pages', v_pages,
    'coverage', v_cov, 'note', v_note, 'insights', v_insights);
end $function$;

revoke all on function public.social_range(date, date) from public, anon;
grant execute on function public.social_range(date, date) to authenticated, service_role;
