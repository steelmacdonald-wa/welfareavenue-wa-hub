/* w292drive.js: the email history on the Import page (wave292). Fixture rows are made up for the test (test/w292fx.js; no real people); crm-import
   and mail-history are answered by window.__WA_INVOKE and every call is recorded.
   - An email-history run shows the Scan card (per mailbox: phase, counts, set-aside reasons, oldest email; estimate, spend and cap) instead of the
     files card, and the five mail cards in order, with the email-history counts in their sentences.
   - Order: a card whose cards above are not all applied says so and offers no Compare; an applied card with an applied card below offers no Undo;
     mail_optouts is never undone.
   - Start reading (a waiting run) opens a centred confirmation that repeats the estimate and the cap, Cancel first; yes calls mail-history go.
   - Look at them calls mail-history people and draws the people (name, address, type, match), says how many only Steel sees, and Leave out calls
     exclude and asks a compared card for a new compare.
   - Delete created and untouched (an undone mail_people card) names the count in its confirmation and calls crm-import delete_created.
   - New run offers Keela and the email history; the email history starts through mail-history start. Purge says Undo ends with it.
   - The segment 152 names the email_history source. No page errors; at phone width nothing scrolls sideways.
   usage: node test/w292drive.js */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
const { fx292, INVOKE } = require('./w292fx');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const MAIL = ['mail_optouts', 'mail_orgs', 'mail_people', 'mail_enrich', 'mail_interactions'];
const RPCS = { wa_org_editor: true, crm_age_band: null, wa_my_caps: { gifts_edit: true, import_admin: true, hr_private: true } };
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const pick = (f, v) => f.ev(v => { const s = document.querySelector('#w284root [data-w284run]'); s.value = String(v); s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const card = (f, k) => f.ev(k => { const c = document.querySelector('#w284root [data-w284card="' + k + '"]'); return c ? { txt: c.innerText, btns: [...c.querySelectorAll('.w284acts button')].map(b => b.innerText.trim()) } : null; }, k);

(async () => {
  const seg = fs.readFileSync(path.join(__dirname, '../build/src/152_wave152.seg'), 'utf8');
  ok('segment 152 names the email_history source', /email_history: \['Email history', 'People who wrote to Steel or info@ since April 2020 \(wave292\)\.'\]/.test(seg));

  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fx292(), rpcs: RPCS, init: INVOKE, wait: 4000 });
  await f.hash('#crm/settings/imports', 2600);

  /* ---------------- run 10: undone people, Delete created ---------------- */
  let b = await f.ev(() => ({ line: (document.querySelector('#w284root .w284runline') || {}).innerText || '', scan: !!document.querySelector('#w284root [data-w284b="scan"]'),
    files: !!document.querySelector('#w284root .w284filescard'), cards: [...document.querySelectorAll('#w284root [data-w284card]')].map(c => c.getAttribute('data-w284card')),
    scanTxt: (document.querySelector('#w284root [data-w284b="scan"]') || {}).innerText || '' }));
  ok('an email-history run says so in its line', /^Run 10 \(email history\): 2 of 5 applied, 1 undone$/.test(b.line), b.line);
  ok('it shows the Scan card instead of the files card', b.scan && !b.files, b);
  ok('the five mail cards, in order', JSON.stringify(b.cards) === JSON.stringify(MAIL), b.cards);
  ok('the Scan card: each mailbox with its phase, counts, reasons and oldest email; the money', /Steel's mailbox/.test(b.scanTxt) && /hub@ \(info@ arrives here\)/.test(b.scanTxt)
     && /1,200 emails listed; 300 kept; 120 threads read\./.test(b.scanTxt) && /Set aside: automated 500, list|Set aside: automated 500, mailing lists 200/.test(b.scanTxt)
     && /Oldest email: 2020-04-02/.test(b.scanTxt) && /Estimate \$4\.00\. Spent \$2\.30 of a \$3\.00 cap\./.test(b.scanTxt), b.scanTxt);
  b = await card(f, 'mail_people');
  ok('the undone people card offers Delete created and untouched, and says how many were tagged', b && b.btns.includes('Delete created and untouched') && /2 new contacts tagged email history: review/.test(b.txt), b);
  b = await card(f, 'mail_optouts');
  ok('mail_optouts is never undone', b && b.btns.length === 0 && /Opt-outs are never undone/.test(b.txt) && /Suppression list: 4 added, 3 contacts stopped\./.test(b.txt), b);
  b = await card(f, 'mail_orgs');
  ok('an applied card offers Undo when nothing below is applied', b && JSON.stringify(b.btns) === '["Undo"]', b);
  await click(f, '#w284root [data-w284mdel]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => { const box = document.querySelector('#w284mpop [role="dialog"]'); const rc = box && box.getBoundingClientRect();
    return { txt: box ? box.innerText : '', focus: document.activeElement && document.activeElement.hasAttribute('data-w284mno'),
      centred: rc ? Math.abs((rc.left + rc.width / 2) - innerWidth / 2) < 4 && Math.abs((rc.top + rc.height / 2) - innerHeight / 2) < 40 : false }; });
  ok('Delete created opens a centred confirmation naming the count, Cancel first', /Delete created and untouched\?/.test(b.txt) && /up to 2 contacts/.test(b.txt) && /cannot be undone/.test(b.txt) && b.focus && b.centred, b);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  ok('Escape closes it and deletes nothing', !(await f.ev(() => !!document.getElementById('w284mpop'))) && !(await f.ev(() => window.__calls.some(c => c.body.action === 'delete_created'))));
  await click(f, '#w284root [data-w284mdel]'); await f.page.waitForTimeout(300);
  await click(f, '#w284mpop [data-w284myes]'); await f.page.waitForTimeout(800);
  b = await f.ev(() => window.__calls.filter(c => c.body.action === 'delete_created').map(c => ({ n: c.name, b: c.body })));
  ok('yes calls crm-import delete_created for that batch', b.length === 1 && b[0].n === 'crm-import' && b[0].b.batch_id === 103, b);

  /* ---------------- run 9: the order, Look at them ---------------- */
  await pick(f, 9); await f.page.waitForTimeout(900);
  const c9 = {}; for (const k of MAIL) c9[k] = await card(f, k);
  ok('the next card to compare is the compared people card (Apply)', JSON.stringify(c9.mail_people.btns) === '["Apply"]', c9.mail_people);
  ok('the people card counts by type and outbound-only', /By type: supporter 20, partner 12, other 12\./.test(c9.mail_people.txt) && /12 people Welfare Avenue wrote to never answered and are not added\./.test(c9.mail_people.txt), c9.mail_people.txt);
  ok('a card whose cards above are not applied offers no Compare', c9.mail_enrich.btns.length === 0 && /Apply the cards above first\./.test(c9.mail_enrich.txt)
     && c9.mail_interactions.btns.length === 0 && /Apply the cards above first\./.test(c9.mail_interactions.txt), [c9.mail_enrich, c9.mail_interactions]);
  b = await f.ev(() => ({ sum: !!document.querySelector('#w284root [data-w284msum]'), go: !!document.querySelector('#w284root [data-w284mgo]'), cap: !!document.querySelector('#w284root [data-w284mcapin]') }));
  ok('no Write the summaries before the email lines are applied; no Start reading after go; Raise the cap after go', !b.sum && !b.go && b.cap, b);
  await click(f, '#w284root [data-w284mlook]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => { const t = document.querySelector('#w284root .w284mpeople'); return { calls: window.__calls.filter(c => c.body.action === 'people').map(c => c.body),
    th: t ? [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()) : [], rows: t ? [...t.querySelectorAll('tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')) : [],
    hidden: ((document.querySelector('#w284root .w284mlook') || {}).innerText || '') }; });
  ok('Look at them asks mail-history for the run\'s people', b.calls.length === 1 && b.calls[0].run_id === 9 && b.calls[0].offset === 0, b.calls);
  ok('and draws them: name, address, type, match, with a header row', JSON.stringify(b.th) === '["Name","Address","Type","Emails","First and last","Organisation","Match","Choose"]'
     && /Test Partner Person test\.partner@pantry\.example\.invalid partner, 91% sure 4 in, 3 out/.test(b.rows[0]) && /In the Hub \(5103\), asked to stop/.test(b.rows[1]) && /not sure/.test(b.rows[1]), b);
  ok('it says how many only Steel sees', /1 person found in Steel's mailbox is shown only to Steel\./.test(b.hidden), b.hidden);
  await click(f, '#w284root [data-w284mex="test.partner@pantry.example.invalid"]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ ex: window.__calls.filter(c => c.body.action === 'exclude').map(c => c.body), people: (document.querySelector('#w284root [data-w284card="mail_people"]') || {}).innerText || '' }));
  ok('Leave out calls exclude', b.ex.length === 1 && b.ex[0].what === 'person' && b.ex[0].on === true && b.ex[0].key === 'test.partner@pantry.example.invalid', b.ex);
  ok('and the compared card asks for a new compare', /compare again before applying/.test(b.people), b.people);
  await f.ev(() => { const s = document.querySelector('#w284root [data-w284mf="type"]'); s.value = 'partner'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(700);
  b = await f.ev(() => window.__calls.filter(c => c.body.action === 'people').pop().body);
  ok('a filter asks again from the first page', b.filter && b.filter.type === 'partner' && b.offset === 0, b);
  // purge
  await click(f, '#w284root [data-w284purge]'); await f.page.waitForTimeout(300);
  b = await f.ev(() => (document.querySelector('#w284root .w284ask') || {}).innerText || '');
  ok('Purge says Undo ends with it', /staged emails, people and organisations and change records\. Undo ends with it/.test(b), b);
  await click(f, '#w284root [data-w284purgeno]'); await f.page.waitForTimeout(200);

  /* ---------------- run 8: waiting, Start reading ---------------- */
  await pick(f, 8); await f.page.waitForTimeout(900);
  b = await f.ev(() => { const g = document.querySelector('#w284root [data-w284mgo]'); return { go: !!g, primary: g && !g.classList.contains('soft'), txt: (document.querySelector('#w284root [data-w284b="scan"]') || {}).innerText || '',
    cards: [...document.querySelectorAll('#w284root [data-w284card] .w284acts button')].length }; });
  ok('a waiting run offers Start reading as the one primary button, and no card can compare yet', b.go && b.primary && /Waiting for your go/i.test(b.txt) && /Spent \$0\.40 \(the sample only, before your go\)\./.test(b.txt) && b.cards === 0, b);
  await click(f, '#w284root [data-w284mgo]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => ((document.querySelector('#w284mpop [role="dialog"]') || {}).innerText || ''));
  ok('Start reading repeats the estimate and the cap', /Start reading the threads\?/.test(b) && /about \$4\.00/.test(b) && /cap will be \$6\.00/.test(b) && /at most \$60\.00/.test(b), b);
  await click(f, '#w284mpop [data-w284myes]'); await f.page.waitForTimeout(800);
  b = await f.ev(() => window.__calls.filter(c => c.name === 'mail-history' && c.body.action === 'go').map(c => c.body));
  ok('yes calls mail-history go for that run', b.length === 1 && b[0].run_id === 8, b);

  /* ---------------- a new email-history run ---------------- */
  b = await f.ev(() => [...document.querySelectorAll('#w284root [data-w284newsrc] option')].map(o => o.value + ':' + o.textContent));
  ok('New run offers both sources', JSON.stringify(b) === JSON.stringify(["keela:Keela's exports", "email_history:Email history (Steel's mailbox and hub@)"]), b);
  await f.ev(() => { const s = document.querySelector('#w284root [data-w284newsrc]'); s.value = 'email_history'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(300);
  await f.ev(() => { const i = document.querySelector('#w284root [data-w284label]'); i.value = 'Test new scan'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(f, '#w284root [data-w284new]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ start: window.__calls.filter(c => c.body.action === 'start').map(c => ({ n: c.name, b: c.body })), keela: window.__calls.some(c => c.body.action === 'new_run') }));
  ok('the email history starts through mail-history start, not crm-import', b.start.length === 1 && b.start[0].n === 'mail-history' && b.start[0].b.label === 'Test new scan' && !b.keela, b);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- run 9 when the lines are applied: Write the summaries ---------------- */
  const fx = fx292();
  fx.crm_import_batches = fx.crm_import_batches.filter(x => x.run_id !== 10).map(x => x.run_id === 9 ? Object.assign({}, x, { status: 'applied' }) : x)
    .concat([{ id: 94, run_id: 9, kind: 'mail_enrich', status: 'applied', report: null }, { id: 95, run_id: 9, kind: 'mail_interactions', status: 'applied',
      report: { kind: 'mail_interactions', counts: { rows_read: 70, matched: 70, created: 0, updated: { crm_interactions: 400 }, kept_hub_value: {}, skipped: {} }, lists: { mail: { first_contacts: 31 } }, changes: 400 } }]);
  fx.crm_import_runs = fx.crm_import_runs.filter(x => x.id !== 10);
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fx, rpcs: RPCS, init: INVOKE, wait: 4000 });
  await f.hash('#crm/settings/imports', 2600);
  b = await f.ev(() => { const s = document.querySelector('#w284root [data-w284msum]'); return { sum: !!s, primary: s && !s.classList.contains('soft'),
    undo: [...document.querySelectorAll('#w284root [data-w284undo]')].map(x => x.getAttribute('data-w284undo')),
    lines: (document.querySelector('#w284root [data-w284card="mail_interactions"]') || {}).innerText || '',
    people: (document.querySelector('#w284root [data-w284card="mail_people"]') || {}).innerText || '' }; });
  ok('every card applied: Write the summaries is the primary button', b.sum && b.primary, b);
  ok('only the last card offers Undo; the others wait for the cards below', JSON.stringify(b.undo) === '["mail_interactions"]' && /Undo the cards below first/.test(b.people), b);
  ok('the lines card counts the first contacts', /First contacts among this run's people: 31\./.test(b.lines), b.lines);
  await click(f, '#w284root [data-w284msum]'); await f.page.waitForTimeout(800);
  b = await f.ev(() => window.__calls.filter(c => c.body.action === 'summarise').map(c => ({ n: c.name, b: c.body })));
  ok('Write the summaries calls mail-history summarise for the run', b.length === 1 && b[0].n === 'mail-history' && b[0].b.run_id === 9, b);
  ok('no page errors (summaries)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- phone width ---------------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx292(), rpcs: RPCS, init: INVOKE, wait: 4000 });
  await f.hash('#crm/settings/imports', 2600);
  await pick(f, 9); await f.page.waitForTimeout(900);
  await click(f, '#w284root [data-w284mlook]'); await f.page.waitForTimeout(900);
  b = await f.ev(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, rows: document.querySelectorAll('#w284root .w284mpeople tbody tr').length,
    wide: [...document.querySelectorAll('#w284root *')].filter(e => !e.closest('.w284scroll') && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5) }));
  ok('phone: the email-history page does not scroll sideways (the people table scrolls in its own region)', b.rows === 2 && b.sw <= b.w + 1 && b.wide.length === 0, b);
  await click(f, '#w284root [data-w284mdel]');
  await pick(f, 10); await f.page.waitForTimeout(900);
  await click(f, '#w284root [data-w284mdel]'); await f.page.waitForTimeout(400);
  b = await f.ev(() => { const box = document.querySelector('#w284mpop [role="dialog"]'); const rc = box && box.getBoundingClientRect(); return rc ? { l: rc.left, r: rc.right, w: innerWidth } : null; });
  ok('phone: the confirmation fits the screen', b && b.l >= 0 && b.r <= b.w, b);
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw292drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
