// v14 (waves 239 and 242, 15/10/26): two events and a per-kind choice. volunteer_applied (a photographer or videographer applied:
// the database names the SOP's photographer owner, to_name/to_email) and task_due (wa242_due_reminders: a person's tasks due
// today, tomorrow or overdue, once a day). The notification centre (wave242) keeps each kind's Hub and Slack switch in
// wa_notify_prefs.prefs.kinds[kind] = {hub, slack}: slack false means no DM for that kind; a kind with no entry follows
// the old rules (disabled list, channel hub with a device on). ROLE_WORDS names the volunteer roles.
// v12 (wave219, 07/10/26): Hub notifications. A person who chose Hub notifications only (wa_notify_prefs.prefs.channel 'hub')
// and has a device on (hub_push_subs) gets no Slack DM for an @mention, a meeting mention, a task handed to them, a request
// for their team or an accepted suggestion: hub-push sends those to their devices. With no device on, Slack still does.
// wave165 (29/09/26): a mention from a one-on-one is never sent (the person mentioned did not speak in it) (one-on-ones are only for the people speaking in them now: visibility speakers; restricted work never
// reaches the person mentioned).
// Welfare Avenue: notify (v11, 26/09/26)
// v10 (wave138): a task description saves as the person types, so a mention there waits 20 seconds in the
// background (EdgeRuntime.waitUntil) and quotes the description as it stands then; a mention removed meanwhile
// is skipped. Comments, notes and the rest are sent at once. v11: that skip is logged like the others; the log says notify.
// v9 (wave138): the quoted text of a mention reads as Slack formatting (bold, links, bullets and headings
// written in the Hub's editor), and the DM quotes the part of a long text around the mention (hub_mentions.snippet).
// v13 (wave157): the CRM automations' notices are hub_mentions of kind crm (from The CRM); their DM says "the CRM automation".
// v8 (wave138): comment_mention. When someone @mentions a person anywhere in the Hub (hub_mentions, filed by
// the mention triggers), the DM goes out automatically: as the writer when they have connected Slack
// (slack-connect keeps their user token in the vault as slack_user_token:<email>), else from the Hub bot with
// their name. A confidential, board-only or restricted item is named without its text. The row records the result.
// Welfare Avenue: notify (v7 deploy, 08/08/26)
// v7: adds change_request_text (staff JWT callable): posts an arbitrary
// short staff-authored line to the Slack channel (used by wave110 access
// requests: ':key: Access request from ...'). Text is capped and
// prefixed with the caller's email for accountability.
// v6: change_request event. v5: Slack notifications for five trigger
// events + welcome_kit + decision_raised + test. Delivery ladder: true
// Slack DM when the bot has chat:write+im:write (granted 07/08/26),
// channel ping fallback otherwise. Slack ids resolve from wa_slack_ids
// (Ian pinned to his personal account U057BRKP1R9 since 26/09/26), then users.lookupByEmail, then users.list
// name match, cached. Every outcome is change_logged.
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

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

async function staffEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}

async function log(event: string, target: string, outcome: string) {
  try {
    await svc.from('change_log').insert({
      entity_type: 'notify', entity_id: event, field: 'delivery',
      old_value: null, new_value: target + ': ' + outcome, changed_by: 'notify'
    });
  } catch (_) { /* audit only */ }
}

function siteLink(hash: string): string {
  return 'https://wa-exec-dashboard.netlify.app/' + hash;
}

async function memberByName(name: string): Promise<{ email: string | null; name: string } | null> {
  if (!name) return null;
  const { data } = await svc.from('team_members').select('name, email, active').eq('active', true);
  const rows = data || [];
  const lower = name.toLowerCase();
  let hit = rows.find((r: { name: string }) => (r.name || '').toLowerCase() === lower);
  if (!hit) {
    const first = lower.split(' ')[0];
    const matches = rows.filter((r: { name: string }) => (r.name || '').toLowerCase().split(' ')[0] === first);
    if (matches.length === 1) hit = matches[0];
  }
  return hit ? { email: (hit.email || '').toLowerCase() || null, name: hit.name } : null;
}

/* v14 (wave242): the person's choice for this kind. prefs.kinds[kind].slack false: no DM. Else the disabled list, then
   (wave219) Hub only with a device on. */
type Prefs = { disabled: string[]; channel: string; kinds: Record<string, { hub?: boolean; slack?: boolean }> };
async function prefsOf(email: string): Promise<Prefs> {
  const out: Prefs = { disabled: [], channel: 'both', kinds: {} };
  try {
    const { data } = await svc.from('wa_notify_prefs').select('disabled, prefs').eq('email', email.toLowerCase()).maybeSingle();
    if (Array.isArray(data?.disabled)) out.disabled = data!.disabled as string[];
    const p = (data?.prefs || {}) as Record<string, unknown>;
    out.channel = String(p.channel || 'both');
    if (p.kinds && typeof p.kinds === 'object') out.kinds = p.kinds as Prefs['kinds'];
  } catch (_) { /* defaults */ }
  return out;
}
async function optedOut(email: string, event: string): Promise<boolean> {
  if (!email) return false;
  const p = await prefsOf(email);
  const k = p.kinds[event];
  if (k && typeof k.slack === 'boolean') return !k.slack;
  return p.disabled.indexOf(event) >= 0;
}

/* v12 (wave219): Hub notifications instead of Slack, when the person chose that and a device of theirs is on */
const HUB_EVENTS = ['comment_mention', 'mentioned', 'task_reassigned', 'request_filed', 'suggestion_accepted', 'volunteer_applied', 'task_due'];
async function hubOnly(email: string, event: string): Promise<boolean> {
  if (!email || HUB_EVENTS.indexOf(event) < 0) return false;
  try {
    const e = email.toLowerCase();
    const p = await prefsOf(e);
    const k = p.kinds[event];
    if (k && typeof k.slack === 'boolean') return false;   /* v14: an explicit Slack choice for this kind wins */
    if (p.channel !== 'hub') return false;
    const { count } = await svc.from('hub_push_subs').select('id', { count: 'exact', head: true }).eq('email', e);
    return (count || 0) > 0;
  } catch (_) { return false; }
}
const ROLE_WORDS: Record<string, string> = { team_leader: 'team leader', cook: 'cook', driver: 'driver', server: 'server', dishwasher: 'dishwasher',
  photographer: 'photographer', videographer: 'videographer', community_debrief: 'community lead', community_talker: 'community lead', volunteer: 'volunteer' };
const SOURCE_WORDS: Record<string, string> = { website: 'the website', cabm: 'CABM', fcabq: 'Je B\u00e9n\u00e9vole', email: 'by email', manual: 'added by hand', linkedin: 'LinkedIn', referral: 'a referral', event: 'an event' };
function listWords(xs: string[]): string { return xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }

function norm(s: string): string { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }

async function slackIdByName(rosterName: string, token: string): Promise<string | null> {
  try {
    let cursor = '';
    const target = norm(rosterName);
    const targetFirst = norm(rosterName.split(' ')[0]);
    const hits: string[] = [];
    const firstHits: string[] = [];
    for (let page = 0; page < 5; page++) {
      const res = await fetch('https://slack.com/api/users.list?limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const body = await res.json();
      if (!body.ok) return null;
      for (const u of body.members || []) {
        if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue;
        const names = [u.real_name, u.profile?.real_name, u.profile?.display_name, u.name];
        if (names.some((n: string) => n && norm(n) === target)) hits.push(u.id);
        else if (targetFirst && names.some((n: string) => n && norm(String(n).split(' ')[0]) === targetFirst)) firstHits.push(u.id);
      }
      cursor = body.response_metadata?.next_cursor || '';
      if (!cursor) break;
    }
    if (hits.length === 1) return hits[0];
    if (hits.length === 0 && firstHits.length === 1) return firstHits[0];
    return null;
  } catch (_) { return null; }
}

async function slackIdFor(email: string, rosterName: string | null): Promise<string | null> {
  if (!email) return null;
  const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email).maybeSingle();
  if (data?.slack_id) return data.slack_id;
  try {
    const token = await getSecret('SLACK_BOT_TOKEN');
    const res = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), {
      headers: { Authorization: 'Bearer ' + token }
    });
    const body = await res.json();
    if (body.ok && body.user?.id) {
      await svc.from('wa_slack_ids').upsert({ email, slack_id: body.user.id, source: 'lookupByEmail', updated_at: new Date().toISOString() });
      return body.user.id;
    }
    if (rosterName) {
      const byName = await slackIdByName(rosterName, token);
      if (byName) {
        await svc.from('wa_slack_ids').upsert({ email, slack_id: byName, source: 'users.list name match', updated_at: new Date().toISOString() });
        return byName;
      }
    }
    return null;
  } catch (_) { return null; }
}

async function postSlack(text: string): Promise<boolean> {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    return r.ok;
  } catch (_) { return false; }
}

async function dm(slackId: string, text: string): Promise<{ ok: boolean; err?: string }> {
  try {
    const token = await getSecret('SLACK_BOT_TOKEN');
    const open = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: slackId })
    });
    const oBody = await open.json();
    if (!oBody.ok) return { ok: false, err: oBody.error };
    const post = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: oBody.channel.id, text, unfurl_links: false })
    });
    const pBody = await post.json();
    return pBody.ok ? { ok: true } : { ok: false, err: pBody.error };
  } catch (e) {
    return { ok: false, err: String(e).slice(0, 120) };
  }
}

/* v8: a DM sent as the person who wrote the mention (their own Slack token), when they have connected Slack */
async function dmAsUser(fromEmail: string, slackId: string, text: string): Promise<{ ok: boolean; err?: string }> {
  let token = '';
  try { token = await getSecret('slack_user_token:' + fromEmail); } catch (_) { return { ok: false, err: 'not_connected' }; }
  try {
    const open = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ users: slackId })
    });
    const oBody = await open.json();
    if (!oBody.ok) return { ok: false, err: oBody.error };
    const post = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: oBody.channel.id, text, unfurl_links: false, unfurl_media: false })
    });
    const pBody = await post.json();
    return pBody.ok ? { ok: true } : { ok: false, err: pBody.error };
  } catch (e) { return { ok: false, err: String(e).slice(0, 120) }; }
}

const MENTION_KIND: Record<string, string> = {
  task: 'the task', goal: 'the goal', request: 'the request', update: 'a team update', decision: 'the decision',
  committee: 'a committee note', project: 'the project', content: 'the post', crm: 'the CRM automation'
};
function slackEsc(s: string): string { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/* v9: the Hub's editor writes markdown; Slack reads its own mrkdwn */
function slackText(s: string): string {
  return slackEsc(s).split('\n').map(line => line
    .replace(/^\s*#{1,6}\s+(.+)$/, '*$1*')
    .replace(/^(\s*)[-*]\s+/, '$1\u2022 ')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/~~(.+?)~~/g, '~$1~')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<$2|$1>')).join('\n');
}

/* v10: the part of a text around a mention, as wa_mention_notify quotes it */
function around(text: string, name: string): string {
  const t = String(text || '').trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  if (t.length <= 600) return t;
  const p = t.toLowerCase().indexOf(('@' + name).toLowerCase()) + 1;
  if (p <= 400) return t.slice(0, 597) + '...';
  const start = p - 200;
  return '...' + t.slice(start - 1, start - 1 + 594) + (start - 1 + 594 < t.length ? '...' : '');
}
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

async function commentMention(id: number): Promise<Record<string, unknown>> {
  const { data: m } = await svc.from('hub_mentions').select('*').eq('id', id).maybeSingle();
  if (!m) return { error: 'mention not found' };
  if (m.dm_status !== 'pending') return { event: 'comment_mention', outcome: 'already ' + m.dm_status };
  const done = async (status: string, via: string | null, err: string | null) => {
    await svc.from('hub_mentions').update({ dm_status: status, dm_via: via, dm_error: err, dm_at: new Date().toISOString() }).eq('id', id);
    await log('comment_mention', String(m.to_email || m.to_name || '?'), status + (via ? ' as ' + via : '') + (err ? ': ' + err : ''));
    return { event: 'comment_mention', outcome: status, via, error: err };
  };
  /* v10: a task description saves while the person is still typing: wait, then quote what it says now */
  if (m.source_table === 'dept_tasks' && m.source_id) {
    await new Promise(r => setTimeout(r, 20000));
    const { data: t } = await svc.from('dept_tasks').select('description').eq('id', m.source_id).maybeSingle();
    const desc = String(t?.description || '');
    if (!stillMentions(desc, String(m.to_name || ''))) return done('skipped', null, 'the mention was removed before sending');
    m.snippet = around(desc, String(m.to_name || ''));
    await svc.from('hub_mentions').update({ snippet: m.snippet }).eq('id', id);
  }
  if (!m.to_email) return done('skipped', null, 'no email on the roster');
  if (await optedOut(String(m.to_email), 'comment_mention')) return done('skipped', null, 'opted out');
  if (await hubOnly(String(m.to_email), 'comment_mention')) return done('skipped', null, 'Hub notifications only');
  const sid = await slackIdFor(String(m.to_email), m.to_name ? String(m.to_name) : null);
  if (!sid) return done('skipped', null, 'no Slack account found');
  const link = siteLink(String(m.url || ''));
  const where = (MENTION_KIND[String(m.kind)] || 'something') + (m.ref_title && !m.private ? ' ' + String.fromCharCode(8220) + slackEsc(String(m.ref_title)) + String.fromCharCode(8221) : '');
  const snippet = m.private ? '' : slackText(String(m.snippet || '').slice(0, 610));
  /* as the writer: their words, then where */
  const asUser = (snippet ? snippet + '\n' : 'I mentioned you on ' + where + ' in the Hub (it is confidential, so the text stays there).\n') + '<' + link + '|Open ' + where + ' in the Hub>';
  const r1 = await dmAsUser(String(m.from_email), sid, asUser);
  if (r1.ok) return done('sent', 'user', null);
  /* from the Hub bot, with their name */
  const asBot = ':speech_balloon: *' + slackEsc(String(m.from_name || m.from_email)) + '* mentioned you on ' + where + (snippet ? ':\n> ' + snippet.replace(/\n/g, '\n> ') : ' (confidential, so the text stays in the Hub).') + '\n<' + link + '|Open it in the Hub>';
  const r2 = await dm(sid, asBot);
  if (r2.ok) return done('sent', 'bot', r1.err && r1.err !== 'not_connected' ? 'as the writer failed: ' + r1.err : null);
  return done('failed', null, (r2.err || 'unknown') + (r1.err && r1.err !== 'not_connected' ? '; as the writer: ' + r1.err : ''));
}

async function deliver(event: string, personName: string | null, email: string | null, text: string): Promise<string> {
  const target = email || personName || 'unknown';
  let rosterName = personName;
  if (!email && personName) {
    const m = await memberByName(personName);
    email = m?.email || null;
    rosterName = m?.name || personName;
  }
  if (!email) { await log(event, target, 'skipped: no roster email'); return 'no_email'; }
  if (!rosterName) {
    const { data } = await svc.from('team_members').select('name').eq('email', email).maybeSingle();
    rosterName = data?.name || null;
  }
  if (await optedOut(email, event)) { await log(event, email, 'skipped: opted out'); return 'opted_out'; }
  if (await hubOnly(email, event)) { await log(event, email, 'skipped: Hub notifications only'); return 'hub_only'; }
  const sid = await slackIdFor(email, rosterName);
  if (!sid) { await log(event, email, 'skipped: no Slack id (not resolvable yet)'); return 'no_slack'; }
  const r = await dm(sid, text);
  if (r.ok) { await log(event, email, 'sent (DM)'); return 'sent'; }
  if (r.err === 'missing_scope' || r.err === 'not_allowed_token_type') {
    const ok = await postSlack('<@' + sid + '> ' + text);
    await log(event, email, ok ? 'sent via channel ping (DM scopes not granted yet)' : 'failed: webhook fallback also failed');
    return ok ? 'sent_channel' : 'failed';
  }
  await log(event, email, 'failed: ' + (r.err || 'unknown'));
  return 'failed';
}

async function handle(event: string, body: Record<string, unknown>, callerEmail: string | null): Promise<Record<string, unknown>> {
  if (event === 'decision_raised') {
    const d = (body.decision || {}) as Record<string, unknown>;
    const title = String(d.title || '').slice(0, 200);
    if (!title) return { error: 'decision title required' };
    const cat = String(d.reason_category || '');
    const hot = /budget|purchase|legal|risk|governance/i.test(cat);
    const line = (hot ? ':red_circle:' : ':large_yellow_circle:') + ' *New executive decision raised*: ' + title
      + (cat ? ' (' + cat + ')' : '')
      + (d.raised_by ? '\nRaised by ' + String(d.raised_by) : '')
      + (d.reason_note ? '\n' + String(d.reason_note).slice(0, 240) : '')
      + '\n' + siteLink('#overview');
    const ok = await postSlack(line);
    await log(event, 'webhook channel', ok ? 'sent' : 'failed');
    return { event, outcome: ok ? 'sent' : 'failed' };
  }

  if (event === 'change_request') {
    const id = Number(body.request_id);
    const { data: r } = await svc.from('wa_change_requests').select('*').eq('id', id).maybeSingle();
    if (!r) return { error: 'request not found' };
    const line = ':memo: *Hub change request* from ' + String(r.requested_by || 'someone')
      + ':\n> ' + String(r.request || '').slice(0, 400)
      + '\nTracked in Admin, under Change the Hub. Builds run through the tested pipeline.';
    const ok = await postSlack(line);
    await log(event, 'webhook channel', ok ? 'sent' : 'failed');
    return { event, outcome: ok ? 'sent' : 'failed' };
  }

  if (event === 'change_request_text') {
    const text = String(body.text || '').replace(/[<>]/g, '').slice(0, 600);
    if (!text) return { error: 'text required' };
    const ok = await postSlack(text + '\n_via the Hub, ' + (callerEmail || 'staff') + '_');
    await log(event, 'webhook channel', ok ? 'sent' : 'failed');
    return { event, outcome: ok ? 'sent' : 'failed' };
  }

  if (event === 'test') {
    const email = String(body.email || callerEmail || '');
    const out = await deliver('test', null, email, ':wave: Test notification from the Welfare Avenue Hub. If you can read this, per-person notifications are working.');
    return { event, outcome: out };
  }

  if (event === 'welcome_kit') {
    const email = String(body.email || '').toLowerCase();
    const text = String(body.text || '').slice(0, 3500);
    if (!email || !text) return { error: 'email and text required' };
    const out = await deliver('welcome_kit', null, email, text + '\n\n' + siteLink('#training') + ' is where your onboarding lives.');
    return { event, outcome: out };
  }

  if (event === 'request_filed') {
    const id = Number(body.request_id);
    await new Promise(r => setTimeout(r, 3000));
    const { data: sug } = await svc.from('request_suggestions').select('id').eq('request_id', id).maybeSingle();
    if (sug) { await log(event, 'request ' + id, 'skipped: covered by suggestion_accepted'); return { event, outcome: 'covered' }; }
    const { data: r } = await svc.from('dept_requests').select('*').eq('id', id).maybeSingle();
    if (!r) return { error: 'request not found' };
    const { data: rt } = await svc.from('request_types').select('label, default_assignee').eq('key', r.type_key).maybeSingle();
    const recipient = r.assignee || rt?.default_assignee || null;
    const text = ':inbox_tray: New request for your team: *' + (r.title || rt?.label || r.type_key) + '*'
      + (r.requested_by ? '\nFiled by ' + r.requested_by : '')
      + '\n' + siteLink('#requests');
    if (recipient) {
      const out = await deliver(event, String(recipient), null, text);
      return { event, outcome: out };
    }
    const { data: leads } = await svc.from('hub_roles').select('email, role').eq('role', 'leader');
    const { data: tms } = await svc.from('team_members').select('name, email, department').eq('active', true).eq('department', r.department);
    const deptLeadEmails = (tms || []).map((t: { email: string }) => (t.email || '').toLowerCase())
      .filter((e: string) => (leads || []).some((l: { email: string }) => l.email === e)).slice(0, 2);
    if (!deptLeadEmails.length) { await log(event, r.department, 'skipped: no leader found'); return { event, outcome: 'no_leader' }; }
    const outs = [];
    for (const e of deptLeadEmails) outs.push(await deliver(event, null, e, text));
    return { event, outcome: outs.join(',') };
  }

  if (event === 'task_reassigned') {
    const id = Number(body.task_id);
    const { data: t } = await svc.from('dept_tasks').select('id, title, department, owner, due_date, updated_by').eq('id', id).maybeSingle();
    if (!t) return { error: 'task not found' };
    const text = ':card_index_dividers: A task is now yours: *' + t.title + '*'
      + (t.due_date ? ' (due ' + t.due_date + ')' : '')
      + (t.updated_by ? '\nReassigned by ' + t.updated_by : '')
      + '\n' + siteLink('#task/' + t.id);
    const out = await deliver(event, String(t.owner || ''), null, text);
    return { event, outcome: out };
  }

  if (event === 'suggestion_accepted') {
    const id = Number(body.suggestion_id);
    const { data: s } = await svc.from('request_suggestions').select('*').eq('id', id).maybeSingle();
    if (!s) return { error: 'suggestion not found' };
    const { data: rt } = await svc.from('request_types').select('label, default_assignee').eq('key', s.type_key).maybeSingle();
    const recipient = s.assignee || rt?.default_assignee || null;
    const text = ':white_check_mark: A meeting suggestion was accepted into a real request for your team: *' + (s.title || rt?.label || s.type_key) + '*'
      + (s.quote ? '\n> ' + String(s.quote).slice(0, 180) : '')
      + '\n' + siteLink('#requests');
    if (!recipient) { await log(event, s.department || 'unknown', 'skipped: no recipient'); return { event, outcome: 'no_recipient' }; }
    const out = await deliver(event, String(recipient), null, text);
    return { event, outcome: out };
  }

  if (event === 'comment_mention') {
    /* v10: answer the database at once; a task description's mention finishes in the background */
    const job = commentMention(Number(body.mention_id));
    const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (rt && typeof rt.waitUntil === 'function') { rt.waitUntil(job.catch(() => null)); return { event, outcome: 'queued' }; }
    return await job;
  }

  if (event === 'mentioned') {
    const id = Number(body.mention_id);
    const { data: m } = await svc.from('mentions').select('*').eq('id', id).maybeSingle();
    if (!m) return { error: 'mention not found' };
    if (m.visibility === 'private' || m.visibility === 'speakers') { await log(event, m.person, 'skipped: private meeting'); return { event, outcome: 'private' }; }
    const restricted = m.visibility === 'leadership';
    const text = ':speech_balloon: You were mentioned in *' + (m.meeting_title || 'a meeting') + '*'
      + (!restricted && m.quote ? '\n> ' + String(m.quote).slice(0, 200) : '')
      + '\n' + siteLink('#mypage');
    const out = await deliver(event, String(m.person || ''), null, text);
    return { event, outcome: out };
  }

  if (event === 'volunteer_applied') {
    /* v14 (wave239): a photographer or videographer applied; the database named the SOP's photographer owner */
    const id = Number(body.application_id);
    const { data: a } = await svc.from('volunteer_applications').select('id, name, roles, role_text, source, message, applied_at, language').eq('id', id).maybeSingle();
    if (!a) return { error: 'application not found' };
    const roles = ((a.roles || []) as string[]).filter(r => r === 'photographer' || r === 'videographer').map(r => ROLE_WORDS[r] || r);
    const others = ((a.roles || []) as string[]).filter(r => r !== 'photographer' && r !== 'videographer').map(r => ROLE_WORDS[r] || r);
    const text = ':camera_with_flash: A new ' + (listWords(roles) || 'photographer') + ' applied: *' + slackEsc(String(a.name || 'a volunteer')) + '*'
      + (a.source ? ' (' + (SOURCE_WORDS[String(a.source)] || String(a.source)) + ')' : '')
      + (others.length ? ', also as ' + listWords(others) : '')
      + (a.language === 'fr' ? ', in French' : '')
      + (a.message ? '\n> ' + slackEsc(String(a.message).replace(/\s+/g, ' ').slice(0, 220)) : '')
      + '\nYou own the Volunteer Photographers step in the serving SOP, so this one is yours to welcome.'
      + '\n' + siteLink('#volunteering/applicants');
    const toEmail = String(body.to_email || '').toLowerCase() || null;
    const out = await deliver(event, toEmail ? null : String(body.to_name || ''), toEmail, text);
    return { event, outcome: out };
  }

  if (event === 'task_due') {
    /* v14 (wave242): the day's reminder, composed by wa242_due_reminders */
    const email = String(body.email || '').toLowerCase();
    if (!email) return { error: 'email required' };
    const lines: string[] = [];
    const one = (t: { id: number; title: string; due: string }) => '\u2022 <' + siteLink('#task/' + t.id) + '|' + slackEsc(String(t.title || 'a task').replace(/\|/g, '/').slice(0, 90)) + '>';
    const over = (Array.isArray(body.overdue) ? body.overdue : []) as Array<{ id: number; title: string; due: string }>;
    const today = (Array.isArray(body.due_today) ? body.due_today : []) as Array<{ id: number; title: string; due: string }>;
    const tomorrow = (Array.isArray(body.due_tomorrow) ? body.due_tomorrow : []) as Array<{ id: number; title: string; due: string }>;
    if (!over.length && !today.length && !tomorrow.length) return { event, outcome: 'nothing due' };
    if (today.length) lines.push('*Due today* (' + today.length + ')\n' + today.slice(0, 8).map(one).join('\n') + (today.length > 8 ? '\n\u2026 and ' + (today.length - 8) + ' more' : ''));
    if (over.length) lines.push('*Overdue* (' + over.length + ')\n' + over.slice(0, 8).map(t => one(t) + ' (' + t.due + ')').join('\n') + (over.length > 8 ? '\n\u2026 and ' + (over.length - 8) + ' more' : ''));
    if (tomorrow.length) lines.push('*Due tomorrow* (' + tomorrow.length + ')\n' + tomorrow.slice(0, 8).map(one).join('\n') + (tomorrow.length > 8 ? '\n\u2026 and ' + (tomorrow.length - 8) + ' more' : ''));
    const text = ':alarm_clock: Your tasks, ' + String(body.day || 'today') + ':\n' + lines.join('\n') + '\nClose them or move the dates in the Hub: ' + siteLink('#mypage');
    const out = await deliver(event, null, email, text);
    return { event, outcome: out };
  }

  if (event === 'invited') {
    const id = Number(body.member_id);
    const { data: m } = await svc.from('team_members').select('name, email').eq('id', id).maybeSingle();
    if (!m) return { error: 'member not found' };
    const text = ':tada: Welcome to the Welfare Avenue Hub, ' + String(m.name || '').split(' ')[0]
      + '! Your account is ready: sign in with your Welfare Avenue Google account at ' + siteLink('')
      + '\nThe 60 second tour starts on your first visit.';
    const out = await deliver(event, null, (m.email || '').toLowerCase(), text);
    return { event, outcome: out };
  }

  return { error: 'unknown event' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const event = String(body.event || body.type || '');
  let authed = false;
  let callerEmail: string | null = null;
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) authed = true;
  } catch (_) { /* fall through */ }
  if (!authed) {
    callerEmail = await staffEmail(req);
    if (callerEmail && (event === 'welcome_kit' || event === 'test' || event === 'decision_raised' || event === 'change_request' || event === 'change_request_text')) authed = true;
  }
  if (!authed) return json({ error: 'unauthorized' }, 401);
  const result = await handle(event, body, callerEmail);
  return json(result, result.error ? 400 : 200);
});
