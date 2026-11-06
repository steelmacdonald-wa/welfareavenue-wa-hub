// wave291: offline proof of build/data/wa291_optout_speed.sql and build/data/wa291_undo.sql on PGlite. Run: node test/w291sql.mjs
// Loads test/w291schema.sql (a slice of the live schema with the live text of wa171_digits and wa171_opted_out, and about 2,000 invented contacts),
// checks that text against the md5 of the live definitions (read 06/11/26), then proves, under today's text and under wave281's (test/w291_w281text.sql):
// the migration runs twice and adds one index and nothing else; the function is untouched (definition, comment, grants); its query reads the index
// instead of every contact; every answer (every contact, every number, every volunteer) is the one it gave before; wave291 and wave281 give the same
// end state in either order, and wave281's undo leaves the index alone; the undo, run twice, puts everything back; and an index of the same name with
// another definition stops the migration. Then it runs the live check files on the fixture, in the order the live run uses. Standalone. Touches no
// live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w291schema.sql');
const migration = read('../build/data/wa291_optout_speed.sql');
const undo = read('../build/data/wa291_undo.sql');
const w281 = read('w291_w281text.sql');
const w281undo = read('w291_w281undo.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

const FN = 'public.wa171_opted_out(bigint,text)';
const LIVE_MD5 = '48dadf0669b7f5d0b7ea4652c612c4da';      // wa171_opted_out, pg_get_functiondef on live, 06/11/26
const DIGITS_MD5 = 'c6c319d1e8327252297ec0e4a2f1b986';    // wa171_digits, the same
const W281_MD5 = '36f0272e8a30b9e15a261ebbc961b09b';      // wa171_opted_out after wave281's patch (the live run prints the same)
const IDX = 'crm_contacts_wa291_opted_out_idx';
const IDX_DEF = 'CREATE INDEX crm_contacts_wa291_opted_out_idx ON public.crm_contacts USING btree (id) WHERE (sms_opt_out AND (merged_into IS NULL))';

// every answer: every contact as the text schedule asks (its volunteer and first number), every number, every volunteer (with or without a contact)
const ANSWERS = `select coalesce(json_agg(a order by a.kind, a.k), '[]')::text as j from (
    select 'contact' as kind, x.id::text as k, public.wa171_opted_out(x.volunteer_id, x.phones[1]) as answer from public.crm_contacts x
    union all
    select 'phone', y.phone, public.wa171_opted_out(null, y.phone)
      from (select unnest(c.phones) as phone from public.crm_contacts c union select q.phone from public.quo_messages q where q.direction = 'in'
            union values ('5559990005'), ('(555) 000-0007'), ('555 000 0047')) y
    union all
    select 'volunteer', v.id::text, public.wa171_opted_out(v.id, null) from public.volunteer_profiles v) a`;
// [person, phone, today's answer, wave281's answer]: what the fixture was built to say
const TRUTHS = [
  [null, '(555) 000-0007', true, true],      // contact 7 is marked no texts; its number in another spelling
  [null, '555.000.0023', true, true],        // contact 23 is marked
  [null, '+1 555 000 0023', true, true],     // contact 25 holds 23's number: anyone with that number
  [null, '555.000.0047', false, false],      // contact 47 is marked but merged
  [29, null, false, false],                  // contact 87 (volunteer 29) is marked but merged
  [null, '15550000087', false, false],
  [69, null, true, true],                    // contact 207 (volunteer 69) is marked
  [1, null, false, false],                   // contact 3 (volunteer 1) is not
  [null, '555.000.0011', false, true],       // contact 11 texted STOP but is not marked in the CRM: wave281 says opted out
  [null, '+1 555 999 0001', false, true],    // a STOP from a number nobody holds
  [null, '555 999 0004', false, true],       // START, then STOP
  [null, '5550000010', false, false],        // STOP, then START
  [null, '5559990005', false, false],        // a STOP on WhatsApp is not a text STOP
  [null, null, false, false],
];
const lit = (v) => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${v}'`);
async function truths(db, which, label) {
  for (const [p, ph, today, w] of TRUTHS) {
    const got = (await one(db, `select public.wa171_opted_out(${lit(p)}, ${lit(ph)}) as x`)).x;
    ok(got === (which === 'wave281' ? w : today), `${label}: wa171_opted_out(${lit(p)}, ${lit(ph)}) is ${got}`);
  }
}
async function plan(db) {
  const src = (await one(db, `select prosrc from pg_proc where oid = '${FN}'::regprocedure`)).prosrc;
  const q = src.replace(/\bp_person\b/g, '$1::bigint').replace(/\bp_phone\b/g, '$2::text').replace(/;\s*$/, '');
  return (await db.exec('explain (generic_plan) ' + q))[0].rows.map((r) => r['QUERY PLAN'].replace(/\s*\(cost=[^)]*\)/g, '')).join('\n');
}
const usesIndex = (p) => p.includes('Index Scan using ' + IDX + ' on crm_contacts') || p.includes('Bitmap Index Scan on ' + IDX);
const fnState = (db) => one(db, `select md5(pg_get_functiondef('${FN}'::regprocedure)) as m, pg_get_functiondef('${FN}'::regprocedure) as def,
  obj_description('${FN}'::regprocedure, 'pg_proc') as cmt, (select proacl::text from pg_proc where oid = '${FN}'::regprocedure) as acl`);
const idxState = (db) => one(db, `select count(*)::int as n, max(pg_get_indexdef(i.indexrelid)) as def, max(obj_description(i.indexrelid, 'pg_class')) as cmt,
  max(i.indexrelid::int) as oid, bool_and(i.indisvalid and i.indisready) as valid from pg_index i where i.indexrelid = to_regclass('public.${IDX}')`);
const otherIdx = (db) => one(db, `select string_agg(pg_get_indexdef(indexrelid), E'\\n' order by pg_get_indexdef(indexrelid)) as x from pg_index
  where indrelid = 'public.crm_contacts'::regclass and indexrelid is distinct from to_regclass('public.${IDX}')`);
const releaseRows = (db, field) => one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave291' and field = '${field}'`);
const answers = async (db) => (await one(db, ANSWERS)).j;

try {
  // ---- A. today's text
  const db = new PGlite();
  await db.exec(schema);
  ok((await fnState(db)).m === LIVE_MD5, 'wa171_opted_out: the fixture text is the live text (md5)');
  ok((await one(db, `select md5(pg_get_functiondef('public.wa171_digits(text)'::regprocedure)) as m`)).m === DIGITS_MD5, 'wa171_digits: the fixture text is the live text (md5)');
  const shape = await one(db, `select count(*)::int as n, count(*) filter (where sms_opt_out)::int as opted, count(*) filter (where merged_into is not null)::int as merged,
    count(*) filter (where sms_opt_out and merged_into is null)::int as opted_live, (select relpages from pg_class where oid = 'public.crm_contacts'::regclass) as pages from public.crm_contacts`);
  ok(shape.n === 2000 && shape.opted === 20 && shape.opted_live === 18 && shape.merged === 22 && shape.pages >= 250,
     'the fixture: 2,000 contacts, 20 marked no texts (18 not merged), 22 merged, about 300 pages (' + JSON.stringify(shape) + ')');
  console.log('fixture: wa171_opted_out and wa171_digits match the live md5s; ' + JSON.stringify(shape));

  const before = await fnState(db);
  const beforeIdx = await otherIdx(db);
  const planBefore = await plan(db);
  ok(planBefore.includes('Seq Scan on crm_contacts') && !planBefore.includes(IDX), "today's text, no index: the query reads every contact (Seq Scan on crm_contacts)");
  console.log("today's text, no index:\n" + planBefore);
  await truths(db, 'today', "today's text, no index");
  let t0 = Date.now();
  const sToday = await answers(db);
  const slow = Date.now() - t0;
  const nAnswers = JSON.parse(sToday).length;
  ok(nAnswers > 4000, 'answers kept: ' + nAnswers);

  await db.exec(migration);
  const once = await idxState(db);
  await db.exec(migration);
  const twice = await idxState(db);
  ok(once.n === 1 && twice.n === 1 && once.oid === twice.oid, 'the migration twice: one index, created once');
  ok(twice.def === IDX_DEF && twice.valid, 'the index is exactly as defined and valid: ' + twice.def);
  ok(/^wave291: /.test(twice.cmt || ''), 'the index has its comment');
  ok((await otherIdx(db)).x === beforeIdx.x, 'every other index on crm_contacts is as it was');
  ok((await releaseRows(db, 'wave291')).n === 1, 'one release line after two runs');
  const afterMig = await fnState(db);
  ok(afterMig.def === before.def && afterMig.cmt === before.cmt && afterMig.acl === before.acl, 'wa171_opted_out is untouched: definition, comment and grants (' + afterMig.acl + ')');
  ok((await one(db, `select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relname like '%wa291%'`)).n === 1
     && (await one(db, `select count(*)::int as n from pg_proc where proname like '%wa291%'`)).n === 0, 'nothing besides the index');
  const planAfter = await plan(db);
  ok(usesIndex(planAfter) && !planAfter.includes('Seq Scan on crm_contacts'), "today's text, with the index: the query reads the index");
  console.log("today's text, with the index:\n" + planAfter);
  await truths(db, 'today', "today's text, with the index");
  t0 = Date.now();
  ok((await answers(db)) === sToday, "today's text: every answer is the same with the index (" + nAnswers + ' answers)');
  const fast = Date.now() - t0;
  console.log(`answers, offline: ${slow} ms without the index, ${fast} ms with it (${nAnswers} calls)`);

  await db.exec(undo);
  await db.exec(undo);
  ok((await idxState(db)).n === 0 && (await otherIdx(db)).x === beforeIdx.x, 'the undo twice: the index is gone, the other indexes are as they were');
  const afterUndo = await fnState(db);
  ok(afterUndo.def === before.def && afterUndo.cmt === before.cmt && afterUndo.acl === before.acl, 'wa171_opted_out is as it was after the undo');
  ok((await plan(db)) === planBefore, 'the query plans exactly as before the fix');
  ok((await releaseRows(db, 'wave291 undo')).n === 1 && (await releaseRows(db, 'wave291')).n === 1, 'one undo line after two runs; the release line stays');
  ok((await answers(db)) === sToday, "after the undo: every answer is the same");
  await db.exec(migration);
  ok((await idxState(db)).n === 1 && usesIndex(await plan(db)) && (await answers(db)) === sToday, 'the migration goes back on after an undo, with the same answers');
  ok((await releaseRows(db, 'wave291')).n === 1, 'still one release line');
  await db.close();
  console.log("A. today's text: every check passed");

  // ---- B. wave281 first, then wave291
  const db2 = new PGlite();
  await db2.exec(schema);
  await db2.exec(w281);
  const s281fn = await fnState(db2);
  ok(s281fn.m === W281_MD5, "wave281's text loaded (md5 " + s281fn.m + ')');
  ok(s281fn.def.split('wa_stopped_phones_v').length === 2, "wave281's text has its stopped-phones check once");
  await db2.exec(w281);
  ok((await fnState(db2)).def === s281fn.def, "wave281's text, loaded twice, is patched once");
  const plan281 = await plan(db2);
  ok(plan281.includes('Seq Scan on crm_contacts'), "wave281's text, no index: the query reads every contact");
  console.log("wave281's text, no index:\n" + plan281);
  await truths(db2, 'wave281', "wave281's text, no index");
  const s281 = await answers(db2);
  ok(s281 !== sToday, "wave281's answers differ from today's (the stopped numbers)");
  await db2.exec(migration);
  await db2.exec(migration);
  const fn2 = await fnState(db2);
  ok(fn2.def === s281fn.def && fn2.cmt === s281fn.cmt && fn2.acl === s281fn.acl, "wave281's text is untouched by wave291");
  const plan281i = await plan(db2);
  ok(usesIndex(plan281i) && !plan281i.includes('Seq Scan on crm_contacts'), "wave281's text, with the index: the query reads the index");
  console.log("wave281's text, with the index:\n" + plan281i);
  await truths(db2, 'wave281', "wave281's text, with the index");
  ok((await answers(db2)) === s281, "wave281's text: every answer is the same with the index");
  const endB = { fn: (await fnState(db2)).def, idx: (await idxState(db2)).def };
  // wave281's undo of the function leaves the index alone; so does dropping its view and keyword indexes
  await db2.exec(w281undo);
  ok((await fnState(db2)).m === LIVE_MD5 && (await idxState(db2)).n === 1, "wave281's undo puts today's text back and leaves the index");
  ok(usesIndex(await plan(db2)) && (await answers(db2)) === sToday, "then today's text reads the index, with today's answers");
  await db2.exec('drop view if exists public.wa_stopped_phones_v; drop index if exists public.quo_messages_wa281_keyword_idx; drop index if exists public.whatsapp_messages_wa281_keyword_idx;');
  ok((await idxState(db2)).n === 1 && (await idxState(db2)).def === IDX_DEF, "wave281's undo of the view and its indexes leaves the wave291 index");
  await db2.close();
  console.log('B. wave281, then wave291: every check passed');

  // ---- C. wave291 first, then wave281: wave281's anchor is still there once, and the end state is the same as B's
  const db3 = new PGlite();
  await db3.exec(schema);
  await db3.exec(migration);
  await db3.exec(w281);
  const endC = { fn: (await fnState(db3)).def, idx: (await idxState(db3)).def };
  ok(endC.fn === endB.fn && endC.idx === endB.idx, 'either order gives the same function and the same index');
  ok(usesIndex(await plan(db3)) && (await answers(db3)) === s281, "wave291, then wave281: the query reads the index, with wave281's answers");
  await db3.close();
  console.log('C. wave291, then wave281: every check passed');

  // ---- D. an index of the same name with another definition stops the migration, and nothing is kept
  const db4 = new PGlite();
  await db4.exec(schema);
  await db4.exec(`create index ${IDX} on public.crm_contacts (volunteer_id)`);
  let msg = '';
  try { await db4.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
  await db4.exec('rollback').catch(() => {});
  ok(msg.includes('wave291: ' + IDX + ' exists with another definition'), 'a different index of the same name stops the migration (' + msg + ')');
  ok((await releaseRows(db4, 'wave291')).n === 0 && (await idxState(db4)).def.includes('(volunteer_id)'), 'and nothing of wave291 is kept');
  await db4.close();
  console.log('D. a moved index stops the migration');

  // ---- E. the live check files (run on live only inside build/sql_rollback_test.py's block), on the fixture, in one transaction, as the live run
  const L = { before: read('w291live_before.sql'), time: read('w291live_time.sql'), live: read('w291live.sql'), liveUndo: read('w291live_undo.sql'),
              more: read('w291live_more.sql'), report: read('w291live_report.sql') };
  const RUN = [L.before, L.time, w281, L.before, L.time, migration, migration, L.live, L.time, L.more, w281undo, L.live, L.time,
               undo, undo, L.liveUndo, migration, w281, L.live, L.report];
  const RUN_AFTER_281 = [L.before, L.time, migration, migration, L.live, L.time, L.more, undo, undo, L.liveUndo, migration, L.live, L.report];
  for (const [label, pre, files] of [["today's live (wave281 not released): the full run", '', RUN],
                                     ['after wave281 is released: the shorter run', w281, RUN_AFTER_281]]) {
    const db5 = new PGlite();
    await db5.exec(schema);
    if (pre) await db5.exec(pre);
    const start = await fnState(db5);
    let res = '';
    try { await db5.exec('begin;\n' + files.join('\n') + '\nrollback;'); } catch (e) { res = String(e.message); }
    await db5.exec('rollback').catch(() => {});
    ok(/^W291_TIMING over \d+ contacts: /.test(res), label + ': the run ends with its report (' + res + ')');
    ok(!/W291_TIMING.*\?/.test(res.split('Answers:')[0]), label + ': every timing has its plan line');
    ok((await idxState(db5)).n === 0 && (await fnState(db5)).def === start.def && (await one(db5, 'select count(*)::int as n from public.change_log')).n === 0
       && (await one(db5, 'select count(*)::int as n from public.crm_contacts')).n === 2000, label + ': everything rolled back');
    console.log('live check files, offline: ' + label + ':\n  ' + res);
    await db5.close();
  }
  // a failing check stops the run with its own message (the index is left out, so the first assertion after the migration must fail)
  {
    const db6 = new PGlite();
    await db6.exec(schema);
    let res = '';
    try { await db6.exec('begin;\n' + [L.before, L.live].join('\n') + '\nrollback;'); } catch (e) { res = String(e.message); }
    await db6.exec('rollback').catch(() => {});
    ok(res.startsWith('w291live: crm_contacts_wa291_opted_out_idx is missing'), 'without the migration the live checks fail (' + res + ')');
    await db6.close();
  }

  console.log(`w291sql.mjs: OK (${checks} checks)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
