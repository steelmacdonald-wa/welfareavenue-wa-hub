// Welfare Avenue: jd-drive (v2, 03/10/26, wave199; v2: app_config.value is text, so the Unsorted folder id is parsed)
// The HR shared drive's positions, read and kept tidy by the Hub:
//   *Recruitment* > Job descriptions > <Department> > <Position> > Resumes / the latest JD / Older JDs
// One position folder = one row in hub_positions; its CVs and older JDs are rows in hub_position_files.
// A CV dropped into a position's Resumes folder after the position was first read becomes an application
// (hub_candidates, stage New, source drive). A second JD at the position's top level sends the older one
// into Older JDs, so the top level always holds the single latest JD.
// Google: the wa-hub-drive service account (content manager on the drive), scope drive.
// CVs are personal data: upload and push refuse while the Job descriptions folder is open to anyone with the link.
// Auth: a staff JWT (the Hub) or x-wa-secret. Actions:
//   {action:'sync'}                                  read the tree, tidy it, update the tables
//   {action:'privacy'}                               is the folder open to anyone with the link?
//   {action:'create_position', title, dept}          a new position folder (+ Resumes) and its row
//   {action:'upload', position_id, name, mime, content_b64, candidate_id?, add?}   a CV into Resumes
//   {action:'move_file', file_id, position_id|null}  a CV to another position's Resumes (null: Unsorted Resumes)
//   {action:'push', limit?}                          CVs already in the Hub (storage) copied into their position's Resumes
//   {action:'apply', ops:[{op:'move'|'rename'|'trash', id, parent?, name?}]}   secret only: the one-off reorganisation
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,size,createdTime,modifiedTime';
const ROOT_DEFAULT = '1wqsg2BMlXqSnuJgiYWpW01xpqipxqNlH';   // *Recruitment* > Job descriptions
const RECRUIT = '10K7Zgak_79OG59C0gJ11ph4bv4nzumwB';         // *Recruitment*
const FOLDER = 'application/vnd.google-apps.folder';
const DEPTS: Array<[string, RegExp]> = [
  ['opsmtl', /montr|\bmtl\b/i], ['opsto', /toronto|ontario/i], ['exec', /^exec/i], ['board', /^board/i],
  ['fundraising', /^fundrais/i], ['marketing', /^market/i], ['hr', /^(human|hr\b)/i], ['progdev', /^program/i],
];

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function staffEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const raw = atob(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
let TOKEN: { value: string; exp: number } | null = null;
async function googleToken(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 60000) return TOKEN.value;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google token exchange failed');
  TOKEN = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return TOKEN.value;
}
// deno-lint-ignore no-explicit-any
async function g(method: string, url: string, body?: unknown): Promise<any> {
  const t = await googleToken();
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await r.text();
  if (!r.ok) throw new Error('Drive ' + r.status + ': ' + txt.slice(0, 240));
  return txt ? JSON.parse(txt) : {};
}
type F = { id: string; name: string; mimeType: string; createdTime?: string; modifiedTime?: string; size?: string; webViewLink?: string; parents?: string[] };
const FIELDS = 'id,name,mimeType,createdTime,modifiedTime,size,webViewLink,parents';
async function list(parent: string): Promise<F[]> {
  const out: F[] = []; let page = '';
  do {
    const q = encodeURIComponent("'" + parent + "' in parents and trashed = false");
    const r = await g('GET', DRIVE + '/files?q=' + q + '&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=nextPageToken,files(' + FIELDS + ')' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
    out.push(...(r.files || [])); page = r.nextPageToken || '';
  } while (page);
  return out;
}
async function meta(id: string): Promise<F> { return await g('GET', DRIVE + '/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=' + FIELDS); }
async function mkdir(name: string, parent: string): Promise<F> { return await g('POST', DRIVE + '/files?supportsAllDrives=true&fields=' + FIELDS, { name, mimeType: FOLDER, parents: [parent] }); }
async function move(id: string, to: string, name?: string): Promise<F> {
  const f = await meta(id);
  const from = (f.parents || []).filter(p => p !== to).join(',');
  return await g('PATCH', DRIVE + '/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&addParents=' + to + (from ? '&removeParents=' + from : '') + '&fields=' + FIELDS, name ? { name } : {});
}
async function rootId(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'jd_drive_root').maybeSingle();
  const v = data?.value; return (typeof v === 'string' && v) || (v && typeof v === 'object' && (v as { id?: string }).id) || ROOT_DEFAULT;
}
// is `id` inside `ancestor` (at most 6 levels up)?
async function inside(id: string, ancestor: string): Promise<boolean> {
  let cur = id;
  for (let i = 0; i < 7; i++) { if (cur === ancestor) return true; const f = await meta(cur); const p = (f.parents || [])[0]; if (!p) return false; cur = p; }
  return false;
}
async function linkOpen(root: string): Promise<boolean> {
  const r = await g('GET', DRIVE + '/files/' + root + '/permissions?supportsAllDrives=true&fields=permissions(type,role)');
  return (r.permissions || []).some((p: { type: string }) => p.type === 'anyone');
}
const PRIVACY = 'The Job descriptions folder is shared with anyone who has the link, so the Hub will not put CVs in it. Turn off link sharing on *Recruitment* (Share, General access: Restricted), then try again.';
function cleanName(file: string): string {
  let s = file.replace(/\.(pdf|docx?|pages|odt|rtf|txt|jpe?g|png)$/i, '').replace(/\.(pdf|docx?)$/i, '');
  s = s.replace(/\s+-\s+[^-]+$/, (m) => /cv|resume|curriculum/i.test(m) ? '' : m);
  s = s.replace(/\b(cv|c\.v\.|resume|résumé|curriculum vitae|curriculum|new|final|copy of|english|\d{4})\b/gi, ' ').replace(/[_()]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[-.,]+$/, '').trim();
  const m = s.match(/^([A-ZÀ-Ý' -]{2,})\s*[,.]\s*(.+)$/);   // SURNAME, Given
  if (m) { const sur = m[1].trim().toLowerCase().replace(/(^|[ '-])\S/g, c => c.toUpperCase()); s = m[2].trim() + ' ' + sur; }
  s = s.replace(/’s$|'s$/i, '').trim();
  return s.slice(0, 120) || file.slice(0, 120);
}
function isJd(f: F): boolean { return f.mimeType !== FOLDER; }

// deno-lint-ignore no-explicit-any
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<any>) {
  const out: unknown[] = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { error: String((e as Error).message || e) }; } } }));
  return out;
}

async function sync(who: string) {
  const root = await rootId();
  const top = await list(root);
  const now = new Date().toISOString();
  const { data: oldPos } = await svc.from('hub_positions').select('id,folder_id,baseline_at,title');
  const byFolder = new Map((oldPos || []).map(p => [p.folder_id, p]));
  const { data: oldFiles } = await svc.from('hub_position_files').select('id,file_id,candidate_id,member_id,position_id');
  const fileRow = new Map((oldFiles || []).map(f => [f.file_id, f]));
  const seenPos: string[] = [], seenFiles: string[] = [], made: string[] = [], tidied: string[] = [], added: string[] = [], errors: string[] = [];
  const work: Array<{ dept: string; f: F }> = [];
  let unsorted: F | null = null;
  for (const d of top) {
    if (d.mimeType !== FOLDER) continue;
    if (/^unsorted/i.test(d.name)) { unsorted = d; continue; }
    const key = (DEPTS.find(([, re]) => re.test(d.name)) || [null])[0];
    if (!key) continue;   // Templates & Other and anything else stays as it is
    for (const p of await list(d.id)) if (p.mimeType === FOLDER) work.push({ dept: key, f: p });
  }
  // deno-lint-ignore no-explicit-any
  async function fileUp(pid: number | null, kind: string, f: F, pos?: any) {
    seenFiles.push(f.id);
    const prev = fileRow.get(f.id);
    const row = { position_id: pid, kind, file_id: f.id, name: f.name, mime: f.mimeType, url: f.webViewLink || null, size: f.size ? Number(f.size) : null, created_time: f.createdTime || null, modified_time: f.modifiedTime || null, gone: false, seen_at: now };
    const { data: up } = await svc.from('hub_position_files').upsert(row, { onConflict: 'file_id' }).select('id,candidate_id,member_id').single();
    // a CV that arrived after the position was first read becomes an application
    if (kind === 'resume' && pos && !prev && up && !up.candidate_id && !up.member_id && pos.baseline_at && f.createdTime && f.createdTime > pos.baseline_at) {
      const { data: c } = await svc.from('hub_candidates').insert({ name: cleanName(f.name), role: pos.title, position_id: pid, source: 'drive', status: 'new', stage_at: now, drive_file_id: f.id, links: f.webViewLink ? [f.webViewLink] : [], summary: 'CV added to the ' + pos.title + ' Resumes folder in Drive.', updated_by: 'jd-drive' }).select('id').single();
      if (c) { await svc.from('hub_position_files').update({ candidate_id: c.id }).eq('id', up.id); added.push(f.name); }
    }
  }
  await pool(work, 6, async ({ dept, f }) => {
    seenPos.push(f.id);
    const kids = await list(f.id);
    let res = kids.find(k => k.mimeType === FOLDER && /^(resumes?|cvs?)$/i.test(k.name.trim()));
    let older = kids.find(k => k.mimeType === FOLDER && /^old(er)?\b/i.test(k.name.trim()));
    if (!res) { res = await mkdir('Resumes', f.id); made.push(f.name + '/Resumes'); }
    const jds = kids.filter(isJd).sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    if (jds.length > 1) {
      if (!older) { older = await mkdir('Older JDs', f.id); made.push(f.name + '/Older JDs'); }
      for (const o of jds.slice(1)) { await move(o.id, older.id); tidied.push(f.name + ': ' + o.name); }
    }
    const jd = jds[0];
    const prev = byFolder.get(f.id);
    const row = { title: f.name.trim(), dept, folder_id: f.id, resumes_id: res.id, older_id: older ? older.id : null, jd_id: jd ? jd.id : null, jd_name: jd ? jd.name : null, jd_url: jd ? jd.webViewLink : null, jd_mime: jd ? jd.mimeType : null, jd_modified: jd ? jd.modifiedTime : null, gone: false, synced_at: now, baseline_at: prev?.baseline_at || now };
    const { data: pos, error } = await svc.from('hub_positions').upsert(row, { onConflict: 'folder_id' }).select('id,title,baseline_at').single();
    if (error || !pos) { errors.push(f.name + ': ' + (error?.message || 'no row')); return; }
    const resumes = (await list(res.id)).filter(x => x.mimeType !== FOLDER);
    const olds = older ? (await list(older.id)).filter(x => x.mimeType !== FOLDER) : [];
    for (const r of resumes) await fileUp(pos.id, 'resume', r, pos);
    for (const o of olds) await fileUp(pos.id, 'old_jd', o);
    await svc.from('hub_positions').update({ older_count: olds.length }).eq('id', pos.id);
  });
  if (unsorted) for (const r of (await list(unsorted.id)).filter(x => x.mimeType !== FOLDER)) await fileUp(null, 'resume', r);
  // what is no longer there
  if (seenPos.length) await svc.from('hub_positions').update({ gone: true }).not('folder_id', 'in', '(' + seenPos.map(x => '"' + x + '"').join(',') + ')').eq('gone', false);
  const goneFiles = (oldFiles || []).filter(f => !seenFiles.includes(f.file_id)).map(f => f.id);
  if (goneFiles.length) await svc.from('hub_position_files').update({ gone: true }).in('id', goneFiles);
  await svc.from('app_config').upsert({ key: 'jd_drive_sync', value: { at: now, by: who, positions: seenPos.length, files: seenFiles.length, unsorted: unsorted ? unsorted.id : null, made, tidied, added, errors } });
  return { ok: true, positions: seenPos.length, files: seenFiles.length, made, tidied, added, errors };
}

async function uploadFile(parent: string, name: string, mime: string, bytes: Uint8Array): Promise<F> {
  const t = await googleToken(), boundary = 'wa199' + crypto.randomUUID();
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name, parents: [parent] }) + '\r\n--' + boundary + '\r\nContent-Type: ' + (mime || 'application/octet-stream') + '\r\n\r\n';
  const enc = new TextEncoder(), a = enc.encode(head), z = enc.encode('\r\n--' + boundary + '--');
  const body = new Uint8Array(a.length + bytes.length + z.length); body.set(a, 0); body.set(bytes, a.length); body.set(z, a.length + bytes.length);
  const r = await fetch(UPLOAD, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
  const txt = await r.text(); if (!r.ok) throw new Error('Drive upload ' + r.status + ': ' + txt.slice(0, 200));
  return JSON.parse(txt);
}
function b64bytes(b64: string): Uint8Array { const raw = atob(b64.replace(/^data:[^,]*,/, '')); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const secret = req.headers.get('x-wa-secret');
    const bySecret = !!secret && secret === await getSecret('WA_TRIGGER_SECRET');
    const who = bySecret ? 'jd-drive' : await staffEmail(req);
    if (!who) return json({ error: 'Staff only' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'sync');
    const root = await rootId();

    if (action === 'sync') return json(await sync(who));
    if (action === 'privacy') return json({ link_open: await linkOpen(root) });

    if (action === 'create_position') {
      const title = String(body.title || '').trim().replace(/[\/\\]/g, '-').slice(0, 100), dept = String(body.dept || '');
      if (!title) return json({ error: 'A title, please' }, 400);
      const top = await list(root);
      const d = top.find(x => x.mimeType === FOLDER && (DEPTS.find(([k]) => k === dept)?.[1] || /$^/).test(x.name));
      if (!d) return json({ error: 'No department folder for ' + dept }, 400);
      const exists = (await list(d.id)).find(x => x.mimeType === FOLDER && x.name.trim().toLowerCase() === title.toLowerCase());
      const f = exists || await mkdir(title, d.id);
      const kids = exists ? await list(f.id) : [];
      const res = kids.find(k => k.mimeType === FOLDER && /^resumes?$/i.test(k.name)) || await mkdir('Resumes', f.id);
      const now = new Date().toISOString();
      const { data, error } = await svc.from('hub_positions').upsert({ title, dept, folder_id: f.id, resumes_id: res.id, stage: body.stage || 'requested', owner: body.owner || null, needed_by: body.needed_by || null, baseline_at: now, synced_at: now, updated_by: who, gone: false }, { onConflict: 'folder_id' }).select('*').single();
      if (error) return json({ error: error.message }, 500);
      await svc.from('change_log').insert({ entity_type: 'position', entity_id: String(data.id), field: 'created', old_value: null, new_value: title, changed_by: who });
      return json({ ok: true, position: data, folder_url: 'https://drive.google.com/drive/folders/' + f.id });
    }

    if (action === 'upload') {
      if (await linkOpen(root)) return json({ error: PRIVACY, privacy: true }, 409);
      const { data: pos } = await svc.from('hub_positions').select('*').eq('id', body.position_id).maybeSingle();
      if (!pos || !pos.resumes_id) return json({ error: 'That position has no Resumes folder yet; Sync with Drive first' }, 400);
      const bytes = b64bytes(String(body.content_b64 || ''));
      if (!bytes.length || bytes.length > 15 * 1024 * 1024) return json({ error: 'The file is empty or larger than 15 MB' }, 400);
      const name = String(body.name || 'CV').slice(0, 140);
      const f = await uploadFile(pos.resumes_id, name, String(body.mime || ''), bytes);
      let cid = body.candidate_id ? Number(body.candidate_id) : null;
      if (!cid && body.add) {
        const { data: c } = await svc.from('hub_candidates').insert({ name: String(body.person || cleanName(name)).slice(0, 120), email: body.email || null, role: pos.title, position_id: pos.id, source: 'upload', status: 'new', stage_at: new Date().toISOString(), drive_file_id: f.id, links: f.webViewLink ? [f.webViewLink] : [], updated_by: who }).select('id').single();
        cid = c?.id || null;
      } else if (cid) await svc.from('hub_candidates').update({ drive_file_id: f.id, position_id: pos.id, updated_at: new Date().toISOString(), updated_by: who }).eq('id', cid);
      await svc.from('hub_position_files').upsert({ position_id: pos.id, kind: 'resume', file_id: f.id, name: f.name, mime: f.mimeType, url: f.webViewLink, size: f.size ? Number(f.size) : bytes.length, created_time: f.createdTime, modified_time: f.modifiedTime, candidate_id: cid, seen_at: new Date().toISOString() }, { onConflict: 'file_id' });
      await svc.from('change_log').insert({ entity_type: 'position', entity_id: String(pos.id), field: 'cv_upload', old_value: null, new_value: f.name, changed_by: who });
      return json({ ok: true, file: f, candidate_id: cid });
    }

    if (action === 'move_file') {
      const { data: row } = await svc.from('hub_position_files').select('*').eq('file_id', String(body.file_id || '')).maybeSingle();
      if (!row) return json({ error: 'Unknown file' }, 404);
      let to: string | null = null, pid: number | null = null, title = 'Unsorted Resumes';
      if (body.position_id) { const { data: p } = await svc.from('hub_positions').select('id,resumes_id,title').eq('id', body.position_id).maybeSingle(); to = p?.resumes_id || null; pid = p?.id || null; title = p?.title || ''; }
      else { const { data: s } = await svc.from('app_config').select('value').eq('key', 'jd_drive_sync').maybeSingle(); let sv: unknown = s?.value; if (typeof sv === 'string') { try { sv = JSON.parse(sv); } catch (_) { sv = null; } } to = (sv as { unsorted?: string } | null)?.unsorted || null; }   // app_config.value is text
      if (!to) return json({ error: 'No folder to move it to' }, 400);
      const f = await move(row.file_id, to);
      await svc.from('hub_position_files').update({ position_id: pid, url: f.webViewLink || row.url }).eq('id', row.id);
      if (row.candidate_id && pid) await svc.from('hub_candidates').update({ position_id: pid, role: title, updated_at: new Date().toISOString(), updated_by: who }).eq('id', row.candidate_id);
      return json({ ok: true });
    }

    if (action === 'push') {
      if (await linkOpen(root)) return json({ error: PRIVACY, privacy: true }, 409);
      const lim = Math.min(40, Number(body.limit) || 20);
      const { data: cs } = await svc.from('hub_candidates').select('id,name,cv_path,cv_name,position_id').not('cv_path', 'is', null).is('drive_file_id', null).not('position_id', 'is', null).limit(lim);
      const done: string[] = [], failed: string[] = [];
      for (const c of cs || []) {
        try {
          const { data: pos } = await svc.from('hub_positions').select('id,resumes_id').eq('id', c.position_id).single();
          const { data: blob, error } = await svc.storage.from('hub-mail').download(c.cv_path);
          if (error || !blob || !pos?.resumes_id) throw new Error(error?.message || 'no file');
          const ext = (String(c.cv_name || c.cv_path).match(/\.[a-z0-9]{2,5}$/i) || [''])[0];
          const f = await uploadFile(pos.resumes_id, (c.name || 'Candidate') + ' - CV' + ext, blob.type || '', new Uint8Array(await blob.arrayBuffer()));
          await svc.from('hub_candidates').update({ drive_file_id: f.id }).eq('id', c.id);
          await svc.from('hub_position_files').upsert({ position_id: pos.id, kind: 'resume', file_id: f.id, name: f.name, mime: f.mimeType, url: f.webViewLink, size: f.size ? Number(f.size) : null, created_time: f.createdTime, modified_time: f.modifiedTime, candidate_id: c.id, seen_at: new Date().toISOString() }, { onConflict: 'file_id' });
          done.push(c.name);
        } catch (e) { failed.push(c.name + ': ' + String((e as Error).message || e).slice(0, 120)); }
      }
      return json({ ok: true, done, failed });
    }

    if (action === 'apply') {
      if (!bySecret) return json({ error: 'Not from the Hub' }, 403);
      const out: unknown[] = [];
      for (const o of (body.ops || []).slice(0, 80)) {
        try {
          if (o.op === 'move') {
            if (!(await inside(o.parent, root))) throw new Error('destination outside Job descriptions');
            if (!(await inside(o.id, RECRUIT))) throw new Error('source outside *Recruitment*');
            const f = await move(o.id, o.parent, o.name); out.push({ id: o.id, ok: true, name: f.name });
          } else if (o.op === 'rename') {
            if (!(await inside(o.id, RECRUIT))) throw new Error('outside *Recruitment*');
            const f = await g('PATCH', DRIVE + '/files/' + o.id + '?supportsAllDrives=true&fields=id,name', { name: String(o.name) }); out.push({ id: o.id, ok: true, name: f.name });
          } else if (o.op === 'trash') {
            const f = await meta(o.id);
            if (f.mimeType !== FOLDER) throw new Error('only empty folders');
            if (!(await inside(o.id, RECRUIT))) throw new Error('outside *Recruitment*');
            if ((await list(o.id)).length) throw new Error('not empty');
            await g('PATCH', DRIVE + '/files/' + o.id + '?supportsAllDrives=true&fields=id', { trashed: true }); out.push({ id: o.id, ok: true, trashed: true });
          } else out.push({ id: o.id, error: 'unknown op' });
        } catch (e) { out.push({ id: o.id, error: String((e as Error).message || e).slice(0, 200) }); }
      }
      return json({ ok: true, out });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
