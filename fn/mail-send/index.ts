// Welfare Avenue: mail-send (v2, 27/09/26 Toronto, wave155; v1.1 wave154: links styled before the button is built, footer line once)
// v2: campaigns (campaign_check, campaign_queue, campaign_pump, campaign_cancel, campaign_test), the volunteer kind,
//   a sender per campaign (any @domain address), a daily cap for Resend's free plan (mail_daily_cap, mail_campaign_daily_cap),
//   preview with subject, preheader and kind overrides, a test to the caller's own staff address.
// The CRM's email engine, on Resend. Sends one message to one contact from welfareavenue.com in the brand
// layout, after the CASL rule (crm_email_permission) says yes, and logs it in crm_email_sends and on the
// contact's timeline (crm_interactions, source resend). Also the setup the Email tab drives: the sending
// domain in Resend (the DNS records Steel adds at Namecheap), the webhook (its signing secret goes straight
// into the vault through wa_vault_set), the templates, the settings, a preview, a test send.
// Purpose: step 2 of the 27/09/26 plan (the email foundation). Trigger: the CRM's Email tab and a contact's
//   page (staff JWT), later the automations (x-wa-secret through call_edge).
// Auth: a staff JWT (@welfareavenue.com or Steel's gmail) with the CRM page (wa_page_ok('crm')), or
//   x-wa-secret (WA_TRIGGER_SECRET). Admin-only actions check get_my_role = admin (or the named admins).
// Modes: app_config mail_mode 'test' (default) lets mail go only to mail_test_recipients (Steel's addresses);
//   'live' lets it go to any contact the rule allows. Steel switches it in the Email tab: that is his OK.
// Actions (POST {action, ...}):
//   settings            -> the mail_* settings, whether the Resend key resolves, the domain and its records, the webhook
//   domain_setup        -> create welfareavenue.com in Resend (or read it) and return the DNS records     (admin)
//   domain_verify       -> ask Resend to verify, return the state                                        (admin)
//   webhook_setup       -> create the Resend webhook to mail-events, secret into the vault               (admin)
//   set_settings {..}   -> change from name/email, reply-to, mode, test recipients, fundraising exemption (admin)
//   save_template {..}  -> edit a template's subject, preheader, bodies, active                          (admin)
//   refresh_consent     -> crm_refresh_implied_consent(), returns the counts                             (admin)
//   preview {template_key, contact_id?, vars?} -> subject, html, text as they would go out
//   test {template_key, to, vars?}   -> a real send to one of the test recipients only
//   send {contact_id, template_key, vars?} -> the real thing: rule, mode, render, Resend, log
//   campaign_check {campaign_id}   -> who the list holds, who the rule allows, who is held back and why, the cap
//   campaign_queue {campaign_id}   -> live mode only: one queued send per allowed address, the held ones logged; starts the pump
//   campaign_pump                  -> takes queued sends (crm_claim_queued) within the daily cap, re-checks the rule, sends
//   campaign_cancel {campaign_id}  -> the sends still waiting are cancelled
//   campaign_test {campaign_id, to?} -> the campaign as it will look, to a test recipient or the caller's own staff address
// Anyone with the CRM page may send a campaign (Steel, 27/09/26); the mode (test/live) still gates every real send.
// Tables: crm_email_templates, crm_email_sends, crm_interactions, crm_contacts, app_config, change_log.
// Secrets: RESEND_API_KEY (function secret, or the vault), WA_MAIL_SECRET (vault; signs unsubscribe links),
//   WA_TRIGGER_SECRET (vault). Nothing here logs a key.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const RESEND = 'https://api.resend.com';
const ADMINS = ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'];
const HUB_URL = 'https://hub.welfareavenue.com';
const SITE_URL = 'https://welfareavenue.com';
const CREAM = '#FFFAF2', GREEN = '#103F39', INK = '#1F201E', PURPLE = '#6F64AB', GOLD = '#DCA527';
const HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
const BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
const LOGO_CREAM = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/logo-primary-cream-600.png';
const LOCKUP_CREAM = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/logo-lockup-cream-600.png';
const KINDS = ['transactional', 'newsletter', 'fundraising', 'volunteer', 'test'];
const BULK = ['newsletter', 'fundraising', 'volunteer'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getSecret(name: string): Promise<string | null> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  return error || !data ? null : String(data);
}
async function resendKey(): Promise<string | null> {
  return Deno.env.get('RESEND_API_KEY') || await getSecret('RESEND_API_KEY');
}
type Caller = { who: string; email: string; admin: boolean };
async function caller(req: Request): Promise<Caller | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { who: 'automation', email: 'automation', admin: true }; } catch (_) { /* no */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  const ok = await asUser.rpc('wa_page_ok', { p_tab: 'crm' });
  if (ok.data === false) return null;
  const role = await asUser.rpc('get_my_role');
  const admin = String(role.data || '') === 'admin' || ADMINS.includes(email);
  return { who: 'staff', email, admin };
}
async function rs(key: string, method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(RESEND + path, {
    method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(extra || {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let b: any = null; try { b = await res.json(); } catch (_) { b = null; }
  return { ok: res.ok, status: res.status, body: b };
}
async function settings(): Promise<Record<string, string>> {
  const { data } = await svc.from('app_config').select('key,value').like('key', 'mail_%');
  const out: Record<string, string> = {};
  (data || []).forEach((r: { key: string; value: string }) => { out[r.key] = r.value || ''; });
  return out;
}
async function setConfig(key: string, value: string): Promise<void> {
  await svc.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() });
}
function listOf(s: string): string[] { return String(s || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean); }
function esc(s: unknown): string { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)); }
function isEmail(s: string): boolean { return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(s); }

/* ---------- rendering ---------- */
const RAW_KEYS = ['body_html'];
function fill(tpl: string, vars: Record<string, string>, html: boolean): string {
  return String(tpl || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g, (_m, key: string, fb?: string) => {
    const v = vars[key];
    const has = v != null && String(v).trim() !== '';
    if (has) return html && !RAW_KEYS.includes(key) ? esc(v) : String(v);
    return fb != null ? fb : '';
  });
}
function styleInner(html: string): string {
  const P = `margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:26px;color:${INK};`;
  const rule = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td style="width:40px;height:3px;background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  return html
    .replace(/<a href="/g, `<a style="color:${PURPLE};text-decoration:underline;" href="`)
    .replace(/<a class="btn" href="([^"]*)">([\s\S]*?)<\/a>/g, (_m, href, label) =>
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;"><tr><td style="background-color:${GOLD};border-radius:6px;">` +
      `<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${HEAD};font-weight:600;font-size:18px;letter-spacing:1px;text-transform:uppercase;color:${GREEN};text-decoration:none;">${label}</a></td></tr></table>`)
    .replace(/<h1>/g, `<h1 style="margin:0 0 18px;font-family:${HEAD};font-weight:500;font-size:40px;line-height:44px;text-transform:uppercase;letter-spacing:.5px;color:${GREEN};">`)
    .replace(/<h2>/g, `<h2 style="margin:24px 0 8px;font-family:${HEAD};font-weight:500;font-size:26px;line-height:30px;text-transform:uppercase;letter-spacing:.5px;color:${GREEN};">`)
    .replace(/<\/h2>/g, '</h2>' + rule)
    .replace(/<h3>/g, `<h3 style="margin:22px 0 8px;font-family:${BODY};font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">`)
    .replace(/<p>/g, `<p style="${P}">`)
    .replace(/<(ul|ol)>/g, `<$1 style="margin:0 0 16px 22px;padding:0;">`)
    .replace(/<li>/g, `<li style="margin:0 0 8px;font-family:${BODY};font-size:16px;line-height:26px;color:${INK};">`)
    .replace(/<strong>/g, `<strong style="color:${GREEN};font-weight:700;">`)
    .replace(/<mark>/g, `<span style="background-color:${GOLD};color:${GREEN};padding:0 4px;">`).replace(/<\/mark>/g, '</span>')
    .replace(/<hr\s*\/?>/g, rule);
}
const REASON: Record<string, string> = {
  transactional: 'of your relationship with Welfare Avenue: a sign-up, a serving or a gift.',
  newsletter: 'you said yes to our news, or gave or volunteered with us in the last two years.',
  fundraising: 'you said yes to our news, or gave or volunteered with us in the last two years.',
  volunteer: 'you applied to volunteer, or volunteered, with Welfare Avenue.',
  test: 'it is a test the Hub sent to a team address.'
};
const OVERLINE: Record<string, string> = { transactional: 'From the Welfare Avenue team', newsletter: 'News from Welfare Avenue', fundraising: 'From Welfare Avenue', volunteer: 'Volunteering at Welfare Avenue', test: 'A Hub test' };
function layout(o: { inner: string; preheader: string; kind: string; unsub: string; cfg: Record<string, string>; title: string }): string {
  const bulk = BULK.includes(o.kind);
  const addr = o.cfg.mail_postal_address || 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9';
  const charity = o.cfg.mail_charity_number || '713048502RR0001';
  const small = `font-family:${BODY};font-size:13px;line-height:20px;color:${CREAM};`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${esc(o.title)}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">` +
    `<style>body{margin:0;padding:0;background:${CREAM};}table{border-collapse:collapse;}img{border:0;line-height:100%;}@media only screen and (max-width:620px){.wa-wrap{width:100% !important;}.wa-pad{padding-left:20px !important;padding-right:20px !important;}h1{font-size:32px !important;line-height:36px !important;}}</style></head>` +
    `<body style="margin:0;padding:0;background-color:${CREAM};">` +
    (o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};font-size:1px;line-height:1px;">${esc(o.preheader)}</div>` : '') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" class="wa-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">` +
    `<tr><td class="wa-pad" style="background-color:${GREEN};border-radius:8px 8px 0 0;padding:28px 36px 24px 36px;">` +
    `<img src="${LOGO_CREAM}" width="170" height="57" alt="Welfare Avenue" style="display:block;border:0;width:170px;height:auto;">` +
    `<div style="padding:20px 0 0;font-family:${BODY};font-weight:700;font-size:11px;line-height:14px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;">${esc(OVERLINE[o.kind] || OVERLINE.transactional)}</div></td></tr>` +
    `<tr><td class="wa-pad" style="background-color:${CREAM};padding:32px 36px 20px 36px;border-left:1px solid rgba(16,63,57,.12);border-right:1px solid rgba(16,63,57,.12);">${o.inner}</td></tr>` +
    `<tr><td class="wa-pad" style="background-color:${GREEN};border-radius:0 0 8px 8px;padding:26px 36px 28px 36px;">` +
    `<img src="${LOCKUP_CREAM}" width="140" height="63" alt="Welfare Avenue, building pathways in our community" style="display:block;border:0;width:140px;height:auto;">` +
    `<div style="padding:16px 0 0;${small}opacity:.85;">Welfare Avenue is a registered charity, no. ${esc(charity)}. ${esc(addr)}.<br>You are receiving this email because ${esc(REASON[o.kind] || REASON.transactional)}</div>` +
    `<div style="padding-top:12px;${small}"><a href="${SITE_URL}" style="color:${CREAM};text-decoration:underline;">welfareavenue.com</a>` +
    (o.unsub ? ` &nbsp;·&nbsp; <a href="${o.unsub}" style="color:${CREAM};text-decoration:underline;">${bulk ? 'Unsubscribe' : 'Email preferences'}</a>` : '') +
    `</div></td></tr></table></td></tr></table></body></html>`;
}
function textLayout(text: string, kind: string, unsub: string, cfg: Record<string, string>): string {
  const addr = cfg.mail_postal_address || 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9';
  const charity = cfg.mail_charity_number || '713048502RR0001';
  return text.trim() + '\n\n--\nWelfare Avenue, building pathways in our community\n' + SITE_URL + '\nRegistered charity no. ' + charity + '. ' + addr + '.\nYou are receiving this email because ' + (REASON[kind] || REASON.transactional) +
    (unsub ? '\n' + (BULK.includes(kind) ? 'Unsubscribe: ' : 'Email preferences: ') + unsub : '') + '\n';
}
function htmlToText(html: string): string {
  return html.replace(/<a class="btn" href="([^"]*)">([\s\S]*?)<\/a>/g, '$2: $1').replace(/<li>/g, '- ').replace(/<\/(p|h1|h2|h3|li|ul|ol)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
}
async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function unsubUrl(contactId: number | null, sendId: number | null): Promise<string> {
  if (!contactId) return '';
  const secret = await getSecret('WA_MAIL_SECRET'); if (!secret) return '';
  const t = (await hmacHex(secret, String(contactId))).slice(0, 32);
  return SUPABASE_URL + '/functions/v1/mail-unsubscribe?c=' + contactId + '&t=' + t + (sendId ? '&s=' + sendId : '');
}
function firstName(c: any): string {
  const f = String(c?.first_name || '').trim(); if (f) return f;
  const full = String(c?.full_name || '').trim(); if (!full || /^\(no name\)$/i.test(full)) return '';
  return full.split(/\s+/)[0];
}
function contactVars(c: any, cfg: Record<string, string>): Record<string, string> {
  return { first_name: firstName(c), full_name: c ? String(c.full_name || '') : '', email: c ? String(c.primary_email || (c.emails || [])[0] || '') : '', hub_url: HUB_URL, site_url: SITE_URL, from_name: cfg.mail_from_name || 'Welfare Avenue' };
}
function cleanVars(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object') for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (/^[a-zA-Z0-9_]{1,40}$/.test(k) && val != null) out[k] = String(val).slice(0, 8000);
  return out;
}
async function render(tpl: any, c: any, extra: Record<string, string>, cfg: Record<string, string>, unsub: string) {
  const vars = { ...contactVars(c, cfg), ...extra };
  const subject = fill(tpl.subject, vars, false).replace(/\s+/g, ' ').trim();
  const preheader = fill(tpl.preheader || '', vars, false).trim();
  const inner = styleInner(fill(tpl.html_body, vars, true));
  const html = layout({ inner, preheader, kind: tpl.kind, unsub, cfg, title: subject });
  const text = textLayout(tpl.text_body ? fill(tpl.text_body, vars, false) : htmlToText(fill(tpl.html_body, { ...vars, body_html: htmlToText(vars.body_html || '') }, false)), tpl.kind, unsub, cfg);
  return { subject, preheader, html, text };
}
async function template(key: string) {
  const { data } = await svc.from('crm_email_templates').select('*').eq('key', key).maybeSingle();
  return data;
}
async function contactById(id: number) {
  const { data } = await svc.from('crm_contacts').select('id,full_name,first_name,last_name,emails,primary_email,email_status,email_consent,merged_into').eq('id', id).maybeSingle();
  return data;
}
async function contactByEmail(email: string) {
  const e = email.toLowerCase();
  const { data } = await svc.from('crm_contacts').select('id,full_name,first_name,last_name,emails,primary_email,email_status,email_consent,merged_into').is('merged_into', null).or('primary_email.ilike.' + e + ',emails.cs.{"' + e + '"}').limit(1);
  return (data || [])[0] || null;
}

/* ---------- the send itself ---------- */
type Sent = { send_id?: number; resend_id?: string; status?: string; to?: string; subject?: string; error?: string };
type Sender = { name?: string | null; email?: string | null; reply?: string | null };
type Content = { tpl: any; vars: Record<string, string>; kind: string; subject?: string | null; preheader?: string | null; sender?: Sender | null; campaignId?: number | null };
function senderLine(cfg: Record<string, string>, s?: Sender | null) {
  const name = String((s && s.name) || cfg.mail_from_name || 'Welfare Avenue').replace(/[<>"\r\n]/g, '').trim() || 'Welfare Avenue';
  const email = String((s && s.email) || cfg.mail_from_email || 'info@welfareavenue.com').trim().toLowerCase();
  const person = !!(s && s.email) && email !== String(cfg.mail_from_email || '').toLowerCase();
  const reply = String((s && s.reply) || (person ? email : (cfg.mail_reply_to || '')) || '').trim();
  return { from: name + ' <' + email + '>', reply: reply || undefined, email };
}
function onDomain(e: string, cfg: Record<string, string>) { return isEmail(e) && e.toLowerCase().endsWith('@' + (cfg.mail_domain || 'welfareavenue.com')); }
/* sends one row already in crm_email_sends (queued, or claimed by the pump) */
async function sendRow(o: { sendId: number; c: any; to: string; content: Content; cfg: Record<string, string>; isTest: boolean; who: Caller }): Promise<Sent> {
  const key = await resendKey();
  if (!key) { await svc.from('crm_email_sends').update({ status: 'failed', error: 'The Resend key is not set (RESEND_API_KEY).' }).eq('id', o.sendId); return { send_id: o.sendId, status: 'failed', error: 'The Resend key is not set (RESEND_API_KEY).' }; }
  const kind = o.content.kind;
  const tpl = { ...o.content.tpl, kind, subject: o.content.subject || o.content.tpl.subject, preheader: o.content.preheader != null && o.content.preheader !== '' ? o.content.preheader : o.content.tpl.preheader };
  const sender = senderLine(o.cfg, o.content.sender);
  if (!onDomain(sender.email, o.cfg)) { await svc.from('crm_email_sends').update({ status: 'failed', error: 'the sending address must be on ' + (o.cfg.mail_domain || 'welfareavenue.com') }).eq('id', o.sendId); return { send_id: o.sendId, status: 'failed', error: 'the sending address must be on ' + (o.cfg.mail_domain || 'welfareavenue.com') }; }
  const unsub = await unsubUrl(o.c ? o.c.id : null, o.sendId);
  const r = await render(tpl, o.c, o.content.vars, o.cfg, unsub);
  const bulk = BULK.includes(kind);
  const headers: Record<string, string> = {};
  if (bulk && unsub) { headers['List-Unsubscribe'] = '<' + unsub + '>'; headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'; }
  const tags = [{ name: 'template', value: String(tpl.key).replace(/[^a-zA-Z0-9_-]/g, '_') }, { name: 'kind', value: kind }, { name: 'send_id', value: String(o.sendId) }];
  if (o.content.campaignId) tags.push({ name: 'campaign_id', value: String(o.content.campaignId) });
  const payload: Record<string, unknown> = { from: sender.from, to: [o.to], subject: r.subject, html: r.html, text: r.text, reply_to: sender.reply, ...(Object.keys(headers).length ? { headers } : {}), tags };
  const res = await rs(key, 'POST', '/emails', payload, { 'Idempotency-Key': 'wa-send-' + o.sendId });
  await svc.from('crm_email_sends').update({ subject: r.subject, status: res.ok ? 'sent' : 'failed', resend_id: res.ok ? res.body.id : null, sent_at: res.ok ? new Date().toISOString() : null, claimed_at: null,
    error: res.ok ? null : (res.status + ' ' + String((res.body && (res.body.message || res.body.error)) || '')).slice(0, 400) }).eq('id', o.sendId);
  if (res.ok && o.c && !o.isTest) {
    await svc.from('crm_interactions').insert({
      contact_id: o.c.id, kind: 'email', direction: 'out', channel: 'email', subject: r.subject, body: r.text.split('\n--\n')[0].slice(0, 2000), occurred_at: new Date().toISOString(),
      source: 'resend', source_ref: 'send:' + o.sendId, meta: { send_id: o.sendId, template: tpl.key, template_name: tpl.name, kind, status: 'sent', resend_id: res.body.id, campaign_id: o.content.campaignId || null }, created_by: o.who.email
    });
    await svc.from('crm_contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', o.c.id);
  }
  return res.ok ? { send_id: o.sendId, resend_id: res.body.id, status: 'sent', to: o.to, subject: r.subject } : { send_id: o.sendId, status: 'failed', error: 'Resend answered ' + res.status + ': ' + String((res.body && (res.body.message || res.body.error)) || 'no detail') };
}
async function deliver(o: { c: any; to: string; tpl: any; vars: Record<string, string>; cfg: Record<string, string>; kind: string; isTest: boolean; basis: string; who: Caller; content?: Partial<Content>; campaignId?: number | null }): Promise<Sent> {
  const ins = await svc.from('crm_email_sends').insert({
    contact_id: o.c ? o.c.id : null, to_email: o.to, template_key: o.tpl.key, kind: o.kind, status: 'queued', is_test: o.isTest, permission_basis: o.basis, campaign_id: o.isTest ? null : (o.campaignId || null),
    meta: { template: o.tpl.name, vars: o.vars, caller: o.who.email, campaign_id: o.campaignId || null }, created_by: o.who.email
  }).select('id').single();
  if (ins.error) return { error: 'send log: ' + ins.error.message };
  return await sendRow({ sendId: ins.data.id as number, c: o.c, to: o.to, content: { tpl: o.tpl, vars: o.vars, kind: o.kind, ...(o.content || {}), campaignId: o.campaignId || null }, cfg: o.cfg, isTest: o.isTest, who: o.who });
}

/* ---------- campaigns ---------- */
async function campaignById(id: number) {
  const { data } = await svc.from('crm_campaigns').select('*').eq('id', id).maybeSingle();
  return data as any;
}
function campaignContent(k: any, tpl: any): Content {
  const vars = cleanVars(k.vars || {});
  if (k.subject) vars.subject = String(k.subject);
  if (k.preheader) vars.preheader = String(k.preheader);
  return { tpl, vars, kind: KINDS.includes(k.kind) && k.kind !== 'test' ? k.kind : 'newsletter', subject: k.subject || null, preheader: k.preheader || null,
    sender: { name: k.from_name || null, email: k.from_email || null, reply: k.reply_to || null }, campaignId: k.id };
}
async function audience(k: any) {
  const a = await svc.rpc('crm_campaign_audience', { p_campaign_id: k.id });
  if (a.error) throw new Error('the list: ' + a.error.message);
  const rows = (a.data || []) as { contact_id: number; email: string | null; allowed: boolean; basis: string }[];
  const seen = new Set<string>(); const ok: typeof rows = []; const held: typeof rows = []; let dupes = 0;
  for (const r of rows) {
    if (!r.allowed) { held.push(r); continue; }
    const e = String(r.email || '').toLowerCase();
    if (!e || seen.has(e)) { dupes++; continue; }
    seen.add(e); ok.push(r);
  }
  const why: Record<string, number> = {};
  held.forEach(r => { const b = /^implied consent ran out/.test(r.basis) ? 'implied consent ran out' : r.basis; why[b] = (why[b] || 0) + 1; });
  return { rows, ok, held, dupes, why };
}
async function usage(cfg: Record<string, string>) {
  const since = new Date(Date.now() - 86400000).toISOString();
  const all = await svc.from('crm_email_sends').select('id', { count: 'exact', head: true }).eq('is_test', false).gte('sent_at', since);
  const camp = await svc.from('crm_email_sends').select('id', { count: 'exact', head: true }).eq('is_test', false).not('campaign_id', 'is', null).gte('sent_at', since);
  const daily = Number(cfg.mail_daily_cap || 0), campaign = Number(cfg.mail_campaign_daily_cap || 0);
  const usedAll = all.count || 0, usedCamp = camp.count || 0;
  const room = Math.max(0, Math.min(daily > 0 ? daily - usedAll : 1e9, campaign > 0 ? campaign - usedCamp : 1e9));
  return { daily, campaign, used_all: usedAll, used_campaigns: usedCamp, room: room >= 1e9 ? null : room };
}
async function pump(cfg: Record<string, string>, who: Caller, max: number) {
  if ((cfg.mail_mode || 'test') !== 'live') return { sent: 0, note: 'test mode: the queue waits' };
  const u = await usage(cfg);
  const take = Math.min(max, u.room == null ? max : u.room);
  if (take <= 0) return { sent: 0, note: 'the daily cap is reached; the queue goes on tomorrow', usage: u };
  const claim = await svc.rpc('crm_claim_queued', { p_limit: take });
  if (claim.error) return { sent: 0, error: 'claim: ' + claim.error.message };
  const rows = (claim.data || []) as any[];
  const cache: Record<string, any> = {}; const tpls: Record<string, any> = {}; const touched = new Set<number>();
  let sent = 0, held = 0, failed = 0, cancelled = 0;
  for (const row of rows) {
    const kid = row.campaign_id as number | null;
    const k = kid ? (cache[kid] = cache[kid] || await campaignById(kid)) : null;
    if (kid) touched.add(kid);
    if (!k || k.status === 'cancelled') { await svc.from('crm_email_sends').update({ status: 'cancelled', claimed_at: null }).eq('id', row.id); cancelled++; continue; }
    const tpl = tpls[k.template_key] = tpls[k.template_key] || await template(k.template_key || 'newsletter');
    const c = row.contact_id ? await contactById(row.contact_id) : null;
    const perm = c ? await svc.rpc('crm_email_permission', { p_contact_id: c.id, p_kind: k.kind }) : { data: [] };
    const p = ((perm as any).data || [])[0];
    if (!tpl || !c || !p || !p.allowed) { await svc.from('crm_email_sends').update({ status: 'suppressed', claimed_at: null, permission_basis: p ? p.basis : 'the contact or the template is gone' }).eq('id', row.id); held++; continue; }
    const out = await sendRow({ sendId: row.id, c, to: String(row.to_email || p.email), content: campaignContent(k, tpl), cfg, isTest: false, who: { ...who, email: k.updated_by || k.created_by || who.email } });
    if (out.status === 'sent') sent++; else failed++;
    await sleep(550);
  }
  for (const kid of touched) {
    const left = await svc.from('crm_email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', kid).in('status', ['queued', 'sending']);
    const k = cache[kid];
    if (k && k.status !== 'cancelled' && !(left.count || 0)) await svc.from('crm_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', kid).in('status', ['queued', 'sending']);
  }
  return { sent, held, failed, cancelled, usage: await usage(cfg) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'settings');
  const cfg = await settings();
  const admin = who.admin;
  try {
    if (action === 'settings') {
      const key = await resendKey();
      let domain: unknown = null;
      if (key && cfg.mail_domain_id) { const d = await rs(key, 'GET', '/domains/' + cfg.mail_domain_id); domain = d.ok ? { id: d.body.id, name: d.body.name, status: d.body.status, region: d.body.region, records: d.body.records || [] } : { error: 'Resend answered ' + d.status }; }
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const sends = await svc.from('crm_email_sends').select('status,is_test', { count: 'exact', head: false }).gte('created_at', since).limit(2000);
      const rows = sends.data || [];
      return json({
        settings: Object.fromEntries(Object.entries(cfg).filter(([k]) => k !== 'mail_domain_id' && k !== 'mail_webhook_id')),
        key_present: !!key, domain, domain_id: cfg.mail_domain_id || null, webhook_id: cfg.mail_webhook_id || null,
        mail_secret_present: !!(await getSecret('WA_MAIL_SECRET')), webhook_secret_present: !!(await getSecret('RESEND_WEBHOOK_SECRET')),
        last30: { sent: rows.filter((r: any) => !r.is_test && ['sent', 'delivered', 'delayed'].includes(r.status)).length, tests: rows.filter((r: any) => r.is_test).length, bounced: rows.filter((r: any) => r.status === 'bounced').length, suppressed: rows.filter((r: any) => r.status === 'suppressed').length, failed: rows.filter((r: any) => r.status === 'failed').length },
        admin, me: who.email
      });
    }
    if (action === 'domain_setup' || action === 'domain_verify') {
      if (!admin) return json({ error: 'admins only' }, 403);
      const key = await resendKey(); if (!key) return json({ error: 'The Resend key is not set (RESEND_API_KEY).' }, 400);
      let id = cfg.mail_domain_id || '';
      if (!id) {
        const list = await rs(key, 'GET', '/domains');
        const have = list.ok && Array.isArray(list.body?.data) ? list.body.data.find((d: any) => d.name === (cfg.mail_domain || 'welfareavenue.com')) : null;
        if (have) id = have.id;
        else {
          const made = await rs(key, 'POST', '/domains', { name: cfg.mail_domain || 'welfareavenue.com', region: 'us-east-1' });
          if (!made.ok) return json({ error: 'Resend would not create the domain: ' + made.status + ' ' + String(made.body?.message || '') }, 502);
          id = made.body.id;
        }
        await setConfig('mail_domain_id', id);
        await svc.from('change_log').insert({ entity_type: 'mail', entity_id: 'domain', field: 'resend_domain', old_value: null, new_value: (cfg.mail_domain || 'welfareavenue.com') + ' ' + id, changed_by: who.email });
      }
      if (action === 'domain_verify') await rs(key, 'POST', '/domains/' + id + '/verify');
      const d = await rs(key, 'GET', '/domains/' + id);
      if (!d.ok) return json({ error: 'Resend answered ' + d.status }, 502);
      return json({ domain: { id: d.body.id, name: d.body.name, status: d.body.status, region: d.body.region, records: d.body.records || [] } });
    }
    if (action === 'webhook_setup') {
      if (!admin) return json({ error: 'admins only' }, 403);
      const key = await resendKey(); if (!key) return json({ error: 'The Resend key is not set (RESEND_API_KEY).' }, 400);
      if (cfg.mail_webhook_id) return json({ webhook: { id: cfg.mail_webhook_id, present: true }, note: 'already set up' });
      const endpoint = SUPABASE_URL + '/functions/v1/mail-events';
      const events = ['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.opened', 'email.clicked', 'email.failed'];
      const made = await rs(key, 'POST', '/webhooks', { endpoint, events });
      if (!made.ok) return json({ error: 'Resend would not create the webhook: ' + made.status + ' ' + String(made.body?.message || '') }, 502);
      const secret = String(made.body.signing_secret || '');
      if (secret) { const put = await svc.rpc('wa_vault_set', { p_name: 'RESEND_WEBHOOK_SECRET', p_value: secret, p_note: 'wave154: Resend webhook signing secret (mail-events)' }); if (put.error) return json({ error: 'vault: ' + put.error.message }, 500); }
      await setConfig('mail_webhook_id', String(made.body.id));
      await svc.from('change_log').insert({ entity_type: 'mail', entity_id: 'webhook', field: 'resend_webhook', old_value: null, new_value: String(made.body.id) + ' -> mail-events', changed_by: who.email });
      return json({ webhook: { id: made.body.id, present: true, events }, secret_stored: !!secret });
    }
    if (action === 'set_settings') {
      if (!admin) return json({ error: 'admins only' }, 403);
      const allowed = ['mail_from_name', 'mail_from_email', 'mail_reply_to', 'mail_mode', 'mail_test_recipients', 'mail_fundraising_exemption', 'mail_postal_address'];
      const changes: string[] = [];
      for (const k of allowed) {
        if (body[k] === undefined) continue;
        let v = String(body[k] || '').trim();
        if (k === 'mail_mode' && !['test', 'live'].includes(v)) return json({ error: 'mode must be test or live' }, 400);
        if (k === 'mail_fundraising_exemption' && !['on', 'off'].includes(v)) return json({ error: 'exemption must be on or off' }, 400);
        if (k === 'mail_from_email' && !(isEmail(v) && v.toLowerCase().endsWith('@' + (cfg.mail_domain || 'welfareavenue.com')))) return json({ error: 'the from address must be on ' + (cfg.mail_domain || 'welfareavenue.com') }, 400);
        if (k === 'mail_reply_to' && v && !isEmail(v)) return json({ error: 'reply-to is not an email address' }, 400);
        if (k === 'mail_test_recipients') { const l = listOf(v).filter(isEmail); if (!l.length) return json({ error: 'at least one test recipient' }, 400); v = l.join(', '); }
        if (k === 'mail_from_name' && !v) return json({ error: 'a from name is needed' }, 400);
        if (v !== (cfg[k] || '')) { await setConfig(k, v); changes.push(k + ': ' + (cfg[k] || '(none)') + ' -> ' + v); }
      }
      if (changes.length) await svc.from('change_log').insert({ entity_type: 'mail', entity_id: 'settings', field: 'mail_settings', old_value: null, new_value: changes.join(' | ').slice(0, 900), changed_by: who.email });
      return json({ ok: true, changed: changes.length, settings: await settings() });
    }
    if (action === 'save_template') {
      if (!admin) return json({ error: 'admins only' }, 403);
      const key = String(body.key || '').trim();
      const tpl = await template(key); if (!tpl) return json({ error: 'no such template' }, 404);
      const patch: Record<string, unknown> = { updated_by: who.email, updated_at: new Date().toISOString() };
      for (const k of ['name', 'subject', 'preheader', 'html_body', 'text_body']) if (body[k] !== undefined) patch[k] = String(body[k] || '');
      if (body.active !== undefined) patch.active = !!body.active;
      if (!String(patch.subject ?? tpl.subject).trim() || !String(patch.html_body ?? tpl.html_body).trim()) return json({ error: 'a subject and a body are needed' }, 400);
      const up = await svc.from('crm_email_templates').update(patch).eq('key', key);
      if (up.error) return json({ error: up.error.message }, 500);
      await svc.from('change_log').insert({ entity_type: 'mail', entity_id: key, field: 'template', old_value: String(tpl.subject).slice(0, 200), new_value: String(patch.subject ?? tpl.subject).slice(0, 200), changed_by: who.email });
      return json({ ok: true, template: await template(key) });
    }
    if (action === 'refresh_consent') {
      if (!admin) return json({ error: 'admins only' }, 403);
      const r = await svc.rpc('crm_refresh_implied_consent');
      if (r.error) return json({ error: r.error.message }, 500);
      await svc.from('change_log').insert({ entity_type: 'mail', entity_id: 'consent', field: 'implied_consent_refresh', old_value: null, new_value: JSON.stringify(r.data).slice(0, 400), changed_by: who.email });
      return json({ counts: r.data });
    }
    if (action === 'preview') {
      const base = await template(String(body.template_key || '')); if (!base) return json({ error: 'no such template' }, 404);
      const kind = body.kind && KINDS.includes(String(body.kind)) ? String(body.kind) : base.kind;
      const vars = cleanVars(body.vars);
      if (body.subject) vars.subject = String(body.subject);
      if (body.preheader) vars.preheader = String(body.preheader);
      const tpl = { ...base, kind, subject: body.subject ? String(body.subject) : base.subject, preheader: body.preheader ? String(body.preheader) : base.preheader };
      const c = body.contact_id ? await contactById(Number(body.contact_id)) : null;
      const r = await render(tpl, c, vars, cfg, c ? await unsubUrl(c.id, null) : SUPABASE_URL + '/functions/v1/mail-unsubscribe?preview=1');
      const snd = senderLine(cfg, body.from_email || body.from_name ? { name: body.from_name, email: body.from_email, reply: body.reply_to } : null);
      return json({ subject: r.subject, preheader: r.preheader, html: r.html, text: r.text, kind, from: snd.from, reply_to: snd.reply || null });
    }
    if (action === 'test') {
      const tpl = await template(String(body.template_key || 'test')); if (!tpl) return json({ error: 'no such template' }, 404);
      const to = String(body.to || who.email || '').trim().toLowerCase();
      if (!isEmail(to)) return json({ error: 'a recipient is needed' }, 400);
      if (!listOf(cfg.mail_test_recipients).includes(to) && !(to === who.email && onDomain(to, cfg))) return json({ error: 'Test messages go only to the test recipients (' + (cfg.mail_test_recipients || 'none set') + ') or to your own team address.' }, 403);
      const c = await contactByEmail(to);
      const out = await deliver({ c, to, tpl, vars: cleanVars(body.vars), cfg, kind: 'test', isTest: true, basis: 'test recipient', who });
      return json(out, out.error && !out.send_id ? 400 : 200);
    }
    if (action === 'send') {
      const tpl = await template(String(body.template_key || '')); if (!tpl) return json({ error: 'no such template' }, 404);
      if (!tpl.active) return json({ error: 'that template is switched off' }, 400);
      const c = await contactById(Number(body.contact_id)); if (!c) return json({ error: 'no such contact' }, 404);
      const kind = KINDS.includes(tpl.kind) ? tpl.kind : 'newsletter';
      const perm = await svc.rpc('crm_email_permission', { p_contact_id: c.id, p_kind: kind });
      const p = (perm.data || [])[0] || { allowed: false, basis: 'the permission rule did not answer' };
      if (!p.allowed) {
        await svc.from('crm_email_sends').insert({ contact_id: c.id, to_email: p.email || c.primary_email || (c.emails || [])[0] || '(no email)', template_key: tpl.key, kind, status: 'suppressed', permission_basis: p.basis, meta: { template: tpl.name, caller: who.email }, created_by: who.email });
        return json({ status: 'suppressed', basis: p.basis, to: p.email }, 200);
      }
      const to = String(p.email).toLowerCase();
      if ((cfg.mail_mode || 'test') !== 'live' && !listOf(cfg.mail_test_recipients).includes(to)) {
        return json({ error: 'The Hub is in test mode: email goes only to the test recipients until an admin switches it to live in the Email tab.', status: 'blocked' }, 403);
      }
      const out = await deliver({ c, to, tpl, vars: cleanVars(body.vars), cfg, kind, isTest: false, basis: p.basis, who });
      return json({ ...out, basis: p.basis }, out.error && !out.send_id ? 400 : 200);
    }
    if (action === 'campaign_check' || action === 'campaign_queue' || action === 'campaign_test' || action === 'campaign_cancel') {
      const k = await campaignById(Number(body.campaign_id)); if (!k) return json({ error: 'no such campaign' }, 404);
      if (action === 'campaign_cancel') {
        if (!['queued', 'sending', 'draft'].includes(k.status)) return json({ error: 'this campaign is ' + k.status }, 400);
        const up = await svc.from('crm_email_sends').update({ status: 'cancelled', claimed_at: null }).eq('campaign_id', k.id).eq('status', 'queued').select('id');
        await svc.from('crm_campaigns').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_by: who.email, updated_at: new Date().toISOString() }).eq('id', k.id);
        await svc.from('change_log').insert({ entity_type: 'crm_campaign', entity_id: String(k.id), field: 'status', old_value: k.status, new_value: 'cancelled (' + ((up.data || []).length) + ' waiting sends cancelled)', changed_by: who.email });
        return json({ ok: true, cancelled: (up.data || []).length });
      }
      const tpl = await template(k.template_key || 'newsletter'); if (!tpl) return json({ error: 'the campaign has no template' }, 400);
      if (k.from_email && !onDomain(String(k.from_email), cfg)) return json({ error: 'the sending address must be on ' + (cfg.mail_domain || 'welfareavenue.com') }, 400);
      if (action === 'campaign_test') {
        const to = String(body.to || who.email || '').trim().toLowerCase();
        if (!isEmail(to)) return json({ error: 'a recipient is needed' }, 400);
        if (!listOf(cfg.mail_test_recipients).includes(to) && !(to === who.email && onDomain(to, cfg))) return json({ error: 'Tests go only to the test recipients or to your own team address.' }, 403);
        const c = await contactByEmail(to);
        const out = await deliver({ c, to, tpl, vars: campaignContent(k, tpl).vars, cfg, kind: campaignContent(k, tpl).kind, isTest: true, basis: 'test of campaign ' + k.id, who, content: campaignContent(k, tpl), campaignId: k.id });
        return json(out, out.error && !out.send_id ? 400 : 200);
      }
      if (!k.list_id) return json({ error: 'pick a list first' }, 400);
      if (!String(k.subject || '').trim()) return json({ error: 'a subject is needed' }, 400);
      const a = await audience(k);
      const u = await usage(cfg);
      const live = (cfg.mail_mode || 'test') === 'live';
      const perDay = Math.max(1, Number(cfg.mail_campaign_daily_cap || cfg.mail_daily_cap || 0) || a.ok.length || 1);
      const summary = { audience: a.rows.length, eligible: a.ok.length, held: a.held.length, duplicates: a.dupes, why: a.why, mode: live ? 'live' : 'test', usage: u,
        per_day: Number(cfg.mail_campaign_daily_cap || cfg.mail_daily_cap || 0) || null, days: Math.max(1, Math.ceil(a.ok.length / perDay)) };
      if (action === 'campaign_check') return json(summary);
      /* campaign_queue */
      if (k.status !== 'draft') return json({ error: 'this campaign is ' + k.status }, 400);
      if (!live) return json({ ...summary, error: 'The Hub is in test mode: a campaign goes out once an admin switches the mode to live in the Email tab. Send yourself a test meanwhile.', status: 'blocked' }, 403);
      if (!a.ok.length) return json({ ...summary, error: 'nobody on this list can receive it' }, 400);
      const base = { template_key: k.template_key || 'newsletter', kind: campaignContent(k, tpl).kind, is_test: false, campaign_id: k.id, created_by: who.email, meta: { campaign: k.name, caller: who.email } };
      const queued = a.ok.map(r => ({ ...base, contact_id: r.contact_id, to_email: String(r.email).toLowerCase(), status: 'queued', permission_basis: r.basis }));
      const heldRows = a.held.map(r => ({ ...base, contact_id: r.contact_id, to_email: r.email || '(no email)', status: 'suppressed', permission_basis: r.basis }));
      for (let i = 0; i < queued.length; i += 500) { const ins = await svc.from('crm_email_sends').insert(queued.slice(i, i + 500)); if (ins.error) return json({ error: 'queue: ' + ins.error.message }, 500); }
      for (let i = 0; i < heldRows.length; i += 500) await svc.from('crm_email_sends').insert(heldRows.slice(i, i + 500));
      await svc.from('crm_campaigns').update({ status: 'sending', queued_at: new Date().toISOString(), audience: a.rows.length, eligible: a.ok.length, held: a.held.length, updated_by: who.email, updated_at: new Date().toISOString() }).eq('id', k.id);
      await svc.from('change_log').insert({ entity_type: 'crm_campaign', entity_id: String(k.id), field: 'status', old_value: 'draft', new_value: 'sending: ' + a.ok.length + ' queued, ' + a.held.length + ' held back', changed_by: who.email });
      const first = await pump(cfg, who, 5);
      return json({ ...summary, queued: queued.length, first });
    }
    if (action === 'campaign_pump') {
      return json(await pump(cfg, who, who.who === 'automation' ? 12 : 5));
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
