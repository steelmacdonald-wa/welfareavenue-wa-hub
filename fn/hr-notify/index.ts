// Welfare Avenue: hr-notify (v3, 15/10/26, wave245; v2, 07/10/26, wave215; v1 06/10/26, wave212)
// v3, Steel (15/10/26): "The notifications need to be even more robust and descriptive". The time-off DM goes through the
// notify function (event timeoff_request): each HR person's own switch for that kind (the notification centre), the Hub
// notification on their devices (hub-push), and the log the centre shows them (hub_notifications_sent). The direct DM from
// here is the fallback when notify cannot be reached, so HR always hears. The message says the type, the dates, the days
// and the note, with the link to the HR centre's Time off.
// v1, Valex (06/10/26): "notify Valex and Samson when someone asks for time off". A new time-off request (wa_timeoff, status
// requested; trigger trg_wa212_timeoff) is sent by Slack DM, from the Hub bot, to the people in app_config
// hr_notify_emails (default Valex and Samson), with the dates, the type, the note and a link to the HR centre's Time off.
// The requester is never DMed here.
// v2, Steel (07/10/26): "once time off has been approved, you can add it to the Google Calendar with hub@welfareavenue.com".
//   timeoff_decided {id}  (trigger trg_wa215_timeoff_cal): approved -> an all-day event on hub@welfareavenue.com's calendar,
//                         "Time off: <name> (<type>)", with the person as a guest (no invitation email) so it shows on
//                         their calendar too, free/busy shown as busy; the event id is kept on the row
//                         (wa_timeoff.calendar_event_id). Declined or back to requested -> the event is removed.
//                         Practice rows (the Academy walkthroughs) never reach Slack or the calendar.
//   calendar_probe {}     whether the Hub can write to hub@'s calendar (delegation, or the calendar shared with the
//                         service account with "Make changes to events"), and how.
// Auth: the trigger secret only.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const svc = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const HUB = 'https://hub.welfareavenue.com';
const CAL = 'hub@welfareavenue.com';
const GCAL = 'https://www.googleapis.com/calendar/v3';
const CATS: Record<string, string> = { vacation: 'Vacation', school_break: 'School break', sick: 'Mental health / sick', bereavement: 'Bereavement', religious: 'Religious holiday', wedding: 'Wedding', other: 'Other' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function slack(tok: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch('https://slack.com/api/' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  return await r.json();
}
async function dm(tok: string, email: string, text: string): Promise<string> {
  let uid: string | null = null;
  try { const { data } = await svc.from('wa_slack_ids').select('slack_id').ilike('email', email).maybeSingle(); uid = (data as { slack_id?: string } | null)?.slack_id || null; } catch (_) { uid = null; }
  if (!uid) { const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + tok } }); const b = await r.json(); uid = b?.user?.id || null; }
  if (!uid) return 'no slack account';
  const o = await slack(tok, 'conversations.open', { users: uid }); const ch = (o.channel as { id?: string } | undefined)?.id; if (!ch) return String(o.error || 'no dm');
  const p = await slack(tok, 'chat.postMessage', { channel: ch, text, unfurl_links: false }); return p.ok ? 'sent' : String(p.error || 'refused');
}
/* v3 (wave245): the DM through notify: the person's switch for the kind, the Hub notification, the centre's log. null when
   notify cannot be reached (the caller then DMs directly). The answer maps each address to sent, opted_out, hub_only,
   no_slack, no_email or failed. */
const WORDS: Record<string, string> = { sent: 'sent', sent_channel: 'sent (channel ping)', opted_out: 'skipped: switched off', hub_only: 'skipped: Hub only (their choice)', no_slack: 'skipped: no Slack account', no_email: 'skipped: not on the roster', failed: 'failed' };
async function viaNotify(secret: string, event: string, to: string[], text: string, title: string, body: string, url: string, tag: string): Promise<Record<string, string> | null> {
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret, Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify({ event, to, text, title, body, url, tag }) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    if (!j || !j.outcome || typeof j.outcome !== 'object') return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(j.outcome as Record<string, string>)) out[k] = WORDS[String(v)] || String(v);
    if (j.hub) out['hub'] = String(j.hub);
    return out;
  } catch (_) { return null; }
}
function d(s: string): string { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (_) { return s; } }
function nextDay(s: string): string { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); }

/* ---- Google: hub@'s calendar, as hub@ (domain delegation) or as the service account (calendar shared with it) ---- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const raw = atob(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
const TOK: Record<string, { v: string; exp: number }> = {};
async function token(sub: string | null): Promise<string | null> {
  const k = sub || 'sa'; if (TOK[k] && Date.now() < TOK[k].exp - 60000) return TOK[k].v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const claims: Record<string, unknown> = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: sa.token_uri, iat: now, exp: now + 3600 };
  if (sub) claims.sub = sub;
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key).buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + body)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + body + '.' + b64url(sig) }) });
  const j = await res.json(); if (!j.access_token) return null;
  TOK[k] = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}
/* the way that works: delegation first (events are hub@'s own), then the shared calendar */
async function calToken(): Promise<{ t: string; how: string } | null> {
  const a = await token(CAL); if (a) return { t: a, how: 'delegation' };
  const b = await token(null);
  if (b) { const r = await fetch(GCAL + '/calendars/' + encodeURIComponent(CAL), { headers: { Authorization: 'Bearer ' + b } }); if (r.ok) return { t: b, how: 'shared' }; }
  return null;
}
// deno-lint-ignore no-explicit-any
async function gcal(t: string, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; j: any }> {
  const r = await fetch(GCAL + path, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function probe() {
  const del = await token(CAL), sa = await token(null);
  let shared: unknown = null;
  if (sa) { const r = await fetch(GCAL + '/calendars/' + encodeURIComponent(CAL) + '/acl', { headers: { Authorization: 'Bearer ' + sa } }); shared = { status: r.status }; const m = await fetch(GCAL + '/calendars/' + encodeURIComponent(CAL), { headers: { Authorization: 'Bearer ' + sa } }); (shared as Record<string, unknown>).read = m.status; }
  let writable = false;
  const c = await calToken();
  if (c) {
    const ins = await gcal(c.t, 'POST', '/calendars/' + encodeURIComponent(CAL) + '/events?sendUpdates=none', { summary: 'Hub calendar check (removed at once)', start: { date: '2030-01-01' }, end: { date: '2030-01-02' }, transparency: 'transparent' });
    if (ins.ok && ins.j.id) { writable = true; await gcal(c.t, 'DELETE', '/calendars/' + encodeURIComponent(CAL) + '/events/' + encodeURIComponent(ins.j.id) + '?sendUpdates=none'); }
    else return { ok: false, delegation: !!del, shared, how: c.how, error: ins.j?.error?.message || ins.status };
  }
  return { ok: writable, delegation: !!del, shared, how: c ? c.how : null };
}

async function timeoffDecided(id: number) {
  const { data: t } = await svc.from('wa_timeoff').select('*').eq('id', id).maybeSingle();
  if (!t) return { ok: true, skipped: 'no such row' };
  if (t.practice) return { ok: true, skipped: 'practice' };
  const c = await calToken();
  if (!c) return { ok: false, error: 'The Hub cannot write to ' + CAL + "'s calendar yet" };
  const base = '/calendars/' + encodeURIComponent(CAL) + '/events';
  if (t.status !== 'approved') {
    if (!t.calendar_event_id) return { ok: true, skipped: 'nothing on the calendar' };
    const del = await gcal(c.t, 'DELETE', base + '/' + encodeURIComponent(t.calendar_event_id) + '?sendUpdates=none');
    await svc.from('wa_timeoff').update({ calendar_event_id: null }).eq('id', id);
    return { ok: del.ok || del.status === 404 || del.status === 410, removed: true };
  }
  const ev = {
    summary: 'Time off: ' + t.name + ' (' + (CATS[t.category] || t.category) + ')',
    description: 'Approved in the Hub' + (t.decided_by ? ' by ' + t.decided_by : '') + '. ' + t.days + (Number(t.days) === 1 ? ' day.' : ' days.') + '\n' + HUB + '/#hrcentre/timeoff',
    start: { date: t.start_date }, end: { date: nextDay(t.end_date) },
    attendees: t.email ? [{ email: String(t.email).toLowerCase(), responseStatus: 'accepted' }] : [],
    transparency: 'opaque', guestsCanModify: false, guestsCanInviteOthers: false,
    extendedProperties: { private: { wa_timeoff_id: String(t.id) } },
  };
  const r = t.calendar_event_id
    ? await gcal(c.t, 'PUT', base + '/' + encodeURIComponent(t.calendar_event_id) + '?sendUpdates=none', ev)
    : await gcal(c.t, 'POST', base + '?sendUpdates=none', ev);
  if (!r.ok) return { ok: false, error: r.j?.error?.message || String(r.status) };
  if (r.j.id !== t.calendar_event_id) await svc.from('wa_timeoff').update({ calendar_event_id: r.j.id }).eq('id', id);
  try { await svc.from('change_log').insert({ entity_type: 'timeoff', entity_id: String(t.id), field: 'calendar', old_value: null, new_value: 'on ' + CAL + "'s calendar (" + c.how + ')', changed_by: 'hr-notify' }); } catch (_) { /* audit */ }
  return { ok: true, event: r.j.id, how: c.how };
}

Deno.serve(async (req) => {
  try {
    const secret = await getSecret('WA_TRIGGER_SECRET');
    if (req.headers.get('x-wa-secret') !== secret) return json({ error: 'not allowed' }, 401);
    const b = await req.json().catch(() => ({}));
    if (b.action === 'calendar_probe') return json(await probe());
    if (b.action === 'timeoff_decided') return json(await timeoffDecided(Number(b.id)));
    if (b.action !== 'timeoff_requested') return json({ error: 'unknown action' }, 400);
    const { data: t } = await svc.from('wa_timeoff').select('*').eq('id', Number(b.id)).maybeSingle();
    if (!t || t.status !== 'requested') return json({ ok: true, skipped: 'not a request' });
    if (t.practice) return json({ ok: true, skipped: 'practice' });
    const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'hr_notify_emails').maybeSingle();
    const to = String((cfg as { value?: string } | null)?.value || 'valex.sanon@welfareavenue.com,samson.jules@welfareavenue.com').split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean).filter(x => x !== String(t.email || '').toLowerCase());
    const plainLine = t.name + ' asked for time off: ' + (CATS[t.category] || t.category) + ', ' + d(t.start_date) + (t.end_date !== t.start_date ? ' to ' + d(t.end_date) : '') + ' (' + t.days + (Number(t.days) === 1 ? ' day' : ' days') + ').';
    const text = ':palm_tree: *' + t.name + '* asked for time off: ' + (CATS[t.category] || t.category) + ', ' + d(t.start_date) + (t.end_date !== t.start_date ? ' to ' + d(t.end_date) : '') + ' (' + t.days + (Number(t.days) === 1 ? ' day' : ' days') + ').' + (t.note ? '\n_' + String(t.note).slice(0, 300) + '_' : '') + '\n<' + HUB + '/#hrcentre/timeoff|Approve or decline in the HR centre>';
    /* v3: through notify (switches, Hub notification, the centre's log); the direct DM when notify cannot be reached */
    let out = await viaNotify(secret, 'timeoff_request', to.slice(0, 6), text, 'Time off requested', plainLine + (t.note ? ' ' + String(t.note).slice(0, 160) : '') + ' Approve or decline in the HR centre.', '#hrcentre/timeoff', 'timeoff-' + t.id);
    let via = 'notify';
    if (!out) {
      via = 'hr-notify directly (notify unreachable)';
      const tok = await getSecret('SLACK_BOT_TOKEN');
      out = {};
      for (const e of to.slice(0, 6)) out[e] = await dm(tok, e, text);
    }
    try { await svc.from('change_log').insert({ entity_type: 'timeoff', entity_id: String(t.id), field: 'notified', old_value: null, new_value: Object.entries(out).map(([k, v]) => k + ': ' + v).join('; ') + ' (' + via + ')', changed_by: 'hr-notify' }); } catch (_) { /* audit */ }
    return json({ ok: true, sent: out, via });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
