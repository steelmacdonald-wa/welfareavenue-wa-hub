-- wave161: crm_stripe_apply against made-up Stripe events, inside a transaction that is always rolled back.
-- Run with execute_sql; the answer comes back as the text of the ROLLBACK_RESULT exception. Nothing is kept.
do $t$
declare
  out jsonb := '[]'::jsonb; r jsonb; g record; p record; c record; n int; v_cid bigint; v_gid bigint;
  meta jsonb := jsonb_build_object('wa_source', 'hub-donate', 'wa_frequency', 'once', 'wa_designation', 'Where it is needed most', 'wa_tribute_kind', 'memory',
                                   'wa_tribute_name', 'Grand-maman Test', 'wa_consent', 'yes', 'wa_consent_label', 'Yes, send me news (test words)',
                                   'wa_fee_cover_cents', '181', 'wa_base_cents', '5000', 'wa_lang', 'en');
  mmeta jsonb := jsonb_build_object('wa_source', 'hub-donate', 'wa_frequency', 'monthly', 'wa_designation', 'Toronto', 'wa_tribute_kind', '', 'wa_consent', 'no', 'wa_fee_cover_cents', '0');
  addr jsonb := jsonb_build_object('line1', '1 rue Exemple', 'line2', 'App 2', 'city', 'Montréal', 'state', 'qc', 'postal_code', 'h1h 1h1', 'country', 'CA');
  ts bigint := extract(epoch from timestamptz '2026-09-28 18:00:00-04')::bigint;
  procedure_ok boolean;
begin
  -- 1. a one-time gift from a new donor who ticked the news box
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_T1', 'type', 'checkout.session.completed', 'created', ts, 'livemode', true, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_T1', 'object', 'checkout.session', 'mode', 'payment', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 5181, 'currency', 'cad',
          'payment_intent', 'pi_T1', 'customer', 'cus_T1', 'metadata', meta,
          'customer_details', jsonb_build_object('email', 'Donor.T1@Example.org', 'name', 'Amara  Test Donor', 'address', addr)))),
       jsonb_build_object('fee_cents', 180, 'net_cents', 5001, 'charge', 'ch_T1', 'method', 'card', 'card', jsonb_build_object('brand', 'visa', 'last4', '4242')));
  select * into g from public.crm_donations where platform = 'stripe' and external_id = 'pi_T1';
  select * into c from public.crm_contacts where id = g.contact_id;
  out := out || jsonb_build_object('t', 'one-time gift recorded with fee, net, designation and tribute',
    'ok', g.id is not null and g.amount = 51.81 and g.fee = 1.80 and g.net_amount = 50.01 and g.designation = 'Where it is needed most' and g.tribute_kind = 'memory'
          and g.tribute_name = 'Grand-maman Test' and not g.recurring and g.kind = 'donation' and g.receipt_eligible and g.notes like '%includes $1.81 to help cover the card fee%'
          and g.donated_at = to_timestamp(ts) and g.raw ->> 'session' = 'cs_T1' and g.raw #>> '{card,last4}' = '4242', 'r', r);
  out := out || jsonb_build_object('t', 'new donor: name split, address whole, donor kind, source hub_donation, express consent',
    'ok', c.first_name = 'Amara' and c.last_name = 'Test Donor' and c.full_name = 'Amara Test Donor' and c.emails = array['donor.t1@example.org'] and c.address = '1 rue Exemple, App 2'
          and c.city = 'Montréal' and c.province = 'QC' and c.postal_code = 'H1H 1H1' and c.country = 'CA' and c.kinds = array['donor'] and c.source = 'hub_donation'
          and c.email_consent = 'express' and c.email_status = 'subscribed' and c.consent_source like 'Hub donation page (28 Sep 2026)%',
    'c', jsonb_build_object('fn', c.first_name, 'ln', c.last_name, 'addr', c.address, 'prov', c.province, 'post', c.postal_code, 'consent', c.email_consent, 'src', c.consent_source));
  select count(*) into n from public.crm_interactions where contact_id = c.id and kind = 'consent' and body like '%Yes, send me news (test words)%';
  out := out || jsonb_build_object('t', 'the permission and its words on the timeline once', 'ok', n = 1);
  out := out || jsonb_build_object('t', 'the event is logged done', 'ok', (select status from public.crm_stripe_events where id = 'evt_T1') = 'done');
  v_cid := c.id; v_gid := g.id;

  -- 2. the same event again changes nothing
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_T1', 'type', 'checkout.session.completed', 'created', ts, 'data', jsonb_build_object('object', jsonb_build_object('id', 'cs_T1'))));
  select count(*) into n from public.crm_donations where platform = 'stripe' and external_id = 'pi_T1';
  out := out || jsonb_build_object('t', 'a repeated event is a duplicate', 'ok', (r ->> 'duplicate')::boolean and n = 1 and (select attempts from public.crm_stripe_events where id = 'evt_T1') = 2, 'r', r);

  -- 3. a second gift by the same email (other case) finds the same donor; someone unsubscribed stays unsubscribed
  update public.crm_contacts set email_status = 'unsubscribed', email_consent = null where id = v_cid;
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_T2', 'type', 'checkout.session.completed', 'created', ts + 60, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_T2', 'mode', 'payment', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 2500, 'currency', 'cad', 'payment_intent', 'pi_T2',
          'metadata', meta || jsonb_build_object('wa_tribute_kind', 'bogus', 'wa_fee_cover_cents', '0'),
          'customer_details', jsonb_build_object('email', 'DONOR.t1@example.org', 'name', 'Someone Else', 'address', jsonb_build_object('line1', '9 Other St', 'city', 'Toronto'))))), '{}'::jsonb);
  select * into g from public.crm_donations where platform = 'stripe' and external_id = 'pi_T2';
  select * into c from public.crm_contacts where id = v_cid;
  out := out || jsonb_build_object('t', 'same email, same donor; their name and address are not overwritten; a bad tribute is dropped',
    'ok', g.contact_id = v_cid and c.full_name = 'Amara Test Donor' and c.address = '1 rue Exemple, App 2' and g.tribute_kind is null and g.tribute_name is null and g.fee is null, 'r', r);
  out := out || jsonb_build_object('t', 'unsubscribed stays unsubscribed; the tick is on the timeline as kept unsubscribed',
    'ok', c.email_status = 'unsubscribed' and c.email_consent is null and exists (select 1 from public.crm_interactions where contact_id = v_cid and kind = 'consent' and subject like '%kept unsubscribed%'));

  -- 4. a payment the donation page did not start (Keela on the same account) is left alone
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_T3', 'type', 'checkout.session.completed', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_T3', 'mode', 'payment', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 1000, 'payment_intent', 'pi_T3', 'metadata', '{}'::jsonb,
          'customer_details', jsonb_build_object('email', 'keela.payer@example.org')))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'a checkout from elsewhere is ignored, nothing recorded',
    'ok', r ? 'ignored' and not exists (select 1 from public.crm_donations where external_id = 'pi_T3') and not exists (select 1 from public.crm_contacts where 'keela.payer@example.org' = any(emails))
          and (select status from public.crm_stripe_events where id = 'evt_T3') = 'ignored', 'r', r);

  -- 5. a bank debit that has not cleared: the donor now, the gift when it clears
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_T4', 'type', 'checkout.session.completed', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_T4', 'mode', 'payment', 'status', 'complete', 'payment_status', 'unpaid', 'amount_total', 10000, 'payment_intent', 'pi_T4', 'metadata', meta,
          'customer_details', jsonb_build_object('email', 'pad.donor@example.org', 'name', 'Pad Donor')))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'unpaid checkout: waiting, no gift yet', 'ok', r ? 'waiting' and not exists (select 1 from public.crm_donations where external_id = 'pi_T4'), 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_T5', 'type', 'checkout.session.async_payment_succeeded', 'created', ts + 86400 * 3, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_T4', 'mode', 'payment', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 10000, 'payment_intent', 'pi_T4', 'metadata', meta,
          'customer_details', jsonb_build_object('email', 'pad.donor@example.org', 'name', 'Pad Donor')))), '{}'::jsonb);
  select count(*) into n from public.crm_interactions i join public.crm_contacts k on k.id = i.contact_id where 'pad.donor@example.org' = any(k.emails) and i.kind = 'consent';
  out := out || jsonb_build_object('t', 'cleared: the gift is recorded on the day it cleared, the consent entry stays single',
    'ok', exists (select 1 from public.crm_donations where external_id = 'pi_T4' and amount = 100 and donated_at = to_timestamp(ts + 86400 * 3)) and n = 1, 'r', r);

  -- 6. a monthly gift: the checkout, then each month's invoice
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_M1', 'type', 'checkout.session.completed', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_M1', 'mode', 'subscription', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 2000, 'currency', 'cad', 'subscription', 'sub_M1', 'customer', 'cus_M1',
          'metadata', mmeta, 'customer_details', jsonb_build_object('email', 'monthly.donor@example.org', 'name', 'Monthly Donor', 'address', addr)))), '{}'::jsonb);
  select * into p from public.crm_gift_plans where external_id = 'sub_M1';
  out := out || jsonb_build_object('t', 'monthly checkout: the plan with its donor, amount and designation, no gift yet (the invoice brings it); no consent without the tick',
    'ok', p.id is not null and p.amount = 20 and p.designation = 'Toronto' and p.status = 'active' and p.contact_id is not null and p.customer_id = 'cus_M1'
          and not exists (select 1 from public.crm_donations where plan_id = p.id)
          and (select coalesce(email_consent, '') from public.crm_contacts where id = p.contact_id) = '', 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_M2', 'type', 'invoice.paid', 'created', ts + 5, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'in_M1', 'object', 'invoice', 'subscription', 'sub_M1', 'customer', 'cus_M1', 'amount_paid', 2000, 'currency', 'cad', 'billing_reason', 'subscription_create',
          'status_transitions', jsonb_build_object('paid_at', ts + 4), 'subscription_details', jsonb_build_object('metadata', mmeta),
          'lines', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('period', jsonb_build_object('start', ts, 'end', ts + 30 * 86400))))))),
       jsonb_build_object('fee_cents', 88, 'net_cents', 1912));
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_M3', 'type', 'invoice.paid', 'created', ts + 30 * 86400, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'in_M2', 'subscription', 'sub_M1', 'customer', 'cus_M1', 'amount_paid', 2000, 'currency', 'cad', 'billing_reason', 'subscription_cycle',
          'status_transitions', jsonb_build_object('paid_at', ts + 30 * 86400), 'subscription_details', jsonb_build_object('metadata', mmeta),
          'lines', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('period', jsonb_build_object('end', ts + 60 * 86400))))))), '{}'::jsonb);
  select * into p from public.crm_gift_plans where external_id = 'sub_M1';
  select count(*) into n from public.crm_donations where plan_id = p.id and recurring and designation = 'Toronto' and contact_id = p.contact_id;
  out := out || jsonb_build_object('t', 'two monthly payments: two recurring gifts on the plan, last paid and next payment set',
    'ok', n = 2 and p.last_paid_at = to_timestamp(ts + 30 * 86400) and p.next_payment_at = to_timestamp(ts + 60 * 86400)
          and (select fee from public.crm_donations where external_id = 'in_M1') = 0.88, 'r', r, 'n', n);

  -- 7. the first invoice before the checkout event (Stripe does not promise the order)
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_M4', 'type', 'invoice.paid', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'in_M9', 'subscription', 'sub_M9', 'customer', 'cus_M9', 'amount_paid', 3500, 'currency', 'cad', 'customer_email', 'early.bird@example.org',
          'customer_name', 'Early Bird', 'customer_address', addr, 'status_transitions', jsonb_build_object('paid_at', ts),
          'subscription_details', jsonb_build_object('metadata', mmeta || jsonb_build_object('wa_designation', 'Montreal', 'wa_consent', 'yes', 'wa_consent_label', 'News words')),
          'lines', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('period', jsonb_build_object('end', ts + 30 * 86400))))))), '{}'::jsonb);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_M5', 'type', 'checkout.session.completed', 'created', ts + 2, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_M9', 'mode', 'subscription', 'status', 'complete', 'amount_total', 3500, 'subscription', 'sub_M9', 'customer', 'cus_M9',
          'metadata', mmeta || jsonb_build_object('wa_designation', 'Montreal', 'wa_consent', 'yes', 'wa_consent_label', 'News words'),
          'customer_details', jsonb_build_object('email', 'early.bird@example.org', 'name', 'Early Bird')))), '{}'::jsonb);
  select * into p from public.crm_gift_plans where external_id = 'sub_M9';
  out := out || jsonb_build_object('t', 'invoice first: plan and gift from the invoice, the checkout then adds the consent to the same donor',
    'ok', p.designation = 'Montreal' and (select count(*) from public.crm_donations where plan_id = p.id and contact_id = p.contact_id and designation = 'Montreal') = 1
          and (select email_consent from public.crm_contacts where id = p.contact_id) = 'express'
          and (select count(*) from public.crm_contacts where 'early.bird@example.org' = any(emails)) = 1, 'r', r);

  -- 8. refunds: part, then the rest; a receipted gift keeps its amount and gets a note
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_R1', 'type', 'charge.refunded', 'created', ts + 100, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'ch_T1', 'object', 'charge', 'payment_intent', 'pi_T1', 'amount', 5181, 'amount_refunded', 2000))), '{}'::jsonb);
  select * into g from public.crm_donations where external_id = 'pi_T1';
  out := out || jsonb_build_object('t', 'partial refund: amount kept 31.81, refunded 20, net follows',
    'ok', g.amount = 31.81 and g.refunded_amount = 20 and g.net_amount = 30.01 and g.refunded_at = to_timestamp(ts + 100), 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_R2', 'type', 'charge.refunded', 'created', ts + 200, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'ch_T1', 'payment_intent', 'pi_T1', 'amount', 5181, 'amount_refunded', 5181))), '{}'::jsonb);
  select * into g from public.crm_donations where external_id = 'pi_T1';
  out := out || jsonb_build_object('t', 'refunded in full: amount 0, the receipt view says so, no receipt due',
    'ok', g.amount = 0 and g.refunded_amount = 51.81 and (select receipt_status from public.crm_gift_receipts_v where gift_id = g.id) = 'no'
          and (select receipt_note from public.crm_gift_receipts_v where gift_id = g.id) = 'Refunded in full', 'r', r);
  update public.crm_donations set receipt_number = 'TEST-9999', receipt_source = 'hub' where external_id = 'pi_T2';
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_R3', 'type', 'charge.refunded', 'created', ts + 300, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'ch_T2', 'payment_intent', 'pi_T2', 'amount', 2500, 'amount_refunded', 2500))), '{}'::jsonb);
  select * into g from public.crm_donations where external_id = 'pi_T2';
  out := out || jsonb_build_object('t', 'refund after a receipt: amount stays, a note says to cancel or replace the receipt',
    'ok', g.amount = 25 and g.refunded_amount = 25 and g.notes like '%after receipt TEST-9999 was issued: cancel or replace the receipt.%', 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_R4', 'type', 'charge.refunded', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'ch_X', 'payment_intent', 'pi_KEELA', 'amount_refunded', 100))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'a refund of a payment the page did not start is ignored', 'ok', r ? 'ignored', 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_R5', 'type', 'charge.refunded', 'created', ts + 400, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'ch_M2', 'invoice', 'in_M2', 'payment_intent', 'pi_M2', 'amount_refunded', 2000))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'a monthly payment refunded (found by its invoice)', 'ok', (select amount from public.crm_donations where external_id = 'in_M2') = 0, 'r', r);

  -- 9. the monthly gift changes and stops; an older event arriving late changes nothing
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_S1', 'type', 'customer.subscription.updated', 'created', ts + 1000, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'sub_M1', 'status', 'active', 'cancel_at_period_end', true, 'cancel_at', ts + 60 * 86400, 'current_period_end', ts + 60 * 86400,
          'cancellation_details', jsonb_build_object('reason', 'cancellation_requested', 'feedback', 'too_expensive'),
          'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('quantity', 1, 'price', jsonb_build_object('unit_amount', 2500)))), 'metadata', mmeta))), '{}'::jsonb);
  select * into p from public.crm_gift_plans where external_id = 'sub_M1';
  out := out || jsonb_build_object('t', 'set to end: still active, ends_at and the reason, amount now 25',
    'ok', p.status = 'active' and p.ends_at = to_timestamp(ts + 60 * 86400) and p.cancel_reason = 'cancellation_requested: too_expensive' and p.amount = 25, 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_S2', 'type', 'customer.subscription.deleted', 'created', ts + 2000, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'sub_M1', 'status', 'canceled', 'ended_at', ts + 2000, 'canceled_at', ts + 1000, 'metadata', mmeta,
          'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('quantity', 1, 'price', jsonb_build_object('unit_amount', 2500))))))), '{}'::jsonb);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_S0', 'type', 'customer.subscription.updated', 'created', ts + 500, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'sub_M1', 'status', 'past_due', 'metadata', mmeta))), '{}'::jsonb);
  select * into p from public.crm_gift_plans where external_id = 'sub_M1';
  out := out || jsonb_build_object('t', 'stopped: cancelled on the day it ended, no next payment; the late older event did not undo it',
    'ok', p.status = 'cancelled' and p.cancelled_at = to_timestamp(ts + 2000) and p.next_payment_at is null and p.ends_at is null, 'r', r,
    'p', jsonb_build_object('status', p.status, 'cancelled_at', p.cancelled_at));
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_F1', 'type', 'invoice.payment_failed', 'created', ts + 3000, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'in_M3', 'subscription', 'sub_M9'))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'a failed payment is remembered on the plan', 'ok', (select last_failed_at from public.crm_gift_plans where external_id = 'sub_M9') = to_timestamp(ts + 3000), 'r', r);

  -- 10. anything else is ignored; a broken event keeps its error and is not half applied
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_X1', 'type', 'customer.created', 'created', ts, 'data', jsonb_build_object('object', jsonb_build_object('id', 'cus_X'))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'another type is ignored', 'ok', r ? 'ignored' and (select status from public.crm_stripe_events where id = 'evt_X1') = 'ignored', 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_E1', 'type', 'checkout.session.completed', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_E1', 'mode', 'payment', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 'not a number', 'payment_intent', 'pi_E1', 'metadata', meta,
          'customer_details', jsonb_build_object('email', 'broken.event@example.org')))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'a broken event: error kept and returned, nothing applied (not even the donor)',
    'ok', r ? 'error' and (select status from public.crm_stripe_events where id = 'evt_E1') = 'error' and not exists (select 1 from public.crm_contacts where 'broken.event@example.org' = any(emails)), 'r', r);
  r := public.crm_stripe_apply(jsonb_build_object('id', 'evt_E1', 'type', 'checkout.session.completed', 'created', ts, 'data', jsonb_build_object('object',
        jsonb_build_object('id', 'cs_E1', 'mode', 'payment', 'status', 'complete', 'payment_status', 'paid', 'amount_total', 700, 'payment_intent', 'pi_E1', 'metadata', meta,
          'customer_details', jsonb_build_object('email', 'broken.event@example.org')))), '{}'::jsonb);
  out := out || jsonb_build_object('t', 'the same event retried after an error goes through', 'ok', exists (select 1 from public.crm_donations where external_id = 'pi_E1' and amount = 7)
          and (select status from public.crm_stripe_events where id = 'evt_E1') = 'done', 'r', r);

  -- 11. the report still runs and leaves out the gift refunded in full
  perform set_config('request.jwt.claims', (select json_build_object('sub', u.id, 'email', u.email, 'role', 'authenticated')::text from auth.users u
                                             where u.email ilike 'steel%' order by u.created_at limit 1), true);
  perform set_config('role', 'authenticated', true);
  r := public.crm_report(null);
  out := out || jsonb_build_object('t', 'the report runs as Steel and counts the gifts kept (not the one refunded in full)', 'ok', r ? 'gifts',
    'fy', r ->> 'label', 'stripe', (select jsonb_agg(x) from jsonb_array_elements(r #> '{gifts,by_source}') x where x ->> 'platform' = 'stripe'));

  raise exception 'ROLLBACK_RESULT %', out;
end $t$;
