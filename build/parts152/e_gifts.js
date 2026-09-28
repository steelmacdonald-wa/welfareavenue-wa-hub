
  /* ---------- the Gifts tab (wave153): every gift with its donor, campaign, platform and receipt ---------- */
  function fyOf(day) { var d = dayOf(day); if (!d) return ''; var y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return String(m >= 10 ? y + 1 : y); } /* the fiscal year ends September 30 */
  function giftDonor(g) { var c = contact(g.contact_id); return c ? c.full_name : ''; }
  function giftHay(g) { var c = contact(g.contact_id); return fold([giftDonor(g), c ? c.emails.join(' ') : '', g.campaign, g.designation, g.platform, g.receipt_number, g.external_id, g.notes].join(' ')); }
  function giftMatches(g) {
    var u = S.ui;
    if (u.gplat && lower(g.platform) !== u.gplat) return false;
    if (u.gyear && fyOf(g.donated_at) !== u.gyear) return false;
    if (u.gq) { var words = fold(u.gq).split(/\s+/).filter(Boolean), hay = giftHay(g); if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return false; }
    return true;
  }
  function platName(p) { p = lower(p); return { zeffy: 'Zeffy', keela: 'Keela', stripe: 'Stripe', cash: 'Cash', cheque: 'Cheque', hub: 'The Hub', paypal: 'PayPal' }[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Unknown'); }
  function giftRow(g) {
    var c = contact(g.contact_id), nm = c ? c.full_name : 'Contact ' + g.contact_id;
    var rs = rcptFor(g.id), rule = rs ? [rs.receipt_status, rs.receipt_note] : receiptRule(g);
    var rc = g.receipt_number ? '<span class="rc">' + (g.receipt_url ? '<a href="' + E(g.receipt_url) + '" target="_blank" rel="noopener">Receipt ' + E(g.receipt_number) + ' ' + I('ext') + '</a>' : 'Receipt ' + E(g.receipt_number)) + (g.receipt_issued_at ? ' · ' + E(fmtDay(g.receipt_issued_at)) : '') + '</span>'
      : '<span class="rc">' + gchip(RSTS, rule[0]) + '<div class="m">' + E(rule[0] === 'due' ? 'for ' + cents(eligibleOf(g)) : rule[1]) + '</div></span>';
    var kind = g.kind && g.kind !== 'donation' ? ' ' + gchip(GKIND, g.kind) : '';
    return '<div class="w152row w158row" role="listitem" data-w158open="' + E(g.id) + '" tabindex="0" aria-label="Open the gift">' +
      '<span>' + E(fmtDay(g.donated_at)) + '</span>' +
      '<span><a href="#crm/c/' + E(g.contact_id) + '">' + E(nm) + '</a>' + (c && c.emails[0] ? '<div class="m">' + E(c.emails[0]) + '</div>' : '') + '</span>' +
      '<span class="amt">' + E(money(g.amount)) + (g.recurring ? '<small> monthly</small>' : '') + kind + (g.tribute_kind ? '<div class="m">' + E((g.tribute_kind === 'memory' ? 'In memory of ' : 'In honour of ') + (g.tribute_name || '')) + '</div>' : '') + '</span>' +
      '<span>' + E([g.campaign, g.designation].filter(Boolean).join(' · ') || '–') + '<div class="m">' + E(platName(g.platform)) + (g.method ? ' · ' + E((GMETH.filter(function (m) { return m[0] === g.method; })[0] || ['', g.method])[1]) : '') + '</div></span>' +
      '<span>' + rc + '</span></div>';
  }
  function paintGifts(root) {
    var u = S.ui;
    if (!S.gifts || !S.grcpt) { root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the gifts…'); Promise.all([load('gifts'), load('grcpt')]).then(function () { if (u.tab === 'gifts') paint(); }); return; }
    if (GF.view === 'receipts') {
      if (!GF.cfg || !S.rcpts) { root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + busy('Loading the receipt settings…'); Promise.all([GF.cfg ? null : loadRcfg(), S.rcpts ? null : load('rcpts')]).then(function () { if (u.tab === 'gifts') paint(); }); return; }
      root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() + receiptsHtml(); rbSigLoad(); return;
    }
    var all = S.gifts, list = all.filter(giftMatches);
    var total = 0, donors = {}, receipted = 0, years = {}, plats = {};
    all.forEach(function (g) { total += Number(g.amount) || 0; donors[g.contact_id] = 1; if (g.receipt_number) receipted++; var fy = fyOf(g.donated_at); if (fy) years[fy] = 1; plats[lower(g.platform) || ''] = 1; });
    var fyNow = fyOf(today()), thisFy = all.filter(function (g) { return fyOf(g.donated_at) === fyNow; }), thisTot = thisFy.reduce(function (a, g) { return a + (Number(g.amount) || 0); }, 0);
    var sel = list.reduce(function (a, g) { return a + (Number(g.amount) || 0); }, 0);
    var shown = list.slice(0, u.gshow), filtered = u.gq || u.gplat || u.gyear;
    var focus = document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-w152gq');
    var caret = focus && document.activeElement.selectionStart;
    root.innerHTML = statsHtml(S.contacts || []) + tabsHtml() +
      '<div class="w152stats">' +
      '<div class="w152st"><b>' + E(money(total)) + '</b><span>given, all time (' + plural(all.length, 'gift', 'gifts') + ')</span></div>' +
      '<div class="w152st"><b>' + E(money(thisTot)) + '</b><span>this fiscal year (to 30 Sep ' + E(fyNow) + ', ' + plural(thisFy.length, 'gift', 'gifts') + ')</span></div>' +
      '<div class="w152st"><b>' + Object.keys(donors).length.toLocaleString('en-CA') + '</b><span>donors</span></div>' +
      '<div class="w152st"><b>' + receipted.toLocaleString('en-CA') + '</b><span>with a tax receipt</span></div></div>' +
      '<div class="w152bar"><label class="w152q">' + I('search') + '<input type="search" data-w152gq="1" value="' + E(u.gq) + '" placeholder="Search a donor, campaign, receipt number or platform" aria-label="Search the gifts"></label>' +
      '<select class="w152sel" data-w152gplat aria-label="Platform"><option value="">Every platform</option>' + Object.keys(plats).sort().map(function (p) { return '<option value="' + E(p) + '"' + (u.gplat === p ? ' selected' : '') + '>' + E(platName(p)) + '</option>'; }).join('') + '</select>' +
      '<select class="w152sel" data-w152gyear aria-label="Fiscal year"><option value="">Every year</option>' + Object.keys(years).sort().reverse().map(function (y) { return '<option value="' + E(y) + '"' + (u.gyear === y ? ' selected' : '') + '>FY ' + E(y) + ' (Oct ' + (Number(y) - 1) + ' to Sep ' + E(y) + ')</option>'; }).join('') + '</select>' +
      '<button class="w152btn" data-w158new="1">' + I('plus') + ' Record a gift</button><button class="w152btn ghost" data-w152go="#crm/gifts/receipts">' + I('note') + ' Receipts</button></div>' + (GF.msg ? '<div class="w154msg">' + E(GF.msg) + '</div>' : '') +
      '<div class="w152count">' + (filtered ? plural(list.length, 'gift matches', 'gifts match') + ' (' + E(money(sel)) + ') · <button class="w152mini" data-w152gclear="1">' + I('x') + 'Clear the filters</button>' : plural(all.length, 'gift', 'gifts') + ', newest first') +
      (shown.length < list.length ? ' · showing the first ' + shown.length : '') + '</div>' +
      (shown.length ? '<div class="w152list w153gifts" role="list"><div class="w152lh" aria-hidden="true"><span>When</span><span>Donor</span><span>Amount</span><span>Campaign and platform</span><span>Receipt</span></div>' + shown.map(giftRow).join('') + '</div>' +
        (shown.length < list.length ? '<button class="w152btn soft w152more" data-w152gmore="1">Show ' + Math.min(60, list.length - shown.length) + ' more</button>' : '')
        : '<div class="w152empty">' + (all.length ? 'No gift matches. Try another word, or <button class="w152mini" data-w152gclear="1">clear the filters</button>.' : 'No gifts in the CRM yet. Zeffy joins next; until then the Keela export is the record.') + '</div>');
    if (focus) { var inp = root.querySelector('[data-w152gq]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }
  var gqT = null;
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.hasAttribute('data-w152gq')) return;
    var v = t.value; clearTimeout(gqT);
    gqT = setTimeout(function () { S.ui.gq = v; S.ui.gshow = 60; paint(); }, 160);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w152root')) return;
    if (t.hasAttribute('data-w152gplat')) S.ui.gplat = t.value;
    else if (t.hasAttribute('data-w152gyear')) S.ui.gyear = t.value;
    else return;
    S.ui.gshow = 60; paint();
  });
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest) return;
    if ((el = t.closest('[data-w152gclear]'))) { e.preventDefault(); S.ui.gq = ''; S.ui.gplat = ''; S.ui.gyear = ''; S.ui.gshow = 60; paint(); return; }
    if ((el = t.closest('[data-w152gmore]'))) { e.preventDefault(); S.ui.gshow += 60; paint(); return; }
  });
