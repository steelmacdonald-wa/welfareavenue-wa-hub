// wave292: offline proof of build/data/wa292_batches.sql and build/data/wa292_undo.sql on PGlite. Run: node test/w292sql.mjs
// Loads slice 1's wave281, wave282 and wave284 and wave289 (built on this branch, not live yet), then test/w292schema.sql (crm_interactions' live
// policies and an invented, finished email-history run). Runs the migration twice (the second run must change nothing: bodies, grants and comments
// compared), test/w292sql.sql twice (it rolls back), the undo twice (every wave292 object gone and the eleven live functions back exactly as they
// were, by md5), the migration and the assertions once more, the undo's refusal while a batch is applied, the stop without wave289, and the live
// check files (test/w292live.sql, test/w292live_undo.sql). Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const BEFORE289 = ['w281schema.sql', '../build/data/wa281_rules.sql', 'w282schema.sql', '../build/data/wa282_mail_rule.sql', 'w284schema.sql', '../build/data/wa284_import.sql', 'w289schema.sql'].map(read);
const wa289 = read('../build/data/wa289_scan.sql');
const schema = read('w292schema.sql');
const migration = read('../build/data/wa292_batches.sql');
const undo = read('../build/data/wa292_undo.sql');
const assertions = read('w292sql.sql');
const live = read('w292live.sql');
const liveUndo = read('w292live_undo.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(with289 = true) {
  const db = new PGlite();
  for (const s of BEFORE289) await db.exec(s);
  if (with289) { await db.exec(wa289); await db.exec(schema); }
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w292sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
const LIVE_FNS = ['wa284_write', 'wa284_basis', 'wa284_new_batch', 'wa284_undo', 'wa284_unrow', 'wa284_set', 'wa284_upd', 'wa284_purge', 'crm_email_first_contact', 'crm_email_permission', 'crm_merge_contacts'];
const DEFS = `select string_agg(p.proname || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), ''), E'\\n' order by p.proname) as s
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (${LIVE_FNS.map((f) => `'${f}'`).join(', ')})`;
const OBJECTS = `select coalesce(string_agg(x, E'\\n' order by x), '') as s from (
  select 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '') as x
    from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'wa292\\_%' or p.proname like 'crm_insight\\_%' or p.proname = 'crm_mail_steel_open')
  union all select 'table ' || c.oid::regclass::text || ' ' || coalesce(c.relacl::text, '') || ' ' || c.relrowsecurity || ' ' || coalesce(md5(obj_description(c.oid, 'pg_class')), '')
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('crm_email_relationship', 'crm_email_relationship_v', 'wa_partners_domain_uq')
  union all select 'col ' || a.attrelid::regclass::text || '.' || a.attname || ' ' || coalesce(md5(col_description(a.attrelid, a.attnum)), '')
    from pg_attribute a join pg_class c on c.oid = a.attrelid
   where a.attnum > 0 and not a.attisdropped and c.relnamespace = 'public'::regnamespace and (c.relname = 'crm_email_relationship' or (c.relname = 'wa_partners' and a.attname in ('domain', 'address')))
  union all select 'policy ' || polrelid::regclass::text || ' ' || polname || ' ' || md5(coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), ''))
    from pg_policy where polname like '%wa292%' or polrelid = 'public.crm_interactions'::regclass and polname like 'crm_interactions_wa292%' or polname = 'crm_email_relationship_staff_read'
  union all select 'trigger ' || tgname from pg_trigger where tgname like 'trg_wa292%'
  union all select 'constraint ' || md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'crm_import_batches_kind_check'
) q`;
const COUNTS = `select (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname like 'wa292\\_%') as functions,
  (select count(*)::int from public.change_log where entity_type = 'release' and entity_id = 'wave292' and field = 'wave292') as release_rows,
  (select count(*)::int from pg_trigger where tgname like 'trg_wa292%') as triggers`;

try {
  const db = await fresh();
  const defsBefore = (await one(db, DEFS)).s;
  const objBefore = (await one(db, OBJECTS)).s;

  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = true; }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  await db.exec(migration);
  const first = await one(db, COUNTS);
  const objOnce = (await one(db, OBJECTS)).s, defsOnce = (await one(db, DEFS)).s;
  await db.exec(migration);
  const second = await one(db, COUNTS);
  console.log('wa292: applied twice with no error', JSON.stringify(second));
  ok(JSON.stringify(first) === JSON.stringify(second), 'a second run adds nothing');
  ok(objOnce === (await one(db, OBJECTS)).s && defsOnce === (await one(db, DEFS)).s, 'a second run leaves every body, grant and comment as the first left it');
  ok(first.functions >= 24 && first.release_rows === 1 && first.triggers === 2, 'the functions, one release line, two triggers (' + JSON.stringify(first) + ')');
  ok(defsOnce.split('\n').length === 11 && defsOnce.split('\n').every((l, i) => l !== defsBefore.split('\n')[i] || /crm_email_permission|crm_email_first_contact/.test(l) === false ? true : true), 'eleven live functions read');
  ok(defsOnce.split('\n').filter((l, i) => l.split(' ')[1] !== defsBefore.split('\n')[i].split(' ')[1]).length === 11, 'all eleven live function bodies changed');
  ok(objOnce.split('\n').filter((l) => l.startsWith('col ') || l.startsWith('fn ')).every((l) => !/ $/.test(l)), 'every new column and function has a comment');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // the undo refuses while an email-history batch (other than the opt-outs) is applied
  {
    await db.exec(`insert into public.crm_import_batches (run_id, kind, status) values (9201, 'mail_orgs', 'applied')`);
    let msg = '';
    try { await db.exec('begin;\n' + undo + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db.exec('rollback').catch(() => {});
    ok(msg.includes('still applied'), 'the undo refuses while a batch is applied (' + msg + ')');
    await db.exec(`delete from public.crm_import_batches where run_id = 9201`);
    console.log('undo guard: an applied batch stops it');
  }

  await db.exec(undo);
  await db.exec(undo);
  console.log('wa292 undo: applied twice with no error');
  ok((await one(db, DEFS)).s === defsBefore, 'the eleven live functions are back exactly as they were (bodies, grants, comments)');
  ok((await one(db, OBJECTS)).s === objBefore, 'no wave292 object is left (' + (await one(db, OBJECTS)).s + ')');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave292' and field = 'wave292 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select count(*)::int as n from public.crm_email_suppressions`)).n >= 1, 'suppressions are kept');

  // a kept summary keeps its table
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  await db.exec(`insert into public.crm_email_relationship (contact_id, summary) values (9301, 'Kept summary.')`);
  await db.exec(undo);
  ok((await one(db, `select to_regclass('public.crm_email_relationship') is not null as x`)).x === true, 'a table holding a summary is kept by the undo');
  ok((await one(db, DEFS)).s === defsBefore, 'and the live functions are still restored');
  await db.close();

  {
    const db2 = await fresh(false);
    let msg = '';
    try { await db2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db2.exec('rollback').catch(() => {});
    ok(msg.includes('wave292 needs wave289'), 'without wave289 the migration stops (' + msg + ')');
    await db2.close();
    console.log('without wave289 the migration stops');
  }

  for (const [label, files] of [['migration twice, live checks', [migration, migration, live]],
                                ['migration, live checks, undo twice, undo checks', [migration, live, undo, undo, liveUndo]]]) {
    const db4 = await fresh();
    await db4.exec('begin;\n' + files.join('\n') + '\nrollback;');
    ok(true, label);
    console.log('live check files, offline: ' + label + ': passed');
    await db4.close();
  }

  console.log(`w292sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  process.exit(1);
}
