-- Welfare Avenue Hub: wave294 undo, 07/11/26. Takes wave294 (build/data/wa294_keela_tags.sql) out again. It:
--   * puts back wave284's exact wa284_w_participation (body and comment; the grants are never touched by create or replace);
--   * restores app_config keela_tag_map to the value wave294 replaced, but only when the map still holds the value wave294 wrote (a map an admin has changed
--     since is left alone, with a notice). The before and after values are the change_log rows wave294 recorded (entity_id wave294, field keela_tag_map);
--   * drops public.crm_tag_aliases().
-- Tags a batch 7 run already added to contacts stay (that batch's own Undo on the Import page removes them; do it before this undo if it is wanted).
-- Safe to run twice. No transaction control. Proved offline: node test/w294sql.mjs.

-- 1. wave284's participation writer, exactly as wave284 left it
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
      else
        v_add := v_add || v_tag;
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
comment on function public.wa284_w_participation(bigint, bigint, boolean) is 'wave284: batch 7 (participation). Each Keela tag goes by app_config keela_tag_map: to wa_campaign_people (the campaign by keela_name, else by name, with its part), to a chapter (the Toronto tags), to skip (the welcome-series and donor tags), or to tags[] for the rest. A campaign not yet in the Hub is created with the type an admin picked on the Import page (keela_campaign_types), else listed in campaigns_to_create. Adds only. The service role only.';

-- 2. the map, when it still holds wave294's value
do $wa294u$
declare
  r public.change_log%rowtype; v_cur text;
begin
  select l.* into r from public.change_log l where l.entity_type = 'release' and l.entity_id = 'wave294' and l.field = 'keela_tag_map' order by l.id desc limit 1;
  if not found then return; end if;
  if exists (select 1 from public.change_log l where l.entity_type = 'release' and l.entity_id = 'wave294' and l.field = 'keela_tag_map undone' and l.id > r.id) then return; end if;
  select c.value into v_cur from public.app_config c where c.key = 'keela_tag_map';
  begin
    if v_cur is null or v_cur::jsonb <> r.new_value::jsonb then
      raise notice 'wave294 undo: keela_tag_map no longer holds wave294''s value, so it was left as it is';
      return;
    end if;
  exception when others then
    raise notice 'wave294 undo: keela_tag_map is not readable as JSON, so it was left as it is';
    return;
  end;
  if r.old_value is null then
    delete from public.app_config where key = 'keela_tag_map';
  else
    update public.app_config set value = r.old_value, updated_at = now() where key = 'keela_tag_map';
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave294', 'keela_tag_map undone', r.new_value, r.old_value, 'wave294');
end $wa294u$;

-- 3. the aliases function
drop function if exists public.crm_tag_aliases();

-- 4. the undo record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave294', 'wave294 undo', null, 'Keela tag names undone (wa294_undo.sql): wave284''s batch 7 writer is back, crm_tag_aliases() is gone, and keela_tag_map is back to the value before wave294 unless an admin had changed it since.', 'wave294'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'wave294 undo');
