// Welfare Avenue: hours-pull (v5)
// v5: combined-line support. Messages like "in at 3, out - meeting" or
// "In at 6:30, out at 7:00 - Brand refresh meeting" previously only recorded
// the leading event and lost the session. Lines are now split on commas and
// each segment is classified. Mid-line plain in/out segments only count when
// followed by a delimiter (- : @ ! .), a time, now/again, or nothing, so
// phrases like "in the office tomorrow" are not events. Time parser also
// skips filler words (again, around).
// v4: smarter roster matching. Slack full names match short roster names by
// token: exact first, then all roster tokens appearing as words in the Slack
// name (unique), then unique first-name match.
// v3: line-based classification calibrated against real channel history.
// Sessions pair an in with the next out, up to 16 hours, America/Toronto.
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

async function getSecret(name: string): Promise<string | null> {
  const { data } = await svc.rpc('get_secret', { secret_name: name });
  return (data as string) || null;
}
async function authorize(req: Request): Promise<boolean> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return true;
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    if ((data?.user?.email || '').toLowerCase().endsWith('@welfareavenue.com')) return true;
  }
  return false;
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

/* ---- Toronto time helpers ---- */
function torontoParts(epochMs: number): { y: number; m: number; d: number; hh: number; mm: number; weekday: number } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const parts: Record<string, string> = {};
  f.formatToParts(new Date(epochMs)).forEach(p => { parts[p.type] = p.value; });
  const wdMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour, mm: +parts.minute, weekday: wdMap[parts.weekday] ?? 0 };
}
function torontoOffsetMs(epochMs: number): number {
  const p = torontoParts(epochMs);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  return asUtc - Math.floor(epochMs / 60000) * 60000;
}
function torontoTimeOnSameDay(refMs: number, hh: number, mm: number): number {
  const p = torontoParts(refMs);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, hh, mm);
  return asUtc - torontoOffsetMs(refMs);
}
function weekStartStr(epochMs: number): string {
  const p = torontoParts(epochMs);
  const dayUtc = Date.UTC(p.y, p.m - 1, p.d) - p.weekday * 86400000;
  return new Date(dayUtc).toISOString().slice(0, 10);
}

/* ---- line classification, calibrated on real channel history ---- */
const IN_RE = /^(?:check(?:ing|ed)?[\s\-]*in|clock(?:ing|ed)?[\s\-]*in|sign(?:ing|ed)?[\s\-]*in|back\s+in|i'?m\s+in|in)([\s\-,:!.@].*|)$/;
const OUT_RE = /^(?:check(?:ing|ed)?[\s\-]*out|clock(?:ing|ed)?[\s\-]*out|sign(?:ing|ed)?[\s\-]*out|heading\s+out|i'?m\s+out|out)([\s\-,:!.@].*|)$/;

type ParsedTime = { hh: number; mm: number; ampm: string | null };
function parseTimeToken(rest: string): ParsedTime | null {
  const m = rest.match(/^[\s\-,:!.@]*(?:(?:again|around|aprox|approx\w*)\s+)?(at\s+)?(?:yesterday\s+|hier\s+)?(?:(?:again|around)\s+)?[\s@]*([0-9]{1,4})(?:[:h]([0-9]{2}))?\s*(am|pm|a\.m\.?|p\.m\.?)?/i);
  if (!m || !m[2]) return null;
  const digits = m[2];
  const hasSep = m[3] != null;
  const hasAt = m[1] != null || /^[\s\-,:!.]*@/.test(rest);
  let ampm: string | null = null;
  if (m[4]) ampm = m[4].toLowerCase().charAt(0) === 'p' ? 'pm' : 'am';
  let hh: number, mm: number;
  if (hasSep) { hh = parseInt(digits, 10); mm = parseInt(m[3]!, 10); }
  else if (digits.length >= 3) { hh = parseInt(digits.slice(0, digits.length - 2), 10); mm = parseInt(digits.slice(-2), 10); }
  else {
    hh = parseInt(digits, 10); mm = 0;
    if (!ampm && !hasAt) return null; /* a bare 1 or 2 digit number is only a time with am, pm, @, or at */
  }
  if (hh > 23 || mm > 59 || (ampm != null && (hh < 1 || hh > 12))) return null;
  return { hh, mm, ampm };
}

function resolveTs(msgMs: number, t: ParsedTime | null, yesterday: boolean): number {
  if (!t) return yesterday ? msgMs - 86400000 : msgMs;
  const dayRefs = yesterday ? [msgMs - 86400000] : [msgMs, msgMs - 86400000];
  const hours: number[] = [];
  if (t.ampm === 'pm') hours.push((t.hh % 12) + 12);
  else if (t.ampm === 'am') hours.push(t.hh % 12);
  else if (t.hh <= 12) { hours.push(t.hh % 12, (t.hh % 12) + 12); }
  else hours.push(t.hh);
  const cands: number[] = [];
  for (const ref of dayRefs) for (const h of hours) { if (h >= 0 && h <= 23) cands.push(torontoTimeOnSameDay(ref, h, t.mm)); }
  const grace = msgMs + 30 * 60000;
  const past = cands.filter(c => c <= grace);
  if (past.length) return past.reduce((a, b) => (b > a ? b : a));
  return cands.reduce((a, b) => (Math.abs(b - msgMs) < Math.abs(a - msgMs) ? b : a));
}

type Ev = { userId: string; ts: number; kind: 'in' | 'out' };
function classifyMessage(text: string, msgMs: number, userId: string): Ev[] {
  const out: Ev[] = [];
  const lines = (text || '').split('\n').slice(0, 5);
  for (const raw of lines) {
    const line = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!line || line.length > 300) continue;
    /* v5: one line can hold several events ("in at 3, out - meeting") */
    const segs = line.split(/\s*,\s*/);
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (!seg) continue;
      const yesterday = /\byesterday\b|\bhier\b/.test(seg);
      let kind: 'in' | 'out' | null = null;
      let rest = '';
      let m = seg.match(OUT_RE);
      if (m) { kind = 'out'; rest = m[1] || ''; }
      else { m = seg.match(IN_RE); if (m) { kind = 'in'; rest = m[1] || ''; } }
      if (!kind) continue;
      const t = parseTimeToken(rest);
      if (i > 0 && /^(in|out)\b/.test(seg)) {
        /* mid-line plain in/out: require a delimiter, a time, now/again, or nothing after */
        const strong = rest === '' || /^\s*$/.test(rest) || /^[\-:@!.]/.test(rest.trim().charAt(0) ? rest.trimStart() : rest) || /^[\s]*[\-:@!.]/.test(rest) || /^\s+(now|again)\b/.test(rest) || t != null;
        if (!strong) continue;
      }
      out.push({ userId, ts: resolveTs(msgMs, t, yesterday), kind });
    }
  }
  return out;
}

async function runPull() {
  const botToken = await getSecret('SLACK_BOT_TOKEN');
  const userToken = await getSecret('SLACK_USER_TOKEN');
  const token = botToken || userToken;
  if (!token) { console.warn('hours-pull: no tokens'); return; }

  const now = Date.now();
  const oldestMs = new Date(weekStartStr(now)).getTime() - 7 * 7 * 86400000;
  const oldest = (oldestMs / 1000).toFixed(0);

  const users = await userDirectory(token);
  const { data: members } = await svc.from('team_members').select('name, department').eq('active', true);
  const roster = (members || []) as Array<{ name: string; department: string }>;
  const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
  const toks = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  const matchMember = (slackName: string): { name: string | null; dept: string | null } => {
    const sTok = toks(slackName);
    const sSet = new Set(sTok);
    const exact = roster.find(r => norm(r.name) === norm(slackName));
    if (exact) return { name: exact.name, dept: exact.department };
    const subset = roster.filter(r => { const rt = toks(r.name); return rt.length > 0 && rt.every(t => sSet.has(t)); });
    if (subset.length === 1) return { name: subset[0].name, dept: subset[0].department };
    const first = sTok[0] || '';
    const firsts = roster.filter(r => toks(r.name)[0] === first);
    if (firsts.length === 1) return { name: firsts[0].name, dept: firsts[0].department };
    return { name: null, dept: null };
  };

  const allChans = await listChannels([botToken, userToken]);
  const chans = allChans.filter(c => /check.?in/i.test(c.name || ''));
  const readable: string[] = [], blocked: string[] = [];

  const events: Ev[] = [];
  for (const ch of chans) {
    let cursor = '';
    let ok = false;
    for (let page = 0; page < 4; page++) {
      const params: Record<string, string> = { channel: ch.id, oldest, limit: '200' };
      if (cursor) params.cursor = cursor;
      let hist = await slackApi(token, 'conversations.history', params);
      if (!hist.ok && userToken && token !== userToken) hist = await slackApi(userToken, 'conversations.history', params);
      if (!hist.ok) { if (page === 0) blocked.push('#' + ch.name + ' (' + (hist.error || 'error') + ')'); break; }
      ok = true;
      for (const m of (hist.messages || []) as Array<{ ts: string; user?: string; bot_id?: string; subtype?: string; text?: string }>) {
        if (m.bot_id || m.subtype || !m.user || !m.text) continue;
        events.push(...classifyMessage(m.text, parseFloat(m.ts) * 1000, m.user));
      }
      const meta = hist.response_metadata as { next_cursor?: string } | undefined;
      cursor = meta?.next_cursor || '';
      if (!cursor) break;
    }
    if (ok) readable.push('#' + ch.name);
  }

  events.sort((a, b) => a.ts - b.ts);
  const byUser: Record<string, Ev[]> = {};
  events.forEach(e => { (byUser[e.userId] = byUser[e.userId] || []).push(e); });

  type Agg = { hours: number; sessions: number; missed: number };
  const weekly: Record<string, Record<string, Agg>> = {};
  for (const [uid, evs] of Object.entries(byUser)) {
    let openIn: number | null = null;
    for (const e of evs) {
      if (e.kind === 'in') {
        if (openIn != null) {
          const w = weekStartStr(openIn);
          const a = ((weekly[uid] = weekly[uid] || {})[w] = weekly[uid][w] || { hours: 0, sessions: 0, missed: 0 });
          a.missed++;
        }
        openIn = e.ts;
      } else {
        if (openIn != null) {
          const durH = (e.ts - openIn) / 3600000;
          if (durH > 0 && durH <= 16) {
            const w = weekStartStr(openIn);
            const a = ((weekly[uid] = weekly[uid] || {})[w] = weekly[uid][w] || { hours: 0, sessions: 0, missed: 0 });
            a.hours += durH; a.sessions++;
          }
        }
        openIn = null;
      }
    }
    if (openIn != null && now - openIn > 16 * 3600000) {
      const w = weekStartStr(openIn);
      const a = ((weekly[uid] = weekly[uid] || {})[w] = weekly[uid][w] || { hours: 0, sessions: 0, missed: 0 });
      a.missed++;
    }
  }

  let rows = 0;
  for (const [uid, weeks] of Object.entries(weekly)) {
    const slackName = users[uid] || uid;
    const m = matchMember(slackName);
    for (const [week, a] of Object.entries(weeks)) {
      const { error } = await svc.from('slack_hours').upsert({
        slack_name: slackName,
        member_name: m.name,
        department: m.dept,
        week_start: week,
        hours: Math.round(a.hours * 10) / 10,
        sessions: a.sessions,
        missed_outs: a.missed,
        updated_at: new Date().toISOString()
      });
      if (!error) rows++;
    }
  }

  await svc.from('change_log').insert({
    entity_type: 'hours_pull', entity_id: new Date().toISOString().slice(0, 10), field: 'ran',
    old_value: null, new_value: readable.join(', ') + '; ' + rows + ' member weeks' + (blocked.length ? '; not accessible: ' + blocked.join(', ') : ''),
    changed_by: 'Hours pull'
  });
  return { channels: readable, blocked, member_weeks: rows };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  const botToken = await getSecret('SLACK_BOT_TOKEN');
  const userToken = await getSecret('SLACK_USER_TOKEN');
  if (!botToken && !userToken) return json({ error: 'tokens_missing' });
  const work = runPull().catch(e => console.error('hours-pull failed', e));
  // @ts-ignore EdgeRuntime provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
  return json({ accepted: true }, 202);
});
