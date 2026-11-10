import sys, re
def rep(s, old, new, label, count=1):
    n = s.count(old)
    if n != count: raise SystemExit(f'{label}: expected {count} match, found {n}')
    return s.replace(old, new)

def patch_v225(s):
    s = rep(s, "var SECTIONS = ['overview', 'queue', 'approvals', 'inbox', 'messages', 'hashtags', 'library', 'pages', 'links', 'ads', 'report', 'connections'];",
               "var SECTIONS = ['overview', 'queue', 'approvals', 'inbox', 'messages', 'hashtags', 'library', 'pages', 'links', 'ads', 'report', 'connections', 'web'];   /* wave306: Results > Website */", 'sections')
    s = rep(s, "    overview: ['Content Studio', 'The week ahead, what waits for you, and how the content is doing.'],",
               "    overview: ['Today', 'What needs you, the week, the campaign that is on, and how the content is doing.'],   /* wave306 */\n    web: ['Website', 'Who visits welfareavenue.com, how they find it, and what they do there.'],   /* wave306 */", 'sect')
    # loads run at once (wave306): the calendar's loads beside the Studio's own
    s = rep(s, "        var w = W(); if (w) { await w.load(true); if (!w.cap()) await w.loadCap(); await w.studio(); }",
               "        var w = W(), wp = w ? (async function () { await Promise.all([w.load(true), w.cap() ? null : w.loadCap()]); await w.studio(); })() : null;   /* wave306: at once, not one after the other */", 'loadall1')
    s = rep(s, "        S.pub = rs[0].data === true; S.mk = rs[1].data === true;",
               "        if (wp) await wp;\n        S.pub = rs[0].data === true; S.mk = rs[1].data === true;", 'loadall2')
    # skeletons until the data is in; Today and Website from wave306
    s = rep(s, "    else if (!S.loaded && !W()) html = '<div class=\"card\"><div class=\"empty\">Loading the Content Studio\\u2026</div></div>';",
               "    else if (!S.loaded) html = window.w306 ? window.w306.skeleton(S.sec) : '<div class=\"card\"><div class=\"empty\">Loading the Content Studio\\u2026</div></div>';   /* wave306: never a false empty state while loading */", 'skeleton')
    s = rep(s, ": S.sec === 'connections' ? (window.w277 && window.w277.connectHtml ? window.w277.connectHtml() : connectHtml()) : overviewHtml();",
               ": S.sec === 'connections' ? (window.w277 && window.w277.connectHtml ? window.w277.connectHtml() : connectHtml()) : S.sec === 'web' && window.w306 ? window.w306.web() : (window.w306 ? window.w306.today() : overviewHtml());   /* wave306 */", 'paintsec')
    s = rep(s, "    if (keep) { try { var el = h.querySelector('[' + keep.attr + (keep.val ? '=\"' + keep.val + '\"' : '') + ']'); if (el) { el.focus(); if (keep.s != null && el.setSelectionRange) el.setSelectionRange(keep.s, keep.e); } } catch (e) { /* fine */ } }\n  }",
               "    if (keep) { try { var el = h.querySelector('[' + keep.attr + (keep.val ? '=\"' + keep.val + '\"' : '') + ']'); if (el) { el.focus(); if (keep.s != null && el.setSelectionRange) el.setSelectionRange(keep.s, keep.e); } } catch (e) { /* fine */ } }\n    if (window.w306) { try { if (S.loaded) window.w306.entered(S.sec); window.w306.tabs(); } catch (e) { /* fine */ } }   /* wave306 */\n  }", 'painttail')
    # show: draw what we have at once, then refresh
    s = rep(s, "    route(hh || location.hash);\n    var h = host(); if (!h) return;\n    if (!S.loaded) paint();",
               "    route(hh || location.hash);\n    var h = host(); if (!h) return;\n    paint();   /* wave306: draw at once (a skeleton the first time, what we have after) */", 'show')
    # internals for wave306
    s = rep(s, "    W: W, posts: posts, loadConn: loadConn, connAct: connAct, modeOf: modeOf, connectExtra: connectExtra250, PLX: PLX, PORDER: PORDER   /* wave277 reuses these */\n  };",
               "    W: W, posts: posts, loadConn: loadConn, connAct: connAct, modeOf: modeOf, connectExtra: connectExtra250, PLX: PLX, PORDER: PORDER,   /* wave277 reuses these */\n    x: { postRow: postRow, stateOf: stateOf, thumbOf: thumbOf, titleOf: titleOf, mark: mark, today: today, dayOf: dayOf, niceWhen: niceWhen, niceDate: niceDate, weekBounds: weekBounds, goalStatus: goalStatus, cap: cap, myEmail: myEmail, myName: myName, lower: lower, fn: fn, PLX: PLX, PORDER: PORDER }   /* wave306 */\n  };", 'exports')
    return s

def patch_v153(s):
    old_start = "        return [{ label: 'Content', items: [\n          { h: '#studio', l: 'Overview', ic: 'home', page: 'studio' },"
    i = s.find(old_start); j = s.find("        ] }];\n      },\n      actions: [{ k: 'newpost'", i)
    if i < 0 or j < 0: raise SystemExit('v153 studio groups not found')
    j_end = j + len("        ] }];\n")
    new = ("        /* wave306: five areas; an item lights for the addresses in its also list (isOn), the area's pages are tabs (#w306tabs) */\n"
           "        var al = function (k) { try { return window.w306 ? window.w306.railAlso(k) : []; } catch (e) { return []; } };\n"
           "        var sum = function (a, b) { return (a || 0) + (b || 0) || null; };\n"
           "        return [{ label: 'Content Studio', items: [\n"
           "          { h: '#studio', l: 'Today', ic: 'home', page: 'studio' },\n"
           "          { h: '#contentcal', l: 'Plan', ic: 'cal', page: 'contentcal', n: n.appr, also: al('plan') },\n"
           "          { h: '#studio/inbox', l: 'Inbox', ic: 'chat', page: 'studio', n: sum(n.inbox, n.msg), also: al('inbox') },\n"
           "          { h: '#studio/web', l: 'Results', ic: 'chart', page: 'studio', also: al('results') },\n"
           "          { h: '#studio/library', l: 'Toolkit', ic: 'book', page: 'studio', also: al('toolkit') }\n"
           "        ] }];\n")
    s = s[:i] + new + s[j_end:]
    s = rep(s, "  function isOn(app, it) {\n    var h = hashNow(), pg = pageOf(h), sub = subOf(h), ip = pageOf(it.h), isub = subOf(it.h);",
               "  function isOn(app, it) {\n    var h = hashNow(), pg = pageOf(h), sub = subOf(h), ip = pageOf(it.h), isub = subOf(it.h);\n"
               "    var hp = String(h || '').replace(/^#/, '').split('?')[0], inAlso = function (x) { return (x.also || []).some(function (a) { a = String(a).replace(/^#/, ''); return hp === a || hp.indexOf(a + '/') === 0; }); };   /* wave306 */\n"
               "    var owner = null; items(app).forEach(function (g) { g.items.forEach(function (x) { if (!owner && inAlso(x)) owner = x; }); }); if (owner) return owner.h === it.h;", 'isOn')
    return s
