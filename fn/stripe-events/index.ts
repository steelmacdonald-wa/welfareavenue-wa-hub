// Welfare Avenue: stripe-events (v1, 28/09/26, wave161)
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
  return json({ ok: true, result: data && data.duplicate ? 'duplicate' : data && data.ignored ? 'ignored' : 'done' });
});
