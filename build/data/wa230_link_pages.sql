-- wave230: link pages (Steel, 09/10/26): "a linktree section of the studio with the ability to track insights on who clicking
-- what link ... similar to linktree pro but much better". His choices: anonymous insights with no cookies, a person named only
-- when they sign up (the CRM forms and the donation page, matched server-side on the same network within 2 hours); several
-- pages (the bio page plus campaign, event and city pages); smart links (schedules, featured, A/B tests, fallbacks); sign-up,
-- volunteer and donation blocks; content blocks (latest Instagram posts, a YouTube video, events, impact numbers, English
-- and French); a tracked address per source and QR codes, with a weekly summary.

create table if not exists public.link_pages (
  id bigserial primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  title text not null default 'Welfare Avenue', title_fr text,
  bio text, bio_fr text,
  avatar_url text,
  theme jsonb not null default '{"preset":"green"}'::jsonb,
  socials jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('live', 'draft', 'archived')),
  created_by text, updated_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz);
comment on table public.link_pages is 'wave230: the Content Studio''s link pages. slug main is hub.welfareavenue.com/links (the bio link); any other slug is /links/<slug>. blocks is the ordered list the public page draws (link, featured, header, text, form, donate, youtube, instagram, events, impact, socials); link blocks carry a short_links code so the go function redirects and counts. Staff read; the marketing team and admins write.';

create table if not exists public.link_page_sources (
  id bigserial primary key,
  page_id bigint references public.link_pages(id),
  code text not null check (code ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  label text not null,
  kind text not null default 'other' check (kind in ('platform', 'qr', 'email', 'print', 'partner', 'other')),
  active boolean not null default true,
  created_by text, created_at timestamptz not null default now());
create unique index if not exists link_page_sources_code_idx on public.link_page_sources (coalesce(page_id, 0), code);
comment on table public.link_page_sources is 'wave230: where a link page visit comes from: /links/<slug>?s=<code> (each platform''s bio, each printed QR code, an email, a partner). A visit with no ?s is credited from the app it opened in or the referring site.';

create table if not exists public.link_page_events (
  id bigserial primary key,
  page_id bigint not null references public.link_pages(id),
  at timestamptz not null default now(),
  kind text not null check (kind in ('view', 'click')),
  block_id text, link_id bigint, variant text,
  src text, src_detail text,
  visitor text, repeat_visit boolean,
  lang text, device text, os text, browser text,
  country text, region text, city text, tz text,
  ipm text,
  is_test boolean not null default false);
create index if not exists link_page_events_page_idx on public.link_page_events (page_id, at);
create index if not exists link_page_events_ipm_idx on public.link_page_events (ipm, at) where ipm is not null;
create index if not exists link_page_events_visitor_idx on public.link_page_events (visitor, at);
comment on table public.link_page_events is 'wave230: one row per link page view or click. No cookie and no address: visitor is a keyed hash of the network and the browser that changes every month (unique and returning visitors within the month); ipm is the same keyed network hash the CRM forms and the donation page keep, so a sign-up or a gift soon after a click is credited to the page, the link and the source. Written by the linkpage and go functions only.';

alter table public.short_links add column if not exists fallback_url text;
comment on column public.short_links.fallback_url is 'wave230: where a switched-off link goes (else the page''s fallback, else welfareavenue.com)';

alter table public.link_pages enable row level security;
alter table public.link_page_sources enable row level security;
alter table public.link_page_events enable row level security;
create policy link_pages_read on public.link_pages for select to authenticated using (public.is_wa_staff());
create policy link_pages_write on public.link_pages for insert to authenticated with check (public.wa225_marketing());
create policy link_pages_edit on public.link_pages for update to authenticated using (public.wa225_marketing()) with check (public.wa225_marketing());
create policy link_page_sources_read on public.link_page_sources for select to authenticated using (public.is_wa_staff());
create policy link_page_sources_write on public.link_page_sources for insert to authenticated with check (public.wa225_marketing());
create policy link_page_sources_edit on public.link_page_sources for update to authenticated using (public.wa225_marketing()) with check (public.wa225_marketing());
create policy link_page_events_read on public.link_page_events for select to authenticated using (public.wa225_marketing() or public.wa225_publisher());
grant select, insert, update on public.link_pages, public.link_page_sources to authenticated;
grant select on public.link_page_events to authenticated;
grant usage, select on sequence public.link_pages_id_seq, public.link_page_sources_id_seq to authenticated;

create or replace function public.wa230_touch() returns trigger language plpgsql set search_path to '' as $$
begin new.updated_at := now(); if new.status = 'live' and (old.status is distinct from 'live') then new.published_at := now(); end if; return new; end $$;
create or replace trigger trg_wa230_touch before update on public.link_pages for each row execute function public.wa230_touch();

-- sign-ups and gifts that followed a click on a link page (last click before it, same network, within 2 hours)
create or replace function public.wa230_conversions(p_days int default 30)
returns table (at timestamptz, kind text, ref text, title text, contact_id bigint, contact_name text, completed boolean,
               page_id bigint, src text, block_id text, variant text, clicked_at timestamptz)
language plpgsql stable security definer set search_path to '' as $$
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.wa225_marketing() or public.wa225_publisher()) then raise exception 'the marketing team and admins only' using errcode = '42501'; end if;
  return query
  select s.created_at, 'form'::text, f.slug, f.title, s.contact_id, c.full_name, true, e.page_id, e.src, e.block_id, e.variant, e.at
  from public.crm_form_submissions s
  join public.crm_forms f on f.id = s.form_id
  left join public.crm_contacts c on c.id = s.contact_id
  cross join lateral (select x.* from public.link_page_events x where x.kind = 'click' and not x.is_test and x.ipm = s.ip_hash
                      and x.at <= s.created_at and x.at > s.created_at - interval '2 hours' order by x.at desc limit 1) e
  where s.created_at > now() - make_interval(days => greatest(1, least(p_days, 400))) and s.ip_hash is not null
    and not s.is_test and coalesce(s.status, '') not in ('spam', 'error', 'test')
  union all
  select a.created_at, 'donation'::text, a.frequency, 'Donation', d.contact_id, c2.full_name, d.id is not null, e.page_id, e.src, e.block_id, e.variant, e.at
  from public.crm_donate_attempts a
  left join lateral (select dd.id, dd.contact_id from public.crm_donations dd where a.session_id is not null and (dd.external_id = a.session_id or dd.raw::text like '%' || a.session_id || '%') limit 1) d on true
  left join public.crm_contacts c2 on c2.id = d.contact_id
  cross join lateral (select x.* from public.link_page_events x where x.kind = 'click' and not x.is_test and x.ipm = a.ip_hash
                      and x.at <= a.created_at and x.at > a.created_at - interval '2 hours' order by x.at desc limit 1) e
  where a.created_at > now() - make_interval(days => greatest(1, least(p_days, 400))) and a.ip_hash is not null
    and not a.is_test and coalesce(a.status, '') <> 'test';
end $$;
comment on function public.wa230_conversions(int) is 'wave230: the sign-ups (CRM forms) and gifts (the donation page) that followed a link page click on the same network within 2 hours, last click wins; the person is named only because they signed up or gave. The marketing team and admins.';
grant execute on function public.wa230_conversions(int) to authenticated;

-- the bio page, from the wave225 link_page settings, with starter blocks the team can change
insert into public.link_pages (slug, title, title_fr, bio, bio_fr, theme, socials, blocks, settings, status, created_by, published_at)
select 'main', coalesce(v->>'title', 'Welfare Avenue'), 'Welfare Avenue',
  coalesce(nullif(v->>'bio', ''), 'Youth-powered meals and community in Montreal and Toronto.'),
  'Des repas et de la communauté, portés par les jeunes, à Montréal et à Toronto.',
  jsonb_build_object('preset', coalesce(v->>'theme', 'green')),
  coalesce(v->'socials', '{}'::jsonb) || jsonb_build_object('instagram', coalesce(v#>>'{socials,instagram}', 'https://www.instagram.com/welfareavenue/')),
  jsonb_build_array(
    jsonb_build_object('id', 'b-vol', 'type', 'form', 'on', true, 'form', 'volunteer', 'form_fr', 'benevole', 'label', 'Volunteer with us', 'label_fr', 'Faire du bénévolat', 'sub', 'Cook, serve or drive on a Sunday', 'sub_fr', 'Cuisiner, servir ou conduire un dimanche', 'icon', '🙌', 'featured', true),
    jsonb_build_object('id', 'b-news', 'type', 'form', 'on', true, 'form', 'newsletter', 'label', 'Get our newsletter', 'label_fr', 'Recevoir l’infolettre', 'icon', '💌'),
    jsonb_build_object('id', 'b-site', 'type', 'link', 'on', true, 'code', 'lp-site', 'label', 'Our website', 'label_fr', 'Notre site web', 'icon', '🌐'),
    jsonb_build_object('id', 'b-ig', 'type', 'instagram', 'on', true, 'count', 6, 'label', 'Latest on Instagram', 'label_fr', 'Nos dernières publications'),
    jsonb_build_object('id', 'b-soc', 'type', 'socials', 'on', true)),
  jsonb_build_object('lang', 'auto', 'fallback_url', 'https://welfareavenue.com/'),
  'live', 'wave230', now()
from (select coalesce((select value from public.hub_settings where key = 'link_page'), '{}'::jsonb) v) x
where not exists (select 1 from public.link_pages where slug = 'main');
insert into public.short_links (code, url, label, campaign, created_by)
select 'lp-site', 'https://welfareavenue.com/', 'Our website (link page)', 'link in bio', 'wave230'
where not exists (select 1 from public.short_links where code = 'lp-site');
insert into public.link_page_sources (page_id, code, label, kind, created_by)
select null, x.code, x.label, x.kind, 'wave230' from (values ('ig', 'Instagram bio', 'platform'), ('tt', 'TikTok bio', 'platform'), ('fb', 'Facebook page', 'platform'),
  ('li', 'LinkedIn page', 'platform'), ('th', 'Threads bio', 'platform'), ('yt', 'YouTube channel', 'platform'), ('email', 'Email signature', 'email')) x(code, label, kind)
where not exists (select 1 from public.link_page_sources s where s.page_id is null and s.code = x.code);

-- the weekly summary to the marketing leads and admins, Mondays 9:10 Toronto (13:10 UTC); off with app_config link_pages_digest = off
select cron.schedule('wa-link-pages-digest', '10 13 * * 1', $c$select public.call_edge('linkpage', '{"action":"digest"}'::jsonb)$c$);
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('link_pages', 'main', 'created', null, 'wave230: link pages (the bio page moved from hub_settings link_page), sources, events, conversions, weekly summary', 'wave230');
