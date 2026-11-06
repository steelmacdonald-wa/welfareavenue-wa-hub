/* w285drive.js: wave285, the onboarding pages reshaped. Offline against the candidate (CAND=<file>.html), with test/boot.js (stubbed Supabase,
   clock 25/09/26 16:00 Toronto) and test/w285fx.js (the demo, rules, worst, empty, one, forty and home sets, through the page's own data boundary;
   onboard-run is test/w271fx.js and test/w275fx.js's stand-in). Widths 375, 768 and 1280, and one run with the root font at 200%.
   Checks: no horizontal scroll; Open reachable on every row; no "undefined", "NaN", "null", "1 steps", "1 members" and the like; Needs you's empty
   state; the panel opens, its tabs switch, Close and Back work; Alix reads 24 of 41 and 24 of 53; group headers never count; Academy-done steps
   count; behind is the section-ended rule; the old blocks are hidden; the actions are wave271's and wave275's own (their calls reach onboard-run);
   the manager's Home card; Start an onboarding plan on the Team profile; the Applications hint; the walkthrough; no console errors.
   SHOTS=<dir> saves screenshots. */
const fs = require('fs');
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx285 } = require('./w285fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 900) : '')); } }
const shot = async (f, n, full) => { if (!SHOTS) return; const vw = f.page.viewportSize(); await f.page.mouse.move(Math.round(vw.width * 0.6), vw.height - 4); await f.page.waitForTimeout(250); await f.page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: full !== false }); };   /* the mouse off the rail, which opens on hover */
async function launch() {
  const args = ['--disable-gpu'];
  let last;
  for (const t of [{ args }, { channel: 'chrome', args }, { channel: 'msedge', args }]) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw last;
}
const BAD = /\bundefined\b|\bNaN\b|\bnull\b|\[object|\b1 (steps|members|hires|things|people|trainings|days|weeks)\b|\b0 of 0\b/;
const txt = (f, sel) => f.ev((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const has = (f, sel) => f.ev((s) => !!document.querySelector(s), sel);
const vis = (f, sel) => f.ev((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !!e.offsetParent && r.width > 0 && r.height > 0; }, sel);
const press = async (f, sel, ms) => { await f.ev((s) => document.querySelector(s).click(), sel); await f.page.waitForTimeout(ms || 450); };
const hasScroll = (f) => f.ev(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const consoleErrs = (f) => { const out = []; f.page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) out.push(m.text().slice(0, 240)); }); return out; };
let homeFig = '';
const rowOf = (name) => '#w285 [data-w285key="' + name + '"]';

(async () => {
  const b = await launch();
  const allErrs = [], allCons = [];
  const go = async (set, o) => {
    o = o || {};
    const d = fx285(set);
    const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'America/Toronto' }, x)) },
      Object.assign({ who: 'admin', hash: '#hrcentre/onboarding', fixture: d.fx, rpcs: d.rpcs, wait: 5000 }, o, { init: d.init + (o.init || '') }));
    f.cons = consoleErrs(f);
    return f;
  };
  const done = async (f) => { allErrs.push(...f.errs); allCons.push(...f.cons); await f.close(); };
  const toPage = async (f, page) => {
    await f.hash('#hrcentre/overview', 1200); await f.hash('#hrcentre/' + (page || 'onboarding'), 2200);
    await f.page.waitForSelector('#w285 .w285sec', { timeout: 8000 }).catch(() => {});
    await f.page.waitForTimeout(600);
  };
  /* the page at one width: no scroll, every Open reachable, no bad words, the old blocks hidden */
  const pageChecks = async (f, label) => {
    const t = await txt(f, '#w285');
    ok(label + ': the page draws Needs you and Everyone', /Needs you/i.test(t) && /Everyone/i.test(t), t.slice(0, 300));
    ok(label + ': no undefined, NaN, null or "1 steps"', !BAD.test(t), (t.match(BAD) || [])[0]);
    ok(label + ': no horizontal scroll', !(await hasScroll(f)), await f.ev(() => [document.documentElement.scrollWidth, window.innerWidth]));
    const rows = await f.ev(() => [].map.call(document.querySelectorAll('#w285 .w285row'), (r) => {
      const bt = r.querySelector('[data-w285open]'), b2 = bt ? bt.getBoundingClientRect() : null;
      return { k: r.getAttribute('data-w285key'), over: r.scrollWidth > r.clientWidth + 1, btn: !!b2 && b2.width >= 30 && b2.height >= 28 && b2.left >= 0 && b2.right <= window.innerWidth + 1 };
    }));
    ok(label + ': every row has a reachable Open (' + rows.length + ' rows)', rows.every((r) => r.btn), rows.filter((r) => !r.btn));
    ok(label + ': no row overflows', rows.every((r) => !r.over), rows.filter((r) => r.over));
    const old = await f.ev(() => { const o = document.getElementById('o271'), s = document.querySelector('#w46body > .w46sec[data-w197s~="onboarding"]'); return { o271: !!o && !!o.offsetParent, who: !!s && !!s.offsetParent, kit: !![].some.call(document.querySelectorAll('#hrcentre [data-w46kit],#hrcentre [data-w46assign]'), (x) => x.offsetParent) }; });
    ok(label + ': Ready to onboard, Who is onboarding, the picker and the Welcome kit are not shown', !old.o271 && !old.who && !old.kit, old);
    return { t, rows };
  };

  /* ---------- 1. demo: the page at three widths and with a 200% root font ---------- */
  for (const w of [1280, 768, 375]) {
    const f = await go('demo', { width: w });
    await toPage(f);
    const { t, rows } = await pageChecks(f, 'demo ' + w);
    if (w === 1280) {
      ok('demo: the summary line', /8 onboarding · 1 behind · 1 finished this month/.test(t), t.slice(0, 400));
      ok('demo: five stages in order', await f.ev(() => [].map.call(document.querySelectorAll('#w285 .w285stg'), (s) => s.firstChild.textContent.trim()).join('|')) === 'Offer out|Starting|Weeks 1 to 4|60 and 90 days');
      ok('demo: 8 rows', rows.length === 8, rows.length);
      const alix = await txt(f, rowOf('m9811'));
      ok('demo: Alix reads Weeks 1 to 4: 24 of 41, On track, her manager from the org chart', /Weeks 1 to 4: 24 of 41/.test(alix) && /On track/.test(alix) && /Amina Dorr/.test(alix), alix);
      ok('demo: Rana is starting, setup 7 of 12', /Rana: setup 7 of 12/.test(await txt(f, rowOf('m9821'))), await txt(f, rowOf('m9821')));
      ok('demo: Samir is an offer out, Sima to propose times', /Sima to propose times/.test(await txt(f, rowOf('f801'))) && /Offer sent 22 Sep/.test(await txt(f, rowOf('f801'))), await txt(f, rowOf('f801')));
      ok('demo: Zak is behind (the section-ended rule; his 3 setup steps count, so 38 of the 41 in weeks 1 to 4)', /Behind: 38 steps overdue/.test(await txt(f, rowOf('m9812'))), await txt(f, rowOf('m9812')));
      const need = await txt(f, '#w285 .w285sec');
      ok('demo: Needs you groups the five Slack channels', /Adele Yordan, Alban Hu, Rana Bouchard and 2 more: create their Slack onboarding channels/.test(need), need);
      ok('demo: Needs you: Sima has not proposed times, with Ask Sima again', /Samir Aubert: Sima has not proposed times/.test(need) && /Ask Sima again/.test(need), need);
      ok('demo: Needs you: Zak is behind by more than a week, with Message Zak', /Zak Leon: 38 steps overdue/.test(need) && /Message Zak/.test(need), need);
      ok('demo: Needs you has no first password line when it is set', !/first password/i.test(need));
      ok('demo: Needs you: a hire asking for help (wave39), with Dealt with', /Alix Denby asked for help with Loom: .I cannot find the Loom invite./.test(need) && await has(f, '#w285 [data-w166resolve="7701"]'), need);
      await f.ev(() => { window.__RPC0 = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__RPC0.push({ fn, a }); return r0(fn, a); }; });
      await press(f, '#w285 [data-w166resolve="7701"]', 1600);
      ok('demo: Dealt with calls onboarding_help_resolve (wave166\'s handler)', (await f.ev(() => window.__RPC0.filter((x) => x.fn === 'onboarding_help_resolve' && x.a.p_id === 7701).length)) === 1);
      ok('demo: the finished count line', /2 members finished their onboarding\. See them/.test(t), t.slice(-300));
      await press(f, '#w285 [data-w285fold="t' + 'slack"]');
      ok('demo: Open the list shows the five, each with Open', (await f.ev(() => document.querySelectorAll('#w285 .w285sec .w285it [data-w285open][data-tab="su"]').length)) === 5);
      await press(f, '#w285 [data-w285fold="done"]');
      ok('demo: See them lists the finished plans', /Fin Ished/.test(await txt(f, '#w285 .w285fin')));
      await press(f, '#w285 [data-w285fold="done"]');
      await press(f, '#w285 [data-w285fold="tslack"]');
      /* the rule behind the old callers */
      const pct = await f.ev(() => wa37Pct(701));
      ok('demo: wa37Pct(Alix) = 24 of 53 (45%), headers not counted', pct.done === 24 && pct.total === 53 && pct.pct === 45, pct);
      ok('demo: her plan has 61 rows with the headers, so 8 headers never count', (await f.ev(() => WA37.steps.filter((s) => s.onboarding_id === 701).length)) === 61);
      await shot(f, 'w285-demo-1280');

      /* ---------- the panel ---------- */
      await press(f, rowOf('m9811') + ' [data-w285open]', 700);
      ok('panel: opens', await vis(f, '#w285pan.open .pn'));
      let p = await txt(f, '#w285pan .pn');
      ok('panel: Overview: name, the sub line, Now, the timeline', /ALIX DENBY|Alix Denby/i.test(p) && /Manager: Amina Dorr/.test(p) && /Day 3 of 90/.test(p) && /Now: On track/.test(p) && /Week 1: 9 of 14 done/.test(p), p.slice(0, 600));
      ok('panel: no bad words (Overview)', !BAD.test(p), (p.match(BAD) || [])[0]);
      await shot(f, 'w285-panel-overview-1280', false);
      await press(f, '#w285pan [data-w285tab="pl"]');
      p = await txt(f, '#w285pan .pn');
      ok('panel: Plan: 24 of 53 done, Weeks 1 to 4: 24 of 41', /Plan: 24 of 53 done/.test(p) && /Weeks 1 to 4: 24 of 41/.test(p), p.slice(0, 400));
      const secs = await f.ev(() => [].map.call(document.querySelectorAll('#w285pan details.w285fold'), (d) => d.querySelector('summary').innerText.replace(/\s+/g, ' ')));
      ok('panel: the sections W1 9/14, W2 9/12, W3 6/9, W4 0/6, 60 days 0/7, 90 days 0/5', ['9 of 14', '9 of 12', '6 of 9', '0 of 6', '0 of 7', '0 of 5'].every((x, i) => secs[i] && secs[i].indexOf(x + ' done') >= 0), secs);
      ok('panel: the current section (Week 1) is open, the others folded', await f.ev(() => { const d = document.querySelectorAll('#w285pan details.w285fold'); return d[0].open && ![].slice.call(d, 1).some((x) => x.open); }));
      ok('panel: a header shows as a group, not a step ("Slack" over its four)', await f.ev(() => [].some.call(document.querySelectorAll('#w285pan .w285grp'), (g) => g.textContent === 'Slack')));
      ok('panel: the role trainings button (wave279\'s pick) sits in 60 days', await has(f, '#w285pan [data-w279open="701"]'));
      ok('panel: no bad words (Plan)', !BAD.test(p), (p.match(BAD) || [])[0]);
      await shot(f, 'w285-panel-plan-1280', false);
      await press(f, '#w285pan [data-w285tab="ac"]', 1500);
      p = await txt(f, '#w285pan .pn');
      ok('panel: Academy: "Your onboarding 8 of 10", labelled Academy trainings', /Your onboarding\s*8 of 10/.test(p) && /Academy trainings \d+ of \d+/.test(p), p.slice(0, 500));
      await press(f, '#w285pan [data-w285tab="su"]');
      p = await txt(f, '#w285pan .pn');
      ok('panel: Setup for someone without a flow says why', /joined before automatic setup/.test(p), p.slice(0, 300));
      await press(f, '#w285pan .x');
      ok('panel: Close closes it', !(await vis(f, '#w285pan.open .pn')));
      /* a started hire: the actions are wave271's own */
      await press(f, rowOf('m9821') + ' [data-w285open]', 700);
      p = await txt(f, '#w285pan .pn');
      ok('panel (Rana): the actions menu: Change time, Change manager, They backed out', /Change time/.test(p) && /Change manager/.test(p) && /They backed out/.test(p), p.slice(0, 700));
      ok('panel (Rana): the card is not also in the hidden section', (await f.ev(() => document.querySelectorAll('[data-o271flow="811"]').length)) === 1);
      await press(f, '#w285pan [data-o271a="act"][data-kind="manager"]', 600);
      ok('panel (Rana): Change manager opens wave271\'s own panel in place', await has(f, '#w285pan [data-o271i="member"][data-f="811"]'));
      await press(f, '#w285pan [data-o271a="actno"]', 400);
      await press(f, '#w285pan [data-w285tab="su"]');
      p = await txt(f, '#w285pan .pn');
      ok('panel (Rana): Setup: 10 of 12 done by the Hub · 1 for HR, the Slack task open, her own setup 7 of 12', /10 of 12 done by the Hub · 1 for HR/.test(p) && /For HR/i.test(p) && /Slack channel/.test(p) && /own setup: 7 of 12/i.test(p), p.slice(0, 600));
      ok('panel (Rana): the twelve steps fold away', await has(f, '#w285pan details[data-w285f="all12"]'));
      await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
      ok('panel: Escape closes it', !(await vis(f, '#w285pan.open .pn')));
      ok('panel: closing brings the card back to wave271\'s section', (await f.ev(() => document.querySelectorAll('#o271 [data-o271flow="811"]').length)) === 1);
      /* Ask Sima again reaches onboard-run (wave275's handler) */
      await press(f, '#w285 [data-o275a="askmgr"][data-f="801"]', 800);
      ok('Needs you: Ask Sima again calls ask_manager through wave275', (await f.ev(() => window.__O271_CALLS.filter((c) => c.body && c.body.action === 'ask_manager' && c.body.flow_id === 801).length)) === 1);
      /* the sub-pages */
      await toPage(f, 'plan');
      ok('Plan template: the rail and the title say Plan template', /Plan template/.test(await txt(f, '#w153rail')) && /Plan template/i.test(await txt(f, '#hrcentre > .w118mast h1')), await txt(f, '#hrcentre > .w118mast h1'));
      ok('Plan template: the settings line has the first password, set', /First password: set on/.test(await txt(f, '#w285set')), await txt(f, '#w285set'));
      await toPage(f, 'insights');
      ok('Onboarding insights: its own page', /Onboarding insights/i.test(await txt(f, '#hrcentre > .w118mast h1')) && await vis(f, '#w285ins'), await txt(f, '#hrcentre > .w118mast h1'));
      ok('the rail: Onboarding, Plan template, Onboarding insights', await f.ev(() => /Onboarding[\s\S]*Plan template[\s\S]*Onboarding insights/.test(document.getElementById('w153rail').innerText)));
      /* the walkthrough no longer points at the picker */
      const wk = await f.ev(() => { const d = w215.defs['hrwalk-onboard']; return { s: JSON.stringify(d.steps.map((x) => x.s || '')), p: d.steps.map((x) => x.p).join(' ') }; });
      ok('walkthrough: onboarding points at the new page, not the picker or the Welcome kit', /#w285/.test(wk.s) && !/w46assign|Welcome kit/.test(wk.s + wk.p), wk.s);
      /* Applications: the hint */
      await f.hash('#hrcentre/applications', 2500);
      await f.ev(() => { try { w197.openSheet(8801); } catch (e) { /* */ } }); await f.page.waitForTimeout(500);
      const nx = await txt(f, '#w197sheet .next');
      ok('Applications: "Onboarding starts when they accept" with a link to their row', /Onboarding starts when they accept/.test(nx) && /See their onboarding/.test(nx) && !/Welcome kit|Assign an onboarding/.test(nx), nx);
      await press(f, '#w197sheet [data-w285cand="8801"]', 3500);
      ok('Applications: See their onboarding opens their row\'s panel', /Samir Aubert/i.test(await txt(f, '#w285pan.open .pn')), await txt(f, '#w285pan .pn'));
      await press(f, '#w285pan .x');
      /* the Team profile: Start an onboarding plan (onboarding_assign) */
      await f.ev(() => { window.__RPC = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__RPC.push({ fn, a }); return r0(fn, a); }; });
      await f.hash('#person/9104', 2500);
      ok('profile: Start an onboarding plan for someone without one', /Start an onboarding plan/.test(await txt(f, '#personpage .w285pbar')), await txt(f, '#personpage'));
      await press(f, '#personpage [data-w285start="9104"]');
      ok('profile: it asks first', /Start it today/.test(await txt(f, '#personpage .w285pbar')));
      await press(f, '#personpage [data-w285start="9104"][data-go="1"]', 900);
      ok('profile: Start it today calls onboarding_assign for them', (await f.ev(() => window.__RPC.filter((x) => x.fn === 'onboarding_assign' && x.a.p_member_id === 9104).length)) === 1);
      await f.hash('#person/9811', 2500);
      ok('profile: Alix\'s bar reads 24 of 53 with Open', /24 of 53 steps/.test(await txt(f, '#personpage .w285pbar')) && await has(f, '#personpage .w285pbar [data-w285open]'), await txt(f, '#personpage .w285pbar'));
    }
    if (w === 375) {
      await shot(f, 'w285-demo-375');
      await press(f, rowOf('m9811') + ' [data-w285open]', 700);
      const g = await f.ev(() => { const r = document.querySelector('#w285pan .pn').getBoundingClientRect(); return { w: r.width, iw: window.innerWidth, back: !!document.querySelector('#w285pan .back').offsetParent }; });
      ok('375: the panel is the full screen, with Back', Math.abs(g.w - g.iw) <= 1 && g.back, g);
      ok('375: the panel has no sideways scroll', await f.ev(() => { const p = document.querySelector('#w285pan .pn'); return p.scrollWidth <= p.clientWidth + 1; }));
      for (const tb of ['su', 'pl', 'ac', 'ov']) { await press(f, '#w285pan [data-w285tab="' + tb + '"]', 500); }
      ok('375: the tabs switch', /Now:/.test(await txt(f, '#w285pan .pn')));
      await shot(f, 'w285-panel-375', false);
      await press(f, '#w285pan .back');
      ok('375: Back closes it', !(await vis(f, '#w285pan.open .pn')));
    }
    await done(f);
  }
  {
    const f = await go('demo', { width: 1280 });
    await toPage(f);
    await f.ev(() => { document.documentElement.style.fontSize = '200%'; }); await f.page.waitForTimeout(500);
    await pageChecks(f, 'demo 1280 at 200% root font');
    await press(f, rowOf('m9811') + ' [data-w285open]', 700);
    ok('200%: the panel opens and has no sideways scroll', await f.ev(() => { const p = document.querySelector('#w285pan.open .pn'); return !!p && p.scrollWidth <= p.clientWidth + 1; }));
    await done(f);
  }

  /* ---------- 2. rules ---------- */
  {
    const f = await go('rules', { width: 1280 });
    await toPage(f);
    const r = await f.ev(() => ({ ada: wa37Pct(705), sam: wa37Pct(706), fay: wa37Pct(716), kofi: wa37Pct(704), alix: wa37Pct(701) }));
    ok('rule: an Academy training done but not ticked counts (Ada 2 of 3)', r.ada.done === 2 && r.ada.total === 3, r.ada);
    ok('rule: no flow, so the setup steps count; the header over two of them does not (Sam 3 of 4)', r.sam.done === 3 && r.sam.total === 4, r.sam);
    ok('rule: a flow whose setup is not finished: the setup steps do not count (Fay 0 of 3)', r.fay.done === 0 && r.fay.total === 3, r.fay);
    ok('rule: Alix 24 of 53 here too', r.alix.done === 24 && r.alix.total === 53, r.alix);
    ok('rule: Kofi, week 1 ended with 2 open: Behind: 2 steps overdue', /Behind: 2 steps overdue/.test(await txt(f, rowOf('m9814'))), await txt(f, rowOf('m9814')));
    ok('rule: Kofi is behind by 4 days, so not in Needs you (more than a week)', !/Kofi/.test(await txt(f, '#w285 .w285sec')));
    ok('rule: Alix, 45% at day 3 with no section ended, is on track (not the old pace rule)', /On track/.test(await txt(f, rowOf('m9811'))));
    ok('rule: Ada\'s row: Weeks 1 to 4: 2 of 3', /Weeks 1 to 4: 2 of 3/.test(await txt(f, rowOf('m9815'))), await txt(f, rowOf('m9815')));
    await press(f, rowOf('m9815') + ' [data-w285open]', 600);
    await press(f, '#w285pan [data-w285tab="pl"]');
    ok('rule: the panel says which step the Academy did', /done in the Academy/.test(await txt(f, '#w285pan .pn')));
    await press(f, '#w285pan .x');
    await press(f, rowOf('m9816') + ' [data-w285open]', 600);
    await press(f, '#w285pan [data-w285tab="pl"]');
    ok('rule: the panel says which steps setup covered', /done at setup/.test(await txt(f, '#w285pan .pn')));
    await press(f, '#w285pan .x');
    /* wave166's checklist: a step the rule counts is ticked and locked, with why; a header is locked */
    const ck = await f.ev(() => { const d = document.createElement('div'); d.innerHTML = wa37Checklist(WA37.onbs.filter((o) => o.id === 706)[0], true);
      const row = (tid) => d.querySelector('[data-w166t="' + tid + '"]'), box = (tid) => row(tid).querySelector('input[type=checkbox]');
      return { setupOn: box('86e1cj9gp').checked, setupOff: box('86e1cj9gp').disabled, setupWhy: row('86e1cj9gp').textContent, headOff: box('86e1cj9gj').disabled, headWhy: row('86e1cj9gj').textContent, openOff: box('w285a3').disabled }; });
    ok('checklist: a setup-covered step is ticked, locked and says "done at setup"', ck.setupOn && ck.setupOff && /done at setup/.test(ck.setupWhy) && !/Avenue Academy<|done in the Avenue Academy/.test(ck.setupWhy), ck);
    ok('checklist: a header is locked and says "done when its steps are"', ck.headOff && /done when its steps are/.test(ck.headWhy), ck);
    ok('checklist: an open step can still be ticked', !ck.openOff, ck);
    await done(f);
  }
  /* never complete or certify early (review finding 1): HR on the Plan template page, before wave271 has loaded anything */
  {
    const f = await go('rules', { width: 1280, hash: '#hrcentre/plan' });
    await f.hash('#hrcentre/plan', 2500);
    let r2 = await f.ev(() => ({ hana: wa37Pct(718), otto: wa37Pct(719), ottoRaw: wa37PctRaw(719), loaded: !!(window.o271 && o271.state().loaded) }));
    ok('never early: HR before wave271 loads, a hire made after automatic setup began: the setup steps do not count (Hana)', !r2.loaded && r2.hana.done < r2.hana.total && r2.hana.total - r2.hana.done === 4, r2);
    ok('never early: a flow more than 30 days past its call (wave271 drops it): not counted as covered (Otto)', r2.otto.done < r2.otto.total && r2.otto.total - r2.otto.done === 4, r2);
    await f.ev(() => {
      window.__UPD = []; const f0 = db.from.bind(db);
      db.from = function (t) { const b = f0(t); if (t === 'onboardings') { const u = b.update.bind(b); b.update = function (p) { window.__UPD.push(p); return u(p); }; } return b; };
      const s = WA37.steps.filter((x) => x.onboarding_id === 718 && x.template_id === '86e1cj9hh')[0];
      const c = document.createElement('input'); c.type = 'checkbox'; c.setAttribute('data-w37chk', s.id); c.checked = true; document.body.appendChild(c);
      c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await f.page.waitForTimeout(1200);
    r2 = await f.ev(() => ({ upd: window.__UPD, st: WA37.onbs.filter((o) => o.id === 718)[0].status, pct: wa37Pct(718), raw: wa37PctRaw(718) }));
    ok('never early: ticking the last open step does not complete a plan whose setup steps are open (no onboardings update)', r2.upd.length === 0 && r2.st === 'active', r2);
    await toPage(f);
    r2 = await f.ev(() => ({ otto: wa37Pct(719), loaded: !!(window.o271 && o271.state().loaded) }));
    ok('never early: Otto still not covered with wave271 loaded', r2.loaded && r2.otto.total - r2.otto.done === 4, r2);
    await done(f);
  }
  /* the hire's own view (Joy, made after automatic setup began): no completion, no certificate */
  {
    const f = await go('rules', { who: 'plain', hash: '#mypage', width: 1280 });
    await f.hash('#mypage', 1500);
    await f.ev(async () => { try { await w122.load(true); } catch (e) { /* */ } });
    await f.page.waitForTimeout(800);
    const r = await f.ev(() => { const s = w122.stats(); return { pct: wa37Pct(720), raw: wa37PctRaw(720), complete: s.onb.org.complete, cert: s.onb.cert, has: s.onb.org.has, total: s.onb.org.total, done: s.onb.org.done }; });
    ok('never early: the hire\'s own view counts her setup steps as open (4 left)', r.pct.total - r.pct.done === 4, r);
    ok('never early: the Academy does not call her plan complete or give the certificate', r.has && r.complete === false && r.cert === false, r);
    await done(f);
  }

  /* ---------- 3. worst ---------- */
  for (const w of [1280, 768, 375]) {
    const f = await go('worst', { width: w });
    await toPage(f);
    const { t } = await pageChecks(f, 'worst ' + w);
    const need = await txt(f, '#w285 .w285sec');
    if (w === 1280) {
      ok('worst: Needs you: Set the first password (admin), with a password box and no value in the page', /Set the first password/.test(need) && await has(f, '#w285 input[type=password][data-o271i="pw"]') && !(await f.ev(() => /value="[^"]+"/.test(document.querySelector('#w285 input[type=password]').outerHTML))), need.slice(0, 200));
      ok('worst: the failed Google step with Retry', /Bartholomew Fitzgerald-Northwind: Google account failed/.test(need) && await has(f, '#w285 [data-o271a="retry"][data-f="832"][data-step="google"]'), need);
      ok('worst: 1 step overdue (singular), Søren', /Søren 李 🌱 Ødegård: 1 step overdue/.test(need), need);
      ok('worst: Tri, 3 weeks behind, in Needs you', /Tri Weeks: 38 steps overdue/.test(need));
      ok('worst: the practice hire waits on HR (choose the times)', /Pat Practice: choose the times and start/.test(need), need);
      ok('worst: the backed-out hire leaves 3 things to take out', /Wes Backout backed out: take 3 things out by hand/.test(need), need);
      ok('worst: Jo has no manager and no role', /No role on file/.test(await txt(f, rowOf('m9833'))) && /No manager yet/.test(await txt(f, rowOf('m9833'))), await txt(f, rowOf('m9833')));
      ok('worst: Mo has a plan with no steps', /No plan steps yet/.test(await txt(f, rowOf('m9835'))), await txt(f, rowOf('m9835')));
      ok('worst: singular count lines', /1 member finished their onboarding\./.test(t) && /1 hire backed out in the last 30 days\./.test(t), t.slice(-400));
      ok('worst: the old-path offer is a row (Waiting on Olu to accept)', /Waiting on Olu to accept/.test(t));
      await shot(f, 'w285-worst-1280');
      await press(f, rowOf('m9832') + ' [data-w285open]', 700);
      await press(f, '#w285pan [data-w285tab="su"]');
      ok('worst: the panel\'s Setup shows the failed step open, with "I created it, continue"', /I created it, continue/.test(await txt(f, '#w285pan .pn')) && await has(f, '#w285pan [data-o271i="gaddr"][data-f="832"]'), await txt(f, '#w285pan .pn'));
      ok('worst: the long address does not widen the panel', await f.ev(() => { const p = document.querySelector('#w285pan .pn'); return p.scrollWidth <= p.clientWidth + 1; }));
      await press(f, '#w285pan .x');
      await press(f, '#w285 [data-o271a="retry"][data-f="832"]', 900);
      ok('worst: Retry calls onboard-run retry for google (wave271\'s handler)', (await f.ev(() => window.__O271_CALLS.filter((c) => c.body && c.body.action === 'retry' && c.body.flow_id === 832 && c.body.step === 'google').length)) === 1);
      await press(f, rowOf('m9832') + ' [data-w285open]', 700);
      for (const tb of ['ov', 'pl', 'ac']) { await press(f, '#w285pan [data-w285tab="' + tb + '"]', 500); const p = await txt(f, '#w285pan .pn'); ok('worst panel ' + tb + ': no bad words', !BAD.test(p), (p.match(BAD) || [])[0]); }
      await press(f, '#w285pan .x');
      await press(f, '#w285 [data-w285fold="backed"]');
      await press(f, '#w285 .w285fin [data-w285open]', 700);
      ok('worst: the backed-out hire\'s panel lists what to take out', /backed out/i.test(await txt(f, '#w285pan .pn')) && /Google account/.test(await txt(f, '#w285pan .pn')), await txt(f, '#w285pan .pn'));
      await press(f, '#w285pan .x');
      await press(f, rowOf('m9833') + ' [data-w285open]', 700);
      const jo = await txt(f, '#w285pan .pn');
      ok('worst: Jo\'s panel: No manager yet, No role on file', /No manager yet/.test(jo) && /No role on file/.test(jo), jo.slice(0, 200));
      await press(f, '#w285pan .x');
      await press(f, rowOf('m9835') + ' [data-w285open]', 700);
      await press(f, '#w285pan [data-w285tab="pl"]');
      ok('worst: Mo\'s Plan tab: no steps yet', /no steps yet/i.test(await txt(f, '#w285pan .pn')), await txt(f, '#w285pan .pn'));
    }
    if (w === 375) { await shot(f, 'w285-worst-375'); }
    await done(f);
  }

  /* ---------- 4. empty, one, forty ---------- */
  for (const w of [1280, 375]) {
    const f = await go('empty', { width: w });
    await toPage(f);
    const t = await txt(f, '#w285');
    ok('empty ' + w + ': Nothing needs you, in one line', /Needs you\s*Nothing needs you\./i.test(t), t.slice(0, 200));
    ok('empty ' + w + ': Nobody is onboarding right now', /0 onboarding/.test(t) && /Nobody is onboarding right now/.test(t), t);
    ok('empty ' + w + ': no bad words, no scroll', !BAD.test(t) && !(await hasScroll(f)));
    if (w === 1280) await shot(f, 'w285-empty-1280');
    await done(f);
  }
  for (const w of [1280, 768, 375]) {
    const f = await go('one', { width: w });
    await toPage(f);
    const { t, rows } = await pageChecks(f, 'one ' + w);
    ok('one ' + w + ': one row, "1 onboarding", Nothing needs you (the offer went out today)', rows.length === 1 && /1 onboarding/.test(t) && /Nothing needs you/.test(t), t.slice(0, 300));
    await done(f);
  }
  for (const w of [1280, 768, 375]) {
    const f = await go('forty', { width: w });
    await toPage(f);
    const { t, rows } = await pageChecks(f, 'forty ' + w);
    ok('forty ' + w + ': 40 rows, "40 onboarding"', rows.length === 40 && /40 onboarding/.test(t), [rows.length, t.slice(0, 120)]);
    if (w === 375) {
      await press(f, '#w285 .w285row:last-child [data-w285open]', 700);
      ok('forty 375: the last row opens', await vis(f, '#w285pan.open .pn'));
    }
    if (w === 1280) await shot(f, 'w285-forty-1280');
    await done(f);
  }

  /* ---------- 5. the manager's Home ---------- */
  for (const w of [1280, 375]) {
    const f = await go('home', { who: 'plain', hash: '#mypage', width: w });
    await f.hash('#mypage', 2500);
    await f.page.waitForSelector('#w285home', { timeout: 8000 }).catch(() => {});
    const t = await txt(f, '#w285home');
    ok('home ' + w + ': one card per hire (Kim, Lee, Alix)', (await f.ev(() => document.querySelectorAll('#w285home .w285hc').length)) === 3 && /Kim Newhire/.test(t) && /Lee Starter/.test(t) && /Alix Denby/.test(t), t.slice(0, 400));
    ok('home ' + w + ': whose turn: You to propose times (Kim), Lee: setup 3 of 12', /You to propose times/.test(t) && /Lee: setup 3 of 12/.test(t), t);
    ok('home ' + w + ': Alix: Weeks 1 to 4: 25 of 41 (the rule: her week 3 lesson is done in the Academy, not ticked)', /Weeks 1 to 4: 25 of 41/.test(t), t);
    if (w === 1280) homeFig = (t.match(/Weeks 1 to 4: \d+ of \d+/) || [''])[0];
    ok('home ' + w + ': Alix asked for help, with Dealt with on her card', /Asked for help with Loom/.test(t) && await has(f, '#w285home [data-w166resolve="7702"]'), t);
    ok('home ' + w + ': this week\'s moments for the manager, not later ones', /Introduce them to the team/.test(t) && /Give them a first task/.test(t) && !/two-week check-in/.test(t), t);
    ok('home ' + w + ': the 57-step list and the long cards are not shown', !(await vis(f, '#w166lead')) && !(await vis(f, '#o275mine')));
    ok('home ' + w + ': no bad words, no scroll', !BAD.test(t) && !(await hasScroll(f)), (t.match(BAD) || [])[0]);
    if (w === 1280) {
      await shot(f, 'w285-home-1280');
      await press(f, '#w285home [data-w285open][data-w285open^="f861"]', 900);
      const p = await txt(f, '#w285pan .pn');
      ok('home: Open shows the same panel, with the manager\'s own actions (Propose times)', /Kim Newhire/i.test(p) && /Propose times/.test(p), p.slice(0, 500));
      ok('home: HR\'s buttons stay off for a manager who is not HR', !/Change manager|exceptions/.test(p), p.slice(0, 500));
      await press(f, '#w285pan .x');
      /* Propose still works in the panel after wave275 draws Home again outside its painter (review finding 5) */
      await press(f, '#w285home [data-w285open^="f861"]', 900);
      await f.ev(() => { try { window.o275.paintMine(); window.o275.mount(); } catch (e) { /* */ } }); await f.page.waitForTimeout(500);
      const one = await f.ev(() => { const c = document.querySelectorAll('[data-o271flow="861"]'); return { n: c.length, inPanel: !!(c[0] && c[0].closest('#w285pan')) }; });
      ok('home: after a Home repaint the panel holds the only copy of the card', one.n === 1 && one.inPanel, one);
      await press(f, '#w285pan [data-o275a="open"][data-kind="propose"]', 1500);
      const pr = await f.ev(() => { const p = document.querySelector('#w285pan [data-o271flow="861"]'); return { grid: !!(p && p.querySelector('[data-o271cell]')), first: document.querySelector('[data-o271flow="861"]') === p }; });
      ok('home: Propose times opens its picker inside the panel, the copy the handlers find', pr.grid && pr.first, pr);
      await press(f, '#w285pan .x');
      /* a refused tick: the box comes back */
      await f.ev(() => { window.__WA_RPC_ERRORS = Object.assign(window.__WA_RPC_ERRORS || {}, { onboarding_lead_tick: 'Only the lead can tick this' }); });
      await press(f, '#w285home [data-w166tick="5101"]', 5200);
      ok('home: after a refused tick the box is unticked and can be used again', await f.ev(() => { const c = document.querySelector('#w285home [data-w166tick="5101"]'); return !!c && !c.disabled && !c.checked; }));
    } else await shot(f, 'w285-home-375');
    await done(f);
  }

  {
    const f = await go('home', { width: 1280 });
    await toPage(f);
    const hr = (await txt(f, rowOf('m9811'))).match(/Weeks 1 to 4: \d+ of \d+/);
    ok('the manager\'s figure equals HR\'s for the same hire (' + homeFig + ')', !!hr && hr[0] === homeFig, [hr && hr[0], homeFig]);
    await done(f);
  }
  const errs = allErrs.concat(allCons).filter((e) => !/favicon|ResizeObserver/.test(e));
  ok('no page or console errors', errs.length === 0, errs.slice(0, 8));
  console.log('\nw285drive: ' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
