-- =====================================================================================================================
-- wave161 (28/09/26): online gifts through the Hub's own donation page, paid on Welfare Avenue's Stripe account.
-- The page (hub.welfareavenue.com/give, the donate function) sends the donor to Stripe Checkout; Stripe tells the Hub
-- what happened through the Hub's own webhook (the stripe-events function, signed with a secret kept in the vault), and
-- crm_stripe_apply() records it: the donor (found by email or created), the email permission with its words, the gift,
-- a monthly gift and each month's payment, refunds, a monthly gift that changes or stops. Only what the donation page
-- started is recorded (metadata wa_source = hub-donate): Keela's payments on the same Stripe account are left alone.
-- The page is off (donate_mode) until an admin puts it live; the settings are admin-only like mail_* and receipt_*.
-- =====================================================================================================================

-- ---------- 1. gifts: refunds, and the monthly gift a payment belongs to ----------
alter table public.crm_donations add column if not exists refunded_amount numeric not null default 0;
alter table public.crm_donations add column if not exists refunded_at timestamptz;
alter table public.crm_donations add column if not exists plan_id bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crm_donations_refunded_check') then
    alter table public.crm_donations add constraint crm_donations_refunded_check check (refunded_amount >= 0);
  end if;
end $$;
comment on column public.crm_donations.refunded_amount is 'Money given back to the donor (wave161). While a gift has no receipt, amount is what was kept (the gift less its refunds), so totals, reports and receipts use it as it is, and a gift refunded in full keeps amount 0 and counts nowhere. A gift refunded after its receipt was issued keeps its amount, and its notes say the receipt must be cancelled or replaced.';
comment on column public.crm_donations.refunded_at is 'When the last refund came through (wave161).';
comment on column public.crm_donations.plan_id is 'The monthly gift (crm_gift_plans) this payment belongs to (wave161).';

-- ---------- 2. monthly gifts ----------
create table if not exists public.crm_gift_plans (
  id bigint generated always as identity primary key,
  platform text not null default 'stripe',
  external_id text not null,
  customer_id text,
  contact_id bigint references public.crm_contacts(id) on delete set null,
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'CAD',
  frequency text not null default 'month' check (frequency in ('month', 'year', 'week')),
  status text not null default 'active' check (status in ('incomplete', 'active', 'past_due', 'paused', 'cancelled')),
  designation text,
  tribute_kind text check (tribute_kind is null or tribute_kind in ('honour', 'memory')),
  tribute_name text,
  started_at timestamptz not null default now(),
  next_payment_at timestamptz,
  last_paid_at timestamptz,
  last_failed_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  last_event_at timestamptz,
  source text not null default 'donation_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_id)
);
comment on table public.crm_gift_plans is 'Monthly gifts (wave161): one row per Stripe subscription started on the Hub''s donation page, with its donor, amount, designation and tribute, its state (active, past_due after a failed payment, paused, cancelled, incomplete), the next payment, the last one paid or failed, a cancellation scheduled for the end of the period (ends_at) and why it stopped. Each month''s payment is a gift in crm_donations with plan_id. Written only by crm_stripe_apply (service role); staff with the CRM page read it.';
comment on column public.crm_gift_plans.external_id is 'The Stripe subscription id (sub_...).';
comment on column public.crm_gift_plans.customer_id is 'The Stripe customer id (cus_...).';
comment on column public.crm_gift_plans.last_event_at is 'When Stripe created the last subscription event applied, so an older event arriving late does not undo a newer state.';
alter table public.crm_donations drop constraint if exists crm_donations_plan_fk;
alter table public.crm_donations add constraint crm_donations_plan_fk foreign key (plan_id) references public.crm_gift_plans(id) on delete set null;
create index if not exists crm_donations_plan_idx on public.crm_donations (plan_id) where plan_id is not null;
create index if not exists crm_gift_plans_contact_idx on public.crm_gift_plans (contact_id);
alter table public.crm_gift_plans enable row level security;
drop policy if exists crm_gift_plans_staff_read on public.crm_gift_plans;
create policy crm_gift_plans_staff_read on public.crm_gift_plans for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
revoke all on public.crm_gift_plans from anon;
revoke insert, update, delete, truncate on public.crm_gift_plans from authenticated;
grant select on public.crm_gift_plans to authenticated;
drop trigger if exists crm_gift_plans_touch on public.crm_gift_plans;
create trigger crm_gift_plans_touch before update on public.crm_gift_plans for each row execute function public.crm_touch();

-- a donor's monthly gifts follow them when two contacts are merged (as their receipts do, wave158b)
create or replace function public.crm_gift_plans_follow_merge()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.merged_into is not null and old.merged_into is distinct from new.merged_into then
    update public.crm_gift_plans set contact_id = new.merged_into where contact_id = new.id;
  end if;
  return new;
end $$;
comment on function public.crm_gift_plans_follow_merge() is 'Trigger (wave161): when a contact is merged into another, their monthly gifts move with them.';
revoke all on function public.crm_gift_plans_follow_merge() from public, anon, authenticated;
drop trigger if exists crm_gift_plans_follow_merge on public.crm_contacts;
create trigger crm_gift_plans_follow_merge after update of merged_into on public.crm_contacts for each row execute function public.crm_gift_plans_follow_merge();

-- ---------- 3. what Stripe told the Hub, and the page's checkout attempts ----------
create table if not exists public.crm_stripe_events (
  id text primary key,
  type text not null,
  livemode boolean,
  object_id text,
  created timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'done', 'ignored', 'error')),
  attempts integer not null default 1,
  result jsonb,
  error text,
  payload jsonb
);
comment on table public.crm_stripe_events is 'Every event Stripe sent to the Hub''s webhook (wave161), once each (the id is Stripe''s): its type, when it came and how often, what the Hub did (result), or the error that makes Stripe send it again. payload is the object as Stripe sent it (names, emails and addresses of donors), so only admins read this table.';
create index if not exists crm_stripe_events_received_idx on public.crm_stripe_events (received_at desc);
alter table public.crm_stripe_events enable row level security;
drop policy if exists crm_stripe_events_admin_read on public.crm_stripe_events;
create policy crm_stripe_events_admin_read on public.crm_stripe_events for select to authenticated using (public.is_wa_admin());
revoke all on public.crm_stripe_events from anon;
revoke insert, update, delete, truncate on public.crm_stripe_events from authenticated;
grant select on public.crm_stripe_events to authenticated;

create table if not exists public.crm_donate_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  status text not null check (status in ('session', 'spam', 'refused', 'error', 'test')),
  frequency text,
  amount_cents integer,
  session_id text,
  ip_hash text,
  user_agent text,
  error text,
  is_test boolean not null default false
);
comment on table public.crm_donate_attempts is 'Each time someone pressed Continue on the donation page (wave161): a Stripe Checkout session made (status session, with its amount), spam caught by the built-in checks, a refusal (the page off, too many tries) or an error. Keeps the rate limits (per hashed network address, never the address itself) and shows how many checkouts were started but not finished. Admins read it; the donate function writes it.';
create index if not exists crm_donate_attempts_ip_idx on public.crm_donate_attempts (ip_hash, created_at desc);
create index if not exists crm_donate_attempts_created_idx on public.crm_donate_attempts (created_at desc);
alter table public.crm_donate_attempts enable row level security;
drop policy if exists crm_donate_attempts_admin_read on public.crm_donate_attempts;
create policy crm_donate_attempts_admin_read on public.crm_donate_attempts for select to authenticated using (public.is_wa_admin());
revoke all on public.crm_donate_attempts from anon;
revoke insert, update, delete, truncate on public.crm_donate_attempts from authenticated;
grant select on public.crm_donate_attempts to authenticated;

-- ---------- 4. the page's settings: admin-only, like the email and receipt settings ----------
create or replace function public.wa_app_config_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt and donation page settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;
comment on function public.wa_app_config_guard() is 'Trigger on app_config (wave158a, wave161): the mail_*, receipt_* and donate_* settings change only through an admin or the service role; other settings stay as their policies allow.';

insert into public.app_config (key, value) values
  ('donate_mode', 'off'),
  ('donate_title', 'Give to Welfare Avenue'),
  ('donate_intro', 'Every gift keeps our student volunteers serving our communities in Montreal and Toronto. Give once, or every month to keep it steady.'),
  ('donate_amounts_once', '25,50,100,250'),
  ('donate_amounts_monthly', '10,20,35,50'),
  ('donate_min', '5'),
  ('donate_max', '10000'),
  ('donate_designations', 'Where it is needed most'),
  ('donate_fee_cover', 'on'),
  ('donate_fee_percent', '2.9'),
  ('donate_fee_fixed', '0.30'),
  ('donate_consent_label', 'Yes, send me news and stories from Welfare Avenue by email. I can unsubscribe at any time.'),
  ('donate_thanks', 'Thank you for standing with Welfare Avenue and the volunteers who make it run.'),
  ('donate_receipt_note', 'Welfare Avenue is a registered charity in Canada ({charity}). Eligible gifts receive an official receipt for income tax purposes.'),
  ('donate_monthly_note', 'You can change or stop your monthly gift at any time: write to {email}.'),
  ('donate_product', ''),
  ('donate_webhook', '')
on conflict (key) do nothing;

-- ---------- 5. recording what Stripe says ----------
-- 5a. the donor: found by email (never a merged contact) or created; fills in only what is missing; the email
--     permission follows the forms' rule (a tick is express consent, never for someone who unsubscribed)
create or replace function public.crm_stripe_contact(p_email text, p_name text, p_addr jsonb, p_consent boolean, p_label text, p_when timestamptz, p_ref text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_em text := lower(btrim(coalesce(p_email, '')));
  v_full text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  v_fn text; v_ln text;
  v_line text := nullif(btrim(concat_ws(', ', nullif(btrim(coalesce(p_addr ->> 'line1', '')), ''), nullif(btrim(coalesce(p_addr ->> 'line2', '')), ''))), '');
  v_city text := nullif(btrim(coalesce(p_addr ->> 'city', '')), '');
  v_prov text := nullif(upper(btrim(coalesce(p_addr ->> 'state', ''))), '');
  v_post text := nullif(upper(btrim(coalesce(p_addr ->> 'postal_code', ''))), '');
  v_country text := nullif(upper(btrim(coalesce(p_addr ->> 'country', ''))), '');
  v_when timestamptz := coalesce(p_when, now());
  v_cid bigint; v_created boolean := false; v_consent boolean := false;
begin
  if v_em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('contact_id', null, 'created', false, 'consent', false);
  end if;
  if v_full is not null then
    v_fn := split_part(v_full, ' ', 1);
    v_ln := nullif(btrim(substr(v_full, length(v_fn) + 1)), '');
  end if;

  select c.id into v_cid from public.crm_contacts c
   where c.merged_into is null
     and (lower(btrim(c.primary_email)) = v_em or exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_em))
   order by (lower(btrim(c.primary_email)) = v_em) desc, c.id
   limit 1;

  if v_cid is null then
    insert into public.crm_contacts (full_name, first_name, last_name, emails, address, city, province, postal_code, country, kinds, source, created_by, updated_by)
    values (coalesce(v_full, v_em), v_fn, v_ln, array[v_em], v_line, v_city, v_prov, v_post, v_country, array['donor'], 'hub_donation', 'donation page', 'donation page')
    returning id into v_cid;
    v_created := true;
  else
    -- the address goes in whole and only when the contact has none (a receipt prints one address, never a mix)
    update public.crm_contacts c set
      first_name = coalesce(nullif(c.first_name, ''), v_fn),
      last_name = coalesce(nullif(c.last_name, ''), v_ln),
      full_name = case when coalesce(c.full_name, '') in ('', '(no name)') or lower(c.full_name) = v_em then coalesce(v_full, c.full_name) else c.full_name end,
      address = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_line else c.address end,
      city = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_city else c.city end,
      province = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_prov else c.province end,
      postal_code = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_post else c.postal_code end,
      country = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_country else c.country end,
      kinds = case when 'donor' = any(coalesce(c.kinds, '{}')) then c.kinds else coalesce(c.kinds, '{}') || array['donor'] end,
      updated_by = 'donation page'
    where c.id = v_cid;
  end if;

  if coalesce(p_consent, false) and not exists (select 1 from public.crm_interactions i where i.source = 'hub_donation' and i.source_ref = p_ref and i.kind = 'consent') then
    if v_created or coalesce((select email_status from public.crm_contacts where id = v_cid), '') <> 'unsubscribed' then
      update public.crm_contacts set email_consent = 'express',
        consent_source = 'Hub donation page (' || to_char((v_when at time zone 'America/Toronto')::date, 'DD Mon YYYY') || ')', consent_at = v_when,
        email_status = case when email_status in ('bounced', 'complained') then email_status else 'subscribed' end
      where id = v_cid;
      v_consent := true;
    end if;
    insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
    values (v_cid, 'consent', 'in', 'web',
            case when v_consent then 'Said yes to email news on the donation page' else 'Ticked email news on the donation page (kept unsubscribed: confirm with them first)' end,
            'Email permission: "' || coalesce(p_label, '') || '"', v_when, 'hub_donation', p_ref,
            jsonb_build_object('consent', true, 'recorded', v_consent, 'label', p_label), 'donation page');
  end if;
  update public.crm_contacts set last_activity_at = greatest(coalesce(last_activity_at, v_when), v_when) where id = v_cid;
  return jsonb_build_object('contact_id', v_cid, 'created', v_created, 'consent', v_consent);
end $$;
comment on function public.crm_stripe_contact(text, text, jsonb, boolean, text, timestamptz, text) is 'The donor of an online gift (wave161): the contact with this email (never a merged one) or a new one (source hub_donation, kind donor), filling in only what is missing (the name, and the billing address whole only when they have no address). A ticked news box is express consent with the page and the day, never for someone who unsubscribed; the tick and its words go on the timeline once per checkout (p_ref). Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_contact(text, text, jsonb, boolean, text, timestamptz, text) from public, anon, authenticated;

-- 5b. a monthly gift, found by its subscription or created
create or replace function public.crm_stripe_plan_upsert(p_sub text, p_customer text, p_cid bigint, p_amount numeric, p_currency text, p_meta jsonb, p_when timestamptz, p_next timestamptz)
returns bigint language plpgsql security definer set search_path to '' as $$
declare
  v_id bigint;
  v_tk text := case when coalesce(p_meta ->> 'wa_tribute_kind', '') in ('honour', 'memory') then p_meta ->> 'wa_tribute_kind' end;
begin
  if coalesce(p_sub, '') = '' then return null; end if;
  select id into v_id from public.crm_gift_plans where platform = 'stripe' and external_id = p_sub;
  if v_id is null then
    insert into public.crm_gift_plans (platform, external_id, customer_id, contact_id, amount, currency, designation, tribute_kind, tribute_name, started_at, next_payment_at)
    values ('stripe', p_sub, p_customer, p_cid, greatest(coalesce(p_amount, 0), 0), upper(coalesce(nullif(p_currency, ''), 'cad')),
            nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), ''), v_tk, case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end,
            coalesce(p_when, now()), p_next)
    on conflict (platform, external_id) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from public.crm_gift_plans where platform = 'stripe' and external_id = p_sub; end if;
  end if;
  update public.crm_gift_plans set
    customer_id = coalesce(customer_id, p_customer),
    contact_id = coalesce(contact_id, p_cid),
    amount = case when amount = 0 and coalesce(p_amount, 0) > 0 then p_amount else amount end,
    next_payment_at = coalesce(p_next, next_payment_at),
    designation = coalesce(designation, nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), '')),
    tribute_kind = coalesce(tribute_kind, v_tk),
    tribute_name = coalesce(tribute_name, case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end)
  where id = v_id;
  -- the plan's payments follow its donor once they are known
  if p_cid is not null then
    update public.crm_donations set contact_id = p_cid where plan_id = v_id and contact_id is null;
  end if;
  return v_id;
end $$;
comment on function public.crm_stripe_plan_upsert(text, text, bigint, numeric, text, jsonb, timestamptz, timestamptz) is 'A monthly gift by its Stripe subscription (wave161): created the first time any event names it (the checkout, the first invoice or the subscription itself, whichever Stripe sends first), then completed with what later events know (the donor, the amount, the designation and tribute, the next payment) without undoing what an earlier one set. Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_plan_upsert(text, text, bigint, numeric, text, jsonb, timestamptz, timestamptz) from public, anon, authenticated;

-- 5c. one gift, once (the platform and external id are unique)
create or replace function public.crm_stripe_gift(p_ext text, p_cid bigint, p_amount numeric, p_currency text, p_when timestamptz, p_meta jsonb, p_extra jsonb, p_recurring boolean, p_plan bigint, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_gid bigint;
  v_fee numeric := nullif(coalesce(p_extra ->> 'fee_cents', ''), '')::numeric / 100;
  v_net numeric := nullif(coalesce(p_extra ->> 'net_cents', ''), '')::numeric / 100;
  v_cover numeric := coalesce(nullif(coalesce(p_meta ->> 'wa_fee_cover_cents', ''), '')::numeric, 0) / 100;
  v_tk text := case when coalesce(p_meta ->> 'wa_tribute_kind', '') in ('honour', 'memory') then p_meta ->> 'wa_tribute_kind' end;
  v_note text;
begin
  if coalesce(p_ext, '') = '' then raise exception 'a Stripe gift needs its payment id'; end if;
  v_note := case when p_recurring then 'Monthly gift through the Hub''s donation page' else 'Online gift through the Hub''s donation page' end ||
            case when v_cover > 0 then '; includes ' || to_char(v_cover, 'FM$999,990.00') || ' to help cover the card fee' else '' end || '.';
  insert into public.crm_donations (contact_id, amount, currency, donated_at, platform, designation, external_id, recurring, fee, net_amount,
                                    receipt_eligible, notes, raw, created_by, updated_by, kind, tribute_kind, tribute_name, plan_id)
  values (p_cid, greatest(coalesce(p_amount, 0), 0), upper(coalesce(nullif(p_currency, ''), 'cad')), coalesce(p_when, now()), 'stripe',
          nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), ''), p_ext, coalesce(p_recurring, false), v_fee, v_net,
          true, v_note, p_raw, 'donation page', 'donation page', 'donation', v_tk,
          case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end, p_plan)
  on conflict (platform, external_id) where external_id is not null do nothing
  returning id into v_gid;
  if v_gid is null then
    return jsonb_build_object('already', true, 'gift_id', (select id from public.crm_donations where platform = 'stripe' and external_id = p_ext));
  end if;
  return jsonb_build_object('gift_id', v_gid, 'amount', p_amount, 'contact_id', p_cid);
end $$;
comment on function public.crm_stripe_gift(text, bigint, numeric, text, timestamptz, jsonb, jsonb, boolean, bigint, jsonb) is 'Records one online gift (wave161), once: platform stripe, the Stripe payment (pi_...) or monthly invoice (in_...) as external_id, the amount, the date paid, the designation and tribute the donor chose, the Stripe fee and net amount when known, what they added to cover the card fee (in the notes), a monthly payment''s plan. A kind donation, receipt eligible: it joins the receipts due. Its insert starts the gift automations (crm_auto_on_gift) like any gift. Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_gift(text, bigint, numeric, text, timestamptz, jsonb, jsonb, boolean, bigint, jsonb) from public, anon, authenticated;

-- 5d. the checkout finished (or a bank debit cleared later)
create or replace function public.crm_stripe_on_session(o jsonb, p_extra jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  m jsonb := coalesce(o -> 'metadata', '{}'::jsonb);
  cd jsonb := coalesce(o -> 'customer_details', '{}'::jsonb);
  v_c jsonb; v_cid bigint; v_pid bigint; v_amt numeric := coalesce(nullif(o ->> 'amount_total', '')::numeric, 0) / 100;
begin
  if coalesce(m ->> 'wa_source', '') <> 'hub-donate' then return jsonb_build_object('ignored', 'Not from the Hub''s donation page'); end if;
  if coalesce(o ->> 'status', '') <> 'complete' then return jsonb_build_object('ignored', 'The checkout is not complete'); end if;
  v_c := public.crm_stripe_contact(cd ->> 'email', cd ->> 'name', cd -> 'address', coalesce(m ->> 'wa_consent', '') = 'yes', m ->> 'wa_consent_label', p_when, 'stripe:' || (o ->> 'id'));
  v_cid := nullif(v_c ->> 'contact_id', '')::bigint;
  if o ->> 'mode' = 'subscription' then
    -- the monthly gift itself; each month's payment is recorded from its invoice (invoice.paid)
    v_pid := public.crm_stripe_plan_upsert(o ->> 'subscription', o ->> 'customer', v_cid, v_amt, o ->> 'currency', m, p_when, null);
    return v_c || jsonb_build_object('plan_id', v_pid, 'monthly', true);
  end if;
  if coalesce(o ->> 'payment_status', '') <> 'paid' then
    return v_c || jsonb_build_object('waiting', 'The payment has not cleared yet (a bank debit): the gift is recorded when it does');
  end if;
  return v_c || public.crm_stripe_gift(coalesce(nullif(o ->> 'payment_intent', ''), o ->> 'id'), v_cid, v_amt, o ->> 'currency', p_when, m, p_extra, false, null,
    jsonb_build_object('session', o ->> 'id', 'payment_intent', o ->> 'payment_intent', 'customer', o ->> 'customer', 'charge', p_extra ->> 'charge',
                       'method', p_extra ->> 'method', 'card', p_extra -> 'card', 'lang', m ->> 'wa_lang', 'base_cents', m ->> 'wa_base_cents', 'fee_cover_cents', m ->> 'wa_fee_cover_cents'));
end $$;
comment on function public.crm_stripe_on_session(jsonb, jsonb, timestamptz) is 'checkout.session.completed and checkout.session.async_payment_succeeded (wave161): for a checkout the donation page started, the donor and their email permission, then a one-time gift once paid, or the monthly gift (whose payments come from its invoices). Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_on_session(jsonb, jsonb, timestamptz) from public, anon, authenticated;

-- 5e. a monthly payment went through
create or replace function public.crm_stripe_on_invoice(o jsonb, p_extra jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  sm jsonb := coalesce(o #> '{subscription_details,metadata}', '{}'::jsonb);
  v_sub text := nullif(o ->> 'subscription', '');
  v_pid bigint; v_cid bigint; v_c jsonb := '{}'::jsonb; v_paid timestamptz; v_amt numeric; v_next timestamptz; p record;
begin
  if v_sub is null then return jsonb_build_object('ignored', 'Not a monthly gift'); end if;
  select id, contact_id into v_pid, v_cid from public.crm_gift_plans where platform = 'stripe' and external_id = v_sub;
  if v_pid is null and coalesce(sm ->> 'wa_source', '') <> 'hub-donate' then return jsonb_build_object('ignored', 'Not a monthly gift from the Hub''s donation page'); end if;
  v_amt := coalesce(nullif(o ->> 'amount_paid', '')::numeric, 0) / 100;
  if v_amt <= 0 then return jsonb_build_object('ignored', 'Nothing was paid on this invoice'); end if;
  v_paid := coalesce(to_timestamp(nullif(o #>> '{status_transitions,paid_at}', '')::double precision), p_when);
  v_next := to_timestamp(nullif(o #>> '{lines,data,0,period,end}', '')::double precision);
  if v_cid is null then
    v_c := public.crm_stripe_contact(o ->> 'customer_email', o ->> 'customer_name', o -> 'customer_address', false, null, v_paid, 'stripe:' || (o ->> 'id'));
    v_cid := nullif(v_c ->> 'contact_id', '')::bigint;
  end if;
  v_pid := public.crm_stripe_plan_upsert(v_sub, o ->> 'customer', v_cid, v_amt, o ->> 'currency', sm, v_paid, v_next);
  update public.crm_gift_plans set last_paid_at = greatest(coalesce(last_paid_at, v_paid), v_paid),
    status = case when status in ('past_due', 'incomplete') then 'active' else status end
  where id = v_pid;
  select designation, tribute_kind, tribute_name into p from public.crm_gift_plans where id = v_pid;
  -- the month's payment carries the plan's designation and tribute (the subscription's metadata, kept on the plan)
  return v_c || public.crm_stripe_gift(o ->> 'id', v_cid, v_amt, o ->> 'currency', v_paid,
    jsonb_build_object('wa_designation', p.designation, 'wa_tribute_kind', p.tribute_kind, 'wa_tribute_name', p.tribute_name, 'wa_fee_cover_cents', sm ->> 'wa_fee_cover_cents'),
    p_extra, true, v_pid,
    jsonb_build_object('invoice', o ->> 'id', 'subscription', v_sub, 'customer', o ->> 'customer', 'charge', coalesce(p_extra ->> 'charge', o ->> 'charge'),
                       'billing_reason', o ->> 'billing_reason', 'method', p_extra ->> 'method', 'card', p_extra -> 'card'));
end $$;
comment on function public.crm_stripe_on_invoice(jsonb, jsonb, timestamptz) is 'invoice.paid (wave161): a month''s payment of a monthly gift the donation page started becomes a gift (recurring, with its plan, designation and tribute), and the monthly gift is marked paid (active again after a failed payment). Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_on_invoice(jsonb, jsonb, timestamptz) from public, anon, authenticated;

-- 5f. a monthly payment failed
create or replace function public.crm_stripe_on_invoice_failed(o jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pid bigint;
begin
  select id into v_pid from public.crm_gift_plans where platform = 'stripe' and external_id = nullif(o ->> 'subscription', '');
  if v_pid is null then return jsonb_build_object('ignored', 'Not a monthly gift from the Hub''s donation page'); end if;
  update public.crm_gift_plans set last_failed_at = greatest(coalesce(last_failed_at, p_when), p_when) where id = v_pid;
  return jsonb_build_object('plan_id', v_pid, 'failed', true);
end $$;
comment on function public.crm_stripe_on_invoice_failed(jsonb, timestamptz) is 'invoice.payment_failed (wave161): the monthly gift remembers when a payment failed (Stripe retries it; the subscription event says past_due). Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_on_invoice_failed(jsonb, timestamptz) from public, anon, authenticated;

-- 5g. a refund
create or replace function public.crm_stripe_on_refund(o jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  g record;
  v_ref numeric := coalesce(nullif(o ->> 'amount_refunded', '')::numeric, 0) / 100;
  v_gross numeric; v_kept numeric;
begin
  select * into g from public.crm_donations d
   where d.platform = 'stripe' and d.external_id in (nullif(o ->> 'invoice', ''), nullif(o ->> 'payment_intent', ''))
   order by d.id limit 1 for update;
  if not found then return jsonb_build_object('ignored', 'No gift from the donation page matches this payment'); end if;
  v_gross := coalesce(g.amount, 0) + coalesce(g.refunded_amount, 0);
  v_kept := greatest(v_gross - v_ref, 0);
  if nullif(g.receipt_number, '') is not null then
    update public.crm_donations set refunded_amount = v_ref, refunded_at = p_when, updated_by = 'stripe',
      notes = concat_ws(E'\n', nullif(notes, ''), 'Refunded ' || to_char(v_ref, 'FM$999,990.00') || ' on ' || to_char((p_when at time zone 'America/Toronto')::date, 'DD Mon YYYY') ||
                        ' after receipt ' || g.receipt_number || ' was issued: cancel or replace the receipt.')
    where id = g.id;
    return jsonb_build_object('gift_id', g.id, 'refunded', v_ref, 'receipt_needs_attention', g.receipt_number);
  end if;
  update public.crm_donations set amount = v_kept, refunded_amount = v_ref, refunded_at = p_when,
    net_amount = case when fee is null then net_amount else v_kept - fee end, updated_by = 'stripe'
  where id = g.id;
  return jsonb_build_object('gift_id', g.id, 'refunded', v_ref, 'kept', v_kept);
end $$;
comment on function public.crm_stripe_on_refund(jsonb, timestamptz) is 'charge.refunded (wave161): the gift of that payment keeps what was not given back (amount, net) and records the refund; Stripe''s amount_refunded is the running total, so a second partial refund is applied correctly and a repeat changes nothing. A gift already receipted keeps its amount and gets a note to cancel or replace the receipt. A payment the donation page did not start is left alone. Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_on_refund(jsonb, timestamptz) from public, anon, authenticated;

-- 5h. a monthly gift changed or stopped
create or replace function public.crm_stripe_on_subscription(o jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  m jsonb := coalesce(o -> 'metadata', '{}'::jsonb);
  v_id bigint; v_st text; v_amt numeric; v_ends boolean := coalesce((o ->> 'cancel_at_period_end')::boolean, false);
  v_reason text := nullif(concat_ws(': ', nullif(o #>> '{cancellation_details,reason}', ''), nullif(o #>> '{cancellation_details,feedback}', ''), nullif(o #>> '{cancellation_details,comment}', '')), '');
begin
  select id into v_id from public.crm_gift_plans where platform = 'stripe' and external_id = o ->> 'id';
  if v_id is null and coalesce(m ->> 'wa_source', '') <> 'hub-donate' then return jsonb_build_object('ignored', 'Not a monthly gift from the Hub''s donation page'); end if;
  v_st := case coalesce(o ->> 'status', '') when 'active' then 'active' when 'trialing' then 'active' when 'past_due' then 'past_due' when 'unpaid' then 'past_due'
            when 'canceled' then 'cancelled' when 'incomplete_expired' then 'cancelled' when 'incomplete' then 'incomplete' when 'paused' then 'paused' else 'active' end;
  select sum(coalesce(nullif(i #>> '{price,unit_amount}', '')::numeric, 0) * coalesce(nullif(i ->> 'quantity', '')::numeric, 1)) / 100 into v_amt
    from jsonb_array_elements(coalesce(o #> '{items,data}', '[]'::jsonb)) i;
  if v_id is null then
    v_id := public.crm_stripe_plan_upsert(o ->> 'id', o ->> 'customer', null, v_amt, o ->> 'currency', m,
              coalesce(to_timestamp(nullif(o ->> 'start_date', '')::double precision), p_when), to_timestamp(nullif(o ->> 'current_period_end', '')::double precision));
  end if;
  -- an older event arriving after a newer one changes nothing
  update public.crm_gift_plans set
    status = v_st,
    amount = case when coalesce(v_amt, 0) > 0 then v_amt else amount end,
    next_payment_at = case when v_st = 'cancelled' then null else coalesce(to_timestamp(nullif(o ->> 'current_period_end', '')::double precision), next_payment_at) end,
    ends_at = case when v_st <> 'cancelled' and v_ends then to_timestamp(nullif(o ->> 'cancel_at', '')::double precision) else null end,
    cancelled_at = case when v_st = 'cancelled' then coalesce(to_timestamp(nullif(o ->> 'ended_at', '')::double precision), to_timestamp(nullif(o ->> 'canceled_at', '')::double precision), p_when) else null end,
    cancel_reason = case when v_st = 'cancelled' or v_ends then coalesce(v_reason, cancel_reason) else null end,
    last_event_at = p_when
  where id = v_id and (last_event_at is null or last_event_at <= p_when);
  return jsonb_build_object('plan_id', v_id, 'status', v_st, 'ends', v_ends);
end $$;
comment on function public.crm_stripe_on_subscription(jsonb, timestamptz) is 'customer.subscription.created, .updated and .deleted (wave161): the monthly gift''s state as Stripe has it (active, past_due, paused, cancelled, incomplete), its amount, next payment, a cancellation set for the end of the period and why it stopped. Events are applied in the order Stripe created them (last_event_at). Internal to crm_stripe_apply.';
revoke all on function public.crm_stripe_on_subscription(jsonb, timestamptz) from public, anon, authenticated;

-- 5i. the entry point: once per event, never twice
create or replace function public.crm_stripe_apply(p_event jsonb, p_extra jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_id text := p_event ->> 'id';
  v_type text := p_event ->> 'type';
  o jsonb := p_event #> '{data,object}';
  v_when timestamptz := coalesce(to_timestamp(nullif(p_event ->> 'created', '')::double precision), now());
  v_status text; v_res jsonb;
begin
  if v_id is null or v_type is null or o is null then raise exception 'not a Stripe event'; end if;
  insert into public.crm_stripe_events (id, type, livemode, object_id, created, payload)
  values (v_id, v_type, (p_event ->> 'livemode')::boolean, o ->> 'id', v_when, o)
  on conflict (id) do update set attempts = public.crm_stripe_events.attempts + 1, received_at = now()
  returning status into v_status;
  if v_status in ('done', 'ignored') then return jsonb_build_object('duplicate', true, 'status', v_status); end if;
  begin
    v_res := case
      when v_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then public.crm_stripe_on_session(o, coalesce(p_extra, '{}'::jsonb), v_when)
      when v_type = 'checkout.session.async_payment_failed' then
        case when coalesce(o #>> '{metadata,wa_source}', '') = 'hub-donate' then jsonb_build_object('failed', 'The bank debit did not go through: no gift') else jsonb_build_object('ignored', 'Not from the Hub''s donation page') end
      when v_type = 'invoice.paid' then public.crm_stripe_on_invoice(o, coalesce(p_extra, '{}'::jsonb), v_when)
      when v_type = 'invoice.payment_failed' then public.crm_stripe_on_invoice_failed(o, v_when)
      when v_type = 'charge.refunded' then public.crm_stripe_on_refund(o, v_when)
      when v_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then public.crm_stripe_on_subscription(o, v_when)
      else jsonb_build_object('ignored', 'The Hub does not record ' || v_type)
    end;
    update public.crm_stripe_events set status = case when v_res ? 'ignored' then 'ignored' else 'done' end, processed_at = now(), result = v_res, error = null
     where id = v_id;
    return v_res;
  exception when others then
    -- what the block did is undone; the event keeps the error, and stripe-events answers 500 so Stripe sends it again
    update public.crm_stripe_events set status = 'error', processed_at = now(), error = left(sqlerrm, 500) where id = v_id;
    return jsonb_build_object('error', sqlerrm);
  end;
end $$;
comment on function public.crm_stripe_apply(jsonb, jsonb) is 'Applies one Stripe event to the CRM (wave161), once: stripe-events calls it after checking Stripe''s signature, with p_extra (the fee, net amount, charge and card the function looked up). Logs the event in crm_stripe_events; an event already done or ignored changes nothing. Records checkouts, monthly payments, failed payments, refunds and monthly gifts that change or stop, only for what the Hub''s donation page started. An error is kept on the event and returned (not raised) so the function answers 500 and Stripe retries. Service role only.';
revoke all on function public.crm_stripe_apply(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.crm_stripe_apply(jsonb, jsonb) to service_role;

-- ---------- 6. receipts and reports see refunds ----------
create or replace view public.crm_gift_receipts_v with (security_invoker = true) as
 select id as gift_id,
    contact_id,
    amount,
    advantage_amount,
    greatest(coalesce(amount, 0::numeric) - coalesce(advantage_amount, 0::numeric), 0::numeric) as eligible_amount,
    extract(year from (donated_at at time zone 'America/Toronto'::text))::integer as tax_year,
    kind,
    platform,
    receipt_number,
        case
            when nullif(receipt_number, ''::text) is not null then 'receipted'::text
            when contact_id is null then 'no'::text
            when kind = any (array['sponsorship'::text, 'other'::text]) then 'no'::text
            when receipt_eligible = false and platform = 'keela'::text then 'no'::text
            when coalesce(amount, 0::numeric) <= 0::numeric then 'no'::text
            when coalesce(advantage_amount, 0::numeric) > (0.8 * coalesce(amount, 0::numeric)) then 'no'::text
            when kind = 'in_kind'::text and nullif(btrim(coalesce(in_kind_desc, ''::text)), ''::text) is null then 'no'::text
            when lower(coalesce(platform, ''::text)) = 'zeffy'::text then 'platform'::text
            else 'due'::text
        end as receipt_status,
        case
            when nullif(receipt_number, ''::text) is not null then ('Receipt '::text || receipt_number) || coalesce((' ('::text || receipt_source) || ')'::text, ''::text)
            when contact_id is null then 'No donor on the gift'::text
            when kind = 'sponsorship'::text then 'A sponsorship gets an invoice or a thank-you, not a tax receipt'::text
            when kind = 'other'::text then 'Not a gift'::text
            when receipt_eligible = false and platform = 'keela'::text then 'Keela marked it as not receiptable'::text
            when coalesce(amount, 0::numeric) <= 0::numeric and coalesce(refunded_amount, 0::numeric) > 0::numeric then 'Refunded in full'::text
            when coalesce(amount, 0::numeric) <= 0::numeric then 'No amount'::text
            when coalesce(advantage_amount, 0::numeric) > (0.8 * coalesce(amount, 0::numeric)) then 'What they received is worth more than 80% of the amount'::text
            when kind = 'in_kind'::text and nullif(btrim(coalesce(in_kind_desc, ''::text)), ''::text) is null then 'Describe the gift in kind first'::text
            when lower(coalesce(platform, ''::text)) = 'zeffy'::text then 'Zeffy issues the receipt'::text
            else 'A receipt is due for '::text || to_char(greatest(coalesce(amount, 0::numeric) - coalesce(advantage_amount, 0::numeric), 0::numeric), 'FM$999,999,990.00'::text) ||
                 case when coalesce(refunded_amount, 0::numeric) > 0::numeric then ' (after a refund of ' || to_char(refunded_amount, 'FM$999,999,990.00') || ')' else '' end
        end as receipt_note
   from public.crm_donations d;

-- the fiscal year report leaves out gifts refunded in full (a partial refund already shows in the amount)
do $$
declare def text; n int;
begin
  select pg_get_functiondef('public.crm_report(integer)'::regprocedure) into def;
  if position('refunded_amount' in def) = 0 then
    n := (length(def) - length(replace(def, 'where d.donated_at is not null', ''))) / length('where d.donated_at is not null');
    if n <> 2 then raise exception 'crm_report: expected 2 gift queries, found %', n; end if;
    def := replace(def, 'where d.donated_at is not null', 'where d.donated_at is not null and not (coalesce(d.refunded_amount, 0) > 0 and coalesce(d.amount, 0) = 0)');
    execute def;
  end if;
end $$;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260928221131', 'wa161_donations', array[$m$alter table public.crm_donations add column if not exists refunded_amount numeric not null default 0$m$,$m$alter table public.crm_donations add column if not exists refunded_at timestamptz$m$,$m$alter table public.crm_donations add column if not exists plan_id bigint$m$,$m$do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crm_donations_refunded_check') then
    alter table public.crm_donations add constraint crm_donations_refunded_check check (refunded_amount >= 0);
  end if;
end $$$m$,$m$comment on column public.crm_donations.refunded_amount is 'Money given back to the donor (wave161). While a gift has no receipt, amount is what was kept (the gift less its refunds), so totals, reports and receipts use it as it is, and a gift refunded in full keeps amount 0 and counts nowhere. A gift refunded after its receipt was issued keeps its amount, and its notes say the receipt must be cancelled or replaced.'$m$,$m$comment on column public.crm_donations.refunded_at is 'When the last refund came through (wave161).'$m$,$m$comment on column public.crm_donations.plan_id is 'The monthly gift (crm_gift_plans) this payment belongs to (wave161).'$m$,$m$create table if not exists public.crm_gift_plans (
  id bigint generated always as identity primary key,
  platform text not null default 'stripe',
  external_id text not null,
  customer_id text,
  contact_id bigint references public.crm_contacts(id) on delete set null,
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'CAD',
  frequency text not null default 'month' check (frequency in ('month', 'year', 'week')),
  status text not null default 'active' check (status in ('incomplete', 'active', 'past_due', 'paused', 'cancelled')),
  designation text,
  tribute_kind text check (tribute_kind is null or tribute_kind in ('honour', 'memory')),
  tribute_name text,
  started_at timestamptz not null default now(),
  next_payment_at timestamptz,
  last_paid_at timestamptz,
  last_failed_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  last_event_at timestamptz,
  source text not null default 'donation_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_id)
)$m$,$m$comment on table public.crm_gift_plans is 'Monthly gifts (wave161): one row per Stripe subscription started on the Hub''s donation page, with its donor, amount, designation and tribute, its state (active, past_due after a failed payment, paused, cancelled, incomplete), the next payment, the last one paid or failed, a cancellation scheduled for the end of the period (ends_at) and why it stopped. Each month''s payment is a gift in crm_donations with plan_id. Written only by crm_stripe_apply (service role); staff with the CRM page read it.'$m$,$m$comment on column public.crm_gift_plans.external_id is 'The Stripe subscription id (sub_...).'$m$,$m$comment on column public.crm_gift_plans.customer_id is 'The Stripe customer id (cus_...).'$m$,$m$comment on column public.crm_gift_plans.last_event_at is 'When Stripe created the last subscription event applied, so an older event arriving late does not undo a newer state.'$m$,$m$alter table public.crm_donations drop constraint if exists crm_donations_plan_fk$m$,$m$alter table public.crm_donations add constraint crm_donations_plan_fk foreign key (plan_id) references public.crm_gift_plans(id) on delete set null$m$,$m$create index if not exists crm_donations_plan_idx on public.crm_donations (plan_id) where plan_id is not null$m$,$m$create index if not exists crm_gift_plans_contact_idx on public.crm_gift_plans (contact_id)$m$,$m$alter table public.crm_gift_plans enable row level security$m$,$m$drop policy if exists crm_gift_plans_staff_read on public.crm_gift_plans$m$,$m$create policy crm_gift_plans_staff_read on public.crm_gift_plans for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true))$m$,$m$revoke all on public.crm_gift_plans from anon$m$,$m$revoke insert, update, delete, truncate on public.crm_gift_plans from authenticated$m$,$m$grant select on public.crm_gift_plans to authenticated$m$,$m$drop trigger if exists crm_gift_plans_touch on public.crm_gift_plans$m$,$m$create trigger crm_gift_plans_touch before update on public.crm_gift_plans for each row execute function public.crm_touch()$m$,$m$create or replace function public.crm_gift_plans_follow_merge()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.merged_into is not null and old.merged_into is distinct from new.merged_into then
    update public.crm_gift_plans set contact_id = new.merged_into where contact_id = new.id;
  end if;
  return new;
end $$$m$,$m$comment on function public.crm_gift_plans_follow_merge() is 'Trigger (wave161): when a contact is merged into another, their monthly gifts move with them.'$m$,$m$revoke all on function public.crm_gift_plans_follow_merge() from public, anon, authenticated$m$,$m$drop trigger if exists crm_gift_plans_follow_merge on public.crm_contacts$m$,$m$create trigger crm_gift_plans_follow_merge after update of merged_into on public.crm_contacts for each row execute function public.crm_gift_plans_follow_merge()$m$,$m$create table if not exists public.crm_stripe_events (
  id text primary key,
  type text not null,
  livemode boolean,
  object_id text,
  created timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'done', 'ignored', 'error')),
  attempts integer not null default 1,
  result jsonb,
  error text,
  payload jsonb
)$m$,$m$comment on table public.crm_stripe_events is 'Every event Stripe sent to the Hub''s webhook (wave161), once each (the id is Stripe''s): its type, when it came and how often, what the Hub did (result), or the error that makes Stripe send it again. payload is the object as Stripe sent it (names, emails and addresses of donors), so only admins read this table.'$m$,$m$create index if not exists crm_stripe_events_received_idx on public.crm_stripe_events (received_at desc)$m$,$m$alter table public.crm_stripe_events enable row level security$m$,$m$drop policy if exists crm_stripe_events_admin_read on public.crm_stripe_events$m$,$m$create policy crm_stripe_events_admin_read on public.crm_stripe_events for select to authenticated using (public.is_wa_admin())$m$,$m$revoke all on public.crm_stripe_events from anon$m$,$m$revoke insert, update, delete, truncate on public.crm_stripe_events from authenticated$m$,$m$grant select on public.crm_stripe_events to authenticated$m$,$m$create table if not exists public.crm_donate_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  status text not null check (status in ('session', 'spam', 'refused', 'error', 'test')),
  frequency text,
  amount_cents integer,
  session_id text,
  ip_hash text,
  user_agent text,
  error text,
  is_test boolean not null default false
)$m$,$m$comment on table public.crm_donate_attempts is 'Each time someone pressed Continue on the donation page (wave161): a Stripe Checkout session made (status session, with its amount), spam caught by the built-in checks, a refusal (the page off, too many tries) or an error. Keeps the rate limits (per hashed network address, never the address itself) and shows how many checkouts were started but not finished. Admins read it; the donate function writes it.'$m$,$m$create index if not exists crm_donate_attempts_ip_idx on public.crm_donate_attempts (ip_hash, created_at desc)$m$,$m$create index if not exists crm_donate_attempts_created_idx on public.crm_donate_attempts (created_at desc)$m$,$m$alter table public.crm_donate_attempts enable row level security$m$,$m$drop policy if exists crm_donate_attempts_admin_read on public.crm_donate_attempts$m$,$m$create policy crm_donate_attempts_admin_read on public.crm_donate_attempts for select to authenticated using (public.is_wa_admin())$m$,$m$revoke all on public.crm_donate_attempts from anon$m$,$m$revoke insert, update, delete, truncate on public.crm_donate_attempts from authenticated$m$,$m$grant select on public.crm_donate_attempts to authenticated$m$,$m$create or replace function public.wa_app_config_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt and donation page settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$$m$,$m$comment on function public.wa_app_config_guard() is 'Trigger on app_config (wave158a, wave161): the mail_*, receipt_* and donate_* settings change only through an admin or the service role; other settings stay as their policies allow.'$m$,$m$insert into public.app_config (key, value) values
  ('donate_mode', 'off'),
  ('donate_title', 'Give to Welfare Avenue'),
  ('donate_intro', 'Every gift keeps our student volunteers serving our communities in Montreal and Toronto. Give once, or every month to keep it steady.'),
  ('donate_amounts_once', '25,50,100,250'),
  ('donate_amounts_monthly', '10,20,35,50'),
  ('donate_min', '5'),
  ('donate_max', '10000'),
  ('donate_designations', 'Where it is needed most'),
  ('donate_fee_cover', 'on'),
  ('donate_fee_percent', '2.9'),
  ('donate_fee_fixed', '0.30'),
  ('donate_consent_label', 'Yes, send me news and stories from Welfare Avenue by email. I can unsubscribe at any time.'),
  ('donate_thanks', 'Thank you for standing with Welfare Avenue and the volunteers who make it run.'),
  ('donate_receipt_note', 'Welfare Avenue is a registered charity in Canada ({charity}). Eligible gifts receive an official receipt for income tax purposes.'),
  ('donate_monthly_note', 'You can change or stop your monthly gift at any time: write to {email}.'),
  ('donate_product', ''),
  ('donate_webhook', '')
on conflict (key) do nothing$m$,$m$create or replace function public.crm_stripe_contact(p_email text, p_name text, p_addr jsonb, p_consent boolean, p_label text, p_when timestamptz, p_ref text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_em text := lower(btrim(coalesce(p_email, '')));
  v_full text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  v_fn text; v_ln text;
  v_line text := nullif(btrim(concat_ws(', ', nullif(btrim(coalesce(p_addr ->> 'line1', '')), ''), nullif(btrim(coalesce(p_addr ->> 'line2', '')), ''))), '');
  v_city text := nullif(btrim(coalesce(p_addr ->> 'city', '')), '');
  v_prov text := nullif(upper(btrim(coalesce(p_addr ->> 'state', ''))), '');
  v_post text := nullif(upper(btrim(coalesce(p_addr ->> 'postal_code', ''))), '');
  v_country text := nullif(upper(btrim(coalesce(p_addr ->> 'country', ''))), '');
  v_when timestamptz := coalesce(p_when, now());
  v_cid bigint; v_created boolean := false; v_consent boolean := false;
begin
  if v_em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('contact_id', null, 'created', false, 'consent', false);
  end if;
  if v_full is not null then
    v_fn := split_part(v_full, ' ', 1);
    v_ln := nullif(btrim(substr(v_full, length(v_fn) + 1)), '');
  end if;

  select c.id into v_cid from public.crm_contacts c
   where c.merged_into is null
     and (lower(btrim(c.primary_email)) = v_em or exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_em))
   order by (lower(btrim(c.primary_email)) = v_em) desc, c.id
   limit 1;

  if v_cid is null then
    insert into public.crm_contacts (full_name, first_name, last_name, emails, address, city, province, postal_code, country, kinds, source, created_by, updated_by)
    values (coalesce(v_full, v_em), v_fn, v_ln, array[v_em], v_line, v_city, v_prov, v_post, v_country, array['donor'], 'hub_donation', 'donation page', 'donation page')
    returning id into v_cid;
    v_created := true;
  else
    -- the address goes in whole and only when the contact has none (a receipt prints one address, never a mix)
    update public.crm_contacts c set
      first_name = coalesce(nullif(c.first_name, ''), v_fn),
      last_name = coalesce(nullif(c.last_name, ''), v_ln),
      full_name = case when coalesce(c.full_name, '') in ('', '(no name)') or lower(c.full_name) = v_em then coalesce(v_full, c.full_name) else c.full_name end,
      address = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_line else c.address end,
      city = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_city else c.city end,
      province = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_prov else c.province end,
      postal_code = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_post else c.postal_code end,
      country = case when coalesce(c.address, '') = '' and coalesce(c.city, '') = '' and coalesce(c.postal_code, '') = '' then v_country else c.country end,
      kinds = case when 'donor' = any(coalesce(c.kinds, '{}')) then c.kinds else coalesce(c.kinds, '{}') || array['donor'] end,
      updated_by = 'donation page'
    where c.id = v_cid;
  end if;

  if coalesce(p_consent, false) and not exists (select 1 from public.crm_interactions i where i.source = 'hub_donation' and i.source_ref = p_ref and i.kind = 'consent') then
    if v_created or coalesce((select email_status from public.crm_contacts where id = v_cid), '') <> 'unsubscribed' then
      update public.crm_contacts set email_consent = 'express',
        consent_source = 'Hub donation page (' || to_char((v_when at time zone 'America/Toronto')::date, 'DD Mon YYYY') || ')', consent_at = v_when,
        email_status = case when email_status in ('bounced', 'complained') then email_status else 'subscribed' end
      where id = v_cid;
      v_consent := true;
    end if;
    insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
    values (v_cid, 'consent', 'in', 'web',
            case when v_consent then 'Said yes to email news on the donation page' else 'Ticked email news on the donation page (kept unsubscribed: confirm with them first)' end,
            'Email permission: "' || coalesce(p_label, '') || '"', v_when, 'hub_donation', p_ref,
            jsonb_build_object('consent', true, 'recorded', v_consent, 'label', p_label), 'donation page');
  end if;
  update public.crm_contacts set last_activity_at = greatest(coalesce(last_activity_at, v_when), v_when) where id = v_cid;
  return jsonb_build_object('contact_id', v_cid, 'created', v_created, 'consent', v_consent);
end $$$m$,$m$comment on function public.crm_stripe_contact(text, text, jsonb, boolean, text, timestamptz, text) is 'The donor of an online gift (wave161): the contact with this email (never a merged one) or a new one (source hub_donation, kind donor), filling in only what is missing (the name, and the billing address whole only when they have no address). A ticked news box is express consent with the page and the day, never for someone who unsubscribed; the tick and its words go on the timeline once per checkout (p_ref). Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_contact(text, text, jsonb, boolean, text, timestamptz, text) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_plan_upsert(p_sub text, p_customer text, p_cid bigint, p_amount numeric, p_currency text, p_meta jsonb, p_when timestamptz, p_next timestamptz)
returns bigint language plpgsql security definer set search_path to '' as $$
declare
  v_id bigint;
  v_tk text := case when coalesce(p_meta ->> 'wa_tribute_kind', '') in ('honour', 'memory') then p_meta ->> 'wa_tribute_kind' end;
begin
  if coalesce(p_sub, '') = '' then return null; end if;
  select id into v_id from public.crm_gift_plans where platform = 'stripe' and external_id = p_sub;
  if v_id is null then
    insert into public.crm_gift_plans (platform, external_id, customer_id, contact_id, amount, currency, designation, tribute_kind, tribute_name, started_at, next_payment_at)
    values ('stripe', p_sub, p_customer, p_cid, greatest(coalesce(p_amount, 0), 0), upper(coalesce(nullif(p_currency, ''), 'cad')),
            nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), ''), v_tk, case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end,
            coalesce(p_when, now()), p_next)
    on conflict (platform, external_id) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from public.crm_gift_plans where platform = 'stripe' and external_id = p_sub; end if;
  end if;
  update public.crm_gift_plans set
    customer_id = coalesce(customer_id, p_customer),
    contact_id = coalesce(contact_id, p_cid),
    amount = case when amount = 0 and coalesce(p_amount, 0) > 0 then p_amount else amount end,
    next_payment_at = coalesce(p_next, next_payment_at),
    designation = coalesce(designation, nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), '')),
    tribute_kind = coalesce(tribute_kind, v_tk),
    tribute_name = coalesce(tribute_name, case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end)
  where id = v_id;
  -- the plan's payments follow its donor once they are known
  if p_cid is not null then
    update public.crm_donations set contact_id = p_cid where plan_id = v_id and contact_id is null;
  end if;
  return v_id;
end $$$m$,$m$comment on function public.crm_stripe_plan_upsert(text, text, bigint, numeric, text, jsonb, timestamptz, timestamptz) is 'A monthly gift by its Stripe subscription (wave161): created the first time any event names it (the checkout, the first invoice or the subscription itself, whichever Stripe sends first), then completed with what later events know (the donor, the amount, the designation and tribute, the next payment) without undoing what an earlier one set. Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_plan_upsert(text, text, bigint, numeric, text, jsonb, timestamptz, timestamptz) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_gift(p_ext text, p_cid bigint, p_amount numeric, p_currency text, p_when timestamptz, p_meta jsonb, p_extra jsonb, p_recurring boolean, p_plan bigint, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_gid bigint;
  v_fee numeric := nullif(coalesce(p_extra ->> 'fee_cents', ''), '')::numeric / 100;
  v_net numeric := nullif(coalesce(p_extra ->> 'net_cents', ''), '')::numeric / 100;
  v_cover numeric := coalesce(nullif(coalesce(p_meta ->> 'wa_fee_cover_cents', ''), '')::numeric, 0) / 100;
  v_tk text := case when coalesce(p_meta ->> 'wa_tribute_kind', '') in ('honour', 'memory') then p_meta ->> 'wa_tribute_kind' end;
  v_note text;
begin
  if coalesce(p_ext, '') = '' then raise exception 'a Stripe gift needs its payment id'; end if;
  v_note := case when p_recurring then 'Monthly gift through the Hub''s donation page' else 'Online gift through the Hub''s donation page' end ||
            case when v_cover > 0 then '; includes ' || to_char(v_cover, 'FM$999,990.00') || ' to help cover the card fee' else '' end || '.';
  insert into public.crm_donations (contact_id, amount, currency, donated_at, platform, designation, external_id, recurring, fee, net_amount,
                                    receipt_eligible, notes, raw, created_by, updated_by, kind, tribute_kind, tribute_name, plan_id)
  values (p_cid, greatest(coalesce(p_amount, 0), 0), upper(coalesce(nullif(p_currency, ''), 'cad')), coalesce(p_when, now()), 'stripe',
          nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), ''), p_ext, coalesce(p_recurring, false), v_fee, v_net,
          true, v_note, p_raw, 'donation page', 'donation page', 'donation', v_tk,
          case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end, p_plan)
  on conflict (platform, external_id) where external_id is not null do nothing
  returning id into v_gid;
  if v_gid is null then
    return jsonb_build_object('already', true, 'gift_id', (select id from public.crm_donations where platform = 'stripe' and external_id = p_ext));
  end if;
  return jsonb_build_object('gift_id', v_gid, 'amount', p_amount, 'contact_id', p_cid);
end $$$m$,$m$comment on function public.crm_stripe_gift(text, bigint, numeric, text, timestamptz, jsonb, jsonb, boolean, bigint, jsonb) is 'Records one online gift (wave161), once: platform stripe, the Stripe payment (pi_...) or monthly invoice (in_...) as external_id, the amount, the date paid, the designation and tribute the donor chose, the Stripe fee and net amount when known, what they added to cover the card fee (in the notes), a monthly payment''s plan. A kind donation, receipt eligible: it joins the receipts due. Its insert starts the gift automations (crm_auto_on_gift) like any gift. Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_gift(text, bigint, numeric, text, timestamptz, jsonb, jsonb, boolean, bigint, jsonb) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_on_session(o jsonb, p_extra jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  m jsonb := coalesce(o -> 'metadata', '{}'::jsonb);
  cd jsonb := coalesce(o -> 'customer_details', '{}'::jsonb);
  v_c jsonb; v_cid bigint; v_pid bigint; v_amt numeric := coalesce(nullif(o ->> 'amount_total', '')::numeric, 0) / 100;
begin
  if coalesce(m ->> 'wa_source', '') <> 'hub-donate' then return jsonb_build_object('ignored', 'Not from the Hub''s donation page'); end if;
  if coalesce(o ->> 'status', '') <> 'complete' then return jsonb_build_object('ignored', 'The checkout is not complete'); end if;
  v_c := public.crm_stripe_contact(cd ->> 'email', cd ->> 'name', cd -> 'address', coalesce(m ->> 'wa_consent', '') = 'yes', m ->> 'wa_consent_label', p_when, 'stripe:' || (o ->> 'id'));
  v_cid := nullif(v_c ->> 'contact_id', '')::bigint;
  if o ->> 'mode' = 'subscription' then
    -- the monthly gift itself; each month's payment is recorded from its invoice (invoice.paid)
    v_pid := public.crm_stripe_plan_upsert(o ->> 'subscription', o ->> 'customer', v_cid, v_amt, o ->> 'currency', m, p_when, null);
    return v_c || jsonb_build_object('plan_id', v_pid, 'monthly', true);
  end if;
  if coalesce(o ->> 'payment_status', '') <> 'paid' then
    return v_c || jsonb_build_object('waiting', 'The payment has not cleared yet (a bank debit): the gift is recorded when it does');
  end if;
  return v_c || public.crm_stripe_gift(coalesce(nullif(o ->> 'payment_intent', ''), o ->> 'id'), v_cid, v_amt, o ->> 'currency', p_when, m, p_extra, false, null,
    jsonb_build_object('session', o ->> 'id', 'payment_intent', o ->> 'payment_intent', 'customer', o ->> 'customer', 'charge', p_extra ->> 'charge',
                       'method', p_extra ->> 'method', 'card', p_extra -> 'card', 'lang', m ->> 'wa_lang', 'base_cents', m ->> 'wa_base_cents', 'fee_cover_cents', m ->> 'wa_fee_cover_cents'));
end $$$m$,$m$comment on function public.crm_stripe_on_session(jsonb, jsonb, timestamptz) is 'checkout.session.completed and checkout.session.async_payment_succeeded (wave161): for a checkout the donation page started, the donor and their email permission, then a one-time gift once paid, or the monthly gift (whose payments come from its invoices). Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_on_session(jsonb, jsonb, timestamptz) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_on_invoice(o jsonb, p_extra jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  sm jsonb := coalesce(o #> '{subscription_details,metadata}', '{}'::jsonb);
  v_sub text := nullif(o ->> 'subscription', '');
  v_pid bigint; v_cid bigint; v_c jsonb := '{}'::jsonb; v_paid timestamptz; v_amt numeric; v_next timestamptz; p record;
begin
  if v_sub is null then return jsonb_build_object('ignored', 'Not a monthly gift'); end if;
  select id, contact_id into v_pid, v_cid from public.crm_gift_plans where platform = 'stripe' and external_id = v_sub;
  if v_pid is null and coalesce(sm ->> 'wa_source', '') <> 'hub-donate' then return jsonb_build_object('ignored', 'Not a monthly gift from the Hub''s donation page'); end if;
  v_amt := coalesce(nullif(o ->> 'amount_paid', '')::numeric, 0) / 100;
  if v_amt <= 0 then return jsonb_build_object('ignored', 'Nothing was paid on this invoice'); end if;
  v_paid := coalesce(to_timestamp(nullif(o #>> '{status_transitions,paid_at}', '')::double precision), p_when);
  v_next := to_timestamp(nullif(o #>> '{lines,data,0,period,end}', '')::double precision);
  if v_cid is null then
    v_c := public.crm_stripe_contact(o ->> 'customer_email', o ->> 'customer_name', o -> 'customer_address', false, null, v_paid, 'stripe:' || (o ->> 'id'));
    v_cid := nullif(v_c ->> 'contact_id', '')::bigint;
  end if;
  v_pid := public.crm_stripe_plan_upsert(v_sub, o ->> 'customer', v_cid, v_amt, o ->> 'currency', sm, v_paid, v_next);
  update public.crm_gift_plans set last_paid_at = greatest(coalesce(last_paid_at, v_paid), v_paid),
    status = case when status in ('past_due', 'incomplete') then 'active' else status end
  where id = v_pid;
  select designation, tribute_kind, tribute_name into p from public.crm_gift_plans where id = v_pid;
  -- the month's payment carries the plan's designation and tribute (the subscription's metadata, kept on the plan)
  return v_c || public.crm_stripe_gift(o ->> 'id', v_cid, v_amt, o ->> 'currency', v_paid,
    jsonb_build_object('wa_designation', p.designation, 'wa_tribute_kind', p.tribute_kind, 'wa_tribute_name', p.tribute_name, 'wa_fee_cover_cents', sm ->> 'wa_fee_cover_cents'),
    p_extra, true, v_pid,
    jsonb_build_object('invoice', o ->> 'id', 'subscription', v_sub, 'customer', o ->> 'customer', 'charge', coalesce(p_extra ->> 'charge', o ->> 'charge'),
                       'billing_reason', o ->> 'billing_reason', 'method', p_extra ->> 'method', 'card', p_extra -> 'card'));
end $$$m$,$m$comment on function public.crm_stripe_on_invoice(jsonb, jsonb, timestamptz) is 'invoice.paid (wave161): a month''s payment of a monthly gift the donation page started becomes a gift (recurring, with its plan, designation and tribute), and the monthly gift is marked paid (active again after a failed payment). Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_on_invoice(jsonb, jsonb, timestamptz) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_on_invoice_failed(o jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_pid bigint;
begin
  select id into v_pid from public.crm_gift_plans where platform = 'stripe' and external_id = nullif(o ->> 'subscription', '');
  if v_pid is null then return jsonb_build_object('ignored', 'Not a monthly gift from the Hub''s donation page'); end if;
  update public.crm_gift_plans set last_failed_at = greatest(coalesce(last_failed_at, p_when), p_when) where id = v_pid;
  return jsonb_build_object('plan_id', v_pid, 'failed', true);
end $$$m$,$m$comment on function public.crm_stripe_on_invoice_failed(jsonb, timestamptz) is 'invoice.payment_failed (wave161): the monthly gift remembers when a payment failed (Stripe retries it; the subscription event says past_due). Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_on_invoice_failed(jsonb, timestamptz) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_on_refund(o jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  g record;
  v_ref numeric := coalesce(nullif(o ->> 'amount_refunded', '')::numeric, 0) / 100;
  v_gross numeric; v_kept numeric;
begin
  select * into g from public.crm_donations d
   where d.platform = 'stripe' and d.external_id in (nullif(o ->> 'invoice', ''), nullif(o ->> 'payment_intent', ''))
   order by d.id limit 1 for update;
  if not found then return jsonb_build_object('ignored', 'No gift from the donation page matches this payment'); end if;
  v_gross := coalesce(g.amount, 0) + coalesce(g.refunded_amount, 0);
  v_kept := greatest(v_gross - v_ref, 0);
  if nullif(g.receipt_number, '') is not null then
    update public.crm_donations set refunded_amount = v_ref, refunded_at = p_when, updated_by = 'stripe',
      notes = concat_ws(E'\n', nullif(notes, ''), 'Refunded ' || to_char(v_ref, 'FM$999,990.00') || ' on ' || to_char((p_when at time zone 'America/Toronto')::date, 'DD Mon YYYY') ||
                        ' after receipt ' || g.receipt_number || ' was issued: cancel or replace the receipt.')
    where id = g.id;
    return jsonb_build_object('gift_id', g.id, 'refunded', v_ref, 'receipt_needs_attention', g.receipt_number);
  end if;
  update public.crm_donations set amount = v_kept, refunded_amount = v_ref, refunded_at = p_when,
    net_amount = case when fee is null then net_amount else v_kept - fee end, updated_by = 'stripe'
  where id = g.id;
  return jsonb_build_object('gift_id', g.id, 'refunded', v_ref, 'kept', v_kept);
end $$$m$,$m$comment on function public.crm_stripe_on_refund(jsonb, timestamptz) is 'charge.refunded (wave161): the gift of that payment keeps what was not given back (amount, net) and records the refund; Stripe''s amount_refunded is the running total, so a second partial refund is applied correctly and a repeat changes nothing. A gift already receipted keeps its amount and gets a note to cancel or replace the receipt. A payment the donation page did not start is left alone. Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_on_refund(jsonb, timestamptz) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_on_subscription(o jsonb, p_when timestamptz)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  m jsonb := coalesce(o -> 'metadata', '{}'::jsonb);
  v_id bigint; v_st text; v_amt numeric; v_ends boolean := coalesce((o ->> 'cancel_at_period_end')::boolean, false);
  v_reason text := nullif(concat_ws(': ', nullif(o #>> '{cancellation_details,reason}', ''), nullif(o #>> '{cancellation_details,feedback}', ''), nullif(o #>> '{cancellation_details,comment}', '')), '');
begin
  select id into v_id from public.crm_gift_plans where platform = 'stripe' and external_id = o ->> 'id';
  if v_id is null and coalesce(m ->> 'wa_source', '') <> 'hub-donate' then return jsonb_build_object('ignored', 'Not a monthly gift from the Hub''s donation page'); end if;
  v_st := case coalesce(o ->> 'status', '') when 'active' then 'active' when 'trialing' then 'active' when 'past_due' then 'past_due' when 'unpaid' then 'past_due'
            when 'canceled' then 'cancelled' when 'incomplete_expired' then 'cancelled' when 'incomplete' then 'incomplete' when 'paused' then 'paused' else 'active' end;
  select sum(coalesce(nullif(i #>> '{price,unit_amount}', '')::numeric, 0) * coalesce(nullif(i ->> 'quantity', '')::numeric, 1)) / 100 into v_amt
    from jsonb_array_elements(coalesce(o #> '{items,data}', '[]'::jsonb)) i;
  if v_id is null then
    v_id := public.crm_stripe_plan_upsert(o ->> 'id', o ->> 'customer', null, v_amt, o ->> 'currency', m,
              coalesce(to_timestamp(nullif(o ->> 'start_date', '')::double precision), p_when), to_timestamp(nullif(o ->> 'current_period_end', '')::double precision));
  end if;
  -- an older event arriving after a newer one changes nothing
  update public.crm_gift_plans set
    status = v_st,
    amount = case when coalesce(v_amt, 0) > 0 then v_amt else amount end,
    next_payment_at = case when v_st = 'cancelled' then null else coalesce(to_timestamp(nullif(o ->> 'current_period_end', '')::double precision), next_payment_at) end,
    ends_at = case when v_st <> 'cancelled' and v_ends then to_timestamp(nullif(o ->> 'cancel_at', '')::double precision) else null end,
    cancelled_at = case when v_st = 'cancelled' then coalesce(to_timestamp(nullif(o ->> 'ended_at', '')::double precision), to_timestamp(nullif(o ->> 'canceled_at', '')::double precision), p_when) else null end,
    cancel_reason = case when v_st = 'cancelled' or v_ends then coalesce(v_reason, cancel_reason) else null end,
    last_event_at = p_when
  where id = v_id and (last_event_at is null or last_event_at <= p_when);
  return jsonb_build_object('plan_id', v_id, 'status', v_st, 'ends', v_ends);
end $$$m$,$m$comment on function public.crm_stripe_on_subscription(jsonb, timestamptz) is 'customer.subscription.created, .updated and .deleted (wave161): the monthly gift''s state as Stripe has it (active, past_due, paused, cancelled, incomplete), its amount, next payment, a cancellation set for the end of the period and why it stopped. Events are applied in the order Stripe created them (last_event_at). Internal to crm_stripe_apply.'$m$,$m$revoke all on function public.crm_stripe_on_subscription(jsonb, timestamptz) from public, anon, authenticated$m$,$m$create or replace function public.crm_stripe_apply(p_event jsonb, p_extra jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_id text := p_event ->> 'id';
  v_type text := p_event ->> 'type';
  o jsonb := p_event #> '{data,object}';
  v_when timestamptz := coalesce(to_timestamp(nullif(p_event ->> 'created', '')::double precision), now());
  v_status text; v_res jsonb;
begin
  if v_id is null or v_type is null or o is null then raise exception 'not a Stripe event'; end if;
  insert into public.crm_stripe_events (id, type, livemode, object_id, created, payload)
  values (v_id, v_type, (p_event ->> 'livemode')::boolean, o ->> 'id', v_when, o)
  on conflict (id) do update set attempts = public.crm_stripe_events.attempts + 1, received_at = now()
  returning status into v_status;
  if v_status in ('done', 'ignored') then return jsonb_build_object('duplicate', true, 'status', v_status); end if;
  begin
    v_res := case
      when v_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then public.crm_stripe_on_session(o, coalesce(p_extra, '{}'::jsonb), v_when)
      when v_type = 'checkout.session.async_payment_failed' then
        case when coalesce(o #>> '{metadata,wa_source}', '') = 'hub-donate' then jsonb_build_object('failed', 'The bank debit did not go through: no gift') else jsonb_build_object('ignored', 'Not from the Hub''s donation page') end
      when v_type = 'invoice.paid' then public.crm_stripe_on_invoice(o, coalesce(p_extra, '{}'::jsonb), v_when)
      when v_type = 'invoice.payment_failed' then public.crm_stripe_on_invoice_failed(o, v_when)
      when v_type = 'charge.refunded' then public.crm_stripe_on_refund(o, v_when)
      when v_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then public.crm_stripe_on_subscription(o, v_when)
      else jsonb_build_object('ignored', 'The Hub does not record ' || v_type)
    end;
    update public.crm_stripe_events set status = case when v_res ? 'ignored' then 'ignored' else 'done' end, processed_at = now(), result = v_res, error = null
     where id = v_id;
    return v_res;
  exception when others then
    -- what the block did is undone; the event keeps the error, and stripe-events answers 500 so Stripe sends it again
    update public.crm_stripe_events set status = 'error', processed_at = now(), error = left(sqlerrm, 500) where id = v_id;
    return jsonb_build_object('error', sqlerrm);
  end;
end $$$m$,$m$comment on function public.crm_stripe_apply(jsonb, jsonb) is 'Applies one Stripe event to the CRM (wave161), once: stripe-events calls it after checking Stripe''s signature, with p_extra (the fee, net amount, charge and card the function looked up). Logs the event in crm_stripe_events; an event already done or ignored changes nothing. Records checkouts, monthly payments, failed payments, refunds and monthly gifts that change or stop, only for what the Hub''s donation page started. An error is kept on the event and returned (not raised) so the function answers 500 and Stripe retries. Service role only.'$m$,$m$revoke all on function public.crm_stripe_apply(jsonb, jsonb) from public, anon, authenticated$m$,$m$grant execute on function public.crm_stripe_apply(jsonb, jsonb) to service_role$m$,$m$create or replace view public.crm_gift_receipts_v with (security_invoker = true) as
 select id as gift_id,
    contact_id,
    amount,
    advantage_amount,
    greatest(coalesce(amount, 0::numeric) - coalesce(advantage_amount, 0::numeric), 0::numeric) as eligible_amount,
    extract(year from (donated_at at time zone 'America/Toronto'::text))::integer as tax_year,
    kind,
    platform,
    receipt_number,
        case
            when nullif(receipt_number, ''::text) is not null then 'receipted'::text
            when contact_id is null then 'no'::text
            when kind = any (array['sponsorship'::text, 'other'::text]) then 'no'::text
            when receipt_eligible = false and platform = 'keela'::text then 'no'::text
            when coalesce(amount, 0::numeric) <= 0::numeric then 'no'::text
            when coalesce(advantage_amount, 0::numeric) > (0.8 * coalesce(amount, 0::numeric)) then 'no'::text
            when kind = 'in_kind'::text and nullif(btrim(coalesce(in_kind_desc, ''::text)), ''::text) is null then 'no'::text
            when lower(coalesce(platform, ''::text)) = 'zeffy'::text then 'platform'::text
            else 'due'::text
        end as receipt_status,
        case
            when nullif(receipt_number, ''::text) is not null then ('Receipt '::text || receipt_number) || coalesce((' ('::text || receipt_source) || ')'::text, ''::text)
            when contact_id is null then 'No donor on the gift'::text
            when kind = 'sponsorship'::text then 'A sponsorship gets an invoice or a thank-you, not a tax receipt'::text
            when kind = 'other'::text then 'Not a gift'::text
            when receipt_eligible = false and platform = 'keela'::text then 'Keela marked it as not receiptable'::text
            when coalesce(amount, 0::numeric) <= 0::numeric and coalesce(refunded_amount, 0::numeric) > 0::numeric then 'Refunded in full'::text
            when coalesce(amount, 0::numeric) <= 0::numeric then 'No amount'::text
            when coalesce(advantage_amount, 0::numeric) > (0.8 * coalesce(amount, 0::numeric)) then 'What they received is worth more than 80% of the amount'::text
            when kind = 'in_kind'::text and nullif(btrim(coalesce(in_kind_desc, ''::text)), ''::text) is null then 'Describe the gift in kind first'::text
            when lower(coalesce(platform, ''::text)) = 'zeffy'::text then 'Zeffy issues the receipt'::text
            else 'A receipt is due for '::text || to_char(greatest(coalesce(amount, 0::numeric) - coalesce(advantage_amount, 0::numeric), 0::numeric), 'FM$999,999,990.00'::text) ||
                 case when coalesce(refunded_amount, 0::numeric) > 0::numeric then ' (after a refund of ' || to_char(refunded_amount, 'FM$999,999,990.00') || ')' else '' end
        end as receipt_note
   from public.crm_donations d$m$,$m$do $$
declare def text; n int;
begin
  select pg_get_functiondef('public.crm_report(integer)'::regprocedure) into def;
  if position('refunded_amount' in def) = 0 then
    n := (length(def) - length(replace(def, 'where d.donated_at is not null', ''))) / length('where d.donated_at is not null');
    if n <> 2 then raise exception 'crm_report: expected 2 gift queries, found %', n; end if;
    def := replace(def, 'where d.donated_at is not null', 'where d.donated_at is not null and not (coalesce(d.refunded_amount, 0) > 0 and coalesce(d.amount, 0) = 0)');
    execute def;
  end if;
end $$$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
