#!/usr/bin/env python3
"""wave225 step d: the composer (chunks in parts225/c121/*.js replace wave121's functions)."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(D, '..', 'src', '121_wave121.seg')
s = open(P, encoding='utf8').read()
if 'wave225d' in s: print('d already'); sys.exit(0)
def chunk(n): return open(os.path.join(D, 'c121', n), encoding='utf8').read()
def esc(src):
    out = []
    for ch in src:
        o = ord(ch)
        out.append(ch if o < 128 else ('\\u%04x' % o))
    return ''.join(out)
def span(start, end, new):
    global s
    a = s.index(start); b = s.index(end, a)
    s = s[:a] + esc(new) + s[b:]
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count: raise SystemExit('expected %d of %r, found %d' % (count, old[:100], n))
    s = s.replace(old, new)
span('  function blank(day) {', '  function openComposer(pOrDay, prefill) {', chunk('a_blank.js'))
span('  function validate(e) {', '  function linkify(s) {', chunk('b_validate.js'))
span('  function previewHtml(e) {', '  function ownerOpts(cur) {', chunk('c_preview.js'))
span('  function paintDrawer() {', '  async function markPosted() {', chunk('d_drawer.js'))
span('  async function ai(mode) {', '  /* ---------- routing, nav ---------- */', chunk('e_ai.js'))

# a template or the studio can open the composer with more than a title
rep("""    if (prefill) { if (prefill.title) C.edit.title = prefill.title; if (prefill.notes) C.edit.notes = prefill.notes; if (prefill.campaign) C.edit.campaign = prefill.campaign; if (prefill.slot) { var ns = nextSlotDate(prefill.slot); C.edit.date = ns.date; C.edit.time = ns.time; } C.edit.dirty = true; }""",
"""    if (prefill) { if (prefill.title) C.edit.title = prefill.title; if (prefill.notes) C.edit.notes = prefill.notes; if (prefill.campaign) C.edit.campaign = prefill.campaign; if (prefill.slot) { var ns = nextSlotDate(prefill.slot); C.edit.date = ns.date; C.edit.time = ns.time; }
      /* wave225d: the Content Studio's templates, queue and approvals open the composer with more */
      if (prefill.platforms) C.edit.platforms = prefill.platforms.slice(); if (prefill.caption != null) C.edit.caption = prefill.caption; if (prefill.first_comment != null) C.edit.first_comment = prefill.first_comment; if (prefill.tags) C.edit.tags = prefill.tags.slice(); if (prefill.variants) C.edit.variants = JSON.parse(JSON.stringify(prefill.variants)); if (prefill.date) { C.edit.date = prefill.date; C.edit.time = prefill.time || C.edit.time || '18:00'; }
      C.edit.dirty = true; }""")
# the platform toggle keeps the studio's order
rep("""if (i >= 0) ed.platforms.splice(i, 1); else ed.platforms.push(k); ed.platforms.sort(); ed.dirty = true; paintDrawer(); return; }""",
"""if (i >= 0) ed.platforms.splice(i, 1); else ed.platforms.push(k); ed.platforms.sort(function (a, b) { return PORDER.indexOf(a) - PORDER.indexOf(b); }); if (ed.platforms.indexOf(ed.vtab) < 0) ed.vtab = ed.platforms[0] || 'instagram'; ed.dirty = true; paintDrawer(); return; }""")
# new composer clicks: what reading needs (tabs, alt view, decisions, by-hand posting) before the read-only guard; edits after it
rep("""    if (readOnly() && !t.closest('[data-w121dup]') && !t.closest('[data-w121reopen]') && !t.closest('[data-w121tab]')) return;""",
"""    /* wave225d */
    if ((el = t.closest('[data-w225vtab]'))) { readForm(); ed.vtab = el.getAttribute('data-w225vtab'); ed.tab = ed.vtab; paintDrawer(); return; }
    if ((el = t.closest('[data-w225alt]'))) { e.preventDefault(); readForm(); var ai0 = Number(el.getAttribute('data-w225alt')); ed.altIdx = ed.altIdx === ai0 ? null : ai0; paintDrawer(); return; }
    if ((el = t.closest('[data-w225altx]'))) { readForm(); ed.altIdx = null; paintDrawer(); return; }
    if ((el = t.closest('[data-w225copy]'))) { var cpl = el.getAttribute('data-w225copy'); var ctext = capOf(ed, cpl); try { navigator.clipboard.writeText(ctext); toastS('Caption copied'); } catch (x) { window.prompt('Copy the caption', ctext); } return; }
    if ((el = t.closest('[data-w225mdone]'))) { e.preventDefault(); await markOne(el.getAttribute('data-w225mdone')); return; }
    if ((el = t.closest('[data-w225decide]'))) { e.preventDefault(); await decide(el.getAttribute('data-w225decide')); return; }
    if (readOnly() && !t.closest('[data-w121dup]') && !t.closest('[data-w121reopen]') && !t.closest('[data-w121tab]')) return;
    if ((el = t.closest('[data-w225tag]'))) { readForm(); var tn = el.getAttribute('data-w225tag'); var ti = (ed.tags || []).indexOf(tn); ed.tags = ed.tags || []; if (ti >= 0) ed.tags.splice(ti, 1); else ed.tags.push(tn); ed.dirty = true; paintDrawer(); return; }
    if ((el = t.closest('[data-w225tagadd]'))) { e.preventDefault(); readForm(); var nt = String((document.getElementById('w225newtag') || {}).value || '').trim().slice(0, 40); if (!nt) return; if ((C.tags || []).every(function (x) { return x.name.toLowerCase() !== nt.toLowerCase(); })) { try { var pal = ['#6F64AB', '#2A8C7A', '#DCA527', '#B3402F', '#B4467A', '#0A66C2', '#103F39']; var tr = await db.from('content_tags').insert({ name: nt, color: pal[(C.tags || []).length % pal.length], created_by: me() || 'staff' }).select('*').single(); if (tr.error) throw tr.error; C.tags.push(tr.data); } catch (x) { toastS('Could not add the tag: ' + (x.message || x)); return; } } else nt = C.tags.filter(function (x) { return x.name.toLowerCase() === nt.toLowerCase(); })[0].name; if ((ed.tags || []).indexOf(nt) < 0) (ed.tags = ed.tags || []).push(nt); ed.dirty = true; paintDrawer(); return; }
    if ((el = t.closest('[data-w225untag]'))) { readForm(); var mi = ed.media[ed.altIdx]; if (mi && mi.tags) { mi.tags.splice(Number(el.getAttribute('data-w225untag')), 1); ed.dirty = true; paintDrawer(); } return; }
    if ((el = t.closest('[data-w225pic]'))) { readForm(); var nm = String((document.getElementById('w225tagname') || {}).value || '').replace(/^@/, '').trim(); if (!nm) { toastS('Type the @username first, then click where they are'); var tnm = document.getElementById('w225tagname'); if (tnm) tnm.focus(); return; } var rc = el.getBoundingClientRect(); var mm = ed.media[Number(el.getAttribute('data-w225pic'))]; if (!mm) return; mm.tags = mm.tags || []; if (mm.tags.length >= 20) { toastS('Instagram takes 20 tags a photo'); return; } mm.tags.push({ username: nm, x: Math.max(0, Math.min(1, (e.clientX - rc.left) / rc.width)), y: Math.max(0, Math.min(1, (e.clientY - rc.top) / rc.height)) }); ed.dirty = true; paintDrawer(); return; }
    if ((el = t.closest('[data-w225altai]'))) { e.preventDefault(); await aiAlt(Number(el.getAttribute('data-w225altai'))); return; }
    if ((el = t.closest('[data-w225slot]'))) { readForm(); var qs0 = nextQueueSlot(ed.platforms); if (qs0) { ed.date = qs0.date; ed.time = qs0.time; ed.dirty = true; paintDrawer(); } return; }
    if ((el = t.closest('[data-w225tplsave]'))) { e.preventDefault(); readForm(); var tname = window.prompt('Name the template', ed.title || 'New template'); if (!tname) return; try { var row0 = rowFromEdit(ed); var ins = await db.from('content_snippets').insert({ kind: 'template', name: tname.slice(0, 80), body: row0.caption || '', data: { platforms: row0.platforms, first_comment: row0.first_comment, tags: row0.tags, variants: row0.variants, campaign: row0.campaign }, created_by: me() || 'staff' }).select('*').single(); if (ins.error) throw ins.error; C.lib.push(ins.data); toastS('Saved as a template'); paintDrawer(); } catch (x) { toastS('Could not save the template: ' + (x.message || x)); } return; }""")
# the selects in the composer
rep("""    if (t.id === 'w121date' || t.id === 'w121time' || t.id === 'w121link') { readForm(); C.edit.dirty = true; paintDrawer(); }""",
"""    if (t.id === 'w121date' || t.id === 'w121time' || t.id === 'w121link') { readForm(); C.edit.dirty = true; paintDrawer(); }
    /* wave225d */
    if (t.id === 'w225rep' || t.id === 'w225vkind' || t.id === 'w225vstf' || t.id === 'w225vprv') { readForm(); C.edit.dirty = true; paintDrawer(); return; }
    if (t.matches && t.matches('[data-w225hg]')) { readForm(); var g0 = (C.lib || []).filter(function (x) { return String(x.id) === String(t.value); })[0]; if (g0) { var tagsNew = (String(g0.body || '').match(/#[\\w\\u00c0-\\u024f]+/g) || []).filter(function (h) { return C.edit.caption.indexOf(h) < 0; }); if (tagsNew.length) { C.edit.caption = C.edit.caption.replace(/\\s+$/, '') + '\\n\\n' + tagsNew.join(' '); C.edit.dirty = true; } try { db.from('content_snippets').update({ uses: (g0.uses || 0) + 1 }).eq('id', g0.id); } catch (x) { /* fine */ } } paintDrawer(); return; }
    if (t.matches && t.matches('[data-w225tpl]')) { readForm(); var tp0 = (C.lib || []).filter(function (x) { return String(x.id) === String(t.value); })[0]; if (tp0) { if (C.edit.caption.trim() && !confirm('Replace the caption, platforms and tags with the template \\u201c' + tp0.name + '\\u201d?')) { paintDrawer(); return; } var dd = tp0.data || {}; C.edit.caption = tp0.body || ''; if (dd.platforms && dd.platforms.length) C.edit.platforms = dd.platforms.slice(); if (dd.first_comment != null) C.edit.first_comment = dd.first_comment || ''; if (dd.tags) C.edit.tags = dd.tags.slice(); if (dd.variants) C.edit.variants = JSON.parse(JSON.stringify(dd.variants)); if (dd.campaign && !C.edit.campaign) C.edit.campaign = dd.campaign; C.edit.dirty = true; try { db.from('content_snippets').update({ uses: (tp0.uses || 0) + 1 }).eq('id', tp0.id); } catch (x) { /* fine */ } } paintDrawer(); return; }""")
# the live caption counter: Instagram's cap
rep("""'</b> / 2,200 characters</span><span><b class="' + (tags > 30 ? 'bad' : '') + '">' + tags + '</b> / 30 hashtags</span><span>'""",
"""'</b> / 2,200 characters</span><span><b class="' + (tags > hashCap() ? 'bad' : '') + '">' + tags + '</b> / ' + hashCap() + ' hashtags on Instagram</span><span>'""")
# an API for the Content Studio app (parts225)
rep("""  window.w121Compose = function (prefill) { window.__w121prefill = prefill || null; location.hash = '#contentcal'; };""",
"""  window.w121Compose = function (prefill) { window.__w121prefill = prefill || null; location.hash = '#contentcal'; };
  /* wave225d: the Content Studio app reads the calendar's state and opens its composer */
  window.w121 = {
    posts: function () { return C.posts; }, banked: function () { return C.banked || []; }, cap: function () { return C.cap; }, pub: function () { return C.pub; },
    tags: function () { return C.tags; }, lib: function () { return C.lib; }, slots: function () { return C.slots; },
    load: function (force) { return load(force); }, loadCap: function () { return loadCap(); }, studio: function () { return loadStudio(); },
    stateOf: stateOf, modeOf: modeOf, nextSlot: nextQueueSlot, PL: PL, PORDER: PORDER, titleOf: titleOf, thumbOf: thumbOf,
    open: function (id) { var p = C.posts.filter(function (x) { return String(x.id) === String(id); })[0]; if (p) { openComposer(p); return true; } return false; },
    compose: function (prefill) { openComposer(null, prefill || null); }
  };""")
s = s.replace('/* wave225d: one list per platform', '/* wave225d: one list per platform', 1)
open(P, 'w', encoding='utf8').write(s); print('d ok')
