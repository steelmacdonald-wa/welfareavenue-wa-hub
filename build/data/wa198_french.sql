-- wave198 (03/10/26): the Hub in French. Steel (02/10/26): "He's also french so I'd love to make the effort in putting the entire
-- hub in french as an option. This is for future recruits too." His choices: the interface, the onboarding and the Avenue Academy
-- in French (what people type stays as written); Quebec French, vous; each person picks their language.

create table public.hub_i18n (
  lang text not null default 'fr' check (lang in ('fr')),
  en text not null,
  tr text not null,
  kind text not null default 'seed' check (kind in ('seed', 'auto', 'manual')),
  updated_at timestamptz not null default now(),
  primary key (lang, en)
);
comment on table public.hub_i18n is 'wave198: the interface dictionary. en is a piece of interface text as the page shows it, with numbers replaced by {0}, {1}... (the Hub''s own words, never what people type); tr is the translation (Quebec French, vous). kind: seed (translated with the wave), auto (i18n-translate, from the queue), manual (an admin''s correction). Read by any signed-in person through wa198_dict(); written by i18n-translate (service role) and wa198_fix (admins).';
alter table public.hub_i18n enable row level security;
create policy hub_i18n_read on public.hub_i18n for select to authenticated using (true);

create table public.hub_i18n_content (
  lang text not null default 'fr' check (lang in ('fr')),
  tbl text not null check (tbl in ('trainings', 'onboarding_template', 'academy_paths', 'hr_setup_template', 'app_config')),
  row_id text not null,
  field text not null,
  src_md5 text not null,
  tr text,
  updated_at timestamptz not null default now(),
  primary key (lang, tbl, row_id, field)
);
comment on table public.hub_i18n_content is 'wave198: translations of the onboarding and Avenue Academy content, one row per field of a source row (trainings title, description, body; onboarding_template name, description; academy_paths name, title, blurb, cert_title; hr_setup_template name, description; app_config onboarding_journey value). src_md5 is md5 of the English source (jsonb as text) when it was translated: a row whose source changed since is stale and is not served (wa198_content) until i18n-translate translates it again. tr holds text, or JSON as text for body and value. Written by the wave and i18n-translate (service role).';
alter table public.hub_i18n_content enable row level security;

create table public.hub_i18n_queue (
  lang text not null default 'fr',
  en text not null check (length(en) between 2 and 300),
  seen int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  skip boolean not null default false,
  primary key (lang, en)
);
comment on table public.hub_i18n_queue is 'wave198: interface text a French reader saw with no translation yet (normalized like hub_i18n.en). i18n-translate translates the ones whose words all appear in the live build (so what people type is never sent), and marks the rest skip. Written through wa198_seen(); no direct access.';
alter table public.hub_i18n_queue enable row level security;

create table public.hub_user_prefs (
  email text primary key check (email = lower(email)),
  lang text not null default 'en' check (lang in ('en', 'fr')),
  updated_at timestamptz not null default now()
);
comment on table public.hub_user_prefs is 'wave198: each person''s Hub settings that follow them across devices; lang is the interface language (en or fr), chosen in the account menu. A person reads and writes only their own row.';
alter table public.hub_user_prefs enable row level security;
create policy hub_user_prefs_own on public.hub_user_prefs for all to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', ''))) with check (email = lower(coalesce(auth.jwt() ->> 'email', '')));
grant select, insert, update on public.hub_user_prefs to authenticated;

create or replace function public.wa198_dict(p_lang text default 'fr')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('v', coalesce(max(updated_at)::text, '') || ':' || count(*), 'd', coalesce(jsonb_object_agg(en, tr), '{}'::jsonb))
  from public.hub_i18n where lang = p_lang;
$$;
comment on function public.wa198_dict(text) is 'wave198: the whole interface dictionary for a language as {v, d}: v changes whenever a row does (the page keeps a copy and reloads it only then), d maps en to the translation.';
create or replace function public.wa198_dict_v(p_lang text default 'fr')
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce(max(updated_at)::text, '') || ':' || count(*) from public.hub_i18n where lang = p_lang;
$$;
comment on function public.wa198_dict_v(text) is 'wave198: the dictionary''s version (see wa198_dict).';

/* the content translations that are still current: the source''s md5 equals the one translated */
create or replace function public.wa198_content(p_lang text default 'fr')
returns table (tbl text, row_id text, field text, tr text)
language sql stable security definer set search_path = '' as $$
  with src as (
    select 'trainings'::text tbl, t.id::text row_id, f.field, f.val from public.trainings t,
      lateral (values ('title', t.title), ('description', t.description), ('body', t.body::text)) f(field, val) where t.active
    union all select 'onboarding_template', o.id, f.field, f.val from public.onboarding_template o,
      lateral (values ('name', o.name), ('description', o.description)) f(field, val) where o.active
    union all select 'academy_paths', p.key, f.field, f.val from public.academy_paths p,
      lateral (values ('name', p.name), ('title', p.title), ('blurb', p.blurb), ('cert_title', p.cert_title)) f(field, val) where p.active
    union all select 'hr_setup_template', h.id, f.field, f.val from public.hr_setup_template h,
      lateral (values ('name', h.name), ('description', h.description)) f(field, val) where h.active
    union all select 'app_config', c.key, 'value', c.value::text from public.app_config c where c.key = 'onboarding_journey'
  )
  select c.tbl, c.row_id, c.field, c.tr from public.hub_i18n_content c join src s on s.tbl = c.tbl and s.row_id = c.row_id and s.field = c.field
  where c.lang = p_lang and c.tr is not null and s.val is not null and md5(s.val) = c.src_md5
    and public.is_wa_staff();
$$;
comment on function public.wa198_content(text) is 'wave198: the current French versions of the onboarding and Academy content (only fields whose English has not changed since), for staff. The page puts them in place of the English when it reads those tables, unless the reader is on an editing page.';
revoke all on function public.wa198_content(text) from public, anon;
grant execute on function public.wa198_content(text) to authenticated;

create or replace function public.wa198_seen(p_lang text, p_keys text[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; k text;
begin
  if auth.uid() is null or not public.is_wa_staff() then return 0; end if;
  if p_lang is distinct from 'fr' then return 0; end if;
  foreach k in array coalesce(p_keys[1:80], '{}') loop
    k := btrim(k);
    if length(k) between 2 and 300 and k ~ '[A-Za-z]{2}' and not exists (select 1 from public.hub_i18n i where i.lang = p_lang and i.en = k) then
      insert into public.hub_i18n_queue (lang, en) values (p_lang, k)
      on conflict (lang, en) do update set seen = public.hub_i18n_queue.seen + 1, last_seen = now();
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
comment on function public.wa198_seen(text, text[]) is 'wave198: a French reader''s page reports interface text it could not translate (at most 80 a call, 2 to 300 characters); queued for i18n-translate.';
revoke all on function public.wa198_seen(text, text[]) from public, anon;
grant execute on function public.wa198_seen(text, text[]) to authenticated;

/* an admin corrects a translation (kept as manual: i18n-translate never overwrites it) */
create or replace function public.wa198_fix(p_en text, p_tr text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_wa_admin() then raise exception 'admins only'; end if;
  insert into public.hub_i18n (lang, en, tr, kind) values ('fr', p_en, p_tr, 'manual')
  on conflict (lang, en) do update set tr = excluded.tr, kind = 'manual', updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('i18n', left(p_en, 120), 'fr', null, left(p_tr, 400), coalesce(auth.jwt() ->> 'email', 'admin'));
end $$;
comment on function public.wa198_fix(text, text) is 'wave198: an admin sets the French for one piece of interface text (kind manual; logged in change_log).';
revoke all on function public.wa198_fix(text, text) from public, anon;
grant execute on function public.wa198_fix(text, text) to authenticated;
