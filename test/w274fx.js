/* w274fx.js: wave274, the Toronto Volunteers app. The base fixture plus, relative to the frozen clock (2026-09-25):
   three Toronto events (TO-26-1 past and completed on 23 Aug, TO-26-2 in 9 days on 4 Oct, TO-26-3 in 40 days on 4 Nov), their
   crews, a Toronto pool of contacts in the CRM (tags, a city in the GTA, or only a crew place; two schools; area and days
   answers; one with no volunteer record; one merged away) with two Montreal contacts that must stay out, who the meals go to
   for two events (one organization not named publicly), and one Montreal serving on the same day as a Toronto event.
   Every person here is made up (@example.com, 555 numbers). */
const { loadFixture } = require('./boot');
const EV = { past: 2741, next: 2742, later: 2743, mtl: 2750 };
const C = { priya: 27001, jordan: 27002, mei: 27003, omar: 27004, lucia: 27005, theo: 27006, noah: 27007, ava: 27008, kiran: 27009, zoe: 27010, ethan: 27011, rosa: 27012, marc: 27013, lea: 27014 };
function fixture() {
  const fx = loadFixture();
  const ev = (id, code, date, o) => Object.assign({ id, code, event_date: date, start_time: '10:00:00', title: 'Free meal event', location: 'Toronto', kind: 'meal', status: 'planned', notes: null, plan_note: null, season: 'Fall',
    planned_meals: null, kitchen_place: null, kitchen_contact: null, kitchen_shift: null, whatsapp_url: null, spot_counts: null, created_at: '2026-08-01T12:00:00Z', itinerary_url: null }, o || {});
  const tor = [
    ev(EV.past, 'TO-26-1', '2026-08-23', { status: 'completed', start_time: '14:00:00', planned_meals: 40, kitchen_place: 'Ralph Thornton Community Centre', kitchen_shift: '14:00 to 18:00', season: 'Summer' }),
    ev(EV.next, 'TO-26-2', '2026-10-04', { planned_meals: 50, kitchen_place: 'Ralph Thornton Community Centre', kitchen_shift: '10:00 to 14:00', kitchen_contact: 'The front desk, ask for the kitchen lead', spot_counts: { server: 3 } }),
    ev(EV.later, 'TO-26-3', '2026-11-04', { title: 'Student cook night', start_time: '15:00:00', kitchen_place: 'TMU community kitchen', kitchen_shift: '15:00 to 19:00' })
  ];
  const mtl = { id: EV.mtl, code: 'WA-26-40', event_date: '2026-10-04', kind: 'service', location: 'Montreal', status: 'planned', title: null, notes: null, plan_note: null, season: 'Fall', planned_meals: 120, created_at: '2026-08-01T12:00:00Z', itinerary_url: null };
  fx.volunteer_events = (fx.volunteer_events || []).concat(tor, [mtl]);
  const sum = (e, conf, count) => ({ id: e.id, code: e.code, event_date: e.event_date, season: e.season, location: e.location, notes: null, status: e.status, kind: e.kind, title: e.title, roster_confirmed: conf, roster_count: count, steps_done: 0, steps_total: 0 });
  fx.volunteer_event_summary = (fx.volunteer_event_summary || []).concat([sum(tor[0], 3, 4), sum(tor[1], 3, 7), sum(tor[2], 0, 1), sum(mtl, 0, 0)]);

  /* the Toronto pool in the CRM */
  const K = (id, name, o) => Object.assign({ id, full_name: name, first_name: name.split(' ')[0], last_name: 'Example', primary_email: name.split(' ')[0].toLowerCase() + '@example.com', emails: [name.split(' ')[0].toLowerCase() + '@example.com'],
    phones: ['416-555-0' + String(id).slice(-3)], city: null, tags: [], kinds: ['volunteer'], volunteer_id: null, org_id: null, merged_into: null, created_at: '2026-05-01T12:00:00Z', last_activity_at: null, source: 'keela' }, o || {});
  const people = [
    K(C.priya, 'Priya Example', { tags: ['toronto volunteer'], volunteer_id: 27101, created_at: '2025-11-07T15:00:00Z' }),
    K(C.jordan, 'Jordan Example', { tags: ['toronto student'], org_id: 9001, volunteer_id: 27102, created_at: '2026-02-10T15:00:00Z' }),
    K(C.mei, 'Mei Example', { tags: ['toronto volunteer'], org_id: 9002, volunteer_id: 27103, created_at: '2026-03-02T15:00:00Z' }),
    K(C.omar, 'Omar Example', { tags: ['Toronto Volunteer'], volunteer_id: 27104, created_at: '2026-03-20T15:00:00Z' }),
    K(C.lucia, 'Lucia Example', { city: 'Scarborough', volunteer_id: 27105, created_at: '2026-04-11T15:00:00Z' }),
    K(C.theo, 'Theo Example', { tags: ['toronto'], volunteer_id: 27106, created_at: '2026-06-01T15:00:00Z' }),
    K(C.noah, 'Noah Example', { volunteer_id: 27107, source: 'hub', created_at: '2026-06-15T15:00:00Z' }),
    K(C.ava, 'Ava Example', { tags: ['toronto student'], created_at: '2026-09-20T15:00:00Z' }),
    K(C.kiran, 'Kiran Example', { tags: ['toronto volunteer'], org_id: 9001, volunteer_id: 27109, created_at: '2026-08-05T15:00:00Z' }),
    K(C.zoe, 'Zoe Example', { city: 'Mississauga', volunteer_id: 27110, created_at: '2026-07-01T15:00:00Z' }),
    K(C.ethan, 'Ethan Example', { tags: ['toronto volunteer'], volunteer_id: 27111, merged_into: C.priya }),
    K(C.rosa, 'Rosa Example', { tags: ['toronto volunteer'], volunteer_id: 27112, primary_email: null, emails: [], phones: [], created_at: '2026-01-15T15:00:00Z' }),
    K(C.marc, 'Marc Example', { city: 'Montreal', tags: ['montreal'], volunteer_id: 27113 }),
    K(C.lea, 'Lea Example', { city: 'Laval', volunteer_id: 27114 })
  ];
  fx.crm_contacts = (fx.crm_contacts || []).concat(people);
  fx.volunteer_orgs = (fx.volunteer_orgs || []).concat([{ id: 9001, name: 'Toronto Metropolitan University', short: 'TMU' }, { id: 9002, name: 'University of Toronto', short: 'UofT' }]);
  fx.crm_fields = (fx.crm_fields || []).concat([{ id: 9101, key: 'gta_area' }, { id: 9102, key: 'days_available' }, { id: 9103, key: 'age_16_plus' }, { id: 9104, key: 'photo_consent' }]);
  const A = (cid, area, days) => [area == null ? null : { contact_id: cid, field_id: 9101, value: area }, days == null ? null : { contact_id: cid, field_id: 9102, value: days }, { contact_id: cid, field_id: 9103, value: 'Yes' }].filter(Boolean);
  fx.crm_contact_fields = (fx.crm_contact_fields || []).concat(
    A(C.priya, 'Downtown Toronto', ['Saturday', 'Sunday']), A(C.jordan, 'Downtown Toronto', ['Sunday']), A(C.mei, 'North York', 'Saturday, Sunday'),
    A(C.omar, 'Etobicoke', ['Monday', 'Wednesday']), A(C.lucia, 'Scarborough', ['Sunday']), A(C.theo, 'East York', ['Friday', 'Saturday']),
    A(C.ava, 'York', ['Sun']), A(C.kiran, 'Midtown (Yonge-Eglinton)', ['Tuesday', 'Sunday']), A(C.zoe, null, 'Weekends'), A(C.rosa, 'Downtown Toronto', [])
  );

  /* the crews */
  let rid = 27400;
  const R = (event, cid, role, status, o) => { const p = people.find(x => x.id === cid); rid++; return Object.assign({ id: rid, event_id: event, person_id: p.volunteer_id, person_name: p.full_name, role, status, confirm_status: status === 'Confirmed' ? 'confirmed' : status === 'Unavailable' ? 'declined' : null,
    confirmed_at: status === 'Confirmed' ? '2026-09-20T15:00:00Z' : null, notes: null, detail: { source: 'toronto', contact_id: cid }, sort: rid, confirm_token: 'tok' + rid + 'abcdefghij', confirm: null, recipe_id: null }, o || {}); };
  fx.event_roster = (fx.event_roster || []).concat([
    R(EV.past, C.priya, 'team_leader', 'Confirmed'), R(EV.past, C.jordan, 'cook', 'Confirmed'), R(EV.past, C.mei, 'cook', 'Confirmed'), R(EV.past, C.lucia, 'server', 'Unavailable', { confirmed_at: '2026-08-20T15:00:00Z' }),
    R(EV.next, C.priya, 'team_leader', 'Confirmed'), R(EV.next, C.jordan, 'cook', 'Confirmed'), R(EV.next, C.mei, 'cook', 'TBD'), R(EV.next, C.omar, 'cook', 'Unavailable'),
    R(EV.next, C.lucia, 'server', 'Waiting For Response'), R(EV.next, C.theo, 'server', 'Confirmed'), R(EV.next, C.noah, 'driver', 'TBD', { detail: { source: 'sheet', phone: '416-555-0107' } }),
    R(EV.later, C.jordan, 'cook', 'TBD')
  ]);
  /* who the meals go to */
  fx.volunteer_event_recipients = [
    { id: 27501, event_id: EV.next, partner_id: null, name: 'Eva’s Initiatives for Homeless Youth', meals: 40, meals_delivered: null, dietary: { halal: true, nut_free: true, vegetarian: 3, vegan: 1, other: '' }, drop_off: '12:30 at the side door', address: null,
      contact_name: 'Riley Example', contact_email: 'riley@example.com', contact_phone: '416-555-0134', private: false, note: null, sort: 1 },
    { id: 27502, event_id: EV.past, partner_id: null, name: 'St. Felix Centre', meals: 25, meals_delivered: 25, dietary: { halal: false, nut_free: true, vegetarian: 0, vegan: 0, other: '' }, drop_off: '17:30', address: null,
      contact_name: 'Sky Example', contact_email: 'sky@example.com', contact_phone: null, private: false, note: null, sort: 1 },
    { id: 27503, event_id: EV.past, partner_id: null, name: 'A partner we support quietly', meals: 15, meals_delivered: 15, dietary: {}, drop_off: null, address: null, contact_name: null, contact_email: null, contact_phone: null, private: true, note: null, sort: 2 }
  ];
  return fx;
}
module.exports = fixture;
module.exports.EV = EV;
module.exports.C = C;
