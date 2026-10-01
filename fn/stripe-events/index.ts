// Welfare Avenue: stripe-events (v2, 30/09/26, wave185; v1 28/09/26, wave161)
// v2 (wave185): after a paid gift is recorded, the receipt follows by itself when both switches are on (receipt_mode and
//   receipt_auto_online): crm_receipt_auto_issue takes the next number, receipt-pdf draws the PDF, mail-send emails the
//   thank-you with the receipt attached (a test copy to a test address while mail_mode is test). This runs after the
//   answer to Stripe (EdgeRuntime.waitUntil) and never fails the webhook; what goes wrong is written to change_log
//   (crm_receipt / auto_email_failed) and the receipt, if issued, waits in Receipts with Email it.
// The Hub's own Stripe webhook (the endpoint stripe-admin setup created on Welfare Avenue's Stripe account). Stripe signs
// each event with the endpoint's secret, which setup saved straight into the vault (STRIPE_WEBHOOK_SECRET; nobody copies
// it). This function checks the Stripe-Signature header (HMAC-SHA256 of "<t>.<raw body>", at most 5 minutes old), looks up
// the fee, the net amount and the card of a payment the donation page took (read-only: the charge and its balance
// transaction), then crm_stripe_apply() records the event once (the donor, the gift, a monthly gift and its payments,
// refunds, a monthly gift that changes or stops; only what the donation page started). Answers 200 when the event is done,
// ignored or a duplicate; 400 for a bad signature or body; 500 when the database could not apply it (the error is kept on
// the event) or the secret is missing, so Stripe sends it again (for up to three days). The answer never carries personal data.
// verify_jwt off: Stripe cannot send a Supabase token; the signature is the check. Stripe: STRIPE_SECRET_KEY for the lookups.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const STRIPE_VERSION = '2024-06-20';
const TOLERANCE = 300;

// deno-lint-ignore no-explicit-any
type Json = any;

const json = (b: Json, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
let cachedSecret = '';
async function webhookSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  const { data, error } = await svc.rpc('get_secret', { secret_name: 'STRIPE_WEBHOOK_SECRET' });
  if (error || !data) return '';
  cachedSecret = String(data);
  return cachedSecret;
}
async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
}
function same(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(',').map(s => s.trim());
  const t = (parts.find(p => p.startsWith('t=')) || '').slice(2);
  const sigs = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const ts = Number(t);
  if (!t || !isFinite(ts) || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE) return false;
  const expected = await hmac(secret, t + '.' + raw);
  return sigs.some(s => same(s, expected));
}
async function stripeGet(path: string): Promise<{ ok: boolean; status: number; body: Json }> {
  const key = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
  if (!key) return { ok: false, status: 500, body: {} };
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch('https://api.stripe.com' + path, { headers: { Authorization: 'Bearer ' + key, 'Stripe-Version': STRIPE_VERSION }, signal: ctl.signal });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  } catch (_) { return { ok: false, status: 0, body: {} }; } finally { clearTimeout(timer); }
}
// the fee, net amount and card of a payment the donation page took; nothing when it is not the page's or the lookup fails
async function extraFor(ev: Json): Promise<Json> {
  try {
    const o = (ev.data && ev.data.object) || {};
    let path = '', viaIntent = false;
    if ((ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') && o.mode === 'payment' && o.payment_status === 'paid'
        && o.payment_intent && o.metadata && o.metadata.wa_source === 'hub-donate') {
      path = '/v1/payment_intents/' + encodeURIComponent(o.payment_intent) + '?expand[]=latest_charge.balance_transaction'; viaIntent = true;
    } else if (ev.type === 'invoice.paid' && o.charge && o.subscription_details && o.subscription_details.metadata && o.subscription_details.metadata.wa_source === 'hub-donate') {
      path = '/v1/charges/' + encodeURIComponent(o.charge) + '?expand[]=balance_transaction';
    }
    if (!path) return {};
    const r = await stripeGet(path);
    if (!r.ok) return { lookup: r.status };
    const ch = viaIntent ? r.body.latest_charge : r.body;
    if (!ch || typeof ch !== 'object') return {};
    const bt = ch.balance_transaction && typeof ch.balance_transaction === 'object' ? ch.balance_transaction : null;
    const pm = ch.payment_method_details || {};
    const card = pm.card ? { brand: pm.card.brand || null, last4: pm.card.last4 || null, wallet: pm.card.wallet ? pm.card.wallet.type : null } : null;
    return { charge: ch.id || null, fee_cents: bt ? bt.fee : null, net_cents: bt ? bt.net : null, method: pm.type || null, card };
  } catch (_) { return {}; }
}

/* wave185: the receipt after an online gift (both switches on), off the webhook's critical path */
async function followUp(giftId: number) {
  const log = async (what: string, detail: string) => { try { await svc.from('change_log').insert({ entity_type: 'crm_receipt', entity_id: 'gift ' + giftId, field: what, old_value: null, new_value: detail.slice(0, 500), changed_by: 'donation page' }); } catch (_) { /* nothing more to do */ } };
  try {
    const issued = await svc.rpc('crm_receipt_auto_issue', { p_gift_id: giftId });
    if (issued.error) { await log('auto_issue_failed', issued.error.message); return; }
    const r = issued.data || {};
    if (!r.receipt_id) return; /* skipped: the switches are off, or the gift is not due (already noted when it matters) */
    const sec = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
    if (sec.error || !sec.data) { await log('auto_email_failed', r.serial + ': the trigger secret is unavailable'); return; }
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const call = async (fn: string, body: Json) => {
      const res = await fetch(SUPABASE_URL + '/functions/v1/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': String(sec.data), Authorization: 'Bearer ' + anon, apikey: anon }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body: j };
    };
    const pdf = await call('receipt-pdf', { action: 'render', receipt_id: r.receipt_id });
    if (!pdf.ok || !pdf.body.path) { await log('auto_email_failed', r.serial + ': the PDF was not drawn (' + String(pdf.body.error || pdf.status) + ')'); return; }
    const mail = await call('mail-send', { action: 'receipt', receipt_id: r.receipt_id });
    if (!mail.ok || mail.body.error || mail.body.status === 'suppressed') await log('auto_email_failed', r.serial + ': ' + String(mail.body.error || ('status ' + (mail.body.status || mail.status)) + (mail.body.basis ? ' (' + mail.body.basis + ')' : '')));
  } catch (e) {
    await log('auto_email_failed', String(e));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const raw = await req.text();
  if (raw.length > 512000) return json({ error: 'too large' }, 413);
  const secret = await webhookSecret();
  if (!secret) return json({ error: 'not set up' }, 500);
  if (!(await verify(raw, req.headers.get('stripe-signature') || '', secret))) return json({ error: 'bad signature' }, 400);
  let ev: Json; try { ev = JSON.parse(raw); } catch (_) { return json({ error: 'bad body' }, 400); }
  if (!ev || !ev.id || !ev.type || !ev.data || !ev.data.object) return json({ error: 'not an event' }, 400);
  const extra = await extraFor(ev);
  const { data, error } = await svc.rpc('crm_stripe_apply', { p_event: ev, p_extra: extra });
  if (error || (data && data.error)) return json({ error: 'not applied yet' }, 500);
  /* a new gift: its receipt follows by itself when the switches are on (after the answer to Stripe) */
  const gid = data && !data.duplicate && !data.ignored && !data.already && data.gift_id ? Number(data.gift_id) : 0;
  if (gid) {
    const w = (globalThis as any).EdgeRuntime;
    if (w && typeof w.waitUntil === 'function') w.waitUntil(followUp(gid)); else await followUp(gid);
  }
  return json({ ok: true, result: data && data.duplicate ? 'duplicate' : data && data.ignored ? 'ignored' : 'done' });
});
