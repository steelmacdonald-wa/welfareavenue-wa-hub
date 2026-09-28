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
