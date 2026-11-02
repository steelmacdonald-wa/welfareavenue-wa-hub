// wave271 Task 3: the offer email's Accept and Decline buttons in fn/recruit-actions, proved offline on the rig (test/w271rig.mjs).
// Run: node --test test/w271offer.test.mjs
// No live call of any kind: Google, Resend, the fonts and the logo are registered stubs, and the PDF library is a recording stand-in.
// The real onboard-link is loaded beside recruit-actions, so a token the email carries is proved by the function that will read it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { loadFn } from './w271rig.mjs';
import { availabilityOf } from './w275avail.mjs';

const NOW = '2026-11-01T15:00:00Z';
const SB = 'https://stub.supabase.test';
const HUB_O = 'https://hub.welfareavenue.com/o/';
// What the letter's PDF stand-in comes to for the Alex Tremblay offer below, taken from recruit-actions as it was before this task
// (the refresh from live, ceffb8e). The buttons live in the email only, so this must not move.
const PDF_HASH = '7498c67d834a117e254d0841c282c93ec474c4f8e906ccc07c89bfcc4f06f2ca';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const SA = JSON.stringify({ client_email: 'wa-hub-drive@stub.test', private_key: privateKey, token_uri: 'https://oauth2.stub.test/token' });

const candidate = (over = {}) => ({
  id: 11, name: 'Alex Tremblay', role: 'Program Coordinator', status: 'offer', owner: 'Ruth Owen', email: 'alex@example.com', phone: '',
  position_id: null, notes: '', practice: false, offer_doc_id: null, offer_doc_url: null, offer_sent_at: null, offer_email_to: null,
  offer_respond_by: null, offer_start: null, ...over,
});
const FORM = { lang: 'en', reports_to: 'Ruth Owen', hours: 4, start: '2026-11-16', respond_by: '2026-11-10', signer_email: 'steel.macdonald@welfareavenue.com', note: '', manager_member_id: 1 };   // wave275: the panel always sends the onboarding manager

async function setup({ cand = {}, config = {}, team, askReply } = {}) {
  const rig = await loadFn('recruit-actions', {
    secrets: { RESEND_API_KEY: 're_stub_key', GOOGLE_SA_KEY: SA },
    config: { mail_mode: 'test', mail_test_recipients: 'qa@welfareavenue.com', offer_signer_email: 'steel.macdonald@welfareavenue.com', ...config },
    tables: {
      hub_candidates: [candidate(cand)], hub_positions: [], volunteer_signers: [], change_log: [],
      team_members: team || [{ id: 1, name: 'Ruth Owen', email: 'ruth.owen@welfareavenue.com', role: 'HR Lead', active: true }, { id: 2, name: 'Steel MacDonald', email: 'steel.macdonald@welfareavenue.com', role: 'Executive Director', active: true }],
      hub_onboard_flows: [],
    },
  });
  rig.setNow(NOW);
  rig.db.setCaller({ email: 'ruth.owen@welfareavenue.com', id: 'u1' });
  rig.fetchOn('https://oauth2.stub.test/token', { json: { access_token: 'g-stub', expires_in: 3600 } });
  rig.fetchOn('https://www.googleapis.com/upload/drive/v3/files', { json: { id: 'doc1', webViewLink: 'https://drive.stub.test/doc1' } });
  rig.fetchOn('https://fonts.googleapis.com/css2', { status: 404, text: '' });   // the PDF falls back to Helvetica, as it does when the fonts fail
  rig.fetchOn(SB + '/storage/v1/object/public/content-images/brand/logo-lockup-cream-600.png', { status: 404, text: '' });
  rig.fetchOn('https://api.resend.com/emails', { json: { id: 'em1' } });
  rig.fetchOn(SB + '/functions/v1/onboard-run', (e) => (askReply ? askReply(e) : { json: { ok: true, sent: true, to: 'ruth.owen@welfareavenue.com' } }));   // wave275: ask_manager
  offerTrigger(rig);
  const link = await loadFn('onboard-link', { tables: { hub_candidates: [candidate(cand)], hub_onboard_flows: [], hub_onboard_grids: [], team_members: [], change_log: [] } });
  link.setNow(NOW);
  const send = async (f, email = true) => {
    const r = await rig.call(new Request(SB + '/functions/v1/recruit-actions', { method: 'POST', headers: { Authorization: 'Bearer stub', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'offer_send', id: 11, f, email }) }));
    return { status: r.status, body: await r.json() };
  };
  const mails = () => rig.fetchLog.filter((e) => e.url === 'https://api.resend.com/emails');
  const cand0 = () => rig.db.rows('hub_candidates')[0];
  return { rig, link, send, mails, cand0 };
}
// every <a ...>label</a> in the email, as { label, href } (the href as a browser reads it: &amp; undone)
/* wave275a's trigger wa275_offer_sent, as the rig has no triggers: offer_sent_at from empty to a time makes the offered flow with the card's onboard_manager_id, once */
function offerTrigger(rig) {
  rig.db.on('hub_candidates', 'update', (n, o, db) => {
    if (o.offer_sent_at != null || n.offer_sent_at == null) return;
    if (db.rows('hub_onboard_flows').some((f) => String(f.candidate_id) === String(n.id))) return;
    db.insert('hub_onboard_flows', { candidate_id: n.id, practice: !!n.practice, status: 'offered', manager_member_id: n.onboard_manager_id ?? null, created_at: new Date().toISOString() });
  });
}
const anchors = (html) => [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => ({ label: m[2].trim(), href: m[1].replace(/&amp;/g, '&') }));
const buttons = (html, labels) => Object.fromEntries(labels.map((l) => [l, anchors(html).find((a) => a.label === l)]));
const tokenOf = (href) => decodeURIComponent(new URL(href).pathname.slice('/o/'.length));
const asked = async (link, t) => { const r = await link.call(new Request(SB + '/functions/v1/onboard-link?t=' + encodeURIComponent(t))); return { status: r.status, body: await r.json() }; };

test('offer_send stores the reply-by and start dates, and still stores what it stored before', async () => {
  const s = await setup();
  const out = await s.send(FORM);
  assert.equal(out.status, 200);
  assert.equal(out.body.ok, true);
  const c = s.cand0();
  assert.equal(c.offer_respond_by, '2026-11-10');
  assert.equal(c.offer_start, '2026-11-16');
  assert.equal(c.offer_doc_id, 'doc1');
  assert.equal(c.offer_doc_url, 'https://drive.stub.test/doc1');
  assert.equal(c.offer_sent_at, '2026-11-01T15:00:00.000Z');
  assert.equal(c.offer_email_to, 'alex@example.com');
  assert.match(c.notes, /Offer letter \(signed by Steel MacDonald\) emailed in test mode/);
  assert.equal(s.rig.db.rows('change_log').length, 1);
  assert.deepEqual(s.rig.unregistered(), []);
});

test('a blank or odd start date is stored as nothing, and the letter without an email still stores the dates', async () => {
  const s = await setup();
  const out = await s.send({ ...FORM, start: '', respond_by: '2026-11-10T00:00:00' }, false);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.emailed, null);
  assert.equal(s.mails().length, 0, 'no email was asked for');
  assert.equal(s.cand0().offer_start, null);
  assert.equal(s.cand0().offer_respond_by, '2026-11-10');
  const again = await s.send({ ...FORM, start: 'next week' }, false);
  assert.equal(again.body.ok, true);
  assert.equal(s.cand0().offer_start, null);
});

test('the English email has an Accept and a Decline link; their token is the one onboard-link reads', async () => {
  const s = await setup();
  await s.send(FORM);
  assert.equal(s.mails().length, 1);
  const { html, text } = s.mails()[0].body;
  const b = buttons(html, ['Accept', 'Decline']);
  assert.ok(b.Accept && b.Decline, 'both buttons are links in the HTML');
  for (const a of [b.Accept, b.Decline]) assert.ok(a.href.startsWith(HUB_O), a.href);
  assert.notEqual(b.Accept.href, b.Decline.href, 'the two buttons are different links');
  assert.match(b.Accept.href, /[?&]a=accept\b/);
  assert.match(b.Decline.href, /[?&]a=decline\b/);
  assert.doesNotMatch(b.Accept.href, /[?&]l=fr/);
  const t = tokenOf(b.Accept.href);
  assert.equal(tokenOf(b.Decline.href), t);
  assert.match(t, /^11\.[A-Za-z0-9_-]{20}$/);
  assert.equal(t, await s.link.mod.wa271Token('offer', 11), 'the same token onboard-link would make');
  // proved by the real function: it accepts the token, and refuses the same token with a letter changed
  const ok = await asked(s.link, t);
  assert.equal(ok.status, 200);
  assert.deepEqual({ kind: ok.body.kind, first: ok.body.first, role: ok.body.role }, { kind: 'offer', first: 'Alex', role: 'Program Coordinator' });
  const bad = await asked(s.link, t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'));
  assert.equal(bad.status, 404);
  assert.equal(bad.body.error, 'bad_link');
  // the plain-text version carries both links too
  assert.ok(text.includes('Accept: ' + b.Accept.href), text);
  assert.ok(text.includes('Decline: ' + b.Decline.href), text);
  // nothing from a button leaks into the visible words, and the two links are the only /o/ links
  assert.equal(anchors(html).filter((a) => a.href.includes('/o/')).length, 2);
  assert.deepEqual(s.rig.unregistered(), []);
});

test('"just reply to this email" stays, in the HTML and the text, in both languages', async () => {
  const s = await setup();
  await s.send(FORM);
  await s.send({ ...FORM, lang: 'fr' });
  const [en, fr] = s.mails().map((m) => m.body);
  assert.ok(en.html.includes('Please let us know your answer by <strong style="color:#103F39;font-weight:700;">November 10, 2026</strong>: just reply to this email.'), 'the HTML sentence is unchanged');
  assert.ok(en.text.includes('Please let us know your answer by November 10, 2026: just reply to this email.\n\n'), 'the text sentence is unchanged');
  assert.ok(fr.html.includes('il suffit de répondre à ce courriel.'));
  assert.ok(fr.text.includes('il suffit de répondre à ce courriel.\n\n'));
});

test('a French offer says Accepter and Refuser, opens the page in French, and carries the same token', async () => {
  const s = await setup();
  await s.send({ ...FORM, lang: 'fr' });
  const { html, text, subject } = s.mails()[0].body;
  assert.match(subject, /^\[TEST, for alex@example\.com\] Votre offre de Welfare Avenue : Program Coordinator$/);
  const b = buttons(html, ['Accepter', 'Refuser']);
  assert.ok(b.Accepter && b.Refuser);
  assert.match(b.Accepter.href, /[?&]a=accept\b/);
  assert.match(b.Refuser.href, /[?&]a=decline\b/);
  for (const a of [b.Accepter, b.Refuser]) { assert.ok(a.href.startsWith(HUB_O)); assert.equal(new URL(a.href).searchParams.get('l'), 'fr'); }
  assert.equal(tokenOf(b.Accepter.href), await s.link.mod.wa271Token('offer', 11));
  assert.equal((await asked(s.link, tokenOf(b.Refuser.href))).status, 200);
  assert.ok(text.includes('Accepter : ' + b.Accepter.href) && text.includes('Refuser : ' + b.Refuser.href), text);
  assert.equal(anchors(html).some((a) => a.label === 'Accept' || a.label === 'Decline'), false, 'no English labels in the French email');
  assert.doesNotMatch(text, /Accept:|Decline:/);
});

test('the buttons use inline tables with the brand colours, like the rest of the email, and the HTML stays valid in an email client', async () => {
  const s = await setup();
  await s.send(FORM);
  const { html } = s.mails()[0].body;
  const at = html.indexOf('>Accept<');
  const row = html.slice(html.lastIndexOf('<table', at), html.indexOf('</table>', at) + 8);
  assert.match(row, /role="presentation"/);
  assert.match(row, /background-color:#103F39/);   // Accept: the green button
  assert.match(row, /color:#FFFAF2/);
  assert.match(row, /Decline/);
  assert.doesNotMatch(html, /<button|<script|onclick/i);
  assert.doesNotMatch(html, /\bAI\b|—/);   // Hub words: no "AI", no em dash
  assert.equal((html.match(/<table/g) || []).length, (html.match(/<\/table>/g) || []).length, 'every table is closed');
});

test('test mode still goes to the test inbox, and a practice applicant still gets it at their own address', async () => {
  const real = await setup();
  await real.send(FORM);
  const m = real.mails()[0].body;
  assert.deepEqual(m.to, ['qa@welfareavenue.com']);
  assert.match(m.subject, /^\[TEST, for alex@example\.com\] Your offer from Welfare Avenue: Program Coordinator$/);
  assert.deepEqual(m.bcc, ['steel.macdonald@welfareavenue.com']);
  assert.ok(buttons(m.html, ['Accept']).Accept, 'the test email carries the buttons too');

  const prac = await setup({ cand: { practice: true, email: 'learner@example.com' } });
  await prac.send(FORM);
  const p = prac.mails()[0].body;
  assert.deepEqual(p.to, ['learner@example.com']);
  assert.match(p.subject, /^\[PRACTICE\] Your offer from Welfare Avenue: Program Coordinator$/);
  assert.equal(prac.cand0().offer_email_to, 'learner@example.com');
  assert.ok(buttons(p.html, ['Accept', 'Decline']).Decline, 'the learner can try the buttons');
  assert.match(prac.cand0().notes, /emailed to learner@example\.com/);

  const live = await setup({ config: { mail_mode: 'live' } });
  await live.send(FORM);
  assert.deepEqual(live.mails()[0].body.to, ['alex@example.com']);
  assert.doesNotMatch(live.mails()[0].body.subject, /TEST|PRACTICE/);
});

test('I6: the offer goes out from the HR sender, as live wave273 does: mail_from_hr, else job@', async () => {
  const plain = await setup({ config: { mail_from_email: 'info@welfareavenue.com' } });
  await plain.send(FORM);
  assert.match(plain.mails()[0].body.from, /<job@welfareavenue\.com>$/);
  const set = await setup({ config: { mail_from_hr: 'hiring@welfareavenue.com' } });
  await set.send(FORM);
  assert.match(set.mails()[0].body.from, /<hiring@welfareavenue\.com>$/);
});

test('the PDF is exactly what it was before the buttons', async () => {
  const s = await setup();
  await s.send(FORM);
  const att = s.mails()[0].body.attachments;
  assert.equal(att.length, 1);
  assert.match(att[0].filename, /^Offer letter - Alex Tremblay - Program Coordinator - 01-11-26\.pdf$/);
  const bytes = Buffer.from(att[0].content, 'base64');
  const drawn = bytes.toString('utf8');
  assert.doesNotMatch(drawn, /hub\.welfareavenue\.com|\/o\/|Accept|Decline|Accepter|Refuser/, 'no button, link or token in the letter');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), PDF_HASH);
  // the French letter is the French letter, with no buttons in it either
  await s.send({ ...FORM, lang: 'fr' });
  const fr = Buffer.from(s.mails()[1].body.attachments[0].content, 'base64').toString('utf8');
  assert.doesNotMatch(fr, /hub\.welfareavenue\.com|\/o\/|Accepter|Refuser/);
  assert.match(fr, /Offre de poste/);
});

/* ---------- wave275 Task 5: the offer asks for the onboarding manager and the hours (4, 6 or 8); the manager is asked for times ---------- */
const RUN = SB + '/functions/v1/onboard-run';
const drive = (s) => s.rig.fetchLog.filter((e) => e.url.startsWith('https://www.googleapis.com/upload/drive/v3/files'));
const asks = (s) => s.rig.fetchLog.filter((e) => e.url === RUN);
const hubWords = (x) => !/—/.test(x) && !/\bAI\b/.test(x);
const updatesOf = (rig) => {   // each update statement on the card, as the keys it changed
  const seen = [];
  rig.db.on('hub_candidates', 'update', (n, o) => { seen.push(Object.keys(n).filter((k) => JSON.stringify(n[k]) !== JSON.stringify(o[k]))); });
  return seen;
};

test('w275 offer_send refuses without an onboarding manager, or with hours other than 4, 6 or 8, in a plain sentence; nothing is made, sent or saved', async () => {
  for (const [f, code, words] of [
    [{ ...FORM, manager_member_id: undefined }, 'no_manager', /Choose the onboarding manager/],
    [{ ...FORM, manager_member_id: '' }, 'no_manager', /Choose the onboarding manager/],
    [{ ...FORM, hours: 5 }, 'bad_hours', /4, 6 or 8/],
    [{ ...FORM, hours: 10 }, 'bad_hours', /4, 6 or 8/],
    [{ ...FORM, hours: '' }, 'bad_hours', /4, 6 or 8/],
    [{ ...FORM, hours: 'six' }, 'bad_hours', /4, 6 or 8/],
  ]) {
    for (const email of [true, false]) {
      const s = await setup();
      const before = structuredClone(s.rig.db.tables);
      const out = await s.send(f, email);
      assert.equal(out.status, 400, JSON.stringify([f, email]));
      assert.equal(out.body.code, code);
      assert.match(out.body.error, words);
      assert.ok(hubWords(out.body.error) && /\.$/.test(out.body.error), out.body.error);
      assert.equal(drive(s).length, 0, 'no letter in Drive');
      assert.equal(s.mails().length, 0, 'no email');
      assert.equal(asks(s).length, 0, 'nobody asked');
      assert.deepEqual(s.rig.db.tables, before, 'nothing saved');
    }
  }
});

test('w275 offer_send refuses a manager who is not on the roster, no longer active, or has no roster email', async () => {
  const team = [{ id: 1, name: 'Ruth Owen', email: 'ruth.owen@welfareavenue.com', active: true }, { id: 3, name: 'Old Hand', email: 'old.hand@welfareavenue.com', active: false }, { id: 4, name: 'No Mail', email: null, active: true }];
  for (const [id, code, words] of [[99, 'no_manager', /not on the roster/], [3, 'manager_inactive', /Old Hand is no longer active/], [4, 'manager_no_email', /No Mail has no email on the roster/]]) {
    const s = await setup({ team });
    const out = await s.send({ ...FORM, manager_member_id: id });
    assert.equal(out.status, 400, String(id));
    assert.equal(out.body.code, code);
    assert.match(out.body.error, words);
    assert.ok(hubWords(out.body.error));
    assert.equal(drive(s).length + s.mails().length + asks(s).length, 0);
    assert.equal(s.cand0().offer_sent_at, null);
  }
});

test('w275 offer_send stores offer_hours and onboard_manager_id with offer_sent_at in one update; the trigger makes the offered flow; onboard-run ask_manager is asked for it with the trigger secret', async () => {
  for (const hours of [4, 6, 8, '6']) {
    const s = await setup();
    const updates = updatesOf(s.rig);
    const out = await s.send({ ...FORM, hours, manager_member_id: '1' });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const c = s.cand0();
    assert.equal(c.offer_hours, Number(hours));
    assert.equal(c.onboard_manager_id, 1);
    assert.equal(c.offer_sent_at, '2026-11-01T15:00:00.000Z');
    const one = updates.find((keys) => keys.includes('offer_sent_at'));
    assert.ok(one && one.includes('offer_hours') && one.includes('onboard_manager_id'), 'one statement: ' + JSON.stringify(updates));
    const flows = s.rig.db.rows('hub_onboard_flows');
    assert.equal(flows.length, 1);
    assert.deepEqual([flows[0].status, flows[0].manager_member_id], ['offered', 1]);
    assert.equal(asks(s).length, 1);
    const a = asks(s)[0];
    assert.equal(a.method, 'POST');
    assert.equal(a.headers['x-wa-secret'], 'trigger-secret-for-tests');
    assert.deepEqual(a.body, { action: 'ask_manager', flow_id: flows[0].id });
    assert.equal(out.body.manager.asked, true);
    assert.equal(out.body.manager.name, 'Ruth Owen');
    assert.deepEqual(out.body.warnings, []);
    assert.deepEqual(s.rig.unregistered(), []);
  }
});

test('w275 the letter and its preview say the hours chosen; the default 4 leaves the letter exactly as it was', async () => {
  const s = await setup();
  s.rig.db.onRpc('wa271_default_manager', () => ({ member_id: 1, name: 'Ruth Owen', how: 'reports_to' }));
  const prev = async (f) => { const r = await s.rig.call(new Request(SB + '/functions/v1/recruit-actions', { method: 'POST', headers: { Authorization: 'Bearer stub', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'offer_preview', id: 11, f }) })); return r.json(); };
  assert.match((await prev({ ...FORM, hours: 8 })).html, /A minimum commitment of 8 hours per week/);
  assert.match((await prev({ ...FORM, hours: 4 })).html, /A minimum commitment of 4 hours per week/);
  await s.send({ ...FORM, hours: 6 });
  assert.match(Buffer.from(s.mails()[0].body.attachments[0].content, 'base64').toString('utf8'), /6 hours/);
});

test('w275 offer_preview gives the panel the position\'s manager (and how it was chosen) and the active roster with an email to choose from', async () => {
  const team = [{ id: 1, name: 'Ruth Owen', email: 'ruth.owen@welfareavenue.com', active: true }, { id: 2, name: 'Ada Bell', email: 'ada.bell@welfareavenue.com', active: true }, { id: 3, name: 'Old Hand', email: 'old.hand@welfareavenue.com', active: false }, { id: 5, name: '', email: 'x@welfareavenue.com', active: true }, { id: 6, name: 'No Mail', email: null, active: true }, { id: 7, name: 'Blank Mail', email: '  ', active: true }];
  const s = await setup({ team });
  const asked = [];
  s.rig.db.onRpc('wa271_default_manager', (a, _db, w) => { asked.push([a, w.jwt]); return { member_id: 1, name: 'Ruth Owen', how: 'reports_to' }; });
  const r = await s.rig.call(new Request(SB + '/functions/v1/recruit-actions', { method: 'POST', headers: { Authorization: 'Bearer stub', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'offer_preview', id: 11, f: FORM }) }));
  const b = await r.json();
  assert.equal(r.status, 200, JSON.stringify(b));
  assert.deepEqual(asked, [[{ p_candidate: 11 }, null]], 'asked once, as the service key');
  assert.deepEqual(b.manager, { default: { member_id: 1, name: 'Ruth Owen', how: 'reports_to', available: true, why: null }, choices: [{ id: 2, name: 'Ada Bell' }, { id: 1, name: 'Ruth Owen' }] }, 'no one inactive, unnamed or without an email');
  assert.ok(b.html, 'the letter as before');
  /* the default the Hub cannot tell: none; and a failing lookup still gives the choices */
  const none = await setup({ team });
  none.rig.db.onRpc('wa271_default_manager', () => { throw new Error('no such function'); });
  const r2 = await (await none.rig.call(new Request(SB + '/functions/v1/recruit-actions', { method: 'POST', headers: { Authorization: 'Bearer stub', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'offer_preview', id: 11, f: FORM }) }))).json();
  assert.deepEqual(r2.manager.default, { member_id: null, name: null, how: 'none', available: false, why: null });
  assert.equal(r2.manager.choices.length, 2);
  /* a default the send would refuse is said to be unavailable, with why, and is not among the choices */
  for (const [id, why] of [[3, 'inactive'], [6, 'no_email'], [7, 'no_email'], [99, 'inactive']]) {
    const u = await setup({ team });
    u.rig.db.onRpc('wa271_default_manager', () => ({ member_id: id, name: 'Someone', how: 'reports_to' }));
    const r3 = await (await u.rig.call(new Request(SB + '/functions/v1/recruit-actions', { method: 'POST', headers: { Authorization: 'Bearer stub', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'offer_preview', id: 11, f: FORM }) }))).json();
    assert.deepEqual([r3.manager.default.available, r3.manager.default.why], [false, why], String(id));
    assert.ok(!r3.manager.choices.some((x) => x.id === id));
  }
});

test('w275 fix: an ask_manager skip says why in the warnings; "already sent" is reported as already asked, with no warning', async () => {
  const proposed = await setup({ askReply: () => ({ json: { ok: true, skipped: 'proposed', reason: 'Times are already proposed for this new hire and wait for their answer, so the manager was not asked again.' } }) });
  const a = await proposed.send(FORM);
  assert.equal(a.status, 200);
  assert.deepEqual([a.body.manager.asked, a.body.manager.skipped, a.body.manager.already], [false, 'proposed', undefined]);
  assert.deepEqual(a.body.warnings, ['Ruth Owen was not asked for times: Times are already proposed for this new hire and wait for their answer, so the manager was not asked again.']);
  for (const skipped of ['closed', 'not_open', 'wave271']) {
    const s = await setup({ askReply: () => ({ json: { ok: true, skipped, reason: 'Because.' } }) });
    const b = await s.send(FORM);
    assert.equal(b.body.manager.asked, false);
    assert.equal(b.body.warnings.length, 1, skipped);
    assert.match(b.body.warnings[0], /^Ruth Owen was not asked for times: Because\.$/);
  }
  const already = await setup({ askReply: () => ({ json: { ok: true, skipped: 'already_sent', reason: 'Ruth Owen already has their link to propose times.' } }) });
  const c = await already.send(FORM);
  assert.deepEqual(c.body.manager, { asked: true, already: true, name: 'Ruth Owen', skipped: 'already_sent' });
  assert.deepEqual(c.body.warnings, []);
});

test('w275 fix: when neither card update can be saved, the offer says what the card does not record (the email has gone)', async () => {
  const s = await setup();
  s.rig.db.failOn('hub_candidates', 'update', 'trigger wa275_offer_sent raised');
  s.rig.db.failOn('hub_candidates', 'update', 'trigger wa275_offer_sent raised');
  const out = await s.send(FORM);
  assert.equal(out.status, 200);
  assert.equal(s.mails().length, 1, 'the email went');
  assert.equal(s.cand0().offer_sent_at, null, 'not recorded');
  assert.equal(out.body.manager, null);
  assert.equal(asks(s).length, 0);
  assert.equal(out.body.warnings.length, 2, JSON.stringify(out.body.warnings));
  assert.match(out.body.warnings[0], /hours and the onboarding manager could not be saved/);
  assert.match(out.body.warnings[1], /could not record the offer either \(trigger wa275_offer_sent raised\)\. The email went out, but the card does not show when it was sent, to whom, the letter's link or the note\. Tell Steel\. The letter is in Offer Letters: https:\/\/drive\.stub\.test\/doc1$/);
  for (const w of out.body.warnings) assert.ok(hubWords(w), w);
  /* one failure only: the fallback saves the bookkeeping, with the one warning */
  const one = await setup();
  one.rig.db.failOn('hub_candidates', 'update', 'column offer_hours does not exist');
  const r = await one.send(FORM);
  assert.equal(r.body.warnings.length, 1);
  assert.equal(one.cand0().offer_sent_at, '2026-11-01T15:00:00.000Z');
});

test('w275 "Create the letter only" stores the hours and the manager but asks nobody: the offer has not gone out', async () => {
  const s = await setup();
  const out = await s.send({ ...FORM, hours: 8 }, false);
  assert.equal(out.status, 200);
  assert.equal(s.cand0().offer_hours, 8);
  assert.equal(s.cand0().onboard_manager_id, 1);
  assert.equal(s.cand0().offer_sent_at, null);
  assert.equal(s.rig.db.rows('hub_onboard_flows').length, 0);
  assert.equal(asks(s).length, 0);
  assert.equal(out.body.manager, null);
});

test('w275 onboard-run not answering, or refusing, is a warning on an offer that still went out', async () => {
  const down = await setup({ askReply: () => ({ status: 503, json: { error: 'down' } }) });
  const a = await down.send(FORM);
  assert.equal(a.status, 200);
  assert.equal(a.body.ok, true);
  assert.equal(a.body.manager.asked, false);
  assert.ok(a.body.warnings.length === 1 && /Ruth Owen was not asked for times yet/.test(a.body.warnings[0]) && /hourly/.test(a.body.warnings[0]), JSON.stringify(a.body.warnings));
  assert.equal(down.cand0().offer_sent_at, '2026-11-01T15:00:00.000Z');
  const refused = await setup({ askReply: () => ({ status: 409, json: { error: 'manager_no_email', message: 'Ruth Owen has no email on the roster, so the Hub cannot ask them for times.' } }) });
  const b = await refused.send(FORM);
  assert.equal(b.status, 200);
  assert.ok(b.body.warnings.some((x) => /has no email on the roster/.test(x)), JSON.stringify(b.body.warnings));
  for (const w of [...a.body.warnings, ...b.body.warnings]) assert.ok(hubWords(w));
});

test('w275 offer_send again with another manager: the offered flow takes the new manager and they are asked; with times already proposed the flow keeps its manager and says why', async () => {
  const s = await setup();
  await s.send(FORM);
  const again = await s.send({ ...FORM, manager_member_id: 2 });
  assert.equal(again.status, 200);
  assert.equal(s.rig.db.rows('hub_onboard_flows').length, 1, 'no second flow');
  assert.equal(s.rig.db.rows('hub_onboard_flows')[0].manager_member_id, 2);
  assert.equal(s.cand0().onboard_manager_id, 2);
  assert.equal(asks(s).length, 2);
  assert.equal(again.body.manager.name, 'Steel MacDonald');

  const p = await setup();
  await p.send(FORM);
  Object.assign(p.rig.db.rows('hub_onboard_flows')[0], { proposed_at: '2026-11-01T12:00:00Z', proposed_call_at: '2026-11-05T15:00:00Z', proposed_one_on_one_at: '2026-11-05T17:00:00Z' });
  const r = await p.send({ ...FORM, manager_member_id: 2 });
  assert.equal(r.status, 200);
  assert.equal(p.rig.db.rows('hub_onboard_flows')[0].manager_member_id, 1, 'the proposal stays with the manager who made it');
  assert.ok(r.body.warnings.some((x) => /already proposed times/.test(x) && /Change manager on the card/.test(x)), JSON.stringify(r.body.warnings));

  /* accepted since (waiting, a manager on it): the card keeps its manager; the flow is the card's to change */
  const w = await setup();
  await w.send(FORM);
  w.rig.db.rows('hub_onboard_flows')[0].status = 'waiting';
  const late = await w.send({ ...FORM, manager_member_id: 2 });
  assert.equal(late.status, 200);
  assert.equal(w.rig.db.rows('hub_onboard_flows')[0].manager_member_id, 1);
  assert.ok(late.body.warnings.some((x) => /keeps its manager now that the offer is accepted/.test(x)), JSON.stringify(late.body.warnings));
  assert.equal(asks(w).length, 1, 'the new person is not asked for a flow that is not theirs');
});

test('w275 integration: the offer, the trigger and the real onboard-run on one database: the manager gets their link, and onboard-link opens it as theirs', async () => {
  let run = null;
  const s = await setup({ askReply: async (e) => { const r = await run.call(new Request(RUN, { method: 'POST', headers: e.headers, body: JSON.stringify(e.body) })); s.rig.client(); return r; } });
  const { generateKeyPairSync: kp } = await import('node:crypto');
  const { privateKey: pk } = kp('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  run = await loadFn('onboard-run', { secrets: { GOOGLE_SA_KEY: JSON.stringify({ client_email: 'hub@stub.iam', private_key: pk, token_uri: 'https://oauth2.googleapis.com/token' }) } });
  run.db.tables = s.rig.db.tables;   // one database
  run.setNow(NOW);
  const notified = [];
  run.fetchOn(SB + '/functions/v1/notify', (e) => { notified.push(e.body); return { json: { outcome: { [e.body.to_email]: 'sent' }, hub: 'off' } }; });
  run.fetchOn('https://oauth2.googleapis.com/token', { json: { access_token: 'tok', expires_in: 3600 } });
  run.fetchOn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { json: { id: 'mail1' } });
  const out = await s.send(FORM);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.manager.asked, true, JSON.stringify(out.body));
  const f = s.rig.db.rows('hub_onboard_flows')[0];
  assert.equal(f.manager_link_member_id, 1);
  assert.ok(f.manager_link_sent_at);
  assert.equal(notified.length, 1);
  assert.equal(notified[0].event, 'onboard_propose');
  assert.equal(notified[0].to_email, 'ruth.owen@welfareavenue.com');
  const mail = run.fetchLog.filter((e) => e.url.includes('gmail'));
  assert.equal(mail.length, 1, 'and the email from hub@');
  const t = decodeURIComponent(notified[0].url.slice('/o/'.length));
  s.link.db.tables = s.rig.db.tables;
  s.link.db.onRpc('wa275_availability_of', availabilityOf);   // amended 02/11/26: the manager's hours are read through the function
  const g2 = await s.link.call(new Request(SB + '/functions/v1/onboard-link?t=' + encodeURIComponent(t)));
  const b = await g2.json();
  assert.equal(g2.status, 200, JSON.stringify(b));
  assert.deepEqual([b.kind, b.mode, b.notYours, b.first, b.hire], ['manager', 'propose', undefined, 'Ruth', 'Alex']);
  assert.deepEqual(s.rig.unregistered(), []);
  assert.deepEqual(run.unregistered(), []);
});
