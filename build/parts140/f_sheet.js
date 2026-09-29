  /* ======================= the sheet: details and leaders' edits ======================= */
  var lastFocus = null;
  function openSheet(html, tag) {
    var o = document.getElementById('w140sheet');
    if (!o) {
      o = document.createElement('div'); o.id = 'w140sheet'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
      document.body.appendChild(o);
      o.addEventListener('click', function (e) { if (e.target === o) closeSheet(); });
    }
    if (!S.sheet) lastFocus = document.activeElement;
    S.sheet = tag || 'sheet';
    o.innerHTML = '<div class="sh"><button class="xb" data-w140close="1" aria-label="Close">' + I('x') + '</button>' + html + '</div>';
    o.style.display = 'flex';
    var f = o.querySelector('input,select,textarea') || o.querySelector('.xb'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function closeSheet() {
    var o = document.getElementById('w140sheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; }
    S.sheet = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
    lastFocus = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) { closeSheet(); } });

  function opt(list, cur) { return list.map(function (x) { var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + E(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>'; }).join(''); }
  function field(label, html, full, hint) { return '<label' + (full ? ' class="full"' : '') + '>' + E(label) + (hint ? ' <span class="hint">' + E(hint) + '</span>' : '') + html + '</label>'; }
  function inp(name, val, ph) { return '<input data-f="' + name + '" value="' + E(val == null ? '' : val) + '"' + (ph ? ' placeholder="' + E(ph) + '"' : '') + '>'; }
  function area(name, val) { return '<textarea data-f="' + name + '">' + E(val == null ? '' : val) + '</textarea>'; }
  function sel(name, list, cur) { return '<select data-f="' + name + '">' + opt(list, cur) + '</select>'; }
  var VIS = [['everyone', 'Everyone (staff and directors)'], ['leadership', 'Leaders and directors only']];
  var NUMS = [['meals', 'Meals', '350'], ['volunteers', 'Volunteers', '25'], ['people_helped', 'People helped', ''], ['attendees', 'Attendees', ''], ['raised_cad', 'Raised ($)', '2500']];
  /* 1,200 or $2 500 or 350 → a number; empty → null; anything else → NaN */
  function readNum(s) { s = String(s == null ? '' : s).replace(/[\s,$]/g, ''); if (!s) return null; var n = Number(s); return isFinite(n) && n >= 0 ? n : NaN; }

  function editForm(kind, id) {
    var html = '', row = null;
    if (kind === 'hist') {
      row = id ? (S.hist || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
      var h = row || { date_precision: 'day', kind: 'event', visibility: 'everyone', status: 'published', partners: [] };
      html = '<h2>' + (row ? 'Edit this moment' : 'Add a moment') + '</h2><div class="sub">Our story keeps what happened, with the date it happened. Say where it is written down in the summary if you can.</div><div class="w140form">' +
        field('When', inp('date', asTyped(h.date_start, h.date_precision), '2021-03-20, 2021-03 or 2021'), false, 'a day, a month or a year') +
        field('Until', inp('date_end', h.date_end ? asTyped(h.date_end, h.date_end_precision || 'day') : '', 'optional'), false, 'for something that ran a while') +
        field('Title', inp('title', h.title, 'First serving at Place Émilie-Gamelin'), true) +
        field('What happened', area('summary', h.summary), true) +
        field('Kind', sel('kind', KIND_ORDER.map(function (k) { return [k, KINDS[k][0]]; }), h.kind)) +
        field('City', inp('city', h.city, 'Montreal')) +
        field('Organizations', inp('partners', (h.partners || []).join(', '), 'Sportira, Vanier College Student Association'), true, 'separated by commas') +
        '<div class="full w140fh">The numbers <span>only what a document or post gives; leave the rest empty</span></div>' +
        NUMS.map(function (n) { return field(n[1], inp('n_' + n[0], (h.numbers && h.numbers[n[0]] != null) ? h.numbers[n[0]] : '', n[2])); }).join('') +
        field('Who sees it', sel('visibility', VIS, h.visibility)) +
        field('Shown', sel('status', [['published', 'In the story'], ['hidden', 'Hidden']], h.status)) +
        '<label class="chk full"><input type="checkbox" data-f="highlight"' + (h.highlight ? ' checked' : '') + '> One of the milestones at the top</label>' +
        '<div class="err" data-w140err></div></div>';
    } else if (kind === 'year') {
      row = (S.years || []).filter(function (y) { return String(y.year) === String(id); })[0] || { year: Number(id), summary: '' };
      html = '<h2>' + E(id) + '</h2><div class="sub">Two or three sentences on what the year was for Welfare Avenue, shown at the head of the year.</div><div class="w140form">' +
        field('The year in a few lines', area('summary', row.summary), true) + '<div class="err" data-w140err></div></div>';
    } else if (kind === 'partner') {
      row = id ? (S.partners || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
      var p = row || { category: 'partner', relationship: 'partner', status: 'active', visibility: 'everyone', aka: [] };
      html = '<h2>' + (row ? 'Edit ' + E(p.name) : 'Add a partner') + '</h2><div class="sub">An organization, never a private person or an individual donor.</div><div class="w140form">' +
        field('Name', inp('name', p.name), true) +
        field('Also written', inp('aka', (p.aka || []).join(', '), 'other names, separated by commas'), true) +
        field('Kind', sel('kind', [['', 'Choose']].concat(PKINDS.map(function (k) { return [k, k.charAt(0).toUpperCase() + k.slice(1)]; })), p.kind || '')) +
        field('City', inp('city', p.city)) +
        field('Type', sel('category', PCAT_ORDER.map(function (c) { return [c, PCATS[c][0]]; }), catOf(p)), false, 'partner: over time, toward a shared goal; collaborator: an event or an initiative; sponsor: money or in-kind support, with recognition') +
        field('How they help', sel('relationship', Object.keys(REL).map(function (r) { return [r, REL[r]]; }), p.relationship), false, 'the detail: a funder, a venue, a supplier ...') +
        field('Status', sel('status', Object.keys(STATUS).map(function (s) { return [s, STATUS[s][0]]; }), p.status)) +
        field('First year', inp('first_year', p.first_year, '2021')) + field('Last year', inp('last_year', p.last_year, String(yearNow()))) +
        field('What they did with us', area('summary', p.summary), true) +
        field('Contact', inp('contact_role', p.contact_role, 'a role, e.g. VP Events (never a phone or an email)'), true) +
        field('Who sees it', sel('visibility', VIS, p.visibility)) +
        field('Notes', inp('notes', p.notes, 'where the sources disagree, what to check'), false, 'shown with the partner') +
        '<div class="err" data-w140err></div></div>';
    } else if (kind === 'lesson') {
      row = id ? (S.lessons || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
      var l = row || { area: 'events', visibility: 'everyone', status: 'published' };
      html = '<h2>' + (row ? 'Edit this lesson' : 'Add a lesson') + '</h2><div class="sub">Advice the team can act on, and what happened that taught it.</div><div class="w140form">' +
        field('The lesson', area('lesson', l.lesson), true) +
        field('What happened', area('context', l.context), true) +
        field('Area', sel('area', AREAS, l.area)) + field('Topic', inp('topic', l.topic, 'Driver no-shows')) +
        field('Years', inp('years', l.years, '2021, 2023')) + field('Who sees it', sel('visibility', VIS, l.visibility)) +
        field('Shown', sel('status', [['published', 'In the list'], ['hidden', 'Hidden']], l.status)) +
        '<div class="err" data-w140err></div></div>';
    }
    html += '<div class="acts"><button class="w140btn ghost" data-w140close="1">Cancel</button><button class="w140btn" data-w140save="' + kind + '" data-id="' + E(id || '') + '">' + I('check') + ' Save</button></div>';
    openSheet(html, 'edit:' + kind + ':' + (id || 'new'));
  }
  function formVals() {
    var o = document.getElementById('w140sheet'), v = {};
    if (!o) return v;
    o.querySelectorAll('[data-f]').forEach(function (el) { v[el.getAttribute('data-f')] = el.type === 'checkbox' ? el.checked : String(el.value || '').trim(); });
    return v;
  }
  function showErr(m) { var el = document.querySelector('#w140sheet [data-w140err]'); if (el) el.textContent = m; }
  function list(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function yearNum(s) { var n = Number(String(s || '').trim()); return n >= 2000 && n <= 2100 ? n : null; }
  function stamp(row) { row.updated_by = myName() || 'a leader'; row.updated_at = nowIso(); return row; }

  async function saveEdit(kind, id) {
    var v = formVals(), row, table, cache, res;
    try {
      if (kind === 'hist') {
        var a = readDate(v.date, false); if (!a) { showErr('Give the date as 2021-03-20, 2021-03 or 2021.'); return; }
        var b = v.date_end ? readDate(v.date_end, true) : null; if (v.date_end && !b) { showErr('Give the end date as 2021-06-30, 2021-06 or 2021, or leave it empty.'); return; }
        if (!v.title) { showErr('Give it a title.'); return; }
        if (b && b.d < a.d) { showErr('The end date comes before the start.'); return; }
        var was = id ? (S.hist || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
        var nums = {}; Object.keys((was && was.numbers) || {}).forEach(function (k) { if (!NUMS.some(function (n) { return n[0] === k; })) nums[k] = was.numbers[k]; });
        for (var ni = 0; ni < NUMS.length; ni++) {
          var nv = readNum(v['n_' + NUMS[ni][0]]);
          if (nv !== nv) { showErr(NUMS[ni][1] + ' takes a number only, like 1200.'); return; }
          if (nv != null) nums[NUMS[ni][0]] = nv;
        }
        row = stamp({ date_start: a.d, date_precision: a.p, date_end: b ? b.d : null, date_end_precision: b ? b.p : null, title: v.title, summary: v.summary || null, kind: v.kind,
          city: v.city || null, partners: list(v.partners), numbers: Object.keys(nums).length ? nums : null, visibility: v.visibility, status: v.status, highlight: !!v.highlight });
        table = 'wa_history'; cache = 'hist';
      } else if (kind === 'year') {
        if (!v.summary) { showErr('Write a line or two, or cancel.'); return; }
        res = await db.from('wa_history_years').upsert({ year: Number(id), summary: v.summary, updated_by: myName() || 'a leader', updated_at: nowIso() }, { onConflict: 'year' }).select();
        if (res && res.error) throw res.error;
        var ys = (S.years || []).filter(function (y) { return String(y.year) !== String(id); }); ys.push((res.data && res.data[0]) || { year: Number(id), summary: v.summary }); S.years = ys;
        closeSheet(); toastS('Saved'); paintStory(); return;
      } else if (kind === 'partner') {
        if (!v.name) { showErr('Give the organization’s name.'); return; }
        if (/@|\+?\d[\d\s().-]{7,}\d/.test(v.contact_role || '')) { showErr('Contact takes a role only, never an email or a phone number.'); return; }
        if (PCATS[v.relationship] && v.relationship !== v.category) v.relationship = v.category;   /* how they help never contradicts the type */
        if ((v.relationship === 'funder' || v.relationship === 'donor organisation') && v.category !== 'sponsor') { showErr('A funder or a donor organization is a sponsor: pick Sponsor as the type, or another way they help.'); return; }
        row = stamp({ name: v.name, aka: list(v.aka), kind: v.kind || null, city: v.city || null, category: PCATS[v.category] ? v.category : 'partner', relationship: v.relationship, status: v.status, first_year: yearNum(v.first_year), last_year: yearNum(v.last_year),
          summary: v.summary || null, contact_role: v.contact_role || null, visibility: v.visibility, notes: v.notes || null });
        table = 'wa_partners'; cache = 'partners';
      } else if (kind === 'lesson') {
        if (!v.lesson) { showErr('Write the lesson.'); return; }
        row = stamp({ lesson: v.lesson, context: v.context || null, area: v.area, topic: v.topic || null, years: v.years || null, visibility: v.visibility, status: v.status });
        table = 'wa_lessons'; cache = 'lessons';
      } else return;
      if (id) res = await db.from(table).update(row).eq('id', Number(id)).select();
      else { row.key = 'hub-' + Date.now().toString(36); row.created_by = row.updated_by; row.sources = []; res = await db.from(table).insert(row).select(); }
      if (res && res.error) throw res.error;
      /* an update the database refused for this person comes back empty, not as an error */
      if (id && res && Array.isArray(res.data) && !res.data.length) { showErr('Could not save: only leaders can change this.'); return; }
      var old = id ? (S[cache] || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
      var saved = Object.assign({}, old || {}, row, (res && res.data && res.data[0]) || {});
      if (saved.id == null) saved.id = id ? Number(id) : ('tmp' + Date.now());
      var arr = (S[cache] || []).filter(function (x) { return String(x.id) !== String(saved.id); }); arr.push(saved);
      if (cache === 'hist') arr.sort(function (x, y) { return String(x.date_start).localeCompare(String(y.date_start)); });
      S[cache] = arr; if (cache === 'partners') indexPartners();
      closeSheet(); toastS(id ? 'Saved' : 'Added');
      if (cache === 'partners') paintPartners(); else paintStory();
      if (cache === 'hist' && saved.id) setTimeout(function () { flashEv(saved.id); }, 80);
    } catch (e) { showErr('Could not save: ' + String((e && e.message) || e).slice(0, 140)); }
  }
