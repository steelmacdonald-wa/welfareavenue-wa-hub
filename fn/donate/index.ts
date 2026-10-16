// Welfare Avenue: donate (v5, 15/10/26, the Holiday Gift Basket Drive page; v4 29/09/26, wave162b; v3 28/09/26, wave161b)
// v5: campaigns. app_config donate_campaigns (JSON keyed by a slug, admins only) names the campaigns a link may ask for:
//   hub.welfareavenue.com/give/?c=<slug> (the website's campaign buttons pass data-wa-campaign through give/embed.js).
//   GET ?c=<slug> adds campaign {slug, designation, designation_fr, title, title_fr, intro, intro_fr, photo, monthly} when
//   that campaign exists and is open; the page then locks where the gift goes. POST checkout with campaign <slug>: the
//   designation is the campaign's (even when it is not in donate_designations), a campaign with monthly false takes one-time
//   gifts only, and the session's metadata carries wa_campaign (the campaign's name, which crm_stripe_gift records in
//   crm_donations.campaign; www_campaign_totals sums it for the page's progress) and wa_campaign_slug. An unknown or closed
//   campaign is ignored and the gift goes through as before, so a stale link never stops a gift. Nothing else changed:
//   a request without a campaign behaves exactly as v4.
// v4: French. The page sends lang 'fr' (hub.welfareavenue.com/give/?lang=fr: the French website's buttons and popup ask
//   for it). GET adds fr: the page's words in French (the donate_*_fr settings, or the defaults below until an admin sets
//   them; a note left empty in English stays empty in French), with where the gift goes as French labels in the same order.
//   A French checkout records the consent with the French words, opens Stripe in Canadian French (locale fr-CA) and
//   comes back to the French thank-you; the thank-you answer says the gift's language and carries the French notes.
//   The donor's choices are still checked against the English list (a French label is turned back into it).
// The public side of the Hub's donation page, shown at hub.welfareavenue.com/give.
//   GET   The page's settings (the title and words, the amounts for once and monthly, the minimum and maximum, where the
//         gift can go, the card-fee option, the news box and its words, the receipt and monthly notes, the charity's name,
//         number and address) and a signed token. While the page is off (app_config donate_mode) mode is 'off': the page
//         says giving online opens soon, and ?preview=1 shows it to the team without taking a gift. v3: pay is 'embedded'
//         with stripe_pk (the publishable key, which is public by design) when STRIPE_PUBLISHABLE_KEY is set and matches the
//         secret key's mode, so the page shows Stripe's form in place; otherwise pay is 'redirect' (Stripe's own page).
//   POST {action: 'checkout', token, hp, frequency, amount, designation, tribute_kind, tribute_name, consent, fee_cover, lang, ui}
//         The forms' built-in checks (the hidden field hp empty, the token 3 seconds to 24 hours old; spam is kept and
//         answered without a link, so a bot learns nothing), at most 10 checkouts per network address in 10 minutes and 300
//         an hour in all, the choices checked against the settings, then a Stripe Checkout session: one-time (payment,
//         Donate button) or monthly (subscription), in Canadian dollars only (no other currency offered), the billing
//         address required (a receipt needs it),
//         the card fee added only when asked and worked out here (never taken from the page), the donor's choices in the
//         session's metadata (wa_source hub-donate is how stripe-events knows the gift is the page's). Answers {url}, or with
//         ui 'embedded' (v3, when the publishable key is set) an embedded session: {client_secret}, which the page mounts
//         with Stripe.js; Stripe then sends the donor to /give/thanks on the same site (return_url).
//   POST {action: 'thanks', session_id}  What the thank-you view shows: complete, paid or waiting (a bank debit), once or
//         monthly, the amount, the first name, and the page's thank-you, receipt and monthly notes. A session the page did
//         not make is not found.
// Tests: x-wa-secret (WA_TRIGGER_SECRET) with {"test": true} may make a session while the page is off (kept as test in
//   crm_donate_attempts); {"checks": true} runs the spam checks as for the public; {"action": "token", "age": n} gives a token;
//   {"ui": "embedded"} makes an embedded session even before the publishable key is set (v3).
// Auth: verify_jwt on with the publishable key, which the page sends like every page of the Hub. Stripe: the restricted key
//   STRIPE_SECRET_KEY and the publishable key STRIPE_PUBLISHABLE_KEY (Edge Function secrets Steel adds), Stripe-Version pinned
//   (2024-06-20, where the embedded mode is ui_mode 'embedded'; Stripe.js v3 on the page matches it). Vault: WA_FORM_SECRET
//   signs the tokens and keys the network address hash (never the address itself). Tables: app_config (read),
//   crm_donate_attempts (write).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SITE = 'https://hub.welfareavenue.com';
const STRIPE_VERSION = '2024-06-20';
const ORIGINS = ['https://hub.welfareavenue.com', 'https://welfareavenue.com', 'https://www.welfareavenue.com', 'https://wa-exec-dashboard.netlify.app'];
const MIN_SECONDS = 3, MAX_AGE = 86400, PER_IP = 10, PER_IP_WINDOW = 10, PER_HOUR = 300, MAX_BODY = 8000;
const KEYS = ['donate_mode', 'donate_title', 'donate_intro', 'donate_amounts_once', 'donate_amounts_monthly', 'donate_min', 'donate_max', 'donate_designations',
  'donate_fee_cover', 'donate_fee_percent', 'donate_fee_fixed', 'donate_consent_label', 'donate_thanks', 'donate_receipt_note', 'donate_monthly_note', 'donate_product',
  'mail_from_name', 'mail_postal_address', 'mail_reply_to', 'mail_charity_number',
  'donate_title_fr', 'donate_intro_fr', 'donate_designations_fr', 'donate_consent_label_fr', 'donate_thanks_fr', 'donate_receipt_note_fr', 'donate_monthly_note_fr',
  'donate_campaigns'];
// v4: the French words until an admin sets the donate_*_fr settings (translations of the English settings of 28/09/26)
const FR: Record<string, string> = {
  title: 'Donner à Welfare Avenue',
  intro: 'Chaque don permet à nos bénévoles étudiants de continuer à servir nos communautés à Montréal et à Toronto. Donnez une fois, ou chaque mois pour un appui constant.',
  consent_label: 'Oui, envoyez-moi par courriel des nouvelles et des histoires de Welfare Avenue. Je peux me désabonner en tout temps.',
  thanks: 'Merci d’être aux côtés de Welfare Avenue et des bénévoles qui le font vivre.',
  receipt_note: 'Welfare Avenue est un organisme de bienfaisance enregistré au Canada ({charity}). Les dons admissibles donnent droit à un reçu officiel aux fins de l’impôt sur le revenu.',
  monthly_note: 'Vous pouvez modifier ou arrêter votre don mensuel en tout temps\u00a0: écrivez à {email}.'
};
const FR_DESIGNATIONS: Record<string, string> = { 'Where it is needed most': 'Là où les besoins sont les plus grands' };

// deno-lint-ignore no-explicit-any
type Json = any;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Max-Age': '86400' };
}
function reply(req: Request, body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
}
const secrets: Record<string, string> = {};
async function secret(name: string): Promise<string> {
  if (secrets[name]) return secrets[name];
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  secrets[name] = String(data);
  return secrets[name];
}
async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
}
function same(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function clientIp(req: Request): string {
  return (req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || req.headers.get('x-real-ip') || '').trim();
}

// ---------- Stripe (form-encoded, the version pinned) ----------
function formEncode(obj: Json, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (Array.isArray(v)) v.forEach((x, i) => { if (x !== null && typeof x === 'object') formEncode(x, key + '[' + i + ']', out); else out.push(encodeURIComponent(key + '[' + i + ']') + '=' + encodeURIComponent(String(x))); });
    else if (typeof v === 'object') formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
async function stripe(method: string, path: string, params?: Json, idem?: string): Promise<{ status: number; ok: boolean; body: Json }> {
  const key = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
  if (!key) return { status: 500, ok: false, body: { error: { message: 'STRIPE_SECRET_KEY is not set' } } };
  const headers: Record<string, string> = { Authorization: 'Bearer ' + key, 'Stripe-Version': STRIPE_VERSION };
  let body: string | undefined;
  if (params) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = formEncode(params).join('&'); }
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch('https://api.stripe.com' + path, { method, headers, body });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, body: j };
}

function keyMode(k: string): string { return /^(sk|rk|pk)_live_/.test(k) ? 'live' : /^(sk|rk|pk)_test_/.test(k) ? 'test' : ''; }
// the publishable key for Stripe.js on the page: only a pk_ key, and only in the secret key's mode (a live session cannot be
// shown with a test key); anything else means the page sends donors to Stripe's own page as before
function publishable(): string {
  const pk = (Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '').trim();
  const sk = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
  if (!/^pk_(live|test)_[A-Za-z0-9]{10,250}$/.test(pk) || !keyMode(sk) || keyMode(pk) !== keyMode(sk)) return '';
  return pk;
}

// ---------- the page's settings ----------
async function settings(): Promise<Record<string, string>> {
  const { data, error } = await svc.from('app_config').select('key,value').in('key', KEYS);
  if (error) throw new Error('settings: ' + error.message);
  const m: Record<string, string> = {};
  (data || []).forEach((r: Json) => { m[r.key] = r.value == null ? '' : String(r.value); });
  return m;
}
function amounts(s: string): number[] { return String(s || '').split(/[,\s]+/).map(Number).filter(n => isFinite(n) && n > 0 && n <= 100000).slice(0, 6); }
function lines(s: string): string[] { return String(s || '').split(/\n/).map(x => x.trim()).filter(Boolean).map(x => x.slice(0, 80)).slice(0, 12); }
function fill(t: string, m: Record<string, string>): string {
  return String(t || '').replace(/\{charity\}/g, m.mail_charity_number || '').replace(/\{email\}/g, m.mail_reply_to || 'info@welfareavenue.com');
}
function num(s: string, dflt: number): number { const n = Number(s); return isFinite(n) && String(s).trim() !== '' ? n : dflt; }
// what to add so that, after the card fee (a percentage of the total plus a fixed amount), the whole gift reaches Welfare Avenue
function feeCents(base: number, pct: number, fixed: number): number {
  if (!(pct >= 0 && pct < 20) || !(fixed >= 0 && fixed < 5)) return 0;
  return Math.max(0, Math.ceil((base + Math.round(fixed * 100)) / (1 - pct / 100) - base));
}
function publicConfig(m: Record<string, string>): Json {
  const des = lines(m.donate_designations);
  const desFr = lines(m.donate_designations_fr);
  const both = (en: string, fr: string, dflt: string) => (String(en || '').trim() ? (fr || dflt) : ''); // empty in English: empty in French
  return {
    mode: m.donate_mode === 'live' ? 'live' : 'off',
    title: m.donate_title || 'Give to Welfare Avenue', intro: m.donate_intro || '',
    amounts: { once: amounts(m.donate_amounts_once).length ? amounts(m.donate_amounts_once) : [25, 50, 100, 250], monthly: amounts(m.donate_amounts_monthly).length ? amounts(m.donate_amounts_monthly) : [10, 20, 35, 50] },
    min: num(m.donate_min, 5), max: num(m.donate_max, 10000),
    designations: des.length ? des : ['Where it is needed most'],
    fee: { on: m.donate_fee_cover !== 'off', percent: num(m.donate_fee_percent, 2.9), fixed: num(m.donate_fee_fixed, 0.3) },
    consent_label: m.donate_consent_label || 'Yes, send me news and stories from Welfare Avenue by email. I can unsubscribe at any time.',
    thanks: m.donate_thanks || '', receipt_note: fill(m.donate_receipt_note, m), monthly_note: fill(m.donate_monthly_note, m),
    org: { name: m.mail_from_name || 'Welfare Avenue', address: m.mail_postal_address || '', email: m.mail_reply_to || 'info@welfareavenue.com', charity: m.mail_charity_number || '' },
    fr: {
      title: m.donate_title_fr || FR.title, intro: both(m.donate_intro, m.donate_intro_fr, FR.intro),
      designations: (des.length ? des : ['Where it is needed most']).map((d, i) => desFr[i] || FR_DESIGNATIONS[d] || d),
      consent_label: m.donate_consent_label_fr || FR.consent_label, thanks: both(m.donate_thanks, m.donate_thanks_fr, FR.thanks),
      receipt_note: fill(both(m.donate_receipt_note, m.donate_receipt_note_fr, FR.receipt_note), m), monthly_note: fill(both(m.donate_monthly_note, m.donate_monthly_note_fr, FR.monthly_note), m)
    }
  };
}

// v5: a campaign the link asked for (app_config donate_campaigns), or null when it is unknown, closed or badly set
function campaignFor(m: Record<string, string>, slug: unknown): Json {
  const k = String(slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(k)) return null;
  let all: Json = null;
  try { all = JSON.parse(m.donate_campaigns || '{}'); } catch (_) { return null; }
  const c = all && typeof all === 'object' ? all[k] : null;
  if (!c || typeof c !== 'object' || c.open === false) return null;
  const name = String(c.name || '').trim().slice(0, 120), des = String(c.designation || '').trim().slice(0, 80);
  if (!name || !des) return null;
  const str = (x: unknown, n: number) => String(x == null ? '' : x).trim().slice(0, n);
  const photo = str(c.photo, 400);
  return { slug: k, name, designation: des, designation_fr: str(c.designation_fr, 80) || des, title: str(c.title, 120), title_fr: str(c.title_fr, 120),
    intro: str(c.intro, 400), intro_fr: str(c.intro_fr, 400), monthly: c.monthly === true,
    photo: /^https:\/\/zwnmulmnvopclzcvytce\.supabase\.co\//.test(photo) ? photo : '' };
}
function publicCampaign(c: Json): Json {
  if (!c) return undefined;
  return { slug: c.slug, designation: c.designation, designation_fr: c.designation_fr, title: c.title, title_fr: c.title_fr, intro: c.intro, intro_fr: c.intro_fr, monthly: c.monthly, photo: c.photo || undefined };
}

// ---------- the donor's choices against the settings ----------
function check(cfg: Json, body: Json, camp: Json = null) {
  const errors: Record<string, string> = {};
  const fr = body.lang === 'fr';
  const freq = body.frequency === 'monthly' ? 'monthly' : body.frequency === 'once' ? 'once' : '';
  if (!freq) errors.frequency = fr ? 'Choisissez une fois ou chaque mois.' : 'Choose once or monthly.';
  else if (camp && !camp.monthly && freq === 'monthly') errors.frequency = fr ? 'Ce don se fait une seule fois.' : 'This gift is a one-time gift.';
  const amt = Number(body.amount), base = Math.round(amt * 100);
  if (!isFinite(amt) || Math.abs(amt * 100 - base) > 0.001) errors.amount = fr ? 'Entrez un montant en dollars et en cents.' : 'Enter an amount in dollars and cents.';
  else if (base < Math.round(cfg.min * 100)) errors.amount = fr ? 'Le don minimum en ligne est de ' + cfg.min + '\u00a0$.' : 'The smallest gift online is $' + cfg.min + '.';
  else if (base > Math.round(cfg.max * 100)) errors.amount = fr ? 'Pour un don de plus de ' + cfg.max + '\u00a0$, veuillez écrire à ' + cfg.org.email + '.' : 'For a gift above $' + cfg.max + ', please write to ' + cfg.org.email + '.';
  let designation = String(body.designation || '').trim();
  if (!designation) designation = cfg.designations[0];
  if (!cfg.designations.includes(designation) && cfg.fr && cfg.fr.designations.indexOf(designation) >= 0) designation = cfg.designations[cfg.fr.designations.indexOf(designation)];
  if (camp) designation = camp.designation; /* v5: a campaign's gift goes where the campaign says, whatever the page sent */
  else if (!cfg.designations.includes(designation)) errors.designation = fr ? 'Choisissez où va votre don.' : 'Choose where your gift goes.';
  const tk = body.tribute_kind === 'honour' || body.tribute_kind === 'memory' ? body.tribute_kind : '';
  const tn = tk ? String(body.tribute_name || '').trim().replace(/\s+/g, ' ') : '';
  if (tk && !tn) errors.tribute_name = fr ? 'Quel nom devons-nous inscrire\u00a0?' : 'Whose name should we record?';
  if (tn.length > 120) errors.tribute_name = fr ? 'Ce nom est trop long.' : 'That name is too long.';
  const cover = body.fee_cover === true && cfg.fee.on ? feeCents(base, cfg.fee.percent, cfg.fee.fixed) : 0;
  return { errors, freq, base, cover, total: base + cover, designation, tk, tn, consent: body.consent === true, lang: body.lang === 'fr' ? 'fr' : 'en' };
}

async function attempt(row: Json) { try { await svc.from('crm_donate_attempts').insert(row); } catch (_) { /* the log never stops a gift */ } }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method === 'GET') {
      const m = await settings();
      const ts = Math.floor(Date.now() / 1000);
      const token = ts + '.' + (await hmac(await secret('WA_FORM_SECRET'), 'donate|' + ts)).slice(0, 32);
      const pk = publishable();
      const camp = campaignFor(m, new URL(req.url).searchParams.get('c'));
      return reply(req, { ...publicConfig(m), token, pay: pk ? 'embedded' : 'redirect', stripe_pk: pk || undefined, campaign: publicCampaign(camp) });
    }
    if (req.method !== 'POST') return reply(req, { error: 'method' }, 405);
    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(req, { error: 'too_large' }, 413);
    let body: Json; try { body = JSON.parse(raw); } catch (_) { return reply(req, { error: 'bad_json' }, 400); }
    const given = req.headers.get('x-wa-secret') || '';
    const isTest = body.test === true && !!given && same(given, await secret('WA_TRIGGER_SECRET'));
    const m = await settings();
    const cfg = publicConfig(m);

    if (body.action === 'thanks') {
      const id = String(body.session_id || '');
      if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(id)) return reply(req, { error: 'not_found' }, 404);
      const r = await stripe('GET', '/v1/checkout/sessions/' + id);
      const o = r.body || {};
      if (!r.ok || !o.metadata || o.metadata.wa_source !== 'hub-donate') return reply(req, { error: 'not_found' }, 404);
      const monthly = o.mode === 'subscription';
      return reply(req, {
        ok: true, complete: o.status === 'complete', paid: o.payment_status === 'paid' || (monthly && o.status === 'complete'),
        waiting: o.status === 'complete' && o.payment_status === 'unpaid', frequency: monthly ? 'monthly' : 'once',
        amount: (Number(o.amount_total) || 0) / 100, currency: String(o.currency || 'cad').toUpperCase(),
        first_name: String((o.customer_details && o.customer_details.name) || '').trim().split(/\s+/)[0] || '',
        designation: o.metadata.wa_designation || '', thanks: cfg.thanks, receipt_note: cfg.receipt_note, monthly_note: cfg.monthly_note, org: cfg.org,
        lang: o.metadata.wa_lang === 'fr' ? 'fr' : 'en', fr: { thanks: cfg.fr.thanks, receipt_note: cfg.fr.receipt_note, monthly_note: cfg.fr.monthly_note }
      });
    }

    if (body.action === 'token' && isTest) {
      const ts = Math.floor(Date.now() / 1000) - Math.max(0, Math.min(MAX_AGE + 60, Number(body.age) || 0));
      return reply(req, { token: ts + '.' + (await hmac(await secret('WA_FORM_SECRET'), 'donate|' + ts)).slice(0, 32) });
    }
    if (body.action !== 'checkout') return reply(req, { error: 'unknown_action' }, 400);

    const fsec = await secret('WA_FORM_SECRET');
    const ip = clientIp(req);
    const ipHash = ip ? (await hmac(fsec, 'ip|' + ip)).slice(0, 24) : null;
    const ua = (req.headers.get('user-agent') || '').slice(0, 200);
    const checks = !isTest || body.checks === true;
    const base = { ip_hash: ipHash, user_agent: ua, is_test: isTest };

    if (cfg.mode !== 'live' && !isTest) {
      await attempt({ ...base, status: 'refused', error: 'the page is off' });
      return reply(req, { error: 'off' }, 403);
    }
    if (checks) {
      const tok = String(body.token || ''); const [tsStr, sig] = tok.split('.');
      const ts = Number(tsStr), age = Math.floor(Date.now() / 1000) - ts;
      const sigOk = !!sig && isFinite(ts) && same(sig, (await hmac(fsec, 'donate|' + ts)).slice(0, 32));
      if (sigOk && age > MAX_AGE) return reply(req, { error: 'expired' }, 400);
      const spam = (body.hp != null && String(body.hp).trim() !== '') ? 'hidden field filled' : !sigOk ? 'bad token' : age < MIN_SECONDS ? 'sent too fast (' + age + ' s)' : '';
      if (spam) {
        await attempt({ ...base, status: 'spam', error: spam });
        return reply(req, isTest ? { ok: true, spam } : { ok: true });
      }
      const since = new Date(Date.now() - PER_IP_WINDOW * 60000).toISOString();
      if (ipHash) {
        const { count } = await svc.from('crm_donate_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
        if ((count || 0) >= PER_IP) { await attempt({ ...base, status: 'refused', error: 'too many from one address' }); return reply(req, { error: 'rate' }, 429); }
      }
      const hour = new Date(Date.now() - 3600000).toISOString();
      const { count: all } = await svc.from('crm_donate_attempts').select('id', { count: 'exact', head: true }).gte('created_at', hour);
      if ((all || 0) >= PER_HOUR) { await attempt({ ...base, status: 'refused', error: 'too many in an hour' }); return reply(req, { error: 'rate' }, 429); }
    }

    const camp = campaignFor(m, body.campaign);
    const c = check(cfg, body, camp);
    if (Object.keys(c.errors).length) return reply(req, { error: 'invalid', fields: c.errors }, 400);
    // v3: Stripe's form inside the page when it asks for it and the publishable key is there; Stripe's own page otherwise
    // (a test with the trigger secret may ask for one before the publishable key exists, to check Stripe accepts the session)
    const embedded = body.ui === 'embedded' && (!!publishable() || isTest);

    const meta: Record<string, string> = {
      wa_source: 'hub-donate', wa_frequency: c.freq, wa_designation: c.designation, wa_tribute_kind: c.tk, wa_tribute_name: c.tn,
      wa_consent: c.consent ? 'yes' : 'no', wa_consent_label: c.consent ? String(c.lang === 'fr' ? cfg.fr.consent_label : cfg.consent_label).slice(0, 480) : '',
      wa_base_cents: String(c.base), wa_fee_cover_cents: String(c.cover), wa_lang: c.lang, wa_page: 'give v2 ' + (embedded ? 'embedded' : 'hosted') + (isTest ? ' test' : '')
    };
    if (camp) { meta.wa_campaign = camp.name; meta.wa_campaign_slug = camp.slug; } /* v5 */
    const product = (m.donate_product || '').trim();
    const price: Json = { currency: 'cad', unit_amount: c.total };
    if (product) price.product = product; else price.product_data = { name: 'Gift to Welfare Avenue' };
    const params: Json = {
      mode: c.freq === 'monthly' ? 'subscription' : 'payment',
      line_items: [{ quantity: 1, price_data: c.freq === 'monthly' ? { ...price, recurring: { interval: 'month' } } : price }],
      billing_address_collection: 'required',
      locale: c.lang === 'fr' ? 'fr-CA' : 'auto',
      // the gift stays in Canadian dollars (a receipt is in dollars): no offer to pay in another currency
      adaptive_pricing: { enabled: false },
      metadata: meta,
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
    const lq = (c.lang === 'fr' ? '&lang=fr' : '') + (camp ? '&c=' + encodeURIComponent(camp.slug) : '');
    if (embedded) { params.ui_mode = 'embedded'; params.return_url = SITE + '/give/thanks?session_id={CHECKOUT_SESSION_ID}' + lq; }
    else { params.success_url = SITE + '/give/thanks?session_id={CHECKOUT_SESSION_ID}' + lq; params.cancel_url = SITE + '/give?cancelled=1' + lq; }
    if (c.freq === 'monthly') params.subscription_data = { metadata: meta, description: 'Monthly gift to Welfare Avenue' };
    else { params.submit_type = 'donate'; params.customer_creation = 'always'; params.payment_intent_data = { metadata: meta, description: camp ? 'Gift to Welfare Avenue: ' + camp.designation : 'Gift to Welfare Avenue' }; }

    const r = await stripe('POST', '/v1/checkout/sessions', params, 'wa-give-' + crypto.randomUUID());
    if (!r.ok || !r.body || !(embedded ? r.body.client_secret : r.body.url)) {
      const e = r.body && r.body.error ? (r.body.error.code || r.body.error.type || '') + ': ' + String(r.body.error.message || '').slice(0, 200) : 'status ' + r.status;
      await attempt({ ...base, status: 'error', frequency: c.freq, amount_cents: c.total, error: e });
      return reply(req, isTest ? { error: 'stripe', detail: e } : { error: 'stripe' }, 502);
    }
    await attempt({ ...base, status: isTest ? 'test' : 'session', frequency: c.freq, amount_cents: c.total, session_id: r.body.id });
    const out: Json = embedded ? { client_secret: r.body.client_secret } : { url: r.body.url };
    return reply(req, isTest ? { ...out, session_id: r.body.id, ui_mode: r.body.ui_mode, total_cents: c.total, cover_cents: c.cover, designation: c.designation, campaign: camp ? camp.name : null } : out);
  } catch (e) {
    return reply(req, { error: 'server', detail: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
