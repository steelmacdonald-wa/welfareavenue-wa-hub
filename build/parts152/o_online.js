
  /* ======================= Online giving (wave161, 28/09/26) =======================
     The CRM side of the Hub's donation page, hub.welfareavenue.com/give (paid on Welfare Avenue's Stripe account), at
     #crm/gifts/online (the Online giving button in Gifts):
     - The page: live or off, a link to see it (a preview that takes no gift while it is off), and what it says and offers
       (the title and words, the amounts for once and monthly, the smallest and largest gift, where gifts can go, the card-fee
       option, the news box's words, the thank-you, receipt and monthly notes). Admins save them (donate_* settings, which
       the database refuses to anyone else). Put it live asks first and goes through crm_donate_mode_set (admins, logged,
       only once Stripe is set up); Take it down stops new gifts at once.
     - This fiscal year online: the gifts, their total, what Stripe kept in fees, the monthly gifts going, and (admins) how
       many checkouts were started.
     - Monthly gifts: each with its donor, amount, state (active, payment failed, ending, stopped), where it goes, since when,
       the last and next payment, and what it has given so far, with a link to it in Stripe.
     - For admins, what Stripe told the Hub lately (crm_stripe_events): each event, what the Hub did, and any error. */
  P.card = '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>';
  var DG = { confirm: false, busy: '', msg: '', err: '', draft: {} }; /* draft: what an admin typed and has not saved, kept across repaints */
  var GIVE_URL = 'https://hub.welfareavenue.com/give';
  var DSET = [ /* [setting, label, hint, kind] */
    ['donate_title', 'Title', '', 'text'],
    ['donate_intro', 'The words under the title', '', 'area'],
    ['donate_amounts_once', 'Amounts to give once', 'dollars, separated by commas', 'text'],
    ['donate_amounts_monthly', 'Amounts to give monthly', 'dollars, separated by commas', 'text'],
    ['donate_min', 'The smallest gift ($)', '', 'num'],
    ['donate_max', 'The largest gift online ($)', 'above it, donors are asked to write to you', 'num'],
    ['donate_designations', 'Where gifts can go', 'one per line; the first is chosen unless the donor picks another; with one line donors are not asked', 'area'],
    ['donate_fee_cover', 'Offer to cover the card fee', '', 'onoff'],
    ['donate_consent_label', 'The news box', 'the words the donor ticks to get your emails: their express consent', 'area'],
    ['donate_thanks', 'The thank-you', 'shown after the payment', 'area'],
    ['donate_receipt_note', 'The receipt note', '{charity} becomes the charity number', 'area'],
    ['donate_monthly_note', 'The note for monthly donors', '{email} becomes your reply-to address', 'area']
  ];
  LOADERS.dcfg = function () { return db.from('app_config').select('key,value').in('key', DSET.map(function (d) { return d[0]; }).concat(['donate_mode', 'donate_product', 'donate_webhook', 'donate_fee_percent', 'donate_fee_fixed'])); };
  LOADERS.plans = function () { return db.from('crm_gift_plans').select('id,external_id,contact_id,amount,currency,status,designation,tribute_kind,tribute_name,started_at,next_payment_at,last_paid_at,last_failed_at,ends_at,cancelled_at,cancel_reason').order('started_at', { ascending: false }).limit(2000); };
  LOADERS.sevents = function () { return amAdmin() ? db.from('crm_stripe_events').select('id,type,status,received_at,attempts,result,error').order('received_at', { ascending: false }).limit(25) : Promise.resolve({ data: [] }); };
  LOADERS.dtries = function () { return amAdmin() ? db.from('crm_donate_attempts').select('id,created_at,status,frequency,amount_cents').gte('created_at', dgFyStart() + 'T04:00:00Z').order('created_at', { ascending: false }).limit(3000) : Promise.resolve({ data: [] }); };
  function dgFyStart() { var y = Number(fyOf(today())); return (y - 1) + '-10-01'; }
  function dget(k) { var r = (S.dcfg || []).filter(function (x) { return x.key === k; })[0]; return r ? String(r.value == null ? '' : r.value) : ''; }
  function dgChip(d) { return '<span class="w154chip" style="background:' + d[1] + '17;color:' + d[1] + '"><i style="background:' + d[1] + '"></i>' + E(d[0]) + '</span>'; }
  var PLAN_ST = { active: ['Active', GREEN], past_due: ['Payment failed', FLAG], paused: ['Paused', '#B9851B'], incomplete: ['Not started', MUTED], cancelled: ['Stopped', MUTED] };
  function planState(p) { return p.status === 'active' && p.ends_at ? ['Ending ' + fmtDay(p.ends_at), '#B9851B'] : PLAN_ST[p.status] || [p.status || '?', MUTED]; }
  function whyStopped(s) {
    var m = { cancellation_requested: 'they asked', payment_failed: 'payments failed', payment_disputed: 'a disputed payment', too_expensive: 'too expensive', unused: 'not using it',
      switched_service: 'gave elsewhere', low_quality: 'not happy', customer_service: 'service', too_complex: 'too complicated', missing_features: 'missing something', other: 'other' };
    return String(s || '').split(/:\s*/).filter(Boolean).map(function (x) { return m[x] || x.replace(/_/g, ' '); }).join(': ');
  }
  function stripeLink(g) {
    var x = String(g.external_id || '');
    return /^pi_/.test(x) ? 'https://dashboard.stripe.com/payments/' + x : /^in_/.test(x) ? 'https://dashboard.stripe.com/invoices/' + x : '';
  }
  function dgWhen(s) {
    if (!s) return '';
    try { return fmtDay(s) + ', ' + new Date(s).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }); } catch (e) { return fmtDay(s); }
  }
  var EVT = { 'checkout.session.completed': 'A checkout finished', 'checkout.session.async_payment_succeeded': 'A bank payment cleared', 'checkout.session.async_payment_failed': 'A bank payment failed',
    'invoice.paid': 'A monthly payment', 'invoice.payment_failed': 'A monthly payment failed', 'charge.refunded': 'A refund', 'customer.subscription.created': 'A monthly gift started',
    'customer.subscription.updated': 'A monthly gift changed', 'customer.subscription.deleted': 'A monthly gift stopped' };

  function onlineHtml() {
    var live = dget('donate_mode') === 'live', admin = amAdmin(), ready = !!dget('donate_product') && !!dget('donate_webhook');
    var sum = function (a, k) { return a.reduce(function (t, g) { return t + (Number(g[k]) || 0); }, 0); };
    var gifts = (S.gifts || []).filter(function (g) { return lower(g.platform) === 'stripe' && !(Number(g.refunded_amount) > 0 && !(Number(g.amount) > 0)); }); /* a gift refunded in full counts nowhere */
    var fy = fyOf(today()), cur = gifts.filter(function (g) { return fyOf(g.donated_at) === fy; });
    var plans = S.plans || [], going = plans.filter(function (p) { return p.status === 'active' || p.status === 'past_due'; });
    var tries = (S.dtries || []).filter(function (t) { return t.status === 'session'; });
    var st = function (b, s) { return '<div class="w152st"><b>' + b + '</b><span>' + s + '</span></div>'; };

    var page = '<div class="w154card w161card"><h3>' + I('heart') + ' The donation page ' + dgChip(live ? ['Live', GREEN] : ['Off', MUTED]) + '</h3>' +
      '<p class="w161p">' + (live
        ? 'Live at <a href="' + GIVE_URL + '" target="_blank" rel="noopener">hub.welfareavenue.com/give</a>. Donors give once or monthly on Stripe’s secure page, and each gift lands in Gifts on its own: the donor, where it goes, a tribute, the fee, the news box if they ticked it, and any refund.'
        : 'Off: the page tells visitors that online giving opens soon. <a href="' + GIVE_URL + '?preview=1" target="_blank" rel="noopener">See it as donors will</a> (a preview that takes no gift).') + '</p>' +
      '<ul class="w161ready"><li class="' + (ready ? 'ok' : 'no') + '">' + I(ready ? 'check' : 'alert') + '<span>' + (ready ? 'Welfare Avenue’s Stripe account is connected: the gift donors see and the Hub’s webhook are set up.' : 'Stripe is not set up yet (the build does it).') + '</span></li>' +
      '<li class="' + (live ? 'ok' : 'todo') + '">' + I(live ? 'check' : 'arrow') + '<span>' + (live ? 'The website’s Donate buttons should point here; then Keela’s donation form can close.' : 'Once it is live: point the website’s Donate buttons at hub.welfareavenue.com/give, then close Keela’s donation form.') + '</span></li></ul>' +
      (admin ? (DG.confirm
          ? '<div class="w155cf"><b>Put the donation page live?</b> From then on anyone with the link can give, paid into Welfare Avenue’s Stripe account, and each gift is recorded here. Monthly gifts carry on until the donor or the team stops them.' +
            '<div class="w154acts"><button class="w152btn" data-w161mode="live"' + (DG.busy ? ' disabled' : '') + '>' + I('check') + ' Put it live</button><button class="w152btn ghost" data-w161no="1">Not yet</button></div></div>'
          : '<div class="w154acts">' + (live ? '<button class="w152btn ghost" data-w161mode="off"' + (DG.busy ? ' disabled' : '') + '>' + I('x') + ' Take it down</button>'
              : '<button class="w152btn" data-w161ask="1"' + (ready ? '' : ' disabled title="Stripe is not set up yet"') + '>' + I('check') + ' Put it live…</button>') + '</div>')
        : '<p class="m">An admin puts the page live or takes it down.</p>') +
      (DG.msg ? '<div class="w154msg">' + E(DG.msg) + '</div>' : '') + (DG.err ? '<div class="w154msg err" role="alert">' + E(DG.err) + '</div>' : '') + '</div>';

    var stats = '<div class="w152stats w161stats">' +
      st(E(money(sum(cur, 'amount'))), 'given online this fiscal year (' + plural(cur.length, 'gift', 'gifts') + ')') +
      st(E(cents(sum(cur, 'fee'))), 'kept by Stripe in fees') +
      st(E(money(going.reduce(function (t, p) { return t + (Number(p.amount) || 0); }, 0))), 'a month from ' + plural(going.length, 'monthly gift', 'monthly gifts')) +
      (admin ? st(tries.length.toLocaleString('en-CA'), 'checkouts started this year') : '') + '</div>';

    var planRow = function (p) {
      var c = contact(p.contact_id), nm = c ? c.full_name : p.contact_id ? 'Contact ' + p.contact_id : 'Donor not known yet';
      var paid = (S.gifts || []).filter(function (g) { return String(g.plan_id) === String(p.id); });
      var note = p.status === 'cancelled' ? 'Stopped ' + fmtDay(p.cancelled_at) + (p.cancel_reason ? ' (' + whyStopped(p.cancel_reason) + ')' : '')
        : p.status === 'past_due' && p.last_failed_at ? 'Failed ' + fmtDay(p.last_failed_at) + '; Stripe tries again' : p.next_payment_at ? 'Next ' + fmtDay(p.next_payment_at) : '';
      return '<div class="w152row w161prow" role="listitem">' +
        '<span>' + (c ? '<a href="#crm/c/' + E(c.id) + '">' + E(nm) + '</a>' : E(nm)) + (c && c.emails[0] ? '<div class="m">' + E(c.emails[0]) + '</div>' : '') + '</span>' +
        '<span class="amt">' + E(cents(p.amount)) + '<small> a month</small>' + (p.tribute_kind ? '<div class="m">' + E((p.tribute_kind === 'memory' ? 'In memory of ' : 'In honour of ') + (p.tribute_name || '')) + '</div>' : '') + '</span>' +
        '<span>' + dgChip(planState(p)) + (note ? '<div class="m">' + E(note) + '</div>' : '') + '</span>' +
        '<span>' + E(p.designation || '–') + '<div class="m">Since ' + E(fmtDay(p.started_at)) + '</div></span>' +
        '<span>' + E(money(sum(paid, 'amount'))) + '<div class="m">' + plural(paid.length, 'payment', 'payments') + (p.last_paid_at ? ', the last ' + E(fmtDay(p.last_paid_at)) : '') + '</div></span>' +
        '<span><a class="w152mini" href="https://dashboard.stripe.com/subscriptions/' + E(p.external_id) + '" target="_blank" rel="noopener">' + I('ext') + ' Stripe</a></span></div>';
    };
    var monthly = '<div class="w154card w161plans"><h3>' + I('refresh') + ' Monthly gifts <span class="m">' + plural(going.length, 'going', 'going') + ' of ' + plans.length + '</span></h3>' +
      (plans.length ? '<div class="w152list" role="list"><div class="w152lh" aria-hidden="true"><span>Donor</span><span>Amount</span><span>State</span><span>Where it goes</span><span>Given so far</span><span></span></div>' + plans.map(planRow).join('') + '</div>'
        : '<p class="m">No monthly gift yet. Donors start one on the page (Give monthly); each month’s payment then comes in as a gift.</p>') +
      '<p class="m w161foot">A donor who wants to change or stop a monthly gift writes to you; stop or change it in Stripe (the link on the row), and the Hub follows.</p></div>';

    var evs = S.sevents || [];
    var events = admin ? '<div class="w154card w161events"><h3>' + I('bell') + ' What Stripe told the Hub lately</h3>' +
      (evs.length ? '<div class="w161evl">' + evs.map(function (x) {
          var s = { done: ['Recorded', GREEN], ignored: ['Not the page’s', MUTED], error: ['Error: Stripe sends it again', FLAG], received: ['Received', TEAL] }[x.status] || [x.status, MUTED];
          var why = x.error ? x.error : x.result && x.result.ignored ? x.result.ignored : x.result && x.result.waiting ? x.result.waiting : x.result && x.result.receipt_needs_attention ? 'Refunded after receipt ' + x.result.receipt_needs_attention + ': cancel or replace it' : '';
          return '<div class="w161ev"><span>' + E(dgWhen(x.received_at)) + '</span><span>' + E(EVT[x.type] || x.type) + (x.attempts > 1 ? ' <span class="m">(' + x.attempts + ' tries)</span>' : '') + '</span><span>' + dgChip(s) + (why ? '<div class="m">' + E(why) + '</div>' : '') + '</span></div>';
        }).join('') + '</div>' : '<p class="m">Nothing yet. Each payment, monthly payment, refund and change to a monthly gift shows here as Stripe sends it.</p>') + '</div>' : '';

    var setv = function (d) {
      var k = d[0], v = Object.prototype.hasOwnProperty.call(DG.draft, k) ? DG.draft[k] : dget(k), dis = admin ? '' : ' disabled';
      var input = d[3] === 'area' ? '<textarea class="w152in" rows="' + (k === 'donate_designations' ? 3 : 2) + '" data-w161set="' + k + '"' + dis + '>' + E(v) + '</textarea>'
        : d[3] === 'onoff' ? '<select class="w152sel" data-w161set="' + k + '"' + dis + '><option value="on"' + (v !== 'off' ? ' selected' : '') + '>Yes, donors can add it</option><option value="off"' + (v === 'off' ? ' selected' : '') + '>No</option></select>'
        : '<input class="w152in"' + (d[3] === 'num' ? ' type="number" min="1" step="1"' : '') + ' data-w161set="' + k + '" value="' + E(v) + '"' + dis + '>';
      return '<label class="w155lb' + (d[3] === 'area' ? ' full' : '') + '">' + E(d[1]) + (d[2] ? ' <span class="m">' + E(d[2]) + '</span>' : '') + input + '</label>';
    };
    var settings = '<div class="w154card w161set"><h3>' + I('edit') + ' What the page says and offers</h3>' + (admin ? '' : '<p class="m">Only an admin changes these.</p>') +
      '<div class="w161grid">' + DSET.map(setv).join('') + '</div>' +
      (admin ? '<div class="w154acts"><button class="w152btn" data-w161save="1"' + (DG.busy ? ' disabled' : '') + '>' + I('check') + ' Save</button><a class="w152btn ghost" href="' + GIVE_URL + '?preview=1" target="_blank" rel="noopener">' + I('ext') + ' See the page</a></div>' : '') + '</div>';

    return '<div class="w161">' + page + stats + monthly + settings + events +
      '<div class="w154acts"><button class="w152btn ghost" data-w152go="#crm/gifts">Back to the gifts</button></div></div>';
  }

  function dgSave() {
    var rows = [];
    document.querySelectorAll('#crm [data-w161set]').forEach(function (el) { rows.push({ key: el.getAttribute('data-w161set'), value: String(el.value || '').trim() }); });
    var get = function (k) { return (rows.filter(function (r) { return r.key === k; })[0] || {}).value || ''; };
    var set = function (k, v) { rows.forEach(function (r) { if (r.key === k) r.value = v; }); };
    var nums = function (s) { return String(s).split(/[,\s]+/).filter(Boolean); };
    var bad = '';
    ['donate_amounts_once', 'donate_amounts_monthly'].forEach(function (k) {
      var n = nums(get(k));
      if (!n.length || n.length > 6 || n.some(function (x) { return !(Number(x) > 0) || Math.abs(Number(x) * 100 - Math.round(Number(x) * 100)) > 0.001; })) bad = bad || 'The amounts: up to six numbers in dollars, separated by commas.';
      else set(k, n.map(Number).join(', '));
    });
    if (!get('donate_title')) bad = 'The page needs a title.';
    else if (!(Number(get('donate_min')) >= 1)) bad = 'The smallest gift is at least $1.';
    else if (!(Number(get('donate_max')) > Number(get('donate_min')))) bad = 'The largest gift must be more than the smallest.';
    else if (!get('donate_designations').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean).length) bad = 'Where gifts can go: at least one line.';
    else if (!get('donate_consent_label')) bad = 'The news box needs its words: they are the donor’s consent.';
    if (bad) { DG.err = bad; DG.msg = ''; paint(); return; }
    DG.busy = 'save'; DG.err = ''; DG.msg = ''; paint();
    var at = new Date().toISOString();
    Promise.resolve(db.from('app_config').upsert(rows.map(function (r) { return { key: r.key, value: r.value, updated_at: at }; }), { onConflict: 'key' })).then(function (r) {
      DG.busy = '';
      if (r && r.error) { DG.err = 'Not saved: ' + String(r.error.message || r.error); paint(); return; }
      DG.msg = 'Saved. The page shows it to the next visitor.'; DG.draft = {};
      load('dcfg', true).then(function () { if (S.ui.tab === 'gifts') paint(); });
    }, function (e) { DG.busy = ''; DG.err = 'Not saved: ' + String((e && e.message) || e); paint(); });
  }
  function dgMode(mode) {
    DG.confirm = false; DG.busy = 'mode'; DG.msg = ''; DG.err = ''; paint();
    Promise.resolve(db.rpc('crm_donate_mode_set', { p_mode: mode })).then(function (r) {
      DG.busy = '';
      if (r && r.error) { DG.err = String(r.error.message || r.error); paint(); return; }
      DG.msg = mode === 'live' ? 'The donation page is live.' : 'The donation page is off: it now says online giving opens soon.';
      Promise.all([load('dcfg', true), load('kcfg', true)]).then(function () { if (S.ui.tab === 'gifts') paint(); });
    }, function (e) { DG.busy = ''; DG.err = String((e && e.message) || e); paint(); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('#crm')) return;
    if ((el = t.closest('[data-w161ask]'))) { e.preventDefault(); DG.confirm = true; DG.msg = ''; DG.err = ''; paint(); return; }
    if ((el = t.closest('[data-w161no]'))) { e.preventDefault(); DG.confirm = false; paint(); return; }
    if ((el = t.closest('[data-w161mode]'))) { e.preventDefault(); dgMode(el.getAttribute('data-w161mode')); return; }
    if ((el = t.closest('[data-w161save]'))) { e.preventDefault(); dgSave(); return; }
  });
  function dgKeep(e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute('data-w161set')) DG.draft[t.getAttribute('data-w161set')] = t.value; }
  document.addEventListener('input', dgKeep);
  document.addEventListener('change', dgKeep);
  var css161 = document.createElement('style'); css161.id = 'w161css';
  css161.textContent = ''
    + '.w161{display:grid;gap:14px;}.w161 .w154card h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}.w161 .w154card h3 .m{font-weight:500;font-size:13px;}'
    + '.w161p{margin:6px 0 10px;line-height:1.5;}.w161ready{list-style:none;margin:0 0 6px;padding:0;display:grid;gap:6px;}.w161ready li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.45;}'
    + '.w161ready li .w152i{width:16px;height:16px;flex:none;margin-top:2px;}.w161ready li.ok .w152i{color:' + GREEN + ';}.w161ready li.no .w152i{color:' + FLAG + ';}.w161ready li.todo .w152i{color:' + TEAL + ';}'
    + '.w161stats{margin:0;}'
    + '.w161plans .w152lh,.w161plans .w161prow{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) auto;}'
    + '.w161foot{margin:10px 0 0;}'
    + '.w161grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;}.w161grid .full{grid-column:1/-1;}.w161grid textarea{resize:vertical;min-height:44px;}'
    + '.w161evl{display:grid;gap:0;}.w161ev{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.5fr);gap:10px;padding:8px 0;border-top:1px solid rgba(16,63,57,.08);font-size:13px;}'
    + '.w154msg.err{background:rgba(179,64,47,.1);color:#7e2b1f;}'
    + '.w153gifts .rfd{display:inline-block;margin-left:6px;}'
    + '@media (max-width:760px){.w161grid{grid-template-columns:1fr;}.w161plans .w152lh{display:none;}.w161plans .w161prow{grid-template-columns:1fr 1fr;}.w161ev{grid-template-columns:1fr;gap:2px;}}';
  document.head.appendChild(css161);
