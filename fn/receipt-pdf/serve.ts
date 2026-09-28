
/* ---------- the server (wave158b) ---------- */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const LOGO = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/logo-primary-green-600.png';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtDay(d: string) { const p = String(d || '').slice(0, 10).split('-'); return p.length < 3 ? String(d || '') : Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0]; }
async function bytesOf(url: string): Promise<Uint8Array | null> { try { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch (_) { return null; } }
async function signature(): Promise<Uint8Array | null> {
  const { data } = await svc.storage.from('receipts').download('settings/signature.png');
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}
function b64(u8: Uint8Array) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000))); return btoa(s); }
async function sha256(u8: Uint8Array) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u8)); return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401);
  /* the database checks who is asking: the functions below run as the caller */
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json({ error: 'JSON body expected' }, 400); }
  const action = String(body.action || '');
  try {
    if (action === 'check') {
      /* the build's check that the drawing works here (the trigger secret only; a made-up receipt, nothing read or kept) */
      const g = req.headers.get('x-wa-secret') || '';
      const sec = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
      if (!g || !sec.data || g !== sec.data) return json({ error: 'unauthorized' }, 401);
      const doc = {
        sample: true, serial: 'CHECK-0001', issued_date: '28 September 2026', location: 'Montreal, Quebec',
        charity: { name: 'Welfare Avenue', address: 'A made-up address', number: '000000000RR0000', signatory_name: 'A Signatory', signatory_title: 'Treasurer' },
        donor: { name: 'Élodie Exemple', address: '1 rue Exemple, Montréal QC' },
        gifts: [{ date: '9 August 2026', amount: 50, advantage_amount: 30, advantage_desc: 'Playing in the tournament', eligible_amount: 20, kind: 'registration' }],
        amount: 50, advantage_amount: 30, eligible_amount: 20
      };
      const [logo, sig] = await Promise.all([bytesOf(LOGO), signature()]);
      const pdf = await renderReceipt(PDFLib, doc, { logo, signature: sig });
      /* with store: true, the made-up PDF also goes into the bucket the way an official copy does, and is removed again */
      let stored: unknown = null;
      if (body.store === true) {
        const p = 'checks/check-' + Date.now() + '.pdf';
        const up = await svc.storage.from('receipts').upload(p, new Blob([pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
        const rm = up.error ? null : await svc.storage.from('receipts').remove([p]);
        stored = { saved: !up.error, error: up.error ? up.error.message : null, removed: !!rm && !rm.error };
      }
      return json({ ok: true, bytes: pdf.length, head: new TextDecoder().decode(pdf.subarray(0, 8)), logo: !!logo, signature: !!sig, stored });
    }
    if (action === 'sample') {
      const { data: s, error } = await asUser.rpc('crm_receipt_sample', { p_gift_id: Number(body.gift_id) });
      if (error || !s) return json({ error: error ? error.message : 'No sample for that gift.' }, 403);
      const doc = {
        sample: true, serial: s.serial, issued_date: s.issued_date, location: s.location,
        charity: { name: s.charity_name, address: s.charity_address, number: s.charity_number, signatory_name: s.signatory_name, signatory_title: s.signatory_title },
        donor: { name: s.donor_name || '(no name on file)', address: s.donor_address || '(no address on file)' },
        gifts: [{ date: s.gift_date, amount: s.amount, advantage_amount: s.advantage_amount, advantage_desc: s.advantage_desc, eligible_amount: s.eligible_amount, kind: s.kind, in_kind_desc: s.in_kind_desc, appraiser: s.appraiser }],
        amount: s.amount, advantage_amount: s.advantage_amount, eligible_amount: s.eligible_amount
      };
      const [logo, sig] = await Promise.all([bytesOf(LOGO), signature()]);
      const pdf = await renderReceipt(PDFLib, doc, { logo, signature: sig });
      return json({ ok: true, filename: 'sample-receipt.pdf', pdf_b64: b64(pdf), warnings: s.warnings || [] });
    }
    if (action === 'render') {
      const id = Number(body.receipt_id);
      const { data: d, error } = await asUser.rpc('crm_receipt_doc', { p_id: id });
      if (error || !d) return json({ error: error ? error.message : 'No such receipt.' }, 403);
      if (!d.is_admin) return json({ error: 'Only an admin draws the official copy.' }, 403);
      const cancelled = !!d.cancelled;
      if (!cancelled && d.pdf_path) return json({ ok: true, path: d.pdf_path, existing: true });
      if (cancelled && d.cancelled_pdf_path) return json({ ok: true, path: d.cancelled_pdf_path, existing: true });
      const [logo, sig] = await Promise.all([bytesOf(LOGO), signature()]);
      if (!sig) return json({ error: 'No signature image yet: an admin uploads it in Receipts.' }, 409);
      const doc = {
        sample: false, cancelled, serial: d.serial, issued_date: d.issued_date, location: d.location, replaces_serial: d.replaces_serial,
        tax_year: d.tax_year, kind: d.kind, charity: d.charity, donor: d.donor,
        gifts: (d.gifts || []).map((g: Record<string, unknown>) => Object.assign({}, g, { date: fmtDay(String(g.date || '')) })),
        amount: d.amount, advantage_amount: d.advantage_amount, eligible_amount: d.eligible_amount
      };
      const pdf = await renderReceipt(PDFLib, doc, { logo, signature: sig, strict: true });
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
