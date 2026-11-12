-- 12/11/26 - wave312 undo (only if needed). Run the whole file once in the SQL editor: it puts index.html and f/index.html back
-- as they were before wave312 (from site_files_bak_wa312), removes the new trigger, functions and page tours, and publishes.
-- It keeps what people typed into the campaign folders (the wa_campaigns columns stay, harmless to older pages) and the listed
-- photo albums. Then, in the dashboard, deploy social-publish and form-submit again from their previous lines:
--   social-publish: the v6 source (deployed version 16 before wave312; build/fn.py get, or the repo at 57f51706)
--   form-submit:    import 'https://raw.githubusercontent.com/steelmacdonald-wa/welfareavenue-wa-hub/57f51706dc948eb3fa0648b758f5e14e9d3e9179/fn/form-submit/index.ts';
do $u$
begin
  if not exists (select 1 from public.site_files_bak_wa312 where path = 'index.html') then raise exception 'no wave312 backup: nothing changed'; end if;
  update public.site_files s set content = b.content, updated_at = now() from public.site_files_bak_wa312 b where s.path = b.path and s.part = b.part;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> '9cd38ba16139f97b90e62406aefe835d' then raise exception 'index.html did not come back as before'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave312 undo', null, '9cd38ba16139f97b90e62406aefe835d', 'Claude for Steel (undo)');
end $u$;
drop trigger if exists trg_wa312_post_out on public.content_posts;
drop function if exists public.wa312_post_out();
drop function if exists public.wa312_campaigns(bigint);
drop function if exists public.wa312_campaign_save(jsonb);
drop function if exists public.wa312_mail_insights(integer);
delete from public.trainings where key in ('tour:crmcampaigns', 'tour:crminsights') and not exists (select 1 from public.training_progress p where p.training_id = trainings.id);
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
