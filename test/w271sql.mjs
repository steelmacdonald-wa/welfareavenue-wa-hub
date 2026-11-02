// wave271 (Task 1): offline proof of build/wa271a_onboard.sql and build/wa271a_undo.sql on PGlite. Run: node test/w271sql.mjs
// Loads test/w271schema.sql (a slice of the live schema), the migration (twice, to prove it is safe to run again), then test/w271sql.sql.
// Then proves the undo: the 2-argument onboarding_assign comes back exactly as it was, due_day = 3, accepted_on data untouched,
// and the migration and the assertions still pass after an undo. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w271schema.sql');
const migration = read('../build/wa271a_onboard.sql');
const undo = read('../build/wa271a_undo.sql');
const assertions = read('w271sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w271sql: all assertions passed', label + ': the assertion script finished');
  console.log(label + ': ' + line);
}

try {
  const db = new PGlite();
  await db.exec(schema);
  const before = await one(db,
    `select pg_get_functiondef('public.onboarding_assign(bigint,text)'::regprocedure) as def,
            (select proacl::text from pg_proc where oid = 'public.onboarding_assign(bigint,text)'::regprocedure) as acl,
            obj_description('public.onboarding_assign(bigint,text)'::regprocedure, 'pg_proc') as cmt`);

  await db.exec(migration);
  await db.exec(migration);   // safe to run twice
  console.log('migration: applied twice with no error');
  await runAssertions(db, 'assertions');

  // ---- the undo. Put real-looking work in first: an accepted candidate (kept) and its flow (dropped with the tables).
  await db.exec(`
    insert into public.hub_candidates (name, email, status) values ('Test Person Undo', 'w271.undo@example.invalid', 'offer');
    update public.hub_candidates set accepted_on = date '2026-11-20', offer_respond_by = date '2026-11-18' where name = 'Test Person Undo';`);
  ok((await one(db, `select count(*)::int as n from public.hub_onboard_flows`)).n === 1, 'the accepted candidate has a flow before the undo');
  await db.exec(undo);
  await db.exec(undo);   // safe to run twice
  console.log('undo: applied twice with no error');

  ok((await one(db, `select to_regclass('public.hub_onboard_flows') as r`)).r === null, 'flows table dropped');
  ok((await one(db, `select to_regclass('public.hub_onboard_grids') as r`)).r === null, 'grids table dropped');
  ok((await one(db, `select to_regclass('public.hub_onboard_steps') as r`)).r === null, 'steps table dropped');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa271%'`)).n === 0, 'no wa271 function left');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'wa271_cand_accepted'`)).n === 0, 'accept trigger dropped');
  ok((await one(db, `select count(*)::int as n from information_schema.columns where table_name = 'hub_candidates' and column_name in ('offer_respond_by', 'offer_start')`)).n === 0, 'offer columns dropped');
  ok((await one(db, `select count(*)::int as n from public.app_config where key like 'onboard\\_%'`)).n === 0, 'onboard_ settings removed');
  ok((await one(db, `select count(*)::int as n from public.hr_setup_template where phase = 'The onboarding call' and due_day = 3`)).n === 2, 'due_day is 3 again');
  ok((await one(db, `select count(*)::int as n from public.hr_setup_template where phase = 'The onboarding call' and due_day is distinct from 3`)).n === 0, 'no call step left on another day');
  ok((await one(db, `select count(*)::int as n from public.hr_setup_template where phase = 'Before day one' and due_day = 0`)).n === 1, 'other phases untouched');
  const cand = await one(db, `select accepted_on::text as a from public.hub_candidates where name = 'Test Person Undo'`);
  ok(cand && cand.a === '2026-11-20', 'hub_candidates.accepted_on is untouched by the undo');

  const procs = (await db.query(`select pg_get_function_identity_arguments(oid) as args from pg_proc where proname = 'onboarding_assign' and pronamespace = 'public'::regnamespace`)).rows;
  ok(procs.length === 1 && procs[0].args === 'p_member_id bigint, p_by text', 'only the 2-argument onboarding_assign exists');
  const after = await one(db,
    `select pg_get_functiondef('public.onboarding_assign(bigint,text)'::regprocedure) as def,
            (select proacl::text from pg_proc where oid = 'public.onboarding_assign(bigint,text)'::regprocedure) as acl,
            obj_description('public.onboarding_assign(bigint,text)'::regprocedure, 'pg_proc') as cmt`);
  ok(after.def === before.def, 'onboarding_assign body is exactly the one live has today');
  ok(after.cmt === before.cmt && after.cmt, 'its comment is back as it was');
  ok(after.acl === before.acl, 'its ACL is back as it was (' + after.acl + ')');
  ok(/v_start date := current_date;/.test(after.def), 'the restored body starts today');
  const grants = await one(db,
    `select has_function_privilege('anon', 'public.onboarding_assign(bigint,text)', 'execute') as anon,
            has_function_privilege('authenticated', 'public.onboarding_assign(bigint,text)', 'execute') as auth,
            has_function_privilege('service_role', 'public.onboarding_assign(bigint,text)', 'execute') as svc`);
  ok(grants.anon === false && grants.auth === true && grants.svc === true, 'the restored onboarding_assign keeps its grants');
  ok((await one(db, `select (proacl is not null)::boolean as x from pg_proc where oid = 'public.onboarding_assign(bigint,text)'::regprocedure`)).x === true, 'grants are explicit, as on live');

  // the restored function still works
  await db.exec(`
    insert into public.team_members (name, email, department) values ('Test Person Restored', 'w271.restored@example.invalid', 'w271test');
    insert into public.hub_roles (email, role) values ('w271.restorer@example.invalid', 'member');
    select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.restorer@example.invalid"}', false);`);
  const newId = (await one(db, `select public.onboarding_assign((select id from public.team_members where name = 'Test Person Restored'), 'x') as id`)).id;
  const started = await one(db, `select started_at::text as s from public.onboardings where id = ${Number(newId)}`);
  ok(started.s === (await one(db, `select current_date::text as d`)).d, 'the restored onboarding_assign starts today');
  await db.exec(`select set_config('request.jwt.claims', '', false)`);
  console.log('undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await db.exec(`delete from public.onboardings where person_name = 'Test Person Restored'; delete from public.team_members where name = 'Test Person Restored'; delete from public.hub_roles where email = 'w271.restorer@example.invalid';`);
  ok((await one(db, `select count(*)::int as n from public.hub_onboard_flows`)).n === 0, 're-applied: no flow for the candidate accepted before (the trigger is for new acceptances)');
  await runAssertions(db, 're-applied assertions');

  console.log(`w271sql.mjs: OK (${checks} runner checks, plus both assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
