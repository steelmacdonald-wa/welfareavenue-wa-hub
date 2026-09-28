-- wave158b (28/09/26): official receipts from the Hub, built with receipts off.
-- crm_receipts keeps every receipt the Hub issues: a serial number from the settings (prefix and next number), the gifts it
-- covers, the donor and the charity as they were when it was issued, the amounts, where and when it was issued, who issued it, and
-- the PDF in the private bucket receipts. Admins issue, replace and cancel receipts through crm_receipt_issue, crm_receipt_replace
-- and crm_receipt_cancel; issuing and replacing work only while receipt_mode is on, and an admin turns it on with
-- crm_receipt_mode_set once the settings are complete and a signature is uploaded (the treasurer and Steel decide; the assistant
-- never does). The receipt-pdf edge function draws the PDFs: a sample for anyone with the CRM, the official copy for an admin.
-- A gift on an issued receipt keeps its amount, advantage, date and kind until the receipt is replaced or cancelled, and cannot be
-- deleted; a cancelled receipt stays, marked cancelled, as the CRA requires.

-- ---------- the private bucket: the PDFs and the signature ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['application/pdf', 'image/png'])
on conflict (id) do nothing;

drop policy if exists receipts_staff_read on storage.objects;
create policy receipts_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists receipts_signature_insert on storage.objects;
create policy receipts_signature_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and name = 'settings/signature.png' and coalesce(public.is_wa_admin(), false));
drop policy if exists receipts_signature_update on storage.objects;
create policy receipts_signature_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and name = 'settings/signature.png' and coalesce(public.is_wa_admin(), false))
  with check (bucket_id = 'receipts' and name = 'settings/signature.png' and coalesce(public.is_wa_admin(), false));
drop policy if exists receipts_signature_delete on storage.objects;
create policy receipts_signature_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and name = 'settings/signature.png' and coalesce(public.is_wa_admin(), false));

-- ---------- the receipts ----------
create table if not exists public.crm_receipts (
  id bigint generated always as identity primary key,
  serial text not null unique,
  number bigint not null,
  contact_id bigint not null references public.crm_contacts(id),
  tax_year int not null,
  kind text not null default 'single' check (kind in ('single', 'annual')),
  status text not null default 'issued' check (status in ('issued', 'cancelled')),
  gift_ids bigint[] not null,
  gifts jsonb not null default '[]'::jsonb,
  amount numeric(12,2) not null,
  advantage_amount numeric(12,2) not null default 0,
  eligible_amount numeric(12,2) not null,
  donor jsonb not null,
  charity jsonb not null,
  location text not null,
  issued_at timestamptz not null default now(),
  issued_by text not null,
  replaces_id bigint references public.crm_receipts(id),
  replaced_by_id bigint references public.crm_receipts(id),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  pdf_path text,
  pdf_sha256 text,
  pdf_at timestamptz,
  cancelled_pdf_path text,
  emailed_at timestamptz,
  email_send_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists crm_receipts_contact on public.crm_receipts (contact_id);
create index if not exists crm_receipts_year on public.crm_receipts (tax_year);
create index if not exists crm_receipts_gifts on public.crm_receipts using gin (gift_ids);
alter table public.crm_receipts enable row level security;
drop policy if exists crm_receipts_staff_read on public.crm_receipts;
create policy crm_receipts_staff_read on public.crm_receipts for select to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
revoke all on public.crm_receipts from anon;
grant select on public.crm_receipts to authenticated;
comment on table public.crm_receipts is 'Official donation receipts the Hub issued (wave158b): the serial number (prefix and next number from the settings), the gifts it covers (one gift, or a donor''s gifts of one tax year), the donor and the charity as they were at issue, the amount, advantage and eligible amount, where, when and by whom it was issued, and the PDF in the private bucket receipts. Issued, replaced and cancelled only through the crm_receipt_* functions (admins, receipt_mode on); a cancelled receipt stays, marked cancelled. Staff with the CRM page read.';
comment on column public.crm_receipts.serial is 'The receipt number printed on it: receipt_prefix and the number padded to four digits (WA-2026-0001). Unique, never reused.';
comment on column public.crm_receipts.kind is 'single (one gift) or annual (a donor''s gifts of one tax year on one receipt, the year-end run).';
comment on column public.crm_receipts.status is 'issued or cancelled. A replaced receipt is cancelled with replaced_by_id set; the replacement carries replaces_id and says on the PDF which receipt it cancels and replaces.';
comment on column public.crm_receipts.gifts is 'The gifts as they were at issue: id, date, amount, advantage and its description, eligible amount, kind, the in-kind description and appraiser.';
comment on column public.crm_receipts.donor is 'The donor as printed: name (first and last name, or the full name) and address, and the contact id.';
comment on column public.crm_receipts.charity is 'The charity as printed: name and address as on file with the CRA, the registration number, the signatory and their title.';
comment on column public.crm_receipts.pdf_path is 'The official PDF in the private bucket receipts (<tax year>/<serial>.pdf), drawn once by receipt-pdf; pdf_sha256 is its checksum. cancelled_pdf_path is the copy marked cancelled.';

/* a donor's receipts follow them when two contacts are merged (the printed donor stays as it was) */
create or replace function public.crm_receipts_follow_merge()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.merged_into is not null and old.merged_into is distinct from new.merged_into then
    update public.crm_receipts set contact_id = new.merged_into where contact_id = new.id;
  end if;
  return new;
end $function$;
revoke execute on function public.crm_receipts_follow_merge() from public, anon, authenticated;
drop trigger if exists crm_receipts_follow_merge on public.crm_contacts;
create trigger crm_receipts_follow_merge after update of merged_into on public.crm_contacts for each row execute function public.crm_receipts_follow_merge();

/* a gift on an issued receipt keeps what the receipt says, and stays */
create or replace function public.crm_donations_receipt_guard()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_serial text;
begin
  select r.serial into v_serial from public.crm_receipts r where r.status = 'issued' and old.id = any(r.gift_ids) limit 1;
  if v_serial is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'This gift is on receipt %: cancel the receipt first.', v_serial; end if;
  if new.amount is distinct from old.amount or new.advantage_amount is distinct from old.advantage_amount or new.donated_at is distinct from old.donated_at
     or new.kind is distinct from old.kind or new.in_kind_desc is distinct from old.in_kind_desc then
    raise exception 'This gift is on receipt %: replace or cancel the receipt first.', v_serial;
  end if;
  return new;
end $function$;
revoke execute on function public.crm_donations_receipt_guard() from public, anon, authenticated;
drop trigger if exists crm_donations_receipt_guard on public.crm_donations;
create trigger crm_donations_receipt_guard before update or delete on public.crm_donations for each row execute function public.crm_donations_receipt_guard();

-- ---------- what is missing before receipts can be issued ----------
create or replace function public.crm_receipt_missing(p_cfg jsonb)
returns text[] language sql immutable set search_path = '' as $function$
  select array_remove(array[
    case when coalesce(btrim(p_cfg ->> 'receipt_charity_name'), '') = '' then 'the charity''s name' end,
    case when coalesce(btrim(p_cfg ->> 'receipt_charity_address'), '') = '' then 'the charity''s address' end,
    case when coalesce(btrim(p_cfg ->> 'mail_charity_number'), '') = '' then 'the registration number' end,
    case when coalesce(btrim(p_cfg ->> 'receipt_location'), '') = '' then 'where receipts are issued' end,
    case when coalesce(btrim(p_cfg ->> 'receipt_next_number'), '') !~ '^[0-9]{1,9}$' then 'the next number' end,
    case when coalesce(btrim(p_cfg ->> 'receipt_signatory_name'), '') = '' then 'who signs' end
  ]::text[], null)
$function$;
comment on function public.crm_receipt_missing(jsonb) is 'The receipt settings still missing, in words (wave158b): the charity''s name and address, the registration number, where receipts are issued, the next number, who signs.';

create or replace function public.crm_receipt_config()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select case when public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)
    then x.cfg || jsonb_build_object(
      'is_admin', coalesce(public.is_wa_admin(), false),
      'signature', exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = 'settings/signature.png'),
      'missing', to_jsonb(public.crm_receipt_missing(x.cfg)),
      'issued', (select count(*) from public.crm_receipts where status = 'issued'))
    else null end
  from (select jsonb_object_agg(key, value) as cfg from public.app_config where key like 'receipt\_%' or key in ('mail_charity_number', 'mail_postal_address')) x
$function$;
revoke execute on function public.crm_receipt_config() from public, anon;
grant execute on function public.crm_receipt_config() to authenticated;
comment on function public.crm_receipt_config() is 'The receipt settings for the Gifts tab (wave158, wave158b): the mode (off until the treasurer and Steel say go), the charity''s name and address as on file with the CRA, the registration number, where receipts are issued, the numbering (prefix and next number), the signatory; whether the caller is an admin, whether a signature image is uploaded, what is still missing in words, and how many receipts are issued.';

-- ---------- issuing (one internal maker, three doors for admins) ----------
create or replace function public.crm_receipt_make(p_gift_ids bigint[], p_replaces bigint, p_by text)
returns bigint language plpgsql security definer set search_path = '' as $function$
declare
  v_cfg jsonb; v_contact bigint; v_year int; v_n bigint; v_serial text; v_id bigint; c record; v_name text; v_addr text;
  v_amount numeric; v_adv numeric; v_elig numeric; v_gifts jsonb; v_bad text; v_missing text[];
begin
  if p_gift_ids is null or cardinality(p_gift_ids) = 0 then raise exception 'Pick the gifts to receipt.'; end if;
  perform 1 from public.crm_donations where id = any(p_gift_ids) for update;
  if (select count(*) from public.crm_donations where id = any(p_gift_ids)) <> (select count(distinct x) from unnest(p_gift_ids) x) then
    raise exception 'A gift is missing.';
  end if;
  select min(contact_id) into v_contact from public.crm_donations where id = any(p_gift_ids);
  if v_contact is null or (select count(distinct contact_id) from public.crm_donations where id = any(p_gift_ids)) <> 1 then
    raise exception 'One receipt is for one donor.';
  end if;
  select string_agg('gift ' || r.gift_id || ': ' || r.receipt_note, '; ') into v_bad
  from public.crm_gift_receipts_v r where r.gift_id = any(p_gift_ids) and r.receipt_status <> 'due';
  if v_bad is not null then raise exception 'Not every gift is due a receipt (%).', v_bad; end if;
  if (select count(distinct tax_year) from public.crm_gift_receipts_v where gift_id = any(p_gift_ids)) <> 1 then
    raise exception 'One receipt covers one tax year.';
  end if;
  select min(tax_year) into v_year from public.crm_gift_receipts_v where gift_id = any(p_gift_ids);
  select jsonb_object_agg(key, value) into v_cfg from public.app_config where key like 'receipt\_%' or key in ('mail_charity_number', 'mail_postal_address');
  v_missing := public.crm_receipt_missing(v_cfg);
  if cardinality(v_missing) > 0 then raise exception 'The receipt settings are not complete: %.', array_to_string(v_missing, ', '); end if;
  select * into c from public.crm_contacts where id = v_contact;
  v_name := btrim(concat_ws(' ', nullif(btrim(c.first_name), ''), nullif(btrim(c.last_name), '')));
  if v_name = '' then v_name := coalesce(nullif(btrim(c.full_name), ''), ''); end if;
  v_addr := nullif(btrim(concat_ws(', ', nullif(btrim(c.address), ''), nullif(btrim(concat_ws(' ', nullif(btrim(c.city), ''), nullif(btrim(c.province), ''), nullif(btrim(c.postal_code), ''))), ''))), '');
  if v_name = '' or v_name ~* '^\(no name\)$' then raise exception 'The donor has no name on file.'; end if;
  if v_addr is null then raise exception 'The donor has no address on file: a receipt needs one.'; end if;
  select sum(d.amount), sum(coalesce(d.advantage_amount, 0)), sum(r.eligible_amount),
         jsonb_agg(jsonb_build_object('id', d.id, 'date', (d.donated_at at time zone 'America/Toronto')::date, 'amount', d.amount,
           'advantage_amount', coalesce(d.advantage_amount, 0), 'advantage_desc', d.advantage_desc, 'eligible_amount', r.eligible_amount,
           'kind', d.kind, 'in_kind_desc', d.in_kind_desc, 'appraiser', d.appraiser) order by d.donated_at, d.id)
    into v_amount, v_adv, v_elig, v_gifts
  from public.crm_donations d join public.crm_gift_receipts_v r on r.gift_id = d.id
  where d.id = any(p_gift_ids);
  if coalesce(v_elig, 0) <= 0 then raise exception 'Nothing to receipt: the eligible amount is zero.'; end if;
  select btrim(value)::bigint into v_n from public.app_config where key = 'receipt_next_number' for update;
  v_serial := coalesce(v_cfg ->> 'receipt_prefix', '') || lpad(v_n::text, 4, '0');
  if exists (select 1 from public.crm_receipts where serial = v_serial) or exists (select 1 from public.crm_donations where receipt_number = v_serial) then
    raise exception 'Receipt number % is already used: change the next number in Receipts.', v_serial;
  end if;
  update public.app_config set value = (v_n + 1)::text, updated_at = now() where key = 'receipt_next_number';
  insert into public.crm_receipts (serial, number, contact_id, tax_year, kind, gift_ids, gifts, amount, advantage_amount, eligible_amount,
                                   donor, charity, location, issued_by, replaces_id)
  values (v_serial, v_n, v_contact, v_year, case when cardinality(p_gift_ids) > 1 then 'annual' else 'single' end, p_gift_ids, v_gifts,
          v_amount, v_adv, v_elig,
          jsonb_build_object('name', v_name, 'address', v_addr, 'contact_id', v_contact),
          jsonb_build_object('name', v_cfg ->> 'receipt_charity_name', 'address', v_cfg ->> 'receipt_charity_address', 'number', v_cfg ->> 'mail_charity_number',
                             'signatory_name', v_cfg ->> 'receipt_signatory_name', 'signatory_title', nullif(v_cfg ->> 'receipt_signatory_title', '')),
          v_cfg ->> 'receipt_location', p_by, p_replaces)
  returning id into v_id;
  update public.crm_donations set receipt_number = v_serial, receipt_issued_at = now(), receipt_source = 'hub', updated_by = p_by
  where id = any(p_gift_ids);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_receipt', v_serial, case when p_replaces is null then 'issued' else 'replacement' end,
          (select serial from public.crm_receipts where id = p_replaces),
          v_name || ': ' || v_elig || ' eligible, ' || cardinality(p_gift_ids) || ' gift(s), tax year ' || v_year, p_by);
  return v_id;
end $function$;
revoke execute on function public.crm_receipt_make(bigint[], bigint, text) from public, anon, authenticated;
comment on function public.crm_receipt_make(bigint[], bigint, text) is 'Internal (wave158b): makes one receipt for one donor''s due gifts of one tax year, with the next number from the settings (locked while it is taken), the donor and the charity as printed, and marks the gifts receipted (source hub). Called by crm_receipt_issue and crm_receipt_replace only.';

create or replace function public.crm_receipt_issue(p_gift_ids bigint[])
returns bigint language plpgsql security definer set search_path = '' as $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can issue a receipt.'; end if;
  if coalesce((select value from public.app_config where key = 'receipt_mode'), 'off') <> 'on' then
    raise exception 'Receipts from the Hub are off: an admin turns them on in Receipts once the treasurer has confirmed the settings.';
  end if;
  return public.crm_receipt_make(p_gift_ids, null, me);
end $function$;
revoke execute on function public.crm_receipt_issue(bigint[]) from public, anon;
grant execute on function public.crm_receipt_issue(bigint[]) to authenticated;
comment on function public.crm_receipt_issue(bigint[]) is 'Issues one official receipt (wave158b) for one donor''s due gifts of one tax year (one gift, or the year-end run''s gifts together). Admins only, and only while receipt_mode is on. Returns the receipt id; receipt-pdf then draws the PDF.';

create or replace function public.crm_receipt_cancel(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = '' as $function$
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
end $function$;
revoke execute on function public.crm_receipt_cancel(bigint, text) from public, anon;
grant execute on function public.crm_receipt_cancel(bigint, text) to authenticated;
comment on function public.crm_receipt_cancel(bigint, text) is 'Cancels an issued receipt with the reason (wave158b), admins only, whatever the mode (a mistake can always be undone). The receipt stays, marked cancelled, as the CRA requires; its gifts lose the receipt number and follow the receipt rule again.';

create or replace function public.crm_receipt_replace(p_id bigint, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $function$
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
end $function$;
revoke execute on function public.crm_receipt_replace(bigint, text) from public, anon;
grant execute on function public.crm_receipt_replace(bigint, text) to authenticated;
comment on function public.crm_receipt_replace(bigint, text) is 'Replaces an issued receipt (wave158b), admins only, while receipt_mode is on: the original is cancelled with the reason and kept, and a new receipt with the next number covers the same gifts with the donor''s details as they are now; its PDF says which receipt it cancels and replaces.';

create or replace function public.crm_receipt_mode_set(p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff')); v_cfg jsonb; v_missing text[]; v_old text;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can turn receipts on or off.'; end if;
  if p_mode not in ('on', 'off') then raise exception 'The mode is on or off.'; end if;
  select value into v_old from public.app_config where key = 'receipt_mode';
  if p_mode = 'on' then
    select jsonb_object_agg(key, value) into v_cfg from public.app_config where key like 'receipt\_%' or key in ('mail_charity_number', 'mail_postal_address');
    v_missing := public.crm_receipt_missing(v_cfg);
    if not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = 'settings/signature.png') then
      v_missing := v_missing || 'a signature image'::text;
    end if;
    if cardinality(v_missing) > 0 then raise exception 'Not ready to turn receipts on: %.', array_to_string(v_missing, ', '); end if;
  end if;
  if v_old is distinct from p_mode then
    update public.app_config set value = p_mode, updated_at = now() where key = 'receipt_mode';
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('receipts', 'settings', 'receipt_mode', v_old, p_mode, me);
  end if;
  return public.crm_receipt_config();
end $function$;
revoke execute on function public.crm_receipt_mode_set(text) from public, anon;
grant execute on function public.crm_receipt_mode_set(text) to authenticated;
comment on function public.crm_receipt_mode_set(text) is 'Turns receipts from the Hub on or off (wave158b), admins only, logged in change_log. On needs every setting and a signature image; off stops issuing and replacing (cancelling still works). The treasurer and Steel decide; the assistant never calls it.';

-- ---------- for the PDF ----------
create or replace function public.crm_receipt_doc(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare r record; v_rep text; v_by text;
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  select * into r from public.crm_receipts where id = p_id;
  if not found then raise exception 'No such receipt.'; end if;
  select serial into v_rep from public.crm_receipts where id = r.replaces_id;
  select serial into v_by from public.crm_receipts where id = r.replaced_by_id;
  return jsonb_build_object('id', r.id, 'serial', r.serial, 'status', r.status, 'kind', r.kind, 'tax_year', r.tax_year, 'gifts', r.gifts,
    'amount', r.amount, 'advantage_amount', r.advantage_amount, 'eligible_amount', r.eligible_amount, 'donor', r.donor, 'charity', r.charity,
    'location', r.location, 'issued_date', to_char((r.issued_at at time zone 'America/Toronto')::date, 'FMDD FMMonth YYYY'),
    'replaces_serial', v_rep, 'replaced_by_serial', v_by, 'cancelled', r.status = 'cancelled', 'pdf_path', r.pdf_path,
    'cancelled_pdf_path', r.cancelled_pdf_path, 'is_admin', coalesce(public.is_wa_admin(), false));
end $function$;
revoke execute on function public.crm_receipt_doc(bigint) from public, anon;
grant execute on function public.crm_receipt_doc(bigint) to authenticated;
comment on function public.crm_receipt_doc(bigint) is 'One receipt as it was issued, for receipt-pdf and the Receipts view (wave158b): the serial, status, gifts, amounts, donor and charity as printed, where and when, the receipt it replaces or that replaced it, the PDF paths; and whether the caller is an admin. Staff with the CRM page.';

create or replace function public.crm_receipt_pdf_set(p_id bigint, p_path text, p_sha text, p_cancelled boolean default false)
returns void language sql security definer set search_path = '' as $function$
  update public.crm_receipts
     set pdf_path = case when p_cancelled then pdf_path else p_path end,
         pdf_sha256 = case when p_cancelled then pdf_sha256 else p_sha end,
         pdf_at = case when p_cancelled then pdf_at else now() end,
         cancelled_pdf_path = case when p_cancelled then p_path else cancelled_pdf_path end
   where id = p_id
$function$;
revoke execute on function public.crm_receipt_pdf_set(bigint, text, text, boolean) from public, anon, authenticated;
comment on function public.crm_receipt_pdf_set(bigint, text, text, boolean) is 'Records where receipt-pdf saved a receipt''s PDF and its checksum (wave158b), or its copy marked cancelled. Service role only.';

notify pgrst, 'reload schema';
