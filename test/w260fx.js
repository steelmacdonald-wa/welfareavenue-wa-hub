/* w260fx.js: the fixture for the wave260 drive (train to unlock, the Dashboard for the admins).
   test/w260fx.json holds the live page tours (trainings tour:*, 16/10/26) and the live access profiles (no personal data).
   Identities: Shima (leader, Program Development, named in dashboard_people), Amanda (leader, Fundraising), the member
   Samson (HR profile, boot.js), an admin, a director on the board view. */
const fs = require('fs');
const path = require('path');
const { loadFixture, WHO } = require('./boot');
WHO.shima = { email: 'shima.butera@welfareavenue.com', name: 'Shima Butera', role: 'staff', patch: [] };
WHO.amanda = { email: 'amanda.zoldak@welfareavenue.com', name: 'Amanda Zoldak', role: 'staff', patch: [] };
const LIVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'w260fx.json'), 'utf8'));

function fx260(o) {
  o = o || {};
  const fx = JSON.parse(JSON.stringify(loadFixture()));
  /* the live page tours replace the old fixture's */
  fx.trainings = (fx.trainings || []).filter(t => !/^tour:/.test(String(t.key || ''))).concat(LIVE.tours.map(t => Object.assign({}, t)));
  fx.hub_access_profiles = LIVE.profiles.map(p => Object.assign({}, p));
  fx.team_members = (fx.team_members || []).filter(m => !/amanda\.zoldak/.test(String(m.email || '')));
  fx.team_members.push({ id: 27, name: 'Amanda', role: 'Events manager / co-lead', color: '#e07a5f', email: 'amanda.zoldak@welfareavenue.com', active: true, department: 'fundraising', responsibilities: [] });
  fx.hub_roles = (fx.hub_roles || []).filter(r => !/amanda|shima/.test(r.email));
  fx.hub_roles.push({ email: 'amanda.zoldak@welfareavenue.com', role: 'leader', profile: 'fundraising', tabs: null, note: null });
  fx.hub_roles.push({ email: 'shima.butera@welfareavenue.com', role: 'leader', profile: 'progdev', tabs: null, note: null });
  /* Amanda has toured Requests; nobody else has toured anything but Steel */
  const req = LIVE.tours.filter(t => t.key === 'tour:requests')[0];
  fx.training_progress = (fx.training_progress || []).filter(p => !LIVE.tours.some(t => t.id === p.training_id));
  fx.training_progress.push({ id: 99001, training_id: req.id, person_name: 'Amanda', email: 'amanda.zoldak@welfareavenue.com', status: 'done', done_at: '2026-09-20T15:00:00Z', pct: 100 });
  fx.app_config = (fx.app_config || []).filter(x => ['dashboard_people', 'page_gate', 'page_gate_exempt', 'page_gate_map'].indexOf(x.key) < 0);
  fx.app_config.push({ key: 'dashboard_people', value: JSON.stringify(o.dash || ['shima.butera@welfareavenue.com']) });
  fx.app_config.push({ key: 'page_gate', value: o.gate === false ? 'off' : 'on' });
  fx.app_config.push({ key: 'page_gate_exempt', value: JSON.stringify(o.exempt || []) });
  return fx;
}
/* what wa260_page_tours() answers for the admin view (a small made-up sample in the shape of the function) */
function adminRows() {
  const keys = ['team', 'requests', 'calendar', 'overview', 'grants'];
  const ppl = [['amanda.zoldak@welfareavenue.com', 'Amanda', 'leader'], ['shima.butera@welfareavenue.com', 'Shima', 'leader'], ['samson.jules@welfareavenue.com', 'Samson', 'member']];
  const out = [];
  ppl.forEach(p => keys.forEach(k => out.push({ email: p[0], name: p[1], role: p[2], profile: null, tour_key: k, tour_title: k, minutes: 2,
    can_open: !(k === 'overview' && p[1] !== 'Shima') && !(k === 'grants' && p[1] === 'Samson'), done: p[1] === 'Amanda' && k === 'requests', exempt: false })));
  return out;
}
module.exports = { fx260, adminRows, LIVE };
