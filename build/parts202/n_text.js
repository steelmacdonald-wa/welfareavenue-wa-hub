  /* ---------- wave204 (04/10/26): text without the markup. Soraya Tyree's review: "a place where I can drop the text and it
     generates the html for me would be very helpful because I'm not too familiar with that kind of work". Tell the Hub is that
     place, and the front page now says so (paste your text, the Hub designs the email: no HTML). In the editor, and in the
     Tell the Hub and template boxes, text pasted from a document or an email keeps its bold, its links and its paragraphs,
     turned into the studio's **bold** and [words](link); the B and Link buttons (Cmd/Ctrl+B, Cmd/Ctrl+K) mark selected words
     without typing the symbols. ---------- */
  function htmlToMark(html) {
    var doc; try { doc = new DOMParser().parseFromString(str(html), 'text/html'); } catch (e) { return null; }
    if (!doc || !doc.body) return null;
    var runs = [], BLOCK = /^(P|DIV|H[1-6]|LI|UL|OL|TR|TABLE|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|PRE)$/;
    function weight(el) { var fw = str(el.style && el.style.fontWeight).trim(); return fw === 'bold' || fw === 'bolder' ? 700 : fw === 'normal' || fw === 'lighter' ? 400 : fw ? Number(fw) || 0 : 0; }
    function bold(el, inherited) { var w = weight(el); if (w) return w >= 600; if (/^(B|STRONG|H[1-6])$/.test(el.tagName)) return true; return inherited; }
    function walk(node, b, inLi) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { var t = c.nodeValue.replace(/ /g, ' ').replace(/[\r\n\t ]+/g, ' '); if (t) runs.push({ t: t, b: b }); continue; }
        if (c.nodeType !== 1) continue;
        var tag = c.tagName;
        if (/^(STYLE|SCRIPT|META|TITLE|HEAD|NOSCRIPT|TEMPLATE|IMG|SVG)$/.test(tag)) continue;
        if (tag === 'BR') { runs.push({ br: 1 }); continue; }
        var b2 = bold(c, b);
        if (tag === 'A') {
          var href = str(c.getAttribute('href')).trim(), words = str(c.textContent).replace(/\s+/g, ' ').trim();
          if (words && /^(https?:|mailto:|tel:)/i.test(href)) { runs.push({ t: words === href ? href : '[' + words.replace(/[\[\]]/g, '') + '](' + href.replace(/[()\s]/g, function (x) { return encodeURIComponent(x); }) + ')', raw: true }); continue; }
          walk(c, b2, inLi); continue;
        }
        var blk = BLOCK.test(tag) && !(inLi && /^(P|DIV)$/.test(tag));   /* a list point's own paragraph stays on its line */
        if (blk) runs.push({ br: tag === 'LI' ? 1 : 2 });
        if (tag === 'LI') runs.push({ t: '• ', raw: true });
        walk(c, b2, inLi || tag === 'LI');
        if (blk) runs.push({ br: tag === 'LI' ? 1 : 2 });
      }
    }
    walk(doc.body, false);
    var toks = [];
    runs.forEach(function (r) {
      if (r.br) { toks.push(r); return; }
      var last = toks[toks.length - 1], b = r.raw ? false : !!r.b;
      if (last && !last.br && !last.raw && !r.raw && last.b === b) last.t += r.t; else toks.push({ t: r.t, b: b, raw: !!r.raw });
    });
    var out = '', pend = 0;
    toks.forEach(function (k) {
      if (k.br) { if (out) pend = Math.max(pend, k.br); return; }
      var t = k.t;
      if (!out || pend) t = t.replace(/^\s+/, '');
      if (!t) return;
      if (pend) { out = out.replace(/[ \t]+$/, '') + (pend === 2 ? '\n\n' : '\n'); pend = 0; }
      if (k.b) { var m = t.match(/^(\s*)([\s\S]*?)(\s*)$/); if (m[2]) t = m[1] + '**' + m[2].replace(/\*\*/g, '') + '**' + m[3]; }
      out += t;
    });
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  /* the boxes that take pasted formatting: the editor's marked text fields, and Tell the Hub's and the template's own words */
  function pasteBox(t) { return t && t.tagName === 'TEXTAREA' && (t.hasAttribute('data-w204fmt') || /^(brief|extra)$/.test(t.getAttribute('data-w202s') || '')); }
  function insertText(t, text, selFrom, selTo, cutFrom, cutTo) {
    var a = cutFrom != null ? cutFrom : t.selectionStart, z = cutTo != null ? cutTo : t.selectionEnd, v = t.value;
    t.value = v.slice(0, a) + text + v.slice(z);
    try { t.focus({ preventScroll: true }); t.setSelectionRange(a + (selFrom != null ? selFrom : text.length), a + (selTo != null ? selTo : selFrom != null ? selFrom : text.length)); } catch (e) { /* fine */ }
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function onPaste(ev) {
    var t = ev.target; if (!within(t) || !pasteBox(t) || t.disabled || t.readOnly) return;
    var cd = ev.clipboardData; if (!cd) return;
    var html = cd.getData('text/html'); if (!html || !/<(b|strong|a|span|p|div|li|h[1-6]|br)\b/i.test(html)) return;
    var mark = htmlToMark(html); if (mark == null || !mark.trim()) return;
    if (mark.replace(/\s+/g, ' ').trim() === str(cd.getData('text/plain')).replace(/\s+/g, ' ').trim()) return;   /* nothing to keep: the browser pastes it */
    ev.preventDefault();
    insertText(t, mark);
  }
  /* B and Link on the selected words */
  function fmtApply(t, kind) {
    if (!t || t.disabled) return;
    var a = t.selectionStart, z = t.selectionEnd, v = t.value, sel = v.slice(a, z);
    if (kind === 'b') {
      if (sel && v.slice(a - 2, a) === '**' && v.slice(z, z + 2) === '**') { insertText(t, sel, 0, sel.length, a - 2, z + 2); return; }
      if (!sel) { insertText(t, '****', 2, 2); return; }
      var m = sel.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (/^\*\*[\s\S]+\*\*$/.test(m[2])) { var inner = m[2].slice(2, -2); insertText(t, m[1] + inner + m[3], m[1].length, m[1].length + inner.length); return; }
      insertText(t, m[1] + '**' + m[2] + '**' + m[3], m[1].length, m[1].length + m[2].length + 4);
      return;
    }
    if (kind === 'link') {
      var u = sel.trim();
      if (/^(https?:\/\/|www\.)\S+$/i.test(u)) { insertText(t, '[words](' + (/^www\./i.test(u) ? 'https://' + u : u) + ')', 1, 6); return; }
      var w = sel.replace(/[\[\]]/g, '') || 'words';
      insertText(t, '[' + w + '](https://)', w.length + 3, w.length + 11);
    }
  }
  function fmtBar() {
    var mac = histMac();
    return '<span class="w204fmt" role="group" aria-label="Formatting"><button type="button" class="w204fb" data-w204fmtb="b" title="Bold: select words, then B (' + (mac ? '⌘B' : 'Ctrl+B') + ')" aria-label="Bold"><b>B</b></button>' +
      '<button type="button" class="w204fb" data-w204fmtb="link" title="Link: select words, then Link (' + (mac ? '⌘K' : 'Ctrl+K') + ')" aria-label="Link">' + I('link') + '</button></span>';
  }
