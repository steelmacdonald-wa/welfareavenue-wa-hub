// Welfare Avenue: drive-pull (v3, 07/08/26)
// v3: incremental text extraction. A Google Doc whose modified_time is
// unchanged since the last sync keeps its stored text instead of being
// re-exported, so each run's ~100s text budget goes to NEW and CHANGED
// docs. Successive runs therefore walk the whole corpus.
// v2: shared-drive aware (corpora=allDrives + drives.list).
// Reads Drive via wa-hub-drive@welfare-avenue-dashboard service account
// (vault GOOGLE_SA_KEY); sees only what is shared with it.
// Auth: staff JWT or x-wa-secret.
// Actions: {action:'list'} | {action:'read', file_id} | {action:'sync'}
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

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
let TOKEN: { value: string; exp: number } | null = null;
async function googleToken(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 60000) return TOKEN.value;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri,
    iat: now, exp: now + 3600
  })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const assertion = signingInput + '.' + b64url(sig);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google token exchange failed: ' + JSON.stringify(body).slice(0, 200));
  TOKEN = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return TOKEN.value;
}

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; driveId?: string };
async function listDrives(token: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50', { headers: { Authorization: 'Bearer ' + token } });
    const body = await res.json();
    return (body.drives || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
  } catch (_) { return []; }
}
async function listFiles(token: string, cap = 1000): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  for (let p = 0; p < 20 && out.length < cap; p++) {
    const params = new URLSearchParams({
      pageSize: '100',
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,driveId)',
      q: 'trashed = false',
      corpora: 'allDrives',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch('https://www.googleapis.com/drive/v3/files?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + token }
    });
    const body = await res.json();
    if (body.error) throw new Error('Drive list failed: ' + (body.error.message || '').slice(0, 200));
    out.push(...(body.files || []));
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}
async function readFileText(token: string, f: DriveFile): Promise<string | null> {
  try {
    if (f.mimeType === 'application/vnd.google-apps.document') {
      const res = await fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '/export?mimeType=text/plain&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
      return res.ok ? (await res.text()).slice(0, 80000) : null;
    }
    if ((f.mimeType || '').startsWith('text/') || f.mimeType === 'application/json') {
      const res = await fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
      return res.ok ? (await res.text()).slice(0, 80000) : null;
    }
    return null;
  } catch (_) { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let caller = await staffEmail(req);
  if (!caller) {
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) caller = 'automation'; } catch (_) { /* no */ }
  }
  if (!caller) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'list');
  try {
    const token = await googleToken();
    if (action === 'list') {
      const [files, drives] = await Promise.all([listFiles(token, 300), listDrives(token)]);
      return json({
        count: files.length, shared_drives: drives,
        files: files.slice(0, 40).map(f => ({ id: f.id, name: f.name, mime: f.mimeType })),
        note: files.length ? undefined : 'The service account sees nothing yet. Share folders (Viewer) or add it as a member of the Shared Drives: wa-hub-drive@welfare-avenue-dashboard.iam.gserviceaccount.com'
      });
    }
    if (action === 'read') {
      const id = String(body.file_id || '');
      if (!id) return json({ error: 'file_id required' }, 400);
      const meta = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,name,mimeType,modifiedTime,webViewLink&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
      const f = await meta.json();
      if (f.error) return json({ error: 'not readable: ' + (f.error.message || '') }, 404);
      const text = await readFileText(token, f);
      return json({ file: f, text, note: text === null ? 'Binary format: metadata only for now.' : undefined });
    }
    if (action === 'sync') {
      const started = Date.now();
      const files = await listFiles(token, 2000);
      /* incremental: docs with unchanged modified_time keep their text */
      const known = new Map<string, string>();
      try {
        const { data: existing } = await svc.from('wa_drive_docs').select('file_id, modified_time').not('text_content', 'is', null);
        (existing || []).forEach((r: { file_id: string; modified_time: string | null }) => known.set(r.file_id, r.modified_time || ''));
      } catch (_) { /* full re-extract as fallback */ }
      let saved = 0, withText = 0, kept = 0;
      for (const f of files) {
        if (f.mimeType === 'application/vnd.google-apps.folder') continue;
        const isDoc = f.mimeType === 'application/vnd.google-apps.document';
        const unchanged = isDoc && known.has(f.id) && new Date(known.get(f.id) || 0).getTime() === new Date(f.modifiedTime || 0).getTime();
        if (unchanged) { kept++; 
          const { error } = await svc.from('wa_drive_docs').update({ name: f.name, url: f.webViewLink || null, synced_at: new Date().toISOString() }).eq('file_id', f.id);
          if (!error) saved++;
          continue;
        }
        let text: string | null = null;
        if (isDoc && Date.now() - started < 100000) {
          text = await readFileText(token, f);
          if (text) withText++;
        }
        const { error } = await svc.from('wa_drive_docs').upsert({
          file_id: f.id, name: f.name, mime: f.mimeType,
          modified_time: f.modifiedTime || null, url: f.webViewLink || null,
          text_content: text, synced_at: new Date().toISOString()
        });
        if (!error) saved++;
      }
      try {
        await svc.from('change_log').insert({
          entity_type: 'drive_pull', entity_id: 'sync', field: 'ran',
          old_value: null, new_value: saved + ' files indexed (' + withText + ' newly extracted, ' + kept + ' texts kept) of ' + files.length + ' visible', changed_by: caller
        });
      } catch (_) { /* audit */ }
      return json({ synced: saved, newly_extracted: withText, texts_kept: kept, total_visible: files.length });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
