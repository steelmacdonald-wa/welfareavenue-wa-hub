/* w239drive: the volunteer roles set right (wave239): the Volunteers list's role chips and tag select, the Still in?
   column, filters and the Text: still in? modal; Applicants received's role filter with counts.
   CAND=build/candidate.html node test/w239drive.js */
const { launch, fresh, loadFixture } = require('./boot');

function fx() {
  const f = loadFixture();
  /* two photographers, one of them also tagged; a videographer; tags that are not roles */
  const vp = f.volunteer_people;
  vp[0].tags = ['recurring volunteer', 'cabm']; vp[1].tags = ['photographer', 'applied 2026-04']; vp[2].roles = ['videographer']; vp[2].phones = ['4385550101'];
  vp[3].roles = ['photographer', 'server']; vp[3].phones = ['5145550102']; vp[4].roles = ['photographer']; vp[4].phones = [];
  f.volunteer_applications = [
    { id: 1, name: 'A One', email: 'a@x.com', roles: ['photographer', 'server'], role_text: 'Photographer, Server', source: 'website', status: 'received', applied_at: '2026-09-20T12:00:00Z' },
    { id: 2, name: 'B Two', email: 'b@x.com', roles: ['cook'], role_text: 'Cook', source: 'cabm', status: 'received', applied_at: '2026-09-21T12:00:00Z' }];
  return f;
}
const POOL = (f) => [
  { person_id: f.volunteer_people[3].id, role: 'photographer', asked_at: '2026-09-20T14:00:00Z', answer: 'yes', answered_at: '2026-09-20T15:00:00Z', via: 'page', note: 'Weekends only', status: 'sent', error: null, asked_by: 'steel.macdonald@welfareavenue.com' },
  { person_id: f.volunteer_people[1].id, role: 'photographer', asked_at: '2026-09-21T14:00:00Z', answer: 'no', answered_at: '2026-09-21T15:00:00Z', via: 'reply', note: null, status: 'sent', error: null, asked_by: 'steel.macdonald@welfareavenue.com' },
  { person_id: f.volunteer_people[2].id, role: 'videographer', asked_at: '2026-09-24T14:00:00Z', answer: null, answered_at: null, via: null, note: null, status: 'queued', error: null, asked_by: 'steel.macdonald@welfareavenue.com' }];

(async () => {
  const browser = await launch();
  const res = {}; let fails = 0;
  const ok = (name, cond, got) => { res[name] = cond ? 'ok' : 'FAIL ' + JSON.stringify(got); if (!cond) fails++; };
  const F = fx();
  const rpcs = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: false, wa_is_hr: false, wa239_pool_list: POOL(F),
    wa239_pool_send: { queued: 1, mode: 'live', batch: 'b', no_phone: 0, opted_out: 0, held_by_test_mode: 0, asked_recently: 1, unknown: 0, window_open: true } };
  for (const who of [['admin', 1366], ['admin', 390], ['plain', 1366]]) {
    const f = await fresh(browser, { who: who[0], width: who[1], fixture: fx(), rpcs: Object.assign({}, rpcs, who[0] === 'plain' ? { is_wa_admin: false } : {}) });
    const tag = who.join('@');
    await f.ev(() => { window.__calls = []; const o = db.rpc.bind(db); db.rpc = function (fn, a) { window.__calls.push([fn, a]); return o(fn, a); }; });
    await f.hash('#volunteering', 2200);
    await f.ev(() => { const c = document.querySelector('#volunteering [data-vl="people"]'); if (c) c.click(); });
    await f.page.waitForTimeout(1500);
    const chips = await f.ev(() => Array.from(document.querySelectorAll('#volunteering .w239bar .fchip')).map(c => c.textContent.trim()));
    ok(tag + ' chips in role order', chips.length >= 5 && chips[0].indexOf('Everyone (') === 0 && chips.indexOf('Servers (' + (chips.find(c => c.indexOf('Servers') === 0) || '').replace(/\D/g, '') + ')') > chips.findIndex(c => c.indexOf('Cooks') === 0) && !chips.some(c => /cabm|recurring|applied/.test(c)), chips);
    ok(tag + ' photographers counted from roles and tags', chips.some(c => c === 'Photographers (5)'), chips);
    ok(tag + ' videographers chip', chips.some(c => c === 'Videographers (1)'), chips);
    const tags = await f.ev(() => Array.from(document.querySelectorAll('#w239tag option')).map(o => o.textContent));
    ok(tag + ' tag select', tags[0] === 'Any tag' && tags.some(t => t.indexOf('cabm (') === 0) && tags.some(t => t.indexOf('applied 2026-04') === 0) && !tags.some(t => /^server|^photographer/.test(t)), tags);
    /* the photographer chip */
    await f.ev(() => { const c = Array.from(document.querySelectorAll('#volunteering [data-vlrole]')).find(x => x.getAttribute('data-vlrole') === 'photographer'); c.click(); });
    await f.page.waitForTimeout(700);
    const rows = await f.ev(() => Array.from(document.querySelectorAll('#volunteering tbody tr[data-p26]')).filter(r => r.style.display !== 'none').map(r => ({ id: r.getAttribute('data-p26'), roles: Array.from(r.querySelectorAll('td:nth-child(2) .vl-bub')).map(b => b.textContent), still: (r.querySelector('.w239a') || {}).textContent || '' })));
    ok(tag + ' photographer filter rows', rows.length === 5, rows.map(r => r.id));
    const still = await f.ev(() => Array.from(document.querySelectorAll('#volunteering .w239a')).map(a => a.className.replace('w239a ', '') + ':' + a.textContent.trim()));
    if (who[0] === 'admin') {
      ok(tag + ' still in column', still.some(s => s === 'yes:Yes · Sep 20 *') && still.some(s => s === 'no:No · Sep 21'), still);
      const pool = await f.ev(() => Array.from(document.querySelectorAll('#volunteering [data-w239pool]')).map(c => c.textContent.trim()));
      ok(tag + ' still in chips', pool.join('|') === 'Said yes (1)|Said no (1)|No answer yet (1)', pool);
      const btn = await f.ev(() => !!document.querySelector('#volunteering [data-w239ask]'));
      ok(tag + ' text button for an admin', btn, btn);
      /* Said yes filter inside the photographer chip */
      await f.ev(() => document.querySelector('#volunteering [data-w239pool="yes"]').click()); await f.page.waitForTimeout(500);
      const n1 = await f.ev(() => document.querySelectorAll('#volunteering tbody tr[data-p26]').length);
      ok(tag + ' said yes filter', n1 === 1, n1);
      await f.ev(() => document.querySelector('#volunteering [data-w239pool="yes"]').click()); await f.page.waitForTimeout(500);
      /* the modal */
      await f.ev(() => document.querySelector('#volunteering [data-w239ask]').click()); await f.page.waitForTimeout(600);
      const modal = await f.ev(() => { const b = document.getElementById('modalBox'); return { open: document.getElementById('modalBack').style.display === 'flex', h: (b.querySelector('h3') || {}).textContent, pre: (b.querySelector('.w239pre') || {}).textContent,
        people: Array.from(b.querySelectorAll('#w239list label')).map(l => ({ on: l.querySelector('input').checked, t: l.textContent.trim() })), n: (document.getElementById('w239n') || {}).textContent }; });
      ok(tag + ' modal opens', modal.open && modal.h === 'Text: still in?', modal);
      ok(tag + ' modal text says Welfare Avenue and the role', /it’s Welfare Avenue!/.test(modal.pre) && /as a photographer\./.test(modal.pre) && /Reply STOP/.test(modal.pre), modal.pre);
      ok(tag + ' modal lists people with phones, said no unticked', modal.people.length === 3 && modal.people.filter(p => !p.on).length === 1 && modal.people.some(p => /said no/.test(p.t) && !p.on) && modal.n === '2', modal.people);
      await f.ev(() => document.getElementById('w239send').click()); await f.page.waitForTimeout(900);
      const call = await f.ev(() => window.__calls.filter(c => c[0] === 'wa239_pool_send')[0]);
      ok(tag + ' sends the role and the ticked people', call && call[1].p_role === 'photographer' && Array.isArray(call[1].p_people) && call[1].p_people.length === 2, call);
      const closed = await f.ev(() => document.getElementById('modalBack').style.display !== 'flex');
      ok(tag + ' modal closes', closed, closed);
      /* Everyone again: the tag select narrows */
      await f.ev(() => document.querySelector('#volunteering [data-vlrole=""]').click()); await f.page.waitForTimeout(500);
      await f.ev(() => { const s = document.getElementById('w239tag'); s.value = 'cabm'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await f.page.waitForTimeout(500);
      const n2 = await f.ev(() => document.querySelectorAll('#volunteering tbody tr[data-p26]').length);
      ok(tag + ' tag filter', n2 === 1, n2);
      /* Applicants received: every role with its count */
      await f.hash('#volunteering/applicants', 2200);
      const opts = await f.ev(() => Array.from(document.querySelectorAll('#w209role option')).map(o => o.textContent));
      ok(tag + ' applicants role select counts', opts.length === 9 && opts.indexOf('Photographer (1)') > 0 && opts.indexOf('Videographer (0)') > 0 && opts.indexOf('Cook (1)') > 0, opts);
      const lead = await f.ev(() => (document.querySelector('.w209lead') || {}).textContent || '');
      ok(tag + ' applicants lead names the website', /website/.test(lead), lead.slice(0, 80));
    } else {
      ok(tag + ' no text button for a member', !(await f.ev(() => !!document.querySelector('#volunteering [data-w239ask]'))), true);
      ok(tag + ' member sees the answers', still.length === 2, still);
    }
    ok(tag + ' no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  console.log(JSON.stringify(res, null, 1));
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK', Object.keys(res).length, 'checks');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
