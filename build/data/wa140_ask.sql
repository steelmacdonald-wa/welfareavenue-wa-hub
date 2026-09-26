-- wave140 (26/09/26): what the Hub assistant (ask v13) reads from the Drive mining.
-- wa_fold: lower case without accents (Émilie finds emilie), for matching.
-- wa_story_context: the moments, year lines, partners, lessons and documents that match a question's terms, as
-- one jsonb. The caller says what the asker may see (p_lead: leaders and directors see leadership moments,
-- partners, lessons and sources; p_docs_lead: only leaders see leadership documents), so it runs as its owner
-- and only the service role may call it (the ask edge function); nobody signed in can call it directly.
create or replace function public.wa_fold(s text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(coalesce(s, '')), 'àáâãäåāçćčèéêëēėęìíîïīįłñńòóôõöøōœùúûüūÿýžźż', 'aaaaaaaccceeeeeeeiiiiiilnnoooooooouuuuuyyzzz')
$$;

create or replace function public.wa_story_context(p_terms text[], p_years int[] default '{}', p_story boolean default false, p_partners boolean default false,
  p_lead boolean default false, p_docs_lead boolean default false, p_limit int default 8)
returns jsonb
language sql stable security definer set search_path = '' as $$
with k as (
  select coalesce(array_agg(distinct x), '{}'::text[]) as t from unnest(coalesce(p_terms, '{}'::text[])) x where x ~ '^[a-z0-9]{3,}$'
),
h as (
  select x.*,
    (select coalesce(sum((case when public.wa_fold(x.title) like '%' || w || '%' then 3 else 0 end)
       + (case when public.wa_fold(array_to_string(x.partners, ' ') || ' ' || coalesce(x.city, '') || ' ' || x.kind) like '%' || w || '%' then 2 else 0 end)
       + (case when public.wa_fold(coalesce(x.summary, '')) like '%' || w || '%' then 1 else 0 end)), 0) from unnest(k.t) w) as score
  from public.wa_history x, k
  where x.status = 'published' and (p_lead or x.visibility = 'everyone')
),
hs as (
  select * from h
  where score >= 2 or extract(year from date_start)::int = any(coalesce(p_years, '{}'::int[])) or (p_story and highlight)
  order by score desc, highlight desc, date_start
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
),
p as (
  select x.*,
    (select coalesce(sum((case when public.wa_fold(x.name || ' ' || array_to_string(x.aka, ' ')) like '%' || w || '%' then 3 else 0 end)
       + (case when public.wa_fold(coalesce(x.summary, '') || ' ' || coalesce(x.kind, '') || ' ' || x.relationship || ' ' || coalesce(x.city, '')) like '%' || w || '%' then 1 else 0 end)), 0) from unnest(k.t) w) as score
  from public.wa_partners x, k
  where p_lead or x.visibility = 'everyone'
),
ps as (
  select * from p
  where score >= 2 or (p_partners and status in ('active', 'past'))
  order by score desc, case status when 'active' then 0 when 'past' then 1 when 'prospect' then 2 else 3 end, last_year desc nulls last, name
  limit case when p_partners then 30 else 6 end
),
l as (
  select x.*,
    (select coalesce(sum((case when public.wa_fold(x.lesson || ' ' || coalesce(x.topic, '')) like '%' || w || '%' then 2 else 0 end)
       + (case when public.wa_fold(coalesce(x.context, '') || ' ' || x.area) like '%' || w || '%' then 1 else 0 end)), 0) from unnest(k.t) w) as score
  from public.wa_lessons x, k
  where x.status = 'published' and (p_lead or x.visibility = 'everyone')
),
ls as (select * from l where score >= 2 order by score desc, id limit 6),
d as (
  select x.*,
    (select coalesce(sum((case when public.wa_fold(x.title) like '%' || w || '%' then 3 else 0 end)
       + (case when public.wa_fold(array_to_string(x.organisations, ' ') || ' ' || coalesce(x.resource_title, '')) like '%' || w || '%' then 2 else 0 end)
       + (case when public.wa_fold(coalesce(x.summary, '') || ' ' || array_to_string(x.topics, ' ')) like '%' || w || '%' then 1 else 0 end)), 0) from unnest(k.t) w) as score
  from public.wa_documents x, k
  where p_docs_lead or x.visibility = 'everyone'
),
ds as (select * from d where score >= 3 order by score desc, year desc nulls last limit 6)
select jsonb_build_object(
  'moments', coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(hs.date_start, 'YYYY-MM-DD'), 'precision', hs.date_precision,
      'end', to_char(hs.date_end, 'YYYY-MM-DD'), 'end_precision', hs.date_end_precision,
      'title', hs.title, 'summary', left(coalesce(hs.summary, ''), 420), 'kind', hs.kind, 'city', hs.city, 'partners', hs.partners, 'numbers', hs.numbers,
      'sources', (select coalesce(jsonb_agg(jsonb_build_object('name', z.s->>'name', 'url', z.s->>'url')), '[]'::jsonb)
                    from (select s from jsonb_array_elements(coalesce(hs.sources, '[]'::jsonb)) s
                           where p_lead or coalesce((s->>'lead')::boolean, false) = false limit 2) z)
    ) order by hs.date_start) from hs), '[]'::jsonb),
  'years', coalesce((select jsonb_agg(jsonb_build_object('year', y.year, 'summary', y.summary) order by y.year)
      from public.wa_history_years y where p_story or y.year = any(coalesce(p_years, '{}'::int[]))), '[]'::jsonb),
  'partners', coalesce((select jsonb_agg(jsonb_build_object('name', ps.name, 'aka', ps.aka, 'status', ps.status, 'relationship', ps.relationship, 'kind', ps.kind, 'city', ps.city,
      'first_year', ps.first_year, 'last_year', ps.last_year, 'summary', left(coalesce(ps.summary, ''), case when p_partners and ps.score < 2 then 160 else 400 end),
      'notes', case when ps.score >= 2 then left(coalesce(ps.notes, ''), 240) else '' end)) from ps), '[]'::jsonb),
  'lessons', coalesce((select jsonb_agg(jsonb_build_object('lesson', ls.lesson, 'context', left(coalesce(ls.context, ''), 300), 'area', ls.area, 'topic', ls.topic, 'years', ls.years)) from ls), '[]'::jsonb),
  'documents', coalesce((select jsonb_agg(jsonb_build_object('title', ds.title, 'kind', ds.kind, 'team', ds.team, 'year', ds.year, 'date', ds.doc_date, 'url', ds.url,
      'summary', left(coalesce(ds.summary, ''), 300), 'reuse', case when ds.reusable then coalesce(ds.resource_title, '') end)) from ds), '[]'::jsonb)
)
$$;

revoke all on function public.wa_story_context(text[], int[], boolean, boolean, boolean, boolean, int) from public, anon, authenticated;
grant execute on function public.wa_story_context(text[], int[], boolean, boolean, boolean, boolean, int) to service_role;

comment on function public.wa_fold(text) is 'Lower case without accents (Émilie finds emilie), for matching in wa_story_context (wave140).';
comment on function public.wa_story_context(text[], int[], boolean, boolean, boolean, boolean, int) is 'What the Hub assistant (ask v13) reads about Welfare Avenue''s past: the moments, year lines, partners, lessons and documents that match a question''s folded terms or years, as one jsonb. The caller says what the asker may see (p_lead: leadership moments, partners, lessons and sources; p_docs_lead: leadership documents). Access: service role only.';
