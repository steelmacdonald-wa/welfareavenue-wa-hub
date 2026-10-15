// Welfare Avenue: form-submit (v8, 15/10/26, wave244: a multi question's options carry their description (d) and the
//   question its most picks (max, the volunteer roles: 2), checked on submit. v7, 07/10/26, wave216d: each open position option carries its job description's public PDF (u)
//   and whether it is a leadership role (lead); the positions question carries lead_note, shown by the page only when a
//   leadership role is picked. v6, 07/10/26, wave216: application forms (kind application, "Join our team"): a choice question
//   with source "positions" lists the open positions live (wa216_open_positions) plus a general application; a file question
//   takes a CV: POST {action: 'upload', slug, token, qid, name, mime, size} checks the token and the file (PDF, Word, ODT, RTF,
//   PNG or JPEG, at most 10 MB, at most 10 uploads per IP hash in 10 minutes), keeps a crm_form_uploads row and answers a
//   one-time signed upload URL into the private bucket hub-mail (applications/web/<month>/<uuid>.<ext>); the answer is the
//   upload's id, checked on submit (same form, unused, under 24 hours, the file really there and under 10 MB). Targets
//   application.position, application.cv, application.links and application.why go to mapped.application, and crm_form_apply
//   puts the person on the Applications board.
// v5, 02/10/26, wave194; v4 wave168: the form's cover photo; v3 wave162: the website preview origin)
// The public side of the CRM's forms, shown at hub.welfareavenue.com/f/<slug> (Steel, 28/09/26).
//   GET  ?slug=<slug>  The published form: questions, the email permission question, the thank-you, the open serving
//        dates for a serving_dates question, the charity's name and address (CASL), and a signed token. A draft is
//        not found; a closed form says so. v5: a question that fills a contact field says which (fill: first_name,
//        last_name, email, phone, city, province, postal_code, address, language), so the website can fill it in for a
//        signed-in person.
//   POST {slug, token, answers, consent, hp, lang}  Built-in spam checks (Steel, 28/09/26): the hidden field hp must
//        be empty and the token between 3 seconds and 24 hours old (a failure is stored as spam and answered like a
//        success, so a bot learns nothing); at most 20 submissions per IP hash in 10 minutes (a room of volunteers on
//        one Wi-Fi still fits) and 3 per email and form in an hour. The answers are checked against the questions,
//        stored in crm_form_submissions, and applied by crm_form_apply() (the contact, the MTL volunteering record,
//        roster sign-ups, custom fields, the consent with its words, a timeline entry) in one transaction. A failure
//        there keeps the submission as error for the team. A confirmation email goes through mail-send only when the
//        form's settings say so (off by default).
//        v5 (wave194, Steel 02/10/26: forms fill in from a person's profile and what they type is saved to it): when the
//        request carries a website account's own session instead of the publishable key, its user is checked
//        (auth.getUser) and kept on the submission (auth_user_id); crm_form_apply then uses that account's record.
//   Tests: POST with x-wa-secret (WA_TRIGGER_SECRET) and {"test": true} may target a draft; the submission is marked
//        is_test and no email is sent. {"action": "token"} returns a token for a draft; {"checks": true} runs the spam
//        checks as for the public (so they can be tested without publishing anything).
// Auth: verify_jwt on with the publishable (anon) key, which the public page sends like every page of the Hub, or a
// website account's session; the checks above do the rest. CORS: the Hub, the website and the Hub's Netlify name. Never
// says whether an email is already known. Secrets (vault): WA_FORM_SECRET signs the tokens and keys the IP hash;
// WA_TRIGGER_SECRET for tests and for calling mail-send. Tables: crm_forms, crm_form_submissions, volunteer_events,
// app_config (read), crm_form_apply() (write).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

// v3 (wave162, 28/09/26): the new website's preview address may show the forms too
const ORIGINS = ['https://hub.welfareavenue.com', 'https://welfareavenue.com', 'https://www.welfareavenue.com', 'https://wa-exec-dashboard.netlify.app', 'https://welfareavenue-www.netlify.app'];
const MIN_SECONDS = 3, MAX_AGE = 86400, PER_IP = 20, PER_IP_WINDOW = 10, PER_EMAIL = 3, MAX_BODY = 32000;
const TYPES = ['text', 'long_text', 'email', 'phone', 'choice', 'multi', 'yes_no', 'date', 'number', 'serving_dates', 'file'];
const CV_BUCKET = 'hub-mail', MAX_FILE = 10 * 1024 * 1024, PER_IP_UPLOADS = 10;
const FILE_EXT: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const FILLS = ['first_name', 'last_name', 'email', 'phone', 'city', 'province', 'postal_code', 'address', 'language'];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const T = {
  en: { max: 'Please pick at most {n}.', required: 'Please answer this question.', email: 'Please enter a valid email address.', phone: 'Please enter a phone number we can reach.', choice: 'Please pick one of the choices.', long: 'That answer is too long.', date: 'Please enter a date.', number: 'Please enter a number.', consent: 'Please tick the box to sign up.', yes: 'Yes', no: 'No', permission: 'Email permission', file: 'Please attach your CV: a PDF, Word document or photo, up to 10 MB.', general: 'Not sure yet: a general application' },
  fr: { max: 'Veuillez en choisir {n} au plus.', required: 'Veuillez répondre à cette question.', email: 'Veuillez entrer une adresse courriel valide.', phone: 'Veuillez entrer un numéro où vous joindre.', choice: 'Veuillez choisir une des options.', long: 'Cette réponse est trop longue.', date: 'Veuillez entrer une date.', number: 'Veuillez entrer un nombre.', consent: 'Veuillez cocher la case pour vous inscrire.', yes: 'Oui', no: 'Non', permission: 'Permission courriel', file: 'Veuillez joindre votre CV : un PDF, un document Word ou une photo, 10 Mo au plus.', general: 'Je ne sais pas encore : une candidature générale' }
};

// deno-lint-ignore no-explicit-any
type Json = any;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Max-Age': '86400' };
}
function reply(req: Request, body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
}
const secrets: Record<string, string> = {};
async function secret(name: string): Promise<string> {
  if (secrets[name]) return secrets[name];
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  secrets[name] = String(data);
  return secrets[name];
}
async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
}
function same(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function torontoDay(d = new Date()): string { return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); }
function longDate(iso: string, lang: string): string {
  const p = iso.split('-').map(Number); const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
  return lang === 'fr' ? DAY_FR[dt.getUTCDay()] + ' ' + p[2] + ' ' + MON_FR[p[1] - 1] + ' ' + p[0] : DAY_EN[dt.getUTCDay()] + ' ' + p[2] + ' ' + MON_EN[p[1] - 1] + ' ' + p[0];
}
function opts(q: Json): Array<{ v: string; l: string; d?: string }> {
  return (Array.isArray(q.options) ? q.options : []).map((o: Json) => typeof o === 'string' ? { v: o, l: o } : { v: String(o.v ?? o.value ?? ''), l: String(o.l ?? o.label ?? o.v ?? ''), ...(o.d ? { d: String(o.d) } : {}) }).filter((o: { v: string }) => o.v !== '');
}
async function openDates(form: Json): Promise<Array<{ v: string; l: string }>> {
  const loc = String((form.settings || {}).serving_location || 'Montreal');
  const { data } = await svc.from('volunteer_events').select('id,event_date,status,kind,location').eq('status', 'planned').eq('kind', 'service')
    .eq('location', loc).gte('event_date', torontoDay()).order('event_date', { ascending: true }).limit(12);
  return (data || []).map((e: Json) => ({ v: String(e.id), l: longDate(String(e.event_date), form.lang) }));
}
// v6 (wave216): the open positions for a choice question with source "positions", and a general application
async function positionOpts(lang: string): Promise<Array<{ v: string; l: string }>> {
  const { data } = await svc.rpc('wa216_open_positions');
  return [...((data || []) as Json[]).map((p: Json) => ({ v: 'p:' + p.id, l: String(p.title), ...(p.jd_url ? { u: String(p.jd_url) } : {}), ...(p.leadership ? { lead: true } : {}) })), { v: 'general', l: T[lang === 'fr' ? 'fr' : 'en'].general }];
}
async function org(): Promise<Json> {
  const { data } = await svc.from('app_config').select('key,value').in('key', ['mail_from_name', 'mail_postal_address', 'mail_reply_to', 'mail_charity_number']);
  const m: Record<string, string> = {}; (data || []).forEach((r: Json) => { m[r.key] = r.value; });
  return { name: m.mail_from_name || 'Welfare Avenue', address: m.mail_postal_address || '', email: m.mail_reply_to || 'info@welfareavenue.com', charity: m.mail_charity_number || '' };
}
// v4 (wave168): the photo at the top of the public page: the form's cover (crm_forms.cover_photo_id, a Photo library photo),
// or the default for its kind. Only photos marked ready (team, volunteers, food; no close-ups of the people we serve): a
// cover that stopped being ready gives way to the default. Only the public web size, where to hold the crop and the words
// for screen readers.
const COVER_BY_KIND: Record<string, number> = { volunteer: 9, newsletter: 3, general: 26 };
const STORAGE = SUPABASE_URL + '/storage/v1/object/public/content-images/';
async function photoOut(id: number): Promise<Json> {
  if (!id) return null;
  const { data } = await svc.from('wa_photos').select('path_web,focal_x,focal_y,alt_text,usage').eq('id', id).maybeSingle();
  if (!data || !data.path_web || data.usage !== 'ready') return null;
  return { url: STORAGE + String(data.path_web).replace(/^\/+/, ''), fx: data.focal_x ?? 0.5, fy: data.focal_y ?? 0.5, alt: data.alt_text || '' };
}
async function coverOf(form: Json): Promise<Json> {
  const own = Number(form.cover_photo_id || 0), def = Number(COVER_BY_KIND[String(form.kind)] || COVER_BY_KIND.general);
  return (own ? await photoOut(own) : null) || await photoOut(def);
}
async function publicForm(form: Json): Promise<Json> {
  const dates = (form.questions || []).some((q: Json) => q.type === 'serving_dates') ? await openDates(form) : [];
  const positions = (form.questions || []).some((q: Json) => q && q.source === 'positions') ? await positionOpts(form.lang) : [];
  return {
    slug: form.slug, title: form.title, intro: form.intro || '', lang: form.lang, kind: form.kind, thank_you: form.thank_you || '', cover: await coverOf(form),
    questions: (form.questions || []).filter((q: Json) => q && TYPES.includes(q.type)).map((q: Json) => {
      const to = String(q.to || ''), fill = to.startsWith('contact.') && FILLS.includes(to.slice(8)) ? to.slice(8) : '';
      return {
        id: String(q.id), type: q.type, label: String(q.label || ''), help: q.help ? String(q.help) : '', required: !!q.required,
        options: q.type === 'serving_dates' ? dates : q.source === 'positions' ? positions : opts(q), ...(fill ? { fill } : {}),
        ...(q.source === 'positions' && q.lead_note ? { lead_note: String(q.lead_note) } : {}),
        ...(q.type === 'multi' && Number(q.max) > 0 ? { max: Number(q.max) } : {}),   // v8 (wave244)
        ...(q.type === 'file' ? { accept: Object.keys(FILE_EXT).map(x => '.' + x).join(','), max_mb: MAX_FILE / 1048576 } : {})
      };
    }),
    consent: form.consent && form.consent.ask ? { ask: true, required: !!form.consent.required, label: String(form.consent.label || '') } : { ask: false }
  };
}
async function loadForm(slug: string): Promise<Json> {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return null;
  const { data } = await svc.from('crm_forms').select('*').eq('slug', slug).maybeSingle();
  return data || null;
}
function clientIp(req: Request): string {
  return (req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || req.headers.get('x-real-ip') || '').trim();
}
// v5 (wave194): the website account behind this request, when it carries a person's own session (not the publishable key)
async function accountOf(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === ANON_KEY) return null;
  try {
    const { data, error } = await svc.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user.id;
  } catch (_) { return null; }
}

// ---------- the answers against the questions ----------
function check(form: Json, pub: Json, answers: Json, consentGiven: boolean) {
  const t = T[form.lang === 'fr' ? 'fr' : 'en'];
  const errors: Record<string, string> = {};
  const clean: Record<string, Json> = {};
  const mapped: Json = { contact: {}, fields: {} };
  const display: Array<{ label: string; value: string }> = [];
  const byId: Record<string, Json> = {}; (form.questions || []).forEach((q: Json) => { byId[String(q.id)] = q; });
  for (const pq of pub.questions) {
    const q = byId[pq.id] || {};
    const raw = answers ? answers[pq.id] : undefined;
    let val: Json = null, shown = '';
    const empty = raw == null || (typeof raw === 'string' && raw.trim() === '') || (Array.isArray(raw) && raw.length === 0);
    if (empty) { if (pq.required) errors[pq.id] = pq.type === 'file' ? t.file : t.required; continue; }
    const s = typeof raw === 'string' ? raw.trim() : '';
    switch (pq.type) {
      case 'text': if (typeof raw !== 'string') { errors[pq.id] = t.required; break; } if (s.length > 200) { errors[pq.id] = t.long; break; } val = s; shown = s; break;
      case 'long_text': if (typeof raw !== 'string') { errors[pq.id] = t.required; break; } if (s.length > 2000) { errors[pq.id] = t.long; break; } val = s; shown = s; break;
      case 'email': { const e = s.toLowerCase(); if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { errors[pq.id] = t.email; break; } val = e; shown = e; break; }
      case 'phone': { if (s.length > 40 || !/^[0-9+().\s-]+$/.test(s) || s.replace(/\D/g, '').length < 7) { errors[pq.id] = t.phone; break; } val = s; shown = s; break; }
      case 'number': { const n = Number(s); if (s === '' || !isFinite(n)) { errors[pq.id] = t.number; break; } val = n; shown = String(n); break; }
      case 'date': { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) { errors[pq.id] = t.date; break; } val = s; shown = s; break; }
      case 'yes_no': { if (s !== 'yes' && s !== 'no') { errors[pq.id] = t.choice; break; } val = s === 'yes'; shown = val ? t.yes : t.no; break; }
      case 'choice': { const o = pq.options.find((x: Json) => x.v === s); if (!o) { errors[pq.id] = t.choice; break; } val = o.v; shown = o.l; break; }
      case 'file': { if (!raw || typeof raw !== 'object' || !raw.path) { errors[pq.id] = t.file; break; } val = { path: String(raw.path), name: String(raw.name || 'CV') }; shown = String(raw.name || 'CV'); break; }
      case 'multi': case 'serving_dates': {
        const list = Array.isArray(raw) ? raw.map((x: Json) => String(x)) : [];
        const picked = pq.options.filter((o: Json) => list.includes(o.v));
        if (picked.length !== new Set(list).size) { errors[pq.id] = t.choice; break; }
        if (!picked.length) { if (pq.required) errors[pq.id] = t.required; break; }
        if (pq.max && picked.length > pq.max) { errors[pq.id] = t.max.replace('{n}', String(pq.max)); break; }   // v8 (wave244)
        val = picked.map((o: Json) => o.v); shown = picked.map((o: Json) => o.l).join(', '); break;
      }
    }
    if (errors[pq.id] || val == null) continue;
    clean[pq.id] = val;
    display.push({ label: pq.label, value: shown });
    const to = String(q.to || '');
    if (to.startsWith('contact.')) mapped.contact[to.slice(8)] = typeof val === 'string' ? val : String(val);
    else if (to === 'volunteer.roles') mapped.roles = Array.isArray(val) ? val : [val];
    else if (to === 'volunteer.dates') mapped.dates = Array.isArray(val) ? val : [val];
    else if (to.startsWith('field:')) mapped.fields[to.slice(6)] = val;
    else if (to === 'note') mapped.note = String(val);
    else if (to.startsWith('application.')) {
      mapped.application = mapped.application || {};
      const k = to.slice(12);
      if (k === 'links') mapped.application.links = String(val).split(/[\s,]+/).map((x: string) => x.trim()).filter((x: string) => /^https?:\/\/\S+\.\S+/i.test(x) || /^(www\.|linkedin\.com)/i.test(x)).slice(0, 5);
      else if (k === 'position' || k === 'why' || k === 'cv') mapped.application[k] = val;
    }
  }
  if (pub.consent.ask) {
    if (pub.consent.required && !consentGiven) errors._consent = t.consent;
    mapped.consent = consentGiven;
    display.push({ label: t.permission, value: consentGiven ? t.yes + ': "' + pub.consent.label + '"' : t.no });
  }
  if (!mapped.contact.email && !Object.keys(errors).length) errors._form = 'This form has no email question.';
  return { errors, clean, mapped, display };
}

// v6 (wave216): a CV for a file question
async function tokenOk(form: Json, tok: string, fsec: string): Promise<boolean> {
  const [tsStr, sig] = String(tok || '').split('.'); const ts = Number(tsStr), age = Math.floor(Date.now() / 1000) - ts;
  return !!sig && isFinite(ts) && age <= MAX_AGE && age >= 0 && same(sig, (await hmac(fsec, 'form|' + form.slug + '|' + ts)).slice(0, 32));
}
async function uploadLink(form: Json, pub: Json, body: Json, fsec: string, ipHash: string | null, checks: boolean): Promise<[Json, number]> {
  const q = pub.questions.find((x: Json) => x.id === String(body.qid || '') && x.type === 'file');
  if (!q) return [{ error: 'no_question' }, 400];
  if (checks && !(await tokenOk(form, body.token, fsec))) return [{ error: 'expired' }, 400];
  const name = String(body.name || '').replace(/[\u0000-\u001f\/\\]/g, ' ').trim().slice(0, 120) || 'CV';
  const ext = (name.match(/\.([a-z0-9]{2,5})$/i) || ['', ''])[1].toLowerCase();
  const size = Number(body.size || 0);
  if (!FILE_EXT[ext] || !(size > 0) || size > MAX_FILE) return [{ error: 'file', fields: { [q.id]: T[form.lang === 'fr' ? 'fr' : 'en'].file } }, 400];
  if (checks && ipHash) {
    const since = new Date(Date.now() - PER_IP_WINDOW * 60000).toISOString();
    const { count } = await svc.from('crm_form_uploads').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
    if ((count || 0) >= PER_IP_UPLOADS) return [{ error: 'rate' }, 429];
  }
  const id = crypto.randomUUID();
  const path = 'applications/web/' + torontoDay().slice(0, 7) + '/' + id + '.' + ext;
  const ins = await svc.from('crm_form_uploads').insert({ id, form_id: form.id, question_id: q.id, path, name, mime: FILE_EXT[ext], size_hint: Math.round(size), ip_hash: ipHash });
  if (ins.error) return [{ error: 'store_failed' }, 500];
  const signed = await svc.storage.from(CV_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return [{ error: 'store_failed' }, 500];
  return [{ ok: true, upload_id: id, url: signed.data.signedUrl, mime: FILE_EXT[ext] }, 200];
}
// each file answer (an upload id) becomes {path, name} when the upload is this form's, unused, under a day old and really there
async function resolveFiles(form: Json, pub: Json, answers: Json): Promise<string[]> {
  const used: string[] = [];
  for (const q of pub.questions.filter((x: Json) => x.type === 'file')) {
    const id = answers[q.id];
    answers[q.id] = null;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    const { data: u } = await svc.from('crm_form_uploads').select('*').eq('id', id).eq('form_id', form.id).eq('question_id', q.id).is('used_at', null).maybeSingle();
    if (!u || Date.now() - new Date(u.created_at).getTime() > MAX_AGE * 1000) continue;
    const dir = u.path.slice(0, u.path.lastIndexOf('/')), file = u.path.slice(u.path.lastIndexOf('/') + 1);
    const { data: list } = await svc.storage.from(CV_BUCKET).list(dir, { search: file, limit: 2 });
    const obj = (list || []).find((o: Json) => o.name === file);
    const sz = Number(obj && obj.metadata && obj.metadata.size || 0);
    if (!obj || !(sz > 0) || sz > MAX_FILE) continue;
    answers[q.id] = { path: u.path, name: u.name };
    used.push(u.id);
  }
  return used;
}

async function confirmEmail(form: Json, contactId: number) {
  const st = form.settings || {};
  if (!st.confirm || !st.confirm_template || !contactId) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/mail-send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'x-wa-secret': await secret('WA_TRIGGER_SECRET') },
      body: JSON.stringify({ action: 'send', template_key: String(st.confirm_template), contact_id: contactId })
    });
    return { status: r.status };
  } catch (e) { return { error: String((e as Error).message || e) }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    if (req.method === 'GET') {
      const slug = new URL(req.url).searchParams.get('slug') || '';
      const form = await loadForm(slug);
      if (!form || form.status === 'draft') return reply(req, { error: 'not_found' }, 404);
      if (form.status === 'closed') return reply(req, { closed: true, title: form.title, lang: form.lang, kind: form.kind, cover: await coverOf(form), org: await org() });
      const ts = Math.floor(Date.now() / 1000);
      const token = ts + '.' + (await hmac(await secret('WA_FORM_SECRET'), 'form|' + form.slug + '|' + ts)).slice(0, 32);
      return reply(req, { form: await publicForm(form), org: await org(), token });
    }
    if (req.method !== 'POST') return reply(req, { error: 'method' }, 405);
    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(req, { error: 'too_large' }, 413);
    let body: Json; try { body = JSON.parse(raw); } catch (_) { return reply(req, { error: 'bad_json' }, 400); }
    const given = req.headers.get('x-wa-secret') || '';
    const isTest = body.test === true && !!given && same(given, await secret('WA_TRIGGER_SECRET'));
    const form = await loadForm(String(body.slug || ''));
    if (!form || (form.status === 'draft' && !isTest)) return reply(req, { error: 'not_found' }, 404);
    if (form.status === 'closed') return reply(req, { error: 'closed' }, 410);
    const fsec = await secret('WA_FORM_SECRET');
    const ip = clientIp(req);
    const ipHash = ip ? (await hmac(fsec, 'ip|' + ip)).slice(0, 24) : null;
    const ua = (req.headers.get('user-agent') || '').slice(0, 200);
    const pub = await publicForm(form);
    const ok = { ok: true, thank_you: form.thank_you || '' };
    if (isTest && body.action === 'token') {
      const ts = Math.floor(Date.now() / 1000) - Math.max(0, Math.min(MAX_AGE + 60, Number(body.age) || 0));
      return reply(req, { token: ts + '.' + (await hmac(fsec, 'form|' + form.slug + '|' + ts)).slice(0, 32) });
    }
    const checks = !isTest || body.checks === true;
    if (body.action === 'upload') return reply(req, ...(await uploadLink(form, pub, body, fsec, ipHash, checks)));

    if (checks) {
      // the hidden field and the token's age: a failure is kept as spam and answered like a success
      const tok = String(body.token || ''); const [tsStr, sig] = tok.split('.');
      const ts = Number(tsStr), age = Math.floor(Date.now() / 1000) - ts;
      const sigOk = !!sig && isFinite(ts) && same(sig, (await hmac(fsec, 'form|' + form.slug + '|' + ts)).slice(0, 32));
      if (sigOk && age > MAX_AGE) return reply(req, { error: 'expired' }, 400);
      const spam = (body.hp != null && String(body.hp).trim() !== '') ? 'hidden field filled' : !sigOk ? 'bad token' : age < MIN_SECONDS ? 'sent too fast (' + age + ' s)' : '';
      if (spam) {
        await svc.from('crm_form_submissions').insert({ form_id: form.id, status: 'spam', answers: {}, display: [], mapped: {}, lang: form.lang, ip_hash: ipHash, user_agent: ua, error: spam, is_test: isTest });
        if (isTest) return reply(req, { ...ok, spam });
        return reply(req, ok);
      }
      if (ipHash) {
        const since = new Date(Date.now() - PER_IP_WINDOW * 60000).toISOString();
        const { count } = await svc.from('crm_form_submissions').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
        if ((count || 0) >= PER_IP) return reply(req, { error: 'rate' }, 429);
      }
    }

    const answers = body.answers || {};
    const uploads = await resolveFiles(form, pub, answers);
    const res = check(form, pub, answers, body.consent === true);
    if (Object.keys(res.errors).length) return reply(req, { error: 'invalid', fields: res.errors }, 400);
    const email = String(res.mapped.contact.email || '');
    if (checks) {
      const since = new Date(Date.now() - 3600000).toISOString();
      const { count } = await svc.from('crm_form_submissions').select('id', { count: 'exact', head: true }).eq('form_id', form.id)
        .eq('mapped->contact->>email', email).gte('created_at', since).in('status', ['received', 'processed', 'error']);
      if ((count || 0) >= PER_EMAIL) return reply(req, { error: 'rate' }, 429);
    }
    const account = await accountOf(req);
    const consent = pub.consent.ask ? { asked: pub.consent.label, given: body.consent === true, at: new Date().toISOString(), form: form.slug, ...(account ? { account: true } : {}) } : null;
    const ins = await svc.from('crm_form_submissions').insert({
      form_id: form.id, status: 'received', answers: res.clean, display: res.display, mapped: res.mapped, consent,
      lang: form.lang, ip_hash: ipHash, user_agent: ua, is_test: isTest, auth_user_id: account
    }).select('id').single();
    if (ins.error || !ins.data) return reply(req, { error: 'store_failed' }, 500);
    const sid = (ins.data as Json).id;
    if (uploads.length) await svc.from('crm_form_uploads').update({ used_at: new Date().toISOString(), submission_id: sid }).in('id', uploads);
    const applied = await svc.rpc('crm_form_apply', { p_submission_id: sid });
    if (applied.error) {
      await svc.from('crm_form_submissions').update({ status: 'error', error: String(applied.error.message || applied.error).slice(0, 400) }).eq('id', sid);
      return reply(req, isTest ? { ...ok, submission_id: sid, applied: false, error: applied.error.message } : ok);
    }
    const result = applied.data as Json;
    const mail = isTest ? null : await confirmEmail(form, Number(result && result.contact_id));
    if (mail) await svc.from('crm_form_submissions').update({ result: { ...result, confirmation: mail } }).eq('id', sid);
    return reply(req, isTest ? { ...ok, submission_id: sid, applied: true, result, account: !!account } : { ...ok, ...(account ? { saved: !!(result && result.account) } : {}) });
  } catch (e) {
    return reply(req, { error: 'server', detail: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
