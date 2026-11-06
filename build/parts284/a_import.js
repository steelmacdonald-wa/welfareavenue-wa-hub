/* =====================================================================
   WA v284 The Import page (#crm/settings/imports): Keela's exports staged, compared and applied in batches (06/11/26, CRM slice 1 Phase 4)
   =====================================================================
   Admins only (wa_can import_admin through window.w152.can; the database and crm-import check it again). One run at a time, with a picker
   for earlier runs. A file is uploaded to the private bucket imports (the run's folder), recorded and staged by crm-import 5,000 rows a call;
   its keys are listed with counts, never values. One card per batch kind in the B.1 order (optouts, legacy_fields, people, fields, orgs,
   consent, participation, form_answers): its status as a dot and a word, the report's counts in a sentence, See the lists, and one button
   chosen by status (Compare, Apply or Undo; never Undo for optouts or consent). Apply and Undo open a centred confirmation that repeats the
   counts; nothing else pops up (Purge asks inside its own row). Extra controls write the keela_ settings: the orgs card's ticks
   (keela_org_pairs_ok), the legacy_fields card's assignee selects (keela_assignee_map), the participation card's campaign types
   (keela_campaign_types), and the contacts file's subscription history key (keela_keys). A changed setting asks for a new compare.
   window.w284.open(host) is called by the CRM page (parts152 c_list.js) with #w284root. */
(function () {
  if (window.__wa284) return; window.__wa284 = true;   /* the ground rule's guard (window.__wa28N) */

  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#6B6965', RED = '#B3402F';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var KINDS = [
    { k: 'optouts', t: 'Opt-outs', need: 'keela_contacts_json', never: true,
      rule: 'People whose latest Keela email event is an unsubscribe, a hard bounce or a spam complaint, or who have an opt-out with no readable date, stop getting email here too (a complaint is marked complained). On the same day an opt-out wins over an opt-in. Never undone.' },
    { k: 'legacy_fields', t: 'Keela fields already in the Hub', need: null,
      rule: 'From the Keela details the first import kept: positions, availability, dates volunteered, Rally Paper team, donor readiness and the assignee. Fills empty fields only.' },
    { k: 'people', t: 'People', need: 'keela_contacts_json',
      rule: 'Matched by Keela id, then email, then phone (a phone-only match is listed, never merged). New people with an email or phone are added. The Hub\'s value wins.' },
    { k: 'fields', t: 'Job title, birth date and other fields', need: 'keela_contacts_json',
      rule: 'Job title, birth date (private: HR and admins only), car, LinkedIn and food licence. Fills empty fields only.' },
    { k: 'orgs', t: 'Organisations', need: 'keela_contacts_json',
      rule: 'Keela companies matched to Partners by name. Exact matches are linked, close pairs wait for your tick, real new ones are added; people are linked to them.' },
    { k: 'consent', t: 'Consent history', need: 'keela_contacts_json', never: true,
      rule: 'Keela\'s dated subscription events go into the consent log. Express consent only with dated proof; text opt-ins become text consent. Never undone.' },
    { k: 'participation', t: 'Tags and Campaigns', need: 'keela_contacts_json',
      rule: 'Keela tags become Campaign parts, the Toronto chapter or Hub tags; the donor and welcome-series tags are skipped. Adds only.' },
    { k: 'form_answers', t: 'Form answers', need: 'keela_responses_json',
      rule: 'Keela form responses not yet in the Hub become timeline items, without birth date, health or home address answers. Adds only.' }
  ];
  var FILES = [
    { k: 'keela_contacts_json', t: 'Keela contacts and companies (export 15, JSON)', type: 'application/json' },
    { k: 'keela_responses_json', t: 'Keela form responses (export 12, JSON)', type: 'application/json' },
    { k: 'keela_interactions_csv', t: 'Keela interactions (CSV)', type: 'text/csv' },
    { k: 'keela_transactions_csv', t: 'Keela transactions (CSV)', type: 'text/csv' }
  ];
  var TYPES = [['fundraising_event', 'Fundraising event'], ['drive', 'Drive'], ['appeal', 'Appeal'], ['program', 'Program']];
  var READ_AS = { optin: 'opt-in', unsubscribe: 'opt-out (unsubscribed)', bounce: 'bounce', complaint: 'complaint (complained)', other: 'other (not acted on)' };
  var CFG = ['keela_keys', 'keela_assignee_map', 'keela_org_pairs_ok', 'keela_campaign_types'];
  var LISTS = { keela_ids_skipped: 'Skipped (Keela ids)', phone_only: 'Phone-only matches, listed and not merged', org_pairs: 'Close organisation pairs',
    assignees_unmapped: 'Keela assignees with no Hub person yet', campaigns_to_create: 'Campaigns to create (pick a type)', campaigns_created: 'Campaigns created',
    positions_unmapped: 'Keela positions with no Hub role', company_types_unmapped: 'Keela company types with no Partners category',
    changed_since_kept: 'Changed since the import, so kept', created_review: 'Created by the import: review by hand',
    unrecognised_event_types: 'Event words the import does not know (check them before applying)' };
  var FIELD_WORDS = { email_status: 'email status', consent_source: 'consent source', email_consent: 'email consent', sms_consent: 'text consent', full_name: 'full name',
    first_name: 'first name', last_name: 'last name', postal_code: 'postal code', primary_email: 'primary email', legacy_refs: 'Keela ids', owner_member_id: 'owner',
    job_title: 'job title', keela_company_id: 'Keela company id', crm_contact_fields: 'custom fields', crm_contact_private: 'birth dates', crm_contact_orgs: 'organisation links',
    crm_contact_chapters: 'chapters', wa_campaign_people: 'Campaign parts', crm_interactions: 'timeline items', crm_consent_events: 'consent log rows' };
  var S = { runs: null, run: null, batches: {}, files: [], keys: {}, openKeys: {}, cfg: {}, err: '', loading: false, busy: {}, msg: {}, stale: {}, stage: {},
    note: {}, label: '', upKind: 'keela_contacts_json', upMsg: '', upBusy: false, purgeAsk: false, purgeMsg: '', seen: {}, pop: null };

  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function num(n) { n = Number(n || 0); return n.toLocaleString('en-CA'); }
  function plural(n, one, many) { return num(n) + ' ' + (Number(n) === 1 ? one : many); }
  function can() { try { return !!(window.w152 && window.w152.can && window.w152.can('import_admin')); } catch (e) { return false; } }
  function host() { return document.getElementById('w284root'); }
  function kindOf(k) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i].k === k) return KINDS[i]; return null; }
  function fileLabel(k) { for (var i = 0; i < FILES.length; i++) if (FILES[i].k === k) return FILES[i].t; return k; }
  function run() { var r = null; (S.runs || []).forEach(function (x) { if (x.id === S.run) r = x; }); return r; }
  function obj(v, dflt) { if (v && typeof v === 'object') return v; try { var j = JSON.parse(v); return j && typeof j === 'object' ? j : dflt; } catch (e) { return dflt; } }

  /* ---------- the function and the data ---------- */
  function fn(action, body) {
    if (typeof db === 'undefined' || !db || !db.functions) return Promise.resolve({ error: 'The Hub is not connected.' });
    return Promise.resolve(db.functions.invoke('crm-import', { body: Object.assign({ action: action }, body || {}) })).then(function (r) {
      if (r && r.error) {
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { return { error: (j && j.error) || r.error.message || 'The import function did not answer.' }; }, function () { return { error: r.error.message || 'The import function did not answer.' }; });
        return { error: String(r.error.message || r.error) };
      }
      var d = r && r.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { /* fine */ } }
      if (d && d.error) return { error: String(d.error), data: d };
      return { data: d || {} };
    }, function (e) { return { error: String((e && e.message) || e) }; });
  }
  function load() {
    if (S.loading || typeof db === 'undefined' || !db) return Promise.resolve();
    S.loading = true; S.err = '';
    return Promise.resolve(db.from('crm_import_runs').select('*').order('id', { ascending: false }).limit(50)).then(function (r) {
      if (r && r.error) { S.err = 'The runs could not load (' + (r.error.message || r.error) + ').'; S.runs = []; return; }
      S.runs = (r && r.data) || [];
      if (!run() && S.runs.length) S.run = S.runs[0].id;
      return loadRun();
    }).then(function () { S.loading = false; paint(); }, function (e) { S.loading = false; S.err = String((e && e.message) || e); paint(); });
  }
  function loadRun() {
    var id = S.run; if (!id) return Promise.resolve();
    return Promise.all([
      Promise.resolve(db.from('crm_import_batches').select('*').eq('run_id', id)),
      fn('files', { run_id: id }),
      Promise.resolve(db.from('app_config').select('key,value').in('key', CFG))
    ]).then(function (res) {
      if (id !== S.run) return;
      S.batches = {}; ((res[0] && res[0].data) || []).forEach(function (b) { S.batches[b.kind] = b; });
      S.files = (res[1] && res[1].data && res[1].data.files) || [];
      if (res[1] && res[1].error) S.err = res[1].error;
      S.cfg = {}; ((res[2] && res[2].data) || []).forEach(function (x) { S.cfg[x.key] = x.value; });
    });
  }
  function reloadRun() { return loadRun().then(paint); }
  function setCfg(key, value, kind) {
    S.cfg[key] = JSON.stringify(value);
    if (kind) { S.stale[kind] = true; S.msg[kind] = ''; }
    paint();
    return Promise.resolve(db.from('app_config').upsert({ key: key, value: JSON.stringify(value), updated_at: new Date().toISOString() })).then(function (r) {
      if (r && r.error && kind) { S.msg[kind] = 'The setting was not saved (' + (r.error.message || r.error) + ').'; paint(); }
    });
  }

  /* ---------- the report in words ---------- */
  function sum(o) { var n = 0; Object.keys(o || {}).forEach(function (k) { n += Number(o[k] || 0); }); return n; }
  function sentence(b) {
    var r = b && b.report; if (!r) return '';
    if (r.undo) {
      var u = r.undo;
      return 'Undone: ' + plural(u.restored, 'value', 'values') + ' put back, ' + plural(u.removed, 'row', 'rows') + ' removed, ' + num(u.kept) + ' kept because they changed since'
        + (u.review ? ', ' + plural(u.review, 'new record', 'new records') + ' to review by hand' : '') + '.';
    }
    var c = r.counts || {}, out = [];
    out.push('Read ' + plural(c.rows_read, 'row', 'rows'));
    out.push(num(c.matched) + ' matched');
    if (c.created) out.push(num(c.created) + ' new');
    var up = c.updated || {}, keys = Object.keys(up).sort(function (a, z) { return up[z] - up[a]; });
    if (keys.length) out.push(plural(sum(up), 'change', 'changes') + ' (' + keys.slice(0, 4).map(function (k) { return (FIELD_WORDS[k] || k.replace(/_/g, ' ')) + ' ' + num(up[k]); }).join(', ') + (keys.length > 4 ? ', and more' : '') + ')');
    else out.push('no changes');
    if (sum(c.kept_hub_value)) out.push('the Hub kept its own value ' + plural(sum(c.kept_hub_value), 'time', 'times'));
    if (sum(c.skipped)) out.push(num(sum(c.skipped)) + ' skipped');
    if (c.undated_events) out.push(plural(c.undated_events, 'event', 'events') + ' with no readable date' + (c.undated_optouts_honoured ? ' (' + plural(c.undated_optouts_honoured, 'opt-out', 'opt-outs') + ' among them honoured)' : ''));
    if (c.unrecognised_events) out.push(plural(c.unrecognised_events, 'event', 'events') + ' with words the import does not know (see the lists)');
    var cne = c.created_not_emailed || {}; if (sum(cne)) out.push(plural(sum(cne), 'new person arrives', 'new people arrive') + ' not emailed (their Keela opt-out)');
    return (b.status === 'applied' ? 'Applied: ' : b.status === 'compared' ? 'If applied: ' : '') + out.join('; ') + '.';
  }
  function itemText(x) {
    if (x == null) return '';
    if (typeof x !== 'object') return String(x);
    if (x.keela_company_id && x.partner_id) return (x.keela_name || x.keela_company_id) + ' and ' + (x.partner_name || ('partner ' + x.partner_id));
    return Object.keys(x).map(function (k) { return x[k]; }).join(' · ');
  }
  function listsHtml(b) {
    var r = b && b.report; if (!r) return '';
    var l = r.lists || {}, sk = (r.counts && r.counts.skipped) || {}, parts = [];
    if (Object.keys(sk).length) parts.push('<div class="w284ls"><b>Skipped</b><ul>' + Object.keys(sk).map(function (k) { return '<li>' + E(k) + ': ' + num(sk[k]) + '</li>'; }).join('') + '</ul></div>');
    var kept = (r.counts && r.counts.kept_hub_value) || {};
    if (Object.keys(kept).length) parts.push('<div class="w284ls"><b>The Hub kept its value</b><ul>' + Object.keys(kept).map(function (k) { return '<li>' + E(FIELD_WORDS[k] || k.replace(/_/g, ' ')) + ': ' + num(kept[k]) + '</li>'; }).join('') + '</ul></div>');
    /* round 3: every Keela event wording with how the import read it, so staff can check the reading before Apply (event types, not personal data) */
    var ew = l.event_words || [];
    if (ew.length) parts.push('<div class="w284ls"><table class="w284keys w284words"><caption>Event words and how the import read them</caption><thead><tr><th scope="col">Words</th><th scope="col">Read as</th><th scope="col">Events</th></tr></thead><tbody>'
      + ew.map(function (x) { return '<tr><td>' + E(x.words) + '</td><td>' + E(READ_AS[x.read_as] || x.read_as) + '</td><td>' + num(x.count) + '</td></tr>'; }).join('') + '</tbody></table></div>');
    Object.keys(l).forEach(function (k) {
      if (k === 'event_words') return;
      var arr = l[k] || []; if (!arr.length) return;
      parts.push('<div class="w284ls"><b>' + E(LISTS[k] || k.replace(/_/g, ' ')) + ' (' + num(arr.length) + ')</b><ul>' + arr.slice(0, 200).map(function (x) { return '<li>' + E(itemText(x)) + '</li>'; }).join('')
        + (arr.length > 200 ? '<li class="m">and ' + num(arr.length - 200) + ' more</li>' : '') + '</ul></div>');
    });
    if (!parts.length) return '';
    return '<details class="w284det"><summary>See the lists</summary>' + parts.join('') + '</details>';
  }

  /* ---------- the extra controls ---------- */
  function extraHtml(kind, b) {
    var r = (b && b.report) || {}, l = r.lists || {}, h = '';
    if (kind === 'orgs') {
      var ok = obj(S.cfg.keela_org_pairs_ok, []), pairs = (l.org_pairs || []).slice();
      ok.forEach(function (p) { if (!pairs.some(function (q) { return q.keela_company_id === p.keela_company_id && q.partner_id === p.partner_id; })) pairs.push(p); });
      if (pairs.length) h = '<fieldset class="w284ctl"><legend>Tick the pairs that are the same organisation</legend>' + pairs.map(function (p) {
        var on = ok.some(function (q) { return q.keela_company_id === p.keela_company_id && q.partner_id === p.partner_id; });
        return '<label class="w284chk"><input type="checkbox" data-w284pair="' + E(p.keela_company_id) + '|' + E(p.partner_id) + '"' + (on ? ' checked' : '') + '> <span>' + E(itemText(p)) + '</span></label>';
      }).join('') + '</fieldset>';
    }
    if (kind === 'legacy_fields') {
      var map = obj(S.cfg.keela_assignee_map, {}), names = (l.assignees_unmapped || []).slice();
      Object.keys(map).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
      var mem = []; try { mem = (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { mem = []; }
      mem = mem.filter(function (m) { return m && m.id != null && m.name; }).slice().sort(function (a, z) { return String(a.name).localeCompare(String(z.name)); });
      if (names.length) h = '<fieldset class="w284ctl"><legend>Who each Keela assignee is in the Hub</legend>' + names.map(function (n) {
        return '<label class="w284row"><span>' + E(n) + '</span><select class="w284sel" data-w284assign="' + E(n) + '"><option value="">Nobody (left empty)</option>' + mem.map(function (m) {
          return '<option value="' + E(m.id) + '"' + (String(map[n]) === String(m.id) ? ' selected' : '') + '>' + E(m.name) + '</option>';
        }).join('') + '</select></label>';
      }).join('') + '</fieldset>';
    }
    if (kind === 'participation') {
      var ty = obj(S.cfg.keela_campaign_types, {}), camps = (l.campaigns_to_create || []).slice();
      Object.keys(ty).forEach(function (n) { if (camps.indexOf(n) < 0) camps.push(n); });
      if (camps.length) h = '<fieldset class="w284ctl"><legend>The type of each campaign to create</legend>' + camps.map(function (n) {
        return '<label class="w284row"><span>' + E(n) + '</span><select class="w284sel" data-w284ctype="' + E(n) + '"><option value="">Pick a type</option>' + TYPES.map(function (t) {
          return '<option value="' + t[0] + '"' + (ty[n] === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
        }).join('') + '</select></label>';
      }).join('') + '</fieldset>';
    }
    return h;
  }

  /* ---------- painting ---------- */
  function staged(kind) { return S.files.some(function (f) { return f.kind === kind && f.rows != null && f.staged_through === f.rows; }); }
  function statusOf(kind) { var b = S.batches[kind]; return b ? b.status : 'new'; }
  function cardHtml(K, i) {
    var b = S.batches[K.k], st = statusOf(K.k), purged = !!(run() && run().purged_at), stale = !!S.stale[K.k], busy = S.busy[K.k];
    var btn = '';
    if (!purged && !busy) {
      if (st === 'compared' && !stale) btn = '<button class="w284btn" data-w284apply="' + K.k + '">Apply</button>';
      else if (st === 'applied') btn = K.never ? '<span class="w284note">Applied. Opt-outs and consent are never undone.</span>' : '<button class="w284btn soft" data-w284undo="' + K.k + '">Undo</button>';
      else {
        var ready = !K.need || staged(K.need);
        btn = '<button class="w284btn" data-w284compare="' + K.k + '"' + (ready ? '' : ' disabled') + '>' + (st === 'compared' ? 'Compare again' : 'Compare') + '</button>'
          + (ready ? '' : '<span class="w284note">Stage the ' + E(fileLabel(K.need)) + ' first.</span>');
      }
    }
    var err = (b && b.status === 'failed' && b.error) ? b.error : '';
    return '<section class="w284card" data-w284card="' + K.k + '" aria-labelledby="w284h-' + K.k + '">'
      + '<div class="w284ch"><h3 id="w284h-' + K.k + '"><span class="w284n">' + (i + 1) + '</span><span class="w284t">' + E(K.t) + '</span></h3>'
      + '<span class="w284st st-' + st + '"><i aria-hidden="true"></i>' + st + '</span></div>'
      + '<p class="w284rule">' + E(K.rule) + '</p>'
      + (b && b.report ? '<p class="w284sum">' + E(sentence(b)) + '</p>' : '')
      + (stale ? '<p class="w284warn">A setting changed: compare again before applying.</p>' : '')
      + extraHtml(K.k, b) + listsHtml(b)
      + (err ? '<p class="w284err" role="alert">Stopped: ' + E(err) + '</p>' : '')
      + (S.msg[K.k] ? '<p class="w284err" role="alert">' + E(S.msg[K.k]) + '</p>' : '')
      + (S.note[K.k] ? '<p class="w284warn">' + E(S.note[K.k]) + '</p>' : '')
      + '<div class="w284acts">' + (busy ? '<span class="w284busy">' + E(busy) + '</span>' : btn) + '</div>'
      + '</section>';
  }
  function filesHtml() {
    var r = run(); if (!r) return '';
    var purged = !!r.purged_at;
    var up = purged ? '<p class="w284note">This run was purged: its staged rows, uploaded files and change records are gone. Start a new run to import again.</p>'
      : '<div class="w284up"><label class="w284row"><span>Kind of file</span><select class="w284sel" data-w284upkind="1">' + FILES.map(function (f) {
          return '<option value="' + f.k + '"' + (S.upKind === f.k ? ' selected' : '') + '>' + E(f.t) + '</option>'; }).join('') + '</select></label>'
        + '<label class="w284row"><span>File</span><input type="file" data-w284upfile="1" accept=".json,.csv,application/json,text/csv"></label>'
        + '<button class="w284btn" data-w284upload="1"' + (S.upBusy ? ' disabled' : '') + '>Upload and stage</button></div>'
        + (S.upMsg ? '<p class="' + (/could not|not |error|refused/i.test(S.upMsg) ? 'w284err' : 'w284note') + '" role="status">' + E(S.upMsg) + '</p>' : '');
    var keysCfg = obj(S.cfg.keela_keys, {});
    var list = S.files.length ? '<ul class="w284files">' + S.files.map(function (f) {
      var done = f.rows != null && f.staged_through === f.rows, base = String(f.name || '').split('/').pop().replace(/^\d+-/, '');
      var prog = S.stage[f.id] || (done ? 'Staged: ' + plural(f.rows, 'row', 'rows') + '.' : f.rows != null ? 'Staged ' + num(f.staged_through || 0) + ' of ' + num(f.rows) + ' rows.' : 'Not staged yet.');
      var keys = S.keys[f.id], open = !!S.openKeys[f.id];
      var kh = '';
      if (open) {
        if (!keys) kh = '<p class="w284note">Reading the keys…</p>';
        else if (keys.error) kh = '<p class="w284err">' + E(keys.error) + '</p>';
        else {
          kh = '<table class="w284keys"><caption>Keys in this file (never values)</caption><thead><tr><th scope="col">Key</th><th scope="col">Rows with a value</th></tr></thead><tbody>'
            + keys.map(function (k) { return '<tr><td>' + E(k.key) + '</td><td>' + num(k.filled) + '</td></tr>'; }).join('') + '</tbody></table>';
          if (f.kind === 'keela_contacts_json') {
            var cur = keysCfg.subscription_history || '';
            kh += '<label class="w284row"><span>Subscription history key (opt-outs and consent read it)</span><select class="w284sel" data-w284subkey="1"><option value="">Pick the key</option>'
              + keys.filter(function (k) { return String(k.key).indexOf('[].') < 0; }).map(function (k) { return '<option' + (cur === k.key ? ' selected' : '') + '>' + E(k.key) + '</option>'; }).join('') + '</select></label>';
          }
        }
      }
      return '<li class="w284file"><div class="w284fh"><b>' + E(base) + '</b><span class="m">' + E(fileLabel(f.kind)) + '</span></div>'
        + '<div class="w284fp"><span role="status">' + E(prog) + '</span>'
        + (!done && !purged && !S.stage[f.id] ? '<button class="w284btn soft sm" data-w284stage="' + f.id + '">Stage</button>' : '')
        + (done ? '<button class="w284btn soft sm" data-w284keys="' + f.id + '" aria-expanded="' + open + '">' + (open ? 'Hide the keys' : 'Keys') + '</button>' : '') + '</div>' + kh + '</li>';
    }).join('') + '</ul>' : (purged ? '' : '<p class="w284note">No file yet. Upload Keela\'s exports here: the contacts and companies first.</p>');
    return '<section class="w284card w284filescard"><div class="w284ch"><h3>Files</h3></div>' + up + list + '</section>';
  }
  function purgeHtml() {
    var r = run(); if (!r || r.purged_at) return '';
    var days = r.last_applied_at ? Math.floor((Date.now() - new Date(r.last_applied_at).getTime()) / 86400000) : null;
    var due = days != null && days >= 30;
    return '<section class="w284card w284purge">'
      + (due ? '<p class="w284warn">It has been ' + plural(days, 'day', 'days') + ' since the last batch was applied. Purge this run to delete the staged rows, the uploaded files and the change records.</p>' : '')
      + (S.purgeAsk ? '<div class="w284ask" role="group" aria-label="Purge this run"><p>Purge deletes this run\'s staged rows, uploaded files and change records. Its batches can no longer be undone.</p>'
          + '<button class="w284btn" data-w284purgeyes="1">Yes, purge</button><button class="w284btn ghost" data-w284purgeno="1">Cancel</button></div>'
        : '<button class="w284btn soft" data-w284purge="1">Purge this run</button>')
      + (S.purgeMsg ? '<p class="w284note" role="status">' + E(S.purgeMsg) + '</p>' : '') + '</section>';
  }
  function paint() {
    var h = host(); if (!h) return;
    if (!can()) { h.innerHTML = '<div class="w284"><div class="w284empty">Imports are for admins.</div></div>'; return; }
    if (S.runs === null) { h.innerHTML = '<div class="w284"><div class="w284empty">Loading the imports…</div></div>'; if (!S.loading) load(); return; }
    var r = run();
    var head = '<section class="w284card w284head"><div class="w284ch"><h2>Imports</h2></div>'
      + '<p class="w284rule">Bring Keela\'s exports into the Hub: upload and stage a file, compare each kind of import, then apply it. Undo puts back what has not changed since; opt-outs and consent are never undone.</p>'
      + '<div class="w284runs">' + (S.runs.length ? '<label class="w284row"><span>Run</span><select class="w284sel" data-w284run="1">' + S.runs.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === S.run ? ' selected' : '') + '>Run ' + x.id + (x.label ? ': ' + E(x.label) : '') + (x.created_at ? ' (' + E(String(x.created_at).slice(0, 10)) + ')' : '') + (x.purged_at ? ', purged' : '') + '</option>';
        }).join('') + '</select></label>' : '')
      + '<label class="w284row"><span>New run</span><input class="w284in" type="text" maxlength="120" placeholder="A name, for example Keela final export" data-w284label="1" value="' + E(S.label) + '"></label>'
      + '<button class="w284btn" data-w284new="1">Start a new run</button></div>'
      + (S.err ? '<p class="w284err" role="alert">' + E(S.err) + '</p>' : '') + '</section>';
    var body = r ? filesHtml() + '<div class="w284cards">' + KINDS.map(cardHtml).join('') + '</div>' + purgeHtml()
      : '<div class="w284empty">No import run yet. Start one to bring in Keela\'s exports.</div>';
    var focus = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-w284label') ? 1 : 0;
    var caret = focus && document.activeElement.selectionStart;
    h.innerHTML = '<div class="w284">' + head + body + '</div>';
    /* a card whose content changed crossfades (140 ms) */
    [].forEach.call(h.querySelectorAll('[data-w284card]'), function (c) {
      var k = c.getAttribute('data-w284card'), sig = c.innerHTML;
      if (S.seen[k] !== undefined && S.seen[k] !== sig) c.classList.add('w284fade');
      S.seen[k] = sig;
    });
    if (focus) { var inp = h.querySelector('[data-w284label]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* fine */ } } }
  }

  /* ---------- actions ---------- */
  function ensureBatch(kind) {
    var b = S.batches[kind]; if (b) return Promise.resolve({ id: b.id });
    return fn('batch', { run_id: S.run, kind: kind }).then(function (r) { return r.error ? { error: r.error } : { id: r.data.batch_id }; });
  }
  function act(kind, action) {
    S.busy[kind] = action === 'compare' ? 'Comparing with the Hub…' : action === 'apply' ? 'Applying…' : 'Undoing…'; S.msg[kind] = ''; paint();
    return ensureBatch(kind).then(function (b) {
      if (b.error) return { error: b.error };
      return fn(action, { batch_id: b.id });
    }).then(function (r) {
      if (r && r.error) S.msg[kind] = r.error;
      S.note[kind] = (r && r.data && r.data.note) || '';   /* crm-import says when it had to use the API (8-second limit) */
      if (action === 'compare' && !(r && r.error)) S.stale[kind] = false;
      return loadRun();
    }).then(function () {
      var b = S.batches[kind];   /* a stop the batch records is shown once, as the card's Stopped line */
      if (b && b.status === 'failed' && b.error && S.msg[kind] === b.error) S.msg[kind] = '';
      S.busy[kind] = ''; paint();
    }, function (e) { S.busy[kind] = ''; S.msg[kind] = String((e && e.message) || e); paint(); });
  }
  function confirmPop(kind, action) {
    var K = kindOf(kind), b = S.batches[kind];
    closePop();
    var last = document.activeElement;
    var wrap = document.createElement('div'); wrap.id = 'w284pop'; wrap.className = 'w284pop';
    var title = (action === 'apply' ? 'Apply' : 'Undo') + ' batch ' + (KINDS.indexOf(K) + 1) + ': ' + K.t + '?';
    var what = action === 'apply'
      ? (sentence(b) || 'Compare first.') + (K.never ? ' Once applied, this batch is never undone.' : ' You can undo it afterwards: values that have not changed since are put back.')
      : 'Undo puts back every value this batch changed that has not changed since, and removes the rows it added that are unchanged. New contacts, organisations and campaigns stay, listed for you to review. ' + sentence(b);
    wrap.innerHTML = '<div class="w284box" role="dialog" aria-modal="true" aria-labelledby="w284pt" aria-describedby="w284pd"><h3 id="w284pt">' + E(title) + '</h3><p id="w284pd">' + E(what) + '</p>'
      + '<div class="w284acts"><button class="w284btn ghost" data-w284popno="1">Cancel</button><button class="w284btn" data-w284popyes="1">' + (action === 'apply' ? 'Apply' : 'Undo') + '</button></div></div>';
    document.body.appendChild(wrap);
    S.pop = { kind: kind, action: action, last: last };
    requestAnimationFrame(function () { wrap.classList.add('on'); var y = wrap.querySelector('[data-w284popyes]'); if (y) y.focus(); });
  }
  function closePop() {
    var p = document.getElementById('w284pop'); if (p) p.parentNode.removeChild(p);
    var last = S.pop && S.pop.last; S.pop = null;
    if (last && last.focus && document.body.contains(last)) try { last.focus(); } catch (e) { /* fine */ }
  }
  function stageFile(fid, offset) {
    S.stage[fid] = 'Staging…'; paint();
    return fn('stage', { file_id: fid, offset: offset || 0 }).then(function (r) {
      if (r.error) { S.stage[fid] = ''; S.upMsg = 'Staging stopped: ' + r.error; return loadRun(); }
      var d = r.data;
      if (d.next_offset != null) { S.stage[fid] = 'Staged ' + num(d.staged_through) + ' of ' + num(d.rows) + ' rows…'; paint(); return stageFile(fid, d.next_offset); }
      S.stage[fid] = ''; S.upMsg = 'Staged ' + plural(d.rows, 'row', 'rows') + '. Check its keys, then compare.';
      S.openKeys[fid] = true;
      return loadRun().then(function () { return loadKeys(fid); });
    });
  }
  function loadKeys(fid) {
    return fn('keys', { file_id: fid }).then(function (r) { S.keys[fid] = r.error ? { error: r.error } : (r.data.keys || []); paint(); });
  }
  function upload() {
    var inp = host() && host().querySelector('[data-w284upfile]'), file = inp && inp.files && inp.files[0];
    if (!file) { S.upMsg = 'Choose a file first, not uploaded.'; paint(); return; }
    var spec = FILES.filter(function (f) { return f.k === S.upKind; })[0];
    var path = S.run + '/' + Date.now() + '-' + String(file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80);
    S.upBusy = true; S.upMsg = 'Uploading ' + file.name + '…'; paint();
    Promise.resolve(db.storage.from('imports').upload(path, file, { contentType: spec.type, upsert: false })).then(function (u) {
      if (u && u.error) throw new Error('The file could not be uploaded (' + (u.error.message || u.error) + ').');
      return fn('register', { run_id: S.run, path: path, kind: S.upKind });
    }).then(function (r) {
      if (r.error) throw new Error('The file was not recorded: ' + r.error);
      S.upBusy = false; S.upMsg = 'Uploaded. Staging…';
      return loadRun().then(function () { return stageFile(r.data.file_id, 0); });
    }).catch(function (e) { S.upBusy = false; S.upMsg = String((e && e.message) || e); paint(); });
  }

  /* ---------- events (once) ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    var p = t.closest('#w284pop');
    if (p) {
      if (t.closest('[data-w284popyes]') && S.pop) { var k = S.pop.kind, a = S.pop.action; closePop(); act(k, a); }
      else if (t.closest('[data-w284popno]') || t === p) closePop();
      return;
    }
    var root = t.closest('#w284root'); if (!root) return;
    var el;
    if ((el = t.closest('[data-w284compare]'))) act(el.getAttribute('data-w284compare'), 'compare');
    else if ((el = t.closest('[data-w284apply]'))) confirmPop(el.getAttribute('data-w284apply'), 'apply');
    else if ((el = t.closest('[data-w284undo]'))) confirmPop(el.getAttribute('data-w284undo'), 'undo');
    else if ((el = t.closest('[data-w284stage]'))) { var fid = Number(el.getAttribute('data-w284stage')); var f = S.files.filter(function (x) { return x.id === fid; })[0]; stageFile(fid, f && f.rows != null && f.staged_through ? f.staged_through : 0); }
    else if ((el = t.closest('[data-w284keys]'))) { var id = Number(el.getAttribute('data-w284keys')); S.openKeys[id] = !S.openKeys[id]; if (S.openKeys[id] && !S.keys[id]) loadKeys(id); paint(); }
    else if (t.closest('[data-w284upload]')) upload();
    else if (t.closest('[data-w284new]')) {
      fn('new_run', { label: S.label }).then(function (r) {
        if (r.error) { S.err = r.error; paint(); return; }
        S.label = ''; S.run = r.data.run_id; S.runs = null; S.batches = {}; S.files = []; S.stale = {}; S.msg = {}; S.purgeAsk = false; S.purgeMsg = ''; S.upMsg = '';
        load();
      });
    }
    else if (t.closest('[data-w284purge]')) { S.purgeAsk = true; paint(); }
    else if (t.closest('[data-w284purgeno]')) { S.purgeAsk = false; paint(); }
    else if (t.closest('[data-w284purgeyes]')) {
      S.purgeAsk = false; S.purgeMsg = 'Purging…'; paint();
      fn('purge', { run_id: S.run }).then(function (r) {
        S.purgeMsg = r.error ? 'Purge stopped: ' + r.error : 'Purged: ' + plural(r.data.removed, 'file', 'files') + ' deleted, with the staged rows and the change records.';
        S.runs = null; load();
      });
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.closest || !t.closest('#w284root')) return;
    if (t.hasAttribute('data-w284run')) { S.run = Number(t.value); S.batches = {}; S.files = []; S.keys = {}; S.openKeys = {}; S.stale = {}; S.msg = {}; S.purgeAsk = false; S.purgeMsg = ''; S.upMsg = ''; reloadRun(); }
    else if (t.hasAttribute('data-w284upkind')) S.upKind = t.value;
    else if (t.hasAttribute('data-w284pair')) {
      var parts = t.getAttribute('data-w284pair').split('|'), pair = { keela_company_id: parts[0], partner_id: Number(parts[1]) };
      var ok = obj(S.cfg.keela_org_pairs_ok, []).filter(function (q) { return !(q.keela_company_id === pair.keela_company_id && Number(q.partner_id) === pair.partner_id); });
      if (t.checked) ok.push(pair);
      setCfg('keela_org_pairs_ok', ok, 'orgs');
    }
    else if (t.hasAttribute('data-w284assign')) {
      var m = obj(S.cfg.keela_assignee_map, {}), n = t.getAttribute('data-w284assign');
      if (t.value) m[n] = String(t.value); else delete m[n];
      setCfg('keela_assignee_map', m, 'legacy_fields');
    }
    else if (t.hasAttribute('data-w284ctype')) {
      var c = obj(S.cfg.keela_campaign_types, {}), cn = t.getAttribute('data-w284ctype');
      if (t.value) c[cn] = t.value; else delete c[cn];
      setCfg('keela_campaign_types', c, 'participation');
    }
    else if (t.hasAttribute('data-w284subkey')) {
      var kk = obj(S.cfg.keela_keys, {});
      if (t.value) kk.subscription_history = t.value; else delete kk.subscription_history;
      setCfg('keela_keys', kk, null);
      S.stale.optouts = S.stale.optouts || statusOf('optouts') === 'compared'; S.stale.consent = S.stale.consent || statusOf('consent') === 'compared'; paint();
    }
  });
  document.addEventListener('input', function (ev) { var t = ev.target; if (t && t.hasAttribute && t.hasAttribute('data-w284label')) S.label = t.value; });
  document.addEventListener('keydown', function (ev) {
    if (!S.pop) return;
    var p = document.getElementById('w284pop'); if (!p) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closePop(); return; }
    if (ev.key === 'Tab') {   /* keep focus inside the confirmation */
      var bs = p.querySelectorAll('button'); if (!bs.length) return;
      var first = bs[0], last = bs[bs.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  function open(h) { if (!h) return; if (S.runs === null && can() && !S.loading) load(); paint(); }
  window.w284 = { open: open, paint: paint, load: load, state: function () { return S; }, kinds: KINDS.map(function (k) { return k.k; }), sentence: sentence };
