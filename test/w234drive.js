/* w234drive: volunteer spots on each serving card (wave234) and one Community lead.
   CAND=build/cand234.html node test/w234drive.js */
const { launch, fresh, loadFixture } = require('./boot');

function fx() {
  const f = loadFixture();
  f.volunteer_role_guides = [
    { role: 'team_leader', target: 1, label_en: 'Team leader' }, { role: 'cook', target: 4, label_en: 'Cook' },
    { role: 'driver', target: 2, label_en: 'Driver' }, { role: 'server', target: 8, label_en: 'Server' },
    { role: 'dishwasher', target: 1, label_en: 'Dishwasher' }, { role: 'photographer', target: 1, label_en: 'Photographer' },
    { role: 'community_debrief', target: 1, label_en: 'Community lead' }, { role: 'community_talker', target: null, label_en: 'Community welcome' },
    { role: 'volunteer', target: null, label_en: 'Volunteer' }];
  let id = 9000;
  const add = (ev, role, status, extra) => f.event_roster.push(Object.assign({ id: id++, event_id: ev, person_id: null, person_name: 'P' + id, role, status, confirm_status: null, detail: {} }, extra || {}));
  /* Oct 18 (24): ten servers confirmed (only 8 count), a driver to confirm, an old Community welcome confirmed (counts as lead), one cancelled cook */
  for (let i = 0; i < 10; i++) add(24, 'server', 'Confirmed');
  add(24, 'driver', 'TBD'); add(24, 'community_talker', 'Confirmed'); add(24, 'cook', 'Cancelled'); add(24, 'cook', 'Unavailable');
  /* Nov 1 (25): its own counts (no cooks, 5 servers), a partner covering 2 servers, 2 of ours confirmed, a cook who no longer counts */
  const e25 = f.volunteer_events.filter(e => e.id === 25)[0]; e25.spot_counts = { cook: 0, server: 5 };
  f.volunteer_event_partners = [{ id: 1, event_id: 25, covers: { server: 2 }, food: 'ours', route: 'coordinator' }];
  add(25, 'server', 'Confirmed'); add(25, 'server', 'Confirmed'); add(25, 'cook', 'Confirmed');
  /* Nov 15 (26): everything filled */
  const full = { team_leader: 1, cook: 4, driver: 2, server: 8, dishwasher: 1, photographer: 1, community_debrief: 1 };
  Object.keys(full).forEach(k => { for (let i = 0; i < full[k]; i++) add(26, k, 'Confirmed'); });
  /* the calendar reads volunteer_event_summary: the fixture's Fall servings */
  f.volunteer_event_summary = f.volunteer_events.filter(e => e.id >= 22 && e.id <= 29).map(e => {
    const ro = f.event_roster.filter(r => r.event_id === e.id && r.status !== 'Cancelled');
    return Object.assign({}, e, { kind: 'service', title: 'Sunday serving', roster_count: ro.length, roster_confirmed: ro.filter(r => r.status === 'Confirmed').length, steps_done: 0, steps_total: 63 });
  });
  return f;
}

(async () => {
  const browser = await launch();
  const res = {}; let fails = 0;
  const ok = (name, cond, got) => { res[name] = cond ? 'ok' : 'FAIL ' + JSON.stringify(got); if (!cond) fails++; };
  for (const who of [['admin', 1366], ['admin', 390], ['board', 1366]]) {
    const f = await fresh(browser, { who: who[0], width: who[1], fixture: fx() });
    await f.hash('#volunteering', 2600);
    await f.page.waitForTimeout(900);
    const bars = await f.ev(() => Array.from(document.querySelectorAll('#volunteering .vl-ev[data-vlev]')).map(el => {
      const b = el.querySelector('.w234'); return { id: el.getAttribute('data-vlev'), text: b ? b.querySelector('.t').textContent.trim() : null, tip: b ? b.getAttribute('title') : null,
        c: b && b.querySelector('i.c') ? b.querySelector('i.c').style.width : null, w: b && b.querySelector('i.w') ? b.querySelector('i.w').style.width : null,
        before: b ? (b.nextElementSibling ? b.nextElementSibling.className : null) : null, full: b ? b.classList.contains('full') : null };
    }));
    const by = {}; bars.forEach(b => { by[b.id] = b; });
    const tag = who.join('@');
    if (who[0] === 'admin') {
      ok(tag + ' oct18 text', by['24'] && by['24'].text === '9 of 18 volunteer spots filled · 1 to confirm', by['24']);
      ok(tag + ' oct18 widths', by['24'] && by['24'].c === '50%' && by['24'].w === '6%', by['24']);
      ok(tag + ' oct18 tip', by['24'] && by['24'].tip === 'Still open: 1 team leader, 4 cooks, 1 driver, 1 dishwasher, 1 photographer', by['24']);
      ok(tag + ' oct18 above SOP bar', by['24'] && by['24'].before === 'vl-bar', by['24']);
      ok(tag + ' nov1 own counts + partner', by['25'] && by['25'].text === '4 of 11 volunteer spots filled', by['25']);
      ok(tag + ' nov15 full', by['26'] && by['26'].full === true && by['26'].text === 'All 18 volunteer spots filled', by['26']);
      ok(tag + ' empty serving', by['27'] && by['27'].text === '0 of 18 volunteer spots filled', by['27']);
      ok(tag + ' past has none', by['22'] ? by['22'].text === null : true, by['22']);
      /* stable: a second paint changes nothing */
      const before = await f.ev(() => document.querySelectorAll('#volunteering .w234').length);
      await f.ev(() => window.w234.paint(true)); await f.page.waitForTimeout(400);
      const after = await f.ev(() => document.querySelectorAll('#volunteering .w234').length);
      ok(tag + ' one bar per card', before === after && before >= 6, [before, after]);
      /* back from an event and the bars are there again */
      await f.ev(() => { const c = document.querySelector('#volunteering .vl-ev[data-vlev="25"]'); if (c) c.click(); }); await f.page.waitForTimeout(1500);
      await f.hash('#volunteering', 1800); await f.page.waitForTimeout(800);
      const again = await f.ev(() => document.querySelectorAll('#volunteering .vl-ev[data-vlev] .w234').length);
      ok(tag + ' bars after returning', again >= 6, again);
    } else {
      ok(tag + ' board: no error', true);
    }
    /* one Community lead in the pickers */
    const talk = await f.ev(() => document.body.innerText.indexOf('Community welcome'));
    ok(tag + ' no Community welcome on the page', talk < 0, talk);
    ok(tag + ' no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  console.log(JSON.stringify(res, null, 1));
  console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
