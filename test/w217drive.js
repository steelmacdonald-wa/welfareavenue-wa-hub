/* w217drive.js: wave217, the light Still in? checks. Steel (07/10/26): "After an hour, hour and a half, 2 hours, and 2.5
   hours being in, I want you to do a light check to confirm if they are still in." His choices: in the Hub, plus one Slack
   DM at 3 hours (checkin-post still_dm, not driven here); nothing happens when nobody answers; every half hour after 2.5h.
   Checks: no note before the hour; the note at 1h with the person's own time and "only you see this"; Still in hides it and
   writes still_in_at on the session; nothing more until 1.5h; the x waits for the next mark; an unanswered note moves on to
   the next mark with the new time; a Still in from another device (still_in_at) counts; the Welcome back note still comes
   first and its Still working counts too; the DM's links (?loop=still answers, ?loop=close opens the wrap-up sheet, a
   closed loop says so) and the query leaves the address; a phone; no page errors.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build. */
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }

const STEEL = 'steel.macdonald@welfareavenue.com';
const NOW = new Date('2026-09-25T16:00:00-04:00').getTime();
function fx(open, startedMinsAgo) {
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.hub_checkins = open ? [{ id: 901, email: STEEL, name: 'Steel', department: 'board', started_at: new Date(NOW - (startedMinsAgo || 10) * 60000).toISOString(), ended_at: null, minutes: null, source: 'hub', still_in_at: null }] : [];
  f.app_config = (f.app_config || []).filter(r => r.key !== 'checkinout_channel').concat([{ key: 'checkinout_channel', value: 'check-in-out-wa' }]);
  return f;
}
const RPCS = { loop_feed: [], loop_in_now: [], wa_org_editor: true };
/* the edge function stubbed, every call kept; hub_checkins updates kept in window.__upd */
async function spy(f) {
  await f.ev(() => {
    window.__calls = []; window.__upd = [];
    db.functions.invoke = function (name, opts) {
      const b = (opts && opts.body) || {}; window.__calls.push({ name, body: JSON.parse(JSON.stringify(b)) });
      let data = { ok: true };
      if (name === 'checkin-post' && b.action === 'draft') data = { ok: true, bullets: ['Joined: Operations Montreal meeting'], items: 1, hidden: 0, minutes: 75, open_tasks: [], team_channel: null, everyone_channel: 'check-in-out-wa' };
      return new Promise(r => setTimeout(() => r({ data, error: null }), 40));
    };
    const F = db.from.bind(db);
    db.from = function (t) { const b = F(t); if (t === 'hub_checkins') { const u = b.update.bind(b); b.update = function (p) { window.__upd.push(JSON.parse(JSON.stringify(p))); return u(p); }; } return b; };
  });
}
const note = f => f.ev(() => { const n = document.getElementById('w118ck'); return n ? { kind: n.getAttribute('data-kind'), text: n.textContent } : null; });
/* time passes (the test clock is fixed): the session moves back, and an answer given earlier moves back with it */
const age = (f, mins) => f.ev(m => { const r = w116jCk.open(); const s0 = new Date(r.started_at).getTime(), s1 = Date.now() - m * 60000; r.started_at = new Date(s1).toISOString(); if (r.still_in_at) r.still_in_at = new Date(new Date(r.still_in_at).getTime() + (s1 - s0)).toISOString(); }, mins);
const decide = f => f.ev(() => { window.__wa118b.decide('tick'); });
const toastText = f => f.ev(() => { const t = document.getElementById('toast') || document.querySelector('.toast'); return t ? t.textContent : ''; });

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* 1. the marks: 1h, 1.5h, 2h, 2.5h, then every half hour */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true, 10), rpcs: RPCS, candidate: cand });
    await spy(f);
    await f.ev(() => { ['w118bMark', 'w118bHid', 'w118bAsked'].forEach(k => localStorage.removeItem(k)); window.__wa118b.hide(); });
    const marks = await f.ev(() => { const r = { started_at: new Date(Date.now() - 60 * 60000).toISOString() }; const at = m => window.__wa118b.markAt({ started_at: r.started_at }, new Date(r.started_at).getTime() + m * 60000); return [59, 60, 89, 90, 120, 150, 180, 210].map(at); });
    ok('the marks fall at 1h, 1.5h, 2h, 2.5h, 3h, 3.5h', JSON.stringify(marks) === JSON.stringify([-1, 0, 0, 1, 2, 3, 4, 5]), marks);
    await age(f, 59); await decide(f);
    ok('no check before the hour', !(await note(f)), await note(f));
    await age(f, 61); await decide(f);
    let n = await note(f);
    ok('an hour in: Still in?, the person’s own time, only you see this', n && n.kind === 'long' && /Still in\?/.test(n.text) && /1h 0?1m so far/.test(n.text) && /only you see this/.test(n.text), n);
    ok('it offers Still in, Close the loop and Set the time', n && /Still in/.test(n.text) && /Close the loop/.test(n.text) && /Set the time/.test(n.text), n && n.text);
    const pos = await f.ev(() => { const x = document.getElementById('w118ck').getBoundingClientRect(), g = document.getElementById('w192go').getBoundingClientRect(); return x.top >= g.bottom - 2 && Math.abs(x.left - g.left) < 320; });
    ok('it sits under the Close the loop button', pos);
    await f.page.click('#w118ck [data-w118b="still"]'); await f.page.waitForTimeout(300);
    const after = await f.ev(() => ({ note: !!document.getElementById('w118ck'), at: w116jCk.open().still_in_at, upd: window.__upd.slice(-1)[0] || null }));
    ok('Still in hides it and writes still_in_at on the session', !after.note && !!after.at && after.upd && !!after.upd.still_in_at && Object.keys(after.upd).length === 1, after);
    await age(f, 75); await decide(f);
    ok('nothing more until the next mark', !(await note(f)));
    await age(f, 91); await decide(f);
    n = await note(f);
    ok('an hour and a half in: asked again', n && n.kind === 'long' && /1h 31m so far/.test(n.text), n);
    await f.page.click('#w118ck [data-w118b="x"]'); await f.page.waitForTimeout(200);
    await age(f, 100); await decide(f);
    ok('the x waits for the next mark (nothing is written)', !(await note(f)) && (await f.ev(() => window.__upd.length)) === 1);
    await age(f, 121); await decide(f);
    n = await note(f);
    ok('two hours in: asked again', n && /2h 0?1m so far/.test(n.text), n);
    await age(f, 151); await decide(f);
    n = await note(f);
    ok('left unanswered, the note moves on to 2.5 hours with the new time (nothing else happens)', n && /2h 31m so far/.test(n.text) && (await f.ev(() => window.__upd.length)) === 1 && !(await f.ev(() => window.__calls.some(c => c.body.action === 'close'))), n);
    await age(f, 181); await decide(f);
    n = await note(f);
    ok('after 2.5 hours it keeps asking every half hour (3h)', n && /3h 0?1m so far/.test(n.text), n);
    await age(f, 211); await decide(f);
    n = await note(f);
    ok('and at 3.5 hours', n && /3h 31m so far/.test(n.text), n);
    /* a Still in from another device */
    await f.ev(() => { window.__wa118b.hide(); localStorage.removeItem('w118bMark'); const r = w116jCk.open(); r.started_at = new Date(Date.now() - 155 * 60000).toISOString(); r.still_in_at = new Date(Date.now() - 4 * 60000).toISOString(); });
    await decide(f);
    ok('a Still in on another device (still_in_at) answers that mark here too', !(await note(f)));
    /* Set the time still works from the note */
    await age(f, 181); await decide(f);
    await f.page.click('#w118ck [data-w118b="settime"]'); await f.page.waitForTimeout(200);
    const tf = await note(f);
    ok('Set the time opens the time form, and Cancel closes it', tf && /When did you finish\?/.test(tf.text));
    await f.page.click('#w118ck [data-w118b="x"]'); await f.page.waitForTimeout(200);
    ok('Cancel writes nothing', !(await note(f)) && (await f.ev(() => window.__upd.length)) === 1);
    ok('no page errors (the marks)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. Welcome back comes first, and its Still working counts as Still in */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(true, 125), rpcs: RPCS, candidate: cand });
    await spy(f);
    await f.ev(() => { window.__wa118b.hide(); localStorage.removeItem('w118bMark'); localStorage.setItem('w118bHid', String(Date.now() - 40 * 60000)); window.__wa118b.decide('back'); });
    let n = await note(f);
    ok('back after a while: Welcome back, not Still in?', n && n.kind === 'back' && /Welcome back/.test(n.text), n);
    await decide(f);
    n = await note(f);
    ok('a tick does not replace Welcome back with Still in?', n && n.kind === 'back', n);
    await f.page.click('#w118ck [data-w118b="still"]'); await f.page.waitForTimeout(300);
    ok('Still working writes still_in_at', await f.ev(() => !!w116jCk.open().still_in_at && window.__upd.length === 1));
    await decide(f);
    ok('and the 2-hour mark counts as answered', !(await note(f)));
    ok('no page errors (welcome back)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. the DM's links */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '?loop=still#mypage', fixture: fx(true, 185), rpcs: RPCS, candidate: cand, init: 'try { localStorage.removeItem("w118bMark"); localStorage.removeItem("w118bHid"); } catch (e) {}' });
    await spy(f);
    await f.page.waitForTimeout(4200);
    const s = await f.ev(() => ({ url: location.search + location.hash, at: (w116jCk.open() || {}).still_in_at || null, note: !!document.getElementById('w118ck') }));
    ok('?loop=still answers Still in (still_in_at) and leaves no note', !!s.at && !s.note, s);
    ok('the link’s query leaves the address', !/loop=/.test(s.url) && /#mypage/.test(s.url), s.url);
    ok('its toast says you’re still in', /still in/.test(await toastText(f)), await toastText(f));
    ok('no page errors (?loop=still)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '?loop=close#mypage', fixture: fx(true, 185), rpcs: RPCS, candidate: cand, init: 'try { localStorage.removeItem("w118bHid"); } catch (e) {}' });
    await spy(f);
    await f.page.waitForTimeout(4200);
    const s = await f.ev(() => ({ sheet: !!document.getElementById('w192sheet'), url: location.search }));
    ok('?loop=close opens the wrap-up sheet', s.sheet, s);
    ok('and leaves the address clean', !/loop=/.test(s.url), s.url);
    ok('no page errors (?loop=close)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '?loop=still#mypage', fixture: fx(false), rpcs: RPCS, candidate: cand });
    await spy(f);
    await f.page.waitForTimeout(4200);
    ok('a link after the loop is closed says so', /already closed/.test(await toastText(f)), await toastText(f));
    ok('no page errors (closed loop link)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 4. a phone */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(true, 95), rpcs: RPCS, candidate: cand });
    await spy(f);
    await f.ev(() => { window.__wa118b.hide(); localStorage.removeItem('w118bMark'); localStorage.removeItem('w118bHid'); });
    await decide(f);
    const s = await f.ev(() => { const n = document.getElementById('w118ck'); if (!n) return null; const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: document.documentElement.scrollWidth, text: n.textContent }; });
    ok('on a phone the check fits the screen', s && s.l >= 0 && s.r <= s.w && s.sw <= s.w && /Still in\?/.test(s.text), s);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
