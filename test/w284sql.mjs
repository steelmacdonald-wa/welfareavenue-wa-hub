// wave284: offline proof of build/data/wa284_import.sql and build/data/wa284_undo.sql on PGlite. Run: node test/w284sql.mjs
// Loads test/w281schema.sql and build/data/wa281_rules.sql (wave281 is built on this branch, not live yet), then test/w284schema.sql (storage, pg_net,
// the guarded and read tables, invented rows). Runs the migration twice (the second run must change nothing: bodies, grants and comments compared),
// test/w284sql.sql twice (it rolls back), the net.http_request_queue guard at the top level (a subtransaction would hide it), the undo twice (every
// wave284 object gone; a setting an admin filled in kept), and the migration and assertions once more after the undo. Also: the migration stops
// without wave281, and the live check file (test/w284live.sql) passes here first. Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema281 = read('w281schema.sql');
const mig281 = read('../build/data/wa281_rules.sql');
const schema = read('w284schema.sql');
const migration = read('../build/data/wa284_import.sql');
const undo = read('../build/data/wa284_undo.sql');
const assertions = read('w284sql.sql');
const live = read('w284live.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];
async function fresh(withWave281 = true) {
  const db = new PGlite();
  await db.exec(schema281);
  if (!withWave281) return db;   // without wave281 the fixture's rows (crm_contact_private) cannot load either
  await db.exec(mig281);
  await db.exec(schema);
  return db;
}
async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w284sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}
// every wave284 object, with its body, grants and comment, so two runs (and an undo) can be compared
const OBJECTS = `select coalesce(string_agg(x, E'\\n' order by x), '') as s from (
  select 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '') as x
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa284\\_%'
  union all select 'table ' || c.oid::regclass::text || ' ' || coalesce(c.relacl::text, '') || ' ' || c.relrowsecurity || ' ' || coalesce(md5(obj_description(c.oid, 'pg_class')), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r', 'S', 'i') and (n.nspname = 'import_stage' or c.relname like 'crm_import%' or c.relname like '%wa284%')
  union all select 'col ' || a.attrelid::regclass::text || '.' || a.attname || ' ' || coalesce(md5(col_description(a.attrelid, a.attnum)), '')
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where a.attnum > 0 and not a.attisdropped and c.relkind = 'r' and (n.nspname = 'import_stage' or c.relname like 'crm_import%')
  union all select 'policy ' || polrelid::regclass::text || ' ' || polname || ' ' || md5(coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), ''))
    from pg_policy where polname like 'wa284%' or polrelid::regclass::text like '%crm_import%'
  union all select 'trigger ' || tgrelid::regclass::text || ' ' || tgname from pg_trigger where tgname like '%wa284%'
  union all select 'schema ' || nspname || ' ' || coalesce(nspacl::text, '') from pg_namespace where nspname = 'import_stage'
  union all select 'bucket ' || id || ' ' || public || ' ' || file_size_limit from storage.buckets where id = 'imports'
  union all select 'config ' || key || ' ' || md5(value) from public.app_config where key like 'keela\\_%' and key not in ('keela_notice_days')
) q`;
const COUNTS = `select (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname like 'wa284\\_%') as functions,
  (select count(*)::int from pg_trigger where tgname = 'trg_wa284_import_guard') as triggers, (select count(*)::int from public.change_log where entity_type = 'release' and entity_id = 'wave284') as release_rows,
  (select count(*)::int from public.app_config where key like 'keela\\_%') as settings, (select count(*)::int from storage.buckets where id = 'imports') as buckets`;

try {
  const db = await fresh();

  // ---- before the migration the assertions fail
  let failed = false;
  try { await db.exec(assertions); } catch (e) { failed = true; }
  await db.exec('rollback').catch(() => {});
  ok(failed, 'before the migration the assertions fail');
  console.log('before the migration: the assertions fail, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  const first = await one(db, COUNTS);
  const objOnce = (await one(db, OBJECTS)).s;
  await db.exec(migration);
  const second = await one(db, COUNTS);
  const objTwice = (await one(db, OBJECTS)).s;
  console.log('wa284: applied twice with no error', JSON.stringify(second));
  ok(JSON.stringify(first) === JSON.stringify(second), 'a second run adds nothing: ' + JSON.stringify(first) + ' vs ' + JSON.stringify(second));
  ok(objOnce === objTwice, 'a second run leaves every body, grant and comment as the first left it');
  ok(first.functions >= 40 && first.triggers === 9 && first.release_rows === 1 && first.buckets === 1, 'the functions, nine guard triggers, one release line, the bucket (' + JSON.stringify(first) + ')');
  ok(objOnce.split('\n').filter((l) => l.startsWith('col ')).every((l) => !/ $/.test(l)), 'every new column has a comment');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the net.http_request_queue guard: a writer whose trigger queues a web call is stopped at apply (a top-level call, as the API makes it)
  {
    await db.exec(`
      update public.app_config set value = '{"subscription_history": "Subscription History"}' where key = 'keela_keys';
      create table w284_ids (k text primary key, v bigint);
      do $$ declare v_run bigint; v_file bigint; v_b bigint; begin
        v_run := public.wa284_new_run('Test net guard', 'test');
        v_file := public.wa284_register(v_run, v_run || '/net.json', 'keela_contacts_json');
        perform public.wa284_stage_rows(v_file, 0, '[{"Contact Id": "KTNET", "Contact Type": "Individual", "Full Name": "Test Net Guard", "First Name": "", "Last Name": "", "Primary Email": "net.guard@example.com", "Primary Phone": "", "Street": "", "Street Line 2": "", "City": "", "Province": "", "Postal Code": "", "Country": "", "Notes": "", "Subscription History": [{"date": "2025-01-01", "type": "Email Opted In", "form_name": "Test Form"}]}]'::jsonb, 1);
        v_b := public.wa284_new_batch(v_run, 'people');
        perform public.wa284_compare(v_b);
        insert into w284_ids values ('b', v_b);
      end $$;
      create function public.w284_test_net() returns trigger language plpgsql as $$ begin insert into net.http_request_queue (method, url) values ('POST', 'https://example.invalid/hook'); return new; end $$;
      create trigger w284_test_net after insert on public.crm_contacts for each row execute function public.w284_test_net();`);
    const b = (await one(db, `select v from w284_ids where k = 'b'`)).v;
    ok((await one(db, `select status from public.crm_import_batches where id = ${b}`)).status === 'compared', 'net guard: the batch compared (compare never reaches the queue check)');
    let msg = '';
    try { await db.exec(`begin; select public.wa284_apply(${b}); commit;`); } catch (e) { msg = String(e.message); }
    await db.exec('rollback').catch(() => {});
    ok(msg.includes('import side effect blocked (net.http_request_queue)'), 'apply stops a batch that queued a web call (' + msg + ')');
    ok((await one(db, `select count(*)::int as n from public.crm_contacts where full_name = 'Test Net Guard'`)).n === 0 && (await one(db, `select count(*)::int as n from net.http_request_queue`)).n === 0
       && (await one(db, `select status from public.crm_import_batches where id = ${b}`)).status === 'compared', 'and nothing is kept: no contact, no queued call, the batch still compared');
    await db.exec(`drop trigger w284_test_net on public.crm_contacts; drop function public.w284_test_net();`);
    await db.exec(`begin; select public.wa284_apply(${b}); commit;`);
    ok((await one(db, `select status from public.crm_import_batches where id = ${b}`)).status === 'applied', 'without the web call the same batch applies');
    await db.exec(`drop table w284_ids;`);
    console.log('net guard: a queued web call stops the apply; nothing kept');
  }

  // ---- the undo, twice (an admin filled in the assignee map first: it stays)
  await db.exec(`update public.app_config set value = '{"Test Staff One": "901"}' where key = 'keela_assignee_map';`);
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa284 undo: applied twice with no error');
  const gone = (await one(db, OBJECTS)).s.split('\n').filter(Boolean);
  ok(gone.length === 2 && /^config keela_assignee_map /.test(gone[0]) && /^config keela_keys /.test(gone[1]),
    'after the undo no wave284 object is left, only the two settings filled in since (the assignee map, the keys) (' + gone.join(' | ') + ')');
  ok((await one(db, `select to_regnamespace('import_stage') is null as x`)).x === true, 'import_stage is gone');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave284' and field = 'wave284 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select count(*)::int as n from public.crm_contacts where legacy_refs -> 'keela' ->> 'contact_id' = 'KTNET'`)).n === 1, 'the data a batch wrote stays after the undo');
  console.log('wa284 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await one(db, COUNTS);
  ok(again.functions === first.functions && again.triggers === first.triggers && again.buckets === 1, 'the same functions, triggers and bucket again after an undo');
  await db.close();

  // ---- without wave281 the migration stops at the top, and nothing is kept
  {
    const db2 = await fresh(false);
    let msg = '';
    try { await db2.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db2.exec('rollback').catch(() => {});
    ok(msg.includes('wave284 needs wave281 first'), 'without wave281 the migration stops (' + msg + ')');
    ok((await one(db2, `select to_regclass('public.crm_import_runs') is null and to_regnamespace('import_stage') is null as x`)).x === true, 'and nothing of wave284 is kept');
    await db2.close();
    console.log('without wave281 the migration stops and nothing is kept');
  }

  // ---- the live check file (run on live only inside build/sql_rollback_test.py's block), proved here first on the fixture, in one transaction
  {
    const db4 = await fresh();
    await db4.exec('begin;\n' + migration + '\n' + live + '\nrollback;');
    ok(true, 'live check file');
    console.log('live check file, offline: migration then test/w284live.sql: passed');
    await db4.close();
  }

  console.log(`w284sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
