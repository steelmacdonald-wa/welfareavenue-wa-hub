
/* ---------- the server (wave158b; wave185: the brand fonts, the automation caller, French) ---------- */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const BRAND = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/';
const LOGO = BRAND + 'logo-lockup-cream-1200.png';
const STAR = BRAND + 'doodle-star-gold.png';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MONTHS: Record<string, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
};
function fmtDay(d: string, lang = 'en') {
  const p = String(d || '').slice(0, 10).split('-');
  if (p.length < 3 || !/^\d{4}$/.test(p[0])) return String(d || '');
  const m = (MONTHS[lang] || MONTHS.en)[Number(p[1]) - 1];
  return (lang === 'fr' && Number(p[2]) === 1 ? '1er' : String(Number(p[2]))) + ' ' + m + ' ' + p[0];
}
/* "25 September 2026" (the database's English) in French */
function dayIn(d: string, lang: string) {
  if (lang !== 'fr') return d;
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(String(d || ''));
  if (!m) return d;
  const i = MONTHS.en.indexOf(m[2]); if (i < 0) return d;
  return (Number(m[1]) === 1 ? '1er' : m[1]) + ' ' + MONTHS.fr[i] + ' ' + m[3];
}
function b64bytes(b64: string): Uint8Array { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
const FONTS = { head: b64bytes(RECEIPT_FONT_HEAD), body: b64bytes(RECEIPT_FONT_BODY), bold: b64bytes(RECEIPT_FONT_BOLD) };
const cache: Record<string, Uint8Array | null> = {};
async function bytesOf(url: string): Promise<Uint8Array | null> {
  if (cache[url] !== undefined) return cache[url];
  try { const r = await fetch(url); cache[url] = r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch (_) { cache[url] = null; }
  return cache[url];
}
async function signature(): Promise<Uint8Array | null> {
  const { data } = await svc.storage.from('receipts').download('settings/signature.png');
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}
async function art() { const [logo, star, sig] = await Promise.all([bytesOf(LOGO), bytesOf(STAR), signature()]); return { logo, star, signature: sig }; }
async function charityExtras() {
  const { data } = await svc.from('app_config').select('key,value').in('key', ['mail_from_email']);
  const em = ((data || []).find((r: { key: string }) => r.key === 'mail_from_email') || {}).value || 'info@welfareavenue.com';
  return { web: 'welfareavenue.com', email: String(em) };
}
function b64(u8: Uint8Array) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000))); return btoa(s); }
async function sha256(u8: Uint8Array) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u8)); return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function isAutomation(req: Request): Promise<boolean> {
  const g = req.headers.get('x-wa-secret') || '';
  if (!g) return false;
  const sec = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
  return !!sec.data && g === sec.data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  /* two callers: a staff member (the database checks who is asking; the functions run as them), or the Hub's own automation
     (x-wa-secret: stripe-events and mail-send after an online gift), which reads through the service role */
  const auto = await isAutomation(req);
  const auth = req.headers.get('Authorization') || '';
  if (!auto && !auth.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401);
  const asUser = auto ? svc : createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json({ error: 'JSON body expected' }, 400); }
  const action = String(body.action || '');
  try {
    if (action === 'check') {
      /* the build's check that the drawing works here (the trigger secret only; a made-up receipt, nothing read or kept) */
      if (!auto) return json({ error: 'unauthorized' }, 401);
      const lang = body.lang === 'fr' ? 'fr' : 'en';
      const doc = {
        sample: true, serial: 'CHECK-0001', issued_date: dayIn('30 September 2026', lang), location: 'Montréal, Québec', lang,
        charity: { name: 'Welfare Avenue / Avenue du Bien-Être', address: 'A made-up address', number: '000000000RR0000', signatory_name: 'A Signatory', signatory_title: 'Treasurer', web: 'welfareavenue.com', email: 'info@welfareavenue.com' },
        donor: { name: 'Élodie Exemple', first_name: 'Élodie', address: '1 rue Exemple, Montréal QC' },
        gifts: [{ date: dayIn('9 August 2026', lang), amount: 50, advantage_amount: 30, advantage_desc: 'Playing in the tournament', eligible_amount: 20, kind: 'registration', method: 'card', platform: 'stripe' }],
        amount: 50, advantage_amount: 30, eligible_amount: 20
      };
      const a = await art();
      const pdf = await renderReceipt(PDFLib, doc, { fontkit, fonts: FONTS, logo: a.logo, star: a.star, signature: a.signature });
      /* with store: true, the made-up PDF also goes into the bucket the way an official copy does, and is removed again */
      let stored: unknown = null;
      if (body.store === true) {
        const p = 'checks/check-' + Date.now() + '.pdf';
        const up = await svc.storage.from('receipts').upload(p, new Blob([pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
        const rm = up.error ? null : await svc.storage.from('receipts').remove([p]);
        stored = { saved: !up.error, error: up.error ? up.error.message : null, removed: !!rm && !rm.error };
      }
      return json({ ok: true, bytes: pdf.length, head: new TextDecoder().decode(pdf.subarray(0, 8)), logo: !!a.logo, star: !!a.star, signature: !!a.signature, fonts: true, stored, pdf_b64: body.return === true ? b64(pdf) : undefined });
    }
    if (action === 'sample') {
      const { data: s, error } = await asUser.rpc('crm_receipt_sample', { p_gift_id: Number(body.gift_id) });
      if (error || !s) return json({ error: error ? error.message : 'No sample for that gift.' }, 403);
      const lang = body.lang === 'fr' ? 'fr' : 'en';
      const doc = {
        sample: true, serial: s.serial, issued_date: dayIn(s.issued_date, lang), location: s.location, lang,
        charity: { name: s.charity_name, address: s.charity_address, number: s.charity_number, signatory_name: s.signatory_name, signatory_title: s.signatory_title, ...(await charityExtras()) },
        donor: { name: s.donor_name || '(no name on file)', first_name: s.donor_first_name || '', address: s.donor_address || '(no address on file)' },
        gifts: [{ date: dayIn(s.gift_date, lang), amount: s.amount, advantage_amount: s.advantage_amount, advantage_desc: s.advantage_desc, eligible_amount: s.eligible_amount, kind: s.kind, in_kind_desc: s.in_kind_desc, appraiser: s.appraiser,
          method: s.method, platform: s.platform, tribute_kind: s.tribute_kind, tribute_name: s.tribute_name }],
        amount: s.amount, advantage_amount: s.advantage_amount, eligible_amount: s.eligible_amount
      };
      const a = await art();
      const pdf = await renderReceipt(PDFLib, doc, { fontkit, fonts: FONTS, logo: a.logo, star: a.star, signature: a.signature });
      return json({ ok: true, filename: 'sample-receipt.pdf', pdf_b64: b64(pdf), warnings: s.warnings || [] });
    }
    if (action === 'render') {
      const id = Number(body.receipt_id);
      const { data: d, error } = await asUser.rpc('crm_receipt_doc', { p_id: id });
      if (error || !d) return json({ error: error ? error.message : 'No such receipt.' }, 403);
      if (!auto && !d.is_admin) return json({ error: 'Only an admin draws the official copy.' }, 403);
      const cancelled = !!d.cancelled;
      if (!cancelled && d.pdf_path) return json({ ok: true, path: d.pdf_path, existing: true });
      if (cancelled && d.cancelled_pdf_path) return json({ ok: true, path: d.cancelled_pdf_path, existing: true });
      const a = await art();
      if (!a.signature) return json({ error: 'No signature image yet: an admin uploads it in Receipts.' }, 409);
      const lang = d.donor && d.donor.lang === 'fr' ? 'fr' : 'en';
      const doc = {
        sample: false, cancelled, serial: d.serial, issued_date: dayIn(d.issued_date, lang), location: d.location, replaces_serial: d.replaces_serial, lang,
        tax_year: d.tax_year, kind: d.kind, charity: { ...(d.charity || {}), ...(await charityExtras()) }, donor: d.donor,
        gifts: (d.gifts || []).map((g: Record<string, unknown>) => Object.assign({}, g, { date: fmtDay(String(g.date || ''), lang) })),
        amount: d.amount, advantage_amount: d.advantage_amount, eligible_amount: d.eligible_amount
      };
      const pdf = await renderReceipt(PDFLib, doc, { fontkit, fonts: FONTS, logo: a.logo, star: a.star, signature: a.signature, strict: true });
      const path = d.tax_year + '/' + d.serial + (cancelled ? '-cancelled' : '') + '.pdf';
      const up = await svc.storage.from('receipts').upload(path, new Blob([pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
      if (up.error) return json({ error: 'Not saved: ' + up.error.message }, 502);
      const sum = await sha256(pdf);
      const set = await svc.rpc('crm_receipt_pdf_set', { p_id: id, p_path: path, p_sha: sum, p_cancelled: cancelled });
      if (set.error) return json({ error: 'Not recorded: ' + set.error.message }, 502);
      return json({ ok: true, path, sha256: sum });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
