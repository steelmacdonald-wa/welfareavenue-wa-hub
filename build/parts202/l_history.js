  /* ---------- wave204 (04/10/26): Undo and Redo, and a way back to the step before. Soraya Tyree's review: "some sort of
     backspace button or button to go back to the previous step in case I added something but want to go back. I tried command
     Z on my keyboard but nothing happened". Every change to the open email is a step (a block added, moved, copied or removed,
     a field typed in, a photo or a moving preview, the settings, the Hub's own changes): Undo and Redo sit in the editor's bar,
     with Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (Ctrl+Y on Windows). Typing in one field is one step until a pause or another field.
     The history belongs to the open email and starts again when another one opens. The keys are the studio's only when the
     email has the focus (or nothing does): in the Ask the Hub box, the answers and the send panel the browser's own undo works.
     When the Hub put the email together from your words or a template, "What you wrote" (or "Your details") takes you back to
     that step with everything you gave it; the email stays in Recent emails. ---------- */
  var HIST_MAX = 80;
  function histNow() { try { return performance.now(); } catch (e) { return Date.now(); } }   /* a pause is measured on the page's own clock */
  function histSnap(e) {
    e = e || SS.d; if (!e) return null;
    var d = e.design; if (d && d.ai) { d = Object.assign({}, d); delete d.ai; }   /* what was spent is spent: never a step */
    return JSON.stringify({ design: d, subject: e.subject, preheader: e.preheader, name: e.name, kind: e.kind, audience: e.audience, lang: e.lang });
  }
  function histReset() { var H = SS.hist; H.past = []; H.future = []; H.cur = histSnap(); H.field = null; H.at = 0; }
  /* from changed(): the state before this change goes on the Undo list, unless it continues a burst of typing in one field */
  function histRecord(field) {
    var H = SS.hist; if (!SS.d) return;
    var now = histSnap(); if (H.cur == null) { H.cur = now; return; }
    if (now === H.cur) return;
    var t = histNow(), burst = !!field && H.field === field && t - H.at < 1500;
    if (!burst) { H.past.push(H.cur); if (H.past.length > HIST_MAX) H.past.shift(); }
    H.future = []; H.cur = now; H.field = field || null; H.at = t;
    histButtons();
  }
  function histApply(s) {
    var e = SS.d, o = JSON.parse(s), ai = e.design && e.design.ai;
    e.design = o.design; if (ai) e.design.ai = ai; e.subject = o.subject; e.preheader = o.preheader; e.name = o.name; e.kind = o.kind; e.audience = o.audience; e.lang = o.lang;
  }
  /* dir -1: undo, 1: redo */
  function histGo(dir) {
    var H = SS.hist, e = SS.d; if (!e || SS.ro) return false;
    var now = histSnap(); if (H.cur != null && now !== H.cur) { H.past.push(H.cur); H.future = []; H.cur = now; }
    var from = dir < 0 ? H.past : H.future, to = dir < 0 ? H.future : H.past;
    if (!from.length) { T(dir < 0 ? 'Nothing to undo' : 'Nothing to redo'); return false; }
    to.push(H.cur); H.cur = from.pop(); H.field = null; H.at = 0;
    histApply(H.cur);
    var ids = {}; e.design.blocks.forEach(function (b) { ids[b.id] = 1; }); Object.keys(SS.open).forEach(function (k) { if (!ids[k]) delete SS.open[k]; });
    SS.msg = ''; SS.undo = null; SS.err = ''; SS.confirmDel = false;
    SS.dirty = true; SS.saveNote = ''; paint();
    later('save', 2500, function () { if (SS.dirty) saveNow(); });
    return true;
  }
  function histMac() { try { return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || ''); } catch (e) { return false; } }
  function histBar() {
    if (SS.ro || !SS.d) return '';
    var H = SS.hist, mac = histMac();
    return '<span class="w204hist" role="group" aria-label="Undo and redo">' +
      '<button class="w152btn sm ghost w204hb" id="w204undo" data-w204hist="-1" title="Undo the last change (' + (mac ? '⌘Z' : 'Ctrl+Z') + ')"' + (H.past.length ? '' : ' disabled') + '>' + I('undo') + '<span>Undo</span></button>' +
      '<button class="w152btn sm ghost w204hb" id="w204redo" data-w204hist="1" title="Redo (' + (mac ? '⇧⌘Z' : 'Ctrl+Y') + ')"' + (H.future.length ? '' : ' disabled') + '>' + I('redo') + '<span>Redo</span></button></span>';
  }
  function histButtons() {
    var u = document.getElementById('w204undo'), r = document.getElementById('w204redo');
    if (u) u.disabled = !SS.hist.past.length; if (r) r.disabled = !SS.hist.future.length;
  }
  /* may Cmd/Ctrl+Z be the studio's here? Yes on the email's own fields, the page itself or the preview; no in other boxes */
  function histKeyOk(a) {
    if (!a || a === document.body || a === document.documentElement) return true;
    if (a.id === 'w202frame') return true;
    if (!within(a)) return false;
    if (a.hasAttribute('data-w202f') || a.hasAttribute('data-w202e') || a.hasAttribute('data-w202voicesel')) return true;
    return !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.isContentEditable;
  }
  /* ---------- back to the step before the Hub's draft ---------- */
  function backBtn() {
    var B = SS.back; if (!B || !SS.d || B.d !== SS.d) return '';
    return '<button class="w152btn sm ghost" data-w204back title="Back to the step before, with everything you gave the Hub">' + I('back') + ' ' + (B.view === 'tpl' ? 'Your details' : 'What you wrote') + '</button>';
  }
  function backToStart() {
    var B = SS.back; if (!B) return;
    var s = SS.start, e = SS.d;
    if (B.view === 'tpl') { s.tpl = B.tpl; s.asks = Object.assign({}, B.asks || {}); s.extra = B.extra || ''; }
    else { s.brief = B.brief || ''; s.audience = B.audience || s.audience; s.kind = B.kind || s.kind; }
    s.photos = (B.photos || []).slice(); s.lang = B.lang || s.lang; s.voice = B.voice || s.voice;
    SS.back = null;
    if (e && SS.dirty && !SS.ro) saveNow();
    SS.startNote = { view: B.view, text: e && e.key ? 'Here is what you gave the Hub, to change and try again. The email it made is kept in Recent emails.' : 'Here is what you gave the Hub, to change and try again.' };
    go(B.view === 'tpl' ? '#crm/studio/tpl/' + B.tpl : '#crm/studio/ai');
  }
