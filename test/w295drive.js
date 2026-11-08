/* w295drive.js: the Contacts page's Filters builder (wave295). Dev only: the data goes in through window.__WAFIX (test/boot.js), and the
   database's answer (crm_filter_contacts, crm_list_preview, crm_tag_aliases) comes from a small stand-in engine inside the page that follows
   build/data/wa295_filters.sql for the conditions this drive uses. Invented people only (example.invalid).
   It checks: the Filters button beside the quick menus (which stay as they were), the builder (open, focus, Escape), a condition of every type
   and the value each sends, groups, the tag picker with counts and a Keela name, the live count, Show N people, chips (each removes its
   condition), Clear filters, Save as a list, a saved live list opened as a view (from the builder and from Lists), the address (#crm/f/...)
   kept on reload with no flash of everyone, the empty and error states, and the worst cases: long labels, 1 and 1,000 results, 390 and 320 px,
   200% zoom (683 px at scale 2), nothing past the screen.
   usage: [CAND=<page>] [WA_CHROME=<chrome>] [WA_SHOTS=<folder>] node test/w295drive.js */
const fs = require('fs'), path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const SHOTS = process.env.WA_SHOTS || '';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

const LONG_FIELD = 'Rally Paper 2026 team preference (Challengers, Logic and Trivia, Quest, Treasurer or Online Challenges)';
const LONG_TAG = 'gift basket drive 2026 volunteer who also delivered on the Plateau and in Rosemont–La Petite-Patrie';
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'test', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [], job_title: null, do_not_contact: false, dnc_reason: null }, o || {});
}
function fixture(set) {
  const fx = loadFixture();
  let cs = [
    C(9501, 'Ada Testfilter', { emails: ['ada@example.invalid'], phones: ['514 555 0191'], kinds: ['volunteer'], tags: ['server', 'newsletter'], job_title: 'Head cook', hub_servings: 3, last_serving_on: '2026-09-20' }),
    C(9502, 'Bo Testfilter', { emails: ['bo@example.invalid'], kinds: ['supporter'], tags: ['donor'], do_not_contact: true, dnc_reason: 'asked', org_names: ['Test Bakery Filters'] }),
    C(9503, 'Cy Testfilter', { kinds: ['volunteer', 'donor'], tags: [LONG_TAG] }),
    C(9504, 'Di Testfilter', { emails: ['di@example.invalid'], kinds: ['partner'], tags: ['Server', 'photographer'], volunteer_organization: 'Test School Filters' })
  ];
  if (set === 'huge') cs = cs.concat(Array.from({ length: 1000 }, (_, i) => C(20000 + i, 'Many Testfilter ' + (i + 1), { kinds: ['volunteer'], tags: ['server'], emails: ['m' + i + '@example.invalid'] })));
  fx.crm_contacts_v = cs; fx.crm_contacts = cs.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = []; fx.crm_donations = []; fx.crm_gift_receipts_v = []; fx.crm_receipts = [];
  fx.crm_chapters = [{ code: 'montreal', name_en: 'Montreal', active: true, sort: 1 }, { code: 'toronto', name_en: 'Toronto', active: true, sort: 2 }];
  fx.crm_contact_chapters = [{ contact_id: 9501, chapter: 'toronto' }, { contact_id: 9502, chapter: 'montreal' }, { contact_id: 9504, chapter: 'montreal' }, { contact_id: 9504, chapter: 'toronto' }];
  fx.crm_fields = [
    { id: 71, key: 'rally_paper_team', label: LONG_FIELD, type: 'choice', options: ['Quest', 'Logic & Trivia', 'Challengers (Live Physical Challenges)'], sort: 1, archived_at: null },
    { id: 72, key: 'first_day', label: 'First day', type: 'date', options: [], sort: 2, archived_at: null },
    { id: 73, key: 'age_16_plus', label: '16 or older', type: 'yes_no', options: [], sort: 3, archived_at: null },
    { id: 74, key: 'positions', label: 'Volunteer positions', type: 'multi', options: ['Server', 'Cook', 'Driver'], sort: 4, archived_at: null }];
  fx.crm_contact_fields = [{ contact_id: 9501, field_id: 71, value: 'Quest' }, { contact_id: 9502, field_id: 71, value: 'Logic & Trivia' }, { contact_id: 9501, field_id: 72, value: '2025-06-01' },
    { contact_id: 9502, field_id: 72, value: '2026-02-01' }, { contact_id: 9501, field_id: 73, value: true }, { contact_id: 9504, field_id: 73, value: false }, { contact_id: 9501, field_id: 74, value: ['Server', 'Cook'] }];
  fx.crm_lists = [{ id: 31, name: 'Toronto servers (a live list with a long name to see how it wraps on a phone)', description: null, kind: 'dynamic', member_ids: [],
    filter: { groups: [{ all: [{ f: 'chapter', op: 'is', v: 'toronto' }, { f: 'tag', op: 'has', v: 'server' }] }] }, created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-01T12:00:00Z' },
    { id: 32, name: 'Old flat list', description: null, kind: 'dynamic', member_ids: [], filter: { kind: 'volunteer' }, created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-01T12:00:00Z' }];
  fx.crm_campaigns = []; fx.crm_campaign_stats_v = []; fx.crm_forms = []; fx.crm_form_stats_v = []; fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_import_runs = []; fx.crm_import_batches = [];
  fx.app_config = (fx.app_config || []).concat([{ key: 'mail_mode', value: 'test' }]);
  return fx;
}
/* the stand-in database engine (follows wa295_filters.sql for what this drive uses), and a record of every call */
const ENGINE = () => {
  window.__w295 = { calls: [], fail: null, delay: 120 };
  const fx = window.__WAFIX, fold = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const AL = [{ alias: 'volunteer server', tag: 'server' }, { alias: 'monthly newsletter subscriber', tag: 'newsletter' }];
  const vals = k => Array.isArray(k.v) ? k.v.map(String) : [String(k.v == null ? '' : k.v)];
  const fieldVal = (c, key) => { const f = fx.crm_fields.find(x => x.key === key); if (!f) return undefined; const r = fx.crm_contact_fields.find(x => x.contact_id === c.id && x.field_id === f.id); return { f, v: r ? r.value : null }; };
  function one(c, k) {
    const op = k.op || '', v = String(k.v == null ? '' : k.v), many = (test) => { const vs = vals(k), hit = vs.filter(test).length; return op === 'not' || op === 'none' ? hit === 0 : op === 'all' ? vs.length > 0 && hit === vs.length : hit > 0; };
    let r;
    if (k.f === 'kind') return many(e => e === 'donor' ? c.kinds.includes('donor') || c.donation_count > 0 : e === 'partner' ? c.kinds.includes('partner') || c.org_names.length > 0 : c.kinds.includes(e));
    if (k.f === 'role') return many(e => c.volunteer_roles.includes(e));
    if (k.f === 'tag') { const tags = c.tags.map(fold); return many(e => tags.includes(fold(e)) || AL.some(a => a.alias === fold(e) && tags.includes(a.tag))); }
    if (k.f === 'field') {
      const x = fieldVal(c, k.key); if (!x) return false;
      const items = x.v == null ? [] : (Array.isArray(x.v) ? x.v : [x.v]).map(String).filter(s => s.trim() !== '');
      if (op === 'set') return items.length > 0; if (op === 'empty') return items.length === 0; if (!items.length) return false;
      const yes = s => ['true', 'yes', 'y', '1', 'oui'].includes(fold(s).trim());
      if (op === 'is' || op === 'any') return vals(k).some(e => items.some(s => x.f.type === 'yes_no' ? yes(e) === yes(s) : fold(s) === fold(e)));
      if (op === 'contains') return vals(k).some(e => items.some(s => fold(s).includes(fold(e))));
      if (op === 'before') return items.some(s => s < v); if (op === 'after') return items.some(s => s > v);
      return false;
    }
    if (k.f === 'chapter') { const ch = fx.crm_contact_chapters.filter(x => x.contact_id === c.id).map(x => x.chapter); r = fold(v) === 'montreal' ? !ch.length || ch.includes('montreal') : ch.includes(fold(v)); }
    else if (k.f === 'dnc') r = !!c.do_not_contact;
    else if (k.f === 'phone') r = c.phones.some(p => p.trim());
    else if (k.f === 'email') r = c.emails.length > 0;
    else if (k.f === 'org') r = c.org_names.concat(c.volunteer_organization ? [c.volunteer_organization] : []).some(o => fold(o).includes(fold(v)));
    else if (k.f === 'job_title') r = !!(c.job_title && fold(c.job_title).includes(fold(v)));
    else if (k.f === 'served') r = op === 'never' ? !(c.hub_servings + c.legacy_servings) : op === 'count_gte' ? c.hub_servings + c.legacy_servings >= Number(v || 1) : c.hub_servings + c.legacy_servings > 0;
    else if (k.f === 'city') r = fold(c.city).includes(fold(v));
    else if (k.f === 'search') r = fold(v).split(/\s+/).filter(Boolean).every(w => fold([c.full_name].concat(c.emails, c.tags).join(' ')).includes(w));
    else r = true;
    return op === 'not' || op === 'none' ? !r : r;
  }
  const run = groups => fx.crm_contacts_v.filter(c => !groups.length || groups.some(g => (g.all || []).every(k => one(c, k)))).map(c => c.id);
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, a) {
    if (fn === 'crm_filter_contacts' || fn === 'crm_list_preview' || fn === 'crm_tag_aliases') {
      window.__w295.calls.push({ fn, args: JSON.parse(JSON.stringify(a || {})) });
      const W = window.__w295;
      return new Promise(res => setTimeout(() => {
        if (fn === 'crm_tag_aliases') return res({ data: AL, error: null });
        if (W.fail) return res({ data: null, error: { message: W.fail } });
        const g = (a && a.p_filter && a.p_filter.groups) || [], ids = run(g);
        res({ data: fn === 'crm_filter_contacts' ? ids.map(id => ({ id })) : ids, error: null });
      }, W.delay));
    }
    return r0(fn, a);
  };
};
const RPCS = { wa_org_editor: true, wa_my_caps: { gifts_edit: true, import_admin: true, hr_private: true } };
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.focus(); el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); if (el.type === 'date') el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [s, v]);
const tick = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.checked = !el.checked; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, s);
const wait = (f, ms) => f.page.waitForTimeout(ms);
const rows = f => f.ev(() => [...document.querySelectorAll('#crm .w152row .nm')].map(x => x.textContent));
const countText = f => f.ev(() => (document.querySelector('#crm .w152count') || {}).textContent || '');
const lastCall = (f, fn) => f.ev(fn => { const c = window.__w295.calls.filter(x => x.fn === fn); return c.length ? c[c.length - 1].args : null; }, fn);
function probe(f) {
  return f.ev(() => {
    const iw = innerWidth, sw = document.documentElement.scrollWidth;
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nm = e => (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase());
    const all = [...document.querySelectorAll('#crm .w152root *')].filter(vis);
    const wide = all.filter(e => e.getBoundingClientRect().right > iw + 1 && !e.closest('.w152tabs')).map(e => nm(e) + '>' + Math.round(e.getBoundingClientRect().right));
    const spill = all.filter(e => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 2 && cs.overflowX === 'visible' && cs.display !== 'inline' && e.tagName !== 'svg' && e.tagName !== 'SELECT' && e.tagName !== 'OPTION' && !e.closest('.w152tabs'); }).map(e => nm(e) + ':' + e.scrollWidth + '/' + e.clientWidth);
    return { side: sw > iw + 1, wide: wide.slice(0, 5), spill: spill.slice(0, 5) };
  });
}
async function fits(f, label) { const p = await probe(f); ok(label + ': nothing past the screen and nothing spills out of its box', !p.side && !p.wide.length && !p.spill.length, p); }
async function shot(f, name) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); }
async function boot(browser, o) {
  o = o || {};
  const f = await fresh(browser, { who: 'admin', width: o.w || 1366, height: o.h, hash: '#mypage', fixture: fixture(o.set), rpcs: RPCS, wait: 3200 });
  await f.ev(ENGINE);
  await f.hash(o.hash || '#crm', 1800);
  return f;
}

async function main(browser) {
  /* ---------------- the builder at desktop width ---------------- */
  let f = await boot(browser);
  let b = await f.ev(() => ({ sel: [...document.querySelectorAll('#crm .w152bar select')].map(s => s.getAttribute('aria-label')), q: !!document.querySelector('#crm [data-w152q]'),
    btn: (document.querySelector('#crm [data-w295open]') || {}).textContent, exp: (document.querySelector('#crm [data-w295open]') || {}).getAttribute && document.querySelector('#crm [data-w295open]').getAttribute('aria-expanded'), n: document.querySelectorAll('#crm .w152row').length }));
  ok('the quick menus and search are as they were, with Filters beside them', b.q && b.sel.join('|') === 'Volunteer role|Activity|Email permission|Sort' && /Filters/.test(b.btn || '') && b.exp === 'false' && b.n === 4, b);
  await f.page.click('#crm [data-w295open]'); await wait(f, 500);
  b = await f.ev(() => ({ panel: !!document.getElementById('w295fb'), exp: document.querySelector('#crm [data-w295open]').getAttribute('aria-expanded'), focus: document.activeElement && document.activeElement.getAttribute('data-w295cf'),
    first: (document.querySelector('#w295fb [data-w295cf]') || {}).value, anim: document.getElementById('w295fb').classList.contains('w295in'),
    opts: [...document.querySelectorAll('#w295fb [data-w295cf="0.0"] option')].map(o => o.textContent), grp: (document.querySelector('#w295fb [data-w295cf="0.0"] optgroup') || {}).label }));
  ok('Filters opens the builder (aria-expanded true) with the focus on the first field, a Tag condition to start', b.panel && b.exp === 'true' && b.focus === '0.0' && b.first === 'tag', b);
  ok('a pointer opens it with a short ease-out entrance', b.anim, b);
  ok('the field picker names every field in plain words, custom fields grouped as Keela and profile fields', ['Contact type', 'Tag', 'Chapter', 'City', 'Volunteer role', 'Served at an event', 'Gave a gift', 'Email permission', 'Opened a Hub email', 'Clicked a Hub email', 'Came from', 'Added to the CRM', 'Last activity', 'Organisation', 'Job title', 'Email address', 'Phone number', 'Do not contact', 'Volunteer record needs a review', LONG_FIELD, 'First day', '16 or older', 'Volunteer positions'].every(x => b.opts.includes(x)) && b.grp === 'Keela and profile fields' && !b.opts.includes('Name, email or organization'), b);
  await wait(f, 400);
  b = await f.ev(() => ({ tags: [...document.querySelectorAll('#w295fb [data-w295tl="0.0"] .w295opt')].map(x => x.innerText.replace(/\s+/g, ' ').trim()), help: (document.querySelector('#w295fb .w295help') || {}).textContent, prev: (document.querySelector('#w295fb [data-w295prev]') || {}).textContent }));
  ok('the tag picker lists the Hub\'s tags with counts (Server and server as one), and says the empty condition is left out', b.tags.some(t => /^server 2$/.test(t)) && b.tags.some(t => t.startsWith(LONG_TAG)) && /Choose at least one/.test(b.help || '') && /everyone shows/.test(b.prev || ''), b);
  await setv(f, '#w295fb [data-w295tq="0.0"]', 'volunteer serv'); await wait(f, 200);
  b = await f.ev(() => ({ al: [...document.querySelectorAll('#w295fb .w295alias')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), focus: document.activeElement && document.activeElement.getAttribute('data-w295tq') }));
  ok('typing a Keela name shows the Hub tag it maps to ("volunteer server → server"), and the focus stays in the box', b.al.length === 1 && /volunteer server → is the tag server/.test(b.al[0]) && b.focus === '0.0', b);
  await click(f, '#w295fb .w295alias'); await wait(f, 700);
  b = await f.ev(() => ({ on: [...document.querySelectorAll('#w295fb [data-w295ck="0.0"]:checked')].map(x => x.value), prev: (document.querySelector('#w295fb [data-w295prev]') || {}).textContent, apply: (document.querySelector('#w295fb [data-w295apply]') || {}).textContent }));
  ok('choosing it ticks server; the live count and the button say how many', JSON.stringify(b.on) === '["server"]' && /2 people match/.test(b.prev || '') && b.apply === 'Show 2 people', b);
  let a = await lastCall(f, 'crm_filter_contacts');
  ok('one tag is sent as one value (the older shape)', a && JSON.stringify(a.p_filter.groups) === JSON.stringify([{ all: [{ f: 'tag', op: 'has', v: 'server' }] }]), a);
  /* a condition of each type */
  async function addCond(gi, field) { await click(f, '#w295fb [data-w295and="' + gi + '"]'); await wait(f, 150); const n = await f.ev(gi => document.querySelectorAll('#w295fb .w155g')[gi].querySelectorAll('.w155c').length, gi); await setv(f, '#w295fb [data-w295cf="' + gi + '.' + (n - 1) + '"]', field); await wait(f, 200); return gi + '.' + (n - 1); }
  let at = await addCond(0, 'kind');
  b = await f.ev(at => ({ focus: document.activeElement && document.activeElement.getAttribute('data-w295cf'), boxes: [...document.querySelectorAll('#w295fb [data-w295ck="' + at + '"]')].map(x => x.closest('label').innerText.replace(/\s+/g, ' ').trim()) }), at);
  ok('Add a condition, Contact type: option boxes with counts; the focus stays on the field picker', b.focus === at && b.boxes.includes('Volunteer 2') && b.boxes.includes('Partner contact 2'), b);
  await f.ev(at => document.querySelector('#w295fb [data-w295ck="' + at + '"][value="partner"]').focus(), at);
  await tick(f, '#w295fb [data-w295ck="' + at + '"][value="partner"]'); await wait(f, 600);
  b = await f.ev(at => ({ focus: document.activeElement && document.activeElement.getAttribute('data-w295ck') + ':' + document.activeElement.value }), at);
  ok('ticking a box keeps the focus on it after the builder is drawn again (Volunteer was ticked to start, as on the Lists page)', b.focus === at + ':partner', b);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('two types are sent as a list', a && JSON.stringify(a.p_filter.groups[0].all[1]) === JSON.stringify({ f: 'kind', op: 'is', v: ['volunteer', 'partner'] }), a);
  at = await addCond(0, 'chapter');
  b = await f.ev(at => ({ help: [...document.querySelectorAll('#w295fb .w155c')].pop().querySelector('.w295help') && [...document.querySelectorAll('#w295fb .w155c')].pop().querySelector('.w295help').textContent }), at);
  ok('Chapter Montreal says "No chapter: counted as Montreal."', b.help === 'No chapter: counted as Montreal.', b);
  await setv(f, '#w295fb [data-w295cv="' + at + '"]', 'toronto'); await wait(f, 600);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('chapter is sent', a && JSON.stringify(a.p_filter.groups[0].all[2]) === JSON.stringify({ f: 'chapter', op: 'is', v: 'toronto' }), a);
  b = await f.ev(() => (document.querySelector('#w295fb [data-w295prev]') || {}).textContent);
  ok('server, volunteer or partner, Toronto: 2 people (the stand-in engine agrees with the SQL tests)', /2 people match/.test(b || ''), b);
  for (const [fld, want] of [['dnc', { f: 'dnc', op: 'is' }], ['phone', { f: 'phone', op: 'has' }]]) {
    at = await addCond(0, fld); await wait(f, 500);
    a = await lastCall(f, 'crm_filter_contacts');
    ok(fld + ' has no value box and is sent as ' + JSON.stringify(want), a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify(want) && !(await f.ev(at => !!document.querySelector('#w295fb [data-w295cv="' + at + '"]'), at)), a);
    await click(f, '#w295fb [data-w295cx="' + at + '"]'); await wait(f, 300);
  }
  for (const [fld, text] of [['org', 'bakery'], ['job_title', 'cook']]) {
    at = await addCond(0, fld); await setv(f, '#w295fb [data-w295cv="' + at + '"]', text); await wait(f, 600);
    a = await lastCall(f, 'crm_filter_contacts');
    ok(fld + ' contains is sent', a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify({ f: fld, op: 'contains', v: text }), a);
    await click(f, '#w295fb [data-w295cx="' + at + '"]'); await wait(f, 300);
  }
  at = await addCond(0, 'field:rally_paper_team');
  b = await f.ev(at => ({ ops: [...document.querySelectorAll('#w295fb [data-w295co="' + at + '"] option')].map(o => o.textContent), boxes: [...document.querySelectorAll('#w295fb [data-w295ck="' + at + '"]')].map(x => x.value) }), at);
  ok('a choice field: is, is filled in, is empty; its options as boxes', b.ops.join('|') === 'is|is filled in|is empty' && b.boxes.join('|') === 'Quest|Logic & Trivia|Challengers (Live Physical Challenges)', b);
  await tick(f, '#w295fb [data-w295ck="' + at + '"][value="Quest"]'); await wait(f, 600);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('a field is sent with its key and a list of choices', a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify({ f: 'field', op: 'is', key: 'rally_paper_team', v: ['Quest'] }), a);
  await setv(f, '#w295fb [data-w295co="' + at + '"]', 'set'); await wait(f, 600);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('is filled in has no value', a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify({ f: 'field', op: 'set', key: 'rally_paper_team' }), a);
  await click(f, '#w295fb [data-w295cx="' + at + '"]'); await wait(f, 300);
  at = await addCond(0, 'field:first_day');
  b = await f.ev(at => ({ type: (document.querySelector('#w295fb [data-w295cv="' + at + '"]') || {}).type, ops: [...document.querySelectorAll('#w295fb [data-w295co="' + at + '"] option')].map(o => o.textContent) }), at);
  ok('a date field: a date box, is before, is after', b.type === 'date' && b.ops.join('|') === 'is before|is after|is filled in|is empty', b);
  await setv(f, '#w295fb [data-w295cv="' + at + '"]', '2026-01-01'); await wait(f, 600);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('the date is sent', a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify({ f: 'field', op: 'before', key: 'first_day', v: '2026-01-01' }), a);
  await click(f, '#w295fb [data-w295cx="' + at + '"]'); await wait(f, 300);
  at = await addCond(0, 'field:age_16_plus'); await wait(f, 600);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('a yes/no field starts at yes', a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify({ f: 'field', op: 'is', key: 'age_16_plus', v: 'yes' }), a);
  await click(f, '#w295fb [data-w295cx="' + at + '"]'); await wait(f, 300);
  at = await addCond(0, 'served'); await setv(f, '#w295fb [data-w295co="' + at + '"]', 'count_gte'); await wait(f, 600);
  a = await lastCall(f, 'crm_filter_contacts');
  ok('an older condition works as on the Lists page (served at least 3 times)', a && JSON.stringify(a.p_filter.groups[0].all.slice(-1)[0]) === JSON.stringify({ f: 'served', op: 'count_gte', v: '3' }), a);
  await click(f, '#w295fb [data-w295cx="' + at + '"]'); await wait(f, 300);
  /* groups */
  await click(f, '#w295fb [data-w295or]'); await wait(f, 300);
  await tick(f, '#w295fb [data-w295ck="1.0"][value="donor"]'); await wait(f, 700);
  a = await lastCall(f, 'crm_filter_contacts');
  b = await f.ev(() => ({ groups: document.querySelectorAll('#w295fb .w155g').length, or: !!document.querySelector('#w295fb .w155or'), prev: (document.querySelector('#w295fb [data-w295prev]') || {}).textContent }));
  ok('Or another group: two groups, sent as two', b.groups === 2 && b.or && a && a.p_filter.groups.length === 2 && JSON.stringify(a.p_filter.groups[1]) === JSON.stringify({ all: [{ f: 'tag', op: 'has', v: 'donor' }] }) && /3 people match/.test(b.prev || ''), { b, a });
  await shot(f, 'builder-1366');
  await f.page.click('#w295fb [data-w295apply]'); await wait(f, 500);
  b = await f.ev(() => ({ panel: !!document.getElementById('w295fb'), rows: [...document.querySelectorAll('#crm .w152row .nm')].map(x => x.textContent), count: document.querySelector('#crm .w152count').textContent, chips: [...document.querySelectorAll('#crm .w295chip .w295cw')].map(x => x.textContent), ors: document.querySelectorAll('#crm .w295orc').length, hash: location.hash, focus: document.activeElement && document.activeElement.hasAttribute('data-w295open'), badge: (document.querySelector('#crm [data-w295open] em') || {}).textContent }));
  ok('Show 3 people narrows the list without asking again, closes the builder and says "3 people match"', !b.panel && b.rows.length === 3 && /^3 people match/.test(b.count) && b.focus, b);
  ok('the conditions show as chips, groups split by "or", and the button counts them', JSON.stringify(b.chips) === JSON.stringify(['Tag has server', 'Contact type is Volunteer or Partner contact', 'Chapter is Toronto', 'Tag has donor']) && b.ors === 1 && b.badge === '4', b);
  ok('the filter is in the address', /^#crm\/f\/[A-Za-z0-9_-]+$/.test(b.hash), b.hash);
  const hash = b.hash;
  await shot(f, 'chips-1366');
  /* a chip removes its condition */
  const nCalls = await f.ev(() => window.__w295.calls.length);
  await f.page.click('#crm [data-w295rm="0.2"]'); await wait(f, 500);
  b = await f.ev(() => ({ chips: [...document.querySelectorAll('#crm .w295chip .w295cw')].map(x => x.textContent), rows: document.querySelectorAll('#crm .w152row').length, focus: document.activeElement && document.activeElement.getAttribute('data-w295rm'), calls: window.__w295.calls.length }));
  ok('a chip\'s × removes that condition, asks the database again, and the focus moves to the next chip', b.chips.length === 3 && !b.chips.includes('Chapter is Toronto') && b.calls === nCalls + 1 && b.focus === '1.0' && b.rows === 3, b);
  /* Escape */
  await f.page.click('#crm [data-w295edit]'); await wait(f, 300);
  b = await f.ev(() => ({ panel: !!document.getElementById('w295fb'), conds: document.querySelectorAll('#w295fb .w155c').length }));
  ok('Change reopens the builder with the conditions in use', b.panel && b.conds === 3, b);
  await f.page.keyboard.press('Escape'); await wait(f, 200);
  b = await f.ev(() => ({ panel: !!document.getElementById('w295fb'), focus: document.activeElement && document.activeElement.hasAttribute('data-w295open') }));
  ok('Escape closes the builder and puts the focus back on Filters', !b.panel && b.focus, b);
  /* keyboard: Filters by Enter, no entrance animation for the keyboard */
  await f.ev(() => document.querySelector('#crm [data-w295open]').focus()); await f.page.keyboard.press('Enter'); await wait(f, 300);
  b = await f.ev(() => ({ panel: !!document.getElementById('w295fb'), anim: document.getElementById('w295fb') && document.getElementById('w295fb').classList.contains('w295in'), focus: document.activeElement && document.activeElement.getAttribute('data-w295cf') }));
  ok('Enter on Filters opens the builder with no animation and the focus inside', b.panel && !b.anim && b.focus === '0.0', b);
  /* open a saved live list from the builder */
  await setv(f, '#w295fb [data-w295list]', '31'); await wait(f, 600);
  b = await f.ev(() => ({ conds: [...document.querySelectorAll('#w295fb .w155c')].length, chips: [...document.querySelectorAll('#crm .w295chip .w295cw')].map(x => x.textContent), msg: (document.querySelector('#crm .w295msg') || {}).textContent, rows: [...document.querySelectorAll('#crm .w152row .nm')].map(x => x.textContent), opts: [...document.querySelectorAll('#w295fb [data-w295list] option')].map(o => o.textContent) }));
  ok('Open a saved list loads a live list\'s conditions and shows its people (a list without groups is not offered)', b.conds === 2 && JSON.stringify(b.chips) === JSON.stringify(['Chapter is Toronto', 'Tag has server']) && b.rows.length === 2 && /is open as a view/.test(b.msg || '') && !b.opts.includes('Old flat list'), b);
  /* Save as a list */
  await click(f, '#w295fb [data-w295save]'); await wait(f, 1600);
  b = await f.ev(() => ({ hash: location.hash, focus: document.activeElement && document.activeElement.getAttribute('data-w155f'), lc: window.w155.lc().edit && JSON.stringify(window.w155.lc().edit.groups), conds: document.querySelectorAll('#crm .w155b .w155c').length, desc: (document.querySelector('#crm [data-w155f="description"]') || {}).value }));
  ok('Save as a list opens the Lists page\'s builder with these conditions and the name box focused', b.hash === '#crm/lists' && b.focus === 'name' && b.lc === JSON.stringify([{ all: [{ f: 'chapter', op: 'is', v: 'toronto' }, { f: 'tag', op: 'has', v: 'server' }] }]) && b.conds === 2 && b.desc === 'From the Contacts filters', b);
  b = await f.ev(() => ({ tp: !!document.querySelector('#crm .w155b [data-w155tq]'), ch: !!document.querySelector('#crm .w155b [data-w155cv="0.0"]') }));
  ok('the Lists builder has the same new controls (tag picker, chapter)', b.tp && b.ch, b);
  /* View in Contacts from the Lists page */
  await click(f, '[data-w155cancel]'); await wait(f, 300);
  b = await f.ev(() => [...document.querySelectorAll('#crm [data-w295view]')].map(x => x.getAttribute('data-w295view')));
  ok('the Lists page offers View in Contacts for a live list with conditions only', JSON.stringify(b) === '["31"]', b);
  await click(f, '#crm [data-w295view="31"]'); await wait(f, 1500);
  b = await f.ev(() => ({ hash: location.hash, rows: document.querySelectorAll('#crm .w152row').length, chips: document.querySelectorAll('#crm .w295chip').length }));
  ok('View in Contacts shows the list\'s people on the Contacts page, with its chips and its address', /^#crm\/f\//.test(b.hash) && b.rows === 2 && b.chips === 2, b);
  /* Clear filters */
  await click(f, '#crm [data-w295clear]'); await wait(f, 400);
  b = await f.ev(() => ({ hash: location.hash, rows: document.querySelectorAll('#crm .w152row').length, chips: document.querySelectorAll('#crm .w295chip').length, badge: !!document.querySelector('#crm [data-w295open] em') }));
  ok('Clear filters shows everyone and takes the filter out of the address', b.hash === '#crm' && b.rows === 4 && !b.chips && !b.badge, b);
  /* the quick menus still narrow, together with a filter */
  await f.ev(h => { location.hash = h; }, hash); await wait(f, 900);
  await setv(f, '#crm [data-w152q]', 'ada'); await wait(f, 500);
  b = await f.ev(() => ({ rows: [...document.querySelectorAll('#crm .w152row .nm')].map(x => x.textContent), count: document.querySelector('#crm .w152count').textContent }));
  ok('search narrows inside the filter (the two together)', JSON.stringify(b.rows) === '["Ada Testfilter"]' && /^1 person matches/.test(b.count), b);
  await f.ev(() => { const s = document.querySelector('#crm [data-w152q]'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(f, 400);
  /* empty, then an error */
  await f.ev(() => { location.hash = '#crm/f/' + btoa(JSON.stringify([{ all: [{ f: 'job_title', op: 'contains', v: 'astronaut' }] }])).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }); await wait(f, 900);
  b = await f.ev(() => ({ empty: (document.querySelector('#crm .w152empty') || {}).textContent, chips: document.querySelectorAll('#crm .w295chip').length }));
  ok('nobody: "No one matches. Remove a condition", with the chip still there', /^No one matches\. Remove a condition/.test(b.empty || '') && b.chips === 1, b);
  await f.ev(() => { window.__w295.fail = 'permission denied for function crm_filter_contacts'; });
  await f.page.click('#crm [data-w295edit]'); await wait(f, 300);
  await setv(f, '#w295fb [data-w295cv="0.0"]', 'cook'); await wait(f, 700);
  b = await f.ev(() => (document.querySelector('#w295fb [data-w295prev]') || {}).textContent);
  ok('an error in the count says so in plain words', /The count did not come back: you do not have the right to filter the contacts/.test(b || ''), b);
  await f.page.click('#w295fb [data-w295apply]'); await wait(f, 500);
  b = await f.ev(() => ({ err: (document.querySelector('#crm .w295err') || {}).textContent, chips: [...document.querySelectorAll('#crm .w295chip .w295cw')].map(x => x.textContent), empty: !!document.querySelector('#crm .w152empty') }));
  ok('an error on Show leaves the list and the filter as they were, and says why', /The filter did not run: you do not have the right to filter the contacts\. The list has not changed\./.test(b.err || '') && JSON.stringify(b.chips) === '["Job title contains astronaut"]' && b.empty, b);
  await f.ev(() => { window.__w295.fail = null; });
  ok('desktop: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- reload with the filter in the address: no flash of everyone ---------------- */
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fixture(), rpcs: RPCS, wait: 3200 });
  await f.ev(ENGINE); await f.ev(() => { window.__w295.delay = 900; });
  await f.ev(h => { location.hash = h; }, hash); await wait(f, 400);
  b = await f.ev(() => ({ rows: document.querySelectorAll('#crm .w152row').length, count: (document.querySelector('#crm .w152count') || {}).textContent, chips: document.querySelectorAll('#crm .w295chip').length }));
  ok('a shared link: while the database answers, the list waits ("Finding who matches…") and the chips show', b.rows === 0 && /Finding who matches/.test(b.count || '') && b.chips === 4, b);
  await wait(f, 1300);
  b = await f.ev(() => ({ rows: document.querySelectorAll('#crm .w152row').length, count: document.querySelector('#crm .w152count').textContent }));
  ok('then the people who match', b.rows === 3 && /^3 people match/.test(b.count), b);
  await f.ev(() => { location.hash = '#crm/f/not-a-filter'; }); await wait(f, 600);
  b = await f.ev(() => (document.querySelector('#crm .w295err') || {}).textContent);
  ok('a link whose filter cannot be read says so and keeps the list', /could not be read/.test(b || ''), b);
  ok('reload: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- 1,000 people, phones, 200% zoom ---------------- */
  for (const [w, h, zoom] of [[1366, 900, false], [390, 844, false], [320, 640, false], [683, 450, true]]) {
    const tag = zoom ? 'zoom200' : String(w);
    const ctxOpts = zoom ? { w, h } : { w, h };
    f = await boot(browser, { set: 'huge', w: ctxOpts.w, h: ctxOpts.h });
    await f.ev(h => { location.hash = h; }, '#crm/f/' + Buffer.from(JSON.stringify([{ all: [{ f: 'tag', op: 'has', v: ['server', LONG_TAG] }, { f: 'kind', op: 'is', v: ['volunteer', 'partner', 'donor', 'supporter'] }] }, { all: [{ f: 'field', key: 'rally_paper_team', op: 'is', v: ['Quest', 'Challengers (Live Physical Challenges)'] }] }])).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')); await wait(f, 1200);
    b = await f.ev(() => ({ count: document.querySelector('#crm .w152count').textContent, rows: document.querySelectorAll('#crm .w152row').length }));
    ok(tag + ': 1,003 people: the count with a thousands comma, the first 60 shown', /^1,003 people match/.test(b.count) && /showing the first 60/.test(b.count) && b.rows === 60, b);
    await fits(f, tag + ' chips with long labels');
    await f.page.click('#crm [data-w295open]'); await wait(f, 900);
    await fits(f, tag + ' builder open with a long field label and a long tag');
    b = await f.ev(() => { const r = document.getElementById('w295fb').getBoundingClientRect(); const sel = [...document.querySelectorAll('#w295fb select')].map(s => s.getBoundingClientRect().right); return { right: Math.round(r.right), iw: innerWidth, sel: Math.round(Math.max.apply(null, sel)) }; });
    ok(tag + ': the builder and its pickers stay inside the screen', b.right <= b.iw && b.sel <= b.iw, b);
    await shot(f, 'builder-huge-' + tag);
    await f.page.keyboard.press('Escape'); await wait(f, 200);
    await shot(f, 'chips-huge-' + tag);
    ok(tag + ': no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* one result */
  f = await boot(browser);
  await f.ev(() => { location.hash = '#crm/f/' + btoa(JSON.stringify([{ all: [{ f: 'dnc', op: 'is' }] }])).replace(/=+$/, ''); }); await wait(f, 900);
  b = await f.ev(() => ({ count: document.querySelector('#crm .w152count').textContent, rows: [...document.querySelectorAll('#crm .w152row .nm')].map(x => x.textContent) }));
  ok('one result: "1 person matches"', /^1 person matches/.test(b.count) && JSON.stringify(b.rows) === '["Bo Testfilter"]', b);
  await f.close();
}

(async () => {
  const browser = await launch();
  const nc = browser.newContext.bind(browser);
  browser.newContext = o => nc(Object.assign({}, o, o && o.viewport && o.viewport.width === 683 ? { isMobile: false, hasTouch: false, deviceScaleFactor: 2 } : {}));
  try { await main(browser); } catch (e) { fail++; out.push('FAIL crashed: ' + String(e && e.stack || e).slice(0, 600)); }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw295drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
