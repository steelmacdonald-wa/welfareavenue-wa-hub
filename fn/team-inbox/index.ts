// Welfare Avenue: team-inbox (v1.2, 29/09/26: Finance is a team of its own for requests and emails, apart from Fundraising, and posts in
// #accounting-finance (private: the Hub's app was added to it); an invoice, receipt or reimbursement says which it is. Steel: "all finance
// related emails like invoices, receipts, reimbursements should go straight to the finance slack channel not fundraising".
// v1.1, 25/09/26: who asked reads plainly for meeting and Ask the Hub requests; v1 25/09/26)
// Steel: "redo the Request tab ... make sure requests are also sent to the
// department's channel as well as have an inbox on the department's overview
// page showing the requests that came in via requests and via Hub Inbox (Jev
// decides whether to notify the team or not)".
//
// Events (trigger secret; the database calls them through public.call_edge):
//   request_new    {request_id}  the request is posted in the receiving team's Slack
//                                channel (hub_settings.team_inbox.channels, tried in
//                                order; request_types.channel overrides per type; time
//                                off is posted brief). Channel and ts are kept on
//                                dept_requests.slack so later updates go in its thread.
//   request_update {request_id, old_/new_ status, done, assignee, by}
//                                a reply in the request's thread; the requester gets a
//                                DM when it is done, a new assignee when it is handed on.
//   request_note   {note_id}     the note in the thread; the requester (or the assignee,
//                                when the requester wrote it) gets a DM.
//   mail_filed     {mail_id}     an email the Hub inbox filed for a team: Jev decides
//                                whether the team hears about it now (a post in their
//                                channel) or finds it in their inbox; kept on hub_mail.notify.
// Staff actions (Hub sign-in):
//   status   {}                  each team's channel as it resolves now (settings card)
//   channels {}                  the channels the bot can see
//   preview  {request_id}        the message a request would post, and where (no post)
//   jev_dry  {mail_id}           what Jev decides for an email (no post; leaders)
//   test     {department}        a test line in that team's channel (leaders)
//   repost   {request_id}        post a request that could not be posted before
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SITE = 'https://wa-exec-dashboard.netlify.app';
const SLACK_WEB = 'https://welfareavenue.slack.com';
const TZ = 'America/Toronto';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TEAMS: Record<string, string> = {
  opsmtl: 'Operations Montreal', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing',
  fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', board: 'Board & Governance',
};
type Settings = { channels: Record<string, string[]>; post_requests: boolean; thread_updates: boolean; dm_requester: boolean; email_mode: Record<string, string> };
const DEFAULT_CHANNELS: Record<string, string[]> = {
  opsmtl: ['operations-mtl'], progdev: ['program-development'], opsto: ['toronto-operations', 'general-toronto'],
  marketing: ['social-media'], fundraising: ['fundraising'], finance: ['accounting-finance'], hr: ['human-resources'], board: ['board-of-directors'],
};

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function log(entity: string, id: string, field: string, value: string, by = 'team-inbox v1') {
  try { await svc.from('change_log').insert({ entity_type: entity, entity_id: id, field, old_value: null, new_value: value.slice(0, 400), changed_by: by }); } catch (_) { /* audit only */ }
}
async function settings(): Promise<Settings> {
  const { data } = await svc.from('hub_settings').select('value').eq('key', 'team_inbox').maybeSingle();
  const v = ((data && data.value) || {}) as Record<string, unknown>;
  const channels: Record<string, string[]> = { ...DEFAULT_CHANNELS };
  const given = (v.channels || {}) as Record<string, unknown>;
  for (const k of Object.keys(given)) {
    const arr = (Array.isArray(given[k]) ? given[k] as unknown[] : [given[k]]).map(x => String(x || '').replace(/^#/, '').trim()).filter(Boolean);
    if (arr.length) channels[k] = arr;
  }
  return {
    channels,
    post_requests: v.post_requests !== false,
    thread_updates: v.thread_updates !== false,
    dm_requester: v.dm_requester !== false,
    email_mode: { ...((v.email_mode || {}) as Record<string, string>) },
  };
}

/* ---------- text ---------- */
function sx(s: unknown): string { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s: unknown, n: number): string { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
function day(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
}
function link(hash: string, label: string): string { return '<' + SITE + '/' + hash + '|' + sx(label).replace(/\|/g, '/') + '>'; }
function detailLines(details: unknown, max = 5): string[] {
  if (details == null) return [];
  if (typeof details === 'string') return details.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, max).map(s => clip(s, 200));
  if (typeof details === 'object' && !Array.isArray(details)) {
    return Object.entries(details as Record<string, unknown>).filter(([, v]) => v != null && String(v).trim() !== '').slice(0, max).map(([k, v]) => k + ': ' + clip(v, 170));
  }
  return [];
}

/* ---------- people ---------- */
type Member = { name: string; email: string | null; department: string | null };
let ROSTER: Member[] | null = null;
async function roster(): Promise<Member[]> {
  if (ROSTER) return ROSTER;
  const { data } = await svc.from('team_members').select('name, email, department').eq('active', true);
  ROSTER = ((data || []) as Member[]).map(m => ({ ...m, email: m.email ? m.email.toLowerCase() : null }));
  return ROSTER;
}
let USERS: Array<{ email: string; name: string }> | null = null;
async function users(): Promise<Array<{ email: string; name: string }>> {
  if (USERS) return USERS;
  const out: Array<{ email: string; name: string }> = [];
  try {
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of (data?.users || [])) {
      const md = (u.user_metadata || {}) as Record<string, string>;
      if (u.email) out.push({ email: u.email.toLowerCase(), name: String(md.full_name || md.name || '') });
    }
  } catch (_) { /* roster only */ }
  USERS = out;
  return out;
}
/* a person the Hub knows by a name ("Steel MacDonald", "Ian", "Meeting AI (accepted by Eno Moffat)") or an email */
async function emailFor(nameOrEmail: string | null | undefined): Promise<string | null> {
  const raw = String(nameOrEmail || '').trim();
  if (!raw) return null;
  if (/@/.test(raw)) return raw.toLowerCase();
  const m = raw.match(/accepted by ([^)]+)\)/i);
  const name = (m ? m[1] : raw).trim().toLowerCase();
  const chat = raw.match(/^Chat \(([^)@]+)\)$/i);
  if (chat) return chat[1].toLowerCase() + '@welfareavenue.com';
  const us = await users();
  const u = us.find(x => x.name.toLowerCase() === name);
  if (u) return u.email;
  const ro = await roster();
  const exact = ro.find(r => r.name.toLowerCase() === name && r.email);
  if (exact) return exact.email;
  const first = name.split(' ')[0];
  const firsts = ro.filter(r => r.email && r.name.toLowerCase().split(' ')[0] === first && !/test/i.test(r.name));
  if (firsts.length === 1) return firsts[0].email;
  const ufirst = us.filter(x => x.name.toLowerCase().split(' ')[0] === first);
  if (ufirst.length === 1) return ufirst[0].email;
  return null;
}
async function nameFor(email: string | null): Promise<string | null> {
  if (!email) return null;
  const us = await users(); const u = us.find(x => x.email === email.toLowerCase());
  if (u && u.name) return u.name;
  const ro = await roster(); const r = ro.find(x => x.email === email.toLowerCase());
  return r ? r.name : null;
}
function samePerson(a: string | null, b: string | null): boolean { return !!a && !!b && a.toLowerCase() === b.toLowerCase(); }

/* ---------- Slack ---------- */
let TOKEN: string | null = null;
async function token(): Promise<string> { if (!TOKEN) TOKEN = await getSecret('SLACK_BOT_TOKEN'); return TOKEN; }
// deno-lint-ignore no-explicit-any
async function slack(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch('https://slack.com/api/' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  return await res.json();
}
type Ch = { id: string; name: string; member: boolean; private: boolean };
let DIR: Ch[] | null = null;
async function directory(): Promise<Ch[]> {
  if (DIR) return DIR;
  const out: Ch[] = []; let cursor = '';
  for (let i = 0; i < 10; i++) {
    const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + (await token()) } });
    const b = await res.json();
    if (!b.ok) throw new Error('Slack conversations.list: ' + (b.error || res.status));
    // deno-lint-ignore no-explicit-any
    for (const c of ((b.channels || []) as any[])) out.push({ id: String(c.id), name: String(c.name), member: !!c.is_member, private: !!c.is_private });
    cursor = b.response_metadata?.next_cursor || ''; if (!cursor) break;
  }
  DIR = out;
  return out;
}
/* the first channel in the chain the bot can post in (joins public ones) */
async function resolve(chain: string[], join = true): Promise<{ ch: Ch | null; tried: Array<{ name: string; state: string }> }> {
  const dir = await directory();
  const tried: Array<{ name: string; state: string }> = [];
  for (const want of chain) {
    const c = dir.find(x => x.name === want || x.id === want);
    if (!c) { tried.push({ name: want, state: 'the bot cannot see it (a private channel needs the Hub app added)' }); continue; }
    if (c.member) { tried.push({ name: c.name, state: 'ok' }); return { ch: c, tried }; }
    if (!c.private && join) {
      const j = await slack('conversations.join', { channel: c.id });
      if (j.ok) { c.member = true; tried.push({ name: c.name, state: 'ok (joined)' }); return { ch: c, tried }; }
      tried.push({ name: c.name, state: 'could not join: ' + (j.error || 'refused') }); continue;
    }
    if (!c.private && !join) { tried.push({ name: c.name, state: 'ok (the bot joins on the first post)' }); return { ch: c, tried }; }
    tried.push({ name: c.name, state: 'the bot is not in it' });
  }
  return { ch: null, tried };
}
async function postTo(ch: Ch, text: string, threadTs?: string | null): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const out = await slack('chat.postMessage', { channel: ch.id, text, unfurl_links: false, unfurl_media: false, ...(threadTs ? { thread_ts: threadTs } : {}) });
  return out.ok ? { ok: true, ts: String(out.ts || '') } : { ok: false, error: String(out.error || 'Slack refused') };
}
function permalink(channelId: string, ts: string): string { return SLACK_WEB + '/archives/' + channelId + '/p' + String(ts).replace('.', ''); }
async function slackIdFor(email: string | null): Promise<string | null> {
  if (!email) return null;
  const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email.toLowerCase()).maybeSingle();
  if (data && data.slack_id) return String(data.slack_id);
  try {
    const res = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + (await token()) } });
    const b = await res.json();
    if (b.ok && b.user && b.user.id) {
      await svc.from('wa_slack_ids').upsert({ email: email.toLowerCase(), slack_id: b.user.id, source: 'lookupByEmail', updated_at: new Date().toISOString() });
      return String(b.user.id);
    }
  } catch (_) { /* no id */ }
  return null;
}
async function mention(nameOrEmail: string | null | undefined): Promise<string> {
  const raw = String(nameOrEmail || '').trim();
  if (!raw) return '';
  const em = await emailFor(raw);
  const sid = await slackIdFor(em);
  if (sid) return '<@' + sid + '>';
  return '*' + sx(/@/.test(raw) ? ((await nameFor(raw)) || raw) : raw) + '*';
}
async function optedOut(email: string, event: string): Promise<boolean> {
  const { data } = await svc.from('wa_notify_prefs').select('disabled').eq('email', email.toLowerCase()).maybeSingle();
  const d = (data && data.disabled) || [];
  return Array.isArray(d) && d.indexOf(event) >= 0;
}
async function dm(email: string | null, text: string, event: string): Promise<string> {
  if (!email) return 'no email';
  if (await optedOut(email, event)) return 'opted out';
  const sid = await slackIdFor(email);
  if (!sid) return 'no Slack id';
  const o = await slack('conversations.open', { users: sid });
  if (!o.ok) return 'open failed: ' + (o.error || '');
  const p = await slack('chat.postMessage', { channel: o.channel.id, text, unfurl_links: false, unfurl_media: false });
  return p.ok ? 'sent' : 'failed: ' + (p.error || '');
}

/* ---------- requests ---------- */
type Req = { id: number; type_key: string | null; department: string; title: string; details: unknown; status: string | null; requested_by: string | null; requested_email: string | null; created_at: string; done: boolean; assignee: string | null; needed_by: string | null; priority: string | null; source: string | null; slack: Record<string, unknown> | null; updated_by: string | null };
type RType = { key: string; label: string; channel: string | null; channel_mode: string | null; default_assignee: string | null };
async function loadReq(id: number): Promise<{ r: Req | null; rt: RType | null }> {
  const { data: r } = await svc.from('dept_requests').select('*').eq('id', id).maybeSingle();
  if (!r) return { r: null, rt: null };
  let rt: RType | null = null;
  if (r.type_key) { const q = await svc.from('request_types').select('key, label, channel, channel_mode, default_assignee').eq('key', r.type_key).maybeSingle(); rt = (q.data as RType) || null; }
  return { r: r as Req, rt };
}
function chainFor(s: Settings, r: Req, rt: RType | null): string[] {
  const out: string[] = [];
  if (rt && rt.channel) out.push(String(rt.channel).replace(/^#/, ''));
  for (const c of (s.channels[r.department] || [])) if (out.indexOf(c) < 0) out.push(c);
  return out;
}
async function whoLabel(r: Req): Promise<string> {
  const s = String(r.requested_by || '');
  const m = s.match(/^Meeting AI \(accepted by (.+)\)$/);
  if (m) return m[1] + ' (spotted in a meeting)';
  const c = s.match(/^Chat \((.+)\)$/);
  if (c) return ((await nameFor(c[1].indexOf('@') > 0 ? c[1] : c[1] + '@welfareavenue.com')) || c[1]) + ' (through Ask the Hub)';
  return s || (await nameFor(r.requested_email)) || 'someone';
}
async function requestText(r: Req, rt: RType | null): Promise<string> {
  const team = TEAMS[r.department] || r.department;
  const brief = rt && rt.channel_mode === 'brief';
  const who = await whoLabel(r);
  const lines: string[] = [];
  lines.push(':inbox_tray: *New request for ' + sx(team) + '*' + (rt ? ' · ' + sx(rt.label) : ''));
  lines.push('*' + link('#requests/r/' + r.id, clip(r.title, 150)) + '*');
  if (!brief) detailLines(r.details, 5).forEach(l => lines.push('• ' + sx(l)));
  const meta: string[] = ['From ' + sx(who)];
  if (r.needed_by) meta.push('needed by ' + day(r.needed_by));
  if (r.priority === 'urgent') meta.push(':rotating_light: *urgent*');
  if (brief) meta.push('the details are in the Hub');
  lines.push(meta.join(' · '));
  const owner = r.assignee || (rt && rt.default_assignee) || null;
  if (owner) lines.push('For ' + (await mention(owner)));
  return lines.join('\n');
}
async function saveSlack(id: number, slackInfo: Record<string, unknown>) {
  await svc.from('dept_requests').update({ slack: slackInfo }).eq('id', id);
}
async function requestNew(id: number, force = false): Promise<Record<string, unknown>> {
  const s = await settings();
  const { r, rt } = await loadReq(id);
  if (!r) return { error: 'request not found' };
  if (!s.post_requests && !force) { await saveSlack(id, { skipped: 'posting new requests is off', at: new Date().toISOString() }); return { skipped: 'off' }; }
  if (r.slack && (r.slack as Record<string, unknown>).ts) return { skipped: 'already posted', channel: (r.slack as Record<string, unknown>).channel };
  const chain = chainFor(s, r, rt);
  if (!chain.length) { await saveSlack(id, { error: 'no channel set for ' + r.department, at: new Date().toISOString() }); return { error: 'no channel' }; }
  const res = await resolve(chain);
  if (!res.ch) {
    const err = 'could not post: ' + res.tried.map(t => '#' + t.name + ' (' + t.state + ')').join(', ');
    await saveSlack(id, { error: err, tried: res.tried, at: new Date().toISOString() });
    await log('request', String(id), 'slack', err);
    return { error: err };
  }
  const text = await requestText(r, rt);
  const out = await postTo(res.ch, text);
  if (!out.ok) {
    await saveSlack(id, { error: 'Slack refused: ' + out.error, channel: res.ch.name, at: new Date().toISOString() });
    await log('request', String(id), 'slack', 'refused in #' + res.ch.name + ': ' + out.error);
    return { error: out.error };
  }
  const info = { channel: res.ch.name, channel_id: res.ch.id, ts: out.ts, url: permalink(res.ch.id, out.ts!), at: new Date().toISOString() };
  await saveSlack(id, info);
  await log('request', String(id), 'slack', 'posted in #' + res.ch.name);
  return { ok: true, ...info };
}
function slackOf(r: Req): { channel_id: string; ts: string } | null {
  const s = (r.slack || {}) as Record<string, unknown>;
  return s.channel_id && s.ts ? { channel_id: String(s.channel_id), ts: String(s.ts) } : null;
}
async function thread(r: Req, text: string): Promise<string> {
  const t = slackOf(r); if (!t) return 'no thread';
  const out = await slack('chat.postMessage', { channel: t.channel_id, thread_ts: t.ts, text, unfurl_links: false, unfurl_media: false });
  return out.ok ? 'threaded' : 'thread failed: ' + (out.error || '');
}
async function requestUpdate(b: Record<string, unknown>): Promise<Record<string, unknown>> {
  const s = await settings();
  const { r } = await loadReq(Number(b.request_id));
  if (!r) return { error: 'request not found' };
  const by = String(b.by || r.updated_by || '').trim();
  const parts: string[] = [];
  const doneNow = b.new_done === true && b.old_done !== true;
  const reopened = b.old_done === true && b.new_done === false;
  if (doneNow) parts.push(':white_check_mark: *Done*');
  else if (reopened) parts.push(':leftwards_arrow_with_hook: *Reopened*');
  if (!doneNow && b.old_status !== b.new_status && b.new_status) parts.push(':arrows_counterclockwise: Status: *' + sx(b.new_status) + '*');
  const newOwner = b.old_assignee !== b.new_assignee && b.new_assignee ? String(b.new_assignee) : null;
  if (newOwner) parts.push(':bust_in_silhouette: Now with ' + (await mention(newOwner)));
  const outcome: Record<string, string> = {};
  if (parts.length && s.thread_updates) outcome.thread = await thread(r, parts.join(' · ') + (by ? ' _(' + sx(by) + ')_' : ''));
  const requester = r.requested_email || (await emailFor(r.requested_by));
  const byEmail = await emailFor(by);
  const team = TEAMS[r.department] || r.department;
  if (doneNow && s.dm_requester && requester && !samePerson(requester, byEmail)) {
    outcome.requester = await dm(requester, ':white_check_mark: Your request *' + sx(clip(r.title, 120)) + '* to ' + sx(team) + ' is done' + (by ? ' (' + sx(by) + ')' : '') + '. ' + link('#requests/r/' + r.id, 'Open it'), 'request_update');
  }
  if (newOwner) {
    const ownerEmail = await emailFor(newOwner);
    if (ownerEmail && !samePerson(ownerEmail, byEmail)) outcome.assignee = await dm(ownerEmail, ':card_index_dividers: A request for ' + sx(team) + ' is now yours: *' + sx(clip(r.title, 120)) + '*' + (r.needed_by ? ' (needed by ' + day(r.needed_by) + ')' : '') + (by ? '\nHanded over by ' + sx(by) : '') + '\n' + link('#requests/r/' + r.id, 'Open it'), 'task_reassigned');
  }
  await log('request', String(r.id), 'slack update', JSON.stringify(outcome));
  return { ok: true, ...outcome };
}
async function requestNote(noteId: number): Promise<Record<string, unknown>> {
  const s = await settings();
  const { data: n } = await svc.from('request_notes').select('*').eq('id', noteId).maybeSingle();
  if (!n) return { error: 'note not found' };
  const { r } = await loadReq(Number(n.request_id));
  if (!r) return { error: 'request not found' };
  const outcome: Record<string, string> = {};
  if (s.thread_updates) outcome.thread = await thread(r, ':speech_balloon: *' + sx(n.author) + '*: ' + sx(clip(n.body, 700)));
  const requester = r.requested_email || (await emailFor(r.requested_by));
  const author = n.email ? String(n.email).toLowerCase() : await emailFor(n.author);
  const team = TEAMS[r.department] || r.department;
  if (s.dm_requester && requester && !samePerson(requester, author)) {
    outcome.requester = await dm(requester, ':speech_balloon: ' + sx(n.author) + ' added a note on your request *' + sx(clip(r.title, 100)) + '*:\n> ' + sx(clip(n.body, 400)) + '\n' + link('#requests/r/' + r.id, 'Reply in the Hub'), 'request_update');
  } else if (samePerson(requester, author) && r.assignee) {
    const ae = await emailFor(r.assignee);
    if (ae && !samePerson(ae, author)) outcome.assignee = await dm(ae, ':speech_balloon: ' + sx(n.author) + ' added a note on their request to ' + sx(team) + ', *' + sx(clip(r.title, 100)) + '*:\n> ' + sx(clip(n.body, 400)) + '\n' + link('#requests/r/' + r.id, 'Open it'), 'request_update');
  }
  await log('request', String(r.id), 'note', JSON.stringify(outcome));
  return { ok: true, ...outcome };
}

/* ---------- emails the Hub inbox filed: Jev decides ---------- */
type Mail = { id: number; gmail_id: string | null; internal_date: string | null; from_email: string | null; from_name: string | null; subject: string | null; title: string | null; summary: string | null; kind: string | null; department: string | null; amount: number | null; due_date: string | null; meeting_date: string | null; status: string | null; filed: Record<string, unknown> | null; notify: Record<string, unknown> | null; attachments: Array<{ filename: string }> | null; body_text: string | null };
const KIND_LABEL: Record<string, string> = { invoice: 'Invoice', meeting_summary: 'Meeting summary', update: 'Email', application: 'Job application' };
/* v1.2: a money email says what it is (the Hub inbox files them all as kind invoice) */
function kindLabel(m: Mail): string {
  if (m.kind !== 'invoice') return KIND_LABEL[String(m.kind)] || 'Email';
  const t = ((m.title || '') + ' ' + (m.subject || '')).toLowerCase();
  if (/reimburs|rembours/.test(t)) return 'Reimbursement';
  if (/declined|failed|past due|overdue|unpaid|action required/.test(t)) return 'Payment problem';
  if (/refund/.test(t)) return 'Refund';
  if (/receipt|re\u00e7u|recu\b|payment received|paid/.test(t)) return 'Receipt';
  if (/statement/.test(t)) return 'Statement';
  return 'Invoice';
}
function filedLabel(m: Mail): string {
  const f = (m.filed || {}) as Record<string, unknown>;
  if (f.type === 'task') return 'filed on the Finance board';
  if (f.type === 'transcript') return 'sent through the meeting pipeline';
  if (f.type === 'candidate') return 'added to Recruitment';
  if (f.type === 'update') return 'filed as an update on the team page';
  return 'filed';
}
type Decision = { notify: boolean; p: number | null; why: string | null; why_conf: number | null; ask: number | null; by: string; note?: string };
async function jevDecide(m: Mail): Promise<Decision> {
  const team = TEAMS[String(m.department)] || String(m.department);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const state = {
    today, team,
    email: {
      from: (m.from_name ? m.from_name + ' ' : '') + '<' + (m.from_email || '') + '>', received: m.internal_date, subject: m.subject,
      what_it_is: kindLabel(m), summary: m.summary, amount: m.amount, due_date: m.due_date, meeting_date: m.meeting_date,
      attachments: (m.attachments || []).map(a => a.filename).slice(0, 6), body_excerpt: clip(m.body_text || '', 1800),
    },
    what_the_hub_did: filedLabel(m),
  };
  const questions = {
    notify: { type: 'noul', instructions: 'Should the ' + team + ' team get a Slack message about this email now? Yes when someone on the team has to act, reply or decide soon: a question or request addressed to them, a deadline or event date coming up, a bill to pay, an applicant, or a partner, donor or volunteer waiting on us. No when finding it filed in their Hub inbox later is enough: thank-yous, FYIs, recaps of things they already know, newsletters, automated notices.' },
    why: { type: 'choice', instructions: 'What is this email for the team?', criteria: { act: 'Someone on the team needs to act, reply or decide soon', deadline: 'It carries a date or deadline the team has to meet', fyi: 'Good to know, nothing to do', record: 'Only worth keeping on record' } },
    ask: { type: 'noul', instructions: 'Is the email asking the team to do a specific piece of work for someone, something that could be tracked through to done as a request?' },
  };
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'mail_triage', 'x-wa-caller': 'team-inbox', 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, questions }),
    });
    if (!res.ok) throw new Error('Jev ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const out = await res.json();
    const a = (out && out.answers) || {};
    const p = typeof a.notify?.noul === 'number' ? a.notify.noul : null;
    const why = a.why?.choice ? String(a.why.choice) : null;
    const wc = typeof a.why?.confidence === 'number' ? a.why.confidence : null;
    const ask = typeof a.ask?.noul === 'number' ? a.ask.noul : null;
    if (p === null) throw new Error('Jev gave no answer');
    const notify = p >= 0.55 || ((why === 'act' || why === 'deadline') && (wc || 0) >= 0.7 && p >= 0.4);
    return { notify, p, why, why_conf: wc, ask, by: 'jev' };
  } catch (e) {
    /* the rule when Jev is unreachable: bills, applicants and anything due within ten days get a ping */
    const soon = m.due_date ? (new Date(m.due_date + 'T12:00:00').getTime() - Date.now()) < 10 * 86400000 : false;
    const notify = m.kind === 'invoice' || m.kind === 'application' || soon;
    return { notify, p: null, why: notify ? 'act' : 'fyi', why_conf: null, ask: null, by: 'rule', note: String((e as Error).message || e).slice(0, 160) };
  }
}
const WHY_TEXT: Record<string, string> = { act: 'someone needs to act', deadline: 'it has a deadline', fyi: 'good to know', record: 'for the record' };
async function mailText(m: Mail, d: Decision): Promise<string> {
  const team = TEAMS[String(m.department)] || String(m.department);
  const lines: string[] = [];
  lines.push(':envelope_with_arrow: *' + sx(kindLabel(m)) + ' for ' + sx(team) + '* · through the Hub inbox');
  lines.push('*' + link('#requests/m/' + m.id, clip(m.title || m.subject || 'Email', 150)) + '*');
  if (m.summary) lines.push('> ' + sx(clip(m.summary, 320)));
  const meta: string[] = ['From ' + sx(m.from_name || m.from_email || 'someone')];
  if (m.amount != null) meta.push('$' + Number(m.amount).toLocaleString('en-CA', { maximumFractionDigits: 2 }));
  if (m.due_date) meta.push('due ' + day(m.due_date));
  meta.push(filedLabel(m));
  lines.push(meta.join(' · '));
  if (d.by === 'jev' && d.why) lines.push('_Jev flagged it: ' + (WHY_TEXT[d.why] || d.why) + (d.p != null ? ' (' + Math.round(d.p * 100) + '%)' : '') + '_');
  return lines.join('\n');
}
async function mailFiled(id: number, dry = false): Promise<Record<string, unknown>> {
  const s = await settings();
  const { data } = await svc.from('hub_mail').select('id, gmail_id, internal_date, from_email, from_name, subject, title, summary, kind, department, amount, due_date, meeting_date, status, filed, notify, attachments, body_text').eq('id', id).maybeSingle();
  const m = data as Mail | null;
  if (!m) return { error: 'mail not found' };
  if (!m.department || m.kind === 'noise' || m.status !== 'filed' || (m.filed || {}).type === 'inbox') return { skipped: 'not filed to a team' };
  const prev = (m.notify || {}) as Record<string, unknown>;
  if (!dry && prev.department === m.department && (prev.ts || prev.decision === 'file')) return { skipped: 'already decided for this team' };
  const mode = s.email_mode[m.department] || 'jev';
  let d: Decision;
  if (mode === 'always') d = { notify: true, p: null, why: null, why_conf: null, ask: null, by: 'setting' };
  else if (mode === 'never') d = { notify: false, p: null, why: null, why_conf: null, ask: null, by: 'setting' };
  else d = await jevDecide(m);
  const rec: Record<string, unknown> = { department: m.department, decision: d.notify ? 'notify' : 'file', p: d.p, why: d.why, why_conf: d.why_conf, ask: d.ask, by: d.by, note: d.note || null, at: new Date().toISOString() };
  if (dry) return { dry: true, ...rec, text: d.notify ? await mailText(m, d) : null };
  if (d.notify) {
    const chain = s.channels[m.department] || [];
    const res = chain.length ? await resolve(chain) : { ch: null, tried: [] as Array<{ name: string; state: string }> };
    if (!res.ch) rec.error = 'could not post: ' + (res.tried.map(t => '#' + t.name + ' (' + t.state + ')').join(', ') || 'no channel set');
    else {
      const out = await postTo(res.ch, await mailText(m, d));
      if (out.ok) { rec.channel = res.ch.name; rec.channel_id = res.ch.id; rec.ts = out.ts; rec.url = permalink(res.ch.id, out.ts!); }
      else rec.error = 'Slack refused: ' + out.error;
    }
  }
  await svc.from('hub_mail').update({ notify: rec }).eq('id', id);
  await log('hub_mail', String(id), 'team notify', (d.notify ? 'notify' : 'file quietly') + ' (' + d.by + (d.p != null ? ' ' + Math.round(d.p * 100) + '%' : '') + ')' + (rec.channel ? ' in #' + rec.channel : '') + (rec.error ? ' ' + rec.error : ''));
  return { ok: true, ...rec };
}

/* ---------- staff ---------- */
async function caller(req: Request): Promise<{ email: string; name: string; role: string } | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email || !(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  const md = (data?.user?.user_metadata || {}) as Record<string, string>;
  const { data: role } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
  return { email, name: md.full_name || md.name || email.split('@')[0], role: String((role && role.role) || 'member') };
}

async function work(event: string, b: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (event === 'request_new') return requestNew(Number(b.request_id));
  if (event === 'request_update') return requestUpdate(b);
  if (event === 'request_note') return requestNote(Number(b.note_id));
  if (event === 'mail_filed') return mailFiled(Number(b.mail_id));
  return { error: 'unknown event' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const event = String(body.event || '');
  let secretOk = false;
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) secretOk = true; } catch (_) { /* no */ }
  try {
    if (event) {
      if (!secretOk) return json({ error: 'unauthorized' }, 401);
      if (body.wait === true) return json(await work(event, body));
      const job = work(event, body).catch(async (e) => { await log('team-inbox', event, 'error', String((e as Error).message || e)); });
      // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(job); return json({ accepted: true }, 202); }
      await job;
      return json({ ok: true });
    }
    const me = secretOk && typeof body.as_email === 'string' ? { email: String(body.as_email).toLowerCase(), name: String(body.as_name || body.as_email), role: String(body.as_role || 'admin') } : await caller(req);
    if (!me) return json({ error: 'unauthorized' }, 401);
    const leader = me.role === 'admin' || me.role === 'leader';
    const action = String(body.action || '');
    if (action === 'status') {
      const s = await settings();
      const out: Record<string, unknown> = {};
      for (const d of Object.keys(TEAMS)) {
        const chain = s.channels[d] || [];
        const r = chain.length ? await resolve(chain, false) : { ch: null, tried: [] };
        out[d] = { chain, channel: r.ch ? r.ch.name : null, tried: r.tried };
      }
      const { data: types } = await svc.from('request_types').select('key, label, department, channel, channel_mode').not('channel', 'is', null);
      const over: Record<string, unknown> = {};
      for (const t of (types || []) as Array<{ key: string; channel: string }>) { const r = await resolve([t.channel], false); over[t.key] = { channel: t.channel, ok: !!r.ch, tried: r.tried }; }
      return json({ ok: true, teams: out, type_channels: over, settings: s });
    }
    if (action === 'channels') {
      const dir = await directory();
      return json({ ok: true, channels: dir.slice().sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (action === 'preview') {
      const s = await settings();
      const { r, rt } = await loadReq(Number(body.request_id));
      if (!r) return json({ error: 'request not found' }, 404);
      const chain = chainFor(s, r, rt);
      const res = await resolve(chain, false);
      return json({ ok: true, chain, channel: res.ch ? res.ch.name : null, tried: res.tried, text: await requestText(r, rt) });
    }
    if (action === 'jev_dry') {
      if (!leader) return json({ error: 'leaders and admins only' }, 403);
      return json(await mailFiled(Number(body.mail_id), true));
    }
    if (action === 'test') {
      if (!leader) return json({ error: 'leaders and admins only' }, 403);
      const d = String(body.department || '');
      if (!TEAMS[d]) return json({ error: 'unknown team' }, 400);
      const s = await settings();
      const res = await resolve(s.channels[d] || []);
      if (!res.ch) return json({ error: 'could not post: ' + res.tried.map(t => '#' + t.name + ' (' + t.state + ')').join(', '), tried: res.tried }, 400);
      const out = await postTo(res.ch, ':wave: A test from the Hub: new requests for *' + sx(TEAMS[d]) + '* will be posted here, and emails the Hub inbox files for the team when Jev thinks they need you. _Sent by ' + sx(me.name) + '_');
      if (!out.ok) return json({ error: 'Slack refused: ' + out.error }, 400);
      await log('team-inbox', d, 'test post', '#' + res.ch.name + ' by ' + me.email);
      return json({ ok: true, channel: res.ch.name, url: permalink(res.ch.id, out.ts!) });
    }
    if (action === 'repost') {
      const out = await requestNew(Number(body.request_id), true);
      return json(out, out.error ? 400 : 200);
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
