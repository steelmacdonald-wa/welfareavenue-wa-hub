// Welfare Avenue: drive-mine (v2.4, 26/09/26, wave140)
// Purpose: mining Welfare Avenue's Google Drive (and its Canva designs and its own social posts) into the Hub: the
//   timeline since March 2020, the organisations it has worked with, lessons learned and resources it has made.
//   Steel: "don't just add anything... mine for gold (useful content), melt and refine it (take what's good out of
//   it), and frame it". Then: "Maybe you can use open router and Jev to help make faster decisions?"
// v1 (inventory): lists every file Steel's welfareavenue.com account can see (his My Drive, files shared with him,
//   each shared drive he belongs to) into drive_inventory, metadata only.
// v2 (the mining, a pipeline in drive_mined, one row per document, driven by workers):
//   extract  reads the text (Google Docs and Slides exported as text, Sheets through the Sheets API, Word, PowerPoint
//            and Excel files unzipped; a PDF is read later by the model itself) into drive_text;
//   screen   Jev (OpenRouter's decision model) answers keep / skip / private for the document, with probabilities;
//            a copy of a document already queued is skipped;
//   mine     the llm router (task drive_mine, Jev picks the model per document; drive_mine_pdf for PDFs, Claude)
//            records events, partners, lessons, resources and facts, each with a quote from the document;
//   check    Jev checks each event, partner and lesson against the lines around its quote (did it happen, is the
//            date right, did WA actually work with them).
//   Private content never goes further: a document Jev or the model finds private (HR, donors, personal, money,
//   logins, the executive directors' own plans) is marked private in drive_inventory and its text is deleted; when
//   the model says private but Jev was sure it is not, the document is held (stage private, disputed) for a person.
// v2.1: Sheets exported as Excel (the Sheets API is off in the Google project); a long document is read in up to
//   four parts side by side; tighter private rule (a recap that credits people is not private); numbers only when
//   stated; periods get date_end; Canva designs as a type.
// v2.2: Jev calls retried four times with pauses (calls between functions dropped under load) and the reason kept;
//   the screening question counts past planning documents (they show an event happened) and the bars are lower
//   (gold 0.1, ore 0.35); PDFs up to 16 MB.
// v2.3: Sheets through the Sheets API again (Steel switched it on, 26/09/26): values as people see them, dates as
//   dates; the Excel export stays as the fallback.
// v2.5 (26/09/26): the Welfare Avenue Hub label on the important files (action labels), and the Google check also asks
//   for Drive labels and shows the storage limit (which tells the Workspace edition apart).
// v2.4: Jev straight to OpenRouter (its Decisions API), logged to ai_calls here: calls from one function to another
//   share a trace, and Supabase was refusing the many small Jev calls ("Rate limit exceeded for trace"); the
//   extraction still goes through the llm router, and waits when Supabase says to retry.
// Workers: {action:'work'} claims documents (drive_mine_claim) for up to about 105 seconds and stops; the cron job
//   wa-drive-mine-pump starts six a minute while drive_mine_state.status is 'mining' (v2.5: the job exists only during a run). A run stops by itself at
//   15 dollars of AI spend (status 'paused').
// Auth: the trigger secret (x-wa-secret), the service role (its own workers) or an admin's JWT.
// Reads Drive through the service account's domain-wide delegation as steel.macdonald@welfareavenue.com (scope
//   drive; this function only reads). Writes drive_inventory (triage of private finds), drive_text, drive_mined,
//   drive_mine_state, change_log.
// Actions: status, inventory, start (queue and run), work, stop, requeue {file_ids, stage}, google_check (which Google APIs
//   and delegated scopes answer, for building on them), labels {dry, offset} (v2.5: the Welfare Avenue Hub label on the
//   important files; the only action that writes to Drive, and only label values).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const ACTOR = 'steel.macdonald@welfareavenue.com';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const API = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
const FIELDS = 'nextPageToken,files(id,name,mimeType,parents,createdTime,modifiedTime,size,owners(emailAddress),webViewLink,driveId,trashed,shortcutDetails(targetId,targetMimeType))';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function adminCaller(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_hub_admin'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---- the delegated token (as Steel's welfareavenue.com account) ---- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
let TOKEN: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 120000) return TOKEN.v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: ACTOR, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the delegated token: ' + String(body.error_description || body.error || res.status).slice(0, 200));
  TOKEN = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOKEN.v;
}
/* the pump (cron wa-drive-mine-pump, six workers a minute) runs only while a run is on: start schedules it, done, paused and
   stopped take it off (drive_mine_pump) */
async function pump(on: boolean): Promise<void> { try { await svc.rpc('drive_mine_pump', { p_on: on }); } catch (_) { /* the job's own status check still guards it */ } }

/* ---------- the Welfare Avenue Hub label on the important files (v2.5; Steel, 26/09/26: "only on the important ones") ----------
   Important: an organization file in a shared drive that the Document finder marks as a guide or template to reuse, or the
   source of one of Our story's milestones. One label, Welfare Avenue Hub, with four fields: Kind, Team, Year and Why it matters
   (Reuse it, Our story), so the team can find these files by label in Drive too. Needs Drive labels in the Workspace edition
   (Business Standard or higher), the Drive Labels API and the scope drive.admin.labels delegated to the service account.
   {action:'labels', dry:true} lists what it would label; without dry it creates and publishes the label once, then sets the
   fields file by file (setting the same values again changes nothing, so a run can be repeated). */
const LABELS_API = 'https://drivelabels.googleapis.com/v2';
const HUB_LABEL = 'Welfare Avenue Hub';
const L_KIND: [string, string][] = [['guide', 'Guide'], ['plan', 'Plan'], ['report', 'Report'], ['meeting notes', 'Meeting notes'], ['presentation', 'Presentation'], ['proposal', 'Proposal'],
  ['letter', 'Letter'], ['newsletter', 'Newsletter'], ['application', 'Application'], ['list', 'List'], ['posts', 'Post or poster'], ['other', 'Other']];
const L_TEAM: [string, string][] = [['opsmtl', 'Operations Montreal'], ['opsto', 'Operations Toronto'], ['progdev', 'Program Development'], ['marketing', 'Marketing'],
  ['fundraising', 'Fundraising & Finances'], ['hr', 'Human Resources'], ['board', 'Board'], ['leadership', 'Leadership'], ['general', 'General']];
const L_WHY: [string, string][] = [['reuse', 'Reuse it'], ['story', 'Our story']];
type Important = { file_id: string; title: string; kind: string | null; team: string | null; year: number | null; why: string[] };
async function importantFiles(): Promise<Important[]> {
  const [{ data: docs }, { data: hist }] = await Promise.all([
    svc.from('wa_documents').select('file_id,title,kind,team,year,reusable,source').eq('source', 'shared_drive').limit(5000),
    svc.from('wa_history').select('sources').eq('highlight', true).eq('status', 'published').limit(500)
  ]);
  const story = new Set<string>();
  for (const h of hist || []) for (const s of ((h as Row).sources as Row[] || [])) if (s && s.file_id) story.add(String(s.file_id));
  return (docs || []).filter((d: Row) => d.reusable || story.has(String(d.file_id))).map((d: Row) => ({
    file_id: String(d.file_id), title: String(d.title || ''), kind: (d.kind as string) || null, team: (d.team as string) || null, year: (d.year as number) || null,
    why: [d.reusable ? 'reuse' : '', story.has(String(d.file_id)) ? 'story' : ''].filter(Boolean)
  }));
}
async function labelsCall(tk: string, path: string, method = 'GET', body?: unknown): Promise<Row> {
  const res = await fetch(LABELS_API + path, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await res.text();
  let j: Row = {}; try { j = JSON.parse(txt || '{}'); } catch (_) { j = { raw: txt.slice(0, 200) }; }
  if (!res.ok) throw new Error('labels ' + res.status + ': ' + String((j.error as Row)?.message || txt).slice(0, 220));
  return j;
}
/* the label, created and published once; field and choice ids by their display names */
async function hubLabel(tk: string): Promise<{ id: string; fields: Record<string, { id: string; choices: Record<string, string> }> }> {
  const list = await labelsCall(tk, '/labels?useAdminAccess=true&view=LABEL_VIEW_FULL&pageSize=200');
  let label = ((list.labels as Row[]) || []).find((l) => (l.properties as Row)?.title === HUB_LABEL && (l.lifecycle as Row)?.state !== 'DISABLED') as Row | undefined;
  if (!label) {
    const sel = (name: string, list: [string, string][], max = 1) => ({ properties: { displayName: name }, selectionOptions: { ...(max > 1 ? { listOptions: { maxEntries: max } } : {}), choices: list.map((c) => ({ properties: { displayName: c[1] } })) } });
    label = await labelsCall(tk, '/labels?useAdminAccess=true', 'POST', {
      labelType: 'ADMIN',
      properties: { title: HUB_LABEL, description: 'Set by the Welfare Avenue Hub on the files that matter most: guides and templates to reuse, and the records behind Our story. The Hub\'s Document finder has every document.' },
      fields: [sel('Kind', L_KIND), sel('Team', L_TEAM), { properties: { displayName: 'Year' }, integerOptions: { minValue: '2019', maxValue: '2035' } }, sel('Why it matters', L_WHY, 2)]
    });
    try { await labelsCall(tk, '/' + label.name + '/permissions?useAdminAccess=true', 'POST', { audience: 'audiences/default', role: 'READER' }); } catch (_) { /* the Labels manager can share it */ }
  }
  if ((label.lifecycle as Row)?.state !== 'PUBLISHED') label = await labelsCall(tk, '/' + label.name + ':publish', 'POST', { useAdminAccess: true });
  const fields: Record<string, { id: string; choices: Record<string, string> }> = {};
  for (const f of (label.fields as Row[]) || []) {
    const choices: Record<string, string> = {};
    for (const c of (((f.selectionOptions as Row)?.choices as Row[]) || [])) choices[String((c.properties as Row)?.displayName)] = String(c.id);
    fields[String((f.properties as Row)?.displayName)] = { id: String(f.id), choices };
  }
  return { id: String(label.id), fields };
}
async function applyLabels(dry: boolean, offset: number, who: string): Promise<Row> {
  const files = await importantFiles();
  const reuse = files.filter((f) => f.why.includes('reuse')).length, story = files.filter((f) => f.why.includes('story')).length;
  if (dry) return { ok: true, dry: true, files: files.length, reuse, story, sample: files.slice(0, 12).map((f) => f.title + ' (' + f.why.join(', ') + ')') };
  let adminTk = '';
  try { adminTk = await tokenFor('https://www.googleapis.com/auth/drive.admin.labels'); }
  catch (e) { return { ok: false, blocked: 'The scope drive.admin.labels is not delegated to the Hub service account (or Drive labels are not in this Workspace edition): ' + String((e as Error).message || e).slice(0, 160) }; }
  const L = await hubLabel(adminTk);
  const tk = await tokenFor(SCOPE);
  const kindName: Record<string, string> = Object.fromEntries(L_KIND), teamName: Record<string, string> = Object.fromEntries(L_TEAM), whyName: Record<string, string> = Object.fromEntries(L_WHY);
  const t0 = Date.now();
  let done = 0, failed = 0, i = Math.max(0, offset || 0);
  const errors: string[] = [];
  for (; i < files.length && Date.now() - t0 < 100000; i++) {
    const f = files[i], mods: Row[] = [];
    const ch = (field: string, names: string[]) => { const F = L.fields[field]; if (!F) return; const ids = names.map((n) => F.choices[n]).filter(Boolean); if (ids.length) mods.push({ fieldId: F.id, setSelectionValues: ids }); };
    ch('Kind', [kindName[f.kind || 'other'] || 'Other']);
    if (f.team && teamName[f.team]) ch('Team', [teamName[f.team]]);
    if (f.year && L.fields.Year) mods.push({ fieldId: L.fields.Year.id, setIntegerValues: [String(f.year)] });
    ch('Why it matters', f.why.map((w) => whyName[w]).filter(Boolean));
    try {
      const res = await fetch(API + '/files/' + encodeURIComponent(f.file_id) + '/modifyLabels', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'drive#modifyLabelsRequest', labelModifications: [{ labelId: L.id, fieldModifications: mods }] }) });
      if (res.ok) done++;
      else { failed++; const txt = await res.text(); if (errors.length < 8) errors.push(f.title.slice(0, 60) + ': ' + res.status + ' ' + txt.replace(/\s+/g, ' ').slice(0, 140)); }
    } catch (e) { failed++; if (errors.length < 8) errors.push(f.title.slice(0, 60) + ': ' + String((e as Error).message || e).slice(0, 140)); }
  }
  const more = i < files.length;
  try { await svc.from('change_log').insert({ entity_type: 'drive_labels', entity_id: HUB_LABEL, field: 'applied', old_value: null, new_value: done + ' files labelled, ' + failed + ' failed (' + (offset || 0) + ' to ' + i + ' of ' + files.length + ')', changed_by: who }); } catch (_) { /* audit */ }
  return { ok: true, label: L.id, files: files.length, labelled: done, failed, errors, next: more ? i : null };
}

/* a delegated token for any scope, for the Google API check (wave140) */
async function tokenFor(scope: string, sub = ACTOR): Promise<string> {
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub, scope, aud: sa.token_uri, iat: now, exp: now + 600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('token refused: ' + String(body.error_description || body.error || res.status).slice(0, 160));
  return body.access_token;
}
async function googleCheck(): Promise<Row[]> {
  const pick = async (mime: string) => { const { data } = await svc.from('drive_inventory').select('file_id').eq('mime', mime).eq('trashed', false).limit(1); return data && data[0] ? String(data[0].file_id) : ''; };
  const doc = await pick(GDOC), slides = await pick(GSLIDES), sheet = await pick(GSHEET), form = await pick('application/vnd.google-apps.form');
  const tests: { api: string; scope: string; url: string }[] = [
    { api: 'Drive', scope: 'https://www.googleapis.com/auth/drive', url: API + '/about?fields=user(emailAddress),storageQuota(limit)' },
    { api: 'Docs', scope: 'https://www.googleapis.com/auth/drive', url: 'https://docs.googleapis.com/v1/documents/' + doc + '?fields=title' },
    { api: 'Slides', scope: 'https://www.googleapis.com/auth/drive', url: 'https://slides.googleapis.com/v1/presentations/' + slides + '?fields=title' },
    { api: 'Sheets', scope: 'https://www.googleapis.com/auth/drive', url: SHEETS + sheet + '?fields=properties.title' },
    { api: 'Forms', scope: 'https://www.googleapis.com/auth/drive', url: 'https://forms.googleapis.com/v1/forms/' + form + '?fields=info.title' },
    { api: 'Meet REST', scope: 'https://www.googleapis.com/auth/meetings.space.readonly', url: 'https://meet.googleapis.com/v2/conferenceRecords?pageSize=1' },
    { api: 'Search Console', scope: 'https://www.googleapis.com/auth/webmasters.readonly', url: 'https://www.googleapis.com/webmasters/v3/sites' },
    { api: 'Admin Reports', scope: 'https://www.googleapis.com/auth/admin.reports.audit.readonly', url: 'https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/login?maxResults=1' },
    { api: 'Directory groups', scope: 'https://www.googleapis.com/auth/admin.directory.group', url: 'https://admin.googleapis.com/admin/directory/v1/groups?customer=my_customer&maxResults=1' },
    { api: 'Tasks', scope: 'https://www.googleapis.com/auth/tasks', url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1' },
    { api: 'Calendar', scope: 'https://www.googleapis.com/auth/calendar.events', url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1' },
    { api: 'Drive labels (read)', scope: 'https://www.googleapis.com/auth/drive.labels.readonly', url: 'https://drivelabels.googleapis.com/v2/labels?view=LABEL_VIEW_BASIC&pageSize=5' },
    { api: 'Drive labels (admin)', scope: 'https://www.googleapis.com/auth/drive.admin.labels', url: 'https://drivelabels.googleapis.com/v2/labels?useAdminAccess=true&view=LABEL_VIEW_BASIC&pageSize=5' },
  ];
  const out: Row[] = [];
  for (const t of tests) {
    const row: Row = { api: t.api, scope: t.scope.replace('https://www.googleapis.com/auth/', '') };
    try {
      const tk = await tokenFor(t.scope);
      row.delegated = true;
      if (/\/(documents|presentations|spreadsheets|forms)\/(\?|$)/.test(t.url)) { row.ok = null; row.note = 'no file of that type to test with'; out.push(row); continue; }
      const res = await fetch(t.url, { headers: { Authorization: 'Bearer ' + tk } });
      const txt = await res.text();
      row.status = res.status; row.ok = res.ok;
      if (!res.ok) { let m = txt; try { m = JSON.parse(txt)?.error?.message || txt; } catch (_) { /* text */ } row.note = String(m).slice(0, 220); }
      else { let n = ''; try { const j = JSON.parse(txt); n = j.title || j.info?.title || j.properties?.title || (j.siteEntry ? j.siteEntry.length + ' site(s)' : '') || (j.items ? j.items.length + ' item(s)' : '') || (j.conferenceRecords ? j.conferenceRecords.length + ' meeting record(s)' : '') || (j.labels ? j.labels.length + ' label(s)' : '') || (j.user?.emailAddress ? j.user.emailAddress + (j.storageQuota?.limit ? ', storage limit ' + Math.round(Number(j.storageQuota.limit) / 1099511627776) + ' TB' : ', no storage limit') : ''); } catch (_) { n = ''; } row.note = n ? String(n).slice(0, 80) : 'answered'; }
    } catch (e) { row.delegated = false; row.ok = false; row.note = String((e as Error).message || e).slice(0, 220); }
    out.push(row);
  }
  return out;
}
async function gget(url: string): Promise<Row> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + await token() } });
    if (res.status === 429 || res.status >= 500) { await res.body?.cancel(); await sleep(1500 * (attempt + 1)); continue; }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status + ' ' + String(body?.error?.message || '').slice(0, 200));
    return body;
  }
  throw new Error('Google kept failing for ' + url.split('?')[0]);
}
/* the raw body (an export or a download) */
async function graw(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + await token() } });
    if (res.status === 429 || res.status >= 500) { await res.body?.cancel(); await sleep(1500 * (attempt + 1)); continue; }
    if (!res.ok) { const t = await res.text().catch(() => ''); let m = t; try { m = JSON.parse(t)?.error?.message || t; } catch (_) { /* text */ } throw new Error(res.status + ' ' + String(m).slice(0, 200)); }
    return res;
  }
  throw new Error('Google kept failing for ' + url.split('?')[0]);
}

async function state(patch: Row) { await svc.from('drive_mine_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1); }

/* ---- the pass ---- */
async function listInto(q: string, source: string, driveId: string | null, driveName: string | null, seen: Set<string>): Promise<number> {
  let pageToken = '', n = 0;
  for (let page = 0; page < 200; page++) {
    const url = API + '/files?pageSize=1000&supportsAllDrives=true&fields=' + encodeURIComponent(FIELDS) + '&q=' + encodeURIComponent(q) +
      (driveId ? '&corpora=drive&driveId=' + encodeURIComponent(driveId) + '&includeItemsFromAllDrives=true' : '&corpora=user&includeItemsFromAllDrives=false') +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const b = await gget(url);
    const rows = ((b.files || []) as Row[]).filter(f => !seen.has(f.id)).map(f => {
      seen.add(f.id);
      return {
        file_id: f.id, name: String(f.name || ''), mime: String(f.mimeType || ''), drive_id: f.driveId || driveId || null, drive_name: driveName,
        parent_id: (f.parents || [])[0] || null, owner_email: ((f.owners || [])[0] || {}).emailAddress || null,
        created_time: f.createdTime || null, modified_time: f.modifiedTime || null, size: f.size ? Number(f.size) : null,
        web_url: f.webViewLink || null, source, trashed: !!f.trashed, seen_at: new Date().toISOString(),
        shortcut_target: f.shortcutDetails?.targetId || null,
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await svc.from('drive_inventory').upsert(rows.slice(i, i + 500), { onConflict: 'file_id' });
      if (error) throw new Error('inventory write: ' + error.message);
    }
    n += rows.length;
    pageToken = String(b.nextPageToken || '');
    if (!pageToken) break;
  }
  return n;
}
async function inventory(by: string) {
  const started = new Date().toISOString();
  await state({ status: 'running', started_at: started, finished_at: null, error: null, progress: { step: 'shared drives' } });
  try {
    const seen = new Set<string>();
    /* shared drives: those Steel belongs to, and every drive in the domain (names only for the rest) */
    const member: Row[] = [], all: Row[] = [];
    let pt = '';
    for (let i = 0; i < 20; i++) { const b = await gget(API + '/drives?pageSize=100&fields=nextPageToken,drives(id,name,createdTime)' + (pt ? '&pageToken=' + encodeURIComponent(pt) : '')); member.push(...(b.drives || [])); pt = String(b.nextPageToken || ''); if (!pt) break; }
    pt = '';
    try { for (let i = 0; i < 20; i++) { const b = await gget(API + '/drives?pageSize=100&useDomainAdminAccess=true&fields=nextPageToken,drives(id,name,createdTime)' + (pt ? '&pageToken=' + encodeURIComponent(pt) : '')); all.push(...(b.drives || [])); pt = String(b.nextPageToken || ''); if (!pt) break; } } catch (_) { /* not an admin view */ }
    const memberIds = new Set(member.map(d => d.id));
    const drives = member.map(d => ({ id: d.id, name: d.name, created: d.createdTime, member: true }))
      .concat(all.filter(d => !memberIds.has(d.id)).map(d => ({ id: d.id, name: d.name, created: d.createdTime, member: false })));
    const counts: Row = {};
    for (const d of drives) {
      if (!d.member) { counts[d.name] = 'not a member (not listed)'; continue; }
      await state({ progress: { step: 'drive', drive: d.name, done: Object.keys(counts).length, of: drives.length } });
      try { counts[d.name] = await listInto('trashed = false', 'shared_drive', d.id, d.name, seen); }
      catch (e) { counts[d.name] = 'error: ' + String((e as Error).message || e).slice(0, 160); }
    }
    await state({ progress: { step: 'my drive and shared with me', drives: counts } });
    let mine = 0, shared = 0;
    try { mine = await listInto("'me' in owners and trashed = false", 'my_drive', null, null, seen); } catch (e) { counts['(my drive)'] = 'error: ' + String((e as Error).message || e).slice(0, 160); }
    try { shared = await listInto('sharedWithMe = true and trashed = false', 'shared_with_me', null, null, seen); } catch (e) { counts['(shared with me)'] = 'error: ' + String((e as Error).message || e).slice(0, 160); }
    /* folder paths, from the folders just listed */
    const { error: pe } = await svc.rpc('drive_inventory_paths');
    const result = { drives: counts, drive_list: drives.map(d => ({ name: d.name, member: d.member, created: d.created })), my_drive: mine, shared_with_me: shared, files: seen.size, paths_error: pe ? pe.message : null };
    await state({ status: 'done', finished_at: new Date().toISOString(), progress: result });
    await svc.from('change_log').insert({ entity_type: 'drive_mine', entity_id: 'inventory', field: 'ran', old_value: null, new_value: seen.size + ' files listed (' + drives.filter(d => d.member).length + ' shared drives)', changed_by: by });
  } catch (e) {
    await state({ status: 'error', finished_at: new Date().toISOString(), error: String((e as Error).message || e).slice(0, 400) });
  }
}

/* ======================= v2: the mining pipeline ======================= */
const ABOUT = 'Welfare Avenue (WA) is a youth-powered charity in Montreal (and Toronto): Sunday servings of free hot meals from a tent downtown, holiday gifts, and volunteer programs. It started in March 2020.';
const MAX_TEXT = 120000;      // stored per document
const MINE_TEXT = 70000;      // sent to the model per part
const MAX_PARTS = 4;          // a longer document is read in up to four parts, side by side
const MAX_PDF = 16_000_000;   // bytes (the request to the model stays under its 32 MB limit)
const BUDGET_USD = 15;        // a run pauses itself past this
const HOP_MS = 105000;        // a worker stops claiming after this
const EST: Record<string, number> = { extract: 25000, screen: 15000, mine: 80000, check: 45000 };
const BATCH: Record<string, number> = { extract: 6, screen: 8, mine: 3, check: 3 };
const PAR: Record<string, number> = { extract: 3, screen: 4, mine: 3, check: 3 };
const GDOC = 'application/vnd.google-apps.document', GSLIDES = 'application/vnd.google-apps.presentation', GSHEET = 'application/vnd.google-apps.spreadsheet';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF = 'application/pdf';
const CANVA = 'application/vnd.canva.design';

function kindOf(mime: string): string {
  return ({ [GDOC]: 'Google Doc', [GSLIDES]: 'Google Slides', [GSHEET]: 'Google Sheet', [DOCX]: 'Word document', [PPTX]: 'PowerPoint', [XLSX]: 'Excel workbook', [PDF]: 'PDF', [CANVA]: 'Canva design', 'text/plain': 'text' } as Record<string, string>)[mime] || mime;
}
function day(t: unknown): string | null { return typeof t === 'string' && t.length >= 10 ? t.slice(0, 10) : null; }
function tidy(t: string): string { return t.replace(/\r/g, '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
async function sha(t: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t.toLowerCase().replace(/\s+/g, ' ').slice(0, 40000))));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/* ---- text out of Office files (only the parts that hold text are unzipped) ---- */
function xmlDecode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
}
function docxText(xml: string): string {
  return xmlDecode(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''));
}
function drawingText(xml: string): string {
  const out: string[] = [];
  for (const para of xml.split(/<\/a:p>/)) {
    const t = [...para.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map(m => m[1]).join('');
    if (t.trim()) out.push(xmlDecode(t));
  }
  return out.join('\n');
}
const num = (name: string) => Number((name.match(/(\d+)\.xml$/) || [])[1] || 0);
function officeText(bytes: Uint8Array, mime: string): string {
  if (mime === DOCX) {
    const f = unzipSync(bytes, { filter: e => e.name === 'word/document.xml' });
    return f['word/document.xml'] ? docxText(strFromU8(f['word/document.xml'])) : '';
  }
  if (mime === PPTX) {
    const f = unzipSync(bytes, { filter: e => /^ppt\/(slides|notesSlides)\/(slide|notesSlide)\d+\.xml$/.test(e.name) });
    const slides = Object.keys(f).filter(n => n.startsWith('ppt/slides/')).sort((a, b) => num(a) - num(b));
    return slides.map(n => {
      const notes = f['ppt/notesSlides/notesSlide' + num(n) + '.xml'];
      const nt = notes ? drawingText(strFromU8(notes)).replace(/^\d+$/gm, '').trim() : '';
      return '--- slide ' + num(n) + ' ---\n' + drawingText(strFromU8(f[n])) + (nt ? '\n(notes) ' + nt : '');
    }).join('\n\n');
  }
  if (mime === XLSX) {
    const f = unzipSync(bytes, { filter: e => e.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name) });
    const ss = f['xl/sharedStrings.xml'] ? [...strFromU8(f['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlDecode(m[1].replace(/<[^>]+>/g, ''))) : [];
    const sheets = Object.keys(f).filter(n => n.startsWith('xl/worksheets/')).sort((a, b) => num(a) - num(b)).slice(0, 12);
    return sheets.map(n => {
      const rows = [...strFromU8(f[n]).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].slice(0, 400).map(r =>
        [...r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
          const attrs = c[1] || '', inner = c[2] || '';
          if (/t="s"/.test(attrs)) { const v = (inner.match(/<v>(\d+)<\/v>/) || [])[1]; return v !== undefined ? (ss[Number(v)] || '') : ''; }
          if (/t="inlineStr"/.test(attrs)) return xmlDecode(inner.replace(/<[^>]+>/g, ''));
          return xmlDecode((inner.match(/<v>([^<]*)<\/v>/) || [])[1] || '');
        }).filter(x => x !== '').join(' | ')).filter(Boolean);
      return '## sheet ' + num(n) + '\n' + rows.join('\n');
    }).join('\n\n');
  }
  return '';
}

/* ---- extract: the text of one document ---- */
async function extract(f: Row): Promise<{ text: string; method: string; note?: string }> {
  const id = encodeURIComponent(f.file_id);
  if (f.mime === GDOC || f.mime === GSLIDES) {
    const res = await graw(API + '/files/' + id + '/export?mimeType=text/plain');
    return { text: await res.text(), method: 'export' };
  }
  if (f.mime === GSHEET) {
    // the Sheets API gives the values as people see them (dates as dates); the Excel export is the fallback
    try {
      const meta = await gget(SHEETS + id + '?fields=' + encodeURIComponent('sheets.properties(title)'));
      const titles = ((meta.sheets || []) as Row[]).map(x => String(x.properties?.title || '')).filter(Boolean).slice(0, 12);
      if (!titles.length) return { text: '', method: 'sheets' };
      const ranges = titles.map(t => 'ranges=' + encodeURIComponent("'" + t.replace(/'/g, "''") + "'!A1:Z400")).join('&');
      const vals = await gget(SHEETS + id + '/values:batchGet?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&' + ranges);
      const parts = ((vals.valueRanges || []) as Row[]).map((vr, i) => '## ' + titles[i] + '\n' + ((vr.values || []) as unknown[][]).map(r => r.map(c => String(c ?? '')).filter(c => c !== '').join(' | ')).filter(Boolean).join('\n'));
      return { text: parts.join('\n\n'), method: 'sheets' };
    } catch (_) {
      const res = await graw(API + '/files/' + id + '/export?mimeType=' + encodeURIComponent(XLSX));
      return { text: officeText(new Uint8Array(await res.arrayBuffer()), XLSX), method: 'export-xlsx' };
    }
  }
  if (f.mime === PDF) {
    // read by the model itself (text and scans); nothing to store
    if (f.size && Number(f.size) > MAX_PDF) return { text: '', method: 'pdf', note: 'PDF over 16 MB' };
    return { text: '', method: 'pdf' };
  }
  if (f.mime === DOCX || f.mime === PPTX || f.mime === XLSX || f.mime === 'text/plain') {
    if (f.size && Number(f.size) > 25_000_000) return { text: '', method: 'office', note: 'file over 25 MB' };
    const res = await graw(API + '/files/' + id + '?alt=media&supportsAllDrives=true');
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (f.mime === 'text/plain') return { text: new TextDecoder().decode(bytes), method: 'download' };
    return { text: officeText(bytes, f.mime), method: 'unzip' };
  }
  return { text: '', method: 'none', note: 'type not read: ' + f.mime };
}

/* ---- the router for the extraction (a forced tool call); Jev directly ---- */
// Calls from one function to another share a trace, and Supabase limits how many a trace may make: the extraction
// (one call per document) goes through the llm router; Jev (many small calls) goes straight to OpenRouter and is
// logged to ai_calls here, the same way the router logs.
function retryAfter(msg: string): number { const m = msg.match(/retry after (\d+)\s*ms/i); return m ? Math.min(20000, Number(m[1]) + 300) : 0; }
async function routerChat(task: string, body: Row): Promise<Row> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
        method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': task, 'x-wa-caller': 'drive-mine', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    } catch (e) {
      const msg = String((e as Error).message || e);
      const wait = retryAfter(msg);
      if (wait && attempt < 2) { await sleep(wait); continue; }
      throw new Error('router: ' + msg.slice(0, 300));
    }
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.type === 'error') throw new Error('router: ' + String(out?.error?.message || res.status).slice(0, 300));
    return out;
  }
  throw new Error('router: rate limited');
}
const JEV = '~typesafe/jev-latest';
let OR_KEY: string | null = null;
type Answer = { choice?: string; noul?: number; confidence?: number; probabilities?: Record<string, number> };
let JEV_LAST = '';
async function jev(task: string, st: unknown, questions: Row): Promise<Record<string, Answer> | null> {
  if (!OR_KEY) { try { OR_KEY = await getSecret('OPENROUTER_API_KEY'); } catch (_) { JEV_LAST = 'no OpenRouter key'; return null; } }
  const pause = [700, 2000, 5000];
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://wa-exec-dashboard.netlify.app', 'X-Title': 'Welfare Avenue Hub' },
        body: JSON.stringify({ model: JEV, state: st, questions })
      });
      const body = await res.text();
      const ms = Date.now() - t0;
      if (res.ok) {
        let out: Row | null = null; try { out = JSON.parse(body); } catch (_) { out = null; }
        if (out && out.answers) {
          const u = (out.usage || {}) as Row;
          svc.from('ai_calls').insert({ task, caller: 'drive-mine', requested_model: JEV, model: out.model || JEV, ok: true, status: 200, ms, input_tokens: typeof u.input_tokens === 'number' ? u.input_tokens : null, output_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : null, cost: typeof u.cost === 'number' ? u.cost : null }).then(() => null, () => null);
          return out.answers as Record<string, Answer>;
        }
        JEV_LAST = 'no answers: ' + body.slice(0, 160);
      } else {
        JEV_LAST = 'Jev ' + res.status + ': ' + body.slice(0, 160);
        svc.from('ai_calls').insert({ task, caller: 'drive-mine', requested_model: JEV, ok: false, status: res.status, ms, error: JEV_LAST.slice(0, 500) }).then(() => null, () => null);
        if (res.status === 401 || res.status === 402) return null;
      }
    } catch (e) { JEV_LAST = 'fetch: ' + String((e as Error).message || e).slice(0, 160); }
    if (attempt < 3) await sleep(pause[attempt] + (/429|rate/i.test(JEV_LAST) ? 3000 : 0));
  }
  return null;
}
const noul = (a?: Answer) => (a && typeof a.noul === 'number') ? Math.round(a.noul * 1000) / 1000 : null;

/* ---- screen: Jev's keep / skip / private ---- */
const PRIVATE_KINDS: Record<string, string> = {
  none: 'Nothing private: ordinary charity work, plans, events, partners, guides or reports, even when people are named in their roles',
  hr: 'Mainly about a named staff member or volunteer: their performance, pay, contract, discipline, health, or a hiring decision about them',
  donor: 'Mainly named individual donors or what individual people gave',
  personal: 'Someone’s personal life, personal finances or school coursework, or work for another employer',
  money: 'Bank, tax, payroll or account details',
  credentials: 'Passwords, logins or access codes',
  transition: 'Plans or talks about Steel MacDonald or Suhaib stepping down, moving to the board, or handing over their role',
};
const SENS: Record<string, string> = { hr: 'hr', donor: 'donor', personal: 'personal', money: 'leadership', credentials: 'leadership', transition: 'transition', other_employer: 'personal', board: 'board' };
function excerptFor(text: string): string {
  const t = tidy(text);
  if (t.length <= 3400) return t;
  const mid = Math.floor(t.length / 2);
  return t.slice(0, 2200) + '\n[...]\n' + t.slice(mid, mid + 1200);
}
async function markPrivate(fileId: string, kinds: string[], why: string) {
  const k = kinds.find(x => SENS[x]) || 'personal';
  await svc.from('drive_inventory').update({ triage: 'private', sensitivity: SENS[k] || 'personal', triage_reason: why.slice(0, 300) }).eq('file_id', fileId);
  await svc.from('drive_text').delete().eq('file_id', fileId);
}
async function screen(f: Row, m: Row): Promise<Row> {
  const { data: tx } = await svc.from('drive_text').select('text,chars,hash,method').eq('file_id', f.file_id).maybeSingle();
  const isPdf = f.mime === PDF;
  if (!isPdf) {
    if (!tx || (tx.chars || 0) < 150) return { stage: 'skipped', error: 'almost no text' };
    if (tx.hash) {
      const { data: twin } = await svc.from('drive_text').select('file_id').eq('hash', tx.hash).lt('file_id', f.file_id).limit(1);
      if (twin && twin.length) return { stage: 'skipped', error: 'same text as ' + twin[0].file_id };
    }
  }
  const st = {
    charity: ABOUT,
    document: { name: f.name, folder: f.path || null, type: kindOf(f.mime), created: day(f.created_time), last_edited: day(f.modified_time), characters: tx?.chars ?? null },
    excerpt: isPdf ? '(A PDF: its text is read later. Judge by the name and the folder.)' : excerptFor(tx!.text),
  };
  const a = await jev('drive_mine_screen', st, {
    keep: { type: 'noul', instructions: 'Would this document help the Hub know or teach something about Welfare Avenue itself: an event it held or took part in, a program it ran, a grant or sponsorship it applied for or received, an organisation it worked with, a registration or governance step, what it learned, or a guide, plan, pitch or template the team could reuse? Past planning documents count, because they show that an event happened. Blank templates, receipts, invoices, other organisations’ own material, class assignments and personal files do not count.' },
    private: { type: 'choice', instructions: 'Is the document mainly private in one of these ways? Pick "none" for ordinary charity work.', criteria: PRIVATE_KINDS },
  });
  if (!a) throw new Error('Jev did not answer (' + JEV_LAST + ')');
  const keep = noul(a.keep);
  const pc = a.private?.choice || 'none';
  const pp = a.private?.probabilities?.[pc] ?? a.private?.confidence ?? 0;
  const screenOut = { keep, private: pc, private_p: Math.round(Number(pp) * 1000) / 1000, at: new Date().toISOString() };
  if (pc !== 'none' && pp >= 0.6) {
    await markPrivate(f.file_id, [pc], 'Jev: private (' + pc + ', ' + Math.round(pp * 100) + '%)');
    return { stage: 'private', screen: screenOut };
  }
  // Jev is cautious about old planning documents: a file the name rules already called gold is only dropped when it is clearly empty of value
  const bar = f.triage === 'gold' ? 0.1 : 0.35;
  if (keep !== null && keep < bar) return { stage: 'skipped', screen: screenOut, error: 'Jev: nothing to keep (' + Math.round(keep * 100) + '%)' };
  return { stage: 'mine', screen: screenOut };
}

/* ---- mine: the extraction, one forced tool call ---- */
const SYSTEM = [
  'You read one document from Welfare Avenue’s files and record what is worth keeping in the Hub, the charity’s internal site. ' + ABOUT,
  'The Hub is building: a timeline of what Welfare Avenue has done since March 2020, the organisations it has worked with, the lessons it has learned, and the resources it has made that the team can reuse.',
  'Record only what this document shows. Every item carries a short exact quote from the document (copied word for word, in the document’s own language, under 200 characters) that supports it. If nothing is worth keeping (a blank template, a form, someone else’s material, a class assignment, logistics that no longer matter), set skip to true.',
  'Keep out, always: anything about a named person’s performance, pay, contract, discipline, health or personal life; individual donors’ names or amounts; bank, tax or account details; passwords, logins, door or lock codes; phone numbers, personal emails and home addresses; any plan or talk of Steel MacDonald or Suhaib stepping down, moving to the board or handing over their role; anything about the writer’s other employer or studies. Leave those details out and record the rest. Set private to true only when most of the document is that kind of content (an appraisal, a pay or donor list, someone’s personal file); a report or recap that credits people for their work, or mentions in passing that someone joined, left or was away, is not private. People may be named in their roles (for example "Steel MacDonald, founder"), never in connection with performance, pay, discipline, health or personal matters.',
  'Dates: give when the thing happened (YYYY-MM-DD, YYYY-MM or YYYY), not when the document was written, unless the document date is the only evidence; say which in date_basis. For something that ran over a period (a program, a season, "2020 to 2022"), date is its start and date_end its end. Meeting notes, agendas and plans mostly describe intentions: mark those happened = "planned" unless the text says it took place. Numbers only when the document states them: leave out every number it does not give (never 0 for unknown).',
  'Write titles and summaries in plain English, even for a French document: specific (what, where, with whom, how many), one or two sentences. Partners are organisations, never private individuals. Do not use em dashes; use commas, colons or parentheses. Do not invent: leave a field out when the document does not say.',
  'At most 25 events, 25 partners, 12 lessons and 12 facts: the most significant ones.'
].join('\n\n');
const S = (description?: string) => description ? { type: 'string', description } : { type: 'string' };
const TOOL = {
  name: 'record_findings',
  description: 'Record what is worth keeping from the document.',
  input_schema: {
    type: 'object',
    properties: {
      skip: { type: 'boolean', description: 'true when nothing in the document is worth keeping' },
      skip_reason: S(),
      private: { type: 'boolean', description: 'true when the document is mostly private content (see the rules)' },
      private_kinds: { type: 'array', items: { type: 'string', enum: ['hr', 'donor', 'personal', 'money', 'credentials', 'transition', 'other_employer'] } },
      doc: {
        type: 'object',
        properties: {
          date: S('when the document was written or covers: YYYY-MM-DD, YYYY-MM or YYYY'),
          date_basis: S('how you know the date'),
          kind: { type: 'string', enum: ['meeting notes', 'plan', 'report', 'proposal', 'guide', 'presentation', 'letter', 'newsletter', 'application', 'list', 'posts', 'other'] },
          summary: S('two sentences: what the document is and what it shows about Welfare Avenue'),
          language: { type: 'string', enum: ['en', 'fr', 'mixed'] },
          department: S('the team it belongs to, if clear (Operations, Marketing, Fundraising, Programs, HR, Finance, Board, Leadership)'),
        },
      },
      resource: {
        type: 'object',
        description: 'whether the document itself is a resource the team could reuse today (a guide, template, checklist, policy, plan, deck, script, list)',
        properties: {
          yes: { type: 'boolean' }, title: S('a clear name for it'), what: S('one sentence: what it helps someone do'),
          kind: { type: 'string', enum: ['guide', 'template', 'checklist', 'policy', 'plan', 'deck', 'list', 'report', 'script', 'form', 'other'] },
          department: S(), still_useful: { type: 'boolean', description: 'false when it is clearly out of date' },
        },
      },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: S('YYYY-MM-DD, YYYY-MM or YYYY'), date_end: S('for a period: when it ended (YYYY-MM-DD, YYYY-MM or YYYY)'), date_basis: { type: 'string', enum: ['stated', 'document date', 'inferred'] },
            title: S('a short headline, e.g. "First Sunday serving at Cabot Square"'), summary: S('one or two specific sentences'),
            kind: { type: 'string', enum: ['milestone', 'event', 'program', 'partnership', 'funding', 'recognition', 'governance', 'team', 'media', 'expansion'] },
            happened: { type: 'string', enum: ['happened', 'planned', 'unclear'] },
            city: S(), partners: { type: 'array', items: { type: 'string' } },
            numbers: { type: 'object', properties: { meals: { type: 'number' }, volunteers: { type: 'number' }, people_helped: { type: 'number' }, raised_cad: { type: 'number' }, attendees: { type: 'number' }, other: S() } },
            link: S('a URL the document gives for this event (a post, a page), if any'),
            quote: S(),
          },
          required: ['date', 'title', 'summary', 'kind', 'happened', 'quote'],
        },
      },
      partners: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: S('the organisation’s name as it is usually written'),
            kind: { type: 'string', enum: ['nonprofit', 'business', 'school', 'university', 'student club', 'government', 'funder', 'media', 'community group', 'faith group', 'other'] },
            city: S(),
            relationship: { type: 'string', enum: ['partner', 'sponsor', 'funder', 'donor organisation', 'venue', 'supplier', 'collaborator', 'prospect', 'declined', 'former'] },
            what: S('what they did with or for Welfare Avenue'), when: S('year or period'), contact_role: S('the role of the contact there, never a private phone or email'),
            quote: S(),
          },
          required: ['name', 'relationship', 'what', 'quote'],
        },
      },
      learnings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic: S(), lesson: S('the lesson, as advice the team could act on'), context: S('what happened that taught it'),
            area: { type: 'string', enum: ['events', 'volunteers', 'food and meals', 'fundraising', 'partnerships', 'marketing', 'operations', 'governance', 'programs', 'team', 'other'] },
            year: S(), quote: S(),
          },
          required: ['lesson', 'area', 'quote'],
        },
      },
      facts: {
        type: 'array',
        items: { type: 'object', properties: { topic: S(), fact: S(), as_of: S('the date the fact was true'), quote: S() }, required: ['fact', 'quote'] },
      },
    },
    required: ['skip', 'private', 'doc', 'events', 'partners', 'learnings', 'facts'],
  },
};
async function mine(f: Row, m: Row): Promise<Row> {
  const header = 'Document: ' + f.name + '\nWhere: ' + (f.path || f.source) + '\nType: ' + kindOf(f.mime) +
    '\nCreated: ' + (day(f.created_time) || 'unknown') + ' · Last edited: ' + (day(f.modified_time) || 'unknown');
  let task = 'drive_mine';
  // deno-lint-ignore no-explicit-any
  let content: any;
  if (f.mime === PDF) {
    if (f.size && Number(f.size) > MAX_PDF) return { stage: 'skipped', error: 'PDF over 16 MB' };
    const res = await graw(API + '/files/' + encodeURIComponent(f.file_id) + '?alt=media&supportsAllDrives=true');
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_PDF) return { stage: 'skipped', error: 'PDF over 16 MB' };
    task = 'drive_mine_pdf';
    content = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: encodeBase64(bytes) } }, { type: 'text', text: header + '\n\nThe document is attached. Record its findings.' }];
  } else {
    const { data: tx } = await svc.from('drive_text').select('text').eq('file_id', f.file_id).maybeSingle();
    const text = tidy(String(tx?.text || ''));
    if (text.length < 150) return { stage: 'skipped', error: 'almost no text' };
    const parts = splitParts(text);
    if (parts.length > 1) {
      const outs = await Promise.all(parts.map((p, k) => routerChat(task, { max_tokens: 6000, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: 'record_findings' },
        messages: [{ role: 'user', content: header + '\n(A long document, read in ' + parts.length + ' parts: this is part ' + (k + 1) + ' of ' + parts.length + (text.length > MINE_TEXT * MAX_PARTS ? '; the end of the document is not included' : '') + '.)\n\n' + p }] }).catch(() => null)));
      const got = outs.filter(Boolean) as Row[];
      if (!got.length) throw new Error('no part of the long document was read');
      const rs = got.map(o => (((o.content || []) as Row[]).find(b => b && b.type === 'tool_use') || {}).input as Row).filter(Boolean);
      if (!rs.length) throw new Error('no findings in the replies');
      const merged: Row = { ...rs[0], parts: parts.length, parts_read: rs.length };
      for (const k of ['events', 'partners', 'learnings', 'facts']) merged[k] = rs.flatMap(x => Array.isArray(x[k]) ? x[k] : []);
      merged.private = rs.filter(x => x.private === true).length > rs.length / 2;
      merged.private_kinds = [...new Set(rs.flatMap(x => Array.isArray(x.private_kinds) ? x.private_kinds : []))];
      merged.skip = rs.every(x => x.skip === true);
      const cost = got.reduce((s0, o) => s0 + (typeof o._wa?.cost === 'number' ? o._wa.cost : 0), 0);
      return finish(f, merged, { model: String(got[0]._wa?.model || ''), cost }, m.screen);
    }
    content = header + '\n\n' + text;
  }
  const out = await routerChat(task, { max_tokens: 6000, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: 'record_findings' }, messages: [{ role: 'user', content }] });
  const tu = ((out.content || []) as Row[]).find(b => b && b.type === 'tool_use');
  if (!tu || !tu.input) throw new Error('no findings in the reply');
  return finish(f, tu.input as Row, { model: out._wa?.model || null, cost: typeof out._wa?.cost === 'number' ? out._wa.cost : null }, m.screen);
}
function splitParts(text: string): string[] {
  if (text.length <= MINE_TEXT) return [text];
  const parts: string[] = [];
  let at = 0;
  while (at < text.length && parts.length < MAX_PARTS) {
    let end = Math.min(text.length, at + MINE_TEXT);
    if (end < text.length) { const cut = text.lastIndexOf('\n\n', end); if (cut > at + MINE_TEXT * 0.6) end = cut; }
    parts.push(text.slice(at, end)); at = end;
  }
  return parts;
}
async function finish(f: Row, r: Row, meta: { model: string | null; cost: number | null }, screenOut?: Row | null): Promise<Row> {
  if (r.private === true && screenOut && screenOut.private === 'none' && Number(screenOut.private_p) >= 0.9) {
    // the model and Jev disagree: hold it for a person to look at, keep the text, record nothing
    return { stage: 'private', result: { private: true, private_kinds: r.private_kinds || [], disputed: true }, error: 'disputed: the model says private (' + (Array.isArray(r.private_kinds) ? r.private_kinds.join(', ') : '') + '), Jev said not private', ...meta };
  }
  if (r.private === true) {
    await markPrivate(f.file_id, Array.isArray(r.private_kinds) ? r.private_kinds : [], 'the model: private (' + (Array.isArray(r.private_kinds) ? r.private_kinds.join(', ') : 'unspecified') + ')');
    return { stage: 'private', result: { private: true, private_kinds: r.private_kinds || [] }, ...meta };
  }
  if (r.skip === true) return { stage: 'skipped', result: r, error: 'the model: ' + String(r.skip_reason || 'nothing to keep').slice(0, 200), ...meta };
  return { stage: 'check', result: r, ...meta };
}

/* ---- check: Jev on each event, partner and lesson, against the lines around its quote ---- */
function flat(t: string): string { return t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' '); }
function around(text: string, quote: string): string | null {
  if (!text || !quote) return null;
  const T = flat(text), q = flat(quote).replace(/^["'\s.]+|["'\s.]+$/g, '');
  if (q.length < 8) return null;
  let i = T.indexOf(q);
  if (i < 0) i = T.indexOf(q.slice(0, 50));
  if (i < 0 && q.length > 60) i = T.indexOf(q.slice(-50));
  if (i < 0) return null;
  return T.slice(Math.max(0, i - 700), i + q.length + 700);
}
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const x = items[k++]; await fn(x); } }));
}
async function check(f: Row, m: Row): Promise<Row> {
  const r = (m.result || {}) as Row;
  const { data: tx } = await svc.from('drive_text').select('text').eq('file_id', f.file_id).maybeSingle();
  const text = String(tx?.text || '');
  const docDate = String(r.doc?.date || day(f.created_time) || 'unknown');
  const jobs: { kind: string; i: number; st: Row; q: Row }[] = [];
  const doc = { name: f.name, date: docDate };
  (Array.isArray(r.events) ? r.events : []).forEach((e: Row, i: number) => {
    if (e.happened === 'planned') return;
    const ex = around(text, String(e.quote || ''));
    jobs.push({ kind: 'event', i, st: { charity: ABOUT, document: doc, item: { what: e.title, summary: e.summary, date: e.date, happened: e.happened }, excerpt: ex ?? ('(Only the quote is available) "' + String(e.quote || '') + '"') }, q: {
      supported: { type: 'noul', instructions: 'Does the excerpt show that this took place as described (it happened, was held, launched, signed or received), rather than being planned, proposed or hoped for?' },
      date_ok: { type: 'noul', instructions: 'Is ' + String(e.date || 'the given date') + ' right for it, going by the excerpt and the document date (' + docDate + ')? The same month counts; when only a year is given, the same year.' },
    } });
  });
  (Array.isArray(r.partners) ? r.partners : []).forEach((p: Row, i: number) => {
    if (p.relationship === 'prospect' || p.relationship === 'declined') return;
    const ex = around(text, String(p.quote || ''));
    jobs.push({ kind: 'partner', i, st: { charity: ABOUT, document: doc, organisation: { name: p.name, relationship: p.relationship, what: p.what, when: p.when }, excerpt: ex ?? ('(Only the quote is available) "' + String(p.quote || '') + '"') }, q: {
      real: { type: 'noul', instructions: 'Does the excerpt show that Welfare Avenue actually worked with ' + String(p.name) + ' (a partnership, sponsorship, donation, grant, venue or joint event), rather than only planning to contact, pitch or apply to them?' },
    } });
  });
  (Array.isArray(r.learnings) ? r.learnings : []).forEach((l: Row, i: number) => {
    const ex = around(text, String(l.quote || ''));
    jobs.push({ kind: 'learning', i, st: { charity: ABOUT, document: doc, lesson: { lesson: l.lesson, context: l.context }, excerpt: ex ?? ('(Only the quote is available) "' + String(l.quote || '') + '"') }, q: {
      grounded: { type: 'noul', instructions: 'Is this lesson drawn from something Welfare Avenue actually experienced, as the excerpt shows, rather than a generic statement or a plan?' },
    } });
  });
  const items: Row[] = [];
  let failed = 0;
  await pool(jobs.slice(0, 40), 4, async (j) => {
    const a = await jev('drive_mine_check', j.st, j.q);
    if (!a) { failed += 1; items.push({ kind: j.kind, i: j.i, jev: null }); return; }
    const row: Row = { kind: j.kind, i: j.i, quote_found: text ? (j.st.excerpt as string).startsWith('(Only') ? false : true : null };
    for (const k of Object.keys(j.q)) row[k] = noul(a[k]);
    items.push(row);
  });
  if (jobs.length && failed === Math.min(jobs.length, 40)) throw new Error('Jev did not answer the checks');
  items.sort((a, b) => (a.kind + String(a.i).padStart(3, '0')).localeCompare(b.kind + String(b.i).padStart(3, '0')));
  return { stage: 'done', checked: { at: new Date().toISOString(), items, unchecked: Math.max(0, jobs.length - 40) } };
}

/* ---- the worker ---- */
async function step(stage: string, fileId: string) {
  const { data: m } = await svc.from('drive_mined').select('*').eq('file_id', fileId).maybeSingle();
  const { data: f } = await svc.from('drive_inventory').select('*').eq('file_id', fileId).maybeSingle();
  if (!m || !f) return;
  try {
    let out: Row;
    if (stage === 'extract') {
      const x = await extract(f);
      const text = tidy(x.text || '');
      if (x.method !== 'pdf' || text) {
        await svc.from('drive_text').upsert({ file_id: fileId, text: text.slice(0, MAX_TEXT), chars: text.length, hash: text.length >= 150 ? await sha(text) : null, method: x.method, truncated: text.length > MAX_TEXT, error: x.note || null, extracted_at: new Date().toISOString() }, { onConflict: 'file_id' });
      }
      out = x.note ? { stage: 'skipped', error: x.note } : { stage: 'screen' };
    } else if (stage === 'screen') out = await screen(f, m);
    else if (stage === 'mine') out = await mine(f, m);
    else if (stage === 'check') out = await check(f, m);
    else return;
    const patch: Row = { stage: out.stage, status: 'todo', attempts: 0, claimed_at: null, error: out.error ?? null, updated_at: new Date().toISOString() };
    for (const k of ['screen', 'result', 'checked', 'model', 'cost']) if (out[k] !== undefined) patch[k] = out[k];
    await svc.from('drive_mined').update(patch).eq('file_id', fileId);
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    const gone = /^40[34] /.test(msg) || /not found|cannot be exported|exportSizeLimitExceeded|too large/i.test(msg);
    await svc.from('drive_mined').update({ status: 'todo', error: stage + ': ' + msg, updated_at: new Date().toISOString(), ...(gone ? { stage: 'failed' } : {}) }).eq('file_id', fileId);
  }
}
async function spent(since: string | null): Promise<number> {
  if (!since) return 0;
  const { data } = await svc.from('ai_calls').select('cost').like('task', 'drive_mine%').gte('created_at', since).limit(20000);
  return ((data || []) as Row[]).reduce((s, r) => s + (Number(r.cost) || 0), 0);
}
async function counts(): Promise<Row> {
  const { data } = await svc.from('drive_mined').select('stage,status');
  const c: Row = {};
  for (const r of (data || []) as Row[]) { const k = r.stage + (r.status === 'doing' ? ' (working)' : ''); c[k] = (c[k] || 0) + 1; }
  return c;
}
async function work() {
  const t0 = Date.now();
  const { data: st } = await svc.from('drive_mine_state').select('status,started_at').eq('id', 1).maybeSingle();
  if (!st || st.status !== 'mining') return;
  const usd = await spent(st.started_at);
  if (usd > BUDGET_USD) { await state({ status: 'paused', error: 'Stopped at $' + usd.toFixed(2) + ' of AI spend (limit $' + BUDGET_USD + ').' }); await pump(false); return; }
  let did = 0;
  for (let round = 0; round < 60; round++) {
    const left = HOP_MS - (Date.now() - t0);
    let stage = '', ids: string[] = [];
    for (const s of ['check', 'mine', 'screen', 'extract']) {
      if (left < EST[s]) continue;
      const { data } = await svc.rpc('drive_mine_claim', { p_stage: s, p_n: BATCH[s] });
      const got = ((data || []) as Row[]).map(x => String(x.file_id));
      if (got.length) { stage = s; ids = got; break; }
    }
    if (!ids.length) break;
    await pool(ids, PAR[stage], id => step(stage, id));
    did += ids.length;
    if (round % 3 === 2) { const { data: s2 } = await svc.from('drive_mine_state').select('status').eq('id', 1).maybeSingle(); if (!s2 || s2.status !== 'mining') break; }
  }
  if (!did) {
    const c = await counts();
    const open = ['extract', 'screen', 'mine', 'check'].some(s => c[s] || c[s + ' (working)']);
    if (!open) {
      const { data: s3 } = await svc.from('drive_mine_state').select('status').eq('id', 1).maybeSingle();
      if (s3 && s3.status === 'mining') {
        const total = await spent(st.started_at);
        await state({ status: 'done', finished_at: new Date().toISOString(), progress: { counts: c, cost_usd: Math.round(total * 100) / 100 } });
        await pump(false);
        await svc.from('change_log').insert({ entity_type: 'drive_mine', entity_id: 'mining', field: 'ran', old_value: null, new_value: JSON.stringify(c).slice(0, 400) + ' ($' + total.toFixed(2) + ')', changed_by: 'drive-mine' });
      }
    }
  }
}
async function kick(n: number) {
  await Promise.all(Array.from({ length: n }, () => fetch(SUPABASE_URL + '/functions/v1/drive-mine', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'work' })
  }).then(r => r.body?.cancel()).catch(() => null)));
}

function background(p: Promise<unknown>): boolean {
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') { rt.waitUntil(p); return true; }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  let who: string | null = null;
  if ((req.headers.get('Authorization') || '') === 'Bearer ' + SERVICE_KEY) who = 'drive-mine';
  if (!who) { try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) who = 'automation'; } catch (_) { /* no */ } }
  if (!who) who = await adminCaller(req);
  if (!who) return json({ error: 'admins only' }, 401);
  const action = String(body.action || 'status');
  if (action === 'status') {
    const { data: st } = await svc.from('drive_mine_state').select('*').eq('id', 1).maybeSingle();
    const c = await counts();
    const usd = await spent(st?.started_at || null);
    const { data: errs } = await svc.from('drive_mined').select('file_id,stage,error').not('error', 'is', null).in('stage', ['failed', 'extract', 'screen', 'mine', 'check']).order('updated_at', { ascending: false }).limit(12);
    return json({ ok: true, state: st, counts: c, cost_usd: Math.round(usd * 1000) / 1000, recent_errors: errs || [] });
  }
  if (action === 'inventory') {
    const job = inventory(who);
    if (background(job)) return json({ ok: true, started: true });
    await job; return json({ ok: true });
  }
  if (action === 'start') {
    const { data: seeded, error } = await svc.rpc('drive_mine_seed');
    if (error) return json({ error: 'seed: ' + error.message }, 500);
    const { data: st } = await svc.from('drive_mine_state').select('status,started_at').eq('id', 1).maybeSingle();
    const fresh = !st || st.status !== 'mining';
    await state({ status: 'mining', error: null, finished_at: null, ...(fresh && body.keep_clock !== true ? { started_at: new Date().toISOString() } : {}), progress: { seeded, by: who } });
    await pump(true);
    await svc.from('change_log').insert({ entity_type: 'drive_mine', entity_id: 'mining', field: 'started', old_value: null, new_value: seeded + ' documents queued', changed_by: who });
    background(kick(Math.min(6, Math.max(1, Number(body.workers) || 3))));
    return json({ ok: true, queued: seeded, counts: await counts() });
  }
  if (action === 'work') {
    const job = work();
    if (background(job)) return json({ ok: true, working: true });
    await job; return json({ ok: true });
  }
  if (action === 'google_check') {
    const rows = await googleCheck();
    try { await svc.from('change_log').insert({ entity_type: 'google', entity_id: 'api_check', field: 'ran', old_value: null, new_value: rows.map(r => r.api + ': ' + (r.ok ? 'ok' : r.ok === null ? 'untested' : 'no')).join(', ').slice(0, 480), changed_by: who }); } catch (_) { /* audit */ }
    return json({ ok: true, checks: rows });
  }
  if (action === 'labels') {
    return json(await applyLabels(body.dry === true, Number(body.offset) || 0, who));
  }
  if (action === 'stop') {
    await state({ status: 'stopped', error: 'stopped by ' + who });
    await pump(false);
    return json({ ok: true });
  }
  if (action === 'requeue') {
    const ids = (Array.isArray(body.file_ids) ? body.file_ids : []).map(String).filter(Boolean).slice(0, 500);
    const stage = String(body.stage || '');
    if (!ids.length || !['extract', 'screen', 'mine', 'check'].includes(stage)) return json({ error: 'file_ids and a stage (extract, screen, mine, check) are needed' }, 400);
    const { data, error } = await svc.from('drive_mined').update({ stage, status: 'todo', attempts: 0, error: null, claimed_at: null, updated_at: new Date().toISOString() }).in('file_id', ids).select('file_id');
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, requeued: (data || []).length });
  }
  return json({ error: 'unknown action' }, 400);
});
