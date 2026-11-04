/* =====================================================================
   WA v279 The onboarding plan revamp: the manager's role-pick pop-up and the plan's role steps (04/11/26, Task 7)
   =====================================================================
   Steel (04/11/26): the manager chooses each hire's role trainings in a pop-up that recommends trainings for that person's role or
   department: 2 or 3 for 60 days and 5 or 6 for 90 days.
   - Home: a manager whose hire is at day 21 or later (the database's count: today minus day one) and still has a short list sees
     "Pick <first name>'s role trainings". The hires come from the lead's card (wave166, onboarding_lead_view); wa279_role_options is
     asked only for the hires at day 21 or later, and the card shows only where the database says this person may pick.
   - The pop-up (its own layer, so it opens over HR's checklist too): two lists, 60 days and 90 days. Recommended modules first, in
     the database's order, then the ones already picked; a search over every active Academy module (the trainings table, as the
     Academy reads it; planned ones left out). Modules the hire finished are greyed and cannot be picked; a module picked in the
     other list cannot be picked here. Save is on only inside 2 to 3 and 5 to 6, and sends one wa279_role_save per list. The
     database's refusal shows as it is.
   - HR centre: the person's checklist (wa37OpenModal) gets a Role trainings button that opens the same pop-up.
   - The plan: wave166's checklist hands the role60 / role90 steps to roleStep (one call-site line in parts166/c_plan.js): the
     picked modules with a tick each and who picked them, or "Your manager picks these in week 3."
   Data: build/wa279a_rules.sql (wa279_role_options, wa279_role_save). Test: test/w279drive.js with test/w279fx.js. */
(function () {
  if (window.__wa279) return; window.__wa279 = true;
  var GREEN = '#103F39', INK = '#1F201E', MUTE = '#797773', LINE = '#DEE0D8', CREAM = '#FFFAF2', FLAG = '#B3402F', GOLD = '#DCA527';
  var SECS = [{ key: '60 DAYS', head: '60 days: pick 2 or 3', word: '60 days' }, { key: '90 DAYS', head: '90 days: pick 5 or 6', word: '90 days' }];
  var FRESH = 60000;
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(msg) { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* fine */ } }
  function errText(e) { return String((e && e.message) || e || 'That did not work. Try again.'); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || 'them'; }
  function fmtDay(iso) { if (!iso) return ''; try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } }
  function secOf(d, key) { return (d && d.sections && d.sections[key]) || { min: key === '60 DAYS' ? 2 : 5, max: key === '60 DAYS' ? 3 : 6, picked: [] }; }
  function isShort(d) { return SECS.some(function (s) { var x = secOf(d, s.key); return (x.picked || []).length < x.min; }); }

  /* ---------- style ---------- */
  var st = document.createElement('style'); st.id = 'w279css';
  st.textContent =
    '#mypage.w272 #mpBody > #w279home{order:5;grid-column:1 / -1;}' +
    '#w279home h3{margin:0 0 6px;font:500 22px/1.05 \'Barlow Condensed\',\'Arial Narrow\',\'Helvetica Neue\',Arial,sans-serif;letter-spacing:.01em;text-transform:uppercase;color:' + GREEN + ';overflow-wrap:anywhere;}' +   /* as wave272's Home headings */
    '#w279home p{margin:0 0 10px;font-size:14px;color:#4a5551;}' +
    '#w279home .w279hc + .w279hc{border-top:1px solid ' + LINE + ';margin-top:12px;padding-top:12px;}' +
    '.w279btn{font:inherit;font-size:14px;font-weight:700;min-height:38px;padding:6px 16px;border-radius:999px;border:1px solid ' + GREEN + ';background:' + GREEN + ';color:' + CREAM + ';cursor:pointer;}' +
    '.w279btn.ghost{background:' + CREAM + ';color:' + GREEN + ';}' +
    '.w279btn:disabled{opacity:.45;cursor:not-allowed;}' +
    '.w279hr{margin:0 0 10px;}' +
    '#w279sheet{position:fixed;inset:0;z-index:2147480500;background:rgba(16,63,57,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;box-sizing:border-box;overflow-y:auto;}' +
    '#w279sheet .w279pan{background:' + CREAM + ';color:' + INK + ';border-radius:18px;width:100%;max-width:640px;box-sizing:border-box;padding:18px 18px 16px;min-width:0;box-shadow:0 18px 40px rgba(16,63,57,.25);}' +
    '#w279sheet .w279top{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;}' +
    '#w279sheet h3{margin:0;font-size:22px;line-height:1.15;color:' + GREEN + ';overflow-wrap:anywhere;min-width:0;}' +
    '#w279sheet .w279x{font:inherit;font-size:22px;line-height:1;background:none;border:0;color:' + GREEN + ';cursor:pointer;padding:2px 6px;min-height:36px;}' +
    '#w279sheet .w279lead{font-size:13.5px;color:#4a5551;margin:6px 0 4px;}' +
    '#w279sheet .w279sec{border-top:1px solid ' + LINE + ';margin-top:14px;padding-top:12px;min-width:0;}' +
    '#w279sheet h4{margin:0;font-size:16px;color:' + GREEN + ';}' +
    '#w279sheet .w279due{font-size:12.5px;color:' + MUTE + ';margin:2px 0 8px;}' +
    '#w279sheet .w279opt{display:flex;gap:10px;align-items:flex-start;padding:7px 4px;border-radius:8px;cursor:pointer;min-width:0;}' +
    '#w279sheet .w279opt input{margin:3px 0 0;flex:0 0 auto;width:18px;height:18px;accent-color:' + GREEN + ';}' +
    '#w279sheet .w279opt span{min-width:0;overflow-wrap:anywhere;font-size:14px;}' +
    '#w279sheet .w279opt small{display:block;color:' + MUTE + ';font-size:12px;}' +
    '#w279sheet .w279opt.off{opacity:.5;cursor:not-allowed;}' +
    '#w279sheet .w279grp{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + MUTE + ';margin:8px 0 2px;}' +
    '#w279sheet .w279q{display:block;font-size:12.5px;font-weight:700;color:' + GREEN + ';margin:8px 0 0;}' +
    '#w279sheet .w279q input{display:block;width:100%;box-sizing:border-box;margin-top:4px;font:inherit;font-size:14px;min-height:38px;padding:6px 10px;border:1px solid ' + LINE + ';border-radius:8px;background:' + CREAM + ';color:' + INK + ';}' +
    '#w279sheet .w279foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;}' +
    '#w279sheet .w279cnt{font-size:13px;color:' + INK + ';}' +
    '#w279sheet .w279cnt.bad{color:' + FLAG + ';}' +
    '#w279sheet .w279err{flex-basis:100%;font-size:13px;color:' + FLAG + ';background:#FBEDEA;border-radius:8px;padding:6px 10px;overflow-wrap:anywhere;}' +
    '#w279sheet .w279ok{font-size:13px;color:' + GREEN + ';font-weight:700;}' +
    '.w279step{margin:4px 0 2px;min-width:0;}' +
    '.w279step ul{list-style:none;margin:4px 0 0;padding:0;}' +
    '.w279step li{display:flex;gap:8px;align-items:flex-start;margin:4px 0;min-width:0;}' +
    '.w279step li > span:last-child{min-width:0;flex:1 1 auto;line-height:1.35;}' +
    '.w279step .w279tick{flex:0 0 auto;margin-top:2px;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;border:1.5px solid ' + LINE + ';color:' + LINE + ';font-size:11px;line-height:1;}' +
    '.w279step li.ok .w279tick{background:' + GREEN + ';border-color:' + GREEN + ';color:' + CREAM + ';}' +
    '.w279step .w279mod{font:inherit;font-size:13.5px;font-weight:600;color:' + GREEN + ';background:none;border:0;padding:0;cursor:pointer;text-align:left;overflow-wrap:anywhere;min-width:0;}' +
    '.w279step small{font-size:12px;color:' + MUTE + ';margin-left:6px;white-space:nowrap;}' +
    '.w279step .w279none{font-size:13px;color:' + MUTE + ';}';
  document.head.appendChild(st);

  /* ---------- data ---------- */
  var OPT = {};   /* onboarding id -> { at, data | err, p } */
  function options(onb, force) {
    var k = String(onb), c = OPT[k];
    if (c && c.p) return c.p;
    if (c && !force && Date.now() - c.at < FRESH) return c.err ? Promise.reject(new Error(c.err)) : Promise.resolve(c.data);
    var p = Promise.resolve(db.rpc('wa279_role_options', { p_onb: Number(onb) })).then(function (r) {
      if (r && r.error) throw r.error;
      OPT[k] = { at: Date.now(), data: (r && r.data) || null };
      return OPT[k].data;
    }).catch(function (e) { OPT[k] = { at: Date.now(), err: errText(e) }; throw e; });
    OPT[k] = { at: 0, p: p };
    return p;
  }
  var MODS = null, modsP = null;
  function modules() {
    if (MODS) return Promise.resolve(MODS);
    if (modsP) return modsP;
    modsP = Promise.resolve(db.from('trainings').select('id, title, path_group, kind, body, active').eq('active', true).order('sort').order('id')).then(function (r) {
      if (r && r.error) throw r.error;
      MODS = ((r && r.data) || []).filter(function (t) { return t && t.title && t.active !== false && !(t.body && t.body.planned); });
      modsP = null; return MODS;
    }).catch(function () { modsP = null; return []; });
    return modsP;
  }

  /* ---------- the plan's role steps ---------- */
  function pickedBy(p) { return (p.auto || /^the hub$/i.test(String(p.picked_by || '')) || !p.picked_by) ? 'Picked by the Hub' : 'Picked by ' + p.picked_by; }
  function stepInner(d, key) {
    var picks = secOf(d, key).picked || [];
    if (!picks.length) return '<div class="w279none">Your manager picks these in week 3.</div>';
    return '<ul>' + picks.map(function (p) {
      return '<li class="' + (p.done ? 'ok' : '') + '"><span class="w279tick" aria-label="' + (p.done ? 'Done' : 'Not done yet') + '">&#10003;</span>'
        + '<span><button type="button" class="w279mod" data-w166open="t:' + E(p.training_id) + '">' + E(p.title) + '</button> <small>' + E(pickedBy(p)) + '</small></span></li>';
    }).join('') + '</ul>';
  }
  function fillSteps(onb) {
    var c = OPT[String(onb)];
    document.querySelectorAll('.w279step[data-w279onb="' + String(onb).replace(/"/g, '') + '"]').forEach(function (el) {
      var h = c && c.data ? stepInner(c.data, el.getAttribute('data-w279sec')) : '';
      if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    });
  }
  function roleStep(t, onb) {
    var key = t.academy_path === 'role60' ? '60 DAYS' : '90 DAYS', id = onb && onb.id;
    if (!id) return '';
    var c = OPT[String(id)], fresh = c && !c.p && Date.now() - c.at < FRESH;
    if (!fresh) options(id).then(function () { fillSteps(id); }, function () { fillSteps(id); });
    var inner = c && c.data ? stepInner(c.data, key) : '';
    return '<div class="w279step" data-w279onb="' + E(id) + '" data-w279sec="' + E(key) + '">' + inner + '</div>';
  }

  /* ---------- the pop-up ---------- */
  var SH = null;   /* { onb, d, sel: {key: [ids]}, q: {key: ''}, busy: {}, err: {}, ok: {} } */
  function selFrom(d) { var o = {}; SECS.forEach(function (s) { o[s.key] = (secOf(d, s.key).picked || []).map(function (p) { return Number(p.training_id); }); }); return o; }
  function sheetEl() { return document.getElementById('w279sheet'); }
  function close() { var el = sheetEl(); if (el) el.remove(); SH = null; }
  function other(key) { return key === '60 DAYS' ? '90 DAYS' : '60 DAYS'; }
  function doneOf(id) {
    var d = SH.d, hit = null;
    (d.recommended || []).forEach(function (r) { if (Number(r.training_id) === id) hit = r; });
    SECS.forEach(function (s) { (secOf(d, s.key).picked || []).forEach(function (p) { if (Number(p.training_id) === id) hit = hit || p; }); });
    return !!(hit && hit.done);
  }
  function optHtml(key, m, can) {
    var id = Number(m.training_id != null ? m.training_id : m.id), on = SH.sel[key].indexOf(id) >= 0;
    var done = doneOf(id), there = SH.sel[other(key)].indexOf(id) >= 0;
    var off = !can || there || done;
    var note = done ? first(SH.d.member) + ' finished it already' : (there ? 'Picked for ' + (key === '60 DAYS' ? '90 days' : '60 days') : (m.path || m.path_group || ''));
    return '<label class="w279opt' + (off ? ' off' : '') + '"><input type="checkbox" data-w279pick="' + E(key) + '" value="' + E(id) + '"' + (on ? ' checked' : '') + (off ? ' disabled' : '') + ' />'
      + '<span>' + E(m.title) + (note ? '<small>' + E(note) + '</small>' : '') + '</span></label>';
  }
  function listHtml(key) {
    var d = SH.d, can = !!d.can_pick, seen = {}, h = '';
    var rec = (d.recommended || []).filter(function (r) { var k = Number(r.training_id); if (seen[k]) return false; seen[k] = 1; return true; });
    if (rec.length) h += '<div class="w279grp">Recommended</div>' + rec.map(function (r) { return optHtml(key, r, can); }).join('');
    /* what is picked, or ticked from the search, and not in the recommended list */
    var more = SH.sel[key].filter(function (id) { return !seen[id]; }).map(function (id) {
      seen[id] = 1;
      var p = null; (secOf(d, key).picked || []).forEach(function (x) { if (Number(x.training_id) === id) p = x; });
      var m = null; (MODS || []).forEach(function (x) { if (Number(x.id) === id) m = x; });
      return { training_id: id, title: (p && p.title) || (m && m.title) || 'Module ' + id, path: m && m.path_group };
    });
    if (more.length) h += '<div class="w279grp">Also picked</div>' + more.map(function (m) { return optHtml(key, m, can); }).join('');
    if (!rec.length && !more.length) h += '<div class="w279due">Nothing is recommended for this team yet. Search for a module below.</div>';
    return h;
  }
  function resHtml(key) {
    var q = String(SH.q[key] || '').trim().toLowerCase();
    if (!q) return '';
    if (!MODS) return '<div class="w279due">Loading the modules...</div>';
    var shown = {};
    (SH.d.recommended || []).forEach(function (r) { shown[Number(r.training_id)] = 1; });
    SH.sel[key].forEach(function (id) { shown[id] = 1; });
    var hits = MODS.filter(function (m) { return !shown[Number(m.id)] && String(m.title).toLowerCase().indexOf(q) >= 0; });
    if (!hits.length) return '<div class="w279due">No module matches that.</div>';
    return hits.slice(0, 8).map(function (m) { return optHtml(key, m, !!SH.d.can_pick); }).join('')
      + (hits.length > 8 ? '<div class="w279due">' + (hits.length - 8) + ' more. Type more of the name.</div>' : '');
  }
  function footHtml(key) {
    var x = secOf(SH.d, key), n = SH.sel[key].length, inRange = n >= x.min && n <= x.max;
    if (!SH.d.can_pick) return '<span class="w279cnt">' + n + ' picked</span>';
    var cnt = n + ' picked' + (n < x.min ? '. Pick ' + x.min + ' or ' + x.max + '.' : (n > x.max ? '. That is too many: pick ' + x.min + ' or ' + x.max + '.' : '.'));
    return '<span class="w279cnt' + (inRange ? '' : ' bad') + '">' + cnt + '</span>'
      + '<button type="button" class="w279btn" data-w279save="' + E(key) + '"' + (inRange && !SH.busy[key] ? '' : ' disabled') + '>' + (SH.busy[key] ? 'Saving...' : 'Save') + '</button>'
      + (SH.ok[key] ? '<span class="w279ok">Saved.</span>' : '')
      + (SH.err[key] ? '<div class="w279err" role="alert">' + E(SH.err[key]) + '</div>' : '');
  }
  function paintSec(key) {
    var el = sheetEl(); if (!el || !SH) return;
    var box = el.querySelector('.w279sec[data-w279sec="' + key + '"]'); if (!box) return;
    box.querySelector('[data-w279part="list"]').innerHTML = listHtml(key);
    var r = box.querySelector('[data-w279part="res"]'); if (r) r.innerHTML = resHtml(key);
    box.querySelector('[data-w279part="foot"]').innerHTML = footHtml(key);
  }
  function paintAll() { SECS.forEach(function (s) { paintSec(s.key); }); }
  function sheetHtml() {
    var d = SH.d, nm = first(d.member);
    return '<div class="w279pan" role="dialog" aria-modal="true" aria-labelledby="w279h">'
      + '<div class="w279top"><h3 id="w279h">Pick ' + E(nm) + '&#39;s role trainings</h3><button type="button" class="w279x" data-w279x="1" aria-label="Close">&times;</button></div>'
      + '<p class="w279lead">' + (d.can_pick
        ? 'Recommended modules for ' + E(nm) + '&#39;s team come first. Search for any other module. Modules ' + E(nm) + ' finished already are greyed out.'
        : 'Only their manager, HR or an admin can pick these.') + '</p>'
      + SECS.map(function (s) {
        var x = secOf(d, s.key);
        return '<div class="w279sec" data-w279sec="' + E(s.key) + '"><h4>' + E(s.head) + '</h4>'
          + (x.due ? '<div class="w279due">Due ' + E(fmtDay(x.due)) + '</div>' : '')
          + '<div data-w279part="list"></div>'
          + (d.can_pick ? '<label class="w279q">Search all modules<input type="search" data-w279q="' + E(s.key) + '" placeholder="Type a module name" autocomplete="off" /></label><div data-w279part="res"></div>' : '')
          + '<div class="w279foot" data-w279part="foot"></div></div>';
      }).join('')
      + '</div>';
  }
  async function openSheet(onb) {
    close();
    var d;
    try { d = await options(onb, true); } catch (e) { T(errText(e)); return; }
    if (!d) { T('That onboarding plan was not found'); return; }
    SH = { onb: Number(onb), d: d, sel: selFrom(d), q: { '60 DAYS': '', '90 DAYS': '' }, busy: {}, err: {}, ok: {} };
    var el = document.createElement('div'); el.id = 'w279sheet'; el.innerHTML = sheetHtml();
    document.body.appendChild(el);
    paintAll();
    try { el.querySelector('[data-w279x]').focus(); } catch (e) { /* fine */ }
    modules().then(function () { if (SH) paintAll(); });
  }
  async function save(key) {
    if (!SH || SH.busy[key]) return;
    var onb = SH.onb, ids = SH.sel[key].slice();
    SH.busy[key] = true; SH.err[key] = ''; SH.ok[key] = false; paintSec(key);
    try {
      var r = await db.rpc('wa279_role_save', { p_onb: onb, p_section: key, p_training_ids: ids });
      if (r && r.error) throw r.error;
      var d = (r && r.data) || null;
      if (d) { OPT[String(onb)] = { at: Date.now(), data: d }; }
      if (SH && SH.onb === onb) {
        if (d) { SH.d = d; SH.sel[key] = selFrom(d)[key]; }
        SH.busy[key] = false; SH.ok[key] = true; paintAll();
      }
      T('Saved the ' + (key === '60 DAYS' ? '60-day' : '90-day') + ' role trainings');
      fillSteps(onb); paintHome();
    } catch (e) {
      if (SH && SH.onb === onb) { SH.busy[key] = false; SH.err[key] = errText(e); paintSec(key); }
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var o = t.closest('[data-w279open]');
    if (o) { e.preventDefault(); openSheet(o.getAttribute('data-w279open')); return; }
    if (!SH) return;
    if (t.id === 'w279sheet' || t.closest('[data-w279x]')) { e.preventDefault(); close(); return; }
    var s = t.closest('[data-w279save]');
    if (s && !s.disabled) { e.preventDefault(); save(s.getAttribute('data-w279save')); }
  });
  document.addEventListener('change', function (e) {
    var c = e.target; if (!SH || !c || !c.getAttribute || !c.getAttribute('data-w279pick')) return;
    var key = c.getAttribute('data-w279pick'), id = Number(c.value), list = SH.sel[key];
    if (c.checked) { if (list.indexOf(id) < 0) list.push(id); } else SH.sel[key] = list.filter(function (x) { return x !== id; });
    SH.ok[key] = false; SH.err[key] = '';
    paintAll();
  });
  document.addEventListener('input', function (e) {
    var q = e.target; if (!SH || !q || !q.getAttribute || !q.getAttribute('data-w279q')) return;
    var key = q.getAttribute('data-w279q'); SH.q[key] = q.value;
    var box = sheetEl() && sheetEl().querySelector('.w279sec[data-w279sec="' + key + '"] [data-w279part="res"]');
    if (box) box.innerHTML = resHtml(key);
  });
  document.addEventListener('keydown', function (e) { if (SH && e.key === 'Escape') close(); });

  /* ---------- Home: the hires whose role trainings are still to pick ---------- */
  var HOME = [];   /* [{ onb, d }] */
  function homeHtml() {
    return HOME.map(function (h) {
      var nm = first(h.d.member), left = SECS.filter(function (s) { var x = secOf(h.d, s.key); return (x.picked || []).length < x.min; }).map(function (s) { return s.word; });
      return '<div class="w279hc" data-w279home="' + E(h.onb) + '"><h3>Pick ' + E(nm) + '&#39;s role trainings</h3>'
        + '<p>' + E(nm) + ' is on day ' + E(h.d.day) + '. Choose 2 or 3 trainings for 60 days and 5 or 6 for 90 days. Still to pick: ' + E(left.join(' and ')) + '.</p>'
        + '<button type="button" class="w279btn" data-w279open="' + E(h.onb) + '">Pick them</button></div>';
    }).join('');
  }
  function paintHome() {
    HOME = HOME.map(function (h) { var c = OPT[String(h.onb)]; return c && c.data ? { onb: h.onb, d: c.data } : h; }).filter(function (h) { return h.d.can_pick && isShort(h.d); });
    var body = document.getElementById('mpBody'), el = document.getElementById('w279home');
    if (!body || !HOME.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'w279home'; el.className = 'mp-sec'; body.insertBefore(el, body.firstChild); }
    var h = homeHtml(); if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
  }
  var homeQ = null;
  function homeRefresh() {
    if (homeQ) return homeQ;
    homeQ = (async function () {
      try {
        var W = window.w166; if (!W || typeof W.load !== 'function' || !document.getElementById('mpBody')) return;
        var lead = await W.load(false);
        /* the lead's card counts day one as day 1; the database counts today minus day one, so a lead day of 21 or more is the wider net */
        var ppl = ((lead && lead.people) || []).filter(function (p) { return p && p.onboarding_id && !p.starts_on && Number(p.day) >= 21; });
        var out = [];
        for (var i = 0; i < ppl.length; i++) {
          try { var d = await options(ppl[i].onboarding_id); if (d && Number(d.day) >= 21 && d.can_pick && isShort(d)) out.push({ onb: ppl[i].onboarding_id, d: d }); } catch (e) { /* not theirs to pick */ }
        }
        HOME = out; paintHome();
      } finally { homeQ = null; }
    })();
    return homeQ;
  }
  if (typeof renderMyPage === 'function') {
    var __rm279 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm279.apply(this, arguments);
      try { paintHome(); homeRefresh(); } catch (e) { /* non-fatal */ }
      return r;
    };
  }

  /* ---------- HR centre: the person's checklist gets Role trainings ---------- */
  if (typeof wa37OpenModal === 'function') {
    var __om279 = wa37OpenModal;
    wa37OpenModal = function (onbId) {
      var out = __om279.apply(this, arguments);
      try {
        var o = (typeof WA37 !== 'undefined' && WA37.onbs) ? WA37.onbs.filter(function (x) { return String(x.id) === String(onbId); })[0] : null;
        var m = document.getElementById('w37modal');
        if (o && o.status === 'active' && m && !document.querySelector('[data-w279hr]')) {
          m.insertAdjacentHTML('beforebegin', '<div class="w279hr" data-w279hr="1"><button type="button" class="w279btn ghost" data-w279open="' + E(o.id) + '">Role trainings</button></div>');
        }
      } catch (e) { /* fine */ }
      return out;
    };
  }

  /* ---------- test hook ---------- */
  window.w279 = { roleStep: roleStep, open: openSheet, close: close, home: homeRefresh, options: options, state: function () { return { SH: SH, OPT: OPT, HOME: HOME }; } };
})();
