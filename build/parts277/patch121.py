#!/usr/bin/env python3
"""wave277 (02/11/26): the composer reads platform limits from the registry. PL, PORDER and MODE_L keep their literal
defaults and are rebuilt IN PLACE from capabilities.platforms once loaded; capsOf(k) feeds the validation limits; the
LinkedIn Make warnings go. Run once on the wave276 121 segment (src/121_wave121.seg); kept for the record like patch121*.py."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, '..', 'src', '121_wave121.seg')
s = open(P, encoding='utf8').read()
if 'wave277' in s:
    print('already patched'); sys.exit(0)
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d of %r, found %d' % (count, old[:90], n))
    s = s.replace(old, new)

# 1. the registry helpers, after MODE_L: mutate PL / PORDER / MODE_L in place (other closures hold them)
rep("""  var MODE_L = { direct: 'Posts directly', make: 'Posts through Make', drafts: 'Lands in TikTok drafts', reminder: 'Reminder to post by hand' };
""",
    """  var MODE_L = { direct: 'Posts directly', make: 'Posts through Make', drafts: 'Lands in TikTok drafts', reminder: 'Reminder to post by hand' };
  /* wave277: the platform registry (capabilities.platforms) replaces the literals above once loaded; the literals stay the fallback */
  function capsOf(k) { return (C.cap && C.cap.caps && C.cap.caps[k]) || {}; }
  function applyRegistry() {
    var list = C.cap && C.cap.platforms;
    if (!list || !list.length) return;
    var rows = list.slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    PORDER.length = 0;
    rows.forEach(function (r) {
      if (!r || !r.key) return;
      var old = PL[r.key] || {};
      PL[r.key] = { label: r.label || old.label || r.key, short: r.short || old.short || r.key, color: r.colour || old.color || '#1F201E' };
      PORDER.push(r.key);
      if (r.modes) Object.keys(r.modes).forEach(function (m) { MODE_L[m] = r.modes[m]; });
    });
  }
""")

# 2. loadCap rebuilds them after C.cap is set
rep("""    try { C.cap = await fn('social-publish', { action: 'capabilities' }); } catch (e) {""",
    """    try { C.cap = await fn('social-publish', { action: 'capabilities' }); applyRegistry(); } catch (e) {""")

# 3. the composer can be opened with media (the drive and later callers)
rep("""      C.edit.dirty = true; }
    paintDrawer();""",
    """      if (prefill.media) C.edit.media = JSON.parse(JSON.stringify(prefill.media)); /* wave277 */
      C.edit.dirty = true; }
    paintDrawer();""")

# 4. validation: limits from the registry
rep("""if (im.length > 10) err(l, 'Instagram takes up to 10 photos in a carousel.');""",
    """var igMax = capsOf(k).max_images || 10; if (im.length > igMax) err(l, 'Instagram takes up to ' + igMax + ' photos in a carousel.');""")
rep("""if (im.length > 20) err(l, 'Threads takes up to 20 photos.');""",
    """var thMax = capsOf(k).max_images || 20; if (im.length > thMax) err(l, 'Threads takes up to ' + thMax + ' photos.');""")
rep("""        if (md === 'make' && vi.length) warn(l, 'Make sends text and photos; a LinkedIn video comes to you as a reminder to post by hand.');
        if (md === 'make' && im.length > 1) warn(l, 'Make sends the first photo only.');
""",
    """        if (im.length > (capsOf(k).max_images || 20)) err(l, 'LinkedIn takes up to ' + (capsOf(k).max_images || 20) + ' photos.');
        if (vi.length > 1 || (vi.length && im.length)) err(l, 'LinkedIn takes one video, or photos, not both.');
""")
rep("""if (vi.length && dur != null && dur > 600) err(l, 'TikTok videos run up to 10 minutes.');""",
    """var ttMax = capsOf(k).max_video_s || 600; if (vi.length && dur != null && dur > ttMax) err(l, 'TikTok videos run up to ' + Math.round(ttMax / 60) + ' minutes.');""")
rep("""else if (dur != null && dur > 180) err(l, 'Shorts run up to 3 minutes; this video is ' + Math.round(dur) + ' seconds.');""",
    """else if (dur != null && dur > (capsOf(k).max_video_s || 180)) err(l, 'Shorts run up to ' + Math.round((capsOf(k).max_video_s || 180) / 60) + ' minutes; this video is ' + Math.round(dur) + ' seconds.');""")

# 5. (final review) the registry's caps for every platform, after the bespoke rules: video not taken, too long (when no
#    bespoke duration rule spoke), photos not taken (unless the bespoke rule already said so). LinkedIn gets its duration
#    check from here; a new platform needs no rule of its own for these three.
rep("""      if (md === 'reminder') warn(l, nm + ' is not connected: at the post\\u2019s time the owner gets a reminder to post it by hand.');
""",
    """      /* wave277: the registry's caps, only for the keys a platform's caps carry */
      var cp = capsOf(k), said = function (re) { return l.some(function (x) { return re.test(x.t); }); };
      if (vi.length && cp.video === false) err(l, nm + ' does not take video.');
      else if (vi.length && cp.max_video_s && dur != null && dur > cp.max_video_s && !said(/run up to|run from/)) err(l, nm + ' videos run up to ' + Math.round(cp.max_video_s / 60) + ' minutes; this video is ' + Math.round(dur) + ' seconds.');
      if (im.length && cp.images === false && !said(/reminder to post in the app/)) warn(l, nm + ' does not take photos; the photos are left out.');
      if (md === 'reminder') warn(l, nm + ' is not connected: at the post\\u2019s time the owner gets a reminder to post it by hand.');
""")

open(P, 'w', encoding='utf8', newline='').write(s)
print('patched')
