  /* ---------- the line under a field: who gets a Slack message, and from whom ---------- */
  var C = { at: 0, connected: null, loading: null };   /* my own slack_links row: have I connected Slack? */
  function loadLink(force) {
    if (!signedIn()) return Promise.resolve(null);
    if (C.loading) return C.loading;
    if (!force && C.at && Date.now() - C.at < 120000) return Promise.resolve(C.connected);
    C.loading = Promise.resolve(db.from('slack_links').select('slack_user_id, connected_at').eq('email', myEmail()).maybeSingle()).then(function (r) {
      C.loading = null; C.at = Date.now(); C.connected = !!(r && r.data && r.data.slack_user_id); return C.connected;
    }, function () { C.loading = null; C.at = Date.now(); C.connected = false; return false; });
    return C.loading;
  }
  function textOf(el) { return el.isContentEditable ? (el.innerText || el.textContent || '') : String(el.value == null ? '' : el.value); }
  /* the hint sits under the field, or under its row when the field shares a row with its Post button */
  function hintHost(el) {
    var p = el.parentElement; if (!p) return el;
    for (var i = 0; i < p.children.length; i++) { var c = p.children[i]; if (c !== el && c.tagName === 'BUTTON') return p; }
    return el;
  }
  function hintText(list, f) {
    var withMail = list.filter(function (m) { return !!m.email; }), noMail = list.filter(function (m) { return !m.email; });
    var when = f.kind === 'comment' ? 'when you post it' : (f.kind === 'desc' ? 'once it saves' : 'when you save');
    var s = '';
    if (withMail.length) {
      var who = E(names(withMail)), verb = withMail.length === 1 ? ' gets' : ' get';
      if (C.connected === true) s = who + verb + ' a Slack message from you ' + when + (f.priv ? ', saying where to look (the note itself stays in the Hub).' : ', with what you wrote and a link back here.');
      else if (C.connected === false) s = who + verb + ' a Slack message ' + when + ', from the Hub with your name' + (f.priv ? ' (the note itself stays in the Hub)' : '') + '.' + (staffOk() ? ' To send it as you, connect Slack in Settings.' : '');
      else s = who + verb + ' a Slack message ' + when + '.';
    }
    if (noMail.length) s += (s ? ' ' : '') + '<span class="warn">' + E(names(noMail)) + (noMail.length === 1 ? ' has' : ' have') + ' no email on the Hub, so no Slack message.</span>';
    return SLACK_SVG + '<div>' + s + '</div>';
  }
  function dropHint(el) {
    var h = el.__w138hint; if (h && h.parentNode) h.parentNode.removeChild(h);
    el.__w138hint = null;
    if (el.__w138w) { clearInterval(el.__w138w); el.__w138w = null; }
  }
  function hint(el) {
    if (!el) return;
    if (!document.body.contains(el)) { dropHint(el); return; }
    var f = fieldOf(el);
    var list = f && signedIn() ? mentioned(textOf(el)) : [];
    if (list.length) {
      var me = myEmail(), before = el.__w138base ? mentioned(el.__w138base).map(function (m) { return m.id; }) : [];
      list = list.filter(function (m) { return lower(m.email) !== me && before.indexOf(m.id) < 0; });
    }
    if (!list.length) { dropHint(el); return; }
    if (C.connected === null && !C.loading) loadLink().then(function () { hint(el); });
    var html = hintText(list, f), h = el.__w138hint;
    if (!h || !document.body.contains(h)) {
      h = document.createElement('div'); h.className = 'w138hint'; h.setAttribute('aria-live', 'polite');
      hintHost(el).insertAdjacentElement('afterend', h); el.__w138hint = h;
    }
    if (h.__html !== html) { h.innerHTML = html; h.__html = html; }
    /* a posted comment empties its field without an input event: look again now and then while the line shows */
    if (!el.__w138w) el.__w138w = setInterval(function () { hint(el); }, 900);
  }
  function hintSoon(el, ms) { clearTimeout(el.__w138t); el.__w138t = setTimeout(function () { hint(el); }, ms == null ? 250 : ms); }

