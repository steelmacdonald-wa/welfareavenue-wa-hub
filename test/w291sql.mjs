// wave291: offline proof of build/data/wa291_optout_speed.sql and build/data/wa291_undo.sql on PGlite. Run: node test/w291sql.mjs
// Loads test/w291schema.sql (a slice of the live schema with the live text of wa171_digits and wa171_opted_out, and about 2,000 invented contacts),
// checks that text against the md5 of the live definitions (read 06/11/26), then proves, under today's text and under wave281's (test/w291_w281text.sql):
// the migration runs twice and adds two indexes and nothing else; the function is untouched (definition, comment, grants); its query reads the
// contacts index instead of every contact, and under wave281's text looks the number up in the digits index; every answer (every contact, every
// number, every volunteer) is the one it gave before; wave291 and wave281 give the same end state in either order, and wave281's undo leaves the
// indexes alone; the undo, run twice, puts everything back; and an index of either name with another definition stops the migration. Then it runs
// the live check files on the fixture, in the order the live run uses. Standalone. Touches no live database. Exits non-zero on any failure.
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
const W281_MD5 = '36f0272e8a30b9e15a261ebbc961b09b';      // wa171_opted_out after wave281's patch (the live run on 06/11/26 printed the same)
const IDX = 'crm_contacts_wa291_opted_out_idx';
const IDX2 = 'quo_messages_wa291_stop_digits_idx';
const DEF = {
  [IDX]: 'CREATE INDEX crm_contacts_wa291_opted_out_idx ON public.crm_contacts USING btree (id) WHERE (sms_opt_out AND (merged_into IS NULL))',
  [IDX2]: "CREATE INDEX quo_messages_wa291_stop_digits_idx ON public.quo_messages USING btree (wa171_digits(phone)) WHERE ((direction = 'in'::text) AND (handled = ANY (ARRAY['opted_out'::text, 'opted_in'::text])))",
};

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
const reads = (p, idx, table) => p.includes('Index Scan using ' + idx + ' on ' + table) || p.includes('Bitmap Index Scan on ' + idx);
const fnState = (db) => one(db, `select md5(pg_get_functiondef('${FN}'::regprocedure)) as m, pg_get_functiondef('${FN}'::regprocedure) as def,
  obj_description('${FN}'::regprocedure, 'pg_proc') as cmt, (select proacl::text from pg_proc where oid = '${FN}'::regprocedure) as acl`);
const idxState = (db, name) => one(db, `select count(*)::int as n, max(replace(pg_get_indexdef(i.indexrelid), 'public.wa171_digits(', 'wa171_digits(')) as def,
  max(obj_description(i.indexrelid, 'pg_class')) as cmt, max(i.indexrelid::int) as oid, bool_and(i.indisvalid and i.indisready) as valid
  from pg_index i where i.indexrelid = to_regclass('public.${name}')`);
const bothIdx = async (db) => [await idxState(db, IDX), await idxState(db, IDX2)];
// every other index on crm_contacts and quo_messages (wave281's keyword index left out, so the list is the same under both texts)
const otherIdx = (db) => one(db, `select string_agg(pg_get_indexdef(indexrelid), E'\\n' order by pg_get_indexdef(indexrelid)) as x from pg_index
  where indrelid in ('public.crm_contacts'::regclass, 'public.quo_messages'::regclass) and indexrelid is distinct from to_regclass('public.${IDX}')
    and indexrelid is distinct from to_regclass('public.${IDX2}') and indexrelid is distinct from to_regclass('public.quo_messages_wa281_keyword_idx')`);
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
  ok(planBefore.includes('Seq Scan on crm_contacts') && !planBefore.includes('wa291'), "today's text, no index: the query reads every contact (Seq Scan on crm_contacts)");
  console.log("today's text, no index:\n" + planBefore);
  await truths(db, 'today', "today's text, no index");
  let t0 = Date.now();
  const sToday = await answers(db);
  const slow = Date.now() - t0;
  const nAnswers = JSON.parse(sToday).length;
  ok(nAnswers > 4000, 'answers kept: ' + nAnswers);

  await db.exec(migration);
  const once = await bothIdx(db);
  await db.exec(migration);
  const twice = await bothIdx(db);
  for (const [k, name] of [[0, IDX], [1, IDX2]]) {
    ok(once[k].n === 1 && twice[k].n === 1 && once[k].oid === twice[k].oid, 'the migration twice: ' + name + ' created once');
    ok(twice[k].def === DEF[name] && twice[k].valid, name + ' is exactly as defined and valid: ' + twice[k].def);
    ok(/^wave291: /.test(twice[k].cmt || ''), name + ' has its comment');
  }
  ok((await otherIdx(db)).x === beforeIdx.x, 'every other index on crm_contacts and quo_messages is as it was');
  ok((await releaseRows(db, 'wave291')).n === 1, 'one release line after two runs');
  const afterMig = await fnState(db);
  ok(afterMig.def === before.def && afterMig.cmt === before.cmt && afterMig.acl === before.acl, 'wa171_opted_out is untouched: definition, comment and grants (' + afterMig.acl + ')');
  ok((await one(db, `select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relname like '%wa291%'`)).n === 2
     && (await one(db, `select count(*)::int as n from pg_proc where proname like '%wa291%'`)).n === 0, 'nothing besides the two indexes');
  const planAfter = await plan(db);
  ok(reads(planAfter, IDX, 'crm_contacts') && !planAfter.includes('Seq Scan on crm_contacts'), "today's text, with the indexes: the query reads the contacts index");
  console.log("today's text, with the indexes:\n" + planAfter);
  await truths(db, 'today', "today's text, with the indexes");
  t0 = Date.now();
  ok((await answers(db)) === sToday, "today's text: every answer is the same with the indexes (" + nAnswers + ' answers)');
  const fast = Date.now() - t0;
  console.log(`answers, offline: ${slow} ms without the indexes, ${fast} ms with them (${nAnswers} calls)`);

  await db.exec(undo);
  await db.exec(undo);
  const gone = await bothIdx(db);
  ok(gone[0].n === 0 && gone[1].n === 0 && (await otherIdx(db)).x === beforeIdx.x, 'the undo twice: both indexes are gone, the other indexes are as they were');
  const afterUndo = await fnState(db);
  ok(afterUndo.def === before.def && afterUndo.cmt === before.cmt && afterUndo.acl === before.acl, 'wa171_opted_out is as it was after the undo');
  ok((await plan(db)) === planBefore, 'the query plans exactly as before the fix');
  ok((await releaseRows(db, 'wave291 undo')).n === 1 && (await releaseRows(db, 'wave291')).n === 1, 'one undo line after two runs; the release line stays');
  ok((await answers(db)) === sToday, 'after the undo: every answer is the same');
  await db.exec(migration);
  ok((await idxState(db, IDX)).n === 1 && (await idxState(db, IDX2)).n === 1 && reads(await plan(db), IDX, 'crm_contacts') && (await answers(db)) === sToday,
     'the migration goes back on after an undo, with the same answers');
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
  ok(plan281.includes('Seq Scan on crm_contacts') && plan281.includes('quo_messages_wa281_keyword_idx'), "wave281's text, no index: every contact, and every keyword text");
  console.log("wave281's text, no index:\n" + plan281);
  await truths(db2, 'wave281', "wave281's text, no index");
  const s281 = await answers(db2);
  ok(s281 !== sToday, "wave281's answers differ from today's (the stopped numbers)");
  await db2.exec(migration);
  await db2.exec(migration);
  const fn2 = await fnState(db2);
  ok(fn2.def === s281fn.def && fn2.cmt === s281fn.cmt && fn2.acl === s281fn.acl, "wave281's text is untouched by wave291");
  ok((await otherIdx(db2)).x === beforeIdx.x, "under wave281's text too, every other index is as it was");
  const plan281i = await plan(db2);
  ok(reads(plan281i, IDX, 'crm_contacts') && !plan281i.includes('Seq Scan on crm_contacts'), "wave281's text, with the indexes: the query reads the contacts index");
  ok(reads(plan281i, IDX2, 'quo_messages') && plan281i.includes('Index Cond: ((wa171_digits(phone) IS NOT NULL) AND (wa171_digits(phone) = wa171_digits($2)))'),
     "wave281's text, with the indexes: the stopped-phones check looks the number up in the digits index");
  console.log("wave281's text, with the indexes:\n" + plan281i);
  await truths(db2, 'wave281', "wave281's text, with the indexes");
  ok((await answers(db2)) === s281, "wave281's text: every answer is the same with the indexes");
  const endB = { fn: (await fnState(db2)).def, idx: (await bothIdx(db2)).map((x) => x.def).join('\n') };
  // wave281's undo of the function leaves the indexes alone; so does dropping its view and keyword indexes
  await db2.exec(w281undo);
  ok((await fnState(db2)).m === LIVE_MD5 && (await idxState(db2, IDX)).n === 1 && (await idxState(db2, IDX2)).n === 1, "wave281's undo puts today's text back and leaves both indexes");
  ok(reads(await plan(db2), IDX, 'crm_contacts') && (await answers(db2)) === sToday, "then today's text reads the contacts index, with today's answers");
  await db2.exec('drop view if exists public.wa_stopped_phones_v; drop index if exists public.quo_messages_wa281_keyword_idx; drop index if exists public.whatsapp_messages_wa281_keyword_idx;');
  ok((await bothIdx(db2)).map((x) => x.def).join('\n') === DEF[IDX] + '\n' + DEF[IDX2], "wave281's undo of the view and its indexes leaves both wave291 indexes");
  await db2.close();
  console.log('B. wave281, then wave291: every check passed');

  // ---- C. wave291 first, then wave281: wave281's anchor is still there once, and the end state is the same as B's
  const db3 = new PGlite();
  await db3.exec(schema);
  await db3.exec(migration);
  await db3.exec(w281);
  const endC = { fn: (await fnState(db3)).def, idx: (await bothIdx(db3)).map((x) => x.def).join('\n') };
  ok(endC.fn === endB.fn && endC.idx === endB.idx, 'either order gives the same function and the same indexes');
  const planC = await plan(db3);
  ok(reads(planC, IDX, 'crm_contacts') && reads(planC, IDX2, 'quo_messages') && (await answers(db3)) === s281, "wave291, then wave281: both indexes read, with wave281's answers");
  await db3.close();
  console.log('C. wave291, then wave281: every check passed');

  // ---- D. an index of either name with another definition stops the migration, and nothing is kept
  for (const [name, other] of [[IDX, `create index ${IDX} on public.crm_contacts (volunteer_id)`], [IDX2, `create index ${IDX2} on public.quo_messages (phone)`]]) {
    const db4 = new PGlite();
    await db4.exec(schema);
    await db4.exec(other);
    let msg = '';
    try { await db4.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db4.exec('rollback').catch(() => {});
    ok(msg.includes('wave291: ' + name + ' exists with another definition'), 'a different index named ' + name + ' stops the migration (' + msg + ')');
    ok((await releaseRows(db4, 'wave291')).n === 0 && (await one(db4, `select count(*)::int as n from pg_class where relname like '%wa291%'`)).n === 1, 'and nothing of wave291 is kept');
    await db4.close();
  }
  console.log('D. a moved index stops the migration');

  // ---- E. the live check files (run on live only inside build/sql_rollback_test.py's block), on the fixture, in one transaction, as the live run
  const L = { before: read('w291live_before.sql'), time: read('w291live_time.sql'), live: read('w291live.sql'), liveUndo: read('w291live_undo.sql'),
              marked: read('w291live_marked.sql'), report: read('w291live_report.sql') };
  const RUN = [L.before, L.time, w281, L.before, L.time, migration, migration, L.live, L.time, L.marked, w281undo, L.live, L.time, L.marked,
               undo, undo, L.liveUndo, migration, w281, L.live, L.report];
  const RUN_AFTER_281 = [L.before, L.time, migration, migration, L.live, L.time, L.marked, undo, undo, L.liveUndo, migration, L.live, L.report];
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
    ok(!/\?\)/.test(res), label + ': every timing has its plan lines');
    ok((await idxState(db5, IDX)).n === 0 && (await idxState(db5, IDX2)).n === 0 && (await fnState(db5)).def === start.def
       && (await one(db5, 'select count(*)::int as n from public.change_log')).n === 0
       && (await one(db5, 'select count(*)::int as n from public.crm_contacts')).n === 2000, label + ': everything rolled back');
    console.log('live check files, offline: ' + label + ':\n  ' + res);
    await db5.close();
  }
  // a failing check stops the run with its own message (the migration is left out, so the first assertion after it must fail)
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
