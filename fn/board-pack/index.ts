// Welfare Avenue: board-pack (v1, wave143, 26/09/26)
// The first of the Google projects Steel approved ("go for all the above", 26/09/26): the board pack from Docs and Slides, the
// quarterly board deck and agenda filled from the teams' updates and numbers. For one board meeting this builds, in the Board
// of Directors shared drive (Board Meetings <year> /
// <Month day> - <meeting>):
//   - the agenda (Google Doc), in the board's usual layout, with the items for the meeting;
//   - the meeting notes (Google Doc): call to order, roll call of the directors, motions, the topics with room for notes;
//   - a deck (Google Slides): the state of Welfare Avenue by team, the numbers, the finances as totals, the three jobs of the
//     board, the committees, the decisions for the board and what comes next, in the WA brand.
// Everything comes from the Hub's own tables. People matters stay out: the HR slide shows counts only, and any sentence about
// retention, resignations, successors, discipline, pay, health or a personal matter is dropped from the teams' updates.
// Actions (the admin role or the Executive profile; or the trigger secret):
//   preview {meeting_id}  the content, nothing written
//   build   {meeting_id}  creates the folder and the three files once; their links go on the meeting (agenda_url, notes_url,
//                          deck_url, pack)
//   refresh {meeting_id}  rewrites the Hub's own slides in the existing deck with today's numbers; slides someone added stay,
//                          and the agenda and the notes are never touched once built
// Google: the service account as steel.macdonald@welfareavenue.com (domain-wide delegation, scope drive).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const ACTOR = 'steel.macdonald@welfareavenue.com';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const DOCS = 'https://docs.googleapis.com/v1/documents/';
const SLIDES = 'https://slides.googleapis.com/v1/presentations/';
const TZ = 'America/Toronto';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
/* who is asking: an admin or someone on the Executive profile, by their Hub session, or the automation by the trigger secret */
async function caller(req: Request): Promise<string | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_hub_leader'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  const em = (data?.user?.email || '').toLowerCase();
  if (!em) return null;
  /* the pack is the executive directors' and the admins' to build: the admin role or the Executive profile */
  const { data: r } = await svc.from('hub_roles').select('role,profile').eq('email', em).maybeSingle();
  if (!r || !(r.role === 'admin' || r.profile === 'executive')) return null;
  const { data: m } = await svc.from('team_members').select('name').ilike('email', em).maybeSingle();
  return (m && m.name) || em;
}

/* ---------- Google: the delegated token ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
let TOKEN: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 120000) return TOKEN.v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: ACTOR, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the delegated token: ' + String(body.error_description || body.error || res.status).slice(0, 200));
  TOKEN = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOKEN.v;
}
async function g(url: string, method = 'GET', body?: unknown): Promise<Row> {
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await res.text();
  let j: Row = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt.slice(0, 300) }; }
  if (!res.ok) throw new Error(method + ' ' + url.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, '') + ': ' + res.status + ' ' + String((j.error as Row)?.message || txt).slice(0, 240));
  return j;
}
const q = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

/* ---------- dates, in Toronto time ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function parts(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (!(d instanceof Date) || isNaN(d.getTime())) throw new Error('not a date: ' + String(iso).slice(0, 40));
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long' }).formatToParts(d);
  const v = (t: string) => (f.find((p) => p.type === t) || { value: '' }).value;
  return { y: Number(v('year')), m: Number(v('month')), d: Number(v('day')), h: Number(v('hour')) % 24, mi: Number(v('minute')), wd: v('weekday') };
}
function ord(n: number) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function dayLong(iso: string) { const p = parts(iso); return p.wd + ' ' + p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; }
function dayShort(iso: string) { const p = parts(iso); return p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; }
function timeText(iso: string) { const p = parts(iso); const h = p.h % 12 || 12; return h + ':' + String(p.mi).padStart(2, '0') + (p.h < 12 ? ' am' : ' pm') + ' ET'; }
function ymd(iso: string) { const p = parts(iso); return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'); }
/* WA's fiscal year runs from 1 October to 30 September: Q1 is October to December */
function fq(iso: string) { const p = parts(iso); const fy = p.m >= 10 ? p.y + 1 : p.y; const qn = Math.floor(((p.m - 10 + 12) % 12) / 3) + 1; return { fy, q: qn, label: 'Q' + qn + ' FY' + fy }; }
function prevQ(x: { fy: number; q: number }) { return x.q > 1 ? { fy: x.fy, q: x.q - 1, label: 'Q' + (x.q - 1) + ' FY' + x.fy } : { fy: x.fy - 1, q: 4, label: 'Q4 FY' + (x.fy - 1) }; }
const money = (n: number) => '$' + Math.round(Number(n) || 0).toLocaleString('en-CA');

/* ---------- people matters stay out of the pack ---------- */
const PRIVATE = /\b(retention|retain|resign\w*|successor|succession|transition\w*|depart\w*|leaving|left the (team|organi[sz]ation)|hand-?over|replacement|quit\w*|step(ping|s|ped)? (down|back)|fire[ds]?|firing|dismiss\w*|terminat\w*|disciplin\w*|warning|performance (issue|concern|review|plan)|medical|health issue|sick|burn-?out|personal|leave of absence|salary|salaries|pay rate|payroll|confidential|conflict with|complaint about|candidates?|interview\w*|shortlist\w*)\b/i;
/* named people being considered for a role, e.g. "three potential coordinators identified (A, B, C)" */
const PROSPECTS = /\bpotential\b[^.]{0,60}\b(coordinator|lead|director|manager|hire|chair|member)s?\b/i;
function sentences(t: string): string[] { return String(t || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).filter(Boolean); }
function safe(t: string, max: number): string {
  let out = '';
  for (const s of sentences(t)) { if (PRIVATE.test(s) || PROSPECTS.test(s)) continue; if ((out + ' ' + s).trim().length > max) break; out = (out + ' ' + s).trim(); }
  return out.replace(/\s*[—–]\s*/g, ', ');
}
function clip(t: string, n: number) { t = String(t || '').replace(/\s+/g, ' ').replace(/\s*[—–]\s*/g, ', ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : t; }

/* ---------- the content, from the Hub ---------- */
const TEAMS = ['opsmtl', 'opsto', 'progdev', 'marketing', 'fundraising', 'hr'];
const DONE = /^(done|closed|complete|completed|achieved|met)$/i, RISK = /^(delayed|at risk|off track|blocked|incomplete|missed)$/i;
const JOBS: [string, string, string][] = [['steward', 'Steward leadership', 'Appoint and support the executive directors, and own succession so there is never a gap.'],
  ['fiduciary', 'Fiduciary oversight', 'Watch the finances, risk and compliance.'], ['strategy', 'Direction and strategy', 'Decide where we are going and hold the organization to it.']];
const STATUS: Record<string, string> = { at_risk: 'At risk', in_progress: 'In progress', todo: 'To do', watch: 'Watching', standing: 'Standing', done: 'Done' };

async function gather(meetingId: number): Promise<Row> {
  const { data: meetings } = await svc.from('board_meetings').select('*').order('meets_at', { ascending: true, nullsFirst: false });
  const M = (meetings || []).find((x: Row) => String(x.id) === String(meetingId));
  if (!M) throw new Error('That board meeting is not in the Hub');
  if (!M.meets_at) throw new Error('Give the meeting a date first');
  const mt = new Date(M.meets_at).getTime();
  const last = (meetings || []).filter((x: Row) => x.meets_at && x.kind === 'board' && new Date(x.meets_at).getTime() < mt && x.status !== 'cancelled').pop() || null;
  const next = (meetings || []).find((x: Row) => x.meets_at && x.kind === 'board' && new Date(x.meets_at).getTime() > mt && x.status !== 'cancelled') || null;
  const strategy = (meetings || []).find((x: Row) => x.kind === 'strategy' && x.status !== 'held' && x.status !== 'cancelled') || null;
  const since = last ? last.meets_at : new Date(mt - 90 * 86400000).toISOString();
  const now = new Date().toISOString();
  const cq = fq(M.meets_at), pq = prevQ(cq);
  const fyStart = (cq.fy - 1) + '-10-01', fyEnd = cq.fy + '-10-01', pfyStart = (cq.fy - 2) + '-10-01';
  const [team, meta, goals, wins, events, onb, items, comms, members, touch, decs, tasks, fund, fundGoals, fin, stm] = await Promise.all([
    svc.from('team_members').select('id,name,department,start_date').eq('active', true),
    svc.from('dept_meta').select('department,label,short_label,progress,priorities,sort,updated_at').order('sort'),
    svc.from('goals').select('department,quarter,title,status,progress,sort').in('quarter', [cq.label, pq.label, 'FY' + cq.fy, 'FY' + (cq.fy + 1)]).order('sort'),
    svc.from('goal_wins').select('department,win,meeting_date,visibility').gte('meeting_date', ymd(since)).order('meeting_date', { ascending: false }).limit(60),
    svc.from('volunteer_events').select('event_date,status,kind,title,location').gte('event_date', ymd(since)).order('event_date'),
    svc.from('onboardings').select('status,started_at').gte('started_at', ymd(since)),
    svc.from('board_items').select('job,committee,title,detail,status,owner,due,sort').order('sort'),
    svc.from('board_committees').select('key,name,chair_id,member_ids,internal_leads,status,sort').order('sort'),
    svc.from('board_members').select('id,name,full_name,seat,status,renewal,sort').order('sort'),
    svc.from('board_touchpoints').select('committee,kind,happened_on,with_whom,summary,recommendation').gte('happened_on', ymd(since)).order('happened_on', { ascending: false }),
    svc.from('decisions').select('title,area,owner,suggested_move,board_only,confidential,visibility,done').eq('done', false),
    svc.from('dept_tasks').select('department,due_date,done,confidential,banked_at').eq('done', false).is('banked_at', null),
    svc.from('fund_events').select('title,start_date,end_date,timing,status,raised,target_min,target_max').order('start_date'),
    svc.from('hub_settings').select('value').eq('key', 'fund_goals').maybeSingle(),
    svc.from('finance_transactions').select('txn_date,amount').is('duplicate_of', null).gte('txn_date', (cq.fy - 3) + '-10-01').lt('txn_date', fyEnd),
    svc.from('finance_statements').select('period_end').not('period_end', 'is', null).order('period_end', { ascending: false }).limit(1)
  ]);
  const name = (id: number) => { const m = (members.data || []).find((x: Row) => String(x.id) === String(id)); return m ? m.name : ''; };
  const directors = (members.data || []).filter((m: Row) => m.status === 'active');
  const seat = (re: RegExp) => { const m = directors.find((x: Row) => re.test(String(x.seat || ''))); return m ? m.name : ''; };
  const labels: Record<string, Row> = {}; for (const d of meta.data || []) labels[d.department] = d;
  const staff = (team.data || []).filter((t: Row) => t.department !== 'board');
  const newPeople = staff.filter((t: Row) => t.start_date && t.start_date >= ymd(since)).length;
  const served = (events.data || []).filter((e: Row) => e.event_date <= ymd(now) && !/cancel/i.test(String(e.status || '')));
  const upcoming = (events.data || []).filter((e: Row) => e.event_date > ymd(now) && e.event_date <= ymd(M.meets_at) && !/cancel/i.test(String(e.status || '')));
  const openTasks = (tasks.data || []).filter((t: Row) => !t.confidential);
  const depts = TEAMS.filter((k) => labels[k]).map((k) => {
    const gl = (goals.data || []).filter((x: Row) => x.department === k);
    const lastQ = gl.filter((x: Row) => x.quarter === pq.label), thisQ = gl.filter((x: Row) => x.quarter === cq.label);
    const ot = openTasks.filter((t: Row) => t.department === k);
    const base = { key: k, label: labels[k].label || k, people: staff.filter((t: Row) => t.department === k).length, updated: labels[k].updated_at ? dayShort(labels[k].updated_at) : '',
      last_q: { label: pq.label, total: lastQ.length, done: lastQ.filter((x: Row) => DONE.test(String(x.status || ''))).length, risk: lastQ.filter((x: Row) => RISK.test(String(x.status || ''))).map((x: Row) => clip(x.title, 60)) },
      this_q: { label: cq.label, titles: thisQ.map((x: Row) => clip(x.title, 70)) },
      open_tasks: ot.length, overdue: ot.filter((t: Row) => t.due_date && t.due_date < ymd(now)).length };
    if (k === 'hr') return { ...base, progress: '', priorities: [], wins: [], note: 'People matters are for the HR & People committee; this slide shows the counts only.' };
    const pr = Array.isArray(labels[k].priorities) ? labels[k].priorities : [];
    return { ...base, progress: safe(labels[k].progress || '', 430),
      priorities: pr.map((p: unknown) => safe(String(p || ''), 150)).filter(Boolean).slice(0, 3).map((p: string) => clip(p, 105)),
      wins: (wins.data || []).filter((w: Row) => w.department === k && (!w.visibility || w.visibility === 'department')).map((w: Row) => safe(w.win, 140)).filter(Boolean).slice(0, 2) };
  });
  const tx = fin.data || [];
  const sum = (a: string, b: string, sign: number) => tx.filter((t: Row) => t.txn_date >= a && t.txn_date < b && Math.sign(Number(t.amount)) === sign).reduce((s: number, t: Row) => s + Math.abs(Number(t.amount)), 0);
  const lastTxn = tx.reduce((m: string, t: Row) => (t.txn_date > m ? t.txn_date : m), '');
  /* the statements may not reach the meeting's fiscal year yet: compare the year they reach, to its last statement, with the same months a year before */
  const dataFY = lastTxn ? fq(lastTxn + 'T12:00:00Z').fy : cq.fy;
  const dStart = (dataFY - 1) + '-10-01', dEnd = lastTxn ? (() => { const x = new Date(lastTxn + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })() : dataFY + '-10-01';
  const back = (s: string) => (Number(s.slice(0, 4)) - 1) + s.slice(4);

  const fe = fund.data || [];
  const raisedFY = fe.filter((f: Row) => f.start_date && f.start_date >= fyStart && f.start_date < fyEnd).reduce((s: number, f: Row) => s + (Number(f.raised) || 0), 0);
  const raisedPFY = fe.filter((f: Row) => f.start_date && f.start_date >= pfyStart && f.start_date < fyStart).reduce((s: number, f: Row) => s + (Number(f.raised) || 0), 0);
  const nextFund = fe.filter((f: Row) => /planned|confirmed/i.test(String(f.status || '')) && (f.end_date || f.start_date) >= ymd(now)).slice(0, 4)
    .map((f: Row) => ({ title: f.title, when: f.start_date ? dayShort(f.start_date + 'T12:00:00Z') : (f.timing || ''), target: f.target_max ? money(f.target_min || 0) + ' to ' + money(f.target_max) : (f.target_min ? money(f.target_min) : '') }));
  const byJob: Record<string, Row[]> = {};
  const rank: Record<string, number> = { at_risk: 0, in_progress: 1, todo: 2, watch: 3, standing: 4, done: 5 };
  for (const j of JOBS) byJob[j[0]] = (items.data || []).filter((i: Row) => i.job === j[0]).sort((a: Row, b: Row) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (a.sort || 0) - (b.sort || 0))
    .map((i: Row) => ({ title: clip(i.title, 90), status: STATUS[i.status] || i.status, owner: i.owner || '', due: i.due || '' }));
  const committees = (comms.data || []).map((c: Row) => {
    const tp = (touch.data || []).filter((t: Row) => t.committee === c.key);
    const latest = tp[0] ? safe(tp[0].summary || '', 160) : '';
    return { name: c.name, chair: name(c.chair_id), members: (c.member_ids || []).map(name).filter(Boolean), leads: c.internal_leads || [], touchpoints: tp.length, latest };
  });
  const decisions = (decs.data || []).filter((d: Row) => (d.board_only || /board/i.test(String(d.area || ''))) && !d.confidential && (!d.visibility || d.visibility === 'department'))
    .map((d: Row) => ({ title: clip(d.title, 110), move: clip(d.suggested_move || '', 160), owner: d.owner || '' }));
  const atRisk = (items.data || []).filter((i: Row) => i.status === 'at_risk').map((i: Row) => clip(i.title, 110));
  const yr = String(parts(M.meets_at).y);
  const renewals = directors.filter((m: Row) => m.renewal && String(m.renewal).includes(yr)).map((m: Row) => m.name + ' (' + m.renewal + ')');
  const org = (goals.data || []).filter((x: Row) => x.department === 'org').map((x: Row) => ({ title: clip(x.title, 100), status: x.status || '', progress: x.progress }));
  const glance = [
    { n: String(staff.length), l: 'team members, all volunteers' },
    { n: String(served.length), l: 'servings and events since ' + (last ? dayShort(last.meets_at) : 'the last meeting') },
    { n: String(newPeople || (onb.data || []).length), l: 'people who joined the team since then' },
    { n: money(raisedFY || raisedPFY), l: raisedFY ? 'raised at events this fiscal year' : 'raised at events last fiscal year' }
  ];
  const agenda: Row[] = [
    { t: 'Call to order and approval of the agenda', who: seat(/^chair/i) ? seat(/^chair/i) + ' (Chair)' : '' },
    { t: 'Approval of the minutes of the last meeting' + (last ? ' (' + dayShort(last.meets_at) + ')' : ''), link: last && last.notes_url ? last.notes_url : '' },
    { t: 'State of Welfare Avenue: each team, and the numbers', who: 'Co-executive directors' },
    { t: 'Financials overview', who: seat(/treasurer/i) ? seat(/treasurer/i) + ' (Treasurer)' : 'Treasurer' },
    { t: 'The three jobs of the board: leadership, fiduciary oversight, direction and strategy' },
    { t: 'Committee reports: ' + committees.map((c: Row) => c.name).join(', '), who: 'Committee chairs' }
  ];
  if (decisions.length || atRisk.length) agenda.push({ t: 'Decisions for the board', sub: decisions.map((d: Row) => d.title).concat(atRisk).slice(0, 5) });
  agenda.push({ t: 'General discussion' }, { t: 'Next meeting' + (next ? ': ' + dayShort(next.meets_at) : ': set the date') + (strategy ? '; the fiscal year-end strategy session' + (strategy.meets_at ? ' on ' + dayShort(strategy.meets_at) : ' to schedule') : '') });
  return {
    meeting: { id: M.id, title: M.title || 'Board meeting', iso: M.meets_at, day: dayLong(M.meets_at), short: dayShort(M.meets_at), time: timeText(M.meets_at), q: cq.label, status: M.status },
    last: last ? { title: last.title, day: dayShort(last.meets_at), notes_url: last.notes_url || '' } : null,
    next: next ? { title: next.title, day: dayShort(next.meets_at) } : null,
    strategy: strategy ? { title: strategy.title, day: strategy.meets_at ? dayShort(strategy.meets_at) : '' } : null,
    chair: seat(/^chair/i), treasurer: seat(/treasurer/i), directors: directors.map((m: Row) => ({ name: m.full_name || m.name, seat: m.seat || '' })),
    as_of: dayShort(now), since: last ? dayShort(last.meets_at) : '',
    agenda, glance, depts, org, byJob, committees, decisions, at_risk: atRisk, renewals,
    finance: { fy: 'FY' + cq.fy, pfy: 'FY' + (cq.fy - 1), data_fy: 'FY' + dataFY, period: lastTxn ? 'October ' + (dataFY - 1) + ' to ' + MONTHS[Number(lastTxn.slice(5, 7)) - 1] + ' ' + lastTxn.slice(0, 4) : '',
      in_fy: sum(dStart, dEnd, 1), out_fy: sum(dStart, dEnd, -1), in_pfy: sum(back(dStart), back(dEnd), 1), out_pfy: sum(back(dStart), back(dEnd), -1),
      last_txn: lastTxn ? dayShort(lastTxn + 'T12:00:00Z') : '', last_statement: stm.data && stm.data[0] ? dayShort(stm.data[0].period_end + 'T12:00:00Z') : '',
      raised_fy: raisedFY, raised_pfy: raisedPFY, goals: fundGoals.data ? fundGoals.data.value : null, next_events: nextFund },
    upcoming: upcoming.length
  };
}

/* ---------- a Google Doc from paragraphs ---------- */
type Para = { text: string; style?: 'TITLE' | 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'NORMAL_TEXT'; bold?: [number, number][]; link?: { from: number; to: number; url: string }[]; bullet?: 'NUMBER' | 'DISC'; rule?: boolean };
function docRequests(paras: Para[]): Row[] {
  let text = '';
  const starts: number[] = [];
  for (const p of paras) { starts.push(text.length); text += p.text + '\n'; }
  const reqs: Row[] = [{ insertText: { location: { index: 1 }, text } }];
  reqs.push({ updateTextStyle: { range: { startIndex: 1, endIndex: 1 + text.length }, textStyle: { weightedFontFamily: { fontFamily: 'Space Grotesk' }, fontSize: { magnitude: 11, unit: 'PT' } }, fields: 'weightedFontFamily,fontSize' } });
  const groups: { kind: string; s: number; e: number }[] = [];
  paras.forEach((p, i) => {
    const s = 1 + starts[i], e = s + p.text.length + 1;
    if (p.style && p.style !== 'NORMAL_TEXT') {
      reqs.push({ updateParagraphStyle: { range: { startIndex: s, endIndex: e }, paragraphStyle: { namedStyleType: p.style }, fields: 'namedStyleType' } });
      reqs.push({ updateTextStyle: { range: { startIndex: s, endIndex: e - 1 }, textStyle: { weightedFontFamily: { fontFamily: 'Barlow Condensed' }, foregroundColor: { color: { rgbColor: rgb('#103F39') } }, bold: true, fontSize: { magnitude: p.style === 'TITLE' ? 26 : p.style === 'HEADING_1' ? 18 : 14, unit: 'PT' } }, fields: 'weightedFontFamily,foregroundColor,bold,fontSize' } });
    }
    for (const b of p.bold || []) reqs.push({ updateTextStyle: { range: { startIndex: s + b[0], endIndex: s + b[1] }, textStyle: { bold: true }, fields: 'bold' } });
    for (const l of p.link || []) reqs.push({ updateTextStyle: { range: { startIndex: s + l.from, endIndex: s + l.to }, textStyle: { link: { url: l.url } }, fields: 'link' } });
    if (p.rule) reqs.push({ updateParagraphStyle: { range: { startIndex: s, endIndex: e }, paragraphStyle: { borderBottom: { color: { color: { rgbColor: rgb('#103F39') } }, width: { magnitude: 1, unit: 'PT' }, padding: { magnitude: 6, unit: 'PT' }, dashStyle: 'SOLID' } }, fields: 'borderBottom' } });
    if (p.bullet) {
      const lastG = groups[groups.length - 1];
      if (lastG && lastG.kind === p.bullet && lastG.e === s) lastG.e = e; else groups.push({ kind: p.bullet, s, e });
    }
  });
  /* lists last, and the last list first: a leading tab (a sub-item) comes out when its list is made, which moves what follows */
  for (const gr of groups.slice().reverse()) reqs.push({ createParagraphBullets: { range: { startIndex: gr.s, endIndex: gr.e }, bulletPreset: gr.kind === 'NUMBER' ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE' } });
  return reqs;
}
function labelled(label: string, value: string, url?: string): Para {
  const p: Para = { text: label + ': ' + value, bold: [[0, label.length + 1]] };
  if (url && value) p.link = [{ from: label.length + 2, to: label.length + 2 + value.length, url }];
  return p;
}
function agendaDoc(c: Row, links: Row): Para[] {
  const m = c.meeting;
  const out: Para[] = [
    { text: 'Agenda', style: 'TITLE' },
    { text: 'Welfare Avenue' },
    labelled('Meeting', 'Board of Directors Meeting (' + m.title + ')'),
    labelled('Date', m.day),
    labelled('Time', m.time),
    labelled('Location', 'Virtual (Google Meet)'),
    { ...labelled('Video call link', 'add the link from the calendar invitation'), rule: true },
    { text: '' },
    labelled('Meeting notes for today', 'Board Meeting Notes - ' + MONTHS[parts(m.iso).m - 1] + ' ' + parts(m.iso).y, links.notes),
    labelled('The deck', 'WA Board Meeting ' + ymd(m.iso).replace(/-/g, ''), links.deck),
    { text: '' },
    { text: 'Items', style: 'HEADING_2' }
  ];
  for (const it of c.agenda) {
    const t = it.t + (it.who ? ' (' + it.who + ')' : '');
    const p: Para = { text: t, bullet: 'NUMBER' };
    if (it.link) { p.text = t + ' minutes'; p.link = [{ from: t.length + 1, to: t.length + 8, url: it.link }]; }
    out.push(p);
    for (const s of it.sub || []) out.push({ text: '\t' + s, bullet: 'NUMBER' });
  }
  out.push({ text: '' }, { text: 'Prepared by the Welfare Avenue Hub on ' + c.as_of + ' from the teams\' own updates. Edit anything.' });
  return out;
}
function notesDoc(c: Row, links: Row): Para[] {
  const m = c.meeting;
  const out: Para[] = [
    { text: 'Board Meeting Notes', style: 'TITLE' },
    { text: 'Welfare Avenue' },
    labelled('Meeting', 'Board of Directors Meeting (' + m.title + ')'),
    labelled('Date', m.day),
    labelled('Time', m.time),
    { ...labelled('Location', 'Virtual (Google Meet)'), rule: true },
    labelled('The agenda', 'the agenda for this meeting', links.agenda),
    { text: '' },
    { text: 'Call to order', style: 'HEADING_2' },
    labelled('Time called to order', ''),
    labelled('Chairperson', c.chair || ''),
    { text: 'Roll call and attendance', style: 'HEADING_2' }
  ];
  for (const d of c.directors) out.push({ text: d.name + (d.seat ? ', ' + d.seat : '') + ': present / absent', bullet: 'DISC' });
  out.push({ text: 'Guests:' });
  out.push({ text: 'Approval of the agenda', style: 'HEADING_2' }, labelled('Motion to approve the agenda', ''), labelled('Seconded by', ''), labelled('Decision', ''));
  out.push({ text: 'Approval of the previous meeting\'s minutes', style: 'HEADING_2' }, labelled('Motion to approve the minutes of', c.last ? c.last.day : ''), labelled('Seconded by', ''), labelled('Decision', ''));
  out.push({ text: 'Topics', style: 'HEADING_2' });
  c.agenda.slice(2).forEach((it: Row, i: number) => {
    out.push({ text: (i + 1) + '. ' + it.t, style: 'HEADING_3' }, labelled('Notes', ''), labelled('Motion or decision', ''));
  });
  out.push({ text: 'Action items', style: 'HEADING_2' }, { text: 'Who, what, by when', bullet: 'DISC' });
  out.push({ text: 'Close', style: 'HEADING_2' }, labelled('Next meeting', c.next ? c.next.day : ''), labelled('Adjourned at', ''));
  return out;
}

/* ---------- the deck (Slides), in the brand: cream pages, community green, gold kickers ---------- */
function rgb(hex: string) { const n = parseInt(hex.slice(1), 16); return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 }; }
const GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#797773', TILE = '#F3EBDD', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB';
const IN = 914400, W = 10 * IN, H = 5.625 * IN;
type Run = { t: string; bold?: boolean; color?: string; size?: number; font?: string };
class Deck {
  reqs: Row[] = []; n = 0; idx = 0; tag: string; page = 0;
  constructor(tag: string) { this.tag = tag; }
  id(p: string) { return 'wagen' + this.tag + p + (++this.n); }
  slide(bg = CREAM): string {
    const sid = this.id('s');
    this.reqs.push({ createSlide: { objectId: sid, insertionIndex: this.idx++, slideLayoutReference: { predefinedLayout: 'BLANK' } } });
    this.reqs.push({ updatePageProperties: { objectId: sid, pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: rgb(bg) } } } }, fields: 'pageBackgroundFill.solidFill.color' } });
    this.page++;
    return sid;
  }
  box(sid: string, x: number, y: number, w: number, h: number, fill?: string): string {
    const oid = this.id(fill ? 'r' : 't');
    this.reqs.push({ createShape: { objectId: oid, shapeType: fill ? 'ROUND_RECTANGLE' : 'TEXT_BOX', elementProperties: { pageObjectId: sid, size: { width: { magnitude: Math.round(w * IN), unit: 'EMU' }, height: { magnitude: Math.round(h * IN), unit: 'EMU' } }, transform: { scaleX: 1, scaleY: 1, translateX: Math.round(x * IN), translateY: Math.round(y * IN), unit: 'EMU' } } } });
    if (fill) this.reqs.push({ updateShapeProperties: { objectId: oid, shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: rgb(fill) } } }, outline: { propertyState: 'NOT_RENDERED' }, contentAlignment: 'TOP' }, fields: 'shapeBackgroundFill.solidFill.color,outline.propertyState,contentAlignment' } });
    return oid;
  }
  /* runs of styled text in a box; paragraphs split on \n; bullets for the given paragraph indexes */
  text(oid: string, runs: Run[], o: { align?: string; space?: number; bullets?: boolean; line?: number } = {}) {
    const full = runs.map((r) => r.t).join('');
    if (!full) return;
    this.reqs.push({ insertText: { objectId: oid, text: full } });
    let at = 0;
    for (const r of runs) {
      if (r.t.length) {
        this.reqs.push({ updateTextStyle: { objectId: oid, textRange: { type: 'FIXED_RANGE', startIndex: at, endIndex: at + r.t.length }, style: { fontFamily: r.font || 'Space Grotesk', fontSize: { magnitude: r.size || 11, unit: 'PT' }, bold: !!r.bold, foregroundColor: { opaqueColor: { rgbColor: rgb(r.color || INK) } } }, fields: 'fontFamily,fontSize,bold,foregroundColor' } });
      }
      at += r.t.length;
    }
    this.reqs.push({ updateParagraphStyle: { objectId: oid, textRange: { type: 'ALL' }, style: { alignment: o.align || 'START', spaceBelow: { magnitude: o.space ?? 4, unit: 'PT' }, lineSpacing: o.line || 110 }, fields: 'alignment,spaceBelow,lineSpacing' } });
    if (o.bullets) this.reqs.push({ createParagraphBullets: { objectId: oid, textRange: { type: 'ALL' }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
  }
  put(sid: string, x: number, y: number, w: number, h: number, runs: Run[], o: { align?: string; space?: number; bullets?: boolean; line?: number; fill?: string } = {}) { const oid = this.box(sid, x, y, w, h, o.fill); this.text(oid, runs, o); return oid; }
  /* the frame of a content slide: a gold kicker, a green title, the page number and the name */
  frame(kicker: string, title: string): string {
    const sid = this.slide(CREAM);
    this.put(sid, 0.5, 0.32, 7, 0.3, [{ t: kicker.toUpperCase(), bold: true, color: GOLD, size: 10 }]);
    this.put(sid, 0.5, 0.55, 9, 0.6, [{ t: title, bold: true, color: GREEN, size: 26, font: 'Barlow Condensed' }]);
    this.put(sid, 0.5, 5.2, 5, 0.3, [{ t: 'WELFARE AVENUE', bold: true, color: GREEN, size: 8 }]);
    this.put(sid, 8.9, 5.2, 0.6, 0.3, [{ t: String(this.page), color: MUTED, size: 8 }], { align: 'END' });
    return sid;
  }
}
function lines(items: string[], empty: string): Run[] {
  const list = items.filter(Boolean);
  if (!list.length) return [{ t: empty, color: MUTED, size: 10 }];
  return [{ t: list.join('\n'), size: 10.5 }];
}
function deckRequests(c: Row, tag: string): Row[] {
  const d = new Deck(tag), m = c.meeting;
  /* 1. the cover */
  let s = d.slide(GREEN);
  d.put(s, 0.7, 0.9, 8, 0.4, [{ t: 'WELFARE AVENUE', bold: true, color: GOLD, size: 12 }]);
  d.put(s, 0.7, 1.4, 8.6, 1.2, [{ t: 'Board of Directors Meeting', bold: true, color: CREAM, size: 44, font: 'Barlow Condensed' }]);
  d.put(s, 0.7, 2.6, 8.6, 0.5, [{ t: m.title + '  ·  ' + m.day + '  ·  ' + m.time, color: CREAM, size: 14 }]);
  d.put(s, 0.7, 4.55, 8.6, 0.6, [{ t: 'Prepared by the Welfare Avenue Hub on ' + c.as_of + ' from the teams\' own updates and the numbers in the Hub. Every slide can be edited.', color: '#CFE0DA', size: 9 }]);
  /* 2. the agenda */
  s = d.frame('Agenda', 'Tonight');
  d.put(s, 0.5, 1.3, 9, 3.8, [{ t: c.agenda.map((a: Row, i: number) => (i + 1) + '.  ' + a.t + (a.who ? ' (' + a.who + ')' : '')).join('\n'), size: 13 }], { space: 7 });
  /* 3. at a glance */
  s = d.frame('State of Welfare Avenue', 'At a glance');
  c.glance.forEach((x: Row, i: number) => {
    const X = 0.5 + i * 2.28;
    d.put(s, X, 1.45, 2.1, 1.7, [{ t: x.n + '\n', bold: true, color: GREEN, size: 34, font: 'Barlow Condensed' }, { t: x.l, color: INK, size: 10 }], { fill: TILE, space: 2 });
  });
  const fy = c.finance;
  d.put(s, 0.5, 3.45, 9, 1.5, [{ t: 'Coming up before the meeting: ', bold: true, size: 10.5 }, { t: c.upcoming + ' more servings and events are planned. ', size: 10.5 },
    { t: 'Committees: ', bold: true, size: 10.5 }, { t: c.committees.reduce((n: number, k: Row) => n + k.touchpoints, 0) + ' touchpoints logged since ' + (c.since || 'the last meeting') + '.', size: 10.5 }], { space: 6 });
  /* 4. each team */
  for (const t of c.depts) {
    s = d.frame('State of Welfare Avenue', t.label);
    const lq = t.last_q, goalsLine = lq.total ? lq.done + ' of ' + lq.total + ' goals done in ' + lq.label + (lq.risk.length ? '; behind: ' + lq.risk.slice(0, 2).join('; ') : '') + '.' : 'No goals recorded for ' + lq.label + '.';
    const left: Run[] = t.key === 'hr'
      ? [{ t: t.note + '\n\n', size: 11 }, { t: t.people + ' people in the team', bold: true, size: 11 }]
      : [{ t: 'Where we are\n', bold: true, color: GREEN, size: 11 }, { t: (t.progress || 'No update in the Hub yet.') + '\n\n', size: 10.5 },
         { t: 'Wins since the last meeting\n', bold: true, color: GREEN, size: 11 }, { t: t.wins.length ? t.wins.join('\n') : 'None recorded yet.', size: 10.5, color: t.wins.length ? INK : MUTED }];
    d.put(s, 0.5, 1.3, 5.2, 3.8, left, { space: 3 });
    /* keep the panel within its box: at most about 420 characters of goals and next steps */
    const pri: string[] = []; let room = 420 - goalsLine.length - (t.this_q.titles.slice(0, 2).join('; ').length);
    for (const x of t.priorities) { if (x.length > room && pri.length) break; pri.push(x); room -= x.length; }
    const right: Run[] = [{ t: 'Goals\n', bold: true, color: GREEN, size: 11 }, { t: goalsLine + '\n', size: 9.5 },
      { t: t.this_q.titles.length ? t.this_q.label + ': ' + t.this_q.titles.slice(0, 2).join('; ') + '\n\n' : '\n', size: 9.5 },
      { t: 'Next\n', bold: true, color: GREEN, size: 11 }, { t: (pri.length ? pri.join('\n') : 'No priorities in the Hub yet.') + '\n\n', size: 9.5, color: pri.length ? INK : MUTED },
      { t: t.open_tasks + ' open tasks' + (t.overdue ? ', ' + t.overdue + ' overdue' : '') + '  ·  ' + t.people + ' people' + (t.updated && t.key !== 'hr' ? '\nTeam update of ' + t.updated : ''), size: 9, color: MUTED }];
    d.put(s, 6, 1.3, 3.5, 3.8, right, { space: 3, fill: TILE });
  }
  /* 5. the organizational goals */
  if (c.org.length) {
    s = d.frame('Direction', 'Organizational goals');
    d.put(s, 0.5, 1.3, 9, 3.8, c.org.map((o: Row) => ({ t: o.title + '  (' + (o.status || 'in progress') + (o.progress != null ? ', ' + Math.round(Number(o.progress) * (Number(o.progress) <= 1 ? 100 : 1)) + '%' : '') + ')\n', size: 12 })), { space: 8 });
  }
  /* 6. the finances, as totals */
  s = d.frame('Fiduciary', 'Finances');
  const tiles = [[money(fy.in_fy), 'money in, ' + (fy.period || fy.data_fy)], [money(fy.out_fy), 'money out, the same months'], [money(fy.in_pfy), 'money in, the same months a year before'], [money(fy.out_pfy), 'money out, a year before']];
  tiles.forEach((x, i) => { d.put(s, 0.5 + i * 2.28, 1.4, 2.1, 1.35, [{ t: x[0] + '\n', bold: true, color: GREEN, size: 26, font: 'Barlow Condensed' }, { t: x[1], size: 9.5 }], { fill: TILE, space: 2 }); });
  d.put(s, 0.5, 2.95, 4.4, 2.1, [{ t: 'Fundraising\n', bold: true, color: GREEN, size: 11 }, { t: money(fy.raised_fy) + ' raised at events in ' + fy.fy + ' (' + money(fy.raised_pfy) + ' in ' + fy.pfy + ').\n', size: 10.5 },
    { t: fy.next_events.length ? 'Next: ' + fy.next_events.map((e: Row) => e.title + ' (' + e.when + (e.target ? ', target ' + e.target : '') + ')').join('; ') : 'No fundraising event planned yet.', size: 10.5 }], { space: 3 });
  d.put(s, 5.1, 2.95, 4.4, 2.1, [{ t: 'About these numbers\n', bold: true, color: GREEN, size: 11 }, { t: 'Totals from the bank statements in the Hub' + (fy.last_txn ? ', up to ' + fy.last_txn : '') + ': money in includes transfers, not only donations. The Treasurer\'s statements lead.', size: 10, color: MUTED }], { space: 3 });
  /* 7. the three jobs */
  s = d.frame('The board', 'The three jobs of the board');
  JOBS.forEach((j, i) => {
    const list = (c.byJob[j[0]] || []).filter((x: Row) => x.status !== 'Done').slice(0, 5);
    const done = (c.byJob[j[0]] || []).filter((x: Row) => x.status === 'Done').length;
    d.put(s, 0.5 + i * 3.05, 1.3, 2.9, 3.75, [{ t: j[1] + '\n', bold: true, color: GREEN, size: 13, font: 'Barlow Condensed' }, { t: j[2] + '\n\n', size: 9, color: MUTED },
      ...list.flatMap((x: Row) => [{ t: x.status + '  ', bold: true, size: 9, color: x.status === 'At risk' ? FLAG : x.status === 'In progress' ? TEAL : PURPLE }, { t: x.title + '\n', size: 10 }]),
      { t: done ? '\n' + done + ' done' : '', size: 9, color: MUTED }], { fill: TILE, space: 3 });
  });
  /* 8. the committees */
  s = d.frame('The board', 'Committees');
  c.committees.forEach((k: Row, i: number) => {
    const X = 0.5 + (i % 2) * 4.6, Y = 1.3 + Math.floor(i / 2) * 1.9;
    d.put(s, X, Y, 4.4, 1.75, [{ t: k.name + '\n', bold: true, color: GREEN, size: 13, font: 'Barlow Condensed' }, { t: 'Chair: ' + (k.chair || 'to confirm') + (k.members.length ? '  ·  ' + k.members.join(', ') : '') + '\n', size: 9.5 },
      { t: (k.leads.length ? 'With ' + k.leads.join(', ') + '\n' : ''), size: 9.5, color: MUTED }, { t: k.touchpoints + ' touchpoint' + (k.touchpoints === 1 ? '' : 's') + ' since the last meeting' + (k.latest ? ': ' + k.latest : '.'), size: 9.5 }], { fill: TILE, space: 2 });
  });
  /* 9. decisions for the board */
  s = d.frame('For the board', 'Decisions and items at risk');
  const decs = c.decisions.map((x: Row) => x.title + (x.move ? ': ' + x.move : '')).concat(c.at_risk.map((x: string) => 'At risk: ' + x));
  d.put(s, 0.5, 1.3, 9, 3.8, lines(decs.slice(0, 7), 'Nothing is waiting on the board.'), { space: 8 });
  /* 10. next */
  s = d.frame('Next', 'What comes next');
  const nx = [c.next ? 'Next board meeting: ' + c.next.day : 'Set the date of the next board meeting.', c.strategy ? 'Fiscal year-end strategy session: ' + (c.strategy.day || 'to schedule') : '',
    c.renewals.length ? 'Renewals due: ' + c.renewals.join(', ') : '', 'Committees meet a week before each board meeting.'].filter(Boolean);
  d.put(s, 0.5, 1.3, 9, 3.8, [{ t: nx.join('\n'), size: 13 }], { space: 9 });
  return d.reqs;
}

/* ---------- Drive: the folder, and files in it ---------- */
async function boardFolder(m: Row): Promise<{ id: string; url: string }> {
  const drives = await g(DRIVE + '/drives?pageSize=100&q=' + encodeURIComponent("name = 'Board of Directors'"));
  const drive = (drives.drives || [])[0];
  if (!drive) throw new Error('The Board of Directors shared drive is not visible to the Hub');
  const year = parts(m.meets_at).y;
  const inDrive = '&corpora=drive&driveId=' + drive.id + '&includeItemsFromAllDrives=true&supportsAllDrives=true';
  const find = async (name: string, parent: string) => {
    const r = await g(DRIVE + '/files?q=' + encodeURIComponent('name = ' + q(name) + " and mimeType = 'application/vnd.google-apps.folder' and " + q(parent) + ' in parents and trashed = false') + inDrive + '&fields=files(id,webViewLink)');
    return (r.files || [])[0] || null;
  };
  const make = async (name: string, parent: string) => g(DRIVE + '/files?supportsAllDrives=true&fields=id,webViewLink', 'POST', { name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] });
  const yearName = 'Board Meetings ' + year;
  const yf = (await find(yearName, drive.id)) || (await make(yearName, drive.id));
  const p = parts(m.meets_at);
  const name = MONTHS[p.m - 1] + ' ' + ord(p.d) + ' - ' + (m.title || 'Board meeting');
  const mf = (await find(name, yf.id)) || (await make(name, yf.id));
  return { id: mf.id, url: mf.webViewLink || 'https://drive.google.com/drive/folders/' + mf.id };
}
async function newFile(name: string, mime: string, folder: string): Promise<{ id: string; url: string }> {
  const f = await g(DRIVE + '/files?supportsAllDrives=true&fields=id,webViewLink', 'POST', { name, mimeType: mime, parents: [folder] });
  return { id: f.id, url: f.webViewLink };
}
async function writeDeck(deckId: string, c: Row) {
  const pres = await g(SLIDES + deckId + '?fields=slides(objectId)');
  const old = (pres.slides || []).map((x: Row) => String(x.objectId));
  const fresh = !old.some((id: string) => id.startsWith('wagen'));
  const tag = Date.now().toString(36).slice(-5);
  const reqs = deckRequests(c, tag);
  /* the Hub's own slides go first; on a first build the empty default slide goes, on a refresh the Hub's old slides go */
  const drop = old.filter((id: string) => fresh || id.startsWith('wagen')).map((id: string) => ({ deleteObject: { objectId: id } }));
  for (let i = 0; i < reqs.length; i += 400) await g(SLIDES + deckId + ':batchUpdate', 'POST', { requests: reqs.slice(i, i + 400) });
  if (drop.length) await g(SLIDES + deckId + ':batchUpdate', 'POST', { requests: drop });
  return reqs.filter((r) => r.createSlide).length;
}

async function clearDoc(id: string) {
  const d = await g(DOCS + id + '?fields=body(content(endIndex))');
  const end = Math.max(...((d.body && d.body.content) || [{ endIndex: 1 }]).map((x: Row) => Number(x.endIndex) || 1));
  if (end > 2) await g(DOCS + id + ':batchUpdate', 'POST', { requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: end - 1 } } }] });
}
async function build(meetingId: number, who: string, refreshOnly: boolean, rewrite = false): Promise<Row> {
  const c = await gather(meetingId);
  const { data: M } = await svc.from('board_meetings').select('*').eq('id', meetingId).maybeSingle();
  const pack: Row = (M && M.pack) || {};
  if (refreshOnly) {
    if (!pack.deck_id) throw new Error('Build the board pack first');
    const n = await writeDeck(pack.deck_id, c);
    const np = { ...pack, refreshed_at: new Date().toISOString(), refreshed_by: who, as_of: c.as_of };
    await svc.from('board_meetings').update({ pack: np, updated_at: new Date().toISOString(), updated_by: who }).eq('id', meetingId);
    await svc.from('change_log').insert({ entity_type: 'board_pack', entity_id: String(meetingId), field: 'refreshed', old_value: null, new_value: 'deck numbers as of ' + c.as_of + ' (' + n + ' slides)', changed_by: who });
    return { ok: true, refreshed: true, slides: n, pack: np };
  }
  if (pack.agenda_ok && pack.notes_ok && pack.deck_ok && !rewrite) return { ok: true, already: true, pack };
  if (rewrite) { for (const k of ['agenda', 'notes']) if (pack[k + '_id']) { await clearDoc(pack[k + '_id']); pack[k + '_ok'] = false; } }
  /* each step is saved as it lands, so a second try carries on where the first stopped and never makes a file twice */
  const save = async (patch: Row) => { Object.assign(pack, patch); await svc.from('board_meetings').update({ pack }).eq('id', meetingId); };
  const p = parts(M.meets_at);
  if (!pack.folder_id) { const f = await boardFolder(M); await save({ folder_id: f.id, folder_url: f.url }); }
  if (!pack.agenda_id) { const f = await newFile(MONTHS[p.m - 1] + ' ' + ord(p.d) + ' - Board Agenda', 'application/vnd.google-apps.document', pack.folder_id); await save({ agenda_id: f.id, agenda_url: f.url }); }
  if (!pack.notes_id) { const f = await newFile('Board Meeting Notes - ' + MONTHS[p.m - 1] + ' ' + p.y, 'application/vnd.google-apps.document', pack.folder_id); await save({ notes_id: f.id, notes_url: f.url }); }
  if (!pack.deck_id) { const f = await newFile('WA Board Meeting ' + ymd(M.meets_at).replace(/-/g, ''), 'application/vnd.google-apps.presentation', pack.folder_id); await save({ deck_id: f.id, deck_url: f.url }); }
  const links = { agenda: pack.agenda_url, notes: pack.notes_url, deck: pack.deck_url };
  if (!pack.agenda_ok) { await g(DOCS + pack.agenda_id + ':batchUpdate', 'POST', { requests: docRequests(agendaDoc(c, links)) }); await save({ agenda_ok: true }); }
  if (!pack.notes_ok) { await g(DOCS + pack.notes_id + ':batchUpdate', 'POST', { requests: docRequests(notesDoc(c, links)) }); await save({ notes_ok: true }); }
  const n = await writeDeck(pack.deck_id, c);
  await save({ deck_ok: true, built_at: new Date().toISOString(), built_by: who, as_of: c.as_of });
  await svc.from('board_meetings').update({ agenda_url: pack.agenda_url, notes_url: pack.notes_url, deck_url: pack.deck_url, updated_at: new Date().toISOString(), updated_by: who }).eq('id', meetingId);
  await svc.from('change_log').insert({ entity_type: 'board_pack', entity_id: String(meetingId), field: 'built', old_value: null, new_value: 'agenda, meeting notes and deck (' + n + ' slides) for ' + c.meeting.title + ', ' + c.meeting.short, changed_by: who });
  return { ok: true, built: true, slides: n, pack, links };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'Only the executive directors and admins can build the board pack' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'preview');
  const id = Number(body.meeting_id);
  if (!id) return json({ error: 'meeting_id required' }, 400);
  try {
    if (action === 'preview') return json({ ok: true, content: await gather(id) });
    if (action === 'build') return json(await build(id, who, false, body.rewrite === true && who === 'automation'));
    if (action === 'refresh') return json(await build(id, who, true));
    /* a PDF of one of the pack's files, for checking the layout (the automation only) */
    if (action === 'pdf' && who === 'automation') {
      const { data: M } = await svc.from('board_meetings').select('pack').eq('id', id).maybeSingle();
      const fid = M && M.pack ? M.pack[(String(body.which || 'deck')) + '_id'] : null;
      if (!fid) return json({ error: 'no such file in the pack' }, 404);
      const res = await fetch(DRIVE + '/files/' + fid + '/export?mimeType=application/pdf', { headers: { Authorization: 'Bearer ' + (await token()) } });
      if (!res.ok) return json({ error: 'export ' + res.status }, 500);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return json({ ok: true, b64: btoa(s) });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 400), at: String((e as Error).stack || '').slice(0, 900) }, 500);
  }
});
