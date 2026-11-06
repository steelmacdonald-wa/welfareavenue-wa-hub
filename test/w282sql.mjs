// wave282: offline proof of build/data/wa282_mail_rule.sql and build/data/wa282_undo.sql on PGlite. Run: node test/w282sql.mjs
// wave282 needs wave281 live first, so this loads test/w281schema.sql (a slice of the live schema; crm_email_permission's text matches live's md5 of
// 06/11/26), runs build/data/wa281_rules.sql, checks crm_email_permission against the md5 of the text wave281 leaves (the text wa282_undo.sql restores),
// then loads test/w282schema.sql (Sends, lists, the email history columns, the exemption row, invented people). It runs the migration twice (the second
// run changes nothing), test/w282sql.sql twice (it rolls back), the undo twice (crm_email_permission, the kind check, the column comment and the setting
// are back exactly: definition, comment and grants; the new functions are gone), and the migration and assertions once more after the undo. Then: a
// moved anchor stops the migration, the migration refuses to run without wave281, the undo run after wave281's undo leaves the older function alone,
// and the live check files pass on the fixture. Files are read with CRLF turned into LF (a Windows checkout may hold CRLF; git and live hold LF).
// Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8').replace(/\r\n/g, '\n');
const schema281 = read('w281schema.sql');
const rules281 = read('../build/data/wa281_rules.sql');
const undo281 = read('../build/data/wa281_undo.sql');
const schema = read('w282schema.sql');
const migration = read('../build/data/wa282_mail_rule.sql');
const undo = read('../build/data/wa282_undo.sql');
const assertions = read('w282sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

const PERM = 'public.crm_email_permission(bigint,text)';
const LIVE_MD5 = 'd402bc0355e20acf98bb2c30689a0e93';        // live on 06/11/26, before wave281
const AFTER281_MD5 = '38706b7765216153dfe4b4f30aea3c5a';    // the same text with wave281's do-not-contact patch: what wa282_undo.sql restores
const OLD_CHECK = "CHECK ((kind = ANY (ARRAY['newsletter'::text, 'fundraising'::text, 'volunteer'::text, 'transactional'::text])))";
const NEW_CHECK = "CHECK ((kind = ANY (ARRAY['newsletter'::text, 'fundraising'::text, 'volunteer'::text])))";
const ADDED_FNS = ['public.crm_email_first_contact(bigint)', 'public.wa282_newsletter_lists(text)'];
const NEW_LINE = "  if p_kind in ('newsletter', 'fundraising') then return query select true, 'not unsubscribed (WA rule of 5 Nov 2026)'::text, null::date, c.em::text, c.st::text; return; end if;";

async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w282sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
async function snapshot(db) {
  return {
    perm: await one(db, `select pg_get_functiondef('${PERM}'::regprocedure) as def, md5(pg_get_functiondef('${PERM}'::regprocedure)) as md5,
      obj_description('${PERM}'::regprocedure, 'pg_proc') as cmt, (select proacl::text from pg_proc where oid = '${PERM}'::regprocedure) as acl`),
    check: (await one(db, `select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'public.crm_campaigns'::regclass and conname = 'crm_campaigns_kind_check'`)).d,
    kindCmt: (await one(db, `select col_description('public.crm_campaigns'::regclass, (select attnum from pg_attribute where attrelid = 'public.crm_campaigns'::regclass and attname = 'kind')) as c`)).c,
    setting: (await one(db, `select coalesce((select value from public.app_config where key = 'mail_fundraising_exemption'), '(none)') as v`)).v,
    release: (await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave282' and field = 'wave282'`)).n,
  };
}
async function base() {
  const db = new PGlite();
  await db.exec(schema281);
  ok((await one(db, `select md5(pg_get_functiondef('${PERM}'::regprocedure)) as m`)).m === LIVE_MD5, 'the wave281 fixture holds the live crm_email_permission (md5)');
  await db.exec(rules281);
  ok((await one(db, `select md5(pg_get_functiondef('${PERM}'::regprocedure)) as m`)).m === AFTER281_MD5, 'after wave281, crm_email_permission is the text wa282_undo.sql restores (md5)');
  await db.exec(schema);
  return db;
}

try {
  const db = await base();
  console.log('fixture: crm_email_permission is live\'s text (' + LIVE_MD5 + '), then wave281\'s (' + AFTER281_MD5 + ')');

  // ---- before: the state wave282 starts from, and the failing state
  const before = await snapshot(db);
  ok(before.check === OLD_CHECK && before.setting === 'off' && before.release === 0, 'before: the old kind check, the setting off, no release line');
  let failedOn = '';
  try { await db.exec(assertions); } catch (e) { failedOn = String(e.message); }
  await db.exec('rollback').catch(() => {});
  ok(failedOn === 'newsletter, unknown consent: allowed, not unsubscribed (WA rule of 5 Nov 2026)', 'before the migration the assertions fail on the first rule check (' + failedOn + ')');
  console.log('before the migration: the assertions fail on the old rule, as they should (' + failedOn + ')');

  // ---- the migration, twice
  await db.exec(migration);
  const once = await snapshot(db);
  await db.exec(migration);
  const twice = await snapshot(db);
  console.log('wa282: applied twice with no error');
  ok(JSON.stringify(once) === JSON.stringify(twice), 'a second run changes nothing (definition, comment, grants, check, setting, release line)');
  ok(twice.perm.def !== before.perm.def, 'crm_email_permission was patched');
  ok(twice.perm.acl === before.perm.acl, 'crm_email_permission keeps its grants (' + twice.perm.acl + ')');
  ok(twice.perm.cmt !== before.perm.cmt && /wave282/.test(twice.perm.cmt), 'crm_email_permission has a comment that says what wave282 did');
  ok(twice.check === NEW_CHECK, 'the kind check is the three kinds (' + twice.check + ')');
  ok(/Since wave282/.test(twice.kindCmt), 'the crm_campaigns.kind comment is the wave282 one');
  ok(twice.setting === '(none)', 'mail_fundraising_exemption is deleted');
  ok(twice.release === 1, 'one release line after two runs');
  const d = twice.perm.def;
  ok(d.split(NEW_LINE).length === 2, 'the new line is there exactly once');
  ok(!d.includes('mail_fundraising_exemption') && !d.includes('CASL s.6'), 'the fundraising-exemption block is gone');
  ok(d.includes(`    return;\n  end if;\n${NEW_LINE}\n  return query select false, (case when imp_until`), 'the new line sits after implied consent, before the last refusal');
  ok(d.includes(`  if p_kind = 'volunteer' then\n    return query select true, 'volunteer message: not unsubscribed (the team''s rule since 27/09/26)'::text, null::date, c.em::text, c.st::text; return;\n  end if;`),
    'the volunteer branch is unchanged');
  ok(d.replace(NEW_LINE, before.perm.def.slice(before.perm.def.indexOf("  if p_kind = 'fundraising' then"), before.perm.def.indexOf("  return query select false, (case when imp_until") - 1)) === before.perm.def,
    'nothing else in crm_email_permission changed');
  for (const f of ADDED_FNS) ok((await one(db, `select obj_description('${f}'::regprocedure, 'pg_proc') like 'wave282:%' as x`)).x === true, f + ' exists and has a comment');
  const acls = {};
  for (const f of ADDED_FNS) acls[f] = (await one(db, `select proacl::text as a from pg_proc where oid = '${f}'::regprocedure`)).a;

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa282 undo: applied twice with no error');
  const afterUndo = await snapshot(db);
  ok(afterUndo.perm.md5 === AFTER281_MD5 && afterUndo.perm.def === before.perm.def, 'crm_email_permission is back exactly as wave281 leaves it (md5 ' + afterUndo.perm.md5 + ')');
  ok(afterUndo.perm.cmt === before.perm.cmt, 'its comment is back');
  ok(afterUndo.perm.acl === before.perm.acl, 'its grants are back (' + afterUndo.perm.acl + ')');
  ok(afterUndo.check === OLD_CHECK, 'the old kind check is back exactly');
  ok(afterUndo.kindCmt === before.kindCmt, 'the old crm_campaigns.kind comment is back');
  ok(afterUndo.setting === 'off', 'mail_fundraising_exemption is back, off');
  for (const f of ADDED_FNS) ok((await one(db, `select to_regprocedure('${f}') is null as x`)).x === true, f + ' is gone');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave282' and field = 'wave282 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select count(*)::int as n from public.crm_contacts`)).n === (await one(db, `select count(*)::int as n from public.crm_contacts where id between 1001 and 2026`)).n, 'no contact was touched');
  // the consent rule is back: unknown consent is refused a newsletter again
  const p = await one(db, `select allowed, basis from public.crm_email_permission(2001, 'newsletter')`);
  ok(p.allowed === false && p.basis === 'no consent recorded', 'after the undo, unknown consent is refused a newsletter again (' + p.basis + ')');
  console.log('wa282 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await snapshot(db);
  ok(again.perm.def === twice.perm.def && again.check === NEW_CHECK && again.release === 1, 'the same patch after an undo, still one release line');
  for (const f of ADDED_FNS) ok((await one(db, `select proacl::text as a from pg_proc where oid = '${f}'::regprocedure`)).a === acls[f], f + ' gets the same grants again');
  await db.close();

  // ---- a live function that moved stops the whole migration (one transaction, as the connector runs it), and nothing is kept
  {
    const db3 = await base();
    await db3.exec(`do $m$ declare v text := pg_get_functiondef('${PERM}'::regprocedure); begin execute replace(v, $q$if exemption = 'on' then$q$, $q$if exemption in ('on') then$q$); end $m$;`);
    let msg = '';
    try { await db3.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db3.exec('rollback').catch(() => {});
    ok(msg.includes('wave282: a live function moved: crm_email_permission'), 'a moved crm_email_permission stops the migration (' + msg + ')');
    const s = await snapshot(db3);
    ok(s.check === OLD_CHECK && s.setting === 'off' && s.release === 0 && (await one(db3, `select to_regprocedure('public.crm_email_first_contact(bigint)') is null as x`)).x === true,
      'and nothing of wave282 is kept');
    await db3.close();
    console.log('a moved anchor stops the migration and nothing is kept');
  }

  // ---- without wave281 the migration refuses to start
  {
    const db4 = new PGlite();
    await db4.exec(schema281);
    let msg = '';
    try { await db4.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db4.exec('rollback').catch(() => {});
    ok(msg.includes('wave282 needs wave281 first'), 'without wave281 the migration stops at the top (' + msg + ')');
    ok((await one(db4, `select md5(pg_get_functiondef('${PERM}'::regprocedure)) as m`)).m === LIVE_MD5, 'and crm_email_permission is untouched');
    await db4.close();
    console.log('without wave281: the migration refuses to start');
  }

  // ---- the wrong order (wave281 undone first): the wave282 undo leaves the older function alone
  {
    const db5 = await base();
    await db5.exec(migration);
    await db5.exec(undo281);
    ok((await one(db5, `select md5(pg_get_functiondef('${PERM}'::regprocedure)) as m`)).m === LIVE_MD5, 'the wave281 undo puts back the pre-wave281 function');
    await db5.exec(undo);
    ok((await one(db5, `select md5(pg_get_functiondef('${PERM}'::regprocedure)) as m`)).m === LIVE_MD5, 'the wave282 undo after it leaves that function alone');
    const s = await snapshot(db5);
    ok(s.check === OLD_CHECK && s.setting === 'off', 'and still puts back the kind check and the setting');
    await db5.close();
    console.log('wave281 undone first: the wave282 undo leaves the older function alone');
  }

  // ---- the live check files (run on live only inside build/sql_rollback_test.py's block), proved here first on the fixture, each in one transaction
  {
    const lbefore = read('w282live_before.sql'), live = read('w282live.sql'), liveUndo = read('w282live_undo.sql'), timing = read('w282live_timing.sql');
    for (const [label, files] of [['before, migration twice, live checks', [lbefore, migration, migration, live]],
                                  ['before, migration, undo twice, undo checks', [lbefore, migration, undo, undo, liveUndo]]]) {
      const db6 = await base();
      await db6.exec('begin;\n' + files.join('\n') + '\nrollback;');
      ok(true, label);
      console.log('live check files, offline: ' + label + ': passed');
      await db6.close();
    }
    const db7 = await base();
    let msg = '';
    try { await db7.exec('begin;\n' + migration + '\n' + timing + '\nrollback;'); } catch (e) { msg = String(e.message); }
    ok(/^W282_TIMING over \d+ contacts: /.test(msg), 'the timing file reports its timings (' + msg + ')');
    console.log('live check files, offline: timing: ' + msg);
    await db7.close();
  }

  console.log(`w282sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
