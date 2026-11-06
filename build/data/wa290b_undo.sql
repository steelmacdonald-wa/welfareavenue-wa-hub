-- Welfare Avenue Hub: wave290b undo, 06/11/26. Run before build/data/wa290_undo.sql, after the page undo (so no page calls wa290_next_serving).
-- Removes the cron job wa-servings-shoutouts, the two functions, and takes down the shout-outs it wrote (active false, kept for history:
-- hub_shoutouts rows are never deleted by an undo). Safe to run twice.

do $undo$
begin
  if exists (select 1 from cron.job where jobname = 'wa-servings-shoutouts') then perform cron.unschedule('wa-servings-shoutouts'); end if;
end $undo$;
drop function if exists public.wa290_servings_shoutouts();
drop function if exists public.wa290_next_serving();
update public.hub_shoutouts set active = false where source = 'servings' and active;
