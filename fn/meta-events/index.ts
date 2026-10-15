// Welfare Avenue: meta-events (v1.1, 15/10/26, wave250; lead ads wave252)
// Steel (14/10/26): "Add all of these to the hub, use the browser to set them up" (the six Meta additions). This is the webhook
// for the HUB-Analytics app (1094841356812815): Meta calls it when something happens on the Page, the Instagram account or the
// WhatsApp Business Account, so the Studio does not have to wait for the 10-minute polls.
// Every event is a hint, never the truth: the function re-reads the object through the Graph API with the vault token
// (META_SYSTEM_TOKEN, a Page token derived from it) before anything lands in the Hub, so a forged call changes nothing and the
// app secret (META_APP_SECRET, optional) only adds the signature check. Message and comment text is never kept in meta_events.
// Trigger:
//   GET  from Meta: the subscription check (hub.mode=subscribe, hub.verify_token = vault META_VERIFY_TOKEN) answers hub.challenge.
//   POST from Meta: {object: page | instagram | whatsapp_business_account, entry: [...]}: each change is a meta_events row,
//        answered 200 at once and handled in the background:
//          page feed (comments), mention; instagram comments, mentions  -> social-inbox sync (7 days), at most once a minute
//          page messages, instagram messages                           -> social-dms dm_sync (wave251) for that sender
//          page leadgen                                                -> the lead read (GET /{lead-id}, leads_retrieval) and
//              filed: a volunteer role (wa209_volunteer_roles, or a volunteer form) through wa209_volunteer_apply (Applicants
//              received, the CRM and the directory), any other role as a New card in Applications (hub_candidates); once per lead
//          whatsapp_business_account messages (statuses and inbound)   -> whatsapp-send inbound (wave254)
//   POST {action} from the Hub or the pipeline: x-wa-secret, or a signed-in Hub admin.
//          status     what is connected (Page token, the Page's subscribed fields, Messenger and Instagram conversations
//                     readable, lead forms, the WhatsApp account's subscription, the app secret and verify token present,
//                     the last events); reads only
//          subscribe  POST /{page}/subscribed_apps (feed, messages, message_echoes, mention, leadgen) and
//                     POST /{waba}/subscribed_apps; nothing else
//          replay {id}  handle a stored event again (a lead that failed, say)
//          lead {id, dry}  read one lead and file it (dry: what would be filed, nothing written)
//          prune      clears the stored value of events older than 60 days (rows stay; nothing is removed)
//          app_subscribe  once META_APP_SECRET is in the vault: registers this function as the app's callback for the page,
//                     instagram and whatsapp_business_account objects (POST /{app-id}/subscriptions with the app token and the
//                     vault's verify token), so nobody types the verify token into the dashboard
//          probe {path, params}  a read-only Graph GET with the Page token, for paths under our Page, Instagram account,
//                     WhatsApp account or business (diagnosis; admins and the pipeline only)
// Tables: meta_events (write), social_accounts (read), volunteer_applications and hub_candidates (through wa209_volunteer_apply
// and an insert), change_log, hub_settings meta_events_kick. Vault: META_SYSTEM_TOKEN, META_VERIFY_TOKEN, META_APP_SECRET
// (optional), WA_TRIGGER_SECRET. Side effects: Graph API reads; subscribe changes the Page's and the WhatsApp account's webhook
// subscriptions. Nothing is posted, messaged or emailed to anyone.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const PAGE_ID = '100248828522234';
const IG_ID = '17841441999408199';
const WABA_ID = '984036304713487';
const BUSINESS_ID = '686100608981552';
const APP_ID = '1094841356812815';
const PAGE_FIELDS = ['feed', 'messages', 'message_echoes', 'mention', 'leadgen'];
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;

async function secretOrNull(name: string): Promise<string | null> {
  try { const { data, error } = await svc.rpc('get_secret', { secret_name: name }); if (!error && data) return String(data); } catch (_) { /* try the function secrets */ }
  /* the app secret may live in the vault or in the Edge Function secrets (Project settings > Edge Functions > Secrets) */
  const env = name === 'META_APP_SECRET' ? (Deno.env.get('META_APP_SECRET') || Deno.env.get('FACEBOOK_APP_SECRET') || Deno.env.get('META_APP_SECRET_KEY')) : null;
  return env || null;
}
async function getSecret(name: string): Promise<string> { const v = await secretOrNull(name); if (!v) throw new Error('secret ' + name + ' unavailable'); return v; }
function same(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

async function caller(req: Request): Promise<string | null> {
  const g = req.headers.get('x-wa-secret');
  if (g) { const s = await secretOrNull('WA_TRIGGER_SECRET'); if (s && same(g, s)) return 'automation'; }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase(); if (!email) return null;
  const { data: adm } = await asUser.rpc('is_hub_admin');
  return adm === true ? email : null;
}

async function graph(method: 'GET' | 'POST', path: string, token: string, params: Record<string, string> = {}): Promise<Any> {
  const u = new URL(GRAPH + (path.startsWith('/') ? path : '/' + path));
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) { if (method === 'POST') body.set(k, params[k]); else u.searchParams.set(k, params[k]); }
  const res = await fetch(u.toString(), method === 'POST'
    ? { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
    : { method, headers: { Authorization: 'Bearer ' + token } });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
  return b;
}
let PAGE_TOKEN: { v: string; at: number } | null = null;
async function tokens(): Promise<{ sys: string; page: string }> {
  const sys = await getSecret('META_SYSTEM_TOKEN');
  if (PAGE_TOKEN && Date.now() - PAGE_TOKEN.at < 30 * 60000) return { sys, page: PAGE_TOKEN.v };
  let page = sys;
  try { const r = await graph('GET', '/' + PAGE_ID, sys, { fields: 'access_token' }); if (r.access_token) page = String(r.access_token); } catch (_) { /* the system token may already work */ }
  PAGE_TOKEN = { v: page, at: Date.now() };
  return { sys, page };
}

/* ---------- the signature (only when the vault holds the app secret) ---------- */
async function signature(raw: string, header: string | null): Promise<boolean | null> {
  const secret = await secretOrNull('META_APP_SECRET');
  if (!secret) return null;
  if (!header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
  return same(hex, header.slice(7).toLowerCase());
}

/* ---------- storing the changes (no text) ---------- */
const TEXT_KEYS = new Set(['message', 'text', 'body', 'caption', 'title', 'name', 'first_name', 'last_name', 'profile', 'contacts', 'field_data', 'attachments', 'quick_reply', 'referral', 'reply_to', 'from']);
function strip(v: Any, depth = 0): Any {
  if (depth > 5 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.slice(0, 20).map(x => strip(x, depth + 1));
  const o: Any = {};
  for (const k of Object.keys(v)) {
    if (TEXT_KEYS.has(k)) { o[k] = k === 'from' && v[k] && typeof v[k] === 'object' ? { id: v[k].id || null } : (v[k] == null ? null : '[left out]'); continue; }
    o[k] = strip(v[k], depth + 1);
  }
  return o;
}
type Change = { object: string; field: string; account_id: string; ref_id: string | null; value: Any };
function changes(body: Any): Change[] {
  const out: Change[] = [];
  const object = String(body.object || '');
  for (const e of ((body.entry || []) as Any[])) {
    const acc = String(e.id || '');
    for (const c of ((e.changes || []) as Any[])) {
      const v = c.value || {};
      let ref: string | null = null;
      if (c.field === 'leadgen') ref = v.leadgen_id ? String(v.leadgen_id) : null;
      else if (c.field === 'feed' || c.field === 'mention') ref = String(v.comment_id || v.post_id || v.post?.id || '') || null;
      else if (c.field === 'comments' || c.field === 'mentions') ref = String(v.id || v.comment_id || v.media_id || '') || null;
      else if (object === 'whatsapp_business_account') ref = String(v.statuses?.[0]?.id || v.messages?.[0]?.id || '') || null;
      out.push({ object, field: String(c.field || ''), account_id: acc, ref_id: ref, value: v });
    }
    // Messenger and Instagram messages arrive as entry.messaging (not changes)
    for (const m of ((e.messaging || []) as Any[])) {
      const echo = !!(m.message && m.message.is_echo);
      const other = echo ? (m.recipient && m.recipient.id) : (m.sender && m.sender.id);
      out.push({ object, field: m.read ? 'message_reads' : (echo ? 'message_echoes' : (m.reaction ? 'message_reactions' : 'messages')), account_id: acc, ref_id: other ? String(other) : null, value: m });
    }
  }
  return out;
}

/* ---------- acting on a change ---------- */
async function kick(fn: string, payload: Any, key: string, minGapMs: number): Promise<string> {
  const { data } = await svc.from('hub_settings').select('value').eq('key', 'meta_events_kick').maybeSingle();
  const v = ((data && data.value) || {}) as Record<string, string>;
  const last = v[key] ? Date.parse(v[key]) : 0;
  if (Date.now() - last < minGapMs) return fn + ' already asked ' + Math.round((Date.now() - last) / 1000) + 's ago';
  v[key] = new Date().toISOString();
  await svc.from('hub_settings').upsert({ key: 'meta_events_kick', value: v, updated_at: new Date().toISOString(), updated_by: 'meta-events' });
  const sec = await getSecret('WA_TRIGGER_SECRET');
  const r = await fetch(SUPABASE_URL + '/functions/v1/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': sec, Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify(payload) });
  if (r.status === 404) return fn + ' is not there yet';
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(fn + ': ' + String(b.error || r.status).slice(0, 160));
  return fn + ' ' + String(payload.action) + ' ok';
}

function fieldValue(fd: Any[], keys: RegExp): string | null {
  const f = (fd || []).find((x: Any) => keys.test(String(x.name || '')));
  const v = f && Array.isArray(f.values) ? f.values.filter((s: Any) => String(s || '').trim()).join(', ') : '';
  return v ? String(v).trim() : null;
}
function pretty(k: string): string { const s = k.replace(/_/g, ' ').replace(/\?+$/, '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
async function readLead(id: string): Promise<Any> {
  const { page } = await tokens();
  const lead = await graph('GET', '/' + id, page, { fields: 'id,created_time,field_data,form_id,ad_id,ad_name,adset_name,campaign_name,platform,is_organic,page_id' });
  let form: Any = {};
  if (lead.form_id) { try { form = await graph('GET', '/' + lead.form_id, page, { fields: 'id,name,locale,status' }); } catch (_) { form = { id: lead.form_id }; } }
  const fd = (lead.field_data || []) as Any[];
  const first = fieldValue(fd, /^first_name$/i), last = fieldValue(fd, /^last_name$/i);
  const name = fieldValue(fd, /^full_name$/i) || [first, last].filter(Boolean).join(' ') || null;
  const email = (fieldValue(fd, /^(email|work_email)$/i) || '').toLowerCase() || null;
  const phone = fieldValue(fd, /^(phone_number|phone|work_phone_number)$/i);
  const city = fieldValue(fd, /^(city|ville)$/i);
  const roleAns = fieldValue(fd, /(role|position|poste|r[oô]le|volunteer_as|benevole|bénévole|how_would_you_like_to_help|help)/i);
  const used = /^(full_name|first_name|last_name|email|work_email|phone_number|phone|work_phone_number)$/i;
  const others = fd.filter((x: Any) => !used.test(String(x.name || ''))).map((x: Any) => pretty(String(x.name || '')) + ': ' + (Array.isArray(x.values) ? x.values.join(', ') : '')).filter((s: string) => !/:\s*$/.test(s));
  const lang = /^fr/i.test(String(form.locale || '')) ? 'fr' : (/^en/i.test(String(form.locale || '')) ? 'en' : null);
  return { id: String(lead.id), created_time: lead.created_time || null, form_id: lead.form_id || null, form_name: form.name || null, ad_name: lead.ad_name || null, campaign_name: lead.campaign_name || null,
    platform: lead.platform || null, organic: !!lead.is_organic, name, email, phone, city, role_answer: roleAns, others, language: lang };
}
async function fileLead(id: string, dry: boolean): Promise<Any> {
  const L = await readLead(id);
  const ref = 'fblead:' + L.id;
  const roleText = [L.role_answer, L.form_name].filter(Boolean).join(' / ') || 'Volunteer';
  const { data: rolesData } = await svc.rpc('wa209_volunteer_roles', { p_text: roleText });
  let roles = (rolesData || []) as string[];
  const volunteerForm = /(volunt|b[eé]n[eé]vol|serv|cook|driver|kitchen|cuisin|chauffeur)/i.test(roleText);
  if (!roles.length && volunteerForm) roles = ['volunteer'];
  const via = 'Facebook lead form' + (L.form_name ? ' "' + L.form_name + '"' : '') + (L.campaign_name ? ' (ad: ' + L.campaign_name + ')' : (L.organic ? ' (organic)' : ''));
  const message = [via, L.city ? 'City: ' + L.city : null, ...L.others].filter(Boolean).join('\n');
  const plan = { lead: L.id, to: roles.length ? 'volunteers' : 'applications', roles, role_text: roleText, name: L.name, has_email: !!L.email, has_phone: !!L.phone };
  if (dry) return { dry: true, ...plan, form: L.form_name, others: L.others.length };
  if (roles.length) {
    const { data, error } = await svc.rpc('wa209_volunteer_apply', { p: { name: L.name, email: L.email, phone: L.phone, roles, role_text: L.role_answer || L.form_name || 'Volunteer', source: 'facebook', source_ref: ref,
      applied_at: L.created_time, message, language: L.language, by: 'meta-events' } });
    if (error) throw new Error('volunteer: ' + error.message);
    return { ...plan, duplicate: !!(data && data.duplicate), application_id: data && data.application_id };
  }
  // a team role: one card per person and role within 90 days, as applications-intake does
  const { data: seen } = await svc.from('hub_candidates').select('id').like('summary', '%' + ref + '%').limit(1);
  if (seen && seen.length) return { ...plan, duplicate: true, candidate_id: seen[0].id };
  const role = (L.role_answer || L.form_name || 'Application').slice(0, 120);
  if (L.email) {
    const { data: dup } = await svc.from('hub_candidates').select('id,role').eq('email', L.email).gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString());
    const s = ((dup || []) as Any[]).find(c => String(c.role || '').toLowerCase() === role.toLowerCase());
    if (s) return { ...plan, duplicate: true, candidate_id: s.id };
  }
  const ins = await svc.from('hub_candidates').insert({ name: (L.name || L.email || 'Applicant').slice(0, 120), email: L.email, phone: L.phone, role, source: 'facebook',
    summary: ('Applied through a ' + via + (L.created_time ? ' on ' + String(L.created_time).slice(0, 10) : '') + '.\n\n' + message + '\n\n(' + ref + ')').slice(0, 4000),
    status: 'new', stage_at: new Date().toISOString(), created_at: L.created_time || new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: 'meta-events' }).select('id').single();
  if (ins.error) throw new Error('candidate: ' + ins.error.message);
  await svc.from('change_log').insert({ entity_type: 'candidate', entity_id: String(ins.data.id), field: 'applied', old_value: null, new_value: (L.name || 'Applicant') + ' for ' + role + ' (facebook lead form)', changed_by: 'meta-events' });
  return { ...plan, candidate_id: ins.data.id };
}

async function handle(row: { id: number; object: string; field: string; account_id: string; ref_id: string | null; value: Any }): Promise<{ status: string; result: string }> {
  const o = row.object, f = row.field, v = row.value || {};
  if (o === 'page' && f === 'leadgen') {
    if (!row.ref_id) return { status: 'skipped', result: 'no lead id' };
    const r = await fileLead(row.ref_id, false);
    return { status: r.duplicate ? 'skipped' : 'done', result: (r.duplicate ? 'already filed: ' : 'filed to ') + r.to + (r.application_id ? ' #' + r.application_id : '') + (r.candidate_id ? ' #' + r.candidate_id : '') };
  }
  if ((o === 'page' && (f === 'feed' || f === 'mention')) || (o === 'instagram' && (f === 'comments' || f === 'mentions' || f === 'live_comments'))) {
    if (o === 'page' && f === 'feed' && v.item && !['comment', 'post', 'status', 'photo', 'video', 'share'].includes(String(v.item))) return { status: 'skipped', result: 'feed ' + v.item };
    return { status: 'done', result: await kick('social-inbox', { action: 'sync', days: 7 }, 'inbox', 60000) };
  }
  if ((o === 'page' || o === 'instagram') && (f === 'messages' || f === 'message_echoes')) {
    const platform = o === 'page' ? 'facebook' : 'instagram';
    if (!row.ref_id) return { status: 'skipped', result: 'no sender' };
    return { status: 'done', result: await kick('social-dms', { action: 'dm_sync', platform, participant: row.ref_id }, 'dm:' + platform + ':' + row.ref_id, 5000) };
  }
  if (o === 'whatsapp_business_account' && f === 'messages') {
    return { status: 'done', result: await kick('whatsapp-send', { action: 'inbound', value: v }, 'wa:' + (row.ref_id || row.id), 0) };
  }
  return { status: 'skipped', result: 'not used: ' + o + ' ' + f };
}
async function process(ids: number[]): Promise<void> {
  for (const id of ids) {
    const { data: row } = await svc.from('meta_events').select('id, object, field, account_id, ref_id, signed, raw:value').eq('id', id).maybeSingle();
    if (!row) continue;
    const full = RAW.get(id);
    try {
      const r = await handle({ id, object: row.object, field: row.field, account_id: row.account_id, ref_id: row.ref_id, value: full ?? row.raw });
      await svc.from('meta_events').update({ status: r.status, result: r.result.slice(0, 300), processed_at: new Date().toISOString() }).eq('id', id);
    } catch (e) {
      await svc.from('meta_events').update({ status: 'error', result: String((e as Error).message || e).slice(0, 300), processed_at: new Date().toISOString() }).eq('id', id);
    } finally { RAW.delete(id); }
  }
}
const RAW = new Map<number, Any>(); // the full change (with text) lives only in memory while it is handled

/* ---------- status and subscribe ---------- */
async function status(): Promise<Any> {
  const out: Any = { app_id: APP_ID, page_id: PAGE_ID, instagram_id: IG_ID, waba_id: WABA_ID };
  out.app_secret = !!(await secretOrNull('META_APP_SECRET'));
  out.verify_token = !!(await secretOrNull('META_VERIFY_TOKEN'));
  let t: { sys: string; page: string };
  try { t = await tokens(); out.page_token = t.page !== t.sys; } catch (e) { out.error = String((e as Error).message); return out; }
  const probe = async (k: string, f: () => Promise<Any>) => { try { out[k] = await f(); } catch (e) { out[k] = { error: String((e as Error).message || e).slice(0, 200) }; } };
  await probe('page_subscription', async () => { const r = await graph('GET', '/' + PAGE_ID + '/subscribed_apps', t.page); const me = ((r.data || []) as Any[]).find(a => String(a.id) === APP_ID); return me ? { subscribed: true, fields: me.subscribed_fields || [] } : { subscribed: false, apps: ((r.data || []) as Any[]).map(a => a.name) }; });
  await probe('messenger', async () => { const r = await graph('GET', '/' + PAGE_ID + '/conversations', t.page, { platform: 'messenger', fields: 'id,updated_time,message_count', limit: '25' }); const d = (r.data || []) as Any[]; return { readable: true, conversations: d.length, latest: d[0] ? d[0].updated_time : null }; });
  await probe('instagram_dm', async () => { const r = await graph('GET', '/' + PAGE_ID + '/conversations', t.page, { platform: 'instagram', fields: 'id,updated_time', limit: '25' }); const d = (r.data || []) as Any[]; return { readable: true, conversations: d.length, latest: d[0] ? d[0].updated_time : null }; });
  await probe('lead_forms', async () => { const r = await graph('GET', '/' + PAGE_ID + '/leadgen_forms', t.page, { fields: 'id,name,status,leads_count,locale', limit: '50' }); return ((r.data || []) as Any[]).map(f => ({ id: f.id, name: f.name, status: f.status, leads: f.leads_count, locale: f.locale })); });
  await probe('whatsapp_subscription', async () => { const r = await graph('GET', '/' + WABA_ID + '/subscribed_apps', t.sys); const apps = ((r.data || []) as Any[]).map(a => a.whatsapp_business_api_data || a); return { subscribed: apps.some((a: Any) => String(a.id) === APP_ID), apps: apps.map((a: Any) => a.name) }; });
  await probe('ad_accounts', async () => { const r = await graph('GET', '/' + BUSINESS_ID + '/owned_ad_accounts', t.sys, { fields: 'id,name,account_status,currency' }); return ((r.data || []) as Any[]).map(a => ({ id: a.id, name: a.name, status: a.account_status, currency: a.currency })); });
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: ev } = await svc.from('meta_events').select('object, field, status, received_at').gte('received_at', since).order('received_at', { ascending: false }).limit(500);
  const counts: Record<string, number> = {};
  for (const e of ((ev || []) as Any[])) { const k = e.object + ' ' + e.field + ' ' + e.status; counts[k] = (counts[k] || 0) + 1; }
  out.events_7d = counts; out.last_event = ev && ev[0] ? ev[0].received_at : null;
  return out;
}
async function subscribe(): Promise<Any> {
  const t = await tokens();
  const out: Any = {};
  try { out.page = await graph('POST', '/' + PAGE_ID + '/subscribed_apps', t.page, { subscribed_fields: PAGE_FIELDS.join(',') }); } catch (e) { out.page = { error: String((e as Error).message) }; }
  try { out.whatsapp = await graph('POST', '/' + WABA_ID + '/subscribed_apps', t.sys); } catch (e) { out.whatsapp = { error: String((e as Error).message) }; }
  return out;
}

async function appSubscribe(): Promise<Any> {
  const secret = await secretOrNull('META_APP_SECRET');
  if (!secret) return { error: 'Add META_APP_SECRET to the vault first (App settings > Basic > App secret).' };
  const verify = await getSecret('META_VERIFY_TOKEN');
  const appToken = APP_ID + '|' + secret;
  const cb = SUPABASE_URL + '/functions/v1/meta-events';
  const objects: Array<[string, string[]]> = [
    ['page', ['feed', 'mention', 'messages', 'message_echoes', 'leadgen']],
    ['instagram', ['comments', 'mentions', 'messages']],
    ['whatsapp_business_account', ['messages']],
  ];
  const out: Any = {};
  for (const [object, fields] of objects) {
    try { out[object] = await graph('POST', '/' + APP_ID + '/subscriptions', appToken, { object, callback_url: cb, verify_token: verify, fields: fields.join(','), include_values: 'true' }); }
    catch (e) { out[object] = { error: String((e as Error).message || e).slice(0, 200) }; }
  }
  try { const r = await graph('GET', '/' + APP_ID + '/subscriptions', appToken); out.now = ((r.data || []) as Any[]).map(x => ({ object: x.object, active: x.active, fields: ((x.fields || []) as Any[]).map(f => f.name) })); } catch (_) { /* fine */ }
  return out;
}
async function probe(path: string, params: Record<string, string>): Promise<Any> {
  const p = '/' + String(path || '').replace(/^\/+/, '');
  const ok = [PAGE_ID, IG_ID, WABA_ID, BUSINESS_ID].some(id => p === '/' + id || p.startsWith('/' + id + '/') || p.startsWith('/' + id + '?'));
  if (!ok || /access_token/i.test(p + JSON.stringify(params || {}))) throw new Error('probe only reads under our Page, Instagram, WhatsApp or business ids');
  const t = await tokens();
  const clean: Record<string, string> = {}; for (const k of Object.keys(params || {})) clean[k] = String(params[k]).slice(0, 300);
  return await graph('GET', p, p.startsWith('/' + WABA_ID) || p.startsWith('/' + BUSINESS_ID) ? t.sys : t.page, clean);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode'), tok = url.searchParams.get('hub.verify_token') || '', ch = url.searchParams.get('hub.challenge') || '';
    const want = await secretOrNull('META_VERIFY_TOKEN');
    if (mode === 'subscribe' && want && same(tok, want) && /^[\w.-]{1,200}$/.test(ch)) {
      try { await svc.from('change_log').insert({ entity_type: 'meta_webhook', entity_id: APP_ID, field: 'verified', old_value: null, new_value: 'Meta checked the callback URL', changed_by: 'meta-events' }); } catch (_) { /* audit */ }
      return new Response(ch, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const raw = await req.text();
  let body: Any = {}; try { body = JSON.parse(raw || '{}'); } catch (_) { return json({ error: 'bad json' }, 400); }

  // Meta's events
  if (body.object && Array.isArray(body.entry)) {
    const signed = await signature(raw, req.headers.get('x-hub-signature-256'));
    const list = changes(body);
    const rows = list.map(c => ({ object: c.object, field: c.field, account_id: c.account_id, ref_id: c.ref_id, signed, status: signed === false ? 'skipped' : 'new', result: signed === false ? 'the signature did not match' : null, value: strip(c.value) }));
    if (!rows.length) return json({ ok: true });
    const { data: ins } = await svc.from('meta_events').insert(rows).select('id');
    const ids = ((ins || []) as Any[]).map(r => Number(r.id));
    if (signed !== false) {
      ids.forEach((id, i) => RAW.set(id, list[i].value));
      // @ts-ignore EdgeRuntime is the Supabase runtime
      const bg = process(ids); try { EdgeRuntime.waitUntil(bg); } catch (_) { await bg; }
    }
    return json({ ok: true });
  }

  // the Hub or the pipeline
  const who = await caller(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const action = String(body.action || 'status');
  try {
    if (action === 'status') return json(await status());
    if (action === 'subscribe') {
      const r = await subscribe();
      try { await svc.from('change_log').insert({ entity_type: 'meta_webhook', entity_id: PAGE_ID, field: 'subscribe', old_value: null, new_value: 'Page ' + (r.page && r.page.success ? 'subscribed (' + PAGE_FIELDS.join(', ') + ')' : 'not subscribed') + '; WhatsApp ' + (r.whatsapp && r.whatsapp.success ? 'subscribed' : 'not subscribed'), changed_by: who }); } catch (_) { /* audit */ }
      return json(r);
    }
    if (action === 'app_subscribe') {
      const r = await appSubscribe();
      try { await svc.from('change_log').insert({ entity_type: 'meta_webhook', entity_id: APP_ID, field: 'app_subscribe', old_value: null, new_value: r.error ? 'not done: no app secret' : 'callback set for ' + ['page', 'instagram', 'whatsapp_business_account'].filter(o => r[o] && r[o].success).join(', '), changed_by: who }); } catch (_) { /* audit */ }
      return json(r);
    }
    if (action === 'probe') return json(await probe(String(body.path || ''), (body.params || {}) as Record<string, string>));
    if (action === 'lead') { const id = String(body.id || ''); if (!/^\d+$/.test(id)) return json({ error: 'lead id' }, 400); return json(await fileLead(id, body.dry !== false)); }
    if (action === 'replay') {
      const id = Number(body.id); if (!id) return json({ error: 'which event?' }, 400);
      await process([id]);
      const { data } = await svc.from('meta_events').select('id, status, result').eq('id', id).maybeSingle();
      return json({ ok: true, event: data });
    }
    if (action === 'prune') {
      /* no row is removed from here: old rows lose their value (the database's sweep removes nothing either) */
      const { count } = await svc.from('meta_events').update({ value: null }, { count: 'exact' }).lt('received_at', new Date(Date.now() - 60 * 86400000).toISOString()).not('value', 'is', null);
      return json({ ok: true, cleared: count || 0 });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
