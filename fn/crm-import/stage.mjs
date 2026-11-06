// Welfare Avenue: crm-import's staging step (wave284), plain JavaScript with no imports so the same code runs in the edge function (Deno, with
// jsr:@std/csv's parse passed in) and in the offline test (node, test/w284import.test.mjs, with the same parser from npm's @jsr/std__csv).
// A file is read whole, parsed into rows (objects keyed by the CSV header or the JSON record's keys), and staged CHUNK rows per call: the page
// calls stage with offset 0, then each next_offset, until next_offset is null. Errors name row numbers, never values.

export const CHUNK = 5000;
export const KINDS = ['keela_contacts_json', 'keela_responses_json', 'keela_interactions_csv', 'keela_transactions_csv'];

// the rows of a file: CSV through csvParse (multi-line quoted fields, UTF-8, a byte order mark dropped); JSON as a list of records, or an object
// holding one list of records (Keela's raw exports wrap them)
export function parseFile(text, kind, csvParse) {
  if (!KINDS.includes(kind)) throw new Error('wa284: unknown file kind ' + kind);
  const src = String(text || '').replace(/^﻿/, '');
  if (kind.endsWith('_csv')) {
    if (typeof csvParse !== 'function') throw new Error('wa284: no CSV parser');
    let rows;
    try { rows = csvParse(src, { skipFirstRow: true }); } catch (e) {
      const m = /line (\d+)/i.exec(String(e && e.message || ''));
      throw new Error('wa284: the CSV file could not be read' + (m ? ' (near line ' + m[1] + ')' : ''));
    }
    return rows.map((r) => Object.assign({}, r));
  }
  let data;
  try { data = JSON.parse(src); } catch (_) { throw new Error('wa284: the JSON file could not be read'); }
  if (!Array.isArray(data) && data && typeof data === 'object') {
    const lists = Object.keys(data).filter((k) => Array.isArray(data[k]));
    if (lists.length === 1) data = data[lists[0]];
  }
  if (!Array.isArray(data)) throw new Error('wa284: the JSON file is not a list of records');
  data.forEach((r, i) => { if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('wa284: row ' + (i + 1) + ' is not a record'); });
  return data;
}

// one call of stage: parse, take the chunk from offset, hand it to save(offset, rows, total), and say where the next call starts
export async function stageStep({ text, kind, offset, csvParse, save, size }) {
  const n = size || CHUNK;
  const rows = parseFile(text, kind, csvParse);
  const from = Number(offset || 0);
  if (!Number.isInteger(from) || from < 0 || from > rows.length) throw new Error('wa284: offset ' + offset + ' is outside the file (' + rows.length + ' rows)');
  const part = rows.slice(from, from + n);
  await save(from, part, rows.length);
  const next = from + part.length;
  return { next_offset: next < rows.length ? next : null, rows: rows.length, staged_through: next };
}
