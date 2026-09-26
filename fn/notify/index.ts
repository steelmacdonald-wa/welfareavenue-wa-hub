// Welfare Avenue: notify (v7 deploy, 08/08/26)
// v7: adds change_request_text (staff JWT callable): posts an arbitrary
// short staff-authored line to the Slack channel (used by wave110 access
// requests: ':key: Access request from ...'). Text is capped and
// prefixed with the caller's email for accountability.
// v6: change_request event. v5: Slack notifications for five trigger
// events + welcome_kit + decision_raised + test. Delivery ladder: true
// Slack DM when the bot has chat:write+im:write (granted 07/08/26),
// channel ping fallback otherwise. Slack ids resolve from wa_slack_ids
// (Ian PINNED U0A7DF871FS), then users.lookupByEmail, then users.list
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
      old_value: null, new_value: target + ': ' + outcome, changed_by: 'notify v7'
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

async function optedOut(email: string, event: string): Promise<boolean> {
  if (!email) return false;
  const { data } = await svc.from('wa_notify_prefs').select('disabled').eq('email', email).maybeSingle();
  const d = (data?.disabled || []) as string[];
  return Array.isArray(d) && d.indexOf(event) >= 0;
}

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

  if (event === 'mentioned') {
    const id = Number(body.mention_id);
    const { data: m } = await svc.from('mentions').select('*').eq('id', id).maybeSingle();
    if (!m) return { error: 'mention not found' };
    if (m.visibility === 'private') { await log(event, m.person, 'skipped: private meeting'); return { event, outcome: 'private' }; }
    const restricted = m.visibility === 'leadership';
    const text = ':speech_balloon: You were mentioned in *' + (m.meeting_title || 'a meeting') + '*'
      + (!restricted && m.quote ? '\n> ' + String(m.quote).slice(0, 200) : '')
      + '\n' + siteLink('#mypage');
    const out = await deliver(event, String(m.person || ''), null, text);
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
