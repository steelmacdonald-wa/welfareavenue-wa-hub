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
const ADDED = ['public.wa279_via_setup(bigint)', 'public.wa279_flow_plan()', 'public.wa279_plan_manager(bigint)', 'public.wa279_can_pick(bigint)', 'public.wa279_my_hires()', 'public.wa279_recommended(bigint)', 'public.wa279_pick_add(bigint,text,bigint,text,boolean)', 'public.wa279_pick_remove(bigint,text)', 'public.wa279_role_options(bigint,date)', 'public.wa279_role_save(bigint,text,bigint[])', 'public.wa279_role_autopick(date)', 'public.wa279_role_state(bigint,text)', 'public.wa279_policies_state(bigint)', 'public.wa279_policy_minutes()', 'public.wa279_policy_open(text)', 'public.wa279_policy_state()', 'public.wa279_policy_rule()', 'public.wa279_policy_sync()', 'public.wa279_behind_list(bigint)', 'public.wa279_tell(text,text,text,text,text,text)', 'public.wa279_onboard_tick(boolean)'];
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
  ok((await one(db, `select value from public.app_config where key = 'policy_read_minutes'`)).value === '0', 'policy_read_minutes is seeded as 0 (the rule off until the page release)');

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
  ok((await one(db, `select count(*)::int as n from public.app_config where key = 'policy_read_minutes'`)).n === 0, 'policy_read_minutes is gone (live has no such key before wave279)');
  await db.exec(`delete from public.team_members where email = 'w279.undo@example.invalid'`);
  console.log('wa279a undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  // the seed never overwrites HR's value: the release sets it to 10, and a later run of the migration keeps that
  await db.exec(`update public.app_config set value = '10' where key = 'policy_read_minutes'`);
  await db.exec(migration);
  ok((await one(db, `select value from public.app_config where key = 'policy_read_minutes'`)).value === '10', 'a second run of the migration keeps policy_read_minutes as HR set it');

  // ---- wa279c: the release restart of onboardings 4 and 5, on a fresh database with a copy of the two plans as they stood on 04/11/26 (read live, read only:
  // 46 steps each, day one 25 September 2026, Alyx's 9 done steps) plus a third plan that must not move. wa279a and wa279b go first, as at release.
  {
    const db2 = new PGlite();
    await db2.exec(schema);
    await db2.exec(migration);
    await db2.exec(liveTemplate);
    await db2.exec(`insert into public.team_members (id, name, email, department, start_date, start_source) overriding system value values
        (50, 'Test Alyx Copy', 'w279c.alyx@example.invalid', 'fundraising', date '2026-09-25', 'directory'),
        (46, 'Test Zachee Copy', 'w279c.zachee@example.invalid', 'progdev', date '2026-09-25', 'directory'),
        (47, 'Test Other Plan', 'w279c.other@example.invalid', 'progdev', date '2026-09-25', 'directory');
      insert into public.onboardings (id, member_id, person_name, status, started_at, assigned_by) overriding system value values
        (4, 50, 'Test Alyx Copy', 'active', date '2026-09-25', 'test'), (5, 46, 'Test Zachee Copy', 'active', date '2026-09-25', 'test'),
        (6, 47, 'Test Other Plan', 'active', date '2026-09-25', 'test');
      insert into public.onboarding_steps (id, onboarding_id, template_id, done, due_date) overriding system value values
  (140, 4, '86e1cj9gh', false, date '2026-10-02'), (141, 4, '86e1cj9he', false, date '2026-10-02'), (142, 4, '86e1cj9gj', false, date '2026-10-02'), (143, 4, '86e1cj9gp', true, date '2026-10-02'),
  (144, 4, '86e1cj9gx', false, date '2026-10-02'), (145, 4, '86e1cj9gr', false, date '2026-10-02'), (146, 4, '86e1cj9gy', false, date '2026-10-02'), (147, 4, '86e1cj9gn', true, date '2026-10-02'),
  (148, 4, '86e1cj9ha', false, date '2026-10-02'), (149, 4, '86e1cj9h6', false, date '2026-10-02'), (150, 4, '86e1cj9hh', false, date '2026-10-02'), (151, 4, '86e1cj9h0', false, date '2026-10-02'),
  (153, 4, '86e1cj9gm', false, date '2026-10-09'), (154, 4, '86e1cj9gv', false, date '2026-10-09'), (155, 4, '86e1cj9hg', false, date '2026-10-16'), (156, 4, '86e1cj9hz', false, date '2026-10-23'),
  (157, 4, '86e1cj9j0', true, date '2026-11-24'), (158, 4, '86e1cj9gq', false, date '2026-10-02'), (159, 4, '86e1cj9h2', false, date '2026-10-02'), (161, 4, '86e1cj9hc', false, date '2026-10-02'),
  (162, 4, '86e1cj9h8', true, date '2026-10-02'), (163, 4, '86e1cj9h3', false, date '2026-10-02'), (164, 4, '86e1cj9j3', false, date '2026-11-24'), (165, 4, '86e1cj9j4', false, date '2026-11-24'),
  (166, 4, '86e1cj9j6', false, date '2026-11-24'), (172, 4, '86e1cj9hm', false, date '2026-10-16'), (177, 4, '86e1cj9hx', false, date '2026-10-23'), (178, 4, '86e1cj9hv', false, date '2026-10-23'),
  (179, 4, '86e1cj9hw', false, date '2026-10-23'), (180, 4, '86e1cj9j1', false, date '2026-11-24'), (183, 4, '86e1cj9ht', false, date '2026-10-23'), (184, 4, '86e1cj9hr', false, date '2026-10-23'),
  (296, 4, 'wa166hub', false, date '2026-10-02'), (298, 4, 'wa166hubfirst', false, date '2026-10-02'), (300, 4, 'wa166usehub', true, date '2026-10-02'), (302, 4, 'wa166slack2', false, date '2026-10-02'),
  (304, 4, 'wa166found', true, date '2026-10-09'), (306, 4, 'wa166brand', false, date '2026-10-09'), (308, 4, 'wa166work', true, date '2026-10-09'), (310, 4, 'wa166team', true, date '2026-10-16'),
  (312, 4, 'wa166meeting', false, date '2026-10-16'), (322, 4, 'wa167w1', true, date '2026-10-02'), (324, 4, 'wa167w2', false, date '2026-10-09'), (326, 4, 'wa167w3', false, date '2026-10-16'),
  (328, 4, 'wa167w4', false, date '2026-10-23'), (375, 4, 'wa272appsetup', false, date '2026-10-02'), (186, 5, '86e1cj9gh', false, date '2026-10-02'), (187, 5, '86e1cj9he', false, date '2026-10-02'),
  (188, 5, '86e1cj9gj', false, date '2026-10-02'), (189, 5, '86e1cj9gp', false, date '2026-10-02'), (190, 5, '86e1cj9gx', false, date '2026-10-02'), (191, 5, '86e1cj9gr', false, date '2026-10-02'),
  (192, 5, '86e1cj9gy', false, date '2026-10-02'), (193, 5, '86e1cj9gn', false, date '2026-10-02'), (194, 5, '86e1cj9ha', false, date '2026-10-02'), (195, 5, '86e1cj9h6', false, date '2026-10-02'),
  (196, 5, '86e1cj9hh', false, date '2026-10-02'), (197, 5, '86e1cj9h0', false, date '2026-10-02'), (199, 5, '86e1cj9gm', false, date '2026-10-09'), (200, 5, '86e1cj9gv', false, date '2026-10-09'),
  (201, 5, '86e1cj9hg', false, date '2026-10-16'), (202, 5, '86e1cj9hz', false, date '2026-10-23'), (203, 5, '86e1cj9j0', false, date '2026-11-24'), (204, 5, '86e1cj9gq', false, date '2026-10-02'),
  (205, 5, '86e1cj9h2', false, date '2026-10-02'), (207, 5, '86e1cj9hc', false, date '2026-10-02'), (208, 5, '86e1cj9h8', false, date '2026-10-02'), (209, 5, '86e1cj9h3', false, date '2026-10-02'),
  (210, 5, '86e1cj9j3', false, date '2026-11-24'), (211, 5, '86e1cj9j4', false, date '2026-11-24'), (212, 5, '86e1cj9j6', false, date '2026-11-24'), (218, 5, '86e1cj9hm', false, date '2026-10-16'),
  (223, 5, '86e1cj9hx', false, date '2026-10-23'), (224, 5, '86e1cj9hv', false, date '2026-10-23'), (225, 5, '86e1cj9hw', false, date '2026-10-23'), (226, 5, '86e1cj9j1', false, date '2026-11-24'),
  (229, 5, '86e1cj9ht', false, date '2026-10-23'), (230, 5, '86e1cj9hr', false, date '2026-10-23'), (297, 5, 'wa166hub', false, date '2026-10-02'), (299, 5, 'wa166hubfirst', false, date '2026-10-02'),
  (301, 5, 'wa166usehub', false, date '2026-10-02'), (303, 5, 'wa166slack2', false, date '2026-10-02'), (305, 5, 'wa166found', false, date '2026-10-09'), (307, 5, 'wa166brand', false, date '2026-10-09'),
  (309, 5, 'wa166work', false, date '2026-10-09'), (311, 5, 'wa166team', false, date '2026-10-16'), (313, 5, 'wa166meeting', false, date '2026-10-16'), (323, 5, 'wa167w1', false, date '2026-10-02'),
  (325, 5, 'wa167w2', false, date '2026-10-09'), (327, 5, 'wa167w3', false, date '2026-10-16'), (329, 5, 'wa167w4', false, date '2026-10-23'), (376, 5, 'wa272appsetup', false, date '2026-10-02');
      update public.onboarding_steps set done_at = now(), done_by = 'test' where done;
      insert into public.onboarding_steps (onboarding_id, template_id, done, due_date) select 6, template_id, false, due_date from public.onboarding_steps where onboarding_id = 5;`);
    ok((await one(db2, `select count(*)::int as n from public.onboarding_steps where onboarding_id in (4, 5)`)).n === 92 && (await one(db2, `select count(*)::int as n from public.onboarding_steps where done`)).n === 9, 'the copy: 92 steps, 9 done');
    ok((await one(db2, `select count(*)::int as n from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.due_date is distinct from public.onb_due(t.section, date '2026-09-25')`)).n === 0, 'the copy: every due date is onb_due(section, 25 September), as live');
    await db2.exec(migrationB);
    const PLAN = `select s.onboarding_id, s.template_id, s.due_date::text as due, s.done from public.onboarding_steps s where s.onboarding_id in (4, 5, 6) order by 1, 2`;
    const before = JSON.stringify((await db2.query(PLAN)).rows);
    const members = `select id, start_date::text as sd, start_source from public.team_members where id in (46, 47, 50) order by id`;
    const membersBefore = JSON.stringify((await db2.query(members)).rows);
    const restart = read('../build/wa279c_restart.sql'), undoC = read('../build/wa279c_undo.sql');
    // no release date yet (wa279a seeds onboard_behind_since empty): refused, nothing changes
    let refused = '';
    try { await db2.exec(restart); } catch (e) { refused = String(e.message); }
    ok(/onboard_behind_since is not a date/.test(refused) && JSON.stringify((await db2.query(PLAN)).rows) === before, 'wa279c refuses with no release date and changes nothing (' + refused + ')');
    await db2.exec(`update public.app_config set value = '2026-11-05' where key = 'onboard_behind_since'`);
    await db2.exec(restart);
    await db2.exec(restart);
    console.log('wa279c: applied twice with no error');
    ok((await one(db2, `select string_agg(id || '=' || started_at, ',' order by id) as x from public.onboardings where id in (4, 5, 6)`)).x === '4=2026-11-05,5=2026-11-05,6=2026-09-25', 'plans 4 and 5 start on the release date; plan 6 does not move');
    const open = await one(db2, `select count(*)::int as n, count(*) filter (where s.due_date is distinct from public.onb_due(t.section, date '2026-11-05'))::int as bad
      from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id in (4, 5) and not s.done`);
    ok(open.n > 80 && open.bad === 0, 'every open step of 4 and 5 is due from the release date (' + open.n + ' open, ' + open.bad + ' wrong)');
    const doneBefore = JSON.stringify(JSON.parse(before).filter((r) => r.done));
    const doneAfter = JSON.stringify((await db2.query(PLAN)).rows.filter((r) => r.done));
    // 9 done in the copy; wa279b retires wa166team and 86e1cj9j0 (Alyx had both done), so 7 are left at the restart
    ok(doneAfter === doneBefore && JSON.parse(doneBefore).length === 7, 'the done steps keep their ticks and their dates (' + doneAfter + ')');
    ok((await one(db2, `select string_agg(template_id || '=' || due_date, ',' order by template_id) as x from public.onboarding_steps where onboarding_id = 4 and template_id in ('wa279role60', 'wa279role90')`)).x === 'wa279role60=2027-01-04,wa279role90=2027-02-03', 'the new role steps from wa279b are re-dated too (60 and 90 days from 5 November)');
    ok(JSON.stringify((await db2.query(`select onboarding_id, template_id, due_date::text as due, done from public.onboarding_steps where onboarding_id = 6 order by 1, 2`)).rows) === JSON.stringify(JSON.parse(before).filter((r) => Number(r.onboarding_id) === 6)), 'plan 6 is untouched');
    ok(JSON.stringify((await db2.query(members)).rows) === membersBefore, 'team_members (start_date, start_source) are untouched');
    ok((await one(db2, `select string_agg(entity_id || ':' || old_value || '>' || new_value, ',' order by entity_id) as x from public.change_log where changed_by = 'wave279c'`)).x === '4:2026-09-25>2026-11-05,5:2026-09-25>2026-11-05', 'one change_log row per plan, even after two runs');
    // the undo, twice: the plans are back exactly as before the restart (after wa279b)
    await db2.exec(undoC);
    await db2.exec(undoC);
    console.log('wa279c undo: applied twice with no error');
    {
      const now = (await db2.query(PLAN)).rows, was = JSON.parse(before);
      const diff = now.filter((r, i) => JSON.stringify(r) !== JSON.stringify(was[i])).concat(now.length === was.length ? [] : [{ rows: now.length, was: was.length }]);
      ok(diff.length === 0, 'after the wa279c undo every step of 4, 5 and 6 has its due date and tick as before the restart (' + JSON.stringify(diff) + ')');
    }
    ok((await one(db2, `select string_agg(id || '=' || started_at, ',' order by id) as x from public.onboardings where id in (4, 5, 6)`)).x === '4=2026-09-25,5=2026-09-25,6=2026-09-25', 'and both start on 25 September again');
    ok((await one(db2, `select count(*)::int as n from public.change_log where changed_by = 'wave279c undo'`)).n === 2, 'one undo change_log row per plan');
    // a step ticked after the restart keeps its tick through the undo and gets its old date back
    await db2.exec(restart);
    await db2.exec(`update public.onboarding_steps set done = true, done_at = now(), done_by = 'test' where onboarding_id = 5 and template_id in ('86e1cj9gh', '86e1cj9h6', 'wa279role60')`);
    await db2.exec(undoC);
    ok((await one(db2, `select done::text || ' ' || due_date as x from public.onboarding_steps where onboarding_id = 5 and template_id = '86e1cj9gh'`)).x === 'true 2026-10-02', 'a step ticked after the restart stays ticked and gets its listed date back');
    // wa279b moved 86e1cj9h6 from WEEK 1 to WEEK 2 (so its date before the restart was 9 October, not the listed 2 October), and added wa279role60
    ok((await one(db2, `select string_agg(template_id || ' ' || done || ' ' || due_date, ',' order by template_id) as x from public.onboarding_steps where onboarding_id = 5 and template_id in ('86e1cj9h6', 'wa279role60')`)).x === '86e1cj9h6 true 2026-10-09,wa279role60 true 2026-11-24',
      'a moved step and a new step ticked after the restart stay ticked and get the date wa279b gave them');
    ok((await one(db2, `select due_date::text as d from public.onboarding_steps where onboarding_id = 4 and template_id = '86e1cj9h8'`)).d === '2026-10-02', 'a moved step done before the restart keeps its own date (wa279b and the restart leave done steps alone)');
    // someone moved a plan: the restart refuses and changes nothing
    await db2.exec(`update public.onboardings set started_at = date '2026-10-01' where id = 5`);
    const moved = JSON.stringify((await db2.query(PLAN)).rows);
    refused = '';
    try { await db2.exec(restart); } catch (e) { refused = String(e.message); }
    ok(/onboarding 5 starts on 2026-10-01/.test(refused) && JSON.stringify((await db2.query(PLAN)).rows) === moved && (await one(db2, `select started_at::text as d from public.onboardings where id = 4`)).d === '2026-09-25', 'a plan someone moved stops the restart before either plan changes (' + refused + ')');
    await db2.close();
    console.log('wa279c: every check passed');
  }

  console.log(`w279sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
