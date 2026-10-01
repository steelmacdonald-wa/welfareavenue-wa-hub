const { loadFixture } = require('./boot');
function fixture() {
  const fx = loadFixture();
  const EV = 900, DAY = '2026-10-02';
  fx.volunteer_events = (fx.volunteer_events || []).concat([{ id: EV, code: 'WA-26-90', kind: 'service', notes: null, title: null, season: 'Fall', status: 'planned', location: 'Montreal', event_date: DAY, itinerary_url: null, planned_meals: 120, format: null, kitchen_place: null, kitchen_shift: null, kitchen_contact: null, ingredients_note: null }]);
  fx.volunteer_event_summary = (fx.volunteer_event_summary || []).concat([{ id: EV, code: 'WA-26-90', event_date: DAY, season: 'Fall', location: 'Montreal', notes: null, status: 'planned', kind: 'service', title: 'Sunday serving', roster_confirmed: 2, roster_count: 5, steps_done: 0, steps_total: 0, extras_total: 0, extras_open: 0, format: null, roster_by_link: 1, roster_declined: 1, roster_texted: 1 }]);
  const R = (id, name, role, status, extra) => Object.assign({ id, event_id: EV, person_id: null, person_name: name, role, status, sort: id, notes: null, detail: { phone: '5145550' + String(id).slice(-3) }, confirm_token: 'tok' + id + 'abcdefghijk', confirm_status: null, confirmed_at: null, confirm: null, recipe_id: null }, extra || {});
  fx.event_roster = (fx.event_roster || []).concat([
    R(9001, 'Nasim Example', 'cook', 'Confirmed', { confirm_status: 'confirmed', confirmed_at: '2026-09-25T18:32:00Z', confirm: { attending: 'yes', via: 'link', cook_location: 'home', neighbourhood: 'Le Plateau', address: '123 Rue Rachel Est' }, recipe_id: 2 }),
    R(9002, 'Iman Example', 'cook', 'Unavailable', { confirm_status: 'declined', confirmed_at: '2026-09-25T19:00:00Z', confirm: { attending: 'no', via: 'reply' } }),
    R(9003, 'Alex Example', 'driver', 'TBD', { confirm: { vehicle: 'SUV', model: 'Toyota RAV4' } }),
    R(9004, 'Eriana Example', 'server', 'Waiting For Response', { confirm: { donations: 'Two bags of clothes' }, signup_noticed_at: '2026-09-20T15:00:00Z' }),
    R(9005, 'Noa Nophone', 'server', 'TBD', { detail: {} }),
    R(9006, 'Sam Handmade', 'team_leader', 'Confirmed')
  ]);
  fx.quo_messages = (fx.quo_messages || []).concat([
    { id: 7001, batch_id: 'b1', person_id: null, phone: '+15145550003', body: 'Hi Alex, ...', status: 'sent', error: null, event_id: EV, sent_by: 'automation', created_at: '2026-09-25T14:00:00Z', direction: 'out', kind: 'confirm', roster_id: 9003, quo_id: 'AC1', handled: null, sent_at: '2026-09-25T14:00:05Z' },
    { id: 7002, batch_id: 'b2', person_id: null, phone: '+15145550002', body: 'no sorry, exams', status: 'received', error: null, event_id: EV, sent_by: 'quo-events', created_at: '2026-09-25T19:00:00Z', direction: 'in', kind: 'inbound', roster_id: 9002, quo_id: 'AC2', handled: 'declined', sent_at: null },
    { id: 7003, batch_id: 'b3', person_id: null, phone: '+15145550003', body: 'What time should I be at the storage unit?', status: 'received', error: null, event_id: EV, sent_by: 'quo-events', created_at: '2026-09-25T19:30:00Z', direction: 'in', kind: 'inbound', roster_id: 9003, quo_id: 'AC3', handled: 'question', sent_at: null }
  ]);
  fx.app_config = (fx.app_config || []).filter(x => !/^sms_|^quo_webhook/.test(x.key)).concat([
    { key: 'sms_mode', value: 'live' }, { key: 'sms_test_phones', value: '4388694539' }, { key: 'sms_confirm_days', value: '7' }, { key: 'sms_confirm_hour', value: '10' }, { key: 'quo_webhook_id', value: '41951 (quo-2026-03-30)' }]);
  fx.recipes = [{ id: 1, name: 'Chana Masala and Naan', sort: 1 }, { id: 2, name: 'Pasta Primavera', sort: 2 }];
  fx.app_config = fx.app_config.concat([{ key: 'sms_survey_url', value: 'https://docs.google.com/forms/d/e/x/viewform' }, { key: 'sms_survey_roles', value: 'server' }, { key: 'sms_survey_hour', value: '18' }, { key: 'cook_pickup_areas', value: 'Le Plateau\nVilleray' }, { key: 'cook_dropoff_place', value: '1500 Rue Berri' }, { key: 'cook_dropoff_time', value: '12:00' }]);
  fx.volunteer_role_guides = [
    { role: 'cook', label_en: 'Cook', label_fr: 'Bénévole en cuisine', photo_id: 47, links: [{ when: 'before', label_en: 'Recipe book', label_fr: 'Livre de recettes', url: 'https://docs.google.com/document/d/r' }], expect_en: ['Cook at home.', 'Driver texts 10 minutes before.'], expect_fr: ['Cuisinez à la maison.'], bring_en: 'Your dish.', bring_fr: 'Votre plat.', arrive_en: 'Ready for pickup.', arrive_fr: 'Prêt.' },
    { role: 'server', label_en: 'Server', label_fr: 'Bénévole au service', photo_id: 28, expect_en: ['Set up.'], expect_fr: ['Installez.'], bring_en: null, bring_fr: null, arrive_en: null, arrive_fr: null }
  ];
  fx.wa_photos = [
    { id: 47, title: 'A home-cooked tray', path_thumb: 'photos/thumb/a.jpg', path_web: 'photos/web/a.jpg', orientation: 'portrait', scene: 'food', status: 'ready', usage: 'ready' },
    { id: 28, title: 'Servers at the table', path_thumb: 'photos/thumb/b.jpg', path_web: 'photos/web/b.jpg', orientation: 'portrait', scene: 'serving', status: 'ready', usage: 'ready' },
    { id: 49, title: 'Drivers on the way', path_thumb: 'photos/thumb/c.jpg', path_web: 'photos/web/c.jpg', orientation: 'landscape', scene: 'volunteers', status: 'ready', usage: 'ready' }
  ];
  fx.volunteer_events.forEach(e => { if (e.id === EV) e.start_time = '12:00:00'; });
  fx.volunteer_role_guides.forEach(g => { g.arrive_offset_min = g.role === 'server' ? 0 : -75; g.duration_min = g.role === 'server' ? 120 : 75; });
  fx.volunteer_role_guides.push({ role: 'team_leader', label_en: 'Team leader', label_fr: 'Responsable', arrive_offset_min: -60, duration_min: 210, itinerary: 'lead_driver', expect_en: [], expect_fr: [] },
    { role: 'community_debrief', label_en: 'Community lead', label_fr: 'Responsable communautaire', arrive_offset_min: -15, duration_min: 150, itinerary: 'community', expect_en: [], expect_fr: [] });
  fx.volunteer_itinerary_settings = [{ key: 'meet_spot', value: 'Maisonneuve side' }, { key: 'storage_place', value: '888 Rue Saint-Antoine W' }, { key: 'storage_access', value: null }, { key: 'dish_place', value: 'Old Brewery Mission' }, { key: 'pickup_lead_min', value: '75' }, { key: 'audit_url', value: 'https://forms.gle/1FqxfNeVq1ZorJUj8' }, { key: 'notes_en', value: 'Gloves on.' }, { key: 'notes_fr', value: 'Des gants.' }];
  fx.app_config.push({ key: 'sms_itinerary_hour', value: '17' });
  const NEEDS = [{ v: 'food', en: 'Food insecurity', fr: 'x' }, { v: 'clothing', en: 'Clothing', fr: 'x' }, { v: 'housing', en: 'Housing', fr: 'x' }];
  fx.volunteer_survey_questions = [
    { id: 1, role: '*', qkey: 'overall', sort: 10, kind: 'choice', label_en: 'Overall, how was your experience?', label_fr: 'x', options: [{ v: 'excellent', en: 'Excellent', fr: 'x' }, { v: 'good', en: 'Good', fr: 'x' }], required: true, other: false, active: true },
    { id: 2, role: 'server', qkey: 'needs', sort: 100, kind: 'multi', label_en: 'Which needs did the people you served tell you about?', label_fr: 'x', options: NEEDS, required: true, other: true, active: true },
    { id: 3, role: 'server', qkey: 'meal_reaction', sort: 120, kind: 'choice', label_en: 'How did people react to the meal?', label_fr: 'x', options: [{ v: 'loved', en: 'They loved it', fr: 'x' }], required: true, other: false, active: true },
    { id: 4, role: 'team_leader', qkey: 'meals', sort: 100, kind: 'number', label_en: 'About how many meals were served?', label_fr: 'x', options: [], required: true, other: false, min_v: 0, max_v: 1000, active: true },
    { id: 5, role: 'cook', qkey: 'recipe', sort: 100, kind: 'choice', label_en: 'How was the recipe?', label_fr: 'x', options: [{ v: 'clear', en: 'Clear', fr: 'x' }], required: true, other: false, active: true },
    { id: 6, role: '*', qkey: 'improve', sort: 810, kind: 'text', label_en: 'What is one thing we could do better next time?', label_fr: 'x', options: [], required: false, other: false, active: true }
  ];
  fx.volunteer_survey_responses = [
    { id: 1, roster_id: 9004, event_id: EV, role: 'server', lang: 'en', answers: { overall: 'excellent', needs: ['food', 'clothing', { other: 'Winter boots' }], meal_reaction: 'loved', improve: 'More <b>gloves</b>' }, submitted_at: '2026-10-02T19:00:00Z', updated_at: null },
    { id: 2, roster_id: 9006, event_id: EV, role: 'team_leader', lang: 'fr', answers: { overall: 'good', meals: 110 }, submitted_at: '2026-10-02T19:30:00Z', updated_at: null }
  ];
  fx.volunteer_people = (fx.volunteer_people || []).slice(0, 5).map((p, i) => Object.assign({}, p, { contact_id: 7000 + i }));
  if (!fx.volunteer_people.length) fx.volunteer_people = [{ id: 501, full_name: 'Eriana Example', emails: ['e@gmail.com'], phones: ['5145550004'], roles: ['server'], tags: ['server'], notes: null, address: null, needs_review: false, contact_id: 7000 }];
  return fx;
}
module.exports = fixture;
