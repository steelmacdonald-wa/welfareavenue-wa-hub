
  /* ---------- the router: tag every section with its page, show the current page's ---------- */
  function tag(el, keys, blk) { if (!el) return; el.setAttribute('data-w197s', keys); if (blk) el.classList.add('w197blk'); }
  function hide(el) { if (el) el.classList.add('w197x'); }
  function secByH3(re) { return Array.prototype.filter.call(document.querySelectorAll('#w46body > .w46sec'), function (s) { var h = s.querySelector(':scope > h3'); return h && re.test(h.textContent.trim()); })[0] || null; }
  function tagAll() {
    var panel = document.getElementById('hrcentre'); if (!panel) return;
    hide(document.getElementById('w116phero'));
    hide(panel.querySelector(':scope > .card > h2'));
    Array.prototype.forEach.call(panel.querySelectorAll(':scope > .card > p.w85p, :scope > .card > p.read'), hide);
    hide(document.getElementById('w93eng'));     /* Hub engagement: the Admin centre's Adoption */
    hide(document.getElementById('w103scope'));  /* Slack scope of work: The Loop's notes on Hours */
    hide(document.getElementById('w52hours'));   /* the Slack hours and the old Hub hours table: Hours, from The Loop */
    hide(document.getElementById('w169cardO'));  /* the same list as Training's Trainings assigned to the organization */
    tag(document.getElementById('w197ov'), 'overview', true);
    tag(document.getElementById('w197hours'), 'hours', true);
    tag(document.getElementById('w197apps'), 'applications', true);
    var pp = document.getElementById('w116ppeople');
    if (pp) {
      tag(pp, 'team recognition', true);
      tag(document.getElementById('w116pshouts'), 'recognition');
      Array.prototype.forEach.call(pp.children, function (c) { if (c.id !== 'w116pshouts') tag(c, 'team'); });
    }
    tag(document.getElementById('w144hr'), 'hours', true);
    tag(document.getElementById('w145quiz'), 'onboarding', true);
    tag(document.getElementById('w105to'), 'timeoff', true);
    tag(document.getElementById('w106polsec'), 'policies', true);
    tag(document.getElementById('w106discsec'), 'discipline', true);
    tag(document.getElementById('w105pol'), 'policies', true); tag(document.getElementById('w105disc'), 'discipline', true);   /* wave105 draws them as cards of their own before wave106 moves them */
    tag(document.getElementById('w181'), 'analytics', true);
    tag(document.getElementById('w116pcands'), 'applications-list', true);   /* the old list: the board replaces it */
    var onb = secByH3(/^Onboarding$/), master = secByH3(/^Master onboarding/), across = secByH3(/^Trainings across the team/), rec = secByH3(/^Recruitment$/);
    tag(onb, 'onboarding', true); tag(master, 'plan', true); tag(across, 'training', true);
    tag(document.getElementById('w169cardT'), 'training', true);
    if (onb) { var h = onb.querySelector(':scope > h3'); if (h) h.textContent = 'Who is onboarding'; }
    if (master) { var h2 = master.querySelector(':scope > h3'); if (h2) hide(h2); }
    if (rec) {
      tag(rec, 'positions playbook', true);
      var mode = 'positions';
      Array.prototype.forEach.call(rec.children, function (c, i) {
        if (i === 0 && c.tagName === 'H3') { hide(c); return; }
        if (c.classList.contains('w49pb')) mode = 'playbook';
        tag(c, mode);
        if (c.tagName === 'H3') c.classList.add('w197sub');
      });
    }
    /* anything else inside the page this wave does not know: shown on no page (a newer wave adds its own tag) */
    var body = document.getElementById('w46body');
    if (body) Array.prototype.forEach.call(body.children, function (c) { if (!c.hasAttribute('data-w197s') && !c.classList.contains('w47tabs') && !c.classList.contains('w197x')) tag(c, 'none'); });
    if (body && body.parentNode && body.parentNode.parentNode === panel) body.parentNode.classList.add('w197main');
    Array.prototype.forEach.call(panel.children, function (c) { if (c.classList.contains('w197main') || c.classList.contains('w118mast') || c.hasAttribute('data-w197s') || c.classList.contains('w197x')) return; tag(c, 'none'); });
  }
  function apply() {
    var panel = document.getElementById('hrcentre'); if (!panel) return;
    var k = S.page;
    if (k === 'analytics' && !seesAnalytics()) k = 'overview';
    panel.setAttribute('data-w197', k);
    Array.prototype.forEach.call(panel.querySelectorAll('[data-w197s]'), function (el) {
      var on = (' ' + el.getAttribute('data-w197s') + ' ').indexOf(' ' + k + ' ') >= 0;
      if (on !== el.classList.contains('w197on')) el.classList.toggle('w197on', on);
    });
    mastHr();
  }
  /* the HR centre's masthead: the page's name, its line, its main button */
  var MAIN = {
    /* only where the page's own button sits low or inside a form; pages whose card already leads with its button keep that one */
    team: ['Add someone', 'addperson'], timeoff: ['Log time off', 'logto'], recognition: ['Post a shout-out', 'shout'],
    policies: ['Add a policy', 'addpol'], discipline: ['Record an entry', 'recdisc']
  };
  function mastHr() {
    var panel = document.getElementById('hrcentre'); if (!panel) return;
    var m = panel.querySelector(':scope > .w118mast'); if (!m) return;
    var p = pageDef(S.page) || PAGES[0];
    var same = function (el, en) { return window.w198 && w198.same ? w198.same(el.textContent, en) : el.textContent === en; };   /* wave198: its French counts as the same words */
    var h1 = m.querySelector('h1'); if (h1 && !same(h1, p.l)) h1.textContent = p.l;
    var d = m.querySelector(':scope > p'); if (d && !same(d, p.d)) d.textContent = p.d;
    var acts = m.querySelector('.w197acts'); if (!acts) { acts = document.createElement('div'); acts.className = 'w197acts'; m.appendChild(acts); }
    var help = m.querySelector('.w43help'); if (help && help.parentNode !== acts) acts.appendChild(help);
    var want = MAIN[S.page] && (S.page !== 'team' || canHr()) ? MAIN[S.page] : null;
    var cur = acts.querySelector('[data-w197main]');
    if (!want && cur) cur.remove();
    if (want && (!cur || cur.getAttribute('data-w197main') !== want[1])) { if (cur) cur.remove(); acts.insertAdjacentHTML('afterbegin', '<button type="button" class="w197pact" data-w197main="' + want[1] + '">' + E(want[0]) + '</button>'); }
  }
  /* the main buttons press the older pages' own controls (one flow each, no copy) */
  function mainAction(k) {
    function click(sel) { var b = document.querySelector(sel); if (b) { try { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* fine */ } b.click(); return true; } return false; }
    function focus(sel) { var b = document.querySelector(sel); if (b) { try { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* fine */ } try { b.focus(); } catch (e) { /* fine */ } return true; } return false; }
    if (k === 'reload') { loadCands(true).then(function () { paintBoard(); paintRail(); toastS('Applications up to date'); }); return; }
    if (k === 'addperson') { location.hash = '#adminpanel/people'; return; }
    if (k === 'logto') { focus('#w105to select, #w105to input'); return; }
    if (k === 'shout') { focus('#w116pshouts textarea, #w116pshouts input'); return; }
    if (k === 'assignonb') { focus('#w46body .w46sec[data-w197s~="onboarding"] select'); return; }
    if (k === 'preview') { click('#w46body .w169bar button'); return; }
    if (k === 'assigntr') { click('#w169cardT button, #w46body [data-w197s~="training"] button'); return; }
    if (k === 'addpol') { focus('#w106polsec input'); return; }
    if (k === 'recdisc') { focus('#w106discsec select'); return; }
  }

  /* ---------- the rail: replace the HR entry's items ---------- */
  function railCount(k) {
    if (k === 'applications') { var n = S.cands.filter(function (c) { return c.status === 'new'; }).length; return n ? String(n) : null; }
    if (k === 'team') { var t = members().length; return t ? String(t) : null; }
    if (k === 'timeoff' && S.data) { return S.data.timeoff.length ? String(S.data.timeoff.length) : null; }
    return null;
  }
  function hrGroups() {
    var pn = document.getElementById('hrcentre');
    var notice = !!pn && pn.classList.contains('active') && !document.getElementById('w46body') && /for the HR team|for admins and leaders/i.test(pn.textContent || '');
    if (notice || (window.wa46IsHr && !window.wa46IsHr())) return [{ label: 'HR centre', items: [{ h: '#hrcentre', l: 'HR centre', ic: 'clip', page: 'hrcentre' }] }];
    var groups = [], by = {};
    PAGES.forEach(function (p) {
      if (p.only === 'analytics' && !seesAnalytics()) return;
      var g = p.g || ''; if (!by[g]) { by[g] = { label: g || 'HR centre', solo: !g, items: [] }; groups.push(by[g]); }
      by[g].items.push({ h: '#hrcentre/' + p.k, l: p.l, ic: p.ic, page: 'hrcentre', n: railCount(p.k) });
    });
    return groups;
  }
  function installRail() {
    try { if (window.WA_APP && WA_APP.apps && WA_APP.apps.hr && !WA_APP.apps.hr.__w197) { WA_APP.apps.hr.groups = hrGroups; WA_APP.apps.hr.__w197 = true; } } catch (e) { /* fine */ }
  }
  function paintRail() { try { if (window.w153 && w153.paint) w153.paint(); } catch (e) { /* fine */ } }

  /* ---------- every app: the page's name as the title, the app bar's buttons in the header ---------- */
  function appTitles() {
    if (!document.body.classList.contains('w153app')) return;
    var on = document.querySelector('#w153rail .w153it.on span'); var label = on ? on.textContent.trim() : '';
    var panel = document.querySelector('.panel.active') || Array.prototype.filter.call(document.querySelectorAll('.w118mast'), function (x) { return x.offsetParent; }).map(function (x) { return x.parentNode; })[0];
    if (!panel) return;
    var m = panel.querySelector(':scope > .w118mast');
    var app0 = window.WA_APP && WA_APP.current && WA_APP.current(), appLabel = app0 && WA_APP.apps && WA_APP.apps[app0] ? WA_APP.apps[app0].label : '';
    if (m && label && panel.id !== 'hrcentre') {
      var h1 = m.querySelector('h1');
      /* only where the title repeats the app's name (CRM, Finance, Fundraising...): a page that names itself keeps its title */
      if (h1 && (lower(h1.textContent) === lower(appLabel) || h1.textContent === h1.getAttribute('data-w197set')) && h1.textContent.trim() !== label) { h1.textContent = label; h1.setAttribute('data-w197set', label); }
      if (h1 && !h1.__w197mo) { h1.__w197mo = 1; new MutationObserver(function () { clearTimeout(h1.__w197t); h1.__w197t = setTimeout(appTitles, 30); }).observe(h1, { childList: true, characterData: true, subtree: true }); }
      /* the CRM's line describes its contacts: on its other tabs the tab says what it is */
      var d = m.querySelector(':scope > p');
      if (d && app0 === 'crm' && panel.id === 'crm') d.style.display = /^(Contacts)$/.test(label) ? '' : 'none';
    }
    if (m) {
      var acts = m.querySelector('.w197acts');
      var src = Array.prototype.slice.call(document.querySelectorAll('#w153bar .w153btn[data-w153act]'));
      if (!acts && src.length) { acts = document.createElement('div'); acts.className = 'w197acts'; m.appendChild(acts); var help = m.querySelector('.w43help'); if (help) acts.appendChild(help); }
      if (acts) {
        var want = src.map(function (b) { return b.getAttribute('data-w153act'); }).join('|');
        if (acts.getAttribute('data-w197a') !== want) {
          Array.prototype.forEach.call(acts.querySelectorAll('[data-w197proxy]'), function (x) { x.remove(); });
          src.forEach(function (b) { acts.insertAdjacentHTML('afterbegin', '<button type="button" class="w197pact" data-w197proxy="' + E(b.getAttribute('data-w153act')) + '">' + b.innerHTML + '</button>'); });
          acts.setAttribute('data-w197a', want);
        }
      }
    }
  }
