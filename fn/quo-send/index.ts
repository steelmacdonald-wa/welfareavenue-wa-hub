// Welfare Avenue: quo-send (v5, wave191e, 01/10/26)
// v5 (wave191e): texts to volunteers go only between 9 am and 7 pm Toronto time (app_config sms_window_start and
// sms_window_end, Steel 01/10/26), thank-yous included; outside it they wait in the queue for the quarter-hour tick.
// A Text volunteers send outside the hours is queued (kind manual) and goes at 9 am. drain sends the Find volunteers
// invitations (kind recruit) under sms_mode like every automatic text, and a person's own words (kind manual, kind reply
// from the Hub's conversations) whatever sms_mode says, as Text volunteers always did. STOP is checked again just before
// sending. 'thread': the Quo conversation with one number, what was typed in the Quo app included.
// v4 (wave172): drain also sends the sign-up notices (kind signup) and the survey texts (kind survey).
// Purpose: every text the Hub sends from the ops line (438) 808-7754 through Quo (OpenPhone), logged in quo_messages.
// Trigger: staff in the Hub (Text volunteers, Send me a test) with their sign-in; the Hub itself (cron wa-sms-tick,
//   wa171_text_to_confirm, quo-events) with the trigger secret.
// Auth: the trigger secret, or a signed-in leader, HR person or admin (audit 17: no longer any staff address).
// Actions:
//   (none) / 'send'  the Text volunteers window: {message, person_ids|phones, event_id?, event_date?, role?, dry_run}
//                    {{first_name}} {{event_date}} {{confirm_link}} (the personal link, now hub.welfareavenue.com/c/<token>).
//   'drain'          trigger secret only: sends what is queued (confirm, signup, survey, itinerary, recruit, ack, and the
//                    manual and reply texts staff wrote outside the hours), at most 60 a call, 250 ms apart. Only between
//                    sms_window_start and sms_window_end Toronto (9 am to 7 pm); the rest waits. sms_mode decides for the
//                    automatic kinds: off skips them, test sends them only to app_config sms_test_phones, live sends.
//                    manual and reply go whatever the mode. Anyone who texted STOP since it was queued is skipped.
//                    A number Quo refuses (a US number the carrier registration does not cover, for example) is
//                    logged as failed and never retried (Steel, 29/09/26).
//   'test_confirm'   admins: {roster_id}: that row's confirmation text, with ?test=1 on the link (the page then saves
//                    nothing), sent only to the test phones, whatever the mode.
//   'numbers'        admins or the trigger secret: the workspace's Quo numbers (id, number, name), to check
//                    app_config quo_phone_number_id is the ops line.
//   'webhook_setup'  admins or the trigger secret: creates the Quo webhook (message.received) to quo-events, keeps its
//                    signing key in the vault (QUO_WEBHOOK_SECRET) and its id in app_config quo_webhook_id.
//   'webhook_status' admins or the trigger secret: the webhooks Quo has.
//   'thread'         {phone}: the last 50 texts between the ops line and that number as Quo has them (both ways, what
//                    was typed in the Quo app included), for the Hub's conversations.
// Tables: quo_messages (insert, update), event_roster (confirm_token, only for the manual {{confirm_link}}), app_config (read;
//   quo_webhook_id), volunteer_people (read), vault via wa_vault_set. Side effects: texts through Quo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

const FROM_NUMBER = '+14388087754';
const OP = 'https://api.openphone.com/v1';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function cfg(key: string): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return String((data && data.value) || '');
}

type Who = { ok: boolean; who: string; system: boolean; admin: boolean };
async function authorize(req: Request): Promise<Who> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return { ok: true, who: 'system', system: true, admin: true };
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (!email) return { ok: false, who: '', system: false, admin: false };
    const [a, l, h] = await Promise.all([asUser.rpc('is_wa_admin'), asUser.rpc('is_wa_leader'), asUser.rpc('wa_is_hr')]);
    const admin = a.data === true;
    if (admin || l.data === true || h.data === true) return { ok: true, who: email, system: false, admin };
  }
  return { ok: false, who: '', system: false, admin: false };
}

function normPhone(p: unknown): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}
function firstName(full: string): string {
  return String(full || '').trim().split(/\s+/)[0] || 'there';
}
function render(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}
function newToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}
function torontoHour(): number {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false }).format(new Date());
  return Number(s) % 24;
}
async function windowOpen(): Promise<boolean> {
  const a = parseInt(await cfg('sms_window_start'), 10), b = parseInt(await cfg('sms_window_end'), 10);
  const start = Number.isFinite(a) ? a : 9, end = Number.isFinite(b) ? b : 19, h = torontoHour();
  return h >= start && h < end;
}
const PERSON_KINDS = ['manual', 'reply'];
async function optedOutPhones(): Promise<Set<string>> {
  const { data } = await svc.from('crm_contacts').select('phones').eq('sms_opt_out', true).is('merged_into', null);
  const out = new Set<string>();
  (data || []).forEach((c: any) => (c.phones || []).map(normPhone).filter(Boolean).forEach((x: string) => out.add(x)));
  return out;
}
async function testPhones(): Promise<string[]> {
  return (await cfg('sms_test_phones')).split(',').map(normPhone).filter(Boolean);
}

async function quoSend(key: string, to: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(OP + '/messages', {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, from: FROM_NUMBER, to: [to] }),
    });
    const body = await res.text();
    if (res.ok) {
      let id: string | undefined;
      try { id = JSON.parse(body)?.data?.id; } catch (_) { /* fine */ }
      return { ok: true, id };
    }
    return { ok: false, error: (res.status + ' ' + body).slice(0, 300) };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e).slice(0, 300) };
  }
}

/* ---------- drain: what the Hub queued ---------- */
async function drain(): Promise<Record<string, unknown>> {
  const mode = (await cfg('sms_mode')) || 'off';
  const { data: rows } = await svc.from('quo_messages').select('id, phone, body, kind, roster_id')
    .eq('direction', 'out').eq('status', 'queued').order('id', { ascending: true }).limit(60);
  const list = rows || [];
  if (!list.length) return { mode, sent: 0, skipped: 0, failed: 0, waiting: 0 };
  const open = await windowOpen();
  const tests = await testPhones();
  const stopped = await optedOutPhones();
  let key = '';
  let sent = 0, skipped = 0, failed = 0, waiting = 0;
  for (const r of list) {
    const d = normPhone(r.phone);
    const person = PERSON_KINDS.indexOf(String(r.kind)) >= 0;
    if (!person && mode !== 'test' && mode !== 'live') {
      await svc.from('quo_messages').update({ status: 'skipped', error: 'texts are off (sms_mode ' + mode + ')' }).eq('id', r.id).eq('status', 'queued');
      skipped++; continue;
    }
    if (!person && mode === 'test' && tests.indexOf(d) < 0) {
      await svc.from('quo_messages').update({ status: 'skipped', error: 'test mode: only the test phones get texts' }).eq('id', r.id).eq('status', 'queued');
      skipped++; continue;
    }
    if (!d || stopped.has(d)) {
      await svc.from('quo_messages').update({ status: 'skipped', error: d ? 'they texted STOP' : 'no phone number' }).eq('id', r.id).eq('status', 'queued');
      skipped++; continue;
    }
    if (!open) { waiting++; continue; }
    // claim the row first, so two drains never send it twice
    const { data: claimed } = await svc.from('quo_messages').update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', r.id).eq('status', 'queued').select('id');
    if (!claimed || !claimed.length) continue;
    if (!key) key = await getSecret('QUO_API_KEY');
    const out = await quoSend(key, '+1' + d, String(r.body));
    if (out.ok) { sent++; if (out.id) await svc.from('quo_messages').update({ quo_id: out.id }).eq('id', r.id); }
    else { failed++; await svc.from('quo_messages').update({ status: 'failed', sent_at: null, error: out.error || 'failed' }).eq('id', r.id); }
    await new Promise(res => setTimeout(res, 250));
  }
  return { mode, sent, skipped, failed, waiting, window_open: open };
}

/* ---------- a conversation as Quo has it ---------- */
async function thread(phone: string): Promise<Record<string, unknown>> {
  const d = normPhone(phone);
  if (!d) return { error: 'which number?' };
  const key = await getSecret('QUO_API_KEY');
  const pn = await cfg('quo_phone_number_id');
  if (!pn) return { error: 'app_config quo_phone_number_id is not set' };
  const url = OP + '/messages?phoneNumberId=' + encodeURIComponent(pn) + '&participants[]=' + encodeURIComponent('+1' + d) + '&maxResults=50';
  const res = await fetch(url, { headers: { 'Authorization': key } });
  const b: any = await res.json().catch(() => ({}));
  if (!res.ok) return { error: 'quo ' + res.status, detail: JSON.stringify(b).slice(0, 200) };
  const messages = ((b && b.data) || []).map((m: any) => ({
    id: m.id, dir: String(m.direction || '') === 'incoming' ? 'in' : 'out', text: String(m.text ?? m.content ?? '').slice(0, 2000),
    at: m.createdAt || null, status: m.status || null, by: m.userId || null,
  }));
  return { phone: d, messages };
}

/* ---------- the Quo webhook ---------- */
async function webhookSetup(): Promise<Record<string, unknown>> {
  const key = await getSecret('QUO_API_KEY');
  const url = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/quo-events';
  const numberId = await cfg('quo_phone_number_id');
  // the current API (Quo-Api-Version 2026-03-30) first, then the older OpenPhone v1 endpoint
  let res = await fetch('https://api.quo.com/webhooks', {
    method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json', 'Quo-Api-Version': '2026-03-30' },
    body: JSON.stringify({ url, events: ['message.received'], label: 'Welfare Avenue Hub: volunteer replies' }),
  });
  let api = 'quo-2026-03-30';
  let text = await res.text();
  if (!res.ok) {
    const first = res.status + ' ' + text.slice(0, 200);
    res = await fetch(OP + '/webhooks/messages', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events: ['message.received'], label: 'Welfare Avenue Hub: volunteer replies', resourceIds: numberId ? [numberId] : undefined }),
    });
    api = 'openphone-v1';
    text = await res.text();
    if (!res.ok) return { ok: false, error: 'quo refused: ' + first + ' / v1 ' + res.status + ' ' + text.slice(0, 200) };
  }
  let body: any = {};
  try { body = JSON.parse(text); } catch (_) { /* fine */ }
  const d = body.data || body;
  const secret = d.key || d.signingKey || d.secret;
  if (!secret) return { ok: false, error: 'webhook created but no signing key returned', api, id: d.id };
  await svc.rpc('wa_vault_set', { p_name: 'QUO_WEBHOOK_SECRET', p_value: String(secret), p_note: 'wave171 (planned as wave169a): signs the Quo webhook to quo-events' });
  await svc.from('app_config').upsert({ key: 'quo_webhook_id', value: String(d.id || '') + ' (' + api + ')', updated_at: new Date().toISOString() });
  await svc.from('change_log').insert({ entity_type: 'quo_webhook', entity_id: String(d.id || ''), field: 'created', old_value: null, new_value: url + ' ' + api, changed_by: 'quo-send v3' });
  return { ok: true, id: d.id, api, url, events: d.events || ['message.received'] };
}
async function webhookStatus(): Promise<Record<string, unknown>> {
  const key = await getSecret('QUO_API_KEY');
  const out: Record<string, unknown> = {};
  try {
    const a = await fetch('https://api.quo.com/webhooks', { headers: { 'Authorization': key, 'Quo-Api-Version': '2026-03-30' } });
    out.quo = { status: a.status, body: (await a.text()).slice(0, 1500) };
  } catch (e) { out.quo = String(e); }
  try {
    const b = await fetch(OP + '/webhooks', { headers: { 'Authorization': key } });
    out.v1 = { status: b.status, body: (await b.text()).slice(0, 1500) };
  } catch (e) { out.v1 = String(e); }
  return out;
}
async function numbers(): Promise<Record<string, unknown>> {
  const key = await getSecret('QUO_API_KEY');
  const r = await fetch(OP + '/phone-numbers', { headers: { 'Authorization': key } });
  const b: any = await r.json().catch(() => ({}));
  const list = ((b && b.data) || []).map((n: any) => ({ id: n.id, number: n.number || n.formattedNumber, name: n.name }));
  return { status: r.status, numbers: list, configured: await cfg('quo_phone_number_id') };
}

/* ---------- a test of one confirmation text, to the test phones ---------- */
async function testConfirm(rosterId: number, who: string): Promise<Record<string, unknown>> {
  const { data: row } = await svc.from('event_roster').select('id, event_id, person_id, confirm_token').eq('id', rosterId).maybeSingle();
  if (!row) return { error: 'no such roster row' };
  if (!row.confirm_token) await svc.from('event_roster').update({ confirm_token: newToken() }).eq('id', rosterId);
  const { data: text } = await svc.rpc('wa171_confirm_text', { p_roster: rosterId, p_test: true });
  if (!text) return { error: 'could not write the text' };
  const phones = await testPhones();
  if (!phones.length) return { error: 'no test phone in app_config sms_test_phones' };
  const key = await getSecret('QUO_API_KEY');
  const results = [];
  for (const d of phones) {
    const out = await quoSend(key, '+1' + d, String(text));
    await svc.from('quo_messages').insert({
      batch_id: crypto.randomUUID(), person_id: null, phone: '+1' + d, body: String(text), status: out.ok ? 'sent' : 'failed',
      error: out.error || null, event_id: row.event_id, sent_by: who, direction: 'out', kind: 'confirm_test', roster_id: null,
      quo_id: out.id || null, sent_at: out.ok ? new Date().toISOString() : null,
    });
    results.push({ to: '+1' + d.slice(0, 3) + '***' + d.slice(-2), ok: out.ok, error: out.error });
  }
  return { text, results };
}

/* ---------- the Text volunteers window (manual sends) ---------- */
async function manual(body: any, auth: Who): Promise<Response> {
  const message = String(body.message || '').trim();
  if (message.length < 5) return json({ error: 'message required' }, 400);
  if (message.length > 1200) return json({ error: 'message too long' }, 400);
  const dryRun = body.dry_run !== false;
  let eventId = Number.isInteger(body.event_id) ? body.event_id : null;
  const eventDate = String(body.event_date || '').trim();
  const audRole = typeof body.role === 'string' && body.role ? String(body.role).slice(0, 40) : null;
  const personIds: number[] = Array.isArray(body.person_ids) ? body.person_ids.filter((x: unknown) => Number.isInteger(x)) : [];
  const rawPhones: string[] = Array.isArray(body.phones) ? body.phones.map(normPhone).filter(Boolean) : [];

  type Recip = { person_id: number | null; name: string; phone: string };
  const recips: Recip[] = [];
  if (personIds.length) {
    const { data: people, error } = await svc.from('volunteer_people').select('id, full_name, phones').in('id', personIds.slice(0, 400));
    if (error) return json({ error: 'could not load people' }, 500);
    for (const p of (people || [])) {
      const ph = ((p.phones || []) as string[]).map(normPhone).filter(Boolean)[0];
      if (ph) recips.push({ person_id: p.id as number, name: String(p.full_name || ''), phone: ph });
    }
  }
  for (const ph of rawPhones) recips.push({ person_id: null, name: '', phone: ph });
  const seen = new Set<string>();
  let finalRecips = recips.filter(r => { if (seen.has(r.phone)) return false; seen.add(r.phone); return true; });
  const skippedNoPhone = personIds.length - recips.filter(r => r.person_id !== null).length;
  // wave171 (planned as wave169a): no one who opted out (STOP) gets a text
  const { data: outs } = await svc.from('crm_contacts').select('volunteer_id, phones').eq('sms_opt_out', true).is('merged_into', null);
  const outPhones = new Set<string>(); const outPeople = new Set<number>();
  (outs || []).forEach((c: any) => { if (c.volunteer_id) outPeople.add(c.volunteer_id); (c.phones || []).map(normPhone).filter(Boolean).forEach((x: string) => outPhones.add(x)); });
  const beforeOut = finalRecips.length;
  finalRecips = finalRecips.filter(r => !outPhones.has(r.phone) && !(r.person_id && outPeople.has(r.person_id)));
  const skippedOptOut = beforeOut - finalRecips.length;

  const linkBase = (await cfg('sms_link_base')) || 'https://hub.welfareavenue.com/c/';
  const needsLink = message.indexOf('{{confirm_link}}') >= 0;
  const linkByPhone = new Map<string, string>();
  const rosterByPhone = new Map<string, number>();
  let skippedNoLink = 0;
  if (needsLink) {
    if (!eventId) {
      const { data: ev } = await svc.from('volunteer_events').select('id').eq('kind', 'service').neq('status', 'cancelled')
        .gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(1).maybeSingle();
      eventId = ev?.id ?? null;
    }
    if (!eventId) return json({ error: 'confirm_link needs an upcoming event to attach to' }, 400);
    for (const r of finalRecips) {
      if (!r.person_id) continue;
      const { data: row } = await svc.from('event_roster').select('id, confirm_token').eq('event_id', eventId).eq('person_id', r.person_id).maybeSingle();
      let token = row?.confirm_token || null;
      let rid = row?.id || null;
      if (row && !token && !dryRun) { token = newToken(); await svc.from('event_roster').update({ confirm_token: token }).eq('id', row.id); }
      if (row && !token && dryRun) token = 'PREVIEW';
      if (!row) {
        if (dryRun) token = 'PREVIEW';
        else {
          token = newToken();
          const { data: ins, error: insErr } = await svc.from('event_roster').insert({
            event_id: eventId, person_id: r.person_id, person_name: r.name,
            role: audRole || 'volunteer', status: 'Waiting For Response', confirm_token: token, sort: 999,
          }).select('id').single();
          if (insErr) { console.error('roster insert failed', insErr); token = null; } else rid = ins.id;
        }
      }
      if (token) { linkByPhone.set(r.phone, linkBase + token); if (rid) rosterByPhone.set(r.phone, rid); }
    }
    const before = finalRecips.length;
    finalRecips = finalRecips.filter(r => linkByPhone.has(r.phone));
    skippedNoLink = before - finalRecips.length;
  }
  if (!finalRecips.length) return json({ error: 'no reachable recipients' }, 400);
  if (finalRecips.length > 200) return json({ error: 'batch too large (max 200)' }, 400);

  const batchId = crypto.randomUUID();
  const previews: Array<Record<string, unknown>> = [];
  let sent = 0, failed = 0, queued = 0;
  // v5: only between 9 am and 7 pm; outside the hours the texts are queued and go at the next tick inside them
  const open = await windowOpen();
  const key = dryRun || !open ? '' : await getSecret('QUO_API_KEY');
  for (const r of finalRecips) {
    const text = render(message, { first_name: firstName(r.name), event_date: eventDate, confirm_link: linkByPhone.get(r.phone) || '' });
    const to = '+1' + r.phone;
    let status = 'dry_run'; let errMsg: string | null = null; let qid: string | null = null;
    if (!dryRun && !open) { status = 'queued'; queued += 1; }
    else if (!dryRun) {
      const out = await quoSend(key, to, text);
      if (out.ok) { status = 'sent'; sent += 1; qid = out.id || null; } else { status = 'failed'; failed += 1; errMsg = out.error || 'failed'; }
      await new Promise(res2 => setTimeout(res2, 250));
    }
    await svc.from('quo_messages').insert({
      batch_id: batchId, person_id: r.person_id, phone: to, body: text, status, error: errMsg, event_id: eventId, sent_by: auth.who,
      direction: 'out', kind: 'manual', roster_id: rosterByPhone.get(r.phone) || null, quo_id: qid, sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
    if (previews.length < 60) previews.push({ person_id: r.person_id, name: r.name, phone: to, text: text.slice(0, 300), status });
  }
  return json({ batch_id: batchId, dry_run: dryRun, recipients: finalRecips.length, sent, failed, queued, window_open: open,
    skipped_no_phone: Math.max(0, skippedNoPhone), skipped_no_link: skippedNoLink, skipped_opted_out: skippedOptOut, previews });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'Only leaders, HR and admins can text volunteers.' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'send');
  try {
    if (action === 'drain') {
      if (!auth.system) return json({ error: 'drain is for the Hub itself' }, 403);
      return json(await drain());
    }
    if (action === 'test_confirm') {
      if (!auth.admin) return json({ error: 'admins only' }, 403);
      const rid = Number(body.roster_id);
      if (!Number.isInteger(rid)) return json({ error: 'roster_id required' }, 400);
      return json(await testConfirm(rid, auth.who));
    }
    if (action === 'numbers') { if (!auth.admin) return json({ error: 'admins only' }, 403); return json(await numbers()); }
    if (action === 'webhook_setup') { if (!auth.admin) return json({ error: 'admins only' }, 403); return json(await webhookSetup()); }
    if (action === 'webhook_status') { if (!auth.admin) return json({ error: 'admins only' }, 403); return json(await webhookStatus()); }
    if (action === 'thread') return json(await thread(String(body.phone || '')));
    if (action === 'send') return await manual(body, auth);
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
