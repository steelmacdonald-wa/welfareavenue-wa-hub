  /* ======================= Gifts by hand and receipts (wave158a, 28/09/26) =======================
     The first part of step 6 (gifts and receipts). Staff record the gifts that come without a platform (cheques,
     e-transfers, cash), say what kind of money it is (a donation, a registration or a ticket with the value the person
     received, a sponsorship, a gift in kind), note a tribute, and see for every gift whether a CRA receipt is done, due
     or not possible and why (crm_gift_receipts_v). The receipt settings (the charity's name and address as on file with
     the CRA, where receipts are issued, the numbering, the signatory) are kept by admins; the Hub shows a sample receipt
     with every field the CRA requires and lists the receipts due for a tax year. Issuing official receipts (the number,
     the PDF, the email) comes in wave158b once the treasurer confirms the settings: receipt_mode stays off. */
  var GKIND = { donation: ['Donation', GREEN], registration: ['Registration', TEAL], ticket: ['Ticket', PURPLE], sponsorship: ['Sponsorship', '#B9851B'], in_kind: ['In kind', '#3A6EA5'], other: ['Other', MUTED] };
  var GMETH = [['', 'Not recorded'], ['cheque', 'Cheque'], ['etransfer', 'E-transfer'], ['cash', 'Cash'], ['card', 'Card'], ['online', 'Online'], ['other', 'Other']];
  var RSTS = { receipted: ['Receipted', GREEN], due: ['Receipt due', '#B9851B'], platform: ['Zeffy receipts it', TEAL], no: ['No receipt', MUTED] };
  var GF = { view: '', cfg: null, cfgErr: '', year: null, msg: '', err: '', sample: null };
  LOADERS.grcpt = function () { return pageAll(function (a, b) { return db.from('crm_gift_receipts_v').select('*').order('gift_id', { ascending: true }).range(a, b); }, function (r) { return String(r.gift_id); }); };
  function rcptFor(id) { return (S.grcpt || []).filter(function (r) { return String(r.gift_id) === String(id); })[0] || null; }
  function giftById(id) { return (S.gifts || []).filter(function (g) { return String(g.id) === String(id); })[0] || null; }
  /* receipts always show the cents */
  function cents(n) { var v = Number(n) || 0; try { return v.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (e) { return '$' + v.toFixed(2); } }
  function eligibleOf(g) { return Math.max(0, (Number(g.amount) || 0) - (Number(g.advantage_amount) || 0)); }
  /* the same rule as crm_gift_receipts_v, for the form while it is being filled in */
  function receiptRule(g) {
    var amt = Number(g.amount) || 0, adv = Number(g.advantage_amount) || 0;
    if (g.receipt_number) return ['receipted', 'Receipt ' + g.receipt_number];
    if (!g.contact_id) return ['no', 'Pick the donor'];
    if (g.kind === 'sponsorship') return ['no', 'A sponsorship gets an invoice or a thank-you, not a tax receipt'];
    if (g.kind === 'other') return ['no', 'Not a gift'];
    if (amt <= 0) return ['no', 'No amount'];
    if (adv > 0.8 * amt) return ['no', 'What they received is worth more than 80% of the amount'];
    if (g.kind === 'in_kind' && !String(g.in_kind_desc || '').trim()) return ['no', 'Describe the gift in kind first'];
    if (lower(g.platform) === 'zeffy') return ['platform', 'Zeffy issues the receipt'];
    return ['due', 'A receipt is due for ' + cents(eligibleOf(g))];
  }
  function gchip(map, k) { var d = map[k] || [k || '?', MUTED]; return '<span class="w154chip" style="background:' + d[1] + '17;color:' + d[1] + '"><i style="background:' + d[1] + '"></i>' + E(d[0]) + '</span>'; }

  /* ---------- the gift form (a sheet) ---------- */
  function giftForm(id, contactId) {
    var g = id ? giftById(id) : null, isNew = !g, hub = !g || lower(g.platform) === 'hub';
    var x = g || { contact_id: contactId || null, amount: '', donated_at: today(), kind: 'donation', method: 'cheque', campaign: '', designation: '', advantage_amount: 0, advantage_desc: '', in_kind_desc: '', appraiser: '', tribute_kind: '', tribute_name: '', notes: '', platform: 'hub' };
    var c = x.contact_id ? contact(x.contact_id) : null;
    var donor = c ? '<div class="w158donor">' + avatar(c) + '<b>' + E(c.full_name) + '</b><span class="m">' + E(c.emails[0] || '') + '</span></div>'
      : '<input data-f="donor" list="w158donors" placeholder="Type a name or an email" autocomplete="off"><datalist id="w158donors">' + (S.contacts || []).filter(function (k) { return !/^\(no name\)$/i.test(k.full_name || ''); }).slice(0, 3000).map(function (k) { return '<option value="' + E(k.full_name + (k.emails[0] ? ' · ' + k.emails[0] : '') + ' (#' + k.id + ')') + '"></option>'; }).join('') + '</datalist>';
    var kinds = Object.keys(GKIND).map(function (k) { return [k, GKIND[k][0]]; });
    var ro = hub ? '' : ' disabled';
    var html = '<h2>' + (isNew ? 'Record a gift' : 'A gift of ' + E(money(x.amount))) + '</h2>' +
      '<div class="sub">' + (isNew ? 'A cheque, an e-transfer or cash that came in outside Zeffy and Keela. The thank-you automation starts on its own if it is on.' : hub ? 'Recorded in the Hub' + (x.created_by ? ' by ' + E(x.created_by) : '') + '.' : 'From ' + E(platName(x.platform)) + ': the amount, the date and the donor stay as ' + E(platName(x.platform)) + ' recorded them.') + '</div>' +
      '<div class="w152form" data-w158gift="' + E(id || 'new') + '">' +
      field('Donor', donor, true) +
      field('Amount ($)', '<input data-f="amount" type="number" step="0.01" min="0" value="' + E(x.amount) + '"' + ro + '>') + field('Date received', '<input data-f="donated_at" type="date" value="' + E(dayOf(x.donated_at) || today()) + '"' + ro + '>') +
      field('What kind of money', sel('kind', kinds, x.kind || 'donation')) + field('How it came', sel('method', GMETH, x.method || '')) +
      field('Campaign', inp('campaign', x.campaign, 'Rally Paper 2026, the Sunday meals')) + field('Designation', inp('designation', x.designation, 'Toronto, the kitchen')) +
      '<div class="full w158adv"' + (x.kind === 'registration' || x.kind === 'ticket' || x.kind === 'other' || Number(x.advantage_amount) ? '' : ' hidden') + '>' +
        field('What they received ($)', '<input data-f="advantage_amount" type="number" step="0.01" min="0" value="' + E(Number(x.advantage_amount) || 0) + '">', false, 'the meal, the ticket, playing in the tournament') +
        field('Described as', inp('advantage_desc', x.advantage_desc, 'Dinner at the gala')) + '</div>' +
      '<div class="full w158ink"' + (x.kind === 'in_kind' ? '' : ' hidden') + '>' + field('The gift in kind', inp('in_kind_desc', x.in_kind_desc, '40 winter coats'), true, 'the amount is its fair market value') +
        field('Appraised by (optional)', inp('appraiser', x.appraiser, 'Name and address')) + '</div>' +
      field('In honour or memory of', sel('tribute_kind', [['', 'No'], ['honour', 'In honour of'], ['memory', 'In memory of']], x.tribute_kind || '')) + field('Their name', inp('tribute_name', x.tribute_name, 'Their name')) +
      field('Notes', area('notes', x.notes, 'Cheque number, who dropped it off, anything the treasurer should know'), true) +
      '<div class="note full w158rule" data-w158rule>' + E(receiptRule(x)[1]) + '</div>' +
      '</div><div class="w152foot"><span class="w152err" data-w152err></span>' +
      (!isNew && hub && amAdmin() ? '<button class="w152btn ghost" data-w158del="' + E(id) + '">' + I('trash') + ' Delete</button>' : '') +
      (!isNew ? '<button class="w152btn ghost" data-w158sample="' + E(id) + '">' + I('note') + ' Sample receipt</button>' : '') +
      '<button class="w152btn ghost" data-w152close="1">Cancel</button><button class="w152btn" data-w158save="' + E(id || 'new') + '">' + I('check') + (isNew ? ' Record it' : ' Save') + '</button></div>';
    openSheet(html, 'gift:' + (id || 'new'), true);
  }
  function giftFormValues(box) {
    var v = {}; box.querySelectorAll('[data-f]').forEach(function (el) { v[el.getAttribute('data-f')] = el.value; });
    return v;
  }
  function donorFrom(v, box) {
    var id = box.getAttribute('data-w158gift'), g = id !== 'new' ? giftById(id) : null;
    if (g) return g.contact_id;
    var fixed = box.querySelector('.w158donor') ? GF.formContact : null; if (fixed) return fixed;
    var m = /\(#(\d+)\)\s*$/.exec(String(v.donor || '')); return m ? Number(m[1]) : null;
  }
  function refreshRule(box) {
    var v = giftFormValues(box), id = box.getAttribute('data-w158gift'), g = id !== 'new' ? giftById(id) : {};
    var x = Object.assign({}, g, v, { contact_id: donorFrom(v, box) || (g && g.contact_id) });
    var el = box.querySelector('[data-w158rule]'); if (el) el.textContent = receiptRule(x)[1];
    var adv = box.querySelector('.w158adv'); if (adv) adv.hidden = !(v.kind === 'registration' || v.kind === 'ticket' || v.kind === 'other' || Number(v.advantage_amount));
    var ink = box.querySelector('.w158ink'); if (ink) ink.hidden = v.kind !== 'in_kind';
  }
  function saveGift(btn) {
    var sh = document.getElementById('w152sheet'), box = sh && sh.querySelector('[data-w158gift]'); if (!box) return;
    var id = box.getAttribute('data-w158gift'), g = id !== 'new' ? giftById(id) : null, hub = !g || lower(g.platform) === 'hub';
    var v = giftFormValues(box), err = sh.querySelector('[data-w152err]');
    var say = function (m) { if (err) err.textContent = m; };
    var cid = donorFrom(v, box), amt = Number(v.amount), adv = Number(v.advantage_amount) || 0;
    if (!cid) { say('Pick the donor from the list (type a name or an email).'); return; }
    if (hub && !(amt > 0)) { say('The amount must be more than $0.'); return; }
    if (hub && (!v.donated_at || v.donated_at > today())) { say('The date received is today or earlier.'); return; }
    if (adv < 0 || (hub && adv > amt) || (!hub && adv > Number(g.amount))) { say('What they received cannot be more than the amount.'); return; }
    if (v.kind === 'in_kind' && !String(v.in_kind_desc || '').trim()) { say('Describe the gift in kind.'); return; }
    if (v.tribute_kind && !String(v.tribute_name || '').trim()) { say('Whose honour or memory is it in?'); return; }
    var row = { kind: v.kind, method: v.method || null, campaign: String(v.campaign || '').trim() || null, designation: String(v.designation || '').trim() || null,
      advantage_amount: adv, advantage_desc: String(v.advantage_desc || '').trim() || null, in_kind_desc: v.kind === 'in_kind' ? String(v.in_kind_desc || '').trim() : null,
      appraiser: v.kind === 'in_kind' ? (String(v.appraiser || '').trim() || null) : null, tribute_kind: v.tribute_kind || null, tribute_name: v.tribute_kind ? String(v.tribute_name || '').trim() : null,
      notes: String(v.notes || '').trim() || null, updated_by: actor(), updated_at: new Date().toISOString() };
    if (hub) { row.amount = Math.round(amt * 100) / 100; row.donated_at = v.donated_at + 'T12:00:00-04:00'; row.currency = 'CAD'; }
    if (btn) btn.disabled = true;
    var q = g ? db.from('crm_donations').update(row).eq('id', g.id).select().single()
      : db.from('crm_donations').insert(Object.assign({ contact_id: cid, platform: 'hub', created_by: actor(), receipt_eligible: row.kind !== 'sponsorship' && row.kind !== 'other' }, row)).select().single();
    Promise.resolve(q).then(function (r) {
      if (btn) btn.disabled = false;
      if (r && r.error) { say('Not saved: ' + (r.error.message || r.error)); return; }
      GF.msg = g ? 'Saved.' : 'Recorded: ' + cents(row.amount) + ' from ' + ((contact(cid) || {}).full_name || 'the donor') + '.';
      Promise.all([load('gifts', true), load('grcpt', true)]).then(function () { closeSheet(true); if (S.detail[String(cid)]) delete S.detail[String(cid)]; if (S.ui.tab === 'gifts') paint(); });
    });
  }
  function delGift(id) {
    Promise.resolve(db.from('crm_donations').delete().eq('id', Number(id))).then(function (r) {
      GF.msg = r && r.error ? 'Not deleted: ' + (r.error.message || r.error) : 'Deleted.';
      Promise.all([load('gifts', true), load('grcpt', true)]).then(function () { closeSheet(true); paint(); });
    });
  }

  /* ---------- a sample receipt ---------- */
  function sampleReceipt(id) {
    openSheet('<h2>Sample receipt</h2>' + busy('Putting it together…'), 'rcpt:' + id);
    Promise.resolve(db.rpc('crm_receipt_sample', { p_gift_id: Number(id) })).then(function (r) {
      if (S.sheet !== 'rcpt:' + id) return;
      if (!r || r.error || !r.data) { openSheet('<h2>Sample receipt</h2><div class="w152err">' + E((r && r.error && (r.error.message || r.error)) || 'It did not come back.') + '</div>', 'rcpt:' + id); return; }
      openSheet(receiptHtml(r.data), 'rcpt:' + id);
    });
  }
  function receiptHtml(s) {
    var line = function (l, v, warn) { return '<div class="w158rl"><span>' + E(l) + '</span><b' + (warn ? ' class="w158miss"' : '') + '>' + E(v) + '</b></div>'; };
    var ws = (s.warnings || []);
    return '<h2>Sample receipt</h2><div class="sub">What the Hub’s receipt for this gift would say, with every field the CRA asks for. It is not numbered, kept or sent: issuing receipts from the Hub starts once the treasurer confirms the settings.</div>' +
      (ws.length ? '<div class="w155cf test"><b>Before this could be a real receipt:</b><ul class="w157ul">' + ws.map(function (w) { return '<li>' + E(w) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="w158rc"><div class="w158wm" aria-hidden="true">SAMPLE</div>' +
      '<div class="w158rh"><b>' + E(s.charity_name) + '</b><span>' + E(s.charity_address || '') + '</span><span>Charitable registration number ' + E(s.charity_number || '') + '</span></div>' +
      '<div class="w158rt">Official receipt for income tax purposes</div>' +
      line('Receipt number', (s.serial || '') + ' (sample)') + line('Issued at', s.location) + line('Date issued', s.issued_date) +
      line('Received from', s.donor_name || 'no name on file', !s.donor_name) + line('Address', s.donor_address || 'no address on file', !s.donor_address) +
      line('Date the gift was received', s.gift_date) +
      (s.kind === 'in_kind' ? line('The gift', s.in_kind_desc || '') + (s.appraiser ? line('Appraised by', s.appraiser) : '') : '') +
      line(s.kind === 'in_kind' ? 'Fair market value of the gift' : 'Total amount received', cents(s.amount)) +
      line('Value of the advantage', cents(s.advantage_amount) + (s.advantage_desc ? ' (' + s.advantage_desc + ')' : '')) +
      line('Eligible amount of the gift for tax purposes', cents(s.eligible_amount)) +
      '<div class="w158sig"><span class="w158line"></span><span>' + E(s.signatory_name ? s.signatory_name + (s.signatory_title ? ', ' + s.signatory_title : '') : 'Authorized signature (no signatory yet)') + '</span></div>' +
      '<div class="w158cra">' + E(s.cra) + '</div></div>' +
      '<div class="m" data-w158bsay role="status"></div>' +
      '<div class="w152foot"><button class="w152btn ghost" data-w152close="1">Close</button><button class="w152btn ghost" data-w158bpdfsample="1">' + I('note') + ' Download the sample (PDF)</button><button class="w152btn" data-w158print="1">' + I('note') + ' Print the sample</button></div>';
  }

  /* ---------- receipts: settings, the year's receipts due ---------- */
  function loadRcfg() {
    return Promise.resolve(db.rpc('crm_receipt_config')).then(function (r) { GF.cfg = (r && r.data) || {}; GF.cfgErr = r && r.error ? String(r.error.message || r.error) : ''; }, function () { GF.cfg = {}; });
  }
  function receiptsHtml() {
    var cfg = GF.cfg || {}, admin = !!cfg.is_admin;
    var years = {}; (S.grcpt || []).forEach(function (r) { if (r.tax_year) years[r.tax_year] = 1; });
    var ys = Object.keys(years).sort().reverse(), yr = GF.year || String(new Date(today() + 'T12:00:00').getFullYear());
    if (ys.indexOf(yr) < 0) ys.unshift(yr);
    var due = (S.grcpt || []).filter(function (r) { return String(r.tax_year) === String(yr) && r.receipt_status === 'due'; });
    var by = {}; due.forEach(function (r) { var k = String(r.contact_id); (by[k] = by[k] || { id: r.contact_id, gifts: [], total: 0 }); by[k].gifts.push(r); by[k].total += Number(r.eligible_amount) || 0; });
    var donors = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.total - a.total; });
    var total = due.reduce(function (a, r) { return a + (Number(r.eligible_amount) || 0); }, 0);
    var done = (S.grcpt || []).filter(function (r) { return String(r.tax_year) === String(yr) && r.receipt_status === 'receipted'; }).length;
    var set = function (k, label, ph, hint) { return '<label class="w155lb">' + E(label) + (hint ? ' <span class="m">' + E(hint) + '</span>' : '') + '<input class="w152in" data-w158cfg="' + k + '" value="' + E(cfg[k] || '') + '" placeholder="' + E(ph || '') + '"' + (admin ? '' : ' disabled') + '></label>'; };
    return '<div class="w155grid"><div class="w154card"><h3>' + I('note') + ' Receipt settings</h3>' +
      '<p class="m">What every CRA receipt from the Hub will carry. Keela’s 55 receipts stay the legal copies; the numbering here must not repeat Keela’s KEE numbers.</p>' +
      (GF.err ? '<div class="w152err">' + E(GF.err) + '</div>' : '') + (GF.msg ? '<div class="w154msg">' + E(GF.msg) + '</div>' : '') +
      (RB.err ? '<div class="w152err">' + E(RB.err) + '</div>' : '') + (RB.msg ? '<div class="w154msg">' + E(RB.msg) + '</div>' : '') + rbStatusHtml(cfg) +
      set('receipt_charity_name', 'Charity name', 'Welfare Avenue', 'as on file with the CRA') + set('receipt_charity_address', 'Charity address', '', 'as on file with the CRA') +
      '<div class="w154kv"><span>Registration number</span><span>' + E(cfg.mail_charity_number || '') + '</span></div>' +
      set('receipt_location', 'Where receipts are issued', 'Montreal, Quebec') +
      '<div class="w155two">' + set('receipt_prefix', 'Number prefix', 'WA-2026-') + set('receipt_next_number', 'Next number', '1') + '</div>' +
      '<div class="w155two">' + set('receipt_signatory_name', 'Signed by', 'Full name') + set('receipt_signatory_title', 'Their title', 'Treasurer') + '</div>' +
      (admin ? '<div class="w154acts"><button class="w152btn" data-w158cfgsave="1">' + I('check') + ' Save the settings</button></div>' : '<p class="m">Only an admin changes these.</p>') + '</div>' +
      '<div class="w154card"><h3>' + I('heart') + ' Receipts due for ' + E(yr) + ' <select class="w152sel w158yr" data-w158year aria-label="Tax year">' + ys.map(function (y) { return '<option' + (y === yr ? ' selected' : '') + '>' + E(y) + '</option>'; }).join('') + '</select></h3>' +
      '<p class="m">Receipts follow the donor’s tax year (January to December), not the fiscal year. The year-end run gives each donor one receipt for the year.</p>' +
      '<div class="w152stats"><div class="w152st"><b>' + E(cents(total)) + '</b><span>eligible, ' + plural(due.length, 'gift', 'gifts') + '</span></div><div class="w152st"><b>' + donors.length + '</b><span>' + (donors.length === 1 ? 'donor' : 'donors') + ' to receipt</span></div><div class="w152st"><b>' + done + '</b><span>already receipted</span></div></div>' +
      rbRunHtml(donors.length, yr) +
      (donors.length ? '<div class="w156fl">' + donors.map(function (d) {
        var c = contact(d.id), noAddr = c && !String(c.address || '').trim();
        return '<div class="w156fr"><span><a href="#crm/c/' + E(d.id) + '">' + E(c ? c.full_name : 'Contact ' + d.id) + '</a><span class="m"> · ' + plural(d.gifts.length, 'gift', 'gifts') + (noAddr ? ' · <span class="w156warn">no address on file</span>' : '') + '</span></span><span>' + E(cents(d.total)) + '</span>' +
          '<button class="w152mini" data-w158sample="' + E(d.gifts[0].gift_id) + '">Sample</button>' + rbDueActions(d, yr) + '</div>';
      }).join('') + '</div>' : '<p class="m">No receipt is due for ' + E(yr) + '.</p>') +
      '<div class="w154acts"><button class="w152btn ghost" data-w152go="#crm/gifts">Back to the gifts</button></div></div>' + rbIssuedHtml() + '</div>';
  }
  function saveRcfg() {
    var p = {}; document.querySelectorAll('#crm [data-w158cfg]').forEach(function (el) { p[el.getAttribute('data-w158cfg')] = el.value; });
    GF.err = ''; GF.msg = '';
    Promise.resolve(db.rpc('crm_receipt_config_set', { p: p })).then(function (r) {
      if (r && r.error) GF.err = 'Not saved: ' + (r.error.message || r.error); else { GF.cfg = r.data || GF.cfg; GF.msg = 'Saved.'; }
      paint();
    });
  }

  /* ---------- styles ---------- */
  var css158 = document.createElement('style'); css158.id = 'w158css';
  css158.textContent = ''
    + '.w158row .amt .m{font-weight:400;font-size:12.5px;line-height:1.35;}.w158row{cursor:pointer;}.w158row:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:-2px;}'
    + '.w158donor{display:flex;align-items:center;gap:8px;min-width:0;}.w158donor .m{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.w158adv,.w158ink{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;}.w158adv[hidden],.w158ink[hidden]{display:none;}.w158rule{font-weight:600;}'
    + '.w158rc{position:relative;overflow:hidden;border:1px solid rgba(16,63,57,.2);border-radius:12px;padding:18px 20px;margin:12px 0;background:' + CREAM + ';color:' + INK + ';}'
    + '.w158wm{position:absolute;top:38%;left:-10%;right:-10%;text-align:center;transform:rotate(-18deg);font-family:' + HEAD + ';font-size:84px;letter-spacing:10px;color:rgba(179,64,47,.12);pointer-events:none;}'
    + '.w158rh{display:flex;flex-direction:column;gap:2px;font-size:13px;margin-bottom:10px;}.w158rh b{font-family:' + HEAD + ';font-size:22px;letter-spacing:.5px;text-transform:uppercase;color:' + GREEN + ';}'
    + '.w158rt{font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:12.5px;color:' + GREEN + ';border-top:2px solid ' + GOLD + ';padding-top:8px;margin:6px 0 8px;}'
    + '.w158rl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:10px;padding:5px 0;border-bottom:1px dashed rgba(16,63,57,.12);font-size:13.5px;}.w158rl b{font-weight:600;}.w158miss{color:' + FLAG + ';}'
    + '.w158sig{display:flex;flex-direction:column;gap:4px;margin:18px 0 6px;font-size:13px;}.w158line{display:block;width:220px;border-bottom:1px solid ' + INK + ';height:26px;}.w158cra{font-size:12px;color:' + MUTED + ';margin-top:8px;}'
    + '.w158yr{display:inline-block;width:auto;margin-left:8px;vertical-align:middle;}'
    + '@media (max-width:700px){.w158adv,.w158ink{grid-template-columns:1fr;}.w158rl{grid-template-columns:1fr;gap:2px;}}'
    + '@media print{body *{visibility:hidden !important;}#w152sheet .w158rc,#w152sheet .w158rc *{visibility:visible !important;}#w152sheet .w158rc{position:fixed;left:0;top:0;width:100%;border:none;}}';
  document.head.appendChild(css158);

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest) return;
    if ((el = t.closest('[data-w158new]'))) { e.preventDefault(); GF.formContact = el.getAttribute('data-w158new') === '1' ? null : Number(el.getAttribute('data-w158new')); giftForm(null, GF.formContact); return; }
    if ((el = t.closest('[data-w158open]'))) { if (t.closest('a')) return; e.preventDefault(); GF.formContact = null; giftForm(el.getAttribute('data-w158open')); return; }
    if ((el = t.closest('[data-w158save]'))) { e.preventDefault(); saveGift(el); return; }
    if ((el = t.closest('[data-w158del]'))) { e.preventDefault(); if (el.getAttribute('data-sure') === '1') delGift(el.getAttribute('data-w158del')); else { el.setAttribute('data-sure', '1'); el.innerHTML = I('trash') + ' Delete it for good?'; } return; }
    if ((el = t.closest('[data-w158sample]'))) { e.preventDefault(); sampleReceipt(el.getAttribute('data-w158sample')); return; }
    if ((el = t.closest('[data-w158print]'))) { e.preventDefault(); try { window.print(); } catch (x) { /* fine */ } return; }
    if ((el = t.closest('[data-w158cfgsave]'))) { e.preventDefault(); saveRcfg(); return; }
  });
  document.addEventListener('keydown', function (e) { var t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.hasAttribute && t.hasAttribute('data-w158open')) { e.preventDefault(); GF.formContact = null; giftForm(t.getAttribute('data-w158open')); } });
  document.addEventListener('input', function (e) { var t = e.target, box = t && t.closest && t.closest('[data-w158gift]'); if (box) refreshRule(box); });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var box = t.closest('[data-w158gift]'); if (box) { refreshRule(box); return; }
    if (t.hasAttribute('data-w158year')) { GF.year = t.value; paint(); }
  });
