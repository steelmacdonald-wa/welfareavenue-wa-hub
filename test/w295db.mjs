// wave295: the offline database (PGlite) with waves 281, 283, 284, 294 and 295 and the invented people of test/w295schema.sql, for page tests that
// must ask the real SQL (test/w295drive.js). makeDb() returns { db, rpc(fn, args, email), contacts() }. Touches no live database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8').replace(/\r\n/g, '\n');
export async function makeDb() {
  const db = new PGlite();
  await db.exec(read('w281schema.sql')); await db.exec(read('../build/data/wa281_rules.sql'));
  await db.exec(read('w283schema.sql')); await db.exec(read('../build/data/wa283_page.sql'));
  let w294 = null;
  try { w294 = execFileSync('git', ['-C', join(here, '..'), '-c', 'core.autocrlf=false', 'show', 'wave294-keela-tags:build/data/wa294_keela_tags.sql'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch (e) { /* stand-in */ }
  if (w294) {
    await db.exec(read('w284schema.sql').split('\n').filter((l) => !/^alter table public\.crm_contacts (drop|add) column primary_email/.test(l)).join('\n'));
    await db.exec(read('../build/data/wa284_import.sql'));
    await db.exec(w294);
  }
  await db.exec(read('w295schema.sql'));
  await db.exec(read('../build/data/wa295_filters.sql'));
  return {
    db, wave294: !!w294,
    /* one rpc as a signed-in person (role authenticated), the way PostgREST runs it; { data, error } like supabase-js */
    async rpc(fn, args, email) {
      try {
        await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ role: 'authenticated', email }).replace(/'/g, "''")}', false); set role authenticated;`);
        let res;
        if (fn === 'crm_filter_contacts') res = await db.query('select id::int as id from public.crm_filter_contacts($1::jsonb)', [JSON.stringify(args.p_filter)]);
        else if (fn === 'crm_list_preview') res = await db.query('select x::int as id from public.crm_list_preview($1::jsonb) x', [JSON.stringify(args.p_filter)]);
        else if (fn === 'crm_tag_aliases') res = await db.query('select alias, tag from public.crm_tag_aliases()');
        else return { data: null, error: { message: 'not in the offline database: ' + fn } };
        return { data: fn === 'crm_list_preview' ? res.rows.map((r) => r.id) : res.rows, error: null };
      } catch (e) { return { data: null, error: { message: String(e.message || e) } }; }
      finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
    },
    /* the contacts as crm_contacts_v gives them (all invented), for the page's fixture */
    async contacts() { return (await db.query(`select row_to_json(c)::text as j from public.crm_contacts_v c order by c.id`)).rows.map((r) => JSON.parse(r.j)); },
    async fields() { return (await db.query(`select row_to_json(f)::text as j from public.crm_fields f order by f.sort, f.id`)).rows.map((r) => JSON.parse(r.j)); }
  };
}
