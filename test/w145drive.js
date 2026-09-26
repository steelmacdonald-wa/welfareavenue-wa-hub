/* w145drive.js: Forms flows (wave145) in the Volunteering manager and the HR centre.
   The forms tables come from a snapshot of the live data (scratchpad forms_fixture.json). usage: node test/w145drive.js */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const FORMS = JSON.parse(fs.readFileSync(SP + 'forms_fixture.json', 'utf8'))[0];
function fixture(noQuiz) {
  const fx = loadFixture();
  fx.form_sources = FORMS.sources; fx.form_summaries = FORMS.sums;
  fx.form_responses = FORMS.responses.filter(r => !(noQuiz && r.kind === 'onboarding_quiz'));
  /* the fixture's checklist and roster belong to event 1: lend them to the September 6 serving so its page draws */
  (fx.sop_event_steps || []).forEach(x => { if (x.event_id === 1) x.event_id = 21; });
  (fx.event_roster || []).forEach(x => { if (x.event_id === 1) x.event_id = 21; });
  /* the page lists events from volunteer_event_summary: add the fixture's autumn servings to it */
  const have = new Set((fx.volunteer_event_summary || []).map(x => x.id));
  (fx.volunteer_events || []).forEach(e => { if (!have.has(e.id)) (fx.volunteer_event_summary = fx.volunteer_event_summary || []).push(Object.assign({ roster_count: 0, roster_confirmed: 0, steps_total: 0, steps_done: 0, extras_total: 0, extras_open: 0 }, e)); });
  return fx;
}
const MOCK = `(function(){ window.__INV = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.functions || db.functions.__w) return;
    db.functions.invoke = function (name, opts) { window.__INV.push({ name: name, body: opts && opts.body });
      return new Promise(function (res) { setTimeout(function () { res({ data: { ok: true, report: [] }, error: null }); }, 300); }); };
    db.functions.__w = 1; }, 5); })();`;

(async () => {
  const browser = await launch();
  /* Steel, an admin: the Volunteering calendar */
  let f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(false), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1500);
  let h = await f.ev(() => { const el = document.getElementById('w145home'), cal = document.getElementById('w119cal'); if (!el) return null;
    return { after: !!cal && cal.nextElementSibling === el, evs: [...el.querySelectorAll('.ev')].map(e => e.getAttribute('data-w145ev') + '|' + e.querySelector('small').textContent), text: el.textContent, link: !!el.querySelector('a[href*="docs.google.com/forms"]') }; });
  ok('the calendar shows what volunteers said, under the month', h && h.after, h);
  ok('the four latest servings with answers', h && h.evs.length === 4 && h.evs[0] === '21|5 volunteers answered' && h.evs[1] === '20|7 volunteers answered', h && h.evs);
  ok('the new sign-ups wait for review', h && /3 new volunteers from the recurrent volunteers form/.test(h.text), h && h.text.slice(0, 400));
  ok('the survey link to send after a serving', h && h.link && /copy the link/.test(h.text), h && h.link);
  const tour = await f.ev(() => { const T = window.w122 && w122.tours && w122.tours.volunteering; if (!T) return null; const s = T.steps.map(x => x.s); return { home: s[s.indexOf('#w145home') - 1], fb: s[s.indexOf('#w145fb') - 1] }; });
  ok('the volunteering tour has both steps', tour && tour.home === '#w119cal' && tour.fb === '#w119rail', tour);

  /* a serving: what volunteers said and the audit */
  await f.ev(() => document.querySelector('#w145home [data-w145ev="21"]').click());
  await f.page.waitForTimeout(2200);
  const ev = await f.ev(() => { const fb = document.getElementById('w145fb'), au = document.getElementById('w145au'), rail = document.getElementById('w119rail');
    return { hash: location.hash, inRail: !!fb && fb.parentNode === rail, fb: fb ? fb.textContent : '', chips: fb ? fb.querySelectorAll('.chips span').length : 0, sum: !!(fb && fb.querySelector('.sum')), au: au ? au.textContent : '', kv: au ? au.querySelectorAll('.kv dt').length : 0 }; });
  ok('the serving opens', ev.hash === '#volunteering/e/21', ev.hash);
  ok('what volunteers said sits in the side rail', ev.inRail && /What volunteers said/.test(ev.fb) && /5 answers/.test(ev.fb), ev.fb.slice(0, 200));
  ok('with the summary and the choices counted', ev.sum && ev.chips >= 6 && /In short/.test(ev.fb), [ev.sum, ev.chips]);
  ok('the lead’s audit below it', /Event audit/.test(ev.au) && ev.kv >= 5 && /meals/i.test(ev.au), ev.au.slice(0, 300));
  await f.ev(() => document.querySelector('#w145fb [data-w145sync]').click());
  await f.page.waitForTimeout(700);
  const inv = await f.ev(() => window.__INV);
  ok('Read the forms now asks forms-flow', inv.length === 1 && inv[0].name === 'forms-flow' && inv[0].body.action === 'sync', inv);
  ok('no page errors (volunteering)', f.errs.length === 0, f.errs);

  /* the HR centre */
  await f.hash('#hrcentre', 2000);
  const hr = await f.ev(() => { const el = document.getElementById('w145quiz'); if (!el) return null;
    return { rows: [...el.querySelectorAll('.w145tbl tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim()).join(' | ')), quotes: el.querySelectorAll('.w145quote').length, btn: !!el.querySelector('[data-w145sync]'), text: el.textContent }; });
  ok('the HR centre shows the onboarding quizzes', hr && hr.rows.length === 12 && hr.rows.every(r => /\| (Policy quiz|Week 4 onboarding quiz)/.test(r)), hr && hr.rows.slice(0, 3));
  ok('each with its score', hr && hr.rows.filter(r => / of \d+ \|/.test(r)).length >= 8, hr && hr.rows.slice(0, 3));
  ok('what new members said about the onboarding', hr && hr.quotes >= 1 && hr.quotes <= 5, hr && hr.quotes);
  ok('Sync now for an admin', hr && hr.btn, hr && hr.btn);
  const tourHr = await f.ev(() => { const T = window.w122 && w122.tours && w122.tours.hrcentre; if (!T) return null; const s = T.steps.map(x => x.s); return s[s.indexOf('#w145quiz') - 1]; });
  ok('the HR centre tour has a step after Meeting attendance', tourHr === '#w144hr', tourHr);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* a member on the HR profile, who does not read the quizzes of others (no rows): no quiz card data, the volunteering card */
  f = await fresh(browser, { who: 'member', hash: '#volunteering', fixture: fixture(true), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const m1 = await f.ev(() => !!document.getElementById('w145home'));
  ok('staff see the volunteer feedback', m1 === true, m1);
  await f.hash('#hrcentre', 2000);
  const m2 = await f.ev(() => { const el = document.getElementById('w145quiz'); return el ? el.textContent : null; });
  ok('an HR member off the HR access list is told who keeps the results', m2 === null || /kept for the HR access list/.test(m2), m2 && m2.slice(0, 200));
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw145drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
