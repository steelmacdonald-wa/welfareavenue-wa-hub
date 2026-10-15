// Welfare Avenue: whatsapp-send (v1, 15/10/26, wave254)
// Steel, 14/10/26 (the Meta additions): "WhatsApp — reminders and re-confirm texts as a second channel next to Quo SMS ...
// Build it against the test number; production waits on Steel's three items" (a dedicated number, business verification,
// a payment method). WhatsApp Cloud API through the HUB-Analytics app (WABA 984036304713487; the test number
// +1 555 676 5057 is phone id 1442123962307619, app_config sms_whatsapp_phone_id).
// What it sends: approved templates only to start a conversation (wa_serving_reminder, wa_still_in, in English and French,
// mirrored from the Quo confirmation and "still in?" texts by trg_wa254_mirror), and a short free-text thank-you after a
// person's reply (inside WhatsApp's 24-hour window). The Cloud API cannot post into WhatsApp groups.
// Switches (admins only, app_config): sms_whatsapp_mode off | test | live (off: nothing goes; test: only the numbers in
// sms_whatsapp_test_phones, which Meta's test number also requires as registered recipients; live: everyone),
// sms_whatsapp_channel off | also. Both start off. Same hours as the SMS (wa191_sms_window, 9 am to 7 pm Toronto); nobody
// who said STOP on WhatsApp or SMS (crm_contacts.whatsapp_opt_out, sms_opt_out).
// Trigger: cron wa-whatsapp-drain (every 15 minutes, only while something is queued); meta-events (inbound, the moment Meta
// reports a reply or a delivery status); the Hub (status, templates, test).
// Auth: verify_jwt off; x-wa-secret for drain and inbound; a signed-in staff member for status; an admin (is_hub_admin) for
// templates_create and test.
// Actions (POST): status, templates_create, drain, inbound {value} (Meta's change value: statuses and messages),
//   test {to?, template?} (admins: one template to the test phones only, whatever the mode; never run by a build).
// Tables: whatsapp_messages (write), crm_contacts (read: opt-outs), app_config (read), change_log (template submissions and
// tests). RPC: wa254_inbound. Vault: META_SYSTEM_TOKEN (whatsapp_business_messaging, whatsapp_business_management).
// Side effects: WhatsApp messages to people, only as the switches allow; template submissions to Meta for review.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const WABA_ID = '984036304713487';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;

/* the templates the Hub uses (submitted by templates_create; Meta reviews each) */
type Tpl = { name: string; lang: string; category: string; body: string; example: string[]; buttons: string[]; footer: string };
const TEMPLATES: Tpl[] = [
  { name: 'wa_serving_reminder', lang: 'en', category: 'UTILITY',
    body: "Hi {{1}}, it's Welfare Avenue! You're on the team as {{2}} on {{3}}. Can you still make it? Tap a button below or reply YES or NO.",
    example: ['Sam', 'a server', 'Sunday, October 19 at 12:00 pm'], buttons: ["Yes, I'll be there", "I can't make it"], footer: 'Reply STOP to stop these messages' },
  { name: 'wa_serving_reminder', lang: 'fr', category: 'UTILITY',
    body: "Bonjour {{1}}, ici Welfare Avenue! Vous êtes dans l'équipe comme {{2}} le {{3}}. Pouvez-vous toujours venir? Touchez un bouton ou répondez OUI ou NON.",
    example: ['Sam', 'serveur·se', 'dimanche 19 octobre à 12h00'], buttons: ["Oui, j'y serai", 'Je ne peux pas'], footer: 'Répondez STOP pour ne plus recevoir ces messages' },
  { name: 'wa_still_in', lang: 'en', category: 'UTILITY',
    body: "Hi {{1}}, it's Welfare Avenue! A while back you signed up to volunteer with us as {{2}}. Are you still up for it? Tap a button below or reply YES or NO.",
    example: ['Sam', 'a photographer'], buttons: ['Yes, count me in', 'Not any more'], footer: 'Reply STOP to stop these messages' },
  { name: 'wa_still_in', lang: 'fr', category: 'UTILITY',
    body: "Bonjour {{1}}, ici Welfare Avenue! Il y a quelque temps, vous vous êtes inscrit·e pour faire du bénévolat avec nous comme {{2}}. Êtes-vous toujours partant·e? Touchez un bouton ou répondez OUI ou NON.",
    example: ['Sam', 'photographe'], buttons: ['Oui, comptez sur moi', 'Plus maintenant'], footer: 'Répondez STOP pour ne plus recevoir ces messages' },
];
function fill(name: string, lang: string, params: string[]): string {
  const t = TEMPLATES.find(x => x.name === name && x.lang === lang) || TEMPLATES.find(x => x.name === name);
  if (!t) return name + (params.length ? ': ' + params.join(', ') : '');
  return t.body.replace(/\{\{(\d+)\}\}/g, (_m, n) => String(params[Number(n) - 1] ?? ''));
}

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return String(data);
}
type Me = { who: string; staff: boolean; admin: boolean; auto: boolean };
async function caller(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { who: 'automation', staff: true, admin: true, auto: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase(); if (!email) return null;
  const { data: st } = await asUser.rpc('is_wa_staff'); if (st !== true) return null;
  const { data: ad } = await asUser.rpc('is_hub_admin');
  return { who: email, staff: true, admin: ad === true, auto: false };
}
async function cfg(key: string): Promise<string> { const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle(); return data ? String(data.value || '') : ''; }
function digits(p: string | null | undefined): string { const d = String(p || '').replace(/\D/g, ''); return d.length === 11 && d.startsWith('1') ? d.slice(1) : (d.length === 10 ? d : ''); }
async function graph(method: 'GET' | 'POST', path: string, token: string, body?: Any, params: Record<string, string> = {}): Promise<Any> {
  const u = new URL(GRAPH + path); for (const k of Object.keys(params)) u.searchParams.set(k, params[k]);
  const res = await fetch(u.toString(), { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
  return b;
}

/* ---------- sending ---------- */
async function sendOne(token: string, phoneId: string, row: Any): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const to = '1' + digits(row.phone);
  const payload: Any = row.template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: row.template, language: { code: row.lang || 'en' },
        components: [{ type: 'body', parameters: ((row.params || []) as string[]).map(t => ({ type: 'text', text: String(t).replace(/\s+/g, ' ').slice(0, 300) })) }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: String(row.body || '').slice(0, 4000) } };
  if (row.template === 'hello_world') payload.template = { name: 'hello_world', language: { code: 'en_US' } };
  try { const r = await graph('POST', '/' + phoneId + '/messages', token, payload); return { ok: true, wamid: r.messages && r.messages[0] ? String(r.messages[0].id) : undefined }; }
  catch (e) { return { ok: false, error: String((e as Error).message || e).slice(0, 300) }; }
}
async function optedOut(): Promise<Set<string>> {
  const { data } = await svc.from('crm_contacts').select('phones').or('whatsapp_opt_out.eq.true,sms_opt_out.eq.true').is('merged_into', null);
  const s = new Set<string>(); for (const c of ((data || []) as Any[])) for (const p of (c.phones || [])) { const d = digits(p); if (d) s.add(d); }
  return s;
}
async function drain(): Promise<Any> {
  const mode = (await cfg('sms_whatsapp_mode')) || 'off';
  const tests = (await cfg('sms_whatsapp_test_phones')).split(',').map(digits).filter(Boolean);
  const phoneId = (await cfg('sms_whatsapp_phone_id')) || '1442123962307619';
  const { data: rows } = await svc.from('whatsapp_messages').select('*').eq('direction', 'out').eq('status', 'queued').order('id', { ascending: true }).limit(60);
  const list = (rows || []) as Any[];
  if (!list.length) return { mode, sent: 0, skipped: 0, failed: 0, waiting: 0 };
  const { data: open } = await svc.rpc('wa191_sms_window');
  const stopped = await optedOut();
  let token = '', sent = 0, skipped = 0, failed = 0, waiting = 0;
  for (const r of list) {
    const d = digits(r.phone);
    const why = mode !== 'test' && mode !== 'live' ? 'WhatsApp is off (sms_whatsapp_mode ' + mode + ')'
      : (mode === 'test' && tests.indexOf(d) < 0) ? 'test mode: only the WhatsApp test phones'
      : !d ? 'no phone number' : stopped.has(d) ? 'they said STOP' : '';
    if (why) { await svc.from('whatsapp_messages').update({ status: 'skipped', error: why }).eq('id', r.id).eq('status', 'queued'); skipped++; continue; }
    if (open !== true) { waiting++; continue; }
    const { data: claimed } = await svc.from('whatsapp_messages').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'queued').select('id');
    if (!claimed || !claimed.length) continue;
    if (!token) token = await getSecret('META_SYSTEM_TOKEN');
    const out = await sendOne(token, phoneId, r);
    if (out.ok) { sent++; await svc.from('whatsapp_messages').update({ wamid: out.wamid || null, body: r.body || (r.template ? fill(r.template, r.lang || 'en', r.params || []) : r.body) }).eq('id', r.id); }
    else { failed++; await svc.from('whatsapp_messages').update({ status: 'failed', sent_at: null, error: out.error || 'failed' }).eq('id', r.id); }
    await new Promise(res => setTimeout(res, 200));
  }
  return { mode, sent, skipped, failed, waiting, window_open: open === true };
}

/* ---------- what Meta reports ---------- */
async function inbound(value: Any): Promise<Any> {
  const out: Any = { statuses: 0, messages: 0, handled: [] as string[] };
  for (const s of ((value && value.statuses) || []) as Any[]) {
    const st = String(s.status || ''); const at = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
    const patch: Any = {};
    if (st === 'delivered') { patch.status = 'delivered'; patch.delivered_at = at; }
    else if (st === 'read') { patch.status = 'read'; patch.read_at = at; }
    else if (st === 'failed') { patch.status = 'failed'; patch.error = String(((s.errors || [])[0] || {}).title || ((s.errors || [])[0] || {}).message || 'failed').slice(0, 300); }
    else if (st === 'sent') { patch.status = 'sent'; }
    if (!Object.keys(patch).length || !s.id) continue;
    let q = svc.from('whatsapp_messages').update(patch).eq('wamid', String(s.id));
    if (st === 'sent' || st === 'delivered') q = q.in('status', ['sent', 'delivered', 'queued']);
    await q; out.statuses++;
  }
  for (const m of ((value && value.messages) || []) as Any[]) {
    const text = m.text ? String(m.text.body || '') : (m.button ? String(m.button.text || m.button.payload || '') : (m.interactive && m.interactive.button_reply ? String(m.interactive.button_reply.title || '') : ''));
    const button = m.button ? String(m.button.text || m.button.payload || '') : (m.interactive && m.interactive.button_reply ? String(m.interactive.button_reply.title || '') : '');
    const { data, error } = await svc.rpc('wa254_inbound', { p: { phone: String(m.from || ''), text: m.button ? '' : (text || (m.type ? '[' + m.type + ']' : '')), button, wamid: String(m.id || ''), at: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : null } });
    out.messages++; out.handled.push(error ? 'error: ' + error.message : String((data && data.handled) || ''));
  }
  if (out.handled.some((h: string) => ['confirmed', 'declined', 'pool_yes', 'pool_no'].includes(h))) out.drain = await drain();
  return out;
}

/* ---------- templates ---------- */
async function templatesList(token: string): Promise<Any[]> {
  const r = await graph('GET', '/' + WABA_ID + '/message_templates', token, undefined, { fields: 'name,status,language,category,rejected_reason', limit: '100' });
  return (r.data || []) as Any[];
}
async function templatesCreate(token: string): Promise<Any> {
  const have = await templatesList(token);
  const out: Any[] = [];
  for (const t of TEMPLATES) {
    if (have.some(h => h.name === t.name && String(h.language) === t.lang)) { out.push({ name: t.name, lang: t.lang, already: true }); continue; }
    const body = { name: t.name, language: t.lang, category: t.category, components: [
      { type: 'BODY', text: t.body, example: { body_text: [t.example] } },
      { type: 'FOOTER', text: t.footer },
      { type: 'BUTTONS', buttons: t.buttons.map(b => ({ type: 'QUICK_REPLY', text: b })) },
    ] };
    try { const r = await graph('POST', '/' + WABA_ID + '/message_templates', token, body); out.push({ name: t.name, lang: t.lang, id: r.id, status: r.status, category: r.category }); }
    catch (e) { out.push({ name: t.name, lang: t.lang, error: String((e as Error).message || e).slice(0, 200) }); }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const me = await caller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Any;
  const action = String(body.action || 'status');
  try {
    if (action === 'drain') { if (!me.auto) return json({ error: 'the pipeline only' }, 403); return json({ ok: true, ...(await drain()) }); }
    if (action === 'inbound') { if (!me.auto) return json({ error: 'the pipeline only' }, 403); return json({ ok: true, ...(await inbound(body.value || {})) }); }
    if (action === 'status') {
      const token = await getSecret('META_SYSTEM_TOKEN');
      const phoneId = (await cfg('sms_whatsapp_phone_id')) || '1442123962307619';
      const out: Any = { mode: (await cfg('sms_whatsapp_mode')) || 'off', channel: (await cfg('sms_whatsapp_channel')) || 'off', test_phones: (await cfg('sms_whatsapp_test_phones')).split(',').map(digits).filter(Boolean).length, phone_id: phoneId, is_admin: me.admin };
      try { out.number = await graph('GET', '/' + phoneId, token, undefined, { fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,name_status,platform_type' }); } catch (e) { out.number = { error: String((e as Error).message) }; }
      try { out.account = await graph('GET', '/' + WABA_ID, token, undefined, { fields: 'name,account_review_status,business_verification_status' }); } catch (e) { out.account = { error: String((e as Error).message) }; }
      try { out.templates = (await templatesList(token)).filter(t => TEMPLATES.some(x => x.name === t.name)).map(t => ({ name: t.name, language: t.language, status: t.status, category: t.category, rejected_reason: t.rejected_reason || null })); } catch (e) { out.templates = { error: String((e as Error).message) }; }
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: rows } = await svc.from('whatsapp_messages').select('direction, status').gte('created_at', since).limit(5000);
      const counts: Record<string, number> = {}; for (const r of ((rows || []) as Any[])) { const k = r.direction + ' ' + r.status; counts[k] = (counts[k] || 0) + 1; }
      out.last_30_days = counts;
      return json({ ok: true, ...out });
    }
    if (!me.admin) return json({ error: 'admins only' }, 403);
    if (action === 'templates_create') {
      const token = await getSecret('META_SYSTEM_TOKEN');
      const r = await templatesCreate(token);
      try { await svc.from('change_log').insert({ entity_type: 'whatsapp', entity_id: WABA_ID, field: 'templates', old_value: null, new_value: r.map((x: Any) => x.name + '/' + x.lang + ': ' + (x.already ? 'already there' : (x.error ? 'error' : (x.status || 'submitted')))).join('; ').slice(0, 500), changed_by: me.who }); } catch (_) { /* audit */ }
      return json({ ok: true, templates: r });
    }
    if (action === 'test') {
      if (me.auto) return json({ error: 'a person sends a test, never the pipeline' }, 403);
      const tests = (await cfg('sms_whatsapp_test_phones')).split(',').map(digits).filter(Boolean);
      const to = digits(body.to) || tests[0];
      if (!to || tests.indexOf(to) < 0) return json({ error: 'Tests go only to a number in sms_whatsapp_test_phones' }, 400);
      const tpl = String(body.template || 'hello_world');
      const lang = body.lang === 'fr' ? 'fr' : 'en';
      const params = tpl === 'wa_serving_reminder' ? ['Steel', lang === 'fr' ? 'serveur·se' : 'a server', lang === 'fr' ? 'dimanche à 12h00' : 'Sunday at 12:00 pm'] : (tpl === 'wa_still_in' ? ['Steel', lang === 'fr' ? 'photographe' : 'a photographer'] : []);
      const ins = await svc.from('whatsapp_messages').insert({ phone: '+1' + to, kind: 'test', template: tpl, lang, params, body: tpl === 'hello_world' ? 'hello_world (Meta sample)' : fill(tpl, lang, params), status: 'sent', sent_at: new Date().toISOString(), sent_by: me.who }).select('*').single();
      if (ins.error) throw new Error(ins.error.message);
      const token = await getSecret('META_SYSTEM_TOKEN');
      const r = await sendOne(token, (await cfg('sms_whatsapp_phone_id')) || '1442123962307619', ins.data);
      await svc.from('whatsapp_messages').update(r.ok ? { wamid: r.wamid || null } : { status: 'failed', error: r.error }).eq('id', ins.data.id);
      try { await svc.from('change_log').insert({ entity_type: 'whatsapp', entity_id: String(ins.data.id), field: 'test', old_value: null, new_value: tpl + ' to a test phone: ' + (r.ok ? 'sent' : 'failed'), changed_by: me.who }); } catch (_) { /* audit */ }
      return json({ ok: r.ok, error: r.error || null });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
