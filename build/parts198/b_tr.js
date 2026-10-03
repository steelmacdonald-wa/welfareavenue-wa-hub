
  /* ---------- the lookup ---------- */
  var NUM = /\d+(?:[.,]\d+)*/g;
  function norm(s) { var nums = [], i = 0; var k = s.replace(NUM, function (m) { nums.push(m); return '{' + (i++) + '}'; }); return { k: k, nums: nums }; }
  function frNum(n) { if (/^\d{1,3}(,\d{3})+$/.test(n)) return n.replace(/,/g, ' '); if (/^\d+\.\d+$/.test(n)) return n.replace('.', ','); return n; }
  function fill(t, nums) { return t.replace(/\{(\d+)\}/g, function (m, i) { return nums[+i] != null ? frNum(nums[+i]) : m; }); }
  function look(s) {
    var d = S.d; if (!d) return null;
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    var n = norm(s);
    if (n.nums.length && Object.prototype.hasOwnProperty.call(d, n.k)) return fill(d[n.k], n.nums);
    return null;
  }
  var NAME1 = "[A-Z\\u00c0-\\u00de][A-Za-z\\u00c0-\\u00ff'\\u2019.-]*(?:\\s+(?:de|du|van|von|da|el|al|[A-Z\\u00c0-\\u00de][A-Za-z\\u00c0-\\u00ff'\\u2019.-]*)){0,4}";
  var NAMEISH = new RegExp('^(?:' + NAME1 + '(?:,\\s*(?:and\\s+)?' + NAME1 + '){0,8}|[#$]?\\d[\\d.,:%]*\\s*[A-Za-z%$]{0,4})[.,!?]?$');
  function dates(s) {
    if (!/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b|\b(?:AM|PM|am|pm)\b/.test(s)) return s;
    var o = s;
    o = o.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(,?\s+(\d{4}))?\b/g, function (m, mo, dd, x, yy) { return dd + ' ' + MONL[mo.toLowerCase()] + (yy ? ' ' + yy : ''); });
    o = o.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s+(\d{1,2})(,?\s+(\d{4}))?\b/g, function (m, mo, dd, x, yy) { return dd + ' ' + MON[mo.slice(0, 3).toLowerCase()] + (yy ? ' ' + yy : ''); });
    o = o.replace(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, function (m, dd, mo) { return dd + ' ' + MONL[mo.toLowerCase()]; });
    o = o.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/g, function (m, mo, yy) { return MONL[mo.toLowerCase()] + ' ' + yy; });
    o = o.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/g, function (m, mo, yy) { return MON[mo.toLowerCase()] + ' ' + yy; });
    o = o.replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b,?/g, function (m, d) { return DAYL[d.toLowerCase()]; });
    o = o.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b,?(?=\s+\d)/g, function (m, d) { return DAY[d.toLowerCase()]; });
    o = o.replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/g, function (m, h, mi, ap) { h = +h % 12 + (/p/i.test(ap) ? 12 : 0); return h + ' h ' + mi; });
    o = o.replace(/\b(\d{1,2})\s*(AM|PM|am|pm)\b/g, function (m, h, ap) { h = +h % 12 + (/p/i.test(ap) ? 12 : 0); return h + ' h'; });
    return o;
  }
  /* a date or a time and nothing else (so a task that says Sunday stays as written) */
  var DATEWORD = /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*|AM|PM|am|pm|at|to|from|until)\b|\d+(?:st|nd|rd|th)?/g;
  function dateOnly(s) { return /\d/.test(s) && !/[A-Za-z]{2}/.test(s.replace(DATEWORD, '')); }
  function datesIf(s) { return dateOnly(s) ? dates(s) : s; }
  /* what may sit beside a known phrase: a number, a date, or people on the roster (Ahmed; Ahmed, Ian and Shima) */
  function fill2(x) {
    x = String(x || '').trim(); if (!x) return false;
    if (/^[#$]?\d[\d.,:%]*\s*[A-Za-z%$]{0,4}[.,!?]?$/.test(x) || dateOnly(x)) return true;
    var toks = x.replace(/[.,!?]$/, '').split(/\s*,\s*|\s+and\s+/);
    return toks.length > 0 && toks.every(function (t) { return !!S.names[t] || !!S.names[t.split(' ')[0]] && /^[A-Z]/.test(t); });
  }
  function punct(p) { return p === ':' ? NBSP + ':' : p; }
  function core(s, depth) {
    if (!s || S.names[s]) return null;
    var t = look(s); if (t != null) return t;
    if (depth > 2) return null;
    /* around separators */
    var parts = s.split(/(\s+[·•—|]\s+|\s+-\s+)/);
    if (parts.length > 1) {
      var any = false, o = parts.map(function (p, i) { if (i % 2) return p; var x = core(p, depth + 1); if (x != null) { any = true; return x; } var dt = datesIf(p); if (dt !== p) any = true; return dt; });
      if (any) return o.join('');
    }
    /* symbols around the words (+ Add a task, ? How this page works, sparkles Get recommendation, open \u00b7) */
    var sy = /^([^A-Za-z0-9\u00c0-\u00ff({\[]+)?([\s\S]*?)([^A-Za-z0-9\u00c0-\u00ff)}\].!?\u2026]+)?$/.exec(s);
    if (sy && (sy[1] || sy[3]) && sy[2] && sy[2] !== s) { var inner = core(sy[2], depth + 1); if (inner != null) return (sy[1] || '') + inner + (sy[3] || ''); }
    /* words, then a short note in brackets: Daniela (Fundraising), Meeting date (optional) */
    var br = /^([\s\S]*?\S)\s*\(([^()]{1,60})\)$/.exec(s);
    if (br) {
      var bh = core(br[1], depth + 1), bi = core(br[2], depth + 1);
      if (bh != null || bi != null) return (bh != null ? bh : br[1]) + ' (' + (bi != null ? bi : br[2]) + ')';
    }
    /* a phrase and its closing punctuation */
    var c = /^([\s\S]*?\S)\s*([:?!.…])$/.exec(s);
    if (c) { var cx = look(c[1]); if (cx != null) return cx + punct(c[2]); }
    /* a known phrase, then a name or a number (Handled by Ahmed, Welcome Alyx), or the other way round */
    if (s.length < 120) {
      var sp = []; for (var i = 0; i < s.length; i++) if (s[i] === ' ') sp.push(i);
      for (var j = sp.length - 1; j >= 0; j--) {
        var head = s.slice(0, sp[j]), tail = s.slice(sp[j] + 1);
        if (fill2(tail)) { var h = look(head) || look(head.replace(/[:,]$/, '')); if (h != null) return h + (/[:,]$/.test(head) && !/[:,]$/.test(h) ? punct(head.slice(-1)) : '') + ' ' + datesIf(tail); }
        if (fill2(head)) { var tl = look(tail); if (tl != null) return datesIf(head) + ' ' + tl; }
      }
    }
    var dt2 = datesIf(s); if (dt2 !== s) return dt2;
    return undefined;   /* nothing known: may be the Hub's own words not yet translated */
  }
  /* raw text as the page has it (with its spaces) → French, or null to leave it */
  function tr(raw) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw); var s = m[2];
    if (s.length < 2 || !/[A-Za-z]{2}/.test(s)) return null;
    var out = core(s, 0);
    if (out === undefined) { S.stats.miss++; queue(s); return null; }
    if (out == null || out === s) return null;
    S.stats.hit++;
    return m[1] + out + m[3];
  }
  function queue(s) {
    if (s.length > 160 || S.qn > 400 || S.names[s]) return;
    if (!/[a-z]{2}/.test(s)) return;                       /* all capitals or a code */
    if (NAMEISH.test(s) && !/\s[a-z]/.test(s)) return;     /* looks like a name */
    var k = norm(s).k; if (S.q[k]) return; S.q[k] = 1; S.qn++;
  }

  /* ---------- the page: every text node and a few attributes ---------- */
  var SKIP = 'script,style,textarea,code,pre,svg,[contenteditable=""],[contenteditable="true"],.notranslate,[translate="no"],[data-w198skip]';
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  function skipEl(el) { try { return !!(el && el.closest && el.closest(SKIP)); } catch (e) { return false; } }
  /* Some pages check their own words and put the English back (a title kept in step with its section): the second time an
     element is set back to the English it had, it keeps the English, so the two never take turns. */
  function doText(tn) {
    if (tn.__w198fr !== undefined && tn.data === tn.__w198fr) return;
    var p = tn.parentNode; if (!p || p.nodeType !== 1 || p.__w198stop || skipEl(p)) return;
    var now = Date.now();
    if (p.__w198last && p.__w198last.en === tn.data && now - p.__w198last.t < 4000) {
      p.__w198back = (p.__w198back || 0) + 1;
      if (p.__w198back >= 2) { p.__w198stop = true; tn.__w198fr = tn.data; return; }
    }
    if (++S.burst.n > 20000) { if (now - S.burst.t < 1500) { S.burst.hot = true; return; } S.burst = { n: 0, t: now, hot: false }; }
    var fr = tr(tn.data);
    if (fr != null) { p.__w198last = { en: tn.data, t: now }; tn.__w198en = tn.data; tn.__w198fr = fr; tn.data = fr; }
    else tn.__w198fr = tn.data;
  }
  function doAttrs(el) {
    if (skipEl(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i]; if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a), st = el.__w198a || (el.__w198a = {});
      if (st[a] === v) continue;
      var fr = tr(v); if (fr != null) { st[a] = fr; el.setAttribute(a, fr); } else st[a] = v;
    }
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value && !el.__w198v) { var fv = tr(el.value); if (fv != null) { el.value = fv; } el.__w198v = 1; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipEl(root)) return; doAttrs(root); }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: function (n) { if (n.nodeType === 1) { var tg = n.tagName; return (tg === 'SCRIPT' || tg === 'STYLE' || tg === 'TEXTAREA' || tg === 'CODE' || tg === 'PRE' || n.hasAttribute('data-w198skip') || n.classList.contains('notranslate')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } return NodeFilter.FILTER_ACCEPT; } });
    var n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  var MO = null;
  function start() {
    if (S.on || S.lang !== 'fr' || !S.d) return; S.on = true;
    document.documentElement.setAttribute('lang', 'fr-CA');
    walk(document.body); title();
    MO = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]); }
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes' && m.target.nodeType === 1) doAttrs(m.target);
      }
    });
    MO.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    var tEl = document.querySelector('title'); if (tEl) new MutationObserver(title).observe(tEl, { childList: true, characterData: true, subtree: true });
  }
  function title() { var t = document.title; if (t && t !== S.lastTitle) { var parts = t.split(' · '), out = parts.map(function (p) { var x = tr(p); return x == null ? p : x; }).join(' · '); S.lastTitle = out; if (out !== t) document.title = out; } }
