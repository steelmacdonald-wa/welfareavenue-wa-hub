// wave286: offline proof of build/data/wa286_vm_chapter.sql and build/data/wa286_undo.sql on PGlite. Run: node test/w286sql.mjs
// wave286 needs wave281 first, so this loads test/w281schema.sql, runs build/data/wa281_rules.sql, then test/w286schema.sql (the servings slice,
// volunteer_event_summary as live has it, stand-ins, invented people) and creates the live wa266f_email_drain and wa191_recruit_pool from the text
// build/data/wa286_undo.sql holds, with their live grants and comments; each md5 (and the view's) is checked against live's of 06/11/26. It runs the
// migration twice (the second run changes nothing), test/w286sql.sql twice (it rolls back), the undo twice (the drain, Find volunteers and the view
// are back exactly: definition, comment and grants; the column, the trigger and the new function are gone), and the migration and assertions once
// more after the undo. Then: a moved anchor in each of the three live objects stops the migration and nothing is kept, the migration refuses to run
// without wave281, wave281's undo cannot run while wave286 is in place (undo wave286 first), and the live check files pass on the fixture.
// Files are read with CRLF turned into LF (a Windows checkout may hold CRLF; git and live hold LF). Standalone. Touches no live database.
// Exits non-zero on any failure.
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

const DRAIN = 'public.wa266f_email_drain(integer)';
const POOL3 = 'public.wa191_recruit_pool(bigint[],integer,integer)';
const POOL4 = 'public.wa191_recruit_pool(bigint[],integer,integer,text)';
const VIEW = 'public.volunteer_event_summary';
const LIVE = { drain: 'bdf1673f787ff3b3560677f1ae80030f', pool: '4091ecf501507c616950575f6621176e', view: 'c4f79918952ce10590f33bad8b18c3a4' };   // live, 06/11/26
const ROUTE = " 'route', (select c.mail_route from public.crm_chapters c join public.volunteer_events ve on ve.chapter = c.code where ve.id = (select x.event_id from public.event_roster x where x.id = q.roster_id)),";
const REPLY = "'reply_to', public.wa258_role_owner(r.role),";

// the live text, as the undo holds it (one copy only)
const between = (s, tag) => { const a = s.indexOf(tag), b = s.indexOf(tag, a + tag.length); if (a < 0 || b < 0) fail('the undo has no ' + tag + ' block'); return s.slice(a + tag.length, b); };
const LIVE_DRAIN = between(undo, '$f286a$');
const LIVE_POOL = between(undo, '$f286b$');
const POOL_CMT = (undo.match(/comment on function public\.wa191_recruit_pool\(bigint\[\], integer, integer\) is '((?:[^']|'')*)';/) || [])[1];
if (!POOL_CMT) fail('the undo has no wa191_recruit_pool comment');

async function base() {
  const db = new PGlite();
  await db.exec(schema281);
  await db.exec(rules281);
  await db.exec(schema);
  await db.exec(LIVE_DRAIN + ';\n' + LIVE_POOL + ';');
  await db.exec(`revoke all on function ${DRAIN} from public, anon, authenticated; grant execute on function ${DRAIN} to service_role;
    revoke all on function ${POOL3} from public, anon; grant execute on function ${POOL3} to authenticated, service_role;
    comment on function ${POOL3} is '${POOL_CMT}';`);
  return db;
}
async function snapshot(db) {
  const fn = async (sig) => (await one(db, `select to_regprocedure('${sig}') is not null as x`)).x
    ? one(db, `select pg_get_functiondef('${sig}'::regprocedure) as def, md5(pg_get_functiondef('${sig}'::regprocedure)) as md5,
        obj_description('${sig}'::regprocedure, 'pg_proc') as cmt, (select proacl::text from pg_proc where oid = '${sig}'::regprocedure) as acl`) : null;
  return {
    drain: await fn(DRAIN), pool3: await fn(POOL3), pool4: await fn(POOL4), chapters: await fn('public.wa286_volunteer_chapters()'), trgfn: await fn('public.wa286_roster_chapter()'),
    view: await one(db, `select pg_get_viewdef('${VIEW}'::regclass, true) as def, md5(pg_get_viewdef('${VIEW}'::regclass, true)) as md5, obj_description('${VIEW}'::regclass, 'pg_class') as cmt,
      (select relacl::text from pg_class where oid = '${VIEW}'::regclass) as acl, (select reloptions::text from pg_class where oid = '${VIEW}'::regclass) as opts`),
    column: (await one(db, `select count(*)::int as n from pg_attribute where attrelid = 'public.volunteer_events'::regclass and attname = 'chapter' and not attisdropped`)).n,
    index: (await one(db, `select count(*)::int as n from pg_indexes where indexname = 'volunteer_events_chapter_idx'`)).n,
    trigger: (await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa286_roster_chapter'`)).n,
    release: (await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286'`)).n,
    rows: (await one(db, `select (select count(*) from public.volunteer_events)::int as ev, (select count(*) from public.event_roster)::int as ro,
      (select count(*) from public.crm_contact_chapters)::int as ch, (select count(*) from public.crm_contacts)::int as co`)),
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
  ok(before.drain.md5 === LIVE.drain, 'the undo holds live\'s wa266f_email_drain exactly (md5 ' + before.drain.md5 + ')');
  ok(before.pool3.md5 === LIVE.pool, 'the undo holds live\'s wa191_recruit_pool exactly (md5 ' + before.pool3.md5 + ')');
  ok(before.view.md5 === LIVE.view, 'the fixture holds live\'s volunteer_event_summary exactly (md5 ' + before.view.md5 + ')');
  ok(before.drain.acl === '{postgres=X/postgres,service_role=X/postgres}' && before.pool3.acl === '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     && before.view.acl === '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}', 'the fixture has live\'s grants');
  ok(before.pool4 === null && before.chapters === null && before.column === 0 && before.trigger === 0 && before.release === 0, 'before: nothing of wave286');
  console.log('fixture: wa266f_email_drain, wa191_recruit_pool and volunteer_event_summary are live\'s text (' + LIVE.drain + ', ' + LIVE.pool + ', ' + LIVE.view + ')');

  // ---- before the migration the assertions fail at once
  let failedOn = '';
  try { await db.exec(assertions); } catch (e) { failedOn = String(e.message); }
  await db.exec('rollback').catch(() => {});
  ok(/chapter/.test(failedOn), 'before the migration the assertions fail on the missing chapter (' + failedOn + ')');
  console.log('before the migration: the assertions fail, as they should (' + failedOn + ')');

  // ---- the migration, twice
  await db.exec(migration);
  const once = await snapshot(db);
  await db.exec(migration);
  const twice = await snapshot(db);
  console.log('wa286: applied twice with no error');
  ok(JSON.stringify(once) === JSON.stringify(twice), 'a second run changes nothing (definitions, comments, grants, column, trigger, release line, rows)');
  ok(twice.pool3 === null && twice.pool4 !== null, 'wa191_recruit_pool has four arguments, and the three-argument version is gone');
  const p = twice.pool4.def;
  ok(p.replace(", p_chapter text DEFAULT NULL::text)\n RETURNS jsonb", ")\n RETURNS jsonb")
       .replace("\n       and not coalesce(c.do_not_contact, false)   -- wave286: never a do-not-contact person\n       and (p_chapter is null or public.crm_in_chapter(c.id, p_chapter))   -- wave286: the chosen chapter (null: all)", '') === before.pool3.def,
     'wa191_recruit_pool is the live text with the new argument and the two new lines, nothing else');
  ok(twice.pool4.acl === before.pool3.acl, 'wa191_recruit_pool keeps its grants (' + twice.pool4.acl + ')');
  ok(twice.pool4.cmt.startsWith(before.pool3.cmt + ' wave286:'), 'wa191_recruit_pool keeps its comment, with what wave286 added');
  ok(twice.drain.def === before.drain.def.replace(REPLY, REPLY + ROUTE) && twice.drain.def.split(ROUTE).length === 2, 'the drain is the live text with the route, once, after reply_to');
  ok(twice.drain.acl === before.drain.acl, 'the drain keeps its grants (' + twice.drain.acl + ')');
  ok(twice.view.def === before.view.def.replace(') AS roster_texted\n   FROM volunteer_events e;', ') AS roster_texted,\n    chapter\n   FROM volunteer_events e;'), 'the view is the live text with chapter appended');
  ok(twice.view.opts === before.view.opts && twice.view.opts === '{security_invoker=on}', 'the view stays security invoker');
  ok(twice.view.acl === '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}', 'the view: signed-in users read only (' + twice.view.acl + ')');
  ok(twice.column === 1 && twice.index === 1 && twice.trigger === 1 && twice.release === 1, 'the column, its index, the trigger and one release line');
  ok(JSON.stringify(twice.rows) === JSON.stringify(before.rows), 'no serving, roster row, chapter row or contact was added or removed');
  ok((await one(db, `select count(*)::int as n from public.volunteer_events where chapter <> 'montreal'`)).n === 0, 'every serving is Montreal');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa286 undo: applied twice with no error');
  const after = await snapshot(db);
  ok(after.drain.md5 === LIVE.drain && after.drain.def === before.drain.def && after.drain.cmt === before.drain.cmt && after.drain.acl === before.drain.acl,
     'the drain is back exactly (definition, comment, grants)');
  ok(after.pool4 === null && after.pool3 && after.pool3.md5 === LIVE.pool && after.pool3.cmt === before.pool3.cmt && after.pool3.acl === before.pool3.acl,
     'wa191_recruit_pool is back with three arguments, exactly (definition, comment, grants)');
  ok(after.view.md5 === LIVE.view && after.view.cmt === before.view.cmt && after.view.acl === before.view.acl && after.view.opts === before.view.opts,
     'volunteer_event_summary is back exactly (definition, comment, grants, security invoker)');
  ok(after.column === 0 && after.index === 0 && after.trigger === 0 && after.chapters === null && after.trgfn === null, 'the column, its index, the trigger and both new functions are gone');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286 undo'`)).n === 1, 'one undo line after two runs');
  ok(JSON.stringify(after.rows) === JSON.stringify(before.rows), 'no row was added or removed by the migration, the assertions or the undo');
  console.log('wa286 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await snapshot(db);
  ok(again.pool4.def === twice.pool4.def && again.drain.def === twice.drain.def && again.view.def === twice.view.def && again.release === 1, 'the same patches after an undo, still one release line');
  ok(again.chapters.acl === twice.chapters.acl && again.pool4.acl === twice.pool4.acl, 'the same grants again');
  await db.close();

  // ---- a live object that moved stops the whole migration (one transaction, as the connector runs it), and nothing is kept
  for (const [label, alter, expect] of [
    ['wa266f_email_drain', `do $m$ declare v text := pg_get_functiondef('${DRAIN}'::regprocedure); begin execute replace(v, $q$'reply_to', public.wa258_role_owner(r.role),$q$, $q$'reply_to', public.wa258_role_owner(r.role) ,$q$); end $m$;`, 'wave286: a live function moved: wa266f_email_drain'],
    ['wa191_recruit_pool', `do $m$ declare v text := pg_get_functiondef('${POOL3}'::regprocedure); begin execute replace(v, $q$h.contact_id = c.id))
  ), hub as ($q$, $q$h.contact_id = c.id)) ), hub as ($q$); end $m$;`, 'wave286: a live function moved: wa191_recruit_pool'],
    ['volunteer_event_summary', `create or replace view ${VIEW} with (security_invoker = on) as select e.*, 0::bigint as roster_count from public.volunteer_events e where false;`, 'wave286: a live view moved: volunteer_event_summary']]) {
    const db3 = await base();
    if (label === 'volunteer_event_summary') await db3.exec(`drop view ${VIEW}; ` + alter); else await db3.exec(alter);
    const msg = await refused(db3, migration);
    ok(msg.includes(expect), 'a moved ' + label + ' stops the migration (' + msg + ')');
    const s = await snapshot(db3);
    ok(s.column === 0 && s.trigger === 0 && s.release === 0 && s.pool4 === null && s.pool3 !== null && s.chapters === null, 'and nothing of wave286 is kept (' + label + ')');
    await db3.close();
    console.log('a moved ' + label + ' stops the migration and nothing is kept');
  }

  // ---- without wave281 the migration refuses to start
  {
    const db4 = new PGlite();
    await db4.exec(schema281);
    const msg = await refused(db4, migration);
    ok(msg.includes('wave286 needs wave281 first'), 'without wave281 the migration stops at the top (' + msg + ')');
    ok((await one(db4, `select count(*)::int as n from pg_attribute where attrelid = 'public.volunteer_events'::regclass and attname = 'chapter'`)).n === 0, 'and volunteer_events is untouched');
    await db4.close();
    console.log('without wave281: the migration refuses to start');
  }

  // ---- the wrong order: wave281's undo cannot run while wave286 is in place (crm_chapters is referenced), and nothing is lost; undo wave286 first
  {
    const db5 = await base();
    await db5.exec(migration);
    const msg = await refused(db5, undo281);
    ok(/depend/.test(msg), 'wave281\'s undo refuses while wave286 is in place (' + msg + ')');
    const s = await snapshot(db5);
    ok(s.column === 1 && s.pool4 !== null && (await one(db5, `select to_regclass('public.crm_chapters') is not null as x`)).x, 'and nothing was dropped');
    await db5.exec(undo);
    await db5.exec(undo281);
    ok((await one(db5, `select to_regclass('public.crm_chapters') is null as x`)).x && (await one(db5, `select md5(pg_get_functiondef('${POOL3}'::regprocedure)) as m`)).m === LIVE.pool,'wave286\'s undo, then wave281\'s, runs');
    await db5.close();
    console.log('wave281 undone first: refused, nothing lost; wave286 undo then wave281 undo runs');
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
