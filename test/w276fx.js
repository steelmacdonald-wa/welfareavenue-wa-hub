/* w276fx.js: the fixture for the wave276 team availability drive (test/w276drive.js). No real person: the three opsmtl members are made up.
   fx276(): test/fixture.json plus three active opsmtl team_members (Ruth Owen, a leader; Sam Lee and Lina Park, members), the app_config
   avail_* keys, and hub_team_avail rows for two of the three (Ruth and Lina; Sam has not entered a week). The latest ask is 15/09/26:
   Ruth saved after it (since_ask true), Lina before it (since_ask false), so the status reads "1 of 3 up to date since Tue 15 Sep".
   WHO276: the two identities the drive signs in as, added to boot.js's WHO map (ruth: a leader; sam: a member on the opsmtl profile).
   replies276(o): what the wa_avail_* RPCs answer, keyed by team where the RPC takes one.
   INIT276: an init script that wraps db.rpc as soon as the page creates it (before the Home pop-up's 1.5 s timer), records every
   rpc into window.__REC.calls and every db.functions.invoke into window.__REC.invokes, and answers the wa_avail_* RPCs from
   window.__W276 (set by the same script from replies276). Slot = weekday * 1440 + minute, weekday 0 = Monday. */
const { loadFixture } = require('./boot');

const RUTH = { email: 'ruth.owen@welfareavenue.com', name: 'Ruth Owen' };
const SAM = { email: 'sam.lee@welfareavenue.com', name: 'Sam Lee' };
const LINA = { email: 'lina.park@welfareavenue.com', name: 'Lina Park' };
const HRP = [{ email: 'hana.fixture@welfareavenue.com', name: 'Hana Fixture' }, { email: 'omar.fixture@welfareavenue.com', name: 'Omar Fixture' }];

const S = (di, h, m) => di * 1440 + h * 60 + (m || 0);
const run = (di, h0, h1) => { const o = []; for (let m = h0 * 60; m < h1 * 60; m += 30) o.push(di * 1440 + m); return o; };
/* Ruth and Lina share three windows (Mon 10-12, Tue 14-16, Wed 18-19); Ruth alone has Thu 9-10, which ranks below them */
const SHARED = [].concat(run(0, 10, 12), run(1, 14, 16), run(2, 18, 19));
const RUTH_SLOTS = SHARED.concat(run(3, 9, 10));
const LINA_SLOTS = SHARED.slice();

const WHO276 = {
  ruth: { email: RUTH.email, name: RUTH.name, role: 'staff', patch: [{ email: RUTH.email, role: 'leader', profile: 'opsmtl' }] },
  sam: { email: SAM.email, name: SAM.name, role: 'staff', patch: [{ email: SAM.email, role: 'member', profile: 'opsmtl' }] }
};

function fx276() {
  const fx = JSON.parse(JSON.stringify(loadFixture()));
  const ids = [9601, 9602, 9603, 9604, 9605];
  fx.team_members = (fx.team_members || []).filter(m => ids.indexOf(m.id) < 0);
  fx.team_members.push({ id: 9601, name: RUTH.name, email: RUTH.email, active: true, department: 'opsmtl', role: 'Operations lead', responsibilities: [] });
  fx.team_members.push({ id: 9602, name: SAM.name, email: SAM.email, active: true, department: 'opsmtl', role: 'Operations volunteer', responsibilities: [] });
  fx.team_members.push({ id: 9603, name: LINA.name, email: LINA.email, active: true, department: 'opsmtl', role: 'Operations volunteer', responsibilities: [] });
  fx.team_members.push({ id: 9604, name: HRP[0].name, email: HRP[0].email, active: true, department: 'hr', role: 'HR', responsibilities: [] });
  fx.team_members.push({ id: 9605, name: HRP[1].name, email: HRP[1].email, active: true, department: 'hr', role: 'HR', responsibilities: [] });
  fx.app_config = (fx.app_config || []).filter(x => !/^avail_/.test(x.key)).concat([
    { key: 'avail_grid_start', value: '480' }, { key: 'avail_grid_end', value: '1320' }, { key: 'avail_cell_min', value: '30' }, { key: 'avail_min_hours', value: '10' }
  ]);
  fx.hub_team_avail = [
    { id: 1, email: RUTH.email, department: 'opsmtl', effective_from: '2026-09-01', slots: RUTH_SLOTS, hours: RUTH_SLOTS.length / 2, snoozed_until: null, updated_at: '2026-09-16T14:00:00Z' },
    { id: 2, email: LINA.email, department: 'opsmtl', effective_from: '2026-09-01', slots: LINA_SLOTS, hours: LINA_SLOTS.length / 2, snoozed_until: null, updated_at: '2026-09-03T14:00:00Z' }
  ];
  fx.hub_team_avail_ask = [{ id: 1, department: 'opsmtl', ask_date: '2026-09-01', set_by: 'wave276', note: 'term' }, { id: 2, department: 'opsmtl', ask_date: '2026-09-15', set_by: RUTH.email, note: null }];
  return fx;
}

/* o.manage: wa_avail_team.can_manage; o.due: wa_avail_due answers opsmtl */
function replies276(o) {
  o = o || {};
  const cfg = { cell_min: 30, start: 480, end: 1320, min_hours: 10, ask_date: '2026-09-15' };
  return {
    due: o.due ? [{ department: 'opsmtl', ask_date: '2026-09-15', last_saved: null }] : [],
    mine: null,
    team: {
      opsmtl: Object.assign({ can_manage: !!o.manage, me: o.manage ? RUTH.email : SAM.email }, cfg, {
        members: [
          { email: RUTH.email, name: RUTH.name, slots: RUTH_SLOTS, hours: RUTH_SLOTS.length / 2, updated_at: '2026-09-16T14:00:00Z', since_ask: true },
          { email: LINA.email, name: LINA.name, slots: LINA_SLOTS, hours: LINA_SLOTS.length / 2, updated_at: '2026-09-03T14:00:00Z', since_ask: false }
        ],
        missing: [{ email: SAM.email, name: SAM.name, since_ask: false }],
        clashes: []
      }),
      hr: Object.assign({ can_manage: !!o.manage, me: o.manage ? RUTH.email : SAM.email }, cfg, { ask_date: null }, {
        members: [{ email: HRP[0].email, name: HRP[0].name, slots: run(4, 13, 15), hours: 2, updated_at: '2026-09-04T14:00:00Z', since_ask: true }],
        missing: [{ email: HRP[1].email, name: HRP[1].name, since_ask: false }],
        clashes: []
      })
    }
  };
}

/* in-page: o is replies276(...) */
const INIT276 = (o) => `(function(){
  window.__W276 = ${JSON.stringify(o)};
  window.__REC = { calls: [], invokes: [] };
  window.__WA_INVOKE = function (name, opts) {
    window.__REC.invokes.push({ name: name, body: JSON.parse(JSON.stringify((opts && opts.body) || {})) });
    return { data: { ok: true }, error: null };
  };
  var t = setInterval(function () {
    var d; try { d = db; } catch (e) { return; }
    if (!d || d.__w276wrapped) return;
    d.__w276wrapped = true; clearInterval(t);
    var r0 = d.rpc.bind(d);
    d.rpc = function (fn, args) {
      window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
      var W = window.__W276, ok = function (x) { return Promise.resolve({ data: x == null ? null : JSON.parse(JSON.stringify(x)), error: null }); };
      if (fn === 'wa_avail_due') return ok(W.due);
      if (fn === 'wa_avail_mine') return ok(W.mine);
      if (fn === 'wa_avail_save') { var n = ((args && args.p_slots) || []).length; return ok({ id: 77, hours: n / 2, min_hours: 10 }); }
      if (fn === 'wa_avail_snooze') return ok({ ok: true });
      if (fn === 'wa_avail_team') return ok(W.team[(args && args.p_dept) || ''] || null);
      if (fn === 'wa_avail_ask_set') return ok({ ask_date: '2026-09-25', missing: (W.team[(args && args.p_dept) || ''] || {}).missing || [] });
      return r0(fn, args);
    };
  }, 5);
})();`;

module.exports = { fx276, replies276, INIT276, WHO276, RUTH, SAM, LINA, S, run };
