#!/usr/bin/env node
/* wa202_starters.js (03/10/26): the email studio's ten starter templates, rendered with the studio's own renderer
   (build/parts202/c_blocks.js, MAIL202) into build/data/wa202_email_studio_starters.sql.
   Steel's shelves: volunteers (welcome and serving; call-outs and events) and donors (thanks and impact; appeals and events).
   Words in Welfare Avenue's voice (wa-writing: warm, specific, no em dashes, impact first); the numbers are the website's
   published estimates (claude/www3-impact-figures.md: 14,000+ meals, 250+ servings, 600+ volunteers since April 2020;
   the giving ladder from the 2026 grocery orders and recipe book). [Square brackets] mark what the writer fills in: the
   studio's checks will not let an email go out while one is left. The transactional three (welcome, reminder, gift thanks)
   have none, so an automation can use them as they are; their placeholders are the ones the automations fill (wa157).
   Photos are the Photo library's ready ones (volunteers, food; no close-ups of the people we serve).
   Run: node build/data/wa202_starters.js  (then apply the SQL with execute_sql; it upserts by key) */
const fs = require('fs'), vm = require('vm'), path = require('path');
const M = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../parts202/c_blocks.js'), 'utf8') + '\n;MAIL202', { Object, Math, String, Number, Array, JSON, isNaN });
const PH = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/web/';
const pic = (id, file, alt) => ({ src: PH + file + '?v=1', alt, lib: 'photo:' + id });
const P = {
  team: pic(29, '2024-07-summer-team-under-the-tent.jpg', 'Thirteen volunteers in green Welfare Avenue vests under the green tent in a leafy park'),
  plating: pic(9, '2024-10-autumn-volunteers-plating.jpg', 'Two volunteers plate food side by side'),
  plate: pic(57, '2023-10-autumn-plate-served.jpg', 'Volunteers in green vests serving food onto a plate held out across the table'),
  crew: pic(58, '2023-10-autumn-crew-behind-the-table.jpg', 'Six volunteers in green vests smile behind the serving table in a park'),
  autumn: pic(26, '2022-10-autumn-crew-at-the-tent.jpg', 'About twenty volunteers in green Welfare Avenue vests in front of two green tents'),
  students: pic(52, '2022-10-autumn-student-group.jpg', 'About twenty-five young volunteers smiling behind folding tables under the green tent'),
  winter: pic(68, '2022-01-winter-crew-in-the-snow.jpg', 'About thirteen volunteers in winter coats and green vests in the snow'),
  salads: pic(3, 'food-salads-and-grapes.jpg', 'Foil trays of fresh green salads and grapes, seen from above'),
  gifts: pic(102, '2025-12-gift-baskets-the-crew.jpg', 'About twenty volunteers hold up wrapped gifts behind tables'),
  delivered: pic(110, '2025-12-gift-baskets-delivery.jpg', 'Five volunteers with carts piled high with gift bags'),
  ffteam: pic(101, '2026-08-flag-football-team-in-yellow.jpg', 'A team in yellow jerseys on the grass around a football'),
  ffjoy: pic(105, '2026-08-flag-football-celebration.jpg', 'A team in yellow celebrates on the field, arms raised'),
  fftent: pic(111, '2026-08-flag-football-our-tent.jpg', 'Our green tent with the Welfare Avenue table banner at the tournament')
};
const VOL = 'https://welfareavenue.com/volunteer/', GIVE = 'https://welfareavenue.com/donate/', SITE = 'https://welfareavenue.com/';
const TEAM = { type: 'signoff', closing: 'Warmly,', name: 'The Welfare Avenue team', role: '', ps: '' };
const WHO = { type: 'signoff', closing: 'Warmly,', name: '[Who signs it]', role: 'Welfare Avenue', ps: '' };
const LADDER = { type: 'list', items: [
  { lead: '$25', text: 'covers one recipe from our cookbook, like a fruit salad for 8 to 10 people.' },
  { lead: '$75', text: 'covers one volunteer cook’s batch: a dish for 30 to 35 people.' },
  { lead: '$250', text: 'covers the groceries for a whole Sunday serving, about 50 plates.' },
  { lead: '$20 a month', text: 'adds up to about 100 portions over a year.' }] };
const SINCE = { type: 'stats', style: 'green', title: 'Since April 2020', items: [{ n: '14,000+', label: 'meals served' }, { n: '250+', label: 'servings' }, { n: '600+', label: 'volunteers' }], note: 'Our best estimates from our records, rounded down.' };

const STARTERS = [
  { key: 'st_welcome_volunteer', sort: 200, name: 'Welcome, new volunteer', category: 'volunteers_welcome', audience: 'volunteers', kind: 'transactional',
    description: 'The first email a new volunteer gets: how a Sunday works and how to pick their first one. Ready for an automation (a form sign-up).',
    subject: 'Welcome to the crew, {{first_name|friend}}', preheader: 'How a Sunday works, and how to pick your first one.',
    blocks: [
      { type: 'hero', style: 'cream', kicker: 'Welcome to Welfare Avenue', lines: ['Welcome to', 'the crew'], lead: 'You just joined a youth-powered movement that meets people where they are, every week in Montreal.', doodle: 'heart' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\nThank you for signing up. Food is our starting point: it opens the conversation, builds trust, and connects people with the support they need. You are part of that now.' },
      Object.assign({ type: 'photo', caption: '' }, P.team),
      { type: 'heading', text: 'How a serving works' },
      { type: 'list', items: [
        { lead: 'Cooks', text: 'make a dish for 30 to 35 people from our recipe book.' },
        { lead: 'Drivers', text: 'bring the food and the supplies to the serving.' },
        { lead: 'Servers', text: 'set up, serve, and take the time to talk with the people we serve.' }] },
      { type: 'text', text: 'Pick a Sunday that works for you. Before it, we send you where to meet and what to bring.' },
      { type: 'button', label: 'Pick your first Sunday', url: VOL, caption: 'Your volunteer hours count for school and work.' },
      TEAM] },
  { key: 'st_serving_reminder', sort: 201, name: 'Reminder before a serving', category: 'volunteers_welcome', audience: 'volunteers', kind: 'transactional',
    description: 'A few days before someone serves: their role, the day, what to bring. Ready for a serving automation (it fills the day and the role).',
    subject: 'See you {{event_day|Sunday}}, {{first_name|friend}}', preheader: 'Your role, the day, and what to bring.',
    blocks: [
      { type: 'hero', style: 'cream', kicker: '{{event_when|Your next serving}}', lines: ['See you', '{{event_day|soon}}'], gold: 0, lead: 'You are down as **{{role|a volunteer}}** for {{event_title|our next serving}}. Thank you for giving your time to your community.', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\nA quick reminder before the day, so you have everything you need.' },
      { type: 'heading', text: 'The plan' },
      { type: 'details', rows: [
        { label: 'When', value: '{{event_when|See the serving page}}' },
        { label: 'Your role', value: '{{role|A volunteer}}' },
        { label: 'Where to meet', value: '{{event_location|In the text we send you the day before}}' },
        { label: 'Bring', value: 'Comfortable shoes, clothes for the weather and a water bottle' }] },
      { type: 'list', items: [
        { lead: 'Come ten minutes early', text: 'so the team leader can walk you through the day.' },
        { lead: 'First time?', text: 'You will be paired with someone who has done it before.' },
        { lead: 'Questions?', text: 'Reply to this email: a person reads it.' }] },
      { type: 'text', text: 'Can’t make it anymore? Reply and tell us, so we can find someone. No worries at all, it happens.' },
      TEAM] },
  { key: 'st_thanks_serving', sort: 202, name: 'Thank you after a serving', category: 'volunteers_welcome', audience: 'volunteers', kind: 'transactional',
    description: 'The day after a serving: what the volunteers made possible, a moment from the day, the next date.',
    subject: 'Thank you for Sunday, {{first_name|friend}}', preheader: '[What the day made possible, in a line]',
    asks: [{ id: 'plates', label: 'How many plates did we serve?', hint: 'About 50' }, { id: 'moment', label: 'A moment from the day worth sharing', hint: 'Someone came back to say thank you for last week' }, { id: 'next', label: 'When is the next serving?', hint: 'Sunday 19 October' }],
    blocks: [
      { type: 'hero', style: 'cream', kicker: 'Thank you', lines: ['Thank you for', 'being there'], lead: '[What the day made possible, in one sentence]', doodle: 'heart' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\nOn Sunday we served [how many] plates, and every one of them started a conversation. That is what you made possible.' },
      { type: 'photos', items: [Object.assign({ caption: '' }, P.plating), Object.assign({ caption: '' }, P.plate), Object.assign({ caption: '' }, P.crew)] },
      { type: 'quote', quote: '[A moment from the day, in the words of someone who was there]', by: '[Who said it]' },
      { type: 'heading', text: 'Next time' },
      { type: 'text', text: 'Our next serving is [the date]. Same crew, new stories.' },
      { type: 'button', label: 'Pick your next Sunday', url: VOL, caption: '' },
      WHO] },
  { key: 'st_callout', sort: 210, name: 'We need hands (a call-out)', category: 'volunteers_callouts', audience: 'volunteers', kind: 'volunteer',
    description: 'When a serving is short of people: the date, the roles still open, one button to sign up.',
    subject: '{{first_name|Friend}}, can you help on [the date]?', preheader: 'We need [how many] more [roles] for [the date].',
    asks: [{ id: 'date', label: 'Which serving, and when?', hint: 'Sunday 12 October, 11 am to 2 pm' }, { id: 'roles', label: 'Which roles are open, and how many people?', hint: '3 servers and 1 driver' }, { id: 'where', label: 'Where?', hint: 'Cabot Square' }, { id: 'why', label: 'Why this one matters', hint: 'First cold Sunday of the fall' }],
    blocks: [
      { type: 'hero', style: 'green', kicker: '[The date]', lines: ['We need', 'more hands'], lead: 'We are short [how many] [roles] for [the date]. Two minutes to sign up, a whole afternoon of impact.', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\n[Why this serving matters, in two or three sentences.]' },
      { type: 'heading', text: 'Where we need you' },
      { type: 'list', items: [{ lead: '[Role]:', text: '[what they do and when they start]' }, { lead: '[Role]:', text: '[what they do and when they start]' }] },
      { type: 'details', rows: [{ label: 'When', value: '[The date and time]' }, { label: 'Where', value: '[The place]' }, { label: 'Bring', value: 'Comfortable shoes and clothes for the weather' }] },
      Object.assign({ type: 'photo', caption: '' }, P.autumn),
      { type: 'button', label: 'Sign up to serve', url: VOL, caption: 'Your volunteer hours count. Bring a friend.' },
      WHO] },
  { key: 'st_event_invite_volunteers', sort: 211, name: 'Invitation to an event (volunteers)', category: 'volunteers_callouts', audience: 'volunteers', kind: 'volunteer',
    description: 'An invitation to a team event, a training or a celebration: what, when, where, and the sign-up.',
    subject: 'You’re invited: [the event]', preheader: '[The date] at [the place]. [The one-line hook].',
    asks: [{ id: 'what', label: 'What is the event?', hint: 'Our fall volunteer night' }, { id: 'when', label: 'When?', hint: 'Thursday 23 October, 6 to 8 pm' }, { id: 'where', label: 'Where?', hint: 'The address' }, { id: 'link', label: 'The link to sign up', hint: 'https://...' }],
    blocks: [
      { type: 'hero', style: 'cream', kicker: '[The date] · [The place]', lines: ['Save', 'the date'], lead: '[What the event is, in one sentence.]', doodle: 'flowers' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\n[Why you are inviting them, and what makes this event worth their evening.]' },
      { type: 'details', rows: [{ label: 'What', value: '[The event]' }, { label: 'When', value: '[The date and time]' }, { label: 'Where', value: '[The place]' }, { label: 'Cost', value: 'Free' }] },
      { type: 'photos', items: [Object.assign({ caption: '' }, P.students), Object.assign({ caption: '' }, P.winter), Object.assign({ caption: '' }, P.crew)] },
      { type: 'button', label: 'Save your spot', url: '[The sign-up link]', caption: '' },
      { type: 'band', title: 'Bring your crew', text: 'Invite a friend: the more of us in the room, the bigger the night.', links: [] },
      WHO] },
  { key: 'st_gift_thanks', sort: 220, name: 'Thank you for a gift', category: 'donors_thanks', audience: 'donors', kind: 'transactional',
    description: 'Right after a gift: thanks, and what a gift does. Ready for a gift automation (it fills the amount and the date).',
    subject: 'Thank you, {{first_name|friend}}', preheader: 'Your gift is already at work in our community.',
    blocks: [
      { type: 'hero', style: 'cream', kicker: 'Thank you', lines: ['Thank you.', 'Here is where it goes'], lead: 'Your gift keeps meals on the table and our youth-powered teams in the community.', doodle: 'heart' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\nYour gift of **{{amount|your gift}}**{{gift_date_line}} is already at work. It puts meals on the table on Sunday, and it keeps our teams in the community, building the trust that connects people with the support they need.' },
      Object.assign({ type: 'photo', caption: '' }, P.plate),
      { type: 'heading', text: 'What a gift can do' },
      LADDER,
      SINCE,
      { type: 'text', text: 'Eligible gifts get an official tax receipt from us. Questions about your gift? Reply to this email.' },
      { type: 'signoff', closing: 'With gratitude,', name: 'The Welfare Avenue team', role: '', ps: '' }] },
  { key: 'st_impact_update', sort: 221, name: 'Impact update', category: 'donors_thanks', audience: 'donors', kind: 'newsletter',
    description: 'A season in a few numbers and one story: for donors and supporters who said yes to our news.',
    subject: 'What your support did this [season]', preheader: '[The headline number, in a line]',
    asks: [{ id: 'season', label: 'Which season or period?', hint: 'This fall' }, { id: 'numbers', label: 'Two or three numbers from it', hint: '12 servings, 600 meals, 40 volunteers' }, { id: 'story', label: 'One story to tell', hint: 'Who, what happened, what changed' }],
    blocks: [
      { type: 'hero', style: 'green', kicker: '[Season] update', lines: ['What you', 'made possible'], lead: '[One specific moment or number from the season.]', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\n[Open with what happened, plainly and specifically.]' },
      { type: 'stats', style: 'cream', title: '[This season]', items: [{ n: '[number]', label: 'meals served' }, { n: '[number]', label: 'servings' }, { n: '[number]', label: 'volunteers' }], note: '' },
      { type: 'heading', text: 'One story' },
      Object.assign({ type: 'photo', caption: '' }, P.plating),
      { type: 'text', text: '[The story in a few sentences: who, what happened, what changed.]' },
      { type: 'quote', quote: '[A line from a volunteer or a partner]', by: '[Their name and role]' },
      { type: 'button', label: 'See more of our work', url: SITE, caption: '' },
      WHO] },
  { key: 'st_year_end', sort: 222, name: 'Year-end thank you', category: 'donors_thanks', audience: 'donors', kind: 'transactional',
    description: 'At the end of the year: what donors made possible, and how their official receipt reaches them.',
    subject: 'Thank you for this year, {{first_name|friend}}', preheader: 'What we did together this year, and your receipt.',
    asks: [{ id: 'year', label: 'Which year?', hint: '2026' }, { id: 'numbers', label: 'The year in two or three numbers', hint: 'Meals, servings, holiday gifts' }, { id: 'receipt', label: 'How their receipt reaches them', hint: 'By email in February' }],
    blocks: [
      { type: 'hero', style: 'cream', kicker: '[Year] in review', lines: ['Thank you', 'for every Sunday'], lead: '[The year in one sentence.]', doodle: 'flowers' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\n[What this year meant, in two or three sentences.]' },
      { type: 'stats', style: 'green', title: '[Year]', items: [{ n: '[number]', label: 'meals served' }, { n: '[number]', label: 'servings' }, { n: '[number]', label: 'holiday gifts' }], note: '' },
      { type: 'photos', items: [Object.assign({ caption: '' }, P.gifts), Object.assign({ caption: '' }, P.plate), Object.assign({ caption: '' }, P.team)] },
      { type: 'heading', text: 'Your receipt' },
      { type: 'text', text: '[How their official receipt reaches them.]' },
      { type: 'button', label: 'Visit welfareavenue.com', url: SITE, caption: '' },
      { type: 'signoff', closing: 'With gratitude,', name: '[Who signs it]', role: 'Welfare Avenue', ps: '' }] },
  { key: 'st_appeal', sort: 230, name: 'Appeal', category: 'donors_appeals', audience: 'donors', kind: 'fundraising',
    description: 'Asking for gifts: the need, what a gift does, one button. For people who said yes to our news or gave recently.',
    subject: '[The ask in a few words]', preheader: '[Why now, in a line]',
    asks: [{ id: 'goal', label: 'What are we raising for, and how much?', hint: '$3,000 for the winter servings' }, { id: 'deadline', label: 'By when?', hint: '31 December' }, { id: 'story', label: 'The person or moment behind it', hint: 'A Sunday in January when we ran out of soup' }],
    blocks: [
      { type: 'hero', style: 'green', kicker: '[The campaign]', lines: ['Help us', 'serve more'], lead: '[The goal in one sentence: how much, for what, by when.]', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\n[Open with the person or the moment behind this appeal.]\n\n[The need, plainly: what is missing, and what changes with it.]' },
      { type: 'heading', text: 'What your gift does' },
      LADDER,
      { type: 'stats', style: 'cream', title: 'Since April 2020', items: [{ n: '14,000+', label: 'meals served' }, { n: '250+', label: 'servings' }, { n: '600+', label: 'volunteers' }], note: 'Our best estimates from our records, rounded down.' },
      { type: 'button', label: 'Give today', url: GIVE, caption: 'Eligible gifts get an official tax receipt.' },
      Object.assign({}, WHO, { ps: '[One more reason to give, or the deadline]' })] },
  { key: 'st_fundraiser_invite', sort: 231, name: 'Invitation to a fundraiser', category: 'donors_appeals', audience: 'donors', kind: 'fundraising',
    description: 'An invitation to a fundraising event: what, when, where, tickets, and a way to give if they cannot come.',
    subject: 'Join us at [the event]', preheader: '[The date] at [the place]: [the hook].',
    asks: [{ id: 'what', label: 'What is the event?', hint: 'Flag Football 2026' }, { id: 'when', label: 'When?', hint: 'Saturday 15 August, 10 am' }, { id: 'where', label: 'Where?', hint: 'The park' }, { id: 'tickets', label: 'Tickets: the price and the link', hint: '$20, https://...' }],
    blocks: [
      { type: 'hero', style: 'cream', kicker: '[The date] · [The place]', lines: ['Join us', 'for a good cause'], lead: '[What the event is, in one sentence.]', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\n\n[What the event is, and what the money raised makes possible.]' },
      { type: 'details', rows: [{ label: 'What', value: '[The event]' }, { label: 'When', value: '[The date and time]' }, { label: 'Where', value: '[The place]' }, { label: 'Tickets', value: '[The price]' }] },
      { type: 'photos', items: [Object.assign({ caption: '' }, P.ffteam), Object.assign({ caption: '' }, P.ffjoy), Object.assign({ caption: '' }, P.fftent)] },
      { type: 'button', label: 'Get your ticket', url: '[The ticket link]', caption: '' },
      { type: 'band', title: 'Can’t make it?', text: 'You can still be part of it: every gift goes to our servings.', links: [{ label: 'Give online', url: GIVE }] },
      WHO] }
];

function q(s) { return s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'"; }
function build() {
let sql = '-- wa202_email_studio_starters (generated by build/data/wa202_starters.js; do not edit by hand): the studio\'s ten starter templates.\n' +
  '-- Upserts by key; created_by starter (only admins edit them; anyone with the CRM copies them).\n';
const out = [];
for (const s of STARTERS) {
  const design = M.clean({ v: 1, blocks: s.blocks, asks: s.asks || [], source: 'starter' });
  design.blocks.forEach((b, i) => { b.id = 'b' + s.key.replace(/^st_/, '').replace(/[^a-z]/g, '').slice(0, 6) + i; });
  const html = M.render(design), text = M.renderText(design);
  if (M.styleInner(html) !== html) throw new Error(s.key + ': styleInner would change the HTML');
  const vars = M.placeholders(s.subject + ' ' + s.preheader + ' ' + html);
  out.push({ key: s.key, html, text, design });
  sql += 'insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, active, sort, updated_by, updated_at, design, one_off, audience, category, lang, description, created_by, created_at) values (' +
    [q(s.key), q(s.name), q(s.kind), q(s.subject), q(s.preheader), q(html), q(text), q(JSON.stringify(vars)) + '::jsonb', 'true', s.sort, q('starter'), 'now()', q(JSON.stringify(design)) + '::jsonb', 'false', q(s.audience), q(s.category), q('en'), q(s.description), q('starter'), 'now()'].join(', ') +
    ') on conflict (key) do update set name = excluded.name, kind = excluded.kind, subject = excluded.subject, preheader = excluded.preheader, html_body = excluded.html_body, text_body = excluded.text_body, vars = excluded.vars, sort = excluded.sort, design = excluded.design, audience = excluded.audience, category = excluded.category, description = excluded.description, updated_by = excluded.updated_by, updated_at = now() where public.crm_email_templates.created_by = \'starter\';\n';
}
const rows = STARTERS.map(s => { const o = out.find(x => x.key === s.key); return { key: s.key, name: s.name, kind: s.kind, subject: s.subject, preheader: s.preheader, html_body: o.html, text_body: o.text,
  vars: M.placeholders(s.subject + ' ' + s.preheader + ' ' + o.html), active: true, sort: s.sort, updated_by: 'starter', design: o.design, one_off: false, audience: s.audience, category: s.category, lang: 'en', description: s.description, created_by: 'starter' }; });
return { sql: sql, rows: rows, out: out };
}
module.exports = { STARTERS: STARTERS, build: build, rows: function () { return build().rows; } };
if (require.main === module) {
const built = build(), sql = built.sql, rows = built.rows, out = built.out;
fs.writeFileSync(path.join(__dirname, 'wa202_email_studio_starters.sql'), sql);
if (process.argv.indexOf('--json') >= 0) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(rows));
if (process.argv[2] === '--preview') {
  const dir = process.argv[3] || '.';
  for (const s of STARTERS) fs.writeFileSync(path.join(dir, s.key + '.html'), M.preview({ design: out.find(o => o.key === s.key).design, subject: s.subject, preheader: s.preheader, kind: s.kind }));
}
console.log('wa202_email_studio_starters.sql:', STARTERS.length, 'starters,', sql.length, 'bytes');
}
