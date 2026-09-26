// Welfare Avenue: security-check (v1, wave146, 26/09/26)
// The monthly security check. Once a month (and when an admin asks) it reads:
//   - the Workspace directory: every account, whether it has 2-step verification, when it last signed in, the admins;
//   - the Drive: the files anyone with the link can open (what Steel's account can see: the shared drives and what is shared
//     with him), with the ones whose names look sensitive;
//   - the Google audit logs for the period (30 days by default): sharing with people outside Welfare Avenue and files made
//     public (Drive), sign-in failures and warnings (Login), apps people authorised (Token), admin changes (Admin);
// and keeps the findings with what to do about each in security_checks. Nothing is changed in Google.
// Actions: run {days} (the automation or an admin), latest.
// Google: the service account acting as steel.macdonald@welfareavenue.com (domain-wide delegation: admin.directory.user,
// admin.reports.audit.readonly, drive; all read here).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const ACTOR = 'steel.macdonald@welfareavenue.com';
const DOMAIN = '@welfareavenue.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function getSecret(name: string): Promise<string> { const { data, error } = await svc.rpc('get_secret', { secret_name: name }); if (error || !data) throw new Error('secret ' + name + ' unavailable'); return data as string; }
async function caller(req: Request): Promise<string | null> {
  try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_hub_admin'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---------- Google ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
const TOK: Record<string, { v: string; exp: number }> = {};
let SA_CLIENT = '';
async function token(scope: string): Promise<string> {
  if (TOK[scope] && Date.now() < TOK[scope].exp - 120000) return TOK[scope].v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  SA_CLIENT = String(sa.client_id || '');
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: ACTOR, scope, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the token (' + scope.split('/').pop() + '): ' + String(body.error_description || body.error || res.status).slice(0, 160));
  TOK[scope] = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOK[scope].v;
}
async function g(url: string, scope: string): Promise<Row> {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + (await token(scope)) } });
  const txt = await res.text(); let j: Row = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt.slice(0, 200) }; }
  if (!res.ok) throw new Error('GET ' + url.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, '') + ': ' + res.status + ' ' + String(j?.error?.message || txt).slice(0, 200));
  return j;
}
const DIR = 'https://www.googleapis.com/auth/admin.directory.user';
const REP = 'https://www.googleapis.com/auth/admin.reports.audit.readonly';
const DRIVE = 'https://www.googleapis.com/auth/drive';
async function pages(base: string, scope: string, key: string, cap: number): Promise<Row[]> {
  const out: Row[] = []; let pt = '';
  for (let i = 0; i < 40 && out.length < cap; i++) {
    const j = await g(base + (pt ? (base.includes('?') ? '&' : '?') + 'pageToken=' + encodeURIComponent(pt) : ''), scope);
    out.push(...(j[key] || [])); pt = j.nextPageToken || ''; if (!pt) break;
  }
  return out;
}
async function log(app: string, since: string, until: string, eventName = '', cap = 5000): Promise<Row[]> {
  const u = 'https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/' + app + '?maxResults=1000&startTime=' + since + '&endTime=' + until + (eventName ? '&eventName=' + eventName : '');
  const items = await pages(u, REP, 'items', cap);
  const out: Row[] = [];
  for (const it of items) for (const e of it.events || []) {
    const p: Row = {};
    for (const x of e.parameters || []) p[x.name] = x.value ?? x.boolValue ?? x.intValue ?? x.multiValue ?? (x.multiMessageValue ? x.multiMessageValue : null);
    out.push({ at: it.id?.time, actor: String(it.actor?.email || '').toLowerCase(), name: e.name, type: e.type, p });
  }
  return out;
}

/* ---------- the check ---------- */
const SENSITIVE = /\b(hr|human resources|payroll|salar(y|ies)|sin|social insurance|passport|bank|banking|statements?|invoices?|tax(es)?|t4|donors?|donations?|contacts?|phone list|emails? list|passwords?|logins?|credentials?|confidential|private|medical|health|evaluations?|performance|disciplin\w*|warnings?|contracts?|agreements?|budgets?|financ\w*|minutes|board|resign\w*|termination|complaints?|incident|background check|references?)\b/i;
const ADMIN_URL = 'https://admin.google.com';
type Finding = { key: string; level: 'high' | 'medium' | 'low' | 'info' | 'ok'; title: string; detail: string; count: number; items: Row[]; fix: string; link?: string };
function day(iso: string | null | undefined): string { if (!iso || String(iso).startsWith('1970')) return 'never'; return new Date(iso).toISOString().slice(0, 10); }

async function run(days: number, who: string) {
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const since = start.toISOString(), until = end.toISOString();
  const findings: Finding[] = [];
  const summary: Row = { days };
  const notes: string[] = [];
  const [dirRows, members] = await Promise.all([
    svc.from('hub_directory').select('email,member_id,full_name'),
    svc.from('team_members').select('id,name,active')
  ]);
  const onRoster = new Map<string, Row>();
  const mById = new Map<number, Row>(((members.data || []) as Row[]).map((m) => [Number(m.id), m]));
  for (const d of (dirRows.data || []) as Row[]) if (d.member_id && mById.has(Number(d.member_id))) onRoster.set(String(d.email).toLowerCase(), mById.get(Number(d.member_id))!);

  /* 1. the accounts */
  try {
    const users = await pages('https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&fields=' + encodeURIComponent('users(primaryEmail,name/fullName,isAdmin,isDelegatedAdmin,isEnrolledIn2Sv,isEnforcedIn2Sv,lastLoginTime,creationTime,suspended,archived),nextPageToken'), DIR, 'users', 2000);
    const active = users.filter((u) => !u.suspended && !u.archived);
    const now = end.getTime();
    const person = (u: Row) => { const m = onRoster.get(String(u.primaryEmail).toLowerCase()); return { label: (u.name?.fullName || u.primaryEmail), sub: u.primaryEmail + (m ? (m.active === false ? ' · left the roster' : '') : ' · not on the roster') + ' · last sign-in ' + day(u.lastLoginTime) }; };
    const admins = active.filter((u) => u.isAdmin || u.isDelegatedAdmin);
    const no2 = active.filter((u) => !u.isEnrolledIn2Sv);
    const adminsNo2 = admins.filter((u) => !u.isEnrolledIn2Sv);
    const unused = active.filter((u) => { const t = u.lastLoginTime && !String(u.lastLoginTime).startsWith('1970') ? new Date(u.lastLoginTime).getTime() : 0; const made = u.creationTime ? new Date(u.creationTime).getTime() : 0; return t ? now - t > 60 * 86400000 : now - made > 30 * 86400000; });
    Object.assign(summary, { accounts: users.length, active: active.length, suspended: users.length - active.length, with_2sv: active.length - no2.length, without_2sv: no2.length, enforced_2sv: active.filter((u) => u.isEnforcedIn2Sv).length, admins: admins.length, admins_without_2sv: adminsNo2.length, unused_60: unused.length });
    findings.push({ key: 'admins_2sv', level: adminsNo2.length ? 'high' : 'ok', title: adminsNo2.length ? adminsNo2.length + ' of ' + admins.length + ' admin accounts have no 2-step verification' : 'Every admin account has 2-step verification',
      detail: 'An admin account can change anything in the Workspace, read every mailbox and hand out access. A stolen password is enough to take it over without a second step.', count: adminsNo2.length,
      items: adminsNo2.map(person), fix: 'Ask each of them to turn it on now (myaccount.google.com, Security, 2-Step Verification), then enforce it for admins in the Admin console (Security, Authentication, 2-step verification).', link: ADMIN_URL + '/ac/security/2sv' });
    findings.push({ key: 'accounts_2sv', level: no2.length / Math.max(1, active.length) > 0.25 ? 'high' : no2.length ? 'medium' : 'ok', title: no2.length ? no2.length + ' of ' + active.length + ' active accounts have no 2-step verification' : 'Every active account has 2-step verification',
      detail: 'These accounts open the shared drives, the board files and the Hub with a password alone. Enforcement is ' + (summary.enforced_2sv ? 'on for ' + summary.enforced_2sv + ' accounts only.' : 'off for everyone.'), count: no2.length,
      items: no2.map(person), fix: 'Announce a date, give people a week to enrol (a phone prompt is enough), then turn on enforcement for the whole organisation in the Admin console (Security, Authentication, 2-step verification). Shared accounts such as info@ need a named owner with the second step.', link: ADMIN_URL + '/ac/security/2sv' });
    findings.push({ key: 'unused', level: unused.length ? 'medium' : 'ok', title: unused.length ? unused.length + ' active accounts have not signed in for 60 days or more' : 'No active account has been idle for 60 days',
      detail: 'Idle accounts still open everything their owner could, and nobody would notice if someone else signed in. People who left should be suspended and their files handed over.', count: unused.length,
      items: unused.map(person), fix: 'Check each one: suspend the accounts of people who have left (Admin, Workspace accounts in the Hub, or the Admin console) after handing their Drive files to their team; keep a shared account only if someone owns it.', link: ADMIN_URL + '/ac/users' });
    findings.push({ key: 'admins', level: admins.length > 3 ? 'low' : 'info', title: admins.length + ' admin account' + (admins.length === 1 ? '' : 's'),
      detail: admins.length > 3 ? 'More admins than a team this size needs: every admin account is a way into everything.' : 'The accounts that can change the Workspace.', count: admins.length,
      items: admins.map((u) => ({ label: u.name?.fullName || u.primaryEmail, sub: u.primaryEmail + (u.isEnrolledIn2Sv ? ' · 2-step on' : ' · no 2-step') + ' · last sign-in ' + day(u.lastLoginTime) })), fix: 'Keep two or three super admins, each with 2-step verification; give others only the admin role they need.', link: ADMIN_URL + '/ac/roles' });
  } catch (e) { notes.push('accounts: ' + String((e as Error).message).slice(0, 200)); }

  /* 2. files anyone with the link can open */
  try {
    const files = await pages('https://www.googleapis.com/drive/v3/files?corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1000&q=' + encodeURIComponent("(visibility = 'anyoneWithLink' or visibility = 'anyoneCanFind') and trashed = false") + '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,driveId,modifiedTime,webViewLink,owners(emailAddress))'), DRIVE, 'files', 6000);
    const drives = await pages('https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=' + encodeURIComponent('nextPageToken,drives(id,name)'), DRIVE, 'drives', 200);
    const dn = new Map<string, string>(drives.map((d) => [d.id, d.name]));
    const notForms = files.filter((f) => !/form/.test(String(f.mimeType)));
    const folders = notForms.filter((f) => /folder/.test(String(f.mimeType)));
    const sensitive = notForms.filter((f) => SENSITIVE.test(String(f.name || '')));
    const where = (f: Row) => (f.driveId ? (dn.get(f.driveId) || 'a shared drive') : 'My Drive of ' + String((f.owners || [])[0]?.emailAddress || 'someone'));
    Object.assign(summary, { public_files: notForms.length, public_forms: files.length - notForms.length, public_folders: folders.length, public_sensitive: sensitive.length });
    findings.push({ key: 'public_sensitive', level: sensitive.length ? 'high' : 'ok', title: sensitive.length ? sensitive.length + ' files with sensitive-looking names can be opened by anyone with the link' : 'No sensitive-looking file is open to anyone with the link',
      detail: 'Their names mention people, money, HR, the board or contacts. A link forwarded once is enough for a stranger to open them.', count: sensitive.length,
      items: sensitive.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime))).slice(0, 60).map((f) => ({ label: f.name, sub: where(f) + ' · changed ' + day(f.modifiedTime), url: f.webViewLink })),
      fix: 'Open each one, Share, General access: change "Anyone with the link" to Restricted (or to Welfare Avenue). Share with named people instead.', link: 'https://drive.google.com' });
    findings.push({ key: 'public_folders', level: folders.length ? 'medium' : 'ok', title: folders.length ? folders.length + ' folders are open to anyone with the link' : 'No folder is open to anyone with the link',
      detail: 'A public folder opens every file inside it, including files added later.', count: folders.length,
      items: folders.slice(0, 60).map((f) => ({ label: f.name, sub: where(f) + ' · changed ' + day(f.modifiedTime), url: f.webViewLink })), fix: 'Make the folder Restricted and share the few files that need a public link one by one.', link: 'https://drive.google.com' });
    findings.push({ key: 'public_files', level: notForms.length > 200 ? 'medium' : notForms.length ? 'low' : 'ok', title: notForms.length + ' files can be opened by anyone with the link',
      detail: 'Not counting the ' + (files.length - notForms.length) + ' Google Forms, which are meant to be public. What Steel’s account can see: the shared drives and files shared with him; other My Drives are not searched.', count: notForms.length,
      items: Object.entries(notForms.reduce((o: Row, f) => { const k = where(f); o[k] = (o[k] || 0) + 1; return o; }, {})).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 12).map(([k, n]) => ({ label: k, sub: n + ' files' })),
      fix: 'Set the Drive sharing default to Restricted for new files (Admin console: Apps, Google Workspace, Drive and Docs, Sharing settings), then ask each team to review its public files once.', link: ADMIN_URL + '/ac/appslist/core' });
  } catch (e) { notes.push('drive: ' + String((e as Error).message).slice(0, 200)); }

  /* 3. sharing in the period: outside Welfare Avenue, and files made public */
  try {
    const acl = await log('drive', since, until, 'change_user_access', 5000);
    const ext = acl.filter((e) => { const t = String(e.p.target_user || '').toLowerCase(); const nv = JSON.stringify(e.p.new_value || ''); return t && !t.endsWith(DOMAIN) && !/none/.test(nv); });
    const byDoc = new Map<string, Row>();
    for (const e of ext) { const k = e.p.doc_id + '|' + e.p.target_user; if (!byDoc.has(k)) byDoc.set(k, e); }
    const list = [...byDoc.values()];
    const sens = list.filter((e) => SENSITIVE.test(String(e.p.doc_title || '')));
    const vis = await log('drive', since, until, 'change_document_visibility', 2000);
    const madePublic = vis.filter((e) => /people_with_link|public_on_the_web|public/.test(String(e.p.visibility || '')) && !/form/.test(String(e.p.doc_type || '')));
    Object.assign(summary, { shared_outside: list.length, shared_outside_people: new Set(list.map((e) => String(e.p.target_user).toLowerCase())).size, shared_outside_sensitive: sens.length, made_public: madePublic.length });
    findings.push({ key: 'shared_outside', level: sens.length ? 'low' : list.length ? 'info' : 'ok', title: list.length + ' files shared with people outside Welfare Avenue in the last ' + days + ' days',
      detail: 'Sharing with partners, directors and volunteers on personal accounts is normal. The list shows who received what, so anything unexpected stands out' + (sens.length ? '; ' + sens.length + ' have sensitive-looking names.' : '.'), count: list.length,
      items: (sens.length ? sens : list).slice(0, 60).map((e) => ({ label: e.p.doc_title || '(untitled)', sub: 'with ' + e.p.target_user + ' by ' + (e.actor || 'someone') + ' · ' + day(e.at) })), fix: 'Check the list; take back anything that should not have left, and share with the person’s Welfare Avenue account when they have one.' });
    findings.push({ key: 'made_public', level: madePublic.length ? 'low' : 'ok', title: madePublic.length + ' files made public in the last ' + days + ' days',
      detail: 'Files whose general access changed to anyone with the link (forms left out).', count: madePublic.length,
      items: madePublic.slice(0, 40).map((e) => ({ label: e.p.doc_title || '(untitled)', sub: 'by ' + (e.actor || 'someone') + ' · ' + day(e.at) + ' · ' + String(e.p.visibility || '') })), fix: 'Make sure each one is meant to be public (posters, sign-up sheets); restrict the rest.' });
  } catch (e) { notes.push('drive log: ' + String((e as Error).message).slice(0, 200)); }

  /* 4. sign-ins */
  try {
    const ev = await log('login', since, until, '', 10000);
    const fails = ev.filter((e) => e.name === 'login_failure');
    const alarms = ev.filter((e) => /suspicious_login|leak|gov_attack|account_disabled|password_leak/.test(e.name));
    const unusual = ev.filter((e) => e.name === 'login_success' && e.p.is_suspicious === true);
    const risky = ev.filter((e) => e.name === 'risky_sensitive_action_allowed' || e.name === 'risky_sensitive_action_blocked');
    const perUser = (list: Row[]) => Object.entries(list.reduce((o: Row, e) => { const k = e.actor || '(unknown)'; const x = o[k] || { n: 0, last: '' }; x.n++; if (String(e.at) > x.last) x.last = String(e.at); o[k] = x; return o; }, {})).sort((a, b) => (b[1] as Row).n - (a[1] as Row).n);
    Object.assign(summary, { sign_in_failures: fails.length, sign_in_alarms: alarms.length, sign_in_unusual: unusual.length, risky_actions: risky.length });
    if (alarms.length) findings.push({ key: 'sign_in_alarms', level: 'high', title: alarms.length + ' sign-in warnings from Google in the last ' + days + ' days',
      detail: 'Google blocked or warned about these accounts (a suspicious sign-in, a leaked password, a government-backed attack or a disabled account).', count: alarms.length,
      items: alarms.map((e) => ({ label: e.actor || '(unknown)', sub: e.name.replace(/_/g, ' ') + ' · ' + day(e.at) })), fix: 'Call each person today: if it was not them, reset the password, sign them out everywhere and turn on 2-step verification (Admin console, the user, Security).', link: ADMIN_URL + '/ac/reporting/audit/login' });
    findings.push({ key: 'sign_in', level: unusual.length ? 'medium' : fails.length > 20 ? 'medium' : fails.length ? 'low' : 'ok',
      title: (unusual.length ? unusual.length + ' sign-ins Google found unusual' : 'No sign-in Google found unusual') + ', ' + fails.length + ' failed, in the last ' + days + ' days',
      detail: 'Google lets a sign-in through but marks it unusual when it comes from a new device or place, and checks sensitive actions after it again (' + risky.length + ' this period). Usually a new phone or travel; worth a quick word when the person did not expect it. A few failed sign-ins are typos; many on one account can be someone guessing.', count: unusual.length + fails.length,
      items: [...perUser(unusual).map(([u, x]) => ({ label: u, sub: (x as Row).n + ' unusual sign-in' + ((x as Row).n === 1 ? '' : 's') + ', last ' + day((x as Row).last) })), ...perUser(fails).slice(0, 12).map(([u, x]) => ({ label: u, sub: (x as Row).n + ' failed sign-in' + ((x as Row).n === 1 ? '' : 's') + ', last ' + day((x as Row).last) }))],
      fix: 'Ask the people listed whether they changed phone or signed in somewhere new. If not: reset the password and sign them out everywhere. 2-step verification makes a stolen password useless.', link: ADMIN_URL + '/ac/reporting/audit/login' });
  } catch (e) { notes.push('login log: ' + String((e as Error).message).slice(0, 200)); }

  /* 5. apps people authorised */
  try {
    const ev = await log('token', since, until, 'authorize', 8000);
    const apps = new Map<string, { users: Set<string>; scopes: Set<string> }>();
    for (const e of ev) {
      const name = String(e.p.app_name || e.p.client_id || 'Unknown app');
      const a = apps.get(name) || { users: new Set<string>(), scopes: new Set<string>() };
      if (e.actor) a.users.add(e.actor);
      const sc = e.p.scope; (Array.isArray(sc) ? sc : String(sc || '').split(/[ ,]+/)).forEach((s: string) => { if (s) a.scopes.add(String(s).replace('https://www.googleapis.com/auth/', '')); });
      apps.set(name, a);
    }
    const WIDE = /^(drive|drive\.readonly|gmail\.readonly|gmail\.modify|mail\.google\.com\/?|https:\/\/mail\.google\.com\/?|cloud-platform|admin\.[a-z.]+)$/;
    const wide = [...apps.entries()].filter(([, a]) => [...a.scopes].some((s) => WIDE.test(s)));
    const prev = await svc.from('security_checks').select('summary').order('ran_at', { ascending: false }).limit(1).maybeSingle();
    const seen = new Set<string>(((prev.data?.summary?.app_names) || []) as string[]);
    const fresh = [...apps.keys()].filter((n) => seen.size && !seen.has(n));
    Object.assign(summary, { apps: apps.size, apps_wide: wide.length, app_names: [...apps.keys()].slice(0, 200), apps_new: fresh.length });
    findings.push({ key: 'apps', level: wide.length ? 'low' : 'info', title: apps.size + ' apps connected to Welfare Avenue accounts in the last ' + days + ' days' + (wide.length ? ', ' + wide.length + ' with full access to Drive or Gmail' : ''),
      detail: 'Apps people signed in to with their Welfare Avenue account' + (fresh.length ? '; new since the last check: ' + fresh.slice(0, 8).join(', ') + '.' : '.') + ' An app with full Drive or Gmail access can read everything that person can.', count: apps.size,
      items: [...wide, ...[...apps.entries()].filter(([n]) => !wide.some(([w]) => w === n))].slice(0, 40).map(([n, a]) => ({ label: n, sub: a.users.size + ' ' + (a.users.size === 1 ? 'person' : 'people') + ' · ' + [...a.scopes].slice(0, 4).join(', ') + (a.scopes.size > 4 ? '…' : '') })),
      fix: 'Remove what nobody uses and limit what third-party apps can reach (Admin console: Security, Access and data control, API controls).', link: ADMIN_URL + '/ac/owl' });
  } catch (e) { notes.push('token log: ' + String((e as Error).message).slice(0, 200)); }

  /* 6. admin changes */
  try {
    const ev = await log('admin', since, until, '', 3000);
    const by: Row = {}; for (const e of ev) by[e.name] = (by[e.name] || 0) + 1;
    const noteworthy = ev.filter((e) => /CREATE_USER|DELETE_USER|ASSIGN_ROLE|UNASSIGN_ROLE|GRANT_ADMIN|AUTHORIZE_API_CLIENT_ACCESS|CHANGE_TWO_STEP|ENFORCE|SECURITY|PASSWORD|TOGGLE|SUSPEND/i.test(e.name));
    Object.assign(summary, { admin_changes: ev.length });
    findings.push({ key: 'admin_changes', level: 'info', title: ev.length + ' admin changes in the last ' + days + ' days',
      detail: Object.entries(by).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, n]) => k.toLowerCase().replace(/_/g, ' ') + ' (' + n + ')').join(', ') + '.', count: ev.length,
      items: noteworthy.slice(0, 40).map((e) => ({ label: e.name.toLowerCase().replace(/_/g, ' '), sub: (e.p.USER_EMAIL || (e.p.API_CLIENT_NAME && String(e.p.API_CLIENT_NAME) === SA_CLIENT ? 'the Hub\u2019s service account' : e.p.API_CLIENT_NAME) || e.p.ROLE_NAME || e.p.GROUP_EMAIL || '') + ' · by ' + (e.actor || 'someone') + ' · ' + day(e.at) })), fix: 'Make sure each change was expected.', link: ADMIN_URL + '/ac/reporting/audit/admin' });
  } catch (e) { notes.push('admin log: ' + String((e as Error).message).slice(0, 200)); }

  const order = { high: 0, medium: 1, low: 2, info: 3, ok: 4 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  summary.high = findings.filter((f) => f.level === 'high').length;
  summary.medium = findings.filter((f) => f.level === 'medium').length;
  const row = { period_start: since, period_end: until, ran_by: who, summary, findings, ok: notes.length === 0, note: notes.join(' | ') || null };
  const { data, error } = await svc.from('security_checks').insert(row).select('id,ran_at').single();
  if (error) throw new Error(error.message);
  await svc.from('change_log').insert({ entity_type: 'security_check', entity_id: String(data.id), field: 'ran', old_value: null, new_value: summary.high + ' high, ' + summary.medium + ' medium' + (notes.length ? ' (' + notes.length + ' sources failed)' : ''), changed_by: who === 'automation' ? 'security-check' : who });
  return { ok: true, id: data.id, summary, notes };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'Only admins and the monthly run can do this' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'latest');
  try {
    if (action === 'latest') { const { data } = await svc.from('security_checks').select('*').order('ran_at', { ascending: false }).limit(1).maybeSingle(); return json({ ok: true, check: data || null }); }
    if (action === 'run') return json(await run(Math.min(90, Math.max(7, Number(body.days) || 30)), who));
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 500) }, 500);
  }
});
