/* w240drive: content for each serving (wave240): the Content card in Plan (photographers or "No photographer yet", the album,
   the brief, the throwback and recap ideas for a partner serving), the editor and its save through wa240_event_content_set.
   CAND=build/candidate.html node test/w240drive.js */
const { launch, fresh } = require('./boot');
const fx191 = require('./w191fx');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const PART = { event_id: 900, active: true, partner_id: 5, partner_name: 'Oberoi Financial Group', food: 'ours', route: 'coordinator', headcount: 10, covers: { server: 4 }, signup_open: false };
function fixture(o) {
  const fx = fx191();
  if (o.partner) fx.volunteer_event_partners = [PART];
  fx.wa_partners = [{ id: 5, name: 'Oberoi Financial Group', category: 'sponsor', status: 'active' }];
  const ev = fx.volunteer_events.filter(e => e.id === 900)[0];
  if (ev && o.album) { ev.photos_album_url = o.album; ev.content_brief = { linkedin: 'Why does Oberoi serve with us?', social: 'One word for today?', notes: 'Wide shot of the line', updated_by: 'ian.odhiambo@welfareavenue.com', updated_at: '2026-09-20T12:00:00Z' }; }
  if (o.photographer) fx.event_roster.push({ id: 9201, event_id: 900, person_id: 4201, person_name: 'Pat Lens', role: 'photographer', status: o.photographer, confirm_status: o.photographer === 'Confirmed' ? 'confirmed' : null, sort: 960, detail: {} });
  return fx;
}
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 }, wa191_run_get: { plan: null, stale: null },
  wa240_event_content_set: { ok: true, album_url: 'https://photos.app.goo.gl/new', brief: { linkedin: 'Q1', social: 'Q2', notes: 'N' } }, wa240_event_ideas: { added: 2 } };
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
const openStage = (f, k) => f.ev(k => { const s = document.querySelector('#w119 .w191stage[data-stage="' + k + '"]'); if (s && !s.classList.contains('open')) s.querySelector(':scope > .h').click(); }, k);

(async () => {
  const browser = await launch();
  try {
    /* 1. a partner serving, no photographer, no album yet */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture({ partner: true }), rpcs: RPCS, width: 1440, wait: 5600 });
    await f.ev(() => { window.__calls = []; const o = db.rpc.bind(db); db.rpc = function (fn, a) { window.__calls.push([fn, a]); return o(fn, a); }; });
    await openStage(f, 'plan'); await f.page.waitForTimeout(1500);
    const where = await f.ev(() => { const c = document.getElementById('w240content'); return c ? { stage: c.closest('.w191stage').getAttribute('data-stage'), prev: c.previousElementSibling ? c.previousElementSibling.id : null } : null; });
    ok('the Content card sits in Plan after the collaboration card', where && where.stage === 'plan' && where.prev === 'w191partner', where);
    let t = await txt(f, '#w240content');
    ok('no photographer yet, with the way to find one', /No photographer yet\./.test(t) && /Find one: Volunteers > Photographers/.test(t) && /Within 5 days of the serving/.test(t), t.slice(0, 300));
    ok('the shared album until the serving has its own', /the shared Google Photos album, until this serving has its own/.test(t), t);
    ok('no brief yet', /none yet: the questions for LinkedIn/.test(t), t);
    ok('the ideas line names the partner', /Throwback and recap ideas · for Oberoi Financial Group/.test(t) && /Add them now/.test(t), t);
    /* the editor and the save */
    await f.ev(() => document.querySelector('#w240content [data-w240="edit"]').click()); await f.page.waitForTimeout(500);
    const ed = await f.ev(() => ({ album: !!document.getElementById('w240album'), li: !!document.getElementById('w240li'), so: !!document.getElementById('w240so'), no: !!document.getElementById('w240no') }));
    ok('the editor: album, LinkedIn, Instagram and TikTok, notes', ed.album && ed.li && ed.so && ed.no, ed);
    await f.page.fill('#w240album', 'http://not-secure'); await f.ev(() => document.querySelector('#w240content [data-w240="save"]').click()); await f.page.waitForTimeout(400);
    ok('an http album link is refused before saving', (await f.ev(() => window.__calls.filter(c => c[0] === 'wa240_event_content_set').length)) === 0);
    await f.page.fill('#w240album', 'https://photos.app.goo.gl/new'); await f.page.fill('#w240li', 'Q1'); await f.page.fill('#w240so', 'Q2'); await f.page.fill('#w240no', 'N');
    await f.ev(() => document.querySelector('#w240content [data-w240="save"]').click()); await f.page.waitForTimeout(900);
    const call = await f.ev(() => window.__calls.filter(c => c[0] === 'wa240_event_content_set')[0]);
    ok('saves the album and the brief', call && call[1].p_event === 900 && call[1].p.album_url === 'https://photos.app.goo.gl/new' && call[1].p.brief.linkedin === 'Q1' && call[1].p.brief.social === 'Q2' && call[1].p.brief.notes === 'N', call);
    ok('the editor closes after saving', !(await f.ev(() => !!document.getElementById('w240album'))));
    await f.ev(() => document.querySelector('#w240content [data-w240go="ideas"]').click()); await f.page.waitForTimeout(600);
    ok('Add them now calls wa240_event_ideas for the serving', await f.ev(() => window.__calls.some(c => c[0] === 'wa240_event_ideas' && c[1].p_event === 900)));
    /* the link to the photographers */
    await f.ev(() => document.querySelector('#w240content [data-w240go="photographers"]').click()); await f.page.waitForTimeout(900);
    const chips = await f.ev(() => ({ view: WA_VOL_VIEW, role: WA_VOL_ROLEFILTER, on: (document.querySelector('#volunteering .fchip.on[data-vlrole]') || {}).textContent }));
    ok('Find one opens the Volunteers list on Photographers', chips.view === 'people' && chips.role === 'photographer' && /^Photographers/.test(chips.on || ''), chips);
    ok('no page errors (1)', f.errs.length === 0, f.errs);
    await f.close();

    /* 2. a confirmed photographer, an album and a brief; no partner */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture({ photographer: 'Confirmed', album: 'https://photos.app.goo.gl/abc' }), rpcs: RPCS, width: 1440, wait: 5600 });
    await openStage(f, 'plan'); await f.page.waitForTimeout(1500);
    t = await txt(f, '#w240content');
    ok('the confirmed photographer is named', /Pat Lens · photographer, confirmed/.test(t) && !/No photographer yet/.test(t), t.slice(0, 200));
    ok('the album link and the brief are shown', /photos\.app\.goo\.gl\/abc/.test(t) && /the photographer’s page and text point here/.test(t) && /saved/.test(t) && /by ian\.odhiambo/.test(t), t);
    ok('no ideas line without a partner', !/Throwback and recap ideas/.test(t), t);
    ok('Edit the album and the brief', /Edit the album and the brief/.test(t));
    const prev = await f.ev(() => { const c = document.getElementById('w240content'); return c && c.previousElementSibling ? c.previousElementSibling.className : null; });
    ok('without a collaboration the card follows the stage line', prev === 'w191own', prev);
    ok('no page errors (2)', f.errs.length === 0, f.errs);
    await f.close();

    /* 3. a photographer not confirmed yet, phone width */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture({ photographer: 'TBD', partner: true }), rpcs: RPCS, width: 390, wait: 5600 });
    await openStage(f, 'plan'); await f.page.waitForTimeout(1500);
    t = await txt(f, '#w240content');
    ok('a photographer waiting to confirm still shows the way to find one', /Pat Lens · photographer, not confirmed yet/.test(t) && /Find one: Volunteers > Photographers/.test(t), t.slice(0, 200));
    ok('no page errors (3)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('ERROR ' + e.message); }
  console.log('w240drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
