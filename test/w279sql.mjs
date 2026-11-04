// wave279: offline proof of build/wa279a_rules.sql and build/wa279a_undo.sql on PGlite. Run: node test/w279sql.mjs
// Loads test/w279schema.sql (a slice of the live schema), the migration (twice, to prove it is safe to run again), then test/w279sql.sql (twice: the assertions
// roll back, so a second run proves they leave nothing behind). Then proves the undo (run twice): every function the migration changed is back exactly as live
// has it (pg_get_functiondef, comment and ACL compared before and after), the column, the trigger and the new functions are gone, and the migration and the
// assertions still pass after an undo. PGlite has no pg_cron or pg_net, so test/w279schema.sql stubs cron.schedule, cron.unschedule and call_edge.
// Tasks 2 to 4 of wave279 extend build/wa279a_rules.sql, build/wa279a_undo.sql, test/w279sql.sql and test/w279schema.sql, and add their own checks here.
// Standalone: it does not load or change test/w271sql.mjs. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w279schema.sql');
const migration = read('../build/wa279a_rules.sql');
const undo = read('../build/wa279a_undo.sql');
const assertions = read('w279sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w279sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}

// the functions wave279a redefines or adds, as they stand: body, comment and ACL
const REDEFINED = ['public.onboarding_template_propagate()', 'public.wa166_path_state(bigint,text)'];
const ADDED = ['public.wa279_via_setup(bigint)', 'public.wa279_flow_plan()', 'public.wa279_plan_manager(bigint)', 'public.wa279_can_pick(bigint)', 'public.wa279_recommended(bigint)', 'public.wa279_pick_add(bigint,text,bigint,text,boolean)', 'public.wa279_pick_remove(bigint,text)', 'public.wa279_role_options(bigint,date)', 'public.wa279_role_save(bigint,text,bigint[])', 'public.wa279_role_autopick(date)', 'public.wa279_role_state(bigint,text)'];
async function snapshot(db) {
  const out = {};
  for (const f of REDEFINED) {
    out[f] = await one(db, `select pg_get_functiondef('${f}'::regprocedure) as def, obj_description('${f}'::regprocedure, 'pg_proc') as cmt,
      (select proacl::text from pg_proc where oid = '${f}'::regprocedure) as acl`);
  }
  return out;
}

try {
  const db = new PGlite();
  await db.exec(schema);

  // ---- before: the live functions, and the failing state (no column yet)
  const before = await snapshot(db);
  let missing = false;
  try { await db.exec(assertions); } catch (e) { missing = /setup_covered|wa279_via_setup/.test(String(e.message)); }
  await db.exec('rollback').catch(() => {});
  ok(missing, 'before the migration the assertions fail on the missing column');
  console.log('before the migration: the assertions fail on the missing setup_covered column, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  await db.exec(migration);
  console.log('wa279a: applied twice with no error');
  const afterMig = await snapshot(db);
  for (const f of REDEFINED) ok(afterMig[f].def !== before[f].def, f + ' was redefined by the migration');
  ok(/wa279_via_setup/.test(afterMig['public.onboarding_template_propagate()'].def), 'propagate now asks wa279_via_setup');
  ok(afterMig['public.onboarding_template_propagate()'].acl === before['public.onboarding_template_propagate()'].acl, 'propagate keeps its ACL');
  ok(afterMig['public.wa166_path_state(bigint,text)'].acl === before['public.wa166_path_state(bigint,text)'].acl, 'path_state keeps its ACL');
  ok(afterMig['public.wa166_path_state(bigint,text)'].cmt === before['public.wa166_path_state(bigint,text)'].cmt, 'path_state keeps its comment');
  for (const f of ADDED) ok((await one(db, `select to_regprocedure('${f}') is not null as x`)).x === true, f + ' exists');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa279_flow_plan' and not tgisinternal`)).n === 1, 'one flow trigger after two runs');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice, with a plan and a flow in place first so the undo meets real rows
  await db.exec(`insert into public.team_members (name, email) values ('Test Undo Member', 'w279.undo@example.invalid');
    update public.onboarding_template set setup_covered = true where id = 't-w2';`);
  const undone = await one(db, `select count(*)::int as n from public.onboarding_template where setup_covered`);
  ok(undone.n === 1, 'a covered row exists before the undo');
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa279a undo: applied twice with no error');
  const afterUndo = await snapshot(db);
  for (const f of REDEFINED) {
    ok(afterUndo[f].def === before[f].def, f + ' is back exactly as live has it (pg_get_functiondef)');
    ok(afterUndo[f].cmt === before[f].cmt, f + ' comment is back as it was');
    ok(afterUndo[f].acl === before[f].acl, f + ' ACL is back as it was (' + afterUndo[f].acl + ')');
  }
  for (const f of ADDED) ok((await one(db, `select to_regprocedure('${f}') is null as x`)).x === true, f + ' is gone');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa279_flow_plan'`)).n === 0, 'the flow trigger is gone');
  ok((await one(db, `select count(*)::int as n from information_schema.columns where table_name = 'onboarding_template' and column_name = 'setup_covered'`)).n === 0, 'the column is dropped');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa279%'`)).n === 0, 'no wa279 function left');
  ok((await one(db, `select count(*)::int as n from pg_class where relname = 'onboarding_role_picks'`)).n === 0, 'the role picks table is gone');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_onb_tmpl_propagate'`)).n === 1, 'the live template trigger is still there');
  await db.exec(`delete from public.team_members where email = 'w279.undo@example.invalid'`);
  console.log('wa279a undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');

  console.log(`w279sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
