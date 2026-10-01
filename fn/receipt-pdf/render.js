/* The receipt drawn as a PDF (wave158b, 28/09/26; the brand layout since wave185, 30/09/26). Plain JavaScript with no imports, so
   the same code runs in the edge function (pdf-lib and fontkit from npm) and in the local check (node). renderReceipt(lib, doc, opt)
   returns the PDF bytes.
   doc: { sample, cancelled, serial, issued_date, location, replaces_serial, tax_year, kind ('single' | 'annual'),
          charity: { name, address, number, signatory_name, signatory_title, web, email }, donor: { name, address, first_name },
          gifts: [{ date, amount, advantage_amount, advantage_desc, eligible_amount, kind, in_kind_desc, appraiser, method, platform, tribute_kind, tribute_name }],
          amount, advantage_amount, eligible_amount, lang ('en' | 'fr') }
   opt: { fontkit, fonts: { head, body, bold } (TTF bytes), logo (PNG bytes, the cream lockup), star (PNG bytes), signature (PNG bytes),
          strict (refuse text the fonts cannot print instead of replacing it) }
   Every field the CRA requires on an official donation receipt (canada.ca, read 28/09/26 and 30/09/26): the statement that it is an
   official receipt for income tax purposes, the charity's name and address as on file with the CRA, the registration number, the
   serial number, where it was issued, the date the gift was received (or the year for a receipt covering several gifts), the date
   issued, the donor's name and address, the amount, the value and description of the advantage, the eligible amount, an authorized
   signature, the CRA's name and website; for a gift in kind, its description and the appraiser; a replacement says which receipt it
   cancels and replaces. The look is the Welfare Avenue Brand Guides v1 2026: the green band with the cream lockup, Barlow Condensed
   headings, Space Grotesk text, cream page, gold rules, one gold star doodle. */
var RECEIPT_CRA_EN = 'For information on all registered charities in Canada under the Income Tax Act, visit the Canada Revenue Agency at canada.ca/charities-giving.';
var RECEIPT_CRA_FR = 'Pour des renseignements sur tous les organismes de bienfaisance enregistrés au Canada en vertu de la Loi de l’impôt sur le revenu, visitez l’Agence du revenu du Canada à canada.ca/organismes-bienfaisance-dons.';
var RECEIPT_WORDS = {
  en: { title: 'Official donation receipt', sub: 'For income tax purposes', no: 'Receipt no.', issued: 'Date issued', by: 'Issued by', from: 'Received from',
    charity: 'Registered charity', number: 'Charitable registration number', address: 'Address', web: 'Website and contact', donor: 'Donor',
    date: 'Date gift received', year: 'Gifts received in', amount: 'Amount received', fmv: 'Fair market value', total: 'Total amount received',
    adv: 'Advantage to donor', advs: 'Advantages to donor', elig: 'Eligible amount of gift for tax purposes', none: 'None', desc: 'Description of gift',
    inkind: 'Description of the gift in kind', appraiser: 'Appraised by', thanks: 'Thank you', thanksTo: 'Thank you, ', impact: 'Every dollar goes straight back into the community through our meal programs in Montréal and Toronto.',
    location: 'Location receipt issued', issuedOn: 'Date receipt issued', sig: 'Authorized signature', replaces: 'This receipt cancels and replaces receipt number ',
    gifts: 'gifts', annual: 'Cash donations: {n} gifts received in {y}.', more: 'and {n} more gifts in {y}, listed on the next page (the total above covers them all)', more2: 'The gifts received in {y}, continued', page: 'page', cols: ['Date received', 'Amount', 'Advantage', 'Eligible amount'],
    tag1: 'Building pathways ', tag2: 'in our community', keep: 'Please keep this receipt for your records.', cra: RECEIPT_CRA_EN,
    sampleLine: 'Sample only: not an official receipt. It is not numbered, kept or sent.', sample: 'SAMPLE', cancelled: 'CANCELLED', cad: 'CAD',
    kinds: { donation: 'Cash donation', registration: 'Registration (the eligible amount is the amount received less the advantage)', ticket: 'Ticket (the eligible amount is the amount received less the advantage)', in_kind: 'Gift in kind', other: 'Gift' },
    methods: { cheque: 'received by cheque', 'e-transfer': 'received by e-transfer', etransfer: 'received by e-transfer', cash: 'received in cash', card: 'received by card', online: 'received online', stripe: 'received online through welfareavenue.com' },
    honour: 'In honour of ', memory: 'In memory of ' },
  fr: { title: 'Reçu officiel de don', sub: 'Aux fins de l’impôt sur le revenu', no: 'Reçu n°', issued: 'Date d’émission', by: 'Émis par', from: 'Reçu de',
    charity: 'Organisme de bienfaisance enregistré', number: 'Numéro d’enregistrement', address: 'Adresse', web: 'Site web et contact', donor: 'Donateur ou donatrice',
    date: 'Date de réception du don', year: 'Dons reçus en', amount: 'Montant reçu', fmv: 'Juste valeur marchande', total: 'Montant total reçu',
    adv: 'Avantage au donateur', advs: 'Avantages au donateur', elig: 'Montant admissible du don aux fins de l’impôt', none: 'Aucun', desc: 'Description du don',
    inkind: 'Description du don en nature', appraiser: 'Évalué par', thanks: 'Merci', thanksTo: 'Merci, ', impact: 'Chaque dollar retourne directement dans la communauté grâce à nos programmes de repas à Montréal et à Toronto.',
    location: 'Lieu d’émission du reçu', issuedOn: 'Date d’émission du reçu', sig: 'Signature autorisée', replaces: 'Ce reçu annule et remplace le reçu numéro ',
    gifts: 'dons', annual: 'Dons en argent : {n} dons reçus en {y}.', more: 'et {n} autres dons en {y}, listés à la page suivante (le total ci-dessus les comprend tous)', more2: 'Les dons reçus en {y}, suite', page: 'page', cols: ['Date de réception', 'Montant', 'Avantage', 'Montant admissible'],
    tag1: 'Building pathways ', tag2: 'in our community', keep: 'Veuillez conserver ce reçu pour vos dossiers.', cra: RECEIPT_CRA_FR,
    sampleLine: 'Exemple seulement : ce n’est pas un reçu officiel. Il n’est ni numéroté, ni conservé, ni envoyé.', sample: 'EXEMPLE', cancelled: 'ANNULÉ', cad: 'CAD',
    kinds: { donation: 'Don en argent', registration: 'Inscription (le montant admissible est le montant reçu moins l’avantage)', ticket: 'Billet (le montant admissible est le montant reçu moins l’avantage)', in_kind: 'Don en nature', other: 'Don' },
    methods: { cheque: 'reçu par chèque', 'e-transfer': 'reçu par virement Interac', etransfer: 'reçu par virement Interac', cash: 'reçu en espèces', card: 'reçu par carte', online: 'reçu en ligne', stripe: 'reçu en ligne par welfareavenue.com' },
    honour: 'En l’honneur de ', memory: 'À la mémoire de ' }
};
function receiptMoney(n) {
  var v = Math.round((Number(n) || 0) * 100) / 100, s = v.toFixed(2).split('.');
  return '$' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
}
/* the embedded fonts print Latin, Latin-1 and Latin Extended-A; typographic quotes and dashes are kept; anything else is refused on an
   official receipt (strict) or shown as ? on a sample. The check runs against the fonts themselves (fontkit) when they are given. */
function receiptTextMaker(strict, can) {
  return function (s) {
    s = String(s == null ? '' : s).replace(/…/g, '...').replace(/ /g, ' ').replace(/[\r\n\t]+/g, ' ');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i); if (cp > 0xffff) i++;
      if (cp === 32 || (cp >= 33 && cp <= 126) || (can ? can(cp) : (cp >= 160 && cp <= 0x17f) || (cp >= 0x2010 && cp <= 0x2027) || cp === 0x20ac)) out += String.fromCodePoint(cp);
      else if (strict) throw new Error('The receipt font cannot print "' + s + '": issue this receipt by hand.');
      else out += '?';
    }
    return out;
  };
}
function receiptText(s, strict) { return receiptTextMaker(strict, null)(s); }
async function renderReceipt(lib, doc, opt) {
  opt = opt || {};
  var strict = !!opt.strict, W = RECEIPT_WORDS[doc.lang === 'fr' ? 'fr' : 'en'];
  var fk = opt.fontkit, fonts = opt.fonts || {};
  var can = null;
  if (fk && fonts.body && fonts.head && fonts.bold) {
    try {
      var fb = fk.create(fonts.body), fh = fk.create(fonts.head), fbo = fk.create(fonts.bold);
      can = function (cp) { return fb.hasGlyphForCodePoint(cp) && fh.hasGlyphForCodePoint(cp) && fbo.hasGlyphForCodePoint(cp); };
    } catch (e) { can = null; }
  }
  var T = receiptTextMaker(strict, can);
  var pdf = await lib.PDFDocument.create();
  if (fk) pdf.registerFontkit(fk);
  pdf.setTitle(doc.sample ? W.sample + ' - ' + W.title : W.title + ' ' + T(doc.serial));
  pdf.setAuthor(T((doc.charity || {}).name || 'Welfare Avenue'));
  pdf.setSubject('Official receipt for income tax purposes');
  pdf.setCreator('Welfare Avenue Hub'); pdf.setProducer('Welfare Avenue Hub');
  pdf.setLanguage(doc.lang === 'fr' ? 'fr-CA' : 'en-CA');
  var page = pdf.addPage([612, 792]);
  var head, body, bold;
  if (fk && fonts.head && fonts.body && fonts.bold) {
    head = await pdf.embedFont(fonts.head, { subset: true }); body = await pdf.embedFont(fonts.body, { subset: true }); bold = await pdf.embedFont(fonts.bold, { subset: true });
  } else {
    /* the local check without the brand fonts: the standard faces stand in */
    head = await pdf.embedFont(lib.StandardFonts.HelveticaBold); body = await pdf.embedFont(lib.StandardFonts.Helvetica); bold = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  }
  var CREAM = lib.rgb(255 / 255, 250 / 255, 242 / 255), GREEN = lib.rgb(16 / 255, 63 / 255, 57 / 255), INK = lib.rgb(31 / 255, 32 / 255, 30 / 255),
      PURPLE = lib.rgb(111 / 255, 100 / 255, 171 / 255), GOLD = lib.rgb(220 / 255, 165 / 255, 39 / 255), RED = lib.rgb(179 / 255, 64 / 255, 47 / 255);
  var L = 43, R = 569, PW = 612, PH = 792;
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: CREAM });
  var FOOT = 54, craLines = null;
  function up(s) { return T(s).toUpperCase(); }
  /* pdf-lib draws no letter-spacing, so none is measured either (the spacing option is kept for the day it does) */
  function text(s, x, yy, size, f, color, o) {
    o = o || {}; var str = o.upper ? up(s) : T(s);
    page.drawText(str, { x: x, y: yy, size: size, font: f || body, color: color || INK });
  }
  function width(s, size, f, o) { o = o || {}; var str = o.upper ? up(s) : T(s); return (f || body).widthOfTextAtSize(str, size); }
  function textRight(s, xr, yy, size, f, color, o) { text(s, xr - width(s, size, f, o), yy, size, f, color, o); }
  function wrap(s, maxW, size, f) {
    var words = T(s).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (width(t, size, f) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  /* an overline label (purple on cream, gold on green) and its value; returns the height used */
  function field(x, yTop, maxW, label, value, o) {
    o = o || {};
    var lc = o.onGreen ? GOLD : PURPLE, vc = o.onGreen ? CREAM : (o.strong ? GREEN : INK);
    text(label, x, yTop - 7, 6.6, bold, lc, { upper: true, spacing: 0.9 });
    var vf = o.strong ? bold : body, vs = o.size || 9.5, lines = wrap(value == null || value === '' ? '-' : value, maxW, vs, vf), y = yTop - 7 - 11.5;
    lines.forEach(function (l) { text(l, x, y, vs, vf, vc); y -= vs * 1.32; });
    return (yTop - y) - vs * 1.32 + vs * 0.35;
  }
  function rule(x, y) { page.drawRectangle({ x: x, y: y, width: 30, height: 2.2, color: GOLD }); }
  function heading(s, x, yTop, size) { text(s, x, yTop - size * 0.85, size, head, GREEN, { upper: true, spacing: 0.4 }); rule(x, yTop - size * 0.85 - 7); return size * 0.85 + 7 + 2.2 + 9; }

  /* ---------- the green band: the lockup, the number and date, the statement ---------- */
  var BAND = 166;
  page.drawRectangle({ x: 0, y: PH - BAND, width: PW, height: BAND, color: GREEN });
  if (opt.logo) {
    try { var img = await pdf.embedPng(opt.logo), lw = 126, lh = lw * img.height / img.width; page.drawImage(img, { x: L, y: PH - 26 - lh, width: lw, height: lh }); } catch (e) { /* the band stands without it */ }
  }
  var metaY = PH - 30;
  textRight(W.no, R, metaY, 6.6, bold, GOLD, { upper: true, spacing: 0.9 });
  textRight((doc.serial || '') + (doc.sample ? ' (' + W.sample.toLowerCase() + ')' : ''), R, metaY - 20, 17, head, CREAM, { spacing: 0.3 });
  textRight(W.issued, R, metaY - 36, 6.6, bold, GOLD, { upper: true, spacing: 0.9 });
  textRight(doc.issued_date || '', R, metaY - 49, 9, body, CREAM);
  text(W.title, L, PH - 121, 33, head, CREAM, { upper: true, spacing: 0.5 });
  text(W.sub, L, PH - 147, 20, head, GOLD, { upper: true, spacing: 1.2 });

  /* ---------- the two cards: who issues it, who gave ---------- */
  var y = PH - BAND - 20;
  if (doc.replaces_serial) { text(W.replaces + doc.replaces_serial + '.', L, y - 9, 9.5, bold, INK); y -= 20; }
  var ch = doc.charity || {}, dn = doc.donor || {};
  var gap = 14, cw = (R - L - gap) / 2, pad = 11, innerW = cw - pad * 2;
  /* measure both cards first so they share one height */
  function cardBody(x, yTop, draw) {
    var yy = yTop - pad;
    yy -= heading(draw.title, x + pad, yy, 13);
    draw.fields.forEach(function (f) { yy -= field(x + pad, yy, innerW, f[0], f[1], f[2]); yy -= 3; });
    return yTop - yy + pad - 3;
  }
  var webLine = [ch.web, ch.email].filter(Boolean).join('  ·  ');
  var leftFields = [[W.charity, ch.name || '', { strong: true, size: 10 }], [W.number, ch.number || ''], [W.address, ch.address || '']];
  if (webLine) leftFields.push([W.web, webLine]);
  var rightFields = [[W.donor, dn.name || '', { strong: true, size: 10 }], [W.address, dn.address || '']];
  /* a dry run on a scratch page measures; then the real cards are drawn at the same height */
  var scratch = pdf.addPage([612, 792]), realPage = page; page = scratch;
  var hL = cardBody(L, y, { title: W.by, fields: leftFields }), hR = cardBody(L + cw + gap, y, { title: W.from, fields: rightFields });
  pdf.removePage(1); page = realPage;
  var ch0 = Math.max(hL, hR);
  [[L, { title: W.by, fields: leftFields }], [L + cw + gap, { title: W.from, fields: rightFields }]].forEach(function (c) {
    page.drawRectangle({ x: c[0], y: y - ch0, width: cw, height: ch0, borderColor: GREEN, borderWidth: 0.6, borderOpacity: 0.28, color: CREAM });
    cardBody(c[0], y, c[1]);
  });
  y -= ch0 + 14;

  /* ---------- the gift: the green block ---------- */
  var gifts = doc.gifts || [], one = gifts.length <= 1, g0 = gifts[0] || {};
  var inKind = one && g0.kind === 'in_kind';
  var adv = Number(doc.advantage_amount) || 0;
  var advText = adv > 0 ? receiptMoney(adv) + (one && g0.advantage_desc ? ' (' + g0.advantage_desc + ')' : '') : W.none + ' (' + receiptMoney(0) + ')';
  var blockH = 62;
  page.drawRectangle({ x: L, y: y - blockH, width: R - L, height: blockH, color: GREEN });
  var cols = [L + 14, L + 150, L + 262, L + 376], colW = [128, 104, 106, R - 14 - (L + 376)];
  var gy = y - 9;
  if (one) {
    field(cols[0], gy, colW[0], W.date, g0.date || '', { onGreen: true });
    field(cols[1], gy, colW[1], inKind ? W.fmv : W.amount, receiptMoney(doc.amount), { onGreen: true, strong: true, size: 11 });
  } else {
    field(cols[0], gy, colW[0], W.year + ' ' + (doc.tax_year || ''), gifts.length + ' ' + W.gifts, { onGreen: true });
    field(cols[1], gy, colW[1], W.total, receiptMoney(doc.amount), { onGreen: true, strong: true, size: 11 });
  }
  field(cols[2], gy, colW[2], one ? W.adv : W.advs, advText, { onGreen: true, size: 8.5 });
  text(W.elig, cols[3], gy - 7, 6.6, bold, GOLD, { upper: true, spacing: 0.9 });
  var eligS = receiptMoney(doc.eligible_amount);
  text(eligS, cols[3], gy - 36, 24, head, CREAM, { spacing: 0.2 });
  text(W.cad, cols[3] + width(eligS, 24, head, { spacing: 0.2 }) + 5, gy - 36, 9, head, GOLD, { spacing: 1 });
  y -= blockH + 14;

  /* ---------- the gifts of an annual receipt ---------- */
  if (!one) {
    var tcols = [L, L + 150, L + 270, L + 410];
    var fit = function (s, maxW) { s = T(s); if (width(s, 8.5) <= maxW) return s; while (s.length > 1 && width(s + '...', 8.5) > maxW) s = s.slice(0, -1); return s + '...'; };
    var room = Math.max(0, Math.floor((y - 18 - (FOOT + 190)) / 12)), shown = gifts.length <= room ? gifts : gifts.slice(0, Math.max(0, room - 1));
    if (shown.length) { W.cols.forEach(function (h, i) { text(h, tcols[i], y - 8, 6.6, bold, PURPLE, { upper: true, spacing: 0.9 }); }); y -= 18; } else y -= 4;
    var row = function (g) {
      text(g.date || '', tcols[0], y, 8.5); text(receiptMoney(g.amount), tcols[1], y, 8.5);
      text(fit((Number(g.advantage_amount) > 0 ? receiptMoney(g.advantage_amount) + (g.advantage_desc ? ' (' + g.advantage_desc + ')' : '') : receiptMoney(0)), tcols[3] - tcols[2] - 10), tcols[2], y, 8.5);
      text(receiptMoney(g.eligible_amount), tcols[3], y, 8.5, bold, GREEN); y -= 12;
      page.drawLine({ start: { x: L, y: y + 8 }, end: { x: R, y: y + 8 }, thickness: 0.4, color: GREEN, opacity: 0.14 });
    };
    shown.forEach(row);
    var rest = gifts.slice(shown.length);
    if (rest.length) { text(W.more.replace('{n}', String(rest.length)).replace('{y}', String(doc.tax_year || '')), tcols[0], y, 8.5, body, PURPLE); y -= 12; }
    y -= 8;
    /* the gifts that did not fit go on their own pages, under the serial, so nothing is left unlisted */
    var first = page, y0 = y;
    while (rest.length) {
      var pg = pdf.addPage([612, 792]); page = pg;
      page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: CREAM });
      page.drawRectangle({ x: 0, y: PH - 64, width: PW, height: 64, color: GREEN });
      text(W.title + ' ' + (doc.serial || ''), L, PH - 30, 16, head, CREAM, { upper: true });
      text(W.more2.replace('{y}', String(doc.tax_year || '')), L, PH - 50, 11, head, GOLD, { upper: true });
      var py = PH - 64 - 24;
      W.cols.forEach(function (h, i) { text(h, tcols[i], py - 8, 6.6, bold, PURPLE, { upper: true, spacing: 0.9 }); });
      y = py - 18;
      var take = rest.splice(0, Math.floor((y - 70) / 12));
      take.forEach(row);
      page.drawRectangle({ x: 0, y: 0, width: PW, height: 40, color: GREEN });
      text(W.tag1.trim(), L, 15, 11.5, head, CREAM, { upper: true });
      text(W.tag2, L + width(W.tag1.trim(), 11.5, head, { upper: true }) + 5, 15, 11.5, head, GOLD, { upper: true });
      textRight((doc.serial || '') + ' · ' + W.page + ' ' + pdf.getPageCount(), R, 15, 8, body, CREAM);
    }
    page = first; y = y0;
  }

  /* ---------- the description, and the thank-you card with one doodle ---------- */
  var descW = R - L - 14 - 212, tx = R - 212;
  var dTop = y;
  y -= heading(W.desc, L, y, 13);
  var lines = [];
  if (one) {
    var kindWords = W.kinds[g0.kind] || W.kinds.other;
    var how = g0.platform === 'stripe' ? W.methods.stripe : (W.methods[String(g0.method || '').toLowerCase()] || '');
    lines.push(kindWords + (how ? ', ' + how : '') + (g0.date ? ', ' + g0.date : '') + '.');
    if (g0.tribute_kind && g0.tribute_name) lines.push((W[g0.tribute_kind] || '') + g0.tribute_name + '.');
  } else {
    lines.push(W.annual.replace('{n}', String(gifts.length)).replace('{y}', String(doc.tax_year || '')));
  }
  lines.forEach(function (ln) { wrap(ln, descW, 9.5).forEach(function (l) { text(l, L, y - 8, 9.5, body, INK); y -= 13; }); });
  if (inKind) {
    y -= 4; y -= field(L, y, descW, W.inkind, g0.in_kind_desc || '-');
    if (g0.appraiser) { y -= 4; y -= field(L, y, descW, W.appraiser, g0.appraiser); }
  }
  /* the thank-you card */
  var tW = 212, tPad = 11, tName = dn.first_name ? W.thanksTo + dn.first_name : W.thanks;
  var tLines = wrap(W.impact, tW - tPad * 2, 8.5);
  var tH = tPad + 11 + 8 + tLines.length * 11.5 + tPad - 2;
  page.drawRectangle({ x: tx, y: dTop - tH, width: tW, height: tH, borderColor: GREEN, borderWidth: 0.6, borderOpacity: 0.28, color: CREAM });
  var tyy = dTop - tPad - 10;
  var tn = tName; while (tn.length > 3 && width(tn, 12, head, { upper: true }) > tW - tPad * 2 - 16) tn = tn.slice(0, -1);
  text(tn, tx + tPad, tyy, 12, head, GREEN, { upper: true, spacing: 0.4 });
  tyy -= 15;
  tLines.forEach(function (l) { text(l, tx + tPad, tyy, 8.5, body, INK); tyy -= 11.5; });
  if (opt.star) {
    try { var st = await pdf.embedPng(opt.star), sw = 24, sh = sw * st.height / st.width; page.drawImage(st, { x: R - 6 - sw, y: dTop - sh + 10, width: sw, height: sh, rotate: lib.degrees(12) }); } catch (e) { /* no doodle */ }
  }
  y = Math.min(y, dTop - tH) - 10;

  /* ---------- the signature row: 22 pt under the content, never into the foot ---------- */
  craLines = wrap(W.cra, 360, 7.2);
  FOOT = Math.max(54, 12 + craLines.length * 9.5 + 9.5 + 12);
  var sx = [L, L + 150, L + 300];
  var sy = Math.max(y - 82, FOOT + 18 + (doc.sample ? 16 : 0));
  text(W.location, sx[0], sy + 20, 6.6, bold, PURPLE, { upper: true, spacing: 0.9 });
  text(doc.location || '', sx[0], sy + 6, 9.5, body, INK);
  text(W.issuedOn, sx[1], sy + 20, 6.6, bold, PURPLE, { upper: true, spacing: 0.9 });
  text(doc.issued_date || '', sx[1], sy + 6, 9.5, body, INK);
  text(W.sig, sx[2], sy + 56, 6.6, bold, PURPLE, { upper: true, spacing: 0.9 });
  if (opt.signature) {
    try { var sig = await pdf.embedPng(opt.signature), ss = Math.min(150 / sig.width, 38 / sig.height); page.drawImage(sig, { x: sx[2], y: sy + 16, width: sig.width * ss, height: sig.height * ss }); } catch (e) { /* drawn without it */ }
  }
  page.drawLine({ start: { x: sx[2], y: sy + 14 }, end: { x: R, y: sy + 14 }, thickness: 0.9, color: GREEN });
  text(ch.signatory_name || '', sx[2], sy + 3, 9.5, bold, GREEN);
  if (ch.signatory_title) text(ch.signatory_title, sx[2], sy - 8, 8.5, body, INK);

  /* ---------- the foot: the descriptor line and the CRA ---------- */
  page.drawRectangle({ x: 0, y: 0, width: PW, height: FOOT, color: GREEN });
  var ty = Math.round(FOOT / 2) - 4;
  text(W.tag1.trim(), L, ty, 11.5, head, CREAM, { upper: true, spacing: 0.9 });
  text(W.tag2, L + width(W.tag1.trim(), 11.5, head, { upper: true, spacing: 0.9 }) + 5, ty, 11.5, head, GOLD, { upper: true, spacing: 0.9 });
  var cy = FOOT - 12 - 7;
  craLines.forEach(function (l) { textRight(l, R, cy, 7.2, body, CREAM); cy -= 9.5; });
  textRight(W.keep, R, cy, 7.2, bold, CREAM);

  /* ---------- marks: a sample is never a receipt; a cancelled copy is kept marked cancelled ---------- */
  var mark = doc.sample ? W.sample : doc.cancelled ? W.cancelled : '';
  if (mark) {
    var size = 96, w = head.widthOfTextAtSize(mark, size);
    page.drawText(mark, { x: 306 - (w * Math.cos(Math.PI / 6)) / 2, y: 330 - (w * Math.sin(Math.PI / 6)) / 2, size: size, font: head, color: RED, opacity: 0.18, rotate: lib.degrees(30) });
    if (doc.sample) text(W.sampleLine, L, FOOT + 5, 8, bold, RED);
  }
  return await pdf.save();
}
if (typeof module !== 'undefined' && module.exports) module.exports = { renderReceipt: renderReceipt, receiptText: receiptText, receiptMoney: receiptMoney, RECEIPT_WORDS: RECEIPT_WORDS };
