// Welfare Avenue: form-submit (v4, 29/09/26, wave156; v3 wave162: the website preview origin; v4 wave168: the form's cover photo)
// The public side of the CRM's forms, shown at hub.welfareavenue.com/f/<slug> (Steel, 28/09/26).
//   GET  ?slug=<slug>  The published form: questions, the email permission question, the thank-you, the open serving
//        dates for a serving_dates question, the charity's name and address (CASL), and a signed token. A draft is
//        not found; a closed form says so.
//   POST {slug, token, answers, consent, hp, lang}  Built-in spam checks (Steel, 28/09/26): the hidden field hp must
//        be empty and the token between 3 seconds and 24 hours old (a failure is stored as spam and answered like a
//        success, so a bot learns nothing); at most 20 submissions per IP hash in 10 minutes (a room of volunteers on
//        one Wi-Fi still fits) and 3 per email and form in an hour. The answers are checked against the questions,
//        stored in crm_form_submissions, and applied by crm_form_apply() (the contact, the MTL volunteering record,
//        roster sign-ups, custom fields, the consent with its words, a timeline entry) in one transaction. A failure
//        there keeps the submission as error for the team. A confirmation email goes through mail-send only when the
//        form's settings say so (off by default).
//   Tests: POST with x-wa-secret (WA_TRIGGER_SECRET) and {"test": true} may target a draft; the submission is marked
//        is_test and no email is sent. {"action": "token"} returns a token for a draft; {"checks": true} runs the spam
//        checks as for the public (so they can be tested without publishing anything).
// Auth: verify_jwt on with the publishable (anon) key, which the public page sends like every page of the Hub; the
// checks above do the rest. CORS: the Hub, the website and the Hub's Netlify name. Never says whether an email is
// already known. Secrets (vault): WA_FORM_SECRET signs the tokens and keys the IP hash;
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
const TYPES = ['text', 'long_text', 'email', 'phone', 'choice', 'multi', 'yes_no', 'date', 'number', 'serving_dates'];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const T = {
  en: { required: 'Please answer this question.', email: 'Please enter a valid email address.', phone: 'Please enter a phone number we can reach.', choice: 'Please pick one of the choices.', long: 'That answer is too long.', date: 'Please enter a date.', number: 'Please enter a number.', consent: 'Please tick the box to sign up.', yes: 'Yes', no: 'No', permission: 'Email permission' },
  fr: { required: 'Veuillez répondre à cette question.', email: 'Veuillez entrer une adresse courriel valide.', phone: 'Veuillez entrer un numéro où vous joindre.', choice: 'Veuillez choisir une des options.', long: 'Cette réponse est trop longue.', date: 'Veuillez entrer une date.', number: 'Veuillez entrer un nombre.', consent: 'Veuillez cocher la case pour vous inscrire.', yes: 'Oui', no: 'Non', permission: 'Permission courriel' }
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
function opts(q: Json): Array<{ v: string; l: string }> {
  return (Array.isArray(q.options) ? q.options : []).map((o: Json) => typeof o === 'string' ? { v: o, l: o } : { v: String(o.v ?? o.value ?? ''), l: String(o.l ?? o.label ?? o.v ?? '') }).filter((o: { v: string }) => o.v !== '');
}
async function openDates(form: Json): Promise<Array<{ v: string; l: string }>> {
  const loc = String((form.settings || {}).serving_location || 'Montreal');
  const { data } = await svc.from('volunteer_events').select('id,event_date,status,kind,location').eq('status', 'planned').eq('kind', 'service')
    .eq('location', loc).gte('event_date', torontoDay()).order('event_date', { ascending: true }).limit(12);
  return (data || []).map((e: Json) => ({ v: String(e.id), l: longDate(String(e.event_date), form.lang) }));
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
  return {
    slug: form.slug, title: form.title, intro: form.intro || '', lang: form.lang, kind: form.kind, thank_you: form.thank_you || '', cover: await coverOf(form),
    questions: (form.questions || []).filter((q: Json) => q && TYPES.includes(q.type)).map((q: Json) => ({
      id: String(q.id), type: q.type, label: String(q.label || ''), help: q.help ? String(q.help) : '', required: !!q.required,
      options: q.type === 'serving_dates' ? dates : opts(q)
    })),
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
    if (empty) { if (pq.required) errors[pq.id] = t.required; continue; }
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
      case 'multi': case 'serving_dates': {
        const list = Array.isArray(raw) ? raw.map((x: Json) => String(x)) : [];
        const picked = pq.options.filter((o: Json) => list.includes(o.v));
        if (picked.length !== new Set(list).size) { errors[pq.id] = t.choice; break; }
        if (!picked.length) { if (pq.required) errors[pq.id] = t.required; break; }
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
  }
  if (pub.consent.ask) {
    if (pub.consent.required && !consentGiven) errors._consent = t.consent;
    mapped.consent = consentGiven;
    display.push({ label: t.permission, value: consentGiven ? t.yes + ': "' + pub.consent.label + '"' : t.no });
  }
  if (!mapped.contact.email && !Object.keys(errors).length) errors._form = 'This form has no email question.';
  return { errors, clean, mapped, display };
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

    const res = check(form, pub, body.answers || {}, body.consent === true);
    if (Object.keys(res.errors).length) return reply(req, { error: 'invalid', fields: res.errors }, 400);
    const email = String(res.mapped.contact.email || '');
    if (checks) {
      const since = new Date(Date.now() - 3600000).toISOString();
      const { count } = await svc.from('crm_form_submissions').select('id', { count: 'exact', head: true }).eq('form_id', form.id)
        .eq('mapped->contact->>email', email).gte('created_at', since).in('status', ['received', 'processed', 'error']);
      if ((count || 0) >= PER_EMAIL) return reply(req, { error: 'rate' }, 429);
    }
    const consent = pub.consent.ask ? { asked: pub.consent.label, given: body.consent === true, at: new Date().toISOString(), form: form.slug } : null;
    const ins = await svc.from('crm_form_submissions').insert({
      form_id: form.id, status: 'received', answers: res.clean, display: res.display, mapped: res.mapped, consent,
      lang: form.lang, ip_hash: ipHash, user_agent: ua, is_test: isTest
    }).select('id').single();
    if (ins.error || !ins.data) return reply(req, { error: 'store_failed' }, 500);
    const sid = (ins.data as Json).id;
    const applied = await svc.rpc('crm_form_apply', { p_submission_id: sid });
    if (applied.error) {
      await svc.from('crm_form_submissions').update({ status: 'error', error: String(applied.error.message || applied.error).slice(0, 400) }).eq('id', sid);
      return reply(req, isTest ? { ...ok, submission_id: sid, applied: false, error: applied.error.message } : ok);
    }
    const result = applied.data as Json;
    const mail = isTest ? null : await confirmEmail(form, Number(result && result.contact_id));
    if (mail) await svc.from('crm_form_submissions').update({ result: { ...result, confirmation: mail } }).eq('id', sid);
    return reply(req, isTest ? { ...ok, submission_id: sid, applied: true, result } : ok);
  } catch (e) {
    return reply(req, { error: 'server', detail: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
