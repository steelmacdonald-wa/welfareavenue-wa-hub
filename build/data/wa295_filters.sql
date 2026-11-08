-- Welfare Avenue Hub: wave295, 07/11/26. Filters on the Contacts page (design "05 Contacts filters and Keela data", section Wave 295).
-- Steel, 07/11/26: the CRM could not find people by the fields in their contacts. This file gives the one filter engine (crm_contact_match, used by
-- crm_list_preview for Lists and Sends) the conditions the Contacts page's new Filters builder needs:
--   field      {f:"field", key:<crm_fields.key>, op: set | empty | is | any | contains | before | after, v}: a custom field (Keela and profile
--              fields). A list of choices matches any of them; dates compare as dates (numbers as numbers); yes/no fields use is. Unknown key: no match.
--   kind, role and tag take v as one value or a list: any of them (op is, has or any), every one (op all), none of them (op not or none).
--   tag        also matches through crm_tag_aliases() (wave294): a Keela name such as "Volunteer Server" finds the Hub tag server.
--   chapter    montreal or toronto (crm_contact_chapters, wave281). Montreal also counts a contact with no chapter row ("No chapter: counted as
--              Montreal", as the page says).
--   dnc        do not contact is on.            phone      has a phone number.
--   org        belongs to an organisation whose name contains v (the Partners link, or the volunteer record's organisation).
--   job_title  the job title contains v.        op not or none turns chapter, dnc, phone, org and job_title around, as for the older conditions.
-- Every older condition with one value (the shape every saved list has today) goes on to the live code unchanged: the new text is one block
-- inserted after the line that reads the number, and it returns only for the shapes above. For speed, crm_list_preview hands each tag condition
-- its Keela names once per query (crm_filter_prepare, crm_filter_prepare_tag): the same query otherwise, so Lists and Sends answer as before.
-- And crm_filter_contacts(p_filter): the contact ids a filter selects, for the Contacts page, staff with the CRM only. Lists keep calling
-- crm_list_preview as today: one engine, so Contacts and Lists answer the same question the same way.
-- Needs wave281 (crm_contact_chapters, crm_contacts_v.do_not_contact and job_title, wa_can), wave283 (trg_wa283_gift_audit, as the slice's last
-- page wave) and wave294 (crm_tag_aliases): the file stops at the top without them. crm_contact_match is changed by exact replacement of an anchor
-- in its live text (pg_get_functiondef), as wave273, wave281 and wave283 did: a missing anchor stops the file; crm_list_preview is replaced only while
-- its text is still the live one (md5). Each patch skips when its wave295 text is already there, so the file is safe to run twice. The live text
-- of both is in build/data/wa295_undo.sql.
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
  if to_regprocedure('public.crm_contact_match(public.crm_contacts_v,jsonb)') is null or to_regprocedure('public.crm_list_preview(jsonb)') is null then
    raise exception 'wave295: crm_contact_match or crm_list_preview is missing';
  end if;
end $wa295$;

-- ============================================================================================ 1. tag names, read once per filter
-- crm_contact_match runs once per contact and condition. So that a Keela name costs nothing per contact, crm_list_preview first hands each tag
-- condition the names its values stand for (crm_filter_prepare): for every value, itself and the Hub tags crm_tag_aliases() maps it to, folded
-- (crm_fold), as "w295sets": [["volunteer server", "server"], ...]. A condition without them (a direct call) gets them read in crm_contact_match.
create or replace function public.crm_filter_prepare_tag(k jsonb)
returns jsonb language sql stable security invoker set search_path to '' as $$
  select k || jsonb_build_object('w295sets', coalesce((
    select jsonb_agg(s.names order by s.ord) from (
      select e.ord, jsonb_build_array(public.crm_fold(e.val)) || coalesce((
               select jsonb_agg(distinct public.crm_fold(x.tag)) from public.crm_tag_aliases() x
                where public.crm_fold(x.alias) = public.crm_fold(e.val) and public.crm_fold(x.tag) <> public.crm_fold(e.val)), '[]'::jsonb) as names
        from jsonb_array_elements_text(case when jsonb_typeof(k->'v') = 'array' then k->'v' else jsonb_build_array(coalesce(k->>'v', '')) end) with ordinality e(val, ord)) s), '[]'::jsonb))
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
comment on function public.crm_filter_prepare_tag(jsonb) is 'wave295: one tag condition with "w295sets" added: for each value, itself and the Hub tags crm_tag_aliases() maps it to (folded with crm_fold), so crm_contact_match needs no lookup per contact.';
comment on function public.crm_filter_prepare(jsonb) is 'wave295: a list filter with every tag condition prepared (crm_filter_prepare_tag); crm_list_preview calls it once per query. Other conditions and a filter without groups come back as they were.';

-- crm_list_preview: the same query, with the filter prepared once (live text 8088527269cf3f6b75105421ee453abf; a different text stops the file)
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
  -- wave295: tag conditions get their Keela names once (crm_filter_prepare), not once per contact
  with p as materialized (select public.crm_filter_prepare(p_filter) as f)
  select x from public.crm_list_preview_flat(p_filter) x where jsonb_typeof(p_filter->'groups') is distinct from 'array'
  union all
  select c.id from public.crm_contacts_v c, p
  where jsonb_typeof(p_filter->'groups') = 'array' and c.merged_into is null
    and (jsonb_array_length(p_filter->'groups') = 0 or exists (
      select 1 from jsonb_array_elements(p.f->'groups') g
      where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g->'all') = 'array' then g->'all' else '[]'::jsonb end) k where not public.crm_contact_match(c, k))))
$function$
$f$;
  end if;
end $wa295$;
revoke all on function public.crm_list_preview(jsonb) from public, anon;
grant execute on function public.crm_list_preview(jsonb) to authenticated, service_role;
comment on function public.crm_list_preview(jsonb) is 'The contact ids a list filter selects today (wave155, groups wave155b): {"groups":[{"all":[{f,op,v},...]},...]} is OR between groups and AND inside one; a filter without groups is the Contacts tab''s flat shape. Reader''s rights. Since wave295 tag conditions are prepared once per query (crm_filter_prepare).';

-- ============================================================================================ 2. the new conditions in crm_contact_match
do $wa295$
declare v text; a text;
begin
  v := pg_get_functiondef('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure);
  if position('wave295' in v) = 0 then
    a := $x$  begin n := nullif(trim(v), '')::numeric; exception when others then n := null; end;
$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave295: a live function moved: crm_contact_match'; end if;
    v := replace(v, a, a || $x$  -- wave295: the Contacts filters' conditions (field, chapter, dnc, phone, org, job_title), a list of values for kind, role and tag (op any, all,
  -- none), and Keela tag names through crm_tag_aliases(). Every older condition with one value goes on to the code below unchanged.
  if f in ('kind', 'role', 'tag', 'field', 'chapter', 'dnc', 'phone', 'org', 'job_title') then
  declare
    w295_vals jsonb := case when jsonb_typeof(k->'v') = 'array' then k->'v' else jsonb_build_array(coalesce(k->>'v', '')) end;
    w295_hit int; w295_n int; w295_r boolean; w295_ft text; w295_val jsonb; w295_items text[]; w295_set boolean; w295_al jsonb; w295_i int; w295_tags text[];
  begin
    if f in ('kind', 'role') and (jsonb_typeof(k->'v') = 'array' or op in ('any', 'all')) then
      select count(*) filter (where case when f = 'kind' then
                 case e when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
                        when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
                        else e = any(coalesce(c.kinds, '{}')) end
               else e = any(coalesce(c.volunteer_roles, '{}')) or e = any(coalesce(c.volunteer_tags, '{}')) end)::int, count(*)::int into w295_hit, w295_n
        from jsonb_array_elements_text(w295_vals) e;
      return case when op in ('not', 'none') then w295_hit = 0 when op = 'all' then w295_n > 0 and w295_hit = w295_n else w295_hit > 0 end;
    end if;
    if f = 'tag' then
      -- the names each value stands for: itself and the Hub tags its Keela name maps to, folded. crm_list_preview hands them over once per
      -- query (crm_filter_prepare, below); a direct caller gets them read here.
      w295_al := case when jsonb_typeof(k->'w295sets') = 'array' then k->'w295sets' else public.crm_filter_prepare_tag(k)->'w295sets' end;
      if jsonb_typeof(k->'v') = 'array' or op in ('any', 'all') or w295_al is distinct from jsonb_build_array(jsonb_build_array(public.crm_fold(v))) then
        w295_tags := string_to_array(public.crm_fold(array_to_string(coalesce(c.tags, '{}'), chr(31))), chr(31));
        w295_hit := 0; w295_n := coalesce(jsonb_array_length(w295_al), 0);
        for w295_i in 0 .. w295_n - 1 loop
          if (w295_al -> w295_i) ?| w295_tags then w295_hit := w295_hit + 1; end if;
        end loop;
        return case when op in ('not', 'none') then w295_hit = 0 when op = 'all' then w295_n > 0 and w295_hit = w295_n else w295_hit > 0 end;
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
        if w295_ft = 'yes_no' then
          return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s
                          where (lower(btrim(e)) in ('true', 'yes', 'y', '1', 'oui')) = (lower(btrim(s)) in ('true', 'yes', 'y', '1', 'oui')));
        end if;
        if w295_ft = 'number' then
          begin
            return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s where nullif(btrim(e), '')::numeric = s::numeric);
          exception when others then return false;
          end;
        end if;
        return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s where public.crm_fold(btrim(s)) = public.crm_fold(btrim(e)));
      end if;
      if op = 'contains' then
        return exists (select 1 from jsonb_array_elements_text(w295_vals) e, unnest(w295_items) s where position(public.crm_fold(btrim(e)) in public.crm_fold(s)) > 0);
      end if;
      if op in ('before', 'after') then
        begin
          if w295_ft = 'number' then
            return exists (select 1 from unnest(w295_items) s where case when op = 'before' then s::numeric < nullif(btrim(v), '')::numeric else s::numeric > nullif(btrim(v), '')::numeric end);
          end if;
          return exists (select 1 from unnest(w295_items) s where case when op = 'before' then s::date < nullif(btrim(v), '')::date else s::date > nullif(btrim(v), '')::date end);
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
$x$);
    execute v;
  end if;
end $wa295$;
revoke all on function public.crm_contact_match(public.crm_contacts_v, jsonb) from public, anon;
grant execute on function public.crm_contact_match(public.crm_contacts_v, jsonb) to authenticated, service_role;
-- mail-send builds a Send's queue with crm_list_preview as the service role, and a tag condition now reads crm_tag_aliases(): wave294 grants it to
-- authenticated only, so without this a Send to a list with a tag condition would stop with "permission denied". The undo takes it back.
grant execute on function public.crm_tag_aliases() to service_role;
comment on function public.crm_contact_match(public.crm_contacts_v, jsonb) is 'One list condition {f, op, v} against one contact (wave155b; wave295). Fields: kind, role, tag, perm, email, served (ever, never, within days, count_gte), gave (ever, never, within days, lapsed days, total_gte, count_gte), city, language, source, added (days), active (days), opened and clicked (a Hub email within days), review, search; since wave295 also field (a custom field by key: set, empty, is, any, contains, before, after), chapter (montreal counts no chapter too), dnc, phone, org and job_title. kind, role and tag take one value or a list (any; op all every one; op not or none none of them); tag also matches a Keela name through crm_tag_aliases(). op not/none negates.';

-- ============================================================================================ 3. the Contacts page's filter (staff with the CRM)
create or replace function public.crm_filter_contacts(p_filter jsonb)
returns table(id bigint) language plpgsql stable security definer set search_path to '' as $$
begin
  if not (coalesce(public.is_wa_staff(), false) and coalesce(public.wa_page_ok('crm'), true)) then
    raise exception 'Only the Welfare Avenue team, with the CRM in their apps, can filter the contacts.' using errcode = '42501';
  end if;
  if p_filter is null or jsonb_typeof(p_filter) <> 'object' then
    raise exception 'The filter is not in the right shape: it needs {"groups": [...]}.' using errcode = '22023';
  end if;
  return query select x from public.crm_list_preview(p_filter) x;
end $$;
revoke all on function public.crm_filter_contacts(jsonb) from public, anon, service_role;   -- Supabase's default privileges give all three; the page alone calls it
grant execute on function public.crm_filter_contacts(jsonb) to authenticated;
comment on function public.crm_filter_contacts(jsonb) is 'wave295: the contact ids a filter selects, for the Contacts page''s Filters builder: crm_list_preview(p_filter) ({"groups":[{"all":[{f,op,v},...]},...]}: OR between groups, AND inside one), so Contacts and Lists answer the same way. Staff with the CRM only (is_wa_staff and wa_page_ok crm); security definer, so it reads every live contact once the check has passed.';

-- ============================================================================================ 4. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave295', 'wave295', null,
       'Contacts filters: crm_list_preview prepares tag conditions once (crm_filter_prepare); crm_contact_match gains field, chapter, dnc, phone, org and job_title, lists of values for kind, role and tag (any, all, none) and Keela tag names (crm_tag_aliases); crm_filter_contacts for the Contacts page (staff with the CRM).', 'wave295'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave295' and field = 'wave295');
