
  /* ---------- the page: Waiting, Signed, Declined, All; my signature; the signers ---------- */
  function setWaiting(n) {
    S.waiting = n;
    try {
      var a = document.querySelector('#w153rail a[data-w153go="#volunteering/signoffs"]'); if (!a) return;
      var b = a.querySelector('.w153n');
      if (n) { if (!b) { b = document.createElement('small'); b.className = 'w153n'; a.appendChild(b); } b.textContent = String(n); }
      else if (b) b.parentNode.removeChild(b);
    } catch (e) { /* fine */ }
  }
  async function counts() {
    if (!staff()) return;
    var r = await rpc('signoff_counts');
    if (!r.error && r.data && r.data.requested != null) setWaiting(Number(r.data.requested) || 0);
  }
  async function load() {
    if (S.loading) return;
    S.loading = true;
    var r = await rpc('signoff_list', { p_status: S.status });
    if (r.error) { S.err = msgOf(r.error); S.list = []; }
    else { S.err = ''; S.list = (r.data && r.data.rows) || []; S.counts = (r.data && r.data.counts) || {}; S.canSign = !!(r.data && r.data.can_sign); setWaiting(Number(S.counts.requested || 0)); }
    if (!S.me) { var m = await rpc('signoff_signer_me'); if (!m.error && m.data) { S.me = m.data; S.meErr = false; } else S.meErr = true; }
    S.loading = false;
    paint();
    if (S.me && S.me.can_sign && S.me.has_signature && !S.sigUrl) sigImage();
    if (!S.signers && !S.signersBusy) loadSigners();
  }
  async function loadSigners() {
    S.signersBusy = true;
    var r = await rpc('signoff_signers');
    S.signersBusy = false;
    if (!r.error && r.data) { S.signers = r.data; paintSide(); }
  }
  async function sigImage() {
    var r = await call({ action: 'signature_url' });
    if (r.ok && r.data.url) { S.sigUrl = r.data.url; S.sigAt = Date.now(); paintSide(); }
  }
  function kindL(k) { return (KINDS[k] || {}).l || k; }
  function rowHtml(x) {
    var bits = [];
    if (x.for_org) bits.push('For ' + x.for_org);
    if (x.status === 'requested') bits.push('asked ' + ago(x.requested));
    else if (x.status === 'signed') bits.push('signed ' + ago(x.signed) + (x.signer ? ' by ' + x.signer : ''));
    else if (x.status === 'declined') bits.push('declined ' + ago(x.declined));
    if (x.kind !== 'recognition' && x.status === 'requested') bits.push(plural(Number(x.now_servings || 0), 'serving', 'servings') + (x.period_from || x.period_to ? ' in their dates' : ''));
    if (x.reference) bits.push(x.reference);
    return '<button type="button" class="w195row" data-w195open="' + Number(x.id) + '"><span class="k">' + E(kindL(x.kind)) + (x.lang === 'fr' ? ' · en français' : '') + '</span>' +
      '<b>' + E(x.name || 'A volunteer') + '</b><span class="m">' + E(bits.join(' · ')) + '</span><span class="w195st ' + E(x.status) + '">' + E(STATUS[x.status] || x.status) + '</span></button>';
  }
  function listHtml() {
    var inner;
    if (S.list === null) inner = '<div class="w195empty">Loading the requests…</div>';
    else if (S.err) inner = '<div class="w195warn">' + E(S.err) + '</div>';
    else if (!S.list.length) {
      inner = '<div class="w195empty">' + E(S.status === 'requested' ? 'Nothing waiting. Volunteers ask for a letter or a signed form from their profile on welfareavenue.com, and their requests show here.'
        : S.status === 'signed' ? 'Nothing signed yet.' : S.status === 'declined' ? 'Nothing declined.' : 'No requests yet.') + '</div>';
    }
    else return '<div class="w195list" id="w195list">' + S.list.map(rowHtml).join('') + '</div>';
    return '<div id="w195list">' + inner + '</div>';
  }
  function filtersHtml() {
    var c = S.counts || {}, all = Object.keys(c).reduce(function (a, k) { return k === 'cancelled' ? a : a + Number(c[k] || 0); }, 0);
    return '<div class="w195f" id="w195filters" role="group" aria-label="Show">' + ['requested', 'signed', 'declined', 'all'].map(function (k) {
      var n = k === 'all' ? all : Number(c[k] || 0);
      return '<button type="button" data-w195status="' + k + '"' + (S.status === k ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + E(STATUS[k]) + (n ? '<small>' + n + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function mineHtml() {
    var me = S.me;
    if (!me) return '<div class="w195card" id="w195mine"><h3>My signature</h3><p class="w195muted">' + (S.meErr ? 'Your signer details did not load. Reload the page to try again.' : 'Loading…') + '</p></div>';
    if (!me.can_sign) {
      return '<div class="w195card" id="w195mine"><h3>Who signs</h3><p>Admins, the Operations leads and the people an admin assigns sign these letters. You can see every request here.</p></div>';
    }
    var ready = me.has_signature && me.name && me.title;
    return '<div class="w195card" id="w195mine"><h3>My signature</h3>' +
      (me.has_signature ? (S.sigUrl ? '<img class="w195sig" src="' + E(S.sigUrl) + '" alt="Your saved signature">' : '<p class="w195muted">Your signature is saved.</p>') : '<p>No signature saved yet. Add it once and every letter you sign carries it.</p>') +
      (me.name ? '<p><span class="w195who">' + E(me.name) + '</span>' + (me.title ? '<br>' + E(me.title) + (me.title_fr ? '<br><span class="w195muted">' + E(me.title_fr) + ' (French letters)</span>' : '') : '') + '</p>' : '') +
      (!ready ? '<div class="w195warn">Before you sign: ' + E([!me.has_signature ? 'your signature' : '', !me.name ? 'your name' : '', !me.title ? 'your title' : ''].filter(Boolean).join(', ')) + '.</div>' : '') +
      '<div class="w195add"><button type="button" class="w195btn' + (me.has_signature ? ' ghost' : '') + '" data-w195mine="1">' + (me.has_signature ? 'Change' : 'Add my signature') + '</button>' +
      (me.has_signature ? '<button type="button" class="w195btn ghost" data-w195sample="1"' + (S.sampleBusy ? ' disabled' : '') + '>' + (S.sampleBusy ? 'Drawing…' : 'See a sample letter') + '</button>' : '') + '</div></div>';
  }
  function signersHtml() {
    var d = S.signers; if (!d) return '';
    var WHY = { admin: 'Admin', lead: 'Operations lead', assigned: 'Assigned' };
    var h = '<div class="w195card" id="w195signers"><h3>Signers</h3><ul class="w195signers">' + (d.signers || []).map(function (s) {
      return '<li><span>' + E(s.name || s.email) + (s.has_signature ? ' <span title="Signature saved">✓</span>' : '') + '</span><span class="why">' + E(WHY[s.why] || s.why) + '</span>' +
        (d.admin && s.why === 'assigned' ? '<button type="button" class="w195link" data-w195unassign="' + E(s.email) + '">Remove</button>' : '') + '</li>';
    }).join('') + '</ul>';
    if (d.admin && (d.people || []).length) {
      h += '<div class="w195add"><select id="w195pick" aria-label="A team member to add as a signer"><option value="">Add a signer…</option>' + d.people.map(function (p) {
        return '<option value="' + E(p.email) + '">' + E(p.name + (p.department ? ' (' + p.department + ')' : '')) + '</option>';
      }).join('') + '</select><button type="button" class="w195btn ghost" data-w195assign="1">Add</button></div>';
    }
    return h + '</div>';
  }
  function pageHtml() {
    return '<div id="w195"><p class="w195lead">Letters and forms volunteers ask us to sign from their profile on welfareavenue.com: an hours sign-off letter, a letter of recognition, or their own school or employer form. Check what they ask for, then sign with your saved signature. They get the PDF on their profile and an email that it is ready.</p>' +
      '<div class="w195top"><div>' + filtersHtml() + listHtml() + '</div><div id="w195side">' + mineHtml() + signersHtml() + '</div></div></div>';
  }
  function paint() {
    if (!onView()) return;
    css();
    try { if (typeof waVolPaint === 'function') waVolPaint(pageHtml()); } catch (e) { /* fine */ }
    masthead();
  }
  function paintSide() { var s = document.getElementById('w195side'); if (s && onView()) s.innerHTML = mineHtml() + signersHtml(); }
  async function sample() {
    if (S.sampleBusy) return;
    S.sampleBusy = true; paintSide();
    var r = await call({ action: 'sample', kind: 'hours', lang: 'en' });
    S.sampleBusy = false; paintSide();
    if (r.ok && r.data.url) { try { window.open(r.data.url, '_blank', 'noopener'); } catch (e) { /* fine */ } }
    else T(words(r.error));
  }
  async function assign(email, on) {
    if (!email) { T('Choose someone first'); return; }
    var r = await rpc('signoff_signer_assign', { p_email: email, p_on: !!on });
    if (r.error) { T(msgOf(r.error)); return; }
    T(on ? 'Added as a signer' : 'Removed from the signers');
    S.signers = null; loadSigners();
  }
