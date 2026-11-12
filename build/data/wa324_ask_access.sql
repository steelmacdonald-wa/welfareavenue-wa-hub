-- wave324 (12/11/26): what one person may see, by the Hub's own rules, for Ask the Hub's look-ups. Run live 12/11/26.
-- It sets the request's sign-in claims to that email for this transaction only and asks the same functions the row-level
-- policies use, so Ask the Hub answers from Slack (where there is no sign-in of theirs) by exactly the database's rules.
-- Service role only. Reads nothing but access facts. Undo: revoke execute (do not drop while ask v17 is live).
create or replace function public.wa_ask_access(p_email text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $f$
declare e text := lower(btrim(coalesce(p_email, ''))); old_claims text := current_setting('request.jwt.claims', true); old_claim text := current_setting('request.jwt.claim', true);
  out jsonb; pages jsonb := '{}'::jsonb; k text; staff boolean;
begin
  if e = '' or e !~ '^[^@\s]+@[^@\s]+$' then return jsonb_build_object('email', e, 'staff', false, 'pages', '{}'::jsonb); end if;
  perform set_config('request.jwt.claim', '', true);
  perform set_config('request.jwt.claims', jsonb_build_object('email', e, 'role', 'authenticated')::text, true);
  staff := coalesce(public.is_wa_staff(), false);
  for k in select distinct jsonb_object_keys(p.pages) from public.hub_access_profiles p loop
    pages := pages || jsonb_build_object(k, staff and coalesce(public.wa_page_ok(k), true));
  end loop;
  out := jsonb_build_object('email', e, 'staff', staff,
    'role', (select r.role from public.hub_roles r where r.email = e),
    'profile', (select r.profile from public.hub_roles r where r.email = e),
    'leader', coalesce(public.is_hub_leader(), false), 'admin', coalesce(public.is_hub_admin(), false),
    'board_viewer', coalesce(public.is_board_viewer(), false), 'hr', coalesce(public.wa_is_hr(), false),
    'pages', pages);
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  perform set_config('request.jwt.claim', coalesce(old_claim, ''), true);
  return out;
end $f$;
revoke all on function public.wa_ask_access(text) from public, anon, authenticated;
grant execute on function public.wa_ask_access(text) to service_role;
