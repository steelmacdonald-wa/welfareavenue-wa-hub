-- wa182b_preview_claim (30/09/26): what the Hub's Send itineraries window and mail-send v4 need.
-- 1. wa182_preview_text: the itinerary text a person would get (staff who may send), for the window's preview.
-- 2. wa182_staff_can_send: whether a team address may send itineraries (mail-send checks it for the email preview and test).
-- 3. crm_claim_queued(p_limit, 'itinerary'): the pump claims the itinerary emails (meta.source itinerary) on their own.

create or replace function public.wa182_preview_text(p_roster bigint, p_note text default null, p_update boolean default false) returns text
language plpgsql stable security definer set search_path to '' as $$
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins send itineraries'; end if;
  return public.wa182_text_body(p_roster, left(p_note, 300), coalesce(p_update, false));
end $$;
comment on function public.wa182_preview_text(bigint, text, boolean) is 'wave182: the itinerary text a roster row would get, with the note and as an update or not (leaders, HR, admins), for the Send itineraries preview.';
revoke all on function public.wa182_preview_text(bigint, text, boolean) from public, anon;
grant execute on function public.wa182_preview_text(bigint, text, boolean) to authenticated;

create or replace function public.wa182_staff_can_send(p_email text) returns boolean
language plpgsql security definer set search_path to '' as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('email', lower(p_email), 'role', 'authenticated')::text, true);
  v := public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr();
  return coalesce(v, false);
end $$;
comment on function public.wa182_staff_can_send(text) is 'wave182: whether the team address may send itineraries (admins, leaders, HR), as the database decides it for a signed-in person. For mail-send (service role) only.';
revoke all on function public.wa182_staff_can_send(text) from public, anon, authenticated;

create or replace function public.crm_claim_queued(p_limit integer, p_source text)
 returns setof public.crm_email_sends language sql set search_path to '' as $function$
  with stale as (
    update public.crm_email_sends set status = 'queued', claimed_at = null
    where status = 'sending' and claimed_at < now() - interval '10 minutes'
      and case p_source when 'automation' then automation_run_id is not null when 'campaign' then campaign_id is not null
                        when 'itinerary' then coalesce(meta->>'source', '') = 'itinerary' else true end returning id
  ), picked as (
    select id from public.crm_email_sends where status = 'queued'
      and case p_source when 'automation' then automation_run_id is not null when 'campaign' then campaign_id is not null
                        when 'itinerary' then coalesce(meta->>'source', '') = 'itinerary' else true end
     order by id limit greatest(p_limit, 0) for update skip locked
  )
  update public.crm_email_sends s set status = 'sending', claimed_at = now() from picked where s.id = picked.id returning s.*
$function$;
comment on function public.crm_claim_queued(integer, text) is 'Claims queued sends for mail-send''s pump (FOR UPDATE SKIP LOCKED): automation (automation_run_id set), campaign (campaign_id set), itinerary (wave182: meta.source itinerary), or any. Sends stuck in sending for 10 minutes go back to the queue.';
