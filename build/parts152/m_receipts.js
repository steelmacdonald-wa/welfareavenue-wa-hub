  /* ======================= Official receipts (wave158b, 28/09/26) =======================
     The machinery for CRA receipts from the Hub, built while receipts stay off. In Receipts: whether receipts from the Hub are on,
     what is still missing (the settings and a signature image), the signature (admins upload an image; the Hub keeps it as a PNG
     in the private bucket), the switch for admins (on needs everything; the treasurer and Steel decide), Issue for a donor's due
     gifts of the tax year (one receipt: one gift, or several as the year-end run does), the year-end run (one receipt per donor),
     and the receipts issued, each with its PDF, Replace and Cancel (with the reason). A sample receipt downloads as a PDF drawn by
     receipt-pdf, marked SAMPLE. Issuing and replacing refuse in the database while receipt_mode is off. */
  var RB = { busy: '', msg: '', err: '', act: null, confirmOn: false, run: null, sigUrl: null, sigAt: 0 };
  LOADERS.rcpts = function () { return db.from('crm_receipts').select('id,serial,contact_id,tax_year,kind,status,gift_ids,amount,advantage_amount,eligible_amount,donor,issued_at,issued_by,replaces_id,replaced_by_id,cancelled_at,cancel_reason,pdf_path,cancelled_pdf_path').order('issued_at', { ascending: false }).order('id', { ascending: false }).limit(3000); };
  function rbFn(body) {
    if (typeof db === 'undefined' || !db || !db.functions) return Promise.resolve({ error: 'offline' });
    return Promise.resolve(db.functions.invoke('receipt-pdf', { body: body })).then(function (r) {
      if (r && r.error) {
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { return { error: (j && j.error) || r.error.message || 'The receipt function refused.' }; }, function () { return { error: r.error.message || 'The receipt function refused.' }; });
        return { error: r.error.message || 'The receipt function refused.' };
      }
      return (r && r.data) || {};
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }
  function rbOn() { return !!(GF.cfg && GF.cfg.receipt_mode === 'on'); }
  function rbAdmin() { return !!(GF.cfg && GF.cfg.is_admin); }
  function rbSave(bytes, name, type) {
    try {
      var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: type || 'application/pdf' }), url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* fine */ } }, 30000);
      return true;
    } catch (e) { return false; }
  }
  function rbB64(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function rbRefresh() { S.at.rcpts = 0; S.at.gifts = 0; S.at.grcpt = 0; return Promise.all([load('rcpts', true), load('gifts', true), load('grcpt', true), loadRcfg()]).then(function () { if (S.ui.tab === 'gifts') paint(); }); }
  function rbSay(msg, err) { RB.msg = err ? '' : msg; RB.err = err ? msg : ''; RB.busy = ''; if (S.ui.tab === 'gifts') paint(); }

  /* ---------- the sample as a PDF ---------- */
  function rbSamplePdf(btn) {
    var m = /^rcpt:(\d+)$/.exec(S.sheet || ''); if (!m) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Drawing the PDF…'; }
    rbFn({ action: 'sample', gift_id: Number(m[1]) }).then(function (r) {
      if (btn) { btn.disabled = false; btn.innerHTML = I('note') + ' Download the sample (PDF)'; }
      var box = document.querySelector('#w152sheet [data-w158bsay]');
      if (r.error || !r.pdf_b64) { if (box) box.textContent = 'The PDF did not come back: ' + (r.error || 'no file'); return; }
      rbSave(rbB64(r.pdf_b64), 'sample-receipt-gift-' + m[1] + '.pdf');
      if (box) box.textContent = 'Downloaded: sample-receipt-gift-' + m[1] + '.pdf (marked SAMPLE).';
    });
  }

  /* ---------- in Receipts: the switch, the signature ---------- */
  function rbStatusHtml(cfg) {
    var on = cfg.receipt_mode === 'on', admin = !!cfg.is_admin, missing = (cfg.missing || []).slice();
    if (!cfg.signature) missing.push('a signature image');
    var sig = '<div class="w158bsig">' + (cfg.signature ? (RB.sigUrl ? '<img src="' + E(RB.sigUrl) + '" alt="The signature on receipts">' : '<span class="m">A signature image is uploaded.</span>') : '<span class="m">No signature image yet.</span>') +
      (admin ? '<label class="w152btn sm ghost w158bup">' + I('edit') + (cfg.signature ? ' Replace the signature' : ' Upload the signature') + '<input type="file" accept="image/png,image/jpeg" data-w158bsig hidden></label>' : '') + '</div>';
    return '<div class="w158bmode ' + (on ? 'on' : 'off') + '"><b>Receipts from the Hub are ' + (on ? 'on' : 'off') + '.</b> ' +
      (on ? 'Admins issue, replace and cancel them below; every receipt takes the next number.'
        : missing.length ? 'Before an admin can turn them on: ' + E(listJoin(missing)) + '.' : 'Everything is ready: an admin can turn them on once the treasurer and Steel agree.') + '</div>' +
      '<div class="w155lb">The signature on receipts <span class="m">the treasurer’s, or another person the board authorizes; a PNG or JPG on a white or clear background</span></div>' + sig +
      (admin ? (RB.confirmOn ? '<div class="w155cf"><b>Turn receipts from the Hub on?</b> From then on admins can issue official receipts with the next number (' + E((cfg.receipt_prefix || '') + String(cfg.receipt_next_number || '').padStart(4, '0')) + '), and Keela stops being the only place receipts come from. The treasurer and Steel decide this.' +
          '<div class="w154acts"><button class="w152btn" data-w158bmode="on">' + I('check') + ' Turn them on</button><button class="w152btn ghost" data-w158bmodeno="1">Not yet</button></div></div>'
        : '<div class="w154acts">' + (on ? '<button class="w152btn ghost" data-w158bmode="off">' + I('lock') + ' Turn receipts off</button>' : '<button class="w152btn ghost" data-w158bask="1"' + (missing.length ? ' disabled title="' + E('Missing: ' + missing.join(', ')) + '"' : '') + '>' + I('check') + ' Turn receipts on…</button>') + '</div>') : '');
  }
  function rbSigLoad() {
    if (!GF.cfg || !GF.cfg.signature || RB.sigUrl || Date.now() - RB.sigAt < 60000 || !db.storage) return;
    RB.sigAt = Date.now();
    Promise.resolve(db.storage.from('receipts').createSignedUrl('settings/signature.png', 600)).then(function (r) {
      if (r && r.data && r.data.signedUrl) { RB.sigUrl = r.data.signedUrl; if (S.ui.tab === 'gifts' && GF.view === 'receipts') paint(); }
    }, function () { /* fine */ });
  }
  function rbSigUpload(input) {
    var f = input.files && input.files[0]; if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { rbSay('A PNG or JPG, please.', true); return; }
    RB.busy = 'sig'; RB.msg = 'Uploading the signature…'; paint();
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      /* kept as a PNG no wider than 900 px, so the PDF can use it */
      var sc = Math.min(1, 900 / img.naturalWidth), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      try { URL.revokeObjectURL(url); } catch (e) { /* fine */ }
      c.toBlob(function (blob) {
        if (!blob) { rbSay('That image could not be read.', true); return; }
        Promise.resolve(db.storage.from('receipts').upload('settings/signature.png', blob, { upsert: true, contentType: 'image/png' })).then(function (r) {
          if (r && r.error) { rbSay('Not uploaded: ' + (r.error.message || r.error), true); return; }
          RB.sigUrl = null; RB.sigAt = 0;
          try { db.from('change_log').insert({ entity_type: 'receipts', entity_id: 'settings', field: 'signature', old_value: null, new_value: 'uploaded', changed_by: actor() }); } catch (e) { /* the upload is what counts */ }
          loadRcfg().then(function () { rbSay('The signature is saved.'); });
        });
      }, 'image/png');
    };
    img.onerror = function () { rbSay('That image could not be read.', true); };
    img.src = url;
  }
  function rbModeSet(mode) {
    RB.busy = 'mode'; RB.confirmOn = false;
    Promise.resolve(db.rpc('crm_receipt_mode_set', { p_mode: mode })).then(function (r) {
      if (r && r.error) { rbSay('Not changed: ' + (r.error.message || r.error), true); return; }
      GF.cfg = r.data || GF.cfg; rbSay(mode === 'on' ? 'Receipts from the Hub are on.' : 'Receipts from the Hub are off.');
    });
  }

  /* ---------- issuing ---------- */
  function rbIssue(giftIds, quiet) {
    return Promise.resolve(db.rpc('crm_receipt_issue', { p_gift_ids: giftIds.map(Number) })).then(function (r) {
      if (r && r.error) return { error: r.error.message || String(r.error) };
      var id = r && r.data; if (id && typeof id === 'object') id = id.crm_receipt_issue != null ? id.crm_receipt_issue : id.id;
      return rbFn({ action: 'render', receipt_id: Number(id) }).then(function (p) { return { id: id, pdf: p && !p.error, pdfErr: p && p.error }; });
    });
  }
  function rbIssueDonor(cid, year) {
    var gifts = (S.grcpt || []).filter(function (r) { return String(r.contact_id) === String(cid) && String(r.tax_year) === String(year) && r.receipt_status === 'due'; }).map(function (r) { return r.gift_id; });
    if (!gifts.length) return;
    RB.busy = 'issue:' + cid; paint();
    rbIssue(gifts).then(function (x) {
      if (x.error) { rbSay('Not issued: ' + x.error, true); return; }
      rbSay('Receipt issued' + (x.pdf ? ' and its PDF kept.' : '; the PDF did not come back (' + (x.pdfErr || '?') + '): Make the PDF below.'));
      rbRefresh();
    });
  }
  function rbYearRun(year) {
    var by = {};
    (S.grcpt || []).forEach(function (r) { if (String(r.tax_year) === String(year) && r.receipt_status === 'due') (by[r.contact_id] = by[r.contact_id] || []).push(r.gift_id); });
    var ids = Object.keys(by), done = 0, bad = [];
    if (!ids.length) return;
    RB.busy = 'run'; RB.run = { total: ids.length, done: 0 }; paint();
    var step = function (i) {
      if (i >= ids.length) { RB.run = null; rbSay(plural(done, 'receipt', 'receipts') + ' issued for ' + year + (bad.length ? '; not issued: ' + bad.join('; ') : '.'), !!bad.length && !done); rbRefresh(); return; }
      rbIssue(by[ids[i]]).then(function (x) {
        if (x.error) { var c = contact(ids[i]); bad.push((c ? c.full_name : 'contact ' + ids[i]) + ' (' + x.error + ')'); } else done++;
        RB.run.done = i + 1; if (S.ui.tab === 'gifts') paint();
        step(i + 1);
      });
    };
    step(0);
  }
  function rbDueActions(d, year) {
    if (!rbAdmin() || !rbOn()) return '';
    return '<button class="w152mini" data-w158bissue="' + E(d.id) + '" data-year="' + E(year) + '"' + (RB.busy ? ' disabled' : '') + '>' + (RB.busy === 'issue:' + d.id ? 'Issuing…' : 'Issue') + '</button>';
  }
  function rbRunHtml(n, year) {
    if (!n) return '';
    if (RB.run) return '<div class="w154msg">Issuing ' + RB.run.done + ' of ' + RB.run.total + '…</div>';
    if (!rbOn()) return '<p class="m">' + I('lock') + ' Issuing waits until receipts from the Hub are on.</p>';
    if (!rbAdmin()) return '<p class="m">An admin issues the receipts.</p>';
    return '<div class="w154acts"><button class="w152btn" data-w158brun="' + E(year) + '"' + (RB.busy ? ' disabled' : '') + '>' + I('send') + ' Issue one receipt per donor (' + n + ')</button></div>';
  }

  /* ---------- the receipts issued ---------- */
  function rbPdf(id, which) {
    var r = (S.rcpts || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
    var path = which === 'cancelled' ? r.cancelled_pdf_path : r.pdf_path;
    if (!path || !db.storage) return;
    Promise.resolve(db.storage.from('receipts').createSignedUrl(path, 120)).then(function (s) {
      if (s && s.data && s.data.signedUrl) { try { window.open(s.data.signedUrl, '_blank', 'noopener'); } catch (e) { /* fine */ } }
      else rbSay('The PDF could not be opened' + (s && s.error ? ': ' + (s.error.message || s.error) : '.'), true);
    });
  }
  function rbMake(id) {
    RB.busy = 'pdf:' + id; paint();
    rbFn({ action: 'render', receipt_id: Number(id) }).then(function (p) {
      if (p.error) { rbSay('The PDF was not made: ' + p.error, true); return; }
      rbSay('The PDF is kept.'); rbRefresh();
    });
  }
  function rbAct(id, kind) {
    var box = document.querySelector('#crm [data-w158breason="' + id + '"]'), why = box ? String(box.value || '').trim() : '';
    if (why.length < 3) { rbSay('Say why, in a few words.', true); return; }
    RB.busy = kind + ':' + id; paint();
    var q = kind === 'replace' ? db.rpc('crm_receipt_replace', { p_id: Number(id), p_reason: why }) : db.rpc('crm_receipt_cancel', { p_id: Number(id), p_reason: why });
    Promise.resolve(q).then(function (r) {
      if (r && r.error) { rbSay((kind === 'replace' ? 'Not replaced: ' : 'Not cancelled: ') + (r.error.message || r.error), true); return; }
      RB.act = null;
      var newId = kind === 'replace' ? (r && r.data && typeof r.data === 'object' ? r.data.crm_receipt_replace : r && r.data) : null;
      /* the kept copy marked cancelled, and the replacement's own PDF */
      rbFn({ action: 'render', receipt_id: Number(id) }).then(function () {
        return newId ? rbFn({ action: 'render', receipt_id: Number(newId) }) : null;
      }).then(function () {
        rbSay(kind === 'replace' ? 'Replaced: the original is kept, marked cancelled.' : 'Cancelled: the receipt is kept, marked cancelled, and its gifts follow the receipt rule again.');
        rbRefresh();
      });
    });
  }
  function rbIssuedHtml() {
    var list = S.rcpts || [], admin = rbAdmin(), on = rbOn();
    var bySerial = {}; list.forEach(function (r) { bySerial[r.id] = r.serial; });
    var rows = list.slice(0, 200).map(function (r) {
      var c = contact(r.contact_id), who = c ? '<a href="#crm/c/' + E(c.id) + '">' + E((r.donor && r.donor.name) || c.full_name) + '</a>' : E((r.donor && r.donor.name) || 'Contact ' + r.contact_id);
      var st = r.status === 'cancelled' ? (r.replaced_by_id ? 'Replaced by ' + (bySerial[r.replaced_by_id] || 'a new receipt') : 'Cancelled') : 'Issued';
      var acts = [];
      if (r.pdf_path) acts.push('<button class="w152mini" data-w158bpdf="' + E(r.id) + '">' + I('note') + ' PDF</button>');
      else if (admin) acts.push('<button class="w152mini" data-w158bmake="' + E(r.id) + '"' + (RB.busy ? ' disabled' : '') + '>Make the PDF</button>');
      if (r.cancelled_pdf_path) acts.push('<button class="w152mini" data-w158bpdf="' + E(r.id) + '" data-which="cancelled">Cancelled copy</button>');
      if (admin && r.status === 'issued') {
        if (on) acts.push('<button class="w152mini" data-w158bdo="replace" data-id="' + E(r.id) + '">Replace</button>');
        acts.push('<button class="w152mini" data-w158bdo="cancel" data-id="' + E(r.id) + '">Cancel</button>');
      }
      var form = RB.act && String(RB.act.id) === String(r.id) ? '<div class="w158bwhy"><input class="w152in" data-w158breason="' + E(r.id) + '" placeholder="' + (RB.act.kind === 'replace' ? 'Why it is replaced (the address changed, a typo…)' : 'Why it is cancelled (issued in error…)') + '">' +
        '<button class="w152btn sm" data-w158bgo="' + E(RB.act.kind) + '" data-id="' + E(r.id) + '">' + (RB.act.kind === 'replace' ? 'Replace it' : 'Cancel it') + '</button><button class="w152btn sm ghost" data-w158bstop="1">Keep it</button></div>' : '';
      return '<div class="w158brow' + (r.status === 'cancelled' ? ' off' : '') + '"><span class="s"><b>' + E(r.serial) + '</b><span class="m">' + E(fmtDay(r.issued_at)) + (r.kind === 'annual' ? ' · ' + plural((r.gift_ids || []).length, 'gift', 'gifts') + ' in ' + E(r.tax_year) : '') + '</span></span>' +
        '<span class="w">' + who + '</span><span class="a">' + E(cents(r.eligible_amount)) + '</span><span class="t">' + gchip({ issued: ['Issued', GREEN], cancelled: [st, MUTED] }, r.status) + (r.cancel_reason ? '<span class="m"> ' + E(String(r.cancel_reason).replace(/^Replaced:\s*/, '')) + '</span>' : '') + '</span>' +
        '<span class="x">' + acts.join('') + '</span>' + form + '</div>';
    }).join('');
    return '<div class="w154card wide"><h3>' + I('note') + ' Receipts issued by the Hub <span class="m">' + plural(list.length, 'receipt', 'receipts') + '</span></h3>' +
      (list.length ? '<div class="w158brows">' + rows + '</div>' : '<p class="m">None yet. Keela’s 55 receipts are the legal copies until receipts from the Hub are on; then each one issued here is listed with its PDF.</p>') + '</div>';
  }

  /* ---------- styles ---------- */
  var css158b = document.createElement('style'); css158b.id = 'w158bcss';
  css158b.textContent = ''
    + '.w158bmode{border-radius:12px;padding:10px 12px;margin:10px 0 12px;font-size:13.5px;line-height:1.45;}.w158bmode.off{background:rgba(179,64,47,.07);}.w158bmode.on{background:rgba(42,140,122,.1);}'
    + '.w158bsig{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:4px 0 10px;}.w158bsig img{max-width:220px;max-height:70px;background:' + CREAM + ';border:1px solid rgba(16,63,57,.15);border-radius:8px;padding:4px;}'
    + '.w158bup{cursor:pointer;}.w158brows{display:flex;flex-direction:column;}'
    + '.w158brow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px dashed rgba(16,63,57,.12);font-size:13.5px;}'
    + '.w158brow.off{opacity:.72;}.w158brow .s{display:flex;flex-direction:column;min-width:0;}.w158brow .a{font-weight:600;font-variant-numeric:tabular-nums;}.w158brow .x{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;}'
    + '.w158brow .w a{color:inherit;font-weight:600;}.w158bwhy{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}.w158bwhy .w152in{flex:1 1 240px;}'
    + '@media (max-width:700px){.w158brow{grid-template-columns:minmax(0,1fr) auto;}.w158brow .w,.w158brow .t{grid-column:1/-1;}.w158brow .x{grid-column:1/-1;justify-content:flex-start;}}';
  document.head.appendChild(css158b);

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest) return;
    if (!t.closest('.w152root') && !t.closest('#w152sheet')) return;
    if ((el = t.closest('[data-w158bpdfsample]'))) { e.preventDefault(); rbSamplePdf(el); return; }
    if ((el = t.closest('[data-w158bask]'))) { e.preventDefault(); RB.confirmOn = true; RB.msg = ''; RB.err = ''; paint(); return; }
    if ((el = t.closest('[data-w158bmodeno]'))) { e.preventDefault(); RB.confirmOn = false; paint(); return; }
    if ((el = t.closest('[data-w158bmode]'))) { e.preventDefault(); rbModeSet(el.getAttribute('data-w158bmode')); return; }
    if ((el = t.closest('[data-w158bissue]'))) { e.preventDefault(); rbIssueDonor(el.getAttribute('data-w158bissue'), el.getAttribute('data-year')); return; }
    if ((el = t.closest('[data-w158brun]'))) { e.preventDefault(); rbYearRun(el.getAttribute('data-w158brun')); return; }
    if ((el = t.closest('[data-w158bpdf]'))) { e.preventDefault(); rbPdf(el.getAttribute('data-w158bpdf'), el.getAttribute('data-which')); return; }
    if ((el = t.closest('[data-w158bmake]'))) { e.preventDefault(); rbMake(el.getAttribute('data-w158bmake')); return; }
    if ((el = t.closest('[data-w158bdo]'))) { e.preventDefault(); RB.act = { id: el.getAttribute('data-id'), kind: el.getAttribute('data-w158bdo') }; RB.msg = ''; RB.err = ''; paint(); var inp = document.querySelector('#crm [data-w158breason]'); if (inp) inp.focus(); return; }
    if ((el = t.closest('[data-w158bstop]'))) { e.preventDefault(); RB.act = null; paint(); return; }
    if ((el = t.closest('[data-w158bgo]'))) { e.preventDefault(); rbAct(el.getAttribute('data-id'), el.getAttribute('data-w158bgo')); return; }
  });
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute('data-w158bsig')) rbSigUpload(t); });
