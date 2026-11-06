-- wave281: timings on live, after build/data/wa281_rules.sql, inside the block build/sql_rollback_test.py prints. It always raises: its message,
-- W281_TIMING ..., is the result (the Verification Plan asks for crm_in_chapter, crm_email_permission and wa171_opted_out over every contact).
-- Nothing is kept. No transaction control. Counts and milliseconds only.

do $t$
declare t0 timestamptz; a numeric; b numeric; c numeric; n bigint; total bigint;
begin
  -- warm up, so the first call's planning is not counted
  perform public.crm_in_chapter(x.id, 'montreal') from public.crm_contacts x limit 5;
  perform public.crm_email_permission(x.id, 'newsletter') from public.crm_contacts x limit 5;
  perform public.wa171_opted_out(x.volunteer_id, x.phones[1]) from public.crm_contacts x limit 5;
  select count(*) into total from public.crm_contacts x where x.merged_into is null;

  t0 := clock_timestamp();
  select count(*) filter (where public.crm_in_chapter(x.id, 'montreal')) + count(*) filter (where public.crm_in_chapter(x.id, 'toronto')) into n
    from public.crm_contacts x where x.merged_into is null;
  a := round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp();
  select count(*) into n from public.crm_contacts x cross join lateral public.crm_email_permission(x.id, 'newsletter') p where x.merged_into is null and p.allowed;
  b := round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp();
  select count(*) filter (where public.wa171_opted_out(x.volunteer_id, x.phones[1])) into n from public.crm_contacts x where x.merged_into is null;
  c := round(extract(epoch from clock_timestamp() - t0) * 1000);
  raise exception 'W281_TIMING over % contacts: crm_in_chapter (montreal and toronto) % ms, crm_email_permission (newsletter) % ms, wa171_opted_out % ms, total % ms',
    total, a, b, c, a + b + c;
end $t$;
