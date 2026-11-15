-- 14/11/26 - wave342 undo: puts the Hub page, the two message functions and the usual counts back as they were before wave342.
-- Run only if wave342 has to come out. One block: if any check fails, nothing changes. Nobody is messaged.
-- Stays as it is: events made with New event, people the team placed or moved, and community lead jobs (real work, harmless without the page).
do $u$
declare v_n int; g jsonb; v_k text; v_rule text;
begin
  if not exists (select 1 from public.site_files_bak_wa342) then raise exception 'no page backup (site_files_bak_wa342): was wave342 run?'; end if;
  if (select count(*) from public.wa342_undo where k in ('fn171', 'fn340', 'guides')) <> 3 then raise exception 'no database backup (wa342_undo): was wave342 run?'; end if;
  delete from public.site_files where path = 'index.html';
  insert into public.site_files select path, part, content, now() from public.site_files_bak_wa342;
  select count(*) into v_n from public.site_files where path = 'index.html';
  if v_n <> 10 then raise exception 'page restore: % parts', v_n; end if;
  execute (select v from public.wa342_undo where k = 'fn171');
  execute (select v from public.wa342_undo where k = 'fn340');
  select v::jsonb into g from public.wa342_undo where k = 'guides';
  for v_k in select jsonb_object_keys(g) loop
    update public.volunteer_role_guides set target = nullif(g->>v_k, '')::int where role = v_k and target is distinct from nullif(g->>v_k, '')::int;
  end loop;
  select v into v_rule from public.wa342_undo where k = 'rule';
  if v_rule is null then delete from public.app_config where key = 'vol_servers_per_cook'; else update public.app_config set value = v_rule where key = 'vol_servers_per_cook'; end if;
  update public.event_roster set detail = detail - 'placed_at' - 'placed_by' where detail->>'placed_by' = 'wave342 (already written to)';
  delete from public.app_config where key in ('vol_cooks_max', 'vol_pickups_max');
  drop function if exists public.wa342_event_create(jsonb);
  drop function if exists public.wa342_place(bigint[], text, text, bigint);
  drop function if exists public.wa342_cl_job(bigint, text);
  drop function if exists public.wa342_cook_serves(bigint, boolean);
  drop function if exists public.wa342_rule_save(int);
  drop function if exists public.wa342_to_place(public.event_roster);
  drop function if exists public.wa342_season(date);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave342 undo', 'd0e8555c5d2052edb0da59f45cf7bda5', 'restored from site_files_bak_wa342 and wa342_undo', 'Claude for Steel (14/11/26)');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync, (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5;
