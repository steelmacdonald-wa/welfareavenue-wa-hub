-- wave160 (28/09/26): the CRM's Reports tab (#crm/reports).
-- One read-only function, crm_report(fiscal year), returns what the tab shows for a fiscal year (1 October to 30 September):
-- gifts (by month against the year before, by kind, campaign, source and size, their receipt status), donors (new, retained,
-- recaptured, lapsed, the retention rate, who gave last year and not yet this year, the largest donors), volunteering (servings,
-- people, events, new and returning volunteers, retention, by month and role, the most servings, the hours and meals where they
-- were recorded, the application funnel), and the emails sent and form answers of the year.
-- It runs with the caller's rights (security invoker), so every table's RLS applies, and it checks the CRM page first.
-- Counting rules are the CRM's: a serving is a Confirmed roster row at a completed volunteer event (as in crm_contacts_v); a gift
-- counts on the day it was received in Montreal time; a person without a volunteer record counts once by their name.

create or replace function public.crm_report(p_fy int default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_cur int := extract(year from (now() at time zone 'America/Toronto'))::int - case when extract(month from (now() at time zone 'America/Toronto')) >= 10 then 0 else 1 end;
  v_fy int := coalesce(p_fy, v_cur);
  v_from date; v_to date; v_pfrom date; v_pto date; v_through date; v_pthrough date;
  v_years jsonb; v_gifts jsonb; v_donors jsonb; v_vol jsonb; v_mail jsonb; v_forms jsonb;
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then
    raise exception 'The CRM is for the Welfare Avenue team.';
  end if;
  if v_fy < 2015 or v_fy > v_cur then raise exception 'No report for that year.'; end if;
  v_from := make_date(v_fy, 10, 1);
  v_to := make_date(v_fy + 1, 9, 30);
  v_pfrom := make_date(v_fy - 1, 10, 1);
  v_pto := make_date(v_fy, 9, 30);
  v_through := least(v_today, v_to);
  v_pthrough := (v_through - interval '1 year')::date;

  /* the fiscal years with a gift or a serving, and this one */
  select coalesce(jsonb_agg(y order by y desc), '[]'::jsonb) into v_years
  from (
    select distinct extract(year from d)::int - case when extract(month from d) >= 10 then 0 else 1 end as y
    from (
      select (x.donated_at at time zone 'America/Toronto')::date as d from public.crm_donations x where x.donated_at is not null
      union all
      select e.event_date from public.volunteer_events e where e.status = 'completed' and e.event_date is not null
      union all
      select v_today
    ) a
  ) b;

  /* ---------- gifts ---------- */
  with g as (
    select d.id, d.contact_id, coalesce(d.amount, 0)::numeric as amount, coalesce(nullif(d.kind, ''), 'donation') as gkind,
           lower(coalesce(d.platform, '')) as platform, lower(coalesce(d.method, '')) as method,
           nullif(btrim(coalesce(d.campaign, '')), '') as campaign, (d.donated_at at time zone 'America/Toronto')::date as gday
    from public.crm_donations d
    where d.donated_at is not null
  ),
  cur as (select * from g where gday between v_from and v_to),
  prv as (select * from g where gday between v_pfrom and v_pto),
  months as (select generate_series(v_from, v_to, interval '1 month')::date as m)
  select jsonb_build_object(
    'total', coalesce((select sum(amount) from cur), 0),
    'count', (select count(*) from cur),
    'donors', (select count(distinct contact_id) from cur),
    'average', (select round(avg(amount), 2) from cur),
    'median', (select round((percentile_cont(0.5) within group (order by amount))::numeric, 2) from cur),
    'largest', (select max(amount) from cur),
    'prev', jsonb_build_object('total', coalesce((select sum(amount) from prv), 0), 'count', (select count(*) from prv),
                               'donors', (select count(distinct contact_id) from prv)),
    'prev_to_date', jsonb_build_object('through', v_pthrough, 'total', coalesce((select sum(amount) from prv where gday <= v_pthrough), 0),
                                       'count', (select count(*) from prv where gday <= v_pthrough),
                                       'donors', (select count(distinct contact_id) from prv where gday <= v_pthrough)),
    'by_month', (select jsonb_agg(jsonb_build_object(
                    'month', to_char(m, 'YYYY-MM'),
                    'total', coalesce((select sum(amount) from cur where date_trunc('month', gday)::date = m), 0),
                    'count', (select count(*) from cur where date_trunc('month', gday)::date = m),
                    'prev_total', coalesce((select sum(amount) from prv where date_trunc('month', gday)::date = (m - interval '1 year')::date), 0),
                    'prev_count', (select count(*) from prv where date_trunc('month', gday)::date = (m - interval '1 year')::date)) order by m)
                 from months),
    'by_kind', coalesce((select jsonb_agg(jsonb_build_object('kind', gkind, 'count', n, 'total', t) order by t desc, gkind)
                         from (select gkind, count(*) as n, sum(amount) as t from cur group by gkind) k), '[]'::jsonb),
    'by_campaign', coalesce((select jsonb_agg(jsonb_build_object('campaign', campaign, 'count', n, 'total', t, 'donors', p) order by t desc, campaign)
                             from (select campaign, count(*) as n, sum(amount) as t, count(distinct contact_id) as p from cur group by campaign) k), '[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'method', method, 'count', n, 'total', t) order by t desc, platform, method)
                           from (select platform, method, count(*) as n, sum(amount) as t from cur group by platform, method) k), '[]'::jsonb),
    'bands', (select jsonb_agg(jsonb_build_object('band', b.label, 'min', b.lo,
                  'count', (select count(*) from cur where amount >= b.lo and (b.hi is null or amount < b.hi)),
                  'total', coalesce((select sum(amount) from cur where amount >= b.lo and (b.hi is null or amount < b.hi)), 0)) order by b.lo)
              from (values ('Under $50', 0::numeric, 50::numeric), ('$50 to $99', 50, 100), ('$100 to $249', 100, 250),
                           ('$250 to $499', 250, 500), ('$500 to $999', 500, 1000), ('$1,000 and more', 1000, null)) as b(label, lo, hi)),
    'receipts', coalesce((select jsonb_object_agg(receipt_status, n)
                          from (select r.receipt_status, count(*) as n from public.crm_gift_receipts_v r
                                where r.gift_id in (select id from cur) group by r.receipt_status) x), '{}'::jsonb)
  ) into v_gifts;

  /* ---------- donors: new, retained, recaptured, lapsed ---------- */
  with g as (
    select d.contact_id, coalesce(d.amount, 0)::numeric as amount, (d.donated_at at time zone 'America/Toronto')::date as gday
    from public.crm_donations d
    where d.donated_at is not null and d.contact_id is not null
  ),
  firsts as (select contact_id, min(gday) as first_day from g group by contact_id),
  dc as (select distinct contact_id from g where gday between v_from and v_to),
  dp as (select distinct contact_id from g where gday between v_pfrom and v_pto),
  lapsed as (select contact_id from dp except select contact_id from dc)
  select jsonb_build_object(
    'this_year', (select count(*) from dc),
    'last_year', (select count(*) from dp),
    'new', (select count(*) from dc join firsts f using (contact_id) where f.first_day >= v_from),
    'retained', (select count(*) from dc join dp using (contact_id)),
    'recaptured', (select count(*) from dc join firsts f using (contact_id)
                   where f.first_day < v_from and not exists (select 1 from dp where dp.contact_id = dc.contact_id)),
    'lapsed', (select count(*) from lapsed),
    'retention_rate', case when (select count(*) from dp) > 0
                           then round(100.0 * (select count(*) from dc join dp using (contact_id)) / (select count(*) from dp), 1) end,
    'lapsed_list', coalesce((select jsonb_agg(x order by (x->>'prev_total')::numeric desc, x->>'name')
                             from (select jsonb_build_object(
                                     'contact_id', l.contact_id, 'name', c.full_name,
                                     'prev_total', (select sum(amount) from g where g.contact_id = l.contact_id and gday between v_pfrom and v_pto),
                                     'last_day', (select max(gday) from g where g.contact_id = l.contact_id),
                                     'gifts_ever', (select count(*) from g where g.contact_id = l.contact_id),
                                     'total_ever', (select sum(amount) from g where g.contact_id = l.contact_id)) as x
                                   from lapsed l left join public.crm_contacts c on c.id = l.contact_id
                                   limit 500) y), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('contact_id', contact_id, 'name', name, 'count', n, 'total', t) order by t desc, name)
                     from (select g.contact_id, max(c.full_name) as name, count(*) as n, sum(g.amount) as t
                           from g left join public.crm_contacts c on c.id = g.contact_id
                           where g.gday between v_from and v_to
                           group by g.contact_id order by sum(g.amount) desc, max(c.full_name) limit 10) k), '[]'::jsonb)
  ) into v_donors;

  /* ---------- volunteering ---------- */
  with sv as (
    select er.event_id, er.person_id,
           coalesce('p' || er.person_id::text, 'n' || lower(btrim(coalesce(er.person_name, '')))) as pkey,
           coalesce(nullif(er.role, ''), 'other') as vrole, e.event_date as sday, coalesce(nullif(e.kind, ''), 'service') as ekind,
           er.person_name
    from public.event_roster er
    join public.volunteer_events e on e.id = er.event_id
    where er.status = 'Confirmed' and e.status = 'completed' and e.event_date is not null
  ),
  cur as (select * from sv where sday between v_from and v_to),
  prv as (select * from sv where sday between v_pfrom and v_pto),
  vfirst as (select pkey, min(sday) as first_day from sv group by pkey),
  months as (select generate_series(v_from, v_to, interval '1 month')::date as m)
  select jsonb_build_object(
    'servings', (select count(*) from cur),
    'people', (select count(distinct pkey) from cur),
    'events', (select count(distinct event_id) from cur),
    'events_by_kind', coalesce((select jsonb_object_agg(ekind, n) from (select ekind, count(distinct event_id) as n from cur group by ekind) k), '{}'::jsonb),
    'new', (select count(*) from (select distinct pkey from cur) p join vfirst f using (pkey) where f.first_day >= v_from),
    'retained', (select count(*) from (select distinct pkey from cur) a join (select distinct pkey from prv) b using (pkey)),
    'prev', jsonb_build_object('servings', (select count(*) from prv), 'people', (select count(distinct pkey) from prv),
                               'events', (select count(distinct event_id) from prv)),
    'prev_to_date', jsonb_build_object('through', v_pthrough, 'servings', (select count(*) from prv where sday <= v_pthrough),
                                       'people', (select count(distinct pkey) from prv where sday <= v_pthrough),
                                       'events', (select count(distinct event_id) from prv where sday <= v_pthrough)),
    'by_month', (select jsonb_agg(jsonb_build_object(
                    'month', to_char(m, 'YYYY-MM'),
                    'servings', (select count(*) from cur where date_trunc('month', sday)::date = m),
                    'events', (select count(distinct event_id) from cur where date_trunc('month', sday)::date = m),
                    'people', (select count(distinct pkey) from cur where date_trunc('month', sday)::date = m),
                    'prev_servings', (select count(*) from prv where date_trunc('month', sday)::date = (m - interval '1 year')::date)) order by m)
                 from months),
    'by_role', coalesce((select jsonb_agg(jsonb_build_object('role', vrole, 'servings', n, 'people', p) order by n desc, vrole)
                         from (select vrole, count(*) as n, count(distinct pkey) as p from cur group by vrole) k), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('contact_id', contact_id, 'name', name, 'servings', n) order by n desc, name)
                     from (select max(c.id) as contact_id, coalesce(max(c.full_name), max(cur.person_name)) as name, count(*) as n
                           from cur left join public.crm_contacts c on c.volunteer_id = cur.person_id and c.merged_into is null
                           group by cur.pkey order by count(*) desc, coalesce(max(c.full_name), max(cur.person_name)) limit 10) k), '[]'::jsonb),
    'hours', jsonb_build_object(
      'recorded', coalesce((select sum(h.hours) from public.crm_volunteer_history h
                            where h.attended and (h.event_at at time zone 'America/Toronto')::date between v_from and v_to), 0),
      'servings_with_hours', (select count(*) from public.crm_volunteer_history h
                              where h.attended and h.hours > 0 and (h.event_at at time zone 'America/Toronto')::date between v_from and v_to),
      'last_recorded', (select max((h.event_at at time zone 'America/Toronto')::date) from public.crm_volunteer_history h where h.attended and h.hours > 0)),
    'meals', (select jsonb_build_object(
                'served', coalesce(sum(s.meals_served) filter (where md between v_from and v_to), 0),
                'events', count(*) filter (where md between v_from and v_to),
                'last_recorded', max(md))
              from (select s.meals_served, coalesce(e.event_date, (s.starts_at at time zone 'America/Toronto')::date) as md
                    from public.site_events s left join public.volunteer_events e on e.id = s.volunteer_event_id
                    where s.meals_served is not null) s),
    'applied', (select jsonb_build_object('applied', count(*), 'served1', count(*) filter (where n >= 1),
                                          'served2', count(*) filter (where n >= 2), 'served3', count(*) filter (where n >= 3))
                from (select vp.id, (select count(*) from sv where sv.person_id = vp.id and sv.sday >= vp.last_applied) as n
                      from public.volunteer_people vp
                      where vp.last_applied between v_from and v_to) a)
  ) into v_vol;

  /* ---------- the emails of the year (tests left out) ---------- */
  select jsonb_build_object(
    'sent', count(*),
    'delivered', count(*) filter (where s.delivered_at is not null),
    'opened', count(*) filter (where s.opened_at is not null),
    'clicked', count(*) filter (where s.clicked_at is not null),
    'bounced', count(*) filter (where s.bounced_at is not null),
    'unsubscribed', count(*) filter (where s.unsubscribed_at is not null),
    'campaigns', count(distinct s.campaign_id),
    'from_campaigns', count(*) filter (where s.campaign_id is not null),
    'from_automations', count(*) filter (where s.automation_id is not null)
  ) into v_mail
  from public.crm_email_sends s
  where not coalesce(s.is_test, false) and s.sent_at is not null
    and (s.sent_at at time zone 'America/Toronto')::date between v_from and v_to;

  /* ---------- the form answers of the year (tests left out) ---------- */
  select coalesce(jsonb_agg(jsonb_build_object('form_id', f.id, 'title', f.title, 'slug', f.slug, 'answers', x.n) order by x.n desc, f.title), '[]'::jsonb)
  into v_forms
  from (select form_id, count(*) as n from public.crm_form_submissions
        where not coalesce(is_test, false) and (created_at at time zone 'America/Toronto')::date between v_from and v_to
        group by form_id) x
  join public.crm_forms f on f.id = x.form_id;

  return jsonb_build_object(
    'fy', v_fy, 'label', v_fy::text || '-' || right((v_fy + 1)::text, 2), 'prev_label', (v_fy - 1)::text || '-' || right(v_fy::text, 2),
    'from', v_from, 'to', v_to, 'through', v_through, 'in_progress', v_today < v_to, 'today', v_today, 'years', v_years,
    'gifts', v_gifts, 'donors', v_donors, 'volunteers', v_vol, 'email', v_mail, 'forms', v_forms, 'at', now());
end $$;

revoke all on function public.crm_report(int) from public, anon;
grant execute on function public.crm_report(int) to authenticated;

comment on function public.crm_report(int) is 'The CRM''s Reports tab (wave160): one fiscal year (1 October to 30 September; the year it starts, the current one when NULL) as JSON: gifts (by month against the year before, kind, campaign, source, size, receipt status), donors (new, retained, recaptured, lapsed, retention rate, who gave last year and not yet this year, the largest), volunteering (servings, people, events, new and returning, retention, by month and role, the most servings, hours and meals where recorded, the application funnel), the emails sent and the form answers. Runs with the caller''s rights (RLS applies) and checks the CRM page first; read-only.';
