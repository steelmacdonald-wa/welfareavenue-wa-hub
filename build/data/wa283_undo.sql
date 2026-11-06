-- Welfare Avenue Hub: wave283 undo, 06/11/26. Reverses build/data/wa283_page.sql, in reverse order.
-- The five receipt functions and the three old crm_donations policies come back exactly as live had them on 06/11/26 (pg_get_functiondef and
-- pg_get_expr, read with the Supabase connector; the md5 of each definition is checked in test/w283sql.mjs), with their live grants and comments.
-- Then the gift audit trigger and its function are dropped and the three French words are removed. The change_log rows the trigger wrote stay
-- (they are the record of what happened). The release line stays; an undo line is added.
-- Run it before wave281's undo, never after: the wave283 policies call wa_can, which wave281's undo drops. With it, put the page parts back
-- (the previous 152, 153 and 202 segments) and receipt-pdf v2.
-- Comment statements here are indented on purpose: build/gen_data_model.py reads every file in build/data, and must keep reading the migration's text.
-- No transaction control (see the migration). Safe to run twice.

-- ============================================================================================ 1. the receipt functions back (live text, 06/11/26)
CREATE OR REPLACE FUNCTION public.crm_receipt_issue(p_gift_ids bigint[])
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can issue a receipt.'; end if;
  if coalesce((select value from public.app_config where key = 'receipt_mode'), 'off') <> 'on' then
    raise exception 'Receipts from the Hub are off: an admin turns them on in Receipts once the treasurer has confirmed the settings.';
  end if;
  return public.crm_receipt_make(p_gift_ids, null, me);
end $function$
;
revoke all on function public.crm_receipt_issue(bigint[]) from public, anon;
grant execute on function public.crm_receipt_issue(bigint[]) to authenticated, service_role;
  comment on function public.crm_receipt_issue(bigint[]) is 'Issues one official receipt (wave158b) for one donor''s due gifts of one tax year (one gift, or the year-end run''s gifts together). Admins only, and only while receipt_mode is on. Returns the receipt id; receipt-pdf then draws the PDF.';

CREATE OR REPLACE FUNCTION public.crm_receipt_replace(p_id bigint, p_reason text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff')); r record; v_new bigint;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can replace a receipt.'; end if;
  if coalesce((select value from public.app_config where key = 'receipt_mode'), 'off') <> 'on' then
    raise exception 'Receipts from the Hub are off: an admin turns them on in Receipts once the treasurer has confirmed the settings.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why the receipt is replaced.'; end if;
  select * into r from public.crm_receipts where id = p_id for update;
  if not found then raise exception 'No such receipt.'; end if;
  if r.status <> 'issued' then raise exception 'Receipt % is cancelled: issue a new one from the gift instead.', r.serial; end if;
  update public.crm_receipts set status = 'cancelled', cancelled_at = now(), cancelled_by = me, cancel_reason = 'Replaced: ' || btrim(p_reason) where id = p_id;
  update public.crm_donations set receipt_number = null, receipt_issued_at = null, receipt_source = null where id = any(r.gift_ids) and receipt_number = r.serial;
  v_new := public.crm_receipt_make(r.gift_ids, p_id, me);
  update public.crm_receipts set replaced_by_id = v_new where id = p_id;
  return v_new;
end $function$
;
revoke all on function public.crm_receipt_replace(bigint, text) from public, anon;
grant execute on function public.crm_receipt_replace(bigint, text) to authenticated, service_role;
  comment on function public.crm_receipt_replace(bigint, text) is 'Replaces an issued receipt (wave158b), admins only, while receipt_mode is on: the original is cancelled with the reason and kept, and a new receipt with the next number covers the same gifts with the donor''s details as they are now; its PDF says which receipt it cancels and replaces.';

CREATE OR REPLACE FUNCTION public.crm_receipt_cancel(p_id bigint, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff')); r record;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can cancel a receipt.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why the receipt is cancelled.'; end if;
  select * into r from public.crm_receipts where id = p_id for update;
  if not found then raise exception 'No such receipt.'; end if;
  if r.status <> 'issued' then raise exception 'Receipt % is already cancelled.', r.serial; end if;
  update public.crm_receipts set status = 'cancelled', cancelled_at = now(), cancelled_by = me, cancel_reason = btrim(p_reason) where id = p_id;
  update public.crm_donations set receipt_number = null, receipt_issued_at = null, receipt_source = null, updated_by = me
  where id = any(r.gift_ids) and receipt_number = r.serial;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_receipt', r.serial, 'cancelled', 'issued', left(btrim(p_reason), 500), me);
end $function$
;
revoke all on function public.crm_receipt_cancel(bigint, text) from public, anon;
grant execute on function public.crm_receipt_cancel(bigint, text) to authenticated, service_role;
  comment on function public.crm_receipt_cancel(bigint, text) is 'Cancels an issued receipt with the reason (wave158b), admins only, whatever the mode (a mistake can always be undone). The receipt stays, marked cancelled, as the CRA requires; its gifts lose the receipt number and follow the receipt rule again.';

CREATE OR REPLACE FUNCTION public.crm_receipt_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)
    then x.cfg || jsonb_build_object(
      'is_admin', coalesce(public.is_wa_admin(), false),
      'signature', exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = 'settings/signature.png'),
      'missing', to_jsonb(public.crm_receipt_missing(x.cfg)),
      'issued', (select count(*) from public.crm_receipts where status = 'issued'))
    else null end
  from (select jsonb_object_agg(key, value) as cfg from public.app_config where key like 'receipt\_%' or key in ('mail_charity_number', 'mail_postal_address')) x
$function$
;
revoke all on function public.crm_receipt_config() from public, anon;
grant execute on function public.crm_receipt_config() to authenticated, service_role;
  comment on function public.crm_receipt_config() is 'The receipt settings for the Gifts tab (wave158, wave158b): the mode (off until the treasurer and Steel say go), the charity''s name and address as on file with the CRA, the registration number, where receipts are issued, the numbering (prefix and next number), the signatory; whether the caller is an admin, whether a signature image is uploaded, what is still missing in words, and how many receipts are issued.';

CREATE OR REPLACE FUNCTION public.crm_receipt_doc(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; v_rep text; v_by text; v_svc boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if not (v_svc or (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true))) then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  select * into r from public.crm_receipts where id = p_id;
  if not found then raise exception 'No such receipt.'; end if;
  select serial into v_rep from public.crm_receipts where id = r.replaces_id;
  select serial into v_by from public.crm_receipts where id = r.replaced_by_id;
  return jsonb_build_object('id', r.id, 'serial', r.serial, 'status', r.status, 'kind', r.kind, 'tax_year', r.tax_year, 'gifts', r.gifts,
    'amount', r.amount, 'advantage_amount', r.advantage_amount, 'eligible_amount', r.eligible_amount, 'donor', r.donor, 'charity', r.charity,
    'location', r.location, 'issued_date', to_char((r.issued_at at time zone 'America/Toronto')::date, 'FMDD FMMonth YYYY'), 'issued_at', r.issued_at,
    'replaces_serial', v_rep, 'replaced_by_serial', v_by, 'cancelled', r.status = 'cancelled', 'pdf_path', r.pdf_path,
    'cancelled_pdf_path', r.cancelled_pdf_path, 'contact_id', r.contact_id, 'emailed_at', r.emailed_at, 'email_send_id', r.email_send_id,
    'is_admin', v_svc or coalesce(public.is_wa_admin(), false));
end $function$
;
revoke all on function public.crm_receipt_doc(bigint) from public, anon;
grant execute on function public.crm_receipt_doc(bigint) to authenticated, service_role;
  comment on function public.crm_receipt_doc(bigint) is 'One receipt as it was issued, for receipt-pdf, mail-send and the Receipts view (wave158b, wave185): the serial, status, gifts, amounts, donor (with first name and language) and charity as printed, where and when, the receipt it replaces or that replaced it, the PDF paths, when it was emailed; and whether the caller is an admin. Staff with the CRM page, or the service role (the automation after an online gift).';

-- ============================================================================================ 2. the gift audit off
drop trigger if exists trg_wa283_gift_audit on public.crm_donations;
drop function if exists public.wa283_gift_audit();

-- ============================================================================================ 3. the three old gift policies back (live text, 06/11/26)
drop policy if exists crm_donations_gifts_insert on public.crm_donations;
drop policy if exists crm_donations_gifts_update on public.crm_donations;
drop policy if exists crm_donations_gifts_delete on public.crm_donations;
drop policy if exists crm_donations_staff_insert on public.crm_donations;
drop policy if exists crm_donations_staff_update on public.crm_donations;
drop policy if exists crm_donations_admin_delete on public.crm_donations;
create policy crm_donations_staff_insert on public.crm_donations for insert to authenticated
  with check ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
create policy crm_donations_staff_update on public.crm_donations for update to authenticated
  using ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true))) with check ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
create policy crm_donations_admin_delete on public.crm_donations for delete to authenticated
  using (public.is_wa_admin());

-- ============================================================================================ 4. the French words wave283 seeded
delete from public.hub_i18n
 where lang = 'fr' and kind = 'seed' and (en, tr) in (('Sends', 'Envois'), ('Imports', 'Importations'), ('Do not contact', 'Ne pas contacter'));

-- the undo record (once per release)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave283', 'wave283 undo', null, 'wave283 undone: gifts and receipts back to the earlier rights (staff record and change gifts, admins delete them and issue receipts), the gift audit off, the five receipt functions back as live had them on 06/11/26.', 'wave283 undo'
 where not exists (select 1 from public.change_log u where u.entity_type = 'release' and u.entity_id = 'wave283' and u.field = 'wave283 undo'
                    and u.changed_at >= coalesce((select max(r.changed_at) from public.change_log r where r.entity_type = 'release' and r.entity_id = 'wave283' and r.field = 'wave283'), '-infinity'::timestamptz));
