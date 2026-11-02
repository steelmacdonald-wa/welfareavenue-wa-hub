// wave271 Task 3: the offer email's Accept and Decline buttons in fn/recruit-actions, proved offline on the rig (test/w271rig.mjs).
// Run: node --test test/w271offer.test.mjs
// No live call of any kind: Google, Resend, the fonts and the logo are registered stubs, and the PDF library is a recording stand-in.
// The real onboard-link is loaded beside recruit-actions, so a token the email carries is proved by the function that will read it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { loadFn } from './w271rig.mjs';

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
const FORM = { lang: 'en', reports_to: 'Ruth Owen', hours: 4, start: '2026-11-16', respond_by: '2026-11-10', signer_email: 'steel.macdonald@welfareavenue.com', note: '' };

async function setup({ cand = {}, config = {} } = {}) {
  const rig = await loadFn('recruit-actions', {
    secrets: { RESEND_API_KEY: 're_stub_key', GOOGLE_SA_KEY: SA },
    config: { mail_mode: 'test', mail_test_recipients: 'qa@welfareavenue.com', offer_signer_email: 'steel.macdonald@welfareavenue.com', ...config },
    tables: {
      hub_candidates: [candidate(cand)], hub_positions: [], volunteer_signers: [], change_log: [],
      team_members: [{ id: 1, name: 'Ruth Owen', email: 'ruth.owen@welfareavenue.com', role: 'HR Lead' }, { id: 2, name: 'Steel MacDonald', email: 'steel.macdonald@welfareavenue.com', role: 'Executive Director' }],
    },
  });
  rig.setNow(NOW);
  rig.db.setCaller({ email: 'ruth.owen@welfareavenue.com', id: 'u1' });
  rig.fetchOn('https://oauth2.stub.test/token', { json: { access_token: 'g-stub', expires_in: 3600 } });
  rig.fetchOn('https://www.googleapis.com/upload/drive/v3/files', { json: { id: 'doc1', webViewLink: 'https://drive.stub.test/doc1' } });
  rig.fetchOn('https://fonts.googleapis.com/css2', { status: 404, text: '' });   // the PDF falls back to Helvetica, as it does when the fonts fail
  rig.fetchOn(SB + '/storage/v1/object/public/content-images/brand/logo-lockup-cream-600.png', { status: 404, text: '' });
  rig.fetchOn('https://api.resend.com/emails', { json: { id: 'em1' } });
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
