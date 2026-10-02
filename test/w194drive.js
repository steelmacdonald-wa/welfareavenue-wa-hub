/* w194drive.js: wave194. Steel (02/10/26): Updated since you finished asks people to open the changed step (its module, its
   avenue, or the step in their plan) before they can close it; and the Avenue Academy's certificate in the brand with his
   signature (Steel MacDonald, Founder and Chair).
   Checks: the card lists the changed steps with Open the module / Open the step / Open the avenue and no Got it; a step
   already acknowledged at its version stays away; opening saves onboarding_update_opens (the version) and opens the module
   with the gold bar; back on the card the row shows Open it again and Close; Close writes onboarding_update_acks and the
   row goes; Open the step opens the plan at that step (its week chosen, the row marked) with the bar and the step's words;
   Close the update from the bar; the avenue opens with the bar; a saved open from another device brings Close at once, an
   open of an older version does not; the Classic view has the same buttons; the certificate (band, logo, AVENUE ACADEMY,
   the seal, the name, what was completed, the signature with the name and title, the date, the number); an admin's
   Signature editor (a new picture is cleaned, Save writes cert_signature); a member has no Signature button; print writes
   an A4 landscape page with the brand fonts and exact colours; a phone stacks the certificate; no page errors.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build.
   Screenshots go to SHOTS=<dir> when set. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS || '';
const BRAND = process.env.BRAND || '/tmp/claude-0/-home-claude/3912322f-6caa-56d4-8fe4-e85725c589cb/scratchpad/brand';
const SIG = process.env.SIGJSON || '';

const V_LOOP = '2026-09-20T10:00:00+00:00', V_VOL = '2026-09-21T10:00:00+00:00', V_PICK = '2026-09-22T10:00:00+00:00', V_ACKED = '2026-09-19T10:00:00+00:00';
function sigValue() {
  if (SIG && fs.existsSync(SIG)) return fs.readFileSync(SIG, 'utf8');
  /* a small stand-in signature (a dark stroke on a clear background) */
  return JSON.stringify({ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGklEQVQYV2NkYGD4z8DAwMgABYwMDAwMRAQAJQUBB6BLuQ0AAAAASUVORK5CYII=', name: 'Steel MacDonald', title: 'Founder and Chair', org: 'Welfare Avenue' });
}
function fx(o) {
  o = o || {};
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  const T = id => f.onboarding_template.filter(t => t.id === id)[0];
  Object.assign(T('86e1cj9gn'), { name: 'The Loop: I’m in, close the loop (every time you work)', training_id: 1001, academy_path: null, updated_at: V_LOOP, description: 'Press **I’m in** when you start and **Close the loop** when you finish.' });
  Object.assign(T('86e1cj9hg'), { training_id: null, academy_path: null, updated_at: V_VOL, description: 'Serve at least once in your first month.\n\n**To complete this step:** sign up for a serving in the Volunteer Manager.' });
  Object.assign(T('86e1cj9j0'), { training_id: null, academy_path: 'foundations', updated_at: V_PICK });
  Object.assign(T('86e1cj9h6'), { updated_at: V_ACKED });   /* changed, but already acknowledged at this version */
  f.onboarding_update_acks = (f.onboarding_update_acks || []).concat([{ id: 50, onboarding_id: 1, template_id: '86e1cj9h6', template_updated_at: V_ACKED, acked_by: 'Steel', acked_at: '2026-09-19T12:00:00+00:00' }]);
  f.onboarding_update_opens = o.opens || [];
  f.academy_awards = (f.academy_awards || []).concat([
    { id: 70, person_name: 'Steel', email: 'steel.macdonald@welfareavenue.com', award: 'cert:onboarding', kind: 'cert', title: 'Welfare Avenue Onboarding', detail: 'Onboarding', meta: { path: 'onboarding' }, earned_at: '2026-08-04T16:00:00+00:00' },
    { id: 71, person_name: 'Joy', email: 'joy.dumansi@welfareavenue.com', award: 'cert:foundations', kind: 'cert', title: 'Welfare Avenue Foundations', detail: 'Welfare Avenue foundations', meta: { path: 'foundations' }, earned_at: '2026-09-10T16:00:00+00:00' }
  ]);
  f.team_members = (f.team_members || []).concat([{ id: 90, name: 'Joy', email: 'joy.dumansi@welfareavenue.com', department: 'marketing', role: 'Content creator', active: true }]);
  f.app_config = (f.app_config || []).filter(r => r.key !== 'cert_signature').concat(o.noSig ? [] : [{ key: 'cert_signature', value: sigValue() }]);
  return f;
}
async function brandRoutes(page) {
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/**', route => {
    const name = route.request().url().split('/').pop().split('?')[0], fp = path.join(BRAND, name);
    if (!fs.existsSync(fp)) return route.abort();
    return route.fulfill({ contentType: /\.svg$/.test(name) ? 'image/svg+xml' : 'image/png', body: fs.readFileSync(fp) });
  });
}
async function recorder(f) {
  await f.ev(() => {
    window.__writes = [];
    const P = Object.getPrototypeOf(db.from('x'));
    ['insert', 'upsert', 'update', 'delete'].forEach(op => {
      const o = P[op];
      P[op] = function (payload, opts) { window.__writes.push({ table: this._table, op, payload: payload === undefined ? null : JSON.parse(JSON.stringify(payload)), opts: opts || null }); return o.apply(this, arguments); };
    });
  });
}
const writes = f => f.ev(() => window.__writes || []);
const toastText = f => f.ev(() => { const t = document.getElementById('toast') || document.querySelector('.toast'); return t ? t.textContent : ''; });
const card = f => f.ev(() => {
  const u = document.querySelector('#w122 .w194upd');
  if (!u) return null;
  return {
    head: (u.querySelector('b') || {}).textContent || '',
    why: (u.querySelector('.w194why') || {}).textContent || '',
    rows: [...u.querySelectorAll('[data-w194row]')].map(r => ({ id: r.getAttribute('data-w194row'), name: (r.querySelector('em') || {}).textContent, small: (r.querySelector('small') || {}).textContent, btns: [...r.querySelectorAll('button')].map(b => b.textContent.trim()) })),
    gotIt: !!u.querySelector('[data-w122ack]') || /Got it/.test(u.textContent)
  };
});
const bar = f => f.ev(() => { const b = document.querySelector('#w122sheet [data-w194bar]'); return b ? { id: b.getAttribute('data-w194bar'), text: b.textContent, done: b.classList.contains('done'), details: !!b.querySelector('details'), open: !!(b.querySelector('details') || {}).open, before: b.nextElementSibling && b.nextElementSibling.className } : null; });
const shot = async (f, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await f.page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* 1. the card, opening a module, Close */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#training', fixture: fx(), candidate: cand, beforeGoto: brandRoutes });
    await recorder(f);
    await f.page.waitForTimeout(800);
    let c = await card(f);
    ok('the onboarding card lists the 3 changed steps (one already acknowledged stays away)', c && /Updated since you finished \(3\)/.test(c.head) && c.rows.length === 3 && !c.rows.some(r => r.id === '86e1cj9h6'), c);
    ok('no Got it anywhere: each step says how it opens', c && !c.gotIt && c.rows.every(r => r.btns.length === 1) && JSON.stringify(c.rows.map(r => r.btns[0]).sort()) === JSON.stringify(['Open the avenue', 'Open the module', 'Open the step']), c && c.rows);
    ok('the card says to open each one, then close it', c && /Open each one to go through it again, then close it/.test(c.why), c && c.why);
    ok('each row names its week and what it is', c && c.rows.some(r => r.id === '86e1cj9gn' && /Week 1 · Avenue Academy module/.test(r.small)) && c.rows.some(r => r.id === '86e1cj9hg' && /Week 3 · Onboarding step/.test(r.small)) && c.rows.some(r => r.id === '86e1cj9j0' && /60 days · Learning Avenue/.test(r.small)), c && c.rows);
    await shot(f, 'w194_card');
    await f.page.click('[data-w194open="86e1cj9gn"]'); await f.page.waitForTimeout(1200);
    const h1 = await f.ev(() => location.hash);
    ok('Open the module goes to the module', h1 === '#training/t/1001', h1);
    let w = await writes(f);
    const op = w.filter(x => x.table === 'onboarding_update_opens');
    ok('opening is saved for that version of the step (and nothing is acknowledged yet)', op.length === 1 && op[0].op === 'upsert' && op[0].payload.onboarding_id === 1 && op[0].payload.template_id === '86e1cj9gn' && op[0].payload.template_updated_at === V_LOOP && !w.some(x => x.table === 'onboarding_update_acks'), w);
    let b = await bar(f);
    ok('the module opens with the gold bar: what changed and Close the update', b && b.id === '86e1cj9gn' && /Updated since you finished · Week 1/.test(b.text) && /Close the update/.test(b.text) && /Go through it again, then close the update/.test(b.text) && b.before === 'bd', b);
    await shot(f, 'w194_module_bar');
    await f.page.click('#w122sheet .xb[data-w122x]'); await f.page.waitForTimeout(900);
    c = await card(f);
    const loop = c && c.rows.filter(r => r.id === '86e1cj9gn')[0];
    ok('back on the card the step shows Open it again and Close', loop && JSON.stringify(loop.btns) === JSON.stringify(['Open it again', 'Close']) && /opened, ready to close/.test(loop.small), loop);
    ok('the other steps still only open', c && c.rows.filter(r => r.id !== '86e1cj9gn').every(r => r.btns.length === 1), c && c.rows);
    await f.page.click('[data-w194close="86e1cj9gn"]'); await f.page.waitForTimeout(900);
    w = await writes(f);
    const ak = w.filter(x => x.table === 'onboarding_update_acks');
    ok('Close records the acknowledgement for that version', ak.length === 1 && ak[0].op === 'insert' && ak[0].payload.template_id === '86e1cj9gn' && ak[0].payload.template_updated_at === V_LOOP && ak[0].payload.onboarding_id === 1, ak);
    c = await card(f);
    ok('the closed step leaves the card (2 left)', c && /\(2\)/.test(c.head) && !c.rows.some(r => r.id === '86e1cj9gn'), c);
    ok('the toast says you are up to date', /up to date/.test(await toastText(f)), await toastText(f));

    /* 2. a step with no module opens the plan at that step */
    await f.page.click('[data-w194open="86e1cj9hg"]'); await f.page.waitForTimeout(2200);
    const h2 = await f.ev(() => location.hash);
    b = await bar(f);
    ok('Open the step opens the plan with the bar and the step’s new words', h2 === '#training/onboarding' && b && b.id === '86e1cj9hg' && /Read what it says now/.test(b.text) && b.details && /sign up for a serving/i.test(b.text), { h2, b });
    const pl = await f.ev(() => {
      const row = document.querySelector('#w122sheet .onbwrap [data-w166t="86e1cj9hg"]');
      const st = window.w167 && w167.state ? w167.state() : null;
      return { row: !!row, hit: !!(row && row.classList.contains('w194hit')), wk: st && st.wk, journey: !!document.querySelector('#w122sheet .sh.w167') };
    });
    ok('the plan chooses the step’s week and marks the step', pl.row && pl.hit && (!pl.journey || pl.wk === 'WEEK 3'), pl);
    ok('the step is in the plan, so its words start folded in the bar', b && b.details && !b.open, b);
    await shot(f, 'w194_plan_bar');
    await f.page.click('#w122sheet [data-w194bar] [data-w194close]'); await f.page.waitForTimeout(900);
    b = await bar(f);
    w = await writes(f);
    ok('Close the update in the bar acknowledges it and the bar says so', b && b.done && /You are up to date on this step/.test(b.text) && w.filter(x => x.table === 'onboarding_update_acks' && x.payload.template_id === '86e1cj9hg' && x.payload.template_updated_at === V_VOL).length === 1, { b, w: w.filter(x => x.table === 'onboarding_update_acks') });
    await f.page.click('#w122sheet .xb[data-w122x]'); await f.page.waitForTimeout(900);
    c = await card(f);
    ok('one step left on the card', c && /\(1\)/.test(c.head) && c.rows.length === 1 && c.rows[0].id === '86e1cj9j0', c);

    /* 3. the avenue */
    await f.page.click('[data-w194open="86e1cj9j0"]'); await f.page.waitForTimeout(1300);
    const h3 = await f.ev(() => location.hash);
    b = await bar(f);
    ok('Open the avenue opens it with the bar', h3 === '#training/p/foundations' && b && b.id === '86e1cj9j0' && /This avenue is part of your onboarding/.test(b.text), { h3, b });
    w = await writes(f);
    ok('the avenue’s opening is saved too', w.filter(x => x.table === 'onboarding_update_opens' && x.payload.template_id === '86e1cj9j0' && x.payload.template_updated_at === V_PICK).length === 1, w.filter(x => x.table === 'onboarding_update_opens'));
    ok('no page errors (the card, the module, the plan, the avenue)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 4. saved opens from another device */
  {
    const opens = [{ id: 1, onboarding_id: 1, template_id: '86e1cj9gn', template_updated_at: V_LOOP, opened_at: '2026-09-24T10:00:00+00:00', opened_by: 'Steel' },
      { id: 2, onboarding_id: 1, template_id: '86e1cj9hg', template_updated_at: '2026-09-01T10:00:00+00:00', opened_at: '2026-09-02T10:00:00+00:00', opened_by: 'Steel' }];
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#training', fixture: fx({ opens }), candidate: cand, beforeGoto: brandRoutes });
    await f.page.waitForTimeout(1000);
    const c = await card(f);
    const loop = c && c.rows.filter(r => r.id === '86e1cj9gn')[0], vol = c && c.rows.filter(r => r.id === '86e1cj9hg')[0];
    ok('a step opened on another device shows Close at once', loop && loop.btns.indexOf('Close') >= 0, loop);
    ok('an open of an older version does not count: the step must be opened again', vol && JSON.stringify(vol.btns) === JSON.stringify(['Open the step']), vol);

    /* 5. the Classic view */
    await f.ev(() => { const b = document.querySelector('[data-w122classic]'); if (b) b.click(); });
    await f.page.waitForTimeout(1500);
    const cl = await f.ev(() => {
      const box = document.querySelector('#training .w58upd');
      return box ? { text: box.textContent, open: [...box.querySelectorAll('[data-w194open]')].map(b => b.textContent.trim()), close: box.querySelectorAll('[data-w194close]').length, gotIt: !!box.querySelector('[data-w58ack]') } : null;
    });
    ok('the Classic view has the same buttons, no Got it', cl && !cl.gotIt && cl.open.length === 3 && cl.close === 1 && /Open each one to go through it again, then close it/.test(cl.text), cl);
    ok('no page errors (saved opens, Classic view)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 6. the certificate */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#training', fixture: fx(), candidate: cand, beforeGoto: brandRoutes });
    await recorder(f);
    await f.hash('#training/cert/cert:onboarding', 1800);
    const ct = await f.ev(() => {
      const c = document.querySelector('#w122sheet .w194cert'); if (!c) return null;
      const q = s => (c.querySelector(s) || {}).textContent || '';
      const logo = c.querySelector('.band .logo'), sig = c.querySelector('.foot .sg img'), seal = c.querySelector('.band .seal img'), star = c.querySelector('.band .star');
      const r = c.getBoundingClientRect(), band = c.querySelector('.band').getBoundingClientRect();
      return { ov: q('.ov'), name: q('.nm'), nameTT: getComputedStyle(c.querySelector('.nm')).textTransform, nameFont: getComputedStyle(c.querySelector('.nm')).fontFamily, what: q('.what'), acad: q('.band .acad'),
        signer: q('.foot .sg b'), title: q('.foot .sg span'), date: q('.foot .dt em'), no: q('.foot .dt span'),
        logo: logo && logo.getAttribute('src'), logoOk: !!(logo && logo.complete && logo.naturalWidth), sig: !!(sig && /^data:image\/png;base64,/.test(sig.getAttribute('src'))), sigOk: !!(sig && sig.complete && sig.naturalWidth),
        seal: !!seal, star: !!star, ratio: Math.round(100 * r.width / r.height) / 100, bandShare: Math.round(100 * band.width / r.width),
        bandBg: getComputedStyle(c.querySelector('.band')).backgroundColor, bodyFont: getComputedStyle(c).fontFamily,
        btns: [...document.querySelectorAll('#w122sheet .ft button')].map(b => b.textContent.trim()) };
    });
    ok('the certificate is the brand one: band, lockup, Avenue Academy, the seal and one star', ct && /logo-lockup-cream\.svg$/.test(ct.logo) && ct.logoOk && /Avenue\s*Academy/.test(ct.acad) && ct.seal && ct.star && ct.bandBg === 'rgb(16, 63, 57)' && ct.bandShare >= 30 && ct.bandShare <= 36, ct);
    ok('A4 landscape proportions', ct && Math.abs(ct.ratio - 1.41) < 0.03, ct && ct.ratio);
    ok('the words: Certificate of completion, the name in Barlow Condensed capitals, what was completed', ct && /Certificate of completion/i.test(ct.ov) && ct.name === 'Steel MacDonald' && ct.nameTT === 'uppercase' && /Barlow Condensed/.test(ct.nameFont) && ct.what === 'Welfare Avenue Onboarding' && /Space Grotesk/.test(ct.bodyFont), ct);
    ok('signed: the signature, Steel MacDonald, Founder and Chair, Welfare Avenue', ct && ct.sig && ct.sigOk && ct.signer === 'Steel MacDonald' && ct.title === 'Founder and Chair, Welfare Avenue', ct);
    ok('dated and numbered', ct && ct.date === 'August 4, 2026' && /^Certificate WA-ONB-260804-/.test(ct.no), ct);
    ok('an admin sees Signature beside Print', ct && ct.btns.indexOf('Signature') >= 0 && ct.btns.some(x => /Print or save as PDF/.test(x)), ct && ct.btns);
    await shot(f, 'w194_cert');
    /* the signature editor */
    await f.page.click('#w122sheet [data-w194sig]'); await f.page.waitForTimeout(400);
    const ed = await f.ev(() => { const e = document.getElementById('w194sig'); return e ? { name: document.getElementById('w194sn').value, title: document.getElementById('w194st').value, pv: !!e.querySelector('.pv img') } : null; });
    ok('Signature opens the editor with the name, the title and the current picture', ed && ed.name === 'Steel MacDonald' && ed.title === 'Founder and Chair' && ed.pv, ed);
    /* a photo of a signature on white paper: the Hub clears the white and trims it */
    const png = await f.ev(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 400, 200); x.strokeStyle = '#111111'; x.lineWidth = 6; x.beginPath(); x.moveTo(60, 120); x.bezierCurveTo(120, 20, 200, 180, 340, 90); x.stroke(); return c.toDataURL('image/png').split(',')[1]; });
    await f.page.setInputFiles('#w194sf', { name: 'signature.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await f.page.waitForTimeout(900);
    const cleaned = await f.ev(async () => {
      const img = document.querySelector('#w194sig .pv img'); if (!img) return null;
      await new Promise(r => { if (img.complete) r(); else img.onload = r; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let clear = 0, ink = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) clear++; else if (d[i] > 200) ink++; }
      return { w: c.width, h: c.height, clear, ink, corner: d[3] };
    });
    ok('a new picture is cleaned: the white goes clear, the ink stays, trimmed to the stroke', cleaned && cleaned.corner === 0 && cleaned.ink > 200 && cleaned.clear > cleaned.ink && cleaned.w < 400 && cleaned.h < 200, cleaned);
    await f.page.fill('#w194st', 'Founder and Chair of the Board');
    await f.page.click('[data-w194sigsave]'); await f.page.waitForTimeout(900);
    const w = (await writes(f)).filter(x => x.table === 'app_config');
    let v = null; try { v = JSON.parse(w[0].payload.value); } catch (e) { v = null; }
    ok('Save writes cert_signature (the picture, the name, the title)', w.length === 1 && w[0].op === 'upsert' && w[0].payload.key === 'cert_signature' && v && /^data:image\/png;base64,/.test(v.image) && v.name === 'Steel MacDonald' && v.title === 'Founder and Chair of the Board', w);
    const after = await f.ev(() => ({ ed: !!document.getElementById('w194sig'), title: (document.querySelector('#w122sheet .w194cert .foot .sg span') || {}).textContent }));
    ok('the certificate shows the new title at once and the editor closes', !after.ed && after.title === 'Founder and Chair of the Board, Welfare Avenue', after);
    /* print */
    const [pop] = await Promise.all([f.page.waitForEvent('popup', { timeout: 8000 }).catch(() => null), f.page.click('#w122sheet [data-w122print]')]);
    let ph = '';
    if (pop) { await pop.waitForTimeout(1200); try { ph = await pop.content(); } catch (e) { ph = ''; } }
    ok('print opens an A4 landscape page with the brand fonts, exact colours and the signed certificate', pop && /size:A4 landscape/.test(ph) && /fonts\.googleapis\.com\/css2\?family=Barlow\+Condensed/.test(ph) && /print-color-adjust:exact/.test(ph) && /class="w194cert"/.test(ph) && /data:image\/png;base64,/.test(ph), ph.slice(0, 300));
    if (pop) { try { await pop.close(); } catch (e) { /* fine */ } }
    ok('no page errors (certificate, editor, print)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 7. a member with a certificate: no Signature button; and a phone */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#training', fixture: fx(), candidate: cand, beforeGoto: brandRoutes });
    await f.hash('#training/cert/cert:foundations', 1600);
    const m = await f.ev(() => ({ cert: !!document.querySelector('#w122sheet .w194cert'), sig: !!document.querySelector('#w122sheet [data-w194sig]'), signer: (document.querySelector('#w122sheet .w194cert .foot .sg b') || {}).textContent }));
    ok('a member sees their certificate, signed, with no Signature button', m.cert && !m.sig && m.signer === 'Steel MacDonald', m);
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#training', fixture: fx(), candidate: cand, beforeGoto: brandRoutes });
    await f.hash('#training/cert/cert:onboarding', 1800);
    const p = await f.ev(() => {
      const c = document.querySelector('#w122sheet .w194cert'); if (!c) return null;
      const ci = c.querySelector('.ci'), nm = c.querySelector('.nm');
      return { dir: getComputedStyle(ci).flexDirection, nameSize: parseFloat(getComputedStyle(nm).fontSize), lead: parseFloat(getComputedStyle(c.querySelector('.lead')).fontSize), w: c.getBoundingClientRect().width, sw: document.documentElement.scrollWidth, vw: window.innerWidth };
    });
    ok('a phone stacks the certificate (the band on top) with readable words and no sideways scroll', p && p.dir === 'column' && p.nameSize >= 24 && p.lead >= 12 && p.sw <= p.vw + 1, p);
    await shot(f, 'w194_cert_phone');
    await f.hash('#training', 1200);
    const c = await card(f);
    const rows = await f.ev(() => ({ vw: window.innerWidth, r: [...document.querySelectorAll('#w122 .w194upd [data-w194row]')].map(r => r.getBoundingClientRect().right) }));
    ok('the card fits a phone', c && c.rows.length === 3 && rows.r.every(x => x <= rows.vw + 1), { c, rows });
    await shot(f, 'w194_card_phone');
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
