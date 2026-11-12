// Welfare Avenue: slack-command (v2b, 12/11/26, wave323): Ask the Hub, in Slack.
// Steel (12/11/26): "Ask the Hub in Slack: DM @wa_hub or /hub, answers and confirm buttons in Slack. Goes where people already
// are. I really want this ready to use."
//
// One address for everything the WA HUB app sends us. Slack signs each request with the app's signing secret (HMAC v0), not a
// Supabase sign-in, so this function is deployed with verify_jwt=false and refuses anything whose signature does not check out,
// is older than five minutes, or comes from a workspace other than the bot's own. Until SLACK_SIGNING_SECRET is in the Vault, nothing is answered.
//
//   A direct message to WA HUB      -> the answer in that conversation (Events API, message.im)
//   /hub <a question or an ask>      -> the answer, shown only to the person who typed it
//   /hub tasks | project <name> | idea <a change to the Hub> | help   -> at once, no model call
//   (v1's "/hub request" filed a change to the Hub; "request ..." now goes to Ask the Hub, which drafts a team request)
//   Confirm, do it / Cancel          -> the buttons under a card (interactivity)
//   A new chat in Slack's side panel -> four ways to start, when the app has that panel (assistant_thread_started)
//
// wave324 (v2c): the new actions (a Slack message from WA HUB, task changes, subtasks, access) arrive as cards like the others; a
// Slack message's card keeps only who it is for once decided.
// WHO: the Slack account is matched to an active roster person by email (wa_slack_ids, else the email on their Slack profile),
// and that email must be a Welfare Avenue account, the rule Ask the Hub has in the Hub. Nobody else gets an answer from any
// command here, /hub project included, and names are never guessed from a display name. The question then goes to the ask
// function as that person, over the trusted path (x-wa-secret + x-wa-as): the same context, the same four confidentiality
// layers and the same voice as Ask the Hub in the Hub.
// PRIVATE: an answer goes to a direct message or is ephemeral, never into a channel. A mention in a channel gets a private
// note that says to ask in a direct message.
// CONFIRM FIRST: an action (a task, a request) arrives as a card with two buttons and is saved only when the person who asked
// presses Confirm. The card's content waits in slack_ask_pending for 24 hours at most and is wiped once decided.
// NOTHING KEPT: no question or answer is stored by the Hub. slack_ask_log holds one line per question (who, when, which
// door) for the daily limit of 25 a person, and one per Slack event so a repeat delivery is answered once. Follow-up
// questions read the last few messages of the conversation from Slack itself.
// SAFETY, as in v1: tasks marked confidential, board-only or restricted are never shown in Slack.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SLACK_API = (Deno.env.get('SLACK_API_BASE') || 'https://slack.com/api').replace(/\/+$/, '');
const SITE = 'https://hub.welfareavenue.com/';
const DAILY_CAP = 25;
const CARD_HOURS = 24;
const DEPT_LABEL = {
  opsmtl: 'Operations Montreal',
  progdev: 'Program Development',
  opsto: 'Operations Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising',
  finance: 'Finance',
  hr: 'Human Resources',
  board: 'Board'
};
const LOOKING = 'Looking into it...';
const NOT_LINKED = 'I could not match your Slack account to the Hub\'s team list yet. Open <' + SITE + '|the Hub> once with your Welfare Avenue account, or ask an admin to link your Slack account, then try me again.';
const NO_ACCOUNT = 'Ask the Hub in Slack works with a Welfare Avenue account, and I could not find one linked to this Slack account. <' + SITE + '|The Hub> is the place for now, and an admin can help with the rest.';
const CAP_TEXT = 'That is ' + DAILY_CAP + ' questions from Slack in a day, which is the limit for now. <' + SITE + '|The Hub> is always open, and I will be back here tomorrow.';
const WORDS_ONLY = 'I can read words only for now. Type your question and I will take it from there.';
const TROUBLE = 'I could not get to that just now. Try again in a minute, or ask in <' + SITE + '|the Hub>.';

const ok200 = (body, type)=>new Response(body == null ? '' : body, { status: 200, headers: type ? { 'Content-Type': type } : {} });
const jsonOut = (obj)=>ok200(JSON.stringify(obj), 'application/json');
const eph = (text)=>jsonOut({ response_type: 'ephemeral', text });

/* ---------- secrets, kept a few minutes so one conversation does not read the Vault ten times ---------- */
const SECRETS = {};
async function getSecret(name) {
  const hit = SECRETS[name];
  if (hit && Date.now() - hit.at < 300000) return hit.v;
  let v = null;
  try { const { data } = await svc.rpc('get_secret', { secret_name: name }); v = data || null; } catch (_) { v = null; }
  if (v) SECRETS[name] = { v, at: Date.now() };
  return v;
}

/* ---------- is this really Slack? ---------- */
async function verifySlack(req, raw) {
  const secret = String(await getSecret('SLACK_SIGNING_SECRET') || '').trim();
  if (!secret) return false;
  const ts = req.headers.get('x-slack-request-timestamp') || '';
  const sig = req.headers.get('x-slack-signature') || '';
  if (!/^\d{9,12}$/.test(ts) || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('v0:' + ts + ':' + raw));
  const hex = 'v0=' + [...new Uint8Array(mac)].map((b)=>b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/* ---------- Slack's API ---------- */
async function slack(method, payload) {
  const token = await getSecret('SLACK_BOT_TOKEN');
  if (!token) return { ok: false, error: 'no_bot_token' };
  try {
    let res;
    if (method.indexOf('chat.') === 0 || method.indexOf('assistant.') === 0 || method === 'auth.test') {
      res = await fetch(SLACK_API + '/' + method, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
    } else {
      const qs = new URLSearchParams();
      Object.keys(payload || {}).forEach((k)=>{ const v = payload[k]; if (v !== undefined && v !== null) qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
      res = await fetch(SLACK_API + '/' + method + '?' + qs.toString(), { headers: { 'Authorization': 'Bearer ' + token } });
    }
    return await res.json();
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) };
  }
}
/* the workspace this bot belongs to, asked once: a signed request from any other workspace is refused */
let BOT_TEAM = '';
async function ourTeam(teamId) {
  if (!teamId) return true;
  if (!BOT_TEAM) { const r = await slack('auth.test', {}); if (r && r.ok && r.team_id) BOT_TEAM = String(r.team_id); }
  return !BOT_TEAM || BOT_TEAM === String(teamId);
}
async function respond(url, payload) {
  if (!url || !/^https:\/\/hooks\.slack\.com\//.test(url) && SLACK_API.indexOf('https://slack.com') === 0) return { ok: false };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
    return { ok: res.ok };
  } catch (_) { return { ok: false }; }
}

/* ---------- who is this? Only an active roster person, matched by email ---------- */
function low(s) { return String(s || '').trim().toLowerCase(); }
async function roster() {
  const { data } = await svc.from('team_members').select('id, name, email, department, active').eq('active', true);
  return (data || []).filter((r)=>r.active === true && r.name && r.email);
}
async function memberFor(slackUserId) {
  if (!slackUserId) return null;
  let emails = [];
  try {
    const { data: ids } = await svc.from('wa_slack_ids').select('email').eq('slack_id', slackUserId);
    emails = (ids || []).map((r)=>low(r.email)).filter(Boolean);
  } catch (_) { emails = []; }
  if (!emails.length) {
    /* not in the Hub's list yet: the email on their own Slack profile (users:read.email) */
    const info = await slack('users.info', { user: slackUserId });
    const u = info && info.ok ? info.user : null;
    if (u && !u.deleted && !u.is_bot && u.profile && u.profile.email) emails = [low(u.profile.email)];
  }
  if (!emails.length) return null;
  const m = (await roster()).find((r)=>emails.indexOf(low(r.email)) >= 0);
  /* ok: a Welfare Avenue account, the rule Ask the Hub has in the Hub. Without it nothing here answers. */
  return m ? { id: m.id, name: String(m.name).trim(), email: low(m.email), department: m.department || '', ok: /@welfareavenue\.com$/.test(low(m.email)) } : null;
}
/* why this person gets no answer ('' when they do) */
function refusal(m) { return !m ? NOT_LINKED : m.ok !== true ? NO_ACCOUNT : ''; }
function firstName(m) { return String(m.name || '').trim().split(/\s+/)[0] || 'there'; }

/* ---------- text in and out ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/* what a person typed in Slack, as plain words: links to their label, mentions out, entities back */
function cleanText(t) {
  return String(t || '')
    .replace(/<@[A-Z0-9]+(\|[^>]*)?>/g, ' ')
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, '#$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/<mailto:([^|>]+)(\|[^>]*)?>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim().slice(0, 1000);
}
/* the Hub's Markdown answer, as Slack writes it: links, bold, bullets, and the Hub's own pages as full addresses */
function toMrkdwn(md) {
  const links = [];
  let t = String(md || '').replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,600})\)/g, (_m, label, url)=>{
    let u = String(url).trim();
    if (u.charAt(0) === '#') u = SITE + u;
    else if (!/^https?:\/\//i.test(u) && !/^mailto:/i.test(u)) return label;
    links.push('<' + u.replace(/[<>|]/g, '').replace(/&/g, '&amp;') + '|' + esc(label).replace(/\|/g, '/') + '>');
    return '\u0001' + (links.length - 1) + '\u0001';
  });
  t = esc(t);
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '*$1*');
  t = t.replace(/^[ \t]*#{1,4}[ \t]+(.+)$/gm, '*$1*');
  t = t.replace(/^([ \t]*)[-*][ \t]+/gm, '$1\u2022 ');
  t = t.replace(/\u0001(\d+)\u0001/g, (_m, i)=>links[Number(i)]);
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
function chunks(text, max) {
  const out = []; let cur = '';
  String(text || '').split('\n\n').forEach((para)=>{
    let p = para;
    while (p.length > max) { if (cur) { out.push(cur); cur = ''; } out.push(p.slice(0, max)); p = p.slice(max); }
    if ((cur ? cur.length + 2 : 0) + p.length > max) { out.push(cur); cur = p; } else cur = cur ? cur + '\n\n' + p : p;
  });
  if (cur) out.push(cur);
  return out;
}
function answerBlocks(mk, sources) {
  const blocks = chunks(mk, 2800).slice(0, 8).map((c)=>({ type: 'section', text: { type: 'mrkdwn', text: c } }));
  const src = (sources || []).filter(Boolean).slice(0, 6);
  if (src.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: esc('Sources: ' + src.join('; ')).slice(0, 1900) }] });
  return blocks;
}
/* the same lines the Hub's own card shows (wa38FieldLines) */
function fieldLines(p) {
  const i = p.input || {}; const lines = [];
  if (p.name === 'create_request') {
    lines.push('To: ' + (DEPT_LABEL[i.department] || i.department));
    if (i.type_key) lines.push('Type: ' + i.type_key);
    if (i.assignee) lines.push('For: ' + i.assignee);
    if (i.details) lines.push(String(i.details));
  } else if (p.name === 'create_task') {
    lines.push('Board: ' + (DEPT_LABEL[i.department] || i.department));
    if (i.owner) lines.push('Owner: ' + i.owner);
    if (i.due_date) lines.push('Due: ' + i.due_date);
    if (i.detail) lines.push(String(i.detail));
  } else if (p.name === 'set_request_status') {
    lines.push('New status: ' + i.status);
  } else if (p.name === 'close_task' && i.note) {
    lines.push('Note: ' + i.note);
  }
  return lines.join('\n').slice(0, 1500);
}
function cardBlocks(p, id) {
  const lines = fieldLines(p);
  return [
    { type: 'section', text: { type: 'mrkdwn', text: '*' + esc(p.summary || p.name) + '*' + (lines ? '\n' + esc(lines) : '') } },
    { type: 'actions', block_id: 'hubcard', elements: [
      { type: 'button', action_id: 'hub_confirm', style: 'primary', text: { type: 'plain_text', text: 'Confirm, do it' }, value: String(id) },
      { type: 'button', action_id: 'hub_cancel', text: { type: 'plain_text', text: 'Cancel' }, value: String(id) }
    ] },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Nothing is saved until you confirm.' }] }
  ];
}
function helpText(m) {
  return 'Hi ' + esc(firstName(m)) + ' :wa-heart-gold: You can ask me anything about our work, right here.\n'
    + '\u2022 *Ask*: "What should I focus on this week?" or "Which of my tasks are overdue?"\n'
    + '\u2022 *Do*: "Put in a request to Marketing for a poster for Sunday" or "Add a task for me: call the caterer". You get a card first, and nothing is saved until you confirm.\n'
    + '\u2022 *tasks*: your open tasks, at once\n'
    + '\u2022 `/hub` and your question works from any channel, and only you see the answer\n'
    + '\u2022 `/hub project <name>`: a project snapshot. `/hub idea <your idea>`: suggest a change to the Hub itself\n'
    + 'Everything else lives in <' + SITE + '|the Hub>.';
}

/* ---------- the instant commands (no model call) ---------- */
function visible(t) {
  if (t.confidential === true || t.board_only === true) return false;
  if (t.visibility && t.visibility !== 'department' && t.visibility !== 'open' && t.visibility !== 'all') return false;
  return true;
}
function norm(s) { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }
function ownerHas(owner, first) {
  if (!first) return false;
  return (' ' + String(owner || '').toLowerCase().replace(/[^a-z0-9\u00c0-\u024f-]+/g, ' ') + ' ').indexOf(' ' + first + ' ') >= 0;
}
function todayToronto() {
  try { const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; } catch (_) { /* below */ }
  return new Date().toISOString().slice(0, 10);
}
async function cmdTasks(m) {
  const first = String(m.name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z\u00c0-\u024f-]/g, '');
  const [{ data }, { data: links }] = await Promise.all([
    svc.from('dept_tasks').select('id, title, department, owner, due_date, flag, done, confidential, board_only, visibility, banked_at, owner_unsure').is('banked_at', null).eq('done', false).limit(1000),
    svc.from('task_assignees').select('task_id').eq('member_id', m.id)
  ]);
  const assigned = new Set((links || []).map((l)=>Number(l.task_id)));
  const mine = (data || []).filter((t)=>t.done !== true && !t.banked_at && t.department !== 'board' && visible(t))
    .filter((t)=>(assigned.has(Number(t.id)) && t.owner_unsure !== true) || ownerHas(t.owner, first));
  if (!mine.length) return 'Nothing open under your name, ' + esc(firstName(m)) + '. Enjoy it :wa-heart-gold: Full picture: <' + SITE + '#mypage|your Home page>.';
  const today = todayToronto();
  mine.sort((a, b)=>(a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
  const lines = mine.slice(0, 12).map((t)=>{
    let s = '\u2022 ' + esc(t.title);
    if (t.due_date) s += t.due_date < today ? ' (was due ' + t.due_date + ')' : t.due_date === today ? ' (due today)' : ' (due ' + t.due_date + ')';
    if (t.flag) s += ' :triangular_flag_on_post:';
    s += '  _' + esc(DEPT_LABEL[t.department || ''] || t.department || '') + '_';
    return s;
  });
  let out = '*Your open tasks (' + mine.length + ')*\n' + lines.join('\n');
  out += mine.length > 12 ? '\n_...and ' + (mine.length - 12) + ' more on <' + SITE + '#mypage|your Home page>._' : '\n<' + SITE + '#mypage|Open your Home page>';
  return out;
}
async function cmdProject(query) {
  if (!query) return 'Tell me which project: `/hub project community kitchen`';
  const { data: ps } = await svc.from('projects').select('id, name, department, status').is('banked_at', null).neq('status', 'archived');
  const q = norm(query);
  const matches = (ps || []).filter((p)=>norm(p.name).indexOf(q) >= 0);
  if (!matches.length) return 'No project matches "' + esc(query) + '". The full list lives at <' + SITE + '#projects|Projects>.';
  if (matches.length > 3) return 'That matches ' + matches.length + ' projects: ' + esc(matches.slice(0, 6).map((p)=>p.name).join(', ')) + '. Narrow it down?';
  const parts = [];
  for (const p of matches) {
    const { data } = await svc.from('dept_tasks').select('id, title, department, owner, due_date, flag, done, confidential, board_only, visibility, project_id').is('banked_at', null).eq('project_id', p.id);
    const ts = (data || []).filter(visible);
    const open = ts.filter((t)=>!t.done);
    const flagged = open.filter((t)=>t.flag).length;
    const owners = [...new Set(open.map((t)=>(t.owner || '').trim()).filter(Boolean))];
    const depts = [...new Set(open.map((t)=>t.department).filter(Boolean))];
    let s = '*<' + SITE + '#project/' + p.id + '|' + esc(p.name) + '>*  _' + esc(DEPT_LABEL[p.department] || p.department) + '_\n';
    s += open.length + ' open task' + (open.length === 1 ? '' : 's') + (flagged ? ' (' + flagged + ' flagged)' : '') + (owners.length ? ' \u00b7 ' + owners.length + ' people' : '') + (depts.length > 1 ? ' \u00b7 teams: ' + esc(depts.map((d)=>DEPT_LABEL[d] || d).join(', ')) : '');
    if (open.length) {
      const soon = open.filter((t)=>t.due_date).sort((a, b)=>a.due_date < b.due_date ? -1 : 1).slice(0, 3);
      if (soon.length) s += '\nNext due: ' + esc(soon.map((t)=>t.title + ' (' + t.due_date + (t.owner ? ', ' + t.owner : '') + ')').join('; '));
    }
    parts.push(s);
  }
  return parts.join('\n\n');
}
async function cmdIdea(m, userName, text) {
  if (!text || text.length < 8) return 'Describe the change: `/hub idea add a print button to the finance page`';
  const who = (m && m.name) || userName || 'someone via Slack';
  const { data, error } = await svc.from('wa_change_requests').insert({ request: text.slice(0, 1500), requested_by: who + ' (via /hub)', status: 'new' }).select('id').maybeSingle();
  if (error) return 'Could not file that: ' + esc(error.message);
  /* the ping to the team goes out after Slack has its answer (three seconds is all Slack waits) */
  const ping = later(async ()=>{
    const secret = await getSecret('WA_TRIGGER_SECRET');
    if (secret) await fetch(SUPABASE_URL + '/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': String(secret) }, body: JSON.stringify({ event: 'change_request', request_id: data && data.id }) });
  });
  if (ping) await ping;
  return ':memo: Filed. Your idea is tracked in the Hub\'s admin panel (Change the Hub), and the team got a ping. Reference #' + ((data && data.id) || '?') + '.';
}

/* ---------- the daily limit, and one answer per Slack event ---------- */
async function seenBefore(eventId, slackUser) {
  if (!eventId) return false;
  const { error } = await svc.from('slack_ask_log').insert({ event_id: String(eventId).slice(0, 80), slack_user: slackUser || null, kind: 'seen' });
  return !!(error && (error.code === '23505' || /duplicate/i.test(error.message || '')));
}
async function overCap(m) {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await svc.from('slack_ask_log').select('id', { count: 'exact', head: true }).eq('email', m.email).in('kind', ['dm', 'slash']).gte('at', since);
    return (count || 0) >= DAILY_CAP;
  } catch (_) { return false; }
}
/* now and then, clear out what is no longer needed: event lines after 35 days, decided or forgotten cards after 7 */
async function tidy() {
  try {
    await svc.from('slack_ask_log').delete().lt('at', new Date(Date.now() - 35 * 86400000).toISOString());
    await svc.from('slack_ask_pending').delete().lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
  } catch (_) { /* next time */ }
}
async function logUse(m, slackUser, kind) {
  try { await svc.from('slack_ask_log').insert({ email: m.email, slack_user: slackUser || null, kind }); } catch (_) { /* the answer matters more than the count */ }
}

/* ---------- the ask function, as this person ---------- */
async function hub(member, body) {
  const secret = await getSecret('WA_TRIGGER_SECRET');
  if (!secret) return { error: 'not_ready' };
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SERVICE_KEY, 'apikey': SERVICE_KEY, 'x-wa-secret': String(secret), 'x-wa-as': member.email, 'x-wa-via': 'slack' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return { error: 'ask ' + res.status };
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 120) }; }
}
/* the last few turns of this conversation, read from Slack itself (nothing is kept by the Hub) */
async function dmHistory(channel, thread, beforeTs) {
  try {
    const from = (Number(beforeTs) - 30 * 60).toFixed(6);
    const r = thread ? await slack('conversations.replies', { channel, ts: thread, oldest: from, latest: beforeTs, inclusive: false, limit: 40 }) : await slack('conversations.history', { channel, oldest: from, latest: beforeTs, inclusive: false, limit: 16 });
    if (!r || !r.ok || !Array.isArray(r.messages)) return [];
    let msgs = r.messages.slice();
    if (!thread) msgs.reverse();
    const cutoff = Number(beforeTs) - 30 * 60;
    const turns = [];
    msgs.forEach((x)=>{
      if (!x || !x.text || x.ts === beforeTs || Number(x.ts) >= Number(beforeTs) || Number(x.ts) < cutoff) return;
      if (x.subtype && x.subtype !== 'bot_message') return;
      const bot = !!x.bot_id;
      if (bot && (x.text === LOOKING || x.text.indexOf('To confirm: ') === 0)) return;
      turns.push({ role: bot ? 'assistant' : 'user', content: (bot ? String(x.text) : cleanText(x.text)).slice(0, 2000) });
    });
    return turns.slice(-6);
  } catch (_) { return []; }
}
/* an answer and its cards, sent through `send` (a direct message, or the slash command's private reply) */
async function deliver(out, member, slackUser, send) {
  if (!out || out.error || typeof out.answer !== 'string') { await send({ text: TROUBLE, first: true }); return; }
  const mk = toMrkdwn(out.answer) || 'I have nothing to add on that one.';
  await send({ text: mk.slice(0, 3000), blocks: answerBlocks(mk, out.confidential ? [] : out.sources), first: true });
  const props = Array.isArray(out.proposals) ? out.proposals.slice(0, 4) : [];
  for (const p of props) {
    if (!p || !p.name || p.name === 'bank_task') continue;
    /* wave324: a Slack message's words wait only in input, which is wiped once the card is decided; the kept summary names the person only */
    const keep = p.name === 'send_slack_message' ? 'Send ' + String((p.input && p.input.to) || 'someone') + ' a Slack message' : String(p.summary || p.name);
    const { data, error } = await svc.from('slack_ask_pending').insert({ slack_user: slackUser, email: member.email, name: String(p.name), input: p.input || {}, summary: keep.slice(0, 400) }).select('id').maybeSingle();
    if (error || !data) { await send({ text: 'I could not set up the card for "' + esc(String(p.summary || p.name).slice(0, 200)) + '". Ask me again, or do it in <' + SITE + '|the Hub>.' }); continue; }
    await send({ text: 'To confirm: ' + String(p.summary || p.name).slice(0, 300), blocks: cardBlocks(p, data.id) });
  }
}

/* ---------- a direct message ---------- */
async function handleDm(ev) {
  const channel = ev.channel, thread = ev.thread_ts || undefined;
  const post = (text, blocks)=>slack('chat.postMessage', { channel, thread_ts: thread, text, blocks, unfurl_links: false, unfurl_media: false });
  try {
    const text = cleanText(ev.text);
    const m = await memberFor(ev.user);
    const no = refusal(m);
    if (no) { await post(no); return; }
    const plain = text.toLowerCase().replace(/[?.!\s]+$/, '');
    if (!plain && ev.subtype === 'file_share') { await post(WORDS_ONLY); return; }
    if (!plain || ['help', 'hi', 'hello', 'hey', 'bonjour', 'salut', 'allo'].indexOf(plain) >= 0) { await post(helpText(m)); return; }
    if (plain === 'tasks' || plain === 'my tasks' || plain === 'mine') { await post(await cmdTasks(m)); return; }
    if (await overCap(m)) { await post(CAP_TEXT); return; }
    await logUse(m, ev.user, 'dm');
    const ph = await post(LOOKING);
    const history = await dmHistory(channel, ev.thread_ts, ev.ts);
    const out = await hub(m, { question: text, history });
    let used = false;
    await deliver(out, m, ev.user, async (msg)=>{
      if (msg.first && !used && ph && ph.ok && ph.ts) { used = true; const up = await slack('chat.update', { channel, ts: ph.ts, text: msg.text, blocks: msg.blocks || [] }); if (up && up.ok) return; }
      await post(msg.text, msg.blocks);
    });
    if (Math.random() < 0.04) await tidy();
  } catch (_) {
    try { await post(TROUBLE); } catch (_e) { /* nothing more to do */ }
  }
}
/* ---------- a new chat in Slack's side panel: four ways to start ---------- */
const STARTERS = [
  { title: 'What should I focus on this week?', message: 'What should I focus on this week?' },
  { title: 'Which of my tasks are overdue?', message: 'Which of my tasks are overdue?' },
  { title: 'What is waiting on me?', message: 'Which requests are waiting on me?' },
  { title: 'Add a task for me', message: 'Help me add a task for myself. Ask me what it is and when it is due.' }
];
async function handleThreadStart(t) {
  try {
    const m = await memberFor(t.user_id);
    if (refusal(m)) return;
    await slack('assistant.threads.setSuggestedPrompts', { channel_id: t.channel_id, thread_ts: t.thread_ts, title: 'A few ways to start, ' + firstName(m), prompts: STARTERS });
  } catch (_) { /* the chat works without them */ }
}
/* ---------- /hub with a question ---------- */
async function handleSlashAsk(userId, text, responseUrl) {
  const send = (payload)=>respond(responseUrl, Object.assign({ response_type: 'ephemeral' }, payload));
  try {
    const m = await memberFor(userId);
    const no = refusal(m);
    if (no) { await send({ replace_original: true, text: no }); return; }
    if (await overCap(m)) { await send({ replace_original: true, text: CAP_TEXT }); return; }
    await logUse(m, userId, 'slash');
    const out = await hub(m, { question: cleanText(text), history: [] });
    await deliver(out, m, userId, async (msg)=>{ await send({ replace_original: !!msg.first, text: msg.text, blocks: msg.blocks }); });
  } catch (_) {
    try { await send({ replace_original: true, text: TROUBLE }); } catch (_e) { /* nothing more to do */ }
  }
}
/* ---------- Confirm, do it / Cancel ---------- */
async function handleAction(payload) {
  const a = (payload.actions || [])[0];
  if (!a || (a.action_id !== 'hub_confirm' && a.action_id !== 'hub_cancel')) return;
  const url = payload.response_url, userId = payload.user && payload.user.id;
  const say = (text)=>respond(url, { replace_original: true, text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] });
  try {
    const { data: row } = await svc.from('slack_ask_pending').select('id, slack_user, email, name, input, summary, created_at, decided_at, outcome').eq('id', String(a.value || '')).maybeSingle();
    if (!row) { await say('This card is no longer here. Ask me again and I will set it up.'); return; }
    if (row.slack_user !== userId) { await respond(url, { response_type: 'ephemeral', replace_original: false, text: 'Only the person who asked can confirm this one.' }); return; }
    const title = '*' + esc(row.summary || row.name) + '*\n';
    if (row.decided_at) { await say(title + (row.outcome === 'done' ? 'Already done.' : row.outcome === 'cancelled' ? 'Already cancelled. Nothing was saved.' : 'This one was already handled.')); return; }
    if (Date.now() - Date.parse(row.created_at) > CARD_HOURS * 3600 * 1000) {
      await svc.from('slack_ask_pending').update({ decided_at: new Date().toISOString(), outcome: 'expired', input: null }).eq('id', row.id).is('decided_at', null);
      await say(title + 'This card is more than a day old, so I let it go. Ask me again and I will set it up fresh.');
      return;
    }
    const confirm = a.action_id === 'hub_confirm';
    /* one press wins: the row is claimed before anything runs */
    const { data: claimed } = await svc.from('slack_ask_pending').update({ decided_at: new Date().toISOString(), outcome: confirm ? 'confirming' : 'cancelled', input: confirm ? row.input : null }).eq('id', row.id).is('decided_at', null).select('id');
    if (!claimed || !claimed.length) { await say(title + 'This one was already handled.'); return; }
    if (!confirm) { await say(title + 'Cancelled. Nothing was saved.'); return; }
    const m = await memberFor(userId);
    if (!m || m.ok !== true || m.email !== low(row.email)) {
      await svc.from('slack_ask_pending').update({ outcome: 'failed', input: null }).eq('id', row.id);
      await say(title + 'I could not match your Slack account to the Hub\'s team list any more, so nothing was saved.');
      return;
    }
    const res = await hub(m, { execute: { name: row.name, input: row.input || {} } });
    const out = (res && res.executed) || { error: (res && res.error) || 'no answer from the Hub' };
    await svc.from('slack_ask_pending').update({ outcome: out.ok ? 'done' : 'failed', input: null }).eq('id', row.id);
    await say(title + (out.ok ? ':white_check_mark: ' + esc(out.detail || 'Done.') : 'Could not do it: ' + esc(String(out.error || 'unknown problem')) + '. Nothing was changed.'));
  } catch (_) {
    try { await say('Something went wrong on my side, and nothing was changed. Ask me again, or do it in <' + SITE + '|the Hub>.'); } catch (_e) { /* nothing more to do */ }
  }
}

/* answer Slack inside its three seconds, and finish the work after: the runtime keeps the function alive for it */
function later(work) {
  const p = Promise.resolve().then(work).catch(()=>{});
  // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime && typeof EdgeRuntime.waitUntil === 'function') { EdgeRuntime.waitUntil(p); return null; }
  return p;
}

Deno.serve(async (req)=>{
  if (req.method !== 'POST') return ok200('ok');
  const raw = await req.text();
  const type = (req.headers.get('content-type') || '').toLowerCase();
  const isJson = type.indexOf('application/json') >= 0;
  if (!await getSecret('SLACK_SIGNING_SECRET')) {
    if (isJson) return new Response('not wired up', { status: 503 });
    return eph('Ask the Hub is not switched on in Slack yet: an admin needs to store the Slack signing secret. (Admin: api.slack.com, WA HUB, Basic Information, Signing Secret.)');
  }
  if (!await verifySlack(req, raw)) return new Response('invalid signature', { status: 401 });

  /* ---- the Events API ---- */
  if (isJson) {
    let body = {};
    try { body = JSON.parse(raw); } catch (_) { return new Response('bad request', { status: 400 }); }
    if (body.type === 'url_verification') return ok200(String(body.challenge || ''), 'text/plain');
    if (!await ourTeam(body.team_id)) return new Response('wrong workspace', { status: 403 });
    if (body.type !== 'event_callback' || !body.event) return ok200('');
    const ev = body.event;
    if (ev.type === 'message' && ev.channel_type === 'im' && !ev.bot_id && (!ev.subtype || ev.subtype === 'file_share') && ev.user && typeof ev.text === 'string') {
      if (await seenBefore(body.event_id, ev.user)) return ok200('');
      const wait = later(()=>handleDm(ev));
      if (wait) await wait;
      return ok200('');
    }
    if (ev.type === 'app_mention' && ev.user && ev.channel && !ev.bot_id && ev.channel_type !== 'im' && String(ev.channel).charAt(0) !== 'D') {
      if (await seenBefore(body.event_id, ev.user)) return ok200('');
      const wait = later(()=>slack('chat.postEphemeral', { channel: ev.channel, user: ev.user, thread_ts: ev.thread_ts || undefined, text: 'Ask me in a direct message, so the answer stays between us: open *WA HUB* under Apps, or type `/hub` and your question here (only you see the reply).' }));
      if (wait) await wait;
      return ok200('');
    }
    /* Slack's side panel for apps: a new chat there opens with four ways to start */
    if (ev.type === 'assistant_thread_started' && ev.assistant_thread && ev.assistant_thread.channel_id && ev.assistant_thread.thread_ts) {
      if (await seenBefore(body.event_id, ev.assistant_thread.user_id)) return ok200('');
      const wait = later(()=>handleThreadStart(ev.assistant_thread));
      if (wait) await wait;
      return ok200('');
    }
    if (!(ev.type === 'message' && (ev.bot_id || ev.subtype))) console.log('slack-command: event not handled: ' + String(ev.type).slice(0, 40) + ' ' + String(ev.subtype || '-').slice(0, 40) + ' ' + String(ev.channel_type || '-').slice(0, 20));
    return ok200('');
  }

  const p = new URLSearchParams(raw);
  /* ---- a button ---- */
  if (p.get('payload')) {
    let payload = {};
    try { payload = JSON.parse(p.get('payload') || '{}'); } catch (_) { return new Response('bad request', { status: 400 }); }
    if (!await ourTeam(payload.team && payload.team.id)) return new Response('wrong workspace', { status: 403 });
    if (payload.type === 'block_actions') { const wait = later(()=>handleAction(payload)); if (wait) await wait; }
    return ok200('');
  }

  /* ---- /hub ---- */
  if (!await ourTeam(p.get('team_id'))) return new Response('wrong workspace', { status: 403 });
  const text = (p.get('text') || '').trim();
  const userId = p.get('user_id') || '';
  const userName = p.get('user_name') || '';
  const [sub, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ').trim();
  const one = (sub || '').toLowerCase();
  try {
    const instant = !text || (one === 'help' && !arg) ? 'help' : (one === 'tasks' || one === 'mine' || one === 'my') && (!arg || arg.toLowerCase() === 'tasks') ? 'tasks' : (one === 'project' || one === 'p') ? 'project' : (one === 'idea' || one === 'feedback') ? 'idea' : '';
    if (instant) {
      /* every command needs a person the Hub knows: a project snapshot is not for a guest in the workspace */
      const m0 = await memberFor(userId);
      const no = refusal(m0);
      if (no) return eph(no);
      if (instant === 'help') return eph(helpText(m0));
      if (instant === 'tasks') return eph(await cmdTasks(m0));
      if (instant === 'project') return eph(await cmdProject(arg));
      return eph(await cmdIdea(m0, userName, arg));
    }
    /* anything else is a question for Ask the Hub: answer Slack at once, then send the real answer to the reply address */
    const wait = later(()=>handleSlashAsk(userId, text, p.get('response_url') || ''));
    if (wait) await wait;
    return eph(LOOKING);
  } catch (e) {
    return eph('That hit an error: ' + esc(String(e).slice(0, 200)));
  }
});
