/* w242drive.js: the notification centre (wave242; v2 wave245). Settings > Notifications lists every kind from the registry
   hub_notification_kinds in groups, each with when it fires, a Hub switch and a Slack switch (wa_notify_prefs.prefs.kinds
   through wa242_prefs_set), Details (what it says, an example, who gets it, Send me a sample through notify), a line on
   where things stand, a warning when a kind would reach nobody, the channel posts for the record, and Recent (the person's
   own hub_notifications_sent rows). wave116j's checkboxes and wave219's radios step aside; the task reminders row shows
   what is due and Send me today's reminder (wa242_remind_me).
   Checks: the centre mounts with the 14 switchable kinds in group order and the 6 channel posts; the defaults when
   nothing is saved; no Hub switch for a request update, no Slack switch for an announcement; the older controls hidden;
   a flip saves every kind through wa242_prefs_set with the one change and shows the saved answer; Details opens with the
   example and Send me a sample calls notify {event: sample, kind}; the reminder row and button; Recent lists the person's
   rows with the outcome in words; the warning for a kind that reaches nobody; saved switches and the old rules read
   back; the fallback list when the registry is empty; a member sees it too; no page errors.
   Uses test/boot.js and test/fx_w245.json. CAND=build/candidate.html node test/w242drive.js */
const path = require('path');
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }

const STEEL = 'steel.macdonald@welfareavenue.com';
const REG = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w245.json'), 'utf8')).hub_notification_kinds;
function fx(o) {
  o = o || {};
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.hub_push_subs = o.subs || [];
  f.wa_notify_prefs = o.prefs || [];
  f.hub_notification_kinds = o.reg === false ? [] : REG;
  f.hub_notifications_sent = o.sent || [];
  f.wa_slack_ids = o.slack === false ? [] : [{ email: STEEL, slack_id: 'U02308AHH9N' }];
  return f;
}
const DUE = { day: 'Friday 25 September', date: '2026-09-25', member: true, due_today: [{ id: 757, title: 'Call Oberoi', due: '25 Sep' }, { id: 759, title: 'Decide with Suro', due: '25 Sep' }], overdue: [], due_tomorrow: [{ id: 687, title: 'Follow up with Vatsala', due: '26 Sep' }] };
const SENT = [
  { id: 1, email: STEEL, kind: 'task_reassigned', channel: 'slack', title: 'A task is now yours', body: 'Call Oberoi about the Oct 18 event', url: '#task/757', outcome: 'sent', sent_at: '2026-09-25T15:40:00-04:00' },
  { id: 2, email: STEEL, kind: 'task_reassigned', channel: 'hub', title: 'A task is now yours', body: 'Call Oberoi about the Oct 18 event', url: '/#task/757', outcome: 'skipped: no device', sent_at: '2026-09-25T15:40:01-04:00' },
  { id: 3, email: 'someone.else@welfareavenue.com', kind: 'mentioned', channel: 'slack', title: 'x', body: 'not mine', url: null, outcome: 'sent', sent_at: '2026-09-25T15:30:00-04:00' }
];
/* the database answers: wa242_prefs_set echoes what was saved (the disabled list in step); notify's sample is caught */
const INIT = `(function () {
  window.__log = []; window.__CALLS = [];
  window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__CALLS.push([name, b]); if (name === 'notify' && b.event === 'sample') return { data: { ok: true, kind: b.kind, slack: 'sent', hub: 'skipped: no device' }, error: null }; return { data: { ok: true }, error: null }; };
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
  await f.page.waitForTimeout(1800);
}
const centre = f => f.ev(() => {
  const el = document.getElementById('w242set'); if (!el) return null;
  const rows = Array.from(el.querySelectorAll('.w242row:not(.chan)')).map(r => {
    const sw = ch => { const s = r.querySelector('[data-w242sw="' + r.getAttribute('data-w242row') + '|' + ch + '"]'); return s ? (s.classList.contains('on') ? 'on' : 'off') : 'none'; };
    return { key: r.getAttribute('data-w242row'), hub: sw('hub'), slack: sw('slack'), warn: (r.querySelector('.w242warn') || {}).textContent || '' };
  });
  const chans = el.querySelectorAll('.w242row.chan').length;
  const groups = Array.from(el.querySelectorAll('.w242grp')).map(g => g.textContent.replace(/\s*\(.*$/, '').trim());
  const root = el.closest('.w116js');
  const hiddenChk = Array.from(root.querySelectorAll(':scope > label.chk')).filter(l => l.querySelector('input[data-jev]')).map(l => l.style.display);
  const where = root.querySelector('#w219set .w219where');
  const prev = el.previousElementSibling;
  return { text: el.innerText.replace(/\s+/g, ' ').trim(), rows, chans, groups, hiddenChk, whereHidden: where ? where.style.display === 'none' : null, prev: prev ? (prev.id || prev.className) : null, due: (el.querySelector('.w242due') || {}).innerText || '', head: (el.querySelector('.w242head') || {}).innerText || '', recent: Array.from(el.querySelectorAll('.w242r')).map(r => r.innerText.replace(/\s+/g, ' ').trim()) };
});
const toastText = f => f.ev(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || path.join(__dirname, '../build/candidate.html');
  try {
    /* 1. an admin with nothing saved: the registry, the defaults, a flip, Details and a sample, the reminder, Recent */
    {
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx({ sent: SENT }), rpcs: RPCS, candidate: cand, init: INIT });
      await f.page.waitForTimeout(600);
      await openNotif(f);
      let c = await centre(f);
      ok('the centre mounts with its heading and the status line', !!c && /What reaches you, and where/.test(c.text) && /Hub Slack/i.test(c.text) && /No device of yours has Hub notifications on yet/.test(c.head) && /Slack messages come to your DMs \(the Hub knows your Slack account\)/.test(c.head), c && c.head);
      ok('the 14 switchable kinds, in group order', !!c && c.rows.map(r => r.key).join(',') === 'task_reassigned,task_due,request_filed,suggestion_accepted,request_update,mail_for_you,mentioned,comment_mention,content_studio,volunteer_applied,timeoff_request,applicant,loop_still,announcement', c && c.rows.map(r => r.key));
      ok('the groups, in order, then the channel posts', !!c && c.groups.join('|') === 'Your work|Meetings and mentions|Content Studio|Volunteers and servings|People and HR|The Loop|Announcements|Also, in Slack channels' && c.chans === 6, c && { groups: c.groups, chans: c.chans });
      ok('nothing saved: every switch on', !!c && c.rows.every(r => (r.hub === 'on' || r.hub === 'none') && (r.slack === 'on' || r.slack === 'none')), c && c.rows);
      ok('a request update has no Hub switch; an announcement has no Slack switch', !!c && c.rows.filter(r => r.key === 'request_update')[0].hub === 'none' && c.rows.filter(r => r.key === 'announcement')[0].slack === 'none', c && c.rows);
      ok('each row says when it fires', !!c && /The moment someone makes a task for you or moves one to you/.test(c.text) && /Weekday mornings at 8:30/.test(c.text), c && c.text.slice(0, 300));
      ok('an announcement with no device warns that it reaches nobody', !!c && /No device of yours has Hub notifications on yet/.test(c.rows.filter(r => r.key === 'announcement')[0].warn), c && c.rows.filter(r => r.key === 'announcement')[0]);
      ok('a kind with Slack on and Slack connected has no warning', !!c && c.rows.filter(r => r.key === 'task_reassigned')[0].warn === '', c && c.rows.filter(r => r.key === 'task_reassigned')[0]);
      ok('wave116j\'s checkboxes are hidden, wave219\'s radios too', !!c && c.hiddenChk.length >= 5 && c.hiddenChk.every(d => d === 'none') && c.whereHidden === true, c && { chk: c.hiddenChk, where: c.whereHidden });
      ok('the centre sits after wave219\'s block and its line', !!c && /w219what|w219set/.test(c.prev), c && c.prev);
      ok('the reminder row says what is due now', !!c && /Right now: 2 due today, 1 due tomorrow/.test(c.due) && /Send me today/.test(c.due), c && c.due);
      ok('Recent lists my own rows, newest first, with the outcome in words, not someone else\'s', !!c && c.recent.length === 2 && /Hub no device with Hub notifications on/.test(c.recent[0]) && /Slack sent/.test(c.recent[1]) && !/not mine/.test(c.text), c && c.recent);
      /* Details and the sample */
      await f.ev(() => document.querySelector('#w242set [data-w242open="task_reassigned"]').click()); await f.page.waitForTimeout(300);
      c = await centre(f);
      ok('Details opens with what it says, the example and who gets it', /What it says/.test(c.text) && /Confirm the headcount and the 11:30 arrival/.test(c.text) && /Who gets it everyone/.test(c.text) && /Send me a sample/.test(c.text), c.text.slice(0, 400));
      await f.ev(() => document.querySelector('#w242set [data-w242sample="task_reassigned"]').click()); await f.page.waitForTimeout(700);
      const calls = await f.ev(() => window.__CALLS.filter(x => x[0] === 'notify'));
      ok('Send me a sample calls notify with the kind', calls.length === 1 && calls[0][1].event === 'sample' && calls[0][1].kind === 'task_reassigned', calls);
      ok('the toast says what happened on each channel', /Slack: sent/.test(await toastText(f)) && /Hub: no device/.test(await toastText(f)), await toastText(f));
      /* flip task_due's Slack switch off */
      await f.ev(() => document.querySelector('#w242set [data-w242sw="task_due|slack"]').click());
      await f.page.waitForTimeout(700);
      const saves = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa242_prefs_set');
      const k = saves.length ? saves[0].args.p_kinds : null;
      ok('the flip saves every switchable kind through wa242_prefs_set, with the one change', saves.length === 1 && k && Object.keys(k).length === 14 && k.task_due.hub === true && k.task_due.slack === false && k.mentioned.hub === true && k.mentioned.slack === true && k.announcement.slack === true && k.request_update.hub === true && k.timeoff_request.hub === true, k);
      c = await centre(f);
      ok('the switch shows off and the toast says so', !!c && c.rows.filter(r => r.key === 'task_due')[0].slack === 'off' && c.rows.filter(r => r.key === 'task_due')[0].hub === 'on' && /Slack off/.test(await toastText(f)), c && c.rows.filter(r => r.key === 'task_due'));
      ok('Hub on, Slack off and no device: the row says nothing would reach me', !!c && /Hub only, and no device/.test(c.rows.filter(r => r.key === 'task_due')[0].warn), c && c.rows.filter(r => r.key === 'task_due')[0]);
      const st = await f.ev(() => window.__wa242.state());
      ok('the saved answer is kept (the disabled list in step), the registry loaded', st && st.kinds.task_due && st.kinds.task_due.slack === false && st.disabled.indexOf('task_due') >= 0 && st.reg === 20, st);
      await f.ev(() => document.querySelector('#w242set [data-w242="remind"]').click());
      await f.page.waitForTimeout(700);
      const rem = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa242_remind_me');
      ok('Send me today\'s reminder calls wa242_remind_me and says sent', rem.length === 1 && /Sent: look in the Hub and on Slack/.test(await toastText(f)), await toastText(f));
      ok('the centre never says AI', !/\bAI\b/.test(c.text));
      ok('no page errors (admin)', f.errs.length === 0, f.errs);
      await f.close();
    }
    /* 2. saved switches and the old rules read back: channel Hub with a device on, the disabled list, one explicit kind; Slack not connected */
    {
      const prefs = [{ email: STEEL, disabled: ['request_filed'], prefs: { channel: 'hub', kinds: { mentioned: { hub: false, slack: true } } }, updated_at: '2026-09-20T00:00:00Z' }];
      const subs = [{ id: 1, email: STEEL, endpoint: 'https://fcm.googleapis.com/fcm/send/x', device: 'Chrome on Linux', created_at: '2026-09-20T00:00:00Z' }];
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx({ prefs, subs, slack: false }), rpcs: RPCS, candidate: cand, init: INIT });
      await f.page.waitForTimeout(600);
      await openNotif(f);
      const c = await centre(f);
      const row = key => (c ? c.rows.filter(r => r.key === key)[0] : null) || {};
      ok('the status line: one device on, the Slack account found by email the first time', /on for 1 device of yours/.test(c.head) && /finds your account by email/.test(c.head), c.head);
      ok('an explicit kind reads back (mentioned: Hub off, Slack on), no warning', row('mentioned').hub === 'off' && row('mentioned').slack === 'on' && row('mentioned').warn === '', row('mentioned'));
      ok('a kind on the disabled list reads back off on both, and says so', row('request_filed').hub === 'off' && row('request_filed').slack === 'off' && /Switched off on both/.test(row('request_filed').warn), row('request_filed'));
      ok('channel Hub with a device on: Hub on, Slack off for the kinds that can pop up, no warning', row('task_reassigned').hub === 'on' && row('task_reassigned').slack === 'off' && row('content_studio').slack === 'off' && row('task_reassigned').warn === '', [row('task_reassigned'), row('content_studio')]);
      ok('a request update keeps its Slack DM (no Hub path)', row('request_update').slack === 'on' && row('request_update').hub === 'none' && row('request_update').warn === '', row('request_update'));
      ok('an announcement: Hub on, no warning with a device', row('announcement').hub === 'on' && row('announcement').slack === 'none' && row('announcement').warn === '', row('announcement'));
      ok('no page errors (saved choices)', f.errs.length === 0, f.errs);
      await f.close();
    }
    /* 3. a member sees the centre too; with no registry the fallback list stands */
    {
      const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', fixture: fx({ reg: false }), rpcs: Object.assign({}, RPCS, { wa_org_editor: false }), candidate: cand, init: INIT });
      await f.page.waitForTimeout(600);
      await openNotif(f);
      const c = await centre(f);
      ok('a member gets the centre; with no registry the fallback\'s ten kinds show', !!c && c.rows.length === 10 && c.chans === 0, c && c.rows.length);
      ok('no page errors (member)', f.errs.length === 0, f.errs);
      await f.close();
    }
  } catch (e) { fail++; out.push('FAIL (exception) ' + String(e && e.stack || e).slice(0, 800)); }
  console.log(out.join('\n'));
  console.log('w242drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
