  /* ======================= wiring ======================= */
  function go(h) { if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  function inOurs(t) { return t.closest && (t.closest('.w152root') || t.closest('#w152sheet')); }
  function sheetId() { var m = /^(?:c|edit|perm|org):(\d+|tmp\d+)$/.exec(S.sheet || ''); return m ? m[1] : null; }
  function openContact(id) {
    S.confirm = null;
    if (/^#crm(\/|$)/.test(location.hash)) { try { history.replaceState(null, '', '#crm/c/' + id); } catch (e) { /* fine */ } contactSheet(id); }
    else go('#crm/c/' + id);
  }
  function setFilter(o) { var u = S.ui; u.kind = o.kind || ''; u.role = o.role || ''; u.act = o.act || ''; u.perm = o.perm || ''; if (o.q !== undefined) u.q = o.q; u.show = 60; }
  function addTag(input) {
    var id = input.getAttribute('data-w152tagin'), c = contact(id); if (!c) return;
    var t = String(input.value || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
    if (!t) return;
    if (c.tags.map(lower).indexOf(t) >= 0) { input.value = ''; return; }
    saveTags(c.id, c.tags.concat([t]));
  }
  function copy(text) {
    var done = function () { toastS('Copied'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(); }); return; } } catch (e) { /* fall through */ }
    fallback();
    function fallback() { try { var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) { toastS(text); } }
  }
  var qT = null;
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || !inOurs(t)) return;
    var el, v;
    if ((el = t.closest('[data-w152close]'))) { e.preventDefault(); closeSheet(); return; }
    if ((el = t.closest('[data-w152open]'))) { e.preventDefault(); openContact(el.getAttribute('data-w152open')); return; }
    if ((el = t.closest('[data-w152go]'))) {
      e.preventDefault(); v = el.getAttribute('data-w152go');
      if (S.sheet) closeSheet(true);
      go(v); return;
    }
    if ((el = t.closest('[data-w152set]'))) {
      v = el.getAttribute('data-w152set');
      setFilter(v === 'volunteer' ? { kind: 'volunteer' } : v === 'served' ? { act: 'served' } : v === 'donor' ? { kind: 'donor' } : { q: '' });
      paint(); return;
    }
    if ((el = t.closest('[data-w152kind]'))) { S.ui.kind = el.getAttribute('data-w152kind'); S.ui.show = 60; paint(); return; }
    if ((el = t.closest('[data-w152clear]'))) { e.preventDefault(); setFilter({ q: '' }); paint(); return; }
    if ((el = t.closest('[data-w152more]'))) { S.ui.show += 60; paint(); return; }
    if ((el = t.closest('[data-w152add]'))) { e.preventDefault(); S.confirm = null; editForm(null); return; }
    if ((el = t.closest('[data-w152edit]'))) { e.preventDefault(); editForm(el.getAttribute('data-w152edit')); return; }
    if ((el = t.closest('[data-w152back]'))) { e.preventDefault(); v = el.getAttribute('data-w152back'); S.confirm = null; if (v && contact(v)) contactSheet(v); else closeSheet(); return; }
    if ((el = t.closest('[data-w152save]'))) { e.preventDefault(); el.disabled = true; saveContact(el.getAttribute('data-w152save')).then(function () { el.disabled = false; }, function () { el.disabled = false; }); return; }
    if ((el = t.closest('[data-w152perm-edit]'))) { e.preventDefault(); permForm(el.getAttribute('data-w152perm-edit')); return; }
    if ((el = t.closest('[data-w152savep]'))) { e.preventDefault(); el.disabled = true; savePerm(el.getAttribute('data-w152savep')).then(function () { el.disabled = false; }, function () { el.disabled = false; }); return; }
    if ((el = t.closest('[data-w152linkorg]'))) { e.preventDefault(); orgForm(el.getAttribute('data-w152linkorg')); return; }
    if ((el = t.closest('[data-w152saveorg]'))) { e.preventDefault(); el.disabled = true; saveOrg(el.getAttribute('data-w152saveorg')).then(function () { el.disabled = false; }, function () { el.disabled = false; }); return; }
    if ((el = t.closest('[data-w152unlink]'))) { e.preventDefault(); unlinkOrg(el.getAttribute('data-w152unlink')); return; }
    if ((el = t.closest('[data-w152untag]'))) {
      e.preventDefault(); var cid = sheetId(), c = contact(cid); if (!c) return;
      v = el.getAttribute('data-w152untag');
      saveTags(c.id, c.tags.filter(function (x) { return x !== v; })); return;
    }
    if ((el = t.closest('[data-w152log]'))) { e.preventDefault(); el.disabled = true; saveLog(el.getAttribute('data-w152log')).then(function () { el.disabled = false; }, function () { el.disabled = false; }); return; }
    if ((el = t.closest('[data-w152delint]'))) { e.preventDefault(); deleteLog(sheetId(), el.getAttribute('data-w152delint')); return; }
    if ((el = t.closest('[data-w152copy]'))) { e.preventDefault(); copy(el.getAttribute('data-w152copy')); return; }
    if ((el = t.closest('[data-w152keep]'))) { e.preventDefault(); S.confirm = 'merge:' + el.getAttribute('data-w152keep') + ':' + el.getAttribute('data-drop'); paint(); return; }
    if ((el = t.closest('[data-w152cancel]'))) { e.preventDefault(); S.confirm = null; paint(); return; }
    if ((el = t.closest('[data-w152merge]'))) { e.preventDefault(); merge(el.getAttribute('data-w152merge'), el.getAttribute('data-drop')); return; }
    if ((el = t.closest('[data-w152notdup]'))) { e.preventDefault(); notDup(el.getAttribute('data-w152notdup')); return; }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.hasAttribute('data-w152tagin') && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addTag(t); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.hasAttribute('data-w152q')) return;
    var v = t.value;
    clearTimeout(qT);
    qT = setTimeout(function () { S.ui.q = v; S.ui.show = 60; paint(); }, 160);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w152root')) return;
    if (t.hasAttribute('data-w152role')) S.ui.role = t.value;
    else if (t.hasAttribute('data-w152act')) S.ui.act = t.value;
    else if (t.hasAttribute('data-w152perm')) S.ui.perm = t.value;
    else if (t.hasAttribute('data-w152sort')) S.ui.sort = t.value;
    else return;
    S.ui.show = 60; paint();
  });
  window.addEventListener('hashchange', function () {
    if (!S.sheet) return;
    if (!/^#crm(\/|$)/.test(location.hash)) closeSheet(true);
  });

  /* ---------- the menu: People > CRM ---------- */
  function pageOk() { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf('crm') >= 0; } catch (e) { return true; } }
  var PAGE = { id: 'crm', label: 'CRM', group: 'people', dot: TEAL, gate: 'member', onShow: function (h) { if (pageOk()) openCrm(h); } };
  function register() {
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    if (!WA_NAV.pages.some(function (p) { return p.id === 'crm'; })) WA_NAV.register(PAGE);
  }
  if (typeof startApp === 'function') {
    var __sa152 = startApp;
    startApp = async function () {
      var out = await __sa152.apply(this, arguments);
      try {
        register();
        var root = decodeURIComponent(location.hash || '').replace(/^#/, '').split('/')[0];
        if (root === 'crm') { try { applyHash(); } catch (e) { /* fine */ } }
      } catch (e) { console.warn('wave152 boot', e); }
      return out;
    };
  }

  /* ---------- the page tour (wave122's engine; trainings row tour:crm) ---------- */
  function addTour() {
    try {
      var W = window.w122; if (!W || !W.tours || W.tours.crm) return;
      var OPT = { opt: 1 };
      var T = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      W.tours.crm = { tab: 'crm', icon: 'people', hash: '#crm', steps: [
        T('#crm > .w118mast', 'CRM', 'Everyone Welfare Avenue knows in one place: volunteers, donors, partners’ contacts and the team, with what each one has done with us.'),
        T('#crm .w152stats', 'At a glance', 'Everyone, the volunteers, who has served at an event, and the donors (or the duplicates to check). A number narrows the list to them.', OPT),
        T('#crm .w152tabs', 'Three views', 'The contacts, the possible duplicates to check, and where the contacts come from with what joins next.', OPT),
        T('#crm .w152chips', 'Who they are to us', 'Volunteers, donors, partners’ contacts, supporters, staff and alumni. One person can be several.', OPT),
        T('#crm .w152q', 'Find anyone', 'Type a name, an email, a phone number, a school or a tag. Next to it: a volunteer role, their activity, their email permission, and the order.', OPT),
        T('#crm [data-w152add]', 'Add someone', 'A donor, a partner’s contact, a supporter or a new volunteer. The CRM stops you if they are already in it.', OPT),
        T('#crm .w152list', 'Everyone, one line each', 'What they are to us, how to reach them, their volunteer roles, how often they served and when we last saw them. Click anyone to open their page.', OPT),
        { c: 1, t: 'A contact’s page', p: 'Their details (a volunteer’s are saved on their volunteer record too), what they did with us, their email permission, tags, organizations from Partners, and one timeline: notes, calls and emails logged here, servings, gifts and the old website’s history.' },
        { c: 1, t: 'Email permission', p: 'Canada’s anti-spam law (CASL): newsletters and appeals go only to people who said yes, or whose implied consent has not run out (two years after a gift or a serving). Record it on their page when they tell you.' },
        T('#crm .w152tabs [data-w152go="#crm/email"]', 'Email', 'The Email tab (wave154): sending from welfareavenue.com, the templates in the brand, who can be emailed today, and every message the Hub sent with what happened to it. A contact’s page has Send an email from the Hub.', OPT),
        { c: 1, t: 'Possible duplicates', p: 'The same email or phone on two contacts. Keep the right one and the other’s history moves to it, or mark them as different people (family members share phones).' }
      ] };
    } catch (e) { /* fine */ }
  }
  addTour();

  /* ---------- test hook ---------- */
  window.w152 = { state: function () { return S; }, load: load, paint: paint, open: openCrm, sheet: contactSheet, edit: editForm, perm: permForm, org: orgForm,
    save: saveContact, savePerm: savePerm, log: saveLog, merge: merge, notDup: notDup, pairs: dupePairs, matches: matches, close: closeSheet,
    timeline: function (id) { var c = contact(id), d = S.detail[String(id)]; return c && d ? timeline(c, d) : null; }, permKey: permKey, ago: ago, fmtDay: fmtDay,
    /* wave154 */ mail: MAIL, permWhy: permWhy, mailForm: mailForm, mailFn: mailFn, sendNow: sendNow };
})();
