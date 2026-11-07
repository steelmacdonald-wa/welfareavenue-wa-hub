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
   window.w284.open(host) is called by the CRM page (parts152 c_list.js) with #w284root.
   wave292 (07/11/26): a run has a source (crm_import_runs.source). An email-history run shows the Scan card (c_mail.js) instead of the files
   card, and the five mail cards (MAIL) instead of Keela's eight: Compare needs every card above applied, Undo needs every card below not applied.
   New run offers both sources; Purge's question says Undo ends with it. */
(function () {
  if (window.__wa284) return; window.__wa284 = true;   /* the ground rule's guard (window.__wa28N) */

  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', INK = '#1F201E', MUTED = '#6B6965', RED = '#B3402F';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var SH1 = '0 1px 2px rgba(16,63,57,.05),0 8px 24px rgba(16,63,57,.06)';
  var KINDS = [
    { k: 'optouts', t: 'Opt-outs', need: 'keela_contacts_json', never: true, src: 'keela',
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
  KINDS.forEach(function (K) { K.src = 'keela'; });
  /* wave292: the email history's five cards, in order (Compare top down, Undo bottom up) */
  var MAIL = [
    { k: 'mail_optouts', t: 'Opt-outs from the email history', never: true, ordered: true, src: 'email_history',
      rule: 'People who asked Welfare Avenue to stop emailing them, and addresses that bounced for good, go on the suppression list and stop getting email, on every contact holding the address. A bounce counts only on the address the Hub sends to, and not when they wrote again later. Newer consent is listed, not changed. Never undone.' },
    { k: 'mail_orgs', t: 'Organisations', ordered: true, src: 'email_history',
      rule: 'Organisations found on their own homepages: matched to Partners by domain, website or name, with blanks filled; new ones added with what the homepage prints. The Hub\'s value wins. New organisations are never deleted by Undo.' },
    { k: 'mail_people', t: 'New people', ordered: true, src: 'email_history', undoText: 'Undo removes the organisation links, LinkedIn fields and types it added that are unchanged. The new contacts stay, tagged email history: review so no Send reaches them, and are listed; Delete created and untouched removes them afterwards.',
      rule: 'A contact for each person who wrote in and is not in the Hub yet: name, address, signature phone, title, organisation, language and their type. No consent is set; an address on the suppression list arrives opted out. Left out, deleted and phone-only matches make no contact.' },
    { k: 'mail_enrich', t: 'People already in the Hub', ordered: true, src: 'email_history',
      rule: 'Contacts the history matched by email: empty fields filled from their signature, the tag email history and their type. Never an opt-out or consent. The Hub\'s value wins.' },
    { k: 'mail_interactions', t: 'Emails on the timeline', ordered: true, src: 'email_history',
      rule: 'One timeline item per email per person: the date, in or out, the mailbox, the cleaned subject and one line saying what it was about. Never the email itself, and never a left-out thread. Adds only.' }
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
  var LISTS = { keela_ids_skipped: 'Keela ids skipped', phone_only: 'Phone-only matches, listed and not merged', org_pairs: 'Close organisation pairs',
    assignees_unmapped: 'Keela assignees with no Hub person yet', campaigns_to_create: 'Campaigns to create (pick a type)', campaigns_created: 'Campaigns created',
    positions_unmapped: 'Keela positions with no Hub role', company_types_unmapped: 'Keela company types with no Partners category',
    changed_since_kept: 'Changed since the import, so kept', created_review: 'Created by the import: review by hand',
    unrecognised_event_types: 'Event words the import does not know (check them before applying)',
    text_optout_by_phone: 'Hub contacts a Keela text opt-out reaches by phone' };   /* batch 6 since the final review (M7): drawn as a table, see listsHtml */
  var FIELD_WORDS = { email_status: 'email status', consent_source: 'consent source', email_consent: 'email consent', sms_consent: 'text consent', full_name: 'full name',
    first_name: 'first name', last_name: 'last name', postal_code: 'postal code', primary_email: 'primary email', legacy_refs: 'Keela ids', owner_member_id: 'owner',
    job_title: 'job title', keela_company_id: 'Keela company id', crm_contact_fields: 'custom fields', crm_contact_private: 'birth dates', crm_contact_orgs: 'organisation links',
    crm_contact_chapters: 'chapters', wa_campaign_people: 'Campaign parts', crm_interactions: 'timeline items', crm_consent_events: 'consent log rows', sms_opt_out: 'texts stopped' };
  var S = { runs: null, run: null, batches: {}, files: [], keys: {}, openKeys: {}, cfg: {}, err: '', loading: false, busy: {}, msg: {}, stale: {}, stage: {},
    note: {}, label: '', newSrc: 'keela', upKind: 'keela_contacts_json', upMsg: '', upErr: false, upBusy: false, upFile: null, names: {}, purgeAsk: false, purgeMsg: '', open: {}, want: null, pop: null };

  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function num(n) { n = Number(n || 0); return n.toLocaleString('en-CA'); }
  function plural(n, one, many) { return num(n) + ' ' + (Number(n) === 1 ? one : many); }
  function can() { try { return !!(window.w152 && window.w152.can && window.w152.can('import_admin')); } catch (e) { return false; } }
  function host() { return document.getElementById('w284root'); }
  function kindOf(k) { var all = KINDS.concat(MAIL); for (var i = 0; i < all.length; i++) if (all[i].k === k) return all[i]; return null; }
  function src() { var r = run(); return r && r.source === 'email_history' ? 'email_history' : 'keela'; }
  function kinds() { return src() === 'email_history' ? MAIL : KINDS; }
  function fileLabel(k) { for (var i = 0; i < FILES.length; i++) if (FILES[i].k === k) return FILES[i].t; return k; }
  function run() { var r = null; (S.runs || []).forEach(function (x) { if (x.id === S.run) r = x; }); return r; }
  function obj(v, dflt) { if (v && typeof v === 'object') return v; try { var j = JSON.parse(v); return j && typeof j === 'object' ? j : dflt; } catch (e) { return dflt; } }
  /* a long file name keeps its start and its end (the version and the extension), cut in the middle at a separator; the whole name goes in the title */
  function middle(s, n) {
    s = String(s || ''); if (s.length <= n + 12) return s;   /* a name only a little long stays whole (it wraps) */
    var t = Math.min(28, Math.floor(n * 0.45)), head = s.slice(0, n - t - 1), tail = s.slice(-t), cut = head.search(/[-_ .][^-_ .]*$/), j = tail.search(/[-_ .]/);
    if (cut > head.length * 0.6) head = head.slice(0, cut);
    if (j > 0 && j <= 6) tail = tail.slice(j + 1);
    return head + '…' + tail;
  }
  /* the name the file is stored under: storage-safe characters, no "..", at most 80 characters with its start, its end and its extension kept */
  function storeName(name) {
    var s = String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[.-]+/, '') || 'file';
    if (s.length <= 80) return s;
    var m = /(\.[A-Za-z0-9]{1,8})$/.exec(s), ext = m ? m[1] : '', stem = s.slice(0, s.length - ext.length);
    return stem.slice(0, 50) + '-' + stem.slice(-(29 - ext.length)) + ext;
  }

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
      if (src() === 'email_history') return mLoad(id);   /* wave292: the scans (c_mail.js) */
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
    var up = c.updated || {}, keys = Object.keys(up).filter(function (k) { return Number(up[k]) > 0; }).sort(function (a, z) { return up[z] - up[a]; });   /* a field with 0 changes is not listed */
    if (keys.length) out.push(plural(sum(up), 'change', 'changes') + ' (' + keys.slice(0, 4).map(function (k) { return (FIELD_WORDS[k] || k.replace(/_/g, ' ')) + ' ' + num(up[k]); }).join(', ') + (keys.length > 4 ? ', and more' : '') + ')');
    else out.push('no changes');
    if (sum(c.kept_hub_value)) out.push('the Hub kept its own value ' + plural(sum(c.kept_hub_value), 'time', 'times'));
    if (sum(c.skipped)) out.push(num(sum(c.skipped)) + ' skipped');
    if (c.undated_events) out.push(plural(c.undated_events, 'event', 'events') + ' with no readable date' + (c.undated_optouts_honoured ? ' (' + plural(c.undated_optouts_honoured, 'opt-out', 'opt-outs') + ' among them honoured)' : ''));
    if (c.unrecognised_events) out.push(plural(c.unrecognised_events, 'event', 'events') + ' with words the import does not know (see the lists)');
    var cne = c.created_not_emailed || {}; if (sum(cne)) out.push(plural(sum(cne), 'new person arrives', 'new people arrive') + ' not emailed (their Keela opt-out)');
    return (b.status === 'applied' ? 'Applied: ' : b.status === 'compared' ? 'If applied: ' : '') + out.join('; ') + '.';
  }
  function isPair(x) { return !!(x && typeof x === 'object' && x.keela_company_id && x.partner_id); }
  function itemText(x) {
    if (x == null) return '';
    if (typeof x !== 'object') return String(x);
    if (isPair(x)) return 'Keela: ' + (x.keela_name || x.keela_company_id) + ', Partners: ' + (x.partner_name || ('partner ' + x.partner_id));
    return Object.keys(x).map(function (k) { return x[k]; }).join(' · ');
  }
  /* a close organisation pair on two lines, so you can tell where the Keela name ends */
  function pairHtml(x) {
    return '<span class="w284pair"><span>Keela: <b>' + E(x.keela_name || x.keela_company_id) + '</b></span><span>Partners: ' + E(x.partner_name || ('partner ' + x.partner_id)) + '</span></span>';
  }
  function itemHtml(x) { return isPair(x) ? pairHtml(x) : E(itemText(x)); }
  function nonZero(o) { return Object.keys(o || {}).filter(function (k) { return Number(o[k]) > 0; }); }
  function cnt(n) { return ' <em class="w284cnt">' + num(n) + '</em>'; }
  /* how the import read an event: the kind ("opt-out") and what it does ("(unsubscribed)") each never break; in a narrow card the second goes
     under the first, never a word cut in two */
  function readAs(v) {
    var t = READ_AS[v] || String(v || ''), m = /^(\S+) (\(.+\))$/.exec(t);
    return m ? '<span>' + E(m[1]) + '</span> <span>' + E(m[2]) + '</span>' : '<span>' + E(t) + '</span>';
  }
  /* a long table scrolls inside its own region (180 to 320 px) under a header that stays put, so the card stays short enough to check before Apply */
  function tableHtml(key, capHtml, heads, rows, cls) {
    var id = 'w284c-' + key;
    return '<p class="w284cap" id="' + id + '">' + capHtml + '</p>'
      + '<div class="w284scroll" role="region" tabindex="0" aria-labelledby="' + id + '" data-w284keep="' + E(key) + '"><table class="w284keys' + (cls ? ' ' + cls : '') + '" aria-labelledby="' + id + '"><thead><tr>'
      + heads.map(function (h) { return '<th scope="col">' + E(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function listsHtml(kind, b) {
    var r = b && b.report; if (!r) return '';
    var l = r.lists || {}, sk = (r.counts && r.counts.skipped) || {}, parts = [];
    if (nonZero(sk).length) parts.push('<div class="w284ls"><b>Skipped</b><ul>' + nonZero(sk).map(function (k) { return '<li>' + E(k) + ': ' + num(sk[k]) + '</li>'; }).join('') + '</ul></div>');
    var kept = (r.counts && r.counts.kept_hub_value) || {};
    if (nonZero(kept).length) parts.push('<div class="w284ls"><b>The Hub kept its value</b><ul>' + nonZero(kept).map(function (k) { return '<li>' + E(FIELD_WORDS[k] || k.replace(/_/g, ' ')) + ': ' + num(kept[k]) + '</li>'; }).join('') + '</ul></div>');
    /* round 3: every Keela event wording with how the import read it, so staff can check the reading before Apply (event types, not personal data) */
    var ew = l.event_words || [];
    if (ew.length) parts.push('<div class="w284ls">' + tableHtml('words-' + kind, 'Event words and how the import read them' + cnt(ew.length), ['Words', 'Read as', 'Events'],
      ew.map(function (x) { return '<tr><td>' + E(x.words) + '</td><td class="w284ra">' + readAs(x.read_as) + '</td><td>' + num(x.count) + '</td></tr>'; }).join(''), 'w284words') + '</div>');
    Object.keys(l).forEach(function (k) {
      if (k === 'event_words') return;
      var arr = l[k] || []; if (!arr.length) return;   /* a list that is missing or empty draws nothing */
      /* batch 6 (final review M7): the Hub contacts a Keela text opt-out reaches by phone, a table like the event words (the Keela id, then the
         Hub contact as a link to their page), in the same scroll region under a header that stays put */
      if (k === 'text_optout_by_phone') {
        parts.push('<div class="w284ls">' + tableHtml('phone-' + kind, E(LISTS[k]) + cnt(arr.length), ['Keela id', 'Hub contact'], arr.map(function (x) {
          if (!x || typeof x !== 'object') x = { keela_id: x };
          var id = x.contact_id;
          return '<tr><td>' + E(x.keela_id == null ? '' : x.keela_id) + '</td><td>' + (id != null && id !== '' ? '<a href="#crm/c/' + E(id) + '">' + E(id) + '</a>' : '') + '</td></tr>';
        }).join('')) + '</div>');
        return;
      }
      parts.push('<div class="w284ls"><b>' + E(LISTS[k] || k.replace(/_/g, ' ')) + cnt(arr.length) + '</b><ul data-w284keep="' + kind + '-' + E(k) + '">' + arr.slice(0, 200).map(function (x) { return '<li>' + itemHtml(x) + '</li>'; }).join('')
        + (arr.length > 200 ? '<li class="m">and ' + num(arr.length - 200) + ' more</li>' : '') + '</ul></div>');
    });
    if (!parts.length) return '';
    /* never drawn with open: paint() opens it again from S.open, so a list you are reading stays open across repaints */
    return '<details class="w284det" data-w284det="' + kind + '"><summary data-w284sum="' + kind + '">See the lists</summary>' + parts.join('') + '</details>';
  }

  /* ---------- the extra controls ---------- */
  function extraHtml(kind, b) {
    if (/^mail_/.test(kind)) return mExtra(kind, b);   /* wave292 (c_mail.js) */
    var r = (b && b.report) || {}, l = r.lists || {}, h = '';
    if (kind === 'orgs') {
      var ok = obj(S.cfg.keela_org_pairs_ok, []), pairs = (l.org_pairs || []).slice();
      ok.forEach(function (p) { if (!pairs.some(function (q) { return q.keela_company_id === p.keela_company_id && q.partner_id === p.partner_id; })) pairs.push(p); });
      if (pairs.length) h = '<fieldset class="w284ctl"><legend>Tick the pairs that are the same organisation</legend>' + pairs.map(function (p) {
        var on = ok.some(function (q) { return q.keela_company_id === p.keela_company_id && q.partner_id === p.partner_id; });
        return '<label class="w284chk"><input type="checkbox" data-w284pair="' + E(p.keela_company_id) + '|' + E(p.partner_id) + '"' + (on ? ' checked' : '') + '> ' + pairHtml(p) + '</label>';
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
  /* one primary button per screen (wave274): the next step is green, every other button soft */
  function nextStep() {
    if (!S.runs || !S.runs.length) return 'new';
    var r = run(); if (!r || r.purged_at) return 'new';
    if (src() === 'email_history') return mNext();   /* wave292 (c_mail.js) */
    var cf = S.files.filter(function (f) { return f.kind === 'keela_contacts_json'; });
    if (!cf.length) return 'upload';
    if (!staged('keela_contacts_json')) return S.stage[cf[0].id] ? '' : 'stage:' + cf[0].id;
    for (var i = 0; i < KINDS.length; i++) {
      var K = KINDS[i], st = statusOf(K.k);
      if (S.busy[K.k]) return '';
      if (st === 'applied') continue;
      if (st === 'compared' && !S.stale[K.k]) return 'apply:' + K.k;
      if (!K.need || staged(K.need)) return 'compare:' + K.k;
    }
    return '';
  }
  function pri(step) { return nextStep() === step ? 'w284btn' : 'w284btn soft'; }
  /* the run in one line: "Run 12: 3 of 8 applied, 3 compared, 1 failed" */
  function runLine() {
    var r = run(); if (!r) return 'No import run yet';
    var n = { applied: 0, compared: 0, failed: 0, undone: 0 };
    kinds().forEach(function (K) { var st = statusOf(K.k); if (n[st] != null) n[st]++; });
    var bits = [num(n.applied) + ' of ' + kinds().length + ' applied'];
    ['compared', 'failed', 'undone'].forEach(function (k) { if (n[k]) bits.push(num(n[k]) + ' ' + k); });
    return 'Run ' + r.id + (src() === 'email_history' ? ' (email history)' : '') + ': ' + bits.join(', ') + (r.purged_at ? ', then purged' : '');
  }
  function cardHtml(K, i) {
    var b = S.batches[K.k], st = statusOf(K.k), purged = !!(run() && run().purged_at), stale = !!S.stale[K.k], busy = S.busy[K.k];
    /* every button that is the card's action carries data-w284act, so keyboard focus can follow the action (Compare, then Apply, then Undo) */
    var act = ' data-w284act="' + K.k + '"', btn = '';
    /* wave292: an ordered card compares only when every card above is applied, and undoes only when every card below is not */
    var list = kinds(), at = list.indexOf(K);
    var above = !K.ordered || list.slice(0, at).every(function (x) { return statusOf(x.k) === 'applied'; });
    var below = !K.ordered || list.slice(at + 1).every(function (x) { return statusOf(x.k) !== 'applied'; });
    if (!purged && !busy && K.src === 'email_history' && st !== 'applied' && !mPhaseAll(['done', 'summaries', 'summarised'])) btn = '<span class="w284note">The scan has not finished reading yet.</span>';
    else if (!purged && !busy && K.ordered && st !== 'applied' && !above) btn = '<span class="w284note">Apply the cards above first.</span>';
    else if (!purged && !busy && K.ordered && st === 'applied' && !K.never && !below) btn = '<span class="w284note">Applied. Undo the cards below first.</span>';
    else if (!purged && !busy) {
      if (st === 'compared' && !stale) btn = '<button class="' + pri('apply:' + K.k) + '" data-w284apply="' + K.k + '"' + act + '>Apply</button>';
      else if (st === 'applied') btn = K.never ? '<span class="w284note">Applied. ' + (K.src === 'email_history' ? 'Opt-outs are never undone.' : 'Opt-outs and consent are never undone.') + '</span>' : '<button class="w284btn soft" data-w284undo="' + K.k + '"' + act + '>Undo</button>';
      else {
        var ready = !K.need || staged(K.need);
        btn = '<button class="' + pri('compare:' + K.k) + '" data-w284compare="' + K.k + '"' + act + (ready ? '' : ' disabled') + '>' + (st === 'compared' ? 'Compare again' : 'Compare') + '</button>'
          + (ready ? '' : '<span class="w284note">Stage the ' + E(fileLabel(K.need)) + ' first.</span>');
      }
    }
    /* busy: the button stays where it was (no jump), says what it is doing, and keeps focus (aria-disabled, not disabled) */
    if (busy) btn = '<button class="w284btn soft"' + act + ' aria-disabled="true" aria-busy="true">' + E(busy) + '</button>';
    var err = (b && b.status === 'failed' && b.error) ? b.error : '';
    return '<section class="w284card" data-w284b="card-' + K.k + '" data-w284card="' + K.k + '" aria-labelledby="w284h-' + K.k + '">'
      + '<div class="w284ch"><h3 id="w284h-' + K.k + '" tabindex="-1" data-w284head="' + K.k + '"><span class="w284n">' + (i + 1) + '</span><span class="w284t">' + E(K.t) + '</span></h3>'
      + '<span class="w284st st-' + st + '"><i aria-hidden="true"></i>' + st + '</span></div>'
      + '<p class="w284rule">' + E(K.rule) + '</p>'
      + (b && b.report ? '<p class="w284sum">' + E(sentence(b)) + (K.src === 'email_history' ? E(mMore(b)) : '') + '</p>' : '')
      + (stale ? '<p class="w284warn">A setting changed: compare again before applying.</p>' : '')
      + extraHtml(K.k, b) + listsHtml(K.k, b)
      + (err ? '<p class="w284err" role="alert">Stopped: ' + E(err) + '</p>' : '')
      + (S.msg[K.k] ? '<p class="w284err" role="alert">' + E(S.msg[K.k]) + '</p>' : '')
      + (S.note[K.k] ? '<p class="w284warn">' + E(S.note[K.k]) + '</p>' : '')
      + (btn ? '<div class="w284acts">' + btn + '</div>' : '')
      + '</section>';
  }
  function filesHtml() {
    var r = run(); if (!r) return '';
    var purged = !!r.purged_at;
    var up = purged ? '<p class="w284note">This run was purged: its staged rows, uploaded files and change records are gone. Start a new run to import again.</p>'
      : '<div class="w284up"><label class="w284row"><span>Kind of file</span><select class="w284sel" data-w284upkind="1">' + FILES.map(function (f) {
          return '<option value="' + f.k + '"' + (S.upKind === f.k ? ' selected' : '') + '>' + E(f.t) + '</option>'; }).join('') + '</select></label>'
        + '<div class="w284row"><span>File</span><div class="w284pickrow"><label class="w284btn soft w284pick"><input type="file" class="w284vh" data-w284upfile="1" accept=".json,.csv,application/json,text/csv" aria-describedby="w284fn">Choose a file</label>'
        + (S.upFile ? '<span class="w284picked" id="w284fn" title="' + E(S.upFile.name) + '">' + E(middle(S.upFile.name, 48)) + '</span>' : '<span class="w284picked m" id="w284fn">No file chosen</span>') + '</div></div>'
        + (S.upBusy ? '<button class="w284btn soft" data-w284act="upload" aria-disabled="true" aria-busy="true">Uploading…</button>'
          : '<button class="' + pri('upload') + '" data-w284upload="1" data-w284act="upload">Upload and stage</button>') + '</div>'
        + (S.upMsg ? '<p class="' + (S.upErr ? 'w284err' : 'w284note') + '" role="' + (S.upErr ? 'alert' : 'status') + '">' + E(S.upMsg) + '</p>' : '');   /* red only when something failed (S.upErr), never from the words */
    var keysCfg = obj(S.cfg.keela_keys, {});
    var list = S.files.length ? '<ul class="w284files">' + S.files.map(function (f) {
      var done = f.rows != null && f.staged_through === f.rows, base = S.names[f.name] || String(f.name || '').split('/').pop().replace(/^\d+-/, '');
      var prog = S.stage[f.id] || (done ? 'Staged: ' + plural(f.rows, 'row', 'rows') + '.' : f.rows != null ? 'Staged ' + num(f.staged_through || 0) + ' of ' + num(f.rows) + ' rows.' : 'Not staged yet.');
      var keys = S.keys[f.id], open = !!S.openKeys[f.id];
      var kh = '';
      if (open) {
        if (!keys) kh = '<p class="w284note">Reading the keys…</p>';
        else if (keys.error) kh = '<p class="w284err">' + E(keys.error) + '</p>';
        else {
          kh = tableHtml('keys-' + f.id, 'Keys in this file (never values)' + cnt(keys.length), ['Key', 'Rows with a value'],
            keys.map(function (k) { return '<tr><td>' + E(k.key) + '</td><td>' + num(k.filled) + '</td></tr>'; }).join(''));
          if (f.kind === 'keela_contacts_json') {
            var cur = keysCfg.subscription_history || '';
            kh += '<label class="w284row"><span>Subscription history key (opt-outs and consent read it)</span><select class="w284sel" data-w284subkey="1"><option value="">Pick the key</option>'
              + keys.filter(function (k) { return String(k.key).indexOf('[].') < 0; }).map(function (k) { return '<option' + (cur === k.key ? ' selected' : '') + '>' + E(k.key) + '</option>'; }).join('') + '</select></label>';
          }
        }
      }
      var fa = ' data-w284act="file-' + f.id + '"';   /* Stage, then Keys: focus follows the file's action */
      return '<li class="w284file" data-w284b="file-' + f.id + '"><div class="w284fh"><b title="' + E(base) + '">' + E(middle(base, 60)) + '</b><span class="m">' + E(fileLabel(f.kind)) + '</span></div>'
        + '<div class="w284fp"><span role="status">' + E(prog) + '</span>'
        + (!done && !purged ? (S.stage[f.id] ? '<button class="w284btn soft sm"' + fa + ' aria-disabled="true" aria-busy="true">Stage</button>'
          : '<button class="' + pri('stage:' + f.id) + ' sm" data-w284stage="' + f.id + '"' + fa + '>Stage</button>') : '')
        + (done ? '<button class="w284btn soft sm" data-w284keys="' + f.id + '"' + fa + ' aria-expanded="' + open + '">' + (open ? 'Hide the keys' : 'Keys') + '</button>' : '') + '</div>' + kh + '</li>';
    }).join('') + '</ul>' : (purged ? '' : '<p class="w284note">No file yet. Upload Keela\'s exports here: the contacts and companies first.</p>');
    return '<section class="w284card w284filescard" data-w284b="files"><div class="w284ch"><h3>Files</h3></div><div class="w284upw" data-w284b="up">' + up + '</div>' + list + '</section>';
  }
  function purgeHtml() {
    var r = run(); if (!r || r.purged_at) return '';
    var days = r.last_applied_at ? Math.floor((Date.now() - new Date(r.last_applied_at).getTime()) / 86400000) : null;
    var due = days != null && days >= 30;
    return '<section class="w284card w284purge" data-w284b="purge">'
      + (due ? '<p class="w284warn">It has been ' + plural(days, 'day', 'days') + ' since the last batch was applied. Purge this run to delete the staged rows, the uploaded files and the change records.</p>' : '')
      + (S.purgeAsk ? '<div class="w284ask" role="group" aria-label="Purge this run"><p>Purge deletes this run\'s ' + (src() === 'email_history' ? 'staged emails, people and organisations' : 'staged rows, uploaded files') + ' and change records. Undo ends with it: its batches can no longer be undone.</p>'
          + '<button class="w284btn danger" data-w284purgeyes="1">Yes, purge</button><button class="w284btn ghost" data-w284purgeno="1">Cancel</button></div>'
        : '<button class="w284btn soft" data-w284purge="1">Purge this run</button>')
      + (S.purgeMsg ? '<p class="w284note" role="status">' + E(S.purgeMsg) + '</p>' : '') + '</section>';
  }
  function pageHtml() {
    var r = run();
    /* the head: the masthead already says Imports, so the card opens on the run itself (no CRM stats strip, no second title); with no run yet, the
       empty state lives here, above New run */
    var head = '<section class="w284card w284head" data-w284b="head"><h2 class="w284runline" tabindex="-1" data-w284b="line">' + E(runLine()) + '</h2>'
      + '<p class="w284rule">' + (r && src() === 'email_history' ? 'Bring the email history into the Hub: read the mailboxes, look at the people found, compare each card with the Hub, then apply it, top down. Undo goes bottom up and puts back what has not changed since; opt-outs are never undone.'
          : 'Bring Keela\'s exports into the Hub: upload and stage a file, compare each kind of import, then apply it. Undo puts back what has not changed since; opt-outs and consent are never undone.') + '</p>'
      + (r ? '' : '<p class="w284sum">Name the run, then Start a new run.</p>')
      + '<div class="w284runs" data-w284b="ctl">' + (S.runs.length ? '<label class="w284row"><span>Run</span><select class="w284sel" data-w284run="1">' + S.runs.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === S.run ? ' selected' : '') + '>Run ' + x.id + (x.label ? ': ' + E(x.label) : '') + (x.created_at ? ' (' + E(String(x.created_at).slice(0, 10)) + ')' : '') + (x.purged_at ? ', purged' : '') + '</option>';
        }).join('') + '</select></label>' : '')
      + '<label class="w284row"><span>New run from</span><select class="w284sel" data-w284newsrc="1"><option value="keela"' + (S.newSrc !== 'email_history' ? ' selected' : '') + '>Keela\'s exports</option>'
      + '<option value="email_history"' + (S.newSrc === 'email_history' ? ' selected' : '') + '>Email history (Steel\'s mailbox and hub@)</option></select></label>'
      + '<label class="w284row"><span>New run</span><input class="w284in" type="text" maxlength="120" placeholder="' + (S.newSrc === 'email_history' ? 'A name, for example Email history 2020 to 2026' : 'A name, for example Keela final export') + '" data-w284label="1" value="' + E(S.label) + '"></label>'
      + '<button class="' + pri('new') + '" data-w284new="1">Start a new run</button></div>'
      + (S.err ? '<p class="w284err" role="alert">' + E(S.err) + '</p>' : '') + '</section>';
    var body = r ? (src() === 'email_history' ? mScanHtml() : filesHtml()) + '<div class="w284cards" data-w284b="cards">' + kinds().map(cardHtml).join('') + '</div>' + purgeHtml() : '';
    return '<div class="w284" data-w284b="page-' + (r ? r.id : 'none') + '">' + head + body
      + '<p class="w284live w284vh" role="status" aria-live="polite" data-w284b="live"></p></div>';   /* results are read out here (say) */
  }
  function paint() {
    var h = host(); if (!h) return;
    var html;
    if (!can()) html = '<div class="w284" data-w284b="admins"><div class="w284empty">Imports are for admins.</div></div>';
    else if (S.runs === null) { html = '<div class="w284" data-w284b="loading"><div class="w284empty">Loading the imports…</div></div>'; if (!S.loading) load(); }
    else html = pageHtml();
    draw(h, html);
  }

  /* ---------- drawing only what changed ----------
     Each block carries data-w284b (the page, the head and its run line, the files card, one block per file, the cards grid, one block per card,
     purge). paint() builds the whole page as html, then compares block by block with the html each block was last drawn from: a block whose
     html is the same is left alone, a container whose own html is the same is compared child by child, anything else is replaced. A replaced
     block keeps keyboard focus (found again by its data-w284* attribute, then by the card's action, then by the card's title), the scroll of
     its lists and tables, and its open "See the lists"; a replaced card crossfades (140 ms). */
  function keyOf(el) { return el.getAttribute('data-w284b'); }
  function kidsOf(el) {   /* the nearest blocks inside el */
    return [].filter.call(el.querySelectorAll('[data-w284b]'), function (d) { var p = d.parentElement; while (p && p !== el && !p.hasAttribute('data-w284b')) p = p.parentElement; return p === el; });
  }
  function shellOf(el, kids) { var s = el.outerHTML; kids.forEach(function (k) { s = s.replace(k.outerHTML, '<i data-w284slot="' + keyOf(k) + '"></i>'); }); return s; }
  function mark(el) { var kids = kidsOf(el); el.__w284h = el.outerHTML; el.__w284s = kids.length ? shellOf(el, kids) : ''; kids.forEach(mark); }
  function byAttr(root, n, v) {
    if (root.getAttribute && root.getAttribute(n) === v) return root;
    var all = root.querySelectorAll('[' + n + ']');
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute(n) === v && !all[i].disabled) return all[i];
    return null;
  }
  function focusKey(a) {
    var k = { act: a.getAttribute('data-w284act'), caret: null }, c = a.closest('[data-w284card]');
    for (var i = 0; i < a.attributes.length; i++) { var n = a.attributes[i].name; if (/^data-w284/.test(n) && n !== 'data-w284b') { k.n = n; k.v = a.attributes[i].value; break; } }
    k.card = c && c.getAttribute('data-w284card');
    if (a.tagName === 'INPUT' && a.type === 'text') try { k.caret = [a.selectionStart, a.selectionEnd]; } catch (e) { /* fine */ }
    return k;
  }
  function focusEl(el, caret) {
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (caret) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* fine */ }
  }
  function refocus(scope, k) {
    var el = (k.n && byAttr(scope, k.n, k.v)) || (k.act && byAttr(scope, 'data-w284act', k.act)) || (k.card && byAttr(scope, 'data-w284head', k.card));
    if (el) focusEl(el, k.caret);
  }
  function swap(live, fresh, first) {
    var a = document.activeElement, had = a && live.contains(a) && a !== live ? focusKey(a) : null, scroll = {};
    [].forEach.call(live.querySelectorAll('[data-w284keep]'), function (e) { if (e.scrollTop || e.scrollLeft) scroll[e.getAttribute('data-w284keep')] = [e.scrollTop, e.scrollLeft]; });
    live.parentNode.replaceChild(fresh, live);
    mark(fresh);
    [].forEach.call(fresh.querySelectorAll('details[data-w284det]'), function (d) { if (S.open[d.getAttribute('data-w284det')]) d.open = true; });
    [].forEach.call(fresh.querySelectorAll('[data-w284keep]'), function (e) { var s = scroll[e.getAttribute('data-w284keep')]; if (s) { e.scrollTop = s[0]; e.scrollLeft = s[1]; } });
    if (!first) [].forEach.call(fresh.hasAttribute('data-w284card') ? [fresh] : [], function (c) {
      c.classList.add('w284fade'); c.addEventListener('animationend', function () { c.classList.remove('w284fade'); }, { once: true });
    });
    if (had) refocus(fresh, had);
  }
  function sync(live, fresh) {
    var fh = fresh.outerHTML;
    if (live.__w284h === fh) return;
    var lk = kidsOf(live), fk = kidsOf(fresh);
    if (fk.length && lk.length === fk.length && lk.every(function (x, i) { return keyOf(x) === keyOf(fk[i]); }) && live.__w284s === shellOf(fresh, fk)) {
      for (var i = 0; i < fk.length; i++) sync(lk[i], fk[i]);
      live.__w284h = fh;
      return;
    }
    swap(live, fresh, false);
  }
  function draw(h, html) {
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var fresh = tmp.firstElementChild, live = h.firstElementChild;
    if (live && live.__w284h !== undefined && keyOf(live) === keyOf(fresh) && h.children.length === 1) sync(live, fresh);
    else if (live && live.__w284h !== undefined && h.children.length === 1) swap(live, fresh, true);   /* another page (a run picked, a new run): drawn afresh */
    else { h.innerHTML = ''; h.appendChild(fresh); mark(fresh); [].forEach.call(fresh.querySelectorAll('details[data-w284det]'), function (d) { if (S.open[d.getAttribute('data-w284det')]) d.open = true; }); }
    /* an action that moves focus on purpose (Purge asks: Cancel; a new run: its line), kept through a "Loading the imports…" draw */
    var want = S.want;
    if (want && keyOf(h.firstElementChild) !== 'loading') { S.want = null; var el = h.querySelector(want); if (el) focusEl(el); }
  }
  /* read a result out once (the live region exists before it changes, so screen readers hear it) */
  function say(t) {
    var l = host() && host().querySelector('.w284live'); if (!l) return;
    l.textContent = ''; setTimeout(function () { l.textContent = t; }, 60);
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
      var b = S.batches[kind], K = kindOf(kind);   /* a stop the batch records is shown once, as the card's Stopped line */
      if (b && b.status === 'failed' && b.error && S.msg[kind] === b.error) S.msg[kind] = '';
      S.busy[kind] = ''; paint();
      /* the result is read out; a stop is already an alert inside the card */
      if (!S.msg[kind] && !(b && b.status === 'failed')) say('Batch ' + (kinds().indexOf(K) + 1) + ', ' + K.t + ': ' + (sentence(b) || 'done.'));
    }, function (e) { S.busy[kind] = ''; S.msg[kind] = String((e && e.message) || e); paint(); });
  }
  function confirmPop(kind, action, trigger) {
    var K = kindOf(kind), b = S.batches[kind];
    closePop(true);
    var last = trigger || document.activeElement;   /* the button itself: Safari does not focus a clicked button */
    var wrap = document.createElement('div'); wrap.id = 'w284pop'; wrap.className = 'w284pop';
    var title = (action === 'apply' ? 'Apply' : 'Undo') + ' batch ' + (kinds().indexOf(K) + 1) + ': ' + K.t + '?';
    var never = action === 'apply' && !!K.never;
    /* the counts in a paragraph of their own; what cannot be undone on its own warn line, right above the buttons */
    var body = action === 'apply'
      ? '<p id="w284pd">' + E(sentence(b) || 'Compare first.') + '</p>'
        + (never ? '<p class="w284warn" id="w284pw">This cannot be undone.</p>' : '<p class="w284note" id="w284pw">You can undo it afterwards: values that have not changed since are put back.</p>')
      : '<p id="w284pw">' + E(K.undoText || 'Undo puts back every value this batch changed that has not changed since, and removes the rows it added that are unchanged. New contacts, organisations and campaigns stay, listed for you to review.') + '</p>'
        + '<p id="w284pd">' + E(sentence(b)) + '</p>';
    wrap.innerHTML = '<div class="w284box" role="dialog" aria-modal="true" aria-labelledby="w284pt" aria-describedby="w284pd w284pw"><h3 id="w284pt">' + E(title) + '</h3>' + body
      + '<div class="w284acts"><button class="w284btn ghost" data-w284popno="1">Cancel</button><button class="w284btn" data-w284popyes="1">' + (action === 'apply' ? 'Apply' : 'Undo') + '</button></div></div>';
    document.body.appendChild(wrap);
    lockPage(true);   /* the page behind holds still */
    S.pop = { kind: kind, action: action, last: last, key: last && host() && host().contains(last) ? focusKey(last) : null };
    /* Cancel takes focus when the batch is never undone (opt-outs, consent) and for Undo, so one stray Enter changes nothing; Apply otherwise */
    var first = wrap.querySelector(never || action === 'undo' ? '[data-w284popno]' : '[data-w284popyes]'); if (first) first.focus();
    requestAnimationFrame(function () { wrap.classList.add('on'); });
  }
  /* no scrolling behind the confirmation; where a scrollbar takes room, the same room is kept as padding so nothing shifts sideways */
  function lockPage(on) {
    var de = document.documentElement;
    if (on) { var sb = window.innerWidth - de.clientWidth; de.classList.add('w284lock'); if (sb > 0) { de.style.paddingRight = sb + 'px'; de.__w284pad = true; } }
    else { de.classList.remove('w284lock'); if (de.__w284pad) { de.style.paddingRight = ''; de.__w284pad = false; } }
  }
  function closePop(now) {
    var p = document.getElementById('w284pop');
    if (p) {   /* a 140 ms fade out, then gone; a new confirmation removes the old one at once */
      p.id = 'w284pop-out'; p.setAttribute('aria-hidden', 'true'); p.classList.add('out');
      var gone = function () { if (p.parentNode) p.parentNode.removeChild(p); };
      if (now) gone(); else { p.addEventListener('transitionend', gone, { once: true }); setTimeout(gone, 260); }
    }
    lockPage(false);
    var pop = S.pop; S.pop = null;
    if (!pop) return;
    if (pop.last && pop.last !== document.body && document.body.contains(pop.last)) focusEl(pop.last);
    else if (host()) refocus(host(), pop.key || { card: pop.kind });   /* its card was redrawn meanwhile: the same control, or the card's title */
  }
  function stageFile(fid, offset) {
    S.stage[fid] = 'Staging…'; paint();
    return fn('stage', { file_id: fid, offset: offset || 0 }).then(function (r) {
      if (r.error) { S.stage[fid] = ''; S.upMsg = 'Staging stopped: ' + r.error; S.upErr = true; return loadRun().then(paint); }
      var d = r.data;
      if (d.next_offset != null) { S.stage[fid] = 'Staged ' + num(d.staged_through) + ' of ' + num(d.rows) + ' rows…'; paint(); return stageFile(fid, d.next_offset); }
      S.stage[fid] = ''; S.upMsg = 'Staged ' + plural(d.rows, 'row', 'rows') + '. Check its keys, then compare.'; S.upErr = false; say(S.upMsg);
      S.openKeys[fid] = true;
      return loadRun().then(function () { return loadKeys(fid); });
    });
  }
  function loadKeys(fid) {
    return fn('keys', { file_id: fid }).then(function (r) { S.keys[fid] = r.error ? { error: r.error } : (r.data.keys || []); paint(); });
  }
  function upload() {
    /* the chosen file lives in S.upFile, so a repaint of the picker never loses it */
    var inp = host() && host().querySelector('[data-w284upfile]'), file = S.upFile || (inp && inp.files && inp.files[0]);
    if (!file) { S.upMsg = 'Choose a file first.'; S.upErr = true; paint(); return; }
    var spec = FILES.filter(function (f) { return f.k === S.upKind; })[0];
    var path = S.run + '/' + Date.now() + '-' + storeName(file.name);
    S.names[path] = file.name;   /* shown as you named it, for as long as this page is open */
    S.upBusy = true; S.upMsg = 'Uploading ' + file.name + '…'; S.upErr = false; paint();
    Promise.resolve(db.storage.from('imports').upload(path, file, { contentType: spec.type, upsert: false })).then(function (u) {
      if (u && u.error) throw new Error('The file could not be uploaded (' + (u.error.message || u.error) + ').');
      return fn('register', { run_id: S.run, path: path, kind: S.upKind });
    }).then(function (r) {
      if (r.error) throw new Error('The file was not recorded: ' + r.error);
      S.upBusy = false; S.upMsg = 'Uploaded. Staging…'; S.upErr = false; S.upFile = null;
      return loadRun().then(function () { return stageFile(r.data.file_id, 0); });
    }).catch(function (e) { S.upBusy = false; S.upMsg = String((e && e.message) || e); S.upErr = true; paint(); });
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
    else if ((el = t.closest('[data-w284apply]'))) confirmPop(el.getAttribute('data-w284apply'), 'apply', el);
    else if ((el = t.closest('[data-w284undo]'))) confirmPop(el.getAttribute('data-w284undo'), 'undo', el);
    else if ((el = t.closest('[data-w284stage]'))) { var fid = Number(el.getAttribute('data-w284stage')); var f = S.files.filter(function (x) { return x.id === fid; })[0]; stageFile(fid, f && f.rows != null && f.staged_through ? f.staged_through : 0); }
    else if ((el = t.closest('[data-w284keys]'))) { var id = Number(el.getAttribute('data-w284keys')); S.openKeys[id] = !S.openKeys[id]; if (S.openKeys[id] && !S.keys[id]) loadKeys(id); paint(); }
    else if (t.closest('[data-w284upload]')) upload();
    else if (t.closest('[data-w284new]')) {
      if (S.newSrc === 'email_history') { mStart(S.label); return; }   /* wave292: mail-history starts the run and its free phases */
      fn('new_run', { label: S.label }).then(function (r) {
        if (r.error) { S.err = r.error; paint(); return; }
        S.label = ''; S.run = r.data.run_id; S.runs = null; S.batches = {}; S.files = []; S.stale = {}; S.msg = {}; S.open = {}; S.purgeAsk = false; S.purgeMsg = ''; S.upMsg = ''; S.upErr = false;
        S.want = '.w284runline';   /* the new run's line takes focus, so it is read out */
        load();
      });
    }
    else if (t.closest('[data-w284purge]')) { S.purgeAsk = true; S.want = '[data-w284purgeno]'; paint(); }   /* the safe choice takes focus */
    else if (t.closest('[data-w284purgeno]')) { S.purgeAsk = false; S.want = '[data-w284purge]'; paint(); }
    else if (t.closest('[data-w284purgeyes]')) {
      S.purgeAsk = false; S.purgeMsg = 'Purging…'; paint();
      fn('purge', { run_id: S.run }).then(function (r) {
        S.purgeMsg = r.error ? 'Purge stopped: ' + r.error : 'Purged: ' + plural(r.data.removed, 'file', 'files') + ' deleted, with the staged rows and the change records.';
        say(S.purgeMsg); S.want = '.w284runline';
        load();   /* the page stays while the runs reload */
      });
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.closest || !t.closest('#w284root')) return;
    if (t.hasAttribute('data-w284run')) { S.run = Number(t.value); S.batches = {}; S.files = []; S.keys = {}; S.openKeys = {}; S.stale = {}; S.msg = {}; S.open = {}; S.purgeAsk = false; S.purgeMsg = ''; S.upMsg = ''; S.upErr = false; reloadRun(); }
    else if (t.hasAttribute('data-w284upkind')) { S.upKind = t.value; paint(); }
    else if (t.hasAttribute('data-w284newsrc')) { S.newSrc = t.value; paint(); }
    else if (t.hasAttribute('data-w284upfile')) { S.upFile = (t.files && t.files[0]) || null; S.upMsg = ''; S.upErr = false; paint(); }
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
  /* an open "See the lists" is remembered, so a repaint of its card opens it again (toggle does not bubble: listen while capturing) */
  document.addEventListener('toggle', function (ev) { var d = ev.target; if (d && d.matches && d.matches('#w284root details[data-w284det]')) S.open[d.getAttribute('data-w284det')] = d.open; }, true);
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
  window.w284 = { open: open, paint: paint, load: load, state: function () { return S; }, kinds: KINDS.map(function (k) { return k.k; }), mailKinds: MAIL.map(function (k) { return k.k; }), sentence: sentence };
