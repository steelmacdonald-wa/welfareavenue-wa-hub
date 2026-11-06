
  /* ---------- the data: one call, kept a minute ---------- */
  async function load(force) {
    if (!force && S.data && Date.now() - S.at < 60000) return S.data;
    if (S.loading) return S.loading;
    S.loading = (async function () {
      try {
        var r = await db.rpc('wa290_home_servings');
        if (r && !r.error) S.data = r.data || { show: false };
        else if (!S.data) S.data = { show: false, why: 'error' };
      } catch (e) { if (!S.data) S.data = { show: false, why: 'error' }; }
      S.at = Date.now(); S.loading = null;
      return S.data;
    })();
    return S.loading;
  }

  /* ---------- the card ---------- */
  /* one serving row, shared with the Sign up pop-up (c_next.js): pick = the ticked ids, attr = the data attribute its box carries */
  function rowHtml(s, pick, attr) {
    pick = pick || S.pick; attr = attr || 'data-w290ev';
    var mine = !!(s.mine && s.mine.confirmed), on = !mine && !!pick[s.id];
    var meta = (s.start ? hm12(s.start) + ' · ' : '') + (s.location || 'Montreal') + (s.partner ? ' · with ' + s.partner : '');
    return '<label class="sv' + (mine ? ' mine' : on ? ' on' : '') + '"><input type="checkbox" ' + attr + '="' + Number(s.id) + '"' + (mine ? ' checked disabled' : on ? ' checked' : '') + '>'
      + '<span class="d"><b>' + E(fmtDay(s.date)) + '</b><small>' + E(meta) + '</small></span>'
      + (mine ? '<span class="st">You’re on it</span>' : '') + '</label>';
  }
  function html() {
    var x = S.data; if (!x || !x.show) return '';
    var yr = x.year || {}, target = Number(yr.target || 4) || 4, done = Math.max(0, Number(yr.done || 0));
    var until = fmtMonthDay(yr.to), ops = (x.ops && x.ops.name) || 'the operations team';
    var ok = S.done ? '<div class="ok" role="status"><b>You’re confirmed for ' + E(S.done.dates || 'your servings') + '.</b> ' + E(ops) + ' has the dates in the Operations Montreal inbox.</div>' : '';
    var h = '<div class="k">Your servings · until ' + E(until) + '</div>';
    if (x.state === 'thanks') {
      return h + '<h3 id="w290h">' + Math.min(done, target) + ' of ' + target + '. Thank you!</h3>'
        + '<div class="bar" aria-hidden="true"><i style="width:100%"></i></div>' + ok
        + '<p>That’s your ' + word(target) + ' servings for the year. Thank you for showing up for our community.</p>';
    }
    var left = Math.max(0, target - done), pct = Math.min(100, Math.round(100 * done / target));
    h += '<h3 id="w290h">' + done + ' of ' + target + ' this year</h3>'
      + '<div class="bar" role="progressbar" aria-label="Your servings this year" aria-valuemin="0" aria-valuemax="' + target + '" aria-valuenow="' + Math.min(done, target) + '"><i style="width:' + pct + '%"></i></div>'
      + ok
      + '<p class="sub">' + (done === 0 ? 'Every member volunteers at ' + word(target) + ' servings a year, October to September.' : (left === 1 ? 'One more' : Word(left) + ' more') + ' before ' + E(until) + '.') + ' Pick the dates that work for you.</p>';
    var sv = x.servings || [];
    if (!sv.length) return h + '<p class="sub">No servings are open right now. ' + E(ops) + ' adds the next ones soon.</p>';
    h += '<div class="sl" role="group" aria-labelledby="w290h">' + sv.map(function (s) { return rowHtml(s); }).join('') + '</div>';
    if (!sv.some(function (s) { return !(s.mine && s.mine.confirmed); })) return h + '<p class="sub">You’re on every open serving. ' + E(ops) + ' adds the next ones soon.</p>';
    h += '<fieldset class="roles"><legend>What would you like to do?</legend>' + ROLES.map(function (r) {
      var on = S.role === r[0];
      return '<label class="' + (on ? 'on' : '') + '"><input type="radio" name="w290role" value="' + r[0] + '"' + (on ? ' checked' : '') + '>' + E(r[1]) + '</label>';
    }).join('') + '</fieldset>';
    if (S.err) h += '<p class="er" role="alert">' + E(S.err) + '</p>';
    h += '<div class="ac"><button type="button" class="go" data-w290go="1"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Confirming…' : 'Confirm my servings') + '</button>'
      + '<span class="note">You’re confirmed right away, and ' + E(ops) + ' gets the dates.</span></div>';
    return h;
  }

  /* appended to #mpBody: order 14 (b_home.js) and coming after wave171's card in the page put it right after the Next serving card
     (wave171 inserts its card near the top of #mpBody, never at the end) */
  function place(focusSel) {
    var body = document.getElementById('mpBody'), el = document.getElementById('w290srv'), h = html();
    if (!h || !body) { if (el) el.remove(); return; }
    addCss();
    if (!el) { el = document.createElement('section'); el.id = 'w290srv'; el.setAttribute('aria-labelledby', 'w290h'); }
    if (el.parentNode !== body) body.appendChild(el);
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    if (focusSel) { var f = el.querySelector(focusSel); if (f) { if (!f.matches('button,input')) f.setAttribute('tabindex', '-1'); try { f.focus(); } catch (e) { /* fine */ } } }
  }
  async function paint(force) {
    if (!staff() || board()) { var x = document.getElementById('w290srv'); if (x) x.remove(); return; }
    var home = document.getElementById('mypage');
    if (!home || !home.classList.contains('active')) return;
    loadNext(false);   /* c_next.js: the friendly Next serving card's facts, ahead of wave171's paint */
    await load(force);
    place();
  }

  /* ---------- Confirm my servings ---------- */
  async function go() {
    if (S.busy) return;
    var ids = Object.keys(S.pick).filter(function (k) { return S.pick[k]; }).map(Number);
    if (!ids.length) { S.err = 'Choose at least one serving.'; place('.er'); return; }
    S.busy = true; S.err = ''; S.done = null; place('.go');
    try {
      var r = await db.rpc('wa290_home_signup', { p_events: ids, p_role: S.role });
      if (r && r.error) throw r.error;
      S.done = { dates: (r && r.data && r.data.dates) || '' }; S.pick = {};
      T('You’re confirmed. Thank you!');
      await load(true);
    } catch (e) {
      S.err = String((e && e.message) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 200) || 'Could not confirm. Try again.';
    }
    S.busy = false;
    place(S.err ? '.er' : '.ok');
  }
