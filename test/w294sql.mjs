// wave294: offline proof of build/data/wa294_keela_tags.sql and build/data/wa294_undo.sql on PGlite. Run: node test/w294sql.mjs
// Loads test/w281schema.sql, build/data/wa281_rules.sql, test/w284schema.sql and build/data/wa284_import.sql (waves 281 and 284 are built on this branch, not
// all live yet), then runs the migration twice (the second run must change nothing: bodies, grants, comments, the map and the change log compared),
// test/w294sql.sql twice (it rolls back), the undo twice (wave284's writer back byte for byte, comment included; the map back; the function gone; the
// release rows right), and the migration and assertions once more after the undo. Also: the migration stops without wave284; a map an admin changed is
// never overwritten (only absent keys are added, case-insensitively) and the undo then restores the whole earlier value only when the map still holds
// wave294's value; a map changed after the migration is left alone by the undo; the writer's body differs from wave284's by exactly the three added
// lines; and the live check files (test/w294live.sql, test/w294live_undo.sql) pass here first. Standalone. Touches no live database. Exits non-zero on
// any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// LF always: a checkout with CRLF line endings (core.autocrlf on Windows) would change the function text compared below
const read = (p) => readFileSync(join(here, p), 'utf8').split('\r\n').join('\n');
const schema281 = read('w281schema.sql');
const mig281 = read('../build/data/wa281_rules.sql');
const schema284 = read('w284schema.sql');
const mig284 = read('../build/data/wa284_import.sql');
const migration = read('../build/data/wa294_keela_tags.sql');
const undo = read('../build/data/wa294_undo.sql');
const assertions = read('w294sql.sql');
const live = read('w294live.sql');
const liveUndo = read('w294live_undo.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(withWave284 = true) {
  const db = new PGlite();
  await db.exec(schema281);
  await db.exec(mig281);
  if (withWave284) { await db.exec(schema284); await db.exec(mig284); }
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w294sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
const W = `'public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure`;
// every wave294 object and the writer: body, grants, comment; the map and the change log rows
const OBJECTS = `select coalesce(string_agg(x, E'\\n' order by x), '') as s from (
  select 'writer ' || md5(pg_get_functiondef(${W})) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '') as x from pg_proc p where p.oid = ${W}
  union all select 'aliases ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '')
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'crm_tag_aliases'
  union all select 'config ' || key || ' ' || md5(value) from public.app_config where key = 'keela_tag_map'
  union all select 'log ' || field || ' ' || md5(coalesce(old_value, '') || '|' || coalesce(new_value, '')) from public.change_log where entity_id = 'wave294'
) q`;
const writerDef = async (db) => (await one(db, `select pg_get_functiondef(${W}) as d`)).d;
const writerComment = async (db) => (await one(db, `select obj_description(${W}, 'pg_proc') as d`)).d;
const mapText = async (db) => (await one(db, `select value as v from public.app_config where key = 'keela_tag_map'`)).v;

try {
  const db = await fresh();

  // ---- the state before: wave284's writer and default map; the assertions fail
  const def284 = await writerDef(db);
  const com284 = await writerComment(db);
  const map284 = await mapText(db);
  ok(JSON.parse(map284).Donor.skip === true, 'the fixture holds wave284s default map (Donor skipped)');
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = true; }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  const objOnce = (await one(db, OBJECTS)).s;
  const def294 = await writerDef(db);
  await db.exec(migration);
  const objTwice = (await one(db, OBJECTS)).s;
  console.log('wa294: applied twice with no error');
  ok(objOnce === objTwice, 'a second run leaves every body, grant, comment, the map and the change log as the first left them');
  const releaseRows = (await one(db, `select count(*)::int as n from public.change_log where entity_id = 'wave294'`)).n;
  ok(releaseRows === 2, 'two change_log rows after two runs (the release line and the map record) (' + releaseRows + ')');

  // the writer differs from wave284's by the three added lines, nothing else
  {
    const a = def284.split('\n'); const b = def294.split('\n');
    ok(b.length === a.length + 3, 'the writer has exactly three more lines than wave284\'s (' + a.length + ' to ' + b.length + ')');
    const rest = b.filter((l) => !/wave294: a rename|m \? 'tag' and nullif|lower\(a\) = lower\(btrim\(m ->> 'tag'\)\)/.test(l))
      .map((l) => l === '        if not exists (select 1 from unnest(v_add) a where lower(a) = lower(v_tag)) then v_add := v_add || v_tag; end if;' ? '        v_add := v_add || v_tag;' : l);
    ok(rest.join('\n') === a.join('\n'), 'removing those three lines, and undoing the one guarded line (a raw label already in the list is not added twice), gives wave284\'s text exactly');
    ok((await writerComment(db)) !== com284 && (await writerComment(db)).startsWith('wave284 (changed by wave294):'), 'the writer comment says wave294 changed it');
  }

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');
  ok((await mapText(db)) === (await one(db, `select new_value as v from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map'`)).v, 'the assertion runs rolled back: the map is as the migration left it');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa294 undo: applied twice with no error');
  ok((await writerDef(db)) === def284, 'the undo puts back wave284\'s writer, definition byte for byte');
  ok((await writerComment(db)) === com284, 'and its comment');
  ok((await mapText(db)) === map284, 'and the map as wave284 left it, as text');
  ok((await one(db, `select to_regprocedure('public.crm_tag_aliases()') is null as x`)).x === true, 'crm_tag_aliases is gone');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_id = 'wave294' and field = 'wave294 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map undone'`)).n === 1, 'one map undone line after two runs');
  ok((await one(db, `select has_function_privilege('anon', ${W}, 'execute') or has_function_privilege('authenticated', ${W}, 'execute') as x`)).x === false, 'the writer grants are as before');
  console.log('wa294 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  ok((await writerDef(db)) === def294, 'after an undo the migration puts the same writer back');
  ok(JSON.parse(await mapText(db)).Donor.tag === 'donor', 'and the full map');
  await runAssertions(db, 're-applied assertions');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map'`)).n === 2, 'the map change is recorded again after the undo');
  // an undo after that restores again (the newest record is the one used)
  await db.exec(undo);
  ok((await mapText(db)) === map284, 'a second undo cycle puts the map back too');
  await db.close();

  // ---- an admin changed the map: nothing is overwritten, absent keys are added (case-insensitively), the undo restores the earlier value only while wave294's value stands
  {
    const db2 = await fresh();
    const admin = '{"Rally Paper Participant": {"campaign": "Rally Paper 2026", "part": "participant"}, "donor": {"tag": "financial donor"}, "VOLUNTEER SERVER": {"skip": true}, "Test Admin Label": {"tag": "test admin tag"}}';
    await db2.exec(`update public.app_config set value = '${admin}' where key = 'keela_tag_map'`);
    await db2.exec(migration);
    await db2.exec(migration);
    const m = JSON.parse(await mapText(db2));
    ok(JSON.stringify(m.donor) === '{"tag":"financial donor"}' && m.Donor === undefined, 'the admin\'s donor entry is kept (a key that differs only in case is not added)');
    ok(m['VOLUNTEER SERVER'].skip === true && m['Volunteer Server'] === undefined, 'the admin\'s skip of Volunteer Server is kept');
    ok(m['Test Admin Label'].tag === 'test admin tag', 'a key of the admin\'s own stays');
    ok(m['Past Donor'].tag === 'past donor' && m.Partner.tag === 'partner' && m['Toronto Contacts'].chapter === 'toronto', 'absent wave294 keys are added');
    ok(Object.keys(m).length === 4 + 34 - 3, 'the merged map has the admin\'s 4 keys and the 31 absent ones (' + Object.keys(m).length + ')');
    const rec = await one(db2, `select old_value, new_value from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map'`);
    ok(JSON.stringify(JSON.parse(rec.old_value)) === JSON.stringify(JSON.parse(admin)), 'the record holds the admin\'s value as the before value');
    ok((await one(db2, `select count(*)::int as n from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map'`)).n === 1, 'one map record after two runs');
    // the aliases follow the admin's entries
    ok((await one(db2, `select tag from public.crm_tag_aliases() where alias = 'donor'`)).tag === 'financial donor', 'the aliases follow the admin\'s entry');
    ok((await one(db2, `select count(*)::int as n from public.crm_tag_aliases() where alias = 'volunteer server'`)).n === 0, 'and leave out the one the admin skipped');
    // the undo while wave294's value stands
    await db2.exec(undo);
    ok((await mapText(db2)) === admin, 'the undo puts the admin\'s earlier value back');
    await db2.close();
  }
  {
    // m2: wave284's default map plus one unrelated admin key: the donor tags still change, the admin's key stays
    const db8 = await fresh();
    await db8.exec(`update public.app_config set value = (value::jsonb || '{"Unrelated Admin Key": {"tag": "unrelated"}}')::text where key = 'keela_tag_map'`);
    await db8.exec(migration);
    await db8.exec(migration);
    const m8 = JSON.parse(await mapText(db8));
    ok(m8.Donor.tag === 'donor' && m8['Past Donor'].tag === 'past donor' && m8['Reoccurring Donor'].tag === 'recurring donor', 'an unrelated admin key does not block the donor tags');
    ok(m8['Unrelated Admin Key'].tag === 'unrelated' && Object.keys(m8).length === 35, 'and the admin\'s key stays beside the full map (' + Object.keys(m8).length + ')');
    ok((await one(db8, `select count(*)::int as n from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map'`)).n === 1, 'one record after two runs');
    await db8.exec(undo);
    const u8 = JSON.parse(await mapText(db8));
    ok(u8.Donor.skip === true && u8['Unrelated Admin Key'].tag === 'unrelated', 'the undo puts the earlier value back, the admin\'s key included');
    await db8.close();
  }
  {
    const db3 = await fresh();
    await db3.exec(migration);
    // an admin edits the map after the migration: the undo leaves it alone
    await db3.exec(`update public.app_config set value = (value::jsonb || '{"Edited After": {"tag": "edited"}}')::text where key = 'keela_tag_map'`);
    const before = await mapText(db3);
    await db3.exec(undo);
    ok((await mapText(db3)) === before, 'a map changed after wave294 is left alone by the undo');
    ok((await one(db3, `select to_regprocedure('public.crm_tag_aliases()') is null as x`)).x === true && (await writerDef(db3)) === def284, 'while the function and the writer are still put back');
    await db3.close();
  }
  {
    // an unreadable or non-object map: left as it is, no error
    for (const v of ['not json', '[1, 2]']) {
      const db4 = await fresh();
      await db4.exec(`update public.app_config set value = '${v}' where key = 'keela_tag_map'`);
      await db4.exec(migration);
      ok((await mapText(db4)) === v, 'a map that is ' + v + ' is left as it is');
      ok((await one(db4, `select count(*)::int as n from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map'`)).n === 0, 'and nothing is recorded');
      await db4.exec(undo);
      ok((await mapText(db4)) === v, 'and the undo leaves it');
      await db4.close();
    }
  }

  // ---- without wave284 the migration stops at the top, and nothing is kept
  {
    const db5 = await fresh(false);
    await db5.exec(`create table if not exists public.app_config (key text primary key, value text, updated_at timestamptz default now())`).catch(() => {});
    let msg = '';
    try { await db5.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db5.exec('rollback').catch(() => {});
    ok(msg.includes('wave294 needs wave284 first'), 'without wave284 the migration stops (' + msg + ')');
    ok((await one(db5, `select to_regprocedure('public.crm_tag_aliases()') is null and not exists (select 1 from public.change_log where entity_id = 'wave294') as x`)).x === true, 'and nothing of wave294 is kept');
    await db5.close();
    console.log('without wave284 the migration stops and nothing is kept');
  }

  // ---- a writer that is not wave284's text: the migration stops, keeping nothing
  {
    const db6 = await fresh();
    const moved = def284.replace('v_add := v_add || v_tag;', 'v_add := v_add || lower(v_tag);');
    await db6.exec(moved);
    let msg = '';
    try { await db6.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db6.exec('rollback').catch(() => {});
    ok(msg.includes('its stored text changed'), 'a changed writer stops the migration (' + msg + ')');
    ok((await one(db6, `select to_regprocedure('public.crm_tag_aliases()') is null as x`)).x === true && JSON.parse(await mapText(db6)).Donor.skip === true, 'and nothing is kept');
    await db6.close();
  }

  // ---- the live check files, proved here first on the fixture, each in one transaction
  {
    for (const [label, files] of [['migration twice, live checks', [migration, migration, live]],
                                  ['migration, live checks, undo twice, undo checks, migration, live checks', [migration, live, undo, undo, liveUndo, migration, live]]]) {
      const db7 = await fresh();
      await db7.exec('begin;\n' + files.join('\n') + '\nrollback;');
      ok(true, label);
      console.log('live check files, offline: ' + label + ': passed');
      await db7.close();
    }
  }

  console.log(`w294sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
