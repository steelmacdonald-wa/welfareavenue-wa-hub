// Welfare Avenue: receipt-pdf (v1, 28/09/26 Toronto, wave158b)
// Draws CRA donation receipts as PDFs (pdf-lib). Built from render.js (the drawing, also run by the local check) and serve.ts
// by build.py: edit those two, then rebuild this file.
// Actions (a staff JWT; the database checks the caller, the functions below run as them):
//   sample {gift_id}     -> a sample for one gift from crm_receipt_sample: marked SAMPLE, never numbered, kept or sent (pdf_b64)
//   check                -> the build's check that the drawing works (x-wa-secret; a made-up receipt, nothing read or kept)
//   render {receipt_id}  -> the official copy of an issued receipt (admins; crm_receipt_doc), drawn once into the private bucket
//                           receipts (<tax year>/<serial>.pdf) with its checksum (crm_receipt_pdf_set); a cancelled receipt gets
//                           its copy marked CANCELLED beside it (<serial>-cancelled.pdf). Returns the path.
// The signature is the image an admin uploaded to receipts/settings/signature.png; the logo is the Hub's brand logo. A name the
// PDF font cannot print stops an official copy (issue that one by hand); a sample shows ? instead.
// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as PDFLib from 'npm:pdf-lib@1.17.1';

/* The receipt drawn as a PDF (wave158b, 28/09/26). Plain JavaScript with no imports, so the same code runs in the edge function
   (pdf-lib from npm) and in the local check (node). renderReceipt(lib, doc, opt) returns the PDF bytes.
   doc: { sample, cancelled, serial, issued_date, location, replaces_serial, tax_year, kind ('single' | 'annual'),
          charity: { name, address, number, signatory_name, signatory_title }, donor: { name, address },
          gifts: [{ date, amount, advantage_amount, advantage_desc, eligible_amount, kind, in_kind_desc, appraiser }],
          amount, advantage_amount, eligible_amount }
   opt: { logo (PNG bytes), signature (PNG bytes), strict (refuse text the font cannot print instead of replacing it) }
   Every field the CRA requires on an official donation receipt (canada.ca, read 28/09/26): the statement, the charity's name and
   address as on file, the registration number, the serial number, where it was issued, the date of the gift (or the year for a
   receipt covering several gifts), the date issued, the donor's name and address, the amount, the value and description of the
   advantage, the eligible amount, an authorized signature, the CRA's name and website; for a gift in kind, its description and
   the appraiser; a replacement says which receipt it cancels and replaces. */
var RECEIPT_CRA = 'Canada Revenue Agency: canada.ca/charities-giving';
function receiptMoney(n) {
  var v = Math.round((Number(n) || 0) * 100) / 100, s = v.toFixed(2).split('.');
  return '$' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
}
/* WinAnsi (the standard PDF fonts) prints Western European letters; typographic quotes and dashes are mapped, anything else is
   refused on an official receipt (strict) or shown as ? on a sample */
function receiptText(s, strict) {
  s = String(s == null ? '' : s).replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ').replace(/[\r\n\t]+/g, ' ');
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || c === 0x152 || c === 0x153 || c === 0x160 || c === 0x161 || c === 0x178 || c === 0x17d || c === 0x17e || c === 0x20ac) out += s.charAt(i);
    else if (strict) throw new Error('The receipt font cannot print "' + s + '": issue this receipt by hand.');
    else out += '?';
  }
  return out;
}
async function renderReceipt(lib, doc, opt) {
  opt = opt || {};
  var strict = !!opt.strict;
  var T = function (s) { return receiptText(s, strict); };
  var pdf = await lib.PDFDocument.create();
  pdf.setTitle(doc.sample ? 'Sample receipt' : 'Official receipt ' + T(doc.serial));
  pdf.setAuthor(T((doc.charity || {}).name || 'Welfare Avenue'));
  pdf.setSubject('Official receipt for income tax purposes');
  pdf.setCreator('Welfare Avenue Hub'); pdf.setProducer('Welfare Avenue Hub');
  var page = pdf.addPage([612, 792]);
  var font = await pdf.embedFont(lib.StandardFonts.Helvetica), bold = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  var GREEN = lib.rgb(16 / 255, 63 / 255, 57 / 255), INK = lib.rgb(31 / 255, 32 / 255, 30 / 255), MUTED = lib.rgb(0.45, 0.45, 0.43), GOLD = lib.rgb(220 / 255, 165 / 255, 39 / 255), LINE = lib.rgb(0.82, 0.84, 0.83);
  var L = 54, R = 558, y = 738;
  function text(s, x, yy, size, f, color) { page.drawText(T(s), { x: x, y: yy, size: size, font: f || font, color: color || INK }); }
  function width(s, size, f) { return (f || font).widthOfTextAtSize(T(s), size); }
  function wrap(s, maxW, size, f) {
    var words = T(s).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (width(t, size, f) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  /* the header: the logo if there is one, the charity as on file with the CRA */
  var hx = L;
  if (opt.logo) {
    try { var img = await pdf.embedPng(opt.logo), sc = Math.min(120 / img.width, 48 / img.height); page.drawImage(img, { x: L, y: y - img.height * sc + 12, width: img.width * sc, height: img.height * sc }); hx = L + img.width * sc + 18; } catch (e) { /* no logo */ }
  }
  var ch = doc.charity || {};
  text(ch.name || '', hx, y, 16, bold, GREEN);
  var ay = y - 16;
  wrap(ch.address || '', R - hx, 9.5).forEach(function (l) { text(l, hx, ay, 9.5, font, INK); ay -= 12; });
  text('Charitable registration number: ' + (ch.number || ''), hx, ay, 9.5, font, INK);
  y = Math.min(ay, y - 52) - 22;
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 2, color: GOLD });
  y -= 24;
  text('OFFICIAL RECEIPT FOR INCOME TAX PURPOSES', L, y, 14, bold, GREEN);
  y -= 22;
  if (doc.replaces_serial) { text('This receipt cancels and replaces receipt number ' + doc.replaces_serial + '.', L, y, 10.5, bold, INK); y -= 18; }
  /* label and value rows */
  var LW = 200;
  function row(label, value, strong) {
    var lines = wrap(value == null || value === '' ? '-' : value, R - L - LW, 10.5, strong ? bold : font);
    text(label, L, y, 10, font, MUTED);
    lines.forEach(function (l, i) { text(l, L + LW, y - i * 13, 10.5, strong ? bold : font, INK); });
    y -= Math.max(1, lines.length) * 13 + 5;
    page.drawLine({ start: { x: L, y: y + 2 }, end: { x: R, y: y + 2 }, thickness: 0.4, color: LINE });
    y -= 7;
  }
  var gifts = doc.gifts || [], one = gifts.length <= 1, g0 = gifts[0] || {};
  row('Receipt number', (doc.serial || '') + (doc.sample ? ' (sample)' : ''), true);
  row('Date issued', doc.issued_date);
  row('Place issued', doc.location);
  row('Received from', (doc.donor || {}).name);
  row('Address', (doc.donor || {}).address);
  if (one) {
    row('Date the gift was received', g0.date);
    if (g0.kind === 'in_kind') {
      row('Description of the gift', g0.in_kind_desc);
      if (g0.appraiser) row('Appraised by', g0.appraiser);
    }
    row(g0.kind === 'in_kind' ? 'Fair market value of the gift' : 'Total amount received', receiptMoney(doc.amount));
    row('Value of the advantage', receiptMoney(doc.advantage_amount) + (Number(doc.advantage_amount) > 0 && g0.advantage_desc ? ' (' + g0.advantage_desc + ')' : ''));
  } else {
    row('Gifts received in', String(doc.tax_year || '') + ' (' + gifts.length + ' gifts, listed below)');
    row('Total amount received', receiptMoney(doc.amount));
    row('Value of the advantages', receiptMoney(doc.advantage_amount));
  }
  row('Eligible amount of the gift for tax purposes', receiptMoney(doc.eligible_amount), true);
  if (!one) {
    y -= 4;
    var cols = [L, L + 130, L + 215, L + 400];
    var fit = function (s, maxW) { s = T(s); if (width(s, 9) <= maxW) return s; while (s.length > 1 && width(s + '...', 9) > maxW) s = s.slice(0, -1); return s + '...'; };
    ['Date received', 'Amount', 'Advantage', 'Eligible amount'].forEach(function (h, i) { text(h, cols[i], y, 9, bold, GREEN); });
    y -= 13;
    gifts.slice(0, 24).forEach(function (g) {
      text(g.date || '', cols[0], y, 9); text(receiptMoney(g.amount), cols[1], y, 9);
      text(fit(receiptMoney(g.advantage_amount) + (Number(g.advantage_amount) > 0 && g.advantage_desc ? ' (' + g.advantage_desc + ')' : ''), cols[3] - cols[2] - 10), cols[2], y, 9);
      text(receiptMoney(g.eligible_amount), cols[3], y, 9); y -= 12;
    });
    if (gifts.length > 24) { text('and ' + (gifts.length - 24) + ' more gifts in ' + doc.tax_year, cols[0], y, 9, font, MUTED); y -= 12; }
    y -= 6;
  }
  /* the signature */
  y -= 10;
  var sy = Math.max(y - 56, 120);
  if (opt.signature) {
    try { var sig = await pdf.embedPng(opt.signature), ss = Math.min(170 / sig.width, 48 / sig.height); page.drawImage(sig, { x: L, y: sy + 4, width: sig.width * ss, height: sig.height * ss }); } catch (e) { /* drawn without it */ }
  }
  page.drawLine({ start: { x: L, y: sy }, end: { x: L + 220, y: sy }, thickness: 0.8, color: INK });
  text('Authorized signature', L, sy - 12, 8.5, font, MUTED);
  text((ch.signatory_name || '') + (ch.signatory_title ? ', ' + ch.signatory_title : ''), L, sy - 24, 10, bold, INK);
  /* the foot */
  text(RECEIPT_CRA, L, 64, 9.5, font, INK);
  text('Thank you for your gift to ' + (ch.name || 'Welfare Avenue') + '.', L, 50, 9.5, font, MUTED);
  /* marks: a sample is never a receipt; a cancelled copy is kept marked cancelled */
  var mark = doc.sample ? 'SAMPLE' : doc.cancelled ? 'CANCELLED' : '';
  if (mark) {
    var size = 96, w = bold.widthOfTextAtSize(mark, size);
    page.drawText(mark, { x: 306 - (w * Math.cos(Math.PI / 6)) / 2, y: 330 - (w * Math.sin(Math.PI / 6)) / 2, size: size, font: bold, color: lib.rgb(179 / 255, 64 / 255, 47 / 255), opacity: 0.16, rotate: lib.degrees(30) });
    if (doc.sample) text('Sample only: not an official receipt. It is not numbered, kept or sent.', L, 78, 9, bold, lib.rgb(179 / 255, 64 / 255, 47 / 255));
  }
  return await pdf.save();
}
if (typeof module !== 'undefined' && module.exports) module.exports = { renderReceipt: renderReceipt, receiptText: receiptText, receiptMoney: receiptMoney };

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
