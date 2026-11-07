// Welfare Avenue: mail-history (v2, 07/11/26, wave292: summarise and insight; v1 07/11/26, wave289; built, not deployed)
// Purpose: the email history scan (design "03 email history, interactions and insights" v2, 5.1 to 5.5). Reads Steel's mailbox
// (steel.macdonald@) and hub@ (where info@ arrives) back to April 2020 with gmail.readonly, applies the shared mail rules without a model,
// reads the kept threads with the llm router (one line per email, never a body), groups the people who wrote in, types them with Jev and looks
// up their organisations' homepages. It fills the private holding area only (import_stage.mail_*, crm_mail_scans): nothing reaches the CRM
// until wave292's batches. It never labels, files, moves or sends mail, and never posts anywhere. v2 (wave292) adds the summary pass after the
// mail_interactions batch is applied (summarise; summary.ts) and one contact's Refresh (insight).
// Triggers: the Import page (wave292) and Claude through public.call_edge on Steel's yes (control actions); itself (continue) and the cron job
// wa-mail-history-pump (pump), which exists only while a run is active.
// Auth (verify_jwt on):
//   start, status, go, pause, resume, cap, summarise   wa_can('import_admin') as the caller, or the trigger secret (x-wa-secret). Counts only.
//   continue, pump                          the trigger secret only.
//   people, exclude                         an admin's own sign-in only, never the secret (they return or touch personal data, which must never
//                                           reach a Claude conversation); people from Steel's mailbox answer only Steel (M3).
//   insight                                 CRM staff (is_wa_staff and the CRM page) with their own sign-in; an admin when the contact has lines
//                                           from Steel's mailbox while mail_history_steel_open is false (H1). Never the secret.
// Actions (POST {action, ...}):
//   start {label, mailboxes?}  -> {run_id}: refuses while wa289_ready lists a problem (a route without the no-retention provider setting or a
//                                 wording route without the confidentiality rule); creates the run, turns the pump on and starts the free phases
//   status {run_id}            -> wa289_status: phase, counts by reason, spend, cap per mailbox
//   go {run_id}                -> {estimate, cap}: Steel's yes to the paid phases (cap 1.5 x the estimate, at most mail_history_cap_usd); logged
//   pause / resume {run_id}, cap {run_id, usd}
//   continue {run_id}          -> one step (100 s by mail_history_step_seconds), then calls itself while the run has work
//   pump                       -> continues every active run whose lease is free or ran out; turns itself off when none is left
//   people {run_id, filter, offset}, exclude {run_id, key, what, on}
//   summarise {run_id}         -> {todo}: the summary pass (wave292), after mail_interactions is applied; resumable, the run's cap; continue and
//                                 pump carry it on while the scans are at phase summaries
//   insight {contact_id}       -> {saved, model}: Refresh one contact's summary (about 1 cent); no run, no cap
// Tables: crm_import_runs, crm_mail_scans, crm_email_suppressions (read), import_stage.mail_* (through the wa289_* functions only), change_log,
// ai_calls (through the router). Side effects: none outside the database (Gmail is read-only; homepages are fetched with GET only).
// Logs: step names, counts and status codes only; never an address, subject, line or page text.
// Deploy: through the Supabase connector (deploy_edge_function) with files index.ts, scan.ts and summary.ts (fn/mail-history) and mail_rules.ts
// (fn/_shared); build/fn.py refuses it and says so.
// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { step, type Deps, type Mailbox, MAILBOX_ADDR, USER_AGENT } from './scan.ts';
import { summariseContact, summaryStep } from './summary.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ORIGINS = ['https://hub.welfareavenue.com', 'https://wa-exec-dashboard.netlify.app'];
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const CONTROL = ['start', 'status', 'go', 'pause', 'resume', 'cap', 'summarise'];

function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Max-Age': '86400' };
}
const json = (req: Request, b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors(req), 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await svc.rpc(fn, args);
  if (error) { const e = new Error(String(error.message || 'database error').slice(0, 300)); (e as any).db = true; throw e; }
  return data;
}

/* ---- who is calling ---- */
type Caller = { kind: 'secret' } | { kind: 'admin'; email: string } | null;
async function caller(req: Request): Promise<Caller> {
  const given = req.headers.get('x-wa-secret');
  if (given) { try { if (given === (await getSecret('WA_TRIGGER_SECRET'))) return { kind: 'secret' }; } catch (_) { /* fall through */ } return null; }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth === 'Bearer ' + SERVICE_KEY || auth === 'Bearer ' + ANON_KEY) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await asUser.auth.getUser();
  const email = String(u?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('wa_can', { p_cap: 'import_admin' });
  return ok === true ? { kind: 'admin', email } : null;
}

// insight: CRM staff with their own sign-in (never the secret); admin and Steel's-lines answers asked as the caller
async function staffCaller(req: Request): Promise<{ email: string; admin: boolean; open: boolean } | null> {
  if (req.headers.get('x-wa-secret')) return null;
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth === 'Bearer ' + SERVICE_KEY || auth === 'Bearer ' + ANON_KEY) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await asUser.auth.getUser();
  const email = String(u?.user?.email || '').toLowerCase();
  if (!email) return null;
  const [staff, page, admin, open] = await Promise.all([asUser.rpc('is_wa_staff'), asUser.rpc('wa_page_ok', { p_tab: 'crm' }), asUser.rpc('is_wa_admin'), asUser.rpc('crm_mail_steel_open')]);
  if (staff.data !== true || page.data === false) return null;
  return { email, admin: admin.data === true, open: open.data === true };
}

/* ---- Google: the service account acts for the two allow-listed mailboxes only, read-only ---- */
const TOKENS: Record<string, { value: string; exp: number }> = {};
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array {
  const b = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out;
}
async function tokenFor(mailbox: Mailbox): Promise<string> {
  const sub = MAILBOX_ADDR[mailbox];
  if (!sub) throw new Error('mailbox not allowed');
  const cached = TOKENS[sub];
  if (cached && Date.now() < cached.exp - 60000) return cached.value;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key).buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json().catch(() => ({}));
  if (!body.access_token) { const e = new Error('google token'); (e as any).status = res.status; throw e; }
  TOKENS[sub] = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return TOKENS[sub].value;
}
async function gmail(mailbox: Mailbox, path: string) {
  if (!/^\/(messages|threads)(\/|\?)/.test(path)) throw new Error('gmail path not allowed');   // read-only paths only
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + path, { headers: { Authorization: 'Bearer ' + (await tokenFor(mailbox)) } });
  const b = await res.json().catch(() => null);
  if (!res.ok) { const e = new Error('gmail ' + res.status + ' ' + String(b?.error?.errors?.[0]?.reason || '')); (e as any).status = res.status; throw e; }
  return b;
}

/* ---- the router (every model call goes through llm; its _wa.cost is the spend) ---- */
async function router(task: string, body: Record<string, unknown>) {
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', { method: 'POST',
    headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': task, 'x-wa-caller': 'mail-history', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => null);
  if (!res.ok) { const e = new Error('router'); (e as any).status = res.status; throw e; }
  return { out, cost: typeof out?._wa?.cost === 'number' ? out._wa.cost : 0 };
}

/* ---- the network for homepages: DNS answers checked by scan.ts (safeHost), GET only, no redirects followed here, size and time limits ---- */
async function resolve(host: string): Promise<string[]> {
  const out: string[] = [];
  for (const t of ['A', 'AAAA']) { try { out.push(...(await Deno.resolveDns(host, t as 'A'))); } catch (_) { /* none of that kind */ } }
  return out;
}
async function http(url: string, opts: { timeoutMs: number; maxBytes: number }) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctl.signal, credentials: 'omit',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8' } });
    const headers: Record<string, string> = {}; res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    let text = '';
    if (res.body) {
      const reader = res.body.getReader(); const dec = new TextDecoder(); let n = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > opts.maxBytes) { await reader.cancel(); break; } text += dec.decode(value, { stream: true }); }
    }
    return { status: res.status, headers, text };
  } finally { clearTimeout(timer); }
}

const deps: Deps = {
  rpc,
  scans: async (run: number) => {
    const { data, error } = await svc.from('crm_mail_scans').select('mailbox,phase,paused,page_token,go_at,estimate_usd,counts').eq('run_id', run).order('mailbox', { ascending: false });
    if (error) throw new Error('scans');
    return data || [];
  },
  gmail, router, resolve, http,
  now: () => Date.now(),
  sleep: (ms: number) => new Promise(r => setTimeout(r, ms)),
};

function selfCall(body: Record<string, unknown>) {
  // fire and forget: the next step runs in its own request (the pump restarts it if this one is lost)
  getSecret('WA_TRIGGER_SECRET').then(secret => fetch(SUPABASE_URL + '/functions/v1/mail-history', { method: 'POST',
    headers: { Authorization: 'Bearer ' + ANON_KEY, apikey: ANON_KEY, 'x-wa-secret': secret, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).catch(() => null);
}
async function stepSeconds(): Promise<number> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'mail_history_step_seconds').maybeSingle();
  try { const v = JSON.parse(data?.value || '{}'); return Math.min(Math.max(Number(v.step) || 100, 20), 120); } catch (_) { return 100; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json(req, { error: 'JSON body expected' }, 400); }
  const action = String(body.action || '');
  if (action === 'insight') {
    const staff = await staffCaller(req);
    if (!staff) return json(req, { error: 'CRM staff only' }, 403);
    const cid = Number(body.contact_id || 0);
    if (!Number.isInteger(cid) || cid <= 0) return json(req, { error: 'contact_id expected' }, 400);
    try {
      const input = await rpc('crm_insight_input', { p_contact: cid });
      if (input && input.from_steel && !staff.admin && !staff.open) return json(req, { error: "Only admins refresh summaries from Steel's mailbox for now." }, 403);
      const r = await summariseContact({ rpc, router, now: () => Date.now() }, cid, staff.email);
      console.log('mail-history insight', cid, r.saved, r.calls);   // ids and counts only
      return json(req, { ok: true, saved: r.saved, model: r.model, cost: r.cost });
    } catch (e) {
      console.log('mail-history insight error', (e as any)?.status || '', (e as any)?.db ? 'db' : '');
      return json(req, { error: (e as any)?.db ? String((e as Error).message) : 'failed (' + ((e as any)?.status || 'error') + ')' }, 500);
    }
  }
  const who = await caller(req);
  if (!who) return json(req, { error: 'unauthorized' }, 401);
  const by = who.kind === 'admin' ? who.email : 'mail-history (trigger)';
  const run = Number(body.run_id || 0);
  try {
    if (CONTROL.includes(action)) {
      if (action === 'start') {
        const problems = await rpc('wa289_ready', {});
        if (problems && problems.length) return json(req, { error: 'not ready', problems }, 409);
        const boxes = Array.isArray(body.mailboxes) ? body.mailboxes.map(String) : ['steel', 'hub'];
        const id = await rpc('wa289_new_run', { p_label: String(body.label || 'Email history'), p_by: by, p_mailboxes: boxes });
        await rpc('wa289_pump', { p_on: true });
        selfCall({ action: 'continue', run_id: id });
        return json(req, { ok: true, run_id: id });
      }
      if (!run) return json(req, { error: 'run_id expected' }, 400);
      if (action === 'status') return json(req, { ok: true, status: await rpc('wa289_status', { p_run: run }) });
      if (action === 'go') {
        const r = await rpc('wa289_go', { p_run: run, p_by: by });
        await rpc('wa289_pump', { p_on: true }); selfCall({ action: 'continue', run_id: run });
        return json(req, { ok: true, ...r });
      }
      if (action === 'pause') { await rpc('wa289_pause', { p_run: run, p_on: true, p_by: by }); return json(req, { ok: true }); }
      if (action === 'resume') { await rpc('wa289_pause', { p_run: run, p_on: false, p_by: by }); await rpc('wa289_pump', { p_on: true }); selfCall({ action: 'continue', run_id: run }); return json(req, { ok: true }); }
      if (action === 'cap') return json(req, { ok: true, ...(await rpc('wa289_set_cap', { p_run: run, p_usd: Number(body.usd), p_by: by })) });
      if (action === 'summarise') {
        const r = await rpc('wa292_summary_start', { p_run: run, p_by: by });
        await rpc('wa289_pump', { p_on: true }); selfCall({ action: 'continue', run_id: run });
        return json(req, { ok: true, ...r });
      }
    }
    if (action === 'continue' || action === 'pump') {
      if (who.kind !== 'secret') return json(req, { error: 'the trigger secret only' }, 403);
      if (action === 'pump') {
        const runs: number[] = [...new Set([...((await rpc('wa289_active', {})) || []), ...((await rpc('wa292_summary_active', {})) || [])])];
        if (!runs.length) {
          const { data } = await svc.from('crm_mail_scans').select('run_id').in('phase', ['count', 'headers', 'dedupe', 'bounces', 'sample', 'threads', 'people', 'orgs', 'summaries']).eq('paused', false).limit(1);
          if (!data || !data.length) await rpc('wa289_pump', { p_on: false });
          return json(req, { ok: true, runs: 0 });
        }
        runs.forEach(r => selfCall({ action: 'continue', run_id: r }));
        return json(req, { ok: true, runs: runs.length });
      }
      if (!run) return json(req, { error: 'run_id expected' }, 400);
      const phases = (await deps.scans(run)).map((x) => x.phase);
      const summaries = phases.length > 0 && phases.every((ph) => ph === 'summaries');
      const result = summaries ? await summaryStep({ rpc, router, now: () => Date.now() }, run, (await stepSeconds()) * 1000)
                               : await step(deps, run, (await stepSeconds()) * 1000);
      if (!result.busy && !result.error && !result.paused && !result.finished) {
        const active: number[] = [...((await rpc('wa289_active', {})) || []), ...((await rpc('wa292_summary_active', {})) || [])];
        if (active.includes(run)) selfCall({ action: 'continue', run_id: run });
      }
      console.log('mail-history step', run, JSON.stringify(result));   // counts and step names only
      return json(req, { ok: true, result });
    }
    if (action === 'people' || action === 'exclude') {
      if (who.kind !== 'admin') return json(req, { error: "an admin's own sign-in only" }, 403);
      if (!run) return json(req, { error: 'run_id expected' }, 400);
      if (action === 'people') return json(req, { ok: true, ...(await rpc('wa289_people', { p_run: run, p_filter: body.filter || {}, p_offset: Number(body.offset || 0), p_caller: who.email })) });
      return json(req, { ok: true, ...(await rpc('wa289_exclude', { p_run: run, p_key: String(body.key || ''), p_what: String(body.what || ''), p_on: body.on !== false, p_caller: who.email })) });
    }
    return json(req, { error: 'unknown action' }, 400);
  } catch (e) {
    // database errors start with "wa284: email history:" and name counts, keys or ids only
    const msg = String((e as Error)?.message || 'error');
    console.log('mail-history error', action, (e as any)?.status || '', (e as any)?.db ? 'db' : '');
    return json(req, { error: (e as any)?.db ? msg : 'failed (' + ((e as any)?.status || 'error') + ')' }, 500);
  }
});
