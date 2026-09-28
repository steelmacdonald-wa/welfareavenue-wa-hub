-- wa158_gifts (28/09/26): gifts entered in the Hub, what kind of money they are, and the receipt foundation.
-- Step 6 of the CRM plan (wave158 of the deep dive), first part. The Hub records gifts that do not come from a platform
-- (cheques, e-transfers, cash), keeps registrations, tickets and sponsorships apart from donations with the value the
-- person received (the advantage), and says for every gift whether a CRA receipt is due, done or not possible and why.
-- Issuing official receipts (numbering, PDF, email) waits for the treasurer's settings and Steel's go-ahead: the
-- receipt settings exist, receipt_mode stays off, and the Hub only shows a sample. Zeffy, if chosen, issues its own
-- receipts for online gifts.

-- ---------- the gift: kind, method, advantage, tribute ----------
alter table public.crm_donations add column if not exists kind text not null default 'donation';
alter table public.crm_donations drop constraint if exists crm_donations_kind_check;
alter table public.crm_donations add constraint crm_donations_kind_check check (kind in ('donation', 'registration', 'ticket', 'sponsorship', 'in_kind', 'other'));
alter table public.crm_donations add column if not exists method text;
alter table public.crm_donations drop constraint if exists crm_donations_method_check;
alter table public.crm_donations add constraint crm_donations_method_check check (method is null or method in ('cheque', 'etransfer', 'cash', 'card', 'online', 'other'));
alter table public.crm_donations add column if not exists advantage_amount numeric(12, 2) not null default 0;
alter table public.crm_donations drop constraint if exists crm_donations_advantage_check;
alter table public.crm_donations add constraint crm_donations_advantage_check check (advantage_amount >= 0);
alter table public.crm_donations add column if not exists advantage_desc text;
alter table public.crm_donations add column if not exists in_kind_desc text;
alter table public.crm_donations add column if not exists appraiser text;
alter table public.crm_donations add column if not exists tribute_kind text;
alter table public.crm_donations drop constraint if exists crm_donations_tribute_check;
alter table public.crm_donations add constraint crm_donations_tribute_check check (tribute_kind is null or tribute_kind in ('honour', 'memory'));
alter table public.crm_donations add column if not exists tribute_name text;
alter table public.crm_donations add column if not exists updated_by text;
comment on column public.crm_donations.kind is 'What the money is (wave158): donation, registration (an event or a tournament fee), ticket, sponsorship (a business gets visibility: no receipt), in_kind (goods, at fair market value) or other. The Keela gifts came in as donations.';
comment on column public.crm_donations.method is 'How it came (wave158): cheque, etransfer, cash, card, online or other; empty for platform gifts.';
comment on column public.crm_donations.advantage_amount is 'The value of what the person received for the money (wave158): a meal, a ticket, the tournament itself. The eligible amount for a receipt is amount minus advantage; above 80 per cent of the amount no receipt is possible (the CRA''s threshold).';
comment on column public.crm_donations.advantage_desc is 'What the advantage was, in words, for the receipt (wave158).';
comment on column public.crm_donations.in_kind_desc is 'A gift in kind: what was given (wave158); its fair market value is the amount. appraiser: who valued it, when it was appraised.';
comment on column public.crm_donations.tribute_kind is 'A gift in honour or in memory of someone (wave158): honour or memory, with tribute_name.';

-- ---------- what the receipt looks like for each gift ----------
create or replace view public.crm_gift_receipts_v with (security_invoker = true) as
  select d.id as gift_id, d.contact_id, d.amount, d.advantage_amount, greatest(coalesce(d.amount, 0) - coalesce(d.advantage_amount, 0), 0) as eligible_amount,
         extract(year from (d.donated_at at time zone 'America/Toronto'))::int as tax_year, d.kind, d.platform, d.receipt_number,
         case
           when nullif(d.receipt_number, '') is not null then 'receipted'
           when d.contact_id is null then 'no'
           when d.kind in ('sponsorship', 'other') then 'no'
           when d.receipt_eligible = false and d.platform = 'keela' then 'no'
           when coalesce(d.amount, 0) <= 0 then 'no'
           when coalesce(d.advantage_amount, 0) > 0.8 * coalesce(d.amount, 0) then 'no'
           when d.kind = 'in_kind' and nullif(btrim(coalesce(d.in_kind_desc, '')), '') is null then 'no'
           when lower(coalesce(d.platform, '')) = 'zeffy' then 'platform'
           else 'due'
         end as receipt_status,
         case
           when nullif(d.receipt_number, '') is not null then 'Receipt ' || d.receipt_number || coalesce(' (' || d.receipt_source || ')', '')
           when d.contact_id is null then 'No donor on the gift'
           when d.kind = 'sponsorship' then 'A sponsorship gets an invoice or a thank-you, not a tax receipt'
           when d.kind = 'other' then 'Not a gift'
           when d.receipt_eligible = false and d.platform = 'keela' then 'Keela marked it as not receiptable'
           when coalesce(d.amount, 0) <= 0 then 'No amount'
           when coalesce(d.advantage_amount, 0) > 0.8 * coalesce(d.amount, 0) then 'What they received is worth more than 80% of the amount'
           when d.kind = 'in_kind' and nullif(btrim(coalesce(d.in_kind_desc, '')), '') is null then 'Describe the gift in kind first'
           when lower(coalesce(d.platform, '')) = 'zeffy' then 'Zeffy issues the receipt'
           else 'A receipt is due for ' || to_char(greatest(coalesce(d.amount, 0) - coalesce(d.advantage_amount, 0), 0), 'FM$999,999,990.00')
         end as receipt_note
    from public.crm_donations d;
comment on view public.crm_gift_receipts_v is 'Every gift''s receipt status (wave158): receipted (a receipt number exists, Keela''s included), due (the Hub owes one: a donation, a gift in kind described, or a registration or ticket whose advantage is at most 80 per cent), platform (Zeffy issues it), no (with the reason). eligible_amount is amount minus advantage; tax_year is the calendar year in Toronto (receipts follow the donor''s tax year, not the fiscal year).';
grant select on public.crm_gift_receipts_v to authenticated;

-- ---------- receipt settings: admins only (and mail settings too) ----------
insert into public.app_config (key, value, updated_at) values
  ('receipt_mode', 'off', now()),
  ('receipt_charity_name', 'Welfare Avenue', now()),
  ('receipt_charity_address', coalesce((select value from public.app_config where key = 'mail_postal_address'), ''), now()),
  ('receipt_location', 'Montreal, Quebec', now()),
  ('receipt_prefix', '', now()),
  ('receipt_next_number', '', now()),
  ('receipt_signatory_name', '', now()),
  ('receipt_signatory_title', '', now())
on conflict (key) do nothing;

create or replace function public.wa_app_config_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email and receipt settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;
revoke execute on function public.wa_app_config_guard() from public, anon, authenticated;
drop trigger if exists wa_app_config_guard on public.app_config;
create trigger wa_app_config_guard before insert or update or delete on public.app_config for each row execute function public.wa_app_config_guard();
comment on function public.wa_app_config_guard() is 'Trigger on app_config (wave158): the email settings (mail_*: the mode, the sender, the caps) and the receipt settings (receipt_*) change only through an admin or the service role (mail-send checks the admin itself). Other staff settings (finance_ai_guidance) are untouched.';

create or replace function public.crm_receipt_config()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select case when public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)
    then (select jsonb_object_agg(key, value) from public.app_config where key like 'receipt\_%' or key in ('mail_charity_number', 'mail_postal_address'))
    || jsonb_build_object('is_admin', coalesce(public.is_wa_admin(), false))
    else null end
$function$;
revoke execute on function public.crm_receipt_config() from public, anon;
grant execute on function public.crm_receipt_config() to authenticated;
comment on function public.crm_receipt_config() is 'The receipt settings for the Gifts tab (wave158): mode (off until the treasurer and Steel say go), the charity''s name and address as on file with the CRA, the registration number, where receipts are issued, the numbering (prefix and next number), the signatory; and whether the caller is an admin (who may change them).';

create or replace function public.crm_receipt_config_set(p jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare k text; v text; changes text[] := '{}'; me text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can change the receipt settings.'; end if;
  for k, v in select key, value from jsonb_each_text(coalesce(p, '{}'::jsonb)) loop
    if k not in ('receipt_charity_name', 'receipt_charity_address', 'receipt_location', 'receipt_prefix', 'receipt_next_number', 'receipt_signatory_name', 'receipt_signatory_title') then
      raise exception 'Unknown setting %', k;
    end if;
    if k = 'receipt_next_number' and coalesce(v, '') <> '' and v !~ '^[0-9]{1,9}$' then raise exception 'The next number is a whole number.'; end if;
    if k = 'receipt_prefix' and length(coalesce(v, '')) > 20 then raise exception 'The prefix is at most 20 characters.'; end if;
    v := btrim(coalesce(v, ''));
    if v is distinct from (select value from public.app_config where key = k) then
      insert into public.app_config (key, value, updated_at) values (k, v, now()) on conflict (key) do update set value = excluded.value, updated_at = now();
      changes := changes || (k || ': ' || v);
    end if;
  end loop;
  if cardinality(changes) > 0 then
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('receipts', 'settings', 'receipt_settings', null, left(array_to_string(changes, ' | '), 900), me);
  end if;
  return public.crm_receipt_config();
end $function$;
revoke execute on function public.crm_receipt_config_set(jsonb) from public, anon;
grant execute on function public.crm_receipt_config_set(jsonb) to authenticated;
comment on function public.crm_receipt_config_set(jsonb) is 'Saves the receipt settings (wave158), admins only, each change in change_log. receipt_mode is not among them: switching receipts on comes with wave158b (the numbering, the PDF, the signature), once the treasurer and Steel agree.';

-- ---------- a sample receipt for a gift (never numbered, never sent) ----------
create or replace function public.crm_receipt_sample(p_gift_id bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare g record; c record; r record; cfg jsonb; warn text[] := '{}'; addr text; nm text; num text;
begin
  if not (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  select * into g from public.crm_donations where id = p_gift_id;
  if not found then raise exception 'No such gift.'; end if;
  select * into r from public.crm_gift_receipts_v where gift_id = p_gift_id;
  select * into c from public.crm_contacts where id = g.contact_id;
  select jsonb_object_agg(key, value) into cfg from public.app_config where key like 'receipt\_%' or key in ('mail_charity_number', 'mail_postal_address');
  nm := btrim(concat_ws(' ', nullif(btrim(c.first_name), ''), nullif(btrim(c.last_name), '')));
  if nm = '' then nm := coalesce(nullif(btrim(c.full_name), ''), ''); end if;
  addr := nullif(btrim(concat_ws(', ', nullif(btrim(c.address), ''), nullif(btrim(concat_ws(' ', nullif(btrim(c.city), ''), nullif(btrim(c.province), ''), nullif(btrim(c.postal_code), ''))), ''))), '');
  if r.receipt_status <> 'due' then warn := warn || r.receipt_note; end if;
  if nm = '' or nm ~* '^\(no name\)$' then warn := warn || 'The donor has no name on file.'::text; end if;
  if addr is null then warn := warn || 'The donor has no address on file: a receipt needs one.'::text; end if;
  if coalesce(cfg ->> 'receipt_signatory_name', '') = '' then warn := warn || 'No signatory yet (the treasurer or another person the board authorizes).'::text; end if;
  if coalesce(cfg ->> 'receipt_prefix', '') = '' and coalesce(cfg ->> 'receipt_next_number', '') = '' then warn := warn || 'No numbering yet: the prefix and the first number are the treasurer''s call, apart from Keela''s KEE numbers.'::text; end if;
  num := coalesce(nullif(cfg ->> 'receipt_prefix', ''), 'WA-' || extract(year from now())::int || '-') || lpad(coalesce(nullif(cfg ->> 'receipt_next_number', ''), '1'), 4, '0');
  return jsonb_build_object(
    'sample', true, 'status', r.receipt_status, 'note', r.receipt_note, 'warnings', to_jsonb(warn),
    'serial', num, 'charity_name', coalesce(nullif(cfg ->> 'receipt_charity_name', ''), 'Welfare Avenue'), 'charity_address', coalesce(nullif(cfg ->> 'receipt_charity_address', ''), cfg ->> 'mail_postal_address'),
    'charity_number', cfg ->> 'mail_charity_number', 'location', coalesce(nullif(cfg ->> 'receipt_location', ''), 'Montreal, Quebec'),
    'gift_date', to_char((g.donated_at at time zone 'America/Toronto')::date, 'FMDD FMMonth YYYY'), 'issued_date', to_char((now() at time zone 'America/Toronto')::date, 'FMDD FMMonth YYYY'),
    'donor_name', nullif(nm, ''), 'donor_address', addr, 'amount', g.amount, 'advantage_amount', coalesce(g.advantage_amount, 0), 'advantage_desc', g.advantage_desc,
    'eligible_amount', r.eligible_amount, 'kind', g.kind, 'in_kind_desc', g.in_kind_desc, 'appraiser', g.appraiser,
    'signatory_name', nullif(cfg ->> 'receipt_signatory_name', ''), 'signatory_title', nullif(cfg ->> 'receipt_signatory_title', ''),
    'cra', 'Canada Revenue Agency: canada.ca/charities-giving', 'mode', coalesce(cfg ->> 'receipt_mode', 'off'));
end $function$;
revoke execute on function public.crm_receipt_sample(bigint) from public, anon;
grant execute on function public.crm_receipt_sample(bigint) to authenticated;
comment on function public.crm_receipt_sample(bigint) is 'A sample CRA receipt for one gift (wave158): every field the CRA requires (the statement, the charity''s name, address and registration number, a serial number, where and when it is issued, the date of the gift, the donor''s name and address, the amount, the advantage and its description, the eligible amount, the signatory, the CRA''s name and website), with what is missing in words. Never numbered, never stored, never sent. Staff with the CRM page.';

notify pgrst, 'reload schema';
