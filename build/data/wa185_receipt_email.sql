-- wave185 (30/09/26): receipts by email. The receipt PDF takes the brand (receipt-pdf v2), every receipt can be emailed to the
-- donor with the PDF attached (mail-send, action receipt: the thank-you and the official receipt in one email, English or
-- French), and an online gift through the donation page gets its receipt issued and emailed by itself once two switches are
-- on: receipt_mode (wave158b) and the new receipt_auto_online. Both stay off until an admin turns them on; the assistant
-- never does. Hand-recorded gifts keep their Issue button and gain Email it beside each receipt (nothing automatic).
-- Steel's choices (30/09/26): a receipt for every monthly payment; one email that thanks and carries the receipt; Email it
-- for hand gifts; the settings filled from the CRA registration letter (the switch off).

-- ---------- the switch for online gifts ----------
insert into public.app_config (key, value, updated_at) values ('receipt_auto_online', 'off', now()) on conflict (key) do nothing;

create or replace function public.crm_receipt_auto_set(p_on text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare me text := lower(coalesce(auth.jwt() ->> 'email', 'staff')); v_old text;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can change this.'; end if;
  if p_on not in ('on', 'off') then raise exception 'The setting is on or off.'; end if;
  if p_on = 'on' and coalesce((select value from public.app_config where key = 'receipt_mode'), 'off') <> 'on' then
    raise exception 'Turn receipts from the Hub on first: online gifts are receipted and emailed only while receipts are on.';
  end if;
  select value into v_old from public.app_config where key = 'receipt_auto_online';
  if v_old is distinct from p_on then
    insert into public.app_config (key, value, updated_at) values ('receipt_auto_online', p_on, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('receipts', 'settings', 'receipt_auto_online', v_old, p_on, me);
  end if;
  return public.crm_receipt_config();
end $function$;
revoke execute on function public.crm_receipt_auto_set(text) from public, anon;
grant execute on function public.crm_receipt_auto_set(text) to authenticated;
comment on function public.crm_receipt_auto_set(text) is 'Turns the automatic receipt for online gifts on or off (wave185), admins only, logged in change_log: on means every paid gift through the donation page is receipted with the next number and emailed to the donor with the PDF, the moment Stripe confirms it. On needs receipt_mode on first. The treasurer and Steel decide; the assistant never calls it.';

-- ---------- the receipt maker keeps more of the gift (how it came, the tribute) and the donor''s first name and language ----------
create or replace function public.crm_receipt_make(p_gift_ids bigint[], p_replaces bigint, p_by text)
returns bigint language plpgsql security definer set search_path = '' as $function$
declare
  v_cfg jsonb; v_contact bigint; v_year int; v_n bigint; v_serial text; v_id bigint; c record; v_name text; v_addr text; v_first text; v_lang text;
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
  v_first := nullif(btrim(coalesce(c.first_name, '')), '');
  v_addr := nullif(btrim(concat_ws(', ', nullif(btrim(c.address), ''), nullif(btrim(concat_ws(' ', nullif(btrim(c.city), ''), nullif(btrim(c.province), ''), nullif(btrim(c.postal_code), ''))), ''))), '');
  if v_name = '' or v_name ~* '^\(no name\)$' then raise exception 'The donor has no name on file.'; end if;
  if v_addr is null then raise exception 'The donor has no address on file: a receipt needs one.'; end if;
  /* the receipt speaks the donor's language: the donation page they used, else the contact's language, else English */
  select case when exists (select 1 from public.crm_donations d where d.id = any(p_gift_ids) and lower(coalesce(d.raw ->> 'lang', '')) = 'fr') then 'fr'
              when lower(coalesce(c.language, '')) like 'fr%' then 'fr' else 'en' end into v_lang;
  select sum(d.amount), sum(coalesce(d.advantage_amount, 0)), sum(r.eligible_amount),
         jsonb_agg(jsonb_build_object('id', d.id, 'date', (d.donated_at at time zone 'America/Toronto')::date, 'amount', d.amount,
           'advantage_amount', coalesce(d.advantage_amount, 0), 'advantage_desc', d.advantage_desc, 'eligible_amount', r.eligible_amount,
           'kind', d.kind, 'in_kind_desc', d.in_kind_desc, 'appraiser', d.appraiser,
           'method', d.method, 'platform', d.platform, 'recurring', coalesce(d.recurring, false),
           'tribute_kind', d.tribute_kind, 'tribute_name', d.tribute_name) order by d.donated_at, d.id)
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
          jsonb_build_object('name', v_name, 'first_name', v_first, 'address', v_addr, 'contact_id', v_contact, 'lang', v_lang),
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
comment on function public.crm_receipt_make(bigint[], bigint, text) is 'Internal (wave158b, wave185): makes one receipt for one donor''s due gifts of one tax year, with the next number from the settings (locked while it is taken), the donor (name, first name, address, language) and the charity as printed, the gifts with how they came and any tribute, and marks the gifts receipted (source hub). Called by crm_receipt_issue, crm_receipt_replace and crm_receipt_auto_issue only.';

-- ---------- what the PDF and the email read: staff with the CRM page, or the Hub''s own automation (the service role) ----------
create or replace function public.crm_receipt_doc(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
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
end $function$;
revoke execute on function public.crm_receipt_doc(bigint) from public, anon;
grant execute on function public.crm_receipt_doc(bigint) to authenticated, service_role;
comment on function public.crm_receipt_doc(bigint) is 'One receipt as it was issued, for receipt-pdf, mail-send and the Receipts view (wave158b, wave185): the serial, status, gifts, amounts, donor (with first name and language) and charity as printed, where and when, the receipt it replaces or that replaced it, the PDF paths, when it was emailed; and whether the caller is an admin. Staff with the CRM page, or the service role (the automation after an online gift).';

-- ---------- the sample carries the same extra fields ----------
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
    'donor_name', nullif(nm, ''), 'donor_first_name', nullif(btrim(coalesce(c.first_name, '')), ''), 'donor_address', addr,
    'amount', g.amount, 'advantage_amount', coalesce(g.advantage_amount, 0), 'advantage_desc', g.advantage_desc,
    'eligible_amount', r.eligible_amount, 'kind', g.kind, 'in_kind_desc', g.in_kind_desc, 'appraiser', g.appraiser,
    'method', g.method, 'platform', g.platform, 'tribute_kind', g.tribute_kind, 'tribute_name', g.tribute_name,
    'lang', case when lower(coalesce(g.raw ->> 'lang', '')) = 'fr' or lower(coalesce(c.language, '')) like 'fr%' then 'fr' else 'en' end,
    'signatory_name', nullif(cfg ->> 'receipt_signatory_name', ''), 'signatory_title', nullif(cfg ->> 'receipt_signatory_title', ''),
    'cra', 'Canada Revenue Agency: canada.ca/charities-giving', 'mode', coalesce(cfg ->> 'receipt_mode', 'off'));
end $function$;
revoke execute on function public.crm_receipt_sample(bigint) from public, anon;
grant execute on function public.crm_receipt_sample(bigint) to authenticated;
comment on function public.crm_receipt_sample(bigint) is 'A sample CRA receipt for one gift (wave158, wave185): every field the CRA requires (the statement, the charity''s name, address and registration number, a serial number, where and when it is issued, the date of the gift, the donor''s name and address, the amount, the advantage and its description, the eligible amount, the signatory, the CRA''s name and website), how the gift came, any tribute, the donor''s language, with what is missing in words. Never numbered, never stored, never sent. Staff with the CRM page.';

-- ---------- an online gift gets its receipt by itself (service role: stripe-events, after crm_stripe_apply) ----------
create or replace function public.crm_receipt_auto_issue(p_gift_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare g record; r record; v_id bigint; v_serial text; v_why text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'The Hub''s automation only.'; end if;
  if coalesce((select value from public.app_config where key = 'receipt_mode'), 'off') <> 'on' then return jsonb_build_object('skipped', 'receipts from the Hub are off'); end if;
  if coalesce((select value from public.app_config where key = 'receipt_auto_online'), 'off') <> 'on' then return jsonb_build_object('skipped', 'automatic receipts for online gifts are off'); end if;
  select * into g from public.crm_donations where id = p_gift_id;
  if not found then return jsonb_build_object('skipped', 'no such gift'); end if;
  if g.platform <> 'stripe' then return jsonb_build_object('skipped', 'not an online gift'); end if;
  if nullif(g.receipt_number, '') is not null then return jsonb_build_object('skipped', 'already receipted', 'serial', g.receipt_number); end if;
  select * into r from public.crm_gift_receipts_v where gift_id = p_gift_id;
  if r.receipt_status <> 'due' then return jsonb_build_object('skipped', coalesce(r.receipt_note, 'no receipt is due')); end if;
  begin
    v_id := public.crm_receipt_make(array[p_gift_id], null, 'donation page');
  exception when others then
    v_why := sqlerrm;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_receipt', 'gift ' || p_gift_id, 'auto_skipped', null, left(v_why, 500), 'donation page');
    return jsonb_build_object('skipped', v_why);
  end;
  select serial into v_serial from public.crm_receipts where id = v_id;
  return jsonb_build_object('receipt_id', v_id, 'serial', v_serial);
end $function$;
revoke execute on function public.crm_receipt_auto_issue(bigint) from public, anon, authenticated;
grant execute on function public.crm_receipt_auto_issue(bigint) to service_role;
comment on function public.crm_receipt_auto_issue(bigint) is 'Issues the receipt for one paid online gift by itself (wave185), service role only: stripe-events calls it right after crm_stripe_apply records the gift. Only while receipt_mode and receipt_auto_online are both on, only for a gift from the donation page that is due a receipt; what crm_receipt_make refuses (no address, a used number) is returned as skipped and noted in change_log, and the gift stays due for an admin to issue by hand. Returns the receipt id and serial, or why it was skipped.';

-- ---------- the email: what mail-send reads, and the mark it leaves ----------
create or replace function public.crm_receipt_email_doc(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare r record; c record; v_date text; v_lang text; g jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'The Hub''s automation only.'; end if;
  select * into r from public.crm_receipts where id = p_id;
  if not found then raise exception 'No such receipt.'; end if;
  select id, first_name, full_name, emails, primary_email, email_status, merged_into into c from public.crm_contacts where id = r.contact_id;
  v_lang := case when r.donor ->> 'lang' = 'fr' then 'fr' else 'en' end;
  g := coalesce(r.gifts -> 0, '{}'::jsonb);
  v_date := to_char(coalesce(nullif(g ->> 'date', '')::date, (r.issued_at at time zone 'America/Toronto')::date), 'FMDD FMMonth YYYY');
  return jsonb_build_object('id', r.id, 'serial', r.serial, 'status', r.status, 'kind', r.kind, 'tax_year', r.tax_year, 'gift_count', jsonb_array_length(coalesce(r.gifts, '[]'::jsonb)),
    'amount', r.amount, 'eligible_amount', r.eligible_amount, 'advantage_amount', r.advantage_amount, 'gift_date', v_date, 'gift_date_iso', g ->> 'date',
    'recurring', coalesce((g ->> 'recurring')::boolean, false), 'platform', g ->> 'platform', 'tribute_kind', g ->> 'tribute_kind', 'tribute_name', g ->> 'tribute_name',
    'donor', r.donor, 'lang', v_lang, 'contact_id', r.contact_id, 'first_name', coalesce(nullif(btrim(coalesce(c.first_name, '')), ''), r.donor ->> 'first_name'),
    'email', coalesce(c.primary_email, c.emails[1]), 'pdf_path', r.pdf_path, 'emailed_at', r.emailed_at, 'email_send_id', r.email_send_id, 'issued_at', r.issued_at);
end $function$;
revoke execute on function public.crm_receipt_email_doc(bigint) from public, anon, authenticated;
grant execute on function public.crm_receipt_email_doc(bigint) to service_role;
comment on function public.crm_receipt_email_doc(bigint) is 'What the receipt email needs (wave185), service role only (mail-send): the receipt (serial, status, amounts, the gift''s date, whether it is a monthly payment, any tribute), the donor as printed and their language, the contact and the address the email goes to, the PDF path, and whether it was emailed already.';

create or replace function public.crm_receipt_emailed(p_id bigint, p_send_id bigint)
returns void language sql security definer set search_path = '' as $function$
  update public.crm_receipts set emailed_at = now(), email_send_id = p_send_id where id = p_id
$function$;
revoke execute on function public.crm_receipt_emailed(bigint, bigint) from public, anon, authenticated;
grant execute on function public.crm_receipt_emailed(bigint, bigint) to service_role;
comment on function public.crm_receipt_emailed(bigint, bigint) is 'Marks a receipt as emailed to the donor (wave185) with the crm_email_sends row that carried it. Service role only (mail-send, after Resend accepted the email; never for a test copy).';

comment on column public.crm_receipts.emailed_at is 'When the receipt was emailed to the donor with its PDF (wave185); email_send_id is the crm_email_sends row. Empty until then; a test copy to a test address leaves it empty.';

-- ---------- the two emails: the thank-you with the receipt attached, in English and in French ----------
insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, sort, updated_by) values
('receipt', 'A gift and its official receipt', 'transactional', '{{thanks_to}}: your official donation receipt from Welfare Avenue', 'Your receipt {{serial}} is attached as a PDF. Thank you for building pathways with us.',
$html$<h1>{{thanks_to}}</h1>
<p>{{greeting}}</p>
<p>Your gift of <strong>{{amount}}</strong>{{gift_date_line}} is already at work. It puts meals on the table this Sunday, and it keeps our youth-powered teams on the street, building the trust that connects people with housing, health and the services they are owed.</p>
<p>Your official donation receipt for income tax purposes, number <strong>{{serial}}</strong>, is attached to this email as a PDF. Keep it for your tax return.{{monthly_note}}</p>
{{extra_html}}<p>Questions about your gift or your receipt? Reply to this email and a member of our team will help.</p>
<p>With gratitude,<br>The Welfare Avenue team</p>$html$,
$text${{greeting}}

Your gift of {{amount}}{{gift_date_line}} is already at work. It puts meals on the table this Sunday, and it keeps our youth-powered teams on the street, building the trust that connects people with housing, health and the services they are owed.

Your official donation receipt for income tax purposes, number {{serial}}, is attached to this email as a PDF. Keep it for your tax return.{{monthly_note}}

{{extra_text}}Questions about your gift or your receipt? Reply to this email and a member of our team will help.

With gratitude,
The Welfare Avenue team$text$,
'["thanks_to","greeting","amount","gift_date_line","serial","monthly_note","extra_html","extra_text"]'::jsonb, 25, 'wave185'),

('receipt_fr', 'Un don et son reçu officiel', 'transactional', '{{thanks_to}} : votre reçu officiel de don de Welfare Avenue', 'Votre reçu {{serial}} est joint en PDF. Merci de bâtir des passerelles avec nous.',
$html$<h1>{{thanks_to}}</h1>
<p>{{greeting}}</p>
<p>Votre don de <strong>{{amount}}</strong>{{gift_date_line}} est déjà à l'œuvre. Il met des repas sur la table dès dimanche et garde nos équipes, portées par la jeunesse, sur le terrain, où se bâtit la confiance qui relie les gens au logement, à la santé et aux services qui leur reviennent.</p>
<p>Votre reçu officiel de don aux fins de l'impôt sur le revenu, numéro <strong>{{serial}}</strong>, est joint à ce courriel en PDF. Conservez-le pour votre déclaration de revenus.{{monthly_note}}</p>
{{extra_html}}<p>Une question sur votre don ou votre reçu? Répondez à ce courriel et un membre de notre équipe vous aidera.</p>
<p>Avec gratitude,<br>L'équipe de Welfare Avenue</p>$html$,
$text${{greeting}}

Votre don de {{amount}}{{gift_date_line}} est déjà à l'œuvre. Il met des repas sur la table dès dimanche et garde nos équipes, portées par la jeunesse, sur le terrain, où se bâtit la confiance qui relie les gens au logement, à la santé et aux services qui leur reviennent.

Votre reçu officiel de don aux fins de l'impôt sur le revenu, numéro {{serial}}, est joint à ce courriel en PDF. Conservez-le pour votre déclaration de revenus.{{monthly_note}}

{{extra_text}}Une question sur votre don ou votre reçu? Répondez à ce courriel et un membre de notre équipe vous aidera.

Avec gratitude,
L'équipe de Welfare Avenue$text$,
'["thanks_to","greeting","amount","gift_date_line","serial","monthly_note","extra_html","extra_text"]'::jsonb, 26, 'wave185')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
