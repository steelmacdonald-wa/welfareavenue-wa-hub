/* w258fx.js: identities for the wave258 drive (Amanda, the Fundraising lead; Alexis, a new Fundraising member). */
const { loadFixture, WHO } = require('./boot');
WHO.amanda = { email: 'amanda.zoldak@welfareavenue.com', name: 'Amanda Zoldak', role: 'staff', patch: [] };
WHO.alexis = { email: 'alexis.walter@welfareavenue.com', name: 'Alexis Walter', role: 'staff', patch: [] };
const FUNDPAGES = {"hr":"lead","crm":"all","bank":"all","fund":"all","team":"all","board":"none","brain":"none","goals":"all","opsto":"lead","create":"all","mypage":"all","opsmtl":"all","photos":"all","studio":"all","agendas":"lead","goalmap":"all","hubmail":"lead","progdev":"lead","activity":"none","calendar":"all","finances":"lead","hrcentre":"none","orgchart":"all","orggoals":"all","ourstory":"all","overview":"none","partners":"all","projects":"all","requests":"all","training":"all","dashboard":"all","documents":"all","marketing":"lead","adminpanel":"none","committees":"lead","contentcal":"all","fundevents":"all","governance":"none","fundraising":"all","socialstats":"all","transcripts":"lead","volunteering":"lead","importantinfo":"all"};
function fx258() {
  const fx = JSON.parse(JSON.stringify(loadFixture()));
  fx.team_members = fx.team_members || [];
  fx.team_members.push({ id: 27, name: 'Amanda', role: 'Events manager / co-lead', color: '#e07a5f', email: 'amanda.zoldak@welfareavenue.com', active: true, department: 'fundraising', responsibilities: [] });
  fx.team_members.push({ id: 30, name: 'Alexis', role: 'Individual / recurring donors', color: '#3d405b', email: 'alexis.walter@welfareavenue.com', active: true, department: 'fundraising', responsibilities: [] });
  fx.hub_roles = (fx.hub_roles || []).filter(r => !/amanda|alexis/.test(r.email));
  fx.hub_roles.push({ email: 'amanda.zoldak@welfareavenue.com', role: 'leader', profile: 'fundraising', tabs: null, note: null });
  fx.hub_roles.push({ email: 'alexis.walter@welfareavenue.com', role: 'member', profile: 'fundraising', tabs: null, note: null });
  (fx.hub_access_profiles || []).forEach(p => { if (p.key === 'fundraising') p.pages = Object.assign({}, p.pages, FUNDPAGES); });
  return fx;
}
const AMANDA = { email: 'amanda.zoldak@welfareavenue.com', name: 'Amanda Zoldak' };
const ALEXIS = { email: 'alexis.walter@welfareavenue.com', name: 'Alexis Walter' };
module.exports = { fx258, AMANDA, ALEXIS };
