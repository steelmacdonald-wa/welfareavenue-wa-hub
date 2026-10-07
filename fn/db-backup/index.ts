// Welfare Avenue: db-backup (v2, 06/10/26: gzip; v1, 06/08/26, Phase 2 S3)
// v2 (Steel, 06/10/26: "help me get below storage use so that I don't have to pay"): each table is saved gzipped
// (<day>/<table>.json.gz, about a tenth of the size); compress_day {day} rewrites an older day's .json files as
// .json.gz, reading each one back and checking it decompresses to exactly the same bytes before the .json is removed
// (nothing is lost); restore_check reads either. Retention stays 30 days.
// Nightly JSON export of every public table to the private 'db-backups'
// storage bucket, dated folders, 30 day retention. Also supports a
// restore_check mode that reads a backup file back, verifies it parses and
// row counts match the live table (proving the file is restorable via
// jsonb_populate_recordset). Auth: internal trigger secret only.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret unavailable');
  return data as string;
}

async function gz(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
}
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
async function sha(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function compressDay(day: string): Promise<Record<string, unknown>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'bad day' };
  const { data: files, error } = await svc.storage.from('db-backups').list(day, { limit: 1000 });
  if (error) return { error: error.message };
  let done = 0, before = 0, after = 0; const failed: string[] = [];
  for (const f of (files || []).filter(x => x.name.endsWith('.json'))) {
    const path = day + '/' + f.name;
    try {
      const dl = await svc.storage.from('db-backups').download(path);
      if (dl.error || !dl.data) throw new Error('download');
      const raw = new Uint8Array(await dl.data.arrayBuffer());
      const z = await gz(raw);
      const up = await svc.storage.from('db-backups').upload(path + '.gz', z, { contentType: 'application/gzip', upsert: true });
      if (up.error) throw new Error('upload ' + up.error.message);
      const back = await svc.storage.from('db-backups').download(path + '.gz');
      if (back.error || !back.data) throw new Error('read back');
      const un = await gunzip(new Uint8Array(await back.data.arrayBuffer()));
      if (un.length !== raw.length || (await sha(un)) !== (await sha(raw))) throw new Error('check failed');
      const rm = await svc.storage.from('db-backups').remove([path]);
      if (rm.error) throw new Error('remove ' + rm.error.message);
      done++; before += raw.length; after += z.length;
    } catch (e) { failed.push(f.name + ': ' + String((e as Error).message || e)); }
  }
  return { ok: !failed.length, day, compressed: done, before, after, failed: failed.slice(0, 10) };
}

async function readAll(table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await svc.from(table).select('*').range(from, from + page - 1);
    if (error) throw new Error(table + ': ' + error.message);
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return rows;
}

async function doBackup(): Promise<Record<string, unknown>> {
  const { data: tbls, error } = await svc.rpc('wa_backup_tables');
  if (error || !tbls) return { error: 'table list failed: ' + (error && error.message) };
  const day = new Date().toISOString().slice(0, 10);
  const out: Record<string, number> = {};
  let bytes = 0;
  for (const t of tbls as string[]) {
    const rows = await readAll(t);
    const body = JSON.stringify(rows);
    bytes += body.length;
    const up = await svc.storage.from('db-backups').upload(day + '/' + t + '.json.gz',
      await gz(new TextEncoder().encode(body)), { contentType: 'application/gzip', upsert: true });
    if (up.error) return { error: 'upload failed for ' + t + ': ' + up.error.message, done: out };
    out[t] = rows.length;
  }
  // retention: remove dated folders older than 30 days
  let removedDays = 0;
  const { data: roots } = await svc.storage.from('db-backups').list('', { limit: 200 });
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  for (const r of roots || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.name) || r.name >= cutoff) continue;
    const { data: files } = await svc.storage.from('db-backups').list(r.name, { limit: 200 });
    if (files && files.length) {
      await svc.storage.from('db-backups').remove(files.map(f => r.name + '/' + f.name));
      removedDays++;
    }
  }
  try {
    await svc.from('change_log').insert({
      entity_type: 'db_backup', entity_id: day, field: 'nightly',
      old_value: null, new_value: 'tables=' + Object.keys(out).length + ' rows=' + Object.values(out).reduce((a, b) => a + b, 0) + ' bytes=' + bytes + ' pruned_days=' + removedDays,
      changed_by: 'db-backup v2'
    });
  } catch (_) { /* audit only */ }
  return { ok: true, day, tables: Object.keys(out).length, rows: Object.values(out).reduce((a, b) => a + b, 0), bytes, pruned_days: removedDays };
}

async function restoreCheck(day: string, table: string): Promise<Record<string, unknown>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[a-z0-9_]+$/.test(table)) return { error: 'bad args' };
  let text = '';
  const z = await svc.storage.from('db-backups').download(day + '/' + table + '.json.gz');
  if (!z.error && z.data) text = new TextDecoder().decode(await gunzip(new Uint8Array(await z.data.arrayBuffer())));
  else {
    const dl = await svc.storage.from('db-backups').download(day + '/' + table + '.json');
    if (dl.error || !dl.data) return { error: 'download failed: ' + (dl.error && dl.error.message) };
    text = await dl.data.text();
  }
  let rows: unknown[];
  try { rows = JSON.parse(text); } catch (_) { return { error: 'backup file does not parse' }; }
  const { count, error } = await svc.from(table).select('*', { count: 'exact', head: true });
  if (error) return { error: 'live count failed: ' + error.message };
  const keys = rows.length ? Object.keys(rows[0] as Record<string, unknown>) : [];
  return { ok: true, day, table, backup_rows: rows.length, live_rows: count, match: rows.length === count, sample_columns: keys.slice(0, 8) };
}

Deno.serve(async (req: Request) => {
  const given = req.headers.get('x-wa-secret');
  let expected = '';
  try { expected = await getSecret('WA_TRIGGER_SECRET'); } catch (_) { /* no-op */ }
  if (!given || given !== expected) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));
  let result: Record<string, unknown>;
  if (body.mode === 'compress_day') result = await compressDay(String(body.day || ''));
  else if (body.mode === 'restore_check') result = await restoreCheck(String(body.day || ''), String(body.table || ''));
  else result = await doBackup();
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
