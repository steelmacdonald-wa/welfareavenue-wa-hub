// Welfare Avenue: slack-pull (v4)
// v4: DM conversations are paginated (Slack lists them by creation date, not
// activity), sorted by last activity, and only active ones are read.
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
const DEPT_LABEL: Record<string, string> = { opsmtl: 'Ops Montreal', opsto: 'Ops Toronto', marketing: 'Marketing', fundraising: 'Fundraising and Grants', hr: 'Human Resources', board: 'Board and Governance' };

async function getSecret(name: string): Promise<string | null> {
  const { data } = await svc.rpc('get_secret', { secret_name: name });
  return (data as string) || null;
}
async function authorize(req: Request): Promise<{ ok: boolean; who: string }> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return { ok: true, who: 'weekly schedule' };
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (email.endsWith('@welfareavenue.com')) return { ok: true, who: email.split('@')[0] };
  }
  return { ok: false, who: '' };
}
async function siteUrl(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return data?.value || 'https://wa-exec-dashboard.netlify.app';
}
async function postSlack(text: string) {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    if (!url) return;
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch (e) { console.error('slack post failed', e); }
}
async function slackApi(token: string, method: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch('https://slack.com/api/' + method + (qs ? '?' + qs : ''), { headers: { Authorization: 'Bearer ' + token } });
  return await res.json();
}
async function listChannels(tokens: Array<string | null>): Promise<Array<{ id: string; name: string }>> {
  const seen: Record<string, { id: string; name: string }> = {};
  for (const tk of tokens) {
    if (!tk) continue;
    let cursor = '';
    for (let p = 0; p < 3; p++) {
      const params: Record<string, string> = { types: 'public_channel,private_channel', limit: '200', exclude_archived: 'true' };
      if (cursor) params.cursor = cursor;
      const r = await slackApi(tk, 'conversations.list', params);
      if (!r.ok) break;
      for (const c of (r.channels || []) as Array<{ id: string; name: string }>) seen[c.id] = { id: c.id, name: c.name };
      cursor = (r.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || '';
      if (!cursor) break;
    }
  }
  return Object.values(seen);
}
async function listDMs(token: string): Promise<{ convs: Array<{ id: string; user?: string; is_im?: boolean; updated?: number }>; error: string }> {
  const convs: Array<{ id: string; user?: string; is_im?: boolean; updated?: number }> = [];
  let cursor = '';
  for (let p = 0; p < 6; p++) {
    const params: Record<string, string> = { types: 'im,mpim', limit: '200' };
    if (cursor) params.cursor = cursor;
    const r = await slackApi(token, 'conversations.list', params);
    if (!r.ok) return { convs, error: String(r.error || 'error') };
    for (const c of (r.channels || []) as Array<{ id: string; user?: string; is_im?: boolean; updated?: number }>) convs.push(c);
    cursor = (r.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || '';
    if (!cursor) break;
  }
  return { convs, error: '' };
}
async function userDirectory(token: string): Promise<Record<string, string>> {
  const users: Record<string, string> = {};
  let cursor = '';
  for (let p = 0; p < 6; p++) {
    const params: Record<string, string> = { limit: '200' };
    if (cursor) params.cursor = cursor;
    const r = await slackApi(token, 'users.list', params);
    if (!r.ok) break;
    ((r.members || []) as Array<{ id: string; profile?: { display_name?: string; real_name?: string }; real_name?: string }>).forEach(u => {
      users[u.id] = u.profile?.real_name || u.profile?.display_name || u.real_name || 'user';
    });
    cursor = (r.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || '';
    if (!cursor) break;
  }
  return users;
}

function fmtTs(ts: string): string {
  const d = new Date(parseFloat(ts) * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
}
function cleanText(t: string, users: Record<string, string>): string {
  return (t || '')
    .replace(/<@([A-Z0-9]+)>/g, (_m, id) => '@' + (users[id] || 'user'))
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/\s+/g, ' ').trim();
}
type Msg = { ts: string; user?: string; bot_id?: string; subtype?: string; text?: string; reply_count?: number; latest_reply?: string };
function renderMsgs(msgs: Msg[], users: Record<string, string>): string[] {
  return msgs
    .filter(m => !m.bot_id && !m.subtype && m.text && m.text.trim().length > 2)
    .map(m => '[' + fmtTs(m.ts) + '] ' + (users[m.user || ''] || 'Someone') + ': ' + cleanText(m.text || '', users));
}

const ROUTER_SYSTEM = `You prepare executive intelligence for Welfare Avenue, a charity run by co executive directors Steel and Suhaib. You receive recent Slack messages from team channels and from Steel's direct messages. Produce zero to six per department digests, plus a team pulse reading per department.

Rules:
1. Never use em dashes anywhere. Use commas, colons, or parentheses.
2. Digests include only work relevant content: progress, blockers, decisions made or needed, dates, money and budget mentions, partnerships, staffing and people changes, risks. Ignore greetings, scheduling chatter with no outcome, and social talk.
3. Route each item to the best department using the channel routing hints; content from unrouted channels and DMs goes wherever it belongs. Departments: opsmtl (Ops and Program Dev Montreal), opsto (Ops and Program Dev Toronto), marketing, fundraising (includes grants and donors), hr, board.
4. Digest format: short dated lines, newest first, each line stating who said or decided what, for example "Jul 1: Amanda confirmed Scotiabank will send 8 volunteers for Flag Football." Group related lines. Plain text only.
5. Content that came from direct messages: include work items only, never personal or private life content, and start those lines with [from DM].
6. Only produce a digest for a department when there is meaningful content for it. Set includes_dm true on a digest if any of its lines came from DMs.
7. title format: Slack digest: <Department label> (<date range>).
8. summary: one line describing the pull overall, under 25 words.
9. sentiment: one entry per department that had channel activity. Judge ONLY from channel messages, never from DMs. Score 1 to 10 against this rubric: 1 to 3 strained (frustration, conflict, burnout signals), 4 to 6 mixed or tired (friction, flat replies, stalled threads), 7 to 8 positive and steady (responsive, cooperative, progress energy), 9 to 10 energized (wins celebrated, high engagement, momentum). note: one short line of evidence. confidence: low when fewer than 10 relevant messages, medium under 30, high otherwise. Judge the team mood, never name or score individuals.`;

const ROUTER_TOOL = {
  name: 'route_slack_digest',
  description: 'Return the per department digests and team pulse built from the Slack content.',
  input_schema: {
    type: 'object',
    properties: {
      digests: { type: 'array', items: { type: 'object', properties: {
        department: { type: 'string', enum: ['opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'board'] },
        title: { type: 'string' },
        body: { type: 'string' },
        includes_dm: { type: 'boolean' }
      }, required: ['department', 'title', 'body', 'includes_dm'] } },
      sentiment: { type: 'array', items: { type: 'object', properties: {
        department: { type: 'string', enum: ['opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'board'] },
        score: { type: 'integer', minimum: 1, maximum: 10 },
        note: { type: 'string' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
      }, required: ['department', 'score', 'note', 'confidence'] } },
      summary: { type: 'string' }
    },
    required: ['digests', 'sentiment', 'summary']
  }
};
const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-sonnet-4-20250514'];

async function routeWithAI(content: string, hints: string): Promise<{ digests: Array<{ department: string; title: string; body: string; includes_dm: boolean }>; sentiment: Array<{ department: string; score: number; note: string; confidence: string }>; summary: string }> {
  const key = await getSecret('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 4500, temperature: 0.2, system: ROUTER_SYSTEM,
        messages: [{ role: 'user', content: 'CHANNEL ROUTING HINTS:\n' + hints + '\n\nSLACK CONTENT:\n' + content.slice(0, 60000) }],
        tools: [ROUTER_TOOL], tool_choice: { type: 'tool', name: 'route_slack_digest' }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c: { type: string }) => c.type === 'tool_use');
      if (tu?.input) return tu.input;
      lastErr = 'no tool_use returned';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('router call failed: ' + lastErr);
}

async function runPull(who: string) {
  const botToken = await getSecret('SLACK_BOT_TOKEN');
  const userToken = await getSecret('SLACK_USER_TOKEN');
  const channelToken = botToken || userToken;
  if (!channelToken) { console.warn('slack-pull: no tokens configured'); return; }

  const { data: lastRow } = await svc.from('app_config').select('value').eq('key', 'slack_last_pull').maybeSingle();
  const now = Date.now();
  let sinceMs = now - 7 * 86400000;
  if (lastRow?.value) {
    const last = new Date(lastRow.value).getTime();
    if (!isNaN(last)) sinceMs = Math.min(Math.max(last, now - 14 * 86400000), now - 60000);
  }
  const oldest = (sinceMs / 1000).toFixed(0);
  const rangeLabel = new Date(sinceMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' to ' + new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const { data: sources } = await svc.from('slack_sources').select('*').eq('enabled', true);
  const wanted: Record<string, string | null> = {};
  (sources || []).forEach((s: { name: string; department: string | null }) => { wanted[s.name.toLowerCase()] = s.department; });

  const users = await userDirectory(channelToken);
  const blocks: string[] = [];
  let channelsRead = 0, dmsRead = 0, totalChars = 0;
  const missing: string[] = [];

  try {
    const chans = await listChannels([botToken, userToken]);
    const found = new Set<string>();
    for (const ch of chans) {
      const key = (ch.name || '').toLowerCase();
      if (!(key in wanted)) continue;
      found.add(key);
      let hist = await slackApi(channelToken, 'conversations.history', { channel: ch.id, oldest, limit: '200' });
      if (!hist.ok && userToken && channelToken !== userToken) {
        hist = await slackApi(userToken, 'conversations.history', { channel: ch.id, oldest, limit: '200' });
      }
      if (!hist.ok) { missing.push('#' + ch.name + ' (' + (hist.error || 'error') + ')'); continue; }
      const msgs = ((hist.messages || []) as Msg[]).reverse();
      const lines = renderMsgs(msgs, users);
      const threaded = msgs.filter(m => (m.reply_count || 0) > 0 && m.latest_reply && parseFloat(m.latest_reply) >= parseFloat(oldest)).slice(-3);
      for (const tm of threaded) {
        try {
          let reps = await slackApi(channelToken, 'conversations.replies', { channel: ch.id, ts: tm.ts, oldest, limit: '10' });
          if (!reps.ok && userToken && channelToken !== userToken) reps = await slackApi(userToken, 'conversations.replies', { channel: ch.id, ts: tm.ts, oldest, limit: '10' });
          if (reps.ok) {
            const rlines = renderMsgs(((reps.messages || []) as Msg[]).slice(1), users);
            if (rlines.length) lines.push('(thread) ' + rlines.join('\n(thread) '));
          }
        } catch (_) { /* skip thread */ }
      }
      if (!lines.length) continue;
      const hint = wanted[key] ? ' (routing hint: ' + wanted[key] + ')' : ' (routing hint: none, route by content)';
      let block = '#' + ch.name + hint + ':\n' + lines.join('\n');
      if (block.length > 7000) block = block.slice(-7000);
      if (totalChars + block.length > 58000) break;
      blocks.push(block); totalChars += block.length; channelsRead++;
    }
    Object.keys(wanted).forEach(k => { if (!found.has(k)) missing.push('#' + k + ' (not visible to the tokens)'); });
  } catch (e) { console.warn('channel read failed', e); }

  if (userToken) {
    try {
      const dms = await listDMs(userToken);
      if (dms.error) missing.push('DMs (' + dms.error + ')');
      const recent = dms.convs
        .filter(c => (c.updated || 0) >= sinceMs)
        .sort((a, b) => (b.updated || 0) - (a.updated || 0))
        .slice(0, 30);
      for (const im of recent) {
        if (dmsRead >= 20 || totalChars > 56000) break;
        const hist = await slackApi(userToken, 'conversations.history', { channel: im.id, oldest, limit: '100' });
        if (!hist.ok) continue;
        const msgs = ((hist.messages || []) as Msg[]).reverse();
        const lines = renderMsgs(msgs, users);
        if (!lines.length) continue;
        const label = im.is_im ? 'DM with ' + (users[im.user || ''] || 'teammate') : 'Group DM';
        let block = label + ' (private, work items only, excluded from sentiment):\n' + lines.join('\n');
        if (block.length > 5000) block = block.slice(-5000);
        if (totalChars + block.length > 60000) break;
        blocks.push(block); totalChars += block.length; dmsRead++;
      }
    } catch (e) { console.warn('dm read failed', e); }
  }

  if (!blocks.length) {
    await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\nSlack pull ran (' + rangeLabel + '): no new work relevant messages found.' + (missing.length ? '\nNot readable: ' + missing.join(', ') + '.' : ''));
    await svc.from('app_config').update({ value: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('key', 'slack_last_pull');
    return;
  }

  const hints = (sources || []).map((s: { name: string; department: string | null }) => '#' + s.name + ' -> ' + (s.department || 'route by content')).join('\n');
  const routed = await routeWithAI('Window: ' + rangeLabel + '\n\n' + blocks.join('\n\n'), hints);

  let inserted = 0;
  for (const d of routed.digests || []) {
    if (!DEPT_LABEL[d.department] || !d.body || d.body.trim().length < 20) continue;
    const dmHeader = d.includes_dm
      ? 'Note for processing: parts of this digest come from private direct messages. Mark any task or decision derived from lines tagged [from DM] as confidential unless it is clearly public knowledge.\n\n'
      : '';
    const { error } = await svc.from('transcripts').insert({
      department: d.department,
      meeting_date: new Date().toISOString().slice(0, 10),
      title: d.title || ('Slack digest: ' + DEPT_LABEL[d.department] + ' (' + rangeLabel + ')'),
      body: dmHeader + d.body,
      added_by: 'Slack pull (' + who + ')',
      source_url: 'https://welfareavenue.slack.com',
      created_at: new Date().toISOString()
    });
    if (!error) inserted++;
  }

  let pulses = 0;
  for (const s of routed.sentiment || []) {
    if (!DEPT_LABEL[s.department] || !s.score) continue;
    const { error } = await svc.from('dept_sentiment').upsert({
      department: s.department, captured_on: new Date().toISOString().slice(0, 10),
      score: s.score, note: (s.note || '').slice(0, 300), confidence: s.confidence || 'low'
    });
    if (!error) pulses++;
  }

  await svc.from('app_config').update({ value: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('key', 'slack_last_pull');
  await svc.from('change_log').insert({
    entity_type: 'slack_pull', entity_id: rangeLabel, field: 'ran',
    old_value: null, new_value: channelsRead + ' channels, ' + dmsRead + ' DM threads, ' + inserted + ' digests, ' + pulses + ' pulse readings' + (missing.length ? '; not readable: ' + missing.join(', ') : ''),
    changed_by: 'Slack pull (' + who + ')'
  });
  const site = await siteUrl();
  await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\nSlack pull (' + rangeLabel + '): read ' + channelsRead + ' channels and ' + dmsRead + ' DM threads, created ' + inserted + ' department digest' + (inserted === 1 ? '' : 's') + ' and ' + pulses + ' team pulse reading' + (pulses === 1 ? '' : 's') + '. ' + (routed.summary || '') + (missing.length ? '\nNot readable: ' + missing.join(', ') + '.' : '') + '\n<' + site + '#transcripts|Open the archive>');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'unauthorized' }, 401);
  const botToken = await getSecret('SLACK_BOT_TOKEN');
  const userToken = await getSecret('SLACK_USER_TOKEN');
  if (!botToken && !userToken) return json({ error: 'tokens_missing' });
  const work = runPull(auth.who).catch(e => console.error('slack-pull failed', e));
  // @ts-ignore EdgeRuntime provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
  return json({ accepted: true }, 202);
});
