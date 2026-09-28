/* w158drive.js: gifts by hand and the receipt foundation (wave158a). Fixture rows are made up for the test (no real
   people); every write and RPC is recorded on the page (the stub echoes it and never changes the fixture).
   The Gifts tab: each gift with its kind, how it came and its receipt status in words; Record a gift and Receipts in the
   bar. Record a gift: the donor from the list, a registration with what the person received (the eligible amount and
   the 80% rule in words as it is typed), the checks, the insert. A Keela gift opens with its amount, date and donor
   fixed and saves only what the Hub adds. A sample receipt with every CRA field, what is missing and the SAMPLE mark.
   Receipts: the settings (saved through the admin RPC), the receipts due for the tax year by donor, a missing address
   flagged. A contact's page records a gift for them. On a phone nothing overflows. usage: node test/w158drive.js */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: true }); }
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['supporter'], tags: [], source: 'keela', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
const G = (id, contact_id, amount, date, o) => Object.assign({ id, contact_id, amount, currency: 'CAD', donated_at: date + 'T15:00:00Z', platform: 'hub', campaign: null, designation: null, recurring: false, receipt_number: null, receipt_issued_at: null, receipt_url: null,
  receipt_source: null, receipt_eligible: true, external_id: null, notes: null, kind: 'donation', method: 'cheque', advantage_amount: 0, advantage_desc: null, in_kind_desc: null, appraiser: null, tribute_kind: null, tribute_name: null, created_by: 'steel.macdonald@welfareavenue.com', updated_by: null }, o || {});
const R = (gift_id, contact_id, amount, adv, status, note, o) => Object.assign({ gift_id, contact_id, amount, advantage_amount: adv, eligible_amount: Math.max(0, amount - adv), tax_year: 2026, kind: 'donation', platform: 'hub', receipt_number: null, receipt_status: status, receipt_note: note }, o || {});
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', kinds: ['donor'], address: '12 rue Test', city: 'Montreal', province: 'QC', postal_code: 'H2X 1Y4' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com' }),
    C(5003, 'Steel MacDonald', { emails: ['steel.macdonald@welfareavenue.com'], primary_email: 'steel.macdonald@welfareavenue.com', kinds: ['staff'] })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_interactions = [];
  fx.crm_donations = [
    G(61, 5001, 156.75, '2026-09-10', { platform: 'keela', method: null, created_by: 'wa152_import', receipt_number: 'KEE-2026-29', receipt_issued_at: '2026-09-10T16:00:00Z', receipt_source: 'keela', campaign: 'fundraising campaign' }),
    G(62, 5001, 100, '2026-09-20', { campaign: 'Sunday meals', notes: 'Cheque 204' }),
    G(63, 5002, 50, '2026-08-09', { kind: 'registration', method: 'card', advantage_amount: 30, advantage_desc: 'Playing in the tournament', campaign: 'Flag football' }),
    G(64, 5002, 500, '2026-07-01', { kind: 'sponsorship', method: 'etransfer', campaign: 'Rally Paper' }),
    G(65, 5001, 25, '2026-06-15', { kind: 'donation', tribute_kind: 'memory', tribute_name: 'Rose Okafor' })
  ];
  fx.crm_gift_receipts_v = [
    R(61, 5001, 156.75, 0, 'receipted', 'Receipt KEE-2026-29 (keela)', { platform: 'keela', receipt_number: 'KEE-2026-29' }),
    R(62, 5001, 100, 0, 'due', 'A receipt is due for $100.00'),
    R(63, 5002, 50, 30, 'due', 'A receipt is due for $20.00', { kind: 'registration' }),
    R(64, 5002, 500, 0, 'no', 'A sponsorship gets an invoice or a thank-you, not a tax receipt', { kind: 'sponsorship' }),
    R(65, 5001, 25, 0, 'due', 'A receipt is due for $25.00')
  ];
  fx.crm_automation_runs = []; fx.crm_automations = []; fx.crm_contact_fields = []; fx.crm_fields = [];
  return fx;
}
const CFG = { receipt_mode: 'off', receipt_charity_name: 'Welfare Avenue', receipt_charity_address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', receipt_location: 'Montreal, Quebec', receipt_prefix: '', receipt_next_number: '', receipt_signatory_name: '', receipt_signatory_title: '', mail_charity_number: '713048502RR0001', is_admin: true };
const SAMPLE = { sample: true, status: 'due', note: 'A receipt is due for $20.00', warnings: ['The donor has no address on file: a receipt needs one.', 'No signatory yet (the treasurer or another person the board authorizes).'], serial: 'WA-2026-0001',
  charity_name: 'Welfare Avenue', charity_address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', charity_number: '713048502RR0001', location: 'Montreal, Quebec', gift_date: '9 August 2026', issued_date: '25 September 2026',
  donor_name: 'Élodie Gagnon', donor_address: null, amount: 50, advantage_amount: 30, advantage_desc: 'Playing in the tournament', eligible_amount: 20, kind: 'registration', signatory_name: null, signatory_title: null, cra: 'Canada Revenue Agency: canada.ca/charities-giving', mode: 'off' };
const patch = f => f.ev(([cfg, sample]) => {
  window.__ins = []; window.__rpc = [];
  const rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    if (fn === 'crm_receipt_config') return Promise.resolve({ data: Object.assign({}, cfg), error: null });
    if (fn === 'crm_receipt_config_set') return Promise.resolve({ data: Object.assign({}, cfg, args.p), error: null });
    if (fn === 'crm_receipt_sample') return Promise.resolve({ data: sample, error: null });
    return rpc0(fn, args);
  };
  const from0 = db.from.bind(db);
  db.from = function (t) {
    const q = from0(t); const ins = q.insert, up = q.update, del = q.delete;
    q.insert = function (p) { window.__ins.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); if (p && !Array.isArray(p) && t === 'crm_donations') p = Object.assign({ id: 900 + window.__ins.length }, p); return ins.call(this, p); };
    q.update = function (p) { window.__ins.push({ t: t, op: 'update', p: JSON.parse(JSON.stringify(p)) }); return up.call(this, p); };
    q.delete = function () { window.__ins.push({ t: t, op: 'delete' }); return del.call(this); };
    return q;
  };
  return true;
}, [CFG, SAMPLE]);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/gifts', 2400);
  let b = await f.ev(() => ({ rows: [...document.querySelectorAll('#crm .w158row')].map(r => r.innerText.replace(/\s+/g, ' ')), bar: !!document.querySelector('#crm [data-w158new="1"]') && !!document.querySelector('#crm [data-w152go="#crm/gifts/receipts"]') }));
  const row = n => b.rows.filter(r => r.indexOf(n) >= 0);
  ok('the bar offers Record a gift and Receipts', b.bar, b);
  ok('each gift says its receipt status in words: Keela’s receipt, due for the eligible amount, none for a sponsorship', b.rows.length === 5 && /Receipt KEE-2026-29/.test(row('$156.75')[0] || '') && /Receipt due/i.test(row('$100 ')[0] || '') && /for \$100\.00/.test(row('$100 ')[0] || '') &&
    /Registration/i.test(row('$50 ')[0] || '') && /for \$20\.00/.test(row('$50 ')[0] || '') && /Sponsorship/i.test(row('$500 ')[0] || '') && /No receipt/i.test(row('$500 ')[0] || '') && /invoice or a thank-you/.test(row('$500 ')[0] || ''), b.rows);
  ok('a tribute and how it came show on the row', /In memory of Rose Okafor/.test(row('$25 ')[0] || '') && /Cheque/.test(row('$100 ')[0] || '') && /E-transfer/.test(row('$500 ')[0] || ''), b.rows);
  await shot(f, 'gifts_list');

  /* record a gift */
  await click(f, '#crm [data-w158new="1"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ title: (document.querySelector('#w152sheet h2') || {}).textContent, list: document.querySelectorAll('#w158donors option').length, adv: document.querySelector('#w152sheet .w158adv').hidden, rule: (document.querySelector('#w152sheet [data-w158rule]') || {}).textContent }));
  ok('Record a gift opens the form with the donors to pick from', b.title === 'Record a gift' && b.list === 3 && b.adv === true && /Pick the donor/.test(b.rule), b);
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => (document.querySelector('#w152sheet [data-w152err]') || {}).textContent);
  ok('it will not save without a donor', /Pick the donor/.test(b || ''), b);
  await setv(f, '#w152sheet [data-f="donor"]', 'Élodie Gagnon · elodie.gagnon@example.com (#5002)');
  await setv(f, '#w152sheet [data-f="amount"]', '50');
  await setv(f, '#w152sheet [data-f="kind"]', 'registration'); await f.page.waitForTimeout(200);
  await setv(f, '#w152sheet [data-f="advantage_amount"]', '45');
  b = await f.ev(() => ({ adv: document.querySelector('#w152sheet .w158adv').hidden, rule: document.querySelector('#w152sheet [data-w158rule]').textContent }));
  ok('a registration asks what they received, and says when it is worth more than 80%', b.adv === false && /more than 80%/.test(b.rule), b);
  await setv(f, '#w152sheet [data-f="advantage_amount"]', '30');
  await setv(f, '#w152sheet [data-f="advantage_desc"]', 'Playing in the tournament');
  await setv(f, '#w152sheet [data-f="campaign"]', 'Flag football');
  await setv(f, '#w152sheet [data-f="tribute_kind"]', 'honour');
  b = await f.ev(() => document.querySelector('#w152sheet [data-w158rule]').textContent);
  ok('the eligible amount follows as it is typed', /A receipt is due for \$20\.00/.test(b), b);
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => (document.querySelector('#w152sheet [data-w152err]') || {}).textContent);
  ok('a tribute needs a name', /honour or memory/.test(b || ''), b);
  await setv(f, '#w152sheet [data-f="tribute_name"]', 'Coach Dan');
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(1400);
  b = await f.ev(() => ({ ins: window.__ins.filter(x => x.t === 'crm_donations' && x.op === 'insert'), open: !!document.querySelector('#w152sheet .sh'), msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  const gi = b.ins[0] && b.ins[0].p;
  ok('the gift is recorded in the Hub with its kind, advantage and tribute', gi && gi.contact_id === 5002 && gi.platform === 'hub' && gi.amount === 50 && gi.kind === 'registration' && gi.advantage_amount === 30 && gi.advantage_desc === 'Playing in the tournament' &&
    gi.tribute_kind === 'honour' && gi.tribute_name === 'Coach Dan' && /^2026-09-25T12:00:00/.test(gi.donated_at) && gi.currency === 'CAD' && gi.created_by === 'steel.macdonald@welfareavenue.com', gi);
  ok('the sheet closes and the page says so', !b.open && /Recorded: \$50\.00 from Élodie Gagnon/.test(b.msg || ''), b);

  /* a Keela gift: only what the Hub adds */
  await click(f, '#crm [data-w158open="61"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ amt: document.querySelector('#w152sheet [data-f="amount"]').disabled, date: document.querySelector('#w152sheet [data-f="donated_at"]').disabled, sub: document.querySelector('#w152sheet .sub').textContent, donor: (document.querySelector('#w152sheet .w158donor') || {}).innerText || '' }));
  ok('a Keela gift keeps its amount, date and donor', b.amt && b.date && /From Keela/.test(b.sub) && /Amara Okafor/.test(b.donor), b);
  await setv(f, '#w152sheet [data-f="notes"]', 'Thanked by phone');
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(1200);
  b = await f.ev(() => window.__ins.filter(x => x.t === 'crm_donations' && x.op === 'update').slice(-1)[0]);
  ok('saving it sends only what the Hub adds (no amount, date or donor)', b && b.p.notes === 'Thanked by phone' && b.p.amount === undefined && b.p.donated_at === undefined && b.p.contact_id === undefined, b);

  /* a sample receipt */
  await click(f, '#crm [data-w158open="63"]'); await f.page.waitForTimeout(500);
  await click(f, '#w152sheet [data-w158sample="63"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_sample'), t: (document.querySelector('#w152sheet') || {}).innerText || '', wm: !!document.querySelector('#w152sheet .w158wm'), miss: [...document.querySelectorAll('#w152sheet .w158miss')].map(x => x.textContent) }));
  ok('a sample receipt carries every CRA field', b.rpc.length === 1 && b.rpc[0].args.p_gift_id === 63 && /Official receipt for income tax purposes/i.test(b.t) && /713048502RR0001/.test(b.t) && /WA-2026-0001 \(sample\)/.test(b.t) &&
    /Montreal, Quebec/.test(b.t) && /9 August 2026/.test(b.t) && /\$50\.00/.test(b.t) && /\$30\.00 \(Playing in the tournament\)/.test(b.t) && /\$20\.00/.test(b.t) && /canada\.ca\/charities-giving/.test(b.t), b.t.slice(0, 900));
  ok('it says what is missing and is marked SAMPLE', b.wm && /no address on file/.test(b.t) && /No signatory yet/.test(b.t) && b.miss.length === 1, b.miss);
  await shot(f, 'gift_sample');
  await click(f, '#w152sheet [data-w152close]'); await f.page.waitForTimeout(300);

  /* receipts: settings and the year */
  await f.hash('#crm/gifts/receipts', 1600);
  b = await f.ev(() => ({ inputs: [...document.querySelectorAll('#crm [data-w158cfg]')].map(x => x.getAttribute('data-w158cfg') + (x.disabled ? ':ro' : '')), t: (document.querySelector('#crm .w155grid') || {}).innerText || '',
    donors: [...document.querySelectorAll('#crm .w156fr')].map(x => x.innerText.replace(/\s+/g, ' ')) }));
  ok('Receipts shows the settings an admin can change and says receipts are off', b.inputs.length === 7 && b.inputs.every(x => !/:ro$/.test(x)) && /Receipts from the Hub are off/.test(b.t) && /713048502RR0001/.test(b.t), b.inputs);
  ok('the receipts due for the tax year, by donor, with a missing address flagged', /Receipts due for 2026/i.test(b.t) && b.donors.length === 2 && /Amara Okafor · 2 gifts/.test(b.donors[0]) && /\$125\.00/.test(b.donors[0]) && /Élodie Gagnon · 1 gift · no address on file/.test(b.donors[1]) && /\$145\.00/.test(b.t) && /1\s*already receipted/.test(b.t), b);
  await setv(f, '#crm [data-w158cfg="receipt_signatory_name"]', 'Daniela Test');
  await setv(f, '#crm [data-w158cfg="receipt_prefix"]', 'WA-2026-');
  await click(f, '#crm [data-w158cfgsave]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ rpc: window.__rpc.filter(x => x.fn === 'crm_receipt_config_set').slice(-1)[0], msg: (document.querySelector('#crm .w154msg') || {}).innerText }));
  ok('Save the settings goes through the admin RPC with every field', b.rpc && b.rpc.args.p.receipt_signatory_name === 'Daniela Test' && b.rpc.args.p.receipt_prefix === 'WA-2026-' && Object.keys(b.rpc.args.p).length === 7 && /Saved/.test(b.msg || ''), b);
  await shot(f, 'gift_receipts');

  /* a contact's page */
  await f.hash('#crm/c/5001', 1600);
  await click(f, '[data-w158new="5001"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => ({ donor: (document.querySelector('#w152sheet .w158donor') || {}).innerText || '', input: !!document.querySelector('#w152sheet [data-f="donor"]') }));
  ok('a contact’s page records a gift for them', /Amara Okafor/.test(b.donor) && !b.input, b);
  await setv(f, '#w152sheet [data-f="amount"]', '40');
  await click(f, '#w152sheet [data-w158save]'); await f.page.waitForTimeout(1200);
  b = await f.ev(() => window.__ins.filter(x => x.t === 'crm_donations' && x.op === 'insert').slice(-1)[0]);
  ok('saved for that contact', b && b.p.contact_id === 5001 && b.p.amount === 40 && b.p.kind === 'donation', b && b.p);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* phone */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/gifts/receipts', 2400);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, set: document.querySelectorAll('#crm [data-w158cfg]').length }));
  ok('phone: Receipts does not scroll sideways', b.set === 7 && b.sw <= b.w + 1, b);
  await f.hash('#crm/gifts', 1400);
  await click(f, '#crm [data-w158new="1"]'); await f.page.waitForTimeout(500);
  b = await f.ev(() => { const sh = document.querySelector('#w152sheet .sh'); return { sw: sh ? sh.scrollWidth : 0, w: sh ? sh.clientWidth : 0, doc: document.documentElement.scrollWidth, iw: innerWidth }; });
  ok('phone: the gift form fits', b.sw <= b.w + 1 && b.doc <= b.iw + 1, b);
  await shot(f, 'phone_gift_form');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw158drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
