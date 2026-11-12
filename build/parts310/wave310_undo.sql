-- 12/11/26 - wave310 undo (only if needed): puts back the Hub page from before wave310 and stops the Clarity pull.
do $u$ begin
  if not exists (select 1 from public.site_files_bak_wa310) then raise exception 'no backup'; end if;
  update public.site_files f set content = b.content, updated_at = now() from public.site_files_bak_wa310 b where f.path = b.path and f.part = b.part and f.path = 'index.html';
end $u$;
select cron.unschedule('wa-clarity-pull') where exists (select 1 from cron.job where jobname = 'wa-clarity-pull');
select public.call_edge('host-sync', '{}'::jsonb);
