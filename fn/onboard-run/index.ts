// Welfare Avenue: onboard-run (v1, 01/11/26, wave271)
// The signed-in function behind HR's Start onboarding button. All actions are POST {action, ...}, for HR or admins only
// (wa_is_hr or is_wa_admin, run as the caller's JWT):
//   preview {flow_id, wa_email?}   {address, address_taken, needs_address, manager, grids, hub_events, steps, welcome, warnings}. Writes nothing.
//   start {flow_id, wa_email, manager_member_id, call_at, one_on_one_at?, group_session?, skip[], welcome?}   {steps}
//   retry {flow_id, step}          {steps}. Reruns that step and what was waiting on it. A done step is refused.
//   google_manual {flow_id, wa_email}   {steps}. HR made the account by hand: records the address and finishes what waited on it.
//   book_one_on_one {flow_id, at}   {ok, one_on_one_at, invited}. Books the 1-on-1 after Start and sends the invite then. Refused if it is already booked.
//   change_time {flow_id, which: 'call'|'one_on_one', at}   {ok, warnings}. Moves the same Calendar event (Google tells the guests), re-notifies the manager
//               (notify event onboard_date) and, for the call, moves the plan's dates (wa271_move_start). A time that has passed is refused.
//   change_manager {flow_id, member_id}   {ok, warnings}. Moves the 1-on-1 invite to the new manager, tells both (onboard_date), and resets manager_link_* and
//               reminded_manager_at so the new manager gets a grid link if the 1-on-1 is not booked.
//   backed_out {flow_id, reason}   {ok, remove, warnings}. Cancels both events (status cancelled, guests told), closes the plan (status completed, completed_at,
//               as the Hub does), sets the flow backed_out and the card withdrawn. It removes nothing from Google, Slack or the Hub: remove lists, as plain
//               sentences, what HR takes out by hand, naming only what this flow made.
//               All four need a flow that is running or started; waiting, ready and backed_out are refused. A practice flow changes its own row only.
//   send_grid_link {candidate_id, accepted?}   {ok}. For offers already out: mails the /o/ link; accepted: true sets accepted_on if it is empty.
//   remind {}   {ok, grid_links, reminded_hr, reminded_managers, skipped}. The Hub's hourly job (cron wa-onboard-remind, wa271_remind()), and the ONLY action the
//               trigger secret (x-wa-secret) may run here; a signed-in person cannot. Tells each manager their availability-grid link (event onboard_grid) once,
//               then reminds HR (hr_notify_emails) about a hire's empty grid and the manager about theirs (event onboard_remind), each once, after
//               onboard_remind_hours. Everything goes through notify to staff; nothing is ever sent to the new hire. Practice flows are left alone.
// Exports: STEPS, suggestAddress(name), nextSteps(steps).
// The steps are the table STEPS, {key, label, needs, setting?, ticks?, task?, run?, after?}, in order. A later task gives an entry a run and
// the runner stays as it is. An entry with no run, or held back by its setting, ends as hr_task with its task sentence. run(ctx) returns the
// sentence for detail; a throw is a failed step, and the message is what HR reads.
// Flow status: Start moves waiting or ready to running with a conditional update, so a double press runs the steps once. running becomes
// started once nothing is left on the card for HR to act on (no failed or waiting step, and google is not waiting on "I created it, continue").
// Practice: every step ends done, marked practice, and nothing outside hub_onboard_flows and hub_onboard_steps is touched, not even by fetch.
// onboarding_assign runs as the caller: its is_wa_staff check is false for the service key, which has no email in its JWT.
// Times: call_at and one_on_one_at are instants; the start date is the Toronto date of call_at. Reads and writes use the service role.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const HUB = 'https://hub.welfareavenue.com';
const CAL = 'hub@welfareavenue.com';
const DOMAIN = 'welfareavenue.com';
const ADMIN_ACTOR = 'steel.macdonald@welfareavenue.com';   // as directory-sync
const GCAL = 'https://www.googleapis.com/calendar/v3';
const SCOPE_CAL = 'https://www.googleapis.com/auth/calendar.events';
const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.send';
const SCOPE_DIR = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const TZ = 'America/Toronto';
const STALE_MS = 10 * 60 * 1000;   // a step left pending or running this long was cut off (the function died), so Retry may take it

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': HUB,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const no = (error: string, message: string, status = 409) => json({ error, message }, status);

// deno-lint-ignore no-explicit-any
type Row = any;
type Ctx = { flow: Row; by: string; asUser: Row; settings: Record<string, boolean> };
type StepRow = { step: string; status: string; detail?: string | null; practice?: boolean; at?: string; by?: string | null };
export type Step = {
  key: string; label: string; needs: string[];
  setting?: string;                                  // the app_config switch that must be on for run to be used
  ticks?: string[];                                  // hr_setup_template ids this step finishes
  task?: string;                                     // what HR does when this step is left to them
  run?: (ctx: Ctx) => Promise<string>;               // returns the detail sentence; throw to fail with that sentence
  after?: (ctx: Ctx) => Promise<void>;               // runs once the step is done, however it got done
};

/* ---------- the step table ---------- */
export const STEPS: Step[] = [
  { key: 'roster', label: 'Roster profile', needs: [], run: runRoster },
  { key: 'google', label: 'Google account', needs: ['roster'], setting: 'onboard_auto_google', ticks: ['hrb2'], after: addAddressToInvites,
    task: 'Create the account in Google, then press "I created it, continue" on this card.' },   // Task 10 adds run
  { key: 'plan', label: 'Onboarding plan', needs: ['roster'], ticks: ['hrb6'], run: runPlan },
  { key: 'invites', label: 'Calendar invites', needs: ['roster'], run: runInvites },
  { key: 'manager', label: 'Tell the manager', needs: ['roster'], run: runManager },
  { key: 'hub', label: 'Hub access', needs: ['google'], setting: 'onboard_auto_google',
    task: 'Invite them to the Hub at member level, from Roster.' },   // Task 11 adds run
  { key: 'slack', label: 'Slack channel', needs: ['roster'], setting: 'onboard_auto_slack', ticks: ['hrb4', 'hrb5'],
    task: 'Create their onboarding channel in Slack, add the manager and HR, and post the welcome message.' },   // Task 13 adds run
  { key: 'welcome', label: 'Welcome email', needs: ['google'], setting: 'onboard_auto_google', ticks: ['hrb1'],
    task: 'Send the welcome email to their personal address.' },   // Task 11 adds run
];
const stepOf = (key: string) => STEPS.find((s) => s.key === key);
const numberOf = (key: string) => STEPS.findIndex((s) => s.key === key) + 1;
const met = (status: string | undefined) => status === 'done' || status === 'skipped';

/* the steps that can run now: not started or waiting, with everything they need done or skipped. No row counts as pending. */
export function nextSteps(steps: StepRow[]): string[] {
  const by = new Map(steps.map((r) => [r.step, r.status]));
  return STEPS.filter((s) => ['pending', 'waiting'].includes(by.get(s.key) ?? 'pending') && s.needs.every((n) => met(by.get(n)))).map((s) => s.key);
}

/* first.last from a name: accents off, apostrophes and other marks out, hyphens kept. One word, or nothing usable, suggests nothing. */
export function suggestAddress(name: unknown): string | null {
  const plain = String(name ?? '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/đ/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = plain.split(/\s+/).map((w) => w.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')).filter(Boolean);
  return words.length < 2 ? null : words[0] + '.' + words[words.length - 1];
}
const cleanAddress = (v: unknown): string | null => {
  const a = String(v ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9.-]*@welfareavenue\.com$/.test(a) ? a : null;
};

/* ---------- small helpers ---------- */
async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('The Hub could not read its ' + name + ' setting. Tell Steel.');
  return data as string;
}
async function cfg(key: string): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return String((data as { value?: string } | null)?.value || '');
}
async function cfgNum(key: string, def: number): Promise<number> {
  const n = Number((await cfg(key)).trim());
  return Number.isFinite(n) && n > 0 ? n : def;
}
const errText = (e: unknown) => String((e as Error)?.message || e).slice(0, 400);
const torontoDate = (at: string | number | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const whenText = (at: string, lang: 'en' | 'fr' = 'en') => new Date(at).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });
const firstName = (full: unknown) => String(full || '').trim().split(/\s+/)[0] || '';
const instant = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function langOf(c: Row): 'fr' | 'en' {   // the same test recruit-actions and onboard-link use
  const s = String(c.summary || '') + ' ' + String(c.role || '');
  if (/\b(Français|French|francophone)\b/i.test(s) || /(Co-responsable|Cuisinier|Gestionnaire|bénévole|é.*poste)/i.test(String(c.role || ''))) return 'fr';
  return 'en';
}

/* ---------- rows ---------- */
const FLOW_COLS = 'id, candidate_id, practice, status, manager_member_id, wa_email, call_at, one_on_one_at, group_session, call_event_id, one_on_one_event_id, onboarding_id, slack_channel_id, welcome_subject, welcome_text, started_by, started_at';
const CAND_COLS = 'id, name, role, status, email, summary, notes, position_id, accepted_on, offer_sent_at, member_id, start_date, practice';
async function getFlow(id: unknown): Promise<Row | null> {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const { data } = await svc.from('hub_onboard_flows').select(FLOW_COLS).eq('id', n).maybeSingle();
  return data;
}
async function getCand(id: unknown): Promise<Row | null> {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const { data } = await svc.from('hub_candidates').select(CAND_COLS).eq('id', n).maybeSingle();
  return data;
}
async function getMember(id: unknown): Promise<Row | null> {
  if (id == null) return null;
  const { data } = await svc.from('team_members').select('id, name, email, active').eq('id', Number(id)).maybeSingle();
  return data;
}
async function membersByEmail(email: unknown): Promise<Row[]> {   // ilike for the case; _ is a wildcard there, so the exact match is made here
  const e = String(email || '').trim().toLowerCase();
  if (!e) return [];
  const { data } = await svc.from('team_members').select('id, name, email, active').ilike('email', e);
  return ((data || []) as Row[]).filter((m) => String(m.email || '').trim().toLowerCase() === e);
}
async function readSteps(flowId: number): Promise<StepRow[]> {
  const { data } = await svc.from('hub_onboard_steps').select('step, status, detail, practice, at, by').eq('flow_id', flowId);
  const rows = (data || []) as StepRow[];
  return rows.sort((a, b) => numberOf(a.step) - numberOf(b.step));
}
async function setStep(ctx: Ctx, key: string, status: string, detail: string): Promise<void> {
  const { error } = await svc.from('hub_onboard_steps').update({ status, detail, at: new Date().toISOString(), by: ctx.by }).eq('flow_id', ctx.flow.id).eq('step', key);
  if (error) throw new Error('The Hub could not save the result of step ' + numberOf(key) + ': ' + error.message);
}
async function makeCtx(flow: Row, by: string, asUser: Row): Promise<Ctx> {
  const settings: Record<string, boolean> = {};
  for (const k of ['onboard_auto_google', 'onboard_auto_slack']) settings[k] = (await cfg(k)).trim().toLowerCase() === 'on';
  return { flow, by, asUser, settings };
}

/* ---------- the runner ---------- */
/* a setting that is off leaves the step to HR, until the account it hangs on exists: then what waited on google runs */
function heldBack(s: Step, settings: Record<string, boolean>, status: Map<string, string>): boolean {
  if (!s.setting || settings[s.setting]) return false;
  return !(s.needs.includes('google') && met(status.get('google')));
}
async function tickSetup(ctx: Ctx): Promise<void> {   // a checklist that cannot be ticked is not a failed step: HR can tick it by hand
  try {
    if (!ctx.flow.onboarding_id) return;
    const done = (await readSteps(ctx.flow.id)).filter((r) => r.status === 'done');
    const ids = done.flatMap((r) => stepOf(r.step)?.ticks || []);
    if (!ids.length) return;
    await svc.from('hr_setup_steps').update({ done: true, done_at: new Date().toISOString(), done_by: ctx.by }).eq('onboarding_id', ctx.flow.onboarding_id).in('template_id', ids).not('done', 'is', true);
  } catch (_) { /* see above */ }
}
async function completed(ctx: Ctx, s: Step, detail: string): Promise<void> {
  await setStep(ctx, s.key, 'done', detail);
  await tickSetup(ctx);
  if (s.after) await s.after(ctx);
}
async function execute(ctx: Ctx, s: Step): Promise<void> {
  const { data: won } = await svc.from('hub_onboard_steps').update({ status: 'running', at: new Date().toISOString(), by: ctx.by }).eq('flow_id', ctx.flow.id).eq('step', s.key).in('status', ['pending', 'waiting']).select('step');
  if (!(won as unknown[] | null)?.length) return;   // someone else has it
  const fresh = await getFlow(ctx.flow.id);
  if (fresh) ctx.flow = fresh;
  if (ctx.flow.practice) return setStep(ctx, s.key, 'done', 'Practice: nothing real was changed by this step (' + s.label + ').');
  const status = new Map((await readSteps(ctx.flow.id)).map((r) => [r.step, r.status]));
  if (!s.run || heldBack(s, ctx.settings, status)) return setStep(ctx, s.key, 'hr_task', s.task || 'This step is left to HR.');
  let detail: string;
  try {
    detail = await s.run(ctx);
  } catch (e) {
    return setStep(ctx, s.key, 'failed', errText(e));
  }
  await completed(ctx, s, detail);
}
/* runs everything that can run, in table order, then says why the rest cannot. A step only moves here from pending or waiting. */
async function advance(ctx: Ctx): Promise<void> {
  const tried = new Set<string>();
  for (;;) {
    const key = nextSteps(await readSteps(ctx.flow.id)).find((k) => !tried.has(k));
    if (!key) break;
    tried.add(key);
    await execute(ctx, stepOf(key)!);
  }
  const rows = await readSteps(ctx.flow.id);
  const status = new Map(rows.map((r) => [r.step, r.status]));
  for (const s of STEPS) {
    if (!['pending', 'waiting'].includes(status.get(s.key) ?? '')) continue;
    const blockers = s.needs.filter((n) => !met(status.get(n)));
    if (!blockers.length) continue;   // only when another request holds it
    const toHr = (!s.run || heldBack(s, ctx.settings, status)) && blockers.every((n) => status.get(n) === 'hr_task');
    const next = toHr ? 'hr_task' : 'waiting';
    status.set(s.key, next);
    await setStep(ctx, s.key, next, toHr ? (s.task || 'This step is left to HR.') : 'Waiting on step ' + numberOf(blockers[0]) + ', ' + stepOf(blockers[0])!.label + '.');
  }
  await finish(ctx);
}
async function finish(ctx: Ctx): Promise<void> {
  const rows = await readSteps(ctx.flow.id);
  const settled = rows.every((r) => ['done', 'skipped', 'hr_task'].includes(r.status)) && !rows.some((r) => r.step === 'google' && r.status === 'hr_task');
  if (!settled) return;
  const now = new Date().toISOString();
  await svc.from('hub_onboard_flows').update({ status: 'started', started_at: now, updated_at: now }).eq('id', ctx.flow.id).eq('status', 'running');
}
const reply = async (flowId: number) => json({ steps: await readSteps(flowId) });

/* ---------- step: roster ---------- */
async function log(entity_type: string, entity_id: unknown, field: string, old_value: unknown, new_value: unknown, changed_by: string): Promise<void> {
  try { await svc.from('change_log').insert({ entity_type, entity_id: String(entity_id), field, old_value: old_value == null ? null : String(old_value), new_value: new_value == null ? null : String(new_value), changed_by }); } catch (_) { /* audit */ }
}
async function runRoster(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c) throw new Error('The candidate card is gone, so there is nothing to put on the roster.');
  const start = torontoDate(f.call_at);
  let member: Row = c.member_id ? await getMember(c.member_id) : null;
  if (!member) {
    const found = [...await membersByEmail(c.email), ...await membersByEmail(f.wa_email)];
    member = found.find((m) => m.active !== false) || found[0] || null;
  }
  let said: string;
  if (member) {   // directory-sync overwrites a start date unless start_source is manual
    const patch: Record<string, unknown> = { start_date: start, start_source: 'manual' };
    if (member.active === false) patch.active = true;
    if (f.wa_email && !/@welfareavenue\.com$/i.test(String(member.email || ''))) patch.email = f.wa_email;
    const { error } = await svc.from('team_members').update(patch).eq('id', member.id);
    if (error) throw new Error('The roster profile could not be updated: ' + error.message + '. Press Retry.');
    said = 'Linked the existing roster profile of ' + member.name + ', with ' + start + ' as the start date.';
  } else {
    let pos: Row = null;
    if (c.position_id) ({ data: pos } = await svc.from('hub_positions').select('title, dept').eq('id', c.position_id).maybeSingle());
    const { data, error } = await svc.from('team_members').insert({
      name: c.name, email: f.wa_email || String(c.email || '').trim().toLowerCase() || null, department: pos?.dept || null, role: c.role || pos?.title || null,
      position_id: c.position_id || null, active: true, start_date: start, start_source: 'manual',
    }).select('id, name').single();
    if (error || !data) throw new Error('The roster profile could not be created: ' + (error?.message || 'no row came back') + '. Press Retry.');
    member = data;
    said = 'Created the roster profile, with ' + start + ' as the start date.';
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: 'hired', member_id: member.id, start_date: start, updated_at: now, updated_by: ctx.by };
  if (c.status !== 'hired') patch.stage_at = now;
  const { error } = await svc.from('hub_candidates').update(patch).eq('id', c.id);
  if (error) throw new Error('The profile is on the roster, but the card could not move to Hired: ' + error.message + '. Press Retry.');
  await log('candidate', c.id, 'status', c.status, 'hired (Start onboarding)', ctx.by);
  return said;
}

/* ---------- step: plan ---------- */
async function runPlan(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (f.onboarding_id) return 'The onboarding plan was already made.';
  if (!c?.member_id) throw new Error('The card has no roster profile yet. Retry step 1 first.');
  const start = torontoDate(f.call_at);
  const save = async (id: unknown) => {
    const { error } = await svc.from('hub_onboard_flows').update({ onboarding_id: id, updated_at: new Date().toISOString() }).eq('id', f.id);
    if (error) throw new Error('The plan exists, but could not be saved on the flow: ' + error.message + '. Press Retry.');
    ctx.flow.onboarding_id = id;
  };
  /* one open plan a person: from the old dropdown, or an earlier try that could not save its id */
  const { data: open } = await svc.from('onboardings').select('id').eq('member_id', c.member_id).is('completed_at', null).limit(1);
  const had = ((open || []) as Row[])[0];
  if (had) {
    await save(had.id);
    const { error } = await svc.rpc('wa271_move_start', { p_onboarding: had.id, p_new: start });
    if (error) throw new Error('They already have an open plan, but its dates could not move: ' + error.message + '. Press Retry.');
    return 'They already had an open plan, so it was kept and day one moved to ' + start + '.';
  }
  const { data, error } = await ctx.asUser.rpc('onboarding_assign', { p_member_id: c.member_id, p_by: ctx.by, p_start: start });
  if (error || !data) throw new Error('The onboarding plan could not be made: ' + (error?.message || 'no plan came back') + '. Press Retry.');
  await save(data);
  return 'Made the onboarding plan, with day one on ' + start + '.';
}

/* ---------- Google: as hub@ (delegation), or as an admin for the Directory ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const raw = atob(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
const TOK: Record<string, { v: string; exp: number }> = {};
async function token(sub: string | null, scope: string): Promise<string | null> {
  const k = (sub || 'sa') + ' ' + scope;
  if (TOK[k] && Date.now() < TOK[k].exp - 60000) return TOK[k].v;
  let sa: Row;
  try { sa = JSON.parse(await getSecret('GOOGLE_SA_KEY')); } catch (_) { throw new Error('The Hub could not read its Google key. Tell Steel.'); }   // the parser's message quotes the text, so it never goes further
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const claims: Record<string, unknown> = { iss: sa.client_email, scope, aud: sa.token_uri, iat: now, exp: now + 3600 };
  if (sub) claims.sub = sub;
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key).buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + body)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + body + '.' + b64url(sig) }) });
  const j = await res.json().catch(() => ({}));
  if (!j.access_token) return null;
  TOK[k] = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}
/* is this address in use? Workspace knows accounts and aliases; the roster knows people. taken wins over unknown. Practice asks nobody outside. */
async function addressState(addr: string | null, memberId: unknown, practice: boolean): Promise<{ taken: boolean; unknown: boolean }> {
  if (!addr) return { taken: false, unknown: false };
  if ((await membersByEmail(addr)).some((m) => String(m.id) !== String(memberId))) return { taken: true, unknown: false };
  if (practice) return { taken: false, unknown: false };
  try {
    const t = await token(ADMIN_ACTOR, SCOPE_DIR);
    if (!t) return { taken: false, unknown: true };
    const r = await fetch('https://admin.googleapis.com/admin/directory/v1/users/' + encodeURIComponent(addr) + '?fields=primaryEmail', { headers: { Authorization: 'Bearer ' + t } });
    if (r.ok) return { taken: true, unknown: false };
    return { taken: false, unknown: r.status !== 404 };
  } catch (_) { return { taken: false, unknown: true }; }
}

/* ---------- mail: who it really goes to, and the Gmail send from hub@ (Task 11 uses this for the welcome email) ---------- */
/* mail_mode test (or unset): the test inboxes instead of the real people, with the real address named. No inboxes: a refusal. */
async function reach(real: string[]): Promise<{ live: boolean; to: string[]; prefix: string }> {
  if (((await cfg('mail_mode')) || 'test') === 'live') return { live: true, to: real, prefix: '' };
  const to = (await cfg('mail_test_recipients')).split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!to.length) throw new Error('Email is in test mode and there are no test recipients. Add them in the mail settings, then try again.');
  return { live: false, to, prefix: '[TEST, for ' + real.join(', ') + '] ' };
}
const noBreaks = (s: string) => String(s).replace(/[\r\n]+/g, ' ');
async function deliver(m: { practice: boolean; to: string; subject: string; text: string; html: string; replyTo?: string }): Promise<{ mode: string; to: string[] }> {
  if (m.practice) return { mode: 'practice', to: [] };
  const r = await reach([noBreaks(m.to)]);
  const t = await token(CAL, SCOPE_GMAIL);
  if (!t) throw new Error('The email was not sent: Google refused the Hub permission to send from ' + CAL + '. Tell Steel.');
  const boundary = 'wa' + Date.now().toString(36);
  const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
  const mime = [
    'From: Welfare Avenue Hub <' + CAL + '>',
    'To: ' + r.to.join(', '),
    ...(m.replyTo ? ['Reply-To: ' + noBreaks(m.replyTo)] : []),
    'Subject: =?UTF-8?B?' + b64(noBreaks(r.prefix + m.subject)) + '?=',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(m.text),
    '--' + boundary, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(m.html),
    '--' + boundary + '--', '',
  ].join('\r\n');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: b64url(new TextEncoder().encode(mime)) }) });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error('The email was not sent: Google said ' + String(j?.error?.message || res.status).slice(0, 160) + '. Try again.');
  }
  return { mode: r.live ? 'live' : 'test', to: r.to };
}

/* ---------- step: invites ---------- */
type Kind = 'call' | 'one';
const COLUMN: Record<Kind, string> = { call: 'call_event_id', one: 'one_on_one_event_id' };
/* Calendar ids may only use a to v and 0 to 9. The same id on every try is what stops a second event. */
const eventId = (flowId: number, kind: Kind) => 'onboard' + flowId + (kind === 'call' ? 'call' : 'oneonone');
const eventsPath = '/calendars/' + encodeURIComponent(CAL) + '/events';
// deno-lint-ignore no-explicit-any
async function gcal(t: string, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; j: any }> {
  const r = await fetch(GCAL + path, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function calToken(): Promise<string> {
  const t = await token(CAL, SCOPE_CAL);
  if (!t) throw new Error('Google refused the Hub permission to use the calendar of ' + CAL + '. Tell Steel, or send the invites by hand.');
  return t;
}
/* the new hire's personal address, their WA address once the account exists, and the other person */
async function guests(ctx: Ctx, c: Row, kind: Kind): Promise<string[]> {
  const f = ctx.flow, status = new Map((await readSteps(f.id)).map((r) => [r.step, r.status]));
  const list = [String(c.email || '').trim().toLowerCase()];
  if (f.wa_email && met(status.get('google'))) list.push(f.wa_email);
  if (kind === 'call') list.push(String(f.started_by || ctx.by).toLowerCase());
  else {
    const m = await getMember(f.manager_member_id);
    if (!m?.email) throw new Error((m?.name || 'The manager') + ' has no email on the roster, so the 1-on-1 cannot be sent. Add it, then press Retry.');
    list.push(String(m.email).toLowerCase());
  }
  return Array.from(new Set(list.filter(Boolean)));
}
const oneSummary = (c: Row, managerName: string) => (langOf(c) === 'fr' ? 'Rencontre individuelle : ' + c.name + ' et ' : '1-on-1: ' + c.name + ' and ') + managerName;
/* who an invite really goes to (the test inboxes in test mode) and the title prefix that says so; real[0] is the new hire */
type Invite = { to: string[]; prefix: string; live: boolean };
async function inviteList(ctx: Ctx, c: Row, kind: Kind): Promise<Invite> {
  const real = await guests(ctx, c, kind);
  const r = await reach(real);
  return { to: r.to, live: r.live, prefix: r.live ? '' : '[TEST, for ' + real[0] + '] ' };
}
async function bookEvent(ctx: Ctx, t: string, c: Row, kind: Kind, r: { to: string[]; prefix: string }): Promise<string> {
  const f = ctx.flow, fr = langOf(c) === 'fr';
  const at = kind === 'call' ? f.call_at : f.one_on_one_at;
  const minutes = kind === 'call' ? await cfgNum('onboard_call_min', 60) : await cfgNum('onboard_one_on_one_min', 30);
  const m = kind === 'one' ? await getMember(f.manager_member_id) : null;
  const id = eventId(f.id, kind);
  const summary = kind === 'call' ? (fr ? "Appel d'accueil : " : 'Onboarding call: ') + c.name : oneSummary(c, m?.name || '');
  const description = kind === 'call'
    ? (fr ? 'Votre premier jour avec Welfare Avenue. Utilisez le lien Meet de cette invitation.' : 'Your first day with Welfare Avenue. Use the Meet link in this invite.')
    : (fr ? 'Votre première rencontre avec votre gestionnaire. Utilisez le lien Meet de cette invitation.' : 'Your first meeting with your manager. Use the Meet link in this invite.');
  const event = {
    summary: r.prefix + summary, description, status: 'confirmed',
    start: { dateTime: new Date(at).toISOString(), timeZone: TZ }, end: { dateTime: new Date(Date.parse(at) + minutes * 60000).toISOString(), timeZone: TZ },
    attendees: r.to.map((email) => ({ email })), guestsCanModify: false,
    conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    extendedProperties: { private: { wa_onboard_flow: String(f.id) } },
  };
  const query = '?conferenceDataVersion=1&sendUpdates=all';
  let out = await gcal(t, 'POST', eventsPath + query, { id, ...event });
  if (out.status === 409) out = await gcal(t, 'PATCH', eventsPath + '/' + encodeURIComponent(id) + query, event);   // it exists from an earlier try, perhaps cancelled
  if (!out.ok) throw new Error('Google refused the ' + (kind === 'call' ? 'onboarding call' : '1-on-1') + ' invite: ' + String(out.j?.error?.message || out.status).slice(0, 160) + '. Press Retry.');
  const { error } = await svc.from('hub_onboard_flows').update({ [COLUMN[kind]]: id, updated_at: new Date().toISOString() }).eq('id', f.id);
  if (error) throw new Error('The invite went out, but its id could not be saved: ' + error.message + '. Press Retry.');
  f[COLUMN[kind]] = id;
  return id;
}
async function runInvites(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c?.email) throw new Error('The card has no personal email, so the invites cannot reach them. Add it, then press Retry.');
  const kinds: Kind[] = f.one_on_one_at ? ['call', 'one'] : ['call'];
  const t = await calToken();
  const sent = new Set<string>();
  let live = true;
  for (const kind of kinds) {
    const r = await inviteList(ctx, c, kind);
    live = r.live;
    r.to.forEach((x) => sent.add(x));
    await bookEvent(ctx, t, c, kind, r);
  }
  const what = f.one_on_one_at ? 'The onboarding call and the 1-on-1 are booked' : 'The onboarding call is booked; the 1-on-1 is still to book';
  return what + (live ? ', with invites to ' : ', and email is in test mode, so the invites went only to ') + Array.from(sent).join(', ') + '.';
}
/* google finished after the invites went out: add the new address to both events */
async function addAddressToInvites(ctx: Ctx): Promise<void> {
  const fresh = await getFlow(ctx.flow.id);
  if (fresh) ctx.flow = fresh;
  const f = ctx.flow;
  if (!f.wa_email) return;
  const invites = (await readSteps(f.id)).find((r) => r.step === 'invites');
  if (invites?.status !== 'done') return;   // a later run or retry sends the full list anyway
  try {
    if (((await cfg('mail_mode')) || 'test') !== 'live') return;   // the guests are the test inboxes, which have not changed
    const c = await getCand(f.candidate_id);
    const t = await calToken();
    for (const kind of ['call', 'one'] as Kind[]) {
      if (!f[COLUMN[kind]]) continue;
      const attendees = (await guests(ctx, c, kind)).map((email) => ({ email }));
      const out = await gcal(t, 'PATCH', eventsPath + '/' + encodeURIComponent(f[COLUMN[kind]]) + '?sendUpdates=all', { attendees });
      if (!out.ok) throw new Error('Google refused to add ' + f.wa_email + ' to the invites: ' + String(out.j?.error?.message || out.status).slice(0, 160) + '. Press Retry.');
    }
    await setStep(ctx, 'invites', 'done', String(invites.detail || 'Invites sent.') + ' Added ' + f.wa_email + ' once the account existed.');
  } catch (e) {
    await setStep(ctx, 'invites', 'failed', errText(e));
  }
}

/* ---------- what notify says happened ---------- */
/* notify answers 200 with an outcome for each person ({ outcome: { email: sent | sent_channel | hub_only | opted_out | no_slack | no_email | failed }, hub }),
   so a 200 alone does not mean anyone was told. Reached: the Slack DM went (or the person chose Hub only), or the Hub notification reached a device.
   opted_out is their own choice and counts as handled. Anything else is not reached, and the caller must be able to try again. */
const LOST_WHY: Record<string, string> = {
  no_slack: 'they have no Slack account and no Hub notifications on',
  no_email: 'they have no email on the roster',
  failed: 'Slack refused the message and no Hub notification reached them',
};
function hubReached(hub: unknown, email: string): boolean {   // hub-push's words: "<email>: sent to 2 devices; <email>: no device"
  return String(hub ?? '').split(';').some((part) => { const m = /^\s*(.+?): sent to (\d+) device/.exec(part); return !!m && m[1].toLowerCase() === email && Number(m[2]) > 0; });
}
function verdict(j: Row, email: string): { kind: 'reached' | 'opted_out' | 'lost'; why: string } {
  const slack = String(j?.outcome?.[email] ?? '');
  if (['sent', 'sent_channel', 'hub_only'].includes(slack) || hubReached(j?.hub, email)) return { kind: 'reached', why: '' };
  if (slack === 'opted_out') return { kind: 'opted_out', why: 'their switch for this notification is off' };
  return { kind: 'lost', why: LOST_WHY[slack] || 'notify gave no answer for them' };
}

/* ---------- step: manager ---------- */
async function runManager(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id), m = await getMember(f.manager_member_id);
  if (!m) throw new Error('The manager is no longer on the roster. Change the manager on this card.');
  if (!m.email) throw new Error(m.name + ' has no email on the roster, so they cannot be told. Add it, then press Retry.');
  const when = whenText(f.call_at);
  const secret = await getSecret('WA_TRIGGER_SECRET');
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + '/functions/v1/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret, Authorization: 'Bearer ' + ANON_KEY },
      body: JSON.stringify({
        event: 'onboard_date', to_email: String(m.email).toLowerCase(), url: '#hrcentre/onboarding', tag: 'onboard-date-' + f.id,
        title: c.name + ' starts ' + torontoDate(f.call_at), body: c.name + ' (' + (c.role || 'new hire') + ') has their onboarding call on ' + when + '. That is their first day.',
        text: '*' + esc(c.name) + '* (' + esc(c.role || 'new hire') + ') has their onboarding call on ' + when + '. That is their first day. <' + HUB + '/#hrcentre/onboarding|Open Onboarding>',
      }),
    });
  } catch (e) {
    throw new Error(m.name + ' was not told: the Hub could not reach its notifications (' + errText(e) + '). Press Retry.');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(m.name + ' was not told: notifications said ' + String(j?.error || res.status).slice(0, 160) + '. Press Retry, or tell them yourself.');
  }
  const v = verdict(await res.json().catch(() => ({})), String(m.email).toLowerCase());
  if (v.kind === 'opted_out') return m.name + ' was not messaged: their switch for this notification is off. Tell them yourself if they should know.';
  if (v.kind === 'lost') throw new Error(m.name + ' was not told: ' + v.why + '. Tell them yourself, or press Retry.');
  return 'Told ' + m.name + ' the date and time.';
}

/* ---------- actions ---------- */
async function preview(b: Row): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  const warnings: string[] = [];
  const suggested = suggestAddress(c.name);
  const address = cleanAddress(b.wa_email) || f.wa_email || (suggested ? suggested + '@' + DOMAIN : null);
  const state = await addressState(address, c.member_id, !!f.practice);
  if (!address) warnings.push('This name does not fit first.last, so HR must type the address.');
  if (state.taken) warnings.push(address + ' is already in use. Change the address, or skip the Google account step.');
  if (state.unknown) warnings.push('The Hub could not check ' + address + ' with Google. Check it in Google before you start.');

  let manager: Row = { member_id: null, name: null, how: 'none' };
  if (f.manager_member_id) {
    const m = await getMember(f.manager_member_id);
    if (m) manager = { member_id: m.id, name: m.name, how: 'chosen' };
  } else {
    const { data } = await svc.rpc('wa271_default_manager', { p_candidate: c.id });
    if (data) manager = data;
  }
  if (!manager.member_id) warnings.push('The Hub cannot tell who the manager is, so HR must choose.');

  const { data: gridRows } = await svc.from('hub_onboard_grids').select('who, slots').eq('flow_id', f.id);
  const grids: Record<string, string[]> = { hire: [], manager: [] };
  for (const g of (gridRows || []) as Row[]) grids[g.who] = g.slots || [];

  /* the hub@ meetings each person is invited to, for the picker to grey out; never their own calendars */
  const from = new Date().toISOString(), to = new Date(Date.now() + (await cfgNum('onboard_grid_days', 14)) * 86400000).toISOString();
  const mgr = manager.member_id ? await getMember(manager.member_id) : null;
  const seen = new Map<string, Row>();
  for (const [who, email] of [['hire', c.email], ['manager', mgr?.email]] as Array<[string, string | undefined]>) {
    if (!email) continue;
    const { data } = await svc.from('hub_events').select('id, summary, start_at, end_at').contains('attendee_emails', [String(email).toLowerCase()]).neq('status', 'cancelled').gte('start_at', from).lte('start_at', to);
    for (const e of (data || []) as Row[]) { const had = seen.get(e.id); seen.set(e.id, { ...e, who: had ? [...had.who, who] : [who] }); }
  }

  const rows = await readSteps(f.id);
  const status = new Map(rows.map((r) => [r.step, r.status]));
  const ctx = await makeCtx(f, '', null);
  const steps = STEPS.map((s) => {
    const row = rows.find((r) => r.step === s.key);
    return { key: s.key, label: s.label, needs: s.needs, mode: f.practice ? 'practice' : !s.run || heldBack(s, ctx.settings, status) ? 'hr_task' : 'run', status: row?.status || null, detail: row?.detail || null };
  });

  let pos: Row = null;
  if (c.position_id) ({ data: pos } = await svc.from('hub_positions').select('jd_url').eq('id', c.position_id).maybeSingle());
  if (!pos?.jd_url) warnings.push('The position has no job description link, so the welcome email leaves that line out.');
  if (c.email) {
    const { data: others } = await svc.from('hub_candidates').select('id, email').ilike('email', String(c.email).trim()).neq('id', c.id).not('status', 'in', '(declined,withdrawn)');
    const n = ((others || []) as Row[]).filter((o) => String(o.email || '').trim().toLowerCase() === String(c.email).trim().toLowerCase()).length;
    if (n) warnings.push('This person has ' + n + ' other application' + (n === 1 ? '' : 's') + ' still open. Close ' + (n === 1 ? 'it' : 'them') + ' by hand so they do not get a second account.');
  } else warnings.push('The card has no personal email, so the invites cannot reach them.');
  if (((await cfg('mail_mode')) || 'test') !== 'live') warnings.push('Email is in test mode: invites and emails go to the test inboxes, not to this person.');
  if (f.practice) warnings.push('This is a practice applicant: the run is a simulation and nothing real changes.');

  return json({ address, address_taken: state.taken, needs_address: !address, manager, grids, hub_events: Array.from(seen.values()), steps, welcome: defaultWelcome(f, c), warnings });
}
/* Task 11 replaces this with renderWelcome */
function defaultWelcome(f: Row, c: Row): { subject: string; text: string } {
  if (f.welcome_subject || f.welcome_text) return { subject: f.welcome_subject || '', text: f.welcome_text || '' };
  return langOf(c) === 'fr'
    ? { subject: 'Bienvenue chez Welfare Avenue! Vos prochaines étapes', text: 'Bonjour ' + firstName(c.name) + ',\n\nFélicitations et bienvenue chez Welfare Avenue! Votre rôle : ' + (c.role || '') + '.\n\nAu plaisir,\nWelfare Avenue' }
    : { subject: 'Welcome to Welfare Avenue! Your Next Steps', text: 'Hi ' + firstName(c.name) + ',\n\nCongratulations and welcome to Welfare Avenue! Your role: ' + (c.role || '') + '.\n\nWarmly,\nWelfare Avenue' };
}

async function start(b: Row, by: string, asUser: Row): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (!['waiting', 'ready'].includes(f.status)) return no('already_started', f.status === 'backed_out' ? 'This person backed out, so onboarding cannot start.' : 'Onboarding has already been started for this person.');
  const skip: string[] = Array.isArray(b.skip) ? b.skip.map(String) : [];
  if (skip.includes('roster')) return no('roster_required', 'The roster profile step cannot be skipped: every other step needs it.', 400);
  const unknown = skip.find((k) => !stepOf(k));
  if (unknown) return no('bad_step', 'The Hub does not know the step "' + noBreaks(unknown).slice(0, 40) + '". Reload the page.', 400);
  const callAt = instant(b.call_at);
  if (!callAt) return no('no_call', 'Pick a time for the onboarding call first.', 400);
  if (Date.parse(callAt) <= Date.now()) return no('past_call', 'The onboarding call time has already passed. Pick a new time.', 400);
  const given = b.one_on_one_at != null && b.one_on_one_at !== '';
  const oneAt = given ? instant(b.one_on_one_at) : null;
  if (given && !oneAt) return no('bad_one_on_one', 'The 1-on-1 time is not a time the Hub can read. Pick it again.', 400);
  if (oneAt && Date.parse(oneAt) <= Date.now()) return no('past_one_on_one', 'The 1-on-1 time has already passed. Pick a new time, or book it later.', 400);
  const manager = b.manager_member_id ? await getMember(b.manager_member_id) : null;
  if (!manager || manager.active === false) return no('no_manager', 'Choose a manager who is on the roster first.', 400);
  const googleOn = !skip.includes('google');
  const raw = String(b.wa_email ?? '').trim();
  const addr = raw ? cleanAddress(raw) : null;
  if (raw && !addr) return no('bad_address', 'The new address must be a plain address ending in @' + DOMAIN + '. Change it and try again.', 400);
  if (!addr && googleOn) return no('no_address', 'Type the new address, or skip the Google account step.', 400);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  if (googleOn && (await addressState(addr, c.member_id, !!f.practice)).taken) return no('address_taken', addr + ' is already in use. Change the address, or skip the Google account step.');

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: 'running', manager_member_id: manager.id, wa_email: addr, call_at: callAt, one_on_one_at: oneAt,
    group_session: String(b.group_session ?? '').trim() || null, started_by: by, updated_at: now,
  };
  if (b.welcome && typeof b.welcome === 'object') {
    if (typeof b.welcome.subject === 'string') patch.welcome_subject = b.welcome.subject;
    if (typeof b.welcome.text === 'string') patch.welcome_text = b.welcome.text;
  }
  /* the claim: of two presses, only one finds the flow still waiting or ready */
  const { data: won, error } = await svc.from('hub_onboard_flows').update(patch).eq('id', f.id).in('status', ['waiting', 'ready']).select(FLOW_COLS);
  if (error) return no('save', 'The Hub could not start this: ' + error.message + '. Try again.', 500);
  const flow = (won as Row[] | null)?.[0];
  if (!flow) return no('already_started', 'Onboarding has already been started for this person.');
  const seed = STEPS.map((s) => ({ flow_id: f.id, step: s.key, status: skip.includes(s.key) ? 'skipped' : 'pending', detail: skip.includes(s.key) ? 'Skipped by HR in the preview.' : null, practice: !!f.practice, at: now, by }));
  const { error: seedError } = await svc.from('hub_onboard_steps').upsert(seed, { onConflict: 'flow_id,step' });
  if (seedError) {
    await svc.from('hub_onboard_flows').update({ status: f.status, updated_at: now }).eq('id', f.id);
    return no('save', 'The Hub could not start this: ' + seedError.message + '. Try again.', 500);
  }
  await advance(await makeCtx(flow, by, asUser));
  return reply(f.id);
}

async function retry(b: Row, by: string, asUser: Row): Promise<Response> {
  const s = stepOf(String(b.step));
  if (!s) return no('bad_step', 'The Hub does not know that step. Reload the page.', 400);
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', 'This person backed out, so nothing can be retried.');
  if (!['running', 'started'].includes(f.status)) return no('not_started', 'Onboarding has not been started for this person, so there is nothing to retry.');
  const row = (await readSteps(f.id)).find((r) => r.step === s.key);
  if (!row) return no('not_started', 'Onboarding has not been started for this person, so there is nothing to retry.');
  if (row.status === 'done') return no('already_done', 'That step is already done, so it will not run again.');
  if (row.status === 'waiting') return no('still_waiting', String(row.detail || 'That step is waiting on an earlier one.') + ' Retry that one first.');
  const stuck = ['pending', 'running'].includes(row.status);
  if (stuck && Date.now() - Date.parse(String(row.at)) < STALE_MS) return no('in_progress', 'That step is running now. Give it a minute, then reload.');
  /* the claim: of two presses, only one finds the step as it was read */
  const { data: won } = await svc.from('hub_onboard_steps').update({ status: 'pending', detail: null, at: new Date().toISOString(), by }).eq('flow_id', f.id).eq('step', s.key).eq('status', row.status).select('step');
  if (!(won as unknown[] | null)?.length) return no('in_progress', 'That step is running now. Give it a minute, then reload.');
  await advance(await makeCtx(f, by, asUser));
  return reply(f.id);
}

async function googleManual(b: Row, by: string, asUser: Row): Promise<Response> {
  const addr = cleanAddress(b.wa_email);
  if (!addr) return no('bad_address', 'The new address must be a plain address ending in @' + DOMAIN + '. Change it and try again.', 400);
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', BACKED_OUT_NOW);
  if (!['running', 'started'].includes(f.status)) return no('not_started', 'Press Start onboarding first.');
  const row = (await readSteps(f.id)).find((r) => r.step === 'google');
  if (row?.status === 'done') return no('already_done', 'The Google account step is already done.');
  const open = ['hr_task', 'failed', 'skipped'];
  if (!row || !open.includes(row.status)) return no('still_waiting', String(row?.detail || 'That step is not ready yet.') + ' Retry that one first.');
  const c = await getCand(f.candidate_id);
  if ((await membersByEmail(addr)).some((m) => String(m.id) !== String(c?.member_id))) return no('address_taken', addr + ' is on another roster profile. Check the address and try again.');
  const now = new Date().toISOString();
  const { error } = await svc.from('hub_onboard_flows').update({ wa_email: addr, updated_at: now }).eq('id', f.id);
  if (error) return no('save', 'The address could not be saved: ' + error.message + '. Try again.', 500);
  if (c?.member_id) {
    const { error: e2 } = await svc.from('team_members').update({ email: addr }).eq('id', c.member_id);
    if (e2) return no('save', 'The address could not be saved on the roster profile: ' + e2.message + '. Try again.', 500);
  }
  /* the claim: of two presses, only one finishes the step */
  const { data: won } = await svc.from('hub_onboard_steps').update({ status: 'running', at: now, by }).eq('flow_id', f.id).eq('step', 'google').in('status', open).select('step');
  if (!(won as unknown[] | null)?.length) return no('already_done', 'The Google account step is already done.');
  const ctx = await makeCtx({ ...f, wa_email: addr }, by, asUser);
  await completed(ctx, stepOf('google')!, 'HR created ' + addr + ' in Google.');
  /* what was left to HR only because the account was missing can now run; an entry with no run stays with HR */
  const held = (await readSteps(f.id)).filter((r) => r.status === 'hr_task' && stepOf(r.step)?.needs.includes('google') && stepOf(r.step)?.run);
  for (const r of held) await svc.from('hub_onboard_steps').update({ status: 'waiting', at: now, by }).eq('flow_id', f.id).eq('step', r.step).eq('status', 'hr_task');
  await advance(ctx);
  return reply(f.id);
}

/* ---------- changes after Start ---------- */
/* All four need a flow that Start has begun (running, or started once nothing is left for HR). Each claims its change with a conditional update, so a double
   press changes it once, and gives the claim back if Google refuses. A practice flow changes its own row and nothing else: no Calendar, no notify. */
const AFTER_START = ['running', 'started'];
const BACKED_OUT_NOW = 'This person backed out, so their onboarding cannot be changed.';
async function openFlow(b: Row): Promise<{ f: Row; c: Row } | Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', BACKED_OUT_NOW);
  if (!AFTER_START.includes(f.status)) return no('not_started', 'Onboarding has not been started for this person yet. Press Start onboarding first.');
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  return { f, c };
}
/* a time HR picked: one the Hub can read, and still ahead */
function laterTime(v: unknown, what: string): { at: string } | Response {
  const at = instant(v);
  if (!at) return no('bad_time', 'Pick a time for the ' + what + ' first.', 400);
  if (Date.parse(at) <= Date.now()) return no('past_time', 'The ' + what + ' time has already passed. Pick a new time.', 400);
  return { at };
}
/* tell one manager through notify (onboard_date). null: they were told, or chose not to be. Otherwise a sentence for HR; the change itself still stands. */
async function tellManager(m: Row | null, title: string, body: string, tag: string): Promise<string | null> {
  if (!m) return 'The manager is not on the roster, so nobody was told. Tell them yourself.';
  if (!m.email) return m.name + ' has no email on the roster, so they were not told. Tell them yourself.';
  const r = await tell({
    event: 'onboard_date', to_email: String(m.email).toLowerCase(), url: '#hrcentre/onboarding', tag, title, body,
    text: slackEsc(body) + ' <' + HUB + '/#hrcentre/onboarding|Open Onboarding>',
  });
  return r.handled ? null : m.name + ' was not told: ' + (r.note.replace(/^[^:\s]+@[^:\s]+: /, '') || 'notify gave no answer') + '. Tell them yourself.';
}
const patchEvent = (t: string, id: string, body: unknown) => gcal(t, 'PATCH', eventsPath + '/' + encodeURIComponent(id) + '?sendUpdates=all', body);
const why = (out: { status: number; j: Row }) => String(out.j?.error?.message || out.status).slice(0, 160);

async function bookOneOnOne(b: Row, by: string, asUser: Row): Promise<Response> {
  const o = await openFlow(b);
  if (o instanceof Response) return o;
  const { f, c } = o;
  if (f.one_on_one_at) return no('already_booked', 'The 1-on-1 is already booked. Use Change time to move it.');
  const when = laterTime(b.at, '1-on-1');
  if (when instanceof Response) return when;
  const m = await getMember(f.manager_member_id);
  if (!m || m.active === false) return no('no_manager', 'The manager is no longer on the roster. Change the manager first.');
  if (!m.email) return no('no_manager_email', m.name + ' has no email on the roster, so the 1-on-1 cannot be sent. Add it, then try again.');
  let t = '';
  if (!f.practice) {
    try { t = await calToken(); } catch (e) { return no('google', errText(e), 502); }
  }
  const { data: won, error } = await svc.from('hub_onboard_flows').update({ one_on_one_at: when.at, updated_at: new Date().toISOString() }).eq('id', f.id).in('status', AFTER_START).is('one_on_one_at', null).select(FLOW_COLS);
  if (error) return no('save', 'The Hub could not book this: ' + error.message + '. Try again.', 500);
  const flow = (won as Row[] | null)?.[0];
  if (!flow) return no('already_booked', 'The 1-on-1 was just booked, or this onboarding just changed. Reload the page.');
  if (f.practice) return json({ ok: true, practice: true, one_on_one_at: when.at });
  const ctx = await makeCtx(flow, by, asUser);
  let invite: Invite;
  try {
    invite = await inviteList(ctx, c, 'one');
    await bookEvent(ctx, t, c, 'one', invite);
  } catch (e) {
    await svc.from('hub_onboard_flows').update({ one_on_one_at: null, updated_at: new Date().toISOString() }).eq('id', f.id).eq('one_on_one_at', when.at);
    return no('not_booked', errText(e).replace(/\s*Press Retry\.$/, '') + ' The 1-on-1 was not booked. Try again.', 502);
  }
  await svc.from('hub_onboard_steps').update({
    detail: 'The onboarding call is booked. The 1-on-1 was booked later' + (invite.live ? ', with an invite to ' : ', and email is in test mode, so the invite went only to ') + invite.to.join(', ') + '.',
    at: new Date().toISOString(), by,
  }).eq('flow_id', f.id).eq('step', 'invites').eq('status', 'done');
  await log('onboard_flow', f.id, 'one_on_one_at', null, when.at, by);
  return json({ ok: true, one_on_one_at: when.at, invited: invite.to, mode: invite.live ? 'live' : 'test' });
}

async function changeTime(b: Row, by: string, asUser: Row): Promise<Response> {
  const which = b.which === 'call' || b.which === 'one_on_one' ? (b.which as 'call' | 'one_on_one') : null;
  if (!which) return no('bad_which', 'Choose the onboarding call or the 1-on-1.', 400);
  const o = await openFlow(b);
  if (o instanceof Response) return o;
  const { f, c } = o;
  const kind: Kind = which === 'call' ? 'call' : 'one';
  const col = which === 'call' ? 'call_at' : 'one_on_one_at';
  const word = which === 'call' ? 'onboarding call' : '1-on-1';
  const old = f[col];
  if (!old) return no('not_booked', which === 'call' ? 'The onboarding call has no time yet. Press Start onboarding first.' : 'The 1-on-1 is not booked yet. Book it first.');
  const when = laterTime(b.at, word);
  if (when instanceof Response) return when;
  if (when.at === instant(old)) return no('same_time', 'That is already the time of the ' + word + '. Pick a different one.', 400);

  const eventId: string | null = f[COLUMN[kind]] || null;
  let t = '', attendees: Array<{ email: string }> = [];
  if (!f.practice && eventId) {   // who the invite goes to is worked out first: in mail test mode that is the test inboxes
    try {
      t = await calToken();
      attendees = (await inviteList(await makeCtx(f, by, asUser), c, kind)).to.map((email) => ({ email }));
    } catch (e) { return no('google', errText(e).replace(/\s*(Add it, then p|P)ress Retry\.$/, '') + ' The ' + word + ' was not changed.', 409); }
  }
  const { data: won, error } = await svc.from('hub_onboard_flows').update({ [col]: when.at, updated_at: new Date().toISOString() }).eq('id', f.id).in('status', AFTER_START).eq(col, old).select('id');
  if (error) return no('save', 'The Hub could not change this: ' + error.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) return no('changed', 'Someone has just changed this onboarding. Reload the page to see the new time.');
  if (f.practice) return json({ ok: true, practice: true, which, at: when.at, warnings: [] });

  const back = () => svc.from('hub_onboard_flows').update({ [col]: old, updated_at: new Date().toISOString() }).eq('id', f.id).eq(col, when.at);
  const movePlan = kind === 'call' && !!f.onboarding_id;
  if (movePlan) {   // before Google, so a plan that will not move leaves everything as it was
    const { error: moveError } = await svc.rpc('wa271_move_start', { p_onboarding: f.onboarding_id, p_new: torontoDate(when.at) });
    if (moveError) { await back(); return no('save', 'The plan dates could not move: ' + moveError.message + '. The onboarding call was not changed.', 500); }
  }
  const warnings: string[] = [];
  if (eventId) {
    const minutes = kind === 'call' ? await cfgNum('onboard_call_min', 60) : await cfgNum('onboard_one_on_one_min', 30);
    const out = await patchEvent(t, eventId, {
      start: { dateTime: new Date(when.at).toISOString(), timeZone: TZ }, end: { dateTime: new Date(Date.parse(when.at) + minutes * 60000).toISOString(), timeZone: TZ }, attendees,
    });
    if (!out.ok) {
      await back();
      if (movePlan) await svc.rpc('wa271_move_start', { p_onboarding: f.onboarding_id, p_new: torontoDate(old) });
      return no('google', 'Google refused to move the ' + word + ' invite: ' + why(out) + '. The ' + word + ' was not changed.', 502);
    }
  } else warnings.push('There is no ' + word + ' invite yet, so Google was not asked. The new time is used when the invites are sent.');
  await log('onboard_flow', f.id, col, old, when.at, by);

  const first = c.name + ' (' + (c.role || 'new hire') + ')';
  const told = await tellManager(
    await getMember(f.manager_member_id),
    which === 'call' ? c.name + ' now starts ' + torontoDate(when.at) : 'The 1-on-1 with ' + c.name + ' moved',
    which === 'call'
      ? first + ' now has their onboarding call on ' + whenText(when.at) + ' (it was ' + whenText(old) + '). That is their first day.'
      : 'Your 1-on-1 with ' + c.name + ' moved to ' + whenText(when.at) + ' (it was ' + whenText(old) + '). The invite is updated.',
    'onboard-move-' + f.id + '-' + kind + '-' + Date.now(),
  );
  if (told) warnings.push(told);
  return json({ ok: true, which, at: when.at, warnings });
}

async function changeManager(b: Row, by: string, asUser: Row): Promise<Response> {
  const o = await openFlow(b);
  if (o instanceof Response) return o;
  const { f, c } = o;
  const id = Number(b.member_id);
  const m = b.member_id != null && b.member_id !== '' && Number.isInteger(id) ? await getMember(id) : null;
  if (!m) return no('no_manager', 'Choose a manager who is on the roster first.', 400);
  if (String(m.id) === String(f.manager_member_id)) return no('same_manager', m.name + ' is already the manager.');
  if (m.active === false) return no('no_manager', m.name + ' is not active on the roster. Choose someone else.', 400);
  if (!m.email) return no('no_manager_email', m.name + ' has no email on the roster, so they cannot be told or invited. Add it, then try again.');
  const old = await getMember(f.manager_member_id);
  const { data: prev, error: readError } = await svc.from('hub_onboard_flows').select('manager_link_sent_at, manager_link_member_id, reminded_manager_at').eq('id', f.id).maybeSingle();
  if (readError || !prev) return no('save', 'The Hub could not read this flow: ' + (readError?.message || 'it is gone') + '. If wa271b_remind.sql is not applied yet, apply it first.', 500);

  const booked = !!f.one_on_one_at && !!f[COLUMN.one];
  let t = '', event: Row = {};
  if (!f.practice && booked) {
    try {
      t = await calToken();
      const invite = await inviteList(await makeCtx({ ...f, manager_member_id: m.id }, by, asUser), c, 'one');
      event = { summary: invite.prefix + oneSummary(c, m.name), attendees: invite.to.map((email) => ({ email })) };
    } catch (e) { return no('google', errText(e).replace(/\s*(Add it, then p|P)ress Retry\.$/, '') + ' The manager was not changed.', 409); }
  }
  /* the claim: of two presses, only one finds the old manager still in place. A new manager starts with no link sent and no reminder. */
  const claim = svc.from('hub_onboard_flows').update({ manager_member_id: m.id, manager_link_sent_at: null, manager_link_member_id: null, reminded_manager_at: null, updated_at: new Date().toISOString() }).eq('id', f.id).in('status', AFTER_START);
  const { data: won, error } = await (f.manager_member_id == null ? claim.is('manager_member_id', null) : claim.eq('manager_member_id', f.manager_member_id)).select('id');
  if (error) return no('save', 'The Hub could not change this: ' + error.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) return no('changed', 'Someone has just changed this onboarding. Reload the page.');
  if (f.practice) return json({ ok: true, practice: true, manager: { member_id: m.id, name: m.name }, warnings: [] });

  const warnings: string[] = [];
  if (booked) {
    const out = await patchEvent(t, f[COLUMN.one], event);
    if (!out.ok) {
      await svc.from('hub_onboard_flows').update({
        manager_member_id: f.manager_member_id ?? null, manager_link_sent_at: prev.manager_link_sent_at ?? null, manager_link_member_id: prev.manager_link_member_id ?? null,
        reminded_manager_at: prev.reminded_manager_at ?? null, updated_at: new Date().toISOString(),
      }).eq('id', f.id).eq('manager_member_id', m.id);
      return no('google', 'Google refused to move the 1-on-1 invite to ' + m.name + ': ' + why(out) + '. The manager was not changed.', 502);
    }
  } else if (!f.one_on_one_at) {   // the old manager's marks are not the new manager's: they start with a clean grid
    const { error: gridError } = await svc.from('hub_onboard_grids').update({ slots: [], updated_at: new Date().toISOString() }).eq('flow_id', f.id).eq('who', 'manager');
    if (gridError) warnings.push('The old manager\'s marks on the availability grid could not be cleared: ' + gridError.message + '. They may still show.');
  }
  await log('onboard_flow', f.id, 'manager_member_id', f.manager_member_id, m.id, by);

  const first = c.name + ' (' + (c.role || 'new hire') + ')';
  const stamp = f.id + '-' + Date.now();
  const toNew = await tellManager(
    m, 'You are ' + c.name + '\'s manager',
    first + ' starts ' + torontoDate(f.call_at) + ', with an onboarding call on ' + whenText(f.call_at) + '. You are now their manager.'
      + (f.one_on_one_at ? ' Your 1-on-1 is ' + whenText(f.one_on_one_at) + '. The invite is in your calendar.' : ' You will get a link to mark when you are free for the 1-on-1.'),
    'onboard-manager-new-' + stamp,
  );
  if (toNew) warnings.push(toNew);
  else await svc.from('hub_onboard_steps').update({ detail: 'Told ' + m.name + ' the date and time, after the manager changed' + (old ? ' from ' + old.name : '') + '.', at: new Date().toISOString(), by }).eq('flow_id', f.id).eq('step', 'manager').eq('status', 'done');
  if (old) {
    const toOld = await tellManager(
      old, c.name + ' has a different manager',
      first + ' now has ' + m.name + ' as their manager for onboarding.' + (f.one_on_one_at ? ' Your 1-on-1 with them is cancelled.' : ''),
      'onboard-manager-old-' + stamp,
    );
    if (toOld) warnings.push(toOld);
  }
  return json({ ok: true, manager: { member_id: m.id, name: m.name }, warnings });
}

async function backedOut(b: Row, by: string, asUser: Row): Promise<Response> {
  const o = await openFlow(b);
  if (o instanceof Response) return o;
  const { f, c } = o;
  const said = String(b.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const closeReason = 'Backed out after accepting' + (said ? ': ' + said : '');
  const events = (['call', 'one'] as Kind[]).filter((k) => f[COLUMN[k]]);
  let t = '';
  if (!f.practice && events.length) {
    try { t = await calToken(); } catch (e) { return no('google', errText(e) + ' The onboarding is still open.', 502); }
  }
  /* the claim: of two presses, only one finds the flow still running or started */
  const now = new Date().toISOString();
  const { data: won, error } = await svc.from('hub_onboard_flows').update({ status: 'backed_out', updated_at: now }).eq('id', f.id).in('status', AFTER_START).select('id');
  if (error) return no('save', 'The Hub could not record this: ' + error.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) return no('changed', 'Someone has just changed this onboarding. Reload the page.');
  if (f.practice) return json({ ok: true, practice: true, remove: [], warnings: [] });

  /* cancelled, not deleted: the guests are told, and a later try cannot quietly bring the event back. An invite already gone is as good as cancelled. */
  const refused: string[] = [];
  for (const kind of events) {
    const out = await patchEvent(t, f[COLUMN[kind]], { status: 'cancelled' });
    if (!out.ok && out.status !== 404 && out.status !== 410) refused.push('Google refused to cancel the ' + (kind === 'call' ? 'onboarding call' : '1-on-1') + ' invite: ' + why(out) + '.');
  }
  if (refused.length) {
    await svc.from('hub_onboard_flows').update({ status: f.status, updated_at: new Date().toISOString() }).eq('id', f.id).eq('status', 'backed_out');
    return no('google', refused.join(' ') + ' The onboarding is still open. Try again, or cancel the invites in Calendar by hand.', 502);
  }

  const warnings: string[] = [];
  if (f.onboarding_id) {   // closed as the Hub closes a plan: status completed and completed_at
    const { error: planError } = await svc.from('onboardings').update({ status: 'completed', completed_at: now }).eq('id', f.onboarding_id).is('completed_at', null);
    if (planError) warnings.push('The onboarding plan could not be closed: ' + planError.message + '. Close it by hand in Onboarding.');
  }
  const { error: cardError } = await svc.from('hub_candidates').update({ status: 'withdrawn', close_reason: closeReason, stage_at: now, updated_at: now, updated_by: by }).eq('id', c.id).not('status', 'in', '(withdrawn,declined)');
  if (cardError) warnings.push('The card could not be moved to Withdrawn: ' + cardError.message + '. Move it by hand.');
  else await log('candidate', c.id, 'status', c.status, 'withdrawn (backed out after Start onboarding)', by);

  /* nothing is taken out of Google, Slack or the Hub here: HR does that, and this names only what this flow made */
  const status = new Map((await readSteps(f.id)).map((r) => [r.step, r.status]));
  const remove: string[] = [];
  if (status.get('google') === 'done' && f.wa_email) remove.push('Google account ' + f.wa_email + ': suspend or delete it in Google Admin.');
  if (f.slack_channel_id) remove.push('Slack onboarding channel ' + f.slack_channel_id + ': archive it.');
  if (status.get('hub') === 'done') remove.push('Hub access' + (f.wa_email ? ' for ' + f.wa_email : '') + ': remove it from Roster.');
  return json({ ok: true, remove, warnings });
}

/* ---------- send_grid_link ---------- */
/* onboard-link's offer token: <candidate id>.<20 characters of HMAC-SHA256>, key 'onboard-offer:' + the service key */
async function signedToken(purpose: 'offer' | 'mgr', id: number): Promise<string> {   // mgr: id = the flow, the manager's grid link
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('onboard-' + purpose + ':' + SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(id))));
  return id + '.' + b64url(sig).slice(0, 20);
}
const offerToken = (id: number) => signedToken('offer', id);
function gridMail(first: string, link: string, fr: boolean): { subject: string; text: string; html: string } {
  const c = fr
    ? { subject: 'Vos disponibilités pour votre accueil à Welfare Avenue', hi: 'Bonjour ' + first + ',', body: 'Merci de nous indiquer quand vous êtes disponible pour votre appel d\'accueil et votre rencontre avec votre gestionnaire. Cela prend une minute.', button: 'Indiquer mes disponibilités', end: 'Au plaisir,' }
    : { subject: 'Your availability for onboarding at Welfare Avenue', hi: 'Hi ' + first + ',', body: 'Please mark when you are free for your onboarding call and your meeting with your manager. It takes a minute.', button: 'Mark my availability', end: 'Warmly,' };
  return {
    subject: c.subject,
    text: c.hi + '\n\n' + c.body + '\n\n' + c.button + ': ' + link + '\n\n' + c.end + '\nWelfare Avenue',
    html: '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#FFFAF2;font-family:Helvetica,Arial,sans-serif;color:#1F201E;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid rgba(16,63,57,.10);padding:28px 32px;font-size:15px;line-height:1.55;">' +
      '<p style="margin:0 0 14px;">' + esc(c.hi) + '</p><p style="margin:0 0 22px;">' + esc(c.body) + '</p>' +
      '<p style="margin:0 0 22px;"><a href="' + esc(link) + '" style="display:inline-block;background:#103F39;color:#FFFAF2;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;">' + esc(c.button) + '</a></p>' +
      '<p style="margin:0;font-size:13px;color:#5c6b66;word-break:break-all;">' + esc(link) + '</p><p style="margin:18px 0 0;">' + esc(c.end) + '<br>Welfare Avenue</p></div></body></html>',
  };
}
async function sendGridLink(b: Row, by: string): Promise<Response> {
  const c = await getCand(b.candidate_id);
  if (!c) return no('not_found', 'That candidate card is gone. Reload the page.', 404);
  if (['declined', 'withdrawn'].includes(c.status)) return no('closed', 'This card is closed, so no link can go out.');
  if (!c.offer_sent_at && !c.accepted_on) return no('no_offer', 'No offer has gone out for this person yet. Send the offer first.');
  const to = String(c.email || '').trim().toLowerCase();
  if (!to) return no('no_email', 'The card has no personal email. Add it, then try again.');
  if (b.accepted === true && !c.accepted_on) {   // HR says they said yes; the trigger wa271_cand_accepted makes the flow
    const today = torontoDate(Date.now()), now = new Date().toISOString();
    const { data: won, error } = await svc.from('hub_candidates').update({ accepted_on: today, updated_at: now, updated_by: by }).eq('id', c.id).is('accepted_on', null).select('id');
    if (error) return no('save', 'The acceptance could not be saved: ' + error.message + '. Try again.', 500);
    if ((won as unknown[] | null)?.length) await log('candidate', c.id, 'accepted_on', null, today, by);
  }
  if (c.practice) return json({ ok: true, practice: true });
  const m = gridMail(firstName(c.name), HUB + '/o/' + await offerToken(c.id), langOf(c) === 'fr');
  try {
    const sent = await deliver({ practice: false, to, ...m, replyTo: by });
    return json({ ok: true, mode: sent.mode, to: sent.to });
  } catch (e) {
    return no('not_sent', errText(e), 502);
  }
}

/* ---------- remind: the hourly job ---------- */
const REMIND_COLS = FLOW_COLS + ', created_at, reminded_hire_at, reminded_manager_at, manager_link_sent_at, manager_link_member_id';
const LIVE_FLOW = ['waiting', 'ready', 'running', 'started'];       // a flow that backed out is left alone
const OPEN_CARD = ['new', 'reviewing', 'interview', 'offer', 'hired'];   // as onboard-link: a card in any other stage is closed
const slackEsc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* one call to notify, as the Hub itself. Handled: at least one person was reached or chose not to be told. Not handled: notify failed, or nobody was reached;
   the caller gives its claim back so the next hourly run tries again. note says why, or who of several was missed. */
async function tell(body: Record<string, unknown>): Promise<{ handled: boolean; note: string }> {
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': await getSecret('WA_TRIGGER_SECRET'), Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { handled: false, note: 'notify said ' + String(j?.error || res.status).slice(0, 160) };
    const to = (Array.isArray(body.to) ? body.to : [body.to_email]).map((x) => String(x || '').toLowerCase());
    const all = to.map((e) => ({ e, ...verdict(j, e) }));
    const missed = all.filter((x) => x.kind === 'lost').map((x) => x.e + ': ' + x.why).join('; ');
    return { handled: all.some((x) => x.kind !== 'lost'), note: missed };
  } catch (e) { return { handled: false, note: errText(e) }; }
}
const marked = (grids: Row[], who: string) => grids.some((g) => g.who === who && Array.isArray(g.slots) && g.slots.length > 0);

async function remind(): Promise<Response> {
  const out = { ok: true, grid_links: 0, reminded_hr: 0, reminded_managers: 0, skipped: [] as string[] };
  const hours = await cfgNum('onboard_remind_hours', 48);
  const waited = (since: unknown) => !!since && Date.now() - Date.parse(String(since)) >= hours * 3600000;
  const hr = (await cfg('hr_notify_emails')).split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x));
  const { data, error: listErr } = await svc.from('hub_onboard_flows').select(REMIND_COLS).in('status', LIVE_FLOW).eq('practice', false);
  if (listErr) return json({ ok: false, error: 'remind_failed', message: 'The flows could not be read, so nothing was reminded: ' + listErr.message + '. If wa271b_remind.sql is not applied yet, apply it first.' }, 500);   // a broken deploy order must show in cron, not pass as an empty hour
  for (const f of (data || []) as Row[]) {
    try {
      const c = await getCand(f.candidate_id);
      if (!c || c.practice || !OPEN_CARD.includes(c.status)) continue;
      const { data: g } = await svc.from('hub_onboard_grids').select('who, slots').eq('flow_id', f.id);
      const grids = (g || []) as Row[];
      const hireBooked = !!f.call_at && !!f.one_on_one_at;

      /* HR: the hire has not marked their grid. The claim comes first, so two runs at once send one message. */
      if (!hireBooked && !f.reminded_hire_at && waited(f.created_at) && !marked(grids, 'hire')) {
        if (!hr.length) out.skipped.push('flow ' + f.id + ': no hr_notify_emails');
        else {
          const { data: won } = await svc.from('hub_onboard_flows').update({ reminded_hire_at: new Date().toISOString() }).eq('id', f.id).is('reminded_hire_at', null).select('id');
          if ((won as unknown[] | null)?.length) {
            const bit = 'has not marked their availability yet (they accepted on ' + String(c.accepted_on || f.created_at).slice(0, 10) + ')';
            const failed = await tell({
              event: 'onboard_remind', to: hr, url: '#hrcentre/onboarding', tag: 'onboard-remind-hire-' + f.id,
              title: c.name + ' has not marked their availability',
              body: c.name + ' (' + (c.role || 'new hire') + ') ' + bit + '. Open Onboarding to send the link again or pick a time.',
              text: ':hourglass_flowing_sand: *' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + ') ' + bit + '. <' + HUB + '/#hrcentre/onboarding|Open Onboarding> to send the link again or pick a time.',
            });
            if (!failed.handled) { await svc.from('hub_onboard_flows').update({ reminded_hire_at: null }).eq('id', f.id); out.skipped.push('flow ' + f.id + ': HR reminder not delivered, will try again (' + failed.note + ')'); }
            else { out.reminded_hr++; if (failed.note) out.skipped.push('flow ' + f.id + ': HR reminder did not reach ' + failed.note); }
          }
        }
      }

      /* the manager: who they are (HR confirmed, else the one the Hub can tell), then their link once, then one reminder */
      if (f.one_on_one_at) continue;   // the 1-on-1 is booked, so their grid is shut
      let managerId = f.manager_member_id;
      if (!managerId) {
        const { data: dm } = await svc.rpc('wa271_default_manager', { p_candidate: c.id });
        managerId = (dm as Row | null)?.member_id ?? null;
      }
      const m = managerId ? await getMember(managerId) : null;
      if (!m || m.active === false) continue;
      if (!m.email) { out.skipped.push('flow ' + f.id + ': ' + m.name + ' has no email on the roster'); continue; }
      const path = '/o/' + await signedToken('mgr', f.id), link = HUB + path;
      if (!f.manager_link_sent_at || String(f.manager_link_member_id) !== String(m.id)) {
        const prev = { manager_link_sent_at: f.manager_link_sent_at ?? null, manager_link_member_id: f.manager_link_member_id ?? null, reminded_manager_at: f.reminded_manager_at ?? null };
        const claim = svc.from('hub_onboard_flows').update({ manager_link_sent_at: new Date().toISOString(), manager_link_member_id: m.id, reminded_manager_at: null }).eq('id', f.id);
        const guarded = !f.manager_link_sent_at ? claim.is('manager_link_sent_at', null) : f.manager_link_member_id == null ? claim.is('manager_link_member_id', null) : claim.eq('manager_link_member_id', f.manager_link_member_id);   // null: the manager's row was deleted
        const { data: won } = await guarded.select('id');
        if (!(won as unknown[] | null)?.length) continue;
        const failed = await tell({
          event: 'onboard_grid', to_email: String(m.email).toLowerCase(), url: path, tag: 'onboard-grid-' + f.id,
          title: 'Mark your availability for ' + c.name,
          body: c.name + ' (' + (c.role || 'new hire') + ') is joining. Please mark when you are free for your 1-on-1 with them. It takes a minute.',
          text: ':calendar: *' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + ') is joining. Please mark when you are free for your 1-on-1 with them. It takes a minute. <' + link + '|Mark my availability>',
        });
        if (!failed.handled) { await svc.from('hub_onboard_flows').update(prev).eq('id', f.id); out.skipped.push('flow ' + f.id + ': grid link not delivered, will try again (' + failed.note + ')'); }
        else out.grid_links++;
        continue;
      }
      if (!f.reminded_manager_at && waited(f.manager_link_sent_at) && !marked(grids, 'manager')) {
        const { data: won } = await svc.from('hub_onboard_flows').update({ reminded_manager_at: new Date().toISOString() }).eq('id', f.id).is('reminded_manager_at', null).select('id');
        if (!(won as unknown[] | null)?.length) continue;
        const failed = await tell({
          event: 'onboard_remind', to_email: String(m.email).toLowerCase(), url: path, tag: 'onboard-remind-manager-' + f.id,
          title: 'Your availability for ' + c.name + ' is still empty',
          body: 'You have not marked when you are free for your 1-on-1 with ' + c.name + ' yet. It takes a minute.',
          text: ':hourglass_flowing_sand: You have not marked when you are free for your 1-on-1 with *' + slackEsc(c.name) + '* yet. It takes a minute. <' + link + '|Mark my availability>',
        });
        if (!failed.handled) { await svc.from('hub_onboard_flows').update({ reminded_manager_at: null }).eq('id', f.id); out.skipped.push('flow ' + f.id + ': manager reminder not delivered, will try again (' + failed.note + ')'); }
        else out.reminded_managers++;
      }
    } catch (e) {
      out.skipped.push('flow ' + f.id + ': ' + errText(e));
    }
  }
  return json(out);
}

function sameText(a: string, b: string): boolean {   // the trigger secret is compared without stopping at the first difference
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return no('method', 'This function only takes POST.', 405);
  try {
    /* the Hub itself (cron, through call_edge): the trigger secret opens remind and nothing else. For any other action, or a wrong secret, it is as if
       the header were not there: the sign-in check below decides. */
    const given = req.headers.get('x-wa-secret');
    if (given) {
      let system = false;
      try { system = sameText(given, await getSecret('WA_TRIGGER_SECRET')); } catch (_) { /* fall through */ }
      if (system && (await req.clone().json().catch(() => ({}))).action === 'remind') return await remind();
    }
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return no('signed_out', 'Please sign in again.', 401);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: who } = await asUser.auth.getUser();
    const by = String(who?.user?.email || '').toLowerCase();
    if (!by) return no('signed_out', 'Please sign in again.', 401);
    const [hr, admin] = await Promise.all([asUser.rpc('wa_is_hr'), asUser.rpc('is_wa_admin')]);
    if (hr.data !== true && admin.data !== true) return no('not_allowed', 'Only HR and admins can do this.', 403);
    const b = await req.json().catch(() => ({}));
    if (b.action === 'preview') return await preview(b);
    if (b.action === 'start') return await start(b, by, asUser);
    if (b.action === 'retry') return await retry(b, by, asUser);
    if (b.action === 'google_manual') return await googleManual(b, by, asUser);
    if (b.action === 'send_grid_link') return await sendGridLink(b, by);
    if (b.action === 'book_one_on_one') return await bookOneOnOne(b, by, asUser);
    if (b.action === 'change_time') return await changeTime(b, by, asUser);
    if (b.action === 'change_manager') return await changeManager(b, by, asUser);
    if (b.action === 'backed_out') return await backedOut(b, by, asUser);
    if (b.action === 'remind') return no('not_allowed', 'remind is the Hub\'s own hourly job.', 403);
    return no('unknown_action', 'The Hub does not know that action. Reload the page.', 400);
  } catch (e) {
    return no('failed', errText(e), 500);
  }
});
