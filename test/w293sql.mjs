// wave293: offline proof of build/data/wa293_insights.sql and build/data/wa293_undo.sql on PGlite. Run: node test/w293sql.mjs
// Loads slice 1's wave281, wave282 and wave284, wave289, test/w292schema.sql and wave292 (built on this branch, not live yet). Runs the migration
// twice (the second run must change nothing: body, grant and comment compared), test/w293sql.sql twice (it rolls back), the undo twice (the
// function gone, one undo line), the migration and the assertions once more, the stop without wave292, and the live check files
// (test/w293live.sql, test/w293live_undo.sql). Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const BEFORE = ['w281schema.sql', '../build/data/wa281_rules.sql', 'w282schema.sql', '../build/data/wa282_mail_rule.sql', 'w284schema.sql', '../build/data/wa284_import.sql',
  'w289schema.sql', '../build/data/wa289_scan.sql', 'w292schema.sql'].map(read);
const wa292 = read('../build/data/wa292_batches.sql');
const migration = read('../build/data/wa293_insights.sql');
const undo = read('../build/data/wa293_undo.sql');
const assertions = read('w293sql.sql');
const live = read('w293live.sql');
const liveUndo = read('w293live_undo.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(with292 = true) {
  const db = new PGlite();
  for (const s of BEFORE) await db.exec(s);
  if (with292) await db.exec(wa292);
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w293sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
const OBJECTS = `select coalesce(string_agg('fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), ''), E'\\n'), '') as s
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'crm_insights_overview'`;
const RELEASE = `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave293'`;

try {
  const db = await fresh();
  ok((await one(db, OBJECTS)).s === '', 'nothing of wave293 before the migration');
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = true; }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  await db.exec(migration);
  const once = (await one(db, OBJECTS)).s;
  await db.exec(migration);
  ok(once !== '' && once === (await one(db, OBJECTS)).s, 'a second run leaves the body, grant and comment as the first left it');
  ok((await one(db, RELEASE)).n === 1, 'one release line after two runs');
  console.log('wa293: applied twice with no error');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  await db.exec(undo);
  await db.exec(undo);
  ok((await one(db, OBJECTS)).s === '', 'the undo drops the function');
  ok((await one(db, RELEASE)).n === 2, 'one undo line after two runs');
  ok((await one(db, `select to_regclass('public.crm_email_relationship') is not null as x`)).x === true, 'wave292 is untouched by the undo');
  console.log('wa293 undo: applied twice with no error');

  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  await db.close();

  {
    const db2 = await fresh(false);
    let msg = '';
    try { await db2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db2.exec('rollback').catch(() => {});
    ok(msg.includes('wave293 needs wave292'), 'without wave292 the migration stops (' + msg + ')');
    await db2.close();
    console.log('without wave292 the migration stops');
  }

  for (const [label, files] of [['migration twice, live checks', [migration, migration, live]],
                                ['migration, live checks, undo twice, undo checks', [migration, live, undo, undo, liveUndo]]]) {
    const db4 = await fresh();
    await db4.exec('begin;\n' + files.join('\n') + '\nrollback;');
    ok(true, label);
    console.log('live check files, offline: ' + label + ': passed');
    await db4.close();
  }

  console.log(`w293sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  process.exit(1);
}
