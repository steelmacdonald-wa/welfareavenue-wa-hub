-- Welfare Avenue Hub: wave295 undo, 07/11/26. Reverses build/data/wa295_filters.sql.
-- crm_contact_match comes back exactly as live had it on 07/11/26 (pg_get_functiondef read with the Supabase connector, md5
-- d21db1e35fb6e0a8f65d766db3a1d618; its comment md5 3d41cf5110030a3322bb951dffea4217), and so does crm_list_preview (md5
-- 8088527269cf3f6b75105421ee453abf; comment f51932b9bf2a0fc879a2f91ae2b9ce52), both with their live grants. crm_filter_contacts,
-- crm_filter_prepare and crm_filter_prepare_tag are dropped.
-- The service role's execute on crm_tag_aliases() (wave295 gave it) is taken back. The release line stays; an undo line is added. Put the page back
-- first (the Contacts page calls crm_filter_contacts): see docs/07-11-26 - wave295 Contacts filters.md, Undo. A saved list that uses a wave295
-- condition then answers as the older engine does: a field, chapter, dnc, phone, org or job_title condition matches everyone (an unknown condition
-- always did), and a list of several values for kind, role or tag matches no one. wave295 saves no list on its own; check the Lists page first.
-- Comment statements here are indented on purpose: build/gen_data_model.py reads every file in build/data, and must keep reading the migration's text.
-- No transaction control. Safe to run twice. Proved offline: node test/w295sql.mjs.

-- ============================================================================================ 1. crm_contact_match back (live text, 07/11/26)
CREATE OR REPLACE FUNCTION public.crm_contact_match(c public.crm_contacts_v, k jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  f text := k->>'f'; op text := coalesce(k->>'op', ''); v text := coalesce(k->>'v', ''); n numeric; r boolean; w text;
begin
  if f is null or f = '' then return true; end if;
  begin n := nullif(trim(v), '')::numeric; exception when others then n := null; end;
  if f = 'kind' then
    r := case v when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
                when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
                else v = any(coalesce(c.kinds, '{}')) end;
  elsif f = 'role' then r := v = any(coalesce(c.volunteer_roles, '{}')) or v = any(coalesce(c.volunteer_tags, '{}'));
  elsif f = 'tag' then r := exists (select 1 from unnest(coalesce(c.tags, '{}')) t where public.crm_fold(t) = public.crm_fold(v));
  elsif f = 'perm' then
    w := public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until);
    r := w = v or (v = 'unsub' and w = 'bounced');
  elsif f = 'email' then r := coalesce(array_length(c.emails, 1), 0) > 0 or coalesce(c.primary_email, '') <> '';
  elsif f = 'served' then
    r := case op when 'never' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) = 0
                 when 'within' then c.last_serving_on >= current_date - coalesce(n, 365)::int
                 when 'count_gte' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) >= coalesce(n, 1)
                 else coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) > 0 end;
  elsif f = 'gave' then
    r := case op when 'never' then coalesce(c.donation_count, 0) = 0
                 when 'within' then c.last_donation_at >= now() - make_interval(days => coalesce(n, 365)::int)
                 when 'lapsed' then c.last_donation_at < now() - make_interval(days => coalesce(n, 365)::int)
                 when 'total_gte' then coalesce(c.donation_total, 0) >= coalesce(n, 0)
                 when 'count_gte' then coalesce(c.donation_count, 0) >= coalesce(n, 1)
                 else coalesce(c.donation_count, 0) > 0 end;
  elsif f = 'city' then r := public.crm_fold(c.city) like '%' || public.crm_fold(v) || '%';
  elsif f = 'language' then r := lower(coalesce(c.language, '')) like lower(v) || '%';
  elsif f = 'source' then r := coalesce(c.source, '') = v;
  elsif f = 'added' then r := c.created_at >= now() - make_interval(days => coalesce(n, 30)::int);
  elsif f = 'active' then r := c.last_activity_at >= now() - make_interval(days => coalesce(n, 90)::int);
  elsif f = 'opened' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.opened_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'clicked' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.clicked_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'review' then r := coalesce(c.volunteer_needs_review, false);
  elsif f = 'search' then
    r := not exists (
      select 1 from unnest(string_to_array(public.crm_fold(trim(v)), ' ')) x
      where x <> '' and position(x in public.crm_fold(coalesce(c.full_name, '') || ' ' || array_to_string(coalesce(c.emails, '{}'), ' ') || ' ' || array_to_string(coalesce(c.phones, '{}'), ' ') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.volunteer_organization, '') || ' ' || array_to_string(coalesce(c.org_names, '{}'), ' ') || ' ' || array_to_string(coalesce(c.tags, '{}'), ' '))) = 0);
  else r := true;
  end if;
  r := coalesce(r, false);
  if op in ('not', 'none') then return not r; end if;
  return r;
end $function$
;
revoke all on function public.crm_contact_match(public.crm_contacts_v, jsonb) from public, anon;
grant execute on function public.crm_contact_match(public.crm_contacts_v, jsonb) to authenticated, service_role;
  comment on function public.crm_contact_match(public.crm_contacts_v, jsonb) is 'One list condition {f, op, v} against one contact (wave155b). Fields: kind, role, tag, perm, email, served (ever, never, within days, count_gte), gave (ever, never, within days, lapsed days, total_gte, count_gte), city, language, source, added (days), active (days), opened and clicked (a Hub email within days), review, search. op not/none negates.';

-- ============================================================================================ 2. crm_list_preview back (live text, 07/11/26, md5 8088527269cf3f6b75105421ee453abf)
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
  comment on function public.crm_list_preview(jsonb) is 'The contact ids a list filter selects today (wave155, groups wave155b): {"groups":[{"all":[{f,op,v},...]},...]} is OR between groups and AND inside one; a filter without groups is the Contacts tab''s flat shape. Reader''s rights.';

-- ============================================================================================ 3. the new functions go
drop function if exists public.crm_filter_contacts(jsonb);
drop function if exists public.crm_filter_prepare(jsonb);
drop function if exists public.crm_filter_prepare_tag(jsonb);
-- and the service role's right to crm_tag_aliases() that wave295 gave (wave294 grants it to authenticated only); skipped when wave294 is gone
do $wa295u$
begin
  if to_regprocedure('public.crm_tag_aliases()') is not null then execute 'revoke execute on function public.crm_tag_aliases() from service_role'; end if;
end $wa295u$;

-- ============================================================================================ 4. the undo record (once per release)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave295', 'wave295 undo', null, 'wave295 undone: crm_contact_match and crm_list_preview back as live had them on 07/11/26 (the older conditions only); crm_filter_contacts, crm_filter_prepare and crm_filter_prepare_tag dropped.', 'wave295'
 where not exists (select 1 from public.change_log u where u.entity_type = 'release' and u.entity_id = 'wave295' and u.field = 'wave295 undo');
