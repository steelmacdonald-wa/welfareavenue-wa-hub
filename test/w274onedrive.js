/* w274onedrive.js: wave274 (one app), one Volunteer Manager with a Montreal | Toronto switch (Steel, 06/11/26: "there should only
   be one CRM ... we could definitely combine both Montreal and Toronto in one app but keep procedures made differently"), offline
   against the candidate (CAND=build/<file>.html). The fixture is test/w274fx.js (made-up people and events).
   Four people, each at 1366 and 390 px:
   - admin: both cities. One Volunteer Manager tile (green, the heart, "Servings and events in Montreal and Toronto"), no Toronto
     tile; Montreal the first time; the switch (the rail on a computer, the Menu sheet on a phone) by click and by keyboard; each
     city's own rail, action, title and colour; the last city remembered (the tile, after a reload); the old addresses still land.
   - opsto (a member on the Toronto team's profile): both cities, Toronto the first time; Your apps: the Volunteer Manager and the CRM.
   - mtl (a member on opsmtl, toronto 'none'): no switch, the tile opens Montreal.
   - to (a member on opsto, volunteering 'none', toronto 'all'): no switch, the tile opens Toronto.
   Always: nothing scrolls sideways (against screen.width: a phone viewport zooms out when something overflows), no page errors.
   Screenshots go to $WA_SHOTS (or $SHOTS) when set: the launcher, Home's Your apps, the rail with the switch in each city and the
   phone's menu, for admin and opsto at both widths (and the one-city people's rails).
   usage: WA_CHROME=<chrome> CAND=build/candidate.html node test/w274onedrive.js */
const { launch, fresh } = require('./boot');
const fx274 = require('./w274fx');
const { EV } = fx274;
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const SHOTS = process.env.WA_SHOTS || process.env.SHOTS || ''; if (SHOTS) require('fs').mkdirSync(SHOTS, { recursive: true });
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };

const GREEN = 'rgb(62, 124, 58)', PURPLE = 'rgb(111, 100, 171)';
const CITY = {
  volunteer: { name: 'Montreal', home: '#volunteering', rail: 'Servings*|Calendar|People|Messages|Setup', act: 'text', h1: 'Servings', line: 'MTL servings, rosters, texts and volunteers', color: GREEN, body: 'w153volunteer' },
  toronto: { name: 'Toronto', home: '#toronto', rail: 'Events*|Volunteers', act: 'newevent', h1: 'Toronto events', line: 'Toronto events, crews and volunteers', color: PURPLE, body: 'w153toronto' }
};
const P = {
  admin: { who: 'admin', cities: ['volunteer', 'toronto'], first: 'volunteer', shots: true },
  opsto: { who: 'plain', profile: 'opsto', cities: ['volunteer', 'toronto'], first: 'toronto', yours: ['volunteer', 'crm'], shots: true },
  mtl: { who: 'plain', profile: 'opsmtl', pages: { toronto: 'none' }, cities: ['volunteer'], first: 'volunteer', yours: ['volunteer'] },
  to: { who: 'plain', profile: 'opsto', pages: { volunteering: 'none', toronto: 'all' }, cities: ['toronto'], first: 'toronto', yours: ['volunteer', 'crm'] }
};
const RPCS = (who) => ({ wa_org_editor: who === 'admin', is_wa_admin: who === 'admin', is_wa_leader: false, wa_is_hr: false, is_wa_staff: true });
/* plain is a member on a team profile (boot.js gives Joy the marketing one; here the persona's); wave272's corner note counts as seen */
const INIT = (p) => (p.profile ? "window.__WAFIX.hub_roles.forEach(function (r) { if (r.email === 'joy.dumansi@welfareavenue.com') r.profile = " + JSON.stringify(p.profile) + '; });' : '') +
  "try { localStorage.setItem('wa272.tip', JSON.stringify({ n: 2, at: Date.now() })); } catch (e) {}";
/* the persona's profile with its own word for a page (a profile that names toronto decides it; wave274's torontoRule steps aside) */
const fixtureFor = (p) => { const fx = fx274(); if (p.pages) { const pr = (fx.hub_access_profiles || []).find(x => x.key === p.profile); pr.pages = Object.assign({}, pr.pages, p.pages); } return fx; };

const flat = (f) => f.ev(() => { const w = Math.min(window.innerWidth, screen.width); return document.documentElement.scrollWidth <= w + 1 && window.innerWidth <= screen.width + 1; });
const tap = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const settle = (f, ms) => f.page.waitForTimeout(ms || 1400);
/* where we are: the address, the city (wave153's current app), the rail (labels, the lit one starred), the switch, the frame's names */
const where = (f) => f.ev(() => {
  const q = (s) => document.querySelector(s), r = q('#w153rail');
  const sw = Array.from(document.querySelectorAll('#w153rail .w153city button')).map(b => ({ c: b.getAttribute('data-w153city'), l: b.textContent, p: b.getAttribute('aria-pressed'), tag: b.tagName, type: b.getAttribute('type'), bg: getComputedStyle(b).backgroundColor }));
  return {
    hash: location.hash, app: window.WA_APP.current(), body: document.body.className,
    rail: Array.from(r.querySelectorAll('.w153it')).map(a => ((a.querySelector('span') || {}).textContent || '').trim() + (a.classList.contains('on') ? '*' : '')).join('|'),
    head: (r.querySelector('.w153ah b') || {}).textContent || '', line: (r.querySelector('.w153ah small') || {}).textContent || '',
    headBg: r.querySelector('.w153ah .w153ai') ? getComputedStyle(r.querySelector('.w153ah .w153ai')).backgroundColor : '',
    group: r.querySelector('.w153city') ? [r.querySelector('.w153city').getAttribute('role'), r.querySelector('.w153city').getAttribute('aria-label')].join(':') : '',
    sw, bar: (q('#w153bar .w153bc b') || {}).textContent || '', barBg: q('#w153bar .w153bc .w153ai') ? getComputedStyle(q('#w153bar .w153bc .w153ai')).backgroundColor : '',
    acts: Array.from(document.querySelectorAll('#w153bar [data-w153act]')).map(b => b.getAttribute('data-w153act')).join(','),
    h1: (q('.panel.active > .w118mast h1') || {}).textContent || '', key: (function () { try { return localStorage.getItem(window.WA_APP.cityKey); } catch (e) { return 'x'; } })()
  };
});
/* the phone's menu (wave163's sheet) */
const openMenu = async (f) => { await f.page.click('#w163bar [data-w163slot="menu"]'); await f.page.waitForTimeout(450); };
const menu = (f) => f.ev(() => {
  const s = document.getElementById('w163sheet');
  return {
    open: !!s && s.classList.contains('on'), title: s ? s.querySelector('.hd h2').textContent : '',
    apps: s ? Array.from(s.querySelectorAll('.apps .app[data-w163app]')).map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')) : [],
    sw: s ? Array.from(s.querySelectorAll('.w153city button')).map(b => { const r = b.getBoundingClientRect(); return { c: b.getAttribute('data-w153city'), l: b.textContent, p: b.getAttribute('aria-pressed'), h: Math.round(r.height), bg: getComputedStyle(b).backgroundColor }; }) : [],
    afterBack: !!(s && s.querySelector('.back + .w153city')),
    rows: s ? Array.from(s.querySelectorAll('.bd .it .lb')).map(x => x.childNodes[0] ? x.childNodes[0].textContent.trim() : '') : []
  };
});
/* the city a person lands in, from the launcher (a computer) or Home's Your apps (a phone) */
async function openTile(f, phone) {
  if (phone) { await f.hash('#mypage', 1200); await f.page.click('#w272apps [data-w272app="volunteer"]'); }
  else { await f.hash('#mypage', 1000); await f.page.click('#w153dock .w153grid'); await f.page.waitForTimeout(350); await f.page.click('#w153pop [data-w153app="volunteer"]'); }
  await settle(f, 2200);
}
const railLabels = (c) => CITY[c].rail.replace(/\*/g, '');

async function run(browser, key, width) {
  const p = P[key], tag = key + '@' + width, phone = width < 900, both = p.cities.length > 1, other = both ? p.cities.filter(c => c !== p.first)[0] : null;
  const f = await fresh(browser, { who: p.who, width: width, hash: '#mypage', fixture: fixtureFor(p), rpcs: RPCS(p.who), init: INIT(p), wait: 5200 });
  let wide = true; const flatHere = async () => { if (!(await flat(f))) wide = false; };

  /* ---------- who sees what ---------- */
  const A = await f.ev(() => { const Y = window.WA_APP.yours(); return { cities: window.WA_APP.cities('volunteer'), tile: window.WA_APP.ok('volunteer'), order: window.WA_APP.order, yours: Y.yours, all: Y.all, frames: window.WA_APP.frames, key: localStorage.getItem(window.WA_APP.cityKey) }; });
  ok(tag + ': the cities offered are ' + p.cities.map(c => CITY[c].name).join(' and ') + ', under one Volunteer Manager (no Toronto app in the launcher\'s order)', A.tile && A.cities.join(',') === p.cities.join(',') && A.order.indexOf('toronto') < 0 && A.order.indexOf('volunteer') >= 0 && A.frames.indexOf('toronto') === A.frames.indexOf('volunteer') + 1 && A.key === null, A);
  if (p.yours) ok(tag + ': Your apps (the ' + p.profile + ' profile): ' + p.yours.join(', '), !A.all && A.yours.join(',') === p.yours.join(','), A);
  else ok(tag + ': an admin has every app, the Volunteer Manager once', A.all && A.yours.filter(x => x === 'volunteer').length === 1 && A.yours.indexOf('toronto') < 0, A);

  /* ---------- Home's Your apps ---------- */
  const H = await f.ev(() => Array.from(document.querySelectorAll('#w272apps [data-w272app]')).map(b => [b.getAttribute('data-w272app'), b.textContent.trim()]));
  const hIds = H.map(x => x[0]), hLabels = H.map(x => x[1]);
  ok(tag + ': Home\'s Your apps shows the Volunteer Manager once and no Toronto Volunteers' + (p.yours ? ' (' + p.yours.join(', ') + ', then All apps)' : ''), hIds.filter(x => x === 'volunteer').length === 1 && hIds.indexOf('toronto') < 0 && hLabels.indexOf('Toronto Volunteers') < 0 && hLabels[hIds.indexOf('volunteer')] === 'Volunteer Manager' && (!p.yours || hIds.join(',') === p.yours.concat(['*']).join(',')), H);
  if (p.shots) { await f.ev(() => { const e = document.getElementById('w272apps'); if (e) e.scrollIntoView({ block: 'center' }); }); await f.page.waitForTimeout(200); await shot(f, 'home-apps-' + tag); await f.ev(() => window.scrollTo(0, 0)); }
  await flatHere();

  /* ---------- the launcher (the 9 dots on a computer, Menu on a phone) ---------- */
  if (!phone) {
    await f.page.click('#w153dock .w153grid'); await f.page.waitForTimeout(350);
    const L = await f.ev(() => {
      const pp = document.getElementById('w153pop'), t = pp.querySelector('[data-w153app="volunteer"]');
      return { open: pp.classList.contains('open'), hs: Array.from(pp.querySelectorAll('.w153ph')).map(h => h.textContent), groups: Array.from(pp.querySelectorAll('.w153tiles')).map(g => Array.from(g.querySelectorAll('.w153tile b')).map(b => b.textContent)),
        to: !!pp.querySelector('[data-w153app="toronto"]'), blurb: t ? t.querySelector('small').textContent : '', bg: t ? getComputedStyle(t.querySelector('.w153ai')).backgroundColor : '', heart: t ? /M12 20s-7-4\.4-7-10/.test(t.querySelector('.w153ai').innerHTML) : false,
        whole: t ? t.querySelector('small').scrollWidth <= t.querySelector('small').clientWidth + 1 : false, fits: pp.scrollHeight <= pp.clientHeight + 1 };
    });
    const tiles = [].concat.apply([], L.groups);
    ok(tag + ': the launcher has one Volunteer Manager tile (green, the heart, "Servings and events in Montreal and Toronto", whole) and no Toronto Volunteers',
      L.open && tiles.filter(x => x === 'Volunteer Manager').length === 1 && tiles.indexOf('Toronto Volunteers') < 0 && !L.to && L.blurb === 'Servings and events in Montreal and Toronto' && L.bg === GREEN && L.heart && L.whole && L.fits, L);
    if (p.yours) ok(tag + ': under Your apps: the Hub, then ' + p.yours.join(', '), L.hs[0] === 'Your apps' && L.groups[0].join('|') === ['Hub'].concat(p.yours.map(x => x === 'volunteer' ? 'Volunteer Manager' : 'CRM')).join('|'), L);
    if (p.shots) await shot(f, 'launcher-' + tag);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  } else {
    await openMenu(f);
    const M = await menu(f);
    ok(tag + ': the phone\'s Menu lists the Volunteer Manager once and no Toronto Volunteers, and no switch outside the app', M.open && M.title === 'Menu' && M.apps.filter(x => x === 'Volunteer Manager').length === 1 && M.apps.indexOf('Toronto Volunteers') < 0 && !M.sw.length, M);
    if (p.shots) await shot(f, 'launcher-' + tag);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(350);
  }

  /* ---------- the tile opens the first city ---------- */
  await openTile(f, phone);
  let w = await where(f);
  const fc = CITY[p.first];
  ok(tag + ': the tile opens ' + fc.name + ' (' + (key === 'admin' ? 'the first time, by default' : key === 'opsto' ? 'the first time, the opsto profile' : 'the only city') + ')', w.hash === fc.home && w.app === p.first && w.body.indexOf(fc.body) >= 0 && w.body.indexOf(CITY[p.first === 'toronto' ? 'volunteer' : 'toronto'].body) < 0, w);
  /* each city's own rail, action, title and colour, under the one app's name */
  const cityChecks = async (c, label) => {
    const x = await where(f), C = CITY[c];
    ok(tag + ': ' + label + ': ' + C.name + '\'s own rail (' + C.rail + ') and action (' + C.act + ')', x.rail === C.rail && x.acts === C.act, x);
    ok(tag + ': ' + label + ': the app is named Volunteer Manager in the rail and the app bar, in ' + C.name + '\'s colour; the page keeps its own title (' + C.h1 + ')', x.head === 'Volunteer Manager' && x.line === C.line && x.bar === 'Volunteer Manager' && x.headBg === C.color && x.barBg === C.color && x.h1 === C.h1, x);
    if (both && !phone) ok(tag + ': ' + label + ': the switch: Montreal | Toronto, real buttons, ' + C.name + ' pressed in its colour', x.group === 'group:City' && x.sw.map(s => s.l).join('|') === 'Montreal|Toronto' && x.sw.every(s => s.tag === 'BUTTON' && s.type === 'button') && x.sw.filter(s => s.p === 'true').map(s => s.c).join() === c && x.sw.filter(s => s.p === 'true')[0].bg === C.color, x.sw);
    if (!both) ok(tag + ': ' + label + ': one city, so no switch (rail and menu)', !x.sw.length && !x.group && (await f.ev(() => !document.querySelector('.w153city'))), x);
    await flatHere();
    return x;
  };
  await cityChecks(p.first, 'first');
  if (p.shots || !both) { await f.ev(() => window.scrollTo(0, 0)); await shot(f, (phone ? 'bar-' : 'rail-') + CITY[p.first].name.toLowerCase() + '-' + tag); }
  if (phone) {
    await openMenu(f);
    const M = await menu(f);
    ok(tag + ': the phone\'s menu is the app\'s: Volunteer Manager, its tile lit, ' + (both ? 'the switch after Back to the Hub (44 px tall, ' + fc.name + ' pressed), ' : 'no switch, ') + fc.name + '\'s pages',
      M.open && M.title === 'Volunteer Manager' && M.apps.indexOf('Volunteer Manager*') >= 0 && M.rows.join('|') === railLabels(p.first) &&
      (both ? M.afterBack && M.sw.map(s => s.l).join('|') === 'Montreal|Toronto' && M.sw.every(s => s.h >= 44) && M.sw.filter(s => s.p === 'true').map(s => s.c).join() === p.first && M.sw.filter(s => s.p === 'true')[0].bg === fc.color : !M.sw.length), M);
    if (p.shots || !both) await shot(f, 'menu-' + CITY[p.first].name.toLowerCase() + '-' + tag);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(350);
  }

  if (both) {
    const oc = CITY[other];
    /* the press feedback is the only motion: scale(0.97) in 160 ms on the ease-out curve; hover only with a mouse */
    const css = await f.ev(() => {
      const b = document.querySelector('.w153city button') || (function () { const d = document.createElement('div'); d.className = 'w153city'; d.innerHTML = '<button type="button">x</button>'; document.body.appendChild(d); return d.firstChild; })();
      const cs = getComputedStyle(b), rules = [];
      Array.from(document.styleSheets).forEach(s => { try { Array.from(s.cssRules).forEach(r => { rules.push(r.cssText); }); } catch (e) { /* fine */ } });
      const all = rules.join('\n');
      return { prop: cs.transitionProperty, dur: cs.transitionDuration, ease: cs.transitionTimingFunction, active: /\.w153city button:active \{ transform: scale\(0\.97\); \}/.test(all), hover: /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.w153city button\[aria-pressed="false"\]:hover/.test(all), focus: /\.w153city button:focus-visible \{ outline: (rgb\(16, 63, 57\) solid 2px|2px solid rgb\(16, 63, 57\))/.test(all) };
    });
    ok(tag + ': the switch\'s only motion is its press (transform, 160 ms, cubic-bezier(0.23, 1, 0.32, 1), scale 0.97); hover only with a mouse; a visible focus ring', css.prop === 'transform' && css.dur === '0.16s' && css.ease === 'cubic-bezier(0.23, 1, 0.32, 1)' && css.active && css.hover && css.focus, css);

    /* ---------- the switch by click ---------- */
    if (!phone) {
      await f.page.click('#w153rail [data-w153city="' + p.first + '"]'); await settle(f, 600);
      ok(tag + ': pressing the city you are in changes nothing', (await f.ev(() => location.hash)) === fc.home, await f.ev(() => location.hash));
      await f.page.click('#w153rail [data-w153city="' + other + '"]'); await settle(f, 2200);
    } else {
      await openMenu(f);
      await f.page.click('#w163sheet [data-w153city="' + other + '"]'); await settle(f, 2200);
      ok(tag + ': a press in the phone\'s menu closes it and goes there', !(await menu(f)).open, await menu(f));
    }
    w = await where(f);
    ok(tag + ': click ' + oc.name + ': ' + oc.home + ', the ' + oc.name + ' frame (its body class), ' + oc.name + ' remembered', w.hash === oc.home && w.app === other && w.body.indexOf(oc.body) >= 0 && w.body.indexOf(fc.body) < 0 && w.key === other, w);
    await cityChecks(other, 'after the click');
    if (p.shots) {
      await f.ev(() => window.scrollTo(0, 0)); await shot(f, (phone ? 'bar-' : 'rail-') + oc.name.toLowerCase() + '-' + tag);
      if (phone) { await openMenu(f); const M2 = await menu(f); ok(tag + ': the phone\'s menu in ' + oc.name + ': ' + oc.name + ' pressed, its pages', M2.sw.filter(s => s.p === 'true').map(s => s.c).join() === other && M2.rows.join('|') === railLabels(other), M2); await shot(f, 'menu-' + oc.name.toLowerCase() + '-' + tag); await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(350); }
    }

    /* ---------- the switch by keyboard ---------- */
    if (!phone) {
      const idx = p.cities.indexOf(other);   /* the pressed button: Tab or Shift+Tab reaches the other */
      await f.ev(c => document.querySelector('#w153rail [data-w153city="' + c + '"]').focus(), other);
      await f.page.keyboard.press(idx === 0 ? 'Tab' : 'Shift+Tab');
      const k1 = await f.ev(() => ({ c: document.activeElement && document.activeElement.getAttribute('data-w153city'), fv: document.activeElement ? document.activeElement.matches(':focus-visible') : false, ol: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth : '' }));
      ok(tag + ': the keyboard reaches ' + fc.name + ' with Tab, its focus ring shows', k1.c === p.first && k1.fv && k1.ol === 'solid 2px', k1);
      await f.page.keyboard.press('Enter'); await settle(f, 2200);
      const k2 = await f.ev(() => ({ hash: location.hash, app: window.WA_APP.current(), c: document.activeElement && document.activeElement.getAttribute('data-w153city'), p: document.activeElement && document.activeElement.getAttribute('aria-pressed'), fv: document.activeElement ? document.activeElement.matches(':focus-visible') : false }));
      ok(tag + ': Enter goes to ' + fc.name + ', and the focus stays on the switch (' + fc.name + ', pressed)', k2.hash === fc.home && k2.app === p.first && k2.c === p.first && k2.p === 'true' && k2.fv, k2);
    } else {
      await openMenu(f);
      await f.ev(c => document.querySelector('#w163sheet [data-w153city="' + c + '"]').focus(), p.first);
      await f.page.keyboard.press('Space'); await settle(f, 2200);
      const k2 = await f.ev(() => ({ hash: location.hash, app: window.WA_APP.current() }));
      ok(tag + ': in the phone\'s menu the keyboard works too: Space on ' + fc.name + ' goes there', k2.hash === fc.home && k2.app === p.first && !(await menu(f)).open, k2);
    }
    await cityChecks(p.first, 'back by keyboard');

    /* ---------- the last city remembered ---------- */
    await f.ev(c => window.WA_APP.toCity(c), other); await settle(f, 1800);
    if (phone) await tap(f, '#w153dock [data-w153back]'); else await f.page.click('#w153dock [data-w153back]');   /* Back to the Hub (on a phone the menu's, the same function) */
    await settle(f, 1200);
    const back = await f.ev(() => ({ hash: location.hash, app: window.WA_APP.current() }));
    await openTile(f, phone);
    w = await where(f);
    ok(tag + ': back on the Hub (' + back.hash + '), the tile opens the last city used: ' + oc.name, !back.app && w.hash === oc.home && w.app === other && w.key === other, [back, w]);
    await f.hash('#mypage', 800);
    await f.page.reload({ waitUntil: 'domcontentloaded' });
    await f.page.waitForFunction(() => { const g = document.getElementById('gate'); return g && g.style.display === 'none'; }, null, { timeout: 30000 }); await settle(f, 5200);
    await openTile(f, phone);
    w = await where(f);
    ok(tag + ': after a reload the tile still opens ' + oc.name, w.hash === oc.home && w.app === other, w);
    await f.ev(c => window.WA_APP.toCity(c), p.first); await settle(f, 1800);
    ok(tag + ': and switching back remembers ' + fc.name, (await where(f)).key === p.first, await where(f));
  } else {
    /* one city: a city left in this browser from before (the other one, not offered now) does not move the tile */
    await f.ev(c => { try { localStorage.setItem(window.WA_APP.cityKey, c); } catch (e) { /* fine */ } }, p.first === 'toronto' ? 'volunteer' : 'toronto');
    await openTile(f, phone);
    w = await where(f);
    ok(tag + ': with one city the tile opens it, whatever this browser last used', w.hash === fc.home && w.app === p.first, w);
    const no = p.first === 'toronto' ? 'volunteer' : 'toronto';
    await f.hash(CITY[no].home, 1800);
    const x = await f.ev(() => ({ hash: location.hash, app: window.WA_APP.current() }));
    ok(tag + ': ' + CITY[no].home + ' does not open ' + CITY[no].name + ' for someone without it', x.app !== no, x);
  }

  /* ---------- every address keeps working ---------- */
  if (p.cities.indexOf('volunteer') >= 0) {
    await f.hash('#volunteering/calendar', 2000);
    w = await where(f);
    ok(tag + ': #volunteering/calendar opens Montreal with Calendar lit', w.app === 'volunteer' && w.rail === 'Servings|Calendar*|People|Messages|Setup', w);
  }
  if (p.cities.indexOf('toronto') >= 0) {
    await f.hash('#toronto/e/' + EV.next, 2200);
    w = await where(f);
    ok(tag + ': #toronto/e/<id> opens Toronto on the event (Events lit, the event\'s own title)', w.app === 'toronto' && w.rail === 'Events*|Volunteers' && w.h1 === 'Free meal event' && w.head === 'Volunteer Manager', w);
    await f.hash('#toronto/people', 2200);
    w = await where(f);
    ok(tag + ': #toronto/people opens Toronto on Volunteers', w.app === 'toronto' && w.rail === 'Events|Volunteers*' && /^Toronto volunteers/.test(w.h1), w);
  }
  await flatHere();

  ok(tag + ': nothing scrolls sideways on any screen', wide, null);
  ok(tag + ': no page errors', f.errs.length === 0, f.errs);
  await f.close();
}

(async () => {
  const browser = await launch();
  try {
    for (const key of ['admin', 'opsto', 'mtl', 'to']) for (const width of [1366, 390]) await run(browser, key, width);
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
