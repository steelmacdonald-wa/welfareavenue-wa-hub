// Welfare Avenue: onboard-link (v1, 01/11/26, wave271; v2, 02/11/26, wave275 Task 2: the mgr link proposes times and edits availability)
// The public side of HR onboarding: the no-login links behind hub.welfareavenue.com/o/<token> (page by Task 4). One signed
// token per purpose, <id>.<20 characters of HMAC-SHA256>, as in candidate-confirm, but the key is 'onboard-<purpose>:' + the
// service key, so a link made for one purpose (or for candidate-confirm) opens nothing else:
//   offer  id = the candidate  the offer's Accept and Decline, then the new hire's availability grid
//   mgr    id = the flow       the manager's availability grid for the 1-on-1
//   pw     id = the flow       the one-time first-password page; it signs '<id>.<pw_nonce>' (Task 10 fills in the action)
//   GET  ?t=<token>            {ok, kind: 'offer'|'manager'|'password', first, role, lang, answered, closed, late, booked, callBooked,
//                              grid: {start, end, cellMin, minHours, days: [{date, open, close}], slots}, slotsSaved}      nothing is saved
//   POST {t, a: 'accept'|'decline'|'grid'|'password', slots?}
//     accept   sets hub_candidates.accepted_on to today in Toronto; the database trigger wa271_cand_accepted makes the flow.
//              It does not touch status: HR moves the card.
//     decline  status declined, close_reason 'Declined by link', change_log. The stage-move trigger (wa210_stage_moved) tells the owner; a card with no owner
//              tells the offer signer through notify (event applicant).
//     grid     replaces the person's marked slots (hire for an offer link, manager for a mgr link) until the meetings are booked.
//              The hire's grid needs onboard_grid_min_hours hours in all (default 10; 0 for none) so the manager has times to choose from:
//              fewer is a 400 too_few_slots, counted after stale slots are dropped. The manager's grid has no minimum.
//     A second answer changes nothing and shows the first ({repeated: true}); a closed card (even one accepted first) or a flow that backed out gives
//     {closed: true} and saves nothing. Someone who declined by link still sees their answer.
//   A read that fails is a 503 (unavailable), not a bad link: the page offers to try again.
// wave275 (v2), the mgr link only. GET adds mode: 'propose' (the wave275 path) or 'grid' (a wave271 flow keeps its 1-on-1 grid: created before
//   app_config onboard_v2_since, or, with no release time set, a flow that is not offered and has nothing proposed). In propose mode GET also gives
//   {proposal: {call_at, one_on_one_at, by, at} | null, availability (saved, or Monday to Friday 09:00 to 17:00), availabilityAt, availabilityStale (none
//   saved, or saved more than 30 days ago), busy: [{start, end, taken?}] (hub@ meetings the manager is invited to over the next 21 days, never their
//   titles, then the booked and proposed times of their other new hires, taken: true; a proposal its hire has answered is left out), lengths: {callMin,
//   oneMin}, leadHours, hireAccepted, hireAnswer}; the page draws its cells from grid. The manager is the flow's manager_member_id, else whoever got the
//   link. The link is theirs only while manager_link_member_id (who the Hub last sent it to) is set and is that manager: otherwise GET gives
//   {mode, notYours: true, message} and nothing of their hours or calendar, and both POSTs are refused (409 not_yours).
//   POST {t, a: 'availability', availability}   checked as the database checks it (wa275_availability_ok: weekly mon..sun, blocks ["HH:MM","HH:MM"] on
//              5-minute marks, 00:00 to 23:55, end after start; except [{date, free}] with real dates, once each; tz America/Toronto), at most 12 blocks a
//              day and 120 exceptions; saved with the service key on the manager's roster row with availability_at now (wa275_availability_set needs a
//              sign-in, and this link is the manager's own). {ok, availability, availabilityAt, availabilityStale: false}; refused: 400 bad_availability.
//   POST {t, a: 'propose', call_at, one_on_one_at}   relays to onboard-run propose with the trigger secret and by 'manager': the rules (lead time,
//              availability, hub@ meetings, other hires' times, overlap, already booked) are onboard-run's alone, and so is the save. {ok, repeated,
//              proposal, hireEmailed, practice?}; a refusal keeps onboard-run's status, error and which, with message {en, fr}; onboard-run not answering is 503.
//   Both need propose mode (a wave271 grid link is wrong_link) and a link the manager holds (not_yours); a closed link gives {closed: true} as before,
//   and the offer link cannot do either (wrong_link).
// A slot is the start of one cell of the window, as a UTC instant. The window is onboard_grid_days days from today in
// Toronto, onboard_grid_start to onboard_grid_end o'clock, onboard_grid_cell_min minutes a cell, onboard_grid_min_hours the hire's minimum (app_config). The wall-clock
// times are turned into instants with Intl for each day, so a clock change (01/11/26, 14/03/27) never shifts a cell by an hour.
// A cell that has already started is not offered (the first day opens at the next cell; a day with none left drops out), GET shows only
// saved slots still ahead, and a save silently drops any slot that has started since (stale, not an error; {dropped} counts them). A slot
// that is not on a cell boundary, or lies beyond the window's last day, is still refused (bad_slots).
// Public (no sign-in): the token is the key. Only hub.welfareavenue.com may call it from a browser (CORS). Reads and writes
// with the service role. Every error carries {message: {en, fr}}; the page owns the rest of the copy.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const HUB = 'https://hub.welfareavenue.com';
const TZ = 'America/Toronto';
const MAX_SLOTS = 2000;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': HUB,
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const MSG: Record<string, { en: string; fr: string }> = {
  bad_link: { en: 'This link does not work. Please contact HR.', fr: 'Ce lien ne fonctionne pas. Veuillez communiquer avec les RH.' },
  wrong_link: { en: 'This link cannot do that. Please contact HR.', fr: 'Ce lien ne permet pas cette action. Veuillez communiquer avec les RH.' },
  answer: { en: 'That answer is not one we know. Please contact HR.', fr: 'Cette réponse est inconnue. Veuillez communiquer avec les RH.' },
  bad_slots: { en: 'Some of the times you marked are not on the grid. Please reload the page and try again.', fr: 'Certaines plages choisies ne figurent pas dans la grille. Veuillez recharger la page et réessayer.' },
  too_many_slots: { en: 'Too many times were marked. Please reload the page and try again.', fr: 'Trop de plages ont été choisies. Veuillez recharger la page et réessayer.' },
  not_accepted: { en: 'The offer has not been accepted yet. Please accept it first, or contact HR.', fr: 'L\'offre n\'a pas encore été acceptée. Veuillez d\'abord l\'accepter, ou communiquer avec les RH.' },
  save: { en: 'We could not save that. Please try again, or contact HR.', fr: 'Nous n\'avons pas pu enregistrer. Veuillez réessayer, ou communiquer avec les RH.' },
  not_yet: { en: 'This is not ready yet. Please contact HR.', fr: 'Ce n\'est pas encore prêt. Veuillez communiquer avec les RH.' },
  closed: { en: 'This link is no longer active. Please contact HR.', fr: 'Ce lien n\'est plus actif. Veuillez communiquer avec les RH.' },
  unavailable: { en: 'We could not reach the server. Please try again in a minute, or contact HR.', fr: 'Nous n\'avons pas pu joindre le serveur. Réessayez dans une minute, ou communiquez avec les RH.' },
  bad_availability: { en: 'Some of those hours do not work. Use times on 5-minute marks from 00:00 to 23:55, each end after its start, and a date once each. Please check and save again.', fr: 'Certaines de ces heures ne conviennent pas. Utilisez des heures par tranches de 5 minutes de 00:00 à 23:55, chaque fin après son début, et chaque date une seule fois. Vérifiez puis enregistrez de nouveau.' },
  no_manager: { en: 'This new hire has no onboarding manager yet. Please contact HR.', fr: 'Cette nouvelle recrue n\'a pas encore de gestionnaire d\'accueil. Veuillez communiquer avec les RH.' },
  not_yours: { en: 'This link is no longer yours; a new link is on its way to the right person.', fr: 'Ce lien n\'est plus le vôtre; un nouveau lien est en route vers la bonne personne.' },
};
const fail = (error: string, status: number) => json({ ok: false, error, message: MSG[error] }, status);
/* built with the number, so the one message that carries a figure sits beside the static table */
const tooFew = (hours: number) => json({
  ok: false, error: 'too_few_slots',
  message: {
    en: 'Please mark at least ' + hours + (hours === 1 ? ' hour' : ' hours') + ' in total, so your manager has a few times to choose from.',
    fr: 'Veuillez indiquer au moins ' + hours + (hours === 1 ? ' heure' : ' heures') + ' en tout, pour que votre gestionnaire ait quelques plages au choix.',
  },
}, 400);
const closedReply = (booked: boolean) => json({ ok: true, closed: true, booked, message: MSG.closed });

/* ---------- tokens ---------- */
export type Purpose = 'offer' | 'mgr' | 'pw';
async function mac(purpose: Purpose, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('onboard-' + purpose + ':' + SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 20);
}
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
/* The pattern onboard-run and recruit-actions copy (functions are single files): the token for a purpose. For pw, extra is the
   flow's pw_nonce, which the signature covers, so a new nonce kills the old link. */
export async function wa271Token(purpose: Purpose, id: number | string, extra?: string): Promise<string> {
  if (purpose === 'pw' && !extra) throw new Error('a pw token needs the flow\'s pw_nonce');
  return id + '.' + await mac(purpose, purpose === 'pw' ? id + '.' + extra : String(id));
}

/* ---------- Toronto time ---------- */
const WALL = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function torontoParts(ms: number): { y: number; m: number; d: number; h: number; min: number } {
  const p: Record<string, number> = {};
  for (const x of WALL.formatToParts(new Date(ms))) {
    if (x.type !== 'literal') p[x.type] = Number(x.value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}
const day = (y: number, m: number, d: number) => String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
const torontoToday = () => { const t = torontoParts(Date.now()); return day(t.y, t.m, t.d); };
/* the instant when a Toronto wall clock reads y-m-d and (minutes) past midnight; the offset is found by asking Intl, then checked */
function wallToUtc(y: number, m: number, d: number, minutes: number): number {
  const want = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = want;
  for (let i = 0; i < 3; i++) {
    const t = torontoParts(guess);
    const diff = Date.UTC(t.y, t.m - 1, t.d, t.h, t.min) - want;
    if (!diff) break;
    guess -= diff;
  }
  return guess;
}
const stamp = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
const normal = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : stamp(ms);
};

type Grid = { start: number; end: number; cellMin: number; minHours: number; days: Array<{ date: string; open: string; close: string }>; slots: string[] };
const GRID_DEFAULTS: Record<string, [number, number, number]> = { onboard_grid_days: [14, 1, 60], onboard_grid_start: [8, 0, 23], onboard_grid_end: [21, 1, 24], onboard_grid_cell_min: [30, 5, 240], onboard_grid_min_hours: [10, 0, 40] };
async function gridWindow(): Promise<Grid> {
  const { data, error } = await svc.from('app_config').select('key, value').in('key', Object.keys(GRID_DEFAULTS));
  if (error) throw new Error('grid settings: ' + error.message);   // the defaults may not be today's window: never guess
  const have = new Map(((data || []) as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]));
  const num = (k: string) => {
    const [def, lo, hi] = GRID_DEFAULTS[k];
    const raw = String(have.get(k) ?? '').trim(), n = Number(raw);
    return raw && Number.isInteger(n) && n >= lo && n <= hi ? n : def;
  };
  const days = num('onboard_grid_days'), cellMin = num('onboard_grid_cell_min'), minHours = num('onboard_grid_min_hours');
  let start = num('onboard_grid_start'), end = num('onboard_grid_end');
  if (end <= start) { start = GRID_DEFAULTS.onboard_grid_start[0]; end = GRID_DEFAULTS.onboard_grid_end[0]; }
  const [y0, m0, d0] = torontoToday().split('-').map(Number);
  const out: Grid = { start, end, cellMin, minHours, days: [], slots: [] };
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const t = new Date(Date.UTC(y0, m0 - 1, d0 + i));
    const [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
    const cells: string[] = [];
    for (let min = start * 60; min + cellMin <= end * 60; min += cellMin) {
      const at = wallToUtc(y, m, d, min);
      if (at > now) cells.push(stamp(at));   // a cell that has already started is gone
    }
    if (!cells.length) continue;   // so is a day with none left
    out.days.push({ date: day(y, m, d), open: cells[0], close: stamp(wallToUtc(y, m, d, end * 60)) });
    out.slots.push(...cells);
  }
  return out;
}
/* is this instant the start of a cell of some day (on the cell boundary of the Toronto wall clock, inside the daily hours)? A past one is
   only stale; one that is not on a boundary was never offered. */
function onCellBoundary(ms: number, g: Grid): boolean {
  if (ms % 60000) return false;
  const t = torontoParts(ms);
  const min = t.h * 60 + t.min;
  return min >= g.start * 60 && min + g.cellMin <= g.end * 60 && (min - g.start * 60) % g.cellMin === 0;
}

/* ---------- the rows behind a link ---------- */
const OPEN = ['new', 'reviewing', 'interview', 'offer', 'hired'];   // a card in any other stage is closed to this link
type Cand = { id: number; name: string; role: string; status: string; summary: string; notes: string; owner: string | null; accepted_on: string | null; offer_respond_by: string | null; close_reason: string | null };
type Flow = {
  id: number; candidate_id: number; status: string; manager_member_id: number | null; manager_link_member_id: number | null; call_at: string | null; one_on_one_at: string | null;
  pw_nonce: string | null; pw_expires_at: string | null; pw_used_at: string | null;
  created_at?: string | null; proposed_call_at?: string | null; proposed_one_on_one_at?: string | null; proposed_by?: string | null; proposed_at?: string | null; hire_answer?: string | null;
};
const CAND_COLS = 'id, name, role, status, summary, notes, owner, accepted_on, offer_respond_by, close_reason';
const FLOW_COLS = 'id, candidate_id, status, manager_member_id, manager_link_member_id, call_at, one_on_one_at, pw_nonce, pw_expires_at, pw_used_at, created_at, proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at, hire_answer';
type Link = { kind: 'offer' | 'manager' | 'password'; cand: Cand; flow: Flow | null };

/* a read that fails is not a link that fails: it throws, and the handler answers 503 */
async function candidate(id: number): Promise<Cand | null> {
  const { data, error } = await svc.from('hub_candidates').select(CAND_COLS).eq('id', id).maybeSingle();
  if (error) throw new Error('candidate: ' + error.message);
  return (data as Cand | null) || null;
}
async function flowWhere(col: 'id' | 'candidate_id', id: number): Promise<Flow | null> {
  const { data, error } = await svc.from('hub_onboard_flows').select(FLOW_COLS).eq(col, id).maybeSingle();
  if (error) throw new Error('flow: ' + error.message);
  return (data as Flow | null) || null;
}
async function openLink(t: string): Promise<Link | null> {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{20})$/.exec(String(t || '').trim());
  if (!m) return null;
  const id = Number(m[1]);
  if (same(await mac('offer', m[1]), m[2])) {
    const cand = await candidate(id);
    if (!cand) return null;
    return { kind: 'offer', cand, flow: await flowWhere('candidate_id', id) };
  }
  const mgr = same(await mac('mgr', m[1]), m[2]);
  const flow = await flowWhere('id', id);
  if (!flow) return null;
  if (!mgr && !(flow.pw_nonce && same(await mac('pw', m[1] + '.' + flow.pw_nonce), m[2]))) return null;
  const cand = await candidate(flow.candidate_id);
  return cand ? { kind: mgr ? 'manager' : 'password', cand, flow } : null;
}

const firstName = (full: string | null | undefined) => String(full || '').trim().split(/\s+/)[0] || '';
// deno-lint-ignore no-explicit-any
function langOf(c: any): 'fr' | 'en' {   // the same test recruit-actions uses to pick the language of the texts it sends
  const s = String(c.summary || '') + ' ' + String(c.role || '');
  if (/\b(Français|French|francophone)\b/i.test(s) || /(Co-responsable|Cuisinier|Gestionnaire|bénévole|é.*poste)/i.test(String(c.role || ''))) return 'fr';
  return 'en';
}
const whenEn = (d: Date) => d.toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
const answerOf = (c: Cand): 'accept' | 'decline' | '' =>
  c.accepted_on ? 'accept' : c.status === 'declined' && c.close_reason === 'Declined by link' ? 'decline' : '';
const lateAt = (c: Cand, date: string) => !!c.offer_respond_by && date > String(c.offer_respond_by).slice(0, 10);

/* the grid is shut once the meetings it serves are booked: the hire's for the call and the 1-on-1, the manager's for the 1-on-1 */
const booked = (l: Link) => !!l.flow && (l.kind === 'manager' ? !!l.flow.one_on_one_at : !!l.flow.call_at && !!l.flow.one_on_one_at);
function shut(l: Link): boolean {
  if (l.flow?.status === 'backed_out') return true;
  if (l.kind === 'password') return !!l.flow && (!!l.flow.pw_used_at || (!!l.flow.pw_expires_at && Date.parse(l.flow.pw_expires_at) < Date.now()));
  if (booked(l)) return true;
  if (OPEN.includes(l.cand.status)) return false;   // hired is still open: the grid stays open until the meetings are booked
  return !(l.kind === 'offer' && answerOf(l.cand) === 'decline');   // closed, even if they accepted first; only someone who declined by link still sees their answer
}
const who = (l: Link) => (l.kind === 'manager' ? 'manager' : 'hire');

async function savedSlots(l: Link): Promise<string[]> {
  if (!l.flow || l.kind === 'password') return [];
  const { data, error } = await svc.from('hub_onboard_grids').select('slots').eq('flow_id', l.flow.id).eq('who', who(l)).maybeSingle();
  if (error) throw new Error('grid: ' + error.message);
  return (((data as { slots?: string[] } | null)?.slots) || []).map((s) => normal(s)).filter((s): s is string => !!s).sort();
}

async function view(l: Link) {
  const answered = answerOf(l.cand);
  const closed = shut(l);
  let first = firstName(l.cand.name), hire: string | undefined;
  let extra: Record<string, unknown> = {};
  if (l.kind === 'manager') {
    hire = first;
    const m = await managerRow(l);   // the flow's manager; before wave275 a default manager had no manager_member_id before Start, so then whoever got the link
    first = firstName(m?.name);
    const mode = await modeOf(l);
    if (mode === 'propose' && !heldByManager(l.flow)) extra = { mode, notYours: true, message: MSG.not_yours };   // nothing of the manager's hours or calendar for a link that is not theirs
    else extra = mode === 'propose' ? { mode, ...(await proposeView(l, m)) } : { mode };
  }
  const grid = l.kind === 'password' ? null : await gridWindow();
  const inWindow = new Set(grid ? grid.slots : []);   // saved slots that have since started, or fell out of the window, are not shown
  const late = l.kind === 'offer' && answered !== 'decline' && lateAt(l.cand, answered === 'accept' ? String(l.cand.accepted_on).slice(0, 10) : torontoToday());
  return {
    ok: true, kind: l.kind, first, ...(hire !== undefined ? { hire } : {}), role: l.cand.role, lang: l.kind === 'manager' ? 'en' : langOf(l.cand),
    answered, closed, late, booked: booked(l), callBooked: !!l.flow?.call_at, grid, slotsSaved: (await savedSlots(l)).filter((s) => inWindow.has(s)),
    ...extra,
    ...(closed ? { message: MSG.closed } : {}),
  };
}

/* ---------- wave275: the manager's availability and the proposal ---------- */
type Member = { id: number; name: string | null; email: string | null; availability?: unknown; availability_at?: string | null };
const DEFAULT_AVAILABILITY = { weekly: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']] }, except: [], tz: TZ };
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const STALE_DAYS = 30, BUSY_DAYS = 21, MAX_BLOCKS = 12, MAX_EXCEPT = 120;
const managerIdOf = (f: Flow | null) => (f ? f.manager_member_id ?? f.manager_link_member_id ?? null : null);
/* the token is signed over the flow alone, so it says nothing about who holds it: the link is the manager's only while the Hub last sent it to that manager
   (manager_link_member_id). After set_manager or change_manager the old holder's link, or a forwarded one, must not write the new manager's hours or times. */
const heldByManager = (f: Flow | null) => !!f && f.manager_link_member_id != null && String(f.manager_link_member_id) === String(managerIdOf(f));
async function managerRow(l: Link): Promise<Member | null> {
  const id = managerIdOf(l.flow);
  if (id == null) return null;
  const { data, error } = await svc.from('team_members').select('id, name, email, availability, availability_at').eq('id', id).maybeSingle();
  if (error) throw new Error('manager: ' + error.message);
  return (data as Member | null) || null;
}
async function settings(keys: string[]): Promise<Map<string, string>> {
  const { data, error } = await svc.from('app_config').select('key, value').in('key', keys);
  if (error) throw new Error('settings: ' + error.message);
  return new Map(((data || []) as Array<{ key: string; value: string }>).map((r) => [r.key, String(r.value ?? '').trim()]));
}
/* a wave271 flow keeps its 1-on-1 grid: created before the release (onboard_v2_since), or, with no release time yet, accepted with nothing proposed */
async function modeOf(l: Link): Promise<'propose' | 'grid'> {
  const f = l.flow!;
  if (f.status === 'offered' || f.proposed_at) return 'propose';
  const since = Date.parse((await settings(['onboard_v2_since'])).get('onboard_v2_since') || '');
  if (Number.isNaN(since)) return 'grid';
  return f.created_at && Date.parse(f.created_at) >= since ? 'propose' : 'grid';
}
const positive = (v: string | undefined, def: number) => { const n = Number(v); return v && Number.isFinite(n) && n > 0 ? n : def; };
async function proposeView(l: Link, m: Member | null) {
  const f = l.flow!;
  const cfg = await settings(['onboard_call_min', 'onboard_one_on_one_min', 'onboard_propose_lead_hours']);
  const callMin = positive(cfg.get('onboard_call_min'), 60), oneMin = positive(cfg.get('onboard_one_on_one_min'), 30);
  const saved = m && m.availability && typeof m.availability === 'object' ? m.availability : null;
  const at = m?.availability_at || null;
  const busy: Array<{ start: string; end: string; taken?: true }> = [];   // no meeting titles over a no-login link: the page says "hub@ meeting"
  const now = Date.now(), until = now + BUSY_DAYS * 86400000;
  const email = String(m?.email || '').trim().toLowerCase();
  if (email) {
    const { data, error } = await svc.from('hub_events').select('start_at, end_at').contains('attendee_emails', [email]).neq('status', 'cancelled')
      .lt('start_at', new Date(until).toISOString()).gt('end_at', new Date(now).toISOString());
    if (error) throw new Error('events: ' + error.message);
    for (const e of (data || []) as Array<{ start_at: string; end_at: string }>) {
      const s = normal(e.start_at), en = normal(e.end_at);
      if (s && en) busy.push({ start: s, end: en });
    }
  }
  if (m) {   // the manager's other new hires: shown so the page can grey them; onboard-run refuses them (taken) whatever the page shows
    const { data, error } = await svc.from('hub_onboard_flows').select('id, candidate_id, status, manager_member_id, manager_link_member_id, call_at, one_on_one_at, proposed_call_at, proposed_one_on_one_at, hire_answer')
      .or('manager_member_id.eq.' + m.id + ',manager_link_member_id.eq.' + m.id);
    if (error) throw new Error('other flows: ' + error.message);
    const rows = ((data || []) as Array<Record<string, unknown>>).filter((x) => Number(x.id) !== f.id && x.status !== 'backed_out' && Number(x.manager_member_id ?? x.manager_link_member_id) === m.id);
    if (rows.length) {
      const { data: cs, error: cErr } = await svc.from('hub_candidates').select('id, status').in('id', rows.map((x) => x.candidate_id));
      if (cErr) throw new Error('other cards: ' + cErr.message);
      const shutCards = new Set(((cs || []) as Array<{ id: number; status: string }>).filter((c) => c.status === 'declined' || c.status === 'withdrawn').map((c) => String(c.id)));
      for (const x of rows) {
        if (shutCards.has(String(x.candidate_id))) continue;
        for (const [col, len] of [['call_at', callMin], ['proposed_call_at', callMin], ['one_on_one_at', oneMin], ['proposed_one_on_one_at', oneMin]] as Array<[string, number]>) {
          if (col.startsWith('proposed_') && x.hire_answer) continue;   // an answered proposal is spent, as onboard-run counts it
          const s = normal(x[col]);
          if (!s || Date.parse(s) + len * 60000 <= now || Date.parse(s) >= until) continue;
          busy.push({ start: s, end: stamp(Date.parse(s) + len * 60000), taken: true });
        }
      }
    }
  }
  busy.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return {
    proposal: f.proposed_at ? { call_at: normal(f.proposed_call_at), one_on_one_at: normal(f.proposed_one_on_one_at), by: f.proposed_by ?? null, at: normal(f.proposed_at) } : null,   // instants as the grid's cells are written
    availability: saved || DEFAULT_AVAILABILITY, availabilityAt: at,
    availabilityStale: !saved || !at || Date.parse(at) < now - STALE_DAYS * 86400000,
    busy, lengths: { callMin, oneMin }, leadHours: positive(cfg.get('onboard_propose_lead_hours'), 48),
    hireAccepted: !!l.cand.accepted_on, hireAnswer: f.hire_answer ?? null,
  };
}

/* the database's own rule (wa275_availability_ok), checked here so a bad value is a plain 400, not a failed save; blocks come back in order and tz is set */
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
function blocksOk(v: unknown): Array<[string, string]> | null {
  if (!Array.isArray(v) || v.length > MAX_BLOCKS) return null;
  const out: Array<[string, string]> = [];
  for (const b of v) {
    if (!Array.isArray(b) || b.length !== 2 || typeof b[0] !== 'string' || typeof b[1] !== 'string') return null;
    const a = HM.exec(b[0]), z = HM.exec(b[1]);
    if (!a || !z || Number(a[2]) % 5 || Number(z[2]) % 5) return null;
    if (Number(a[1]) * 60 + Number(a[2]) >= Number(z[1]) * 60 + Number(z[2])) return null;
    out.push([b[0], b[1]]);
  }
  return out.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
}
const realDate = (s: unknown) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
export function cleanAvailability(v: unknown): { weekly: Record<string, Array<[string, string]>>; except: Array<{ date: string; free: Array<[string, string]> }>; tz: string } | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => !['weekly', 'except', 'tz'].includes(k))) return null;
  if ('tz' in o && o.tz !== TZ) return null;
  const weekly: Record<string, Array<[string, string]>> = {};
  if ('weekly' in o) {
    if (!o.weekly || typeof o.weekly !== 'object' || Array.isArray(o.weekly)) return null;
    for (const [k, b] of Object.entries(o.weekly as Record<string, unknown>)) {
      if (!WEEKDAYS.includes(k)) return null;
      const list = blocksOk(b);
      if (!list) return null;
      weekly[k] = list;
    }
  }
  const except: Array<{ date: string; free: Array<[string, string]> }> = [];
  if ('except' in o) {
    if (!Array.isArray(o.except) || o.except.length > MAX_EXCEPT) return null;
    const seen = new Set<string>();
    for (const e of o.except) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
      const r = e as Record<string, unknown>;
      if (Object.keys(r).some((k) => k !== 'date' && k !== 'free') || !realDate(r.date) || seen.has(String(r.date))) return null;
      const free = blocksOk(r.free);
      if (!free) return null;
      seen.add(String(r.date));
      except.push({ date: String(r.date), free });
    }
    except.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  return { weekly, except, tz: TZ };
}

async function saveAvailability(l: Link, value: unknown) {
  if (l.kind !== 'manager') return fail('wrong_link', 400);
  if (shut(l) || !OPEN.includes(l.cand.status)) return closedReply(booked(l));
  const id = managerIdOf(l.flow);
  if (id == null) return fail('no_manager', 409);
  if ((await modeOf(l)) !== 'propose') return fail('wrong_link', 400);   // a wave271 grid link never sets anyone's hours
  if (!heldByManager(l.flow)) return fail('not_yours', 409);
  const availability = cleanAvailability(value);
  if (!availability) return fail('bad_availability', 400);
  const at = new Date().toISOString();
  const { data, error } = await svc.from('team_members').update({ availability, availability_at: at }).eq('id', id).select('id');
  if (error || !(data as unknown[] | null)?.length) return fail('save', 500);
  return json({ ok: true, availability, availabilityAt: at, availabilityStale: false });
}

/* the proposal: onboard-run holds the rules and the save; this only checks the link and relays */
async function relayPropose(l: Link, callAt: unknown, oneAt: unknown) {
  if (l.kind !== 'manager') return fail('wrong_link', 400);
  if (shut(l) || !OPEN.includes(l.cand.status)) return closedReply(booked(l));
  if ((await modeOf(l)) !== 'propose') return fail('wrong_link', 400);   // a wave271 flow: its manager marks the 1-on-1 grid instead
  if (!heldByManager(l.flow)) return fail('not_yours', 409);
  const { data: sec } = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
  if (!sec) return fail('unavailable', 503);
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + '/functions/v1/onboard-run', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'x-wa-secret': String(sec), Authorization: 'Bearer ' + ANON_KEY },
      body: JSON.stringify({ action: 'propose', flow_id: l.flow!.id, call_at: callAt ?? null, one_on_one_at: oneAt ?? null, by: 'manager' }),
    });
  } catch (_) { return fail('unavailable', 503); }
  // deno-lint-ignore no-explicit-any
  const j: any = await res.json().catch(() => null);
  if (res.ok && j?.ok) return json({ ok: true, repeated: !!j.repeated, proposal: j.proposal, hireEmailed: !!j.hire_emailed, ...(j.practice ? { practice: true } : {}) });
  if (j && typeof j.error === 'string' && j.messages?.en && j.messages?.fr) {
    return json({ ok: false, error: j.error, message: { en: String(j.messages.en), fr: String(j.messages.fr) }, ...(j.which ? { which: j.which } : {}) }, res.status >= 400 ? res.status : 409);
  }
  console.error('onboard-link: onboard-run propose said ' + res.status + ' ' + String(j?.error || ''));
  return fail('unavailable', 503);
}

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* a card with no owner: tell the offer signer through notify's existing applicant event (a card with an owner hears from wa210_stage_moved). The answer waits at most 8 seconds on it. */
async function tellSigner(c: Cand, when: string): Promise<void> {
  try {
    const { data } = await svc.from('app_config').select('value').eq('key', 'offer_signer_email').maybeSingle();
    const email = String((data as { value?: string } | null)?.value || '').trim().toLowerCase();
    if (!/@/.test(email)) return;
    const { data: sec } = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
    if (!sec) return;
    const label = esc(c.name) + (c.role ? ' (' + esc(c.role) + ')' : '');
    await fetch(SUPABASE_URL + '/functions/v1/notify', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'x-wa-secret': String(sec), Authorization: 'Bearer ' + ANON_KEY },
      body: JSON.stringify({
        event: 'applicant', to_email: email, title: c.name + ' declined the offer', url: '#hrcentre/applications', tag: 'offer-declined-' + c.id,
        body: (c.role ? c.role + ': ' : '') + 'declined the offer by link on ' + when + '. The card is now Declined.',
        text: '*' + label + '* declined the offer by link on ' + when + '. The card is now Declined (Declined by link). <' + HUB + '/#hrcentre/applications|Open Applications>',
      }),
    });
  } catch (_) { /* the answer is already saved; the card shows it */ }
}

async function answer(l: Link, a: 'accept' | 'decline') {
  const c = l.cand, now = new Date(), today = torontoToday(), when = whenEn(now);
  const reply = (given: string, repeated: boolean, late: boolean) => json({ ok: true, first: firstName(c.name), role: c.role, lang: langOf(c), answer: given, answered: given, repeated, late });
  const lateNow = lateAt(c, today);
  const prior = answerOf(c);
  if (prior === 'accept' && !OPEN.includes(c.status)) return closedReply(false);   // they accepted, then the card closed: no "Thank you", contact HR
  if (prior) return reply(prior, true, prior === 'accept' && lateAt(c, String(c.accepted_on).slice(0, 10)));
  if (shut(l)) return closedReply(false);
  const patch = a === 'accept'
    ? { accepted_on: today, notes: (String(c.notes || '') + '\nAccepted the offer, ' + when + ' (offer link).').trim() }
    : { status: 'declined', close_reason: 'Declined by link', stage_at: now.toISOString(), notes: (String(c.notes || '') + '\nDeclined the offer, ' + when + ' (offer link).').trim() };
  // the claim: only the answer that finds the card still unanswered and open changes it, so a double click or a second tab cannot answer twice
  const { data: won, error } = await svc.from('hub_candidates')
    .update({ ...patch, updated_at: now.toISOString(), updated_by: 'candidate (offer link)' })
    .eq('id', c.id).is('accepted_on', null).in('status', OPEN).select('id');
  if (error) return fail('save', 500);
  if (!(won as unknown[] | null)?.length) {
    const again = await candidate(c.id);
    const was = again ? answerOf(again) : '';
    return was ? reply(was, true, was === 'accept' && lateAt(again!, String(again!.accepted_on).slice(0, 10))) : closedReply(false);
  }
  await svc.from('change_log').insert(a === 'accept'
    ? { entity_type: 'candidate', entity_id: String(c.id), field: 'accepted_on', old_value: null, new_value: today, changed_by: 'candidate (offer link)' }
    : { entity_type: 'candidate', entity_id: String(c.id), field: 'status', old_value: String(c.status), new_value: 'declined (Declined by link)', changed_by: 'candidate (offer link)' });
  if (a === 'decline' && !c.owner) await tellSigner(c, when);
  return reply(a, false, a === 'accept' && lateNow);
}

async function saveGrid(l: Link, slots: unknown) {
  if (shut(l) || !OPEN.includes(l.cand.status)) return closedReply(booked(l));
  if (!l.flow) return fail('not_accepted', 409);
  if (!Array.isArray(slots)) return fail('bad_slots', 400);
  if (slots.length > MAX_SLOTS) return fail('too_many_slots', 400);
  const grid = await gridWindow();
  const valid = new Set(grid.slots), now = Date.now();
  const picked = new Set<string>();
  let dropped = 0;
  for (const s of slots) {
    const n = normal(s);
    const ms = n ? Date.parse(n) : NaN;
    if (!n || !onCellBoundary(ms, grid)) return fail('bad_slots', 400);   // never a cell
    if (ms <= now) { dropped++; continue; }   // a cell that has started since it was saved: stale, not an error
    if (!valid.has(n)) return fail('bad_slots', 400);   // beyond the last day of the window
    picked.add(n);
  }
  if (who(l) === 'hire' && grid.minHours > 0 && picked.size * grid.cellMin < grid.minHours * 60) return tooFew(grid.minHours);   // counted after the stale ones are dropped; the manager has no minimum
  const list = Array.from(picked).sort();
  const { error } = await svc.from('hub_onboard_grids').upsert({ flow_id: l.flow.id, who: who(l), slots: list, updated_at: new Date().toISOString() }, { onConflict: 'flow_id,who' });
  if (error) return fail('save', 500);
  return json({ ok: true, saved: list.length, dropped, slotsSaved: list, closed: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  let token = url.searchParams.get('t') || '';
  let a = '';
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  if (req.method === 'POST') {
    body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') body = {};
    token = String(body.t || token);
    a = String(body.a || '');
  } else if (req.method !== 'GET') {
    return json({ error: 'method' }, 405);
  }
  try {
    const link = await openLink(token);
    if (!link) return fail('bad_link', 404);
    if (req.method === 'GET') return json(await view(link));

    if (!['accept', 'decline', 'grid', 'password', 'availability', 'propose'].includes(a)) return fail('answer', 400);
    if (a === 'password') return json({ ok: false, error: 'not_yet', message: MSG.not_yet }, 501);   // Task 10
    if (a === 'grid') return link.kind === 'password' ? fail('wrong_link', 400) : await saveGrid(link, body.slots);
    if (a === 'availability') return await saveAvailability(link, body.availability);
    if (a === 'propose') return await relayPropose(link, body.call_at, body.one_on_one_at);
    return link.kind === 'offer' ? await answer(link, a as 'accept' | 'decline') : fail('wrong_link', 400);
  } catch (e) {
    console.error('onboard-link: ' + String((e as Error)?.message || e));
    return fail('unavailable', 503);
  }
});
