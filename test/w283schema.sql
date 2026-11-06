-- wave283: what build/data/wa283_page.sql, its undo and the wave283 assertions touch beyond test/w281schema.sql, for the offline proof in
-- test/w283sql.mjs (PGlite). Loaded after test/w281schema.sql and build/data/wa281_rules.sql (wave281 is built on this branch but not live yet).
-- Copied read-only from live (zwnmulmnvopclzcvytce) on 06/11/26: the column lists, constraints and policies that matter, and in section 3 the
-- pg_get_functiondef text of the five live receipt functions wave283 changes (the same text as build/data/wa283_undo.sql; test/w283sql.mjs checks
-- each md5 against live). crm_receipt_make and crm_receipt_missing are stand-ins (the slice never needs their real work). Every row in section 5
-- is invented (Test ..., example.invalid). Not a copy of live: do not apply it anywhere but the offline PGlite database.

-- 1. storage.objects, which crm_receipt_config reads (only the two columns it uses)
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.objects (id bigserial primary key, bucket_id text, name text);
grant select on storage.objects to authenticated, service_role;

-- 2. tables (live columns)
create table public.hub_i18n (
  lang text not null default 'fr' check (lang = 'fr'::text), en text not null, tr text not null,
  kind text not null default 'seed' check (kind = any (array['seed'::text, 'auto'::text, 'manual'::text])), updated_at timestamptz not null default now(),
  primary key (lang, en)
);
alter table public.hub_i18n enable row level security;
create policy hub_i18n_read on public.hub_i18n for select to authenticated using (true);
revoke all on table public.hub_i18n from anon;

create table public.crm_receipts (
  id bigint generated always as identity primary key, serial text not null unique, number bigint not null, contact_id bigint not null references public.crm_contacts(id),
  tax_year integer not null, kind text not null default 'single'::text check (kind = any (array['single'::text, 'annual'::text])),
  status text not null default 'issued'::text check (status = any (array['issued'::text, 'cancelled'::text])), gift_ids bigint[] not null, gifts jsonb not null default '[]'::jsonb,
  amount numeric not null, advantage_amount numeric not null default 0, eligible_amount numeric not null, donor jsonb not null, charity jsonb not null, location text not null,
  issued_at timestamptz not null default now(), issued_by text not null, replaces_id bigint references public.crm_receipts(id), replaced_by_id bigint references public.crm_receipts(id),
  cancelled_at timestamptz, cancelled_by text, cancel_reason text, pdf_path text, pdf_sha256 text, pdf_at timestamptz, cancelled_pdf_path text, emailed_at timestamptz,
  email_send_id bigint, created_at timestamptz not null default now()
);
alter table public.crm_receipts enable row level security;
revoke all on table public.crm_receipts from anon;
create policy crm_receipts_staff_read on public.crm_receipts for select to authenticated using ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));

-- crm_donations as live: row security, the four policies, no anon grants, the receipt guard (live text)
alter table public.crm_donations enable row level security;
revoke all on table public.crm_donations from anon;
create policy crm_donations_admin_delete on public.crm_donations for delete to authenticated using (public.is_wa_admin());
create policy crm_donations_staff_insert on public.crm_donations for insert to authenticated with check ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
create policy crm_donations_staff_read on public.crm_donations for select to authenticated using ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
create policy crm_donations_staff_update on public.crm_donations for update to authenticated using ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true))) with check ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
CREATE OR REPLACE FUNCTION public.crm_donations_receipt_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;
create trigger crm_donations_receipt_guard before delete or update on public.crm_donations for each row execute function public.crm_donations_receipt_guard();

-- 3. stand-ins, then the five live receipt functions wave283 changes, exactly as live has them (06/11/26), with their grants and comments
create or replace function public.crm_receipt_missing(p jsonb) returns text[] language sql stable set search_path to '' as $function$ select array[]::text[] $function$;   -- stand-in
create or replace function public.crm_receipt_make(p_gift_ids bigint[], p_replaces bigint, p_by text) returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_n bigint := (select coalesce(max(number), 0) + 1 from public.crm_receipts);
begin   -- stand-in: one numbered receipt for the gifts, and the gifts marked
  insert into public.crm_receipts (serial, number, contact_id, tax_year, gift_ids, amount, eligible_amount, donor, charity, location, issued_by, replaces_id)
  select 'W283-' || v_n, v_n, min(d.contact_id), 2026, p_gift_ids, sum(d.amount), sum(d.amount), '{}', '{}', 'Montreal, Quebec', p_by, p_replaces
    from public.crm_donations d where d.id = any(p_gift_ids)
  returning id into v_id;
  update public.crm_donations set receipt_number = 'W283-' || v_n, receipt_issued_at = now() where id = any(p_gift_ids);
  return v_id;
end $function$;
revoke all on function public.crm_receipt_make(bigint[], bigint, text) from public, anon, authenticated;

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

-- 4. (nothing else: change_log, hub_roles, crm_contacts and crm_donations come from test/w281schema.sql and wave281)

-- 5. fixture rows (invented)
do $$ begin   -- a named finance person (wave281's caps; test/w283sql.mjs also loads this file without wave281, to see the migration stop)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_roles' and column_name = 'caps') then
    execute $q$update public.hub_roles set caps = '{"gifts_edit": true}'::jsonb where email in ('w281.finance@example.invalid', 'w281.nocrm@example.invalid')$q$;   -- nocrm: gifts_edit on a profile without the CRM page
  end if;
end $$;
insert into public.app_config (key, value) values ('receipt_mode', 'on'), ('receipt_prefix', 'W283-');
insert into public.hub_i18n (lang, en, tr, kind) values ('fr', 'Send', 'Envoyer', 'seed'), ('fr', 'Campaigns', 'Campagnes', 'seed'), ('fr', 'Campaign', 'Campagne', 'seed');
insert into public.crm_contacts (id, full_name) overriding system value values (1401, 'Test Gift Donor W283');
insert into public.crm_donations (contact_id, amount, donated_at, platform, kind) values
  (1401, 100, '2026-10-02T16:00:00Z', 'hub', 'donation'), (1401, 60, '2026-10-03T16:00:00Z', 'hub', 'donation'), (1401, 25, '2026-10-04T16:00:00Z', 'hub', 'donation');
