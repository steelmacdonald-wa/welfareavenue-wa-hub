// Welfare Avenue: crm-import (v1, 06/11/26, wave284; built, not deployed)
// The Import page (#crm/settings/imports, CRM slice 1 Phase 4): an admin stages Keela's exports, compares each kind of import with the Hub,
// applies it in reviewed batches and undoes what can be undone. The database does the work (the wa284_* functions, the service role only);
// this function checks the caller and moves the files.
// Trigger: the Import page (db.functions.invoke('crm-import', { body: { action, ... } })). verify_jwt on.
// Auth: every action first asks the database, with the caller's own sign-in, wa_can('import_admin') (admins), and refuses on anything but true.
// Actions (POST):
//   new_run {label}               -> {run_id}
//   register {run_id, path, kind} -> {file_id}: records a file the page uploaded to the private bucket imports (inside the run's folder <run>/)
//   stage {file_id, offset}       -> {next_offset | null, rows, staged_through}: reads the file from imports with the service role, parses it
//                                    (CSV with jsr:@std/csv: multi-line fields, UTF-8; or JSON) and stages up to 5,000 rows from offset into
//                                    import_stage.rows (from 0 it first clears the file's rows). The page calls it until next_offset is null.
//   files {run_id}                -> {files}: the run's files with their rows and how many are staged (no values)
//   keys {file_id}                -> {keys: [{key, filled}]}: each key or column header with how many rows have a value; never a value
//   batch {run_id, kind}          -> {batch_id}: the run's batch of that kind (one per kind)
//   compare {batch_id}            -> {report}: runs the writer and rolls it back, keeping only the report
//   apply {batch_id}              -> {report}: one transaction, automations off, the side-effect guard on; a stop is recorded on the batch
//   undo {batch_id}               -> {report}: value-checked; never for optouts or consent
//   purge {run_id}                -> {removed}: deletes the run's staged rows, change records and uploaded files
// Tables: crm_import_runs, crm_import_batches, crm_import_changes, import_stage.files, import_stage.rows (all through the wa284_* functions);
// storage bucket imports. Side effects: none outside these (the database's guard refuses requests, emails, texts, automations, notifications,
// applications, form answers and roster rows while a batch runs). Errors report row numbers, key names or error codes, never values.
// Deploy: build/fn.py refuses a function with a companion file (stage.mjs); deploy with the Supabase connector's files array, or the one-line
// stub that imports this index.ts from the pushed commit (stage.mjs resolves beside it).
// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parse as csvParse } from 'jsr:@std/csv@1.0.6';
import { stageStep, KINDS } from './stage.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ORIGINS = ['https://hub.welfareavenue.com', 'https://wa-exec-dashboard.netlify.app'];
const BUCKET = 'imports';
const BATCHES = ['optouts', 'legacy_fields', 'people', 'fields', 'orgs', 'consent', 'participation', 'form_answers'];

function cors(req) {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Max-Age': '86400' };
}
function reply(req, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
}
function asUser(token) {
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
}
// the caller's email from the signed-in token (the platform has already verified it: verify_jwt is on)
function emailOf(token) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const j = JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4)));
    return String(j.email || '').toLowerCase() || null;
  } catch (_) { return null; }
}
// a database message passes only when it is one of ours (they name keys and row numbers, never values); anything else becomes its code
function clean(err) {
  const m = String((err && err.message) || err || '');
  if (/^(missing key|wa284:|import side effect blocked)/.test(m)) return m.slice(0, 300);
  return 'stopped by the database (' + String((err && err.code) || 'error') + ')';
}
const id = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
async function rpc(name, args) {
  const { data, error } = await svc.rpc(name, args);
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return reply(req, { error: 'method' }, 405);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(req, { error: 'not_signed_in' }, 401);
  // only admins (wa_can('import_admin'), asked as the caller)
  const can = await asUser(token).rpc('wa_can', { p_cap: 'import_admin' });
  if (can.error || can.data !== true) return reply(req, { error: 'Imports are for admins.' }, 403);
  const by = emailOf(token);
  let body; try { body = await req.json(); } catch (_) { return reply(req, { error: 'bad_json' }, 400); }
  const a = String(body.action || '');
  try {
    if (a === 'new_run') return reply(req, { run_id: await rpc('wa284_new_run', { p_label: String(body.label || '').slice(0, 120), p_by: by }) });
    if (a === 'register') {
      const run = id(body.run_id), path = String(body.path || ''), kind = String(body.kind || '');
      if (!run || !KINDS.includes(kind) || !path.startsWith(run + '/') || path.includes('..')) return reply(req, { error: 'wa284: the file, its kind or its run is not right' }, 400);
      return reply(req, { file_id: await rpc('wa284_register', { p_run: run, p_path: path, p_kind: kind }) });
    }
    if (a === 'stage') {
      const fid = id(body.file_id);
      if (!fid) return reply(req, { error: 'wa284: which file?' }, 400);
      const files = await rpc('wa284_files', { p_run: null, p_file: fid });
      const f = Array.isArray(files) ? files[0] : null;
      if (!f || !f.name) return reply(req, { error: 'wa284: there is no file ' + fid }, 404);
      const dl = await svc.storage.from(BUCKET).download(f.name);
      if (dl.error || !dl.data) return reply(req, { error: 'wa284: the uploaded file could not be read from storage' }, 404);
      const text = new TextDecoder('utf-8').decode(new Uint8Array(await dl.data.arrayBuffer()));
      const out = await stageStep({
        text, kind: f.kind, offset: body.offset || 0, csvParse,
        save: (from, rows, total) => rpc('wa284_stage_rows', { p_file: fid, p_from: from, p_rows: rows, p_total: total })
      });
      return reply(req, out);
    }
    if (a === 'files') {
      const run = id(body.run_id);
      if (!run) return reply(req, { error: 'wa284: which run?' }, 400);
      return reply(req, { files: await rpc('wa284_files', { p_run: run, p_file: null }) });
    }
    if (a === 'keys') {
      const fid = id(body.file_id);
      if (!fid) return reply(req, { error: 'wa284: which file?' }, 400);
      return reply(req, { keys: await rpc('wa284_keys', { p_file: fid }) });
    }
    if (a === 'batch') {
      const run = id(body.run_id), kind = String(body.kind || '');
      if (!run || !BATCHES.includes(kind)) return reply(req, { error: 'wa284: the run or the kind is not right' }, 400);
      return reply(req, { batch_id: await rpc('wa284_new_batch', { p_run: run, p_kind: kind }) });
    }
    if (a === 'compare' || a === 'apply' || a === 'undo') {
      const bid = id(body.batch_id);
      if (!bid) return reply(req, { error: 'wa284: which batch?' }, 400);
      try {
        const report = await rpc('wa284_' + a, { p_batch: bid, p_by: by });
        if (report && report.error) return reply(req, { error: String(report.error), report: null });   // a compare that stopped (recorded on the batch)
        return reply(req, { report });
      } catch (e) {
        const msg = clean(e);
        if (a === 'apply') await svc.rpc('wa284_fail', { p_batch: bid, p_error: msg });   // the apply rolled back; the batch says why
        return reply(req, { error: msg });
      }
    }
    if (a === 'purge') {
      const run = id(body.run_id);
      if (!run) return reply(req, { error: 'wa284: which run?' }, 400);
      const paths = (await rpc('wa284_purge', { p_run: run })) || [];
      let removed = 0;
      for (let i = 0; i < paths.length; i += 100) {
        const part = paths.slice(i, i + 100);
        const rm = await svc.storage.from(BUCKET).remove(part);
        if (!rm.error) removed += part.length;
      }
      return reply(req, { removed, paths: paths.length });
    }
    return reply(req, { error: 'unknown action' }, 400);
  } catch (e) {
    return reply(req, { error: clean(e) }, 400);
  }
});
