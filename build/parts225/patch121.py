#!/usr/bin/env python3
"""wave225: the Content Studio's composer, built into wave121's calendar (src/121_wave121.seg).
Run once on the wave219 baseline; the result is the new 121 segment (the patch is kept for the record)."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, '..', 'src', '121_wave121.seg')
s = open(P, encoding='utf8').read()
if 'wave225' in s:
    print('already patched'); sys.exit(0)
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d of %r, found %d' % (count, old[:90], n))
    s = s.replace(old, new)

# ---------- 1. constants ----------
rep("""  var PL = { instagram: { label: 'Instagram', short: 'IG', color: '#C13584' }, facebook: { label: 'Facebook', short: 'f', color: '#1877F2' } };""",
"""  var PL = { instagram: { label: 'Instagram', short: 'IG', color: '#C13584' }, facebook: { label: 'Facebook', short: 'f', color: '#1877F2' },
    /* wave225: the Content Studio's other platforms (direct when connected, else the reminder flow) */
    threads: { label: 'Threads', short: '@', color: '#1F201E' }, linkedin: { label: 'LinkedIn', short: 'in', color: '#0A66C2' },
    tiktok: { label: 'TikTok', short: 'Tk', color: '#EE1D52' }, youtube: { label: 'YouTube', short: '\\u25b6', color: '#FF0000' } };
  var PORDER = ['instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'youtube'];
  var KINDS = { instagram: [['feed', 'Post'], ['reel', 'Reel'], ['story', 'Story']], facebook: [['feed', 'Post'], ['reel', 'Reel'], ['story', 'Story']] };
  var MODE_L = { direct: 'Posts directly', make: 'Posts through Make', drafts: 'Lands in TikTok drafts', reminder: 'Reminder to post by hand' };""")
rep("""  var C = { view: null, anchor: null, posts: [], loaded: false, loading: false, at: 0, cap: null, capBusy: false, filter: { pl: '', st: '', q: '' }, drag: null, edit: null, perf: null, perfBusy: false, undo: null, settingsOpen: false, channels: null, err: null };""",
"""  var C = { view: null, anchor: null, posts: [], loaded: false, loading: false, at: 0, cap: null, capBusy: false, filter: { pl: '', st: '', q: '', tag: '' }, drag: null, edit: null, perf: null, perfBusy: false, undo: null, settingsOpen: false, channels: null, err: null, pub: null, tags: [], lib: [], slots: [] };""")

# ---------- 2. CSS for the new parts of the composer ----------
rep("""    '#w121dr{position:fixed;inset:0;z-index:80;display:flex;justify-content:flex-end;font-family:' + BODY + ';}' +""",
"""    '#w121dr{position:fixed;inset:0;z-index:80;display:flex;justify-content:flex-end;font-family:' + BODY + ';}' +
    /* wave225: the Content Studio's composer */
    '#w121dr .tg .md{font-size:10px;font-weight:600;color:var(--wa-muted);letter-spacing:.2px;}' +
    '#w121dr .tg.on .md{color:' + TEAL + ';}#w121dr .tg.on .md.rm{color:#8a5a00;}' +
    '#w121dr .w225ap{border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:12.5px;line-height:1.45;}' +
    '#w121dr .w225ap.pending{background:rgba(111,100,171,.12);color:#3f3780;}#w121dr .w225ap.changes{background:rgba(179,64,47,.10);color:' + FLAG + ';}#w121dr .w225ap.approved{background:rgba(42,140,122,.12);color:#155a4d;}' +
    '#w121dr .w225ap b{display:block;font-size:13px;margin-bottom:2px;}#w121dr .w225ap textarea{width:100%;margin-top:8px;min-height:54px;}' +
    '#w121dr .w225ap .ac{display:flex;gap:8px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;}' +
    '#w121dr .w225vt{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 8px;}' +
    '#w121dr .w225vt a{font-size:12px;font-weight:700;border-radius:999px;padding:5px 11px;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;}' +
    '#w121dr .w225vt a.on{background:' + GREEN + ';color:' + CREAM + ';}#w121dr .w225vt a i{font-style:normal;opacity:.6;margin-left:4px;}' +
    '#w121dr .w225vb{border:1px solid rgba(16,63,57,.12);border-radius:12px;padding:10px 12px;background:#FFFAF2;}' +
    '#w121dr .w225vb .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:8px;}' +
    '#w121dr .w225vb small,#w121dr .w225hint{display:block;font-size:11.5px;color:var(--wa-muted);line-height:1.4;margin-top:4px;}' +
    '#w121dr .w225chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}' +
    '#w121dr .w225chips span{font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;background:rgba(16,63,57,.07);color:' + GREEN + ';cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:5px;}' +
    '#w121dr .w225chips span i{width:8px;height:8px;border-radius:50%;display:inline-block;}' +
    '#w121dr .w225chips span.on{background:' + GREEN + ';color:' + CREAM + ';}' +
    '#w121dr .w225lib{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 0;}' +
    '#w121dr .w225lib select{font-size:12px;padding:5px 8px;border-radius:999px;border:1px solid rgba(16,63,57,.2);background:#FFFAF2;color:' + GREEN + ';max-width:220px;}' +
    '#w121dr .w225alt{border:1px solid rgba(16,63,57,.12);border-radius:12px;padding:10px;margin-top:10px;background:#FFFAF2;display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;}' +
    '#w121dr .w225alt .pic{position:relative;border-radius:10px;overflow:hidden;cursor:crosshair;align-self:start;}' +
    '#w121dr .w225alt .pic img{width:100%;display:block;}' +
    '#w121dr .w225alt .pic b{position:absolute;transform:translate(-50%,-50%);background:rgba(31,32,30,.82);color:#FFFAF2;font-size:10px;font-weight:700;border-radius:6px;padding:2px 6px;white-space:nowrap;pointer-events:none;}' +
    '#w121dr .w225alt textarea{min-height:64px;}' +
    '#w121dr .w225alt .tgs span{font-size:11.5px;background:rgba(16,63,57,.07);border-radius:999px;padding:3px 9px;margin:4px 4px 0 0;display:inline-block;cursor:pointer;}' +
    '#w121dr .th .altb{position:absolute;left:4px;bottom:30px;font-size:10px;font-weight:800;border-radius:6px;padding:2px 6px;border:none;background:rgba(31,32,30,.72);color:#FFFAF2;cursor:pointer;}' +
    '#w121dr .th .altb.ok{background:' + TEAL + ';}' +
    '#w121dr .w225man{border:1px dashed rgba(220,165,39,.7);border-radius:12px;padding:10px 12px;margin:8px 0 0;background:rgba(220,165,39,.08);font-size:12.5px;}' +
    '#w121dr .w225man .ac{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center;}' +
    '#w121dr .w225man input{flex:1;min-width:160px;}' +
    '#w121dr .w225rep{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:8px;margin-top:8px;}' +
    '#w121dr .mock.th3{font-size:13px;}#w121dr .mock .yt{background:#000;aspect-ratio:9/16;max-height:360px;display:flex;align-items:center;justify-content:center;color:#FFFAF2;}' +
    '#contentcal .st-appr{border-left-color:' + PURPLE + ';background:rgba(111,100,171,.10);}' +
    '#contentcal .pill.appr,#w121dr .pill.appr{background:rgba(111,100,171,.16);color:' + PURPLE + ';}' +
    '#contentcal .chips select{font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;border:1px solid rgba(16,63,57,.2);background:#FFFAF2;color:' + GREEN + ';}' +
    '@media (max-width:560px){#w121dr .w225alt{grid-template-columns:minmax(0,1fr);}#w121dr .w225vb .row{grid-template-columns:minmax(0,1fr);}}' +""")

open(P, 'w', encoding='utf8').write(s)
print('step 1-2 ok')
