// wave276 (Task 1): offline proof of build/wa276_avail.sql and build/wa276_undo.sql on PGlite. Run: node test/w276sql.mjs
// Loads test/w276schema.sql (a slice of the live schema), the migration (twice, to prove it is safe to run again), then test/w276sql.sql.
// Then proves the undo (twice): every wave276 object, seed and setting is gone and the other kinds are untouched; and the migration and the
// assertions still pass after an undo. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w276schema.sql');
const migration = read('../build/wa276_avail.sql');
const undo = read('../build/wa276_undo.sql');
const assertions = read('w276sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w276sql: all assertions passed', label + ': the assertion script finished');
  console.log(label + ': ' + line);
}

const FUNCS = ['wa_avail_can_see', 'wa_avail_can_manage', 'wa_avail_manager_of', 'wa_avail_due', 'wa_avail_mine', 'wa_avail_save',
  'wa_avail_snooze', 'wa_avail_team', 'wa_avail_ask_set'];

try {
  const db = new PGlite();
  await db.exec(schema);

  await db.exec(migration);
  await db.exec(migration);   // safe to run twice
  console.log('migration: applied twice with no error');
  ok((await one(db, `select count(*)::int as n from public.hub_team_avail_ask where set_by = 'wave276'`)).n === 4 * 7, 'running twice seeds the asks once (4 x 7 teams)');
  ok((await db.query(`select count(*)::int as n from pg_proc where proname = any($1) and pronamespace = 'public'::regnamespace`, [FUNCS])).rows[0].n === FUNCS.length, 'one of each function');
  await db.exec(`update public.app_config set value = '12' where key = 'avail_min_hours'`);
  await db.exec(migration);
  ok((await one(db, `select value from public.app_config where key = 'avail_min_hours'`)).value === '12', 'running again keeps a setting an admin changed');
  await db.exec(`update public.app_config set value = '10' where key = 'avail_min_hours'`);

  await runAssertions(db, 'assertions');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);   // safe to run twice
  console.log('undo: applied twice with no error');
  ok((await one(db, `select to_regclass('public.hub_team_avail') as r`)).r === null, 'hub_team_avail dropped');
  ok((await one(db, `select to_regclass('public.hub_team_avail_ask') as r`)).r === null, 'hub_team_avail_ask dropped');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa\\_avail\\_%'`)).n === 0, 'no wa_avail_ function left');
  ok((await one(db, `select count(*)::int as n from public.app_config where key like 'avail\\_%'`)).n === 0, 'the avail_ settings are gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key in ('meet_propose', 'meet_avail_ask')`)).n === 0, 'the two kinds are gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key = 'timeoff_request'`)).n === 1, 'the other kinds are untouched');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname in ('wa_leads_team', 'wa_in_team', 'wa180_my_teams', 'my_emails')`)).n === 4, 'the helpers it uses are untouched');
  console.log('undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');

  console.log(`w276sql.mjs: OK (${checks} runner checks, plus both assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
