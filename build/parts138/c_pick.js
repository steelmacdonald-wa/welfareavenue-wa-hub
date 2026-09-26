  /* ---------- the picker: type @ and choose someone ---------- */
  var P = { open: false, el: null, ce: false, node: null, at: 0, caret: 0, q: '', list: [], idx: 0, box: null };
  function pickBox() {
    if (P.box && document.body.contains(P.box)) return P.box;
    var b = document.createElement('div');
    b.id = 'w138pick'; b.setAttribute('role', 'listbox'); b.setAttribute('aria-label', 'Mention someone');
    document.body.appendChild(b);
    /* mousedown, not click: the field keeps its focus (the task description saves when it loses it) */
    b.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var it = e.target.closest && e.target.closest('[data-w138i]');
      if (it) choose(Number(it.getAttribute('data-w138i')));
    });
    b.addEventListener('mousemove', function (e) {
      var it = e.target.closest && e.target.closest('[data-w138i]'); if (!it) return;
      var i = Number(it.getAttribute('data-w138i')); if (i !== P.idx) { P.idx = i; paintPick(); }
    });
    P.box = b; return b;
  }

  /* what is typed after the @ right before the caret, if it can be a mention */
  function tokenIn(text, caret) {
    var before = String(text || '').slice(0, caret);
    var at = before.lastIndexOf('@');
    if (at < 0 || caret - at > 32) return null;
    var prev = at > 0 ? before.charAt(at - 1) : '';
    if (prev && (WORD.test(prev) || prev === '.')) return null;          /* an email address */
    var q = before.slice(at + 1);
    if (/[\n\r@]/.test(q) || /^\s/.test(q)) return null;
    return { at: at, q: q };
  }
  /* the team the field is about: the task in the drawer, else the team page, else mine */
  function contextTeam(el) {
    try {
      if (el && el.closest && el.closest('#w116dr')) {
        var m = /#(\d+)/.exec(((document.querySelector('#w116dr .w116drh') || {}).textContent) || '');
        var t = m && (typeof DB_TASKS !== 'undefined' ? DB_TASKS : []).filter(function (x) { return String(x.id) === m[1]; })[0];
        if (t && t.department) return t.department;
      }
      var h = /^#team\/([a-z]+)/.exec(location.hash || ''); if (h) return h[1];
    } catch (e) { /* fine */ }
    return (meRow() || {}).department || '';
  }
  function candidates(q, el) {
    q = String(q || '').toLowerCase().replace(/\u00a0/g, ' ');
    var me = myEmail(), mine = contextTeam(el), out = [];
    roster().forEach(function (m) {
      if (me && lower(m.email) === me) return;
      var n = String(m.name).trim().toLowerCase(), local = lower(m.email).split('@')[0], s = -1;
      if (!q) s = 3;
      else if (n.indexOf(q) === 0) s = 0;
      else if (n.split(/\s+/).some(function (w) { return w.indexOf(q) === 0; })) s = 1;
      else if (q.length >= 2 && local && (local.indexOf(q) === 0 || local.split(/[._-]/).some(function (w) { return w.indexOf(q) === 0; }))) s = 2;
      if (s >= 0) out.push({ m: m, s: s });
    });
    out.sort(function (a, b) {
      /* people Slack can reach (an email on the roster) before those it cannot, then the team the field is about */
      return a.s - b.s || ((a.m.email ? 0 : 1) - (b.m.email ? 0 : 1)) || ((a.m.department === mine ? 0 : 1) - (b.m.department === mine ? 0 : 1)) || String(a.m.name).localeCompare(String(b.m.name));
    });
    return out.slice(0, 6).map(function (x) { return x.m; });
  }

  /* where the caret is on screen */
  function caretRect(el, pos) {
    var r = el.getBoundingClientRect();
    try {
      var cs = getComputedStyle(el), div = document.createElement('div'), st = div.style, isInput = el.tagName === 'INPUT';
      ['boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize'
      ].forEach(function (p) { st[p] = cs[p]; });
      st.position = 'absolute'; st.visibility = 'hidden'; st.top = '0'; st.left = '-9999px'; st.overflow = 'hidden';
      st.whiteSpace = isInput ? 'pre' : 'pre-wrap'; st.wordWrap = 'break-word'; st.height = 'auto';
      div.textContent = el.value.slice(0, pos);
      var sp = document.createElement('span'); sp.textContent = el.value.slice(pos, pos + 1) || '.'; div.appendChild(sp);
      document.body.appendChild(div);
      var lh = parseFloat(cs.lineHeight); if (!(lh > 0)) lh = (parseFloat(cs.fontSize) || 14) * 1.35;
      var x = r.left + (parseFloat(cs.borderLeftWidth) || 0) + sp.offsetLeft - el.scrollLeft, y = r.top + (parseFloat(cs.borderTopWidth) || 0) + sp.offsetTop - el.scrollTop;
      document.body.removeChild(div);
      x = Math.max(r.left, Math.min(x, r.right - 12)); y = Math.max(r.top, Math.min(y, r.bottom - lh));
      return { left: x, top: y, bottom: y + lh };
    } catch (e) { return { left: r.left, top: r.top, bottom: r.bottom }; }
  }
  function rangeRect(range, el) {
    try {
      var rs = range.getClientRects(); if (rs && rs.length) return rs[rs.length - 1];
      var b = range.getBoundingClientRect(); if (b && (b.top || b.left)) return b;
    } catch (e) { /* fine */ }
    return el.getBoundingClientRect();
  }

  function refresh(el) {
    if (!el || !signedIn()) { closePick(); return; }
    var tok = null;
    if (el.isContentEditable) {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) { closePick(); return; }
      var rg = sel.getRangeAt(0), node = rg.startContainer;
      if (!node || node.nodeType !== 3 || !el.contains(node)) { closePick(); return; }
      tok = tokenIn(node.data, rg.startOffset);
      if (!tok) { closePick(); return; }
      P.ce = true; P.node = node; P.caret = rg.startOffset;
    } else {
      if (typeof el.selectionStart !== 'number' || el.selectionStart !== el.selectionEnd) { closePick(); return; }
      tok = tokenIn(el.value, el.selectionStart);
      if (!tok) { closePick(); return; }
      P.ce = false; P.node = null; P.caret = el.selectionStart;
    }
    var list = candidates(tok.q, el);
    if (!list.length) { closePick(); return; }
    var same = P.open && P.el === el && P.q === tok.q;
    P.el = el; P.at = tok.at; P.q = tok.q; P.list = list;
    if (!same) P.idx = 0;
    P.open = true;
    paintPick();
    placePick();
  }
  function paintPick() {
    var b = pickBox();
    b.innerHTML = '<div class="hd">Mention someone</div>' + P.list.map(function (m, i) {
      var team = teamShort(m.department) || m.role || '';
      return '<div class="it' + (i === P.idx ? ' on' : '') + '" role="option" aria-selected="' + (i === P.idx ? 'true' : 'false') + '" data-w138i="' + i + '">' + avatar(m, 28) +
        '<div><b>' + E(String(m.name).trim()) + '</b><small>' + E(team) + (m.email ? '' : (team ? ' · ' : '') + '<span class="nomail">no email, so no Slack message</span>') + '</small></div></div>';
    }).join('') + '<div class="ft">↑ ↓ to choose, Enter to mention, Esc to close</div>';
    b.classList.add('on');
  }
  function placePick() {
    var b = pickBox(), el = P.el; if (!el) return;
    var c;
    if (P.ce) { var r = document.createRange(); try { r.setStart(P.node, P.caret); r.collapse(true); } catch (e) { /* fine */ } c = rangeRect(r, el); }
    else c = caretRect(el, P.at);
    var w = b.offsetWidth || 280, h = b.offsetHeight || 240, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.max(8, Math.min(c.left - 10, vw - w - 8));
    var top = c.bottom + 6;
    if (top + h > vh - 8 && c.top - h - 6 > 8) top = c.top - h - 6;
    b.style.left = Math.round(left) + 'px'; b.style.top = Math.round(Math.max(8, top)) + 'px';
  }
  function closePick() {
    P.open = false; P.list = []; P.node = null;
    if (P.box) { P.box.classList.remove('on'); P.box.innerHTML = ''; }
  }
  function choose(i) {
    var m = P.list[i]; if (!m || !P.el) { closePick(); return; }
    var el = P.el, name = String(m.name).trim(), ok = false;
    if (P.ce) {
      var node = P.node; if (!node || !el.contains(node)) { closePick(); return; }
      var text = '@' + name + ' ';
      if (document.activeElement !== el) el.focus();
      var r = document.createRange(); r.setStart(node, P.at); r.setEnd(node, Math.min(P.caret, node.data.length));
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
      if (!ok) {
        r.deleteContents(); var tn = document.createTextNode('@' + name + ' '); r.insertNode(tn);
        var r2 = document.createRange(); r2.setStartAfter(tn); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      var v = el.value, after = v.slice(P.caret);
      var ins = '@' + name + (/^\s/.test(after) ? '' : ' ');
      el.focus();
      try { el.setSelectionRange(P.at, P.caret); ok = document.execCommand('insertText', false, ins); } catch (e2) { ok = false; }
      if (!ok || el.value.slice(P.at, P.at + ins.length) !== ins) {
        el.value = v.slice(0, P.at) + ins + after;
        var p = P.at + ins.length; try { el.setSelectionRange(p, p); } catch (e3) { /* fine */ }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    closePick();
    hintSoon(el, 0);
  }

