#!/usr/bin/env python3
"""wave225 step c: the page's banner and filters."""
import os, sys, re
D = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(D, '..', 'src', '121_wave121.seg')
s = open(P, encoding='utf8').read()
if 'wave225c' in s: print('c already'); sys.exit(0)
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count: raise SystemExit('expected %d of %r, found %d' % (count, old[:100], n))
    s = s.replace(old, new)
# the banner: what each platform does today, with the Connections page one click away
a = s.index('  function capBanner() {'); b = s.index('  function glance() {')
s = s[:a] + """  function capBanner() {
    /* wave225c: one line per way of posting, from social-publish capabilities */
    if (!staff()) return '';
    var c = C.cap;
    if (!c) return '<div class="cap"><div><b>Checking the connections\\u2026</b></div></div>';
    var by = {}; PORDER.forEach(function (k) { var m = modeOf(k); (by[m] = by[m] || []).push(PL[k].label); });
    var bits = []; ['direct', 'make', 'drafts', 'reminder'].forEach(function (m) { if (by[m]) bits.push('<span style="display:block">' + E(MODE_L[m]) + ': <b style="display:inline">' + E(by[m].join(', ')) + '</b></span>'); });
    var allOn = !by.reminder;
    return '<div class="cap' + (allOn || (c.can && c.can.instagram && c.can.facebook) ? ' on' : '') + '"><div><b>' + (c.can && c.can.instagram && c.can.facebook ? 'Instagram and Facebook publish from here.' : 'Plan and confirm mode for Meta') + '</b>' + bits.join('') + '<span style="display:block;margin-top:4px">Reminders reach the post\\u2019s owner at its time (a Hub notification and a Slack DM) with the caption and media to post by hand. <a data-w121go="#studio/connections">Connections</a></span></div></div>';
  }
""" + s[b:]
# filters: every platform, waiting for approval, and a tag
rep("""      '<div class="chips">' + [['', 'All platforms'], ['instagram', 'Instagram'], ['facebook', 'Facebook']].map(function (x) { return '<span data-w121fpl="' + x[0] + '" class="' + (C.filter.pl === x[0] ? 'on' : '') + '">' + x[1] + '</span>'; }).join('') + '<i></i>' +
      [['', 'Everything'], ['planned', 'Planned'], ['live', 'Live'], ['attn', 'Needs attention'], ['drafts', 'Drafts']].map(function (x) { return '<span data-w121fst="' + x[0] + '" class="' + (C.filter.st === x[0] ? 'on' : '') + '">' + x[1] + '</span>'; }).join('') + '</div>';""",
"""      '<div class="chips">' + [['', 'All platforms']].concat(PORDER.map(function (k) { return [k, PL[k].label]; })).map(function (x) { return '<span data-w121fpl="' + x[0] + '" class="' + (C.filter.pl === x[0] ? 'on' : '') + '">' + x[1] + '</span>'; }).join('') + '<i></i>' +
      [['', 'Everything'], ['planned', 'Planned'], ['appr', 'Approvals'], ['live', 'Live'], ['attn', 'Needs attention'], ['drafts', 'Drafts']].map(function (x) { return '<span data-w121fst="' + x[0] + '" class="' + (C.filter.st === x[0] ? 'on' : '') + '">' + x[1] + '</span>'; }).join('') +
      ((C.tags || []).length ? '<i></i><select data-w225ftag aria-label="Tag"><option value="">Every tag</option>' + C.tags.map(function (t) { return '<option' + (C.filter.tag === t.name ? ' selected' : '') + '>' + E(t.name) + '</option>'; }).join('') + '</select>' : '') + '</div>';""")
# the title: the page sits in the Content Studio (the app's rail is the way back)
rep("""      '<div class="w116top"><div><h2><span class="dot" style="background:#6F64AB"></span>Content calendar</h2><p class="sub">Plan, publish and confirm Instagram and Facebook posts. Drag a post to move it; drop an idea on a day to plan it.</p></div>' +""",
"""      '<div class="w116top"><div><h2><span class="dot" style="background:#B4467A"></span>Content calendar</h2><p class="sub">Plan, approve, publish and confirm posts for Instagram, Facebook, Threads, LinkedIn, TikTok and YouTube. Drag a post to move it; drop an idea on a day to plan it.</p></div>' +""")
rep("""(staff() ? '<button class="btn" data-w121new="1">New post</button><button class="btn mini ghost" data-w121set="1" title="Slack confirmations">Settings</button>' : '') + '<a class="btn mini ghost" data-w121go="#socialstats">Analytics</a></div></div>' +""",
"""(staff() ? '<button class="btn" data-w121new="1">New post</button><button class="btn mini ghost" data-w121set="1" title="Slack confirmations">Settings</button>' : '') + '<a class="btn mini ghost" data-w121go="#socialstats">Analytics</a></div></div>' +""")
# the tag filter changes
rep("""    if (t.id === 'w121lang') { C.edit.lang = t.value; return; }""",
"""    if (t.id === 'w121lang') { C.edit.lang = t.value; return; }""")
rep("""  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !C.edit || !t.closest || !t.closest('#w121dr')) return;""",
"""  document.addEventListener('change', function (e) {
    var t0 = e.target; if (t0 && t0.matches && t0.matches('#contentcal [data-w225ftag]')) { C.filter.tag = t0.value; paint(); return; }   /* wave225c */
    var t = e.target; if (!t || !C.edit || !t.closest || !t.closest('#w121dr')) return;""")
s = s.replace('  function capBanner() {\n    /* wave225c', '  function capBanner() {\n    /* wave225c', 1)
open(P, 'w', encoding='utf8').write(s); print('c ok')
