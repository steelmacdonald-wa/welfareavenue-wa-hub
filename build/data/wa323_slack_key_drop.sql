-- wa323_slack_key_drop (12/11/26, wave323): how the WA HUB Slack app's signing secret reached the vault without passing
-- through a chat or a person's clipboard. The same pattern as qbo_key_drop (wave302).
--
-- A one-time ticket, good for 15 minutes. With Steel watching, a short script on Slack's own Basic Information page read the
-- Signing Secret field and sent it, with the ticket, to slack_key_drop_store(), which checks the ticket and the shape of the
-- value, stores it as SLACK_SIGNING_SECRET, marks the ticket used and writes one change_log line. The script returned only
-- "saved". anon may call the function only while a ticket is live: the grant below is taken away again straight after.
--
-- To replace the secret later (after Regenerate in Slack): run the last three statements again to open a ticket, hand the
-- secret over the same way (or add it in the Supabase dashboard's Vault as SLACK_SIGNING_SECRET), then run the revoke.
create table if not exists public.slack_key_drop (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.slack_key_drop enable row level security;
revoke all on public.slack_key_drop from anon, authenticated;
comment on table public.slack_key_drop is 'One-time, 15-minute tickets for handing the WA HUB Slack app''s signing secret straight from Slack''s app settings page into the vault (SLACK_SIGNING_SECRET), so the secret never passes through chat. No read policy; used only by slack_key_drop_store(). wave323.';

create or replace function public.slack_key_drop_store(p_drop uuid, p_secret text)
returns text language plpgsql security definer set search_path to '' as $f$
declare r public.slack_key_drop; v_id uuid; v text;
begin
  select * into r from public.slack_key_drop where id = p_drop and used_at is null and created_at > now() - interval '15 minutes' for update;
  if not found then raise exception 'This key ticket has expired or was already used.'; end if;
  v := btrim(coalesce(p_secret, ''));
  if v !~ '^[a-f0-9]{32}$' then raise exception 'That does not look like a Slack signing secret.'; end if;
  select id into v_id from vault.secrets where name = 'SLACK_SIGNING_SECRET';
  if v_id is null then perform vault.create_secret(v, 'SLACK_SIGNING_SECRET', 'WA HUB Slack app signing secret: verifies requests to slack-command (wave323)');
  else perform vault.update_secret(v_id, v, 'SLACK_SIGNING_SECRET', 'WA HUB Slack app signing secret: verifies requests to slack-command (wave323)'); end if;
  update public.slack_key_drop set used_at = now() where id = p_drop;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('slack_app', 'wa_hub', 'signing secret', null, 'saved to the vault', 'key ticket ' || left(p_drop::text, 8));
  return 'saved';
end $f$;
revoke all on function public.slack_key_drop_store(uuid, text) from public, anon, authenticated;

-- Opening a ticket (only when a secret is about to be handed over):
--   grant execute on function public.slack_key_drop_store(uuid, text) to anon;
--   notify pgrst, 'reload schema';
--   insert into public.slack_key_drop default values returning id;
-- And straight after it is used:
--   revoke all on function public.slack_key_drop_store(uuid, text) from public, anon, authenticated;
