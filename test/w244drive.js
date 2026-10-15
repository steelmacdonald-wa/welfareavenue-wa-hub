/* w244drive: people who picked two roles (wave244): the roster board's card says what they picked with a Make button for
   each, one click places them (the board's own Move), the column says what the cards wait for, and the serving card's spots
   bar says "N to place". Staff at 1366 px (places both) and 390 px (sees them). Board viewers do not see the calendar. CAND=build/cand244.html node test/w244drive.js */
const { launch, fresh, loadFixture } = require('./boot');

function fx() {
  const f = loadFixture();
  f.volunteer_role_guides = [{ role: 'team_leader', target: 1 }, { role: 'cook', target: 4 }, { role: 'driver', target: 2 }, { role: 'server', target: 8 },
    { role: 'dishwasher', target: 1 }, { role: 'photographer', target: 1 }, { role: 'community_debrief', target: 1, label_en: 'Community lead' }];
  f.volunteer_event_summary = f.volunteer_events.filter(e => e.id >= 22 && e.id <= 29).map(e => Object.assign({}, e, { kind: 'service', title: 'Sunday serving', roster_count: 0, roster_confirmed: 0, steps_done: 0, steps_total: 63 }));
  f.event_roster.push({ id: 9903, event_id: 26, person_id: 2, person_name: 'Testa Two', role: 'volunteer', status: 'TBD', confirm: {}, detail: { source: 'hub_form', role_choices: ['driver', 'server'] } });
  f.event_roster.push({ id: 9904, event_id: 26, person_id: 3, person_name: 'Testb Three', role: 'volunteer', status: 'TBD', confirm: {}, detail: { source: 'hub_form', role_choices: ['cook', 'photographer'] } });
  f.event_roster.push({ id: 9905, event_id: 26, person_id: 114, person_name: 'Plain Server', role: 'server', status: 'TBD', confirm: {}, detail: { source: 'hub_form' } });
  return f;
}

(async () => {
  const browser = await launch();
  const res = {}; let fails = 0;
  const ok = (name, cond, got) => { res[name] = cond ? 'ok' : 'FAIL ' + JSON.stringify(got); if (!cond) fails++; };
  for (const [who0, W] of [['admin', 1366], ['admin', 390]]) {
    const who = who0 + '@' + W, act = W === 1366;
    const f = await fresh(browser, { who: who0, width: W, fixture: fx() });
    await f.hash('#volunteering', 2800);
    const bar = await f.ev(() => { const el = document.querySelector('#volunteering .vl-ev[data-vlev="26"] .w234 .t'); return el ? el.textContent : null; });
    ok(who + ': bar says 2 to place', !!bar && /· 2 to place/.test(bar), bar);
    const other = await f.ev(() => { const el = document.querySelector('#volunteering .vl-ev[data-vlev="27"] .w234 .t'); return el ? el.textContent : null; });
    ok(who + ': other serving has none', !!other && !/to place/.test(other), other);
    await f.ev(() => { const c = document.querySelector('#volunteering .vl-ev[data-vlev="26"]'); if (c) c.click(); });
    await f.page.waitForTimeout(2600);
    const card = await f.ev(() => { const pc = document.querySelector('#w119 .pc[data-w119card="9903"]'); if (!pc) return null; const l = pc.querySelector('.w244'); return { col: pc.closest('.rc').getAttribute('data-w119role'), line: l ? l.innerText : null, btns: Array.from(pc.querySelectorAll('[data-w244pick]')).map(b => b.textContent) }; });
    ok(who + ': card in the volunteer column', card && card.col === 'volunteer', card);
    ok(who + ': picked line', card && /Picked\s+Driver or Server/i.test(card.line || '') && /waits until a role is chosen/.test(card.line || ''), card);
    ok(who + ': buttons', card && card.btns.join('|') === 'Make driver|Make server', card);
    const plain = await f.ev(() => { const pc = document.querySelector('#w119 .pc[data-w119card="9905"]'); return pc ? !!pc.querySelector('.w244') : null; });
    ok(who + ': a one-role card has no line', plain === false, plain);
    const head = await f.ev(() => { const h = document.querySelector('#w119 .rc[data-w119role="volunteer"] .w244h'); return h ? h.textContent : null; });
    ok(who + ': column note', /choose one for each/.test(head || ''), head);
    if (act) {
      await f.ev(() => { const b = document.querySelector('#w119 .pc[data-w119card="9903"] [data-w244pick="driver"]'); b.click(); });
      await f.page.waitForTimeout(900);
      const moved = await f.ev(() => { const pc = document.querySelector('#w119 .pc[data-w119card="9903"]'); return pc ? { col: pc.closest('.rc').getAttribute('data-w119role'), line: !!pc.querySelector('.w244') } : null; });
      ok('admin: placed as driver', moved && moved.col === 'driver' && moved.line === false, moved);
      const still = await f.ev(() => { const pc = document.querySelector('#w119 .pc[data-w119card="9904"]'); return pc ? { col: pc.closest('.rc').getAttribute('data-w119role'), line: !!pc.querySelector('.w244') } : null; });
      ok('admin: the other still waits', still && still.col === 'volunteer' && still.line === true, still);
      const row = await f.ev(() => (WA_VOL_DETAIL.roster || []).filter(r => r.id === 9903)[0].role);
      ok('admin: roster row role driver', row === 'driver', row);
      await f.ev(() => { const b = document.querySelector('#w119 .pc[data-w119card="9904"] [data-w244pick="photographer"]'); b.click(); });
      await f.page.waitForTimeout(900);
      const gone = await f.ev(() => ({ col: !!document.querySelector('#w119 .rc[data-w119role="volunteer"] .pc'), note: !!document.querySelector('#w119 .w244h'), lines: document.querySelectorAll('#w119 .w244').length }));
      ok('admin: nobody left to place', !gone.col && !gone.note && gone.lines === 0, gone);
    }
    ok(who + ': no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  console.log(JSON.stringify(res, null, 1));
  console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
