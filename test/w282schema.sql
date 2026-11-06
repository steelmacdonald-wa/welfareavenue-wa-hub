-- wave282: what the offline proof (test/w282sql.mjs, PGlite) adds on top of test/w281schema.sql and build/data/wa281_rules.sql. wave282 needs wave281
-- live first, so the harness loads the wave281 fixture (whose crm_email_permission text matches live's md5), runs the wave281 migration, then this file.
-- Copied read-only from live (zwnmulmnvopclzcvytce) on 06/11/26: crm_campaigns and crm_lists (columns, checks, policies, grants, the column comment
-- wave282 changes), the crm_email_sends columns crm_email_first_contact reads, the live mail_fundraising_exemption row (off), the marketing and
-- fundraising access profiles. Every row in section 3 is invented (Test ..., example.invalid). Not a copy of live: offline PGlite only.

-- 1. tables wave282 touches (live columns, checks, policies and grants, 06/11/26)
create table public.crm_lists (
  id bigserial primary key, name text not null, description text, kind text not null default 'dynamic'::text check (kind = any (array['dynamic'::text, 'static'::text])),
  filter jsonb not null default '{}'::jsonb, member_ids bigint[] not null default '{}'::bigint[], created_by text, created_at timestamptz not null default now(),
  updated_by text, updated_at timestamptz not null default now()
);
alter table public.crm_lists enable row level security;
create policy crm_lists_staff_read on public.crm_lists for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true));
create policy crm_lists_staff_write on public.crm_lists for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true));
create policy crm_lists_staff_update on public.crm_lists for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true));
create policy crm_lists_staff_delete on public.crm_lists for delete to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true));

create table public.crm_campaigns (
  id bigserial primary key, name text not null, list_id bigint, template_key text, kind text not null default 'newsletter'::text, subject text, preheader text,
  vars jsonb not null default '{}'::jsonb, status text not null default 'draft'::text, audience integer, eligible integer, held integer, queued_at timestamptz, sent_at timestamptz,
  cancelled_at timestamptz, created_by text, created_at timestamptz not null default now(), updated_by text, updated_at timestamptz not null default now(),
  from_name text, from_email text, reply_to text,
  constraint crm_campaigns_kind_check check ((kind = any (array['newsletter'::text, 'fundraising'::text, 'volunteer'::text, 'transactional'::text]))),
  constraint crm_campaigns_status_check check ((status = any (array['draft'::text, 'queued'::text, 'sending'::text, 'sent'::text, 'cancelled'::text])))
);
alter table public.crm_campaigns enable row level security;
create policy crm_campaigns_staff_read on public.crm_campaigns for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true));
create policy crm_campaigns_staff_insert on public.crm_campaigns for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true) and status = 'draft'::text);
comment on column public.crm_campaigns.kind is 'What the messages are: newsletter (consent needed), fundraising (consent needed unless the exemption setting is on), volunteer (a call-out: anyone not unsubscribed, Steel 27/09/26), transactional (anyone with a working address). mail-send applies crm_email_permission with this kind.';

-- crm_email_sends: the live columns the wave281 fixture leaves out and crm_email_first_contact reads, and the live status and kind checks
alter table public.crm_email_sends add column permission_basis text, add column sent_at timestamptz, add column delivered_at timestamptz,
  add column opened_at timestamptz, add column clicked_at timestamptz, add column meta jsonb not null default '{}'::jsonb;
alter table public.crm_email_sends add constraint crm_email_sends_kind_check check ((kind = any (array['transactional'::text, 'newsletter'::text, 'fundraising'::text, 'volunteer'::text, 'test'::text])));
alter table public.crm_email_sends add constraint crm_email_sends_status_check check ((status = any (array['queued'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'delayed'::text, 'bounced'::text, 'complained'::text, 'failed'::text, 'suppressed'::text, 'cancelled'::text])));

-- 2. live rows wave282 changes or reads
insert into public.app_config (key, value, updated_at) values ('mail_fundraising_exemption', 'off', '2026-09-28 00:06:50+00');
insert into public.hub_access_profiles (key, label, tier, pages) values ('marketing', 'Marketing', 'member', '{}'), ('fundraising', 'Fundraising', 'member', '{}'), ('opsmtl', 'Operations Montreal', 'member', '{}');

-- 3. fixture rows (invented)
insert into public.hub_roles (email, role, profile) values
  ('w282.marketing@example.invalid', 'member', 'marketing'), ('w282.fundraising@example.invalid', 'member', 'fundraising'),
  ('w282.ops@example.invalid', 'member', 'opsmtl'), ('w282.blockedmkt@example.invalid', 'blocked', 'marketing');

-- one contact per case of the rule; every address is example.invalid
insert into public.crm_contacts (id, full_name, emails, email_status, email_consent, consent_source, legacy_refs) overriding system value values
  (2001, 'Test Unknown Consent', array['w282.2001@example.invalid'], 'unknown', null, null, '{}'),
  (2002, 'Test Unsubscribed', array['w282.2002@example.invalid'], 'unsubscribed', null, null, '{}'),
  (2003, 'Test Bounced', array['w282.2003@example.invalid'], 'bounced', null, null, '{}'),
  (2004, 'Test Complained', array['w282.2004@example.invalid'], 'complained', null, null, '{}'),
  (2005, 'Test Do Not Contact', array['w282.2005@example.invalid'], 'subscribed', null, null, '{}'),
  (2006, 'Test Express', array['w282.2006@example.invalid'], 'subscribed', 'express', 'form: test-plain-form', '{}'),
  (2007, 'Test Recent Gift', array['w282.2007@example.invalid'], 'unknown', null, null, '{}'),
  (2008, 'Test Delivered Hub Email', array['w282.2008@example.invalid'], 'unknown', null, null, '{}'),
  (2009, 'Test Only A Test Email', array['w282.2009@example.invalid'], 'unknown', null, null, '{}'),
  (2010, 'Test Suppressed Email', array['w282.2010@example.invalid'], 'unknown', null, null, '{}'),
  (2011, 'Test Opened Failed Email', array['w282.2011@example.invalid'], 'unknown', null, null, '{}'),
  (2012, 'Test Keela Recent Open', array['w282.2012@example.invalid'], 'unknown', null, null, '{}'),
  (2013, 'Test Keela Old Open', array['w282.2013@example.invalid'], 'unknown', null, null, '{}'),
  (2014, 'Test Keela Odd Date', array['w282.2014@example.invalid'], 'unknown', null, null, '{"keela": {"email_marketing": {"last_opened": "Aug 27, 2026"}}}'),
  (2015, 'Test Keela Twelve Months', array['w282.2015@example.invalid'], 'unknown', null, null, '{}'),
  (2016, 'Test No Address', '{}', 'unknown', null, null, '{}'),
  (2017, 'Test Old Gift', array['w282.2017@example.invalid'], 'unknown', null, null, '{}'),
  (2019, 'Test Express Unsubscribed', array['w282.2019@example.invalid'], 'unsubscribed', 'express', 'form: test-plain-form', '{}'),
  (2020, 'Test Clicked Delayed Email', array['w282.2020@example.invalid'], 'unknown', null, null, '{"keela": {"email_marketing": {}}}');
insert into public.crm_contacts (id, full_name, emails, email_status, merged_into) overriding system value values (2018, 'Test Merged', array['w282.2018@example.invalid'], 'unknown', 2001);
update public.crm_contacts set do_not_contact = true, dnc_reason = 'asked' where id = 2005;
-- Keela opens relative to today: 30 days ago (recent), 13 months ago (old), exactly 12 months ago (not before the cut-off, so recent)
update public.crm_contacts set legacy_refs = jsonb_build_object('keela', jsonb_build_object('email_marketing', jsonb_build_object('last_opened', to_char(current_date - 30, 'YYYY-MM-DD')))) where id = 2012;
update public.crm_contacts set legacy_refs = jsonb_build_object('keela', jsonb_build_object('email_marketing', jsonb_build_object('last_opened', to_char(current_date - interval '13 months', 'YYYY-MM-DD')))) where id = 2013;
update public.crm_contacts set legacy_refs = jsonb_build_object('keela', jsonb_build_object('email_marketing', jsonb_build_object('last_opened', to_char(current_date - interval '12 months', 'YYYY-MM-DD')))) where id = 2015;
-- gifts: one 30 days ago (implied consent), one three years ago (implied consent ran out)
insert into public.crm_donations (contact_id, amount, donated_at) values (2007, 25, now() - interval '30 days'), (2017, 25, now() - interval '3 years');
-- Hub email history
insert into public.crm_email_sends (contact_id, to_email, template_key, kind, status, is_test, opened_at, clicked_at) values
  (2008, 'w282.2008@example.invalid', 'newsletter', 'newsletter', 'delivered', false, null, null),
  (2009, 'w282.2009@example.invalid', 'test', 'test', 'sent', true, now(), null),
  (2010, 'w282.2010@example.invalid', 'newsletter', 'newsletter', 'suppressed', false, null, null),
  (2011, 'w282.2011@example.invalid', 'newsletter', 'newsletter', 'failed', false, now() - interval '2 days', null),
  (2020, 'w282.2020@example.invalid', 'newsletter', 'newsletter', 'delayed', false, null, now() - interval '1 day');
