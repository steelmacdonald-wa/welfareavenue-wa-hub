// wave289: offline proof of build/data/wa289_scan.sql and build/data/wa289_undo.sql on PGlite. Run: node test/w289sql.mjs
// Loads slice 1's wave281 and wave284 (built on this branch, not live yet): test/w281schema.sql, build/data/wa281_rules.sql, test/w284schema.sql,
// build/data/wa284_import.sql; then test/w289schema.sql (cron and call_edge stand-ins, ai_routes, mybox, aliases, invented rows). Runs the migration
// twice (the second run must change nothing: bodies, grants and comments compared), test/w289sql.sql twice (it rolls back), the undo twice (every
// wave289 object gone; a setting an admin changed kept; the undo refuses while a scan runs or suppressions hold rows), and the migration and
// assertions once more after the undo. Also: the migration stops without wave284, and the live check files (test/w289live.sql,
// test/w289live_undo.sql) pass here first. Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const base = ['w281schema.sql', '../build/data/wa281_rules.sql', 'w284schema.sql', '../build/data/wa284_import.sql', 'w289schema.sql'].map(read);
const migration = read('../build/data/wa289_scan.sql');
const undo = read('../build/data/wa289_undo.sql');
const assertions = read('w289sql.sql');
const live = read('w289live.sql');
const liveUndo = read('w289live_undo.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(withWave284 = true) {
  const db = new PGlite();
  await db.exec(base[0]); await db.exec(base[1]); await db.exec(base[2]);
  if (withWave284) await db.exec(base[3]);
  await db.exec(base[4]);
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w289sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
const OBJECTS = `select coalesce(string_agg(x, E'\\n' order by x), '') as s from (
  select 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '') as x
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa289\\_%'
  union all select 'table ' || c.oid::regclass::text || ' ' || coalesce(c.relacl::text, '') || ' ' || c.relrowsecurity || ' ' || coalesce(md5(obj_description(c.oid, 'pg_class')), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r', 'S', 'i') and ((n.nspname = 'import_stage' and c.relname like 'mail\\_%') or c.relname like 'crm_mail_scans%' or c.relname like 'crm_email_suppressions%')
  union all select 'col ' || a.attrelid::regclass::text || '.' || a.attname || ' ' || coalesce(md5(col_description(a.attrelid, a.attnum)), '')
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where a.attnum > 0 and not a.attisdropped and c.relkind = 'r' and ((n.nspname = 'import_stage' and c.relname like 'mail\\_%') or c.relname in ('crm_mail_scans', 'crm_email_suppressions')
         or (c.relname = 'crm_import_runs' and a.attname = 'source') or (c.relname = 'ai_routes' and a.attname = 'provider'))
  union all select 'policy ' || polrelid::regclass::text || ' ' || polname || ' ' || md5(coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), ''))
    from pg_policy where polrelid::regclass::text in ('crm_mail_scans', 'crm_email_suppressions')
  union all select 'constraint ' || conname from pg_constraint where conname = 'crm_import_runs_source_check'
  union all select 'route ' || task || ' ' || md5((to_jsonb(r) - 'updated_at')::text) from public.ai_routes r where task like 'mail\\_history\\_%'
  union all select 'config ' || key || ' ' || md5(value) from public.app_config where (key like 'mail\\_history\\_%' or key = 'mail_insights_quiet_months')
) q`;
const COUNTS = `select (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname like 'wa289\\_%') as functions,
  (select count(*)::int from public.change_log where entity_type = 'release' and entity_id = 'wave289' and field = 'wave289') as release_rows,
  (select count(*)::int from public.app_config where (key like 'mail\\_history\\_%' or key = 'mail_insights_quiet_months')) as settings, (select count(*)::int from public.ai_routes where task like 'mail\\_history\\_%') as routes`;

try {
  const db = await fresh();

  // ---- before the migration the assertions fail
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = true; }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  const first = await one(db, COUNTS);
  const objOnce = (await one(db, OBJECTS)).s;
  await db.exec(migration);
  const second = await one(db, COUNTS);
  const objTwice = (await one(db, OBJECTS)).s;
  console.log('wa289: applied twice with no error', JSON.stringify(second));
  ok(JSON.stringify(first) === JSON.stringify(second), 'a second run adds nothing: ' + JSON.stringify(first) + ' vs ' + JSON.stringify(second));
  ok(objOnce === objTwice, 'a second run leaves every body, grant and comment as the first left it');
  ok(first.functions >= 30 && first.release_rows === 1 && first.settings === 18 && first.routes === 4, 'the functions, one release line, 18 settings, four routes (' + JSON.stringify(first) + ')');
  ok(objOnce.split('\n').filter((l) => l.startsWith('col ')).every((l) => !/ $/.test(l)), 'every new column has a comment');
  ok(objOnce.split('\n').filter((l) => l.startsWith('fn ')).every((l) => !/ $/.test(l)), 'every function has a comment');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo refuses while a scan runs, and while suppressions hold rows
  {
    let msg = '';
    await db.exec(`select public.wa289_new_run('Test undo guard', 'test', array['hub'])`);
    try { await db.exec('begin;\n' + undo + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db.exec('rollback').catch(() => {});
    ok(msg.includes('a scan is still running'), 'the undo refuses while a scan runs (' + msg + ')');
    await db.exec(`update public.crm_mail_scans set phase = 'failed'; insert into public.crm_email_suppressions (addr_md5, kind, source) values (md5('x@example.invalid'), 'asked_to_stop', 'test');`);
    msg = '';
    try { await db.exec('begin;\n' + undo + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db.exec('rollback').catch(() => {});
    ok(msg.includes('opt-outs are never dropped'), 'the undo refuses while suppressions hold rows (' + msg + ')');
    ok((await one(db, `select to_regclass('public.crm_mail_scans') is not null as x`)).x === true, 'and nothing was dropped');
    await db.exec(`delete from public.crm_email_suppressions;`);
    console.log('undo guards: a running scan and kept suppressions stop it');
  }

  // ---- the undo, twice (an admin changed one setting first: it stays)
  await db.exec(`update public.app_config set value = '40' where key = 'mail_history_cap_usd';`);
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa289 undo: applied twice with no error');
  const gone = (await one(db, OBJECTS)).s.split('\n').filter(Boolean);
  ok(gone.length === 1 && /^config mail_history_cap_usd /.test(gone[0]), 'after the undo no wave289 object is left, only the setting changed since (' + gone.join(' | ') + ')');
  ok((await one(db, `select count(*)::int as n from public.crm_import_runs where label = 'Test undo guard'`)).n === 0, 'email-history runs are deleted');
  ok((await one(db, `select to_regnamespace('import_stage') is not null and to_regclass('import_stage.files') is not null as x`)).x === true, "wave284's staging stays");
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave289' and field = 'wave289 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select count(*)::int as n from public.ai_routes where task = 'reel' and system_add is not null`)).n === 1, 'other routes are untouched');
  console.log('wa289 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(`delete from public.app_config where key = 'mail_history_cap_usd';`);
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await one(db, COUNTS);
  ok(again.functions === first.functions && again.settings === 18, 'the same functions and settings again after an undo');
  await db.close();

  // ---- without wave284 the migration stops at the top, and nothing is kept
  {
    const db2 = await fresh(false);
    let msg = '';
    try { await db2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db2.exec('rollback').catch(() => {});
    ok(msg.includes('wave289 needs wave284 first'), 'without wave284 the migration stops (' + msg + ')');
    ok((await one(db2, `select to_regclass('public.crm_mail_scans') is null as x`)).x === true, 'and nothing of wave289 is kept');
    await db2.close();
    console.log('without wave284 the migration stops and nothing is kept');
  }

  // ---- the live check files (run on live only inside build/sql_rollback_test.py's block), proved here first, each in one transaction
  for (const [label, files] of [['migration twice, live checks', [migration, migration, live]],
                                ['migration, live checks, undo twice, undo checks, migration, live checks', [migration, live, undo, undo, liveUndo, migration, live]]]) {
    const db4 = await fresh();
    await db4.exec('begin;\n' + files.join('\n') + '\nrollback;');
    ok(true, label);
    console.log('live check files, offline: ' + label + ': passed');
    await db4.close();
  }

  console.log(`w289sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
