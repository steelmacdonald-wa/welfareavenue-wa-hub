  /* ---------- the windows: one announcement, a short form, the answers, all of them ---------- */
  function wide(on) { var b = document.getElementById('modalBox'); if (b) b.classList.toggle('w180wide', !!on); }
  function openWin(html, isWide) { openModal('<div class="w180m">' + html + '</div>'); wide(isWide); }
  function setWin(html) { var m = document.querySelector('#modalBox .w180m'); if (m) m.innerHTML = html; }
  function headHtml(a) {
    var who = a.created_name || nameFor(a.created_by);
    return '<h3>' + E(a.title) + '</h3><p class="sub">From ' + E(who) + ' · ' + E(ago(a.created_at)) + ' · for ' + E(audienceLabel(a))
      + (a.ask && a.closes_at ? (closed(a) ? ' · closed ' : ' · closes ') + E(dayLabel(a.closes_at)) : '') + (a.anonymous ? ' · anonymous' : '') + '</p>'
      + (a.body ? '<p class="body" style="font-size:13.5px;line-height:1.5;white-space:pre-wrap;margin:0 0 10px">' + E(a.body) + '</p>' : '');
  }
  /* where it went: the Slack post and the email (the poster, leaders, HR and admins see it) */
  function deliveryHtml(a) {
    var bits = [], warn = false;
    if (a.post_slack) {
      var sl = a.slack || null, posts = sl && Array.isArray(sl.posts) ? sl.posts : [];
      if (!sl) bits.push('Slack: on its way');
      else if (posts.length) bits.push('Posted in ' + posts.map(function (p) { return '#' + p.channel; }).join(', '));
      else { warn = true; bits.push('Not posted in Slack' + (sl.errors && sl.errors[0] && sl.errors[0].error ? ': ' + sl.errors[0].error : '')); }
    }
    if (a.post_email) {
      var em = a.emailed || null, st = em && em.state, n = Number(em && em.sent) || 0, of = Number(em && em.to_count) || 0;
      if (!em || st === 'sending') bits.push('The email is going out' + (of ? ' to ' + plural(of, 'person', 'people') : ''));
      else if (st === 'sent') bits.push('Emailed to ' + plural(n, 'person', 'people'));
      else if (st === 'partly sent') { warn = true; bits.push('Emailed to ' + n + ' of ' + plural(of, 'person', 'people') + (em.failed && em.failed.length ? '; not to ' + em.failed.join(', ') : '')); }
      else if (st === 'skipped') { warn = true; bits.push('Not emailed: ' + (em.skipped || 'skipped')); }
      else { warn = true; bits.push('The email did not go out' + (em.error ? ': ' + String(em.error).slice(0, 140) : '')); }
    }
    return bits.length ? '<p class="w180sent' + (warn ? ' warn' : '') + '">' + E(bits.join(' · ')) + '</p>' : '';
  }
  function repaint(id) {
    paintCard();
    var a = byId(id); if (!a) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-w180slot="' + id + '"]'), function (el) { el.innerHTML = pollHtml(a) + (S.errs[a.id] ? '<p class="w180err">' + E(S.errs[a.id]) + '</p>' : ''); });
  }
  function openItem(id) {
    return load(false).then(function () { return loadOne(id); }).then(function (a) {
      return a && manages(a) ? delivery(a) : a;
    }).then(function (a) {
      if (!a) { T('That announcement is not for you, or it was taken down'); return; }
      if (a.ask && a.ask.type === 'form' && openAsk(a) && forMe(a) && !S.mine[a.id]) return openForm(a);
      if (a.ask && a.ask.type === 'form') return openResults(a);
      if (a.ask && manages(a) && !(openAsk(a) && forMe(a) && !S.mine[a.id])) return openResults(a);
      openWin(headHtml(a) + (manages(a) ? deliveryHtml(a) : '') + (a.ask ? '<div data-w180slot="' + E(a.id) + '">' + pollHtml(a) + '</div>' : '')
        + (a.link ? '<p><a class="w180lnk" href="' + E(a.link) + '"' + (/^https?:/i.test(a.link) ? ' target="_blank" rel="noopener"' : '') + '>Open the link</a></p>' : '')
        + '<div class="w180foot">' + (a.ask && manages(a) ? '<button type="button" class="w180btn ghost sm" data-w180res="' + E(a.id) + '">See the answers</button><span class="sp"></span>' : '') + '<button type="button" class="w180btn sm" data-w180close>Close</button></div>', false);
      if (a.ask && a.ask.type === 'poll' && (S.mine[a.id] || closed(a)) && !S.res[a.id]) results(a.id).then(function () { repaint(a.id); });
    });
  }

  /* a short form */
  function pillsHtml(qq, v) {
    var opts = qq.type === 'yesno' ? ['Yes', 'No'] : (qq.options || []), multi = qq.type === 'several';
    var cur = qq.type === 'yesno' ? (v === true ? [0] : v === false ? [1] : []) : (Array.isArray(v) ? v : (typeof v === 'number' ? [v] : []));
    return '<div class="w180opts" role="group" aria-labelledby="w180al_' + E(qq.id) + '">' + opts.map(function (o, i) {
      var on = cur.indexOf(i) >= 0;
      return '<button type="button" class="w180opt' + (on ? ' on' : '') + '" data-w180pick="' + E(qq.id) + '" data-i="' + i + '" data-multi="' + (multi ? 1 : 0) + '" aria-pressed="' + on + '">' + E(o) + '</button>';
    }).join('') + '</div>';
  }
  function qHtml(qq, v) {
    var id = 'w180a_' + qq.id, mark = qq.required ? '<span class="req" aria-hidden="true">*</span>' : '<span class="op">optional</span>';
    var lab = '<label class="l" id="w180al_' + E(qq.id) + '"' + (/^(short|long|date|number)$/.test(qq.type) ? ' for="' + id + '"' : '') + '>' + E(qq.label) + mark + (qq.type === 'several' ? '<span class="op">pick any</span>' : '') + '</label>';
    var inp;
    if (qq.type === 'short') inp = '<input type="text" id="' + id + '" data-w180q="' + E(qq.id) + '" maxlength="300" value="' + E(v || '') + '"' + (qq.required ? ' aria-required="true"' : '') + '>';
    else if (qq.type === 'long') inp = '<textarea id="' + id + '" data-w180q="' + E(qq.id) + '" maxlength="3000" rows="4"' + (qq.required ? ' aria-required="true"' : '') + '>' + E(v || '') + '</textarea>';
    else if (qq.type === 'date') inp = '<input type="date" id="' + id + '" data-w180q="' + E(qq.id) + '" value="' + E(v || '') + '" style="max-width:220px">';
    else if (qq.type === 'number') inp = '<input type="number" id="' + id + '" data-w180q="' + E(qq.id) + '" step="any" value="' + E(v == null ? '' : v) + '" style="max-width:220px">';
    else inp = pillsHtml(qq, v);
    return '<div class="w180ans">' + lab + inp + '</div>';
  }
  function openForm(a) {
    var qs = (a.ask && a.ask.questions) || [], who = first(a.created_name || nameFor(a.created_by));
    S.formId = a.id; S.formAns = JSON.parse(JSON.stringify(S.mine[a.id] || {}));
    openWin(headHtml(a) + '<form class="w180f" data-w180formbox="' + E(a.id) + '" novalidate>' + qs.map(function (qq) { return qHtml(qq, S.formAns[qq.id]); }).join('')
      + '<p class="w180err" data-w180ferr hidden></p>'
      + '<p class="w180names" style="font-size:12px;margin:14px 0 0">' + (a.anonymous ? 'Anonymous: ' + E(who) + ' sees the totals, not who answered what.' : E(who) + ' sees your name with your answers.') + (a.closes_at ? ' You can change them until ' + E(dayLabel(a.closes_at)) + '.' : ' You can change them later.') + '</p>'
      + '<div class="w180foot" style="margin-top:10px"><button type="button" class="w180btn ghost sm" data-w180close>Cancel</button><button type="submit" class="w180btn">' + (S.mine[a.id] ? 'Save my answers' : 'Send my answers') + '</button></div></form>', false);
  }
  function formValues(a) {
    var out = {}, qs = (a.ask && a.ask.questions) || [];
    qs.forEach(function (qq) {
      if (/^(short|long|date|number)$/.test(qq.type)) {
        var el = document.querySelector('#modalBox [data-w180q="' + qq.id + '"]'); if (!el) return;
        var v = String(el.value || '').trim(); if (!v) return;
        if (qq.type === 'number') { var n = Number(v); if (!isNaN(n)) out[qq.id] = n; } else out[qq.id] = v;
      } else if (S.formAns && S.formAns[qq.id] !== undefined && S.formAns[qq.id] !== null && !(Array.isArray(S.formAns[qq.id]) && !S.formAns[qq.id].length)) out[qq.id] = S.formAns[qq.id];
    });
    return out;
  }
  function submitForm(id) {
    var a = byId(id); if (!a) return;
    var vals = formValues(a), err = document.querySelector('#modalBox [data-w180ferr]');
    var miss = ((a.ask && a.ask.questions) || []).filter(function (qq) { return qq.required && vals[qq.id] === undefined; });
    if (miss.length) { if (err) { err.hidden = false; err.textContent = 'Please answer: ' + miss.map(function (qq) { return qq.label; }).join('; '); } return; }
    if (!Object.keys(vals).length) { if (err) { err.hidden = false; err.textContent = 'Answer at least one question.'; } return; }
    var btn = document.querySelector('#modalBox [data-w180formbox] button[type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    answer(id, vals).then(function () {
      closeModal(); T('Thanks, your answers are in'); delete S.errs[id]; paintCard();
    }, function (e) {
      if (btn) { btn.disabled = false; btn.textContent = S.mine[id] ? 'Save my answers' : 'Send my answers'; }
      if (err) { err.hidden = false; err.textContent = e.message; }
    });
  }

  /* the answers: the totals, who chose what (unless anonymous), the text answers, who has not answered, a CSV */
  function valText(qr, v) {
    if (qr.type === 'date') return dayLabel(String(v));
    return String(v);
  }
  function valsHtml(qr) {
    if (!Array.isArray(qr.values)) return '<p class="sub" style="margin:0">' + plural(Number(qr.count) || 0, 'answer') + '.</p>';
    if (!qr.values.length) return '<p class="sub" style="margin:0">No answers yet.</p>';
    return '<ul class="w180vals">' + qr.values.map(function (x) { return '<li>' + (x.name ? '<b>' + E(x.name) + '</b>' : '') + E(valText(qr, x.v)) + '</li>'; }).join('') + '</ul>';
  }
  function resultsHtml(a, r) {
    var h = headHtml(a), m = S.mine[a.id] || r.mine || null;
    if (!r.visible) {
      return h + '<p>' + (m ? 'Your answer is in.' : (closed(a) ? 'It closed before you answered.' : 'You have not answered yet.')) + (a.show_results ? '' : ' ' + E(first(a.created_name || nameFor(a.created_by))) + ' keeps the totals for now.') + '</p>'
        + '<div class="w180foot">' + (openAsk(a) && forMe(a) && a.ask.type === 'form' ? '<button type="button" class="w180btn gold sm" data-w180form="' + E(a.id) + '">' + (m ? 'Change my answers' : 'Answer') + '</button>' : '') + '<button type="button" class="w180btn sm" data-w180close>Close</button></div>';
    }
    if (r.manage) {
      var pc = r.audience ? Math.min(100, Math.round(100 * r.answered / r.audience)) : 0;
      h += '<div class="w180prog"><span><b>' + r.answered + '</b>' + (r.audience ? ' of ' + r.audience : '') + ' answered</span><span class="t"><i style="width:' + pc + '%"></i></span></div>' + (manages(a) ? deliveryHtml(a) : '');
    } else h += '<p class="sub">' + plural(r.answered, 'person has', 'people have') + ' answered.</p>';
    h += (r.questions || []).map(function (qr) {
      return '<div class="w180rq"><h4>' + E(qr.label) + '</h4>' + (qr.options ? barsHtml(qr, m ? m[qr.id] : undefined) : valsHtml(qr)) + '</div>';
    }).join('');
    if (r.manage) {
      if (a.anonymous) h += '<p class="sub">' + plural(Number(r.missing_count) || 0, 'person has', 'people have') + ' not answered yet. It is anonymous, so the names stay hidden.</p>';
      else if (r.missing && r.missing.length) h += '<details class="w180miss"><summary>' + r.missing.length + ' not answered yet</summary><p>' + E(r.missing.join(', ')) + '</p></details>';
      else if (r.audience) h += '<p class="sub">Everyone it is for has answered.</p>';
    }
    h += '<div class="w180foot">';
    if (openAsk(a) && forMe(a)) h += a.ask.type === 'form' ? '<button type="button" class="w180btn ghost sm" data-w180form="' + E(a.id) + '">' + (m ? 'Change my answers' : 'Answer') + '</button>' : '';
    if (r.manage && (mine(a) || isAdmin())) {
      if (Array.isArray(r.rows) && r.rows.length) h += '<button type="button" class="w180btn ghost sm" data-w180csv="' + E(a.id) + '">Download the answers (CSV)</button>';
      if (openAsk(a)) h += '<button type="button" class="w180btn ghost sm" data-w180shut="' + E(a.id) + '">Close the answers now</button>';
      if (live(a)) h += '<button type="button" class="w180btn ghost sm" data-w180down="' + E(a.id) + '">' + (S.busy['down' + a.id] ? 'Press again to take it down' : 'Take it down') + '</button>';
    } else if (r.manage && Array.isArray(r.rows) && r.rows.length) h += '<button type="button" class="w180btn ghost sm" data-w180csv="' + E(a.id) + '">Download the answers (CSV)</button>';
    h += '<span class="sp"></span><button type="button" class="w180btn sm" data-w180close>Close</button></div>';
    return h;
  }
  function openResults(a) {
    S.resId = a.id;
    openWin(headHtml(a) + '<p class="sub">Loading the answers…</p>', true);
    return Promise.all([results(a.id, true), manages(a) ? delivery(a) : null]).then(function (both) {
      var r = both[0];
      if (S.resId !== a.id) return;
      if (!r || !r.ok) { setWin(headHtml(a) + '<p class="w180err">' + E((r && r.error) || 'The answers did not load.') + '</p><div class="w180foot"><button type="button" class="w180btn sm" data-w180close>Close</button></div>'); return; }
      setWin(resultsHtml(a, r));
    });
  }
  function csvFor(a, r) {
    var qs = a.ask.type === 'poll' ? [{ id: 'choice', label: a.ask.question, type: a.ask.multi ? 'several' : 'one', options: a.ask.options }] : (a.ask.questions || []);
    var cell = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var head = (a.anonymous ? [] : ['Name']).concat(['Answered']).concat(qs.map(function (qq) { return qq.label; }));
    var lines = [head.map(cell).join(',')];
    (r.rows || []).forEach(function (row) {
      var ans = row.answers || {};
      var vals = qs.map(function (qq) {
        var v = ans[qq.id]; if (v === undefined || v === null) return '';
        if (qq.type === 'one') return (qq.options || [])[v] || '';
        if (qq.type === 'several') return (Array.isArray(v) ? v : [v]).map(function (i) { return (qq.options || [])[i]; }).filter(Boolean).join('; ');
        if (qq.type === 'yesno') return v === true ? 'Yes' : 'No';
        return String(v);
      });
      lines.push((a.anonymous ? [] : [row.name || '']).concat([String(row.at || '').slice(0, 16).replace('T', ' ')]).concat(vals).map(cell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }
  function downloadCsv(a) {
    var r = S.res[a.id]; if (!r || !r.rows) return;
    try {
      var blob = new Blob(['﻿' + csvFor(a, r)], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = todayIso() + ' - ' + String(a.title).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() + ' - answers.csv';
      document.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(url); link.remove(); }, 1500);
    } catch (e) { T('The download did not start'); }
  }

  /* every announcement this person may see */
  function rowHtml(a) {
    var st = !live(a) ? '<span class="w180chip">Taken down</span>' : !a.ask ? '' : closed(a) ? '<span class="w180chip">Closed</span>' : S.mine[a.id] ? '<span class="w180chip teal">You answered</span>' : forMe(a) ? '<span class="w180chip gold">To answer</span>' : '';
    return '<article class="w180it" data-w180open="' + E(a.id) + '" tabindex="0" role="button" aria-label="' + E(a.title) + '"><div class="top"><span class="who"><span class="w180av" aria-hidden="true">' + E(initials(a.created_name || nameFor(a.created_by))) + '</span><b>' + E(a.created_name || nameFor(a.created_by)) + '</b></span><span>' + E(ago(a.created_at)) + '</span><span class="w180chip purple">' + E(audienceLabel(a)) + '</span>' + (a.ask ? '<span class="w180chip gold">' + (a.ask.type === 'poll' ? 'Poll' : 'Short form') + '</span>' : '') + st + '</div><h4 style="margin-bottom:0">' + E(a.title) + '</h4></article>';
  }
  function openAll() {
    openWin('<h3>Announcements</h3><p class="sub">Loading…</p>', true);
    load(true).then(function () {
      var list = allList();
      setWin('<h3>Announcements</h3><p class="sub">' + (manager() ? 'Everything posted, newest first.' : 'What was posted for you, newest first.') + '</p><div class="w180all">'
        + (list.length ? list.map(rowHtml).join('') : '<p>Nothing posted yet.</p>') + '</div><div class="w180foot">' + (canPost() ? '<button type="button" class="w180btn ghost sm" data-w180post>Post an announcement</button>' : '') + '<span class="sp"></span><button type="button" class="w180btn sm" data-w180close>Close</button></div>');
    });
  }

