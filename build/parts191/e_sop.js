  /* ---------- the SOP page: stages, Hub-done badges, the Hub's proposals ---------- */
  function legendHtml() {
    var K = kidsOf(); var counts = {}; STAGES.forEach(function (s) { counts[s.k] = { n: 0, hub: 0 }; });
    tmpl().forEach(function (t) { if (t.active === false) return; var k = stageOfTmpl(t); if (!counts[k]) return; if (K[t.id] && K[t.id].length) return; counts[k].n++; if (t.hub_signal) counts[k].hub++; });
    return '<div id="w191legend">' + STAGES.map(function (s, i) { var c = counts[s.k]; return '<div class="lg"><b>' + (i + 1) + '. ' + E(s.l) + '</b><span>' + E(s.s) + ' · ' + E(s.when.toLowerCase()) + '</span><small>' + c.n + ' step' + (c.n === 1 ? '' : 's') + (c.hub ? ', ' + c.hub + ' by the Hub' : '') + '</small></div>'; }).join('') + '</div>';
  }
  function propHtml(t) {
    var p = t.proposal || {}; var retire = p.kind === 'retire';
    return '<div class="w191prop" data-w191prop="' + E(t.id) + '"><div class="k">' + (retire ? 'The Hub suggests retiring this step' : 'The Hub suggests new wording') + '</div>'
      + (retire ? '' : '<b>' + E(p.name || t.name) + '</b>' + (p.description ? '<p>' + E(p.description) + '</p>' : ''))
      + (p.why ? '<div class="why">' + E(p.why) + '</div>' : '')
      + (staff() ? '<div class="acts"><button class="w191btn gold" data-w191prop-act="approve">' + (retire ? 'Retire it' : 'Use this wording') + '</button><button class="w191btn ghost" data-w191prop-act="dismiss">Keep as is</button></div>' : '') + '</div>';
  }
  function decorateSop() {
    var sec = document.getElementById('volunteering'); if (!sec) return;
    if (typeof WA_VOL_VIEW === 'undefined' || WA_VOL_VIEW !== 'sop') return;
    var card = sec.querySelector('.card'); if (!card) return;
    var TM = tmap();
    /* the legend and the intro line, once per paint */
    if (!card.querySelector('#w191legend')) {
      var intro = card.querySelector('.vl-empty');
      var first = card.querySelector('details.vl-phase'); var anchor = card.querySelector('#w47roles') || card.querySelector('.wa24-links') || first;
      var box = document.createElement('div'); box.innerHTML = '<p id="w191sopintro">Every serving runs these steps in six stages. A step marked <span class="w191hub" style="margin:0;cursor:default">Hub</span> is ticked by the Hub itself when the thing it describes has happened (a confirmation, an itinerary sent, the WhatsApp link pasted); the rest are for a person. Where the Hub has replaced the old way of working it suggests new wording below the step: a leader approves it or keeps the step as it is.</p>' + legendHtml();
      if (intro) intro.textContent = String(intro.textContent || '').replace(/\s*Re-run the ClickUp import to pull changes across\.?/i, '').replace(/straight from the ClickUp list\.?/i, 'as the team wrote it.');
      if (anchor && anchor.parentNode === card) { card.insertBefore(box.firstChild, anchor); card.insertBefore(box.firstChild, anchor); }
      else if (first && first.parentNode) { first.parentNode.insertBefore(box.firstChild, first); first.parentNode.insertBefore(box.firstChild, first); }
    }
    card.querySelectorAll('.vl-step[data-vlstep^="tmpl-"]').forEach(function (el) {
      var id = el.getAttribute('data-vlstep').slice(5); var t = TM[id]; if (!t) return;
      var name = el.querySelector('.vl-name'); if (!name) return;
      if (!name.querySelector('.w191stg')) {
        var chip = document.createElement('span'); chip.className = 'w191stg'; chip.textContent = stageLabel(stageOfTmpl(t)); chip.title = 'The stage of the serving this step belongs to';
        var c = name.querySelector('.w26c'); if (c && c.nextSibling) name.insertBefore(chip, c.nextSibling); else name.insertBefore(chip, name.firstChild);
      }
      if (t.hub_signal && !name.querySelector('.w191hub')) { var b = document.createElement('span'); b.className = 'w191hub'; b.textContent = 'Hub'; b.title = t.hub_note || 'The Hub ticks this step by itself.'; var more = name.querySelector('.vl-more'); if (more) name.insertBefore(b, more); else name.appendChild(b); }
      if (t.hub_signal && t.hub_note && !el.querySelector('.w191hubnote')) { var n = document.createElement('span'); n.className = 'w191hubnote'; n.textContent = t.hub_note; name.appendChild(n); }
      var vt = el.querySelector('.vl-t'); var had = el.querySelector('.w191prop');
      if (t.proposal && vt && !had) vt.insertAdjacentHTML('beforeend', propHtml(t));
      else if (!t.proposal && had) had.remove();
    });
  }
  async function decideProposal(id, action, btn) {
    if (!staff()) return;
    var all = btn.closest('.w191prop').querySelectorAll('button'); all.forEach(function (b) { b.disabled = true; });
    try {
      var r = await db.rpc('wa191_sop_proposal', { p_id: id, p_action: action });
      if (r && r.error) { T(r.error.message || 'Could not save'); all.forEach(function (b) { b.disabled = false; }); return; }
      T(action === 'approve' ? ((r.data || {}).kind === 'retire' ? 'The step is retired' : 'The wording is updated on the master and every upcoming serving') : 'Kept as it is');
      try { WA_VOL_LOADED = false; await waVolLoad(true); } catch (e) { /* fine */ }
      if (typeof waVolRender === 'function') waVolRender();
    } catch (e) { T('Could not save'); all.forEach(function (b) { b.disabled = false; }); }
  }
  if (typeof waVolRenderSop === 'function') {
    var __sop191 = waVolRenderSop;
    waVolRenderSop = function () { var out = __sop191.apply(this, arguments); setTimeout(decorateSop, 140); setTimeout(decorateSop, 600); return out; };
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var a = t.closest('[data-w191prop-act]'); if (a) { e.preventDefault(); e.stopPropagation(); var box = a.closest('[data-w191prop]'); if (box) decideProposal(box.getAttribute('data-w191prop'), a.getAttribute('data-w191prop-act'), a); }
  }, true);
