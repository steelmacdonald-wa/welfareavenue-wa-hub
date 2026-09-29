// wave164 (29/09/26): Fundraising is called Fundraising, and Finance (its own team now, apart from Fundraising) has a label.
// Welfare Avenue: hub-reel (v1, wave149, 27/09/26)
// Steel: "On the loading page: I want you to put learnings, lessons, and milestones along with shoutouts ... And refresh it
// every week. Also at the bottom, I'd like for you to add sort of like a news banner of events that happened recently,
// updates that the organization should know about."
// Every morning (cron wa-hub-reel) this builds the news banner for the day, and on the first run of each week (Monday,
// Toronto time) the week's lines for the loading screen:
//   lessons     six from Our story's lessons learned (wa_lessons, everyone), rotated so one does not come back for 8 weeks;
//   learnings   up to four from recent evidence: what volunteers said after the last servings (form_summaries), the latest
//               Analytics insights (social_notes) and Google Search once it is connected (search_top);
//   milestones  up to five: this week in our history (wa_history), recent wins from meetings (goal_wins) and highlights.
// The model shortens and phrases them (router task 'reel': Sonnet first, one call a week, 95 seconds at most); templates if it cannot. The news banner is built from the
// data with templates: the next servings, a thank-you after a serving that happened, fundraising events coming up or done,
// new people and recent wins. Admins add their own updates and take any line off in Admin, Loading screen
// (hub_news_add, hub_reel_hide). Shout-outs stay with the shoutouts function; the page mixes them in.
// Every line passes a filter: nothing about leadership changes, roles, anyone leaving, HR matters or pay, and nothing that
// describes the people we serve (the loading screen is seen by staff, volunteers and the board).
// Actions: build {force?} (x-wa-secret or admins; force rebuilds the week's lines too), status (admins).
// v2 (review, 27/09/26): wins only from team meetings (never board, leadership or executive ones, nor private transcripts),
// welcomes only for people joining a team, no event audits, wider filters; anything an admin took off stays off for 120
// days; each rebuild replaces the lines in one locked transaction (hub_reel_replace); the news never says "Today".
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const TZ = 'America/Toronto';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
/* the teams (dept_meta, without the board): wins and welcomes only come from these; the list below is the fallback */
let TEAMS = ['fundraising', 'hr', 'marketing', 'opsmtl', 'opsto', 'progdev'];
async function loadTeams(): Promise<void> { try { const { data } = await svc.from('dept_meta').select('department'); const t = ((data || []) as Row[]).map((r) => String(r.department)).filter((d) => d && !/^(board|exec|leadership|execs?)$/i.test(d)); if (t.length >= 3) TEAMS = t; } catch (_) { /* the fallback */ } }
const DEPT: Record<string, string> = { fundraising: 'Fundraising', finance: 'Finance', hr: 'HR & People', marketing: 'Marketing', opsmtl: 'Operations Montreal', opsto: 'Operations Toronto', progdev: 'Program Development', board: 'the board', exec: 'the executive team' };

async function getSecret(name: string): Promise<string> { const { data, error } = await svc.rpc('get_secret', { secret_name: name }); if (error || !data) throw new Error('secret ' + name + ' unavailable'); return data as string; }
async function caller(req: Request): Promise<string | null> {
  try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_hub_admin'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---------- dates (Toronto) ---------- */
function today(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function addDays(iso: string, n: number): string { return new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function mondayOf(iso: string): string { const d = new Date(iso + 'T12:00:00Z'); return addDays(iso, -((d.getUTCDay() + 6) % 7)); }
function longDay(iso: string, weekday = false): string {
  const o: Intl.DateTimeFormatOptions = { timeZone: 'UTC', day: 'numeric', month: 'long' }; if (weekday) o.weekday = 'long';
  return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', o).replace(/,/g, '');
}

/* ---------- what never reaches the loading screen ---------- */
const CONF = /\b(managers?|coordinators?|treasurer|secretary|head of|promot(ed|es|ing|ion)|co-?directors?|directors?|hired|hiring|new hire|joins as|joined as|recruited as|stepped down|transition\w*|succession|successors?|succeed(s|ed|ing)?|hand(ing|ed|s)?[ -]?overs?|handed over|tak(e|es|ing|en)[ -]over|took over|now leads?|step(s|ped|ping)?\s+(down|back|away|aside|into|up)|resign\w*|departures?|departing|departed|(leav(e|es|ing)|left) (us|wa|welfare|the (team|org|organi[sz]ation|charity|board|role|hub))|moving on|retir(e|es|ed|ing)\b|replac(e|es|ed|ing) (him|her|them|steel|suhaib|the (ed|executive|chair|president|director|founder|lead))|replacement (for|of)|appoint(ed|s|ing)\b|nominat\w*|elected|election|new (role|position|title|ed|ceo|chair|president|director|lead(er)?)|executive team|joined the board|board members?|role change|change of role|leadership|delegat\w*|chair(man|person|woman)?|president|executive directors?|co-?eds?|ed|ceo|interim|farewell|goodbyes?|good luck|best of luck|miss (you|him|her|them)|wish(ing)? (you|him|her|them) (well|the best)|next chapter|new chapter|last day|exit|d\u00e9part\w*|passation|quitt\w*|d\u00e9mission\w*|rel\u00e8ve|successeur)\b/i;
const CARE = /\b(disciplin\w*|terminat\w*|fired|let go|laid off|salar(y|ies)|payroll|wages?|lawsuit|legal action|police|arrest\w*|overdos\w*|intoxicat\w*|drunk|drugs?|aggress\w*|violen\w*|fights?\b(?! (against )?(poverty|hunger|food|isolation))|fighting\b(?! (poverty|hunger|food|isolation))|incidents?|911|ambulance|hospitali[sz]ed|injur\w*|harass\w*|complain\w*|probation|deficit|debts?|owe[sd]?|beneficiar(y|ies)|homeless|unhoused|mental health)\b/i;
export function safe(t: string): boolean { return !!t && !CONF.test(t) && !CARE.test(t); }
export function clean(t: string): string { return String(t || '').replace(/\s*[—–]\s*/g, ', ').replace(/!+/g, '.').replace(/[“”]/g, '"').replace(/\s+/g, ' ').replace(/^["']|["']$/g, '').trim(); }
function firstSentence(t: string, max = 140): string {
  const s = clean(t); const m = s.match(/^(.{20,}?[.;])(\s|$)/); let out = (m ? m[1] : s).replace(/;$/, '.');
  if (out.length > max) { const cut = out.slice(0, max); const at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' and ')); out = (at > 40 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[,;:]$/, '') + '.'; }
  return /[.?]$/.test(out) ? out : out + '.';
}
function shuffle<T>(a: T[]): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function norm(t: string): string { return String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48); }

/* ---------- what an admin took off (any day or week, the last 120 days) ---------- */
async function blockedKeys(): Promise<Set<string>> {
  const { data } = await svc.from('hub_reel').select('source_key').eq('hidden', true).not('source_key', 'is', null).gte('hidden_at', new Date(Date.now() - 120 * 86400000).toISOString()).limit(2000);
  return new Set(((data || []) as Row[]).map((r) => String(r.source_key)));
}
/* wins from team meetings only: never the board, leadership or executive meetings, nor a private or restricted transcript */
async function openWins(fromDay: string, limit: number): Promise<Row[]> {
  const { data: ws } = await svc.from('goal_wins').select('id, win, department, meeting_date, visibility, allowed_people, transcript_id').gte('meeting_date', fromDay).order('meeting_date', { ascending: false }).limit(60);
  const list = ((ws || []) as Row[]).filter((w) => w.win && TEAMS.indexOf(String(w.department || '')) >= 0 && (!w.visibility || w.visibility === 'everyone' || w.visibility === 'org') && (!w.allowed_people || (Array.isArray(w.allowed_people) && !w.allowed_people.length)) && safe(w.win));
  const tids = Array.from(new Set(list.map((w) => w.transcript_id).filter(Boolean)));
  const { data: ts } = tids.length ? await svc.from('transcripts').select('id, department, board_only, visibility, allowed_people').in('id', tids) : { data: [] };
  const byT: Record<string, Row> = {}; for (const t of (ts || []) as Row[]) byT[String(t.id)] = t;
  const seen = new Set<string>();
  return list.filter((w) => {
    const t = w.transcript_id ? byT[String(w.transcript_id)] : null;
    if (!t || t.board_only || TEAMS.indexOf(String(t.department || '')) < 0 || (t.visibility && t.visibility !== 'everyone' && t.visibility !== 'org') || (Array.isArray(t.allowed_people) && t.allowed_people.length)) return false;
    const k = norm(w.win); if (seen.has(k)) return false; seen.add(k);
    return !/\b(near(ly)? complet|in progress|planned|scheduled|will be|to be)\b/i.test(w.win);
  }).slice(0, limit);
}

/* ---------- the week's lines ---------- */
type Cand = { id: string; group: 'lesson' | 'learning' | 'milestone'; facts: string; fallback: string; key: string; source: string; prio: number };

async function candidates(week: string, day: string): Promise<Cand[]> {
  const out: Cand[] = [];
  const { data: past } = await svc.from('hub_reel').select('source_key, batch, hidden').in('kind', ['lesson', 'learning', 'milestone']).gte('batch', addDays(week, -56)).lt('batch', week);
  const used = new Set<string>(), hid = await blockedKeys();
  for (const r of (past || []) as Row[]) if (r.source_key) used.add(r.source_key);
  const ok = (k: string) => !hid.has(k);

  /* lessons: Our story's lessons learned, everyone's, not shown in the last eight weeks */
  const { data: ls } = await svc.from('wa_lessons').select('key, lesson, area, topic').eq('visibility', 'everyone').eq('status', 'published').limit(1000);
  const pool = ((ls || []) as Row[]).filter((l) => l.key && l.lesson && safe(l.lesson) && ok('lesson:' + l.key));
  let fresh = pool.filter((l) => !used.has('lesson:' + l.key)); if (fresh.length < 6) fresh = pool;
  shuffle(fresh).slice(0, 10).forEach((l, i) => out.push({ id: 'L' + (i + 1), group: 'lesson', facts: (l.area ? l.area + (l.topic ? ' / ' + l.topic : '') + ': ' : '') + clean(l.lesson), fallback: firstSentence(l.lesson), key: 'lesson:' + l.key, source: 'wa_lessons', prio: 1 }));

  /* milestones: this week in our history first, then recent wins, then highlights not shown lately */
  const { data: hs } = await svc.from('wa_history').select('key, date_start, date_precision, title, summary, kind, city, highlight').eq('visibility', 'everyone').eq('status', 'published').limit(1000);
  const yearOf: Record<string, number> = {}; for (let i = 0; i < 7; i++) { const d = addDays(week, i); yearOf[d.slice(5)] = Number(d.slice(0, 4)); }
  const hist = ((hs || []) as Row[]).filter((h) => h.key && h.title && h.date_start && safe(h.title + ' ' + (h.summary || '')) && ok('history:' + h.key));
  const onWeek = hist.filter((h) => { const md = String(h.date_start).slice(5, 10); return h.date_precision === 'day' && yearOf[md] && Number(String(h.date_start).slice(0, 4)) < yearOf[md]; });
  let n = 0;
  onWeek.slice(0, 3).forEach((h) => { const y = yearOf[String(h.date_start).slice(5, 10)] - Number(String(h.date_start).slice(0, 4)); out.push({ id: 'M' + (++n), group: 'milestone', facts: 'This week ' + y + (y === 1 ? ' year' : ' years') + ' ago (' + longDay(h.date_start) + ' ' + String(h.date_start).slice(0, 4) + '): ' + clean(h.title) + '. ' + clean(h.summary || ''), fallback: y + (y === 1 ? ' year' : ' years') + ' ago this week: ' + firstSentence(h.title, 110), key: 'history:' + h.key, source: 'wa_history', prio: 3 }); });
  (await openWins(addDays(day, -21), 8)).filter((w) => ok('win:' + w.id)).slice(0, 4).forEach((w) => out.push({ id: 'M' + (++n), group: 'milestone', facts: 'A win from a ' + (DEPT[w.department] || 'team') + ' meeting on ' + longDay(w.meeting_date) + ': ' + clean(w.win), fallback: firstSentence(w.win, 120), key: 'win:' + w.id, source: 'goal_wins', prio: 2 }));
  let hl = hist.filter((h) => h.highlight && !used.has('history:' + h.key) && onWeek.indexOf(h) < 0); if (hl.length < 3) hl = hist.filter((h) => h.highlight && onWeek.indexOf(h) < 0); /* hist already leaves out what was taken off */
  shuffle(hl).slice(0, 6).forEach((h) => out.push({ id: 'M' + (++n), group: 'milestone', facts: String(h.date_start).slice(0, 4) + (h.city ? ', ' + h.city : '') + ': ' + clean(h.title) + '. ' + clean(h.summary || ''), fallback: String(h.date_start).slice(0, 4) + ': ' + firstSentence(h.title, 110), key: 'history:' + h.key, source: 'wa_history', prio: 1 }));

  /* learnings: what volunteers said after the last servings, the latest Analytics insights, Google Search */
  let m = 0;
  const { data: fsrc } = await svc.from('form_sources').select('form_id, kind').eq('kind', 'volunteer_feedback');
  const ids = ((fsrc || []) as Row[]).map((f) => f.form_id);
  if (ids.length) {
    const { data: sums } = await svc.from('form_summaries').select('form_id, scope, n, summary, created_at').in('form_id', ids).like('scope', 'event:%').order('created_at', { ascending: false }).limit(60);
    const evIds = ((sums || []) as Row[]).map((s) => Number(String(s.scope).split(':')[1])).filter(Boolean);
    const { data: evs } = evIds.length ? await svc.from('volunteer_events').select('id, event_date, location').in('id', evIds) : { data: [] };
    const evById: Record<string, Row> = {}; for (const e of (evs || []) as Row[]) evById[String(e.id)] = e;
    ((sums || []) as Row[]).map((s) => ({ s, e: evById[String(s.scope).split(':')[1]] })).filter((x) => x.e && x.s.summary && x.e.event_date >= addDays(day, -42) && x.e.event_date <= day)
      .sort((a, b) => (a.e.event_date < b.e.event_date ? 1 : -1)).slice(0, 3)
      .filter((x) => ok('survey:' + x.s.form_id.slice(0, 8) + ':' + x.e.id)).forEach((x) => { out.push({ id: 'E' + (++m), group: 'learning', facts: 'The volunteer survey after the ' + longDay(x.e.event_date) + ' serving' + (x.e.location ? ' in ' + x.e.location : '') + ' (' + x.s.n + ' answers): ' + clean(x.s.summary), fallback: '', key: 'survey:' + x.s.form_id.slice(0, 8) + ':' + x.e.id, source: 'form_summaries', prio: 2 }); });
  }
  const { data: ins } = await svc.from('social_notes').select('id, body, data, created_at').eq('kind', 'insights').gte('created_at', addDays(day, -35) + 'T00:00:00Z').order('created_at', { ascending: false }).limit(1);
  const ev = (ins && ins[0] && ins[0].data && Array.isArray(ins[0].data.evidence)) ? (ins[0].data.evidence as Row[]) : [];
  ev.filter((e) => e && e.title && e.confidence !== 'low' && !/^no clear|about the same|little difference|neither helps/i.test(String(e.title))).slice(0, 3)
    .filter((e) => ok('insight:' + ins![0].id + ':' + e.key)).forEach((e) => out.push({ id: 'E' + (++m), group: 'learning', facts: 'From our Instagram and Facebook posts of the last ' + ((ins![0].data.days) || 90) + ' days (how posts perform: engagement, views and reach together; ' + (e.confidence || 'medium') + ' confidence): ' + clean(e.title) + '. ' + clean(e.detail || ''), fallback: clean(e.title).replace(/\.$/, '') + '.', key: 'insight:' + ins![0].id + ':' + e.key, source: 'social_notes', prio: 1 }));
  try {
    const { data: q } = await svc.from('search_top').select('key, clicks, impressions, period_start, period_end').eq('kind', 'query').order('clicks', { ascending: false }).limit(3);
    const top = ((q || []) as Row[]).filter((r) => Number(r.clicks) > 0 && /welfare|avenue|volunteer|food|donat|montreal|toronto|charit|meal/i.test(String(r.key)) && safe(String(r.key)))[0];
    if (top) out.push({ id: 'E' + (++m), group: 'learning', facts: 'Google Search, ' + longDay(top.period_start) + ' to ' + longDay(top.period_end) + ': the search that brings the most people to the website is "' + top.key + '" (' + top.clicks + ' clicks from ' + top.impressions + ' appearances)', fallback: '', key: 'search:' + norm(top.key), source: 'search_top', prio: 1 });
  } catch (_) { /* not connected yet */ }
  return out;
}

let MODEL_NOTE = '';
async function phrase(cands: Cand[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  MODEL_NOTE = '';
  if (!cands.length) return out;
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', signal: AbortSignal.timeout(95000), headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'reel', 'x-wa-caller': 'hub-reel', 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_tokens: 2500, temperature: 0.4,
        system: 'You write the short lines that rotate on the loading screen of Welfare Avenue’s staff Hub while it opens. Welfare Avenue is a youth-powered charity in Montreal and Toronto that serves meals and builds connection with people facing poverty. Staff, volunteers and board members read each line in about three seconds.\n'
          + 'Rules for every line: one sentence of 50 to 115 characters; warm, plain, credible and specific; keep numbers and dates exact and use only the facts given; no em dashes, no exclamation marks, no hashtags, no emojis, no quotation marks around the line; say "people we serve" or "our community", never "beneficiaries", "clients" or "the homeless"; never describe anyone’s behaviour, health or personal situation; nothing about money owed, pay, HR matters, anyone leaving, roles or leadership.\n'
          + 'Lessons: advice for next time, as an instruction or a "we" sentence (for example: Confirm drivers by Wednesday, then call again the day before and the morning of.).\n'
          + 'Learnings: what recent evidence taught us and what we do about it. When volunteers\u2019 feedback is among the items, make at least one learning from it, turning a suggestion into what we do (for example: Volunteers asked to arrive 15 minutes early, so setup is done before the doors open.). The Analytics numbers compare how posts perform (engagement, views and reach together), so say they do about N times better, not that they reach more people; start a medium-confidence finding with "Early sign:" and state a high-confidence one plainly (for example: Early sign: afternoon posts do about twice as well, so we try posting after 3 pm.).\n'
          + 'Milestones: a moment in our history or a recent win, with its year or how long ago (for example: Six years ago this week, our first servings ran from a car downtown.).\n'
          + 'Write a line for the strongest items only: up to 6 lessons, up to 4 learnings and up to 5 milestones, preferring "this week" moments and recent wins. Skip anything that breaks a rule or would not make sense to someone on the team.',
        messages: [{ role: 'user', content: 'ITEMS (id | kind | facts):\n' + cands.map((c) => c.id + ' | ' + c.group + ' | ' + c.facts.slice(0, 700)).join('\n') }],
        tools: [{ name: 'reel', description: 'The loading screen lines, one per chosen item.', input_schema: { type: 'object', properties: { lines: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } } }, required: ['lines'] } }],
        tool_choice: { type: 'tool', name: 'reel' } })
    });
    if (!res.ok) { MODEL_NOTE = 'router ' + res.status + ': ' + (await res.text()).slice(0, 200); return out; }
    const body = await res.json();
    const tu = (body.content || []).find((c: Row) => c.type === 'tool_use');
    let lines = tu && tu.input ? tu.input.lines : null;
    if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch (_) { lines = null; } }
    if (lines && !Array.isArray(lines) && Array.isArray(lines.lines)) lines = lines.lines; /* some answers wrap the list twice */
    if (!Array.isArray(lines)) { MODEL_NOTE = 'no lines in the answer: ' + JSON.stringify(body).slice(0, 300); return out; }
    let off = 0;
    for (const l of lines as Array<{ id: string; text: string }>) { const t = clean(l && l.text); if (t.length >= 25 && t.length <= 150) out[String(l.id).trim()] = t; else off++; }
    if (off) MODEL_NOTE = off + ' lines left out for length';
  } catch (e) { MODEL_NOTE = 'model call failed: ' + String((e as Error).message || e).slice(0, 200); }
  return out;
}

async function buildWeek(week: string, day: string, force: boolean): Promise<Row> {
  const { count } = await svc.from('hub_reel').select('id', { count: 'exact', head: true }).in('kind', ['lesson', 'learning', 'milestone']).eq('batch', week).eq('hidden', false);
  if ((count || 0) > 0 && !force) return { built: false, week, lines: count };
  const cands = await candidates(week, day);
  const phrased = await phrase(cands);
  const byModel = Object.keys(phrased).length > 0;
  const want: Record<string, number> = { lesson: 6, learning: 4, milestone: 5 };
  const picked: Array<{ c: Cand; text: string }> = [], seen = new Set<string>();
  for (const g of ['milestone', 'lesson', 'learning'] as const) {
    const list = cands.filter((c) => c.group === g).sort((a, b) => b.prio - a.prio);
    let k = 0;
    for (const c of list) {
      if (k >= want[g]) break;
      const text = byModel ? phrased[c.id] : c.fallback;
      if (!text || !safe(text) || seen.has(norm(text))) continue;
      seen.add(norm(text)); picked.push({ c, text }); k++;
    }
  }
  if (!picked.length) return { built: false, week, lines: 0, note: 'nothing to show this week' };
  /* one locked transaction replaces the week's lines, keeping what an admin took off (hub_reel_replace) */
  const order: Record<string, number> = { milestone: 0, lesson: 1, learning: 2 };
  const rows = picked.map((p, i) => ({ kind: p.c.group, text: p.text.slice(0, 220), source: p.c.source, source_key: p.c.key, sort: order[p.c.group] * 100 + i, created_by: byModel ? 'hub-reel (model)' : 'hub-reel' }));
  const { data: nIns, error } = await svc.rpc('hub_reel_replace', { p_kinds: ['lesson', 'learning', 'milestone'], p_batch: week, p_rows: rows }); if (error) throw new Error(error.message);
  await svc.from('hub_reel').delete().in('kind', ['lesson', 'learning', 'milestone']).lt('batch', addDays(week, -84)).eq('hidden', false);
  await svc.from('hub_reel').delete().eq('hidden', true).lt('hidden_at', new Date(Date.now() - 120 * 86400000).toISOString());
  return { built: true, week, lines: Number(nIns) || 0, by_model: byModel, model_note: MODEL_NOTE || null, kinds: rows.reduce((a: Row, r) => { a[r.kind] = (a[r.kind] || 0) + 1; return a; }, {}) };
}

/* ---------- the news banner ---------- */
async function buildNews(day: string): Promise<Row> {
  const items: Array<{ text: string; link?: string | null; source: string; key: string }> = [];
  const add = (text: string, source: string, key: string, link?: string | null) => { const t = clean(text); if (t.length >= 8 && t.length <= 160 && safe(t) && !items.some((x) => norm(x.text) === norm(t))) items.push({ text: t, source, key, link: link || null }); };
  /* servings: the next two, and a thank-you after one that happened (volunteers answered the survey, or it is marked done) */
  const { data: evs } = await svc.from('volunteer_event_summary').select('id, event_date, location, status, kind, title, roster_count').gte('event_date', addDays(day, -10)).lte('event_date', addDays(day, 14)).order('event_date');
  const list = (evs || []) as Row[];
  const { data: fb } = list.length ? await svc.from('form_responses').select('event_id').eq('kind', 'volunteer_feedback').in('event_id', list.map((e) => e.id)) : { data: [] };
  const answers: Record<string, number> = {}; for (const r of (fb || []) as Row[]) answers[String(r.event_id)] = (answers[String(r.event_id)] || 0) + 1;
  const what = (e: Row) => (e.title && !/serv(ice|ing)/i.test(String(e.title)) ? String(e.title) : 'serving');
  list.filter((e) => e.event_date >= day).slice(0, 2).forEach((e) => {
    const where = e.location ? ' in ' + e.location : '';
    if (e.status === 'cancelled') add('The ' + longDay(e.event_date) + ' ' + what(e) + where + ' is cancelled', 'volunteer_events', 'event:' + e.id, '#volunteering');
    else add('Next ' + what(e) + ': ' + longDay(e.event_date, true) + where + (Number(e.roster_count) > 0 ? ', ' + e.roster_count + ' volunteers signed up' : ''), 'volunteer_events', 'event:' + e.id, '#volunteering/e/' + e.id);
  });
  list.filter((e) => e.event_date < day && e.status !== 'cancelled' && (answers[String(e.id)] > 0 || /^(done|held|complete|completed)$/i.test(String(e.status || '')))).slice(-2).forEach((e) => {
    const n = answers[String(e.id)] || 0;
    add('Thank you to everyone who served' + (e.location ? ' in ' + e.location : '') + ' on ' + longDay(e.event_date) + (n ? ': ' + n + ' volunteers shared how it went' : ''), 'volunteer_events', 'thanks:' + e.id, '#volunteering/e/' + e.id);
  });
  /* fundraising events: coming up in the next month, or done in the last two weeks */
  const { data: fe } = await svc.from('fund_events').select('id, title, start_date, end_date, status, raised').gte('start_date', addDays(day, -14)).lte('start_date', addDays(day, 31)).order('start_date');
  for (const f of (fe || []) as Row[]) {
    if (!f.title || /cancel/i.test(String(f.status || ''))) continue;
    if (f.start_date >= day) add('Coming up: ' + f.title + ', ' + (f.end_date && f.end_date > f.start_date ? 'from ' : 'on ') + longDay(f.start_date), 'fund_events', 'fund:' + f.id, '#fundevents');
    else if (/^(done|complete|completed|held)$/i.test(String(f.status || ''))) add(f.title + ' is done' + (Number(f.raised) > 0 ? ', raising $' + Math.round(Number(f.raised)).toLocaleString('en-CA') : '') + '. Thank you to everyone who helped', 'fund_events', 'fund:' + f.id, '#fundevents');
  }
  /* new people in the last two weeks */
  const { data: tm } = await svc.from('team_members').select('id, name, department, start_date, active').gte('start_date', addDays(day, -14)).lte('start_date', day);
  for (const p of (tm || []) as Row[]) if (p.name && p.active !== false && TEAMS.indexOf(String(p.department || '')) >= 0) add('Welcome ' + String(p.name).trim() + ', who joined ' + (DEPT[p.department] || 'the team'), 'team_members', 'welcome:' + p.id, p.id ? '#person/' + p.id : null);
  /* recent wins from meetings, open to everyone */
  let w = 0;
  for (const x of await openWins(addDays(day, -10), 6)) {
    if (w >= 2) break;
    const before = items.length; add('Win: ' + firstSentence(x.win, 110).replace(/\.$/, ''), 'goal_wins', 'win:' + x.id, x.department ? '#team/' + x.department : null); if (items.length > before) w++;
  }
  /* anything an admin took off (any day, the last 120 days) stays off; one locked transaction replaces the day's news */
  const off = await blockedKeys();
  const rows = items.filter((x) => !off.has(x.key)).slice(0, 8).map((x, i) => ({ kind: 'news', text: x.text, link: x.link, source: x.source, source_key: x.key, sort: i, created_by: 'hub-reel' }));
  const { data: nIns, error } = await svc.rpc('hub_reel_replace', { p_kinds: ['news'], p_batch: day, p_rows: rows }); if (error) throw new Error(error.message);
  await svc.from('hub_reel').delete().eq('kind', 'news').lt('batch', addDays(day, -14)).eq('hidden', false);
  return { day, news: Number(nIns) || 0, items: rows.map((r) => r.text) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'not allowed' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'build');
  try {
    const day = today(), week = mondayOf(day);
    if (action === 'build') {
      await loadTeams();
      const news = await buildNews(day);
      const reel = await buildWeek(week, day, body.force === true);
      if (who !== 'automation') await svc.from('change_log').insert({ entity_type: 'hub_reel', entity_id: week, field: 'rebuilt', old_value: null, new_value: (reel.built ? reel.lines + ' lines, ' : '') + news.news + ' news', changed_by: who });
      return json({ ok: true, week, reel, news });
    }
    if (action === 'status') {
      const { data } = await svc.from('hub_reel').select('kind, batch, hidden').gte('batch', addDays(week, -7));
      const c: Row = {}; for (const r of (data || []) as Row[]) { const k = r.kind + (r.hidden ? ' (hidden)' : ''); c[k] = (c[k] || 0) + 1; }
      return json({ ok: true, week, day, counts: c });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
});
