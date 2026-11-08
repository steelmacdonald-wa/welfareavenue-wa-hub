-- Welfare Avenue Hub: wave294, 07/11/26. Keela's tag names in the Hub CRM (design 05 Contacts filters and Keela data, "Wave 294"). Batch 7 of the Import page
-- (wave284) can now rename a Keela tag to the Hub's own tag, the map app_config keela_tag_map names a Hub tag for every Keela tag seen on contacts, and a
-- small read-only function, crm_tag_aliases(), lets the Contacts filters and search find a Hub tag by Keela's name ("volunteer server" finds server). It:
--   1. replaces public.wa284_w_participation: the one new line of behaviour is a map entry {"tag": "<hub tag>"}, which adds that Hub tag to the contact (once,
--      case-insensitive, never Keela's raw label). Every other line is wave284's text unchanged (the diff against wave284's body is those three lines and one guarded line: a raw label already in the list is not added twice);
--   2. sets app_config keela_tag_map to the full map, per key: a key the map lacks (case-insensitive) is added, an entry still equal to wave284's default entry for that key is replaced,
--      and any other entry (an admin's change) is kept, with a notice naming it. The value before and after is recorded in change_log (entity_id wave294,
--      field keela_tag_map) so the undo can put it back;
--   3. adds public.crm_tag_aliases() returning (alias, tag) from the map's tag entries, lower-cased, stable, security definer, authenticated only;
--   4. one release line in change_log.
-- Donor, Past Donor and Reoccurring Donor change from skipped to the tags donor, past donor and recurring donor (Steel wants donor tags). The campaign and
-- chapter entries of wave284 are kept exactly; Welcome Series Exit #1 stays skipped (an automation marker, not a tag).
-- Needs wave284 first: the file stops at the top without it. Safe to run twice (the second run changes nothing). No transaction control: the release runs it
-- through the Supabase connector, and build/sql_rollback_test.py runs it inside a block that rolls back. Undo: build/data/wa294_undo.sql. Proved offline first:
-- node test/w294sql.mjs (PGlite). Built 07/11/26, not released. Rule for Claude sessions: never query import_stage; read the reports instead.

do $wa294$
begin
  if to_regprocedure('public.wa284_w_participation(bigint, bigint, boolean)') is null or to_regprocedure('public.wa284_cfg(text)') is null
     or not exists (select 1 from public.app_config where key = 'keela_tag_map') then
    raise exception 'wave294 needs wave284 first (the Import page functions or the keela_tag_map setting are missing)';
  end if;
  -- the live writer must still be wave284's text, or wave294's own on a second run: the md5 of its stored text is the proof (anything else stops the file,
  -- so a later edit of the writer is never overwritten by this file or by its undo)
  if not exists (select 1 from pg_proc p where p.oid = 'public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure and md5(p.prosrc) in ('adc335abd649c226355e9a8b99986955', '43f4cd0ba7b787038f9149d28e85a1aa')) then
    raise exception 'wave294: wa284_w_participation is not the text wave284 left (its stored text changed); nothing was changed';
  end if;
end $wa294$;

-- ============================================================================================ 1. batch 7 learns the rename entry
create or replace function public.wa284_w_participation(p_batch bigint, p_run bigint, p_rehearse boolean)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  w jsonb := public.wa284_w0();
  f bigint := public.wa284_file(p_run, 'keela_contacts_json');
  k_id text := public.wa284_need(f, 'contact_id'); k_type text := public.wa284_need(f, 'contact_type'); k_email text := public.wa284_need(f, 'email');
  k_tags text := public.wa284_need(f, 'tags');
  v_map jsonb := coalesce(public.wa284_cfg('keela_tag_map'), '{}'::jsonb);
  v_types jsonb := coalesce(public.wa284_cfg('keela_campaign_types'), '{}'::jsonb);
  r record; v_id bigint; v_tag text; m jsonb; v_camp public.wa_campaigns; v_cname text; v_type text; v_part text; v_cp public.wa_campaign_people;
  v_ch public.crm_contact_chapters; v_tags text[]; v_add text[]; v_mark text := 'Keela import batch ' || p_batch;
  v_other int := public.wa284_types(f, k_type);
begin
  if v_other > 0 then w := public.wa284_bump(w, '{counts,skipped,unrecognised Contact Type}', v_other); end if;
  if jsonb_typeof(v_map) <> 'object' then raise exception 'wa284: app_config keela_tag_map is not a map'; end if;
  for r in select x.row_no, x.data from import_stage.rows x
            where x.file_id = f and lower(coalesce(public.wa284_txt(x.data -> k_type), '')) = 'individual' order by x.row_no loop
    w := public.wa284_bump(w, '{counts,rows_read}');
    if cardinality(public.wa284_list(r.data -> k_tags)) = 0 then continue; end if;
    v_id := public.wa284_contact(public.wa284_txt(r.data -> k_id), lower(public.wa284_txt(r.data -> k_email)));
    if v_id is null then w := public.wa284_bump(w, '{counts,skipped,no Hub contact}'); continue; end if;
    w := public.wa284_bump(w, '{counts,matched}');
    v_add := '{}';
    foreach v_tag in array public.wa284_list(r.data -> k_tags) loop
      m := (select e.value from jsonb_each(v_map) e where lower(e.key) = lower(v_tag) limit 1);
      if m is not null and coalesce((m ->> 'skip')::boolean, false) then
        w := public.wa284_bump(w, '{counts,skipped,tag skipped}');
      elsif m is not null and m ? 'campaign' then
        v_cname := m ->> 'campaign'; v_part := coalesce(m ->> 'part', 'participant');
        v_camp := null;
        select * into v_camp from public.wa_campaigns x where lower(x.keela_name) = lower(v_cname) or lower(x.name) = lower(v_cname)
         order by (lower(x.keela_name) = lower(v_cname)) desc nulls last, x.id limit 1;
        if v_camp.id is null then
          v_type := case when jsonb_typeof(v_types) = 'object' then v_types ->> v_cname end;
          if v_type is null or v_type not in ('fundraising_event', 'drive', 'appeal', 'program') then
            w := public.wa284_bump(w, '{counts,skipped,campaign has no type yet}');
            w := public.wa284_push(w, 'campaigns_to_create', to_jsonb(v_cname));
            continue;
          end if;
          insert into public.wa_campaigns (name, type, year, keela_name, status, created_by)
          values (v_cname, v_type, (substring(v_cname from '(20[0-9]{2})'))::int, v_cname, 'active', 'Keela import') returning * into v_camp;
          perform public.wa284_chg(p_batch, 'wa_campaigns', v_camp.id::text, null, null, to_jsonb(v_camp), 'insert');
          w := public.wa284_push(w, 'campaigns_created', to_jsonb(v_cname));
        end if;
        v_cp := null;
        insert into public.wa_campaign_people (campaign_id, contact_id, part, source, source_ref) values (v_camp.id, v_id, v_part, 'import', v_mark)
        on conflict (campaign_id, contact_id, part) do nothing returning * into v_cp;
        if v_cp.campaign_id is not null then
          perform public.wa284_chg(p_batch, 'wa_campaign_people', v_cp.campaign_id || ':' || v_cp.contact_id || ':' || v_cp.part, v_cname, null, to_jsonb(v_cp), 'insert');
        end if;
      elsif m is not null and m ? 'chapter' then
        v_ch := null;
        insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by) values (v_id, m ->> 'chapter', 'import', v_mark, 'Keela import')
        on conflict (contact_id, chapter) do nothing returning * into v_ch;
        if v_ch.contact_id is not null then
          perform public.wa284_chg(p_batch, 'crm_contact_chapters', v_ch.contact_id || ':' || v_ch.chapter, m ->> 'chapter', null, to_jsonb(v_ch), 'insert');
        end if;
      elsif m is not null and m ? 'tag' and nullif(btrim(m ->> 'tag'), '') is not null then
        -- wave294: a rename. The Hub's own tag goes in, not Keela's label; once per contact, whatever the case (WA Admin and WA Admin 2026 are both wa admin)
        if not exists (select 1 from unnest(v_add) a where lower(a) = lower(btrim(m ->> 'tag'))) then v_add := v_add || btrim(m ->> 'tag'); end if;
      else
        if not exists (select 1 from unnest(v_add) a where lower(a) = lower(v_tag)) then v_add := v_add || v_tag; end if;
      end if;
    end loop;
    if cardinality(v_add) > 0 then
      select x.tags into v_tags from public.crm_contacts x where x.id = v_id;
      v_add := array(select t from unnest(v_add) t where not exists (select 1 from unnest(v_tags) h where lower(h) = lower(t)));
      if cardinality(v_add) > 0 then perform public.wa284_upd(p_batch, 'crm_contacts', v_id, 'tags', to_jsonb(v_tags || v_add)); end if;
    end if;
  end loop;
  return w;
end $function$;
comment on function public.wa284_w_participation(bigint, bigint, boolean) is 'wave284 (changed by wave294): batch 7 (participation). Each Keela tag goes by app_config keela_tag_map: to wa_campaign_people (the campaign by keela_name, else by name, with its part), to a chapter (the Toronto tags), to skip (the welcome-series marker), to the Hub tag an entry names ({"tag": "server"}: added once, whatever the case, never Keela''s own label), or to tags[] under its Keela label when the map has no entry. A campaign not yet in the Hub is created with the type an admin picked on the Import page (keela_campaign_types), else listed in campaigns_to_create. Adds only. The service role only.';

-- ============================================================================================ 2. the tag map
do $wa294$
declare
  v_def jsonb := '{"Rally Paper Participant": {"campaign": "Rally Paper 2026", "part": "participant"}, "Flag Football 2025": {"campaign": "Football Fundraiser 2025", "part": "participant"}, "2026 Gift Basket Volunteer": {"campaign": "Gift Basket Drive 2026", "part": "volunteer"}, "Toronto Contacts": {"chapter": "toronto"}, "Toronto Volunteers": {"chapter": "toronto"}, "Welcome Series Exit #1": {"skip": true}, "Donor": {"skip": true}, "Past Donor": {"skip": true}, "Reoccurring Donor": {"skip": true}}'::jsonb;
  v_new jsonb := '{"Rally Paper Participant":{"campaign":"Rally Paper 2026","part":"participant"},"Flag Football 2025":{"campaign":"Football Fundraiser 2025","part":"participant"},"2026 Gift Basket Volunteer":{"campaign":"Gift Basket Drive 2026","part":"volunteer"},"Toronto Contacts":{"chapter":"toronto"},"Toronto Volunteers":{"chapter":"toronto","tag":"toronto volunteer"},"Welcome Series Exit #1":{"skip":true},"Donor":{"tag":"donor"},"Past Donor":{"tag":"past donor"},"Reoccurring Donor":{"tag":"recurring donor"},"Volunteer Server":{"tag":"server"},"Server":{"tag":"server"},"Volunteer Cook":{"tag":"cook"},"Monthly Newsletter Subscriber":{"tag":"newsletter"},"Volunteer Driver New":{"tag":"driver"},"Reoccuring Volunteers":{"tag":"recurring volunteer"},"Reoccurring Volunteers":{"tag":"recurring volunteer"},"WA Team Applicants":{"tag":"team applicant"},"Donated Essential Items":{"tag":"donated items"},"WA Admin":{"tag":"wa admin"},"WA Admin 2026":{"tag":"wa admin"},"Volunteer Applicant":{"tag":"volunteer applicant"},"Program Event Collaboration":{"tag":"program collaboration"},"Trajet Volunteers":{"tag":"trajet volunteer"},"Photographer":{"tag":"photographer"},"Workshop Opportunities":{"tag":"workshop opportunities"},"Partner":{"tag":"partner"},"Corporate Fundraising":{"tag":"corporate fundraising"},"Team Leader Volunteer":{"tag":"team leader"},"Drop-Off":{"tag":"drop-off"},"Pickup":{"tag":"pickup"},"Pending Location Check":{"tag":"pending location check"},"Location Approved":{"tag":"location approved"},"Toronto Organizations":{"chapter":"toronto"},"Welcome to WA #1 - Opened - Automation Trigger":{"skip":true}}'::jsonb;
  v_cur text; v_curj jsonb; v_out jsonb; e record; ck text; dk text; v_kept text[] := '{}';
begin
  select c.value into v_cur from public.app_config c where c.key = 'keela_tag_map';
  if not found then raise exception 'wave294 needs wave284 first (the keela_tag_map setting is missing)'; end if;
  begin
    v_curj := v_cur::jsonb;
  exception when others then
    raise notice 'wave294: keela_tag_map is not valid JSON; left as it is';
    return;
  end;
  if jsonb_typeof(v_curj) <> 'object' then
    raise notice 'wave294: keela_tag_map is not a map; left as it is';
    return;
  end if;
  -- per key: absent (compared without regard to case) -> add it; an entry still equal to wave284's default entry for that key -> replace it;
  -- anything else is an admin's own entry -> keep it, and say so
  v_out := v_curj;
  for e in select x.key, x.value from jsonb_each(v_new) x loop
    ck := (select c.key from jsonb_object_keys(v_curj) c(key) where lower(c.key) = lower(e.key) order by c.key limit 1);
    if ck is null then
      v_out := v_out || jsonb_build_object(e.key, e.value);
    elsif v_curj -> ck is distinct from e.value then
      dk := (select d.key from jsonb_each(v_def) d where lower(d.key) = lower(e.key) limit 1);
      if dk is not null and v_curj -> ck = v_def -> dk then
        v_out := (v_out - ck) || jsonb_build_object(e.key, e.value);
      else
        v_kept := v_kept || ck;
      end if;
    end if;
  end loop;
  if cardinality(v_kept) > 0 then
    raise notice 'wave294: kept the entries an admin changed: %', array_to_string(v_kept, ', ');
  end if;
  if v_out <> v_curj then
    update public.app_config set value = v_out::text, updated_at = now() where key = 'keela_tag_map';
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('release', 'wave294', 'keela_tag_map', v_cur, v_out::text, 'wave294');
  end if;
end $wa294$;

-- ============================================================================================ 3. the aliases
create or replace function public.crm_tag_aliases()
returns table(alias text, tag text) language plpgsql stable security definer set search_path to '' as $function$
declare v jsonb;
begin
  begin
    select c.value::jsonb into v from public.app_config c where c.key = 'keela_tag_map';
  exception when others then
    return;
  end;
  if v is null or jsonb_typeof(v) <> 'object' then return; end if;
  return query
    select distinct lower(btrim(e.key)), lower(btrim(e.value ->> 'tag'))
      from jsonb_each(v) e
     where jsonb_typeof(e.value) = 'object' and nullif(btrim(e.key), '') is not null and nullif(btrim(e.value ->> 'tag'), '') is not null
       and not (e.value ? 'campaign' or e.value ? 'skip')
     order by 1, 2;
end $function$;
revoke all on function public.crm_tag_aliases() from public, anon, authenticated;
grant execute on function public.crm_tag_aliases() to authenticated, service_role;  -- service_role: mail-send builds a Send's queue with crm_list_preview, and wave295's tag condition reads this
comment on function public.crm_tag_aliases() is 'wave294: the Keela names that find a Hub tag, as (alias, tag) pairs: every keela_tag_map entry that names a Hub tag ({"tag": "server"}), key and tag lower-cased, one row per pair, in alias order. Entries that go to a campaign or skip give no row (a chapter entry that also names a tag does). Read-only; an unreadable map gives no rows. The Contacts filters and search (wave295) use it so "volunteer server" finds server. Signed-in users only.';

-- ============================================================================================ 4. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave294', 'wave294', null,
       'Keela tag names: batch 7 renames a Keela tag to the Hub tag a keela_tag_map entry names ({"tag": ...}); keela_tag_map names a Hub tag for every Keela tag seen (Donor, Past Donor and Reoccurring Donor are now tags, not skipped; entries an admin changed are kept); crm_tag_aliases() lists the Keela names that find a Hub tag.', 'wave294'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'wave294');
