-- wave283: assertions on the live database, after build/data/wa281_rules.sql, test/w283live_before.sql and build/data/wa283_page.sql. Runs only
-- inside the block build/sql_rollback_test.py prints, so everything rolls back. No transaction control. Raises on the first failure, with the
-- check's name and counts only; personal data never leaves the database. The staff used for the signed-in checks (a member, a team lead, an admin)
-- are picked inside the database and never printed; the finance person is the member with caps gifts_edit set for this transaction only.
-- The gifts written here are on one invented contact (Test W283 Live Donor, example.invalid) and roll back with everything else.

-- structure, the receipt functions and the words, as the database owner
do $live$
declare e record; f record; n bigint; v_member text; v_leader text; v_admin text; v_contact bigint; r record;
begin
  select * into e from pg_temp.w283_expect;
  if (select string_agg(polname || ':' || polcmd::text, ',' order by polname) from pg_policy where polrelid = 'public.crm_donations'::regclass)
     <> 'crm_donations_gifts_delete:d,crm_donations_gifts_insert:a,crm_donations_gifts_update:w,crm_donations_staff_read:r' then
    raise exception 'w283live: crm_donations does not have the read policy and the three gifts_edit policies';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.crm_donations'::regclass and polname like 'crm_donations_gifts_%'
              and (coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), '')) not like '%is_wa_staff()%wa_can(''gifts_edit''::text)%') then
    raise exception 'w283live: a gifts policy is not is_wa_staff() and wa_can(gifts_edit)';
  end if;
  if (select q from pg_temp.w283_policy_before where polname = 'crm_donations_staff_read') is distinct from
     (select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.crm_donations'::regclass and polname = 'crm_donations_staff_read') then
    raise exception 'w283live: the read policy changed';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wa283_gift_audit' and tgrelid = 'public.crm_donations'::regclass) then raise exception 'w283live: no gift audit trigger'; end if;
  if (select count(*) from pg_trigger t where tgrelid = 'public.crm_donations'::regclass and not tgisinternal) <> (select count(*) + 1 from pg_temp.w283_trigger_before) then
    raise exception 'w283live: crm_donations should have exactly one trigger more than before';
  end if;
  for f in select b.*, md5(pg_get_functiondef(b.f::regprocedure)) as now_md5, (select proacl::text from pg_proc where oid = b.f::regprocedure) as now_acl,
                  obj_description(b.f::regprocedure, 'pg_proc') as now_cmt, pg_get_functiondef(b.f::regprocedure) as now_def from pg_temp.w283_fn_before b loop
    if f.now_md5 = f.def_md5 then raise exception 'w283live: % was not patched', f.f; end if;
    if f.now_acl is distinct from f.acl then raise exception 'w283live: % grants changed', f.f; end if;
    if f.now_cmt not like '%wave283%' then raise exception 'w283live: % comment does not say what wave283 changed', f.f; end if;
    if f.f like '%issue%' or f.f like '%replace%' or f.f like '%cancel%' then
      if position('wa_can(''gifts_edit'')' in f.now_def) = 0 or position('is_wa_admin' in f.now_def) > 0 then raise exception 'w283live: % does not check gifts_edit alone', f.f; end if;
    else
      if position('can_issue' in f.now_def) = 0 then raise exception 'w283live: % does not return can_issue', f.f; end if;
    end if;
  end loop;
  if (select count(*) from public.hub_i18n where lang = 'fr' and (en, tr, kind) in (('Sends', 'Envois', 'seed'), ('Imports', 'Importations', 'seed'), ('Do not contact', 'Ne pas contacter', 'seed'))) <> 3 then
    raise exception 'w283live: the three French words are not there';
  end if;
  if (select tr from public.hub_i18n where lang = 'fr' and en = 'Send') is distinct from e.send_tr then raise exception 'w283live: the word Send changed'; end if;
  if (select count(*) from public.hub_i18n where lang = 'fr') <> e.i18n_rows + 3 - e.words_before then raise exception 'w283live: hub_i18n row count is off'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave283' and field = 'wave283') <> 1 then raise exception 'w283live: not one release line'; end if;
  if (select count(*) from public.crm_donations) <> e.gifts or (select md5(string_agg(to_jsonb(d)::text, '|' order by d.id)) from public.crm_donations d) is distinct from e.gifts_md5 then
    raise exception 'w283live: the migration changed a gift';
  end if;
  if (select count(*) from public.change_log where entity_type = 'crm_donations' and field = 'gift') <> e.gift_log_rows then raise exception 'w283live: the migration wrote gift log rows'; end if;

  -- who signs in for the next checks: a member (no caps, CRM page open), a team lead (CRM page open), an admin; picked here, never printed
  for r in select h.email, h.role from public.hub_roles h where h.role in ('member', 'leader', 'admin') order by h.role, h.email loop
    perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', r.email)::text, true);
    if public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) then
      if r.role = 'member' and v_member is null and not public.wa_is_hr() and not public.wa_can('gifts_edit') then v_member := r.email; end if;
      if r.role = 'leader' and v_leader is null then v_leader := r.email; end if;
      if r.role = 'admin' and v_admin is null then v_admin := r.email; end if;
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  if v_member is null or v_leader is null or v_admin is null then raise exception 'w283live: no member, team lead or admin with the CRM to sign in as'; end if;
  insert into public.crm_contacts (full_name, emails, source) values ('Test W283 Live Donor', array['w283.live.donor@example.invalid'], 'manual') returning id into v_contact;
  perform set_config('w283.contact', v_contact::text, true);
  perform set_config('w283.member', v_member, true);
  perform set_config('w283.leader', v_leader, true);
  perform set_config('w283.admin', v_admin, true);

  -- the receipt functions as each person (the database owner, with the person's claims)
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_member)::text, true);
  if public.crm_receipt_config() ->> 'can_issue' <> 'false' or public.crm_receipt_config() ->> 'is_admin' <> 'false' then raise exception 'w283live: a member can issue receipts'; end if;
  begin
    perform public.crm_receipt_issue(array[]::bigint[]);
    raise exception 'w283live: a member issued a receipt';
  exception when raise_exception then
    if sqlerrm like 'w283live:%' then raise; end if;
    if sqlerrm <> 'Only team leads, admins and finance can issue a receipt.' then raise exception 'w283live: a member was refused with the wrong words'; end if;
  end;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_leader)::text, true);
  if public.crm_receipt_config() ->> 'can_issue' <> 'true' or public.crm_receipt_config() ->> 'is_admin' <> 'false' then raise exception 'w283live: a team lead''s receipt rights are wrong'; end if;
  begin
    perform public.crm_receipt_cancel(-1, 'w283 live check');
  exception when raise_exception then
    if sqlerrm like 'Only %' then raise exception 'w283live: a team lead was refused a cancel by the rights check'; end if;
  end;
  select id into n from public.crm_receipts order by id desc limit 1;
  if n is not null and public.crm_receipt_doc(n) ->> 'can_issue' <> 'true' then raise exception 'w283live: crm_receipt_doc says a team lead may not draw the copy'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_member)::text, true);
  if n is not null and public.crm_receipt_doc(n) ->> 'can_issue' <> 'false' then raise exception 'w283live: crm_receipt_doc says a member may draw the copy'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_admin)::text, true);
  if public.crm_receipt_config() ->> 'can_issue' <> 'true' or public.crm_receipt_config() ->> 'is_admin' <> 'true' then raise exception 'w283live: an admin''s receipt rights are wrong'; end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if n is not null and public.crm_receipt_doc(n) ->> 'can_issue' <> 'true' then raise exception 'w283live: the service role may not draw the copy'; end if;
  perform set_config('request.jwt.claims', '', true);
end $live$;

-- row security on gifts, as the signed-in role: a member is refused
select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', current_setting('w283.member'))::text, true);
set local role authenticated;
do $m$
declare n bigint; v_ok boolean := false; c bigint := current_setting('w283.contact')::bigint;
begin
  if (select count(*) from public.crm_donations) = 0 then raise exception 'w283live: a member reads no gifts'; end if;
  begin insert into public.crm_donations (contact_id, amount, donated_at, platform) values (c, 1, now(), 'hub'); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'w283live: a member recorded a gift'; end if;
  update public.crm_donations set notes = notes where id = (select max(id) from public.crm_donations); get diagnostics n = row_count;
  if n <> 0 then raise exception 'w283live: a member changed a gift'; end if;
  delete from public.crm_donations where contact_id = c; get diagnostics n = row_count;
  if n <> 0 then raise exception 'w283live: a member deleted a gift'; end if;
end $m$;
reset role;

-- a team lead records, changes and deletes a gift on the invented contact
select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', current_setting('w283.leader'))::text, true);
set local role authenticated;
do $l$
declare n bigint; g bigint; c bigint := current_setting('w283.contact')::bigint;
begin
  insert into public.crm_donations (contact_id, amount, donated_at, platform, kind, notes) values (c, 2, now(), 'hub', 'donation', 'w283 live check') returning id into g;
  update public.crm_donations set amount = 3 where id = g; get diagnostics n = row_count;
  if n <> 1 then raise exception 'w283live: a team lead could not change a gift'; end if;
  delete from public.crm_donations where id = g; get diagnostics n = row_count;
  if n <> 1 then raise exception 'w283live: a team lead could not delete a gift'; end if;
  perform set_config('w283.gift', g::text, true);
end $l$;
reset role;

-- the member becomes finance (caps gifts_edit, this transaction only) and records a gift
do $c$ begin update public.hub_roles set caps = caps || '{"gifts_edit": true}'::jsonb where email = current_setting('w283.member'); end $c$;
select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', current_setting('w283.member'))::text, true);
set local role authenticated;
do $f$
declare g bigint; c bigint := current_setting('w283.contact')::bigint;
begin
  if not public.wa_can('gifts_edit') then raise exception 'w283live: caps gifts_edit did not give gifts_edit'; end if;
  insert into public.crm_donations (contact_id, amount, donated_at, platform) values (c, 4, now(), 'hub') returning id into g;
  if public.crm_receipt_config() ->> 'can_issue' <> 'true' or public.crm_receipt_config() ->> 'is_admin' <> 'false' then raise exception 'w283live: finance''s receipt rights are wrong'; end if;
end $f$;
reset role;

-- the audit rows, and nothing else changed
do $a$
declare e record; g bigint := current_setting('w283.gift')::bigint; c bigint := current_setting('w283.contact')::bigint;
begin
  perform set_config('request.jwt.claims', '', true);
  select * into e from pg_temp.w283_expect;
  if (select count(*) from public.change_log where entity_type = 'crm_donations' and field = 'gift' and entity_id = g::text) <> 3 then raise exception 'w283live: the team lead''s gift does not have three log rows'; end if;
  if (select count(*) from public.change_log where entity_type = 'crm_donations' and field = 'gift' and entity_id = g::text and changed_by = lower(current_setting('w283.leader'))) <> 3 then
    raise exception 'w283live: the log rows do not name the team lead';
  end if;
  if not exists (select 1 from public.change_log where entity_type = 'crm_donations' and field = 'gift' and entity_id = g::text and old_value is null
                  and (new_value::jsonb ->> 'amount')::numeric = 2 and (new_value::jsonb ->> 'contact')::bigint = c and new_value::jsonb ? 'date' and new_value::jsonb ? 'kind' and new_value::jsonb ? 'campaign') then
    raise exception 'w283live: the new-gift log row is not the JSON the brief gives';
  end if;
  if not exists (select 1 from public.change_log where entity_type = 'crm_donations' and field = 'gift' and entity_id = g::text and (old_value::jsonb ->> 'amount')::numeric = 2 and (new_value::jsonb ->> 'amount')::numeric = 3) then
    raise exception 'w283live: the change log row does not carry the old and the new amount';
  end if;
  if not exists (select 1 from public.change_log where entity_type = 'crm_donations' and field = 'gift' and entity_id = g::text and new_value is null) then raise exception 'w283live: the delete was not logged'; end if;
  if (select count(*) from public.change_log where entity_type = 'crm_donations' and field = 'gift') <> e.gift_log_rows + 4 then raise exception 'w283live: more gift log rows than the four test changes'; end if;
  if (select count(*) from public.crm_donations where contact_id is distinct from c) <> e.gifts then raise exception 'w283live: the gift count moved outside the test contact'; end if;
  if (select md5(string_agg(to_jsonb(d)::text, '|' order by d.id)) from public.crm_donations d where contact_id is distinct from c) is distinct from e.gifts_md5 then
    raise exception 'w283live: a real gift changed';
  end if;
end $a$;
