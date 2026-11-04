// wave271 (Task 1): offline proof of build/wa271a_onboard.sql and build/wa271a_undo.sql on PGlite. Run: node test/w271sql.mjs
// Loads test/w271schema.sql (a slice of the live schema), the migration (twice, to prove it is safe to run again), then test/w271sql.sql.
// Task 6 adds build/wa271b_remind.sql (the notification kinds, the manager-link columns, the hourly wa271_remind cron job) on top of it, with its own checks,
// and its undo is a part of build/wa271a_undo.sql. PGlite has no pg_cron or pg_net, so test/w271schema.sql stubs cron.schedule, cron.unschedule and call_edge.
// Then proves the undo: the 2-argument onboarding_assign comes back exactly as it was, due_day = 3, accepted_on data untouched,
// and the migration and the assertions still pass after an undo. Touches no live database. Exits non-zero on any failure.
// wave275 (Task 1): build/wa275a_streamlined.sql is loaded after wave271 (twice), test/w275sql.sql runs against it, test/w271sql.sql runs again with it loaded,
// and the undo round trip takes wa275a_undo.sql first (the wave271 ready list and accept trigger come back exactly), then the wave271 undo as before.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w271schema.sql');
const migration = read('../build/wa271a_onboard.sql');
const remind = read('../build/wa271b_remind.sql');
const card = read('../build/wa271c_card.sql');
const minHours = read('../build/wa271d_min_hours.sql');
const undo = read('../build/wa271a_undo.sql');
const assertions = read('w271sql.sql');
const streamlined = read('../build/wa275a_streamlined.sql');
const undo275 = read('../build/wa275a_undo.sql');
const assertions275 = read('w275sql.sql');
const optional275 = read('../build/wa275b_optional.sql');   // wave275b (03/11/26): three availability checks optional, off by default
const undo275b = read('../build/wa275b_undo.sql');

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

async function runAssertions275(db, label, withB = false) {
  const res = await db.exec(assertions275);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w275sql: all assertions passed' + (withB ? ' (with wa275b)' : ''), label + ': the wave275 assertion script finished' + (withB ? ', its wa275b section included' : '') + ' (' + line + ')');
  console.log(label + ': ' + line);
}
const FN271 = `select pg_get_functiondef('public.wa271_ready_list()'::regprocedure) as ready, obj_description('public.wa271_ready_list()'::regprocedure, 'pg_proc') as ready_cmt,
  (select proacl::text from pg_proc where oid = 'public.wa271_ready_list()'::regprocedure) as ready_acl,
  pg_get_functiondef('public.wa271_cand_accepted()'::regprocedure) as acc, obj_description('public.wa271_cand_accepted()'::regprocedure, 'pg_proc') as acc_cmt,
  (select proacl::text from pg_proc where oid = 'public.wa271_cand_accepted()'::regprocedure) as acc_acl,
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.hub_onboard_flows'::regclass and conname = 'hub_onboard_flows_status_check') as status_check`;

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
  ok((await one(db, `select count(*)::int as n from pg_indexes where schemaname = 'public' and indexname = 'hub_onboard_flows_manager_link_idx'`)).n === 1, label + ': manager_link_member_id has its index');
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

  // ---- Task 8: the lead's card says starts_on while day one is ahead, and only then
  await db.exec(card);
  await db.exec(card);   // safe to run twice
  console.log('wa271c_card: applied twice with no error');
  const cardOf = async (startSql) => {
    await db.exec(`insert into public.team_members (name, email) values ('Test Person Card', 'w271.card@example.invalid');
      insert into public.onboardings (member_id, person_name, started_at) select id, name, ${startSql} from public.team_members where name = 'Test Person Card';`);
    const r = await one(db, `select public.wa166_person_card((select id from public.onboardings where person_name = 'Test Person Card'), 'manager') as j,
      ${startSql}::text as d`);
    await db.exec(`delete from public.onboardings where person_name = 'Test Person Card'; delete from public.team_members where name = 'Test Person Card';`);
    return r;
  };
  const TODAY = `(now() at time zone 'America/Toronto')::date`;
  let c1 = await cardOf(`(${TODAY} + 5)`);
  ok(c1.j.starts_on === c1.d && c1.j.day === 1, 'a first day ahead: starts_on is that date');
  c1 = await cardOf(TODAY);
  ok(c1.j.starts_on === null && c1.j.day === 1, 'on day one: starts_on is null and the day is 1');
  c1 = await cardOf(`(${TODAY} - 3)`);
  ok(c1.j.starts_on === null && c1.j.day === 4, 'after day one: starts_on is null and the day counts');
  ok((await one(db, `select has_function_privilege('authenticated', 'public.wa166_person_card(bigint,text)', 'execute') as x`)).x === false, 'the card stays out of reach of the browser');
  ok(/starts_on/.test((await one(db, `select obj_description('public.wa166_person_card(bigint,text)'::regprocedure, 'pg_proc') as c`)).c), 'the card comment says starts_on');

  // ---- wave271d: the hire's minimum hours setting
  await db.exec(minHours);
  await db.exec(minHours);   // safe to run twice
  console.log('wa271d_min_hours: applied twice with no error');
  ok((await one(db, `select count(*)::int as n from public.app_config where key = 'onboard_grid_min_hours' and value = '10'`)).n === 1, 'wa271d: onboard_grid_min_hours is 10, once');
  await db.exec(`update public.app_config set value = '6' where key = 'onboard_grid_min_hours'`);
  await db.exec(minHours);
  ok((await one(db, `select value from public.app_config where key = 'onboard_grid_min_hours'`)).value === '6', 'wa271d: running it again keeps the value HR set');

  // ---- wave275 (Task 1): the streamlined onboarding, on top of wave271
  const wa271Before = await one(db, FN271);   // what wave271 has now: the wa275 undo must bring exactly this back
  await db.exec(streamlined);
  await db.exec(streamlined);   // safe to run twice
  console.log('wa275a_streamlined: applied twice with no error');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'wa275_offer_sent'`)).n === 1, 'wa275: one offer-sent trigger after two runs');
  ok((await one(db, `select count(*)::int as n from pg_constraint where conrelid = 'public.team_members'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%wa275_availability_ok%'`)).n === 1, 'wa275: one availability check after two runs');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key in ('onboard_propose', 'onboard_answer', 'onboard_ready')`)).n === 3, 'wa275: three new kinds after two runs');
  await runAssertions275(db, 'wa275 assertions');
  await runAssertions275(db, 'wa275 assertions (second run; the first rolled back)');
  await runAssertions(db, 'wa271 assertions with wa275 loaded');
  // running the migration again keeps a value HR changed
  await db.exec(`update public.app_config set value = '72' where key = 'onboard_propose_lead_hours'`);
  await db.exec(streamlined);
  ok((await one(db, `select value from public.app_config where key = 'onboard_propose_lead_hours'`)).value === '72', 'wa275: running it again keeps a value HR changed');
  await db.exec(`update public.app_config set value = '48' where key = 'onboard_propose_lead_hours'`);

  // ---- wave275b (03/11/26, Steel): the three availability checks are settings, off by default. On top of wa275a, with an undo that brings wa275a back exactly.
  const FN275 = `select pg_get_functiondef('public.wa275_offer_sent()'::regprocedure) as trig, obj_description('public.wa275_offer_sent()'::regprocedure, 'pg_proc') as trig_cmt,
      (select proacl::text from pg_proc where oid = 'public.wa275_offer_sent()'::regprocedure) as trig_acl,
      pg_get_functiondef('public.wa275_flow_row(bigint)'::regprocedure) as row_def, obj_description('public.wa275_flow_row(bigint)'::regprocedure, 'pg_proc') as row_cmt,
      (select proacl::text from pg_proc where oid = 'public.wa275_flow_row(bigint)'::regprocedure) as row_acl,
      (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'ask_availability') as col_default,
      col_description('public.hub_onboard_flows'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_onboard_flows'::regclass and attname = 'ask_availability')) as col_cmt`;
  /* live applied wa275a from the release commit (LF); the working copy here may be CRLF, so bodies are compared without carriage returns */
  const lf = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/\r/g, '') : v]));
  const wa275aFns = lf(await one(db, FN275));
  const B_KEYS = ['onboard_ask_hire_availability', 'onboard_manager_hours', 'onboard_require_hours'];
  // live flows before the release: unanswered offered and waiting ones on the new path are switched to already communicated, once; answered and later ones,
  // and (round 2) a wave271 waiting flow, made before onboard_v2_since, which never reads the flag, are left alone
  await db.exec(`
    insert into public.hub_candidates (name, email, status, offer_hours) values ('Test Person B Offered', 'w275b.offered@example.invalid', 'offer', 6), ('Test Person B Waiting', 'w275b.waiting@example.invalid', 'offer', 6),
      ('Test Person B Said No', 'w275b.saidno@example.invalid', 'offer', 6), ('Test Person B Ready', 'w275b.ready@example.invalid', 'offer', 6), ('Test Person B Old', 'w275b.old@example.invalid', 'offer', null);
    update public.hub_candidates set offer_sent_at = now() where email like 'w275b.%@example.invalid' and email <> 'w275b.old@example.invalid';
    update public.hub_candidates set accepted_on = current_date where email in ('w275b.waiting@example.invalid', 'w275b.saidno@example.invalid', 'w275b.ready@example.invalid', 'w275b.old@example.invalid');
    update public.hub_onboard_flows set created_at = now() - interval '30 days' where candidate_id = (select id from public.hub_candidates where email = 'w275b.old@example.invalid');
    insert into public.app_config (key, value) values ('onboard_v2_since', to_char((now() - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    update public.hub_onboard_flows set hire_answer = 'no', hire_answered_at = now() where candidate_id = (select id from public.hub_candidates where email = 'w275b.saidno@example.invalid');
    update public.hub_onboard_flows set status = 'ready' where candidate_id = (select id from public.hub_candidates where email = 'w275b.ready@example.invalid');`);
  const askOf = async (email) => (await one(db, `select f.ask_availability as a from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.email = '${email}'`)).a;
  ok((await askOf('w275b.offered@example.invalid')) === true && (await askOf('w275b.waiting@example.invalid')) === true, "wa275b: before it, flows ask the hire (wa275a's default)");
  await db.exec(optional275);
  await db.exec(optional275);   // safe to run twice
  console.log('wa275b_optional: applied twice with no error');
  for (const k of B_KEYS) ok((await one(db, `select count(*)::int as n from public.app_config where key = '${k}' and value = 'off'`)).n === 1, 'wa275b: ' + k + ' is off, once');
  ok((await askOf('w275b.offered@example.invalid')) === false, 'wa275b: an offered flow with no answer is switched to already communicated');
  ok((await askOf('w275b.waiting@example.invalid')) === false, 'wa275b: a waiting flow with no answer too');
  ok((await askOf('w275b.saidno@example.invalid')) === true, 'wa275b: a flow the hire answered is left alone');
  ok((await askOf('w275b.ready@example.invalid')) === true, 'wa275b: a flow past waiting is left alone');
  ok((await askOf('w275b.old@example.invalid')) === true, 'wa275b round 2: a wave271 waiting flow (made before onboard_v2_since, nothing proposed) is left alone');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'onboard_flow' and field = 'ask_availability' and entity_id = (select f.id::text from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.email = 'w275b.old@example.invalid')`)).n === 0, 'wa275b round 2: and gets no change_log row');
  const logged = (await db.query(`select l.entity_id, l.old_value, l.new_value, l.changed_by from public.change_log l where l.entity_type = 'onboard_flow' and l.field = 'ask_availability'
      and l.entity_id in (select f.id::text from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.email like 'w275b.%')`)).rows;
  ok(logged.length === 2 && logged.every((l) => l.old_value === 'ask the hire' && l.new_value === 'already communicated' && /wa275b/.test(l.changed_by)), 'wa275b: each switched flow is in change_log once, as the card logs its switch (' + JSON.stringify(logged) + ')');
  // the switch is HR's from now on: a second run (the setting already there) switches nothing back, and keeps a value HR set
  await db.exec(`update public.hub_onboard_flows set ask_availability = true where candidate_id = (select id from public.hub_candidates where email = 'w275b.offered@example.invalid');
    update public.app_config set value = 'on' where key = 'onboard_require_hours';`);
  await db.exec(optional275);
  ok((await askOf('w275b.offered@example.invalid')) === true, 'wa275b: running it again leaves a switch HR turned back on');
  ok((await one(db, `select value from public.app_config where key = 'onboard_require_hours'`)).value === 'on', 'wa275b: running it again keeps a value HR set');
  await db.exec(`update public.app_config set value = 'off' where key = 'onboard_require_hours';
    delete from public.app_config where key = 'onboard_v2_since';`);   // the wa275 assertions expect it absent, as before release
  await runAssertions275(db, 'wa275 assertions with wa275b loaded', true);
  await runAssertions(db, 'wa271 assertions with wa275b loaded');
  // the undo: wa275a's trigger function, card row, column default and comment come back exactly; the settings go; the flows keep their switch (data, not schema)
  await db.exec(undo275b);
  await db.exec(undo275b);   // safe to run twice
  console.log('wa275b undo: applied twice with no error');
  const backFns = lf(await one(db, FN275));
  for (const k of Object.keys(wa275aFns)) ok(backFns[k] === wa275aFns[k], 'wa275b undo: wa275a ' + k + ' is back exactly as it was');
  ok((await one(db, `select count(*)::int as n from public.app_config where key in (${B_KEYS.map((k) => "'" + k + "'").join(', ')})`)).n === 0, 'wa275b undo: the three settings are gone');
  ok((await askOf('w275b.waiting@example.invalid')) === false, 'wa275b undo: a flow keeps the switch it has (the undo changes no flow)');
  await runAssertions275(db, 'wa275 assertions after the wa275b undo');
  // round 2: after the undo HR turns a flow back to "ask the hire"; applying wa275b again (the setting key is gone) switches nothing: the switch ran once
  await db.exec(`update public.hub_onboard_flows set ask_availability = true where candidate_id = (select id from public.hub_candidates where email = 'w275b.waiting@example.invalid');
    insert into public.app_config (key, value) values ('onboard_v2_since', to_char((now() - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));`);
  await db.exec(optional275);   // and it goes back on after its undo
  ok((await askOf('w275b.waiting@example.invalid')) === true && (await askOf('w275b.offered@example.invalid')) === true, 'wa275b round 2: applied again after its undo, it switches no flow back (HR\'s switches stay on)');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'onboard_flow' and field = 'ask_availability' and changed_by like 'wa275b%'`)).n === 2, 'wa275b round 2: still only the first run\'s two change_log rows');
  await db.exec(`delete from public.app_config where key = 'onboard_v2_since'`);
  await runAssertions275(db, 'wa275 assertions with wa275b re-applied', true);
  await db.exec(undo275b);
  await db.exec(`delete from public.change_log where entity_type = 'onboard_flow' and field = 'ask_availability';
    delete from public.hub_onboard_flows where candidate_id in (select id from public.hub_candidates where email like 'w275b.%');
    delete from public.hub_candidates where email like 'w275b.%';`);
  console.log('wa275b: every check passed');

  // ---- the undo. Put real-looking work in first: an accepted candidate (kept) and its flow (dropped with the tables).
  await db.exec(`
    insert into public.hub_candidates (name, email, status) values ('Test Person Undo', 'w271.undo@example.invalid', 'offer');
    update public.hub_candidates set accepted_on = date '2026-11-20', offer_respond_by = date '2026-11-18' where name = 'Test Person Undo';`);
  ok((await one(db, `select count(*)::int as n from public.hub_onboard_flows`)).n === 1, 'the accepted candidate has a flow before the undo');
  // wave275 first: an offered flow (one the wave271 check would refuse), then the wa275 undo twice
  await db.exec(`
    insert into public.team_members (name, email) values ('Test Person Mgr Undo', 'w275.mgrundo@example.invalid');
    update public.team_members set availability = '{"weekly":{"mon":[["09:00","10:00"]]}}'::jsonb, availability_at = now() where email = 'w275.mgrundo@example.invalid';
    insert into public.hub_candidates (name, email, status, offer_hours, onboard_manager_id) values ('Test Person Offered Undo', 'w275.offeredundo@example.invalid', 'offer', 6, (select id from public.team_members where email = 'w275.mgrundo@example.invalid'));
    update public.hub_candidates set offer_sent_at = now() where name = 'Test Person Offered Undo';`);
  ok((await one(db, `select count(*)::int as n from public.hub_onboard_flows where status = 'offered'`)).n === 1, 'an offered flow exists before the wa275 undo');
  // wave276's tables are live and wa275a only reads them (wa275_week_of): the undo must leave them and their rows alone
  await db.exec(`
    insert into public.hub_team_avail (email, department, slots, hours) values ('w275.mgrundo@example.invalid', 'w275undo', '{18,19}', 1);
    insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('w275undo', current_date, 'w275 undo test');`);
  await db.exec(undo275);
  await db.exec(undo275);   // safe to run twice
  console.log('wa275 undo: applied twice with no error');
  ok((await one(db, `select count(*)::int as n from public.hub_onboard_flows`)).n === 1, 'wa275 undo: the offered flow is gone, the accepted flow stays');
  ok((await one(db, `select status from public.hub_onboard_flows`)).status === 'waiting', 'wa275 undo: the kept flow is still waiting');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa275%'`)).n === 0, 'wa275 undo: no wa275 function left');
  ok((await one(db, `select (to_regclass('public.hub_team_avail') is not null and to_regclass('public.hub_team_avail_ask') is not null) as k`)).k === true, 'wa275 undo: the wave276 tables (hub_team_avail, hub_team_avail_ask) are still there');
  ok((await one(db, `select (select count(*) from public.hub_team_avail where department = 'w275undo')::int + (select count(*) from public.hub_team_avail_ask where department = 'w275undo')::int as n`)).n === 2, 'wa275 undo: their rows stay');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'wa275_offer_sent'`)).n === 0, 'wa275 undo: the offer-sent trigger is gone');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'wa271_cand_accepted'`)).n === 1, 'wa275 undo: the wave271 accept trigger is still there');
  ok((await one(db, `select count(*)::int as n from information_schema.columns where table_schema = 'public' and ((table_name = 'hub_candidates' and column_name in ('offer_hours', 'onboard_manager_id', 'hours_confirmed_at'))
      or (table_name = 'team_members' and column_name in ('availability', 'availability_at'))
      or (table_name = 'hub_onboard_flows' and column_name in ('proposed_call_at', 'proposed_one_on_one_at', 'proposed_by', 'proposed_at', 'hire_answer', 'hire_answered_at', 'setup_ticks', 'welcome_sent_at', 'accounts_at', 'ask_availability')))`)).n === 0, 'wa275 undo: every wa275 column is gone');
  ok((await one(db, `select count(*)::int as n from pg_constraint where conrelid = 'public.team_members'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%wa275%'`)).n === 0, 'wa275 undo: the availability check is gone');
  ok((await one(db, `select count(*)::int as n from pg_indexes where indexname = 'hub_candidates_onboard_manager_idx'`)).n === 0, 'wa275 undo: the manager index is gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key in ('onboard_propose', 'onboard_answer', 'onboard_ready')`)).n === 0, 'wa275 undo: the three new kinds are gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key in ('onboard_date', 'onboard_grid', 'onboard_remind', 'timeoff_request')`)).n === 4, 'wa275 undo: the wave271 kinds stay');
  ok((await one(db, `select count(*)::int as n from public.app_config where key in ('onboard_auto_hub', 'onboard_propose_lead_hours', 'onboard_yes_lead_hours', 'onboard_v2_since')`)).n === 0, 'wa275 undo: the wave275 settings are gone');
  ok((await one(db, `select count(*)::int as n from public.app_config where key in ('onboard_call_min', 'onboard_grid_min_hours')`)).n === 2, 'wa275 undo: the wave271 settings stay');
  const wa271After = await one(db, FN271);
  for (const k of Object.keys(wa271Before)) ok(wa271After[k] === wa271Before[k], 'wa275 undo: wave271 ' + k + ' is back exactly as it was');
  let refused = false;
  try { await db.exec(`update public.hub_onboard_flows set status = 'offered'`); } catch (e) { refused = /status_check/.test(String(e.message)); }
  ok(refused, 'wa275 undo: the wave271 status check refuses offered again');
  await db.exec(`delete from public.hub_candidates where name = 'Test Person Offered Undo'; delete from public.team_members where name = 'Test Person Mgr Undo';
    delete from public.hub_team_avail where department = 'w275undo'; delete from public.hub_team_avail_ask where department = 'w275undo';`);
  console.log('wa275 undo: every check passed');
  await runAssertions(db, 'wa271 assertions after the wa275 undo');
  await db.exec(undo);
  await db.exec(undo);   // safe to run twice
  console.log('undo: applied twice with no error');
  ok(!/starts_on/.test((await one(db, `select pg_get_functiondef('public.wa166_person_card(bigint,text)'::regprocedure) as d`)).d), 'the undo takes starts_on off the lead card');

  ok((await one(db, `select to_regclass('public.hub_onboard_flows') as r`)).r === null, 'flows table dropped');
  ok((await one(db, `select to_regclass('public.hub_onboard_flows_manager_link_idx') as r`)).r === null, 'the manager link index is gone');
  ok((await one(db, `select to_regclass('public.hub_onboard_grids') as r`)).r === null, 'grids table dropped');
  ok((await one(db, `select to_regclass('public.hub_onboard_steps') as r`)).r === null, 'steps table dropped');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa271%'`)).n === 0, 'no wa271 function left (wa271_remind included)');
  ok((await one(db, `select count(*)::int as n from cron.job where jobname = 'wa-onboard-remind'`)).n === 0, 'the hourly cron job is gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key = any(array['onboard_date', 'onboard_grid', 'onboard_remind'])`)).n === 0, 'the three notification kinds are gone');
  ok((await one(db, `select count(*)::int as n from public.hub_notification_kinds where key = 'timeoff_request'`)).n === 1, 'the other notification kinds are untouched by the undo');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname = 'wa271_cand_accepted'`)).n === 0, 'accept trigger dropped');
  ok((await one(db, `select count(*)::int as n from information_schema.columns where table_name = 'hub_candidates' and column_name in ('offer_respond_by', 'offer_start')`)).n === 0, 'offer columns dropped');
  ok((await one(db, `select count(*)::int as n from public.app_config where key like 'onboard\\_%'`)).n === 0, 'onboard_ settings removed (the minimum hours setting included)');
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
  await db.exec(streamlined);
  await runAssertions275(db, 're-applied wave275 assertions');
  await runAssertions(db, 're-applied wave271 assertions with wave275 loaded');

  console.log(`w271sql.mjs: OK (${checks} runner checks, plus both assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
