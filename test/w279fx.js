/* w279fx.js: the fixture for the wave279 role-pick drive (test/w279drive.js), on top of test/boot.js's fixture. No real person: the hires are made up.
   fx279(): the base fixture plus Lina Fixture (a marketing hire at day 22 by the database's count, day 23 on the lead's card), Omar Early (day 10, so the
   page must not ask about him), Samson's own plan (boot.js's member, for the hire's view of the plan), the 60 DAYS and 90 DAYS role steps
   (academy_path role60 / role90, as wave279b's template rows wa279role60 / wa279role90) and the modules the pop-up offers, one of them finished by Lina.
   lead279(): what onboarding_lead_view returns for the manager (Lina and Omar).
   INIT279(o): stands in for wa279_role_options and wa279_role_save (the same shape and refusals as build/wa279a_rules.sql, sections' done and done_ids included), records every wa279_* call in
   window.__W279.calls, and keeps the picks in window.__W279.picks. o.picks presets picks; o.canPick false makes the person a viewer; o.by is the name
   the database writes as picked_by. window.__W279.refuse = '<text>' makes the next save fail with that text. */
const { loadFixture } = require('./boot');

const ONB = { lina: 9301, omar: 9302, sam: 9303 };
const HIRE = { id: 9201, name: 'Lina Fixture', email: 'lina.fixture@example.invalid' };
const EARLY = { id: 9202, name: 'Omar Early', email: 'omar.early@example.invalid' };
const TR = [
  { id: 9401, title: 'Marketing basics: our voice', path_group: 'Marketing basics', sort: 1 },
  { id: 9402, title: 'Marketing basics: the content calendar', path_group: 'Marketing basics', sort: 2 },
  { id: 9403, title: 'Campaigns and storytelling: the brief', path_group: 'Campaigns and storytelling', sort: 3 },
  { id: 9404, title: 'Page tour: Content Studio', path_group: null, sort: 4, kind: 'tour' },
  { id: 9405, title: 'Marketing strategy: goals', path_group: 'Marketing strategy', sort: 5 },
  { id: 9406, title: 'Marketing strategy: channels', path_group: 'Marketing strategy', sort: 6 },
  { id: 9407, title: 'The Content Studio: drafts', path_group: 'The Content Studio', sort: 7 },
  { id: 9408, title: 'Photo library: finding a picture', path_group: 'Using the Hub', sort: 8 },
  { id: 9409, title: 'Grant writing: the first draft', path_group: 'Fundraising and grants', sort: 9 },
  { id: 9410, title: 'Zebra planned module', path_group: 'Using the Hub', sort: 10, body: { planned: true } },
  { id: 9411, title: 'Photo library: tagging', path_group: 'Using the Hub', sort: 11 }   // fix round 1: finished by Lina, not recommended (found by search)
];
const REC = [9401, 9402, 9403, 9404, 9405, 9406, 9407];   // the recommended order for marketing
const PATH = { 9401: 'Marketing basics', 9402: 'Marketing basics', 9403: 'Campaigns and storytelling', 9405: 'Marketing strategy', 9406: 'Marketing strategy', 9407: 'The Content Studio' };
const DONE = [9403, 9411];   // Lina finished these (9411 is not recommended)

function fx279() {
  const f = loadFixture();
  f.team_members = (f.team_members || []).concat([
    Object.assign({ active: true, department: 'marketing', role: 'Writer' }, HIRE),
    Object.assign({ active: true, department: 'marketing', role: 'Designer' }, EARLY)
  ]);
  f.onboardings = (f.onboardings || []).concat([
    { id: ONB.lina, member_id: HIRE.id, person_name: HIRE.name, status: 'active', started_at: '2026-09-03', assigned_by: 'Fixture', note: null, completed_at: null },
    { id: ONB.omar, member_id: EARLY.id, person_name: EARLY.name, status: 'active', started_at: '2026-09-15', assigned_by: 'Fixture', note: null, completed_at: null },
    { id: ONB.sam, member_id: 36, person_name: 'Samson', status: 'active', started_at: '2026-08-10', assigned_by: 'Fixture', note: null, completed_at: null }
  ]);
  const tpl = [
    { id: 'wa279role60', name: 'Your role trainings', section: '60 DAYS', sort: 9000, academy_path: 'role60', description: '2 or 3 trainings your manager picks for your role.' },
    { id: 'wa279role90', name: 'Your role trainings', section: '90 DAYS', sort: 9001, academy_path: 'role90', description: '5 or 6 trainings your manager picks for your role.' }
  ].map((t) => Object.assign({ active: true, priority: null, parent_id: null, training_id: null, content_pending: false }, t));
  f.onboarding_template = (f.onboarding_template || []).concat(tpl);
  let sid = 99100;
  const steps = [];
  [ONB.lina, ONB.omar, ONB.sam].forEach((o) => tpl.forEach((t) => steps.push({ id: sid++, onboarding_id: o, template_id: t.id, done: false, done_at: null, done_by: null, due_date: t.section === '60 DAYS' ? '2026-11-02' : '2026-12-02' })));
  f.onboarding_steps = (f.onboarding_steps || []).concat(steps);
  f.trainings = (f.trainings || []).concat(TR.map((t) => Object.assign({ active: true, kind: 'video', category: 'Role', minutes: 5, body: null, source: 'hub' }, t)));
  return f;
}

function person(onb, m, day, extra) {
  return Object.assign({ onboarding_id: onb, member_id: m.id, name: m.name, email: m.email, department: 'marketing', title: 'Writer', via: 'reports to you', started_at: null, day,
    total: 40, done: 12, late_count: 0, late: [], steps: [], sections: [], lead_steps: [], help: [], academy: [], quizzes_done: 0, last_done_at: null, next: null }, extra || {});
}
function lead279() {
  return { people: [person(ONB.lina, HIRE, 23, { started_at: '2026-09-03' }), person(ONB.omar, EARLY, 11, { started_at: '2026-09-15' })] };
}

function INIT279(o) {
  o = o || {};
  return `(function(){
  var TR = ${JSON.stringify(TR)}, REC = ${JSON.stringify(REC)}, PATH = ${JSON.stringify(PATH)}, DONE = ${JSON.stringify(DONE)};
  var WHO = ${JSON.stringify({ [ONB.lina]: { name: HIRE.name, mid: HIRE.id, day: 22, start: '2026-09-03' }, [ONB.omar]: { name: EARLY.name, mid: EARLY.id, day: 10, start: '2026-09-15' }, [ONB.sam]: { name: 'Samson', mid: 36, day: 46, start: '2026-08-10' } })};
  var CAN = ${JSON.stringify(o.canPick !== false)}, BY = ${JSON.stringify(o.by || 'Joy Dumansi')};
  var W = window.__W279 = { calls: [], picks: ${JSON.stringify(o.picks || {})}, refuse: null };
  function title(id) { var t = TR.filter(function (x) { return x.id === id; })[0]; return t ? t.title : 'Module ' + id; }
  function done(onb, id) { return String(onb) === '${ONB.lina}' && DONE.indexOf(id) >= 0; }
  function picks(onb) { var p = W.picks[onb] = W.picks[onb] || {}; p['60 DAYS'] = p['60 DAYS'] || []; p['90 DAYS'] = p['90 DAYS'] || []; return p; }
  function opts(onb) {
    var w = WHO[onb]; if (!w) return { error: { message: 'That onboarding plan was not found' } };
    var p = picks(onb), sec = {};
    ['60 DAYS', '90 DAYS'].forEach(function (s) {
      sec[s] = { min: s === '60 DAYS' ? 2 : 5, max: s === '60 DAYS' ? 3 : 6, due: s === '60 DAYS' ? '2026-11-02' : '2026-12-02',
        picked: p[s].map(function (k) { return { training_id: k.training_id, title: title(k.training_id), done: done(onb, k.training_id), auto: !!k.auto, picked_by: k.picked_by }; }) };
      sec[s].done = sec[s].picked.length > 0 && sec[s].picked.every(function (k) { return k.done; });   /* fix round 1: as wa279_role_options */
    });
    return { data: { member: w.name, member_id: w.mid, department: 'marketing', leader: false, day: w.day, sections: sec,
      recommended: REC.map(function (id) { return { training_id: id, title: title(id), path: PATH[id] || null, done: done(onb, id) }; }),
      done_ids: String(onb) === '${ONB.lina}' ? DONE.slice() : [], can_pick: CAN }, error: null };
  }
  function save(a) {
    var onb = a.p_onb, s = a.p_section, w = WHO[onb];
    if (s !== '60 DAYS' && s !== '90 DAYS') return { error: { message: 'Say which section: 60 DAYS or 90 DAYS' } };
    if (!w) return { error: { message: 'That onboarding plan was not found' } };
    if (!CAN) return { error: { message: 'Only the manager, HR or an admin can pick role trainings' } };
    if (W.refuse) { var m = W.refuse; W.refuse = null; return { error: { message: m } }; }
    var cur = picks(onb)[s];
    if (cur.length && cur.every(function (k) { return done(onb, k.training_id); })) return { error: { message: "These trainings are all done, so the list can't change now." } };
    var ids = []; (a.p_training_ids || []).forEach(function (x) { x = Number(x); if (ids.indexOf(x) < 0) ids.push(x); });
    var mn = s === '60 DAYS' ? 2 : 5, mx = s === '60 DAYS' ? 3 : 6, oth = s === '60 DAYS' ? '90 DAYS' : '60 DAYS', p = picks(onb);
    if (ids.length < mn || ids.length > mx) return { error: { message: 'Pick ' + mn + ' or ' + mx + ' role trainings for ' + s.toLowerCase() } };
    for (var i = 0; i < ids.length; i++) {
      var had = p[s].some(function (k) { return k.training_id === ids[i]; });
      if (had) continue;
      if (p[oth].some(function (k) { return k.training_id === ids[i]; })) return { error: { message: '"' + title(ids[i]) + '" is already picked for ' + oth.toLowerCase() + '. A module can only go in one section.' } };
      if (done(onb, ids[i])) return { error: { message: w.name + ' has already finished "' + title(ids[i]) + '". Pick another one.' } };
    }
    p[s] = ids.map(function (id) { return { training_id: id, auto: false, picked_by: BY }; });
    return opts(onb);
  }
  function later(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 40); }); }
  window.__W279_RPC = function (fn, a) {
    if (fn !== 'wa279_role_options' && fn !== 'wa279_role_save') return null;
    W.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(a || {})) });
    return later(fn === 'wa279_role_options' ? opts(a.p_onb) : save(a));
  };
  /* the stub's client gets a door for these two functions (they need their arguments, which window.__WA_RPCS cannot see) */
  var real;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return real; }, set: function (v) {
    real = v;
    if (v && typeof v.createClient === 'function' && !v.__w279) {
      var cc = v.createClient; v.__w279 = true;
      v.createClient = function () { var c = cc.apply(this, arguments), r0 = c.rpc.bind(c); c.rpc = function (fn, a) { var h = window.__W279_RPC(fn, a); return h || r0(fn, a); }; return c; };
    }
  } });
})();`;
}

module.exports = { fx279, lead279, INIT279, ONB, HIRE, EARLY, TR, REC, DONE };
