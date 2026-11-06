// wave286: offline proof of build/data/wa286_vm_chapter.sql and build/data/wa286_undo.sql (Toronto crews in the CRM) on PGlite.
// Run: node test/w286sql.mjs
// wave286 needs wave281 first, so this loads test/w281schema.sql, runs build/data/wa281_rules.sql (chapters and its evidence backfill), then
// test/w286schema.sql (wave274-style Toronto events and crews, a Montreal serving, invented people). It runs the migration twice (the second run
// changes nothing: the backfill adds nobody again), test/w286sql.sql twice (it rolls back), the undo twice (the trigger and both functions gone, the
// rows wave286 added gone, every earlier chapter row and every roster row untouched), and the migration and assertions once more after the undo.
// Then: the migration refuses to run without wave281, the wave286 undo after wave281's undo is harmless, a trigger left behind by a wrong-order undo
// never blocks a crew add, and the live check files pass on the fixture. Files are read with CRLF turned into LF (a Windows checkout may hold CRLF;
// git and live hold LF). Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8').replace(/\r\n/g, '\n');
const schema281 = read('w281schema.sql');
const rules281 = read('../build/data/wa281_rules.sql');
const undo281 = read('../build/data/wa281_undo.sql');
const schema = read('w286schema.sql');
const migration = read('../build/data/wa286_vm_chapter.sql');
const undo = read('../build/data/wa286_undo.sql');
const assertions = read('w286sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
const FNS = ['public.wa286_crew_contact(jsonb,bigint)', 'public.wa286_toronto_crew()'];

async function base() {
  const db = new PGlite();
  await db.exec(schema281);
  await db.exec(rules281);
  await db.exec(schema);
  return db;
}
async function snapshot(db) {
  const fns = [];
  for (const f of FNS) {
    fns.push((await one(db, `select to_regprocedure('${f}') is not null as x`)).x
      ? await one(db, `select md5(pg_get_functiondef('${f}'::regprocedure)) as md5, obj_description('${f}'::regprocedure, 'pg_proc') as cmt, (select proacl::text from pg_proc where oid = '${f}'::regprocedure) as acl`)
      : null);
  }
  return {
    fns,
    trigger: (await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa286_toronto_crew'`)).n,
    ours: (await one(db, `select count(*)::int as n from public.crm_contact_chapters where source_ref like 'Toronto crew:%'`)).n,
    others: (await one(db, `select coalesce(string_agg(contact_id || ':' || chapter || ':' || source || ':' || coalesce(source_ref, '') || ':' || coalesce(added_by, ''), ',' order by contact_id, chapter), '') as s
      from public.crm_contact_chapters where source_ref is null or source_ref not like 'Toronto crew:%'`)).s,
    montreal: (await one(db, `select count(*)::int as n from public.crm_contact_chapters where chapter = 'montreal'`)).n,
    roster: (await one(db, `select md5(coalesce(string_agg(to_jsonb(r)::text, ',' order by r.id), '')) as m from public.event_roster r`)).m,
    events: (await one(db, `select md5(coalesce(string_agg(to_jsonb(e)::text, ',' order by e.id), '')) as m from public.volunteer_events e`)).m,
    release: (await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286'`)).n,
  };
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w286sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
async function refused(db, sql) { let msg = ''; try { await db.exec('begin;\n' + sql + '\ncommit;'); } catch (e) { msg = String(e.message); } await db.exec('rollback').catch(() => {}); return msg; }

try {
  const db = await base();
  const before = await snapshot(db);
  ok(before.fns.every((f) => f === null) && before.trigger === 0 && before.ours === 0 && before.release === 0, 'before: nothing of wave286');
  ok(/8603:toronto:hand/.test(before.others) && /8607:montreal:evidence/.test(before.others) && /1001:toronto:evidence/.test(before.others), 'before: the earlier chapter rows (by hand, and wave281\'s evidence)');

  let failedOn = '';
  try { await db.exec(assertions); } catch (e) { failedOn = String(e.message); }
  await db.exec('rollback').catch(() => {});
  ok(/the backfill added two people/.test(failedOn), 'before the migration the assertions fail on the first check (' + failedOn + ')');
  console.log('before the migration: the assertions fail, as they should (' + failedOn + ')');

  // ---- the migration, twice
  await db.exec(migration);
  const once = await snapshot(db);
  await db.exec(migration);
  const twice = await snapshot(db);
  console.log('wa286: applied twice with no error');
  ok(JSON.stringify(once) === JSON.stringify(twice), 'a second run changes nothing (functions, comments, grants, trigger, rows, release line)');
  ok(twice.ours === 2 && twice.trigger === 1 && twice.release === 1 && twice.fns.every((f) => f !== null), 'two people from the crews joined Toronto, the trigger, both functions, one release line');
  ok(twice.others === before.others && twice.montreal === before.montreal, 'every earlier chapter row is as it was, and no montreal row was added');
  ok(twice.roster === before.roster && twice.events === before.events, 'no roster row or event changed');
  ok(twice.fns[0].acl === '{postgres=X/postgres,service_role=X/postgres}' && twice.fns[1].acl === '{postgres=X/postgres,service_role=X/postgres}', 'neither function is open to signed-in users or anon');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa286 undo: applied twice with no error');
  const after = await snapshot(db);
  ok(after.fns.every((f) => f === null) && after.trigger === 0, 'the trigger and both functions are gone');
  ok(after.ours === 0, 'the rows wave286 added are gone');
  ok(after.others === before.others && after.montreal === before.montreal, 'the undo leaves every earlier chapter row alone (8603\'s Toronto row by hand included)');
  ok(after.roster === before.roster && after.events === before.events, 'no roster row or event changed');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286 undo'`)).n === 1, 'one undo line after two runs');
  console.log('wa286 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await snapshot(db);
  ok(again.ours === 2 && again.release === 1 && JSON.stringify(again.fns) === JSON.stringify(twice.fns), 'the same functions and rows after an undo, still one release line');
  await db.close();

  // ---- without wave281 the migration refuses to start
  {
    const db4 = new PGlite();
    await db4.exec(schema281);
    const msg = await refused(db4, migration);
    ok(msg.includes('wave286 needs wave281 first'), 'without wave281 the migration stops at the top (' + msg + ')');
    ok((await one(db4, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa286_toronto_crew'`)).n === 0, 'and adds nothing');
    await db4.close();
    console.log('without wave281: the migration refuses to start');
  }

  // ---- the wrong order: wave281 undone while wave286 is in place; a crew add still works, and the wave286 undo afterwards is harmless
  {
    const db5 = await base();
    await db5.exec(migration);
    await db5.exec(undo281);
    await db5.exec(`insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8612, null, 'Test New Crew', 'cook', 'TBD', '{"contact_id": 8608}')`);
    ok(true, 'with wave281 undone first, a crew add on a Toronto event still works');
    await db5.exec(undo);
    ok((await one(db5, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa286_toronto_crew'`)).n === 0, 'and the wave286 undo afterwards runs and removes the trigger');
    await db5.close();
    console.log('wave281 undone first: crew adds keep working; the wave286 undo afterwards is harmless');
  }

  // ---- the live check files (run on live only inside build/sql_rollback_test.py's block), proved here first on the fixture, each in one transaction
  {
    const lbefore = read('w286live_before.sql'), live = read('w286live.sql'), liveUndo = read('w286live_undo.sql');
    for (const [label, files] of [['before, migration twice, live checks', [lbefore, migration, migration, live]],
                                  ['before, migration, undo twice, undo checks', [lbefore, migration, undo, undo, liveUndo]]]) {
      const db6 = await base();
      await db6.exec('begin;\n' + files.join('\n') + '\nrollback;');
      ok(true, label);
      console.log('live check files, offline: ' + label + ': passed');
      await db6.close();
    }
  }

  console.log(`w286sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
