#!/usr/bin/env python3
"""wave241 (15/10/26): the composer learns the Canva design link, the partner organization and the LinkedIn article, and
says that scheduling by someone who cannot publish goes to the approvers. Run once on the wave240 121 segment
(src/121_wave121.seg); kept for the record like patch121*.py."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, '..', 'src', '121_wave121.seg')
s = open(P, encoding='utf8').read()
if 'wave241' in s:
    print('already patched'); sys.exit(0)
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d of %r, found %d' % (count, old[:90], n))
    s = s.replace(old, new)

# 1. the edit model: canva_url, partner_id, article (format)
rep("""approval_status: 'none', approval_note: '', submitted_by: null, manualMap: {}, vtab: 'instagram', altIdx: null, apNote: '' };""",
    """approval_status: 'none', approval_note: '', submitted_by: null, manualMap: {}, vtab: 'instagram', altIdx: null, apNote: '',
      /* wave241 */ canva_url: '', partner_id: null, article: false };""")
rep("""approval_status: p.approval_status || 'none', approval_note: p.approval_note || '', submitted_by: p.submitted_by || null, manualMap: p.manual || {}, vtab: (p.platforms || [])[0] || 'instagram', altIdx: null, apNote: '' };""",
    """approval_status: p.approval_status || 'none', approval_note: p.approval_note || '', submitted_by: p.submitted_by || null, manualMap: p.manual || {}, vtab: (p.platforms || [])[0] || 'instagram', altIdx: null, apNote: '',
      /* wave241 */ canva_url: p.canva_url || '', partner_id: p.partner_id || null, article: p.format === 'article' };""")

# 2. the fields: the Canva link after the link section; the partner next to the campaign; the LinkedIn article switch
rep("""      '<div class="sec row2"><div><span class="lbl">Owner</span><select id="w121owner"'""",
    """      /* wave241: the Canva design, the partner organization, a LinkedIn article */
      '<div class="sec"><label>Canva design (optional)</label><div class="row2"><input type="url" id="w241canva" placeholder="https://www.canva.com/design/..." value="' + E(e.canva_url || '') + '"' + (ro ? ' disabled' : '') + '>' + (e.canva_url ? '<a class="btn mini ghost" href="' + E(e.canva_url) + '" target="_blank" rel="noopener" style="justify-self:start">Open in Canva</a>' : '<span class="w225hint" style="align-self:center">The design the post uses; the approvers see the link.</span>') + '</div></div>' +
      (e.platforms.indexOf('linkedin') >= 0 ? '<div class="sec"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="w241art"' + (e.article ? ' checked' : '') + (ro ? ' disabled' : '') + '> LinkedIn article</label><small class="w225hint">An article has a headline (the name above) and a long body (the caption). LinkedIn articles are posted by hand: the Hub reminds the owner at the time and asks for the link once it is up.</small></div>' : '') +
      '<div class="sec row2"><div><span class="lbl">Owner</span><select id="w121owner"'""")
# the partner select: a third column after the campaign (the row2 grid wraps it onto its own line)
rep("""      '<div class="sec"><label>Tags</label>' + tagsHtml(e, ro) + '</div>' +""",
    """      '<div class="sec"><label>Partner organization (optional)</label><select id="w241partner"' + (ro ? ' disabled' : '') + '><option value="">None</option>' + partnerOpts(e.partner_id) + '</select><small class="w225hint">Posts about a partner are found again under Library > By partner (a throwback, a recap, last year\\u2019s article).</small></div>' +
      '<div class="sec"><label>Tags</label>' + tagsHtml(e, ro) + '</div>' +""")

# 3. readForm and rowFromEdit
rep("""    if ((v = g('w225utm')) != null) e.utm_campaign = v.trim();""",
    """    if ((v = g('w225utm')) != null) e.utm_campaign = v.trim();
    /* wave241 */
    if ((v = g('w241canva')) != null) e.canva_url = v.trim();
    if ((v = g('w241partner')) != null) e.partner_id = v ? Number(v) : null;
    if ((v = c('w241art')) != null) e.article = v;""")
rep("""format: vids(e).length ? 'reel' : imgs(e).length > 1 ? 'carousel' : imgs(e).length ? 'post' : e.link_url ? 'link' : 'post',""",
    """format: e.article && e.platforms.indexOf('linkedin') >= 0 ? 'article' : vids(e).length ? 'reel' : imgs(e).length > 1 ? 'carousel' : imgs(e).length ? 'post' : e.link_url ? 'link' : 'post', canva_url: String(e.canva_url || '').trim() || null, partner_id: e.partner_id || null,""")

# 4. the partners list (wa_partners, loaded once with the composer's lists)
rep("""  function canPublish(pls) {""",
    """  /* wave241: the partner organizations (wa_partners), loaded once */
  var PARTNERS = null;
  function loadPartners() { if (PARTNERS) return Promise.resolve(PARTNERS); return db.from('wa_partners').select('id,name,status').order('name').then(function (r) { PARTNERS = ((r && r.data) || []).filter(function (x) { return x.status !== 'declined'; }); return PARTNERS; }).catch(function () { PARTNERS = []; return PARTNERS; }); }
  function partnerOpts(sel) { return (PARTNERS || []).map(function (x) { return '<option value="' + x.id + '"' + (String(sel || '') === String(x.id) ? ' selected' : '') + '>' + E(x.name) + '</option>'; }).join('') + (sel && !(PARTNERS || []).some(function (x) { return String(x.id) === String(sel); }) ? '<option value="' + E(String(sel)) + '" selected>Partner ' + E(String(sel)) + '</option>' : ''); }
  function canPublish(pls) {""")
rep("""  function paintDrawer() {""",
    """  function paintDrawer() {
    if (!PARTNERS) { loadPartners().then(function () { if (C.edit && document.getElementById('w121dr')) paintDrawer(); }); }""")

# 5. the footer for someone who cannot publish: scheduling goes to the approvers
rep("""      if (e.approval_status !== 'pending') parts += '<button class="btn mini go" data-w121save="submit"' + (bad ? ' disabled title="Fix the items marked \\u2715 first"' : '') + '>Send for approval</button>';""",
    """      if (e.approval_status !== 'pending') parts += '<button class="btn mini go" data-w121save="submit"' + (bad ? ' disabled title="Fix the items marked \\u2715 first"' : '') + (hasDate ? ' title="Keeps the date: once approved it is scheduled"' : '') + '>' + (hasDate ? 'Schedule for approval' : 'Send for approval') + '</button>';""")
rep("""        toastS('Sent for approval: the marketing leads and admins are told');""",
    """        toastS(e.date && e.time ? 'Sent for approval: the approvers are told; once approved it is scheduled for ' + niceDate(e.date) + ' at ' + e.time : 'Sent for approval: the approvers are told');""")

# 6. the preview: a LinkedIn article look
rep("""      var lt = cap + (e.link_url && cap.indexOf(e.link_url) < 0 ? '\\n\\n' + e.link_url : '');""",
    """      var lt = cap + (e.link_url && cap.indexOf(e.link_url) < 0 ? '\\n\\n' + e.link_url : '');
      if (e.article) html = '<div class="mock"><div class="mh"><span class="av">WA</span><div><b>Welfare Avenue</b><span>Article \\u00b7 ' + E(e.date ? niceDate(e.date) : 'Draft') + '</span></div></div>' + (im.length ? '<div class="grid one"><img src="' + E(im[0].url) + '" alt=""></div>' : '') + '<div class="mc"><b style="font-size:16px;display:block;margin:0 0 6px">' + E(e.title || 'Headline') + '</b>' + E(cap) + '</div></div>'; else""")

open(P, 'w', encoding='utf8').write(s)
print('121 patched for wave241', len(s))
