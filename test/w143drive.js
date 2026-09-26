/* w143drive.js: the board pack card on the Board overview (wave143).
   An admin (Steel) sees Build the board pack under the next meeting; building calls board-pack and the card then links the
   agenda, the notes, the deck and the folder, with Refresh the deck numbers. A director sees the links only; a leader who is
   not on the Executive profile sees neither button. The Board overview tour gains a step. usage: node test/w143drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }
const PACK = { folder_url: 'https://drive.google.com/drive/folders/F143', agenda_url: 'https://docs.google.com/document/d/A143/edit', notes_url: 'https://docs.google.com/document/d/N143/edit',
  deck_url: 'https://docs.google.com/presentation/d/D143/edit', deck_ok: true, agenda_ok: true, notes_ok: true, built_at: '2026-09-25T20:00:00Z', built_by: 'Steel MacDonald', as_of: '25 September 2026' };
function fixture(withPack, leaderProfile) {
  const fx = loadFixture();
  const m = (fx.board_meetings || []).filter(x => x.id === 4)[0];
  if (withPack && m) Object.assign(m, { pack: PACK, agenda_url: PACK.agenda_url, notes_url: PACK.notes_url, deck_url: PACK.deck_url });
  if (leaderProfile) { const r = (fx.hub_roles || []).filter(x => x.role === 'leader')[0]; if (r) r.profile = leaderProfile; }
  return fx;
}
const MOCK = `(function(){ window.__INV = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.functions || db.functions.__w) return;
    db.functions.invoke = function (name, opts) { window.__INV.push({ name: name, body: opts && opts.body });
      return new Promise(function (res) { setTimeout(function () { res({ data: { ok: true, built: true, slides: 15, pack: ${JSON.stringify(PACK)} }, error: null }); }, 400); }); };
    db.functions.__w = 1; }, 5); })();`;
const card = f => f.ev(() => {
  const el = document.querySelector('#w126gov .w143pack'); const meet = document.querySelector('#w126gov .w126meet');
  return el ? { after: !!meet && meet.nextElementSibling === el, text: el.textContent, build: !!el.querySelector('[data-w143build]'), refresh: !!el.querySelector('[data-w143refresh]'),
    links: [...el.querySelectorAll('.links a')].map(a => a.textContent.trim() + '=' + a.getAttribute('href')), meta: (el.querySelector('.meta') || {}).textContent || '' } : null;
});

(async () => {
  const browser = await launch();
  /* Steel, an admin: build, then refresh */
  let f = await fresh(browser, { who: 'admin', hash: '#governance', fixture: fixture(false), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(800);
  let c = await card(f);
  ok('the board pack card sits under the next meeting', c && c.after, c);
  ok('before it is built: what it holds, and Build the board pack', c && c.build && !c.refresh && /Board of Directors drive/.test(c.text) && !c.links.length, c);
  await f.ev(() => document.querySelector('[data-w143build]').click());
  await f.page.waitForTimeout(150);
  const busy = await f.ev(() => { const b = document.querySelector('[data-w143build]'); return b ? { dis: b.disabled, t: b.textContent } : null; });
  ok('while it builds the button waits', busy && busy.dis && /Building/.test(busy.t), busy);
  await f.page.waitForTimeout(700);
  const inv = await f.ev(() => window.__INV);
  ok('building asks board-pack for the next meeting', inv.length === 1 && inv[0].name === 'board-pack' && inv[0].body.action === 'build' && inv[0].body.meeting_id === 4, inv);
  c = await card(f);
  ok('once built: the agenda, the notes, the deck and the folder', c && c.links.join('|') === ['Agenda=' + PACK.agenda_url, 'Meeting notes=' + PACK.notes_url, 'Deck=' + PACK.deck_url, 'Folder=' + PACK.folder_url].join('|'), c);
  ok('who built it and the date of its numbers, and Refresh the deck numbers', c && c.refresh && !c.build && /by Steel MacDonald/.test(c.meta) && /numbers as of 25 September 2026/.test(c.meta), c);
  await f.ev(() => document.querySelector('[data-w143refresh]').click());
  await f.page.waitForTimeout(800);
  const inv2 = await f.ev(() => window.__INV.map(x => x.body.action));
  ok('Refresh the deck numbers asks for a refresh', inv2.join() === 'build,refresh', inv2);
  const tour = await f.ev(() => { const T = window.w122 && window.w122.tours && window.w122.tours.governance; if (!T) return null; const s = T.steps.map(x => x.s); const i = s.indexOf('#w126gov .w143pack'); return { i, prev: s[i - 1] }; });
  ok('the Board overview tour has a step for the pack, after the next meeting', tour && tour.i > 0 && tour.prev === '#w126gov .w126meet', tour);
  await f.hash('#committees', 900); await f.hash('#governance', 1200);
  c = await card(f);
  ok('the card comes back when the board page repaints', c && c.after && c.links.length === 4, c);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* a director: the links, no buttons */
  f = await fresh(browser, { who: 'board', hash: '#governance', fixture: fixture(true), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(900);
  c = await card(f);
  ok('a director sees the pack’s links', c && c.links.length === 4, c);
  ok('a director has no build or refresh button', c && !c.build && !c.refresh, c);
  ok('no page errors (director)', f.errs.length === 0, f.errs);
  await f.close();

  /* a team leader who is not on the Executive profile: the card, no buttons */
  f = await fresh(browser, { who: 'leader', hash: '#governance', fixture: fixture(false, 'opsmtl'), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(900);
  c = await card(f);
  ok('a team leader sees what the pack is, and who builds it', c && !c.build && !c.refresh && /executive directors build it/.test(c.text), c);
  ok('no page errors (leader)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw143drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
