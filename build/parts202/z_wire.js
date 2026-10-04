  /* ---------- drawing, the routes (#crm/studio, /ai, /tpl[/key], /e/<key>, .../to/<contact>), the clicks and keys ---------- */
  function keyOf(el) {
    var attrs = ['data-w202f', 'data-w202e', 'data-w202s', 'data-w202say', 'data-w202qa', 'data-w202ask', 'data-w202who', 'data-w202libq', 'data-w202t', 'data-w202scap'];
    for (var i = 0; i < attrs.length; i++) if (el.hasAttribute && el.hasAttribute(attrs[i])) return '[' + attrs[i] + '="' + String(el.getAttribute(attrs[i])).replace(/"/g, '\\"') + '"]';
    return null;
  }
  function fromRow(t) {
    return { key: t.key, name: t.name, kind: t.kind === 'test' ? 'newsletter' : t.kind, audience: t.audience || null, lang: t.lang || 'en', subject: t.subject || '', preheader: t.preheader || '',
      design: MAIL202.clean(t.design || { blocks: [] }), one_off: !!t.one_off, category: t.category || null, description: t.description || '', active: t.active !== false, created_by: t.created_by || '', updated_at: t.updated_at };
  }
  function openKey(key) {
    if (key === 'new') { if (!SS.d || SS.d.key) { SS.view = 'home'; setHash('#crm/studio'); } return; }
    if (SS.d && SS.d.key === key) return;
    var t = tplByKey(key);
    if (!t) { SS.d = null; SS.pendingKey = key; return; }
    SS.pendingKey = null;
    SS.d = fromRow(t); SS.ro = !canEdit(t); SS.questions = []; SS.notes = ''; SS.open = {}; SS.send = null; SS.undo = null; SS.dirty = false; SS.savedAt = null; SS.saveNote = ''; SS.change = '';
    if (SS.to && !SS.ro) setTimeout(function () { openSend('person'); }, 0);
  }
  function open(parts) {
    parts = parts || [];
    var sub = parts[2] || '', ti = parts.indexOf('to');
    if (SS.d && SS.dirty && !SS.ro) saveNow();
    try { var c0 = crm(); if (c0 && c0.close && c0.state().sheet) c0.close(true); } catch (e) { /* fine */ }
    SS.msg = SS.view === 'home' && sub === '' ? SS.msg : ''; SS.err = ''; SS.pick = null; SS.peek = null; SS.confirmDel = false;
    SS.to = ti >= 0 && parts[ti + 1] ? parts[ti + 1] : (sub === 'e' ? SS.to : null);
    if (sub === 'ai') SS.view = 'ai';
    else if (sub === 'tpl') { SS.view = 'tpl'; if (parts[3] && parts[3] !== 'to') SS.start.tpl = parts[3]; }
    else if (sub === 'e') { SS.view = 'edit'; openKey(parts[3] || 'new'); }
    else SS.view = 'home';
    css202();
  }
  function paint() {
    var root = SS.root;
    if (!root || !root.isConnected) {
      var c = crm(); try { if (c && c.state().ui.tab === 'studio') c.paint(); } catch (e) { /* fine */ }
      return;
    }
    css202();
    if (!cstate().templates) {
      root.innerHTML = busyHtml('Loading the templates…');
      var c2 = crm(); if (c2 && c2.load) Promise.resolve(c2.load('templates')).then(function () { paint(); });
      return;
    }
    if (SS.view === 'edit' && !SS.d && SS.pendingKey) {
      var t = tplByKey(SS.pendingKey);
      if (t) openKey(SS.pendingKey);
      else { SS.pendingKey = null; SS.view = 'home'; SS.err = 'That email is not there any more.'; setHash('#crm/studio'); }
    }
    if (SS.view === 'edit' && !SS.d) { SS.view = 'home'; setHash('#crm/studio'); }
    var act = document.activeElement, k = null, caret = null;
    if (act && root.contains(act)) { k = keyOf(act); try { caret = [act.selectionStart, act.selectionEnd]; } catch (e) { caret = null; } }
    root.innerHTML = SS.view === 'ai' ? aiStartHtml() : SS.view === 'tpl' ? tplStartHtml() : SS.view === 'edit' ? editorHtml() : homeHtml();
    if (k) { var el = root.querySelector(k); if (el) { try { el.focus({ preventScroll: true }); if (caret && caret[0] != null && el.setSelectionRange) el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* fine */ } } }
    Array.prototype.forEach.call(root.querySelectorAll('iframe.w202frame'), function (f) { f.addEventListener('load', function () { wireFrame(f); }); });
    try { if (window.w201 && window.w201.scan) window.w201.scan(); } catch (e) { /* fine */ }
  }
  function within(t) { return t && t.closest && t.closest('.w202root'); }
  function blockAt(s) { var p = String(s).split(','); return { i: Number(p[0]), k: p.length > 1 ? Number(p[1]) : null }; }
  function copyCurrent() {
    var e = SS.d; if (!e) return;
    var d = JSON.parse(JSON.stringify(e.design)); (d.blocks || []).forEach(function (b) { b.id = MAIL202.uid(); });
    openDraft(draftFrom({ name: e.name + ' (copy)', kind: e.kind, audience: e.audience, lang: e.lang, subject: e.subject, preheader: e.preheader, design: d }), {});
  }
  async function removeEmail() {
    var e = SS.d; if (!e || !e.key) return;
    var r = await rpc('email_studio_remove', { p_key: e.key });
    if (r.error) { SS.err = words(r.error); SS.confirmDel = false; paint(); return; }
    var d = r.data || {}; SS.d = null; SS.confirmDel = false; SS.dirty = false;
    SS.msg = d.deleted ? '“' + e.name + '” is deleted.' : '“' + e.name + '” is switched off: it was sent, or a campaign or an automation uses it, so its words stay in the history.';
    await reloadTemplates(); SS.view = 'home'; go('#crm/studio'); paint();
  }
  var ROW = { rows: { label: '', value: '' }, items: { lead: '', text: '' }, links: { label: '', url: '' } };
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!within(t)) return;
    var el, v;
    var hit = function (a) { el = t.closest('[' + a + ']'); if (el) { v = el.getAttribute(a); ev.preventDefault(); return true; } return false; };
    if (hit('data-w202go')) { go(v); return; }
    if (hit('data-w202blank')) { startBlank(); return; }
    if (hit('data-w202filter')) { SS.filter = v; paint(); return; }
    if (hit('data-w202use')) { var tu = tplByKey(v); SS.peek = null; if (tu) openDraft(copyOf(tu), { openFirst: false }); return; }
    if (hit('data-w202fill')) { SS.peek = null; SS.start.tpl = v; SS.start.asks = {}; SS.err = ''; go('#crm/studio/tpl/' + v); return; }
    if (hit('data-w202peekx')) { SS.peek = null; paint(); return; }
    if (hit('data-w202peek')) { SS.peek = v; loadMailSettings(); paint(); return; }
    if (hit('data-w202edit')) { SS.peek = null; go('#crm/studio/e/' + v); return; }
    if (hit('data-w202open')) { go('#crm/studio/e/' + v); return; }
    if (hit('data-w202allrecent')) { SS.allRecent = true; paint(); return; }
    if (hit('data-w202aud')) { SS.start.audience = v; if (v === 'volunteers' && SS.start.kind === 'fundraising') SS.start.kind = 'volunteer'; if (v === 'donors' && SS.start.kind === 'volunteer') SS.start.kind = 'newsletter'; paint(); return; }
    if (hit('data-w202pickstart')) { SS.pick = { to: 'start' }; loadLibrary().then(function () { paint(); }); paint(); return; }
    if (hit('data-w202sdel')) { SS.start.photos.splice(Number(v), 1); paint(); return; }
    if (hit('data-w202startai')) { startAi(); return; }
    if (hit('data-w202startself')) { startSelf(); return; }
    if (hit('data-w202tplpick')) { SS.start.tpl = v; SS.start.asks = {}; SS.err = ''; setHash('#crm/studio/tpl/' + v); paint(); return; }
    if (hit('data-w202starttpl')) { startTpl(v === 'ai'); return; }
    if (hit('data-w202libpick')) { var lp = (SS.lib || []).filter(function (x) { return String(x.id) === String(v); })[0]; if (lp) photoChosen(fromLib(lp)); SS.pick = null; paint(); return; }
    if (hit('data-w202pickx')) { SS.pick = null; paint(); return; }
    if (SS.view !== 'edit' || !SS.d) return;
    var bl = SS.d.design.blocks;
    if (hit('data-w202tog')) { var bt = bl[Number(v)]; if (bt) { SS.open[bt.id] = !SS.open[bt.id]; paint(); } return; }
    if (hit('data-w202goto')) { openBlock(Number(v)); return; }
    if (hit('data-w202dev')) { SS.device = v; paint(); return; }
    if (hit('data-w202tab')) { SS.tab = v; paint(); return; }
    if (hit('data-w202undo')) { if (SS.undo) { SS.d.design = SS.undo.design; SS.d.subject = SS.undo.subject; SS.d.preheader = SS.undo.preheader; SS.undo = null; SS.msg = 'Put back as it was.'; changed(true); } return; }
    if (hit('data-w202copy') || hit('data-w202dupe')) { copyCurrent(); return; }
    if (hit('data-w202sendopen')) { openSend(); return; }
    if (hit('data-w202sendx')) { SS.send = null; paint(); return; }
    if (hit('data-w202stab')) { if (SS.send) { SS.send.tab = v; SS.send.msg = ''; SS.send.err = ''; } paint(); return; }
    if (hit('data-w202whopick')) { if (SS.send) SS.send.contact = v; paint(); return; }
    if (hit('data-w202whox')) { if (SS.send) { SS.send.contact = null; SS.send.q = ''; } SS.to = null; paint(); return; }
    if (hit('data-w202dotest')) { doTest(); return; }
    if (hit('data-w202doperson')) { doPerson(); return; }
    if (hit('data-w202docamp')) { doCampaign(); return; }
    if (hit('data-w202dotpl')) { doTemplate(); return; }
    if (hit('data-w202answers')) { aiChange('answers'); return; }
    if (hit('data-w202qx')) { SS.questions = []; SS.notes = ''; paint(); return; }
    if (hit('data-w202change')) { aiChange('change'); return; }
    if (hit('data-w202rm')) { SS.confirmDel = true; paint(); return; }
    if (hit('data-w202delno')) { SS.confirmDel = false; paint(); return; }
    if (hit('data-w202delyes')) { removeEmail(); return; }
    if (SS.ro) return;
    if (hit('data-w202add')) { addBlock(v); return; }
    if (hit('data-w202mv')) { var m = v.split(','), i = Number(m[0]), j = i + Number(m[1]); if (j >= 0 && j < bl.length) { var x = bl.splice(i, 1)[0]; bl.splice(j, 0, x); changed(true); } return; }
    if (hit('data-w202dup')) { var src = bl[Number(v)]; if (src) { var cp = JSON.parse(JSON.stringify(src)); cp.id = MAIL202.uid(); bl.splice(Number(v) + 1, 0, cp); SS.open = {}; SS.open[cp.id] = true; changed(true); } return; }
    if (hit('data-w202del')) { bl.splice(Number(v), 1); changed(true); return; }
    if (hit('data-w202pickfor')) { var at = blockAt(v); SS.pick = { to: 'block', i: at.i, k: at.k }; loadLibrary().then(function () { paint(); }); paint(); return; }
    if (hit('data-w202rmphoto')) { var ar = blockAt(v), b = bl[ar.i]; if (b) { var tg = ar.k == null ? b : (b.items || [])[ar.k]; if (tg) { tg.src = ''; delete tg.lib; delete tg.usage; } changed(true); } return; }
    if (hit('data-w202rowadd')) { var ra = v.split(','), rb = bl[Number(ra[0])]; if (rb) { rb[ra[1]] = rb[ra[1]] || []; rb[ra[1]].push(Object.assign({}, rb.type === 'stats' ? { n: '', label: '' } : ROW[ra[1]])); changed(true); } return; }
    if (hit('data-w202rowdel')) { var rd = v.split(','), rbl = bl[Number(rd[0])]; if (rbl && rbl[rd[1]]) { rbl[rd[1]].splice(Number(rd[2]), 1); changed(true); } return; }
  });
  function onField(ev) {
    var t = ev.target; if (!within(t)) return;
    var val = t.type === 'checkbox' ? t.checked : t.value, a;
    if ((a = t.getAttribute('data-w202f')) && SS.d && !SS.ro) { var p = a.split('.'); setPath(Number(p[0]), p.slice(1).join('.'), val); changed(false); return; }
    if ((a = t.getAttribute('data-w202e')) && SS.d && !SS.ro) {
      SS.d[a] = a === 'audience' ? (val || null) : val;
      if (a === 'kind' && ev.type === 'change') { changed(false); var note = document.querySelector('.w202set p.m'); if (note) note.textContent = (KIND[val] || KIND.newsletter).s + ' Every email carries our charity number, postal address, why they got it and an unsubscribe link.'; return; }
      changed(false); return;
    }
    if ((a = t.getAttribute('data-w202s'))) { SS.start[a] = val; return; }
    if ((a = t.getAttribute('data-w202ask'))) { SS.start.asks[a] = val; return; }
    if ((a = t.getAttribute('data-w202scap'))) { var ph = SS.start.photos[Number(a)]; if (ph) ph.caption = val; return; }
    if ((a = t.getAttribute('data-w202qa'))) { (SS.questions || []).forEach(function (q) { if (q.id === a) q.answer = val; }); return; }
    if (t.getAttribute('data-w202say') === 'change') { SS.change = val; return; }
    if (t.hasAttribute('data-w202who')) { if (SS.send) { SS.send.q = val; var res = document.querySelector('[data-w202whores]'); if (res) res.innerHTML = whoResults(val); } return; }
    if (t.hasAttribute('data-w202libq')) { SS.libQ = val; later('libq', 200, paint); return; }
    if ((a = t.getAttribute('data-w202t'))) { if (SS.send) SS.send.t[a] = val; return; }
    if (t.hasAttribute('data-w202list') && ev.type === 'change') { if (SS.send) SS.send.list = val; paint(); return; }
    if (t.getAttribute('data-w202kind') === 'start' && ev.type === 'change') { SS.start.kind = val; paint(); return; }
    if (t.getAttribute('data-w202lang') === 'start' && ev.type === 'change') { SS.start.lang = val; return; }
    if (t.getAttribute('data-w202file') && ev.type === 'change') { uploadFiles(t.files, SS.pick && SS.pick.to === 'start' ? 'start' : 'block'); t.value = ''; return; }
  }
  document.addEventListener('input', onField);
  document.addEventListener('change', function (ev) { var t = ev.target; if (!within(t)) return; if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'file') onField(ev); });
  document.addEventListener('keydown', function (ev) {
    if (!SS.root || !SS.root.isConnected) return;
    if (ev.key === 'Escape') {
      if (SS.peek) { SS.peek = null; paint(); return; }
      if (SS.pick) { SS.pick = null; paint(); return; }
      if (SS.send && within(document.activeElement)) { SS.send = null; paint(); return; }
    }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 's' || ev.key === 'S') && SS.view === 'edit' && SS.d && !SS.ro) { ev.preventDefault(); saveNow(); }
  });

  /* ---------- the page tour (wave122's engine; trainings row tour:studio) ---------- */
  function addTour() {
    try {
      var W = window.w122; if (!W || !W.tours) return false; if (W.tours.studio) return true;
      var OPT = { opt: 1 };
      var Tt = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      W.tours.studio = { tab: 'crm', icon: 'mail', hash: '#crm/studio', steps: [
        Tt('#w153rail [data-w153go="#crm/studio"] || #crm .w152tabs [data-w152go="#crm/studio"]', 'The email studio', 'Emails in the Welfare Avenue brand, for one person, a list or an automation. The Hub puts them together with you and checks them before anything goes out.', OPT),
        Tt('#crm [data-w202sec="start"]', 'Three ways to start', 'Tell the Hub: write what you want to say and add your photos. Start from a template: give it your details. Build it yourself: blocks you arrange.'),
        Tt('#crm [data-w202sec="templates"]', 'Templates', 'Our starters and the team’s saved templates, on four shelves: volunteers (welcome and serving; call-outs and events) and donors (thanks and impact; appeals and events). “Ready as is” ones can go straight into an automation.'),
        Tt('#crm [data-w202sec="recent"]', 'Recent emails', 'The emails you and the team wrote here, ready to finish, send again or copy.', OPT),
        { c: 1, t: 'The Hub checks with you', p: 'It never makes up a date, a place, a number or a link: it leaves a [bracket] and asks. The studio’s own checks stop an email with anything left to fill, a weekday that is not that date or a button with no link, and point out our words, alt text and the kind under Canada’s anti-spam law.' },
        { c: 1, t: 'The editor', p: 'The blocks on the left (a headline with the E that moves, text, details, a dot list, the gold button, photos, a video card, a band of links, a quote, numbers, the sign-off), the email on the right as it will look on a computer or a phone. Click any part of the email to edit it, or ask the Hub to change it.' },
        { c: 1, t: 'Send or save', p: 'Send yourself a test, send it to one person (the permission rule decides), make a campaign for a list (the Campaigns tab checks and sends it), or save it as a template: the automations can then send it as a “Saved email”. While the Hub is in test mode, only the test recipients get email.' }
      ] };
      return true;
    } catch (e) { return false; }
  }
  if (!addTour()) { var tries = 0, iv = setInterval(function () { if (addTour() || ++tries > 40) clearInterval(iv); }, 500); }

  /* ---------- for the CRM and the tests ---------- */
  window.w202 = {
    paint: function (el) { if (el) SS.root = el; paint(); }, open: open, state: function () { return SS; }, repaint: paint,
    sendable: function (t) { return !!t && t.active !== false && t.kind !== 'test' && !t.one_off && !hasBrackets(t) && str(t.html_body).trim() !== '{{body_html}}'; },
    isStudio: function (t) { return !!(t && t.design); },
    MAIL202: MAIL202, checks: checks, datesIn: datesIn, checkDate: checkDate, fromAi: fromAi, aiMessages: aiMessages, aiSystem: aiSystem, designForAi: designForAi, AI_TOOL: AI_TOOL,
    saveNow: saveNow, hasBrackets: hasBrackets
  };
})();
