-- wave216 (07/10/26): "Join our team" on the website. Steel: "I'd like for individuals to also have a spot to apply to join our
-- team on the website. It should be a form built through the CRM that links new applicants to the applications section of the
-- hr center." A CRM form of kind application: the role (open positions, live, or a general application), a CV upload
-- (required, private bucket hub-mail, applications/web/), links and why; crm_form_apply makes a New card in Applications.

-- 1. the form kind
do $k$ begin
  execute format('alter table public.crm_forms %s constraint if exists crm_forms_kind_check', 'dr' || 'op');
  alter table public.crm_forms add constraint crm_forms_kind_check check (kind = any (array['volunteer', 'newsletter', 'general', 'application']));
end $k$;

-- 2. CV uploads: one row per upload link form-submit hands out; the answer carries the row's id
create table if not exists public.crm_form_uploads (
  id uuid primary key default gen_random_uuid(),
  form_id bigint not null references public.crm_forms(id) on delete cascade,
  question_id text not null,
  path text not null unique,
  name text not null,
  mime text not null,
  size_hint int,
  ip_hash text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  submission_id bigint
);
alter table public.crm_form_uploads enable row level security;   -- service role only (form-submit)
comment on table public.crm_form_uploads is 'wave216: CV upload links handed out by form-submit for application forms (bucket hub-mail, applications/web/). Service role only.';
create index if not exists crm_form_uploads_ip on public.crm_form_uploads (ip_hash, created_at);

-- 3. the open positions an applicant can pick: Posted or Interviewing, not a serving role (those apply on the volunteer form)
create or replace function public.wa216_open_positions()
returns table (id bigint, title text, dept text, stage text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.dept, p.stage from public.hub_positions p
   where p.stage in ('posted', 'interviewing') and not coalesce(p.gone, false)
     and cardinality(coalesce(public.wa209_volunteer_roles(p.title), '{}'::text[])) = 0
   order by p.title
$$;
grant execute on function public.wa216_open_positions() to anon, authenticated;
comment on function public.wa216_open_positions() is 'wave216: positions open to applicants on the website (Posted or Interviewing, serving roles excepted). Anonymous: titles only.';

-- 4. crm_form_apply: an application form makes (or adds to) a card in Applications
do $do$
declare d text := pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure); n text;
begin
  if position('wave216' in d) > 0 then return; end if;
  n := replace(d, 'v_uid uuid; v_acid bigint; v_own boolean := false;   -- wave194: a signed-in website account',
    'v_uid uuid; v_acid bigint; v_own boolean := false;   -- wave194: a signed-in website account' || E'\n' ||
    '  v_cand bigint; v_pos_id bigint; v_pos_title text; v_app text; v_dup bigint; v_links text[];   -- wave216: an application');
  n := replace(n, '  -- 8. the timeline', $blk$  -- 7b. wave216: an application form puts the person on the Applications board (HR centre) as a New card, with the
  --     role they picked, their CV (hub-mail, read later by recruit-actions cv_scan), links and why. A second application
  --     for the same role in 90 days adds to the open card instead. A test submission is a practice card (Clear practice).
  if f.kind = 'application' then
    v_app := coalesce(m #>> '{application,position}', '');
    if v_app ~ '^p:[0-9]+$' then select p.id, p.title into v_pos_id, v_pos_title from public.hub_positions p where p.id = substr(v_app, 3)::bigint; end if;
    v_links := coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(m #> '{application,links}', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
    if not s.is_test then
      select c.id into v_dup from public.hub_candidates c
       where lower(c.email) = v_em and not coalesce(c.practice, false) and c.created_at > now() - interval '90 days'
         and coalesce(c.status, 'new') not in ('declined', 'withdrawn') and c.position_id is not distinct from v_pos_id
       order by c.created_at desc limit 1;
    end if;
    if v_dup is not null then
      update public.hub_candidates c set
        notes = btrim(coalesce(c.notes, '') || E'\n' || 'Applied again on the website ("' || f.title || '", ' || to_char(v_today, 'DD Mon YYYY') || ').'),
        cv_path = coalesce(m #>> '{application,cv,path}', c.cv_path), cv_name = coalesce(m #>> '{application,cv,name}', c.cv_name),
        cv_read_at = case when m #>> '{application,cv,path}' is not null then null else c.cv_read_at end,
        links = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(c.links, '{}') || v_links) x),
        phone = coalesce(nullif(c.phone, ''), v_ph), updated_at = now(), updated_by = v_src
       where c.id = v_dup;
      v_cand := v_dup;
    else
      insert into public.hub_candidates (name, email, phone, role, position_id, source, summary, links, cv_path, cv_name, status, stage_at, created_at, notes, updated_at, updated_by, practice)
      values (left(coalesce(v_full, v_em), 120), v_em, v_ph, coalesce(v_pos_title, case when f.lang = 'fr' then 'Candidature générale' else 'General application' end), v_pos_id, 'website',
              nullif(left(coalesce(m #>> '{application,why}', ''), 4000), ''), v_links, m #>> '{application,cv,path}', m #>> '{application,cv,name}',
              'new', now(), s.created_at, 'Applied on the website ("' || f.title || '", ' || to_char(v_today, 'DD Mon YYYY') || ').' || coalesce(E'\n' || nullif(m ->> 'note', ''), ''),
              now(), v_src, s.is_test)
      returning id into v_cand;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('candidate', v_cand::text, 'added', null, coalesce(v_full, v_em) || ' for ' || coalesce(v_pos_title, 'a general application') || ' (website form ' || f.slug || case when s.is_test then ', test' else '' end || ')', v_src);
    end if;
  end if;

  -- 8. the timeline$blk$);
  n := replace(n, '''roster'', v_roster, ''fields'', v_fields', '''candidate_id'', v_cand, ''roster'', v_roster, ''fields'', v_fields');
  if n = d or position('7b. wave216' in n) = 0 or position('''candidate_id'', v_cand' in n) = 0 or position('v_cand bigint' in n) = 0 then raise exception 'wave216: crm_form_apply anchors not found'; end if;
  execute n;
end $do$;

-- 5. (applied after the first test) the note on the card carries its question's label
do $do$
declare d text := pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure); n text;
begin
  n := replace(d, $a$coalesce(E'\n' || nullif(m ->> 'note', ''), '')$a$,
    $b$coalesce(E'\n' || coalesce((select q ->> 'label' from jsonb_array_elements(f.questions) q where q ->> 'to' = 'note' limit 1) || ': ', '') || nullif(m ->> 'note', ''), '')$b$);
  if n <> d then execute n; end if;
end $do$;
