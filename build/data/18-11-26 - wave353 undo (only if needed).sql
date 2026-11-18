/* 18/11/26 - wave353 Triage: undo (only if needed). Puts the page back exactly as it was before Triage; the due-date
   check (wave213) takes over again on everyone's next visit. The database parts can stay: with no rules saved they
   change nothing. To remove the learned routes too, add the last statement. */
do $u$
begin
  if (select md5(string_agg(content, '' order by part)) from public.site_files_bak_wa353) <> '6413f287ae714cce37ece84115a93820' then
    raise exception 'the backup is not the pre-Triage page: stop';
  end if;
  update public.site_files s set content = b.content, updated_at = now()
    from public.site_files_bak_wa353 b where s.path = 'index.html' and b.path = 'index.html' and s.part = b.part;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'index.html', 'wave353 undo', 'b872ada824b3b1b8be9c55f6ff2d85d2', '6413f287ae714cce37ece84115a93820: back to before Triage', 'wave353');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as rid,
       md5(string_agg(content, '' order by part)) as live_md5 from public.site_files where path = 'index.html';

/* optional: stop the learned routes for new requests
update public.wa353_request_rules set active = false where active; */
