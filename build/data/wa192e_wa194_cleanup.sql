-- wave192e (03/10/26): the cleanup of the wave192 and wave194 sessions. Steel ran it himself in the Supabase SQL editor on
-- 03/10/26 (about 02:48 UTC) after the tool's approval prompt timed out three times ("run the clean up", then "Okay I ran it").
-- The temporary tables (wa_stage_pull194 held the staged copy of the certificate signature; the signature now lives only in
-- app_config cert_signature) and the unused hub_checkins.trail column (0 rows; no function, view or page read it). The
-- pg_net responses of both sessions had already expired (pg_net.ttl, six hours).
drop table public.wa_stage_pull194;
drop table public.wa_stage_194;
drop table public.wa_stage_push194;
drop table public.wa_stage_push194_rids;
drop table public.wa_stage_192;
drop table public.wa_stage_fn192;
drop table public.wa_stage_pull_loop;
drop table public.wa_stage_pull_loop_rids;
drop table public.wa_stage_pull_loop_tree;
drop table public.wa_stage_push192;
drop table public.wa_stage_push192_rids;
alter table public.hub_checkins drop column trail;
-- dropped: column public.hub_checkins.trail
