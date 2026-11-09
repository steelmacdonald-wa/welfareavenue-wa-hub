-- Welfare Avenue Hub: wave295, 07/11/26 (fix round 1, 08/11/26). Filters on the Contacts page (design "05 Contacts filters and Keela data", Wave 295).
-- Steel, 07/11/26: the CRM could not find people by the fields in their contacts. This file gives the one filter engine (crm_contact_match, used by
-- crm_list_preview for Lists and Sends) the conditions the Contacts page's new Filters builder needs:
--   field      {f:"field", key:<crm_fields.key>, op: set | empty | is | any | contains | before | after, v}: a custom field (Keela and profile
--              fields). A list of choices matches any of them; dates (YYYY-MM-DD only) compare as dates, numbers as numbers; yes/no uses is with a
--              yes word (true, yes, y, 1, oui) or a no word (false, no, n, 0, non). Unknown key: no match.
--   kind, role and tag take v as one value or a list: any of them (op is, has or any), every one (op all), none of them (op not or none).
--   tag        also matches through crm_tag_aliases() (wave294): a Keela name such as "Volunteer Server" finds the Hub tag server.
--   chapter    montreal or toronto (crm_contact_chapters, wave281). Montreal also counts a contact with no chapter row ("No chapter: counted as
--              Montreal", as the page says).
--   dnc        do not contact is on.            phone      has a phone number.
--   org        belongs to an organisation whose name contains v (the Partners link, or the volunteer record's organisation).
--   job_title  the job title contains v.        op not or none turns chapter, dnc, phone, org and job_title around, as for the older conditions.
-- FAIL CLOSED (fix round 1): a condition never matches more people than it says. Every condition goes through one gate first:
--   an unknown or missing field matches no one (the live engine matched everyone); an object value matches no one; a list of values is only for
--   kind, role, tag and field is/any (anywhere else it matches no one); a list with no non-blank value matches no one, whatever the operator; a
--   blank value on any condition that takes text (kind, role, tag, perm, city, language, source, search, chapter, org, job_title, field is, any,
--   contains, before, after) matches no one; the new fields accept only their own operators. And in crm_list_preview a filter with no group, or a
--   group with no condition, matches no one (the live engine matched everyone: jsonb_array_length(groups) = 0).
-- Every older condition with one non-blank value goes on to the live code unchanged (proved in test/w295sql.mjs against a kept copy).
-- RELEASE GUARD: the file stops before it changes anything when a saved list (crm_lists, not static) or an unsent Send's list holds a shape whose
-- answer this wave changes (an unknown or empty field, a blank value, a list or object value, no group or an empty group, or a tag value that is a
-- Keela name of another Hub tag), and names the list and Send ids. On 08/11/26 crm_lists and crm_campaigns had 0 rows.
-- For speed, crm_list_preview hands each tag condition its Keela names once per query (crm_filter_prepare, crm_filter_prepare_tag).
-- And crm_filter_contacts(p_filter): the contact ids a filter selects, for the Contacts page, staff with the CRM only; it refuses a filter with
-- no condition. Lists keep calling crm_list_preview: one engine, so Contacts and Lists answer the same question the same way.
-- Needs wave281 (crm_contact_chapters, crm_contacts_v.do_not_contact and job_title, wa_can), wave283 (trg_wa283_gift_audit) and wave294 at 3b1d7ca
-- or later (crm_tag_aliases, readable by the service role, which builds a Send's queue): the file stops at the top without them.
-- crm_contact_match is changed by exact replacement of an anchor in its live text (pg_get_functiondef), as wave273, wave281 and wave283 did: a
-- missing anchor stops the file; crm_list_preview is replaced only while its text is still the live one (md5). Each patch skips when its wave295
-- text is already there, so the file is safe to run twice. The live text of both is in build/data/wa295_undo.sql.
-- No transaction control: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it inside a block that rolls
-- back. Proved offline first: node test/w295sql.mjs (PGlite). Built 07/11/26, not released. Undo: build/data/wa295_undo.sql.

do $wa295$
begin
  if to_regclass('public.crm_contact_chapters') is null or to_regprocedure('public.wa_can(text)') is null
     or not exists (select 1 from pg_attribute where attrelid = 'public.crm_contacts_v'::regclass and attname = 'do_not_contact' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid = 'public.crm_contacts_v'::regclass and attname = 'job_title' and not attisdropped) then
    raise exception 'wave295 needs wave281 first (crm_contact_chapters, wa_can, or crm_contacts_v.do_not_contact and job_title is missing)';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wa283_gift_audit') then
    raise exception 'wave295 needs wave283 first (trg_wa283_gift_audit is missing)';
  end if;
  if to_regprocedure('public.crm_tag_aliases()') is null then
    raise exception 'wave295 needs wave294 first (public.crm_tag_aliases() is missing)';
  end if;
  if not has_function_privilege('service_role', 'public.crm_tag_aliases()', 'execute') then
    raise exception 'wave295 needs wave294 at 3b1d7ca or later (the service role must read crm_tag_aliases(), or a Send to a list with a tag condition would stop)';
  end if;
  if to_regprocedure('public.crm_contact_match(public.crm_contacts_v,jsonb)') is null or to_regprocedure('public.crm_list_preview(jsonb)') is null then
    raise exception 'wave295: crm_contact_match or crm_list_preview is missing';
  end if;
end $wa295$;

-- ============================================================================================ 0. the release guard (reads only)
-- Why a saved filter would answer differently after wave295, or null. Temporary functions: they last for this session only.
create or replace function pg_temp.wa295_cond_change(k jsonb) returns text language plpgsql stable as $g$
declare f text; v text; t text;
begin
  if jsonb_typeof(k) is distinct from 'object' then return 'a condition that is not an object'; end if;
  f := k->>'f'; v := coalesce(k->>'v', ''); t := jsonb_typeof(k->'v');
  if f is null or f = '' then return 'a condition with no field'; end if;
  if f not in ('kind', 'role', 'tag', 'perm', 'email', 'served', 'gave', 'city', 'language', 'source', 'added', 'active', 'opened', 'clicked', 'review', 'search') then
    return 'the field "' || left(f, 40) || '", which the engine did not know before'; end if;
  if t in ('array', 'object') then return f || ' with a list or object as its value'; end if;
  if f in ('kind', 'role', 'tag', 'perm', 'city', 'language', 'source', 'search') and btrim(v) = '' then return f || ' with an empty value'; end if;
  if f = 'tag' and exists (select 1 from public.crm_tag_aliases() x where public.crm_fold(x.alias) = public.crm_fold(v) and public.crm_fold(x.tag) <> public.crm_fold(v)) then
    return 'tag "' || left(v, 60) || '", a Keela name that now also finds its Hub tag'; end if;
  return null;
end $g$;
create or replace function pg_temp.wa295_filter_change(p jsonb) returns text language sql stable as $g$
  select case when jsonb_typeof(p->'groups') is distinct from 'array' then null
    when jsonb_array_length(p->'groups') = 0 then 'no group (it matched everyone; now no one)'
    else (select string_agg(distinct r, '; ') from (
      select case when jsonb_typeof(g->'all') is distinct from 'array' or jsonb_array_length(g->'all') = 0 then 'a group with no condition (it matched everyone; now no one)' end as r
        from jsonb_array_elements(p->'groups') g
      union all
      select pg_temp.wa295_cond_change(k) from jsonb_array_elements(p->'groups') g, jsonb_array_elements(case when jsonb_typeof(g->'all') = 'array' then g->'all' else '[]'::jsonb end) k) q
      where r is not null) end
$g$;
do $wa295$
declare m text; s text;
begin
  if to_regclass('public.crm_lists') is not null then
    select string_agg('list ' || l.id || ': ' || pg_temp.wa295_filter_change(l.filter), ' | ' order by l.id) into m
      from public.crm_lists l where coalesce(l.kind, 'dynamic') <> 'static' and pg_temp.wa295_filter_change(l.filter) is not null;
    if to_regclass('public.crm_campaigns') is not null then
      select string_agg('Send ' || c.id || ' (' || c.status || ', list ' || c.list_id || ')', ' | ' order by c.id) into s
        from public.crm_campaigns c join public.crm_lists l on l.id = c.list_id
       where c.status in ('draft', 'queued', 'sending') and coalesce(l.kind, 'dynamic') <> 'static' and pg_temp.wa295_filter_change(l.filter) is not null;
    end if;
  end if;
  if m is not null then
    raise exception 'wave295 stops: these saved lists would answer differently: %. Unsent Sends on them: %. Change or delete them first (see the wave295 document).', m, coalesce(s, 'none');
  end if;
end $wa295$;

-- ============================================================================================ 1. tag names, read once per filter
-- crm_contact_match runs once per contact and condition. So that a Keela name costs nothing per contact, crm_list_preview first hands each tag
-- condition the names its values stand for (crm_filter_prepare): for every non-blank value, itself and the Hub tags crm_tag_aliases() maps it to,
-- folded (crm_fold), as "w295sets": [["volunteer server", "server"], ...]. A condition without them (a direct call; none today) reads them per contact.
create or replace function public.crm_filter_prepare_tag(k jsonb)
returns jsonb language sql stable security invoker set search_path to '' as $$
  select k || jsonb_build_object('w295sets', coalesce((
    select jsonb_agg(s.names order by s.ord) from (
      select e.ord, jsonb_build_array(public.crm_fold(e.val)) || coalesce((
               select jsonb_agg(distinct public.crm_fold(x.tag)) from public.crm_tag_aliases() x
                where public.crm_fold(x.alias) = public.crm_fold(e.val) and public.crm_fold(x.tag) <> public.crm_fold(e.val)), '[]'::jsonb) as names
        from jsonb_array_elements_text(case when jsonb_typeof(k->'v') = 'array' then k->'v' else jsonb_build_array(coalesce(k->>'v', '')) end) with ordinality e(val, ord)
       where btrim(e.val) <> '') s), '[]'::jsonb))
$$;
create or replace function public.crm_filter_prepare(p_filter jsonb)
returns jsonb language sql stable security invoker set search_path to '' as $$
  select case when jsonb_typeof(p_filter->'groups') is distinct from 'array' then p_filter
    else p_filter || jsonb_build_object('groups', coalesce((
      select jsonb_agg(case when jsonb_typeof(g.v->'all') is distinct from 'array' then g.v else g.v || jsonb_build_object('all', coalesce((
               select jsonb_agg(case when jsonb_typeof(k.v) = 'object' and k.v->>'f' = 'tag' then public.crm_filter_prepare_tag(k.v) else k.v end order by k.o)
                 from jsonb_array_elements(g.v->'all') with ordinality k(v, o)), '[]'::jsonb)) end order by g.o)
        from jsonb_array_elements(p_filter->'groups') with ordinality g(v, o)), '[]'::jsonb)) end
$$;
revoke all on function public.crm_filter_prepare_tag(jsonb) from public, anon;
grant execute on function public.crm_filter_prepare_tag(jsonb) to authenticated, service_role;
revoke all on function public.crm_filter_prepare(jsonb) from public, anon;
grant execute on function public.crm_filter_prepare(jsonb) to authenticated, service_role;
comment on function public.crm_filter_prepare_tag(jsonb) is 'wave295: one tag condition with "w295sets" added: for each non-blank value, itself and the Hub tags crm_tag_aliases() maps it to (folded with crm_fold), so crm_contact_match needs no lookup per contact.';
comment on function public.crm_filter_prepare(jsonb) is 'wave295: a list filter with every tag condition prepared (crm_filter_prepare_tag); crm_list_preview calls it once per query. Other conditions and a filter without groups come back as they were.';

-- crm_list_preview: the filter prepared once, and a filter with no group or a group with no condition matches no one (live text
-- 8088527269cf3f6b75105421ee453abf, where both matched everyone; a different text stops the file)
do $wa295$
declare v text;
begin
  v := pg_get_functiondef('public.crm_list_preview(jsonb)'::regprocedure);
  if position('crm_filter_prepare' in v) = 0 then
    if md5(v) <> '8088527269cf3f6b75105421ee453abf' then raise exception 'wave295: a live function moved: crm_list_preview'; end if;
    execute $f$
CREATE OR REPLACE FUNCTION public.crm_list_preview(p_filter jsonb)
 RETURNS SETOF bigint
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  -- wave295: tag conditions get their Keela names once (crm_filter_prepare); no group, or a group with no condition, matches no one
  with p as materialized (select public.crm_filter_prepare(p_filter) as f)
  select x from public.crm_list_preview_flat(p_filter) x where jsonb_typeof(p_filter->'groups') is distinct from 'array'
  union all
  select c.id from public.crm_contacts_v c, p
  where jsonb_typeof(p_filter->'groups') = 'array' and c.merged_into is null
    and exists (
      select 1 from jsonb_array_elements(p.f->'groups') g
      where jsonb_typeof(g->'all') = 'array' and jsonb_array_length(g->'all') > 0
        and not exists (select 1 from jsonb_array_elements(g->'all') k where not public.crm_contact_match(c, k)))
$function$
$f$;
  end if;
end $wa295$;
revoke all on function public.crm_list_preview(jsonb) from public, anon;
grant execute on function public.crm_list_preview(jsonb) to authenticated, service_role;
comment on function public.crm_list_preview(jsonb) is 'The contact ids a list filter selects today (wave155, groups wave155b): {"groups":[{"all":[{f,op,v},...]},...]} is OR between groups and AND inside one; a filter without groups is the Contacts tab''s flat shape. Reader''s rights. Since wave295 tag conditions are prepared once per query (crm_filter_prepare), and no group, or a group with no condition, matches no one.';

-- ============================================================================================ 2. the new conditions in crm_contact_match
-- One block inserted right after the function's begin, before the live code's first line ("if f is null or f = '' then return true"), so the
-- fail-closed gate runs first. It returns for every shape it owns; an older condition with one non-blank value goes on to the live code.
do $wa295$
declare v text; a text;
begin
  v := pg_get_functiondef('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure);
  if position('wave295' in v) = 0 then
    a := $x$begin
  if f is null or f = '' then return true; end if;
$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave295: a live function moved: crm_contact_match'; end if;
    v := replace(v, a, $x$begin
  -- wave295 (fix round 1): fail closed. A condition never matches more people than it says.
  if f is null or f = '' or f not in ('kind', 'role', 'tag', 'perm', 'email', 'served', 'gave', 'city', 'language', 'source', 'added', 'active',
                                       'opened', 'clicked', 'review', 'search', 'field', 'chapter', 'dnc', 'phone', 'org', 'job_title') then
    return false;   -- an unknown or missing field
  end if;
  if jsonb_typeof(k->'v') = 'object' then return false; end if;
  if jsonb_typeof(k->'v') = 'array' then
    if not (f in ('kind', 'role', 'tag') or (f = 'field' and op in ('is', 'any'))) then return false; end if;   -- a list where one value is meant
    if not exists (select 1 from jsonb_array_elements_text(k->'v') e where btrim(e) <> '') then return false; end if;   -- nothing in the list
  elsif btrim(v) = '' and (f in ('kind', 'role', 'tag', 'perm', 'city', 'language', 'source', 'search', 'chapter', 'org', 'job_title')
                           or (f = 'field' and op in ('is', 'any', 'contains', 'before', 'after'))) then
    return false;   -- a blank value
  end if;
  -- the new fields take only their own operators
  if (f = 'chapter' and op not in ('is', 'not', 'none')) or (f = 'dnc' and op not in ('is', 'not', 'none'))
     or (f = 'phone' and op not in ('has', 'none', 'not')) or (f in ('org', 'job_title') and op not in ('contains', 'not', 'none'))
     or (f = 'field' and op not in ('set', 'empty', 'is', 'any', 'contains', 'before', 'after')) then
    return false;
  end if;
  -- the Contacts filters' conditions (field, chapter, dnc, phone, org, job_title), a list of values for kind, role and tag (op any, all, none),
  -- and Keela tag names through crm_tag_aliases()
  if f in ('kind', 'role', 'tag', 'field', 'chapter', 'dnc', 'phone', 'org', 'job_title') then
  declare
    w295_vals jsonb := case when jsonb_typeof(k->'v') = 'array' then (select jsonb_agg(e) from jsonb_array_elements_text(k->'v') e where btrim(e) <> '')
                            else jsonb_build_array(coalesce(k->>'v', '')) end;
    w295_hit int; w295_n int; w295_r boolean; w295_ft text; w295_val jsonb; w295_items text[]; w295_set boolean; w295_al jsonb; w295_i int; w295_tags text[];
  begin
    if f in ('kind', 'role') and (jsonb_typeof(k->'v') = 'array' or op in ('any', 'all')) then
      select count(*) filter (where case when f = 'kind' then
                 case e when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
                        when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
                        else e = any(coalesce(c.kinds, '{}')) end
               else e = any(coalesce(c.volunteer_roles, '{}')) or e = any(coalesce(c.volunteer_tags, '{}')) end)::int, count(*)::int into w295_hit, w295_n
        from jsonb_array_elements_text(w295_vals) e;
      if w295_n = 0 then return false; end if;
      return case when op in ('not', 'none') then w295_hit = 0 when op = 'all' then w295_hit = w295_n else w295_hit > 0 end;
    end if;
    if f = 'tag' then
      -- the names each value stands for: itself and the Hub tags its Keela name maps to, folded. crm_list_preview hands them over once per
      -- query (crm_filter_prepare); a direct caller (none today) gets them read here, once per contact.
      w295_al := case when jsonb_typeof(k->'w295sets') = 'array' then k->'w295sets' else public.crm_filter_prepare_tag(k)->'w295sets' end;
      if jsonb_typeof(k->'v') = 'array' or op in ('any', 'all') or w295_al is distinct from jsonb_build_array(jsonb_build_array(public.crm_fold(v))) then
        w295_n := coalesce(jsonb_array_length(w295_al), 0);
        if w295_n = 0 then return false; end if;
        w295_tags := string_to_array(public.crm_fold(array_to_string(coalesce(c.tags, '{}'), chr(31))), chr(31));
        w295_hit := 0;
        for w295_i in 0 .. w295_n - 1 loop
          if (w295_al -> w295_i) ?| w295_tags then w295_hit := w295_hit + 1; end if;
        end loop;
        return case when op in ('not', 'none') then w295_hit = 0 when op = 'all' then w295_hit = w295_n else w295_hit > 0 end;
      end if;
    end if;
    if f = 'field' then
      select fd.type, cf.value into w295_ft, w295_val
        from public.crm_fields fd left join public.crm_contact_fields cf on cf.field_id = fd.id and cf.contact_id = c.id
       where fd.key = k->>'key';
      if w295_ft is null then return false; end if;
      w295_items := case when w295_val is null or jsonb_typeof(w295_val) = 'null' then '{}'::text[]
                         when jsonb_typeof(w295_val) = 'array' then array(select btrim(x) from jsonb_array_elements_text(w295_val) x where x is not null and btrim(x) <> '')
                         when btrim(w295_val #>> '{}') = '' then '{}'::text[]
                         else array[btrim(w295_val #>> '{}')] end;
      w295_set := coalesce(array_length(w295_items, 1), 0) > 0;
      if op = 'set' then return w295_set; end if;
      if op = 'empty' then return not w295_set; end if;
      if not w295_set then return false; end if;
      if op in ('is', 'any') then
        if w295_ft = 'yes_no' then   -- only a recognised yes or no, on both sides
          return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s
                          where (case when lower(btrim(e)) in ('true', 'yes', 'y', '1', 'oui') then 1 when lower(btrim(e)) in ('false', 'no', 'n', '0', 'non') then 0 end)
                              = (case when lower(btrim(s)) in ('true', 'yes', 'y', '1', 'oui') then 1 when lower(btrim(s)) in ('false', 'no', 'n', '0', 'non') then 0 end));
        end if;
        if w295_ft = 'number' then
          begin
            return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s where btrim(e)::numeric = s::numeric);
          exception when others then return false;
          end;
        end if;
        return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s where public.crm_fold(btrim(s)) = public.crm_fold(btrim(e)));
      end if;
      if op = 'contains' then
        return exists (select 1 from unnest(w295_items) s where position(public.crm_fold(btrim(v)) in public.crm_fold(s)) > 0);
      end if;
      if op in ('before', 'after') then
        begin
          if w295_ft = 'number' then
            return exists (select 1 from unnest(w295_items) s where case when op = 'before' then s::numeric < btrim(v)::numeric else s::numeric > btrim(v)::numeric end);
          end if;
          if btrim(v) !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;   -- dates in one form only, so DateStyle never guesses
          return exists (select 1 from unnest(w295_items) s where s ~ '^\d{4}-\d{2}-\d{2}$'
                           and case when op = 'before' then s::date < btrim(v)::date else s::date > btrim(v)::date end);
        exception when others then return false;
        end;
      end if;
      return false;
    end if;
    if f in ('chapter', 'dnc', 'phone', 'org', 'job_title') then
      if f = 'chapter' then
        select case when lower(btrim(v)) = 'montreal' then count(*) = 0 or bool_or(ch.chapter = 'montreal') else coalesce(bool_or(ch.chapter = lower(btrim(v))), false) end
          into w295_r from public.crm_contact_chapters ch where ch.contact_id = c.id;
      elsif f = 'dnc' then w295_r := coalesce(c.do_not_contact, false);
      elsif f = 'phone' then w295_r := exists (select 1 from unnest(coalesce(c.phones, '{}')) p where btrim(p) <> '');
      elsif f = 'org' then
        w295_r := exists (select 1 from unnest(coalesce(c.org_names, '{}')) o where btrim(o) <> '' and position(public.crm_fold(btrim(v)) in public.crm_fold(o)) > 0)
               or (btrim(coalesce(c.volunteer_organization, '')) <> '' and position(public.crm_fold(btrim(v)) in public.crm_fold(c.volunteer_organization)) > 0);
      else
        w295_r := btrim(coalesce(c.job_title, '')) <> '' and position(public.crm_fold(btrim(v)) in public.crm_fold(c.job_title)) > 0;
      end if;
      w295_r := coalesce(w295_r, false);
      if op in ('not', 'none') then return not w295_r; end if;
      return w295_r;
    end if;
  end;
  end if;
  if f is null or f = '' then return true; end if;
$x$);
    execute v;
  end if;
end $wa295$;
revoke all on function public.crm_contact_match(public.crm_contacts_v, jsonb) from public, anon;
grant execute on function public.crm_contact_match(public.crm_contacts_v, jsonb) to authenticated, service_role;
comment on function public.crm_contact_match(public.crm_contacts_v, jsonb) is 'One list condition {f, op, v} against one contact (wave155b; wave295). Fields: kind, role, tag, perm, email, served (ever, never, within days, count_gte), gave (ever, never, within days, lapsed days, total_gte, count_gte), city, language, source, added (days), active (days), opened and clicked (a Hub email within days), review, search; since wave295 also field (a custom field by key: set, empty, is, any, contains, before, after; dates YYYY-MM-DD), chapter (montreal counts no chapter too), dnc, phone, org and job_title. kind, role and tag take one value or a list (any; op all every one; op not or none none of them); tag also matches a Keela name through crm_tag_aliases() (a direct call without crm_filter_prepare reads it once per contact). Fails closed since wave295: an unknown or missing field, an object value, a list where one value is meant, an empty list or a blank value matches no one. op not/none negates.';

-- ============================================================================================ 3. the Contacts page's filter (staff with the CRM)
create or replace function public.crm_filter_contacts(p_filter jsonb)
returns table(id bigint) language plpgsql stable security definer set search_path to '' as $$
begin
  if not (coalesce(public.is_wa_staff(), false) and coalesce(public.wa_page_ok('crm'), true)) then
    raise exception 'Only the Welfare Avenue team, with the CRM in their apps, can filter the contacts.' using errcode = '42501';
  end if;
  if p_filter is null or jsonb_typeof(p_filter) <> 'object' or jsonb_typeof(p_filter->'groups') is distinct from 'array' then
    raise exception 'The filter is not in the right shape: it needs {"groups": [...]}.' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_filter->'groups') g where jsonb_typeof(g->'all') = 'array' and jsonb_array_length(g->'all') > 0) then
    raise exception 'A filter needs at least one condition.' using errcode = '22023';
  end if;
  return query select x from public.crm_list_preview(p_filter) x;
end $$;
revoke all on function public.crm_filter_contacts(jsonb) from public, anon, service_role;   -- Supabase's default privileges give all three; the page alone calls it
grant execute on function public.crm_filter_contacts(jsonb) to authenticated;
comment on function public.crm_filter_contacts(jsonb) is 'wave295: the contact ids a filter selects, for the Contacts page''s Filters builder: crm_list_preview(p_filter) ({"groups":[{"all":[{f,op,v},...]},...]}: OR between groups, AND inside one), so Contacts and Lists answer the same way. Staff with the CRM only (is_wa_staff and wa_page_ok crm); a filter with no condition is refused. Security definer, so it reads every live contact once the check has passed.';

-- ============================================================================================ 4. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave295', 'wave295', null,
       'Contacts filters: crm_contact_match fails closed (unknown fields, blank values, lists where one value is meant, empty lists match no one) and gains field, chapter, dnc, phone, org and job_title, lists of values for kind, role and tag (any, all, none) and Keela tag names (crm_tag_aliases); crm_list_preview prepares tag conditions once and matches no one for no group or an empty group; crm_filter_contacts for the Contacts page (staff with the CRM).', 'wave295'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave295' and field = 'wave295');
