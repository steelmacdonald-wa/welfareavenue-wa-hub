  /* =====================================================================
     wave175 (30/09/26): volunteer accounts (hub.welfareavenue.com/me). On the event page each roster card says when the
     volunteer signed up themselves on their page and when they have an account; Text settings gains "Volunteer accounts":
     how many are linked, the open-spot settings, and a check of an hours letter's reference.
     ===================================================================== */
  var W5 = { acc: null, accAt: 0 };
  async function loadAccounts(force) {
    if (!force && W5.acc && Date.now() - W5.accAt < 60000) return W5.acc;
    try { var r = await db.from('volunteer_accounts').select('person_id,linked_via,linked_at,last_seen_at'); var by = {}; ((r && r.data) || []).forEach(function (x) { by[x.person_id] = x; }); W5.acc = by; } catch (e) { W5.acc = W5.acc || {}; }
    W5.accAt = Date.now();
    return W5.acc;
  }
  function w175Tags(r) {
    if (isOff(r)) return '';
    var out = '';
    if ((r.detail || {}).source === 'self sign-up (volunteer page)') out += '<span class="w171tag wait">Signed up on their page</span>';
    if (r.person_id && W5.acc && W5.acc[r.person_id]) out += '<span class="w171tag mute">Has a volunteer account</span>';
    return out;
  }
  function accountsHtml(cn) {
    var n = W5.acc ? Object.keys(W5.acc).length : 0;
    return '<div class="w171h" style="margin-top:18px">Volunteer accounts</div>'
      + '<p class="w171note">Volunteers sign in with Google at hub.welfareavenue.com/me to see their servings and hours, their upcoming servings, open spots, and a letter of their hours. ' + n + ' account' + (n === 1 ? '' : 's') + ' linked so far. A volunteer&rsquo;s account can never open the Hub.</p>'
      + '<div class="two"><div><label class="f">Roles volunteers can sign up for themselves</label><input type="text" id="w175roles" value="' + E(S.cfg.vol_signup_roles || '') + '"' + (cn.admin ? '' : ' disabled') + '></div>'
      + '<div><label class="f">How far ahead (days)</label><input type="text" id="w175days" value="' + E(S.cfg.vol_signup_days || '90') + '"' + (cn.admin ? '' : ' disabled') + '></div></div>'
      + (cn.admin ? '<div class="foot" style="justify-content:flex-start"><button class="w171btn ghost" data-w175save="1">Save the sign-up settings</button></div>' : '')
      + '<label class="f">Check an hours letter (its reference, like WA-VH-89C29E)</label><div style="display:flex;gap:8px"><input type="text" id="w175ref" placeholder="WA-VH-" style="max-width:200px"><button class="w171btn ghost" data-w175ref="1">Check</button></div><div id="w175refout" class="w171note" style="margin-top:6px"></div>';
  }
  async function refCheck() {
    var v = String((document.getElementById('w175ref') || {}).value || '').trim().toUpperCase(); var out = document.getElementById('w175refout'); if (!out) return;
    if (!/^WA-VH-[0-9A-F]{6}$/.test(v)) { out.textContent = 'A reference looks like WA-VH-89C29E.'; return; }
    try {
      var r = await db.from('volunteer_hour_letters').select('*').eq('ref', v).maybeSingle();
      var x = r && r.data;
      out.innerHTML = x ? '<b>Real letter.</b> ' + E(x.full_name) + ': ' + E(x.servings) + ' servings, about ' + E(x.hours) + ' hours, ' + E(fmtDay(x.first_date)) + ' to ' + E(fmtDay(x.last_date)) + '. Issued ' + E(fmtWhen(x.issued_at)) + '.' : '<b style="color:' + FLAG + '">No letter has this reference.</b>';
    } catch (e) { out.textContent = 'Could not check: ' + String((e && e.message) || e).slice(0, 80); }
  }
  async function signupSave(btn) {
    var roles = String((document.getElementById('w175roles') || {}).value || '').split(',').map(function (x) { return lower(x); }).filter(Boolean);
    var bad = roles.filter(function (x) { return ROLES.indexOf(x) < 0; });
    if (bad.length) { T('Not a role: ' + bad.join(', ') + '. Roles: ' + ROLES.join(', ')); return; }
    var days = String(parseInt((document.getElementById('w175days') || {}).value, 10));
    if (!(Number(days) >= 7 && Number(days) <= 365)) { T('Days ahead: 7 to 365'); return; }
    btn.disabled = true;
    try {
      var now = new Date().toISOString(), rows = [['vol_signup_roles', roles.join(',')], ['vol_signup_days', days]];
      for (var i = 0; i < rows.length; i++) { var r = await db.from('app_config').update({ value: rows[i][1], updated_at: now }).eq('key', rows[i][0]); if (r.error) throw r.error; S.cfg[rows[i][0]] = rows[i][1]; }
      T('Sign-up settings saved');
    } catch (e) { T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); }
    btn.disabled = false;
  }
