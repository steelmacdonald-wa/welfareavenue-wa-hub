// wave283: offline proof of build/data/wa283_page.sql and build/data/wa283_undo.sql on PGlite. Run: node test/w283sql.mjs
// Loads test/w281schema.sql and build/data/wa281_rules.sql (wave281 is built on this branch, not live yet), then test/w283schema.sql (the live text of
// the five receipt functions wave283 changes, the crm_donations policies, hub_i18n), checks that text against the md5 of the live definitions (read
// 06/11/26), then runs the migration twice (the second run must change nothing), test/w283sql.sql twice (it rolls back), the undo twice (the five
// functions and the three old policies back exactly: definition, comment and grants; the trigger, its function and the three words gone), and the
// migration and assertions once more after the undo. Also: the migration stops without wave281, a moved anchor stops it, and the live check files
// (test/w283live_before.sql, w283live.sql, w283live_undo.sql) pass here first. Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema281 = read('w281schema.sql');
const mig281 = read('../build/data/wa281_rules.sql');
const schema = read('w283schema.sql');
const migration = read('../build/data/wa283_page.sql');
const undo = read('../build/data/wa283_undo.sql');
const assertions = read('w283sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(withWave281 = true) {
  const db = new PGlite();
  await db.exec(schema281);
  if (withWave281) await db.exec(mig281);
  await db.exec(schema);
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w283sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}

// the five live functions wave283 changes, with the md5 of pg_get_functiondef as live had it on 06/11/26
const LIVE = {
  'public.crm_receipt_issue(bigint[])': '3322edddbabd63a4838e055b53bbe355',
  'public.crm_receipt_replace(bigint,text)': 'cc327753104e9c3549682549050ed43e',
  'public.crm_receipt_cancel(bigint,text)': '09a7b4d82bdaf05efd6a0ef839f129c0',
  'public.crm_receipt_config()': '68243b922a2dd8626076cf84ab262569',
  'public.crm_receipt_doc(bigint)': '9675fe7eee707d17b869dac0d6f27329',
};
const PATCHED = Object.keys(LIVE);
// the live crm_donations policies (06/11/26), as pg_get_expr prints them here
const OLD_POLICIES = 'crm_donations_admin_delete:d:is_wa_admin():,crm_donations_staff_insert:a::(is_wa_staff() AND COALESCE(wa_page_ok(\'crm\'::text), true)),'
  + 'crm_donations_staff_read:r:(is_wa_staff() AND COALESCE(wa_page_ok(\'crm\'::text), true)):,'
  + 'crm_donations_staff_update:w:(is_wa_staff() AND COALESCE(wa_page_ok(\'crm\'::text), true)):(is_wa_staff() AND COALESCE(wa_page_ok(\'crm\'::text), true))';

async function snapshot(db) {
  const out = {};
  for (const f of PATCHED) {
    out[f] = await one(db, `select pg_get_functiondef('${f}'::regprocedure) as def, obj_description('${f}'::regprocedure, 'pg_proc') as cmt,
      (select proacl::text from pg_proc where oid = '${f}'::regprocedure) as acl`);
  }
  out.policies = (await one(db, `select string_agg(polname || ':' || polcmd::text || ':' || coalesce(pg_get_expr(polqual, polrelid), '') || ':' || coalesce(pg_get_expr(polwithcheck, polrelid), ''), ',' order by polname) as p
    from pg_policy where polrelid = 'public.crm_donations'::regclass`)).p;
  out.roles = (await one(db, `select string_agg(polname || '=' || polroles::regrole[]::text, ',' order by polname) as r from pg_policy where polrelid = 'public.crm_donations'::regclass`)).r;
  out.triggers = (await one(db, `select string_agg(tgname, ',' order by tgname) as t from pg_trigger where tgrelid = 'public.crm_donations'::regclass and not tgisinternal`)).t;
  out.i18n = (await one(db, `select string_agg(en || '=' || tr || '/' || kind, ',' order by en) as w from public.hub_i18n`)).w;
  return out;
}
const COUNTS = `select (select count(*)::int from public.hub_i18n) as words, (select count(*)::int from public.change_log where entity_type = 'release' and entity_id = 'wave283') as release_rows,
  (select count(*)::int from pg_policy where polrelid = 'public.crm_donations'::regclass) as policies, (select count(*)::int from pg_trigger where tgname = 'trg_wa283_gift_audit') as triggers,
  (select count(*)::int from public.change_log where entity_type = 'crm_donations') as gift_log`;

try {
  const db = await fresh();

  // ---- the fixture holds the live text: md5 of every changed function equals live's, and the policies are live's
  for (const f of PATCHED) ok((await one(db, `select md5(pg_get_functiondef('${f}'::regprocedure)) as m`)).m === LIVE[f], f + ': the fixture text is the live text (md5)');
  const before = await snapshot(db);
  ok(before.policies === OLD_POLICIES, 'crm_donations: the fixture has the four live policies (' + before.policies + ')');
  console.log('fixture: the five receipt functions match the live md5s; crm_donations has the four live policies');

  // ---- before the migration the assertions fail
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = /crm_donations: the read policy and the three gifts_edit policies|Assertion failed|assert/i.test(String(e.message)); }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  const first = await one(db, COUNTS);
  const afterOnce = await snapshot(db);
  await db.exec(migration);
  const second = await one(db, COUNTS);
  console.log('wa283: applied twice with no error', JSON.stringify(second));
  ok(JSON.stringify(first) === JSON.stringify(second), 'a second run adds nothing: ' + JSON.stringify(first) + ' vs ' + JSON.stringify(second));
  ok(first.words === 6 && first.release_rows === 1 && first.policies === 4 && first.triggers === 1 && first.gift_log === 0,
    'three words added (3 + 3), one release line, four policies, one trigger, no gift log rows from the migration itself (' + JSON.stringify(first) + ')');
  const afterMig = await snapshot(db);
  for (const f of PATCHED) {
    ok(afterMig[f].def !== before[f].def, f + ' was patched');
    ok(afterMig[f].def === afterOnce[f].def, f + ' is patched once only (the second run skipped it)');
    ok(afterMig[f].acl === before[f].acl, f + ' keeps its grants (' + afterMig[f].acl + ')');
    ok(/wave283/.test(afterMig[f].cmt || ''), f + ' has a comment that says what wave283 changed');
    ok(afterMig[f].def.length - before[f].def.length < 200, f + ' changed by its anchor only');
  }
  const def = (f) => afterMig[f].def;
  ok(def('public.crm_receipt_issue(bigint[])').includes(`begin\n  if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can issue a receipt.'; end if;\n  if coalesce((select value`),
    'crm_receipt_issue: gifts_edit in place of the admin check, first, before the mode check');
  ok(def('public.crm_receipt_replace(bigint,text)').includes(`begin\n  if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can replace a receipt.'; end if;`), 'crm_receipt_replace: gifts_edit');
  ok(def('public.crm_receipt_cancel(bigint,text)').includes(`begin\n  if not coalesce(public.wa_can('gifts_edit'), false) then raise exception 'Only team leads, admins and finance can cancel a receipt.'; end if;`), 'crm_receipt_cancel: gifts_edit');
  ok(def('public.crm_receipt_config()').includes(`'is_admin', coalesce(public.is_wa_admin(), false),\n      'can_issue', coalesce(public.wa_can('gifts_edit'), false),\n      'signature'`), 'crm_receipt_config: can_issue right after is_admin');
  ok(def('public.crm_receipt_doc(bigint)').includes(`'is_admin', v_svc or coalesce(public.is_wa_admin(), false), 'can_issue', v_svc or coalesce(public.wa_can('gifts_edit'), false));`), 'crm_receipt_doc: can_issue, the service role included');
  ok(afterMig.triggers === before.triggers.split(',').concat('trg_wa283_gift_audit').sort().join(','), 'one trigger more on crm_donations (' + afterMig.triggers + ')');
  ok(afterMig.roles === 'crm_donations_gifts_delete={authenticated},crm_donations_gifts_insert={authenticated},crm_donations_gifts_update={authenticated},crm_donations_staff_read={authenticated}', 'the policies are for authenticated: ' + afterMig.roles);
  ok((await one(db, `select obj_description('public.wa283_gift_audit()'::regprocedure, 'pg_proc') is not null as x`)).x === true, 'wa283_gift_audit has a comment');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa283 undo: applied twice with no error');
  const afterUndo = await snapshot(db);
  for (const f of PATCHED) {
    ok(afterUndo[f].def === before[f].def, f + ' is back exactly as live has it (pg_get_functiondef)');
    ok((await one(db, `select md5(pg_get_functiondef('${f}'::regprocedure)) as m`)).m === LIVE[f], f + ' is back (md5 as live)');
    ok(afterUndo[f].cmt === before[f].cmt, f + ' comment is back as it was');
    ok(afterUndo[f].acl === before[f].acl, f + ' grants are back as they were (' + afterUndo[f].acl + ')');
  }
  ok(afterUndo.policies === before.policies && afterUndo.roles === before.roles, 'the four live crm_donations policies are back exactly');
  ok(afterUndo.triggers === before.triggers, 'the crm_donations triggers are as before (' + afterUndo.triggers + ')');
  ok((await one(db, `select to_regprocedure('public.wa283_gift_audit()') is null as x`)).x === true, 'wa283_gift_audit is gone');
  ok(afterUndo.i18n === before.i18n, 'hub_i18n is as before (' + afterUndo.i18n + ')');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave283' and field = 'wave283 undo'`)).n === 1, 'one undo line after two runs');
  console.log('wa283 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await one(db, COUNTS);
  ok(again.words === first.words && again.policies === first.policies && again.triggers === first.triggers, 'the same words, policies and trigger again after an undo');
  await db.close();

  // ---- without wave281 the migration stops at the top, and nothing is kept
  {
    const db2 = await fresh(false);
    let msg = '';
    try { await db2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db2.exec('rollback').catch(() => {});
    ok(msg.includes('wave283 needs wave281 first'), 'without wave281 the migration stops (' + msg + ')');
    ok((await one(db2, `select count(*)::int as n from pg_policy where polname like 'crm_donations_gifts_%'`)).n === 0 && (await one(db2, `select to_regprocedure('public.wa283_gift_audit()') is null as x`)).x === true, 'and nothing of wave283 is kept');
    await db2.close();
  }

  // ---- a live function that moved stops the whole migration (one transaction, as the connector runs it), and nothing is kept
  for (const [f, from, to] of [['crm_receipt_cancel(bigint,text)', `'Only an admin can cancel a receipt.'`, `'Only an admin may cancel a receipt.'`],
                               ['crm_receipt_doc(bigint)', `'is_admin', v_svc or coalesce(public.is_wa_admin(), false));`, `'is_admin', coalesce(public.is_wa_admin(), false) or v_svc);`]]) {
    const db3 = await fresh();
    await db3.exec(`do $m$ declare v text := pg_get_functiondef('public.${f}'::regprocedure); begin execute replace(v, $q$${from}$q$, $q$${to}$q$); end $m$;`);
    let msg = '';
    try { await db3.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db3.exec('rollback').catch(() => {});
    ok(msg.includes('wave283: a live function moved: ' + f.split('(')[0]), 'a moved ' + f + ' stops the migration (' + msg + ')');
    ok((await one(db3, `select count(*)::int as n from pg_policy where polname like 'crm_donations_gifts_%'`)).n === 0 && (await one(db3, `select to_regprocedure('public.wa283_gift_audit()') is null as x`)).x === true
       && (await one(db3, `select count(*)::int as n from pg_policy where polname = 'crm_donations_admin_delete'`)).n === 1, 'and nothing of wave283 is kept');
    await db3.close();
  }
  console.log('without wave281, or with a moved anchor, the migration stops and nothing is kept');

  // ---- the live check files (run on live only inside build/sql_rollback_test.py's block), proved here first on the fixture, each in one transaction
  {
    const lb = read('w283live_before.sql'), live = read('w283live.sql'), liveUndo = read('w283live_undo.sql');
    for (const [label, files] of [['wave281, before, migration twice, live checks', [lb, migration, migration, live]],
                                  ['wave281, before, migration, undo twice, undo checks, migration, live checks', [lb, migration, undo, undo, liveUndo, migration, live]]]) {
      const db4 = await fresh();
      await db4.exec('begin;\n' + files.join('\n') + '\nrollback;');
      ok(true, label);
      console.log('live check files, offline: ' + label + ': passed');
      await db4.close();
    }
  }

  console.log(`w283sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
