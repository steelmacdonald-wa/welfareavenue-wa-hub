/* w197drive.js: wave197, the HR centre rebuilt (one page per rail item, Overview, the Applications board, Hours from The Loop)
   and the page's name as the title in every app. Steel (02/10/26).
   Candidates, Loop sessions and time off are made up here (no real people's applications). Uses test/boot.js (stubbed
   Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file>; SHOTS=1 saves screenshots in test/shots_w197/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w197') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fx() {
  const f = loadFixture();
  const ppl = f.team_members.filter(m => m.active !== false && m.email);
  const iso = (d, h) => new Date(Date.parse('2026-09-25T16:00:00-04:00') - d * 86400000 - (h || 0) * 3600000).toISOString();
  f.hub_candidates = [
    { id: 901, created_at: iso(0.2), name: 'Ada Applicant', email: 'ada@example.org', phone: '514 555 0101', role: 'Operations Manager', status: 'new', summary: 'I would love to help with logistics on Sundays.', cv_path: 'cv/ada.pdf', cv_name: 'Ada CV.pdf', links: ['https://example.org/ada'], owner: null, notes: null, source: 'CABM', stage_at: iso(0.2) },
    { id: 902, created_at: iso(9), name: 'Ben Builder', email: 'ben@example.org', role: 'Volunteer Cook', status: 'new', summary: 'Cook at home, happy to make 40 portions.', owner: null, stage_at: iso(9) },
    { id: 903, created_at: iso(12), name: 'Cleo Candidate', email: 'cleo@example.org', role: 'Operations Manager', status: 'reviewing', summary: 'Still interested (confirmed by text link).', owner: ppl[0].name, stage_at: iso(3) },
    { id: 904, created_at: iso(20), name: 'Dev Interview', email: 'dev@example.org', role: 'Designer', status: 'interview', owner: ppl[1].name, stage_at: iso(10) },
    { id: 905, created_at: iso(40), name: 'Eve Hired', email: 'eve@example.org', role: 'Designer', status: 'hired', owner: ppl[1].name, stage_at: iso(5) },
    { id: 906, created_at: iso(30), name: 'Finn Gone', email: 'finn@example.org', role: 'Volunteer Cook', status: 'withdrawn', stage_at: iso(15) }
  ];
  f.hub_checkins = [
    { id: 1, email: ppl[0].email, name: ppl[0].name, department: ppl[0].department, started_at: iso(1, 3), ended_at: iso(1, 0), minutes: 180 },
    { id: 2, email: ppl[0].email, name: ppl[0].name, department: ppl[0].department, started_at: iso(8, 4), ended_at: iso(8, 0), minutes: 240 },
    { id: 3, email: ppl[2].email, name: ppl[2].name, department: ppl[2].department, started_at: iso(2, 60), ended_at: null, minutes: null },
    { id: 4, email: ppl[3].email, name: ppl[3].name, department: ppl[3].department, started_at: iso(15, 2), ended_at: iso(15, 0), minutes: 120 }
  ];
  f.wa_timeoff = (f.wa_timeoff || []).concat([{ id: 77, email: ppl[4].email, name: ppl[4].name, category: 'Vacation', start_date: '2026-10-10', end_date: '2026-10-12', days: 3, status: 'pending', created_at: iso(1) }]);
  f.onboardings = [{ id: 1, member_id: ppl[5].id, person_name: ppl[5].name, status: 'active', started_at: '2026-09-17' }];
  f.hub_settings = (f.hub_settings || []).filter(r => r.key !== 'hours_minimums').concat([{ key: 'hours_minimums', value: { manager: 5, member: 3 } }]);
  return f;
}
const RPCS = { wa_org_editor: true, loop_feed: [{ id: 1, email: 'x@example.org', name: 'Someone', department: 'hr', day: '2026-09-24', bullets: ['Read every new application', 'Set up two onboardings'], closed: 2, closed_titles: [], share_to: 'team' }], loop_in_now: [] };
const PAGES = ['overview', 'team', 'hours', 'timeoff', 'recognition', 'applications', 'positions', 'playbook', 'onboarding', 'plan', 'training', 'policies', 'discipline'];

(async () => {
  const browser = await launch();
  const FX = fx();
  /* ---------- admin, a computer ---------- */
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/overview', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const rail = await f.ev(() => Array.from(document.querySelectorAll('#w153rail .w153it span')).map(s => s.textContent));
  ok('rail lists the new pages', ['Overview', 'Team', 'Hours', 'Time off', 'Recognition', 'Applications', 'Positions', 'Playbook', 'Onboarding', 'Onboarding plan', 'Training', 'Policies', 'Discipline'].every(x => rail.indexOf(x) >= 0), rail);
  ok('rail groups', (await f.ev(() => Array.from(document.querySelectorAll('#w153rail .w153sh')).map(s => s.textContent))).join('|').indexOf('Hiring') >= 0);
  const seen = {};
  for (const k of PAGES) {
    await f.hash('#hrcentre/' + k, 1600);
    const st = await f.ev(() => {
      const m = document.querySelector('#hrcentre > .w118mast');
      const vis = Array.from(document.querySelectorAll('#hrcentre [data-w197s]')).filter(e => e.offsetParent).map(e => e.id || (e.querySelector('h3,h2') || {}).textContent || e.className).filter(Boolean);
      const txt = document.querySelector('#hrcentre').innerText;
      return { h1: m && m.querySelector('h1').textContent, crumbShown: !!(m && m.querySelector('.crumb') && m.querySelector('.crumb').offsetParent), page: document.getElementById('hrcentre').getAttribute('data-w197'), vis, len: txt.length,
        hr: (txt.match(/HR CENTRE|HR centre/g) || []).length, tail: ['MEETING ATTENDANCE', 'ONBOARDING QUIZZES', 'HUB ENGAGEMENT', 'SCOPE OF WORK'].filter(w => txt.toUpperCase().indexOf(w) >= 0),
        on: (document.querySelector('#w153rail .w153it.on span') || {}).textContent, onN: document.querySelectorAll('#w153rail .w153it.on').length, hero: !!(document.getElementById('w116phero') && document.getElementById('w116phero').offsetParent) };
    });
    seen[k] = st;
    ok(k + ': one page shown', st.page === k, st);
    ok(k + ': title is the page name', st.h1 === st.on && st.onN === 1, st);
    ok(k + ': no crumb, no hero', !st.crumbShown && !st.hero, st);
    ok(k + ': HR centre not repeated', st.hr === 0, st.hr);
    await shot(f, 'admin_' + k, true);
  }
  ok('attendance only on Hours', seen.hours.tail.indexOf('MEETING ATTENDANCE') >= 0 && PAGES.filter(k => k !== 'hours').every(k => seen[k].tail.indexOf('MEETING ATTENDANCE') < 0), PAGES.map(k => k + ':' + seen[k].tail.join(',')));
  ok('quizzes not on Training', seen.training.tail.indexOf('ONBOARDING QUIZZES') < 0);
  ok('no Hub engagement or Slack scope anywhere', PAGES.every(k => seen[k].tail.indexOf('HUB ENGAGEMENT') < 0 && seen[k].tail.indexOf('SCOPE OF WORK') < 0));
  ok('training does not show policies or discipline', seen.training.vis.join('|').indexOf('w106') < 0, seen.training.vis);
  ok('time off page has the time off card', seen.timeoff.vis.indexOf('w105to') >= 0, seen.timeoff.vis);
  ok('policies page', seen.policies.vis.indexOf('w106polsec') >= 0 && seen.policies.vis.every(x => /w10[56]pol/.test(x)), seen.policies.vis);
  ok('discipline page', seen.discipline.vis.indexOf('w106discsec') >= 0 && seen.discipline.vis.every(x => /w10[56]disc/.test(x)), seen.discipline.vis);

  /* Overview */
  await f.hash('#hrcentre/overview', 1800);
  const ov = await f.ev(() => ({ tiles: Array.from(document.querySelectorAll('#w197ov .w197tile')).map(t => t.innerText.replace(/\n/g, ' ')), todo: Array.from(document.querySelectorAll('#w197ov .w197todo li .t b')).map(b => b.textContent) }));
  ok('overview tiles', ov.tiles.length === 6 && /2 new applications/.test(ov.tiles.join('|')), ov.tiles);
  ok('overview to-do: new applications', ov.todo.some(t => /^2 new applications/.test(t)), ov.todo);
  ok('overview to-do: time off', ov.todo.some(t => /time-off request/.test(t)), ov.todo);
  ok('overview to-do: onboarding', ov.todo.some(t => /(people|person) onboarding/.test(t)), ov.todo);
  await f.page.click('#w197ov .w197tile[data-w197go="applications"]'); await f.page.waitForTimeout(1200);
  ok('a tile opens its page', (await f.ev(() => location.hash)) === '#hrcentre/applications');

  /* Applications board */
  const board = await f.ev(() => Array.from(document.querySelectorAll('#w197board .w197col')).map(c => c.getAttribute('data-w197col') + ':' + c.querySelectorAll('.w197cand').length));
  ok('board columns and cards', board.join(',') === 'new:2,reviewing:1,interview:1,offer:0,hired:1', board);
  ok('old applications list hidden', await f.ev(() => !document.getElementById('w116pcands') || !document.getElementById('w116pcands').offsetParent));
  await f.page.click('#w197board .w197cand[data-w197c="901"]'); await f.page.waitForTimeout(500);
  const sh = await f.ev(() => ({ open: document.getElementById('w197sheet').classList.contains('open'), t: document.querySelector('#w197sheet h3').textContent, cv: !!document.querySelector('#w197sheet [data-w197cv]'), next: document.querySelector('#w197sheet .next').textContent }));
  ok('sheet opens with the applicant', sh.open && sh.t === 'Ada Applicant' && sh.cv && /Read the application/.test(sh.next), sh);
  await f.page.click('#w197sheet [data-w197st="reviewing"]'); await f.page.waitForTimeout(700);
  const mv = await f.ev(() => ({ col: Array.from(document.querySelectorAll('#w197board .w197col')).map(c => c.getAttribute('data-w197col') + ':' + c.querySelectorAll('.w197cand').length).join(','), on: (document.querySelector('#w197sheet .stg button.on') || {}).textContent }));
  ok('stage button moves the card', mv.col.indexOf('reviewing:2') >= 0 && mv.on === 'Reviewing', mv);
  await f.page.selectOption('#w197sheet [data-w197f="owner"]', { index: 2 }); await f.page.waitForTimeout(500);
  await f.page.fill('#w197sheet [data-w197f="notes"]', 'Strong on logistics.'); await f.page.click('#w197sheet [data-w197a="notes"]'); await f.page.waitForTimeout(500);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  ok('Escape closes the sheet', await f.ev(() => !document.getElementById('w197sheet').classList.contains('open')));
  const st901 = await f.ev(() => { const c = w197.state().cands.filter(x => x.id === 901)[0]; return { s: c.status, o: c.owner, n: c.notes }; });
  ok('the candidate saved stage, owner and notes', st901.s === 'reviewing' && !!st901.o && st901.n === 'Strong on logistics.', st901);
  /* drag a card to Interview */
  await f.page.dragAndDrop('#w197board .w197cand[data-w197c="903"]', '#w197board .w197col[data-w197col="interview"]'); await f.page.waitForTimeout(700);
  ok('drag moves a card', (await f.ev(() => w197.state().cands.filter(x => x.id === 903)[0].status)) === 'interview');
  /* wave199: a card moved to Interview with no time opens its sheet on the day and time; close it */
  ok('drag to Interview asks for the day and time (wave199)', await f.ev(() => !!document.querySelector('#w197sheet.open #w199iv')));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  await f.page.fill('#w197q', 'ben'); await f.page.waitForTimeout(300);
  ok('search filters the board', (await f.ev(() => document.querySelectorAll('#w197board .w197cand').length)) === 1);
  await f.page.fill('#w197q', ''); await f.page.waitForTimeout(200);
  await f.page.click('[data-w197a="closed"]'); await f.page.waitForTimeout(300);
  ok('closed applications behind a button', (await f.ev(() => document.querySelectorAll('.w197closed .w197cand').length)) === 1);
  await shot(f, 'admin_board', true);

  /* Hours */
  await f.hash('#hrcentre/hours', 1800);
  const hrs = await f.ev(() => ({ rows: document.querySelectorAll('#w197hours .w197tbl tbody tr').length, low: document.querySelectorAll('#w197hours .w197tbl tbody tr.low').length, feed: document.querySelectorAll('#w197hours .w197feed > li').length, slack: !!(document.getElementById('w52hours') && document.getElementById('w52hours').offsetParent), mins: document.getElementById('w197mmgr').value }));
  ok('hours table from The Loop', hrs.rows > 5 && hrs.low > 0, hrs);
  ok('Loop notes shown', hrs.feed === 1, hrs);
  ok('Slack hours gone', !hrs.slack);
  ok('minimums read', hrs.mins === '5', hrs);
  const capped = await f.ev(() => { const h = w197.hoursBy(); return Object.values(h).map(x => x.week + x.last + x.past).sort((a, b) => b - a)[0]; });
  ok('an open session counts at most eight hours', capped <= 480 + 240 + 180, capped);

  /* main buttons in the header */
  await f.hash('#hrcentre/training', 1500);
  await f.hash('#hrcentre/policies', 1500); ok('main button in the header', await f.ev(() => !!document.querySelector('#hrcentre > .w118mast [data-w197main="addpol"]')));
  /* old addresses */
  await f.hash('#hrcentre/recruitment', 1500);
  ok('an old address opens its new page', (await f.ev(() => location.hash + '|' + document.getElementById('hrcentre').getAttribute('data-w197'))) === '#hrcentre/applications|applications');
  await f.hash('#hrcentre/commitment', 1500);
  ok('commitment opens Hours', (await f.ev(() => document.getElementById('hrcentre').getAttribute('data-w197'))) === 'hours');
  await f.hash('#hrcentre', 1500);
  ok('the bare address opens Overview', (await f.ev(() => document.getElementById('hrcentre').getAttribute('data-w197'))) === 'overview');

  /* every app: the page name */
  const apps = [['#crm', 'Contacts'], ['#crm/gifts', 'Gifts'], ['#finances', 'Overview'], ['#volunteering', 'Servings'], ['#adminpanel/people', 'People and access']];
  for (const [h, want] of apps) {
    await f.hash(h, 1800);
    const a = await f.ev(() => { const m = Array.from(document.querySelectorAll('.panel.active > .w118mast'))[0]; return { h1: m && m.querySelector('h1') && m.querySelector('h1').textContent, bar: !!(document.getElementById('w153bar') && document.getElementById('w153bar').offsetParent), crumb: !!(m && m.querySelector('.crumb') && m.querySelector('.crumb').offsetParent) }; });
    ok(h + ': title ' + want, a.h1 === want && !a.bar && !a.crumb, a);
  }
  await f.hash('#crm', 1500);
  ok('CRM: Add a contact moved into the header', await f.ev(() => !!document.querySelector('.panel.active > .w118mast [data-w197proxy="add"]')));
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- an HR member (Samson, HR profile) ---------- */
  f = await fresh(browser, { who: 'member', width: 1366, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, wait: 5000 });
  await f.page.waitForTimeout(1500);
  ok('HR member: the board', (await f.ev(() => document.querySelectorAll('#w197board .w197cand').length)) === 5);
  ok('HR member: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- a member without HR ---------- */
  f = await fresh(browser, { who: 'plain', width: 1366, hash: '#hrcentre', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, wait: 5000 });
  await f.page.waitForTimeout(800);
  ok('plain member: no HR pages', await f.ev(() => !document.querySelector('#w197board') && !document.querySelector('#w197ov .w197todo')));
  ok('plain member: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- phone ---------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const ph = await f.ev(() => ({ wide: document.documentElement.scrollWidth > window.innerWidth + 2, bar: !!(document.getElementById('w153bar') && document.getElementById('w153bar').offsetParent), cards: document.querySelectorAll('#w197board .w197cand').length }));
  ok('phone: nothing wider than the screen', !ph.wide, ph);
  ok('phone: the app bar stays (menu)', ph.bar, ph);
  await shot(f, 'phone_board');
  await f.page.click('#w197board .w197cand[data-w197c="901"]'); await f.page.waitForTimeout(500);
  await shot(f, 'phone_sheet');
  await f.page.keyboard.press('Escape');
  await f.hash('#hrcentre/overview', 1800); await shot(f, 'phone_overview', true);
  await f.hash('#hrcentre/hours', 1800); await shot(f, 'phone_hours', true);
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw197drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join("\n")); console.error(e); process.exit(2); });
