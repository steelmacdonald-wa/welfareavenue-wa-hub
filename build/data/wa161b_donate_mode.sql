-- wave161b (28/09/26): putting the donation page live or taking it down, admins only, logged, and only once Stripe is set up.
create or replace function public.crm_donate_mode_set(p_mode text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_old text; v_missing text[] := '{}';
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can put the donation page live or take it down.'; end if;
  if coalesce(p_mode, '') not in ('live', 'off') then raise exception 'The donation page is live or off.'; end if;
  select value into v_old from public.app_config where key = 'donate_mode';
  if p_mode = 'live' then
    if coalesce((select value from public.app_config where key = 'donate_product'), '') = '' then v_missing := v_missing || 'the Stripe product'::text; end if;
    if coalesce((select value from public.app_config where key = 'donate_webhook'), '') = '' or public.get_secret('STRIPE_WEBHOOK_SECRET') is null then
      v_missing := v_missing || 'the Stripe webhook'::text;
    end if;
    if cardinality(v_missing) > 0 then raise exception 'Not ready to go live: % is not set up yet.', array_to_string(v_missing, ' and '); end if;
  end if;
  insert into public.app_config (key, value, updated_at) values ('donate_mode', p_mode, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('app_config', 'donate_mode', 'value', v_old, p_mode, coalesce(auth.jwt() ->> 'email', 'admin'));
  return jsonb_build_object('mode', p_mode, 'was', v_old);
end $$;
comment on function public.crm_donate_mode_set(text) is 'Puts the Hub''s donation page live or takes it down (wave161): admins only, written to change_log. Going live needs the Stripe product and the Hub''s webhook with its secret in the vault (stripe-admin setup). Taking it down stops new gifts at once; monthly gifts already started carry on in Stripe.';
revoke all on function public.crm_donate_mode_set(text) from public, anon;
grant execute on function public.crm_donate_mode_set(text) to authenticated;
