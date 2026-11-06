// wave281: offline proof of build/data/wa281_rules.sql and build/data/wa281_undo.sql on PGlite. Run: node test/w281sql.mjs
// Loads test/w281schema.sql (a slice of the live schema, with the live text of every object wave281 changes), checks that text against the md5 of the
// live definitions (read 06/11/26), then runs the migration twice (the second run must change nothing: same backfill counts, functions patched once),
// test/w281sql.sql twice (it rolls back), the undo twice (every changed function, crm_contacts_v, crm_contact_match and hub_roles_self_member are back
// exactly: definition, comment and grants; everything new is gone), and the migration and assertions once more after the undo.
// Standalone. Touches no live database. Exits non-zero on any failure.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const schema = read('w281schema.sql');
const migration = read('../build/data/wa281_rules.sql');
const undo = read('../build/data/wa281_undo.sql');
const assertions = read('w281sql.sql');

let checks = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); process.exit(1); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const one = async (db, sql) => (await db.query(sql)).rows[0];

async function runAssertions(db, label) {
  const res = await db.exec(assertions);
  const last = res.filter((r) => r.rows && r.rows.length).pop();
  const line = last && last.rows[0] && last.rows[0].result;
  ok(line === 'w281sql: all assertions passed', label + ': the assertion script finished (' + line + ')');
  console.log(label + ': ' + line);
}

// the live objects wave281 changes, with the md5 of pg_get_functiondef as live had it on 06/11/26
const LIVE = {
  'public.crm_email_permission(bigint,text)': 'd402bc0355e20acf98bb2c30689a0e93',
  'public.wa171_opted_out(bigint,text)': '48dadf0669b7f5d0b7ea4652c612c4da',
  'public.wa171_inbound(jsonb)': 'f3d2fac8be0c27f8899d09fc3ba71d79',
  'public.wa254_inbound(jsonb)': '834908bdf0e924b57c6419e3b4b1ead2',
  'public.crm_refresh_implied_consent()': '8421921d4a15b0edcf48b223ae4e4230',
  'public.crm_merge_contacts(bigint,bigint)': '0e5b1c719c9ec95bd3bd10f2a9be43f2',
  'public.wa_app_config_guard()': '682ee042e8bdb3c2e4bc6da3bb8a5efb',
};
const MATCH = 'public.crm_contact_match(public.crm_contacts_v,jsonb)';
const MATCH_MD5 = 'd21db1e35fb6e0a8f65d766db3a1d618';
const VIEW_MD5 = '326f39ce0495c38c50c81273ee58fd9f';
const PATCHED = Object.keys(LIVE);
const ADDED_FNS = ['public.crm_add_chapter(bigint,text,text,text)', 'public.crm_in_chapter(bigint,text)', 'public.crm_consent_log()', 'public.crm_consent_guard()',
  'public.crm_set_do_not_contact(bigint,text)', 'public.crm_age_band(bigint)', 'public.wa_can(text)', 'public.wa_my_caps()', 'public.crm_gift_campaign_id(text)', 'public.wa281_gift_campaign()',
  'public.crm_dnc_hold()'];
const ADDED_TABLES = ['crm_chapters', 'crm_contact_chapters', 'crm_consent_events', 'crm_contact_private', 'wa_campaigns', 'wa_campaign_people'];
const ADDED_COLUMNS = [['crm_contacts', 'sms_consent'], ['crm_contacts', 'sms_consent_source'], ['crm_contacts', 'sms_consent_at'], ['crm_contacts', 'do_not_contact'],
  ['crm_contacts', 'dnc_reason'], ['crm_contacts', 'dnc_at'], ['crm_contacts', 'dnc_by'], ['crm_contacts', 'job_title'], ['hub_roles', 'caps'], ['crm_donations', 'campaign_id'],
  ['wa_partners', 'keela_company_id'], ['wa_partners', 'goals']];

async function snapshot(db) {
  const out = {};
  for (const f of [...PATCHED, MATCH]) {
    out[f] = await one(db, `select pg_get_functiondef('${f}'::regprocedure) as def, obj_description('${f}'::regprocedure, 'pg_proc') as cmt,
      (select proacl::text from pg_proc where oid = '${f}'::regprocedure) as acl, (select oid::text from pg_proc where oid = '${f}'::regprocedure) as oid`);
  }
  out.view = await one(db, `select pg_get_viewdef('public.crm_contacts_v'::regclass, true) as def, obj_description('public.crm_contacts_v'::regclass, 'pg_class') as cmt,
    c.relacl::text as acl, c.reloptions::text as opts from pg_class c where c.oid = 'public.crm_contacts_v'::regclass`);
  out.policy = await one(db, `select pg_get_expr(polwithcheck, polrelid) as chk, pg_get_expr(polqual, polrelid) as q, polcmd::text as cmd, polroles::regrole[]::text as roles
    from pg_policy where polname = 'hub_roles_self_member'`);
  out.counts = await one(db, `select (select count(*)::int from pg_class where relname = 'crm_consent_events') as t`);
  return out;
}
const COUNTS = `select (select count(*)::int from public.crm_contact_chapters) as chapters, (select count(*)::int from public.crm_consent_events) as consent,
  (select count(*)::int from public.wa_campaigns) as campaigns, (select count(*)::int from public.crm_donations where campaign_id is not null) as gifts,
  (select count(*)::int from public.crm_fields) as fields, (select count(*)::int from public.crm_forms where settings ? 'campaign_id') as forms,
  (select count(*)::int from public.change_log where entity_type = 'release' and entity_id = 'wave281') as release_rows`;

try {
  const db = new PGlite();
  await db.exec(schema);

  // ---- the fixture holds the live text: md5 of every changed object equals live's
  for (const f of PATCHED) ok((await one(db, `select md5(pg_get_functiondef('${f}'::regprocedure)) as m`)).m === LIVE[f], f + ': the fixture text is the live text (md5)');
  ok((await one(db, `select md5(pg_get_functiondef('${MATCH}'::regprocedure)) as m`)).m === MATCH_MD5, 'crm_contact_match: the fixture text is the live text (md5)');
  ok((await one(db, `select md5(pg_get_viewdef('public.crm_contacts_v'::regclass, true)) as m`)).m === VIEW_MD5, 'crm_contacts_v: the fixture text is the live text (md5)');
  ok((await one(db, `select reloptions::text as o from pg_class where oid = 'public.crm_contacts_v'::regclass`)).o === '{security_invoker=true}', 'crm_contacts_v: options as live stores them');
  console.log('fixture: the seven functions, crm_contact_match and crm_contacts_v match the live md5s');

  // ---- before: the live state, and the failing state (no wave281 objects yet)
  const before = await snapshot(db);
  let missing = false;
  try { await db.exec(assertions); } catch (e) { missing = /crm_chapters|crm_contact_chapters|does not exist/.test(String(e.message)); }
  await db.exec('rollback').catch(() => {});
  ok(missing, 'before the migration the assertions fail on the missing objects');
  console.log('before the migration: the assertions fail on the missing tables, as they should');

  // ---- the migration, twice
  await db.exec(migration);
  const first = await one(db, COUNTS);
  const afterOnce = await snapshot(db);
  await db.exec(migration);
  const second = await one(db, COUNTS);
  console.log('wa281: applied twice with no error', JSON.stringify(second));
  ok(JSON.stringify(first) === JSON.stringify(second), 'a second run adds nothing (chapters, consent rows, campaigns, gift links, fields, forms, release line): ' + JSON.stringify(first) + ' vs ' + JSON.stringify(second));
  ok(first.chapters === 44 + 6 && first.consent === 5 && first.campaigns === 7 && first.gifts === 5 && first.fields === 6 && first.forms === 2 && first.release_rows === 1,
    'the backfills: 44 toronto + 6 montreal chapter rows, 3 form answers + 2 change_log rows, 7 campaigns, 5 gifts, 4 new fields, 2 forms, 1 release line (' + JSON.stringify(first) + ')');
  const afterMig = await snapshot(db);
  for (const f of PATCHED) {
    ok(afterMig[f].def !== before[f].def, f + ' was patched');
    ok(afterMig[f].def === afterOnce[f].def, f + ' is patched once only (the second run skipped it)');
    ok(afterMig[f].acl === before[f].acl, f + ' keeps its grants (' + afterMig[f].acl + ')');
    ok(/wave281/.test(afterMig[f].cmt || ''), f + ' has a comment that says what wave281 added');
  }
  const def = (f) => afterMig[f].def;
  ok(def('public.crm_email_permission(bigint,text)').includes(`x.merged_into, x.volunteer_id, x.do_not_contact`)
     && def('public.crm_email_permission(bigint,text)').includes(`end if;\n  if c.do_not_contact then return query select false, 'do not contact'::text, null::date, c.em::text, c.st::text; return; end if;\n  if p_kind = 'transactional'`),
    'crm_email_permission: do-not-contact right after bounced and complained, before transactional');
  ok(def('public.wa171_opted_out(bigint,text)').includes(`= public.wa171_digits(p_phone)))) or exists (select 1 from public.wa_stopped_phones_v s where s.channel = 'sms' and s.phone_digits = public.wa171_digits(p_phone));`),
    'wa171_opted_out: the stopped-phones check, as the brief gives it');
  ok(def('public.wa171_inbound(jsonb)').includes(`perform set_config('wa.consent_source', 'STOP text', true);\n    update public.crm_contacts c set sms_opt_out = true`)
     && def('public.wa171_inbound(jsonb)').includes(`perform set_config('wa.consent_source', 'START text', true);\n    update public.crm_contacts c set sms_opt_out = false`), 'wa171_inbound: STOP text and START text');
  ok(def('public.wa254_inbound(jsonb)').includes(`perform set_config('wa.consent_source', 'WhatsApp STOP', true);\n    update public.crm_contacts c set whatsapp_opt_out = true`), 'wa254_inbound: WhatsApp STOP');
  ok(def('public.crm_refresh_implied_consent()').includes(`perform set_config('wa.consent_source', 'daily implied-consent refresh', true);\n  with act as (`), 'crm_refresh_implied_consent: before the statement');
  ok(def('public.crm_merge_contacts(bigint,bigint)').includes(`update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;\n  -- wave281:`), 'crm_merge_contacts: right after the crm_email_sends line');
  ok(def('public.wa_app_config_guard()').includes(`k like 'keela\\_%' or k like 'mail\\_%'`), 'wa_app_config_guard: keela_ in the admin-only prefixes');
  ok(afterMig.view.def.includes('c.job_title') && afterMig.view.acl === before.view.acl && afterMig.view.opts === before.view.opts, 'crm_contacts_v: three columns added, grants and security_invoker kept');
  ok(afterMig[MATCH].oid === before[MATCH].oid && afterMig[MATCH].def === before[MATCH].def, 'crm_contact_match is untouched by the migration');
  ok(/caps = '\{\}'::jsonb/.test(afterMig.policy.chk) && afterMig.policy.cmd === before.policy.cmd && afterMig.policy.roles === before.policy.roles, 'hub_roles_self_member: caps must be empty, same command and roles');
  for (const f of ADDED_FNS) ok((await one(db, `select obj_description('${f}'::regprocedure, 'pg_proc') is not null as x`)).x === true, f + ' exists and has a comment');
  for (const t of ADDED_TABLES) ok((await one(db, `select obj_description('public.${t}'::regclass, 'pg_class') is not null as x`)).x === true, t + ' has a comment');
  ok((await one(db, `select obj_description('public.wa_stopped_phones_v'::regclass, 'pg_class') is not null as x`)).x === true, 'wa_stopped_phones_v has a comment');
  for (const [t, c] of ADDED_COLUMNS) ok((await one(db, `select col_description('public.${t}'::regclass, (select attnum from pg_attribute where attrelid = 'public.${t}'::regclass and attname = '${c}')) is not null as x`)).x === true, t + '.' + c + ' has a comment');
  for (const t of [...ADDED_TABLES, 'wa_stopped_phones_v']) {
    const r = await one(db, `select count(*)::int as n, string_agg(a.attname, ', ' order by a.attnum) filter (where col_description(a.attrelid, a.attnum) is null) as missing
      from pg_attribute a where a.attrelid = 'public.${t}'::regclass and a.attnum > 0 and not a.attisdropped`);
    ok(r.n > 0 && r.missing === null, 'every column of ' + t + ' has a comment (' + r.n + ' columns; missing: ' + r.missing + ')');
  }
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname in ('trg_wa281_consent_log', 'trg_wa281_consent_guard', 'trg_wa281_gift_campaign', 'trg_wa281_dnc_hold') and not tgisinternal`)).n === 4, 'four triggers after two runs');

  await runAssertions(db, 'assertions');
  await runAssertions(db, 'assertions (second run)');

  // ---- the undo, twice
  await db.exec(undo);
  await db.exec(undo);
  console.log('wa281 undo: applied twice with no error');
  const afterUndo = await snapshot(db);
  for (const f of [...PATCHED, MATCH]) {
    ok(afterUndo[f].def === before[f].def, f + ' is back exactly as live has it (pg_get_functiondef)');
    ok(afterUndo[f].cmt === before[f].cmt, f + ' comment is back as it was');
    ok(afterUndo[f].acl === before[f].acl, f + ' grants are back as they were (' + afterUndo[f].acl + ')');
  }
  ok((await one(db, `select md5(pg_get_functiondef('${MATCH}'::regprocedure)) as m`)).m === MATCH_MD5, 'crm_contact_match is back (md5 as live)');
  ok(afterUndo.view.def === before.view.def && (await one(db, `select md5(pg_get_viewdef('public.crm_contacts_v'::regclass, true)) as m`)).m === VIEW_MD5, 'crm_contacts_v is back exactly (md5 as live)');
  ok(afterUndo.view.cmt === before.view.cmt && afterUndo.view.opts === before.view.opts, 'crm_contacts_v comment and security_invoker are back');
  const privs = async (r) => (await one(db, `select string_agg(p, ',' order by p) as x from unnest(array['select','insert','update','delete','truncate','references','trigger']) p where has_table_privilege('${r}', 'public.crm_contacts_v', p)`)).x;
  ok((await privs('authenticated')) === 'references,select,trigger,truncate' && (await privs('anon')) === null, 'crm_contacts_v grants are back (authenticated rDxtm, anon none)');
  ok(afterUndo.policy.chk === before.policy.chk && afterUndo.policy.cmd === before.policy.cmd && afterUndo.policy.roles === before.policy.roles, 'hub_roles_self_member is back exactly');
  for (const f of ADDED_FNS) ok((await one(db, `select to_regprocedure('${f}') is null as x`)).x === true, f + ' is gone');
  for (const t of [...ADDED_TABLES, 'wa_stopped_phones_v']) ok((await one(db, `select to_regclass('public.${t}') is null as x`)).x === true, t + ' is gone');
  for (const [t, c] of ADDED_COLUMNS) ok((await one(db, `select count(*)::int as n from information_schema.columns where table_name = '${t}' and column_name = '${c}'`)).n === 0, t + '.' + c + ' is dropped');
  ok((await one(db, `select count(*)::int as n from pg_trigger where tgname like 'trg_wa281%'`)).n === 0, 'no wave281 trigger left');
  ok((await one(db, `select count(*)::int as n from pg_class where relname in ('quo_messages_wa281_keyword_idx', 'whatsapp_messages_wa281_keyword_idx')`)).n === 0, 'the two keyword indexes are gone');
  ok((await one(db, `select count(*)::int as n from pg_proc where proname like 'wa281%'`)).n === 0, 'no wa281 function left');
  ok((await one(db, `select count(*)::int as n from public.crm_fields where key in ('linkedin', 'car_make_model', 'car_seats', 'food_licence')`)).n === 0, 'the four fields are gone');
  ok((await one(db, `select count(*)::int as n from public.crm_forms where settings ? 'campaign_id'`)).n === 0, 'the drive forms lost campaign_id');
  ok((await one(db, `select count(*)::int as n from pg_policy where polname = 'wa_partners_staff_insert'`)).n === 0, 'wa_partners_staff_insert is gone');
  ok((await one(db, `select count(*)::int as n from public.change_log where entity_type = 'release' and entity_id = 'wave281' and field = 'wave281 undo'`)).n === 1, 'one undo line after two runs');
  ok((await one(db, `select count(*)::int as n from public.crm_contacts`)).n === (await one(db, `select count(*)::int as n from public.crm_contacts where id between 1001 and 1301`)).n, 'no contact was deleted by the undo');
  console.log('wa281 undo: every check passed');

  // ---- and the migration goes back on after an undo
  await db.exec(migration);
  await runAssertions(db, 're-applied assertions');
  const again = await one(db, COUNTS);
  ok(again.chapters === first.chapters && again.consent === first.consent && again.gifts === first.gifts && again.forms === first.forms, 'the backfills give the same rows again after an undo');

  await db.close();

  // ---- a live function that moved stops the whole migration (run in one transaction, as the connector runs it), and nothing is kept
  for (const [f, from, to] of [['crm_merge_contacts(bigint,bigint)', 'update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;', 'update public.crm_email_sends set contact_id = p_keep where p_drop = contact_id;'],
                               ['wa_app_config_guard()', `k like 'mail\\_%'`, `k like 'email\\_%'`]]) {
    const db3 = new PGlite();
    await db3.exec(schema);
    await db3.exec(`do $m$ declare v text := pg_get_functiondef('public.${f}'::regprocedure); begin execute replace(v, $q$${from}$q$, $q$${to}$q$); end $m$;`);
    let msg = '';
    try { await db3.exec('begin;\n' + migration + '\ncommit;'); } catch (e) { msg = String(e.message); }
    await db3.exec('rollback').catch(() => {});
    ok(msg.includes('wave281: a live function moved: ' + f.split('(')[0]), 'a moved ' + f + ' stops the migration (' + msg + ')');
    ok((await one(db3, `select to_regclass('public.crm_chapters') is null and to_regprocedure('public.wa_can(text)') is null as x`)).x === true, 'and nothing of wave281 is kept');
    await db3.close();
  }
  console.log('a moved anchor stops the migration and nothing is kept');

  // ---- the live check files (run on live only inside build/sql_rollback_test.py's block), proved here first on the fixture, each in one transaction
  {
    const before = read('w281live_before.sql'), live = read('w281live.sql'), liveUndo = read('w281live_undo.sql'), timing = read('w281live_timing.sql');
    for (const [label, files] of [['before, migration twice, live checks', [before, migration, migration, live]],
                                  ['before, migration, undo twice, undo checks, migration, live checks', [before, migration, undo, undo, liveUndo, migration, live]]]) {
      const db4 = new PGlite();
      await db4.exec(schema);
      await db4.exec('begin;\n' + files.join('\n') + '\nrollback;');
      ok(true, label);
      console.log('live check files, offline: ' + label + ': passed');
      await db4.close();
    }
    const db5 = new PGlite();
    await db5.exec(schema);
    let msg = '';
    try { await db5.exec('begin;\n' + migration + '\n' + timing + '\nrollback;'); } catch (e) { msg = String(e.message); }
    ok(/^W281_TIMING over \d+ contacts: /.test(msg), 'the timing file reports its timings (' + msg + ')');
    console.log('live check files, offline: timing: ' + msg);
    await db5.close();
  }

  console.log(`w281sql.mjs: OK (${checks} runner checks, plus the assertion runs)`);
  process.exit(0);
} catch (e) {
  console.error('FAIL: ' + (e && e.message ? e.message : e));
  if (e && e.where) console.error('where: ' + e.where);
  if (e && e.position) console.error('position ' + e.position);
  process.exit(1);
}
