  /* ---------- wave191p: choose your servings in the onboarding ----------
     Steel (01/10/26): "in the onboarding, I want onboardees to view the next upcoming volunteering events and select 1 or more
     so that they have confirmed date and to communicate with the operations manager"; volunteering is "required 4 times a
     year". Week 3's lesson (a 'servings' block, wave122) and Week 3's page in the onboarding journey (wave167) carry a
     placeholder (.w191onb); this fills it: how many servings this fiscal year of the four, the next six servings (the ones
     they are on already say so), what they would like to do, a message for the operations lead, Confirm my servings
     (wa191_onb_signup: Confirmed on each, a Request to Operations Montreal with the dates and the message, their onboarding
     step ticked). Team members only. */
  var ONB = { data: null, at: 0, busy: false, err: '', done: null, pick: {}, role: 'server', msg: '' };
  var ONB_ROLES = [['server', 'Serve', 'Set up, serve the meal, pack up'], ['photographer', 'Take photos', 'Capture the day for our stories']];
  function onbFmt(iso) { try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }); } catch (e) { return String(iso); } }
  function onbMonth(iso) { try { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', year: 'numeric' }); } catch (e) { return String(iso); } }
  async function onbLoad(force) {
    if (!force && ONB.data && Date.now() - ONB.at < 30000) return ONB.data;
    try { var r = await db.rpc('wa191_onb_servings'); if (r && r.error) { ONB.err = /Team members only/.test(r.error.message || '') ? 'team' : 'load'; } else if (r) { ONB.data = r.data; ONB.err = ''; } } catch (e) { ONB.err = 'load'; }
    ONB.at = Date.now();
    return ONB.data;
  }
  function onbHtml() {
    var x = ONB.data;
    if (ONB.err === 'team') return '<p class="w191om">Choosing servings here is for team members. Your lead can put you on one.</p>';
    if (!x) return '<p class="w191om">' + (ONB.err ? 'The servings could not load. Try again in a moment.' : 'Loading the next servings…') + '</p>';
    var ops = x.ops && x.ops.name ? x.ops.name : 'the operations team', opsT = x.ops && x.ops.title ? x.ops.title : 'Operations, Montreal';
    var yr = x.year || { done: 0, target: 4 }, pct = Math.min(100, Math.round(100 * (yr.done || 0) / (yr.target || 4)));
    var h = '<div class="yr"><div><b>Your servings this year</b><small>' + E(onbMonth(yr.from) + ' to ' + onbMonth(yr.to)) + '</small></div><span class="n"><b>' + (yr.done || 0) + '</b> of ' + (yr.target || 4) + '</span><i><s style="width:' + pct + '%"></s></i></div>';
    if (ONB.done) {
      return h + '<div class="okb"><b>You are confirmed for ' + E(ONB.done.dates || '') + '.</b><span>' + E(ops) + ' has your message in the Operations Montreal inbox' + (ONB.done.step ? ', and your step Mandatory volunteering is done.' : '.') + ' Thank you for showing up for our community.</span></div>'
        + '<button class="w191btn ghost" data-w191onb="more">Choose more servings</button>';
    }
    var sv = x.servings || [];
    if (!sv.length) return h + '<p class="w191om">No servings are open right now. ' + E(ops) + ' adds the next ones soon; come back to this page.</p>';
    h += '<div class="sl">' + sv.map(function (s) {
      var mine = s.mine && s.mine.confirmed; var on = !!ONB.pick[s.id];
      return '<label class="sv' + (mine ? ' mine' : on ? ' on' : '') + '"><input type="checkbox" data-w191onbev="' + s.id + '"' + (mine ? ' checked disabled' : on ? ' checked' : '') + '>'
        + '<span class="d"><b>' + E(onbFmt(s.date)) + '</b><small>' + E((s.start ? hm12(s.start) + ' · ' : '') + (s.location || 'Montreal') + (s.partner ? ' · with ' + s.partner : '') + (s.title && !s.partner ? ' · ' + s.title : '')) + '</small>'
        + (mine ? '<span class="st">You are on it</span>' : '') + '</span></label>';
    }).join('') + '</div>';
    h += '<div class="lbl">What would you like to do?</div><div class="roles">' + ONB_ROLES.map(function (r) { return '<label class="' + (ONB.role === r[0] ? 'on' : '') + '"><input type="radio" name="w191onbrole" value="' + r[0] + '"' + (ONB.role === r[0] ? ' checked' : '') + '><b>' + E(r[1]) + '</b><small>' + E(r[2]) + '</small></label>'; }).join('') + '</div>'
      + '<div class="lbl">A message for ' + E(ops) + ' <span>(' + E(opsT) + ', optional)</span></div><textarea data-w191onbmsg="1" maxlength="1500" placeholder="Hi ' + E(ops) + ', I am ' + E((x.me && x.me.name) || '') + ', new on the team. Anything I should know before my first serving?">' + E(ONB.msg || '') + '</textarea>'
      + (ONB.err && ONB.err !== 'load' ? '<div class="er">' + E(ONB.err) + '</div>' : '')
      + '<div class="ac"><button class="w191btn gold" data-w191onb="go"' + (ONB.busy ? ' disabled' : '') + '>' + (ONB.busy ? 'Confirming…' : 'Confirm my servings') + '</button><span>They are confirmed right away, and ' + E(ops) + ' gets your message with the dates.</span></div>';
    return h;
  }
  function onbPaint() {
    document.querySelectorAll('.w191onb').forEach(function (el) {
      var ta = el.querySelector('[data-w191onbmsg]'); if (ta && document.activeElement === ta) return;   /* never under the cursor */
      var html = onbHtml(); if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
      el.classList.add('on');
    });
  }
  async function onbFill() {
    var els = document.querySelectorAll('.w191onb:not(.on)'); if (!els.length) return;
    els.forEach(function (el) { el.classList.add('on'); el.innerHTML = onbHtml(); el.__h = el.innerHTML; });
    await onbLoad(false); onbPaint();
  }
  async function onbGo() {
    if (ONB.busy) return;
    var ids = Object.keys(ONB.pick).filter(function (k) { return ONB.pick[k]; }).map(Number);
    if (!ids.length) { ONB.err = 'Choose at least one serving.'; onbPaint(); return; }
    ONB.busy = true; ONB.err = ''; onbPaint();
    try {
      var r = await db.rpc('wa191_onb_signup', { p_events: ids, p_role: ONB.role, p_message: ONB.msg || '' });
      if (r.error) throw r.error;
      ONB.done = { dates: (r.data && r.data.dates) || '', step: !!(r.data && r.data.step) }; ONB.pick = {}; ONB.msg = '';
      T('You are confirmed. Thank you!');
      await onbLoad(true);
    } catch (e) { ONB.err = String((e && e.message) || e).replace(/^.*?ERROR:\s*/, '').slice(0, 200) || 'Could not confirm. Try again.'; }
    ONB.busy = false; onbPaint();
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.w191onb')) return;
    if (t.getAttribute('data-w191onbev')) { ONB.pick[t.getAttribute('data-w191onbev')] = t.checked; var l = t.closest('label'); if (l) l.classList.toggle('on', t.checked); if (ONB.err) { ONB.err = ''; onbPaint(); } }
    if (t.name === 'w191onbrole') { ONB.role = t.value; t.closest('.roles').querySelectorAll('label').forEach(function (l) { l.classList.toggle('on', !!l.querySelector('input:checked')); }); }
  });
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.getAttribute && t.getAttribute('data-w191onbmsg')) ONB.msg = t.value; });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('.w191onb [data-w191onb]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.getAttribute('data-w191onb') === 'go') onbGo();
    if (b.getAttribute('data-w191onb') === 'more') { ONB.done = null; onbPaint(); }
  }, true);
  try { new MutationObserver(function () { if (ONB.pend) return; ONB.pend = setTimeout(function () { ONB.pend = null; if (document.querySelector('.w191onb:not(.on)')) onbFill(); }, 150); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* fine */ }
