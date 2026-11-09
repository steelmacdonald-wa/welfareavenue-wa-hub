// wave295: offline proof of build/data/wa295_filters.sql and build/data/wa295_undo.sql on PGlite. Run: node test/w295sql.mjs
// Loads test/w281schema.sql, build/data/wa281_rules.sql, test/w283schema.sql, build/data/wa283_page.sql, then wave294 (the real file from the
// wave294-keela-tags branch when git can show it, after test/w284schema.sql and build/data/wa284_import.sql, which it needs, else the test-only stand-in of crm_tag_aliases() in test/w295schema.sql: the runner says which),
// then test/w295schema.sql (invented people and fields). Checks the fixture's crm_contact_match against the live md5 (read 07/11/26), keeps a copy of
// it, runs the migration twice (the second run changes nothing), then proves that every older condition answers exactly as before for every contact
// (a matrix of conditions against the kept copy), test/w295sql.sql twice (it rolls back), the undo twice (the function, comment and grants back
// exactly; crm_filter_contacts gone), and the migration and assertions once more after the undo. Also: the migration stops without wave294, without
// wave283, and on a moved anchor, keeping nothing; and the live check files (test/w295live.sql, w295live_undo.sql) pass here first.
// Files are read with CRLF turned into LF (this PC's checkout writes CRLF; the release fetches the LF blobs). Touches no live database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8').replace(/\r\n/g, '\n');
const schema281 = read('w281schema.sql'), mig281 = read('../build/data/wa281_rules.sql');
const schema283 = read('w283schema.sql'), mig283 = read('../build/data/wa283_page.sql');
const schema = read('w295schema.sql'), migration = read('../build/data/wa295_filters.sql'), undo = read('../build/data/wa295_undo.sql');
const schema284 = read('w284schema.sql')   // without its primary_email rebuild, which drops crm_contacts_v and crm_contact_match (wave295 needs both)
  .split('\n').filter((l) => !/^alter table public\.crm_contacts (drop|add) column primary_email/.test(l)).join('\n');
const mig284 = read('../build/data/wa284_import.sql');
const assertions = read('w295sql.sql'), live = read('w295live.sql'), liveUndo = read('w295live_undo.sql');
let wave294 = null, wave294From = 'the test-only stand-in in test/w295schema.sql (wave294 file not found)';
try {
  wave294 = execFileSync('git', ['-C', join(here, '..'), '-c', 'core.autocrlf=false', 'show', 'wave294-keela-tags:build/data/wa294_keela_tags.sql'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
  wave294From = 'wave294-keela-tags:build/data/wa294_keela_tags.sql';
} catch (e) { /* not there yet */ }

const LIVE_MATCH_MD5 = 'd21db1e35fb6e0a8f65d766db3a1d618', LIVE_MATCH_COMMENT_MD5 = '3d41cf5110030a3322bb951dffea4217';
let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(o = {}) {
  const db = new PGlite();
  await db.exec(schema281); await db.exec(mig281);
  if (o.w283 !== false) { await db.exec(schema283); await db.exec(mig283); }
  if (o.w294 !== false) {
    if (wave294) { await db.exec(schema284); await db.exec(mig284); await db.exec(wave294); }   // wave294 needs wave284
    await db.exec(schema);
  } else {
    await db.exec(schema.replace(/do \$stub\$[\s\S]*?end \$stub\$;/, ''));   // the people, but no crm_tag_aliases
  }
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w295sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
const OBJECTS = `select coalesce(string_agg(x, E'\\n' order by x), '') as s from (
  select 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '') as x
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('crm_contact_match', 'crm_filter_contacts', 'crm_filter_prepare', 'crm_filter_prepare_tag', 'crm_list_preview', 'crm_list_preview_flat')
  union all select 'release ' || field from public.change_log where entity_type = 'release' and entity_id = 'wave295'
) q`;
const MATCH = `select md5(pg_get_functiondef('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure)) as def,
  md5(obj_description('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure, 'pg_proc')) as cmt,
  (select proacl::text from pg_proc where oid = 'public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure) as acl`;

// every older condition with one non-blank value, as saved lists hold them (Keela tag names excluded: those now find their Hub tag, by design; the
// alias equivalence is asserted in test/w295sql.sql). Blank values and unknown fields are changedConditions(): they now match no one (fail closed).
const isChanged = (k) => { const known = ['kind', 'role', 'tag', 'perm', 'email', 'served', 'gave', 'city', 'language', 'source', 'added', 'active', 'opened', 'clicked', 'review', 'search'];
  return !k.f || !known.includes(k.f) || (['kind', 'role', 'tag', 'perm', 'city', 'language', 'source', 'search'].includes(k.f) && String(k.v == null ? '' : k.v).trim() === ''); };
function oldConditions() { return allOld().filter((k) => !isChanged(k)); }
function changedConditions() { return allOld().filter(isChanged); }
function allOld() {
  const ks = [];
  const add = (f, ops, vals) => { for (const op of ops) for (const v of vals) ks.push(v === undefined ? { f, op } : { f, op, v }); };
  add('kind', ['is', 'not', 'none', ''], ['volunteer', 'donor', 'partner', 'supporter', 'staff', '', 'nobody']);
  add('role', ['is', 'not'], ['cook', 'server', 'driver', '']);
  add('tag', ['has', 'not', 'none'], ['server', 'Server', 'newsletter', 'donor', 'photographer', 'Volunteer', 'toronto', '', 'nothing like it']);
  add('perm', ['is', 'not'], ['express', 'implied', 'unknown', 'none', 'unsub', 'bounced']);
  add('email', ['has', 'none'], [undefined]);
  add('served', ['ever', 'never', 'within', 'count_gte'], ['365', '30', '1', '3', '', 'abc']);
  add('gave', ['ever', 'never', 'within', 'lapsed', 'total_gte', 'count_gte'], ['365', '100', '2', '', 'abc']);
  add('city', ['contains', 'not'], ['montr', 'Montreal', '', 'toronto']);
  add('language', ['is', 'not'], ['en', 'fr', '']);
  add('source', ['is', 'not'], ['manual', 'keela', 'cabm', '']);
  add('added', ['within'], ['30', '365', '']); add('active', ['within'], ['90', '']);
  add('opened', ['within'], ['90']); add('clicked', ['within'], ['90']);
  add('review', ['is', 'not'], [undefined]);
  add('search', ['contains'], ['test', 'Test Fa', 'example.invalid', '514', 'server', 'bakery', '']);
  add('unknown_field', ['is', 'not'], ['x']); add('', ['is'], ['x']);
  ks.push({}); ks.push({ op: 'not' });
  return ks;
}

try {
  console.log('wave294: ' + wave294From);
  if (wave294) { const h = (await import('node:crypto')).createHash('md5').update(wave294).digest('hex'); ok(h === 'fe7f6cec76930d97e8396be6a133b912', 'the wave294 file is the one at 3b1d7ca (md5 ' + h + ')'); }
  const db = await fresh();
  const before = await one(db, MATCH);
  ok(before.def === LIVE_MATCH_MD5, 'the fixture\'s crm_contact_match is the live text (md5 ' + before.def + ')');
  ok(before.cmt === LIVE_MATCH_COMMENT_MD5, 'the fixture\'s comment is the live comment (md5 ' + before.cmt + ')');
  const lp = await one(db, `select md5(pg_get_functiondef('public.crm_list_preview(jsonb)'::regprocedure)) as a, md5(pg_get_functiondef('public.crm_list_preview_flat(jsonb)'::regprocedure)) as b`);
  const lpBefore = await one(db, `select (select proacl::text from pg_proc where oid = 'public.crm_list_preview(jsonb)'::regprocedure) as acl`);
  ok(lp.a === '8088527269cf3f6b75105421ee453abf' && lp.b === '5745c2147e27706ed9faa00e1830d9ee', 'the fixture\'s crm_list_preview and crm_list_preview_flat are the live text (' + JSON.stringify(lp) + ')');
  // a copy of the live function, to compare every older condition against after the migration
  const def = (await one(db, `select pg_get_functiondef('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure) as d`)).d;
  await db.exec(def.replace('FUNCTION public.crm_contact_match(', 'FUNCTION public.w295_old_match('));

  // ---- before the migration the assertions fail
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = true; }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');

  // ---- the migration, twice
  await db.exec(migration);
  const objOnce = (await one(db, OBJECTS)).s;
  await db.exec(migration);
  const objTwice = (await one(db, OBJECTS)).s;
  ok(objOnce === objTwice, 'a second run leaves every body, grant, comment and the release line as the first left it');
  ok((await one(db, MATCH)).def !== LIVE_MATCH_MD5, 'the migration changed crm_contact_match');
  ok((await one(db, MATCH)).acl === before.acl, 'crm_contact_match keeps its live grants');
  console.log('wa295: applied twice with no error, the second run changed nothing');

  // ---- every older condition answers exactly as before, for every contact
  {
    const conds = oldConditions();
    const r = await one(db, `select count(*)::int as pairs, count(*) filter (where public.w295_old_match(c, k) is distinct from public.crm_contact_match(c, k))::int as differ,
        count(distinct c.id)::int as people, count(*) filter (where public.crm_contact_match(c, k))::int as hits
      from public.crm_contacts_v c, jsonb_array_elements('${JSON.stringify(conds).replace(/'/g, "''")}'::jsonb) k`);
    ok(r.differ === 0, 'every older condition answers as before (' + r.differ + ' of ' + r.pairs + ' differ)');
    ok(r.people > 50 && r.hits > 1000, 'the comparison covered real cases (' + JSON.stringify(r) + ')');
    const g = await one(db, `select count(*)::int as differ from jsonb_array_elements('${JSON.stringify(conds).replace(/'/g, "''")}'::jsonb) k
      where (select array_agg(x order by x) from public.crm_list_preview(jsonb_build_object('groups', jsonb_build_array(jsonb_build_object('all', jsonb_build_array(k))))) x)
            is distinct from (select array_agg(c.id order by c.id) from public.crm_contacts_v c where c.merged_into is null and public.w295_old_match(c, k))`);
    ok(g.differ === 0, 'and crm_list_preview gives the same people for each (' + g.differ + ' differ)');
    console.log('older conditions: ' + conds.length + ' conditions x ' + r.people + ' contacts (' + r.pairs + ' pairs), none answers differently');
    const ch = changedConditions();
    const c2 = await one(db, `select count(*) filter (where public.crm_contact_match(c, k))::int as now, count(*) filter (where public.w295_old_match(c, k))::int as before, count(*)::int as pairs
      from public.crm_contacts_v c, jsonb_array_elements('${JSON.stringify(ch).replace(/'/g, "''")}'::jsonb) k`);
    ok(c2.now === 0 && c2.before > 0, 'blank values and unknown fields now match no one (they matched ' + c2.before + ' pairs before): ' + JSON.stringify(c2));
    console.log('fail closed: ' + ch.length + ' blank or unknown conditions matched ' + c2.before + ' contact pairs before, and match none now');
  }

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo); await db.exec(undo);
  const after = await one(db, MATCH);
  ok(after.def === LIVE_MATCH_MD5 && after.cmt === LIVE_MATCH_COMMENT_MD5 && after.acl === before.acl, 'after the undo crm_contact_match is back exactly (definition, comment, grants): ' + JSON.stringify(after));
  ok((await one(db, `select to_regprocedure('public.crm_filter_contacts(jsonb)') is null and to_regprocedure('public.crm_filter_prepare(jsonb)') is null and to_regprocedure('public.crm_filter_prepare_tag(jsonb)') is null as x`)).x === true, 'crm_filter_contacts, crm_filter_prepare and crm_filter_prepare_tag are gone');
  const lp2 = await one(db, `select md5(pg_get_functiondef('public.crm_list_preview(jsonb)'::regprocedure)) as a, md5(obj_description('public.crm_list_preview(jsonb)'::regprocedure, 'pg_proc')) as c, (select proacl::text from pg_proc where oid = 'public.crm_list_preview(jsonb)'::regprocedure) as acl`);
  ok(lp2.a === '8088527269cf3f6b75105421ee453abf' && lp2.c === 'f51932b9bf2a0fc879a2f91ae2b9ce52' && lp2.acl === lpBefore.acl, 'crm_list_preview is back exactly (definition, comment, grants): ' + JSON.stringify(lp2));
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave295' and field = 'wave295 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select has_function_privilege('service_role', 'public.crm_tag_aliases()', 'execute') and has_function_privilege('authenticated', 'public.crm_tag_aliases()', 'execute') as x`)).x === true,
    'the undo leaves wave294\'s grants on crm_tag_aliases as they are (authenticated and the service role)');
  ok((await one(db, `select (select array_agg(x order by x) from public.crm_list_preview('{"groups":[{"all":[{"f":"tag","op":"has","v":"server"}]}]}') x)::text as a`)).a.includes('9501'), 'Lists still work after the undo');
  console.log('wa295 undo: applied twice, crm_contact_match back exactly');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  ok((await one(db, OBJECTS)).s.split('\n').filter((l) => !l.startsWith('release')).join('\n') === objOnce.split('\n').filter((l) => !l.startsWith('release')).join('\n'), 'the same objects again after an undo');
  await runAssertions(db, 're-applied assertions');
  await db.close();

  // ---- the undo refuses while a saved list or an unsent Send uses a wave295 shape, and names them by id
  {
    const d3 = await fresh();
    await d3.exec(migration);
    await d3.exec(`insert into public.crm_lists (id, name, kind, filter) values (7701, 'Test list chapter', 'dynamic', '{"groups":[{"all":[{"f":"chapter","op":"is","v":"toronto"}]}]}'),
      (7702, 'Test list tags', 'dynamic', '{"groups":[{"all":[{"f":"tag","op":"none","v":["a","b"]}]}]}'), (7703, 'Test list plain', 'dynamic', '{"groups":[{"all":[{"f":"tag","op":"has","v":"server"}]}]}'),
      (7704, 'Test fixed list', 'static', '{"groups":[{"all":[{"f":"chapter","op":"is","v":"toronto"}]}]}');
      insert into public.crm_campaigns (id, name, list_id, status) values (8801, 'Test draft', 7701, 'draft'), (8802, 'Test sent', 7701, 'sent'), (8803, 'Test plain draft', 7703, 'draft');`);
    let msg = '';
    try { await d3.exec('begin;\n' + undo + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await d3.exec('rollback').catch(() => {});
    ok(msg.includes('wave295 undo refuses') && msg.includes('list 7701') && msg.includes('list 7702') && !msg.includes('list 7703') && !msg.includes('list 7704')
       && msg.includes('Send 8801 (draft, list 7701)') && !msg.includes('8802') && !msg.includes('8803'), 'the undo refuses and names the lists and the unsent Send (' + msg + ')');
    ok((await one(d3, MATCH)).def !== LIVE_MATCH_MD5 && (await one(d3, `select to_regprocedure('public.crm_filter_contacts(jsonb)') is not null as x`)).x === true, 'and changes nothing');
    await d3.exec(`delete from public.crm_campaigns; delete from public.crm_lists where id in (7701, 7702);`);
    await d3.exec(undo);
    ok((await one(d3, MATCH)).def === LIVE_MATCH_MD5, 'once those lists are gone, the undo runs');
    console.log('undo guard: refuses with lists 7701, 7702 and Send 8801 named; runs once they are gone');
    await d3.close();
  }

  // ---- the guards: without wave294, without wave283, on a moved anchor, saved lists whose answer would change: the file stops and nothing is kept
  for (const [label, o, want, tweak] of [
    ['wave294 without the service role grant', {}, 'wave295 needs wave294 at 3b1d7ca or later', `revoke execute on function public.crm_tag_aliases() from service_role;`],
    ['a saved list whose answer would change', {}, 'wave295 stops: these saved lists would answer differently: list 7711: ', `insert into public.crm_lists (id, name, kind, filter) values
       (7711, 'Test empty group', 'dynamic', '{"groups":[{"all":[]}]}'), (7712, 'Test keela name', 'dynamic', '{"groups":[{"all":[{"f":"tag","op":"has","v":"Volunteer Server"}]}]}'),
       (7713, 'Test plain', 'dynamic', '{"groups":[{"all":[{"f":"tag","op":"has","v":"server"}]}]}'), (7714, 'Test unknown', 'dynamic', '{"groups":[{"all":[{"f":"birth","op":"is","v":"x"}]}]}');
       insert into public.crm_campaigns (id, name, list_id, status) values (8811, 'Test queued', 7714, 'queued');`],
    ['without wave294', { w294: false }, 'wave295 needs wave294 first', null],
    ['without wave283', { w283: false }, 'wave295 needs wave283 first', null],
    ['a moved anchor', {}, 'wave295: a live function moved: crm_contact_match', `create or replace function public.crm_contact_match(c public.crm_contacts_v, k jsonb) returns boolean language plpgsql stable set search_path to '' as $f$ begin return true; end $f$;`],
    ['a crm_list_preview that moved', {}, 'wave295: a live function moved: crm_list_preview', `create or replace function public.crm_list_preview(p_filter jsonb) returns setof bigint language sql stable set search_path to '' as $f$ select 1::bigint $f$;`]]) {
    const d2 = await fresh(o);
    if (tweak) await d2.exec(tweak);
    const m0 = (await one(d2, MATCH)).def;
    let msg = '';
    try { await d2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await d2.exec('rollback').catch(() => {});
    ok(msg.includes(want), label + ': the migration stops (' + msg + ')');
    if (label.startsWith('a saved list')) ok(msg.includes('list 7712: tag "Volunteer Server"') && msg.includes('list 7714: the field "birth"') && !msg.includes('list 7713') && msg.includes('Send 8811 (queued, list 7714)'),
      'it names each list and why, and the unsent Send (' + msg + ')');
    ok((await one(d2, `select to_regprocedure('public.crm_filter_contacts(jsonb)') is null as x`)).x === true && (await one(d2, MATCH)).def === m0
       && (await one(d2, `select count(*)::int as n from public.change_log where entity_id = 'wave295'`)).n === 0, label + ': nothing of wave295 is kept');
    console.log(label + ': the migration stops and nothing is kept');
    await d2.close();
  }

  // ---- the live check files, proved here first, each in one transaction
  for (const [label, files] of [['migration twice, live checks', [migration, migration, live]],
                                ['migration, live checks, undo twice, undo checks, migration, live checks', [migration, live, undo, undo, liveUndo, migration, live]]]) {
    const d4 = await fresh();
    await d4.exec('begin;\n' + files.join('\n') + '\nrollback;');
    ok(true, label);
    console.log('live check files, offline: ' + label + ': passed');
    await d4.close();
  }

  console.log(`w295sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  process.exit(1);
}
