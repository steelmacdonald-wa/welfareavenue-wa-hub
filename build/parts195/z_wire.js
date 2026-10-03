
  /* ---------- the masthead: the page's own title over wave191's ---------- */
  function masthead() {
    if (!onView()) return;
    var sec = document.getElementById('volunteering'); if (!sec) return;
    var m = sec.querySelector('.w118mast'); if (!m) return;
    var h1 = m.querySelector('h1'), p = m.querySelector(':scope > p');
    if (h1 && h1.textContent !== 'Sign-offs') h1.textContent = 'Sign-offs';
    if (p && p.textContent !== SUB) p.textContent = SUB;
  }
  function watch() {
    var sec = document.getElementById('volunteering'); if (!sec || sec.getAttribute('data-w195mo')) return !!sec;
    sec.setAttribute('data-w195mo', '1');
    var t = null;
    try { new MutationObserver(function () { if (!onView()) return; clearTimeout(t); t = setTimeout(masthead, 40); }).observe(sec, { childList: true, subtree: true, characterData: true }); } catch (e) { /* fine */ }
    return true;
  }

  /* ---------- the page's clicks ---------- */
  document.addEventListener('click', function (e) {
    var root = document.getElementById('w195'); if (!root || !e.target || !root.contains(e.target)) return;
    var el = e.target.closest ? e.target.closest('button') : null; if (!el) return;
    if (el.hasAttribute('data-w195open')) open(Number(el.getAttribute('data-w195open')));
    else if (el.hasAttribute('data-w195status')) { S.status = el.getAttribute('data-w195status'); S.list = null; paint(); load(); }
    else if (el.hasAttribute('data-w195mine')) openMine();
    else if (el.hasAttribute('data-w195sample')) sample();
    else if (el.hasAttribute('data-w195assign')) { var sel = document.getElementById('w195pick'); assign(sel ? sel.value : '', true); }
    else if (el.hasAttribute('data-w195unassign')) assign(el.getAttribute('data-w195unassign'), false);
  });

  /* ---------- the Volunteer Manager: the view, the chip on phones, the rail item with the waiting count ---------- */
  function wrapVol() {
    var ok = true;
    if (typeof waVolRender === 'function') {
      if (!waVolRender.__w195) {
        var __vr195 = waVolRender;
        waVolRender = async function () {
          if (onView()) {
            /* board viewers and anyone signed out of the team see the calendar instead */
            if (!staff()) { WA_VOL_VIEW = 'calendar'; try { history.replaceState(null, '', '#volunteering'); } catch (e) { /* fine */ } return await __vr195.apply(this, arguments); }
            css(); watch(); paint(); load();
            setTimeout(masthead, 150); setTimeout(masthead, 700); setTimeout(masthead, 1600);
            return;
          }
          var s = document.getElementById('w195sheet'); if (s) closeSheet();
          return await __vr195.apply(this, arguments);
        };
        waVolRender.__w195 = true;
      }
    } else ok = false;
    if (typeof waVolShell === 'function') {
      if (!waVolShell.__w195) {
        var __sh195 = waVolShell;
        waVolShell = function (inner) {
          var html = __sh195(inner);
          try {
            if (staff() && html.indexOf('data-vl="signoffs"') < 0) html = html.replace('Volunteers</span>', 'Volunteers</span><span class="fchip' + (onView() ? ' on' : '') + '" data-vl="signoffs">Sign-offs</span>');
          } catch (e) { /* fine */ }
          return html;
        };
        waVolShell.__w195 = true;
      }
    } else ok = false;
    return ok;
  }
  function railItem() {
    var A = window.WA_APP && window.WA_APP.apps;
    if (!A || !A.volunteer || typeof A.volunteer.groups !== 'function') return false;
    if (A.volunteer.__w195) return true;
    var g0 = A.volunteer.groups;
    A.volunteer.groups = function () {
      var gs = g0.apply(this, arguments);
      if (!staff()) return gs;
      try {
        var it = { h: '#volunteering/signoffs', l: 'Sign-offs', ic: 'form', page: 'volunteering', n: S.waiting ? String(S.waiting) : null };
        var people = gs.filter(function (g) { return /people/i.test(g.label || ''); })[0];
        if (people) { if (!people.items.some(function (x) { return x.h === it.h; })) people.items.push(it); }
        else gs.push({ label: 'People', items: [it] });
      } catch (e) { /* fine */ }
      return gs;
    };
    A.volunteer.__w195 = true;
    return true;
  }
  /* the walkthrough: the page tour "signoffs" (the Academy row Page tour: Sign-offs) */
  function tour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT) return false;
      if (TT.signoffs) return true;
      TT.signoffs = { tab: 'volunteering', icon: 'pen', hash: '#volunteering/signoffs', steps: [
        { c: 1, t: 'Sign-offs', p: 'Volunteers ask for an hours letter, a letter of recognition or their own school or employer form signed, from their profile on welfareavenue.com. This page is where the team signs them.' },
        { s: '#w195filters', t: 'Waiting first', p: 'Waiting shows what still needs a signature, oldest first. Signed and Declined keep the history, with each letter’s reference.' },
        { s: '#w195list', t: 'Open a request', p: 'Each request says who it is for and what for. Open it to see their record, choose the servings and hours to list, add your own words, or place your signature on their form. Preview it, then sign and send.', opt: 1 },
        { s: '#w195mine', t: 'Your signature', p: 'Signers save their signature once, with the name and title printed under it. A sample letter shows how it prints.' },
        { c: 1, t: 'What the volunteer gets', p: 'The signed PDF on their profile and an email that it is ready. Its reference lets a school or an employer check it with us at info@welfareavenue.com. Declining sends your note to their profile instead.' }
      ] };
      return true;
    } catch (e) { return false; }
  }
  function arm() {
    var a = wrapVol(), b = railItem(), c = tour();
    return a && b && c;
  }
  if (!arm()) { setTimeout(arm, 800); setTimeout(arm, 2500); setTimeout(arm, 6000); }
  /* the waiting count for the rail, when the Volunteer Manager opens (and once at start for staff) */
  document.addEventListener('wa153app', function (e) { if (e && e.detail && e.detail.app === 'volunteer') { railItem(); counts(); } });
  setTimeout(function () { if (staff() && document.body.classList.contains('w153volunteer')) counts(); }, 4000);
  /* an address that names the page opens it, even before the Volunteer Manager has drawn */
  window.addEventListener('hashchange', function () { if (!onView()) { var s = document.getElementById('w195sheet'); if (s && !S.mine) closeSheet(); } });

  window.w195 = {
    S: S, load: load, open: open, openMine: openMine, close: closeSheet, counts: counts, paint: paint, placement: placement, bodyFor: bodyFor,
    trimmed: trimmed, arm: arm, state: function () { return { status: S.status, list: S.list, counts: S.counts, me: S.me, waiting: S.waiting, det: S.det, items: S.items, step: S.step, preview: S.preview }; }
  };
})();
