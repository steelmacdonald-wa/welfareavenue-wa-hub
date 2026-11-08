-- wave295: what build/data/wa295_filters.sql, its undo and the wave295 assertions need beyond test/w281schema.sql, build/data/wa281_rules.sql,
-- test/w283schema.sql and build/data/wa283_page.sql, for the offline proof in test/w295sql.mjs (PGlite).
-- 1. A TEST-ONLY STAND-IN for wave294's public.crm_tag_aliases() (wave294 was being built on another branch when this was written, and its file
--    was not there yet). Same shape the design names: (alias, tag) pairs, lower case, read-only, for signed-in staff. test/w295sql.mjs loads the
--    real wave294 file instead when it can find it (git show wave294-keela-tags:build/data/wa294_keela_tags.sql), and says which one it used.
-- 2. Invented people only (Test F... Filter, example.invalid), custom fields with keys w295_*, an organisation and a volunteer record.
--    Not a copy of live: do not apply it anywhere but the offline PGlite database.

-- 0. crm_list_preview_flat and crm_list_preview, which test/w281schema.sql does not carry (live text, pg_get_functiondef read 07/11/26:
--    crm_list_preview md5 8088527269cf3f6b75105421ee453abf, crm_list_preview_flat 5745c2147e27706ed9faa00e1830d9ee; test/w295sql.mjs checks both)
--    and the two helpers they call (live text, same day)
CREATE OR REPLACE FUNCTION public.crm_fold(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select translate(lower(coalesce(p, '')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa')
$function$
;
CREATE OR REPLACE FUNCTION public.crm_perm_key(p_status text, p_consent text, p_until date)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when lower(coalesce(p_status, '')) in ('unsubscribed', 'complained') then 'unsub'
    when lower(coalesce(p_status, '')) = 'bounced' then 'bounced'
    when lower(coalesce(p_consent, '')) = 'express' then 'express'
    when lower(coalesce(p_consent, '')) = 'implied' then case when p_until is null or p_until >= current_date then 'implied' else 'unknown' end
    when lower(coalesce(p_consent, '')) = 'none' then 'none'
    else 'unknown' end
$function$
;
CREATE OR REPLACE FUNCTION public.crm_list_preview_flat(p_filter jsonb)
 RETURNS SETOF bigint
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with f as (
    select nullif(p_filter->>'kind', '') as kind, nullif(p_filter->>'role', '') as role, nullif(p_filter->>'act', '') as act,
           nullif(p_filter->>'perm', '') as perm, nullif(public.crm_fold(trim(p_filter->>'q')), '') as q, nullif(public.crm_fold(trim(p_filter->>'city')), '') as city,
           coalesce((select array_agg(public.crm_fold(x)) from jsonb_array_elements_text(case when jsonb_typeof(p_filter->'tags') = 'array' then p_filter->'tags' else '[]'::jsonb end) x), '{}'::text[]) as tags
  )
  select c.id
  from public.crm_contacts_v c, f
  where c.merged_into is null
    and (f.kind is null or case f.kind
          when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
          when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
          else f.kind = any(coalesce(c.kinds, '{}')) end)
    and (f.role is null or f.role = any(coalesce(c.volunteer_roles, '{}')) or f.role = any(coalesce(c.volunteer_tags, '{}')))
    and (f.act is null or case f.act
          when 'served12' then c.last_serving_on >= current_date - 365
          when 'served' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) > 0
          when 'never' then 'volunteer' = any(coalesce(c.kinds, '{}')) and coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) = 0
          when 'review' then coalesce(c.volunteer_needs_review, false)
          when 'noemail' then coalesce(array_length(c.emails, 1), 0) = 0
          when 'new30' then c.created_at >= now() - interval '30 days'
          else true end)
    and (f.perm is null or public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until) = f.perm
         or (f.perm = 'unsub' and public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until) = 'bounced'))
    and (f.city is null or public.crm_fold(c.city) like '%' || f.city || '%')
    and (cardinality(f.tags) = 0 or exists (select 1 from unnest(coalesce(c.tags, '{}')) t where public.crm_fold(t) = any(f.tags)))
    -- every word of the search somewhere in the name, the emails, the phones, the city, the organizations, the tags (the page's _hay)
    and (f.q is null or not exists (
          select 1 from unnest(string_to_array(f.q, ' ')) w
          where w <> '' and position(w in public.crm_fold(coalesce(c.full_name, '') || ' ' || array_to_string(coalesce(c.emails, '{}'), ' ') || ' ' || array_to_string(coalesce(c.phones, '{}'), ' ') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.volunteer_organization, '') || ' ' || array_to_string(coalesce(c.org_names, '{}'), ' ') || ' ' || array_to_string(coalesce(c.tags, '{}'), ' ') || ' ' || array_to_string(coalesce(c.volunteer_roles, '{}'), ' ') || ' ' || array_to_string(coalesce(c.kinds, '{}'), ' '))) = 0))
$function$
;
revoke all on function public.crm_list_preview_flat(jsonb) from public, anon;
grant execute on function public.crm_list_preview_flat(jsonb) to authenticated, service_role;
CREATE OR REPLACE FUNCTION public.crm_list_preview(p_filter jsonb)
 RETURNS SETOF bigint
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select x from public.crm_list_preview_flat(p_filter) x where jsonb_typeof(p_filter->'groups') is distinct from 'array'
  union all
  select c.id from public.crm_contacts_v c
  where jsonb_typeof(p_filter->'groups') = 'array' and c.merged_into is null
    and (jsonb_array_length(p_filter->'groups') = 0 or exists (
      select 1 from jsonb_array_elements(p_filter->'groups') g
      where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g->'all') = 'array' then g->'all' else '[]'::jsonb end) k where not public.crm_contact_match(c, k))))
$function$
;
revoke all on function public.crm_list_preview(jsonb) from public, anon;
grant execute on function public.crm_list_preview(jsonb) to authenticated, service_role;

-- 1. the stand-in (skipped when the real one is already there)
do $stub$
begin
  if to_regprocedure('public.crm_tag_aliases()') is null then
    execute $f$
      create function public.crm_tag_aliases() returns table(alias text, tag text) language sql stable security invoker set search_path to '' as $b$
        select a, t from (values ('volunteer server', 'server'), ('monthly newsletter subscriber', 'newsletter'), ('donor', 'donor'), ('reoccuring volunteers', 'recurring volunteer')) x(a, t)
      $b$;
      comment on function public.crm_tag_aliases() is 'TEST STAND-IN for wave294 (test/w295schema.sql): Keela tag names and the Hub tag each maps to.';
      revoke all on function public.crm_tag_aliases() from public, anon;
      grant execute on function public.crm_tag_aliases() to authenticated, service_role;
    $f$;
  end if;
end $stub$;

-- 2. the send log's two columns the opened and clicked conditions read (live has them; test/w281schema.sql does not), and one open, one click
alter table public.crm_email_sends add column if not exists opened_at timestamptz;
alter table public.crm_email_sends add column if not exists clicked_at timestamptz;

-- 3. custom fields of every type
insert into public.crm_fields (key, label, type, options, sort, created_by) values
  ('w295_team', 'Test team', 'choice', '["Quest", "Logic"]', 900, 'w295 test'),
  ('w295_positions', 'Test positions', 'multi', '["Server", "Cook", "Driver"]', 901, 'w295 test'),
  ('w295_age16', 'Test 16 or older', 'yes_no', '[]', 902, 'w295 test'),
  ('w295_first_day', 'Test first day', 'date', '[]', 903, 'w295 test'),
  ('w295_shifts', 'Test shifts', 'number', '[]', 904, 'w295 test'),
  ('w295_insta', 'Test Instagram', 'text', '[]', 905, 'w295 test'),
  ('w295_unused', 'Test field nobody filled in', 'choice', '["A"]', 906, 'w295 test');

-- the people
insert into public.volunteer_people (id, full_name, roles, organization) values (595, 'Test Fd Filter', array['cook'], 'Test School Filters');
insert into public.crm_contacts (id, full_name, emails, phones, kinds, tags, job_title) overriding system value values
  (9501, 'Test Fa Filter', array['fa.filter@example.invalid'], array['514 555 0191'], array['volunteer'], array['server', 'newsletter'], 'Head Cook');
insert into public.crm_contacts (id, full_name, emails, phones, kinds, tags) overriding system value values
  (9502, 'Test Fb Filter', array['fb.filter@example.invalid'], '{}', array['supporter'], array['donor']);
update public.crm_contacts set do_not_contact = true, dnc_reason = 'asked' where id = 9502;
insert into public.crm_contacts (id, full_name, phones, kinds, tags, job_title) overriding system value values
  (9503, 'Test Fc Filter', array['  '], array['volunteer', 'donor'], '{}', '');
insert into public.crm_contacts (id, full_name, kinds, tags, volunteer_id) overriding system value values
  (9504, 'Test Fd Filter', array['partner'], array['Server', 'Photographer'], 595);
insert into public.crm_contacts (id, full_name, kinds, tags, merged_into) overriding system value values
  (9505, 'Test Fe Filter Merged', array['volunteer'], array['server'], 9501);

-- chapters: Fa Toronto, Fb Montreal, Fc none (counts as Montreal), Fd both
delete from public.crm_contact_chapters where contact_id between 9501 and 9599;
insert into public.crm_contact_chapters (contact_id, chapter, source, added_by) values
  (9501, 'toronto', 'hand', 'w295 test'), (9502, 'montreal', 'hand', 'w295 test'), (9504, 'montreal', 'hand', 'w295 test'), (9504, 'toronto', 'hand', 'w295 test');

-- an organisation (Partners) for Fb
insert into public.wa_partners (id, name, category, status, visibility) overriding system value values (4951, 'Test Bakery Filters', 'partner', 'active', 'everyone');
insert into public.crm_contact_orgs (contact_id, partner_id, is_primary) values (9502, 4951, true);

-- the field values (as the page and the Keela import write them: text, arrays, booleans, numbers, dates as text)
insert into public.crm_contact_fields (contact_id, field_id, value, source)
select x.cid, f.id, x.val::jsonb, 'w295 test' from (values
  (9501, 'w295_team', '"Quest"'), (9501, 'w295_positions', '["Server", "Cook"]'), (9501, 'w295_age16', 'true'), (9501, 'w295_first_day', '"2025-06-01"'),
  (9501, 'w295_shifts', '3'), (9501, 'w295_insta', '"@fa_test"'),
  (9502, 'w295_team', '"Logic"'), (9502, 'w295_positions', '["Driver"]'), (9502, 'w295_age16', '"no"'), (9502, 'w295_first_day', '"2026-01-15"'), (9502, 'w295_shifts', '"12"'),
  (9503, 'w295_team', '""'), (9503, 'w295_positions', '[]'),
  (9504, 'w295_age16', 'false'), (9504, 'w295_insta', 'null')
) x(cid, key, val) join public.crm_fields f on f.key = x.key;

-- 4. one open and one click, so the opened and clicked conditions have someone to find
insert into public.crm_email_sends (contact_id, to_email, kind, status, opened_at, clicked_at) values
  (9501, 'fa.filter@example.invalid', 'newsletter', 'sent', now() - interval '3 days', now() - interval '3 days'),
  (9502, 'fb.filter@example.invalid', 'newsletter', 'sent', now() - interval '200 days', null);
