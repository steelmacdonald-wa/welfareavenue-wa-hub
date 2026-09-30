  /* ---------- the preview: the onboarding as a new person sees it on day one, or as someone on the board sees theirs ---------- */
  var PV = { from: null };
  /* a new person who started today, with no name and nothing done yet (the journey greets them as "friend") */
  function sampleOnb() { return { id: SAMPLE_ID, person_name: '', member_id: null, started_at: todayIso() + 'T09:00:00', status: 'active', completed_at: null }; }
  /* their plan: every step of the master, due as the database would set it (onb_due) */
  function sampleSteps() {
    var m = {}, today = todayIso();
    try {
      (WA37.tmpl || []).forEach(function (t) {
        if (t.active === false) return;
        m[t.id] = { id: 'w169s-' + t.id, onboarding_id: SAMPLE_ID, template_id: t.id, done: false, done_at: null, done_by: null, due_date: addDays(today, daysOf(t.section)) };
      });
    } catch (e) { /* none */ }
    return m;
  }
  var __sf169 = (typeof wa37StepsFor === 'function') ? wa37StepsFor : null;
  if (__sf169) wa37StepsFor = function (onbId) { if (String(onbId) === SAMPLE_ID) return sampleSteps(); return __sf169.apply(this, arguments); };

  function preview(id) {
    if (!canAssign()) { T('Only HR, leaders and admins can preview the onboarding'); return; }
    var o = null;
    if (String(id) === SAMPLE_ID) o = sampleOnb();
    else { try { o = (WA37.onbs || []).filter(function (x) { return String(x.id) === String(id); })[0] || null; } catch (e) { o = null; } }
    if (!o) { T('That onboarding is not here any more'); return; }
    var h = location.hash || '';
    PV.from = h && h.indexOf('#training') !== 0 ? h : '#hrcentre/onboarding';
    window.__w169view = o;
    document.body.classList.add('w169pvon');
    try { var st = window.w167 && w167.state ? w167.state() : null; if (st) { st.onb = null; st.wk = null; } } catch (e) { /* fine */ }
    if (h === '#training/onboarding') { try { if (typeof applyHash === 'function') applyHash(); } catch (e) { /* fine */ } }
    else location.hash = '#training/onboarding';
  }
  function endPreview(back) {
    if (!window.__w169view) return;
    window.__w169view = null;
    document.body.classList.remove('w169pvon');
    try { var st = window.w167 && w167.state ? w167.state() : null; if (st) { st.onb = null; st.wk = null; } } catch (e) { /* fine */ }
    var to = PV.from; PV.from = null;
    if (back && to && (location.hash || '') !== to) location.hash = to;
  }
  /* leaving the plan ends the preview; closing it goes back to where it was opened (the HR centre) */
  window.addEventListener('hashchange', function () {
    if (!window.__w169view) return;
    var h = location.hash || '';
    if (h === '#training/onboarding') return;
    endPreview(h === '#training' || h === '' || h === '#');
  });
  function bannerHtml() {
    var o = window.__w169view; if (!o) return '';
    var sample = String(o.id) === SAMPLE_ID;
    return '<div class="w169pv" role="status"><span><b>Preview</b> · ' + (sample ? 'what a new person sees on their first day in the Avenue Academy.' : 'what ' + E(first(o.person_name) || 'they') + ' sees in the Avenue Academy today.')
      + ' Read only: nothing is ticked or sent from here.</span><button type="button" data-w169pvx="1">Back to the ' + (sample ? 'master onboarding' : 'HR centre') + '</button></div>';
  }
