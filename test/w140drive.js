/* w140drive.js: Our story, Partners and the Document finder (wave140, the Drive mining).
   Fixture rows are made up for the test (no real documents). A leader sees everything, hidden moments on
   request, edits and adds; a member sees only what the database would show them (no leadership rows, no
   hidden ones, a leadership source as "A board or leadership document"); a director reads Our story and
   Partners, sees leadership sources, and has no Document finder. usage: node test/w140drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

const LEAD_SRC = { name: 'Board minutes March 2021.docx', where: 'Board of Directors', lead: true, quote: 'The first serving went ahead on 20 March.', url: 'https://docs.google.com/document/d/test-board' };
const OPEN_SRC = { name: 'Volunteer recap.docx', where: 'Operations', quote: 'We served our first meals at Place Émilie-Gamelin.', url: 'https://docs.google.com/document/d/test-recap' };
function H(id, date, prec, title, kind, o) { return Object.assign({ id, key: 'test-' + id, date_start: date, date_precision: prec, date_end: null, date_end_precision: null, title, summary: null, kind, city: 'Montreal', partners: [], numbers: null, highlight: false, visibility: 'everyone', confidence: 0.9, sources: [OPEN_SRC], status: 'published', updated_by: 'wave140' }, o || {}); }
function fixture() {
  const fx = loadFixture();
  fx.wa_history = [
    H(1, '2020-03-01', 'month', 'Welfare Avenue begins', 'milestone', { highlight: true, summary: 'A group of students start serving meals.' }),
    H(2, '2021-03-20', 'day', 'First serving at Place Émilie-Gamelin', 'event', { partners: ['Sportira'], numbers: { meals: 350, volunteers: 25 }, sources: [LEAD_SRC, OPEN_SRC] }),
    H(3, '2021-06-01', 'month', 'Summer meal program', 'program', { date_end: '2021-08-31', date_end_precision: 'month', partners: ['Vanier College Student Association'], numbers: { meals: 1200 } }),
    H(4, '2022-10-10', 'day', 'Flag football fundraiser', 'funding', { highlight: true, partners: ['Sportira', 'Delta Kappa Epsilon McGill'], numbers: { raised_cad: 2500 } }),
    H(5, '2023-11-01', 'month', 'Registered charity status', 'governance', { highlight: true, visibility: 'leadership', sources: [LEAD_SRC] }),
    H(6, '2024-05-04', 'day', 'First event in Toronto', 'expansion', { city: 'Toronto' }),
    H(7, '2025-02-01', 'month', 'A moment a leader hid', 'event', { status: 'hidden' }),
    H(8, '2026-06-01', 'month', 'Board retreat', 'governance', { visibility: 'leadership', sources: [LEAD_SRC] })
  ];
  fx.wa_history_years = [{ year: 2021, summary: 'The year the servings became weekly.', updated_by: 'wave140' }];
  const P = (id, name, status, relationship, kind, o) => Object.assign({ id, key: 'p-' + id, name, aka: [], kind, city: 'Montreal', relationship, status, first_year: 2021, last_year: 2026, summary: name + ' worked with us.', contact_role: null, visibility: 'everyone', notes: null, sources: [OPEN_SRC], updated_by: 'wave140' }, o || {});
  fx.wa_partners = [
    P(11, 'Sportira', 'active', 'sponsor', 'business', { aka: ['Sportira Inc'], notes: 'The 2022 letter is a PDF with no text.' }),
    P(12, 'Vanier College Student Association', 'active', 'funder', 'student club', { aka: ['VCSA'] }),
    P(13, 'Moisson Montréal', 'prospect', 'partner', 'nonprofit', { first_year: 2022, last_year: 2022 }),
    P(14, 'Hotel Zero1', 'past', 'venue', 'business', { first_year: 2022, last_year: 2023, category: 'collaborator' }),   /* wave163: the others have no category (read from how they help) */
    P(15, 'A company that said no', 'declined', 'sponsor', 'business'),
    P(16, 'A leadership-only funder', 'active', 'funder', 'funder', { visibility: 'leadership', sources: [LEAD_SRC] })
  ];
  const L = (id, area, lesson, o) => Object.assign({ id, key: 'l-' + id, lesson, context: null, area, topic: null, years: '2021', visibility: 'everyone', status: 'published', sources: [OPEN_SRC], updated_by: 'wave140' }, o || {});
  fx.wa_lessons = [
    L(21, 'events', 'Confirm every driver the day before a serving.', { topic: 'Driver no-shows', context: 'Two drivers did not come in March 2021.', sources: [LEAD_SRC] }),
    L(22, 'fundraising', 'Ask sponsors in August for the fall events.', { topic: 'Sponsor timing' }),
    L(23, 'volunteers', 'A lesson a leader hid.', { status: 'hidden' }),
    L(24, 'governance', 'A lesson for leaders and directors.', { visibility: 'leadership' })
  ];
  const D = (file_id, title, o) => Object.assign({ file_id, title, summary: null, doc_date: null, year: 2024, kind: 'other', team: 'general', source: 'shared_drive', location: 'General', url: 'https://docs.google.com/document/d/' + file_id, organisations: [], topics: [], reusable: false, resource_title: null, resource_what: null, visibility: 'everyone' }, o || {});
  fx.wa_documents = [
    D('f1', 'Flag football sponsorship package 2025', { summary: 'Sponsorship tiers for the flag football tournament.', year: 2025, doc_date: '2025-04-02', kind: 'proposal', team: 'fundraising', organisations: ['Sportira'], reusable: true, resource_title: 'Sponsorship package', resource_what: 'tiers and what sponsors get' }),
    D('f2', 'Volunteer driver guide', { summary: 'How drivers pick up and drop off meals.', year: 2023, kind: 'guide', team: 'opsmtl', reusable: true, resource_title: 'Driver guide', resource_what: 'the pickup route and timing' }),
    D('f3', 'Board minutes March 2021', { summary: 'The board approved the first serving.', year: 2021, kind: 'meeting notes', team: 'board', organisations: ['Sportira'], visibility: 'leadership' }),
    D('f4', 'Summer meal program poster', { summary: 'A poster for the summer meal program.', year: 2021, kind: 'posts', team: 'marketing', source: 'canva', url: 'https://www.canva.com/design/test' })
  ];
  /* the new foundations lesson, with a link to a Hub page */
  fx.trainings = (fx.trainings || []).concat([{ id: 9198, key: 'lesson:story', title: 'Our story since 2020', kind: 'lesson', category: 'Welfare Avenue', path_group: 'Welfare Avenue foundations', sort: 3, minutes: 10, xp: 60, source: 'hub', active: true,
    description: 'How a student project became a registered charity.', body: { v: 1, chapters: [{ id: 'hub', t: 'Where our story lives', blocks: [{ type: 'p', text: 'Everything is in the Hub.' }, { type: 'links', items: [{ t: 'Open Partners', d: 'Resources, then Partners', url: '#partners' }] }] }] } }]);
  /* the access profiles as the wave140 migration sets them */
  (fx.hub_access_profiles || []).forEach(p => { p.pages = Object.assign({}, p.pages, { ourstory: 'all', partners: 'all', documents: p.key === 'board' ? 'none' : 'all' }); });
  return fx;
}
const MOCK = `(function(){
  window.__W = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.from || db.from.__w) return;
    var of = db.from.bind(db);
    var f = function (table) { var b = of(table);
      ['update', 'insert', 'upsert'].forEach(function (op) { var o = b[op].bind(b); b[op] = function (p, x) { window.__W.push({ table: table, op: op, p: JSON.parse(JSON.stringify(p)) }); return o(p, x); }; });
      return b; };
    f.__w = 1; db.from = f;
  }, 5); })();`;
async function typeQ(f, which, v) { await f.ev(a => { const i = document.querySelector('[data-w140q="' + a[0] + '"]'); i.value = a[1]; i.dispatchEvent(new Event('input', { bubbles: true })); }, [which, v]); await f.page.waitForTimeout(450); }
const titles = f => f.ev(() => [...document.querySelectorAll('#ourstory .w140ev .t')].map(t => [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()));

(async () => {
  const browser = await launch();
  /* ---------------- a leader (Steel is an admin) ---------------- */
  let f = await fresh(browser, { who: 'admin', hash: '#ourstory', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(600);
  const a = await f.ev(() => ({
    h1: (document.querySelector('#ourstory > .w118mast h1') || {}).textContent,
    stats: [...document.querySelectorAll('#ourstory .w140stats .w140st b')].map(b => b.textContent),
    statTxt: (document.querySelector('#ourstory .w140stats .w140st span') || {}).textContent,
    hl: document.querySelectorAll('#ourstory .w140hc').length,
    years: [...document.querySelectorAll('#ourstory .w140year h2')].map(h => h.textContent),
    y2021: ((document.querySelector('#w140y2021 .yh p') || {}).textContent || ''),
    ev: document.querySelectorAll('#ourstory .w140ev').length,
    hidBtn: ((document.querySelector('[data-w140hidden]') || {}).textContent || '').trim(),
    add: !!document.querySelector('[data-w140add="hist"]'), edits: document.querySelectorAll('[data-w140edit="hist"]').length
  }));
  ok('Our story opens with its masthead', a.h1 === 'Our story', a);
  ok('the stats count the years, the moments, the partners and the lessons (hidden ones left out)', a.stats.join('|') === '7|7|4|3' && /2020 to 2026/.test(a.statTxt), a);
  ok('the milestones strip shows the three highlights', a.hl === 3, a);
  ok('a section per year, with the year summary', a.years.join(',') === '2020,2021,2022,2023,2024,2026' && /weekly/.test(a.y2021), a);
  ok('a leader sees every published moment, can add and edit, and can show the hidden one', a.ev === 7 && a.add && a.edits === 7 && /Show hidden \(1\)/.test(a.hidBtn), a);
  await f.ev(() => document.querySelector('[data-w140hidden]').click()); await f.page.waitForTimeout(200);
  const b = await f.ev(() => ({ ev: document.querySelectorAll('#ourstory .w140ev').length, hid: document.querySelectorAll('#ourstory .w140ev.hid').length, tag: ((document.querySelector('#ourstory .w140ev.hid .w140tag.hid') || {}).textContent || '') }));
  ok('Show hidden adds the hidden moment, marked Hidden', b.ev === 8 && b.hid === 1 && b.tag === 'Hidden', b);
  await f.ev(() => document.querySelector('[data-w140hidden]').click()); await f.page.waitForTimeout(150);
  await f.ev(() => document.querySelector('[data-w140kind="funding"]').click()); await f.page.waitForTimeout(150);
  let t = await titles(f);
  ok('a kind chip shows only that kind', t.length === 1 && t[0] === 'Flag football fundraiser', t);
  await f.ev(() => document.querySelector('[data-w140kind=""]').click()); await f.page.waitForTimeout(150);
  await typeQ(f, 'story', 'emilie');
  t = await titles(f);
  ok('search ignores accents (emilie finds Émilie)', t.length === 1 && /milie-Gamelin/.test(t[0]), t);
  await typeQ(f, 'story', '');
  const c = await f.ev(() => { const li = [...document.querySelectorAll('#w140e2 .w140src li')]; return { n: li.length, lk: li.filter(x => x.classList.contains('lk')).length, first: (li[0] || {}).textContent }; });
  ok('a leader sees the name of a leadership source', c.n === 2 && c.lk === 0 && /Board minutes March 2021/.test(c.first || ''), c);
  const m = await f.ev(() => (document.querySelector('#w140e3 .w140m') || {}).textContent || '');
  ok('a moment that ran a while shows its range and its numbers', /June 2021 to August 2021/.test(m) && /1,200 meals/.test(m), m);

  /* edit a moment: the numbers keep what the form does not change; the row updates in place */
  await f.ev(() => document.querySelector('[data-w140edit="hist"][data-id="2"]').click()); await f.page.waitForTimeout(200);
  const e0 = await f.ev(() => { const s = document.getElementById('w140sheet'); const v = n => (s.querySelector('[data-f="' + n + '"]') || {}).value; return { date: v('date'), meals: v('n_meals'), vols: v('n_volunteers'), title: v('title') }; });
  ok('the edit form opens with the moment as typed (date, numbers)', e0.date === '2021-03-20' && e0.meals === '350' && e0.vols === '25', e0);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="n_volunteers"]').value = 'lots'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(200);
  const e1 = await f.ev(() => ({ err: (document.querySelector('#w140sheet [data-w140err]') || {}).textContent, writes: window.__W.filter(x => /^wa_/.test(x.table)).length }));
  ok('a number field refuses words', /Volunteers takes a number only/.test(e1.err || '') && e1.writes === 0, e1);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="n_volunteers"]').value = '25'; s.querySelector('[data-f="n_meals"]').value = '1,200'; s.querySelector('[data-f="title"]').value = 'First serving at Place Émilie-Gamelin (a Saturday)'; s.querySelector('[data-w140save]').click(); });
  await f.page.waitForTimeout(400);
  const e2 = await f.ev(() => ({ w: window.__W.filter(x => x.table === 'wa_history'), open: !!document.querySelector('#w140sheet .sh'), rows: document.querySelectorAll('#ourstory [data-w140id="2"]').length, t: ((document.querySelector('#w140e2 .t') || {}).textContent || '') }));
  const u = (e2.w[0] || {}).p || {};
  ok('saving updates wa_history with who changed it and the numbers', e2.w.length === 1 && e2.w[0].op === 'update' && /^Steel/.test(u.updated_by || '') && u.numbers && u.numbers.meals === 1200 && u.numbers.volunteers === 25 && u.date_start === '2021-03-20' && u.date_precision === 'day', e2.w);
  ok('the moment updates in place (no duplicate) and the sheet closes', !e2.open && e2.rows === 1 && /a Saturday/.test(e2.t), e2);

  /* add a moment: dates are checked */
  await f.ev(() => document.querySelector('[data-w140add="hist"]').click()); await f.page.waitForTimeout(200);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="date"]').value = '2021-02-30'; s.querySelector('[data-f="title"]').value = 'A test moment'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(150);
  const g0 = await f.ev(() => (document.querySelector('#w140sheet [data-w140err]') || {}).textContent || '');
  ok('a date that does not exist is refused', /Give the date as/.test(g0), g0);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="date"]').value = '2021-04'; s.querySelector('[data-f="date_end"]').value = '2021-03'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(150);
  const g1 = await f.ev(() => (document.querySelector('#w140sheet [data-w140err]') || {}).textContent || '');
  ok('an end before the start is refused', /end date comes before/.test(g1), g1);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="date_end"]').value = '2021-05'; s.querySelector('[data-f="partners"]').value = 'Sportira, Hotel Zero1'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(400);
  const g2 = await f.ev(() => { const w = window.__W.filter(x => x.table === 'wa_history' && x.op === 'insert'); return { w: w.map(x => x.p), n: document.querySelectorAll('#ourstory .w140ev').length }; });
  const ins = g2.w[0] || {};
  ok('a new moment is inserted with a month precision, an end, its organisations and a key', g2.w.length === 1 && ins.date_start === '2021-04-01' && ins.date_precision === 'month' && ins.date_end === '2021-05-31' && ins.partners.join('|') === 'Sportira|Hotel Zero1' && /^hub-/.test(ins.key) && /^Steel/.test(ins.created_by || '') && ins.created_by === ins.updated_by, g2);
  ok('the new moment shows in the timeline', g2.n === 8, g2);

  /* a year line */
  await f.ev(() => document.querySelector('[data-w140edit="year"][data-id="2022"]').click()); await f.page.waitForTimeout(200);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="summary"]').value = 'The year of the first flag football tournament.'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(400);
  const y = await f.ev(() => ({ w: window.__W.filter(x => x.table === 'wa_history_years').map(x => x.op + ':' + x.p.year), p: ((document.querySelector('#w140y2022 .yh p') || {}).textContent || '') }));
  ok('a leader writes the line for a year (upsert) and it shows at the head of the year', y.w.join() === 'upsert:2022' && /first flag football/.test(y.p), y);

  /* a partner from a moment */
  await f.ev(() => document.querySelector('#w140e4 [data-w140partner="11"]').click()); await f.page.waitForTimeout(1500);
  const p = await f.ev(() => { const s = document.querySelector('#w140sheet .sh'); return { hash: location.hash, name: s && (s.querySelector('h2') || {}).textContent, story: s ? [...s.querySelectorAll('[data-w140go^="#ourstory/e/"]')].map(b => b.textContent) : [], docs: s ? [...s.querySelectorAll('h4 + .row a, .row a')].map(a => a.textContent) : [], note: s ? s.textContent.indexOf('Good to know') >= 0 : false }; });
  ok('a partner in a moment opens its page and sheet', p.hash === '#partners/11' && p.name === 'Sportira', p);
  ok('the sheet lists the moments and the documents that name the partner, and the notes', p.story.length === 3 && p.docs.indexOf('Flag football sponsorship package 2025') >= 0 && p.docs.indexOf('Board minutes March 2021') >= 0 && p.note, p);
  await f.ev(() => document.querySelector('#w140sheet [data-w140go="#ourstory/e/4"]').click()); await f.page.waitForTimeout(1400);
  const back = await f.ev(() => ({ hash: location.hash, sheet: !!document.querySelector('#w140sheet .sh'), flash: !!document.querySelector('#w140e4.flash') }));
  ok('a moment in the partner sheet goes back to it in the story', back.hash === '#ourstory/e/4' && !back.sheet && back.flash, back);

  /* partners */
  await f.hash('#partners', 1200);
  const q = await f.ev(() => ({ cards: [...document.querySelectorAll('#partners .w140pc .nm')].map(x => x.textContent), stats: [...document.querySelectorAll('#partners .w140stats b')].map(b => b.textContent) }));
  ok('Partners opens on the ones we worked with (active, then past)', q.cards.length === 4 && q.cards[q.cards.length - 1] === 'Hotel Zero1' && q.stats.join('|') === '3|1|1|1', q);
  await f.ev(() => document.querySelector('.w140chip[data-w140pset="prospect"]').click()); await f.page.waitForTimeout(150);
  const q2 = await f.ev(() => [...document.querySelectorAll('#partners .w140pc .nm')].map(x => x.textContent));
  ok('the Prospects chip shows the ones we approached', q2.length === 1 && q2[0] === 'Moisson Montréal', q2);
  await f.ev(() => document.querySelector('.w140chip[data-w140pset="all"]').click()); await f.page.waitForTimeout(150);
  await typeQ(f, 'partners', 'vcsa');
  const q3 = await f.ev(() => [...document.querySelectorAll('#partners .w140pc .nm')].map(x => x.textContent));
  ok('partner search finds another name a partner goes by', q3.length === 1 && q3[0] === 'Vanier College Student Association', q3);

  /* wave163: partner, collaborator, sponsor */
  await typeQ(f, 'partners', '');
  await f.ev(() => document.querySelector('.w140chip[data-w140pset="worked"]').click()); await f.page.waitForTimeout(150);
  const ty = await f.ev(() => ({ tabs: [...document.querySelectorAll('#partners .w140ty')].map(b => b.textContent.replace(/\s+/g, ' ').trim() + (b.classList.contains('on') ? '*' : '')), def: (document.querySelector('#partners .w140def') || {}).textContent || '',
    tags: [...document.querySelectorAll('#partners .w140pc')].map(c => c.querySelector('.nm').textContent + ':' + [...c.querySelectorAll('.ft .w140tag')].map(t => t.textContent.trim()).join('/')) }));
  ok('the type switch: Everyone, Partners, Collaborators and Sponsors, counted within Worked with us', ty.tabs.join('|') === 'Everyone 4*|Partners 0|Collaborators 1|Sponsors 3' && /collaborators/.test(ty.def) && /sponsors/.test(ty.def), ty);
  ok('each card names its type, then the detail when it adds one (a funder, a venue)', ty.tags.indexOf('Sportira:Sponsor') >= 0 && ty.tags.indexOf('Vanier College Student Association:Sponsor/Funder') >= 0 && ty.tags.indexOf('Hotel Zero1:Collaborator/Venue') >= 0, ty.tags);
  await f.ev(() => document.querySelector('#partners [data-w140pcat="sponsor"]').click()); await f.page.waitForTimeout(150);
  const ty2 = await f.ev(() => ({ cards: [...document.querySelectorAll('#partners .w140pc .nm')].map(x => x.textContent).sort(), def: (document.querySelector('#partners .w140def') || {}).textContent || '', pressed: (document.querySelector('#partners .w140ty.on') || {}).getAttribute('aria-pressed'), chips: [...document.querySelectorAll('#partners .w140chip[data-w140pset]')].map(c => c.textContent.replace(/\s+/g, ' ').trim()) }));
  ok('Sponsors shows the sponsors only, says what a sponsor is, and the status chips count sponsors', ty2.cards.join('|') === 'A leadership-only funder|Sportira|Vanier College Student Association' && /^A sponsor gives money/.test(ty2.def) && ty2.pressed === 'true' && ty2.chips.join('|') === 'Worked with us 3|Active 3|Past 0|Prospects 0|Declined 1|All 4', ty2);
  await f.ev(() => document.querySelector('#partners [data-w140pcat="all"]').click()); await f.page.waitForTimeout(100);
  await f.ev(() => document.querySelector('.w140chip[data-w140pset="all"]').click()); await f.page.waitForTimeout(100);
  await typeQ(f, 'partners', 'collaborator');
  const ty3 = await f.ev(() => [...document.querySelectorAll('#partners .w140pc .nm')].map(x => x.textContent));
  ok('search finds a partner by its type', ty3.length === 1 && ty3[0] === 'Hotel Zero1', ty3);
  await typeQ(f, 'partners', '');
  await f.hash('#partners/14', 1200);
  const sh = await f.ev(() => { const s = document.getElementById('w140sheet'); return { rows: s ? [...s.querySelectorAll('.row')].map(r => [...r.children].map(c => c.textContent.trim()).join(': ')) : [], sub: s ? ((s.querySelector('.sub') || {}).textContent || '') : '' }; });
  ok('the sheet says the type first, with the detail', sh.rows[0] === 'Type: Collaborator (venue)' && /Collaborator/.test(sh.sub), sh);
  await f.ev(() => document.querySelector('#w140sheet [data-w140edit="partner"]').click()); await f.page.waitForTimeout(250);
  const ed = await f.ev(() => { const s = document.getElementById('w140sheet'); const c = s && s.querySelector('[data-f="category"]'); return { has: !!c, v: c && c.value, opts: c ? [...c.options].map(o => o.textContent) : [] }; });
  ok('the edit form has a Type (partner, collaborator, sponsor) set to the partner\'s', ed.has && ed.v === 'collaborator' && ed.opts.join('|') === 'Partner|Collaborator|Sponsor', ed);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="relationship"]').value = 'funder'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(200);
  const er = await f.ev(() => (document.querySelector('#w140sheet [data-w140err]') || {}).textContent || '');
  ok('a funder that is not a sponsor is refused', /is a sponsor/.test(er), er);
  await f.ev(() => { const s = document.getElementById('w140sheet'); s.querySelector('[data-f="category"]').value = 'sponsor'; s.querySelector('[data-w140save]').click(); }); await f.page.waitForTimeout(450);
  const up = await f.ev(() => window.__W.filter(x => x.table === 'wa_partners').map(x => ({ op: x.op, p: x.p })));
  const last = up.length ? up[up.length - 1].p : {};
  ok('saving writes the type (category) with the detail', last.category === 'sponsor' && last.relationship === 'funder', up);
  await f.hash('#partners', 1000);
  const ty4 = await f.ev(() => { const c = [...document.querySelectorAll('#partners .w140pc')].filter(x => x.querySelector('.nm').textContent === 'Hotel Zero1')[0]; return c ? [...c.querySelectorAll('.ft .w140tag')].map(t => t.textContent.trim()).join('/') : null; });
  ok('the card follows the edit', ty4 === 'Sponsor/Funder', ty4);

  /* documents */
  await f.hash('#documents', 1200);
  const d = await f.ev(() => ({ n: document.querySelectorAll('#documents .w140doc').length, count: (document.querySelector('#documents .w140count') || {}).textContent, cv: !!document.querySelector('#documents .w140doc .ic.cv'), lead: document.querySelectorAll('#documents .w140tag.lead').length, kinds: [...document.querySelectorAll('[data-w140dkind] option')].map(o => o.textContent) }));
  ok('the finder lists every document for a leader, leadership ones marked', d.n === 4 && d.lead === 1 && /leaders only/.test(d.count || ''), d);
  ok('a Canva design shows as one, and posters have a kind of their own', d.cv && d.kinds.indexOf('Posts and posters') >= 0, d);
  await typeQ(f, 'docs', 'flag football sponsorship');
  const d2 = await f.ev(() => [...document.querySelectorAll('#documents .w140doc .tt')].map(x => x.textContent.trim()));
  ok('search finds the sponsorship package first', d2[0] === 'Flag football sponsorship package 2025', d2);
  await typeQ(f, 'docs', '');
  await f.ev(() => document.querySelector('[data-w140dreuse]').click()); await f.page.waitForTimeout(150);
  const d3 = await f.ev(() => [...document.querySelectorAll('#documents .w140doc .tt')].map(x => x.textContent.trim()).sort());
  ok('Guides and templates to reuse keeps the two reusable ones', d3.length === 2 && d3[0] === 'Flag football sponsorship package 2025' && d3[1] === 'Volunteer driver guide', d3);
  await f.ev(() => document.querySelector('[data-w140dreuse]').click());
  await f.hash('#documents/q/driver', 1200);
  const d4 = await f.ev(() => ({ first: ((document.querySelector('#documents .w140doc .tt') || {}).textContent || '').trim(), q: (document.querySelector('[data-w140q="docs"]') || {}).value }));
  ok('#documents/q/<words> opens the finder on that search', d4.first === 'Volunteer driver guide' && d4.q === 'driver', d4);

  /* lessons */
  await f.hash('#ourstory/lessons', 1200);
  const l = await f.ev(() => ({ on: ((document.querySelector('#ourstory .w140tabs .on') || {}).textContent || '').trim(), n: document.querySelectorAll('#ourstory .w140lc').length, hid: document.querySelectorAll('#ourstory .w140lc.hid').length, add: !!document.querySelector('[data-w140add="lesson"]') }));
  ok('Lessons learned opens its tab; a leader sees all four, the hidden one marked', /Lessons learned/.test(l.on) && l.n === 4 && l.hid === 1 && l.add, l);
  await f.ev(() => document.querySelector('[data-w140area="fundraising"]').click()); await f.page.waitForTimeout(150);
  const l2 = await f.ev(() => [...document.querySelectorAll('#ourstory .w140lc .ls')].map(x => x.textContent));
  ok('an area chip shows that area only', l2.length === 1 && /August/.test(l2[0]), l2);

  /* a Hub page link in a lesson opens the page here, and the lesson closes */
  await f.hash('#training/t/9198', 1600);
  const k0 = await f.ev(() => { const a = document.querySelector('#w122sheet a.lnk2[href="#partners"]'); return { link: !!a, target: a && a.getAttribute('target') }; });
  await f.ev(() => { const a = document.querySelector('#w122sheet a.lnk2[href="#partners"]'); if (a) a.click(); });
  await f.page.waitForTimeout(1500);
  const k1 = await f.ev(() => ({ hash: location.hash, pages: window.__w140opened || null, lesson: !!document.querySelector('#w122sheet.on.in'), active: (document.querySelector('.panel.active') || {}).id, tabs: document.querySelectorAll('.w140pc').length }));
  ok('a Hub page link in a lesson opens that page in the Hub and closes the lesson', k0.link && k1.hash === '#partners' && !k1.lesson && k1.active === 'partners' && k1.tabs > 0, { k0, k1 });
  /* the menu and the tours */
  const n = await f.ev(() => {
    const g = id => { const b = document.querySelector('#tabBar .tab[data-tab="' + id + '"]'); const grp = b && b.closest('.tab-group'); return b ? { label: b.textContent.trim(), group: grp ? grp.getAttribute('data-w42g') : null } : null; };
    const T = (window.w122 && window.w122.tours) || {};
    return { story: g('ourstory'), partners: g('partners'), docs: g('documents'), crm: !!(window.WA_APP && window.WA_APP.apps.crm.pages.indexOf('partners') >= 0), tours: ['ourstory', 'partners', 'documents'].map(k => T[k] ? T[k].steps.length : 0) };
  });
  ok('wave163: Our story sits in Organization, the Document finder in Other Tools, Partners in the CRM (out of the menu)', n.story && n.story.label === 'Our story' && n.story.group === 'org' && n.docs && n.docs.label === 'Document finder' && n.docs.group === 'tools' && n.partners && n.partners.group === 'apps' && n.crm, n);
  ok('each page has its tour (Partners with its types stop)', n.tours.join() === '7,5,4', n);
  const tourSel = await f.ev(async () => {
    const miss = [];
    for (const k of ['ourstory', 'partners', 'documents']) {
      location.hash = window.w122.tours[k].hash; await new Promise(r => setTimeout(r, 900));
      window.w122.tours[k].steps.forEach(s => { if (!document.querySelector(s.s)) miss.push(k + ': ' + s.s); });
    }
    return miss;
  });
  ok('every tour step points at something on its page', tourSel.length === 0, tourSel);
  ok('no page errors (leader)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a member ---------------- */
  f = await fresh(browser, { who: 'member', hash: '#ourstory', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(600);
  const r = await f.ev(() => ({
    allowed: typeof wa40Allowed === 'function' ? ['ourstory', 'partners', 'documents'].map(t => wa40Allowed().indexOf(t) >= 0) : null,
    ev: [...document.querySelectorAll('#ourstory .w140ev')].map(x => x.getAttribute('data-w140id')),
    stats: [...document.querySelectorAll('#ourstory .w140stats .w140st b')].map(b => b.textContent),
    edit: document.querySelectorAll('[data-w140edit],[data-w140add],[data-w140hidden]').length,
    lk: [...document.querySelectorAll('#w140e2 .w140src li')].map(li => li.classList.contains('lk') ? 'lock:' + li.textContent : li.textContent.slice(0, 20))
  }));
  ok('a member has the three pages', r.allowed && r.allowed.every(Boolean), r);
  ok('a member sees no hidden and no leadership moments', r.ev.join() === '1,2,3,4,6' && r.stats[1] === '5', r);
  ok('a member has no edit, add or show-hidden buttons', r.edit === 0, r);
  ok('a leadership source shows as "A board or leadership document"', r.lk.length === 2 && r.lk[0] === 'lock:A board or leadership document' && /^Volunteer recap/.test(r.lk[1]), r);
  await f.hash('#partners', 1200);
  const r2 = await f.ev(() => [...document.querySelectorAll('#partners .w140pc .nm')].map(x => x.textContent));
  ok('a member does not see a leadership-only partner', r2.length === 3 && r2.indexOf('A leadership-only funder') < 0, r2);
  await f.hash('#documents', 1200);
  const r3 = await f.ev(() => ({ t: [...document.querySelectorAll('#documents .w140doc .tt')].map(x => x.textContent.trim()), count: (document.querySelector('#documents .w140count') || {}).textContent }));
  ok('a member never sees a leadership document in the finder', r3.t.length === 3 && r3.t.indexOf('Board minutes March 2021') < 0 && !/leaders only/.test(r3.count || ''), r3);
  await f.hash('#ourstory/lessons', 1200);
  const r4 = await f.ev(() => ({ n: document.querySelectorAll('#ourstory .w140lc').length, add: !!document.querySelector('[data-w140add]') }));
  ok('a member reads the two published lessons for everyone', r4.n === 2 && !r4.add, r4);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------------- a director (board viewer) ---------------- */
  f = await fresh(browser, { who: 'board', hash: '#ourstory', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(800);
  const s = await f.ev(() => ({
    allowed: typeof wa40Allowed === 'function' ? ['ourstory', 'partners', 'documents'].map(t => wa40Allowed().indexOf(t) >= 0) : null,
    shown: (document.getElementById('ourstory') || {}).offsetParent !== null,
    ev: [...document.querySelectorAll('#ourstory .w140ev')].map(x => x.getAttribute('data-w140id')),
    edit: document.querySelectorAll('[data-w140edit],[data-w140add],[data-w140hidden]').length,
    lk: document.querySelectorAll('#ourstory .w140src li.lk').length
  }));
  ok('a director has Our story and Partners, not the Document finder', s.allowed && s.allowed.join() === 'true,true,false', s);
  ok('a director reads every published moment, leadership ones too, and their sources', s.shown && s.ev.join() === '1,2,3,4,5,6,8' && s.lk === 0, s);
  ok('a director cannot edit', s.edit === 0, s);
  await f.hash('#partners/16', 1400);
  const s2 = await f.ev(() => ({ name: ((document.querySelector('#w140sheet h2') || {}).textContent || ''), docs: document.querySelector('#w140sheet') ? document.querySelector('#w140sheet').textContent.indexOf('In our documents') >= 0 : null }));
  ok('a director opens a leadership partner, without the documents list', s2.name === 'A leadership-only funder' && s2.docs === false, s2);
  ok('no page errors (director)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw140drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
