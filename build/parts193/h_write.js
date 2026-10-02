
  /* ---------- the grant writer (#fund/grants/write[/<draft>]) ---------- */
  function writerGrants() { return F.grants.filter(function (g) { return OPEN.concat(['watching', 'awarded', 'reporting']).indexOf(g.stage) >= 0; }).sort(function (a, b) { return OPEN.indexOf(b.stage) - OPEN.indexOf(a.stage) || String(grantTitle(a)).localeCompare(String(grantTitle(b))); }); }
  function parseQuestions(text) {
    return String(text || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = /\[(\d{2,5})\s*(?:words?|mots?)?\]\s*$/i.exec(l) || /\((\d{2,5})\s*(?:words?|mots?)\)\s*$/i.exec(l);
      return { q: l.replace(/\s*[\[(]\d{2,5}\s*(?:words?|mots?)?[\])]\s*$/i, '').replace(/^\d+[.)]\s*/, '').trim(), limit: m ? Number(m[1]) : null };
    }).filter(function (x) { return x.q; });
  }
  function questionsText(qs) { return (qs || []).map(function (x) { return x.q + (x.limit ? ' [' + x.limit + ']' : ''); }).join('\n'); }
  function factTitle(key) { var f = F.facts.filter(function (x) { return x.key === key; })[0]; return f ? f.title : key; }
  function factStatusOf(key) { var f = F.facts.filter(function (x) { return x.key === key; })[0]; return f ? f.status : ''; }
  function docTitle(id) { var d = byId(F.docs, id); return d ? d.title : 'document ' + id; }
  function writerHtml() {
    var W = F.writer, d = F.draft, busy = F.busy.write;
    var gs = writerGrants();
    var verified = F.facts.filter(function (f) { return f.status === 'verified'; }).length, check = F.facts.filter(function (f) { return f.status === 'needs_check'; }).length, conflict = F.facts.filter(function (f) { return f.status === 'conflict'; }).length;
    var html = gTabs() + '<div class="w193writer"><div class="w193stack"><div class="w193card w193form"><h3>' + (d ? 'This draft' : 'A new draft') + (d ? '<span class="sp"></span><a class="lnk" data-w193go="#fund/grants/write/new">start another</a>' : '') + '</h3>'
      + '<label>The grant</label><select data-w193wgrant="1"><option value="">No grant: a general draft</option>' + gs.map(function (g) { return '<option value="' + g.id + '"' + (String(W.grantId) === String(g.id) ? ' selected' : '') + '>' + E(grantTitle(g)) + ' (' + E((STAGE[g.stage] || {}).l || g.stage) + ')</option>'; }).join('') + '</select>'
      + '<label>Title</label><input type="text" data-w193wtitle="1" value="' + E(W.title || '') + '" placeholder="' + E(W.grantId && byId(F.grants, W.grantId) ? grantTitle(byId(F.grants, W.grantId)) : 'Draft') + '">'
      + '<div class="row"><div><label>Language</label><select data-w193wlang="1"><option value="en"' + (W.lang !== 'fr' ? ' selected' : '') + '>English</option><option value="fr"' + (W.lang === 'fr' ? ' selected' : '') + '>French</option></select></div><div><label>Status</label><div style="padding-top:8px">' + (d ? '<span class="w193pill" data-st="' + (d.status === 'final' ? 'awarded' : 'drafting') + '">' + E(d.status) + '</span>' : '<span class="w193empty">not saved yet</span>') + '</div></div></div>'
      + '<label>The funder’s questions</label><textarea data-w193wq="1" placeholder="One question per line. A word limit in brackets: What problem do you address? [250]" style="min-height:150px">' + E(W.text) + '</textarea><p class="hint">One per line, in the funder’s words. Add the word limit in brackets. Up to 25.</p>'
      + '<label>Notes for the writer</label><textarea data-w193wnotes="1" placeholder="The project, the amount, the angle, anything the answers must say or avoid">' + E(W.notes || '') + '</textarea>'
      + '<div class="acts">' + (canEdit() ? '<a class="w193btn' + (busy ? '" disabled' : '"') + ' data-w193wdraft="1">' + I('pen') + (busy === 'draft' ? 'Drafting…' : d ? 'Draft again' : 'Draft the answers') + '</a>' : '') + (d && canEdit() ? '<a class="w193btn ghost" data-w193wsave="1"' + (busy ? ' disabled' : '') + '>Save</a><a class="w193btn ghost" data-w193wreview="1"' + (busy ? ' disabled' : '') + '>' + (busy === 'review' ? 'Reviewing…' : 'Review it') + '</a>' : '') + '</div>'
      + (busy === 'draft' ? '<p class="hint">The assistant reads the fact base, the playbook and the closest past applications, then writes every answer. One to two minutes.</p>' : busy === 'review' ? '<p class="hint">A program officer’s read of the draft: a score per answer, what is weak, what is unsupported. About a minute.</p>' : '<p class="hint">The writer uses only verified facts (' + verified + ' now; ' + check + ' need a check' + (conflict ? ', ' + conflict + ' in conflict' : '') + ') and ' + F.docs.length + ' past applications and letters. Every number it cannot prove becomes a [confirm: …] placeholder.</p>')
      + '</div>';
    if (d) html += '<div class="w193card"><h3>Keep and share</h3><div class="w193acts" style="margin:0">' + '<a class="w193btn ghost sm" data-w193wcopy="1">' + I('copy') + 'Copy all the answers</a>' + (canEdit() ? '<a class="w193btn ghost sm" data-w193wdoc="1" title="Keeps the answers with the past applications the writer learns from">' + I('doc') + 'Save as a past application</a>' + (d.status !== 'final' ? '<a class="w193btn ghost sm" data-w193wfinal="1">' + I('check') + 'Mark final</a>' : '<a class="w193btn ghost sm" data-w193wreopen="1">Reopen</a>') : '') + (canDelete() ? '<a class="w193btn warn sm" data-w193wdel="1">Delete</a>' : '') + '</div>' + (d.grant_id ? '<p class="w193note">On the grant: <a class="w193lnk" data-w193go="#fund/grants/' + d.grant_id + '">' + E(byId(F.grants, d.grant_id) ? grantTitle(byId(F.grants, d.grant_id)) : 'open it') + '</a>.</p>' : '') + '</div>';
    html += '<div class="w193card"><h3>Your drafts</h3>' + (F.drafts.length ? '<ul class="w193list w193drafts">' + F.drafts.slice(0, 30).map(function (x) { return '<li data-w193go="#fund/grants/write/' + x.id + '"><div class="t"><b>' + E(x.title) + '</b><small>' + E((x.questions || []).length) + ' answer' + ((x.questions || []).length === 1 ? '' : 's') + ' · ' + E(x.lang === 'fr' ? 'French' : 'English') + ' · ' + E(x.status) + (x.updated_by ? ' · ' + E(String(x.updated_by).split('@')[0]) : '') + '</small></div><span class="when">' + E(fmtWhen(x.updated_at)) + '</span></li>'; }).join('') + '</ul>' : '<p class="w193empty">No draft yet.</p>') + '</div></div>';
    /* the answers */
    html += '<div>';
    if (!d) {
      html += '<div class="w193card"><h3>How the writer works</h3><p class="w193p">Paste the funder’s questions on the left, pick the grant, and the assistant drafts every answer in Welfare Avenue’s voice: plain, concrete, a number in every paragraph that makes a claim, within the word limit. It writes only from the fact base and from what we have sent funders before, and it marks what you must check. You edit the answers here, ask for a program officer’s review, then copy them into the funder’s form.</p>'
        + '<ul class="w193ul"><li><b>Verified facts</b> are used as written and cited under each answer.</li><li><b>Facts that need a check</b> can be used, with a warning naming them.</li><li><b>Figures in conflict</b> (the meals total, the volunteer count, the founding year) are never stated: the draft leaves a [confirm: …] placeholder.</li><li><b>Past applications</b> show how we answered before; the writer reuses what fits, in today’s words, and names them under the answer.</li><li>The rules come from the playbook: lead with the answer, mirror the funder’s words, outputs apart from outcomes, no jargon, no em dashes.</li></ul>'
        + '<div class="w193acts"><a class="w193btn ghost sm" data-w193go="#fund/grants/facts">' + I('star') + 'The fact base</a><a class="w193btn ghost sm" data-w193go="#fund/grants/playbook">' + I('book') + 'The playbook</a></div></div>';
    } else {
      var qs = d.questions || [];
      if (W.result && W.result.reviewer_note) html += '<div class="w193card" style="margin-bottom:12px"><h3>The writer’s note</h3><p class="w193p" style="margin:0">' + E(W.result.reviewer_note) + '</p>' + (W.result.consistency && W.result.consistency.length ? '<ul class="w193ul" style="margin-top:8px">' + W.result.consistency.map(function (c) { return '<li>' + E(c) + '</li>'; }).join('') + '</ul>' : '') + (W.result.cost ? '<p class="w193note">Model ' + E(W.result.model || '') + ', $' + Number(W.result.cost).toFixed(2) + '.</p>' : '') + '</div>';
      if (W.review) {
        var R = W.review;
        html += '<div class="w193card" style="margin-bottom:12px;border-color:rgba(200,122,47,.4)"><h3>The program officer’s review<span class="sp"></span><a class="lnk" data-w193wreviewx="1">hide</a></h3><p class="w193p">' + E(R.overall || '') + '</p>' + (R.missing && R.missing.length ? '<p class="w193p"><b>Missing:</b> ' + E(R.missing.join('; ')) + '</p>' : '') + (R.consistency && R.consistency.length ? '<p class="w193p"><b>Consistency:</b> ' + E(R.consistency.join('; ')) + '</p>' : '') + '</div>';
      }
      qs.forEach(function (x, i) {
        var over = x.limit && x.words > x.limit, rv = W.review && W.review.answers ? (W.review.answers[i] || W.review.answers.filter(function (a) { return a.q === x.q; })[0]) : null;
        html += '<div class="w193ans" data-w193ans="' + i + '"><div class="q"><span>' + (i + 1) + '. ' + E(x.q) + '</span>' + (x.limit ? '<small>' + x.limit + ' words</small>' : '') + '</div>'
          + '<textarea data-w193answer="' + i + '"' + (canEdit() ? '' : ' readonly') + '>' + E(x.answer || '') + '</textarea>'
          + '<div class="ft"><span class="cnt' + (over ? ' over' : '') + '" data-w193count="' + i + '">' + words(x.answer) + (x.limit ? ' of ' + x.limit : '') + ' words</span>' + (x.refs && x.refs.length ? '<span>· from ' + E(x.refs.map(docTitle).join(', ')) + '</span>' : '') + '</div>'
          + (x.facts && x.facts.length ? '<div class="facts">' + x.facts.map(function (k) { var st = factStatusOf(k); return '<span class="w193tag' + (st === 'verified' ? '' : '') + '" style="' + (st === 'needs_check' ? '--bg:rgba(220,165,39,.2);--ink:#6b4d05' : st === 'conflict' ? '--bg:rgba(179,64,47,.12);--ink:' + FLAG : '') + '" title="' + E(k) + '">' + E(factTitle(k)) + '</span>'; }).join('') + '</div>' : '')
          + (x.warnings && x.warnings.length ? '<div class="warn"><b>Check before sending:</b> ' + E(x.warnings.join(' · ')) + '</div>' : '')
          + (rv ? '<div class="warn" style="background:rgba(111,100,171,.1);color:#4a4180"><b>Review ' + E(rv.score) + '/10.</b> ' + E(rv.what_works || '') + (rv.what_is_weak ? ' <b>Weak:</b> ' + E(rv.what_is_weak) : '') + (rv.unsupported && rv.unsupported.length ? ' <b>Unsupported:</b> ' + E(rv.unsupported.join('; ')) : '') + (rv.suggestion ? ' <b>Do this:</b> ' + E(rv.suggestion) : '') + '</div>' : '')
          + '</div>';
      });
      if (d.notes && !W.result) html += '<div class="w193card"><h3>Notes on this draft</h3><p class="w193p" style="white-space:pre-wrap;margin:0;font-size:13px">' + E(d.notes) + '</p></div>';
    }
    html += '</div></div>';
    return html;
  }
  function readWriterForm() {
    var h = document.getElementById('w193host'); if (!h) return;
    var g = h.querySelector('[data-w193wgrant]'), t = h.querySelector('[data-w193wtitle]'), l = h.querySelector('[data-w193wlang]'), qq = h.querySelector('[data-w193wq]'), n = h.querySelector('[data-w193wnotes]');
    if (g) F.writer.grantId = g.value || null;
    if (t) F.writer.title = t.value;
    if (l) F.writer.lang = l.value;
    if (qq) F.writer.text = qq.value;
    if (n) F.writer.notes = n.value;
  }
  function readAnswers() {
    var d = F.draft; if (!d) return;
    (d.questions || []).forEach(function (x, i) { var ta = document.querySelector('#w193host [data-w193answer="' + i + '"]'); if (ta) { x.answer = ta.value; x.words = words(ta.value); } });
  }
  function openDraft(id) {
    var d = id ? byId(F.drafts, id) : null;
    F.draft = d ? JSON.parse(JSON.stringify(d)) : null;
    F.writer.review = null; F.writer.result = null;
    if (d) { F.writer.grantId = d.grant_id || null; F.writer.lang = d.lang || 'en'; F.writer.text = questionsText(d.questions); F.writer.title = d.title || ''; F.writer.notes = ''; }
    else if (!id) { F.writer.text = F.writer.text || ''; F.writer.title = ''; }
  }
  async function draftNow() {
    if (F.busy.write) return;
    readWriterForm();
    var qs = parseQuestions(F.writer.text);
    if (!qs.length) { toastS('Paste the funder’s questions first, one per line.'); return; }
    F.busy.write = 'draft'; paint();
    var r = await fn('grant-write', { action: 'draft', grant_id: F.writer.grantId ? Number(F.writer.grantId) : null, title: F.writer.title || null, lang: F.writer.lang, notes: F.writer.notes, questions: qs, draft_id: F.draft ? F.draft.id : null });
    F.busy.write = null;
    if (!r || r.ok === false || r.error) { toastS('The draft did not come back: ' + (r && r.error ? r.error : 'try again')); paint(); return; }
    await loadAll(true);
    F.draft = byId(F.drafts, r.draft_id) ? JSON.parse(JSON.stringify(byId(F.drafts, r.draft_id))) : { id: r.draft_id, title: r.title, lang: r.lang, questions: r.questions, status: 'draft', grant_id: F.writer.grantId };
    F.writer.result = { reviewer_note: r.reviewer_note, consistency: r.consistency, cost: r.cost, model: r.model };
    F.writer.review = null;
    toastS('Drafted ' + (r.questions || []).length + ' answers. Read every warning before you send.');
    if (location.hash !== '#fund/grants/write/' + r.draft_id) { F.sub = String(r.draft_id); history.replaceState(null, '', '#fund/grants/write/' + r.draft_id); }
    paint();
  }
  async function saveDraft(quiet) {
    var d = F.draft; if (!d) return false;
    readAnswers(); readWriterForm();
    var rec = { title: F.writer.title || d.title, lang: F.writer.lang || d.lang, questions: d.questions, grant_id: F.writer.grantId ? Number(F.writer.grantId) : null, status: d.status, updated_by: me().email };
    var r = await q(db.from('fund_drafts').update(rec).eq('id', d.id));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return false; }
    d.title = rec.title; d.lang = rec.lang; d.grant_id = rec.grant_id;
    var i = F.drafts.findIndex(function (x) { return String(x.id) === String(d.id); }); if (i >= 0) F.drafts[i] = JSON.parse(JSON.stringify(d));
    if (!quiet) toastS('Saved.');
    return true;
  }
  async function reviewNow() {
    if (F.busy.write || !F.draft) return;
    if (!(await saveDraft(true))) return;
    F.busy.write = 'review'; paint();
    var r = await fn('grant-write', { action: 'review', draft_id: F.draft.id });
    F.busy.write = null;
    if (!r || r.ok === false || r.error) { toastS('The review did not come back: ' + (r && r.error ? r.error : 'try again')); paint(); return; }
    F.writer.review = r.review || null; paint();
  }
  function copyAnswers() {
    var d = F.draft; if (!d) return; readAnswers();
    var text = (d.questions || []).map(function (x, i) { return (i + 1) + '. ' + x.q + (x.limit ? ' [' + x.limit + ' words]' : '') + '\n\n' + (x.answer || ''); }).join('\n\n\n');
    var done = function () { toastS('Copied: ' + (d.questions || []).length + ' answers.'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); }); return; } } catch (e) { /* fall through */ }
    fallbackCopy(text); done();
  }
  function fallbackCopy(text) { try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) { /* fine */ } }
  async function saveAsDocument() {
    var d = F.draft; if (!d) return; readAnswers();
    var g = d.grant_id ? byId(F.grants, d.grant_id) : null;
    var text = (d.questions || []).map(function (x) { return 'Q: ' + x.q + (x.limit ? ' [' + x.limit + ' words]' : '') + '\nA: ' + (x.answer || ''); }).join('\n\n');
    var r = await q(db.from('fund_documents').insert({ grant_id: d.grant_id || null, funder_id: g ? g.funder_id : null, title: d.title, kind: 'application', lang: d.lang || 'en', doc_date: ymd(today()), text: text, words: words(text), source: 'The grant writer (draft ' + d.id + ')', created_by: me().email }));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    if (d.grant_id) await q(db.from('fund_grant_log').insert({ grant_id: d.grant_id, who: me().email, kind: 'draft', text: 'Saved draft ' + d.id + ' as a past application (' + d.title + ').' }));
    await loadAll(true); paint(); toastS('Saved with the past applications: the writer learns from it now.');
  }
  async function setDraftStatus(st) {
    var d = F.draft; if (!d) return; d.status = st;
    if (await saveDraft(true)) { toastS(st === 'final' ? 'Marked final.' : 'Reopened.'); paint(); }
  }
  async function deleteDraft() {
    var d = F.draft; if (!d) return;
    var r = await q(db.from('fund_drafts').delete().eq('id', d.id));
    if (r.error) { toastS('Could not delete: ' + (r.error.message || r.error)); return; }
    F.draft = null; await loadAll(true); go('#fund/grants/write'); toastS('Deleted.');
  }

  /* ---------- the playbook (#fund/grants/playbook): markdown with tables ---------- */
  function inlineMd(s) {
    var h = E(s);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return h;
  }
  function mdToHtml(md) {
    var lines = String(md || '').replace(/\r/g, '').split('\n'), out = [], i = 0, toc = [];
    var slug = function (t) { return 'w193h-' + fold(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); };
    var closeList = function (L) { while (L.length) out.push(L.pop() === 'ol' ? '</ol>' : '</ul>'); };
    var L = [];
    while (i < lines.length) {
      var ln = lines[i];
      if (/^\s*$/.test(ln)) { closeList(L); i++; continue; }
      var hm = /^(#{1,4})\s+(.*)$/.exec(ln);
      if (hm) { closeList(L); var lvl = hm[1].length, t = hm[2].trim(), id = slug(t); if (lvl <= 2) toc.push({ id: id, t: t, lvl: lvl }); out.push('<h' + lvl + ' id="' + id + '">' + inlineMd(t) + '</h' + lvl + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { closeList(L); out.push('<hr>'); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        closeList(L);
        var cells = function (r) { return r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };
        var head = cells(ln); i += 2; var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<table><thead><tr>' + head.map(function (c) { return '<th>' + inlineMd(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inlineMd(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>');
        continue;
      }
      if (/^\s*>\s?/.test(ln)) { closeList(L); var qb = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { qb.push(lines[i].replace(/^\s*>\s?/, '')); i++; } out.push('<blockquote>' + inlineMd(qb.join(' ')) + '</blockquote>'); continue; }
      var lm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(ln);
      if (lm) {
        var kind = /\d/.test(lm[2]) ? 'ol' : 'ul', depth = Math.floor(lm[1].replace(/\t/g, '  ').length / 2) + 1;
        while (L.length > depth) out.push(L.pop() === 'ol' ? '</ol>' : '</ul>');
        while (L.length < depth) { L.push(kind); out.push(kind === 'ol' ? '<ol>' : '<ul>'); }
        var item = lm[3]; i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) { item += ' ' + lines[i].trim(); i++; }
        out.push('<li>' + inlineMd(item) + '</li>');
        continue;
      }
      closeList(L);
      var para = [ln.trim()]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && !/^\s*\|/.test(lines[i]) && !/^\s*>/.test(lines[i])) { para.push(lines[i].trim()); i++; }
      out.push('<p>' + inlineMd(para.join(' ')) + '</p>');
    }
    closeList(L);
    return { html: out.join('\n'), toc: toc };
  }
  function playbookHtml() {
    var P = setting('playbook') || {}, md = String(P.markdown || '');
    if (!md) return gTabs() + '<div class="w193card"><p class="w193empty">The playbook is not written yet.</p></div>';
    var r = mdToHtml(md);
    var html = gTabs() + '<div class="w193side"><div class="w193card"><div class="w193md">' + r.html + '</div>' + (P.written ? '<p class="w193note">Written ' + E(fmtDate(P.written)) + ' from the sector’s guidance and our own record; the full sources are at the end.' + (isLeader() ? ' Leaders change it in the database (fund_settings.playbook) for now.' : '') + '</p>' : '') + '</div>'
      + '<div class="w193stack"><div class="w193card w193toc"><h3>On this page</h3>' + r.toc.filter(function (t) { return t.lvl === 2; }).map(function (t) { return '<a data-w193anchor="' + t.id + '">' + E(t.t.replace(/^\d+\.\s*/, '')) + '</a>'; }).join('') + '</div>'
      + '<div class="w193card"><h3>Use it</h3><ul class="w193ul"><li><b>Screen a grant</b> in its sheet: Score the fit runs the gates and the seven dimensions for you.</li><li><b>Draft</b> in the writer: the rules and the section skeletons are in the prompt.</li><li><b>Keep the pipeline</b> at eight to twelve applications a year, with three in the pipeline for every one you need to win.</li></ul></div></div></div>';
    return html;
  }

  /* ---------- the fact base (#fund/grants/facts) ---------- */
  function factsHtml() {
    var FL = F.filters, qq = fold(FL.q);
    var list = F.facts.filter(function (f) { return (!FL.fstatus || f.status === FL.fstatus) && (!FL.fcat || f.category === FL.fcat) && (!qq || qq.split(/\s+/).every(function (w) { return fold([f.title, f.body, f.key, f.source, f.notes].join(' ')).indexOf(w) >= 0; })); });
    var counts = {}; F.facts.forEach(function (f) { counts[f.status] = (counts[f.status] || 0) + 1; });
    var html = gTabs() + '<div class="w193bar"><div class="w193seg">' + [['', 'All'], ['verified', 'Verified'], ['needs_check', 'Needs a check'], ['conflict', 'In conflict'], ['retired', 'Retired']].map(function (x) { return '<a data-w193fstatus="' + x[0] + '" class="' + (FL.fstatus === x[0] ? 'on' : '') + '">' + E(x[1]) + (x[0] ? ' <span class="n">' + (counts[x[0]] || 0) + '</span>' : '') + '</a>'; }).join('') + '</div>'
      + '<input type="search" placeholder="Search the facts…" value="' + E(FL.q) + '" data-w193q="1" aria-label="Search the facts">'
      + '<select data-w193fcat="1" aria-label="Category"><option value="">Every category</option>' + FACT_CATS.map(function (c) { return '<option value="' + c[0] + '"' + (FL.fcat === c[0] ? ' selected' : '') + '>' + E(c[1]) + '</option>'; }).join('') + '</select>'
      + '<span class="sp"></span>' + (canEdit() ? '<a class="w193btn sm" data-w193factadd="1">' + I('plus') + 'Add a fact</a>' : '') + '</div>';
    if (counts.conflict) html += '<div class="w193card" style="margin-bottom:14px;border-color:rgba(179,64,47,.3)"><p class="w193empty"><b>' + counts.conflict + ' fact' + (counts.conflict > 1 ? 's are' : ' is') + ' in conflict:</b> the documents disagree, so the writer never states those numbers. Settle each one (the sheet shows what the sources say), then mark it verified.</p></div>';
    html += '<div class="w193facts">';
    FACT_CATS.forEach(function (c) {
      var rows = list.filter(function (f) { return f.category === c[0]; }); if (!rows.length) return;
      html += '<div class="w193card"><h3>' + E(c[1]) + '<span class="sp"></span><span class="lnk">' + rows.length + '</span></h3>' + rows.map(function (f) {
        var st = FACT_ST[f.status] || FACT_ST.needs_check;
        return '<div class="w193fact" data-w193fact="' + f.id + '"><div class="k">' + E(f.title) + '<span class="w193pill ' + (f.status === 'verified' ? 'v' : f.status === 'conflict' ? 'x' : f.status === 'retired' ? 'r' : 'c') + '">' + E(st[0]) + '</span><code>' + E(f.key) + '</code></div><div class="acts">' + (canEdit() ? '<a class="w193btn ghost sm" data-w193factedit="' + f.id + '">' + I('pen') + 'Edit</a>' + (f.status !== 'verified' && f.status !== 'retired' ? '<a class="w193btn ghost sm" data-w193factok="' + f.id + '">' + I('check') + 'Verified</a>' : '') : '') + '</div><div class="b">' + E(f.body) + '</div>' + (f.body_fr ? '<div class="b" style="color:var(--wa-muted)">FR: ' + E(f.body_fr) + '</div>' : '') + '<div class="src">' + (f.source ? 'Source: ' + E(f.source) : '') + (f.verified_on ? ' · verified ' + E(fmtDate(f.verified_on)) + (f.verified_by ? ' by ' + E(String(f.verified_by).split('@')[0]) : '') : '') + (f.notes ? ' · ' + E(f.notes) : '') + '</div></div>';
      }).join('') + '</div>';
    });
    html += '</div>';
    if (!list.length) html += '<div class="w193card"><p class="w193empty">Nothing matches.</p></div>';
    return html;
  }
  async function verifyFact(id) {
    var f = byId(F.facts, id); if (!f) return;
    var r = await q(db.from('fund_facts').update({ status: 'verified', verified_on: ymd(today()), verified_by: me().email, updated_by: me().email }).eq('id', id));
    if (r.error) { toastS('Could not save: ' + (r.error.message || r.error)); return; }
    f.status = 'verified'; f.verified_on = ymd(today()); f.verified_by = me().email; paint(); toastS('Marked verified.');
  }
