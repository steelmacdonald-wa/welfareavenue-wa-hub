// Welfare Avenue: team-inbox (v1.5, 30/09/26, wave180d: an announcement is also emailed once to each person it is for, from
// hub@welfareavenue.com as "<the poster> via the Hub" with replies to the poster (Welfare Avenue addresses only, never the poster,
// at most hub_settings.team_inbox.announce_email_daily (5) a day from one person); what it did is kept in hub_announcements.emailed;
// the poster can untick it (post_email). Steel (30/09/26): "Actually last question it should be emailed as well".
// v1.4, 30/09/26, wave180: an announcement is posted once in Slack when it is posted (event announcement,
// from the hub_announcements insert trigger): the teams' channels, #general for everyone, #leaders for the leaders
// (hub_settings.team_inbox.announce), with a link to answer its poll or short form in the Hub; what it did is kept in
// hub_announcements.slack. Steel (30/09/26) chose "Home + one Slack post". v1.3, 30/09/26, wave170: an email sent to info@ (the Hub inbox, mailbox info) and an email someone sent
// to a team from their inbox assistant (mailbox person, filed.type forward) always go out, with the one-line ask: a DM to the person
// it is for (assignee_email), else a post in the team's channel; an info@ email someone on the team is already on (filed.on_thread) is
// filed quietly. Steel: "with info@welfareavenue.com we get a few emails there as well
// that needs to forwarded to the correct groups and individuals with a brief note of an ask of what they should take action on."
// v1.2, 29/09/26: Finance is a team of its own for requests and emails, apart from Fundraising, and posts in
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
//   announce_dry {id} or {draft}  where an announcement would be posted, who it would be emailed to, the
//                                Slack text and the email (subject, text, html); nothing is written or sent (leaders)
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
type Settings = { channels: Record<string, string[]>; post_requests: boolean; thread_updates: boolean; dm_requester: boolean; email_mode: Record<string, string>; announce: Record<string, string>; announce_email_daily: number };
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
    announce: { everyone: 'general', leaders: 'leaders', ...((v.announce || {}) as Record<string, string>) },
    announce_email_daily: Math.max(1, Math.min(50, Number(v.announce_email_daily) || 5)),
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
type Mail = { id: number; gmail_id: string | null; internal_date: string | null; from_email: string | null; from_name: string | null; subject: string | null; title: string | null; summary: string | null; kind: string | null; department: string | null; amount: number | null; due_date: string | null; meeting_date: string | null; status: string | null; filed: Record<string, unknown> | null; notify: Record<string, unknown> | null; attachments: Array<{ filename: string }> | null; body_text: string | null; mailbox?: string | null; ask?: string | null; assignee?: string | null; assignee_email?: string | null; forwarded_by?: string | null };
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
/* v1.3: an email passed on (info@, or sent on by a person): what to do comes first */
function passedText(m: Mail, forPerson: boolean): string {
  const team = TEAMS[String(m.department)] || String(m.department);
  const via = m.mailbox === 'info' ? 'sent to info@' : 'sent on by ' + sx(m.forwarded_by || 'a colleague') + ' from their inbox';
  const lines: string[] = [];
  lines.push(':envelope_with_arrow: *' + (forPerson ? 'An email for you' : sx(kindLabel(m)) + ' for ' + sx(team)) + '* · ' + via);
  lines.push('*' + link('#requests/m/' + m.id, clip(m.title || m.subject || 'Email', 150)) + '*');
  if (m.ask) lines.push('*To do:* ' + sx(clip(m.ask, 300)));
  else if (m.summary) lines.push('> ' + sx(clip(m.summary, 320)));
  const meta: string[] = ['From ' + sx(m.from_name || m.from_email || 'someone')];
  if (m.amount != null) meta.push('$' + Number(m.amount).toLocaleString('en-CA', { maximumFractionDigits: 2 }));
  if (m.due_date) meta.push('due ' + day(m.due_date));
  if (forPerson) meta.push('in the ' + sx(team) + ' inbox'); else if (m.assignee) meta.push('for ' + sx(m.assignee));
  lines.push(meta.join(' · '));
  return lines.join('\n');
}
async function mailFiled(id: number, dry = false): Promise<Record<string, unknown>> {
  const s = await settings();
  const { data } = await svc.from('hub_mail').select('id, gmail_id, internal_date, from_email, from_name, subject, title, summary, kind, department, amount, due_date, meeting_date, status, filed, notify, attachments, body_text, mailbox, ask, assignee, assignee_email, forwarded_by').eq('id', id).maybeSingle();
  const m = data as Mail | null;
  if (!m) return { error: 'mail not found' };
  if (!m.department || m.kind === 'noise' || m.status !== 'filed' || (m.filed || {}).type === 'inbox') return { skipped: 'not filed to a team' };
  const prev = (m.notify || {}) as Record<string, unknown>;
  if (!dry && prev.department === m.department && (prev.ts || prev.decision === 'file')) return { skipped: 'already decided for this team' };
  /* v1.3: passed on (info@, or sent on by a person): always, to the person it is for when there is one */
  const passed = m.mailbox === 'info' || m.mailbox === 'person' || (m.filed || {}).type === 'forward';
  if (passed) {
    const by = m.mailbox === 'info' ? 'info' : 'forward';
    const rec: Record<string, unknown> = { department: m.department, decision: 'notify', p: null, why: 'act', why_conf: null, ask: null, by, at: new Date().toISOString() };
    /* someone on the team is already on the email thread: it is theirs, filed quietly (no ping for a thread they are in) */
    const onThread = by === 'info' ? String((m.filed || {}).on_thread || '') : '';
    if (onThread) {
      rec.decision = 'file'; rec.why = 'on the thread'; rec.on_thread = onThread;
      if (dry) return { dry: true, ...rec, to: 'nobody (on the thread)' };
      await svc.from('hub_mail').update({ notify: rec }).eq('id', id);
      await log('hub_mail', String(id), 'team notify', 'filed quietly (info): ' + onThread + ' is on the thread');
      return { ok: true, ...rec };
    }
    if (dry) return { dry: true, ...rec, to: m.assignee_email ? 'dm ' + m.assignee_email : 'channel', text: passedText(m, !!m.assignee_email) };
    let sent = false;
    if (m.assignee_email) {
      const out = await dm(m.assignee_email, passedText(m, true), 'mail_for_you');
      rec.dm = m.assignee || m.assignee_email; rec.dm_state = out;
      sent = out === 'sent';
    }
    if (!sent) {
      const chain = s.channels[m.department] || [];
      const res = chain.length ? await resolve(chain) : { ch: null, tried: [] as Array<{ name: string; state: string }> };
      if (!res.ch) rec.error = 'could not post: ' + (res.tried.map(t => '#' + t.name + ' (' + t.state + ')').join(', ') || 'no channel set');
      else {
        const out = await postTo(res.ch, passedText(m, false));
        if (out.ok) { rec.channel = res.ch.name; rec.channel_id = res.ch.id; rec.ts = out.ts; rec.url = permalink(res.ch.id, out.ts!); if (rec.dm) rec.dm = null; }
        else rec.error = 'Slack refused: ' + out.error;
      }
    }
    await svc.from('hub_mail').update({ notify: rec }).eq('id', id);
    await log('hub_mail', String(id), 'team notify', 'passed on (' + by + ')' + (rec.dm ? ' to ' + rec.dm : '') + (rec.channel ? ' in #' + rec.channel : '') + (rec.error ? ' ' + rec.error : ''));
    return { ok: true, ...rec };
  }
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

/* ---------- v1.4 (wave180): an announcement, posted once in Slack; v1.5 (wave180d): and emailed once ---------- */
type Ann = { id: number; title: string; body: string | null; audience: string; teams: string[] | null; ask: Record<string, unknown> | null; closes_at: string | null;
  post_slack: boolean; slack: Record<string, unknown> | null; post_email: boolean; emailed: Record<string, unknown> | null;
  created_by: string | null; created_name: string | null; anonymous: boolean; show_results: boolean; link: string | null };
const ANN_COLS = 'id, title, body, audience, teams, ask, closes_at, post_slack, slack, post_email, emailed, created_by, created_name, anonymous, show_results, link';
function annText(a: Ann, name: string): string {
  const lines: string[] = [];
  const ask = a.ask || null;
  lines.push(':mega: *' + sx(clip(a.title, 200)) + '*');
  if (a.body) lines.push(sx(clip(a.body, 600)));
  if (ask && ask.type === 'poll') lines.push(':bar_chart: *' + sx(clip(String(ask.question || ''), 200)) + '*' + (a.anonymous ? ' _(anonymous)_' : ''));
  if (ask && ask.type === 'form') { const n = Array.isArray(ask.questions) ? (ask.questions as unknown[]).length : 0; lines.push(':memo: *A short form*, ' + n + ' question' + (n === 1 ? '' : 's') + (a.anonymous ? ' _(anonymous)_' : '')); }
  lines.push(link('#announce/' + a.id, ask ? (ask.type === 'poll' ? 'Answer the poll in the Hub' : 'Answer it in the Hub') : 'Open it in the Hub') + (a.closes_at ? ' · closes ' + day(a.closes_at) : ''));
  lines.push('_From ' + sx(name) + ', in the Hub_');
  return lines.join('\n');
}
/* the poster's Welfare Avenue address: Steel may sign in with his gmail (wa_email_aliases, as mybox_me reads it) */
async function posterEmail(a: Ann): Promise<string | null> {
  const by = String(a.created_by || '').toLowerCase().trim();
  if (!by || by.endsWith('@welfareavenue.com')) return by || null;
  const { data } = await svc.from('wa_email_aliases').select('email, aliases');
  const hit = ((data || []) as Array<{ email: string; aliases: string[] | null }>).find(r => (r.aliases || []).some(x => String(x || '').toLowerCase() === by));
  return hit && hit.email ? String(hit.email).toLowerCase() : (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(by) ? by : null);
}
/* the poster's name from their sign-in (not the name the page sent), so nobody posts as someone else */
async function posterName(a: Ann): Promise<string> {
  const wa = await posterEmail(a);
  return (await nameFor(wa)) || (await nameFor(a.created_by)) || String(a.created_name || '').trim() || 'the Hub';
}

async function slackPart(a: Ann, name: string, dry: boolean): Promise<Record<string, unknown>> {
  const s = await settings();
  const chains: Array<{ team: string; chain: string[] }> = a.audience === 'everyone' ? [{ team: 'everyone', chain: [s.announce.everyone || 'general'] }]
    : a.audience === 'leaders' ? [{ team: 'leaders', chain: [s.announce.leaders || 'leaders'] }]
    : (a.teams || []).map(t => ({ team: t, chain: s.channels[t] || [] }));
  const text = annText(a, name);
  if (dry) {
    const out: Array<Record<string, unknown>> = [];
    for (const c of chains) { const r = c.chain.length ? await resolve(c.chain, false) : { ch: null, tried: [] as Array<{ name: string; state: string }> }; out.push({ team: c.team, channel: r.ch ? r.ch.name : null, tried: r.tried }); }
    return { channels: out, text };
  }
  const posts: Array<Record<string, unknown>> = [], errors: Array<Record<string, unknown>> = [], seen = new Set<string>();
  for (const c of chains) {
    if (!c.chain.length) { errors.push({ team: c.team, error: 'no channel set' }); continue; }
    const r = await resolve(c.chain);
    if (!r.ch) { errors.push({ team: c.team, error: 'could not post: ' + r.tried.map(t => '#' + t.name + ' (' + t.state + ')').join(', ') }); continue; }
    if (seen.has(r.ch.id)) continue;
    seen.add(r.ch.id);
    const out = await postTo(r.ch, text);
    if (out.ok) posts.push({ team: c.team, channel: r.ch.name, channel_id: r.ch.id, ts: out.ts, url: permalink(r.ch.id, out.ts!) });
    else errors.push({ team: c.team, error: 'Slack refused: ' + out.error });
  }
  const rec = { posts, errors, at: new Date().toISOString() };
  await svc.from('hub_announcements').update({ slack: rec }).eq('id', a.id);
  await log('announcement', String(a.id), 'slack', (posts.map(p => '#' + p.channel).join(', ') || 'not posted') + (errors.length ? ' | ' + errors.map(e => e.team + ': ' + e.error).join('; ') : ''));
  return { ok: true, ...rec };
}

/* ---------- v1.5 (wave180d): the email, once, to each person it is for ----------
   From hub@welfareavenue.com as "<the poster> via the Hub", replies to the poster; one message per person (nobody sees the list);
   only Welfare Avenue addresses; never the poster; at most settings.announce_email_daily (5) emailed announcements a day from
   one person, so a slip cannot flood the team. What it did is kept in hub_announcements.emailed (counts and names, no addresses). */
const HUB_MAIL = 'hub@welfareavenue.com';
const WA_DOMAIN = '@welfareavenue.com';
const CREAM = '#FFFAF2', GREEN = '#103F39', INK = '#1F201E', GOLD = '#DCA527', MUTED = '#51625D';
const HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
const BODYF = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
const LOGO_CREAM = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/logo-primary-cream-600.png';
const TEAM_LABEL: Record<string, string> = { ...TEAMS, board: 'the board', exec: 'the Executive team' };

function b64bytes(bytes: Uint8Array): string { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function b64url(bytes: Uint8Array): string { return b64bytes(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64lines(s: string): string { return b64bytes(new TextEncoder().encode(s)).replace(/.{76}/g, '$&\r\n').replace(/\r\n$/, ''); }
function oneLine(s: unknown): string { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }
function mimeWord(s: string): string { const t = oneLine(s); return /^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + b64bytes(new TextEncoder().encode(t)) + '?='; }
function mailbox(name: string, email: string): string {
  const n = oneLine(name).replace(/["\\<>]/g, '');
  return n ? (/^[\x20-\x7e]*$/.test(n) ? '"' + n + '"' : mimeWord(n)) + ' <' + email + '>' : email;
}
function ea(s: unknown): string { return sx(s).replace(/"/g, '&quot;'); }
function firstOf(name: string | null | undefined): string { return oneLine(name).split(' ')[0] || ''; }
function longDay(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
}
function closesLine(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  const hh = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  return 'Answers close ' + (/^23:/.test(hh) ? 'at the end of ' + longDay(iso) : longDay(iso) + ' at ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(/\.$/, '')) + '.';
}
function forWhom(a: Ann): string {
  if (a.audience === 'everyone') return 'everyone on the team';
  if (a.audience === 'leaders') return 'the leaders';
  const ts = (a.teams || []).filter(Boolean);
  if (ts.length === 1) return ts[0] === 'board' || ts[0] === 'exec' ? TEAM_LABEL[ts[0]] : 'the ' + (TEAM_LABEL[ts[0]] || ts[0]) + ' team';
  const ls = ts.map(t => TEAM_LABEL[t] || t);
  return ls.length ? ls.slice(0, -1).join(', ') + ' and ' + ls[ls.length - 1] : 'your team';
}
async function siteUrl(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return String((data && data.value) || SITE).replace(/\/+$/, '');
}
function extLink(l: string | null, site: string): string | null {
  const t = String(l || '').trim();
  if (/^#[A-Za-z0-9/_-]*$/.test(t)) return site + '/' + t;
  if (/^https?:\/\/[^\s"<>]+$/i.test(t)) return t;
  return null;
}
function paras(s: string | null): string[] { return String(s || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean); }

type AnnMail = { subject: string; text: string; html: string };
function emailParts(a: Ann, poster: string, first: string, site: string): AnnMail {
  const ask = a.ask || null;
  const kind = ask ? (ask.type === 'poll' ? 'poll' : 'form') : 'news';
  const pf = firstOf(poster) || poster;
  const title = clip(oneLine(a.title), 200);
  const subject = clip((kind === 'poll' ? 'Poll: ' : kind === 'form' ? 'Short form: ' : '') + oneLine(a.title), 160);
  const url = site + '/#announce/' + a.id;
  const cta = kind === 'poll' ? 'Answer the poll' : kind === 'form' ? 'Answer the form' : 'Open it in the Hub';
  const over = (kind === 'poll' ? 'A poll from ' : kind === 'form' ? 'A short form from ' : 'An announcement from ') + pf;
  const meta = 'From ' + poster + ', for ' + forWhom(a);
  const closes = ask ? closesLine(a.closes_at) : '';
  const privacy = ask ? (a.anonymous ? 'Anonymous: ' + pf + ' sees the totals, not who answered what.' : pf + ' sees your name with your answer' + (kind === 'form' ? 's' : '') + '.') : '';
  const more = extLink(a.link, site);
  const body = paras(a.body);
  let askTitle = '', askNote = '', items: string[] = [];
  if (ask && kind === 'poll') {
    askTitle = clip(oneLine(ask.question), 300);
    askNote = ask.multi ? 'Pick one or more' : 'Pick one';
    items = (Array.isArray(ask.options) ? ask.options as unknown[] : []).map(o => clip(oneLine(o), 120)).filter(Boolean);
  } else if (ask && kind === 'form') {
    const qs = Array.isArray(ask.questions) ? ask.questions as Array<Record<string, unknown>> : [];
    askTitle = 'A short form, ' + qs.length + ' question' + (qs.length === 1 ? '' : 's');
    askNote = qs.some(q => q && q.required) ? 'The ones marked * need an answer' : '';
    items = qs.map(q => clip(oneLine(q && q.label), 200) + (q && q.required ? ' *' : '')).filter(x => x.trim());
  }
  const pre = clip(body[0] || askTitle || title, 110) + (closes ? ' ' + closes : '');

  /* the plain version */
  const t: string[] = [];
  t.push('Hi ' + (first || 'there') + ',', '', title, meta, '');
  for (const p of body) t.push(p, '');
  if (askTitle) {
    t.push((kind === 'poll' ? 'Poll: ' : '') + askTitle + (askNote ? ' (' + askNote.toLowerCase() + ')' : ''));
    items.forEach((x, i) => t.push((kind === 'form' ? (i + 1) + '. ' : '- ') + x));
    t.push('');
  }
  if (closes) t.push(closes);
  if (privacy) t.push(privacy);
  if (closes || privacy) t.push('');
  t.push(cta + ': ' + url);
  if (more) t.push('More: ' + more);
  t.push('', '--', 'Sent by the Hub on behalf of ' + pf + '. Reply to this email and it goes to ' + pf + '.', site.replace(/^https?:\/\//, ''));
  const text = t.join('\n');

  /* the branded version */
  const P = 'margin:0 0 16px;font-family:' + BODYF + ';font-size:16px;line-height:26px;color:' + INK + ';';
  const SMALL = 'margin:0 0 10px;font-family:' + BODYF + ';font-size:14px;line-height:21px;color:' + MUTED + ';';
  let inner = '<p style="' + P + '">Hi ' + sx(first || 'there') + ',</p>'
    + '<h1 style="margin:0 0 6px;font-family:' + HEAD + ';font-weight:600;font-size:32px;line-height:36px;color:' + GREEN + ';">' + sx(title) + '</h1>'
    + '<p style="margin:0 0 22px;font-family:' + BODYF + ';font-size:13px;line-height:20px;color:' + MUTED + ';">' + sx(meta) + '</p>'
    + body.map(p => '<p style="' + P + '">' + sx(p).replace(/\n/g, '<br>') + '</p>').join('');
  if (askTitle) {
    inner += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;background-color:#ffffff;border:1px solid rgba(16,63,57,.14);border-radius:8px;"><tr><td style="padding:18px 22px 10px;">'
      + '<div style="font-family:' + BODYF + ';font-weight:700;font-size:16px;line-height:24px;color:' + GREEN + ';">' + sx(askTitle) + '</div>'
      + (askNote ? '<div style="font-family:' + BODYF + ';font-size:13px;line-height:20px;color:' + MUTED + ';margin:2px 0 8px;">' + sx(askNote) + '</div>' : '')
      + (items.length ? '<' + (kind === 'form' ? 'ol' : 'ul') + ' style="margin:6px 0 10px 20px;padding:0;">' + items.map(x => '<li style="margin:0 0 6px;font-family:' + BODYF + ';font-size:15px;line-height:22px;color:' + INK + ';">' + sx(x) + '</li>').join('') + '</' + (kind === 'form' ? 'ol' : 'ul') + '>' : '')
      + '</td></tr></table>';
  }
  if (closes) inner += '<p style="margin:0 0 6px;font-family:' + BODYF + ';font-size:15px;line-height:22px;font-weight:700;color:' + GREEN + ';">' + sx(closes) + '</p>';
  if (privacy) inner += '<p style="' + SMALL + '">' + sx(privacy) + '</p>';
  inner += '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 22px;"><tr><td style="background-color:' + GOLD + ';border-radius:6px;">'
    + '<a href="' + ea(url) + '" style="display:inline-block;padding:13px 26px;font-family:' + HEAD + ';font-weight:600;font-size:18px;letter-spacing:1px;text-transform:uppercase;color:' + GREEN + ';text-decoration:none;">' + sx(cta) + '</a></td></tr></table>';
  if (more) inner += '<p style="' + SMALL + '">More: <a href="' + ea(more) + '" style="color:' + GREEN + ';text-decoration:underline;">' + sx(clip(more.replace(/^https?:\/\//, ''), 80)) + '</a></p>';
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + sx(subject) + '</title>'
    + '<style>body{margin:0;padding:0;background:' + CREAM + ';}table{border-collapse:collapse;}@media only screen and (max-width:620px){.wa-wrap{width:100% !important;}.wa-pad{padding-left:20px !important;padding-right:20px !important;}}</style></head>'
    + '<body style="margin:0;padding:0;background-color:' + CREAM + ';">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + CREAM + ';font-size:1px;line-height:1px;">' + sx(pre) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + CREAM + ';"><tr><td align="center" style="padding:24px 12px;">'
    + '<table role="presentation" class="wa-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">'
    + '<tr><td class="wa-pad" style="background-color:' + GREEN + ';border-radius:8px 8px 0 0;padding:24px 36px 20px 36px;">'
    + '<img src="' + LOGO_CREAM + '" width="150" alt="Welfare Avenue" style="display:block;border:0;width:150px;height:auto;">'
    + '<div style="padding:18px 0 0;font-family:' + BODYF + ';font-weight:700;font-size:11px;line-height:14px;letter-spacing:2px;color:' + GOLD + ';text-transform:uppercase;">' + sx(over) + '</div></td></tr>'
    + '<tr><td class="wa-pad" style="background-color:' + CREAM + ';padding:30px 36px 10px 36px;border-left:1px solid rgba(16,63,57,.12);border-right:1px solid rgba(16,63,57,.12);">' + inner + '</td></tr>'
    + '<tr><td class="wa-pad" style="background-color:' + GREEN + ';border-radius:0 0 8px 8px;padding:20px 36px 22px 36px;">'
    + '<div style="font-family:' + BODYF + ';font-size:13px;line-height:20px;color:' + CREAM + ';">Sent by the Hub on behalf of ' + sx(pf) + '. Reply to this email and it goes to ' + sx(pf) + '.</div>'
    + '<div style="padding-top:8px;font-family:' + BODYF + ';font-size:13px;line-height:20px;"><a href="' + ea(site) + '" style="color:' + CREAM + ';text-decoration:underline;">' + sx(site.replace(/^https?:\/\//, '')) + '</a></div>'
    + '</td></tr></table></td></tr></table></body></html>';
  return { subject, text, html };
}
function mimeOf(from: string, to: string, replyTo: string | null, m: AnnMail): string {
  const boundary = 'wa180' + crypto.randomUUID().replace(/-/g, '');
  return [
    'From: ' + from,
    'To: ' + to,
    ...(replyTo ? ['Reply-To: ' + replyTo] : []),
    'Subject: ' + mimeWord(m.subject),
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
    'X-Auto-Response-Suppress: OOF, AutoReply',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64lines(m.text),
    '--' + boundary,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64lines(m.html),
    '--' + boundary + '--',
    ''
  ].join('\r\n');
}
function pemToDer(pem: string): ArrayBuffer { const b = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(b); const out = new Uint8Array(new ArrayBuffer(raw.length)); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out.buffer; }
let GTOK: { t: string; exp: number } | null = null;
/* hub@'s own Gmail through the service account (domain-wide delegation, gmail.send), as hub-invite sends the invitations */
async function gmailToken(): Promise<string> {
  if (GTOK && GTOK.exp > Date.now() + 60000) return GTOK.t;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: HUB_MAIL, scope: 'https://www.googleapis.com/auth/gmail.send', aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claims + '.' + b64url(sig) }) });
  const b = await res.json();
  if (!b.access_token) throw new Error('Google refused hub@ sending: ' + String(b.error_description || b.error || res.status).slice(0, 160));
  GTOK = { t: String(b.access_token), exp: Date.now() + 3500 * 1000 };
  return GTOK.t;
}
async function gmailSend(mime: string): Promise<{ ok: boolean; error?: string }> {
  const raw = b64url(new TextEncoder().encode(mime));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: 'Bearer ' + (await gmailToken()), 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
    const txt = await res.text();
    if (res.ok) return { ok: true };
    const busy = res.status === 429 || res.status >= 500 || (res.status === 403 && /rate ?limit/i.test(txt));
    if (busy && attempt < 2) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
    return { ok: false, error: 'Gmail answered ' + res.status + ': ' + txt.replace(/\s+/g, ' ').slice(0, 160) };
  }
  return { ok: false, error: 'Gmail was busy' };
}
async function emailPart(a: Ann, poster: string, dry: boolean): Promise<Record<string, unknown>> {
  const site = await siteUrl();
  const { data, error } = await svc.rpc('wa180_audience', { p_audience: a.audience, p_teams: a.teams || [] });
  if (error) throw new Error('who it is for: ' + error.message);
  const by = String(a.created_by || '').toLowerCase().trim();
  const reply = await posterEmail(a);   /* replies go to the poster's Welfare Avenue address */
  const seen = new Set<string>(), to: Array<{ email: string; name: string }> = [];
  let notWa = 0, poster_left_out = 0;
  for (const p of ((data || []) as Array<{ email: string; name: string | null }>)) {
    const e = String(p.email || '').toLowerCase().trim();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    if (e === by || (!!reply && e === reply) || oneLine(p.name).toLowerCase() === poster.toLowerCase()) { poster_left_out++; continue; }
    if (!e.endsWith(WA_DOMAIN)) { notWa++; continue; }
    to.push({ email: e, name: oneLine(p.name) });
  }
  const from = mailbox(poster + ' via the Hub', HUB_MAIL);
  if (dry) {
    const m = emailParts(a, poster, firstOf(to[0] && to[0].name) || 'there', site);
    let can_send: boolean | string = true;   /* Google gives hub@ a sending token (nothing is sent) */
    try { await gmailToken(); } catch (e) { can_send = String((e as Error).message || e).slice(0, 200); }
    return { to_count: to.length, to_names: to.map(p => p.name), not_wa: notWa, poster_left_out, from: poster + ' via the Hub <' + HUB_MAIL + '>', reply_to: reply, can_send, subject: m.subject, text: m.text, html: m.html };
  }
  /* claim it first, so two runs never both send */
  const claim = await svc.from('hub_announcements').update({ emailed: { state: 'sending', to_count: to.length, started: new Date().toISOString() } }).eq('id', a.id).is('emailed', null).select('id');
  if (claim.error || !claim.data || !claim.data.length) return { skipped: 'already emailed' };
  const done = async (rec: Record<string, unknown>, line: string) => {
    const full = { ...rec, not_wa: notWa, at: new Date().toISOString() };
    await svc.from('hub_announcements').update({ emailed: full }).eq('id', a.id);
    await log('announcement', String(a.id), 'email', line);
    return full;
  };
  const s = await settings();
  const cap = s.announce_email_daily;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await svc.from('hub_announcements').select('id, emailed').eq('created_by', a.created_by || '').neq('id', a.id).gte('created_at', since);
  const today = ((recent || []) as Array<{ emailed: Record<string, unknown> | null }>).filter(r => r.emailed && Number(r.emailed.sent || 0) > 0).length;
  if (today >= cap) return await done({ state: 'skipped', skipped: 'the daily limit: ' + cap + ' emailed announcements a day from one person', sent: 0, to_count: to.length, failed: [] }, 'not emailed: the daily limit (' + cap + ')');
  if (!to.length) return await done({ state: 'skipped', skipped: 'nobody to email', sent: 0, to_count: 0, failed: [] }, 'not emailed: nobody to email');
  try { await gmailToken(); } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 200);
    return await done({ state: 'failed', sent: 0, to_count: to.length, failed: to.map(p => p.name), error: msg }, 'not emailed: ' + msg);
  }
  let sent = 0, next = 0, firstErr = '';
  const failed: string[] = [];
  const worker = async () => {
    while (next < to.length) {
      const p = to[next++];
      try {
        const r = await gmailSend(mimeOf(from, mailbox(p.name, p.email), reply, emailParts(a, poster, firstOf(p.name), site)));
        if (r.ok) sent++; else { failed.push(p.name || 'someone'); if (!firstErr) firstErr = r.error || ''; }
      } catch (e) { failed.push(p.name || 'someone'); if (!firstErr) firstErr = String((e as Error).message || e).slice(0, 160); }
    }
  };
  await Promise.all([worker(), worker()]);
  failed.sort();
  return await done({ state: failed.length ? (sent ? 'partly sent' : 'failed') : 'sent', sent, to_count: to.length, failed, ...(firstErr ? { error: firstErr } : {}) },
    'emailed ' + sent + ' of ' + to.length + (failed.length ? ' | not sent to ' + failed.length + ': ' + firstErr : ''));
}

async function announcement(id: number, dry = false, draft: Ann | null = null): Promise<Record<string, unknown>> {
  let a: Ann | null = draft;
  if (!a) { const { data } = await svc.from('hub_announcements').select(ANN_COLS).eq('id', id).maybeSingle(); a = data as Ann | null; }
  if (!a) return { error: 'announcement not found' };
  const name = await posterName(a);
  if (dry) {
    let slackOut: Record<string, unknown>, emailOut: Record<string, unknown>;
    try { slackOut = await slackPart(a, name, true); } catch (e) { slackOut = { error: String((e as Error).message || e).slice(0, 200) }; }
    try { emailOut = await emailPart(a, name, true); } catch (e) { emailOut = { error: String((e as Error).message || e).slice(0, 200) }; }
    return { dry: true, poster: name, slack: slackOut, email: emailOut };
  }
  const out: Record<string, unknown> = { ok: true };
  if (!a.post_slack) out.slack = { skipped: 'not for Slack' };
  else if (a.slack && (a.slack as Record<string, unknown>).at) out.slack = { skipped: 'already posted' };
  else { try { out.slack = await slackPart(a, name, false); } catch (e) { out.slack = { error: String((e as Error).message || e).slice(0, 200) }; await log('announcement', String(a.id), 'slack', 'error: ' + String((e as Error).message || e)); } }
  if (!a.post_email) out.email = { skipped: 'not by email' };
  else if (a.emailed) out.email = { skipped: 'already emailed' };
  else {
    try { out.email = await emailPart(a, name, false); }
    catch (e) {
      const msg = String((e as Error).message || e).slice(0, 200);
      out.email = { error: msg };
      await svc.from('hub_announcements').update({ emailed: { state: 'failed', sent: 0, error: msg, at: new Date().toISOString() } }).eq('id', a.id);
      await log('announcement', String(a.id), 'email', 'error: ' + msg);
    }
  }
  return out;
}
/* a draft from the post form, for a dry run (nothing is written or sent) */
function draftAnn(d: Record<string, unknown>, me: { email: string; name: string }): Ann {
  const teams = Array.isArray(d.teams) ? (d.teams as unknown[]).map(String).filter(t => !!TEAM_LABEL[t]) : [];
  return { id: 0, title: String(d.title || 'A headline'), body: d.body ? String(d.body) : null, audience: ['everyone', 'leaders', 'teams'].includes(String(d.audience)) ? String(d.audience) : 'everyone', teams,
    ask: d.ask && typeof d.ask === 'object' ? d.ask as Record<string, unknown> : null, closes_at: d.closes_at ? String(d.closes_at) : null, post_slack: true, slack: null, post_email: true, emailed: null,
    created_by: me.email, created_name: me.name, anonymous: !!d.anonymous, show_results: d.show_results !== false, link: d.link ? String(d.link) : null };
}

async function work(event: string, b: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (event === 'announcement') return announcement(Number(b.id));
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
    if (action === 'announce_dry') {   /* v1.4, v1.5: where an announcement would be posted, who it would be emailed to, and the words; nothing is sent */
      if (!leader) return json({ error: 'leaders and admins only' }, 403);
      if (body.draft && typeof body.draft === 'object') return json(await announcement(0, true, draftAnn(body.draft as Record<string, unknown>, me)));
      return json(await announcement(Number(body.id), true));
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
