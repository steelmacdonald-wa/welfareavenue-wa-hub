-- Welfare Avenue Hub: wave283. Assertions for build/data/wa283_page.sql (Phase 3 of the Hub CRM slice 1: the CRM page and gift rights).
-- Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w283schema.sql and the migration are loaded. Everything runs in one transaction and
-- ends with a rollback; any failed assertion raises. Offline: node test/w283sql.mjs (PGlite). Every row is invented (Test ..., example.invalid).

begin;

-- ---------------------------------------------------------------- the structure
do $$
declare v text;
begin
  assert (select string_agg(polname || ':' || polcmd::text, ',' order by polname) from pg_policy where polrelid = 'public.crm_donations'::regclass)
    = 'crm_donations_gifts_delete:d,crm_donations_gifts_insert:a,crm_donations_gifts_update:w,crm_donations_staff_read:r', 'crm_donations: the read policy and the three gifts_edit policies, nothing else';
  assert (select bool_and(coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), '') like '%is_wa_staff()%wa_can(''gifts_edit''::text)%')
            from pg_policy where polrelid = 'public.crm_donations'::regclass and polname like 'crm_donations_gifts_%'), 'each write policy is is_wa_staff() and wa_can(gifts_edit)';
  assert (select pg_get_expr(polqual, polrelid) is not null and pg_get_expr(polwithcheck, polrelid) is not null from pg_policy where polname = 'crm_donations_gifts_update'), 'update checks both the old and the new row';
  assert (select polroles::regrole[]::text from pg_policy where polname = 'crm_donations_gifts_insert') = '{authenticated}', 'the policies are for signed-in users';
  assert exists (select 1 from pg_trigger where tgname = 'trg_wa283_gift_audit' and tgrelid = 'public.crm_donations'::regclass and not tgisinternal), 'the gift audit trigger is there';
  assert (select prosecdef from pg_proc where oid = 'public.wa283_gift_audit()'::regprocedure), 'the audit function is security definer (it writes change_log)';
  assert not has_function_privilege('authenticated', 'public.wa283_gift_audit()', 'execute') and not has_function_privilege('anon', 'public.wa283_gift_audit()', 'execute'),
    'nobody calls the trigger function directly';
  foreach v in array array['public.crm_receipt_issue(bigint[])', 'public.crm_receipt_replace(bigint,text)', 'public.crm_receipt_cancel(bigint,text)'] loop
    assert position($x$if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can$x$ in pg_get_functiondef(v::regprocedure)) > 0, v || ' checks gifts_edit';
    assert position('is_wa_admin' in pg_get_functiondef(v::regprocedure)) = 0, v || ' no longer checks admin';
  end loop;
  foreach v in array array['public.crm_receipt_issue(bigint[])', 'public.crm_receipt_replace(bigint,text)', 'public.crm_receipt_cancel(bigint,text)', 'public.crm_receipt_config()', 'public.crm_receipt_doc(bigint)'] loop
    assert has_function_privilege('authenticated', v, 'execute') and has_function_privilege('service_role', v, 'execute') and not has_function_privilege('anon', v, 'execute'),
      v || ' keeps its live grants (authenticated and service_role, not anon)';
    assert obj_description(v::regprocedure, 'pg_proc') like '%wave283%', v || ' has a comment that says what wave283 changed';
  end loop;
  assert (select string_agg(en || '=' || tr || '/' || kind, ',' order by en) from public.hub_i18n where lang = 'fr' and en in ('Sends', 'Imports', 'Do not contact', 'Send'))
    = 'Do not contact=Ne pas contacter/seed,Imports=Importations/seed,Send=Envoyer/seed,Sends=Envois/seed', 'three French words; Send keeps its verb (Envoyer)';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave283' and field = 'wave283') = 1, 'one release line';
end $$;

-- ---------------------------------------------------------------- a member without gifts_edit: reads gifts, cannot change them or receipts
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$
declare n int; v_ok boolean; g bigint; c jsonb;
begin
  assert not public.wa_can('gifts_edit'), 'a member has no gifts_edit';
  assert (select count(*) from public.crm_donations where contact_id = 1401) = 3, 'a member reads the gifts';
  v_ok := false;
  begin insert into public.crm_donations (contact_id, amount, donated_at, platform) values (1401, 5, now(), 'hub'); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'a member cannot record a gift (row security refuses the insert)';
  update public.crm_donations set notes = 'w283 member' where contact_id = 1401; get diagnostics n = row_count;
  assert n = 0, 'a member changes no gift (0 rows: the page shows the message)';
  delete from public.crm_donations where contact_id = 1401; get diagnostics n = row_count;
  assert n = 0, 'a member deletes no gift (0 rows)';
  c := public.crm_receipt_config();
  assert c ->> 'can_issue' = 'false' and c ->> 'is_admin' = 'false', 'crm_receipt_config: can_issue false, is_admin false for a member';
  select id into g from public.crm_donations where contact_id = 1401 and amount = 100;
  v_ok := false;
  begin perform public.crm_receipt_issue(array[g]); exception when raise_exception then v_ok := sqlerrm = 'Only team leads, admins and finance can issue a receipt.'; end;
  assert v_ok, 'a member cannot issue a receipt, and is told who can';
end $$;
reset role;

-- ---------------------------------------------------------------- a named finance person (a member with caps gifts_edit): gifts and receipts
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.finance@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
do $$
declare n int; g bigint; g2 bigint; rid bigint; rid2 bigint; c jsonb; d jsonb; v_ok boolean;
begin
  assert public.wa_can('gifts_edit') and not public.wa_can('import_admin'), 'finance has gifts_edit and nothing more';
  insert into public.crm_donations (contact_id, amount, donated_at, platform, kind, campaign) values (1401, 40, '2026-10-05T16:00:00Z', 'hub', 'donation', 'Test Campaign W283') returning id into g;
  update public.crm_donations set amount = 45, notes = 'w283 finance' where id = g; get diagnostics n = row_count;
  assert n = 1, 'finance changes a gift';
  delete from public.crm_donations where id = g; get diagnostics n = row_count;
  assert n = 1, 'finance deletes a gift';
  c := public.crm_receipt_config();
  assert c ->> 'can_issue' = 'true' and c ->> 'is_admin' = 'false', 'crm_receipt_config: can_issue true, is_admin false for finance';
  select id into g2 from public.crm_donations where contact_id = 1401 and amount = 100;
  rid := public.crm_receipt_issue(array[g2]);
  assert rid is not null and (select receipt_number from public.crm_donations where id = g2) is not null, 'finance issues a receipt';
  d := public.crm_receipt_doc(rid);
  assert d ->> 'can_issue' = 'true' and d ->> 'is_admin' = 'false', 'crm_receipt_doc: can_issue true, is_admin false for finance (receipt-pdf draws the copy)';
  v_ok := false;
  begin delete from public.crm_donations where id = g2; exception when raise_exception then v_ok := sqlerrm like 'This gift is on receipt %: cancel the receipt first.'; end;
  assert v_ok, 'a gift on an issued receipt still cannot be deleted (the receipt guard)';
  rid2 := public.crm_receipt_replace(rid, 'w283 test replace');
  assert rid2 is not null and (select status from public.crm_receipts where id = rid) = 'cancelled', 'finance replaces a receipt';
  perform public.crm_receipt_cancel(rid2, 'w283 test cancel');
  assert (select status from public.crm_receipts where id = rid2) = 'cancelled' and (select receipt_number from public.crm_donations where id = g2) is null, 'finance cancels a receipt';
end $$;
reset role;

-- the audit trail of what finance did: one change_log row per insert, update and delete, as JSON text, by finance
do $$
declare r record; n int;
begin
  select count(*) into n from public.change_log where entity_type = 'crm_donations' and field = 'gift' and changed_by = 'w281.finance@example.invalid';
  assert n >= 3, 'finance''s gift changes are logged (' || n || ')';
  select * into r from public.change_log where entity_type = 'crm_donations' and field = 'gift' and old_value is null and new_value::jsonb ->> 'campaign' = 'Test Campaign W283';
  assert r.new_value::jsonb = '{"amount": 40, "date": "2026-10-05", "kind": "donation", "campaign": "Test Campaign W283", "contact": 1401}'::jsonb, 'a new gift: old empty, new with amount, date, kind, campaign and contact';
  assert exists (select 1 from public.change_log where entity_type = 'crm_donations' and entity_id = r.entity_id and field = 'gift'
                  and old_value::jsonb ->> 'amount' = '40' and new_value::jsonb ->> 'amount' = '45'), 'a change: the old and the new amount';
  assert exists (select 1 from public.change_log where entity_type = 'crm_donations' and entity_id = r.entity_id and field = 'gift'
                  and old_value::jsonb ->> 'amount' = '45' and new_value is null), 'a delete: new empty';
  assert exists (select 1 from public.change_log where entity_type = 'crm_donations' and field = 'gift' and changed_by = 'w281.finance@example.invalid'
                  and old_value::jsonb ->> 'amount' = '100' and new_value::jsonb ->> 'amount' = '100'), 'the receipt number on a gift is a gift change too (logged)';
end $$;

-- ---------------------------------------------------------------- a team lead and an admin: gifts_edit; only the admin is_admin
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.leader@example.invalid","sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
do $$
declare g bigint; c jsonb;
begin
  assert public.wa_can('gifts_edit'), 'a team lead has gifts_edit';
  insert into public.crm_donations (contact_id, amount, donated_at, platform) values (1401, 7, now(), 'hub') returning id into g;
  assert g is not null, 'a team lead records a gift';
  c := public.crm_receipt_config();
  assert c ->> 'can_issue' = 'true' and c ->> 'is_admin' = 'false', 'a team lead may issue, and is not an admin (the settings stay admin-only)';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
do $$
declare c jsonb;
begin
  c := public.crm_receipt_config();
  assert c ->> 'can_issue' = 'true' and c ->> 'is_admin' = 'true', 'an admin: can_issue and is_admin';
end $$;
reset role;

-- ---------------------------------------------------------------- HR, blocked, nobody signed in, the service role
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.hr@example.invalid","sub":"00000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
do $$
declare v_ok boolean := false;
begin
  assert (public.crm_receipt_config() ->> 'can_issue') = 'false', 'HR (a member) may not issue';
  begin insert into public.crm_donations (contact_id, amount, donated_at, platform) values (1401, 5, now(), 'hub'); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'HR cannot record a gift';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.blocked@example.invalid","sub":"00000000-0000-0000-0000-000000000006"}', true);
set local role authenticated;
do $$
begin
  assert not public.wa_can('gifts_edit'), 'a blocked person has no gifts_edit';
  assert (select count(*) from public.crm_donations) = 0, 'and reads no gifts';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare rid bigint; g bigint;
begin
  select id into g from public.crm_donations where contact_id = 1401 and amount = 60;
  rid := public.crm_receipt_make(array[g], null, 'automation');
  assert public.crm_receipt_doc(rid) ->> 'can_issue' = 'true', 'the service role (the automation) may draw the copy';
end $$;
select set_config('request.jwt.claims', '', true);
do $$
declare g bigint;
begin
  assert public.crm_receipt_config() is null, 'nobody signed in: no receipt settings';
  insert into public.crm_donations (contact_id, amount, donated_at, platform) values (1401, 3, now(), 'stripe') returning id into g;
  assert (select changed_by from public.change_log where entity_type = 'crm_donations' and entity_id = g::text and field = 'gift') = 'system', 'a system writer is logged as system';
end $$;

select 'w283sql: all assertions passed' as result;
rollback;
