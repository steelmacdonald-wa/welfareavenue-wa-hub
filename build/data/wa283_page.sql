-- Welfare Avenue Hub: wave283, 06/11/26. Hub CRM slice 1, Phase 3: the CRM page and gift rights (design CRM-S1 v2, Phase 3, item 12; Part A.9).
-- Gifts and receipts follow wa_can('gifts_edit') (wave281): team leads, admins, and named finance people (hub_roles.caps gifts_edit). Everyone with
-- the CRM still reads gifts. It changes: the three write policies on crm_donations; a change_log row for every gift change (trg_wa283_gift_audit);
-- crm_receipt_issue, crm_receipt_replace and crm_receipt_cancel check gifts_edit instead of admin; crm_receipt_config and crm_receipt_doc also return
-- can_issue (the page and receipt-pdf v3 read it); and three French words for the interface (Sends, Imports, Do not contact).
-- Needs wave281 (wa_can) first: the file stops at the top without it. Live functions are changed by exact replacement of an anchor in their live
-- text (pg_get_functiondef), as wave273 and wave281 did: a missing anchor stops the whole file. Each patch skips when its wave283 text is already
-- there, and every other step is guarded, so the file is safe to run twice. The live text of the five functions and the three old policies is in
-- build/data/wa283_undo.sql. No transaction control: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it
-- inside a block that rolls back. Proved offline first: node test/w283sql.mjs (PGlite). Built 06/11/26, not released.

do $wa283$
begin
  if to_regprocedure('public.wa_can(text)') is null then raise exception 'wave283 needs wave281 first (public.wa_can is missing)'; end if;
end $wa283$;

-- ============================================================================================ 1. who may change gifts (Part A.9)
-- Reading stays as it is (crm_donations_staff_read). Recording, changing and deleting a gift need gifts_edit. The live text of the three old
-- policies is in the undo. System writers (crm_stripe_apply, crm_receipt_auto_issue, crm_merge_contacts, the receipt functions) are security
-- definer and are not held by row security.
drop policy if exists crm_donations_staff_insert on public.crm_donations;
drop policy if exists crm_donations_staff_update on public.crm_donations;
drop policy if exists crm_donations_admin_delete on public.crm_donations;
drop policy if exists crm_donations_gifts_insert on public.crm_donations;
drop policy if exists crm_donations_gifts_update on public.crm_donations;
drop policy if exists crm_donations_gifts_delete on public.crm_donations;
create policy crm_donations_gifts_insert on public.crm_donations for insert to authenticated
  with check (public.is_wa_staff() and public.wa_can('gifts_edit'));
create policy crm_donations_gifts_update on public.crm_donations for update to authenticated
  using (public.is_wa_staff() and public.wa_can('gifts_edit')) with check (public.is_wa_staff() and public.wa_can('gifts_edit'));
create policy crm_donations_gifts_delete on public.crm_donations for delete to authenticated
  using (public.is_wa_staff() and public.wa_can('gifts_edit'));

-- every gift change writes one change_log row: the amount, date, kind, campaign and contact before and after, as JSON text
create or replace function public.wa283_gift_audit()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_old text; v_new text; v_id bigint;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_id := old.id;
    v_old := jsonb_build_object('amount', old.amount, 'date', (old.donated_at at time zone 'America/Toronto')::date, 'kind', old.kind, 'campaign', old.campaign, 'contact', old.contact_id)::text;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_id := new.id;
    v_new := jsonb_build_object('amount', new.amount, 'date', (new.donated_at at time zone 'America/Toronto')::date, 'kind', new.kind, 'campaign', new.campaign, 'contact', new.contact_id)::text;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_donations', v_id::text, 'gift', v_old, v_new, coalesce(auth.email(), 'system'));
  return null;
end $function$;
revoke all on function public.wa283_gift_audit() from public, anon, authenticated;
comment on function public.wa283_gift_audit() is 'wave283: trigger function on crm_donations (trg_wa283_gift_audit). Writes one change_log row for every gift recorded, changed or deleted: entity_type crm_donations, entity_id the gift id, field gift, old_value and new_value the amount, date (in Toronto), kind, campaign and contact as JSON text (old is null for a new gift, new is null for a deleted one), changed_by the signed-in email or system.';
drop trigger if exists trg_wa283_gift_audit on public.crm_donations;
create trigger trg_wa283_gift_audit after insert or update or delete on public.crm_donations
  for each row execute function public.wa283_gift_audit();
comment on trigger trg_wa283_gift_audit on public.crm_donations is 'wave283: one change_log row for every gift change (wa283_gift_audit).';

-- ============================================================================================ 2. the receipt functions, by exact anchor
-- Issue, replace and cancel: the admin check becomes gifts_edit. The settings, the mode and the automatic switch stay admin-only (unchanged).
-- config and doc also return can_issue, next to is_admin (kept for anything that still reads it).
do $wa283$
declare v text; a text;
begin
  v := pg_get_functiondef('public.crm_receipt_issue(bigint[])'::regprocedure);
  if position('wa_can(' in v) = 0 then
    a := $x$if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can issue a receipt.'; end if;$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave283: a live function moved: crm_receipt_issue'; end if;
    execute replace(v, a, $x$if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can issue a receipt.'; end if;$x$);
  end if;

  v := pg_get_functiondef('public.crm_receipt_replace(bigint,text)'::regprocedure);
  if position('wa_can(' in v) = 0 then
    a := $x$if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can replace a receipt.'; end if;$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave283: a live function moved: crm_receipt_replace'; end if;
    execute replace(v, a, $x$if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can replace a receipt.'; end if;$x$);
  end if;

  v := pg_get_functiondef('public.crm_receipt_cancel(bigint,text)'::regprocedure);
  if position('wa_can(' in v) = 0 then
    a := $x$if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can cancel a receipt.'; end if;$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave283: a live function moved: crm_receipt_cancel'; end if;
    execute replace(v, a, $x$if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can cancel a receipt.'; end if;$x$);
  end if;

  v := pg_get_functiondef('public.crm_receipt_config()'::regprocedure);
  if position('can_issue' in v) = 0 then
    a := $x$'is_admin', coalesce(public.is_wa_admin(), false),$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave283: a live function moved: crm_receipt_config'; end if;
    execute replace(v, a, a || E'\n' || $x$      'can_issue', coalesce(public.wa_can('gifts_edit'), false),$x$);
  end if;

  v := pg_get_functiondef('public.crm_receipt_doc(bigint)'::regprocedure);
  if position('can_issue' in v) = 0 then
    a := $x$'is_admin', v_svc or coalesce(public.is_wa_admin(), false));$x$;
    if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave283: a live function moved: crm_receipt_doc'; end if;
    execute replace(v, a, $x$'is_admin', v_svc or coalesce(public.is_wa_admin(), false), 'can_issue', v_svc or coalesce(public.wa_can('gifts_edit'), false));$x$);
  end if;
end $wa283$;

-- the patched functions keep their live grants (re-applied) and get comments that say what wave283 changed
revoke all on function public.crm_receipt_issue(bigint[]) from public, anon;
grant execute on function public.crm_receipt_issue(bigint[]) to authenticated, service_role;
revoke all on function public.crm_receipt_replace(bigint, text) from public, anon;
grant execute on function public.crm_receipt_replace(bigint, text) to authenticated, service_role;
revoke all on function public.crm_receipt_cancel(bigint, text) from public, anon;
grant execute on function public.crm_receipt_cancel(bigint, text) to authenticated, service_role;
revoke all on function public.crm_receipt_config() from public, anon;
grant execute on function public.crm_receipt_config() to authenticated, service_role;
revoke all on function public.crm_receipt_doc(bigint) from public, anon;
grant execute on function public.crm_receipt_doc(bigint) to authenticated, service_role;
comment on function public.crm_receipt_issue(bigint[]) is 'Issues one official receipt (wave158b) for one donor''s due gifts of one tax year (one gift, or the year-end run''s gifts together). Since wave283 team leads, admins and finance (wa_can gifts_edit), and only while receipt_mode is on. Returns the receipt id; receipt-pdf then draws the PDF.';
comment on function public.crm_receipt_replace(bigint, text) is 'Replaces an issued receipt (wave158b), since wave283 team leads, admins and finance (wa_can gifts_edit), while receipt_mode is on: the original is cancelled with the reason and kept, and a new receipt with the next number covers the same gifts with the donor''s details as they are now; its PDF says which receipt it cancels and replaces.';
comment on function public.crm_receipt_cancel(bigint, text) is 'Cancels an issued receipt with the reason (wave158b), since wave283 team leads, admins and finance (wa_can gifts_edit), whatever the mode (a mistake can always be undone). The receipt stays, marked cancelled, as the CRA requires; its gifts lose the receipt number and follow the receipt rule again.';
comment on function public.crm_receipt_config() is 'The receipt settings for the Gifts tab (wave158, wave158b): the mode (off until the treasurer and Steel say go), the charity''s name and address as on file with the CRA, the registration number, where receipts are issued, the numbering (prefix and next number), the signatory; whether the caller is an admin (is_admin: the settings, the mode and the automatic switch), since wave283 whether the caller may issue, replace and cancel receipts (can_issue: wa_can gifts_edit), whether a signature image is uploaded, what is still missing in words, and how many receipts are issued.';
comment on function public.crm_receipt_doc(bigint) is 'One receipt as it was issued, for receipt-pdf, mail-send and the Receipts view (wave158b, wave185): the serial, status, gifts, amounts, donor (with first name and language) and charity as printed, where and when, the receipt it replaces or that replaced it, the PDF paths, when it was emailed; whether the caller is an admin, and since wave283 whether the caller may draw the official copy (can_issue: wa_can gifts_edit, or the service role). Staff with the CRM page, or the service role (the automation after an online gift).';

-- ============================================================================================ 3. French words for the interface (wave198)
-- Only where the exact word matters. "Send" already has a row (Envoyer, the button's verb) that every Send button uses; it is left as it is, so the
-- buttons keep their verb (the design's French section lists only these three).
insert into public.hub_i18n (lang, en, tr, kind)
values ('fr', 'Sends', 'Envois', 'seed'), ('fr', 'Imports', 'Importations', 'seed'), ('fr', 'Do not contact', 'Ne pas contacter', 'seed')
on conflict (lang, en) do update set tr = excluded.tr, kind = 'seed', updated_at = now()
 where public.hub_i18n.tr is distinct from excluded.tr or public.hub_i18n.kind is distinct from 'seed';

-- ============================================================================================ 4. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave283', 'wave283', null,
       'CRM page and gift rights: gifts and receipts follow wa_can(gifts_edit) (team leads, admins, finance); every gift change is logged; receipt functions check gifts_edit; can_issue for the page and receipt-pdf; three French words.', 'wave283'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave283' and field = 'wave283');
