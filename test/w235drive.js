/* w235drive: Plan the roster's Community lead (wave235): past community leads first, then servers with 2 or more servings;
   the roster card says whether the lead read the briefing. CAND=build/cand235.html node test/w235drive.js */
const { launch, fresh, loadFixture } = require('./boot');

function fx() {
  const f = loadFixture();
  f.volunteer_role_guides = [{ role: 'team_leader', target: 1 }, { role: 'cook', target: 4 }, { role: 'driver', target: 2 }, { role: 'server', target: 8 },
    { role: 'dishwasher', target: 1 }, { role: 'photographer', target: 1 }, { role: 'community_debrief', target: 1, label_en: 'Community lead' }];
  f.volunteer_event_summary = f.volunteer_events.filter(e => e.id >= 22 && e.id <= 29).map(e => Object.assign({}, e, { kind: 'service', title: 'Sunday serving', roster_count: 0, roster_confirmed: 0, steps_done: 0, steps_total: 63 }));
  /* Nov 15 (26): a Community lead on the list who read the briefing, Nov 29 (27): one who has not */
  f.event_roster.push({ id: 9901, event_id: 26, person_id: 2, person_name: 'Abhigail Pascua-Matte', role: 'community_debrief', status: 'Confirmed', confirm: { briefed_at: '2026-09-24T15:00:00Z' }, detail: {} });
  f.event_roster.push({ id: 9902, event_id: 27, person_id: 3, person_name: 'Ahmed', role: 'community_debrief', status: 'TBD', confirm: {}, detail: {} });
  return f;
}
/* history: 1 led before, 114 a server with 3 servings, 6 a server with 1, 8 a cook with 5 */
const HIST = [
  { person_id: 1, events: 2, confirmed: 2, unavailable: 0, waiting: 0, last_event: '2026-08-23', last_confirmed: '2026-08-23', roles: ['community_debrief', 'server'] },
  { person_id: 114, events: 3, confirmed: 3, unavailable: 0, waiting: 0, last_event: '2026-09-06', last_confirmed: '2026-09-06', roles: ['server'] },
  { person_id: 6, events: 1, confirmed: 1, unavailable: 0, waiting: 0, last_event: '2026-09-06', last_confirmed: '2026-09-06', roles: ['server'] },
  { person_id: 8, events: 5, confirmed: 5, unavailable: 0, waiting: 0, last_event: '2026-09-06', last_confirmed: '2026-09-06', roles: ['cook'] }
];

(async () => {
  const browser = await launch();
  const res = {}; let fails = 0;
  const ok = (name, cond, got) => { res[name] = cond ? 'ok' : 'FAIL ' + JSON.stringify(got); if (!cond) fails++; };
  const f = await fresh(browser, { who: 'admin', width: 1366, fixture: fx(), rpcs: { wa_org_editor: true, volunteer_history: HIST } });
  await f.hash('#volunteering', 2600);
  await f.ev(() => { const c = document.querySelector('#volunteering .vl-ev[data-vlev="24"]'); if (c) c.click(); });
  await f.page.waitForTimeout(2500);
  const opened = await f.ev(() => { const b = document.querySelector('[data-w119bplan]'); if (b) b.click(); return !!b; });
  ok('plan button', opened, opened);
  await f.page.waitForTimeout(1800);
  const plan = await f.ev(() => {
    const box = document.getElementById('w119bplanbox'); if (!box) return null;
    const out = {}; let cur = null;
    Array.from(box.querySelectorAll('h4, p.read, label.cand')).forEach(el => {
      if (el.tagName === 'H4') { cur = el.childNodes[0].textContent.trim(); out[cur] = { note: null, cands: [] }; }
      else if (el.tagName === 'P' && cur) out[cur].note = el.textContent.trim();
      else if (cur) out[cur].cands.push({ name: el.querySelector('b').textContent.trim(), why: el.querySelector('span').textContent.trim(), on: el.querySelector('input').checked });
    });
    return out;
  });
  const cl = plan && plan['Community lead'];
  ok('lead section', !!cl, plan && Object.keys(plan));
  ok('lead note', cl && /Past community leads first, then servers with 2 or more servings/.test(cl.note || ''), cl);
  ok('lead order', cl && cl.cands.map(c => c.name).join('|') === 'Abhigail|Nicolas Yerachuk', cl && cl.cands);
  ok('lead why', cl && /^led the community before/.test(cl.cands[0].why) && /^3 servings/.test(cl.cands[1].why), cl && cl.cands);
  ok('lead pre-ticked first', cl && cl.cands[0].on === true, cl && cl.cands);
  ok('other roles have no note', plan && Object.keys(plan).filter(k => k !== 'Community lead').every(k => plan[k].note === null) && Object.keys(plan).length > 1, plan && Object.keys(plan));
  await f.ev(() => { const x = document.getElementById('w119bplanx'); if (x) x.click(); });
  /* roster cards: briefing read or not */
  const tagOf = async (id) => {
    await f.hash('#volunteering', 1600);
    await f.ev(x => { const c = document.querySelector('#volunteering .vl-ev[data-vlev="' + x + '"]'); if (c) c.click(); }, id);
    await f.page.waitForTimeout(2200);
    return f.ev(() => Array.from(document.querySelectorAll('.w171tag')).map(t => t.textContent.trim()).filter(t => /^Briefing/.test(t)));
  };
  const t26 = await tagOf(26), t27 = await tagOf(27);
  ok('briefing read tag', t26.length === 1 && /^Briefing read /.test(t26[0]), t26);
  ok('briefing not read tag', t27.length === 1 && t27[0] === 'Briefing not read yet', t27);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();
  console.log(JSON.stringify(res, null, 1));
  console.log(fails ? fails + ' FAILED' : 'all green');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
