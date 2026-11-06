/* w274breakfx.js: wave274's worst case, for test/w274break.js. The base fixture plus Toronto data shaped exactly like
   test/w274fx.js, but chosen to break the screens rather than to show them off (the break-ui method: plausible values, or
   the limits the app's own forms accept). Relative to the frozen clock (Fri 2026-09-25):
   - worst(): 40 upcoming events (one today, one cancelled, one in 400 days, one with every target at 0, the rest with empty
     crews) and 80 past ones; the next event has a very long title, kitchen and kitchen time, 60 people on the kitchen crew,
     9 on a serving crew of 4, a lead on a target of 0, and 8 organizations (a 160-character name, 2000 meals, every
     dietary flag and a long "other", two not named publicly, long addresses and an unbreakable email); a pool of 300
     volunteers whose newest rows are the hard ones (long and one-letter names, a missing name, missing email and phone,
     Arabic, Chinese, emoji, a school with a very long name).
   - empty(): no Toronto events, no Toronto volunteers.
   - one(): one event (in 400 days), one volunteer on it, one organization with 1 meal.
   - huge(): 1999 confirmed of 2000 places, and 2000 meals delivered.
   Every person here is made up (@example.com and .example.org addresses, 555 numbers). */
const { loadFixture } = require('./boot');

const TODAY = '2026-09-25';
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const EVB = 274000;   /* event ids */
const CB = 2740000;   /* contact ids */
const VB = 2741000;   /* volunteer ids */
const RB = 2745000;   /* roster ids */
const OB = 27490;     /* school ids */

const LONG_TITLE = 'Thanksgiving community cook night with the Toronto Metropolitan University Nutrition and Food Students’ Association and friends';
const LONG_KITCHEN = 'Ralph Thornton Community Centre, main hall kitchen on the second floor (use the Queen Street East entrance)';
const LONG_SHIFT = '10:00 to 14:00 (doors 9:30, clean-up after)';
const ORG160 = 'Eva’s Initiatives for Homeless Youth, Eva’s Phoenix transitional housing and employment program, with the youth shelter on Augusta Avenue in Kensington Mkt';
const LONG_OTHER = 'No pork or pork by-products, low sodium for 12 seniors, two gluten-free (celiac), one shellfish allergy, soft foods for residents with dental work';
const LONG_SCHOOL = 'The Governing Council of the University of Toronto, University of Toronto Scarborough campus (Department of Health and Society)';

/* the hard people first (newest), then ordinary ones */
const HARD = [
  { name: 'Aleksandra Wiśniewska-Kowalczyk', email: 'aleksandra.wisniewska-kowalczyk.volunteer@northwind-industries-holdings.example.com', org: OB + 3, tags: ['toronto student'] },
  { name: 'Christopher Alexander Montgomery-Fitzgerald III', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', tags: ['toronto volunteer'] },
  { name: 'J', email: 'j@example.com', tags: ['toronto'] },
  { name: null, email: 'no.name.given.on.the.keela.form.at.all@northwind-industries-holdings.example.com', tags: ['toronto volunteer'] },
  { name: 'Seán O’Brien-Ó Súilleabháin', email: null, phone: null, tags: ['toronto volunteer'] },
  { name: 'نور الهدى عبد الرحمن', email: 'nour.abdelrahman@example.com', tags: ['toronto student'], org: OB + 1 },
  { name: '王秀英', email: 'wang.xiuying@example.com', tags: ['toronto volunteer'] },
  { name: '🦊 Fox', email: 'fox@example.com', tags: ['toronto'] },
  { name: '👩🏽‍💻 Priya Ramanathan-Venkatasubramanian', email: 'priya.ramanathan-venkatasubramanian@example.com', org: OB + 4, tags: ['toronto student'] },
  { name: 'Đặng Thị Ngọc Hân', email: 'dang.han@example.com', city: 'Scarborough' },
  { name: 'María José de la Cruz y Fernández', email: 'first.last+toronto-volunteer-notifications@example.com', tags: ['toronto volunteer'] },
  { name: '  Sam   Lee ', email: 'sam.lee@example.com', tags: ['Toronto Volunteer'] },
  { name: 'Jo', email: 'jo@example.com', phone: null, city: 'Mississauga' },
  { name: 'Konstantin Oberhauser-Wettstein', email: 'k@example.com', org: OB + 2, tags: ['toronto student'] }
];
const FIRST = ['Amara', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farah', 'Gabe', 'Hana', 'Isaac', 'Jade', 'Kofi', 'Lina', 'Mateo', 'Nia', 'Owen', 'Pia', 'Quinn', 'Ravi', 'Sofia', 'Tariq'];
const LAST = ['Example', 'Sample', 'Tester', 'Demo', 'Placeholder'];
const AREAS = ['Downtown Toronto', 'Midtown (Yonge-Eglinton)', 'North York', 'East York', 'York', 'Etobicoke', 'Scarborough'];
const DAYS = [['Saturday', 'Sunday'], ['Sunday'], 'Weekends', ['Monday', 'Wednesday', 'Friday'], 'Any day', [], ['Tuesday', 'Thursday', 'Saturday', 'Sunday']];

function base() {
  const fx = loadFixture();
  fx.volunteer_orgs = (fx.volunteer_orgs || []).concat([
    { id: OB + 1, name: 'Toronto Metropolitan University', short: 'TMU' },
    { id: OB + 2, name: 'University of Toronto', short: 'UofT' },
    { id: OB + 3, name: LONG_SCHOOL, short: null },
    { id: OB + 4, name: 'Toronto District School Board, Jarvis Collegiate Institute', short: 'Jarvis Collegiate Institute Students’ Council' }
  ]);
  fx.crm_fields = (fx.crm_fields || []).concat([{ id: 9101, key: 'gta_area' }, { id: 9102, key: 'days_available' }, { id: 9103, key: 'age_16_plus' }, { id: 9104, key: 'photo_consent' }]);
  fx.crm_contacts = fx.crm_contacts || []; fx.crm_contact_fields = fx.crm_contact_fields || [];
  fx.volunteer_events = fx.volunteer_events || []; fx.volunteer_event_summary = fx.volunteer_event_summary || [];
  fx.event_roster = fx.event_roster || []; fx.volunteer_event_recipients = [];
  return fx;
}
function ev(id, code, date, o) {
  return Object.assign({ id, code, event_date: date, start_time: '10:00:00', title: 'Free meal event', location: 'Toronto', kind: 'meal', status: 'planned', notes: null, plan_note: null, season: 'Fall',
    planned_meals: null, kitchen_place: 'Ralph Thornton Community Centre', kitchen_contact: null, kitchen_shift: '10:00 to 14:00', whatsapp_url: null, spot_counts: null, created_at: '2026-08-01T12:00:00Z', itinerary_url: null }, o || {});
}
function summary(e) { return { id: e.id, code: e.code, event_date: e.event_date, season: e.season, location: e.location, notes: null, status: e.status, kind: e.kind, title: e.title, roster_confirmed: 0, roster_count: 0, steps_done: 0, steps_total: 0 }; }
function people(n) {
  const out = [], fields = [];
  for (let i = 0; i < n; i++) {
    const h = HARD[i], id = CB + i, vid = VB + i;
    let name, email, phone, o = {};
    if (h) { name = h.name; email = h.email; phone = h.phone === null ? null : '416-555-' + String(1000 + i).slice(-4); o = h; }
    else { name = FIRST[i % FIRST.length] + ' ' + LAST[Math.floor(i / FIRST.length) % LAST.length] + ' ' + (i + 1); email = 'volunteer' + (i + 1) + '@example.com'; phone = '647-555-' + String(1000 + i).slice(-4); }
    const created = new Date(Date.UTC(2026, 8, 24, 12) - i * 864e5).toISOString();
    out.push({ id, full_name: name, first_name: name ? String(name).trim().split(/\s+/)[0] : null, last_name: name ? 'Example' : null, primary_email: email || null, emails: email ? [email] : [], phones: phone ? [phone] : [],
      city: o.city || null, tags: o.tags || (o.city ? [] : ['toronto volunteer']), kinds: ['volunteer'], volunteer_id: vid, org_id: o.org || (!h && i % 9 === 0 ? OB + 1 + (i % 2) : null), merged_into: null, created_at: created, last_activity_at: null, source: 'keela' });
    const area = i === 1 ? 'Midtown (Yonge-Eglinton), near Eglinton station on Line 1' : i % 6 === 5 ? null : AREAS[i % AREAS.length];
    if (area) fields.push({ contact_id: id, field_id: 9101, value: area });
    fields.push({ contact_id: id, field_id: 9102, value: i === 0 ? 'Any day' : DAYS[i % DAYS.length] });
    fields.push({ contact_id: id, field_id: 9103, value: 'Yes' });
  }
  return { list: out, fields };
}
let rid = RB;
function row(event, c, role, status) {
  rid++;
  return { id: rid, event_id: event, person_id: c ? c.volunteer_id : VB + 90000 + rid, person_name: c ? c.full_name : 'Volunteer ' + (rid - RB), role, status, confirm_status: status === 'Confirmed' ? 'confirmed' : status === 'Unavailable' ? 'declined' : null,
    confirmed_at: status === 'Confirmed' ? '2026-09-20T15:00:00Z' : null, notes: null, detail: c ? { source: 'toronto', contact_id: c.id } : { source: 'sheet' }, sort: rid, confirm_token: 'tok' + rid + 'abcdefghij', confirm: null, recipe_id: null };
}

const W = { hero: EVB + 1, zero: EVB + 2, cancelled: EVB + 3, far: EVB + 4, empty: EVB + 5 };
function worst() {
  rid = RB;
  const fx = base(), P = people(300);
  fx.crm_contacts = fx.crm_contacts.concat(P.list); fx.crm_contact_fields = fx.crm_contact_fields.concat(P.fields);
  const tor = [];
  /* today: the hero */
  tor.push(ev(W.hero, 'TO-26-121', TODAY, { title: LONG_TITLE, kitchen_place: LONG_KITCHEN, kitchen_shift: LONG_SHIFT, planned_meals: 2000, start_time: '09:30:00',
    kitchen_contact: 'The front desk at the Queen Street East entrance, ask for the community kitchen coordinator on duty',
    whatsapp_url: 'https://chat.whatsapp.com/KxQ8m2Lr7Vb9TzYp3NcW1eAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp', spot_counts: { team_leader: 0, cook: 4, server: 4, driver: 1, photographer: 0 } }));
  /* every target at 0 and nobody on it */
  tor.push(ev(W.zero, 'TO-26-122', '2026-09-27', { spot_counts: { team_leader: 0, cook: 0, server: 0, driver: 0, photographer: 0 }, kitchen_place: null, kitchen_shift: null }));
  tor.push(ev(W.cancelled, 'TO-26-123', '2026-10-04', { status: 'cancelled', title: 'Cancelled: the kitchen was double-booked' }));
  tor.push(ev(W.far, 'TO-27-40', addDays(TODAY, 400), { title: 'Free meal event, next fall', kitchen_place: null }));
  /* the rest of the 40 upcoming: weekly, crews empty (the default targets) */
  for (let k = 0; tor.length < 40; k++) tor.push(ev(W.empty + k, 'TO-26-' + (124 + k), addDays('2026-10-11', 7 * k), { title: k % 5 === 0 ? 'Student cook night' : 'Free meal event' }));
  /* 80 past: completed with counts, completed without, cancelled, and some never wrapped up */
  const past = [];
  for (let k = 0; k < 80; k++) {
    const date = addDays('2026-09-20', -14 * k), id = EVB + 500 + k;
    const status = k % 13 === 4 ? 'cancelled' : k % 11 === 2 ? 'planned' : 'completed';
    past.push(ev(id, 'TO-' + date.slice(2, 4) + '-' + (80 - k), date, { status, title: k % 7 === 3 ? LONG_TITLE : 'Free meal event', season: 'Past' }));
    if (status === 'completed' && k % 4 !== 1) fx.volunteer_event_recipients.push({ id: 2748000 + k, event_id: id, partner_id: null, name: k === 0 ? ORG160 : 'St. Felix Centre', meals: 40, meals_delivered: k === 0 ? 2000 : 30 + (k % 20), dietary: {}, drop_off: null, address: null, contact_name: null, contact_email: null, contact_phone: null, private: k % 6 === 5, note: null, sort: 1 });
  }
  fx.volunteer_events = fx.volunteer_events.concat(tor, past);
  fx.volunteer_event_summary = fx.volunteer_event_summary.concat(tor.concat(past).map(summary));
  /* the hero's crew: a lead on a target of 0, 60 on the kitchen crew of 4, 9 on the serving crew of 4, delivery empty */
  const R = [row(W.hero, P.list[20], 'team_leader', 'Confirmed')];
  for (let i = 0; i < 60; i++) R.push(row(W.hero, P.list[i], 'cook', i % 15 === 7 ? 'Unavailable' : i % 10 === 3 ? 'TBD' : i % 10 === 6 ? 'Waiting For Response' : 'Confirmed'));
  for (let i = 0; i < 9; i++) R.push(row(W.hero, P.list[60 + i], 'server', 'Confirmed'));
  /* a past event's crew, so people have a last event */
  for (let i = 0; i < 12; i++) R.push(row(EVB + 500, P.list[i], i ? 'cook' : 'team_leader', 'Confirmed'));
  fx.event_roster = fx.event_roster.concat(R);
  /* who the meals go to, for the hero: 8 organizations */
  const rec = (n, o) => Object.assign({ id: 2747000 + n, event_id: W.hero, partner_id: null, name: 'Organization ' + n, meals: 40, meals_delivered: null, dietary: {}, drop_off: null, address: null, contact_name: null, contact_email: null, contact_phone: null, private: false, note: null, sort: n }, o);
  fx.volunteer_event_recipients = fx.volunteer_event_recipients.concat([
    rec(1, { name: ORG160, meals: 2000, dietary: { halal: true, nut_free: true, vegetarian: 312, vegan: 148, other: LONG_OTHER }, drop_off: '12:30 at the side door on the laneway, ring the buzzer marked Kitchen and wait for staff', address: '1 Leonard Avenue, Unit 104, rear entrance off the laneway behind the Scott Mission, Toronto, Ontario M5T 2R1',
      contact_name: 'Riley Morgan-Example, intake and community partnerships coordinator', contact_email: 'intake.coordinator.supportive-housing@northwind-community-services.example.org', contact_phone: '+1 (416) 555-0134 extension 2207', note: 'They asked for the meals in two batches: 1200 at 12:30 and the rest at 14:00. Label every tray with the allergens.' }),
    rec(2, { name: 'Fred Victor', meals: 1, dietary: { halal: true } }),
    rec(3, { name: 'A shelter we support quietly', meals: 35, private: true }),
    rec(4, { name: 'A second partner not named publicly', meals: null, private: true }),
    rec(5, { name: 'St. Felix Centre', meals: 60, dietary: { nut_free: true, vegetarian: 1, vegan: 0, other: '' }, drop_off: '17:30' }),
    rec(6, { name: 'Sistering', meals: 0 }),
    rec(7, { name: 'The 519', meals: 120, contact_email: 'a@b.co' }),
    rec(8, { name: 'Margaret’s Housing and Community Support Services, East Toronto drop-in', meals: 999, dietary: { other: 'Halal only, no exceptions' } })
  ]);
  return fx;
}

function empty() { rid = RB; return base(); }

const O = { ev: EVB + 900 };
function one() {
  rid = RB;
  const fx = base(), P = people(1);
  fx.crm_contacts = fx.crm_contacts.concat(P.list); fx.crm_contact_fields = fx.crm_contact_fields.concat(P.fields);
  const e = ev(O.ev, 'TO-27-1', addDays(TODAY, 400), { planned_meals: 1, spot_counts: { team_leader: 1, cook: 0, server: 0, driver: 0, photographer: 0 } });
  fx.volunteer_events = fx.volunteer_events.concat([e]); fx.volunteer_event_summary = fx.volunteer_event_summary.concat([summary(e)]);
  fx.event_roster = fx.event_roster.concat([row(O.ev, P.list[0], 'team_leader', 'Confirmed')]);
  fx.volunteer_event_recipients = [{ id: 2747900, event_id: O.ev, partner_id: null, name: 'Sistering', meals: 1, meals_delivered: null, dietary: { vegan: 1 }, drop_off: null, address: null, contact_name: null, contact_email: null, contact_phone: null, private: false, note: null, sort: 1 }];
  return fx;
}

const H = { ev: EVB + 950, past: EVB + 951 };
function huge() {
  rid = RB;
  const fx = base(), P = people(40);
  fx.crm_contacts = fx.crm_contacts.concat(P.list); fx.crm_contact_fields = fx.crm_contact_fields.concat(P.fields);
  const e = ev(H.ev, 'TO-26-999', '2026-10-04', { planned_meals: 2000, spot_counts: { team_leader: 1, cook: 1200, server: 799, driver: 0, photographer: 0 } });
  const p = ev(H.past, 'TO-26-998', '2026-09-20', { status: 'completed' });
  fx.volunteer_events = fx.volunteer_events.concat([e, p]); fx.volunteer_event_summary = fx.volunteer_event_summary.concat([summary(e), summary(p)]);
  const R = [row(H.ev, P.list[0], 'team_leader', 'Confirmed')];
  for (let i = 0; i < 1200; i++) R.push(row(H.ev, i < 39 ? P.list[i + 1] : null, 'cook', 'Confirmed'));
  for (let i = 0; i < 798; i++) R.push(row(H.ev, null, 'server', 'Confirmed'));
  fx.event_roster = fx.event_roster.concat(R);
  fx.volunteer_event_recipients = [
    { id: 2747950, event_id: H.ev, partner_id: null, name: 'Fred Victor', meals: 2000, meals_delivered: null, dietary: {}, drop_off: null, address: null, contact_name: null, contact_email: null, contact_phone: null, private: false, note: null, sort: 1 },
    { id: 2747951, event_id: H.past, partner_id: null, name: 'Fred Victor', meals: 2000, meals_delivered: 2000, dietary: {}, drop_off: null, address: null, contact_name: null, contact_email: null, contact_phone: null, private: false, note: null, sort: 1 }
  ];
  return fx;
}

module.exports = { worst, empty, one, huge, W, O, H, CB, VB, TODAY, LONG_TITLE, ORG160 };
