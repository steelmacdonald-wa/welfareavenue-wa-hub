// Welfare Avenue: onboard-link (v1, 01/11/26, wave271)
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
type Flow = { id: number; candidate_id: number; status: string; manager_member_id: number | null; manager_link_member_id: number | null; call_at: string | null; one_on_one_at: string | null; pw_nonce: string | null; pw_expires_at: string | null; pw_used_at: string | null };
const CAND_COLS = 'id, name, role, status, summary, notes, owner, accepted_on, offer_respond_by, close_reason';
const FLOW_COLS = 'id, candidate_id, status, manager_member_id, manager_link_member_id, call_at, one_on_one_at, pw_nonce, pw_expires_at, pw_used_at';
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
  if (l.kind === 'manager') {
    hire = first;
    const person = l.flow?.manager_link_member_id ?? l.flow?.manager_member_id;   // who got this link; a default manager has no manager_member_id before Start
    const { data: m } = person ? await svc.from('team_members').select('name').eq('id', person).maybeSingle() : { data: null };
    first = firstName((m as { name?: string } | null)?.name);
  }
  const grid = l.kind === 'password' ? null : await gridWindow();
  const inWindow = new Set(grid ? grid.slots : []);   // saved slots that have since started, or fell out of the window, are not shown
  const late = l.kind === 'offer' && answered !== 'decline' && lateAt(l.cand, answered === 'accept' ? String(l.cand.accepted_on).slice(0, 10) : torontoToday());
  return {
    ok: true, kind: l.kind, first, ...(hire !== undefined ? { hire } : {}), role: l.cand.role, lang: l.kind === 'manager' ? 'en' : langOf(l.cand),
    answered, closed, late, booked: booked(l), callBooked: !!l.flow?.call_at, grid, slotsSaved: (await savedSlots(l)).filter((s) => inWindow.has(s)),
    ...(closed ? { message: MSG.closed } : {}),
  };
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
  let slots: unknown;
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    token = String(body.t || token);
    a = String(body.a || '');
    slots = body.slots;
  } else if (req.method !== 'GET') {
    return json({ error: 'method' }, 405);
  }
  try {
    const link = await openLink(token);
    if (!link) return fail('bad_link', 404);
    if (req.method === 'GET') return json(await view(link));

    if (!['accept', 'decline', 'grid', 'password'].includes(a)) return fail('answer', 400);
    if (a === 'password') return json({ ok: false, error: 'not_yet', message: MSG.not_yet }, 501);   // Task 10
    if (a === 'grid') return link.kind === 'password' ? fail('wrong_link', 400) : await saveGrid(link, slots);
    return link.kind === 'offer' ? await answer(link, a as 'accept' | 'decline') : fail('wrong_link', 400);
  } catch (e) {
    console.error('onboard-link: ' + String((e as Error)?.message || e));
    return fail('unavailable', 503);
  }
});
