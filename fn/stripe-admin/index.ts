/* stripe-admin (v5, 28/09/26, wave161): the Hub's own door to Welfare Avenue's Stripe account, for the build pipeline.
   Caller: the trigger secret only (call_edge from SQL). No part of any key or secret, and no donor data, is ever returned.
   Action check: says whether the Stripe key Steel added as an Edge Function secret (STRIPE_SECRET_KEY, a restricted key)
   is present and which mode it is in, then asks Stripe for one row of each thing the Hub may read, one it must not
   (disputes), and tries three money movements with an empty request (a transfer, a payout, a refund) that Stripe must
   refuse for want of permission (403). An empty request cannot move money even where permitted: it fails for the missing
   amount first (400), which is how a wrongly broad key would show. Only the HTTP status of each call is returned.
   Action setup (wave161): makes sure of what the donation page needs on Stripe, and nothing else. The product the gifts are
   sold under ("Gift to Welfare Avenue", described to donors as a registered charity with its number; metadata wa_key
   hub_donation; app_config donate_product), and the Hub's webhook to
   stripe-events with the events it records, pinned to the API version the Hub reads (app_config donate_webhook). A new
   endpoint's signing secret goes straight into the vault (STRIPE_WEBHOOK_SECRET) and is never returned; an endpoint whose
   secret the vault does not have is replaced. Running setup again changes nothing that is already right.
   Action expire {session_id}: closes an unpaid Checkout session (the build's own check sessions). */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const STRIPE_VERSION = '2024-06-20';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const HOOK_URL = SUPABASE_URL + '/functions/v1/stripe-events';
const HOOK_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'invoice.paid',
  'invoice.payment_failed', 'charge.refunded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

/* [what the Hub needs it for, the read call, whether the key should be allowed] */
const CHECKS: Array<[string, string, boolean]> = [
  ['Checkout Sessions', '/v1/checkout/sessions?limit=1', true],
  ['Customers', '/v1/customers?limit=1', true],
  ['Products', '/v1/products?limit=1', true],
  ['Prices', '/v1/prices?limit=1', true],
  ['Subscriptions', '/v1/subscriptions?limit=1', true],
  ['Customer Portal', '/v1/billing_portal/configurations?limit=1', true],
  ['Webhook Endpoints', '/v1/webhook_endpoints?limit=1', true],
  ['Payment Intents', '/v1/payment_intents?limit=1', true],
  ['Charges', '/v1/charges?limit=1', true],
  ['Refunds', '/v1/refunds?limit=1', true],
  ['Invoices', '/v1/invoices?limit=1', true],
  ['Balance', '/v1/balance', true],
  ['Balance transactions', '/v1/balance_transactions?limit=1', true],
  ['Events', '/v1/events?limit=1', true],
  ['Payouts', '/v1/payouts?limit=1', true],
  ['Disputes (must be refused)', '/v1/disputes?limit=1', false],
];
/* money out: an empty POST, which Stripe must refuse for permission (403) before it could ever fail for a missing amount (400) */
const MONEY_OUT: Array<[string, string, string]> = [
  ['Create a transfer (must be refused)', '/v1/transfers', ''],
  ['Create a payout (must be refused)', '/v1/payouts', ''],
  ['Create a refund (must be refused)', '/v1/refunds', ''],
  /* Stripe checks a refund's fields before its permission, so the refund is also tried against payments that cannot exist */
  ['Refund a made-up payment (must be refused)', '/v1/refunds', 'payment_intent=pi_WAHUBCHECKDOESNOTEXIST'],
  ['Refund a made-up charge (must be refused)', '/v1/refunds', 'charge=ch_WAHUBCHECKDOESNOTEXIST'],
];

function keyShape(k: string) {
  return {
    present: k.length > 0,
    kind: k.startsWith('rk_') ? 'restricted' : k.startsWith('sk_') ? 'secret (full access)' : k ? 'unrecognised' : 'none',
    mode: /^(rk|sk)_live_/.test(k) ? 'live' : /^(rk|sk)_test_/.test(k) ? 'test' : 'unknown',
    spaces_around: k.length > 0 && k !== k.trim(),
  };
}
// deno-lint-ignore no-explicit-any
function formEncode(obj: any, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (Array.isArray(v)) v.forEach((x, i) => { if (x !== null && typeof x === 'object') formEncode(x, key + '[' + i + ']', out); else out.push(encodeURIComponent(key + '[' + i + ']') + '=' + encodeURIComponent(String(x))); });
    else if (typeof v === 'object') formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
// deno-lint-ignore no-explicit-any
async function stripe(key: string, method: string, path: string, params?: any, idem?: string): Promise<{ ok: boolean; status: number; body: any }> {
  const headers: Record<string, string> = { Authorization: 'Bearer ' + key, 'Stripe-Version': STRIPE_VERSION };
  let body: string | undefined;
  if (params) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = formEncode(params).join('&'); }
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch('https://api.stripe.com' + path, { method, headers, body });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}
// deno-lint-ignore no-explicit-any
const errOf = (r: { status: number; body: any }) => ({ status: r.status, error: r.body && r.body.error ? (r.body.error.code || r.body.error.type || '') + ': ' + String(r.body.error.message || '').slice(0, 200) : null });
async function setConfig(key: string, value: string) {
  const { error } = await svc.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error('app_config ' + key + ': ' + error.message);
}

async function setup(key: string) {
  const out: Record<string, unknown> = {};
  // the product
  const list = await stripe(key, 'GET', '/v1/products?limit=100&active=true');
  if (!list.ok) return { ok: false, step: 'products', ...errOf(list) };
  // what donors read under the gift on Stripe's page
  const cn = await svc.from('app_config').select('value').eq('key', 'mail_charity_number').maybeSingle();
  const desc = 'Welfare Avenue is a registered charity in Canada' + (cn.data && cn.data.value ? ' (' + cn.data.value + ')' : '') + '.';
  // deno-lint-ignore no-explicit-any
  let product = (list.body.data || []).find((p: any) => p.metadata && p.metadata.wa_key === 'hub_donation');
  if (!product) {
    const r = await stripe(key, 'POST', '/v1/products', { name: 'Gift to Welfare Avenue', description: desc, metadata: { wa_key: 'hub_donation' } }, 'wa-hub-donation-product-v2');
    if (!r.ok) return { ok: false, step: 'product', ...errOf(r) };
    product = r.body; out.product_created = true;
  } else if (product.description !== desc || product.name !== 'Gift to Welfare Avenue') {
    const r = await stripe(key, 'POST', '/v1/products/' + product.id, { name: 'Gift to Welfare Avenue', description: desc });
    if (!r.ok) return { ok: false, step: 'product update', ...errOf(r) };
    product = r.body; out.product_updated = true;
  }
  await setConfig('donate_product', product.id);
  out.product = product.id;
  // the webhook
  const hooks = await stripe(key, 'GET', '/v1/webhook_endpoints?limit=100');
  if (!hooks.ok) return { ok: false, step: 'webhooks', ...errOf(hooks) };
  // deno-lint-ignore no-explicit-any
  let hook = (hooks.body.data || []).find((h: any) => h.url === HOOK_URL);
  const vault = await svc.rpc('get_secret', { secret_name: 'STRIPE_WEBHOOK_SECRET' });
  const haveSecret = !vault.error && !!vault.data;
  if (hook && !haveSecret) {
    const d = await stripe(key, 'DELETE', '/v1/webhook_endpoints/' + hook.id);
    if (!d.ok) return { ok: false, step: 'replace webhook', ...errOf(d) };
    out.replaced = hook.id; hook = null;
  }
  if (!hook) {
    const r = await stripe(key, 'POST', '/v1/webhook_endpoints', { url: HOOK_URL, enabled_events: HOOK_EVENTS, api_version: STRIPE_VERSION,
      description: 'Welfare Avenue Hub: gifts from the donation page (stripe-events)', metadata: { wa_key: 'hub_webhook' } });
    if (!r.ok || !r.body || !r.body.secret) return { ok: false, step: 'webhook', ...errOf(r) };
    const saved = await svc.rpc('wa_vault_set', { p_name: 'STRIPE_WEBHOOK_SECRET', p_value: r.body.secret, p_note: 'Signing secret of the Stripe webhook ' + r.body.id + ' (stripe-admin setup, wave161)' });
    if (saved.error) {
      await stripe(key, 'DELETE', '/v1/webhook_endpoints/' + r.body.id);
      return { ok: false, step: 'vault', error: saved.error.message };
    }
    hook = { id: r.body.id, enabled_events: r.body.enabled_events, api_version: r.body.api_version, status: r.body.status };
    out.webhook_created = true;
  } else {
    // deno-lint-ignore no-explicit-any
    const missing = HOOK_EVENTS.filter(e => !(hook.enabled_events || []).includes(e));
    if (missing.length || hook.status !== 'enabled') {
      const u = await stripe(key, 'POST', '/v1/webhook_endpoints/' + hook.id, { enabled_events: HOOK_EVENTS, disabled: false });
      if (!u.ok) return { ok: false, step: 'update webhook', ...errOf(u) };
      out.webhook_updated = missing;
    }
  }
  await setConfig('donate_webhook', hook.id);
  return { ok: true, ...out, webhook: hook.id, events: HOOK_EVENTS.length, api_version: hook.api_version || STRIPE_VERSION, secret_in_vault: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const given = req.headers.get('x-wa-secret') || '';
  const sec = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
  if (!given || !sec.data || given !== sec.data) return json({ error: 'unauthorized' }, 401);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const action = String(body.action || 'check');

  const live = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const test = Deno.env.get('STRIPE_TEST_SECRET_KEY') || '';
  if (!live) return json({ ok: false, live_key: keyShape(live), error: 'STRIPE_SECRET_KEY is not set' });
  const key = live.trim();

  try {
    if (action === 'setup') return json(await setup(key));
    if (action === 'expire') {
      const id = String(body.session_id || '');
      if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(id)) return json({ ok: false, error: 'session_id expected' }, 400);
      const r = await stripe(key, 'POST', '/v1/checkout/sessions/' + id + '/expire');
      return json({ ok: r.ok, status: r.body && r.body.status, ...(r.ok ? {} : errOf(r)) });
    }
    if (action !== 'check') return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e && (e as Error).message) || e).slice(0, 300) }, 500);
  }

  const out: Record<string, unknown> = { at: new Date().toISOString(), live_key: keyShape(live), test_key: keyShape(test) };
  const results = await Promise.all(CHECKS.map(async ([label, path, expected]) => {
    try {
      const r = await fetch('https://api.stripe.com' + path, { headers: { Authorization: 'Bearer ' + key, 'Stripe-Version': STRIPE_VERSION } });
      let err: string | null = null;
      if (!r.ok) { try { const j = await r.json(); err = (j && j.error && (j.error.code || j.error.type)) || null; } catch (_) { /* no body */ } }
      else { await r.body?.cancel(); }
      const allowed = r.ok;
      return { label, status: r.status, allowed, expected, as_expected: allowed === expected, error: err };
    } catch (e) {
      return { label, status: 0, allowed: false, expected, as_expected: false, error: String((e && (e as Error).message) || e).slice(0, 120) };
    }
  }));
  const money = await Promise.all(MONEY_OUT.map(async ([label, path, form]) => {
    try {
      const r = await fetch('https://api.stripe.com' + path, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Stripe-Version': STRIPE_VERSION, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      let err: string | null = null;
      try { const j = await r.json(); err = (j && j.error && (j.error.code || j.error.type)) || null; } catch (_) { /* no body */ }
      return { label, status: r.status, refused_for_permission: r.status === 403 && err === 'more_permissions_required', as_expected: r.status === 403, error: err };
    } catch (e) {
      return { label, status: 0, refused_for_permission: false, as_expected: false, error: String((e && (e as Error).message) || e).slice(0, 120) };
    }
  }));
  const vault = await svc.rpc('get_secret', { secret_name: 'STRIPE_WEBHOOK_SECRET' });
  const cfg = await svc.from('app_config').select('key,value').in('key', ['donate_product', 'donate_webhook', 'donate_mode']);
  const wrong = [...results, ...money].filter(x => !x.as_expected).map(x => x.label);
  return json({ ok: wrong.length === 0, ...out, wrong, results, money_out: money, webhook_secret_in_vault: !vault.error && !!vault.data,
    // deno-lint-ignore no-explicit-any
    config: Object.fromEntries(((cfg.data || []) as any[]).map(r => [r.key, r.value])) });
});
