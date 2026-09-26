// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Welfare Avenue: slack-command (v1, 07/08/26)
// The /hub slash command. Slack POSTs form-encoded payloads here; auth is
// Slack's signing secret (HMAC v0), NOT a Supabase JWT, so this function
// must be deployed with verify_jwt=false. Until SLACK_SIGNING_SECRET is
// stored (Steel pastes it from api.slack.com -> Basic Information), every
// request is refused with instructions.
// Commands:
//   /hub tasks               -> your open tasks (matched via wa_slack_ids/names)
//   /hub project <name>      -> project status summary + link
//   /hub request <text>      -> file a Hub change request (wa_change_requests)
//   /hub help (or anything else) -> usage
// Replies are ephemeral (only the requester sees them). SAFETY: tasks
// marked confidential/board_only/restricted are never shown in Slack.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SITE = 'https://wa-exec-dashboard.netlify.app/';
const DEPT_LABEL = {
  opsmtl: 'Ops Montreal',
  opsto: 'Ops Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising & Grants',
  hr: 'Human Resources',
  board: 'Board'
};
const eph = (text)=>new Response(JSON.stringify({
    response_type: 'ephemeral',
    text
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
async function getSecret(name) {
  const { data } = await svc.rpc('get_secret', {
    secret_name: name
  });
  return data || null;
}
async function verifySlack(req, raw) {
  const secret = await getSecret('SLACK_SIGNING_SECRET');
  if (!secret) return false;
  const ts = req.headers.get('x-slack-request-timestamp') || '';
  const sig = req.headers.get('x-slack-signature') || '';
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseFloat(ts)) > 300) return false;
  const base = 'v0:' + ts + ':' + raw;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const hex = 'v0=' + [
    ...new Uint8Array(mac)
  ].map((b)=>b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for(let i = 0; i < hex.length; i++)diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
function visible(t) {
  if (t.confidential === true || t.board_only === true) return false;
  if (t.visibility && t.visibility !== 'open' && t.visibility !== 'all') return false;
  return true;
}
function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '');
}
async function rosterNameFor(slackUserId, slackUserName) {
  /* slack id -> email (wa_slack_ids) -> roster name; else name caches */ const { data: byId } = await svc.from('wa_slack_ids').select('email').eq('slack_id', slackUserId).maybeSingle();
  if (byId?.email) {
    const { data: m } = await svc.from('team_members').select('name').eq('email', byId.email).maybeSingle();
    if (m?.name) return m.name;
  }
  const { data: byName } = await svc.from('wa_slack_names').select('display_name').eq('slack_id', slackUserId).maybeSingle();
  if (byName?.display_name) return byName.display_name;
  /* last resort: slack user_name vs roster first names */ const { data: roster } = await svc.from('team_members').select('name').eq('active', true);
  const un = norm(slackUserName);
  const hits = (roster || []).filter((r)=>{
    const n = norm(r.name);
    return n === un || norm(r.name.split(' ')[0]) === un || un.indexOf(norm(r.name.split(' ')[0])) === 0;
  });
  return hits.length === 1 ? hits[0].name : null;
}
async function cmdTasks(userId, userName) {
  const who = await rosterNameFor(userId, userName);
  if (!who) return 'I could not match your Slack account to the Hub roster yet. Open the Hub once (' + SITE + ') and try again, or ask an admin to link you.';
  const { data } = await svc.from('dept_tasks').select('id, title, department, owner, due_date, flag, done, confidential, board_only, visibility, project_id').is('banked_at', null).eq('done', false);
  const first = norm(who.split(' ')[0]);
  const mine = (data || []).filter(visible).filter((t)=>{
    const o = norm(t.owner || '');
    return o && (o.indexOf(norm(who)) >= 0 || o.indexOf(first) >= 0);
  });
  if (!mine.length) return 'Nothing open under your name, ' + who.split(' ')[0] + '. Enjoy it. Full picture: <' + SITE + '#mypage|your Hub page>.';
  mine.sort((a, b)=>(a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
  const lines = mine.slice(0, 12).map((t)=>{
    let s = '• ' + t.title;
    if (t.due_date) s += ' (due ' + t.due_date + ')';
    if (t.flag) s += ' :triangular_flag_on_post:';
    s += '  _' + (DEPT_LABEL[t.department || ''] || t.department || '') + '_';
    return s;
  });
  let out = '*Your open tasks (' + mine.length + ')*\n' + lines.join('\n');
  if (mine.length > 12) out += '\n_…and ' + (mine.length - 12) + ' more on <' + SITE + '#mypage|your Hub page>._';
  else out += '\n<' + SITE + '#mypage|Open your Hub page>';
  return out;
}
async function cmdProject(query) {
  if (!query) return 'Tell me which project: `/hub project community kitchen`';
  const { data: ps } = await svc.from('projects').select('id, name, department, status').is('banked_at', null).neq('status', 'archived');
  const q = norm(query);
  const matches = (ps || []).filter((p)=>norm(p.name).indexOf(q) >= 0);
  if (!matches.length) return 'No project matches "' + query + '". The full list lives at <' + SITE + '#projects|Hub projects>.';
  if (matches.length > 3) return 'That matches ' + matches.length + ' projects: ' + matches.slice(0, 6).map((p)=>p.name).join(', ') + '. Narrow it down?';
  const parts = [];
  for (const p of matches){
    const { data } = await svc.from('dept_tasks').select('id, title, department, owner, due_date, flag, done, confidential, board_only, visibility, project_id').is('banked_at', null).eq('project_id', p.id);
    const ts = (data || []).filter(visible);
    const open = ts.filter((t)=>!t.done);
    const flagged = open.filter((t)=>t.flag).length;
    const owners = [
      ...new Set(open.map((t)=>(t.owner || '').trim()).filter(Boolean))
    ];
    const depts = [
      ...new Set(open.map((t)=>t.department).filter(Boolean))
    ];
    let s = '*<' + SITE + '#project/' + p.id + '|' + p.name + '>*  _' + (DEPT_LABEL[p.department] || p.department) + '_\n';
    s += open.length + ' open task' + (open.length === 1 ? '' : 's') + (flagged ? ' (' + flagged + ' flagged)' : '') + (owners.length ? ' · ' + owners.length + ' people' : '') + (depts.length > 1 ? ' · teams: ' + depts.map((d)=>DEPT_LABEL[d] || d).join(', ') : '');
    if (open.length) {
      const soon = open.filter((t)=>t.due_date).sort((a, b)=>a.due_date < b.due_date ? -1 : 1).slice(0, 3);
      if (soon.length) s += '\nNext due: ' + soon.map((t)=>t.title + ' (' + t.due_date + (t.owner ? ', ' + t.owner : '') + ')').join('; ');
    }
    parts.push(s);
  }
  return parts.join('\n\n');
}
async function cmdRequest(userId, userName, text) {
  if (!text || text.length < 8) return 'Describe the change: `/hub request add a print button to the finance page`';
  const who = await rosterNameFor(userId, userName) || userName || 'someone via Slack';
  const { data, error } = await svc.from('wa_change_requests').insert({
    request: text.slice(0, 1500),
    requested_by: who + ' (via /hub)',
    status: 'new'
  }).select('id').maybeSingle();
  if (error) return 'Could not file that: ' + error.message;
  try {
    const { data: secret } = await svc.rpc('get_secret', {
      secret_name: 'WA_TRIGGER_SECRET'
    });
    if (secret) {
      await fetch(SUPABASE_URL + '/functions/v1/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wa-secret': String(secret)
        },
        body: JSON.stringify({
          event: 'change_request',
          request_id: data?.id
        })
      });
    }
  } catch (_) {}
  return ':memo: Filed. Your request is tracked in the Hub admin panel (Change the Hub), and the team got a ping. Reference #' + (data?.id || '?') + '.';
}
Deno.serve(async (req)=>{
  if (req.method !== 'POST') return new Response('ok');
  const raw = await req.text();
  const hasSecret = !!await getSecret('SLACK_SIGNING_SECRET');
  if (!hasSecret) return eph('The /hub command is not wired up yet: an admin needs to store the Slack signing secret. (Admin: api.slack.com -> WA HUB -> Basic Information -> Signing Secret.)');
  if (!await verifySlack(req, raw)) return new Response('invalid signature', {
    status: 401
  });
  const p = new URLSearchParams(raw);
  const text = (p.get('text') || '').trim();
  const userId = p.get('user_id') || '';
  const userName = p.get('user_name') || '';
  const [sub, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ').trim();
  try {
    if (sub === 'tasks' || sub === 'mine' || sub === 'my') return eph(await cmdTasks(userId, userName));
    if (sub === 'project' || sub === 'p') return eph(await cmdProject(arg));
    if (sub === 'request' || sub === 'req') return eph(await cmdRequest(userId, userName, arg));
    return eph('*The Hub, from Slack*\n• `/hub tasks` : your open tasks\n• `/hub project <name>` : a project status snapshot\n• `/hub request <describe a change>` : file a Hub change request\nEverything else lives on <' + SITE + '|the Hub>.');
  } catch (e) {
    return eph('That hit an error: ' + String(e).slice(0, 200));
  }
});
