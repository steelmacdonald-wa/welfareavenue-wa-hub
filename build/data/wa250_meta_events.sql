-- wave250 (15/10/26): Meta webhooks instead of polling (the meta-events edge function).
-- Steel, 14/10/26: "Add all of these to the hub, use the browser to set them up" (the six Meta additions; this is the first).
--
-- What this migration does:
--   1. meta_events: one row per change Meta sends to meta-events (Page feed, messages, mention, leadgen; Instagram comments,
--      mentions, messages; WhatsApp messages and statuses). Each row is a hint: the function re-reads the object through the
--      Graph API with the vault token before anything lands in the Hub, so an event that was not really from Meta changes
--      nothing. Message text is never kept here (the value is stored without its text fields).
--   2. The verify token for Meta's subscription check, made here and kept in the vault as META_VERIFY_TOKEN (never printed).
--   3. meta_verify_token(): the token for admins only, each read logged, so an admin can paste it into the app dashboard.

create table if not exists public.meta_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  object text not null,
  field text,
  account_id text,
  ref_id text,
  signed boolean,
  status text not null default 'new',
  result text,
  value jsonb,
  processed_at timestamptz,
  constraint meta_events_status_chk check (status in ('new', 'done', 'skipped', 'error'))
);
create index if not exists meta_events_received_idx on public.meta_events (received_at desc);
create index if not exists meta_events_status_idx on public.meta_events (status) where status in ('new', 'error');
comment on table public.meta_events is 'wave250: each change Meta sent to the meta-events webhook (object page, instagram or whatsapp_business_account; field feed, messages, mention, leadgen, comments, mentions, statuses). A hint only: meta-events re-reads the object through the Graph API before the Hub changes. value is the change without its text fields (no message or comment text kept here). Written by meta-events with the service key; admins read it (Studio > Connections). Kept 60 days.';
comment on column public.meta_events.object is 'wave250: Meta''s object: page, instagram or whatsapp_business_account.';
comment on column public.meta_events.field is 'wave250: the subscribed field the change came under (feed, messages, mention, leadgen, comments, mentions; for WhatsApp messages carries both inbound messages and statuses).';
comment on column public.meta_events.account_id is 'wave250: the entry id: the Facebook Page id, the Instagram account id or the WhatsApp Business Account id.';
comment on column public.meta_events.ref_id is 'wave250: the object the change is about: a comment or post id, a lead id, the sender''s id for a message, a WhatsApp message id.';
comment on column public.meta_events.signed is 'wave250: true when the X-Hub-Signature-256 matched META_APP_SECRET; null when the vault has no app secret (the event is still only a hint); false when it did not match (stored as skipped, never acted on).';
comment on column public.meta_events.status is 'wave250: new (received), done (acted on after a re-read), skipped (nothing to do, a duplicate, or a bad signature), error (the re-read or the action failed; result says why).';
comment on column public.meta_events.result is 'wave250: what meta-events did with the change, in a few words (never message text).';
alter table public.meta_events enable row level security;
create policy meta_events_admin_read on public.meta_events for select to authenticated using (public.is_hub_admin());
grant select on public.meta_events to authenticated;

-- 2. the verify token (once)
do $$ begin
  if public.get_secret('META_VERIFY_TOKEN') is null then
    perform public.wa_vault_set('META_VERIFY_TOKEN', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'wave250: Meta webhook verify token (meta-events GET check); paste into the HUB-Analytics app, Webhooks');
  end if;
exception when others then
  perform public.wa_vault_set('META_VERIFY_TOKEN', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'wave250: Meta webhook verify token (meta-events GET check); paste into the HUB-Analytics app, Webhooks');
end $$;

-- 3. the verify token for admins, each read logged
create or replace function public.meta_verify_token()
 returns text language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_hub_admin() then raise exception 'admins only'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('vault', 'META_VERIFY_TOKEN', 'read', null, 'shown to copy into the Meta app (Webhooks)', coalesce(lower(auth.jwt() ->> 'email'), 'unknown'));
  return public.get_secret('META_VERIFY_TOKEN');
end $$;
comment on function public.meta_verify_token() is 'wave250: the Meta webhook verify token, for an admin to paste into the HUB-Analytics app (Webhooks, Verify token). Admins only; each read lands in change_log (vault, META_VERIFY_TOKEN, read). Not a credential: it only lets Meta confirm the callback URL is ours.';
revoke all on function public.meta_verify_token() from public, anon;
grant execute on function public.meta_verify_token() to authenticated;
