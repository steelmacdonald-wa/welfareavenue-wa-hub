/* w242drive.js: wave242, the notification centre. Settings > Notifications lists every kind with a Hub switch and a Slack
   switch (wa_notify_prefs.prefs.kinds through wa242_prefs_set); wave116j's checkboxes and wave219's radios step aside;
   the task reminders row shows what is due and Send me today's reminder (wa242_remind_me).
   Checks: the centre mounts with its ten kinds, the defaults when nothing is saved (everything on; no Slack switch for
   announcements, no Hub switch for a request update); the older controls hidden; a flip saves every kind through
   wa242_prefs_set with the one change and shows the saved answer; the reminder row's words and button; the saved switches
   and the old rules (channel Hub with a device on, the disabled list) read back; a member sees it too; no page errors.
   Uses test/boot.js. CAND=build/candidate.html node test/w242drive.js */
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }

function fx(o) {
  o = o || {};
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.hub_push_subs = o.subs || [];
  f.wa_notify_prefs = o.prefs || [];
  return f;
}
const DUE = { day: 'Friday 25 September', date: '2026-09-25', member: true, due_today: [{ id: 757, title: 'Call Oberoi', due: '25 Sep' }, { id: 759, title: 'Decide with Suro', due: '25 Sep' }], overdue: [], due_tomorrow: [{ id: 687, title: 'Follow up with Vatsala', due: '26 Sep' }] };
/* the database answers: wa242_prefs_set echoes what was saved (the disabled list in step), wa242_remind_me says sent */
const INIT = `(function () {
  window.__log = [];
  var _sb;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _sb; }, set: function (v) {
    var cc = v.createClient;
    v.createClient = function () {
      var c = cc.apply(this, arguments);
      var rpc = c.rpc;
      c.rpc = function (fn, args) {
        if (/^wa242_/.test(fn)) {
          window.__log.push({ rpc: fn, args: JSON.parse(JSON.stringify(args || {})) });
          if (fn === 'wa242_prefs_set') {
            var k = (args && args.p_kinds) || {}; var dis = [];
            Object.keys(k).forEach(function (x) { if (k[x] && k[x].slack === false) dis.push(x); });
            return Promise.resolve({ data: { ok: true, kinds: k, disabled: dis, channel: 'both' }, error: null });
          }
          if (fn === 'wa242_remind_me') return Promise.resolve({ data: { sent: true, today: 2, overdue: 0, tomorrow: 1 }, error: null });
        }
        return rpc.apply(this, arguments);
      };
      return c;
    };
    _sb = v;
  } });
})();`;
const RPCS = { loop_feed: [], loop_in_now: [], wa_org_editor: true, wa242_due_mine: DUE };
async function openNotif(f) {
  await f.ev(() => { if (window.w116Settings) window.w116Settings('notifications'); });
  await f.page.waitForTimeout(1600);
}
const centre = f => f.ev(() => {
  const el = document.getElementById('w242set'); if (!el) return null;
  const rows = Array.from(el.querySelectorAll('.w242row')).map(r => {
    const sw = ch => { const s = r.querySelector('[data-w242sw="' + r.getAttribute('data-w242row') + '|' + ch + '"]'); return s ? (s.classList.contains('on') ? 'on' : 'off') : 'none'; };
    return { key: r.getAttribute('data-w242row'), hub: sw('hub'), slack: sw('slack') };
  });
  const root = el.closest('.w116js');
  const hiddenChk = Array.from(root.querySelectorAll(':scope > label.chk')).filter(l => l.querySelector('input[data-jev]')).map(l => l.style.display);
  const where = root.querySelector('#w219set .w219where');
  const prev = el.previousElementSibling;
  return { text: el.innerText.replace(/\s+/g, ' ').trim(), rows, hiddenChk, whereHidden: where ? where.style.display === 'none' : null, prev: prev ? (prev.id || prev.className) : null, due: (el.querySelector('.w242due') || {}).innerText || '' };
});
const toastText = f => f.ev(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || path.join(__dirname, '../build/candidate.html');
  try {
    /* 1. an admin with nothing saved: the defaults, a flip, the reminder */
    {
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: INIT });
      await f.page.waitForTimeout(600);
      await openNotif(f);
      let c = await centre(f);
      ok('the centre mounts in Settings > Notifications with its heading', !!c && /What reaches you, and where/.test(c.text) && /Hub Slack/i.test(c.text), c && c.text.slice(0, 200));
      ok('ten kinds, in order', !!c && c.rows.map(r => r.key).join(',') === 'mentioned,comment_mention,task_reassigned,task_due,request_filed,suggestion_accepted,request_update,content_studio,volunteer_applied,announcement', c && c.rows.map(r => r.key));
      ok('nothing saved: every switch on', !!c && c.rows.every(r => (r.hub === 'on' || r.hub === 'none') && (r.slack === 'on' || r.slack === 'none')), c && c.rows);
      ok('a request update has no Hub switch; an announcement has no Slack switch', !!c && c.rows.filter(r => r.key === 'request_update')[0].hub === 'none' && c.rows.filter(r => r.key === 'announcement')[0].slack === 'none' && c.rows.filter(r => r.key === 'mentioned')[0].hub === 'on', c && c.rows);
      ok('wave116j\'s checkboxes are hidden, wave219\'s radios too', !!c && c.hiddenChk.length >= 5 && c.hiddenChk.every(d => d === 'none') && c.whereHidden === true, c && { chk: c.hiddenChk, where: c.whereHidden });
      ok('the centre sits after wave219\'s block and its line', !!c && /w219what|w219set/.test(c.prev), c && c.prev);
      ok('the reminder row says what is due now', !!c && /Right now: 2 due today, 1 due tomorrow/.test(c.due) && /Send me today/.test(c.due), c && c.due);
      /* flip task_due's Slack switch off */
      await f.ev(() => document.querySelector('#w242set [data-w242sw="task_due|slack"]').click());
      await f.page.waitForTimeout(700);
      const saves = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa242_prefs_set');
      const k = saves.length ? saves[0].args.p_kinds : null;
      ok('the flip saves every kind through wa242_prefs_set, with the one change', saves.length === 1 && k && Object.keys(k).length === 10 && k.task_due.hub === true && k.task_due.slack === false && k.mentioned.hub === true && k.mentioned.slack === true && k.announcement.slack === true && k.request_update.hub === true, k);
      c = await centre(f);
      ok('the switch shows off and the toast says so', !!c && c.rows.filter(r => r.key === 'task_due')[0].slack === 'off' && c.rows.filter(r => r.key === 'task_due')[0].hub === 'on' && /Slack off/.test(await toastText(f)), c && c.rows.filter(r => r.key === 'task_due'));
      const st = await f.ev(() => window.__wa242.state());
      ok('the saved answer is kept (the disabled list in step)', st && st.kinds.task_due && st.kinds.task_due.slack === false && st.disabled.indexOf('task_due') >= 0, st);
      /* flip it back on */
      await f.ev(() => document.querySelector('#w242set [data-w242sw="task_due|slack"]').click());
      await f.page.waitForTimeout(700);
      const saves2 = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa242_prefs_set');
      ok('a second flip saves again, back on', saves2.length === 2 && saves2[1].args.p_kinds.task_due.slack === true, saves2.length);
      /* the reminder */
      await f.ev(() => document.querySelector('#w242set [data-w242="remind"]').click());
      await f.page.waitForTimeout(700);
      const rem = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa242_remind_me');
      ok('Send me today\'s reminder calls wa242_remind_me and says sent', rem.length === 1 && /Sent: look in the Hub and on Slack/.test(await toastText(f)), await toastText(f));
      ok('no page errors (admin)', f.errs.length === 0, f.errs);
      await f.close();
    }
    /* 2. saved switches and the old rules read back: channel Hub with a device on, the disabled list, one explicit kind */
    {
      const prefs = [{ email: 'steel.macdonald@welfareavenue.com', disabled: ['request_filed'], prefs: { channel: 'hub', kinds: { mentioned: { hub: false, slack: true } } }, updated_at: '2026-09-20T00:00:00Z' }];
      const subs = [{ id: 1, email: 'steel.macdonald@welfareavenue.com', endpoint: 'https://fcm.googleapis.com/fcm/send/x', device: 'Chrome on Linux', created_at: '2026-09-20T00:00:00Z' }];
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx({ prefs, subs }), rpcs: RPCS, candidate: cand, init: INIT });
      await f.page.waitForTimeout(600);
      await openNotif(f);
      const c = await centre(f);
      const row = key => (c ? c.rows.filter(r => r.key === key)[0] : null) || {};
      ok('an explicit kind reads back (mentioned: Hub off, Slack on)', row('mentioned').hub === 'off' && row('mentioned').slack === 'on', row('mentioned'));
      ok('a kind on the disabled list reads back off on both', row('request_filed').hub === 'off' && row('request_filed').slack === 'off', row('request_filed'));
      ok('channel Hub with a device on: Hub on, Slack off for the kinds that can pop up', row('task_reassigned').hub === 'on' && row('task_reassigned').slack === 'off' && row('content_studio').slack === 'off', [row('task_reassigned'), row('content_studio')]);
      ok('a request update keeps its Slack DM (no Hub path)', row('request_update').slack === 'on' && row('request_update').hub === 'none', row('request_update'));
      ok('an announcement: Hub on', row('announcement').hub === 'on' && row('announcement').slack === 'none', row('announcement'));
      ok('no page errors (saved choices)', f.errs.length === 0, f.errs);
      await f.close();
    }
    /* 3. a member sees the centre too */
    {
      const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', fixture: fx(), rpcs: Object.assign({}, RPCS, { wa_org_editor: false }), candidate: cand, init: INIT });
      await f.page.waitForTimeout(600);
      await openNotif(f);
      const c = await centre(f);
      ok('a member gets the centre with the ten kinds', !!c && c.rows.length === 10, c && c.rows.length);
      ok('no page errors (member)', f.errs.length === 0, f.errs);
      await f.close();
    }
  } catch (e) { fail++; out.push('FAIL (exception) ' + String(e && e.stack || e).slice(0, 800)); }
  console.log(out.join('\n'));
  console.log('w242drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
