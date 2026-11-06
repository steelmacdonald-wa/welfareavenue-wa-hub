// wave284: crm-import's staging step, offline. Run: node --test test/w284import.test.mjs
// The step (fn/crm-import/stage.mjs) parses with the same CSV parser the edge function imports (jsr:@std/csv 1.0.6, from npm as @jsr/std__csv:
// npm install --no-save --@jsr:registry=https://npm.jsr.io @jsr/std__csv@1.0.6) and saves each chunk through the real wa284_stage_rows, on PGlite
// with test/w281schema.sql, build/data/wa281_rules.sql, test/w284schema.sql and build/data/wa284_import.sql loaded. Every row is invented.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { parse as csvParse } from '@jsr/std__csv';
import { stageStep, parseFile, CHUNK } from '../fn/crm-import/stage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
let db, run;

before(async () => {
  db = new PGlite();
  for (const f of ['w281schema.sql', '../build/data/wa281_rules.sql', 'w284schema.sql', '../build/data/wa284_import.sql']) await db.exec(read(f));
  run = (await db.query(`select public.wa284_new_run('Test staging', 'test') as id`)).rows[0].id;
});
after(async () => { if (db) await db.close(); });

async function newFile(kind, name) {
  return (await db.query(`select public.wa284_register($1, $2, $3) as id`, [run, run + '/' + name, kind])).rows[0].id;
}
// stage a whole file the way the page does: offset 0, then each next_offset, until it is null
async function stageAll(fileId, text, kind) {
  let offset = 0, calls = 0, out;
  do {
    out = await stageStep({ text, kind, offset, csvParse,
      save: (from, rows, total) => db.query(`select public.wa284_stage_rows($1, $2, $3::jsonb, $4)`, [fileId, from, JSON.stringify(rows), total]) });
    calls++; offset = out.next_offset;
  } while (offset !== null && calls < 20);
  return { calls, out };
}
const staged = async (fileId) => (await db.query(`select row_no, data from import_stage.rows where file_id = $1 order by row_no`, [fileId])).rows;

test('a 12,001-row CSV stages in 3 calls of at most 5,000 rows', async () => {
  assert.equal(CHUNK, 5000);
  const lines = ['Contact Id,Type,Amount'];
  for (let i = 1; i <= 12001; i++) lines.push(`KTX${i},Interaction,${i % 97}`);
  const fid = await newFile('keela_interactions_csv', 'big.csv');
  const { calls, out } = await stageAll(fid, lines.join('\r\n') + '\r\n', 'keela_interactions_csv');
  assert.equal(calls, 3);
  assert.deepEqual(out, { next_offset: null, rows: 12001, staged_through: 12001 });
  const n = (await db.query(`select count(*)::int as n, min(row_no) as lo, max(row_no) as hi from import_stage.rows where file_id = $1`, [fid])).rows[0];
  assert.deepEqual(n, { n: 12001, lo: 1, hi: 12001 });
  const f = (await db.query(`select public.wa284_files(null, $1) as f`, [fid])).rows[0].f[0];
  assert.equal(f.rows, 12001); assert.equal(f.staged_through, 12001);
  const last = (await db.query(`select data from import_stage.rows where file_id = $1 and row_no = 12001`, [fid])).rows[0].data;
  assert.deepEqual(last, { 'Contact Id': 'KTX12001', Type: 'Interaction', Amount: String(12001 % 97) });
});

test('accents and multi-line notes survive', async () => {
  const csv = '﻿Contact Id,City,Notes\r\nKTA1,Montréal,"Line one\r\nLigne deux é, avec une virgule"\r\nKTA2,Québec,"She said ""yes"""\r\n';
  const fid = await newFile('keela_transactions_csv', 'accents.csv');
  await stageAll(fid, csv, 'keela_transactions_csv');
  const rows = await staged(fid);
  assert.equal(rows.length, 2);
  // std/csv keeps the line break inside a quoted field (a CRLF break comes back as \n)
  assert.deepEqual(rows[0].data, { 'Contact Id': 'KTA1', City: 'Montréal', Notes: 'Line one\nLigne deux é, avec une virgule' });
  assert.equal(rows[1].data.Notes, 'She said "yes"');
  // JSON keeps them too, as a list or wrapped in an object with one list
  const json = JSON.stringify({ contacts: [{ 'Contact Id': 'KTJ1', City: 'Montréal', Notes: 'Ligne un\nLigne deux é' }] });
  const jid = await newFile('keela_contacts_json', 'accents.json');
  await stageAll(jid, json, 'keela_contacts_json');
  assert.equal((await staged(jid))[0].data.Notes, 'Ligne un\nLigne deux é');
});

test('restaging from 0 replaces the rows', async () => {
  const fid = await newFile('keela_responses_json', 'restage.json');
  await stageAll(fid, JSON.stringify([{ 'Response Id': 'R1' }, { 'Response Id': 'R2' }, { 'Response Id': 'R3' }]), 'keela_responses_json');
  assert.equal((await staged(fid)).length, 3);
  const { out } = await stageAll(fid, JSON.stringify([{ 'Response Id': 'R9' }]), 'keela_responses_json');
  const rows = await staged(fid);
  assert.deepEqual(rows.map((r) => r.data['Response Id']), ['R9']);
  assert.deepEqual(out, { next_offset: null, rows: 1, staged_through: 1 });
  // a chunk out of order is refused by the database, naming the row, not a value
  await assert.rejects(db.query(`select public.wa284_stage_rows($1, 7, '[{"x": 1}]'::jsonb)`, [fid]), /rows are staged in order \(the next row is 2\)/);
});

test('a broken file is refused with no value in the message', () => {
  assert.throws(() => parseFile('{"contacts": 5}', 'keela_contacts_json', csvParse), /not a list of records/);
  assert.throws(() => parseFile('[{"a": 1}, 7]', 'keela_contacts_json', csvParse), /row 2 is not a record/);
  assert.throws(() => parseFile('not json at all', 'keela_responses_json', csvParse), /^Error: wa284: the JSON file could not be read$/);
  assert.throws(() => parseFile('a,b\n"x', 'keela_interactions_csv', csvParse), (e) => /the CSV file could not be read/.test(e.message) && !/"x/.test(e.message));
  assert.throws(() => parseFile('[]', 'keela_people', csvParse), /unknown file kind/);
});
