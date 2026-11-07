// wave292: the summary pass, offline. Run: node --test test/w292summary.test.mjs (Node 22.6 or later; PGlite: npm install --no-save @electric-sql/pglite)
// fn/mail-history/summary.ts and fn/_shared/mail_rules.ts are copied side by side into a temporary folder, as the deploy lays them out, and the
// pass runs against a fake router and PGlite with slice 1, wave289, test/w292schema.sql's invented run and build/data/wa292_batches.sql loaded,
// the five batches applied. No model, network or live database is touched. Every person and line is invented.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'w292sum-'));
copyFileSync(join(here, '../fn/mail-history/summary.ts'), join(dir, 'summary.ts'));
copyFileSync(join(here, '../fn/_shared/mail_rules.ts'), join(dir, 'mail_rules.ts'));
const S = await import(pathToFileURL(join(dir, 'summary.ts')).href);

let db;
const q = async (sql, args) => (await db.query(sql, args)).rows;
before(async () => {
  db = new PGlite();
  for (const f of ['w281schema.sql', '../build/data/wa281_rules.sql', 'w282schema.sql', '../build/data/wa282_mail_rule.sql', 'w284schema.sql', '../build/data/wa284_import.sql',
                   'w289schema.sql', '../build/data/wa289_scan.sql', 'w292schema.sql', '../build/data/wa292_batches.sql']) await db.exec(read(f));
  for (const k of ['mail_optouts', 'mail_orgs', 'mail_people', 'mail_enrich', 'mail_interactions']) {
    const b = (await q(`select public.wa284_new_batch(9201, $1) as b`, [k]))[0].b;
    const c = (await q(`select public.wa284_compare($1, 'test') as r`, [b]))[0].r;
    assert.ok(!c.error, k + ' compared: ' + JSON.stringify(c.error));
    await q(`select public.wa284_apply($1, 'test')`, [b]);
  }
});
after(async () => { if (db) await db.close(); rmSync(dir, { recursive: true, force: true }); });

function makeDeps(answers) {
  const calls = [];
  let clock = 0;
  return { calls, deps: {
    rpc: async (fn, args) => {
      const keys = Object.keys(args);
      const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; });
      const rows = await q('select public.' + fn + '(' + keys.map((k, i) => k + ' => $' + (i + 1)).join(', ') + ') as r', vals);
      return fn === 'wa292_summary_todo' ? rows.map((r) => Number(r.r)) : rows[0].r;
    },
    router: async (task, body) => {
      calls.push({ task, body: JSON.stringify(body) });
      const a = answers.length > 1 ? answers.shift() : answers[0];
      return { out: { model: 'test/haiku', content: a === null ? [{ type: 'text', text: 'no tool' }] : [{ type: 'tool_use', name: 'relationship', input: a }] }, cost: 0.002 };
    },
    now: () => (clock += 1000),
  } };
}
const contact = async (email) => (await q(`select id from public.crm_contacts where $1 = any(emails) and merged_into is null order by id limit 1`, [email]))[0].id;

test('the summary pass writes every contact once, within the cap, and finishes', async () => {
  await q(`select public.wa292_summary_start(9201, 'test')`);
  const { calls, deps } = makeDeps([{ topics: ['partnership', 'gossip'], open_item: 'A call to arrange, see https://example.org/x', summary: 'A partner organisation that offered a food drive. They can be reached at writer@example.org.' }]);
  const r = await S.summaryStep(deps, 9201, 60000);
  assert.equal(r.finished, true);
  const v = await contact('new.writer@neworg.example.org');
  const row = (await q(`select * from public.crm_email_relationship where contact_id = $1`, [v]))[0];
  assert.equal(row.summary, 'A partner organisation that offered a food drive. They can be reached at', 'cut before the address');
  assert.equal(row.open_item, 'A call to arrange, see');
  assert.deepEqual(row.topics, ['partnership'], 'unknown topics dropped');
  assert.equal(row.model, 'test/haiku'); assert.equal(row.from_steel, true); assert.equal(row.rel_type, 'partner', 'the type stays');
  // one email: a line without a model
  const g = await contact('info@generalorg.example.org');
  const one = (await q(`select summary, model from public.crm_email_relationship where contact_id = $1`, [g]))[0];
  assert.match(one.summary, /^One email, 10 Jan 2022: Introduces the organisation\.$/);
  assert.equal(one.model, 'none');
  assert.equal(calls.length, 1, 'only the person with two emails went to the router');
  assert.equal(calls[0].task, 'mail_history_insight');
  assert.ok(calls[0].body.includes('Asks whether Welfare Avenue would partner'), 'the router sees the lines');
  assert.ok(!/body|snippet/i.test(JSON.stringify(JSON.parse(calls[0].body).messages)), 'never a body');
  const scans = await q(`select phase, spend_usd from public.crm_mail_scans where run_id = 9201 order by mailbox`);
  assert.ok(scans.every((s) => s.phase === 'summarised'), 'the pass finishes');
  assert.ok(Number(scans[0].spend_usd) + Number(scans[1].spend_usd) >= 2.002, 'its cost is added to the run');
  // a second pass pays nothing
  await q(`select public.wa292_summary_start(9201, 'test')`);
  const again = makeDeps([null]);
  const r2 = await S.summaryStep(again.deps, 9201, 60000);
  assert.equal(r2.summarised, 0); assert.equal(again.calls.length, 0, 'nothing is summarised twice');
});

test('a refused answer twice falls back to counts and dates; a stale row is rewritten; the cap pauses the pass', async () => {
  const v = await contact('new.writer@neworg.example.org');
  await q(`update public.crm_email_relationship set stale = true where contact_id = $1`, [v]);
  await q(`select public.wa292_summary_start(9201, 'test')`);
  const { calls, deps } = makeDeps([null, { topics: [], summary: '' }]);
  await S.summaryStep(deps, 9201, 60000);
  assert.equal(calls.length, 2);
  const row = (await q(`select summary, model, stale from public.crm_email_relationship where contact_id = $1`, [v]))[0];
  assert.match(row.summary, /^2 emails, \d+ \w{3} \d{4} to \d+ \w{3} \d{4}\.$/); assert.equal(row.model, 'none'); assert.equal(row.stale, false);
  // the cap
  await q(`update public.crm_email_relationship set stale = true`);
  await q(`update public.crm_mail_scans set cap_usd = 2.0 where run_id = 9201`);
  await q(`select public.wa292_summary_start(9201, 'test')`);
  const capped = makeDeps([{ topics: ['event'], summary: 'Asked about an event.' }]);
  const r = await S.summaryStep(capped.deps, 9201, 60000);
  assert.equal(r.paused, true, 'the pass pauses at the cap');
  assert.deepEqual((await q(`select bool_and(paused) as p from public.crm_mail_scans where run_id = 9201`))[0].p, true);
});

test('Refresh one contact: the same three steps, no run', async () => {
  const v = await contact('existing.writer@org.example.org');
  const { deps } = makeDeps([{ topics: ['event'], summary: 'Asked about an event.' }]);
  const r = await S.summariseContact(deps, v, 'w281.member@example.invalid');
  assert.equal(r.saved, true); assert.equal(r.model, 'none', 'one email needs no model');
  const row = (await q(`select generated_by, summary from public.crm_email_relationship where contact_id = $1`, [v]))[0];
  assert.equal(row.generated_by, 'w281.member@example.invalid');
  assert.match(row.summary, /^One email, 1 May 2021: Asks about the date of the next event\.$/);
  assert.equal(S.dayText('2021-03-12'), '12 Mar 2021');
  assert.deepEqual(S.validateSummary({ topics: ['donation'], summary: 'Gave twice — thanks.' }).value.summary, 'Gave twice, thanks.');
});
