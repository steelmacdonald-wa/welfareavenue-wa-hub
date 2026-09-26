  /* ---------- names shown as mentions in comments and notes (the renderers call this on escaped text) ---------- */
  function markText(t) {
    var low = t.toLowerCase(), out = '', last = 0;
    for (var i = 0; i < t.length; i++) {
      if (t.charAt(i) !== '@') continue;
      if (i > 0 && (WORD.test(t.charAt(i - 1)) || t.charAt(i - 1) === '.')) continue;
      var rest = low.slice(i + 1, i + 91);
      for (var j = 0; j < R.byLen.length; j++) {
        var n = E(String(R.byLen[j].name).trim()).toLowerCase();
        if (!n || rest.indexOf(n) !== 0) continue;
        var nx = rest.charAt(n.length), nx2 = rest.charAt(n.length + 1);
        if (nx && WORD.test(nx)) continue;
        if (nx === '.' && nx2 && WORD.test(nx2)) continue;
        out += t.slice(last, i) + '<span class="w138at">' + t.slice(i, i + 1 + n.length) + '</span>';
        last = i + 1 + n.length; i = last - 1;
        break;
      }
    }
    return out + t.slice(last);
  }
  function mark(html) {
    var s = String(html == null ? '' : html);
    if (s.indexOf('@') < 0) return s;
    roster(); if (!R.byLen.length) return s;
    return s.split(/(<[^>]*>)/).map(function (part) { return !part || part.charAt(0) === '<' ? part : markText(part); }).join('');
  }

  /* ---------- wiring ---------- */
  function stop(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
  function isField(el) { return !!(el && el.matches && fieldOf(el)); }
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!isField(el)) { if (P.open && P.el !== el) closePick(); return; }
    refresh(el); hintSoon(el);
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target; if (!isField(el)) return;
    if (el.__w138base == null) el.__w138base = textOf(el);
    if (C.connected === null && signedIn()) loadLink();
  });
  document.addEventListener('focusout', function (e) {
    var el = e.target; if (!P.open || P.el !== el) return;
    setTimeout(function () { if (document.activeElement !== el) closePick(); }, 150);
  });
  document.addEventListener('keyup', function (e) {
    if (!isField(e.target)) return;
    if (/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) refresh(e.target);
  });
  document.addEventListener('click', function (e) {
    var el = e.target; if (!el) return;
    if (isField(el)) { setTimeout(function () { if (P.open || tokenish(el)) refresh(el); }, 0); return; }
    var c = el.closest && el.closest('[data-w138c]'); if (c) { e.preventDefault(); act(c); }
  });
  function tokenish(el) { try { return el.isContentEditable || String(el.value || '').indexOf('@') >= 0; } catch (x) { return false; } }
  document.addEventListener('mousedown', function (e) {
    if (!P.open) return;
    var t = e.target;
    if (P.box && P.box.contains(t)) return;
    if (P.el && (t === P.el || (P.el.contains && P.el.contains(t)))) return;
    closePick();
  }, true);
  /* the list's keys run before anything else on the page (the drawers close on Escape; some fields post on Enter) */
  window.addEventListener('keydown', function (e) {
    if (!P.open || e.isComposing) return;
    if (document.activeElement !== P.el) { closePick(); return; }
    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') { stop(e); P.idx = (P.idx + (k === 'ArrowDown' ? 1 : -1) + P.list.length) % P.list.length; paintPick(); return; }
    if (k === 'Enter' || k === 'Tab') { if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) { closePick(); return; } stop(e); choose(P.idx); return; }
    if (k === 'Escape') { stop(e); closePick(); }
  }, true);
  window.addEventListener('scroll', function () { if (P.open) placePick(); }, true);
  window.addEventListener('resize', function () { if (P.open) closePick(); });
  window.addEventListener('hashchange', function () { closePick(); });

  window.w138Mark = mark;
  window.w138ConnRow = connRow;
  window.w138AfterPaint = afterPaint;
  window.w138Debug = function () { return { roster: roster().length, connected: C.connected, pick: P.open ? P.list.map(function (m) { return m.name; }) : [], status: S.status, recent: (S.recent || []).length }; };
  window.w138Mentioned = function (text) { return mentioned(text).map(function (m) { return String(m.name).trim(); }); };
})();
