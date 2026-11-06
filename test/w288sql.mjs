// wave288: offline proof of build/data/wa288_toronto.sql and build/data/wa288_undo.sql on PGlite. Run: node test/w288sql.mjs
// Loads test/w281schema.sql, build/data/wa281_rules.sql, test/w283schema.sql and build/data/wa283_page.sql (both waves are built on this branch, not
// live yet), then test/w288schema.sql (the live text of crm_form_apply and wa209_volunteer_apply, the toronto-volunteer form, request_types,
// dept_requests, team_members), checks that text against the md5 of the live definitions (read 06/11/26), then runs the migration twice (the second
// run must change nothing), test/w288sql.sql twice (it rolls back), the undo twice (the two functions back exactly: definition, comment and grants;
// the column, the request type, the new forms and the word gone; toronto-volunteer back), and the migration and assertions once more after the
// undo. Also: the migration stops without wave281, without exactly one Ops Toronto Tate, on a moved anchor and on a toronto-volunteer form that
// moved, keeping nothing; and the live check files (test/w288live_before.sql, w288live.sql, w288live_undo.sql) pass here first. Standalone.
// Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// LF always: a checkout with CRLF line endings (core.autocrlf on Windows) would change the function text the fixture holds and its md5
const read = (p) => readFileSync(join(here, p), 'utf8').split('\r\n').join('\n');
const schema281 = read('w281schema.sql');
const mig281 = read('../build/data/wa281_rules.sql');
const schema283 = read('w283schema.sql');
const mig283 = read('../build/data/wa283_page.sql');
const schema = read('w288schema.sql');
const migration = read('../build/data/wa288_toronto.sql');
const undo = read('../build/data/wa288_undo.sql');
const assertions = read('w288sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(withWave281 = true) {
  const db = new PGlite();
  await db.exec(schema281);
  if (withWave281) await db.exec(mig281);
  await db.exec(schema283);
  if (withWave281) await db.exec(mig283);
  await db.exec(schema);
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w288sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}

// the two live functions wave288 changes, with the md5 of pg_get_functiondef as live had it on 06/11/26
const LIVE = {
  'public.crm_form_apply(bigint)': 'dafd2ac5644c0d3b3e9462503a557158',
  'public.wa209_volunteer_apply(jsonb)': '2031a8733e7f27abfe9321d477e7b692',
};
const PATCHED = Object.keys(LIVE);
const NEW_FORMS = `('benevole-toronto', 'toronto-student', 'etudiant-toronto')`;

async function snapshot(db) {
  const out = {};
  for (const f of PATCHED) {
    out[f] = await one(db, `select pg_get_functiondef('${f}'::regprocedure) as def, obj_description('${f}'::regprocedure, 'pg_proc') as cmt,
      (select proacl::text from pg_proc where oid = '${f}'::regprocedure) as acl`);
  }
  out.tv = (await one(db, `select (to_jsonb(f) - 'updated_at' - 'updated_by')::text as t from public.crm_forms f where slug = 'toronto-volunteer'`)).t;
  out.forms = (await one(db, `select string_agg(slug, ',' order by slug) as s from public.crm_forms`)).s;
  out.rtypes = (await one(db, `select string_agg(to_jsonb(r)::text, '|' order by r.id) as s from public.request_types r`)).s;
  out.cols = (await one(db, `select string_agg(column_name, ',' order by ordinal_position) as s from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_applications'`)).s;
  out.i18n = (await one(db, `select string_agg(en || '=' || tr || '/' || kind, ',' order by en) as w from public.hub_i18n`)).w;
  return out;
}
const COUNTS = `select (select count(*)::int from public.hub_i18n) as words, (select count(*)::int from public.change_log where entity_type = 'release' and entity_id = 'wave288') as release_rows,
  (select count(*)::int from public.request_types) as rtypes, (select count(*)::int from public.crm_forms) as forms,
  (select count(*)::int from information_schema.columns where table_name = 'volunteer_applications' and column_name = 'chapter') as chapter_col,
  (select md5(string_agg(to_jsonb(f)::text, '|' order by f.id)) from public.crm_forms f) as forms_md5`;
const KEPT_NOTHING = `select (select count(*)::int from public.request_types where key = 'toronto-volunteer') + (select count(*)::int from public.crm_forms where slug in ${NEW_FORMS})
  + (select count(*)::int from information_schema.columns where table_name = 'volunteer_applications' and column_name = 'chapter')
  + (select count(*)::int from public.crm_forms where slug = 'toronto-volunteer' and settings ? 'chapter') as n`;

try {
  const db = await fresh();

  // ---- the fixture holds the live text: md5 of every changed function equals live's
  for (const f of PATCHED) ok((await one(db, `select md5(pg_get_functiondef('${f}'::regprocedure)) as m`)).m === LIVE[f], f + ': the fixture text is the live text (md5)');
  const before = await snapshot(db);
  ok(before[PATCHED[0]].acl === '{postgres=X/postgres,service_role=X/postgres}' && before[PATCHED[1]].acl === '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}',
    'the fixture has the live grants (' + before[PATCHED[0]].acl + ' / ' + before[PATCHED[1]].acl + ')');
  ok(before[PATCHED[1]].cmt === null, 'wa209_volunteer_apply has no comment, as on live');
  console.log('fixture: crm_form_apply and wa209_volunteer_apply match the live md5s and grants');

  // ---- before the migration the assertions fail
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = /toronto-volunteer|Assertion failed|assert/i.test(String(e.message)); }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  const first = await one(db, COUNTS);
  const afterOnce = await snapshot(db);
  await db.exec(migration);
  const second = await one(db, COUNTS);
  console.log('wa288: applied twice with no error', JSON.stringify({ ...second, forms_md5: undefined }));
  ok(JSON.stringify(first) === JSON.stringify(second), 'a second run changes nothing: ' + JSON.stringify(first) + ' vs ' + JSON.stringify(second));
  const base = await (async () => { const d = await fresh(); const c = await one(d, COUNTS); await d.close(); return c; })();
  ok(first.words === base.words + 1 && first.release_rows === 1 && first.rtypes === base.rtypes + 1 && first.forms === base.forms + 3 && first.chapter_col === 1,
    'one word, one release line, one request type, three forms, the chapter column (' + JSON.stringify(first) + ')');
  const afterMig = await snapshot(db);
  for (const f of PATCHED) {
    ok(afterMig[f].def !== before[f].def, f + ' was patched');
    ok(afterMig[f].def === afterOnce[f].def, f + ' is patched once only (the second run skipped it)');
    ok(afterMig[f].acl === before[f].acl, f + ' keeps its grants (' + afterMig[f].acl + ')');
    ok(/wave288/.test(afterMig[f].cmt || ''), f + ' has a comment that says what wave288 changed');
  }
  // each function changed by its anchors only: take the wave288 additions out and the live text is back
  const cfa = afterMig['public.crm_form_apply(bigint)'].def, w209 = afterMig['public.wa209_volunteer_apply(jsonb)'].def;
  ok(cfa.length - before['public.crm_form_apply(bigint)'].def.length < 2600, 'crm_form_apply changed by its anchors only (' + (cfa.length - before['public.crm_form_apply(bigint)'].def.length) + ' characters added)');
  ok(w209.length - before['public.wa209_volunteer_apply(jsonb)'].def.length < 400, 'wa209_volunteer_apply changed by its anchors only (' + (w209.length - before['public.wa209_volunteer_apply(jsonb)'].def.length) + ' characters added)');
  ok(cfa.includes(`  -- 4b. wave288: a form with settings.chapter (montreal, toronto) puts the person in that chapter\n  if coalesce(f.settings ->> 'chapter', '') <> ''`)
     && cfa.indexOf('-- 4b. wave288') > cfa.indexOf('-- 3. a new contact') && cfa.indexOf('-- 4b. wave288') < cfa.indexOf('-- 5. the email permission'), 'crm_form_apply: the chapter once the contact is known, before the consent');
  ok(cfa.indexOf('-- 5b. wave288') > cfa.indexOf('-- 5. the email permission') && cfa.indexOf('-- 5b. wave288') < cfa.indexOf('-- 6. custom fields'), 'crm_form_apply: the text box right after the email permission');
  ok(w209.includes(`v_by, v_chapter)\n  returning id into v_app;\n  if v_cid is not null then perform public.crm_add_chapter(v_cid, v_chapter, 'application', v_app::text); end if;`),
    'wa209_volunteer_apply: the chapter on the application, then the person in it');
  ok(afterMig.cols === before.cols + ',chapter', 'volunteer_applications gains chapter only (' + afterMig.cols + ')');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa288 undo: applied twice with no error');
  const afterUndo = await snapshot(db);
  for (const f of PATCHED) {
    ok(afterUndo[f].def === before[f].def, f + ' is back exactly as live has it (pg_get_functiondef)');
    ok((await one(db, `select md5(pg_get_functiondef('${f}'::regprocedure)) as m`)).m === LIVE[f], f + ' is back (md5 as live)');
    ok(afterUndo[f].cmt === before[f].cmt, f + ' comment is back as it was');
    ok(afterUndo[f].acl === before[f].acl, f + ' grants are back as they were (' + afterUndo[f].acl + ')');
  }
  ok(afterUndo.tv === before.tv, 'toronto-volunteer is back as it was (settings, consent, status, questions)');
  ok(afterUndo.forms === before.forms, 'the three new forms are gone');
  ok(afterUndo.rtypes === before.rtypes, 'the request types are as before');
  ok(afterUndo.cols === before.cols, 'volunteer_applications.chapter is gone');
  ok(afterUndo.i18n === before.i18n, 'hub_i18n is as before');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave288' and field = 'wave288 undo'`)).n === 1, 'one undo line after two runs');
  console.log('wa288 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await one(db, COUNTS);
  ok(again.words === first.words && again.rtypes === first.rtypes && again.forms === first.forms && again.chapter_col === 1, 'the same word, request type, forms and column again after an undo');

  // ---- an undo after real answers keeps them: a form with an answer is closed, not deleted; a type with Requests is switched off
  {
    await db.exec(`insert into public.crm_form_submissions (form_id, status, mapped) select id, 'received', '{}' from public.crm_forms where slug = 'toronto-student';
                   insert into public.dept_requests (type_key, department, title) values ('toronto-volunteer', 'opsto', 'A kept Request');`);
    await db.exec(undo);
    const k = await one(db, `select (select string_agg(slug || ':' || status, ',' order by slug) from public.crm_forms where slug in ${NEW_FORMS}) as forms,
      (select enabled::text from public.request_types where key = 'toronto-volunteer') as rtype, (select count(*)::int from public.dept_requests where title = 'A kept Request') as req,
      (select count(*)::int from public.crm_form_submissions s join public.crm_forms f on f.id = s.form_id where f.slug = 'toronto-student') as answers`);
    ok(k.forms === 'toronto-student:closed' && k.rtype === 'false' && k.req === 1 && k.answers === 1,
      'an undo after answers: the answered form is closed and kept with its answer, the others deleted; the request type is switched off and its Request kept (' + JSON.stringify(k) + ')');
    await db.exec(migration);
    const k2 = await one(db, `select (select enabled::text from public.request_types where key = 'toronto-volunteer') as rtype, (select count(*)::int from public.crm_forms where slug in ${NEW_FORMS}) as forms`);
    ok(k2.rtype === 'true' && k2.forms === 3, 'and the migration after it switches the type on again and adds the two deleted forms back (' + JSON.stringify(k2) + ')');
  }
  await db.close();

  // ---- without wave281 the migration stops at the top, and nothing is kept
  {
    const db2 = await fresh(false);
    let msg = '';
    try { await db2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db2.exec('rollback').catch(() => {});
    ok(msg.includes('wave288 needs wave281 first'), 'without wave281 the migration stops (' + msg + ')');
    ok((await one(db2, `select (select count(*)::int from public.request_types where key = 'toronto-volunteer') + (select count(*)::int from public.crm_forms where slug in ${NEW_FORMS}) as n`)).n === 0, 'and nothing of wave288 is kept');
    await db2.close();
  }

  // ---- the file stops (one transaction, as the connector runs it) and keeps nothing when: a live function moved; toronto-volunteer moved; there is
  //      no Ops Toronto Tate, or two of them
  const stops = [
    ['crm_form_apply moved', `do $m$ declare v text := pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure); begin execute replace(v, $q$f.settings ->> 'city', '')$q$, $q$f.settings ->> 'town', '')$q$); end $m$;`, 'wave288: a live function moved: crm_form_apply'],
    ['wa209_volunteer_apply moved', `do $m$ declare v text := pg_get_functiondef('public.wa209_volunteer_apply(jsonb)'::regprocedure); begin execute replace(v, $q$candidate_id, created_by)$q$, $q$candidate_id, created_by )$q$); end $m$;`, 'wave288: a live function moved: wa209_volunteer_apply'],
    ['toronto-volunteer moved', `update public.crm_forms set settings = settings || '{"confirm": true}' where slug = 'toronto-volunteer';`, 'settings or consent changed since 06/11/26'],
    ['no Ops Toronto Tate', `update public.team_members set active = false where name = 'Tate Fixture';`, 'found 0'],
    ['two Ops Toronto Tates', `insert into public.team_members (name, department, active) values ('Tate Second', 'opsto', true);`, 'found 2'],
  ];
  for (const [label, setup, expect] of stops) {
    const db3 = await fresh();
    await db3.exec(setup);
    let msg = '';
    try { await db3.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db3.exec('rollback').catch(() => {});
    ok(msg.includes(expect), label + ': the migration stops (' + msg + ')');
    ok((await one(db3, KEPT_NOTHING)).n === 0, label + ': and nothing of wave288 is kept');
    for (const f of PATCHED) ok(!/wave288|v_chapter/.test((await one(db3, `select pg_get_functiondef('${f}'::regprocedure) as d`)).d), label + ': ' + f + ' is not patched');
    await db3.close();
  }
  console.log('without wave281, with a moved anchor or form, or without exactly one Tate, the migration stops and nothing is kept');

  // ---- the live check files (run on live only inside build/sql_rollback_test.py's block), proved here first on the fixture, each in one transaction
  {
    const lb = read('w288live_before.sql'), live = read('w288live.sql'), liveUndo = read('w288live_undo.sql');
    for (const [label, files] of [['wave281, wave283, before, migration twice, live checks', [lb, migration, migration, live]],
                                  ['wave281, wave283, before, migration, undo twice, undo checks, migration, live checks', [lb, migration, undo, undo, liveUndo, migration, live]]]) {
      const db4 = await fresh();
      await db4.exec('begin;\n' + files.join('\n') + '\nrollback;');
      ok(true, label);
      console.log('live check files, offline: ' + label + ': passed');
      await db4.close();
    }
  }

  console.log(`w288sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
