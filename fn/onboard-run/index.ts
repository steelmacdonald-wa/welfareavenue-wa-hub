// Welfare Avenue: onboard-run (v1, 01/11/26, wave271; v2, 02/11/26, wave275 Task 2: propose and hire_times; v3, 02/11/26, wave275 Task 3: accept_setup, book, the Google account and Hub access steps;
// v4, 02/11/26, wave275 Task 4: the welcome email is sent, and the first password is set from the card; v5, 02/11/26, wave275 Task 5: ask_manager, and remind on the propose path)
// The signed-in function behind HR's Start onboarding button. All actions are POST {action, ...}, for HR or admins only
// (wa_is_hr or is_wa_admin, run as the caller's JWT):
//   preview {flow_id, wa_email?}   {address, address_taken, address_owner, address_own, needs_address, manager, department, grids, hub_events, steps, welcome, warnings}. Writes nothing.
//   set_manager {flow_id, member_id}   {ok, cleared}. Before Start: HR confirms the manager, and the hourly job sends them the link. A manager other than the one who got the link
//               starts with a clean grid and no reminder sent (cleared: true). A practice flow writes its flow row only.
//   start {flow_id, wa_email, manager_member_id, call_at, one_on_one_at?, group_session?, skip[], welcome?}   {steps}. A closed card is refused. With the Google step skipped, an
//               address on someone else's roster profile is refused, and one only Workspace knows is not stored: nothing may attach this person to another mailbox.
//   retry {flow_id, step}          {steps}. Reruns that step and what was waiting on it. A done step is refused.
//   google_manual {flow_id, wa_email}   {steps}. HR made the account by hand: records the address and finishes what waited on it.
//   welcome {flow_id}              {subject, text, edited, sent_at}. The welcome email as it reads now (HR's edits kept, the marked places filled in after Start or
//               booking, [first password] kept as it is). Reads only.
//   task_done {flow_id, step}      {steps}. HR did a step left to them. Not for google, which has google_manual.
//   set_canva_link {flow_id, link}   {ok, canva_link}. The fresh Canva invite link HR pastes for this hire (Canva's links last 30 days, so none is kept in settings). Empty clears it;
//               otherwise it must start with https://www.canva.com/. Any flow that has not backed out; it writes the flow row only. start takes canva_link with the same check.
//   book_one_on_one {flow_id, at}   {ok, one_on_one_at, invited}. Books the 1-on-1 after Start and sends the invite then. Refused if it is already booked.
//   change_time {flow_id, which: 'call'|'one_on_one', at}   {ok, warnings}. Moves the same Calendar event (Google tells the guests), re-notifies the manager
//               (notify event onboard_date) and, for the call, moves the plan's dates (wa271_move_start). A time that has passed is refused.
//   change_manager {flow_id, member_id}   {ok, warnings}. Moves the 1-on-1 invite to the new manager, tells both (onboard_date), and resets manager_link_* and
//               reminded_manager_at so the new manager gets a grid link if the 1-on-1 is not booked.
//   backed_out {flow_id, reason}   {ok, remove, warnings}. Cancels both events (status cancelled, guests told), closes the plan (status completed, completed_at,
//               as the Hub does), sets the flow backed_out and the card withdrawn. It removes nothing from Google, Slack or the Hub: remove lists, as plain
//               sentences, what HR takes out by hand, naming only what this flow made. It also closes a waiting or ready flow, which has no events yet.
//               The other three need a flow that is running or started; waiting, ready and backed_out are refused. A practice flow changes its own row only.
//   send_grid_link {candidate_id, accepted?}   {ok}. For offers already out: mails the /o/ link; accepted: true sets accepted_on if it is empty.
//   remind {}   {ok, grid_links, reminded_hr, reminded_managers, skipped}. The Hub's hourly job (cron wa-onboard-remind, wa271_remind()), and one of the three actions (with propose and hire_times) the
//               trigger secret (x-wa-secret) may run here; a signed-in person cannot. Tells each manager their availability-grid link (event onboard_grid) once,
//               then reminds HR (hr_notify_emails) about a hire's empty grid and the manager about theirs (event onboard_remind), each once, after
//               onboard_remind_hours. Everything goes through notify to staff; nothing is ever sent to the new hire. Practice flows, closed cards and anyone
//               with an open plan other than this flow's own (the roster dropdown) are left alone.
//   wave275 (v2):
//   propose {flow_id, call_at, one_on_one_at, by?}   {ok, repeated, proposal: {call_at, one_on_one_at, by, at}, hire_emailed, warnings[], practice?}. The manager's two times
//               for the hire, the rules kept here once: both at least onboard_propose_lead_hours (48) ahead; each whole meeting (onboard_call_min, onboard_one_on_one_min)
//               inside one block of the manager's availability for that Toronto weekday (read only through wa275_availability_of with the service key: amended
//               02/11/26, the week is wave276's typical week saved on Home, Monday to Friday 9 to 5 while none is saved; an except entry for the date, from the
//               roster row, replaces the weekday; a read that fails refuses with 503 and saves nothing); clear of hub@ meetings the manager is invited to (hub_events, not cancelled); clear of the booked and proposed times of the manager's
//               other flows (backed out flows and closed cards left out); the two not overlapping each other. Refusals {error, message (English), messages {en, fr},
//               which?}: bad_time (also a time with no zone, Z or +hh:mm), lead_time, overlap, outside_hours, busy, taken, already_booked (the hire said yes, or
//               call_at is set), closed, no_manager, manager_inactive, manager_no_email (the hub@ check needs their roster email), changed. A proposal another
//               flow's hire has answered (hire_answer set) no longer counts as taken.
//               Opened by HR, an admin or the flow's manager (wa275_manager_of, by = the caller's email), and by the trigger secret, which is the mgr link
//               (onboard-link relays with by 'manager': by = the manager's roster email). The claim is a conditional update on proposed_at as it was read, so a
//               double press saves and tells once; the same times by the same person again are {repeated: true}. Saved: HR (hr_notify_emails) is told through
//               notify (event onboard_answer, "<proposer> proposed times for <hire>"), setup_ticks.hire_times_at and no_again_at are cleared (wa275_tick_set), hire_answer is cleared, and hire_times
//               runs after the claim whatever the card said when it was read (not yet accepted is a quiet no). Practice: saved, no fetch.
//   hire_times {flow_id}   {ok, mode, to} | {ok, skipped: 'already_sent'} | {ok, practice: true}. The trigger secret only. Emails the hire the /o/ offer link that asks
//               yes or no about the proposed times (Task 3 writes the email's words), once per proposal: the send is claimed with wa275_tick_set(flow,
//               'hire_times_at', now, p_if_unset), so two calls at once send once, and the claim is given back if Gmail refuses. Refused: no_proposal,
//               not_accepted, closed, no_email; not_sent (502) when Gmail or the mail mode refuses; tick_failed (500) when the claim cannot be written.
//   wave275 (v3), both for the trigger secret only (a signed-in person gets 403):
//   accept_setup {flow_id}   {ok, steps, warnings} | {ok, skipped: 'wave271' | 'already'}. onboard-link calls it once the hire's Accept is saved, and does not wait for
//               it. Times proposed before Accept are emailed to the hire (hire_times). Then, only for a flow created on or after app_config onboard_v2_since (unset:
//               no flow qualifies, so James MacDonald's wave271 card keeps its path), the steps timed 'accept' run: roster (the profile active, with no start date
//               and start_source manual; the card stays at offer), google, hub. Claimed with wa275_tick_set(flow, 'accept_setup_at'), so two calls run them once.
//               accounts_at is set once all three are done or skipped.
//   book {flow_id, call_at, one_on_one_at, by: 'hire'}   {ok, booked: true, repeated, call_at, one_on_one_at, status}. The hire's Yes (onboard-link relays it). The two
//               times must be the proposal. Both are checked again: at least onboard_yes_lead_hours (24) ahead, inside the manager's availability, clear of hub@
//               meetings they are invited to and of their other new hires' times. A time that has moved is stale (409 {error: 'stale', which, reason,
//               messages, ask_availability}): hire_answer becomes no (the proposal is spent; hire_answered_at stays empty, so the hire's own one No is still
//               theirs) and the manager and HR are told (onboard_answer); nothing is booked. Otherwise the flow is claimed (waiting or ready to running,
//               hire_answer yes, the manager as started_by, so both invites go to them), the rows not yet made are seeded, and the answer goes back at once:
//               the steps run after it (EdgeRuntime.waitUntil; a local run waits), and every step that can run does: plan (fills team_members.start_date and hub_candidates.start_date from the call and moves the card
//               to Hired, then makes the plan), invites, manager, welcome (v4) and the rest. HR is told (onboard_answer). The flow is
//               started once nothing is left for HR. Refused: changed, no_proposal, answered (the hire said no), not_accepted, closed, already_booked.
//   The step google (setting onboard_auto_google): users.insert as steel.macdonald@welfareavenue.com into the root unit, first.last from the name when
//               the flow has no address (a roster clash stops here), with the vault secret ONBOARD_FIRST_PASSWORD read at that moment and nowhere else
//               (unset or under 8 characters: an HR task, "The first password is not set in admin settings") and changePasswordAtNextLogin; read back
//               before done. Google refusing (409 already exists, licences) is an HR task with Google's reason, the password scrubbed out. The step hub
//               (also off with onboard_auto_hub): hub-invite through its trigger-secret path, at member level. A run may end a step as an HR task with
//               its own sentence (HrTask). retry, google_manual and task_done also work on a flow that has not been started once it has that step's row.
//   wave275 (v4):
//   The step welcome (no switch; needs invites only): sendWelcome sends the saved template (HR's edits kept), filled in as it goes, from hub@ to the personal
//               address through Gmail (mail_mode test: the test inboxes, the real address named), Reply-To the person who started it when that is a WA address.
//               It has both times (Toronto), both Meet links (hub_events, else Calendar), the login paragraph and the setup rundown (its page, /o/<offer
//               token>?setup, for a wave275 hire; no Meet part when the invites step was skipped). The first password is read from the vault
//               (ONBOARD_FIRST_PASSWORD) only then, only when the Hub's own google step made the account (setup_ticks.google_made_at) and the password has
//               not been changed since (onboard_first_password_at), and put into that outgoing message alone. Otherwise (no account yet, one HR made by hand,
//               the password changed or unset) the login lines say HR will send the login details separately, and the detail says why. welcome_sent_at
//               claims the send (a second run says already sent) and is given back when Gmail refuses.
//   set_first_password {password}   {ok, set, set_at, warnings?}. Admins only (is_wa_admin; HR are refused). 8 to 100 printable ASCII characters, a letter
//               and a digit, no space at either end, else 400 bad_password in a plain sentence. Stored with wa_vault_set (service role); change_log says "set" with no value;
//               app_config onboard_first_password_at keeps when.
//   first_password_state {}   {set, set_at}. Admins only. From onboard_first_password_at; the vault is never read here.
//   wave275 (v5):
//   ask_manager {flow_id}   {ok, sent, to, manager, warnings[]} | {ok, practice: true} | {ok, skipped, reason}. The trigger secret (recruit-actions, once the
//               offer has gone out) or HR and admins signed in (the card sends it again). The flow's manager (manager_member_id, else the position's as
//               wa271_default_manager tells it) gets their mgr link, onboard-link's propose page, by a Slack DM through notify (event onboard_propose,
//               tag onboard-propose-<flow>) and an email from hub@ (deliver: mail_mode test goes to the test inboxes). The send is claimed first on
//               manager_link_sent_at, and sets manager_link_member_id (the link holder onboard-link checks) and clears reminded_manager_at; either the DM
//               or the email reaching them is enough (the other is a warning), neither gives the claim back (502 not_sent) and the hourly job tries again.
//               The secret sends once per manager (already_sent); a signed-in HR person sends it again. Quiet no-ops with a reason: closed (the card
//               declined or withdrawn, or the flow backed out), not_open (not offered or waiting, or the call booked), proposed (times proposed and not
//               yet answered: propose tells the manager itself), wave271 (a flow on the grid path). Refused: no_manager, manager_inactive,
//               manager_no_email (409), not_found (404). A practice flow records the link holder and fetches nothing.
//   remind, for a flow on the propose path (offered or a proposal, or created on or after onboard_v2_since, as onboard-link decides): offered or
//               waiting with nothing proposed and the call not booked: the propose link goes once when it never went or went to a manager since
//               replaced (propose_links); onboard_remind_hours after it, the manager is reminded once (onboard_remind, onboard-remind-propose-<flow>,
//               claimed on reminded_manager_at) and HR is told once (onboard_remind to hr_notify_emails, onboard-remind-propose-hr-<flow>, claimed with
//               wa275_tick_set(flow, 'propose_hr_reminded_at')); neither once times were proposed (after the hire's no the manager answers from
//               the card). With no active manager with an email, HR is told once (onboard_remind, onboard-no-manager-<flow>, setup_ticks
//               no_manager_told_at) that the card needs one. None of the wave271 grid messages go to such a flow. wave271 flows keep their path.
// Exports: STEPS, suggestAddress(name), nextSteps(steps), renderWelcome(flow, candidate, facts), SETUP_STEPS (the rundown, onboard-link's SETUP word for word).
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
const SCOPE_USER = 'https://www.googleapis.com/auth/admin.directory.user';   // wave275: users.insert and its read-back
const USERS_URL = 'https://admin.googleapis.com/admin/directory/v1/users';
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
  at?: 'accept' | 'booking';                         // wave275: when the step's row is made (accept_setup, or book); Start makes every row still missing
  setting?: string;                                  // the app_config switch that must be on for run to be used
  ticks?: string[];                                  // hr_setup_template ids this step finishes
  task?: string;                                     // what HR does when this step is left to them
  run?: (ctx: Ctx) => Promise<string>;               // returns the detail sentence; throw to fail with that sentence
  after?: (ctx: Ctx) => Promise<void>;               // runs once the step is done, however it got done
};

/* ---------- the step table ---------- */
/* wave275: in the plan's order. At Accept: roster, google, hub; at booking: plan, invites, manager, slack (still an HR task) and welcome. invites and
   manager keep needing roster only, as in wave271, so a plan that fails never holds the invites back. */
const GOOGLE_TASK = 'Create the account in Google, then press "I created it, continue" on this card.';
const HUB_TASK = 'Invite them to the Hub at member level, from Roster.';
export const STEPS: Step[] = [
  { key: 'roster', label: 'Roster profile', needs: [], at: 'accept', run: runRoster },
  { key: 'google', label: 'Google account', needs: ['roster'], at: 'accept', setting: 'onboard_auto_google', ticks: ['hrb2'], run: runGoogle, after: addAddressToInvites, task: GOOGLE_TASK },
  { key: 'hub', label: 'Hub access', needs: ['google'], at: 'accept', setting: 'onboard_auto_google', run: runHub, task: HUB_TASK },   // also off with onboard_auto_hub (inside runHub)
  { key: 'plan', label: 'Onboarding plan', needs: ['roster'], at: 'booking', ticks: ['hrb6'], run: runPlan },
  { key: 'invites', label: 'Calendar invites', needs: ['roster'], at: 'booking', run: runInvites },
  { key: 'manager', label: 'Tell the manager', needs: ['roster'], at: 'booking', run: runManager },
  { key: 'slack', label: 'Slack channel', needs: ['roster'], at: 'booking', setting: 'onboard_auto_slack', ticks: ['hrb4', 'hrb5'],
    task: 'Create their onboarding channel in Slack, add the manager and HR, and post the welcome message.' },   // Build 3 adds run
  /* wave275 Task 4: the welcome needs the invites (their Meet links) and nothing else, and has no switch: it goes at booking whether or not the account
     exists (settled rule 2), and its login paragraph says which */
  { key: 'welcome', label: 'Welcome email', needs: ['invites'], at: 'booking', ticks: ['hrb1'], run: sendWelcome,
    task: 'Send the welcome email to their personal address.' },
];
/* a run that finds the step is HR's to do ends it as hr_task with this sentence, not as failed */
class HrTask extends Error {}
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
const FLOW_COLS = 'id, candidate_id, practice, status, manager_member_id, wa_email, call_at, one_on_one_at, group_session, call_event_id, one_on_one_event_id, onboarding_id, slack_channel_id, welcome_subject, welcome_text, started_by, started_at, roster_created, canva_link, welcome_edited, welcome_sent_at';
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
const ROSTER_CHECK = 'The Hub could not check the roster. Try again.';
async function membersByEmail(email: unknown): Promise<Row[]> {   // ilike for the case; _ is a wildcard there, so the exact match is made here
  const e = String(email || '').trim().toLowerCase();
  if (!e) return [];
  const { data, error } = await svc.from('team_members').select('id, name, email, active').ilike('email', e);
  if (error) throw new Error(ROSTER_CHECK);   // a roster that cannot be read is never taken as "nobody has this address"
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
  for (const k of ['onboard_auto_google', 'onboard_auto_slack', 'onboard_auto_hub']) settings[k] = (await cfg(k)).trim().toLowerCase() === 'on';
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
  if (ctx.flow.status === 'backed_out') return setStep(ctx, s.key, 'skipped', 'Not run: this person backed out while the steps were running.');
  if (ctx.flow.practice) return setStep(ctx, s.key, 'done', 'Practice: nothing real was changed by this step (' + s.label + ').');
  const status = new Map((await readSteps(ctx.flow.id)).map((r) => [r.step, r.status]));
  if (!s.run || heldBack(s, ctx.settings, status)) return setStep(ctx, s.key, 'hr_task', s.task || 'This step is left to HR.');
  let detail: string;
  try {
    detail = await s.run(ctx);
  } catch (e) {
    return setStep(ctx, s.key, e instanceof HrTask ? 'hr_task' : 'failed', errText(e));
  }
  await completed(ctx, s, detail);
}
/* runs everything that can run, in table order, then says why the rest cannot. A step only moves here from pending or waiting, and only a step
   that has its row: wave275 makes the rows at Accept and at booking, so the steps of the other group wait for theirs. */
async function advance(ctx: Ctx): Promise<void> {
  const tried = new Set<string>();
  for (;;) {
    const rows = await readSteps(ctx.flow.id), have = new Set(rows.map((r) => r.step));
    const key = nextSteps(rows).find((k) => have.has(k) && !tried.has(k));
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
  await accountsDone(ctx.flow.id, rows);
  const settled = rows.every((r) => ['done', 'skipped', 'hr_task'].includes(r.status)) && !rows.some((r) => r.step === 'google' && r.status === 'hr_task');
  if (!settled) return;
  const now = new Date().toISOString();
  await svc.from('hub_onboard_flows').update({ status: 'started', started_at: now, updated_at: now }).eq('id', ctx.flow.id).eq('status', 'running');
}
/* wave275: accounts_at, once, when the at-Accept steps of a flow that accept_setup ran are all done or skipped (however they got there: the run, a
   Retry or HR). A wave271 flow keeps it empty. Best effort: the card shows the steps themselves. */
const ACCEPT_KEYS = STEPS.filter((s) => s.at === 'accept').map((s) => s.key);
async function accountsDone(flowId: number, rows: StepRow[]): Promise<void> {
  if (!ACCEPT_KEYS.every((k) => met(rows.find((r) => r.step === k)?.status))) return;
  try {
    const { data } = await svc.from('hub_onboard_flows').select('setup_ticks, accounts_at').eq('id', flowId).maybeSingle();
    if (!(data as Row)?.setup_ticks?.accept_setup_at || (data as Row)?.accounts_at) return;
    const now = new Date().toISOString();
    await svc.from('hub_onboard_flows').update({ accounts_at: now, updated_at: now }).eq('id', flowId).is('accounts_at', null);
  } catch (_) { /* see above */ }
}
const reply = async (flowId: number) => json({ steps: await readSteps(flowId) });

/* ---------- step: roster ---------- */
async function log(entity_type: string, entity_id: unknown, field: string, old_value: unknown, new_value: unknown, changed_by: string): Promise<void> {
  try { await svc.from('change_log').insert({ entity_type, entity_id: String(entity_id), field, old_value: old_value == null ? null : String(old_value), new_value: new_value == null ? null : String(new_value), changed_by }); } catch (_) { /* audit */ }
}
async function runRoster(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c) throw new Error('The candidate card is gone, so there is nothing to put on the roster.');
  const start = f.call_at ? torontoDate(f.call_at) : null;   // wave275: at Accept there is no day one yet; the plan step fills it in at booking
  let member: Row = c.member_id ? await getMember(c.member_id) : null;
  if (!member) {
    const found = [...await membersByEmail(c.email), ...await membersByEmail(f.wa_email)];
    member = found.find((m) => m.active !== false) || found[0] || null;
  }
  let said: string;
  if (member) {   // directory-sync overwrites a start date unless start_source is manual
    const patch: Record<string, unknown> = { start_source: 'manual' };
    if (start) patch.start_date = start;
    if (member.active === false) patch.active = true;
    if (f.wa_email && !/@welfareavenue\.com$/i.test(String(member.email || ''))) patch.email = f.wa_email;
    const { error } = await svc.from('team_members').update(patch).eq('id', member.id);
    if (error) throw new Error('The roster profile could not be updated: ' + error.message + '. Press Retry.');
    said = 'Linked the existing roster profile of ' + member.name + (start ? ', with ' + start + ' as the start date.' : '. The start date is set when the times are booked.');
    if (!f.roster_created) await svc.from('hub_onboard_flows').update({ roster_created: false }).eq('id', f.id);   // true stays true: a retry finds the profile an earlier try made
  } else {
    let pos: Row = null;
    if (c.position_id) ({ data: pos } = await svc.from('hub_positions').select('title, dept').eq('id', c.position_id).maybeSingle());
    const { data, error } = await svc.from('team_members').insert({
      name: c.name, email: f.wa_email || String(c.email || '').trim().toLowerCase() || null, department: pos?.dept || null, role: c.role || pos?.title || null,
      position_id: c.position_id || null, active: true, start_date: start, start_source: 'manual',
    }).select('id, name').single();
    if (error || !data) throw new Error('The roster profile could not be created: ' + (error?.message || 'no row came back') + '. Press Retry.');
    member = data;
    said = start ? 'Created the roster profile, with ' + start + ' as the start date.' : 'Created the roster profile, active, with no start date yet: it is set when the times are booked.';
    await svc.from('hub_onboard_flows').update({ roster_created: true }).eq('id', f.id);   // if this write fails, the back-out list only asks HR to check the profile
  }
  const now = new Date().toISOString();
  if (!start) {   // wave275 at Accept: the card is linked to the profile and stays where it is; it moves to Hired at booking, when day one is known
    const { error } = await svc.from('hub_candidates').update({ member_id: member.id, updated_at: now, updated_by: ctx.by }).eq('id', c.id);
    if (error) throw new Error('The profile is on the roster, but the card could not be linked to it: ' + error.message + '. Press Retry.');
    return said;
  }
  const patch: Record<string, unknown> = { status: 'hired', member_id: member.id, start_date: start, updated_at: now, updated_by: ctx.by };
  if (c.status !== 'hired') patch.stage_at = now;
  const { error } = await svc.from('hub_candidates').update(patch).eq('id', c.id);
  if (error) throw new Error('The profile is on the roster, but the card could not move to Hired: ' + error.message + '. Press Retry.');
  await log('candidate', c.id, 'status', c.status, 'hired (Start onboarding)', ctx.by);
  return said;
}

/* ---------- step: plan ---------- */
/* wave275: a profile made at Accept has no start date and its card is still at offer. Day one is the Toronto date of the call: the profile (manual, so
   directory-sync keeps it) and the card take it, and the card moves to Hired. A wave271 Start did this in the roster step, so then nothing changes. */
async function dayOne(ctx: Ctx, c: Row, start: string): Promise<void> {
  if (c.status === 'hired' && String(c.start_date || '').slice(0, 10) === start) return;
  const { error: mErr } = await svc.from('team_members').update({ start_date: start, start_source: 'manual' }).eq('id', c.member_id);
  if (mErr) throw new Error('The start date could not be saved on the roster profile: ' + mErr.message + '. Press Retry.');
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: 'hired', start_date: start, updated_at: now, updated_by: ctx.by };
  if (c.status !== 'hired') patch.stage_at = now;
  const { error } = await svc.from('hub_candidates').update(patch).eq('id', c.id);
  if (error) throw new Error('The start date is on the roster profile, but the card could not move to Hired: ' + error.message + '. Press Retry.');
  if (c.status !== 'hired') await log('candidate', c.id, 'status', c.status, 'hired (times booked)', ctx.by);
}
async function runPlan(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c?.member_id) {
    if (f.onboarding_id) return 'The onboarding plan was already made.';
    throw new Error('The card has no roster profile yet. Retry step 1 first.');
  }
  const start = torontoDate(f.call_at);
  await dayOne(ctx, c, start);
  if (f.onboarding_id) return 'The onboarding plan was already made.';
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
  /* HR's Start runs onboarding_assign as HR (its staff check needs a sign-in); the hire's Yes has none, so the service key's own copy (wa275a 7b) */
  const { data, error } = ctx.asUser
    ? await ctx.asUser.rpc('onboarding_assign', { p_member_id: c.member_id, p_by: ctx.by, p_start: start })
    : await svc.rpc('wa275_plan_assign', { p_member_id: c.member_id, p_by: ctx.by, p_start: start });
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
/* whose address is this on the roster? owner: someone else's name. own: it sits on the profile this card already matches, by member_id or by personal email. */
async function rosterClaim(addr: string | null, c: Row): Promise<{ owner: string | null; own: boolean }> {
  const holders = addr ? await membersByEmail(addr) : [];
  if (!holders.length) return { owner: null, own: false };
  const mine = new Set([c.member_id, ...(await membersByEmail(c.email)).map((m) => m.id)].filter((x) => x != null).map(String));
  const other = holders.find((m) => !mine.has(String(m.id)));
  return other ? { owner: other.name, own: false } : { owner: null, own: true };
}
const onProfileOf = (addr: string, owner: string) => addr + ' is on the roster profile of ' + owner + '. Change the address, or clear it.';

/* ---------- step: google (wave275) ---------- */
/* The account, as Steel (directory-sync's actor), in the root unit, with the fixed first password and a forced change at the first sign-in. The password
   is read from the vault at this moment and goes nowhere but the request body: never a detail, a row, a log line or the console. Whatever Google says
   back is scrubbed of it before it becomes HR's sentence. */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const stop = (s: string) => (/[.!?]$/.test(s) ? s : s + '.');
const scrub = (text: string, secret: string) => (secret ? String(text).split(secret).join('[first password]') : String(text));
async function runGoogle(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c) throw new Error('The candidate card is gone, so there is nobody to make an account for.');
  let addr: string | null = cleanAddress(f.wa_email);
  if (!addr) {   // at Accept nobody has typed an address: first.last, unless the roster has it already
    const s = suggestAddress(c.name);
    if (!s) throw new HrTask('The name ' + noBreaks(c.name) + ' does not fit first.last, so HR chooses the address. ' + GOOGLE_TASK);
    addr = s + '@' + DOMAIN;
    const claim = await rosterClaim(addr, c);
    if (claim.owner) throw new HrTask(addr + ' is on the roster profile of ' + claim.owner + ', so the Hub did not make the account. Choose another address: ' + lower(GOOGLE_TASK));
  }
  const { data: pw, error: pwErr } = await svc.rpc('get_secret', { secret_name: 'ONBOARD_FIRST_PASSWORD' });
  if (pwErr) throw new HrTask('The Hub could not read the first password from admin settings, so it did not create the account. Press Retry, or ' + lower(GOOGLE_TASK));
  let password = typeof pw === 'string' ? pw : '';
  if (password.length < 8) throw new HrTask('The first password is not set in admin settings, so the Hub did not create the account. Set it there (8 characters or more), then press Retry, or ' + lower(GOOGLE_TASK));
  const t = await token(ADMIN_ACTOR, SCOPE_USER);
  if (!t) { password = ''; throw new HrTask('Google refused the Hub permission to create accounts as ' + ADMIN_ACTOR + ', so the account was not made. Tell Steel, or ' + lower(GOOGLE_TASK)); }
  const words = String(c.name || '').trim().split(/\s+/);
  let res: Response;
  try {
    res = await fetch(USERS_URL, {
      method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryEmail: addr, name: { givenName: words[0], familyName: words.slice(1).join(' ') || words[0] }, password, changePasswordAtNextLogin: true, orgUnitPath: '/' }),
    });
  } catch (e) {
    const why = scrub(errText(e), password);
    password = '';
    throw new Error('The Hub could not reach Google to create ' + addr + ' (' + why + '). Press Retry.');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const said = scrub(String(j?.error?.message || 'status ' + res.status), password).replace(/\s+/g, ' ').trim().slice(0, 200);
    password = '';
    if (res.status === 409) throw new HrTask(addr + ' already exists in Google (Google said: ' + stop(said) + '), so the Hub did not make a second account. Check whose it is, then ' + lower(GOOGLE_TASK));
    throw new HrTask('Google did not create ' + addr + ': ' + stop(said) + ' ' + GOOGLE_TASK);
  }
  password = '';
  /* read back before done: the account is there under that address */
  const back = await fetch(USERS_URL + '/' + encodeURIComponent(addr) + '?fields=primaryEmail,orgUnitPath,changePasswordAtNextLogin', { headers: { Authorization: 'Bearer ' + t } });
  const bj = await back.json().catch(() => ({}));
  if (!back.ok || String(bj?.primaryEmail || '').toLowerCase() !== addr) {
    throw new Error('Google said it created ' + addr + ', but the Hub could not read the account back (' + back.status + '). Check it in Google Admin, then press "I created it, continue" on this card.');
  }
  const { error } = await svc.from('hub_onboard_flows').update({ wa_email: addr, updated_at: new Date().toISOString() }).eq('id', f.id);
  if (error) throw new Error('The account ' + addr + ' is in Google, but the Hub could not save the address: ' + error.message + '. Press "I created it, continue" with ' + addr + '.');
  ctx.flow.wa_email = addr;
  /* wave275 Task 4: the Hub made this account with the vault password, at this time: the welcome email gives that password only when this mark is there and
     the password has not been changed since. Best effort: without the mark the email says HR sends the login details, which is never wrong. */
  await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'google_made_at', p_value: new Date().toISOString() });
  if (c.member_id) {   // the profile made at Accept has the personal address until the account exists
    const m = await getMember(c.member_id);
    if (m && !/@welfareavenue\.com$/i.test(String(m.email || ''))) await svc.from('team_members').update({ email: addr }).eq('id', m.id);
  }
  return 'Created ' + addr + ' in Google (the root organisational unit) with the first password from admin settings; Google will ask them to change it the first time they sign in.';
}

/* ---------- step: hub (wave275) ---------- */
/* hub-invite's own logic, through its trigger-secret path, which forces member level (never lowering a level someone already has) */
async function runHub(ctx: Ctx): Promise<string> {
  if (!ctx.settings.onboard_auto_hub) throw new HrTask(HUB_TASK);   // its own off switch
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c) throw new Error('The candidate card is gone, so there is nobody to invite.');
  if (!f.wa_email) throw new HrTask('There is no Welfare Avenue address on this card yet, so the Hub invite waits. ' + HUB_TASK);
  let pos: Row = null;
  if (c.position_id) ({ data: pos } = await svc.from('hub_positions').select('dept').eq('id', c.position_id).maybeSingle());
  const secret = await getSecret('WA_TRIGGER_SECRET');
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + '/functions/v1/hub-invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret, Authorization: 'Bearer ' + ANON_KEY },
      body: JSON.stringify({ action: 'invite', email: f.wa_email, name: c.name, department: pos?.dept || null, role_title: c.role || null, inviter: /@welfareavenue\.com$/i.test(ctx.by) ? ctx.by : undefined }),
    });
  } catch (e) {
    throw new Error('The Hub invite did not go out: the Hub could not reach hub-invite (' + errText(e) + '). Press Retry.');
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.ok) throw new Error('The Hub invite did not go through: ' + stop(String(j?.error || 'status ' + res.status).slice(0, 160)) + ' Press Retry, or invite them from Roster.');
  return 'Invited ' + f.wa_email + ' to the Hub at ' + (j.hub_role || 'member') + ' level' + (j.email_sent ? ', and the invitation went to that address.' : '.');
}

/* ---------- mail: who it really goes to, and the Gmail send from hub@ (wave275 Task 4 sends the welcome email through it) ---------- */
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
        text: '*' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + ') has their onboarding call on ' + when + '. That is their first day. <' + HUB + '/#hrcentre/onboarding|Open Onboarding>',
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
async function preview(b: Row, by: string): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  const warnings: string[] = [];
  const suggested = suggestAddress(c.name);
  const address = cleanAddress(b.wa_email) || f.wa_email || (suggested ? suggested + '@' + DOMAIN : null);
  const state = await addressState(address, c.member_id, !!f.practice);
  const claim = await rosterClaim(address, c);
  if (!address) warnings.push('This name does not fit first.last, so HR must type the address.');
  if (claim.owner) warnings.push(onProfileOf(address!, claim.owner));
  else if (state.taken && claim.own) warnings.push(address + ' is already this person\'s address on the roster. Turn off the Google account step to keep it.');
  else if (state.taken) warnings.push(address + ' is already in use in Google. Change the address, or skip the Google account step: the Hub then stores no address for this person.');
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
  if (c.position_id) ({ data: pos } = await svc.from('hub_positions').select('jd_url, dept').eq('id', c.position_id).maybeSingle());
  if (!pos?.jd_url) warnings.push('The position has no job description link, so the welcome email leaves that line out.');
  if (!pos?.dept) warnings.push('The position has no department, so a new roster profile will have none. Set it on the position first.');
  if (c.email) {
    const { data: others } = await svc.from('hub_candidates').select('id, email').ilike('email', String(c.email).trim()).neq('id', c.id).not('status', 'in', '(declined,withdrawn)');
    const n = ((others || []) as Row[]).filter((o) => String(o.email || '').trim().toLowerCase() === String(c.email).trim().toLowerCase()).length;
    if (n) warnings.push('This person has ' + n + ' other application' + (n === 1 ? '' : 's') + ' still open. Close ' + (n === 1 ? 'it' : 'them') + ' by hand so they do not get a second account.');
  } else warnings.push('The card has no personal email, so the invites cannot reach them.');
  if (((await cfg('mail_mode')) || 'test') !== 'live') warnings.push('Email is in test mode: invites and emails go to the test inboxes, not to this person.');
  if (f.practice) warnings.push('This is a practice applicant: the run is a simulation and nothing real changes.');

  return json({ address, address_taken: state.taken, address_owner: claim.owner, address_own: claim.own, needs_address: !address, manager, department: pos?.dept || null, canva_link: f.canva_link || null, grids, hub_events: Array.from(seen.values()), steps, welcome: await welcomeFor(f, c, by), warnings });
}
/* ---------- the welcome email, as in the SOP's Onboarding Email ---------- */
/* renderWelcome(flow, candidate, facts) -> {subject, text}; sendWelcome (the step welcome) sends what it gives. No password ever goes in this text: the
   place for it is [first password] ([premier mot de passe] in French), which only sendWelcome replaces, in the outgoing message alone.
   The text is kept with its marked places in [square brackets] and filled in only when it is read (the preview after Start, the card, the sender), so a
   later change of time, manager, address or Canva link always shows. HR's edits are saved as typed, brackets and all (welcome_subject, welcome_text, only
   the part they changed); the Hub's own text is never saved, so it follows the template. Before Start or booking (facts.draft) the brackets stay as they are.
   A line whose value is empty goes, and the steps renumber. wave275 Task 4: the Meet links, the login paragraph (or, when the account step is not
   done, "HR will send your login details separately" in its place) and the setup rundown, with a link to its page for a wave275 hire. */
const WELCOME_SLOTS: Record<'en' | 'fr', Record<string, string>> = {
  en: {
    day: '[first day: fills in at Start]', call: '[call date and time: fills in at Start]', one: '[1-on-1 date and time: fills in at Start]', manager: '[manager: fills in at Start]',
    group: '[group session date: fills in at Start, or this line is left out]', address: '[Welfare Avenue address: fills in at Start]', canva: '[Canva link: fills in at Start, or this line is left out]',
    newaddr: '[new address]', password: '[first password]', callmeet: '[call Meet link]', onemeet: '[1-on-1 Meet link]', setup: '[setup page link]',
  },
  fr: {
    day: '[premier jour : rempli au démarrage]', call: '[date et heure de l\'appel : remplies au démarrage]', one: '[date et heure de la rencontre : remplies au démarrage]', manager: '[gestionnaire : rempli au démarrage]',
    group: '[date de la séance de groupe : remplie au démarrage, ou cette ligne est retirée]', address: '[adresse Welfare Avenue : remplie au démarrage]', canva: '[lien Canva : rempli au démarrage, ou cette ligne est retirée]',
    newaddr: '[nouvelle adresse]', password: '[premier mot de passe]', callmeet: '[lien Meet de l\'appel]', onemeet: '[lien Meet de la rencontre]', setup: '[lien de la page de préparation]',
  },
};
const PASSWORD_MARKS = [WELCOME_SLOTS.en.password, WELCOME_SLOTS.fr.password];   // either works in either language: only sendWelcome fills them
const LOGIN_LATER = { en: 'HR will send your login details separately.', fr: 'Les RH vous enverront vos informations de connexion séparément.' };
const REMOVABLE = ['group', 'canva', 'setup'];   // an empty value takes its line out
/* the setup rundown of the /o/ page (onboard-link SETUP), word for word: functions are single files, so this is its copy for the email. Change both together. */
export const SETUP_STEPS: Array<{ key: string; title: { en: string; fr: string }; body: { en: string; fr: string } }> = [
  { key: 'profile', title: { en: 'Add your Welfare Avenue account to Chrome', fr: 'Ajoutez votre compte Welfare Avenue à Chrome' },
    body: { en: 'In Chrome, add a new profile, sign in with your Welfare Avenue address and turn on sync. Keep your Welfare Avenue work in that profile from now on.', fr: 'Dans Chrome, ajoutez un nouveau profil, connectez-vous avec votre adresse Welfare Avenue et activez la synchronisation. Gardez votre travail pour Welfare Avenue dans ce profil à partir de maintenant.' } },
  { key: 'bookmarks', title: { en: 'Bookmark Gmail and Calendar', fr: 'Ajoutez Gmail et Agenda à vos favoris' },
    body: { en: 'In that profile, open Gmail (mail.google.com) and Google Calendar (calendar.google.com), and bookmark both.', fr: 'Dans ce profil, ouvrez Gmail (mail.google.com) et Google Agenda (calendar.google.com), puis ajoutez-les tous les deux à vos favoris.' } },
  { key: 'hub', title: { en: 'Sign in to the Hub', fr: 'Connectez-vous au Hub' },
    body: { en: 'Go to hub.welfareavenue.com and press Sign in with Google, with your Welfare Avenue account.', fr: 'Allez sur hub.welfareavenue.com et appuyez sur Sign in with Google, avec votre compte Welfare Avenue.' } },
  { key: 'slack', title: { en: 'Join Slack', fr: 'Joignez-vous à Slack' },
    body: { en: 'Join the Welfare Avenue Slack with your Welfare Avenue address (the link is in your welcome email), then accept the invitation to your onboarding channel.', fr: 'Joignez-vous au Slack de Welfare Avenue avec votre adresse Welfare Avenue (le lien est dans votre courriel de bienvenue), puis acceptez l\'invitation à votre canal d\'accueil.' } },
  { key: 'academy', title: { en: 'Open the Avenue Academy and your plan', fr: 'Ouvrez l\'Avenue Academy et votre plan' },
    body: { en: 'In the Hub, open the Avenue Academy and look through your onboarding plan, so you know what your first weeks hold.', fr: 'Dans le Hub, ouvrez l\'Avenue Academy et parcourez votre plan d\'accueil, pour savoir ce qui vous attend les premières semaines.' } },
  { key: 'loom', title: { en: 'Accept the Loom invitation', fr: 'Acceptez l\'invitation Loom' },
    body: { en: 'When the Loom invitation reaches your Welfare Avenue inbox, accept it.', fr: 'Quand l\'invitation Loom arrive dans votre boîte Welfare Avenue, acceptez-la.' } },
  { key: 'canva', title: { en: 'Join Canva', fr: 'Joignez-vous à Canva' },
    body: { en: 'If your welcome email has a Canva link, use it to join the Welfare Avenue team on Canva.', fr: 'Si votre courriel de bienvenue contient un lien Canva, utilisez-le pour vous joindre à l\'équipe Welfare Avenue sur Canva.' } },
  { key: 'drives', title: { en: 'Find your Drives and Google Groups', fr: 'Repérez vos Drives et vos groupes Google' },
    body: { en: 'In Google Drive, look under Shared drives for the team drives you have been added to, and check which Google Groups you are in. Nothing to do with them yet.', fr: 'Dans Google Drive, regardez sous Drives partagés les dossiers d\'équipe auxquels vous avez été ajouté, et vérifiez de quels groupes Google vous faites partie. Rien à faire pour l\'instant.' } },
  { key: 'weekly', title: { en: 'Find your weekly meeting', fr: 'Repérez votre rencontre hebdomadaire' },
    body: { en: 'Look in your Calendar for your team\'s weekly meeting and accept the invitation.', fr: 'Cherchez dans votre Agenda la rencontre hebdomadaire de votre équipe et acceptez l\'invitation.' } },
];
const rundownLines = (lang: 'en' | 'fr') => SETUP_STEPS.map((x, i) => '   ' + (i + 1) + '. ' + x.title[lang] + '. ' + x.body[lang]).join('\n');
/* the login is not the Hub's to give: the login lines become the sentence that HR sends the details separately. The login lines are the template's own
   (its heading, Email, the placeholder, the change-it sentence and the video) and any line with the placeholder; every other line HR wrote under that
   step stays. The template's own heading (or a numbered line holding the placeholder) becomes the sentence, keeping its number; a heading HR rewrote stays,
   with the sentence in the placeholder's place. A placeholder outside a numbered step: that line alone. */
const LOGIN_HEADS = ['Sign in to your Welfare Avenue Google account at mail.google.com:', 'Connectez-vous à votre compte Google Welfare Avenue sur mail.google.com :'];
const LOGIN_OWN = [/\[new address\]|\[nouvelle adresse\]/, /^\s*Google will ask you to change it the first time you sign in\.\s*$/, /^\s*Google vous demandera de le changer lors de votre première connexion\.\s*$/, /^\s*This video shows you how: /, /^\s*Pour vous guider, regardez cette vidéo : /];
const hasPassword = (l: string) => PASSWORD_MARKS.some((p) => l.includes(p));
function loginLater(text: string, lang: 'en' | 'fr'): string {
  const lines = text.split('\n'), later = LOGIN_LATER[lang];
  const indent = (l: string) => /^\s*/.exec(l)?.[0] || '';
  for (;;) {
    const at = lines.findIndex(hasPassword);
    if (at < 0) return lines.join('\n');
    let start = at;
    while (start > 0 && /^\s+\S/.test(lines[start])) start--;   // a line under a numbered step: up to its number
    const num = /^(\d+\. )(.*)$/.exec(lines[start]);
    if (!num) { lines.splice(at, 1, indent(lines[at]) + later); continue; }
    let end = start + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
    const under = lines.slice(start + 1, end);
    const ownHead = at === start || LOGIN_HEADS.includes(num[2].trim());
    const kept = ownHead
      ? [num[1] + later, ...under.filter((l) => !hasPassword(l) && !LOGIN_OWN.some((r) => r.test(l)))]
      : [lines[start], ...under.map((l) => (hasPassword(l) ? indent(l) + later : l)).filter((l) => !LOGIN_OWN.some((r) => r.test(l)))];
    lines.splice(start, end - start, ...kept);
  }
}
/* the role in French, as the /o/ page names it (build/o/index.html ROLE_FR; functions are single files) */
const ROLE_FR: Record<string, string> = { 'Operations Manager': 'Gestionnaire des opérations', 'HR Technician': 'Technicien·ne RH', 'Event Coordinator': 'Coordonnateur·rice d\'événements' };
export type WelcomeFacts = {
  draft?: boolean; manager: string | null; jdUrl: string | null; video: string | null; slack: string; hrName: string;
  login?: boolean;                                    // wave275: the account step is done (the login paragraph stays, [first password] and all); else HR sends the details
  meet?: { call: string | null; one: string | null }; // the Meet links of the two invites, when known
  noInvites?: boolean;                                // the invites step was skipped: no invite comes from the Hub, so the email names no Meet link
  setupLink?: string | null;                          // the hire's rundown page (/o/<offer token>?setup), for a wave275 hire only
  loginWhy?: string;                                  // for HR, when login is false: why the email says HR sends the login details
};
/* a date in words; French says 1er for the first of the month, which Intl does not */
function dayWords(at: string, lang: 'en' | 'fr'): string {
  if (lang === 'en') return new Date(at).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ }).formatToParts(new Date(at))) p[x.type] = x.value;
  return p.weekday + ' ' + (p.day === '1' ? '1er' : p.day) + ' ' + p.month + ' ' + p.year;
}
const atWords = (at: string, lang: 'en' | 'fr') => lang === 'en' ? whenText(at, 'en')
  : dayWords(at, 'fr') + ' à ' + new Date(at).toLocaleTimeString('fr-CA', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
/* puts the flow's values in the marked places. Empty group session, Canva link or rundown page: that line goes, and the numbered steps count again. No
   manager: "your manager" once. The account step not done: the login step says HR sends the details. [first password] is never filled here. */
function fillWelcome(text: string, f: Row, c: Row, facts: WelcomeFacts): string {
  const lang = langOf(c), fr = lang === 'fr', slots = WELCOME_SLOTS[lang], yours = fr ? 'votre gestionnaire' : 'your manager';
  const address = f.wa_email || (fr ? 'nous vous la confirmerons bientôt' : 'we\'ll confirm it soon');
  const meet = (link: string | null | undefined, booked: boolean) => link || (fr ? (booked ? 'le lien est dans votre invitation' : 'le lien viendra avec l\'invitation') : (booked ? 'the link is in your calendar invite' : 'the link will come with the invite'));
  const values: Record<string, string | null> = {
    day: f.call_at ? dayWords(f.call_at, lang) : null,
    call: f.call_at ? atWords(f.call_at, lang) : null,
    one: f.one_on_one_at ? atWords(f.one_on_one_at, lang) : (fr ? 'nous vous confirmerons l\'heure bientôt' : 'we\'ll confirm the time soon'),
    manager: facts.manager || yours,
    group: String(f.group_session ?? '').trim() || null,
    address, newaddr: address,
    canva: f.canva_link || null,
    callmeet: meet(facts.meet?.call, !!f.call_event_id), onemeet: meet(facts.meet?.one, !!f.one_on_one_event_id),
    setup: facts.setupLink || null,
    password: null,
  };
  if (!facts.login) text = loginLater(text, lang);
  if (facts.noInvites) {   // no invite will come from the Hub: the Meet part of each meeting line goes, the rest of the line stays
    for (const k of ['callmeet', 'onemeet']) {
      for (const label of [WELCOME_SLOTS.en[k], WELCOME_SLOTS.fr[k]]) text = text.replace(new RegExp('[ \\t]*Google Meet ?: ' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
      values[k] = '';   // anywhere else HR put it
    }
  }
  let removed = false;
  const lines: string[] = [];
  for (let line of text.split('\n')) {
    if (REMOVABLE.some((k) => !values[k] && line.includes(slots[k]))) { removed = true; continue; }
    if (!facts.manager) line = line.split(yours + ', ' + slots.manager).join(yours);   // never "your manager, your manager"
    const filled = Object.keys(slots).reduce((l, k) => (values[k] == null || !l.includes(slots[k]) ? l : l.split(slots[k]).join(values[k]!)), line);
    lines.push(filled === line ? line : filled.replace(/([ap]\.m\.)\./g, '$1'));   // a time ending in "p.m." before the template's full stop: one stop, not two
  }
  if (!removed) return lines.join('\n');
  let n = 0;
  return lines.map((l) => (/^\d+\. /.test(l) ? String(++n) + l.slice(l.indexOf('.')) : l)).join('\n');
}
/* the Hub's own text, with its marked places */
function welcomeTemplate(c: Row, facts: WelcomeFacts): { subject: string; text: string } {
  const lang = langOf(c), fr = lang === 'fr', s = WELCOME_SLOTS[lang], first = firstName(c.name);
  const role = String(c.role || '').trim(), roleFr = ROLE_FR[role] || role;
  const steps: string[] = fr ? [
    '1. Vos rencontres :\n   - Votre appel d\'accueil : ' + s.call + '. L\'invitation est dans votre calendrier. Google Meet : ' + s.callmeet + '\n   - Une rencontre individuelle de présentation avec votre gestionnaire, ' + s.manager + ' : ' + s.one + '. Google Meet : ' + s.onemeet + '\n   - Votre séance d\'accueil de groupe en personne avec ' + s.manager + ', le ' + s.group + '. Si vous ne pouvez pas y être, dites-le-nous. Cette étape est essentielle.',
    '2. Connectez-vous à votre compte Google Welfare Avenue sur mail.google.com :\n   Adresse courriel : ' + s.newaddr + '\n   Premier mot de passe : ' + s.password + '\n   Google vous demandera de le changer lors de votre première connexion.' + (facts.video ? '\n   Pour vous guider, regardez cette vidéo : ' + facts.video : ''),
    '3. Joignez-vous à notre espace Slack avec votre nouvelle adresse courriel Welfare Avenue : ' + facts.slack,
    '4. Joignez-vous à notre équipe Canva : ' + s.canva,
    '5. Signez le contrat. Il vous est envoyé par DocuSign à votre adresse courriel personnelle.',
    '6. Lisez votre description de poste et préparez les questions que vous voulez aborder avec votre direction' + (facts.jdUrl ? ' : ' + facts.jdUrl : '.'),
    '7. Avant votre appel d\'accueil, préparez votre ordinateur vous-même, étape par étape :\n   Vous pouvez cocher chaque étape sur cette page, pour que votre gestionnaire sache où vous en êtes : ' + s.setup + '\n' + rundownLines('fr'),
  ] : [
    '1. Your meetings:\n   - Your onboarding call: ' + s.call + '. The invite is in your calendar. Google Meet: ' + s.callmeet + '\n   - A 1-on-1 introductory meeting with your manager, ' + s.manager + ': ' + s.one + '. Google Meet: ' + s.onemeet + '\n   - Your in-person group onboarding session with ' + s.manager + ' on ' + s.group + '. If you can\'t make it, let us know. This step is crucial.',
    '2. Sign in to your Welfare Avenue Google account at mail.google.com:\n   Email: ' + s.newaddr + '\n   First password: ' + s.password + '\n   Google will ask you to change it the first time you sign in.' + (facts.video ? '\n   This video shows you how: ' + facts.video : ''),
    '3. Join your Slack workspace with your new Welfare Avenue email: ' + facts.slack,
    '4. Join our Canva team: ' + s.canva,
    '5. Sign the Contract. Sent via DocuSign to your personal email.',
    '6. Review your job description and prepare questions to ask about it with your director' + (facts.jdUrl ? ': ' + facts.jdUrl : '.'),
    '7. Before your onboarding call, set up your computer on your own, step by step:\n   You can tick each step off on this page, so your manager can see where you are: ' + s.setup + '\n' + rundownLines('en'),
  ];
  const text = (fr ? [
    'Bonjour ' + first + ',', '', 'Félicitations et bienvenue dans l\'équipe de Welfare Avenue!',
    roleFr ? 'Nous sommes ravis que vous ayez accepté le poste de ' + roleFr + ' au sein de notre organisme.' : 'Nous sommes ravis que vous ayez accepté notre offre.',
    'Votre premier jour est le ' + s.day + ', et nous avons hâte de vous accueillir. Pour bien commencer, voici les prochaines étapes :', '', 'Prochaines étapes :', ...steps, '',
    'Si vous éprouvez un problème technique ou si vous avez des questions, n\'hésitez pas à nous écrire. Nous sommes là pour que votre intégration se déroule en douceur, dans un climat accueillant.',
    'Au plaisir de voir tout le beau travail que vous accomplirez avec nous!', facts.hrName,
  ] : [
    'Dear ' + first + ',', '', 'Congratulations and welcome to the team at Welfare Avenue!',
    role ? 'We\'re excited you\'ve accepted the ' + role + ' role within our organization.' : 'We\'re excited you\'ve accepted our offer.',
    'Your first day is ' + s.day + ', and we can\'t wait to have you on board. To get started, please take the following steps:', '', 'Next Steps:', ...steps, '',
    'If you run into any technical issues or have any questions, don\'t hesitate to reach out. We\'re here to help make your onboarding experience smooth and welcoming.',
    'Looking forward to seeing all the great work you\'ll do with us!', facts.hrName,
  ]).join('\n');
  return { subject: fr ? 'Bienvenue chez Welfare Avenue! Vos prochaines étapes' : 'Welcome to Welfare Avenue! Your Next Steps', text };
}
/* the email as it reads now: HR's saved subject or text where they changed it, else the Hub's own; filled in unless facts.draft */
export function renderWelcome(f: Row, c: Row, facts: WelcomeFacts): { subject: string; text: string } {
  const own = welcomeTemplate(c, facts);
  const subject = typeof f.welcome_subject === 'string' && f.welcome_subject ? f.welcome_subject : own.subject;
  const text = typeof f.welcome_text === 'string' && f.welcome_text ? f.welcome_text : own.text;
  return { subject, text: facts.draft ? text : fillWelcome(text, f, c, facts) };
}
/* what renderWelcome needs from the database. who: the person who signs, by email (HR who pressed Start; at the hire's Yes, the manager, who booked the
   times with them); not on the roster (or the roster cannot be read), the team signs it. Filled in (not draft), also: whether the account step is done, the
   Meet links (hub_events, as the calendar sync saved them; live, the sender asks Calendar for any still missing) and the rundown page. */
async function welcomeFacts(f: Row, c: Row, who: string, draft: boolean, live = false): Promise<WelcomeFacts> {
  const m = await getMember(f.manager_member_id);
  let jd: Row = null;
  if (c.position_id) ({ data: jd } = await svc.from('hub_positions').select('jd_url').eq('id', c.position_id).maybeSingle());
  const hr = (await membersByEmail(who).catch(() => []))[0];
  const facts: WelcomeFacts = {
    draft, manager: m?.name || null, jdUrl: jd?.jd_url || null, video: (await cfg('onboard_google_video')).trim() || null,
    slack: (await cfg('onboard_slack_join_link')).trim() || 'https://welfareavenue.slack.com',
    hrName: hr?.name || (langOf(c) === 'fr' ? 'L\'équipe de Welfare Avenue' : 'The Welfare Avenue team'),
  };
  if (draft) return facts;
  const steps = await readSteps(f.id);
  const status = (k: string) => steps.find((r) => r.step === k)?.status;
  const { data: more } = await svc.from('hub_onboard_flows').select('created_at, proposed_at, setup_ticks').eq('id', f.id).maybeSingle();
  const login = await loginState(f, status('google'), (more as Row | null)?.setup_ticks);
  return { ...facts, ...login, noInvites: status('invites') === 'skipped', meet: await meetLinks(f, live && !f.practice), setupLink: await setupPage((more || {}) as Row, c) };
}
/* the login paragraph is the Hub's to give only for an account the Hub itself made with the vault password (setup_ticks.google_made_at, set by the google
   step), and only while that password has not been changed since (app_config onboard_first_password_at, set by set_first_password). An account HR made by
   hand ("I created it, continue") or skipped has a password the Hub does not know. */
async function loginState(f: Row, google: string | undefined, ticks: Row): Promise<{ login: boolean; loginWhy?: string }> {
  if (google !== 'done' || !f.wa_email) return { login: false, loginWhy: 'The Google account is not made yet, so it says HR will send the login details separately: send them once the account exists.' };
  const made = Date.parse(String(ticks?.google_made_at ?? ''));
  if (Number.isNaN(made)) return { login: false, loginWhy: 'The Google account was made by hand, so the Hub does not know its password: it says HR will send the login details separately. Send them yourself.' };
  const changed = Date.parse((await cfg(PW_AT)).trim());
  if (!Number.isNaN(changed) && changed > made) return { login: false, loginWhy: 'The first password was changed in admin settings after the Hub made the account, so the account still has the earlier one: it says HR will send the login details separately. Send them yourself.' };
  return { login: true };
}
/* the Meet link of each invite: the calendar sync's copy (hub_events, by the event id the invites step saved), else, when asked, Calendar itself. Best
   effort: without one the email says the link is in the invite. */
const meetOf = (ev: Row): string | null => {
  const link = ev?.hangoutLink || ((ev?.conferenceData?.entryPoints || []) as Row[]).find((e) => e?.entryPointType === 'video' && e?.uri)?.uri;
  return typeof link === 'string' && /^https:\/\/\S+$/.test(link) ? link : null;
};
async function meetLinks(f: Row, ask: boolean): Promise<{ call: string | null; one: string | null }> {
  const ids: Record<'call' | 'one', string | null> = { call: f.call_event_id || null, one: f.one_on_one_event_id || null };
  const out: Record<'call' | 'one', string | null> = { call: null, one: null };
  const known = Object.values(ids).filter((x): x is string => !!x);
  if (!known.length) return out;
  const { data } = await svc.from('hub_events').select('id, meet_link').in('id', known);
  for (const k of ['call', 'one'] as const) out[k] = meetOf({ hangoutLink: ((data || []) as Row[]).find((e) => e.id === ids[k])?.meet_link });
  if (!ask || (['call', 'one'] as const).every((k) => !ids[k] || out[k])) return out;
  try {
    const t = await calToken();
    for (const k of ['call', 'one'] as const) {
      if (!ids[k] || out[k]) continue;
      const r = await gcal(t, 'GET', eventsPath + '/' + encodeURIComponent(ids[k]!) + '?fields=hangoutLink,conferenceData');
      if (r.ok) out[k] = meetOf(r.j);
    }
  } catch (_) { /* see above */ }
  return out;
}
/* the rundown page is the offer link with ?setup. onboard-link keeps it open after booking for a wave275 hire only (a proposal, or a flow made on or after
   onboard_v2_since); a wave271 hire's link shuts once the meetings are booked, so their email lists the steps without it. */
async function setupPage(row: Row, c: Row): Promise<string | null> {   // row: the flow's created_at and proposed_at
  if (!row?.proposed_at && !(await isV2(row || {}))) return null;
  return HUB + '/o/' + await offerToken(c.id) + '?setup';
}
/* the preview and the card: before Start, the marked places; after it, the real values */
async function welcomeFor(f: Row, c: Row, by: string): Promise<{ subject: string; text: string }> {
  return renderWelcome(f, c, await welcomeFacts(f, c, f.started_by || by, !AFTER_START.includes(f.status) && f.status !== 'backed_out'));
}
/* welcome {flow_id}: the email as it reads now, for the card's Copy button, with [first password] kept: the password never reaches HR's eyes. Reads only. */
async function welcomeNow(b: Row, by: string): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  return json({ ...(await welcomeFor(f, c, by)), edited: !!f.welcome_edited, sent_at: f.welcome_sent_at ?? null });
}

/* ---------- step: welcome (wave275 Task 4) ---------- */
/* The welcome email, from hub@ to the personal address, once the invites are out (at booking, or at Start). The text is the saved template (HR's edits
   kept) filled in now. The first password is read from the vault here and nowhere else, only when the account step made the account and the text has its
   place, and goes into this one outgoing message only: the flow keeps its bracketed text, and no row, step detail or log line ever holds the value.
   Claimed with welcome_sent_at, so a second run says it was already sent; the claim is given back when the send fails, so Retry can send it. A practice
   flow never gets here: the runner simulates every step for it. */
async function firstPassword(): Promise<string> {   // '' when it cannot be read or is under 8 characters, as the google step treats it
  const { data, error } = await svc.rpc('get_secret', { secret_name: 'ONBOARD_FIRST_PASSWORD' });
  return !error && typeof data === 'string' && data.length >= 8 ? data : '';
}
/* the email's HTML part: the same text, its links clickable */
function welcomeHtml(text: string): string {
  const line = (l: string) => esc(l).replace(/^ +/, (sp) => '&nbsp;'.repeat(sp.length)).replace(/https?:\/\/[^\s<]*[^\s<.,;:!?)]/g, (u) => '<a href="' + u + '" style="color:#103F39;">' + u + '</a>');
  return '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#FFFAF2;font-family:Helvetica,Arial,sans-serif;color:#1F201E;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid rgba(16,63,57,.10);padding:28px 32px;font-size:15px;line-height:1.55;">'
    + text.split('\n').map(line).join('<br>') + '</div></body></html>';
}
async function sendWelcome(ctx: Ctx): Promise<string> {
  const f = ctx.flow, c = await getCand(f.candidate_id);
  if (!c) throw new Error('The candidate card is gone, so there is nobody to welcome.');
  const to = String(c.email || '').trim().toLowerCase();
  if (!to) throw new Error('The card has no personal email, so the welcome email cannot reach them. Add it, then press Retry.');
  /* the claim: of two runs, one finds welcome_sent_at empty */
  const now = new Date().toISOString();
  const { data: won, error: claimErr } = await svc.from('hub_onboard_flows').update({ welcome_sent_at: now, updated_at: now }).eq('id', f.id).is('welcome_sent_at', null).select('id');
  if (claimErr) throw new Error('The Hub could not record the welcome email, so it did not send it: ' + claimErr.message + '. Press Retry.');
  if (!(won as unknown[] | null)?.length) {
    const { data: was } = await svc.from('hub_onboard_flows').select('welcome_sent_at').eq('id', f.id).maybeSingle();
    const at = (was as Row | null)?.welcome_sent_at;
    return 'The welcome email was already sent' + (at ? ' on ' + whenText(at) : '') + ', so it was not sent again.';
  }
  let password = '';
  try {
    const facts = await welcomeFacts(f, c, f.started_by || ctx.by, false, true);
    const w = renderWelcome(f, c, facts);
    let text = w.text, why = facts.login ? '' : ' ' + (facts.loginWhy || '');
    if (facts.login && PASSWORD_MARKS.some((p) => text.includes(p))) {
      password = await firstPassword();
      if (password) text = PASSWORD_MARKS.reduce((t, p) => t.split(p).join(password), text);
      else {
        text = renderWelcome(f, c, { ...facts, login: false }).text;
        why = ' The first password is not set in admin settings, so it says HR will send the login details separately: send them yourself.';
      }
    }
    const signer = String(f.started_by || '').trim().toLowerCase();
    const sent = await deliver({ practice: false, to, subject: w.subject, text, html: welcomeHtml(text), ...(/@welfareavenue\.com$/.test(signer) ? { replyTo: signer } : {}) });
    password = '';
    return 'Sent the welcome email to ' + to + ' from ' + CAL + (sent.mode === 'test' ? ', and email is in test mode, so it went only to ' + sent.to.join(', ') : '') + '.' + why;
  } catch (e) {
    const said = scrub(errText(e), password);
    password = '';
    await svc.from('hub_onboard_flows').update({ welcome_sent_at: null }).eq('id', f.id).eq('welcome_sent_at', now);   // given back, so Retry can send it
    throw new Error(said);
  }
}

/* ---------- the first password (wave275 Task 4): set_first_password and first_password_state, admins only ---------- */
/* The value goes to the vault (wa_vault_set, service role only) and nowhere else: change_log says "set", and app_config onboard_first_password_at keeps
   when, which is all first_password_state reads (it never reads the vault). Google's rules: 8 to 100 printable ASCII characters, no space at either end; the Hub also asks
   for a letter and a digit. */
const PW_AT = 'onboard_first_password_at';
function passwordProblem(v: unknown): string | null {
  if (typeof v !== 'string') return 'must be typed as text.';
  if (!v) return 'is empty. Type one with at least 8 characters, a letter and a digit.';
  if (v !== v.trim()) return 'cannot start or end with a space (Google\'s rule).';
  if (v.length < 8) return 'needs at least 8 characters (Google\'s rule).';
  if (v.length > 100) return 'can have at most 100 characters (Google\'s rule).';
  if (!/^[\x20-\x7E]+$/.test(v)) return 'can use only plain letters (no accents), digits, spaces and the signs on an English keyboard (Google\'s rule).';
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'needs at least a letter and a digit.';
  return null;
}
async function setFirstPassword(b: Row, by: string): Promise<Response> {
  const problem = passwordProblem(b.password);
  if (problem) return no('bad_password', 'The first password ' + problem + ' Nothing was changed.', 400);
  const { error } = await svc.rpc('wa_vault_set', { p_name: 'ONBOARD_FIRST_PASSWORD', p_value: b.password, p_note: 'The first password of new Google accounts (wave275 onboarding), set in the Hub by ' + by + '.' });
  if (error) return no('save', 'The first password could not be saved: ' + scrub(String(error.message), b.password).slice(0, 200) + '. Nothing was changed.', 500);
  const now = new Date().toISOString();
  await log('app_setting', 'ONBOARD_FIRST_PASSWORD', 'first password', null, 'set', by);
  const { error: atErr } = await svc.from('app_config').upsert({ key: PW_AT, value: now, updated_at: now }, { onConflict: 'key' });
  return json({ ok: true, set: true, set_at: now, ...(atErr ? { warnings: ['The first password is set, but the Hub could not record when, so the card may say it is not set. Set it again to fix that.'] } : {}) });
}
async function firstPasswordState(): Promise<Response> {
  const ms = Date.parse((await cfg(PW_AT)).trim());
  return json(Number.isNaN(ms) ? { set: false, set_at: null } : { set: true, set_at: new Date(ms).toISOString() });
}

/* before Start: is this manager someone other than the one who got the grid link? Their marks are not this manager's, and any reminder was not for them */
async function linkHolder(flowId: number): Promise<{ id: unknown } | { error: string }> {
  const { data, error } = await svc.from('hub_onboard_flows').select('manager_link_member_id').eq('id', flowId).maybeSingle();
  if (error) return { error: error.message };
  return { id: (data as Row | null)?.manager_link_member_id ?? null };
}
const clearManagerGrid = (flowId: number) => svc.from('hub_onboard_grids').update({ slots: [], updated_at: new Date().toISOString() }).eq('flow_id', flowId).eq('who', 'manager');

async function setManager(b: Row): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', BACKED_OUT_NOW);
  if (!BEFORE_START.includes(f.status)) return no('already_started', 'Onboarding has already been started for this person. Use Change manager on their card.');
  const id = Number(b.member_id);
  const m = b.member_id != null && b.member_id !== '' && Number.isInteger(id) ? await getMember(id) : null;
  if (!m) return no('no_manager', 'Choose a manager who is on the roster first.', 400);
  if (m.active === false) return no('no_manager', m.name + ' is not active on the roster. Choose someone else.', 400);
  const link = await linkHolder(f.id);
  if ('error' in link) return no('save', 'The Hub could not read this flow: ' + link.error + '. Try again.', 500);
  const differs = String(link.id ?? '') !== String(m.id);
  const patch: Record<string, unknown> = { manager_member_id: m.id, updated_at: new Date().toISOString() };
  if (differs) patch.reminded_manager_at = null;
  const { data: won, error } = await svc.from('hub_onboard_flows').update(patch).eq('id', f.id).in('status', BEFORE_START).select('id');
  if (error) return no('save', 'The manager could not be saved: ' + error.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) return no('already_started', 'Onboarding has just been started for this person. Reload the page.');
  if (f.practice) return json({ ok: true, practice: true, cleared: false });
  if (differs) {
    const { error: gridError } = await clearManagerGrid(f.id);
    if (gridError) return no('save', 'The manager is saved, but the other manager\'s marks could not be cleared: ' + gridError.message + '. Choose the manager again.', 500);
  }
  return json({ ok: true, cleared: differs });
}

async function start(b: Row, by: string, asUser: Row): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (!BEFORE_START.includes(f.status)) return no('already_started', f.status === 'backed_out' ? 'This person backed out, so onboarding cannot start.' : 'Onboarding has already been started for this person.');
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  if (['declined', 'withdrawn'].includes(c.status)) return no('card_closed', 'This card is closed (' + c.status + '), so onboarding cannot start. Open the card again first if they are still joining.');
  if (!!f.practice !== !!c.practice) return no('practice_mismatch', 'The card and its onboarding flow disagree about whether this is a practice applicant, so nothing was started. Tell Steel.');
  const practice = !!(f.practice || c.practice);
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
  const canva = canvaLink(b.canva_link);
  if (canva instanceof Response) return canva;
  let claim: { owner: string | null; own: boolean }, taken: boolean;
  try {
    claim = await rosterClaim(addr, c);
    taken = (await addressState(addr, c.member_id, practice)).taken;
  } catch (_) { return no('roster_check', ROSTER_CHECK, 503); }   // fails closed: an unreadable roster never lets an address through
  if (claim.owner) return no('address_taken', onProfileOf(addr!, claim.owner));
  /* wave275: rows made at Accept are kept as they are (Start seeds only the missing ones), so an account the google step made there is this person's own */
  const had = await readSteps(f.id);
  const googleDone = had.some((r) => r.step === 'google' && met(r.status)) && !!f.wa_email && f.wa_email === addr;
  if (googleOn && taken && !googleDone) return no('address_taken', addr + ' is already in use. Change the address, or skip the Google account step.');
  /* Google skipped and Workspace has the address, on nobody's roster profile: it is someone's mailbox, so it is not stored and gets no invites */
  const keep = !googleOn && taken && !claim.own ? null : addr;
  const link = await linkHolder(f.id);
  if ('error' in link) return no('save', 'The Hub could not start this: ' + link.error + '. Try again.', 500);
  const otherManager = String(link.id ?? '') !== String(manager.id);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: 'running', manager_member_id: manager.id, wa_email: keep, call_at: callAt, one_on_one_at: oneAt, canva_link: canva.link,
    group_session: String(b.group_session ?? '').trim() || null, started_by: by, updated_at: now,
  };
  if (otherManager) patch.reminded_manager_at = null;
  /* the card's saved text: the Hub's own with the real times, or what HR edited, with any marked place they kept filled in */
  /* HR's edits are kept as typed, brackets and all, and only the part they changed: the rest stays the Hub's own and follows the template. Filled in when read. */
  const own = welcomeTemplate(c, await welcomeFacts({ ...f, ...patch }, c, by, true));
  const edited = b.welcome && typeof b.welcome === 'object' ? b.welcome : null;
  const mine = (v: unknown, base: string) => (typeof v === 'string' && v.trim() && v !== base ? v : null);
  patch.welcome_subject = mine(edited?.subject, own.subject);
  patch.welcome_text = mine(edited?.text, own.text);
  patch.welcome_edited = !!(patch.welcome_subject || patch.welcome_text);
  /* the claim: of two presses, only one finds the flow still waiting or ready */
  const { data: won, error } = await svc.from('hub_onboard_flows').update(patch).eq('id', f.id).in('status', ['waiting', 'ready']).select(FLOW_COLS);
  if (error) return no('save', 'The Hub could not start this: ' + error.message + '. Try again.', 500);
  const flow = (won as Row[] | null)?.[0];
  if (!flow) return no('already_started', 'Onboarding has already been started for this person.');
  if (otherManager && !practice) await clearManagerGrid(f.id);   // best effort: Book the 1-on-1 still shows who marked what
  const have = new Set(had.map((r) => r.step));
  const seed = STEPS.filter((s) => !have.has(s.key)).map((s) => ({ flow_id: f.id, step: s.key, status: skip.includes(s.key) ? 'skipped' : 'pending', detail: skip.includes(s.key) ? 'Skipped by HR in the preview.' : null, practice, at: now, by }));
  const { error: seedError } = seed.length ? await svc.from('hub_onboard_steps').upsert(seed, { onConflict: 'flow_id,step' }) : { error: null };
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
  const row = (await readSteps(f.id)).find((r) => r.step === s.key);   // wave275: a step made at Accept can be retried before the times are booked
  if (!row || ![...AFTER_START, ...BEFORE_START].includes(f.status)) return no('not_started', 'Onboarding has not been started for this person, so there is nothing to retry.');
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
  const row = (await readSteps(f.id)).find((r) => r.step === 'google');   // wave275: the account step made at Accept is HR's before the times are booked too
  if (!AFTER_START.includes(f.status) && !(BEFORE_START.includes(f.status) && row)) return no('not_started', 'Press Start onboarding first.');
  if (row?.status === 'done') return no('already_done', 'The Google account step is already done.');
  const open = ['hr_task', 'failed', 'skipped'];
  if (!row || !open.includes(row.status)) return no('still_waiting', String(row?.detail || 'That step is not ready yet.') + ' Retry that one first.');
  const c = await getCand(f.candidate_id);
  if ((await membersByEmail(addr)).some((m) => String(m.id) !== String(c?.member_id))) return no('address_taken', addr + ' is on another roster profile. Check the address and try again.');
  const now = new Date().toISOString();
  const { error } = await svc.from('hub_onboard_flows').update({ wa_email: addr, updated_at: now }).eq('id', f.id);
  if (error) return no('save', 'The address could not be saved: ' + error.message + '. Try again.', 500);
  const practice = !!(f.practice || c?.practice);   // a simulation: its own rows only, no roster write and no Google token
  if (c?.member_id && !practice) {
    const { error: e2 } = await svc.from('team_members').update({ email: addr }).eq('id', c.member_id);
    if (e2) return no('save', 'The address could not be saved on the roster profile: ' + e2.message + '. Try again.', 500);
  }
  /* the claim: of two presses, only one finishes the step */
  const { data: won } = await svc.from('hub_onboard_steps').update({ status: 'running', at: now, by }).eq('flow_id', f.id).eq('step', 'google').in('status', open).select('step');
  if (!(won as unknown[] | null)?.length) return no('already_done', 'The Google account step is already done.');
  const ctx = await makeCtx({ ...f, wa_email: addr }, by, asUser);
  if (practice) await setStep(ctx, 'google', 'done', 'Practice: nothing real was changed by this step (Google account).');
  else await completed(ctx, stepOf('google')!, 'HR created ' + addr + ' in Google.');
  /* what was left to HR only because the account was missing can now run; an entry with no run stays with HR */
  const held = (await readSteps(f.id)).filter((r) => r.status === 'hr_task' && stepOf(r.step)?.needs.includes('google') && stepOf(r.step)?.run);
  for (const r of held) await svc.from('hub_onboard_steps').update({ status: 'waiting', at: now, by }).eq('flow_id', f.id).eq('step', r.step).eq('status', 'hr_task');
  await advance(ctx);
  return reply(f.id);
}

/* HR did a step that was left to them. google has its own button, which also records the address. */
async function taskDone(b: Row, by: string, asUser: Row): Promise<Response> {
  const s = stepOf(String(b.step));
  if (!s) return no('bad_step', 'The Hub does not know that step. Reload the page.', 400);
  if (s.key === 'google') return no('use_google_manual', 'Use "I created it, continue" for the Google account: it also records the address.', 400);
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', BACKED_OUT_NOW);
  if (![...AFTER_START, ...BEFORE_START].includes(f.status)) return no('not_started', 'Onboarding has not been started for this person, so there is nothing to mark done.');   // wave275: before booking, a step made at Accept
  /* the claim: of two presses, only one finds the step still with HR (no row: not_hr_task) */
  const now = new Date().toISOString();
  const { data: won, error } = await svc.from('hub_onboard_steps').update({ status: 'done', detail: 'Done by ' + by + '.', at: now, by }).eq('flow_id', f.id).eq('step', s.key).eq('status', 'hr_task').select('step');
  if (error) return no('save', 'The Hub could not save this: ' + error.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) return no('not_hr_task', 'That step is not waiting on HR. Reload the page.');
  const ctx = await makeCtx(f, by, asUser);
  await tickSetup(ctx);
  await finish(ctx);
  return reply(f.id);
}

/* a Canva link HR pasted: empty is allowed, anything else must be a plain www.canva.com address */
function canvaLink(v: unknown): { link: string | null } | Response {
  const link = String(v ?? '').trim();
  if (!link) return { link: null };
  if (!/^https:\/\/www\.canva\.com\/\S*$/.test(link)) return no('bad_canva_link', 'The Canva link must start with https://www.canva.com/. Copy it from Invite people in Canva, or leave it empty.', 400);
  return { link };
}
async function setCanvaLink(b: Row, by: string): Promise<Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', BACKED_OUT_NOW);
  const c = canvaLink(b.link);
  if (c instanceof Response) return c;
  const { data: won, error } = await svc.from('hub_onboard_flows').update({ canva_link: c.link, updated_at: new Date().toISOString() }).eq('id', f.id).neq('status', 'backed_out').select('id');
  if (error) return no('save', 'The Canva link could not be saved: ' + error.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) return no('backed_out', BACKED_OUT_NOW);
  return json({ ok: true, canva_link: c.link });
}

/* ---------- changes after Start ---------- */
/* These need a flow that Start has begun (running, or started once nothing is left for HR), except backed_out, which also takes one that has not. Each claims its change
   with a conditional update, so a double press changes it once, and gives the claim back if Google refuses. A practice flow changes its own row and nothing else: no Calendar, no notify. */
const AFTER_START = ['running', 'started'];
const BEFORE_START = ['waiting', 'ready'];
const BACKED_OUT_NOW = 'This person backed out, so their onboarding cannot be changed.';
async function openFlow(b: Row, allowed: string[] = AFTER_START): Promise<{ f: Row; c: Row } | Response> {
  const f = await getFlow(b.flow_id);
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  if (f.status === 'backed_out') return no('backed_out', BACKED_OUT_NOW);
  if (!allowed.includes(f.status)) return no('not_started', 'Onboarding has not been started for this person yet. Press Start onboarding first.');
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
  let t = '', invite: Invite = { to: [], prefix: '', live: true };
  if (!f.practice && eventId) {   // who the invite goes to is worked out first: in mail test mode that is the test inboxes
    try {
      t = await calToken();
      invite = await inviteList(await makeCtx(f, by, asUser), c, kind);
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
  /* no plan yet (its step failed) but the roster step has set day one on the profile and the card: those follow the call too, and go back if it does not move */
  let dates: { member: Row | null } | null = null;
  const day = torontoDate(when.at);
  if (kind === 'call' && !f.onboarding_id && c.member_id && (await readSteps(f.id)).find((r) => r.step === 'roster')?.status === 'done') {
    const { data: member } = await svc.from('team_members').select('start_date, start_source').eq('id', c.member_id).maybeSingle();
    dates = { member };
    const first = await svc.from('team_members').update({ start_date: day, start_source: 'manual' }).eq('id', c.member_id);
    const second = first.error ? first : await svc.from('hub_candidates').update({ start_date: day, updated_at: new Date().toISOString(), updated_by: by }).eq('id', c.id);
    if (first.error || second.error) {
      await restoreDates(c, dates, by);
      await back();
      return no('save', 'The start date on the roster profile or the card could not move: ' + (first.error || second.error)!.message + '. The onboarding call was not changed.', 500);
    }
  }
  const undo = async () => {
    await back();
    if (movePlan) await svc.rpc('wa271_move_start', { p_onboarding: f.onboarding_id, p_new: torontoDate(old) });
    if (dates) await restoreDates(c, dates, by);
  };
  const warnings: string[] = [];
  if (eventId) {
    const minutes = kind === 'call' ? await cfgNum('onboard_call_min', 60) : await cfgNum('onboard_one_on_one_min', 30);
    const out = await patchEvent(t, eventId, {
      status: 'confirmed', start: { dateTime: new Date(when.at).toISOString(), timeZone: TZ }, end: { dateTime: new Date(Date.parse(when.at) + minutes * 60000).toISOString(), timeZone: TZ }, attendees: invite.to.map((email) => ({ email })),
    });
    if (!out.ok && (out.status === 404 || out.status === 410)) {   // the event was deleted in Calendar: HR can still set the time, so book it again at the new one
      try {
        await bookEvent(await makeCtx({ ...f, [col]: when.at }, by, asUser), t, c, kind, invite);
        warnings.push('The ' + word + ' invite had been deleted from Calendar, so a new one was sent for the new time.');
      } catch (e) {
        await undo();
        return no('google', errText(e).replace(/\s*Press Retry\.$/, '') + ' The ' + word + ' was not changed.', 502);
      }
    } else if (!out.ok) {
      await undo();
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
      : 'Your 1-on-1 with ' + c.name + ' moved to ' + whenText(when.at) + ' (it was ' + whenText(old) + '). ' + (eventId ? 'The invite is updated.' : 'The invite has not gone out yet.'),
    'onboard-move-' + f.id + '-' + kind + '-' + Date.now(),
  );
  if (told) warnings.push(told);
  return json({ ok: true, which, at: when.at, warnings });
}

async function restoreDates(c: Row, d: { member: Row | null }, by: string): Promise<void> {   // best effort: puts back what the call move changed on the profile and the card
  await svc.from('team_members').update({ start_date: d.member?.start_date ?? null, start_source: d.member?.start_source ?? null }).eq('id', c.member_id);
  await svc.from('hub_candidates').update({ start_date: c.start_date ?? null, updated_at: new Date().toISOString(), updated_by: by }).eq('id', c.id);
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
      + (f.one_on_one_at ? ' Your 1-on-1 is ' + whenText(f.one_on_one_at) + '. ' + (booked ? 'The invite is in your calendar.' : 'The invite has not gone out yet.') : ' You will get a link to mark when you are free for the 1-on-1.'),
    'onboard-manager-new-' + stamp,
  );
  if (toNew) warnings.push(toNew);
  else await svc.from('hub_onboard_steps').update({ detail: 'Told ' + m.name + ' the date and time, after the manager changed' + (old ? ' from ' + old.name : '') + '.', at: new Date().toISOString(), by }).eq('flow_id', f.id).eq('step', 'manager').eq('status', 'done');
  if (old) {
    const toOld = await tellManager(
      old, c.name + ' has a different manager',
      first + ' now has ' + m.name + ' as their manager for onboarding.' + (booked ? ' Your 1-on-1 with them is cancelled.' : ''),
      'onboard-manager-old-' + stamp,
    );
    if (toOld) warnings.push(toOld);
  }
  return json({ ok: true, manager: { member_id: m.id, name: m.name }, warnings });
}

async function backedOut(b: Row, by: string, _asUser: Row): Promise<Response> {
  const open = [...BEFORE_START, ...AFTER_START];
  const o = await openFlow(b, open);
  if (o instanceof Response) return o;
  const { f, c } = o;
  const said = String(b.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const closeReason = 'Backed out after accepting' + (said ? ': ' + said : '');
  const events = (['call', 'one'] as Kind[]).filter((k) => f[COLUMN[k]]);
  let t = '';
  if (!f.practice && events.length) {
    try { t = await calToken(); } catch (e) { return no('google', errText(e) + ' The onboarding is still open.', 502); }
  }
  /* the claim: of two presses, only one finds the flow still open */
  const now = new Date().toISOString();
  const { data: won, error } = await svc.from('hub_onboard_flows').update({ status: 'backed_out', updated_at: now }).eq('id', f.id).in('status', open).select('id');
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
  else await log('candidate', c.id, 'status', c.status, 'withdrawn (backed out ' + (AFTER_START.includes(f.status) ? 'after' : 'before') + ' Start onboarding)', by);

  /* nothing is taken out of Google, Slack or the Hub here: HR does that, and this names only what this flow made */
  const status = new Map((await readSteps(f.id)).map((r) => [r.step, r.status]));
  const remove: string[] = [];
  if (status.get('google') === 'done' && f.wa_email) remove.push('Google account ' + f.wa_email + ': suspend or delete it in Google Admin.');
  if (status.get('roster') === 'done' && c.member_id) remove.push('Roster profile' + (f.wa_email ? ' (' + f.wa_email + ')' : '') + (f.roster_created ? ': Created for this person. Deactivate it by hand in Roster.' : ': Already on the roster before. Check whether it should stay.'));
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


/* ---------- wave275: propose and hire_times ---------- */
/* The proposal rules live here once: the mgr link (onboard-link) relays to propose with the trigger secret and by 'manager'; the card calls it signed in.
   A time is checked as an instant; the Toronto wall clock (date, weekday, minutes) comes from Intl, never from an offset. */
const DEFAULT_AVAILABILITY = { weekly: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']] }, except: [], tz: TZ };
const WALL = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function wall(ms: number): { date: string; wd: string; min: number } {
  const p: Record<string, string> = {};
  for (const x of WALL.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = x.value;
  return { date: p.year + '-' + p.month + '-' + p.day, wd: String(p.weekday).toLowerCase().slice(0, 3), min: Number(p.hour) * 60 + Number(p.minute) };
}
const hm = (s: unknown) => { const m = /^(\d{2}):(\d{2})$/.exec(String(s)); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
/* the blocks for one Toronto date: an except entry for the date replaces the weekday's (empty free: not available that day) */
function blocksOn(av: Row, date: string, wd: string): Array<[string, string]> {
  const ex = Array.isArray(av?.except) ? av.except.find((e: Row) => e && e.date === date) : null;
  const list = ex ? ex.free : av?.weekly?.[wd];
  return Array.isArray(list) ? list : [];
}
/* the whole span [start, end) inside one block of that day */
function insideHours(av: Row, start: number, end: number): boolean {
  const a = wall(start), b = wall(end);
  if (a.date !== b.date) return false;   // a meeting that crosses midnight is never inside one day's block
  return blocksOn(av, a.date, a.wd).some((blk) => Array.isArray(blk) && hm(blk[0]) <= a.min && b.min <= hm(blk[1]));
}
const clash = (s1: number, e1: number, s2: number, e2: number) => s1 < e2 && s2 < e1;
type Which = 'call' | 'one_on_one';
const PROPOSE_COLS = FLOW_COLS + ', manager_link_member_id, proposed_call_at, proposed_one_on_one_at, proposed_by, proposed_at, hire_answer, setup_ticks';
const MEETING = { call: { en: 'The onboarding call', fr: 'L’appel d’accueil' }, one_on_one: { en: 'The 1-on-1', fr: 'La rencontre individuelle' } };
function proposeWords(code: string, which?: Which, n?: number, name = ''): { en: string; fr: string } {
  const w = which ? MEETING[which] : { en: '', fr: '' };
  switch (code) {
    case 'manager_no_email': return { en: name + ' has no email on the roster, so the Hub cannot check their calendar. Add it on their roster profile, then try again.', fr: name + ' n’a pas de courriel au répertoire, alors le Hub ne peut pas vérifier son agenda. Ajoutez-le à son profil, puis réessayez.' };
    case 'manager_inactive': return { en: name + ' is no longer active on the roster, so times cannot be proposed for them. Change the manager on the card first.', fr: name + ' n’est plus actif au répertoire: aucune heure ne peut être proposée en son nom. Changez d’abord le gestionnaire sur la fiche.' };
    case 'bad_time': return { en: 'Pick a time for the onboarding call and for the 1-on-1 first.', fr: 'Choisissez d’abord une heure pour l’appel d’accueil et pour la rencontre individuelle.' };
    case 'lead_time': return { en: w.en + ' must be at least ' + n + ' hours from now. Pick a later time.', fr: w.fr + ' doit être au moins ' + n + ' heures plus tard. Choisissez une heure plus tardive.' };
    case 'overlap': return { en: 'The onboarding call and the 1-on-1 overlap. Pick times that do not.', fr: 'L’appel d’accueil et la rencontre individuelle se chevauchent. Choisissez des heures distinctes.' };
    case 'outside_hours': return { en: w.en + ' is outside the manager\'s availability for that day. Pick a time inside it, or change the availability first.', fr: w.fr + ' est en dehors des disponibilités du gestionnaire ce jour-là. Choisissez une heure comprise dedans, ou modifiez d’abord les disponibilités.' };
    case 'busy': return { en: w.en + ' clashes with a hub@ meeting the manager is invited to. Pick another time.', fr: w.fr + ' tombe en même temps qu’une rencontre hub@ à laquelle le gestionnaire est invité. Choisissez une autre heure.' };
    case 'taken': return { en: w.en + ' clashes with times already booked or proposed for another new hire of the same manager. Pick another time.', fr: w.fr + ' tombe en même temps que des heures déjà fixées ou proposées pour une autre nouvelle recrue du même gestionnaire. Choisissez une autre heure.' };
    case 'already_booked': return { en: 'The onboarding call is already booked, so new times cannot be proposed here. Change them from the card in Onboarding.', fr: 'L’appel d’accueil est déjà fixé: de nouvelles heures ne peuvent pas être proposées ici. Modifiez-les depuis la fiche dans Accueil.' };
    case 'closed': return { en: 'This card is closed, so no times can be proposed.', fr: 'Cette fiche est fermée: aucune heure ne peut être proposée.' };
    case 'no_manager': return { en: 'This new hire has no onboarding manager yet. Set the manager on the card first.', fr: 'Cette nouvelle recrue n’a pas encore de gestionnaire d’accueil. Indiquez d’abord le gestionnaire sur la fiche.' };
    case 'changed': return { en: 'Someone else just proposed other times. Reload the page to see them.', fr: 'Quelqu’un vient de proposer d’autres heures. Rechargez la page pour les voir.' };
    case 'no_proposal': return { en: 'No times have been proposed yet, so there is nothing to book.', fr: 'Aucune heure n’a encore été proposée: il n’y a rien à fixer.' };
    case 'answered': return { en: 'These times were already answered, so they cannot be booked this way. A person from Welfare Avenue will be in touch.', fr: 'Ces heures ont déjà reçu une réponse: elles ne peuvent pas être fixées ainsi. Une personne de Welfare Avenue communiquera avec vous.' };
    case 'not_accepted': return { en: 'The offer has not been accepted yet, so nothing can be booked.', fr: 'L’offre n’a pas encore été acceptée: rien ne peut être fixé.' };
    case 'bad_by': return { en: 'The Hub does not know who is booking these times. Reload the page.', fr: 'Le Hub ne sait pas qui fixe ces heures. Rechargez la page.' };
    default: return { en: 'The times could not be saved. Try again.', fr: 'Les heures n’ont pas pu être enregistrées. Réessayez.' };
  }
}
/* a refusal: message (English, as every onboard-run refusal) and messages {en, fr} for the mgr link's page; which names the meeting */
function refuse(code: string, status = 409, which?: Which, n?: number, name?: string): Response {
  const messages = proposeWords(code, which, n, name);
  return json({ error: code, message: messages.en, messages, ...(which ? { which } : {}) }, status);
}
const sameInstant = (a: unknown, b: unknown) => a != null && b != null && Date.parse(String(a)) === Date.parse(String(b));
/* a time with its zone written (Z or +hh:mm): '2026-11-04T10:00' alone would be read in the server's own zone */
const zoned = (v: unknown) => typeof v === 'string' && /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(v.trim());
const CLOSED_CARD = ['declined', 'withdrawn'];

/* the other flows of this manager: their booked and proposed times, each as [start, end). Backed-out flows and closed cards do not count. */
async function takenTimes(flowId: number, managerId: number, callMin: number, oneMin: number): Promise<Array<[number, number]>> {
  const { data, error } = await svc.from('hub_onboard_flows').select('id, candidate_id, status, manager_member_id, manager_link_member_id, call_at, one_on_one_at, proposed_call_at, proposed_one_on_one_at, hire_answer')
    .or('manager_member_id.eq.' + managerId + ',manager_link_member_id.eq.' + managerId);
  if (error) throw new Error('The other new hires\' times could not be read.');
  const rows = ((data || []) as Row[]).filter((f) => Number(f.id) !== flowId && f.status !== 'backed_out' && Number(f.manager_member_id ?? f.manager_link_member_id) === managerId);
  if (!rows.length) return [];
  const { data: cs, error: cErr } = await svc.from('hub_candidates').select('id, status').in('id', rows.map((f) => f.candidate_id));
  if (cErr) throw new Error('The other new hires\' times could not be read.');
  const closed = new Set(((cs || []) as Row[]).filter((c) => CLOSED_CARD.includes(c.status)).map((c) => String(c.id)));
  const out: Array<[number, number]> = [];
  for (const f of rows) {
    if (closed.has(String(f.candidate_id))) continue;
    for (const [col, len] of [['call_at', callMin], ['proposed_call_at', callMin], ['one_on_one_at', oneMin], ['proposed_one_on_one_at', oneMin]] as Array<[string, number]>) {
      if (col.startsWith('proposed_') && f.hire_answer) continue;   // a proposal the hire has answered is spent: a yes is booked (call_at), a no is dead
      const at = f[col] ? Date.parse(String(f[col])) : NaN;
      if (!Number.isNaN(at)) out.push([at, at + len * 60000]);
    }
  }
  return out;
}

const spansOf = (callAt: string, oneAt: string, callMin: number, oneMin: number): Array<[Which, number, number]> =>
  [['call', Date.parse(callAt), Date.parse(callAt) + callMin * 60000], ['one_on_one', Date.parse(oneAt), Date.parse(oneAt) + oneMin * 60000]];
/* the manager's availability, read only through wa275_availability_of (amended 02/11/26, Steel: the week is wave276's typical week, saved on Home, and the
   one-off dates stay on the roster row; the function joins them, with Monday to Friday 9 to 5 when no week is saved). A read that fails throws. */
async function availabilityOf(memberId: number): Promise<Row> {
  const { data, error } = await svc.rpc('wa275_availability_of', { p_member: memberId });
  if (error || !data || typeof data !== 'object') throw new Error('The manager\'s availability could not be read' + (error ? ' (' + error.message + ')' : '') + '.');
  return data as Row;
}
/* the rules both times must meet, kept once for propose and for the hire's Yes (book), in this order: at least lead hours ahead; each whole meeting inside
   one block of the manager's availability for that Toronto date; clear of hub@ meetings they are invited to; clear of their other new hires' times.
   null: both fine. A read that fails throws, so nothing is saved or booked on a guess. */
async function timesProblem(flowId: number, m: Row, spans: Array<[Which, number, number]>, lead: number, callMin: number, oneMin: number): Promise<{ code: string; which: Which } | null> {
  for (const [which, s] of spans) if (s < Date.now() + lead * 3600000) return { code: 'lead_time', which };
  const read = await availabilityOf(Number(m.id));
  const av = read.availability && typeof read.availability === 'object' ? read.availability : DEFAULT_AVAILABILITY;
  for (const [which, s, e] of spans) if (!insideHours(av, s, e)) return { code: 'outside_hours', which };
  const from = Math.min(spans[0][1], spans[1][1]), to = Math.max(spans[0][2], spans[1][2]);
  const { data: evs, error } = await svc.from('hub_events').select('id, start_at, end_at').contains('attendee_emails', [String(m.email || '').trim().toLowerCase()]).neq('status', 'cancelled').lt('start_at', new Date(to).toISOString()).gt('end_at', new Date(from).toISOString());
  if (error) throw new Error('The manager\'s hub@ meetings could not be read.');
  for (const [which, s, e] of spans) if (((evs || []) as Row[]).some((ev) => clash(s, e, Date.parse(ev.start_at), Date.parse(ev.end_at)))) return { code: 'busy', which };
  const taken = await takenTimes(flowId, Number(m.id), callMin, oneMin);
  for (const [which, s, e] of spans) if (taken.some(([ts, te]) => clash(s, e, ts, te))) return { code: 'taken', which };
  return null;
}

/* propose {flow_id, call_at, one_on_one_at, by}: link is true for the trigger secret (by 'manager'), when the proposer is the manager themselves */
async function propose(b: Row, caller: string, link: boolean): Promise<Response> {
  const n = Number(b.flow_id);
  const { data: f } = Number.isInteger(n) ? await svc.from('hub_onboard_flows').select(PROPOSE_COLS).eq('id', n).maybeSingle() : { data: null };
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  if (f.status === 'backed_out' || CLOSED_CARD.includes(c.status)) return refuse('closed');
  if (f.hire_answer === 'yes' || f.call_at) return refuse('already_booked');
  const callAt = instant(b.call_at), oneAt = instant(b.one_on_one_at);
  if (!callAt || !oneAt || !zoned(b.call_at) || !zoned(b.one_on_one_at)) return refuse('bad_time', 400);
  const managerId = f.manager_member_id ?? f.manager_link_member_id;
  const { data: m } = managerId != null ? await svc.from('team_members').select('id, name, email, active').eq('id', Number(managerId)).maybeSingle() : { data: null };
  if (!m) return refuse('no_manager');
  if (m.active === false) return refuse('manager_inactive', 409, undefined, undefined, String(m.name || 'The manager'));
  const mEmail = String(m.email || '').trim().toLowerCase();
  if (!mEmail) return refuse('manager_no_email', 409, undefined, undefined, String(m.name || 'The manager'));   // never skip the hub@ check in silence
  const by = link ? (mEmail || 'manager (mgr link)') : caller;
  const [callMin, oneMin, lead] = [await cfgNum('onboard_call_min', 60), await cfgNum('onboard_one_on_one_min', 30), await cfgNum('onboard_propose_lead_hours', 48)];
  const spans = spansOf(callAt, oneAt, callMin, oneMin);
  if (clash(spans[0][1], spans[0][2], spans[1][1], spans[1][2])) return refuse('overlap');
  let problem: { code: string; which: Which } | null;
  try { problem = await timesProblem(Number(f.id), m, spans, lead, callMin, oneMin); } catch (e) { return no('failed', errText(e) + ' Nothing was saved. Try again.', 503); }
  if (problem) return refuse(problem.code, 409, problem.which, lead);

  const proposal = (row: Row) => ({ call_at: instant(row.proposed_call_at), one_on_one_at: instant(row.proposed_one_on_one_at), by: row.proposed_by, at: instant(row.proposed_at) });
  const sameAsSaved = (row: Row) => !!row.proposed_at && sameInstant(row.proposed_call_at, callAt) && sameInstant(row.proposed_one_on_one_at, oneAt) && String(row.proposed_by || '') === by;
  if (sameAsSaved(f)) return json({ ok: true, repeated: true, proposal: proposal(f), hire_emailed: !!f.setup_ticks?.hire_times_at && Date.parse(f.setup_ticks.hire_times_at) >= Date.parse(f.proposed_at), warnings: [] });
  /* the claim: only the press that finds the proposal as it was read writes it, so a double press or a second tab saves (and tells) once */
  const at = new Date().toISOString();
  /* new times after a no: the answer is cleared (hire_answered_at stays, so a second no goes to a person), and hire_times emails the hire again below */
  let claim = svc.from('hub_onboard_flows').update({ proposed_call_at: callAt, proposed_one_on_one_at: oneAt, proposed_by: by, proposed_at: at, hire_answer: null, updated_at: at }).eq('id', f.id).is('call_at', null).or('hire_answer.is.null,hire_answer.eq.no');
  claim = f.proposed_at ? claim.eq('proposed_at', f.proposed_at) : claim.is('proposed_at', null);
  const { data: won, error: wErr } = await claim.select('id');
  if (wErr) return no('save', 'The times could not be saved: ' + wErr.message + '. Try again.', 500);
  if (!(won as unknown[] | null)?.length) {
    const { data: now } = await svc.from('hub_onboard_flows').select(PROPOSE_COLS).eq('id', f.id).maybeSingle();
    if (now && sameAsSaved(now)) return json({ ok: true, repeated: true, proposal: proposal(now), hire_emailed: false, warnings: [] });
    if (now && (now.hire_answer === 'yes' || now.call_at)) return refuse('already_booked');
    return refuse('changed');
  }
  await log('onboard_flow', f.id, 'proposed_times', f.proposed_at ? f.proposed_call_at + ' / ' + f.proposed_one_on_one_at : null, callAt + ' / ' + oneAt, by);
  const saved = { call_at: callAt, one_on_one_at: oneAt, by, at };
  const warnings: string[] = [];
  /* new times: the record of the last email to the hire is cleared (merged, one key), so hire_times can claim the send for these */
  const { error: clearErr } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'hire_times_at', p_value: null });
  /* and the mark of a second No to the last times: these are new, so the hire answers them (a No to them is refused and told again, once) */
  const { error: againErr } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'no_again_at', p_value: null });
  if (againErr) warnings.push('The record of ' + firstName(c.name) + '\'s second no could not be cleared (' + againErr.message + '), so their link may still say a person will be in touch.');
  if (clearErr) warnings.push('The record of the last email to ' + firstName(c.name) + ' could not be cleared (' + clearErr.message + '), so they were not emailed these times. Send them from the card.');
  if (f.practice || c.practice) return json({ ok: true, repeated: false, practice: true, proposal: saved, hire_emailed: false, warnings });

  /* HR hears through onboard_answer (onboard_propose is the manager's own kind) */
  const hr = (await cfg('hr_notify_emails')).split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x));
  const proposer = by === mEmail ? String(m.name || by) : (await membersByEmail(by).catch(() => []))[0]?.name || by;
  const title = proposer + ' proposed times for ' + c.name;
  const said = 'the onboarding call on ' + whenText(callAt) + ' and the 1-on-1 on ' + whenText(oneAt) + '. ' + (c.accepted_on ? firstName(c.name) + ' is being emailed them to say yes or no.' : 'They go to ' + firstName(c.name) + ' once the offer is accepted.');
  if (!hr.length) warnings.push('HR was not told: hr_notify_emails is empty.');
  else {
    const told = await tell({
      event: 'onboard_answer', to: hr, url: '#hrcentre/onboarding', tag: 'onboard-propose-' + f.id,
      title, body: title + ' (' + (c.role || 'new hire') + '): ' + said,
      text: ':calendar: ' + slackEsc(proposer) + ' proposed times for *' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + '): ' + slackEsc(said) + ' <' + HUB + '/#hrcentre/onboarding|Open Onboarding>',
    });
    if (!told.handled) warnings.push('HR was not told: ' + (told.note || 'notify gave no answer') + '.');
  }
  /* always asked, after the claim: hireTimes reads the card again, so a hire who accepts while this runs is still emailed; not yet accepted is a quiet no */
  let emailed = false;
  if (!clearErr) {
    const sent = await hireTimes(f.id, by);
    if ('error' in sent) { if (sent.code !== 'not_accepted') warnings.push(firstName(c.name) + ' was not emailed the times: ' + sent.error); }
    else emailed = !sent.skipped;
  }
  return json({ ok: true, repeated: false, proposal: saved, hire_emailed: emailed, warnings });
}

/* the email that asks the hire yes or no (Task 3 writes its words): the /o/ offer link. Once per proposal: setup_ticks.hire_times_at at or after proposed_at means sent. */
function timesMail(first: string, link: string, fr: boolean): { subject: string; text: string; html: string } {
  const c = fr
    ? { subject: 'Vos heures d’accueil à Welfare Avenue', hi: 'Bonjour ' + first + ',', body: 'Nous avons proposé une heure pour votre appel d’accueil et pour votre rencontre individuelle avec votre gestionnaire. Dites-nous si elles vous conviennent.', button: 'Voir les heures', end: 'Au plaisir,' }
    : { subject: 'Your onboarding times at Welfare Avenue', hi: 'Hi ' + first + ',', body: 'We have proposed a time for your onboarding call and for your 1-on-1 with your manager. Please tell us whether they work for you.', button: 'See the times', end: 'Warmly,' };
  return {
    subject: c.subject,
    text: c.hi + '\n\n' + c.body + '\n\n' + c.button + ': ' + link + '\n\n' + c.end + '\nWelfare Avenue',
    html: '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#FFFAF2;font-family:Helvetica,Arial,sans-serif;color:#1F201E;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid rgba(16,63,57,.10);padding:28px 32px;font-size:15px;line-height:1.55;">' +
      '<p style="margin:0 0 14px;">' + esc(c.hi) + '</p><p style="margin:0 0 22px;">' + esc(c.body) + '</p>' +
      '<p style="margin:0 0 22px;"><a href="' + esc(link) + '" style="display:inline-block;background:#103F39;color:#FFFAF2;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;">' + esc(c.button) + '</a></p>' +
      '<p style="margin:0;font-size:13px;color:#5c6b66;word-break:break-all;">' + esc(link) + '</p><p style="margin:18px 0 0;">' + esc(c.end) + '<br>Welfare Avenue</p></div></body></html>',
  };
}
async function hireTimes(flowId: unknown, replyTo?: string): Promise<{ ok: true; skipped?: string; practice?: boolean; mode?: string; to?: string[] } | { error: string; code: string }> {
  const n = Number(flowId);
  const { data: f } = Number.isInteger(n) ? await svc.from('hub_onboard_flows').select(PROPOSE_COLS).eq('id', n).maybeSingle() : { data: null };
  if (!f) return { code: 'not_found', error: 'That onboarding flow is gone.' };
  const c = await getCand(f.candidate_id);
  if (!c) return { code: 'not_found', error: 'The candidate card is gone.' };
  if (f.status === 'backed_out' || CLOSED_CARD.includes(c.status)) return { code: 'closed', error: 'The card is closed.' };
  if (!f.proposed_call_at || !f.proposed_one_on_one_at || !f.proposed_at) return { code: 'no_proposal', error: 'No times have been proposed yet.' };
  if (!c.accepted_on) return { code: 'not_accepted', error: 'The offer has not been accepted yet.' };
  if (f.setup_ticks?.hire_times_at) return { ok: true, skipped: 'already_sent' };   // propose clears it for new times
  const practice = !!(f.practice || c.practice);
  const to = String(c.email || '').trim().toLowerCase();
  if (!practice && !to) return { code: 'no_email', error: 'The card has no personal email. Add it, then send the times from the card.' };
  /* the claim: wa275_tick_set writes hire_times_at only while it is empty (one key, merged), so two calls at once send once */
  const { data: won, error: claimErr } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'hire_times_at', p_value: new Date().toISOString(), p_if_unset: true });
  if (claimErr) return { code: 'tick_failed', error: 'the send could not be recorded, so nothing was sent (' + claimErr.message + '). Try again.' };
  if (won !== true) return { ok: true, skipped: 'already_sent' };
  if (practice) return { ok: true, practice: true };
  try {
    const sent = await deliver({ practice: false, to, ...timesMail(firstName(c.name), HUB + '/o/' + await offerToken(c.id), langOf(c) === 'fr'), ...(replyTo && /@/.test(replyTo) ? { replyTo } : {}) });
    return { ok: true, mode: sent.mode, to: sent.to };
  } catch (e) {
    const { error: back } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'hire_times_at', p_value: null });   // give the claim back so a retry can send
    return { code: 'not_sent', error: errText(e) + (back ? ' The Hub also could not clear its record of the send (' + back.message + '), so a retry will think it went: tell Steel.' : '') };
  }
}
async function hireTimesNow(b: Row): Promise<Response> {
  const r = await hireTimes(b.flow_id);
  if ('error' in r) return no(r.code, r.error, r.code === 'not_found' ? 404 : r.code === 'not_sent' ? 502 : r.code === 'tick_failed' ? 500 : 409);
  return json(r);
}

/* ---------- wave275 Task 5: ask_manager {flow_id} ---------- */
/* The offer has gone out, so the onboarding manager is asked for the call and the 1-on-1: their mgr link by a Slack DM (notify onboard_propose) and an email
   from hub@. Words for staff, in English. The flow records who holds the link (manager_link_member_id), which onboard-link checks before it lets the link write. */
const ASK_COLS = PROPOSE_COLS + ', created_at, manager_link_sent_at, reminded_manager_at';
const ASKABLE = ['offered', 'waiting'];
const HR_TOLD = 'propose_hr_reminded_at';   // setup_ticks: HR told once that nothing was proposed (not a rundown tick)
const NO_MANAGER_TOLD = 'no_manager_told_at';   // setup_ticks: HR told once that the hire has no active onboarding manager with an email (not a rundown tick)
const liveProposal = (f: Row) => !!f.proposed_at && !f.hire_answer;
/* the propose path, as onboard-link's modeOf: offered or a proposal, or created on or after onboard_v2_since (NaN: unset, so only the first two) */
const proposeMode = (f: Row, since: number) => f.status === 'offered' || !!f.proposed_at || (!Number.isNaN(since) && !!f.created_at && Date.parse(String(f.created_at)) >= since);
const v2Since = async () => Date.parse((await cfg('onboard_v2_since')).trim());
/* the manager: the one chosen, else the one the Hub can tell for the position (as remind always did) */
async function managerFor(f: Row, c: Row): Promise<Row | null> {
  let id = f.manager_member_id;
  if (id == null) { const { data } = await svc.rpc('wa271_default_manager', { p_candidate: c.id }); id = (data as Row | null)?.member_id ?? null; }
  return id != null ? await getMember(id) : null;
}
/* a flow that is not asked, with the reason; null: ask */
function notAsked(f: Row, c: Row, since: number): { skipped: string; reason: string } | null {
  if (f.status === 'backed_out' || CLOSED_CARD.includes(c.status)) return { skipped: 'closed', reason: 'This card is closed, so the manager was not asked for times.' };
  if (f.call_at || ['running', 'started'].includes(f.status)) return { skipped: 'not_open', reason: 'The times for this new hire are already booked, so the manager was not asked again.' };
  if (!ASKABLE.includes(f.status)) return { skipped: 'not_open', reason: 'This onboarding is past the asking for times, so the manager was not asked.' };
  if (liveProposal(f)) return { skipped: 'proposed', reason: 'Times are already proposed for this new hire and wait for their answer, so the manager was not asked again.' };
  if (!proposeMode(f, since)) return { skipped: 'wave271', reason: 'This new hire is on the earlier onboarding path, so their manager gets the availability grid link from the hourly job instead.' };
  return null;
}
function proposeMail(m: Row, c: Row, link: string, n: { callMin: number; oneMin: number; lead: number }) {
  const hire = String(c.name || 'A new hire'), role = String(c.role || 'new hire');
  const subject = 'Propose the onboarding call and the 1-on-1 for ' + hire;
  const who = hire + ' (' + role + ') has been offered a place on the team, and you are their onboarding manager.';
  const ask = 'Please propose a time for their onboarding call (' + n.callMin + ' minutes, their first day) and for your 1-on-1 with them (' + n.oneMin + ' minutes), at least ' + n.lead + ' hours ahead.';
  const page = 'Your page shows your availability and the hub@ meetings you are invited to, so it takes a minute. ' + firstName(hire) + ' then says yes or no to the times.';
  const hi = 'Hi ' + (firstName(m.name) || 'there') + ',';
  return {
    subject, body: who + ' ' + ask,
    slack: ':calendar: *' + slackEsc(hire) + '* (' + slackEsc(role) + ') has been offered a place on the team, and you are their onboarding manager. ' + slackEsc(ask) + ' <' + link + '|Propose the times>',
    text: hi + '\n\n' + who + ' ' + ask + '\n\n' + page + '\n\nPropose the times: ' + link + '\n\nWelfare Avenue Hub',
    html: '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#FFFAF2;font-family:Helvetica,Arial,sans-serif;color:#1F201E;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid rgba(16,63,57,.10);padding:28px 32px;font-size:15px;line-height:1.55;">' +
      '<p style="margin:0 0 14px;">' + esc(hi) + '</p><p style="margin:0 0 14px;">' + esc(who + ' ' + ask) + '</p><p style="margin:0 0 22px;">' + esc(page) + '</p>' +
      '<p style="margin:0 0 22px;"><a href="' + esc(link) + '" style="display:inline-block;background:#103F39;color:#FFFAF2;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;">Propose the times</a></p>' +
      '<p style="margin:0;font-size:13px;color:#5c6b66;word-break:break-all;">' + esc(link) + '</p><p style="margin:18px 0 0;">Welfare Avenue Hub</p></div></body></html>',
  };
}
type Asked = { ok: true; sent?: true; practice?: true; skipped?: string; reason?: string; to?: string; manager?: string; warnings?: string[] } | { code: string; error: string; status: number };
/* the send itself, for ask_manager and the hourly job: m is the flow's active manager with an email. again: send even to the manager who holds the link (HR from the card) */
async function askManagerFor(f: Row, c: Row, m: Row, again: boolean, by: string): Promise<Asked> {
  const held = !!f.manager_link_sent_at && String(f.manager_link_member_id ?? '') === String(m.id);
  if (held && !again) return { ok: true, skipped: 'already_sent', reason: m.name + ' already has their link to propose times.' };
  /* the claim: only the call that finds manager_link_sent_at as it was read sends, so two calls at once send once */
  const now = new Date().toISOString();
  const prev = { manager_link_sent_at: f.manager_link_sent_at ?? null, manager_link_member_id: f.manager_link_member_id ?? null, reminded_manager_at: f.reminded_manager_at ?? null };
  let claim = svc.from('hub_onboard_flows').update({ manager_link_sent_at: now, manager_link_member_id: m.id, reminded_manager_at: null }).eq('id', f.id).in('status', ASKABLE);
  claim = f.manager_link_sent_at ? claim.eq('manager_link_sent_at', f.manager_link_sent_at) : claim.is('manager_link_sent_at', null);
  const { data: won, error } = await claim.select('id');
  if (error) return { code: 'save', error: 'The link could not be recorded, so nothing was sent (' + error.message + '). Try again.', status: 500 };
  if (!(won as unknown[] | null)?.length) return { ok: true, skipped: 'already_sent', reason: 'The link to ' + m.name + ' has just gone out.' };
  if (!held && f.setup_ticks?.[HR_TOLD]) await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: HR_TOLD, p_value: null });   // a new manager: HR may be told about them in turn
  if (f.practice || c.practice) return { ok: true, practice: true };   // the walkthrough's link works; nothing goes anywhere
  const email = String(m.email).trim().toLowerCase();
  const path = '/o/' + await signedToken('mgr', f.id), link = HUB + path;
  const words = proposeMail(m, c, link, { callMin: await cfgNum('onboard_call_min', 60), oneMin: await cfgNum('onboard_one_on_one_min', 30), lead: await cfgNum('onboard_propose_lead_hours', 48) });
  const warnings: string[] = [];
  const dm = await tell({ event: 'onboard_propose', to_email: email, url: path, tag: 'onboard-propose-' + f.id, title: words.subject, body: words.body, text: words.slack });
  if (!dm.handled) warnings.push('The Slack message to ' + m.name + ' did not reach them: ' + stop(dm.note.replace(/^[^:\s]+@[^:\s]+: /, '') || 'notify gave no answer'));
  let mailed = false;
  try { await deliver({ practice: false, to: email, subject: words.subject, text: words.text, html: words.html }); mailed = true; }
  catch (e) { warnings.push('The email to ' + m.name + ' did not go: ' + stop(errText(e).replace(/^The email was not sent: /, ''))); }
  if (!dm.handled && !mailed) {
    await svc.from('hub_onboard_flows').update(prev).eq('id', f.id).eq('manager_link_sent_at', now);   // given back, so the hourly job (or HR) sends it again
    return { code: 'not_sent', error: m.name + ' was not reached, so the link is not marked as sent. ' + warnings.join(' ') + ' The Hub tries again within the hour.', status: 502 };
  }
  await log('onboard_flow', f.id, 'manager_link', null, 'propose link sent to ' + email, by);
  return { ok: true, sent: true, to: email, manager: m.name, warnings };
}
async function askManagerNow(b: Row, by: string, system: boolean): Promise<Response> {
  const n = Number(b.flow_id);
  const { data: f } = Number.isInteger(n) ? await svc.from('hub_onboard_flows').select(ASK_COLS).eq('id', n).maybeSingle() : { data: null };
  if (!f) return no('not_found', 'That onboarding flow is gone. Reload the page.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone. Reload the page.', 404);
  const quiet = notAsked(f, c, await v2Since());
  if (quiet) return json({ ok: true, ...quiet });
  const m = await managerFor(f, c);
  if (!m) return no('no_manager', 'This new hire has no onboarding manager yet. Choose one on the card, then send the link again.');
  if (m.active === false) return no('manager_inactive', m.name + ' is no longer active on the roster, so they cannot be asked for times. Change the manager on the card first.');
  if (!String(m.email || '').trim()) return no('manager_no_email', m.name + ' has no email on the roster, so the Hub cannot send them the link. Add it on their roster profile, then send it again.');
  const r = await askManagerFor(f, c, m, !system, by);
  if ('error' in r) return no(r.code, r.error, r.status);
  return json(r);
}

/* ---------- wave275 Task 3: accept_setup and book ---------- */
const AT_ACCEPT_BY = 'hub (offer accepted)';
const BOOKED_BY = 'hub (the new hire said yes)';
const BOOK_COLS = PROPOSE_COLS + ', created_at, ask_availability, hire_answered_at';
const hrList = async () => (await cfg('hr_notify_emails')).split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x));
/* the wave275 path: a flow created on or after the release time. Unset (until the release) means no flow qualifies. */
async function isV2(f: Row): Promise<boolean> {
  const since = Date.parse((await cfg('onboard_v2_since')).trim());
  return !Number.isNaN(since) && !!f.created_at && Date.parse(String(f.created_at)) >= since;
}
/* the rows of the steps not made yet, pending (seeded once: the claim before each call decides who seeds) */
async function seedMissing(f: Row, keys: string[], by: string, practice: boolean): Promise<string | null> {
  const have = new Set((await readSteps(f.id)).map((r) => r.step));
  const now = new Date().toISOString();
  const seed = keys.filter((k) => !have.has(k)).map((k) => ({ flow_id: f.id, step: k, status: 'pending', detail: null, practice, at: now, by }));
  if (!seed.length) return null;
  const { error } = await svc.from('hub_onboard_steps').upsert(seed, { onConflict: 'flow_id,step' });
  return error ? error.message : null;
}

/* accept_setup {flow_id}: onboard-link asks once the hire's Accept is saved, and does not wait for the answer */
async function acceptSetup(b: Row): Promise<Response> {
  const n = Number(b.flow_id);
  const { data: f } = Number.isInteger(n) ? await svc.from('hub_onboard_flows').select(BOOK_COLS).eq('id', n).maybeSingle() : { data: null };
  if (!f) return no('not_found', 'That onboarding flow is gone.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone.', 404);
  if (f.status === 'backed_out' || CLOSED_CARD.includes(c.status)) return no('closed', 'The card is closed, so nothing was set up.');
  if (!c.accepted_on) return no('not_accepted', 'The offer has not been accepted yet, so nothing was set up.');
  const warnings: string[] = [];
  /* times proposed before Accept: the hire is emailed their yes-or-no link now (a proposal landing at this moment emails them itself; hire_times sends once) */
  const sent = await hireTimes(f.id);
  if ('error' in sent && !['no_proposal', 'not_accepted'].includes(sent.code)) warnings.push(firstName(c.name) + ' was not emailed the times: ' + sent.error);
  if (!(await isV2(f))) return json({ ok: true, skipped: 'wave271', warnings });   // a wave271 card keeps its path: HR's Start makes the account
  /* the claim: of two calls at once, one seeds and runs the steps */
  const { data: won, error: claimErr } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'accept_setup_at', p_value: new Date().toISOString(), p_if_unset: true });
  if (claimErr) return no('tick_failed', 'The setup could not be recorded, so it did not run (' + claimErr.message + '). Try again.', 500);
  if (won !== true) return json({ ok: true, skipped: 'already', steps: await readSteps(f.id), warnings });
  const seedErr = await seedMissing(f, ACCEPT_KEYS, AT_ACCEPT_BY, !!(f.practice || c.practice));
  if (seedErr) {
    await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: 'accept_setup_at', p_value: null });   // give the claim back so a retry can seed
    return no('save', 'The setup steps could not be made: ' + seedErr + '. Try again.', 500);
  }
  await advance(await makeCtx(await getFlow(f.id), AT_ACCEPT_BY, null));
  return json({ ok: true, steps: await readSteps(f.id), warnings });
}

/* the hire's Yes found a time that has moved: their answer is a no (the proposal is spent), the manager and HR hear why, and the page shows the grid
   (or, availability already communicated, says the manager will be in touch). Nothing is booked. */
const STALE_WHY: Record<string, (manager: string, n: number) => string> = {
  lead_time: (_m, n) => 'it is now less than ' + n + ' hours away',
  outside_hours: (m) => 'it is outside ' + m + '\'s availability for that day',
  busy: (m) => 'it clashes with a hub@ meeting ' + m + ' is invited to',
  taken: () => 'it clashes with times booked or proposed for another new hire',
};
async function staleTimes(f: Row, c: Row, m: Row, code: string, which: Which, lead: number): Promise<Response> {
  const now = new Date().toISOString(), ask = f.ask_availability !== false, practice = !!(f.practice || c.practice);
  /* hire_answer no marks the proposal spent (the grid shows, and it no longer counts as taken). hire_answered_at stays empty: the times going stale is not
     the hire saying no, so their one No is still theirs to give (onboard-link counts a No as a second one only when hire_answered_at is set). */
  const { data: won } = await svc.from('hub_onboard_flows').update({ hire_answer: 'no', updated_at: now })
    .eq('id', f.id).is('hire_answer', null).is('call_at', null).eq('proposed_at', f.proposed_at).select('id');
  if ((won as unknown[] | null)?.length) {
    await log('onboard_flow', f.id, 'hire_answer', null, 'no (the times had moved: ' + code + ')', BOOKED_BY);
    const to = Array.from(new Set([String(m.email || '').trim().toLowerCase(), ...await hrList()].filter((x) => /@/.test(x))));
    if (!practice && to.length) {
      const meeting = which === 'call' ? 'the onboarding call' : 'the 1-on-1';
      const said = c.name + ' (' + (c.role || 'new hire') + ') pressed Yes, but ' + meeting + ' no longer works: ' + (STALE_WHY[code] || STALE_WHY.taken)(String(m.name || 'the manager'), lead) + '. '
        + (ask ? firstName(c.name) + ' is marking their availability now; pick new times from their card in Onboarding.' : 'Their availability was already communicated: get in touch with them about other times.');
      await tell({ event: 'onboard_answer', to, url: '#hrcentre/onboarding', tag: 'onboard-stale-' + f.id, title: 'The times for ' + c.name + ' no longer work', body: said, text: ':warning: ' + slackEsc(said) + ' <' + HUB + '/#hrcentre/onboarding|Open Onboarding>' });
    }
  }
  const messages = ask
    ? { en: 'Sorry, those times no longer work for your manager. Please mark when you are free below, and they will pick from your times.', fr: 'Désolés, ces heures ne conviennent plus à votre gestionnaire. Indiquez ci-dessous quand vous êtes disponible, et votre gestionnaire choisira parmi vos plages.' }
    : { en: 'Sorry, those times no longer work for your manager. They will be in touch with other times.', fr: 'Désolés, ces heures ne conviennent plus à votre gestionnaire. Votre gestionnaire communiquera avec vous pour d’autres heures.' };
  return json({ error: 'stale', message: messages.en, messages, which, reason: code, ask_availability: ask }, 409);
}

/* book {flow_id, call_at, one_on_one_at, by: 'hire'}: the hire's Yes, through onboard-link */
async function book(b: Row): Promise<Response> {
  if (b.by !== 'hire') return refuse('bad_by', 400);
  const n = Number(b.flow_id);
  const { data: f } = Number.isInteger(n) ? await svc.from('hub_onboard_flows').select(BOOK_COLS).eq('id', n).maybeSingle() : { data: null };
  if (!f) return no('not_found', 'That onboarding flow is gone.', 404);
  const c = await getCand(f.candidate_id);
  if (!c) return no('not_found', 'The candidate card is gone.', 404);
  if (f.status === 'backed_out' || CLOSED_CARD.includes(c.status)) return refuse('closed');
  if (!c.accepted_on) return refuse('not_accepted');
  const callAt = instant(b.call_at), oneAt = instant(b.one_on_one_at);
  const booked = (row: Row) => json({ ok: true, repeated: true, call_at: instant(row.call_at), one_on_one_at: instant(row.one_on_one_at), status: row.status, steps: [] });
  if (f.call_at || f.hire_answer === 'yes') return sameInstant(f.call_at, callAt) && sameInstant(f.one_on_one_at, oneAt) ? booked(f) : refuse('already_booked');
  if (f.hire_answer === 'no') return refuse('answered');
  if (!f.proposed_at || !f.proposed_call_at || !f.proposed_one_on_one_at) return refuse('no_proposal');
  if (!callAt || !oneAt || !sameInstant(callAt, f.proposed_call_at) || !sameInstant(oneAt, f.proposed_one_on_one_at)) return refuse('changed');
  const managerId = f.manager_member_id ?? f.manager_link_member_id;
  const { data: m } = managerId != null ? await svc.from('team_members').select('id, name, email, active').eq('id', Number(managerId)).maybeSingle() : { data: null };
  if (!m) return refuse('no_manager');
  if (m.active === false) return refuse('manager_inactive', 409, undefined, undefined, String(m.name || 'The manager'));
  const mEmail = String(m.email || '').trim().toLowerCase();
  if (!mEmail) return refuse('manager_no_email', 409, undefined, undefined, String(m.name || 'The manager'));
  /* Review Focus 1: the manager's calendar may have changed since the proposal. Both times again, with the Yes lead time. */
  const [callMin, oneMin, lead] = [await cfgNum('onboard_call_min', 60), await cfgNum('onboard_one_on_one_min', 30), await cfgNum('onboard_yes_lead_hours', 24)];
  let problem: { code: string; which: Which } | null;
  try { problem = await timesProblem(Number(f.id), m, spansOf(callAt, oneAt, callMin, oneMin), lead, callMin, oneMin); } catch (e) { return no('failed', errText(e) + ' Nothing was booked. Try again.', 503); }
  if (problem) return await staleTimes(f, c, m, problem.code, problem.which, lead);
  /* the claim: of two presses, only one finds the proposal still unanswered and the flow not started. The manager runs the call with them, so both invites go to them. */
  const now = new Date().toISOString();
  const { data: won, error } = await svc.from('hub_onboard_flows')
    .update({ status: 'running', call_at: callAt, one_on_one_at: oneAt, manager_member_id: m.id, started_by: mEmail, hire_answer: 'yes', hire_answered_at: now, updated_at: now })
    .eq('id', f.id).in('status', BEFORE_START).is('call_at', null).is('hire_answer', null).eq('proposed_at', f.proposed_at).select(FLOW_COLS);
  if (error) return no('save', 'The times could not be booked: ' + error.message + '. Try again.', 500);
  const flow = (won as Row[] | null)?.[0];
  if (!flow) {
    const { data: again } = await svc.from('hub_onboard_flows').select(BOOK_COLS).eq('id', f.id).maybeSingle();
    if (again && again.call_at && sameInstant(again.call_at, callAt) && sameInstant(again.one_on_one_at, oneAt)) return booked(again);
    return refuse('changed');
  }
  const practice = !!(f.practice || c.practice);
  const seedErr = await seedMissing(flow, STEPS.map((s) => s.key), BOOKED_BY, practice);   // the booking group, and the at-Accept rows if accept_setup never ran
  if (seedErr) {
    await svc.from('hub_onboard_flows').update({ status: f.status, call_at: null, one_on_one_at: null, started_by: f.started_by ?? null, hire_answer: null, hire_answered_at: f.hire_answered_at ?? null, updated_at: new Date().toISOString() }).eq('id', f.id).eq('status', 'running');
    return no('save', 'The times could not be booked: ' + seedErr + '. Try again.', 500);
  }
  await log('onboard_flow', f.id, 'call_at', null, callAt, BOOKED_BY);
  await log('onboard_flow', f.id, 'one_on_one_at', null, oneAt, BOOKED_BY);
  /* the booking steps (plan, invites, manager, welcome and the rest) talk to Calendar and notify, which can take longer than the hire's page waits: they run
     after the answer, handed to the runtime (EdgeRuntime.waitUntil), as accept_setup does after Accept. A step that fails shows on the card with Retry. */
  const steps = (async () => {
    try {
      await advance(await makeCtx(flow, BOOKED_BY, null));
      if (practice) return;
      const hr = await hrList();   // HR hears it here; the manager hears it from the manager step, with the date
      const title = c.name + ' said yes to the times';
      const said = c.name + ' (' + (c.role || 'new hire') + ') said yes: the onboarding call on ' + whenText(callAt) + ' and the 1-on-1 with ' + String(m.name || 'their manager') + ' on ' + whenText(oneAt) + '. Both are booked.';
      if (!hr.length) { console.error('onboard-run book: HR was not told for flow ' + f.id + ': hr_notify_emails is empty.'); return; }
      const told = await tell({ event: 'onboard_answer', to: hr, url: '#hrcentre/onboarding', tag: 'onboard-yes-' + f.id, title, body: said, text: ':white_check_mark: ' + slackEsc(said) + ' <' + HUB + '/#hrcentre/onboarding|Open Onboarding>' });
      if (!told.handled) console.error('onboard-run book: HR was not told for flow ' + f.id + ': ' + (told.note || 'notify gave no answer'));
    } catch (e) { console.error('onboard-run book: the booking steps stopped for flow ' + f.id + ': ' + errText(e)); }
  })();
  await inBackground(steps);   // returns at once under the runtime; a local run waits
  return json({ ok: true, booked: true, repeated: false, call_at: callAt, one_on_one_at: oneAt, status: 'running' });
}
/* work that must outlive the answer: the runtime keeps it alive (Supabase's EdgeRuntime.waitUntil); without one (a local run) the caller waits for it */
function inBackground(p: Promise<unknown>): Promise<unknown> | void {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') { rt.waitUntil(p); return; }
  return p;
}
/* ---------- remind: the hourly job ---------- */
const REMIND_COLS = FLOW_COLS + ', created_at, reminded_hire_at, reminded_manager_at, manager_link_sent_at, manager_link_member_id, proposed_at, hire_answer, setup_ticks';   // wave275: the last three for the propose path
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
/* an open plan for this person that is not this flow's own: HR has already onboarded them another way (the roster dropdown). Found by the card's profile or the personal email. */
async function otherOpenPlan(f: Row, c: Row): Promise<boolean> {
  const ids = Array.from(new Set([c.member_id, ...(await membersByEmail(c.email)).map((m) => m.id)].filter((x) => x != null)));
  if (!ids.length) return false;
  const { data, error } = await svc.from('onboardings').select('id').in('member_id', ids).is('completed_at', null);
  if (error) throw new Error('the open plans could not be read: ' + error.message);
  return ((data || []) as Row[]).some((o) => String(o.id) !== String(f.onboarding_id));
}

async function remind(): Promise<Response> {
  const out = { ok: true, grid_links: 0, propose_links: 0, reminded_hr: 0, reminded_managers: 0, skipped: [] as string[] };
  const hours = await cfgNum('onboard_remind_hours', 48);
  const waited = (since: unknown) => !!since && Date.now() - Date.parse(String(since)) >= hours * 3600000;
  const hr = (await cfg('hr_notify_emails')).split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x));
  const since = await v2Since();   // wave275: which flows are on the propose path
  const { data, error: listErr } = await svc.from('hub_onboard_flows').select(REMIND_COLS).in('status', [...LIVE_FLOW, 'offered']).eq('practice', false);
  if (listErr) return json({ ok: false, error: 'remind_failed', message: 'The flows could not be read, so nothing was reminded: ' + listErr.message + '. If wa271b_remind.sql is not applied yet, apply it first.' }, 500);   // a broken deploy order must show in cron, not pass as an empty hour
  for (const f of (data || []) as Row[]) {
    try {
      const c = await getCand(f.candidate_id);
      if (!c || c.practice || !OPEN_CARD.includes(c.status)) continue;
      if (await otherOpenPlan(f, c)) continue;

      /* wave275, the propose path: the manager's propose link once, then after onboard_remind_hours with nothing proposed one reminder to them and one word to HR.
         No grid message of wave271's goes to such a flow. */
      if (proposeMode(f, since)) {
        if (notAsked(f, c, since)) continue;   // closed, booked, past the asking, or times waiting for the hire's answer
        const pm = await managerFor(f, c);
        const missing = !pm ? 'has no onboarding manager' : pm.active === false ? 'has ' + pm.name + ' as onboarding manager, who is no longer active on the roster' : !pm.email ? 'has ' + pm.name + ' as onboarding manager, who has no email on the roster' : '';
        if (missing) {   // nobody can be asked for times: HR is told once (setup_ticks.no_manager_told_at), and the card needs a manager
          out.skipped.push('flow ' + f.id + ': ' + c.name + ' ' + missing);
          if (!hr.length || f.setup_ticks?.[NO_MANAGER_TOLD]) continue;
          const { data: mine, error: tickErr } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: NO_MANAGER_TOLD, p_value: new Date().toISOString(), p_if_unset: true });
          if (tickErr || mine !== true) continue;
          const told = await tell({
            event: 'onboard_remind', to: hr, url: '#hrcentre/onboarding', tag: 'onboard-no-manager-' + f.id,
            title: c.name + ' needs an onboarding manager',
            body: c.name + ' (' + (c.role || 'new hire') + ') ' + missing + ', so nobody can be asked for the onboarding call and the 1-on-1. Choose a manager on their card in Onboarding.',
            text: ':warning: *' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + ') ' + slackEsc(missing) + ', so nobody can be asked for the onboarding call and the 1-on-1. <' + HUB + '/#hrcentre/onboarding|Open Onboarding> to choose a manager on their card.',
          });
          if (!told.handled) { await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: NO_MANAGER_TOLD, p_value: null }); out.skipped.push('flow ' + f.id + ': HR notice not delivered, will try again (' + told.note + ')'); }
          else out.reminded_hr++;
          continue;
        }
        if (!pm) continue;   // never reached: missing covers it (narrows pm for the type checker)
        if (!f.manager_link_sent_at || String(f.manager_link_member_id) !== String(pm.id)) {
          const r = await askManagerFor(f, c, pm, false, 'hub (hourly)');
          if ('error' in r) out.skipped.push('flow ' + f.id + ': propose link not delivered, will try again (' + r.error + ')');
          else if (r.sent) { out.propose_links++; for (const w of r.warnings || []) out.skipped.push('flow ' + f.id + ': ' + w); }
          continue;
        }
        if (!waited(f.manager_link_sent_at)) continue;
        if (f.proposed_at) continue;   // times were proposed (the hire said no to them): the manager hears that through onboard_answer and answers from the card, so no "not proposed" reminder
        const path = '/o/' + await signedToken('mgr', f.id), link = HUB + path;
        if (!f.reminded_manager_at) {
          const { data: won } = await svc.from('hub_onboard_flows').update({ reminded_manager_at: new Date().toISOString() }).eq('id', f.id).is('reminded_manager_at', null).select('id');
          if ((won as unknown[] | null)?.length) {
            const sent = await tell({
              event: 'onboard_remind', to_email: String(pm.email).toLowerCase(), url: path, tag: 'onboard-remind-propose-' + f.id,
              title: 'Propose times for ' + c.name,
              body: 'You have not proposed the onboarding call and the 1-on-1 for ' + c.name + ' yet. It takes a minute.',
              text: ':hourglass_flowing_sand: You have not proposed the onboarding call and the 1-on-1 for *' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + ') yet. It takes a minute. <' + link + '|Propose the times>',
            });
            if (!sent.handled) { await svc.from('hub_onboard_flows').update({ reminded_manager_at: null }).eq('id', f.id); out.skipped.push('flow ' + f.id + ': manager reminder not delivered, will try again (' + sent.note + ')'); }
            else out.reminded_managers++;
          }
        }
        if (!hr.length) { out.skipped.push('flow ' + f.id + ': no hr_notify_emails'); continue; }
        if (f.setup_ticks?.[HR_TOLD]) continue;
        const { data: mine, error: tickErr } = await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: HR_TOLD, p_value: new Date().toISOString(), p_if_unset: true });
        if (tickErr) { out.skipped.push('flow ' + f.id + ': HR reminder not recorded, so not sent (' + tickErr.message + ')'); continue; }
        if (mine !== true) continue;
        const hrSent = await tell({
          event: 'onboard_remind', to: hr, url: '#hrcentre/onboarding', tag: 'onboard-remind-propose-hr-' + f.id,
          title: pm.name + ' has not proposed times for ' + c.name,
          body: pm.name + ' was asked more than ' + hours + ' hours ago to propose the onboarding call and the 1-on-1 for ' + c.name + ' (' + (c.role || 'new hire') + '), and has not yet. You can propose them from the card in Onboarding.',
          text: ':hourglass_flowing_sand: *' + slackEsc(pm.name) + '* was asked more than ' + hours + ' hours ago to propose the onboarding call and the 1-on-1 for *' + slackEsc(c.name) + '* (' + slackEsc(c.role || 'new hire') + '), and has not yet. <' + HUB + '/#hrcentre/onboarding|Open Onboarding> to propose them from the card.',
        });
        if (!hrSent.handled) { await svc.rpc('wa275_tick_set', { p_flow: f.id, p_key: HR_TOLD, p_value: null }); out.skipped.push('flow ' + f.id + ': HR reminder not delivered, will try again (' + hrSent.note + ')'); }
        else out.reminded_hr++;
        continue;
      }
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
    /* the Hub itself (cron through call_edge, onboard-link and recruit-actions): the trigger secret opens remind, propose, hire_times, accept_setup, book and ask_manager, and nothing else. For any other action, or a wrong secret, it is as if
       the header were not there: the sign-in check below decides. */
    const given = req.headers.get('x-wa-secret');
    if (given) {
      let system = false;
      try { system = sameText(given, await getSecret('WA_TRIGGER_SECRET')); } catch (_) { /* fall through */ }
      if (system) {
        const sb = await req.clone().json().catch(() => ({}));
        if (sb.action === 'remind') return await remind();
        if (sb.action === 'propose') return await propose(sb, 'manager', true);   // wave275: the mgr link relays here (by 'manager')
        if (sb.action === 'hire_times') return await hireTimesNow(sb);
        if (sb.action === 'accept_setup') return await acceptSetup(sb);   // wave275 Task 3: onboard-link, after the hire's Accept
        if (sb.action === 'book') return await book(sb);                  // wave275 Task 3: onboard-link, the hire's Yes
        if (sb.action === 'ask_manager') return await askManagerNow(sb, 'hub (offer sent)', true);   // wave275 Task 5: recruit-actions, once the offer is out
      }
    }
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return no('signed_out', 'Please sign in again.', 401);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: who } = await asUser.auth.getUser();
    const by = String(who?.user?.email || '').toLowerCase();
    if (!by) return no('signed_out', 'Please sign in again.', 401);
    const [hr, admin] = await Promise.all([asUser.rpc('wa_is_hr'), asUser.rpc('is_wa_admin')]);
    const b = await req.json().catch(() => ({}));
    if (b.action === 'set_first_password' || b.action === 'first_password_state') {   // wave275 Task 4: admins only, not HR
      if (admin.data !== true) return no('not_allowed', 'Only admins can see or set the first password.', 403);
      return b.action === 'set_first_password' ? await setFirstPassword(b, by) : await firstPasswordState();
    }
    if (b.action === 'propose') {   // wave275: HR, an admin, or this flow's own manager (wa275_manager_of, as the caller)
      if (hr.data !== true && admin.data !== true && (await asUser.rpc('wa275_manager_of', { p_flow: Number(b.flow_id) })).data !== true) return no('not_allowed', 'Only HR, admins and this new hire\'s manager can propose times.', 403);
      return await propose(b, by, false);
    }
    if (hr.data !== true && admin.data !== true) return no('not_allowed', 'Only HR and admins can do this.', 403);
    if (b.action === 'preview') return await preview(b, by);
    if (b.action === 'ask_manager') return await askManagerNow(b, by, false);   // wave275 Task 5: HR sends the manager their link again from the card
    if (b.action === 'set_manager') return await setManager(b);
    if (b.action === 'start') return await start(b, by, asUser);
    if (b.action === 'task_done') return await taskDone(b, by, asUser);
    if (b.action === 'set_canva_link') return await setCanvaLink(b, by);
    if (b.action === 'welcome') return await welcomeNow(b, by);
    if (b.action === 'retry') return await retry(b, by, asUser);
    if (b.action === 'google_manual') return await googleManual(b, by, asUser);
    if (b.action === 'send_grid_link') return await sendGridLink(b, by);
    if (b.action === 'book_one_on_one') return await bookOneOnOne(b, by, asUser);
    if (b.action === 'change_time') return await changeTime(b, by, asUser);
    if (b.action === 'change_manager') return await changeManager(b, by, asUser);
    if (b.action === 'backed_out') return await backedOut(b, by, asUser);
    if (b.action === 'remind') return no('not_allowed', 'remind is the Hub\'s own hourly job.', 403);
    if (b.action === 'hire_times') return no('not_allowed', 'hire_times is the Hub\'s own step: it runs when times are proposed or the offer is accepted.', 403);
    if (b.action === 'accept_setup' || b.action === 'book') return no('not_allowed', b.action + ' is the Hub\'s own step: it runs from the new hire\'s link.', 403);
    return no('unknown_action', 'The Hub does not know that action. Reload the page.', 400);
  } catch (e) {
    return no('failed', errText(e), 500);
  }
});
