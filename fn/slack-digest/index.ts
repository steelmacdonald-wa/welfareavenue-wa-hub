// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Welfare Avenue: slack-digest (v1, 07/08/26)
// Weekly per-department digest posted into each department's Slack
// channel: flagged work first, then due-soon, then open tasks by owner
// with real @mentions, then what was completed in the last 7 days.
// Auth: x-wa-secret (the Monday pg_cron job) or staff JWT (manual runs).
// Actions:
//   {action:'preview', department?} -> composed text per dept, nothing sent
//   {action:'run', department?}     -> post to mapped channels
// Config lives in app_config key 'slack_digest' as JSON:
//   {"enabled":true, "map":{"opsmtl":"operations-mtl", ...}}
// so admins can retarget channels through Edit with AI later.
// SAFETY: tasks marked confidential, board_only, or with restricted
// visibility NEVER appear in a Slack post. Channel posting auto-joins
// public channels; posts appear as 'Welfare Avenue Hub'.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SITE = 'https://wa-exec-dashboard.netlify.app/';
const BOT_NAME = 'Welfare Avenue Hub';
const DEPT_LABEL = {
  opsmtl: 'Ops Montreal',
  opsto: 'Ops Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising & Grants',
  hr: 'Human Resources',
  board: 'Board'
};
const DEFAULT_MAP = {
  opsmtl: 'operations-mtl',
  marketing: 'social-media',
  fundraising: 'fundraising',
  hr: 'human-resources'
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
async function getSecret(name) {
  const { data, error } = await svc.rpc('get_secret', {
    secret_name: name
  });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data;
}
async function staffEmail(req) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}
function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '');
}
let USERS = null;
async function slackUsers(token) {
  if (USERS) return USERS;
  const out = [];
  let cursor = '';
  for(let page = 0; page < 5; page++){
    const res = await fetch('https://slack.com/api/users.list?limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), {
      headers: {
        Authorization: 'Bearer ' + token
      }
    });
    const body = await res.json();
    if (!body.ok) break;
    for (const u of body.members || []){
      if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue;
      out.push({
        id: u.id,
        names: [
          u.real_name,
          u.profile?.real_name,
          u.profile?.display_name,
          u.name
        ].filter(Boolean)
      });
    }
    cursor = body.response_metadata?.next_cursor || '';
    if (!cursor) break;
  }
  USERS = out;
  return out;
}
async function resolveName(rawName, token) {
  const key = norm(rawName);
  if (!key) return null;
  const { data: hit } = await svc.from('wa_slack_names').select('slack_id').eq('name_norm', key).maybeSingle();
  if (hit?.slack_id) return hit.slack_id;
  const users = await slackUsers(token);
  const exact = users.filter((u)=>u.names.some((n)=>norm(n) === key));
  let found = exact.length === 1 ? exact[0].id : null;
  let source = 'users.list exact name';
  if (!found && exact.length === 0) {
    const first = norm(rawName.split(/\s+/)[0]);
    if (first) {
      const fh = users.filter((u)=>u.names.some((n)=>norm(String(n).split(/\s+/)[0]) === first));
      if (fh.length === 1) {
        found = fh[0].id;
        source = 'users.list first name';
      }
    }
  }
  if (found) await svc.from('wa_slack_names').upsert({
    name_norm: key,
    display_name: rawName,
    slack_id: found,
    source,
    updated_at: new Date().toISOString()
  });
  return found;
}
function splitOwner(owner) {
  return String(owner || '').split(/\s*(?:\+|&|\/|,| and )\s*/i).map((s)=>s.trim()).filter(Boolean);
}
function visible(t) {
  if (t.confidential === true || t.board_only === true) return false;
  if (t.visibility && t.visibility !== 'open' && t.visibility !== 'all') return false;
  return true;
}
async function composeDept(dept, token) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const { data: rows } = await svc.from('dept_tasks').select('id, title, owner, due_date, flag, closed_at, done, confidential, board_only, visibility, project_id').is('banked_at', null).eq('department', dept);
  const all = (rows || []).filter(visible);
  const open = all.filter((t)=>!t.done);
  const doneWeek = all.filter((t)=>t.done && t.closed_at && t.closed_at >= since);
  if (!open.length && !doneWeek.length) return null;
  const flagged = open.filter((t)=>t.flag);
  const dueSoon = open.filter((t)=>!t.flag && t.due_date && t.due_date <= soon);
  const groups = {};
  let unassigned = 0;
  for (const t of open){
    const o = (t.owner || '').trim();
    if (!o) {
      unassigned++;
      continue;
    }
    (groups[o] = groups[o] || []).push(t);
  }
  const mention = new Map();
  for (const owner of Object.keys(groups))for (const person of splitOwner(owner)){
    if (!mention.has(person)) mention.set(person, await resolveName(person, token));
  }
  const head = (owner)=>splitOwner(owner).map((pn)=>{
      const id = mention.get(pn);
      return id ? '<@' + id + '>' : '*' + pn + '*';
    }).join(' + ');
  const line = (t)=>{
    let s = '• ' + String(t.title || '').trim();
    if (t.due_date) s += ' (due ' + t.due_date + ')';
    if (t.flag) s += '  :triangular_flag_on_post:';
    return s;
  };
  const label = DEPT_LABEL[dept] || dept;
  let text = ':newspaper: *<' + SITE + '#dept/' + dept + '|' + label + '> weekly digest*  _' + new Date().toISOString().slice(0, 10) + '_';
  text += '\n' + open.length + ' open task' + (open.length === 1 ? '' : 's') + (doneWeek.length ? ', ' + doneWeek.length + ' completed this week' : '') + (unassigned ? ', ' + unassigned + ' unassigned' : '') + '.';
  if (flagged.length) text += '\n\n:triangular_flag_on_post: *Flagged*\n' + flagged.slice(0, 8).map(line).join('\n') + (flagged.length > 8 ? '\n_…and ' + (flagged.length - 8) + ' more flagged._' : '');
  if (dueSoon.length) text += '\n\n:hourglass_flowing_sand: *Due in the next 7 days*\n' + dueSoon.slice(0, 8).map(line).join('\n') + (dueSoon.length > 8 ? '\n_…and ' + (dueSoon.length - 8) + ' more due soon._' : '');
  const sorted = Object.keys(groups).sort((a, b)=>groups[b].length - groups[a].length || a.localeCompare(b));
  text += '\n\n*Open tasks by person*';
  for (const owner of sorted){
    const list = groups[owner];
    text += '\n\n' + head(owner) + ' (' + list.length + ')\n' + list.slice(0, 5).map(line).join('\n');
    if (list.length > 5) text += '\n_…and ' + (list.length - 5) + ' more on the Hub._';
  }
  if (doneWeek.length) text += '\n\n:white_check_mark: *Completed this week*\n' + doneWeek.slice(0, 10).map((t)=>'• ' + String(t.title || '').trim()).join('\n') + (doneWeek.length > 10 ? '\n_…and ' + (doneWeek.length - 10) + ' more._' : '');
  text += '\n\n_Full picture: <' + SITE + '#dept/' + dept + '|the ' + label + ' page on the Hub>._';
  if (text.length > 11500) text = text.slice(0, 11400) + '\n_…trimmed; the Hub has the rest._';
  const idToName = {};
  for (const [pn, id] of mention.entries())if (id) idToName[id] = pn;
  const display = text.replace(/<@([A-Z0-9]+)>/g, (_m, id)=>'@' + (idToName[id] || id)).replace(/<([^|>]+)\|([^>]+)>/g, '$2');
  return {
    text,
    display,
    open: open.length,
    done_week: doneWeek.length
  };
}
async function channelIdByName(name, token) {
  const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200', {
    headers: {
      Authorization: 'Bearer ' + token
    }
  });
  const b = await res.json();
  if (!b.ok) return null;
  const hit = (b.channels || []).find((c)=>c.name === name);
  return hit ? hit.id : null;
}
async function post(token, channelId, text) {
  const doPost = async ()=>{
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channelId,
        text,
        username: BOT_NAME,
        unfurl_links: false,
        unfurl_media: false
      })
    });
    return await r.json();
  };
  let pb = await doPost();
  if (!pb.ok && pb.error === 'not_in_channel') {
    const j = await fetch('https://slack.com/api/conversations.join', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channelId
      })
    });
    const jb = await j.json();
    if (jb.ok) pb = await doPost();
  }
  return pb;
}
async function log(dept, outcome, by) {
  try {
    await svc.from('change_log').insert({
      entity_type: 'slack_digest',
      entity_id: dept,
      field: 'delivery',
      old_value: null,
      new_value: outcome,
      changed_by: by
    });
  } catch (_) {}
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  let caller = await staffEmail(req);
  if (!caller) {
    try {
      const g = req.headers.get('x-wa-secret');
      if (g && g === await getSecret('WA_TRIGGER_SECRET')) caller = 'weekly digest cron';
    } catch (_) {}
  }
  if (!caller) return json({
    error: 'unauthorized'
  }, 401);
  const body = await req.json().catch(()=>({}));
  const action = String(body.action || 'run');
  const only = String(body.department || '');
  let token;
  try {
    token = await getSecret('SLACK_BOT_TOKEN');
  } catch (_) {
    return json({
      error: 'Slack is not configured'
    }, 500);
  }
  const { data: cfgRow } = await svc.from('app_config').select('value').eq('key', 'slack_digest').maybeSingle();
  let cfg = {};
  try {
    cfg = cfgRow?.value ? JSON.parse(String(cfgRow.value)) : {};
  } catch (_) {
    cfg = {};
  }
  const map = cfg.map && Object.keys(cfg.map).length ? cfg.map : DEFAULT_MAP;
  if (action === 'run' && cfg.enabled === false && caller === 'weekly digest cron') return json({
    outcome: 'disabled'
  });
  const depts = only ? [
    only
  ] : Object.keys(map);
  const results = {};
  for (const dept of depts){
    const chName = map[dept];
    if (!chName) {
      results[dept] = {
        outcome: 'no channel mapped'
      };
      continue;
    }
    const c = await composeDept(dept, token);
    if (!c) {
      results[dept] = {
        outcome: 'nothing to report'
      };
      continue;
    }
    if (action === 'preview') {
      results[dept] = {
        channel: chName,
        display: c.display,
        open: c.open,
        done_week: c.done_week
      };
      continue;
    }
    const chId = await channelIdByName(chName, token);
    if (!chId) {
      results[dept] = {
        outcome: 'channel #' + chName + ' not found'
      };
      await log(dept, 'failed: channel #' + chName + ' not found', caller);
      continue;
    }
    const pb = await post(token, chId, c.text);
    results[dept] = pb.ok ? {
      outcome: 'sent',
      channel: chName
    } : {
      outcome: 'failed',
      error: pb.error
    };
    await log(dept, pb.ok ? 'sent to #' + chName : 'failed: ' + (pb.error || 'unknown'), caller);
  }
  return json({
    action,
    results
  });
});
