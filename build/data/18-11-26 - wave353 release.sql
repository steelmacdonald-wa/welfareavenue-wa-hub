/* 18/11/26 - wave353 Triage: release. Run once in the Supabase SQL editor (Hub project).
   Every step checks an md5 and stops, changing nothing, if the live page moved since it was tested. */
create table if not exists public.site_files_bak_wa353 as select * from public.site_files where path = 'index.html';
comment on table public.site_files_bak_wa353 is 'wave353: index.html as it was before Triage (md5 6413f287ae714cce37ece84115a93820), for the undo.';
alter table public.site_files_bak_wa353 enable row level security;

do $rel$
declare v_old text; v_pos int; v_new text; v_seg text;
begin
  select content into v_seg from public.wa_stage_353 where wave = 353;
  if md5(coalesce(v_seg, '')) <> '233ebaa62ca41ede212fd943e620caa5' then raise exception 'the Triage segment is not the tested one: stop'; end if;
  select content into v_old from public.site_files where path = 'index.html' and part = 10;
  if md5(v_old) <> 'ec9aabb3be39cb0dbc63b6132f4e8395' then raise exception 'the live page changed since it was tested: stop'; end if;
  v_pos := length(v_old) - strpos(reverse(v_old), reverse('</body>')) - length('</body>') + 2;
  v_new := left(v_old, v_pos - 1) || v_seg || E'\n' || substr(v_old, v_pos);
  if md5(v_new) <> '1fa627e4f7732477b6d803337d8abc0f' then raise exception 'the new page is not the tested one (%): stop', md5(v_new); end if;
  update public.site_files set content = v_new, updated_at = now() where path = 'index.html' and part = 10;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'index.html', 'wave353', '6413f287ae714cce37ece84115a93820', 'b872ada824b3b1b8be9c55f6ff2d85d2: Triage, tasks and requests one card at a time', 'wave353');
end $rel$;

/* publish, then check: live_md5 should read b872ada824b3b1b8be9c55f6ff2d85d2 */
select public.call_edge('host-sync', '{}'::jsonb) as rid,
       md5(string_agg(content, '' order by part)) as live_md5 from public.site_files where path = 'index.html';
