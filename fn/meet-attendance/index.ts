// Welfare Avenue: meet-attendance (v1, wave144, 26/09/26)
// Who came to the team meetings, the leadership meetings and the board meetings, from the Google Meet log.
// Sources:
//   - the Meet log (Admin Reports API, application meet, event call_ended: one row per person leaving a call, with the
//     meeting code, the conference, the calendar event, the organizer, who it was and how long they stayed; kept 6 months
//     by Google, so the Hub keeps its own copy);
//   - the hub@ calendar (the meetings people invited hub@ to: each team's meeting and the leadership meetings), for the
//     scheduled time and who was invited;
//   - board_meetings and board_members, for the board meetings (the directors are expected).
// A call is matched to a scheduled meeting by its Meet code and time (a call restarted on the same link counts once). A call
// on a team's link with no meeting scheduled is kept when two or more people came. People are recognised by their Google
// account (aliases folded) or, when signed out, by their display name against the people invited, then the roster.
// Stored: meet_meetings (one row per meeting) and meet_attendance (one row per expected person and per recognised person who
// came without an invitation). Anyone not recognised is only counted (guests_n). Nothing else from the log is kept.
// Actions:
//   status             the last run (admins, the Executive profile, the automation)
//   sync {days, dry}   read the window (default 10 days, at most 180), match, write; dry returns the result without writing
// Callers: the trigger secret (the daily run), or an admin or someone on the Executive profile with their Hub session.
// Google: the Reports API through the service account acting as steel.macdonald@welfareavenue.com (domain-wide delegation,
// scope admin.reports.audit.readonly); the hub@ calendar through the service account itself (calendar.readonly, shared).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const ACTOR = 'steel.macdonald@welfareavenue.com';
const HUB_CAL = 'hub@welfareavenue.com';
const DOMAIN = '@welfareavenue.com';
const CAME_SECS = 180;
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
/* who is asking: the automation by the trigger secret, or an admin or the Executive profile by their Hub session */
async function caller(req: Request): Promise<string | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('wa_org_editor'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---------- Google tokens: delegated (Reports) and the service account itself (the shared hub@ calendar) ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
const TOKENS: Record<string, { v: string; exp: number }> = {};
async function token(scope: string, sub: string | null): Promise<string> {
  const k = scope + '|' + (sub || '');
  if (TOKENS[k] && Date.now() < TOKENS[k].exp - 120000) return TOKENS[k].v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const c: Row = { iss: sa.client_email, scope, aud: sa.token_uri, iat: now, exp: now + 3600 };
  if (sub) c.sub = sub;
  const claims = b64url(enc.encode(JSON.stringify(c)));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the token (' + scope.split('/').pop() + '): ' + String(body.error_description || body.error || res.status).slice(0, 200));
  TOKENS[k] = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOKENS[k].v;
}
const REPORTS = 'https://www.googleapis.com/auth/admin.reports.audit.readonly';
const CALRO = 'https://www.googleapis.com/auth/calendar.readonly';
async function gget(url: string, scope: string, sub: string | null): Promise<Row> {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + (await token(scope, sub)) } });
  const txt = await res.text();
  let j: Row = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt.slice(0, 300) }; }
  if (!res.ok) throw new Error('GET ' + url.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, '') + ': ' + res.status + ' ' + String((j.error as Row)?.message || txt).slice(0, 240));
  return j;
}

/* ---------- the Meet log ---------- */
type Hit = { conf: string; code: string; cal: string; org: string; who: string; type: string; name: string; secs: number; start: number; ext: boolean };
function param(ev: Row, name: string): unknown {
  const p = (ev.parameters || []).find((x: Row) => x.name === name);
  if (!p) return undefined;
  return p.value ?? p.intValue ?? p.boolValue;
}
const codeNorm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
async function meetLog(startIso: string, endIso: string): Promise<{ hits: Hit[]; oldest: string }> {
  const hits: Hit[] = [];
  let pageToken = '', oldest = '';
  for (let i = 0; i < 80; i++) {
    const u = new URL('https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/meet');
    u.searchParams.set('eventName', 'call_ended'); u.searchParams.set('startTime', startIso); u.searchParams.set('endTime', endIso); u.searchParams.set('maxResults', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const j = await gget(u.toString(), REPORTS, ACTOR);
    for (const it of j.items || []) for (const ev of it.events || []) {
      if (ev.name !== 'call_ended') continue;
      const at = String(it.id?.time || '');
      if (at && (!oldest || at < oldest)) oldest = at;
      const secs = Number(param(ev, 'duration_seconds') || 0);
      let start = Number(param(ev, 'start_timestamp_seconds') || 0);
      if (!start && at) start = Math.round(new Date(at).getTime() / 1000) - secs;
      hits.push({ conf: String(param(ev, 'conference_id') || ''), code: codeNorm(param(ev, 'meeting_code')), cal: String(param(ev, 'calendar_event_id') || ''),
        org: String(param(ev, 'organizer_email') || '').toLowerCase(), who: String(param(ev, 'identifier') || '').toLowerCase(), type: String(param(ev, 'identifier_type') || ''),
        name: String(param(ev, 'display_name') || ''), secs, start, ext: param(ev, 'is_external') === true || param(ev, 'is_external') === 'true' });
    }
    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
  }
  return { hits, oldest };
}

/* ---------- the hub@ calendar ---------- */
async function calendar(startIso: string, endIso: string): Promise<Row[]> {
  const out: Row[] = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const u = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(HUB_CAL) + '/events');
    u.searchParams.set('singleEvents', 'true'); u.searchParams.set('orderBy', 'startTime'); u.searchParams.set('maxResults', '250');
    u.searchParams.set('timeMin', startIso); u.searchParams.set('timeMax', endIso);
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const j = await gget(u.toString(), CALRO, null);
    out.push(...(j.items || []));
    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}
function codeOf(ev: Row): string {
  const link = ev.hangoutLink || ((ev.conferenceData?.entryPoints || []).find((e: Row) => e.entryPointType === 'video') || {}).uri || '';
  const m = String(link).match(/meet\.google\.com\/([a-z]{3}-?[a-z]{4}-?[a-z]{3})/i);
  return codeNorm(m ? m[1] : (ev.conferenceData?.conferenceSolution?.key?.type === 'hangoutsMeet' ? ev.conferenceData?.conferenceId : ''));
}

/* ---------- people ---------- */
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const dotless = (e: string) => { const i = e.indexOf('@'); return i < 0 ? e : e.slice(0, i).replace(/\./g, '') + e.slice(i); };
function norm(s: unknown): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/['’-]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
/* meeting bots (notetakers and recorders) are not people and are not counted */
const BOT = /note ?taker|notetaker|read\.ai|otter\.ai|\botter\b|fireflies|fathom|tl;?dv|\brecorder\b|\bbot\b|meetgeek|fellow\.app|krisp/i;
function nonPerson(e: string): boolean {
  return !e || e === HUB_CAL || /gserviceaccount\.com$|resource\.calendar\.google\.com$|group\.calendar\.google\.com$/.test(e) || /^(info|admin|loom|hub|noreply|no-reply)@/.test(e);
}
type Cand = { key: string; names: string[] };
/* a display name to one person: the full name, or the first name with the last name or its initial, or a first name only one
   of them has */
function nameMatch(display: string, cands: Cand[], strict = false): string | null {
  const d = norm(display); if (!d) return null;
  const exact = cands.filter((c) => c.names.some((n) => norm(n) === d));
  if (exact.length === 1) return exact[0].key;
  if (exact.length > 1 || strict) return null;
  const dt = d.split(' ');
  const hits = cands.filter((c) => c.names.some((n) => {
    const t = norm(n).split(' '); if (!t[0] || t[0] !== dt[0]) return false;
    if (dt.length === 1) return true;
    const last = t[t.length - 1], dl = dt[dt.length - 1];
    return t.length > 1 && (last === dl || (dl.length === 1 && last[0] === dl));
  }));
  return hits.length === 1 ? hits[0].key : null;
}

type Person = { key: string; member?: Row; director?: Row; name: string };
async function roster() {
  const [tm, dir, bm, roles, meta] = await Promise.all([
    svc.from('team_members').select('id,name,email,department,active'),
    svc.from('hub_directory').select('email,member_id,aliases,full_name'),
    svc.from('board_members').select('id,name,full_name,emails,status'),
    svc.from('hub_roles').select('email,role,profile'),
    svc.from('dept_meta').select('department,calendar_match,label')
  ]);
  for (const r of [tm, dir, bm, roles, meta]) if (r.error) throw new Error('roster: ' + r.error.message);
  const canon = new Map<string, string>();
  for (const d of dir.data || []) {
    const p = lower(d.email); if (!p) continue;
    canon.set(p, p);
    for (const a of d.aliases || []) if (lower(a)) canon.set(lower(a), p);
  }
  for (const [k, p] of [...canon.entries()]) if (k.endsWith(DOMAIN) && !canon.has(dotless(k))) canon.set(dotless(k), p);
  const C = (e: unknown) => { const x = lower(e); if (!x) return ''; return canon.get(x) || canon.get(dotless(x)) || x; };
  const members = (tm.data || []) as Row[];
  const byId = new Map<number, Row>(members.map((m) => [Number(m.id), m]));
  const memberBy = new Map<string, Row>();
  const put = (e: string, m: Row) => { if (!e) return; const cur = memberBy.get(e); if (!cur || (!cur.active && m.active)) memberBy.set(e, m); };
  for (const m of members) put(C(m.email), m);
  for (const d of dir.data || []) if (d.member_id && byId.has(Number(d.member_id))) put(C(d.email), byId.get(Number(d.member_id))!);
  const dirName = new Map<string, string>((dir.data || []).map((d: Row) => [lower(d.email), d.full_name || '']));
  const directors = (bm.data || []) as Row[];
  const directorBy = new Map<string, Row>(), directorKey = new Map<string, string>();
  for (const b of directors) {
    const es = (b.emails || []).map((e: string) => C(e)).filter(Boolean);
    const key = es.find((e: string) => e.endsWith(DOMAIN)) || es[0] || 'director:' + b.id;
    b.key = key;
    for (const e of es) { directorBy.set(e, b); directorKey.set(e, key); }
    directorBy.set(key, b);
  }
  const admins = new Set<string>((roles.data || []).filter((r: Row) => r.role === 'admin').map((r: Row) => C(r.email)));
  const depts = ((meta.data || []) as Row[]).map((d) => ({ department: d.department, label: d.label || d.department, pats: (Array.isArray(d.calendar_match) ? d.calendar_match : []).map((p: unknown) => lower(p)).filter(Boolean) }));
  const active = members.filter((m) => m.active !== false);
  const memberCands: Cand[] = active.map((m) => ({ key: C(m.email) || 'member:' + m.id, names: [m.name, dirName.get(lower(m.email)) || ''].filter(Boolean) }));
  return { C, memberBy, directorBy, directorKey, directors, admins, depts, dirName, memberCands, byId };
}

/* ---------- matching ---------- */
type Inst = { id: string; series: string; code: string; title: string; organizer: string; start: number; end: number; kind: 'team' | 'leadership'; department: string | null; invitees: Row[] };
type Conf = { id: string; code: string; org: string; cal: string; hits: Hit[]; start: number; end: number };
type Meeting = { row: Row; confs: Conf[]; expected: Map<string, Row>; boardId?: number };

function personOf(h: Hit, ctx: Row, cands: Cand[]): string | null {
  const R = ctx.R;
  if (h.type === 'email_address' && h.who) {
    const e = R.C(h.who);
    if (R.directorKey.has(e)) { const k = R.directorKey.get(e); if (cands.some((c) => c.key === k) || !R.memberBy.has(e)) return k; }
    if (R.memberBy.has(e) || cands.some((c) => c.key === e) || (e.endsWith(DOMAIN) && R.dirName.get(e))) return e;
    /* a personal account: only the full name */
    return nameMatch(h.name, cands, true) || nameMatch(h.name, R.memberCands, true) || null;
  }
  if (h.type === 'phone_number' || h.type === 'device_id') return null;
  /* signed out: the name against the people expected, then the full name against the roster */
  return nameMatch(h.name, cands) || nameMatch(h.name, R.memberCands, true) || null;
}

function buildMeeting(m: Meeting, ctx: Row) {
  const R = ctx.R;
  const cands: Cand[] = [...m.expected.values()].map((x) => ({ key: x.person, names: x.names }));
  const seen = new Map<string, { secs: number; sessions: number; first: number; last: number }>();
  const guests = new Map<string, number>();
  for (const c of m.confs) for (const h of c.hits) {
    if (BOT.test(h.name || '')) continue;
    const p = personOf(h, ctx, cands);
    if (!p) {
      const g = (h.type || 'anon') + ':' + (h.who || norm(h.name) || String(h.start)); guests.set(g, (guests.get(g) || 0) + h.secs);
      if (ctx.unmatched && h.secs >= CAME_SECS) { const k = (h.type || 'signed out') + ' | ' + (h.name || '(no name)') + (h.ext ? ' | external' : ''); ctx.unmatched[k] = (ctx.unmatched[k] || 0) + 1; }
      continue;
    }
    const s = seen.get(p) || { secs: 0, sessions: 0, first: Infinity, last: 0 };
    s.secs += h.secs; s.sessions++; s.first = Math.min(s.first, h.start); s.last = Math.max(s.last, h.start + h.secs);
    seen.set(p, s);
  }
  const rows: Row[] = [];
  const sched = m.row.scheduled_start ? new Date(m.row.scheduled_start).getTime() / 1000 : null;
  const span = m.confs.length ? Math.max(...m.confs.map((c) => c.end)) - Math.min(...m.confs.map((c) => c.start)) : 0;
  const one = (person: string, ex: Row | null) => {
    const s = seen.get(person);
    const came = !!s && s.secs >= CAME_SECS;
    const member = ex?.member || R.memberBy.get(person) || null;
    const director = ex?.director || R.directorBy.get(person) || null;
    return {
      meeting_id: m.row.id, person, member_id: member ? Number(member.id) : null, director_id: director ? Number(director.id) : null,
      name: ex?.name || (member && member.name) || (director && (director.full_name || director.name)) || R.dirName.get(person) || null,
      expected: !!ex, came, home_team: !!(member && m.row.department && member.department === m.row.department), optional: !!(ex && ex.optional), rsvp: ex ? ex.rsvp || null : null,
      joined_at: s ? new Date(s.first * 1000).toISOString() : null, left_at: s ? new Date(s.last * 1000).toISOString() : null,
      minutes: s ? Math.round(Math.min(s.secs, span > 0 ? span : s.secs) / 60) : null, sessions: s ? s.sessions : null,
      late_min: came && ex && sched && s ? Math.max(0, Math.round((s.first - sched) / 60)) : null
    };
  };
  for (const [p, ex] of m.expected) rows.push(one(p, ex));
  for (const [p, s] of seen) {
    if (m.expected.has(p) || s.secs < CAME_SECS) continue;
    const member = R.memberBy.get(p), director = R.directorBy.get(p);
    if (!member && !director && !(p.endsWith(DOMAIN) && R.dirName.get(p))) { guests.set('ext:' + p, s.secs); continue; }
    rows.push(one(p, null));
  }
  const cameGuests = [...guests.values()].filter((v) => v >= CAME_SECS).length;
  const cameRows = rows.filter((r) => r.came);
  const mins = cameRows.map((r) => r.minutes || 0);
  m.row.conference_ids = m.confs.map((c) => c.id);
  m.row.started_at = m.confs.length ? new Date(Math.min(...m.confs.map((c) => c.start)) * 1000).toISOString() : null;
  m.row.ended_at = m.confs.length ? new Date(Math.max(...m.confs.map((c) => c.end)) * 1000).toISOString() : null;
  m.row.expected_n = rows.filter((r) => r.expected).length;
  m.row.expected_came_n = rows.filter((r) => r.expected && r.came).length;
  m.row.team_n = rows.filter((r) => r.expected && r.home_team).length;
  m.row.team_came_n = rows.filter((r) => r.expected && r.home_team && r.came).length;
  m.row.visitors_n = rows.filter((r) => !r.expected && r.came).length;
  m.row.guests_n = cameGuests;
  m.row.came_n = cameRows.length + cameGuests;
  m.row.held = m.row.came_n >= 1;
  m.row.avg_minutes = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
  m.row.synced_at = new Date().toISOString();
  return rows;
}

async function sync(days: number, dry: boolean) {
  const now = Date.now();
  /* the window never reaches past what the Meet log keeps (Google keeps 180 days; a day of margin for the calls around it) */
  const from = new Date(Math.max(now - days * 86400000, now - 178 * 86400000)), wide = new Date(Math.max(from.getTime() - 86400000, now - 179.5 * 86400000));
  const R = await roster();
  const ctx: Row = { R, unmatched: dry ? {} : null };
  const [{ hits, oldest }, cal, known, boards] = await Promise.all([
    meetLog(wide.toISOString(), new Date(now).toISOString()),
    calendar(wide.toISOString(), new Date(now).toISOString()),
    svc.from('meet_meetings').select('meeting_code,kind,department,title,organizer,series_id').in('kind', ['team', 'leadership']).not('meeting_code', 'is', null).order('scheduled_start', { ascending: false }).limit(2000),
    svc.from('board_meetings').select('id,title,meets_at,status,kind').not('meets_at', 'is', null)
  ]);
  /* a read that failed must not look like an empty window: the sync stops before it deletes anything */
  if (known.error) throw new Error('meet_meetings: ' + known.error.message);
  if (boards.error) throw new Error('board_meetings: ' + boards.error.message);
  const deptOf = (title: string) => { const t = lower(title); for (const d of R.depts) if (d.pats.some((p: string) => t.indexOf(p) >= 0)) return d.department; return null; };

  /* the scheduled meetings on the hub@ calendar */
  const insts: Inst[] = [];
  const series = new Map<string, Row>();
  for (const k of known.data || []) if (!series.has(k.meeting_code)) series.set(k.meeting_code, { kind: k.kind, department: k.department, title: k.title, organizer: k.organizer, series: k.series_id });
  for (const ev of cal) {
    if (ev.status === 'cancelled' || !ev.start?.dateTime) continue;
    const code = codeOf(ev); if (!code) continue;
    const start = new Date(ev.start.dateTime).getTime(), end = new Date(ev.end?.dateTime || ev.start.dateTime).getTime();
    if (start > now) continue;
    const invitees = (ev.attendees || []).filter((a: Row) => a.email && !a.resource && !nonPerson(lower(a.email)));
    const department = deptOf(ev.summary || '');
    const organizer = R.C(ev.organizer?.email);
    const kind = department ? 'team' : ((R.admins.has(organizer) || /leader/i.test(ev.summary || '')) && invitees.length >= 3 ? 'leadership' : null);
    if (!kind) continue;
    const inst: Inst = { id: ev.id, series: ev.recurringEventId || ev.id, code, title: ev.summary || '', organizer, start, end, kind, department, invitees };
    insts.push(inst);
    series.set(code, { kind, department, title: inst.title, organizer, series: inst.series });
  }
  const byCode = new Map<string, Inst[]>();
  for (const i of insts) (byCode.get(i.code) || byCode.set(i.code, []).get(i.code)!).push(i);

  /* the calls */
  const confMap = new Map<string, Conf>();
  for (const h of hits) {
    const id = h.conf || (h.code + ':' + h.start);
    const c = confMap.get(id) || { id, code: h.code, org: h.org, cal: h.cal, hits: [], start: Infinity, end: 0 };
    c.hits.push(h); if (h.start) c.start = Math.min(c.start, h.start); c.end = Math.max(c.end, h.start + h.secs);
    if (!c.cal && h.cal) c.cal = h.cal;
    confMap.set(id, c);
  }
  const confs = [...confMap.values()].filter((c) => isFinite(c.start));

  const meetings = new Map<string, Meeting>();
  const expectedOf = (inst: Inst) => {
    const ex = new Map<string, Row>();
    for (const a of inst.invitees) {
      const e = R.C(a.email); const member = R.memberBy.get(e);
      if (!member || member.active === false) continue;
      ex.set(e, { person: e, member, name: member.name, names: [member.name, R.dirName.get(e) || '', a.displayName || ''].filter(Boolean), rsvp: a.responseStatus || null, optional: !!a.optional });
    }
    return ex;
  };
  const meetingFor = (inst: Inst) => {
    const id = 'cal:' + inst.id;
    let m = meetings.get(id);
    if (!m) {
      m = { row: { id, kind: inst.kind, department: inst.department, board_meeting_id: null, series_id: inst.series, title: inst.title, organizer: inst.organizer, meeting_code: inst.code,
        scheduled_start: new Date(inst.start).toISOString(), scheduled_end: new Date(inst.end).toISOString() }, confs: [], expected: expectedOf(inst) };
      meetings.set(id, m);
    }
    return m;
  };
  for (const inst of insts) if (inst.start >= from.getTime()) meetingFor(inst);
  const used = new Set<string>();
  for (const c of confs) {
    const list = byCode.get(c.code) || [];
    let best: Inst | null = null, bestD = Infinity;
    for (const i of list) {
      const s = c.start * 1000, d = Math.abs(s - i.start);
      if (s >= i.start - 3600000 && s <= i.end + 1800000 && d < bestD) { best = i; bestD = d; }
    }
    if (!best && c.cal) { const i = list.find((x) => x.id === c.cal); if (i && Math.abs(c.start * 1000 - i.start) < 12 * 3600000) best = i; }
    if (best) { if (best.start >= from.getTime()) { meetingFor(best).confs.push(c); } used.add(c.id); continue; }
    /* a call on a team's or the leadership's link with nothing scheduled: kept when two or more people came */
    const s = series.get(c.code);
    if (!s || c.start * 1000 < from.getTime()) continue;
    const people = new Set(c.hits.filter((h) => h.secs >= CAME_SECS && !BOT.test(h.name || '')).map((h) => h.who || norm(h.name)));
    if (people.size < 2) continue;
    const id = 'conf:' + c.id;
    meetings.set(id, { row: { id, kind: s.kind, department: s.department, board_meeting_id: null, series_id: s.series, title: s.title, organizer: s.organizer, meeting_code: c.code, scheduled_start: null, scheduled_end: null }, confs: [c], expected: new Map() });
    used.add(c.id);
  }

  /* the board meetings: the call around the meeting's time where the most directors are recognised */
  const directorCands: Cand[] = R.directors.map((b: Row) => ({ key: b.key, names: [b.full_name, b.name].filter(Boolean) }));
  for (const b of (boards.data || []) as Row[]) {
    const t = new Date(b.meets_at).getTime();
    if (b.kind === 'strategy' || /cancel/i.test(String(b.status || '')) || t < from.getTime() || t > now) continue;
    const near = confs.filter((c) => !used.has(c.id) && c.start * 1000 >= t - 45 * 60000 && c.start * 1000 <= t + 75 * 60000 && (c.org.endsWith(DOMAIN) || !c.org));
    let best: Conf | null = null, bestN = 0;
    for (const c of near) {
      const found = new Set<string>();
      for (const h of c.hits) { const p = h.type === 'email_address' && h.who && R.directorKey.has(R.C(h.who)) ? R.directorKey.get(R.C(h.who)) : nameMatch(h.name, directorCands); if (p) found.add(p); }
      if (found.size > bestN) { best = c; bestN = found.size; }
    }
    const id = 'board:' + b.id;
    const expected = new Map<string, Row>();
    for (const d of R.directors) {
      if (d.status !== 'active') continue;
      const key = d.key;
      expected.set(key, { person: key, director: d, member: R.memberBy.get(key) || null, name: d.full_name || d.name, names: [d.full_name, d.name].filter(Boolean), rsvp: null, optional: false });
    }
    const confsFor = best && bestN >= 2 ? confs.filter((c) => c.code === best!.code && c.start * 1000 >= t - 45 * 60000 && c.start * 1000 <= t + 180 * 60000) : [];
    meetings.set(id, { row: { id, kind: 'board', department: null, board_meeting_id: b.id, series_id: null, title: b.title || 'Board meeting', organizer: confsFor[0]?.org || null, meeting_code: confsFor[0]?.code || null,
      scheduled_start: new Date(t).toISOString(), scheduled_end: new Date(t + 2 * 3600000).toISOString() }, confs: confsFor, expected, boardId: b.id });
    for (const c of confsFor) used.add(c.id);
  }

  /* build */
  const rowsM: Row[] = [], rowsA: Row[] = [];
  for (const m of meetings.values()) { const a = buildMeeting(m, ctx); rowsM.push(m.row); rowsA.push(...a); }
  const summary = {
    window: { from: from.toISOString(), to: new Date(now).toISOString(), days }, log_rows: hits.length, oldest_log: oldest || null, calls: confs.length, scheduled: insts.length,
    meetings: rowsM.length, by_kind: rowsM.reduce((o: Row, r) => { o[r.kind] = (o[r.kind] || 0) + 1; return o; }, {}), held: rowsM.filter((r) => r.held).length, attendance_rows: rowsA.length
  };
  if (dry) return { ok: true, dry: true, summary, meetings: rowsM, attendance: rowsA, unmatched: ctx.unmatched };

  /* write: the meetings in the window are replaced */
  const ids = rowsM.map((r) => r.id);
  for (let i = 0; i < rowsM.length; i += 200) { const { error } = await svc.from('meet_meetings').upsert(rowsM.slice(i, i + 200), { onConflict: 'id' }); if (error) throw new Error('meet_meetings: ' + error.message); }
  for (let i = 0; i < ids.length; i += 100) { const { error } = await svc.from('meet_attendance').delete().in('meeting_id', ids.slice(i, i + 100)); if (error) throw new Error('meet_attendance delete: ' + error.message); }
  for (let i = 0; i < rowsA.length; i += 300) { const { error } = await svc.from('meet_attendance').insert(rowsA.slice(i, i + 300)); if (error) throw new Error('meet_attendance: ' + error.message); }
  /* a scheduled meeting in the window that the calendar no longer has (moved or cancelled) goes */
  const { data: old, error: e1 } = await svc.from('meet_meetings').select('id,scheduled_start,started_at,kind').gte('scheduled_start', from.toISOString()).lte('scheduled_start', new Date(now).toISOString());
  const { data: oldConf, error: e2 } = await svc.from('meet_meetings').select('id').is('scheduled_start', null).gte('started_at', from.toISOString());
  if (e1 || e2) throw new Error('meet_meetings: ' + ((e1 || e2) as Row).message);
  const stale = (old || []).map((r: Row) => r.id).filter((id: string) => !ids.includes(id));
  stale.push(...(oldConf || []).map((r: Row) => r.id).filter((id: string) => !ids.includes(id)));
  for (let i = 0; i < stale.length; i += 100) await svc.from('meet_meetings').delete().in('id', stale.slice(i, i + 100));
  return { ok: true, summary: { ...summary, removed: stale.length } };
}

async function state(ok: boolean, note: string, days: number, s: Row | null) {
  try {
    const { count: mn } = await svc.from('meet_meetings').select('id', { count: 'exact', head: true });
    const { count: an } = await svc.from('meet_attendance').select('meeting_id', { count: 'exact', head: true });
    await svc.from('meet_sync_state').upsert({ id: 1, last_run_at: new Date().toISOString(), last_ok: ok, note: note.slice(0, 500), days, meetings_n: mn || 0, rows_n: an || 0,
      ...(ok ? { last_ok_at: new Date().toISOString() } : {}), ...(s && s.oldest_log ? { oldest_log: s.oldest_log } : {}) });
  } catch (_) { /* best effort */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'Only the admins, the Executive profile and the daily run can do this' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  try {
    if (action === 'status') {
      const { data } = await svc.from('meet_sync_state').select('*').eq('id', 1).maybeSingle();
      return json({ ok: true, state: data || null });
    }
    if (action === 'sync') {
      const days = Math.min(180, Math.max(1, Number(body.days) || 10));
      const dry = body.dry === true && who === 'automation';
      try {
        const out = await sync(days, dry);
        if (!dry) await state(true, 'synced ' + out.summary.meetings + ' meetings (' + (who === 'automation' ? 'daily run' : who) + ')', days, out.summary);
        return json(out);
      } catch (e) {
        await state(false, String((e as Error).message || e), days, null);
        throw e;
      }
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 500) }, 500);
  }
});
