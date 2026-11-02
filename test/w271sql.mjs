// wave271 (Task 1): offline proof of build/wa271a_onboard.sql and build/wa271a_undo.sql on PGlite. Run: node test/w271sql.mjs
// Loads test/w271schema.sql (a slice of the live schema), the migration (twice, to prove it is safe to run again), then test/w271sql.sql.
// Task 6 adds build/wa271b_remind.sql (the notification kinds, the manager-link columns, the hourly wa271_remind cron job) on top of it, with its own checks,
// and its undo is a part of build/wa271a_undo.sql. PGlite has no pg_cron or pg_net, so test/w271schema.sql stubs cron.schedule, cron.unschedule and call_edge.
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
const remind = read('../build/wa271b_remind.sql');
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

/* Task 6: the notification kinds, the manager-link columns and the hourly cron job, as wa271b_remind.sql leaves them */
const KINDS = ['onboard_date', 'onboard_grid', 'onboard_remind'];
async function checkRemind(db, label) {
  const kinds = (await db.query(`select * from public.hub_notification_kinds where key = any($1) order by key`, [KINDS])).rows;
  ok(kinds.length === 3, label + ': the three kinds are in the registry');
  for (const k of kinds) {
    ok(k.grp === 'people' && k.grp_title === 'People and HR', label + ': ' + k.key + ' sits in People and HR');
    ok(k.hub === true && k.slack === true && k.email === false && k.channel_only === false && k.active === true, label + ': ' + k.key + ' has a Hub and a Slack switch and no email');
    ok(k.title && k.blurb && k.says && k.example_title && k.example_body && k.example_url === '#hrcentre/onboarding' && k.audience && k.sender, label + ': ' + k.key + ' is fully described');
    ok(!/\bAI\b|\u2014/.test(JSON.stringify(k)), label + ': ' + k.key + ' has no "AI" and no em dash');
  }
  ok(new Set(kinds.map((k) => k.sort)).size === 3, label + ': the three kinds have their own order');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key = 'timeoff_request'`)).n === 1, label + ': the existing kinds are untouched');
  for (const c of ['manager_link_sent_at', 'manager_link_member_id']) {
    ok((await one(db, `select col_description('public.hub_onboard_flows'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_onboard_flows'::regclass and attname = '${c}')) as d`)).d, label + ': ' + c + ' has a comment');
    ok((await one(db, `select has_column_privilege('authenticated', 'public.hub_onboard_flows', '${c}', 'select') as g`)).g === true, label + ': HR can read ' + c);
  }
  ok((await one(db, `select has_column_privilege('authenticated', 'public.hub_onboard_flows', 'pw_nonce', 'select') as g`)).g === false, label + ': pw_nonce is still hidden from the browser');
  const fn = await one(db, `select obj_description('public.wa271_remind()'::regprocedure, 'pg_proc') as cmt,
      has_function_privilege('anon', 'public.wa271_remind()', 'execute') as anon, has_function_privilege('authenticated', 'public.wa271_remind()', 'execute') as auth,
      has_function_privilege('service_role', 'public.wa271_remind()', 'execute') as svc`);
  ok(fn.cmt && fn.anon === false && fn.auth === false && fn.svc === true, label + ': wa271_remind is commented and only the service key may call it');
  const jobs = (await db.query(`select schedule, command from cron.job where jobname = 'wa-onboard-remind'`)).rows;
  ok(jobs.length === 1, label + ': exactly one wa-onboard-remind job');
  ok(/^\d{1,2} \* \* \* \*$/.test(jobs[0].schedule), label + ': it runs hourly (' + jobs[0].schedule + ')');
  ok(/wa271_remind\(\)/.test(jobs[0].command), label + ': it runs wa271_remind()');
  await db.exec('delete from public.w271_edge_calls');
  await db.query('select public.wa271_remind()');
  const calls = (await db.query('select fn, payload from public.w271_edge_calls')).rows;
  ok(calls.length === 1 && calls[0].fn === 'onboard-run' && calls[0].payload.action === 'remind' && Object.keys(calls[0].payload).length === 1, label + ': wa271_remind calls onboard-run with {"action":"remind"} and nothing else');
  console.log(label + ': wa271b checks passed');
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
  await db.exec(remind);
  await db.exec(remind);   // safe to run twice, and leaves one cron job
  console.log('wa271b_remind: applied twice with no error');
  await checkRemind(db, 'wa271b');
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
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa271%'`)).n === 0, 'no wa271 function left (wa271_remind included)');
  ok((await one(db, `select count(*)::int as n from cron.job where jobname = 'wa-onboard-remind'`)).n === 0, 'the hourly cron job is gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key = any(array['onboard_date', 'onboard_grid', 'onboard_remind'])`)).n === 0, 'the three notification kinds are gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key = 'timeoff_request'`)).n === 1, 'the other notification kinds are untouched by the undo');
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
  await db.exec(remind);
  await checkRemind(db, 're-applied wa271b');
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
