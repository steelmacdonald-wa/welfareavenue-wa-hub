/* w284drive.js: the Import page (wave284, CRM slice 1 Phase 4). Fixture rows are made up for the test (no real people); crm-import is answered by
   window.__WA_INVOKE and every call is recorded; the stub echoes writes and never changes the fixture.
   - The CRM rail's Imports item (#crm/settings/imports) shows for an admin (import_admin), right after Sources, and is hidden for a member and a
     team lead; the page itself says it is for admins to anyone else and draws no card.
   - An admin sees the run, its file (Keys: a table with real headers, counts only, and the subscription history key), and one card per batch
     kind in the B.1 order, each with its status as a dot and a word and the report's counts in a sentence.
   - The opt-outs and consent cards have no Undo; an applied people card has Undo; a compared card has Apply; a failed card says why inside it.
   - Apply and Undo open a centred confirmation that repeats the counts (Escape and Cancel close it; Apply calls crm-import apply).
   - Ticking an organisation pair saves keela_org_pairs_ok and asks for a new compare. The purge reminder shows 30 days after the last apply,
     and Purge asks inside its own row. No page errors; at phone width nothing scrolls sideways.
   usage: node test/w284drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0, b2; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const ORDER = ['optouts', 'legacy_fields', 'people', 'fields', 'orgs', 'consent', 'participation', 'form_answers'];
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'test', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [], job_title: null, do_not_contact: false, dnc_reason: null }, o || {});
}
const REP = (kind, counts, lists) => ({ kind, counts: Object.assign({ rows_read: 0, matched: 0, created: 0, updated: {}, kept_hub_value: {}, skipped: {} }, counts), lists: Object.assign({ keela_ids_skipped: [], org_pairs: [], assignees_unmapped: [], campaigns_to_create: [], changed_since_kept: [], created_review: [] }, lists || {}), changes: 0 });
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [C(5101, 'Ada Testimport', { emails: ['ada.test@example.com'], primary_email: 'ada.test@example.com' }), C(5102, 'Ben Testimport')];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = []; fx.crm_donations = [];
  fx.crm_import_runs = [{ id: 7, label: 'Test Keela run', created_by: 'test@example.com', created_at: '2026-08-10T12:00:00Z', last_applied_at: '2026-08-20T12:00:00Z', purged_at: null },
                        { id: 6, label: 'Test older run', created_by: 'test@example.com', created_at: '2026-08-01T12:00:00Z', last_applied_at: null, purged_at: '2026-08-05T12:00:00Z' }];
  fx.crm_import_batches = [
    { id: 71, run_id: 7, kind: 'optouts', status: 'applied', report: REP('optouts', { rows_read: 1510, matched: 8, updated: { email_status: 8, consent_source: 8 }, skipped: { 'latest event is not an opt-out': 1502 }, undated_events: 2, undated_optouts_honoured: 1 }), error: null, applied_at: '2026-08-20T12:00:00Z', applied_by: 'test@example.com' },
    { id: 72, run_id: 7, kind: 'legacy_fields', status: 'compared', report: REP('legacy_fields', { rows_read: 1468, matched: 1468, updated: { crm_contact_fields: 600, owner_member_id: 0 }, skipped: { 'assignee not mapped': 125 } }, { assignees_unmapped: ['Test Keela User'], positions_unmapped: ['Juggler'] }), error: null },
    { id: 73, run_id: 7, kind: 'people', status: 'applied', report: REP('people', { rows_read: 1510, matched: 1457, created: 31, updated: { city: 40, phones: 12 }, kept_hub_value: { city: 3 } }, { keela_ids_skipped: [{ keela_id: 'KT007', reason: 'no email or phone' }] }), error: null, applied_at: '2026-08-20T12:00:00Z' },
    { id: 74, run_id: 7, kind: 'fields', status: 'failed', report: null, error: 'missing key Birth Date' },
    { id: 75, run_id: 7, kind: 'orgs', status: 'compared', report: REP('orgs', { rows_read: 63, matched: 20, created: 30 }, { org_pairs: [{ keela_company_id: 'KC05', keela_name: 'Test Foundation of Montreal', partner_id: 4002, partner_name: 'Test Foundation' }] }), error: null },
    { id: 76, run_id: 7, kind: 'consent', status: 'applied', report: REP('consent', { rows_read: 1510, matched: 1400, updated: { crm_consent_events: 2900 } }), error: null, applied_at: '2026-08-20T12:00:00Z' },
    { id: 77, run_id: 7, kind: 'participation', status: 'compared', report: REP('participation', { rows_read: 1510, matched: 1100 }, { campaigns_to_create: ['Test Gala 2026'] }), error: null }
  ];
  fx.app_config = (fx.app_config || []).concat([{ key: 'keela_keys', value: '{}' }, { key: 'keela_assignee_map', value: '{}' }, { key: 'keela_org_pairs_ok', value: '[]' }, { key: 'keela_campaign_types', value: '{}' }]);
  return fx;
}
const INVOKE = `window.__calls = []; window.__WA_INVOKE = function (name, opts) {
  var b = (opts && opts.body) || {}; window.__calls.push({ name: name, body: JSON.parse(JSON.stringify(b)) });
  if (name !== 'crm-import') return { data: null, error: null };
  if (b.action === 'files') return { data: { files: b.run_id === 7 ? [{ id: 11, run_id: 7, name: '7/1700000000000-test-contacts.json', kind: 'keela_contacts_json', rows: 14, staged_through: 14 }] : [] }, error: null };
  if (b.action === 'keys') return { data: { keys: [{ key: 'Contact Id', filled: 14 }, { key: 'Primary Email', filled: 12 }, { key: 'Subscription History', filled: 8 }, { key: 'Subscription History[].date', filled: 8 }] }, error: null };
  if (b.action === 'apply' || b.action === 'undo' || b.action === 'compare') return { data: { report: {} }, error: null };
  return { data: {}, error: null };
};`;
const CAPS = { admin: { gifts_edit: true, import_admin: true, hr_private: true }, leader: { gifts_edit: true }, member: {} };
const RPCS = (who) => ({ wa_org_editor: who === 'admin', crm_age_band: null, wa_my_caps: CAPS[who] });
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const rail = (f) => f.ev(() => [...document.querySelectorAll('#w153rail [data-w153go]')].map(a => ({ t: a.innerText.replace(/\s+/g, ' ').trim(), h: a.getAttribute('data-w153go'), on: a.getAttribute('aria-current') === 'page' })));

(async () => {
  const browser = await launch();

  /* ---------------- a member and a team lead: no Imports ---------------- */
  for (const who of ['member', 'leader']) {
    let f = await fresh(browser, { who, hash: '#mypage', fixture: fixture(), rpcs: RPCS(who), init: INVOKE, wait: 4000 });
    await f.hash('#crm', 2600);
    let r = await rail(f);
    ok(who + ': the CRM rail has no Imports item', r.length > 3 && !r.some(x => x.t === 'Imports' || x.h === '#crm/settings/imports'), r);
    await f.hash('#crm/settings/imports', 2000);
    const b = await f.ev(() => ({ txt: (document.getElementById('w284root') || {}).innerText || '', cards: document.querySelectorAll('[data-w284card]').length }));
    ok(who + ': the Import page says it is for admins and draws no card', /Imports are for admins\./.test(b.txt) && b.cards === 0, b);
    const calls = await f.ev(() => (window.__calls || []).filter(c => c.name === 'crm-import').length);
    ok(who + ': and never calls crm-import', calls === 0, calls);
    ok(who + ': no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------------- an admin ---------------- */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), rpcs: RPCS('admin'), init: INVOKE, wait: 4000 });
  await f.hash('#crm', 2600);
  let r = await rail(f);
  const iS = r.findIndex(x => x.t === 'Sources'), iI = r.findIndex(x => x.t === 'Imports');
  ok('admin: the CRM rail has Imports right after Sources', iS >= 0 && iI === iS + 1 && r[iI].h === '#crm/settings/imports', r);
  await f.hash('#crm/settings/imports', 2600);
  r = await rail(f);
  ok('admin: on the Import page the rail marks Imports', r.some(x => x.t === 'Imports' && x.on) && !r.some(x => x.t === 'Contacts' && x.on), r);
  let b = await f.ev(() => ({
    cards: [...document.querySelectorAll('#w284root [data-w284card]')].map(c => c.getAttribute('data-w284card')),
    st: [...document.querySelectorAll('#w284root [data-w284card]')].map(c => { const s = c.querySelector('.w284st'); return { k: c.getAttribute('data-w284card'), word: s && s.textContent.trim(), dot: !!(s && s.querySelector('i')) }; }),
    run: (document.querySelector('#w284root [data-w284run]') || {}).value, runs: document.querySelectorAll('#w284root [data-w284run] option').length,
    file: (document.querySelector('#w284root .w284file') || {}).innerText || ''
  }));
  ok('the cards follow the B.1 order', JSON.stringify(b.cards) === JSON.stringify(ORDER), b.cards);
  ok('each card shows its status as a dot and a word', b.st.every(x => x.dot && /^(new|compared|applied|undone|failed)$/.test(x.word)) &&
     JSON.stringify(b.st.map(x => x.word)) === JSON.stringify(['applied', 'compared', 'applied', 'failed', 'compared', 'applied', 'compared', 'new']), b.st);
  ok('one run at a time, with a picker for earlier runs', b.run === '7' && b.runs === 2, b);
  ok('the run\'s file shows as staged', /test-contacts\.json/.test(b.file) && /Staged: 14 rows/.test(b.file), b.file);
  b = await f.ev(() => {
    const card = k => document.querySelector('#w284root [data-w284card="' + k + '"]');
    const btns = k => [...card(k).querySelectorAll('.w284acts button')].map(x => x.innerText.trim());
    return { optouts: btns('optouts'), consent: btns('consent'), people: btns('people'), legacy: btns('legacy_fields'), fields: btns('fields'), forms: btns('form_answers'),
      undoOpt: !!card('optouts').querySelector('[data-w284undo]'), undoCon: !!card('consent').querySelector('[data-w284undo]'),
      optNote: card('optouts').innerText, fieldsErr: (card('fields').querySelector('.w284err') || {}).innerText || '', formsNote: card('form_answers').innerText,
      peopleSum: (card('people').querySelector('.w284sum') || {}).innerText || '' };
  });
  ok('no Undo on the opt-outs card (nor on consent)', !b.undoOpt && !b.undoCon && b.optouts.length === 0 && b.consent.length === 0 && /never undone/.test(b.optNote), b);
  ok('an applied people card has Undo; a compared card has Apply', JSON.stringify(b.people) === '["Undo"]' && JSON.stringify(b.legacy) === '["Apply"]', b);
  ok('a failed card says why inside it, with Compare', /Stopped: missing key Birth Date/.test(b.fieldsErr) && JSON.stringify(b.fields) === '["Compare"]', b);
  ok('a card waits for its file (no responses file staged)', /Stage the Keela form responses/.test(b.formsNote) && JSON.stringify(b.forms) === '["Compare"]', b.formsNote);
  b2 = await f.ev(() => ({ guard: window.__wa284, old: window.__w284, opt: (document.querySelector('#w284root [data-w284card="optouts"] .w284sum') || {}).innerText || '' }));
  ok('the segment\'s guard is window.__wa284', b2.guard === true && b2.old === undefined, b2);
  ok('the opt-outs sentence counts the events with no readable date', /2 events with no readable date \(1 opt-out among them honoured\)/.test(b2.opt), b2.opt);
  ok('the report\'s counts in a sentence', /^Applied: Read 1,510 rows; 1,457 matched; 31 new; 52 changes \(city 40, phones 12\); the Hub kept its own value 3 times\.$/.test(b.peopleSum), b.peopleSum);
  b = await f.ev(() => { const d = document.querySelector('#w284root [data-w284card="people"] details'); if (d) d.open = true; return d ? d.innerText : ''; });
  ok('See the lists shows Keela ids, never a value', /See the lists/.test(b) && /KT007/.test(b) && !/@/.test(b), b);
  // Apply: a centred confirmation that repeats the counts
  await click(f, '#w284root [data-w284apply="legacy_fields"]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => { const p = document.getElementById('w284pop'); const box = p && p.querySelector('[role="dialog"]'); const rc = box && box.getBoundingClientRect();
    return { open: !!p, modal: box && box.getAttribute('aria-modal'), txt: box ? box.innerText : '', focus: document.activeElement && document.activeElement.getAttribute('data-w284popyes'),
      centred: rc ? Math.abs((rc.left + rc.width / 2) - innerWidth / 2) < 4 && Math.abs((rc.top + rc.height / 2) - innerHeight / 2) < 40 : false }; });
  ok('Apply opens a centred confirmation that repeats the counts', b.open && b.modal === 'true' && b.centred && /Apply batch 2: Keela fields already in the Hub\?/.test(b.txt) && /If applied: Read 1,468 rows; 1,468 matched/.test(b.txt) && b.focus === '1', b);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  ok('Escape closes it, and nothing was applied', !(await f.ev(() => !!document.getElementById('w284pop'))) && !(await f.ev(() => window.__calls.some(c => c.body.action === 'apply'))));
  await click(f, '#w284root [data-w284undo="people"]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => (document.querySelector('#w284pop [role="dialog"]') || {}).innerText || '');
  ok('Undo opens a confirmation too, saying new contacts stay', /Undo batch 3: People\?/.test(b) && /New contacts, organisations and campaigns stay/.test(b) && /Read 1,510 rows/.test(b), b);
  await click(f, '#w284pop [data-w284popno]'); await f.page.waitForTimeout(200);
  ok('Cancel closes it', !(await f.ev(() => !!document.getElementById('w284pop'))));
  await click(f, '#w284root [data-w284apply="legacy_fields"]'); await f.page.waitForTimeout(300);
  await click(f, '#w284pop [data-w284popyes]'); await f.page.waitForTimeout(800);
  b = await f.ev(() => window.__calls.filter(c => c.body.action === 'apply').map(c => c.body));
  ok('confirming Apply calls crm-import apply for that batch', b.length === 1 && b[0].batch_id === 72, b);
  // the extra controls
  b = await f.ev(() => ({ pair: !!document.querySelector('#w284root [data-w284card="orgs"] [data-w284pair="KC05|4002"]'),
    assign: [...document.querySelectorAll('#w284root [data-w284card="legacy_fields"] [data-w284assign]')].map(s => s.getAttribute('data-w284assign')),
    ctype: [...document.querySelectorAll('#w284root [data-w284card="participation"] [data-w284ctype] option')].map(o => o.value) }));
  ok('orgs has the pair checkbox; legacy_fields the assignee select; participation the campaign type select', b.pair && JSON.stringify(b.assign) === '["Test Keela User"]'
     && JSON.stringify(b.ctype) === '["","fundraising_event","drive","appeal","program"]', b);
  await f.ev(() => { window.__writes = []; const f0 = db.from.bind(db); db.from = function (t) { const q = f0(t); const u = q.upsert; q.upsert = function (p) { window.__writes.push({ t: t, p: JSON.parse(JSON.stringify(p)) }); return u.apply(q, arguments); }; return q; }; });
  await click(f, '#w284root [data-w284pair="KC05|4002"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ w: window.__writes, card: document.querySelector('#w284root [data-w284card="orgs"]').innerText, btn: [...document.querySelectorAll('#w284root [data-w284card="orgs"] .w284acts button')].map(x => x.innerText.trim()) }));
  ok('ticking a pair saves keela_org_pairs_ok', b.w.length === 1 && b.w[0].t === 'app_config' && b.w[0].p.key === 'keela_org_pairs_ok' && JSON.parse(b.w[0].p.value)[0].keela_company_id === 'KC05' && JSON.parse(b.w[0].p.value)[0].partner_id === 4002, b.w);
  ok('and asks for a new compare before applying', /compare again before applying/.test(b.card) && JSON.stringify(b.btn) === '["Compare again"]', b);
  // the file's keys
  await click(f, '#w284root [data-w284keys="11"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => { const t = document.querySelector('#w284root .w284keys'); return t ? { th: [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()), scope: [...t.querySelectorAll('thead th')].every(x => x.getAttribute('scope') === 'col'),
    rows: t.querySelectorAll('tbody tr').length, sub: [...document.querySelectorAll('#w284root [data-w284subkey] option')].map(o => o.textContent) } : null; });
  ok('Keys: a table with real headers, counts only', b && JSON.stringify(b.th) === '["Key","Rows with a value"]' && b.scope && b.rows === 4, b);
  ok('the contacts file offers the subscription history key (list keys only)', b && b.sub.indexOf('Subscription History') > 0 && b.sub.indexOf('Subscription History[].date') < 0, b && b.sub);
  // purge
  b = await f.ev(() => (document.querySelector('#w284root .w284purge') || {}).innerText || '');
  ok('the purge reminder shows 30 days after the last apply', /It has been 36 days since the last batch was applied/.test(b) && /Purge this run/.test(b), b);
  await click(f, '#w284root [data-w284purge]'); await f.page.waitForTimeout(200);
  b = await f.ev(() => ({ ask: (document.querySelector('#w284root .w284ask') || {}).innerText || '', pop: !!document.getElementById('w284pop'), purged: window.__calls.some(c => c.body.action === 'purge') }));
  ok('Purge asks inside its own row (no pop-up) and purges nothing yet', /can no longer be undone/.test(b.ask) && !b.pop && !b.purged, b);
  await click(f, '#w284root [data-w284purgeno]'); await f.page.waitForTimeout(200);
  // an earlier, purged run
  await f.ev(() => { const s = document.querySelector('#w284root [data-w284run]'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(700);
  b = await f.ev(() => ({ txt: (document.querySelector('#w284root .w284filescard') || {}).innerText || '', btns: document.querySelectorAll('#w284root [data-w284card] .w284acts button').length }));
  ok('a purged run says so and offers no button', /This run was purged/.test(b.txt) && b.btns === 0, b);
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- phone width ---------------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), rpcs: RPCS('admin'), init: INVOKE, wait: 4000 });
  await f.hash('#crm/settings/imports', 2600);
  await click(f, '#w284root [data-w284keys="11"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, cards: document.querySelectorAll('#w284root [data-w284card]').length,
    wide: [...document.querySelectorAll('#w284root *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5) }));
  ok('phone: the Import page does not scroll sideways', b.cards === 8 && b.sw <= b.w + 1 && b.wide.length === 0, b);
  await click(f, '#w284root [data-w284apply="legacy_fields"]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => { const box = document.querySelector('#w284pop [role="dialog"]'); const rc = box && box.getBoundingClientRect(); return rc ? { l: rc.left, r: rc.right, w: innerWidth } : null; });
  ok('phone: the confirmation fits the screen', b && b.l >= 0 && b.r <= b.w, b);
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw284drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
