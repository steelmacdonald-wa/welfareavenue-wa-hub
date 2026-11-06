-- wave282: timings and counts on live, after build/data/wa281_rules.sql and build/data/wa282_mail_rule.sql, inside the block
-- build/sql_rollback_test.py prints. It always raises: its message, W282_TIMING ..., is the result (crm_email_permission over every contact, as the
-- Verification Plan asks, plus crm_email_first_contact and wa282_newsletter_lists, which the first newsletter needs). Signed in as an admin picked
-- inside the database and never printed. Nothing is kept (the two lists roll back). No transaction control. Counts and milliseconds only.

do $t$
declare t0 timestamptz; a numeric; b numeric; c numeric; n_allowed bigint; n_first bigint; total bigint; r jsonb; v_admin text;
begin
  select email into v_admin from public.hub_roles where role = 'admin' and email <> '' order by email limit 1;
  if v_admin is null then raise exception 'w282live_timing: no admin to sign in as'; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', v_admin)::text, true);
  -- warm up, so the first call's planning is not counted
  perform public.crm_email_permission(x.id, 'newsletter') from public.crm_contacts x limit 5;
  perform public.crm_email_first_contact(x.id) from public.crm_contacts x limit 5;
  select count(*) into total from public.crm_contacts x where x.merged_into is null;

  t0 := clock_timestamp();
  select count(*) into n_allowed from public.crm_contacts x cross join lateral public.crm_email_permission(x.id, 'newsletter') p where x.merged_into is null and p.allowed;
  a := round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp();
  select count(*) into n_first from public.crm_contacts x where x.merged_into is null and public.crm_email_first_contact(x.id);
  b := round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp();
  r := public.wa282_newsletter_lists('W282 timing check');
  c := round(extract(epoch from clock_timestamp() - t0) * 1000);
  perform set_config('request.jwt.claims', '', true);
  raise exception 'W282_TIMING over % contacts: crm_email_permission (newsletter) % ms, % allowed; crm_email_first_contact % ms, % first contacts; wa282_newsletter_lists % ms (main %, first contacts %)',
    total, a, n_allowed, b, n_first, c, r ->> 'main', r ->> 'first_contacts';
end $t$;
