
/* =====================================================================
   WA v310 Campaigns in the CRM, email insights, buttons to a form or the donation page, and the photo albums (12/11/26)
   =====================================================================
   Soraya Tyree's review of the CRM at the 11 November marketing meeting (Keela closes on 5 December), and Steel: "Okay go
   ahead and make this all capable for Soraya and others using the crm".
   - Campaigns (#crm/folders, in the CRM's rail): every campaign (wa_campaigns, the CRM's own: a drive, an appeal, an event)
     with its folder: what it is, the key facts, its links (the Drive folder, the rules, the one-pager, Canva), its hashtags,
     and what the Hub already knows about it: the forms that file under it, its posts in the Content calendar, the gifts and
     the goal, its donation link and its volunteers. Anyone on the team adds a campaign and fills its folder, so a new
     person finds everything in one place instead of searching Slack.
   - Email insights (#crm/insights): each month's emails (sent, delivered, opened, clicked, unsubscribed), when people open
     them (weekday and time of day, Toronto), the best window, and a send-time test: four slots to rotate, one a week, so the
     month's recap tells the team when our contacts read. Opens and clicks count only once Resend's tracking is on: the page
     says so plainly while none arrive.
   - A button that goes to one of our forms or to the donation page: in the email studio's Button block and in an
     automation's own email (Point it at), so an existing form drops into any email or automation without copying links.
   - A form can show a donate button on its thank-you page (Forms, the form's editor), with the campaign the gift counts for.
   - The Photo library: the albums in Google Photos, listed with the library (Google stopped letting other apps read albums
     in March 2025, so the Hub cannot copy them by itself), and the counts say "in the library".
   Reads and writes through wa310_* (staff, checked inside) and wa_photo_albums (staff). No timers on the menu.
   ===================================================================== */
(function () {
  'use strict';
  if (window.w310) return;
  var GREEN = '#103F39', GOLD = '#DCA527', MUTED = '#6D6A60', FLAG = '#B3402F', CREAM = '#F6F1E6';
  var FORM_HOST = 'https://hub.welfareavenue.com/f/', GIVE = 'https://hub.welfareavenue.com/give';
  var S = {
    forms: null, formsBusy: null, give: null, giveBusy: null,
    c: { list: null, id: null, d: null, busy: false, err: '', edit: false, draft: null, saving: false, newOpen: false, msg: '' },
    m: { d: null, busy: false, err: '', days: 180 },
    albums: null, albumsBusy: null, albumOpen: false, albumErr: '', albumSaving: false
  };
  var TYPES = [['drive', 'A drive'], ['appeal', 'An appeal'], ['fundraising_event', 'A fundraising event'], ['challenge', 'A challenge'], ['program', 'A program'], ['other', 'Something else']];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var SLOTS = [['6', '6 to 9 am'], ['9', '9 am to noon'], ['12', 'Noon to 3 pm'], ['15', '3 to 6 pm'], ['18', '6 to 9 pm'], ['21', '9 pm to 6 am']];
  /* the send-time test: Ian's slots at the 11 November meeting, one a week, then the month's recap shows the winner */
  var TEST_SLOTS = [['Tue', '11:30 am', 'Tuesday late morning'], ['Mon', '9:00 am', 'Monday morning'], ['Wed', '5:00 pm', 'Wednesday after work'], ['Thu', '8:30 am', 'Thursday early morning']];

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function staff() { try { return typeof isStaff === 'function' ? isStaff() : true; } catch (e) { return false; } }
  function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) { /* fine */ } }
  function msgOf(e) { return String((e && (e.message || e.details)) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 180); }
  function money(n) { var v = Number(n || 0); return '$' + v.toLocaleString('en-CA', { maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }); }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; }
  function dayTxt(iso) { if (!iso) return ''; try { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(iso); } }
  function monthTxt(iso) { try { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }); } catch (e) { return String(iso); } }
  function opt(v, l, cur) { return '<option value="' + E(v) + '"' + (String(cur == null ? '' : cur) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>'; }
  function okUrl(u) { return /^https:\/\/\S+$/i.test(String(u || '').trim()); }
  function go(h) { try { location.hash = h; } catch (e) { /* fine */ } }

  var cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true;
    var st = document.createElement('style'); st.id = 'w310css';
    st.textContent = ''
      + '.w310{font-size:14px;color:#1F201E;}'
      + '.w310 h3{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;text-transform:uppercase;letter-spacing:.02em;color:' + GREEN + ';margin:20px 0 8px;font-size:20px;}'
      + '.w310 .lead{margin:0 0 14px;color:' + MUTED + ';font-size:13px;line-height:1.5;max-width:760px;}'
      + '.w310 .m{color:' + MUTED + ';font-size:12px;}'
      + '.w310 .err{color:' + FLAG + ';font-weight:600;font-size:13px;}'
      + '.w310 .ok{color:' + GREEN + ';font-weight:600;font-size:13px;}'
      + '.w310 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;}'
      + '.w310 .card{display:block;width:100%;box-sizing:border-box;text-align:left;font:inherit;padding:14px 16px;border:1px solid rgba(16,63,57,.16);border-radius:14px;background:#fff;color:#1F201E;cursor:pointer;transition:transform 140ms cubic-bezier(.23,1,.32,1),border-color 140ms ease-out;}'
      + '.w310 .card b{display:block;color:' + GREEN + ';font-size:16px;margin:0 0 4px;overflow-wrap:anywhere;}'
      + '.w310 .card small{display:block;color:' + MUTED + ';font-size:12px;line-height:1.5;}'
      + '.w310 .card:active{transform:scale(.98);}'
      + '@media (hover:hover) and (pointer:fine){.w310 .card:hover{border-color:' + GREEN + ';}}'
      + '.w310 .bar{height:6px;border-radius:3px;background:#ECE7DC;overflow:hidden;margin:8px 0 2px;}.w310 .bar i{display:block;height:100%;background:' + GOLD + ';border-radius:3px;}'
      + '.w310 .box{border:1px solid rgba(16,63,57,.14);border-radius:14px;background:#fff;padding:14px 16px;margin:0 0 12px;}'
      + '.w310 .box.soft{background:' + CREAM + ';border-color:transparent;}'
      + '.w310 .row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;}'
      + '.w310 .row > *{min-width:0;}'
      + '.w310 .sp{flex:1 1 auto;}'
      + '.w310 .chip{display:inline-block;font-size:12px;padding:2px 9px;border-radius:999px;background:#EAF1EF;color:' + GREEN + ';margin:0 4px 4px 0;}'
      + '.w310 .chip.gold{background:#F6E4C0;color:#6B4F0E;}.w310 .chip.off{background:#ECE7DC;color:' + MUTED + ';}'
      + '.w310 a{color:' + GREEN + ';}'
      + '.w310 ul.l{list-style:none;margin:0;padding:0;}.w310 ul.l li{padding:8px 0;border-top:1px solid rgba(16,63,57,.08);}.w310 ul.l li:first-child{border-top:0;}'
      + '.w310 dl.facts{display:grid;grid-template-columns:minmax(120px,32%) 1fr;gap:6px 14px;margin:0;}.w310 dl.facts dt{font-weight:700;color:' + GREEN + ';}.w310 dl.facts dd{margin:0;overflow-wrap:anywhere;}'
      + '.w310 .brief{white-space:pre-line;line-height:1.55;margin:0;}'
      + '.w310 .fld{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:' + MUTED + ';flex:1 1 180px;}'
      + '.w310 input,.w310 select,.w310 textarea{font:inherit;font-size:14px;padding:8px 10px;border:1px solid rgba(16,63,57,.25);border-radius:10px;background:#fff;color:#1F201E;min-width:0;box-sizing:border-box;}'
      + '.w310 textarea{width:100%;min-height:90px;resize:vertical;}'
      + '.w310 .pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto;gap:6px;margin:0 0 6px;}'
      + '.w310 .x{border:0;background:none;color:' + MUTED + ';cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;}'
      + '.w310 .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:0 0 12px;}'
      + '.w310 .kpi{padding:12px 14px;border-radius:12px;background:' + CREAM + ';}.w310 .kpi b{display:block;font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;font-size:28px;line-height:1.1;color:' + GREEN + ';}.w310 .kpi span{font-size:12px;color:' + MUTED + ';}'
      + '.w310 table.t{width:100%;border-collapse:collapse;font-size:13px;}.w310 table.t th,.w310 table.t td{padding:8px 10px;text-align:right;border-bottom:1px solid rgba(16,63,57,.08);white-space:nowrap;}.w310 table.t th:first-child,.w310 table.t td:first-child{text-align:left;}'
      + '.w310 table.t th{font-size:12px;color:' + MUTED + ';font-weight:600;}'
      + '.w310 .tw{overflow-x:auto;}'
      + '.w310 table.heat{border-collapse:separate;border-spacing:3px;font-size:12px;}.w310 table.heat th{color:' + MUTED + ';font-weight:600;padding:2px 6px;text-align:left;white-space:nowrap;}'
      + '.w310 table.heat td{width:46px;height:30px;border-radius:6px;text-align:center;color:' + GREEN + ';font-weight:600;}'
      + '.w310 .note{padding:10px 12px;border-radius:10px;background:#F6E4C0;color:#4A3608;font-size:13px;line-height:1.5;margin:0 0 12px;}'
      + '.w310 ol.plan{margin:6px 0 0 18px;padding:0;line-height:1.7;}'
      + '@media (max-width:700px){.w310 .pair{grid-template-columns:1fr auto;}.w310 .pair input:first-child{grid-column:1/-1;}.w310 dl.facts{grid-template-columns:1fr;}.w310 input,.w310 select,.w310 textarea{font-size:16px;}}'
      + '@media (prefers-reduced-motion:reduce){.w310 .card{transition:none;}}'
      /* the pickers inside the studio, the automations and the form editor */
      + '.w310pick{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 10px;font-size:12px;color:' + MUTED + ';}'
      + '.w310pick select{font:inherit;font-size:13px;padding:6px 8px;border:1px solid rgba(16,63,57,.25);border-radius:9px;background:#fff;max-width:100%;}'
      + '.w310fd{border:1px solid rgba(16,63,57,.14);border-radius:12px;padding:10px 12px;margin:12px 0;background:rgba(16,63,57,.025);}'
      + '.w310fd label{display:flex;gap:8px;align-items:flex-start;font-size:14px;}'
      + '.w310fd .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}'
      + '.w310fd .two label{flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:' + MUTED + ';}'
      + '.w310fd input[type=text],.w310fd select{font:inherit;font-size:14px;padding:7px 9px;border:1px solid rgba(16,63,57,.25);border-radius:9px;background:#fff;}'
      + '@media (max-width:700px){.w310fd .two{grid-template-columns:1fr;}}'
      /* the photo albums */
      + '.w310al{border:1px solid rgba(16,63,57,.14);border-radius:14px;background:' + CREAM + ';padding:12px 14px;margin:12px 0 4px;font-size:13px;line-height:1.5;}'
      + '.w310al b.h{display:block;color:' + GREEN + ';font-size:15px;margin:0 0 4px;}'
      + '.w310al .als{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px;}'
      + '.w310al .als a{display:inline-block;padding:5px 11px;border-radius:999px;background:#fff;border:1px solid rgba(16,63,57,.2);color:' + GREEN + ';text-decoration:none;font-weight:600;font-size:12px;}'
      + '.w310al .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px;}'
      + '.w310al button{font:inherit;font-size:12px;font-weight:600;border:1px solid ' + GREEN + ';background:#fff;color:' + GREEN + ';border-radius:999px;padding:5px 12px;cursor:pointer;}'
      + '.w310al .f{display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-top:8px;}'
      + '.w310al .f input{font:inherit;font-size:13px;padding:6px 8px;border:1px solid rgba(16,63,57,.25);border-radius:9px;min-width:0;}'
      + '@media (max-width:700px){.w310al .f{grid-template-columns:1fr;}.w310al .f input{font-size:16px;}}';
    document.head.appendChild(st);
  }

  /* ---------- shared: the published forms and the donation campaigns ---------- */
  function loadForms() {
    if (S.forms) return Promise.resolve(S.forms);
    if (S.formsBusy) return S.formsBusy;
    S.formsBusy = Promise.resolve(db.from('crm_forms').select('id,slug,title,lang,status,purpose,settings').eq('status', 'published')).then(function (r) {
      S.forms = ((r && r.data) || []).slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); }); S.formsBusy = null; return S.forms;
    }).catch(function () { S.forms = []; S.formsBusy = null; return S.forms; });
    return S.formsBusy;
  }
  function loadGive() {
    if (S.give) return Promise.resolve(S.give);
    if (S.giveBusy) return S.giveBusy;
    S.giveBusy = Promise.resolve(db.from('app_config').select('key,value').in('key', ['donate_campaigns', 'donate_mode'])).then(function (r) {
      var out = { mode: '', list: [] };
      ((r && r.data) || []).forEach(function (x) {
        if (x.key === 'donate_mode') out.mode = String(x.value || '');
        if (x.key === 'donate_campaigns') {
          var v = x.value; try { if (typeof v === 'string') v = JSON.parse(v); } catch (e) { v = {}; }
          Object.keys(v || {}).forEach(function (k) { if (v[k] && v[k].open !== false) out.list.push([k, v[k].name || k]); });
        }
      });
      S.give = out; S.giveBusy = null; return out;
    }).catch(function () { S.give = { mode: '', list: [] }; S.giveBusy = null; return S.give; });
    return S.giveBusy;
  }
  function giveUrl(key, fr) { var q = []; if (key) q.push('c=' + encodeURIComponent(key)); if (fr) q.push('lang=fr'); return GIVE + (q.length ? '?' + q.join('&') : ''); }
  /* the choices of "Point it at": our donation page (and each open donation campaign), then every live form */
  function targetOptions() {
    var h = '<option value="">Point it at…</option>';
    var g = S.give || { list: [] };
    h += '<optgroup label="Donations">' + opt('give:', 'Our donation page', '') + g.list.map(function (c) { return opt('give:' + c[0], 'Donation page: ' + c[1], ''); }).join('') + '</optgroup>';
    var fs = S.forms || [];
    if (fs.length) h += '<optgroup label="Our live forms">' + fs.map(function (f) { return opt('form:' + f.slug, f.title + ' (' + String(f.lang || 'en').toUpperCase() + ')', ''); }).join('') + '</optgroup>';
    return h;
  }
  function targetOf(v) {
    if (/^give:/.test(v)) { var k = v.slice(5), c = ((S.give && S.give.list) || []).filter(function (x) { return x[0] === k; })[0]; return { url: giveUrl(k, false), label: 'Give now', what: c ? 'the donation page for ' + c[1] : 'our donation page' }; }
    if (/^form:/.test(v)) { var s = v.slice(5), f = (S.forms || []).filter(function (x) { return x.slug === s; })[0]; return { url: FORM_HOST + s, label: f && f.lang === 'fr' ? 'Remplir le formulaire' : 'Fill in the form', what: f ? '“' + f.title + '”' : 'the form' }; }
    return null;
  }
  function setVal(el, v) {
    if (!el) return;
    el.value = v;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* fine */ }
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* fine */ }
  }
  function ensureTargets(repaint) {
    if (S.forms && S.give) return;
    Promise.all([loadForms(), loadGive()]).then(function () {
      document.querySelectorAll('select[data-w310btn],select[data-w310cta]').forEach(function (sel) { if (sel.options.length < 3) sel.innerHTML = targetOptions(); });
      if (repaint) repaint();
    });
  }

  /* the email studio's Button block: the picker under its fields (blockForm calls btnPick) */
  function btnPick(i) {
    css(); ensureTargets();
    return '<div class="w310pick"><span>Or send it to</span><select data-w310btn="' + E(i) + '" aria-label="Point the button at a form or the donation page">' + targetOptions() + '</select></div>';
  }
  /* an automation's own email: the picker under Button and Button link (stepBody calls ctaPick) */
  function ctaPick() {
    css(); ensureTargets();
    return '<div class="w310pick"><span>The button goes to</span><select data-w310cta="1" aria-label="Point the button at a form or the donation page">' + targetOptions() + '</select><span>(or type any link)</span></div>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var v = t.value, tg;
    if (t.hasAttribute('data-w310btn')) {
      tg = targetOf(v); if (!tg) return;
      var i = t.getAttribute('data-w310btn'), box = t.closest('.w202bf') || document;
      var u = box.querySelector('[data-w202f="' + i + '.url"]'), l = box.querySelector('[data-w202f="' + i + '.label"]');
      if (l && !String(l.value || '').trim()) setVal(l, tg.label);
      setVal(u, tg.url);
      say('The button now goes to ' + tg.what);
      return;
    }
    if (t.hasAttribute('data-w310cta')) {
      tg = targetOf(v); if (!tg) return;
      var st = t.closest('.w157step') || t.parentNode.parentNode;
      var cu = st.querySelector('[data-w157s="cta_url"]'), cl = st.querySelector('[data-w157s="cta_label"]');
      if (cl && !String(cl.value || '').trim()) setVal(cl, tg.label);
      setVal(cu, tg.url);
      say('The button now goes to ' + tg.what);
      return;
    }
  }, true);

  /* ---------- a form's donate button (the form editor calls formDonate before the thank-you message) ---------- */
  var FD = { f: null };
  function formDonate(f) {
    css(); FD.f = f;
    if (!S.give) loadGive().then(function () { var el = document.querySelector('[data-w310fdc]'); if (el && FD.f) el.innerHTML = fdCampOpts(FD.f); });
    var d = (f.settings && f.settings.donate) || {}, on = d.on === true, fr = f.lang === 'fr';
    return '<div class="w310fd" data-w310fd="1"><label><input type="checkbox" data-w310fdk="on"' + (on ? ' checked' : '') + '><span><b>Show a donate button on the thank-you page</b><br><span style="font-size:12px;color:' + MUTED + '">After they send the form, a gold button takes them to our donation page (hub.welfareavenue.com/give)' + (fr ? ', in French' : '') + '.</span></span></label>'
      + (on ? '<div class="two"><label>The button’s words<input type="text" maxlength="60" data-w310fdk="label" value="' + E(d.label || '') + '" placeholder="' + E(fr ? 'Faire un don' : 'Give to Welfare Avenue') + '" data-w198skip></label>'
        + '<label>The gift counts for<select data-w310fdk="campaign" data-w310fdc="1">' + fdCampOpts(f) + '</select></label></div>' : '') + '</div>';
  }
  function fdCampOpts(f) {
    var d = (f.settings && f.settings.donate) || {}, cur = d.campaign || '';
    return opt('', 'Where it is needed most', cur) + (((S.give && S.give.list) || []).map(function (c) { return opt(c[0], c[1], cur); }).join(''));
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-w310fdk') || !FD.f) return;
    var f = FD.f; f.settings = f.settings || {}; var d = Object.assign({}, f.settings.donate || {}), k = t.getAttribute('data-w310fdk');
    if (k === 'on') d.on = !!t.checked;
    else if (k === 'label') d.label = String(t.value || '').trim().slice(0, 60) || undefined;
    else if (k === 'campaign') d.campaign = t.value || undefined;
    if (d.on) f.settings.donate = JSON.parse(JSON.stringify(d)); else if (f.settings.donate) { f.settings.donate = { on: false }; }
    if (k === 'on') { var box = t.closest('[data-w310fd]'); if (box) box.outerHTML = formDonate(f); }
    try { if (typeof window.w156dirty === 'function') window.w156dirty(); } catch (x) { /* fine */ }
  }, true);

  /* =====================================================================
     Campaigns (#crm/folders)
     ===================================================================== */
  function cLoad(id) {
    S.c.busy = true; S.c.err = '';
    return Promise.resolve(db.rpc('wa310_campaigns', { p_id: id || null })).then(function (r) {
      if (r && r.error) throw r.error;
      if (id) { S.c.d = r.data || null; S.c.id = id; } else S.c.list = (r.data && r.data.campaigns) || [];
      if (!id && r.data && r.data.fund_events) S.c.funds = r.data.fund_events;
    }).catch(function (e) { S.c.err = 'Could not load the campaigns: ' + msgOf(e); }).then(function () { S.c.busy = false; repaint(); });
  }
  var ROOT = { el: null, top: '' };
  function repaint() {
    var el = ROOT.el; if (!el || !document.body.contains(el)) return;
    var tab = S.tab;
    el.innerHTML = ROOT.top + '<div class="w310" id="w310">' + (tab === 'insights' ? insightsHtml() : campaignsHtml()) + '</div>';
  }
  function typeName(k) { var t = TYPES.filter(function (x) { return x[0] === k; })[0], w = t ? t[1].replace(/^An? /, '') : (k || 'campaign'); return w.charAt(0).toUpperCase() + w.slice(1); }
  function statusChip(s) { return s === 'active' ? '<span class="chip">Running</span>' : s === 'done' ? '<span class="chip off">Done</span>' : s === 'planned' ? '<span class="chip gold">Planned</span>' : '<span class="chip off">' + E(s || '') + '</span>'; }
  function campaignsHtml() {
    if (S.c.err && !S.c.list && !S.c.d) return '<p class="err">' + E(S.c.err) + '</p>';
    var id = S.c.id;
    return id ? detailHtml() : listHtml();
  }
  function listHtml() {
    var L = S.c.list;
    if (L === null) return '<p class="m">Loading the campaigns…</p>';
    var act = L.filter(function (c) { return c.status !== 'done'; }), done = L.filter(function (c) { return c.status === 'done'; });
    var card = function (c) {
      var goal = Number(c.goal_amount || 0), raised = Number(c.raised || 0);
      return '<button type="button" class="card" data-w310c="' + E(c.id) + '"><b data-w198skip>' + E(c.name) + '</b>'
        + '<small>' + E(typeName(c.type)) + (c.year ? ' · ' + E(c.year) : '') + ' · ' + (c.status === 'active' ? 'running' : E(c.status || '')) + '</small>'
        + (goal ? '<div class="bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(100 * raised / goal)) + '%"></i></div><small>' + money(raised) + ' of ' + money(goal) + '</small>' : (raised ? '<small>' + money(raised) + ' given</small>' : ''))
        + '<small>' + [c.forms ? c.forms + ' form' + (c.forms === 1 ? '' : 's') : '', c.posts ? c.posts + ' post' + (c.posts === 1 ? '' : 's') : '', c.links ? c.links + ' link' + (c.links === 1 ? '' : 's') + ' in its folder' : 'folder empty'].filter(Boolean).join(' · ') + '</small></button>';
    };
    var h = '<p class="lead">Everything about each campaign in one place: what it is, the key facts and rules, its links (the Drive folder, the one-pager, the Canva designs), and what the Hub already knows (its forms, its posts, the gifts and the goal). New to a campaign? Start here instead of searching Slack.</p>';
    h += '<div class="row" style="margin:0 0 12px">' + '<button type="button" class="w152btn" data-w310new="1">+ New campaign</button>' + (S.c.msg ? '<span class="ok">' + E(S.c.msg) + '</span>' : '') + '</div>';
    if (S.c.newOpen) h += newHtml();
    h += act.length ? '<div class="grid" role="list">' + act.map(card).join('') + '</div>' : '<p class="m">No running or planned campaign yet.</p>';
    if (done.length) h += '<h3>Done</h3><div class="grid">' + done.map(card).join('') + '</div>';
    return h;
  }
  function newHtml() {
    var y = new Date().getFullYear();
    var funds = S.c.funds || [];
    return '<div class="box soft"><div class="row">'
      + '<label class="fld">Name<input id="w310nn" maxlength="120" placeholder="e.g. One Bag Challenge 2026" data-w198skip></label>'
      + '<label class="fld" style="flex:0 1 190px">What it is<select id="w310nt">' + TYPES.map(function (t) { return opt(t[0], t[1], 'drive'); }).join('') + '</select></label>'
      + '<label class="fld" style="flex:0 1 110px">Year<input id="w310ny" type="number" inputmode="numeric" min="2015" max="2100" value="' + y + '"></label>'
      + '<label class="fld" style="flex:0 1 140px">Goal ($, optional)<input id="w310ng" type="number" inputmode="decimal" min="0" step="1"></label></div>'
      + (funds.length ? '<div class="row" style="margin-top:8px"><label class="fld">The Fundraising event it belongs to (optional)<select id="w310nf">' + opt('', 'None', '') + funds.map(function (f) { return opt(String(f.id), f.title, ''); }).join('') + '</select></label></div>' : '')
      + '<div class="row" style="margin-top:10px"><button type="button" class="w152btn" data-w310create="1"' + (S.c.saving ? ' disabled' : '') + '>' + (S.c.saving ? 'Making it…' : 'Make the campaign') + '</button><button type="button" class="w152btn ghost" data-w310newx="1">Cancel</button>' + (S.c.err ? '<span class="err">' + E(S.c.err) + '</span>' : '') + '</div></div>';
  }
  function detailHtml() {
    var d = S.c.d;
    if (!d || !d.campaign) return S.c.busy ? '<p class="m">Loading…</p>' : '<p class="err">' + E(S.c.err || 'This campaign could not be found.') + '</p><p><a href="#crm/folders">← All campaigns</a></p>';
    var c = d.campaign, ed = S.c.edit, k = d.gifts || {};
    var goal = Number(c.goal_amount || 0), raised = Number(k.total || 0);
    var h = '<p><a href="#crm/folders">← All campaigns</a></p>';
    h += '<div class="box"><div class="row"><b style="font-size:20px;color:' + GREEN + '" data-w198skip>' + E(c.name) + '</b>' + statusChip(c.status) + '<span class="m">' + E(typeName(c.type)) + (c.year ? ' · ' + E(c.year) : '') + '</span><span class="sp"></span>'
      + (ed ? '' : '<button type="button" class="w152btn sm" data-w310edit="1">Edit the folder</button>') + '</div>'
      + (goal || raised ? '<div class="bar" aria-hidden="true"><i style="width:' + (goal ? Math.min(100, Math.round(100 * raised / goal)) : 100) + '%"></i></div><p class="m" style="margin:2px 0 0">' + money(raised) + ' given' + (goal ? ' of the ' + money(goal) + ' goal' : '') + (k.n ? ' · ' + k.n + ' gift' + (k.n === 1 ? '' : 's') + (k.last ? ', the latest ' + E(dayTxt(k.last)) : '') : '') + ' · <a href="#crm/gifts">Gifts</a></p>' : '')
      + (c.updated_at ? '<p class="m" style="margin:6px 0 0">Folder updated ' + E(dayTxt(c.updated_at)) + (c.updated_by ? ' by ' + E(String(c.updated_by).split('@')[0]) : '') + '</p>' : '') + '</div>';
    if (ed) return h + editHtml(c);
    /* about */
    h += '<h3>What it is</h3><div class="box">' + (String(c.brief || '').trim() ? '<p class="brief" data-w198skip>' + E(c.brief) + '</p>' : '<p class="m">Nothing written yet. <button type="button" class="w152mini" data-w310edit="1">Write what it is</button> so a new person knows the why, the who and the how.</p>') + '</div>';
    var facts = (c.facts || []).filter(function (x) { return x && (x.label || x.value); });
    h += '<h3>Key facts</h3><div class="box">' + (facts.length ? '<dl class="facts">' + facts.map(function (x) { return '<dt data-w198skip>' + E(x.label) + '</dt><dd data-w198skip>' + E(x.value) + '</dd>'; }).join('') + '</dl>' : '<p class="m">No facts yet (the dates, the rules in short, what a gift does, who leads it).</p>')
      + ((c.hashtags || []).length ? '<p style="margin:10px 0 0">' + c.hashtags.map(function (t) { return '<span class="chip" data-w198skip>#' + E(String(t).replace(/^#/, '')) + '</span>'; }).join('') + '</p>' : '') + '</div>';
    var links = (c.links || []).filter(function (x) { return x && okUrl(x.url); });
    h += '<h3>The folder</h3><div class="box">' + (links.length ? '<ul class="l">' + links.map(function (x) { return '<li><a href="' + E(x.url) + '" target="_blank" rel="noopener" data-w198skip>' + E(x.label || x.url) + '</a>' + (x.note ? ' <span class="m" data-w198skip>' + E(x.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="m">No links yet. Add the Drive folder, the rules, the one-pager, the Canva designs, anything a teammate needs.</p>') + '</div>';
    /* what the Hub knows */
    var fs = d.forms || [];
    h += '<h3>Its forms</h3><div class="box">' + (fs.length ? '<ul class="l">' + fs.map(function (f) {
      return '<li><div class="row"><b data-w198skip>' + E(f.title) + '</b><span class="chip' + (f.status === 'published' ? '' : ' off') + '">' + (f.status === 'published' ? 'Live' : E(f.status)) + '</span><span class="m">' + E(String(f.lang || '').toUpperCase()) + ' · ' + (f.n || 0) + ' answer' + (f.n === 1 ? '' : 's') + '</span><span class="sp"></span>'
        + (f.status === 'published' ? '<a href="' + E(FORM_HOST + f.slug) + '" target="_blank" rel="noopener">Open</a>' : '') + '<a href="#crm/forms/' + E(f.id) + '">Edit</a></div></li>';
    }).join('') + '</ul>' : '<p class="m">No form files under it yet. In Forms, open a form and pick this campaign under Campaign.</p>') + '</div>';
    var ps = d.posts || [];
    h += '<h3>Its posts</h3><div class="box">' + (ps.length ? '<ul class="l">' + ps.slice(0, 12).map(function (p) {
      var st = p.status === 'published' || p.status === 'posted' ? '<span class="chip">Out ' + E(dayTxt(p.published_at || p.scheduled_at)) + '</span>' : p.approval_status === 'pending' ? '<span class="chip gold">Waiting for approval</span>' : p.scheduled_at ? '<span class="chip gold">' + E(dayTxt(p.scheduled_at)) + '</span>' : '<span class="chip off">Idea or draft</span>';
      return '<li><div class="row"><span data-w198skip>' + E(p.title || 'Post #' + p.id) + '</span>' + st + '<span class="sp"></span><a href="#contentcal/' + E(p.id) + '">Open</a></div></li>';
    }).join('') + '</ul>' + (ps.length > 12 ? '<p class="m">' + (ps.length - 12) + ' more in the Content calendar.</p>' : '') : '<p class="m">No posts carry this campaign yet. In the Content calendar, a post’s Campaign field links it here' + ((c.post_names || []).length ? ' (it matches: ' + E(c.post_names.join(', ')) + ')' : '') + '.</p>') + '</div>';
    h += '<h3>Giving and volunteers</h3><div class="box"><ul class="l">'
      + '<li><div class="row"><b>Donation link</b><span class="sp"></span>' + (c.donate_key ? '<code style="font-size:12px" data-w198skip>' + E(giveUrl(c.donate_key)) + '</code><button type="button" class="w152mini" data-w310copy="' + E(giveUrl(c.donate_key)) + '">Copy</button>' : '<span class="m">Gifts through the donation page go to “where it is needed most”; ask an admin to give this campaign its own donation link.</span>') + '</div></li>'
      + (d.fund_event ? '<li><div class="row"><b>Fundraising event</b><span data-w198skip>' + E(d.fund_event.title) + '</span><span class="m">' + E(d.fund_event.timing || '') + '</span><span class="sp"></span>' + (d.fund_event.volunteer_on ? '<a href="#volunteering/fundraisers/' + E(d.fund_event.id) + '">Its volunteers</a>' : '') + '<a href="#fund">The Fundraising app</a></div></li>' : '')
      + (d.people ? '<li><div class="row"><b>People in it</b><span>' + d.people + '</span><span class="m">contacts the CRM links to this campaign</span></div></li>' : '')
      + '</ul></div>';
    return h;
  }
  function editHtml(c) {
    var dr = S.c.draft || (S.c.draft = JSON.parse(JSON.stringify({ name: c.name, type: c.type, year: c.year, status: c.status, goal_amount: c.goal_amount, brief: c.brief || '', facts: c.facts || [], links: c.links || [], hashtags: (c.hashtags || []).map(function (t) { return '#' + t; }).join(' '), post_names: (c.post_names || []).join(', '), fund_event_id: c.fund_event_id || '' })));
    while (dr.facts.length < 2) dr.facts.push({ label: '', value: '' });
    while (dr.links.length < 2) dr.links.push({ label: '', url: '' });
    var funds = (S.c.d && S.c.d.fund_events) || [];
    return '<div class="box" data-w310ed="1"><div class="row">'
      + '<label class="fld">Name<input data-w310k="name" maxlength="120" value="' + E(dr.name) + '" data-w198skip></label>'
      + '<label class="fld" style="flex:0 1 180px">What it is<select data-w310k="type">' + TYPES.map(function (t) { return opt(t[0], t[1], dr.type); }).join('') + '</select></label>'
      + '<label class="fld" style="flex:0 1 100px">Year<input data-w310k="year" type="number" inputmode="numeric" value="' + E(dr.year || '') + '"></label>'
      + '<label class="fld" style="flex:0 1 140px">Status<select data-w310k="status">' + opt('planned', 'Planned', dr.status) + opt('active', 'Running', dr.status) + opt('done', 'Done', dr.status) + '</select></label>'
      + '<label class="fld" style="flex:0 1 130px">Goal ($)<input data-w310k="goal_amount" type="number" inputmode="decimal" min="0" value="' + E(dr.goal_amount == null ? '' : dr.goal_amount) + '"></label></div>'
      + '<label class="fld" style="margin-top:10px">What it is, the why and the how (for someone new)<textarea data-w310k="brief" maxlength="4000" rows="6" data-w198skip>' + E(dr.brief) + '</textarea></label>'
      + '<p class="m" style="margin:12px 0 4px">Key facts (dates, the rules in short, what a gift does, who leads it)</p>'
      + dr.facts.map(function (x, i) { return '<div class="pair"><input data-w310f="facts.' + i + '.label" maxlength="60" placeholder="e.g. What $25 does" value="' + E(x.label) + '" data-w198skip><input data-w310f="facts.' + i + '.value" maxlength="300" placeholder="e.g. Fills one bag: hygiene products, clothing, hand warmers, a book" value="' + E(x.value) + '" data-w198skip><button type="button" class="x" data-w310del="facts.' + i + '" aria-label="Remove this fact">×</button></div>'; }).join('')
      + '<button type="button" class="w152mini" data-w310add="facts">+ A fact</button>'
      + '<p class="m" style="margin:12px 0 4px">Links (https): the Drive folder, the rules, the one-pager, the Canva designs</p>'
      + dr.links.map(function (x, i) { return '<div class="pair"><input data-w310f="links.' + i + '.label" maxlength="80" placeholder="e.g. The rules (volunteer doc)" value="' + E(x.label) + '" data-w198skip><input data-w310f="links.' + i + '.url" type="url" inputmode="url" maxlength="500" placeholder="https://docs.google.com/..." value="' + E(x.url) + '"><button type="button" class="x" data-w310del="links.' + i + '" aria-label="Remove this link">×</button></div>'; }).join('')
      + '<button type="button" class="w152mini" data-w310add="links">+ A link</button>'
      + '<div class="row" style="margin-top:12px"><label class="fld">Hashtags (with or without #)<input data-w310k="hashtags" maxlength="200" value="' + E(dr.hashtags) + '" placeholder="#onebagchallenge" data-w198skip></label>'
      + '<label class="fld">Its posts in the Content calendar carry the campaign<input data-w310k="post_names" maxlength="300" value="' + E(dr.post_names) + '" placeholder="One Bag Challenge, One Bag Challenge launch" data-w198skip></label></div>'
      + (funds.length ? '<div class="row" style="margin-top:8px"><label class="fld">The Fundraising event it belongs to<select data-w310k="fund_event_id">' + opt('', 'None', dr.fund_event_id) + funds.map(function (f) { return opt(String(f.id), f.title, dr.fund_event_id); }).join('') + '</select></label></div>' : '')
      + '<div class="row" style="margin-top:12px"><button type="button" class="w152btn" data-w310save="1"' + (S.c.saving ? ' disabled' : '') + '>' + (S.c.saving ? 'Saving…' : 'Save the folder') + '</button><button type="button" class="w152btn ghost" data-w310cancel="1">Cancel</button>' + (S.c.err ? '<span class="err">' + E(S.c.err) + '</span>' : '') + '</div></div>';
  }
  function draftSet(path, val) {
    var dr = S.c.draft; if (!dr) return;
    var p = path.split('.'); if (p.length === 1) { dr[p[0]] = val; return; }
    var arr = dr[p[0]]; var i = Number(p[1]); if (!arr[i]) arr[i] = {}; arr[i][p[2]] = val;
  }
  function draftOut() {
    var dr = S.c.draft;
    var tags = String(dr.hashtags || '').split(/[\s,]+/).map(function (t) { return t.replace(/^#+/, '').trim(); }).filter(Boolean);
    var names = String(dr.post_names || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    return {
      id: S.c.id, name: String(dr.name || '').trim(), type: dr.type, year: dr.year ? Number(dr.year) : null, status: dr.status,
      goal_amount: dr.goal_amount === '' || dr.goal_amount == null ? null : Number(dr.goal_amount), brief: String(dr.brief || ''),
      facts: (dr.facts || []).filter(function (x) { return x && (String(x.label || '').trim() || String(x.value || '').trim()); }),
      links: (dr.links || []).filter(function (x) { return x && String(x.url || '').trim(); }),
      hashtags: tags, post_names: names, fund_event_id: dr.fund_event_id ? Number(dr.fund_event_id) : null
    };
  }

  /* =====================================================================
     Email insights (#crm/insights)
     ===================================================================== */
  function mLoad() {
    S.m.busy = true; S.m.err = '';
    return Promise.resolve(db.rpc('wa310_mail_insights', { p_days: S.m.days })).then(function (r) { if (r && r.error) throw r.error; S.m.d = r.data || {}; })
      .catch(function (e) { S.m.err = 'Could not load the insights: ' + msgOf(e); }).then(function () { S.m.busy = false; repaint(); });
  }
  function insightsHtml() {
    var d = S.m.d;
    if (!d) return S.m.err ? '<p class="err">' + E(S.m.err) + '</p>' : '<p class="m">Loading the insights…</p>';
    var months = d.months || [], heat = d.heat || [], tot = { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    months.forEach(function (m) { Object.keys(tot).forEach(function (k) { tot[k] += Number(m[k] || 0); }); });
    var h = '<p class="lead">How our emails do, month by month, and when our contacts open them. It counts the emails the Hub sends (one person, Sends to a list and automations), not the tests. Newsletters sent from Keela until 5 December are not in it.</p>';
    if (!d.tracking) h += '<div class="note"><b>Opens and clicks are not being counted yet.</b> Resend only tells the Hub about them when open and click tracking is on for welfareavenue.com. An admin turns both on in Resend, Domains, welfareavenue.com, Configuration, and adds <i>email.opened</i> and <i>email.clicked</i> to the Hub’s webhook in Resend, Webhooks. From then on this page fills in by itself.</div>';
    h += '<div class="kpis"><div class="kpi"><b>' + tot.sent + '</b><span>sent, last ' + Math.round(S.m.days / 30) + ' months</span></div><div class="kpi"><b>' + pct(tot.delivered, tot.sent) + '</b><span>delivered</span></div>'
      + '<div class="kpi"><b>' + (d.tracking ? pct(tot.opened, tot.delivered) : '–') + '</b><span>opened</span></div><div class="kpi"><b>' + (d.tracking ? pct(tot.clicked, tot.delivered) : '–') + '</b><span>clicked a link</span></div>'
      + '<div class="kpi"><b>' + tot.unsubscribed + '</b><span>unsubscribed</span></div></div>';
    h += '<h3>Each month</h3><div class="box tw">' + (months.length ? '<table class="t"><thead><tr><th>Month</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Unsubscribed</th><th>Bounced</th></tr></thead><tbody>'
      + months.map(function (m) { return '<tr><td>' + E(monthTxt(m.month)) + '</td><td>' + m.sent + '</td><td>' + m.delivered + '</td><td>' + (d.tracking ? m.opened + ' (' + pct(m.opened, m.delivered) + ')' : '–') + '</td><td>' + (d.tracking ? m.clicked + ' (' + pct(m.clicked, m.delivered) + ')' : '–') + '</td><td>' + m.unsubscribed + '</td><td>' + m.bounced + '</td></tr>'; }).join('')
      + '</tbody></table>' : '<p class="m">No email sent from the Hub in this window.</p>') + '</div>';
    /* when people open: weekday x time of day */
    var by = {}, max = 0, best = null;
    heat.forEach(function (c) { var k = c.dow + ':' + c.slot; by[k] = c; if (Number(c.opens) > max) max = Number(c.opens); if (!best || Number(c.opens) > Number(best.opens)) best = c; });
    h += '<h3>When people open them</h3><div class="box">';
    if (!d.tracking || !max) h += '<p class="m">' + (d.tracking ? 'No opens in this window yet.' : 'This fills in once opens are counted (see above).') + ' Until then, the times the emails went out are below.</p>';
    else h += '<p style="margin:0 0 8px">The most opens: <b>' + E(DAYS[best.dow]) + ', ' + E((SLOTS.filter(function (s) { return String(s[0]) === String(best.slot); })[0] || [0, ''])[1]) + '</b> (Toronto time, ' + best.opens + ' open' + (best.opens === 1 ? '' : 's') + ').</p>';
    var cellMax = max || heat.reduce(function (a, c) { return Math.max(a, Number(c.sends || 0)); }, 0) || 1, useOpens = !!(d.tracking && max);
    h += '<div class="tw"><table class="heat"><thead><tr><th></th>' + [1, 2, 3, 4, 5, 6, 0].map(function (w) { return '<th>' + DAYS[w] + '</th>'; }).join('') + '</tr></thead><tbody>'
      + SLOTS.map(function (s) {
        return '<tr><th>' + E(s[1]) + '</th>' + [1, 2, 3, 4, 5, 6, 0].map(function (w) {
          var c = by[w + ':' + s[0]] || {}, n = Number(useOpens ? c.opens : c.sends) || 0, a = n ? 0.12 + 0.78 * n / cellMax : 0;
          return '<td style="background:' + (n ? 'rgba(220,165,39,' + a.toFixed(2) + ')' : '#F3EFE6') + '" title="' + DAYS[w] + ', ' + E(s[1]) + ': ' + n + (useOpens ? ' opens' : ' sent') + '">' + (n || '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="m" style="margin:6px 0 0">' + (useOpens ? 'Opens' : 'Emails sent') + ' by weekday and time of day, Toronto time.</p></div>';
    /* the send-time test */
    h += '<h3>Find our best send time</h3><div class="box soft"><p style="margin:0">For the next four newsletters, send each at a different time, then read this page at the end of the month: the opens show when our contacts read.</p><ol class="plan">'
      + TEST_SLOTS.map(function (t, i) { return '<li>Week ' + (i + 1) + ': ' + E(t[2]) + ' (' + E(t[0]) + ', ' + E(t[1]) + ')</li>'; }).join('') + '</ol>'
      + '<p class="m" style="margin:8px 0 0">Schedule a Send for its time in Sends; keep the subject style the same so the time is the only change.</p></div>';
    return h;
  }

  /* ---------- the CRM's two new tabs ---------- */
  S.tab = '';
  function route(parts) {
    var sub = parts[1] || '';
    S.tab = sub === 'insights' ? 'insights' : 'folders';
    if (S.tab === 'folders') {
      var id = parts[2] && /^\d+$/.test(parts[2]) ? Number(parts[2]) : null;
      if (id !== S.c.id) { S.c.edit = false; S.c.draft = null; S.c.err = ''; }
      S.c.id = id;
      if (id) { if (!S.c.d || S.c.d.campaign && Number(S.c.d.campaign.id) !== id) { S.c.d = null; cLoad(id); } }
      else { S.c.d = null; if (S.c.list === null || S.c.stale) { S.c.stale = false; cLoad(null); } }
    } else if (!S.m.d && !S.m.busy) mLoad();
  }
  function paintCrm(root, tab, top) {
    css(); ROOT.el = root; ROOT.top = top || ''; S.tab = tab;
    repaint();
    mast(tab);
  }
  function mast(tab) {
    try {
      var sec = document.getElementById('crm'); if (!sec) return;
      var m = sec.querySelector('.w118mast'); if (!m) return;
      var h1 = m.querySelector('h1'), p = m.querySelector(':scope > p');
      var t = tab === 'insights' ? ['Email insights', 'How our emails do and when our contacts open them'] : ['Campaigns', 'Each campaign’s folder: what it is, its facts and links, its forms, posts and gifts'];
      if (h1 && h1.textContent !== t[0]) h1.textContent = t[0];
      if (p && p.textContent !== t[1]) p.textContent = t[1];
    } catch (e) { /* fine */ }
  }

  /* the CRM's rail: Campaigns (with Gifts) and Email insights */
  function arm() {
    var A = window.WA_APP && window.WA_APP.apps;
    if (!A || !A.crm || typeof A.crm.groups !== 'function') return false;
    if (A.crm.__w310) return true;
    var g0 = A.crm.groups;
    A.crm.groups = function () {
      var gs = g0.apply(this, arguments);
      try {
        var giving = gs.filter(function (g) { return /giving/i.test(g.label || ''); })[0];
        var it = { h: '#crm/folders', l: 'Campaigns', ic: 'box', page: 'crm' };
        if (giving) { giving.label = 'Campaigns and giving'; if (!giving.items.some(function (x) { return x.h === it.h; })) giving.items.unshift(it); }
        else gs.splice(1, 0, { label: 'Campaigns', items: [it] });
        var em = gs.filter(function (g) { return /email/i.test(g.label || ''); })[0];
        var it2 = { h: '#crm/insights', l: 'Email insights', ic: 'chart', page: 'crm' };
        if (em && !em.items.some(function (x) { return x.h === it2.h; })) em.items.push(it2);
      } catch (e) { /* the rail as it was */ }
      return gs;
    };
    A.crm.__w310 = true;
    return true;
  }
  if (!arm()) { setTimeout(arm, 800); setTimeout(arm, 2500); setTimeout(arm, 6000); }

  /* ---------- clicks and fields on the two pages ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#w310 [data-w310c],#w310 [data-w310new],#w310 [data-w310newx],#w310 [data-w310create],#w310 [data-w310edit],#w310 [data-w310cancel],#w310 [data-w310save],#w310 [data-w310add],#w310 [data-w310del],#w310 [data-w310copy]') : null;
    if (!t) return;
    if (t.hasAttribute('data-w310c')) { go('#crm/folders/' + t.getAttribute('data-w310c')); return; }
    if (t.hasAttribute('data-w310new')) { S.c.newOpen = true; S.c.err = ''; S.c.msg = ''; repaint(); var n = document.getElementById('w310nn'); if (n) n.focus(); return; }
    if (t.hasAttribute('data-w310newx')) { S.c.newOpen = false; S.c.err = ''; repaint(); return; }
    if (t.hasAttribute('data-w310create')) {
      var nm = ((document.getElementById('w310nn') || {}).value || '').trim();
      if (nm.length < 3) { S.c.err = 'Give the campaign a name.'; repaint(); return; }
      var p = { name: nm, type: (document.getElementById('w310nt') || {}).value || 'drive', year: Number((document.getElementById('w310ny') || {}).value) || null, status: 'planned',
        goal_amount: (document.getElementById('w310ng') || {}).value ? Number(document.getElementById('w310ng').value) : null, fund_event_id: (document.getElementById('w310nf') || {}).value ? Number(document.getElementById('w310nf').value) : null };
      S.c.saving = true; S.c.err = ''; repaint();
      Promise.resolve(db.rpc('wa310_campaign_save', { p: p })).then(function (r) {
        S.c.saving = false;
        if (r && r.error) { S.c.err = msgOf(r.error); repaint(); return; }
        S.c.newOpen = false; S.c.list = null; S.c.stale = true; say('Campaign made: now fill its folder');
        go('#crm/folders/' + (r.data && r.data.id));
      });
      return;
    }
    if (t.hasAttribute('data-w310edit')) { S.c.edit = true; S.c.draft = null; S.c.err = ''; repaint(); return; }
    if (t.hasAttribute('data-w310cancel')) { S.c.edit = false; S.c.draft = null; S.c.err = ''; repaint(); return; }
    if (t.hasAttribute('data-w310add')) { var k = t.getAttribute('data-w310add'); if (S.c.draft) { if (S.c.draft[k].length >= 20) return; S.c.draft[k].push(k === 'facts' ? { label: '', value: '' } : { label: '', url: '' }); repaint(); } return; }
    if (t.hasAttribute('data-w310del')) { var q = t.getAttribute('data-w310del').split('.'); if (S.c.draft) { S.c.draft[q[0]].splice(Number(q[1]), 1); repaint(); } return; }
    if (t.hasAttribute('data-w310save')) {
      var out = draftOut();
      if (out.name.length < 3) { S.c.err = 'Give the campaign a name.'; repaint(); return; }
      var bad = out.links.filter(function (x) { return !okUrl(x.url); })[0];
      if (bad) { S.c.err = 'Links start with https:// (' + String(bad.url).slice(0, 40) + ')'; repaint(); return; }
      S.c.saving = true; S.c.err = ''; repaint();
      Promise.resolve(db.rpc('wa310_campaign_save', { p: out })).then(function (r) {
        S.c.saving = false;
        if (r && r.error) { S.c.err = msgOf(r.error); repaint(); return; }
        S.c.edit = false; S.c.draft = null; S.c.stale = true; say('Folder saved'); cLoad(S.c.id);
      });
      return;
    }
    if (t.hasAttribute('data-w310copy')) { var v = t.getAttribute('data-w310copy'); try { navigator.clipboard.writeText(v).then(function () { say('Link copied'); }, function () { say(v); }); } catch (x) { say(v); } return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w310 [data-w310ed]')) return;
    if (t.hasAttribute('data-w310k')) draftSet(t.getAttribute('data-w310k'), t.value);
    else if (t.hasAttribute('data-w310f')) draftSet(t.getAttribute('data-w310f'), t.value);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w310 [data-w310ed]')) return;
    if (t.hasAttribute('data-w310k')) draftSet(t.getAttribute('data-w310k'), t.value);
  });

  /* =====================================================================
     The Photo library: the albums in Google Photos (the library's paint calls albumsHtml)
     ===================================================================== */
  function loadAlbums() {
    if (S.albums || S.albumsBusy) return;
    S.albumsBusy = Promise.resolve(db.from('wa_photo_albums').select('id,label,url,taken_on,note').order('taken_on', { ascending: false, nullsFirst: false }).limit(40)).then(function (r) {
      S.albums = (r && !r.error && r.data) || []; S.albumsBusy = null; albumsPaint();
    }).catch(function () { S.albums = []; S.albumsBusy = null; });
  }
  function albumsPaint() { var el = document.querySelector('.w310al'); if (el) el.outerHTML = albumsHtml(); }
  function albumsHtml() {
    css(); if (!S.albums) loadAlbums();
    var al = S.albums || [];
    var canAdd = staff();
    return '<div class="w310al" data-w118c="1"><b class="h">The albums in Google Photos</b>'
      + 'The team’s photos live in Google Photos (thousands of them). The library below holds the ones picked, labelled and cleared to use. Google stopped letting other apps read albums in March 2025, so the Hub cannot copy them by itself: open an album, download the best few, then Add photos.'
      + (al.length ? '<div class="als">' + al.map(function (a) { return '<a href="' + E(a.url) + '" target="_blank" rel="noopener" data-w198skip>' + E(a.label) + (a.taken_on ? ' · ' + E(dayTxt(a.taken_on)) : '') + '</a>'; }).join('') + '</div>' : (S.albums ? '<p style="margin:6px 0 0;color:' + MUTED + '">No album listed yet.</p>' : ''))
      + (canAdd ? (S.albumOpen ? '<div class="f"><input id="w310alab" maxlength="80" placeholder="Album name, e.g. Oberoi serving, 1 Nov" data-w198skip><input id="w310aurl" type="url" inputmode="url" placeholder="https://photos.app.goo.gl/..."><button type="button" data-w310asave="1"' + (S.albumSaving ? ' disabled' : '') + '>' + (S.albumSaving ? 'Adding…' : 'Add it') + '</button></div>' + (S.albumErr ? '<p class="err" style="color:' + FLAG + ';margin:4px 0 0">' + E(S.albumErr) + '</p>' : '')
        : '<div class="acts"><button type="button" data-w310aopen="1">+ List an album</button><a href="#photos/new">Add photos to the library</a></div>') : '')
      + '</div>';
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-w310aopen],[data-w310asave]') : null; if (!t) return;
    if (t.hasAttribute('data-w310aopen')) { S.albumOpen = true; S.albumErr = ''; albumsPaint(); var i = document.getElementById('w310alab'); if (i) i.focus(); return; }
    var lab = ((document.getElementById('w310alab') || {}).value || '').trim(), url = ((document.getElementById('w310aurl') || {}).value || '').trim();
    if (lab.length < 2) { S.albumErr = 'Give the album a name.'; albumsPaint(); return; }
    if (!/^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl\/photos)\//i.test(url)) { S.albumErr = 'Paste the album’s share link (https://photos.app.goo.gl/...).'; albumsPaint(); return; }
    S.albumSaving = true; S.albumErr = ''; albumsPaint();
    var me = ''; try { me = (USER && USER.email) || ''; } catch (x) { /* fine */ }
    Promise.resolve(db.from('wa_photo_albums').insert({ label: lab.slice(0, 80), url: url.slice(0, 500), added_by: me || null })).then(function (r) {
      S.albumSaving = false;
      if (r && r.error) { S.albumErr = 'Not added: ' + msgOf(r.error); albumsPaint(); return; }
      S.albumOpen = false; S.albums = null; say('Album listed'); loadAlbums();
    });
  });

  /* page tours (Hub page tours): Campaigns and Email insights */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return false; if (W.tours.crmcampaigns) return true;
      var T = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      var OPT = { opt: 1 };
      W.tours.crmcampaigns = { tab: 'crm', icon: 'box', hash: '#crm/folders', steps: [
        T('#w153rail [data-w153go="#crm/folders"]', 'Campaigns', 'Every campaign has a folder here: a drive, an appeal, an event, a challenge. New to one? Start here instead of searching Slack.', OPT),
        T('#w310 [data-w310new]', 'Add a campaign', 'Anyone on the team can add one: its name, what it is, the year and the goal.', OPT),
        T('#w310 .grid', 'Each campaign', 'The goal and what has been given so far, its forms, its posts and how full its folder is. Open one to see everything.', OPT),
        { c: 1, t: 'Inside a campaign', p: 'What it is (the why and the how), the key facts and rules, the folder of links (Drive, the one-pager, Canva), its hashtags, then what the Hub already knows: the forms that file under it, its posts in the Content calendar, the gifts, its donation link and its volunteers. Edit the folder keeps it up to date for the next person.' }
      ] };
      W.tours.crminsights = { tab: 'crm', icon: 'chart', hash: '#crm/insights', steps: [
        T('#w153rail [data-w153go="#crm/insights"]', 'Email insights', 'How our emails do and when our contacts open them.', OPT),
        T('#w310 .kpis', 'The numbers', 'Sent, delivered, opened, clicked and unsubscribed, for the emails the Hub sends (not the tests).', OPT),
        T('#w310 table.heat', 'When people open', 'Weekday by time of day, Toronto time: the darker the gold, the more opens. Until opens are counted it shows when the emails went out.', OPT),
        T('#w310 ol.plan', 'Find our best send time', 'Send four newsletters at four different times, one a week, then read the month here.', OPT)
      ] };
      return true;
    } catch (e) { return false; }
  }
  if (!addTours()) { var tt = 0, tiv = setInterval(function () { if (addTours() || ++tt > 40) clearInterval(tiv); }, 500); }

  window.w310 = { btnPick: btnPick, ctaPick: ctaPick, formDonate: formDonate, route: route, paintCrm: paintCrm, albumsHtml: albumsHtml, state: function () { return S; }, targetOf: targetOf, giveUrl: giveUrl };
})();
