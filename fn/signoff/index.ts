// Welfare Avenue: signoff (v3, 11/10/26; v1 02/10/26, wave195)
// v3 (11/10/26): letters follow the WA brand guide v1 in full (Steel: "can we make it like this on the web?", after the
// wa-brand letter for James Morand): cream page, green header with the cream lockup and the purple spray in the corner, a purple
// overline (their roles), the title in Barlow Condensed Medium with a gold rule and one gold star, a green strip with the
// services, hours and period, "Chaleureusement," / "Warmly," on recognition letters, and a green footer band.
// v2 (11/10/26): the signer's own words also print on an hours sign-off letter (under the servings table, before the close).
// Steel, 11/10/26: "add in the functionality to add comments to future volunteers that want to add their hours".
// The volunteer's own form still takes no words (only the signature and our hours page).
// The Volunteer Manager's Sign-offs page. Steel, 02/10/26: "I'd also like to add my signature to volunteer recognition and
// volunteer hours sign off requests that volunteers can ask for on their profile in the website. This would appear on our
// volunteer manager as it's own page to sign off on hours completed with us." Signers (admins, Operations leads and people an
// admin assigns) keep their own signature; a signed letter is a PDF in the Welfare Avenue brand with a WA-VS reference.
// Actions (POST, the caller's Hub sign-in; the database decides who they are: signoff_signer_me and signoff_detail run as them):
//   signature_save {png_b64}   -> the caller's signature (a signer): a PNG of at most 600 KB and 2400 x 1200 pixels, kept in the
//                                 private bucket signoffs (signatures/<key>/<time>.png); the one before is removed
//   signature_url              -> a 60-second link to the caller's own signature, to show it back to them
//   form_url {id}              -> a 5-minute link to the volunteer's uploaded form (staff with the Volunteer Manager)
//   preview {id, items?, note?, placement?, add_page?}
//                              -> the letter, or their form with the signature placed, marked PREVIEW (5-minute link); nothing kept
//                                 but the preview itself (previews/<id>.pdf, replaced each time, removed on signing)
//   sign {same}                -> the signed PDF (letters/<id>/<reference>.pdf, with its SHA-256), recorded by signoff_mark_signed,
//                                 and the volunteer emailed that it is ready (mail-send, templates signoff_ready and signoff_ready_fr:
//                                 transactional, and in the Hub's email test mode it goes to a test recipient instead)
//   letter_url {id}            -> a 5-minute link to a signed PDF (staff with the Volunteer Manager)
//   sample {kind, lang}        -> a made-up letter with the caller's signature, name and title, marked PREVIEW (a signer's own check)
//   check (x-wa-secret)        -> the build's check: made-up letters drawn and kept as previews/check-*.pdf (10-minute links)
// sign also takes notify: false (the signer chose not to email the volunteer).
// items: [{roster_id, hours}] the servings to list and their hours (default: every confirmed serving in the request's period);
// note: the signer's own words on a recognition letter or an hours letter (v2); placement (their own form): {page (0-based,
// default the last), x, y (the signature's top left, 0 to 1 of the page from the top left), w (its width, 0 to 1 of the page),
// caption (true)};
// add_page: add our hours confirmation page after their form (default true).
// Fonts: Barlow Condensed and Space Grotesk fetched as TrueType from Google Fonts (OFL) when the function starts, Helvetica if
// that fails. Secrets: WA_TRIGGER_SECRET (vault) to call mail-send.
// Repo copy made 12/10/26 from the deployed function (platform version 4); the combining-mark range in letterFileName is
// written as \u escapes here.
// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';

const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ORIGINS = ['https://hub.welfareavenue.com', 'https://wa-exec-dashboard.netlify.app'];
const BRAND = SUPABASE_URL + '/storage/v1/object/public/content-images/brand/';
const LOCKUP = BRAND + 'logo-lockup-cream-1200.png';
// v3: French letters carry the French logo, Avenue du Bien-Être (Steel, 12/10/26: "here's the french logo to use on french
// website and french forms etc"); the English lockup stands in if it is missing
const LOCKUP_FR = BRAND + 'logo-fr-lockup-cream-1200.png';
const STAR = BRAND + 'doodle-star-gold.png', BLOB = BRAND + 'doodle-blob-purple.png';
const BUCKET = 'signoffs';

const GREEN = rgb(16 / 255, 63 / 255, 57 / 255), CREAM = rgb(1, 250 / 255, 242 / 255), GOLD = rgb(220 / 255, 165 / 255, 39 / 255);
const PURPLE = rgb(111 / 255, 100 / 255, 171 / 255);
const INK = rgb(31 / 255, 32 / 255, 30 / 255), MUTED = rgb(121 / 255, 119 / 255, 115 / 255), LINE = rgb(0.9, 0.88, 0.84), RED = rgb(0.70, 0.25, 0.18);
const PW = 612, PH = 792, L = 54, R = 558;

function cors(req) {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Max-Age': '86400' };
}
function reply(req, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
}
const secrets = {};
async function secret(name) {
  if (secrets[name]) return secrets[name];
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  secrets[name] = String(data); return secrets[name];
}
function asUser(token) {
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
}
async function hex(buf) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(d).map(b => b.toString(16).padStart(2, '0')).join('');
}
function b64(bytes) { let s = ''; const c = 0x8000; for (let i = 0; i < bytes.length; i += c) s += String.fromCharCode.apply(null, bytes.subarray(i, i + c)); return btoa(s); }
function unb64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); }

// ---------- words ----------
const MON = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
              fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] };
function dateText(iso, lang) {
  const p = String(iso || '').slice(0, 10).split('-').map(Number); if (p.length < 3 || !p[0]) return '';
  return p[2] + ' ' + MON[lang][p[1] - 1] + ' ' + p[0];
}
function monthYear(iso, lang) { const p = String(iso || '').slice(0, 10).split('-').map(Number); return p[0] ? MON[lang][p[1] - 1] + ' ' + p[0] : ''; }
// v3: "April to October 2026" / "Avril à octobre 2026" (years shown on both ends when they differ)
function periodText(a, b, lang) {
  const pa = String(a || '').slice(0, 10).split('-').map(Number), pb = String(b || a || '').slice(0, 10).split('-').map(Number);
  if (!pa[0]) return ''; const m = MON[lang];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1), to = lang === 'fr' ? ' à ' : ' to ';
  if (pa[0] === pb[0] && pa[1] === pb[1]) return cap(m[pa[1] - 1]) + ' ' + pa[0];
  if (pa[0] === pb[0]) return cap(m[pa[1] - 1]) + to + m[pb[1] - 1] + ' ' + pb[0];
  return cap(m[pa[1] - 1]) + ' ' + pa[0] + to + m[pb[1] - 1] + ' ' + pb[0];
}
function hoursText(n, lang) { const v = Math.round(Number(n || 0) * 10) / 10; const s = v % 1 === 0 ? String(v) : v.toFixed(1); return lang === 'fr' ? s.replace('.', ',') : s; }
function placeText(loc, lang) { return lang === 'fr' && /^montreal$/i.test(loc || '') ? 'Montréal' : (loc || ''); }
function listText(items, lang) {
  const a = items.filter(Boolean); if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + (lang === 'fr' ? ' et ' : ' and ') + a[a.length - 1];
}
function rolesOf(items, lang) {
  const n = {}; items.forEach(it => { const k = (lang === 'fr' ? it.role_fr : it.role_en) || it.role || ''; if (k) n[k] = (n[k] || 0) + 1; });
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}
const W = {
  en: { hours_title: 'Volunteer hours confirmation', rec_title: 'Letter of recognition', place: 'Montreal', ref: 'Reference', to: 'To: ', whom: 'To whom it may concern',
        sincerely: 'Sincerely,', warmly: 'Warmly,', attn: 'For the attention of ', st_serv: 'With Welfare Avenue', st_hours: 'Of volunteer service', st_when: 'Period', date: 'Date', role: 'Role', where: 'Location', hours: 'Hours', total: 'Total', servings1: 'serving', servingsN: 'servings', hoursN: 'hours',
        roles: 'Roles: ', cont: '(continued)', preview: 'PREVIEW', charity: 'Registered charity', check: 'To confirm this letter, write to info@welfareavenue.com and give its reference, ',
        p1: (n) => 'This letter confirms that ' + n + ' volunteered with Welfare Avenue, a youth-powered registered charity that serves home-cooked meals and connects people experiencing homelessness with support in Montreal and Toronto.',
        p2: (f, a, b, h, s) => (a === b ? 'On ' + a : 'Between ' + a + ' and ' + b) + ', ' + f + ' gave ' + h + ' hours of volunteer service over ' + s + '.',
        asked: (p) => 'This confirmation was requested for: ' + p + '.',
        close: (f) => 'We are grateful for ' + f + '’s time and care. Please write to us with any question about this letter.',
        r1: (n) => 'On behalf of Welfare Avenue, I am pleased to recognize ' + n + ' for their volunteer service with our community.',
        r2: (f, m, h, s) => 'Since ' + m + ', ' + f + ' has given ' + h + ' hours over ' + s + ', helping us serve home-cooked meals and connect people experiencing homelessness with support in Montreal and Toronto.',
        rasked: (p) => 'This letter was requested for: ' + p + '.',
        rclose: (f) => 'Thank you, ' + f + ', for the care you bring every time you show up.' },
  fr: { hours_title: 'Confirmation des heures de bénévolat', rec_title: 'Lettre de reconnaissance', place: 'Montréal, le', ref: 'Référence', to: 'Destinataire : ', whom: 'À qui de droit',
        sincerely: 'Cordialement,', warmly: 'Chaleureusement,', attn: 'À l’attention de ', st_serv: 'Avec Welfare Avenue', st_hours: 'De bénévolat', st_when: 'Période', date: 'Date', role: 'Rôle', where: 'Lieu', hours: 'Heures', total: 'Total', servings1: 'service', servingsN: 'services', hoursN: 'heures',
        roles: 'Rôles : ', cont: '(suite)', preview: 'APERÇU', charity: 'Organisme de bienfaisance enregistré', check: 'Pour vérifier cette lettre, écrivez à info@welfareavenue.com en indiquant sa référence, ',
        p1: (n) => 'La présente confirme que ' + n + ' a fait du bénévolat avec Welfare Avenue, un organisme de bienfaisance enregistré porté par les jeunes qui sert des repas maison et met les personnes en situation d’itinérance en lien avec du soutien, à Montréal et à Toronto.',
        p2: (f, a, b, h, s) => (a === b ? 'Le ' + a : 'Du ' + a + ' au ' + b) + ', ' + f + ' a donné ' + h + ' heures de bénévolat lors de ' + s + '.',
        asked: (p) => 'Cette confirmation a été demandée pour : ' + p + '.',
        close: (f) => 'Nous remercions ' + f + ' pour son temps et son engagement. N’hésitez pas à nous écrire pour toute question au sujet de cette lettre.',
        r1: (n) => 'Au nom de Welfare Avenue, j’ai le plaisir de souligner l’engagement bénévole de ' + n + ' auprès de notre communauté.',
        r2: (f, m, h, s) => 'Depuis ' + m + ', ' + f + ' a donné ' + h + ' heures lors de ' + s + ', en nous aidant à servir des repas maison et à mettre les personnes en situation d’itinérance en lien avec du soutien, à Montréal et à Toronto.',
        rasked: (p) => 'Cette lettre a été demandée pour : ' + p + '.',
        rclose: (f) => 'Merci, ' + f + ', pour la bienveillance dont vous faites preuve chaque fois que vous êtes là.' }
};
function servingsText(n, w) { return n + ' ' + (n === 1 ? w.servings1 : w.servingsN); }

// ---------- fonts and the lockup, once per start ----------
let ASSETS = null;
async function assets() {
  if (ASSETS) return ASSETS;
  const a = { fonts: null, lockup: null, lockup_fr: null, star: null, blob: null };
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Space+Grotesk:wght@400;700&display=swap', { headers: { 'User-Agent': 'curl/7.0' } })).text();
    const blocks = css.split('@font-face').slice(1);
    const pick = (fam, w) => { const b = blocks.find(x => x.indexOf("'" + fam + "'") >= 0 && x.indexOf('font-weight: ' + w) >= 0); const m = b && b.match(/url\((https:[^)]+\.ttf)\)/); return m ? m[1] : null; };
    const urls = { head: pick('Barlow Condensed', 500), head6: pick('Barlow Condensed', 600), body: pick('Space Grotesk', 400), bold: pick('Space Grotesk', 700) };
    const f = {};
    for (const k of Object.keys(urls)) { if (!urls[k]) throw new Error('font ' + k); const r = await fetch(urls[k]); if (!r.ok) throw new Error('font ' + k + ' ' + r.status); f[k] = new Uint8Array(await r.arrayBuffer()); }
    a.fonts = f;
  } catch (e) { console.warn('signoff fonts', String(e)); }
  for (const [k, u] of [['lockup', LOCKUP], ['lockup_fr', LOCKUP_FR], ['star', STAR], ['blob', BLOB]]) {
    try { const r = await fetch(u); if (r.ok) a[k] = new Uint8Array(await r.arrayBuffer()); } catch (_) { /* the letter stands without it */ }
  }
  ASSETS = a; return a;
}
async function fontsFor(pdf) {
  const a = await assets();
  pdf.registerFontkit(fontkit);
  if (a.fonts) {
    try { return { head: await pdf.embedFont(a.fonts.head, { subset: true }), head6: await pdf.embedFont(a.fonts.head6, { subset: true }), body: await pdf.embedFont(a.fonts.body, { subset: true }), bold: await pdf.embedFont(a.fonts.bold, { subset: true }), std: false }; }
    catch (e) { console.warn('signoff embed', String(e)); }
  }
  const hb = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { head: hb, head6: hb, body: await pdf.embedFont(StandardFonts.Helvetica), bold: hb, std: true };
}
const WINANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
function safeText(F, s) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ');
  if (!F.std) return s;
  return Array.from(s).map(ch => (ch.charCodeAt(0) <= 255 || WINANSI.has(ch)) ? ch : '?').join('');
}
function wrap(F, font, text, size, width) {
  const out = [];
  String(text || '').split(/\n/).forEach(par => {
    const words = safeText(F, par).split(/\s+/).filter(Boolean); let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(t, size) <= width || !line) line = t; else { out.push(line); line = w; }
    });
    out.push(line);
  });
  return out;
}

// ---------- the letter ----------
function letterLayout(pdf, F, d) {
  const w = W[d.lang];
  const ctx = { pdf, page: null, y: 0, n: 0 };
  const lockup = d._lockup, blob = d._blob;
  function band(first) {
    const page = pdf.addPage([PW, PH]); ctx.page = page; ctx.n++;
    // v3: the cream page, the green header with the purple spray in its corner, the green footer band
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: CREAM });
    const bh = first ? 97 : 46;
    page.drawRectangle({ x: 0, y: PH - bh, width: PW, height: bh, color: GREEN });
    if (first && blob) { const bw = 187, bhh = bw * blob.height / blob.width; page.drawImage(blob, { x: PW - bw + 25, y: PH - bhh + 4, width: bw, height: bhh, opacity: 0.9 }); }
    if (lockup) { const lh = first ? 60 : 24, lw = lh * lockup.width / lockup.height; page.drawImage(lockup, { x: L, y: PH - bh / 2 - lh / 2, width: lw, height: lh }); }
    if (first) {
      const lines = [['Welfare Avenue', F.bold, 9], [d.org_address, F.body, 8], [w.charity + ' ' + d.org_charity, F.body, 8], ['welfareavenue.com  ·  info@welfareavenue.com', F.body, 8]].filter(x => x[0] && String(x[0]).trim());
      let y = PH - 30; const xr = R - 62;
      lines.forEach(([t, f, s]) => { const tt = safeText(F, t); page.drawText(tt, { x: xr - f.widthOfTextAtSize(tt, s), y, size: s, font: f, color: CREAM }); y -= s + 4.5; });
    } else {
      const t = safeText(F, (d.kind === 'recognition' ? w.rec_title : w.hours_title) + ' ' + w.cont);
      page.drawText(t, { x: R - F.body.widthOfTextAtSize(t, 8.5), y: PH - 28, size: 8.5, font: F.body, color: CREAM });
    }
    // the foot: how to check the letter, then the green band with the charity
    const f1 = safeText(F, w.check + d.reference + '.');
    page.drawText(f1, { x: L, y: 56, size: 7.5, font: F.body, color: MUTED });
    page.drawRectangle({ x: 0, y: 0, width: PW, height: 44, color: GREEN });
    page.drawText(safeText(F, d.lang === 'fr' ? 'AVENUE DU BIEN-ÊTRE' : 'WELFARE AVENUE'), { x: L, y: 18, size: 10.5, font: F.head6, color: CREAM });
    const f2 = safeText(F, w.charity + ' ' + d.org_charity + '  ·  welfareavenue.com');
    page.drawText(f2, { x: R - F.body.widthOfTextAtSize(f2, 7.5), y: 19, size: 7.5, font: F.body, color: CREAM });
    if (d.preview) {
      const t = w.preview, s = 96, tw = F.head.widthOfTextAtSize(t, s);
      page.drawText(t, { x: PW / 2 - (tw * Math.cos(Math.PI / 5)) / 2, y: PH / 2 - (tw * Math.sin(Math.PI / 5)) / 2, size: s, font: F.head, color: RED, opacity: 0.13, rotate: degrees(36) });
    }
    ctx.y = PH - bh - (first ? 34 : 34);
  }
  function ensure(h) { if (ctx.y - h < 84) band(false); }
  function para(text, size = 10.5, font = F.body, color = INK, gap = 9) {
    const lines = wrap(F, font, text, size, R - L);
    lines.forEach(l => { ensure(size + 5); ctx.page.drawText(l, { x: L, y: ctx.y, size, font, color }); ctx.y -= size + 5; });
    ctx.y -= gap;
  }
  return { ctx, band, ensure, para, w };
}

async function letterPdf(d) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(d.kind === 'recognition' ? W[d.lang].rec_title : W[d.lang].hours_title); pdf.setAuthor('Welfare Avenue'); pdf.setCreator('Welfare Avenue Hub (signoff)');
  const F = await fontsFor(pdf);
  const a = await assets();
  const emb = async (b) => { if (!b) return null; try { return await pdf.embedPng(b); } catch (_) { return null; } };
  d._lockup = (d.lang === 'fr' ? await emb(a.lockup_fr) : null) || await emb(a.lockup); d._blob = await emb(a.blob); const star = await emb(a.star);
  const { ctx, band, ensure, para, w } = letterLayout(pdf, F, d);
  const lang = d.lang;
  band(true);
  const items = d.items || [], n = items.length, h = items.reduce((s, x) => s + Number(x.hours || 0), 0);
  const roles = rolesOf(items.length ? items : (d.all_items || []), lang);
  // v3: the purple overline (their roles), the title in Barlow Condensed Medium with one gold star, the gold rule
  const over = safeText(F, (roles.length ? listText(roles, lang) : 'Welfare Avenue').toUpperCase());
  let os = 8.5; while (F.bold.widthOfTextAtSize(over, os) > R - L && os > 6) os -= 0.5;
  ctx.page.drawText(over, { x: L, y: ctx.y, size: os, font: F.bold, color: PURPLE }); ctx.y -= 36;
  const title = safeText(F, (d.kind === 'recognition' ? w.rec_title : w.hours_title).toUpperCase());
  let ts = 38; while (F.head.widthOfTextAtSize(title, ts) > R - L - 44 && ts > 16) ts -= 1;
  ctx.page.drawText(title, { x: L, y: ctx.y, size: ts, font: F.head, color: GREEN });
  if (star) { const sw = 28, sh = sw * star.height / star.width; ctx.page.drawImage(star, { x: L + F.head.widthOfTextAtSize(title, ts) + 8, y: ctx.y + ts * 0.45, width: sw, height: sh, rotate: degrees(-8) }); }
  ctx.y -= 13;
  ctx.page.drawRectangle({ x: L, y: ctx.y, width: 30, height: 3, color: GOLD }); ctx.y -= 19;
  const meta = (lang === 'fr' ? w.place + ' ' : w.place + ', ') + dateText(d.date, lang) + '   ·   ' + w.ref + ' ' + d.reference;
  ctx.page.drawText(safeText(F, meta), { x: L, y: ctx.y, size: 9, font: F.body, color: MUTED }); ctx.y -= 24;
  para(d.for_org ? w.to + d.for_org : (d.kind === 'recognition' ? w.attn + d.name : w.whom), 10.5, F.bold, GREEN, 10);

  // v3: the green strip: services, hours (what the record counts, 2 h a service by default), the period
  const tot = d.kind === 'recognition' ? (d.all || { count: n, hours: h, first: items[0] && items[0].date, last: items[n - 1] && items[n - 1].date })
    : { count: n, hours: h, first: items[0] && items[0].date, last: items[n - 1] && items[n - 1].date };
  if (tot.count) {
    const sh = 46, sy = ctx.y - sh + 8, cw = (R - L) / 3;
    const rr = 6, x0 = L, y0 = PH - (sy + sh), wdt = R - L;
    ctx.page.drawSvgPath('M' + (x0 + rr) + ' ' + y0 + ' H' + (x0 + wdt - rr) + ' Q' + (x0 + wdt) + ' ' + y0 + ' ' + (x0 + wdt) + ' ' + (y0 + rr) + ' V' + (y0 + sh - rr) + ' Q' + (x0 + wdt) + ' ' + (y0 + sh) + ' ' + (x0 + wdt - rr) + ' ' + (y0 + sh) + ' H' + (x0 + rr) + ' Q' + x0 + ' ' + (y0 + sh) + ' ' + x0 + ' ' + (y0 + sh - rr) + ' V' + (y0 + rr) + ' Q' + x0 + ' ' + y0 + ' ' + (x0 + rr) + ' ' + y0 + ' Z', { x: 0, y: PH, color: GREEN });
    const cells = [[servingsText(tot.count, w), w.st_serv], [hoursText(tot.hours, lang) + ' ' + w.hoursN, w.st_hours], [periodText(tot.first, tot.last, lang), w.st_when]];
    cells.forEach(([big, small], i) => {
      const cx = L + i * cw + 12, bt = safeText(F, String(big).toUpperCase()); let bs = 16; while (F.head6.widthOfTextAtSize(bt, bs) > cw - 22 && bs > 9) bs -= 0.5;
      ctx.page.drawText(bt, { x: cx, y: sy + 22, size: bs, font: F.head6, color: GOLD });
      ctx.page.drawText(safeText(F, String(small).toUpperCase()), { x: cx, y: sy + 10, size: 6.5, font: F.bold, color: CREAM });
      if (i) ctx.page.drawLine({ start: { x: L + i * cw, y: sy + 6 }, end: { x: L + i * cw, y: sy + sh - 6 }, thickness: 0.6, color: CREAM, opacity: 0.25 });
    });
    ctx.y = sy - 22;
  }
  if (d.kind === 'recognition') {
    para(w.r1(d.name));
    para(w.r2(d.first, monthYear(tot.first, lang), hoursText(tot.hours, lang), servingsText(tot.count, w)) + (roles.length ? ' ' + w.roles + listText(roles, lang) + '.' : ''));
    if (d.note) String(d.note).split(/\n{2,}/).forEach(p => para(p.trim()));
    if (d.purpose) para(w.rasked(d.purpose));
    para(w.rclose(d.first));
  } else {
    para(w.p1(d.name));
    if (n) para(w.p2(d.first, dateText(items[0].date, lang), dateText(items[n - 1].date, lang), hoursText(h, lang), servingsText(n, w)) + (roles.length ? ' ' + w.roles + listText(roles, lang) + '.' : ''));
    if (d.purpose) para(w.asked(d.purpose));
    // the servings, as a table that continues on the next page if it must
    const cols = [L, L + 140, L + 330, R];
    const head = () => {
      ensure(40);
      [w.date, w.role, w.where].forEach((t, i) => ctx.page.drawText(safeText(F, t.toUpperCase()), { x: cols[i], y: ctx.y, size: 8, font: F.bold, color: MUTED }));
      const th = w.hours.toUpperCase(); ctx.page.drawText(safeText(F, th), { x: R - F.bold.widthOfTextAtSize(safeText(F, th), 8), y: ctx.y, size: 8, font: F.bold, color: MUTED });
      ctx.y -= 7; ctx.page.drawLine({ start: { x: L, y: ctx.y }, end: { x: R, y: ctx.y }, thickness: 0.8, color: GREEN }); ctx.y -= 13;
    };
    head();
    items.forEach(it => {
      if (ctx.y - 16 < 84) { band(false); head(); }
      const cells = [dateText(it.date, lang), (lang === 'fr' ? it.role_fr : it.role_en) || it.role || '', placeText(it.location, lang)];
      cells.forEach((t, i) => ctx.page.drawText(safeText(F, t), { x: cols[i], y: ctx.y, size: 9.5, font: F.body, color: INK }));
      const ht = hoursText(it.hours, lang); ctx.page.drawText(ht, { x: R - F.body.widthOfTextAtSize(ht, 9.5), y: ctx.y, size: 9.5, font: F.body, color: INK });
      ctx.y -= 6; ctx.page.drawLine({ start: { x: L, y: ctx.y }, end: { x: R, y: ctx.y }, thickness: 0.4, color: LINE }); ctx.y -= 11;
    });
    ensure(24);
    const tt = safeText(F, w.total + ' : '.slice(lang === 'fr' ? 0 : 1) + servingsText(n, w) + ', ' + hoursText(h, lang) + ' ' + w.hoursN);
    ctx.page.drawText(tt, { x: R - F.bold.widthOfTextAtSize(tt, 10), y: ctx.y, size: 10, font: F.bold, color: GREEN }); ctx.y -= 28;
    // v2: the signer's own words, under the servings
    if (d.note) String(d.note).split(/\n{2,}/).forEach(p => para(p.trim()));
    para(w.close(d.first));
  }
  // the signature (v3: about 112 pt tall; it may come down to just above the check line and the footer band)
  if (ctx.y - 112 < 68) band(false);
  ctx.page.drawText(safeText(F, d.kind === 'recognition' ? w.warmly : w.sincerely), { x: L, y: ctx.y, size: 10.5, font: F.body, color: INK }); ctx.y -= 12;
  if (d.signature) {
    try {
      const img = await pdf.embedPng(d.signature); const s = Math.min(190 / img.width, 54 / img.height);
      ctx.page.drawImage(img, { x: L - 4, y: ctx.y - img.height * s, width: img.width * s, height: img.height * s }); ctx.y -= img.height * s + 6;
    } catch (_) { ctx.y -= 50; }
  } else {
    ctx.page.drawRectangle({ x: L, y: ctx.y - 46, width: 190, height: 44, borderColor: LINE, borderWidth: 1, borderDashArray: [3, 3] });
    ctx.page.drawText(lang === 'fr' ? 'Votre signature' : 'Your signature', { x: L + 10, y: ctx.y - 28, size: 9, font: F.body, color: MUTED }); ctx.y -= 52;
  }
  ctx.page.drawText(safeText(F, d.signer_name || ''), { x: L, y: ctx.y, size: 11, font: F.bold, color: GREEN }); ctx.y -= 14;
  if (d.signer_title) { ctx.page.drawText(safeText(F, d.signer_title), { x: L, y: ctx.y, size: 9.5, font: F.body, color: MUTED }); ctx.y -= 13; }
  ctx.page.drawText('Welfare Avenue', { x: L, y: ctx.y, size: 9.5, font: F.body, color: MUTED });
  // page numbers when there is more than one
  const pages = pdf.getPages();
  if (pages.length > 1) pages.forEach((p, i) => { const t = (i + 1) + ' / ' + pages.length; p.drawText(t, { x: L + F.head6.widthOfTextAtSize(safeText(F, d.lang === 'fr' ? 'AVENUE DU BIEN-ÊTRE' : 'WELFARE AVENUE'), 10.5) + 14, y: 19, size: 7.5, font: F.body, color: CREAM }); });
  return pdf;
}

// ---------- their own form, signed ----------
async function formPdf(d, bytes, type, placement, addPage) {
  let pdf;
  if (type === 'application/pdf') {
    try { pdf = await PDFDocument.load(bytes); }
    catch (e) { throw new Error(/encrypt/i.test(String(e)) ? 'This PDF is protected, so it cannot be signed here. Ask the volunteer for a copy without a password, or decline with that reason.' : 'This file could not be read as a PDF.'); }
  } else {
    pdf = await PDFDocument.create();
    const img = type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([PW, PH]); const s = Math.min((PW - 48) / img.width, (PH - 48) / img.height);
    page.drawImage(img, { x: (PW - img.width * s) / 2, y: (PH - img.height * s) / 2, width: img.width * s, height: img.height * s });
  }
  pdf.setProducer('Welfare Avenue Hub (signoff)');
  const F = await fontsFor(pdf);
  const pages = pdf.getPages(); const pl = placement || {};
  const idx = Math.max(0, Math.min(pages.length - 1, Number.isFinite(Number(pl.page)) ? Number(pl.page) : pages.length - 1));
  const page = pages[idx]; const { width: PWx, height: PHx } = page.getSize();
  const clamp = (v, a, b, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : def; };
  const x = clamp(pl.x, 0, 0.95, 0.58) * PWx, yTop = clamp(pl.y, 0, 0.97, 0.80) * PHx, wSig = clamp(pl.w, 0.06, 0.6, 0.28) * PWx;
  let hSig = wSig * 0.32;
  if (d.signature) {
    try { const img = await pdf.embedPng(d.signature); hSig = wSig * img.height / img.width; page.drawImage(img, { x, y: PHx - yTop - hSig, width: wSig, height: hSig }); }
    catch (_) { /* no signature drawn */ }
  } else {
    page.drawRectangle({ x, y: PHx - yTop - hSig, width: wSig, height: hSig, borderColor: RED, borderWidth: 1, borderDashArray: [3, 3] });
  }
  if (pl.caption !== false) {
    const cap = safeText(F, (d.signer_name || '') + (d.signer_title ? ', ' + d.signer_title : '') + ', Welfare Avenue  ·  ' + dateText(d.date, d.lang) + '  ·  ' + d.reference);
    const size = 6.5;
    page.drawText(cap, { x: Math.min(x, PWx - 12 - F.body.widthOfTextAtSize(cap, size)), y: Math.max(8, PHx - yTop - hSig - 9), size, font: F.body, color: INK });
  }
  if (d.preview) {
    const t = W[d.lang].preview, s = 80, tw = F.head.widthOfTextAtSize(t, s);
    pages.forEach(p => { const z = p.getSize(); p.drawText(t, { x: z.width / 2 - (tw * Math.cos(Math.PI / 5)) / 2, y: z.height / 2 - (tw * Math.sin(Math.PI / 5)) / 2, size: s, font: F.head, color: RED, opacity: 0.13, rotate: degrees(36) }); });
  }
  if (addPage !== false && (d.items || []).length) {
    const letter = await letterPdf({ ...d, kind: 'hours', note: '' });
    const copied = await pdf.copyPages(letter, letter.getPageIndices());
    copied.forEach(p => pdf.addPage(p));
  }
  return pdf;
}

// ---------- a made-up letter: a signer's own check of their signature, and the build's check ----------
function sampleData(kind, lang, signer, signature) {
  const items = [['2026-06-07', 'server', 'Serveur·se', 'Server'], ['2026-06-21', 'cook', 'Cuisine', 'Cook'], ['2026-07-05', 'server', 'Serveur·se', 'Server']]
    .map((r, i) => ({ roster_id: i + 1, date: r[0], role: r[1], role_fr: r[2], role_en: r[3], location: 'Montreal', hours: i === 1 ? 3 : 2 }));
  const notes = {
    recognition: { fr: 'Alex arrive toujours en avance et met tout le monde à l’aise.', en: 'Alex always arrives early and puts everyone at ease.' },
    hours: { fr: 'Alex a aussi aidé à former deux nouveaux bénévoles en cuisine.', en: 'Alex also helped train two new volunteers in the kitchen.' }
  };
  return { kind, lang, date: today(), reference: 'WA-VS-SAMPLE', preview: true, name: 'Alex Sample', first: 'Alex', for_org: lang === 'fr' ? 'Cégep du Vieux Montréal' : 'Dawson College',
    purpose: lang === 'fr' ? 'Heures de bénévolat requises' : 'Community service hours', items, all: { count: 3, hours: 7, first: '2026-06-07', last: '2026-07-05' },
    note: notes[kind] ? notes[kind][lang] : '',
    signer_name: signer.name || 'Signer', signer_title: signer.title || '', signature, org_address: '8200 av Bloomfield, Montreal QC H3N 2H9', org_charity: '713048502RR0001' };
}
// v3: the file name a signed letter downloads under, with the volunteer's name (accents kept out for every system)
function letterFileName(kind, lang, name, ref) {
  const fr = lang === 'fr';
  const what = kind === 'recognition' ? (fr ? 'Lettre de reconnaissance' : 'Letter of recognition') : kind === 'hours' ? (fr ? 'Confirmation des heures' : 'Volunteer hours') : (fr ? 'Formulaire signe' : 'Signed form');
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ['Welfare-Avenue', slug(what), slug(name), slug(ref)].filter(Boolean).join('-') + '.pdf';
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// ---------- who is asking ----------
async function caller(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === ANON_KEY) return null;
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data || !data.user || !data.user.email) return null;
  return { token, email: String(data.user.email).toLowerCase(), db: asUser(token) };
}
async function signerOf(who) {
  const { data, error } = await who.db.rpc('signoff_signer_me');
  if (error || !data) return null;
  return data;
}
async function sigKey(email) { return (await hex(new TextEncoder().encode('signer|' + email))).slice(0, 16); }

// everything a letter needs, from the request and the signer
async function build(who, me, id, body, preview) {
  const det = await who.db.rpc('signoff_detail', { p_id: id });
  if (det.error) return { status: 403, error: 'not_allowed' };
  if (!det.data) return { status: 404, error: 'not_found' };
  const req0 = det.data.request;
  if (req0.status !== 'requested') return { status: 409, error: 'This request is no longer waiting.' };
  const sd = await svc.rpc('signoff_sign_data', { p_id: id, p_email: who.email });
  if (sd.error || !sd.data || !sd.data.ok) return { status: 403, error: (sd.data && sd.data.reason) || 'not_signer' };
  const S = sd.data;
  const lang = req0.lang === 'fr' ? 'fr' : 'en';
  // the servings to list: the signer's choice among the confirmed servings of the period, with their hours
  let items = S.servings || [];
  if (Array.isArray(body.items)) {
    const pick = new Map(body.items.map(x => [Number(x.roster_id), x]));
    items = items.filter(it => pick.has(Number(it.roster_id))).map(it => {
      const o = pick.get(Number(it.roster_id)); const hrs = Number(o.hours);
      return { ...it, hours: Number.isFinite(hrs) && hrs > 0 && hrs <= 24 ? Math.round(hrs * 4) / 4 : it.hours };
    });
  }
  if (req0.kind !== 'recognition' && !items.length) return { status: 400, error: 'Choose at least one serving to list.' };
  // v2: the signer's words go on recognition and hours letters; never on the volunteer's own form
  const note = req0.kind === 'form' ? '' : (typeof body.note === 'string' ? body.note.trim().slice(0, 1500) : '');
  const signerName = String(me.name || S.signer.name || '').trim(), signerTitle = String((lang === 'fr' ? (me.title_fr || me.title) : me.title) || '').trim();
  if (!preview && !signerName) return { status: 400, error: 'Add your name in My signature first.' };
  if (!preview && !signerTitle) return { status: 400, error: 'Add your title in My signature first.' };
  let signature = null;
  if (S.signer.signature_path) {
    const dl = await svc.storage.from(BUCKET).download(S.signer.signature_path);
    if (!dl.error && dl.data) signature = new Uint8Array(await dl.data.arrayBuffer());
  }
  if (!preview && !signature) return { status: 400, error: 'Save your signature in My signature first.' };
  const org = S.org || {};
  const address = String(org.mail_postal_address || 'Montreal QC').replace(/^Welfare Avenue,\s*/i, '');
  const d = {
    kind: req0.kind, lang, date: today(), reference: preview ? 'WA-VS-······' : S.reference, preview,
    name: S.volunteer.name || '', first: S.volunteer.first_name || S.volunteer.name || '', for_org: req0.for_org || '', purpose: req0.purpose || '',
    items, all: S.all, note, signer_name: signerName || (lang === 'fr' ? 'Votre nom' : 'Your name'), signer_title: signerTitle,
    signature, org_address: address, org_charity: String(org.mail_charity_number || '')
  };
  if (req0.kind === 'form') {
    if (!req0.form_path) return { status: 400, error: 'This request has no form attached.' };
    const dl = await svc.storage.from(BUCKET).download(req0.form_path);
    if (dl.error || !dl.data) return { status: 404, error: 'The uploaded form is missing.' };
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    try {
      const pdf = await formPdf(d, bytes, req0.form_type || 'application/pdf', body.placement || {}, body.add_page);
      return { pdf, d, req0, S, items, note };
    } catch (e) { return { status: 400, error: String(e.message || e) }; }
  }
  return { pdf: await letterPdf(d), d, req0, S, items, note };
}

async function notify(id, res, d) {
  const lang = d.lang;
  const docName = res.kind === 'hours' ? (lang === 'fr' ? 'votre lettre de confirmation d’heures' : 'hours letter')
    : res.kind === 'recognition' ? (lang === 'fr' ? 'votre lettre de reconnaissance' : 'letter of recognition') : (lang === 'fr' ? 'votre formulaire' : 'form');
  const vars = { first_name: d.first, doc_name: docName, for_line: d.for_org ? (lang === 'fr' ? ' pour ' : ' for ') + d.for_org : '', signer_name: d.signer_name,
    reference: d.reference, account_url: lang === 'fr' ? 'https://welfareavenue.com/fr/compte/' : 'https://welfareavenue.com/account/' };
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/mail-send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'x-wa-secret': await secret('WA_TRIGGER_SECRET') },
      body: JSON.stringify({ action: 'send', template_key: lang === 'fr' ? 'signoff_ready_fr' : 'signoff_ready', contact_id: res.contact_id, vars })
    });
    const j = await r.json().catch(() => ({}));
    const sendId = Number(j.send_id || (j.result && j.result.send_id) || 0);
    if (r.ok && sendId && (j.status === 'sent' || j.status === 'queued')) await svc.rpc('signoff_mark_emailed', { p_id: id, p_send_id: sendId });
    return { status: j.status || r.status, send_id: sendId || null, note: j.note || j.error || null };
  } catch (e) { return { error: String(e.message || e) }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return reply(req, { error: 'method' }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 1200000) return reply(req, { error: 'too_large' }, 413);
    let body; try { body = JSON.parse(raw); } catch (_) { return reply(req, { error: 'bad_json' }, 400); }
    if (body.action === 'check') {
      // the build's check (x-wa-secret): made-up letters drawn and kept as previews/check-*.pdf for a 10-minute look; nothing read about anyone
      const given = req.headers.get('x-wa-secret') || '';
      if (!given || !same(given, await secret('WA_TRIGGER_SECRET'))) return reply(req, { error: 'not_allowed' }, 403);
      const a = await assets(); const out = [];
      for (const [kind, lang] of [['hours', 'en'], ['recognition', 'fr'], ['form', 'en'], ['hours', 'fr']]) {
        const d = sampleData(kind, lang, { name: 'Steel MacDonald', title: lang === 'fr' ? 'Fondateur' : 'Founder' }, null);
        let pdf;
        if (kind === 'form') {
          const f = await PDFDocument.create(); const pg = f.addPage([PW, PH]); const hf = await f.embedFont(StandardFonts.Helvetica);
          pg.drawText('A school form (made up) - Volunteer hours', { x: 60, y: 700, size: 16, font: hf }); pg.drawText('Supervisor signature: ____________________', { x: 60, y: 160, size: 12, font: hf });
          pdf = await formPdf(d, await f.save(), 'application/pdf', { page: 0, x: 0.36, y: 0.76, w: 0.3 }, true);
        } else pdf = await letterPdf(d);
        const bytes = await pdf.save(); const path = 'previews/check-' + kind + '-' + lang + '.pdf';
        await svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
        const s = await svc.storage.from(BUCKET).createSignedUrl(path, 600);
        out.push({ kind, lang, pages: pdf.getPageCount(), bytes: bytes.length, url: s.data ? s.data.signedUrl : null });
      }
      return reply(req, { ok: true, version: 3, brand_fonts: !!a.fonts, lockup: !!a.lockup, lockup_fr: !!a.lockup_fr, star: !!a.star, blob: !!a.blob, files: out });
    }
    if (body.action === 'brand_put') {
      // v3 (x-wa-secret only): put the French logo files into the public brand library (content-images/brand/logo-fr-*.png);
      // nothing else can be written here, and PNG only
      const given = req.headers.get('x-wa-secret') || '';
      if (!given || !same(given, await secret('WA_TRIGGER_SECRET'))) return reply(req, { error: 'not_allowed' }, 403);
      const done = [];
      for (const f of (Array.isArray(body.files) ? body.files : []).slice(0, 12)) {
        const name = String(f && f.name || '');
        if (!/^logo-fr-[a-z0-9-]+\.png$/.test(name)) { done.push({ name, error: 'name' }); continue; }
        let bytes; try { bytes = unb64(String(f.b64 || '')); } catch (_) { done.push({ name, error: 'b64' }); continue; }
        if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) || bytes.length > 2 * 1024 * 1024) { done.push({ name, error: 'png' }); continue; }
        const up = await svc.storage.from('content-images').upload('brand/' + name, bytes, { contentType: 'image/png', upsert: true });
        done.push({ name, bytes: bytes.length, ok: !up.error, error: up.error ? String(up.error.message || up.error) : undefined });
      }
      return reply(req, { ok: true, files: done });
    }
    const who = await caller(req);
    if (!who) return reply(req, { error: 'signin' }, 401);
    const me = await signerOf(who);
    if (!me) return reply(req, { error: 'not_allowed' }, 403);
    const id = Number(body.id);

    if (body.action === 'signature_save') {
      if (!me.can_sign) return reply(req, { error: 'Only a signer can save a signature.' }, 403);
      let bytes; try { bytes = unb64(String(body.png_b64 || '').replace(/^data:image\/png;base64,/, '')); } catch (_) { return reply(req, { error: 'That is not a PNG image.' }, 400); }
      if (bytes.length < 100 || bytes.length > 600 * 1024) return reply(req, { error: 'The signature image must be under 600 KB.' }, 400);
      if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) return reply(req, { error: 'That is not a PNG image.' }, 400);
      try { const t = await PDFDocument.create(); const img = await t.embedPng(bytes); if (img.width > 2400 || img.height > 1200 || img.width < 40 || img.height < 15) return reply(req, { error: 'The signature image should be between 40 x 15 and 2400 x 1200 pixels.' }, 400); }
      catch (_) { return reply(req, { error: 'That PNG could not be read.' }, 400); }
      const path = 'signatures/' + (await sigKey(who.email)) + '/' + Date.now() + '.png';
      const up = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false });
      if (up.error) return reply(req, { error: 'The signature could not be saved.' }, 500);
      const set = await svc.rpc('signoff_signature_set', { p_email: who.email, p_path: path });
      if (set.error) { await svc.storage.from(BUCKET).remove([path]); return reply(req, { error: 'The signature could not be saved.' }, 500); }
      const old = set.data && set.data.old_path; if (old && old !== path) await svc.storage.from(BUCKET).remove([old]);
      return reply(req, { ok: true });
    }
    if (body.action === 'sample') {
      // a signer's own look at a made-up letter with their signature, name and title (marked PREVIEW)
      if (!me.can_sign) return reply(req, { error: 'Only a signer can see a sample.' }, 403);
      const lang = body.lang === 'fr' ? 'fr' : 'en', kind = body.kind === 'recognition' ? 'recognition' : 'hours';
      let signature = null;
      const { data: row } = await svc.from('volunteer_signers').select('signature_path').eq('email', who.email).maybeSingle();
      if (row && row.signature_path) { const dl = await svc.storage.from(BUCKET).download(row.signature_path); if (!dl.error && dl.data) signature = new Uint8Array(await dl.data.arrayBuffer()); }
      const pdf = await letterPdf(sampleData(kind, lang, { name: me.name, title: lang === 'fr' ? (me.title_fr || me.title) : me.title }, signature));
      const path = 'previews/sample-' + (await sigKey(who.email)) + '.pdf';
      const up = await svc.storage.from(BUCKET).upload(path, await pdf.save(), { contentType: 'application/pdf', upsert: true });
      if (up.error) return reply(req, { error: 'The sample could not be made.' }, 500);
      const s = await svc.storage.from(BUCKET).createSignedUrl(path, 300);
      return reply(req, { url: s.data ? s.data.signedUrl : null });
    }
    if (body.action === 'signature_url') {
      const { data } = await svc.from('volunteer_signers').select('signature_path').eq('email', who.email).maybeSingle();
      if (!data || !data.signature_path) return reply(req, { url: null });
      const s = await svc.storage.from(BUCKET).createSignedUrl(data.signature_path, 60);
      return reply(req, { url: s.data ? s.data.signedUrl : null });
    }
    if (body.action === 'form_url' || body.action === 'letter_url') {
      if (!Number.isFinite(id)) return reply(req, { error: 'bad' }, 400);
      const det = await who.db.rpc('signoff_detail', { p_id: id });
      if (det.error) return reply(req, { error: 'not_allowed' }, 403);
      if (!det.data) return reply(req, { error: 'not_found' }, 404);
      const r0 = det.data.request; const path = body.action === 'form_url' ? r0.form_path : r0.letter_path;
      if (!path) return reply(req, { error: 'not_found' }, 404);
      // v3: a signed letter downloads under the volunteer's name (Welfare-Avenue-Lettre-de-reconnaissance-James-Morand-WA-VS-xxxxxx.pdf)
      const fname = body.action === 'letter_url' ? letterFileName(r0.kind, r0.lang, det.data.name, r0.reference) : null;
      const s = await svc.storage.from(BUCKET).createSignedUrl(path, 300, fname ? { download: fname } : undefined);
      return reply(req, { url: s.data ? s.data.signedUrl : null, type: body.action === 'form_url' ? r0.form_type : 'application/pdf', file_name: fname });
    }
    if (body.action === 'preview' || body.action === 'sign') {
      if (!Number.isFinite(id)) return reply(req, { error: 'bad' }, 400);
      if (!me.can_sign) return reply(req, { error: 'Only a signer can sign.' }, 403);
      const preview = body.action === 'preview';
      const b = await build(who, me, id, body, preview);
      if (b.error) return reply(req, { error: b.error }, b.status || 400);
      const bytes = await b.pdf.save();
      if (preview) {
        const path = 'previews/' + id + '.pdf';
        const up = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
        if (up.error) return reply(req, { error: 'The preview could not be made.' }, 500);
        const s = await svc.storage.from(BUCKET).createSignedUrl(path, 300);
        return reply(req, { url: s.data ? s.data.signedUrl : null, pages: b.pdf.getPageCount() });
      }
      const path = 'letters/' + id + '/' + b.d.reference + '.pdf';
      const up = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
      if (up.error) return reply(req, { error: 'The signed letter could not be saved.' }, 500);
      const sha = await hex(bytes);
      const hours = b.items.reduce((s, x) => s + Number(x.hours || 0), 0);
      const mark = await svc.rpc('signoff_mark_signed', { p_id: id, p_email: who.email, p: {
        reference: b.d.reference, items: b.items, servings: b.items.length, hours: Math.round(hours * 100) / 100, note: b.note || '',
        placement: b.req0.kind === 'form' ? (body.placement || {}) : null, signer_name: b.d.signer_name, signer_title: b.d.signer_title, letter_path: path, sha256: sha } });
      if (mark.error) { await svc.storage.from(BUCKET).remove([path]); return reply(req, { error: String(mark.error.message || 'not recorded') }, 409); }
      await svc.storage.from(BUCKET).remove(['previews/' + id + '.pdf']);
      const mail = body.notify === false ? { skipped: true } : await notify(id, mark.data, b.d);
      return reply(req, { ok: true, reference: b.d.reference, email: mail });
    }
    return reply(req, { error: 'action' }, 400);
  } catch (e) {
    console.error('signoff', e);
    return reply(req, { error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500);
  }
});
