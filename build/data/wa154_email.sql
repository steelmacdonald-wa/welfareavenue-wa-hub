-- wa154_email (28/09/26): the email foundation for the CRM.
-- Resend sends from welfareavenue.com; templates, a send log, webhook events, the CASL permission rule
-- as one function (registered charity 713048502RR0001 confirmed by Steel 28/09/26), implied consent refreshed
-- daily, the vault setter for the webhook secret. Applied with apply_migration; the edge functions
-- mail-send, mail-events and mail-unsubscribe use these tables with the service role.

-- ---------- templates ----------
create table if not exists public.crm_email_templates (
  key text primary key,
  name text not null,
  kind text not null check (kind in ('transactional', 'newsletter', 'fundraising', 'test')),
  subject text not null,
  preheader text,
  html_body text not null,
  text_body text,
  vars jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort int not null default 100,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.crm_email_templates is 'The CRM''s email templates (wave154). key names the template (welcome_volunteer, thank_you_gift, serving_reminder, newsletter, test); html_body is the inner content with {{placeholders}}, wrapped in the brand layout by mail-send at send time. Staff with the CRM page read; admins edit through mail-send (save_template), which logs the change.';
comment on column public.crm_email_templates.kind is 'What the message is under CASL: transactional (a confirmation, reminder or receipt: not a commercial message, goes to anyone with a working address), newsletter (needs express or unexpired implied consent), fundraising (a registered charity''s appeal: follows the newsletter rule unless the fundraising exemption setting is on), test.';
comment on column public.crm_email_templates.vars is 'The placeholders the body expects, e.g. ["first_name","event_title"]. Contact fields (first_name, full_name, email) are always available.';
alter table public.crm_email_templates enable row level security;
drop policy if exists crm_email_templates_staff_read on public.crm_email_templates;
create policy crm_email_templates_staff_read on public.crm_email_templates for select to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select on public.crm_email_templates to authenticated;

-- ---------- the send log ----------
create table if not exists public.crm_email_sends (
  id bigserial primary key,
  contact_id bigint references public.crm_contacts(id) on delete set null,
  to_email text not null,
  template_key text references public.crm_email_templates(key) on delete set null,
  kind text not null check (kind in ('transactional', 'newsletter', 'fundraising', 'test')),
  subject text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed')),
  is_test boolean not null default false,
  permission_basis text,
  resend_id text unique,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);
comment on table public.crm_email_sends is 'Every email the Hub sent (or refused to send) through Resend (wave154): who, which template, the permission it relied on, Resend''s id and what happened to it (delivered, opened, clicked, bounced, complained; from the mail-events webhook). Written by mail-send and mail-events with the service role; staff with the CRM page read. A suppressed row is a send the permission rule refused.';
comment on column public.crm_email_sends.permission_basis is 'Why the send was allowed (express consent, implied consent until a date, transactional, registered charity fundraising) or refused (unsubscribed, bounced, no consent).';
comment on column public.crm_email_sends.is_test is 'A test message to one of the test recipients (mail_test_recipients in app_config); never counted as a campaign.';
comment on column public.crm_email_sends.meta is 'template name, opens (count), clicks (links), the bounce type, the caller, the vars used.';
create index if not exists crm_email_sends_contact_idx on public.crm_email_sends (contact_id, created_at desc);
create index if not exists crm_email_sends_created_idx on public.crm_email_sends (created_at desc);
alter table public.crm_email_sends enable row level security;
drop policy if exists crm_email_sends_staff_read on public.crm_email_sends;
create policy crm_email_sends_staff_read on public.crm_email_sends for select to authenticated
  using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select on public.crm_email_sends to authenticated;

-- ---------- webhook events ----------
create table if not exists public.crm_email_events (
  id bigserial primary key,
  svix_id text unique,
  type text not null,
  resend_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
comment on table public.crm_email_events is 'Resend webhook events as received by mail-events (wave154), one row per event (svix_id keeps them idempotent). The send log is updated from them; kept for the audit trail. Service role writes; admins read.';
alter table public.crm_email_events enable row level security;
drop policy if exists crm_email_events_admin_read on public.crm_email_events;
create policy crm_email_events_admin_read on public.crm_email_events for select to authenticated using (public.is_wa_admin());
grant select on public.crm_email_events to authenticated;

-- ---------- the permission rule (CASL), one place ----------
create or replace function public.crm_email_permission(p_contact_id bigint, p_kind text default 'newsletter')
returns table (allowed boolean, basis text, until date, email text, status text)
language plpgsql stable security invoker set search_path to '' as $$
declare
  c record; last_gift date; last_serve date; last_act date; imp_until date; exemption text;
begin
  select x.id, coalesce(x.primary_email, x.emails[1]) as em, coalesce(x.email_status, 'unknown') as st, x.email_consent, x.consent_source, x.implied_consent_until, x.merged_into, x.volunteer_id
    into c from public.crm_contacts x where x.id = p_contact_id;
  if c.id is null then return query select false, 'no such contact', null::date, null::text, null::text; return; end if;
  if c.merged_into is not null then return query select false, 'merged into another contact', null::date, c.em::text, c.st::text; return; end if;
  if c.em is null or c.em = '' then return query select false, 'no email address', null::date, null::text, c.st::text; return; end if;
  if c.st in ('bounced', 'complained') then return query select false, c.st::text, null::date, c.em::text, c.st::text; return; end if;
  if p_kind = 'transactional' or p_kind = 'test' then return query select true, 'transactional: a confirmation, reminder or receipt, not a commercial message'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.st = 'unsubscribed' then return query select false, 'unsubscribed'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.email_consent = 'express' then
    return query select true, ('express consent' || coalesce(' (' || c.consent_source || ')', ''))::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* implied consent (CASL s.10(13)): a gift to, or volunteering for, a registered charity within the last two years */
  select max(d.donated_at)::date into last_gift from public.crm_donations d where d.contact_id = p_contact_id;
  select max(y.d) into last_serve from (
    select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
      where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
    union all
    select h.event_at::date from public.crm_volunteer_history h where h.contact_id = p_contact_id and h.attended
  ) y;
  last_act := greatest(last_gift, last_serve);
  if c.email_consent = 'implied' and c.implied_consent_until is not null then
    imp_until := greatest(c.implied_consent_until, (last_act + interval '2 years')::date);
  elsif last_act is not null then
    imp_until := (last_act + interval '2 years')::date;
  end if;
  if imp_until is not null and imp_until >= current_date then
    return query select true, ('implied consent until ' || to_char(imp_until, 'DD Mon YYYY') || case when last_act = last_gift then ' (gift on ' when last_act is not null then ' (volunteered on ' else ' (' end
      || coalesce(to_char(last_act, 'DD Mon YYYY'), coalesce(c.consent_source, 'recorded by the team')) || ')')::text, imp_until, c.em::text, c.st::text;
    return;
  end if;
  if p_kind = 'fundraising' then
    select value into exemption from public.app_config where key = 'mail_fundraising_exemption';
    if exemption = 'on' then
      return query select true, 'fundraising by a registered charity (CASL s.6 does not apply); no consent on file'::text, null::date, c.em::text, c.st::text; return;
    end if;
  end if;
  return query select false, (case when imp_until is not null then 'implied consent ran out on ' || to_char(imp_until, 'DD Mon YYYY') else 'no consent recorded' end)::text, imp_until, c.em::text, c.st::text;
end $$;
comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154): allowed, why (the basis), when an implied consent runs out, the address and its status. Transactional messages go to anyone whose address works; unsubscribed, bounced and complained never get a newsletter or an appeal; express consent always does; implied consent lasts two years after the last gift or serving (Welfare Avenue is a registered charity, 713048502RR0001); fundraising without consent only when app_config mail_fundraising_exemption is on. mail-send calls it before every send; the CRM page shows it.';
revoke all on function public.crm_email_permission(bigint, text) from public, anon;
grant execute on function public.crm_email_permission(bigint, text) to authenticated, service_role;

-- ---------- implied consent written onto the contacts, refreshed daily ----------
create or replace function public.crm_refresh_implied_consent()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare n_set int := 0; out jsonb;
begin
  if not (public.is_wa_admin() or auth.role() is null or auth.role() = 'service_role') then
    raise exception 'admins only';
  end if;
  with act as (
    select c.id,
      (select max(d.donated_at)::date from public.crm_donations d where d.contact_id = c.id) as last_gift,
      (select max(y.d) from (
         select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
           where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
         union all
         select h.event_at::date from public.crm_volunteer_history h where h.contact_id = c.id and h.attended) y) as last_serve
    from public.crm_contacts c
    where c.merged_into is null and coalesce(c.email_consent, 'none') <> 'express'
      and coalesce(c.email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')
  ), calc as (
    select id, greatest(last_gift, last_serve) as last_act, last_gift, (greatest(last_gift, last_serve) + interval '2 years')::date as until_day
    from act where greatest(last_gift, last_serve) is not null
  ), upd as (
    update public.crm_contacts c
      set email_consent = 'implied', implied_consent_until = calc.until_day,
          consent_source = 'implied: ' || case when calc.last_act = calc.last_gift then 'gift on ' else 'volunteered on ' end || to_char(calc.last_act, 'YYYY-MM-DD') || ' (registered charity, CASL s.10(13))',
          updated_at = now(), updated_by = 'crm_refresh_implied_consent'
    from calc where c.id = calc.id
      and (c.email_consent is distinct from 'implied' or c.implied_consent_until is null or c.implied_consent_until < calc.until_day)
    returning c.id
  ) select count(*) into n_set from upd;
  select jsonb_build_object(
    'updated', n_set,
    'express', count(*) filter (where email_consent = 'express' and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'implied', count(*) filter (where email_consent = 'implied' and implied_consent_until >= current_date and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'implied_expired', count(*) filter (where email_consent = 'implied' and implied_consent_until < current_date and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'unsubscribed', count(*) filter (where email_status in ('unsubscribed', 'complained')),
    'bounced', count(*) filter (where email_status = 'bounced'),
    'not_recorded', count(*) filter (where coalesce(email_consent, 'none') in ('none') and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'ran_at', now())
    into out from public.crm_contacts where merged_into is null;
  return out;
end $$;
comment on function public.crm_refresh_implied_consent() is 'Writes implied consent onto the contacts (wave154): every live contact who is not express, unsubscribed, bounced or complained and who gave or served within two years gets email_consent implied, implied_consent_until two years after that last gift or serving, and a consent_source that says so. Never shortens a consent recorded by the team. Admins (the Email tab) and the daily cron job wa-crm-consent run it; returns the counts.';
revoke all on function public.crm_refresh_implied_consent() from public, anon;
grant execute on function public.crm_refresh_implied_consent() to authenticated, service_role;

-- ---------- a vault setter for the edge functions (the webhook signing secret never passes through the build sandbox) ----------
create or replace function public.wa_vault_set(p_name text, p_value text, p_note text default '')
returns void language plpgsql security definer set search_path to '' as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = p_name;
  if sid is null then perform vault.create_secret(p_value, p_name, p_note);
  else perform vault.update_secret(sid, p_value, p_name, p_note); end if;
end $$;
comment on function public.wa_vault_set(text, text, text) is 'Creates or replaces a vault secret by name (wave154). Only the service role may call it: the edge functions store secrets they receive (the Resend webhook signing secret) without the value ever leaving the platform.';
revoke all on function public.wa_vault_set(text, text, text) from public, anon, authenticated;
grant execute on function public.wa_vault_set(text, text, text) to service_role;

-- ---------- settings (app_config, staff read) ----------
insert into public.app_config (key, value, updated_at) values
  ('mail_mode', 'test', now()),
  ('mail_from_name', 'Welfare Avenue', now()),
  ('mail_from_email', 'info@welfareavenue.com', now()),
  ('mail_reply_to', 'info@welfareavenue.com', now()),
  ('mail_test_recipients', 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com', now()),
  ('mail_postal_address', 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', now()),
  ('mail_charity_number', '713048502RR0001', now()),
  ('mail_fundraising_exemption', 'off', now()),
  ('mail_domain', 'welfareavenue.com', now())
on conflict (key) do nothing;

-- ---------- the daily refresh ----------
select cron.unschedule('wa-crm-consent') where exists (select 1 from cron.job where jobname = 'wa-crm-consent');
select cron.schedule('wa-crm-consent', '35 8 * * *', $$select public.crm_refresh_implied_consent();$$);
