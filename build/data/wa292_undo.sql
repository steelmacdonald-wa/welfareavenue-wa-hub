-- Welfare Avenue Hub: wave292 undo, 07/11/26. Takes build/data/wa292_batches.sql back out.
-- Refuses while any email-history batch is applied (undo the batches on the Import page first, bottom up). Otherwise: puts the eleven live
-- functions back from the definitions the migration saved (wa292_fn_backup, eh-292 fix 4) while each is still as wave292 left it, falling back to taking wave292's text back out by
-- exactly the text the migration inserted; drops the delete trigger, the three crm_interactions policies, the wa292_ functions (but keeps the
-- suppression trigger and wa292_suppress_check, which need only wave289's table; wave289's undo drops them), crm_insight_input,
-- crm_insight_save, the view and the backup table; drops
-- crm_email_relationship only when it is empty (with its policy and crm_mail_steel_open), wa_partners.domain and address only when every row is
-- empty, and puts the batch kind check back when no email-history batch row remains. crm_email_suppressions is kept: opt-outs are never undone.
-- Safe to run twice. No transaction control. Proved offline: node test/w292sql.mjs.

do $wa292u$
begin
  if to_regclass('public.crm_import_batches') is not null and exists (select 1 from public.crm_import_batches b where b.kind like 'mail\_%' and b.status = 'applied' and b.kind <> 'mail_optouts') then
    raise exception 'wave292 undo: an email-history batch is still applied; undo it on the Import page first (bottom up)';
  end if;
end $wa292u$;

-- 0. eh-292 fix 4 (ground rule 11.1): the live functions back from the definitions the migration saved before it changed them
--    (wa292_fn_backup), each only while its live definition still equals what wave292 left (def_after, eh-293 B-I1); any other function
--    falls back to step 1, which takes wave292's text back out, or stops with "changed since wave292" when a later change touched it.
do $wa292u$
declare b record;
begin
  if to_regclass('public.wa292_fn_backup') is not null then
    for b in select x.fn, x.def, x.def_after from public.wa292_fn_backup x order by x.fn loop
      -- eh-293 B-I1: only while the live definition is still exactly what wave292 left; otherwise step 1 takes wave292's text out, or stops
      if to_regprocedure(b.fn) is not null and b.def_after is not null and pg_get_functiondef(to_regprocedure(b.fn)) = b.def_after then execute b.def; end if;
    end loop;
  end if;
end $wa292u$;

-- 1. the live functions: wave292's text taken back out (the same text the migration built), for any function step 0 did not restore
do $wa292u$
declare v text; a text; n text; a2 text; n2 text; nl text := chr(10);
begin
  v := pg_get_functiondef('public.wa284_write(bigint,boolean)'::regprocedure);
  if position('wa292_write' in v) > 0 then
    a := $x$when 'form_answers' then public.wa284_w_form_answers(p_batch, b.run_id, p_rehearse)$x$;
    n := a || nl || $x$    else public.wa292_write(p_batch, b.kind, b.run_id, p_rehearse)$x$;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_write changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.wa284_basis(bigint)'::regprocedure);
  if position('wa292_basis' in v) > 0 then
    a := $x$select * into b from public.crm_import_batches x where x.id = p_batch;$x$;
    n := a || nl || $x$  if b.kind like 'mail\_%' then return public.wa292_basis(p_batch); end if;$x$;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_basis changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.wa284_new_batch(bigint,text)'::regprocedure);
  if position('mail_interactions' in v) > 0 then
    a := $x$'participation', 'form_answers') then raise exception 'wa284: unknown batch kind %'$x$;
    n := $x$'participation', 'form_answers', 'mail_optouts', 'mail_orgs', 'mail_people', 'mail_enrich', 'mail_interactions')$x$ || nl
         || $x$     or (p_kind like 'mail\_%') is distinct from exists (select 1 from public.crm_import_runs r where r.id = p_run and r.source = 'email_history') then raise exception 'wa284: unknown batch kind %'$x$;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_new_batch changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.wa284_undo(bigint,text)'::regprocedure);
  if position('wa292_undo_check' in v) > 0 then
    a := $x$if b.kind in ('optouts', 'consent') then$x$;
    n := $x$if b.kind like 'mail\_%' then perform public.wa292_undo_check(p_batch); end if;$x$ || nl || $x$  if b.kind in ('optouts', 'consent', 'mail_optouts') then$x$;
    a2 := $x$update public.crm_import_batches x set status = 'undone', report = v_report,$x$;
    n2 := $x$if b.kind like 'mail\_%' then v_report := public.wa292_undo_after(p_batch, v_report); end if;$x$ || nl || '  ' || a2;
    if length(v) - length(replace(v, n, '')) <> length(n) or length(v) - length(replace(v, n2, '')) <> length(n2) then raise exception 'wave292 undo: wa284_undo changed since wave292'; end if;
    execute replace(replace(v, n, a), n2, a2);
  end if;
  v := pg_get_functiondef('public.wa284_unrow(text,text,jsonb)'::regprocedure);
  if position('crm_email_relationship' in v) > 0 then
    a := $x$elsif p_table = 'crm_contact_orgs' then$x$;
    n := $x$elsif p_table = 'crm_email_relationship' then$x$ || nl
         || $x$    delete from public.crm_email_relationship t where t.id = p_row::bigint and (to_jsonb(t) - ts) = (p_new - ts);$x$ || nl || '  ' || a;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_unrow changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  a := $x$if p_table not in ('crm_contacts', 'wa_partners') then$x$;
  n := $x$if p_table not in ('crm_contacts', 'wa_partners', 'crm_email_relationship') then$x$;
  v := pg_get_functiondef('public.wa284_set(text,bigint,text,jsonb)'::regprocedure);
  if position('crm_email_relationship' in v) > 0 then
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_set changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.wa284_upd(bigint,text,bigint,text,jsonb)'::regprocedure);
  if position('crm_email_relationship' in v) > 0 then
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_upd changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.wa284_purge(bigint)'::regprocedure);
  if position('wa292_purge' in v) > 0 then
    a := $x$delete from import_stage.rows x where x.run_id = p_run;$x$;
    n := $x$perform public.wa292_purge(p_run);$x$ || nl || '  ' || a;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa284_purge changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.wa282_first_contact_core(bigint)'::regprocedure);
  if position('gmail' in v) > 0 then
    a := $x$if v_open ~ '^\d{4}-\d{2}-\d{2}$' and v_open >= to_char(current_date - interval '12 months', 'YYYY-MM-DD') then return false; end if;$x$;
    n := a || nl || $x$  if exists (select 1 from public.crm_interactions o join public.crm_interactions i on i.contact_id = o.contact_id and i.source = 'gmail' and i.direction = 'in' and i.meta->>'thread' = o.meta->>'thread' where o.contact_id = p_contact and o.source = 'gmail' and o.direction = 'out') then return false; end if;$x$;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: wa282_first_contact_core changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
  v := pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure);
  if position('not for bulk email' in v) > 0 then
    a := $x$x.volunteer_id, x.do_not_contact$x$;
    n := $x$x.volunteer_id, x.do_not_contact, x.tags$x$;
    a2 := $x$  if c.do_not_contact then return query select false, 'do not contact'::text, null::date, c.em::text, c.st::text; return; end if;$x$;
    n2 := a2 || nl || $x$  if p_kind in ('volunteer', 'newsletter', 'fundraising') and coalesce(c.tags, '{}'::text[]) && array['general inbox', 'email history: review'] then return query select false, 'not for bulk email'::text, null::date, c.em::text, c.st::text; return; end if;$x$;
    if length(v) - length(replace(v, n, '')) <> length(n) or length(v) - length(replace(v, n2, '')) <> length(n2) then raise exception 'wave292 undo: crm_email_permission changed since wave292'; end if;
    execute replace(replace(v, n2, a2), n, a);
  end if;
  v := pg_get_functiondef('public.crm_merge_contacts(bigint,bigint)'::regprocedure);
  if position('crm_email_relationship' in v) > 0 then
    a := $x$  if exists (select 1 from public.crm_contact_private x where x.contact_id = p_keep) then$x$;
    n := $x$  if exists (select 1 from public.crm_email_relationship x where x.contact_id = p_keep) then delete from public.crm_email_relationship where contact_id = p_drop; else update public.crm_email_relationship set contact_id = p_keep where contact_id = p_drop; end if; update public.crm_email_relationship set stale = true where contact_id = p_keep;$x$ || nl || a;
    if length(v) - length(replace(v, n, '')) <> length(n) then raise exception 'wave292 undo: crm_merge_contacts changed since wave292'; end if;
    execute replace(v, n, a);
  end if;
end $wa292u$;
comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising (wave282, Steel''s rule of 5 Nov 2026): any working address that has not unsubscribed; the basis is express consent or implied consent (within two years of a gift or a serving) when there is one, otherwise not unsubscribed (WA rule of 5 Nov 2026). Bounced and complained get nothing; since wave281 a do-not-contact person gets nothing either, transactional included (basis do not contact).';
comment on function public.wa282_first_contact_core(bigint) is 'wave282 (eh-292 fix 1): the first-contact rule itself, with no caller check: true when crm_email_permission allows a newsletter with the basis exactly not unsubscribed (WA rule of 5 Nov 2026), there is no crm_email_sends row that is not a test and was sent, delivered, opened or clicked, and no Keela newsletter was opened in the last 12 months. crm_email_first_contact (staff) and the email history''s report (the service role) both call it. The service role only.';

-- 2. triggers and policies
-- eh-292 minor: trg_wa292_suppress and wa292_suppress_check stay (they need only wave289's crm_email_suppressions), so a suppressed address
-- is still born opted out after this undo; wave289's undo drops them with the table.
drop trigger if exists trg_wa292_suppress_del on public.crm_contacts;
drop trigger if exists trg_wa292_gmail_cleanup on public.crm_contacts;
drop policy if exists crm_interactions_wa292_steel_read on public.crm_interactions;
drop policy if exists crm_interactions_wa292_no_update on public.crm_interactions;
drop policy if exists crm_interactions_wa292_no_insert on public.crm_interactions;

-- 3. the view and the functions
drop view if exists public.crm_email_relationship_v;
do $wa292u$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'wa292\_%' or p.proname in ('crm_insight_input', 'crm_insight_save')) and p.proname <> 'wa292_suppress_check' loop
    execute format('drop function %s', f.sig);
  end loop;
end $wa292u$;
drop table if exists public.wa292_fn_backup;   -- eh-292 fix 4: step 0 has used it
delete from public.app_config where key = 'mail_history_refresh_daily' and value = '20';   -- eh-292 minor: the Refresh limit, when unchanged

-- 4. crm_email_relationship only when empty (an email summary is kept otherwise, with its read policy)
do $wa292u$
begin
  if to_regclass('public.crm_email_relationship') is not null then
    if not exists (select 1 from public.crm_email_relationship) then drop table public.crm_email_relationship; end if;
  end if;
  if to_regclass('public.crm_email_relationship') is null then
    drop function if exists public.crm_mail_steel_open();
  end if;
end $wa292u$;

-- 5. wa_partners.domain and address only when every row is empty
do $wa292u$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wa_partners' and column_name = 'domain') then
    if not exists (select 1 from public.wa_partners where domain is not null) then
      drop index if exists public.wa_partners_domain_uq;
      alter table public.wa_partners drop column domain;
    end if;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wa_partners' and column_name = 'address') then
    if not exists (select 1 from public.wa_partners where address is not null) then alter table public.wa_partners drop column address; end if;
  end if;
end $wa292u$;

-- 6. the batch kind check, when no email-history batch row remains
do $wa292u$
begin
  if not exists (select 1 from public.crm_import_batches b where b.kind like 'mail\_%')
     and exists (select 1 from pg_constraint where conrelid = 'public.crm_import_batches'::regclass and conname = 'crm_import_batches_kind_check'
                    and position('mail_interactions' in pg_get_constraintdef(oid)) > 0) then
    alter table public.crm_import_batches drop constraint crm_import_batches_kind_check;
    alter table public.crm_import_batches add constraint crm_import_batches_kind_check check (kind in ('optouts', 'legacy_fields', 'people', 'fields', 'orgs', 'consent', 'participation', 'form_answers'));
    comment on column public.crm_import_batches.kind is 'wave284: which import: optouts, legacy_fields, people, fields, orgs, consent, participation or form_answers (the B.1 table).';
  end if;
end $wa292u$;

-- 7. the undo record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave292', 'wave292 undo', null, 'wave292 taken back out: the live functions back as they were, its triggers, policies, functions and view dropped; email suppressions kept.', 'wave292'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave292' and field = 'wave292 undo');
