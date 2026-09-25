// Welfare Avenue: directory-sync (v1, 25/09/26)
// The roster follows Google Workspace. Reads the welfareavenue.com user
// directory through the service account's domain-wide delegation, acting as
// the hub's admin account (the Directory API only answers an admin), and:
//   - lists every account in public.hub_directory; accounts that match no
//     roster profile by email wait in the "Place on the roster" queue
//     (People and access); shared mailboxes are skipped by rule;
//   - an account suspended, archived or deleted in Workspace marks the
//     matching roster profile inactive (change_log 'team_member/active', which
//     the Executive dashboard shows as a departure); an account the sync
//     deactivated that comes back is reactivated;
//   - Google profile photos fill in for anyone without a hub photo
//     (avatars bucket, google/<member_id>), refreshed when the photo changes.
// Actions (POST; x-wa-secret for the cron, or an admin's JWT):
//   {action:'sync'}                       full pass (cron: wa-directory-sync, daily)
//   {action:'status'}                     last run + the queue
//   {action:'place', email, member_id?}   after People and access created or linked the
//                                         profile: match the account, copy the photo
//   {action:'dismiss', email, undo?}      "Not a person" (shared mailbox, test account)
// Scope the delegation entry (client id 107460787452614031265) must carry:
//   https://www.googleapis.com/auth/admin.directory.user.readonly
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
const SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const ADMIN_ACTOR = 'steel.macdonald@welfareavenue.com';
const DOMAIN = 'welfareavenue.com';
const SHARED = ['hub', 'info', 'org', 'jobs', 'job', 'admin', 'noreply', 'no-reply', 'donations', 'volunteer', 'volunteers', 'contact', 'hello', 'finance', 'grants', 'events', 'marketing', 'hr', 'board', 'team', 'welfareavenue', 'welfare'];
const FALLBACK_ADMINS = ['steel.macdonald', 'suhaib.abdillahi', 'ian.odhiambo', 'valex.sanon', 'tuna.kaynak', 'michael.michailidis'];
const BUCKET = 'avatars';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function adminCaller(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: role } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
  const isAdmin = role?.role === 'admin' || (email.endsWith('@' + DOMAIN) && FALLBACK_ADMINS.indexOf(email.split('@')[0]) >= 0);
  return isAdmin ? email : null;
}
async function staffCaller(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  return email.endsWith('@' + DOMAIN) || email === 'steelmacdonald@gmail.com' ? email : null;
}

/* ---- delegated token (the admin actor) ---- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
async function token(): Promise<string> {
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: ADMIN_ACTOR, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signingInput + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) {
    if (/unauthorized_client|scope|invalid_grant/i.test(JSON.stringify(body))) throw new Error('The hub is not yet allowed to read the Workspace directory. Add ' + SCOPE + ' to the domain-wide delegation entry (client id 107460787452614031265).');
    throw new Error('Google refused: ' + String(body.error_description || body.error || 'delegation failed').slice(0, 200));
  }
  return body.access_token as string;
}
// deno-lint-ignore no-explicit-any
async function gapi(tok: string, url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
  const body = await res.json().catch(() => null);
  if (!res.ok && res.status !== 404) throw new Error('Google ' + url.split('?')[0].replace('https://admin.googleapis.com/admin/directory/v1', '') + ' -> ' + res.status + ' ' + String((body && body.error && body.error.message) || '').slice(0, 200));
  return { status: res.status, body };
}
async function listUsers(tok: string, deleted: boolean): Promise<Row[]> {
  const out: Row[] = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const url = 'https://admin.googleapis.com/admin/directory/v1/users?domain=' + DOMAIN + '&maxResults=200&orderBy=email' + (deleted ? '&showDeleted=true' : '') + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const r = await gapi(tok, url);
    (r.body?.users || []).forEach((u: Row) => out.push(u));
    pageToken = r.body?.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

/* ---- helpers ---- */
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
function isShared(email: string, fullName: string, orgUnit: string): boolean {
  const local = email.split('@')[0];
  if (SHARED.indexOf(local) >= 0) return true;
  if (/shared|mailbox|service/i.test(orgUnit || '')) return true;
  if (/^(hub|info|org|jobs|welfare avenue|welfareavenue|admin|noreply)\b/i.test(fullName || '') && !/\s[A-Z]/.test(fullName || '')) return true;
  return false;
}
async function postSlack(text: string) {
  try { const url = await getSecret('SLACK_WEBHOOK_URL'); await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); } catch (_) { /* fine */ }
}
async function log(entityType: string, entityId: string, field: string, oldV: string | null, newV: string | null, by = 'hub (Google Workspace)') {
  try { await svc.from('change_log').insert({ entity_type: entityType, entity_id: entityId, field, old_value: oldV, new_value: newV, changed_by: by }); } catch (_) { /* audit */ }
}
async function members(): Promise<Row[]> {
  const { data } = await svc.from('team_members').select('id, name, email, department, role, active, avatar_url');
  return data || [];
}
function memberByEmail(all: Row[], email: string): Row | null { return all.filter((m) => lower(m.email) === lower(email))[0] || null; }

/* ---- photos ---- */
async function applyPhoto(tok: string, dir: Row, member: Row): Promise<'applied' | 'kept' | 'none' | 'skipped'> {
  const own = member.avatar_url && !(String(member.avatar_url).indexOf('/' + BUCKET + '/google/') >= 0);
  if (own) return 'skipped'; /* the person uploaded their own photo on the hub */
  const r = await gapi(tok, 'https://admin.googleapis.com/admin/directory/v1/users/' + encodeURIComponent(dir.email) + '/photos/thumbnail');
  if (r.status === 404 || !r.body?.photoData) return 'none';
  const etag = String(r.body.etag || r.body.photoData.length);
  if (dir.photo_etag === etag && member.avatar_url) return 'kept';
  const mime = String(r.body.mimeType || 'image/jpeg');
  const ext = mime.indexOf('png') >= 0 ? 'png' : (mime.indexOf('gif') >= 0 ? 'gif' : 'jpg');
  const b64 = String(r.body.photoData).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const raw = atob(b64 + pad);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const path = 'google/' + member.id + '.' + ext;
  const { error } = await svc.storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType: mime, cacheControl: '3600' });
  if (error) throw new Error('photo upload failed: ' + error.message);
  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl + '?v=' + etag.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  await svc.from('team_members').update({ avatar_url: url }).eq('id', member.id);
  await svc.from('hub_directory').update({ photo_etag: etag, photo_url: url, photo_applied_at: new Date().toISOString() }).eq('email', dir.email);
  member.avatar_url = url;
  return 'applied';
}

/* ---- the pass ---- */
async function sync(trigger: string) {
  const startedAt = new Date().toISOString();
  const result: Row = { users: 0, deleted_seen: 0, matched: 0, queued: 0, new_in_queue: [], deactivated: [], reactivated: [], photos: 0, skipped: 0, photo_errors: 0 };
  const tok = await token();
  const users = await listUsers(tok, false);
  let gone: Row[] = [];
  try { gone = await listUsers(tok, true); } catch (_) { gone = []; }
  result.users = users.length; result.deleted_seen = gone.length;
  const all = await members();
  const { data: existingRows } = await svc.from('hub_directory').select('*');
  const existing: Record<string, Row> = {};
  (existingRows || []).forEach((r: Row) => { existing[lower(r.email)] = r; });
  const seen: Record<string, boolean> = {};
  const now = new Date().toISOString();

  for (const u of users) {
    const email = lower(u.primaryEmail);
    if (!email.endsWith('@' + DOMAIN)) continue;
    seen[email] = true;
    const prev = existing[email] || null;
    const fullName = String(u.name?.fullName || ((u.name?.givenName || '') + ' ' + (u.name?.familyName || '')).trim());
    const title = String((u.organizations || []).map((o: Row) => o.title).filter(Boolean)[0] || '');
    const orgUnit = String(u.orgUnitPath || '');
    const skipped = prev ? (prev.skipped && !prev.member_id ? true : isShared(email, fullName, orgUnit) && !prev.member_id) : isShared(email, fullName, orgUnit);
    const member = memberByEmail(all, email);
    const row: Row = {
      email, google_id: String(u.id || ''), full_name: fullName, given_name: String(u.name?.givenName || ''), family_name: String(u.name?.familyName || ''),
      title, org_unit: orgUnit, suspended: !!u.suspended, archived: !!u.archived, deleted_at: null, is_admin: !!(u.isAdmin || u.isDelegatedAdmin),
      account_created_at: u.creationTime || null, last_login_at: u.lastLoginTime && !/^1970/.test(String(u.lastLoginTime)) ? u.lastLoginTime : null,
      synced_at: now, skipped,
      member_id: member ? member.id : (prev?.member_id || null),
    };
    if (member && !prev?.member_id) { row.placed_at = prev?.placed_at || now; row.placed_by = prev?.placed_by || 'match by email'; }
    if (prev) await svc.from('hub_directory').update(row).eq('email', email);
    else await svc.from('hub_directory').insert({ ...row, first_seen_at: now });
    if (skipped) result.skipped++;
    else if (member) result.matched++;
    else if (!prev?.dismissed && !u.suspended && !u.archived) { result.queued++; if (!prev) result.new_in_queue.push(fullName || email); }

    /* leaving and coming back */
    const off = !!u.suspended || !!u.archived;
    if (member && off && member.active !== false) {
      await svc.from('team_members').update({ active: false }).eq('id', member.id);
      await svc.from('hub_directory').update({ deactivated_member_id: member.id, deactivated_at: now }).eq('email', email);
      await log('team_member', String(member.id), 'active', 'true', 'false (' + (u.suspended ? 'suspended' : 'archived') + ' in Google Workspace)');
      result.deactivated.push(member.name);
      member.active = false;
    } else if (member && !off && member.active === false && prev && String(prev.deactivated_member_id) === String(member.id)) {
      await svc.from('team_members').update({ active: true }).eq('id', member.id);
      await svc.from('hub_directory').update({ deactivated_member_id: null, deactivated_at: null }).eq('email', email);
      await log('team_member', String(member.id), 'active', 'false', 'true (account active again in Google Workspace)');
      result.reactivated.push(member.name);
      member.active = true;
    }
    /* photos */
    if (member && member.active !== false && !off) {
      try { const p = await applyPhoto(tok, { email, photo_etag: prev?.photo_etag || null }, member); if (p === 'applied') result.photos++; }
      catch (e) { result.photo_errors++; console.error('photo', email, String((e as Error).message || e)); }
    }
  }
  /* deleted in Workspace (still listed by Google for 20 days), or simply gone */
  for (const u of gone) {
    const email = lower(u.primaryEmail); if (!email || seen[email]) continue;
    seen[email] = true;
    const prev = existing[email] || null;
    const member = memberByEmail(all, email);
    const patch: Row = { deleted_at: u.deletionTime || now, synced_at: now, suspended: true };
    if (prev) await svc.from('hub_directory').update(patch).eq('email', email);
    else await svc.from('hub_directory').insert({ email, full_name: String(u.name?.fullName || ''), ...patch, first_seen_at: now, member_id: member ? member.id : null, skipped: isShared(email, String(u.name?.fullName || ''), '') });
    if (member && member.active !== false) {
      await svc.from('team_members').update({ active: false }).eq('id', member.id);
      await svc.from('hub_directory').update({ deactivated_member_id: member.id, deactivated_at: now }).eq('email', email);
      await log('team_member', String(member.id), 'active', 'true', 'false (account deleted in Google Workspace)');
      result.deactivated.push(member.name);
    }
  }
  for (const email of Object.keys(existing)) {
    if (seen[email]) continue;
    const prev = existing[email];
    if (prev.deleted_at) continue;
    await svc.from('hub_directory').update({ deleted_at: now, synced_at: now }).eq('email', email);
    const member = memberByEmail(all, email);
    if (member && member.active !== false) {
      await svc.from('team_members').update({ active: false }).eq('id', member.id);
      await svc.from('hub_directory').update({ deactivated_member_id: member.id, deactivated_at: now }).eq('email', email);
      await log('team_member', String(member.id), 'active', 'true', 'false (account no longer in Google Workspace)');
      result.deactivated.push(member.name);
    }
  }
  await svc.from('hub_directory_state').update({ last_sync_at: now, last_result: { ...result, trigger, started_at: startedAt }, last_error: null, updated_at: now }).eq('id', 1);
  if (result.new_in_queue.length || result.deactivated.length || result.reactivated.length) {
    const site = 'https://wa-exec-dashboard.netlify.app';
    const bits: string[] = [];
    if (result.new_in_queue.length) bits.push(result.new_in_queue.length + ' new Workspace account' + (result.new_in_queue.length === 1 ? '' : 's') + ' to place on the roster: ' + result.new_in_queue.join(', ') + ' (' + site + '/#adminpanel)');
    if (result.deactivated.length) bits.push('Marked inactive from Workspace: ' + result.deactivated.join(', '));
    if (result.reactivated.length) bits.push('Back on the roster: ' + result.reactivated.join(', '));
    await postSlack(':busts_in_silhouette: Roster sync. ' + bits.join('. '));
  }
  return result;
}

async function place(email: string, memberId: number | null, by: string) {
  email = lower(email);
  const all = await members();
  let member = memberId ? all.filter((m) => Number(m.id) === Number(memberId))[0] || null : null;
  if (!member) member = memberByEmail(all, email);
  if (!member) return { ok: false, error: 'no roster profile carries ' + email + ' yet' };
  const now = new Date().toISOString();
  await svc.from('hub_directory').update({ member_id: member.id, placed_at: now, placed_by: by, dismissed: false, skipped: false }).eq('email', email);
  let photo = 'none';
  try { const tok = await token(); photo = await applyPhoto(tok, { email, photo_etag: null }, member); } catch (e) { photo = 'error: ' + String((e as Error).message || e).slice(0, 120); }
  await log('hub_directory', email, 'placed', null, member.name + ' (#' + member.id + ')', by);
  return { ok: true, member_id: member.id, name: member.name, photo };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  let who: string | null = null;
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) who = 'automation'; } catch (_) { /* no */ }
  if (!who) who = await adminCaller(req);
  const staff = who || await staffCaller(req);
  if (!staff) return json({ error: 'unauthorized' }, 401);
  try {
    if (action === 'status') {
      const { data: st } = await svc.from('hub_directory_state').select('*').eq('id', 1).maybeSingle();
      const { data: queue } = await svc.from('hub_directory').select('email, full_name, title, org_unit, suspended, archived, deleted_at, account_created_at, last_login_at, first_seen_at, member_id, dismissed, skipped, deactivated_member_id, deactivated_at, photo_applied_at').order('first_seen_at', { ascending: false });
      return json({ ok: true, state: st || null, rows: queue || [] });
    }
    if (!who) return json({ error: 'admins only' }, 403);
    if (action === 'sync') {
      try { const r = await sync(who); return json({ ok: true, result: r }); }
      catch (e) {
        const msg = String((e as Error).message || e).slice(0, 400);
        await svc.from('hub_directory_state').update({ last_error: msg, updated_at: new Date().toISOString() }).eq('id', 1);
        return json({ ok: false, error: msg });
      }
    }
    if (action === 'place') {
      const r = await place(String(body.email || ''), body.member_id ? Number(body.member_id) : null, who);
      return json(r, r.ok ? 200 : 400);
    }
    if (action === 'dismiss') {
      const email = lower(body.email); if (!email) return json({ error: 'email required' }, 400);
      const undo = !!body.undo;
      await svc.from('hub_directory').update({ dismissed: !undo, dismissed_by: undo ? null : who, dismissed_at: undo ? null : new Date().toISOString() }).eq('email', email);
      await log('hub_directory', email, 'dismissed', undo ? 'true' : 'false', undo ? 'false' : 'true (not a person)', who);
      return json({ ok: true });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
});
