// Welfare Avenue: checkin-post (v2, 25/09/26: channels + say, for the volunteering recap; v1 25/09/26)
// Steel: "Check in should send a message in Slack channel
// #check-in-out-wa and checking out should do the same with bullet points
// about what one has done. Allow voice to text to summarise what they've
// done; the AI makes it into bullet points and even suggests closing tasks."
// Actions (staff sign-in):
//   in        {checkin_id, focus?}          -> posts the check-in line, keeps the Slack ts
//   summarise {text}                        -> bullets + tasks worth closing, from the person's own words
//   out       {checkin_id, bullets[], close_task_ids[], skipped?}
//             -> closes the ticked tasks, saves the summary, posts the check-out line
//   channels  {}                            -> the channels the bot can see (name, id, member)
//   say       {channel, text}               -> post text to a named channel as the bot (joins a public one)
// The model call goes through the Hub router (task 'checkin'); Slack goes
// through the bot (chat.postMessage) into #check-in-out-wa.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CHANNEL = 'check-in-out-wa';
const SITE = 'https://wa-exec-dashboard.netlify.app';
const TZ = 'America/Toronto';
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
type Me = { email: string; name: string };
async function caller(req: Request): Promise<Me | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  if (!(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0] };
}
async function member(email: string): Promise<{ id: number; name: string; department: string | null } | null> {
  const { data } = await svc.from('team_members').select('id, name, department').ilike('email', email).maybeSingle();
  return (data as { id: number; name: string; department: string | null } | null) || null;
}

/* ---- Slack ---- */
let CHANNEL_ID: string | null = null;
async function slack(tok: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('https://slack.com/api/' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  return await res.json();
}
async function channelId(tok: string): Promise<string | null> {
  if (CHANNEL_ID) return CHANNEL_ID;
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
    const body = await res.json();
    // deno-lint-ignore no-explicit-any
    const hit = ((body.channels || []) as any[]).find(c => c.name === CHANNEL);
    if (hit) { CHANNEL_ID = String(hit.id); if (!hit.is_member) { try { await slack(tok, 'conversations.join', { channel: CHANNEL_ID }); } catch (_) { /* private: someone adds the bot */ } } return CHANNEL_ID; }
    cursor = body.response_metadata?.next_cursor || ''; if (!cursor) break;
  }
  return null;
}
async function slackUserId(email: string): Promise<string | null> {
  try { const { data } = await svc.from('wa_slack_ids').select('slack_id').ilike('email', email).maybeSingle(); return (data as { slack_id?: string } | null)?.slack_id || null; } catch (_) { return null; }
}
async function post(text: string, email: string): Promise<{ ts: string | null; error: string | null }> {
  try {
    const tok = await getSecret('SLACK_BOT_TOKEN');
    const ch = await channelId(tok);
    if (!ch) return { ts: null, error: 'channel #' + CHANNEL + ' not found' };
    const sid = await slackUserId(email);
    const out = await slack(tok, 'chat.postMessage', { channel: ch, text, unfurl_links: false, unfurl_media: false, ...(sid ? { } : {}) });
    if (!out.ok) return { ts: null, error: String(out.error || 'slack refused') };
    return { ts: String(out.ts || ''), error: null };
  } catch (e) { return { ts: null, error: String((e as Error).message || e).slice(0, 200) }; }
}
function clock(iso: string): string { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }); }
function hours(mins: number): string { const h = Math.floor(mins / 60), m = mins % 60; return (h ? h + 'h ' : '') + (m || !h ? m + 'm' : ''); }
function mention(name: string, sid: string | null): string { return sid ? '<@' + sid + '>' : '*' + name + '*'; }

/* ---- the summary ---- */
type Task = { id: number; title: string; owner: string | null; department: string | null; subsection: string | null; due_date: string | null; project_id: number | null };
async function myTasks(m: { id: number; name: string; department: string | null } | null, fallbackName: string): Promise<Task[]> {
  const name = (m ? m.name : fallbackName) || '';
  const first = name.split(' ')[0];
  if (!first) return [];
  const { data } = await svc.from('dept_tasks').select('id, title, owner, department, subsection, due_date, project_id').eq('done', false).or('owner.ilike.%' + first.replace(/[%,]/g, '') + '%' + (m && m.department ? ',department.eq.' + m.department : '')).order('updated_at', { ascending: false }).limit(60);
  const rows = (data || []) as Task[];
  /* the person's own first, then their team's */
  const own = rows.filter(t => (t.owner || '').toLowerCase().includes(first.toLowerCase()));
  const team = rows.filter(t => !own.includes(t));
  return own.concat(team).slice(0, 40);
}
const TOOL = {
  name: 'checkout_summary',
  description: 'Turn what the person said into a short check-out summary.',
  input_schema: {
    type: 'object',
    properties: {
      bullets: { type: 'array', items: { type: 'string' }, description: '2 to 6 bullet points, each under 18 words, past tense, first person implied (no "I"), concrete. Keep their facts; do not add any.' },
      close: { type: 'array', items: { type: 'object', properties: { task_id: { type: 'integer' }, why: { type: 'string', description: 'The words of theirs that show it is finished, under 15 words' } }, required: ['task_id', 'why'] }, description: 'Open tasks their words show are finished. Only ids from the list. Progress or "almost" is not finished.' },
    },
    required: ['bullets', 'close'],
  },
};
async function summarise(text: string, m: { id: number; name: string; department: string | null } | null, fallbackName: string): Promise<{ bullets: string[]; suggest: Array<{ id: number; title: string; why: string }>; tasks: Task[] }> {
  const tasks = await myTasks(m, fallbackName);
  const list = tasks.map(t => t.id + ': ' + t.title + (t.owner ? ' (owner ' + t.owner + ')' : '')).join('\n') || 'none';
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'checkin', 'x-wa-caller': 'checkin-post', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 700, temperature: 0.2,
      system: 'You tidy a Welfare Avenue staff member’s end-of-day note into bullet points for the team’s Slack channel. Plain words, their facts only, no em dashes, no praise, no filler. Spoken text may have transcription slips: fix obvious ones, never invent.',
      messages: [{ role: 'user', content: 'PERSON: ' + (m ? m.name : fallbackName) + (m && m.department ? ' (' + m.department + ')' : '') + '\n\nTHEIR OPEN TASKS (id: title):\n' + list + '\n\nWHAT THEY SAID:\n' + text.slice(0, 6000) }],
      tools: [TOOL], tool_choice: { type: 'tool', name: 'checkout_summary' },
    }),
  });
  if (!res.ok) throw new Error('the model did not answer (' + res.status + ')');
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const tu = (body.content || []).find((c: any) => c.type === 'tool_use');
  const input = (tu && tu.input) || {};
  const bullets = (Array.isArray(input.bullets) ? input.bullets : []).map((b: unknown) => String(b).replace(/—/g, ',').replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean).slice(0, 8);
  const ids = new Set(tasks.map(t => t.id));
  const suggest = (Array.isArray(input.close) ? input.close : []).filter((c: { task_id?: unknown }) => ids.has(Number(c.task_id))).map((c: { task_id: number; why?: string }) => { const t = tasks.find(x => x.id === Number(c.task_id))!; return { id: t.id, title: t.title, why: String(c.why || '').slice(0, 120) }; }).slice(0, 6);
  return { bullets: bullets.length ? bullets : [text.trim().slice(0, 200)], suggest, tasks };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  let me = await caller(req);
  if (!me && typeof body.as_email === 'string') {
    /* the build can act as a person with the trigger secret (tests) */
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) me = { email: String(body.as_email).toLowerCase(), name: String(body.as_name || body.as_email) }; } catch (_) { /* no */ }
  }
  if (!me) return json({ error: 'unauthorized' }, 401);
  const action = String(body.action || '');
  const m = await member(me.email);
  const name = (m && m.name) || me.name;
  try {
    if (action === 'in') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, started_at, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'check-in not found' }, 404);
      const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 300) : '';
      const sid = await slackUserId(me.email);
      const text = ':large_green_circle: ' + mention(name, sid) + ' checked in · ' + clock(row.started_at) + (focus ? '\n_Today:_ ' + focus : '');
      const r = await post(text, me.email);
      await svc.from('hub_checkins').update({ slack_ts: r.ts, focus: focus || null }).eq('id', id);
      return json({ ok: true, posted: !!r.ts, error: r.error });
    }
    if (action === 'summarise') {
      const text = String(body.text || '').trim();
      if (text.length < 3) return json({ error: 'Say or type what you got done first.' }, 400);
      const out = await summarise(text, m, name);
      return json({ ok: true, bullets: out.bullets, suggest: out.suggest, open_tasks: out.tasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, owner: t.owner })) });
    }
    if (action === 'out') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, started_at, ended_at, minutes, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'check-in not found' }, 404);
      const bullets = (Array.isArray(body.bullets) ? body.bullets : []).map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 8);
      const closeIds = (Array.isArray(body.close_task_ids) ? body.close_task_ids : []).map(Number).filter((n: number) => n > 0).slice(0, 10);
      const endIso = row.ended_at || new Date().toISOString();
      const mins = row.minutes || Math.max(1, Math.round((new Date(endIso).getTime() - new Date(row.started_at).getTime()) / 60000));
      if (!row.ended_at) await svc.from('hub_checkins').update({ ended_at: endIso, minutes: mins }).eq('id', id);
      const closed: string[] = [];
      for (const tid of closeIds) {
        const { data: t } = await svc.from('dept_tasks').select('id, title, done').eq('id', tid).maybeSingle();
        if (!t || t.done) continue;
        const now = new Date().toISOString();
        const up = await svc.from('dept_tasks').update({ done: true, closed_at: now, updated_at: now, updated_by: name }).eq('id', tid);
        if (up.error) continue;
        closed.push(String(t.title));
        try { await svc.from('change_log').insert({ entity_type: 'task', entity_id: String(tid), field: 'done', old_value: 'false', new_value: 'true (closed at check-out)', changed_by: name }); } catch (_) { /* audit */ }
      }
      const sid = await slackUserId(me.email);
      let text = ':white_circle: ' + mention(name, sid) + ' checked out · ' + clock(endIso) + ' · ' + hours(mins);
      if (bullets.length) text += '\n' + bullets.map(b => '• ' + b).join('\n');
      if (closed.length) text += '\n:white_check_mark: Closed: ' + closed.map(c => c.length > 70 ? c.slice(0, 67) + '…' : c).join(', ');
      const r = await post(text, me.email);
      await svc.from('hub_checkins').update({ slack_out_ts: r.ts, summary: bullets.length ? { bullets, closed: closeIds, skipped: body.skipped === true } : null, closed_task_ids: closeIds.length ? closeIds : null }).eq('id', id);
      return json({ ok: true, posted: !!r.ts, error: r.error, closed, minutes: mins });
    }
    if (action === 'channels') {
      const tok = await getSecret('SLACK_BOT_TOKEN');
      const out: Array<{ id: string; name: string; member: boolean; private: boolean }> = [];
      let cursor = '';
      for (let i = 0; i < 10; i++) {
        const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
        const b = await res.json();
        // deno-lint-ignore no-explicit-any
        for (const c of ((b.channels || []) as any[])) out.push({ id: String(c.id), name: String(c.name), member: !!c.is_member, private: !!c.is_private });
        cursor = b.response_metadata?.next_cursor || ''; if (!cursor) break;
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      return json({ ok: true, channels: out });
    }
    if (action === 'say') {
      const want = String(body.channel || '').replace(/^#/, '').trim();
      const text = String(body.text || '').trim().slice(0, 3000);
      if (!want || !text) return json({ error: 'channel and text' }, 400);
      const tok = await getSecret('SLACK_BOT_TOKEN');
      let chId: string | null = null; let isMember = false;
      let cursor = '';
      for (let i = 0; i < 10 && !chId; i++) {
        const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
        const b = await res.json();
        // deno-lint-ignore no-explicit-any
        const hit = ((b.channels || []) as any[]).find(c => c.name === want || c.id === want);
        if (hit) { chId = String(hit.id); isMember = !!hit.is_member; }
        cursor = b.response_metadata?.next_cursor || ''; if (!cursor) break;
      }
      if (!chId) return json({ error: 'channel #' + want + ' not found (the bot can only see channels it is allowed to see)' }, 404);
      if (!isMember) { const j = await slack(tok, 'conversations.join', { channel: chId }); if (!j.ok) return json({ error: 'the bot is not in #' + want + ' (' + String(j.error || 'join failed') + '); add it from the channel' }, 400); }
      const out = await slack(tok, 'chat.postMessage', { channel: chId, text: text + '\n_posted from the hub by ' + name + '_', unfurl_links: false, unfurl_media: false });
      if (!out.ok) return json({ error: String(out.error || 'slack refused') }, 400);
      return json({ ok: true, ts: String(out.ts || ''), channel: chId });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
});
