// Welfare Avenue: site-account (v3, 02/10/26, wave194, wave195 and wave195b; v2: a test recipient's plus address counts in test
// mode; v3: the team and the board have website accounts too, Steel 02/10/26)
// The server side of the accounts on welfareavenue.com (the page at /account and /fr/compte). Steel, 02/10/26: people sign
// in with Google or with a code we email them (no passwords); the profile reads through the account_* database functions;
// volunteers can download their signed letters and receipts and upload their own form to be signed.
//   GET  ?action=token                      -> a signed token for the sign-in form (the spam check: 2 seconds to 1 hour old when used)
//   POST {action: 'code', email, lang, token, hp, next?}
//        -> emails a one-time sign-in code and a sign-in link (Resend, from the Hub's mail settings) and answers {ok: true}
//           whether or not the address is known. Refused: accounts off (site_accounts_mode); in test mode anyone but the
//           test recipients (or their plus addresses); more than 3 codes an hour or 8 a day for one address, 10 an hour
//           from one place (IP hash), 60 a day in all. Since v3 a team or board address gets a code like anyone else. Every try is kept in
//           site_account_emails (the address, an IP hash, what happened). The link opens /account/?t=<token hash>&k=<type>,
//           where the page exchanges it at /auth/v1/verify, so no redirect address is needed in the Auth settings.
//   POST {action: 'file', kind: 'signoff' | 'receipt', id}   (the person's own sign-in)
//        -> a 60-second link to their own signed letter or official receipt PDF (account_file_path decides what is theirs)
//   POST {action: 'upload', name, type, bytes}   (the person's own sign-in; a volunteer record)
//        -> a signed upload address in the private bucket signoffs at requests/<their account>/<random>.<pdf|png|jpg>
//           (PDF, PNG or JPEG, at most 10 MB, at most 10 uploads kept per account)
//   POST {action: 'code', ..., dry: true} with x-wa-secret (WA_TRIGGER_SECRET): runs every check and answers what would happen;
//        no account is made and nothing is sent.
// Auth: verify_jwt on. The code action takes the publishable key; file and upload take the person's own session, read with
// auth.getUser. A volunteer's or a supporter's session carries the wa_volunteer claim (wa175_access_token_hook); a team or
// board member's is their own sign-in (the Hub itself stays theirs alone). Either way the database functions only ever
// touch the signed-in person's own record. Secrets: WA_FORM_SECRET (vault) signs the token and keys the IP hash;
// RESEND_API_KEY (function secret, or the vault) sends; WA_TRIGGER_SECRET for the dry run.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ORIGINS = ['https://welfareavenue.com', 'https://www.welfareavenue.com', 'https://welfareavenue-www.netlify.app'];
const SITE = 'https://welfareavenue.com';
const LOCKUP_CREAM = SUPABASE_URL + '/storage/v1/object/public/content-images/brand/logo-lockup-cream-600.png';
const LIMIT = { emailHour: 3, emailDay: 8, ipHour: 10, day: 60 };
const MAX_UPLOAD = 10 * 1024 * 1024, MAX_KEPT = 10;
const TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

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
  const env = name === 'RESEND_API_KEY' ? Deno.env.get('RESEND_API_KEY') : null;
  if (env) { secrets[name] = env; return env; }
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
function esc(s: string): string { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]); }
async function config(keys: string[]): Promise<Record<string, string>> {
  const { data } = await svc.from('app_config').select('key,value').in('key', keys);
  const m: Record<string, string> = {}; (data || []).forEach((r: Json) => { m[r.key] = r.value; });
  return m;
}
async function userFrom(req: Request): Promise<Json> {
  const h = req.headers.get('authorization') || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}
async function count(q: Json): Promise<number> { const { count: n } = await q; return n || 0; }

// ---------- the sign-in email ----------
function codeEmail(lang: string, code: string, link: string, org: Record<string, string>) {
  const fr = lang === 'fr';
  const spaced = code.split('').join(' ');
  const subject = fr ? 'Votre code de connexion Welfare Avenue : ' + code : 'Your Welfare Avenue sign-in code: ' + code;
  const lines = fr
    ? { hi: 'Bonjour,', lead: 'Voici votre code pour vous connecter à votre compte Welfare Avenue :', or: 'Ou touchez le bouton pour vous connecter sur cet appareil :', btn: 'Me connecter',
        note: 'Le code et le bouton fonctionnent une seule fois, pendant une heure. Si vous n’avez rien demandé, ignorez ce courriel : personne ne peut se connecter sans lui.', foot: 'Organisme de bienfaisance enregistré' }
    : { hi: 'Hi,', lead: 'Here is your code to sign in to your Welfare Avenue account:', or: 'Or tap the button to sign in on this device:', btn: 'Sign me in',
        note: 'The code and the button work once, for one hour. If you did not ask for this, you can ignore this email: nobody can sign in without it.', foot: 'Registered charity' };
  const address = org.mail_postal_address || 'Welfare Avenue, Montreal QC';
  const charity = org.mail_charity_number ? lines.foot + ' ' + org.mail_charity_number : '';
  const html = '<!doctype html><html lang="' + (fr ? 'fr' : 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#FFFAF2;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFAF2;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece6da;">' +
    '<tr><td style="background:#103F39;padding:22px 32px 18px 32px;"><img src="' + LOCKUP_CREAM + '" width="170" alt="Welfare Avenue" style="display:block;border:0;width:170px;height:auto;"></td></tr>' +
    '<tr><td style="padding:28px 32px 8px 32px;font-family:\'Space Grotesk\',Helvetica,Arial,sans-serif;color:#1F201E;font-size:16px;line-height:24px;">' +
    '<p style="margin:0 0 12px 0;">' + esc(lines.hi) + '</p><p style="margin:0 0 18px 0;">' + esc(lines.lead) + '</p>' +
    '<p style="margin:0 0 22px 0;font-family:\'Barlow Condensed\',\'Arial Narrow\',Arial,sans-serif;font-size:40px;line-height:44px;font-weight:600;letter-spacing:6px;color:#103F39;">' + esc(spaced) + '</p>' +
    '<p style="margin:0 0 14px 0;">' + esc(lines.or) + '</p>' +
    '<p style="margin:0 0 24px 0;"><a href="' + esc(link) + '" style="display:inline-block;background:#103F39;color:#FFFAF2;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:2px;">' + esc(lines.btn) + ' &rarr;</a></p>' +
    '<p style="margin:0 0 22px 0;font-size:13px;line-height:20px;color:#797773;">' + esc(lines.note) + '</p></td></tr>' +
    '<tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #ece6da;font-family:\'Space Grotesk\',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#797773;">' +
    esc(address) + (charity ? '<br>' + esc(charity) : '') + '<br><a href="' + SITE + '" style="color:#103F39;">welfareavenue.com</a></td></tr>' +
    '</table></td></tr></table></body></html>';
  const text = lines.hi + '\n\n' + lines.lead + '\n\n    ' + code + '\n\n' + lines.or + '\n' + link + '\n\n' + lines.note + '\n\n' + address + (charity ? '\n' + charity : '') + '\n' + SITE;
  return { subject, html, text };
}

async function makeLink(email: string, lang: string): Promise<{ otp: string; hash: string; type: string }> {
  let r = await svc.auth.admin.generateLink({ type: 'magiclink', email });
  if (r.error) {
    // a new person: make the (unconfirmed) account, then the link; the code confirms the address
    const made = await svc.auth.admin.createUser({ email, email_confirm: false, user_metadata: { lang, source: 'welfareavenue.com' } });
    if (made.error && !/already|registered|exists/i.test(made.error.message)) throw new Error('create: ' + made.error.message);
    r = await svc.auth.admin.generateLink({ type: 'magiclink', email });
    if (r.error) throw new Error('link: ' + r.error.message);
  }
  const p = (r.data as Json).properties || {};
  return { otp: String(p.email_otp || ''), hash: String(p.hashed_token || ''), type: String(p.verification_type || 'magiclink') };
}

async function sendCode(req: Request, body: Json): Promise<Response> {
  const email = String(body.email || '').trim().toLowerCase();
  const lang = body.lang === 'fr' ? 'fr' : 'en';
  const fsec = await secret('WA_FORM_SECRET');
  const ip = clientIp(req);
  const ipHash = ip ? (await hmac(fsec, 'ip|' + ip)).slice(0, 24) : null;
  const given = req.headers.get('x-wa-secret') || '';
  const dry = body.dry === true && !!given && same(given, await secret('WA_TRIGGER_SECRET'));
  const log = async (status: string, reason: string | null, resendId: string | null = null) => {
    if (dry) return;
    await svc.from('site_account_emails').insert({ email: email.slice(0, 200) || '(none)', ip_hash: ipHash, lang, status, reason, resend_id: resendId });
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return reply(req, { error: 'email' }, 400);
  // the spam checks: the hidden field, then the token's signature and age
  if (body.hp != null && String(body.hp).trim() !== '') { await log('refused', 'hidden field filled'); return reply(req, { ok: true }); }
  const [tsStr, sig] = String(body.token || '').split('.');
  const ts = Number(tsStr), age = Math.floor(Date.now() / 1000) - ts;
  const sigOk = !!sig && isFinite(ts) && same(sig, (await hmac(fsec, 'account|' + ts)).slice(0, 32));
  if (!dry && (!sigOk || age < 2 || age > 3600)) { await log('refused', !sigOk ? 'bad token' : age < 2 ? 'too fast' : 'token too old'); return reply(req, { error: sigOk ? 'expired' : 'token' }, 400); }

  const cfg = await config(['site_accounts_mode', 'mail_test_recipients', 'mail_from_name', 'mail_from_email', 'mail_reply_to', 'mail_postal_address', 'mail_charity_number']);
  const mode = cfg.site_accounts_mode || 'off';
  if (mode === 'off') { await log('refused', 'accounts off'); return reply(req, { error: 'off' }, 403); }
  // v2 (02/10/26): in test mode a test recipient's plus address counts too (name+wa@gmail.com reaches name@gmail.com), so a
  // tester whose own address is on the team can still try a website account
  const testers = String(cfg.mail_test_recipients || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  if (mode === 'test' && !testers.includes(email) && !testers.includes(email.replace(/\+[^@]*@/, '@'))) { await log('refused', 'test mode: not a test recipient'); return reply(req, { error: 'test' }, 403); }

  // the limits
  const hour = new Date(Date.now() - 3600e3).toISOString(), day = new Date(Date.now() - 86400e3).toISOString();
  const tbl = () => svc.from('site_account_emails').select('id', { count: 'exact', head: true }).in('status', ['sent', 'test']);
  if (await count(tbl().eq('email', email).gte('created_at', hour)) >= LIMIT.emailHour || await count(tbl().eq('email', email).gte('created_at', day)) >= LIMIT.emailDay) {
    await log('refused', 'too many codes for this address'); return reply(req, { error: 'rate' }, 429);
  }
  if (ipHash && await count(tbl().eq('ip_hash', ipHash).gte('created_at', hour)) >= LIMIT.ipHour) { await log('refused', 'too many codes from here'); return reply(req, { error: 'rate' }, 429); }
  if (await count(tbl().gte('created_at', day)) >= LIMIT.day) { await log('refused', 'daily cap'); return reply(req, { error: 'busy' }, 429); }

  if (dry) return reply(req, { ok: true, dry: true, mode, would: 'send', lang });

  let link: { otp: string; hash: string; type: string };
  try { link = await makeLink(email, lang); } catch (e) { await log('failed', String((e as Error).message).slice(0, 200)); return reply(req, { error: 'server' }, 500); }
  if (!link.otp || !link.hash) { await log('failed', 'no code from Auth'); return reply(req, { error: 'server' }, 500); }
  const next = typeof body.next === 'string' && /^\/[a-z0-9/_-]*$/i.test(body.next) && body.next.length < 80 ? body.next : '';
  const url = SITE + (lang === 'fr' ? '/fr/compte/' : '/account/') + '?t=' + encodeURIComponent(link.hash) + '&k=' + encodeURIComponent(link.type) + (next ? '&next=' + encodeURIComponent(next) : '');
  const msg = codeEmail(lang, link.otp, url, cfg);
  const key = await secret('RESEND_API_KEY').catch(() => '');
  if (!key) { await log('failed', 'no Resend key'); return reply(req, { error: 'server' }, 500); }
  const from = (cfg.mail_from_name || 'Welfare Avenue').replace(/[<>"\r\n]/g, '') + ' <' + (cfg.mail_from_email || 'info@welfareavenue.com') + '>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: msg.subject, html: msg.html, text: msg.text, reply_to: cfg.mail_reply_to || undefined, tags: [{ name: 'kind', value: 'sign_in_code' }] })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { await log('failed', 'Resend ' + res.status + ': ' + String(out.message || '').slice(0, 120)); return reply(req, { error: 'server' }, 502); }
  await log(mode === 'test' ? 'test' : 'sent', null, out.id || null);
  return reply(req, { ok: true });
}

async function fileLink(req: Request, body: Json): Promise<Response> {
  const user = await userFrom(req);
  if (!user) return reply(req, { error: 'signin' }, 401);
  const kind = body.kind === 'receipt' ? 'receipt' : body.kind === 'signoff' ? 'signoff' : '';
  const id = Number(body.id);
  if (!kind || !Number.isFinite(id)) return reply(req, { error: 'bad' }, 400);
  const { data, error } = await svc.rpc('account_file_path', { p_uid: user.id, p_kind: kind, p_id: id });
  if (error || !data) return reply(req, { error: 'not_found' }, 404);
  const f = data as Json;
  const { data: s, error: e2 } = await svc.storage.from(f.bucket).createSignedUrl(f.path, 60, { download: f.name });
  if (e2 || !s) return reply(req, { error: 'not_found' }, 404);
  return reply(req, { url: s.signedUrl, name: f.name });
}

async function uploadLink(req: Request, body: Json): Promise<Response> {
  const user = await userFrom(req);
  if (!user) return reply(req, { error: 'signin' }, 401);
  const type = String(body.type || '').toLowerCase(), bytes = Number(body.bytes);
  if (!TYPES[type]) return reply(req, { error: 'type' }, 400);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_UPLOAD) return reply(req, { error: 'size' }, 400);
  const { data: who } = await svc.rpc('account_person', { p_uid: user.id });
  const row = Array.isArray(who) ? who[0] : who;
  if (!row || !row.person_id) return reply(req, { error: 'not_volunteer' }, 403);
  const folder = 'requests/' + user.id;
  const { data: kept } = await svc.storage.from('signoffs').list(folder, { limit: 100 });
  if ((kept || []).length >= MAX_KEPT) return reply(req, { error: 'too_many' }, 429);
  const path = folder + '/' + crypto.randomUUID() + '.' + TYPES[type];
  const { data, error } = await svc.storage.from('signoffs').createSignedUploadUrl(path);
  if (error || !data) return reply(req, { error: 'server' }, 500);
  return reply(req, { path, url: data.signedUrl, token: data.token });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method === 'GET') {
      const action = new URL(req.url).searchParams.get('action') || '';
      if (action !== 'token') return reply(req, { error: 'action' }, 400);
      const ts = Math.floor(Date.now() / 1000);
      return reply(req, { token: ts + '.' + (await hmac(await secret('WA_FORM_SECRET'), 'account|' + ts)).slice(0, 32) });
    }
    if (req.method !== 'POST') return reply(req, { error: 'method' }, 405);
    const raw = await req.text();
    if (raw.length > 8000) return reply(req, { error: 'too_large' }, 413);
    let body: Json; try { body = JSON.parse(raw); } catch (_) { return reply(req, { error: 'bad_json' }, 400); }
    if (body.action === 'code') return await sendCode(req, body);
    if (body.action === 'file') return await fileLink(req, body);
    if (body.action === 'upload') return await uploadLink(req, body);
    return reply(req, { error: 'action' }, 400);
  } catch (e) {
    return reply(req, { error: 'server', detail: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
