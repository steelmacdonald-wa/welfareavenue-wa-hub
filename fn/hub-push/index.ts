// Welfare Avenue: hub-push (v4, 15/10/26: wave245; v3 15/10/26: waves 239 and 242; v2 09/10/26: wave225 adds the studio event; v1 07/10/26, wave219)
// v4 (wave245, Steel: "The notifications need to be even more robust and descriptive"): every notification tried is logged in
// hub_notifications_sent (the kind, the words, the outcome: sent to N devices, skipped and why, failed), so the notification
// centre shows each person their Recent. relay {kind, to[], title, body, url, tag, sync?}: a kind another function composes
// (notify's timeoff_request, applicant, loop_still, and the centre's sample), through the person's switch for that kind.
// sync: true answers with the outcome instead of queueing. The task and request notifications say more (the team, the
// project, the due date in words, the details).
// v3: volunteer_applied (a photographer or videographer applied; the database names the SOP's photographer owner, to_email or
// to_name) and task_due (wa242_due_reminders: a person's tasks due today, tomorrow or overdue, once a day). The notification
// centre (wave242) keeps each kind's Hub and Slack switch in wa_notify_prefs.prefs.kinds[kind] = {hub, slack}: hub false
// means no Hub notification for that kind; a kind with no entry follows the old rules (channel, the disabled list).
// Hub notifications on computers and phones (Web Push). Steel (07/10/26): "if it can send in-app notifications on updates,
// I would like to do that if it's possible, especially browser use for those that are using the computer". His choices:
// mentions and assigned work, and announcements; each person chooses Hub notifications, Slack or both (both by default,
// wa_notify_prefs.prefs.channel); one gentle prompt on Home per device and a switch in Settings.
//
// The devices are hub_push_subs rows (one per browser or installed app where the person tapped Turn on; saved by the page
// through wa219_push_save). The VAPID key pair is made here once (action setup): the private key goes into the vault
// (PUSH_VAPID_PRIVATE, through wa_vault_set) and never leaves this function; the public key is app_config push_vapid_public,
// which the page reads to subscribe. Payloads are encrypted for each device (RFC 8291, aes128gcm) and signed (RFC 8292,
// VAPID ES256) with WebCrypto only.
//
// Calls:
//   from the database (trigger secret, through wa219_push_call): the events the notify function already sends on Slack
//     (comment_mention, mentioned, task_reassigned, request_filed, suggestion_accepted), plus studio (wave225: the Content
//     Studio names the people: approvals, posts due on a platform the Hub cannot post to, new comments), task_assigned (a person makes
//     a task for someone else) and announcement (a new announcement, to the people it is for). The work runs in the
//     background (EdgeRuntime.waitUntil) so the database's call returns at once. dry: true answers who would get what and
//     sends nothing.
//   setup, status (trigger secret): make the key pair when there is none; count the devices.
//   from the page (a signed-in staff member): key (the public key), test (a test to the caller's own devices, or to one),
//     drop (Turn off this device, or Remove another of theirs: the caller's own rows only).
//   from the service worker (no person, no key): renew (a browser replaced a subscription: the old endpoint and its auth
//     secret prove it is the same device). verify_jwt is off; every action checks its own caller (the trigger secret, a
//     staff member's session through auth.getUser and is_wa_staff, or the device's auth secret).
// Each person's choice is read before sending: Slack only, or the event switched off, means no Hub notification. A device
// the push service no longer knows (404, 410) is deleted. change_log gets one line per person sent to (never the text).
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
const SUBJECT = 'mailto:hub@welfareavenue.com';
/* the push services the browsers use (Chrome, Edge, Firefox, Safari); any other address is refused */
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|apple\.com)(:\d+)?\//i;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

/* push-crypto start (tested offline by test/w219crypto.js against http_ece and a JWT verify) */
const enc = new TextEncoder();
function b64u(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s: string): Uint8Array {
  let t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, len * 8));
}
/* RFC 8291: the payload encrypted for one subscription (aes128gcm, one record) */
async function encryptPayload(p256dh: string, auth: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPub = unb64u(p256dh);
  const authSecret = unb64u(auth);
  if (uaPub.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, key, concat(plaintext, new Uint8Array([2])) as BufferSource));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), asPub, sealed);   /* rs 4096, the sender's key as keyid */
}
/* RFC 8292: the Authorization header for one push service (ES256 JWT, 12 hours) */
async function vapidHeader(endpoint: string, priv: CryptoKey, pub: string, nowSec: number): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: SUBJECT })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc.encode(head + '.' + body) as BufferSource));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + pub;
}
async function newVapidKeys(): Promise<{ jwk: JsonWebKey; pub: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  return { jwk, pub };
}
async function importVapid(jwk: JsonWebKey): Promise<{ key: CryptoKey; pub: string }> {
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { key, pub: b64u(concat(new Uint8Array([4]), unb64u(String(jwk.x)), unb64u(String(jwk.y)))) };
}
/* push-crypto end */

let VAPID: { key: CryptoKey; pub: string } | null = null;
async function vapid(): Promise<{ key: CryptoKey; pub: string }> {
  if (VAPID) return VAPID;
  VAPID = await importVapid(JSON.parse(await getSecret('PUSH_VAPID_PRIVATE')));
  return VAPID;
}

type Sub = { id: number; email: string; endpoint: string; p256dh: string; auth: string; failures: number };
type Msg = { title: string; body: string; url: string; tag: string };

async function pushOne(s: Sub, msg: Msg): Promise<{ ok: boolean; status: number; gone: boolean; err?: string }> {
  try {
    if (!PUSH_HOSTS.test(s.endpoint)) return { ok: false, status: 0, gone: true, err: 'not a push service' };
    const v = await vapid();
    const payload = enc.encode(JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag, ts: Date.now() }));
    const res = await fetch(s.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', TTL: '86400', Urgency: 'normal',
        Authorization: await vapidHeader(s.endpoint, v.key, v.pub, Math.floor(Date.now() / 1000))
      },
      body: (await encryptPayload(s.p256dh, s.auth, payload)) as BodyInit
    });
    const text = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 160);
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, err: res.ok ? undefined : res.status + ' ' + text };
  } catch (e) {
    return { ok: false, status: 0, gone: false, err: String(e).slice(0, 160) };
  }
}

async function devicesOf(email: string): Promise<Sub[]> {
  const { data } = await svc.from('hub_push_subs').select('id, email, endpoint, p256dh, auth, failures').eq('email', email.toLowerCase());
  return (data || []) as Sub[];
}

/* every device of one person; the result for the log */
async function sendDevices(subs: Sub[], msg: Msg): Promise<{ sent: number; failed: number; gone: number; errors: string[] }> {
  const out = { sent: 0, failed: 0, gone: 0, errors: [] as string[] };
  await Promise.all(subs.map(async (s) => {
    const r = await pushOne(s, msg);
    if (r.ok) {
      out.sent++;
      await svc.from('hub_push_subs').update({ last_sent_at: new Date().toISOString(), last_error: null, failures: 0 }).eq('id', s.id);
    } else if (r.gone) {
      out.gone++;
      await svc.from('hub_push_subs').delete().eq('id', s.id);
    } else {
      out.failed++; out.errors.push(r.err || 'failed');
      await svc.from('hub_push_subs').update({ last_error: r.err || 'failed', failures: (s.failures || 0) + 1 }).eq('id', s.id);
    }
  }));
  return out;
}

async function log(event: string, target: string, outcome: string) {
  try {
    await svc.from('change_log').insert({ entity_type: 'push', entity_id: event, field: 'delivery', old_value: null, new_value: target + ': ' + outcome, changed_by: 'hub-push' });
  } catch (_) { /* audit only */ }
}
/* v4: the log the notification centre shows each person (Recent) */
async function logSent(email: string, kind: string, msg: Msg, outcome: string) {
  try {
    await svc.from('hub_notifications_sent').insert({ email: String(email || '').toLowerCase(), kind, channel: 'hub', title: String(msg.title || '').slice(0, 200), body: String(msg.body || '').slice(0, 600), url: String(msg.url || '').slice(0, 300), outcome: String(outcome || '').slice(0, 300), ref: String(msg.tag || '').slice(0, 120) || null, sent_by: 'hub-push' });
  } catch (_) { /* the log never blocks a notification */ }
}

/* ---------- people ---------- */
type Member = { name: string; email: string; department: string | null };
let ROSTER: Member[] | null = null;
async function roster(): Promise<Member[]> {
  if (ROSTER) return ROSTER;
  const { data } = await svc.from('team_members').select('name, email, department, active');
  ROSTER = ((data || []) as Array<Member & { active: boolean | null }>).filter(m => m.active !== false && m.email && m.email.indexOf('@') > 0)
    .map(m => ({ name: String(m.name || ''), email: String(m.email).toLowerCase(), department: m.department }));
  return ROSTER;
}
async function byName(name: string): Promise<Member | null> {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const rows = await roster();
  const hit = rows.filter(r => r.email === n || r.name.toLowerCase() === n);
  if (hit.length) return hit[0];
  const first = rows.filter(r => r.name.toLowerCase().split(' ')[0] === n.split(' ')[0]);
  return first.length === 1 ? first[0] : null;
}
async function byEmail(email: string): Promise<Member | null> {
  const e = String(email || '').toLowerCase();
  return (await roster()).filter(r => r.email === e)[0] || null;
}
/* a task's owner field may name several people ("Samson, Valex") */
async function ownersOf(owner: string | null): Promise<Member[]> {
  const out: Member[] = [];
  for (const part of String(owner || '').split(/\s*(?:,|&|\/|\band\b)\s*/i)) {
    const m = await byName(part);
    if (m && !out.some(x => x.email === m.email)) out.push(m);
  }
  return out;
}

/* the person's choice: Slack only, or this kind switched off, means no Hub notification */
const PREF_KEY: Record<string, string> = { task_assigned: 'task_reassigned', studio: 'content_studio' };
async function wants(email: string, event: string): Promise<string | null> {
  const { data } = await svc.from('wa_notify_prefs').select('disabled, prefs').eq('email', email.toLowerCase()).maybeSingle();
  const prefs = (data?.prefs || {}) as Record<string, unknown>;
  const key = PREF_KEY[event] || event;
  /* v3 (wave242): an explicit choice for this kind wins */
  const kinds = (prefs.kinds && typeof prefs.kinds === 'object' ? prefs.kinds : {}) as Record<string, { hub?: boolean }>;
  const k = kinds[key];
  if (k && typeof k.hub === 'boolean') return k.hub ? null : 'Hub off for this kind';
  const channel = String(prefs.channel || 'both');
  if (channel === 'slack') return 'Slack only';
  const off = (Array.isArray(data?.disabled) ? data?.disabled : []) as string[];
  if (off.indexOf(key) >= 0) return 'switched off';
  return null;
}
const ROLE_WORDS: Record<string, string> = { team_leader: 'team leader', cook: 'cook', driver: 'driver', server: 'server', dishwasher: 'dishwasher',
  photographer: 'photographer', videographer: 'videographer', community_debrief: 'community lead', community_talker: 'community lead', volunteer: 'volunteer' };

/* one person: their choice, their devices, the log line */
async function toPerson(event: string, email: string, msg: Msg, dry: boolean, plan: unknown[]): Promise<string> {
  const e = String(email || '').toLowerCase();
  if (!e) return 'no email';
  const no = await wants(e, event);
  const subs = no ? [] : await devicesOf(e);
  if (dry) { plan.push({ email: e, skip: no, devices: subs.length, title: msg.title, body: msg.body, url: msg.url }); return 'dry'; }
  const kind = PREF_KEY[event] || event;
  if (no) { await logSent(e, kind, msg, 'skipped: ' + (no === 'Slack only' ? 'Slack only (your choice)' : 'switched off here')); return no; }
  if (!subs.length) { await logSent(e, kind, msg, 'skipped: no device with Hub notifications on'); return 'no device'; }
  const r = await sendDevices(subs, msg);
  const outcome = 'sent to ' + r.sent + ' device' + (r.sent === 1 ? '' : 's') + (r.failed ? ', ' + r.failed + ' failed (' + r.errors[0] + ')' : '') + (r.gone ? ', ' + r.gone + ' gone (removed)' : '');
  await log(event, e, outcome);
  await logSent(e, kind, msg, r.sent ? outcome : 'failed: ' + (r.errors[0] || 'no device reached'));
  return outcome;
}

/* ---------- words ---------- */
function clip(s: string, n: number): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026';
}
/* the Hub's editor writes markdown; a notification is plain text */
function plain(s: string): string {
  return String(s || '').split('\n').map(l => l
    .replace(/^\s*#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')).join(' ');
}
const Q = (s: string) => '\u201c' + s + '\u201d';
function dueText(d: string | null): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (!m) return '';
  return 'due ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] + ' ' + Number(m[3]);
}
const DEPT_WORDS: Record<string, string> = { opsmtl: 'Operations Montreal', opsto: 'Operations Toronto', progdev: 'Program Development', marketing: 'Marketing', fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', board: 'Board' };
const KIND: Record<string, string> = {
  task: 'the task', goal: 'the goal', request: 'the request', update: 'a team update', decision: 'the decision',
  committee: 'a committee note', project: 'the project', content: 'the post', crm: 'the CRM automation'
};
function hidden(t: Record<string, unknown>): boolean {
  return !!(t.confidential || t.board_only || ['private', 'speakers', 'leadership'].indexOf(String(t.visibility || '')) >= 0);
}
/* the same check as notify: a task description saves as the person types, so a mention there is read again */
function stillMentions(text: string, name: string): boolean {
  const t = String(text || '').toLowerCase(), n = '@' + String(name || '').toLowerCase();
  let i = t.indexOf(n);
  while (i >= 0) {
    const before = i > 0 ? t.charAt(i - 1) : '', after = t.charAt(i + n.length), after2 = t.charAt(i + n.length + 1);
    const word = (c: string) => /[0-9a-z_\u00c0-\u024f]/.test(c);
    if (!(before && (word(before) || before === '.')) && !(after && word(after)) && !(after === '.' && after2 && word(after2))) return true;
    i = t.indexOf(n, i + 1);
  }
  return false;
}

/* ---------- the events ---------- */
async function handleEvent(event: string, body: Record<string, unknown>, dry: boolean): Promise<Record<string, unknown>> {
  const plan: unknown[] = [];
  const outs: string[] = [];
  const done = () => (dry ? { event, dry: true, plan } : { event, outcome: outs.join('; ') || 'nobody' });

  if (event === 'comment_mention') {
    const { data: m } = await svc.from('hub_mentions').select('*').eq('id', Number(body.mention_id)).maybeSingle();
    if (!m) return { error: 'mention not found' };
    if (!m.to_email || String(m.to_email).toLowerCase() === String(m.from_email || '').toLowerCase()) return { event, outcome: 'nobody' };
    let snippet = String(m.snippet || '');
    if (m.source_table === 'dept_tasks' && m.source_id && !dry) {
      await new Promise(r => setTimeout(r, 20000));
      const { data: t } = await svc.from('dept_tasks').select('description').eq('id', m.source_id).maybeSingle();
      if (!stillMentions(String(t?.description || ''), String(m.to_name || ''))) return { event, outcome: 'the mention was removed before sending' };
    }
    const where = (KIND[String(m.kind)] || 'something');
    const msg: Msg = {
      title: String(m.from_name || m.from_email || 'Someone') + ' mentioned you',
      body: m.private ? 'On ' + where.replace(/^the /, 'a confidential ') + '. Open the Hub to read it.'
        : 'On ' + where + (m.ref_title ? ' ' + Q(clip(String(m.ref_title), 60)) : '') + ': ' + clip(plain(snippet), 150),
      url: '/' + String(m.url || '#mypage'), tag: 'mention-' + m.id
    };
    outs.push(await toPerson(event, String(m.to_email), msg, dry, plan));
    return done();
  }

  if (event === 'mentioned') {
    const { data: m } = await svc.from('mentions').select('*').eq('id', Number(body.mention_id)).maybeSingle();
    if (!m) return { error: 'mention not found' };
    if (m.visibility === 'private' || m.visibility === 'speakers') return { event, outcome: 'private meeting' };
    const who = await byName(String(m.person || ''));
    if (!who) return { event, outcome: 'nobody on the roster by that name' };
    const quote = m.visibility === 'leadership' || !m.quote ? '' : ': ' + Q(clip(String(m.quote), 140));
    const msg: Msg = { title: 'You were mentioned in a meeting', body: clip(String(m.meeting_title || 'A meeting'), 80) + quote, url: '/#mypage', tag: 'meeting-mention-' + m.id };
    outs.push(await toPerson(event, who.email, msg, dry, plan));
    return done();
  }

  if (event === 'task_reassigned' || event === 'task_assigned') {
    const { data: t } = await svc.from('dept_tasks').select('id, title, owner, due_date, done, updated_by, confidential, board_only, visibility, department, project_id, priority').eq('id', Number(body.task_id)).maybeSingle();
    if (!t) return { error: 'task not found' };
    if (t.done) return { event, outcome: 'already done' };
    /* v4: the team and the project */
    let project = '';
    if (t.project_id) { const { data: pr } = await svc.from('projects').select('name').eq('id', t.project_id).maybeSingle(); project = String(pr?.name || ''); }
    const team = DEPT_WORDS[String(t.department || '')] || '';
    const now = await ownersOf(String(body.new_owner ?? t.owner ?? ''));
    const before = event === 'task_reassigned' ? await ownersOf(String(body.old_owner || '')) : [];
    const by = event === 'task_assigned' ? await byEmail(String(body.by || '')) : await byName(String(t.updated_by || ''));
    const byLabel = by ? by.name : (event === 'task_assigned' ? '' : String(t.updated_by || '').replace(/^AI:.*$/, 'a meeting'));
    const parts = [hidden(t) ? 'A confidential task' : clip(String(t.title || 'A task'), 90), team, project ? 'project ' + clip(project, 40) : '', dueText(t.due_date), t.priority ? 'priority' : '', byLabel ? 'from ' + byLabel : ''].filter(Boolean);
    for (const p of now) {
      if (before.some(b => b.email === p.email)) continue;   /* they had it already */
      if (by && by.email === p.email) continue;               /* they gave it to themselves */
      if (event === 'task_assigned' && String(body.by || '').toLowerCase() === p.email) continue;
      const msg: Msg = { title: event === 'task_assigned' ? 'New task for you' : 'A task is now yours', body: parts.join(' \u00b7 '), url: '/#task/' + t.id, tag: 'task-' + t.id };
      outs.push(p.email + ': ' + await toPerson(event, p.email, msg, dry, plan));
    }
    return done();
  }

  if (event === 'request_filed') {
    const id = Number(body.request_id);
    if (!dry) await new Promise(r => setTimeout(r, 3000));
    const { data: sug } = await svc.from('request_suggestions').select('id').eq('request_id', id).maybeSingle();
    if (sug) return { event, outcome: 'covered by suggestion_accepted' };
    const { data: r } = await svc.from('dept_requests').select('*').eq('id', id).maybeSingle();
    if (!r) return { error: 'request not found' };
    const { data: rt } = await svc.from('request_types').select('label, default_assignee').eq('key', r.type_key).maybeSingle();
    const recipient = r.assignee || rt?.default_assignee || null;
    let people: Member[] = [];
    if (recipient) people = await ownersOf(String(recipient));
    else {
      const { data: leads } = await svc.from('hub_roles').select('email, role').eq('role', 'leader');
      const le = (leads || []).map((l: { email: string }) => String(l.email || '').toLowerCase());
      people = (await roster()).filter(m => m.department === r.department && le.indexOf(m.email) >= 0).slice(0, 2);
    }
    const from = String(r.requested_by || '');
    const msg: Msg = { title: 'New request for your team', body: [clip(String(r.title || rt?.label || r.type_key || 'A request'), 100), DEPT_WORDS[String(r.department || '')] || '', from ? 'from ' + clip(from, 40) : '', r.needed_by ? 'needed by ' + String(r.needed_by) : '', r.details ? clip(plain(String(r.details)), 120) : ''].filter(Boolean).join(' \u00b7 '), url: '/#requests', tag: 'request-' + id };
    for (const p of people) {
      if (r.requested_email && String(r.requested_email).toLowerCase() === p.email) continue;   /* their own request */
      outs.push(p.email + ': ' + await toPerson(event, p.email, msg, dry, plan));
    }
    return done();
  }

  if (event === 'suggestion_accepted') {
    const { data: s } = await svc.from('request_suggestions').select('*').eq('id', Number(body.suggestion_id)).maybeSingle();
    if (!s) return { error: 'suggestion not found' };
    const { data: rt } = await svc.from('request_types').select('label, default_assignee').eq('key', s.type_key).maybeSingle();
    const recipient = s.assignee || rt?.default_assignee || null;
    if (!recipient) return { event, outcome: 'no recipient' };
    const msg: Msg = { title: 'A meeting suggestion is now a request', body: clip(String(s.title || rt?.label || s.type_key || 'A request'), 120), url: '/#requests', tag: 'suggestion-' + s.id };
    for (const p of await ownersOf(String(recipient))) outs.push(p.email + ': ' + await toPerson(event, p.email, msg, dry, plan));
    return done();
  }

  /* wave225: the Content Studio (social-publish and social-inbox): approvals waiting or decided, a post due on a platform
     the Hub cannot post to, new comments. The caller names the people; each person's choice is read as for every event. */
  if (event === 'studio') {
    const to = (Array.isArray(body.to) ? body.to : []).map(x => String(x || '').toLowerCase()).filter(x => /@/.test(x)).slice(0, 40);
    const msg: Msg = { title: clip(String(body.title || 'Content Studio'), 80), body: clip(plain(String(body.body || '')), 180), url: String(body.url || '/#studio').startsWith('/') ? String(body.url || '/#studio') : '/#studio', tag: clip(String(body.tag || 'studio'), 60) };
    for (const e of Array.from(new Set(to))) outs.push(e + ': ' + await toPerson(event, e, msg, dry, plan));
    return done();
  }

  /* v4 (wave245): a kind another function composes, through the person's switch for that kind */
  if (event === 'relay') {
    const kind = String(body.kind || '').replace(/[^a-z_]/g, '');
    if (!kind) return { error: 'kind required' };
    const to = (Array.isArray(body.to) ? body.to : [body.to_email]).map(x => String(x || '').toLowerCase()).filter(x => /@/.test(x)).slice(0, 40);
    const msg: Msg = { title: clip(String(body.title || 'The Hub'), 80), body: clip(plain(String(body.body || '')), 180), url: String(body.url || '/#mypage').startsWith('/') ? String(body.url || '/#mypage') : '/' + String(body.url || '#mypage'), tag: clip(String(body.tag || kind), 60) };
    for (const e of Array.from(new Set(to))) outs.push(e + ': ' + await toPerson(kind, e, msg, dry, plan));
    return done();
  }

  if (event === 'volunteer_applied') {
    /* v3 (wave239): a photographer or videographer applied; the owner of the SOP's Volunteer Photographers step */
    const { data: a } = await svc.from('volunteer_applications').select('id, name, roles, source').eq('id', Number(body.application_id)).maybeSingle();
    if (!a) return { error: 'application not found' };
    let e = String(body.to_email || '').toLowerCase();
    if (!e) { const m = await byName(String(body.to_name || '')); e = m ? m.email : ''; }
    if (!e) { outs.push('no owner'); return done(); }
    const roles = ((a.roles || []) as string[]).filter(r => r === 'photographer' || r === 'videographer').map(r => ROLE_WORDS[r] || r);
    const msg: Msg = { title: 'A ' + (roles.join(' and ') || 'photographer') + ' applied', body: clip(String(a.name || 'A volunteer') + (a.source === 'website' ? ' \u00b7 on the website' : a.source ? ' \u00b7 ' + String(a.source) : '') + ' \u00b7 yours to welcome (the SOP\u2019s photographer step)', 160), url: '/#volunteering/applicants', tag: 'vol-app-' + a.id };
    outs.push(e + ': ' + await toPerson(event, e, msg, dry, plan));
    return done();
  }

  if (event === 'task_due') {
    /* v3 (wave242): the day's reminder, composed by wa242_due_reminders */
    const e = String(body.email || '').toLowerCase();
    if (!e) return { error: 'email required' };
    const n = (k: string) => (Array.isArray(body[k]) ? (body[k] as unknown[]).length : 0);
    const today = n('due_today'), over = n('overdue'), tomorrow = n('due_tomorrow');
    if (!today && !over && !tomorrow) { outs.push('nothing due'); return done(); }
    const first = ((Array.isArray(body.due_today) && body.due_today[0]) || (Array.isArray(body.overdue) && body.overdue[0]) || (Array.isArray(body.due_tomorrow) && body.due_tomorrow[0])) as { title?: string } | undefined;
    const bits: string[] = [];
    if (today) bits.push(today + ' due today');
    if (over) bits.push(over + ' overdue');
    if (tomorrow) bits.push(tomorrow + ' due tomorrow');
    const msg: Msg = { title: 'Your tasks ' + String(body.day || 'today'), body: clip(bits.join(', ') + (first && first.title ? ' \u00b7 ' + String(first.title) : ''), 160), url: '/#mypage', tag: 'task-due-' + String(body.day || '') };
    outs.push(e + ': ' + await toPerson(event, e, msg, dry, plan));
    return done();
  }

  if (event === 'announcement') {
    const { data: a } = await svc.from('hub_announcements').select('id, kind, title, body, audience, teams, ask, created_by, created_name, expires_at').eq('id', Number(body.id)).maybeSingle();
    if (!a) return { error: 'announcement not found' };
    const { data: aud } = await svc.rpc('wa180_audience', { p_audience: a.audience || 'everyone', p_teams: a.teams || [] });
    const who = String(a.created_name || (await byEmail(String(a.created_by || '')))?.name || 'the Hub');
    const ask = a.ask && typeof a.ask === 'object' ? String((a.ask as Record<string, unknown>).type || '') : '';
    const title = (ask === 'poll' ? 'A poll from ' : ask ? 'A short form from ' : 'Announcement from ') + who;
    const text = plain(String(a.body || ''));
    const msg: Msg = { title, body: clip(String(a.title || ''), 90) + (text ? ': ' + clip(text, 120) : ''), url: '/#announce/' + a.id, tag: 'announce-' + a.id };
    let n = 0, sent = 0;
    const people = ((aud || []) as Array<{ email: string }>).map(x => String(x.email || '').toLowerCase()).filter(e => e && e !== String(a.created_by || '').toLowerCase());
    for (let i = 0; i < people.length; i += 8) {
      const res = await Promise.all(people.slice(i, i + 8).map(e => toPerson(event, e, msg, dry, plan)));
      res.forEach(r => { n++; if (r.indexOf('sent to') === 0 && r.indexOf('sent to 0') !== 0) sent++; });
    }
    outs.push(sent + ' of ' + n + ' people reached');
    return done();
  }

  return { error: 'unknown event' };
}

/* ---------- the caller ---------- */
async function staffCaller(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff');
  return ok === true ? email : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || body.event || '');
  let secret = false;
  try { const given = req.headers.get('x-wa-secret'); secret = !!given && given === (await getSecret('WA_TRIGGER_SECRET')); } catch (_) { /* no secret */ }

  /* the service worker: a browser replaced its subscription; the old one's auth secret proves the device */
  if (action === 'renew') {
    const oldEp = String(body.old_endpoint || ''), oldAuth = String(body.old_auth || '');
    const ep = String(body.endpoint || ''), p256dh = String(body.p256dh || ''), auth = String(body.auth || '');
    if (!oldEp || !oldAuth || !PUSH_HOSTS.test(ep) || unb64u(p256dh).length !== 65 || unb64u(auth).length !== 16) return json({ error: 'bad renewal' }, 400);
    const { data: row } = await svc.from('hub_push_subs').select('id, email').eq('endpoint', oldEp).eq('auth', oldAuth).maybeSingle();
    if (!row) return json({ error: 'unknown device' }, 404);
    await svc.from('hub_push_subs').delete().eq('endpoint', ep).neq('id', row.id);
    await svc.from('hub_push_subs').update({ endpoint: ep, p256dh, auth, updated_at: new Date().toISOString(), failures: 0, last_error: null }).eq('id', row.id);
    await log('renew', String(row.email), 'the browser renewed a device');
    return json({ ok: true });
  }

  if (secret) {
    if (action === 'setup') {
      try { const v = await vapid(); return json({ ok: true, created: false, public_key: v.pub }); } catch (_) { /* none yet */ }
      const k = await newVapidKeys();
      const { error } = await svc.rpc('wa_vault_set', { p_name: 'PUSH_VAPID_PRIVATE', p_value: JSON.stringify(k.jwk), p_note: 'wave219: the Hub notifications signing key (VAPID, P-256). Only hub-push reads it. The public half is app_config push_vapid_public.' });
      if (error) return json({ error: 'vault: ' + error.message }, 500);
      await svc.from('app_config').upsert({ key: 'push_vapid_public', value: k.pub, updated_at: new Date().toISOString() });
      VAPID = null;
      const v = await vapid();
      if (v.pub !== k.pub) return json({ error: 'the saved key does not match' }, 500);
      await log('setup', 'vault', 'made the VAPID key pair');
      return json({ ok: true, created: true, public_key: k.pub });
    }
    if (action === 'status') {
      const { data } = await svc.from('hub_push_subs').select('email, failures, last_sent_at');
      const rows = (data || []) as Array<{ email: string; failures: number }>;
      let ready = false; try { await vapid(); ready = true; } catch (_) { /* none */ }
      return json({ ok: true, vapid: ready, devices: rows.length, people: new Set(rows.map(r => r.email)).size, failing: rows.filter(r => (r.failures || 0) > 0).length });
    }
    const dry = body.dry === true;
    if (dry) return json(await handleEvent(action, body, true));
    const job = handleEvent(action, body, false).catch(e => ({ error: String(e).slice(0, 200) }));
    if (body.sync === true) return json(await job);   /* v4: the caller waits for the outcome (notify's relay, the sample) */
    const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (rt && typeof rt.waitUntil === 'function') { rt.waitUntil(job); return json({ event: action, outcome: 'queued' }); }
    return json(await job);
  }

  /* the page: a signed-in staff member */
  const me = await staffCaller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  if (action === 'key') {
    try { return json({ public_key: (await vapid()).pub }); } catch (_) { return json({ error: 'Hub notifications are not set up yet' }, 503); }
  }
  /* Turn off for one device, or Remove another of theirs: only the caller's own rows */
  if (action === 'drop') {
    const ep = String(body.endpoint || '');
    if (!ep) return json({ error: 'endpoint required' }, 400);
    const { data } = await svc.from('hub_push_subs').delete().eq('email', me).eq('endpoint', ep).select('id');
    return json({ ok: true, removed: (data || []).length });
  }
  if (action === 'test') {
    let subs = await devicesOf(me);
    if (body.endpoint) subs = subs.filter(s => s.endpoint === String(body.endpoint));
    if (!subs.length) return json({ ok: false, devices: 0, error: 'This device is not on yet' });
    const r = await sendDevices(subs, { title: 'Hub notifications are on', body: 'This is how mentions, work for you and announcements will look here.', url: '/#mypage', tag: 'test' });
    await log('test', me, 'sent to ' + r.sent + ' of ' + subs.length + ' device' + (subs.length === 1 ? '' : 's'));
    return json({ ok: r.sent > 0, devices: subs.length, sent: r.sent, failed: r.failed, gone: r.gone, error: r.errors[0] || null });
  }
  return json({ error: 'unknown action' }, 400);
});
