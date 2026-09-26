// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Welfare Avenue: project-slack (v5, 07/08/26)
// Posts a project summary into a Slack channel of the sender's choosing:
// project name hyperlinked to its Hub page at the top, then the open
// tasks grouped by person with real <@id> mentions.
// Auth: staff JWT, or x-wa-secret (WA_TRIGGER_SECRET) for automations.
// v5: SAFETY: tasks marked confidential, board_only, or with restricted
// visibility are excluded from Slack posts (Slack is broadcast; the Hub
// enforces per-person visibility, a channel cannot).
// v4 (scopes granted 07/08/26): posts as 'Welfare Avenue Hub'
// (chat:write.customize), PUBLIC channels auto-joined on not_in_channel
// (channels:join) with one retry; private channels still need an invite.
// Actions:
//   {action:'channels'}                       -> list channels the bot can see
//   {action:'preview', project_id, note?}     -> composed text + mention coverage
//   {action:'send', project_id, channel_id, channel_name?, note?} -> chat.postMessage
// Mention resolution: wa_slack_names cache (Ian PINNED U0A7DF871FS) ->
// users.list exact-name match -> unique first-name match; unresolved
// names appear as plain text, listed in the preview. Sends change_logged.
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
  if (found) {
    await svc.from('wa_slack_names').upsert({
      name_norm: key,
      display_name: rawName,
      slack_id: found,
      source,
      updated_at: new Date().toISOString()
    });
  }
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
async function compose(projectId, note, sender, token) {
  const { data: p } = await svc.from('projects').select('id, name, department').eq('id', projectId).maybeSingle();
  if (!p) return {
    error: 'project not found'
  };
  const { data: td } = await svc.from('dept_tasks').select('id, title, department, owner, due_date, flag, confidential, board_only, visibility').is('banked_at', null).eq('project_id', p.id).eq('done', false).order('department').order('id');
  const rawTasks = td || [];
  const tasks = rawTasks.filter(visible);
  const held = rawTasks.length - tasks.length;
  const groups = {};
  const orphans = [];
  for (const t of tasks){
    const o = (t.owner || '').trim();
    if (!o) {
      orphans.push(t);
      continue;
    }
    (groups[o] = groups[o] || []).push(t);
  }
  const mention = new Map();
  for (const owner of Object.keys(groups)){
    for (const person of splitOwner(owner)){
      if (!mention.has(person)) mention.set(person, await resolveName(person, token));
    }
  }
  const unresolved = [
    ...mention.entries()
  ].filter(([, id])=>!id).map(([n])=>n);
  const ownerHead = (owner)=>splitOwner(owner).map((pn)=>{
      const id = mention.get(pn);
      return id ? '<@' + id + '>' : '*' + pn + '*';
    }).join(' + ');
  const taskLine = (t)=>{
    let line = '• ' + String(t.title || '').trim();
    if (t.due_date) line += ' (due ' + t.due_date + ')';
    if (t.department && t.department !== p.department) line += '  _' + (DEPT_LABEL[t.department] || t.department) + '_';
    if (t.flag) line += '  :triangular_flag_on_post:';
    return line;
  };
  const sorted = Object.keys(groups).sort((a, b)=>groups[b].length - groups[a].length || a.localeCompare(b));
  let text = ':clipboard: *<' + SITE + '#project/' + p.id + '|' + String(p.name).replace(/[<>|&]/g, ' ').trim() + '>*';
  if (note) text += '\n' + note.slice(0, 600);
  text += '\n\n*Open tasks (' + tasks.length + ')*';
  for (const owner of sorted){
    text += '\n\n' + ownerHead(owner) + '\n' + groups[owner].map(taskLine).join('\n');
  }
  if (orphans.length) text += '\n\n*Unassigned*\n' + orphans.map(taskLine).join('\n');
  if (held) text += '\n\n_' + held + ' task' + (held === 1 ? '' : 's') + ' with restricted visibility stay on the Hub._';
  text += '\n\n_Sent from the <' + SITE + '#project/' + p.id + '|Welfare Avenue Hub> by ' + sender + '_';
  if (text.length > 11500) text = text.slice(0, 11400) + '\n_…trimmed; the full list lives on the Hub page linked above._';
  const idToName = {};
  for (const [pn, id] of mention.entries())if (id) idToName[id] = pn;
  const display = text.replace(/<@([A-Z0-9]+)>/g, (_m, id)=>'@' + (idToName[id] || id)).replace(/<([^|>]+)\|([^>]+)>/g, '$2').replace(/:clipboard:/g, '📋').replace(/:triangular_flag_on_post:/g, '🚩');
  return {
    text,
    text_display: display,
    unresolved,
    task_count: tasks.length,
    project_name: p.name
  };
}
async function log(projectId, sender, outcome) {
  try {
    await svc.from('change_log').insert({
      entity_type: 'slack_project_post',
      entity_id: String(projectId),
      field: 'delivery',
      old_value: null,
      new_value: outcome,
      changed_by: sender
    });
  } catch (_) {}
}
async function postMessage(token, channelId, text) {
  const post = await fetch('https://slack.com/api/chat.postMessage', {
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
  return await post.json();
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  let sender = await staffEmail(req);
  if (!sender) {
    try {
      const given = req.headers.get('x-wa-secret');
      if (given && given === await getSecret('WA_TRIGGER_SECRET')) sender = 'automation';
    } catch (_) {}
  }
  if (!sender) return json({
    error: 'unauthorized'
  }, 401);
  const body = await req.json().catch(()=>({}));
  const action = String(body.action || '');
  let token;
  try {
    token = await getSecret('SLACK_BOT_TOKEN');
  } catch (_) {
    return json({
      error: 'Slack is not configured'
    }, 500);
  }
  if (action === 'channels') {
    const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200', {
      headers: {
        Authorization: 'Bearer ' + token
      }
    });
    const b = await res.json();
    if (!b.ok) return json({
      error: 'Slack said: ' + (b.error || 'unknown')
    }, 502);
    const channels = (b.channels || []).map((c)=>({
        id: c.id,
        name: c.name,
        is_private: !!c.is_private,
        is_member: !!c.is_member
      })).sort((a, z)=>(z.is_member ? 1 : 0) - (a.is_member ? 1 : 0) || a.name.localeCompare(z.name));
    return json({
      channels
    });
  }
  const projectId = Number(body.project_id);
  if (!projectId) return json({
    error: 'project_id required'
  }, 400);
  const note = String(body.note || '').trim();
  if (action === 'preview') {
    const c = await compose(projectId, note, sender, token);
    return json(c, c.error ? 400 : 200);
  }
  if (action === 'send') {
    const channelId = String(body.channel_id || '');
    const channelName = String(body.channel_name || channelId);
    if (!channelId) return json({
      error: 'channel_id required'
    }, 400);
    const c = await compose(projectId, note, sender, token);
    if (c.error) return json(c, 400);
    const text = c.text;
    let pb = await postMessage(token, channelId, text);
    if (!pb.ok && pb.error === 'not_in_channel') {
      const joined = await fetch('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: channelId
        })
      });
      const jb = await joined.json();
      if (jb.ok) {
        pb = await postMessage(token, channelId, text);
      } else {
        await log(projectId, sender, 'failed: bot cannot join #' + channelName + ' (' + (jb.error || 'unknown') + ')');
        return json({
          outcome: 'not_in_channel',
          error: 'That looks like a private channel. In Slack, open #' + channelName + ' and invite @wa_hub, then send again.'
        });
      }
    }
    if (pb.ok) {
      await log(projectId, sender, 'sent to #' + channelName);
      return json({
        outcome: 'sent',
        channel: channelName
      });
    }
    if (pb.error === 'missing_scope' || pb.error === 'not_allowed_token_type') {
      try {
        const url = await getSecret('SLACK_WEBHOOK_URL');
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text
          })
        });
        if (r.ok) {
          await log(projectId, sender, 'sent via webhook channel (chat:write not granted; wanted #' + channelName + ')');
          return json({
            outcome: 'sent_webhook',
            error: null,
            note: 'Posted to the Hub notifications channel instead: the Slack app does not have the chat:write permission, so it cannot post into chosen channels.'
          });
        }
      } catch (_) {}
      await log(projectId, sender, 'failed: no chat:write and webhook failed');
      return json({
        outcome: 'failed',
        error: 'The Slack app cannot post yet (chat:write permission missing) and the fallback channel also failed.'
      });
    }
    await log(projectId, sender, 'failed: ' + (pb.error || 'unknown'));
    return json({
      outcome: 'failed',
      error: 'Slack said: ' + (pb.error || 'unknown')
    });
  }
  return json({
    error: 'unknown action'
  }, 400);
});
