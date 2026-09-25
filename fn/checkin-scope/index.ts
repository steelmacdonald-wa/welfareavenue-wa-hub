// Routed through the Hub model router (llm, task 'checkin') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: checkin-scope (v2, 07/08/26)
// v2 (Steel): there are FIVE #check-in-out-* channels, one per
// department. Reads EVERY channel whose name starts with 'check-in-out'
// (last 30 days), auto-joining public ones the bot is not in yet, and
// builds one per-person 'scope of work' summary across all of them,
// with the channels each person checked into. Results land in
// wa_checkin_scope (staff-readable), shown in the Hub's HR centre.
// Auth: x-wa-secret (Monday cron) or staff JWT (HR centre Refresh).
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CHANNEL_PREFIX = 'check-in-out';
const WINDOW_DAYS = 30;
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
async function slackApi(token, method, params, post) {
  if (post) {
    const res = await fetch('https://slack.com/api/' + method, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(post)
    });
    return await res.json();
  }
  const qs = new URLSearchParams(params).toString();
  const res = await fetch('https://slack.com/api/' + method + (qs ? '?' + qs : ''), {
    headers: {
      Authorization: 'Bearer ' + token
    }
  });
  return await res.json();
}
const SYSTEM = `You summarise volunteer and staff check-in messages for the HR team of Welfare Avenue, a charity. For each person you receive their raw check-in/check-out messages from the last 30 days, drawn from per-department check-in channels. Write, per person, a 2-4 sentence factual summary of the SCOPE of their work: what kinds of tasks they worked on, for which department or area (the channel name hints at it), any patterns (regular shifts, one-off help), and anything HR should know (blockers mentioned, equipment issues). Plain text. Never use em dashes: use commas, colons, or parentheses. Never speculate about performance, attitude, or hours worked beyond what the messages state. Never invent content.`;
const TOOL = {
  name: 'write_scopes',
  description: 'Return one scope summary per person.',
  input_schema: {
    type: 'object',
    properties: {
      people: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slack_id: {
              type: 'string'
            },
            summary: {
              type: 'string'
            }
          },
          required: [
            'slack_id',
            'summary'
          ]
        }
      }
    },
    required: [
      'people'
    ]
  }
};
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
async function summarise(blocks) {
  const key = 'hub-router';
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'checkin',
        'x-wa-caller': 'checkin-scope',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        temperature: 0.1,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: blocks.slice(0, 60000)
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'write_scopes'
        }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input?.people) return tu.input.people;
      lastErr = 'no tool_use';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 150);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('summarise failed: ' + lastErr);
}
async function run(who) {
  const token = await getSecret('SLACK_BOT_TOKEN');
  /* every check-in-out channel; join public ones we are not in yet */ const chans = [];
  let cursor = '';
  for(let p = 0; p < 3; p++){
    const params = {
      types: 'public_channel,private_channel',
      limit: '200',
      exclude_archived: 'true'
    };
    if (cursor) params.cursor = cursor;
    const r = await slackApi(token, 'conversations.list', params);
    if (!r.ok) throw new Error('conversations.list: ' + r.error);
    for (const c of r.channels || []){
      if (String(c.name || '').indexOf(CHANNEL_PREFIX) === 0) {
        if (!c.is_member && !c.is_private) {
          try {
            await slackApi(token, 'conversations.join', {}, {
              channel: c.id
            });
          } catch (_) {}
        }
        chans.push({
          id: c.id,
          name: c.name
        });
      }
    }
    cursor = r.response_metadata?.next_cursor || '';
    if (!cursor) break;
  }
  if (!chans.length) throw new Error('no ' + CHANNEL_PREFIX + '* channels found');
  /* pull history from every channel */ const oldest = ((Date.now() - WINDOW_DAYS * 86400000) / 1000).toFixed(0);
  const msgs = [];
  const unreadable = [];
  for (const ch of chans){
    cursor = '';
    let got = false;
    for(let p = 0; p < 5; p++){
      const params = {
        channel: ch.id,
        oldest,
        limit: '200'
      };
      if (cursor) params.cursor = cursor;
      const r = await slackApi(token, 'conversations.history', params);
      if (!r.ok) {
        if (!got) unreadable.push('#' + ch.name + ' (' + (r.error || 'error') + ')');
        break;
      }
      got = true;
      for (const m of r.messages || []){
        m.channel = ch.name;
        msgs.push(m);
      }
      cursor = r.response_metadata?.next_cursor || '';
      if (!cursor) break;
    }
  }
  /* names */ const users = {};
  cursor = '';
  for(let p = 0; p < 5; p++){
    const params = {
      limit: '200'
    };
    if (cursor) params.cursor = cursor;
    const r = await slackApi(token, 'users.list', params);
    if (!r.ok) break;
    for (const u of r.members || []){
      users[u.id] = u.profile?.real_name || u.real_name || u.profile?.display_name || u.name || 'user';
    }
    cursor = r.response_metadata?.next_cursor || '';
    if (!cursor) break;
  }
  /* group by person across channels */ const byUser = {};
  for (const m of msgs){
    if (m.bot_id || m.subtype || !m.user || !m.text || m.text.trim().length < 3) continue;
    const day = new Date(parseFloat(m.ts) * 1000).toISOString().slice(0, 10);
    const rec = byUser[m.user] = byUser[m.user] || {
      texts: [],
      days: new Set(),
      chans: new Set(),
      first: day,
      last: day
    };
    rec.texts.push('[' + day + ' #' + (m.channel || '?') + '] ' + m.text.replace(/\s+/g, ' ').trim().slice(0, 400));
    rec.days.add(day);
    rec.chans.add('#' + (m.channel || '?'));
    if (day < rec.first) rec.first = day;
    if (day > rec.last) rec.last = day;
  }
  const ids = Object.keys(byUser);
  if (!ids.length) return {
    people: 0,
    channels: chans.length,
    note: 'no check-in messages in the window',
    unreadable
  };
  const blocks = ids.map((id)=>'PERSON slack_id=' + id + ' name=' + (users[id] || 'unknown') + ' (' + byUser[id].texts.length + ' messages over ' + byUser[id].days.size + ' days in ' + [
      ...byUser[id].chans
    ].join(', ') + '):\n' + byUser[id].texts.slice(-40).join('\n')).join('\n\n');
  const scopes = await summarise(blocks);
  const summaryById = {};
  for (const s of scopes)summaryById[s.slack_id] = s.summary;
  await svc.from('wa_checkin_scope').delete().neq('slack_id', '');
  let saved = 0;
  for (const id of ids){
    const rec = byUser[id];
    const { error } = await svc.from('wa_checkin_scope').insert({
      slack_id: id,
      name: users[id] || 'unknown',
      msg_count: rec.texts.length,
      days_active: rec.days.size,
      first_seen: rec.first,
      last_seen: rec.last,
      summary: summaryById[id] || null,
      channels: [
        ...rec.chans
      ].sort().join(', '),
      window_days: WINDOW_DAYS,
      updated_at: new Date().toISOString()
    });
    if (!error) saved++;
  }
  try {
    await svc.from('change_log').insert({
      entity_type: 'checkin_scope',
      entity_id: CHANNEL_PREFIX + '-*',
      field: 'ran',
      old_value: null,
      new_value: saved + ' people from ' + msgs.length + ' messages across ' + chans.length + ' channels (' + WINDOW_DAYS + 'd)' + (unreadable.length ? '; unreadable: ' + unreadable.join(', ') : ''),
      changed_by: who
    });
  } catch (_) {}
  return {
    people: saved,
    messages: msgs.length,
    channels: chans.map((c)=>c.name),
    unreadable
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  let caller = await staffEmail(req);
  if (!caller) {
    try {
      const g = req.headers.get('x-wa-secret');
      if (g && g === await getSecret('WA_TRIGGER_SECRET')) caller = 'weekly cron';
    } catch (_) {}
  }
  if (!caller) return json({
    error: 'unauthorized'
  }, 401);
  try {
    const out = await run(caller);
    return json(out);
  } catch (e) {
    return json({
      error: String(e).slice(0, 300)
    }, 500);
  }
});
