#!/usr/bin/env python3
"""wave225 step b: helpers, state, data (see patch121.py)."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(D, '..', 'src', '121_wave121.seg')
s = open(P, encoding='utf8').read()
if 'wave225b' in s: print('b already'); sys.exit(0)
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count: raise SystemExit('expected %d of %r, found %d' % (count, old[:100], n))
    s = s.replace(old, new)

rep("""  function canPublish(pls) { var c = C.cap; if (!c || !c.token) return false; return (pls || []).length > 0 && (pls || []).every(function (p) { return c.can && c.can[p] === true; }); }""",
"""  /* wave225b: a post can be scheduled to go out when Instagram and Facebook can publish (the Meta token); every other platform
     goes out directly when connected, or by the reminder flow (social-publish tells the owner at the post's time) */
  function canPublish(pls) { var c = C.cap; if (!c) return false; return (pls || []).length > 0 && (pls || []).every(function (p) { return (p === 'instagram' || p === 'facebook') ? !!(c.token && c.can && c.can[p] === true) : true; }); }
  function modeOf(p) { var m = C.cap && C.cap.mode && C.cap.mode[p]; if (m) return m; if (p === 'instagram' || p === 'facebook') return C.cap && C.cap.can && C.cap.can[p] ? 'direct' : 'reminder'; return 'reminder'; }
  function isPub() { return C.pub === true; }
  function hashCap() { var s = C.cap && C.cap.studio; var n = s && Number(s.hashtag_cap); return n > 0 ? n : 5; }
  function vOf(e, pl) { e.variants = e.variants || {}; return e.variants[pl] = e.variants[pl] || {}; }
  function capOf(e, pl) { var v = (e.variants || {})[pl] || {}; return (v.caption != null && String(v.caption).trim() !== '') ? String(v.caption) : (e.caption || ''); }
  function kindOf(e, pl) { var v = (e.variants || {})[pl] || {}; if (v.kind) return v.kind; if (pl === 'instagram' && vids(e).length) return 'reel'; return 'feed'; }
  function tagColor(n) { var t = (C.tags || []).filter(function (x) { return x.name === n; })[0]; return t ? t.color : '#6F64AB'; }""")

# the state, with the approvals
rep("""    var s = p.status || 'draft'; var cls = (ST[s] || ST.draft).cls; var label = (ST[s] || ST.draft).label; var attn = false; var note = '';
    if (s === 'scheduled' && due""",
"""    var s = p.status || 'draft'; var cls = (ST[s] || ST.draft).cls; var label = (ST[s] || ST.draft).label; var attn = false; var note = '';
    /* wave225b: approvals come first while a post has not gone out */
    var ap = p.approval_status || 'none', notOut = ['draft', 'scheduled', 'failed'].indexOf(s) >= 0;
    if (notOut && ap === 'pending') return { cls: 'appr', label: 'Waiting for approval', attn: false, note: 'Sent for approval' + (p.submitted_by ? ' by ' + String(p.submitted_by).split('@')[0] : '') + '; a marketing lead or an admin approves it', live: liveMap, up: up };
    if (notOut && ap === 'changes') return { cls: 'bad', label: 'Changes asked', attn: true, note: p.approval_note || 'Changes asked before it can go out', live: liveMap, up: up };
    if (s === 'scheduled' && due""")
rep("""      if (!missing.length) note = 'Live on ' + (p.platforms || []).map(function (k) { return PL[k] ? PL[k].label : k; }).join(' and ');""",
"""      var byHand = (p.platforms || []).filter(function (k) { var r = (p.results || {})[k]; return r && r.manual && !r.manual_done && !liveMap[k]; });
      if (byHand.length) { note = 'Waiting to be posted by hand on ' + byHand.map(function (k) { return PL[k] ? PL[k].label : k; }).join(' and '); attn = (now - new Date(p.scheduled_at || p.published_at || now).getTime()) > 6 * 3600000; }
      else if (!missing.length) note = 'Live on ' + (p.platforms || []).map(function (k) { return PL[k] ? PL[k].label : k; }).join(' and ');""")
rep("""      else if (ago > 36 && missing.some(connected)) { note = 'Not seen in the analytics yet on ' + missing.filter(connected).map(function (k) { return PL[k].label; }).join(' and '); attn = true; }""",
"""      else if (ago > 36 && missing.some(connected)) { note = 'Not seen in the analytics yet on ' + missing.filter(connected).map(function (k) { return PL[k] ? PL[k].label : k; }).join(' and '); attn = true; }""")

# filters: a tag, and waiting for approval
rep("""      if (f.st === 'drafts' && p.status !== 'draft') return false;
    }""", """      if (f.st === 'drafts' && p.status !== 'draft') return false;
      if (f.st === 'appr' && ['pending', 'changes'].indexOf(p.approval_status || 'none') < 0) return false;
    }
    if (f.tag && (p.tags || []).indexOf(f.tag) < 0) return false;""")
rep("""    if (f.q) { var q = f.q.toLowerCase(); if ([p.title, p.caption, p.campaign, p.owner, p.notes].join(' ').toLowerCase().indexOf(q) < 0) return false; }""",
"""    if (f.q) { var q = f.q.toLowerCase(); if ([p.title, p.caption, p.campaign, p.owner, p.notes, (p.tags || []).join(' ')].join(' ').toLowerCase().indexOf(q) < 0) return false; }""")

# data: who publishes, the tags, the library and the posting slots
rep("""      var all121 = (r.data || []).map(function (p) { p.platforms = p.platforms || []; p.media = p.media || []; p.results = p.results || {}; p.live = p.live || {}; return p; });""",
"""      var all121 = (r.data || []).map(function (p) { p.platforms = p.platforms || []; p.media = p.media || []; p.results = p.results || {}; p.live = p.live || {}; p.variants = p.variants || {}; p.tags = p.tags || []; p.manual = p.manual || {}; return p; });
      loadStudio();""")
rep("""  /* wave136: the meeting each idea came from */""",
"""  /* wave225b: the Content Studio's own data (who publishes, tags, the library, the posting slots) */
  async function loadStudio() {
    try {
      var rs = await Promise.all([
        C.pub === null ? db.rpc('wa225_publisher') : Promise.resolve({ data: C.pub }),
        db.from('content_tags').select('*').order('name'),
        db.from('content_snippets').select('*').order('name'),
        db.from('content_slots').select('*').order('weekday').order('at')
      ]);
      C.pub = !!(rs[0] && rs[0].data === true);
      C.tags = (rs[1] && rs[1].data) || []; C.lib = (rs[2] && rs[2].data) || []; C.slots = (rs[3] && rs[3].data) || [];
      if (C.edit) paintDrawer(); else paint();
    } catch (e) { /* the calendar works without them */ }
  }
  /* the next free posting slot for these platforms (content_slots), after now and not already taken by a post */
  function nextQueueSlot(pls) {
    var slots = (C.slots || []).filter(function (s) { return !pls || !pls.length || pls.indexOf(s.platform) >= 0; });
    if (!slots.length) return null;
    var taken = {}; C.posts.forEach(function (p) { if (p.scheduled_at && p.status !== 'cancelled') taken[dayOf(p.scheduled_at) + ' ' + hm(p.scheduled_at)] = 1; });
    var t = today(), nowHm = hm(new Date().toISOString());
    for (var i = 0; i < 60; i++) {
      var d = addDays(t, i), wd = dowOf(d);
      var opts = slots.filter(function (s) { return Number(s.weekday) === wd; }).map(function (s) { return String(s.at).slice(0, 5); }).sort();
      for (var j = 0; j < opts.length; j++) { if (i === 0 && opts[j] <= nowHm) continue; if (!taken[d + ' ' + opts[j]]) return { date: d, time: opts[j] }; }
    }
    return null;
  }
  /* wave136: the meeting each idea came from */""")
s = s.replace("/* wave225b: a post can be scheduled", "/* wave225b: a post can be scheduled", 1)
open(P, 'w', encoding='utf8').write(s); print('b ok')
