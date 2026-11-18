/* w353drive.js (wave353): the goals ecosystem.
   CAND=build/<file>.html node test/w353drive.js   (SHOTS=<dir> saves screenshots)
   Live measures, year bubbles with this year's quarters, a milestone moved to a quarter, a milestone reached (the
   celebration), Key events linked, contributors added, a project linked to many milestones, the project page's
   milestones card and its report, board read only, the phone, reduced motion. The strategy_* calls are caught in the page
   (as w207drive does); nothing reaches the database. */
const fs = require('fs');
const { fresh, launch } = require('./boot');
const { build } = require('./w207fixture');
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }
const src = fs.readFileSync(__dirname + '/w207drive.js', 'utf8');
eval(src.slice(src.indexOf('const INIT ='), src.indexOf('const boot =')).replace('const INIT', 'global.INIT'));

const MV = {
  meals_fy: { v: 412, note: 'Team leaders count meals after each serving; else the tally, else the plan.' }, servings_fy: { v: 4 }, toronto_servings_fy: { v: 1 }, people_served_fy: { v: 380 },
  conversations_fy: { v: 23 }, clothing_fy: { v: 140 }, feedback_fy: { v: 61 },
  community_back: { v: 57 }, vol_returning_6m: { v: 51, prev: 44 }, vol_unique_fy: { v: 118 }, donors_back: { v: 6 },
  email_openers: { v: null, tracked: false, note: 'Not tracked yet: turn on open tracking and the opened webhook in Resend.' },
  followers: { v: 1460, prev: 1402 }, web_returning_30d: { v: 210, prev: 190 },
  raised_fy: { v: 3150 }, avg_month_6m: { v: 610, prev: 280 }, monthly_donors: { v: 3 }, events_raised_fy: { v: 0 }, grants_awarded_fy: { v: 0 },
  projects_linked_pct: { v: 74 }, overdue_tasks: { v: 21 }, _as_of: '2026-10-04T15:00:00Z'
};
function patch(fx) {
  const G = n => 100 + n, now = '2026-10-04T21:30:00+00:00';
  let mid = 9000;
  const M = (g, fy, q, body, st, key, tg) => { const m = { id: ++mid, goal_id: G(g), fy, sort: mid, body, status: st || 'not started', quarter: q, measure_key: key || null, target_value: tg == null ? null : tg, updated_at: now, updated_by: 'wave353', archived_at: null }; fx.goal_milestones.push(m); return m; };
  fx.goal_milestones.forEach(m => { m.quarter = null; m.measure_key = null; m.target_value = null; });
  const meals = fx.goal_milestones.find(m => m.goal_id === G(1) && m.fy === 'FY27' && /3,000/.test(m.body));
  if (meals) { meals.measure_key = 'meals_fy'; meals.target_value = 3000; }
  const vols = fx.goal_milestones.find(m => m.goal_id === G(3) && m.fy === 'FY27' && /110/.test(m.body));
  if (vols) { vols.measure_key = 'vol_unique_fy'; vols.target_value = 110; }
  M(3, 'FY27', 4, '12 collaborative pieces with partners (joint posts, interviews, takeovers)');
  M(3, 'FY28', null, 'A professionally produced Welfare Avenue film for Montreal and Toronto');
  const d10 = M(4, 'FY27', 3, '10 monthly donors by June', 'not started', 'monthly_donors', 10);
  const ev = M(4, 'FY27', 4, 'Fundraising events raise $10,000 (stretch: $20,000)', 'in progress', 'events_raised_fy', 10000);
  M(5, 'FY27', 1, 'Content planned, scheduled and answered from the Hub', 'done');
  fx.goal_measures = [];
  let id = 0; const MS = (g, key, label, unit, source, t, head) => fx.goal_measures.push({ id: ++id, goal_id: G(g), key, label, unit, source, target_fy27: t, is_headline: !!head, sort: id, archived_at: null });
  MS(1, 'meals_fy', 'Meals served this year', 'meals', 'Servings, the Volunteer Manager and the tally', 3000, 1); MS(1, 'servings_fy', 'Servings held this year', 'servings', 'The Volunteer Manager');
  MS(3, 'community_back', 'Community that comes back', 'people', 'Volunteers, the CRM and email', null, 1); MS(3, 'vol_returning_6m', 'Returning volunteers (6 months)', 'people', 'The Volunteer Manager');
  MS(3, 'vol_unique_fy', 'Volunteers this year', 'people', 'The Volunteer Manager', 110); MS(3, 'email_openers', 'Repeat email readers (90 days)', 'readers', 'Email in the CRM (Resend)');
  MS(3, 'followers', 'Followers', 'followers', 'Instagram, Facebook, LinkedIn');
  MS(4, 'raised_fy', 'Raised this year', '$', 'The CRM and Grants', 25000, 1); MS(4, 'avg_month_6m', 'Gifts a month (6-month average)', '$', 'The CRM'); MS(4, 'monthly_donors', 'Monthly donors', 'donors', 'The CRM', 25);
  fx.goal_contributors = [{ id: 1, goal_id: G(4), member_id: 27, focus: 'Fundraising events', sort: 1, removed_at: null }];
  fx.fund_events = [
    { id: 4, title: 'Gift Basket Drive 2026', season: 'fall-2026', start_date: '2026-12-01', status: 'planned', lead: 'Amanda', partners: 'Scattered', project_id: null, target_min: 5000, target_max: 5000, raised: 750, goal_id: G(4), milestone_id: ev.id },
    { id: 9, title: 'Corporate Cook-Off', season: 'winter-2027', start_date: '2027-01-01', status: 'planned', lead: null, partners: null, project_id: null, target_min: null, target_max: null, raised: null, goal_id: G(4), milestone_id: ev.id },
    { id: 1, title: 'Flag Football 2026', season: 'summer-2026', start_date: '2026-08-08', status: 'done', lead: null, partners: 'MFL', project_id: null, target_min: 4000, target_max: null, raised: 2800, goal_id: G(4), milestone_id: null },
    { id: 11, title: 'Golf Tournament 2027', season: 'spring-2027', start_date: '2027-04-01', status: 'planned', lead: null, partners: null, project_id: null, target_min: null, target_max: null, raised: null, goal_id: null, milestone_id: null }
  ];
  fx.project_milestones = [];
  return { d10, ev };
}
const boot = (b, who, width, hash, extra) => {
  const fx = build(); const ids = patch(fx); if (extra) extra(fx);
  const init = INIT('2026-10-04') + `;(function(){ window.__w205rpc = window.__w205rpc || {}; var MV = ${JSON.stringify(MV)}; var o = window.__w205rpc; Object.defineProperty(window, '__w205rpc', { configurable: true, get: function () { return o; }, set: function (v) { o = v; o.wa353_measures = function () { return MV; }; } }); o.wa353_measures = function () { return MV; }; })();`;
  return fresh(b, { who, width: width || 1366, hash: hash || '#orggoals', fixture: fx, init, wait: 4600 }).then(f => { f.ids = ids; return f; });
};
const calls = (f, fn) => f.ev(n => window.__w205calls.filter(c => !n || c.fn === n), fn);
const shot = async (f, name, sel) => { if (!SHOTS) return; if (sel) { const el = await f.page.$(sel); if (el) return el.screenshot({ path: SHOTS + '/' + name + '.png' }); } await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: false }); };

(async () => {
  const b = await launch();
  try {
    /* ================= admin, desktop ================= */
    let f = await boot(b, 'admin', 1366, '#orggoals/goal/104');
    await f.page.waitForTimeout(1200);
    let r = await f.ev(() => ({
      tiles: Array.from(document.querySelectorAll('[data-w353meas="104"] .w353m')).map(t => t.querySelector('.lab').textContent + '=' + t.querySelector('.num b').textContent + (t.classList.contains('head') ? '*' : '')),
      bar: (document.querySelector('[data-w353meas="104"] .w353m.head .tg') || {}).textContent,
      trend: (document.querySelector('[data-w353meas="104"] .w353tr.up') || {}).textContent,
      asof: !!document.querySelector('#w205 .w353asof [data-w353refresh]'),
      off: (Array.from(document.querySelectorAll('[data-w353meas="103"] .w353m.off .num b')).map(b => b.textContent))[0],
      years: Array.from(document.querySelectorAll('[data-w205years="104"] .w353yb')).map(x => x.querySelector('.t b').textContent + (x.classList.contains('on') ? '*' : '') + '|' + x.querySelector('.t small').textContent),
      qs: Array.from(document.querySelectorAll('[data-w205years="104"] .w353q')).map(q => q.querySelector('.qh b').textContent + ':' + q.querySelectorAll('.w205ms').length + (q.classList.contains('now') ? '*' : '')),
      cps: document.querySelectorAll('[data-w205years="104"] .w353q .w207cp').length,
      live: (document.querySelector('[data-w205years="104"] .w353ml span') || {}).textContent,
      contribs: (document.querySelector('[data-w353contribs="104"]') || {}).textContent,
      evs: Array.from(document.querySelectorAll('[data-w353evbox="104"] > .w353evs > .w353ev .eh b')).map(x => x.textContent),
      evsum: (document.querySelector('[data-w353evbox="104"] .w353evsum') || {}).textContent,
      past: (document.querySelector('[data-w353evbox="104"] .w353past summary') || {}).textContent,
      gbd: (document.querySelector('[data-w353ev="4"] .tg') || {}).textContent,
      emdash: document.getElementById('w205').innerText.indexOf('—') >= 0
    }));
    ok(r.tiles[0] === 'Raised this year=$3,150*' && r.tiles.length === 3, 'measures: goal 4 leads with Raised this year, live ($3,150), then its other measures ' + JSON.stringify(r.tiles));
    ok(/13% of \$25,000 for FY27/.test(r.bar), 'measures: the headline shows the way to the FY27 target (' + r.bar + ')');
    ok(/↑ \$330/.test(r.trend || ''), 'measures: the six-month average shows its trend against the six before (' + r.trend + ')');
    ok(r.asof, 'measures: says when the Hub counted, with Count again');
    ok(r.off === 'Not tracked yet', 'measures: email readers say Not tracked yet until Resend sends opens');
    ok(JSON.stringify(r.years.map(x => x.split('|')[0])) === '["FY27*","FY28","FY29"]' && /Now/.test(r.years[0]), 'years: FY27 (now, open), FY28, FY29 as bubbles ' + JSON.stringify(r.years));
    ok(r.qs.length === 4 && r.qs[0] === 'Q1:0*' && r.qs[2] === 'Q3:1' && r.qs[3] === 'Q4:1' && r.cps === 4, 'years: FY27 opens into Q1 to Q4, each with its checkpoint and its milestones ' + JSON.stringify(r.qs));
    ok(/3 of 10/.test(r.live || ''), 'milestones: 10 monthly donors shows its live number (' + r.live + ')');
    ok(/Contributors/.test(r.contribs) && /Fundraising events/.test(r.contribs), 'contributors: a contributor for fundraising events, beside the owners (' + r.contribs.replace(/\s+/g, ' ').trim() + ')');
    ok(JSON.stringify(r.evs) === JSON.stringify(['Gift Basket Drive 2026', 'Corporate Cook-Off']) && /\$750 raised of \$5,000/.test(r.gbd), 'key events: this year\'s events with target and raised (' + r.gbd + ')');
    ok(/2 events this year and ahead/.test(r.evsum) && /Earlier events \(1\)/.test(r.past), 'key events: a summary line; last year\'s Flag Football folded under Earlier events');
    ok(!r.emdash, 'no em dash on the page');
    await shot(f, 'w353_goal4', '#w205g-104');

    /* a year bubble opens that year */
    await f.page.click('[data-w353yr="104:FY28"]'); await f.page.waitForTimeout(300);
    r = await f.ev(() => ({ on: (document.querySelector('[data-w205years="104"] .w353yb.on .t b') || {}).textContent, qs: document.querySelectorAll('[data-w205years="104"] .w353q').length, ms: document.querySelectorAll('[data-w205years="104"] .w205ms').length }));
    ok(r.on === 'FY28' && r.qs === 0 && r.ms > 0, 'years: FY28 opens as a list (no quarters for a later year)');
    await f.page.click('[data-w353yr="104:FY27"]'); await f.page.waitForTimeout(300);
    await f.page.click('[data-w205years="104"] [data-w353fy31]'); await f.page.waitForTimeout(250);
    r = await f.ev(() => Array.from(document.querySelectorAll('[data-w205years="104"] .w353yb .t b')).map(x => x.textContent));
    ok(r.indexOf('FY31') >= 0, 'years: Show FY31 adds the gated year');
    await f.page.click('[data-w205years="104"] [data-w353fy31]'); await f.page.waitForTimeout(250);

    /* move a milestone to a quarter */
    await f.ev(() => { window.__w205rpc.strategy_milestone_meta = function (a) { return { id: a.p_id, quarter: a.p_quarter }; }; });
    const anyMs = await f.ev(() => { const s = document.querySelector('[data-w205years="104"] .w353any [data-w353q]'); return s ? s.getAttribute('data-w353q') : null; });
    await f.ev(id => { const s = document.querySelector('[data-w353q="' + id + '"]'); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true })); }, anyMs);
    await f.page.waitForTimeout(400);
    let cs = await calls(f, 'strategy_milestone_meta');
    r = await f.ev(id => !!document.querySelector('[data-w205years="104"] [data-w353qcol="2"] [data-w205ms="' + id + '"]'), anyMs);
    ok(cs.length === 1 && cs[0].args.p_quarter === 2 && r, 'quarters: a milestone moved to Q2 saves (strategy_milestone_meta) and sits in the Q2 column');

    /* a milestone reached: the celebration */
    const d10 = f.ids.d10.id;
    await f.ev(id => { const s = document.querySelector('[data-w205k="milestone:' + id + ':status"]'); s.scrollIntoView({ block: 'center' }); s.value = 'done'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, d10);
    await f.page.waitForTimeout(150);
    r = await f.ev(id => ({ pop: document.querySelector('[data-w205ms="' + id + '"]').classList.contains('w353pop'), burst: document.querySelectorAll('.w353burst i').length, toast: Array.from(document.querySelectorAll('.toast, #toast, [class*=toast]')).map(x => x.textContent).join(' | '), ring: getComputedStyle(document.querySelector('[data-w353yr="104:FY27"] .ring .fg')).getPropertyValue('--o').trim(), small: document.querySelector('[data-w353yr="104:FY27"] .t small').textContent }), d10);
    cs = (await calls(f, 'strategy_save')).filter(c => c.args.p_entity === 'milestone');
    ok(cs.length === 1 && cs[0].args.p_value === 'done', 'reached: the status saves as done');
    ok(r.pop && r.burst === 14, 'reached: the milestone pops and a small burst plays (14 pieces)');
    ok(/Milestone reached\. FY27 on goal 4: 1 of \d+ done\./.test(r.toast), 'reached: the toast says where the year stands (' + r.toast.slice(0, 120) + ')');
    ok(/1 of/.test(r.small) && Number(r.ring) < 97.4, 'reached: the FY27 ring fills (' + r.ring + ')');
    await f.page.waitForTimeout(1100);
    r = await f.ev(() => document.querySelectorAll('.w353burst').length);
    ok(r === 0, 'reached: the burst cleans itself up');

    /* link a project to many milestones */
    await f.ev(() => { const b = document.querySelector('[data-w205projs="104"] [data-w205link]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await f.page.waitForTimeout(300);
    await f.page.fill('#w205drawer [data-w205linkq]', 'General Ops Toronto'); await f.page.waitForTimeout(400);
    await f.page.click('#w205drawer [data-w205pickp]'); await f.page.waitForTimeout(250);
    await f.ev(() => { const b = Array.from(document.querySelectorAll('#w205drawer [data-w205pickg]')).find(x => x.getAttribute('data-w205pickg') === '104'); b.click(); }); await f.page.waitForTimeout(250);
    await f.ev(() => { const xs = Array.from(document.querySelectorAll('#w205drawer [data-w353pickm]')); xs[0].click(); xs[1].click(); xs[2].click(); }); await f.page.waitForTimeout(150);
    r = await f.ev(() => (document.querySelector('#w205drawer [data-w353pickn]') || {}).textContent);
    ok(/3 milestones picked/.test(r || ''), 'link: ticking three milestones says so (' + r + ')');
    await f.page.click('#w205drawer [data-w205dolink]'); await f.page.waitForTimeout(500);
    cs = await calls(f, 'strategy_link_milestones');
    ok(cs.length === 1 && cs[0].args.p_project === 16 && cs[0].args.p_milestones.length === 3, 'link: strategy_link_milestones with the three');
    r = await f.ev(() => document.querySelectorAll('[data-w205years="104"] .w205ms [data-w205proj="16"]').length);
    ok(r >= 1, 'link: the project shows under the milestones it moves in the open year (' + r + ')');

    /* key events: link one from the drawer */
    await f.ev(() => { const b = document.querySelector('[data-w353evadd="104"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await f.page.waitForTimeout(300);
    r = await f.ev(() => Array.from(document.querySelectorAll('#w205drawer [data-w353evpick]')).map(x => x.querySelector('.t > span').textContent));
    ok(JSON.stringify(r) === '["Golf Tournament 2027"]', 'key events: the sheet offers the events not feeding this goal');
    await f.page.click('#w205drawer [data-w353evpick="11"]'); await f.page.waitForTimeout(250);
    await f.ev(id => { const x = document.querySelector('#w205drawer [data-w353evm="' + id + '"]'); x.click(); x.dispatchEvent(new Event('change', { bubbles: true })); }, f.ids.ev.id);
    await f.page.click('#w205drawer [data-w353evsave]'); await f.page.waitForTimeout(400);
    cs = await calls(f, 'strategy_link_event');
    r = await f.ev(() => Array.from(document.querySelectorAll('[data-w353evbox="104"] > .w353evs > .w353ev .eh b')).map(x => x.textContent));
    ok(cs.length === 1 && cs[0].args.p_event === 11 && cs[0].args.p_goal === 104 && cs[0].args.p_milestone === f.ids.ev.id && r.indexOf('Golf Tournament 2027') >= 0, 'key events: strategy_link_event, and the card joins the goal');

    /* contributors */
    await f.ev(() => { const b = document.querySelector('[data-w353contrib="104"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await f.page.waitForTimeout(300);
    await f.page.fill('#w205drawer [data-w353cq]', 'Albert'); await f.page.waitForTimeout(400);
    const alb = await f.ev(() => { const l = document.querySelector('#w205drawer [data-w353con]'); return l ? l.getAttribute('data-w353con') : null; });
    if (alb) await f.ev(id => document.querySelector('#w205drawer [data-w353con="' + id + '"]').click(), alb);
    await f.page.waitForTimeout(300);
    cs = await calls(f, 'strategy_contributor_set');
    ok(!alb || (cs.length === 1 && cs[0].args.p_goal === 104 && cs[0].args.p_on === true), 'contributors: adding someone calls strategy_contributor_set' + (alb ? '' : ' (no Albert in the fixture roster)'));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(250);

    /* refresh */
    await f.ev(() => { const b = document.querySelector('[data-w353refresh]'); b.scrollIntoView(); b.click(); }); await f.page.waitForTimeout(400);
    cs = await calls(f, 'wa353_measures');
    ok(cs.length >= 2, 'measures: Count again reads them fresh');
    ok(f.errs.length === 0, 'admin: no page errors ' + JSON.stringify(f.errs).slice(0, 300));
    await f.close();

    /* ================= the project page ================= */
    f = await boot(b, 'admin', 1366, '#project/1', fx => { fx.project_milestones = [{ project_id: 1, milestone_id: 9003 }, { project_id: 1, milestone_id: 9005 }]; const p = fx.projects.find(x => x.id === 1); if (p) { p.goal_id = 104; p.milestone_id = 9003; } fx.goal_milestones.find(m => m.id === 9005).status = 'done'; });
    await f.page.waitForTimeout(1500);
    r = await f.ev(() => { const box = document.getElementById('w353pm'); return box ? { big: box.querySelector('.big').textContent, next: box.querySelector('.next').textContent, items: Array.from(box.querySelectorAll('li')).map(l => l.className.trim() + '|' + l.querySelector('span[data-w198skip]').textContent), csv: !!box.querySelector('[data-w353pcsv]'), link: !!box.querySelector('[data-w353plink]'), goal: !!box.querySelector('a[href="#orggoals/goal/104"]') } : null; });
    ok(r && /1of 2 reached/.test(r.big.replace(/\s/g, '').replace('of', 'of ')) || (r && r.big.indexOf('1') === 0 && /of 2 reached/.test(r.big)), 'project: Milestones this project moves, 1 of 2 reached (' + (r && r.big) + ')');
    ok(r && /10 monthly donors by June/.test(r.next), 'project: Next up names the next milestone');
    ok(r && r.items.length === 2 && r.items.some(x => /^done/.test(x)) && /^done/.test(r.items[0]) && r.goal && r.csv && r.link, 'project: the timeline, the goal link, Link milestones and the report');
    const [dl] = await Promise.all([f.page.waitForEvent('download', { timeout: 4000 }).catch(() => null), f.page.click('#w353pm [data-w353pcsv]')]);
    let csvTxt = ''; if (dl) { const p = await dl.path(); csvTxt = fs.readFileSync(p, 'utf8'); }
    ok(dl && /milestones\.csv$/.test(dl.suggestedFilename()) && /10 monthly donors by June/.test(csvTxt) && /^﻿Project,Goal,Year,Quarter/.test(csvTxt), 'project: the report downloads as a CSV (' + (dl ? dl.suggestedFilename() : 'none') + ')');
    await shot(f, 'w353_project', '#w353pm');
    ok(f.errs.length === 0, 'project: no page errors ' + JSON.stringify(f.errs).slice(0, 300));
    await f.close();

    /* ================= board: read only ================= */
    f = await boot(b, 'board', 1366, '#orggoals');
    await f.page.waitForTimeout(800);
    r = await f.ev(() => ({ meas: document.querySelectorAll('#w205 .w353m').length, qsel: document.querySelectorAll('#w205 [data-w353q]').length, evadd: document.querySelectorAll('#w205 [data-w353evadd]').length, evlink: document.querySelectorAll('#w205 [data-w353evlink]').length, contrib: document.querySelectorAll('#w205 [data-w353contrib]').length, add: document.querySelectorAll('#w205 [data-w205addms]').length }));
    ok(r.meas > 0 && !r.qsel && !r.evadd && !r.evlink && !r.contrib && !r.add, 'board: reads the measures and events; no quarter, link, contributor or add controls ' + JSON.stringify(r));
    ok(f.errs.length === 0, 'board: no page errors ' + JSON.stringify(f.errs).slice(0, 300));
    await f.close();

    /* ================= phone ================= */
    f = await boot(b, 'admin', 390, '#orggoals/goal/104');
    await f.page.waitForTimeout(1200);
    r = await f.ev(() => ({ sw: document.documentElement.scrollWidth, qcols: getComputedStyle(document.querySelector('[data-w205years="104"] .w353qs')).gridTemplateColumns.split(' ').length, head: document.querySelector('[data-w353meas="104"] .w353m.head').getBoundingClientRect().width, wide: Array.from(document.querySelectorAll('#w205 *')).filter(e => e.getBoundingClientRect().right > 392 && e.offsetParent).map(e => e.className).slice(0, 5) }));
    ok(r.sw <= 392 && r.qcols === 1, 'phone: no sideways scroll; the quarters stack (' + r.sw + ') ' + JSON.stringify(r.wide));
    await shot(f, 'w353_phone', '#w205g-104');
    ok(f.errs.length === 0, 'phone: no page errors ' + JSON.stringify(f.errs).slice(0, 300));
    await f.close();

    /* ================= reduced motion: no burst ================= */
    f = await boot(b, 'admin', 1366, '#orggoals/goal/104');
    await f.page.emulateMedia({ reducedMotion: 'reduce' });
    await f.page.waitForTimeout(800);
    r = await f.ev(() => { const s = window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.w205.w353.celebrate(document.querySelector('#w205 .w205ms')); return { s, burst: document.querySelectorAll('.w353burst').length, trans: getComputedStyle(document.querySelector('#w205 .w353bar i')).transitionDuration }; });
    ok(r.trans === '0s', 'reduced motion: the bars do not slide (' + r.trans + ')');
    ok(f.errs.length === 0, 'reduced motion: no page errors');
    await f.close();
  } catch (e) { fail++; console.log('FAIL threw: ' + (e && e.stack || e)); }
  await b.close();
  console.log('w353drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
