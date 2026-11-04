// wave279: offline proof of build/wa279a_rules.sql and build/wa279a_undo.sql on PGlite. Run: node test/w279sql.mjs
// Loads test/w279schema.sql (a slice of the live schema), the migration (twice, to prove it is safe to run again), then test/w279sql.sql (twice: the assertions
// roll back, so a second run proves they leave nothing behind). Then proves the undo (run twice): every function the migration changed is back exactly as live
// has it (pg_get_functiondef, comment and ACL compared before and after), the column, the trigger and the new functions are gone, and the migration and the
// assertions still pass after an undo. PGlite has no pg_cron or pg_net, so test/w279schema.sql stubs cron.schedule, cron.unschedule and call_edge.
// Tasks 2 to 4 of wave279 extend build/wa279a_rules.sql, build/wa279a_undo.sql, test/w279sql.sql and test/w279schema.sql, and add their own checks here.
// Standalone: it does not load or change test/w271sql.mjs. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w279schema.sql');
const migration = read('../build/wa279a_rules.sql');
const undo = read('../build/wa279a_undo.sql');
const assertions = read('w279sql.sql');
const liveTemplate = read('w279live_template.sql');
const migrationB = read('../build/wa279b_template.sql');
const undoB = read('../build/wa279b_undo.sql');
const assertionsB = read('w279b.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

async function runAssertions(db, label, sql = assertions, expected = 'w279sql: all assertions passed') {
  const res = await db.exec(sql);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === expected, label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}

// the functions wave279a redefines or adds, as they stand: body, comment and ACL
const REDEFINED = ['public.onboarding_template_propagate()', 'public.wa166_path_state(bigint,text)'];
const ADDED = ['public.wa279_via_setup(bigint)', 'public.wa279_flow_plan()', 'public.wa279_plan_manager(bigint)', 'public.wa279_can_pick(bigint)', 'public.wa279_recommended(bigint)', 'public.wa279_pick_add(bigint,text,bigint,text,boolean)', 'public.wa279_pick_remove(bigint,text)', 'public.wa279_role_options(bigint,date)', 'public.wa279_role_save(bigint,text,bigint[])', 'public.wa279_role_autopick(date)', 'public.wa279_role_state(bigint,text)', 'public.wa279_policies_state(bigint)', 'public.wa279_policy_minutes()', 'public.wa279_policy_open(text)', 'public.wa279_policy_state()', 'public.wa279_policy_rule()', 'public.wa279_policy_sync()', 'public.wa279_behind_list(bigint)', 'public.wa279_tell(text,text,text,text,text,text)', 'public.wa279_onboard_tick(boolean)'];
async function snapshot(db) {
  const out = {};
  for (const f of REDEFINED) {
    out[f] = await one(db, `select pg_get_functiondef('${f}'::regprocedure) as def, obj_description('${f}'::regprocedure, 'pg_proc') as cmt,
      (select proacl::text from pg_proc where oid = '${f}'::regprocedure) as acl`);
  }
  return out;
}

try {
  const db = new PGlite();
  await db.exec(schema);

  // ---- before: the live functions, and the failing state (no column yet)
  const before = await snapshot(db);
  let missing = false;
  try { await db.exec(assertions); } catch (e) { missing = /setup_covered|wa279_via_setup/.test(String(e.message)); }
  await db.exec('rollback').catch(() => {});
  ok(missing, 'before the migration the assertions fail on the missing column');
  console.log('before the migration: the assertions fail on the missing setup_covered column, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  await db.exec(migration);
  console.log('wa279a: applied twice with no error');
  const afterMig = await snapshot(db);
  for (const f of REDEFINED) ok(afterMig[f].def !== before[f].def, f + ' was redefined by the migration');
  ok(/wa279_via_setup/.test(afterMig['public.onboarding_template_propagate()'].def), 'propagate now asks wa279_via_setup');
  ok(afterMig['public.onboarding_template_propagate()'].acl === before['public.onboarding_template_propagate()'].acl, 'propagate keeps its ACL');
  ok(afterMig['public.wa166_path_state(bigint,text)'].acl === before['public.wa166_path_state(bigint,text)'].acl, 'path_state keeps its ACL');
  ok(afterMig['public.wa166_path_state(bigint,text)'].cmt === before['public.wa166_path_state(bigint,text)'].cmt, 'path_state keeps its comment');
  for (const f of ADDED) ok((await one(db, `select to_regprocedure('${f}') is not null as x`)).x === true, f + ' exists');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa279_flow_plan' and not tgisinternal`)).n === 1, 'one flow trigger after two runs');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- wa279b: the content, on a copy of the live template rows (04/11/26). Applied twice, asserted twice, undone twice (before the wa279a undo), and re-applied.
  await db.exec(liveTemplate);
  const TEMPLATE = `select id, section, parent_id, name, description, sort, priority, active, academy_path, training_id, setup_covered from public.onboarding_template order by id`;
  const beforeB = JSON.stringify((await db.query(TEMPLATE)).rows);
  const countRows = async () => (await one(db, `select count(*)::int as n from public.onboarding_template`)).n;
  const rowsBefore = await countRows();
  ok((await one(db, `select count(*)::int as n from public.app_config where key = 'onboard_role_recommend'`)).n === 0, 'the recommend setting is absent before wa279b');
  const COVERED = `('86e1cj9gj', '86e1cj9gp', '86e1cj9gy', '86e1cj9h3')`;
  const covered = async (who) => (await db.query(`select s.template_id, s.done from public.onboarding_steps s join public.onboardings o on o.id = s.onboarding_id
    where o.person_name = '${who}' and s.template_id in ${COVERED} order by 1`)).rows.map((r) => r.template_id + (r.done ? ':done' : ':open')).join(',');
  for (let pass = 1; pass <= 2; pass++) {
    // two RUNNING plans before wa279b: one with a setup flow, one without; each has one covered step done (Chrome) and the rest open
    await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","email":"w279b.run@example.invalid"}', false);
      insert into public.hub_roles (email, role) values ('w279b.run@example.invalid', 'member');
      insert into public.team_members (name, email, department, role) values ('Run Flow', 'w279b.runflow@example.invalid', 'w279test', 'Analyst'), ('Run NoFlow', 'w279b.runnoflow@example.invalid', 'w279test', 'Analyst');
      insert into public.hub_candidates (name) values ('Run Flow Candidate');
      select public.onboarding_assign(id, 'test') from public.team_members where email in ('w279b.runflow@example.invalid', 'w279b.runnoflow@example.invalid');
      update public.onboarding_steps set done = true, done_at = now(), done_by = 'test' where template_id = '86e1cj9gj' and onboarding_id in (select id from public.onboardings where person_name like 'Run %');
      insert into public.hub_onboard_flows (candidate_id, onboarding_id) select c.id, o.id from public.hub_candidates c, public.onboardings o where c.name = 'Run Flow Candidate' and o.person_name = 'Run Flow';`);
    ok((await covered('Run Flow')) === '86e1cj9gj:done,86e1cj9gp:open,86e1cj9gy:open,86e1cj9h3:open', 'before wa279b the running plan with a flow still has the covered steps');
    await db.exec(migrationB);
    await db.exec(migrationB);
    ok((await covered('Run Flow')) === '86e1cj9gj:done', 'after wa279b the running plan with a flow lost its open covered steps and kept the done one');
    ok((await covered('Run NoFlow')) === '86e1cj9gj:done,86e1cj9gp:open,86e1cj9gy:open,86e1cj9h3:open', 'a running plan with no flow keeps all four');
    ok((await countRows()) === rowsBefore + 18, 'wa279b adds eighteen rows and no more, even when run twice');
    ok(JSON.stringify((await db.query(TEMPLATE)).rows) !== beforeB, 'wa279b changed the template');
    await runAssertions(db, 'wa279b assertions (pass ' + pass + ')', assertionsB, 'w279b: all assertions passed');
    await runAssertions(db, 'wa279b assertions again (pass ' + pass + ')', assertionsB, 'w279b: all assertions passed');
    await db.exec(undoB);
    await db.exec(undoB);
    ok((await covered('Run Flow')) === '86e1cj9gj:done,86e1cj9gp:open,86e1cj9gy:open,86e1cj9h3:open', 'after the undo the open covered steps are back on the running plan with a flow, the done one still done');
    ok((await covered('Run NoFlow')) === '86e1cj9gj:done,86e1cj9gp:open,86e1cj9gy:open,86e1cj9h3:open', 'and the plan with no flow is unchanged');
    await db.exec(`delete from public.hub_onboard_flows where candidate_id in (select id from public.hub_candidates where name = 'Run Flow Candidate');
      delete from public.hub_candidates where name = 'Run Flow Candidate';
      delete from public.hr_setup_steps where onboarding_id in (select id from public.onboardings where person_name like 'Run %');
      delete from public.onboarding_steps where onboarding_id in (select id from public.onboardings where person_name like 'Run %');
      delete from public.onboardings where person_name like 'Run %';
      delete from public.team_members where email like 'w279b.run%@example.invalid';
      delete from public.hub_roles where email = 'w279b.run@example.invalid'`);
    ok(JSON.stringify((await db.query(TEMPLATE)).rows) === beforeB, 'the wa279b undo puts every template row back exactly (name, description, section, parent, sort, priority, active, path, training, setup_covered)');
    ok((await countRows()) === rowsBefore, 'the undo deletes the eighteen inserted rows');
    ok((await one(db, `select count(*)::int as n from public.app_config where key = 'onboard_role_recommend'`)).n === 0, 'the undo deletes the recommend setting');
    console.log('wa279b: applied twice, asserted, undone twice, template back exactly (pass ' + pass + ')');
  }
  // the live rows are only test data: take them out again so the wa279a undo meets the generic fixtures only
  await db.exec(`delete from public.onboarding_template where id not like 't-%'; delete from public.academy_paths where key in ('hub', 'foundations', 'branding', 'team', 'any'); delete from public.trainings where category = 'live'`);

  // ---- the undo, twice, with a plan and a flow in place first so the undo meets real rows
  await db.exec(`insert into public.team_members (name, email) values ('Test Undo Member', 'w279.undo@example.invalid');
    update public.onboarding_template set setup_covered = true where id = 't-w2';`);
  const undone = await one(db, `select count(*)::int as n from public.onboarding_template where setup_covered`);
  ok(undone.n === 1, 'a covered row exists before the undo');
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa279a undo: applied twice with no error');
  const afterUndo = await snapshot(db);
  for (const f of REDEFINED) {
    ok(afterUndo[f].def === before[f].def, f + ' is back exactly as live has it (pg_get_functiondef)');
    ok(afterUndo[f].cmt === before[f].cmt, f + ' comment is back as it was');
    ok(afterUndo[f].acl === before[f].acl, f + ' ACL is back as it was (' + afterUndo[f].acl + ')');
  }
  for (const f of ADDED) ok((await one(db, `select to_regprocedure('${f}') is null as x`)).x === true, f + ' is gone');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_wa279_flow_plan'`)).n === 0, 'the flow trigger is gone');
  ok((await one(db, `select count(*)::int as n from information_schema.columns where table_name = 'onboarding_template' and column_name = 'setup_covered'`)).n === 0, 'the column is dropped');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa279%'`)).n === 0, 'no wa279 function left');
  ok((await one(db, `select count(*)::int as n from pg_class where relname = 'onboarding_role_picks'`)).n === 0, 'the role picks table is gone');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'trg_onb_tmpl_propagate'`)).n === 1, 'the live template trigger is still there');
  ok((await one(db, `select count(*)::int as n from pg_class where relname = 'wa_policy_opens'`)).n === 0, 'the policy opens table is gone');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname like 'trg_wa279_policy%'`)).n === 0, 'both policy triggers are gone');
  ok((await one(db, `select count(*)::int as n from pg_class where relname in ('wa_policies', 'wa_policy_signoffs') and relkind = 'r'`)).n === 2, 'the live policy tables are untouched');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgrelid = 'public.wa_policy_signoffs'::regclass and not tgisinternal`)).n === 0, 'no trigger is left on the sign-offs (live has none)');
  ok((await one(db, `select count(*)::int as n from pg_class where relname = 'onboarding_behind_log'`)).n === 0, 'the behind log table is gone');
  ok((await one(db, `select count(*)::int as n from cron.job where jobname = 'wa-onboard-behind'`)).n === 0, 'the behind cron entry is gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key in ('onboard_behind', 'onboard_behind_lead', 'onboard_role_pick')`)).n === 0, 'the three notification kinds are gone');
  ok((await one(db, `select count(*)::int as n from public.app_config where key in ('onboard_behind_on', 'onboard_behind_since', 'onboard_role_picks_since')`)).n === 0, 'the three settings are gone');
  await db.exec(`delete from public.team_members where email = 'w279.undo@example.invalid'`);
  console.log('wa279a undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');

  console.log(`w279sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
