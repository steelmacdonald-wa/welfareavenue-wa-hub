/* w191fx.js: the wave176 fixture plus the real master SOP (63 steps with stages and Hub signals) and a serving's steps. */
const base = require('./w176fx');
const fx191 = require('./fx_w191.json');
module.exports = function (opts) {
  opts = opts || {};
  const fx = base();
  const EV = 900, DAY = '2026-10-02';
  fx.sop_template = fx191.sop_template;
  fx.volunteer_role_guides = fx191.volunteer_role_guides.map(g => Object.assign({}, g, (fx.volunteer_role_guides || []).filter(x => x.role === g.role)[0] || {}));
  const ymd = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const off = { t_minus_2w: -14, t_minus_1w: -7, week_of: -3, event_day: 0, post_event: 3, anytime: -1 };
  let id = 5000;
  fx.sop_event_steps = (fx.sop_event_steps || []).filter(s => s.event_id !== EV).concat(fx191.sop_template.map(t => {
    id++;
    const hubDone = ['roster_contacts'].indexOf(t.hub_signal) >= 0;
    const manual = ['86e055xwa', '86e04vjah'].indexOf(t.id) >= 0;
    return { id, event_id: EV, template_id: t.id, done: hubDone || manual, owner: t.default_owner, due_date: ymd(DAY, off[t.phase] == null ? -1 : off[t.phase]), note: null,
      done_at: hubDone || manual ? '2026-09-28T14:00:00Z' : null, done_by: hubDone ? 'the Hub' : manual ? 'Mary' : null, done_source: hubDone ? 'hub' : manual ? 'manual' : null };
  }));
  fx.volunteer_event_summary.forEach(e => { if (e.id === EV) { e.steps_total = 63; e.steps_done = fx.sop_event_steps.filter(s => s.event_id === EV && s.done).length; } });
  if (opts.format) fx.volunteer_events.forEach(e => { if (e.id === EV) e.format = opts.format; });
  /* a partner organization on dishes (no volunteer record, no phone), as the operations sheet lists Old Brewery Mission */
  fx.event_roster.push({ id: 9007, event_id: EV, person_id: null, person_name: 'Old Brewery (Clark Street)', role: 'dishwasher', status: 'Confirmed', sort: 9007, notes: 'Please take the entry door from 915 Clark', detail: { source: 'sheet', partner: true }, confirm_token: 'tok9007abcdefghijk', confirm_status: null, confirmed_at: null, confirm: null, recipe_id: null });
  return fx;
};
