-- records wa191q_grants (applied 02/10/26 as written, one statement at a time); this file only records it
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261002007000', 'wa191q_grants', array[$m$-- wa191q_grants (02/10/26): the staff-only wave191 functions are not for signed-out callers.
-- The security advisor listed wa191_onb_servings, wa191_onb_signup and wa191_partner_save as executable by anon (Supabase's
-- default grants to PUBLIC and anon on new functions). Each already refuses anyone who is not staff inside, but the release
-- checklist keeps new functions away from anon unless a signed-out page needs them. wa191_inv_open is an internal helper of
-- volunteer_inventory_get and volunteer_inventory_submit (security definer), so nobody else needs it.
-- The volunteer's page keeps volunteer_inventory_get, volunteer_inventory_submit, volunteer_partner_get and volunteer_partner_join
-- (the link is the key). Checked as anon and as Steel in a rolled-back block: the page's call works, staff call the
-- onboarding function, anon is refused.
revoke execute on function public.wa191_onb_servings() from public, anon;
revoke execute on function public.wa191_onb_signup(bigint[], text, text) from public, anon;
revoke execute on function public.wa191_partner_save(bigint, jsonb) from public, anon;
revoke execute on function public.wa191_inv_open(date, time) from public, anon, authenticated;
$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
