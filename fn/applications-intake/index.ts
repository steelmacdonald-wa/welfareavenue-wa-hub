// Welfare Avenue: applications-intake (v1, 06/10/26, wave209)
// Steel (06/10/26): "emails that come through the hub as an application should be added directly to the applications page.
// Volunteer cook, kitchen, driver, server, photographer, community lead, and team leader should be redirected to the volunteer
// manager to applicants received and should update both the crm and volunteers records to have that applicant visible in our
// searches for volunteers."
// mail-pull reads hub@ (which is on job@ and volunteer@) and files what it understands. Application platforms send templates
// it could not read: CABM / VBM (no-reply@yapla.org) put the applicant in the HTML part only (the text part is a link), so
// mail-pull ignored them as noise; Je Bénévole (info@fcabq.org) sends plain text with HTML entities. This function runs after
// it (cron every 10 minutes) over the recent hub_mail rows and, once per email (app_intake_log):
//   - a CABM / VBM email (direct, or forwarded by a team member) or a Je Bénévole email is read field by field: name,
//     email, phone, language, pronoun, the offer and its number, the CV link, the message;
//   - an email mail-pull already made a card from (filed.type candidate) is checked: a volunteer role leaves Applications;
//   - the role decides where it goes (public.wa209_volunteer_roles): a volunteer role (cook, kitchen, driver, server, dishes,
//     photographer, community lead, team leader, or a general volunteer application) becomes a volunteer application
//     (public.wa209_volunteer_apply: the person in the CRM and the volunteer directory, Applicants received in the Volunteer
//     Manager); anything else is a New card in Applications (hub_candidates), its CV copied from the CABM CDN into hub-mail.
// The same person for the same offer is filed once (forwarded copies, a second email): volunteers by source_ref, cards by
// email and role within 90 days. Nothing is sent to anyone.
// Auth: x-wa-secret (cron) or a staff sign-in. Actions:
//   {action:'run', since?, limit?}   file what is new (since: an ISO date, default 14 days back)
//   {action:'parse', subject, body, from?}   what the readers make of a made-up email (nothing written)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const HUB = 'hub@welfareavenue.com';
const BUCKET = 'hub-mail';
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
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}

/* ---- Gmail (hub@, read only), the same delegation mail-pull uses ---- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64url(s: string): Uint8Array { const b = (s || '').replace(/-/g, '+').replace(/_/g, '/'); const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : ''; const raw = atob(b + pad); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
function pemToDer(pem: string): Uint8Array { const raw = atob(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
let TOKEN: { value: string; exp: number } | null = null;
async function gmailToken(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 60000) return TOKEN.value;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: HUB, scope: 'https://www.googleapis.com/auth/gmail.readonly', aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key).buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Gmail delegation failed');
  TOKEN = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return TOKEN.value;
}
// deno-lint-ignore no-explicit-any
function walk(part: any, out: { text: string[]; html: string[] }) {
  if (!part) return;
  if (part.body && part.body.data && !part.filename) {
    const txt = new TextDecoder().decode(fromB64url(part.body.data));
    if (part.mimeType === 'text/plain') out.text.push(txt); else if (part.mimeType === 'text/html') out.html.push(txt);
  }
  (part.parts || []).forEach((p: unknown) => walk(p, out));
}
async function gmailHtml(gmailId: string): Promise<string> {
  const t = await gmailToken();
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(gmailId) + '?format=full', { headers: { Authorization: 'Bearer ' + t } });
  if (!res.ok) throw new Error('gmail ' + res.status);
  const m = await res.json(); const out = { text: [] as string[], html: [] as string[] }; walk(m.payload, out);
  return out.html.join('\n') || out.text.join('\n');
}

/* ---- reading the templates ---- */
const ENT: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', icirc: 'î', ucirc: 'û', ugrave: 'ù', Eacute: 'É', middot: '·', rsquo: '’', laquo: '«', raquo: '»' };
function decode(s: string): string { return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m); }
function strip(html: string): string {
  return decode(html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}
type Parsed = { platform: 'cabm' | 'fcabq'; name: string; email: string | null; phone: string | null; language: string | null; pronoun: string | null; offer: string | null; offer_no: string | null; cv_url: string | null; message: string | null; note?: string | null };
function between(flat: string, starts: RegExp, ends: RegExp[]): string | null {
  const m = flat.match(starts); if (!m || m.index === undefined) return null;
  const rest = flat.slice(m.index + m[0].length);
  let cut = rest.length; for (const e of ends) { const x = rest.search(e); if (x >= 0 && x < cut) cut = x; }
  const v = rest.slice(0, cut).trim();
  return v || null;
}
const YAPLA_LABELS = [/First and last name\s*:/i, /Pr[ée]nom et nom\s*:/i, /\bPronoun\s*:/i, /\bPronom\s*:/i, /\bEmail\s*:/i, /\bCourriel\s*:/i, /\bPhone\s*:/i, /T[ée]l[ée]phone\s*:/i, /Preferred language\s*:/i, /\bLangue\s*:/i, /\bResume\s*:/i, /\bCV\s*:/i, /\bMessage\s*:/i, /As a good practice/i, /Nous recommandons/i, /Kind regards/i, /Bonne journ[ée]e/i];
function isYapla(text: string): boolean { return /(new application for the volunteer posting|nouvelle candidature pour l.offre)/i.test(decode(text)); }
function parseYapla(raw: string, html: boolean): Parsed {
  const text = html ? strip(raw) : decode(raw);
  const flat = text.replace(/\s+/g, ' ');
  const offerM = flat.match(/(?:volunteer posting|l.offre)\s*:\s*(.+?)\s*\(\s*(\d{4,6})\s*\)/i);
  const f = (a: RegExp[]) => { for (const r of a) { const v = between(flat, r, YAPLA_LABELS); if (v !== null) return v; } return null; };
  const cv = (raw.match(/https:\/\/cdn\.ca\.yapla\.com\/[^\s"'<>]+\/documents\/[^\s"'<>]+/i) || [null])[0];
  let msg = null as string | null;
  const mi = text.search(/\bMessage\s*:/i);
  if (mi >= 0) { let rest = text.slice(mi).replace(/^Message\s*:\s*/i, ''); const e = rest.search(/(As a good practice|Nous recommandons|Kind regards|Bonne journ[ée]e)/i); if (e >= 0) rest = rest.slice(0, e); msg = rest.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || null; }
  const email = (f([/\bEmail\s*:/i, /\bCourriel\s*:/i]) || '').match(/[^\s<>()]+@[^\s<>()]+\.[a-z]{2,}/i);
  return {
    platform: 'cabm', name: (f([/First and last name\s*:/i, /Pr[ée]nom et nom\s*:/i]) || '').replace(/\s+/g, ' ').trim(),
    email: email ? email[0].toLowerCase() : null, phone: (f([/\bPhone\s*:/i, /T[ée]l[ée]phone\s*:/i]) || '').replace(/[^\d+()\-. ]/g, '').trim() || null,
    language: (f([/Preferred language\s*:/i, /\bLangue\s*:/i]) || '').trim() || null, pronoun: (f([/\bPronoun\s*:/i, /\bPronom\s*:/i]) || '').trim() || null,
    offer: offerM ? offerM[1].trim() : null, offer_no: offerM ? offerM[2] : null, cv_url: cv, message: msg
  };
}
function isFcabq(subject: string, text: string): boolean { return /Soumission pour le poste/i.test(subject) || /Le candidat suivant a postul/i.test(decode(text)); }
function parseFcabq(subject: string, raw: string): Parsed {
  const text = decode(raw);
  const flat = text.replace(/\s+/g, ' ');
  const L = [/Courriel\s*:/i, /Pr[ée]nom\s*\/\s*nom\s*:/i, /T[ée]l[ée]phone\s*:/i, /Message\s*:/i, /Bien [àa] vous/i, /Je B[ée]n[ée]vole\b/i];
  const email = (between(flat, /Courriel\s*:/i, L) || '').match(/[^\s<>()]+@[^\s<>()]+\.[a-z]{2,}/i);
  const offer = (subject.match(/Soumission pour le poste\s*:\s*(.+)$/i) || flat.match(/Soumission pour le poste\s*:\s*(.+?)\s+Le candidat/i) || [null, null])[1];
  return {
    platform: 'fcabq', name: (between(flat, /Pr[ée]nom\s*\/\s*nom\s*:/i, L) || '').trim(), email: email ? email[0].toLowerCase() : null,
    phone: (between(flat, /T[ée]l[ée]phone\s*:/i, L) || '').replace(/[^\d+()\-. ]/g, '').trim() || null, language: 'French', pronoun: null,
    offer: offer ? String(offer).trim() : null, offer_no: null, cv_url: null, message: between(flat, /Message\s*:/i, [/Bien [àa] vous/i])
  };
}

/* ---- filing ---- */
let OFFERS: Record<string, string> | null = null;
async function offers(): Promise<Record<string, string>> {
  if (OFFERS) return OFFERS;
  const { data } = await svc.from('app_config').select('value').eq('key', 'cabm_offers').maybeSingle();
  try { OFFERS = JSON.parse(String(data?.value || '{}')); } catch (_) { OFFERS = {}; }
  return OFFERS!;
}
function safeName(s: string): string { return String(s || 'cv').replace(/[^\w.\-]+/g, '_').slice(0, 120); }
async function rehostCv(url: string, gmailId: string): Promise<{ path: string; name: string } | null> {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer()); if (!bytes.length || bytes.length > 20 * 1024 * 1024) return null;
    const name = decodeURIComponent(url.split('/').pop() || 'cv');
    const path = 'cabm/' + gmailId + '/' + safeName(name);
    const up = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: r.headers.get('content-type') || 'application/octet-stream', upsert: true });
    return up.error ? null : { path, name };
  } catch (_) { return null; }
}
function fmtDay(iso: string): string { return new Date(iso).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Toronto' }); }
// deno-lint-ignore no-explicit-any
async function file(row: any, p: Parsed, forwardedBy: string | null): Promise<{ outcome: string; to_type?: string; to_id?: number; note?: string }> {
  if (!p.name && !p.email) return { outcome: 'skipped', note: 'no applicant found in the email' };
  const map = await offers();
  const role = (p.offer_no && map[p.offer_no]) || p.offer || 'Volunteer';
  const { data: vr } = await svc.rpc('wa209_volunteer_roles', { p_text: role });
  const roles = (vr || []) as string[];
  const platform = p.platform === 'cabm' ? 'CABM' : 'Je Bénévole';
  const applied = String(row.internal_date || new Date().toISOString());
  const ref = p.platform + ':' + (p.email || p.name.toLowerCase()) + ':' + (p.offer_no || (p.offer || '').toLowerCase());
  if (roles.length) {
    const { data, error } = await svc.rpc('wa209_volunteer_apply', { p: { name: p.name, email: p.email, phone: p.phone, role_text: p.offer || role, roles, source: p.platform, source_ref: ref, applied_at: applied,
      message: [p.message, forwardedBy ? 'Forwarded by ' + forwardedBy : null].filter(Boolean).join('\n\n') || null, cv_url: p.cv_url, language: p.language, mail_id: row.id, by: 'applications-intake' } });
    if (error) throw new Error('volunteer: ' + error.message);
    return { outcome: data?.duplicate ? 'duplicate' : 'volunteer', to_type: 'volunteer_application', to_id: data?.application_id, note: (p.name || p.email) + ': ' + role };
  }
  // Applications: one card per person and role within 90 days
  if (p.email) {
    const { data: dup } = await svc.from('hub_candidates').select('id,role,notes').eq('email', p.email).gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()).order('created_at', { ascending: false });
    const same = (dup || []).find((c: { role: string | null }) => String(c.role || '').toLowerCase() === role.toLowerCase());
    if (same) {
      if (forwardedBy) await svc.from('hub_candidates').update({ notes: ((same as { notes: string | null }).notes ? (same as { notes: string }).notes + '\n' : '') + 'Forwarded to the team by ' + forwardedBy + ' on ' + fmtDay(applied) + '.', updated_at: new Date().toISOString(), updated_by: 'applications-intake' }).eq('id', (same as { id: number }).id);
      return { outcome: 'duplicate', to_type: 'candidate', to_id: (same as { id: number }).id, note: 'already in Applications' };
    }
  }
  const cv = p.cv_url ? await rehostCv(p.cv_url, String(row.gmail_id || row.id)) : null;
  const summary = 'Applied through ' + platform + ' on ' + fmtDay(applied) + ' (' + (p.offer || role) + (p.offer_no ? ', offer ' + p.offer_no : '') + ').' + (p.pronoun ? ' ' + p.pronoun + '.' : '') + (p.language ? ' ' + p.language + '.' : '') + (p.message ? '\n\n' + p.message : '');
  const ins = await svc.from('hub_candidates').insert({
    name: (p.name || p.email || 'Applicant').slice(0, 120), email: p.email, phone: p.phone, role, source: p.platform, mail_id: row.id, gmail_id: row.gmail_id || null,
    cv_path: cv ? cv.path : null, cv_name: cv ? cv.name : null, links: p.cv_url && !cv ? [p.cv_url] : [], summary: summary.slice(0, 4000),
    notes: forwardedBy ? 'Forwarded to the team by ' + forwardedBy + ' on ' + fmtDay(applied) + '.' : null,
    status: 'new', stage_at: new Date().toISOString(), created_at: applied, updated_at: new Date().toISOString(), updated_by: 'applications-intake'
  }).select('id').single();
  if (ins.error) throw new Error('candidate: ' + ins.error.message);
  await svc.from('change_log').insert({ entity_type: 'candidate', entity_id: String(ins.data.id), field: 'applied', old_value: null, new_value: (p.name || p.email) + ' for ' + role + ' (' + platform + (cv ? ', CV' : '') + ')', changed_by: 'applications-intake' });
  return { outcome: 'candidate', to_type: 'candidate', to_id: ins.data.id, note: (p.name || p.email) + ': ' + role };
}

// deno-lint-ignore no-explicit-any
async function one(row: any): Promise<{ outcome: string; to_type?: string; to_id?: number; note?: string }> {
  const subject = String(row.subject || ''), from = String(row.from_email || '').toLowerCase(), body = String(row.body_text || '');
  // a card mail-pull already made: a volunteer role moves to the Volunteer Manager
  if (row.filed && row.filed.type === 'candidate' && row.filed.id) {
    const { data: c } = await svc.from('hub_candidates').select('id,role,position_id').eq('id', row.filed.id).maybeSingle();
    if (!c) return { outcome: 'skipped', note: 'the card is gone' };
    let title = c.role || '';
    if (c.position_id) { const { data: pos } = await svc.from('hub_positions').select('title').eq('id', c.position_id).maybeSingle(); if (pos?.title) title = pos.title; }
    const { data: vr } = await svc.rpc('wa209_volunteer_roles', { p_text: title });
    if (!(vr || []).length) return { outcome: 'candidate', to_type: 'candidate', to_id: c.id, note: 'already in Applications' };
    const { data, error } = await svc.rpc('wa209_move_to_volunteers', { p_id: c.id, p_by: 'applications-intake' });
    if (error) throw new Error('move: ' + error.message);
    return { outcome: 'volunteer', to_type: 'volunteer_application', to_id: data?.application_id, note: 'moved from Applications: ' + title };
  }
  const yaplaDirect = /@yapla\.org$/.test(from) && /(nouvelle candidature|new application)/i.test(subject);
  if (yaplaDirect) {
    const raw = isYapla(body) ? body : await gmailHtml(String(row.gmail_id));
    return await file(row, parseYapla(raw, !isYapla(body)), null);
  }
  if (isYapla(body)) return await file(row, parseYapla(body, false), String(row.from_name || from).replace(/\s*<.*$/, '') || from);
  if (/fcabq\.org$/.test(from) || isFcabq(subject, body)) {
    if (!/Soumission pour le poste/i.test(subject + ' ' + body)) return { outcome: 'skipped', note: 'not an application' };
    return await file(row, parseFcabq(subject, body), /fcabq\.org$/.test(from) ? null : from);
  }
  return { outcome: 'skipped', note: 'not an application' };
}

async function run(sinceIso: string, limit: number) {
  const { data: rows, error } = await svc.from('hub_mail').select('id,gmail_id,from_email,from_name,subject,body_text,internal_date,filed,status')
    .gte('internal_date', sinceIso).order('internal_date', { ascending: true }).limit(500);
  if (error) throw error;
  // deno-lint-ignore no-explicit-any
  const looks = (r: any) => (/@yapla\.org$/i.test(r.from_email || '') && /(nouvelle candidature|new application)/i.test(r.subject || '')) || /fcabq\.org$/i.test(r.from_email || '') && /Soumission pour le poste/i.test(r.subject || '')
    || isYapla(String(r.body_text || '')) || /Soumission pour le poste/i.test(r.subject || '') || (r.filed && r.filed.type === 'candidate');
  const cand = (rows || []).filter(looks);
  if (!cand.length) return { looked: rows?.length || 0, filed: [] };
  const { data: done } = await svc.from('app_intake_log').select('mail_id').in('mail_id', cand.map(r => r.id));
  const seen = new Set((done || []).map(d => Number(d.mail_id)));
  const out: unknown[] = [];
  for (const r of cand.filter(r => !seen.has(Number(r.id))).slice(0, limit)) {
    let res: { outcome: string; to_type?: string; to_id?: number; note?: string };
    try { res = await one(r); } catch (e) { res = { outcome: 'error', note: String((e as Error).message || e).slice(0, 300) }; }
    if (res.outcome !== 'error') await svc.from('app_intake_log').upsert({ mail_id: r.id, outcome: res.outcome, to_type: res.to_type || null, to_id: res.to_id || null, note: res.note || null, at: new Date().toISOString() }, { onConflict: 'mail_id' });
    out.push({ mail_id: r.id, subject: r.subject, ...res });
  }
  return { looked: rows?.length || 0, candidates: cand.length, filed: out };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const secret = req.headers.get('x-wa-secret');
    const bySecret = !!secret && secret === await getSecret('WA_TRIGGER_SECRET');
    if (!bySecret && !(await staffEmail(req))) return json({ error: 'Staff only' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'run');
    if (action === 'run') {
      const since = body.since ? new Date(String(body.since)).toISOString() : new Date(Date.now() - 14 * 86400000).toISOString();
      return json(await run(since, Math.min(Number(body.limit || 40), 100)));
    }
    if (action === 'parse') {
      const subject = String(body.subject || ''), text = String(body.body || '');
      if (isYapla(text)) return json(parseYapla(text, /<\w+[^>]*>/.test(text)));
      if (isFcabq(subject, text)) return json(parseFcabq(subject, text));
      return json({ error: 'not a CABM or Je Bénévole application' });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
