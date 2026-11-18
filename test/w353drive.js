/* w353drive.js: wave353 Triage. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26).
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w353/. */
const fs = require('fs'), path = require('path');
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('PASS ' + n); } else { fail++; out.push('FAIL ' + n + (x !== undefined ? ' :: ' + JSON.stringify(x).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w353') : null;
async function shot(f, n) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, n + '.png') }); }
const T = (o) => Object.assign({ department: 'marketing', owner: 'Steel', meeting_title: null, meeting_date: null, next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30', owner_unsure: false, for_lead: false }, o);
const TASKS = [
  T({ task_id: 801, title: 'Send the newsletter <img src=x onerror="window.__XSS=1">', due_date: '2026-09-20', why: 'overdue', meeting_title: 'Marketing Meeting - Sept 16' }),
  T({ task_id: 802, title: 'Book the photographer', due_date: '2026-09-22', why: 'overdue' }),
  T({ task_id: 803, title: 'Draft the October calendar', due_date: null, why: 'no_date' }),
  T({ task_id: 804, title: 'Order the banners', due_date: '2026-09-25', why: 'due_today' }),
  T({ task_id: 805, title: 'Call the venue', due_date: '2026-09-21', why: 'overdue' }),
  T({ task_id: 806, title: 'Who said they would do this', due_date: '2026-09-21', why: 'overdue', owner_unsure: true }),
  T({ task_id: 807, title: 'Team task with no owner', due_date: null, why: 'needs_owner', for_lead: true, owner: 'Marketing' })
];
const REQS = [
  { id: 901, type_key: 'website-message', type_label: 'Message from the website', department: 'marketing', title: 'Question about volunteering', details: { Name: 'Jo', Message: 'Hi there' }, status: 'Requested', statuses: ['Requested', 'In progress', 'Done'], requested_by: 'Website', created_at: '2026-09-20T12:00:00Z', needed_by: null, priority: null, source: 'website', assignee: null, why: 'team', suggest_department: 'opsmtl', suggest_person: null, same_kind: 1 },
  { id: 902, type_key: 'gift-drive', type_label: 'Gift Basket Drive', department: 'fundraising', title: 'Gift drive helper A', details: null, status: 'Requested', statuses: ['Requested', 'Contacted', 'Done'], requested_by: 'Form', created_at: '2026-09-21T12:00:00Z', source: 'form:gift-drive-volunteer', assignee: null, why: 'team', suggest_department: null, suggest_person: null, same_kind: 3 },
  { id: 903, type_key: 'gift-drive', type_label: 'Gift Basket Drive', department: 'fundraising', title: 'Gift drive helper B', status: 'Requested', statuses: ['Requested', 'Contacted', 'Done'], source: 'form', assignee: null, why: 'team', same_kind: 3 },
  { id: 904, type_key: 'gift-drive', type_label: 'Gift Basket Drive', department: 'fundraising', title: 'Gift drive helper C', status: 'Requested', statuses: ['Requested', 'Contacted', 'Done'], source: 'form', assignee: null, why: 'team', same_kind: 3 }
];
const WRAP = `(function w(){ if (typeof db==='undefined'||!db||!db.rpc){ return setTimeout(w,100);} if (db.__w353) return; db.__w353=1; window.__calls=[]; var o=db.rpc.bind(db); db.rpc=function(fn,a){ if(fn==='confirm_due_check'||fn==='wa353_request_triage'||fn==='wa353_task_project'){ window.__calls.push({fn:fn,a:a}); if(fn==='wa353_task_project') return Promise.resolve({data:{ok:true,project:'Proj X',department:'marketing'},error:null}); return Promise.resolve({data:{saved:(a.p||[]).length,skipped:[],rules:(a.p||[]).filter(function(x){return x.always}).length},error:null}); } return o(fn,a); }; })();`;
async function swipe(p, dir) {
  const b = await p.evaluate(() => { const r = document.querySelector('#w353 [data-card]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 60, w: r.width }; });
  await p.mouse.move(b.x, b.y); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(b.x + dir * b.w * 0.06 * i, b.y + 2);
  await p.mouse.up(); await p.waitForTimeout(500);
}
const title = p => p.evaluate(() => { const h = document.querySelector('#w353 [data-card] h3'); return h ? h.textContent : null; });
(async () => {
  const browser = await launch();
  for (const W of [1366, 390]) {
    const f = await fresh(browser, { who: 'admin', width: W, hash: '#mypage', wait: 4000, init: WRAP, rpcs: { wa_org_editor: true, wa237_due_check: TASKS, my_due_date_check: TASKS, wa353_request_deck: REQS } });
    const p = f.page; const tag = W < 700 ? 'phone ' : 'desktop ';
    await p.waitForTimeout(6000);
    const s0 = await p.evaluate(() => ({ deck: !!document.getElementById('w353'), old: !!document.getElementById('w213pop'), t: (document.querySelector('#w353 h3') || {}).textContent, n: (document.querySelector('#w353 .n') || {}).textContent, xss: !!window.__XSS, finish: !!document.querySelector('#w353 [data-a=close]') }));
    ok(tag + 'Triage opens on its own; the old list does not', s0.deck && !s0.old, s0);
    ok(tag + 'first card, counts, escaped', /^Send the newsletter <img/.test(s0.t || '') && /7 tasks · 4 requests left/.test(s0.n || '') && !s0.xss, s0);
    ok(tag + 'no Finish later while tasks remain', !s0.finish, s0);
    await shot(f, tag.trim() + '-1-card');
    await swipe(p, 1);
    ok(tag + 'swipe right moves on, Undo shows', (await title(p)) === 'Book the photographer' && await p.evaluate(() => !!document.querySelector('#w353 .undo')));
    await p.click('#w353 [data-a=undo]'); await p.waitForTimeout(300);
    ok(tag + 'Undo brings the card back, nothing saved', (await title(p)) && /^Send the newsletter/.test(await title(p)) && (await p.evaluate(() => window.__calls.length)) === 0);
    await swipe(p, 1);
    await swipe(p, -1);
    ok(tag + 'swipe left opens Later', await p.evaluate(() => !!document.querySelector('#w353 .sheet') && /Next meeting/.test(document.querySelector('#w353 .sheet').textContent)));
    await shot(f, tag.trim() + '-2-later');
    await p.click('#w353 .sheet [data-s=nm]'); await p.waitForTimeout(300);
    ok(tag + 'next card: no date', (await title(p)) === 'Draft the October calendar');
    await p.click('#w353 [data-a=bank]'); await p.waitForTimeout(200); await p.click('#w353 .sheet [data-s="30"]'); await p.waitForTimeout(300);
    ok(tag + 'due today card', (await title(p)) === 'Order the banners');
    await p.click('#w353 [data-a=assign]'); await p.waitForTimeout(200);
    const opts = await p.evaluate(() => [...document.querySelectorAll('#w353 .sheet select option')].map(o => o.value).filter(Boolean));
    ok(tag + 'reassign lists people', opts.length > 3, opts.length);
    await p.selectOption('#w353 .sheet select', opts[0]); await p.click('#w353 .sheet [data-s=go]'); await p.waitForTimeout(300);
    ok(tag + 'project card next', (await title(p)) === 'Call the venue');
    await p.click('#w353 [data-a=project]'); await p.waitForTimeout(800);
    const popts = await p.evaluate(() => [...document.querySelectorAll('#w353 .sheet select option')].map(o => o.value).filter(Boolean));
    ok(tag + 'projects listed', popts.length > 0, popts.length);
    if (popts.length) { await p.selectOption('#w353 .sheet select', popts[0]); await p.click('#w353 .sheet [data-s=go]'); await p.waitForTimeout(400); }
    ok(tag + 'after moving project the card stays', (await title(p)) === 'Call the venue');
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
    const unsure = await p.evaluate(() => ({ t: (document.querySelector('#w353 [data-card] h3') || {}).textContent, q: !!document.querySelector('#w353 [data-a=mine]') }));
    ok(tag + 'arrow key = done; unsure card asks Mine / Not mine', unsure.t === 'Who said they would do this' && unsure.q, unsure);
    await p.click('#w353 [data-a=mine]'); await p.waitForTimeout(200);
    await p.click('#w353 [data-a=done]'); await p.waitForTimeout(500);
    ok(tag + 'lead card: give it to someone', (await title(p)) === 'Team task with no owner' && await p.evaluate(() => /Give it to someone/.test(document.querySelector('#w353 [data-card]').textContent)));
    await p.click('#w353 [data-a=discard]'); await p.waitForTimeout(400);
    const rq = await p.evaluate(() => ({ t: (document.querySelector('#w353 [data-card] h3') || {}).textContent, h: (document.querySelector('#w353 .top h2') || {}).textContent, sug: !!document.querySelector('#w353 [data-a=sendsug]'), finish: !!document.querySelector('#w353 [data-a=close]') }));
    ok(tag + 'requests follow, with the suggestion and Finish later', rq.t === 'Question about volunteering' && rq.h === 'Sort your requests' && rq.sug && rq.finish, rq);
    await shot(f, tag.trim() + '-3-request');
    await swipe(p, -1); await p.waitForTimeout(200);
    await p.click('#w353 .sheet [data-s="t:marketing"]'); await p.waitForTimeout(150);
    await p.check('#w353 .sheet [data-al]');
    await shot(f, tag.trim() + '-4-route');
    await p.click('#w353 .sheet [data-s=go]'); await p.waitForTimeout(400);
    ok(tag + 'gift drive card next', (await title(p)) === 'Gift drive helper A');
    await p.click('#w353 [data-a=status]'); await p.waitForTimeout(200);
    await p.check('#w353 .sheet [data-bulk]'); await p.click('#w353 .sheet [data-s="Contacted"]'); await p.waitForTimeout(500);
    const end = await p.evaluate(() => ({ end: !!document.querySelector('#w353 .end'), ask: !!document.querySelector('#w353 [data-a=ask]') }));
    ok(tag + 'all three gift drive requests in one go, then all sorted with Ask the Hub', end.end && end.ask, end);
    await shot(f, tag.trim() + '-5-end');
    await p.waitForTimeout(5800);
    const calls = await p.evaluate(() => window.__calls);
    const tp = [].concat(...calls.filter(c => c.fn === 'confirm_due_check').map(c => c.a.p));
    const rp = [].concat(...calls.filter(c => c.fn === 'wa353_request_triage').map(c => c.a.p));
    const byId = id => tp.find(x => x.id === id) || rp.find(x => x.id === id);
    ok(tag + 'done saved', byId(801) && byId(801).action === 'done', byId(801));
    ok(tag + 'later = next meeting', byId(802) && byId(802).due === '2026-09-30', byId(802));
    ok(tag + 'bank a month', byId(803) && byId(803).action === 'bank' && byId(803).until === '2026-10-25', byId(803));
    ok(tag + 'assigned', byId(804) && byId(804).action === 'assign' && byId(804).owner === opts[0], byId(804));
    ok(tag + 'project moved through its function', calls.some(c => c.fn === 'wa353_task_project' && c.a.p_task === 805));
    ok(tag + 'mine and done', byId(806) && byId(806).action === 'done' && byId(806).mine === true, byId(806));
    ok(tag + 'discard', byId(807) && byId(807).action === 'discard', byId(807));
    ok(tag + 'routed to marketing, always', byId(901) && byId(901).action === 'route' && byId(901).department === 'marketing' && byId(901).always === true, byId(901));
    ok(tag + 'status for all three', [902, 903, 904].every(i => byId(i) && byId(i).action === 'status' && byId(i).status === 'Contacted'), rp);
    await p.click('#w353 [data-a=ask]'); await p.waitForTimeout(800);
    ok(tag + 'Ask the Hub opens', await p.evaluate(() => !document.getElementById('w353')));
    ok(tag + 'no page errors', !f.errs || !f.errs.length, f.errs);
    await f.close();
  }
  /* nothing to sort: no deck, wave213 quiet, Home card absent */
  const g = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', wait: 4000, rpcs: { wa237_due_check: [], wa353_request_deck: [] } });
  await g.page.waitForTimeout(6000);
  ok('nothing to sort: no Triage, no old list, no Home card', await g.page.evaluate(() => !document.getElementById('w353') && !document.getElementById('w213pop') && !document.getElementById('w353home')));
  await g.close();
  /* the database refuses: wave213 takes over */
  const h = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', wait: 4000, rpcs: { wa_org_editor: true, my_due_date_check: TASKS.slice(0, 2) } });
  await h.page.waitForTimeout(9000);
  ok('wa237_due_check missing: the old list still shows', await h.page.evaluate(() => !document.getElementById('w353') && !!document.getElementById('w213pop')));
  await h.close();
  await browser.close();
  console.log(out.join('\n')); console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
