-- 15/11/26 - wave347 release: the count form in Program Builder (live and editable), on the counter's own page.
-- One block: if any check fails, nothing changes. Made against the Hub page 2b3d3fdf0c145b1bfdafabe2e3bb3311 (wave345) and the volunteer page d7fd712f821cc84365acd8f30850284e.
-- What changes: Program Builder gets a Forms tab (the count, live; its questions, editable). The count on a lead's page reads
-- those questions. The count belongs to the person given "The count" on the event's Team tab (a community lead, or a server it
-- is lent to), with the team leader as backup; with nobody given it, every community lead and the team leader, as before.
-- Nobody is messaged by this release. Undo: "15-11-26 - wave347 undo (only if needed).sql".

create table if not exists public.site_files_bak_wa347 (path text, part int, content text, updated_at timestamptz);
alter table public.site_files_bak_wa347 enable row level security;
revoke all on public.site_files_bak_wa347 from anon, authenticated;
grant all on public.site_files_bak_wa347 to service_role;
comment on table public.site_files_bak_wa347 is 'wave347 (15/11/26): index.html and c/index.html before wave347, for its undo. Drop after a week.';
create table if not exists public.wa347_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa347_undo enable row level security;
revoke all on public.wa347_undo from anon, authenticated;
grant all on public.wa347_undo to service_role;
comment on table public.wa347_undo is 'wave347 (15/11/26): the two count functions as they were before wave347, for its undo. Drop after a week.';

do $pg$
declare v text; v_new text; c text; c_new text; n int; i int; sz int; o text; nw text;
  olds text[] := array[
  replace($o0$[['dash', 'Dashboard'], ['kpis', 'Programs and KPIs'], ['improve', 'Improvements'], ['library', 'Library']].map(function (t) {$o0$, chr(13), ''),
  replace($o1$P.tab = t === 'kpis' || t === 'improve' || t === 'library' ? t : 'dash';$o1$, chr(13), ''),
  replace($o2$var body = P.tab === 'kpis' ? kpiHtml() : P.tab === 'improve' ? impHtml() : P.tab === 'library' ? libHtml() : dashHtml();$o2$, chr(13), ''),
  replace($o3$+ (P.tab === 'library' ? '' : filters()) + '<div id="pbBody">' + body + '</div>';$o3$, chr(13), ''),
  replace($o4$      if (!what || what === 'library') { var l = await db.from('pb_library')$o4$, chr(13), ''),
  replace($o5$        { h: '#programs', l: 'Dashboard', ic: 'chart', page: 'programs' },
$o5$, chr(13), ''),
  replace($o6$/* =====================================================================
   WA v110 boot veil + self-provisioning$o6$, chr(13), '')];
  news text[] := array[
  replace($n0$[['dash', 'Dashboard'], ['forms', 'Forms'], ['kpis', 'Programs and KPIs'], ['improve', 'Improvements'], ['library', 'Library']].map(function (t) {   /* WA v347: Forms */$n0$, chr(13), ''),
  replace($n1$P.tab = t === 'kpis' || t === 'improve' || t === 'library' || t === 'forms' ? t : 'dash';$n1$, chr(13), ''),
  replace($n2$var body = P.tab === 'forms' ? (window.w347 && w347.html ? w347.html() : '') : P.tab === 'kpis' ? kpiHtml() : P.tab === 'improve' ? impHtml() : P.tab === 'library' ? libHtml() : dashHtml();$n2$, chr(13), ''),
  replace($n3$+ (P.tab === 'library' || P.tab === 'forms' ? '' : filters()) + '<div id="pbBody">' + body + '</div>';$n3$, chr(13), ''),
  replace($n4$      if (what === 'forms' && window.w347 && w347.load) await w347.load();   /* WA v347 */
      if (!what || what === 'library') { var l = await db.from('pb_library')$n4$, chr(13), ''),
  replace($n5$        { h: '#programs', l: 'Dashboard', ic: 'chart', page: 'programs' },
        { h: '#programs/forms', l: 'Forms', ic: 'list', page: 'programs' },
$n5$, chr(13), ''),
  replace($n6$/* =====================================================================
   WA v347 (15/11/26): Program Builder, Forms: the count, live and editable.
   Steel (14/11/26): the community lead's forms "built through the hub that would be stored and editable in the program builder";
   the count first (how many we serve, what we serve them, each person's demographics), taken by the community lead given The
   count "and or it can be assigned to a server"; "when data comes through, the program builder will be updated in live time".
   - #programs/forms: The count, live (the serving of the day: who counts, the total, each question's answers; refreshed every
     10 seconds while the tab is open) and The questions (the words in English and French, added questions with their choices,
     on or off). Age, sex, Indigenous and meal keep their list of choices: the dashboard and past reports are built on them.
   - The form itself is on the counter's own page (c/index.html, wave298): it reads these questions (volunteer_tally_get).
   Reads pb_form_get, pb_count_live; writes pb_form_save (the Program Development team, leads, admins).
   ===================================================================== */
(function () {
  if (window.w347) return;
  var F = { form: null, live: null, err: '', edit: null, busy: false, timer: 0, dirty: false };
  var CORE = { age: 1, sex: 1, bg: 1, meal: 1 };
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function msgOf(e) { return String((e && (e.message || e.details)) || e || '').replace(/^.*?ERROR:\s*/, '').slice(0, 220); }
  function on() { return /^#programs\/forms/.test(String(location.hash || '')); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function slug(s, taken) {
    var b = String(s || '').toLowerCase().normalize ? String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : String(s || '').toLowerCase();
    b = b.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[^a-z]+/, '').slice(0, 20) || 'q';
    var k = b, i = 2; while (taken.indexOf(k) >= 0) { k = b.slice(0, 18) + '_' + i; i++; } return k;
  }
  async function loadLive() {
    try { var r = await db.rpc('pb_count_live', { p_event: null }); if (r && r.error) throw r.error; F.live = r.data || {}; } catch (e) { F.live = F.live || null; }
  }
  async function load() {
    F.err = '';
    try { var r = await db.rpc('pb_form_get', { p_key: 'count' }); if (r && r.error) throw r.error; F.form = r.data; if (!F.dirty) F.edit = F.form ? clone(F.form.def) : null; }
    catch (e) { F.err = msgOf(e) || 'no answer'; }
    await loadLive();
    if (!F.timer) F.timer = setInterval(async function () {
      if (!on()) { clearInterval(F.timer); F.timer = 0; return; }
      if (document.hidden) return;
      await loadLive(); var el = document.getElementById('w347live'); if (el) el.innerHTML = liveInner();
    }, 10000);
  }
  function hm(t) { var m = String(t || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return ''; var h = Number(m[1]), ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (m[2] === '00' ? '' : ':' + m[2]) + ' ' + ap; }
  function dayTxt(iso) { try { return new Date(String(iso) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }); } catch (e) { return String(iso || ''); } }
  function fieldsNow() { return (F.form && F.form.def && F.form.def.fields) || []; }
  function bars(title, counts, opts, total) {
    var rows = opts.map(function (o) { var n = Number(counts[o.v] || 0); return [o.en, n]; });
    var known = opts.map(function (o) { return o.v; }), other = 0; Object.keys(counts || {}).forEach(function (k) { if (known.indexOf(k) < 0) other += Number(counts[k] || 0); });
    if (other) rows.push(['Not noted', other]);
    return '<div class="w347g"><h5>' + E(title) + '</h5>' + rows.map(function (r) {
      var pct = total ? Math.round(100 * r[1] / total) : 0;
      return '<div class="r"><span class="l">' + E(r[0]) + '</span><span class="b"><i style="width:' + pct + '%"></i></span><span class="n">' + r[1] + '</span></div>';
    }).join('') + '</div>';
  }
  function liveInner() {
    var L = F.live;
    if (!L) return '<p class="w347m">Loading the count…</p>';
    if (!L.event) return '<p class="w347m">No serving coming up. The count shows here on the day of a serving.</p>';
    var ev = L.event, total = Number(L.total || 0), by = L.by || {}, ex = L.extra || {};
    var who = (L.counters || []).map(function (c) { return E(c.name) + (c.given ? ' (has the count)' : c.role === 'team_leader' ? ' (team leader, backup)' : ''); });
    var st = L.open ? '<span class="w347pill on">Open now</span>' : '<span class="w347pill">Opens an hour before the start (' + E(hm(ev.start)) + ')</span>';
    var h = '<div class="w347ev"><div><b>' + E(dayTxt(ev.date)) + '</b>' + (ev.code ? ' · ' + E(ev.code) : '') + ' · ' + E(ev.city || '') + '</div>' + st + '</div>'
      + '<p class="w347m">' + (who.length ? 'Counting: ' + who.join(', ') + '.' : '<b>Nobody can open the count yet.</b> It needs a team leader or a community lead on the event.')
      + ' <a href="#volunteering/e/' + E(ev.id) + '">Who counts is set on the event’s Team tab</a>.</p>'
      + '<div class="w347big"><b>' + total + '</b><span>' + (total === 1 ? 'person counted' : 'people counted') + (L.last_at ? ' · last one at ' + E(new Date(L.last_at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })) : '') + '</span></div>';
    if (total) {
      h += '<div class="w347gs">' + fieldsNow().filter(function (f) { return CORE[f.k] || ex[f.k]; }).map(function (f) {
        return bars(f.en, CORE[f.k] ? (by[f.k] || {}) : (ex[f.k] || {}), f.o || [], total);
      }).join('') + '</div>';
      var bc = L.by_counter || {}, ks = Object.keys(bc);
      if (ks.length > 1) h += '<p class="w347m">' + ks.map(function (k) { return E(k) + ': ' + bc[k]; }).join(' · ') + '</p>';
    }
    h += '<p class="w347m">' + (L.preview ? '<a href="' + E(L.preview) + '" target="_blank" rel="noopener">See the form as the counter sees it</a> (a preview: nothing is saved). ' : '') + 'This card refreshes every 10 seconds.</p>';
    return h;
  }
  function optRow(f, fi, o, oi, can) {
    return '<div class="w347o' + (o.active === false ? ' off' : '') + '"><input type="text" maxlength="40" value="' + E(o.en || '') + '" placeholder="Choice, in English" data-w347i="' + fi + '.' + oi + '.en"' + (can ? '' : ' disabled') + ' aria-label="Choice in English">'
      + '<input type="text" maxlength="40" value="' + E(o.fr || '') + '" placeholder="En français" data-w347i="' + fi + '.' + oi + '.fr"' + (can ? '' : ' disabled') + ' aria-label="Choice in French">'
      + (can && !f.core ? '<button type="button" class="w347x" data-w347do="delopt" data-f="' + fi + '" data-o="' + oi + '" aria-label="Remove this choice">×</button>' : '') + '</div>';
  }
  function editorHtml() {
    var d = F.edit, can = !!(F.form && F.form.can);
    if (!d) return '<p class="w347m">' + (F.err ? 'Could not load the form: ' + E(F.err) : 'Loading the questions…') + '</p>';
    var h = '<p class="w347m">These are the taps the counter sees for each person, in this order. Change the words here and the form on their phone follows the next time it opens.</p>';
    h += (d.fields || []).map(function (f, fi) {
      return '<div class="w347f' + (f.active === false ? ' off' : '') + '"><div class="w347fh"><input type="text" maxlength="60" value="' + E(f.en || '') + '" placeholder="Question, in English" data-w347i="' + fi + '.en"' + (can ? '' : ' disabled') + ' aria-label="Question in English">'
        + '<input type="text" maxlength="60" value="' + E(f.fr || '') + '" placeholder="En français" data-w347i="' + fi + '.fr"' + (can ? '' : ' disabled') + ' aria-label="Question in French"></div>'
        + (f.core ? '<p class="w347n">On every count. The list of choices is fixed (the dashboard and past reports are built on it); the words can change.</p>'
          : '<div class="w347fo"><label><input type="checkbox" data-w347do="active" data-f="' + fi + '"' + (f.active === false ? '' : ' checked') + (can ? '' : ' disabled') + '> On the form</label>'
            + '<label><input type="checkbox" data-w347do="multi" data-f="' + fi + '"' + (f.m ? ' checked' : '') + (can ? '' : ' disabled') + '> Several choices can be tapped</label>'
            + (can ? '<button type="button" class="w347lk" data-w347do="delq" data-f="' + fi + '">Remove this question</button>' : '') + '</div>')
        + '<div class="w347os">' + (f.o || []).map(function (o, oi) { return optRow(f, fi, o, oi, can); }).join('') + '</div>'
        + (can && !f.core && (f.o || []).length < 8 ? '<button type="button" class="w347lk" data-w347do="addopt" data-f="' + fi + '">+ Add a choice</button>' : '') + '</div>';
    }).join('');
    h += can ? '<div class="w347ft">' + ((d.fields || []).length < 12 ? '<button type="button" class="w347b" data-w347do="addq">+ Add a question</button>' : '')
        + '<button type="button" class="w347b pri" data-w347do="save"' + (F.busy ? ' disabled' : '') + '>Save the form</button>' + (F.dirty ? '<span class="w347m">Not saved yet.</span>' : (F.form.updated_at ? '<span class="w347m">Last saved ' + E(String(F.form.updated_at).slice(0, 10)) + (F.form.updated_by && F.form.updated_by !== 'wave347' ? ' by ' + E(F.form.updated_by) : '') + '.</span>' : '')) + '</div>'
      : '<p class="w347m">The Program Development team, leads and admins change this form.</p>';
    return h;
  }
  function html() {
    css();
    return '<section class="w347c"><h3>The count, live</h3><div id="w347live">' + liveInner() + '</div></section>'
      + '<section class="w347c"><h3>The count: its questions</h3><div id="w347ed">' + editorHtml() + '</div></section>'
      + '<section class="w347c quiet"><h3>Where the other answers are</h3><p class="w347m">The volunteers’ survey and the community leads’ debrief are on each person’s own page after a serving; their questions are in Volunteer Manager, Settings, Text settings. Their answers are on the Dashboard tab.</p></section>';
  }
  function redraw() { var el = document.getElementById('w347ed'); if (el) el.innerHTML = editorHtml(); }
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.hasAttribute('data-w347i') || !F.edit) return;
    var p = t.getAttribute('data-w347i').split('.'), f = F.edit.fields[Number(p[0])]; if (!f) return;
    if (p.length === 2) f[p[1]] = t.value; else if (f.o && f.o[Number(p[1])]) f.o[Number(p[1])][p[2]] = t.value;
    if (!F.dirty) { F.dirty = true; var ft = document.querySelector('#w347ed .w347ft .w347m'); if (ft) ft.textContent = 'Not saved yet.'; }
  });
  async function act(t) {
    var a = t.getAttribute('data-w347do'), d = F.edit; if (!d) return;
    var fi = Number(t.getAttribute('data-f')), f = d.fields[fi];
    if (a === 'active' && f) { f.active = t.checked; F.dirty = true; redraw(); return; }
    if (a === 'multi' && f) { f.m = t.checked; F.dirty = true; redraw(); return; }
    if (a === 'addopt' && f) { f.o.push({ v: '', en: '', fr: '', active: true }); F.dirty = true; redraw(); var ins = document.querySelectorAll('#w347ed .w347f')[fi]; if (ins) { var l = ins.querySelectorAll('.w347o input[data-w347i$=".en"]'); if (l.length) l[l.length - 1].focus(); } return; }
    if (a === 'delopt' && f) { if (f.o.length <= 1) { say('A question needs at least one choice.'); return; } f.o.splice(Number(t.getAttribute('data-o')), 1); F.dirty = true; redraw(); return; }
    if (a === 'delq' && f && !f.core) { d.fields.splice(fi, 1); F.dirty = true; redraw(); return; }
    if (a === 'addq') { d.fields.push({ k: '', core: false, active: true, m: false, en: '', fr: '', o: [{ v: '', en: '', fr: '', active: true }, { v: '', en: '', fr: '', active: true }] }); F.dirty = true; redraw(); var qs = document.querySelectorAll('#w347ed .w347f'); if (qs.length) { var q = qs[qs.length - 1].querySelector('input'); if (q) q.focus(); } return; }
    if (a === 'save') {
      if (F.busy) return;
      var out = clone(d), keys = out.fields.map(function (x) { return x.k; }).filter(Boolean), bad = '';
      out.fields.forEach(function (x) {
        if (!String(x.en || '').trim()) bad = bad || 'Every question needs its English words.';
        if (!x.k) { x.k = slug(x.en, keys); keys.push(x.k); }
        var vs = x.o.map(function (o) { return o.v; }).filter(Boolean);
        x.o.forEach(function (o) { if (!String(o.en || '').trim()) bad = bad || 'Every choice needs its English words.'; if (!o.v) { o.v = slug(o.en, vs); vs.push(o.v); } });
      });
      if (bad) { say(bad); return; }
      F.busy = true; redraw();
      try { var r = await db.rpc('pb_form_save', { p_key: 'count', p_def: out }); if (r && r.error) throw r.error; F.form = r.data; F.edit = clone(F.form.def); F.dirty = false; say('The count form is saved'); }
      catch (e) { say('Could not save: ' + msgOf(e)); }
      F.busy = false; redraw(); var lv = document.getElementById('w347live'); if (lv) lv.innerHTML = liveInner();
    }
  }
  document.addEventListener('click', function (e) { var t = e.target && e.target.closest ? e.target.closest('#programs button[data-w347do]') : null; if (t) { e.preventDefault(); act(t); } });
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.matches && t.matches('#programs input[type="checkbox"][data-w347do]')) act(t); });
  window.addEventListener('beforeunload', function (e) { if (F.dirty && on()) { e.preventDefault(); e.returnValue = ''; } });
  var done = false;
  function css() {
    if (done) return; done = true;
    var G = '#103F39', MUT = '#5a6663', LINE = 'rgba(16,63,57,.10)', P = '#programs ';
    var st = document.createElement('style'); st.id = 'wa347css';
    st.textContent = P + '.w347c{background:#fff;border:1px solid ' + LINE + ';border-radius:14px;padding:18px 20px;margin:0 0 14px;}'
      + P + '.w347c h3{margin:0 0 10px;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:' + G + ';}'
      + P + '.w347c.quiet{background:transparent;}' + P + '.w347m{margin:6px 0;font-size:13px;line-height:1.5;color:' + MUT + ';}' + P + '.w347m a{color:' + G + ';font-weight:600;}'
      + P + '.w347ev{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;font-size:14.5px;color:#1F201E;}'
      + P + '.w347pill{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(16,63,57,.07);font-size:12px;font-weight:600;color:' + MUT + ';}' + P + '.w347pill.on{background:rgba(42,140,122,.16);color:#1c6b5d;}'
      + P + '.w347big{display:flex;align-items:baseline;gap:10px;margin:12px 0 6px;}' + P + '.w347big b{font:700 54px/1 "Barlow Condensed","Arial Narrow",Arial,sans-serif;color:' + G + ';font-variant-numeric:tabular-nums;}' + P + '.w347big span{font-size:13.5px;color:' + MUT + ';}'
      + P + '.w347gs{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px 24px;margin:12px 0 6px;}'
      + P + '.w347g h5{margin:0 0 6px;font-size:12.5px;font-weight:700;color:' + G + ';}'
      + P + '.w347g .r{display:grid;grid-template-columns:minmax(0,1fr) 84px 30px;align-items:center;gap:8px;font-size:13px;padding:2px 0;}'
      + P + '.w347g .l{overflow-wrap:anywhere;}' + P + '.w347g .b{height:6px;border-radius:6px;background:rgba(16,63,57,.08);overflow:hidden;}' + P + '.w347g .b i{display:block;height:100%;background:#2A8C7A;border-radius:6px;}'
      + P + '.w347g .n{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;}'
      + P + '.w347f{padding:14px 0;border-top:1px solid ' + LINE + ';}' + P + '.w347f.off{opacity:.6;}'
      + P + '.w347fh,' + P + '.w347o{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px;gap:8px;align-items:center;margin:0 0 6px;}'
      + P + '.w347fh input{font-weight:600;}' + P + '.w347os{margin:8px 0 2px 16px;}'
      + P + '.w347c input[type="text"]{min-height:40px;padding:7px 10px;border:1px solid rgba(16,63,57,.22);border-radius:10px;background:#fff;font:inherit;font-size:14px;color:#1F201E;min-width:0;width:100%;box-sizing:border-box;}'
      + P + '.w347n{margin:2px 0 4px;font-size:12px;color:' + MUT + ';}'
      + P + '.w347fo{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;font-size:13px;margin:4px 0;}' + P + '.w347fo label{display:inline-flex;align-items:center;gap:7px;cursor:pointer;min-height:32px;}' + P + '.w347fo input{width:17px;height:17px;accent-color:' + G + ';}'
      + P + '.w347x{width:32px;height:32px;border:0;border-radius:50%;background:none;color:' + MUT + ';font-size:18px;line-height:1;cursor:pointer;}'
      + P + '.w347lk{border:0;background:none;padding:6px 0;font:600 13px/1.3 inherit;font-family:inherit;color:' + G + ';cursor:pointer;text-decoration:underline;text-underline-offset:3px;}'
      + P + '.w347ft{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:14px;padding-top:14px;border-top:1px solid ' + LINE + ';}'
      + P + '.w347b{font:600 13.5px/1 inherit;font-family:inherit;padding:11px 16px;border-radius:999px;border:1px solid rgba(16,63,57,.25);background:#fff;color:' + G + ';cursor:pointer;touch-action:manipulation;transition:transform .12s cubic-bezier(.23,1,.32,1);}'
      + P + '.w347b.pri{background:' + G + ';color:#fff;border-color:' + G + ';}' + P + '.w347b:active{transform:scale(.97);}' + P + '.w347b[disabled]{opacity:.55;cursor:default;}'
      + '@media (hover:hover) and (pointer:fine){' + P + '.w347x:hover{background:rgba(179,64,47,.1);color:#B3402F;}}'
      + '@media (max-width:640px){' + P + '.w347fh,' + P + '.w347o{grid-template-columns:minmax(0,1fr) 32px;}' + P + '.w347fh input:nth-child(2),' + P + '.w347o input:nth-child(2){grid-column:1;}' + P + '.w347os{margin-left:0;}}'
      + '@media (pointer:coarse){' + P + '.w347c input[type="text"]{font-size:16px;}}';
    document.head.appendChild(st);
  }
  window.w347 = { html: html, load: load, state: function () { return F; } };
})();

/* =====================================================================
   WA v110 boot veil + self-provisioning$n6$, chr(13), '')];
  colds text[] := array[
  replace($co0$if (!S.d || S.d.cancelled || ['team_leader', 'community_debrief', 'community_talker'].indexOf(role) < 0) return;$co0$, chr(13), ''),
  replace($co1$      + row('age', 'tAge', [['child', 'child'], ['youth', 'youth'], ['adult', 'adult'], ['senior', 'senior']])
      + row('sex', 'tSex', [['man', 'man'], ['woman', 'woman'], ['non_binary', 'nb']])
      + row('bg', 'tBg', [['indigenous', 'ind'], ['non_indigenous', 'non']])
      + row('meal', 'tMeal', [['standard', 'std'], ['special', 'spc']])
$co1$, chr(13), ''),
  replace($co2$  function tallyShow() { return !!(S.tal && (S.tal.open || S.test)); }$co2$, chr(13), ''),
  replace($co3$if (b.hasAttribute('data-tly')) { var k = b.getAttribute('data-tly'), v = b.getAttribute('data-v'); S.tp[k] = S.tp[k] === v ? null : v; paint(); return; }$co3$, chr(13), ''),
  replace($co4$var x = { cid: tCid(), age: S.tp.age || 'unknown', sex: S.tp.sex || 'unknown', bg: S.tp.bg || 'unknown', meal: S.tp.meal || 'standard' };$co4$, chr(13), ''),
  replace($co5$.tly .row button{flex:1 1 0;min-width:0;padding:0 4px;min-height:48px;$co5$, chr(13), '')];
  cnews text[] := array[
  replace($cn0$if (!S.d || S.d.cancelled) return;   /* wave347: the database says who counts (the count can be given to one lead, or lent to a server) */$cn0$, chr(13), ''),
  replace($cn1$      + (tForm() ? tForm().map(rowF).join('')   /* wave347: the questions as the Program Builder has them; the four below when it sends none */
        : row('age', 'tAge', [['child', 'child'], ['youth', 'youth'], ['adult', 'adult'], ['senior', 'senior']])
      + row('sex', 'tSex', [['man', 'man'], ['woman', 'woman'], ['non_binary', 'nb']])
      + row('bg', 'tBg', [['indigenous', 'ind'], ['non_indigenous', 'non']])
      + row('meal', 'tMeal', [['standard', 'std'], ['special', 'spc']]))
$cn1$, chr(13), ''),
  replace($cn2$  function tallyShow() { return !!(S.tal && (S.tal.open || S.test)); }
  /* wave347: the count form's questions come with volunteer_tally_get (pb_forms 'count', edited in Program Builder) */
  function tForm() { var f = S.tal && S.tal.form; return f && f.fields && f.fields.length ? f.fields : null; }
  function rowF(f) {
    var p = S.tp || {}, fr = S.lang === 'fr', lab = (fr && f.fr) || f.en || f.k, cur = p[f.k];
    return '<div class="w">' + E(lab) + '</div><div class="row" role="group" aria-label="' + E(lab) + '">' + (f.o || []).map(function (o) {
      var on = f.m ? (Array.isArray(cur) && cur.indexOf(o[0]) >= 0) : cur === o[0];
      return '<button type="button" data-tly="' + E(f.k) + '" data-v="' + E(o[0]) + '"' + (f.m ? ' data-m="1"' : '') + ' aria-pressed="' + (on ? 'true' : 'false') + '"' + (on ? ' class="on"' : '') + '>' + E((fr && o[2]) || o[1] || o[0]) + '</button>';
    }).join('') + '</div>';
  }$cn2$, chr(13), ''),
  replace($cn3$if (b.hasAttribute('data-tly')) { var k = b.getAttribute('data-tly'), v = b.getAttribute('data-v'); if (b.hasAttribute('data-m')) { var a347 = Array.isArray(S.tp[k]) ? S.tp[k].slice() : [], i347 = a347.indexOf(v); if (i347 >= 0) a347.splice(i347, 1); else a347.push(v); S.tp[k] = a347; } else S.tp[k] = S.tp[k] === v ? null : v; paint(); return; }$cn3$, chr(13), ''),
  replace($cn4$var x = { cid: tCid(), age: S.tp.age || 'unknown', sex: S.tp.sex || 'unknown', bg: S.tp.bg || 'unknown', meal: S.tp.meal || 'standard' };
            var ex347 = {}; (tForm() || []).forEach(function (f) { if (['age', 'sex', 'bg', 'meal'].indexOf(f.k) >= 0) return; var v347 = S.tp[f.k]; if (v347 && (!Array.isArray(v347) || v347.length)) ex347[f.k] = v347; }); if (Object.keys(ex347).length) x.ex = ex347;   /* wave347: the added questions */$cn4$, chr(13), ''),
  replace($cn5$.tly .row button{flex:1 1 72px;min-width:0;padding:4px 8px;line-height:1.15;overflow-wrap:anywhere;min-height:48px;$cn5$, chr(13), '')];
begin
  select string_agg(content, '' order by part) into v from public.site_files where path = 'index.html';
  select string_agg(content, '' order by part) into c from public.site_files where path = 'c/index.html';
  if v is null or c is null then raise exception 'a page is missing'; end if;
  if (select count(*) from public.site_files where path = 'index.html') <> 10 or (select count(*) from public.site_files where path = 'c/index.html') <> 1 then raise exception 'the pages are not in the expected parts'; end if;
  if position('window.w347 = ' in v) > 0 or position('wave347' in c) > 0 then raise exception 'wave347 is already in'; end if;
  if md5(v) <> '2b3d3fdf0c145b1bfdafabe2e3bb3311' then raise exception 'index.html has moved since this file was made (md5 %)', md5(v); end if;
  if md5(c) <> 'd7fd712f821cc84365acd8f30850284e' then raise exception 'c/index.html has moved since this file was made (md5 %)', md5(c); end if;
  if not exists (select 1 from public.site_files_bak_wa347) then
    insert into public.site_files_bak_wa347 select path, part, content, updated_at from public.site_files where path in ('index.html', 'c/index.html');
  end if;
  insert into public.wa347_undo (k, v) select p.proname, pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('volunteer_tally_get', 'volunteer_tally_add') on conflict (k) do nothing;
  if (select count(*) from public.wa347_undo) <> 2 then raise exception 'could not save what the undo needs'; end if;
  execute $db347$
-- wave347 database part: the count form lives in the Program Builder (editable), can be lent to a server, and shows live.

create table if not exists public.pb_forms (key text primary key, title text not null, def jsonb not null, updated_at timestamptz not null default now(), updated_by text);
alter table public.pb_forms enable row level security;
revoke all on public.pb_forms from anon, authenticated;
grant select on public.pb_forms to authenticated;
grant all on public.pb_forms to service_role;
drop policy if exists pb_forms_staff_read on public.pb_forms;
create policy pb_forms_staff_read on public.pb_forms for select to authenticated using ((select public.is_wa_staff()));
comment on table public.pb_forms is 'wave347: the forms the Program Development team edits in Program Builder (count = the people count on a lead''s page). Written through pb_form_save.';
alter table public.pb_tally add column if not exists extra jsonb;
comment on column public.pb_tally.extra is 'wave347: answers to the count form''s added questions (key -> option, or a list of options).';

insert into public.pb_forms (key, title, def, updated_by) values ('count', 'The count', $j${"fields":[
 {"k":"age","core":true,"active":true,"m":false,"en":"Age","fr":"Âge","o":[{"v":"child","en":"Child","fr":"Enfant","active":true},{"v":"youth","en":"Youth","fr":"Jeune","active":true},{"v":"adult","en":"Adult","fr":"Adulte","active":true},{"v":"senior","en":"Senior","fr":"Aîné·e","active":true}]},
 {"k":"sex","core":true,"active":true,"m":false,"en":"Sex","fr":"Sexe","o":[{"v":"man","en":"Man","fr":"Homme","active":true},{"v":"woman","en":"Woman","fr":"Femme","active":true},{"v":"non_binary","en":"Other","fr":"Autre","active":true}]},
 {"k":"bg","core":true,"active":true,"m":false,"en":"Indigenous","fr":"Autochtone","o":[{"v":"indigenous","en":"Yes","fr":"Oui","active":true},{"v":"non_indigenous","en":"No","fr":"Non","active":true}]},
 {"k":"meal","core":true,"active":true,"m":false,"en":"Meal","fr":"Repas","o":[{"v":"standard","en":"Standard","fr":"Standard","active":true},{"v":"special","en":"Special request","fr":"Demande spéciale","active":true}]},
 {"k":"also","core":false,"active":false,"m":true,"en":"Also received","fr":"A aussi reçu","o":[{"v":"clothing","en":"Clothing","fr":"Vêtements","active":true},{"v":"hygiene_kit","en":"Hygiene kit","fr":"Trousse d’hygiène","active":true},{"v":"resource_guide","en":"Resource guide","fr":"Guide de ressources","active":true}]}
]}$j$::jsonb, 'wave347') on conflict (key) do nothing;

create or replace function public.pb_can_edit() returns boolean language sql stable security definer set search_path to '' as $f$
  select coalesce(public.is_wa_staff(), false) and (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false)
    or exists (select 1 from public.team_members m where m.active and m.department = 'progdev' and lower(m.email) = lower(coalesce(auth.jwt()->>'email', ''))))
$f$;
revoke all on function public.pb_can_edit() from public, anon;
grant execute on function public.pb_can_edit() to authenticated, service_role;

-- the form as a lead's page needs it: switched-on questions and options only
create or replace function public.pb_form_public(p_key text) returns jsonb language sql stable security definer set search_path to '' as $f$
  select jsonb_build_object('fields', coalesce((select jsonb_agg(jsonb_build_object('k', f->>'k', 'en', f->>'en', 'fr', f->>'fr', 'm', coalesce((f->>'m')::boolean, false),
      'o', (select coalesce(jsonb_agg(jsonb_build_array(o->>'v', o->>'en', o->>'fr') order by oi), '[]'::jsonb) from jsonb_array_elements(f->'o') with ordinality x(o, oi) where coalesce((o->>'active')::boolean, true))) order by fi)
    from jsonb_array_elements(d.def->'fields') with ordinality y(f, fi) where coalesce((f->>'active')::boolean, true)), '[]'::jsonb))
  from public.pb_forms d where d.key = p_key
$f$;
revoke all on function public.pb_form_public(text) from public, anon, authenticated;
grant execute on function public.pb_form_public(text) to service_role;

create or replace function public.pb_form_get(p_key text) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  return (select jsonb_build_object('key', d.key, 'title', d.title, 'def', d.def, 'updated_at', d.updated_at,
            'updated_by', coalesce((select split_part(m.name, ' ', 1) from public.team_members m where lower(m.email) = lower(d.updated_by) limit 1), d.updated_by), 'can', public.pb_can_edit())
          from public.pb_forms d where d.key = p_key);
end $f$;
revoke all on function public.pb_form_get(text) from public, anon;
grant execute on function public.pb_form_get(text) to authenticated, service_role;

create or replace function public.pb_form_save(p_key text, p_def jsonb) returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_who text := lower(coalesce(auth.jwt()->>'email', 'staff')); old jsonb; f jsonb; o jsonb; of jsonb; keys text[] := '{}'; vals text[]; n int := 0; v_out jsonb := '[]'::jsonb; v_o jsonb; k text; v text;
        core jsonb := '{"age":["child","youth","adult","senior"],"sex":["man","woman","non_binary"],"bg":["indigenous","non_indigenous"],"meal":["standard","special"]}'::jsonb;
begin
  if not public.pb_can_edit() then raise exception 'Only the Program Development team, leads and admins change this form.'; end if;
  select def into old from public.pb_forms where key = p_key;
  if old is null then raise exception 'No such form.'; end if;
  if p_def is null or jsonb_typeof(p_def->'fields') <> 'array' then raise exception 'The form needs its questions.'; end if;
  if jsonb_array_length(p_def->'fields') > 12 then raise exception 'At most 12 questions: the count has to stay quick.'; end if;
  for f in select value from jsonb_array_elements(p_def->'fields') loop
    k := lower(btrim(coalesce(f->>'k', '')));
    if k !~ '^[a-z][a-z0-9_]{1,23}$' then raise exception 'A question is missing its short name.'; end if;
    if k = any (keys) then raise exception 'Two questions share the short name %.', k; end if;
    keys := keys || k;
    if btrim(coalesce(f->>'en', '')) = '' then raise exception 'Every question needs its English words.'; end if;
    if length(f->>'en') > 60 or length(coalesce(f->>'fr', '')) > 60 then raise exception 'Keep a question under 60 characters: %', left(f->>'en', 30); end if;
    if jsonb_typeof(f->'o') <> 'array' or jsonb_array_length(f->'o') < 1 or jsonb_array_length(f->'o') > 8 then raise exception '"%" needs between 1 and 8 choices.', f->>'en'; end if;
    vals := '{}'; v_o := '[]'::jsonb;
    for o in select value from jsonb_array_elements(f->'o') loop
      v := lower(btrim(coalesce(o->>'v', '')));
      if v !~ '^[a-z][a-z0-9_]{0,23}$' then raise exception 'A choice under "%" is missing its short name.', f->>'en'; end if;
      if v = any (vals) then raise exception 'Two choices under "%" share a short name.', f->>'en'; end if;
      vals := vals || v;
      if btrim(coalesce(o->>'en', '')) = '' or length(o->>'en') > 40 or length(coalesce(o->>'fr', '')) > 40 then raise exception 'Every choice under "%" needs English words, under 40 characters.', f->>'en'; end if;
      v_o := v_o || jsonb_build_object('v', v, 'en', btrim(o->>'en'), 'fr', nullif(btrim(coalesce(o->>'fr', '')), ''), 'active', coalesce((o->>'active')::boolean, true));
    end loop;
    if core ? k then
      if (select array_agg(x order by x) from unnest(vals) x) is distinct from (select array_agg(x order by x) from jsonb_array_elements_text(core->k) x) then
        raise exception 'The choices of "%" feed the dashboard and past reports: their words can change, the list cannot.', f->>'en';
      end if;
    end if;
    v_out := v_out || jsonb_build_object('k', k, 'core', core ? k, 'active', case when core ? k then true else coalesce((f->>'active')::boolean, true) end,
      'm', case when core ? k then false else coalesce((f->>'m')::boolean, false) end, 'en', btrim(f->>'en'), 'fr', nullif(btrim(coalesce(f->>'fr', '')), ''), 'o', v_o);
    n := n + 1;
  end loop;
  for k in select jsonb_object_keys(core) loop
    if not (k = any (keys)) then raise exception 'Age, sex, Indigenous and meal stay on the form: the dashboard and funders'' reports are built on them.'; end if;
  end loop;
  update public.pb_forms set def = jsonb_build_object('fields', v_out), updated_at = now(), updated_by = v_who where key = p_key;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('pb_forms', p_key, 'def', left(old::text, 300), n || ' questions', v_who);
  return public.pb_form_get(p_key);
end $f$;
revoke all on function public.pb_form_save(text, jsonb) from public, anon;
grant execute on function public.pb_form_save(text, jsonb) to authenticated, service_role;

-- who may count at a serving: the person given The count (a community lead, or a server it was lent to) and the team leader;
-- when nobody has been given it, the team leader and every community lead, as before.
create or replace function public.pb_may_count(p_roster bigint) returns boolean language sql stable security definer set search_path to '' as $f$
  select case when lower(coalesce(r.role, '')) = 'team_leader' or coalesce(r.detail->>'cl_job', '') = 'count' then true
              when exists (select 1 from public.event_roster x where x.event_id = r.event_id and coalesce(x.detail->>'cl_job', '') = 'count'
                             and lower(coalesce(x.status, '')) not in ('cancelled', 'unavailable') and coalesce(x.confirm_status, '') <> 'declined') then false
              else lower(coalesce(r.role, '')) in ('community_debrief', 'community_talker') end
  from public.event_roster r where r.id = p_roster
$f$;
revoke all on function public.pb_may_count(bigint) from public, anon, authenticated;
grant execute on function public.pb_may_count(bigint) to service_role;

create or replace function public.volunteer_tally_get(p_token text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; v_n int; v_mine int;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, lower(coalesce(er.role, '')) as role, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time, e.location into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or not coalesce(public.pb_may_count(r.id), false) then return null; end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return null; end if;
  select count(*), count(*) filter (where roster_id = r.id) into v_n, v_mine from public.pb_tally where event_id = r.event_id;
  return jsonb_build_object('open', public.wa298_tally_open(r.event_date, r.start_time), 'preview', coalesce(p_preview, false),
    'day', r.event_date, 'start', coalesce(r.start_time, '12:00'::time), 'count', v_n, 'mine', v_mine, 'city', public.wa298_city(r.location),
    'form', public.pb_form_public('count'));   -- wave347: the questions, as the Program Builder has them
end $function$;

create or replace function public.volunteer_tally_add(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; x jsonb; v_added int := 0; v_n int; v_id bigint; v_form jsonb; f jsonb; v_ex jsonb; v_k text; v_ok text[];
begin
  if p_token is null or length(p_token) < 12 or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  select er.id, lower(coalesce(er.role, '')) as role, er.person_name, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time, e.location into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or not coalesce(public.pb_may_count(r.id), false) then return jsonb_build_object('ok', false); end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_on_it'); end if;
  if not public.wa298_tally_open(r.event_date, r.start_time) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  v_form := public.pb_form_public('count');
  for x in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(x) <> 'object' then continue; end if;
    if coalesce(x->>'cid', '') !~ '^[A-Za-z0-9_-]{4,40}$' then continue; end if;
    if coalesce(x->>'undo', '') = '1' then
      delete from public.pb_tally where roster_id = r.id and client_id = x->>'cid';
      continue;
    end if;
    if coalesce(x->>'age', 'unknown') not in ('child', 'youth', 'adult', 'senior', 'unknown')
       or coalesce(x->>'sex', 'unknown') not in ('man', 'woman', 'non_binary', 'unknown')
       or coalesce(x->>'bg', 'unknown') not in ('indigenous', 'non_indigenous', 'unknown')
       or coalesce(x->>'meal', 'standard') not in ('standard', 'special') then continue; end if;
    -- wave347: the added questions; anything that is not one of the form's choices is left out
    v_ex := null;
    if jsonb_typeof(x->'ex') = 'object' then
      for f in select value from jsonb_array_elements(coalesce(v_form->'fields', '[]'::jsonb)) loop
        v_k := f->>'k';
        if v_k in ('age', 'sex', 'bg', 'meal') or not (x->'ex') ? v_k then continue; end if;
        select coalesce(array_agg(o->>0), '{}') into v_ok from jsonb_array_elements(f->'o') o;
        if coalesce((f->>'m')::boolean, false) and jsonb_typeof(x->'ex'->v_k) = 'array' then
          v_ex := coalesce(v_ex, '{}'::jsonb) || jsonb_build_object(v_k, (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(x->'ex'->v_k) t where t = any (v_ok)));
        elsif jsonb_typeof(x->'ex'->v_k) = 'string' and (x->'ex'->>v_k) = any (v_ok) then
          v_ex := coalesce(v_ex, '{}'::jsonb) || jsonb_build_object(v_k, x->'ex'->>v_k);
        end if;
      end loop;
    end if;
    insert into public.pb_tally (event_id, served_on, city, age_group, sex, background, meal, source, roster_id, by_name, client_id, extra)
    values (r.event_id, r.event_date, public.wa298_city(r.location), coalesce(x->>'age', 'unknown'), coalesce(x->>'sex', 'unknown'), coalesce(x->>'bg', 'unknown'),
      coalesce(x->>'meal', 'standard'), 'hub', r.id, r.person_name, x->>'cid', v_ex)
    on conflict (roster_id, client_id) where client_id is not null do nothing
    returning id into v_id;
    if v_id is not null then v_added := v_added + 1; v_id := null; end if;
  end loop;
  select count(*) into v_n from public.pb_tally where event_id = r.event_id;
  return jsonb_build_object('ok', true, 'added', v_added, 'count', v_n);
end $function$;

-- the live count for one event (the next Montreal or Toronto serving when none is named), for Program Builder
create or replace function public.pb_count_live(p_event bigint default null) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare e record; v_today date := (now() at time zone 'America/Toronto')::date;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if p_event is not null then select * into e from public.volunteer_events where id = p_event;
  else select * into e from public.volunteer_events where kind in ('service', 'meal') and status <> 'cancelled' and event_date >= v_today - 1 order by (event_date < v_today), event_date limit 1; end if;
  if e.id is null then return jsonb_build_object('event', null); end if;
  return jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'code', e.code, 'date', e.event_date, 'start', coalesce(e.start_time, '12:00'::time), 'city', public.wa298_city(e.location)),
    'open', public.wa298_tally_open(e.event_date, e.start_time),
    'counters', (select coalesce(jsonb_agg(jsonb_build_object('name', r.person_name, 'role', r.role, 'given', coalesce(r.detail->>'cl_job', '') = 'count') order by (coalesce(r.detail->>'cl_job', '') = 'count') desc, r.role, r.person_name), '[]'::jsonb)
                   from public.event_roster r where r.event_id = e.id and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable') and coalesce(r.confirm_status, '') <> 'declined' and coalesce(public.pb_may_count(r.id), false)),
    'total', (select count(*) from public.pb_tally t where t.event_id = e.id),
    'preview', (select '/c/?t=' || r.confirm_token || '&test=1' from public.event_roster r where r.event_id = e.id and r.confirm_token is not null
                  and lower(coalesce(r.status, '')) not in ('cancelled', 'unavailable') and coalesce(r.confirm_status, '') <> 'declined' and coalesce(public.pb_may_count(r.id), false)
                order by (coalesce(r.detail->>'cl_job', '') = 'count') desc, r.id limit 1),
    'last_at', (select max(recorded_at) from public.pb_tally t where t.event_id = e.id),
    'by', jsonb_build_object(
      'age', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select age_group k, count(*) n from public.pb_tally where event_id = e.id group by 1) a),
      'sex', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select sex k, count(*) n from public.pb_tally where event_id = e.id group by 1) a),
      'bg', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select background k, count(*) n from public.pb_tally where event_id = e.id group by 1) a),
      'meal', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select meal k, count(*) n from public.pb_tally where event_id = e.id group by 1) a)),
    'extra', (select coalesce(jsonb_object_agg(fk, cnt), '{}'::jsonb) from (
                select fk, jsonb_object_agg(val, n) cnt from (
                  select kv.key fk, v.val, count(*) n from public.pb_tally t, jsonb_each(coalesce(t.extra, '{}'::jsonb)) kv,
                         lateral (select jsonb_array_elements_text(case when jsonb_typeof(kv.value) = 'array' then kv.value else jsonb_build_array(kv.value) end) val) v
                   where t.event_id = e.id group by 1, 2) q group by fk) z),
    'by_counter', (select coalesce(jsonb_object_agg(coalesce(by_name, 'someone'), n), '{}'::jsonb) from (select by_name, count(*) n from public.pb_tally where event_id = e.id group by 1) c));
end $f$;
revoke all on function public.pb_count_live(bigint) from public, anon;
grant execute on function public.pb_count_live(bigint) to authenticated, service_role;

$db347$;
  v_new := v;
  for i in 1..array_length(olds, 1) loop
    o := olds[i]; nw := news[i]; n := (length(v_new) - length(replace(v_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'index.html: edit % matches % times', i, n; end if;
    v_new := replace(v_new, o, nw);
  end loop;
  if md5(v_new) <> '34f03ac16a59f725426de426edf98d4e' then raise exception 'index.html: unexpected result %', md5(v_new); end if;
  c_new := c;
  for i in 1..array_length(colds, 1) loop
    o := colds[i]; nw := cnews[i]; n := (length(c_new) - length(replace(c_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'c/index.html: edit % matches % times', i, n; end if;
    c_new := replace(c_new, o, nw);
  end loop;
  if md5(c_new) <> '35ff7b95271996764d78e75667256547' then raise exception 'c/index.html: unexpected result %', md5(c_new); end if;
  sz := ceil(length(v_new) / 10.0);
  for i in 1..10 loop
    update public.site_files set content = substr(v_new, (i - 1) * sz + 1, sz), updated_at = now() where path = 'index.html' and part = i;
    if not found then raise exception 'index.html part % missing', i; end if;
  end loop;
  update public.site_files set content = c_new, updated_at = now() where path = 'c/index.html' and part = 1;
  if not found then raise exception 'c/index.html part 1 missing'; end if;
  if (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') <> '34f03ac16a59f725426de426edf98d4e' or (select md5(content) from public.site_files where path = 'c/index.html') <> '35ff7b95271996764d78e75667256547' then raise exception 'post-check failed'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave347', md5(v), md5(v_new) || ': Program Builder, Forms: the count, live and editable', 'wave347');
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave347', md5(c), md5(c_new) || ': the count reads its questions from Program Builder; it can be lent to a server', 'wave347');
end $pg$;
-- PUBLISH
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
