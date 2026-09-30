-- wa171d_grants (30/09/26): the wave171 helpers are for the database's own functions only (the security advisor's check):
-- nobody signed in or out calls them directly. volunteer_confirm_get and _submit stay open to the public confirm page, and
-- wa171_text_to_confirm and wa171_sms_mode_set to signed-in staff (each checks who is asking inside).
revoke all on function public.wa171_role_label(text, text) from public, anon, authenticated;
revoke all on function public.wa171_date_words(date, text) from public, anon, authenticated;
revoke all on function public.wa171_digits(text) from public, anon, authenticated;
revoke all on function public.wa171_test_phone(text) from public, anon, authenticated;
revoke all on function public.wa171_lang(bigint) from public, anon, authenticated;
revoke all on function public.wa171_opted_out(bigint, text) from public, anon, authenticated;
revoke all on function public.wa171_roster_phone(bigint) from public, anon, authenticated;
revoke all on function public.wa171_confirm_text(bigint, boolean) from public, anon, authenticated;
grant execute on function public.wa171_confirm_text(bigint, boolean) to service_role;
