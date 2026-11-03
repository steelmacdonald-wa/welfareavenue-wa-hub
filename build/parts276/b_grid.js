
  /* ---------- the weekday grid ----------
     Ported from the paint grid on the onboarding page (build/o/index.html wireGrid): a mouse drags a rectangle of cells
     (the first cell decides add or remove); touch and keyboard use click, so a finger can still scroll the grid and the
     page. Columns are Monday to Sunday, rows run from start to end in cellMin steps.
     opts: {start, end, cellMin, slots, clashes, readOnly, onChange(slots), heat(slot) -> {alpha, title, x}, onCell(slot, el)}
     Returns {get, set, destroy}. */
  function grid(host, opts) {
    opts = opts || {};
    var start = Number(opts.start), end = Number(opts.end), step = Number(opts.cellMin) || 30;
    if (!isFinite(start)) start = 480;
    if (!isFinite(end) || end <= start) end = 1320;
    var rows = [];
    for (var m = start; m + step <= end; m += step) rows.push(m);
    var sel = {}; uniq(opts.slots).forEach(function (s) { sel[s] = 1; });
    var clash = {}; (opts.clashes || []).forEach(function (s) { clash[Number(s)] = 1; });
    var ro = !!opts.readOnly;

    var h = '<div class="w276g' + (ro ? ' w276ro' : '') + '" role="group" aria-label="' + (ro ? 'Team availability by weekday' : 'Your typical week') + '">'
      + '<div class="w276tc" aria-hidden="true"><div class="w276dh"></div>'
      + rows.map(function (r) { return '<div class="w276tl">' + (r % 60 === 0 ? E(clockHour(r)) : '') + '</div>'; }).join('') + '</div>';
    DAYS.forEach(function (d, di) {
      h += '<div class="w276day"><div class="w276dh" aria-hidden="true">' + DAYS_SHORT[di] + '</div>';
      rows.forEach(function (r, ri) {
        var s = slot(di, r), x = !!clash[s], ht = ro && opts.heat ? (opts.heat(s) || {}) : null;
        var title = ht ? ht.title : (x ? 'Usually in a meeting' : '');
        h += '<button type="button" class="w276c' + ((x || (ht && ht.x)) ? ' w276x' : '') + (r % 60 === 0 ? ' w276hr' : '') + '" data-di="' + di + '" data-min="' + r + '" data-r="' + ri + '"'
          + (ro ? '' : ' aria-pressed="' + (sel[s] ? 'true' : 'false') + '"')
          + ' aria-label="' + E(DAYS[di] + ' ' + clock(r) + (ht && ht.title ? ', ' + ht.title : '')) + '"'
          + (title ? ' title="' + E(title) + '"' : '') + '>'
          + (ht ? '<span class="w276h" style="opacity:' + Math.max(0, Math.min(1, Number(ht.alpha) || 0)).toFixed(3) + '"></span>' : '')
          + '</button>';
      });
      h += '</div>';
    });
    h += '</div>';
    var wrap = document.createElement('div'); wrap.className = 'w276gw'; wrap.innerHTML = h;
    host.innerHTML = ''; host.appendChild(wrap);
    var g = wrap.firstChild;

    function list() { return Object.keys(sel).map(Number).sort(function (a, b) { return a - b; }); }
    function paint() {
      if (ro) return;
      Array.prototype.forEach.call(g.querySelectorAll('.w276c'), function (c) {
        var on = sel[slot(c.getAttribute('data-di'), c.getAttribute('data-min'))] ? 'true' : 'false';
        if (c.getAttribute('aria-pressed') !== on) c.setAttribute('aria-pressed', on);
      });
    }
    function changed() { paint(); if (typeof opts.onChange === 'function') { try { opts.onChange(list()); } catch (e) { console.warn('wave276 grid', e); } } }
    function at(el) {
      var c = el && el.closest ? el.closest('.w276c') : null;
      if (!c || !g.contains(c)) return null;
      return { el: c, di: Number(c.getAttribute('data-di')), r: Number(c.getAttribute('data-r')), s: slot(c.getAttribute('data-di'), c.getAttribute('data-min')) };
    }

    var drag = null, swallow = false, unwire = function () {};
    if (ro) {
      g.addEventListener('click', function (e) { var c = at(e.target); if (c && typeof opts.onCell === 'function') opts.onCell(c.s, c.el); });
    } else {
      var applyRect = function (c) {
        var a = drag.a, d0 = Math.min(a.di, c.di), d1 = Math.max(a.di, c.di), r0 = Math.min(a.r, c.r), r1 = Math.max(a.r, c.r);
        var next = {}; Object.keys(drag.base).forEach(function (k) { next[k] = 1; });
        for (var di = d0; di <= d1; di++) for (var ri = r0; ri <= r1; ri++) {
          var s = slot(di, rows[ri]);
          if (drag.add) next[s] = 1; else delete next[s];
        }
        sel = next; changed();
      };
      g.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        var c = at(e.target); if (!c) return;
        swallow = true;
        var base = {}; Object.keys(sel).forEach(function (k) { base[k] = 1; });
        drag = { a: c, base: base, add: !sel[c.s] };
        applyRect(c);
        e.preventDefault();
      });
      var move = function (e) {
        if (!drag) return;
        var c = at(document.elementFromPoint(e.clientX, e.clientY));
        if (c) applyRect(c);
      };
      var up = function () { if (drag) drag = null; setTimeout(function () { swallow = false; }, 0); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      unwire = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      g.addEventListener('click', function (e) {
        if (swallow) return;
        var c = at(e.target); if (!c) return;
        if (sel[c.s]) delete sel[c.s]; else sel[c.s] = 1;
        changed();
      });
    }
    return {
      get: list,
      set: function (slots) { sel = {}; uniq(slots).forEach(function (s) { sel[s] = 1; }); changed(); },
      destroy: function () { unwire(); unwire = function () {}; if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    };
  }
  W276.grid = grid;
