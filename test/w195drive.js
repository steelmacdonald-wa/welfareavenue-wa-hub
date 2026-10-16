/* w195drive.js: wave195, the Volunteer Manager's Sign-offs page. Steel (02/10/26): "add my signature to volunteer
   recognition and volunteer hours sign off requests that volunteers can ask for on their profile in the website. This
   would appear on our volunteer manager as it's own page to sign off on hours completed with us."
   Checks: the page at #volunteering/signoffs (the masthead, the rail item with the waiting count, the chip on a phone),
   Waiting, Signed, Declined and All; a request in its sheet (what they asked, their record, the servings and hours to
   list, the total, a preview with exactly what the signer chose); Sign and send needs a signature, a name and a title;
   My signature (the certificate's signature offered to its owner, drawing one, the name and titles); signing (the
   confirmation, the email choice, the reference and the email's outcome, the list and count after); the volunteer's own
   form (open it, the page, the spot, the size, the caption, our hours page) and declining with a note; a recognition
   letter's own words; a signed request's PDF; a team member who cannot sign sees it all but no buttons; admins add and
   remove signers; the page tour; the calendar still opens; a board viewer gets none of it; no page errors.
   The database and the signoff function are stubbed in the page (a small fake of signoff_* and the function's actions).
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const SIG = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'fx_sig.png')).toString('base64');

function fx() {
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.app_config = (f.app_config || []).filter(r => r.key !== 'cert_signature').concat([{ key: 'cert_signature', value: JSON.stringify({ image: SIG, name: 'Steel MacDonald', title: 'Founder and Chair', org: 'Welfare Avenue' }) }]);
  f.trainings = (f.trainings || []).concat([{ id: 1395, key: 'tour:signoffs', kind: 'tour', title: 'Page tour: Sign-offs', category: 'Hub tours', minutes: 1, active: true, sort: 20, body: { tab: 'volunteering', tour: 'signoffs' }, description: 'Volunteers’ letters and forms: check what they ask for, sign with your saved signature, or decline with a note.' }]);
  return f;
}
/* a small fake of the database's signoff_* functions and the signoff edge function, in the page */
function fake(o) {
  return `(function () {
    var O = ${JSON.stringify(o || {})};
    window.__calls = [];
    var me = { email: 'steel.macdonald@welfareavenue.com', can_sign: O.canSign !== false, name: 'Steel MacDonald', title: O.title || null, title_fr: null, has_signature: !!O.hasSig, signature_at: null, admin: O.admin !== false };
    var serv = [{ roster_id: 11, date: '2026-06-07', role: 'server', role_en: 'Server', location: 'Montreal', hours: 2 }, { roster_id: 12, date: '2026-06-21', role: 'cook', role_en: 'Cook', location: 'Montreal', hours: 3 }, { roster_id: 13, date: '2026-07-05', role: 'server', role_en: 'Server', location: 'Montreal', hours: 2 }];
    var rows = [
      { id: 1, kind: 'hours', status: 'requested', lang: 'en', name: 'Alex Tremblay', first_name: 'Alex', person_id: 501, contact_id: 801, for_org: 'Dawson College', purpose: 'Community service hours', notes: 'Please list June and July.', requested: '2026-09-20T15:00:00Z', created_at: '2026-09-20T15:00:00Z', now_servings: 3, email: 'alex@example.org' },
      { id: 2, kind: 'form', status: 'requested', lang: 'fr', name: 'Camille Roy', first_name: 'Camille', person_id: 502, contact_id: 802, for_org: 'C\\u00e9gep du Vieux Montr\\u00e9al', form_name: 'formulaire.pdf', form_bytes: 84000, requested: '2026-09-23T15:00:00Z', created_at: '2026-09-23T15:00:00Z', now_servings: 3, email: 'camille@example.org' },
      { id: 3, kind: 'recognition', status: 'requested', lang: 'en', name: 'Sam Lee', first_name: 'Sam', person_id: 503, contact_id: 803, requested: '2026-09-24T15:00:00Z', created_at: '2026-09-24T15:00:00Z', now_servings: 3, email: 'sam@example.org' },
      { id: 4, kind: 'hours', status: 'signed', lang: 'en', name: 'Jo Park', first_name: 'Jo', person_id: 504, contact_id: 804, requested: '2026-09-01T15:00:00Z', created_at: '2026-09-01T15:00:00Z', signed: '2026-09-03T15:00:00Z', signed_at: '2026-09-03T15:00:00Z', signer: 'Steel MacDonald', signer_name: 'Steel MacDonald', signer_title: 'Founder and Chair', reference: 'WA-VS-ABC123', hours: 7, servings: 3, emailed_at: '2026-09-03T15:01:00Z', letter_path: 'letters/4/WA-VS-ABC123.pdf', email: 'jo@example.org' }
    ];
    if (O.three) rows = rows.slice(0, 3).concat([rows[3]]);
    var signers = { signers: [{ email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', has_signature: !!O.hasSig, why: 'admin' }, { email: 'tate.weinstein@welfareavenue.com', name: 'Tate Weinstein', has_signature: false, why: 'assigned', assigned: true }],
      people: [{ email: 'joy.dumansi@welfareavenue.com', name: 'Joy Dumansi', department: 'marketing' }], admin: me.admin };
    function counts() { var c = {}; rows.forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; }); return c; }
    function reply(data, error) { return new Promise(function (r) { setTimeout(function () { r({ data: data, error: error || null }); }, 30); }); }
    var realRpc = db.rpc.bind(db);
    db.rpc = function (fn, args) {
      if (!/^signoff_/.test(fn)) return realRpc(fn, args);
      window.__calls.push({ rpc: fn, args: JSON.parse(JSON.stringify(args || {})) });
      if (fn === 'signoff_counts') return reply({ requested: rows.filter(function (r) { return r.status === 'requested'; }).length });
      if (fn === 'signoff_list') { var st = args.p_status; return reply({ rows: rows.filter(function (r) { return st === 'all' || r.status === st; }), counts: counts(), can_sign: me.can_sign }); }
      if (fn === 'signoff_signer_me') return reply(JSON.parse(JSON.stringify(me)));
      if (fn === 'signoff_signers') return reply(signers);
      if (fn === 'signoff_detail') {
        var r = rows.filter(function (x) { return x.id === args.p_id; })[0]; if (!r) return reply(null);
        var q = Object.assign({}, r, { created_at: r.created_at, declined_at: r.declined_at || null, declined_by: r.declined_by || null, decline_reason: r.decline_reason || null });
        return reply({ request: q, name: r.name, first_name: r.first_name, email: r.email, servings: serv, all_count: 3, all_hours: 7, first: '2026-06-07', last: '2026-07-05', roles: ['Server', 'Cook'], can_sign: me.can_sign });
      }
      if (fn === 'signoff_decline') { var d = rows.filter(function (x) { return x.id === args.p_id; })[0]; d.status = 'declined'; d.decline_reason = args.p_reason; d.declined_at = '2026-09-25T20:00:00Z'; d.declined = d.declined_at; d.declined_by = me.email; return reply({ ok: true }); }
      if (fn === 'signoff_signer_save') { me.name = args.p.name; me.title = args.p.title; me.title_fr = args.p.title_fr || null; return reply({ ok: true }); }
      if (fn === 'signoff_signer_assign') { if (args.p_on) signers.signers.push({ email: args.p_email, name: 'Joy Dumansi', has_signature: false, why: 'assigned' }); else signers.signers = signers.signers.filter(function (s) { return s.email !== args.p_email; }); return reply({ ok: true }); }
      return reply(null, { message: 'unknown ' + fn });
    };
    db.functions.invoke = function (name, opts) {
      var b = (opts && opts.body) || {}; window.__calls.push({ fn: name, body: JSON.parse(JSON.stringify(b)) });
      var data = { ok: true };
      if (name === 'signoff') {
        if (b.action === 'signature_save') { me.has_signature = true; data = { ok: true }; }
        else if (b.action === 'signature_url') data = { url: me.has_signature ? '${SIG}' : null };
        else if (b.action === 'preview') data = { url: 'about:blank#preview-' + b.id, pages: 1 };
        else if (b.action === 'sample') data = { url: 'about:blank#sample' };
        else if (b.action === 'form_url' || b.action === 'letter_url') data = { url: 'about:blank#' + b.action + '-' + b.id };
        else if (b.action === 'sign') { var r = rows.filter(function (x) { return x.id === b.id; })[0]; r.status = 'signed'; r.reference = 'WA-VS-NEW001'; r.signed_at = '2026-09-25T20:00:00Z'; r.signed = r.signed_at; r.signer_name = me.name; r.signer_title = me.title; data = { ok: true, reference: 'WA-VS-NEW001', email: b.notify === false ? { skipped: true } : { status: 'test', send_id: 9 } }; }
      }
      return new Promise(function (r) { setTimeout(function () { r({ data: data, error: null }); }, 40); });
    };
    window.__opened = [];
    window.open = function (u) { window.__opened.push(u); return { location: { href: '' }, close: function () {}, opener: null }; };
  })();`;
}
const calls = f => f.ev(() => window.__calls || []);
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* 1. the page, as an admin who can sign but has no signature yet */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), candidate: cand });
    await f.ev(fake({}));
    await f.hash('#volunteering/signoffs', 1800);
    const p = await f.ev(() => ({
      h1: (document.querySelector('#volunteering .w118mast h1') || {}).textContent, view: typeof WA_VOL_VIEW !== 'undefined' ? WA_VOL_VIEW : null,
      rows: Array.from(document.querySelectorAll('#w195 .w195row b')).map(b => b.textContent), filters: Array.from(document.querySelectorAll('#w195filters button')).map(b => b.textContent),
      rail: Array.from(document.querySelectorAll('#w153rail a.w153it')).map(a => a.textContent), on: (document.querySelector('#w153rail a.w153it.on') || {}).textContent || '',
      mine: (document.getElementById('w195mine') || {}).textContent || '', signers: (document.getElementById('w195signers') || {}).textContent || '', lead: (document.querySelector('#w195 .w195lead') || {}).textContent || ''
    }));
    ok('the page opens at #volunteering/signoffs with its own title', p.view === 'signoffs' && p.h1 === 'Sign-offs', p);
    ok('Waiting first: the three waiting requests, oldest first', JSON.stringify(p.rows) === JSON.stringify(['Alex Tremblay', 'Camille Roy', 'Sam Lee']), p.rows);
    ok('the filters with their counts', /Waiting\s*3/.test(p.filters[0]) && /Signed\s*1/.test(p.filters[1]) && /^Declined$/.test(p.filters[2]) && /All\s*4/.test(p.filters[3]), p.filters);
    ok('the rail (wave259): People current, with the waiting count', p.rail.some(t => /^People\s*3$/.test(t.trim())) && /People/.test(p.on), p.rail);
    ok('My signature says none is saved and what is missing', /No signature saved yet/.test(p.mine) && /Before you sign: your signature, your title/.test(p.mine) && /Add my signature/.test(p.mine), p.mine);
    ok('Signers: who signs and why, and an admin can add someone', /Steel MacDonald/.test(p.signers) && /Admin/.test(p.signers) && /Tate Weinstein/.test(p.signers) && /Assigned/.test(p.signers) && /Add a signer/.test(p.signers), p.signers);
    ok('the lead says where requests come from', /welfareavenue\.com/.test(p.lead), p.lead);
    const c0 = await calls(f);
    ok('the page read the list, the signer and the signers', c0.some(c => c.rpc === 'signoff_list' && c.args.p_status === 'requested') && c0.some(c => c.rpc === 'signoff_signer_me') && c0.some(c => c.rpc === 'signoff_signers'), c0.map(c => c.rpc));

    /* a request in its sheet */
    await f.page.click('#w195 [data-w195open="1"]'); await f.page.waitForTimeout(500);
    const s = await f.ev(() => ({ open: !!document.getElementById('w195sheet'), h2: (document.querySelector('#w195sheet h2') || {}).textContent, text: (document.querySelector('#w195sheet .w195pane') || {}).textContent || '',
      rows: document.querySelectorAll('#w195sheet tbody tr').length, tot: (document.getElementById('w195tot') || {}).textContent,
      signDisabled: !!(document.querySelector('#w195sheet [data-w195step="confirm"]') || {}).disabled }));
    ok('the sheet: who, what they asked for, for whom, their dates and note', s.open && s.h2 === 'Alex Tremblay' && /Dawson College/.test(s.text) && /Community service hours/.test(s.text) && /All their servings/.test(s.text) && /Please list June and July/.test(s.text), s);
    ok('their record and the servings to list with the total', /3 confirmed servings, about 7 hours/.test(s.text) && s.rows === 3 && s.tot === '3 servings, 7 hours', s);
    ok('Sign and send waits for a signature and a title, and says so', s.signDisabled && /Add your signature, name and title/.test(s.text), s);
    await f.page.click('#w195sheet [data-w195on="1"]'); await f.page.waitForTimeout(200);
    await f.page.fill('#w195sheet [data-w195h="0"]', '2.5'); await f.page.waitForTimeout(100);
    ok('leaving a serving out and changing hours update the total', (await txt(f, '#w195tot')) === '2 servings, 4.5 hours', await txt(f, '#w195tot'));
    await f.page.click('#w195sheet [data-w195preview]'); await f.page.waitForTimeout(500);
    const pv = (await calls(f)).filter(c => c.fn === 'signoff' && c.body.action === 'preview').pop();
    ok('Preview draws exactly what was chosen', pv && pv.body.id === 1 && JSON.stringify(pv.body.items) === JSON.stringify([{ roster_id: 11, hours: 2.5 }, { roster_id: 13, hours: 2 }]), pv && pv.body);
    ok('the preview shows in the sheet', await f.ev(() => { const fr = document.querySelector('#w195sheet iframe'); return !!fr && /preview-1/.test(fr.getAttribute('src')); }));

    /* My signature: the certificate's signature, offered to Steel */
    await f.page.click('#w195sheet [data-w195mine]'); await f.page.waitForTimeout(500);
    const m = await f.ev(() => ({ tabs: Array.from(document.querySelectorAll('#w195sheet [data-w195tab]')).map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
      name: (document.getElementById('w195mn') || {}).value, title: (document.getElementById('w195mt') || {}).value, img: !!document.querySelector('#w195sheet .w195cert img') }));
    ok('My signature offers the certificate’s signature to its owner, with its title', m.tabs[0] === 'The one I sent for the certificate*' && m.name === 'Steel MacDonald' && m.title === 'Founder and Chair' && m.img, m);
    await f.page.fill('#w195mf', 'Fondateur et président du conseil');
    await f.page.click('#w195sheet [data-w195save]'); await f.page.waitForTimeout(700);
    const c1 = await calls(f);
    const sv = c1.filter(c => c.rpc === 'signoff_signer_save').pop(), ss = c1.filter(c => c.fn === 'signoff' && c.body.action === 'signature_save').pop();
    ok('Save: the name and both titles, then the signature itself', sv && sv.args.p.name === 'Steel MacDonald' && sv.args.p.title === 'Founder and Chair' && /président/.test(sv.args.p.title_fr) && ss && ss.body.png_b64 === SIG, { sv, ss: ss && ss.body.png_b64.slice(0, 40) });
    const p2 = await f.ev(() => ({ sheet: !!document.getElementById('w195sheet'), mine: (document.getElementById('w195mine') || {}).textContent || '', img: !!document.querySelector('#w195mine img.w195sig') }));
    ok('the sheet closes and My signature shows it, ready to sign', !p2.sheet && p2.img && /Founder and Chair/.test(p2.mine) && !/Before you sign/.test(p2.mine) && /See a sample letter/.test(p2.mine), p2);
    await f.page.click('#w195 [data-w195sample]'); await f.page.waitForTimeout(400);
    ok('a sample letter opens', (await calls(f)).some(c => c.fn === 'signoff' && c.body.action === 'sample') && (await f.ev(() => window.__opened.slice())).some(u => /sample/.test(u)));

    /* signing */
    await f.page.click('#w195 [data-w195open="1"]'); await f.page.waitForTimeout(500);
    await f.page.click('#w195sheet [data-w195step="confirm"]'); await f.page.waitForTimeout(200);
    const cf = await txt(f, '#w195sheet .w195confirm');
    ok('the confirmation names the signer, the title and the email', /Sign as Steel MacDonald, Founder and Chair\?/.test(cf) && /Alex gets the signed PDF on their profile, and an email that it is ready/.test(cf), cf);
    await f.page.click('#w195sheet [data-w195sign]'); await f.page.waitForTimeout(800);
    const sg = (await calls(f)).filter(c => c.fn === 'signoff' && c.body.action === 'sign').pop();
    ok('Sign sends the servings, the hours and the email choice', sg && sg.body.id === 1 && sg.body.notify === true && sg.body.items.length === 3, sg && sg.body);
    const after = await f.ev(() => ({ ok: (document.querySelector('#w195sheet .w195ok') || {}).textContent || '', st: (document.querySelector('#w195sheet .w195st') || {}).textContent, pdf: !!document.querySelector('#w195sheet [data-w195letter]'),
      rows: Array.from(document.querySelectorAll('#w195 .w195row b')).map(b => b.textContent) }));
    ok('signed: the reference, the email went to the test recipients, the PDF to open', /WA-VS-NEW001/.test(after.ok) && /test mode/.test(after.ok) && after.st === 'Signed' && after.pdf, after);
    ok('the list drops it from Waiting and the rail counts 2', JSON.stringify(after.rows) === JSON.stringify(['Camille Roy', 'Sam Lee']) && /People\s*2/.test(await txt(f, '#w153rail a[data-w153go="#volunteering/people"]')), after.rows);
    await f.page.click('#w195sheet [data-w195letter]'); await f.page.waitForTimeout(300);
    ok('the signed PDF opens through a short link', (await calls(f)).some(c => c.fn === 'signoff' && c.body.action === 'letter_url' && c.body.id === 1));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
    ok('Escape closes the sheet', !(await f.ev(() => !!document.getElementById('w195sheet'))));

    /* their own form: open it, place the signature, then decline with a note */
    await f.page.click('#w195 [data-w195open="2"]'); await f.page.waitForTimeout(500);
    const fm = await f.ev(() => ({ text: (document.querySelector('#w195sheet .w195pane') || {}).textContent || '', places: document.querySelectorAll('#w195sheet input[name="w195pl"]').length, add: (document.getElementById('w195add') || {}).checked }));
    ok('a form: the letter is in French, the file, where the signature goes, our hours page after it', /the letter is in French/.test(fm.text) && /formulaire\.pdf/.test(fm.text) && /82 KB/.test(fm.text) && fm.places === 5 && fm.add === true, fm);
    await f.page.click('#w195sheet [data-w195form]'); await f.page.waitForTimeout(300);
    ok('Open it: their form through a short link', (await calls(f)).some(c => c.fn === 'signoff' && c.body.action === 'form_url' && c.body.id === 2));
    await f.page.check('#w195sheet input[name="w195pg"][value="n"]'); await f.page.fill('#w195pgn', '2');
    await f.page.check('#w195sheet input[name="w195pl"][value="bl"]'); await f.page.check('#w195sheet input[name="w195sz"][value="l"]'); await f.page.uncheck('#w195cap');
    await f.page.click('#w195sheet [data-w195preview]'); await f.page.waitForTimeout(500);
    const pv2 = (await calls(f)).filter(c => c.fn === 'signoff' && c.body.action === 'preview').pop();
    ok('the preview places the signature where chosen', pv2 && JSON.stringify(pv2.body.placement) === JSON.stringify({ x: 0.1, y: 0.8, w: 0.38, caption: false, page: 1 }) && pv2.body.add_page === true, pv2 && pv2.body);
    await f.page.check('#w195sheet input[name="w195pl"][value="br"]'); await f.page.waitForTimeout(100);
    ok('a change after the preview says to preview again', /Before your last change/.test(await txt(f, '#w195sheet .w195pane')));
    await f.page.click('#w195sheet [data-w195step="decline"]'); await f.page.waitForTimeout(200);
    await f.page.fill('#w195reason', 'no'); await f.page.click('#w195sheet [data-w195decline]'); await f.page.waitForTimeout(300);
    ok('declining needs a few words', /Say why in a few words/.test(await txt(f, '#w195sheet .w195warn')) && !(await calls(f)).some(c => c.rpc === 'signoff_decline'));
    await f.page.fill('#w195reason', 'This form is for hours with another organization.'); await f.page.click('#w195sheet [data-w195decline]'); await f.page.waitForTimeout(700);
    const dc = (await calls(f)).filter(c => c.rpc === 'signoff_decline').pop();
    ok('declined with the note the volunteer sees', dc && dc.args.p_id === 2 && /another organization/.test(dc.args.p_reason) && /Declined\. Camille sees your note/.test(await txt(f, '#w195sheet .w195ok')) && /another organization/.test(await txt(f, '#w195sheet .w195pane')), dc);
    await f.page.click('#w195sheet [data-w195close]'); await f.page.waitForTimeout(300);

    /* a recognition letter: the signer's own words */
    await f.page.click('#w195 [data-w195open="3"]'); await f.page.waitForTimeout(500);
    ok('a recognition letter has no servings table but room for the signer’s words', !(await f.ev(() => !!document.querySelector('#w195sheet tbody'))) && await f.ev(() => !!document.getElementById('w195note')));
    await f.page.fill('#w195note', 'Sam always arrives early.\n\nThank you, Sam.');
    await f.page.click('#w195sheet [data-w195step="confirm"]'); await f.page.uncheck('#w195notify'); await f.page.waitForTimeout(200);
    ok('without the email the confirmation says none goes out', /No email goes out/.test(await txt(f, '#w195sheet .w195confirm')));
    await f.page.click('#w195sheet [data-w195sign]'); await f.page.waitForTimeout(800);
    const sg2 = (await calls(f)).filter(c => c.fn === 'signoff' && c.body.action === 'sign').pop();
    ok('the letter carries the signer’s words and no email', sg2 && sg2.body.id === 3 && sg2.body.note === 'Sam always arrives early.\n\nThank you, Sam.' && sg2.body.notify === false && !sg2.body.items && /No email sent/.test(await txt(f, '#w195sheet .w195ok')), sg2 && sg2.body);
    await f.page.click('#w195sheet [data-w195close]'); await f.page.waitForTimeout(300);

    /* the other filters, the signers, the tour */
    await f.page.click('#w195filters [data-w195status="signed"]'); await f.page.waitForTimeout(600);
    ok('Signed lists the signed requests, newest work kept', (await f.ev(() => Array.from(document.querySelectorAll('#w195 .w195row b')).map(b => b.textContent))).length === 3 && (await calls(f)).some(c => c.rpc === 'signoff_list' && c.args.p_status === 'signed'));
    await f.page.click('#w195filters [data-w195status="declined"]'); await f.page.waitForTimeout(600);
    ok('Declined lists the declined one', /Camille Roy/.test(await txt(f, '#w195list')));
    await f.page.selectOption('#w195pick', 'joy.dumansi@welfareavenue.com'); await f.page.click('#w195 [data-w195assign]'); await f.page.waitForTimeout(600);
    ok('an admin adds a signer', (await calls(f)).some(c => c.rpc === 'signoff_signer_assign' && c.args.p_email === 'joy.dumansi@welfareavenue.com' && c.args.p_on === true) && /Joy Dumansi/.test(await txt(f, '#w195signers')));
    await f.page.click('#w195 [data-w195unassign="tate.weinstein@welfareavenue.com"]'); await f.page.waitForTimeout(600);
    ok('and removes one', (await calls(f)).some(c => c.rpc === 'signoff_signer_assign' && c.args.p_email === 'tate.weinstein@welfareavenue.com' && c.args.p_on === false) && !/Tate Weinstein/.test(await txt(f, '#w195signers')));
    const tr = await f.ev(() => { const t = window.w122 && window.w122.tours && window.w122.tours.signoffs; return t ? { tab: t.tab, hash: t.hash, n: t.steps.length, sel: t.steps.filter(s => s.s).map(s => s.s) } : null; });
    ok('the page tour "signoffs" points at the page', tr && tr.hash === '#volunteering/signoffs' && tr.n === 5 && tr.sel.every(s => /^#w195/.test(s)), tr);
    await f.hash('#volunteering', 1500);
    const cal = await f.ev(() => ({ view: WA_VOL_VIEW, mine: !!document.getElementById('w195'), h1: (document.querySelector('#volunteering .w118mast h1') || {}).textContent }));
    ok('the calendar still opens as before', cal.view === 'calendar' && !cal.mine && cal.h1 !== 'Sign-offs', cal);
    ok('no page errors (admin)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. drawing a signature */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), candidate: cand });
    await f.ev(fake({ title: 'Founder and Chair' }));
    await f.hash('#volunteering/signoffs', 1500);
    await f.page.click('#w195 [data-w195mine]'); await f.page.waitForTimeout(500);
    await f.page.click('#w195sheet [data-w195tab="draw"]'); await f.page.waitForTimeout(300);
    await f.page.click('#w195sheet [data-w195save]'); await f.page.waitForTimeout(300);
    ok('an empty pad is not saved', /Draw your signature first/.test(await txt(f, '#w195sheet .w195warn')));
    const box = await f.page.$('#w195pad canvas'); const b = await box.boundingBox();
    await f.page.mouse.move(b.x + 40, b.y + 120); await f.page.mouse.down();
    for (let i = 1; i <= 12; i++) await f.page.mouse.move(b.x + 40 + i * 30, b.y + 120 + (i % 2 ? -40 : 30));
    await f.page.mouse.up();
    await f.page.click('#w195sheet [data-w195save]'); await f.page.waitForTimeout(700);
    const ss = (await calls(f)).filter(c => c.fn === 'signoff' && c.body.action === 'signature_save').pop();
    const dims = ss ? await f.ev(u => new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = u; }), ss.body.png_b64) : null;
    ok('a drawn signature is saved as a cropped PNG', ss && /^data:image\/png;base64,/.test(ss.body.png_b64) && dims && dims[0] >= 300 && dims[0] <= 1200 && dims[1] >= 40 && dims[1] < 300, dims);
    ok('no page errors (drawing)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. a team member who cannot sign; 4. a phone */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), candidate: cand });
    await f.ev(fake({ canSign: false, admin: false }));
    await f.hash('#volunteering/signoffs', 1500);
    const p = await f.ev(() => ({ mine: (document.getElementById('w195mine') || {}).textContent || '', add: !!document.getElementById('w195pick') }));
    ok('someone who cannot sign is told who signs, and cannot add signers', /Who signs/.test(p.mine) && !p.add, p);
    await f.page.click('#w195 [data-w195open="1"]'); await f.page.waitForTimeout(500);
    const s = await f.ev(() => ({ text: (document.querySelector('#w195sheet .w195pane') || {}).textContent || '', btns: document.querySelectorAll('#w195sheet [data-w195step], #w195sheet [data-w195preview]').length }));
    ok('they see the request but no sign or decline', /Only a signer can sign or decline/.test(s.text) && s.btns === 0, s);
    ok('no page errors (not a signer)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(), candidate: cand });
    await f.ev(fake({ hasSig: true, title: 'Founder and Chair' }));
    await f.hash('#volunteering', 1600);
    /* wave259: People is one chip; Sign-offs is a tab of the People page */
    await f.page.click('#volunteering .vl-sub [data-vl="people"]'); await f.page.waitForTimeout(1800);
    const chip = await f.ev(() => { const c = document.querySelector('#volunteering .w259tabs [data-vl="signoffs"]'); return c ? { text: c.textContent.replace(/\d+$/, ''), shown: getComputedStyle(c.parentNode).display !== 'none' } : null; });
    ok('on a phone the Sign-offs tab sits with Volunteers and New applicants', chip && chip.text === 'Sign-offs' && chip.shown, chip);
    await f.page.click('#volunteering .w259tabs [data-vl="signoffs"]'); await f.page.waitForTimeout(1500);
    const p = await f.ev(() => ({ hash: location.hash, rows: document.querySelectorAll('#w195 .w195row').length, sw: document.documentElement.scrollWidth }));
    ok('the chip opens the page, and nothing scrolls sideways', p.hash === '#volunteering/signoffs' && p.rows === 3 && p.sw <= 390, p);
    await f.page.click('#w195 [data-w195open="1"]'); await f.page.waitForTimeout(500);
    const w = await f.ev(() => { const p = document.querySelector('#w195sheet .w195pane'); return p ? Math.round(p.getBoundingClientRect().width) : 0; });
    ok('the sheet takes the phone’s width', w >= 380, w);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 5. a board viewer: no Sign-offs page, chip or rail item */
  {
    const f = await fresh(browser, { who: 'board', width: 1366, hash: '#volunteering/signoffs', fixture: fx(), candidate: cand });
    await f.page.waitForTimeout(800);
    const b = await f.ev(() => ({ page: !!document.getElementById('w195'), chip: !!document.querySelector('[data-vl="signoffs"]'),
      rail: Array.from(document.querySelectorAll('#w153rail a.w153it')).some(a => /Sign-offs/.test(a.textContent)), view: typeof WA_VOL_VIEW !== 'undefined' ? WA_VOL_VIEW : null, hash: location.hash }));
    ok('a board viewer gets no Sign-offs page, chip or rail item', !b.page && !b.chip && !b.rail, b);
    ok('no page errors (board)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('w195drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
