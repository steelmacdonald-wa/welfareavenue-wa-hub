-- wave194 (02/10/26): website accounts on welfareavenue.com.
-- Steel (02/10/26): "I want users to have the ability to sign up through google to capture important informaton when they
-- sign up for forms (auto-fill). they should have their own profile too - I hope to have as many of our old account from
-- the old website brought over to the new site so that they don't loose their accounts". His choices: Google or an emailed
-- code (no passwords); the profile shows their details, their volunteering, their gifts and receipts and their email
-- preferences; old-site records connect when they sign in with the same email (nobody is emailed); what a signed-in person
-- types on a form is saved to their profile.
--
-- Safety: a website account is never on the team. wa175_access_token_hook gives every non-team sign-in the role anon and
-- the claim wa_volunteer, so the only things it can do are the functions granted to anon below, which read the verified
-- sign-in (auth.uid()) and touch that person's own record only. A record is connected only by a verified email (Google's,
-- or the code we emailed), never by an address someone typed.

-- 1. columns -------------------------------------------------------------------------------------------------------------
alter table public.crm_contacts add column if not exists pronouns text;
comment on column public.crm_contacts.pronouns is 'wave194: the pronouns the person gave on their welfareavenue.com profile (optional, up to 40 characters). Written by account_update(); read with the contact.';

alter table public.crm_form_submissions add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
comment on column public.crm_form_submissions.auth_user_id is 'wave194: the website account that sent this submission (form-submit checked the person''s sign-in). crm_form_apply() then uses that account''s contact and saves what they typed to it. Null for anonymous submissions.';
create index if not exists crm_form_submissions_auth_user on public.crm_form_submissions (auth_user_id) where auth_user_id is not null;

-- 2. the sign-in code emails (rate limits and the record) ------------------------------------------------------------------
create table if not exists public.site_account_emails (
  id bigint generated always as identity primary key,
  email text not null,
  ip_hash text,
  lang text not null default 'en' check (lang in ('en', 'fr')),
  status text not null check (status in ('sent', 'test', 'refused', 'failed')),
  reason text,
  resend_id text,
  created_at timestamptz not null default now()
);
comment on table public.site_account_emails is 'wave194: every sign-in code the website was asked to email (site-account function, service role only): sent; test (sent while accounts are in test mode, to a test recipient or a Welfare Avenue address); refused (accounts off, a rate limit, not a test recipient) or failed (Resend). The rate limits read it: per address, per IP hash, per day. Not readable through the API; admins see counts through site_account_stats().';
create index if not exists site_account_emails_email on public.site_account_emails (email, created_at desc);
create index if not exists site_account_emails_ip on public.site_account_emails (ip_hash, created_at desc);
alter table public.site_account_emails enable row level security;
revoke all on public.site_account_emails from anon, authenticated;

-- 3. the switch and the public Google client (admins only, like the mail_ settings) -------------------------------------
insert into public.app_config (key, value) values ('site_accounts_mode', 'off'), ('site_google_client_id', '') on conflict (key) do nothing;

create or replace function public.wa_app_config_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare k text := coalesce(new.key, old.key);
begin
  -- wave194: site_ (website accounts) and signoff_ (volunteer sign-offs) join the admin-only settings
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%' or k like 'site\_%' or k like 'signoff\_%')
     and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull, text, website account and sign-off settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

-- 4. what the website needs to know before anyone signs in ---------------------------------------------------------------
create or replace function public.site_account_config()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'mode', coalesce(nullif((select value from public.app_config where key = 'site_accounts_mode'), ''), 'off'),
    'google_client_id', coalesce((select value from public.app_config where key = 'site_google_client_id'), ''),
    'receipts', coalesce((select value from public.app_config where key = 'receipt_mode'), 'off') = 'on');
$function$;
comment on function public.site_account_config() is 'wave194: the website''s account settings for anyone (no sign-in): the mode (off, test or on), the public Google client ID for Google''s sign-in button, and whether official receipts are on.';
revoke execute on function public.site_account_config() from public;
grant execute on function public.site_account_config() to anon, authenticated, service_role;

-- 5. connecting a sign-in to its record (internal) -----------------------------------------------------------------------
create or replace function public.account_link_user(p_uid uuid, p_lang text default null)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  u record; v_cid bigint; v_mid bigint; v_to bigint; v_hops int := 0; v_email text; v_via text;
  v_first text; v_last text; v_full text; v_new boolean := false;
begin
  if p_uid is null then return null; end if;
  select x.id, lower(btrim(x.email)) as email, x.email_confirmed_at, coalesce(x.raw_user_meta_data, '{}'::jsonb) as meta,
         exists (select 1 from auth.identities i where i.user_id = x.id and i.provider = 'google') as google
    into u from auth.users x where x.id = p_uid and x.deleted_at is null;
  if not found then return null; end if;

  -- already connected: follow a merge to the record it went into
  select c.id, c.merged_into into v_cid, v_mid from public.crm_contacts c where c.auth_user_id = p_uid;
  if v_cid is not null then
    if v_mid is null then
      insert into public.volunteer_accounts (user_id, person_id, email, linked_via)
      select p_uid, c.volunteer_id, u.email, 'email' from public.crm_contacts c where c.id = v_cid and c.volunteer_id is not null
      on conflict (user_id) do nothing;
      return v_cid;
    end if;
    v_to := v_mid;
    while v_hops < 10 loop
      select c.merged_into into v_mid from public.crm_contacts c where c.id = v_to;
      exit when v_mid is null;
      v_to := v_mid; v_hops := v_hops + 1;
    end loop;
    update public.crm_contacts set auth_user_id = null where id = v_cid;
    update public.crm_contacts set auth_user_id = p_uid, updated_by = 'website account' where id = v_to and auth_user_id is null;
    if not found then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('crm_contacts', v_to::text, 'website_account', v_cid::text, 'Website account left unconnected: the record it was merged into already has another account', 'website (account)');
      return null;
    end if;
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_contacts', v_to::text, 'website_account', v_cid::text, 'Website account moved to the record its contact was merged into', 'website (account)');
    return v_to;
  end if;

  -- a new connection needs a verified email: Google's, or the code we emailed (email_confirmed_at)
  v_email := u.email;
  if coalesce(v_email, '') = '' or u.email_confirmed_at is null then return null; end if;

  -- the volunteer record a text link already tied to this sign-in (wave175)
  select c.id into v_cid from public.volunteer_accounts a join public.crm_contacts c on c.volunteer_id = a.person_id and c.merged_into is null
   where a.user_id = p_uid and c.auth_user_id is null order by a.linked_at limit 1;
  v_via := 'link';
  if v_cid is null then
    -- the records with this email: old website accounts, volunteers, donors, the newsletter (a volunteer record first)
    select c.id into v_cid from public.crm_contacts c
     where c.merged_into is null and c.auth_user_id is null
       and (lower(btrim(coalesce(c.primary_email, ''))) = v_email or exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_email))
     order by (c.volunteer_id is not null) desc, (lower(btrim(coalesce(c.primary_email, ''))) = v_email) desc, c.last_activity_at desc nulls last, c.id
     limit 1;
    v_via := 'email';
  end if;

  if v_cid is null then
    -- someone new: the profile starts from what the sign-in tells us
    v_first := nullif(btrim(coalesce(u.meta->>'given_name', '')), '');
    v_last := nullif(btrim(coalesce(u.meta->>'family_name', '')), '');
    v_full := nullif(btrim(coalesce(u.meta->>'full_name', u.meta->>'name', '')), '');
    if v_full is null then v_full := nullif(btrim(concat_ws(' ', v_first, v_last)), ''); end if;
    if v_first is null and v_full is not null then
      v_first := split_part(v_full, ' ', 1);
      v_last := nullif(btrim(substr(v_full, length(v_first) + 1)), '');
    end if;
    insert into public.crm_contacts (full_name, first_name, last_name, emails, language, kinds, tags, source, created_by, updated_by, auth_user_id)
    values (coalesce(v_full, v_email), left(v_first, 80), left(v_last, 80), array[v_email], case when p_lang in ('en', 'fr') then p_lang end,
            array['supporter'], array['website account'], 'website_account', 'website account', 'website account', p_uid)
    returning id into v_cid;
    v_via := 'new'; v_new := true;
  else
    update public.crm_contacts set auth_user_id = p_uid, updated_by = 'website account' where id = v_cid and auth_user_id is null;
    if not found then return null; end if;
  end if;

  insert into public.volunteer_accounts (user_id, person_id, email, linked_via)
  select p_uid, c.volunteer_id, v_email, 'email' from public.crm_contacts c where c.id = v_cid and c.volunteer_id is not null
  on conflict (user_id) do nothing;

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_contacts', v_cid::text, 'website_account', null,
          case v_via when 'new' then 'Website account created' when 'link' then 'Website account connected through their volunteer text link'
               else 'Website account connected by its verified email' end || case when u.google then ' (Google)' else ' (emailed code)' end,
          'website (account)');
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (v_cid, 'account', 'in', 'web', case when v_new then 'Created a website account' else 'Signed in to welfareavenue.com for the first time' end,
          case when u.google then 'Signed in with Google.' else 'Signed in with a code sent to their email.' end, now(), 'website', 'account:' || p_uid::text,
          jsonb_build_object('via', v_via, 'google', u.google), 'website account')
  on conflict do nothing;
  return v_cid;
end $function$;
comment on function public.account_link_user(uuid, text) is 'wave194 (internal): the contact a website sign-in belongs to. Already connected: that contact (following a merge). Otherwise, only with a verified email: the volunteer record its text link tied (wave175), else the contact with that email (a volunteer record first), else a new contact (source website_account). Also ties volunteer_accounts for the volunteer pages. Logs to change_log and the timeline. Not callable from the API.';
revoke execute on function public.account_link_user(uuid, text) from public, anon, authenticated;

-- 6. the profile -----------------------------------------------------------------------------------------------------------
create or replace function public.account_me(p_lang text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid; v_cid bigint; c record; u record; v_gifts jsonb; v_receipts jsonb; v_totals jsonb;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('signed_in', false); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('signed_in', true, 'hook', false); end if;
  select lower(x.email) as email, x.email_confirmed_at, x.created_at,
         exists (select 1 from auth.identities i where i.user_id = x.id and i.provider = 'google') as google
    into u from auth.users x where x.id = v_uid;
  v_cid := public.account_link_user(v_uid, p_lang);
  if v_cid is null then
    return jsonb_build_object('signed_in', true, 'hook', true, 'linked', false, 'email', u.email, 'google', u.google,
                              'reason', case when u.email_confirmed_at is null then 'unverified' else 'taken' end);
  end if;
  select * into c from public.crm_contacts where id = v_cid;
  select coalesce(jsonb_agg(g order by g->>'date' desc, (g->>'id')::bigint desc), '[]'::jsonb) into v_gifts from (
    select jsonb_build_object('id', d.id, 'date', (d.donated_at at time zone 'America/Toronto')::date, 'amount', d.amount, 'currency', coalesce(d.currency, 'CAD'),
             'campaign', coalesce(nullif(d.campaign, ''), nullif(d.designation, '')), 'recurring', coalesce(d.recurring, false), 'kind', d.kind,
             'refunded', coalesce(d.refunded_amount, 0) > 0,
             'receipt', (select jsonb_build_object('id', r.id, 'serial', r.serial, 'issued', (r.issued_at at time zone 'America/Toronto')::date, 'pdf', r.pdf_path is not null)
                           from public.crm_receipts r where d.id = any (r.gift_ids) and r.status = 'issued' order by r.issued_at desc limit 1),
             'receipt_number', case when not exists (select 1 from public.crm_receipts r where d.id = any (r.gift_ids)) then nullif(d.receipt_number, '') end) as g
      from public.crm_donations d where d.contact_id = v_cid order by d.donated_at desc limit 200) s;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'serial', r.serial, 'year', r.tax_year, 'kind', r.kind, 'eligible', r.eligible_amount,
           'issued', (r.issued_at at time zone 'America/Toronto')::date, 'pdf', r.pdf_path is not null) order by r.issued_at desc), '[]'::jsonb)
    into v_receipts from public.crm_receipts r where r.contact_id = v_cid and r.status = 'issued';
  select jsonb_build_object('count', count(*), 'total', coalesce(sum(d.amount - coalesce(d.refunded_amount, 0)), 0), 'since', min((d.donated_at at time zone 'America/Toronto')::date))
    into v_totals from public.crm_donations d where d.contact_id = v_cid;
  return jsonb_build_object('signed_in', true, 'hook', true, 'linked', true, 'email', u.email, 'google', u.google,
    'since', (u.created_at at time zone 'America/Toronto')::date,
    'contact', jsonb_build_object('first_name', c.first_name, 'last_name', c.last_name, 'full_name', c.full_name, 'pronouns', c.pronouns,
       'emails', to_jsonb(coalesce(c.emails, '{}'::text[])), 'phone', (coalesce(c.phones, '{}'::text[]))[1], 'address', c.address, 'city', c.city,
       'province', c.province, 'postal_code', c.postal_code, 'country', c.country, 'language', c.language),
    'newsletter', jsonb_build_object('status', coalesce(c.email_status, 'unknown'), 'consent', coalesce(c.email_consent, 'none'),
       'on', coalesce(c.email_status, '') = 'subscribed' or (coalesce(c.email_consent, '') = 'express' and coalesce(c.email_status, '') not in ('unsubscribed', 'bounced', 'complained')),
       'blocked', coalesce(c.email_status, '') in ('bounced', 'complained'), 'since', c.consent_at),
    'volunteer', c.volunteer_id is not null,
    'gifts', v_gifts, 'gift_totals', v_totals, 'receipts', v_receipts,
    'receipt_mode', coalesce((select value from public.app_config where key = 'receipt_mode'), 'off'));
end $function$;
comment on function public.account_me(text) is 'wave194: the signed-in person''s profile on welfareavenue.com: their details, newsletter preference, whether they have a volunteer record (volunteer_me has the rest), their gifts with receipts and their official receipts. Connects the sign-in to its record the first time (account_link_user). Reads only the signed-in person''s own record.';
revoke execute on function public.account_me(text) from public;
grant execute on function public.account_me(text) to anon, authenticated;

-- 7. what forms fill in (light) --------------------------------------------------------------------------------------------
create or replace function public.account_prefill(p_lang text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid; v_cid bigint; c record; v_email text;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('signed_in', false); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('signed_in', true, 'hook', false); end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  v_cid := public.account_link_user(v_uid, p_lang);
  if v_cid is null then return jsonb_build_object('signed_in', true, 'hook', true, 'linked', false, 'email', v_email); end if;
  select * into c from public.crm_contacts where id = v_cid;
  return jsonb_build_object('signed_in', true, 'hook', true, 'linked', true,
    'fill', jsonb_strip_nulls(jsonb_build_object('email', v_email, 'first_name', c.first_name, 'last_name', c.last_name,
      'phone', (coalesce(c.phones, '{}'::text[]))[1], 'address', c.address, 'city', c.city, 'province', c.province, 'postal_code', c.postal_code,
      'country', c.country, 'language', c.language, 'pronouns', c.pronouns)),
    'name', coalesce(nullif(c.first_name, ''), split_part(coalesce(c.full_name, ''), ' ', 1)));
end $function$;
comment on function public.account_prefill(text) is 'wave194: what the website''s forms fill in for the signed-in person (their own record only). Connects the sign-in the first time, like account_me.';
revoke execute on function public.account_prefill(text) from public;
grant execute on function public.account_prefill(text) to anon, authenticated;

-- 8. changing their details ------------------------------------------------------------------------------------------------
create or replace function public.account_update(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid; v_cid bigint; c record; errs jsonb := '{}'::jsonb; changed text[] := '{}';
  v_first text; v_last text; v_pron text; v_phone text; v_addr text; v_city text; v_prov text; v_post text; v_country text; v_lang text;
  v_phones text[]; v_labels jsonb := '{"first_name":"first name","last_name":"last name","pronouns":"pronouns","phone":"phone","address":"address","city":"city","province":"province","postal_code":"postal code","country":"country","language":"language"}';
  k text;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  v_cid := public.account_link_user(v_uid, null);
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  select * into c from public.crm_contacts where id = v_cid for update;

  v_first := case when p ? 'first_name' then nullif(btrim(coalesce(p->>'first_name', '')), '') else c.first_name end;
  v_last := case when p ? 'last_name' then nullif(btrim(coalesce(p->>'last_name', '')), '') else c.last_name end;
  v_pron := case when p ? 'pronouns' then nullif(btrim(coalesce(p->>'pronouns', '')), '') else c.pronouns end;
  v_addr := case when p ? 'address' then nullif(btrim(coalesce(p->>'address', '')), '') else c.address end;
  v_city := case when p ? 'city' then nullif(btrim(coalesce(p->>'city', '')), '') else c.city end;
  v_prov := case when p ? 'province' then nullif(btrim(coalesce(p->>'province', '')), '') else c.province end;
  v_post := case when p ? 'postal_code' then nullif(upper(btrim(coalesce(p->>'postal_code', ''))), '') else c.postal_code end;
  v_country := case when p ? 'country' then nullif(btrim(coalesce(p->>'country', '')), '') else c.country end;
  v_lang := case when p ? 'language' then nullif(lower(btrim(coalesce(p->>'language', ''))), '') else c.language end;
  v_phone := case when p ? 'phone' then nullif(btrim(coalesce(p->>'phone', '')), '') else (coalesce(c.phones, '{}'::text[]))[1] end;

  if v_first is null and v_last is null and (p ? 'first_name' or p ? 'last_name') then errs := errs || '{"first_name":"required"}'; end if;
  if length(coalesce(v_first, '')) > 80 then errs := errs || '{"first_name":"long"}'; end if;
  if length(coalesce(v_last, '')) > 80 then errs := errs || '{"last_name":"long"}'; end if;
  if length(coalesce(v_pron, '')) > 40 then errs := errs || '{"pronouns":"long"}'; end if;
  if length(coalesce(v_addr, '')) > 200 then errs := errs || '{"address":"long"}'; end if;
  if length(coalesce(v_city, '')) > 80 then errs := errs || '{"city":"long"}'; end if;
  if length(coalesce(v_prov, '')) > 40 then errs := errs || '{"province":"long"}'; end if;
  if length(coalesce(v_country, '')) > 60 then errs := errs || '{"country":"long"}'; end if;
  if v_phone is not null and (length(v_phone) > 40 or v_phone !~ '^[0-9+().[:space:]-]+$' or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7) then errs := errs || '{"phone":"phone"}'; end if;
  if v_post is not null then
    if v_post ~ '^[A-Z][0-9][A-Z][ -]?[0-9][A-Z][0-9]$' then v_post := substr(replace(replace(v_post, ' ', ''), '-', ''), 1, 3) || ' ' || substr(replace(replace(v_post, ' ', ''), '-', ''), 4, 3);
    elsif length(v_post) > 12 then errs := errs || '{"postal_code":"long"}'; end if;
  end if;
  if v_lang is not null and v_lang not in ('en', 'fr') then errs := errs || '{"language":"choice"}'; end if;
  if errs <> '{}'::jsonb then return jsonb_build_object('ok', false, 'reason', 'invalid', 'errors', errs); end if;

  if v_first is distinct from c.first_name then changed := array_append(changed, 'first_name'); end if;
  if v_last is distinct from c.last_name then changed := array_append(changed, 'last_name'); end if;
  if v_pron is distinct from c.pronouns then changed := array_append(changed, 'pronouns'); end if;
  if v_phone is distinct from (coalesce(c.phones, '{}'::text[]))[1] then changed := array_append(changed, 'phone'); end if;
  if v_addr is distinct from c.address then changed := array_append(changed, 'address'); end if;
  if v_city is distinct from c.city then changed := array_append(changed, 'city'); end if;
  if v_prov is distinct from c.province then changed := array_append(changed, 'province'); end if;
  if v_post is distinct from c.postal_code then changed := array_append(changed, 'postal_code'); end if;
  if v_country is distinct from c.country then changed := array_append(changed, 'country'); end if;
  if v_lang is distinct from c.language then changed := array_append(changed, 'language'); end if;
  if cardinality(changed) = 0 then return jsonb_build_object('ok', true, 'changed', '[]'::jsonb); end if;

  v_phones := coalesce(c.phones, '{}'::text[]);
  if 'phone' = any (changed) then
    v_phones := case when v_phone is null then v_phones[2:] else array[v_phone] || array_remove(v_phones[2:], v_phone) end;
  end if;
  update public.crm_contacts set first_name = v_first, last_name = v_last,
         full_name = case when ('first_name' = any (changed) or 'last_name' = any (changed)) and coalesce(v_first, v_last) is not null
                          then btrim(concat_ws(' ', v_first, v_last)) else full_name end,
         pronouns = v_pron, phones = v_phones, address = v_addr, city = v_city, province = v_prov, postal_code = v_post, country = v_country,
         language = v_lang, updated_by = 'website account'
   where id = v_cid;
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, meta, created_by)
  values (v_cid, 'account', 'in', 'web', 'Updated their details on welfareavenue.com',
          'Changed: ' || (select string_agg(v_labels->>x, ', ') from unnest(changed) x), now(), 'website', jsonb_build_object('fields', to_jsonb(changed)), 'website account');
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_contacts', v_cid::text, 'details', null, 'Changed on their website profile: ' || array_to_string(changed, ', '), 'website (account)');
  return jsonb_build_object('ok', true, 'changed', to_jsonb(changed));
end $function$;
comment on function public.account_update(jsonb) is 'wave194: the signed-in person changes their own details on welfareavenue.com (first and last name, pronouns, phone, address, city, province, postal code, country, language). Checks each value; logs the fields changed (not the values) on the timeline and in change_log.';
revoke execute on function public.account_update(jsonb) from public;
grant execute on function public.account_update(jsonb) to anon, authenticated;

-- 9. the newsletter, their own choice ---------------------------------------------------------------------------------------
create or replace function public.account_newsletter(p_on boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid; v_cid bigint; c record; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  v_uid := public.wa175_me_uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not public.wa175_hook_on() then return jsonb_build_object('ok', false, 'reason', 'hook'); end if;
  if p_on is null then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  v_cid := public.account_link_user(v_uid, null);
  if v_cid is null then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  select * into c from public.crm_contacts where id = v_cid for update;
  if p_on then
    if coalesce(c.email_status, '') in ('bounced', 'complained') then return jsonb_build_object('ok', false, 'reason', 'blocked'); end if;
    update public.crm_contacts set email_consent = 'express', consent_source = 'Website profile (' || to_char(v_today, 'DD Mon YYYY') || ')', consent_at = now(),
           email_status = 'subscribed', updated_by = 'website account' where id = v_cid;
  else
    update public.crm_contacts set email_status = 'unsubscribed', updated_by = 'website account' where id = v_cid;
  end if;
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, meta, created_by)
  values (v_cid, 'consent', 'in', 'web', case when p_on then 'Subscribed to the newsletter on their profile' else 'Unsubscribed from the newsletter on their profile' end,
          case when p_on then 'Express consent, given on their signed-in profile at welfareavenue.com.' else 'Turned the newsletter off on their signed-in profile.' end,
          now(), 'website', jsonb_build_object('newsletter', p_on), 'website account');
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_contacts', v_cid::text, 'email_status', c.email_status, case when p_on then 'subscribed (website profile)' else 'unsubscribed (website profile)' end, 'website (account)');
  return jsonb_build_object('ok', true, 'on', p_on);
end $function$;
comment on function public.account_newsletter(boolean) is 'wave194: the signed-in person turns the newsletter on (express consent, recorded with the day; refused for a bounced or complained address) or off (unsubscribed), on their own record.';
revoke execute on function public.account_newsletter(boolean) from public;
grant execute on function public.account_newsletter(boolean) to anon, authenticated;

-- 10. for the team: how many accounts (admins) ----------------------------------------------------------------------------
create or replace function public.site_account_stats()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.is_wa_staff() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'mode', coalesce(nullif((select value from public.app_config where key = 'site_accounts_mode'), ''), 'off'),
    'accounts', (select count(*) from public.crm_contacts where auth_user_id is not null and merged_into is null),
    'old_site', (select count(*) from public.crm_contacts where auth_user_id is not null and merged_into is null and legacy_refs ? 'django'),
    'old_site_total', (select count(*) from public.crm_contacts where merged_into is null and legacy_refs ? 'django'),
    'new', (select count(*) from public.crm_contacts where auth_user_id is not null and merged_into is null and source = 'website_account'),
    'codes_today', (select count(*) from public.site_account_emails where status in ('sent', 'test') and created_at >= date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto'),
    'codes_refused_today', (select count(*) from public.site_account_emails where status = 'refused' and created_at >= date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto'));
end $function$;
comment on function public.site_account_stats() is 'wave194: staff: the website accounts at a glance (mode, accounts, old-site records connected, new people, sign-in codes today).';
revoke execute on function public.site_account_stats() from public, anon;
grant execute on function public.site_account_stats() to authenticated;

-- 11. forms: a signed-in person's submission fills in their own record and saves what they typed --------------------------
-- (crm_form_apply is patched in place, guarded by the md5 of the definition this migration was written against)
create or replace function pg_temp.wa_once(src text, a text, b text) returns text language plpgsql as $f$
begin
  if position(a in src) = 0 then raise exception 'crm_form_apply patch: text not found: %', left(a, 80); end if;
  if position(a in substr(src, position(a in src) + 1)) > 0 then raise exception 'crm_form_apply patch: text found twice: %', left(a, 80); end if;
  return replace(src, a, b);
end $f$;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure);
  if md5(d) <> '6527915a51238f0281173d11a946519a' then raise exception 'crm_form_apply changed since wave194 was written (md5 %)', md5(d); end if;
  d := pg_temp.wa_once(d, $s$  fk text; fid bigint; ev record; rid bigint;
begin
$s$, $s$  fk text; fid bigint; ev record; rid bigint;
  v_uid uuid; v_acid bigint; v_own boolean := false;   -- wave194: a signed-in website account
begin
$s$);
  d := pg_temp.wa_once(d, $s$  -- 1. the contact with this email (never a merged one)
  select c.id into v_cid from public.crm_contacts c
$s$, $s$  -- 1. wave194: a signed-in website account fills in its own record (form-submit checked the sign-in);
  --    otherwise the contact with this email (never a merged one)
  v_uid := s.auth_user_id;
  if v_uid is not null then v_acid := public.account_link_user(v_uid, s.lang); end if;
  if v_acid is not null then
    v_cid := v_acid; v_own := true;
  else
  select c.id into v_cid from public.crm_contacts c
$s$);
  d := pg_temp.wa_once(d, $s$   order by (lower(btrim(c.primary_email)) = v_em) desc, c.id
   limit 1;
$s$, $s$   order by (lower(btrim(c.primary_email)) = v_em) desc, c.id
   limit 1;
  end if;
$s$);
  -- 4. their own record: what they typed replaces what was there (never blanks it); anyone else's: only the gaps
  d := pg_temp.wa_once(d, $s$      first_name = coalesce(nullif(c.first_name, ''), v_fn),
$s$, $s$      first_name = case when v_own then coalesce(v_fn, c.first_name) else coalesce(nullif(c.first_name, ''), v_fn) end,
$s$);
  d := pg_temp.wa_once(d, $s$      last_name = coalesce(nullif(c.last_name, ''), v_ln),
$s$, $s$      last_name = case when v_own then coalesce(v_ln, c.last_name) else coalesce(nullif(c.last_name, ''), v_ln) end,
$s$);
  d := pg_temp.wa_once(d, $s$      full_name = case when coalesce(c.full_name, '') in ('', '(no name)') or lower(c.full_name) = v_em then coalesce(v_full, c.full_name) else c.full_name end,
$s$, $s$      full_name = case when v_own and (v_fn is not null or v_ln is not null) then btrim(concat_ws(' ', coalesce(v_fn, c.first_name), coalesce(v_ln, c.last_name)))
                       when coalesce(c.full_name, '') in ('', '(no name)') or lower(c.full_name) = v_em then coalesce(v_full, c.full_name) else c.full_name end,
$s$);
  d := pg_temp.wa_once(d, $s$      phones = case when v_ph is not null and cardinality(coalesce(c.phones, '{}')) = 0 then array[v_ph] else c.phones end,
$s$, $s$      phones = case when v_own and v_ph is not null then array[v_ph] || array_remove(coalesce(c.phones, '{}'), v_ph)
                    when v_ph is not null and cardinality(coalesce(c.phones, '{}')) = 0 then array[v_ph] else c.phones end,
$s$);
  d := pg_temp.wa_once(d, $s$      city = coalesce(nullif(c.city, ''), v_city),
$s$, $s$      city = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,city}', '')), ''), c.city) else coalesce(nullif(c.city, ''), v_city) end,
$s$);
  d := pg_temp.wa_once(d, $s$      province = coalesce(nullif(c.province, ''), nullif(btrim(coalesce(m #>> '{contact,province}', '')), '')),
$s$, $s$      province = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,province}', '')), ''), c.province)
                      else coalesce(nullif(c.province, ''), nullif(btrim(coalesce(m #>> '{contact,province}', '')), '')) end,
$s$);
  d := pg_temp.wa_once(d, $s$      postal_code = coalesce(nullif(c.postal_code, ''), nullif(btrim(coalesce(m #>> '{contact,postal_code}', '')), '')),
$s$, $s$      postal_code = case when v_own then coalesce(nullif(upper(btrim(coalesce(m #>> '{contact,postal_code}', ''))), ''), c.postal_code)
                         else coalesce(nullif(c.postal_code, ''), nullif(btrim(coalesce(m #>> '{contact,postal_code}', '')), '')) end,
$s$);
  d := pg_temp.wa_once(d, $s$      address = coalesce(nullif(c.address, ''), nullif(btrim(coalesce(m #>> '{contact,address}', '')), '')),
$s$, $s$      address = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,address}', '')), ''), c.address)
                     else coalesce(nullif(c.address, ''), nullif(btrim(coalesce(m #>> '{contact,address}', '')), '')) end,
$s$);
  d := pg_temp.wa_once(d, $s$      language = coalesce(nullif(c.language, ''), nullif(btrim(coalesce(m #>> '{contact,language}', '')), '')),
$s$, $s$      language = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,language}', '')), ''), c.language)
                      else coalesce(nullif(c.language, ''), nullif(btrim(coalesce(m #>> '{contact,language}', '')), '')) end,
$s$);
  -- 5. a ticked box from the person themselves (signed in) counts even after an unsubscribe
  d := pg_temp.wa_once(d, $s$  if v_consent and (v_created or coalesce((select email_status from public.crm_contacts where id = v_cid), '') <> 'unsubscribed') then
$s$, $s$  if v_consent and (v_created or v_own or coalesce((select email_status from public.crm_contacts where id = v_cid), '') <> 'unsubscribed') then
$s$);
  d := pg_temp.wa_once(d, $s$'consent', v_consent, 'is_test', s.is_test), v_src);$s$, $s$'consent', v_consent, 'is_test', s.is_test, 'account', v_own), v_src);$s$);
  d := pg_temp.wa_once(d, $s$'roster', v_roster, 'fields', v_fields, 'consent', v_consent);$s$, $s$'roster', v_roster, 'fields', v_fields, 'consent', v_consent, 'account', v_own);$s$);
  execute d;
end $do$;
comment on function public.crm_form_apply(bigint) is 'Applies one form submission (wave156): the contact, the MTL volunteering record, roster sign-ups, custom fields, the consent and a timeline entry, in one transaction. wave194: a submission from a signed-in website account (auth_user_id) uses that account''s own record and saves what they typed to it (names, phone first, address, city, province, postal code, language); its ticked permission box counts even after an unsubscribe. Anyone else''s submission only fills gaps and never re-subscribes.';
